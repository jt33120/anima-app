import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Story 4.2 (T5) — « aucun second chemin d'écriture » (AC4 / AD-18 : propriétaire unique de la forme).
 *
 * Prouvé par lecture de fichiers (commentaires retirés → la garde ne matche pas sa propre prose) :
 *  - l'unique fonction possédée `fusionner_fait_extrait` n'est référencée QUE dans `lib/data/depot-faits.ts` ;
 *  - le LITTÉRAL DE TABLE `fait_extrait` (entre quotes/backticks) n'apparaît NULLE PART dans app/lib/render.
 *
 * (revue 4.2, C) On garde le LITTÉRAL DE TABLE plutôt qu'un regex `.from(...).insert` verbe-par-verbe : ce
 * dernier ratait l'indirection par variable (`const T = "fait_extrait"; supabase.from(T)…`), les template
 * literals, et le chaînage multi-ligne. Interdire le littéral les attrape TOUS — tout accès (lecture OU
 * écriture) à la table doit citer son nom quelque part. Aujourd'hui, TOUT passe par la RPC (`depot-faits.ts`
 * n'écrit même pas `.from("fait_extrait")`), donc AUCUN fichier ne cite le littéral : la garde est un
 * tripwire — une future lecture (Story 4.3) ou édition (Epic 6) devra l'assouplir CONSCIEMMENT.
 * Résidu connu (partagé avec le patron `frontiere-serveur.test.ts`) : un nom construit dynamiquement
 * (`"fait_" + "extrait"`) échapperait — pathologique, non traité ; le vrai rempart reste en base
 * (trigger + clause WHERE + write-gate, tous mutation-vérifiés).
 */

const racine = process.cwd();

function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
function lire(f: string): string {
  return sansCommentaires(readFileSync(f, "utf-8"));
}
function fichiersTs(dir: string): string[] {
  return (readdirSync(resolve(racine, dir), { recursive: true, encoding: "utf-8" }) as string[])
    .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
    .map((f) => resolve(racine, dir, f));
}

const DEPOT = resolve(racine, "lib/data/depot-faits.ts");
const tousSource = [...fichiersTs("app"), ...fichiersTs("lib"), ...fichiersTs("render")];

const RPC = /fusionner_fait_extrait/;
// Le NOM DE TABLE nu entre quotes/backticks. Le `["'`]` juste AVANT `fait_extrait` distingue du nom de RPC
// `fusionner_fait_extrait` (où `fait_extrait` est précédé de `_`, jamais d'un délimiteur de chaîne).
const TABLE_LITERAL = /["'`]fait_extrait["'`]/;

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

  it("le littéral de table `fait_extrait` n'apparaît NULLE PART (tout accès passe par la RPC)", () => {
    for (const f of tousSource) {
      expect(lire(f), `accès direct à la table fait_extrait (contourne le merge) : ${f}`).not.toMatch(TABLE_LITERAL);
    }
    // Contrôle positif du regex : il DOIT matcher un vrai littéral (sinon il ne garde rien).
    expect('supabase.from("fait_extrait")').toMatch(TABLE_LITERAL);
    expect('supabase.from(`fait_extrait`)').toMatch(TABLE_LITERAL);
    expect('rpc("fusionner_fait_extrait")').not.toMatch(TABLE_LITERAL); // pas de faux positif sur la RPC
  });
});
