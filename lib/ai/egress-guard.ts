import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiPort, EvenementIa, RequeteIa, ReponseIa } from "./port";

/**
 * Egress-guard — le point d'egress art. 9 UNIQUE (AD-13). Le SEUL endroit d'où du contenu art. 9
 * sort vers un fournisseur.
 *
 * Sur le chemin art. 9, il revérifie **au plus près de l'envoi**, dans l'ordre :
 *   1. le ZDR de l'adaptateur lié (`estZdrProuve()`) — agnostique au fournisseur (AD-3) ;
 *   2. le **consentement vivant** via `a_consenti_art9()` sous la session RLS (`auth.uid()`) ;
 *   3. la **barrière de minorité** via `est_barre_minorite()` — miroir EXACT du write-gate DB
 *      (0006 : `and not est_barre_minorite()`). La barrière ne révoque pas le consentement, donc
 *      le contrôle (2) seul ne l'attrape pas : un compte suspendu passerait sans ce (3) — revue 2.1.
 * Si l'un échoue → on **bloque et on ne poste rien**. L'appel à l'adaptateur n'a lieu qu'ensuite.
 *
 * « Même transaction que l'envoi » (AD-13) : l'envoi étant un POST HTTP (pas une transaction SQL),
 * la garantie est que les vérifications lisent l'ÉTAT VIVANT immédiatement avant l'appel. Une
 * révocation/suspension qui atterrit AVANT ces contrôles bloque. Résiduel (contenu déjà en vol)
 * borné par le ZDR (rien retenu côté fournisseur) et le write-gate (rien persisté).
 */

export type RaisonRefus = "zdr" | "consentement" | "minorite";
export type ResultatEgress =
  | { bloque: false; reponse: ReponseIa }
  | { bloque: true; raison: RaisonRefus };

/** Variante streaming (Story 2.2) : le flux n'est retourné QUE si les gardes passent. */
export type ResultatEgressFlux =
  | { bloque: false; flux: AsyncIterable<EvenementIa> }
  | { bloque: true; raison: RaisonRefus };

/**
 * Exécute les trois gardes art. 9, dans l'ordre, sur une requête. Retourne la raison de blocage
 * (ou `null` si tout passe). Partagé par les deux variantes d'egress (envoi / flux) → une seule
 * définition des gardes, pas de dérive entre les deux chemins.
 */
async function verifierGardesArt9(
  supabase: SupabaseClient,
  adaptateur: AiPort,
  requete: RequeteIa,
): Promise<RaisonRefus | null> {
  if (!requete.contientArt9) return null;
  // 1) ZDR de l'adaptateur lié (agnostique au fournisseur, AD-3).
  if (!adaptateur.estZdrProuve()) return "zdr";
  // 2) Consentement vivant, sous RLS (auth.uid()).
  const { data: consenti, error: eConsent } = await supabase.rpc("a_consenti_art9");
  if (eConsent || consenti !== true) return "consentement";
  // 3) Barrière de minorité (Story 1.9) : un compte suspendu ne doit PLUS aucun échange.
  //    Fail-safe : une erreur RPC bloque aussi (dernier await avant l'envoi).
  const { data: barre, error: eBarre } = await supabase.rpc("est_barre_minorite");
  if (eBarre || barre === true) return "minorite";
  return null;
}

export async function envoyerSousEgressArt9(args: {
  supabase: SupabaseClient;
  adaptateur: AiPort;
  requete: RequeteIa;
}): Promise<ResultatEgress> {
  const { supabase, adaptateur, requete } = args;
  const raison = await verifierGardesArt9(supabase, adaptateur, requete);
  if (raison) return { bloque: true, raison };
  // Seulement maintenant : l'envoi.
  const reponse = await adaptateur.completer(requete);
  return { bloque: false, reponse };
}

