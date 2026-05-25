#!/usr/bin/env node
/**
 * fetch-deputes.js
 *
 * Aspire les députés actifs depuis l'open data de l'Assemblée nationale.
 * Source : data.assemblee-nationale.fr (jeu "AMO10_deputes_actifs_mandats_actifs_organes")
 *
 * Usage : node scripts/fetch-deputes.js --legis 17
 *
 * Sortie : public/data/deputes.json
 *
 * Format de sortie (uniformisé, simple à consommer côté React) :
 * {
 *   legislature: 17,
 *   generatedAt: "2026-05-25T...",
 *   source: "data.assemblee-nationale.fr",
 *   deputes: [
 *     {
 *       id: "PA722114",
 *       nom: "Dupont",
 *       prenom: "Jeanne",
 *       sexe: "F",
 *       dateNaissance: "1980-03-12",
 *       profession: "Avocate",
 *       circo: { dept: "13", numero: "1", libelle: "Bouches-du-Rhône - 1ère circonscription" },
 *       groupe: { id: "PO845484", nom: "Renaissance", code: "REN" },
 *       email: "...",
 *       url: "https://www.assemblee-nationale.fr/dyn/deputes/PA722114"
 *     },
 *     ...
 *   ]
 * }
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import AdmZip from 'adm-zip'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// ─── Args ──────────────────────────────────────────────────────
const args = process.argv.slice(2)
const legisIdx = args.indexOf('--legis')
const legis = legisIdx >= 0 ? parseInt(args[legisIdx + 1], 10) : 17

// AN utilise les chiffres romains dans les URLs (XV, XVI, XVII...)
const ROMAN = { 14: 'XIV', 15: 'XV', 16: 'XVI', 17: 'XVII' }
const roman = ROMAN[legis]
if (!roman) { console.error(`Légis ${legis} non supportée.`); process.exit(1) }

const URLS = legis === 17
  ? [`https://data.assemblee-nationale.fr/static/openData/repository/${legis}/amo/deputes_actifs_mandats_actifs_organes/AMO10_deputes_actifs_mandats_actifs_organes.json.zip`]
  : [
      `https://data.assemblee-nationale.fr/static/openData/repository/${legis}/amo/deputes_actifs_mandats_actifs_organes/AMO10_deputes_actifs_mandats_actifs_organes_${roman}.json.zip`,
      `https://data.assemblee-nationale.fr/static/openData/repository/${legis}/amo/deputes_actifs_mandats_actifs_organes/AMO10_deputes_actifs_mandats_actifs_organes.json.zip`
    ]
const OUT = path.join(ROOT, 'public', 'data', 'deputes.json')

console.log(`[deputes] Légis ${legis} (${roman})`)

// ─── Download ──────────────────────────────────────────────────
let res, finalUrl
for (const u of URLS) {
  console.log(`[deputes] Tentative : ${u}`)
  res = await fetch(u)
  if (res.ok) { finalUrl = u; break }
  console.log(`[deputes]   → HTTP ${res.status}`)
}
if (!res?.ok) { console.error(`[deputes] Aucune URL n'a répondu.`); process.exit(1) }
console.log(`[deputes] ✓ ${finalUrl}`)
const buf = Buffer.from(await res.arrayBuffer())
console.log(`[deputes] ZIP téléchargé : ${(buf.length / 1024 / 1024).toFixed(1)} Mo`)

// ─── Unzip ─────────────────────────────────────────────────────
const zip = new AdmZip(buf)
const entries = zip.getEntries().filter(e => e.entryName.endsWith('.json'))
console.log(`[deputes] ${entries.length} fichiers JSON dans le ZIP`)

// Format AMO10 : un fichier par acteur (acteur/PA*.json) et un par organe (organe/PO*.json).
// On les lit tous et on les regroupe.
const acteurs = []
const organesMap = new Map()

for (const e of entries) {
  const name = e.entryName
  let obj
  try { obj = JSON.parse(zip.readAsText(e)) } catch { continue }

  // Racine fréquente : { acteur: {...} } ou { organe: {...} } selon le type
  if (obj.acteur) {
    acteurs.push(obj.acteur)
  } else if (obj.organe) {
    const id = obj.organe.uid?.['#text'] || obj.organe.uid
    if (id) organesMap.set(id, obj.organe)
  } else if (/^acteur[\/\\]/i.test(name) || /\/PA\d+\.json$/.test(name)) {
    acteurs.push(obj)
  } else if (/^organe[\/\\]/i.test(name) || /\/PO\d+\.json$/.test(name)) {
    const id = obj.uid?.['#text'] || obj.uid
    if (id) organesMap.set(id, obj)
  }
}

console.log(`[deputes] → ${acteurs.length} acteurs, ${organesMap.size} organes`)

// ─── Normalisation ─────────────────────────────────────────────
const uid = (x) => typeof x === 'object' ? (x?.['#text'] || '') : (x || '')

const groupePolitique = (acteur) => {
  // Cherche le mandat dont l'organe pointé est de codeType "GP"
  const mandats = acteur.mandats?.mandat
  if (!mandats) return null
  const list = Array.isArray(mandats) ? mandats : [mandats]
  for (const m of list) {
    const orgRefs = m.organes?.organeRef
    if (!orgRefs) continue
    const refs = Array.isArray(orgRefs) ? orgRefs : [orgRefs]
    for (const r of refs) {
      const org = organesMap.get(r)
      if (org?.codeType === 'GP') {
        return { id: r, nom: org.libelle || '', code: org.libelleAbrege || org.libelleAbrev || '' }
      }
    }
  }
  return null
}

const circoInfo = (acteur) => {
  // On cherche le mandat parlementaire actif (typeOrgane = ASSEMBLEE) avec une election.lieu
  const mandats = acteur.mandats?.mandat
  if (!mandats) return null
  const list = Array.isArray(mandats) ? mandats : [mandats]
  const m = list.find(x => x.typeOrgane === 'ASSEMBLEE' && x.election?.lieu)
  if (!m) return null
  const lieu = m.election.lieu
  return {
    dept: uid(lieu.numDepartement),
    numero: uid(lieu.numCirco),
    libelle: `${uid(lieu.departement)} — ${uid(lieu.numCirco)}${uid(lieu.numCirco) === '1' ? 'ère' : 'e'} circonscription`
  }
}

// Filtre : on garde uniquement les acteurs qui ont effectivement un mandat de député actif
const isDeputeActif = (acteur) => {
  const mandats = acteur.mandats?.mandat
  if (!mandats) return false
  const list = Array.isArray(mandats) ? mandats : [mandats]
  return list.some(m => m.typeOrgane === 'ASSEMBLEE' && !m.dateFin)
}

const deputes = acteurs
  .filter(isDeputeActif)
  .map(a => {
    const ec = a.etatCivil?.ident || {}
    const naissance = a.etatCivil?.infoNaissance?.dateNais
    const id = uid(a.uid)
    return {
      id,
      nom: uid(ec.nom),
      prenom: uid(ec.prenom),
      sexe: uid(ec.civ) === 'Mme' ? 'F' : 'M',
      dateNaissance: uid(naissance) || null,
      profession: uid(a.profession?.libelleCourant) || null,
      circo: circoInfo(a),
      groupe: groupePolitique(a),
      url: `https://www.assemblee-nationale.fr/dyn/${legis}/deputes/${id}`
    }
  })
  .filter(d => d.id && d.nom)
  .sort((a, b) => a.nom.localeCompare(b.nom))

// ─── Write ─────────────────────────────────────────────────────
const out = {
  legislature: legis,
  generatedAt: new Date().toISOString(),
  source: 'data.assemblee-nationale.fr',
  count: deputes.length,
  deputes
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(out, null, 2))
console.log(`[deputes] ✓ ${deputes.length} députés écrits dans ${path.relative(ROOT, OUT)}`)
console.log(`[deputes] Taille : ${(fs.statSync(OUT).size / 1024).toFixed(0)} Ko`)
