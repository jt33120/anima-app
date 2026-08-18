"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { heureValide } from "@/lib/domain/socle-quotidien";

/**
 * actions.ts — L'ABONNEMENT À LA POUSSÉE ET L'HEURE CHOISIE (Story 6.2, T6).
 *
 * ── POURQUOI DES SERVER ACTIONS ET PAS UN CLIENT SUPABASE DE NAVIGATEUR ────────────────────────────
 *
 * Le cookie de session est `httpOnly` depuis la revue du 2026-08-13, et `lib/data/supabase/client.ts`
 * n'est importé par AUCUN fichier de `app/`, `lib/` ni `render/` — c'est ce qui rend le durcissement
 * gratuit (voir `cookies-session.ts`). L'îlot client ne peut donc pas parler à la base, et il ne doit
 * pas commencer ici : rétablir un client de navigateur pour trois écritures rendrait le cookie
 * lisible par tout script atteignant l'origine, pour le confort d'un formulaire.
 *
 * ── ÉCRITURE SOUS LE JWT DE L'UTILISATRICE, JAMAIS `service_role` (AD-12) ──────────────────────────
 *
 * ⚠️ Et ces actions **ne sont pas la garde**. `authenticated` détient les sept privilèges DML sur
 * `preference_socle` et `abonnement_poussee` : ce qui empêche d'écrire la préférence d'une autre est
 * le `WITH CHECK` des policies (0053), pas le `getUser()` ci-dessous. Le contrôle de session ici sert
 * à donner un message utile, pas à protéger la base — la nuance est celle que ce dépôt a payée six
 * fois (migrations 0041 à 0048).
 */

export type EtatReglages = { statut: "ok" | "erreur"; message?: string };

const REFUS = { statut: "erreur", message: "Impossible pour le moment." } as const;

/**
 * Enregistre l'abonnement de CET appareil.
 *
 * Passe par `abonner_poussee` et pas par un `insert` direct — non pour contourner les policies (la
 * fonction ne les contourne pas) mais parce qu'un même navigateur rend le MÊME endpoint à deux
 * comptes successifs, et que déloger la ligne de l'autre exige de voir une ligne qu'aucune policy ne
 * laisse voir. La RPC n'a pas de paramètre `utilisatrice` : elle lit `auth.uid()`, donc elle ne peut
 * abonner que l'appelante — il n'y a rien à forger.
 */
export async function abonnerAppareil(
  endpoint: string,
  p256dh: string,
  auth: string,
): Promise<EtatReglages> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return REFUS;

  const { error } = await supabase.rpc("abonner_poussee", {
    p_endpoint: endpoint,
    p_p256dh: p256dh,
    p_auth: auth,
  });
  // ⚠️ Le message ne porte PAS `error.message`. Un refus de contrainte de forme cite la valeur
  // refusée, et cette valeur vient du navigateur : la recopier à l'écran rouvrirait par la porte du
  // diagnostic ce que la contrainte ferme (NFR-022).
  if (error) return REFUS;
  revalidatePath("/reglages");
  return { statut: "ok" };
}

/**
 * Oublie CET appareil. La suppression passe par la policy propriétaire : une session ne peut retirer
 * que ses propres abonnements, et c'est la base qui le dit.
 *
 * D6 : il n'y a pas de bascule « désactivé » — la ligne existe ou elle n'existe pas. Le navigateur et
 * la base disent alors la même chose, et il n'existe aucun état où l'un des deux ment.
 */
export async function desabonnerAppareil(endpoint: string): Promise<EtatReglages> {
  const supabase = await createSupabaseServerClient();
  // ⚠️ LE CONTRÔLE DE SESSION MANQUAIT ICI, ET NULLE PART AILLEURS (revue Epic 6, R8).
  //
  // Ce n'est toujours pas la garde — la policy propriétaire de 0053 l'est. Mais sans session, le
  // `delete` ne trouve AUCUNE ligne à travers la RLS et réussit : zéro ligne touchée, aucune erreur,
  // donc `{statut:"ok"}`. L'écran annonçait alors un désabonnement que la base n'avait pas fait, et
  // le produit continuait de pousser vers quelqu'un persuadée d'avoir dit non. Un succès qui n'a rien
  // accompli est pire qu'un échec : il ferme la question.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return REFUS;

  const { error } = await supabase.from("abonnement_poussee").delete().eq("endpoint", endpoint);
  if (error) return REFUS;
  revalidatePath("/reglages");
  return { statut: "ok" };
}

