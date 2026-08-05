import "server-only";
import { createSupabaseAdminClient } from "@/lib/data/supabase/admin";
import type { MateriauSynthese } from "@/lib/domain/synthese";

/**
 * Story 4.9 — le dépôt de la synthèse. Comme celui de l'ordonnanceur, il tourne sous `service_role` : le
 * job n'a pas de session, donc pas d'`auth.uid()`, donc aucune RLS ne peut le porter. C'est précisément
 * pourquoi les quatre conditions d'éligibilité (premium, consentement art. 9 vivant, pas de barrière
 * minorité, quelque chose à dire) sont réunies DANS la fonction SQL et pas ici : sous `service_role`,
 * une garde écrite en TypeScript n'est plus une garde, c'est une politesse.
 *
 * Ce dépôt touche du CONTENU art. 9 (le journal, les faits, la synthèse) — le seul de ce genre à passer
 * par `service_role`. L'exception est bornée par construction : il n'expose aucune méthode capable de
 * lire le contenu d'une utilisatrice arbitraire pour le rendre à quelqu'un d'autre. Ce qui entre va au
 * modèle ; ce qui sort va dans SA ligne à elle.
 *
 * Les erreurs ne portent que le code Postgres — jamais un message qui aurait pu ramasser un verbatim
 * au passage (NFR-022), même leçon qu'en 4.8.
 */

export type MotifNotification = "synthese_prete";

export interface DepotSynthese {
  /** Les utilisatrices à synthétiser cette semaine, les plus longtemps servies en premier. */
  candidates(semaine: string, limite: number): Promise<readonly string[]>;
  materiau(utilisatriceId: string, plafondEntrees: number): Promise<MateriauSynthese>;
  /** `false` si une synthèse existait déjà pour cette semaine — donc rien de neuf, donc pas de courriel. */
  enregistrer(
    utilisatriceId: string,
    semaine: string,
    debut: string,
    fin: string,
    contenu: string,
    tronquee: boolean,
  ): Promise<boolean>;
  /** `true` si le canal est réservé et l'envoi autorisé. Réserve AVANT d'envoyer, jamais après. */
  reserverNotification(
    utilisatriceId: string,
    motif: MotifNotification,
    cle: string,
    plafondHeures: number,
  ): Promise<boolean>;
  /** L'adresse vit dans `auth.users`, jamais recopiée dans une table `public`. */
  adresse(utilisatriceId: string): Promise<string | null>;
}

export function creerDepotSynthese(): DepotSynthese {
  const supabase = createSupabaseAdminClient();

  return {
    async candidates(semaine, limite): Promise<readonly string[]> {
      const { data, error } = await supabase.rpc("utilisatrices_a_synthetiser", {
        p_semaine: semaine,
        p_limite: limite,
      });
      if (error) throw new Error(`utilisatrices_a_synthetiser: ${error.code ?? "echec"}`);
      return Array.isArray(data) ? (data as string[]) : [];
    },

    async materiau(utilisatriceId, plafondEntrees): Promise<MateriauSynthese> {
      const { data, error } = await supabase.rpc("materiau_synthese", {
        p_utilisatrice: utilisatriceId,
        p_plafond_entrees: plafondEntrees,
      });
      if (error) throw new Error(`materiau_synthese: ${error.code ?? "echec"}`);
      const brut = (data ?? {}) as Partial<MateriauSynthese>;
      // Le repli va vers le VIDE, jamais vers un matériau partiel : sans entrées, `aQuelqueChoseADire`
      // dit non et rien ne se produit. Un matériau à moitié lu produirait une synthèse à moitié fausse.
      return {
        depuis: brut.depuis ?? null,
        jusqu_a: brut.jusqu_a ?? new Date().toISOString(),
        total: brut.total ?? 0,
        tronquee: brut.tronquee ?? false,
        entrees: brut.entrees ?? [],
        faits: brut.faits ?? [],
      };
    },

    async enregistrer(utilisatriceId, semaine, debut, fin, contenu, tronquee): Promise<boolean> {
      const { data, error } = await supabase.rpc("enregistrer_synthese", {
        p_utilisatrice: utilisatriceId,
        p_semaine: semaine,
        p_debut: debut,
        p_fin: fin,
        p_contenu: contenu,
        p_tronquee: tronquee,
      });
      if (error) throw new Error(`enregistrer_synthese: ${error.code ?? "echec"}`);
      return data === true;
    },

    async reserverNotification(utilisatriceId, motif, cle, plafondHeures): Promise<boolean> {
      const { data, error } = await supabase.rpc("reserver_notification", {
        p_utilisatrice: utilisatriceId,
        p_motif: motif,
        p_cle: cle,
        p_plafond_heures: plafondHeures,
      });
      if (error) throw new Error(`reserver_notification: ${error.code ?? "echec"}`);
      // Dans le doute : NE PAS envoyer. Un courriel de trop est irrattrapable ; un courriel de moins se
      // rattrape à la prochaine ouverture de l'app, où la synthèse l'attend de toute façon.
      return data === true;
    },

    async adresse(utilisatriceId): Promise<string | null> {
      const { data, error } = await supabase.auth.admin.getUserById(utilisatriceId);
      if (error) return null;
      return data.user?.email ?? null;
    },
  };
}
