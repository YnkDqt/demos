import React from 'react'

export default function Drawer({ open, onClose, navs, route, go, C }) {
  if (!open) return null
  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 99 }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: 280,
          background: C.bg, padding: '24px 16px', boxShadow: C.shadowLg,
          animation: 'fadeUp .25s ease'
        }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontFamily: 'Fraunces, serif', fontSize: '1.4rem', fontWeight: 600, color: C.primary }}>Démos</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 24, color: C.muted, cursor: 'pointer' }}>×</button>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navs.map(n => (
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
  )
}
