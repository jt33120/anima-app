import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiPort, RequeteIa, ReponseIa } from "./port";

/**
 * Egress-guard — le point d'egress art. 9 UNIQUE (AD-13). Le SEUL endroit d'où du contenu art. 9
 * sort vers un fournisseur.
 *
 * Sur le chemin art. 9, il revérifie **au plus près de l'envoi** :
 *   1. le ZDR de l'adaptateur lié (`estZdrProuve()`) — agnostique au fournisseur (AD-3), pas de
 *      lecture d'env ici ;
 *   2. le **consentement vivant** via `a_consenti_art9()` sous la session RLS (`auth.uid()`).
 * Si l'un échoue → on **bloque et on ne poste rien**. L'appel à l'adaptateur n'a lieu qu'ensuite.
 *
 * « Même transaction que l'envoi » (AD-13) : l'envoi étant un POST HTTP (pas une transaction SQL),
 * la garantie est que la vérification lit l'ÉTAT VIVANT du consentement immédiatement avant l'appel
 * — le seul `await` entre le contrôle et l'envoi est le contrôle lui-même (le RPC). Une révocation
 * qui atterrit AVANT ce contrôle bloque. Résiduel (contenu déjà en vol) borné par le ZDR (rien
 * retenu côté fournisseur) et le write-gate (rien persisté).
 */

export type RaisonRefus = "zdr" | "consentement";
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
    // 2) Consentement vivant, sous RLS (auth.uid()). C'est le dernier await avant l'envoi.
    const { data, error } = await supabase.rpc("a_consenti_art9");
    if (error || data !== true) {
      return { bloque: true, raison: "consentement" };
    }
  }

  // 3) Seulement maintenant : l'envoi.
  const reponse = await adaptateur.completer(requete);
  return { bloque: false, reponse };
}
