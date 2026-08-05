import { describe, it, expect } from "vitest";
import {
  preselectionner,
  requeteRetourTheme,
  lireRetoursTheme,
  motsPorteurs,
  MAX_CANDIDATS,
  peutEncoreFeuiller,
  type BrancheCandidate,
} from "@/lib/domain/retour-theme";
import type { MessageIa } from "@/lib/ai/port";

/**
 * Story 4.7 (T3) — le domaine PUR de la détection du retour sur le thème : présélection déterministe,
 * parser, et la garde art. 9 qui compte le plus (le `nom` d'une branche ne part JAMAIS au modèle).
 */

/** Par défaut une branche VIVANTE (feuillaison à mi-parcours) : elle peut encore progresser. */
const b = (
  id: string,
  nom: string,
  extrait: string,
  etat: BrancheCandidate["etat"] = "feuillaison",
  intensite = 0.4,
): BrancheCandidate => ({ id, nom, extrait, etat, intensite });

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

  it("[REVUE] le PLAFOND mord vraiment : cinq branches appariées, trois transmises", () => {
    // La garde précédente ne prouvait rien : la fixture ne produisait jamais plus de trois candidats,
    // donc `.slice(0, MAX_CANDIDATS)` était un no-op et sa suppression laissait tout vert. Or ce plafond
    // EST la borne de l'art. 9 exposé au modèle : cinq verbatims au lieu de trois, c'est deux moments
    // intimes de plus qui sortent à chaque tour.
    const cinq = [
      b("a", "la colère", "cette colère qui monte quand on me coupe la parole"),
      b("b", "la colère au travail", "la colère au travail me submerge"),
      b("c", "colère et famille", "la colère quand ma famille décide pour moi"),
      b("d", "colère du matin", "cette colère dès le réveil"),
      b("e", "colère rentrée", "la colère que je ravale toujours"),
    ];
    const retenus = preselectionner(cinq, "encore cette colère aujourd'hui");
    expect(retenus.length, "cinq candidats appariés, trois seulement doivent partir").toBe(MAX_CANDIDATS);
    expect(new Set(retenus.map((r) => r.id)).size, "et trois DISTINCTS").toBe(MAX_CANDIDATS);
  });

  it("plafonne aussi quand le repli s'applique (le repli ne contourne pas la borne)", () => {
    const cinq = Array.from({ length: 5 }, (_, i) => b(`x${i}`, `thème ${i}`, `moment ${i}`));
    // Aucun appariement lexical, et plus de branches que la borne → aucun envoi (pas un envoi tronqué).
    expect(preselectionner(cinq, "quelque chose de totalement different")).toEqual([]);
  });

  it("classe les mieux appariées d'abord (l'ordre décide qui part quand ça déborde)", () => {
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

  it("[REVUE] les LIGATURES ne font pas disparaître un mot — « sœur », « cœur », « vœu »", () => {
    // `NFD` décompose les diacritiques, mais œ et æ ne sont PAS décomposables : ils tombaient dans le
    // séparateur `[^a-z0-9]+` et coupaient le mot en deux fragments trop courts, jetés. « sœur »
    // disparaissait donc entièrement du vocabulaire — et c'est le vocabulaire d'un journal intime.
    // Pire, le clavier iOS corrige « coeur » en « cœur » : le même mot tapé par la même personne
    // s'appariait un jour et pas l'autre.
    expect([...motsPorteurs("ma sœur me juge")].sort()).toEqual(["juge", "soeur"]);
    expect([...motsPorteurs("j'ai le cœur lourd")].sort()).toEqual(["coeur", "lourd"]);
    expect(motsPorteurs("cœur").has("coeur"), "« cœur » et « coeur » doivent se rencontrer").toBe(true);
    expect(motsPorteurs("coeur").has("coeur")).toBe(true);
  });

  it("[REVUE] une branche « ma sœur » est bien appariée par un tour qui parle d'elle", () => {
    const branches = [b("1", "ma sœur", "ma sœur me juge sans arrêt depuis la naissance de son fils")];
    expect(preselectionner(branches, "j'ai revu ma sœur ce week-end").map((r) => r.id)).toEqual(["1"]);
  });
});

