import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { sansCommentaires } from "./_absence";

/**
 * qa-visuelle-19-aout.test.ts — CE QUE 5 007 TESTS N'ONT PAS VU
 *
 * Le tour de QA visuelle du 2026-08-19 a mesuré, dans un vrai navigateur, une série de défauts sur
 * lesquels TOUTE la suite était verte. Ce fichier ne rejoue pas la QA — il rend impossible le
 * retour de ceux qui sont vérifiables sans navigateur.
 *
 * ⚠️ CE QU'IL NE COUVRE PAS, ET IL FAUT LE DIRE. Une cible tactile RENDUE, une couleur COMPOSITÉE,
 * un chevauchement de barre de navigation : rien de tout ça ne se lit dans une feuille de style.
 * Ces points-là vivent dans `e2e/`, où un navigateur les mesure pour de bon. Une garde de source
 * qui prétendrait les couvrir donnerait le pire des deux mondes : verte, et fausse.
 */

const RACINE = process.cwd();
const lire = (p: string) => readFileSync(resolve(RACINE, p), "utf-8");

function fichiers(extension: string): string[] {
  const trouves: string[] = [];
  for (const dossier of ["app", "render"]) {
    for (const f of readdirSync(resolve(RACINE, dossier), {
      recursive: true,
      encoding: "utf-8",
    }) as string[]) {
      if (f.endsWith(extension)) trouves.push(`${dossier}/${f}`);
    }
  }
  return trouves;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// L'ANNEAU DE FOCUS — un seul, partout
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[QA 19/08] il n'existe qu'un seul anneau de focus", () => {
  it("[LE CŒUR] toute déclaration `outline` passe par `--bordure-forte`", () => {
    // ⚠️ JULIAN AVAIT RAISON, ET LA MESURE EN NAVIGATEUR L'A DÉMENTI À TORT. Le tour de QA a compté
    // « 14 règles, toutes identiques » — mais il ne pouvait voir que les feuilles chargées par les
    // onze écrans visités. La source en portait 41, dont HUIT divergentes : sept en `var(--texte)`
    // et une en `var(--accent)`, c'est-à-dire la couleur de l'action posée sur un anneau de focus.
    //
    // C'est exactement pourquoi cette garde-ci lit la SOURCE : un navigateur ne mesure que ce qu'il
    // a chargé, et l'écran qui porte la divergence est toujours celui qu'on n'a pas ouvert.
    const fautives: string[] = [];
    for (const f of fichiers(".module.css")) {
      for (const m of lire(f).matchAll(/outline:\s*([^;]+);/g)) {
        const valeur = m[1].trim();
        if (valeur !== "2px solid var(--bordure-forte)") fautives.push(`${f} → ${valeur}`);
      }
    }
    expect(fautives, `anneaux de focus divergents :\n${fautives.join("\n")}`).toEqual([]);
  });

  it("et il en reste réellement — la garde ne passe pas en ne mesurant rien", () => {
    const total = fichiers(".module.css").reduce(
      (n, f) => n + [...lire(f).matchAll(/outline:\s*[^;]+;/g)].length,
      0,
    );
    expect(total, "plus aucun anneau de focus dans le produit ?").toBeGreaterThan(20);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LA VOIX — le produit tutoie, sans exception
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[QA 19/08] le produit tutoie, et ne se reprend pas en cours de phrase", () => {
  it("[LE CŒUR] aucun vouvoiement dans une chaîne affichée", () => {
    // Le défaut mesuré tenait dans UNE phrase de `/memoire` : « Voici ce qu'Anam a retenu de VOS
    // échanges, dans ses mots. TU peux corriger… » — les deux registres à six mots d'écart. Ce
    // n'est pas une faute de style : c'est le moment où le produit cesse d'être quelqu'un.
    //
    // On lit les chaînes, jamais les commentaires : treize occurrences légitimes vivent dans des
    // explications et une expression régulière, et une garde qui les compterait serait abandonnée
    // au bout de deux jours.
    const fautives: string[] = [];
    const sources = [
      ...fichiers(".tsx"),
      ...fichiers(".ts"),
      ...(readdirSync(resolve(RACINE, "lib/domain"), { encoding: "utf-8" }) as string[])
        .filter((f) => f.endsWith(".ts"))
        .map((f) => `lib/domain/${f}`),
    ];
    for (const f of sources) {
      if (f.includes(".test.")) continue;
      const src = sansCommentaires(lire(f));
      for (const m of src.matchAll(/["'`]([^"'`\n]{12,})["'`]/g)) {
        const texte = m[1];
        // On ne garde que ce qui ressemble à de la PROSE. Sans ce filtre, la garde relève des
        // expressions régulières (`/\b(ton|ta|votre) (avenir|futur)\b/`) et des fragments de code
        // pris entre deux guillemets sur des lignes différentes — du bruit qui la ferait abandonner.
        if (/[\\/{}<>|]/.test(texte)) continue;
        // ⚠️ « rendez-VOUS » N'EST PAS UN VOUVOIEMENT. Le trait d'union est une frontière de mot :
        // la première version de cette garde a accusé « heure de ton rendez-vous quotidien ».
        if (/(?<!-)\b(vous|vos|votre)\b/i.test(texte)) fautives.push(`${f} → « ${texte.slice(0, 90)} »`);
      }
    }
    expect(fautives, `vouvoiement affiché :\n${fautives.join("\n")}`).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LA PORTE DE SECOURS — une cible, pas une hauteur
// ══════════════════════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════════════════════
// L'APOSTROPHE — typographique à l'écran, droite dans les détecteurs
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[QA 19/08] le produit n'écrit qu'une sorte d'apostrophe", () => {
  /**
   * ⚠️ TROIS FICHIERS GARDENT L'APOSTROPHE DROITE, ET LES EXEMPTER N'EST PAS UNE COMMODITÉ.
   *
   * Leurs motifs s'appliquent à du texte NORMALISÉ, où `normaliserTexte` a déjà ramené « ’ » à
   * « ' ». Les convertir rendrait `/\bt'[a-z]+(?:ra|ront)\b/` incapable de reconnaître « il
   * t'arrivera » — un détecteur de tournure prédictive mort en silence, sur un produit qui promet
   * de ne jamais prédire. Aucun test ne rougirait : le motif serait juste devenu inutile.
   *
   * J'ai d'abord ANNULÉ toute la conversion en croyant ce risque réel, avant de lire le
   * normaliseur et de voir qu'il unifiait déjà les deux formes. Le risque n'existait que pour ces
   * trois fichiers-là, et il est nommé ici pour qu'on n'ait plus à le redécouvrir.
   */
  const DETECTEURS = [
    "lib/domain/lexique-interdit.ts",
    "lib/domain/marqueurs-prediction.ts",
    "lib/domain/normalisation-texte.ts",
    // ⚠️ DEUX AUTRES, DÉCOUVERTS EN ÉLARGISSANT LE BALAYAGE À TOUT `lib/`, ET POUR D'AUTRES RAISONS.
    //
    // `corpus-detresse.ts` n'est pas de la copie : ce sont 26 messages SIMULÉS, les entrées sur
    // lesquelles le détecteur de détresse est éprouvé. Une personne qui écrit à Anam depuis un
    // téléphone tape « j'ai » avec l'apostrophe droite du clavier — c'est précisément ce que ce
    // corpus doit reproduire. Le convertir rendrait le corpus moins fidèle à ce qui arrive
    // vraiment, sur la garde qui compte le plus du produit.
    "lib/safety/corpus-detresse.ts",
    // `detecteur-detresse.ts` porte le PROMPT envoyé au modèle. Personne ne le lit à l'écran, et
    // on ne retouche pas la typographie d'une consigne de sécurité pour une raison esthétique :
    // le bénéfice est nul et le risque n'est pas nul.
    "lib/safety/detecteur-detresse.ts",
  ];

  it("[LE CŒUR] aucune apostrophe droite dans une chaîne affichée", () => {
    // Neuf écrans écrivaient « ' », deux écrivaient « ’ ». Ça ne se voit pas dans un fichier ; ça
    // se voit en passant d'un écran à l'autre, et c'est ce qui donne l'impression d'un produit
    // assemblé de plusieurs mains.
    const fautives: string[] = [];
    // ⚠️ `lib/domain` SEUL NE SUFFISAIT PAS, ET C'EST UN NAVIGATEUR QUI L'A DIT. La barre de
    // régions écrit son libellé depuis `lib/scene/regions.ts` — jamais balayé — et disait
    // « L'arbre » à l'apostrophe droite, à quelques pixels d'une présentation qui écrivait
    // « L’arbre ». Aucune lecture de source ne pouvait voir la différence : les deux fichiers
    // sont justes séparément. On balaie donc TOUT `lib/`, qui est l'autre endroit où des mots
    // affichés sont écrits.
    const sources = fichiers(".tsx")
      .concat(fichiers(".ts"))
      .concat(
        (readdirSync(resolve(RACINE, "lib"), { recursive: true, encoding: "utf-8" }) as string[])
          .filter((f) => f.endsWith(".ts"))
          .map((f) => `lib/${f}`),
      );
    for (const f of sources) {
      if (f.includes(".test.") || DETECTEURS.includes(f)) continue;
      const src = sansCommentaires(lire(f));
      // ⚠️ LES GUILLEMETS DOUBLES ET LES GABARITS SEULEMENT, ET C'EST LE CORRECTIF D'UN MUTANT
      // SURVIVANT. La première version cherchait `["'`]([^"'`]…)["'`]` : en excluant `'` du CONTENU,
      // elle ne pouvait STRUCTURELLEMENT pas voir une apostrophe droite dans une chaîne — le
      // caractère cherché servait de délimiteur. Elle était verte, et aveugle à ce qu'elle gardait.
      // ⚠️ ET LE SEUIL DE 8 CARACTÈRES ÉTAIT LE TROU. « L'arbre » en fait SEPT : le libellé le plus
      // visible du produit, présent sur les quatre régions, passait sous la garde qui prétendait
      // le couvrir. Le seuil ne discriminait rien — c'est le motif d'élision (une apostrophe ENTRE
      // deux lettres) qui fait tout le travail, et il n'a pas besoin de longueur pour être sûr.
      for (const m of src.matchAll(/(?:"([^"\n]{3,})"|`([^`\n]{3,})`)/g)) {
        const texte = m[1] ?? m[2] ?? "";
        if (/[\\/{}<>|]/.test(texte)) continue; // ni motif, ni fragment de code
        if (/[a-zà-ÿA-ZÀ-Ý]'[a-zà-ÿA-ZÀ-Ý]/.test(texte)) fautives.push(`${f} → « ${texte.slice(0, 80)} »`);
      }
    }
    expect(fautives, `apostrophes droites affichées :\n${fautives.join("\n")}`).toEqual([]);
  });

  it("plus aucune entité `&apos;` en JSX — `&rsquo;` est la typographique", () => {
    const fautifs = fichiers(".tsx").filter((f) => lire(f).includes("&apos;"));
    expect(fautifs, `entités droites :\n${fautifs.join("\n")}`).toEqual([]);
  });

  it("[LA GARDE DE LA GARDE] les détecteurs, EUX, gardent l'apostrophe droite", () => {
    // Sans ce contrôle, un balayage bien intentionné les convertirait un jour, et les motifs
    // cesseraient de reconnaître ce qu'ils cherchent — sans qu'une seule ligne ne rougisse.
    for (const f of ["lib/domain/lexique-interdit.ts", "lib/domain/marqueurs-prediction.ts"]) {
      expect(
        /[a-z]'[a-z]/.test(sansCommentaires(lire(f))),
        `${f} a perdu ses apostrophes droites : ses motifs ne matchent plus le texte normalisé`,
      ).toBe(true);
    }
  });

  it("[LE PIVOT] le normaliseur ramène TOUTES les formes à la droite", () => {
    // ⚠️ C'EST CETTE LIGNE QUI REND TOUT LE RESTE POSSIBLE. Les détecteurs peuvent garder
    // l'apostrophe droite parce qu'ils ne voient jamais que du texte normalisé. Retirer cette
    // substitution ferait échouer toute détection sur une phrase écrite avec « ’ » — c'est-à-dire
    // sur tout ce que le produit affiche depuis la conversion. La garde vit ici, pas dans un
    // commentaire, précisément parce que le lien n'est pas visible depuis les détecteurs.
    //
    // ⚠️ ET `normalisation-texte.ts` N'A AUCUNE APOSTROPHE ENTRE LETTRES : la sienne est seule dans
    // une chaîne de remplacement. Le contrôle ci-dessus, appliqué à ce fichier, rougissait à tort —
    // il mesurait la mauvaise chose. Ici on mesure la RÈGLE.
    const src = sansCommentaires(lire("lib/domain/normalisation-texte.ts"));
    // ⚠️ ON EXIGE « ’ » NOMMÉMENT, PAS « L'UN DES TROIS ». Écrite `[‘’ʼ]`, la garde restait verte
    // quand on retirait les deux guillemets courbes en laissant `ʼ` — or « ’ » est précisément la
    // forme que le produit affiche depuis la conversion. Un mutant survivant l'a montré.
    expect(src, "le normaliseur n'unifie plus l'apostrophe typographique « ’ »").toMatch(
      /replace\(\s*\/\[[^\]]*’[^\]]*\]\/g\s*,\s*["']'["']\s*\)/,
    );
  });
});

describe("[QA 19/08] la porte de secours est une cible dans les DEUX dimensions", () => {
  it("[LE CŒUR] le lien du pied de halte borne sa largeur autant que sa hauteur", () => {
    // Mesuré à 27,7 px de LARGE — la largeur du mot « Aide ». `min-height` était bien là depuis le
    // début, et il ne suffisait pas : WCAG 2.5.8 mesure une cible, pas une bande.
    const css = lire("render/pied-halte.module.css");
    const bloc = css.match(/\.lien\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(bloc, "`.lien` a perdu sa hauteur minimale").toMatch(
      /min-height:\s*var\(--cible-tactile\)/,
    );
    expect(bloc, "`.lien` ne borne plus sa largeur — le défaut du 19/08").toMatch(
      /min-width:\s*var\(--cible-tactile\)/,
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// L'ACCENT, LA RACINE, ET LA VOIX DES TITRES
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[QA 19/08] trois règles de la charte qui s'étaient perdues", () => {
  it("l'étiquette de mise en avant n'est plus peinte en accent — elle n'est pas cliquable", () => {
    // « L'accent est la couleur de l'action, et seulement de l'action. » Peindre une étiquette
    // inerte en accent promet un lien qui n'existe pas ET affaiblit le seul signal qui désigne ce
    // qu'on peut toucher : deux dégâts pour un seul écart.
    const bloc = lire("render/accueil/accueil.module.css").match(/\.mention\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(bloc, "l'étiquette de mise en avant est redevenue accent").not.toMatch(
      /color:\s*var\(--accent\)/,
    );
  });

  it("la racine du document porte le fond de nuit, jamais le noir pur", () => {
    // `color-scheme: dark` seul peint la racine en noir pur — visible au rebond de défilement.
    // La charte l'interdit nommément : « jamais un noir pur (qui ferait ‹ écran éteint ›) ».
    const bloc = lire("app/styles/globals.css").match(/\bhtml\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(bloc, "`html` ne pose plus de fond : la racine repasse en noir pur").toMatch(
      /background:\s*var\(--fond\)/,
    );
  });

  it("aucune taille de titre n'est inventée hors de l'échelle", () => {
    // ⚠️ CE QU'AUCUN TEST NE POUVAIT VOIR, ET AUCUN RELECTEUR NON PLUS. Les tailles étaient justes
    // À L'INTÉRIEUR de chaque fichier — c'est en COMPARANT les écrans que le désordre paraît :
    // trois haltes titraient à 1,75 rem quand le reste titre à 1,5, et trois titres de section
    // valaient 1,2 / 1,2 / 1,25 rem, deux tailles pour un même rôle. Cinq échelles au total.
    //
    // La règle n'interdit pas de poser une taille dans un module : elle exige qu'elle appartienne
    // à l'échelle. Une valeur neuve doit d'abord entrer dans `globals.css`, où on la voit.
    const echelle = new Set(
      [...lire("app/styles/globals.css").matchAll(/font-size:\s*([\d.]+rem)/g)].map((m) => m[1]),
    );
    expect(echelle.size, "l'échelle typographique a disparu de `globals.css`").toBeGreaterThan(3);

    const horsEchelle: string[] = [];
    for (const f of fichiers(".module.css")) {
      const css = lire(f).replace(/\/\*[\s\S]*?\*\//g, "");
      for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (!/titre/i.test(m[1])) continue;
        const taille = m[2].match(/font-size:\s*([\d.]+rem)/)?.[1];
        if (taille && !echelle.has(taille)) horsEchelle.push(`${f} → ${m[1].trim()} : ${taille}`);
      }
    }
    expect(horsEchelle, `tailles de titre hors échelle :\n${horsEchelle.join("\n")}`).toEqual([]);
  });

  it("les titres parlent d'une seule voix — dans TOUT `render/`, pas dans un fichier", () => {
    // ⚠️ CETTE GARDE A ÉTÉ ÉCRITE TROP ÉTROITE, ET LE TOUR DE QA 2 L'A PROUVÉ. Elle ne lisait que
    // `Bibliotheque.tsx` — quatre titres — dans une région qui en compte SIX. Le cinquième vit dans
    // `CarteAnam.tsx` et est resté en `t-corps-fort` : après « correction », il était le SEUL titre
    // sans empattement du produit, donc PLUS voyant qu'avant. Un correctif partiel avait aggravé ce
    // qu'il réparait, et une garde nommant son fichier l'avait laissé faire.
    //
    // On balaie donc tout `render/`. C'est la même leçon que les anneaux de focus le matin même :
    // l'endroit qui porte l'écart est toujours celui qu'on n'a pas regardé.
    const fautifs: string[] = [];
    for (const f of fichiers(".tsx")) {
      if (!f.startsWith("render/")) continue;
      for (const m of sansCommentaires(lire(f)).matchAll(/<h[12][^>]*className=[^>]*>/g)) {
        if (/t-corps-fort|t-corps\b|t-meta/.test(m[0])) fautifs.push(`${f} → ${m[0].slice(0, 80)}`);
      }
    }
    expect(fautifs, `titres dans la police d'interface :\n${fautifs.join("\n")}`).toEqual([]);
  });

  it("l'anneau de focus reste DEHORS — sinon le bouton primaire perd le sien", () => {
    // ⚠️ UN RISQUE SIGNALÉ AVANT QU'IL N'ARRIVE (tour de QA 2). L'anneau `--bordure-forte` sur
    // l'accent `#8FC1EF` donnerait 2,39:1 — sous le seuil de 3:1. Le cas ne se produit pas
    // aujourd'hui parce que `outline-offset: 2px` dessine l'anneau à l'EXTÉRIEUR du bouton, donc
    // sur le fond de page, où il tient à 4,29:1. Passer ce décalage à 0 ferait disparaître
    // visuellement l'anneau du bouton primaire de `/entrer` — sans qu'aucune règle ne change de
    // couleur, et sans que rien ne rougisse. C'est le seul endroit du produit où ça peut arriver.
    const nuls: string[] = [];
    for (const f of fichiers(".module.css")) {
      for (const m of lire(f).matchAll(/outline-offset:\s*([^;]+);/g)) {
        if (/^0(px|rem|em)?$/.test(m[1].trim())) nuls.push(`${f} → ${m[1].trim()}`);
      }
    }
    expect(nuls, `anneaux collés au bord :\n${nuls.join("\n")}`).toEqual([]);
  });

  it("la case de l'effacement définitif est HABILLÉE — la cible est le label, l'apparence est la sienne", () => {
    // Deux choses distinctes, et les confondre fait corriger la mauvaise. La CIBLE est le label
    // (44 px, mesuré en navigateur par `e2e/cibles-tactiles.spec.ts`). L'APPARENCE, elle, était la
    // taille native du navigateur — 13 × 13 px, la plus petite chose visible du produit, devant
    // l'action la plus irréversible, quand les cases de `/consentement` en font 21,6.
    const css = lire("render/mes-donnees/mes-donnees.module.css");
    const bloc = css.match(/\.confirmation input\[type="checkbox"\]\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(bloc, "la case d'effacement est redevenue native").toMatch(/width:\s*1\.35rem/);
    expect(bloc).toMatch(/height:\s*1\.35rem/);
  });
});
