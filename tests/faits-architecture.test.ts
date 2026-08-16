import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Story 4.2 (T5) — « aucun second chemin d'écriture » (AC4 / AD-18 : propriétaire unique de la forme).
 *
 * Prouvé par lecture de fichiers (commentaires retirés → la garde ne matche pas sa propre prose) :
 *  - l'unique fonction possédée `fusionner_fait_extrait` n'est référencée QUE dans `lib/data/depot-faits.ts` ;
 *  - le NOM DE TABLE `fait_extrait` n'apparaît nulle part dans le PÉRIMÈTRE SCANNÉ (défini ci-dessous).
 *
 * PÉRIMÈTRE SCANNÉ (revue 4.3, C) : `app` + `lib` + `render` + `scripts` (récursif, `.ts/.tsx/.mjs/.js/.jsx`)
 * PLUS les points d'entrée racine exécutés en prod (`proxy.ts` ex-middleware, `instrumentation.ts` s'il existe).
 * On NE dit plus « nulle part / partout » sans qualificatif : la garde couvre le code applicatif ET
 * opérationnel réel (y compris un futur `scripts/purge-*.mjs` en service_role, qui BYPASS la RLS — c'est
 * justement le chemin où la garde CI compte le plus, la base ne rattrapant plus rien).
 *
 * (revue 4.2, C) On garde le NOM DE TABLE plutôt qu'un regex `.from(...).insert` verbe-par-verbe : ce dernier
 * ratait l'indirection par variable (`const T = "fait_extrait"; supabase.from(T)…`), les template literals, et
 * le chaînage multi-ligne. Interdire le nom les attrape TOUS — tout accès (lecture OU écriture) doit le citer.
 * (revue 4.3, F) On ancre sur une FRONTIÈRE DE MOT `\bfait_extrait\b` (pas le nom collé entre quotes) : attrape
 * AUSSI le SQL brut (`from fait_extrait where …`) et le nom qualifié (`"public.fait_extrait"`), tout en excluant
 * les RPC possédées (`fusionner_fait_extrait`/`charger_faits_actifs` : `fait`/`faits` y est précédé de `_`, pas
 * de frontière) et la colonne `p_extrait_source`.
 *
 * (Story 4.3) La « future lecture » que ce commentaire anticipait est arrivée — le rappel opportun LIT les
 * faits actifs. On l'a HONORÉE SANS AFFAIBLIR le ban : la lecture passe par une fonction POSSÉDÉE
 * `charger_faits_actifs()` (security invoker, filtre `statut='actif'` en base), pas par `.from("fait_extrait")`.
 * Résultat : le nom de table reste banni dans tout le périmètre, et on ajoute juste une seconde RPC possédée
 * confinée à son dépôt (`charger_faits_actifs` ↔ `depot-rappel.ts`, comme `fusionner_fait_extrait` ↔ `depot-faits.ts`).
 *
 * Résidu connu (partagé, dette transverse aux ~7 gardes de source) : un nom construit dynamiquement
 * (`"fait_" + "extrait"`) échapperait — pathologique, non traité ; le vrai rempart reste en base
 * (trigger + clause WHERE + write-gate + filtre de lecture, tous mutation-vérifiés).
 */

const racine = process.cwd();

function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
function lire(f: string): string {
  return sansCommentaires(readFileSync(f, "utf-8"));
}
function fichiersSource(dir: string): string[] {
  return (readdirSync(resolve(racine, dir), { recursive: true, encoding: "utf-8" }) as string[])
    .filter((f) => /\.(ts|tsx|mjs|js|jsx)$/.test(f))
    .map((f) => resolve(racine, dir, f));
}
// Points d'entrée racine exécutés en prod (hors app/lib/render) : proxy.ts (ex-middleware), instrumentation.ts.
const racineEntrees = ["proxy.ts", "instrumentation.ts"].map((f) => resolve(racine, f)).filter((p) => existsSync(p));

const DEPOT = resolve(racine, "lib/data/depot-faits.ts");
const DEPOT_RAPPEL = resolve(racine, "lib/data/depot-rappel.ts");
// (Story 6.5) la LECTURE possédée de l'ÉCRAN « ce qu'Anam retient » — confinée à son dépôt, elle aussi.
const DEPOT_MEMOIRE = resolve(racine, "lib/data/lire-memoire.ts");
/**
 * (Story 6.6) L'INVENTAIRE D'EXPORT — la seule exclusion de cette garde, et elle se PROUVE.
 *
 * Il NOMME les 35 tables du schéma pour leur attribuer un verdict d'export ; c'est sa raison d'être
 * (`tests/export-inventaire.test.ts` : toute table sans verdict casse le build). Il n'en ACCÈDE
 * aucune, et il ne le peut pas : il vit dans `lib/domain/`, où `arc-architecture.test.ts` interdit
 * déjà tout import runtime de `@supabase` et de `@/lib/data` (AD-1). Le test ci-dessous re-mesure
 * cette impossibilité ICI plutôt que de faire confiance à l'exclusion.
 */
const INVENTAIRE = resolve(racine, "lib/domain/inventaire-export.ts");
const tousSource = [
  ...fichiersSource("app"),
  ...fichiersSource("lib"),
  ...fichiersSource("render"),
  ...fichiersSource("scripts"),
  ...racineEntrees,
];

