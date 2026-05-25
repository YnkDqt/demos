import React, { useMemo } from 'react'
import { PageTitle, Card, KPI, Empty, Spinner, ErrorBox } from '../atoms.jsx'
import { useDeputes, useScrutins } from '../hooks.js'
import { formatDate } from '../utils.js'

export default function PageMonCoin({ profile, C }) {
  const D = useDeputes()
  const S = useScrutins()

  const stats = useMemo(() => {
    if (!D.data || !S.data) return null
    const groupes = new Set(D.data.deputes.map(d => d.groupe?.id).filter(Boolean))
    const dernier = S.data.scrutins[0]
    return {
      nbDeputes: D.data.count,
      nbScrutins: S.data.count,
      nbGroupes: groupes.size,
      dernierScrutin: dernier?.date
    }
  }, [D.data, S.data])

  const recents = useMemo(() => (S.data?.scrutins || []).slice(0, 8), [S.data])

  const loading = D.loading || S.loading
  const error = D.error || S.error

  return (
    <div className="fadeUp">
      <PageTitle
        title={`Bonjour${profile.prenom ? ` ${profile.prenom}` : ''}.`}
        subtitle="Ton tableau de bord politique."
        C={C}
      />

      {loading && (
        <Card C={C} style={{ textAlign: 'center', padding: 40 }}>
          <Spinner C={C} size={32} />
          <div style={{ marginTop: 12, color: C.muted, fontSize: 14 }}>Chargement des données légis 17…</div>
        </Card>
      )}

      {error && <ErrorBox C={C} message={
        "Les données ne sont pas encore générées. Lance " +
        "`npm run fetch:all` en local pour les produire, puis re-déploie."
      }/>}

      {stats && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 16, marginBottom: 24
          }}>
            <KPI label="Députés actifs"      value={stats.nbDeputes}   hint="Légis 17" C={C} />
            <KPI label="Scrutins publics"    value={stats.nbScrutins}  hint="Depuis juillet 2024" C={C} />
            <KPI label="Groupes politiques"  value={stats.nbGroupes}   hint="À l'Assemblée" C={C} />
            <KPI label="Dernier scrutin"     value={formatDate(stats.dernierScrutin) || '—'} C={C} />
          </div>

          <h2 style={{ marginBottom: 12 }}>Derniers scrutins</h2>
          {recents.length === 0 ? (
            <Empty title="Aucun scrutin" C={C} />
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {recents.map(s => (
                <Card C={C} key={s.numero} padding={14}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>
                        N°{s.numero} · {formatDate(s.date)}
                      </div>
                      <div style={{ fontWeight: 500, lineHeight: 1.35 }}>{s.titre}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                      <span className="badge" style={{ background: C.greenPale, color: C.green, fontWeight: 600 }}>{s.pour} pour</span>
                      <span className="badge" style={{ background: C.redPale, color: C.red, fontWeight: 600 }}>{s.contre} contre</span>
                      {s.abstention > 0 && (
                        <span className="badge" style={{ background: C.yellowPale, color: C.yellow, fontWeight: 600 }}>{s.abstention} abst.</span>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
