#!/usr/bin/env node
/**
 * fetch-scrutins.js
 *
 * Aspire les scrutins (votes publics) depuis l'open data AN.
 * Source : data.assemblee-nationale.fr (jeu "Scrutins_XVII")
 *
 * Usage : node scripts/fetch-scrutins.js --legis 17
 *
 * Sorties :
 *  - public/data/scrutins-index.json  (métadonnées de tous les scrutins, ~1-3 Mo)
 *  - public/data/votes/{numero}.json  (votes détaillés par scrutin, ~50 Ko chacun)
 *
 * Format scrutins-index.json :
 * {
 *   legislature: 17, generatedAt: "...", count: 1234,
 *   scrutins: [
 *     { numero: 6899, date: "2026-05-22", titre: "...", sort: "adopte",
 *       pour: 287, contre: 145, abstention: 12, nonVotants: 3 },
 *     ...
 *   ]
 * }
 *
 * Format votes/{numero}.json :
 * {
 *   numero: 6899, date: "...", titre: "...", sort: "adopte",
 *   ventilation: [
 *     { groupeId: "PO845484", groupeNom: "Renaissance", pour: 90, contre: 0,
 *       abstention: 2, nonVotants: 1,
 *       votes: { pour: ["PA722114", ...], contre: [...], abstention: [...], nonVotants: [...] }
 *     },
 *     ...
 *   ]
 * }
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import AdmZip from 'adm-zip'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const args = process.argv.slice(2)
const legisIdx = args.indexOf('--legis')
const legis = legisIdx >= 0 ? parseInt(args[legisIdx + 1], 10) : 17

const ROMAN = { 14: 'XIV', 15: 'XV', 16: 'XVI', 17: 'XVII' }
const roman = ROMAN[legis]
if (!roman) { console.error(`Légis ${legis} non supportée.`); process.exit(1) }

const URL = `https://data.assemblee-nationale.fr/static/openData/repository/${legis}/loi/scrutins/Scrutins.json.zip`
const OUT_DIR = path.join(ROOT, 'public', 'data')
const VOTES_DIR = path.join(OUT_DIR, 'votes')

console.log(`[scrutins] Légis ${legis} (${roman})`)
console.log(`[scrutins] URL : ${URL}`)

// ─── Download + Unzip ──────────────────────────────────────────
const res = await fetch(URL)
if (!res.ok) { console.error(`HTTP ${res.status} sur ${URL}`); process.exit(1) }
const buf = Buffer.from(await res.arrayBuffer())
console.log(`[scrutins] ZIP téléchargé : ${(buf.length / 1024 / 1024).toFixed(1)} Mo`)

const zip = new AdmZip(buf)
const entries = zip.getEntries().filter(e => e.entryName.endsWith('.json'))
console.log(`[scrutins] ${entries.length} fichiers JSON dans le ZIP`)

// Selon les légis, le ZIP contient soit 1 gros fichier global, soit 1 fichier par scrutin.
// On gère les deux cas.
let scrutinsRaw = []
if (entries.length === 1) {
  const obj = JSON.parse(zip.readAsText(entries[0]))
  const list = obj.scrutins?.scrutin || obj.export?.scrutins?.scrutin || obj
  scrutinsRaw = Array.isArray(list) ? list : [list]
} else {
  for (const e of entries) {
    try {
      const obj = JSON.parse(zip.readAsText(e))
      const s = obj.scrutin || obj
      if (s?.numero) scrutinsRaw.push(s)
    } catch {}
  }
}

console.log(`[scrutins] ${scrutinsRaw.length} scrutins parsés`)

// ─── Normalisation ─────────────────────────────────────────────
fs.mkdirSync(VOTES_DIR, { recursive: true })

// Vide le dossier votes/ d'abord (anciens fichiers d'une légis précédente potentiellement)
for (const f of fs.readdirSync(VOTES_DIR)) {
  if (f.endsWith('.json')) fs.unlinkSync(path.join(VOTES_DIR, f))
}

const indexEntries = []

const arr = (x) => x == null ? [] : Array.isArray(x) ? x : [x]
const txt = (x) => typeof x === 'object' ? (x?.['#text'] || '') : (x || '')

for (const s of scrutinsRaw) {
  const numero = parseInt(txt(s.numero), 10)
  if (!numero) continue

  const date = txt(s.dateScrutin)
  const titre = txt(s.titre) || txt(s.objet?.libelle) || ''
  const sort = txt(s.sort?.code) || txt(s.sort?.libelle) || ''
  const syntheseVote = s.syntheseVote || {}

  // Ventilation par groupe
  const groupes = arr(s.ventilationVotes?.organe?.groupes?.groupe || s.ventilationVotes?.groupes?.groupe)
  const ventilation = groupes.map(g => {
    const organe = g.organeRef || g.uid
    const vote = g.vote || {}
    const decompte = vote.decompteNominatif || vote.decompte || {}
    const pour = arr(decompte.pours?.votant).map(v => txt(v.acteurRef))
    const contre = arr(decompte.contres?.votant).map(v => txt(v.acteurRef))
    const abst = arr(decompte.abstentions?.votant).map(v => txt(v.acteurRef))
    const nonV = arr(decompte.nonVotants?.votant).map(v => txt(v.acteurRef))
    return {
      groupeId: organe,
      pour: pour.length, contre: contre.length, abstention: abst.length, nonVotants: nonV.length,
      votes: { pour, contre, abstention: abst, nonVotants: nonV }
    }
  })

  const totaux = ventilation.reduce((acc, v) => ({
    pour: acc.pour + v.pour, contre: acc.contre + v.contre,
    abstention: acc.abstention + v.abstention, nonVotants: acc.nonVotants + v.nonVotants
  }), { pour: 0, contre: 0, abstention: 0, nonVotants: 0 })

  // Écrit le détail scrutin par scrutin (lazy-load côté front)
  fs.writeFileSync(
    path.join(VOTES_DIR, `${numero}.json`),
    JSON.stringify({ numero, date, titre, sort, ventilation }, null, 0)
  )

  indexEntries.push({ numero, date, titre, sort, ...totaux })
}

// Tri du plus récent au plus ancien
indexEntries.sort((a, b) => (b.date || '').localeCompare(a.date || ''))

const index = {
  legislature: legis,
  generatedAt: new Date().toISOString(),
  source: 'data.assemblee-nationale.fr',
  count: indexEntries.length,
  scrutins: indexEntries
}

fs.writeFileSync(path.join(OUT_DIR, 'scrutins-index.json'), JSON.stringify(index, null, 2))

const totalVotesSize = fs.readdirSync(VOTES_DIR).reduce((acc, f) => acc + fs.statSync(path.join(VOTES_DIR, f)).size, 0)
console.log(`[scrutins] ✓ scrutins-index.json : ${indexEntries.length} scrutins, ${(fs.statSync(path.join(OUT_DIR, 'scrutins-index.json')).size / 1024).toFixed(0)} Ko`)
console.log(`[scrutins] ✓ votes/ : ${indexEntries.length} fichiers, ${(totalVotesSize / 1024 / 1024).toFixed(1)} Mo total`)
