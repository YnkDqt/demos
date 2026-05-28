// Moteur de matching V2 — vecteurs bipolaires.
//
// Le vecteur utilisateur : { positionId: -100..+100 } (palier V2).
// Le vecteur parti/député : { positionId: -100..+100 } (votes réels).
//
// Similarité cosinus sur l'intersection des positions exprimées.
// "Je passe" n'arrive jamais ici : on filtre en amont dans userVector.

import { SKIP } from './paliers.js'
import { resolveTheme } from './themeResolver.js'
import { THEMES } from './constants.js'

const THEME_BY_ID = Object.fromEntries(THEMES.map(t => [t.id, t]))

const userVector = (reponses) => {
  const v = {}
  for (const r of Object.values(reponses || {})) {
    for (const [posId, val] of Object.entries(r || {})) {
      if (val === SKIP) continue
      if (typeof val === 'number') v[posId] = val
    }
  }
  return v
}

const cosine = (a, b) => {
  let dot = 0, normA = 0, normB = 0
  for (const k of Object.keys(a)) {
    if (b[k] === undefined) continue
    dot   += a[k] * b[k]
    normA += a[k] * a[k]
    normB += b[k] * b[k]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

// Convertit [-1..+1] vers [0..100]
const toPct = (sim) => Math.round(((sim + 1) / 2) * 100)

export const computeMatches = (reponses, profiles, deputes, opts = {}) => {
  if (!profiles || !reponses) return { partis: [], deputes: [], coverage: 0 }
  const u = userVector(reponses)
  const nbPositionsUser = Object.keys(u).length
  if (nbPositionsUser === 0) return { partis: [], deputes: [], coverage: 0 }

  const partisList = Object.entries(profiles.partis || {})
    .map(([code, p]) => ({
      code,
      nom: p.nom,
      nbDeputes: p.nbDeputes,
      score: toPct(cosine(u, p.profil)),
      couverture: Object.keys(p.profil).filter(k => u[k] !== undefined).length
    }))
    .filter(p => p.couverture > 0)
    .sort((a, b) => b.score - a.score)

  const deputesIdx = deputes ? new Map(deputes.map(d => [d.id, d])) : new Map()
  const deputesList = Object.entries(profiles.deputes || {})
    .map(([id, dp]) => {
      const d = deputesIdx.get(id)
      return {
        id,
        nom:    d ? `${d.prenom} ${d.nom}` : id,
        groupe: d?.groupe?.code || null,
        circo:  d?.circo || null,
        score: toPct(cosine(u, dp.profil)),
        couverture: Object.keys(dp.profil).filter(k => u[k] !== undefined).length
      }
    })
    .filter(d => d.couverture >= (opts.minCouvertureDepute ?? 3))
    .sort((a, b) => b.score - a.score)

  return {
    partis: partisList.slice(0, opts.topPartis ?? 3),
    deputes: deputesList.slice(0, opts.topDeputes ?? 5),
    coverage: nbPositionsUser,
    nbScrutinsMappes: profiles.nbScrutinsMappes
  }
}

// ─── Accord par thème avec un parti ────────────────────────────
// Cosinus filtré sur les positions de CHAQUE thème (option D du handover).
// RÈGLE GRAVÉE : on ne juge pas le volume d'engagement, seulement la direction
// commune sur les positions où user ET parti se sont exprimés.
// data : propositions-match.json. profilParti : { positionId: -100..100 }.
// → [{ themeId, label, emoji, score 0..100, n }] trié par score desc.
export const matchByTheme = (reponses, profilParti, data) => {
  if (!reponses || !profilParti || !data) return []
  const u = userVector(reponses)
  const buckets = new Map() // themeId → { a:{}, b:{} }

  for (const q of data.questions) {
    const tid = resolveTheme(q)
    if (!tid) continue
    if (!buckets.has(tid)) buckets.set(tid, { a: {}, b: {} })
    const bk = buckets.get(tid)
    for (const p of q.positions) {
      const uv = u[p.id]
      const pv = profilParti[p.id]
      if (uv === undefined || pv === undefined) continue
      bk.a[p.id] = uv
      bk.b[p.id] = pv
    }
  }

  return [...buckets.entries()]
    .map(([themeId, bk]) => {
      const n = Object.keys(bk.a).length
      const def = THEME_BY_ID[themeId] || {}
      return { themeId, label: def.label || themeId, emoji: def.emoji || '', n, score: n > 0 ? toPct(cosine(bk.a, bk.b)) : null }
    })
    .filter(t => t.n > 0)
    .sort((a, b) => b.score - a.score)
}
