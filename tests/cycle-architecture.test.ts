import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

/**
 * Story 4.7 (T6) — LES GARDES D'ARCHITECTURE. C'est ici que « le rayonnement n'est JAMAIS inféré » (AC3)
 * cesse d'être une intention et devient une propriété du dépôt.
 *
 * Le raisonnement : on ne peut pas prouver par des exemples qu'aucune conversation ne mènera jamais à une
 * déclaration — l'espace des entrées est infini. Ce qu'on PEUT prouver, c'est qu'aucun chemin de code ne
 * relie un modèle à cette écriture. D'où deux gardes structurelles :
 *   1. `declarerRayonnement` n'a qu'UN appelant applicatif : la route du geste explicite ;
 *   2. aucun module de `lib/safety/` (les pipelines, là où vivent les appels aux modèles) ne le mentionne.
 *
 * Assumées comme gardes de SOURCE (mémoire `gardes-doivent-tuer-leur-mutant`, point 5) : elles prouvent le
 * CÂBLAGE, pas le comportement. Leur pendant comportemental — neuf retours espacés laissent la branche en
 * feuillaison — vit dans `branche-cycle-sql.test.ts`. Les deux ensemble couvrent la garantie.
 */

const RACINE = process.cwd();

function fichiersSous(dossier: string, extensions = [".ts", ".tsx"]): string[] {
  const base = resolve(RACINE, dossier);
  const trouves: string[] = [];
  const parcourir = (d: string) => {
    for (const entree of readdirSync(d)) {
      const chemin = join(d, entree);
      if (statSync(chemin).isDirectory()) parcourir(chemin);
      else if (extensions.some((e) => chemin.endsWith(e))) trouves.push(chemin);
    }
  };
  parcourir(base);
  return trouves;
}

