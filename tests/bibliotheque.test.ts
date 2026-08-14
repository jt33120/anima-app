import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CATALOGUE_CARTES,
  assemblerBibliotheque,
  cartesDisponibles,
  cleCarteDuJour,
  estPresentable,
  type CarteBibliotheque,
  type CleCarte,
} from "@/lib/domain/bibliotheque";
import { CLES_TERMES, chercherConfusionVocabulaire, terme } from "@/lib/domain/vocabulaire";
import { chercherInterdits } from "@/lib/domain/lexique-interdit";
import { chercherPredictions } from "@/lib/domain/marqueurs-prediction";
import { ecrit, NON_ECRIT } from "@/lib/corpus/port";
import type { JourCivil } from "@/lib/astro/quotidien";

/**
 * bibliotheque.test.ts — LE MODÈLE DE L'ACCUEIL (Story 5.6, T2/T3).
 *
 * Trois choses s'y jouent, et aucune n'est vérifiable à l'œil sur un écran vide :
 *   - l'ORDRE est fixe et la mise en avant ne dépend que du jour (AC1) ;
 *   - aucun champ ne peut porter un badge, un compteur ou un cadenas (AC2, garde STRUCTURELLE) ;
 *   - les trois termes du produit restent distincts (AC3/FR-080).
 */

const JOUR = (a: number, m: number, j: number): JourCivil => ({ a, m, j });

function carte(cle: CleCarte, o: Partial<CarteBibliotheque> = {}): CarteBibliotheque {
  return {
    cle,
    titre: `titre ${cle}`,
    terme: null,
    faits: [],
    texte: NON_ECRIT,
    ...o,
  };
}

/** Une carte qui a quelque chose à montrer (un fait calculé suffit). */
const avecFait = (cle: CleCarte) => carte(cle, { faits: [{ intitule: "Soleil", valeur: "Balance" }] });

const TOUTES = CATALOGUE_CARTES.map((c) => avecFait(c));

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AC2 — la garde est le TYPE
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.6/AC2 DUR] aucun champ ne peut porter une mesure — la garde est structurelle", () => {
  /**
   * ⚠️ POURQUOI PAS UN TEST DE RENDU. La façon spontanée de garder « aucun badge, aucun compteur »
   * serait de balayer le DOM à la recherche d'un chiffre. C'est IMPOSSIBLE ici : la carte des
   * nombres affiche des nombres, celle de l'ennéagramme affiche un type, celle du thème affiche des
   * degrés. Un tel test serait soit vide, soit faux.
   *
   * Donc on garde la SOURCE du type, exactement comme `arbitrage-frontiere` (4.10) garde le type de
   * l'ouverture : s'il n'existe pas de champ où écrire un compte, il n'y a rien à masquer au rendu.
   */
  const source = readFileSync(resolve(__dirname, "..", "lib/domain/bibliotheque.ts"), "utf-8");
  const declaration = source.slice(
    source.indexOf("export interface CarteBibliotheque"),
    source.indexOf("export const CATALOGUE_CARTES"),
  );

  it("[CONTRÔLE DU CONTRÔLE] la déclaration a bien été extraite", () => {
    // Sans ce témoin, tous les refus ci-dessous seraient vrais sur une chaîne vide — le mode
    // d'échec exact d'une garde dont l'extracteur casse (leçon `arbitrage-frontiere`).
    expect(declaration).toContain("readonly cle: CleCarte");
    expect(declaration.length).toBeGreaterThan(200);
  });

  for (const interdit of ["badge", "compte", "compteur", "total", "nombre", "nouveau", "verrouille", "cadenas"]) {
    it(`aucun champ « ${interdit} » sur CarteBibliotheque`, () => {
      expect(
        new RegExp(`readonly\\s+${interdit}\\w*\\s*[?:]`, "i").test(declaration),
        `un champ « ${interdit} » est apparu — FR-031 ne tiendrait plus qu'à la vigilance du rendu`,
      ).toBe(false);
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AC1 — l'ordre fixe et la carte du jour
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.6/AC1] le catalogue est une constante, dans les bornes d'UX-DR-30", () => {
  it("4 à 6 cartes, jamais plus", () => {
    expect(CATALOGUE_CARTES.length).toBeGreaterThanOrEqual(4);
    expect(CATALOGUE_CARTES.length).toBeLessThanOrEqual(6);
  });

  it("l'ordre est celui d'EXPERIENCE.md, et il est gelé", () => {
    expect([...CATALOGUE_CARTES]).toEqual(["mantra", "horoscope", "theme", "nombres", "enneagramme"]);
    expect(Object.isFrozen(CATALOGUE_CARTES)).toBe(true);
  });

  it("aucune clé en double", () => {
    expect(new Set(CATALOGUE_CARTES).size).toBe(CATALOGUE_CARTES.length);
  });
});

