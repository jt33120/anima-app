/**
 * port.ts — LE CORPUS D'ANIMA : la seule porte par laquelle un texte d'interprétation entre dans le
 * produit (Story 5.2, FR-054 / FR-086).
 *
 * ── POURQUOI CETTE COUCHE EXISTE SÉPARÉE DE `lib/astro/` ───────────────────────────────────────
 *
 * `lib/astro/` est le socle : il ne produit QUE des nombres et des énumérations, et c'est ce qui
 * rend FR-053 (« le socle ne prédit jamais ») structurel plutôt que déclaratif — il n'y existe aucun
 * endroit où écrire une prédiction (`lib/astro/theme-natal.ts`, en-tête).
 *
 * Cette story introduit du TEXTE. Le poser dans `lib/astro/` détruirait cette propriété : la garde
 * d'absence qui surveille l'apparition d'un champ de prose se mettrait à voir de la prose partout et
 * ne protégerait plus rien. Donc deux couches, toutes deux pures, avec deux natures :
 *
 *     lib/astro/   → du CALCUL, aucune prose.      lib/corpus/ → de la PROSE, aucun calcul.
 *
 * ── QUI A LE DROIT D'ÉCRIRE ICI ────────────────────────────────────────────────────────────────
 *
 * **Anima, et personne d'autre.** Ce n'est pas une politesse envers l'autrice, c'est FR-054 doublé
 * de FR-086 : Anima est une PERSONNE RÉELLE ET IDENTIFIABLE, et « toute citation inventée attribuée
 * à une personne réelle est un défaut critique ». Les trois façons de remplir ces textes sans elle
 * sont fermées, chacune pour sa raison :
 *
 *   - les faire GÉNÉRER par un modèle       → FR-047 (le socle est calculé) et FR-054 ;
 *   - les ÉCRIRE nous-mêmes                 → c'est alors du texte générique repris, précisément ce
 *                                             que FR-054 bannit ;
 *   - les ACHETER ou les RECOPIER           → FR-054, et le droit d'auteur par-dessus.
 *
 * Et dans les trois cas ils finiraient signés du nom d'une personne réelle.
 *
 * ── D'OÙ L'UNION, ET NON `string | undefined` ──────────────────────────────────────────────────
 *
 * Même raison qu'en 5.1 pour `LectureCorps` (`lib/astro/port.ts`) : avec un optionnel, un `?? ""`
 * quelque part transformerait « Anima ne l'a pas encore écrit » en « il n'y a rien à dire », et les
 * deux s'afficheraient pareil. L'union force l'appelant à traiter le cas — et la 5.6 pourra dire
 * honnêtement ce qu'il en est, comme FR-050 le fait pour l'heure de naissance manquante.
 *
 * ── PURETÉ (garde `tests/corpus-architecture.test.ts`) ─────────────────────────────────────────
 *
 * Aucun import de `@/lib/ai/*` (il n'y a pas de « génération » de corpus), aucun de `@/lib/data/*`,
 * aucun `server-only`, aucun Supabase. Un corpus est une CONSTANTE : il se relit à l'identique, sans
 * base, sans réseau et sans appel facturé.
 *
 * Et parce que ce dossier vit sous `lib/`, tout texte déposé ici tombe AUTOMATIQUEMENT sous le
 * contrôle de voix bloquant de la Story 2.8 (`tests/lexique-voix.test.ts` balaie `lib/` en
 * récursif). C'est une des raisons du choix de l'emplacement — et la raison pour laquelle
 * `lib/corpus/` ne doit JAMAIS être ajouté aux exclusions de ce test.
 */

// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Un créneau de corpus : soit Anima l'a écrit, soit elle ne l'a pas encore écrit.
 *
 * Il n'existe volontairement pas de troisième état « texte par défaut » : ce serait la porte par
 * laquelle un texte sans auteur entrerait, et il aurait exactement l'air d'un texte d'Anima.
 */
export type TexteCorpus =
  | { readonly statut: "ecrit"; readonly texte: string }
  | { readonly statut: "non_ecrit" };

/** Le créneau non écrit — valeur unique et gelée : rien à allouer, rien à muter. */
export const NON_ECRIT: TexteCorpus = Object.freeze({ statut: "non_ecrit" as const });

/**
 * Un corpus est une table de créneaux DÉCLARÉS.
 *
 * La déclaration est le point important : `textes` contient TOUTES les clés du domaine, y compris
 * celles qui ne sont pas écrites. Sans ça, « combien reste-t-il à écrire ? » deviendrait une
 * question sans réponse mécanique, et une clé oubliée serait indiscernable d'une clé vide.
 */
export interface Corpus {
  /** Identifie le corpus dans les messages d'erreur et les inventaires. */
  readonly identifiant: string;
  readonly textes: Readonly<Record<string, TexteCorpus>>;
}

/**
 * Construit un corpus en GELANT sa table. Un corpus qui pourrait être muté à l'exécution ne serait
 * plus une constante : un module quelconque pourrait y écrire, et le texte affiché à l'utilisatrice
 * n'aurait plus d'auteur traçable.
 */
export function corpus(identifiant: string, textes: Record<string, TexteCorpus>): Corpus {
  for (const cle of Object.keys(textes)) Object.freeze(textes[cle]);
  return Object.freeze({ identifiant, textes: Object.freeze({ ...textes }) });
}

/** Un texte écrit par Anima. Le seul constructeur du statut `ecrit`. */
export function ecrit(texte: string): TexteCorpus {
  const propre = texte.trim();
  if (propre.length === 0) {
    // Une chaîne vide déclarée « écrite » serait le pire des deux mondes : elle passerait le compte
    // de complétude (« 69/69 ») et n'afficherait rien. On refuse à la construction.
    throw new Error("corpus : un texte « écrit » ne peut pas être vide — utiliser NON_ECRIT");
  }
  return Object.freeze({ statut: "ecrit" as const, texte: propre });
}

/**
 * Lit un créneau.
 *
 * ⚠️ JETTE sur une clé NON DÉCLARÉE, et c'est délibéré. Une clé inconnue n'est pas une absence de
 * texte, c'est un défaut de code — une faute de frappe, une valeur hors domaine, un nombre qu'on a
 * cru possible. Rendre `non_ecrit` la ferait passer pour du travail d'écriture en attente : elle
 * resterait vide pour toujours, l'inventaire dirait « 69 créneaux » sans jamais la compter, et
 * personne n'irait la chercher.
 */
export function lireTexte(c: Corpus, cle: string): TexteCorpus {
  const entree = c.textes[cle];
  if (entree === undefined) {
    throw new Error(`corpus ${c.identifiant} : créneau non déclaré « ${cle} »`);
  }
  return entree;
}

/** Les créneaux qu'Anima a écrits. */
export function clesEcrites(c: Corpus): readonly string[] {
  return Object.keys(c.textes)
    .filter((k) => c.textes[k].statut === "ecrit")
    .sort();
}

/** Les créneaux qui attendent Anima. En v1, c'est la totalité — voir la porte pré-lancement. */
export function clesNonEcrites(c: Corpus): readonly string[] {
  return Object.keys(c.textes)
    .filter((k) => c.textes[k].statut === "non_ecrit")
    .sort();
}

/** Tous les textes réellement écrits — la matière que les gardes de voix doivent balayer. */
export function textesEcrits(c: Corpus): readonly string[] {
  return Object.values(c.textes)
    .filter((t): t is { statut: "ecrit"; texte: string } => t.statut === "ecrit")
    .map((t) => t.texte);
}
