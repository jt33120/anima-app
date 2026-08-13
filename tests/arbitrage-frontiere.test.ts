import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PHRASE_INVITATION, SEUIL_BRANCHES_OUVERTES } from "@/lib/domain/arbitrage-ouverture";

/**
 * Story 4.10 (T7) — [AC5 DUR / FR-031] LE COMPTE NE TRAVERSE PAS LA FRONTIÈRE, ET C'EST LE TYPE QUI LE
 * GARANTIT.
 *
 * FR-031 est marqué DUR : « aucun compte de branches ouvertes n'est jamais affiché ». La façon naturelle
 * de le respecter serait une consigne de rédaction — « n'écrivez pas le nombre » — c'est-à-dire une
 * discipline, qu'un contributeur pressé enfreindra dans six mois en toute bonne foi, parce que « 3
 * branches en cours » est plus informatif.
 *
 * On lui retire le moyen. `Ouverture` (serveur) et `OuvertureData` (miroir de rendu) ne contiennent
 * AUCUN champ numérique : le compte est lu côté serveur, il choisit une branche du `if`, et il meurt là.
 * Le rendu ne peut pas afficher un chiffre qu'il n'a jamais reçu — même patron exact que la projection
 * muette de la 4.6 et que la trame `beat` de la 2.7 (« la trame ne porte QUE l'identifiant »).
 *
 * Ces gardes lisent la SOURCE. C'est assumé : un type TypeScript s'efface à la compilation, il n'existe
 * donc aucune valeur à interroger à l'exécution. Ce qu'on protège n'est pas un comportement, c'est la
 * FORME DU CONTRAT — et la forme du contrat vit dans le fichier.
 */

const RACINE = process.cwd();
const lire = (chemin: string) => readFileSync(resolve(RACINE, chemin), "utf-8");
/** Sans commentaires : « le compte n'est PAS ici » est une phrase, pas une déclaration de champ. */
const sansCommentaires = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * Le corps COMPLET d'un type nommé — jusqu'au `;` de FIN DE DÉCLARATION, repéré par l'imbrication.
 *
 * ⚠️ TROISIÈME VERSION DE CETTE FONCTION, ET LES DEUX PREMIÈRES ÉTAIENT VIDES. C'est l'histoire la plus
 * instructive de cette story, alors elle est écrite :
 *
 *   1. « jusqu'au premier `;` » — ce `;` est celui qui sépare deux MEMBRES du premier objet de l'union.
 *      La garde lisait une ligne et demie. Un champ `number` ajouté à la seconde variante passait sans
 *      la faire rougir. Trouvée par la campagne de mutation, pas par la relecture.
 *   2. « jusqu'à la première LIGNE finissant par `;` » — correct tant que chaque variante tient sur une
 *      ligne. Il suffit qu'un formateur passe la variante `invitation` sur plusieurs lignes (elle fait
 *      déjà 92 caractères) pour que la garde s'arrête à `readonly type: "invitation";` et ne voie plus
 *      rien. Le filet « corps tronqué » ne se déclenchait pas non plus. Trouvée par la revue.
 *
 * Les deux fois, l'erreur était la même : deviner la fin d'une déclaration à partir de sa MISE EN FORME.
 * On compte donc l'imbrication — un `;` au niveau zéro termine la déclaration, où qu'il soit écrit.
 */
function corpsDuType(source: string, nom: string): string {
  const debut = source.indexOf(`export type ${nom} =`);
  expect(debut, `le type ${nom} doit exister`).toBeGreaterThan(-1);
  let profondeur = 0;
  for (let i = debut; i < source.length; i += 1) {
    const c = source[i];
    if (c === "{" || c === "(" || c === "[") profondeur += 1;
    else if (c === "}" || c === ")" || c === "]") profondeur -= 1;
    else if (c === ";" && profondeur === 0) return source.slice(debut, i + 1);
  }
  throw new Error(`déclaration de ${nom} non terminée : la garde ne peut rien prouver`);
}

