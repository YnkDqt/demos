import React, { useState, useEffect, useMemo, useCallback } from 'react'

// ─────────────────────────────────────────────────────────────
// 1. PALETTE
// ─────────────────────────────────────────────────────────────
const C_LIGHT = {
  bg: "#FBF7F2", white: "#FFFFFF", sand: "#F5F1EB", sandDark: "#E8E0D8",
  primary: "#4F7CAC", primaryLight: "#6B98C8", primaryPale: "#E0E7FF", primaryDeep: "#1E3A8A",
  secondary: "#C2410C", secondaryPale: "#FFE8DC", secondaryDark: "#7C2D12",
  text: "#2D3748", muted: "#6B7280", border: "#E5E7EB",
  green: "#15803D", greenPale: "#DCFCE7",
  yellow: "#D97706", yellowPale: "#FEF3C7",
  red: "#DC2626", redPale: "#FEE2E2",
  blue: "#4F7CAC", bluePale: "#E0E7FF",
  shadow: "0 1px 3px rgba(0,0,0,.04), 0 1px 2px rgba(0,0,0,.03)",
  shadowLg: "0 10px 25px -5px rgba(0,0,0,.08), 0 8px 10px -6px rgba(0,0,0,.04)"
}
const C_DARK = {
  bg: "#1A1815", white: "#26221E", sand: "#2D2925", sandDark: "#36312B",
  primary: "#6B98C8", primaryLight: "#8FB4D8", primaryPale: "#2A3548", primaryDeep: "#A5C2E0",
  secondary: "#E67449", secondaryPale: "#3D2418", secondaryDark: "#F59575",
  text: "#EDE6DC", muted: "#9CA3AF", border: "#3A342E",
  green: "#4ADE80", greenPale: "#14361F",
  yellow: "#FBBF24", yellowPale: "#3D2D0E",
  red: "#F87171", redPale: "#3D1818",
  blue: "#6B98C8", bluePale: "#2A3548",
  shadow: "0 1px 3px rgba(0,0,0,.3), 0 1px 2px rgba(0,0,0,.2)",
  shadowLg: "0 10px 25px -5px rgba(0,0,0,.4), 0 8px 10px -6px rgba(0,0,0,.3)"
}

// ─────────────────────────────────────────────────────────────
// 2. CONSTANTES GLOBALES
// ─────────────────────────────────────────────────────────────
const THEMES = [
  { id: 'logement', emoji: '🏠', label: 'Logement & ville' },
  { id: 'travail',  emoji: '💼', label: 'Travail & retraites' },
  { id: 'env',      emoji: '🌍', label: 'Environnement & climat' },
  { id: 'secu',     emoji: '🛡️', label: 'Sécurité & justice' },
  { id: 'sante',    emoji: '🏥', label: 'Santé & social' },
  { id: 'educ',     emoji: '🎓', label: 'Éducation & jeunesse' },
  { id: 'eco',      emoji: '💰', label: 'Économie & impôts' },
  { id: 'inter',    emoji: '🌐', label: 'International & immigration' }
]
const THEMES_DEFAULT = ['logement', 'env', 'sante', 'eco']

const NAVS = [
  { id: 'mon-coin',  label: 'Mon coin' },
  { id: 'mes-elus',  label: 'Mes élus' },
  { id: 'mon-match', label: 'Mon match' },
  { id: 'decrypter', label: 'Décrypter' },
  { id: 'mes-idees', label: 'Mes idées' },
  { id: 'reglages',  label: 'Réglages' }
]

const APP_VERSION = '0.1.0'
const STORAGE_KEY_HINT = 'demos-profile-export'

