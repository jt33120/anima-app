import "server-only";
import { createSupabaseAdminClient } from "@/lib/data/supabase/admin";
import { avecDelai } from "@/lib/domain/delai";
import { fenetreDepuisTexte } from "@/lib/domain/effacement";
import {
  dureeDepuisTexte,
  inactiviteRecevable,
  issueRecevable,
  journalRecevable,
  preavisRecevable,
  INACTIVITE_MOIS_DEFAUT,
  JOURNAL_JOURS_DEFAUT,
  PREAVIS_MOIS_DEFAUT,
  type IssueEcheance,
} from "@/lib/domain/retention";

/**
 * depot-retention.ts — LE DÉPÔT DU MOTEUR DE RÉTENTION (Story 6.8 · AD-14).
 *
 * `service_role`, comme tout l'ordonnanceur : ces décisions s'appliquent à des personnes qui n'ont
 * plus de session depuis deux ans. C'est l'un des rares emplois légitimes du rôle système (AD-12) —
 * et le seul chemin par lequel il touche du contenu art. 9 est l'EFFACEMENT, jamais la lecture.
 *
 * ⚠️ TOUTES LES ÉCHÉANCES SONT LUES ICI ET PASSÉES EN ARGUMENTS. Aucune n'est écrite dans le SQL,
 * aucune n'est écrite dans le domaine : AD-14 dit « paramètres lus à l'exécution », et ce fichier
 * est le seul endroit du produit où `process.env` rencontre une durée de conservation.
 */

const DELAI_DEPOT_MS = 3_000;

export interface EcheancesRetention {
  readonly inactiviteMois: number;
  readonly preavisMois: number;
  readonly journalJours: number;
  readonly fenetrePitrJours: number;
}

/** Les quatre durées du moteur, lues à l'exécution. */
export function echeancesCourantes(): EcheancesRetention {
  return {
    inactiviteMois: dureeDepuisTexte(
      process.env.RETENTION_INACTIVITE_MOIS,
      INACTIVITE_MOIS_DEFAUT,
      inactiviteRecevable,
    ),
    preavisMois: dureeDepuisTexte(process.env.RETENTION_PREAVIS_MOIS, PREAVIS_MOIS_DEFAUT, preavisRecevable),
    journalJours: dureeDepuisTexte(
      process.env.RETENTION_JOURNAL_JOURS,
      JOURNAL_JOURS_DEFAUT,
      journalRecevable,
    ),
    fenetrePitrJours: fenetreDepuisTexte(process.env.EFFACEMENT_FENETRE_PITR_JOURS),
  };
}

export interface DepotRetention {
  /** Les comptes inactifs qu'aucun préavis n'a encore touchés. */
  comptesAPrevenir(inactiviteMois: number, max: number): Promise<readonly string[]>;
  /** Pose le préavis. `false` si une échéance existait déjà — on n'en écrase jamais une. */
  poserEcheance(utilisatriceId: string, preavisMois: number): Promise<boolean>;
  /** Les comptes dont l'échéance est échue aujourd'hui ou l'était hier. */
  comptesAEffacer(max: number): Promise<readonly string[]>;
  /** Efface, gracie, ou ne fait rien — la décision est prise en base, en un aller-retour. */
  trancher(utilisatriceId: string, e: EcheancesRetention): Promise<IssueEcheance>;
  /** La rétention du journal de l'ordonnanceur (R1). Rend le nombre de lignes retirées. */
  purgerJournal(jours: number): Promise<number>;
}

export function creerDepotRetention(): DepotRetention {
  const supabase = createSupabaseAdminClient();
  const borne = <T>(requete: PromiseLike<T>, operation: string): Promise<T> =>
    avecDelai(Promise.resolve(requete), DELAI_DEPOT_MS, `${operation}_timeout`);

  /** Les RPC de sélection rendent `[{ utilisatrice_id }]` — on n'en garde que des uuid non vides. */
  const identifiants = (data: unknown): readonly string[] =>
    Array.isArray(data)
      ? data
          .map((l) => (l as { utilisatrice_id?: unknown })?.utilisatrice_id)
          .filter((v): v is string => typeof v === "string" && v.length > 0)
      : [];

  return {
    async comptesAPrevenir(inactiviteMois, max) {
      const { data, error } = await borne(
        supabase.rpc("comptes_a_prevenir", { p_inactivite_mois: inactiviteMois, p_max: max }),
        "comptes_a_prevenir",
      );
      if (error) throw new Error(`comptes_a_prevenir: ${error.code ?? "echec"}`);
      return identifiants(data);
    },

    async poserEcheance(utilisatriceId, preavisMois) {
      const { data, error } = await borne(
        supabase.rpc("poser_echeance_suppression", {
          p_utilisatrice_id: utilisatriceId,
          p_preavis_mois: preavisMois,
        }),
        "poser_echeance_suppression",
      );
      if (error) throw new Error(`poser_echeance_suppression: ${error.code ?? "echec"}`);
      return data === true;
    },

    async comptesAEffacer(max) {
      const { data, error } = await borne(
        supabase.rpc("comptes_a_effacer", { p_max: max }),
        "comptes_a_effacer",
      );
      if (error) throw new Error(`comptes_a_effacer: ${error.code ?? "echec"}`);
      return identifiants(data);
    },

    async trancher(utilisatriceId, e) {
      const { data, error } = await borne(
        supabase.rpc("trancher_echeance_suppression", {
          p_utilisatrice_id: utilisatriceId,
          p_inactivite_mois: e.inactiviteMois,
          p_preavis_mois: e.preavisMois,
          p_fenetre_pitr_jours: e.fenetrePitrJours,
        }),
        "trancher_echeance",
      );
      if (error) throw new Error(`trancher_echeance: ${error.code ?? "echec"}`);
      // ⚠️ UNE RÉPONSE QU'ON NE COMPREND PAS N'EST PAS « effacee ». Le repli le moins affirmatif est
      // `ignoree` : il ne prétend ni qu'on a supprimé, ni qu'on a gracié.
      return issueRecevable(data) ? data : "ignoree";
    },

    async purgerJournal(jours) {
      const { data, error } = await borne(
        supabase.rpc("purger_journal_ordonnanceur", { p_jours: jours }),
        "purger_journal",
      );
      if (error) throw new Error(`purger_journal: ${error.code ?? "echec"}`);
      return typeof data === "number" ? data : 0;
    },
  };
}
