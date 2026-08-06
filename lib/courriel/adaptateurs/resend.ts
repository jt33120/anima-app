import "server-only";
import { avecDelai } from "@/lib/domain/delai";
import { gabaritPour, EXPEDITEUR_NOM } from "@/lib/courriel/gabarits";
import type { Origine } from "@/lib/courriel/origine";
import type { PortCourriel, MotifCourriel } from "@/lib/courriel/port";
import type { JetonDesabonnement } from "@/lib/domain/jeton-desabonnement";

/**
 * Story 4.9 — l'adaptateur RESEND. Le seul fichier du dépôt qui parle à un fournisseur d'envoi (AD-3).
 *
 * Appel HTTP direct plutôt que le SDK : la charge utile tient en cinq champs, et n'ajouter aucune
 * dépendance sur un chemin qui manipule une adresse de courriel est le meilleur rapport sûreté/effort
 * qu'on puisse obtenir ici. Une dépendance de moins est une surface d'approvisionnement de moins.
 *
 * Ce qui part : une adresse, un objet constant, un corps constant, et deux en-têtes de désabonnement.
 * Rien d'interpolé hors l'origine et le jeton, tous deux typés nominalement (cf. `gabarits.ts`).
 */

const API = "https://api.resend.com/emails";
const DELAI_MS = 10_000;

export function creerPortResend(cle: string, expediteur: string, origine: Origine): PortCourriel {
  return {
    estConfigure: () => true,

    async envoyer(
      destinataire: string,
      motif: MotifCourriel,
      jeton: JetonDesabonnement,
    ): Promise<void> {
      const gabarit = gabaritPour(motif, { origine, jeton });
      // Un motif hors de l'ensemble fermé ne peut pas arriver par le type — mais peut arriver par un
      // `as` malheureux ou une désérialisation. On refuse d'envoyer plutôt que d'envoyer un corps vide.
      if (!gabarit) throw new Error("courriel_motif_inconnu");

      const reponse = await avecDelai(
        fetch(API, {
          method: "POST",
          headers: { authorization: `Bearer ${cle}`, "content-type": "application/json" },
          body: JSON.stringify({
            from: `${EXPEDITEUR_NOM} <${expediteur}>`,
            to: [destinataire],
            subject: gabarit.objet,
            text: gabarit.texte,
            // RFC 2369 / RFC 8058 — exigés par Gmail et Yahoo depuis février 2024 pour tout expéditeur
            // en volume. Ils font apparaître un bouton « Se désabonner » À CÔTÉ DE L'EXPÉDITEUR, avant
            // même d'ouvrir le message : c'est le chemin le plus court entre « je ne veux plus » et le
            // fait que ça s'arrête. Sans eux, le geste disponible est « signaler comme spam ».
            headers: {
              "List-Unsubscribe": `<${gabarit.lienUnClic}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          }),
        }),
        DELAI_MS,
        "courriel_timeout",
      );

      // On ne lit PAS le corps de la réponse d'erreur pour le journaliser : il peut contenir l'adresse
      // que l'on vient d'envoyer, et une adresse est une donnée personnelle. Le code HTTP suffit à
      // diagnostiquer, et il ne peut rien porter (NFR-022).
      if (!reponse.ok) throw new Error(`courriel_refuse_${reponse.status}`);
    },
  };
}
