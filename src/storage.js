// Wrapper de persistance isolé.
//
// **IMPORTANT** : c'est le SEUL fichier qui touche directement localStorage.
// Le jour de la migration Supabase, on remplace les implémentations ci-dessous
// par des appels Supabase async, et le reste de l'app n'a rien à changer
// (toutes les méthodes sont déjà async).
//
// Convention de clés : namespace par feature, séparé par ':'
//   "match:current"       → Match en cours (auto-save)
//   "match:history:<id>"  → Un Match terminé
//   "match:history:index" → Liste des IDs des Matchs terminés
//
// Chaque payload stocké suit la forme : { version: N, savedAt: ISO, ...data }
// Pour qu'on puisse migrer les anciens enregistrements quand le schéma évoluera.

const PREFIX = 'demos:'

// ─── Backend localStorage (V1) ─────────────────────────────────
const lsAvailable = (() => {
  try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return true }
  catch { return false }
})()

const k = (key) => PREFIX + key

// ─── API publique ──────────────────────────────────────────────
// Toutes les méthodes sont async pour faciliter la migration Supabase.

export async function getItem(key) {
  if (!lsAvailable) return null
  try {
    const raw = localStorage.getItem(k(key))
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export async function setItem(key, value) {
  if (!lsAvailable) return false
  try {
    localStorage.setItem(k(key), JSON.stringify(value))
    return true
  } catch (e) {
    // QuotaExceededError ou autre
    console.warn('[storage] setItem failed', e)
    return false
  }
}

export async function removeItem(key) {
  if (!lsAvailable) return
  try { localStorage.removeItem(k(key)) } catch {}
}

// Liste les clés (sans le préfixe) qui matchent un pattern
export async function listKeys(pattern = '') {
  if (!lsAvailable) return []
  const out = []
  for (let i = 0; i < localStorage.length; i++) {
    const fullKey = localStorage.key(i)
    if (!fullKey?.startsWith(PREFIX)) continue
    const stripped = fullKey.slice(PREFIX.length)
    if (!pattern || stripped.startsWith(pattern)) out.push(stripped)
  }
  return out
}

// ─── Helpers spécifiques Match ─────────────────────────────────
const MATCH_VERSION = 1

export async function saveMatchCurrent({ reponses, ordre, idx, phase }) {
  return setItem('match:current', {
    version: MATCH_VERSION,
    savedAt: new Date().toISOString(),
    reponses, ordre, idx, phase
  })
}

export async function loadMatchCurrent() {
  const data = await getItem('match:current')
  if (!data || data.version !== MATCH_VERSION) return null
  return data
}

export async function clearMatchCurrent() {
  return removeItem('match:current')
}

// Génère un id court basé sur la date
const genId = () => {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

export async function saveMatchToHistory({ reponses, ordre, completedAt }) {
  const id = genId()
  const ok = await setItem(`match:history:${id}`, {
    version: MATCH_VERSION,
    id,
    completedAt: completedAt || new Date().toISOString(),
    reponses, ordre
  })
  if (!ok) return null

  // Maj de l'index
  const idx = (await getItem('match:history:index')) || { ids: [] }
  idx.ids = [id, ...idx.ids.filter(x => x !== id)]
  await setItem('match:history:index', idx)

  return id
}

export async function listMatchHistory() {
  const idx = await getItem('match:history:index')
  if (!idx?.ids) return []
  // On lit tous les Matchs (limite raisonnable : on n'attend pas des milliers d'items)
  const out = []
  for (const id of idx.ids) {
    const m = await getItem(`match:history:${id}`)
    if (m) out.push(m)
  }
  return out
}

export async function deleteMatchFromHistory(id) {
  await removeItem(`match:history:${id}`)
  const idx = (await getItem('match:history:index')) || { ids: [] }
  idx.ids = idx.ids.filter(x => x !== id)
  await setItem('match:history:index', idx)
}

export async function clearAllMatchData() {
  const keys = await listKeys('match:')
  for (const key of keys) await removeItem(key)
}
