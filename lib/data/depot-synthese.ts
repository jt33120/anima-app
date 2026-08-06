import "server-only";
import { createSupabaseAdminClient } from "@/lib/data/supabase/admin";
import type { MateriauSynthese } from "@/lib/domain/synthese";

/**
 * Story 4.9 — le dépôt de la synthèse. Comme celui de l'ordonnanceur, il tourne sous `service_role` : le
 * job n'a pas de session, donc pas d'`auth.uid()`, donc aucune RLS ne peut le porter. C'est précisément
 * pourquoi les conditions d'éligibilité (premium, consentement art. 9 vivant, pas de barrière minorité,
 * aucune détresse en cours) sont réunies DANS la base et pas ici : sous `service_role`, une garde écrite
 * en TypeScript n'est plus une garde, c'est une politesse.
 *
 * Revue 4.9 (T2-2) : elles ne vivent plus seulement dans la fonction de SÉLECTION mais dans
 * `eligible_a_synthese`, qu'appellent aussi celle qui LIT le journal et celle qui ÉCRIT la synthèse.
 * Appelées directement, les deux précédentes ne gardaient rien — `materiau_synthese` rendait le verbatim
 * d'une utilisatrice ayant révoqué son consentement.
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
  /** Les utilisatrices à servir maintenant, les plus longtemps en attente d'abord. */
  candidates(job: string, limite: number): Promise<readonly string[]>;
  /**
   * Combien de personnes le disjoncteur a écartées — trois échecs en sept jours. Le job s'en sert pour
   * lever UN incident : sans ça, l'écartement serait silencieux, et « cette personne n'a plus de
   * synthèse » est précisément ce qu'il faut savoir. C'est aussi le seul signal fiable dans un produit
   * qui compte une poignée d'utilisatrices, où « tout le lot a échoué » ne veut rien dire.
   */
  personnesEnEchecRepete(job: string): Promise<number>;
  materiau(utilisatriceId: string, plafondEntrees: number, plafondOctets: number): Promise<MateriauSynthese>;
  /**
   * L'identifiant de la synthèse écrite, ou `null` si rien ne l'a été — la tranche existait déjà, ou
   * l'éligibilité a changé pendant la production. Rendre l'identifiant plutôt qu'un booléen donne à
   * l'annonce une clé d'idempotence EXACTE : une synthèse, une annonce, et le lien entre les deux est
   * la ligne elle-même.
   */
  enregistrer(
    utilisatriceId: string,
    debut: string,
    fin: string,
    contenu: string,
    tronquee: boolean,
  ): Promise<string | null>;
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
    async candidates(job, limite): Promise<readonly string[]> {
      const { data, error } = await supabase.rpc("utilisatrices_a_synthetiser", {
        p_job: job,
        p_limite: limite,
      });
      if (error) throw new Error(`utilisatrices_a_synthetiser: ${error.code ?? "echec"}`);
      return Array.isArray(data) ? (data as string[]) : [];
    },

    async personnesEnEchecRepete(job): Promise<number> {
      const { data, error } = await supabase.rpc("personnes_en_echec_repete", { p_job: job });
      // Dans le doute : ZÉRO. Un incident levé sur une lecture ratée serait un incident qui parle d'une
      // panne de lecture en prétendant parler d'utilisatrices bloquées.
      if (error) return 0;
      return typeof data === "number" ? data : 0;
    },

    async materiau(utilisatriceId, plafondEntrees, plafondOctets): Promise<MateriauSynthese> {
      const { data, error } = await supabase.rpc("materiau_synthese", {
        p_utilisatrice: utilisatriceId,
        p_plafond_entrees: plafondEntrees,
        p_plafond_octets: plafondOctets,
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

    async enregistrer(utilisatriceId, debut, fin, contenu, tronquee): Promise<string | null> {
      const { data, error } = await supabase.rpc("enregistrer_synthese", {
        p_utilisatrice: utilisatriceId,
        p_debut: debut,
        p_fin: fin,
        p_contenu: contenu,
        p_tronquee: tronquee,
      });
      if (error) throw new Error(`enregistrer_synthese: ${error.code ?? "echec"}`);
      return typeof data === "string" && data.length > 0 ? data : null;
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
