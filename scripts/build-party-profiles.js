#!/usr/bin/env node
/**
 * build-party-profiles.js
 *
 * Construit le profil idéologique de chaque parti ET de chaque député à partir :
 *   - public/data/match-mapping.json   (scrutin → position du Match, édito)
 *   - public/data/votes-by-depute.json (index inversé)
 *   - public/data/deputes.json         (pour mapper député → groupe)
 *
 * Sortie : public/data/party-profiles.json
 *
 * Format de sortie :
 * {
 *   generatedAt: "...",
 *   nbScrutinsMappes: 60,
 *   nbPositions: 100,            // 20 questions * 5 positions
 *   partis: {
 *     "REN": {
 *       nom: "Renaissance",
 *       nbDeputes: 95,
 *       profil: { "positionId": score(-100..+100), ... },
 *       couverture: { "positionId": nbScrutinsPourCettePos, ... }
 *     },
 *     ...
 *   },
 *   deputes: {
 *     "PA722114": { profil: { ... }, couverture: { ... } },
 *     ...
 *   }
 * }
 *
 * Logique :
 *   Pour chaque scrutin mappé { positionId, poids } :
 *     - vote Pour       → +poids sur cette position
 *     - vote Contre     → -poids sur cette position
 *     - vote Abstention →  0 (mais compté dans la couverture)
 *     - non-votant      → ignoré (pas compté)
 *   Score final = somme / nbScrutinsExprimés, mappé sur [-100..+100].
 *
 * Usage : npm run build:profiles  (à lancer après build:index)
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
    if (f === MAPPING_FILE) console.error('           → crée-le depuis le template (cf. README).')
    else console.error('           → lance les scripts amont (fetch:scrutins / build:index / fetch:deputes).')
    process.exit(1)
  }
}

const mapping  = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8'))
const votes    = JSON.parse(fs.readFileSync(VOTES_FILE, 'utf8'))
const deputes  = JSON.parse(fs.readFileSync(DEPUTES_FILE, 'utf8'))
const propos   = JSON.parse(fs.readFileSync(PROPOS_FILE, 'utf8'))

const entries = Object.entries(mapping.scrutins || {})
console.log(`[profiles] ${entries.length} scrutins mappés`)
console.log(`[profiles] ${deputes.count} députés, ${propos.questions.length} questions Match`)

// Liste des positions valides (sécurité : on ignore tout positionId qui n'existe pas)
const validPositions = new Set()
for (const q of propos.questions) for (const p of q.positions) validPositions.add(p.id)

// ─── Init profils par député ───────────────────────────────────
// Structure : profilSum[id][positionId] = { somme, nbExprimes }
const profilDeputes = new Map()
const ensureDepute = (id) => {
  if (!profilDeputes.has(id)) profilDeputes.set(id, { sum: {}, n: {} })
  return profilDeputes.get(id)
}

// Index inversé : pour chaque scrutin, qui a voté quoi
// On reconstruit à partir de votes-by-depute (qui est dans l'autre sens)
// → on génère un map { scrutinNumero → { acteurId → 'pour'|'contre'|'abstention'|'nonVotants' } }
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
let nbMatched = 0
for (const [scrutinNum, m] of entries) {
  const num = parseInt(scrutinNum, 10)
  const positionId = m.positionId
  const poids = m.poids ?? 1
  if (!validPositions.has(positionId)) {
    console.warn(`[profiles] ⚠ position inconnue "${positionId}" pour scrutin ${num}, ignoré`)
    continue
  }
  const votesOnScrutin = scrutinIndex.get(num)
  if (!votesOnScrutin) {
    console.warn(`[profiles] ⚠ scrutin ${num} absent des données, ignoré`)
    continue
  }
  nbMatched++

  for (const [acteurId, type] of votesOnScrutin) {
    if (type === 'nonVotants') continue
    const p = ensureDepute(acteurId)
    p.sum[positionId] = (p.sum[positionId] || 0) + (
      type === 'pour'   ?  poids :
      type === 'contre' ? -poids :
      0  // abstention
    )
    p.n[positionId] = (p.n[positionId] || 0) + 1
  }
}
console.log(`[profiles] ${nbMatched} scrutins effectivement traités`)

// ─── Normalisation : score / nbExprimés * 100, clamp [-100, +100] ──
const normalize = (raw) => {
  const profil = {}, couverture = {}
  for (const posId of Object.keys(raw.sum)) {
    const n = raw.n[posId] || 0
    if (n === 0) continue
    const score = (raw.sum[posId] / n) * 100
    profil[posId] = Math.max(-100, Math.min(100, Math.round(score)))
    couverture[posId] = n
  }
  return { profil, couverture }
}

const deputesOut = {}
for (const [id, raw] of profilDeputes) {
  deputesOut[id] = normalize(raw)
}

// ─── Agrégation par parti ──────────────────────────────────────
// Pour chaque parti : moyenne des profils de ses députés, pondérée par couverture.
const partis = new Map() // code → { nom, deputeIds: [] }
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
    couverture[posId] = sumPoids[posId]
  }
  partisOut[code] = {
    nom: p.nom,
    nbDeputes: p.deputeIds.length,
    profil,
    couverture
  }
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
  console.log(`\n[profiles] ⚠ Aucun scrutin n'a été mappé. Remplis public/data/match-mapping.json.`)
}
