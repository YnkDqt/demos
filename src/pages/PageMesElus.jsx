import React, { useMemo, useState } from 'react'
import { PageTitle, Card, Empty, Spinner, ErrorBox, Avatar, BadgeParti, Btn, Field } from '../atoms.jsx'
import { useDeputes } from '../hooks.js'

export default function PageMesElus({ onSelectDepute, initialGroupe, C }) {
  const { data, loading, error } = useDeputes()
  const [q, setQ] = useState('')
  const [groupe, setGroupe] = useState(initialGroupe || '')
  const [dept, setDept] = useState('')

  const groupes = useMemo(() => {
    if (!data) return []
    const m = new Map()
    for (const d of data.deputes) {
      if (d.groupe?.code) m.set(d.groupe.code, d.groupe.nom)
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [data])

  const depts = useMemo(() => {
    if (!data) return []
    const s = new Set()
    for (const d of data.deputes) if (d.circo?.dept) s.add(d.circo.dept)
    return [...s].sort()
  }, [data])

  const filtered = useMemo(() => {
    if (!data) return []
    const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const qn = norm(q)
    return data.deputes.filter(d => {
      if (qn && !norm(`${d.prenom} ${d.nom}`).includes(qn)) return false
      if (groupe && d.groupe?.code !== groupe) return false
      if (dept && d.circo?.dept !== dept) return false
      return true
    }).sort((a, b) => (a.nom || '').localeCompare(b.nom || ''))
  }, [data, q, groupe, dept])

  return (
    <div className="fadeUp">
      <PageTitle
        title="Mes élus"
        subtitle={data ? `${data.count} députés actifs · légis ${data.legislature}` : "Annuaire des députés"}
        C={C}
      />

      {loading && (
        <Card C={C} style={{ textAlign: 'center', padding: 40 }}>
          <Spinner C={C} size={32} />
          <div style={{ marginTop: 12, color: C.muted, fontSize: 14 }}>Chargement des députés…</div>
        </Card>
      )}

      {error && <ErrorBox C={C} message="Lance `npm run fetch:deputes` en local pour générer les données." />}

      {data && (
        <>
          <Card C={C} style={{ marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <Field label="Recherche" C={C}>
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Nom ou prénom" />
              </Field>
              <Field label="Groupe" C={C}>
                <select value={groupe} onChange={e => setGroupe(e.target.value)}>
                  <option value="">Tous</option>
                  {groupes.map(([code, nom]) => <option key={code} value={code}>{code} — {nom}</option>)}
                </select>
              </Field>
              <Field label="Département" C={C}>
                <select value={dept} onChange={e => setDept(e.target.value)}>
                  <option value="">Tous</option>
                  {depts.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <div style={{ fontSize: 13, color: C.muted }}>{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</div>
              {(q || groupe || dept) && (
                <Btn variant="link" onClick={() => { setQ(''); setGroupe(''); setDept('') }} C={C}>Effacer les filtres</Btn>
              )}
            </div>
          </Card>

          {filtered.length === 0 ? (
            <Empty title="Aucun député ne correspond" message="Modifie tes filtres." C={C} />
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 12
            }}>
              {filtered.slice(0, 200).map(d => (
                <div key={d.id} onClick={() => onSelectDepute(d.id)}
                  style={{ cursor: 'pointer', transition: 'transform .12s' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                  <Card C={C} padding={14}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <Avatar name={`${d.prenom} ${d.nom}`} C={C} size={40} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 500, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {d.prenom} {d.nom}
                        </div>
                        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                          {d.circo ? `${d.circo.dept} · circo ${d.circo.numero}` : '—'}
                        </div>
                      </div>
                    </div>
                    {d.groupe?.code && (
                      <div style={{ marginTop: 10 }}>
                        <BadgeParti code={d.groupe.code} C={C} />
                      </div>
                    )}
                  </Card>
                </div>
              ))}
            </div>
          )}
          {filtered.length > 200 && (
            <div style={{ marginTop: 16, color: C.muted, fontSize: 13, textAlign: 'center' }}>
              Affichage limité à 200. Affine ta recherche pour voir le reste.
            </div>
          )}
        </>
      )}
    </div>
  )
}
