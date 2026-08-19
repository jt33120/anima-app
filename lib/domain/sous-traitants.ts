/**
 * sous-traitants.ts — À QUI L'EFFACEMENT DOIT SE PROPAGER, ET CE QU'IL EN ADVIENT (Story 6.7, AC2).
 *
 * ══ POURQUOI UNE LISTE, ALORS QUE PERSONNE N'APPELLE D'API ICI ══════════════════════════════════
 *
 * L'AC2 est marquée [DUR] : l'effacement « se propage aux sous-traitants ». La réponse facile aurait
 * été un commentaire disant que le fournisseur IA est en zéro-rétention et que donc tout va bien.
 * Un commentaire ne se vérifie pas, ne casse aucun build, et vieillit sans bruit.
 *
 * Alors chaque sous-traitant porte un VERDICT dans un ensemble fermé, et chaque verdict désigne ce
 * qui le rend vrai — un fichier de garde, ou une porte pré-lancement nommée. `tests/sous-traitants.test.ts`
 * refuse un verdict dont la garde n'existe pas. Une affirmation qui ne pointe vers rien devient une
 * erreur de compilation du raisonnement, pas une phrase rassurante.
 *
 * ⚠️ ET CE FICHIER PARLE À L'ÉCRAN. Ce que l'effacement ne peut PAS retirer (`retention_legale`) est
 * affiché à l'utilisatrice AVANT qu'elle confirme, et le texte est DÉRIVÉ d'ici. Le jour où
 * quelqu'un ajoute un sous-traitant à rétention légale, l'écran le dira sans qu'on y pense — c'est
 * l'inverse exact du défaut habituel, où la liste vieillit et l'écran ment.
 */

export type VerdictPropagation =
  /** Rien n'est retenu chez lui, par contrat, et le produit REFUSE de démarrer autrement. */
  | "rien_retenu"
  /** Une copie existe mais expire d'elle-même dans la fenêtre déclarée (sauvegardes, PITR). */
  | "fenetre_bornee"
  /** Ne DOIT pas être effacé : obligation légale de conservation. Dit à l'écran, jamais tu. */
  | "retention_legale"
  /** Ne reçoit jamais d'art. 9 ; ce qu'il garde est borné par sa propre rétention contractuelle. */
  | "aucun_art9"
  /** Aucun sous-traitant n'est lié pour cette fonction à ce jour. */
  | "non_lie";

export interface SousTraitant {
  readonly cle: string;
  /** Ce qu'il fait pour le produit, en français d'utilisatrice. */
  readonly role: string;
  readonly verdict: VerdictPropagation;
  readonly motif: string;
  /**
   * CE QUI REND LE VERDICT VRAI : un chemin de fichier qui porte la garde, ou `porte:<nom>` pour une
   * porte pré-lancement humaine. Jamais vide — un verdict sans preuve est une opinion.
   */
  readonly garde: string;
}

export const SOUS_TRAITANTS: readonly SousTraitant[] = [
  {
    cle: "modele",
    role: "le modèle qui fait parler Anam",
    verdict: "rien_retenu",
    motif:
      "endpoints sans état et zéro-rétention : rien n’est conservé chez lui, donc il n’y a rien à " +
      "lui demander d’effacer. Un adaptateur qui ne le prouve pas ne démarre pas.",
    garde: "lib/ai/egress-guard.ts",
  },
  {
    cle: "base",
    role: "la base qui garde tes textes",
    verdict: "fenetre_bornee",
    motif:
      "les lignes partent tout de suite ; les sauvegardes et le point de restauration expirent " +
      "d’eux-mêmes dans la fenêtre inscrite sur la trace d’effacement.",
    garde: "supabase/migrations/0058_effacement_total.sql",
  },
  {
    cle: "paiement",
    role: "le prestataire de paiement",
    verdict: "retention_legale",
    // ⚠️ CE MOTIF SE LIT À LA SUITE DU `role`, et il a été réécrit pour ça (QA tour 2).
    // Il disait « les factures déjà émises restent chez lui » — un « lui » sans antécédent, parce
    // que `phraseCeQuiReste()` ne concaténait que les motifs et jetait les rôles. Sur l'écran de
    // l'effacement art. 17, le seul référent qu'une lectrice pouvait y accrocher était « Anam »,
    // lecture factuellement fausse. Les mots « prestataire » et « paiement » n'apparaissaient nulle
    // part sur la page, ni sur /aide, ni sur /cgu : l'acteur n'était récupérable d'aucun chemin.
    motif:
      "garde les factures déjà émises — une pièce comptable relève d’une obligation légale de " +
      "conservation, pas d’un consentement qu’on retire.",
    garde: "porte:conservation-comptable",
  },
  {
    cle: "courriel",
    role: "l’envoi des courriels",
    verdict: "aucun_art9",
    motif:
      "aucun courriel ne porte de contenu sensible — ni un extrait, ni un titre qui en dirait un. " +
      "Ce qui subsiste chez lui est une adresse dans un journal d’envoi, borné par son contrat.",
    garde: "tests/courriel-origine.test.ts",
  },
  {
    cle: "hebergement",
    role: "l’hébergement du site",
    verdict: "aucun_art9",
    motif: "aucun contenu sensible ne part dans les journaux, ni en clair ni en extrait (NFR-022).",
    garde: "tests/routes-art9-entetes.test.ts",
  },
  {
    cle: "transcription",
    role: "la transcription de la voix",
    verdict: "non_lie",
    motif: "aucun prestataire n’est lié à ce jour ; la voix n’est pas encore une entrée du produit.",
    garde: "porte:sous-traitant-transcription",
  },
];

/** Ce que l'effacement ne peut pas retirer — affiché AVANT la confirmation. */
export const RETENUS_PAR_LA_LOI: readonly SousTraitant[] = SOUS_TRAITANTS.filter(
  (s) => s.verdict === "retention_legale",
);

/** Les gardes humaines déclarées ici (portes pré-lancement), sans le préfixe. */
export const PORTES_DECLAREES: readonly string[] = SOUS_TRAITANTS.filter((s) =>
  s.garde.startsWith("porte:"),
).map((s) => s.garde.slice("porte:".length));
