import "server-only";
import { createSupabaseAdminClient } from "@/lib/data/supabase/admin";
import type { AbonnementPoussee, MotifPoussee } from "@/lib/poussee/port";

/**
 * Story 6.2 — LE DÉPÔT DU CANAL DE POUSSÉE. Jumeau de `depot-canal-courriel.ts`, et DÉLIBÉRÉMENT
 * séparé de lui.
 *
 * ── POURQUOI DEUX DÉPÔTS PLUTÔT QUE `MotifCourriel` ÉLARGI ────────────────────────────────────────────
 *
 * La tentation est nette : les deux appellent la MÊME RPC (`reserver_notification`), il suffirait
 * d'ajouter `socle_quotidien` à `MotifCourriel` et de tout faire passer par le dépôt existant.
 *
 * Ce serait rouvrir exactement le trou que la 3.5 avait refermé en séparant `MotifLegal` de
 * `MotifCourriel`. `PortCourriel.envoyer` accepterait alors un motif de socle — et rien n'empêcherait
 * plus d'ENVOYER PAR COURRIEL, tous les jours, une manifestation quotidienne conçue pour ne rien
 * exiger. Le tronc gratuit deviendrait un abonnement à une lettre quotidienne, et le geste qui l'a
 * produit tiendrait en une ligne d'union.
 *
 * Les deux régimes sont séparés PAR LE TYPE, pas par une consigne : `reserverPoussee` n'accepte pas un
 * `MotifCourriel`, `PortCourriel.envoyer` n'accepte pas un `MotifPoussee`. Que la RPC sous-jacente soit
 * la même est un détail d'implémentation — et c'est même l'intérêt : le plafond par famille (0036) les
 * compte ensemble, donc ils ne peuvent pas se contourner l'un l'autre.
 *
 * ── AUCUN CONTENU NE PASSE PAR ICI ───────────────────────────────────────────────────────────────────
 *
 * Aucune méthode ne prend ni ne rend un texte affichable. `endpoints` rend trois identifiants de
 * transport, contraints de forme en base (0053) ; le reste est un motif, une clé de jour, un booléen.
 */

export interface DepotPoussee {
  /** Les appareils d'une personne. Vide = elle s'est désabonnée entre la sélection et maintenant. */
  endpoints(utilisatriceId: string): Promise<AbonnementPoussee[]>;
  /**
   * `true` si le canal est réservé et la poussée autorisée. Réserve AVANT de pousser, jamais après :
   * entre « je pousse » et « je note que j'ai poussé » il y a une fenêtre, et cette fenêtre s'appelle
   * « une deuxième notification ».
   */
  reserverPoussee(
    utilisatriceId: string,
    motif: MotifPoussee,
    cle: string,
    plafondHeures: number,
  ): Promise<boolean>;
  /**
   * REND une réservation qui n'a réveillé AUCUN appareil (patron de la revue 4.10).
   *
   * ⚠️ Le bénéfice de RETENTE est ici beaucoup plus mince qu'au rappel d'échéance : la sélection exige
   * `heure = heure courante`, donc la personne ne repassera plus aujourd'hui — sauf si le tick lui-même
   * est rejoué dans la même heure, ce qui est précisément le chemin de reprise de l'ordonnanceur.
   *
   * Le bénéfice d'HONNÊTETÉ, lui, est entier et suffirait seul : `notification_envoyee` est une table
   * d'audit. Y laisser une ligne alors que rien n'est parti, c'est y écrire un fait faux.
   */
  libererPoussee(utilisatriceId: string, motif: MotifPoussee, cle: string): Promise<void>;
  /** Supprime un abonnement dont le service a répondu 404/410. Ne lève pas : voir l'implémentation. */
  oublierEndpoint(endpoint: string): Promise<void>;
}

export function creerDepotPoussee(): DepotPoussee {
  const supabase = createSupabaseAdminClient();

  return {
    async endpoints(utilisatriceId): Promise<AbonnementPoussee[]> {
      const { data, error } = await supabase.rpc("endpoints_poussee", { p_utilisatrice: utilisatriceId });
      if (error) throw new Error(`endpoints_poussee: ${error.code ?? "echec"}`);
      return (Array.isArray(data) ? data : []).map((r: Record<string, unknown>) => ({
        endpoint: r.endpoint as string,
        p256dh: r.cle_p256dh as string,
        auth: r.cle_auth as string,
      }));
    },

    async reserverPoussee(utilisatriceId, motif, cle, plafondHeures): Promise<boolean> {
      const { data, error } = await supabase.rpc("reserver_notification", {
        p_utilisatrice: utilisatriceId,
        p_motif: motif,
        p_cle: cle,
        p_plafond_heures: plafondHeures,
      });
      if (error) throw new Error(`reserver_notification: ${error.code ?? "echec"}`);
      // `data === true` et non `data !== false` : « je n'ai pas compris la réponse » n'est pas une
      // autorisation. Dans le doute, NE PAS pousser — une notification de trop est irrattrapable, une
      // de moins se rattrape à la prochaine ouverture, où le socle attend de toute façon (AC4).
      return data === true;
    },

    async libererPoussee(utilisatriceId, motif, cle): Promise<void> {
      // Un échec ICI n'a rien à faire échouer : on est déjà sur le chemin d'une poussée ratée. La clé
      // reste alors occupée — c'est le comportement d'avant ce correctif, donc jamais pire.
      await supabase.rpc("liberer_notification", {
        p_utilisatrice: utilisatriceId,
        p_motif: motif,
        p_cle: cle,
      });
    },

    async oublierEndpoint(endpoint): Promise<void> {
      // Ne lève pas, pour la même raison : on est sur le chemin d'un 410, et faire échouer le tour de
      // boucle priverait les personnes suivantes de leur journée pour un ménage qui peut attendre.
      await supabase.rpc("oublier_endpoint_poussee", { p_endpoint: endpoint });
    },
  };
}
