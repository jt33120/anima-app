/**
 * inventaire-export.ts — LA LISTE DÉCLARÉE DE CE QUI SORT, ET DE CE QUI NE SORT PAS (Story 6.6).
 *
 * ══ POURQUOI CE FICHIER EXISTE ══════════════════════════════════════════════════════════════════
 *
 * Un export complet écrit à la main est complet LE JOUR OÙ ON L'ÉCRIT. La 6.7 ajoutera une table,
 * la 6.8 une autre, et l'export continuera de répondre « voici tout ce qu'Anam sait de toi » en
 * ayant discrètement cessé d'être vrai. Aucune erreur ne se produira : le fichier sera juste plus
 * court, et personne ne compte les sections d'un export.
 *
 * Alors on inverse la charge. Ce fichier déclare un verdict pour CHAQUE table du schéma, et
 * `tests/export-inventaire.test.ts` lit le corpus de migrations : toute table créée un jour sans
 * verdict fait ROUGIR LE BUILD. On ne peut plus oublier une table — on peut seulement décider,
 * explicitement, de ne pas l'exporter, et écrire pourquoi.
 *
 * ⚠️ CE N'EST PAS LA MÊME LISTE QUE CELLE DE L'EFFACEMENT (6.7), et il ne faudra pas les fusionner
 * à la légère. Une table peut être hors export et pourtant devoir être effacée : `execution_job`
 * porte un `cible_id` qui peut être son identifiant, ne lui apprend rigoureusement rien, et devra
 * pourtant disparaître avec elle. Exporter et effacer répondent à deux droits différents (art. 15
 * et art. 17) ; un inventaire commun ferait trancher les deux d'un seul geste.
 */

export type VerdictExport = "inclus" | "exclu";

export interface EntreeInventaire {
  /** Le nom de la table, tel qu'il apparaît dans les migrations ET comme clé du document. */
  readonly table: string;
  readonly verdict: VerdictExport;
  /** Le titre de la section dans le document lisible. Obligatoire pour `inclus`. */
  readonly titre?: string;
  /** Ce qu'on en dit, dans les deux sens : pourquoi c'est là, ou pourquoi ça n'y est pas. */
  readonly motif: string;
  /**
   * Colonnes retirées du document. UNIQUEMENT des capacités (de quoi agir en son nom), jamais un
   * renseignement sur elle — voir l'encadré de `0057_export_donnees.sql`.
   */
  readonly retraits?: readonly string[];
}

/**
 * L'ordre de ce tableau EST l'ordre des sections du document lisible : ce qu'elle a dit d'abord, ce
 * que le produit en a fait ensuite, la comptabilité en dernier. Un export qui s'ouvre sur des
 * compteurs de jetons lui apprend que le produit s'intéresse d'abord à ça.
 */
