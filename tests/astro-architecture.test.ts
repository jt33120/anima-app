import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { calculerThemeNatal, type EntreesNaissance } from "@/lib/astro/theme-natal";
import { ephemerideAstronomyEngine } from "@/lib/astro/adapters/astronomy-engine";
import { modulesImportes, viseLeDossier } from "./_imports";

/**
 * Story 5.1 (T8) — LES INVARIANTS D'ARCHITECTURE DE LA COUCHE ASTRO (AD-6, AD-1, AC5, AC7).
 *
 * Quatre propriétés que les tests unitaires ne voient pas, parce qu'elles portent sur la FORME du
 * dépôt et non sur le comportement d'une fonction :
 *
 *   1. LA FRONTIÈRE DE DÉTERMINISME — aucun module de `lib/astro/` n'importe `@/lib/ai/*`. C'est
 *      AD-6 rendu mécanique : le socle EST un calcul, un modèle de langage n'y a aucune place.
 *   2. LE MONOPOLE DE L'ADAPTATEUR — `astronomy-engine` n'est importé que dans `lib/astro/adapters/`.
 *      C'est ce qui rend le moteur remplaçable sans toucher au domaine (AC5).
 *   3. LA PURETÉ — `lib/astro/` ne connaît ni `server-only`, ni Supabase, ni `app/`, ni `render/`.
 *      Sans ça le socle déterministe deviendrait dépendant d'une base et intestable sans elle.
 *   4. AUCUNE PROSE DANS LE THÈME — FR-053 (« le socle ne prédit jamais ») rendu STRUCTUREL.
 *
 * ══ ⚠️ LA GARDE 4 EST UNE GARDE D'ABSENCE — LIRE AVANT DE LA MODIFIER ═══════════════════════════
 *
 * Le fichier `tests/tronc-absence.test.ts` porte le même avertissement, et il a été trouvé FAUX
 * deux fois en revue 4.10 : un extracteur qui découpait au mauvais endroit, puis un extracteur
 * devenu vide après reformatage — et chercher un mot interdit dans une chaîne vide réussit
 * toujours. Une garde d'absence échoue silencieusement DANS LE BON SENS.
 *
 * Les trois disciplines sont appliquées ci-dessous et ne sont pas négociables :
 *   (a) l'extracteur est ÉPROUVÉ POUR LUI-MÊME, sur des objets fabriqués ;
 *   (b) PRÉSENCE AVANT ABSENCE : on prouve qu'il trouve des valeurs qu'on SAIT présentes ;
 *   (c) LE BALAYAGE N'EST JAMAIS VIDE : le nombre de chaînes inspectées est asserté non nul.
 */

const RACINE = process.cwd();

function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function fichiersTs(dossier: string): string[] {
  const chemin = resolve(RACINE, dossier);
  if (!existsSync(chemin)) return [];
  return (readdirSync(chemin, { recursive: true, encoding: "utf-8" }) as string[])
    .filter((f) => /\.tsx?$/.test(f) && !f.endsWith(".d.ts"))
    .map((f) => `${dossier}/${f}`);
}

const FICHIERS_ASTRO = fichiersTs("lib/astro");
/**
 * Les `.ts` de la RACINE — et c'est E4 (revue du 2026-08-12).
 *
 * `TOUTES_SOURCES` ne balayait que `app/`, `lib/` et `render/`. Or `proxy.ts` vit à la racine, et
 * c'est le middleware de Next 16 : il s'exécute sur CHAQUE REQUÊTE, avant tout le reste. Un import
 * d'éphéméride ou de SDK de modèle posé là aurait échappé à toutes les gardes de ce fichier — le
 * seul endroit du produit où le coût se paie à chaque page vue était le seul non surveillé.
 *
 * On prend tout ce qui est à la racine, sans liste d'exceptions : une liste s'oublie.
 */
function fichiersTsRacine(): string[] {
  return readdirSync(RACINE, { encoding: "utf-8" }).filter((f) => /\.tsx?$/.test(f) && !f.endsWith(".d.ts"));
}