// ─────────────────────────────────────────────────────────────
// 3. STYLES GLOBAUX
// ─────────────────────────────────────────────────────────────
const G = (C) => `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');

*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: 'Inter', -apple-system, system-ui, sans-serif;
  background: ${C.bg};
  color: ${C.text};
  -webkit-font-smoothing: antialiased;
  line-height: 1.55;
  font-size: 15px;
  transition: background .25s ease, color .25s ease;
}
h1,h2,h3,h4 { font-family: 'Fraunces', Georgia, serif; font-weight: 600; letter-spacing: -.01em; margin: 0; color: ${C.text}; }
h1 { font-size: 2rem; line-height: 1.15; }
h2 { font-size: 1.5rem; line-height: 1.2; }
h3 { font-size: 1.15rem; line-height: 1.3; }
p { margin: 0 0 .6em; }
a { color: ${C.primary}; text-decoration: none; }
a:hover { text-decoration: underline; }

button { font-family: inherit; cursor: pointer; }
input, select, textarea {
  font-family: inherit; font-size: 14px; color: ${C.text};
  background: ${C.white}; border: 1px solid ${C.border}; border-radius: 8px;
  padding: 9px 12px; outline: none; width: 100%;
  transition: border-color .15s, box-shadow .15s;
}
input:focus, select:focus, textarea:focus { border-color: ${C.primary}; box-shadow: 0 0 0 3px ${C.primaryPale}; }
textarea { min-height: 90px; resize: vertical; }

table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid ${C.border}; }
th { font-weight: 600; color: ${C.muted}; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; background: ${C.sand}; }
tbody tr:hover { background: ${C.sand}; }

.badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 9px; border-radius: 999px; font-size: 12px; font-weight: 500;
  background: ${C.sand}; color: ${C.text};
}

@keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.fadeUp { animation: fadeUp .35s ease both; }

.scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
.scrollbar::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
.scrollbar::-webkit-scrollbar-thumb:hover { background: ${C.muted}; }

.app-layout { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }
.app-main { padding: 32px 40px 80px; max-width: 1280px; width: 100%; }
.app-topbar { display: none; }

@media (max-width: 768px) {
  .app-layout { grid-template-columns: 1fr; }
  .app-sidebar { display: none !important; }
  .app-topbar { display: flex !important; }
  .app-main { padding: 16px 16px 80px; }
  h1 { font-size: 1.6rem; }
}
`

// ─────────────────────────────────────────────────────────────
// 4. HOOKS DATA (lazy-loaders) — stubs Phase 1
// ─────────────────────────────────────────────────────────────
function useJSON(path) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancel = false
    setLoading(true)
    fetch(path)
      .then(r => { if (!r.ok) throw new Error(`${r.status} ${path}`); return r.json() })
      .then(d => { if (!cancel) { setData(d); setLoading(false) } })
      .catch(e => { if (!cancel) { setError(e); setLoading(false) } })
    return () => { cancel = true }
  }, [path])
  return { data, error, loading }
}
const useDeputes  = () => useJSON('/data/deputes.json')
const useScrutins = () => useJSON('/data/scrutins-index.json')

// ─────────────────────────────────────────────────────────────
// 5. ATOMS
// ─────────────────────────────────────────────────────────────
const Btn = ({ children, variant = 'primary', size = 'md', onClick, disabled, type = 'button', style, C }) => {
  const sizes = { sm: { padding: '6px 12px', fontSize: 13 }, md: { padding: '9px 16px', fontSize: 14 }, lg: { padding: '12px 22px', fontSize: 15 } }
  const variants = {
    primary:   { background: C.primary, color: '#fff', border: `1px solid ${C.primary}` },
    secondary: { background: C.secondary, color: '#fff', border: `1px solid ${C.secondary}` },
    ghost:     { background: 'transparent', color: C.text, border: `1px solid ${C.border}` },
    danger:    { background: C.red, color: '#fff', border: `1px solid ${C.red}` },
    link:      { background: 'transparent', color: C.primary, border: '1px solid transparent', padding: 0 }
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{
        ...sizes[size], ...variants[variant],
        borderRadius: 8, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? .5 : 1, transition: 'transform .08s, filter .15s',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        ...style
      }}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.transform = 'scale(.97)' }}
      onMouseUp={e => e.currentTarget.style.transform = 'none'}
      onMouseLeave={e => e.currentTarget.style.transform = 'none'}
    >{children}</button>
  )
}

