import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { chercherInterdits } from "@/lib/domain/lexique-interdit";

/**
 * Story 2.8 (T5) — LE CONTRÔLE AUTOMATISÉ BLOQUANT (AC4 ; Opérations « Tests & CI/CD » point (b)).
 * Scanne TOUT le contenu destiné à l'utilisatrice et rejette le lexique médical (NFR-008), les
 * formulations bannies (FR-085) et « soigner » (FR-023). Un échec ici → `npm test` rouge → build cassé
 * (la CI, `.github/workflows/ci.yml`, exécute ce test). Le lien build → refus de déploiement dépend
 * d'une protection de branche GitHub / Vercel (porte ops, hors dépôt — voir Dev Notes).
 *
 * Robustesse (contre un vert tautologique) :
 *   - DÉCOUVERTE RÉCURSIVE (jamais une liste en dur) → e-mails/bilans/fiches store, dès leur création,
 *     sont scannés automatiquement ;
 *   - EXCLUSION des consignes système (elles contiennent le lexique en instructions INVERSES) ;
 *   - ALLOWLIST des disclaimers légitimes ;
 *   - CONTRÔLE POSITIF (une chaîne connue-mauvaise DOIT être attrapée) + GARDE NON-VACUE.
 */

const racine = process.cwd();

function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
function fichiersTs(dir: string): string[] {
  return (readdirSync(resolve(racine, dir), { recursive: true, encoding: "utf-8" }) as string[])
    .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
    .map((f) => `${dir}/${f}`);
}

// Contenu DESTINÉ À L'UTILISATRICE : app + render + lib, TOUS découverts récursivement (revue 2.8 :
// l'ancienne liste en dur de 3 fichiers lib laissait échapper tout futur module de libellés — ex. un
// bilan.ts de la Story 2.9). Le scan couvre donc désormais toute surface future de lib sans édition ici.

// EXCLUSIONS — deux natures : (a) les consignes système / prompts modèle, qui contiennent
// VOLONTAIREMENT le lexique interdit comme instructions inverses (« tu n'es pas une professionnelle de
// santé », « ne dis jamais je ressens »), jamais renvoyées au client ; (b) le lexique interdit
// lui-même, qui liste tous les termes bannis par construction (il s'auto-matcherait). Les scanner
// produirait des faux positifs par conception.
const EXCLUS = new Set([
  "lib/safety/consigne-detresse.ts",
  "lib/safety/detecteur-detresse.ts",
  "lib/safety/classer-detresse.ts",
  "lib/domain/consigne-phase.ts",
  "lib/domain/signaux-arc.ts",
  "lib/domain/consigne-voix.ts",
  "lib/domain/consigne-bilan.ts", // consigne de génération du bilan (2.9) — lexique en instructions inverses
  "lib/domain/lexique-interdit.ts", // la source des interdits — s'auto-matcherait
]);

// ALLOWLIST — fragments légitimes retirés avant analyse (négations/disclaimers). Le mot nu « médical »
// n'est PAS dans le lexique (la charte bannit les termes cliniques, pas l'adjectif) : rien à allowlister
// pour le disclaimer aujourd'hui. Mécanisme prêt pour les surfaces futures.
const ALLOWLIST: RegExp[] = [];
function retirerAllowlist(src: string): string {
  return ALLOWLIST.reduce((s, motif) => s.replace(motif, " "), src);
}

function cibles(): string[] {
  const rel = [...fichiersTs("app"), ...fichiersTs("render"), ...fichiersTs("lib")];
  return rel.filter((f) => !EXCLUS.has(f));
}

describe("Story 2.8 — contrôle bloquant : garde non-vacue + contrôle positif (jamais tautologique)", () => {
  it("scanne un nombre significatif de surfaces (découverte récursive, non vide)", () => {
    expect(cibles().length, "trop peu de fichiers scannés — la découverte est cassée").toBeGreaterThan(15);
  });

  it("CONTRÔLE POSITIF : une chaîne connue-mauvaise est bien attrapée après le pipeline complet", () => {
    const mauvais = 'const x = "Cette app soigne ton anxiété.";';
    const passe = retirerAllowlist(sansCommentaires(mauvais));
    expect(chercherInterdits(passe).length, "un regex cassé passerait vert : le contrôle ne protégerait rien").toBeGreaterThan(0);
  });

  it("les consignes système EXCLUES seraient bien attrapées si scannées (l'exclusion est nécessaire, pas cosmétique)", () => {
    // Preuve que l'exclusion protège de VRAIS matches : consigne-detresse contient « santé » (négation).
    const consigne = sansCommentaires(readFileSync(resolve(racine, "lib/safety/consigne-detresse.ts"), "utf-8"));
    expect(chercherInterdits(consigne).length, "si cette exclusion sautait, le contrôle deviendrait rouge à tort").toBeGreaterThan(0);
  });
});

describe("Story 2.8 — contrôle bloquant : ZÉRO lexique interdit dans le contenu utilisateur", () => {
  for (const f of cibles()) {
    it(`propre : ${f}`, () => {
      const src = retirerAllowlist(sansCommentaires(readFileSync(resolve(racine, f), "utf-8")));
      const trouvailles = chercherInterdits(src);
      expect(
        trouvailles,
        `lexique interdit dans ${f} : ${JSON.stringify(trouvailles.slice(0, 5))}`,
      ).toEqual([]);
    });
  }
});
