#!/usr/bin/env node
/**
 * construire-lieux-france.mjs — FABRIQUE le référentiel des lieux de naissance (Story 5.3, T2).
 *
 * ── POURQUOI UN SCRIPT, ET PAS UNE LISTE ÉCRITE ────────────────────────────────────────────────
 *
 * Une longitude fausse de 2° décale l'ascendant de ~2° : plausible, invérifiable, faux. C'est la
 * règle Chiron (`lib/astro/adapters/astronomy-engine.ts`) appliquée à la géographie — sauf qu'ici,
 * contrairement à Chiron, une source publique EXISTE. Aucune coordonnée de ce dépôt n'est donc
 * écrite de mémoire, ni par un humain, ni par un modèle : elles viennent toutes d'ici.
 *
 * SOURCE : `geo.api.gouv.fr`, l'API géographique de l'État — données INSEE (Code officiel
 * géographique) et IGN, sous **Licence Ouverte Etalab 2.0** (réutilisation libre, attribution).
 *
 * ── USAGE ──────────────────────────────────────────────────────────────────────────────────────
 *
 *     node scripts/construire-lieux-france.mjs
 *
 * Écrit `lib/astro/adapters/communes-france.json`. À rejouer quand le Code officiel géographique
 * bouge (fusions de communes) — jamais à éditer à la main.
 *
 * ── CE QUE LE FICHIER NE CONTIENT PAS ──────────────────────────────────────────────────────────
 *
 * Aucun fuseau horaire. Le fuseau se DÉDUIT du code INSEE (`lib/astro/lieux.ts`), pour une raison
 * de vérifiabilité : une table de fuseaux figée dans un fichier de données ne peut être contrôlée
 * par personne, alors qu'une table dans le code est confrontée à la base de fuseaux de la
 * plateforme par `tests/lieux.test.ts`.
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SOURCE =
  "https://geo.api.gouv.fr/communes?fields=nom,code,centre&format=json&geometry=centre";
const SORTIE = resolve(process.cwd(), "lib/astro/adapters/communes-france.json");

const reponse = await fetch(SOURCE);
if (!reponse.ok) {
  throw new Error(`geo.api.gouv.fr a répondu ${reponse.status} — rien n'a été écrit.`);
}
const brut = await reponse.json();
if (!Array.isArray(brut) || brut.length < 30000) {
  // Une réponse tronquée produirait un référentiel silencieusement amputé : des femmes nées dans
  // une commune réelle ne la trouveraient pas, et personne ne saurait pourquoi.
  throw new Error(`réponse inattendue (${brut?.length} entrées) — rien n'a été écrit.`);
}

/** `[nom, codeInsee, latitude, longitude]` — 4 décimales ≈ 11 m, très au-delà du besoin. */
const communes = brut
  .filter((c) => c?.nom && c?.code && Array.isArray(c?.centre?.coordinates))
  .map((c) => [
    c.nom,
    c.code,
    Math.round(c.centre.coordinates[1] * 1e4) / 1e4,
    Math.round(c.centre.coordinates[0] * 1e4) / 1e4,
  ])
  .sort((a, b) => String(a[1]).localeCompare(String(b[1])));

if (communes.length !== brut.length) {
  throw new Error(`${brut.length - communes.length} communes sans centroïde — rien n'a été écrit.`);
}

writeFileSync(
  SORTIE,
  JSON.stringify({
    source: SOURCE,
    licence: "Licence Ouverte / Open Licence 2.0 (Etalab) — données INSEE / IGN",
    genere_par: "scripts/construire-lieux-france.mjs",
    format: "[nom, codeInsee, latitude, longitude]",
    communes,
  }) + "\n",
);

console.info(`${communes.length} communes écrites dans ${SORTIE}`);
