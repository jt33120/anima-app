import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { CLES_JEU, JEU } from "@/lib/tirage/jeu";
import { VISUELS_DESSINES, cheminVisuel, REPERTOIRE_VISUELS } from "@/render/lecture/visuels";
import { CORPUS_DESCRIPTION_CARTES, cleDescription } from "@/lib/corpus/description-cartes";
import { clesEcrites, textesEcrits } from "@/lib/corpus/port";

/**
 * jeu-proprietaire.test.ts — LE JEU EST D'ANIMA, ET DE PERSONNE D'AUTRE (Story 5.7, AC5 · FR-022).
 *
 * ══ CE QUE FR-022 DEMANDE VRAIMENT ═════════════════════════════════════════════════════════════
 *
 * « Le jeu de cartes est PROPRIÉTAIRE — visuels créés pour Anima. Aucun oracle du commerce n'est
 * embarqué. » C'est une promesse de PRODUIT avant d'être une question de droit d'auteur : plusieurs
 * jeux classiques sont dans le domaine public, et les recopier resterait une trahison de la promesse
 * faite à l'utilisatrice.
 *
 * La garde porte donc sur ce qui est vérifiable mécaniquement : aucun nom emprunté, aucun visuel
 * servi depuis ailleurs que le répertoire propriétaire.
 *
 * ══ LE PIÈGE DU CORPUS VIDE, DÉJÀ PAYÉ DEUX FOIS EN 5.4 ════════════════════════════════════════
 *
 * Les 24 descriptions ne sont pas écrites et l'ensemble des visuels est vide. Toute assertion sur
 * LEUR CONTENU est donc vacue : elle serait verte sur un produit qui n'existe pas. Chaque balayage
 * est par conséquent doublé d'une PREUVE SUR FAUX — un jeu fictif portant les noms interdits, un
 * manifeste fictif pointant un fichier absent — pour montrer que le détecteur mord réellement.
 */

const NOMS_EMPRUNTES: readonly string[] = [
  // Jeux et éditeurs du commerce.
  "tarot",
  "oracle",
  "rider",
  "waite",
  "smith",
  "marseille",
  "lenormand",
  "thoth",
  "belline",
  "crowley",
  // Vocabulaire structurel emprunté.
  "arcane",
  "lame",
  "atout",
  "majeur",
  "mineur",
  // Noms d'arcanes majeurs — le cœur de ce qu'on ne veut pas voir apparaître.
  "le mat",
  "le bateleur",
  "la papesse",
  "l imperatrice",
  "l empereur",
  "le pape",
  "l amoureux",
  "le chariot",
  "la justice",
  "l hermite",
  "la roue de fortune",
  "la force",
  "le pendu",
  "temperance",
  "le diable",
  "la maison dieu",
  "l etoile",
  "la lune",
  "le soleil",
  "le jugement",
  "le monde",
];

/**
 * Normalisation minimale : minuscules, accents retirés, tirets et apostrophes ramenés à l'espace.
 *
 * ⚠️ POURQUOI PAS `normaliserTexte` DE `lib/domain/normalisation-texte.ts`. Elle ne ramène pas les
 * TIRETS à l'espace — et les clés du jeu en sont pleines (« porte-entrouverte », « miroir-d-eau »).
 * Sans cette conversion, la recherche par frontière de mot ne verrait jamais « le pendu » dans
 * « le-pendu », c'est-à-dire dans la forme exacte qu'une clé de carte prendrait.
 */
