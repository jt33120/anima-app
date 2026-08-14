import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { chercherInterdits } from "@/lib/domain/lexique-interdit";
import { chercherPredictions } from "@/lib/domain/marqueurs-prediction";
import { modulesImportes, viseLeDossier } from "./_imports";
import {
  clesEcrites,
  clesNonEcrites,
  corpus,
  ecrit,
  lireTexte,
  textesEcrits,
  NON_ECRIT,
  type Corpus,
} from "@/lib/corpus/port";
import {
  CLES_NUMEROLOGIE,
  CORPUS_NUMEROLOGIE,
  cleNumerologie,
  texteDe,
  valeursPossibles,
} from "@/lib/corpus/numerologie";
import { NOMBRES } from "@/lib/astro/numerologie";

/**
 * Story 5.2 (T7) — LES INVARIANTS DE LA COUCHE CORPUS (FR-054, FR-086, FR-053, AD-1).
 *
 * ══ ⚠️ CE FICHIER EST UNE GARDE D'ABSENCE SUR UN CORPUS VIDE — LIRE AVANT DE LE MODIFIER ═══════
 *
 * Le corpus v1 ne contient AUCUN texte (voir `lib/corpus/numerologie.ts`). Une garde du type
 * « chaque texte écrit passe le contrôle » est donc VACUEMENT VRAIE aujourd'hui : elle serait verte
 * même si le balayage était cassé, même si le détecteur rendait toujours `[]`, même si la fonction
 * d'extraction ne trouvait rien. C'est exactement le mode d'échec relevé deux fois en revue 4.10 sur
 * `tronc-absence.test.ts`.
 *
 * Les trois disciplines s'appliquent donc, et la troisième demande un traitement particulier ici :
 *
 *   (a) LE DÉTECTEUR EST ÉPROUVÉ POUR LUI-MÊME, sur des chaînes fabriquées connues-mauvaises ET
 *       connues-bonnes, avant qu'on ne balaie quoi que ce soit ;
 *   (b) PRÉSENCE AVANT ABSENCE : le nombre de créneaux DÉCLARÉS est asserté non nul (69) — c'est ce
 *       qui reste vérifiable quand le nombre de créneaux ÉCRITS vaut zéro ;
 *   (c) LE BALAYAGE EST PROUVÉ SUR UN FAUX CORPUS. La même fonction `balayer` est appliquée à un
 *       corpus FABRIQUÉ contenant des textes connus-mauvais, et elle DOIT les rejeter. Sans ça, on
 *       ne saurait pas si le balayage mord — on saurait seulement qu'il ne trouve rien.
 *
 * Le jour où Anima écrit un texte, `textesEcrits` cesse d'être vide et le balayage se met à mordre
 * pour de bon, sans qu'une ligne change ici.
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

const FICHIERS_CORPUS = fichiersTs("lib/corpus");

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 1. La pureté de la couche (AD-1, AC9)
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AD-1/DUR] lib/corpus est une couche PURE", () => {
  it("[CONTRÔLE DU CONTRÔLE] la couche a bien été balayée", () => {
    // ⚠️ UN COMPTE EXACT, JAMAIS `toBeGreaterThan`. Relâcher cette assertion pour faire passer une
    // story est précisément la façon dont les gardes meurent : un corpus ajouté sans être inscrit
    // ici échapperait à TOUTES les gardes de ce fichier sans que rien ne rougisse.
    expect(FICHIERS_CORPUS.length, "aucun fichier trouvé dans lib/corpus — garde vide").toBe(7);
    expect(FICHIERS_CORPUS).toContain("lib/corpus/port.ts");
    expect(FICHIERS_CORPUS).toContain("lib/corpus/numerologie.ts");
    // Story 5.4 — les deux corpus du socle quotidien vivent sous EXACTEMENT les mêmes gardes.
    expect(FICHIERS_CORPUS).toContain("lib/corpus/mantra.ts");
    expect(FICHIERS_CORPUS).toContain("lib/corpus/horoscope.ts");
    // Story 5.5 — les neuf interprétations de type, déclarées et non écrites.
    expect(FICHIERS_CORPUS).toContain("lib/corpus/enneagramme.ts");
    // Story 5.9 — les 24 créneaux des ancrages. ⚠️ Seul corpus PREMIUM (FR-056) : sa pureté ne
    // suffit pas, il lui faut EN PLUS de ne jamais entrer dans le bundle client — garde séparée,
    // `tests/ancrage-frontiere.test.ts`. Aucune des deux ne couvre l'autre.
    expect(FICHIERS_CORPUS).toContain("lib/corpus/ancrage.ts");
    // Story 5.7 — les 24 descriptions de cartes. ⚠️ Ce ne sont PAS des textes d'Anima : une
    // description littérale n'interprète rien (FR-054 ne la lui réserve donc pas). Elles vivent ici
    // quand même, parce qu'elles doivent subir les MÊMES gardes — voix (2.8), prédiction (FR-053) —
    // et que le port `TexteCorpus` est ce qui empêche un créneau vide de se déguiser en texte.
    expect(FICHIERS_CORPUS).toContain("lib/corpus/description-cartes.ts");
  });

  it("[Story 5.7] le SENS des cartes vit hors de ce dossier, et c'est une décision", () => {
    // Le sixième corpus d'Anima — 24 créneaux — est le seul à ne pas être ici : il porte
    // `import "server-only"`, que la garde de pureté ci-dessous interdit dans `lib/corpus/`.
    //
    // Ce n'est pas un contournement, c'est l'inverse. Un corpus du socle est une CONSTANTE partagée
    // que le rendu peut lire ; le catalogue de sens, lui, ne vaut QUE s'il ne franchit jamais la
    // frontière client (AD-11 / AC4). `server-only` transforme cette exigence en échec de build.
    // Le poser ici aurait obligé à percer une exception dans une garde saine — et une garde à
    // exceptions finit par n'en être plus une.
    //
    // Cette assertion existe pour que l'absence soit VÉRIFIÉE plutôt que constatée : si quelqu'un
    // déplaçait un jour `sens-cartes.ts` dans `lib/corpus/`, il faudrait qu'il retire d'abord son
    // `server-only`, et c'est exactement ce qu'on ne veut pas laisser passer en silence.
    expect(FICHIERS_CORPUS).not.toContain("lib/corpus/sens-cartes.ts");
    expect(existsSync(resolve(RACINE, "lib/lecture/sens-cartes.ts"))).toBe(true);
    expect(readFileSync(resolve(RACINE, "lib/lecture/sens-cartes.ts"), "utf-8").split("\n")[0]).toMatch(
      /^import "server-only";/,
    );
  });

  it("[FR-054/FR-047] n'importe AUCUN modèle de langage — un corpus ne se génère pas", () => {
    for (const f of FICHIERS_CORPUS) {
      const src = sansCommentaires(readFileSync(resolve(RACINE, f), "utf-8"));
      expect(src, `${f} importe lib/ai`).not.toMatch(/from\s+["']@?\/?lib\/ai/);
      expect(src, `${f} importe lib/ai`).not.toMatch(/from\s+["']\.\.?\/.*\bai\//);
    }
  });

  /**
   * ⚠️ CETTE GARDE NE VOYAIT PAS LA FAUTE QU'ELLE SURVEILLE (revue du 2026-08-12, E1).
   *
   * Les six motifs étaient bâtis sur `from "…"`. Or `server-only` s'importe POUR SON EFFET DE BORD,
   * sans `from` — et c'est la seule forme employée dans tout le dépôt
   * (`lib/ordonnanceur/environnement.ts:1`). La ligne exacte qu'il fallait interdire était
   * précisément celle que le motif ne pouvait pas reconnaître. Même trou pour un import dynamique
   * ou un chemin relatif.
   *
   * On interroge donc la LISTE DES MODULES IMPORTÉS (`tests/_imports.ts`), qui connaît les cinq
   * formes, plutôt que le texte source à la regex.
   */
  const INTERDITS: Array<[(m: string) => boolean, string]> = [
    [(m) => m === "server-only", "server-only"],
    [(m) => viseLeDossier(m, "lib/data"), "lib/data"],
    [(m) => m.startsWith("@supabase/"), "supabase"],
    [(m) => viseLeDossier(m, "app"), "app/"],
    [(m) => viseLeDossier(m, "render"), "render/"],
    [(m) => m === "next" || m.startsWith("next/"), "next"],
  ];

  it("[CONTRÔLE DU CONTRÔLE] les interdits attrapent les CINQ formes d'import", () => {
    // Sans ce contrôle, la garde ci-dessous resterait verte pour la raison qu'on vient de corriger :
    // elle regarderait à côté. Chaque forme est éprouvée sur un source FABRIQUÉ.
    const attrape = (src: string) =>
      INTERDITS.some(([predicat]) => modulesImportes(src).some(predicat));
    expect(attrape('import "server-only";'), "effet de bord — LE trou d'origine").toBe(true);
    expect(attrape('import x from "server-only";')).toBe(true);
    expect(attrape('const x = await import("@/lib/data/depot-seance");'), "dynamique").toBe(true);
    expect(attrape('import { a } from "../../lib/data/depot-seance";'), "chemin relatif").toBe(true);
    expect(attrape('const s = require("@supabase/supabase-js");'), "require").toBe(true);
    expect(attrape('export { x } from "@/render/arbre/copie-arbre";'), "ré-export").toBe(true);
    // Et il ne mord pas sur du légitime : un corpus importe bien ses propres voisins.
    expect(attrape('import { NON_ECRIT } from "./port";')).toBe(false);
    expect(attrape('import { NOMBRES } from "@/lib/astro/numerologie";')).toBe(false);
  });

  it("ne connaît ni base, ni serveur, ni rendu", () => {
    for (const f of FICHIERS_CORPUS) {
      const modules = modulesImportes(sansCommentaires(readFileSync(resolve(RACINE, f), "utf-8")));
      for (const [predicat, nom] of INTERDITS) {
        expect(modules.filter(predicat), `${f} connaît ${nom}`).toEqual([]);
      }
    }
  });

  it("[FR-054] n'est jamais exclu du contrôle de voix bloquant de la Story 2.8", () => {
    // La seule façon de perdre le contrôle de lexique sur les textes d'Anima serait d'ajouter
    // `lib/corpus` aux exclusions de `lexique-voix.test.ts`. La revue 4.9 en a déjà RETIRÉ quatre
    // qui ne se justifiaient plus ; on n'en rajoute pas une.
    const voix = readFileSync(resolve(RACINE, "tests/lexique-voix.test.ts"), "utf-8");
    const zoneExclusions = voix.slice(0, voix.indexOf("describe("));
    expect(zoneExclusions.length, "zone d'exclusions introuvable — contrôle vide").toBeGreaterThan(500);
    expect(zoneExclusions).not.toMatch(/lib\/corpus/);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 2. Le détecteur de prédiction, éprouvé POUR LUI-MÊME (discipline (a), FR-053)
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[FR-053/(a)] le détecteur de prédiction attrape ce qu'il doit attraper", () => {
  const CONNUES_MAUVAISES = [
    "Tu vas rencontrer quelqu'un cette année.",
    "Tu vas découvrir une autre façon de faire.",
    "Ce nombre annonce une période de retrait.",
    "Cette année t'apportera une clarté nouvelle.",
    "Tu verras les choses autrement d'ici l'automne.",
    "Tu seras plus libre après cet été.",
    "Ton avenir se joue maintenant.",
    "Ce nombre te mènera vers une rupture.",
    "Voici ce qui t'attend.",
    "Ce nombre prédit une période de retrait.",
    "Les cartes présagent un changement.",
    "C'est une prophétie ancienne.",

    // ── D1 (revue du 2026-08-12) — LE MOT INTERCALÉ ─────────────────────────────────────────────
    //
    // Le détecteur exigeait que le verbe suive IMMÉDIATEMENT le pronom. En français il ne le suit
    // presque jamais : négation, pronoms compléments, adverbes. Mesuré sur onze phrases
    // prédictives réelles, l'ancien motif en attrapait DEUX — et « tu ne verras », la forme la plus
    // courante de toutes, était la première à passer.
    "Tu ne verras rien venir.",
    "Tu y trouveras de quoi t'appuyer.",
    "Tu te sentiras plus légère au printemps.",
    "Tu en sortiras autrement.",
    "Tu vas y arriver.",
    "Tu vas te sentir plus libre.",
    "Ce nombre te le dira mieux que moi.",

    // ── D1 — LA FAMILLE LEXICALE QUI MANQUAIT ───────────────────────────────────────────────────
    //
    // Quatre racines étaient recensées (prédire, prophétie, présager, voyance). Le registre
    // ésotérique en a des dizaines, et ce sont les plus élégantes qu'on écrit sans y penser :
    // aucune de ces phrases n'aurait fait rougir quoi que ce soit.
    "Ce nombre augure une année de passage.",
    "Les auspices sont favorables cette année.",
    "Ce tirage est un oracle.",
    "C'est une pratique divinatoire.",
    "Une prémonition, peut-être.",
    "Ce nombre prophétise un passage.",
    "Il est écrit que tout se dénoue à l'automne.",
    "Tu es destinée à rencontrer quelqu'un.",

    // ── Story 5.5 — LE FUTUR À LA TROISIÈME PERSONNE ────────────────────────────────────────────
    //
    // Tous les motifs `futur_adresse` sont ancrés sur `tu` : l'en-tête l'assume (« la sélectivité
    // vient du destinataire »). Le raisonnement tenait tant que le corpus parlait de NOMBRES. Il
    // tombe dès que le corpus parle de TYPES, parce qu'un portrait d'ennéagramme s'écrit sur « le
    // 4 » — et qu'une fois le type retenu, « le 4 » EST elle. Le futur redevient adressé sans
    // qu'un seul « tu » n'apparaisse.
    //
    // Mesuré le 2026-08-13, avant correctif : les cinq phrases ci-dessous étaient VERTES.
    "Le 4 finira par se sentir seul.",
    "Le 2 développera un ressentiment silencieux.",
    "Le 9 évitera le conflit jusqu'à l'effacement.",
    "Le type 1 ira vers la colère s'il ne lâche rien.",
    "Le 5 donnera plus tard ce qu'il a compris.",
    "Les 7 fuiront ce qui pèse.",
    "Le 6 ne fera pas confiance du premier coup.",
    "Le 3 va finir par se confondre avec son rôle.",
    "Le 8 aura besoin de garder la main.",
    // ── Story 5.5, T11 — LA DÉSIGNATION SANS CHIFFRE ────────────────────────────────────────────
    //
    // Trou trouvé par la FICHE D'ÉCRITURE, pas par une relecture : la fiche donnait ces phrases en
    // exemples de refus, et le test qui exécute ses exemples a montré qu'elles passaient. Un
    // portrait reprend naturellement son sujet sans le renuméroter — « ce type », « ce profil » —
    // et toute la famille passait à côté.
    "Ce type va chercher la reconnaissance.",
    "Ce profil finira par s'épuiser.",
    "Le type se retirera dès que ça pèse.",
    "Ces types vont se heurter au même mur.",
  ];

  const CONNUES_BONNES = [
    "Ce nombre décrit une tendance à se retirer pour comprendre.",
    "On associe traditionnellement ce nombre à la patience.",
    "Ce serait une façon de le lire, parmi d'autres.",
    "Tu peux le lire comme une invitation, ou pas du tout.",
    "Les mois à venir sont un repère, rien de plus.",
    "Le nombre de destinée porte ce même mouvement.",
    "Une prédisposition n'est pas une trajectoire.",
    "Personne ne connaît l'avenir, et ce nombre non plus.",
    "Tu travailles souvent en retrait, et ça te va.",
    "Le cycle se refermera de lui-même.",
    "Tu vas bien, et ce nombre n'y change rien.",
    "Tu vas mieux quand tu ralentis.",
    // L'élargissement de D1 autorise UN mot intercalé. Ces phrases-ci en ont un et ne prédisent
    // rien : sans elles, on ne saurait pas si le motif élargi mord encore ou avale la langue.
    "Tu as déjà tout ce qu'il faut pour le lire.",
    "Tu le lis comme tu veux, ou pas du tout.",
    "Tu te reconnais peut-être là-dedans.",
    "Le nombre de destinée se lit dans la date entière.",
    "Ce nombre décrit un embarras fréquent chez les 4.",
    // Story 5.5 — la famille du futur à la 3ᵉ personne ne doit pas avaler le présent qui DÉCRIT.
    // C'est toute la règle de la fiche d'écriture : le présent décrit, le futur annonce.
    "Le 4 se retire quand le bruit monte.",
    "Le 9 tient la paix en évitant le conflit.",
    "Les 7 cherchent ce qui ouvre, plutôt que ce qui ferme.",
    // Les mots français qui finissent en -ra / -ront sans être des verbes, dans une phrase qui
    // désigne un type — c'est exactement la configuration où un détecteur naïf mordrait.
    "Le 4 se reconnaît dans un mantra plus que dans une consigne.",
    "Le 9 garde son aura tranquille.",
    "Le 3 avance de front, et ça se voit.",
    "Le 5 supporte mal une caméra.",
    // ⚠️ LA CONSTRUCTION « LE TYPE DE… » N'EST PAS UNE DÉSIGNATION DE TYPE, et sans ces témoins la
    // troisième alternative mordrait sur du français ordinaire — donc deviendrait un bruit qu'on
    // finirait par contourner par une exclusion, c'est-à-dire par un trou.
    "Le type de réponse qu'elle donnera lui appartient.",
    "Ce type d'élan reviendra de lui-même.",
    "Les types de liens qu'elle nouera ne se décident pas ici.",
    // …et le présent qui décrit, sans chiffre non plus.
    "Ce type se retire quand le bruit monte.",
  ];

  it("rejette CHAQUE chaîne connue-mauvaise, en citant sa preuve", () => {
    for (const texte of CONNUES_MAUVAISES) {
      const trouve = chercherPredictions(texte);
      expect(trouve.length, `non détecté : « ${texte} »`).toBeGreaterThan(0);
      expect(trouve[0].terme.length, `terme vide sur « ${texte} »`).toBeGreaterThan(0);
    }
  });

  it("laisse passer CHAQUE chaîne connue-bonne — sans quoi le corpus serait inécrivable", () => {
    for (const texte of CONNUES_BONNES) {
      expect(chercherPredictions(texte), `faux positif sur « ${texte} »`).toEqual([]);
    }
  });

  it("épargne les mots piégés du futur français", () => {
    // Sans le préfixe de destinataire, ces mots feraient rougir du texte parfaitement légitime — et
    // on finirait par assouplir le détecteur jusqu'à ce qu'il n'attrape plus rien.
    for (const mot of ["embarras", "une caméra", "un affront", "le front", "un repas", "le fracas"]) {
      expect(chercherPredictions(`Ce nombre évoque ${mot}.`), mot).toEqual([]);
    }
  });

  it("est insensible à la casse et aux accents", () => {
    expect(chercherPredictions("TU VAS DÉCOUVRIR").length).toBeGreaterThan(0);
    expect(chercherPredictions("Ce nombre prédit tout").length).toBeGreaterThan(0);
    expect(chercherPredictions("Ce nombre predit tout").length).toBeGreaterThan(0);
  });

  it("[D1] UN mot intercalé, pas DEUX — la borne de l'élargissement est nommée", () => {
    // Aller jusqu'à deux mots ferait exploser les faux positifs pour un rendement marginal : les
    // constructions réelles (« tu ne verras », « tu te sentiras ») n'en intercalent qu'un.
    expect(chercherPredictions("Tu ne verras rien.").length).toBeGreaterThan(0);
    expect(chercherPredictions("Tu ne me verras plus.")).toEqual([]);
  });

  it("[LE PRIX DE D1, ASSUMÉ ET NOMMÉ] un faux positif connu, écrit noir sur blanc", () => {
    // Ce test AFFIRME un faux positif au lieu de le découvrir un jour en production. « tu vois
    // l'embarras » compte un mot intercalé puis un mot en `-ras` : le détecteur le signale, et
    // c'est l'arbitrage assumé — un faux positif coûte une reformulation, un faux négatif publie
    // une prédiction sous le nom d'une personne réelle.
    //
    // Si quelqu'un fait tomber ce test en RESSERRANT le motif, qu'il relise d'abord les huit
    // phrases de D1 dans `CONNUES_MAUVAISES` : c'est ce qu'il rouvre.
    expect(chercherPredictions("Tu vois l'embarras que ça crée.").length).toBeGreaterThan(0);
  });

  it("[5.5] le futur n'est visé QU'EN PRÉSENCE d'un type — l'impersonnel reste épargné", () => {
    // L'en-tête du détecteur épargne délibérément le futur impersonnel : « le cycle se refermera »
    // n'annonce rien sur la vie de personne. La 5.5 ne renverse PAS cette décision — elle identifie
    // le cas où sa prémisse est fausse. Une fois qu'un type lui a été attribué, une phrase sur « le
    // 4 » n'est plus impersonnelle : c'est une phrase sur elle.
    expect(chercherPredictions("Le cycle se refermera de lui-même.")).toEqual([]);
    expect(chercherPredictions("Le 4 se refermera de lui-même.").length).toBeGreaterThan(0);
  });

  it("[5.5] la désignation doit précéder le verbe, et rester dans la MÊME phrase", () => {
    // Sans borne de phrase, un texte qui nomme un type au début rendrait prédictive toute phrase
    // au futur jusqu'à la fin du créneau — y compris une phrase impersonnelle légitime.
    expect(chercherPredictions("Le 4 se retire. Le cycle se refermera de lui-même.")).toEqual([]);
  });

  it("[5.5 / LE PRIX, ASSUMÉ ET NOMMÉ] « le 4 l'aura oublié » n'est pas attrapé", () => {
    // `aura` est à la fois le futur d'avoir et un nom du registre ésotérique — que ce corpus-ci
    // emploiera. On épargne donc `aura` derrière un déterminant qui ne peut PAS précéder un verbe
    // conjugué (« son aura », « l'aura »). Le prix est le pronom élidé : dans « le 4 l'aura
    // oublié », `l'` est un complément d'objet, pas un déterminant — et la phrase passe.
    //
    // Arbitrage : « son aura » est une phrase que ce corpus écrira souvent ; « il l'aura oublié »
    // est une tournure qu'on n'écrit pratiquement jamais dans un portrait. Qui resserre ceci
    // rouvre un faux positif sur tout le vocabulaire du produit.
    expect(chercherPredictions("Le 4 l'aura oublié.")).toEqual([]);
    expect(chercherPredictions("Le 8 aura besoin de garder la main.").length).toBeGreaterThan(0);
  });

  it("[D1] « destinée » seule reste écrivable, « destinée À » ne l'est pas", () => {
    // La numérologie ne s'écrit pas sans « nombre de destinée ». La bannir rendrait le corpus
    // inécrivable — c'est le préfixe qui bascule, pas le mot.
    expect(chercherPredictions("Le nombre de destinée porte ce mouvement.")).toEqual([]);
    expect(chercherPredictions("Tu es destinée à partir.").length).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 3. Le balayage — prouvé sur un FAUX corpus (discipline (c))
// ══════════════════════════════════════════════════════════════════════════════════════════════

/** Le balayage, écrit UNE fois : le vrai corpus et le faux passent par exactement le même code. */
function balayer(c: Corpus): Array<{ texte: string; motif: string }> {
  const refus: Array<{ texte: string; motif: string }> = [];
  for (const texte of textesEcrits(c)) {
    for (const i of chercherInterdits(texte)) refus.push({ texte, motif: `${i.famille}:${i.terme}` });
    for (const p of chercherPredictions(texte)) refus.push({ texte, motif: `${p.famille}:${p.terme}` });
  }
  return refus;
}

describe("[(c)] le balayage MORD — prouvé sur un corpus fabriqué", () => {
  it("rejette un texte qui prédit", () => {
    const faux = corpus("faux", { "x:1": ecrit("Tu vas rencontrer quelqu'un.") });
    const refus = balayer(faux);
    expect(refus.length, "le balayage n'a rien vu — il est cassé").toBeGreaterThan(0);
    expect(refus[0].motif).toMatch(/^futur_adresse:/);
  });

  it("rejette un texte qui emploie le lexique médical interdit (Story 2.8)", () => {
    const faux = corpus("faux", { "x:1": ecrit("Ce nombre parle de ta santé mentale.") });
    const refus = balayer(faux);
    expect(refus.length, "le contrôle de voix ne mord pas sur le corpus").toBeGreaterThan(0);
  });

  it("laisse passer un texte propre — sinon le balayage rejetterait tout, ce qui ne prouve rien", () => {
    const faux = corpus("faux", { "x:1": ecrit("Ce nombre décrit un mouvement de retrait.") });
    expect(balayer(faux)).toEqual([]);
  });
});

describe("[FR-053/FR-054] le corpus réel passe le balayage", () => {
  it("aucun texte écrit ne prédit ni n'emploie un terme interdit", () => {
    expect(balayer(CORPUS_NUMEROLOGIE)).toEqual([]);
  });

  it("[(b) PRÉSENCE] les créneaux sont bien DÉCLARÉS, même si aucun n'est écrit", () => {
    // C'est ce qui reste vérifiable quand le nombre de textes vaut zéro : sans cette assertion,
    // l'assertion précédente serait verte sur un corpus inexistant.
    expect(CLES_NUMEROLOGIE.length).toBe(69);
    expect(Object.keys(CORPUS_NUMEROLOGIE.textes).length).toBe(69);
  });

  it("[porte pré-lancement] l'inventaire dit exactement où on en est", () => {
    const ecrites = clesEcrites(CORPUS_NUMEROLOGIE);
    const restantes = clesNonEcrites(CORPUS_NUMEROLOGIE);
    expect(ecrites.length + restantes.length).toBe(69);
    // ⚠️ Ce chiffre est VOULU. Il monte quand Anima écrit — jamais quand un modèle « aide ».
    expect(
      ecrites.length,
      "des textes sont apparus dans le corpus : vérifier qu'ils viennent bien d'Anima (FR-054/FR-086), " +
        "puis mettre à jour ce compte et le tableau de lib/corpus/README.md",
    ).toBe(0);
    expect(restantes.length).toBe(69);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 4. Le contrat du port
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC2] un créneau non écrit ne se déguise jamais en texte", () => {
  it("`ecrit()` refuse une chaîne vide à la construction", () => {
    // Un créneau vide déclaré « écrit » passerait le compte de complétude et n'afficherait rien :
    // le pire des deux mondes, et invisible.
    expect(() => ecrit("")).toThrow();
    expect(() => ecrit("   ")).toThrow();
    expect(ecrit("  du texte  ")).toEqual({ statut: "ecrit", texte: "du texte" });
  });

  it("`lireTexte` JETTE sur une clé non déclarée, au lieu de la faire passer pour non écrite", () => {
    // Rendre `non_ecrit` ferait passer une faute de frappe pour du travail d'écriture en attente :
    // elle resterait vide pour toujours et l'inventaire ne la compterait jamais.
    expect(() => lireTexte(CORPUS_NUMEROLOGIE, "chemin_de_vie:44")).toThrow(/non déclaré/);
    expect(() => lireTexte(CORPUS_NUMEROLOGIE, "nimporte:1")).toThrow();
    expect(lireTexte(CORPUS_NUMEROLOGIE, "chemin_de_vie:7")).toEqual(NON_ECRIT);
  });

  it("le corpus est GELÉ — personne n'y écrit à l'exécution", () => {
    expect(Object.isFrozen(CORPUS_NUMEROLOGIE)).toBe(true);
    expect(Object.isFrozen(CORPUS_NUMEROLOGIE.textes)).toBe(true);
    expect(() => {
      (CORPUS_NUMEROLOGIE.textes as Record<string, unknown>)["chemin_de_vie:7"] = ecrit("triché");
    }).toThrow();
  });
});

describe("[T1] les 69 créneaux sont dérivés, jamais recopiés", () => {
  it("chaque nombre déclare ses valeurs possibles", () => {
    for (const n of NOMBRES) {
      const v = valeursPossibles(n);
      expect(v.length, n).toBe(n === "annee_personnelle" ? 9 : 12);
      expect(v.slice(0, 9)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    }
    // L'année personnelle est la seule sans nombre maître — trois créneaux qu'Anima n'écrira jamais
    // pour rien, et un inventaire qui peut atteindre 100 %.
    expect(valeursPossibles("annee_personnelle")).not.toContain(11);
    expect(valeursPossibles("chemin_de_vie")).toContain(33);
  });

  it("le compte se recalcule : 5 × 12 + 9", () => {
    expect(5 * 12 + 9).toBe(CLES_NUMEROLOGIE.length);
    expect(new Set(CLES_NUMEROLOGIE).size, "des clés en double").toBe(69);
  });

  it("`cleNumerologie` refuse une valeur hors domaine", () => {
    expect(cleNumerologie("chemin_de_vie", 11)).toBe("chemin_de_vie:11");
    expect(() => cleNumerologie("chemin_de_vie", 44)).toThrow();
    expect(() => cleNumerologie("chemin_de_vie", 0)).toThrow();
    // Le cas qui compte : 11 est valide partout SAUF pour l'année personnelle.
    expect(() => cleNumerologie("annee_personnelle", 11)).toThrow();
  });
});

describe("[T5] la jonction nombre → texte ne fabrique rien", () => {
  it("un nombre calculé mène à son créneau", () => {
    const t = texteDe("chemin_de_vie", { statut: "calcule", valeur: 7, maitre: false });
    expect(t).toEqual(NON_ECRIT);
  });

  it("un nombre NON calculé n'a pas de créneau — on ne cherche pas le sens de ce qu'on n'a pas", () => {
    // Les deux absences restent distinctes de bout en bout : « je ne sais pas le calculer » n'est
    // pas « je ne l'ai pas encore écrit », et la 5.6 les affichera différemment.
    const t = texteDe("expression", { statut: "non_calcule", raison: "nom_absent" });
    expect(t).toBeNull();
  });

  it("ne rend JAMAIS une chaîne vide en guise de texte manquant", () => {
    for (const n of NOMBRES) {
      for (const v of valeursPossibles(n)) {
        const t = texteDe(n, { statut: "calcule", valeur: v, maitre: false });
        expect(t, `${n}:${v}`).not.toBeNull();
        expect(t!.statut, `${n}:${v}`).toBe("non_ecrit");
        expect("texte" in t!, `${n}:${v} porte un champ texte`).toBe(false);
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// D5 (revue du 2026-08-12) — LA CHAÎNE DE PROTOTYPES N'EST PAS UN CRÉNEAU
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[D5] `lireTexte` jette sur TOUTE clé non déclarée, y compris celles d'Object", () => {
  /**
   * ══ LE DÉFAUT ═══════════════════════════════════════════════════════════════════════════════
   *
   * `lireTexte` testait `c.textes[cle] === undefined`. L'indexation traverse la CHAÎNE DE
   * PROTOTYPES : `"constructor"`, `"toString"`, `"valueOf"`, `"hasOwnProperty"` et `"__proto__"`
   * rendaient donc une valeur non-undefined, la garde ne levait pas, et l'appelant recevait une
   * FONCTION à la place d'un `TexteCorpus`. Il aurait lu `undefined` sur `statut` comme sur
   * `texte` : du vide affiché là où le module promet de crier.
   *
   * « Jette sur une clé non déclarée » est la promesse centrale de ce module — celle qui empêche
   * qu'un créneau fautif passe pour du travail d'écriture en attente. Elle était fausse pour une
   * dizaine de clés.
   *
   * ══ CE QUE ÇA VAUT AUJOURD'HUI ══════════════════════════════════════════════════════════════
   *
   * Aucune de ces clés n'est atteignable : tous les créneaux sont construits par `cleNumerologie`
   * ou par le domaine de l'horoscope. C'est exactement ce qui rend le défaut durable — rien ne le
   * révèle, et il attend le jour où une clé viendra d'ailleurs (un paramètre d'URL, un import).
   */
  const CLES_DU_PROTOTYPE = [
    "constructor",
    "toString",
    "valueOf",
    "hasOwnProperty",
    "isPrototypeOf",
    "propertyIsEnumerable",
    "__proto__",
  ];

  it("[CONTRÔLE DU CONTRÔLE] ces clés rendent bien quelque chose par indexation nue", () => {
    // Sans ce témoin, le test suivant serait vrai d'un JavaScript imaginaire. On prouve d'abord que
    // le piège existe, puis qu'on l'a fermé.
    const nu: Record<string, unknown> = { "chemin_de_vie:7": 1 };
    const traversantes = CLES_DU_PROTOTYPE.filter((k) => nu[k] !== undefined);
    expect(traversantes.length, "le piège de prototype n'existe plus dans ce moteur").toBeGreaterThan(4);
  });

  it("[LE TEST QUI COMPTE] chacune de ces clés fait LEVER `lireTexte`", () => {
    const c = corpus("test-d5", { "chemin_de_vie:7": NON_ECRIT });
    for (const cle of CLES_DU_PROTOTYPE) {
      expect(() => lireTexte(c, cle), `« ${cle} » n'a pas levé`).toThrow(/non déclaré/);
    }
  });

  it("[CONTRÔLE POSITIF] un créneau RÉELLEMENT déclaré se lit toujours", () => {
    // Sans lui, un `throw` inconditionnel passerait le test précédent et rendrait le corpus illisible.
    const c = corpus("test-d5", { "chemin_de_vie:7": NON_ECRIT });
    expect(lireTexte(c, "chemin_de_vie:7").statut).toBe("non_ecrit");
  });

  it("une clé simplement inconnue lève aussi, et le message la cite", () => {
    const c = corpus("test-d5", { "chemin_de_vie:7": NON_ECRIT });
    expect(() => lireTexte(c, "chemin_de_vie:99")).toThrow(/chemin_de_vie:99/);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LES COMMENTAIRES QUI CITENT UNE GARDE DOIVENT CITER UNE GARDE QUI EXISTE
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("aucun commentaire ne renvoie vers un fichier qui n'existe pas", () => {
  /**
   * ══ POURQUOI CETTE GARDE ════════════════════════════════════════════════════════════════════
   *
   * Ce dépôt s'appuie beaucoup sur des commentaires qui NOMMENT la garde d'un invariant :
   * « `tests/tronc-absence.test.ts` garde le vocabulaire ». C'est une bonne pratique — elle rend
   * une propriété vérifiable au lieu de la laisser à la mémoire de quelqu'un.
   *
   * Elle a un mode d'échec propre, et la revue du 2026-08-12 l'a trouvé : `FicheTronc.tsx` renvoyait
   * vers `tests/rendu/tronc-fiche.test.tsx`, qui n'a jamais existé. La garde, elle, existait bien —
   * sous un autre nom. Le lecteur qui suit la référence conclut donc l'inverse de la vérité, dans
   * les deux sens possibles : soit il croit qu'il manque une garde et la réécrit, soit il croit
   * qu'une propriété est gardée alors que le fichier a été supprimé.
   *
   * Le second cas est le dangereux, et il arrive TOUT SEUL : il suffit de renommer un test.
   */
  const RACINE_DEPOT = process.cwd();

  function sourcesDuProduit(): string[] {
    const lister = (d: string) =>
      (readdirSync(resolve(RACINE_DEPOT, d), { recursive: true, encoding: "utf-8" }) as string[])
        .filter((f) => /\.tsx?$/.test(f))
        .map((f) => `${d}/${f}`);
    return [...lister("lib"), ...lister("app"), ...lister("render")];
  }

  it("[NON-VACUITÉ] on balaie bien des sources, et elles citent bien des gardes", () => {
    const sources = sourcesDuProduit();
    expect(sources.length).toBeGreaterThan(100);
    const citantes = sources.filter((f) =>
      /`?tests\/[A-Za-z0-9._/-]+\.tsx?`?/.test(readFileSync(resolve(RACINE_DEPOT, f), "utf-8")),
    );
    expect(citantes.length, "aucun commentaire ne cite de test — la garde serait vide").toBeGreaterThan(10);
  });

  it("chaque `tests/…` cité dans une source EXISTE", () => {
    const morts: string[] = [];
    for (const f of sourcesDuProduit()) {
      const src = readFileSync(resolve(RACINE_DEPOT, f), "utf-8");
      for (const m of src.matchAll(/`?(tests\/[A-Za-z0-9._/-]+\.tsx?)`?/g)) {
        if (!existsSync(resolve(RACINE_DEPOT, m[1]))) morts.push(`${f} → ${m[1]}`);
      }
    }
    expect(morts, `référence(s) morte(s) : ${morts.join(" | ")}`).toEqual([]);
  });

  it("chaque `supabase/migrations/…` cité dans une source EXISTE", () => {
    const morts: string[] = [];
    for (const f of sourcesDuProduit()) {
      const src = readFileSync(resolve(RACINE_DEPOT, f), "utf-8");
      for (const m of src.matchAll(/`(supabase\/migrations\/[A-Za-z0-9._-]+\.sql)`/g)) {
        if (!existsSync(resolve(RACINE_DEPOT, m[1]))) morts.push(`${f} → ${m[1]}`);
      }
    }
    expect(morts, `migration(s) citée(s) et absente(s) : ${morts.join(" | ")}`).toEqual([]);
  });
});