/**
 * Point d'egress art. 9 UNIQUE pour le STREAMING (AD-13, Story 2.2). Les gardes s'exécutent et
 * s'AWAIT **avant** d'appeler `adaptateur.diffuser` — et comme `diffuser` est un `async function*`,
 * son corps ne tourne pas avant la première itération : les gardes sont donc réellement passées
 * **avant le premier octet**. Un blocage ne diffuse rien (adaptateur jamais itéré).
 */
/**
 * ── LA VARIANTE ORDONNANCEUR (revue 4.9, T2-1) ─────────────────────────────────────────────────────────
 *
 * La 4.9 avait ouvert un SECOND point d'egress art. 9 : le job de synthèse appelait `completer()` sur
 * l'adaptateur nu. Son `contientArt9: true` était donc parfaitement inerte — le seul lecteur de ce
 * drapeau est `verifierGardesArt9` ci-dessus, jamais atteint sur ce chemin. Un test affirmait même
 * garder l'invariant (« mentir sur `contientArt9` contournerait l'egress-guard ») : il gardait une porte
 * qui n'était pas là. La phrase « le SEUL endroit d'où du contenu art. 9 sort » était devenue fausse.
 *
 * Pourquoi une variante plutôt que la même fonction : les gardes 2 et 3 lisent `auth.uid()`, et
 * l'ordonnanceur n'a pas de session. Le prédicat équivalent, pour une utilisatrice DONNÉE, vit en base
 * dans `eligible_a_synthese` — premium, barrière de minorité, consentement art. 9 vivant, détresse — et
 * un test compare les deux chemins pour qu'ils ne divergent pas.
 *
 * Ce que ça rattrape concrètement : le lot est constitué en tête de tick puis traité SÉQUENTIELLEMENT,
 * une personne à la fois, chacune coûtant un appel au modèle fort. Pour la vingtième, l'écart entre le
 * contrôle et l'envoi se compte en dizaines de secondes. Une révocation qui atterrit dans cette fenêtre
 * ne bloquait rien : son journal partait quand même. AD-13 dit littéralement « Prevents: envoi au
 * fournisseur après une révocation en vol ».
 */
export type RaisonRefusOrdonnanceur = "zdr" | "eligibilite";
export type ResultatEgressOrdonnanceur =
  | { bloque: false; reponse: ReponseIa }
  | { bloque: true; raison: RaisonRefusOrdonnanceur };

export async function envoyerSousEgressArt9Ordonnanceur(args: {
  /** Client `service_role` : l'ordonnanceur n'a pas de session, donc pas d'`auth.uid()`. */
  supabase: SupabaseClient;
  utilisatriceId: string;
  adaptateur: AiPort;
  requete: RequeteIa;
}): Promise<ResultatEgressOrdonnanceur> {
  const { supabase, utilisatriceId, adaptateur, requete } = args;
  if (requete.contientArt9) {
    // 1) ZDR de l'adaptateur lié — agnostique au fournisseur (AD-3), même garde que le chemin de session.
    if (!adaptateur.estZdrProuve()) return { bloque: true, raison: "zdr" };
    // 2) L'état VIVANT, relu immédiatement avant l'envoi. Fail-safe : une erreur RPC bloque aussi.
    const { data: eligible, error } = await supabase.rpc("eligible_a_synthese", {
      p_utilisatrice: utilisatriceId,
    });
    if (error || eligible !== true) return { bloque: true, raison: "eligibilite" };
  }
  // Seulement maintenant : l'envoi.
  const reponse = await adaptateur.completer(requete);
  return { bloque: false, reponse };
}

export async function diffuserSousEgressArt9(args: {
  supabase: SupabaseClient;
  adaptateur: AiPort;
  requete: RequeteIa;
}): Promise<ResultatEgressFlux> {
  const { supabase, adaptateur, requete } = args;
  const raison = await verifierGardesArt9(supabase, adaptateur, requete);
  if (raison) return { bloque: true, raison };
  return { bloque: false, flux: adaptateur.diffuser(requete) };
}
