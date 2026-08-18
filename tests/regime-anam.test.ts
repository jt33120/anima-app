import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  REGIME_ANAM,
  MOTIFS_ANAM,
  motifAutorise,
  regleDe,
  motifPrioritaire,
  heureParis,
  creneauDiurneOuvert,
  CRENEAU_DIURNE_DEBUT,
  CRENEAU_DIURNE_FIN,
} from "@/lib/domain/regime-anam";
import { gabaritPour, gabaritLegalPour } from "@/lib/courriel/gabarits";
import { dateLimiteResiliation } from "@/lib/domain/date-limite";
import { validerOrigine } from "@/lib/courriel/origine";
import { jetonValide } from "@/lib/domain/jeton-desabonnement";
import { chercherInterdits } from "@/lib/domain/lexique-interdit";
import { sansCommentaires } from "./_absence";
import type { MotifCourriel, MotifLegal } from "@/lib/courriel/port";

/** Les motifs LÉGAUX, ensemble fermé et volontairement séparé de `MotifCourriel` (Story 3.5). */
const MOTIFS_LEGAUX: readonly MotifLegal[] = ["reconduction_a_venir"];
/**
 * Depuis la revue 1-4 (#14), une information légale est une union DISCRIMINÉE : le motif
 * `reconduction_a_venir` ne peut plus exister sans sa date limite (art. L215-1). Ce helper la pose,
 * pour que ce fichier continue de ne parler que de ce qu'il mesure — les OBJETS.
 */
const infoLegale = (m: MotifLegal) =>
  m === "reconduction_a_venir"
    ? ({ motif: m, dateLimite: dateLimiteResiliation("2027-03-05T12:00:00Z")! } as const)
    : ({ motif: m } as const);

/**
 * Story 6.3 (T4, AC1 / AC2) — LE RÉGIME DE PAROLE D'ANAM, en pur domaine.
 *
 * Ce fichier ne prouve QUE ce qui se calcule sans base et sans réseau : l'ensemble fermé, l'arbitrage,
 * et le créneau diurne. Les MIROIRS (l'ensemble contre `MotifCourriel`, contre le CHECK SQL, contre
 * `famille_motif`) sont des gardes de dépôt et vivent en T6, plus bas dans ce même fichier.
 */

describe("[AC1] l'ensemble des motifs est FERMÉ", () => {
  it("il y en a exactement trois, et ce sont ceux-là", () => {
    // Mutation-cible : ajouter un quatrième motif « parce qu'il faudrait bien annoncer X ». FR-034 est
    // une condition d'émission, pas un mandat d'émettre davantage — l'ensemble est un PLAFOND.
    expect([...MOTIFS_ANAM].sort()).toEqual(["echeance_intention", "proposition_branche", "synthese_prete"]);
  });

  it("le refus est le DÉFAUT : tout ce qui n'est pas dans l'ensemble est refusé", () => {
    // Mutation-cible : `motifAutorise` qui rend `true` par défaut, ou qui n'est plus appelé du tout.
    expect(motifAutorise("synthese_prete")).toBe(true);
    expect(motifAutorise("reengagement")).toBe(false);
    expect(motifAutorise("")).toBe(false);
    expect(motifAutorise("SYNTHESE_PRETE"), "la casse n'ouvre pas de porte dérobée").toBe(false);
    expect(motifAutorise("synthese_prete "), "ni un espace").toBe(false);
  });

  it("`regleDe` rend `null` sur un motif inconnu — jamais une règle inventée", () => {
    // Mutation-cible : `?? REGIME_ANAM[0]`, qui donnerait un canal COURRIEL à n'importe quelle chaîne.
    expect(regleDe("inconnu")).toBeNull();
    expect(regleDe("synthese_prete")).toEqual({ motif: "synthese_prete", canal: "courriel", rang: 2 });
  });

  it("[D1] `proposition_branche` est le SEUL motif sans canal sortant, et c'est déclaré", () => {
    // Mutation-cible : lui donner `canal: "courriel"`. Ce serait un quatrième courriel possible, un
    // motif de plus classé `anam`, donc le plafond de 72 h mangé et la synthèse du lendemain muette.
    const inApp = REGIME_ANAM.filter((r) => r.canal === "in-app").map((r) => r.motif);
    expect(inApp).toEqual(["proposition_branche"]);
  });

  it("le régime est GELÉ : on n'y ajoute pas un motif à l'exécution", () => {
    expect(Object.isFrozen(REGIME_ANAM)).toBe(true);
    expect(REGIME_ANAM.every((r) => Object.isFrozen(r))).toBe(true);
    expect(() => (REGIME_ANAM as unknown as { push: (x: unknown) => void }).push({})).toThrow();
  });
});

