import React, { useState, useMemo, useEffect, useRef } from 'react'
import { PageTitle, Card, Btn, Spinner, ErrorBox, ProgressBar, KPI, Avatar, BadgeParti, Empty, ConfirmDialog, Modal } from '../atoms.jsx'
import { usePropositions, useProfiles, useDeputes, useAxesMapping } from '../hooks.js'
import { carteAxes } from '../axes.js'
import { computeMatches, matchByTheme } from '../matching.js'
import { analyseParTheme, topPositions, radarData, partiBreakdown, intensiteLabel } from '../matchAnalysis.js'
import { PALIERS, PALIER_BY_VALUE, SKIP, PALIER_BG, PALIER_FG, PALIER_BORDER, migrateReponses } from '../paliers.js'
import GlossText from '../GlossText.jsx'
import {
  saveMatchCurrent, loadMatchCurrent, clearMatchCurrent,
  saveMatchToHistory, listMatchHistory, deleteMatchFromHistory
} from '../storage.js'
import { formatDate } from '../utils.js'
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip, Legend
} from 'recharts'

const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Liste de positions (accord ou désaccord) avec ton palier + l'intensité du parti.
function PositionList({ items, accord, C }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {items.map((it, i) => {
        const toi = PALIER_BY_VALUE[it.user]?.label || ''
        const eux = intensiteLabel(it.parti)
        return (
          <div key={i} style={{ background: C.white, padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 12, color: C.muted }}>{it.qEmoji} {it.qTitre}</div>
            <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>{it.posLabel}</div>
            <div style={{ display: 'flex', gap: 6, fontSize: 11, flexWrap: 'wrap' }}>
              <span className="badge" style={{ background: C.primaryPale, color: C.primaryDeep }}>Toi : {toi}</span>
              <span className="badge" style={{ background: accord ? C.greenPale : C.redPale, color: accord ? C.green : C.red }}>Eux : {eux.texte}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function PageMonMatch({ C }) {
  const { data, loading, error } = usePropositions()
  const profiles = useProfiles()
  const axesMap = useAxesMapping()
  const D = useDeputes()

  const [phase, setPhase]       = useState('intro')
  const [idx, setIdx]           = useState(0)
  const [reponses, setReponses] = useState({})
  const [enBrefOpen, setEnBrefOpen] = useState(false)
  const [ordre, setOrdre]       = useState([])

  const [compareCode, setCompareCode] = useState(null)
  const [inversion, setInversion]     = useState(false)
  const [openParti, setOpenParti]     = useState(null)

  const [hasResumable, setHasResumable] = useState(false)
  const [history, setHistory] = useState([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [confirmRestart, setConfirmRestart] = useState(false)
  const initialLoaded = useRef(false)
  const savedToHistory = useRef(false)

  useEffect(() => {
    (async () => {
      const cur = await loadMatchCurrent()
      if (cur && cur.phase === 'questions' && Array.isArray(cur.ordre) && cur.ordre.length > 0) {
        setHasResumable(true)
      }
      const h = await listMatchHistory()
      // Migration V1→V2 silencieuse sur l'historique
      setHistory(h.map(m => ({ ...m, reponses: migrateReponses(m.reponses, m.version || 1) })))
      initialLoaded.current = true
    })()
  }, [])

  useEffect(() => {
    if (!initialLoaded.current) return
    if (phase === 'questions') {
      saveMatchCurrent({ reponses, ordre, idx, phase })
    }
  }, [reponses, ordre, idx, phase])

  useEffect(() => {
    if (phase !== 'recap' || savedToHistory.current) return
    if (Object.keys(reponses).length === 0) return
    savedToHistory.current = true
    ;(async () => {
      await saveMatchToHistory({ reponses, ordre, completedAt: new Date().toISOString() })
      await clearMatchCurrent()
      const h = await listMatchHistory()
      setHistory(h.map(m => ({ ...m, reponses: migrateReponses(m.reponses, m.version || 1) })))
    })()
  }, [phase, reponses, ordre])

  const startMatch = () => {
    if (!data) return
    savedToHistory.current = false
    setOrdre(shuffle(data.questions.map(q => q.id)))
    setIdx(0); setReponses({}); setEnBrefOpen(false); setPhase('questions')
    setCompareCode(null); setInversion(false)
    setHasResumable(false)
    window.scrollTo({ top: 0 })
  }

  const resumeMatch = async () => {
    const cur = await loadMatchCurrent()
    if (!cur) { startMatch(); return }
    savedToHistory.current = false
    setReponses(migrateReponses(cur.reponses || {}, cur.version || 1))
    setOrdre(cur.ordre || [])
    setIdx(cur.idx || 0)
    setPhase(cur.phase || 'questions')
    setEnBrefOpen(false)
    setCompareCode(null); setInversion(false)
    setHasResumable(false)
    window.scrollTo({ top: 0 })
  }

  const restart = () => {
    setPhase('intro'); setIdx(0); setReponses({}); setOrdre([]); setEnBrefOpen(false)
    setCompareCode(null); setInversion(false)
    savedToHistory.current = false
    window.scrollTo({ top: 0 })
  }

  const restartAndClear = async () => {
    await clearMatchCurrent()
    setHasResumable(false)
    setConfirmRestart(false)
    startMatch()
  }

  const openHistoryItem = (m) => {
    savedToHistory.current = true
    setReponses(m.reponses || {})
    setOrdre(m.ordre || [])
    setIdx(0)
    setPhase('recap')
    setHistoryOpen(false)
    setCompareCode(null); setInversion(false)
    window.scrollTo({ top: 0 })
  }

  const removeFromHistory = async (id) => {
    await deleteMatchFromHistory(id)
    const h = await listMatchHistory()
    setHistory(h.map(m => ({ ...m, reponses: migrateReponses(m.reponses) })))
  }

  const questionsById = useMemo(
    () => data ? Object.fromEntries(data.questions.map(q => [q.id, q])) : {},
    [data]
  )
  const question = phase === 'questions' && ordre.length > 0 ? questionsById[ordre[idx]] : null
  const reponsesQuestion = question ? (reponses[question.id] || {}) : {}

  const setAdhesion = (positionId, value) => {
    if (!question) return
    setReponses(prev => ({
      ...prev,
      [question.id]: { ...(prev[question.id] || {}), [positionId]: value }
    }))
  }

  const skipPosition = (positionId) => setAdhesion(positionId, SKIP)

  // Bouton "Je passe la question" → toutes les positions à SKIP
  const skipQuestion = () => {
    if (!question) return
    const all = {}
    for (const p of question.positions) all[p.id] = SKIP
    setReponses(prev => ({ ...prev, [question.id]: all }))
    setTimeout(next, 100) // petit délai pour feedback visuel
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
      const hasReponse = Object.values(r).some(v => v !== SKIP && v !== undefined && typeof v === 'number')
      hasReponse ? repondues++ : ignorees++
    }
    return { total, repondues, ignorees }
  }, [phase, data, reponses])

  const matches = useMemo(() => {
    if (phase !== 'recap' || !profiles.data || !D.data) return null
    return computeMatches(reponses, profiles.data, D.data.deputes, { topPartis: 3, topDeputes: 5 })
  }, [phase, profiles.data, D.data, reponses])

  const partiData = useMemo(() => {
    if (phase !== 'recap' || !matches?.partis?.length || !profiles.data || !data) return {}
    const out = {}
    for (const p of matches.partis) {
      const prof = profiles.data.partis[p.code]?.profil
      if (!prof) continue
      const bd = partiBreakdown(data, reponses, prof)
      out[p.code] = {
        themes: matchByTheme(reponses, prof, data),
        accords: bd.accords.slice(0, 5),
        desaccords: bd.desaccords.slice(0, 5),
        nbMajeurs: bd.nbMajeurs
      }
    }
    return out
  }, [phase, matches, profiles.data, data, reponses])

  const partiSelectionne = useMemo(() => {
    if (!compareCode || !profiles.data) return null
    return profiles.data.partis[compareCode] || null
  }, [compareCode, profiles.data])

  // Radar désactivé (calcul d'intensité non fidèle) — refonte à venir. radarData/inversion/compare conservés pour réactivation.

  const themes = useMemo(() => {
    if (phase !== 'recap' || !data) return []
    return analyseParTheme(data, reponses)
  }, [phase, data, reponses])

  const carte = useMemo(() => {
    if (phase !== 'recap' || !data || !axesMap.data) return []
    return carteAxes(data, reponses, axesMap.data)
  }, [phase, data, reponses, axesMap.data])

  const tops = useMemo(() => {
    if (phase !== 'recap' || !data) return []
    return topPositions(data, reponses, 5)
  }, [phase, data, reponses])

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
          right={history.length > 0 ? (
            <Btn variant="ghost" onClick={() => setHistoryOpen(true)} C={C}>
              Historique ({history.length})
            </Btn>
          ) : null}
          C={C}
        />

        {hasResumable && (
          <Card C={C} style={{ marginBottom: 16, background: C.primaryPale, borderColor: C.primary }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 500, color: C.primaryDeep, marginBottom: 2 }}>Un Match en cours</div>
                <div style={{ fontSize: 13, color: C.text }}>Tu peux reprendre où tu en étais, ou en redémarrer un nouveau.</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Btn variant="ghost" onClick={() => setConfirmRestart(true)} C={C}>Recommencer</Btn>
                <Btn variant="primary" onClick={resumeMatch} C={C}>Reprendre →</Btn>
              </div>
            </div>
          </Card>
        )}

        <Card C={C} style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>Comment ça marche ?</h3>
          <p style={{ marginBottom: 12 }}>
            On va te poser <strong>{data.questions.length} questions</strong> sur les grands sujets politiques français : économie, écologie, sécurité, retraites, immigration, démocratie, etc.
          </p>
          <p style={{ marginBottom: 12 }}>
            Pour chaque question, tu as <strong>5 positions</strong>. Pour chacune, tu peux te dire <em>très opposé</em>, <em>opposé</em>, <em>favorable</em> ou <em>très favorable</em>. Si une position ne te parle pas, tu peux la passer.
          </p>
          <p style={{ marginBottom: 12 }}>
            À la fin, tu auras un profil par thème, tes positions les plus fortes, et tes affinités avec les partis et députés <em>croisées avec leurs votes réels à l'Assemblée</em>.
          </p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8, fontSize: 13, color: C.muted, flexWrap: 'wrap' }}>
            <span>⏱ ~10 minutes</span>
            <span>·</span>
            <span>💾 Tes réponses sont sauvegardées sur ton appareil</span>
          </div>
        </Card>

        {!hasResumable && (
          <Btn variant="primary" size="lg" onClick={startMatch} C={C}>Commencer le Match →</Btn>
        )}

        <ConfirmDialog
          open={confirmRestart}
          title="Recommencer le Match ?"
          message="Ton Match en cours sera perdu. Tes Matchs précédents dans l'historique restent intacts."
          confirmLabel="Recommencer"
          danger
          onConfirm={restartAndClear}
          onCancel={() => setConfirmRestart(false)}
          C={C}
        />

        <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title={`Historique (${history.length})`} C={C}>
          {history.length === 0 ? (
            <Empty title="Aucun Match dans l'historique" C={C} />
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {history.map(m => {
                const nbRep = Object.keys(m.reponses || {}).length
                return (
                  <Card C={C} key={m.id} padding={12}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 14 }}>Match du {formatDate(m.completedAt)}</div>
                        <div style={{ fontSize: 12, color: C.muted }}>{nbRep} question{nbRep > 1 ? 's' : ''} répondue{nbRep > 1 ? 's' : ''}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Btn variant="ghost" size="sm" onClick={() => removeFromHistory(m.id)} C={C}>Supprimer</Btn>
                        <Btn variant="primary" size="sm" onClick={() => openHistoryItem(m)} C={C}>Voir</Btn>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </Modal>
      </div>
    )
  }

  // ─── RECAP ───────────────────────────────────────────────────
  if (phase === 'recap') {
    const hasMatching   = matches && matches.partis.length > 0
    const matchingReady = profiles.data && (profiles.data.nbScrutinsMappes || 0) > 0

    return (
      <div className="fadeUp">
        <PageTitle
          title="Tes résultats"
          subtitle={matchingReady
            ? `Calculés à partir de ${profiles.data.nbScrutinsMappes} scrutins de référence.`
            : "Tes réponses sont enregistrées."}
          right={history.length > 0 ? (
            <Btn variant="ghost" onClick={() => setHistoryOpen(true)} C={C}>
              Historique ({history.length})
            </Btn>
          ) : null}
          C={C}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
          <KPI label="Questions répondues" value={`${stats.repondues}/${stats.total}`} C={C} />
          <KPI label="Thèmes explorés"     value={themes.length} hint="sur 8" C={C} />
          <KPI label="Positions tranchées" value={tops.length} hint="très favorable ou très opposé" C={C} />
        </div>

        <Card C={C} style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 2 }}>Ta carte politique</h3>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 18 }}>
            Cinq grands repères pour situer ta façon de voir, d'après tes réponses.
          </div>

          {carte.length === 0 ? (
            <div style={{ fontSize: 14, color: C.muted, padding: '8px 0' }}>
              Carte en préparation (référentiel des axes non chargé).
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {carte.map(a => {
                const pct = (a.score + 100) / 2 // 0..100
                return (
                  <div key={a.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                      <span style={{ color: a.renseigne && a.score < -19 ? C.primary : C.muted }}>{a.neg}</span>
                      <span style={{ color: a.renseigne && a.score > 19 ? C.secondary : C.muted }}>{a.pos}</span>
                    </div>
                    <div style={{ position: 'relative', height: 10, borderRadius: 999, background: C.sandDark }}>
                      <div style={{ position: 'absolute', left: '50%', top: -3, bottom: -3, width: 1, background: C.border }} />
                      {a.renseigne && (
                        <div style={{
                          position: 'absolute', top: '50%', left: `${pct}%`,
                          width: 16, height: 16, borderRadius: '50%',
                          background: a.score < 0 ? C.primary : a.score > 0 ? C.secondary : C.muted,
                          border: `2px solid ${C.white}`, boxShadow: C.shadow,
                          transform: 'translate(-50%,-50%)'
                        }} />
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: a.renseigne ? C.text : C.muted, marginTop: 7, lineHeight: 1.45 }}>
                      {a.renseigne
                        ? a.phrase
                        : `Pas encore d\u2019avis tranché ici \u2014 réponds à plus de questions sur ce thème.`}
                      {a.renseigne && <span style={{ color: C.muted }}> ({a.n} réponse{a.n > 1 ? 's' : ''})</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {themes.length > 0 && (
          <>
            <h2 style={{ marginBottom: 12 }}>Tes positions par thème</h2>
            <div style={{ display: 'grid', gap: 10, marginBottom: 28, gridTemplateColumns: 'repeat(4, 1fr)' }} className="themes-grid">
              {themes.map(t => {
                const tone = t.dominante.val >= 0 ? C.green : C.red
                return (
                  <Card C={C} key={t.themeId} padding={14}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 20 }}>{t.emoji}</span>
                      <span style={{ fontWeight: 500, fontSize: 14 }}>{t.label}</span>
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.4 }}>
                      <strong style={{ color: tone }}>{t.dominante.palierLabel}</strong>
                      <span style={{ color: C.muted }}> à&nbsp;:</span>
                      <div style={{ color: C.text, marginTop: 2 }}>{t.dominante.posLabel}</div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </>
        )}

        {hasMatching && (
          <>
            <h2 style={{ marginBottom: 12 }}>Tes partis les plus proches</h2>
            <div style={{ display: 'grid', gap: 10, marginBottom: 28 }}>
              {matches.partis.map((p, i) => {
                const open = openParti === p.code
                const pd = partiData[p.code] || { themes: [], accords: [], desaccords: [], nbMajeurs: 0 }
                return (
                <Card C={C} key={p.code} padding={16}>
                  <div
                    onClick={() => setOpenParti(open ? null : p.code)}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
                  >
                    <div style={{ fontFamily: 'Fraunces, serif', fontSize: 22, fontWeight: 600, color: C.muted, width: 28, textAlign: 'center' }}>#{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                        <BadgeParti code={p.code} C={C} />
                        <span style={{ fontWeight: 500 }}>{p.nom}</span>
                        <span style={{ fontSize: 12, color: C.muted }}>· {p.nbDeputes} députés</span>
                        {pd.nbMajeurs > 0 && (
                          <span className="badge" style={{ background: C.redPale, color: C.red }}>
                            {pd.nbMajeurs} désaccord{pd.nbMajeurs > 1 ? 's' : ''} majeur{pd.nbMajeurs > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <ProgressBar value={p.score} max={100} C={C} height={8} />
                    </div>
                    <div style={{ fontFamily: 'Fraunces, serif', fontSize: 28, fontWeight: 600, color: C.primary, minWidth: 70, textAlign: 'right' }}>
                      {p.score}%
                    </div>
                    <span style={{ color: C.muted, fontSize: 13, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>›</span>
                  </div>

                  {open && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>Ton accord avec {p.code}, par thème :</div>
                      {pd.themes.length === 0 ? (
                        <div style={{ fontSize: 13, color: C.muted }}>Pas assez de positions communes pour détailler.</div>
                      ) : (
                        <div style={{ display: 'grid', gap: 8 }}>
                          {pd.themes.map(t => {
                            const tone = t.score >= 66 ? C.green : t.score >= 40 ? C.yellow : C.red
                            return (
                              <div key={t.themeId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontSize: 16, width: 22 }}>{t.emoji}</span>
                                <span style={{ flex: 1, fontSize: 13, minWidth: 0 }}>{t.label}</span>
                                <div style={{ flex: 1, minWidth: 80 }}>
                                  <div style={{ height: 6, borderRadius: 999, background: C.sandDark, position: 'relative' }}>
                                    <div style={{ position: 'absolute', inset: 0, width: `${t.score}%`, background: tone, borderRadius: 999 }} />
                                  </div>
                                </div>
                                <span style={{ fontFamily: 'Fraunces, serif', fontSize: 15, fontWeight: 600, color: tone, minWidth: 42, textAlign: 'right' }}>{t.score}%</span>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      <div style={{ display: 'grid', gap: 16, marginTop: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.green, marginBottom: 8 }}>Là où tu te rapproches</div>
                          {pd.accords.length === 0
                            ? <div style={{ fontSize: 13, color: C.muted }}>Aucun accord net.</div>
                            : <PositionList items={pd.accords} accord C={C} />}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.red, marginBottom: 8 }}>Là où tu t'éloignes</div>
                          {pd.desaccords.length === 0
                            ? <div style={{ fontSize: 13, color: C.muted }}>Aucun désaccord net.</div>
                            : <PositionList items={pd.desaccords} C={C} />}
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
                )
              })}
            </div>

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
            <div style={{ fontSize: 14, color: C.text }}>Le mapping des scrutins de référence est en cours. Reviens bientôt.</div>
          </Card>
        )}

        {tops.length > 0 && (
          <>
            <h2 style={{ marginBottom: 12 }}>Tes positions les plus tranchées</h2>
            <div style={{ display: 'grid', gap: 8, marginBottom: 28 }}>
              {tops.map(t => {
                const tone = t.val >= 0 ? C.green : C.red
                return (
                  <Card C={C} key={`${t.qId}-${t.posId}`} padding={12}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ fontSize: 18 }}>{t.qEmoji}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: C.muted }}>{t.qTitre}</div>
                        <div style={{ fontWeight: 500, fontSize: 14 }}>{t.posLabel}</div>
                      </div>
                      <span className="badge" style={{ background: tone, color: '#fff', fontWeight: 600 }}>
                        {t.palierLabel}
                      </span>
                    </div>
                  </Card>
                )
              })}
            </div>
          </>
        )}

        <details style={{ marginBottom: 24 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 500, fontSize: 15, marginBottom: 12, color: C.text }}>
            Voir toutes tes réponses, question par question
          </summary>
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            {data.questions.map(q => {
              const r = reponses[q.id] || {}
              const positions = q.positions
                .map(p => ({ ...p, val: r[p.id] }))
                .filter(p => p.val !== undefined && p.val !== SKIP)
                .sort((a, b) => Math.abs(b.val) - Math.abs(a.val))
              return (
                <Card C={C} key={q.id} padding={14}>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>
                    {q.emoji} {q.titre}
                  </div>
                  {positions.length === 0 ? (
                    <div style={{ fontSize: 14, color: C.muted, fontStyle: 'italic' }}>Passée.</div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                      {positions.map(p => {
                        const palier = PALIER_BY_VALUE[p.val]
                        if (!palier) return null
                        const tone = p.val >= 0 ? C.green : C.red
                        const pale = p.val >= 0 ? C.greenPale : C.redPale
                        return (
                          <span key={p.id} className="badge"
                            style={{ background: pale, color: tone, fontWeight: 500 }}>
                            {p.label} — {palier.label}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        </details>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn variant="ghost" onClick={restart} C={C}>← Retour à l'accueil</Btn>
          <Btn variant="primary" onClick={startMatch} C={C}>Refaire un Match</Btn>
        </div>

        <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title={`Historique (${history.length})`} C={C}>
          {history.length === 0 ? (
            <Empty title="Aucun Match dans l'historique" C={C} />
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {history.map(m => {
                const nbRep = Object.keys(m.reponses || {}).length
                return (
                  <Card C={C} key={m.id} padding={12}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 14 }}>Match du {formatDate(m.completedAt)}</div>
                        <div style={{ fontSize: 12, color: C.muted }}>{nbRep} question{nbRep > 1 ? 's' : ''} répondue{nbRep > 1 ? 's' : ''}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Btn variant="ghost" size="sm" onClick={() => removeFromHistory(m.id)} C={C}>Supprimer</Btn>
                        <Btn variant="primary" size="sm" onClick={() => openHistoryItem(m)} C={C}>Voir</Btn>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </Modal>
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
        Pour chaque position, indique ton avis. Si une position ne te parle pas, clique <strong style={{ color: C.text }}>Sans avis</strong>.
      </div>

      <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
        {question.positions.map(p => {
          const val = reponsesQuestion[p.id]
          const hasAnswer = val !== undefined && val !== SKIP
          const isSkipped = val === SKIP
          return (
            <Card C={C} key={p.id} padding={16}
              style={{
                borderColor: hasAnswer ? (val >= 0 ? C.green : C.red) : (isSkipped ? C.muted : C.border),
                opacity: isSkipped ? 0.55 : 1,
                transition: 'all .15s'
              }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 15 }}>{p.label}</div>
                <div style={{ fontSize: 14, lineHeight: 1.5, color: C.text }}>
                  <GlossText texte={p.texte} glossaire={data.glossaire} C={C} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {PALIERS.map(palier => {
                  const active = val === palier.value
                  return (
                    <button key={palier.value}
                      onClick={() => setAdhesion(p.id, palier.value)}
                      style={{
                        flex: '1 1 100px', minWidth: 90, padding: '8px 6px',
                        background: PALIER_BG(C, palier.value, active),
                        color: PALIER_FG(C, palier.value, active),
                        border: `1px solid ${PALIER_BORDER(C, palier.value, active)}`,
                        borderRadius: 8, fontWeight: 600, fontSize: 13,
                        cursor: 'pointer', transition: 'all .12s'
                      }}>
                      {palier.label}
                    </button>
                  )
                })}
                <button onClick={() => skipPosition(p.id)}
                  style={{
                    padding: '8px 12px',
                    background: isSkipped ? C.sand : 'transparent',
                    color: C.muted,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8, fontWeight: 500, fontSize: 13,
                    cursor: 'pointer', transition: 'all .12s'
                  }}>
                  Sans avis
                </button>
              </div>
            </Card>
          )
        })}
      </div>

      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <button onClick={skipQuestion}
          style={{
            background: 'none', border: 'none', color: C.muted,
            fontSize: 13, cursor: 'pointer', textDecoration: 'underline',
            textDecorationStyle: 'dotted', textUnderlineOffset: 3
          }}>
          Passer toute la question
        </button>
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
