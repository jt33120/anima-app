import { describe, it, expect } from "vitest";
import {
  CORPUS_DESCRIPTION_CARTES,
  chercherSensDansDescription,
  cleDescription,
  lireDescriptionCarte,
} from "@/lib/corpus/description-cartes";
import { clesEcrites, clesNonEcrites, textesEcrits, ecrit, corpus } from "@/lib/corpus/port";
import { CLES_JEU } from "@/lib/tirage/jeu";

/**
 * description-cartes.test.ts — UNE DESCRIPTION DÉCRIT, ELLE NE SIGNIFIE PAS (Story 5.7, AC8).
 *
 * ══ CE QUI EST EN JEU ═══════════════════════════════════════════════════════════════════════════
 *
 * L'UX interdit d'afficher la moindre signification tant que l'utilisatrice n'a pas répondu : « pas
 * de nom de carte, pas de mot-clé, pas d'infobulle ». Mais une image sans texte alternatif est une
 * faute d'accessibilité, et on ne peut pas demander « qu'est-ce que tu vois ? » à quelqu'un à qui on
 * n'a rien donné à voir.
 *
 * La sortie tient dans une distinction : DÉCRIRE N'EST PAS SIGNIFIER. Le texte alternatif doit
 * porter la même matière que reçoit l'utilisatrice voyante par les yeux — *une porte entrouverte
 * dans un mur de pierre* — et pas ce qu'on est censé en tirer.
 *
 * Sans ce balayage, la première description écrite par distraction dirait « le passage vers une
 * nouvelle étape », et le lecteur d'écran recevrait LA LECTURE avant d'avoir eu la carte : une
 * violation de FR-018 déguisée en accessibilité, c'est-à-dire la pire — celle qu'on défend avec de
 * bonnes intentions.
 *
 * ══ LE CORPUS EST VIDE, DONC LA MOITIÉ DES ASSERTIONS SERAIT VACUE ══════════════════════════════
 *
 * Aucune des 24 descriptions n'est écrite. « Le corpus réel passe le balayage » est donc vrai d'un
 * balayage qui ne ferait rien. Chaque garde est doublée : une PREUVE SUR FAUX (le détecteur mord) et
 * un CONTRÔLE ANTI-FAUX-POSITIF (il ne mord pas sur du français descriptif légitime) — sans le
 * second, on livrerait une garde qui rend impossible d'écrire les descriptions qu'elle protège.
 */

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 1. Les créneaux
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC8] 24 créneaux déclarés, dérivés du jeu", () => {
  it("un créneau par carte, aucun orphelin", () => {
    expect(Object.keys(CORPUS_DESCRIPTION_CARTES.textes).sort()).toEqual(CLES_JEU.map(cleDescription).sort());
  });

  it("[porte pré-lancement] l'inventaire dit exactement où on en est", () => {
    // ⚠️ Ce chiffre est VOULU. Il monte quand les visuels sont produits et décrits — ces textes ne
    // sont PAS d'Anima (une description littérale n'est pas une interprétation, FR-054), et sont donc
    // comptés à part des créneaux du socle.
    expect(clesEcrites(CORPUS_DESCRIPTION_CARTES).length).toBe(0);
    expect(clesNonEcrites(CORPUS_DESCRIPTION_CARTES).length).toBe(24);
  });

  it("un créneau non écrit ne se déguise pas en texte, et une clé inconnue JETTE", () => {
    expect(lireDescriptionCarte("puits")).toEqual({ statut: "non_ecrit" });
    expect(() => lireDescriptionCarte("carte-fantome" as never)).toThrow(/non déclaré/);
  });

  it("le corpus est GELÉ", () => {
    expect(Object.isFrozen(CORPUS_DESCRIPTION_CARTES.textes)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 2. Le balayage MORD
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC8] le balayage attrape ce qui signifie", () => {
  it.each([
    ["Cette carte symbolise le passage.", "signification"],
    ["Le dessin représente une barque.", "signification"],
    ["Une porte qui évoque un commencement.", "signification"],
    ["Elle annonce un changement.", "signification"],
    ["Une image qui suggère l'attente.", "signification"],
    ["La carte incarne la patience.", "signification"],
    ["Une métaphore du seuil.", "signification"],
    ["Ce que ça veut dire : un départ.", "signification"],
    ["L'image renvoie à l'idée de seuil.", "signification"],
    ["Une carte qui parle de deuil.", "signification"],
    ["Une porte qui invite à entrer.", "signification"],
  ])("« %s » est refusée", (texte, famille) => {
    const trouve = chercherSensDansDescription(texte);
    expect(trouve.length, texte).toBeGreaterThan(0);
    expect(trouve.map((t) => t.famille)).toContain(famille);
  });

  it("l'adresse à la deuxième personne est refusée — c'est une lecture, pas une description", () => {
    // La forme la plus probable de la dérive : elle se glisse sans qu'on remarque avoir changé de
    // registre. « Tu es à un carrefour » n'est pas une description de carrefour.
    for (const t of ["Tu es à un carrefour.", "Ton chemin bifurque.", "Vous voyez une porte."]) {
      expect(chercherSensDansDescription(t).map((x) => x.famille), t).toContain("adresse");
    }
  });

  it("le fragment fautif est CITÉ, pas seulement signalé", () => {
    // Un booléen laisserait la personne qui corrige chercher à l'aveugle dans sa propre phrase.
    expect(chercherSensDansDescription("Cette carte symbolise le passage.")[0].terme).toBe("symbolise");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 3. Le balayage NE MORD PAS sur du français descriptif
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC8] le balayage laisse passer les descriptions littérales", () => {
  /**
   * Ces dix phrases sont ce que les 24 descriptions devront être. Si l'une d'elles se met un jour à
   * rougir, c'est le BALAYAGE qu'il faut corriger, pas la phrase : une garde qui rend impossible
   * d'écrire ce qu'elle protège a cessé d'être une garde.
   */
  it.each([
    "Une porte entrouverte dans un mur de pierre, au crépuscule.",
    "Une barque échouée sur des galets gris, sans rames.",
    "Un métier à tisser vide, les fils tendus, la navette posée au sol.",
    "Une lanterne allumée posée par terre, la flamme droite.",
    "Un puits de pierre, la corde enroulée sur la margelle.",
    "Un orage au-dessus d'une plaine, la pluie visible au loin.",
    "Une ruche en paille, quelques abeilles à l'entrée.",
    "Un escalier de pierre qui monte et disparaît dans la brume.",
    "Une mue de serpent abandonnée sur une branche sèche.",
    "Un sentier de terre entre deux haies, qui tourne vers la droite.",
  ])("« %s » passe", (texte) => {
    expect(chercherSensDansDescription(texte)).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 4. Le corpus réel — et la preuve que l'assertion n'est pas vacue
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC8] le corpus réel passe le balayage", () => {
  it("aucune description écrite ne signifie (vacue tant qu'aucune n'est écrite — assumé)", () => {
    for (const texte of textesEcrits(CORPUS_DESCRIPTION_CARTES)) {
      expect(chercherSensDansDescription(texte), texte).toEqual([]);
    }
  });

  it("LE BALAYAGE D'UN CORPUS MORD — prouvé sur un faux corpus rempli", () => {
    // Sans cette assertion, la précédente serait verte sur un balayage débranché : il n'y a
    // aujourd'hui aucun texte à parcourir, donc rien à trouver.
    const faux = corpus("faux-descriptions", {
      "description:puits": ecrit("Un puits de pierre, la corde enroulée sur la margelle."),
      "description:porte-entrouverte": ecrit("Cette carte symbolise le passage vers une nouvelle étape."),
    });
    const fautifs = textesEcrits(faux).filter((t) => chercherSensDansDescription(t).length > 0);
    expect(fautifs).toHaveLength(1);
    expect(fautifs[0]).toContain("symbolise");
  });
});
