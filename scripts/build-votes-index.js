#!/usr/bin/env node
/**
 * build-votes-index.js
 *
 * Construit un index inversé : pour chaque député, la liste de ses votes
 * sur tous les scrutins de la légis. Lit public/data/votes/*.json
 * (produit par fetch-scrutins) et écrit public/data/votes-by-depute.json.
 *
 * Format de sortie :
 * {
 *   legislature: 17,
 *   generatedAt: "...",
 *   byDepute: {
 *     "PA722114": {
 *       pour:       [6899, 6898, ...],
 *       contre:     [6896, 6895, ...],
 *       abstention: [6893, ...],
 *       nonVotants: [6892, ...]
 *     },
 *     ...
 *   }
 * }
 *
 * Usage : node scripts/build-votes-index.js
 *         (à lancer après fetch:scrutins)
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const VOTES_DIR = path.join(ROOT, 'public', 'data', 'votes')
const OUT = path.join(ROOT, 'public', 'data', 'votes-by-depute.json')

if (!fs.existsSync(VOTES_DIR)) {
  console.error(`[index] ${VOTES_DIR} n'existe pas. Lance d'abord npm run fetch:scrutins.`)
  process.exit(1)
}

const files = fs.readdirSync(VOTES_DIR).filter(f => f.endsWith('.json'))
console.log(`[index] ${files.length} scrutins à indexer`)

const byDepute = new Map()
const ensure = (id) => {
  if (!byDepute.has(id)) byDepute.set(id, { pour: [], contre: [], abstention: [], nonVotants: [] })
  return byDepute.get(id)
}

let processed = 0
for (const f of files) {
  const numero = parseInt(path.basename(f, '.json'), 10)
  if (!numero) continue
  let data
  try { data = JSON.parse(fs.readFileSync(path.join(VOTES_DIR, f), 'utf8')) } catch { continue }
  for (const v of (data.ventilation || [])) {
    for (const type of ['pour', 'contre', 'abstention', 'nonVotants']) {
      for (const acteurId of (v.votes?.[type] || [])) {
        ensure(acteurId)[type].push(numero)
      }
    }
  }
  if (++processed % 1000 === 0) console.log(`[index]   ${processed}/${files.length}`)
}

for (const entry of byDepute.values()) {
  for (const type of ['pour', 'contre', 'abstention', 'nonVotants']) {
    entry[type].sort((a, b) => b - a)
  }
}

const out = {
  generatedAt: new Date().toISOString(),
  count: byDepute.size,
  byDepute: Object.fromEntries(byDepute)
}

fs.writeFileSync(OUT, JSON.stringify(out))
console.log(`[index] ✓ ${byDepute.size} députés indexés`)
console.log(`[index] Taille : ${(fs.statSync(OUT).size / 1024 / 1024).toFixed(1)} Mo`)