/**
 * ⚠️ UNE GARDE D'ABSENCE DOIT D'ABORD PROUVER QU'ELLE REGARDE AU BON ENDROIT.
 *
 * C'est la leçon des DEUX premières versions, et la mutation-vérification l'a confirmée une troisième
 * fois : revenir à « jusqu'au premier `;` » ne faisait rougir aucun test, parce qu'un corps TRONQUÉ ne
 * contient évidemment pas de `number` — l'assertion `not.toMatch(/: number/)` passait sur un extrait
 * d'une ligne et demie. Chercher l'absence de quelque chose dans un texte vide réussit toujours.
 *
 * On assère donc d'abord la PRÉSENCE des deux variantes. Toute extraction tronquée rougit alors,
 * quelle que soit la façon dont elle s'est trompée.
 */
function corpsComplet(source: string, nom: string, variantes: readonly string[]): string {
  const corps = corpsDuType(source, nom);
  for (const v of variantes) {
    expect(corps, `extraction TRONQUÉE de ${nom} : la variante « ${v} » manque, la garde ne prouve rien`).toContain(v);
  }
  return corps;
}

/**
 * Les variantes de l'union — leur présence est ce qui rend l'extraction crédible.
 *
 * ⚠️ TOUTE NOUVELLE VARIANTE S'INSCRIT ICI. Sans cela, l'extraction s'arrêterait avant elle et la
 * garde deviendrait vraie pour un corps tronqué : un champ numérique ajouté à la dernière variante
 * ne serait jamais vu. `socle-complete` (Story 5.3) est la troisième, `hypothese-enneagramme`
 * (Story 5.5) la quatrième — et cette dernière est celle qui rendait le piège le plus tentant : un
 * type d'ennéagramme EST un nombre, et `readonly type: number` s'écrit tout seul.
 */
const VARIANTES = [
  '"proposition"',
  '"invitation"',
  '"socle-complete"',
  '"hypothese-enneagramme"',
] as const;

const DOMAINE = "lib/domain/arbitrage-ouverture.ts";
const RENDU = "render/conversation/types.ts";

describe("[AC5 DUR] aucun champ NUMÉRIQUE dans le contrat d'ouverture", () => {
  it("[LE CŒUR] `Ouverture` (serveur) ne déclare aucun `number`", () => {
    // Mutation-cible : ajouter `readonly branchesEnNaissance: number` à la variante `invitation`. Le
    // rendu pourrait alors l'afficher, et rien d'autre dans la suite ne s'en apercevrait — la phrase
    // constante resterait correcte, les tests de composition passeraient.
    const corps = corpsComplet(sansCommentaires(lire(DOMAINE)), "Ouverture", VARIANTES);
    expect(corps).not.toMatch(/:\s*number\b/);
    expect(corps, "ni un tableau, qui serait un compte déguisé").not.toMatch(/\[\]/);
  });

  it("`OuvertureData` (miroir de rendu) n'en déclare pas non plus", () => {
    // Le rendu ne peut pas importer `lib/` (frontière AD-7), donc ce type est une COPIE volontaire —
    // et toute copie est une divergence en attente. Celle-ci est verrouillée des deux côtés.
    const corps = corpsComplet(sansCommentaires(lire(RENDU)), "OuvertureData", VARIANTES);
    expect(corps).not.toMatch(/:\s*number\b/);
    expect(corps).not.toMatch(/\[\]/);
  });

  it("les deux copies déclarent EXACTEMENT les mêmes champs", () => {
    // Mutation-cible : ajouter un champ d'un seul côté. Sans cette garde, le miroir pourrait porter
    // quelque chose que le serveur n'envoie jamais (un champ mort qui se lit comme une promesse) ou
    // l'inverse (une donnée envoyée que rien ne reçoit).
    const champs = (corps: string) =>
      [...corps.matchAll(/readonly\s+(\w+)\s*[?:]/g)].map((m) => m[1]).sort();
    const serveur = champs(corpsComplet(sansCommentaires(lire(DOMAINE)), "Ouverture", VARIANTES));
    const rendu = champs(corpsComplet(sansCommentaires(lire(RENDU)), "OuvertureData", VARIANTES));
    expect(serveur.length, "le contrat n'est pas vide").toBeGreaterThan(0);
    expect(rendu).toEqual(serveur);
  });

  it("le SEUIL vit dans le domaine et ne fuit vers aucun module de rendu", () => {
    // Mutation-cible : importer `SEUIL_BRANCHES_OUVERTES` dans un composant « juste pour adapter le
    // texte au-delà de cinq ». Le seuil est un nombre : le laisser entrer dans `render/` rouvrirait la
    // porte que le type vient de fermer.
    const fichiersRendu = [RENDU, "render/conversation/InvitationIntegration.tsx", "render/scene-dom.tsx"];
    for (const f of fichiersRendu) {
      expect(lire(f), `${f} ne connaît pas le seuil`).not.toContain("SEUIL_BRANCHES_OUVERTES");
    }
  });
});

