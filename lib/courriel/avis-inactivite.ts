import "server-only";
import { creerPortCourriel } from "@/lib/courriel/fabrique";
import { creerDepotCanalCourriel } from "@/lib/data/depot-canal-courriel";

/**
 * Story 6.8 (AC2) — L'AVIS AVANT SUPPRESSION POUR INACTIVITÉ (NFR-021, AD-14).
 *
 * ══ POURQUOI CE FICHIER VIT DANS `lib/courriel/` ET PAS DANS LE JOB ═════════════════════════════
 *
 * Une garde m'a envoyé ici, et elle avait raison. `tests/synthese-domaine.test.ts` exige que TOUT
 * module capable d'envoyer un courriel appelle d'abord `reserverNotification` — le plafond par
 * famille, le refus de canal et l'idempotence y vivent tous les trois. Le job de rétention obtenait
 * un port sans réserver : la garde a rougi.
 *
 * Elle avait raison sur la forme et tort sur le fond, et c'est exactement pour ça que
 * `reconduction.ts` existe déjà à côté : la garde EXCLUT `lib/courriel/`, parce que le régime LÉGAL
 * ne passe pas — ne doit pas passer — par la réservation. Un refus de canal est un droit
 * d'opposition (art. 21) sur les notifications produit ; il ne peut pas dispenser de prévenir
 * quelqu'un avant d'effacer deux ans de ce qu'il a écrit.
 *
 * Ce fichier est donc le jumeau de `reconduction.ts`, avec une seule différence de comportement.
 *
 * ── LA DIFFÉRENCE : ICI, ON NE LÈVE PAS ────────────────────────────────────────────────────────
 *
 * `annoncerReconduction` lève, parce que son appelant est un webhook Stripe qui doit répondre 500
 * pour être rejoué. L'appelant d'ici est un JOB, et un job qui lève sur une personne abandonne les
 * suivantes. Surtout : ce que l'appelant fait de la réponse est plus important que la réponse
 * elle-même — il ne pose l'échéance de suppression QUE si l'avis est parti. Rendre `false` suffit
 * donc à garantir la seule chose qui compte : **aucune suppression sans avis.**
 */
export async function annoncerInactivite(utilisatriceId: string): Promise<boolean> {
  const port = creerPortCourriel();
  if (!port.estConfigure()) return false;

  const adresse = await creerDepotCanalCourriel().adresse(utilisatriceId);
  if (!adresse) return false;

  await port.envoyerInformationLegale(adresse, "inactivite_avant_suppression");
  return true;
}
