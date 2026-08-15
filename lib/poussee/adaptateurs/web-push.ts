import "server-only";
import { avecDelai } from "@/lib/domain/delai";
import { enteteVapid, type ClesVapid } from "@/lib/poussee/vapid";
import type { AbonnementPoussee, MotifPoussee, PortPoussee, VerdictPoussee } from "@/lib/poussee/port";

/**
 * L'ADAPTATEUR WEB PUSH (RFC 8030, Story 6.2). Le seul endroit du dépôt qui parle à un service de
 * poussée — patron d'`adaptateurs/resend.ts`.
 *
 * ── UN POST DE ZÉRO OCTET ────────────────────────────────────────────────────────────────────────────
 *
 * Décision D1 : pas de charge utile, donc pas de chiffrement aes128gcm, donc pas de `Content-Encoding`
 * ni de `Crypto-Key`. Trois en-têtes suffisent : `Authorization` (VAPID), `TTL`, `Urgency`.
 *
 * `p256dh` et `auth` de l'abonnement ne servent donc PAS ici. Ils sont stockés quand même, et ce n'est
 * pas de la négligence : ce sont les clés de chiffrement de l'abonnée, et les redemander au navigateur
 * exigerait qu'elle rouvre l'application. Le jour où un second motif arrive (6.3) et où le transport
 * doit porter quelque chose, elles seront là.
 */

/**
 * Combien de temps le service garde la poussée si l'appareil est éteint.
 *
 * ⚠️ **Quatre heures, et surtout pas vingt-quatre.** Le socle est une manifestation quotidienne à une
 * heure choisie : une poussée gardée un jour entier se délivrerait à n'importe quelle heure du
 * lendemain — y compris la nuit — et « l'heure choisie » perdrait tout son sens. Un téléphone resté
 * éteint quatre heures a manqué sa journée, et l'AC3 dit qu'on ne rattrape rien.
 */
export const TTL_S = 4 * 3_600;

/**
 * Le délai d'un POST, borné ICI.
 *
 * ⚠️ Le budget d'un job ne peut pas être plus court que la plus longue opération qu'il contient — la
 * leçon de la revue 4.10, où l'adaptateur Resend portait 10 s pour un job qui en avait 8. Le job du
 * socle en a dix, et il pousse pour plusieurs appareils par personne : trois secondes.
 */
export const DELAI_POUSSEE_MS = 3_000;

export function creerAdaptateurWebPush(cles: ClesVapid): PortPoussee {
  return {
    estConfigure: () => true,

    async reveiller(abonnement: AbonnementPoussee, motif: MotifPoussee): Promise<VerdictPoussee> {
      // ⚠️ `motif` n'a AUCUN effet sur la requête, et ce n'est pas un oubli : tant que
      // `MOTIFS_POUSSEE` n'a qu'un membre, le service worker sait quoi afficher sans qu'on le lui
      // dise. Le paramètre existe pour que la SIGNATURE soit déjà juste le jour du second motif —
      // `tests/poussee-architecture.test.ts` rougit à cet instant-là. On le consomme donc ici, plutôt
      // que de le préfixer d'un souligné : un `_motif` se supprime au premier ménage, et la story 6.3
      // devrait alors rouvrir le contrat au lieu de simplement le remplir.
      void motif;
      try {
        const entete = await enteteVapid(cles, abonnement.endpoint, new Date());
        const reponse = await avecDelai(
          fetch(abonnement.endpoint, {
            method: "POST",
            headers: {
              Authorization: entete,
              TTL: String(TTL_S),
              // `low` : le service peut regrouper les livraisons pour économiser la batterie. C'est
              // exactement ce qu'on veut d'un rythme qui n'exige rien.
              Urgency: "low",
              "Content-Length": "0",
            },
          }),
          DELAI_POUSSEE_MS,
          "poussee_timeout",
        );

        // 404/410 : l'abonnement n'existe plus (désinstallation, permission révoquée, navigateur
        // réinitialisé). C'est le SEUL cas où l'on supprime — voir `VerdictPoussee`.
        if (reponse.status === 404 || reponse.status === 410) return "endpoint_mort";
        // 2xx, et pas seulement 201 : les services répondent 201 en pratique, mais 200 et 202 sont
        // conformes. Traiter un 202 comme un refus ferait rejouer une poussée déjà acceptée.
        if (reponse.ok) return "poussee";
        return "refuse";
      } catch {
        // ⚠️ On n'attrape PAS pour cacher : `reveiller` promet de ne pas lever, et un délai dépassé,
        // un DNS mort ou un TLS refusé sont tous « on ne sait pas si c'est parti ». La réponse la
        // moins affirmative est `refuse` — jamais `endpoint_mort`, qui supprimerait un abonnement
        // vivant sur un hoquet réseau.
        return "refuse";
      }
    },
  };
}