describe("[5.6/AC1] la mise en avant ne dépend QUE du jour civil", () => {
  it("[LE TEST QUI COMPTE] la rotation avance d'un cran par jour, et boucle", () => {
    // ⚠️ SANS CE TEST, RIEN NE VERRAIT UNE ROTATION CASSÉE. Tant qu'aucun texte n'est écrit, deux
    // cartes vides sont indiscernables à l'écran — c'est exactement le piège que `cleMantraDuJour`
    // documente en 5.4. « Toujours la première » resterait vert jusqu'à la mise en ligne.
    const vues = [
      cleCarteDuJour(JOUR(2026, 8, 13), TOUTES),
      cleCarteDuJour(JOUR(2026, 8, 14), TOUTES),
      cleCarteDuJour(JOUR(2026, 8, 15), TOUTES),
      cleCarteDuJour(JOUR(2026, 8, 16), TOUTES),
      cleCarteDuJour(JOUR(2026, 8, 17), TOUTES),
    ];
    expect(new Set(vues).size, `la rotation ne bouge pas : ${JSON.stringify(vues)}`).toBe(
      CATALOGUE_CARTES.length,
    );
  });

  it("le même jour rend toujours la même carte (déterminisme)", () => {
    const a = cleCarteDuJour(JOUR(2026, 8, 13), TOUTES);
    const b = cleCarteDuJour(JOUR(2026, 8, 13), TOUTES);
    expect(a).toBe(b);
    // Et le lendemain, ce n'est plus la même.
    expect(cleCarteDuJour(JOUR(2026, 8, 14), TOUTES)).not.toBe(a);
  });

  it("l'ordre d'ARRIVÉE des cartes ne change rien — seul le catalogue ordonne", () => {
    // Le mode d'échec réel : la lecture serveur rend les cartes dans l'ordre où les requêtes
    // reviennent. Si la rotation s'appuyait sur cet ordre, la carte du jour dépendrait de la
    // latence réseau — c'est-à-dire de tout sauf du jour.
    const melangees = [...TOUTES].reverse();
    expect(cleCarteDuJour(JOUR(2026, 8, 13), melangees)).toBe(
      cleCarteDuJour(JOUR(2026, 8, 13), TOUTES),
    );
  });

  it("un jour antérieur à l'époque de rotation ne rend pas `undefined`", () => {
    // `%` garde le signe du dividende en JavaScript : sans le `+ cardinal` d'`indiceDuJour`, un
    // indice négatif donnerait une carte `undefined` sans la moindre erreur.
    expect(cleCarteDuJour(JOUR(1987, 3, 4), TOUTES)).not.toBeUndefined();
    expect(CATALOGUE_CARTES).toContain(cleCarteDuJour(JOUR(1987, 3, 4), TOUTES));
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AC5 — la carte du jour ne tombe jamais sur une carte muette
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.6/AC5] une carte sans rien à montrer n'est jamais mise en avant", () => {
  it("un fait calculé suffit à être présentable ; un texte écrit aussi ; ni l'un ni l'autre, non", () => {
    expect(estPresentable(avecFait("theme"))).toBe(true);
    expect(estPresentable(carte("mantra", { texte: ecrit("Un texte d'Anima.") }))).toBe(true);
    expect(estPresentable(carte("mantra"))).toBe(false);
  });

  it("[LE TEST QUI COMPTE] avec un corpus vide, la rotation évite les deux cartes muettes", () => {
    // C'est l'état RÉEL du produit aujourd'hui : 165 créneaux déclarés, 0 écrit. Le mantra et
    // l'horoscope n'ont aucun fait calculé à montrer — seulement du texte, qui n'existe pas.
    // Sans ce filtre, l'accueil s'ouvrirait DEUX JOURS SUR CINQ sur une carte vide en tête.
    const reelles = [
      carte("mantra"), // rien : le mantra EST son texte
      carte("horoscope"), // rien : des énumérations, pas de la prose
      avecFait("theme"),
      avecFait("nombres"),
      avecFait("enneagramme"),
    ];
    for (let d = 1; d <= 31; d++) {
      const cle = cleCarteDuJour(JOUR(2026, 8, d), reelles);
      expect(["theme", "nombres", "enneagramme"], `le ${d}/08 met en avant « ${cle} »`).toContain(cle);
    }
  });

  it("quand AUCUNE carte n'a rien à montrer, il n'y a pas de carte du jour — et rien ne casse", () => {
    const muettes = CATALOGUE_CARTES.map((c) => carte(c));
    expect(cleCarteDuJour(JOUR(2026, 8, 13), muettes)).toBeNull();
    const b = assemblerBibliotheque(muettes, JOUR(2026, 8, 13));
    expect(b.enAvant).toBeNull();
    // Les cartes restent AFFICHÉES : elles diront honnêtement ce qui manque (AC5). Les masquer
    // cacherait précisément le fait que le corpus est vide.
    expect(b.cartes).toHaveLength(CATALOGUE_CARTES.length);
  });
});

describe("[5.6/AC1] l'assemblage : la carte du jour en tête, le reste au catalogue", () => {
  it("la carte du jour est en première position", () => {
    const b = assemblerBibliotheque(TOUTES, JOUR(2026, 8, 13));
    expect(b.cartes[0].cle).toBe(b.enAvant);
  });

  it("le reste garde EXACTEMENT l'ordre du catalogue", () => {
    const b = assemblerBibliotheque(TOUTES, JOUR(2026, 8, 13));
    const reste = b.cartes.slice(1).map((c) => c.cle);
    const attendu = CATALOGUE_CARTES.filter((c) => c !== b.enAvant);
    expect(reste).toEqual([...attendu]);
  });

  it("aucune carte n'est perdue ni dupliquée par la mise en tête", () => {
    const b = assemblerBibliotheque(TOUTES, JOUR(2026, 8, 13));
    expect(b.cartes).toHaveLength(TOUTES.length);
    expect(new Set(b.cartes.map((c) => c.cle)).size).toBe(TOUTES.length);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AC8 — le socle n'est jamais coupé, et rien n'est construit puis verrouillé
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.6/AC8] la disponibilité RETIRE, elle ne verrouille pas", () => {
  it("les cinq cartes du socle sont servies à un compte GRATUIT (FR-055)", () => {
    expect(cartesDisponibles(TOUTES, false).map((c) => c.cle)).toEqual([...CATALOGUE_CARTES]);
  });

  it("[LE TEST QUI COMPTE] une carte au terme premium disparaît pour un compte gratuit", () => {
    // La 5.9 livrera l'ancrage (premium). On l'exerce ICI avec une carte explicite plutôt que de
    // laisser le filtre non testé jusqu'à ce qu'il compte vraiment — un filtre jamais exercé est
    // un filtre dont personne ne sait s'il mord.
    const premium = carte("mantra", { terme: "ancrage", faits: [{ intitule: "Durée", valeur: "3 min" }] });
    const lot = [...TOUTES.filter((c) => c.cle !== "mantra"), premium];
    expect(cartesDisponibles(lot, false).map((c) => c.cle)).not.toContain("mantra");
    expect(cartesDisponibles(lot, true).map((c) => c.cle)).toContain("mantra");
  });

  it("la disponibilité est DÉRIVÉE du glossaire, jamais d'un drapeau recopié", () => {
    // Si `premium` était un champ de `CarteBibliotheque`, il pourrait contredire le glossaire.
    const source = readFileSync(resolve(__dirname, "..", "lib/domain/bibliotheque.ts"), "utf-8");
    const declaration = source.slice(
      source.indexOf("export interface CarteBibliotheque"),
      source.indexOf("export const CATALOGUE_CARTES"),
    );
    expect(/readonly\s+premium\s*[?:]/.test(declaration)).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// AC3 / FR-080 — les trois termes ne se confondent pas
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.6/AC3 · FR-080] mantra ≠ ancrage ≠ lecture, et c'est la NATURE qui les sépare", () => {
  it("les trois termes sont déclarés, et leurs natures diffèrent deux à deux", () => {
    expect([...CLES_TERMES]).toEqual(["mantra", "ancrage", "lecture"]);
    const m = terme("mantra");
    const a = terme("ancrage");
    // C'est LA ligne que FR-080 trace : le mantra se lit, l'ancrage se fait.
    expect(m.interactif).toBe(false);
    expect(a.interactif).toBe(true);
    // Et celle que FR-055 trace : le socle est gratuit à vie.
    expect(m.premium).toBe(false);
    expect(a.premium).toBe(true);
    expect(terme("lecture").premium).toBe(true);
  });

  it("[LE TEST QUI COMPTE] un texte présenté sous un terme ne nomme pas les autres", () => {
    // Le second chemin de confusion, celui que la garde de nature ne voit pas : la carte est bien
    // étiquetée, mais la PHRASE en dessous promet autre chose.
    expect(chercherConfusionVocabulaire("Ton ancrage du jour", "mantra")).toContain("ancrage");
    expect(chercherConfusionVocabulaire("Reprends ta lecture", "mantra")).toContain("lecture");
    expect(chercherConfusionVocabulaire("Un mantra à faire", "ancrage")).toContain("mantra");
  });

  it("[CONTRÔLE NÉGATIF] un texte qui reste dans son terme ne déclenche rien", () => {
    expect(chercherConfusionVocabulaire("Le mantra du jour", "mantra")).toEqual([]);
    expect(chercherConfusionVocabulaire("Un ancrage de trois minutes", "ancrage")).toEqual([]);
  });

  it("le mantra n'a PAS de durée — lui en donner une en ferait un ancrage", () => {
    expect(terme("mantra").dureeMinutes).toBeNull();
    expect(terme("ancrage").dureeMinutes).toEqual([2, 5]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// FR-023 / FR-053 — ce que le modèle écrit passe les contrôles bloquants
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.6] les libellés du glossaire passent les contrôles de voix", () => {
  it("aucun interdit, aucune prédiction dans les trois libellés", () => {
    for (const cle of CLES_TERMES) {
      const t = terme(cle);
      expect(chercherInterdits(t.libelle), `lexique interdit dans « ${t.libelle} »`).toEqual([]);
      expect(chercherPredictions(t.libelle), `prédiction dans « ${t.libelle} »`).toEqual([]);
    }
  });
});