/**
 * Change l'heure choisie.
 *
 * `heureValide` ici est un CONFORT, pas une garde : la garde est le `CHECK (heure between 0 and 23)`
 * de 0053, qui tient même si cette action disparaît. On valide quand même, pour rendre un message
 * plutôt qu'une erreur de base.
 */
export async function choisirHeure(heure: number): Promise<EtatReglages> {
  if (!heureValide(heure)) return { statut: "erreur", message: "Cette heure n'existe pas." };
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return REFUS;

  // `upsert` : la préférence naît normalement avec le premier abonnement (`abonner_poussee`), mais
  // elle peut se régler avant — et une ligne manquante ferait échouer un `update` en silence, à
  // travers une policy qui n'a rien à refuser.
  const { error } = await supabase
    .from("preference_socle")
    .upsert(
      { utilisatrice_id: user.id, heure, maj_le: new Date().toISOString() },
      { onConflict: "utilisatrice_id" },
    );
  if (error) return REFUS;
  revalidatePath("/reglages");
  return { statut: "ok" };
}

/**
 * Arrêter ou reprendre les courriels d'Anam (revue Epic 6, R7 · art. 21).
 *
 * ⚠️ **AUCUNE GARDE ICI, ET C'EST LA MÊME DÉCISION QU'EN 3.5 POUR LA RÉSILIATION.** Ni consentement
 * art. 9, ni fenêtre de détresse : `limites_levees` est vrai PENDANT un épisode, et garder ce geste
 * empêcherait quelqu'un en crise de faire taire des courriels qu'elle ne supporte plus.
 *
 * Le contrôle de session sert à rendre un message utile ; la garde réelle est `auth.uid()` DANS la
 * fonction (0062), qui n'a pas de paramètre d'identité — il n'y a rien à forger.
 */
export async function reglerCourriels(refuse: boolean): Promise<EtatReglages> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return REFUS;

  const { error } = await supabase.rpc("regler_mes_courriels", { p_refuse: refuse });
  if (error) return REFUS;
  revalidatePath("/reglages");
  return { statut: "ok" };
}

/**
 * Refermer sa session sur cet appareil (QA tour 1, T22).
 *
 * ── L'ORDRE EST LA GARDE, PAS UN DÉTAIL DE STYLE ───────────────────────────────────────────────
 *
 * `redirect()` de Next **lève**. Un `signOut` écrit après ne s'exécuterait donc jamais, et l'écran
 * annoncerait une session fermée sur une session toujours ouverte — c'est-à-dire la certitude d'être
 * partie donnée à quelqu'un qui ne l'est pas. Sur un appareil partagé, c'est pire que l'absence de
 * bouton, qui au moins ne ment pas. Un test tient cet ordre.
 *
 * ── AUCUNE GARDE, ET C'EST LA MÊME DÉCISION QU'EN 3.5 ET EN R7 ─────────────────────────────────
 *
 * On ne garde jamais une SORTIE. Ni consentement art. 9, ni fenêtre de détresse : garder ce geste
 * empêcherait quelqu'un en crise de refermer l'écran qu'elle vient de remplir, sur un téléphone qui
 * n'est peut-être pas le sien.
 *
 * ⚠️ ON NE LIT MÊME PAS LA SESSION AVANT. `if (!user) return` serait un défaut ici : une session
 * illisible est exactement le cas où l'on veut le plus fermer — refuser laisserait le cookie en
 * place. `signOut` sur une session déjà morte est sans effet, et sans conséquence.
 */
export async function seDeconnecter(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/entrer?deconnexion=1");
}
