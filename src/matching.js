// Moteur de matching : compare le vecteur utilisateur (réponses Match)
// aux profils partis/députés calculés par scripts/build-party-profiles.js.
//
// Le vecteur utilisateur : { positionId: 0..100 } (palier d'adhésion).
// Le vecteur parti/député : { positionId: -100..+100 } (votes réels agrégés).
//
// On utilise une similarité cosinus, après projection des deux vecteurs sur
// l'espace commun des positions (intersection des clés).
//
// Important : on calcule sur les positions COUVERTES par le parti/député
// uniquement. Si un parti n'a aucun vote sur une position, elle ne compte ni
// pour lui ni contre lui — sinon on pénaliserait les petits partis.

const userVector = (reponses) => {
  // { questionId: { positionId: 0..100 } } → { positionId: 0..100 }
  const v = {}
  for (const r of Object.values(reponses || {})) {
    for (const [posId, palier] of Object.entries(r || {})) {
      if (palier > 0) v[posId] = palier
    }
  }
  return v
}

const cosine = (a, b) => {
  // Intersection des clés
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

// Convertit la similarité cosinus [-1..1] en score affichable [0..100]
const toPct = (sim) => Math.round(((sim + 1) / 2) * 100)

export const computeMatches = (reponses, profiles, deputes, opts = {}) => {
  if (!profiles || !reponses) return { partis: [], deputes: [], coverage: 0 }
  const u = userVector(reponses)
  const nbPositionsUser = Object.keys(u).length
  if (nbPositionsUser === 0) return { partis: [], deputes: [], coverage: 0 }

  // ─── Partis ────────────────────────────────────────────────
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

  // ─── Députés ───────────────────────────────────────────────
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
