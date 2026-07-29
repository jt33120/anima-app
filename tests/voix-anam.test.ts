import { describe, it, expect } from "vitest";
import {
  pointDeCoupe,
  tronquerATroisPhrases,
  absorberDelta,
  etatTroncatureInitial,
} from "@/lib/domain/voix-anam";

/**
 * Story 2.8 (T2) — la TRONCATURE déterministe à 3 phrases (FR-084, cœur PUR AD-1). Réutilise la
 * définition « ponctuation finale » d'`estReponseLongue` (`/[.!?…]+/g` : un groupe consécutif = UNE
 * fin). `pointDeCoupe` renvoie l'index juste après le 3ᵉ groupe SI ce groupe est CLOS (un caractère
 * le suit — sur un flux, on ne coupe pas tant que le groupe peut encore grandir).
 */

describe("Story 2.8 — pointDeCoupe : ne coupe que le 4ᵉ+ (garde le 3ᵉ groupe intact)", () => {
  it("≤ 2 groupes → null (rien à couper)", () => {
    expect(pointDeCoupe("")).toBeNull();
    expect(pointDeCoupe("Une seule phrase.")).toBeNull();
    expect(pointDeCoupe("Deux. Phrases.")).toBeNull();
  });

  it("exactement 3 phrases, rien après le 3ᵉ point → null (on garde tout)", () => {
    expect(pointDeCoupe("Un. Deux. Trois.")).toBeNull();
    expect(tronquerATroisPhrases("Un. Deux. Trois.")).toEqual({ texte: "Un. Deux. Trois.", tronque: false });
  });

  it("4ᵉ phrase commencée → coupe à la fin du 3ᵉ groupe (jette la 4ᵉ)", () => {
    expect(tronquerATroisPhrases("Un. Deux. Trois. Quatre.")).toEqual({ texte: "Un. Deux. Trois.", tronque: true });
    // même une amorce de 4ᵉ phrase (sans ponctuation finale) déclenche la coupe : le 3ᵉ groupe est clos.
    expect(tronquerATroisPhrases("Un. Deux. Trois. Et encore")).toEqual({ texte: "Un. Deux. Trois.", tronque: true });
  });

  it("groupes consécutifs (`?!`, `…`, `...`) comptent pour UNE fin", () => {
    expect(tronquerATroisPhrases("Vraiment ?! Oui. Non. Plus.")).toEqual({
      texte: "Vraiment ?! Oui. Non.",
      tronque: true,
    });
    expect(tronquerATroisPhrases("Un… Deux… Trois… Quatre.")).toEqual({ texte: "Un… Deux… Trois…", tronque: true });
    expect(tronquerATroisPhrases("Un... Deux... Trois... Quatre.")).toEqual({
      texte: "Un... Deux... Trois...",
      tronque: true,
    });
  });

  it("préserve un 3ᵉ groupe multi-caractères en entier (`...` gardé, pas coupé au 1er point)", () => {
    // le 3ᵉ groupe est « ... » : la coupe doit tomber APRÈS les trois points, pas après le premier.
    expect(tronquerATroisPhrases("Un. Deux. Trois... quatre.")).toEqual({
      texte: "Un. Deux. Trois...",
      tronque: true,
    });
  });
});

describe("Story 2.8 — pointDeCoupe : robustesse STREAMING (coupe seulement une fois le 3ᵉ groupe CLOS)", () => {
  it("sur des préfixes croissants, renvoie null tant que le 3ᵉ groupe peut encore grandir", () => {
    // Simule l'accumulation delta-par-delta d'« Un. Deux. Trois... suite ».
    expect(pointDeCoupe("Un. Deux. Trois")).toBeNull(); // 2 groupes
    expect(pointDeCoupe("Un. Deux. Trois.")).toBeNull(); // 3ᵉ groupe « . » en fin → pas encore clos
    expect(pointDeCoupe("Un. Deux. Trois..")).toBeNull(); // le groupe grandit encore
    expect(pointDeCoupe("Un. Deux. Trois...")).toBeNull(); // toujours en fin de chaîne
    // un caractère non-final arrive → le 3ᵉ groupe « ... » est CLOS → on coupe après lui.
    expect(pointDeCoupe("Un. Deux. Trois... s")).toBe("Un. Deux. Trois...".length);
  });

  it("un 4ᵉ groupe ne fait jamais reculer la coupe avant le 3ᵉ", () => {
    const texte = "A. B. C. D. E.";
    const coupe = pointDeCoupe(texte)!;
    expect(texte.slice(0, coupe)).toBe("A. B. C.");
  });
});

