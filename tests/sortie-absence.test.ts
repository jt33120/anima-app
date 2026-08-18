import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { texteVisible } from "./_absence";
import * as copie from "@/render/abonnement/copie-abonnement";
import { gabaritLegalPour } from "@/lib/courriel/gabarits";
import { dateLimiteResiliation } from "@/lib/domain/date-limite";
import { validerOrigine } from "@/lib/courriel/origine";

/**
 * Story 3.5 (AC2 [DUR]) — L'INVENTAIRE D'ABSENCE DU PARCOURS DE SORTIE.
 *
 * « Aucun questionnaire de départ, aucune offre de rétention, aucun "es-tu sûre ?" à étages. » Une
 * exigence formulée en NÉGATIF, et une garde d'absence ne vaut que si elle prouve d'abord qu'elle
 * REGARDE AU BON ENDROIT. Les trois disciplines codifiées en 3.3 s'appliquent ici :
 *
 *   (a) l'extracteur est éprouvé pour lui-même — il vit dans `tests/_absence.ts` et ses propres tests
 *       sont dans `tronc-absence.test.ts`, d'où il vient ;
 *   (b) LA PRÉSENCE AVANT L'ABSENCE — on retrouve d'abord des témoins connus dans le balayage, sans quoi
 *       un fichier renommé rendrait la garde verte et vide ;
 *   (c) le balayage n'est JAMAIS vide, et le nombre de chaînes examinées est journalisé.
 *
 * Sans (b), la garde la plus rassurante du dépôt serait aussi la plus creuse : zéro texte balayé
 * satisfait tous les interdits du monde.
 */

const racine = process.cwd();

