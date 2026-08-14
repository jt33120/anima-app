import { describe, it, expect } from "vitest";
import { indiceUniforme, rejouer, csprngSysteme, type SourceAlea } from "@/lib/tirage/alea";

/**
 * tirage-alea.test.ts — LES GARDES BLOQUANTES DE L'UNIFORMITÉ (Story 5.7, AC3 · FR-015, AD-11).
 *
 * ══ POURQUOI LA GARDE PRINCIPALE N'EST PAS LE TEST SUR GRAND N ══════════════════════════════════
 *
 * Le critère d'acceptation du PRD demande un test bloquant sur grand N, et il a raison : un tel test
 * attrape une source morte, un indice figé, un décalage d'un rang. Mais il est STRUCTURELLEMENT
 * AVEUGLE au défaut le plus probable de ce code — le biais de modulo.
 *
 * `mot % 24` sur un mot uniforme de 32 bits n'est pas uniforme : `2**32 = 178 956 970 × 24 + 16`,
 * donc 16 indices sur 24 ont une chance de plus que les 8 autres. L'écart relatif vaut 1,4 · 10⁻⁸.
 * Pour le détecter par un χ², il faudrait de l'ordre de 10¹⁶ tirages — c'est-à-dire jamais.
 *
 * Autrement dit : si l'on s'en tenait au grand N, le mutant `%` SURVIVRAIT à la campagne, et la
 * story serait livrée avec un tirage biaisé et une suite verte. La charge de la preuve est donc
 * inversée : la garde principale est le §1, DÉTERMINISTE, qui interroge la frontière exacte du
 * rejet avec trois mots scriptés. Le grand N reste, au §3, pour ce que lui seul attrape.
 *
 * ══ LES BORNES SONT ÉCRITES EN DUR, ET C'EST INDISPENSABLE ══════════════════════════════════════
 *
 * Deux raisons, toutes deux apprises à leurs dépens ailleurs dans ce dépôt :
 *
 *   1. RECALCULER `limite` DANS LE TEST AVEC LA MÊME FORMULE QUE LA SOURCE serait une tautologie :
 *      le mutant qui change la formule changerait aussi l'attente, et le test resterait vert. Les
 *      trois limites ci-dessous sont donc des CONSTANTES, vérifiées à la main.
 *
 *   2. EMPRUNTER LA BORNE À `TAILLE_JEU` rendrait la garde otage du jeu. Le jour où le jeu passerait
 *      à 32 cartes — une puissance de deux —, `2**32 % 32 = 0`, la zone de rejet deviendrait VIDE,
 *      et un échantillonneur biaisé serait indiscernable d'un échantillonneur correct. Le test
 *      resterait vert en ne prouvant plus rien. Les bornes sont donc 3, 24 et 40, choisies ici.
 */

/** Une source scriptée : rend les mots dans l'ordre, puis refuse d'en inventer un de plus. */
function sourceScriptee(mots: readonly number[]): SourceAlea {
  let i = 0;
  return () => {
    if (i >= mots.length) throw new Error("source scriptée épuisée — le code a consommé trop de mots");
    return mots[i++];
  };
}

