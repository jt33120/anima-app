import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  APAISEMENT_JOURS,
  FENETRE_JOURS,
  PHRASE_PAUSE,
  SEUIL_MINUTES,
  SEUIL_SEANCES,
  SILENCE_SEANCE_MINUTES,
  mesurerRythme,
  seuilFranchi,
} from "@/lib/domain/rythme-pause";
import { chercherInterdits } from "@/lib/domain/lexique-interdit";
import { chercherPredictions } from "@/lib/domain/marqueurs-prediction";
import { tronquerATroisPhrases } from "@/lib/domain/voix-anam";

/**
 * Story 6.4 (T1) — LE DOMAINE DU GESTE DE PAUSE.
 *
 * Deux objets très différents cohabitent dans ce fichier, et c'est voulu : une ARITHMÉTIQUE (le
 * découpage en séances) et un TEXTE (la phrase d'Anam). Le lien entre les deux est que ni l'un ni
 * l'autre n'a le droit de produire un jugement — l'arithmétique ne sait pas dire « elle vient peu »,
 * et le texte ne sait pas demander un engagement.
 */

const MINUTE = 60_000;
const HEURE = 60 * MINUTE;
const JOUR = 24 * HEURE;

/** Un instant de référence fixe : `Date.now()` rendrait ces tests non reproductibles. */
const MAINTENANT = Date.parse("2026-08-16T12:00:00.000Z");

