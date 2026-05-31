import React, { useState, useMemo, useEffect, useRef } from 'react'
import { PageTitle, Card, Btn, Spinner, ErrorBox, ProgressBar, KPI, Avatar, BadgeParti, Empty, ConfirmDialog, Modal } from '../atoms.jsx'
import { usePropositions, useProfiles, useDeputes, useAxesMapping, useMatchCourt } from '../hooks.js'
import { carteAxes, partiAxes } from '../axes.js'
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

// ─── NIVEAU 1 : VISIONS ──────────────────────────────────────
const VISION_RANK_W = [3, 2, 1]
const FAMILLE_LABEL = {
  'gauche-radicale': 'Gauche de rupture',
  'gauche': 'Gauche sociale et écologiste',
  'centre': 'Centre',
  'droite': 'Droite',
  'droite-radicale': 'Droite nationale'
}
const AXES_POLES = {
  eco:      { gauche: 'Collectif / État',  droite: 'Marché / Individu' },
  autorite: { gauche: 'Ordre / Autorité',  droite: 'Libertés' },
  identite: { gauche: 'Ouverture',         droite: 'Souveraineté' }
}

// Agrège le top 3 : placement pondéré sur les 3 axes + famille dominante.
function visionResult(picks, visions) {
  const byId = Object.fromEntries(visions.map(v => [v.id, v]))
  const acc = { eco: 0, autorite: 0, identite: 0 }
  const famW = {}
  let wTot = 0
  picks.forEach((id, i) => {
    const v = byId[id]; if (!v) return
    const w = VISION_RANK_W[i] || 1
    wTot += w
    acc.eco += (v.placement.eco || 0) * w
    acc.autorite += (v.placement.autorite || 0) * w
    acc.identite += (v.placement.identite || 0) * w
    famW[v.famille] = (famW[v.famille] || 0) + w
  })
  if (!wTot) return null
  const placement = {
    eco: Math.round(acc.eco / wTot),
    autorite: Math.round(acc.autorite / wTot),
    identite: Math.round(acc.identite / wTot)
  }
  const famille = Object.entries(famW).sort((a, b) => b[1] - a[1])[0][0]
  return { placement, famille, visions: picks.map(id => byId[id]).filter(Boolean) }
}

// Barre d'axe -100..+100 avec marqueur de position.
function AxisBar({ axe, value, C }) {
  const pct = (value + 100) / 2 // 0..100
  const poles = AXES_POLES[axe]
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.muted, marginBottom: 4 }}>
        <span>{poles.gauche}</span>
        <span>{poles.droite}</span>
      </div>
      <div style={{ position: 'relative', height: 8, background: C.border, borderRadius: 99 }}>
        <div style={{ position: 'absolute', left: '50%', top: -3, bottom: -3, width: 1, background: C.muted, opacity: .4 }} />
        <div style={{
          position: 'absolute', left: `calc(${pct}% - 7px)`, top: -3,
          width: 14, height: 14, borderRadius: 99,
          background: C.primary, border: `2px solid ${C.white}`, boxShadow: `0 0 0 1px ${C.primary}`
        }} />
      </div>
    </div>
  )
}

