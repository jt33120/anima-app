"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { calculerAge } from "./age";

/**
 * ⚠️ `saisie` EST PORTÉE PAR L'ÉTAT D'ERREUR, ET C'EST LE CORRECTIF DE LA QA (tour 1, T19).
 *
 * `useActionState` réinitialise un formulaire non contrôlé après chaque action : une date au futur
 * effaçait le prénom ET la date, et tout était à ressaisir. Renvoyer ce qui a été tapé, et le
 * remettre en `defaultValue`, est le geste que React documente pour ça.
 *
 * Elle n'accompagne QUE l'erreur. Sur le chemin `mineur`, rien ne revient — la branche < 18 ans
 * n'écrit rien, pas même en mémoire de formulaire, et repeupler un écran qu'on vient de refuser
 * serait une invitation à retenter avec une autre date (AD-14, FR-071).
 */
export type SaisieNaissance = { prenom: string; date: string; nomComplet: string };

export type EtatAge = {
  statut: "saisie" | "mineur" | "erreur";
  message?: string;
  saisie?: SaisieNaissance;
};

/** Bornes de saisie — larges (noms composés, particules, alphabets non latins) mais finies. */
const MAX_PRENOM = 100;
const MAX_NOM_COMPLET = 200;

/**
 * Déclaration d'âge (Story 1.4). Contrôle de majorité CÔTÉ SERVEUR (NFR-023).
 * < 18 → drapeau `mineur_detecte` + déconnexion (aucune DOB stockée) ; suppression
 *        déférée à l'ordonnanceur (AD-14/FR-071).
 * ≥ 18 → `date_naissance` écrite une fois (immuable, trigger DB) puis parcours avance.
 * Écriture sous la session RLS de l'utilisatrice — jamais `service_role` (AD-12).
 *
 * Story 5.2 (T4) — `prenom` (obligatoire, FR-048) et `nom_complet` (facultatif) sont écrits DANS LA
 * MÊME mise à jour que la date. Deux conséquences voulues :
 *   - un seul aller-retour, donc aucun état intermédiaire où le prénom existerait sans la date ;
 *   - RIEN n'est écrit sur le chemin MINEUR, pas même le prénom — la branche < 18 ans ne pose que
 *     `mineur_detecte` et se termine, exactement comme avant (AD-14, FR-071).
 *
 * Ces deux colonnes sont volontairement HORS du write-once de la migration 0039 (`0039:69`) : un nom
 * se corrige (FR-064), une date de naissance non.
 */
export async function declarerAge(
  _prev: EtatAge,
  formData: FormData,
): Promise<EtatAge> {
  const valeur = String(formData.get("date_naissance") ?? "").trim();
  const prenom = String(formData.get("prenom") ?? "").trim();
  const nomCompletBrut = String(formData.get("nom_complet") ?? "").trim();
  // Ce qui a été tapé, rendu tel quel à chaque refus — sinon tout est à ressaisir (T19).
  const saisie: SaisieNaissance = { prenom, date: valeur, nomComplet: nomCompletBrut };

  if (prenom.length === 0) {
    return { statut: "erreur", message: "Dis-moi comment t'appeler.", saisie };
  }
  if (prenom.length > MAX_PRENOM || nomCompletBrut.length > MAX_NOM_COMPLET) {
    return { statut: "erreur", message: "C'est un peu long — raccourcis.", saisie };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valeur)) {
    return { statut: "erreur", message: "Entre une date valide.", saisie };
  }
  const age = calculerAge(valeur);
  if (Number.isNaN(age) || age > 130) {
    return { statut: "erreur", message: "Cette date ne semble pas valide.", saisie };
  }
  if (age < 0) {
    return { statut: "erreur", message: "Cette date est dans le futur.", saisie };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrer");

  if (age < 18) {
    await supabase
      .from("utilisatrice")
      .update({ mineur_detecte: true })
      .eq("id", user.id);
    await supabase.auth.signOut();
    return { statut: "mineur" };
  }

  const { error } = await supabase
    .from("utilisatrice")
    .update({
      date_naissance: valeur,
      prenom,
      // Vide ⇒ `null`, jamais `""`. La numérologie distingue « jamais renseigné » (`nom_absent`) de
      // « renseigné mais inexploitable » (`nom_sans_lettre`) ; une chaîne vide brouillerait les deux.
      nom_complet: nomCompletBrut.length > 0 ? nomCompletBrut : null,
    })
    .eq("id", user.id);
  if (error) {
    return { statut: "erreur", message: "Enregistrement impossible. Réessaie.", saisie };
  }

  redirect("/consentement");
}
