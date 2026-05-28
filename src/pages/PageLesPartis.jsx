import React, { useMemo, useState } from 'react'
import { PageTitle, Card, Btn, Spinner, ErrorBox, BadgeParti } from '../atoms.jsx'
import { useProfiles, useJSON } from '../hooks.js'

const usePartisInfo = () => useJSON('/data/partis-info.json', { optional: true })

const FAM_COLOR = {
  'gauche-radicale': '#C0392B',
  'gauche':          '#E67E22',
  'centre':          '#7F8C8D',
  'droite':          '#2E86C1',
  'droite-radicale': '#1A5276'
}

// Secteur d'anneau en demi-cercle. a0/a1 en radians (π = gauche, 0 = droite).
function arcSector(cx, cy, rInt, rExt, a0, a1) {
  const p = (r, a) => [cx + r * Math.cos(a), cy - r * Math.sin(a)]
  const [x0o, y0o] = p(rExt, a0)
  const [x1o, y1o] = p(rExt, a1)
  const [x1i, y1i] = p(rInt, a1)
  const [x0i, y0i] = p(rInt, a0)
  const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0
  return `M ${x0o} ${y0o} A ${rExt} ${rExt} 0 ${large} 1 ${x1o} ${y1o} L ${x1i} ${y1i} A ${rInt} ${rInt} 0 ${large} 0 ${x0i} ${y0i} Z`
}

export default function PageLesPartis({ onSelectGroupe, C }) {
  const profiles = useProfiles()
  const info = usePartisInfo()
  const [sel, setSel] = useState(null)

  const groupes = useMemo(() => {
    if (!profiles.data?.partis || !info.data) return []
    const out = []
    for (const [code, p] of Object.entries(profiles.data.partis)) {
      const meta = info.data.groupes[code]
      if (!meta || meta.famille === null) continue
      out.push({ code, nom: p.nom, nbDeputes: p.nbDeputes || 0, ...meta })
    }
    return out.sort((a, b) => (a.hemicycle || 99) - (b.hemicycle || 99))
  }, [profiles.data, info.data])

  const sectors = useMemo(() => {
    const total = groupes.reduce((s, g) => s + g.nbDeputes, 0)
    if (!total) return []
    let a = Math.PI
    return groupes.map(g => {
      const span = (g.nbDeputes / total) * Math.PI
      const seg = { ...g, a0: a, a1: a - span }
      a -= span
      return seg
    })
  }, [groupes])

  if (profiles.loading || info.loading) return <div style={{ padding: 40, textAlign: 'center' }}><Spinner C={C} /></div>
  if (!profiles.data || !info.data) return <ErrorBox C={C} message="Données des partis indisponibles. Lance le build des profils." />

  const familles = info.data.familles
  const W = 720, H = 380, cx = W / 2, cy = 330, rExt = 300, rInt = 130
  const total = groupes.reduce((s, g) => s + g.nbDeputes, 0)
  const selG = sel ? groupes.find(g => g.code === sel) : null
  const selFam = selG ? familles[selG.famille] : null

  return (
    <div className="fadeUp">
      <PageTitle title="Les partis" subtitle="L'Assemblée nationale, groupe par groupe, de la gauche à la droite." C={C} />

      <Card C={C} style={{ marginBottom: 16, textAlign: 'center' }}>
        <div style={{ width: '100%', maxWidth: W, margin: '0 auto' }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            {sectors.map(s => {
              const col = FAM_COLOR[s.famille] || C.primary
              const active = sel === s.code
              const dim = sel && !active
              return (
                <path key={s.code} d={arcSector(cx, cy, rInt, rExt, s.a0, s.a1)}
                  fill={col} opacity={dim ? 0.3 : 1} stroke={C.white} strokeWidth={2}
                  style={{ cursor: 'pointer', transition: 'opacity .15s' }}
                  onClick={() => setSel(active ? null : s.code)}>
                  <title>{s.code} — {s.nbDeputes} députés</title>
                </path>
              )
            })}
            <text x={cx} y={cy - 55} textAnchor="middle" style={{ fontFamily: 'Fraunces, serif', fontSize: 34, fontWeight: 600, fill: C.text }}>{total}</text>
            <text x={cx} y={cy - 30} textAnchor="middle" style={{ fontSize: 13, fill: C.muted }}>députés (groupes)</text>
          </svg>
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
          Clique sur un groupe pour le détail. Largeur = nombre de députés.
        </div>
      </Card>

      {selG && selFam && (
        <Card C={C} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ width: 4, alignSelf: 'stretch', background: FAM_COLOR[selG.famille], borderRadius: 4, minHeight: 40 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                <BadgeParti code={selG.code} color={FAM_COLOR[selG.famille]} C={C} />
                <span style={{ fontWeight: 500 }}>{selG.nomComplet || selG.nom}</span>
              </div>
              <div style={{ fontSize: 13, color: C.muted, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <span>{selG.nbDeputes} députés</span>
                <span>· {selG.opposition === true ? 'Opposition' : selG.opposition === false ? 'Majorité / soutien' : '—'}</span>
                {selG.fondation && <span>· depuis {selG.fondation}</span>}
                {selG.europe && <span>· {selG.europe}</span>}
              </div>
            </div>
            {onSelectGroupe && <Btn variant="ghost" size="sm" onClick={() => onSelectGroupe(selG.code)} C={C}>Ses députés →</Btn>}
          </div>
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: FAM_COLOR[selG.famille], marginBottom: 6 }}>Classé : {selFam.label}</div>
            <div style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 10 }}>{selFam.resume}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {selFam.idees.map((idee, i) => (
                <span key={i} className="badge" style={{ background: FAM_COLOR[selG.famille] + '18', color: FAM_COLOR[selG.famille] }}>{idee}</span>
              ))}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 10, fontStyle: 'italic' }}>
              Description de la famille « {selFam.label} » en général, pas une analyse propre à {selG.code}.
            </div>
          </div>
        </Card>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {groupes.map(g => (
          <button key={g.code} onClick={() => setSel(sel === g.code ? null : g.code)} className="badge"
            style={{ background: sel === g.code ? FAM_COLOR[g.famille] : FAM_COLOR[g.famille] + '18',
              color: sel === g.code ? C.white : FAM_COLOR[g.famille], border: 'none', cursor: 'pointer', fontWeight: 600 }}>
            {g.code} · {g.nbDeputes}
          </button>
        ))}
      </div>
    </div>
  )
}
