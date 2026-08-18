import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sansCommentaires } from "./_absence";
import { gabaritLegalPour } from "@/lib/courriel/gabarits";
import { dateLimiteResiliation } from "@/lib/domain/date-limite";
import type { Origine } from "@/lib/courriel/origine";
import type { InformationLegale } from "@/lib/courriel/port";

const envoyerInformationLegale = vi.fn(async () => {});
vi.mock("@/lib/courriel/fabrique", () => ({
  creerPortCourriel: () => ({ envoyer: vi.fn(), envoyerInformationLegale, estConfigure: () => true }),
}));
vi.mock("@/lib/data/depot-canal-courriel", () => ({
  creerDepotCanalCourriel: () => ({ adresse: async () => "elle@exemple.fr" }),
}));
const { annoncerReconduction } = await import("@/lib/courriel/reconduction");

/**
 * reconduction-encadre.test.ts — L'INFORMATION AVANT RECONDUCTION PORTE ENFIN CE QU'ELLE DOIT PORTER
 * (revue des Epics 1 à 4, trouvaille #14 · art. L215-1 C. consommation).
 *
 * ══ CE QUE DIT LE TEXTE DE LOI, ET CE QUE LE COURRIEL DISAIT ══════════════════════════════════
 *
 * Art. L215-1, dernier alinéa : « Cette information, délivrée dans des termes clairs et
 * compréhensibles, mentionne, dans un encadré apparent, LA DATE LIMITE DE RÉSILIATION. »
 *
 * Le courriel disait : « La date et le montant sont dans l'application : https://…/abonnement ».
 *
 * L'information doit être DANS le courriel dédié — c'est tout l'objet d'un « courrier électronique
 * dédié ». Renvoyer vers un écran derrière authentification, c'est demander à quelqu'un d'aller
 * chercher l'information dont la loi impose qu'on la lui apporte. Et quelqu'un qui ne se connecte
 * plus est précisément celui que la reconduction tacite prend au dépourvu.
 *
 * ══ POURQUOI LE TROU NE REMET PAS EN CAUSE LA 4.9 ═════════════════════════════════════════════
 *
 * `gabarits.ts` est une table CONSTANTE : hors deux valeurs typées NOMINALEMENT (`Origine`,
 * `JetonDesabonnement`), tout ce qui part vers un serveur de messagerie est écrit en clair dans le
 * fichier. C'est ce qui rend inécrivable la phrase « ajoutons juste le premier paragraphe de la
 * synthèse » : il n'existe aucun paramètre où la mettre.
 *
 * Le troisième trou est refermé de la même façon : `DateLimiteResiliation` est une chaîne marquée
 * que seul `dateLimiteResiliation()` produit, et ce constructeur n'accepte qu'un instant analysable
 * dont il rend LUI-MÊME le rendu français. Aucun fragment de journal, aucun titre de branche,
 * aucune adresse ne peut y transiter — pas seulement à la compilation : à l'exécution.
 *
 * Le MONTANT, lui, n'a besoin d'aucun trou : c'est une constante du produit (une seule offre), donc
 * il s'écrit en clair dans le gabarit, comme le reste du texte.
 */

const ORIGINE = "https://anima.test" as Origine;
const LIMITE = dateLimiteResiliation("2027-03-05T22:30:00Z")!;

const racine = process.cwd();
const lire = (p: string) => sansCommentaires(readFileSync(resolve(racine, p), "utf-8"));

describe("[revue 1-4, #14] `dateLimiteResiliation` — le seul constructeur, et il valide", () => {
  it("rend la date en français, à l'heure de PARIS (jamais celle du serveur)", () => {
    // 22 h 30 UTC le 5 mars est encore le 5 mars à Paris…
    expect(dateLimiteResiliation("2027-03-05T22:30:00Z")).toBe("5 mars 2027");
    // …et 23 h 30 UTC est déjà le 6. Sur Vercel (UTC), sans fuseau explicite, la date limite
    // annoncée au titre de l'art. L215-1 serait fausse d'un jour.
    expect(dateLimiteResiliation("2027-03-05T23:30:00Z")).toBe("6 mars 2027");
  });

  it("[LE CŒUR] REFUSE tout ce qui n'est pas un instant — c'est ce qui referme le trou", () => {
    for (const mauvais of [
      "",
      "   ",
      "demain",
      "Je me sens vraiment mal en ce moment", // le scénario que la 4.9 existe pour tuer
      "https://evil.test",
      "2027-13-45T00:00:00Z",
      "NaN",
    ]) {
      expect(dateLimiteResiliation(mauvais), `« ${mauvais} » ne doit pas passer`).toBeNull();
    }
  });

  it("ne rend JAMAIS la chaîne qu'on lui donne — elle la reformate", () => {
    // Une implémentation qui renverrait l'entrée telle quelle rouvrirait le paramètre libre en
    // grand : il suffirait de passer une chaîne qui ressemble à une date.
    const rendu = dateLimiteResiliation("2027-03-05T12:00:00Z");
    expect(rendu).not.toBe("2027-03-05T12:00:00Z");
    expect(rendu).toBe("5 mars 2027");
  });
});

