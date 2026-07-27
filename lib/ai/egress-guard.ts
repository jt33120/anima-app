import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiPort, RequeteIa, ReponseIa } from "./port";

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

export async function envoyerSousEgressArt9(args: {
  supabase: SupabaseClient;
  adaptateur: AiPort;
  requete: RequeteIa;
}): Promise<ResultatEgress> {
  const { supabase, adaptateur, requete } = args;

  if (requete.contientArt9) {
    // 1) ZDR de l'adaptateur lié.
    if (!adaptateur.estZdrProuve()) {
      return { bloque: true, raison: "zdr" };
    }
    // 2) Consentement vivant, sous RLS (auth.uid()).
    const { data: consenti, error: eConsent } = await supabase.rpc("a_consenti_art9");
    if (eConsent || consenti !== true) {
      return { bloque: true, raison: "consentement" };
    }
    // 3) Barrière de minorité (Story 1.9) : un compte suspendu ne doit PLUS aucun échange.
    //    Fail-safe : une erreur RPC bloque aussi (dernier await avant l'envoi).
    const { data: barre, error: eBarre } = await supabase.rpc("est_barre_minorite");
    if (eBarre || barre === true) {
      return { bloque: true, raison: "minorite" };
    }
  }

  // 4) Seulement maintenant : l'envoi.
  const reponse = await adaptateur.completer(requete);
  return { bloque: false, reponse };
}
