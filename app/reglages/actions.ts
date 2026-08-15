"use server";

import { revalidatePath } from "next/cache";
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
