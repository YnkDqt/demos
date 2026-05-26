import React, { useState, useMemo, useEffect } from 'react'
import { PageTitle, Card, Btn, Spinner, ErrorBox, ProgressBar, KPI } from '../atoms.jsx'
import { usePropositions } from '../hooks.js'
import GlossText from '../GlossText.jsx'

/**
 * Le Match — collecte des réponses.
 *
 * Pour chaque question (20 au total, ordre aléatoire à chaque session),
 * l'utilisateur peut noter chaque position (5 par question) sur une
 * échelle de 0/25/50/75/100% d'adhésion, indépendamment.
 *
 * Réponses stockées dans le state local — pas de persistance V1.
 * En fin de Match, écran récapitulatif brut (le matching avec partis vient en P2.4).
 */

const PALIERS = [0, 25, 50, 75, 100]

// Mélange tableau (Fisher-Yates) — utilisé pour randomiser l'ordre des questions à chaque session
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

  // Phases : 'intro' → 'questions' → 'recap'
  const [phase, setPhase] = useState('intro')
  // Index de la question courante (dans l'ordre randomisé)
  const [idx, setIdx] = useState(0)
  // Réponses : { questionId: { positionId: 0..100 } }
  const [reponses, setReponses] = useState({})
  // Bloc "En bref" ouvert ?
  const [enBrefOpen, setEnBrefOpen] = useState(false)
  // Ordre randomisé des questions (calculé une fois au démarrage du Match)
  const [ordre, setOrdre] = useState([])

  // Au démarrage du Match, on randomise
  const startMatch = () => {
    if (!data) return
    setOrdre(shuffle(data.questions.map(q => q.id)))
    setIdx(0)
    setReponses({})
    setEnBrefOpen(false)
    setPhase('questions')
    window.scrollTo({ top: 0 })
  }

  const restart = () => {
    setPhase('intro')
    setIdx(0)
    setReponses({})
    setOrdre([])
    setEnBrefOpen(false)
    window.scrollTo({ top: 0 })
  }

  // Question courante
  const questionsById = useMemo(() => {
    if (!data) return {}
    return Object.fromEntries(data.questions.map(q => [q.id, q]))
  }, [data])

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
      setIdx(i => i + 1)
      setEnBrefOpen(false)
      window.scrollTo({ top: 0 })
    } else {
      setPhase('recap')
      window.scrollTo({ top: 0 })
    }
  }

  const prev = () => {
    if (idx > 0) {
      setIdx(i => i - 1)
      setEnBrefOpen(false)
      window.scrollTo({ top: 0 })
    }
  }

  // Statistiques pour le récap
  const stats = useMemo(() => {
    if (phase !== 'recap' || !data) return null
    let total = 0, repondues = 0, ignorees = 0
    for (const q of data.questions) {
      total++
      const r = reponses[q.id] || {}
      const hasReponse = Object.values(r).some(v => v > 0)
      if (hasReponse) repondues++
      else ignorees++
    }
    return { total, repondues, ignorees }
  }, [phase, data, reponses])

  // ─── PHASES ──────────────────────────────────────────────────

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
            À la fin, on calcule quels partis et députés sont le plus proches de tes idées <em>(à venir)</em>.
          </p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8, fontSize: 13, color: C.muted, flexWrap: 'wrap' }}>
            <span>⏱ {data.questions.length === 20 ? '~10 minutes' : `~${Math.ceil(data.questions.length / 2)} minutes`}</span>
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

        <Btn variant="primary" size="lg" onClick={startMatch} C={C}>
          Commencer le Match →
        </Btn>
      </div>
    )
  }

  // ─── RECAP ───────────────────────────────────────────────────
  if (phase === 'recap') {
    return (
      <div className="fadeUp">
        <PageTitle
          title="Tes réponses sont enregistrées"
          subtitle="Le calcul des affinités avec les partis et députés arrive bientôt."
          C={C}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
          <KPI label="Questions répondues" value={`${stats.repondues}/${stats.total}`} C={C} />
          <KPI label="Questions ignorées"  value={stats.ignorees} hint="(toutes positions à 0%)" C={C} />
        </div>

        <Card C={C} style={{ marginBottom: 16, background: C.primaryPale, borderColor: C.primary }}>
          <div style={{ fontWeight: 500, color: C.primaryDeep, marginBottom: 4 }}>🚧 En construction</div>
          <div style={{ fontSize: 14, color: C.text }}>
            Le moteur de matching avec les partis et les députés est en cours de développement.
            Pour l'instant, tu peux voir ci-dessous le détail brut de tes réponses.
          </div>
        </Card>

        <h2 style={{ marginBottom: 12, marginTop: 24 }}>Détail de tes réponses</h2>
        <div style={{ display: 'grid', gap: 12 }}>
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

        <div style={{ marginTop: 24, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
      {/* Barre de progression */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 13, color: C.muted }}>
          <span>Question {idx + 1} sur {ordre.length}</span>
          <span>{progressPct}%</span>
        </div>
        <ProgressBar value={idx + 1} max={ordre.length} C={C} height={6} />
      </div>

      {/* En-tête question */}
      <Card C={C} style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 500 }}>
          {question.emoji} {question.theme}
        </div>
        <h2 style={{ marginBottom: 12, lineHeight: 1.25 }}>{question.titre}</h2>
        <div style={{ fontSize: 15, lineHeight: 1.55 }}>
          <GlossText texte={question.question} glossaire={data.glossaire} C={C} />
        </div>

        {/* En bref dépliable */}
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

      {/* Consigne */}
      <div style={{ marginBottom: 12, fontSize: 14, color: C.muted, textAlign: 'center' }}>
        Pour chaque position, indique à quel point tu y adhères. <strong style={{ color: C.text }}>Tu peux laisser à 0%</strong> si elle ne te parle pas du tout.
      </div>

      {/* Positions */}
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

              {/* Paliers 0/25/50/75/100 */}
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

      {/* Boutons précédent / suivant */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 40 }}>
        <Btn variant="ghost" onClick={prev} C={C} disabled={idx === 0}>← Précédent</Btn>
        <Btn variant="primary" onClick={next} C={C}>
          {idx < ordre.length - 1 ? 'Suivant →' : 'Terminer le Match ✓'}
        </Btn>
      </div>
    </div>
  )
}
