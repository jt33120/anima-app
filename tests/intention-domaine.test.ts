import { describe, it, expect } from "vitest";
import {
  INTENTION_LONGUEUR_MAX,
  moitieDonnee,
  intentionRecevable,
  echeanceRecevable,
  etapeRecevable,
} from "@/lib/domain/intention";
import {
  SEUIL_BRANCHES_OUVERTES,
  FENETRE_INVITATION_HEURES,
  PHRASE_INVITATION,
  tropDeBranchesOuvertes,
} from "@/lib/domain/arbitrage-ouverture";
import { NOM_LONGUEUR_MAX } from "@/lib/domain/branche";

/**
 * Story 4.10 (T2) — le domaine PUR : aucune base, aucun réseau, aucun DOM. Ces gardes tournent seules.
 */

const PARIS = (iso: string) => new Date(iso);

describe("[AC1 DUR] « si X, alors Y » : les deux moitiés, ou rien", () => {
  it("une moitié faite d'invisibles n'est pas donnée", () => {
    // Mutation-cible : faire rendre `true` à `moitieDonnee` pour une chaîne non vide. Le point de cette
    // fonction n'est PAS « non vide » — c'est « il reste quelque chose qui s'affiche ».
    for (const invisible of ["", "   ", "​", "️", " 　"]) {
      expect(moitieDonnee(invisible), JSON.stringify(invisible)).toBe(false);
    }
  });

  it("un vrai texte est donné", () => {
    expect(moitieDonnee("si je sens la boule au ventre")).toBe(true);
    expect(moitieDonnee("日本")).toBe(true);
    expect(moitieDonnee("🙂")).toBe(true);
  });

  it("[LE CŒUR] une seule moitié ne fait PAS une intention", () => {
    // Mutation-cible : remplacer le `&&` par un `||`. Un « alors » seul (« respire trois fois ») est une
    // CONSIGNE ; un « si » seul est une observation. C'est la conjonction qui fait l'intention
    // d'implémentation, et c'est la seule raison pour laquelle la forme peut être garantie sans modèle.
    expect(intentionRecevable({ declencheur: "si je remets à demain", action: "" })).toBe(false);
    expect(intentionRecevable({ declencheur: "", action: "je pose une minute" })).toBe(false);
    expect(intentionRecevable({ declencheur: "si je remets à demain", action: "je pose une minute" })).toBe(true);
  });

  it("la borne haute est CELLE du nom de branche, pas une seconde valeur", () => {
    // Mutation-cible : écrire `300` en dur dans `lib/domain/intention.ts`. Ce test ne rougirait pas
    // aujourd'hui — mais il rougira le jour où l'une des deux bougera, et c'est tout ce qu'on lui demande.
    expect(INTENTION_LONGUEUR_MAX).toBe(NOM_LONGUEUR_MAX);
    expect(moitieDonnee("a".repeat(INTENTION_LONGUEUR_MAX))).toBe(true);
    expect(moitieDonnee("a".repeat(INTENTION_LONGUEUR_MAX + 1))).toBe(false);
  });
});