// Limites de rejet vérifiées à la main : `2**32 - (2**32 % borne)`.
const LIMITE_3 = 4_294_967_295; // 2**32 % 3 === 1
const LIMITE_24 = 4_294_967_280; // 2**32 % 24 === 16
const LIMITE_40 = 4_294_967_280; // 2**32 % 40 === 16

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 1. LA GARDE PRINCIPALE — la frontière du rejet, mot par mot
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC3] l'échantillonnage par rejet — la garde que le grand N ne peut pas porter", () => {
  it("le dernier mot ACCEPTABLE est accepté, et il donne le dernier indice", () => {
    // `limite - 1` est le plus grand mot de la zone uniforme. Il doit passer, et rendre `borne - 1`.
    expect(indiceUniforme(sourceScriptee([LIMITE_24 - 1]), 24)).toEqual({
      indice: 23,
      graine: "ffffffef",
    });
    expect(indiceUniforme(sourceScriptee([LIMITE_3 - 1]), 3)).toEqual({ indice: 2, graine: "fffffffe" });
    expect(indiceUniforme(sourceScriptee([LIMITE_40 - 1]), 40)).toEqual({ indice: 39, graine: "ffffffef" });
  });

  it("le premier mot de la QUEUE est rejeté, et le mot suivant est consommé", () => {
    // ⚠️ C'EST L'ASSERTION QUI TUE LE MUTANT `%`. Sans rejet, `4294967280 % 24` vaudrait 0 et la
    // fonction rendrait `{ indice: 0, graine: "fffffff0" }` sans jamais toucher au second mot.
    expect(indiceUniforme(sourceScriptee([LIMITE_24, 7]), 24)).toEqual({ indice: 7, graine: "00000007" });
    expect(indiceUniforme(sourceScriptee([LIMITE_3, 5]), 3)).toEqual({ indice: 2, graine: "00000005" });
  });

  it("toute la queue est rejetée, pas seulement son premier mot", () => {
    // 2**32 - 1 est le dernier mot de la queue pour la borne 24 (queue = 16 mots).
    expect(indiceUniforme(sourceScriptee([4_294_967_295, 4_294_967_290, 3]), 24)).toEqual({
      indice: 3,
      graine: "00000003",
    });
  });

  it("la graine rendue est le mot ACCEPTÉ, jamais un mot rejeté", () => {
    // Un journal qui porterait le mot rejeté serait injouable : `rejouer` jetterait dessus.
    const { graine } = indiceUniforme(sourceScriptee([LIMITE_24, 0x0000002a]), 24);
    expect(graine).toBe("0000002a");
    expect(rejouer(graine, 24)).toBe(0x2a % 24);
  });

  it("une borne puissance de deux n'a AUCUNE queue — aucun mot n'est jamais rejeté", () => {
    // Écrit pour que la propriété soit visible plutôt que subie : c'est exactement l'état dans lequel
    // cette garde cesserait de prouver quoi que ce soit si le jeu passait à 32 cartes.
    expect(indiceUniforme(sourceScriptee([4_294_967_295]), 32)).toEqual({ indice: 31, graine: "ffffffff" });
  });
});

