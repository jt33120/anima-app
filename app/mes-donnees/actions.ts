"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { effacerToutesSesDonnees } from "@/lib/data/effacer-donnees";
import { journaliserIncidentSecurite } from "@/lib/safety/rpc-repli";

/**
 * L'action d'effacement total (Story 6.7, AC1/AC3/AC5).
 *
 * ── UNE SEULE CONFIRMATION, ET ELLE EST ICI ────────────────────────────────────────────────────
 *
 * L'AC3 exige « une confirmation unique » et interdit tout ce qui s'interpose : écran de rétention,
 * offre, « es-tu sûre ? » à étages. La confirmation est donc une case, sur le même écran, dans le
 * même formulaire — un geste, pas un parcours. Le `required` du navigateur la rend obligatoire ;
 * cette vérification-ci la rend obligatoire pour de bon, parce qu'un formulaire se poste aussi sans
 * navigateur.
 *
 * ── AUCUN ÉTAT DE RETOUR, ET C'EST VOULU ───────────────────────────────────────────────────────
 *
 * L'écran n'a pas d'îlot client : un échec renvoie sur la halte avec un motif, comme pour l'export.
 * Un `useActionState` aurait imposé du JavaScript à la page où l'on exerce un droit — donc une
 * manière de plus de ne rien faire en silence.
 */
export async function effacerTout(donnees: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrer");

  if (donnees.get("compris") !== "oui") redirect("/mes-donnees?echec=confirmation");

  try {
    await effacerToutesSesDonnees(supabase);
  } catch (e) {
    // NFR-022 : le code seul. Et surtout : on ne prétend JAMAIS que c'est fait. Un écran d'adieu
    // affiché sur un effacement qui a échoué serait le pire mensonge que ce produit puisse dire.
    journaliserIncidentSecurite("effacement_total", e);
    redirect("/mes-donnees?echec=effacement");
  }

  // ⚠️ `scope: "local"` — l'identité d'auth vient d'être supprimée, donc une déconnexion qui
  // interroge le serveur échouerait et laisserait le cookie en place : elle repartirait avec une
  // session pointant vers quelqu'un qui n'existe plus. On vide le cookie ici, sans rien demander.
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    /* le cookie est déjà inutilisable ; rien à sauver, rien à dire */
  }

  redirect("/entrer?efface=1");
}
