import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
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
//
// ── QUATRE EXCLUSIONS RETIRÉES (revue 4.9, T6-12) ──────────────────────────────────────────────────────
//
// `detecteur-detresse.ts`, `classer-detresse.ts`, `consigne-phase.ts` et `signaux-arc.ts` étaient exclus
// et ne contenaient AUCUN terme interdit — leurs occurrences vivaient toutes en commentaire, donc étaient
// déjà retirées par `sansCommentaires`. Quatre trous gratuits dans le seul contrôle bloquant du produit :
// n'importe lequel de ces quatre fichiers pouvait gagner un terme clinique demain sans qu'une ligne ne
// rougisse. Ils sont désormais scannés comme les autres (et propres).
//
// Le test « CHAQUE exclusion est nécessaire » ci-dessous interdit que cela se reproduise : une entrée
// ajoutée ici doit PROUVER qu'elle protège d'un vrai match.
const EXCLUS = new Set([
  "lib/safety/consigne-detresse.ts",
  "lib/domain/consigne-voix.ts",
  "lib/domain/consigne-bilan.ts", // consigne de génération du bilan (2.9) — lexique en instructions inverses
  "lib/domain/consigne-synthese.ts", // consigne de génération de la synthèse (4.9) — même nature
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

  it("CHAQUE exclusion est nécessaire — aucune n'est là par confort (T6-12)", () => {
    // ── CE TEST NE REGARDAIT QU'UN SEUL FICHIER ─────────────────────────────────────────────────────
    //
    // Il lisait `lib/safety/consigne-detresse.ts`, codé en dur, et concluait sur l'ensemble d'`EXCLUS`.
    // Neuf exclusions, une seule éprouvée : les huit autres pouvaient être devenues inutiles — ou pire,
    // avoir été ajoutées pour faire taire un VRAI match — sans que rien ne le dise. Une exclusion est un
    // trou dans le seul contrôle bloquant du produit ; c'est la dernière chose qu'on doit accorder sur
    // parole.
    //
    // La règle : un fichier n'est exclu que s'il contient RÉELLEMENT du lexique interdit. Le jour où une
    // consigne est réécrite sans terme clinique, son exclusion devient un trou gratuit — et ce test le
    // dit. Mutation-cible : ajouter à `EXCLUS` un fichier propre (le geste exact qu'on veut empêcher).
    for (const fichier of EXCLUS) {
      const src = retirerAllowlist(sansCommentaires(readFileSync(resolve(racine, fichier), "utf-8")));
      expect(
        chercherInterdits(src).length,
        `${fichier} ne contient AUCUN terme interdit : son exclusion ne protège de rien et ouvre un trou`,
      ).toBeGreaterThan(0);
    }
  });

  it("les fichiers exclus EXISTENT — une exclusion périmée est un trou qui ne se voit pas", () => {
    // Un fichier renommé laisse son exclusion derrière lui. Elle ne fait alors plus rien de visible…
    // jusqu'au jour où un nouveau fichier reprend le chemin libéré et se retrouve exclu sans que
    // personne ne l'ait décidé.
    for (const fichier of EXCLUS) {
      expect(existsSync(resolve(racine, fichier)), `${fichier} n'existe plus : exclusion à retirer`).toBe(
        true,
      );
    }
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
