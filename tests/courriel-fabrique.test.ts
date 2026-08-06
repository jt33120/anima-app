import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { creerPortCourriel } from "@/lib/courriel/fabrique";

/**
 * REVUE 4.9 — LA FABRIQUE DU PORT COURRIEL, et son boot-guard.
 *
 * Ce module était livré SANS AUCUN TEST, alors qu'il porte la décision la plus lourde du canal : que
 * faire quand la configuration manque. Le fichier documente lui-même que retomber sur l'adaptateur
 * factice serait « le pire des choix » — les courriels seraient silencieusement avalés en production, le
 * job les compterait comme envoyés, la réservation serait consommée, et personne ne saurait rien. Rien
 * ne prouvait qu'il n'en était pas ainsi.
 */

const origine = { ...process.env };

beforeEach(() => {
  process.env = { ...origine };
});
afterEach(() => {
  process.env = { ...origine };
});

describe("le boot-guard : sans configuration, on LÈVE — on n'avale pas", () => {
  it("[LE CŒUR] sans clé, le port se déclare non configuré ET refuse d'envoyer", async () => {
    // Mutation-cible : retomber sur `creerPortCourrielFactice()`. Une panne muette est plus coûteuse
    // qu'une panne bruyante, et bien plus coûteuse encore quand elle se déguise en succès.
    delete process.env.RESEND_API_KEY;
    delete process.env.VITEST;
    const port = creerPortCourriel();
    expect(port.estConfigure()).toBe(false);
    await expect(port.envoyer("qui@exemple.fr", "synthese_prete")).rejects.toThrow("courriel_non_configure");
  });

  it("une clé sans expéditeur ne suffit pas, et un expéditeur sans clé non plus", () => {
    delete process.env.VITEST;
    process.env.RESEND_API_KEY = "re_quelquechose";
    delete process.env.ANIMA_COURRIEL_EXPEDITEUR;
    expect(creerPortCourriel().estConfigure(), "clé seule").toBe(false);

    delete process.env.RESEND_API_KEY;
    process.env.ANIMA_COURRIEL_EXPEDITEUR = "anam@exemple.fr";
    expect(creerPortCourriel().estConfigure(), "expéditeur seul").toBe(false);
  });

  it("des blancs ne valent pas une configuration", () => {
    delete process.env.VITEST;
    process.env.RESEND_API_KEY = "   ";
    process.env.ANIMA_COURRIEL_EXPEDITEUR = "  ";
    expect(creerPortCourriel().estConfigure()).toBe(false);
  });

  it("[CONTRÔLE POSITIF] configuré, le port se déclare prêt", () => {
    // Sans lui, les gardes ci-dessus seraient satisfaites par une fabrique qui ne rend JAMAIS rien de
    // fonctionnel — un canal muet en production, tout aussi cassé, et invisible.
    delete process.env.VITEST;
    process.env.RESEND_API_KEY = "re_quelquechose";
    process.env.ANIMA_COURRIEL_EXPEDITEUR = "anam@exemple.fr";
    expect(creerPortCourriel().estConfigure()).toBe(true);
  });
});

describe("[T4-3] sous Vitest, l'adaptateur RÉEL est hors d'atteinte", () => {
  it("[LE CŒUR] même parfaitement configurée, la fabrique refuse d'envoyer pendant les tests", () => {
    // La revue a montré qu'une suite de tests pouvait envoyer du VRAI courrier : la porte appelait la
    // vraie route, donc le vrai registre, donc cette fabrique — pendant qu'un fichier voisin créait des
    // candidates éligibles dans la même base. Le fichier fautif a été corrigé, mais ce correctif-là
    // demande à un test d'être discipliné ; celui-ci ne demande rien à personne.
    // Mutation-cible : retirer `if (process.env.VITEST) return NON_CONFIGURE;`.
    process.env.RESEND_API_KEY = "re_une_vraie_cle";
    process.env.ANIMA_COURRIEL_EXPEDITEUR = "anam@anima.app";
    expect(process.env.VITEST, "on tourne bien sous Vitest").toBeTruthy();
    expect(creerPortCourriel().estConfigure(), "aucune suite de tests n'écrira à une vraie personne").toBe(
      false,
    );
  });
});
