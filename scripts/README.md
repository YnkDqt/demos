# Scripts de génération des données

Pipeline pull-at-build : on aspire les APIs officielles côté Node, on écrit du JSON statique dans `public/data/`, on commit, Vercel redéploie.

## Commandes

```bash
npm run fetch:deputes    # → public/data/deputes.json
npm run fetch:scrutins   # → public/data/scrutins-index.json + public/data/votes/{id}.json
```

## Sources

- Députés actifs : https://www.data.gouv.fr/datasets/deputes-actifs-de-lassemblee-nationale-informations-et-statistiques
- Scrutins AN : https://data.assemblee-nationale.fr/travaux-parlementaires/votes
- API CIVIX (wrapper) : https://www.data.gouv.fr/dataservices/api-publique-civix
- Classement partis : https://www.chesdata.eu/ + https://manifesto-project.wzb.eu/

## Statut Phase 1

Stubs uniquement. Les vrais fetchs seront implémentés au Bloc C de la Phase 1.

## Phases ultérieures

- Phase 5 : ajout `--legis 14 15 16` pour archives.
- V2 : remplacement par population Supabase.
