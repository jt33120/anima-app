import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * depot-fil.ts — LE FIL RETROUVÉ AU RECHARGEMENT (QA tour 1, T3).
 *
 * ── LE DÉFAUT, ET POURQUOI IL COMPTE PLUS QUE SA TAILLE ─────────────────────────────────────────
 *
 * `Conversation.tsx` ne chargeait AUCUN historique au montage : le fil vivait entièrement dans l'état
 * du composant. Le journal était bien écrit (Story 4.1, couche verbatim inaltérable) — il n'était
 * simplement jamais relu. Un rechargement, et l'écran était vide.
 *
 * Le tour de QA l'a dit mieux que je ne le dirais : « J'avais écrit un long message — le genre de
 * message qu'on écrit une fois. J'ai rechargé, et il n'y avait plus rien. Sur une application où
 * l'on est censé déposer ce qu'on ne dit à personne, un écran vide après un rechargement, c'est
 * brutal. »
 *
 * ⚠️ ET L'ÉCRAN DE CONSENTEMENT PROMET LE CONTRAIRE, DANS UN TEXTE À PORTÉE JURIDIQUE : « Ce que tu
 * lui confies est CONSERVÉ, pour qu'elle se souvienne d'une fois sur l'autre. » C'était vrai en base
 * et faux à l'écran. Une promesse tenue par le stockage mais démentie par l'affichage n'est pas
 * tenue.
 *
 * ── LA FENÊTRE : VINGT-QUATRE HEURES GLISSANTES, QUARANTE ENTRÉES ───────────────────────────────
 *
 * ⚠️ PAS le jour civil, et c'est une décision. Un jour civil crée une FALAISE À MINUIT : quelqu'un
 * qui écrit à 23 h 50 et recharge à 00 h 10 perdrait tout — exactement le geste qu'on répare, rejoué
 * une fois par nuit. Une fenêtre glissante n'a pas de bord.
 *
 * Quarante entrées, soit vingt échanges : assez pour retrouver une séance, borné pour qu'un long
 * historique ne fasse pas grossir le rendu de la scène sans fin. Ce qui dépasse n'est pas perdu — il
 * est dans le journal, et l'export FR-067 le rend en entier.
 *
 * ── AUCUNE GARDE D'ÉTAT ICI, ET C'EST VOULU ─────────────────────────────────────────────────────
 *
 * La RLS d'`entree_journal` (0016) borne à la propriétaire, et elle SURVIT à la révocation — voulu,
 * l'export doit survivre. Servir ce verbatim DANS L'APPLICATION à quelqu'un qui a retiré son
 * consentement serait de l'usage, pas de l'export, et c'est refusé — mais par l'appelant :
 * `app/page.tsx` applique `etapeOnboardingPour` AVANT toute lecture, et renvoie `revoque` et
 * `barre` sur leurs écrans. Poser la garde ici en ferait une seconde, donc une divergence en
 * attente. Le patron est celui de `/api/anam/echange`, qui l'écrit noir sur blanc.
 */

/** Une entrée de journal, telle qu'elle remonte à l'écran. */
export interface TourFil {
  readonly id: string;
  readonly role: "utilisatrice" | "anam";
  readonly texte: string;
}

/** Vingt échanges. Voir l'en-tête pour le choix du nombre. */
export const FIL_ENTREES_MAX = 40;

/** La fenêtre GLISSANTE, en heures. Voir l'en-tête pour le refus du jour civil. */
export const FIL_FENETRE_HEURES = 24;

/**
 * Le fil récent de la propriétaire du JWT, dans l'ordre de lecture (le plus ancien en premier).
 *
 * ⚠️ ON DEMANDE LES PLUS RÉCENTES, PUIS ON RETOURNE. Trier croissant avec une limite rendrait les
 * quarante PREMIÈRES entrées de la fenêtre — donc, pour quelqu'un de bavard, la conversation d'il y a
 * vingt-trois heures, et pas celle qu'elle vient d'écrire. L'ordre de la requête et l'ordre de
 * lecture ne sont pas le même ordre.
 */
export async function lireFilRecent(
  supabase: SupabaseClient,
  maintenant: Date = new Date(),
): Promise<readonly TourFil[]> {
  const depuis = new Date(maintenant.getTime() - FIL_FENETRE_HEURES * 3_600_000).toISOString();
  const { data, error } = await supabase
    .from("entree_journal")
    .select("id, role, contenu, cree_le")
    .gte("cree_le", depuis)
    .order("cree_le", { ascending: false })
    .limit(FIL_ENTREES_MAX);

  if (error) throw new Error(`fil: ${error.code ?? "echec"}`);
  if (!Array.isArray(data)) return [];

  // ⚠️ ON FILTRE AVANT DE CONSTRUIRE, et sans jamais inventer. Une ligne mutilée (rôle inconnu,
  // contenu absent) est ÉCARTÉE plutôt que rendue avec un champ vide : une bulle vide dans le fil se
  // lit comme un message effacé, et c'est précisément l'angoisse qu'on répare ici.
  const tours: TourFil[] = [];
  for (const l of data as Array<Record<string, unknown>>) {
    if (typeof l?.id !== "string" || typeof l?.contenu !== "string") continue;
    if (l.role !== "utilisatrice" && l.role !== "anam") continue;
    tours.push({ id: l.id, role: l.role, texte: l.contenu });
  }
  return tours.reverse();
}
