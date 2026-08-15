import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { tirerUneCarte } from "@/lib/tirage/tirer";
import { JEU, CLES_JEU, TAILLE_JEU } from "@/lib/tirage/jeu";

/**
 * tirage-architecture.test.ts — LA CONTRAINTE D'ARCHITECTURE, VÉRIFIÉE (Story 5.7, AC1/AC6 · AD-11).
 *
 * ══ CE QUE CE FICHIER GARDE, ET POURQUOI IL NE PEUT PAS ÊTRE UN SEUL TEST ═══════════════════════
 *
 * AD-11 exige que le point d'entrée du tirage n'ait AUCUN accès au profil, à l'historique ni à
 * l'état émotionnel, et précise : « contrainte d'architecture, PAS règle de code ». Trois gardes
 * distinctes, parce qu'une seule laisserait un chemin ouvert :
 *
 *   §1  L'ARITÉ. `tirerUneCarte()` ne prend rien. Ce qui n'a pas d'entrée ne peut pas être influencé.
 *   §2  LES IMPORTS RÉELS. Une fonction sans argument peut quand même ALLER CHERCHER un profil.
 *   §3  LE VERROU ESLINT. Pour que §2 reste vrai demain, à l'écriture, et pas seulement au test.
 *
 * ⚠️ PIÈGE CONNU DU DÉPÔT, ET RAISON D'ÊTRE DE §2. Un test qui ne lirait que `eslint.config.mjs`
 * serait VERT si le bloc visait un mauvais chemin — « lib/tirages » au pluriel, ou un motif qui ne
 * descend pas dans les sous-dossiers. Il garderait une garde qui ne garde rien. §2 lit donc les
 * FICHIERS EUX-MÊMES et
 * n'accorde aucune confiance à la config ; §3 vérifie la config pour que la faute soit signalée à
 * l'écriture plutôt qu'au test.
 *
 * ⚠️ ET LA REDONDANCE §1/§2 EST DÉLIBÉRÉE, DONC PIÉGEUSE. Deux défenses qui se couvrent l'une
 * l'autre laissent survivre le mutant : la campagne en exécute donc deux distincts (ajouter un
 * paramètre ; ajouter un import), chacun devant tuer sa propre garde et elle seule.
 */

const RACINE = resolve(process.cwd());
const DOSSIER_TIRAGE = resolve(RACINE, "lib/tirage");

/** Les fichiers de la couche. `lib/tirage/` est PLAT — un sous-dossier serait déjà une anomalie. */
const FICHIERS_TIRAGE = readdirSync(DOSSIER_TIRAGE).filter((f) => f.endsWith(".ts"));

/**
 * Les cibles interdites, chacune fermant une porte NOMMÉE. La liste est la même que celle du bloc
 * ESLint — elle est recopiée ici volontairement : si les deux divergeaient, c'est que quelqu'un
 * aurait relâché l'une des deux, et §3 le dira.
 */