// Liste de positions (accord ou désaccord) avec ton palier + l'intensité du parti.
function PositionList({ items, accord, C }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {items.map((it, i) => {
        const toi = PALIER_BY_VALUE[it.user]?.label || ''
        const eux = intensiteLabel(it.parti)
        const majeur = !accord && Math.abs(it.user) === 100
        return (
          <div key={i} style={{ background: C.white, padding: '8px 10px', borderRadius: 8, border: `1px solid ${majeur ? C.red : C.border}` }}>
            <div style={{ fontSize: 12, color: C.muted }}>{it.qEmoji} {it.qTitre}</div>
            <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>
              {it.posLabel}
              {majeur && <span style={{ color: C.red, fontWeight: 600, fontSize: 11 }}> · désaccord majeur</span>}
            </div>
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

export default function PageMonMatch({ C, onSelectDepute, expert }) {
  const { data, loading, error } = usePropositions()
  const profiles = useProfiles()
  const axesMap = useAxesMapping()
  const MC = useMatchCourt()
  const D = useDeputes()

  const [phase, setPhase]       = useState('visions')
  const [visionPicks, setVisionPicks] = useState([])
  const [visionResultOpen, setVisionResultOpen] = useState(false)
  const [visionOrder, setVisionOrder] = useState([])
  const [idx, setIdx]           = useState(0)
  const [reponses, setReponses] = useState({})
  const [enBrefOpen, setEnBrefOpen] = useState(false)
  const [ordre, setOrdre]       = useState([])

  const [compareCode, setCompareCode] = useState(null)
  const [inversion, setInversion]     = useState(false)
  const [openParti, setOpenParti]     = useState(null)
  const [showAllPartis, setShowAllPartis] = useState(false)

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
      const hist = h.map(m => ({ ...m, reponses: migrateReponses(m.reponses, m.version || 1) }))
      setHistory(hist)
      // Pas de Match en cours mais un historique : afficher directement le dernier résultat.
      if (!(cur && cur.phase === 'questions') && hist.length > 0) {
        const last = hist[0]
        savedToHistory.current = true
        setReponses(last.reponses || {})
        setOrdre(last.ordre || [])
        setPhase('recap')
      }
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
    setPhase('visions'); setIdx(0); setReponses({}); setOrdre([]); setEnBrefOpen(false)
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

  useEffect(() => {
    if (MC.data && visionOrder.length === 0) setVisionOrder(shuffle(MC.data.visions.map(v => v.id)))
  }, [MC.data, visionOrder.length])

  useEffect(() => {
    if (phase === 'visions' && !MC.loading && !MC.data) setPhase('intro')
  }, [phase, MC.loading, MC.data])

  const toggleVision = (id) => {
    setVisionResultOpen(false)
    setVisionPicks(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 3) return prev
      return [...prev, id]
    })
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
    return computeMatches(reponses, profiles.data, D.data.deputes, { topPartis: 99, topDeputes: 5 })
  }, [phase, profiles.data, D.data, reponses])

  const partiData = useMemo(() => {
    if (phase !== 'recap' || !matches?.partis?.length || !profiles.data || !data) return {}
    const out = {}
    for (const p of matches.partis) {
      const prof = profiles.data.partis[p.code]?.profil
      if (!prof) continue
      const bd = partiBreakdown(data, reponses, prof)
      // majeurs (toi ±100) d'abord, puis par écart décroissant
      const des = [...bd.desaccords].sort((a, b) => {
        const ma = Math.abs(a.user) === 100, mb = Math.abs(b.user) === 100
        if (ma !== mb) return ma ? -1 : 1
        return b.gap - a.gap
      })
      out[p.code] = {
        themes: matchByTheme(reponses, prof, data),
        accords: bd.accords.slice(0, 5),
        desaccords: des.slice(0, 6),
        nbMajeurs: bd.nbMajeurs
      }
    }
    return out
  }, [phase, matches, profiles.data, data, reponses])

  const partiSelectionne = useMemo(() => {
    if (!compareCode || !profiles.data) return null
    return profiles.data.partis[compareCode] || null
  }, [compareCode, profiles.data])

  // Placement de chaque parti du top sur les 5 axes (mode expert).
  // Map : code parti → { axes: [{id, score, renseigne}], couleur }.
  const partisOnAxes = useMemo(() => {
    if (!expert || !matches?.partis?.length || !profiles.data || !data || !axesMap.data) return null
    const out = {}
    for (const p of matches.partis) {
      const prof = profiles.data.partis[p.code]?.profil
      if (!prof) continue
      out[p.code] = partiAxes(prof, data, axesMap.data)
    }
    return out
  }, [expert, matches, profiles.data, data, axesMap.data])

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

  // Couverture : parmi tes positions tranchées (±100), lesquelles sont mesurables
  // par les votes (présentes dans au moins un profil parti) vs muettes (angle mort).
  const couverture = useMemo(() => {
    if (phase !== 'recap' || !data || !profiles.data?.partis) return null
    const mesurables = new Set()
    for (const p of Object.values(profiles.data.partis)) {
      for (const posId of Object.keys(p.profil || {})) mesurables.add(posId)
    }
    const fortes = [] // positions où tu es à ±100
    for (const q of data.questions) {
      const r = reponses[q.id] || {}
      for (const p of q.positions) {
        if (Math.abs(r[p.id]) === 100) {
          fortes.push({ posLabel: p.label, qEmoji: q.emoji, mesurable: mesurables.has(p.id) })
        }
      }
    }
    const muettes = fortes.filter(f => !f.mesurable)
    return { nbFortes: fortes.length, nbMesurables: fortes.length - muettes.length, muettes }
  }, [phase, data, reponses, profiles.data])

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

  // ─── NIVEAU 1 : VISIONS ──────────────────────────────────────
  if (phase === 'visions') {
    if (MC.loading) return (
      <div className="fadeUp">
        <Card C={C} style={{ textAlign: 'center', padding: 40 }}>
          <Spinner C={C} size={32} />
        </Card>
      </div>
    )
    if (!MC.data) return null

    const visions = MC.data.visions
    const orderedVisions = visionOrder.length
      ? visionOrder.map(id => visions.find(v => v.id === id)).filter(Boolean)
      : visions
    const gloss = MC.data.glossaire
    const res = visionResultOpen && visionPicks.length === 3 ? visionResult(visionPicks, visions) : null

    return (
      <div className="fadeUp">
        <PageTitle
          title="Mon match"
          subtitle="Commence par l'essentiel : quelles visions de société te parlent ?"
          right={history.length > 0 ? (
            <Btn variant="ghost" onClick={() => setHistoryOpen(true)} C={C}>Historique ({history.length})</Btn>
          ) : null}
          C={C}
        />

        <Card C={C} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 500 }}>
            Niveau 1 · 2 min
          </div>
          <p style={{ marginBottom: 0 }}>
            Voici {visions.length} grandes visions de société. Choisis les <strong>3 qui résonnent le plus</strong> avec toi, dans l'ordre. Pas de bonne réponse : on cherche ta tendance de fond.
          </p>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, marginBottom: 20 }}>
          {orderedVisions.map(v => {
            const rank = visionPicks.indexOf(v.id)
            const picked = rank !== -1
            const full = visionPicks.length >= 3 && !picked
            return (
              <Card C={C} key={v.id} padding={16}
                onClick={() => !full && toggleVision(v.id)}
                style={{
                  cursor: full ? 'default' : 'pointer',
                  opacity: full ? 0.5 : 1,
                  borderColor: picked ? C.primary : C.border,
                  background: picked ? C.primaryPale : C.white,
                  transition: 'all .15s'
                }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{
                    flexShrink: 0, width: 26, height: 26, borderRadius: 99,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 13,
                    background: picked ? C.primary : C.sand,
                    color: picked ? C.white : C.muted,
                    border: `1px solid ${picked ? C.primary : C.border}`
                  }}>
                    {picked ? rank + 1 : ''}
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.55, color: C.text }}>
                    <GlossText texte={v.texte} glossaire={gloss} C={C} />
                  </div>
                </div>
              </Card>
            )
          })}
        </div>

        <div style={{
          position: 'sticky', bottom: 0, padding: '12px 0',
          background: `linear-gradient(transparent, ${C.bg || C.white} 30%)`,
          display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: 13, color: C.muted }}>{visionPicks.length}/3 choisies</span>
          <Btn variant="primary"
            onClick={() => { setVisionResultOpen(true); window.scrollTo({ top: document.body.scrollHeight }) }}
            disabled={visionPicks.length !== 3} C={C}>
            Voir ma tendance →
          </Btn>
          {visionPicks.length > 0 && (
            <Btn variant="ghost" onClick={() => { setVisionPicks([]); setVisionResultOpen(false) }} C={C}>Effacer</Btn>
          )}
        </div>

        {res && (
          <Card C={C} className="fadeUp" style={{ marginTop: 12 }}>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 500 }}>
              Ta tendance
            </div>
            <h2 style={{ marginBottom: 14 }}>{FAMILLE_LABEL[res.famille] || res.famille}</h2>

            <AxisBar axe="eco" value={res.placement.eco} C={C} />
            <AxisBar axe="autorite" value={res.placement.autorite} C={C} />
            <AxisBar axe="identite" value={res.placement.identite} C={C} />

            <div style={{ marginTop: 14, fontSize: 14, color: C.text }}>
              Visions retenues : {res.visions.map(v => v.label).join(', ')}.
            </div>
            <div style={{ marginTop: 4, fontSize: 13, color: C.muted }}>
              C'est une première orientation, basée sur ce qui te séduit. Pour la confronter aux votes réels à l'Assemblée, fais le match détaillé.
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
              <Btn variant="primary" onClick={() => setPhase('intro')} C={C}>Aller plus loin : match détaillé →</Btn>
            </div>
          </Card>
        )}

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

  // ─── INTRO ───────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <div className="fadeUp">
        <PageTitle
          title="Match détaillé"
          subtitle="Niveau 4 — le questionnaire complet, croisé avec les votes réels."
          right={
            <Btn variant="ghost" onClick={() => setPhase('visions')} C={C}>← Niveaux</Btn>
          }
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
          right={
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn variant="primary" onClick={startMatch} C={C}>Nouveau match</Btn>
              {history.length > 0 && (
                <Btn variant="ghost" onClick={() => setHistoryOpen(true)} C={C}>
                  Historique ({history.length})
                </Btn>
              )}
            </div>
          }
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
                          transform: 'translate(-50%,-50%)', zIndex: 2
                        }} />
                      )}
                    </div>
                    {expert && partisOnAxes && (() => {
                      const items = Object.entries(partisOnAxes)
                        .map(([code, axes]) => {
                          const ax = axes.find(x => x.id === a.id)
                          return ax && ax.renseigne ? { code, pct: (ax.score + 100) / 2, score: ax.score } : null
                        })
                        .filter(Boolean)
                        .sort((x, y) => x.pct - y.pct)
                      if (items.length === 0) return null
                      // Demi-largeur estimée en % (barre ≈ 600px, char ≈ 6px, padding 12px).
                      const halfW = (code) => (code.length * 6 + 12) / 12
                      const MARGIN = 0.5
                      const rows = []
                      items.forEach(it => {
                        let placed = false
                        for (let r = 0; r < rows.length; r++) {
                          const last = rows[r][rows[r].length - 1]
                          const need = halfW(it.code) + halfW(last.code) + MARGIN
                          if (it.pct - last.pct >= need) {
                            rows[r].push(it); it.row = r; placed = true; break
                          }
                        }
                        if (!placed) { rows.push([it]); it.row = rows.length - 1 }
                      })
                      const ROW_H = 18
                      return (
                        <div style={{ position: 'relative', height: rows.length * ROW_H, marginTop: 6 }}>
                          {items.map(it => (
                            <span key={it.code} title={`${it.code} : ${it.score > 0 ? '+' : ''}${it.score}`}
                              style={{
                                position: 'absolute', left: `${it.pct}%`, top: it.row * ROW_H,
                                transform: 'translateX(-50%)',
                                fontSize: 10, padding: '1px 6px', borderRadius: 999,
                                background: C.primaryPale, color: C.primaryDeep,
                                fontWeight: 600, whiteSpace: 'nowrap', lineHeight: '14px'
                              }}>{it.code}</span>
                          ))}
                        </div>
                      )
                    })()}
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
            {couverture && couverture.muettes.length > 0 && (
              <Card C={C} style={{ marginBottom: 16, background: C.sand }}>
                <div style={{ fontSize: 14, lineHeight: 1.5 }}>
                  Ton score s'appuie sur <strong>{couverture.nbMesurables} de tes {couverture.nbFortes} positions tranchées</strong>.
                  Le reste porte sur des sujets que l'Assemblée ne vote pas (ou peu), donc <strong>non mesurables par les votes</strong> :
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                  {couverture.muettes.map((m, i) => (
                    <span key={i} className="badge" style={{ background: C.white, color: C.muted, border: `1px solid ${C.border}` }}>
                      {m.qEmoji} {m.posLabel}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>
                  Ces convictions comptent pour toi mais n'entrent pas dans le calcul de proximité. Garde-le en tête en lisant les scores.
                </div>
              </Card>
            )}

            <h2 style={{ marginBottom: 12 }}>Tes partis les plus proches</h2>
            <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
              {(showAllPartis ? matches.partis : matches.partis.slice(0, 3)).map((p, i) => {
                const open = openParti === p.code
                const pd = partiData[p.code] || { themes: [], accords: [], desaccords: [], nbMajeurs: 0 }
                const meta = profiles.data?.partis?.[p.code] || {}
                const nbScr = meta.nbScrutinsParticipes
                const coh   = meta.cohesion
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
                        {nbScr != null && nbScr > 0 && (
                          <span style={{ fontSize: 12, color: C.muted }}>· profil sur {nbScr} scrutins</span>
                        )}
                        {expert && coh != null && (
                          <span className="badge" style={{ background: C.primaryPale, color: C.primaryDeep }}>
                            Cohésion {coh}%
                          </span>
                        )}
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

            {matches.partis.length > 3 && (
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <Btn variant="ghost" size="sm" onClick={() => setShowAllPartis(v => !v)} C={C}>
                  {showAllPartis ? 'Réduire' : `Voir tous les partis (${matches.partis.length})`}
                </Btn>
              </div>
            )}

            <h2 style={{ marginBottom: 12 }}>Tes députés les plus proches</h2>
            <div style={{ display: 'grid', gap: 10, marginBottom: 28 }}>
              {matches.deputes.map((d, i) => (
                <Card C={C} key={d.id} padding={14}>
                  <div
                    onClick={() => onSelectDepute && onSelectDepute(d.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: onSelectDepute ? 'pointer' : 'default' }}
                  >
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
                    {onSelectDepute && <span style={{ color: C.muted, fontSize: 13 }}>›</span>}
                  </div>
                </Card>
              ))}
            </div>

            <details style={{ marginBottom: 24 }}>
              <summary style={{ cursor: 'pointer', fontSize: 13, color: C.muted, fontStyle: 'italic' }}>
                Comment ces scores sont-ils calculés ?
              </summary>
              <div style={{ marginTop: 10, fontSize: 13, color: C.text, lineHeight: 1.55 }}>
                <p style={{ marginBottom: 8 }}>
                  Chaque parti et député dispose d'un profil idéologique reconstruit à partir de ses <strong>votes réels</strong> sur {matches.nbScrutinsMappes} scrutins de référence. Chaque scrutin est rattaché à une ou plusieurs positions de ce Match.
                </p>
                <p style={{ marginBottom: 8 }}>
                  Le score (%) est une <strong>similarité cosinus signée</strong> entre ton vecteur de positions et le leur, sur l'intersection des positions exprimées. Les "Sans avis" et les sujets non votés sont ignorés.
                </p>
                <p style={{ marginBottom: 0 }}>
                  Le score ne reflète pas une appartenance politique mais une proximité de positions sur les sujets que l'Assemblée a tranchés.
                </p>
              </div>
            </details>
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
