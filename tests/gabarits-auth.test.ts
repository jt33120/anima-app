import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GABARITS_AUTH, JETON_LIEN, LIEN_CONNEXION, CONFIRMATION_ADRESSE } from "@/lib/courriel/gabarits-auth";
import { chercherInterdits } from "@/lib/domain/lexique-interdit";
import { sansCommentaires } from "./_absence";

/**
 * gabarits-auth.test.ts — LES DEUX PREMIERS TEXTES DU PRODUIT (QA tour 1, T6).
 *
 * Ils partent depuis Supabase, pas depuis notre serveur — mais ils sont écrits ICI, et c'est tout
 * l'intérêt : rangés dans un tableau de bord, ils échapperaient au contrôle de voix, à la relecture
 * d'Anima et à la revue. Ce fichier est le prix de les avoir rapatriés.
 */

describe("[T6] la sécurité du lien — la garde qui compte plus que la langue", () => {
  it("[LE CŒUR] AUCUN gabarit ne contient `{{ .TokenHash }}` ni `{{ .Token }}`", () => {
    // ⚠️ CE TEST PORTE UNE VULNÉRABILITÉ MESURÉE, PAS UNE PRÉFÉRENCE. `app/auth/confirm/route.ts` a
    // retiré le flux `?token_hash=` après l'avoir exploité de bout en bout : un attaquant demandait un
    // lien pour SA propre adresse, en extrayait le `token_hash`, l'envoyait à la victime, et
    // `verifyOtp` rendait une session à un navigateur neuf sans le moindre `code_verifier`.
    //
    // Le réflexe naturel en réparant T6 est de bâtir le lien vers NOTRE domaine — « comme ça il ne
    // ressemble plus à de l'hameçonnage ». C'est exactement le geste qui rouvre la porte, et c'est
    // pour ça que ce test est le premier du fichier.
    for (const g of GABARITS_AUTH) {
      expect(g.corps, `${g.cleCorps} porte un jeton brut`).not.toContain("{{ .TokenHash }}");
      expect(g.corps, `${g.cleCorps} porte un jeton brut`).not.toContain("{{ .Token }}");
      expect(g.objet, `${g.cleObjet} porte un jeton`).not.toContain("{{");
    }
  });

  it("chaque corps porte `{{ .ConfirmationURL }}` EXACTEMENT une fois", () => {
    // Zéro fois : le courriel n'ouvre rien et la personne est bloquée dehors. Deux fois : deux
    // boutons pour un lien à usage unique, dont le second est mort — et on lui fait croire qu'elle
    // s'est trompée.
    for (const g of GABARITS_AUTH) {
      expect(g.corps.split(JETON_LIEN).length - 1, g.cleCorps).toBe(1);
    }
  });

  it("le corps PRÉVIENT que le lien ne ressemble pas à une adresse d'Anam", () => {
    // La moitié du grief de la QA n'est pas réparable ici (il faudrait un domaine d'authentification
    // personnalisé, option payante). Ce qui est réparable, c'est de ne pas laisser la personne
    // découvrir seule un lien `supabase.co` : on le lui dit avant qu'elle clique.
    for (const g of GABARITS_AUTH) {
      expect(g.corps.toLowerCase(), g.cleCorps).toContain("hébergeur de comptes");
    }
  });

  it("`app/auth/confirm/route.ts` n'a TOUJOURS pas de chemin `token_hash`", () => {
    // La garde de l'autre côté du lien : le gabarit peut rester propre pendant que la route rouvre
    // le flux. Les deux moitiés se tiennent, donc les deux se gardent.
    const src = sansCommentaires(readFileSync(resolve(process.cwd(), "app/auth/confirm/route.ts"), "utf-8"));
    expect(src, "le flux `verifyOtp` est revenu").not.toContain("verifyOtp");
    expect(src, "le paramètre `token_hash` est revenu").not.toContain("token_hash");
    expect(src, "…et le contrôle positif : PKCE est bien là").toContain("exchangeCodeForSession");
  });
});

