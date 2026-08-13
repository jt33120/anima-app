"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { createSupabaseAdminClient } from "@/lib/data/supabase/admin";
import { etapeOnboardingPour } from "@/app/(auth)/etat-onboarding";
import { resilierEnFinDePeriode } from "@/lib/stripe/resiliation";
import { lireAccords } from "./accords";

export type EtatConsentement = { statut: "saisie" | "erreur"; message?: string };

/**
 * « Je commence » (AC5). Re-valide CÔTÉ SERVEUR que (1) les DEUX accords sont vrais — jamais
 * confiance au client — ET (2) l'onboarding en est bien à l'étape consentement (date posée,
 * majeure), via la source de vérité partagée `etapeOnboardingPour` (anti-divergence). Puis
 * écrit la preuve SOUS la session RLS (AD-12). Idempotent (upsert sur la PK utilisatrice_id).
 */
export async function donnerConsentement(
  _prev: EtatConsentement,
  formData: FormData,
): Promise<EtatConsentement> {
  const { art9, cgu } = lireAccords(formData);
  if (!art9 || !cgu) {
    // Ne devrait pas arriver (bouton désactivé) : garde-fou serveur.
    return { statut: "erreur", message: "Coche les deux accords pour continuer." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrer");

  // Garde d'état : on n'écrit un consentement QUE si l'onboarding est à cette étape. Empêche
  // un POST direct de persister une preuve (+ « 18 ans confirmé ») pour un compte sans date
  // ou mineur — l'action est un endpoint indépendant, non protégé par le middleware.
  const etape = await etapeOnboardingPour(supabase, user.id);
  if (etape === "barre") redirect("/barriere"); // minorité détectée (1.9) : suspendu, sans signOut. Prime.
  if (etape === "mineur") {
    await supabase.auth.signOut();
    redirect("/entrer?refus=age");
  }
  if (etape === "naissance") redirect("/naissance");
  if (etape === "revoque") redirect("/consentement/revoque"); // révoquée : JAMAIS de reconquête (AC4) — sinon revoked_at repasserait à null et rouvrirait le write-gate
  if (etape === "suite") redirect("/"); // déjà consenti

  const { error } = await supabase.from("consentement").upsert(
    {
      utilisatrice_id: user.id,
      art9_accorde: true,
      ia_reconnue: true,
      cgu_acceptees: true,
      revoked_at: null, // consentement INITIAL, non révoqué — une révoquée est redirigée avant (voir garde ci-dessus), jamais re-consentie
    },
    { onConflict: "utilisatrice_id" },
  );
  if (error) {
    return { statut: "erreur", message: "Enregistrement impossible. Réessaie." };
  }

  redirect("/"); // la scène (prototype) — l'entrée est débloquée
}

/**
 * Efface le compte COURANT — tâche système isolée via l'API admin (`deleteUser`), jamais
 * `service_role` sur du contenu (AD-12). On ne supprime que SON propre compte (getUser d'abord).
 * En cas d'ÉCHEC : on NE détruit PAS la session (elle permet de réessayer) et on le dit
 * clairement via `cheminEchec` — jamais d'effacement silencieux sur un chemin RGPD (acquis
 * revue 1.5). Succès SEULEMENT : signOut + sortie. Le `on delete cascade` propage à
 * `utilisatrice`, `consentement` et aux tables art. 9 (`art9_temoin` et futures).
 */
async function effacerCompteCourant(cheminEchec: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrer");

  const admin = createSupabaseAdminClient();

  // ⚠️ ARRÊTER LA FACTURATION AVANT D'EFFACER (revue du 2026-08-11, M7).
  //
  // La cascade efface `abonnement` en base et NE TOUCHE PAS À STRIPE. Sans ce geste, la souscription
  // reste `active` avec `cancel_at_period_end = false` : à l'échéance, la carte d'une personne qui
  // n'a plus de compte est débitée de 69 €, sans page `/abonnement`, sans porte de sortie, sans
  // recours autre qu'une opposition bancaire. C'est le seul défaut de la revue qui prélève de
  // l'argent à quelqu'un qui a explicitement quitté le produit.
  //
  // EN CAS D'ÉCHEC STRIPE, ON N'EFFACE PAS. Le droit à l'effacement supporte un délai raisonnable
  // (art. 17) ; une facturation sur un compte inexistant, elle, est irréversible et impossible à
  // rattraper depuis le produit. C'est aussi la doctrine déjà écrite ici : « jamais d'effacement
  // silencieux sur un chemin RGPD » (acquis revue 1.5). La session est conservée, elle peut réessayer.
  try {
    const { data: abo } = await admin
      .from("abonnement")
      .select("stripe_subscription_id")
      .eq("utilisatrice_id", user.id)
      .maybeSingle<{ stripe_subscription_id: string | null }>();
    if (abo?.stripe_subscription_id) {
      await resilierEnFinDePeriode(abo.stripe_subscription_id);
    }
  } catch (e) {
    console.error("[consentement] annulation Stripe impossible — effacement suspendu", {
      nom: e instanceof Error ? e.name : "inconnu",
    });
    redirect(cheminEchec);
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) redirect(cheminEchec); // session conservée, message explicite là où on revient

  await supabase.auth.signOut(); // succès : on nettoie les cookies
  redirect("/entrer");
}

/**
 * « Je ne veux pas » (Story 1.5, AC6). Refus AVANT toute séance → suppression immédiate du
 * compte. Registre non culpabilisant, une seule confirmation, aucune rétention.
 */
export async function refuser(): Promise<void> {
  return effacerCompteCourant("/consentement?erreur=suppression");
}

/**
 * Suppression du compte APRÈS révocation (Story 1.6, AC4). Même unique chemin d'effacement
 * que `refuser`, mais l'échec revient sur l'écran suspendu (jamais silencieux). L'export réel
 * des données (proposé avant la suppression) est différé à l'epic données (AD-14).
 */
export async function supprimerCompteRevoque(): Promise<void> {
  return effacerCompteCourant("/consentement/revoque?erreur=suppression");
}

/**
 * Révoquer le consentement art. 9 (Story 1.6, FR-012 / AD-13). Pose `revoked_at` SOUS la
 * session RLS (jamais service_role) → le write-gate se referme aussitôt (`a_consenti_art9`
 * exige `revoked_at IS NULL`) et l'utilisatrice bascule en « traitement art. 9 suspendu ».
 * Idempotent : `.is("revoked_at", null)` ne re-pose rien si déjà révoqué. On ne révoque que
 * SON consentement (getUser d'abord). Puis → écran suspendu (export puis suppression).
 */
export async function revoquerConsentement(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrer");

  // Garde d'état (symétrique de donnerConsentement) : on ne révoque QUE depuis un consentement
  // valide (étape "suite"). Empêche un POST direct de poser revoked_at sur une ligne non
  // consentie / inexistante (état incohérent ou faux succès).
  const etape = await etapeOnboardingPour(supabase, user.id);
  if (etape === "barre") redirect("/barriere"); // minorité détectée (1.9) : suspendu, sans signOut. Prime.
  if (etape === "mineur") {
    await supabase.auth.signOut();
    redirect("/entrer?refus=age");
  }
  if (etape === "naissance") redirect("/naissance");
  if (etape === "consentement") redirect("/consentement");
  if (etape === "revoque") redirect("/consentement/revoque"); // déjà révoquée (idempotent)

  const { error } = await supabase
    .from("consentement")
    .update({ revoked_at: new Date().toISOString() })
    .eq("utilisatrice_id", user.id)
    .is("revoked_at", null);
  if (error) redirect("/consentement/revoquer?erreur=revocation");

  redirect("/consentement/revoque");
}
