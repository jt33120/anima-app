import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  TYPES,
  NIVEAUX,
  estTypeEnneagramme,
  estNiveauReponse,
  scorer,
  conclure,
  itemsManquants,
  type ItemBareme,
  type ReponseItem,
  type TypeEnneagramme,
} from "@/lib/domain/enneagramme";

/**
 * enneagramme-domaine.test.ts — LE CALCUL DU TYPE (Story 5.5, AC1).
 *
 * Les cas sont FABRIQUÉS, jamais tirés d'un jeu de réponses « réaliste ». La leçon est écrite dans
 * les campagnes de mutation des quatre stories précédentes : un cas réel tombe presque toujours dans
 * une ZONE DE COÏNCIDENCE où le mutant et l'original rendent la même chose. Ici, les zones sont
 * partout — des réponses uniformes donnent des scores égaux, et tous les départages se valent.
 */

/** Un barème minimal et EXPLICITE : deux items par type, dix-huit au total. */
const BAREME: readonly ItemBareme[] = TYPES.flatMap((t) => [
  { id: `i${t}a`, type: t },
  { id: `i${t}b`, type: t },
]);

/** Répond `niveau` partout, puis applique les exceptions par item. */
function reponses(niveauParDefaut: 0 | 1 | 2 | 3, exceptions: Record<string, 0 | 1 | 2 | 3> = {}): ReponseItem[] {
  return BAREME.map((i) => ({ itemId: i.id, niveau: exceptions[i.id] ?? niveauParDefaut }));
}

/** Fait gagner `type` sans ambiguïté : tout le monde à 0, lui à 3+3. */
function faireGagner(type: TypeEnneagramme): ReponseItem[] {
  return reponses(0, { [`i${type}a`]: 3, [`i${type}b`]: 3 });
}

describe("[5.5/AC1] les unions sont FERMÉES — rien n'entre par la porte des entiers", () => {
  it("estTypeEnneagramme accepte 1..9 et refuse le reste", () => {
    for (const t of TYPES) expect(estTypeEnneagramme(t), String(t)).toBe(true);
    for (const v of [0, 10, -1, 1.5, "4", null, undefined, NaN, Infinity, [4], { type: 4 }]) {
      expect(estTypeEnneagramme(v), JSON.stringify(v)).toBe(false);
    }
  });

  it("estNiveauReponse accepte 0..3 et refuse le reste", () => {
    for (const n of NIVEAUX) expect(estNiveauReponse(n), String(n)).toBe(true);
    for (const v of [-1, 4, 1.5, "2", null, undefined, true]) {
      expect(estNiveauReponse(v), JSON.stringify(v)).toBe(false);
    }
  });

  it("[CONTRÔLE DU CONTRÔLE] le barème d'épreuve couvre bien les neuf types", () => {
    // Une garde de départage éprouvée sur un barème incomplet ne prouve rien.
    expect(BAREME).toHaveLength(18);
    expect(new Set(BAREME.map((i) => i.type)).size).toBe(9);
  });
});

describe("[5.5/AC1] le score : addition par type, appariement NOMINAL", () => {
  it("[LE CŒUR] chaque type reçoit la somme de SES items, et rien d'autre", () => {
    const s = scorer(reponses(0, { i4a: 2, i4b: 3, i7a: 1 }), BAREME);
    expect(s[4]).toBe(5);
    expect(s[7]).toBe(1);
    expect(s[1]).toBe(0);
  });

  it("[LE TEST QUI COMPTE] réordonner le barème ne change RIEN au résultat", () => {
    // Le mutant visé est l'appariement positionnel. S'il existait, inverser l'ordre du barème
    // décalerait tous les scores — et le type rendu changerait sans qu'aucune donnée ne bouge.
    const rep = reponses(1, { i2a: 3, i2b: 3 });
    const inverse = [...BAREME].reverse();
    expect(scorer(rep, inverse)).toEqual(scorer(rep, BAREME));
    expect(conclure(rep, inverse)).toEqual(conclure(rep, BAREME));
  });

  it("[LE TEST QUI COMPTE] l'ORDRE DES RÉPONSES n'a aucun effet", () => {
    const rep = reponses(1, { i6a: 3, i6b: 2 });
    expect(scorer([...rep].reverse(), BAREME)).toEqual(scorer(rep, BAREME));
  });

  it("une réponse à un item inconnu est ignorée, sans exception", () => {
    const s = scorer([...reponses(0), { itemId: "inexistant", niveau: 3 }], BAREME);
    expect(TYPES.every((t) => s[t] === 0)).toBe(true);
  });

  it("un item répondu DEUX FOIS ne compte qu'une fois — la dernière", () => {
    // Un formulaire qui laisse revenir en arrière produit exactement ça. Additionner les deux
    // ferait gagner le type de la question sur laquelle elle a hésité.
    const s = scorer(
      [...reponses(0), { itemId: "i5a", niveau: 3 }, { itemId: "i5a", niveau: 1 }],
      BAREME,
    );
    expect(s[5]).toBe(1);
  });

  it("le score rendu est GELÉ — personne ne le mute en aval", () => {
    const s = scorer(reponses(1), BAREME);
    expect(Object.isFrozen(s)).toBe(true);
  });
});