/** Des tours espacés de `pasMinutes`, le plus récent à `ilYaMs` de MAINTENANT. */
function tours(nombre: number, pasMinutes: number, ilYaMs = 0): number[] {
  const fin = MAINTENANT - ilYaMs;
  return Array.from({ length: nombre }, (_, i) => fin - (nombre - 1 - i) * pasMinutes * MINUTE);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════

describe("[6.4/D2] une séance est une GRAPPE, et le silence en est la frontière", () => {
  it("[CONTRÔLE NÉGATIF] rien d'écrit ⇒ rien mesuré", () => {
    expect(mesurerRythme([], MAINTENANT)).toEqual({ seances: 0, minutes: 0 });
  });

  it("des tours rapprochés ne font QU'UNE séance", () => {
    // Cinq tours espacés de 5 minutes : une conversation, pas cinq visites.
    expect(mesurerRythme(tours(5, 5), MAINTENANT).seances).toBe(1);
  });

  it("[LE CŒUR] un silence PLUS LONG que la borne ouvre une séance nouvelle", () => {
    // ⚠️ Mutation-cible : supprimer la comparaison au silence, ou compter un tour = une séance. Les
    // deux rendraient le seuil trivialement franchissable — six messages dans une même conversation
    // deviendraient « six séances », et Anam proposerait une pause à quelqu'un venue UNE fois.
    const a = tours(3, 2, 3 * HEURE); // une grappe il y a 3 h
    const b = tours(3, 2); // une grappe maintenant
    expect(mesurerRythme([...a, ...b], MAINTENANT).seances).toBe(2);
  });

  it("[BORNE] un silence de TRENTE MINUTES PILE reste la même séance", () => {
    // ⚠️ Mutation-cible : `>=` au lieu de `>`. Le doute penche vers MOINS de séances, donc vers ne
    // PAS franchir le seuil — un produit qui dit « tu viens trop » doit se tromper dans ce sens-là.
    const deux = [MAINTENANT - SILENCE_SEANCE_MINUTES * MINUTE, MAINTENANT];
    expect(mesurerRythme(deux, MAINTENANT).seances).toBe(1);

    // …et une minute de plus fait bien basculer : sans ce second volet, la borne serait prouvée par
    // un test qui passerait aussi avec « tout est une seule séance ».
    const troisDeSecondes = [MAINTENANT - (SILENCE_SEANCE_MINUTES + 1) * MINUTE, MAINTENANT];
    expect(mesurerRythme(troisDeSecondes, MAINTENANT).seances).toBe(2);
  });

  it("[LE CŒUR] l'ORDRE d'arrivée n'a aucune importance — la fonction trie", () => {
    // ⚠️ Mutation-cible : retirer le `.sort()`. Le dépôt demande `order desc` ; sans le tri ici,
    // l'ordre du `select` porterait un invariant du domaine, et le jour où quelqu'un le change pour
    // une bonne raison le découpage deviendrait faux sans que rien ne rougisse.
    const t = [...tours(3, 2, 3 * HEURE), ...tours(3, 2)];
    const melange = [t[4], t[0], t[5], t[2], t[1], t[3]];
    expect(mesurerRythme(melange, MAINTENANT)).toEqual(mesurerRythme(t, MAINTENANT));
  });
});

describe("[6.4/D1] la fenêtre glissante, et ce qu'elle laisse dehors", () => {
  it("[LE CŒUR] ce qui date de plus de sept jours ne compte pas", () => {
    // ⚠️ Mutation-cible : retirer le filtre de fenêtre. Le rythme deviendrait cumulatif à vie, donc
    // franchi pour toute personne fidèle — la contre-métrique de DÉPENDANCE se déclencherait sur la
    // LOYAUTÉ, ce qui est exactement le contresens.
    const vieux = tours(20, 5, (FENETRE_JOURS + 1) * JOUR);
    expect(mesurerRythme(vieux, MAINTENANT)).toEqual({ seances: 0, minutes: 0 });
  });

  it("[BORNE] ce qui date de six jours compte encore", () => {
    const recent = tours(3, 5, 6 * JOUR);
    expect(mesurerRythme(recent, MAINTENANT).seances).toBe(1);
  });

  it("un horodatage dans le FUTUR est écarté", () => {
    // Une horloge de client déréglée, ou une ligne insérée par un test : ça ne fabrique pas de rythme.
    expect(mesurerRythme([MAINTENANT + JOUR], MAINTENANT)).toEqual({ seances: 0, minutes: 0 });
  });

  it("une date illisible est écartée, jamais remplacée", () => {
    expect(mesurerRythme([Number.NaN, Number.POSITIVE_INFINITY], MAINTENANT).seances).toBe(0);
  });
});

describe("[6.4/D2] les minutes SOUS-ESTIMENT, et c'est la bonne direction du doute", () => {
  it("une grappe d'UN SEUL tour dure zéro minute", () => {
    expect(mesurerRythme([MAINTENANT], MAINTENANT).minutes).toBe(0);
  });

  it("[LE CŒUR] la durée est la somme des grappes, JAMAIS l'écart du premier au dernier", () => {
    // ⚠️ Mutation-cible : `dernier - premier`. Deux conversations de dix minutes séparées de six
    // jours compteraient alors 8 640 minutes, et le seuil des 60 minutes serait franchi par
    // quelqu'un qui a passé vingt minutes dans l'application en une semaine. C'est la faute la plus
    // facile à écrire ici, et la plus injuste.
    const a = tours(2, 10, 6 * JOUR); // 10 min
    const b = tours(2, 10); // 10 min
    expect(mesurerRythme([...a, ...b], MAINTENANT)).toEqual({ seances: 2, minutes: 20 });
  });

  it("les minutes sont TRONQUÉES, jamais arrondies au-dessus", () => {
    const presque = [MAINTENANT - 119 * 1000, MAINTENANT]; // 1 min 59 s
    expect(mesurerRythme(presque, MAINTENANT).minutes).toBe(1);
  });
});

describe("[6.4/D3] le seuil du PRD, littéralement : un OU, et deux comparaisons STRICTES", () => {
  it("[BORNE] cinq séances PILE ne franchissent rien", () => {
    // ⚠️ Mutation-cible : `>=`. Le PRD écrit « PLUS de 5 sessions », et la différence n'est pas
    // cosmétique : elle décide si quelqu'un qui vient cinq fois s'entend proposer une pause.
    expect(seuilFranchi({ seances: SEUIL_SEANCES, minutes: 0 })).toBe(false);
    expect(seuilFranchi({ seances: SEUIL_SEANCES + 1, minutes: 0 })).toBe(true);
  });

  it("[BORNE] soixante minutes PILE ne franchissent rien", () => {
    expect(seuilFranchi({ seances: 0, minutes: SEUIL_MINUTES })).toBe(false);
    expect(seuilFranchi({ seances: 0, minutes: SEUIL_MINUTES + 1 })).toBe(true);
  });

  it("[LE CŒUR] c'est un OU — chaque branche suffit à elle seule", () => {
    // ⚠️ Mutation-cible : `&&`. Le seuil deviendrait presque infranchissable, et la story livrerait
    // une fonctionnalité morte qui aurait l'air complète. C'est le mode d'échec le plus silencieux
    // de cette story : rien ne casse, personne ne voit jamais la phrase.
    expect(seuilFranchi({ seances: SEUIL_SEANCES + 1, minutes: 0 })).toBe(true);
    expect(seuilFranchi({ seances: 0, minutes: SEUIL_MINUTES + 1 })).toBe(true);
    expect(seuilFranchi({ seances: 0, minutes: 0 })).toBe(false);
  });

  it("la fenêtre d'apaisement est nettement plus longue que la fenêtre de mesure", () => {
    // Sinon le seuil, qui reste franchi tant que le rythme dure, relancerait la phrase en boucle —
    // et FR-034 interdit le message générique récurrent.
    expect(APAISEMENT_JOURS).toBeGreaterThan(FENETRE_JOURS * 2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════

/** Les formes qu'une détection de décrochage prendrait. Visent la MESURE, jamais une longueur. */
const VERS_LE_BAS = [
  /\b(?:seances|minutes)\s*(?:===|==|<|<=)\s*\d/,
  /\.(?:seances|minutes)\s*(?:===|==|<|<=)/,
  /<\s*SEUIL_/,
  /<=\s*SEUIL_/,
];

describe("[6.4/AC4] RIEN ne regarde vers le bas — l'absence de la fonction inverse EST la garantie", () => {
  const source = readFileSync(resolve(process.cwd(), "lib/domain/rythme-pause.ts"), "utf-8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("[LE CŒUR] aucune comparaison qui détecterait un rythme FAIBLE n'existe dans le module", () => {
    // ⚠️ L'AC4 est une SYMÉTRIE : « aucune absence n'est traitée comme un décrochage et aucun
    // message ne la constate ». Or compter les séances fabrique gratuitement, dans le même objet, la
    // capacité de détecter le décrochage — `mesure.seances === 0` est à une ligne, et elle
    // s'écrirait un jour avec les meilleures intentions du monde (« on la relance gentiment »).
    //
    // On ne peut pas tester une fonctionnalité qui n'existe pas. On peut tester que le MOYEN de
    // l'écrire n'est pas déjà à moitié posé : aucune comparaison de la MESURE vers le bas.
    //
    // ⚠️ Le motif vise les deux champs de mesure, PAS un `=== 0` quelconque : `dans.length === 0`
    // est une garde de tableau vide, elle ne juge personne. Une garde qui rougit sur du code
    // légitime finit désactivée, et une garde désactivée ne garde rien.
    for (const interdit of VERS_LE_BAS) {
      expect(interdit.test(source), `« ${interdit} » regarde vers le bas`).toBe(false);
    }
  });

  it("[ANTI-VACUITÉ] ces motifs MORDENT — sinon la garde ci-dessus est décorative", () => {
    // Les quatre formes que prendrait la fonctionnalité interdite si quelqu'un l'écrivait.
    const tentations = [
      "if (mesure.seances === 0) relancer();",
      "return m.seances < SEUIL_SEANCES;",
      "const endormie = mesure.minutes <= 5;",
      "if (seances < 2) direQuElleManque();",
    ];
    for (const t of tentations) {
      expect(
        VERS_LE_BAS.some((r) => r.test(t)),
        `aucun motif n'attrape « ${t} »`,
      ).toBe(true);
    }
  });

  it("[LE CŒUR] aucun prédicat d'inactivité n'est exporté", () => {
    for (const nom of ["inactif", "inactive", "decrochage", "faible", "absence", "relance", "revenir"]) {
      expect(
        new RegExp(`export (?:function|const) \\w*${nom}`, "i").test(source),
        `un export nommé « ${nom} » existe`,
      ).toBe(false);
    }
  });
});

describe("[6.4/D5] la phrase — ce qu'elle refuse, un refus par test", () => {
  it("[FR-084] elle tient en trois phrases", () => {
    expect(tronquerATroisPhrases(PHRASE_PAUSE).tronque).toBe(false);
  });

  it("[FR-031] elle ne chiffre RIEN", () => {
    // ⚠️ « Tu es venue 7 fois cette semaine » serait statistiquement vrai, produirait une preuve, et
    // transformerait une proposition en bulletin. Le mot « souvent » fait tout le travail que ferait
    // un compte, sans compter — même geste que le mot « encore » dans `PHRASE_INVITATION`.
    expect(/\d/.test(PHRASE_PAUSE), "un chiffre est entré dans la phrase").toBe(false);
    for (const compte of [/\bfois\b/i, /\bsemaine\b/i, /\bminutes?\b/i, /\bs[ée]ances?\b/i]) {
      expect(compte.test(PHRASE_PAUSE), `« ${compte} » approche le compte`).toBe(false);
    }
  });

  it("[LE CŒUR / AC1] elle n'extorque AUCUN engagement et ne pose AUCUNE question", () => {
    // ⚠️ C'est la propriété que l'AC1 nomme explicitement — « aucune condition de retour ni aucun
    // engagement n'est extorqué » — et c'est aussi la raison pour laquelle cette phrase est une
    // CONSTANTE et non une génération : aucun texte engendré ne peut la garantir.
    //
    // Une question en fait partie : elle appelle une réponse, donc un engagement. `PHRASE_INVITATION`
    // en pose une, et c'est légitime là-bas — elle propose un GESTE. Ici, il n'y a rien à faire.
    for (const extorsion of [
      /\bpromets?\b/i,
      /\bpromis\b/i,
      /\bengage\b/i,
      /\breviens\b/i,
      /\bà demain\b/i,
      /\bje t'attends\b/i,
      /\btu devrais\b/i,
      /\bil (?:faut|faudrait)\b/i,
      /\bessaie de\b/i,
      /\bd'accord\b/i,
      /\?/,
    ]) {
      expect(extorsion.test(PHRASE_PAUSE), `« ${extorsion} » extorque quelque chose`).toBe(false);
    }
  });

  it("[2.8 / NFR-008] elle passe le lexique interdit et les marqueurs de prédiction", () => {
    expect(chercherInterdits(PHRASE_PAUSE)).toEqual([]);
    expect(chercherPredictions(PHRASE_PAUSE)).toEqual([]);
  });

  it("[ANTI-VACUITÉ] les détecteurs ci-dessus mordent VRAIMENT sur une phrase fautive", () => {
    // Sans ce contrôle, les cinq tests ci-dessus passeraient aussi avec `PHRASE_PAUSE = ""`.
    const fautive = "Tu es venue 7 fois cette semaine. Promets-moi de lever le pied. D'accord ?";
    expect(/\d/.test(fautive)).toBe(true);
    expect(/\bpromets?\b/i.test(fautive)).toBe(true);
    expect(/\?/.test(fautive)).toBe(true);
    expect(PHRASE_PAUSE.length).toBeGreaterThan(60);
  });
});
