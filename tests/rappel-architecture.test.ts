import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Story 4.3 (T5) — « le résumé glissant art. 9 n'est accédé que par son dépôt possédé ».
 *
 * Prouvé par lecture de fichiers (commentaires retirés → la garde ne matche pas sa propre prose) :
 * le NOM DE TABLE `resume_glissant` n'apparaît QUE dans `lib/data/depot-rappel.ts` — tout accès (lecture
 * OU écriture) au réceptacle art. 9 doit citer son nom, et il ne le fait qu'au seul endroit possédé sous JWT.
 *
 * PÉRIMÈTRE SCANNÉ (revue 4.3, C) : `app` + `lib` + `render` + `scripts` (récursif, `.ts/.tsx/.mjs/.js/.jsx`)
 * PLUS les points d'entrée racine (`proxy.ts`, `instrumentation.ts` s'il existe) — pas seulement app/lib/render
 * en .ts, sinon un futur `scripts/purge-*.mjs` en service_role (qui BYPASS la RLS) accéderait la table sans
 * être vu. (revue 4.3, F) Ancrage FRONTIÈRE DE MOT `\bresume_glissant\b` : attrape aussi le SQL brut et le
 * nom qualifié. Patron de la garde de table 4.2 (`faits-architecture.test.ts`).
 *
 * Résidu connu (dette transverse aux gardes de source) : un nom construit dynamiquement échapperait
 * (pathologique, non traité) ; le vrai rempart reste en base (RLS + write-gate durci, mutation-vérifiés).
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
const racineEntrees = ["proxy.ts", "instrumentation.ts"].map((f) => resolve(racine, f)).filter((p) => existsSync(p));

const DEPOT_RAPPEL = resolve(racine, "lib/data/depot-rappel.ts");
/**
 * (Story 6.6) L'INVENTAIRE D'EXPORT — même exclusion, même preuve qu'en `faits-architecture.test.ts`.
 * Il NOMME les 35 tables pour leur donner un verdict d'export ; il vit dans `lib/domain/`, où tout
 * import runtime d'infra est déjà interdit (AD-1, `arc-architecture.test.ts`), et l'assertion
 * ci-dessous re-mesure ici qu'il ne sait pas parler à une base.
 */
const INVENTAIRES = ["inventaire-export.ts", "inventaire-effacement.ts"].map((f) =>
  resolve(racine, "lib/domain", f),
);
const tousSource = [
  ...fichiersSource("app"),
  ...fichiersSource("lib"),
  ...fichiersSource("render"),
  ...fichiersSource("scripts"),
  ...racineEntrees,
];

// (revue 4.3, F) FRONTIÈRE DE MOT : attrape le nom nu, le SQL brut, le qualifié — aucun identifiant plus large ici.
const TABLE_LITERAL = /\bresume_glissant\b/;

describe("resume_glissant — accès confiné à son dépôt possédé (T5/AC4)", () => {
  it("a bien scanné du code applicatif", () => {
    expect(tousSource.length).toBeGreaterThan(10);
  });

  it("le nom de table `resume_glissant` n'apparaît QUE dans lib/data/depot-rappel.ts", () => {
    for (const f of tousSource) {
      if (f === DEPOT_RAPPEL || INVENTAIRES.includes(f)) continue;
      expect(lire(f), `accès à la table resume_glissant hors depot-rappel : ${f}`).not.toMatch(TABLE_LITERAL);
    }
    // Contrôle positif : le dépôt de rappel y accède bien → la garde n'est pas vide.
    expect(lire(DEPOT_RAPPEL)).toMatch(TABLE_LITERAL);
    // Contrôles positifs : toutes les formes d'accès (nu, backtick, SQL brut, qualifié).
    expect('supabase.from("resume_glissant")').toMatch(TABLE_LITERAL);
    expect("supabase.from(`resume_glissant`)").toMatch(TABLE_LITERAL);
    expect("`select contenu from resume_glissant where id=${x}`").toMatch(TABLE_LITERAL); // (revue 4.3, F)
    expect('"public.resume_glissant"').toMatch(TABLE_LITERAL); // (revue 4.3, F)
  });

  it("(Stories 6.6/6.7) LES EXCLUSIONS SE PROUVENT : les inventaires NOMMENT les tables, sans pouvoir y accéder", () => {
    for (const inventaire of INVENTAIRES) {
      const src = lire(inventaire);
      expect(src, `${inventaire} ne cite plus la table — l'exclusion ne sert à rien`).toMatch(TABLE_LITERAL);
      expect(src, `${inventaire} a gagné un accès base`).not.toMatch(
        /@supabase|@\/lib\/data|createClient|\.from\(|\.rpc\(|SupabaseClient/,
      );
    }
  });
});
