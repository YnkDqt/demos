#!/usr/bin/env node
/**
 * fetch-scrutins.js
 * Aspire les scrutins + votes individuels de data.assemblee-nationale.fr.
 * Usage: node scripts/fetch-scrutins.js --legis 17
 *
 * Statut : STUB Phase 1 — implémentation au Bloc C.
 */

const args = process.argv.slice(2)
const legisIdx = args.indexOf('--legis')
const legis = legisIdx >= 0 ? args[legisIdx + 1] : '17'

console.log(`[fetch-scrutins] Légis ${legis} — non implémenté (Bloc C).`)
process.exit(0)
