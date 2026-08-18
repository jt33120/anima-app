import { describe, it, expect } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { CLES_JEU, JEU, EMPREINTE_JEU, empreinteDeJeu } from "@/lib/tirage/jeu";
import { tirerUneCarte } from "@/lib/tirage/tirer";
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
 * Les 21 descriptions ne sont pas écrites et l'ensemble des visuels est vide. Toute assertion sur
 * LEUR CONTENU est donc vacue : elle serait verte sur un produit qui n'existe pas. Chaque balayage
 * est par conséquent doublé d'une PREUVE SUR FAUX — un jeu fictif portant les noms interdits, un
 * manifeste fictif pointant un fichier absent — pour montrer que le détecteur mord réellement.
 *
 * ══ AJOUTÉ EN 5.10 : DEUX CARTES NE PEUVENT PLUS NOMMER LA MÊME CHOSE ═══════════════════════════
 *
 * FR-022 protégeait le jeu du DEHORS — aucun nom emprunté à un oracle du commerce. Il ne le
 * protégeait pas de LUI-MÊME. La 5.10 a failli ajouter `porte` à côté de `porte-entrouverte`, et
 * `chemin` à côté de `sentier` : deux paires de visuels quasi identiques dans une commande d'art,
 * et deux paires de cartes qui disent la même chose dans un tirage. Toute la suite serait restée
 * verte — rien ne regardait les clés les unes par rapport aux autres.
 *
 * Le §1bis porte donc deux détecteurs, parce qu'un seul ne suffit pas :
 *
 *   • MÉCANIQUE — les mots d'une clé ne peuvent pas être tous contenus dans une autre.
 *     `porte` ⊂ `porte-entrouverte` tombe là, sans qu'aucun humain ait eu à y penser.
 *   • DÉCLARÉ — une table de familles de synonymes qu'aucune paire de cartes ne peut satisfaire
 *     ensemble. `chemin` vs `sentier` n'est pas mécaniquement détectable : il faut le dire une fois.
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
  it("les 21 clés du jeu sont propres", () => {
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

  it("le détecteur ne mord PAS sur les 21 noms légitimes (pas de faux positif)", () => {
    // Garde symétrique : un détecteur trop large casserait le jeu au lieu de le protéger. « lanterne »
    // ne doit pas déclencher « lame », « horizon » ne doit pas déclencher « l etoile ».
    expect(CLES_JEU.flatMap((c) => chercherNomsEmpruntes(c))).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 1bis. Le jeu ne se répète pas lui-même (Story 5.10)
// ══════════════════════════════════════════════════════════════════════════════════════════════

/** Les mots d'une clé, normalisés. `porte-entrouverte` → `["porte", "entrouverte"]`. */
const motsDe = (cle: string): readonly string[] => normaliser(cle).split(" ").filter(Boolean);

/**
 * DÉTECTEUR MÉCANIQUE : les mots de `a` sont-ils TOUS présents dans `b` ?
 *
 * Comparaison par MOTS, jamais par sous-chaîne brute : `or` est une sous-chaîne de `horizon` sans
 * rien avoir à voir avec lui, et un détecteur qui mordrait là finirait désactivé au premier faux
 * positif. C'est l'inclusion lexicale qui trahit le doublon — `porte` ⊆ `porte entrouverte`.
 */
function collisionsParSousChaine(cles: readonly string[]): string[] {
  const fautes: string[] = [];
  for (const a of cles) {
    for (const b of cles) {
      if (a === b) continue;
      const motsB = new Set(motsDe(b));
      if (motsDe(a).every((m) => motsB.has(m))) fautes.push(`« ${a} » est déjà nommée par « ${b} »`);
    }
  }
  return fautes;
}

/**
 * LES FAMILLES DÉCLARÉES : des mots qui nomment LE MÊME OBJET DESSINABLE.
 *
 * ⚠️ CETTE TABLE EST INCOMPLÈTE PAR CONSTRUCTION, et ce n'est pas un défaut. Elle ne prétend pas
 * couvrir le français ; elle enregistre les rapprochements qu'on a réellement rencontrés, pour
 * qu'on ne les rencontre pas deux fois. `porte` et `chemin` y sont parce que la 5.10 a failli les
 * ajouter au jeu. La prochaine quasi-collision y ajoutera sa famille.
 *
 * ⚠️ CE QUI N'EST PAS DANS LA MÊME FAMILLE, ET POURQUOI. `seuil` n'est PAS dans la famille `porte` :
 * un seuil est un LIEU (une ligne au sol, une dalle usée), une porte est un OBJET. `bourgeon` n'est
 * pas dans la famille `fleur` : le bouton fermé et la corolle ouverte ne se dessinent pas pareil et
 * ne disent pas la même chose. Ces deux distinctions sont des DÉCISIONS de la 5.10, pas des
 * évidences — si Anima les refuse, ce sont ces lignes qu'il faut changer, et le jeu avec.
 */
const FAMILLES_DE_SENS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  porte: ["porte", "portail", "huis", "portillon", "battant"],
  chemin: ["chemin", "sentier", "voie", "route", "piste", "allee"],
  seuil: ["seuil", "perron", "palier"],
  eau: ["eau", "puits", "fontaine", "source", "mare", "etang", "bassin"],
  feu: ["braise", "flamme", "bougie", "brasier", "foyer", "tison"],
  vol: ["oiseau", "aile", "plume", "nid", "envol", "volatile"],
  pierre: ["pierre", "roche", "caillou", "galet", "menhir", "dolmen"],
  fleur: ["fleur", "floraison", "corolle", "petale"],
  bourgeon: ["bourgeon", "bouton", "pousse", "germe"],
  fenetre: ["fenetre", "croisee", "lucarne", "hublot"],
  bateau: ["barque", "canot", "chaloupe", "nacelle", "esquif"],
  escalier: ["escalier", "marche", "degre", "echelle", "gradin"],
  pont: ["pont", "passerelle", "gue", "viaduc"],
});

/** DÉTECTEUR DÉCLARÉ : deux cartes ne peuvent pas toucher la même famille. */
function collisionsParFamille(cles: readonly string[]): string[] {
  const parFamille = new Map<string, string[]>();
  for (const cle of cles) {
    const mots = new Set(motsDe(cle));
    for (const [famille, membres] of Object.entries(FAMILLES_DE_SENS)) {
      if (membres.some((m) => mots.has(m))) parFamille.set(famille, [...(parFamille.get(famille) ?? []), cle]);
    }
  }
  return [...parFamille.entries()]
    .filter(([, cartes]) => cartes.length > 1)
    .map(([famille, cartes]) => `famille « ${famille} » : ${cartes.join(" + ")}`);
}

describe("[5.10] aucune carte ne nomme ce qu'une autre nomme déjà", () => {
  it("[LE CŒUR] le jeu réel ne contient aucun doublon lexical", () => {
    expect(collisionsParSousChaine(CLES_JEU as readonly string[])).toEqual([]);
  });

  it("[LE CŒUR] le jeu réel ne contient aucun doublon de sens déclaré", () => {
    expect(collisionsParFamille(CLES_JEU as readonly string[])).toEqual([]);
  });

  it("LE DÉTECTEUR MÉCANIQUE MORD — prouvé sur le doublon que la 5.10 a failli livrer", () => {
    // Sans cette assertion, la garde serait verte sur 21 clés déjà propres et ne prouverait rien.
    expect(collisionsParSousChaine(["porte", "porte-entrouverte"])).toEqual([
      "« porte » est déjà nommée par « porte-entrouverte »",
    ]);
    expect(collisionsParSousChaine(["miroir-d-eau", "miroir"])).toEqual([
      "« miroir » est déjà nommée par « miroir-d-eau »",
    ]);
    // Et il ne mord PAS sur un partage de sous-chaîne qui n'est pas un partage de mot.
    expect(collisionsParSousChaine(["horizon", "or"])).toEqual([]);
    expect(collisionsParSousChaine(["carrefour", "four"])).toEqual([]);
  });

  it("LE DÉTECTEUR DÉCLARÉ MORD — prouvé sur l'autre doublon que la 5.10 a failli livrer", () => {
    expect(collisionsParFamille(["chemin", "sentier"])).toEqual(["famille « chemin » : chemin + sentier"]);
    // La carte retirée revenant par la porte de derrière : `puits` et `miroir-d-eau` sont de l'eau.
    expect(collisionsParFamille(["puits", "miroir-d-eau"])).toEqual(["famille « eau » : puits + miroir-d-eau"]);
    expect(collisionsParFamille(["nid", "oiseau"])).toEqual(["famille « vol » : nid + oiseau"]);
    // Et il ne mord pas sur deux cartes de familles différentes.
    expect(collisionsParFamille(["seuil", "porte-entrouverte"])).toEqual([]);
  });

  it("la table des familles est cohérente — aucun mot ne vit dans deux familles", () => {
    // Un mot partagé rendrait le verdict dépendant de l'ordre d'itération, donc illisible en cas
    // d'échec : « famille X » ou « famille Y » selon l'humeur de `Object.entries`.
    const vus = new Map<string, string>();
    for (const [famille, membres] of Object.entries(FAMILLES_DE_SENS)) {
      for (const mot of membres) {
        expect(vus.has(mot), `« ${mot} » est dans « ${famille} » ET dans « ${vus.get(mot)} »`).toBe(false);
        vus.set(mot, famille);
      }
    }
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
    expect(CLES_JEU.length - VISUELS_DESSINES.size).toBe(21);
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
// 2bis. Le répertoire ne garde pas d'orphelin (Story 5.10)
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * La garde INVERSE de `incoherencesManifeste`.
 *
 * Celle-ci va du manifeste vers le disque : chaque clé déclarée a-t-elle un fichier ? Celle-là va du
 * disque vers le jeu : chaque fichier est-il une carte ?
 *
 * Sans elle, la 5.10 aurait laissé `public/jeu/puits.webp` en place — le visuel d'une carte retirée,
 * servi publiquement à une adresse devinable, dans le répertoire qui est censé ne contenir QUE des
 * visuels propriétaires du jeu (FR-022). Il vit désormais dans `images/reference-jeu/`, hors de
 * `public/`, comme unique référence de style pour la commande d'art.
 *
 * Les fichiers cachés sont ignorés : `public/jeu/.gitkeep` existe pour que le répertoire survive à
 * un clone, puisqu'il est vide tant que la commande d'art n'est pas passée.
 */
function orphelinsDuRepertoire(fichiers: readonly string[]): string[] {
  return fichiers
    .filter((f) => !f.startsWith("."))
    .filter((f) => !(f.endsWith(".webp") && (CLES_JEU as readonly string[]).includes(f.slice(0, -5))));
}

describe("[5.10] le répertoire propriétaire ne contient que des cartes du jeu", () => {
  it("[LE CŒUR] aucun fichier orphelin sous public/jeu", () => {
    const repertoire = resolve(process.cwd(), "public", "jeu");
    const fichiers = existsSync(repertoire) ? readdirSync(repertoire) : [];

    // ⚠️ CETTE LIGNE EXISTE PARCE QU'UN MUTANT A SURVÉCU. Le répertoire ne contenant plus que
    // `.gitkeep`, remplacer la lecture du disque par un `[]` littéral donnait EXACTEMENT le même
    // verdict : la garde « aucun orphelin » était verte sur un répertoire qu'elle ne regardait pas.
    // C'est le piège du corpus vide, transposé au système de fichiers. On assert donc l'inventaire
    // BRUT — le jour où un visuel arrive, cette assertion change en même temps que `VISUELS_DESSINES`.
    expect(fichiers.sort()).toEqual([".gitkeep"]);

    expect(orphelinsDuRepertoire(fichiers)).toEqual([]);
  });

  it("LE CONTRÔLE MORD — prouvé sur un faux répertoire", () => {
    // Vacue autrement : le répertoire réel étant vide, l'assertion précédente passerait sur un
    // contrôle qui ne ferait rien. C'est exactement le cas où il ne fait rien qui a laissé passer
    // `puits.webp` jusqu'ici.
    const fautes = orphelinsDuRepertoire([
      ".gitkeep", // ignoré
      "porte-entrouverte.webp", // légitime
      "puits.webp", // carte retirée en 5.10
      "notes.txt", // pas un visuel
      // ⚠️ `.jpeg` fait EXACTEMENT cinq caractères, donc `slice(0, -5)` en tire « fleur » — une clé
      // parfaitement valide. C'est le seul cas qui distingue le contrôle d'extension de son absence :
      // sans lui, retirer `endsWith(".webp")` laisserait la garde verte. Trouvé en concevant le
      // mutant, pas en relisant le code.
      "fleur.jpeg",
      "porte-entrouverte.png", // bonne carte, mauvaise extension
    ]);
    expect(fautes).toEqual(["puits.webp", "notes.txt", "fleur.jpeg", "porte-entrouverte.png"]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 3. Le jeu et les corpus restent alignés
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC5] un créneau de description par carte, dérivé et jamais recopié", () => {
  it("les 21 cartes ont chacune leur créneau, et il n'y a pas de créneau orphelin", () => {
    const clesCorpus = Object.keys(CORPUS_DESCRIPTION_CARTES.textes).sort();
    expect(clesCorpus).toEqual(JEU.map((c) => cleDescription(c.cle)).sort());
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// [R5] L'EMPREINTE DU JEU — un journal d'audit ne ment pas sur ce qu'il sait (revue Epic 5)
// ══════════════════════════════════════════════════════════════════════════════════════════════
//
// ⚠️ 0050 affirmait « Quatre octets journalisés rendent l'audit définitif ». C'était vrai de la
// BORNE du modulo, et faux du reste : `rejouer(graine, borne)` rend un INDICE, et un indice ne
// désigne une carte que dans un JEU DONNÉ. La 5.10 a retiré six cartes prises AU MILIEU de la
// liste — une ligne écrite sous la 5.7 rejouée contre le jeu courant nomme une carte fausse.

describe("[R5] l'empreinte distingue les JEUX, là où `taille_jeu` ne distingue que les TAILLES", () => {
  // Les vingt-quatre noms de la 5.7, dans leur ordre d'alors. Ce ne sont pas des cartes inventées
  // pour le test : c'est le jeu qui aurait réellement produit les lignes de journal d'avant 5.10.
  const JEU_5_7 = [
    "porte-entrouverte", "pont", "fontaine", "racine", "serrure", "lanterne",
    "nid", "chemin-de-traverse", "miroir", "metier-a-tisser", "barque", "clef",
    "montagne", "riviere", "orage", "arbre-creux", "fenetre", "escalier",
    "coquillage", "corde", "sablier", "braise", "carrefour", "puits",
  ];

  it("le jeu de la 5.7 et celui de la 5.10 n'ont PAS la même empreinte", () => {
    expect(empreinteDeJeu(JEU_5_7)).not.toBe(EMPREINTE_JEU);
  });

  it("[LE MUTANT] elle dépend de la COMPOSITION, pas seulement de la taille", () => {
    // Mutant visé : dériver l'empreinte de `TAILLE_JEU`. Deux jeux de 21 cartes DIFFÉRENTES
    // deviendraient indiscernables — et l'audit nommerait une carte fausse en se croyant sûr.
    const memeTaille = CLES_JEU.map((c, i) => (i === 0 ? "carte-etrangere" : c));
    expect(memeTaille.length).toBe(CLES_JEU.length);
    expect(empreinteDeJeu(memeTaille)).not.toBe(EMPREINTE_JEU);
  });

  it("[LE MUTANT] elle dépend de l'ORDRE — un indice ne veut rien dire sans lui", () => {
    // Mutant visé : trier la liste avant de hacher. `jeu.ts` dit « aucun ordre porteur », et c'est
    // vrai du SENS (AD-11) ; c'est FAUX de l'audit, puisque `rejouer` rend un INDICE. Deux jeux des
    // mêmes cartes rangées autrement ne rejouent pas pareil, et c'est ce qui doit se voir.
    const permute = [CLES_JEU[1], CLES_JEU[0], ...CLES_JEU.slice(2)];
    expect([...permute].sort()).toEqual([...CLES_JEU].sort());
    expect(empreinteDeJeu(permute)).not.toBe(EMPREINTE_JEU);
  });

  it("le séparateur tient : deux découpages du même flot de lettres diffèrent", () => {
    expect(empreinteDeJeu(["ab", "c"])).not.toBe(empreinteDeJeu(["a", "bc"]));
  });

  it("elle a la FORME que la contrainte de 0064 accepte, et elle est pure", () => {
    expect(EMPREINTE_JEU).toMatch(/^[0-9a-f]{8}$/);
    expect(empreinteDeJeu(CLES_JEU)).toBe(EMPREINTE_JEU);
  });

  it("[ANTI-VACUITÉ] le tirage la DESCEND — sinon rien de tout ceci n'atteint le journal", () => {
    expect(tirerUneCarte().empreinteJeu).toBe(EMPREINTE_JEU);
  });
});