describe("[REVUE] une branche qui ne peut PLUS progresser n'est plus candidate", () => {
  it("le feuillage plein et la pleine lumière sortent de la présélection", () => {
    // Deux gains d'un coup : leur verbatim art. 9 cesse de repartir au modèle à chaque tour pour rien,
    // et elles cessent d'occuper une des trois places du plafond au détriment de branches qui, elles,
    // peuvent encore pousser.
    const branches = [
      b("pleine", "la colère", "cette colère qui monte", "feuillaison", 1),
      b("arrivee", "la colère au travail", "la colère au travail", "rayonnement", 1),
      b("vivante", "colère du matin", "cette colère dès le réveil", "feuillaison", 0.4),
    ];
    expect(preselectionner(branches, "encore cette colère").map((r) => r.id)).toEqual(["vivante"]);
  });

  it("si AUCUNE ne peut plus progresser, rien ne part (pas même par le repli)", () => {
    const finies = [
      b("a", "la colère", "cette colère", "feuillaison", 1),
      b("c", "le sommeil", "je dors mal", "rayonnement", 1),
    ];
    expect(preselectionner(finies, "encore cette colère ce matin")).toEqual([]);
  });

  it("[AC1/AD-8] la décision vient de la FONCTION DE TRANSITION UNIQUE, pas d'un seuil recopié", () => {
    // `transitionner` n'avait aucun appelant de production : la « fonction de transition unique dans
    // lib/domain/ » exigée par AC1 était du code mort, et la règle ne vivait que dans le SQL. Elle est
    // désormais consultée ici — donc une divergence entre elle et l'usage réel devient impossible.
    expect(peutEncoreFeuiller(b("x", "n", "e", "feuillaison", 0.8))).toBe(true);
    expect(peutEncoreFeuiller(b("x", "n", "e", "feuillaison", 1))).toBe(false);
    expect(peutEncoreFeuiller(b("x", "n", "e", "rayonnement", 0.5))).toBe(false);
    expect(peutEncoreFeuiller(b("x", "n", "e", "naissance", 0))).toBe(true);
  });
});

