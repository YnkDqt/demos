import React, { useState, useMemo, useRef } from 'react'
import { PageTitle, Card, Btn, Field, Empty, Spinner, ErrorBox, BadgeParti } from '../atoms.jsx'
import { useScrutins, usePropositions } from '../hooks.js'
import { useJSON } from '../hooks.js'
import { downloadJSON, readJSONFile, formatDate } from '../utils.js'

/**
 * Page admin (?admin=mapping) — outil de construction de match-mapping.json.
 *
 * Workflow :
 *   1. Importer le mapping existant (ou démarrer vide)
 *   2. Filtrer/parcourir les scrutins (recherche, fracture, déjà mappés ?)
 *   3. Pour chaque scrutin, choisir 1+ positions du Match avec poids
 *   4. Exporter le JSON → remplacer public/data/match-mapping.json
 *   5. npm run build:profiles
 */

const FRACTURE_OPTIONS = [
  { id: 'all',    label: 'Tous' },
  { id: 'frac',   label: 'Polarisés (30-70%)' },
  { id: 'strong', label: 'Très polarisés (40-60%)' }
]
const ETAT_OPTIONS = [
  { id: 'all',     label: 'Tous' },
  { id: 'mapped',  label: 'Déjà mappés' },
  { id: 'unmapped', label: 'À mapper' }
]

