import "server-only";
import { createSupabaseAdminClient } from "@/lib/data/supabase/admin";
import { jetonValide } from "@/lib/domain/jeton-desabonnement";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Story 4.9 / revue T5-2 — LE GESTE, côté serveur. Un seul endroit, deux appelants : la page de
 * confirmation (le chemin humain) et la route un-clic (le chemin RFC 8058, celui qu'appelle le bouton
 * « Se désabonner » de Gmail). Deux chemins qui font la même chose doivent partager la même fonction,
 * sinon l'un des deux finit par diverger — et ce sera celui que personne ne teste.
 *
 * ── POURQUOI `service_role` ICI (dérogation AD-12, nommée) ──────────────────────────────────────────────
 *
 * AD-12 réserve `service_role` aux tâches système : aucun accès au contenu art. 9 depuis une route
 * applicative. Ce chemin n'en approche aucun — il écrit un booléen dans `preference_courriel`, une table
 * sans colonne de contenu. Il n'a par ailleurs AUCUNE session à porter, par construction : exiger une
 * connexion pour faire cesser un envoi est précisément le mur que l'article 21 interdit de dresser. Même
 * patron, même raison que le webhook Stripe.
 *
 * L'alternative — accorder `execute` à `anon` et laisser PostgREST exposer la fonction — a été écartée :
 * elle ouvrirait la fonction à l'internet entier sans qu'aucun code à nous ne soit sur le chemin, donc
 * sans aucun endroit où poser une limite de débit le jour où il en faudra une.
 *
 * ── LE CŒUR SÉPARÉ DE SA RÉSOLUTION (patron du job de synthèse) ─────────────────────────────────────────
 *
 * `reglerCourrielsAvec` prend son client par la porte. Sans ça, deux propriétés de ce fichier n'étaient
 * prouvables par RIEN — la mutation-vérification l'a montré en les faisant survivre : qu'une panne de
 * base ne se dise jamais « c'est fait », et qu'un jeton mal formé n'atteigne pas la base du tout.
 */

export type IssueDesabonnement = "fait" | "inconnu";

/**
 * Applique (ou retire) le refus. Rend `inconnu` pour un jeton mal formé, absent, ou qui ne désigne rien —
 * les trois se ressemblent volontairement : distinguer « n'a jamais existé » de « a été effacé » ferait
 * de ce lien un oracle d'existence de compte, interrogeable sans aucune authentification.
 */
export async function reglerCourrielsAvec(
  supabase: SupabaseClient,
  jetonBrut: string | null | undefined,
  refuse: boolean,
): Promise<IssueDesabonnement> {
  const jeton = jetonValide(jetonBrut);
  // On n'atteint même pas la base sur une valeur mal formée : c'est une entrée non authentifiée, ouverte
  // à l'internet entier, et la faire voyager jusqu'à Postgres pour se faire refuser là-bas offre à qui la
  // sonde un aller-retour de base de données par requête, gratuitement.
  if (!jeton) return "inconnu";

  const { data, error } = await supabase.rpc("regler_courriels_par_jeton", {
    p_jeton: jeton,
    p_refuse: refuse,
  });

  // Une panne se dit `inconnu`. Elle ne se dit SURTOUT pas « c'est fait » : lui affirmer que les envois
  // ont cessé alors qu'ils continueront est la seule issue réellement dommageable de ce chemin — elle
  // n'aurait alors plus aucune raison de recliquer, et le courriel suivant arriverait quand même.
  if (error) return "inconnu";
  return data === true ? "fait" : "inconnu";
}

/** Ce qu'appellent la page et la route. Résout le client ; toute la logique est dans le cœur ci-dessus. */
export async function reglerCourriels(
  jetonBrut: string | null | undefined,
  refuse: boolean,
): Promise<IssueDesabonnement> {
  return reglerCourrielsAvec(createSupabaseAdminClient(), jetonBrut, refuse);
}
