import React, { useState, useMemo, useEffect, useRef } from 'react'
import { PageTitle, Card, Btn, Spinner, ErrorBox } from '../atoms.jsx'
import { usePropositions, useJSON } from '../hooks.js'
import { downloadJSON, readJSONFile } from '../utils.js'
import { AXES } from '../axes.js'

/**
 * Page admin (?admin=axes) — taggage des positions du Match sur les 5 axes.
 * Clé = "questionId/positionId" (les positionId ne sont pas uniques globalement).
 * Valeur = { axe, pole } | null (neutre).
 * Workflow : importer axes-mapping.json → tagger → exporter → remplacer le fichier.
 * Ne persiste rien : exporter avant de fermer.
 */

const POLES = (a) => ([
  { value: -1, label: a.neg },
  { value:  1, label: a.pos }
])

export default function PageAdminAxes({ C }) {
  const P = usePropositions()
  const Existing = useJSON('/data/axes-mapping.json', { optional: true })

  const [map, setMap] = useState({})
  const [imported, setImported] = useState(false)
  const [onlyTodo, setOnlyTodo] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    if (Existing.data && !imported) { setMap(Existing.data); setImported(true) }
  }, [Existing.data, imported])

  const rows = useMemo(() => {
    if (!P.data) return []
    return P.data.questions.map(q => ({
      qid: q.id, theme: q.theme, emoji: q.emoji, titre: q.titre,
      positions: q.positions.map(p => ({ key: `${q.id}/${p.id}`, label: p.label, texte: p.texte }))
    }))
  }, [P.data])

  const stats = useMemo(() => {
    const total = rows.reduce((s, r) => s + r.positions.length, 0)
    const tagged = Object.keys(map).length
    const oriented = Object.values(map).filter(Boolean).length
    return { total, tagged, oriented, neutre: tagged - oriented }
  }, [rows, map])

  const setTag = (key, val) => setMap(m => ({ ...m, [key]: val }))

  const onImport = async (e) => {
    const f = e.target.files?.[0]; if (!f) return
    try { const d = await readJSONFile(f); setMap(d || {}); setImported(true) }
    catch { alert('JSON invalide') }
    e.target.value = ''
  }

  if (P.loading) return <div style={{ padding: 40, textAlign: 'center' }}><Spinner C={C} /></div>
  if (P.error || !P.data) return <ErrorBox C={C} message="propositions-match.json introuvable." />

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 16px 80px' }}>
      <PageTitle title="Admin — Axes" subtitle="Taggage des positions sur les 5 axes idéologiques." C={C}
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <input ref={fileRef} type="file" accept="application/json" onChange={onImport} style={{ display: 'none' }} />
            <Btn variant="ghost" size="sm" onClick={() => fileRef.current?.click()} C={C}>Importer</Btn>
            <Btn size="sm" onClick={() => downloadJSON(map, 'axes-mapping.json')} C={C}>Exporter</Btn>
          </div>
        }
      />

      <Card C={C} style={{ marginBottom: 16, display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center', fontSize: 13 }}>
        <span><b>{stats.tagged}</b>/{stats.total} taggées</span>
        <span style={{ color: C.muted }}>{stats.oriented} orientées · {stats.neutre} neutres</span>
        <label style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={onlyTodo} onChange={e => setOnlyTodo(e.target.checked)} style={{ width: 'auto' }} />
          Masquer les positions déjà taggées
        </label>
      </Card>

      {rows.map(r => {
        const positions = onlyTodo ? r.positions.filter(p => !(p.key in map)) : r.positions
        if (positions.length === 0) return null
        return (
          <Card key={r.qid} C={C} style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>
              <span style={{ color: C.muted, fontSize: 12, textTransform: 'uppercase' }}>{r.theme}</span> — {r.titre}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {positions.map(p => {
                const cur = map[p.key] // {axe,pole} | null | undefined
                const isNeutre = p.key in map && cur === null
                const axeDef = cur ? AXES.find(a => a.id === cur.axe) : null
                return (
                  <div key={p.key} style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                    <div style={{ fontSize: 13, marginBottom: 6 }}>
                      <b>{p.label}</b> <span style={{ color: C.muted }}>— {p.texte}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <select
                        value={isNeutre ? '__neutre' : (cur?.axe || '')}
                        onChange={e => {
                          const v = e.target.value
                          if (v === '') setMap(m => { const n = { ...m }; delete n[p.key]; return n })
                          else if (v === '__neutre') setTag(p.key, null)
                          else setTag(p.key, { axe: v, pole: cur?.pole ?? -1 })
                        }}
                        style={{ width: 'auto', minWidth: 180 }}
                      >
                        <option value="">— non taggé —</option>
                        <option value="__neutre">Neutre (aucun axe)</option>
                        {AXES.map(a => <option key={a.id} value={a.id}>{a.neg} ↔ {a.pos}</option>)}
                      </select>
                      {axeDef && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          {POLES(axeDef).map(pl => (
                            <Btn key={pl.value}
                              variant={cur.pole === pl.value ? 'primary' : 'ghost'} size="sm"
                              onClick={() => setTag(p.key, { axe: cur.axe, pole: pl.value })} C={C}>
                              {pl.label}
                            </Btn>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
