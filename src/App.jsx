import React, { useState, useMemo, useCallback } from 'react'
import { C_LIGHT, C_DARK, G } from './theme.js'
import { NAVS, THEMES_DEFAULT } from './constants.js'
import Sidebar from './layout/Sidebar.jsx'
import Topbar from './layout/Topbar.jsx'
import Drawer from './layout/Drawer.jsx'
import StubPage from './pages/StubPage.jsx'
import PageMonCoin from './pages/PageMonCoin.jsx'
import PageMesElus from './pages/PageMesElus.jsx'
import PageDeputeDetail from './pages/PageDeputeDetail.jsx'
import PageMonMatch from './pages/PageMonMatch.jsx'
import PageReglages from './pages/PageReglages.jsx'
import PageAdminMapping from './pages/PageAdminMapping.jsx'

export default function App() {
  const [dark, setDark]     = useState(false)
  const [expert, setExpert] = useState(false)
  const [route, setRoute]   = useState('mon-coin')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [profile, setProfile] = useState({ prenom: '', codePostal: '', themes: THEMES_DEFAULT })
  const [selectedDeputeId, setSelectedDeputeId] = useState(null)

  const C = dark ? C_DARK : C_LIGHT

  // Modes admin via ?admin=...
  const adminMode = useMemo(() => {
    if (typeof window === 'undefined') return null
    return new URLSearchParams(window.location.search).get('admin')
  }, [])
  const isAdmin = adminMode != null

  const go = useCallback((id) => {
    setRoute(id); setDrawerOpen(false); setSelectedDeputeId(null); window.scrollTo({ top: 0 })
  }, [])

  const selectDepute = useCallback((id) => {
    setSelectedDeputeId(id); window.scrollTo({ top: 0 })
  }, [])

  const page = useMemo(() => {
    if (adminMode === 'mapping') return <PageAdminMapping C={C} />

    if (route === 'mes-elus' && selectedDeputeId) {
      return <PageDeputeDetail deputeId={selectedDeputeId} onBack={() => setSelectedDeputeId(null)} C={C} />
    }
    switch (route) {
      case 'mon-coin':  return <PageMonCoin profile={profile} C={C} />
      case 'mes-elus':  return <PageMesElus onSelectDepute={selectDepute} C={C} />
      case 'mon-match': return <PageMonMatch C={C} />
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
  }, [route, selectedDeputeId, profile, expert, dark, C, selectDepute, adminMode])

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
