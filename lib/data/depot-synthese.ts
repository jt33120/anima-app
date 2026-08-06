import "server-only";
import { createSupabaseAdminClient } from "@/lib/data/supabase/admin";
import { creerDepotCanalCourriel, type DepotCanalCourriel } from "@/lib/data/depot-canal-courriel";
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

/**
 * ⚠️ `MotifNotification` A DISPARU (Story 4.10). C'était un SECOND ensemble fermé de motifs, en face de
 * `MotifCourriel` (`lib/courriel/port.ts`) — deux listes qui devaient rester d'accord sans qu'aucune
 * garde ne le vérifie. Le canal n'a plus qu'une définition, et elle vit là où elle décide de quelque
 * chose : dans la signature du port.
 */
export interface DepotSynthese extends DepotCanalCourriel {
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
  /**
   * Story 4.10 (D4) — LES SYNTHÈSES ÉCRITES MAIS JAMAIS ANNONCÉES, dans la fenêtre récente.
   *
   * C'est ce qui rend l'annonce RETENTABLE indépendamment de la production. Avant, `notifier()` n'était
   * tentée que dans le tour où la synthèse venait d'être écrite : refusée là (plafond, canal non
   * configuré, panne réseau), elle était perdue DÉFINITIVEMENT — la cadence retient la personne sept
   * jours, et la synthèse existant déjà, `enregistrer` rend `null`. C'était la contrepartie assumée du
   * per-motif de 0030 ; le passage au per-famille l'aurait rendue plus fréquente, alors on la répare.
   */
  syntheseesNonAnnoncees(limite: number, jours: number): Promise<{ utilisatriceId: string; syntheseId: string }[]>;
  /**
   * Efface les traces de notification devenues inutiles (revue T5-3). Rend le nombre de lignes
   * supprimées, ou `null` si la purge n'a pas pu s'exécuter — le silence serait pire, une rétention qui
   * échoue en douce étant indistinguable d'une rétention qui n'existe pas.
   */
  purgerNotifications(jours: number): Promise<number | null>;
}

export function creerDepotSynthese(): DepotSynthese {
  const supabase = createSupabaseAdminClient();

  return {
    // Le canal courriel est COMPOSÉ, pas recopié (Story 4.10). Le rappel d'échéance utilise exactement
    // les mêmes trois méthodes ; en garder deux exemplaires aurait laissé la garde de désabonnement de
    // 0034 dans un seul des deux, sans que rien ne le dise.
    ...creerDepotCanalCourriel(),
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

    async syntheseesNonAnnoncees(limite, jours): Promise<{ utilisatriceId: string; syntheseId: string }[]> {
      const { data, error } = await supabase.rpc("syntheses_non_annoncees", {
        p_limite: limite,
        p_jours: jours,
      });
      // Le RATTRAPAGE n'a pas le droit de faire échouer le job : il est un bonus. Une lecture en panne
      // rend une liste vide — on retentera demain, ce qui est exactement ce que ce mécanisme fait déjà.
      if (error) return [];
      return (Array.isArray(data) ? data : []).map((r: Record<string, unknown>) => ({
        utilisatriceId: r.utilisatrice_id as string,
        syntheseId: r.synthese_id as string,
      }));
    },

    async purgerNotifications(jours): Promise<number | null> {
      const { data, error } = await supabase.rpc("purger_notifications_envoyees", { p_jours: jours });
      if (error) return null;
      return typeof data === "number" ? data : null;
    },
  };
}
