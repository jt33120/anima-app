import { describe, it, expect } from "vitest";
import {
  PRIX_ABONNEMENT_ANNUEL_EUROS,
  formaterPrixAnnuel,
  CADENCE_ABONNEMENT,
  TITRE_CARTE,
  GARANTIE_REMBOURSEMENT,
  PERIMETRE_GRATUIT_TITRE,
  PERIMETRE_GRATUIT,
  PERIMETRE_PREMIUM_TITRE,
  PERIMETRE_PREMIUM,
  ACTION_ABONNER,
  ACTION_PAS_MAINTENANT,
} from "@/render/conversation/offre-abonnement";
import { PRIX_ABONNEMENT_ANNUEL_CENTIMES } from "@/lib/stripe/config";

/**
 * Story 3.2 (T1) — la COPIE de la carte (`render/conversation/offre-abonnement`). Deux garanties dures : le
 * prix AFFICHÉ est COUPLÉ au prix FACTURÉ (jamais « affiche 69, facture 79 »), et la copie porte ZÉRO
 * dark pattern (FR-061, AC2). `lib/stripe/config` est `server-only` → lisible ici via le stub de test.
 */

const COPIE = [
  TITRE_CARTE,
  formaterPrixAnnuel(),
  CADENCE_ABONNEMENT,
  GARANTIE_REMBOURSEMENT,
  PERIMETRE_GRATUIT_TITRE,
  ...PERIMETRE_GRATUIT,
  PERIMETRE_PREMIUM_TITRE,
  ...PERIMETRE_PREMIUM,
  ACTION_ABONNER,
  ACTION_PAS_MAINTENANT,
].join(" ");

// Marqueurs interdits : rareté, urgence, minuterie, prix barré. Bornes de mot (\b) pour les termes
// ambigus (« vite » ⊂ « invite »/« éviter »), afin d'éviter tout faux positif sur une copie saine.
const INTERDITS: RegExp[] = [
  /compte à rebours/i,
  /\bplus que\b/i,
  /\bseulement\b/i,
  /derni[èe]re chance/i,
  /places? limit[ée]e?s?/i,
  /offre[^.]*expire/i,
  /expire dans/i,
  /au lieu de/i,
  /prix barr[ée]/i,
  /~~/,
  /🔥|⏰|❗/,
  /\bvite\b/i,
  /\burgent/i,
  /d[ée]p[êe]che/i,
];

describe("offre-abonnement — le prix AFFICHÉ est couplé au prix FACTURÉ (AC2)", () => {
  it("euros × 100 = centimes EUR facturés par Stripe (3.1) — jamais de divergence silencieuse", () => {
    expect(PRIX_ABONNEMENT_ANNUEL_EUROS * 100).toBe(PRIX_ABONNEMENT_ANNUEL_CENTIMES);
  });
  it("formaterPrixAnnuel() = « 69 € » (prix unique, sans barré)", () => {
    expect(formaterPrixAnnuel()).toBe("69 €");
  });
});

describe("offre-abonnement — ZÉRO dark pattern (FR-061, AC2)", () => {
  for (const marqueur of INTERDITS) {
    it(`ne contient pas ${marqueur}`, () => {
      expect(COPIE).not.toMatch(marqueur);
    });
  }

  it("contrôle POSITIF (non-vacuité) : les regex ATTRAPENT un vrai dark pattern injecté", () => {
    // Sans ce canari, les `not.toMatch` seraient vacuement verts si une regex était cassée/inerte.
    const mauvais = [
      "Offre limitée : plus que 2 places",
      "l'offre expire dans 3 h",
      "Dépêche-toi, dernière chance",
      "99 € au lieu de 149 €",
      "compte à rebours ⏰",
    ];
    for (const m of mauvais) {
      expect(INTERDITS.some((r) => r.test(m)), `aucune regex n'attrape « ${m} »`).toBe(true);
    }
  });
});

describe("offre-abonnement — contenu exigé par les ACs", () => {
  it("garantie de remboursement présente, sur artefact produit (AC3)", () => {
    expect(GARANTIE_REMBOURSEMENT).toMatch(/remboursement/i);
    expect(GARANTIE_REMBOURSEMENT).toMatch(/trois mois/i);
    expect(GARANTIE_REMBOURSEMENT).toMatch(/branche/i); // artefact produit, jamais « ton état »
  });
  it("périmètre gratuit ET premium, non vides, chaque ligne non vide (AC4)", () => {
    expect(PERIMETRE_GRATUIT.length).toBeGreaterThan(0);
    expect(PERIMETRE_PREMIUM.length).toBeGreaterThan(0);
    for (const l of [...PERIMETRE_GRATUIT, ...PERIMETRE_PREMIUM]) expect(l.trim().length).toBeGreaterThan(0);
  });
  it("registre SYSTÈME : jamais signé de la voix d'Anam (AC4)", () => {
    expect(COPIE).not.toMatch(/—\s*anam|signé|,\s*anam\b/i);
    // Adresse produit (« tu/ton/ta »), pas le « je » intime d'Anam.
    expect(COPIE).toMatch(/\bt(a|on|u)\b/i);
  });
});