describe("[AC5 DUR] la phrase d'invitation ne compte pas non plus, ni en chiffres ni en mots", () => {
  it("aucun chiffre, aucun quantificateur", () => {
    // Mutation-cible : « Tu as trois branches qui attendent. » C'est la formulation la plus naturelle,
    // c'est celle qu'on écrit sans y penser, et c'est exactement ce que FR-031 interdit. Le type ne
    // protège que les DONNÉES ; la phrase, elle, est écrite à la main — d'où cette garde-ci.
    expect(PHRASE_INVITATION).not.toMatch(/\d/);
    for (const compte of ["deux", "trois", "quatre", "plusieurs", "certaines", "toutes", "branches"]) {
      expect(PHRASE_INVITATION.toLowerCase(), `« ${compte} »`).not.toContain(compte);
    }
  });

  it("elle parle d'UNE chose, au singulier — une liste redeviendrait un compte", () => {
    expect(PHRASE_INVITATION).toMatch(/quelque chose/);
  });

  it("le seuil est un PLACEHOLDER PRODUIT assumé, pas une valeur magique isolée", () => {
    // Il n'a pas à être « juste » — il a à être NOMMÉ et documenté comme provisoire, au même titre que
    // `PAS_FEUILLAISON`. Mutation-cible : inliner `3` dans `tropDeBranchesOuvertes`.
    expect(SEUIL_BRANCHES_OUVERTES).toBeGreaterThan(0);
    const source = lire(DOMAINE);
    expect(source, "le caractère provisoire est écrit noir sur blanc").toContain("PLACEHOLDER PRODUIT");
    expect(source, "et le fait qu'il ne s'affiche jamais aussi").toMatch(/JAMAIS affiché|jamais affiché/);
  });
});

describe("[AC4] l'invitation est une PAROLE dans le fil, jamais un bandeau", () => {
  const composant = lire("render/conversation/InvitationIntegration.tsx");

  it("elle se rend comme un tour de conversation (`article` dans le fil), pas en surimpression", () => {
    // Mutation-cible : la remonter dans `scene-dom` comme un encart permanent. Une invitation qui
    // s'impose visuellement cesse d'être une invitation — c'est le sens littéral d'« en conversation,
    // et jamais en bandeau ».
    expect(composant).toContain("<article");
    for (const bandeau of ["Surimpression", "position: fixed", "role=\"alert\"", "role=\"banner\""]) {
      expect(composant, `« ${bandeau} » ferait de l'invitation un bandeau`).not.toContain(bandeau);
    }
  });

  it("elle est rendue par le FIL, au même rang que les autres tours", () => {
    expect(lire("render/conversation/Fil.tsx")).toContain("InvitationIntegration");
    expect(lire("render/scene-dom.tsx"), "jamais montée directement par la scène").not.toContain(
      "InvitationIntegration",
    );
  });

  it("elle n'offre AUCUN moyen de la refuser — refuser une invitation, c'est ne pas la suivre", () => {
    // Un bouton « Plus tard » obligerait à répondre à quelque chose qui ne demandait rien, et ferait de
    // l'invitation une question fermée. Mutation-cible : ajouter un « Non merci ».
    for (const refus of ["Non", "Plus tard", "Ignorer", "Fermer"]) {
      expect(composant, `« ${refus} »`).not.toContain(`>${refus}<`);
    }
  });
});
