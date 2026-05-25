import React from 'react'
import { PageTitle, Empty } from '../atoms.jsx'

export default function StubPage({ title, subtitle, C }) {
  return (
    <div className="fadeUp">
      <PageTitle title={title} subtitle={subtitle} C={C} />
      <Empty
        title="Bientôt disponible"
        message="Cette page sera livrée dans une prochaine phase. Le squelette est prêt à l'accueillir."
        C={C}
      />
    </div>
  )
}
