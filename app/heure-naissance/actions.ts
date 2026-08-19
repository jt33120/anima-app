"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { lieuxFrance } from "@/lib/astro/adapters/lieux-france";
import type { LieuNaissance } from "@/lib/astro/lieux";

/**
 * actions.ts — LA SAISIE DE L'HEURE ET DU LIEU DE NAISSANCE (Story 5.3, T7).
 *
 * ── UN SEUL `update` PAR ENVOI, ET C'EST UNE EXIGENCE, PAS UNE OPTIMISATION (piège P9) ─────────
 *
 * Les colonnes sont WRITE-ONCE (migration 0039) : `null → valeur` permis, `valeur → autre valeur`
 * refusé. Découper UN MÊME ENVOI en deux écritures produirait un état à moitié valide et DÉFINITIF
 * si la seconde échoue — une heure gravée pour toujours, sans le lieu qui la rend exploitable, et
 * aucun moyen de réparer. La base l'interdit d'ailleurs déjà à moitié
 * (`utilisatrice_lieu_coordonnees_ensemble` exige lat et lon ensemble) ; on ne s'appuie pas
 * dessus pour autant.
 *
 * ⚠️ À NE PAS CONFONDRE avec deux VISITES successives (revue du 2026-08-12, A2) : enregistrer son
 * lieu aujourd'hui et son heure dans six mois est parfaitement légal — chaque colonne a son propre
 * write-once, et chaque visite reste atomique. Ce que la règle interdit, c'est de laisser une
 * SEULE soumission à mi-chemin.
 *
 * ── LES COORDONNÉES NE VIENNENT JAMAIS DU CLIENT ──────────────────────────────────────────────
 *
 * Le formulaire n'envoie qu'un CODE INSEE. Le serveur re-résout lui-même le lieu par `LieuxPort`.
 * Accepter une latitude et une longitude postées reviendrait à laisser n'importe qui graver — de
 * façon irréversible — des coordonnées arbitraires dans une donnée de calcul. Le champ est
 * facultatif à l'écran ; il ne l'est pas dans la chaîne de confiance.
 *
 * ── AUCUN RECALCUL ICI, ET C'EST DÉLIBÉRÉ (décision D5) ───────────────────────────────────────
 *
 * On écrit les entrées, rien d'autre. Le thème natal se recalcule TOUT SEUL à la lecture suivante,
 * parce que l'empreinte des entrées aura changé (`depot-theme-natal.ts`). Déclencher le recalcul
 * ici le rendrait fragile exactement là où il ne peut pas l'être : si l'appel échouait, l'heure
 * serait écrite, le thème périmé, et elle ne pourrait plus rien réessayer.
 *
 * Écriture sous le JWT de l'utilisatrice — jamais `service_role` (AD-12).
 */

export type EtatHeure = { statut: "saisie" | "erreur" | "enregistre"; message?: string };

/** Assez pour choisir sans faire défiler un département entier. */
const RESULTATS_MAX = 8;

/**
 * La recherche de lieu. Server Action et non route publique : elle est déjà authentifiée par la
 * session, et n'ajoute aucune surface d'API. Le référentiel (1,4 Mo) ne quitte jamais le serveur —
 * seuls les quelques résultats affichés traversent.
 */
export async function chercherLieux(requete: string): Promise<LieuNaissance[]> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  return [...lieuxFrance().chercher(requete, RESULTATS_MAX)];
}

/**
 * ── L'HEURE EST FACULTATIVE, LE LIEU NE L'EST PAS (revue du 2026-08-12, A2) ────────────────────
 *
 * Le formulaire d'origine exigeait les DEUX. Conséquence : quelqu'un qui ne connaît pas son heure
 * de naissance ne pouvait pas non plus donner son LIEU — alors que le lieu seul répare déjà
 * beaucoup. Il apporte le FUSEAU, et le fuseau ramène la fenêtre d'incertitude de 50 h à 24 h : des
 * corps déclarés « signe indéterminable » redeviennent déterminables, et l'instant retenu passe de
 * midi UTC à midi du jour local (A7). Le lieu, à lui seul, rend le socle plus vrai.
 *
 * Le refus est donc inversé : on demande l'heure, et si elle ne l'a pas, elle le DIT. Une case
 * cochée plutôt qu'un champ discrètement vide — parce que les colonnes sont write-once et qu'un
 * thème gravé sans heure par distraction ne se rattrape pas d'un clic.
 *
 * ── ELLE PEUT REVENIR ──────────────────────────────────────────────────────────────────────────
 *
 * Le write-once de 0039 est PAR COLONNE (`null → valeur` permis). Enregistrer le lieu aujourd'hui
 * et l'heure le jour où elle la trouve est donc parfaitement légal — et c'est exactement le
 * parcours qu'ouvre ce découplage. La fiche du tronc continue d'inviter tant que `manqueLHeure`.
 */
