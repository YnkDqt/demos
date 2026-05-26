import React, { useState, useRef, useEffect } from 'react'

/**
 * Rend un texte qui peut contenir des références au glossaire :
 *   [[terme]]              → "terme" cliquable, tooltip = définition du terme
 *   [[terme|libellé]]      → "libellé" cliquable, tooltip = définition du terme
 *
 * Props :
 *   - texte : string
 *   - glossaire : objet { terme: définition }
 *   - C : palette
 *   - inline : si true, pas de marge (défaut false)
 */
export default function GlossText({ texte, glossaire, C, inline = false }) {
  if (!texte) return null

  // Parsing : on découpe le texte autour des [[...]]
  const parts = []
  let lastIdx = 0
  const regex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
  let match
  while ((match = regex.exec(texte)) !== null) {
    if (match.index > lastIdx) parts.push({ type: 'txt', s: texte.slice(lastIdx, match.index) })
    parts.push({ type: 'def', term: match[1].trim(), label: (match[2] || match[1]).trim() })
    lastIdx = match.index + match[0].length
  }
  if (lastIdx < texte.length) parts.push({ type: 'txt', s: texte.slice(lastIdx) })

  return (
    <span style={inline ? {} : { display: 'inline' }}>
      {parts.map((p, i) =>
        p.type === 'txt'
          ? <React.Fragment key={i}>{p.s}</React.Fragment>
          : <GlossTerm key={i} term={p.term} label={p.label} glossaire={glossaire} C={C} />
      )}
    </span>
  )
}

function GlossTerm({ term, label, glossaire, C }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const definition = glossaire?.[term]

  // Ferme au clic ailleurs
  useEffect(() => {
    if (!open) return
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('touchstart', onClick)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('touchstart', onClick)
    }
  }, [open])

  // Si pas de définition trouvée → on affiche le libellé en clair, sans tooltip
  if (!definition) {
    return <span style={{ color: C.text }}>{label}</span>
  }

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        style={{
          background: 'none', border: 'none', padding: 0,
          color: C.primary, fontFamily: 'inherit', fontSize: 'inherit',
          fontWeight: 500, cursor: 'help', textDecoration: 'underline',
          textDecorationStyle: 'dotted', textDecorationColor: C.primaryLight,
          textUnderlineOffset: 3
        }}
        aria-expanded={open}
        aria-label={`Définition de ${term}`}
      >
        {label}
      </button>
      {open && (
        <span style={{
          position: 'absolute', left: 0, top: '130%', zIndex: 60,
          background: C.white, border: `1px solid ${C.border}`,
          borderRadius: 8, padding: '10px 12px', boxShadow: C.shadowLg,
          fontSize: 13, lineHeight: 1.45, color: C.text,
          minWidth: 240, maxWidth: 320, fontWeight: 400,
          textAlign: 'left', textDecoration: 'none',
          whiteSpace: 'normal',
          animation: 'fadeUp .15s ease both'
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.04em', color: C.muted }}>
            {term}
          </div>
          {definition}
        </span>
      )}
    </span>
  )
}
