/**
 * inventaire-effacement.ts — CE QUI DOIT DISPARAÎTRE (Story 6.7, AC1 · AD-14).
 *
 * ══ POURQUOI CE FICHIER N'EST PAS CELUI DE L'EXPORT ═════════════════════════════════════════════
 *
 * La 6.6 a posé `inventaire-export.ts` et son commentaire disait déjà pourquoi il ne fallait pas
 * fusionner les deux : **exporter et effacer répondent à deux droits différents** (art. 15 et
 * art. 17), et une table peut relever de l'un sans relever de l'autre.
 *
 * L'exemple n'est pas théorique : `execution_job` porte un `cible_id` qui peut être son identifiant.
 * Elle ne lui apprend RIEN — la ligne dit « tel job a tourné » — donc elle est hors export. Elle
 * doit pourtant disparaître avec elle, parce qu'une trace nominative de traitement reste une donnée
 * à caractère personnel. Un inventaire commun aurait tranché les deux d'un seul geste, et ce sont
 * les tables comme celle-là qu'on aurait perdues.
 *
 * Ce qui EST partagé, c'est le corpus de migrations : `tests/effacement-schema.test.ts` exige un
 * verdict ici pour chaque table du schéma, exactement comme son jumeau le fait pour l'export. Une
 * table créée demain casse les DEUX builds, et il faudra prendre les deux décisions séparément.
 */

export type VerdictEffacement =
  /** Une colonne la rattache à une personne : la ligne doit disparaître. */
  | "efface"
  /** Aucune colonne ne rattache la ligne à qui que ce soit. Rien à effacer. */
  | "sans_objet"
  /** Survit DÉLIBÉRÉMENT à l'effacement — et ne porte donc rien d'elle. */
  | "survit";

export interface EntreeEffacement {
  readonly table: string;
  readonly verdict: VerdictEffacement;
  readonly motif: string;
}

export const INVENTAIRE_EFFACEMENT: readonly EntreeEffacement[] = [
  // ── Tout ce qui la nomme part. La cascade du schéma le fait ; l'inventaire le DÉCLARE, et le
  //    test le MESURE ligne à ligne après un effacement réel.
  { table: "utilisatrice", verdict: "efface", motif: "l'identité elle-même, jusqu'à la ligne d'auth" },
  { table: "consentement", verdict: "efface", motif: "ce à quoi elle a consenti, et sa révocation" },
  { table: "entree_journal", verdict: "efface", motif: "le verbatim — effaçable au titre de l'art. 17, malgré son immuabilité d'écriture (AD-8)" },
  { table: "fait_extrait", verdict: "efface", motif: "le profil vivant, tombstones compris" },
  { table: "branche", verdict: "efface", motif: "l'arbre. RETIRÉ EN PREMIER par le moteur : seule clé « restrict » du schéma" },
  { table: "branche_retour", verdict: "efface", motif: "les jours où elle est revenue sur une branche" },
  { table: "resume_glissant", verdict: "efface", motif: "la mémoire de travail d'Anam" },
  { table: "synthese", verdict: "efface", motif: "les bilans périodiques écrits sur elle" },
  { table: "intention", verdict: "efface", motif: "les plans d'étapes posés sur une branche" },
  { table: "signal_reconceptualisation", verdict: "efface", motif: "les bascules repérées" },
  { table: "theme_natal", verdict: "efface", motif: "le socle calculé, gravé une fois" },
  { table: "enneagramme", verdict: "efface", motif: "le type retenu et son origine" },
  { table: "enneagramme_hypothese", verdict: "efface", motif: "les hypothèses de type" },
  { table: "enneagramme_tentative", verdict: "efface", motif: "les réponses au questionnaire" },
  { table: "tirage", verdict: "efface", motif: "les tirages, graine comprise" },
  { table: "lecture", verdict: "efface", motif: "les lectures et leurs restitutions" },
  { table: "seance", verdict: "efface", motif: "le déroulé de chacune de ses séances" },
  { table: "usage_ia", verdict: "efface", motif: "le métrage des appels au modèle" },
  { table: "episode_detresse", verdict: "efface", motif: "les épisodes de détresse ouverts ou clos" },
  { table: "audit_securite", verdict: "efface", motif: "les classifications de sécurité la concernant" },
  { table: "pause_rythme", verdict: "efface", motif: "les pauses qu'Anam lui a proposées" },
  { table: "invitation_integration", verdict: "efface", motif: "les invitations à intégrer une branche" },
  { table: "notification_envoyee", verdict: "efface", motif: "les notifications qui lui ont été envoyées" },
  { table: "abonnement", verdict: "efface", motif: "l'abonnement (la pièce comptable, elle, reste chez le prestataire)" },
  { table: "remboursement", verdict: "efface", motif: "les remboursements demandés" },
  { table: "information_reconduction", verdict: "efface", motif: "les avis de reconduction" },
  { table: "preference_socle", verdict: "efface", motif: "l'heure choisie pour le rendez-vous quotidien" },
  { table: "preference_courriel", verdict: "efface", motif: "les préférences de courriel" },
  { table: "abonnement_poussee", verdict: "efface", motif: "les appareils abonnés, clés comprises" },
  {
    table: "execution_job",
    verdict: "efface",
    motif:
      "HORS EXPORT MAIS EFFACÉE — la ligne ne lui apprend rien (« tel job a tourné »), mais son " +
      "`cible_id` la nomme, et une trace nominative de traitement reste une donnée la concernant.",
  },
  { table: "art9_temoin", verdict: "efface", motif: "témoin de test, mais rattaché à une utilisatrice : il part comme le reste" },

  // ── Rien à effacer : aucune colonne ne rattache ces lignes à quelqu'un ─────────────────────────
  { table: "environnement", verdict: "sans_objet", motif: "une seule ligne pour tout le déploiement" },
  { table: "probe", verdict: "sans_objet", motif: "témoin d'isolation RLS, sans propriétaire" },
  { table: "evenements_traites", verdict: "sans_objet", motif: "registre d'idempotence clé sur l'évènement du prestataire" },
  { table: "incident_systeme", verdict: "sans_objet", motif: "incidents d'exploitation, sans rattachement à une personne" },

  // ── Survit, et c'est la raison d'être de la story ──────────────────────────────────────────────
  {
    table: "effacement",
    verdict: "survit",
    motif:
      "la trace du geste. Sans clé étrangère vers `utilisatrice`, donc elle ne s'efface pas avec " +
      "elle ; elle ne porte qu'une empreinte, qui ne se remonte plus une fois l'identifiant disparu.",
  },
];

/** Les tables dont plus aucune ligne ne doit la nommer après un effacement. */
export const TABLES_EFFACEES: readonly string[] = INVENTAIRE_EFFACEMENT.filter(
  (e) => e.verdict === "efface",
).map((e) => e.table);
