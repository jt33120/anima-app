"use server";

import { redirect } from "next/navigation";
import { reglerCourriels } from "@/lib/courriel/desabonnement";

/**
 * Le geste humain (revue T5-2). Une seule action pour les deux sens : arrêter, et reprendre.
 *
 * Les deux sens, parce que sans le retour, un clic malheureux — ou un lien suivi par un scanner — la
 * priverait définitivement de l'annonce sans qu'elle sache ni pourquoi ni où la rétablir. Le même jeton
 * rouvre le canal : il n'y a rien à retrouver, rien à demander au support qui n'existe pas.
 */
export async function reglerAction(formData: FormData): Promise<void> {
  const jeton = String(formData.get("j") ?? "");
  const refuse = formData.get("refuse") === "1";

  const issue = await reglerCourriels(jeton, refuse);

  const etat = issue === "inconnu" ? "inconnu" : refuse ? "arrete" : "repris";
  redirect(`/desabonnement?j=${encodeURIComponent(jeton)}&etat=${etat}`);
}
