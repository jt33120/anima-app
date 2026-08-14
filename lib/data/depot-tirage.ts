import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tirerUneCarte, type Tirage } from "@/lib/tirage/tirer";

/**
 * depot-tirage.ts — OÙ L'IDENTITÉ ENTRE, ET SEULEMENT LÀ (Story 5.7, AC2 · AD-11 / AD-12).
 *
 * ── LA SÉPARATION EST LE CONTENU DE CE FICHIER ─────────────────────────────────────────────────
 *
 * AD-11 : « l'identité ne sert qu'à l'écriture RLS de la lecture, JAMAIS comme entrée de
 * sélection ». Traduit en code, ça donne deux fonctions et un ordre :
 *
 *     tirerUneCarte()                → ne connaît PERSONNE (arité nulle, verrou d'imports)
 *     deposerTirage(supabase, tirage) → connaît l'utilisatrice, mais ne tire PAS
 *
 * `tirerEtDeposer` les enchaîne, dans cet ordre, et l'ordre est ce qui est testé : un espion sur les
 * deux appels doit voir le tirage se produire AVANT que la moindre requête ne parte. Si un jour
 * quelqu'un fusionne les deux — « ce serait plus simple d'écrire directement » — la fonction fusionnée
 * aurait accès à l'identité au moment de choisir, et FR-016 redeviendrait une question de discipline.
 *
 * ── CE MODULE EST DANS `lib/data/`, DONC HORS DU VERROU — ET C'EST NORMAL ──────────────────────
 *
 * Le verrou ESLint porte sur `lib/tirage/**`, pas ici : ce fichier DOIT connaître Supabase, c'est sa
 * raison d'être. La frontière passe entre les deux modules, pas à l'intérieur de celui-ci. Ce qu'il
 * ne fait jamais, en revanche : lire un profil pour le passer à `tirerUneCarte()` — ce qui est
 * impossible, puisque cette fonction ne prend rien.
 *
 * ── SOUS JWT, JAMAIS `service_role` (AD-12) ────────────────────────────────────────────────────
 *
 * Le client est passé en paramètre et porte le JWT : la RLS applique la propriété, le consentement
 * art. 9, la barrière de minorité et la garde de détresse (0050). Aucune de ces quatre conditions
 * n'est revérifiée ici — les redoubler en TypeScript donnerait deux vérités à maintenir, et la
 * copie applicative finirait par diverger de la policy, qui est la seule à faire foi.
 */

/** Le client Supabase porteur du JWT (AD-12). Type minimal : ce module ne fait qu'un insert. */
type ClientJwt = Pick<SupabaseClient, "from">;

/**
 * Écrit un tirage DÉJÀ produit. Elle ne tire pas — c'est le sens de son paramètre.
 *
 * `tire_a` n'est pas envoyé : la base le pose (trigger `tirage_horodatage`). L'envoyer d'ici serait
 * l'heure du processus, donc falsifiable et sujette à la dérive d'horloge — une mauvaise pièce dans
 * un journal d'audit.
 *
 * L'erreur ne porte que le code Postgres : `42501` (une des quatre gardes a refusé) doit remonter
 * lisiblement à la 5.8, qui devra distinguer « consentement révoqué » de « fenêtre de détresse » avec
 * des mots, pas avec une erreur.
 */
export async function deposerTirage(
  supabase: ClientJwt,
  utilisatriceId: string,
  tirage: Tirage,
): Promise<string> {
  const { data, error } = await supabase
    .from("tirage")
    .insert({
      utilisatrice_id: utilisatriceId,
      carte: tirage.cle,
      graine: tirage.graine,
      taille_jeu: tirage.tailleJeu,
    })
    // L'identifiant est relu parce que la 5.8 en a besoin pour rattacher la LECTURE au tirage — le
    // rattachement est ce qui ferme le re-tirage (`lecture.tirage_id` unique, 0051). Le générer côté
    // client pour l'éviter reviendrait à laisser l'écrivain choisir la clé primaire d'un journal
    // d'audit ; il vaut mieux un aller-retour de plus.
    .select("id")
    .single();
  if (error) throw new Error(`tirage.deposer: ${error.code ?? "echec"}`);
  if (!data?.id) throw new Error("tirage.deposer: identifiant absent");
  return data.id as string;
}

/**
 * Tire une carte, PUIS la journalise. Deux appels, dans cet ordre.
 *
 * ⚠️ EN CAS D'ÉCHEC D'ÉCRITURE, LE TIRAGE EST PERDU — il n'est pas rejoué. C'est délibéré : rejouer
 * après un échec, c'est un second tirage, c'est-à-dire exactement le re-tirage silencieux que l'UX
 * interdit (« ne jamais faire : proposer un re-tirage »). Une carte tirée sans trace journalisée est
 * une carte qu'on ne peut pas auditer ; mieux vaut la perdre que la montrer.
 */
export async function tirerEtDeposer(
  supabase: ClientJwt,
  utilisatriceId: string,
): Promise<Tirage & { readonly id: string }> {
  const tirage = tirerUneCarte();
  const id = await deposerTirage(supabase, utilisatriceId, tirage);
  return { ...tirage, id };
}
