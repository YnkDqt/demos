#!/usr/bin/env node
/**
 * build-party-profiles.js
 *
 * Construit le profil idéologique de chaque parti ET de chaque député à partir :
 *   - public/data/match-mapping.json   (scrutin → N positions du Match, édito)
 *   - public/data/votes-by-depute.json (index inversé)
 *   - public/data/deputes.json
 *   - public/data/propositions-match.json (pour valider les positionId)
 *
 * Sortie : public/data/party-profiles.json
 *
 * Format de mapping (V2 — multi-positions) :
 * {
 *   "scrutins": {
 *     "6899": {
 *       "positions": [
 *         { "positionId": "eco-prog",    "poids": 1   },
 *         { "positionId": "env-radical", "poids": 0.5 }
 *       ],
 *       "note": "optionnel, traçabilité éditoriale"
 *     }
 *   }
 * }
 *
 * Rétro-compat V1 : si "positionId" est défini à la racine du scrutin,
 * il est converti vers le nouveau format au runtime (warning).
 *
 * Logique de calcul (par position) :
 *   - vote Pour       → +poids
 *   - vote Contre     → -poids
 *   - vote Abstention →  0 (compté dans la couverture)
 *   - non-votant      → ignoré
 *   Score final = somme / nbExprimés * 100, clamp [-100..+100].
 *
 * Usage : npm run build:profiles
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DATA = path.join(ROOT, 'public', 'data')

const MAPPING_FILE = path.join(DATA, 'match-mapping.json')
const VOTES_FILE   = path.join(DATA, 'votes-by-depute.json')
const DEPUTES_FILE = path.join(DATA, 'deputes.json')
const PROPOS_FILE  = path.join(DATA, 'propositions-match.json')
const OUT          = path.join(DATA, 'party-profiles.json')

for (const f of [MAPPING_FILE, VOTES_FILE, DEPUTES_FILE, PROPOS_FILE]) {
  if (!fs.existsSync(f)) {
    console.error(`[profiles] ${path.relative(ROOT, f)} introuvable.`)
    process.exit(1)
  }
}

const mapping = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8'))
const votes   = JSON.parse(fs.readFileSync(VOTES_FILE, 'utf8'))
const deputes = JSON.parse(fs.readFileSync(DEPUTES_FILE, 'utf8'))
const propos  = JSON.parse(fs.readFileSync(PROPOS_FILE, 'utf8'))

// Positions valides
const validPositions = new Set()
for (const q of propos.questions) for (const p of q.positions) validPositions.add(p.id)

// ─── Normalisation des entrées mapping (rétro-compat V1) ──────
const normalizeEntry = (raw, scrutinNum) => {
  // V2 : { positions: [...] }
  if (Array.isArray(raw?.positions)) {
    return raw.positions
      .filter(p => {
        if (!validPositions.has(p.positionId)) {
          console.warn(`[profiles] ⚠ position inconnue "${p.positionId}" (scrutin ${scrutinNum}), ignorée`)
          return false
        }
        return true
      })
      .map(p => ({ positionId: p.positionId, poids: p.poids ?? 1 }))
  }
  // V1 : { positionId, poids } → convertir
  if (raw?.positionId) {
    console.warn(`[profiles] ℹ format V1 détecté pour scrutin ${scrutinNum}, conversion auto`)
    if (!validPositions.has(raw.positionId)) {
      console.warn(`[profiles] ⚠ position inconnue "${raw.positionId}" (scrutin ${scrutinNum}), ignorée`)
      return []
    }
    return [{ positionId: raw.positionId, poids: raw.poids ?? 1 }]
  }
  return []
}

const entries = Object.entries(mapping.scrutins || {})
console.log(`[profiles] ${entries.length} scrutins dans le mapping`)
console.log(`[profiles] ${deputes.count} députés, ${propos.questions.length} questions Match`)

// ─── Index scrutin → votes ─────────────────────────────────────
console.log('[profiles] Reconstruction index scrutin→votes...')
const scrutinIndex = new Map()
for (const [acteurId, v] of Object.entries(votes.byDepute)) {
  for (const type of ['pour', 'contre', 'abstention', 'nonVotants']) {
    for (const num of (v[type] || [])) {
      if (!scrutinIndex.has(num)) scrutinIndex.set(num, new Map())
      scrutinIndex.get(num).set(acteurId, type)
    }
  }
}
console.log(`[profiles] ${scrutinIndex.size} scrutins indexés`)

// ─── Accumulation par député ───────────────────────────────────
const profilDeputes = new Map()
const ensureDepute = (id) => {
  if (!profilDeputes.has(id)) profilDeputes.set(id, { sum: {}, n: {} })
  return profilDeputes.get(id)
}

let nbMatched = 0
for (const [scrutinNum, raw] of entries) {
  const num = parseInt(scrutinNum, 10)
  const positions = normalizeEntry(raw, num)
  if (positions.length === 0) continue

  const votesOnScrutin = scrutinIndex.get(num)
  if (!votesOnScrutin) {
    console.warn(`[profiles] ⚠ scrutin ${num} absent des données, ignoré`)
    continue
  }
  nbMatched++

  for (const [acteurId, type] of votesOnScrutin) {
    if (type === 'nonVotants') continue
    const p = ensureDepute(acteurId)
    const sign = type === 'pour' ? 1 : type === 'contre' ? -1 : 0
    for (const { positionId, poids } of positions) {
      p.sum[positionId] = (p.sum[positionId] || 0) + sign * poids
      p.n[positionId]   = (p.n[positionId]   || 0) + Math.abs(poids)
    }
  }
}
console.log(`[profiles] ${nbMatched} scrutins effectivement traités`)

// ─── Normalisation ─────────────────────────────────────────────
const normalize = (raw) => {
  const profil = {}, couverture = {}
  for (const posId of Object.keys(raw.sum)) {
    const n = raw.n[posId] || 0
    if (n === 0) continue
    const score = (raw.sum[posId] / n) * 100
    profil[posId] = Math.max(-100, Math.min(100, Math.round(score)))
    couverture[posId] = Math.round(n * 10) / 10
  }
  return { profil, couverture }
}

const deputesOut = {}
for (const [id, raw] of profilDeputes) deputesOut[id] = normalize(raw)

// ─── Agrégation par parti ──────────────────────────────────────
const partis = new Map()
for (const d of deputes.deputes) {
  if (!d.groupe?.code) continue
  if (!partis.has(d.groupe.code)) {
    partis.set(d.groupe.code, { nom: d.groupe.nom, deputeIds: [] })
  }
  partis.get(d.groupe.code).deputeIds.push(d.id)
}

const partisOut = {}
for (const [code, p] of partis) {
  const sumProfil = {}, sumPoids = {}
  for (const did of p.deputeIds) {
    const dp = deputesOut[did]
    if (!dp) continue
    for (const [posId, score] of Object.entries(dp.profil)) {
      const w = dp.couverture[posId] || 1
      sumProfil[posId] = (sumProfil[posId] || 0) + score * w
      sumPoids[posId]  = (sumPoids[posId]  || 0) + w
    }
  }
  const profil = {}, couverture = {}
  for (const posId of Object.keys(sumProfil)) {
    if (sumPoids[posId] === 0) continue
    profil[posId] = Math.round(sumProfil[posId] / sumPoids[posId])
    couverture[posId] = Math.round(sumPoids[posId] * 10) / 10
  }
  partisOut[code] = { nom: p.nom, nbDeputes: p.deputeIds.length, profil, couverture }
}

const out = {
  generatedAt: new Date().toISOString(),
  nbScrutinsMappes: nbMatched,
  nbPositions: validPositions.size,
  partis: partisOut,
  deputes: deputesOut
}

fs.writeFileSync(OUT, JSON.stringify(out))
console.log(`[profiles] ✓ ${path.relative(ROOT, OUT)}`)
console.log(`[profiles]   ${Object.keys(partisOut).length} partis · ${Object.keys(deputesOut).length} députés avec profil`)
console.log(`[profiles]   Taille : ${(fs.statSync(OUT).size / 1024).toFixed(0)} Ko`)

if (nbMatched === 0) {
  console.log(`\n[profiles] ⚠ Aucun scrutin n'a été mappé. Remplis public/data/match-mapping.json via l'admin.`)
}
