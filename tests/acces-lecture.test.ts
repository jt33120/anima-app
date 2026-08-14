import { describe, it, expect } from "vitest";
import { accesLecture, type CausesRefus, type AccesLecture } from "@/lib/domain/acces-lecture";

/**
 * acces-lecture.test.ts — L'ORDRE DU REFUS EST UNE GARDE DE SÉCURITÉ (Story 5.8, AC7 · AD-9).
 *
 * ══ CE QUE CE FICHIER PROTÈGE, ET POURQUOI ÇA NE SE RELIT PAS ═══════════════════════════════════
 *
 * AD-9 : « jamais de paywall sur la sécurité ». Traduit ici : une femme en fenêtre de détresse ne
 * doit JAMAIS voir une proposition commerciale parce qu'elle a demandé une lecture.
 *
 * Le manquement est d'une facilité redoutable — il suffit d'écrire les quatre `if` dans l'ordre où
 * on les a pensés (le commerce d'abord, puisque c'est la condition la plus fréquente). Le code
 * compile, tous les cas nominaux passent, et le défaut n'apparaît que chez quelqu'un en détresse. Il
 * ne se rattrape pas par une relecture attentive : il se rattrape par le test ci-dessous, qui met
 * les deux conditions VRAIES EN MÊME TEMPS et exige que la détresse gagne.
 */

const OUVERT: CausesRefus = { consentementDonne: true, barreMinorite: false, detresseActive: false };
const type = (a: AccesLecture) => a.type;

describe("[AC7] le chemin nominal", () => {
  it("tout est en règle et elle est premium → le rituel s'ouvre", () => {
    expect(type(accesLecture(OUVERT, true))).toBe("ouvert");
  });

  it("tout est en règle mais elle n'est pas premium → l'offre", () => {
    expect(type(accesLecture(OUVERT, false))).toBe("offre");
  });
});

describe("[AC7 · AD-9] la détresse passe AVANT le commerce, et c'est l'invariant", () => {
  it("détresse ET non premium → DÉTRESSE, jamais l'offre", () => {
    // ⚠️ LE TEST QUI COMPTE. Les deux conditions sont vraies ; l'ordre des `if` décide seul de ce
    // qu'elle voit. Un paywall ici serait le manquement qu'AD-9 nomme.
    const acces = accesLecture({ ...OUVERT, detresseActive: true }, false);
    expect(acces.type).toBe("detresse");
    expect(acces.type).not.toBe("offre");
  });

  it("détresse ET premium → détresse quand même (le premium n'ouvre rien)", () => {
    expect(type(accesLecture({ ...OUVERT, detresseActive: true }, true))).toBe("detresse");
  });

  it("détresse ET consentement révoqué ET minorité ET non premium → DÉTRESSE", () => {
    // Les quatre causes simultanées : une seule réponse est acceptable. Ce cas n'est pas théorique —
    // une adolescente détectée après coup, dont le consentement a été révoqué par la barrière, et
    // dont l'épisode est ouvert, les réunit toutes.
    const acces = accesLecture(
      { consentementDonne: false, barreMinorite: true, detresseActive: true },
      false,
    );
    expect(acces.type).toBe("detresse");
  });
});

describe("[AC7] les trois autres causes, chacune distinguée", () => {
  it("minorité (hors détresse) → minorité, et pas « consentement »", () => {
    // La minorité passe avant le consentement : proposer à un compte barré de redonner un
    // consentement qui ne débloquerait rien serait une impasse déguisée en chemin.
    const acces = accesLecture({ consentementDonne: false, barreMinorite: true, detresseActive: false }, true);
    expect(acces.type).toBe("minorite");
  });

  it("consentement révoqué (majeure, hors détresse) → consentement", () => {
    expect(type(accesLecture({ ...OUVERT, consentementDonne: false }, true))).toBe("consentement");
  });

  it("consentement révoqué ET non premium → consentement, pas l'offre", () => {
    // Vendre un abonnement à quelqu'un dont on n'a pas le droit de traiter les données est le
    // deuxième ordre à ne pas inverser.
    expect(type(accesLecture({ ...OUVERT, consentementDonne: false }, false))).toBe("consentement");
  });
});

describe("[AC7] les quatre causes sont RÉELLEMENT distinctes (contrôle anti-tautologie)", () => {
  it("les cinq issues sont toutes atteignables", () => {
    // Sans ce contrôle, une implémentation qui rendrait toujours « detresse » passerait la moitié des
    // tests ci-dessus. On exige que chaque branche existe vraiment.
    const issues = new Set([
      type(accesLecture(OUVERT, true)),
      type(accesLecture(OUVERT, false)),
      type(accesLecture({ ...OUVERT, detresseActive: true }, true)),
      type(accesLecture({ ...OUVERT, barreMinorite: true }, true)),
      type(accesLecture({ ...OUVERT, consentementDonne: false }, true)),
    ]);
    expect([...issues].sort()).toEqual(["consentement", "detresse", "minorite", "offre", "ouvert"]);
  });

  it("la fonction est PURE : deux appels identiques rendent la même chose", () => {
    expect(accesLecture(OUVERT, true)).toEqual(accesLecture(OUVERT, true));
  });
});
