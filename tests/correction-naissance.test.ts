import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ascendantDe,
  comparerThemes,
  normaliserHeure,
} from "@/lib/domain/correction-naissance";
import * as copie from "@/lib/domain/copie-naissance";
import { calculerThemeNatal } from "@/lib/astro/theme-natal";
import type { EphemerisPort, LectureCorps } from "@/lib/astro/port";

/**
 * Story 6.5b — LE DOMAINE DE LA CORRECTION (pur, aucune I/O).
 *
 * Ce fichier n'éprouve AUCUNE garde : ce qui autorise ou refuse une correction vit dans le trigger
 * `naissance_corrigible` (0060), et `correction-naissance-sql.test.ts` s'en charge. Ici on éprouve
 * ce que la base ne peut pas dire : qu'une saisie est refusée plutôt que devinée, et que l'aperçu
 * — la seule chose qui remplace le plafond qu'on n'a pas mis — dit la vérité dans les DEUX sens.
 */

// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[6.5b] `normaliserHeure` — on refuse, on ne devine pas", () => {
  it("[CONTRÔLE POSITIF] `HH:MM` et `HH:MM:SS` passent, normalisées en `HH:MM:SS`", () => {
    expect(normaliserHeure("04:30", "14:30:00")).toEqual({ ok: true, heure: "04:30:00" });
    expect(normaliserHeure("04:30:15", "14:30:00")).toEqual({ ok: true, heure: "04:30:15" });
    expect(normaliserHeure("  04:30  ", null)).toEqual({ ok: true, heure: "04:30:00" });
  });

  it("[LE CŒUR] une saisie approximative est REFUSÉE, jamais réparée", () => {
    // Une heure mal lue ne produit pas une erreur visible : elle produit un ascendant faux qui a
    // l'air juste. « Réparer » `7h15` en `07:15` serait deviner ce qu'elle a voulu dire sur la
    // donnée dont dérive tout le socle — et cette story est justement le recours de quelqu'un qui
    // s'est déjà trompé une fois.
    // ⚠️ « 04 » est dans la liste depuis un SURVIVANT (M16) : un motif un peu plus permissif
    // acceptait une heure sans minutes. `<input type="time">` n'en produit pas — mais l'action
    // serveur revalide une chaîne POSTÉE, et c'est là que le laxisme se paie.
    for (const brut of ["7h15", "7:5", "19h", "0430", "", "midi", "04:30:15:99", "04", "04:"]) {
      expect(normaliserHeure(brut, null), `« ${brut} » a été accepté`).toEqual({
        ok: false,
        refus: "format",
      });
    }
  });

  it("une heure qui n'existe pas est refusée par un motif DISTINCT du format", () => {
    // Deux motifs, deux messages : « entre une heure au format 07:15 » n'a aucun sens face à
    // « 25:00 », qui est au bon format. Un seul motif ferait dire au produit une bêtise.
    expect(normaliserHeure("25:00", null)).toEqual({ ok: false, refus: "inexistante" });
    expect(normaliserHeure("12:60", null)).toEqual({ ok: false, refus: "inexistante" });
    expect(normaliserHeure("12:30:60", null)).toEqual({ ok: false, refus: "inexistante" });
  });

  it("[LE CŒUR] réécrire la MÊME heure est refusé avant la base", () => {
    // Le trigger la laisserait passer sans la compter (ce n'est pas une correction) et l'écran
    // annoncerait un succès qui n'a rien fait.
    expect(normaliserHeure("14:30", "14:30:00")).toEqual({ ok: false, refus: "inchangee" });
    expect(normaliserHeure("14:30:00", "14:30:00")).toEqual({ ok: false, refus: "inchangee" });
    // …mais sans heure gravée, « inchangée » n'a pas de sens : c'est un ajout.
    expect(normaliserHeure("14:30", null)).toEqual({ ok: true, heure: "14:30:00" });
  });

  it("les trois motifs ont chacun un message, et ils diffèrent", () => {
    const messages = (["format", "inexistante", "inchangee"] as const).map(copie.messageDeRefus);
    expect(new Set(messages).size).toBe(3);
    for (const m of messages) expect(m.length).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// L'APERÇU — il doit savoir annoncer une PERTE, sinon il ment quand ça compte
// ══════════════════════════════════════════════════════════════════════════════════════════════

/** Un port d'éphéméride qui rend ce qu'on lui dit : on fabrique des thèmes, pas de l'astronomie. */
function portFige(longitude: number, tsg: number): EphemerisPort {
  return {
    identifiant: "double-6-5b@1",
    longitudeEcliptique: (): LectureCorps => ({ statut: "calcule", longitude }),
    tempsSideralGreenwich: () => tsg,
    obliquiteVraie: () => 23.44,
  };
}

/**
 * Un port dont les corps BOUGENT vite (15°/h) : sur une fenêtre de 24 h ils traversent forcément
 * une cuspide, donc leur signe devient ambigu sans heure et `calculerThemeNatal` les déclare
 * absents. C'est ce qui rend `corpsRegagnes` mesurable — un port à longitude constante ne rend
 * jamais aucun corps ambigu, et la première version de ce test mesurait donc zéro contre zéro.
 */
function portMouvant(): EphemerisPort {
  return {
    identifiant: "double-6-5b-mouvant@1",
    longitudeEcliptique: (_c, t): LectureCorps => ({
      statut: "calcule",
      longitude: ((t.getTime() / 3_600_000) * 15) % 360,
    }),
    tempsSideralGreenwich: () => 6,
    obliquiteVraie: () => 23.44,
  };
}

const AVEC_HEURE = { date: "1990-06-15", heure: "14:30:00", latitude: 44.84, longitude: -0.58, fuseau: "Europe/Paris" };
const SANS_HEURE = { date: "1990-06-15", heure: null, latitude: 44.84, longitude: -0.58, fuseau: "Europe/Paris" };

describe("[6.5b] `comparerThemes` — la comparaison dit les gains ET les pertes", () => {
  it("[CONTRÔLE POSITIF] deux thèmes identiques : rien de visible ne change", () => {
    const t = calculerThemeNatal(AVEC_HEURE, portFige(12.5, 6));
    const c = comparerThemes(t, t);
    expect(c.sansChangementVisible).toBe(true);
    expect(c.corpsRegagnes).toBe(0);
    expect(c.ascendantAvant).toBe(c.ascendantApres);
  });

  it("[LE CŒUR] un ascendant qui change de signe est vu", () => {
    const a = calculerThemeNatal(AVEC_HEURE, portFige(12.5, 6));
    const b = calculerThemeNatal(AVEC_HEURE, portFige(12.5, 18));
    const c = comparerThemes(a, b);
    expect(c.ascendantAvant).not.toBe(c.ascendantApres);
    expect(c.sansChangementVisible).toBe(false);
  });

  it("[LE CŒUR] passer de « midi par défaut » à une heure connue est un GAIN, et il est chiffré", () => {
    const port = portMouvant();
    const avant = calculerThemeNatal(SANS_HEURE, port);
    const apres = calculerThemeNatal(AVEC_HEURE, port);
    const c = comparerThemes(avant, apres);
    expect(c.precisionAvant).toBe("midi_par_defaut");
    expect(c.precisionApres).toBe("heure_connue");
    expect(avant.absents.length, "le port doublé ne rend aucun corps ambigu").toBeGreaterThan(0);
    expect(c.corpsRegagnes).toBeGreaterThan(0);
  });

  it("[LE CŒUR] l'inverse est une PERTE, et `corpsRegagnes` devient NÉGATIF", () => {
    // ⚠️ C'est la propriété qui compte le plus de tout ce fichier. Un aperçu qui ne saurait annoncer
    // que des gains mentirait exactement dans le cas où elle a le plus besoin de la vérité avant de
    // valider. Un `Math.max(0, …)` posé « par propreté » ferait rougir ici.
    const port = portMouvant();
    const avant = calculerThemeNatal(AVEC_HEURE, port);
    const apres = calculerThemeNatal(SANS_HEURE, port);
    const c = comparerThemes(avant, apres);
    expect(c.corpsRegagnes).toBeLessThan(0);
  });

  it("[LE CŒUR] un changement de PRÉCISION seul suffit à faire dire « quelque chose change »", () => {
    // ⚠️ NÉ D'UN SURVIVANT (M18). Tous les autres cas font bouger l'ascendant ou le nombre de
    // corps EN MÊME TEMPS que la précision — un mutant qui retirait la précision de la comparaison
    // restait donc vert. Deux thèmes construits à la main isolent la seule variable qui compte.
    const base = calculerThemeNatal(AVEC_HEURE, portFige(12.5, 6));
    const c = comparerThemes(base, { ...base, precision: "midi_par_defaut" });
    expect(c.ascendantAvant).toBe(c.ascendantApres);
    expect(c.corpsRegagnes).toBe(0);
    expect(c.sansChangementVisible, "la perte de précision est passée inaperçue").toBe(false);
  });

  it("`ascendantDe` rend `null` quand les angles n'ont pas pu être calculés", () => {
    const sansAngles = calculerThemeNatal({ date: "1990-06-15" }, portFige(12.5, 6));
    expect(sansAngles.angles.statut).toBe("non_calcule");
    expect(ascendantDe(sansAngles)).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[6.5b] `phrasesApercu` — mettre en mots sans jamais compter", () => {
  const apercuDe = (p: Partial<Parameters<typeof copie.phrasesApercu>[0]>) =>
    copie.phrasesApercu({
      ascendantAvant: "verseau",
      ascendantApres: "verseau",
      precisionAvant: "heure_connue",
      precisionApres: "heure_connue",
      corpsRegagnes: 0,
      sansChangementVisible: true,
      ...p,
    });

  it("[LE CŒUR] un changement d'ascendant est nommé, dans les DEUX signes", () => {
    const phrases = apercuDe({ ascendantApres: "balance", sansChangementVisible: false });
    expect(phrases.join(" ")).toMatch(/Verseau/);
    expect(phrases.join(" ")).toMatch(/Balance/);
  });

  it("[LE CŒUR] une PERTE est dite comme une perte", () => {
    const perte = apercuDe({ corpsRegagnes: -2, sansChangementVisible: false }).join(" ");
    expect(perte).toMatch(/cessent d'être calculables/);
    expect(perte).toMatch(/2/);
    const gain = apercuDe({ corpsRegagnes: 3, sansChangementVisible: false }).join(" ");
    expect(gain).toMatch(/deviennent calculables/);
  });

  it("l'ascendant qui DISPARAÎT est annoncé, pas passé sous silence", () => {
    const phrases = apercuDe({ ascendantApres: null, sansChangementVisible: false }).join(" ");
    expect(phrases).toMatch(/ne sera plus calculable/);
  });

  it("« rien ne change » est dit plutôt que rendu vide", () => {
    // Une liste vide s'afficherait comme un aperçu qui n'a pas marché. Ici on dit la vérité :
    // rien de visible ne bouge, et le thème sera recalculé quand même.
    const phrases = apercuDe({});
    expect(phrases.length).toBe(1);
    expect(phrases[0]).toMatch(/Ni ton ascendant ni tes maisons ne changent/);
  });

  it("[FR-031] la copie ne dit JAMAIS combien de fois elle a corrigé", () => {
    // La base compte (piste d'audit) ; l'écran ne montre que la date. « Tu as corrigé 3 fois » est
    // un compteur, et c'est l'arbitrage déjà rendu par la 6.5 dans la section voisine.
    const texte = [
      copie.TITRE_SECTION,
      copie.INTRODUCTION,
      copie.HEURE_ABSENTE,
      copie.CORRIGE,
      copie.CORRECTION_APRES_REVOCATION,
      copie.dejaCorrigeeLe(new Date("2026-08-16T10:00:00Z")),
    ].join(" ");
    expect(texte).not.toMatch(/\b\d+\s*(fois|corrections?)\b/i);
    expect(texte).not.toMatch(/(première|deuxième|dernière)\s+correction/i);
  });

  it("la date de correction est sans heure", () => {
    expect(copie.dejaCorrigeeLe(new Date("2026-08-16T23:30:00Z"))).not.toMatch(/\d{1,2}:\d{2}/);
    expect(copie.dateLisible(new Date("2026-08-16T10:00:00Z"))).toBe("16 août 2026");
  });

  it("[GARDE STRUCTURELLE] le fuseau de la date est ÉCRIT, parce qu'aucun comportement ne peut le dire", () => {
    // ⚠️ NÉ D'UN SURVIVANT (M23), ET LE SURVIVANT AVAIT RAISON. Retirer `timeZone: "Europe/Paris"`
    // ne change RIEN sur une machine réglée sur Europe/Paris — c'est-à-dire la machine de
    // développement et, potentiellement, celle d'intégration. Aucune assertion de comportement ne
    // peut distinguer « fuseau déclaré » de « fuseau hérité de la machine » quand les deux
    // coïncident : la 6.6 avait rencontré exactement ce mur (M14) et s'en était sortie en changeant
    // l'heure du test, ce qui n'est possible que si les deux fuseaux DIFFÈRENT.
    //
    // On garde donc la FORME, comme la 6.1a garde les 60 h de l'homme mort en lisant la définition
    // SQL. C'est plus faible qu'une mesure, et c'est dit.
    const source = readFileSync(resolve(__dirname, "..", "lib/domain/copie-naissance.ts"), "utf-8");
    const formateurs = source.match(/new Intl\.DateTimeFormat/g) ?? [];
    const fuseaux = source.match(/timeZone:\s*"Europe\/Paris"/g) ?? [];
    expect(formateurs.length, "plus aucun formateur de date : le test ne garde plus rien").toBe(1);
    // AUTANT de fuseaux déclarés que de formateurs : un second formateur ajouté demain sans fuseau
    // ferait rougir ici, et pas seulement le premier.
    expect(fuseaux.length).toBe(formateurs.length);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[6.5b] La copie tient le registre de l'écran, pas celui d'Anam", () => {
  const tout = [
    copie.TITRE_SECTION,
    copie.INTRODUCTION,
    copie.HEURE_ABSENTE,
    copie.CORRIGE,
    copie.CORRECTION_APRES_REVOCATION,
  ].join(" ");

  it("elle n'est pas signée d'Anam et ne lui prête aucune parole", () => {
    expect(tout).not.toMatch(/—\s*Anam/);
    expect(tout).not.toMatch(/\bAnam (dit|pense|sent|trouve)\b/);
  });

  it("[LE CŒUR] elle dit que l'ancien thème ne sera PAS conservé", () => {
    // Sans cette phrase, quelqu'un corrige « pour voir » et découvre après coup que son horoscope
    // du jour a changé de fond en comble. C'est la troisième chose vraie de l'introduction, et
    // c'est celle qu'on oublie.
    expect(copie.INTRODUCTION).toMatch(/recalcul/i);
    expect(copie.INTRODUCTION).toMatch(/ne sera pas conservé/i);
  });

  it("le refus après révocation nomme le droit qui SURVIT", () => {
    expect(copie.CORRECTION_APRES_REVOCATION).toMatch(/[Ss]upprimer/);
  });
});