/** Les surfaces EXACTES du parcours de sortie. Chemins littéraux : un fichier renommé fait rougir (b). */
const SURFACES: readonly string[] = [
  "render/abonnement/copie-abonnement.ts",
  "app/abonnement/page.tsx",
  "app/api/abonnement/resilier/route.ts",
  "app/api/abonnement/remboursement/route.ts",
];

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// LE VOCABULAIRE INTERDIT — chaque ligne est un dark pattern nommé
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
const INTERDITS: readonly { motif: RegExp; pourquoi: string }[] = [
  { motif: /pourquoi (?:tu |vous |pars|part)/i, pourquoi: "AC2 — aucun questionnaire de départ" },
  { motif: /dis[- ]nous|aide[- ]nous|ton avis|ton retour|qu'est-ce qui/i, pourquoi: "AC2 — aucun questionnaire déguisé" },
  { motif: /es-tu (?:s[ûu]re|certaine)|vraiment (?:s[ûu]re|partir)|confirmes?-tu/i, pourquoi: "AC2 — aucun « es-tu sûre ? »" },
  { motif: /\boffre\b|\bpromo|réduction|remise|gratuit pendant|mois offert|\bpause\b/i, pourquoi: "AC2 — aucune offre de rétention" },
  { motif: /reste avec|ne pars pas|reviens|on va te manquer|dommage/i, pourquoi: "AC2 — aucune retenue affective" },
  { motif: /plus que \d|dernier jour|il te reste \d|expire dans/i, pourquoi: "AC2 — aucun compte à rebours" },
  { motif: /tu (?:vas )?perdr|tu perdras|sera(?:ient)? (?:supprim|effac|perdu)|disparaîtr|disparaitr/i, pourquoi: "AC2/FR-029 — aucune rétention par la peur" },
  { motif: /\d+\s*branches?\b|branches? (?:posées?|restantes?)\s*:|sur \d+ branche/i, pourquoi: "FR-031 — aucun décompte" },
  { motif: /\bpremium\b/i, pourquoi: "AC1 — le mot-étiquette ne s'affiche nulle part" },
  { motif: /\bscore\b|\bniveau \d|jauge|progression/i, pourquoi: "FR-031 — aucun score, aucune jauge" },
];

/** Témoins de PRÉSENCE — s'ils manquent, le balayage ne regarde pas ce qu'il croit regarder (b). */
const TEMOINS_ATTENDUS: readonly string[] = [
  copie.TITRE,
  copie.ACTION_RESILIER,
  copie.ACTION_REPRENDRE,
  copie.ACTION_REMBOURSEMENT,
  copie.RIEN_NE_DISPARAIT,
  copie.REFUS_REMBOURSEMENT,
];

describe("[AC2 DUR] le parcours de sortie ne retient personne", () => {
  const balayage = SURFACES.map((p) => {
    const abs = resolve(racine, p);
    expect(existsSync(abs), `surface de sortie introuvable : ${p} (renommée ? la garde deviendrait creuse)`).toBe(
      true,
    );
    return { chemin: p, textes: texteVisible(readFileSync(abs, "utf-8")) };
  });
  const toutes = balayage.flatMap((b) => b.textes);

  it("(c) LE BALAYAGE N'EST PAS VIDE — et chaque surface y contribue", () => {
    for (const b of balayage) {
      expect(b.textes.length, `aucune chaîne visible extraite de ${b.chemin}`).toBeGreaterThan(0);
    }
    console.info(
      `[3.5 / sortie] ${SURFACES.length} surfaces balayées, ${toutes.length} chaînes visibles, ` +
        `${TEMOINS_ATTENDUS.length} témoins attendus, ${INTERDITS.length} interdits appliqués`,
    );
  });

  it("(b) LA PRÉSENCE AVANT L'ABSENCE — les témoins connus sont bien dans le balayage", () => {
    for (const t of TEMOINS_ATTENDUS) {
      expect(toutes, `témoin absent du balayage : « ${t} » — la garde d'absence ne prouverait rien`).toContain(t);
    }
  });

  it("(a) l'extracteur reste honnête sur CE corpus — il ne rend pas des chemins d'import", () => {
    expect(toutes.some((t) => t.startsWith("@/") || t.startsWith("./")), "des specificateurs d'import ont fuité").toBe(
      false,
    );
  });

  for (const { motif, pourquoi } of INTERDITS) {
    it(`aucune surface ne porte ${motif} — ${pourquoi}`, () => {
      for (const b of balayage) {
        for (const t of b.textes) {
          expect(t, `${pourquoi} → « ${t} » dans ${b.chemin}`).not.toMatch(motif);
        }
      }
    });
  }

  it("[FR-060] la confirmation vit sur la MÊME vue — aucune seconde page de confirmation n'existe", () => {
    // Trois clics : entrée → « Résilier » → confirmation. Une route `/abonnement/confirmer` ferait
    // quatre, et quatre est illégal depuis la loi du 16 août 2022. La confirmation est un paramètre
    // de recherche sur la même page (`?confirmer=1`), pas un document de plus.
    expect(existsSync(resolve(racine, "app/abonnement/confirmer")), "un second écran de confirmation existe").toBe(
      false,
    );
    expect(readFileSync(resolve(racine, "app/abonnement/page.tsx"), "utf-8")).toMatch(/confirmer === "1"/);
  });

  it("[AC2] les deux gestes ont la MÊME grammaire visuelle — « partir » n'est pas plus dur à cliquer", () => {
    // Le dark pattern le plus discret : un bouton « rester » plein et coloré, un lien « partir » gris et
    // petit. Ici les deux passent par la même classe globale, sans variante d'emphase.
    const css = readFileSync(resolve(racine, "app/abonnement/abonnement.module.css"), "utf-8");
    expect(css, "une couleur d'alerte sur le bouton de résiliation dissuaderait").not.toMatch(
      /--alerte|--danger|\bred\b|#f?[0-9a-f]{0,2}0000\b/i,
    );
    expect(css).toMatch(/\.page :global\(\.t-bouton\)/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// LE COURRIEL DE RECONDUCTION — ce qu'il ne promet pas
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC4] le gabarit légal ne promet aucun désabonnement", () => {
  const origine = validerOrigine("https://exemple.fr")!;
  // La date limite passe par son constructeur validant — un `as` contournerait le seul mécanisme
  // qui empêche une chaîne quelconque d'atteindre un serveur de messagerie (#14).
  const info = {
    motif: "reconduction_a_venir",
    dateLimite: dateLimiteResiliation("2027-03-05T12:00:00Z")!,
  } as const;

  it("CONTRÔLE : l'origine de test est valide (sinon le gabarit ne se rend pas)", () => {
    expect(origine).toBeTruthy();
  });

  it("le gabarit existe et nomme le chemin de résiliation (contrôle positif)", () => {
    const g = gabaritLegalPour(info, origine)!;
    expect(g.objet).toBeTruthy();
    expect(g.texte, "prévenir sans dire où arrêter serait la lettre contre l'esprit").toMatch(/résilier/i);
    expect(g.texte).toContain("/abonnement");
  });

  it("[DUR] il ne propose AUCUN désabonnement — la promesse serait intenable", () => {
    const g = gabaritLegalPour(info, origine)!;
    // Le courriel repartira l'an prochain quoi qu'elle clique : l'information avant reconduction tacite
    // est due (art. L215-1). Offrir le lien serait mentir, et le mensonge serait découvert au courriel
    // suivant. Le pied de `gabaritPour` (synthèse/échéance) promet, lui, et il peut tenir.
    expect(g.texte).not.toMatch(/ne plus recevoir|se d[ée]sabonner|d[ée]sabonnement/i);
    expect(g.texte).not.toContain("/desabonnement");
  });

  it("[NFR-015] l'objet reste neutre : ni montant, ni date, ni registre ésotérique", () => {
    const g = gabaritLegalPour(info, origine)!;
    expect(g.objet).not.toMatch(/\d/); // ni 69 €, ni une date
    expect(g.objet).not.toMatch(/âme|astre|tarot|karma|destin/i);
  });

  /**
   * ⚠️ CE TEST DISAIT L'INVERSE, ET IL CONSACRAIT LE MANQUEMENT (revue des Epics 1 à 4, #14).
   *
   * Il exigeait que le CORPS ne porte ni date ni montant, au motif que « ils vivent derrière
   * l'authentification » et qu'un montant sur un écran verrouillé violerait NFR-015. La seconde
   * moitié est vraie de l'OBJET — c'est lui qui paraît en aperçu — et fausse du corps, qu'on
   * n'ouvre qu'en ouvrant le courriel.
   *
   * Et l'art. L215-1 tranche : l'information « mentionne, dans un encadré apparent, la date limite
   * de résiliation ». Dans le courrier électronique dédié, pas ailleurs. Renvoyer vers un écran
   * derrière authentification, c'est demander à quelqu'un d'aller chercher ce que la loi impose de
   * lui apporter — à quelqu'un qui, par hypothèse, ne se connecte plus.
   *
   * La garde qui compte reste posée juste au-dessus : l'OBJET, lui, ne porte aucun chiffre.
   */
  it("le corps PORTE la date limite et le montant — c'est l'objet qui reste muet", () => {
    const g = gabaritLegalPour(info, origine)!;
    expect(g.texte, "art. L215-1 : la date limite est DANS le courriel").toContain("5 mars 2027");
    expect(g.texte, "on n'annonce pas un débit sans dire combien").toMatch(/69\s*€/);
    expect(g.objet, "l'aperçu, lui, ne chiffre rien").not.toMatch(/\d/);
  });

  it("un motif hors de l'ensemble fermé rend `null` — l'adaptateur refusera d'envoyer", () => {
    expect(gabaritLegalPour({ motif: "inconnu" } as never, origine)).toBeNull();
  });
});

describe("[AC4 DUR] l'envoi de reconduction ne passe par AUCUNE garde du canal produit", () => {
  const src = readFileSync(resolve(racine, "lib/courriel/reconduction.ts"), "utf-8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );

  for (const interdit of [
    /reserverNotification/,
    /reserver_notification/,
    /preference_courriel/,
    /jetonDesabonnement/,
    /libererNotification/,
  ]) {
    it(`ne mentionne jamais ${interdit} dans son code`, () => {
      expect(
        src,
        "un opt-out marketing ferait disparaître une obligation légale d'information (art. L215-1 ≠ art. 21)",
      ).not.toMatch(interdit);
    });
  }

  it("CONTRÔLE POSITIF : il appelle bien le chemin LÉGAL du port", () => {
    expect(src, "sans cet appel, les interdits ci-dessus seraient vrais d'un fichier vide").toMatch(
      /envoyerInformationLegale/,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// [P1] LA GARDE LEXICALE — « désabonnement » ≠ « résiliation »
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

describe("[P1] les fichiers de la 3.5 n'empruntent jamais le vocabulaire du canal courriel", () => {
  /**
   * Les deux mots se ressemblent en français et désignent deux choses sans rapport : `desabonnement`
   * arrête des COURRIELS (Story 4.9, art. 21), `resiliation` arrête un CONTRAT à 69 €/an. Un dev — ou
   * un modèle — qui les confond livre un bouton « se désabonner » qui coupe les notifications et laisse
   * filer l'abonnement. La confusion ne produirait aucune erreur : les deux chemins existent, les deux
   * marchent, et seul le relevé bancaire dirait laquelle a été appelée.
   */
  const FICHIERS_35 = [
    "app/abonnement/page.tsx",
    "app/api/abonnement/resilier/route.ts",
    "app/api/abonnement/remboursement/route.ts",
    "render/abonnement/copie-abonnement.ts",
    "lib/stripe/resiliation.ts",
    "lib/stripe/evenement-sortie.ts",
    "lib/data/depot-resiliation.ts",
  ];

  for (const f of FICHIERS_35) {
    it(`${f} n'emploie pas « désabonnement »`, () => {
      const code = readFileSync(resolve(racine, f), "utf-8").replace(/\/\*[\s\S]*?\*\//g, "");
      // Les commentaires sont retirés : plusieurs de ces fichiers EXPLIQUENT la distinction, et
      // l'interdire dans la prose empêcherait d'écrire précisément ce qui évite la confusion.
      expect(code, "vocabulaire du canal courriel dans un fichier de résiliation (P1)").not.toMatch(
        /d[ée]sabonnement|desabonner/i,
      );
    });
  }

  it("CONTRÔLE POSITIF : ces fichiers emploient bien le vocabulaire de la RÉSILIATION", () => {
    // Sans ça, l'interdit ci-dessus serait vrai de sept fichiers vides.
    const tout = FICHIERS_35.map((f) => readFileSync(resolve(racine, f), "utf-8")).join("\n");
    expect(tout).toMatch(/r[ée]sili/i);
    expect(tout).toMatch(/rembours/i);
  });

  it("… et les fichiers du CANAL COURRIEL, eux, emploient bien « désabonnement » (les deux mondes existent)", () => {
    const canal = readFileSync(resolve(racine, "lib/courriel/desabonnement.ts"), "utf-8");
    expect(canal, "si ce mot avait disparu du canal, la garde ci-dessus ne distinguerait plus rien").toMatch(
      /d[ée]sabonnement/i,
    );
  });
});
