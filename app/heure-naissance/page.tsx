import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { etapeOnboardingPour } from "@/app/(auth)/etat-onboarding";
import { OU_TROUVER_SON_HEURE } from "@/lib/domain/message-sans-heure";
import FormulaireHeure from "./formulaire-heure";
import s from "./heure-naissance.module.css";

// NFR-015 / identité de route — « Anam » partout, jamais un titre qui dit l'intimité de la page.
export const metadata = { title: "Anam" };

/**
 * /heure-naissance — LA HALTE DE COMPLÉTION DU SOCLE (Story 5.3, AC4/AC5).
 *
 * Une HALTE, pas une région du monde : elle se pose par-dessus la scène et y renvoie. Elle est la
 * destination de « Ajouter mon heure », la première des deux actions de la fiche du tronc.
 *
 * ── LA MÊME GARDE D'ÉTAT QUE PARTOUT AILLEURS ──────────────────────────────────────────────────
 *
 * Copiée sur `/synthese`, et pour la raison écrite dans l'en-tête d'`etat-onboarding.ts` : « une
 * barrière oubliée dans un seul chemin suffit à laisser passer un mineur ». Cette page ÉCRIT des
 * données de naissance ; une adolescente barrée après coup ou une femme ayant révoqué son
 * consentement n'ont rien à y faire, et la RLS seule ne le dirait pas (ces colonnes sont des
 * données ORDINAIRES au sens de 0039, pas de l'art. 9 — la write-gate ne les couvre donc pas).
 *
 * ── POURQUOI CE N'EST PAS DANS L'ONBOARDING ────────────────────────────────────────────────────
 *
 * Demander l'heure de naissance à l'inscription mettrait une démarche administrative — aller
 * chercher une copie intégrale d'acte de naissance à la mairie — entre elle et sa première séance.
 * FR-048 rend d'ailleurs ces champs facultatifs. On les demande le jour où elle le décide, depuis
 * son tronc.
 */
export default async function Page() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrer");

  const etape = await etapeOnboardingPour(supabase, user.id);
  if (etape === "barre") redirect("/barriere");
  if (etape === "mineur") {
    await supabase.auth.signOut();
    redirect("/entrer?refus=age");
  }
  if (etape === "naissance") redirect("/naissance");
  if (etape === "consentement") redirect("/consentement");
  if (etape === "revoque") redirect("/consentement/revoque");

  // Ce qui est DÉJÀ gravé (revue du 2026-08-12, A2). Le write-once de 0039 étant PAR COLONNE, elle
  // peut avoir enregistré sa commune sans son heure et revenir des mois plus tard : le formulaire
  // ne redemande que ce qui manque, et une panne de lecture le fait tout demander plutôt que de
  // prétendre que rien n'est posé — le serveur, lui, refusera proprement une réécriture.
  const { data: deja } = await supabase
    .from("utilisatrice")
    .select("heure_naissance, lieu_naissance")
    .eq("id", user.id)
    .maybeSingle<{ heure_naissance: string | null; lieu_naissance: string | null }>();

  return (
    <main className={s.halte}>
      <h1 className="t-titre">Ton heure de naissance</h1>
      {/* La même phrase que la fiche du tronc, depuis la même source : un second texte divergerait. */}
      <p className="t-corps">{OU_TROUVER_SON_HEURE}</p>
      <FormulaireHeure deja={{ heure: deja?.heure_naissance ?? null, lieu: deja?.lieu_naissance ?? null }} />
    </main>
  );
}
