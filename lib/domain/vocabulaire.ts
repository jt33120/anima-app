/**
 * vocabulaire.ts — LES TROIS TERMES QUE FR-080 INTERDIT DE CONFONDRE (Story 5.6, T2).
 *
 * ── POURQUOI UN MODULE, ET PAS UNE RÈGLE ÉDITORIALE ────────────────────────────────────────────
 *
 * FR-080 dit que le **mantra du jour**, l'**ancrage** et la **lecture** « ne doivent jamais être
 * confondus dans l'interface », et FR-023 redit la moitié de la règle en nommant les deux formats.
 * Écrite comme une consigne, cette exigence dépend d'une relecture humaine à chaque libellé ajouté.
 * Or les deux stories qui suivent ajoutent précisément des libellés : la 5.8 livre **la lecture**,
 * la 5.9 livre **l'ancrage**. C'est le moment exact où une distinction qui ne vit que dans un
 * document se perd — et la doctrine de ce dépôt est constante : une garde qui ne vit que dans un
 * commentaire n'existe pas.
 *
 * ── CE QUI REND LA CONFUSION DÉTECTABLE : LA NATURE, PAS LA CHAÎNE ─────────────────────────────
 *
 * Comparer des chaînes ne garde rien — « ancrage » écrit à la place de « mantra du jour » reste une
 * chaîne parfaitement valide. Ce qui distingue réellement les trois, ce sont leurs **propriétés** :
 *
 *     mantra du jour  →  bref, NON interactif, GRATUIT à vie (FR-055)
 *     ancrage         →  2 à 5 min, INTERACTIF, PREMIUM
 *     lecture         →  rituel long avec tirage, INTERACTIF, PREMIUM
 *
 * Une carte tire son terme d'ici et **hérite de sa nature**. Nommer « ancrage » le mantra du jour
 * le rendrait donc premium — et la garde du socle jamais coupé (FR-055,
 * `tests/socle-jamais-coupe.test.ts`) rougit. La confusion cesse d'être une faute de relecture pour
 * devenir une contradiction que la suite de tests voit.
 *
 * ── PURETÉ (AD-1) ──────────────────────────────────────────────────────────────────────────────
 *
 * Zéro I/O, zéro import `lib/data`, zéro `server-only`. Et parce que ce fichier vit sous `lib/`, ses
 * libellés tombent automatiquement sous le contrôle de voix bloquant de la Story 2.8
 * (`tests/lexique-voix.test.ts`) — dont le détecteur « soin » vient d'être réparé en T1.
 */

/** Les trois formats du produit. Aucun quatrième : si un besoin apparaît, il se déclare ICI. */
export type CleTerme = "mantra" | "ancrage" | "lecture";

export interface Terme {
  readonly cle: CleTerme;
  /** Le libellé exact, tel qu'il s'affiche. Source unique — jamais recopié dans un composant. */
  readonly libelle: string;
  /**
   * Elle FAIT quelque chose, ou elle lit ? C'est la ligne que FR-080 trace entre le mantra
   * (« texte court, non interactif ») et l'ancrage (« exercice guidé et interactif »).
   */
  readonly interactif: boolean;
  /** `false` ⇒ gratuit à vie (FR-055). Le socle n'est jamais coupé. */
  readonly premium: boolean;
  /**
   * La fourchette de durée en minutes, quand le format en a une. `null` pour le mantra : il se lit,
   * il ne se chronomètre pas — et lui donner une durée serait déjà en faire un ancrage.
   */
  readonly dureeMinutes: readonly [number, number] | null;
}

const TERMES: Readonly<Record<CleTerme, Terme>> = Object.freeze({
  mantra: Object.freeze({
    cle: "mantra",
    libelle: "mantra du jour",
    interactif: false,
    premium: false,
    dureeMinutes: null,
  }),
  ancrage: Object.freeze({
    cle: "ancrage",
    libelle: "ancrage",
    interactif: true,
    premium: true,
    dureeMinutes: Object.freeze([2, 5] as const),
  }),
  lecture: Object.freeze({
    cle: "lecture",
    libelle: "lecture",
    interactif: true,
    premium: true,
    dureeMinutes: null,
  }),
});

/** Le terme, par sa clé. Point de passage unique — aucun libellé ne se recopie ailleurs. */
export function terme(cle: CleTerme): Terme {
  return TERMES[cle];
}

/** Les trois termes, pour rendre la complétude mesurable (patron `CLES_MANTRA`, 5.4). */
export const CLES_TERMES: readonly CleTerme[] = Object.freeze(["mantra", "ancrage", "lecture"]);

/**
 * Les libellés des DEUX AUTRES termes, normalisés pour la recherche. Sert à la garde de prose :
 * un texte qui présente un format ne doit pas nommer les autres.
 */
const AUTRES: Readonly<Record<CleTerme, readonly RegExp[]>> = Object.freeze({
  mantra: Object.freeze([/\bancrages?\b/i, /\blectures?\b/i]),
  ancrage: Object.freeze([/\bmantras?\b/i, /\blectures?\b/i]),
  lecture: Object.freeze([/\bmantras?\b/i, /\bancrages?\b/i]),
});

/**
 * LA GARDE DE PROSE — `texte` présenté sous le terme `cle` nomme-t-il un AUTRE format ?
 *
 * La garde de nature (ci-dessus) attrape la carte mal étiquetée ; celle-ci attrape la phrase mal
 * écrite — « ton ancrage du jour » posé sous la carte du mantra, qui promet un exercice guidé de
 * cinq minutes là où il n'y a qu'un texte à lire. Les deux chemins sont distincts et aucun ne
 * couvre l'autre.
 *
 * Rend les termes fautifs trouvés, dans l'ordre de déclaration. Vide = rien à redire.
 */
export function chercherConfusionVocabulaire(texte: string, cle: CleTerme): readonly string[] {
  const trouves: string[] = [];
  for (const motif of AUTRES[cle]) {
    const m = texte.match(motif);
    if (m) trouves.push(m[0]);
  }
  return trouves;
}
