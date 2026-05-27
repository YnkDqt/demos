// Moteur d'analyse des résultats du Match (V2 — paliers bipolaires).

import { resolveTheme } from './themeResolver.js'
import { THEMES } from './constants.js'
import { SKIP, PALIER_BY_VALUE } from './paliers.js'

// ─── Profil par thème ──────────────────────────────────────────
// Score thème = max |adhésion| moyenne par question. Mesure l'**intensité**
// des positions prises, dans un sens ou dans l'autre.
// Position dominante = position avec la plus forte adhésion absolue.
export function analyseParTheme(propos, reponses) {
  if (!propos) return []
  const buckets = new Map()

  for (const q of propos.questions) {
    const themeId = resolveTheme(q)
    if (!themeId) continue
    const r = reponses[q.id] || {}
    let bestAbs = 0, bestP = null, bestVal = 0
    for (const p of q.positions) {
      const v = r[p.id]
      if (v === SKIP || v === undefined) continue
      const abs = Math.abs(v)
      if (abs > bestAbs) { bestAbs = abs; bestP = p; bestVal = v }
    }
    if (bestAbs === 0) continue
    if (!buckets.has(themeId)) buckets.set(themeId, { sumMax: 0, n: 0, best: null })
    const b = buckets.get(themeId)
    b.sumMax += bestAbs
    b.n++
    if (!b.best || bestAbs > Math.abs(b.best.val)) {
      b.best = { val: bestVal, posLabel: bestP.label, qTitre: q.titre }
    }
  }

  return THEMES
    .filter(t => buckets.has(t.id))
    .map(t => {
      const b = buckets.get(t.id)
      const palier = PALIER_BY_VALUE[b.best.val]
      return {
        themeId: t.id,
        label: t.label,
        emoji: t.emoji,
        score: Math.round(b.sumMax / b.n),
        dominante: {
          posLabel: b.best.posLabel,
          qTitre: b.best.qTitre,
          val: b.best.val,
          palierLabel: palier?.label || ''
        },
        nbQuestions: b.n
      }
    })
    .sort((a, b) => b.score - a.score)
}

// ─── Top positions ─────────────────────────────────────────────
// Inclut maintenant les "Très opposé" (signaux d'opposition forts).
export function topPositions(propos, reponses, n = 5) {
  if (!propos) return []
  const all = []
  for (const q of propos.questions) {
    const r = reponses[q.id] || {}
    for (const p of q.positions) {
      const v = r[p.id]
      if (v === SKIP || v === undefined) continue
      if (Math.abs(v) >= 100) {
        all.push({
          qId: q.id, qEmoji: q.emoji, qTitre: q.titre,
          posLabel: p.label, posId: p.id,
          val: v,
          palierLabel: PALIER_BY_VALUE[v]?.label || ''
        })
      }
    }
  }
  return all.sort((a, b) => Math.abs(b.val) - Math.abs(a.val)).slice(0, n)
}

// ─── Données Radar ─────────────────────────────────────────────
// Pour chaque thème, on calcule "user" = intensité moyenne des positions
// (toujours 0..100, basée sur |val|). Et "parti" = couverture du parti sur
// les positions du thème (intensité moyenne |score|, où score > 0 uniquement).
export function radarData(propos, reponses, profilParti = null) {
  if (!propos) return []
  const userByTheme = {}
  for (const q of propos.questions) {
    const themeId = resolveTheme(q)
    if (!themeId) continue
    const r = reponses[q.id] || {}
    let maxAbs = 0
    for (const p of q.positions) {
      const v = r[p.id]
      if (v === SKIP || v === undefined) continue
      maxAbs = Math.max(maxAbs, Math.abs(v))
    }
    if (maxAbs === 0) continue
    if (!userByTheme[themeId]) userByTheme[themeId] = { sum: 0, n: 0 }
    userByTheme[themeId].sum += maxAbs
    userByTheme[themeId].n++
  }
  for (const k of Object.keys(userByTheme)) {
    userByTheme[k] = Math.round(userByTheme[k].sum / userByTheme[k].n)
  }

  let partiByTheme = null
  if (profilParti) {
    partiByTheme = {}
    for (const q of propos.questions) {
      const themeId = resolveTheme(q)
      if (!themeId) continue
      let sum = 0, n = 0
      for (const p of q.positions) {
        const sc = profilParti[p.id]
        if (sc === undefined) continue
        if (sc > 0) { sum += sc; n++ }
      }
      if (n > 0) partiByTheme[themeId] = Math.round(sum / n)
    }
  }

  return THEMES.map(t => {
    const row = { theme: t.label, themeShort: shortLabel(t.label), emoji: t.emoji, user: userByTheme[t.id] || 0 }
    if (partiByTheme) row.parti = partiByTheme[t.id] || 0
    return row
  })
}

const shortLabel = (full) => {
  const m = {
    'Logement & ville': 'Logement',
    'Travail & retraites': 'Travail',
    'Environnement & climat': 'Climat',
    'Sécurité & justice': 'Sécurité',
    'Santé & social': 'Santé',
    'Éducation & jeunesse': 'Éducation',
    'Économie & impôts': 'Économie',
    'International & immigration': 'International'
  }
  return m[full] || full
}

// ─── Désaccords avec un parti ──────────────────────────────────
// User adhère fortement (val >= 50), parti rejette (score <= -25). Et inverse :
// user rejette fortement (val <= -50), parti soutient (score >= 25).
export function desaccords(propos, reponses, profilParti, n = 5) {
  if (!propos || !profilParti) return []
  const list = []
  for (const q of propos.questions) {
    const r = reponses[q.id] || {}
    for (const p of q.positions) {
      const v = r[p.id]
      if (v === SKIP || v === undefined) continue
      const pa = profilParti[p.id]
      if (pa === undefined) continue
      if (v >= 50 && pa <= -25) {
        list.push({
          posLabel: p.label, qTitre: q.titre, qEmoji: q.emoji,
          user: v, parti: pa, sens: 'user-oui-parti-non',
          gap: Math.abs(v - pa)
        })
      } else if (v <= -50 && pa >= 25) {
        list.push({
          posLabel: p.label, qTitre: q.titre, qEmoji: q.emoji,
          user: v, parti: pa, sens: 'user-non-parti-oui',
          gap: Math.abs(v - pa)
        })
      }
    }
  }
  return list.sort((a, b) => b.gap - a.gap).slice(0, n)
}