const Card = ({ children, style, C, padding = 20 }) => (
  <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding, boxShadow: C.shadow, ...style }}>
    {children}
  </div>
)

const KPI = ({ label, value, hint, C }) => (
  <Card C={C} padding={18}>
    <div style={{ fontSize: 12, color: C.muted, textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 500 }}>{label}</div>
    <div style={{ fontFamily: 'Fraunces, serif', fontSize: '1.9rem', fontWeight: 600, color: C.text, marginTop: 4, lineHeight: 1.1 }}>{value}</div>
    {hint && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{hint}</div>}
  </Card>
)

const PageTitle = ({ title, subtitle, right, C }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
    <div>
      <h1 style={{ marginBottom: 4 }}>{title}</h1>
      {subtitle && <p style={{ color: C.muted, margin: 0 }}>{subtitle}</p>}
    </div>
    {right && <div>{right}</div>}
  </div>
)

const Field = ({ label, children, hint, C }) => (
  <label style={{ display: 'block', marginBottom: 16 }}>
    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, color: C.text }}>{label}</div>
    {children}
    {hint && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{hint}</div>}
  </label>
)

const Modal = ({ open, onClose, title, children, C, maxWidth = 560 }) => {
  if (!open) return null
  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        className="fadeUp"
        style={{ background: C.white, borderRadius: 14, padding: 24, width: '100%', maxWidth, maxHeight: '90vh', overflow: 'auto', boxShadow: C.shadowLg }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: C.muted, cursor: 'pointer', padding: 4, lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

const ConfirmDialog = ({ open, title, message, onConfirm, onCancel, C, confirmLabel = 'Confirmer', danger }) => (
  <Modal open={open} onClose={onCancel} title={title} C={C} maxWidth={420}>
    <p style={{ color: C.muted }}>{message}</p>
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
      <Btn variant="ghost" onClick={onCancel} C={C}>Annuler</Btn>
      <Btn variant={danger ? 'danger' : 'primary'} onClick={onConfirm} C={C}>{confirmLabel}</Btn>
    </div>
  </Modal>
)

const Empty = ({ title, message, action, C }) => (
  <Card C={C} style={{ textAlign: 'center', padding: 40 }}>
    <div style={{ fontFamily: 'Fraunces, serif', fontSize: '1.2rem', fontWeight: 600, marginBottom: 6 }}>{title}</div>
    {message && <p style={{ color: C.muted, marginBottom: action ? 16 : 0 }}>{message}</p>}
    {action}
  </Card>
)

const Toggle = ({ checked, onChange, C }) => (
  <button onClick={() => onChange(!checked)}
    style={{
      width: 40, height: 22, borderRadius: 999, position: 'relative', cursor: 'pointer',
      background: checked ? C.primary : C.border, border: 'none', transition: 'background .2s', padding: 0
    }}>
    <span style={{
      position: 'absolute', top: 2, left: checked ? 20 : 2, width: 18, height: 18, borderRadius: '50%',
      background: '#fff', transition: 'left .2s', boxShadow: '0 1px 2px rgba(0,0,0,.2)'
    }}/>
  </button>
)

const Avatar = ({ name, size = 36, color, C }) => {
  const initials = (name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color || C.primaryPale, color: color ? '#fff' : C.primaryDeep,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 600, fontSize: size * 0.4, flexShrink: 0
    }}>{initials}</div>
  )
}

const BadgeVote = ({ vote, C }) => {
  const map = {
    pour:       { label: 'Pour',       bg: C.greenPale,  fg: C.green },
    contre:     { label: 'Contre',     bg: C.redPale,    fg: C.red },
    abstention: { label: 'Abstention', bg: C.yellowPale, fg: C.yellow },
    nonvotant:  { label: 'Non votant', bg: C.sand,       fg: C.muted }
  }
  const v = map[vote] || map.nonvotant
  return <span className="badge" style={{ background: v.bg, color: v.fg, fontWeight: 600 }}>{v.label}</span>
}

