import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { creerDepotBranche } from "@/lib/data/depot-branche";
import { etapeOnboardingPour } from "@/app/(auth)/etat-onboarding";
import { journaliserIncidentSecurite } from "@/lib/safety/rpc-repli";

/**
 * Story 4.6 (AC4) — lecture de l'ÉCHANGE SOURCE d'une branche pour « Voir dans la conversation ». GET sous JWT :
 * la RPC `charger_echange_source` (security invoker, migration 0022) borne à la propriétaire (RLS). Le verbatim
 * (art. 9) est renvoyé DÉLIBÉRÉMENT (affichage légitime, FR-027) mais la route est `no-store` et n'écrit AUCUN
 * contenu dans un log/erreur (NFR-022 : code neutre). Aucun secret, aucune clé IA (AD-2).
 */
/** Route art. 9 : jamais mise en cache, jamais pré-rendue (le verbatim d'une utilisatrice ne doit pouvoir
 *  être servi à personne d'autre, ni resservi depuis un intermédiaire). */
export const dynamic = "force-dynamic";
export const revalidate = 0;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request): Promise<Response> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "non_authentifie" }, { status: 401 });

  // GARDE D'ÉTAT (revue 4.6) : la RLS d'`entree_journal` autorise la LECTURE au propriétaire même après
  // révocation (c'est voulu : l'export FR-067 doit survivre). Mais SERVIR le verbatim art. 9 dans l'app à
  // quelqu'un qui a retiré son consentement — ou dont le compte est barré-minorité — n'est pas de l'export :
  // c'est de l'usage produit. On aligne donc cette route sur le reste du produit, comme la scène le fait déjà.
  const etape = await etapeOnboardingPour(supabase, user.id);
  if (etape !== "suite") return NextResponse.json({ code: "indisponible" }, { status: 403 });

  const extrait = new URL(request.url).searchParams.get("extrait");
  // Un identifiant mal formé n'est pas un incident de sécurité : on refuse proprement au lieu de laisser
  // Postgres lever un 22P02 journalisé comme une panne (revue 4.6).
  if (typeof extrait !== "string" || !UUID.test(extrait)) {
    return NextResponse.json({ code: "extrait_invalide" }, { status: 400 });
  }

  try {
    const messages = await creerDepotBranche(supabase).chargerEchangeSource({ extraitSourceId: extrait });
    return NextResponse.json(
      { messages: messages.map((m) => ({ id: m.id, role: m.role, contenu: m.contenu, estCible: m.estCible })) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    journaliserIncidentSecurite("echange_source", e);
    return NextResponse.json({ code: "echec" }, { status: 500 });
  }
}
