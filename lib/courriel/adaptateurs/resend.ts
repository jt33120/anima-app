import "server-only";
import { avecDelai } from "@/lib/domain/delai";
import { GABARITS, EXPEDITEUR_NOM } from "@/lib/courriel/gabarits";
import type { PortCourriel, MotifCourriel } from "@/lib/courriel/port";

/**
 * Story 4.9 — l'adaptateur RESEND. Le seul fichier du dépôt qui parle à un fournisseur d'envoi (AD-3).
 *
 * Appel HTTP direct plutôt que le SDK : la charge utile tient en quatre champs, et n'ajouter aucune
 * dépendance sur un chemin qui manipule une adresse de courriel est le meilleur rapport sûreté/effort
 * qu'on puisse obtenir ici. Une dépendance de moins est une surface d'approvisionnement de moins.
 *
 * Ce qui part : une adresse, un objet constant, un corps constant. Rien d'interpolé — le gabarit est lu
 * dans une table figée, jamais construit.
 */

const API = "https://api.resend.com/emails";
const DELAI_MS = 10_000;

export function creerPortResend(cle: string, expediteur: string): PortCourriel {
  return {
    estConfigure: () => true,

    async envoyer(destinataire: string, motif: MotifCourriel): Promise<void> {
      const gabarit = GABARITS[motif];
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
