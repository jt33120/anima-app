/**
 * ressources-aide.ts — La SOURCE UNIQUE des ressources d’aide (Story 2.5, AD-9/AD-15).
 *
 * MODÈLE PUR : données/logique seules, aucun import Next/React/Supabase/DOM, aucun `render/`.
 * Consommé par `app/aide` (halte statique) — le filet hors-IA ne dépend d’AUCUN modèle IA (AD-15).
 *
 * ⚠️ PROVISOIRE — porte pré-lancement clinique : la LISTE, les libellés et l’ADÉQUATION par
 * famille de danger (FR-044/FR-074) doivent être validés par un professionnel qualifié (et un
 * juriste) avant toute mise en ligne sur données réelles (PRD §5). On code la MACHINE ; pas le
 * jugement clinique.
 *
 * `aria` = le numéro énoncé chiffre par chiffre ; `service` = le nom lu AVANT les chiffres, pour
 * que le lecteur d’écran en mode « liste des liens » annonce « Prévention du suicide, 3 1 1 4 »
 * et pas des chiffres nus (revue 1.8, trouvaille [11]).
 */

/**
 * Familles de danger (FR-074). Présentation STATIQUE ici (toutes affichées, groupées) ; la
 * sélection DYNAMIQUE de la ressource adaptée au danger détecté en conversation est la Story 2.6.
 */
export type FamilleDanger =
  | "suicide"
  | "urgence_vitale"
  | "violences_femmes"
  | "enfance"
  | "ecoute";

export interface RessourceAide {
  readonly famille: FamilleDanger;
  readonly numero: string;
  readonly tel: string;
  /** Chiffres espacés → lecture chiffre par chiffre (`^\d( \d)+$`). */
  readonly aria: string;
  /** Nom du service, lu AVANT les chiffres (navigation « liste des liens »). */
  readonly service: string;
  readonly desc: string;
}

export const RESSOURCES_AIDE: ReadonlyArray<RessourceAide> = [
  { famille: "suicide", numero: "3114", tel: "3114", aria: "3 1 1 4", service: "Prévention du suicide", desc: "Prévention du suicide — gratuit, à toute heure, tous les jours." },
  { famille: "urgence_vitale", numero: "15", tel: "15", aria: "1 5", service: "SAMU", desc: "SAMU — urgence vitale immédiate." },
  { famille: "urgence_vitale", numero: "112", tel: "112", aria: "1 1 2", service: "Urgence européenne", desc: "Numéro d’urgence européen." },
  // QA tour 1 (T30) : le libellé était « Violences faites aux femmes », qui décrit le sujet mais
  // n’est plus l’appellation du service. Quelqu’un qui cherche à vérifier le numéro, ou qui l’entend
  // nommer ailleurs, doit retrouver le MÊME nom — c’est le seul moyen de savoir qu’on parle du même
  // service. Appellation officielle : arretonslesviolences.gouv.fr.
  { famille: "violences_femmes", numero: "3919", tel: "3919", aria: "3 9 1 9", service: "Violences Femmes Info", desc: "Violences Femmes Info — anonyme et gratuit." },
  { famille: "enfance", numero: "119", tel: "119", aria: "1 1 9", service: "Enfance en danger", desc: "Enfance en danger." },
  { famille: "ecoute", numero: "09 72 39 40 50", tel: "0972394050", aria: "0 9 7 2 3 9 4 0 5 0", service: "SOS Amitié", desc: "SOS Amitié — une écoute, tous les jours." },
];

/** Ordre d’affichage des familles — le danger vital d’abord (AC3 « en cas de doute, l’urgence prime »). */
export const FAMILLES_ORDRE: ReadonlyArray<FamilleDanger> = [
  "suicide",
  "urgence_vitale",
  "violences_femmes",
  "enfance",
  "ecoute",
];

/** En-tête de groupe par famille sur `/aide` (sobre, jamais alarmant). */
export const LIBELLE_FAMILLE: Readonly<Record<FamilleDanger, string>> = {
  suicide: "Pensées suicidaires",
  urgence_vitale: "Urgence vitale immédiate",
  violences_femmes: "Violences",
  enfance: "Enfance en danger",
  ecoute: "Besoin de parler",
};

// ── Gouvernance FR-044 : revue TRIMESTRIELLE, assignée, tracée ────────────────────────────────
// « Un numéro périmé ici est un défaut critique » (PRD FR-044). Garde de cadence HYBRIDE :
//   (a) structurelle — l’intervalle VERIFIE_LE→PROCHAINE_REVUE est un vrai trimestre (test déterministe) ;
//   (b) péremption réelle — `revuePerimee(now)` ; warn pendant le dev, hard-break sous PRELANCEMENT=1.

/** Date de dernière revérification des 6 numéros (ISO, affichée « Vérifié le … » sur /aide). */
export const VERIFIE_LE = "2026-07-28";
/** Échéance de la prochaine revue = VERIFIE_LE + 1 trimestre. */
export const PROCHAINE_REVUE = "2026-10-28";
/** Responsable nommé de la revue (à transférer au professionnel qualifié avant lancement). */
export const RESPONSABLE_REVUE = "Julian (porte pré-lancement : transfert au professionnel qualifié)";

/** Vrai si la revue des ressources est échue à la date donnée (FR-044). Pur : la date est injectée. */
export function revuePerimee(maintenant: Date): boolean {
  return maintenant.getTime() > new Date(PROCHAINE_REVUE).getTime();
}

/** « Vérifié le 28 juillet 2026 » — libellé humain pour l’en-tête du bloc ressources.
 *  Ancré en UTC (comme toute date-seule du repo, cf. `naissance/age.ts`) : sinon, une page
 *  prerenderée statiquement sur un build derrière UTC afficherait la veille (fuseau du build). */
export function verifieLeLibelle(): string {
  const d = new Date(`${VERIFIE_LE}T00:00:00Z`);
  return d.toLocaleDateString("fr-FR", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
}
