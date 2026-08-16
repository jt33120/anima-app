"use server";

import { revalidatePath } from "next/cache";
import { creerDepotFaits } from "@/lib/data/depot-faits";
import { validerCorrection } from "@/lib/domain/memoire-retenue";
import * as copie from "@/lib/domain/copie-memoire";

/**
 * actions.ts — CORRIGER, SUPPRIMER, ANNULER (Story 6.5, T4 ; AC2/AC3).
 *
 * ── ELLES NE SONT PAS LA GARDE, ET IL FAUT LE DIRE ICI PLUS QU'AILLEURS ────────────────────────
 *
 * `authenticated` détient les privilèges DML sur `fait_extrait`. Ce qui empêche d'écrire le fait
 * d'une autre est le `WITH CHECK` des policies de 0018 et le corps de `fusionner_fait_extrait`, qui
 * n'écrit QUE `where utilisatrice_id = auth.uid()` — jamais ce fichier. Une `cle` forgée par un
 * client hostile ne peut donc atteindre que ses propres lignes.
 *
 * Ce qui vit ici est ce que la base ne peut pas dire : POURQUOI un refus, dans des mots lisibles.
 *
 * ── LE SEUL CHEMIN D'ÉCRITURE RESTE CELUI DE 4.2 ───────────────────────────────────────────────
 *
 * `creerDepotFaits()` → `fusionner_fait_extrait` (`security invoker`). Aucune écriture directe sur
 * la table, aucune seconde route : `tests/faits-architecture.test.ts` garde cette unicité depuis
 * 4.2, et cette story ne l'entame pas.
 */

export type EtatMemoire = { statut: "ok" } | { statut: "erreur"; message: string };

const REFUS_GENERIQUE: EtatMemoire = { statut: "erreur", message: "Impossible pour le moment." };

const MOTIF: Record<"vide" | "trop_longue" | "inchangee", string> = {
  vide: copie.REFUS_VIDE,
  trop_longue: copie.REFUS_TROP_LONGUE,
  inchangee: copie.REFUS_INCHANGEE,
};

/**
 * Corriger une phrase en place (AC2).
 *
 * ⚠️ `actuel` vient du CLIENT, et il ne sert qu'à refuser une correction identique — jamais à
 * décider ce qui est écrit. Un client qui mentirait sur `actuel` obtiendrait au pire d'enregistrer
 * une phrase déjà en place, ce qui est exactement ce qu'il aurait pu faire en la modifiant d'un
 * espace. Il n'y a donc rien à garder ici.
 *
 * Le REFUS APRÈS RÉVOCATION n'est pas testé dans ce fichier : c'est le trigger de 0018 qui lève, et
 * lui seul voit l'état du consentement au moment de l'écriture. Le dupliquer ici fabriquerait deux
 * sources pour la même règle, dont l'une pourrait dériver — la page annonce le refus d'avance (D2),
 * ce qui n'est pas la même chose que de le décider.
 */
export async function corrigerFait(cle: string, brut: string, actuel: string): Promise<EtatMemoire> {
  const verdict = validerCorrection(brut, actuel);
  if (!verdict.ok) return { statut: "erreur", message: MOTIF[verdict.refus] };

  try {
    await creerDepotFaits().corriger(cle, verdict.contenu);
  } catch {
    // ⚠️ Le message ne porte PAS l'erreur Postgres. Celle de 4.2 cite sa propre règle art. 9, et
    // celle de 0056 citerait la valeur refusée — c'est-à-dire du contenu art. 9 à l'écran, remonté
    // par la porte du diagnostic (NFR-022).
    return { statut: "erreur", message: copie.CORRECTION_APRES_REVOCATION };
  }
  revalidatePath("/memoire");
  return { statut: "ok" };
}

/**
 * Supprimer (AC3) — ÉCRIT IMMÉDIATEMENT, sans délai (décision D4).
 *
 * Le réflexe serait de retarder l'écriture de dix secondes et de l'annuler avant qu'elle parte.
 * C'est plus simple et c'est faux : si elle ferme l'onglet dans l'intervalle, elle croit avoir
 * effacé et rien n'a été effacé. Pour un droit à l'effacement, le sens de l'erreur n'est pas
 * négociable — et l'AC3 le dit au littéral, « la suppression est immédiate ».
 */
export async function supprimerFait(cle: string): Promise<EtatMemoire> {
  try {
    await creerDepotFaits().supprimer(cle);
  } catch {
    return REFUS_GENERIQUE;
  }
  revalidatePath("/memoire");
  return { statut: "ok" };
}

/**
 * Annuler une suppression (AC3) — une RE-DÉPOSITION, pas un rembobinage (décision D3).
 *
 * ⚠️ IL N'Y A PAS D'AUTRE FORME POSSIBLE, et c'est important de savoir pourquoi. Le tombstone VIDE
 * le contenu : c'est sa raison d'être, faire partir l'art. 9. Un rembobinage exact exigerait donc
 * soit de conserver le contenu supprimé (ce qui annule le tombstone), soit de rouvrir le chemin de
 * ré-activation que 4.2 a fermé exprès (« le chemin utilisatrice ne pose que corrige/supprime —
 * jamais 'actif' »). Aucun des deux n'est acceptable.
 *
 * Le fait revient donc en `utilisatrice`/`corrige` : il devient POSSÉDÉ, et la ré-extraction ne le
 * touchera plus jamais. C'est la bonne direction — après un aller-retour par la corbeille, la phrase
 * est celle qu'elle a ré-affirmée, pas celle qu'une machine a produite.
 *
 * `extrait_source_id` survit : ni la suppression ni la correction n'y touchent (0018).
 */
export async function annulerSuppression(cle: string, contenu: string): Promise<EtatMemoire> {
  // On passe par le même chemin que la correction — et donc par la même validation : une annulation
  // qui reposerait une phrase vide recréerait exactement la ligne que 0056 interdit.
  return corrigerFait(cle, contenu, "");
}
