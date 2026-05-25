import React from 'react'

export default function Sidebar({ navs, route, go, isAdmin, C }) {
  return (
    <aside className="app-sidebar">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '0 8px 24px' }}>
        <span style={{ fontFamily: 'Fraunces, serif', fontSize: '1.7rem', fontWeight: 600, color: C.primary, lineHeight: 1 }}>Démos</span>
        <span style={{ fontSize: 11, color: C.muted }}>β</span>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navs.map(n => (
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
  )
}
