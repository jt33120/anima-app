import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { calculerThemeNatal, type EntreesNaissance } from "@/lib/astro/theme-natal";
import { ephemerideAstronomyEngine } from "@/lib/astro/adapters/astronomy-engine";

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
const TOUTES_SOURCES = [...fichiersTs("app"), ...fichiersTs("lib"), ...fichiersTs("render")];

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
  it("[CONTRÔLE DU CONTRÔLE] les motifs bannis attrapent bien ce qu'ils visent", () => {
    const SANS_ARG = /new\s+Date\s*\(\s*\)/;
    expect(SANS_ARG.test("const d = new Date();"), "le motif rate `new Date()`").toBe(true);
    expect(SANS_ARG.test("new Date(Date.UTC(2026, 0, 1))"), "le motif mord sur du légitime").toBe(false);
  });

  it("[CONTRÔLE POSITIF] les constructions de date à partir de valeurs sont bien présentes", () => {
    // Sans ce témoin, « aucune horloge » serait vrai d'une couche qui n'aurait aucune date du tout.
    const natal = sansCommentaires(readFileSync(resolve(RACINE, "lib/astro/theme-natal.ts"), "utf-8"));
    expect(natal).toMatch(/new\s+Date\s*\(\s*Date\.UTC/);
  });

  it("aucun module de lib/astro ne lit l'heure ni ne tire au hasard", () => {
    for (const f of FICHIERS_ASTRO) {
      const src = sansCommentaires(readFileSync(resolve(RACINE, f), "utf-8"));
      expect(src, `${f} lit « maintenant » — le déterminisme est perdu`).not.toMatch(/new\s+Date\s*\(\s*\)/);
      expect(src, `${f} lit l'horloge`).not.toMatch(/\bDate\.now\s*\(/);
      expect(src, `${f} tire au hasard`).not.toMatch(/\bMath\.random\s*\(/);
      expect(src, `${f} lit une variable d'environnement`).not.toMatch(/process\.env/);
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
  });

  it("[CONTRÔLE POSITIF] l'adaptateur autorisé l'importe bien — sinon la garde ne prouve rien", () => {
    const src = sansCommentaires(readFileSync(resolve(RACINE, AUTORISES[0]), "utf-8"));
    expect(src).toMatch(/from\s*["']astronomy-engine["']/);
  });

  it("aucun AUTRE fichier de app/, lib/ ou render/ ne l'importe", () => {
    const coupables = TOUTES_SOURCES.filter((f) => {
      if (AUTORISES.includes(f)) return false;
      return /from\s*["']astronomy-engine["']/.test(
        sansCommentaires(readFileSync(resolve(RACINE, f), "utf-8")),
      );
    });
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
        /communes-france\.json/.test(sansCommentaires(readFileSync(resolve(RACINE, f), "utf-8"))),
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
     *
     * Aucun de ces deux fichiers ne dépend du CONTENU de son adaptateur : tous deux ne manipulent
     * que les types du port.
     */
    const referents = TOUTES_SOURCES.filter(
      (f) =>
        !f.startsWith("lib/astro/") &&
        /from\s*["']@\/lib\/astro\/adapters\//.test(
          sansCommentaires(readFileSync(resolve(RACINE, f), "utf-8")),
        ),
    );
    expect(referents.sort()).toEqual([
      "app/heure-naissance/actions.ts",
      "lib/data/depot-theme-natal.ts",
    ]);
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
