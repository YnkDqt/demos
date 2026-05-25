import React, { useState, useMemo, useCallback } from 'react'
import { C_LIGHT, C_DARK, G } from './theme.js'
import { NAVS, THEMES_DEFAULT } from './constants.js'
import Sidebar from './layout/Sidebar.jsx'
import Topbar from './layout/Topbar.jsx'
import Drawer from './layout/Drawer.jsx'
import StubPage from './pages/StubPage.jsx'
import PageMonCoin from './pages/PageMonCoin.jsx'
import PageMesElus from './pages/PageMesElus.jsx'
import PageReglages from './pages/PageReglages.jsx'

export default function App() {
  const [dark, setDark]     = useState(false)
  const [expert, setExpert] = useState(false)
  const [route, setRoute]   = useState('mon-coin')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [profile, setProfile] = useState({ prenom: '', codePostal: '', themes: THEMES_DEFAULT })

  const C = dark ? C_DARK : C_LIGHT
  const isAdmin = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('admin') === '1'

  const go = useCallback((id) => {
    setRoute(id); setDrawerOpen(false); window.scrollTo({ top: 0 })
  }, [])

  const page = useMemo(() => {
    switch (route) {
      case 'mon-coin':  return <PageMonCoin profile={profile} C={C} />
      case 'mes-elus':  return <PageMesElus C={C} />
      case 'mon-match': return <StubPage title="Mon match" subtitle="20 propositions, 3 niveaux, ton classement avec les partis et les députés." C={C} />
      case 'decrypter': return <StubPage title="Décrypter" subtitle="Échiquier politique, cartes story, méthodologie." C={C} />
      case 'mes-idees': return <StubPage title="Mes idées" subtitle="Interpellation, pétitions locales, associations, conso responsable." C={C} />
      case 'reglages':  return (
        <PageReglages
          profile={profile} setProfile={setProfile}
          expert={expert} setExpert={setExpert}
          dark={dark} setDark={setDark}
          C={C}
        />
      )
      default: return null
    }
  }, [route, profile, expert, dark, C])

  return (
    <>
      <style>{G(C)}</style>
      <div className="app-layout">
        <Sidebar navs={NAVS} route={route} go={go} isAdmin={isAdmin} C={C} />
        <Topbar onMenu={() => setDrawerOpen(true)} C={C} />
        <main className="app-main">{page}</main>
        <Drawer
          open={drawerOpen} onClose={() => setDrawerOpen(false)}
          navs={NAVS} route={route} go={go} C={C}
        />
      </div>
    </>
  )
}
