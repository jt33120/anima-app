import "server-only";
import { creerPortCourriel } from "@/lib/courriel/fabrique";
import { creerDepotCanalCourriel } from "@/lib/data/depot-canal-courriel";

/**
 * Story 3.5 (AC4) — L'ENVOI DE L'INFORMATION AVANT RECONDUCTION TACITE (FR-060, art. L215-1).
 *
 * Douze lignes, et trois choses qui n'y sont PAS. Chacune serait le geste naturel ; chacune serait une
 * faute.
 *
 * 1. AUCUN APPEL À `reserverNotification`. C'est le chemin par lequel passent la synthèse et le rappel
 *    d'échéance, et il consulte `preference_courriel.refuse_le` (0034) et le plafond par famille (0036).
 *    Un refus de canal est un droit d'opposition (art. 21) sur les notifications produit ; il ne peut pas
 *    dispenser de prévenir quelqu'un avant de le débiter de 69 €. La réservation de CE chemin vit dans
 *    `reserver_information_reconduction`, qui ne regarde ni l'un ni l'autre.
 *
 * 2. AUCUN JETON DE DÉSABONNEMENT. Il n'y a rien à désabonner : le courriel repartira l'an prochain quoi
 *    qu'elle clique. Le port l'impose par le type — `envoyerInformationLegale` n'a pas de paramètre où
 *    en mettre un.
 *
 * 3. AUCUNE LIBÉRATION EN CAS D'ÉCHEC, contrairement au rappel d'échéance (4.10, `libererNotification`).
 *    Là-bas, la clé est le jour civil et l'échéance ne repasse jamais : un 5xx de Resend effaçait
 *    définitivement un rendez-vous. Ici, `invoice.upcoming` est réémis par Stripe tant que la facture
 *    n'est pas réglée, et la barrière est l'ÉCHÉANCE, pas l'événement — un rejeu ultérieur retrouvera la
 *    même échéance et sera correctement refusé. Libérer rouvrirait donc la porte à un doublon sans rien
 *    récupérer. L'échec est propagé pour que le webhook réponde 500 et que Stripe rejoue.
 *
 * L'appelant (webhook) a DÉJÀ réservé quand cette fonction est appelée : réserver puis envoyer, jamais
 * l'inverse — entre « j'envoie » et « je note que j'ai envoyé » il y a une fenêtre, et cette fenêtre
 * s'appelle « un deuxième courriel ».
 */
export async function annoncerReconduction(utilisatriceId: string): Promise<void> {
  const port = creerPortCourriel();
  // Sans configuration, on LÈVE plutôt que d'avaler : le webhook répondra 500, Stripe rejouera, et
  // `information_reconduction` porte déjà la trace — la seconde tentative sera refusée par l'échéance.
  // C'est le seul cas où la réservation reste posée sans envoi, et il est visible (500 + journal), pas
  // silencieux.
  if (!port.estConfigure()) throw new Error("courriel_non_configure");

  const adresse = await creerDepotCanalCourriel().adresse(utilisatriceId);
  if (!adresse) throw new Error("adresse_introuvable");

  await port.envoyerInformationLegale(adresse, "reconduction_a_venir");
}