describe("[REVUE] la présélection est un CLASSEUR, plus un portail fermé", () => {
  const paraphrase = [b("1", "dire non à ma mère", "je n'arrive jamais à refuser quelque chose à ma mère")];

  it("le cas que le module dit exister pour attraper est enfin transmis au modèle", () => {
    // L'en-tête du module justifie l'hybride par « le lexical seul rate la paraphrase — “maman” pour
    // “ma mère”, “j'ai posé une limite” pour “j'ai osé dire non” ». Or ce cas EXACT donnait une
    // présélection vide, et le pipeline s'arrêtait là : aucun appel, aucun rattrapage, JAMAIS. Le
    // retour le plus significatif qu'elle puisse faire était celui que l'arbre ignorait.
    for (const tour of [
      "hier j'ai posé une limite avec maman, pour la première fois",
      "j'ai osé dire non à maman hier soir",
    ]) {
      expect(preselectionner(paraphrase, tour).map((r) => r.id), tour).toEqual(["1"]);
    }
  });

  it("le repli ne s'applique QUE si l'envoi reste borné (le coût et l'art. 9 exposé ne bougent pas)", () => {
    // Quand il y a peu de branches, les envoyer toutes coûte exactement ce qu'aurait coûté un
    // appariement lexical : même taille de charge, même appel. Au-delà, le lexical reprend son rôle de
    // classeur — et la paraphrase peut être ratée. Limite assumée, documentée, pas silencieuse.
    const beaucoup = Array.from({ length: 9 }, (_, i) => b(`b${i}`, `thème ${i}`, `un moment numéro ${i}`));
    expect(preselectionner(beaucoup, "rien à voir avec tout ça"), "aucun appel si trop de branches").toEqual([]);
    expect(preselectionner(beaucoup.slice(0, 3), "rien à voir").length).toBe(3);
  });

  it("un tour SANS mot porteur ne déclenche toujours rien (« ok », « oui »)", () => {
    for (const tour of ["", "   ", "ok", "oui !"]) {
      expect(preselectionner(paraphrase, tour), tour).toEqual([]);
    }
  });

  it("un appariement lexical REEL reste prioritaire sur le repli (le classement sert encore)", () => {
    const trois = [
      b("a", "le sommeil", "je dors mal depuis des mois"),
      b("b", "ma mère", "ma mère me téléphone tous les jours"),
      b("c", "le travail", "mon travail ne me ressemble plus"),
    ];
    expect(preselectionner(trois, "encore ma mère au téléphone")[0].id).toBe("b");
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

  it("[REVUE / HAUTE] un extrait MULTILIGNE ne peut pas fabriquer de faux numéros dans la liste", () => {
    // Second chemin vers le même dégât irréversible : l'extrait est du verbatim BRUT (`entree_journal.
    // contenu`, mot pour mot). Sur mobile, Entrée fait un saut de ligne — une utilisatrice qui écrit une
    // liste injecte de vraies lignes « 1. » / « 2. » dans le payload. Le modèle vise alors une ligne
    // INTERNE, le mapping numéro → branche glisse d'un cran, et c'est la mauvaise branche qui feuille.
    const piege = "J'ai compris deux choses :\n1. je dis oui trop vite à ma mère\n2. j'ai peur de la décevoir";
    const r = requeteRetourTheme(MESSAGES, [b("a", "x", piege), b("b", "y", "mon travail ne me ressemble plus")]);
    const liste = r.messages[r.messages.length - 1].content;
    // Exactement DEUX lignes commencent par un numéro : une par candidat, pas une de plus.
    const lignesNumerotees = liste.split("\n").filter((l) => /^\s*\d+\./.test(l));
    expect(lignesNumerotees, "un numéro parasite décale tout le mapping").toHaveLength(2);
    // …et le contenu de l'extrait est préservé (aplati, pas amputé) : on ne perd pas ce qu'elle a écrit.
    expect(liste).toContain("je dis oui trop vite à ma mère");
    expect(liste).toContain("j'ai peur de la décevoir");
  });

  it("[REVUE] un extrait démesuré est BORNÉ avant de partir (minimisation art. 9, et coût)", () => {
    const enorme = "je rumine ".repeat(5000);
    const liste = requeteRetourTheme(MESSAGES, [b("a", "x", enorme)]).messages.at(-1)!.content;
    expect(liste.length, "un verbatim de 50 000 caractères n'a pas à partir en entier").toBeLessThan(2000);
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

  it("[REVUE / HAUTE] une NÉGATION en français ne retient RIEN, même si elle cite des numéros", () => {
    // Le défaut le plus grave de la story, reproduit bout-en-bout par la revue : l'instruction dit au
    // modèle « en cas de doute, réponds aucun », et un modèle fort répond en français naturel. L'ancienne
    // lecture prenait toute la fin de ligne et gardait tous les chiffres dans les bornes — « aucun. Le
    // message ne revient ni sur 1, ni sur 2, ni sur 3 » faisait feuiller LES TROIS branches. Et comme
    // l'arbre ne régresse jamais (FR-029), c'était DÉFINITIF, invisible (l'étage tourne dans `after()`),
    // sur des thèmes qu'elle n'a jamais abordés.
    //
    // La règle est maintenant : la ligne RETOURS doit être EXACTEMENT une liste de nombres. Un seul mot
    // qui traîne, et on ne retient rien. Le doute ne fait progresser aucune branche — pour de vrai.
    const negations = [
      "RETOURS: aucun. Le message ne revient ni sur 1, ni sur 2, ni sur 3.",
      "RETOURS: aucun des 3 moments",
      "RETOURS: non, aucun lien avec 1 ni 2",
      "RETOURS: aucun (ni 1, ni 2)",
      "RETOURS: pas de retour sur 2",
      "RETOURS: je dirais 1 mais je ne suis pas sûr",
    ];
    for (const sortie of negations) {
      expect(lireRetoursTheme(sortie, 3).indices, JSON.stringify(sortie)).toEqual([]);
    }
  });

  it("…et une vraie liste de numéros passe toujours (la garde n'est pas un bâillon)", () => {
    for (const [sortie, attendu] of [
      ["RETOURS: 1", [0]],
      ["RETOURS: 1,3", [0, 2]],
      ["RETOURS: 1, 2, 3", [0, 1, 2]],
      ["RETOURS: 2 3", [1, 2]],
      ["RETOURS: 1;3", [0, 2]],
      ["RETOURS:  3 ", [2]],
    ] as [string, number[]][]) {
      expect(lireRetoursTheme(sortie, 3).indices, sortie).toEqual(attendu);
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