describe("[AC2] une source qui n'est pas un CSPRNG 32 bits est refusée bruyamment", () => {
  it("un flottant — la forme exacte que prendrait un `Math.random()` substitué — jette", () => {
    // Sans cette vérification, `0.42 % 24` vaudrait `0.42`, `JEU[0.42]` vaudrait `undefined`, et la
    // faute se manifesterait très loin d'ici sous une forme méconnaissable.
    expect(() => indiceUniforme(() => Math.random(), 24)).toThrow(/entier 32 bits/);
  });

  it("un négatif, un dépassement et un NaN jettent aussi", () => {
    expect(() => indiceUniforme(sourceScriptee([-1]), 24)).toThrow(/entier 32 bits/);
    expect(() => indiceUniforme(sourceScriptee([2 ** 32]), 24)).toThrow(/entier 32 bits/);
    expect(() => indiceUniforme(() => Number.NaN, 24)).toThrow(/entier 32 bits/);
  });

  it("une source en panne (toujours rejetée) rend la main par une erreur, jamais par une boucle infinie", () => {
    expect(() => indiceUniforme(() => LIMITE_24, 24)).toThrow(/en panne/);
  });

  it("une borne invalide jette avant d'avoir consommé le moindre mot", () => {
    expect(() => indiceUniforme(sourceScriptee([1]), 0)).toThrow(/borne invalide/);
    expect(() => indiceUniforme(sourceScriptee([1]), -3)).toThrow(/borne invalide/);
    expect(() => indiceUniforme(sourceScriptee([1]), 2.5)).toThrow(/borne invalide/);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 2. L'AUDIT — une ligne journalisée doit rejouer
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC3] le journal est rejouable, ou ce n'est pas un journal", () => {
  it("rejouer(graine, borne) retrouve l'indice, sur 10 000 tirages réels", () => {
    for (let i = 0; i < 10_000; i += 1) {
      const { indice, graine } = indiceUniforme(csprngSysteme, 24);
      expect(rejouer(graine, 24)).toBe(indice);
    }
  });

  it("⚠️ LA TAILLE DU JEU FAIT PARTIE DE LA PREUVE — rejouer avec une autre borne donne autre chose", () => {
    // C'est le défaut silencieux que `taille_jeu` (colonne journalisée en 0050) prévient : le jour où
    // le jeu passe de 24 à 26 cartes, rejouer les lignes anciennes avec la taille COURANTE rend des
    // cartes fausses, avec assurance. Cette assertion existe pour que la raison d'être de la colonne
    // soit vérifiée, et pas seulement écrite dans un commentaire.
    const graine = "0000001a"; // 26
    expect(rejouer(graine, 24)).toBe(2);
    expect(rejouer(graine, 26)).toBe(0);
    expect(rejouer(graine, 24)).not.toBe(rejouer(graine, 26));
  });

  it("une graine mal formée ou hors domaine JETTE plutôt que de certifier un faux", () => {
    expect(() => rejouer("XYZ", 24)).toThrow(/mal formée/);
    expect(() => rejouer("0000001A", 24)).toThrow(/mal formée/); // majuscules : format non canonique
    expect(() => rejouer("1a", 24)).toThrow(/mal formée/); // non paddé
    // Une graine qui AURAIT DÛ être rejetée : la ligne est incohérente, on ne la valide pas.
    expect(() => rejouer("fffffff0", 24)).toThrow(/aurait dû être rejetée/);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 3. LE GRAND N — pour ce que lui seul attrape
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC3] la distribution est uniforme sur un grand nombre de tirages", () => {
  it("240 000 tirages sur le CSPRNG réel passent un χ² à 24 catégories", () => {
    const BORNE = 24;
    const N = 240_000;
    const comptes = new Array<number>(BORNE).fill(0);
    for (let i = 0; i < N; i += 1) {
      comptes[indiceUniforme(csprngSysteme, BORNE).indice] += 1;
    }

    const attendu = N / BORNE;
    const khi2 = comptes.reduce((acc, c) => acc + ((c - attendu) * (c - attendu)) / attendu, 0);

    // ⚠️ SEUIL VOLONTAIREMENT TRÈS LÂCHE — 60 pour 23 degrés de liberté, soit le quantile ~0,99997.
    //
    // Un χ² à 5 % (seuil ≈ 35,2) rendrait cette suite ROUGE un jour sur vingt sans qu'aucune ligne de
    // code n'ait bougé, et un test qui crie au loup finit désactivé. À 60, la probabilité d'échec
    // fortuit est de l'ordre de 3·10⁻⁵ : la suite peut tourner tous les jours pendant un siècle.
    //
    // Ce que ce seuil laisse passer est assumé et documenté : il n'attrape PAS le biais de modulo
    // (§1 s'en charge), il attrape les fautes grossières — source morte, indice figé, borne fausse,
    // décalage d'un rang.
    expect(khi2, `χ² = ${khi2.toFixed(2)} — comptes : ${comptes.join(", ")}`).toBeLessThan(60);

    // Garde SUR la garde : sans elle, un `comptes` resté à zéro donnerait un χ² de N (énorme, donc
    // rouge) — mais un `attendu` mal calculé pourrait rendre le χ² trivialement nul. On vérifie donc
    // que les 24 catégories ont bien été touchées et que le total est le bon.
    expect(comptes.reduce((a, b) => a + b, 0)).toBe(N);
    expect(comptes.every((c) => c > 0)).toBe(true);
  });

  it("le CSPRNG système rend bien des entiers 32 bits, et pas deux fois le même", () => {
    // Une source figée passerait le §1 (qui la script) mais casserait tout le reste. Assertion
    // grossière et suffisante : 1 000 tirages d'une source figée donneraient 1 valeur distincte.
    const mots = new Set<number>();
    for (let i = 0; i < 1_000; i += 1) {
      const m = csprngSysteme();
      expect(Number.isInteger(m) && m >= 0 && m < 2 ** 32).toBe(true);
      mots.add(m);
    }
    expect(mots.size).toBeGreaterThan(990);
  });
});
