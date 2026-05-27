// Système de paliers V2 — 4 niveaux bipolaires + skip.
//
// Les valeurs numériques vont de -100 à +100, ce qui permet :
//   - Capturer l'opposition (impossible en V1 où 0 = "rien" ambigu)
//   - Faire un cosinus signé avec les vecteurs partis (déjà en -100..+100)
//
// "Je passe" / skip = position absente du dictionnaire de réponses, comptée
// nulle part dans les calculs.

export const PALIERS = [
  { value: -100, label: 'Très opposé',    short: 'Très opposé',    tone: 'redStrong' },
  { value:  -50, label: 'Opposé',         short: 'Opposé',         tone: 'red' },
  { value:   50, label: 'Favorable',      short: 'Favorable',      tone: 'green' },
  { value:  100, label: 'Très favorable', short: 'Très favorable', tone: 'greenStrong' }
]

export const PALIER_BY_VALUE = Object.fromEntries(PALIERS.map(p => [p.value, p]))
export const SKIP = 'skip' // valeur sentinelle dans le state (différent de absence)

// Couleurs des paliers (clés cohérentes avec C{})
export const PALIER_BG = (C, value, active) => {
  if (!active) return C.white
  if (value === -100) return C.red
  if (value === -50)  return C.redPale
  if (value ===  50)  return C.greenPale
  if (value ===  100) return C.green
  return C.primary
}
export const PALIER_FG = (C, value, active) => {
  if (!active) return C.text
  if (value === -100 || value === 100) return '#fff'
  if (value === -50)  return C.red
  if (value ===  50)  return C.green
  return '#fff'
}
export const PALIER_BORDER = (C, value, active) => {
  if (!active) return C.border
  if (value === -100) return C.red
  if (value === -50)  return C.red
  if (value ===  50)  return C.green
  if (value ===  100) return C.green
  return C.primary
}

// ─── Migration V1 → V2 ─────────────────────────────────────────
//
// V1 stockait 0/25/50/75/100 dans `reponses`. Conversion best-effort :
//   0   → absence (n'est pas migré)
//   25  → -50  (Opposé)
//   50  → skip (Sans avis)
//   75  →  50  (Favorable)
//   100 → 100  (Très favorable)
//
// On utilise `payload.version` pour décider. Si le payload du stockage est
// version 1 (ou absent), on migre. Sinon (version >= 2) on passe inchangé.
//
// Pour les Matchs nouvellement créés (jamais passés par storage), on
// accepte aussi les valeurs V2 telles quelles (PALIER_BY_VALUE ou SKIP).
const V1_TO_V2 = { 0: null, 25: -50, 50: SKIP, 75: 50, 100: 100 }

export const migrateReponses = (reponses, payloadVersion = 1) => {
  if (!reponses) return {}
  // V2 explicite → pas de migration, on nettoie juste les valeurs invalides
  if (payloadVersion >= 2) {
    const out = {}
    for (const [qId, r] of Object.entries(reponses)) {
      const cleaned = {}
      let touched = false
      for (const [posId, v] of Object.entries(r || {})) {
        if (v === SKIP || PALIER_BY_VALUE[v]) {
          cleaned[posId] = v; touched = true
        }
      }
      if (touched) out[qId] = cleaned
    }
    return out
  }
  // V1 → conversion via mapping
  const out = {}
  for (const [qId, r] of Object.entries(reponses)) {
    const migrated = {}
    let touched = false
    for (const [posId, v] of Object.entries(r || {})) {
      if (v === SKIP) { migrated[posId] = SKIP; touched = true; continue }
      if (typeof v === 'number' && V1_TO_V2[v] !== undefined) {
        const conv = V1_TO_V2[v]
        if (conv !== null) { migrated[posId] = conv; touched = true }
      }
    }
    if (touched) out[qId] = migrated
  }
  return out
}
