import React from 'react'
import { PageTitle, Empty } from '../atoms.jsx'

export default function PageMonCoin({ profile, C }) {
  return (
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
}
