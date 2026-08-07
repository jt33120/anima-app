import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { REGIONS, CATALOGUE_REGIONS } from "@/lib/scene/regions";
import * as copieArbre from "@/render/arbre/copie-arbre";

/**
 * Story 3.3 (T5) — LA GARDE D'ABSENCE : aucun verrou, aucun appât, aucun compteur sur l'arbre.
 *
 * ══ ⚠️ LIRE CECI AVANT DE MODIFIER UNE SEULE LIGNE DE CE FICHIER ═════════════════════════════════════
 *
 * Une garde d'absence est le type de test le plus facile à écrire, et le plus facile à écrire FAUX :
 * elle échoue silencieusement DANS LE BON SENS. La revue 4.10 l'a trouvée DEUX FOIS sur un même test :
 *
 *   1. l'extracteur découpait au mauvais endroit → il rendait un fragment → le mot interdit n'y était
 *      pas → VERTE ;
 *   2. corrigé une première fois, il restait sensible au formatage → un reformatage rendait l'extrait
 *      VIDE → chercher un mot interdit dans une chaîne vide réussit toujours → ENCORE VERTE.
 *
 * Trois disciplines en découlent, et elles sont non négociables :
 *
 *   (a) L'EXTRACTEUR EST ÉPROUVÉ POUR LUI-MÊME, sur des cas fabriqués (premier bloc). Un extracteur
 *       qu'aucun test ne regarde peut rendre `[]` pour toujours.
 *   (b) PRÉSENCE AVANT ABSENCE : on prouve que l'extrait contient des libellés qu'on SAIT y être,
 *       avant d'affirmer qu'il n'en contient pas d'autres.
 *   (c) LE BALAYAGE N'EST JAMAIS VIDE : chaque chemin d'inventaire doit EXISTER, et le nombre de
 *       surfaces balayées est journalisé. Un matcher qui ne trouve aucun fichier passe toutes ses
 *       boucles au vert (patron `garde-commerciale.test.ts`).
 *
 * ══ CE QUE CETTE GARDE NE PROUVE PAS ═════════════════════════════════════════════════════════════════
 *
 * Elle regarde le VOCABULAIRE, pas la forme. Un cadenas dessiné en SVG sans aucun mot lui échapperait.
 * C'est `tests/rendu/arbre-gratuit.test.tsx` qui ferme cet angle : il compare les DOM gratuit/premium et
 * rougit sur N'IMPORTE QUELLE différence, nommée ou non. Les deux gardes sont complémentaires — celle-ci
 * ne dépend d'aucun DOM, celle-là ne dépend d'aucun mot. Ne pas retirer l'une en croyant l'autre suffisante.
 */

const racine = process.cwd();

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// L'INVENTAIRE DES SURFACES — chemins EXACTS, jamais un basename
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
//
// Ancrés au chemin complet, comme dans `garde-commerciale.test.ts` : un homonyme ailleurs ne doit ni
// hériter d'une dérogation, ni se faire passer pour une surface gardée.
const SURFACES: readonly string[] = [
  // Toute la copie de la région arbre — c'est là qu'un libellé s'ajoute.
  "render/arbre/copie-arbre.ts",
  "render/arbre/EtatVideArbre.tsx",
  "render/arbre/ArbreInteractif.tsx",
  "render/arbre/VueListe.tsx",
  "render/arbre/FicheBranche.tsx",
  "render/arbre/ChampRenommage.tsx",
  "render/arbre/PlanEtapes.tsx",
  // La NAVIGATION : les trois destinations et leurs libellés (AC1).
  "render/scene-dom.tsx",
  "lib/scene/regions.ts",
];

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// L'EXTRACTEUR — « ce qui peut atteindre l'écran »
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

/** Commentaires retirés : un avertissement qui NOMME un interdit ne doit pas déclencher la garde. */
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * Les chaînes qui peuvent finir sous les yeux de quelqu'un : littéraux de chaîne + textes JSX.
 *
 * Les SPÉCIFICATEURS D'IMPORT sont retirés en premier. Sans ça, `import … from "./copie-arbre"`
 * peuplerait l'extrait de chemins de fichiers : la garde de présence deviendrait satisfaite par des
 * chaînes que personne ne voit jamais — une tautologie déguisée en preuve.
 */