describe("Story 2.8 (revue) — pointDeCoupe : queue blanche et décimales ne déclenchent pas de fausse coupe", () => {
  it("3 phrases suivies d'un blanc de fin de flux → PAS de coupe (pas de faux manquement, blanc préservé)", () => {
    expect(pointDeCoupe("A. B. C.\n")).toBeNull();
    expect(pointDeCoupe("Un. Deux. Trois.   ")).toBeNull();
    expect(tronquerATroisPhrases("A. B. C.\n")).toEqual({ texte: "A. B. C.\n", tronque: false });
  });

  it("les points DÉCIMAUX ne comptent pas comme fins de phrase (jamais de coupe au milieu d'un nombre)", () => {
    // « 2.5 3.5 4.5 » = 0 ponctuation finale (points décimaux), donc une seule phrase → pas de coupe.
    expect(pointDeCoupe("2.5 3.5 4.5 sont tes repères, mais le vrai point est ailleurs.")).toBeNull();
    expect(tronquerATroisPhrases("J'ai 2.5 h. Puis 3.5 h. Enfin 4.5 h. Et voilà.")).toEqual({
      texte: "J'ai 2.5 h. Puis 3.5 h. Enfin 4.5 h.",
      tronque: true,
    });
  });
});

describe("Story 2.8 (revue) — absorberDelta : la troncature SUR FLUX, prouvée comportementalement", () => {
  // Rejoue une suite de deltas comme la route, en accumulant l'émis et en s'arrêtant une fois coupé.
  const rejouer = (deltas: string[]) => {
    let etat = etatTroncatureInitial();
    let emis = "";
    let tronque = false;
    for (const d of deltas) {
      const r = absorberDelta(etat, d);
      etat = r.etat;
      emis += r.aEmettre;
      if (r.tronque) tronque = true;
    }
    return { emis, tronque };
  };

  it("≤ 3 phrases fragmentées : émet exactement le texte reçu, sans troncature", () => {
    expect(rejouer(["Un. ", "Deux. ", "Trois."])).toEqual({ emis: "Un. Deux. Trois.", tronque: false });
  });

  it("4ᵉ phrase (même fragment) : coupe à la 3ᵉ, la 4ᵉ jamais émise", () => {
    expect(rejouer(["Un. Deux. ", "Trois. Quatre."])).toEqual({ emis: "Un. Deux. Trois.", tronque: true });
    expect(rejouer(["Un. ", "Deux. ", "Trois. ", "Quatre. ", "Cinq."])).toEqual({
      emis: "Un. Deux. Trois.",
      tronque: true,
    });
  });

  it("groupe « … » à cheval sur deux deltas : coupe seulement une fois le groupe clos", () => {
    // « Un. Deux. Trois » puis « . » puis « . » puis « . suite » — le 3ᵉ groupe grandit avant d'être clos.
    expect(rejouer(["Un. Deux. Trois", ".", ".", ". suite ici"])).toEqual({
      emis: "Un. Deux. Trois...",
      tronque: true,
    });
  });

  it("DRAIN : après la coupe, les deltas suivants n'émettent plus rien (métrage continue côté route)", () => {
    const a = absorberDelta(etatTroncatureInitial(), "Un. Deux. Trois. Quatre.");
    expect(a.tronque).toBe(true);
    expect(a.aEmettre).toBe("Un. Deux. Trois.");
    // un delta APRÈS la coupe : rien émis, état inchangé, pas de nouveau « tronque »
    const b = absorberDelta(a.etat, " Cinq. Six.");
    expect(b.aEmettre).toBe("");
    expect(b.tronque).toBe(false);
    expect(b.etat.termine).toBe(true);
  });
});
