import React, { useMemo } from 'react'
import { PageTitle, Card, KPI, Empty, Spinner, ErrorBox } from '../atoms.jsx'
import { useDeputes, useScrutins } from '../hooks.js'
import { formatDate } from '../utils.js'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

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

  // Activité par mois sur les 12 derniers mois
  const activiteMensuelle = useMemo(() => {
    if (!S.data) return []
    const buckets = new Map()
    const now = new Date()
    // Init 12 mois en arrière
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      buckets.set(key, { mois: key, label: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }), scrutins: 0 })
    }
    for (const s of S.data.scrutins) {
      if (!s.date) continue
      const key = s.date.slice(0, 7) // YYYY-MM
      if (buckets.has(key)) buckets.get(key).scrutins++
    }
    return [...buckets.values()]
  }, [S.data])

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

          <Card C={C} style={{ marginBottom: 24 }}>
            <div style={{ marginBottom: 12 }}>
              <h3 style={{ marginBottom: 2 }}>Activité parlementaire</h3>
              <div style={{ fontSize: 13, color: C.muted }}>Nombre de scrutins par mois sur les 12 derniers mois</div>
            </div>
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <AreaChart data={activiteMensuelle} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={C.primary} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={C.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" stroke={C.muted} fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke={C.muted} fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13 }}
                    labelStyle={{ color: C.text, fontWeight: 500 }}
                    itemStyle={{ color: C.primary }}
                    formatter={(v) => [`${v} scrutins`, '']}
                    labelFormatter={(l) => l}
                  />
                  <Area type="monotone" dataKey="scrutins" stroke={C.primary} strokeWidth={2} fill="url(#grad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

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