describe("[AC3] l'échéance est une DATE CIVILE, et jamais dans le passé", () => {
  const maintenant = PARIS("2026-08-06T10:00:00Z"); // 12 h à Paris → jour civil 2026-08-06

  it("aucune échéance est parfaitement légitime", () => {
    expect(echeanceRecevable(null, maintenant)).toBe(true);
  });

  it("[LE CŒUR] AUJOURD'HUI est refusé, DEMAIN passe", () => {
    // Mutation-cible : revenir à `>= aujourd'hui`. Le tick de l'ordonnanceur passe à 06:00 UTC et
    // `rappels_echeance_dus` ne regarde QUE `echeance = aujourd'hui`, jamais `<=` : une échéance posée
    // dans la journée arrive APRÈS son propre rappel, et rien n'est rattrapé. La première version
    // l'acceptait — et le champ de saisie la PROPOSAIT activement. C'est mot pour mot l'argument qui
    // fait refuser hier, appliqué au cas le plus fréquent (revue 4.10).
    expect(echeanceRecevable("2026-08-06", maintenant), "aujourd'hui : le rappel est déjà passé").toBe(false);
    expect(echeanceRecevable("2026-08-07", maintenant), "demain").toBe(true);
    expect(echeanceRecevable("2028-01-01", maintenant), "aucune borne haute : c'est la sienne").toBe(true);
  });

  it("[LE CŒUR] hier est REFUSÉ — la sélection ne regarde que le jour même, ça ne se déclencherait jamais", () => {
    // Mutation-cible : retirer la comparaison `>= aujourd'hui`. Accepter une échéance passée reviendrait
    // à lui laisser poser un rendez-vous dont on sait déjà qu'il n'aura pas lieu : `rappels_echeance_dus`
    // filtre sur `echeance = aujourd'hui` (jamais `<=`, parce qu'un rappel en retard est un reproche daté).
    expect(echeanceRecevable("2026-08-05", maintenant)).toBe(false);
    expect(echeanceRecevable("2020-01-01", maintenant)).toBe(false);
  });

  it("le JOUR CIVIL est celui de PARIS, pas celui d'UTC", () => {
    // 23 h 30 UTC le 5 août = 1 h 30 le 6 août à Paris. Une échéance au 6 est donc « aujourd'hui », pas
    // « demain » — et une échéance au 5 est déjà passée. Mutation-cible : remplacer `fenetreDe` par un
    // `toISOString().slice(0,10)`. Le défaut serait invisible 22 heures sur 24.
    const tard = PARIS("2026-08-05T23:30:00Z");
    expect(echeanceRecevable("2026-08-07", tard), "à Paris on est déjà le 6, donc demain est le 7").toBe(true);
    expect(echeanceRecevable("2026-08-06", tard), "le 6 est aujourd'hui : trop tard").toBe(false);
    expect(echeanceRecevable("2026-08-05", tard), "le 5 est derrière nous").toBe(false);
  });

  it("une date INEXISTANTE est refusée (la forme ne suffit pas)", () => {
    // Mutation-cible : garder la regex et retirer l'aller-retour `Date.UTC`. `2026-02-31` passe la forme
    // et n'est pas une date : Postgres la refuserait, et l'app aurait laissé le bouton actif.
    expect(echeanceRecevable("2026-02-31", maintenant)).toBe(false);
    expect(echeanceRecevable("2026-13-01", maintenant)).toBe(false);
    expect(echeanceRecevable("2026-00-10", maintenant)).toBe(false);
  });

  it("une forme non conforme est refusée", () => {
    for (const brut of ["06/08/2026", "2026-8-6", "2026-08-06T00:00:00Z", "demain", ""]) {
      expect(echeanceRecevable(brut, maintenant), JSON.stringify(brut)).toBe(false);
    }
  });

  it("`etapeRecevable` exige LES DEUX (forme et échéance)", () => {
    const bonne = { declencheur: "si", action: "alors", echeance: "2026-08-08" };
    expect(etapeRecevable(bonne, maintenant)).toBe(true);
    expect(etapeRecevable({ ...bonne, action: " " }, maintenant), "forme cassée").toBe(false);
    expect(etapeRecevable({ ...bonne, echeance: "2020-01-01" }, maintenant), "échéance passée").toBe(false);
  });
});

describe("[AC4/AC5] l'arbitrage : un seuil, et rien qui se compte à l'écran", () => {
  it("[LE CŒUR] le seuil mord à 3, pas à 4", () => {
    // Mutation-cible : passer `>=` en `>`. Le décalage d'un est exactement le genre de défaut qui ne se
    // voit jamais : Anam se tairait une branche trop tard, et personne ne saurait dire pourquoi.
    expect(tropDeBranchesOuvertes(SEUIL_BRANCHES_OUVERTES - 1)).toBe(false);
    expect(tropDeBranchesOuvertes(SEUIL_BRANCHES_OUVERTES)).toBe(true);
    expect(tropDeBranchesOuvertes(SEUIL_BRANCHES_OUVERTES + 10)).toBe(true);
  });

  it("un compte impossible ne déclenche RIEN (le doute penche vers le silence)", () => {
    // Mutation-cible : retirer la garde `Number.isFinite`. `NaN >= 3` est faux, donc le repli serait
    // déjà correct par accident — mais `Infinity` passerait, et une lecture cassée ferait parler Anam.
    expect(tropDeBranchesOuvertes(Number.NaN)).toBe(false);
    expect(tropDeBranchesOuvertes(Number.POSITIVE_INFINITY)).toBe(false);
    expect(tropDeBranchesOuvertes(0)).toBe(false);
  });

  it("[AC5 DUR] la phrase d'invitation ne contient AUCUN chiffre, ni en lettres", () => {
    // Mutation-cible : écrire « Tu as trois branches qui attendent ». C'est la formulation naturelle,
    // c'est celle qu'on écrirait sans y penser, et c'est exactement ce que FR-031 interdit.
    expect(PHRASE_INVITATION).not.toMatch(/\d/);
    for (const mot of ["deux", "trois", "quatre", "cinq", "plusieurs", "toutes", "branches"]) {
      expect(PHRASE_INVITATION.toLowerCase(), `« ${mot} » compte, même sans chiffre`).not.toContain(mot);
    }
  });

  it("la phrase est une QUESTION, pas un constat ni un reproche (charte §6)", () => {
    expect(PHRASE_INVITATION.trim().endsWith("?"), "Anam demande, elle ne décrète pas").toBe(true);
    for (const decret of ["tu devrais", "tu as tendance", "il faut", "!"]) {
      expect(PHRASE_INVITATION.toLowerCase()).not.toContain(decret);
    }
  });

  it("la fenêtre de silence est de sept jours (D3), exprimée en heures pour la base", () => {
    expect(FENETRE_INVITATION_HEURES).toBe(168);
  });
});
