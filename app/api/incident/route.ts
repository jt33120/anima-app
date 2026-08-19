import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";

/**
 * Story 4.6 (AC2 [DUR défensif]) — le CLIENT signale une RÉGRESSION d'affichage détectée : l'arbre a voulu
 * reculer (état/intensité inférieurs au maximum déjà connu), ou une branche connue a disparu. Le rendu ne
 * peut PAS journaliser lui-même (`@/lib/safety` interdit à `render/`, AD-7) ni `fetch` ailleurs que vers
 * `^/api/` — d'où cette route.
 *
 * Revue 4.6 — deux corrections : (1) le message ne MENT plus (on réutilisait le journaliseur d'incident de
 * sécurité, dont le libellé annonce « indisponibilité d'une RPC de sécurité » : un observateur cherchait une
 * panne de RPC là où il s'agit d'une anomalie d'affichage) ; (2) un PLAFOND par utilisatrice évite qu'un
 * client bavard (ou malveillant) ne noie le journal partagé où vivent les incidents de détresse.
 *
 * On ne journalise QUE le TYPE d'anomalie — jamais l'id de branche, jamais le nom, jamais le verbatim (NFR-022).
 */
export const dynamic = "force-dynamic";

const PLAFOND_PAR_FENETRE = 12;
const FENETRE_MS = 60_000;
const compteurs = new Map<string, { debut: number; n: number }>();

function plafondAtteint(cle: string, maintenant: number): boolean {
  const c = compteurs.get(cle);
  if (!c || maintenant - c.debut > FENETRE_MS) {
    compteurs.set(cle, { debut: maintenant, n: 1 });
    return false;
  }
  c.n += 1;
  return c.n > PLAFOND_PAR_FENETRE;
}

export async function POST(request: Request): Promise<Response> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "non_authentifie" }, { status: 401 });

  let corps: unknown;
  try {
    corps = await request.json();
  } catch {
    return NextResponse.json({ code: "corps_invalide" }, { status: 400 });
  }
  // Le client envoie UN signalement par réconciliation, portant la LISTE des types d'anomalie constatés.
  // Re-revue : il en envoyait un PAR incident, donc une seule vraie régression touchant K branches partait
  // en 2K requêtes et pouvait franchir le plafond toute seule — la régression se faisait avaler par son
  // propre bruit, exactement l'inverse de ce que le plafond protège. `champ` reste accepté (compatibilité).
  const { champ, champs } = (corps ?? {}) as { champ?: string; champs?: unknown };
  const RECONNUS = ["etat", "intensite", "disparition"];
  const bruts = Array.isArray(champs) ? champs : champ !== undefined ? [champ] : [];
  const surs = [...new Set(bruts.map((c) => (typeof c === "string" && RECONNUS.includes(c) ? c : "inconnu")))];
  if (surs.length === 0) surs.push("inconnu");

  if (plafondAtteint(user.id, Date.now())) {
    // Silencieux et sans effet : on protège le journal, on ne signale rien au client.
    return NextResponse.json({ ok: true });
  }

  // Libellé PROPRE à l'anomalie d'affichage (≠ incident de sécurité), sans aucune donnée art. 9.
  console.warn("arbre: régression d’affichage détectée au rendu — état supérieur conservé (AC2, Story 4.6)", {
    champs: surs,
  });
  return NextResponse.json({ ok: true });
}
