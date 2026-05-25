// Constantes globales partagées par toute l'app.

export const APP_VERSION = '0.1.0'

export const THEMES = [
  { id: 'logement', emoji: '🏠', label: 'Logement & ville' },
  { id: 'travail',  emoji: '💼', label: 'Travail & retraites' },
  { id: 'env',      emoji: '🌍', label: 'Environnement & climat' },
  { id: 'secu',     emoji: '🛡️', label: 'Sécurité & justice' },
  { id: 'sante',    emoji: '🏥', label: 'Santé & social' },
  { id: 'educ',     emoji: '🎓', label: 'Éducation & jeunesse' },
  { id: 'eco',      emoji: '💰', label: 'Économie & impôts' },
  { id: 'inter',    emoji: '🌐', label: 'International & immigration' }
]

export const THEMES_DEFAULT = ['logement', 'env', 'sante', 'eco']

export const NAVS = [
  { id: 'mon-coin',  label: 'Mon coin' },
  { id: 'mes-elus',  label: 'Mes élus' },
  { id: 'mon-match', label: 'Mon match' },
  { id: 'decrypter', label: 'Décrypter' },
  { id: 'mes-idees', label: 'Mes idées' },
  { id: 'reglages',  label: 'Réglages' }
]

// 3 états du détecteur de cohérence (Phase 3).
export const COHERENCE_STATES = {
  coherent:   { label: 'Cohérent',   color: 'green'  },
  incoherent: { label: 'Incohérent', color: 'red'    },
  nuance:     { label: 'Nuancé',     color: 'yellow' }
}
