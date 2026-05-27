// Résout le thème (parmi les 8 THEMES) d'une question du Match.
// Stratégie : essaie l'id direct, le label, puis fallback mots-clés.

import { THEMES } from './constants.js'

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

// Mots-clés par thème, par ordre de priorité.
const KW = {
  env:      ['environnement', 'climat', 'ecolog', 'energie', 'nucleaire', 'transition', 'biodiv', 'pesticid', 'pollu'],
  travail:  ['travail', 'retraite', 'emploi', 'salaire', 'chomage', 'syndicat', 'apprentis'],
  logement: ['logement', 'loyer', 'urbanisme', 'habitat', 'hlm', 'ville'],
  sante:    ['sante', 'hopital', 'soin', 'medic', 'dependance', 'autonomie', 'social'],
  secu:     ['securite', 'police', 'justice', 'prison', 'penal', 'terror', 'delit'],
  eco:      ['economie', 'impot', 'fiscal', 'budget', 'finances', 'tva', 'taxe', 'entreprise', 'commerce'],
  educ:     ['education', 'ecole', 'enseign', 'universite', 'jeunesse', 'sport', 'culture'],
  inter:    ['international', 'immigration', 'europ', 'asile', 'defense', 'armee', 'otan', 'diplomat']
}

const LABEL_TO_ID = Object.fromEntries(THEMES.map(t => [norm(t.label), t.id]))
const ID_SET = new Set(THEMES.map(t => t.id))

export const resolveTheme = (question) => {
  // 1. Essai direct : id technique du JSON match les ids THEMES
  const raw = norm(question.theme)
  if (ID_SET.has(raw)) return raw

  // 2. Essai par label complet ou partiel
  if (LABEL_TO_ID[raw]) return LABEL_TO_ID[raw]
  for (const [label, id] of Object.entries(LABEL_TO_ID)) {
    if (raw && (label.includes(raw) || raw.includes(label))) return id
  }

  // 3. Fallback mots-clés sur theme + titre
  const hay = `${norm(question.theme)} ${norm(question.titre)}`
  for (const [id, words] of Object.entries(KW)) {
    if (words.some(w => hay.includes(w))) return id
  }

  // 4. Rien trouvé
  return null
}