export function texteVisible(src: string): string[] {
  const sans = sansCommentaires(src).replace(/\bfrom\s*(["'])(?:(?!\1).)*\1/g, " ");
  const trouves: string[] = [];
  for (const m of sans.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)) trouves.push(m[2]);
  // Textes JSX : ce qui vit entre `>` et `<` sans accolade ni balise.
  for (const m of sans.matchAll(/>([^<>{}]+)</g)) trouves.push(m[1]);
  return trouves.map((s) => s.trim()).filter((s) => s.length > 0);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// LE VOCABULAIRE INTERDIT (AC2 [DUR], AC1, FR-031)
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
const INTERDITS: readonly { motif: RegExp; pourquoi: string }[] = [
  { motif: /cadenas|verrou|\block\b|locked/i, pourquoi: "AC2 — jamais un verrou ostentatoire" },
  { motif: /flout|\bflou\b|\bblur/i, pourquoi: "AC2 — jamais un aperçu flouté" },
  { motif: /fantôme|fantome|pointillé|pointille|dashed/i, pourquoi: "AC2 — jamais de branches fantômes" },
  { motif: /pass(?:e|ez|er)\s+(?:au|en)\s+premium/i, pourquoi: "AC2 — jamais de bandeau d'appât" },
  { motif: /débloqu|debloqu|déverrouill|deverrouill/i, pourquoi: "AC2 — on ne « débloque » rien ici" },
  { motif: /\bbadge\b|pastille/i, pourquoi: "AC1 — la destination Arbre ne porte aucune marque" },
  { motif: /\bpremium\b/i, pourquoi: "AC1/AC2 — le mot ne s'affiche nulle part dans la région arbre" },
  { motif: /abonne[- ]?toi|abonnez[- ]?vous|\boffre\b|\bpromo|réduction|upgrade/i, pourquoi: "AC6 — aucun appât" },
  { motif: /\d+\s*€|€\s*\d+|\beuros?\b/i, pourquoi: "AC6 — aucun prix, la région arbre ne vend pas" },
  { motif: /\bil te manque\b|branches? restante|sur \d+ branche/i, pourquoi: "AC2/FR-031 — aucun compteur" },
];

/**
 * ⚠️ CE QUI N'EST PAS INTERDIT, ET POURQUOI. Le mot « abonnement » est ABSENT de cette liste, alors
 * qu'une première version l'y avait mis par réflexe. Ce réflexe était faux, et il aurait fabriqué
 * exactement la faute que cette story ferme : depuis la 3.3, Anam ne propose plus de branche sans
 * abonnement, donc une phrase qui dirait seulement « ça vient en parlant » enverrait quelqu'un
 * attendre quelque chose qui n'arrivera jamais. FR-088 demande la représentation « HONNÊTE » de ce
 * qu'elle n'a pas encore — honnête veut dire complète.
 *
 * La ligne de partage est donc le REGISTRE, pas le sujet : le NOM « abonnement » décrit un périmètre
 * (autorisé, et nécessaire) ; le VERBE « abonne-toi », le mot-étiquette « premium », un prix ou une
 * « offre » vendent (interdits). C'est pour ça que `abonne-toi` figure ci-dessus et pas `abonnement`.
 */

/** Les libellés qu'on SAIT visibles : ils prouvent que l'extrait examiné est bien le bon (discipline b). */
const TEMOINS_ATTENDUS: readonly string[] = [
  copieArbre.VIDE_TITRE,
  copieArbre.VIDE_CORPS,
  copieArbre.VIDE_OU_NAISSENT_LES_BRANCHES,
  copieArbre.BASCULE_LISTE,
  copieArbre.BASCULE_ARBRE,
  copieArbre.ACTION_RENOMMER,
  copieArbre.PLAN_TITRE,
  ...REGIONS.map((r) => r.nom),
];

describe("[T5-2 / discipline a] L'EXTRACTEUR est éprouvé POUR LUI-MÊME", () => {
  it("il attrape les littéraux de chaîne ET les textes JSX", () => {
    expect(texteVisible('const A = "Bonjour";')).toContain("Bonjour");
    expect(texteVisible("<p>Un texte JSX</p>")).toContain("Un texte JSX");
    expect(texteVisible("<span>{variable}</span>"), "une accolade n'est pas du texte").not.toContain("variable");
  });

  it("[LE PIÈGE] il IGNORE les spécificateurs d'import — sinon la preuve de présence serait creuse", () => {
    // Sans ce filtrage, `import x from "./passe-au-premium"` peuplerait l'extrait d'un chemin de
    // fichier, et un fichier n'ayant AUCUN texte visible passerait quand même la garde de présence.
    const src = 'import { A } from "@/render/arbre/copie-arbre";\nconst t = "Rien n\'a été nommé.";';
    const v = texteVisible(src);
    expect(v).toContain("Rien n'a été nommé.");
    expect(v.join(" "), "un chemin d'import s'est invité dans l'extrait").not.toContain("copie-arbre");
  });

  it("il IGNORE les commentaires — un avertissement qui nomme l'interdit ne doit pas le déclencher", () => {
    // Ce fichier-ci en est la preuve vivante : il écrit « passe au premium » une dizaine de fois.
    expect(texteVisible('// ne jamais écrire "passe au premium"\nconst A = "ok";')).toEqual(["ok"]);
    expect(texteVisible('/* cadenas interdit */ const A = "ok";')).toEqual(["ok"]);
  });

  it("[NON-VACUITÉ de l'extracteur] il ne rend PAS un tableau vide sur du code réel", () => {
    // Le mode d'échec le plus vicieux : un extracteur qui rend `[]` fait passer TOUTES les assertions
    // d'absence de ce fichier, en silence et pour toujours.
    expect(texteVisible(readFileSync(resolve(racine, "render/arbre/copie-arbre.ts"), "utf-8")).length)
      .toBeGreaterThan(20);
  });
});

describe("[T5-3 / discipline c] LE BALAYAGE — l'inventaire existe, et il n'est pas vide", () => {
  it("chaque chemin inventorié EXISTE (un fichier renommé casse la garde, il ne la vide pas)", () => {
    // Mutation-cible : renommer une surface sans toucher à l'inventaire. Sans cette assertion, la
    // surface disparaîtrait du balayage sans un seul rouge — et personne ne garderait plus rien.
    for (const chemin of SURFACES) {
      expect(existsSync(resolve(racine, chemin)), `surface inventoriée introuvable : ${chemin}`).toBe(true);
    }
    expect(SURFACES.length, "inventaire vide — la garde ne balaierait rien").toBeGreaterThan(5);
  });

  it("[LE CŒUR / discipline b] les libellés CONNUS sont bien retrouvés dans le balayage", () => {
    // ⚠️ C'EST LA CONDITION DE VALIDITÉ DE TOUT CE FICHIER. Elle prouve que l'extracteur atteint
    // vraiment le texte d'écran de ces surfaces. Si le chemin de collecte casse — inventaire vidé,
    // extracteur en panne, fichiers déplacés — c'est ICI que ça rougit, AVANT que la moindre
    // assertion d'absence n'ait eu l'occasion de réussir par vacuité.
    const balayage = SURFACES.flatMap((c) => texteVisible(readFileSync(resolve(racine, c), "utf-8")));
    for (const temoin of TEMOINS_ATTENDUS) {
      expect(balayage, `témoin visible introuvable : « ${temoin} »`).toContain(temoin);
    }
    console.info(
      `[tronc-absence] ${SURFACES.length} surfaces balayées, ${balayage.length} chaînes visibles, ` +
        `${TEMOINS_ATTENDUS.length} témoins retrouvés, ${INTERDITS.length} interdits appliqués.`,
    );
  });
});

describe("[T5-1 / AC1 + AC2 DUR] aucun verrou, aucun appât, aucun compteur", () => {
  for (const chemin of SURFACES) {
    it(`${chemin} — rien du vocabulaire interdit n'atteint l'écran`, () => {
      const visible = texteVisible(readFileSync(resolve(racine, chemin), "utf-8"));
      for (const { motif, pourquoi } of INTERDITS) {
        const fautif = visible.filter((s) => motif.test(s));
        expect(fautif, `${pourquoi} — trouvé dans ${chemin} : ${JSON.stringify(fautif)}`).toEqual([]);
      }
    });
  }
});

describe("[T5-5 / AC1] la NAVIGATION ne connaît pas l'abonnement", () => {
  it("[LE CŒUR] `REGIONS` ne porte AUCUN champ dérivé du premium", () => {
    // Une région ne porte que son identifiant, son libellé et sa qualité de destination. Un futur
    // `verrouille: true` ou `premium: true` s'afficherait tôt ou tard — mais surtout, il ferait
    // exister la NOTION dans le modèle de navigation, et c'est là que tout commence.
    // Mutation-cible : ajouter un champ à une entrée de `CATALOGUE_REGIONS`.
    expect(CATALOGUE_REGIONS.length, "catalogue vide — l'assertion serait creuse").toBeGreaterThan(3);
    for (const r of CATALOGUE_REGIONS) {
      expect(Object.keys(r).sort(), `champ inattendu sur la région ${r.id}`).toEqual([
        "destinationDirecte",
        "id",
        "nom",
      ]);
    }
  });

  it("les TROIS destinations sont là, nommées, sans marque", () => {
    expect(REGIONS.map((r) => r.nom)).toEqual(["Accueil", "Anam", "L'arbre"]);
  });

  it("le bloc `<nav>` de la scène ne lit ni la projection, ni l'entitlement", () => {
    const src = sansCommentaires(readFileSync(resolve(racine, "render/scene-dom.tsx"), "utf-8"));
    const debut = src.indexOf("<nav");
    const fin = src.indexOf("</nav>", debut);
    // PRÉSENCE D'ABORD : on prouve qu'on tient bien le bloc de navigation — sinon `slice(-1, -1)`
    // rendrait une chaîne vide, et toutes les absences ci-dessous seraient vraies pour rien.
    expect(debut, "bloc <nav> introuvable dans scene-dom").toBeGreaterThan(-1);
    expect(fin, "bloc <nav> non refermé").toBeGreaterThan(debut);
    const nav = src.slice(debut, fin);
    expect(nav, "témoin : la nav est bien étiquetée").toContain('aria-label="Régions"');
    expect(nav, "témoin : elle dérive du catalogue de régions").toContain("REGIONS.map");

    // …et SEULEMENT ENSUITE, les absences.
    for (const interdit of [/projection/, /planOuvert/i, /premium/i, /abonn/i, /disabled/, /aria-disabled/]) {
      expect(nav, `la navigation s'est mise à connaître l'abonnement : ${interdit}`).not.toMatch(interdit);
    }
  });
});

/**
 * Story 3.3 (T7-1) — LA PHRASE SOBRE ELLE-MÊME, éprouvée mot à mot.
 *
 * C'est la SEULE surface commerciale de toute la région arbre. Une garde générique de vocabulaire ne
 * suffit pas pour elle : ce qui compte ici est son REGISTRE. Anam ne vend rien (3.2) — lui faire dire
 * une phrase de périmètre la transformerait en commerciale au moment précis où l'écran est vide.
 */
describe("[T7-1 / AC6] la phrase sobre : registre PRODUIT, jamais la voix d'Anam", () => {
  const phrase = copieArbre.VIDE_OU_NAISSENT_LES_BRANCHES;

  it("[NON-VACUITÉ] elle dit bien ce qu'AC6 lui demande de dire", () => {
    // Présence avant absence : une constante vide passerait TOUTES les assertions ci-dessous.
    expect(phrase.length, "phrase vide — les interdits seraient vrais pour rien").toBeGreaterThan(20);
    expect(phrase, "AC6 : « indiquer que les branches se posent en conversation »").toMatch(/conversation/i);
    expect(phrase, "…et le périmètre, sans quoi elle enverrait attendre pour rien").toMatch(/abonnement/i);
  });

  it("[LE CŒUR] ce n'est pas Anam qui parle : aucune adresse directe, aucune question", () => {
    // Anam tutoie et questionne. Une phrase de périmètre ne fait ni l'un ni l'autre : elle constate.
    // Mutation-cible : réécrire la phrase en « Tu peux poser des branches… ».
    for (const voix of [/\btu\b/i, /\bton\b|\bta\b|\btes\b/i, /\bje\b/i, /\bmon\b|\bma\b|\bmes\b/i, /\?/, /!/]) {
      expect(phrase, `la voix d'Anam s'est invitée dans une phrase produit : ${voix}`).not.toMatch(voix);
    }
  });

  it("aucun IMPÉRATIF, aucun futur promis — on dit ce qui est, pas ce qu'elle gagnerait", () => {
    for (const appat of [
      /\bdécouvre\b|\bdécouvrez\b/i,
      /\bessaie\b|\bessayez\b/i,
      /\bpourras\b|\bpourrez\b|\bpourrais\b/i,
      /\bmaintenant\b|\bdès aujourd.hui\b/i,
    ]) {
      expect(phrase, `registre publicitaire : ${appat}`).not.toMatch(appat);
    }
  });

  it("elle passe SA PROPRE garde de vocabulaire (elle n'est pas dérogée)", () => {
    // Une phrase commerciale exemptée de la garde d'absence serait le trou parfait : la seule surface
    // qui vend, et la seule qu'on ne regarde pas.
    for (const { motif, pourquoi } of INTERDITS) {
      expect(motif.test(phrase), `${pourquoi} — dans la phrase d'AC6 elle-même`).toBe(false);
    }
  });
});
