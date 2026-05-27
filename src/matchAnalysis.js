// Moteur d'analyse des résultats du Match.
// Pur (pas de React, pas de hooks) — facile à tester.

import { resolveTheme } from './themeResolver.js'
import { THEMES } from './constants.js'

const THEME_LABEL = Object.fromEntries(THEMES.map(t => [t.id, t]))

// ─── Profil par thème ──────────────────────────────────────────
// Pour chaque thème, on agrège les adhésions de l'utilisateur sur les positions
// des questions appartenant à ce thème.
//
// Score thème = moyenne des max d'adhésion par question.
// Position dominante = position avec l'adhésion la plus haute, toutes questions
// du thème confondues.
//
// Retour : [ { themeId, label, emoji, score, dominante: { positionLabel, adhesion, qTitre }, nbQuestions } ]
export function analyseParTheme(propos, reponses) {
  if (!propos) return []
  const buckets = new Map() // themeId → { sumMax, n, best: {adhesion, posLabel, qTitre} }

  for (const q of propos.questions) {
    const themeId = resolveTheme(q)
    if (!themeId) continue
    const r = reponses[q.id] || {}
    const adhesions = q.positions.map(p => ({ p, a: r[p.id] || 0 }))
    const maxOnQ = adhesions.reduce((m, x) => x.a > m.a ? x : m, { a: 0, p: null })
    if (maxOnQ.a === 0) continue // question ignorée
    if (!buckets.has(themeId)) buckets.set(themeId, { sumMax: 0, n: 0, best: null })
    const b = buckets.get(themeId)
    b.sumMax += maxOnQ.a
    b.n++
    if (!b.best || maxOnQ.a > b.best.adhesion) {
      b.best = { adhesion: maxOnQ.a, posLabel: maxOnQ.p.label, qTitre: q.titre }
    }
  }

  return THEMES
    .filter(t => buckets.has(t.id))
    .map(t => {
      const b = buckets.get(t.id)
      return {
        themeId: t.id,
        label: t.label,
        emoji: t.emoji,
        score: Math.round(b.sumMax / b.n),
        dominante: b.best,
        nbQuestions: b.n
      }
    })
    .sort((a, b) => b.score - a.score)
}

// ─── Top positions ─────────────────────────────────────────────
// Les N positions avec l'adhésion la plus forte, toutes questions confondues.
export function topPositions(propos, reponses, n = 5) {
  if (!propos) return []
  const all = []
  for (const q of propos.questions) {
    const r = reponses[q.id] || {}
    for (const p of q.positions) {
      const a = r[p.id] || 0
      if (a >= 75) all.push({ qId: q.id, qEmoji: q.emoji, qTitre: q.titre, posLabel: p.label, posId: p.id, adhesion: a })
    }
  }
  return all.sort((a, b) => b.adhesion - a.adhesion).slice(0, n)
}

// ─── Données pour Radar Recharts ───────────────────────────────
// Format : [{ theme: "Écologie", user: 75, parti?: 60 }, ...]
// Toujours 8 thèmes (même si user n'a pas répondu), score 0 si pas de réponse.
export function radarData(propos, reponses, profilParti = null, profilePositionsMap = null) {
  if (!propos) return []
  // Profil user par thème (déjà calculé via analyseParTheme, mais on refait léger ici pour avoir tous les 8)
  const userByTheme = {}
  for (const q of propos.questions) {
    const themeId = resolveTheme(q)
    if (!themeId) continue
    const r = reponses[q.id] || {}
    const maxA = q.positions.reduce((m, p) => Math.max(m, r[p.id] || 0), 0)
    if (maxA === 0) continue // question ignorée
    if (!userByTheme[themeId]) userByTheme[themeId] = { sum: 0, n: 0 }
    userByTheme[themeId].sum += maxA
    userByTheme[themeId].n++
  }
  for (const k of Object.keys(userByTheme)) {
    userByTheme[k] = Math.round(userByTheme[k].sum / userByTheme[k].n)
  }

  // Profil parti par thème (si fourni)
  // profilParti = { positionId: -100..+100 }
  // On agrège : pour chaque thème, on prend les positions des questions du thème
  // qui sont dans le profil du parti, et on calcule la moyenne des |scores|
  // (intensité de positionnement du parti sur ce thème).
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
        // Le parti vote globalement positif (Pour) sur cette position → on l'ajoute, sinon ignoré
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

// Labels courts pour les axes du radar (sinon ça déborde)
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
// Pour le parti donné, on cherche les positions où user adhère >= 75%
// mais où le parti vote contre (score < -25), et inversement.
// Retour : [{ posLabel, qTitre, qEmoji, user, parti, sens: 'user-oui-parti-non'|'user-non-parti-oui' }]
export function desaccords(propos, reponses, profilParti, n = 5) {
  if (!propos || !profilParti) return []
  const list = []
  for (const q of propos.questions) {
    const r = reponses[q.id] || {}
    for (const p of q.positions) {
      const u = r[p.id] || 0
      const pa = profilParti[p.id]
      if (pa === undefined) continue
      // User adhère fortement, parti rejette
      if (u >= 75 && pa <= -25) {
        list.push({
          posLabel: p.label, qTitre: q.titre, qEmoji: q.emoji,
          user: u, parti: pa, sens: 'user-oui-parti-non',
          gap: u - (-pa)
        })
      }
      // User rejette (n'a pas répondu fortement), parti soutient fortement → moins parlant, on saute pour V1
    }
  }
  return list.sort((a, b) => b.gap - a.gap).slice(0, n)
}