const BadgeParti = ({ code, color, C }) => (
  <span className="badge" style={{ background: (color || C.primary) + '22', color: color || C.primary, fontWeight: 600 }}>{code}</span>
)

const Tabs = ({ items, active, onChange, C }) => (
  <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${C.border}`, marginBottom: 20, overflowX: 'auto' }} className="scrollbar">
    {items.map(it => (
      <button key={it.id} onClick={() => onChange(it.id)}
        style={{
          padding: '10px 16px', background: 'none', border: 'none',
          color: active === it.id ? C.primary : C.muted,
          fontWeight: 500, fontSize: 14,
          borderBottom: `2px solid ${active === it.id ? C.primary : 'transparent'}`,
          marginBottom: -1, cursor: 'pointer', whiteSpace: 'nowrap'
        }}>{it.label}</button>
    ))}
  </div>
)

// ─────────────────────────────────────────────────────────────
// 6. UTILITAIRES
// ─────────────────────────────────────────────────────────────
const downloadJSON = (data, filename) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}

const readJSONFile = (file) => new Promise((res, rej) => {
  const r = new FileReader()
  r.onload = e => { try { res(JSON.parse(e.target.result)) } catch (err) { rej(err) } }
  r.onerror = rej
  r.readAsText(file)
})

const formatDate = (iso) => {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) }
  catch { return iso }
}

const slugify = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

// ─────────────────────────────────────────────────────────────
// 7. PAGES
// ─────────────────────────────────────────────────────────────

const StubPage = ({ title, subtitle, C }) => (
  <div className="fadeUp">
    <PageTitle title={title} subtitle={subtitle} C={C} />
    <Empty
      title="Bientôt disponible"
      message="Cette page sera livrée dans une prochaine phase. Le squelette est prêt à l'accueillir."
      C={C}
    />
  </div>
)

const PageMonCoin = ({ profile, C }) => (
  <div className="fadeUp">
    <PageTitle
      title={`Bonjour${profile.prenom ? ` ${profile.prenom}` : ''}.`}
      subtitle="Ton tableau de bord politique, près de chez toi."
      C={C}
    />
    <Empty
      title="Données légis 17 en cours de chargement"
      message="Le pipeline data sera branché au Bloc C. En attendant, va dans Réglages pour personnaliser ton profil."
      C={C}
    />
  </div>
)

const PageReglages = ({ profile, setProfile, expert, setExpert, dark, setDark, C }) => {
  const [confirmReset, setConfirmReset] = useState(false)
  const fileRef = React.useRef()

  const onExport = () => {
    downloadJSON({
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      profile, expert, dark
    }, `demos-profil-${new Date().toISOString().slice(0, 10)}.json`)
  }

  const onImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const data = await readJSONFile(file)
      if (data.profile) setProfile(data.profile)
      if (typeof data.expert === 'boolean') setExpert(data.expert)
      if (typeof data.dark === 'boolean') setDark(data.dark)
      alert('Profil importé.')
    } catch (err) {
      alert('Fichier invalide : ' + err.message)
    }
    e.target.value = ''
  }

  const toggleTheme = (id) => {
    setProfile({
      ...profile,
      themes: profile.themes.includes(id)
        ? profile.themes.filter(t => t !== id)
        : [...profile.themes, id]
    })
  }

  const doReset = () => {
    setProfile({ prenom: '', codePostal: '', themes: THEMES_DEFAULT })
    setExpert(false); setDark(false)
    setConfirmReset(false)
  }

  return (
    <div className="fadeUp">
      <PageTitle title="Réglages" subtitle="Ton profil, ton expérience, tes données — sous ton contrôle." C={C} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>

        <Card C={C}>
          <h3 style={{ marginBottom: 16 }}>Profil</h3>
          <Field label="Prénom" C={C}>
            <input value={profile.prenom} onChange={e => setProfile({ ...profile, prenom: e.target.value })} placeholder="Ton prénom" />
          </Field>
          <Field label="Code postal" hint="Pour personnaliser le feed local et identifier ta députée." C={C}>
            <input value={profile.codePostal} onChange={e => setProfile({ ...profile, codePostal: e.target.value })} placeholder="13001" maxLength={5} />
          </Field>
        </Card>

        <Card C={C}>
          <h3 style={{ marginBottom: 16 }}>Apparence & expérience</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
            <div>
              <div style={{ fontWeight: 500 }}>Mode sombre</div>
              <div style={{ fontSize: 13, color: C.muted }}>Confort visuel le soir.</div>
            </div>
            <Toggle checked={dark} onChange={setDark} C={C} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: `1px solid ${C.border}` }}>
            <div>
              <div style={{ fontWeight: 500 }}>Mode expert</div>
              <div style={{ fontSize: 13, color: C.muted }}>Plus de données, tags fins, échiquier multi-dimensions.</div>
            </div>
            <Toggle checked={expert} onChange={setExpert} C={C} />
          </div>
        </Card>

        <Card C={C} style={{ gridColumn: '1 / -1' }}>
          <h3 style={{ marginBottom: 6 }}>Tes thèmes</h3>
          <p style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>Coche les sujets qui t'intéressent. Ils orientent ton feed et tes recommandations.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
            {THEMES.map(t => {
              const on = profile.themes.includes(t.id)
              return (
                <button key={t.id} onClick={() => toggleTheme(t.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    background: on ? C.primaryPale : C.white,
                    border: `1px solid ${on ? C.primary : C.border}`,
                    borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                    color: on ? C.primaryDeep : C.text, fontWeight: on ? 500 : 400,
                    transition: 'all .15s'
                  }}>
                  <span style={{ fontSize: 18 }}>{t.emoji}</span>
                  <span style={{ fontSize: 14 }}>{t.label}</span>
                </button>
              )
            })}
          </div>
        </Card>

        <Card C={C} style={{ gridColumn: '1 / -1' }}>
          <h3 style={{ marginBottom: 6 }}>Tes données</h3>
          <p style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>
            Démos ne stocke rien dans ton navigateur. Exporte ton profil pour le retrouver d'un appareil à l'autre.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn variant="primary" onClick={onExport} C={C}>Exporter mon profil</Btn>
            <Btn variant="ghost" onClick={() => fileRef.current?.click()} C={C}>Importer un profil</Btn>
            <input ref={fileRef} type="file" accept="application/json" onChange={onImport} style={{ display: 'none' }} />
            <Btn variant="danger" onClick={() => setConfirmReset(true)} C={C}>Réinitialiser</Btn>
          </div>
          <div style={{ marginTop: 14, fontSize: 12, color: C.muted }}>Version {APP_VERSION}</div>
        </Card>

      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Réinitialiser le profil ?"
        message="Toutes tes préférences seront effacées. Cette action est immédiate (et locale)."
        confirmLabel="Réinitialiser"
        danger
        onConfirm={doReset}
        onCancel={() => setConfirmReset(false)}
        C={C}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 8. APP ROOT
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [dark, setDark]       = useState(false)
  const [expert, setExpert]   = useState(false)
  const [route, setRoute]     = useState('mon-coin')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [profile, setProfile] = useState({ prenom: '', codePostal: '', themes: THEMES_DEFAULT })

  const C = dark ? C_DARK : C_LIGHT

  // Gestion ?admin=1 (préparé Phase 3)
  const isAdmin = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('admin') === '1'

  const go = useCallback((id) => { setRoute(id); setDrawerOpen(false); window.scrollTo({ top: 0 }) }, [])

  const page = useMemo(() => {
    switch (route) {
      case 'mon-coin':  return <PageMonCoin profile={profile} C={C} />
      case 'mes-elus':  return <StubPage title="Mes élus" subtitle="Annuaire des députés, fiches détaillées, votes et cohérence." C={C} />
      case 'mon-match': return <StubPage title="Mon match" subtitle="20 propositions, 3 niveaux, ton classement avec les partis et les députés." C={C} />
      case 'decrypter': return <StubPage title="Décrypter" subtitle="Échiquier politique, cartes story, méthodologie." C={C} />
      case 'mes-idees': return <StubPage title="Mes idées" subtitle="Interpellation, pétitions locales, associations, conso responsable." C={C} />
      case 'reglages':  return <PageReglages
        profile={profile} setProfile={setProfile}
        expert={expert} setExpert={setExpert}
        dark={dark} setDark={setDark}
        C={C} />
      default: return null
    }
  }, [route, profile, expert, dark, C])

  return (
    <>
      <style>{G(C)}</style>

      <div className="app-layout">

        {/* SIDEBAR DESKTOP */}
        <aside className="app-sidebar" style={{
          background: C.sand, borderRight: `1px solid ${C.border}`,
          padding: '24px 16px', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '0 8px 24px' }}>
            <span style={{ fontFamily: 'Fraunces, serif', fontSize: '1.7rem', fontWeight: 600, color: C.primary, lineHeight: 1 }}>Démos</span>
            <span style={{ fontSize: 11, color: C.muted }}>β</span>
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {NAVS.map(n => (
              <button key={n.id} onClick={() => go(n.id)}
                style={{
                  textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: 'none',
                  background: route === n.id ? C.white : 'transparent',
                  color: route === n.id ? C.primary : C.text,
                  fontWeight: route === n.id ? 500 : 400, fontSize: 14,
                  boxShadow: route === n.id ? C.shadow : 'none',
                  cursor: 'pointer', transition: 'all .15s'
                }}>{n.label}</button>
            ))}
          </nav>
          {isAdmin && (
            <div style={{ marginTop: 24, padding: 10, background: C.yellowPale, color: C.yellow, borderRadius: 8, fontSize: 12, fontWeight: 500 }}>
              Mode admin actif
            </div>
          )}
          <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, fontSize: 11, color: C.muted }}>
            La politique, sans filtre.
          </div>
        </aside>

        {/* TOPBAR MOBILE */}
        <header className="app-topbar" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', background: C.sand, borderBottom: `1px solid ${C.border}`,
          position: 'sticky', top: 0, zIndex: 50
        }}>
          <span style={{ fontFamily: 'Fraunces, serif', fontSize: '1.4rem', fontWeight: 600, color: C.primary }}>Démos</span>
          <button onClick={() => setDrawerOpen(true)}
            style={{ background: 'none', border: 'none', padding: 8, cursor: 'pointer', color: C.text }} aria-label="Menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6"  x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        </header>

        {/* DRAWER MOBILE */}
        {drawerOpen && (
          <div onClick={() => setDrawerOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 99 }}>
            <div onClick={e => e.stopPropagation()}
              style={{
                position: 'absolute', top: 0, right: 0, bottom: 0, width: 280,
                background: C.bg, padding: '24px 16px', boxShadow: C.shadowLg,
                animation: 'fadeUp .25s ease'
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <span style={{ fontFamily: 'Fraunces, serif', fontSize: '1.4rem', fontWeight: 600, color: C.primary }}>Démos</span>
                <button onClick={() => setDrawerOpen(false)} style={{ background: 'none', border: 'none', fontSize: 24, color: C.muted, cursor: 'pointer' }}>×</button>
              </div>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {NAVS.map(n => (
                  <button key={n.id} onClick={() => go(n.id)}
                    style={{
                      textAlign: 'left', padding: '12px 14px', borderRadius: 8, border: 'none',
                      background: route === n.id ? C.white : 'transparent',
                      color: route === n.id ? C.primary : C.text,
                      fontWeight: route === n.id ? 500 : 400, fontSize: 15,
                      cursor: 'pointer'
                    }}>{n.label}</button>
                ))}
              </nav>
            </div>
          </div>
        )}

        {/* MAIN */}
        <main className="app-main">{page}</main>

      </div>
    </>
  )
}