/** Retire les commentaires : une MENTION en commentaire n'est pas un appel (et l'inverse serait un piège). */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("[AC3 DUR] la pleine lumière ne peut être écrite QUE par le geste de l'utilisatrice", () => {
  it("`declarerRayonnement` n'a qu'UN SEUL appelant applicatif : la route du geste", () => {
    // Mutation-cible : ajouter un appel depuis un pipeline. Si un jour quelqu'un « améliore » le produit
    // en déclarant le rayonnement quand le modèle détecte de l'enthousiasme, ce test rougit — et c'est
    // exactement le moment où il faut qu'il rougisse, parce que rien à l'écran ne le dirait.
    const appelants = [...fichiersSous("lib"), ...fichiersSous("app"), ...fichiersSous("render")]
      .filter((f) => !f.endsWith("depot-branche.ts")) // la DÉFINITION, pas un appel
      .filter((f) => /\.declarerRayonnement\s*\(/.test(sansCommentaires(readFileSync(f, "utf-8"))))
      .map((f) => f.slice(RACINE.length + 1));
    expect(appelants).toEqual(["app/api/anam/branche/route.ts"]);
  });

  it("AUCUN module de `lib/safety/` ne mentionne la déclaration de rayonnement", () => {
    // `lib/safety/` est là où vivent les appels aux modèles (pipelines détresse, reconceptualisation,
    // retour sur le thème). Que la déclaration n'y apparaisse NULLE PART — pas même en commentaire de
    // code actif — est la formulation la plus nette de « jamais inféré ».
    const fautifs = fichiersSous("lib/safety")
      .filter((f) => /declarerRayonnement|declarer_rayonnement/.test(sansCommentaires(readFileSync(f, "utf-8"))))
      .map((f) => f.slice(RACINE.length + 1));
    expect(fautifs, "un pipeline qui déclare la pleine lumière, c'est un décret sur elle (FR-026)").toEqual([]);
  });

  it("la RPC SQL `declarer_rayonnement` n'est appelée que depuis le dépôt", () => {
    const appelants = [...fichiersSous("lib"), ...fichiersSous("app"), ...fichiersSous("render")]
      .filter((f) => /rpc\(\s*["']declarer_rayonnement["']/.test(sansCommentaires(readFileSync(f, "utf-8"))))
      .map((f) => f.slice(RACINE.length + 1));
    expect(appelants).toEqual(["lib/data/depot-branche.ts"]);
  });

  it("[MÉTA] ces gardes attraperaient un mutant (elles ne sont pas vraies par accident)", () => {
    // Sans ce contrôle, les trois gardes ci-dessus passeraient tout aussi bien si le prédicat était faux
    // pour tout le monde — par exemple si `sansCommentaires` mangeait le code au lieu des commentaires.
    const mutant = "await depot.declarerRayonnement({ brancheId: b.id });";
    expect(/\.declarerRayonnement\s*\(/.test(sansCommentaires(mutant))).toBe(true);
    const commente = "// on pourrait appeler depot.declarerRayonnement(x) ici";
    expect(/\.declarerRayonnement\s*\(/.test(sansCommentaires(commente))).toBe(false);
  });
});

describe("[AC1 DUR] une SEULE fonction de transition, et personne ne recalcule l'ordre des états", () => {
  it("`ORDRE_ETAT` n'est DÉFINI qu'une fois dans tout le dépôt", () => {
    // Deux définitions de l'ordre monotone qui divergeraient, c'est la faute R1-bis en TypeScript — et
    // celle-ci décide dans quel sens l'arbre a le droit d'aller. `cycle-branche.ts` l'IMPORTE.
    const definitions = [...fichiersSous("lib"), ...fichiersSous("render"), ...fichiersSous("app")]
      .filter((f) => /(const|let)\s+ORDRE_ETAT\s*[:=]/.test(sansCommentaires(readFileSync(f, "utf-8"))))
      .map((f) => f.slice(RACINE.length + 1));
    expect(definitions).toEqual(["lib/scene/projection.ts"]);
  });

  it("`render/` ne calcule AUCUNE transition d'état (AD-7 : le rendu dessine, il ne décide pas)", () => {
    // Le rendu peut LIRE `etat` pour dessiner ; il ne doit ni importer la fonction de transition, ni
    // fabriquer un état supérieur de sa propre initiative.
    const fautifs = fichiersSous("render")
      .filter((f) => /transitionner|PAS_FEUILLAISON|cycle-branche/.test(sansCommentaires(readFileSync(f, "utf-8"))))
      .map((f) => f.slice(RACINE.length + 1));
    expect(fautifs, "une transition calculée au rendu échapperait à toute garde d'écriture").toEqual([]);
  });
});

describe("[AC7 DUR] le nom d'une branche ne peut pas partir vers un modèle", () => {
  it("le constructeur de requête n'est appelé que par l'orchestrateur du retour sur le thème", () => {
    const appelants = [...fichiersSous("lib"), ...fichiersSous("app"), ...fichiersSous("render")]
      .filter((f) => !f.endsWith("retour-theme.ts")) // la définition
      .filter((f) => /requeteRetourTheme\s*\(/.test(sansCommentaires(readFileSync(f, "utf-8"))))
      .map((f) => f.slice(RACINE.length + 1));
    expect(appelants, "un second appelant construirait sa propre requête, hors de la garde art. 9").toEqual([
      "lib/safety/retour-theme-pipeline.ts",
    ]);
  });

  it("le domaine du retour sur le thème n'importe RIEN d'infra (AD-1 : module pur)", () => {
    const source = readFileSync(resolve(RACINE, "lib/domain/retour-theme.ts"), "utf-8");
    const imports = [...sansCommentaires(source).matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    for (const i of imports) {
      expect(i, `import interdit dans un module pur : ${i}`).toMatch(/^@\/lib\/(ai\/port|domain|scene)/);
    }
  });
});

describe("[FR-031] la feuillaison ne s'affiche jamais en chiffres", () => {
  it("le PAS de feuillaison n'est importé par AUCUN module de rendu", () => {
    // Un seuil qui atteint le rendu finit par s'afficher — « plus que 2 retours », « 60 % » — et c'est
    // exactement ce que FR-028 interdit : « aucun seuil affiché, aucune étape numérotée, aucun
    // « 2 retours sur 3 » ; l'utilisatrice n'a rien à confirmer ».
    const fautifs = fichiersSous("render")
      .filter((f) => /PAS_FEUILLAISON|branche_pas_feuillaison/.test(sansCommentaires(readFileSync(f, "utf-8"))))
      .map((f) => f.slice(RACINE.length + 1));
    expect(fautifs).toEqual([]);
  });

  it("la copie de l'arbre ne contient aucun mot de progression chiffrée", () => {
    const copie = readFileSync(resolve(RACINE, "render/arbre/copie-arbre.ts"), "utf-8");
    // On lit les VALEURS de chaîne, pas les identifiants : une garde par liste de mots appliquée au code
    // entier rougirait sur un nom de variable innocent (leçon de la re-revue 4.6).
    const textes = [...copie.matchAll(/["'`]([^"'`]{4,})["'`]/g)].map((m) => m[1]).join(" ");
    for (const interdit of [/\d\s*%/, /\bsur\s+\d/, /étape\s*\d/i, /niveau\s*\d/i]) {
      expect(textes, `la copie affiche une progression chiffrée (${interdit})`).not.toMatch(interdit);
    }
  });
});
