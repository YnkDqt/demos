// Utilitaires purs (pas de JSX, pas de hooks).

export const downloadJSON = (data, filename) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}

export const readJSONFile = (file) => new Promise((res, rej) => {
  const r = new FileReader()
  r.onload = e => { try { res(JSON.parse(e.target.result)) } catch (err) { rej(err) } }
  r.onerror = rej
  r.readAsText(file)
})

export const formatDate = (iso) => {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) }
  catch { return iso }
}

export const slugify = (s) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
