// Palette claire/sombre + styles globaux.
// Toute couleur de l'app PASSE par C. Aucune valeur hardcodée ailleurs.

export const C_LIGHT = {
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

export const C_DARK = {
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

// Styles globaux injectés via <style>{G(C)}</style>
export const G = (C) => `
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

/* ───── Layout desktop par défaut ───── */
.app-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  grid-template-rows: 1fr;
  min-height: 100vh;
}
.app-sidebar {
  background: ${C.sand};
  border-right: 1px solid ${C.border};
  padding: 24px 16px 80px;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}
.app-topbar { display: none; }
.app-main { padding: 32px 40px 80px; max-width: 1280px; width: 100%; }

/* ───── Layout mobile ───── */
@media (max-width: 768px) {
  .app-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
  .app-sidebar { display: none; }
  .app-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    background: ${C.sand};
    border-bottom: 1px solid ${C.border};
    position: sticky;
    top: 0;
    z-index: 50;
  }
  .app-main { padding: 20px 16px 80px; }
  h1 { font-size: 1.6rem; }
  .themes-grid { grid-template-columns: repeat(2, 1fr) !important; }
}
`
