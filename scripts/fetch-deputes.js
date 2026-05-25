#!/usr/bin/env node
/**
 * fetch-deputes.js
 * Aspire les députés actifs depuis data.gouv.fr / open data AN.
 * Usage: node scripts/fetch-deputes.js --legis 17
 *
 * Statut : STUB Phase 1 — implémentation au Bloc C.
 */

const args = process.argv.slice(2)
const legisIdx = args.indexOf('--legis')
const legis = legisIdx >= 0 ? args[legisIdx + 1] : '17'

console.log(`[fetch-deputes] Légis ${legis} — non implémenté (Bloc C).`)
process.exit(0)