function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’\-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Rend les noms empruntés trouvés dans un texte. Vide = conforme. */
function chercherNomsEmpruntes(texte: string): string[] {
  const norm = ` ${normaliser(texte)} `;
  return NOMS_EMPRUNTES.filter((nom) => norm.includes(` ${nom} `) || norm.includes(` ${nom},`));
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 1. Les noms du jeu
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC5/FR-022] aucun nom emprunté à un jeu du commerce", () => {
  it("les 24 clés du jeu sont propres", () => {
    for (const cle of CLES_JEU) {
      expect(chercherNomsEmpruntes(cle), `la carte « ${cle} »`).toEqual([]);
    }
  });

  it("les descriptions écrites sont propres (vacue tant qu'aucune n'est écrite — voir §preuve)", () => {
    for (const texte of textesEcrits(CORPUS_DESCRIPTION_CARTES)) {
      expect(chercherNomsEmpruntes(texte), texte).toEqual([]);
    }
  });

  it("LE DÉTECTEUR MORD — prouvé sur un faux jeu", () => {
    // Sans cette assertion, les deux précédentes seraient vertes sur un détecteur cassé, puisqu'il
    // n'y a aujourd'hui aucun texte à balayer.
    expect(chercherNomsEmpruntes("le-pendu")).toEqual(["le pendu"]);
    expect(chercherNomsEmpruntes("La Papesse")).toEqual(["la papesse"]);
    expect(chercherNomsEmpruntes("arcane-sans-nom")).toEqual(["arcane"]);
    expect(chercherNomsEmpruntes("Une carte du tarot de Marseille")).toEqual(["tarot", "marseille"]);
    expect(chercherNomsEmpruntes("oracle Belline")).toEqual(["oracle", "belline"]);
  });

  it("LE DÉTECTEUR MORD MALGRÉ LES ACCENTS ET LES APOSTROPHES", () => {
    // Assertion séparée parce qu'elle garde une pièce précise et fragile : le retrait des diacritiques.
    // Un jour où cette expression serait cassée par une réécriture, les assertions non accentuées
    // resteraient vertes et « L'Impératrice » passerait sans bruit — la moitié des noms d'arcanes
    // français en porte un.
    expect(chercherNomsEmpruntes("L'Impératrice")).toEqual(["l imperatrice"]);
    expect(chercherNomsEmpruntes("Tempérance")).toEqual(["temperance"]);
    expect(chercherNomsEmpruntes("L’Étoile")).toEqual(["l etoile"]); // apostrophe typographique
  });

  it("le détecteur ne mord PAS sur les 24 noms légitimes (pas de faux positif)", () => {
    // Garde symétrique : un détecteur trop large casserait le jeu au lieu de le protéger. « lanterne »
    // ne doit pas déclencher « lame », « horizon » ne doit pas déclencher « l etoile ».
    expect(CLES_JEU.flatMap((c) => chercherNomsEmpruntes(c))).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 2. Le manifeste des visuels
// ══════════════════════════════════════════════════════════════════════════════════════════════

/** Un visuel déclaré doit être une carte du jeu ET un fichier réellement présent. */
function incoherencesManifeste(manifeste: ReadonlySet<string>): string[] {
  const fautes: string[] = [];
  for (const cle of manifeste) {
    if (!(CLES_JEU as readonly string[]).includes(cle)) {
      fautes.push(`« ${cle} » n'est pas une carte du jeu`);
    }
    const chemin = resolve(process.cwd(), "public", cheminVisuel(cle).replace(/^\//, ""));
    if (!existsSync(chemin)) fautes.push(`« ${cle} » déclare un fichier absent (${chemin})`);
    // Un visuel sans description écrite s'afficherait avec un texte alternatif vide.
    if (!(clesEcrites(CORPUS_DESCRIPTION_CARTES) as readonly string[]).includes(cleDescription(cle as never))) {
      fautes.push(`« ${cle} » est déclaré dessiné mais sa description n'est pas écrite`);
    }
  }
  return fautes;
}

describe("[AC5] le manifeste des visuels ne ment pas", () => {
  it("l'ensemble est VIDE aujourd'hui — la commande d'art n'a pas été passée", () => {
    // ⚠️ Ce chiffre est VOULU. Il monte quand un visuel propriétaire arrive, jamais autrement. S'il
    // change, vérifier que le visuel a bien été créé POUR Anima (FR-022) et que sa description est
    // écrite, puis mettre à jour cette assertion et `deferred-work.md`.
    expect(VISUELS_DESSINES.size).toBe(0);
    expect(CLES_JEU.length - VISUELS_DESSINES.size).toBe(24);
  });

  it("le manifeste réel est cohérent", () => {
    expect(incoherencesManifeste(VISUELS_DESSINES)).toEqual([]);
  });

  it("LE CONTRÔLE MORD — prouvé sur un faux manifeste", () => {
    // Vacue autrement : l'ensemble réel étant vide, l'assertion précédente passerait sur un contrôle
    // qui ne ferait rien du tout.
    const fautes = incoherencesManifeste(new Set(["porte-entrouverte", "carte-fantome"]));
    expect(fautes.some((f) => f.includes("n'est pas une carte du jeu"))).toBe(true);
    expect(fautes.some((f) => f.includes("fichier absent"))).toBe(true);
    expect(fautes.some((f) => f.includes("description n'est pas écrite"))).toBe(true);
  });

  it("tous les visuels sont servis depuis le répertoire propriétaire, et de nulle part ailleurs", () => {
    expect(REPERTOIRE_VISUELS).toBe("/jeu");
    for (const cle of CLES_JEU) {
      expect(cheminVisuel(cle)).toBe(`/jeu/${cle}.webp`);
      // Aucun chemin ne peut pointer hors du répertoire : ni URL absolue, ni remontée.
      expect(cheminVisuel(cle)).not.toMatch(/^https?:|\.\./);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 3. Le jeu et les corpus restent alignés
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC5] un créneau de description par carte, dérivé et jamais recopié", () => {
  it("les 24 cartes ont chacune leur créneau, et il n'y a pas de créneau orphelin", () => {
    const clesCorpus = Object.keys(CORPUS_DESCRIPTION_CARTES.textes).sort();
    expect(clesCorpus).toEqual(JEU.map((c) => cleDescription(c.cle)).sort());
  });
});