export async function enregistrerHeureEtLieu(
  _prev: EtatHeure,
  formData: FormData,
): Promise<EtatHeure> {
  const heure = String(formData.get("heure_naissance") ?? "").trim();
  const code = String(formData.get("code_lieu") ?? "").trim();
  const sansHeure = formData.get("sans_heure") === "oui";
  const confirme = formData.get("confirmation") === "oui";

  // Contradiction franche : la case dit « je ne la connais pas » et le champ porte une heure. On
  // ne choisit PAS à sa place laquelle des deux compte — l'écriture est irréversible.
  if (sansHeure && heure) {
    return {
      statut: "erreur",
      message: "Tu as coché « je ne connais pas mon heure » et rempli le champ. Choisis l’un ou l’autre.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrer");

  // Ce qui est DÉJÀ gravé, lu AVANT toute écriture. Sans ce contrôle, le trigger de 0039 renverrait
  // une erreur Postgres brute qu'on afficherait comme une panne — alors que ce n'est pas une panne :
  // c'est déjà fait, et c'est irréversible par construction.
  const { data: existant, error: erreurLecture } = await supabase
    .from("utilisatrice")
    .select("heure_naissance, lieu_naissance")
    .eq("id", user.id)
    .maybeSingle<{ heure_naissance: string | null; lieu_naissance: string | null }>();
  if (erreurLecture) {
    return { statut: "erreur", message: "Enregistrement impossible. Réessaie." };
  }
  const heureDejaGravee = existant?.heure_naissance != null;
  const lieuDejaGrave = existant?.lieu_naissance != null;

  // ⚠️ CE MESSAGE A CHANGÉ AVEC LA STORY 6.5b, ET IL LE FALLAIT. Il disait « elle ne se modifie
  // pas » : c'était vrai jusqu'à la migration 0060, et c'est devenu un mensonge le jour où elle a
  // ouvert la correction (art. 16). Un écran qui affirme une impossibilité levée est pire qu'un
  // écran muet — il fait renoncer quelqu'un à un droit qu'il a.
  //
  // Ce formulaire-ci reste celui de l'AJOUT : la correction vit sur `/memoire`, avec son aperçu.
  if (heureDejaGravee && heure) {
    return {
      statut: "erreur",
      message:
        "Ton heure de naissance est déjà enregistrée. Pour la corriger, va sur « Ce qu’Anam retient » (/memoire) : tu y verras ce que le changement modifie avant de valider.",
    };
  }

  // `<input type="time">` rend « HH:MM » (ou « HH:MM:SS » avec des secondes). On refuse tout le
  // reste plutôt que de « réparer » une saisie : une heure mal lue est un ascendant faux, gravé.
  const ecrireHeure = !sansHeure && !heureDejaGravee;
  if (ecrireHeure) {
    if (!/^\d{2}:\d{2}(?::\d{2})?$/.test(heure)) {
      return { statut: "erreur", message: "Entre une heure au format 07:15." };
    }
    const [hh, mm] = heure.split(":").map(Number);
    if (hh > 23 || mm > 59) {
      return { statut: "erreur", message: "Cette heure n’existe pas." };
    }
  }

  // Le lieu est RE-RÉSOLU côté serveur à partir du seul code : voir l'en-tête.
  // ⚠️ `trouverParCode`, PAS `chercher` : `chercher` interroge le NOM, et aucune commune ne
  // s'appelle « 33063 » — la première version refusait donc toutes les saisies valides.
  const lieu = code ? lieuxFrance().trouverParCode(code) : null;
  if (code && !lieu) {
    return {
      statut: "erreur",
      message: "Je n’ai pas retrouvé cette commune. Choisis-la dans la liste proposée.",
    };
  }
  if (!lieu && !lieuDejaGrave) {
    return {
      statut: "erreur",
      message: "Choisis ta commune de naissance dans la liste : c’est elle qui dit à quel instant ton jour de naissance correspond.",
    };
  }
  // Une commune DIFFÉRENTE de celle déjà gravée : le trigger la refuserait par une erreur brute.
  if (lieu && lieuDejaGrave && lieu.nom !== existant!.lieu_naissance) {
    return {
      statut: "erreur",
      message: "Ton lieu de naissance est déjà enregistré — il ne se modifie pas.",
    };
  }

  // Rien de neuf à écrire : on le dit plutôt que de simuler un enregistrement.
  if (!ecrireHeure && (!lieu || lieuDejaGrave)) {
    return {
      statut: "erreur",
      message: "Tout ce que tu peux ajouter est déjà enregistré.",
    };
  }

  // AC8 — le geste ne se refait pas, et elle doit l'avoir dit. La garde est ici ET à l'écran : un
  // formulaire posté sans la case ne doit pas graver une heure pour toujours.
  if (!confirme) {
    return {
      statut: "erreur",
      message: "Coche la case : ce que tu enregistres ici s’enregistre une fois et ne se modifie pas.",
    };
  }

  const maj: Record<string, string | number> = {};
  if (ecrireHeure) maj.heure_naissance = heure.length === 5 ? `${heure}:00` : heure;
  if (lieu && !lieuDejaGrave) {
    maj.lieu_naissance = lieu.nom;
    maj.lieu_latitude = lieu.latitude;
    maj.lieu_longitude = lieu.longitude;
    maj.lieu_fuseau = lieu.fuseau;
  }

  const { error } = await supabase.from("utilisatrice").update(maj).eq("id", user.id);
  // NFR-022 : ni l'heure, ni le lieu, ni les coordonnées ne sortent dans un message d'erreur.
  if (error) {
    return { statut: "erreur", message: "Enregistrement impossible. Réessaie." };
  }

  return { statut: "enregistre" };
}