describe("[AC1] l'arbitrage quand plusieurs motifs coexistent", () => {
  it("les rangs sont TOUS DISTINCTS", () => {
    // Ce test n'a l'air de rien et il porte le suivant. Deux motifs de même rang rendraient l'ordre de
    // `reduce` inobservable : le mutant `a.rang <= b.rang` → `>=` survivrait sur ce couple-là, et la
    // garde de direction ci-dessous ne prouverait plus rien.
    expect(new Set(REGIME_ANAM.map((r) => r.rang)).size).toBe(REGIME_ANAM.length);
  });

  it("[LE CŒUR] l'arbitrage suit le RANG, et PAS l'ordre du tableau", () => {
    // Mutation-cible : `reduce` inversé, ou un `presents.find` qui suivrait l'ordre de déclaration.
    // On donne les motifs dans l'ordre INVERSE du tableau et on attend quand même le plus petit rang :
    // le jour où quelqu'un remet `REGIME_ANAM` par ordre alphabétique, ce test tient toujours.
    const attendu = [...REGIME_ANAM].sort((a, b) => a.rang - b.rang)[0].motif;
    expect(motifPrioritaire([...REGIME_ANAM].reverse().map((r) => r.motif))).toBe(attendu);
  });

  it("ce qui ne revient pas de soi-même passe devant", () => {
    // La doctrine, en clair : une échéance s'éteint seule à minuit ; une synthèse est rattrapée trois
    // jours ; une proposition attend indéfiniment.
    expect(motifPrioritaire(["synthese_prete", "echeance_intention"])).toBe("echeance_intention");
    expect(motifPrioritaire(["proposition_branche", "synthese_prete"])).toBe("synthese_prete");
  });

  it("aucun motif présent → `null` ; un motif inconnu ne devient jamais le gagnant", () => {
    expect(motifPrioritaire([])).toBeNull();
    expect(motifPrioritaire(["reengagement"])).toBeNull();
    expect(motifPrioritaire(["reengagement", "proposition_branche"])).toBe("proposition_branche");
  });
});

