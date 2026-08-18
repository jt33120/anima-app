import "server-only";
import { createSupabaseAdminClient } from "./supabase/admin";
import { resilierEnFinDePeriode } from "@/lib/stripe/resiliation";

/**
 * arret-facturation.ts — ON N'EFFACE PAS UN COMPTE DONT LA CARTE VA ENCORE ÊTRE DÉBITÉE
 * (revue adversariale du 2026-08-18, R1 · RGPD art. 17 · FR-060).
 *
 * ══ CE MODULE EXISTE PARCE QUE LA GARDE A ÉTÉ OUBLIÉE UNE FOIS ════════════════════════════════
 *
 * La revue du 2026-08-11 (M7) avait trouvé le défaut sur le chemin de RÉVOCATION, et le correctif
 * y a été écrit à la main, dans l'appelant. Sa propre note disait :
 *
 *     « C'est le seul défaut de la revue qui prélève de l'argent à quelqu'un
 *       qui a explicitement quitté le produit. »
 *
 * L'Epic 6 a ensuite écrit un SECOND chemin d'effacement — « Tout effacer », sur `/mes-donnees` —
 * et la garde n'a pas suivi. C'est pourtant celui qu'emprunte une utilisatrice installée, donc
 * précisément celle qui a un abonnement.
 *
 * Une garde recopiée dans l'appelant est une garde qu'on oubliera : c'est la leçon 1.4, écrite dans
 * `etat-onboarding.ts` — « une barrière oubliée dans un seul chemin suffit à laisser passer un
 * mineur ». Elle vit donc ICI, en un seul endroit, et `tests/aucun-effacement-ne-laisse-courir-la-facture`
 * refuse tout module capable d'effacer un compte qui ne l'appelle pas.
 *
 * ══ CE QUI ARRIVAIT, ET POURQUOI RIEN NE POUVAIT LE DIRE ══════════════════════════════════════
 *
 * La cascade efface `abonnement` en base et NE TOUCHE PAS À STRIPE. La souscription reste `active`,
 * `cancel_at_period_end = false`. À l'échéance, 69 € partent de la carte de quelqu'un qui n'a plus
 * de compte.
 *
 * Et le produit est structurellement incapable de s'en apercevoir : `reserver_information_reconduction`
 * rend `false` sur un compte absent (0044), donc le courriel de l'art. L215-1 ne part pas ;
 * `traiter_evenement_abonnement` rend `compte_absent`, donc aucune projection n'est écrite. Plus de
 * compte, plus de `/abonnement`, plus de session : le seul recours est une opposition bancaire.
 *
 * ══ ELLE LÈVE, ET C'EST LE POINT ══════════════════════════════════════════════════════════════
 *
 * En cas d'échec — Stripe injoignable, ou lecture impossible — cette fonction LÈVE, et l'appelant
 * n'efface pas. Le droit à l'effacement supporte un délai raisonnable (art. 17) ; un débit sur un
 * compte disparu, lui, est irréversible depuis le produit. Entre les deux, on suspend, on le dit,
 * et elle peut réessayer. C'est aussi la doctrine déjà écrite pour les chemins RGPD : jamais
 * d'effacement silencieux (acquis de la revue 1.5).
 *
 * Ne pas savoir s'il existe un abonnement n'est pas savoir qu'il n'y en a pas : une panne de lecture
 * lève aussi. Le repli penche du côté qui ne débite personne (AD-15).
 *
 * ⚠️ LECTURE SOUS `service_role`, ET C'EST LÉGITIME. `abonnement` est une table NON art. 9 (tâche
 * système, AD-12) ; surtout, ce chemin sert aussi la révocation, où la session ne peut plus rien lire
 * de ce qui est art. 9. Le compte visé est passé en paramètre, jamais déduit d'un `auth.uid()` que
 * ce contexte n'a pas toujours.
 */
export async function arreterFacturationAvantEffacement(utilisatriceId: string): Promise<void> {
  const admin = createSupabaseAdminClient();

  const { data } = await admin
    .from("abonnement")
    .select("stripe_subscription_id")
    .eq("utilisatrice_id", utilisatriceId)
    .maybeSingle<{ stripe_subscription_id: string | null }>();

  // Compte gratuit, ou abonnement jamais projeté : il n'y a rien à arrêter, et aucun appel n'est
  // fait. Le cas nominal ne paie donc rien — ni en latence, ni en dépendance à Stripe.
  if (!data?.stripe_subscription_id) return;

  // `cancel_at_period_end`, jamais une annulation immédiate : elle a payé l'année. Effacer son compte
  // ne lui retire pas un service déjà réglé — et de toute façon, à l'échéance, il n'y aura plus rien
  // à servir. Ce qu'on empêche est le PROCHAIN débit.
  await resilierEnFinDePeriode(data.stripe_subscription_id);
}
