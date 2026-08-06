import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";

/**
 * Export des données du compte COURANT (Story 1.9, AC3 — « un export proposé avant suppression,
 * en une action »). Lecture SOUS la session RLS (`USING` ouvert au propriétaire) → fonctionne
 * MÊME sous barrière de minorité (le write-gate ne referme que l'ÉCRITURE). Ne lit QUE ses
 * propres rangs (getUser d'abord ; l'isolation est garantie par la RLS).
 *
 * NE PASSE PAS par la garde d'onboarding : un compte suspendu doit pouvoir exporter (sinon il
 * serait renvoyé à /barriere au lieu de télécharger). On vérifie seulement la session.
 *
 * SCOPE 1.9 : export MINIMAL et honnête (les rangs existants du compte). L'export EXHAUSTIF
 * FR-067 (toutes les tables art. 9 — journal, lecture, faits, branches, socle… — + propagation
 * aux sous-traitants et au PITR) est la Story 6.6, qui élargira ce seam.
 *
 * ── LA SYNTHÈSE Y ENTRE DÈS MAINTENANT (revue 4.9, T5-3) ────────────────────────────────────────
 *
 * Le reste du trou attend 6.6, mais pas celui-ci, et pour une raison de degré : elle ferme son
 * compte, télécharge son export, et n'y trouve pas une ligne des quarante récits que le produit a
 * écrits SUR elle. Ce sont des textes qu'elle n'a pas rédigés et qu'elle ne peut pas reconstituer
 * de mémoire — contrairement à son journal, dont elle connaît au moins la teneur. Les laisser
 * dehors, c'est effacer la seule copie.
 *
 * `preference_courriel` suit pour une raison plus simple : c'est une préférence qu'elle a exprimée,
 * et un export qui ne la restitue pas ne dit pas tout ce que le produit retient d'elle.
 */
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/entrer", request.url));

  const { data: compte } = await supabase
    .from("utilisatrice")
    .select("id, cree_le, date_naissance, mineur_detecte, barriere_minorite_le, echeance_suppression")
    .eq("id", user.id)
    .maybeSingle();

  const { data: consentement } = await supabase
    .from("consentement")
    .select("art9_accorde, ia_reconnue, cgu_acceptees, cree_le, revoked_at")
    .eq("utilisatrice_id", user.id)
    .maybeSingle();

  // Sous la session, donc sous la policy propriétaire de `synthese` : c'est elle qui garantit qu'on
  // n'exporte que les siennes, et pas une condition écrite ici qu'un refactor pourrait perdre (AD-12).
  const { data: syntheses } = await supabase
    .from("synthese")
    .select("periode_debut, periode_fin, contenu, tronquee, cree_le")
    .order("periode_fin", { ascending: true });

  // `jeton` n'est PAS exporté : c'est un identifiant technique de canal, pas une donnée qui la
  // concerne. Ce qui la concerne, c'est son refus et sa date.
  const { data: preferenceCourriel } = await supabase
    .from("preference_courriel")
    .select("refuse_le, maj_le")
    .eq("utilisatrice_id", user.id)
    .maybeSingle();

  const paquet = {
    exporte_le: new Date().toISOString(),
    compte,
    consentement,
    syntheses,
    preference_courriel: preferenceCourriel,
  };

  return new NextResponse(JSON.stringify(paquet, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="anam-mes-donnees.json"',
      "Cache-Control": "no-store",
    },
  });
}
