import { describe, it, expect } from "vitest";
import {
  preselectionner,
  requeteRetourTheme,
  lireRetoursTheme,
  motsPorteurs,
  MAX_CANDIDATS,
  type BrancheCandidate,
} from "@/lib/domain/retour-theme";
import type { MessageIa } from "@/lib/ai/port";

/**
 * Story 4.7 (T3) — le domaine PUR de la détection du retour sur le thème : présélection déterministe,
 * parser, et la garde art. 9 qui compte le plus (le `nom` d'une branche ne part JAMAIS au modèle).
 */

const b = (id: string, nom: string, extrait: string): BrancheCandidate => ({ id, nom, extrait });

describe("Présélection déterministe — elle BORNE le travail du modèle, elle ne décide rien", () => {
  it("retient la branche dont le thème partage des mots porteurs avec le tour", () => {
    const branches = [
      b("1", "dire non à ma mère", "je n'arrive jamais à refuser quelque chose à ma mère"),
      b("2", "changer de métier", "mon travail ne me ressemble plus du tout"),
    ];
    const retenus = preselectionner(branches, "j'ai encore dit oui à ma mère hier soir");
    expect(retenus.map((r) => r.id)).toEqual(["1"]);
  });

  it("ignore les mots-outils et les mots courts (sinon TOUT se ressemblerait)", () => {
    const branches = [b("1", "changer de métier", "mon travail ne me ressemble plus")];
    // « pour », « dans », « avec »… ne portent aucun thème : un tour qui n'a QUE ça ne réveille rien.
    expect(preselectionner(branches, "je pense que pour tout dire avec elle")).toEqual([]);
  });

  it("les accents ne séparent pas ce qui devrait se rencontrer (« mère » ⟷ « mere », clavier mobile)", () => {
    const branches = [b("1", "la colère", "je sens monter la colère dès qu'on me coupe")];
    expect(preselectionner(branches, "encore cette colere qui monte").map((r) => r.id)).toEqual(["1"]);
  });

  it("plafonne à MAX_CANDIDATS, en gardant les mieux appariées (l'art. 9 exposé reste borné)", () => {
    const tour = "ma mère, ma colère, hier soir encore";
    const branches = [
      b("faible", "travail", "mon travail"),
      b("fort", "ma mère et ma colère", "ma mère déclenche cette colère depuis toujours"),
      b("moyen", "colère", "cette colère qui monte"),
      b("tiers", "colère au travail", "la colère au travail me submerge"),
    ];
    const retenus = preselectionner(branches, tour);
    expect(retenus.length).toBeLessThanOrEqual(MAX_CANDIDATS);
    expect(retenus[0].id, "la mieux appariée passe en premier").toBe("fort");
  });

  it("est DÉTERMINISTE : deux exécutions sur les mêmes données donnent la même liste", () => {
    // Sans ordre total, deux branches ex æquo se relaieraient d'un tour à l'autre et la détection
    // deviendrait irreproductible — impossible à déboguer, et injuste pour la branche perdante.
    const branches = [
      b("zzz", "la colère", "cette colère"),
      b("aaa", "la colère", "cette colère"),
      b("mmm", "la colère", "cette colère"),
      b("bbb", "la colère", "cette colère"),
    ];
    const a = preselectionner(branches, "encore cette colère");
    const c = preselectionner([...branches].reverse(), "encore cette colère");
    expect(a.map((x) => x.id)).toEqual(c.map((x) => x.id));
  });

  it("un tour vide ou sans mot porteur ne réveille RIEN (pas d'appel fort pour rien)", () => {
    const branches = [b("1", "la colère", "cette colère")];
    for (const tour of ["", "   ", "ok", "oui !"]) expect(preselectionner(branches, tour), tour).toEqual([]);
  });

  it("`motsPorteurs` ne rend que des mots comparables (minuscules, sans ponctuation)", () => {
    expect([...motsPorteurs("Ma MÈRE, encore… (hier) !")].sort()).toEqual(["hier", "mere"]);
  });
});