describe("[5.5/AC1] le verdict : un type, un refus de trancher, ou un test incomplet", () => {
  it("[LE CŒUR] chacun des neuf types peut être retenu — le calcul n'a pas de favori", () => {
    // Le mutant « rendre toujours le type 1 » (ou l'indexer sur autre chose que les réponses)
    // survivrait à un test qui n'éprouve qu'un seul type. Ici les neuf sont exercés.
    for (const t of TYPES) {
      expect(conclure(faireGagner(t), BAREME), `type ${t}`).toEqual({ statut: "retenu", type: t });
    }
  });

  it("[LE CŒUR] à égalité, le produit REFUSE de trancher et nomme les ex æquo", () => {
    const rep = reponses(0, { i3a: 3, i3b: 3, i8a: 3, i8b: 3 });
    expect(conclure(rep, BAREME)).toEqual({ statut: "indecis", exaequo: [3, 8] });
  });

  it("[LE TEST QUI COMPTE] l'égalité PARFAITE ne rend pas le type 1", () => {
    // C'est le mutant le plus tentant : « le plus petit numéro gagne ». Il est total, il est
    // déterministe, et il range silencieusement vers le type 1 tous ceux qu'on n'a pas su lire.
    const verdict = conclure(reponses(2), BAREME);
    expect(verdict.statut).toBe("indecis");
    expect(verdict.statut === "indecis" && verdict.exaequo).toEqual([...TYPES]);
  });

  it("l'ex æquo se juge sur le SOMMET, pas sur l'ensemble du classement", () => {
    // Deux types à 6, un troisième à 5 : indécis entre les deux premiers, le troisième n'y est pas.
    const rep = reponses(0, { i1a: 3, i1b: 3, i2a: 3, i2b: 3, i9a: 3, i9b: 2 });
    expect(conclure(rep, BAREME)).toEqual({ statut: "indecis", exaequo: [1, 2] });
  });

  it("UN SEUL POINT d'écart suffit à trancher — le refus n'est pas une facilité", () => {
    const rep = reponses(0, { i6a: 3, i6b: 3, i9a: 3, i9b: 2 });
    expect(conclure(rep, BAREME)).toEqual({ statut: "retenu", type: 6 });
  });

  it("[LE CŒUR] un test incomplet ne se score PAS, et dit ce qui manque", () => {
    // Traiter une absence comme un zéro, c'est répondre « pas du tout » à sa place : le type rendu
    // serait celui de son silence.
    const partiel = reponses(2).filter((r) => r.itemId !== "i7a" && r.itemId !== "i7b");
    expect(conclure(partiel, BAREME)).toEqual({ statut: "incomplet", manquants: ["i7a", "i7b"] });
  });

  it("aucune réponse du tout : incomplet, pas un type par défaut", () => {
    const verdict = conclure([], BAREME);
    expect(verdict.statut).toBe("incomplet");
    expect(verdict.statut === "incomplet" && verdict.manquants).toHaveLength(18);
  });

  it("itemsManquants ne compte pas une réponse hors barème comme une réponse", () => {
    const manquants = itemsManquants([{ itemId: "inexistant", niveau: 3 }], BAREME);
    expect(manquants).toHaveLength(18);
  });
});

describe("[5.5/AC1] le déterminisme, exigé par le critère d'acceptation", () => {
  it("le même jeu de réponses rend STRICTEMENT le même verdict, mille fois", () => {
    const rep = reponses(1, { i4a: 3, i4b: 2, i2a: 2 });
    const attendu = conclure(rep, BAREME);
    for (let i = 0; i < 1000; i++) expect(conclure(rep, BAREME)).toEqual(attendu);
  });

  it("le module est PUR — aucune horloge, aucun aléa, aucun accès à l'environnement", () => {
    // Garde de source : la garde d'architecture générale ne couvre pas `lib/domain`.
    const source = readFileSync("lib/domain/enneagramme.ts", "utf-8");
    const sansCommentaires = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(sansCommentaires).not.toMatch(/Math\.random|Date\.now|new Date|process\.env|fetch\(/);
  });
});
