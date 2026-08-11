"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { lieuxFrance } from "@/lib/astro/adapters/lieux-france";
import type { LieuNaissance } from "@/lib/astro/lieux";

/**
 * actions.ts — LA SAISIE DE L'HEURE ET DU LIEU DE NAISSANCE (Story 5.3, T7).
 *
 * ── UN SEUL `update`, ET C'EST UNE EXIGENCE, PAS UNE OPTIMISATION (piège P9) ───────────────────
 *
 * Les colonnes sont WRITE-ONCE (migration 0039) : `null → valeur` permis, `valeur → autre valeur`
 * refusé. Écrire l'heure puis le lieu en deux temps produirait donc un état à moitié valide et
 * DÉFINITIF si le second échoue — une heure gravée pour toujours, sans le lieu qui la rend
 * exploitable, et aucun moyen de réparer. La base l'interdit d'ailleurs déjà à moitié
 * (`utilisatrice_lieu_coordonnees_ensemble` exige lat et lon ensemble) ; on ne s'appuie pas
 * dessus pour autant.
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

export async function enregistrerHeureEtLieu(
  _prev: EtatHeure,
  formData: FormData,
): Promise<EtatHeure> {
  const heure = String(formData.get("heure_naissance") ?? "").trim();
  const code = String(formData.get("code_lieu") ?? "").trim();
  const confirme = formData.get("confirmation") === "oui";

  // `<input type="time">` rend « HH:MM » (ou « HH:MM:SS » avec des secondes). On refuse tout le
  // reste plutôt que de « réparer » une saisie : une heure mal lue est un ascendant faux, gravé.
  if (!/^\d{2}:\d{2}(?::\d{2})?$/.test(heure)) {
    return { statut: "erreur", message: "Entre une heure au format 07:15." };
  }
  const [hh, mm] = heure.split(":").map(Number);
  if (hh > 23 || mm > 59) {
    return { statut: "erreur", message: "Cette heure n'existe pas." };
  }

  // Le lieu est RE-RÉSOLU côté serveur à partir du seul code : voir l'en-tête.
  // ⚠️ `trouverParCode`, PAS `chercher` : `chercher` interroge le NOM, et aucune commune ne
  // s'appelle « 33063 » — la première version refusait donc toutes les saisies valides.
  const lieu = lieuxFrance().trouverParCode(code);
  if (!lieu) {
    return {
      statut: "erreur",
      message: "Je n'ai pas retrouvé cette commune. Choisis-la dans la liste proposée.",
    };
  }

  // AC8 — le geste ne se refait pas, et elle doit l'avoir dit. La garde est ici ET à l'écran : un
  // formulaire posté sans la case ne doit pas graver une heure pour toujours.
  if (!confirme) {
    return {
      statut: "erreur",
      message: "Coche la case : cette heure s'enregistre une fois et ne se modifie pas.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrer");

  // Déjà renseignée ? On le dit AVANT de tenter l'écriture. Sans ce contrôle, le trigger de 0039
  // renverrait une erreur Postgres brute qu'on afficherait comme une panne — alors que ce n'est
  // pas une panne : c'est déjà fait, et c'est irréversible par construction.
  const { data: existant, error: erreurLecture } = await supabase
    .from("utilisatrice")
    .select("heure_naissance")
    .eq("id", user.id)
    .maybeSingle<{ heure_naissance: string | null }>();
  if (erreurLecture) {
    return { statut: "erreur", message: "Enregistrement impossible. Réessaie." };
  }
  if (existant?.heure_naissance) {
    return {
      statut: "erreur",
      message: "Ton heure de naissance est déjà enregistrée — elle ne se modifie pas.",
    };
  }

  const { error } = await supabase
    .from("utilisatrice")
    .update({
      heure_naissance: heure.length === 5 ? `${heure}:00` : heure,
      lieu_naissance: lieu.nom,
      lieu_latitude: lieu.latitude,
      lieu_longitude: lieu.longitude,
      lieu_fuseau: lieu.fuseau,
    })
    .eq("id", user.id);
  // NFR-022 : ni l'heure, ni le lieu, ni les coordonnées ne sortent dans un message d'erreur.
  if (error) {
    return { statut: "erreur", message: "Enregistrement impossible. Réessaie." };
  }

  return { statut: "enregistre" };
}
