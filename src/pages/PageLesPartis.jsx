import React, { useMemo, useState } from 'react'
import { PageTitle, Card, Btn, Spinner, ErrorBox, BadgeParti } from '../atoms.jsx'
import { useProfiles, useJSON } from '../hooks.js'

const usePartisInfo = () => useJSON('/data/partis-info.json', { optional: true })

// Couleur indicative par famille (gauche→droite). Données neutres d'affichage.
const FAM_COLOR = {
  'gauche-radicale': '#C0392B',
  'gauche':          '#E67E22',
  'centre':          '#7F8C8D',
  'droite':          '#2E86C1',
  'droite-radicale': '#1A5276'
}

export default function PageLesPartis({ onSelectGroupe, C }) {
  const profiles = useProfiles()
  const info = usePartisInfo()
  const [openFam, setOpenFam] = useState(null)

  const groupes = useMemo(() => {
    if (!profiles.data?.partis || !info.data) return []
    const out = []
    for (const [code, p] of Object.entries(profiles.data.partis)) {
      const meta = info.data.groupes[code]
      if (!meta || meta.famille === null) continue // on masque les non-inscrits
      out.push({ code, nom: p.nom, nbDeputes: p.nbDeputes, ...meta })
    }
    return out.sort((a, b) => (a.hemicycle || 99) - (b.hemicycle || 99))
  }, [profiles.data, info.data])

  if (profiles.loading || info.loading) return <div style={{ padding: 40, textAlign: 'center' }}><Spinner C={C} /></div>
  if (!profiles.data || !info.data) return <ErrorBox C={C} message="Données des partis indisponibles. Lance le build des profils." />

  const familles = info.data.familles

  return (
    <div className="fadeUp">
      <PageTitle title="Les partis" subtitle="Les groupes de l'Assemblée nationale, classés de la gauche à la droite." C={C} />

      <div style={{ fontSize: 13, color: C.muted, marginBottom: 20, lineHeight: 1.5 }}>
        Les groupes sont rangés selon leur place dans l'hémicycle (gauche → droite). Les données sont factuelles
        (Assemblée nationale, vie-publique.fr). Les descriptions de familles politiques expliquent les grandes orientations,
        sans porter de jugement sur un groupe précis.
      </div>

      <div style={{ display: 'grid', gap: 12, marginBottom: 32 }}>
        {groupes.map(g => {
          const fam = familles[g.famille]
          const col = FAM_COLOR[g.famille] || C.primary
          const open = openFam === g.code
          return (
            <Card C={C} key={g.code} padding={16}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ width: 4, alignSelf: 'stretch', background: col, borderRadius: 4, minHeight: 40 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <BadgeParti code={g.code} color={col} C={C} />
                    <span style={{ fontWeight: 500 }}>{g.nomComplet || g.nom}</span>
                  </div>
                  <div style={{ fontSize: 13, color: C.muted, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span>{g.nbDeputes} députés</span>
                    <span>· {g.opposition === true ? 'Opposition' : g.opposition === false ? 'Majorité / soutien' : '—'}</span>
                    {g.fondation && <span>· depuis {g.fondation}</span>}
                    {g.europe && <span>· {g.europe}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn variant="ghost" size="sm" onClick={() => setOpenFam(open ? null : g.code)} C={C}>
                    {open ? 'Masquer' : 'Grandes idées'}
                  </Btn>
                  {onSelectGroupe && (
                    <Btn variant="ghost" size="sm" onClick={() => onSelectGroupe(g.code)} C={C}>Ses députés →</Btn>
                  )}
                </div>
              </div>

              {open && fam && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: col, marginBottom: 6 }}>
                    Classé : {fam.label}
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 10 }}>{fam.resume}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {fam.idees.map((idee, i) => (
                      <span key={i} className="badge" style={{ background: col + '18', color: col }}>{idee}</span>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 10, fontStyle: 'italic' }}>
                    Description de la famille « {fam.label} » en général, pas une analyse propre à {g.code}.
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
