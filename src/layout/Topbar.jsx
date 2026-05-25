import React from 'react'

export default function Topbar({ onMenu, C }) {
  return (
    <header className="app-topbar">
      <span style={{ fontFamily: 'Fraunces, serif', fontSize: '1.4rem', fontWeight: 600, color: C.primary }}>Démos</span>
      <button onClick={onMenu} aria-label="Menu"
        style={{ background: 'none', border: 'none', padding: 8, cursor: 'pointer', color: C.text }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6"  x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
    </header>
  )
}
