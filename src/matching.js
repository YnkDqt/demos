// Moteur de matching V2 — vecteurs bipolaires.
//
// Le vecteur utilisateur : { positionId: -100..+100 } (palier V2).
// Le vecteur parti/député : { positionId: -100..+100 } (votes réels).
//
// Similarité cosinus sur l'intersection des positions exprimées.
// "Je passe" n'arrive jamais ici : on filtre en amont dans userVector.

import { SKIP } from './paliers.js'

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