describe("[AC2] le créneau diurne de Paris", () => {
  /** L'instant UTC dont l'heure de Paris est `h`, au jour donné. */
  const aParis = (jour: string, h: number, decalage: number) =>
    new Date(`${jour}T${String(h - decalage).padStart(2, "0")}:00:00Z`);

  it("[LE CŒUR] les deux bornes, pile", () => {
    // Mutation-cible : `>=` → `>`, `<` → `<=`, et les deux constantes elles-mêmes. Une borne mal
    // orientée ne se voit nulle part ailleurs : le job continuerait de tourner, simplement une heure
    // trop tôt ou une heure trop tard, et personne ne le saurait avant de recevoir un courriel à 21 h.
    expect(creneauDiurneOuvert(aParis("2026-08-05", 5, 2)), "05 h — fermé").toBe(false);
    expect(creneauDiurneOuvert(aParis("2026-08-05", 6, 2)), "06 h pile — OUVERT (inclusif)").toBe(true);
    expect(creneauDiurneOuvert(aParis("2026-08-05", 20, 2)), "20 h — ouvert").toBe(true);
    expect(creneauDiurneOuvert(aParis("2026-08-05", 21, 2)), "21 h pile — FERMÉ (exclusif)").toBe(false);
    expect(creneauDiurneOuvert(aParis("2026-08-05", 23, 2)), "23 h — fermé").toBe(false);
  });

  it("les bornes sont posées LOIN de l'heure de tir du cron", () => {
    // Le cron est `0 6 * * *` — 07 h en CET, 08 h en CEST. Le palier `hobby` autorise une dérive
    // pouvant atteindre l'heure pleine. Une borne posée à 7 ou à 8 ferait dépendre l'émission de cette
    // dérive : le même code émettrait ou non selon le jour, et le test qui l'affirme serait vert par
    // chance. C'est la leçon exacte de la 6.2.
    expect(CRENEAU_DIURNE_FIN - CRENEAU_DIURNE_DEBUT).toBeGreaterThanOrEqual(12);
    expect(CRENEAU_DIURNE_DEBUT, "au moins deux heures avant le tir CET le plus précoce").toBeLessThan(7);
  });

  it("[LE CŒUR] c'est l'heure de PARIS, changement d'heure compris", () => {
    // Mutation-cible : lire `instant.getUTCHours()`, ou appliquer un décalage fixe de +1 ou +2.
    // MÊME heure UTC, MÊME minute, deux verdicts opposés — parce qu'entre janvier et juillet, Paris a
    // changé d'heure. Aucun décalage constant ne peut satisfaire ces deux lignes à la fois.
    expect(creneauDiurneOuvert(new Date("2026-01-15T19:30:00Z")), "20 h 30 à Paris en CET").toBe(true);
    expect(creneauDiurneOuvert(new Date("2026-07-15T19:30:00Z")), "21 h 30 à Paris en CEST").toBe(false);

    expect(heureParis(new Date("2026-01-15T19:30:00Z"))).toBe(20);
    expect(heureParis(new Date("2026-07-15T19:30:00Z"))).toBe(21);
  });

  it("[LE CŒUR] les vingt-quatre heures se lisent 0…23, dans l'ordre, sans trou", () => {
    // Mutation-cible : `hourCycle` autre que `h23`. Les trois autres cycles sont des PANNES
    // SILENCIEUSES, et l'une d'elles émet :
    //   • `h24` rend « 24 » à minuit → `24 >= 6` → la nuit devient diurne ;
    //   • `h11` / `h12` rendent « 10 » à 22 h → un courriel à 22 h, exactement ce qu'on interdit.
    // Une journée entière balayée d'un coup les attrape tous les trois, et elle prouve au passage que
    // rien ne rend `NaN` (un `NaN` serait fail-closed — sûr, mais définitivement muet).
    const debutDeJournee = Date.parse("2026-07-14T22:00:00Z"); // minuit à Paris, en CEST
    const heures = Array.from({ length: 24 }, (_, i) => heureParis(new Date(debutDeJournee + i * 3_600_000)));
    expect(heures).toEqual([...Array(24).keys()]);
  });

  it("minuit rend 0, et non 24", () => {
    expect(heureParis(new Date("2026-07-15T22:00:00Z")), "00 h 00 à Paris").toBe(0);
    expect(creneauDiurneOuvert(new Date("2026-07-15T22:00:00Z"))).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// T6 — LES MIROIRS. « L'ensemble est déclaré en UN SEUL ENDROIT dont les trois vérités existantes
// sont prouvées être le miroir » (AC1).
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ CES GARDES LISENT LA SOURCE, ET C'EST LE SEUL MOYEN.
 *
 * Les trois vérités qu'on met en miroir ne sont pas importables : deux vivent en SQL, la troisième
 * est un type TypeScript (donc effacé à l'exécution — `MotifCourriel` n'existe pas au runtime). Un
 * test qui les recopierait en constantes ne prouverait que sa propre recopie.
 *
 * ⚠️ ET ON PREND LA DERNIÈRE DÉFINITION, JAMAIS LA PREMIÈRE. `famille_motif` et le CHECK ont été
 * REDÉFINIS par 0053 ; lire 0036 dirait « deux motifs » et le miroir serait vert sur un état de la
 * base vieux de deux stories. C'est la leçon exacte de `reserver_notification`, réécrite en 4.10
 * depuis la version de 0030 — ce qui a silencieusement rouvert le trou de désabonnement de 0034.
 */

const racine = process.cwd();
const lireSource = (f: string) => readFileSync(resolve(racine, f), "utf-8");

/** Les commentaires SQL (`--`) retirés — un avertissement qui NOMME un motif n'est pas une clause. */
function sansCommentairesSql(src: string): string {
  return src.replace(/--.*$/gm, " ");
}

/**
 * …et les CHAÎNES retirées en plus, pour les gardes d'ABSENCE.
 *
 * ⚠️ Née d'un rouge légitime : `comment on function motifs_anam_du() is '… reserver_notification …'`
 * NOMME les trois choses que 0054 s'interdit de toucher, dans son propre commentaire de fonction — et
 * un `comment on` est une CHAÎNE, pas un `--`. C'est le mode d'échec exact de la 6.2 (`sansCommentaires`,
 * né d'un rouge sur `addEventListener("fetch"` trouvé dans son propre en-tête), rejoué en SQL.
 *
 * Les extracteurs ci-dessus n'en veulent PAS : ils lisent justement des littéraux (`'synthese_prete'`).
 */
function sansCommentairesNiChaines(src: string): string {
  return sansCommentairesSql(src).replace(/'(?:[^']|'')*'/g, " ");
}

/** Les migrations, dans l'ordre de leur numéro : la dernière définition gagne. */
function migrations(): string[] {
  return readdirSync(resolve(racine, "supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

/** Le corps de la DERNIÈRE occurrence d'un motif d'extraction, à travers toutes les migrations. */
function derniereEnSql(motif: RegExp): string {
  let trouve = "";
  for (const f of migrations()) {
    const src = sansCommentairesSql(lireSource(`supabase/migrations/${f}`));
    for (const m of src.matchAll(new RegExp(motif.source, `${motif.flags.replace("g", "")}g`))) {
      trouve = m[1] ?? m[0];
    }
  }
  return trouve;
}

/** Les littéraux de `MotifCourriel`, lus dans le type lui-même. */
function motifsCourriel(): string[] {
  const src = lireSource("lib/courriel/port.ts");
  const m = /export type MotifCourriel\s*=\s*([^;]+);/.exec(src);
  return m ? [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]).sort() : [];
}

/** Les valeurs admises par le CHECK `notification_envoyee_motif_check`, dernière définition. */
function motifsDuCheck(): string[] {
  const corps = derniereEnSql(/notification_envoyee_motif_check\s*\n?\s*check\s*\(motif in \(([^)]*)\)\)/i);
  return [...corps.matchAll(/'([^']+)'/g)].map((x) => x[1]).sort();
}

/** Le classement de `famille_motif`, dernière définition : motif → famille. */
function familleMotif(): Map<string, string> {
  const corps = derniereEnSql(/function public\.famille_motif\(p_motif text\)([\s\S]*?)\$\$;/i);
  return new Map([...corps.matchAll(/when\s+'([^']+)'\s*then\s*'([^']+)'/g)].map((m) => [m[1], m[2]]));
}

/** Les motifs que `motifs_anam_du()` rend — lus dans la migration 0054. */
function motifsRendusInApp(): string[] {
  const src = sansCommentairesSql(lireSource("supabase/migrations/0054_motifs_anam_in_app.sql"));
  return [...src.matchAll(/select\s+'([a-z_]+)'::text/g)].map((m) => m[1]).sort();
}

const COURRIEL = MOTIFS_ANAM.filter((m) => regleDe(m)!.canal === "courriel").slice().sort();
const IN_APP = MOTIFS_ANAM.filter((m) => regleDe(m)!.canal === "in-app").slice().sort();

describe("[AC1] les extracteurs voient quelque chose — sans ce témoin, tous les miroirs sont vrais sur du vide", () => {
  it("les quatre sources sont lues et non vides", () => {
    // Le mode d'échec exact d'une garde dont l'extracteur casse : trois `[]` qui coïncident.
    expect(motifsCourriel().length, "MotifCourriel").toBeGreaterThan(0);
    expect(motifsDuCheck().length, "le CHECK SQL").toBeGreaterThan(0);
    expect(familleMotif().size, "famille_motif").toBeGreaterThan(0);
    expect(motifsRendusInApp().length, "motifs_anam_du").toBeGreaterThan(0);
  });

  it("les extracteurs prennent la DERNIÈRE définition, pas la première", () => {
    // 0036 déclare deux motifs au CHECK et deux branches à `famille_motif` ; 0053 en ajoute un
    // troisième. Un extracteur qui s'arrêterait à la première occurrence rendrait deux, et le miroir
    // serait vert sur un état de la base vieux de deux stories.
    expect(motifsDuCheck(), "0053 a ajouté `socle_quotidien` au CHECK").toContain("socle_quotidien");
    expect(familleMotif().get("socle_quotidien"), "0053 l'a classé `socle`").toBe("socle");
  });
});

describe("[AC1] l'ensemble fermé est le MIROIR des trois vérités existantes, DANS LES DEUX SENS", () => {
  it("`MotifCourriel` ⟺ les motifs du régime à canal courriel", () => {
    // ⚠️ LES DEUX SENS, et le second est celui qui compte : un motif de courriel ajouté sans être
    // déclaré au régime échapperait à tout ce que cette story pose — créneau du soir compris.
    expect(motifsCourriel()).toEqual(COURRIEL);
  });

  it("`famille_motif` classe `anam` EXACTEMENT les motifs du régime à canal courriel", () => {
    // Le sens qui compte : un motif classé `anam` en SQL sans entrée au régime mangerait le plafond
    // de 72 h — donc ferait taire la synthèse du lendemain — sans que rien ne le déclare.
    const anam = [...familleMotif().entries()].filter(([, f]) => f === "anam").map(([m]) => m).sort();
    expect(anam).toEqual(COURRIEL);
  });

  it("le CHECK SQL contient tous les motifs à canal courriel, et rien du régime en plus", () => {
    for (const m of COURRIEL) expect(motifsDuCheck(), `« ${m} » doit être admis au CHECK`).toContain(m);
    // Ce que le CHECK a en plus est `socle_quotidien` — classé `socle`, jamais `anam`, jamais du
    // régime d'Anam. C'est FR-033, et c'est écrit ici pour que ça ne dérive pas.
    const enPlus = motifsDuCheck().filter((m) => !(COURRIEL as readonly string[]).includes(m));
    expect(enPlus).toEqual(["socle_quotidien"]);
    expect(familleMotif().get("socle_quotidien")).toBe("socle");
  });

  it("[D1, LE CŒUR] le motif IN-APP n'existe dans AUCUNE des trois vérités sortantes", () => {
    // C'est l'affirmation vérifiable de la story : « elle n'émet rien de nouveau ». Le jour où
    // quelqu'un donnera un canal à `proposition_branche`, ces trois lignes rougiront ensemble.
    for (const m of IN_APP) {
      expect(motifsCourriel(), `« ${m} » ne doit pas être un motif de courriel`).not.toContain(m);
      expect(motifsDuCheck(), `« ${m} » ne doit pas être admis au CHECK`).not.toContain(m);
      expect([...familleMotif().keys()], `« ${m} » ne doit pas être classé`).not.toContain(m);
    }
    expect(IN_APP.length, "sinon le test ci-dessus est vrai sur un ensemble vide").toBeGreaterThan(0);
  });
});

describe("[AC8] ce qui est ANNONCÉ est là à l'ARRIVÉE — même source des deux côtés", () => {
  it("[LE CŒUR] `motifs_anam_du()` rend EXACTEMENT l'ensemble du régime", () => {
    // ⚠️ C'EST LA GARDE DE LA STORY ENTIÈRE. Le trou qu'elle répare : un courriel disait « ta
    // synthèse est prête » et l'application ne le disait nulle part. Les deux dérivent maintenant du
    // même ensemble — et cette égalité le PROUVE au lieu de l'espérer.
    //
    // Le sens « tout motif du régime est rendu » interdit qu'une annonce parte sans écran ;
    // le sens « tout motif rendu est du régime » interdit qu'un écran affiche un motif clandestin.
    expect(motifsRendusInApp()).toEqual(MOTIFS_ANAM.slice().sort());
  });

  it("la migration 0054 n'ajoute AUCUN motif sortant (AC9)", () => {
    // Mutation-cible : glisser un `alter table … motif_check` ou une branche à `famille_motif` dans
    // 0054. Le CHECK et `famille_motif` doivent rester définis par 0053, `reserver_notification` par
    // 0036 — la story ne rouvre aucun de ces fichiers.
    const src = sansCommentairesNiChaines(lireSource("supabase/migrations/0054_motifs_anam_in_app.sql"));
    for (const interdit of ["notification_envoyee_motif_check", "famille_motif", "reserver_notification"]) {
      expect(src, `0054 touche à ${interdit}`).not.toContain(interdit);
    }
  });

});

describe("[AC3] l'aperçu ne porte JAMAIS la spécificité — et c'est prouvé, pas espéré", () => {
  const origine = validerOrigine("https://anima.exemple.fr")!;
  const jeton = jetonValide("11111111-1111-4111-8111-111111111111")!;

  /** Tous les objets qui peuvent paraître sur un écran verrouillé, les deux régimes confondus. */
  function objets(): { motif: string; objet: string }[] {
    const courriels = motifsCourriel().map((m) => ({
      motif: m,
      objet: gabaritPour(m as MotifCourriel, { origine, jeton })!.objet,
    }));
    const legaux = MOTIFS_LEGAUX.map((m) => ({ motif: m, objet: gabaritLegalPour(infoLegale(m), origine)!.objet }));
    return [...courriels, ...legaux];
  }

  /**
   * Les racines qui trahiraient l'intimité du contenu ou un registre ésotérique (NFR-015).
   *
   * ⚠️ « synthèse » et « échéance » N'Y SONT PAS, et c'est délibéré : ce sont des mots d'agenda
   * ordinaire, ils ne disent rien de ce qu'elle vit. Ce qu'on refuse, c'est ce qui la désigne, ELLE,
   * devant quelqu'un d'autre.
   */
  const LEXIQUE_APERCU = [
    "carte", "tirage", "tarot", "astro", "horoscope", "thème", "lune", "signe", "ascendant",
    "ennéagramme", "numérologie", "branche", "intention", "détresse", "journal", "séance",
    "rituel", "ancrage", "arbre", "mantra", "spirituel", "âme", "guidance",
  ];

  it("[CONTRÔLE DU CONTRÔLE] il y a bien des objets à examiner", () => {
    expect(objets().length, "sinon les trois refus ci-dessous sont vrais sur du vide").toBeGreaterThan(2);
  });

  for (const { motif, objet } of [
    ...["synthese_prete", "echeance_intention"].map((m) => ({
      motif: m,
      objet: gabaritPour(m as MotifCourriel, {
        origine: validerOrigine("https://anima.exemple.fr")!,
        jeton: jetonValide("11111111-1111-4111-8111-111111111111")!,
      })!.objet,
    })),
    ...MOTIFS_LEGAUX.map((m) => ({
      motif: m,
      objet: gabaritLegalPour(infoLegale(m), validerOrigine("https://anima.exemple.fr")!)!.objet,
    })),
  ]) {
    it(`« ${objet} » (${motif}) : ≤ 6 mots, aucune racine intime, aucun chiffre`, () => {
      // Un objet long est un objet qui RACONTE. Six mots, c'est ce qui tient dans l'aperçu d'un
      // écran verrouillé sans être tronqué — donc sans qu'on doive deviner la suite.
      expect(objet.trim().split(/\s+/).length, `« ${objet} »`).toBeLessThanOrEqual(6);
      for (const racine of LEXIQUE_APERCU) {
        expect(objet.toLowerCase(), `« ${racine} » dans « ${objet} »`).not.toContain(racine);
      }
      expect(objet, "un chiffre dans un objet, c'est un compte qui s'affiche seul").not.toMatch(/\d/);
      expect(chercherInterdits(objet), `lexique interdit dans « ${objet} »`).toEqual([]);
    });
  }

  it("[LE CŒUR] aucun objet n'est INTERPOLÉ — la source ne contient aucun `${` dans un objet", () => {
    // ⚠️ C'est la garde qui compte, et elle ne peut pas se faire à l'exécution : un gabarit interpolé
    // rendrait le bon texte sur les doublures de test et le prénom de quelqu'un en production. Un
    // objet est une CONSTANTE — sinon il finira par porter « Ta synthèse, Camille ».
    const src = sansCommentaires(readFileSync(resolve(racine, "lib/courriel/gabarits.ts"), "utf-8"));
    // ⚠️ `^\s*objet:` et non `objet:` : la DÉCLARATION `readonly objet: string;` de l'interface
    // `Gabarit` matchait, et « string; » ne commence pas par un guillemet — la garde rougissait sur
    // le type qu'elle est censée protéger. Le préfixe `readonly` la distingue de l'affectation.
    const lignesObjet = src
      .split("\n")
      .filter((l) => /^\s*objet:/.test(l))
      .map((l) => l.replace(/^\s*objet:\s*/, ""));
    expect(lignesObjet.length, "aucun objet trouvé : l'extracteur a cassé").toBeGreaterThan(2);
    for (const l of lignesObjet) {
      expect(l, `objet interpolé : ${l}`).not.toContain("${");
      expect(l.trim().startsWith('"'), `objet non littéral : ${l}`).toBe(true);
    }
  });
});

describe("[AC4 / AC5] aucune relance de réengagement, et la garde balaie la source DÉCOMMENTÉE", () => {
  /**
   * ⚠️ POURQUOI `sansCommentaires`, ET C'EST TOUT LE POINT DE CETTE GARDE (décision D7).
   *
   * Le mot « reviens » est DÉJÀ PRÉSENT dans ce dépôt — en commentaire, dans les fichiers qui
   * expliquent pourquoi il est interdit, et dans ce test-ci. Une garde qui lirait la source brute
   * rougirait sur son propre avertissement, et la réaction serait de retirer le motif : on perdrait
   * la garde entière pour un faux positif. C'est le mode d'échec exact payé en 6.2.
   */
  const RELANCE = ["derniere_connexion", "last_sign_in", "inactif", "inactive", "reengagement", "tu nous manques", "reviens"];

  /** Le chemin de notification, du choix du destinataire au texte envoyé. */
  const CHEMIN = [
    "lib/ordonnanceur/jobs/synthese.ts",
    "lib/ordonnanceur/jobs/rappel-echeance.ts",
    "lib/ordonnanceur/jobs/socle-quotidien.ts",
    "lib/courriel/gabarits.ts",
    "lib/courriel/port.ts",
    "lib/data/depot-canal-courriel.ts",
    "lib/data/depot-motifs-anam.ts",
    "lib/domain/regime-anam.ts",
    "lib/domain/carte-anam.ts",
  ].filter((f) => existsSync(resolve(racine, f)));

  it("[CONTRÔLE DU CONTRÔLE] le chemin est réellement balayé, et l'extracteur attrape le connu-mauvais", () => {
    // Sans ces deux lignes, une liste vide ou un `sansCommentaires` trop gourmand rendrait tous les
    // refus ci-dessous vrais sur du vide.
    expect(CHEMIN.length, "des fichiers du chemin ont disparu — relire la liste").toBeGreaterThanOrEqual(8);
    const faux = sansCommentaires('const requete = "select * from x where derniere_connexion < now()";');
    expect(RELANCE.some((r) => faux.toLowerCase().includes(r)), "l'extracteur ne voit plus rien").toBe(true);
  });

  it("[CONTRÔLE DU CONTRÔLE] un avertissement EN COMMENTAIRE ne déclenche pas la garde", () => {
    // La moitié qui justifie `sansCommentaires` : ce dépôt écrit « reviens » pour dire de ne pas
    // l'écrire. Un commentaire n'atteint jamais personne.
    const commente = sansCommentaires('// jamais « reviens » ni « tu nous manques »\nconst x = 1;');
    expect(RELANCE.some((r) => commente.toLowerCase().includes(r))).toBe(false);
  });

  for (const f of [
    "lib/ordonnanceur/jobs/synthese.ts",
    "lib/ordonnanceur/jobs/rappel-echeance.ts",
    "lib/courriel/gabarits.ts",
    "lib/data/depot-motifs-anam.ts",
    "lib/domain/carte-anam.ts",
  ]) {
    it(`${f} ne sélectionne ni ne parle sur l'inactivité`, () => {
      const src = sansCommentaires(readFileSync(resolve(racine, f), "utf-8")).toLowerCase();
      for (const mot of RELANCE) {
        expect(src, `« ${mot} » dans ${f} — AC5 refuse toute relance de réengagement`).not.toContain(mot);
      }
    });
  }

  it("la SÉLECTION en base ne regarde aucune date de dernière ouverture", () => {
    // Le vrai lieu de la faute : une clause `where derniere_connexion < now() - 7 days` dans la RPC
    // qui choisit à qui écrire. Le TypeScript ne sélectionne rien — les migrations, si.
    for (const f of ["0036_intention_arbitrage.sql", "0053_socle_quotidien_poussee.sql", "0054_motifs_anam_in_app.sql"]) {
      const src = sansCommentairesNiChaines(lireSource(`supabase/migrations/${f}`)).toLowerCase();
      for (const mot of RELANCE) {
        expect(src, `« ${mot} » dans ${f}`).not.toContain(mot);
      }
    }
  });
});

describe("[AC2] le cron déclaré tombe DANS le créneau, changement d'heure compris", () => {
  const cron = JSON.parse(readFileSync(resolve(racine, "vercel.json"), "utf-8")) as {
    crons: { path: string; schedule: string }[];
  };

  it("[CONTRÔLE DU CONTRÔLE] le cron est lu, et il est quotidien", () => {
    // Un extracteur qui rendrait `NaN` ferait passer le balayage ci-dessous sans rien vérifier.
    expect(cron.crons).toHaveLength(1);
    const [minute, heure, ...reste] = cron.crons[0].schedule.split(" ");
    expect(reste, "le balayage ci-dessous suppose un tir QUOTIDIEN").toEqual(["*", "*", "*"]);
    expect(Number.isInteger(Number(minute))).toBe(true);
    expect(Number.isInteger(Number(heure))).toBe(true);
  });

  /** Deux fenêtres de 70 jours, chacune à cheval sur un changement d'heure européen. */
  for (const [nom, depart] of [
    ["l'automne (CEST → CET, 25 octobre 2026)", "2026-09-15"],
    ["le printemps (CET → CEST, 29 mars 2026)", "2026-02-15"],
  ] as const) {
    it(`70 jours autour de ${nom} : chaque tir est dans le créneau`, () => {
      // ⚠️ ET LA DÉRIVE DU PALIER `hobby` EST DANS LE BALAYAGE. Vercel ne garantit pas la minute :
      // le tir peut glisser jusqu'à l'heure pleine suivante. On vérifie donc l'heure programmée ET
      // la minute 59 de la même heure — si l'une des deux sortait du créneau, le même code émettrait
      // ou non selon le jour, et un test posé sur la minute 0 serait vert par chance.
      const [minute, heure] = cron.crons[0].schedule.split(" ").map(Number);
      const t0 = Date.parse(`${depart}T00:00:00Z`);
      const dehors: string[] = [];
      for (let j = 0; j < 70; j++) {
        for (const m of [minute, 59]) {
          const tir = new Date(t0 + j * 86_400_000);
          tir.setUTCHours(heure, m, 0, 0);
          if (!creneauDiurneOuvert(tir)) dehors.push(`${tir.toISOString()} → ${heureParis(tir)} h à Paris`);
        }
      }
      expect(dehors, `tirs hors créneau : ${dehors.slice(0, 3).join(" | ")}`).toEqual([]);
    });
  }

  it("[LE TEST QUI COMPTE] le balayage SAIT rougir — un cron du soir est refusé", () => {
    // Sans ce contrôle, un `creneauDiurneOuvert` qui rendrait toujours `true` passerait les deux
    // balayages ci-dessus et la garde ne protégerait rien.
    const soir = new Date("2026-09-15T00:00:00Z");
    soir.setUTCHours(21, 0, 0, 0); // 23 h à Paris en CEST
    expect(creneauDiurneOuvert(soir)).toBe(false);
  });
});