const INTERDITS: readonly { motif: RegExp; porte: string }[] = [
  { motif: /@\/lib\/data\//, porte: "le profil, l'historique, les branches, les abonnements" },
  { motif: /@\/lib\/domain\//, porte: "le thème natal, la numérologie, l'ennéagramme — le profil calculé" },
  { motif: /@\/lib\/safety\//, porte: "l'épisode de détresse — l'ÉTAT ÉMOTIONNEL nommément visé par AD-11" },
  { motif: /@\/lib\/ai\//, porte: "aucun modèle ne choisit une carte (ce serait FR-016 par la grande porte)" },
  { motif: /@\/lib\/lecture\//, porte: "LE CATALOGUE DE SENS — la porte décisive de FR-016" },
  { motif: /@\/lib\/corpus\//, porte: "les textes des cartes, par l'autre bout" },
  { motif: /@\/app\//, porte: "l'application" },
  { motif: /@\/render\//, porte: "le rendu" },
  { motif: /@supabase\//, porte: "la base" },
  { motif: /from "next/, porte: "le framework" },
  { motif: /from "\.\.\//, porte: "tout « ../ » sort de la couche et échappe aux motifs par alias" },
];

/** Toutes les formes d'import, y compris celles que `no-restricted-imports` ne visite jamais. */
function specificateursImportes(source: string): string[] {
  const specs: string[] = [];
  for (const m of source.matchAll(/(?:^|\n)\s*import\s[^;]*?from\s+["']([^"']+)["']/g)) specs.push(m[1]);
  for (const m of source.matchAll(/(?:^|\n)\s*import\s+["']([^"']+)["']/g)) specs.push(m[1]);
  for (const m of source.matchAll(/(?:^|\n)\s*export\s[^;]*?from\s+["']([^"']+)["']/g)) specs.push(m[1]);
  // L'import DYNAMIQUE — jamais présenté à `no-restricted-imports`, donc c'est ici, et seulement
  // ici, qu'il peut être attrapé côté source.
  for (const m of source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) specs.push(m[1]);
  return specs;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 1. L'ARITÉ — la garde qui vit dans la signature
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC1] le point d'entrée du tirage ne prend AUCUN argument", () => {
  it("`tirerUneCarte` a une arité de zéro", () => {
    // La traduction en code de « le point d'entrée n'a aucun accès au profil ». Une fonction
    // `tirerUneCarte(utilisatriceId)` qui PROMETTRAIT de ne pas s'en servir serait vraie aujourd'hui
    // et fausse le jour où quelqu'un voudra « éviter de retomber deux fois sur la même carte » —
    // intention bienveillante, défaut critique FR-016. Sans paramètre, ça ne s'écrit pas.
    expect(tirerUneCarte.length).toBe(0);
  });

  it("le tirage rend la carte, la graine et la taille du jeu — et rien qui vienne d'une personne", () => {
    const t = tirerUneCarte();
    expect(Object.keys(t).sort()).toEqual(["cle", "graine", "tailleJeu"]);
    expect(CLES_JEU).toContain(t.cle);
    expect(t.graine).toMatch(/^[0-9a-f]{8}$/);
    expect(t.tailleJeu).toBe(TAILLE_JEU);
  });

  it("`tirer.ts` porte `server-only` — un tirage côté client serait re-jouable à volonté", () => {
    const src = readFileSync(resolve(DOSSIER_TIRAGE, "tirer.ts"), "utf8");
    expect(src).toMatch(/^import "server-only";/m);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 2. LES IMPORTS RÉELS — la garde qui ne fait pas confiance à la config
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC1/AC6] `lib/tirage/` n'importe rien qui puisse porter un profil ou un sens", () => {
  it("la couche est plate et non vide (garde SUR la garde : un scanner aveugle serait vert)", () => {
    expect(FICHIERS_TIRAGE.sort()).toEqual(["alea.ts", "jeu.ts", "tirer.ts"]);
  });

  it.each(FICHIERS_TIRAGE)("%s n'importe aucune cible interdite", (fichier) => {
    const specs = specificateursImportes(readFileSync(resolve(DOSSIER_TIRAGE, fichier), "utf8"));
    for (const spec of specs) {
      for (const { motif, porte } of INTERDITS) {
        expect(
          motif.test(`from "${spec}"`) || motif.test(spec),
          `${fichier} importe « ${spec} » — AD-11 ferme cette porte : ${porte}`,
        ).toBe(false);
      }
    }
  });

  it("le scanner MORD — prouvé sur une fausse source (sinon il serait vert sur un dossier vide)", () => {
    const faux = [
      'import { lireThemeNatal } from "@/lib/data/depot-theme-natal";',
      'import { episodeDetresseOuvert } from "@/lib/safety/episode-lecture";',
      'import { lireSensCarte } from "@/lib/lecture/sens-cartes";',
      'const x = await import("@supabase/supabase-js");',
      'import { truc } from "../data/quelque-chose";',
    ].join("\n");
    const specs = specificateursImportes(faux);
    expect(specs).toHaveLength(5);
    const attrapes = specs.filter((s) => INTERDITS.some(({ motif }) => motif.test(`from "${s}"`) || motif.test(s)));
    expect(attrapes).toHaveLength(5);
  });

  it("`Math.random` n'apparaît nulle part dans la couche", () => {
    for (const fichier of FICHIERS_TIRAGE) {
      const src = readFileSync(resolve(DOSSIER_TIRAGE, fichier), "utf8");
      // ⚠️ On ignore les lignes de commentaire : `alea.ts` NOMME `Math.random` pour expliquer
      // pourquoi il est refusé, et interdire d'en parler reviendrait à interdire de l'expliquer.
      const codeSeul = src
        .split("\n")
        .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
        .join("\n");
      expect(codeSeul, fichier).not.toMatch(/Math\s*\.\s*random/);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 3. LE VERROU ESLINT — pour que §2 reste vrai à l'écriture
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC1] le verrou ESLint existe et vise la bonne couche", () => {
  const config = readFileSync(resolve(RACINE, "eslint.config.mjs"), "utf8");

  it("un bloc vise `lib/tirage/**`", () => {
    expect(config).toMatch(/files:\s*\["lib\/tirage\/\*\*\/\*\.\{ts,tsx\}"\]/);
  });

  it.each([
    "@/lib/data/*",
    "@/lib/domain/*",
    "@/lib/safety/*",
    "@/lib/ai/*",
    "@/lib/lecture/*",
    "@/lib/corpus/*",
    "@/app/*",
    "@/render/*",
    "@supabase/*",
  ])("« %s » est nommément interdit", (cible) => {
    // On vérifie la présence de la cible APRÈS l'ancre du bloc, pour ne pas confondre avec le bloc
    // `lib/domain/**` qui interdit des cibles voisines.
    const bloc = config.slice(config.indexOf('files: ["lib/tirage/**/*.{ts,tsx}"]'));
    expect(bloc).toContain(`"${cible}"`);
  });

  it("l'import dynamique et `Math.random` sont fermés par `no-restricted-syntax`", () => {
    const bloc = config.slice(config.indexOf('files: ["lib/tirage/**/*.{ts,tsx}"]'));
    expect(bloc).toContain("ImportExpression");
    expect(bloc).toContain("MemberExpression[object.name='Math'][property.name='random']");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 4. LE JEU NE PORTE AUCUN CRITÈRE DE CHOIX
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC6] une carte est un nom, et rien d'autre", () => {
  it("chaque carte n'a QUE le champ `cle`", () => {
    // Tout attribut supplémentaire deviendrait un critère de choix disponible pour l'échantillonneur,
    // qui est le seul lecteur de ce fichier. `poids`, `famille`, `rarete` : c'est par là que FR-016
    // rentrerait, avec les meilleures intentions du monde.
    for (const carte of JEU) {
      expect(Object.keys(carte)).toEqual(["cle"]);
    }
  });

  it("21 cartes, toutes distinctes, toutes gelées", () => {
    expect(TAILLE_JEU).toBe(21);
    expect(new Set(CLES_JEU).size).toBe(21);
    expect(Object.isFrozen(JEU)).toBe(true);
    expect(JEU.every((c) => Object.isFrozen(c))).toBe(true);
  });

  it("la taille du jeu n'est pas une puissance de deux — sinon la zone de rejet serait vide", () => {
    // Propriété load-bearing, pas cosmétique : avec une puissance de deux, `2**32 % taille === 0`,
    // aucun mot n'est jamais rejeté, et un échantillonneur biaisé devient indiscernable d'un
    // échantillonneur correct SUR LE CHEMIN RÉEL. Si cette assertion rougit un jour, il faut relire
    // `tests/tirage-alea.test.ts` §1 avant de changer le nombre.
    expect(2 ** 32 % TAILLE_JEU).not.toBe(0);
  });
});
