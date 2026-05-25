import { useState, useEffect } from 'react'

// Lazy-loader JSON générique : fetch + cache mémoire + état loading/error.
const cache = new Map()

export function useJSON(path) {
  const [data, setData] = useState(() => cache.get(path) ?? null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(() => !cache.has(path))

  useEffect(() => {
    if (cache.has(path)) {
      setData(cache.get(path)); setLoading(false); return
    }
    let cancel = false
    setLoading(true); setError(null)
    fetch(path)
      .then(r => { if (!r.ok) throw new Error(`${r.status} ${path}`); return r.json() })
      .then(d => { if (cancel) return; cache.set(path, d); setData(d); setLoading(false) })
      .catch(e => { if (!cancel) { setError(e); setLoading(false) } })
    return () => { cancel = true }
  }, [path])

  return { data, error, loading }
}

export const useDeputes  = () => useJSON('/data/deputes.json')
export const useScrutins = () => useJSON('/data/scrutins-index.json')
export const useVote     = (scrutinId) => useJSON(`/data/votes/${scrutinId}.json`)
