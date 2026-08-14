import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { tierPour, modelePour } from "@/lib/ai/politique-tier";
import type { CapaciteIa, TierIa } from "@/lib/ai/port";

/**
 * ⚠️ LE SEUL ENDROIT DU DÉPÔT QUI EXHAUSTE `CapaciteIa` — et c'est `tsc` qui le fait respecter, pas
 * une assertion. Ajouter une capacité sans lui donner de tier ICI ne compile pas.
 *
 * Sans cette table, une capacité neuve hériterait silencieusement du repli `=== "echange" ? …` —
 * c'est-à-dire qu'elle serait tranchée par accident. C'est exactement le défaut que la Story 5.5 a
 * refusé pour `hypothese_enneagramme` : « fort » par héritage se lit comme « fort » par décision, et
 * personne ne s'aperçoit de la différence tant que le repli ne bouge pas.
 */
const TIER_ATTENDU: Record<CapaciteIa, TierIa> = {
  echange: "leger",
  reconceptualisation: "fort",
  synthese: "fort",
  detection: "fort",
  retour_theme: "fort",
  hypothese_enneagramme: "fort",
  // Story 5.8 — la lecture reprend SES mots dans un document qu'elle relira dans un an. Un modèle
  // léger qui la paraphrase de travers laisse une trace écrite, pas une phrase oubliée.
  lecture: "fort",
};

/**
 * Story 2.2 — la politique de tier UNIQUE `(capacité, niveau_sécurité) → tier` (AD-5, AC4).
 *
 * Invariant dur : dès `niveau_sécurité ≥ 1`, le modèle FORT est forcé pour TOUTE capacité
 * (détection ET réponse de détresse — jamais le léger, en aucune circonstance). Contrôle
 * positif + négatif (non tautologique). La garde `>= 1` est mutation-testée (Task A7).
 */
describe("Politique de tier — (capacité, niveau_sécurité) → tier (AD-5)", () => {
  it("niveau 0 : échange → léger", () => {
    expect(tierPour("echange", 0)).toBe("leger");
  });

  it("niveau 0 : reconceptualisation → fort", () => {
    expect(tierPour("reconceptualisation", 0)).toBe("fort");
  });

  it("niveau 0 : synthèse → fort", () => {
    expect(tierPour("synthese", 0)).toBe("fort");
  });

  it("niveau par défaut (absent) = 0 : échange → léger", () => {
    expect(tierPour("echange")).toBe("leger");
  });

  it("DÉTRESSE : niveau ≥ 1 force le FORT pour TOUTE capacité (jamais le léger)", () => {
    for (const niveau of [1, 2, 3] as const) {
      expect(tierPour("echange", niveau), `echange@${niveau}`).toBe("fort");
      expect(tierPour("reconceptualisation", niveau), `reconc@${niveau}`).toBe("fort");
      expect(tierPour("synthese", niveau), `synth@${niveau}`).toBe("fort");
    }
  });

  it("DÉTECTION (§5) : la capacité `detection` force le FORT pour TOUT niveau, y compris 0 (AD-5, NFR-012)", () => {
    // La détection ne peut PAS dépendre du niveau qu'elle est justement en train de calculer :
    // elle doit résoudre le FORT inconditionnellement, jamais le léger, en aucune circonstance.
    for (const niveau of [0, 1, 2, 3] as const) {
      expect(tierPour("detection", niveau), `detection@${niveau}`).toBe("fort");
    }
    expect(tierPour("detection")).toBe("fort"); // niveau par défaut absent
    expect(tierPour("detection", 0)).not.toBe("leger"); // contrôle négatif explicite
  });

  it("[EXHAUSTIF] chaque capacité déclarée reçoit le tier attendu, à niveau 0", () => {
    for (const [capacite, tier] of Object.entries(TIER_ATTENDU) as [CapaciteIa, TierIa][]) {
      expect(tierPour(capacite, 0), capacite).toBe(tier);
    }
  });

  it("HYPOTHÈSE D'ENNÉAGRAMME (5.5) : FORT à tout niveau — l'objet touche à l'identité", () => {
    // Contrôle NÉGATIF explicite : c'est la seule forme qui distingue « fort par décision » de
    // « fort par héritage du repli ». Le mutant visé est le retrait de la ligne dédiée dans
    // `politique-tier` — il reste vert ici, et c'est pourquoi la garde qui compte est le test de
    // SOURCE (`tests/enneagramme-hypothese.test.ts`), pas celui-ci.
    for (const niveau of [0, 1, 2, 3] as const) {
      expect(tierPour("hypothese_enneagramme", niveau), `hypothese@${niveau}`).toBe("fort");
    }
    expect(tierPour("hypothese_enneagramme")).toBe("fort");
    expect(tierPour("hypothese_enneagramme", 0)).not.toBe("leger");
  });

  it("⚠️ LES CAPACITÉS SENSIBLES SONT TRANCHÉES DANS LA SOURCE, pas héritées du repli", () => {
    // ── POURQUOI UN TEST DE SOURCE, ICI ET PAS AILLEURS ───────────────────────────────────────
    //
    // Retirer `if (capacite === "lecture") return "fort";` NE CHANGE RIEN au comportement : le repli
    // `capacite === "echange" ? "leger" : "fort"` rend « fort » de toute façon. Aucun test
    // comportemental ne peut donc voir ce mutant — il survit à `tierPour(...)` sous tous les angles,
    // et c'est le survivant assumé de la 5.5.
    //
    // Ce que la ligne explicite protège n'est pas AUJOURD'HUI, c'est DEMAIN : le repli tient à une
    // seule expression, et quiconque la retournerait — pour donner le léger à une capacité bon marché
    // — ferait basculer ces deux-ci avec, sans le voir. « Fort par héritage » se lit exactement comme
    // « fort par décision », et personne ne s'aperçoit de la différence tant que le repli ne bouge pas.
    //
    // La garde ne peut donc vivre que dans la source. Elle ferme aussi le survivant documenté en 5.5.
    const src = readFileSync(resolve(__dirname, "..", "lib/ai/politique-tier.ts"), "utf-8").replace(
      /\/\/.*$/gm,
      "",
    );
    for (const capacite of ["hypothese_enneagramme", "lecture"] as const) {
      expect(
        src,
        `« ${capacite} » n'est plus tranchée explicitement : elle hérite du repli, et personne ne le verra`,
      ).toMatch(new RegExp(`capacite === "${capacite}"[\\s\\S]{0,40}return "fort"`));
    }
  });

  it("mappe chaque tier vers un id de modèle DATÉ (jamais -latest)", () => {
    expect(modelePour("leger")).toBe("mistral-small-2603");
    expect(modelePour("fort")).toBe("mistral-large-2512");
    expect(modelePour("leger")).not.toMatch(/-latest/);
    expect(modelePour("fort")).not.toMatch(/-latest/);
  });
});
