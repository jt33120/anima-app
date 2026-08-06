import "server-only";
import { createSupabaseAdminClient } from "@/lib/data/supabase/admin";
import { jetonValide, type JetonDesabonnement } from "@/lib/domain/jeton-desabonnement";
import type { MotifCourriel } from "@/lib/courriel/port";

/**
 * Story 4.10 (T5) — LE CANAL COURRIEL, en une seule définition.
 *
 * Ces trois méthodes vivaient dans `depot-synthese.ts` (4.9), et elles n'ont jamais eu quoi que ce soit
 * de propre à la synthèse : une adresse, un jeton de désabonnement, une réservation. La 4.10 ajoute un
 * SECOND job qui écrit à quelqu'un (le rappel d'échéance) — et le moment où l'on recopie trois méthodes
 * est exactement le moment où l'on fabrique une divergence : la garde de désabonnement posée en 0034
 * n'aurait été respectée que par l'un des deux appelants, et rien ne l'aurait dit.
 *
 * `depot-synthese.ts` compose désormais ce dépôt plutôt que d'en porter une copie.
 *
 * ── SOUS `service_role`, ET C'EST NÉCESSAIRE ─────────────────────────────────────────────────────────
 *
 * Les jobs n'ont pas de session, donc pas d'`auth.uid()`, donc aucune RLS ne peut les porter. C'est
 * précisément pourquoi les gardes du canal (le REFUS de désabonnement, le plafond par famille) vivent
 * dans `reserver_notification` et non chez l'appelant : sous `service_role`, une garde écrite en
 * TypeScript n'est plus une garde, c'est une politesse.
 *
 * NON-art. 9 : rien ici ne touche à du contenu. Une adresse, un uuid opaque, un motif d'énumération.
 */

export interface DepotCanalCourriel {
  /** L'adresse vit dans `auth.users`, jamais recopiée dans une table `public`. */
  adresse(utilisatriceId: string): Promise<string | null>;
  /**
   * Le jeton opaque de désabonnement, créé paresseusement au premier envoi (revue T5-2). `null` sur
   * échec de lecture : un courriel sans lien de désabonnement NE PART PAS — l'absence de sortie est ce
   * qui a rendu la première version indéfendable, et une panne de base n'est pas une raison de la
   * reproduire.
   */
  jetonDesabonnement(utilisatriceId: string): Promise<JetonDesabonnement | null>;
  /**
   * `true` si le canal est réservé et l'envoi autorisé. Réserve AVANT d'envoyer, jamais après : entre
   * « j'envoie » et « je note que j'ai envoyé » il y a une fenêtre, et cette fenêtre s'appelle « un
   * deuxième courriel ».
   */
  reserverNotification(
    utilisatriceId: string,
    motif: MotifCourriel,
    cle: string,
    plafondHeures: number,
  ): Promise<boolean>;
  /**
   * REND une réservation qui n'a RIEN envoyé (revue 4.10). À appeler quand l'envoi lève APRÈS que la
   * réservation a réussi — sans quoi la clé reste occupée alors qu'aucun courriel n'est parti.
   *
   * Décisif pour le RAPPEL D'ÉCHÉANCE et pas pour la synthèse : la clé du rappel est le jour civil, et
   * l'échéance ne repasse jamais. Sans cette libération, un seul 5xx de Resend effaçait définitivement
   * un rendez-vous qu'elle s'était fixé.
   */
  libererNotification(utilisatriceId: string, motif: MotifCourriel, cle: string): Promise<void>;
}

export function creerDepotCanalCourriel(): DepotCanalCourriel {
  const supabase = createSupabaseAdminClient();

  return {
    async adresse(utilisatriceId): Promise<string | null> {
      const { data, error } = await supabase.auth.admin.getUserById(utilisatriceId);
      if (error) return null;
      return data.user?.email ?? null;
    },

    async jetonDesabonnement(utilisatriceId): Promise<JetonDesabonnement | null> {
      const { data, error } = await supabase.rpc("jeton_courriel", { p_utilisatrice: utilisatriceId });
      if (error) return null;
      // `jetonValide` n'est pas décoratif ici : c'est la frontière où une valeur venue de la base entre
      // dans un type qui autorise à écrire dans un courriel. Elle la refuse si ce n'est pas un uuid.
      return jetonValide(typeof data === "string" ? data : null);
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
      // rattrape à la prochaine ouverture de l'app, où ce qu'il annonçait attend de toute façon.
      return data === true;
    },

    async libererNotification(utilisatriceId, motif, cle): Promise<void> {
      // Un échec ICI n'a rien à faire échouer : on est déjà sur le chemin d'un envoi raté. La clé reste
      // alors occupée — c'est le comportement d'AVANT ce correctif, donc jamais pire.
      await supabase.rpc("liberer_notification", {
        p_utilisatrice: utilisatriceId,
        p_motif: motif,
        p_cle: cle,
      });
    },
  };
}