describe("[T6 · NFR-015] l'objet paraît sur un écran verrouillé", () => {
  for (const g of GABARITS_AUTH) {
    it(`« ${g.objet} » : ≤ 6 mots, aucun chiffre, aucune racine intime`, () => {
      expect(g.objet.trim().split(/\s+/).length, g.objet).toBeLessThanOrEqual(6);
      expect(g.objet, "un chiffre dans un objet est un compte qui s'affiche seul").not.toMatch(/\d/);
      for (const racine of ["carte", "astro", "thème", "ennéagramme", "branche", "séance", "âme", "spirituel"]) {
        expect(g.objet.toLowerCase(), `« ${racine} »`).not.toContain(racine);
      }
    });
  }

  it("les deux objets sont DISTINCTS — sinon on ne sait pas lequel on a reçu", () => {
    expect(LIEN_CONNEXION.objet).not.toBe(CONFIRMATION_ADRESSE.objet);
  });
});

describe("[T6] du français, et la voix du produit", () => {
  const anglais = [
    "sign in", "sign-in", "follow the link", "confirm your", "your account",
    "click here", "expires shortly", "email address", "reset your", "welcome",
  ];

  for (const g of GABARITS_AUTH) {
    it(`${g.cleCorps} : aucun reste d'anglais`, () => {
      // Mutation-cible : laisser un gabarit au défaut de Supabase. C'est exactement ce que la QA a
      // trouvé — et un seul des deux suffirait à reproduire le grief.
      const tout = `${g.objet}\n${g.corps}`.toLowerCase();
      for (const mot of anglais) expect(tout, `« ${mot} »`).not.toContain(mot);
    });

    it(`${g.cleCorps} : lexique interdit, injonction et exclamation`, () => {
      const tout = `${g.objet}\n${g.corps}`;
      expect(chercherInterdits(tout), `lexique interdit dans ${g.cleObjet}`).toEqual([]);
      expect(tout, "aucune exclamation (charte §6)").not.toContain("!");
      for (const injonction of ["n'oublie pas", "pense à", "il faut", "tu dois", "dépêche"]) {
        expect(tout.toLowerCase(), `« ${injonction} »`).not.toContain(injonction);
      }
    });

    it(`${g.cleCorps} : dit qu'on peut IGNORER le message`, () => {
      // Le seul recours d'une personne dont l'adresse a été saisie par quelqu'un d'autre. Sans cette
      // phrase, elle ne sait pas si son inaction suffit.
      expect(g.corps.toLowerCase()).toContain("ignorer");
    });

    it(`${g.cleCorps} : styles EN LIGNE, aucune feuille de style`, () => {
      // Les clients de messagerie retirent les `<style>` : une mise en forme qui n'est pas en ligne
      // n'existe pas, et le courriel arrive en Times New Roman brut — soit exactement l'allure de
      // gabarit non écrit que cette réparation existe pour faire disparaître.
      expect(g.corps, "une feuille de style ne survit pas au client de messagerie").not.toContain("<style");
      expect(g.corps).toContain('style="');
    });
  }
});

describe("[T6] l'ensemble est FERMÉ : on ne personnalise que ce que le produit envoie", () => {
  it("deux gabarits, et ce sont ceux-là", () => {
    // Le produit est SANS MOT DE PASSE (FR-073) : ni récupération, ni invitation, ni changement
    // d'adresse. Personnaliser ces gabarits-là serait écrire une copie pour des courriels qui ne
    // partent jamais — et donner à croire qu'ils existent.
    expect(GABARITS_AUTH.map((g) => g.cleObjet).sort()).toEqual([
      "mailer_subjects_confirmation",
      "mailer_subjects_magic_link",
    ]);
  });

  it("les clés de configuration sont bien formées, et distinctes", () => {
    const cles = GABARITS_AUTH.flatMap((g) => [g.cleObjet, g.cleCorps]);
    expect(new Set(cles).size).toBe(cles.length);
    for (const c of cles) expect(c).toMatch(/^mailer_(subjects|templates)_[a-z_]+$/);
  });
});