export default function PageAdminMapping({ C }) {
  const S = useScrutins()
  const P = usePropositions()
  const Existing = useJSON('/data/match-mapping.json', { optional: true })

  const [mapping, setMapping] = useState({ scrutins: {} })
  const [imported, setImported] = useState(false)
  const [q, setQ] = useState('')
  const [fracture, setFracture] = useState('frac')
  const [etat, setEtat] = useState('unmapped')
  const [editId, setEditId] = useState(null)
  const fileRef = useRef()

  // Charge le mapping existant la 1re fois qu'il arrive
  React.useEffect(() => {
    if (Existing.data && !imported) {
      const scrutins = Existing.data.scrutins || {}
      setMapping({ scrutins })
      setImported(true)
    }
  }, [Existing.data, imported])

  const loading = S.loading || P.loading
  const error = S.error || P.error

  // Index des positions du Match : positionId → { questionId, questionTitre, label, qEmoji }
  const positionsIdx = useMemo(() => {
    if (!P.data) return new Map()
    const m = new Map()
    for (const q of P.data.questions) {
      for (const p of q.positions) {
        m.set(p.id, { questionId: q.id, questionTitre: q.titre, qEmoji: q.emoji, label: p.label, theme: q.theme })
      }
    }
    return m
  }, [P.data])

  // Scrutins filtrés
  const filtered = useMemo(() => {
    if (!S.data) return []
    const qn = q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return S.data.scrutins.filter(s => {
      // Texte
      if (qn) {
        const norm = (s.titre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        if (!norm.includes(qn) && !String(s.numero).includes(qn)) return false
      }
      // Fracture
      if (fracture !== 'all') {
        const tot = (s.pour || 0) + (s.contre || 0)
        if (tot < 30) return false
        const ratio = s.pour / tot
        if (fracture === 'frac' && (ratio < 0.30 || ratio > 0.70)) return false
        if (fracture === 'strong' && (ratio < 0.40 || ratio > 0.60)) return false
      }
      // État
      const isMapped = !!mapping.scrutins[s.numero]
      if (etat === 'mapped' && !isMapped) return false
      if (etat === 'unmapped' && isMapped) return false
      return true
    }).slice(0, 200)
  }, [S.data, q, fracture, etat, mapping])

  const onImport = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    try {
      const d = await readJSONFile(f)
      setMapping({ scrutins: d.scrutins || {} })
      alert(`Importé : ${Object.keys(d.scrutins || {}).length} scrutins`)
    } catch (err) {
      alert('Fichier invalide : ' + err.message)
    }
    e.target.value = ''
  }

  const onExport = () => {
    const cleaned = {
      _doc: "Mapping scrutin → positions du Match. Édité via l'admin.",
      generatedAt: new Date().toISOString(),
      scrutins: mapping.scrutins
    }
    downloadJSON(cleaned, 'match-mapping.json')
  }

  const updateScrutin = (numero, data) => {
    setMapping(prev => ({
      ...prev,
      scrutins: { ...prev.scrutins, [numero]: data }
    }))
  }

  const removeScrutin = (numero) => {
    setMapping(prev => {
      const next = { ...prev.scrutins }
      delete next[numero]
      return { ...prev, scrutins: next }
    })
  }

  const nbMapped = Object.keys(mapping.scrutins).length

  if (loading) return (
    <div className="fadeUp">
      <Card C={C} style={{ textAlign: 'center', padding: 40 }}>
        <Spinner C={C} size={32} />
      </Card>
    </div>
  )
  if (error) return <div className="fadeUp"><ErrorBox C={C} message="Données manquantes." /></div>

  return (
    <div className="fadeUp">
      <PageTitle
        title="Admin — Mapping scrutins"
        subtitle={`Associe les scrutins de l'AN aux positions du Match. ${nbMapped} scrutin(s) mappé(s).`}
        right={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn variant="ghost" onClick={() => fileRef.current?.click()} C={C}>Importer JSON</Btn>
            <input ref={fileRef} type="file" accept="application/json" onChange={onImport} style={{ display: 'none' }} />
            <Btn variant="primary" onClick={onExport} C={C}>Exporter JSON</Btn>
          </div>
        }
        C={C}
      />

      <Card C={C} style={{ marginBottom: 16, background: C.yellowPale, borderColor: C.yellow }}>
        <div style={{ fontWeight: 500, color: C.yellow, marginBottom: 4 }}>⚠ Outil admin local</div>
        <div style={{ fontSize: 13, color: C.text }}>
          Cette page ne sauvegarde rien. Pense à <strong>Exporter JSON</strong> régulièrement et à remplacer <code>public/data/match-mapping.json</code> avant de relancer <code>npm run build:profiles</code>.
        </div>
      </Card>

      <Card C={C} style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <Field label="Recherche (titre ou n°)" C={C}>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Ex: retraites, 6899" />
          </Field>
          <Field label="Fracture" C={C}>
            <select value={fracture} onChange={e => setFracture(e.target.value)}>
              {FRACTURE_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="État" C={C}>
            <select value={etat} onChange={e => setEtat(e.target.value)}>
              {ETAT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ fontSize: 13, color: C.muted }}>
          {filtered.length} scrutin(s) affiché(s) {filtered.length === 200 && '(limité à 200, affine la recherche)'}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Empty title="Aucun scrutin" message="Modifie tes filtres." C={C} />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {filtered.map(s => (
            <ScrutinRow
              key={s.numero}
              s={s}
              mapping={mapping.scrutins[s.numero]}
              positionsIdx={positionsIdx}
              propos={P.data}
              isEditing={editId === s.numero}
              onEdit={() => setEditId(editId === s.numero ? null : s.numero)}
              onUpdate={data => updateScrutin(s.numero, data)}
              onRemove={() => { removeScrutin(s.numero); if (editId === s.numero) setEditId(null) }}
              C={C}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Ligne scrutin ─────────────────────────────────────────────
function ScrutinRow({ s, mapping, positionsIdx, propos, isEditing, onEdit, onUpdate, onRemove, C }) {
  const mappedPositions = mapping?.positions || []
  const tot = (s.pour || 0) + (s.contre || 0)
  const ratio = tot > 0 ? Math.round((s.pour / tot) * 100) : 0

  return (
    <Card C={C} padding={14} style={{ borderColor: mapping ? C.primary : C.border }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>
            N°{s.numero} · {formatDate(s.date)} · <span style={{ color: ratio > 70 || ratio < 30 ? C.muted : C.primary, fontWeight: 500 }}>Pour {ratio}%</span>
          </div>
          <div style={{ fontWeight: 500, fontSize: 14, lineHeight: 1.4, marginBottom: 6 }}>{s.titre}</div>
          {mappedPositions.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {mappedPositions.map((mp, i) => {
                const info = positionsIdx.get(mp.positionId)
                return (
                  <span key={i} className="badge"
                    style={{ background: C.primaryPale, color: C.primaryDeep, fontWeight: 500 }}>
                    {info ? `${info.qEmoji} ${info.label}` : mp.positionId} · poids {mp.poids}
                  </span>
                )
              })}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {mapping && <Btn variant="ghost" size="sm" onClick={onRemove} C={C}>Retirer</Btn>}
          <Btn variant={isEditing ? 'ghost' : 'primary'} size="sm" onClick={onEdit} C={C}>
            {isEditing ? 'Fermer' : (mapping ? 'Modifier' : 'Mapper')}
          </Btn>
        </div>
      </div>

      {isEditing && (
        <ScrutinEditor
          existing={mapping}
          propos={propos}
          onSave={data => { onUpdate(data); onEdit() }}
          C={C}
        />
      )}
    </Card>
  )
}

// ─── Éditeur (positions + poids + note) ────────────────────────
function ScrutinEditor({ existing, propos, onSave, C }) {
  const [positions, setPositions] = useState(existing?.positions || [])
  const [note, setNote] = useState(existing?.note || '')
  const [adding, setAdding] = useState(false)
  const [newPosId, setNewPosId] = useState('')
  const [newPoids, setNewPoids] = useState(1)

  const addPosition = () => {
    if (!newPosId) return
    if (positions.some(p => p.positionId === newPosId)) {
      alert('Position déjà ajoutée')
      return
    }
    setPositions([...positions, { positionId: newPosId, poids: parseFloat(newPoids) || 1 }])
    setNewPosId(''); setNewPoids(1); setAdding(false)
  }

  const updatePoids = (idx, val) => {
    setPositions(positions.map((p, i) => i === idx ? { ...p, poids: parseFloat(val) || 0 } : p))
  }

  const removePos = (idx) => {
    setPositions(positions.filter((_, i) => i !== idx))
  }

  const save = () => {
    if (positions.length === 0) {
      alert('Au moins une position requise')
      return
    }
    onSave({ positions, ...(note.trim() ? { note: note.trim() } : {}) })
  }

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
      <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 8 }}>Positions associées</div>

      {positions.length === 0 && (
        <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic', marginBottom: 10 }}>
          Aucune position. Ajoute-en au moins une.
        </div>
      )}

      {positions.map((p, idx) => {
        const info = propos?.questions
          .flatMap(q => q.positions.map(pos => ({ ...pos, qEmoji: q.emoji, qTitre: q.titre })))
          .find(pp => pp.id === p.positionId)
        return (
          <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200, fontSize: 13 }}>
              <div style={{ fontWeight: 500 }}>{info ? `${info.qEmoji} ${info.label}` : p.positionId}</div>
              {info && <div style={{ fontSize: 12, color: C.muted }}>{info.qTitre}</div>}
            </div>
            <input
              type="number" step="0.1" min="-1" max="1"
              value={p.poids}
              onChange={e => updatePoids(idx, e.target.value)}
              style={{ width: 80 }}
            />
            <Btn variant="ghost" size="sm" onClick={() => removePos(idx)} C={C}>×</Btn>
          </div>
        )
      })}

      {adding ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
          <select value={newPosId} onChange={e => setNewPosId(e.target.value)} style={{ flex: 1, minWidth: 200 }}>
            <option value="">— Choisir une position —</option>
            {propos?.questions.map(q => (
              <optgroup key={q.id} label={`${q.emoji} ${q.titre}`}>
                {q.positions.map(p => (
                  <option key={p.id} value={p.id} disabled={positions.some(pp => pp.positionId === p.id)}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <input
            type="number" step="0.1" min="-1" max="1"
            value={newPoids}
            onChange={e => setNewPoids(e.target.value)}
            style={{ width: 80 }}
            placeholder="poids"
          />
          <Btn variant="primary" size="sm" onClick={addPosition} C={C}>Ajouter</Btn>
          <Btn variant="ghost" size="sm" onClick={() => setAdding(false)} C={C}>Annuler</Btn>
        </div>
      ) : (
        <Btn variant="ghost" size="sm" onClick={() => setAdding(true)} C={C}>+ Ajouter une position</Btn>
      )}

      <Field label="Note éditoriale (optionnelle)" C={C}>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Ex: vote sur l'ensemble du PLF 2026, scrutin le plus emblématique de la position progressive."
          style={{ minHeight: 60 }}
        />
      </Field>

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <Btn variant="primary" size="sm" onClick={save} C={C}>Enregistrer</Btn>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: C.muted }}>
        <strong>Poids</strong> : positif (0 à 1) si "Pour" = adhère à la position. Négatif (-1 à 0) si "Pour" = s'oppose à la position. La plupart du temps : 1.
      </div>
    </div>
  )
}