describe("[AC7 DUR] le NOM d'une branche ne part JAMAIS vers le modèle", () => {
  const MESSAGES: MessageIa[] = [{ role: "user", content: "un tour quelconque" }];

  it("aucun nom de branche n'apparaît dans la requête construite", () => {
    // Migration 0021 L7-L9 : le `nom` est un contenu art. 9 qui « ne transite JAMAIS vers un modèle »
    // (proposition & nommage 100 % déterministes). Le nom SERT la présélection — en mémoire serveur —
    // et s'arrête là. Sans cette garde, l'ajouter « pour aider le modèle » serait une régression
    // invisible : le payload partirait, et rien à l'écran ne le dirait.
    const candidats = [
      b("1", "NOM_SECRET_UN", "je n'arrive pas à refuser"),
      b("2", "NOM_SECRET_DEUX", "mon travail ne me ressemble plus"),
    ];
    const charge = JSON.stringify(requeteRetourTheme(MESSAGES, candidats));
    expect(charge).not.toContain("NOM_SECRET_UN");
    expect(charge).not.toContain("NOM_SECRET_DEUX");
    // Contrôle positif : les EXTRAITS, eux, partent bien (sinon la garde serait vraie pour rien).
    expect(charge).toContain("je n'arrive pas à refuser");
  });

  it("la requête est FORTE et marquée art. 9 (elle passe donc par l'egress-guard)", () => {
    const r = requeteRetourTheme(MESSAGES, [b("1", "x", "un extrait")]);
    expect(r.capacite, "jamais le modèle léger : un faux positif s'inscrit définitivement").toBe("retour_theme");
    expect(r.contientArt9).toBe(true);
  });

  it("les moments sont numérotés 1..n dans l'ordre des candidats (le mapping retour → branche en dépend)", () => {
    const r = requeteRetourTheme(MESSAGES, [b("a", "x", "premier moment"), b("b", "y", "second moment")]);
    const liste = r.messages[r.messages.length - 1].content;
    expect(liste).toContain("1. premier moment");
    expect(liste).toContain("2. second moment");
  });
});

describe("Parser — le doute ne fait progresser AUCUNE branche", () => {
  it("lit les numéros et les ramène en index 0-based", () => {
    expect(lireRetoursTheme("RETOURS: 1,3", 3).indices).toEqual([0, 2]);
    expect(lireRetoursTheme("RETOURS: 2", 3).indices).toEqual([1]);
  });

  it("`aucun`, une sortie illisible ou l'absence de ligne → rien", () => {
    for (const sortie of ["RETOURS: aucun", "RETOURS:", "je ne sais pas", "", "RETOURS: peut-être"]) {
      expect(lireRetoursTheme(sortie, 3).indices, JSON.stringify(sortie)).toEqual([]);
    }
  });

  it("un numéro HORS BORNES est ignoré, jamais rabattu sur un voisin (ça ferait pousser la MAUVAISE branche)", () => {
    expect(lireRetoursTheme("RETOURS: 0,4,7", 3).indices).toEqual([]);
    expect(lireRetoursTheme("RETOURS: 2,9", 3).indices).toEqual([1]);
  });

  it("les doublons sont réduits (une branche ne progresse pas deux fois dans le même tour)", () => {
    expect(lireRetoursTheme("RETOURS: 2,2,2", 3).indices).toEqual([1]);
  });

  it("retient la DERNIÈRE ligne conforme — la conclusion, pas un brouillon de raisonnement", () => {
    expect(lireRetoursTheme("RETOURS: 1\nje me reprends\nRETOURS: aucun", 3).indices).toEqual([]);
    expect(lireRetoursTheme("RETOURS: aucun\nen fait si\nRETOURS: 3", 3).indices).toEqual([2]);
  });
});
