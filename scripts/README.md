# Scripts de génération des données

Pipeline **pull-at-build** : on aspire les ZIP de l'open data AN côté Node,
on écrit du JSON statique dans `public/data/`, on commit, Vercel redéploie.

## Source

`data.assemblee-nationale.fr` — open data officiel de l'Assemblée nationale.

## Commandes

```bash
npm run fetch:deputes    # → public/data/deputes.json (~500 Ko à 1 Mo)
npm run fetch:scrutins   # → public/data/scrutins-index.json + public/data/votes/{numero}.json
npm run fetch:all        # les deux d'affilée
```

## Quand relancer ?

- **Données AN** : pas de cron pour la V1, à relancer manuellement quand tu veux rafraîchir.
- En **V2** : GitHub Action hebdomadaire qui exécute `npm run fetch:all`, commit et push si diff.

## Volume attendu (légis 17)

- `deputes.json` : ~577 députés, < 1 Mo
- `scrutins-index.json` : ~1-3 Mo selon le nombre de scrutins
- `votes/` : un fichier par scrutin, ~40-60 Mo cumulés

## Phases ultérieures

- **Phase 5** : ajouter `--legis 14`, `--legis 15`, `--legis 16` pour archives.
  Les scripts sont déjà paramétrés, il suffit de lancer pour chaque.
- **Migration V2** : remplacement par population Supabase.

## Notes techniques

- Les URLs de l'AN suivent le pattern :
  `https://data.assemblee-nationale.fr/static/openData/repository/{numLegis}/...`
- L'AN nomme ses fichiers avec des chiffres romains (XIV, XV, XVI, XVII).
- Les ZIP contiennent du JSON brut très verbeux ; les scripts normalisent vers un format plat consommable par React.
- `adm-zip` est utilisé pour décompresser sans dépendance native (cross-platform).
