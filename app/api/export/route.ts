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

  const paquet = {
    exporte_le: new Date().toISOString(),
    compte,
    consentement,
  };

  return new NextResponse(JSON.stringify(paquet, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="anam-mes-donnees.json"',
      "Cache-Control": "no-store",
    },
  });
}
