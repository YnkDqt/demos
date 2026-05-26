#!/usr/bin/env node
/**
 * extract-shortlist.js
 *
 * Parcourt scrutins-index.json et en extrait jusqu'à 40 candidats
 * pour le Match (Phase 2).
 *
 * Critères :
 *   - Scrutins "structurants" (texte d'ensemble, motion, résolution) — pas les amendements de détail
 *   - Vraie fracture Pour/Contre (ratio entre 30/70 et 70/30)
 *   - Récents (18 derniers mois en priorité)
 *   - Diversité thématique (8 thèmes, max ~6 par thème)
 *
 * Sortie : public/data/shortlist-propositions.json (à valider humainement)
 *
 * Usage : node scripts/extract-shortlist.js
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const IN  = path.join(ROOT, 'public', 'data', 'scrutins-index.json')
const OUT = path.join(ROOT, 'public', 'data', 'shortlist-propositions.json')

if (!fs.existsSync(IN)) {
  console.error(`${IN} introuvable. Lance d'abord npm run fetch:scrutins.`)
  process.exit(1)
}

const data = JSON.parse(fs.readFileSync(IN, 'utf8'))
console.log(`[shortlist] ${data.scrutins.length} scrutins à analyser`)

// ─── Détection thème par mots-clés ─────────────────────────────
// Heuristique simple, à affiner. Ordre = priorité de match.
const THEMES_KW = [
  { id: 'env',      kw: ['climat', 'écolog', 'environnement', 'pesticide', 'énerg', 'nucléaire', 'biodivers', 'eau', 'pollu', 'recycl', 'agricol'] },
  { id: 'travail',  kw: ['retraite', 'travail', 'salaire', 'chômage', 'emploi', 'rsa', 'apprentis', 'syndic'] },
  { id: 'logement', kw: ['logement', 'loyer', 'airbnb', 'urbanisme', 'hlm', 'bail', 'habitat'] },
  { id: 'sante',    kw: ['santé', 'hôpital', 'médic', 'soin', 'dépendance', 'autonomie', 'sécurité sociale', 'sécu'] },
  { id: 'secu',     kw: ['sécurité', 'police', 'gendarmer', 'prison', 'pénal', 'terror', 'justice', 'magistrat', 'délit'] },
  { id: 'eco',      kw: ['fiscal', 'impôt', 'tax', 'budget', 'finances', 'entreprise', 'commerce', 'tva', 'plf'] },
  { id: 'educ',     kw: ['école', 'éducation', 'enseign', 'université', 'jeunesse', 'sport', 'culture'] },
  { id: 'inter',    kw: ['immigration', 'asile', 'union européenne', 'européen', 'défense', 'armée', 'otan', 'ukraine', 'gaza', 'diplomat'] }
]

const detectTheme = (titre) => {
  const t = (titre || '').toLowerCase()
  for (const th of THEMES_KW) {
    if (th.kw.some(k => t.includes(k))) return th.id
  }
  return 'autre'
}

// ─── Détection scrutins structurants ───────────────────────────
// On veut les votes sur "l'ensemble" d'un texte, pas les amendements.
const isStructurant = (s) => {
  const t = (s.titre || '').toLowerCase()
  if (/amendement/.test(t)) return false
  if (/sous-amendement/.test(t)) return false
  // Marqueurs positifs
  return (
    /ensemble du projet/.test(t) ||
    /ensemble de la proposition/.test(t) ||
    /motion (de censure|référendaire|de rejet)/.test(t) ||
    /question préalable/.test(t) ||
    /^projet de loi/.test(t) ||
    /^proposition de loi/.test(t) ||
    /^proposition de résolution/.test(t) ||
    /^résolution/.test(t)
  )
}

// ─── Fracture Pour/Contre ──────────────────────────────────────
const fracture = (s) => {
  const total = (s.pour || 0) + (s.contre || 0)
  if (total < 30) return null // peu de votants, ignoré
  const ratio = s.pour / total
  if (ratio < 0.30 || ratio > 0.85) return null // trop consensuel ou anti-consensuel
  return Math.abs(0.5 - ratio) // plus proche de 0.5 = plus polarisé
}

// ─── Score combiné ─────────────────────────────────────────────
// On veut récent + polarisé. Score = polarisation * récence.
const nowMs = Date.now()
const score = (s) => {
  const frac = fracture(s)
  if (frac === null) return 0
  const proximityToHalf = 1 - frac * 2 // 1 = exactement 50/50, 0 = unanimité
  const dateMs = s.date ? new Date(s.date).getTime() : 0
  const ageDays = (nowMs - dateMs) / (1000 * 60 * 60 * 24)
  const recencyBonus = Math.max(0, 1 - ageDays / 540) // 540j = 18 mois
  return proximityToHalf * 0.6 + recencyBonus * 0.4
}

// ─── Filtrage + scoring ────────────────────────────────────────
const candidats = data.scrutins
  .filter(isStructurant)
  .map(s => ({ ...s, theme: detectTheme(s.titre), score: score(s) }))
  .filter(s => s.score > 0)
  .sort((a, b) => b.score - a.score)

console.log(`[shortlist] ${candidats.length} candidats après filtrage`)

// Répartition par thème (debug)
const parTheme = {}
for (const c of candidats) parTheme[c.theme] = (parTheme[c.theme] || 0) + 1
console.log(`[shortlist] Répartition par thème (candidats) :`)
for (const [k, v] of Object.entries(parTheme).sort((a, b) => b[1] - a[1])) {
  console.log(`            ${k.padEnd(10)} ${v}`)
}

// ─── Diversité thématique : on prend top 6 par thème (sauf "autre") ──
const MAX_PAR_THEME = 6
const TARGET_TOTAL = 40
const picked = []
const countPerTheme = {}

for (const c of candidats) {
  const cur = countPerTheme[c.theme] || 0
  const cap = c.theme === 'autre' ? 4 : MAX_PAR_THEME
  if (cur >= cap) continue
  picked.push(c)
  countPerTheme[c.theme] = cur + 1
  if (picked.length >= TARGET_TOTAL) break
}

// Tri final par date desc
picked.sort((a, b) => (b.date || '').localeCompare(a.date || ''))

// ─── Sortie ────────────────────────────────────────────────────
const out = {
  generatedAt: new Date().toISOString(),
  count: picked.length,
  themeCounts: countPerTheme,
  shortlist: picked.map(s => ({
    numero: s.numero,
    date: s.date,
    titre: s.titre,
    theme: s.theme,
    sort: s.sort,
    pour: s.pour, contre: s.contre, abstention: s.abstention,
    score: Math.round(s.score * 100) / 100
  }))
}

fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
console.log(`\n[shortlist] ✓ ${picked.length} propositions écrites dans ${path.relative(ROOT, OUT)}`)
console.log(`[shortlist] Répartition retenue :`)
for (const [k, v] of Object.entries(countPerTheme).sort((a, b) => b[1] - a[1])) {
  console.log(`            ${k.padEnd(10)} ${v}`)
}
console.log(`\nProchaine étape : ouvre ${path.relative(ROOT, OUT)} et choisis-en 20.`)