const TOUTES_SOURCES = [
  ...fichiersTsRacine(),
  ...fichiersTs("app"),
  ...fichiersTs("lib"),
  ...fichiersTs("render"),
];

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 1. La frontière de déterminisme (AD-6 / NFR-011)
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AD-6/DUR] la frontière de déterminisme : lib/astro ne connaît aucun modèle de langage", () => {
  it("[CONTRÔLE DU CONTRÔLE] la couche astro a bien été balayée", () => {
    expect(FICHIERS_ASTRO.length, "aucun fichier trouvé dans lib/astro — garde vide").toBeGreaterThanOrEqual(4);
    expect(FICHIERS_ASTRO).toContain("lib/astro/theme-natal.ts");
    expect(FICHIERS_ASTRO).toContain("lib/astro/port.ts");
    expect(FICHIERS_ASTRO).toContain("lib/astro/adapters/astronomy-engine.ts");
    // Story 5.2 — la numérologie est du socle, elle vit sous les mêmes gardes.
    expect(FICHIERS_ASTRO).toContain("lib/astro/numerologie.ts");
    // Story 5.3 — le référentiel des lieux est une ENTRÉE du socle : même couche, mêmes gardes.
    expect(FICHIERS_ASTRO).toContain("lib/astro/lieux.ts");
    expect(FICHIERS_ASTRO).toContain("lib/astro/adapters/lieux-france.ts");
    // Story 5.4 — le socle QUOTIDIEN (ciel du jour, configurations) est du calcul comme le reste.
    expect(FICHIERS_ASTRO).toContain("lib/astro/quotidien.ts");
  });

  it("aucun module de lib/astro n'importe @/lib/ai — le socle est calculé, jamais généré", () => {
    for (const f of FICHIERS_ASTRO) {
      const src = sansCommentaires(readFileSync(resolve(RACINE, f), "utf-8"));
      expect(src, `${f} importe la couche IA — AD-6 est franchi`).not.toMatch(/from\s*["']@\/lib\/ai/);
      // Un SDK fournisseur importé en direct serait la même faute par un autre chemin.
      expect(src, `${f} importe un SDK de modèle`).not.toMatch(/from\s*["'](@mistralai|openai|@anthropic)/);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 1 bis. Aucune horloge, aucun hasard (Story 5.2, AC3)
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC3/DUR] lib/astro n'a ni horloge implicite ni hasard", () => {
  /**
   * Le déterminisme d'un socle ne se prouve pas seulement par « deux appels rendent la même chose » :
   * un module qui lit l'heure passe ce test-là tant qu'on l'exécute vite. Ce qui le prouve
   * vraiment, c'est qu'il n'existe AUCUN moyen de lire l'heure depuis la couche.
   *
   * `new Date(...)` AVEC arguments reste permis : c'est une construction de date à partir de
   * valeurs, pas une lecture de « maintenant » — `theme-natal.ts` s'en sert pour bâtir l'instant de
   * naissance. C'est la forme SANS argument qui est bannie, avec `Date.now()` et `Math.random()`.
   */
  /**
   * ⚠️ CINQ FORMES SUR SIX PASSAIENT (revue du 2026-08-12, E6).
   *
   * Le motif unique `new Date()` ne reconnaissait que la forme la plus explicite. Mesuré :
   *
   *     new Date;              → passait   (l'opérateur `new` n'exige pas de parenthèses)
   *     Date();                → passait   (appelée en fonction, rend l'heure courante en chaîne)
   *     performance.now()      → passait   (horloge monotone, mais horloge)
   *     crypto.randomUUID()    → passait   (hasard sans `Math.random`)
   *     await import("…")      → passait   (échappatoire aux monopoles d'adaptateur)
   *
   * Aucune n'est exotique : `new Date` sans parenthèses est une écriture courante, et
   * `performance.now()` est ce qu'on écrit spontanément pour mesurer un calcul. Le déterminisme du
   * socle (NFR-011, FR-047) tombe pareil dans les cinq cas.
   */
  const HORLOGES: Array<[RegExp, string]> = [
    [/new\s+Date\b(?!\s*\(\s*[^)\s])/, "new Date sans argument"],
    [/(?<!new\s)(?<![.\w$])Date\s*\(/, "Date() appelée en fonction"],
    [/\bDate\.now\s*\(/, "Date.now()"],
    [/\bperformance\s*\.\s*now\s*\(/, "performance.now()"],
    [/\bMath\.random\s*\(/, "Math.random()"],
    [/\bcrypto\s*\.\s*(randomUUID|getRandomValues)\s*\(/, "crypto aléatoire"],
    [/process\.env/, "variable d'environnement"],
  ];

  it("[CONTRÔLE DU CONTRÔLE] les motifs bannis attrapent bien les six formes", () => {
    const mord = (src: string) => HORLOGES.some(([m]) => m.test(src));
    for (const coupable of [
      "const d = new Date();",
      "const d = new Date;",
      "const d = Date();",
      "const t = performance.now();",
      "const t = Date.now();",
      "const x = Math.random();",
      "const id = crypto.randomUUID();",
      "const k = process.env.CLE;",
    ]) {
      expect(mord(coupable), `le motif rate « ${coupable} »`).toBe(true);
    }
    // Et il ne mord PAS sur les constructions de date à partir de valeurs, qui sont légitimes.
    for (const legitime of [
      "new Date(Date.UTC(2026, 0, 1))",
      "new Date(naif - decalage * 60000)",
      "return new Date(terme);",
      "const t = new Date(iso).getTime();",
    ]) {
      expect(mord(legitime), `le motif mord sur « ${legitime} »`).toBe(false);
    }
  });

  it("[CONTRÔLE POSITIF] les constructions de date à partir de valeurs sont bien présentes", () => {
    // Sans ce témoin, « aucune horloge » serait vrai d'une couche qui n'aurait aucune date du tout.
    //
    // ⚠️ LE TÉMOIN VISE UN FAIT, PAS UNE TOURNURE (revue du 2026-08-12). Il exigeait la forme
    // exacte `new Date(Date.UTC(…))` ; extraire le calcul de midi dans `midiDuJourLocal` — qui
    // écrit `const naif = Date.UTC(…)` puis `new Date(naif)` — a fait rougir la garde alors que le
    // fichier construit toujours autant de dates à partir de valeurs. Un témoin de présence qui
    // dépend de la MISE EN FORME finit par être assoupli lors d'un refactor de routine, et ce
    // jour-là c'est la garde entière qu'on perd. On vérifie donc les deux faits séparément.
    const natal = sansCommentaires(readFileSync(resolve(RACINE, "lib/astro/theme-natal.ts"), "utf-8"));
    expect(natal, "aucun calendrier explicite").toMatch(/\bDate\.UTC\s*\(/);
    expect(natal, "aucune date construite depuis une valeur").toMatch(/new\s+Date\s*\(\s*[^)\s]/);
  });

  it("aucun module de lib/astro ne lit l'heure ni ne tire au hasard", () => {
    for (const f of FICHIERS_ASTRO) {
      const src = sansCommentaires(readFileSync(resolve(RACINE, f), "utf-8"));
      for (const [motif, nom] of HORLOGES) {
        expect(motif.test(src), `${f} : ${nom} — le déterminisme est perdu`).toBe(false);
      }
    }
  });

  it("[E6] aucun import DYNAMIQUE dans lib/astro — ce serait l'échappatoire aux monopoles", () => {
    // Toutes les gardes de monopole de ce fichier interrogent les modules importés. Un
    // `await import("astronomy-engine")` y est désormais visible (E5) ; on interdit en plus la
    // forme elle-même dans le socle, où elle n'a aucune raison d'être : un calcul pur ne charge
    // rien à la demande, et ce qui est chargé à la demande n'est pas balayable statiquement.
    for (const f of FICHIERS_ASTRO) {
      const src = sansCommentaires(readFileSync(resolve(RACINE, f), "utf-8"));
      expect(/\bimport\s*\(/.test(src), `${f} charge un module à la demande`).toBe(false);
      expect(/\brequire\s*\(/.test(src), `${f} utilise require`).toBe(false);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 2. Le monopole de l'adaptateur (AC5)
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC5/DUR] `astronomy-engine` n'existe que dans lib/astro/adapters/", () => {
  /**
   * La SEULE exception au monopole, et elle est inscrite ici plutôt que tolérée en silence :
   * `tests/theme-natal.test.ts` importe la bibliothèque directement pour vérifier notre
   * trigonométrie sphérique par un chemin indépendant. Une vérification croisée qui passerait par
   * le code qu'elle vérifie ne vérifierait rien.
   */
  const AUTORISES = ["lib/astro/adapters/astronomy-engine.ts"];

  it("[CONTRÔLE DU CONTRÔLE] le balayage couvre app/, lib/ et render/, et n'est pas vide", () => {
    expect(TOUTES_SOURCES.length, "balayage vide : la garde passerait toujours").toBeGreaterThan(100);
    expect(TOUTES_SOURCES.some((f) => f.startsWith("app/"))).toBe(true);
    expect(TOUTES_SOURCES.some((f) => f.startsWith("lib/"))).toBe(true);
    expect(TOUTES_SOURCES.some((f) => f.startsWith("render/"))).toBe(true);
    // E4 : le middleware, qui tourne sur chaque requête, doit être DANS le balayage.
    expect(TOUTES_SOURCES, "proxy.ts hors du balayage — cf. E4").toContain("proxy.ts");
  });

  it("[CONTRÔLE POSITIF] l'adaptateur autorisé l'importe bien — sinon la garde ne prouve rien", () => {
    const src = sansCommentaires(readFileSync(resolve(RACINE, AUTORISES[0]), "utf-8"));
    expect(src).toMatch(/from\s*["']astronomy-engine["']/);
  });

  it("aucun AUTRE fichier du produit ne l'importe", () => {
    // E5 (revue du 2026-08-12) : le motif était `from "astronomy-engine"`. Un
    // `await import("astronomy-engine")` — la forme même qu'on écrirait pour « ne le charger qu'au
    // besoin », donc la plus tentante — passait à travers. On interroge la liste des modules.
    const coupables = TOUTES_SOURCES.filter(
      (f) =>
        !AUTORISES.includes(f) &&
        modulesImportes(sansCommentaires(readFileSync(resolve(RACINE, f), "utf-8"))).includes(
          "astronomy-engine",
        ),
    );
    expect(coupables, `moteur d'éphéméride hors de son adaptateur : ${coupables.join(", ")}`).toEqual([]);
  });

  /**
   * Story 5.3 — MÊME MONOPOLE POUR LE RÉFÉRENTIEL DES LIEUX, et pour une raison de plus que la
   * frontière : le fichier pèse 1,4 Mo. Un import égaré ailleurs le ferait parser au démarrage à
   * froid d'une fonction qui ne cherche jamais de lieu. La contrainte d'architecture et la
   * contrainte de coût pointent ici dans le même sens.
   */
  it("[DUR] `communes-france.json` n'est importé QUE par son adaptateur", () => {
    const autorise = "lib/astro/adapters/lieux-france.ts";
    // CONTRÔLE POSITIF d'abord : sans lui, un fichier de données renommé rendrait la garde vraie
    // pour rien — et le référentiel aurait disparu sans un seul rouge.
    expect(
      sansCommentaires(readFileSync(resolve(RACINE, autorise), "utf-8")),
      "l'adaptateur n'importe plus son référentiel",
    ).toMatch(/from\s*["']\.\/communes-france\.json["']/);

    const coupables = TOUTES_SOURCES.filter(
      (f) =>
        f !== autorise &&
        modulesImportes(sansCommentaires(readFileSync(resolve(RACINE, f), "utf-8"))).some((m) =>
          m.endsWith("communes-france.json"),
        ),
    );
    expect(coupables, `référentiel de lieux importé hors de son adaptateur : ${coupables.join(", ")}`).toEqual([]);
  });

  it("le reste du produit ne connaît que le PORT, jamais l'adaptateur nommé", () => {
    /*
     * Les POINTS DE COMPOSITION, énumérés — pas une famille de chemins tolérée.
     *
     * Un adaptateur doit bien être instancié quelque part ; ce qui compte est que la liste des
     * endroits où cela arrive soit COURTE et ÉCRITE, de sorte qu'en ajouter un soit une décision
     * visible en revue plutôt qu'un import de plus.
     *
     *   • `lib/data/depot-theme-natal.ts` — compose l'éphéméride pour le calcul du thème (5.1) ;
     *   • `app/heure-naissance/actions.ts` — compose le référentiel de LIEUX pour la recherche de
     *     commune (5.3). Il est dans `app/` et pas dans `lib/data/` parce qu'il n'y a rien à
     *     stocker : la recherche ne touche aucune table, elle lit un fichier embarqué.
     *   • `lib/data/lire-quotidien.ts` — compose l'éphéméride pour le CIEL DU JOUR (5.4), et la
     *     passe à `lireThemeNatal` pour qu'une seule source serve les deux calculs du chemin.
     *   • `lib/data/lire-bibliotheque.ts` — même raison, un cran plus haut (5.6) : l'accueil lit le
     *     socle, et son éphéméride descend jusqu'au ciel du jour.
     *   • `app/page.tsx` — LE point de composition de la page (5.6). Il lit le thème natal UNE FOIS
     *     et le passe à ses deux consommateurs (`chargerProjectionArbre` et la bibliothèque), qui
     *     vivent dans le même `Promise.all`. Sans cela, le premier chargement d'un compte lançait
     *     deux calculs concurrents et deux écritures en course.
     *   • `lib/data/corriger-naissance.ts` — compose l'éphéméride pour l'APERÇU de correction
     *     (6.5b). C'est le seul point du produit qui calcule un thème SANS L'ÉCRIRE : montrer
     *     l'ascendant qu'une heure ferait gagner ou perdre avant de graver quoi que ce soit. Il
     *     l'injecte par le même paramètre par défaut que `depot-theme-natal.ts`, pour la même
     *     raison — un test doit pouvoir doubler le port.
     *
     * Aucun de ces fichiers ne dépend du CONTENU de son adaptateur : tous ne manipulent que
     * les types du port.
     */
    // E5 : le motif exigeait l'alias `@/lib/astro/adapters/`. Un `../astro/adapters/x` désigne
    // exactement le même fichier et n'aurait rien déclenché — c'est ainsi qu'on ajoute un point de
    // composition sans que personne ne le voie en revue.
    const referents = TOUTES_SOURCES.filter(
      (f) =>
        !f.startsWith("lib/astro/") &&
        modulesImportes(sansCommentaires(readFileSync(resolve(RACINE, f), "utf-8"))).some((m) =>
          viseLeDossier(m, "astro/adapters"),
        ),
    );
    expect(referents.sort()).toEqual([
      "app/heure-naissance/actions.ts",
      "app/page.tsx",
      "lib/data/corriger-naissance.ts",
      "lib/data/depot-theme-natal.ts",
      "lib/data/lire-bibliotheque.ts",
      "lib/data/lire-quotidien.ts",
    ]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 2 bis. Story 5.4 — la prose ne remonte pas dans le socle, le personnel n'y descend pas
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.4 / D9 / DUR] lib/astro n'importe JAMAIS lib/corpus — la dépendance va dans l'autre sens", () => {
  it("[CONTRÔLE POSITIF] le sens AUTORISÉ existe bien — sinon la garde ne prouve rien", () => {
    // `lib/corpus/` connaît le domaine : c'est ainsi que `mantra.ts` obtient sa rotation et que
    // `horoscope.ts` connaît les aspects. Si plus personne ne le faisait, la garde inverse
    // ci-dessous serait vraie pour rien.
    const versAstro = fichiersTs("lib/corpus").filter((f) =>
      /from\s*["']@\/lib\/astro\//.test(sansCommentaires(readFileSync(resolve(RACINE, f), "utf-8"))),
    );
    expect(versAstro.length, "aucun corpus n'importe le domaine — sens autorisé disparu").toBeGreaterThan(0);
  });

  it("aucun module de lib/astro n'importe lib/corpus", () => {
    // C'est la garde qui maintient « le socle ne contient AUCUNE prose » (FR-053) vraie. Le jour où
    // `lib/astro` importerait un corpus, il pourrait rendre du texte — et la garde d'absence sur
    // `ThemeNatal` / `HoroscopeDuJour`, qui surveille l'apparition d'un champ de prose, cesserait
    // de protéger quoi que ce soit.
    for (const f of FICHIERS_ASTRO) {
      const src = sansCommentaires(readFileSync(resolve(RACINE, f), "utf-8"));
      expect(src, `${f} importe lib/corpus — la prose entre dans le socle`).not.toMatch(
        /from\s*["']@?[./]*lib\/corpus/,
      );
    }
  });
});

describe("[5.4 / FR-033 / P8/DUR] le socle quotidien ne peut PAS atteindre l'histoire personnelle", () => {
  /*
   * « Il ne référence jamais le journal, une branche ou un échange » (FR-033) est le contrat qui
   * rend le rythme quotidien acceptable. Le rendre structurel, c'est refuser à ces modules l'ACCÈS
   * MÊME à ces notions : une consigne s'enfreint par distraction, un import manquant non.
   *
   * La signature de `mantraDuJour(jour)` et de `horoscopeDuJour(theme, jour, ephemeride)` ferme la
   * porte côté paramètres ; cette garde la ferme côté imports.
   */
  const MODULES_QUOTIDIENS = [
    "lib/astro/quotidien.ts",
    "lib/corpus/mantra.ts",
    "lib/corpus/horoscope.ts",
  ];

  /**
   * Chaque motif porte SON témoin — et c'est E8 (revue du 2026-08-12).
   *
   * Le contrôle-du-contrôle s'écrivait `PERSONNEL.some(([m]) => m.test(faux))` sur UNE seule chaîne
   * fabriquée (`depot-journal`). `.some()` s'arrête au premier motif qui mord : le premier était
   * donc certifié, et les QUATRE AUTRES pouvaient être cassés — une faute de frappe, un chemin
   * renommé — sans que rien ne l'indique. Un contrôle-du-contrôle qui n'en contrôle qu'un cinquième
   * est plus dangereux que pas de contrôle : il porte le nom qui rassure.
   */
  const PERSONNEL: Array<[RegExp, string, string]> = [
    [/depot-journal|\bjournal\b/, "le journal", 'import { lireJournal } from "@/lib/data/depot-journal";'],
    [/lib\/domain\/branche|depot-branche/, "les branches", 'import { poser } from "@/lib/data/depot-branche";'],
    [/depot-seance|lib\/domain\/seance|arc-seance/, "les séances", 'import { phase } from "@/lib/domain/arc-seance";'],
    [/lib\/domain\/synthese|depot-synthese/, "les synthèses", 'import { lire } from "@/lib/data/depot-synthese";'],
    [/depot-faits|fusion-fait/, "les faits extraits", 'import { fusionner } from "@/lib/domain/fusion-fait";'],
  ];

  it("[CONTRÔLE DU CONTRÔLE] les trois modules existent et sont lus", () => {
    for (const f of MODULES_QUOTIDIENS) {
      expect(existsSync(resolve(RACINE, f)), `${f} introuvable — garde vide`).toBe(true);
    }
  });

  it("[CONTRÔLE DU CONTRÔLE] CHAQUE motif mord sur son propre témoin (E8)", () => {
    for (const [motif, nom, temoin] of PERSONNEL) {
      expect(motif.test(temoin), `le motif de « ${nom} » ne mord pas sur son témoin`).toBe(true);
    }
    // Et aucun ne mord sur du socle légitime : sinon les gardes seraient inutilisables.
    for (const [motif, nom] of PERSONNEL) {
      expect(
        motif.test('import { CORPS } from "@/lib/astro/port";'),
        `le motif de « ${nom} » mord sur du socle`,
      ).toBe(false);
    }
  });

  it("aucun des trois ne connaît le journal, une branche, une séance, une synthèse ou un fait", () => {
    for (const f of MODULES_QUOTIDIENS) {
      const src = sansCommentaires(readFileSync(resolve(RACINE, f), "utf-8"));
      for (const [motif, nom] of PERSONNEL) {
        expect(motif.test(src), `${f} atteint ${nom} — FR-033 est franchi`).toBe(false);
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 3. La pureté de la couche (AD-1)
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AD-1/DUR] lib/astro est PUR — testable sans base, sans réseau, sans Next", () => {
  it("aucun `server-only`, aucun import runtime d'infra ni de rendu", () => {
    for (const f of FICHIERS_ASTRO) {
      const src = sansCommentaires(readFileSync(resolve(RACINE, f), "utf-8"));
      expect(src, `${f} : \`server-only\` interdit dans la couche astro`).not.toMatch(/server-only/);
      expect(src, `${f} : import runtime d'infra/rendu interdit`).not.toMatch(
        /^\s*import\s+(?!type\b)[^;]*from\s*["'](?:@supabase|next|next\/|@\/lib\/data|@\/app|@\/render)/m,
      );
    }
  });

  it("[LE SENS QUI COMPTE] lib/astro n'importe JAMAIS lib/data — l'inverse est permis et sûr", () => {
    // `lib/data` remonte vers `lib/astro` (composition), et c'est sans danger parce qu'`astro` est
    // pur. Le sens INVERSE rendrait le socle déterministe dépendant d'une base : c'est celui-là
    // qu'on interdit, et pas seulement en runtime — un `import type` d'une couche infra serait
    // déjà le signe que la frontière glisse.
    for (const f of FICHIERS_ASTRO) {
      const src = sansCommentaires(readFileSync(resolve(RACINE, f), "utf-8"));
      expect(src, `${f} : la couche astro dépend de la couche data`).not.toMatch(/@\/lib\/data/);
    }
  });

  it("[Story 5.5] `lib/astro` ne connaît PAS l'ennéagramme — ce n'est pas du ciel", () => {
    /*
     * ⚠️ L'INVENTAIRE DE CE FICHIER NE ROUGIT PAS TOUT SEUL (`toBeGreaterThanOrEqual`), donc chaque
     * story de socle doit venir y écrire ce qu'elle ajoute. La 5.5 n'ajoute RIEN à `lib/astro`, et
     * c'est la chose à consigner : un type d'ennéagramme ne se dérive d'aucune position
     * astronomique, il se dérive de SES RÉPONSES ou d'une inférence sur SES PAROLES.
     *
     * Le mettre ici serait tentant — c'est du calcul déterministe sur des nombres, exactement comme
     * la numérologie — et ce serait une faute de couche : `lib/astro` est la couche des ENTRÉES DE
     * NAISSANCE, et son unique test d'exhaustivité (« aucune prose ») ne dit rien d'utile sur un
     * questionnaire. Le domaine de l'ennéagramme vit dans `lib/domain`, sous la garde de pureté de
     * `tests/arc-architecture.test.ts`.
     */
    for (const f of FICHIERS_ASTRO) {
      const src = readFileSync(resolve(RACINE, f), "utf-8");
      expect(src, `${f} : l'ennéagramme n'a rien à faire dans la couche du ciel`).not.toMatch(
        /enn[ée]agramme/i,
      );
    }
  });

  it("le domaine n'importe pas son propre adaptateur (sinon le port ne servirait à rien)", () => {
    const domaine = FICHIERS_ASTRO.filter((f) => !f.startsWith("lib/astro/adapters/"));
    expect(domaine.length).toBeGreaterThanOrEqual(2);
    for (const f of domaine) {
      const src = sansCommentaires(readFileSync(resolve(RACINE, f), "utf-8"));
      expect(src, `${f} : le domaine connaît l'adaptateur`).not.toMatch(/adapters\//);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 4. Aucune prose dans le thème (FR-053 / AC7)
// ══════════════════════════════════════════════════════════════════════════════════════════════

/** L'EXTRACTEUR : toutes les chaînes de caractères d'un objet, clés comprises dans le chemin. */
function chainesDe(valeur: unknown, chemin = "$"): { chemin: string; valeur: string }[] {
  if (typeof valeur === "string") return [{ chemin, valeur }];
  if (Array.isArray(valeur)) return valeur.flatMap((v, i) => chainesDe(v, `${chemin}[${i}]`));
  if (typeof valeur === "object" && valeur !== null) {
    return Object.entries(valeur).flatMap(([k, v]) => chainesDe(v, `${chemin}.${k}`));
  }
  return [];
}

/**
 * Une chaîne « ressemble à de la prose » si elle contient une espace ou dépasse 40 caractères.
 *
 * La borne n'est pas arbitraire : la plus longue énumération du domaine est
 * `ephemeride_sans_asteroides` (26 caractères), et l'identifiant d'adaptateur le plus long
 * envisagé fait 23 caractères. 40 laisse de la marge sans laisser passer une phrase.
 */
function ressembleADeLaProse(v: string): boolean {
  return /\s/.test(v) || v.length > 40;
}

describe("[AC7/DUR] le thème natal ne contient AUCUNE prose — une prédiction n'a nulle part où s'écrire", () => {
  // ── (a) L'EXTRACTEUR EST ÉPROUVÉ POUR LUI-MÊME ──────────────────────────────────────────────
  describe("(a) l'extracteur, sur des objets fabriqués", () => {
    it("trouve les chaînes imbriquées dans les objets ET dans les tableaux", () => {
      const trouve = chainesDe({ a: "un", b: [{ c: "deux" }, "trois"], d: 4, e: null });
      expect(trouve.map((t) => t.valeur).sort()).toEqual(["deux", "trois", "un"]);
    });

    it("ne rend RIEN sur un objet sans chaîne — et c'est un cas qu'il faut savoir distinguer", () => {
      expect(chainesDe({ a: 1, b: [2, 3], c: null })).toEqual([]);
    });

    it("le détecteur de prose distingue une énumération d'une phrase", () => {
      expect(ressembleADeLaProse("ephemeride_sans_asteroides")).toBe(false);
      expect(ressembleADeLaProse("astronomy-engine@2.1.19")).toBe(false);
      expect(ressembleADeLaProse("belier")).toBe(false);
      expect(ressembleADeLaProse("Tu vas rencontrer quelqu'un")).toBe(true);
      expect(ressembleADeLaProse("Une periode favorable saprochedanslesmoisquiviennent")).toBe(true);
    });
  });

  // ── (b) PRÉSENCE AVANT ABSENCE + (c) BALAYAGE NON VIDE ──────────────────────────────────────
  const ephemeride = ephemerideAstronomyEngine();
  const cas: readonly (readonly [string, EntreesNaissance])[] = [
    [
      "thème complet",
      { date: "1990-06-15", heure: "07:15", fuseau: "Europe/Paris", latitude: 48.8566, longitude: 2.3522 },
    ],
    ["sans heure", { date: "1990-06-15" }],
    ["heure sans coordonnées", { date: "1990-06-15", heure: "07:15", fuseau: "Europe/Paris" }],
    ["au pôle", { date: "1990-06-15", heure: "07:15", fuseau: "UTC", latitude: 90, longitude: 0 }],
    ["hors plage temporelle", { date: "1650-03-02" }],
  ];

  it("(b) le balayage TROUVE les valeurs qu'on sait présentes — sinon il ne prouve rien", () => {
    const theme = calculerThemeNatal(cas[0][1], ephemeride);
    const valeurs = chainesDe(theme).map((c) => c.valeur);
    expect(valeurs).toContain("soleil");
    expect(valeurs).toContain("signes_entiers");
    expect(valeurs).toContain("heure_connue");
    expect(valeurs).toContain("astronomy-engine@2.1.19");
    // Chiron est ABSENT du thème complet : sa raison doit s'y trouver malgré tout.
    expect(valeurs).toContain("ephemeride_sans_asteroides");
  });

  it.each(cas)("(c) %s : le balayage n'est pas vide, et aucune chaîne n'est de la prose", (_nom, entrees) => {
    const theme = calculerThemeNatal(entrees, ephemeride);
    const chaines = chainesDe(theme);
    expect(chaines.length, "balayage vide : ce test passerait sur n'importe quoi").toBeGreaterThan(5);

    const proses = chaines.filter((c) => ressembleADeLaProse(c.valeur));
    expect(proses, `prose dans le thème : ${proses.map((p) => `${p.chemin} = « ${p.valeur} »`).join(" ; ")}`).toEqual([]);
  });

  it("les valeurs NUMÉRIQUES sont toutes finies — un NaN sérialisé deviendrait `null` en JSONB", () => {
    // `JSON.stringify(NaN)` rend `null`. Une longitude NaN se rangerait donc en base comme une
    // position absente, sans que rien ne le signale. La garde de `normaliserDegres` l'empêche en
    // amont ; celle-ci vérifie qu'aucun chemin ne la contourne.
    const theme = calculerThemeNatal(cas[0][1], ephemeride);
    const nombres: number[] = [];
    const marcher = (v: unknown): void => {
      if (typeof v === "number") nombres.push(v);
      else if (Array.isArray(v)) v.forEach(marcher);
      else if (typeof v === "object" && v !== null) Object.values(v).forEach(marcher);
    };
    marcher(theme);
    expect(nombres.length).toBeGreaterThan(20);
    for (const n of nombres) expect(Number.isFinite(n), `valeur non finie : ${n}`).toBe(true);
  });

  it("le thème survit à un aller-retour JSON sans perte — c'est ainsi qu'il est stocké", () => {
    const theme = calculerThemeNatal(cas[0][1], ephemeride);
    expect(JSON.parse(JSON.stringify(theme))).toEqual(theme);
  });
});
