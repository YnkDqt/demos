import React, { useMemo, useState } from 'react'
import {
  PageTitle, Card, KPI, Btn, Avatar, BadgeParti, BadgeVote,
  Tabs, Spinner, ErrorBox, Empty, ProgressBar
} from '../atoms.jsx'
import { useDeputes, useScrutins, useVotesByDepute } from '../hooks.js'
import { formatDate } from '../utils.js'

export default function PageDeputeDetail({ deputeId, onBack, C }) {
  const D = useDeputes()
  const S = useScrutins()
  const V = useVotesByDepute()
  const [tab, setTab] = useState('activite')

  const loading = D.loading || S.loading || V.loading
  const error = D.error || S.error || V.error

  const depute = useMemo(() => {
    if (!D.data) return null
    return D.data.deputes.find(d => d.id === deputeId)
  }, [D.data, deputeId])

  const votes = useMemo(() => {
    if (!V.data) return null
    return V.data.byDepute[deputeId] || { pour: [], contre: [], abstention: [], nonVotants: [] }
  }, [V.data, deputeId])

  const stats = useMemo(() => {
    if (!votes || !S.data) return null
    const nbPour = votes.pour.length
    const nbContre = votes.contre.length
    const nbAbst = votes.abstention.length
    const nbNonV = votes.nonVotants.length
    const nbVotes = nbPour + nbContre + nbAbst
    const nbTotal = nbVotes + nbNonV
    const participation = nbTotal > 0 ? Math.round((nbVotes / nbTotal) * 100) : 0
    return { nbVotes, nbPour, nbContre, nbAbst, nbNonV, nbTotal, participation }
  }, [votes, S.data])

  const scrutinsMap = useMemo(() => {
    if (!S.data) return new Map()
    return new Map(S.data.scrutins.map(s => [s.numero, s]))
  }, [S.data])

  const recentVotes = useMemo(() => {
    if (!votes) return []
    const all = []
    for (const type of ['pour', 'contre', 'abstention', 'nonVotants']) {
      for (const num of votes[type]) all.push({ numero: num, vote: type })
    }
    return all.sort((a, b) => b.numero - a.numero).slice(0, 30)
  }, [votes])

  if (loading) return (
    <div className="fadeUp">
      <Card C={C} style={{ textAlign: 'center', padding: 40 }}>
        <Spinner C={C} size={32} />
        <div style={{ marginTop: 12, color: C.muted, fontSize: 14 }}>Chargement de la fiche…</div>
      </Card>
    </div>
  )

  if (error) return (
    <div className="fadeUp">
      <Btn variant="ghost" onClick={onBack} C={C} style={{ marginBottom: 16 }}>← Retour</Btn>
      <ErrorBox C={C} message="Index des votes introuvable. Lance `npm run build:index` en local." />
    </div>
  )

  if (!depute) return (
    <div className="fadeUp">
      <Btn variant="ghost" onClick={onBack} C={C} style={{ marginBottom: 16 }}>← Retour</Btn>
      <Empty title="Député introuvable" C={C} />
    </div>
  )

  const fullName = `${depute.prenom} ${depute.nom}`

  return (
    <div className="fadeUp">
      <Btn variant="ghost" onClick={onBack} C={C} style={{ marginBottom: 16 }}>← Retour à l'annuaire</Btn>

      <Card C={C} style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <Avatar name={fullName} C={C} size={72} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <h1 style={{ marginBottom: 6 }}>{fullName}</h1>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
              {depute.groupe?.code && <BadgeParti code={depute.groupe.code} C={C} />}
              {depute.groupe?.nom && <span style={{ fontSize: 13, color: C.muted }}>{depute.groupe.nom}</span>}
            </div>
            <div style={{ fontSize: 14, color: C.text, marginBottom: 2 }}>
              {depute.circo
                ? `${depute.circo.dept} · ${depute.circo.numero}${depute.circo.numero === '1' ? 'ère' : 'e'} circonscription`
                : 'Circonscription non renseignée'}
            </div>
            {depute.profession && (
              <div style={{ fontSize: 13, color: C.muted }}>{depute.profession}</div>
            )}
          </div>
          {depute.id && (
            <a href={`https://www2.assemblee-nationale.fr/deputes/fiche/OMC_${depute.id}`} target="_blank" rel="noopener noreferrer">
              <Btn variant="ghost" C={C}>Fiche officielle ↗</Btn>
            </a>
          )}
        </div>
      </Card>

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 20 }}>
          <KPI label="Votes exprimés" value={stats.nbVotes} hint={`sur ${stats.nbTotal} scrutins`} C={C} />
          <KPI label="Participation"  value={`${stats.participation}%`} hint="Présence aux votes" C={C} />
          <KPI label="Votes Pour"     value={stats.nbPour} C={C} />
          <KPI label="Votes Contre"   value={stats.nbContre} C={C} />
        </div>
      )}

      {stats && (
        <Card C={C} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Taux de participation aux scrutins publics</span>
            <span style={{ fontSize: 13, color: C.muted }}>{stats.participation}%</span>
          </div>
          <ProgressBar value={stats.participation} max={100} C={C} height={10} />
          <div style={{ marginTop: 10, fontSize: 12, color: C.muted }}>
            Calculé sur la base des {stats.nbTotal} scrutins où la position du député a été enregistrée
            (vote exprimé ou enregistré comme non-votant). Les absences hors scrutin ne sont pas comptées.
          </div>
        </Card>
      )}

      <Tabs
        items={[
          { id: 'activite',  label: `Activité (${stats?.nbVotes || 0})` },
          { id: 'themes',    label: 'Par thème' },
          { id: 'coherence', label: 'Cohérence' }
        ]}
        active={tab}
        onChange={setTab}
        C={C}
      />

      {tab === 'activite' && (
        <>
          {recentVotes.length === 0 ? (
            <Empty title="Aucun vote enregistré" C={C} />
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {recentVotes.map(rv => {
                const s = scrutinsMap.get(rv.numero)
                if (!s) return null
                return (
                  <Card C={C} key={rv.numero} padding={14}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>
                          N°{s.numero} · {formatDate(s.date)}
                        </div>
                        <div style={{ fontWeight: 500, lineHeight: 1.35, fontSize: 14 }}>{s.titre}</div>
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        <BadgeVote vote={rv.vote} C={C} />
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
          {recentVotes.length === 30 && (
            <div style={{ marginTop: 12, fontSize: 13, color: C.muted, textAlign: 'center' }}>
              30 derniers votes affichés sur {stats.nbVotes + stats.nbNonV} au total.
            </div>
          )}
        </>
      )}

      {tab === 'themes' && (
        <Empty
          title="Tagging par thème en préparation"
          message="Les votes seront classés selon les 8 thèmes (logement, climat, etc.) en Phase 6."
          C={C}
        />
      )}

      {tab === 'coherence' && (
        <Empty
          title="Détecteur de cohérence en préparation"
          message="Comparaison entre déclarations publiques sourcées et votes réels — Phase 3."
          C={C}
        />
      )}
    </div>
  )
}
