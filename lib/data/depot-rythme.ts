import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  APAISEMENT_JOURS,
  FENETRE_JOURS,
  mesurerRythme,
  seuilFranchi,
  type MesureRythme,
} from "@/lib/domain/rythme-pause";

/**
 * depot-rythme.ts — LA MESURE DU RYTHME (Story 6.4, T3 ; FR-036).
 *
 * ── CE QUE CETTE REQUÊTE NE DEMANDE PAS ────────────────────────────────────────────────────────
 *
 * `select("cree_le")`. Pas `contenu`, pas `id`, pas `role` — le rôle est un FILTRE, pas une colonne
 * demandée. Compter des dates n'a aucun besoin de voir ce qui a été écrit, et le verbatim est de
 * l'art. 9 : la minimisation n'est pas ici une précaution de style, c'est la seule raison pour
 * laquelle une contre-métrique de dépendance a le droit d'exister.
 *
 * ── LA MARGE D'UN JOUR EST DÉLIBÉRÉE ───────────────────────────────────────────────────────────
 *
 * ⚠️ La requête remonte HUIT jours alors que la fenêtre en fait sept, et ce n'est pas une
 * approximation : c'est pour que la borne exacte soit décidée en UN SEUL endroit, le domaine. Deux
 * filtres identiques — un ici, un dans `mesurerRythme` — se couvriraient l'un l'autre, et le mutant
 * de l'un survivrait grâce à l'autre. C'est le piège des défenses redondantes, déjà payé dans ce
 * dépôt, et il se referme en faisant diverger volontairement les deux bornes.
 *
 * ── LE PLAFOND DE LIGNES, ET LE SENS DE SON ERREUR ─────────────────────────────────────────────
 *
 * Une lecture non bornée sur une table qui grossit à chaque message est une bombe à retardement. Le
 * plafond est large (quelqu'un qui écrirait plus de deux mille fois en huit jours n'est plus dans le
 * périmètre de cette mesure) et, s'il mordait, il tronquerait les entrées les PLUS ANCIENNES — donc
 * il SOUS-estimerait. C'est la bonne direction : le seuil devient plus dur à franchir, jamais plus
 * facile. Sur-estimer ferait dire au produit « tu viens trop » à quelqu'un qui ne vient pas trop.
 *
 * ── AUCUNE GARDE D'ÉTAT ICI, ET C'EST LE MÊME PATRON QUE `depot-fil` ───────────────────────────
 *
 * La RLS d'`entree_journal` (0016) borne à la propriétaire ; l'appelante (`chargerOuverture`, sous
 * JWT, après la garde d'onboarding d'`app/page.tsx`) porte l'état de compte. La garde de DÉTRESSE,
 * elle, n'est pas ici non plus — elle vit dans `reserver_pause_rythme` (0055), en SQL, parce qu'une
 * garde qui ne vivrait qu'en TypeScript ne garderait rien.
 */

/** Large à dessein — voir l'en-tête pour le sens de son erreur. */
export const RYTHME_LIGNES_MAX = 2000;

/** La marge de la requête, en jours. Volontairement > `FENETRE_JOURS` — voir l'en-tête. */
export const RYTHME_MARGE_JOURS = FENETRE_JOURS + 1;

export interface DepotRythme {
  /** Mesure le rythme des sept derniers jours à partir des seuls horodatages d'écriture. */
  mesurer(): Promise<MesureRythme>;
  /**
   * Anam a-t-elle le droit de proposer une pause MAINTENANT ? La réservation EST la décision : un
   * `true` a déjà écrit la ligne, et deux onglets ne peuvent pas obtenir `true` tous les deux.
   */
  reserver(mesure: MesureRythme): Promise<boolean>;
}

export function creerDepotRythme(
  supabase: SupabaseClient,
  maintenant: Date = new Date(),
): DepotRythme {
  return {
    async mesurer(): Promise<MesureRythme> {
      const depuis = new Date(
        maintenant.getTime() - RYTHME_MARGE_JOURS * 24 * 3_600_000,
      ).toISOString();

      const { data, error } = await supabase
        .from("entree_journal")
        // ⚠️ UNE SEULE COLONNE, ET C'EST UNE DATE. Voir l'en-tête.
        .select("cree_le")
        .eq("role", "utilisatrice")
        .gte("cree_le", depuis)
        .order("cree_le", { ascending: false })
        .limit(RYTHME_LIGNES_MAX);

      if (error) throw new Error(`rythme: ${error.code ?? "echec"}`);
      if (!Array.isArray(data)) return { seances: 0, minutes: 0 };

      const horodatages: number[] = [];
      for (const l of data as Array<Record<string, unknown>>) {
        if (typeof l?.cree_le !== "string") continue;
        const t = Date.parse(l.cree_le);
        // Une date illisible est ÉCARTÉE, jamais remplacée par `Date.now()` ni par 0 : l'une
        // fabriquerait une séance qui n'a pas eu lieu, l'autre une grappe vieille de 1970 dont le
        // silence gonflerait le compte de séances. Dans les deux cas on inventerait du rythme.
        if (Number.isFinite(t)) horodatages.push(t);
      }

      // ⚠️ LE DOMAINE APPLIQUE LA FENÊTRE EXACTE. Ce dépôt n'a filtré qu'à huit jours — voir l'en-tête.
      return mesurerRythme(horodatages, maintenant.getTime());
    },

    async reserver(mesure: MesureRythme): Promise<boolean> {
      // Ceinture ET bretelles assumées : le seuil est déjà éprouvé par l'appelante, mais un dépôt
      // qui réserverait sur une mesure non franchie écrirait une ligne de journalisation fausse —
      // et cette ligne-là sert la revue produit, donc elle doit rester vraie.
      if (!seuilFranchi(mesure)) return false;

      const { data, error } = await supabase.rpc("reserver_pause_rythme", {
        p_seances: mesure.seances,
        p_minutes: mesure.minutes,
        p_apaisement_jours: APAISEMENT_JOURS,
      });

      // Direction du doute : ON SE TAIT. Une réponse qu'on ne comprend pas n'est pas un feu vert —
      // et se taire à tort ne coûte qu'un mois de report, tandis que parler à tort insère une ligne
      // de revue produit qui ne correspond à aucune parole réellement dite.
      if (error) throw new Error(`pause: ${error.code ?? "echec"}`);
      return data === true;
    },
  };
}
