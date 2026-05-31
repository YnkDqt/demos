import { useState, useEffect } from 'react'

const cache = new Map()

export function useJSON(path, { optional = false } = {}) {
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
      .then(r => {
        if (!r.ok) {
          if (optional && r.status === 404) return null
          throw new Error(`${r.status} ${path}`)
        }
        return r.json()
      })
      .then(d => { if (cancel) return; cache.set(path, d); setData(d); setLoading(false) })
      .catch(e => { if (!cancel) { setError(e); setLoading(false) } })
    return () => { cancel = true }
  }, [path, optional])

  return { data, error, loading }
}

export const useDeputes  = () => useJSON('/data/deputes.json')
export const useScrutins = () => useJSON('/data/scrutins-index.json')
export const useVote     = (scrutinId) => useJSON(`/data/votes/${scrutinId}.json`)
export const useVotesByDepute = () => useJSON('/data/votes-by-depute.json')
export const usePropositions = () => useJSON('/data/propositions-match.json')
export const useProfiles = () => useJSON('/data/party-profiles.json', { optional: true })
export const useAxesMapping = () => useJSON('/data/axes-mapping.json', { optional: true })
export const useMatchCourt = () => useJSON('/data/match-court.json', { optional: true })
export const usePartisInfo = () => useJSON('/data/partis-info.json', { optional: true })
export const usePartisElargis = () => useJSON('/data/partis-elargis.json', { optional: true })
