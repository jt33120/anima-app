"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { creerDepotFaits } from "@/lib/data/depot-faits";
import {
  apercuDeCorrection,
  ecrireHeureCorrigee,
  lireNaissance,
} from "@/lib/data/corriger-naissance";
import { validerCorrection } from "@/lib/domain/memoire-retenue";
import { normaliserHeure } from "@/lib/domain/correction-naissance";
import * as copie from "@/lib/domain/copie-memoire";
import * as copieNaissance from "@/lib/domain/copie-naissance";

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

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Story 6.5b — L'HEURE DE NAISSANCE : APERCEVOIR, PUIS CORRIGER
// ══════════════════════════════════════════════════════════════════════════════════════════════
//
// DEUX ACTIONS, ET LA PREMIÈRE N'ÉCRIT RIEN. C'est toute la story : la correction n'est pas
// plafonnée (art. 16 ne s'épuise pas au premier usage), donc ce qui la rend sûre est qu'elle ne
// soit jamais aveugle. `apercevoirCorrection` calcule le thème que produirait la nouvelle heure
// sans rien graver — `calculerThemeNatal` est pur, c'est ce qui rend l'aperçu possible.
//
// ⚠️ AUCUNE DES DEUX N'EST LA GARDE. `authenticated` détient l'UPDATE sur `heure_naissance`
// (grant colonne de 0041) : ce qui refuse une correction sans consentement est le trigger
// `naissance_corrigible` (0060), et rien d'autre. Ici vivent les MOTS d'un refus, pas le refus.

export type EtatApercu =
  | { readonly statut: "apercu"; readonly heure: string; readonly phrases: readonly string[] }
  | { readonly statut: "erreur"; readonly message: string };

async function identite() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, id: user.id } : null;
}

export async function apercevoirCorrection(brut: string): Promise<EtatApercu> {
  const session = await identite();
  if (!session) return { statut: "erreur", message: copieNaissance.messageDeRefus("format") };

  const etat = await lireNaissance(session.supabase, session.id);
  const saisie = normaliserHeure(brut, etat?.heure ?? null);
  if (!saisie.ok) {
    return { statut: "erreur", message: copieNaissance.messageDeRefus(saisie.refus) };
  }

  const apercu = await apercuDeCorrection(session.supabase, session.id, saisie.heure);
  // Pas de comparaison possible (aucune heure gravée, ou aucune date de naissance). L'écran ne
  // devrait même pas avoir proposé le champ ; on ne fabrique pas un aperçu vide pour autant.
  if (!apercu) return { statut: "erreur", message: copieNaissance.HEURE_ABSENTE };

  return {
    statut: "apercu",
    heure: saisie.heure,
    phrases: copieNaissance.phrasesApercu(apercu),
  };
}

/**
 * L'écriture. `heure` vient de l'aperçu que le client vient d'afficher — mais elle est RE-VALIDÉE
 * ici : un client qui posterait autre chose obtiendrait au pire d'écrire une heure valide qu'il n'a
 * pas regardée, ce qui reste sa propre donnée. Ce qu'on refuse est une chaîne malformée qui ferait
 * remonter une erreur Postgres brute à l'écran.
 */
export async function corrigerHeureNaissance(heure: string): Promise<EtatMemoire> {
  const session = await identite();
  if (!session) return REFUS_GENERIQUE;

  const etat = await lireNaissance(session.supabase, session.id);
  const saisie = normaliserHeure(heure, etat?.heure ?? null);
  if (!saisie.ok) {
    return { statut: "erreur", message: copieNaissance.messageDeRefus(saisie.refus) };
  }

  const issue = await ecrireHeureCorrigee(session.supabase, session.id, saisie.heure);
  if (issue === "consentement_absent") {
    return { statut: "erreur", message: copieNaissance.CORRECTION_APRES_REVOCATION };
  }
  if (issue === "refusee") return REFUS_GENERIQUE;

  // ⚠️ On ne recalcule RIEN ici (décision D5 de la 5.3, tenue) : `lireThemeNatal` regrave tout seul
  // à la lecture suivante, parce que l'empreinte des entrées a changé. On invalide simplement les
  // écrans qui affichent le socle, pour que « la prochaine ouverture » soit vraiment la prochaine.
  revalidatePath("/memoire");
  revalidatePath("/");
  return { statut: "ok" };
}