export const INVENTAIRE_EXPORT: readonly EntreeInventaire[] = [
  // ── Qui elle est ────────────────────────────────────────────────────────────────────────────
  { table: "utilisatrice", verdict: "inclus", titre: "Toi", motif: "état civil, naissance, lieu" },
  { table: "consentement", verdict: "inclus", titre: "Ce à quoi tu as consenti", motif: "art. 9, IA reconnue, CGU, révocation" },

  // ── La mémoire, ses trois couches (AD-8) ────────────────────────────────────────────────────
  {
    table: "entree_journal",
    verdict: "inclus",
    titre: "Tes conversations",
    motif: "le verbatim immuable — et les transcriptions conservées, qui y sont déposées comme n'importe quel tour (NFR-003)",
  },
  { table: "fait_extrait", verdict: "inclus", titre: "Ce qu'Anam retient de toi", motif: "le profil vivant, corrections et suppressions comprises" },
  { table: "branche", verdict: "inclus", titre: "Tes branches", motif: "l'arbre de vie, nommé par elle" },
  { table: "branche_retour", verdict: "inclus", titre: "Tes retours sur une branche", motif: "les jours où elle est revenue sur une branche" },
  { table: "resume_glissant", verdict: "inclus", titre: "Le résumé glissant", motif: "la mémoire de travail d'Anam" },
  { table: "synthese", verdict: "inclus", titre: "Les synthèses", motif: "les bilans périodiques" },
  { table: "intention", verdict: "inclus", titre: "Tes intentions", motif: "les plans d'étapes posés sur une branche" },
  { table: "signal_reconceptualisation", verdict: "inclus", titre: "Les bascules repérées", motif: "les moments où une façon de voir a changé" },

  // ── Le socle calculé et le type ─────────────────────────────────────────────────────────────
  { table: "theme_natal", verdict: "inclus", titre: "Ton thème natal", motif: "le socle calculé, gravé une fois" },
  { table: "enneagramme", verdict: "inclus", titre: "Ton ennéagramme", motif: "le type retenu et son origine" },
  { table: "enneagramme_hypothese", verdict: "inclus", titre: "Les hypothèses de type", motif: "ce qu'Anam a supposé avant de savoir" },
  { table: "enneagramme_tentative", verdict: "inclus", titre: "Tes réponses au questionnaire", motif: "les réponses brutes du test" },

  // ── Les lectures ────────────────────────────────────────────────────────────────────────────
  { table: "tirage", verdict: "inclus", titre: "Tes tirages", motif: "la carte, la graine, la taille du jeu — de quoi rejouer le tirage" },
  { table: "lecture", verdict: "inclus", titre: "Tes lectures", motif: "la question posée et la restitution" },

  // ── Ce que le produit a fait d'elle ─────────────────────────────────────────────────────────
  { table: "seance", verdict: "inclus", titre: "Le déroulé de tes séances", motif: "l'arc de séance, phase par phase" },
  {
    table: "episode_detresse",
    verdict: "inclus",
    titre: "Les moments où le produit s'est inquiété",
    motif: "art. 15 : le seul jugement que le produit porte sur elle ne peut pas lui être caché",
  },
  { table: "audit_securite", verdict: "inclus", titre: "Les décisions de sécurité te concernant", motif: "classifications sans art. 9 : niveau, décision, horodatage" },
  { table: "pause_rythme", verdict: "inclus", titre: "Les pauses proposées", motif: "quand Anam a proposé de laisser respirer" },
  { table: "invitation_integration", verdict: "inclus", titre: "Les invitations à intégrer", motif: "les moments où une branche a été rapprochée d'une autre" },
  { table: "notification_envoyee", verdict: "inclus", titre: "Les notifications reçues", motif: "motif et horodatage, jamais le contenu" },
  { table: "usage_ia", verdict: "inclus", titre: "Ton usage du modèle", motif: "métrage : modèle, tier, jetons" },

  // ── L'argent et les réglages ────────────────────────────────────────────────────────────────
  { table: "abonnement", verdict: "inclus", titre: "Ton abonnement", motif: "état, échéance, identifiants Stripe" },
  { table: "remboursement", verdict: "inclus", titre: "Tes remboursements", motif: "demande et confirmation" },
  { table: "information_reconduction", verdict: "inclus", titre: "Les avis de reconduction", motif: "échéance annoncée et date d'envoi" },
  { table: "preference_socle", verdict: "inclus", titre: "L'heure de ton rendez-vous quotidien", motif: "l'heure choisie" },
  {
    table: "preference_courriel",
    verdict: "inclus",
    titre: "Tes préférences de courriel",
    motif: "refus de courriel et date",
    retraits: ["jeton"],
  },
  {
    table: "abonnement_poussee",
    verdict: "inclus",
    titre: "Tes appareils abonnés",
    motif: "quel appareil reçoit les notifications, et depuis quand",
    retraits: ["cle_p256dh", "cle_auth"],
  },

  // ── Hors export, et chaque ligne dit pourquoi ───────────────────────────────────────────────
  {
    table: "environnement",
    verdict: "exclu",
    motif: "configuration globale du déploiement — une seule ligne pour tout le produit, rien d'elle",
  },
  { table: "probe", verdict: "exclu", motif: "témoin de test d'isolation RLS — n'existe que pour la CI" },
  { table: "art9_temoin", verdict: "exclu", motif: "témoin de test du write-gate art. 9 — n'existe que pour la CI" },
  {
    table: "execution_job",
    verdict: "exclu",
    motif:
      // Pas d'emoji dans une chaîne : `lexique-voix.test.ts` scanne ces motifs comme du contenu
      // destiné à l'utilisatrice, et il a raison — un motif d'inventaire peut finir à l'écran.
      "exécutions de l'ordonnanceur. `cible_id` peut porter son identifiant, mais la ligne ne dit " +
      "que « tel job a tourné » — aucun renseignement sur elle. À EFFACER quand même (Story 6.7)",
  },
  {
    table: "evenements_traites",
    verdict: "exclu",
    motif: "registre d'idempotence Stripe, clé sur l'identifiant d'évènement du prestataire — aucune colonne d'utilisatrice",
  },
  { table: "incident_systeme", verdict: "exclu", motif: "incidents d'exploitation, sans art. 9 et sans rattachement à une personne" },
  {
    table: "effacement",
    verdict: "exclu",
    motif:
      "la trace d'un effacement (Story 6.7). Elle ne porte aucune donnée d'elle — seulement une " +
      "empreinte qui ne se remonte plus une fois l'identifiant disparu — et par construction elle " +
      "n'existe qu'APRÈS qu'il n'y a plus rien à exporter.",
  },
];

/** Les tables qui doivent apparaître dans le document, dans l'ordre. */
export const TABLES_EXPORTEES: readonly string[] = INVENTAIRE_EXPORT.filter(
  (e) => e.verdict === "inclus",
).map((e) => e.table);

/** Toutes les colonnes retirées, à plat. Sert de garde : aucune ne doit apparaître dans un export. */
export const COLONNES_RETIREES: readonly string[] = INVENTAIRE_EXPORT.flatMap((e) => e.retraits ?? []);

/** Le titre lisible d'une section, ou le nom de table si elle n'est pas encore inventoriée. */
export function titreDeSection(table: string): string {
  return INVENTAIRE_EXPORT.find((e) => e.table === table)?.titre ?? table;
}