const RPC = /fusionner_fait_extrait/;
// (Story 4.3) la LECTURE possédée des faits actifs — confinée à son dépôt, comme la RPC d'écriture.
const RPC_LECTURE = /charger_faits_actifs/;
// (Story 6.5) `charger_faits_retenus` : `faits` y est précédé de `_`, donc pas de frontière avant
// `fait` — le littéral de table ne la confond pas avec un accès direct.
const RPC_MEMOIRE = /charger_faits_retenus/;
// (revue 4.3, F) FRONTIÈRE DE MOT : attrape le nom nu ("fait_extrait"), le SQL brut (from fait_extrait),
// le qualifié ("public.fait_extrait") — mais PAS `fusionner_fait_extrait`/`charger_faits_actifs` (précédés
// de `_`, donc pas de frontière avant `fait`/`faits`) ni `p_extrait_source`.
const TABLE_LITERAL = /\bfait_extrait\b/;

describe("fait_extrait — un seul chemin d'écriture possédé (T5/AC4)", () => {
  it("a bien scanné du code applicatif", () => {
    expect(tousSource.length).toBeGreaterThan(10);
  });

  it("la RPC de merge `fusionner_fait_extrait` n'est référencée QUE dans lib/data/depot-faits.ts", () => {
    for (const f of tousSource) {
      if (f === DEPOT) continue;
      expect(lire(f), `réf. à fusionner_fait_extrait hors depot-faits : ${f}`).not.toMatch(RPC);
    }
    // Contrôle positif : le dépôt, lui, l'appelle bien → la garde n'est pas vide.
    expect(lire(DEPOT)).toMatch(RPC);
  });

  it("le nom de table `fait_extrait` n'apparaît nulle part dans le périmètre (tout accès passe par une RPC possédée)", () => {
    for (const f of tousSource) {
      if (f === INVENTAIRE) continue; // voir l'exclusion prouvée ci-dessous
      expect(lire(f), `accès direct à la table fait_extrait (contourne le merge/la lecture) : ${f}`).not.toMatch(TABLE_LITERAL);
    }
    // Contrôles positifs : le regex DOIT matcher toutes les formes d'accès (nu, backtick, SQL brut, qualifié).
    expect('supabase.from("fait_extrait")').toMatch(TABLE_LITERAL);
    expect("supabase.from(`fait_extrait`)").toMatch(TABLE_LITERAL);
    expect("`select * from fait_extrait where id=${x}`").toMatch(TABLE_LITERAL); // (revue 4.3, F) SQL brut
    expect('"public.fait_extrait"').toMatch(TABLE_LITERAL); // (revue 4.3, F) nom qualifié
    // Contrôles négatifs : les RPC possédées et la colonne ne sont PAS des accès table (frontière de mot).
    expect('rpc("fusionner_fait_extrait")').not.toMatch(TABLE_LITERAL);
    expect('rpc("charger_faits_actifs")').not.toMatch(TABLE_LITERAL);
    expect("p_extrait_source").not.toMatch(TABLE_LITERAL);
  });

  it("(Story 6.6) L'EXCLUSION SE PROUVE : l'inventaire NOMME la table, il ne peut pas y accéder", () => {
    // Une exclusion non prouvée est un trou. Celle-ci est mesurée à chaque exécution : le fichier
    // n'importe rien qui sache parler à une base, et il n'écrit aucun verbe d'accès. Le jour où
    // quelqu'un y ajoutera un client Supabase, c'est cette assertion qui rougira — pas le silence.
    const src = lire(INVENTAIRE);
    expect(src, "l'inventaire cite bien les tables — sinon l'exclusion ne sert à rien").toMatch(TABLE_LITERAL);
    expect(src, "l'inventaire a gagné un accès base").not.toMatch(
      /@supabase|@\/lib\/data|createClient|\.from\(|\.rpc\(|SupabaseClient/,
    );
  });

  it("(Story 6.5) la RPC de lecture `charger_faits_retenus` n'est référencée QUE dans lib/data/lire-memoire.ts", () => {
    // ⚠️ CETTE GARDE A ROUGI PENDANT L'ÉCRITURE DE LA 6.5, et elle avait raison. La première version
    // de `lire-memoire.ts` écrivait `.from("fait_extrait")` : c'eût été le TROISIÈME chemin d'accès à
    // une table art. 9, et le premier hors de tout contrôle. Sur une table pareille, ce que la
    // fonction possédée achète est concret — la FORME de ce qui sort est décidée en un seul endroit
    // auditable, et aucun appelant ne peut écrire `select("*")`.
    for (const f of tousSource) {
      if (f === DEPOT_MEMOIRE) continue;
      expect(lire(f), `réf. à charger_faits_retenus hors lire-memoire : ${f}`).not.toMatch(RPC_MEMOIRE);
    }
    expect(lire(DEPOT_MEMOIRE), "le dépôt de l'écran ne l'appelle plus").toMatch(RPC_MEMOIRE);
    // Et la frontière de mot tient : la RPC n'est pas lue comme un accès direct à la table.
    expect('rpc("charger_faits_retenus")').not.toMatch(TABLE_LITERAL);
  });

  it("(Story 4.3) la RPC de lecture `charger_faits_actifs` n'est référencée QUE dans lib/data/depot-rappel.ts", () => {
    for (const f of tousSource) {
      if (f === DEPOT_RAPPEL) continue;
      expect(lire(f), `réf. à charger_faits_actifs hors depot-rappel : ${f}`).not.toMatch(RPC_LECTURE);
    }
    // Contrôle positif : le dépôt de rappel l'appelle bien → la garde n'est pas vide.
    expect(lire(DEPOT_RAPPEL)).toMatch(RPC_LECTURE);
  });
});
