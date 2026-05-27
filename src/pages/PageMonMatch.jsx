import React, { useState, useMemo } from 'react'
import { PageTitle, Card, Btn, Spinner, ErrorBox, ProgressBar, KPI, Avatar, BadgeParti, Empty } from '../atoms.jsx'
import { usePropositions, useProfiles, useDeputes } from '../hooks.js'
import { computeMatches } from '../matching.js'
import { analyseParTheme, topPositions, radarData, desaccords } from '../matchAnalysis.js'
import GlossText from '../GlossText.jsx'
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip, Legend
} from 'recharts'

const PALIERS = [0, 25, 50, 75, 100]

const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function PageMonMatch({ C }) {
  const { data, loading, error } = usePropositions()
  const profiles = useProfiles()
  const D = useDeputes()

  const [phase, setPhase]       = useState('intro')
  const [idx, setIdx]           = useState(0)
  const [reponses, setReponses] = useState({})
  const [enBrefOpen, setEnBrefOpen] = useState(false)
  const [ordre, setOrdre]       = useState([])

  // Recap : parti choisi pour la comparaison + mode inversion
  const [compareCode, setCompareCode] = useState(null) // code parti à superposer
  const [inversion, setInversion]     = useState(false) // remplace le profil user par celui du parti

  const startMatch = () => {
    if (!data) return
    setOrdre(shuffle(data.questions.map(q => q.id)))
    setIdx(0); setReponses({}); setEnBrefOpen(false); setPhase('questions')
    setCompareCode(null); setInversion(false)
    window.scrollTo({ top: 0 })
  }

  const restart = () => {
    setPhase('intro'); setIdx(0); setReponses({}); setOrdre([]); setEnBrefOpen(false)
    setCompareCode(null); setInversion(false)
    window.scrollTo({ top: 0 })
  }

  const questionsById = useMemo(
    () => data ? Object.fromEntries(data.questions.map(q => [q.id, q])) : {},
    [data]
  )
  const question = phase === 'questions' && ordre.length > 0 ? questionsById[ordre[idx]] : null
  const reponsesQuestion = question ? (reponses[question.id] || {}) : {}

  const setAdhesion = (positionId, palier) => {
    if (!question) return
    setReponses(prev => ({
      ...prev,
      [question.id]: { ...(prev[question.id] || {}), [positionId]: palier }
    }))
  }

  const next = () => {
    if (idx < ordre.length - 1) {
      setIdx(i => i + 1); setEnBrefOpen(false); window.scrollTo({ top: 0 })
    } else {
      setPhase('recap'); window.scrollTo({ top: 0 })
    }
  }
  const prev = () => {
    if (idx > 0) { setIdx(i => i - 1); setEnBrefOpen(false); window.scrollTo({ top: 0 }) }
  }

  const stats = useMemo(() => {
    if (phase !== 'recap' || !data) return null
    let total = 0, repondues = 0, ignorees = 0
    for (const q of data.questions) {
      total++
      const r = reponses[q.id] || {}
      Object.values(r).some(v => v > 0) ? repondues++ : ignorees++
    }
    return { total, repondues, ignorees }
  }, [phase, data, reponses])

  const matches = useMemo(() => {
    if (phase !== 'recap' || !profiles.data || !D.data) return null
    return computeMatches(reponses, profiles.data, D.data.deputes, { topPartis: 3, topDeputes: 5 })
  }, [phase, profiles.data, D.data, reponses])

  // Profil parti choisi pour comparaison/inversion
  const partiSelectionne = useMemo(() => {
    if (!compareCode || !profiles.data) return null
    return profiles.data.partis[compareCode] || null
  }, [compareCode, profiles.data])

  // Données radar : si inversion → user remplacé par parti
  const radarRows = useMemo(() => {
    if (phase !== 'recap' || !data) return []
    if (inversion && partiSelectionne) {
      // En inversion : on convertit le profil parti (-100..+100) en pseudo-réponses user
      // Adhésion fictive = max(0, score) sur chaque position
      const pseudoRep = {}
      for (const [posId, score] of Object.entries(partiSelectionne.profil)) {
        // Trouve la question de cette position
        for (const q of data.questions) {
          const p = q.positions.find(pp => pp.id === posId)
          if (p) {
            if (!pseudoRep[q.id]) pseudoRep[q.id] = {}
            pseudoRep[q.id][posId] = Math.max(0, score)
            break
          }
        }
      }
      return radarData(data, pseudoRep, null)
    }
    return radarData(data, reponses, partiSelectionne?.profil || null)
  }, [phase, data, reponses, partiSelectionne, inversion])

  const themes = useMemo(() => {
    if (phase !== 'recap' || !data) return []
    return analyseParTheme(data, reponses)
  }, [phase, data, reponses])

  const tops = useMemo(() => {
    if (phase !== 'recap' || !data) return []
    return topPositions(data, reponses, 5)
  }, [phase, data, reponses])

  const desacc = useMemo(() => {
    if (phase !== 'recap' || !matches?.partis?.length || !profiles.data) return []
    const top1 = matches.partis[0]
    const profilTop1 = profiles.data.partis[top1.code]?.profil
    if (!profilTop1) return []
    return desaccords(data, reponses, profilTop1, 5)
  }, [phase, matches, profiles.data, data, reponses])

  // ─── LOADING / ERROR ─────────────────────────────────────────
  if (loading) return (
    <div className="fadeUp">
      <Card C={C} style={{ textAlign: 'center', padding: 40 }}>
        <Spinner C={C} size={32} />
        <div style={{ marginTop: 12, color: C.muted, fontSize: 14 }}>Chargement des questions…</div>
      </Card>
    </div>
  )
  if (error) return (
    <div className="fadeUp">
      <ErrorBox C={C} message="Le fichier des questions est introuvable. Vérifie que public/data/propositions-match.json est bien présent." />
    </div>
  )
  if (!data) return null

  // ─── INTRO ───────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <div className="fadeUp">
        <PageTitle
          title="Mon match"
          subtitle="Trouve quels partis et députés te ressemblent vraiment."
          C={C}
        />
        <Card C={C} style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>Comment ça marche ?</h3>
          <p style={{ marginBottom: 12 }}>
            On va te poser <strong>{data.questions.length} questions</strong> sur les grands sujets politiques français : économie, écologie, sécurité, retraites, immigration, démocratie, etc.
          </p>
          <p style={{ marginBottom: 12 }}>
            Pour chaque question, tu as <strong>5 positions</strong> qui couvrent les principales sensibilités politiques. Tu indiques à quel point tu adhères à chacune, sur une échelle de <strong>0 à 100%</strong>. Tu peux trouver plusieurs positions valables — c'est même le but.
          </p>
          <p style={{ marginBottom: 12 }}>
            À la fin, tu auras un profil par thème, tes positions les plus fortes, et tes affinités avec les partis et députés <em>croisées avec leurs votes réels à l'Assemblée</em>.
          </p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8, fontSize: 13, color: C.muted, flexWrap: 'wrap' }}>
            <span>⏱ ~10 minutes</span>
            <span>·</span>
            <span>🔒 Aucune donnée n'est envoyée, tout reste sur ton appareil</span>
          </div>
        </Card>

        <Card C={C} style={{ marginBottom: 16, background: C.yellowPale, borderColor: C.yellow }}>
          <div style={{ fontWeight: 500, color: C.yellow, marginBottom: 4 }}>⚠️ Avant de commencer</div>
          <div style={{ fontSize: 14, color: C.text }}>
            Si tu fermes l'onglet, tes réponses sont perdues. Prévois de finir le test d'une traite.
          </div>
        </Card>

        <Btn variant="primary" size="lg" onClick={startMatch} C={C}>Commencer le Match →</Btn>
      </div>
    )
  }

  // ─── RECAP ───────────────────────────────────────────────────
  if (phase === 'recap') {
    const hasMatching   = matches && matches.partis.length > 0
    const matchingReady = profiles.data && (profiles.data.nbScrutinsMappes || 0) > 0
    const top1 = matches?.partis?.[0]

    return (
      <div className="fadeUp">
        <PageTitle
          title="Tes résultats"
          subtitle={matchingReady
            ? `Calculés à partir de ${profiles.data.nbScrutinsMappes} scrutins de référence.`
            : "Tes réponses sont enregistrées."}
          C={C}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
          <KPI label="Questions répondues" value={`${stats.repondues}/${stats.total}`} C={C} />
          <KPI label="Thèmes explorés"     value={themes.length} hint={`sur 8`} C={C} />
          <KPI label="Positions fortes"    value={tops.length} hint="adhésion ≥ 75%" C={C} />
        </div>

        {/* ─── RADAR ─────────────────────────────────────── */}
        <Card C={C} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
            <div>
              <h3 style={{ marginBottom: 2 }}>Ta carte politique</h3>
              <div style={{ fontSize: 13, color: C.muted }}>
                {inversion && partiSelectionne
                  ? `En train de voir : profil de ${partiSelectionne.nom}`
                  : `Score d'engagement sur chaque thème (0 = non répondu, 100 = adhésion maximale)`}
              </div>
            </div>
            {matchingReady && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={compareCode || ''}
                  onChange={e => { setCompareCode(e.target.value || null); if (!e.target.value) setInversion(false) }}
                  style={{ width: 'auto', minWidth: 160 }}
                >
                  <option value="">Comparer avec un parti…</option>
                  {Object.entries(profiles.data.partis)
                    .sort((a, b) => (b[1].nbDeputes || 0) - (a[1].nbDeputes || 0))
                    .map(([code, p]) => (
                      <option key={code} value={code}>{code} — {p.nom}</option>
                    ))}
                </select>
                {compareCode && (
                  <Btn variant={inversion ? 'primary' : 'ghost'} size="sm" onClick={() => setInversion(v => !v)} C={C}>
                    {inversion ? '← Mon profil' : 'Et si je votais comme eux ?'}
                  </Btn>
                )}
              </div>
            )}
          </div>

          <div style={{ width: '100%', height: 360 }}>
            <ResponsiveContainer>
              <RadarChart data={radarRows} margin={{ top: 20, right: 30, bottom: 10, left: 30 }}>
                <PolarGrid stroke={C.border} />
                <PolarAngleAxis dataKey="themeShort" tick={{ fill: C.muted, fontSize: 12 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fill: C.muted, fontSize: 10 }} stroke={C.border} />
                <Radar
                  name={inversion && partiSelectionne ? partiSelectionne.nom : 'Toi'}
                  dataKey="user"
                  stroke={C.primary}
                  fill={C.primary}
                  fillOpacity={0.35}
                />
                {partiSelectionne && !inversion && (
                  <Radar
                    name={partiSelectionne.nom}
                    dataKey="parti"
                    stroke={C.secondary}
                    fill={C.secondary}
                    fillOpacity={0.25}
                  />
                )}
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Tooltip
                  contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13 }}
                  formatter={(v, n) => [`${v}/100`, n]}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* ─── PROFIL PAR THÈME ──────────────────────────── */}
        {themes.length > 0 && (
          <>
            <h2 style={{ marginBottom: 12 }}>Tes positions par thème</h2>
            <div style={{ display: 'grid', gap: 10, marginBottom: 28 }}>
              {themes.map(t => (
                <Card C={C} key={t.themeId} padding={14}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 22 }}>{t.emoji}</div>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontWeight: 500 }}>{t.label}</div>
                      <div style={{ fontSize: 13, color: C.muted }}>
                        Position dominante : <strong style={{ color: C.text }}>{t.dominante.posLabel}</strong>
                      </div>
                    </div>
                    <div style={{ fontFamily: 'Fraunces, serif', fontSize: 22, fontWeight: 600, color: C.primary }}>
                      {t.score}/100
                    </div>
                  </div>
                  <ProgressBar value={t.score} max={100} C={C} height={6} />
                </Card>
              ))}
            </div>
          </>
        )}

        {/* ─── TOP PARTIS ────────────────────────────────── */}
        {hasMatching && (
          <>
            <h2 style={{ marginBottom: 12 }}>Tes partis les plus proches</h2>
            <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
              {matches.partis.map((p, i) => (
                <Card C={C} key={p.code} padding={16}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ fontFamily: 'Fraunces, serif', fontSize: 22, fontWeight: 600, color: C.muted, width: 28, textAlign: 'center' }}>#{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                        <BadgeParti code={p.code} C={C} />
                        <span style={{ fontWeight: 500 }}>{p.nom}</span>
                        <span style={{ fontSize: 12, color: C.muted }}>· {p.nbDeputes} députés</span>
                      </div>
                      <ProgressBar value={p.score} max={100} C={C} height={8} />
                    </div>
                    <div style={{ fontFamily: 'Fraunces, serif', fontSize: 28, fontWeight: 600, color: C.primary, minWidth: 70, textAlign: 'right' }}>
                      {p.score}%
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* ─── DÉSACCORDS AVEC TOP 1 ─────────────────── */}
            {desacc.length > 0 && top1 && (
              <Card C={C} style={{ marginBottom: 28, background: C.secondaryPale, borderColor: C.secondary }}>
                <div style={{ marginBottom: 8 }}>
                  <h3 style={{ marginBottom: 2 }}>Là où tu t'éloignes de {top1.nom}</h3>
                  <div style={{ fontSize: 13, color: C.muted }}>
                    Ces positions sont importantes pour toi, mais les députés de {top1.code} votent souvent contre.
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {desacc.map((d, i) => (
                    <div key={i} style={{
                      background: C.white, padding: '10px 12px', borderRadius: 8,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap'
                    }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ fontSize: 13, color: C.muted }}>{d.qEmoji} {d.qTitre}</div>
                        <div style={{ fontWeight: 500, fontSize: 14 }}>{d.posLabel}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                        <span className="badge" style={{ background: C.primaryPale, color: C.primaryDeep }}>Toi : {d.user}%</span>
                        <span className="badge" style={{ background: C.redPale, color: C.red }}>Eux : {d.parti}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <h2 style={{ marginBottom: 12 }}>Tes députés les plus proches</h2>
            <div style={{ display: 'grid', gap: 10, marginBottom: 28 }}>
              {matches.deputes.map((d, i) => (
                <Card C={C} key={d.id} padding={14}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 600, color: C.muted, width: 24, textAlign: 'center' }}>#{i + 1}</div>
                    <Avatar name={d.nom} C={C} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{d.nom}</div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
                        {d.groupe && <BadgeParti code={d.groupe} C={C} />}
                        {d.circo && <span style={{ fontSize: 12, color: C.muted }}>{d.circo.dept} · circo {d.circo.numero}</span>}
                      </div>
                    </div>
                    <div style={{ fontFamily: 'Fraunces, serif', fontSize: 22, fontWeight: 600, color: C.primary, minWidth: 60, textAlign: 'right' }}>
                      {d.score}%
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div style={{ fontSize: 12, color: C.muted, marginBottom: 24, fontStyle: 'italic' }}>
              Le score est une similarité entre tes positions et les votes réels des députés/partis à l'Assemblée nationale, sur {matches.nbScrutinsMappes} scrutins de référence. Il ne reflète pas une appartenance politique mais une proximité de positions.
            </div>
          </>
        )}

        {!matchingReady && (
          <Card C={C} style={{ marginBottom: 24, background: C.primaryPale, borderColor: C.primary }}>
            <div style={{ fontWeight: 500, color: C.primaryDeep, marginBottom: 4 }}>🚧 Affinités partis & députés en préparation</div>
            <div style={{ fontSize: 14, color: C.text }}>
              Le mapping des scrutins de référence est en cours. Reviens bientôt pour découvrir tes affinités.
            </div>
          </Card>
        )}

        {/* ─── TOP POSITIONS ─────────────────────────────── */}
        {tops.length > 0 && (
          <>
            <h2 style={{ marginBottom: 12 }}>Tes positions les plus fortes</h2>
            <div style={{ display: 'grid', gap: 8, marginBottom: 28 }}>
              {tops.map((t, i) => (
                <Card C={C} key={`${t.qId}-${t.posId}`} padding={12}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 18 }}>{t.qEmoji}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: C.muted }}>{t.qTitre}</div>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{t.posLabel}</div>
                    </div>
                    <span className="badge" style={{ background: C.primary, color: '#fff', fontWeight: 600 }}>
                      {t.adhesion}%
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* ─── DÉTAIL DES RÉPONSES (collapsible) ─────────── */}
        <details style={{ marginBottom: 24 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 500, fontSize: 15, marginBottom: 12, color: C.text }}>
            Voir toutes tes réponses, question par question
          </summary>
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            {data.questions.map(q => {
              const r = reponses[q.id] || {}
              const positions = q.positions
                .map(p => ({ ...p, adhesion: r[p.id] || 0 }))
                .filter(p => p.adhesion > 0)
                .sort((a, b) => b.adhesion - a.adhesion)
              return (
                <Card C={C} key={q.id} padding={14}>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>
                    {q.emoji} {q.titre}
                  </div>
                  {positions.length === 0 ? (
                    <div style={{ fontSize: 14, color: C.muted, fontStyle: 'italic' }}>Aucune position retenue.</div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                      {positions.map(p => (
                        <span key={p.id} className="badge"
                          style={{ background: C.primaryPale, color: C.primaryDeep, fontWeight: 500 }}>
                          {p.label} — {p.adhesion}%
                        </span>
                      ))}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        </details>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn variant="ghost" onClick={restart} C={C}>Refaire le Match</Btn>
        </div>
      </div>
    )
  }

  // ─── QUESTIONS ───────────────────────────────────────────────
  if (!question) return null
  const progressPct = Math.round(((idx + 1) / ordre.length) * 100)

  return (
    <div className="fadeUp">
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 13, color: C.muted }}>
          <span>Question {idx + 1} sur {ordre.length}</span>
          <span>{progressPct}%</span>
        </div>
        <ProgressBar value={idx + 1} max={ordre.length} C={C} height={6} />
      </div>

      <Card C={C} style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 500 }}>
          {question.emoji} {question.theme}
        </div>
        <h2 style={{ marginBottom: 12, lineHeight: 1.25 }}>{question.titre}</h2>
        <div style={{ fontSize: 15, lineHeight: 1.55 }}>
          <GlossText texte={question.question} glossaire={data.glossaire} C={C} />
        </div>

        {question.enBref && (
          <div style={{ marginTop: 16 }}>
            <button
              onClick={() => setEnBrefOpen(o => !o)}
              style={{
                background: 'none', border: `1px solid ${C.border}`, padding: '6px 12px',
                borderRadius: 8, color: C.text, fontSize: 13, fontWeight: 500,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6
              }}>
              <span>{enBrefOpen ? '▾' : '▸'}</span>
              <span>En bref — quelques chiffres pour situer</span>
            </button>
            {enBrefOpen && (
              <div className="fadeUp" style={{
                marginTop: 10, padding: 14, background: C.sand, borderRadius: 8,
                fontSize: 14, lineHeight: 1.55
              }}>
                <GlossText texte={question.enBref.texte} glossaire={data.glossaire} C={C} />
                <div style={{ marginTop: 8, fontSize: 12, color: C.muted, fontStyle: 'italic' }}>
                  Sources : {question.enBref.sources}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      <div style={{ marginBottom: 12, fontSize: 14, color: C.muted, textAlign: 'center' }}>
        Pour chaque position, indique à quel point tu y adhères. <strong style={{ color: C.text }}>Tu peux laisser à 0%</strong> si elle ne te parle pas du tout.
      </div>

      <div style={{ display: 'grid', gap: 10, marginBottom: 24 }}>
        {question.positions.map(p => {
          const adhesion = reponsesQuestion[p.id] || 0
          return (
            <Card C={C} key={p.id} padding={16}
              style={{ borderColor: adhesion > 0 ? C.primary : C.border, transition: 'border-color .15s' }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 15 }}>{p.label}</div>
                <div style={{ fontSize: 14, lineHeight: 1.5, color: C.text }}>
                  <GlossText texte={p.texte} glossaire={data.glossaire} C={C} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {PALIERS.map(palier => {
                  const active = adhesion === palier
                  return (
                    <button key={palier}
                      onClick={() => setAdhesion(p.id, palier)}
                      style={{
                        flex: '1 1 60px', minWidth: 56, padding: '8px 4px',
                        background: active ? C.primary : C.white,
                        color: active ? '#fff' : C.text,
                        border: `1px solid ${active ? C.primary : C.border}`,
                        borderRadius: 8, fontWeight: 600, fontSize: 14,
                        cursor: 'pointer', transition: 'all .12s'
                      }}>
                      {palier}%
                    </button>
                  )
                })}
              </div>
            </Card>
          )
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 40 }}>
        <Btn variant="ghost" onClick={prev} C={C} disabled={idx === 0}>← Précédent</Btn>
        <Btn variant="primary" onClick={next} C={C}>
          {idx < ordre.length - 1 ? 'Suivant →' : 'Terminer le Match ✓'}
        </Btn>
      </div>
    </div>
  )
}
