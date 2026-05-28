import React from 'react'
import { createPortal } from 'react-dom'

// ─── Btn ──────────────────────────────────────────────────────
export const Btn = ({ children, variant = 'primary', size = 'md', onClick, disabled, type = 'button', style, C }) => {
  const sizes = {
    sm: { padding: '6px 12px', fontSize: 13 },
    md: { padding: '9px 16px', fontSize: 14 },
    lg: { padding: '12px 22px', fontSize: 15 }
  }
  const variants = {
    primary:   { background: C.primary,   color: '#fff',   border: `1px solid ${C.primary}` },
    secondary: { background: C.secondary, color: '#fff',   border: `1px solid ${C.secondary}` },
    ghost:     { background: 'transparent', color: C.text, border: `1px solid ${C.border}` },
    danger:    { background: C.red,       color: '#fff',   border: `1px solid ${C.red}` },
    link:      { background: 'transparent', color: C.primary, border: '1px solid transparent', padding: 0 }
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{
        ...sizes[size], ...variants[variant],
        borderRadius: 8, fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? .5 : 1,
        transition: 'transform .08s, filter .15s',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        ...style
      }}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.transform = 'scale(.97)' }}
      onMouseUp={e => e.currentTarget.style.transform = 'none'}
      onMouseLeave={e => e.currentTarget.style.transform = 'none'}
    >{children}</button>
  )
}

// ─── Card ─────────────────────────────────────────────────────
export const Card = ({ children, style, C, padding = 20 }) => (
  <div style={{
    background: C.white, border: `1px solid ${C.border}`,
    borderRadius: 12, padding, boxShadow: C.shadow, ...style
  }}>{children}</div>
)

// ─── KPI ──────────────────────────────────────────────────────
export const KPI = ({ label, value, hint, C }) => (
  <Card C={C} padding={18}>
    <div style={{ fontSize: 12, color: C.muted, textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 500 }}>{label}</div>
    <div style={{ fontFamily: 'Fraunces, serif', fontSize: '1.9rem', fontWeight: 600, color: C.text, marginTop: 4, lineHeight: 1.1 }}>{value}</div>
    {hint && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{hint}</div>}
  </Card>
)

// ─── PageTitle ────────────────────────────────────────────────
export const PageTitle = ({ title, subtitle, right, C }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
    <div>
      <h1 style={{ marginBottom: 4 }}>{title}</h1>
      {subtitle && <p style={{ color: C.muted, margin: 0 }}>{subtitle}</p>}
    </div>
    {right && <div>{right}</div>}
  </div>
)

// ─── Field ────────────────────────────────────────────────────
export const Field = ({ label, children, hint, C }) => (
  <label style={{ display: 'block', marginBottom: 16 }}>
    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, color: C.text }}>{label}</div>
    {children}
    {hint && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{hint}</div>}
  </label>
)

// ─── Modal ────────────────────────────────────────────────────
export const Modal = ({ open, onClose, title, children, C, maxWidth = 560 }) => {
  if (!open) return null
  return createPortal(
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} className="fadeUp"
        style={{ background: C.white, borderRadius: 14, padding: 24, width: '100%', maxWidth, maxHeight: '90vh', overflow: 'auto', boxShadow: C.shadowLg }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: C.muted, cursor: 'pointer', padding: 4, lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  )
}

// ─── ConfirmDialog ────────────────────────────────────────────
export const ConfirmDialog = ({ open, title, message, onConfirm, onCancel, C, confirmLabel = 'Confirmer', danger }) => (
  <Modal open={open} onClose={onCancel} title={title} C={C} maxWidth={420}>
    <p style={{ color: C.muted }}>{message}</p>
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
      <Btn variant="ghost" onClick={onCancel} C={C}>Annuler</Btn>
      <Btn variant={danger ? 'danger' : 'primary'} onClick={onConfirm} C={C}>{confirmLabel}</Btn>
    </div>
  </Modal>
)

// ─── Empty ────────────────────────────────────────────────────
export const Empty = ({ title, message, action, C }) => (
  <Card C={C} style={{ textAlign: 'center', padding: 40 }}>
    <div style={{ fontFamily: 'Fraunces, serif', fontSize: '1.2rem', fontWeight: 600, marginBottom: 6 }}>{title}</div>
    {message && <p style={{ color: C.muted, marginBottom: action ? 16 : 0 }}>{message}</p>}
    {action}
  </Card>
)

// ─── Toggle ───────────────────────────────────────────────────
export const Toggle = ({ checked, onChange, C }) => (
  <button onClick={() => onChange(!checked)}
    style={{
      width: 40, height: 22, borderRadius: 999, position: 'relative', cursor: 'pointer',
      background: checked ? C.primary : C.border, border: 'none',
      transition: 'background .2s', padding: 0, flexShrink: 0
    }}>
    <span style={{
      position: 'absolute', top: 2, left: checked ? 20 : 2,
      width: 18, height: 18, borderRadius: '50%',
      background: '#fff', transition: 'left .2s', boxShadow: '0 1px 2px rgba(0,0,0,.2)'
    }}/>
  </button>
)

// ─── Avatar ───────────────────────────────────────────────────
export const Avatar = ({ name, size = 36, color, C }) => {
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

// ─── BadgeVote ────────────────────────────────────────────────
export const BadgeVote = ({ vote, C }) => {
  const map = {
    pour:       { label: 'Pour',       bg: C.greenPale,  fg: C.green },
    contre:     { label: 'Contre',     bg: C.redPale,    fg: C.red },
    abstention: { label: 'Abstention', bg: C.yellowPale, fg: C.yellow },
    nonvotant:  { label: 'Non votant', bg: C.sand,       fg: C.muted }
  }
  const v = map[vote] || map.nonvotant
  return <span className="badge" style={{ background: v.bg, color: v.fg, fontWeight: 600 }}>{v.label}</span>
}

// ─── BadgeParti ───────────────────────────────────────────────
export const BadgeParti = ({ code, color, C }) => (
  <span className="badge" style={{ background: (color || C.primary) + '22', color: color || C.primary, fontWeight: 600 }}>{code}</span>
)

// ─── Tabs ─────────────────────────────────────────────────────
export const Tabs = ({ items, active, onChange, C }) => (
  <div className="scrollbar" style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${C.border}`, marginBottom: 20, overflowX: 'auto' }}>
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

// ─── ProgressBar ──────────────────────────────────────────────
// Couleur auto rouge < 33 < orange < 66 < vert.
export const ProgressBar = ({ value, max = 100, C, height = 8 }) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const color = pct < 33 ? C.red : pct < 66 ? C.yellow : C.green
  return (
    <div style={{ width: '100%', height, background: C.sand, borderRadius: height, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width .3s' }}/>
    </div>
  )
}

// ─── Spinner ──────────────────────────────────────────────────
export const Spinner = ({ C, size = 24 }) => (
  <>
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `2px solid ${C.border}`, borderTopColor: C.primary,
      animation: 'spin .8s linear infinite', display: 'inline-block'
    }}/>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </>
)

// ─── ErrorBox ─────────────────────────────────────────────────
export const ErrorBox = ({ message, C }) => (
  <Card C={C} style={{ borderColor: C.red, background: C.redPale }}>
    <div style={{ color: C.red, fontWeight: 500, marginBottom: 4 }}>Erreur de chargement</div>
    <div style={{ fontSize: 13, color: C.text }}>{message}</div>
  </Card>
)
