import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { etapeOnboardingPour } from "./etat-onboarding";

/**
 * OÙ VA QUELQU'UN QUI VIENT D'OUVRIR SA SESSION — un seul endroit, pour deux portes.
 *
 * ══ POURQUOI CETTE FONCTION A ÉTÉ SORTIE DE LA ROUTE ══════════════════════════════════════════
 *
 * Elle vivait dans `app/auth/confirm/route.ts`, qui était l'unique chemin d'entrée. Le code à six
 * chiffres en ouvre un second, et recopier ces sept lignes en aurait fait DEUX machines d'état sur
 * l'onboarding. C'est exactement ce que la revue 1.4 a payé, et son en-tête le dit encore :
 * « une barrière oubliée dans un seul chemin suffit à laisser passer un mineur ».
 *
 * La barrière de minorité est ici, la révocation aussi. Le jour où l'une d'elles change, elle
 * change pour le lien ET pour le code, sans que personne ait à y penser.
 *
 * ⚠️ `signOut()` SUR LE CHEMIN MINEUR, ET PAS SUR `barre`. Un mineur signalé est refusé à CHAQUE
 * connexion (FR-070) : on ferme la session. Un compte SUSPENDU pour minorité soupçonnée, lui, garde
 * la sienne — l'export RGPD en a besoin (1.9), et le lui retirer ferait de la suspension une porte
 * fermée à clé sur ses propres données.
 */
export async function destinationApresAuth(
  supabase: SupabaseClient,
  next: string,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return next;

  const etape = await etapeOnboardingPour(supabase, user.id);
  if (etape === "barre") return "/barriere";
  if (etape === "mineur") {
    await supabase.auth.signOut();
    return "/entrer?refus=age";
  }
  if (etape === "naissance") return "/naissance";
  if (etape === "consentement") return "/consentement";
  if (etape === "revoque") return "/consentement/revoque";
  return next; // suite
}