describe("[revue 1-4, #14] le courriel PORTE la date limite, dans un encadré", () => {
  const g = gabaritLegalPour({ motif: "reconduction_a_venir", dateLimite: LIMITE }, ORIGINE)!;

  it("[LE CŒUR] la date limite est DANS le texte", () => {
    expect(g.texte).toContain("5 mars 2027");
  });

  it("[LE CŒUR] elle est ENCADRÉE — mise à part, pas noyée dans un paragraphe", () => {
    const lignes = g.texte.split("\n");
    const i = lignes.findIndex((l) => l.includes("5 mars 2027"));
    expect(i, "la date doit être sur sa propre ligne").toBeGreaterThan(0);
    // Une règle au-dessus ET au-dessous : c'est l'« encadré apparent » que permet un courriel
    // text/plain. Une bordure CSS exigerait une partie HTML — nommé en dette dans le gabarit.
    expect(lignes[i - 1], "règle au-dessus").toMatch(/^═+$/);
    expect(lignes[i + 1], "règle au-dessous").toMatch(/^═+$/);
    expect(lignes[i]).toMatch(/date limite de résiliation/i);
  });

  it("le MONTANT y est aussi, en toutes lettres", () => {
    // Il n'est pas exigé par L215-1, mais renvoyer « le montant est dans l'application » quand on
    // s'apprête à débiter 69 € était la moitié la plus facile à réparer : c'est une constante.
    expect(g.texte).toMatch(/69\s*€/);
  });

  it("le chemin pour arrêter reste nommé DANS le courriel", () => {
    expect(g.texte).toContain(`${ORIGINE}/abonnement`);
    expect(g.texte).toMatch(/résilier/i);
  });

  it("l'objet reste NEUTRE — il paraît sur un écran verrouillé (NFR-015)", () => {
    expect(g.objet).toBe("Ton abonnement va se renouveler");
    // Ni le montant ni la date dans l'objet : un aperçu de notification ne chiffre pas une dépense
    // devant qui regarde par-dessus l'épaule.
    expect(g.objet).not.toMatch(/69|€|mars|2027/);
  });

  it("toujours AUCUN désabonnement — le courriel repartira l'an prochain quoi qu'elle clique", () => {
    expect(g.texte).not.toMatch(/ne plus recevoir|désabonn/i);
  });
});

describe("[revue 1-4, #14] la date ne peut plus être OUBLIÉE — le type l'impose", () => {
  it("l'avis d'inactivité, lui, n'en porte pas (et n'en a pas besoin)", () => {
    const g = gabaritLegalPour({ motif: "inactivite_avant_suppression" }, ORIGINE)!;
    expect(g.objet).toBe("Ton compte va être supprimé");
    expect(g.texte).not.toMatch(/date limite de résiliation/i);
  });

  it("un motif hors de l'ensemble fermé ne rend RIEN (un `as` ou une désérialisation)", () => {
    expect(
      gabaritLegalPour({ motif: "inventé" } as never, ORIGINE),
      "l'adaptateur doit refuser d'envoyer",
    ).toBeNull();
  });

  it("[LA GARDE DE TYPE] une reconduction SANS date limite est inconstructible", () => {
    // ⚠️ CETTE GARDE MORD À LA COMPILATION, PAS À L'EXÉCUTION — et c'est la seule qui peut. Rendre
    // `dateLimite` optionnel laisserait le courriel repartir sans date : légal hier, illégal
    // aujourd'hui, et aucun test d'exécution ne le verrait puisqu'ils passent tous une date.
    //
    // Le `@ts-expect-error` se casse DANS LES DEUX SENS : si le champ devient optionnel, la ligne
    // cesse d'être une erreur et `tsc` signale une directive inutilisée.
    // @ts-expect-error — il manque `dateLimite`, et c'est précisément ce qu'on veut voir refusé.
    const sansDate: InformationLegale = { motif: "reconduction_a_venir" };
    expect(sansDate.motif).toBe("reconduction_a_venir");
  });

  it("[LA GARDE STRUCTURELLE] le webhook transmet l'échéance RÉELLE, jamais une constante", () => {
    // C'est le webhook qui détient la date (`reconduction.echeance`), et lui seul.
    const webhook = lire("app/api/stripe/webhook/route.ts");
    expect(webhook).toMatch(/annoncerReconduction\(\s*[\s\S]{0,120}reconduction\.echeance/);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// L'ENVOI — mesuré, pas lu
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[revue 1-4, #14] une échéance illisible ne part PAS avec une date approximative", () => {
  beforeEach(() => {
    envoyerInformationLegale.mockClear().mockResolvedValue(undefined);
  });

  it("[LE TEST QUI COMPTE] échéance illisible → on LÈVE, et rien ne part", async () => {
    // ⚠️ CE TEST EXISTE PARCE QU'UN MUTANT A SURVÉCU. La garde d'origine lisait la SOURCE et se
    // contentait d'y trouver le nom `dateLimiteResiliation` : remplacer le `throw` par un repli
    // `?? "bientôt"` la laissait verte, et le courriel légal serait parti en annonçant une date
    // limite de résiliation qui n'est pas une date. Une garde qui vérifie qu'un nom APPARAÎT ne
    // vérifie pas qu'il SERT.
    //
    // Lever est le bon repli : la réservation est libérée par l'appelant, le webhook répond 500, et
    // Stripe rejoue. Une date fausse, elle, fait foi et ne se rattrape pas.
    await expect(annoncerReconduction("u1", "pas-une-date")).rejects.toThrow();
    expect(envoyerInformationLegale, "rien ne doit partir").not.toHaveBeenCalled();
  });

  it("[CONTRÔLE POSITIF] une échéance lisible part, avec sa date rendue", async () => {
    await annoncerReconduction("u1", "2027-03-05T12:00:00Z");
    expect(envoyerInformationLegale).toHaveBeenCalledWith("elle@exemple.fr", {
      motif: "reconduction_a_venir",
      dateLimite: "5 mars 2027",
    });
  });
});
