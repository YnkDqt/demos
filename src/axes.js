// src/axes.js
// Carte politique (option C du handover) — 5 axes idéologiques bipolaires.
//
// RÈGLE GRAVÉE : aucun parti/utilisateur n'est jugé sur son VOLUME d'engagement.
// Le score d'un axe = moyenne des positions de cet axe que l'utilisateur a notées,
// chaque note (-100..+100) orientée par le pôle de la position. Une position non
// notée ne compte pas. Un axe sans aucune position notée est "non renseigné".

// Les 5 axes. pole -1 = côté "gauche" du label, +1 = côté "droit".
export const AXES = [
  {
    id: 'etat-marche',
    neg: 'État',        pos: 'Marché',
    titre: 'Rôle de l\u2019État dans l\u2019économie',
    // phrases[zone] : 0=fort neg,1=léger neg,2=centre,3=léger pos,4=fort pos
    phrases: [
      'Tu veux un État qui intervient fortement et pilote l\u2019économie.',
      'Tu penches pour un État présent, qui encadre le marché.',
      'Tu cherches un équilibre entre intervention publique et marché.',
      'Tu penches pour un marché libre, avec un État plus en retrait.',
      'Tu veux un État resserré et un marché largement libre.'
    ]
  },
  {
    id: 'eco-prod',
    neg: 'Écologie',    pos: 'Productivité',
    titre: 'Environnement face à l\u2019activité économique',
    phrases: [
      'Tu fais de l\u2019écologie une priorité, quitte à contraindre l\u2019économie.',
      'Tu penches vers la protection de l\u2019environnement.',
      'Tu cherches un équilibre entre écologie et activité économique.',
      'Tu penches vers l\u2019activité économique et le progrès technique.',
      'Tu fais passer la production et la croissance avant la contrainte écologique.'
    ]
  },
  {
    id: 'ouv-souv',
    neg: 'Ouverture',   pos: 'Souveraineté',
    titre: 'Europe, frontières et international',
    phrases: [
      'Tu es résolument pour l\u2019ouverture (Europe, frontières, monde).',
      'Tu penches vers l\u2019ouverture et la coopération.',
      'Tu cherches un équilibre entre ouverture et souveraineté.',
      'Tu penches vers la souveraineté nationale.',
      'Tu fais de la souveraineté nationale une priorité forte.'
    ]
  },
  {
    id: 'aut-lib',
    neg: 'Autorité',    pos: 'Libertés',
    titre: 'Ordre et autorité face aux libertés',
    phrases: [
      'Tu privilégies nettement l\u2019ordre, l\u2019autorité et la fermeté.',
      'Tu penches vers l\u2019autorité et la sécurité.',
      'Tu cherches un équilibre entre autorité et libertés.',
      'Tu penches vers les libertés individuelles et les droits.',
      'Tu privilégies nettement les libertés individuelles et l\u2019\u00e9mancipation.'
    ]
  },
  {
    id: 'redist-merite',
    neg: 'Redistribution', pos: 'Mérite',
    titre: 'Solidarité face à l\u2019effort individuel',
    phrases: [
      'Tu privilégies fortement la redistribution et la solidarité.',
      'Tu penches vers la redistribution et la protection sociale.',
      'Tu cherches un équilibre entre solidarité et mérite.',
      'Tu penches vers la récompense de l\u2019effort individuel.',
      'Tu privilégies fortement le mérite et la responsabilité individuelle.'
    ]
  }
]

export const AXE_BY_ID = Object.fromEntries(AXES.map(a => [a.id, a]))

// Découpe un score -100..+100 en zone 0..4 pour choisir la phrase.
export function zoneOf(score) {
  if (score <= -60) return 0
  if (score <= -20) return 1
  if (score <   20) return 2
  if (score <   60) return 3
  return 4
}

// reponses : { [qId]: { [pId]: -100|-50|50|100|'skip' } }
// mapping   : { "qId/pId": { axe, pole } | null }
// → [{ id, neg, pos, titre, score (-100..100), n (positions notées), phrase, renseigne }]
export function carteAxes(data, reponses, mapping) {
  if (!data || !mapping) return AXES.map(a => ({ ...a, score: 0, n: 0, renseigne: false, phrase: null }))
  const acc = Object.fromEntries(AXES.map(a => [a.id, { sum: 0, n: 0 }]))

  for (const q of data.questions) {
    const r = reponses[q.id] || {}
    for (const p of q.positions) {
      const v = r[p.id]
      if (v == null || v === 'skip') continue
      const tag = mapping[`${q.id}/${p.id}`]
      if (!tag) continue
      const bucket = acc[tag.axe]
      if (!bucket) continue
      bucket.sum += v * tag.pole   // note orientée par le pôle
      bucket.n   += 1
    }
  }

  return AXES.map(a => {
    const { sum, n } = acc[a.id]
    const renseigne = n > 0
    const score = renseigne ? Math.round(sum / n) : 0
    return {
      id: a.id, neg: a.neg, pos: a.pos, titre: a.titre,
      score, n, renseigne,
      phrase: renseigne ? a.phrases[zoneOf(score)] : null
    }
  })
}

// Position d'un parti sur les 5 axes, à partir de son profil de votes.
// Même logique que carteAxes mais lit profilParti[positionId] au lieu des réponses utilisateur.
// → [{ id, score (-100..100), n, renseigne }]
export function partiAxes(profilParti, data, mapping) {
  if (!data || !mapping || !profilParti) return AXES.map(a => ({ id: a.id, score: 0, n: 0, renseigne: false }))
  const acc = Object.fromEntries(AXES.map(a => [a.id, { sum: 0, n: 0 }]))

  for (const q of data.questions) {
    for (const p of q.positions) {
      const v = profilParti[p.id]
      if (v == null) continue
      const tag = mapping[`${q.id}/${p.id}`]
      if (!tag) continue
      const bucket = acc[tag.axe]
      if (!bucket) continue
      bucket.sum += v * tag.pole
      bucket.n   += 1
    }
  }

  return AXES.map(a => {
    const { sum, n } = acc[a.id]
    const renseigne = n > 0
    return { id: a.id, score: renseigne ? Math.round(sum / n) : 0, n, renseigne }
  })
}
