// Wrapper de persistance isolé.
//
// IMPORTANT : c'est le SEUL fichier qui touche directement localStorage.
// Le jour de la migration Supabase, on remplace les implémentations
// ci-dessous par des appels Supabase async, et le reste de l'app n'a rien
// à changer (toutes les méthodes sont déjà async).
//
// Convention de clés : namespace par feature, séparé par ':'
//   "match:current"       → Match en cours (auto-save)
//   "match:history:<id>"  → Un Match terminé
//   "match:history:index" → Liste des IDs des Matchs terminés
//
// Chaque payload stocké suit la forme : { version: N, savedAt: ISO, ...data }
//
// Versions de schéma :
//   v1 : paliers 0/25/50/75/100 (Lot 4)
//   v2 : paliers -100/-50/50/100 + SKIP (Lot 5)
//
// Les anciennes versions restent lisibles : le caller (PageMonMatch) appelle
// migrateReponses(payload.reponses, payload.version) après load.

const PREFIX = 'demos:'

const lsAvailable = (() => {
  try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return true }
  catch { return false }
})()

const k = (key) => PREFIX + key

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
    console.warn('[storage] setItem failed', e)
    return false
  }
}

export async function removeItem(key) {
  if (!lsAvailable) return
  try { localStorage.removeItem(k(key)) } catch {}
}

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

// ─── Helpers Match ─────────────────────────────────────────────
const MATCH_VERSION = 2

export async function saveMatchCurrent({ reponses, ordre, idx, phase }) {
  return setItem('match:current', {
    version: MATCH_VERSION,
    savedAt: new Date().toISOString(),
    reponses, ordre, idx, phase
  })
}

// Retourne le payload BRUT (avec version), au caller de migrer s'il faut.
export async function loadMatchCurrent() {
  const data = await getItem('match:current')
  if (!data) return null
  return data
}

export async function clearMatchCurrent() {
  return removeItem('match:current')
}

// ─── Niveau 1 : visions ────────────────────────────────────────
export async function saveVisionPicks(picks) {
  return setItem('match:visions', { version: 1, savedAt: new Date().toISOString(), picks })
}
export async function loadVisionPicks() {
  const d = await getItem('match:visions')
  return Array.isArray(d?.picks) ? d.picks : []
}
export async function clearVisionPicks() {
  return removeItem('match:visions')
}

// ─── Niveau 2 : idées ──────────────────────────────────────────
export async function saveIdeePicks(picks) {
  return setItem('match:idees', { version: 1, savedAt: new Date().toISOString(), picks })
}
export async function loadIdeePicks() {
  const d = await getItem('match:idees')
  return Array.isArray(d?.picks) ? d.picks : []
}
export async function clearIdeePicks() {
  return removeItem('match:idees')
}

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

  const idx = (await getItem('match:history:index')) || { ids: [] }
  idx.ids = [id, ...idx.ids.filter(x => x !== id)]
  await setItem('match:history:index', idx)

  return id
}

export async function listMatchHistory() {
  const idx = await getItem('match:history:index')
  if (!idx?.ids) return []
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
