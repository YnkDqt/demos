import React, { useRef, useState } from 'react'
import { PageTitle, Card, Btn, Field, Toggle, ConfirmDialog } from '../atoms.jsx'
import { THEMES, THEMES_DEFAULT, APP_VERSION } from '../constants.js'
import { downloadJSON, readJSONFile } from '../utils.js'

export default function PageReglages({ profile, setProfile, expert, setExpert, dark, setDark, C }) {
  const [confirmReset, setConfirmReset] = useState(false)
  const fileRef = useRef()

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', gap: 16 }}>
            <div>
              <div style={{ fontWeight: 500 }}>Mode sombre</div>
              <div style={{ fontSize: 13, color: C.muted }}>Confort visuel le soir.</div>
            </div>
            <Toggle checked={dark} onChange={setDark} C={C} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: `1px solid ${C.border}`, gap: 16 }}>
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
