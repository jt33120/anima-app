import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { createSupabaseAdminClient } from "@/lib/data/supabase/admin";
import { creerAiPort } from "@/lib/ai/fabrique";
import { envoyerSousEgressArt9 } from "@/lib/ai/egress-guard";
import { ENTETES_ART9 } from "@/lib/ai/entetes-art9";
import type { MessageIa, RequeteIa } from "@/lib/ai/port";

/**
 * Route art. 9 (AD-2/AD-4) — le seam d'appel modèle de la Story 2.1 (la Story 2.2 le convertit en
 * streaming + fil de conversation). Ordre : auth → egress-guard (consentement + ZDR) → adaptateur
 * → métrage `usage_ia` (exactement une fois). Aucun SDK fournisseur, aucun analytics ici.
 *
 * Segment art. 9 : `no-store`/`dynamic`, runtime Node (secret serveur jamais sur Edge). Ne PAS
 * activer `experimental.cacheComponents` (incompatible avec `export const dynamic`).
 */
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { code: "non_authentifie", message: "Session requise." },
      { status: 401, headers: ENTETES_ART9 },
    );
  }

  const corps: unknown = await request.json().catch(() => null);
  const messages = extraireMessages(corps);
  if (!messages) {
    return NextResponse.json(
      { code: "requete_invalide", message: "Un tableau `messages` est requis." },
      { status: 400, headers: ENTETES_ART9 },
    );
  }

  const adaptateur = await creerAiPort();
  const requete: RequeteIa = { capacite: "echange", messages, contientArt9: true };
  const resultat = await envoyerSousEgressArt9({ supabase, adaptateur, requete });

  if (resultat.bloque) {
    // Consentement invalide/révoqué ou ZDR non prouvé → rien n'a été posté au fournisseur.
    return NextResponse.json(
      { code: `egress_bloque_${resultat.raison}`, message: "Envoi bloqué (consentement/ZDR)." },
      { status: 403, headers: ENTETES_ART9 },
    );
  }

  // Métrage server-authoritative, exactement une fois (idempotence). usage_ia est deny-by-default
  // → écriture via le client admin (service_role), tâche système non-art. 9 (AD-12).
  const cleIdempotence = request.headers.get("x-idempotence") ?? crypto.randomUUID();
  const admin = createSupabaseAdminClient();
  const { error: erreurMetrage } = await admin.from("usage_ia").upsert(
    {
      utilisatrice_id: user.id,
      cle_idempotence: cleIdempotence,
      tier: resultat.reponse.tier,
      modele: resultat.reponse.modele,
      tokens_entree: resultat.reponse.usage.tokensEntree,
      tokens_sortie: resultat.reponse.usage.tokensSortie,
    },
    { onConflict: "cle_idempotence", ignoreDuplicates: true },
  );
  if (erreurMetrage) {
    // Le métrage ne doit pas faire échouer la réponse ; il est journalisé (sans art. 9).
    console.error("usage_ia métrage échoué", { code: erreurMetrage.code });
  }

  return NextResponse.json({ texte: resultat.reponse.texte }, { headers: ENTETES_ART9 });
}

/** Valide le corps sans jamais journaliser le contenu (art. 9). */
function extraireMessages(corps: unknown): MessageIa[] | null {
  if (typeof corps !== "object" || corps === null || !("messages" in corps)) return null;
  const brut = (corps as { messages: unknown }).messages;
  if (!Array.isArray(brut)) return null;
  const roles = new Set(["user", "assistant", "system"]);
  const messages: MessageIa[] = [];
  for (const m of brut) {
    if (typeof m !== "object" || m === null) return null;
    const { role, content } = m as { role?: unknown; content?: unknown };
    if (typeof role !== "string" || !roles.has(role) || typeof content !== "string") return null;
    messages.push({ role: role as MessageIa["role"], content });
  }
  return messages.length > 0 ? messages : null;
}
