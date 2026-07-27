import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { createSupabaseAdminClient } from "@/lib/data/supabase/admin";
import { creerAiPort } from "@/lib/ai/fabrique";
import { envoyerSousEgressArt9 } from "@/lib/ai/egress-guard";
import { ENTETES_ART9 } from "@/lib/ai/entetes-art9";
import { extraireMessages } from "@/lib/ai/valider-messages";
import type { RequeteIa } from "@/lib/ai/port";

/**
 * Route art. 9 (AD-2/AD-4) — le seam d'appel modèle de la Story 2.1 (la Story 2.2 le convertit en
 * streaming + fil de conversation). Ordre : auth → validation → egress-guard (consentement + ZDR +
 * barrière mineur) → adaptateur → métrage `usage_ia`. Aucun SDK fournisseur, aucun analytics ici.
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
      { code: "requete_invalide", message: "Un tableau `messages` (rôles user/assistant) est requis." },
      { status: 400, headers: ENTETES_ART9 },
    );
  }

  try {
    const adaptateur = await creerAiPort();
    const requete: RequeteIa = { capacite: "echange", messages, contientArt9: true };
    const resultat = await envoyerSousEgressArt9({ supabase, adaptateur, requete });

    if (resultat.bloque) {
      // Consentement invalide/révoqué, ZDR non prouvé, ou barrière de minorité → rien posté.
      return NextResponse.json(
        { code: `egress_bloque_${resultat.raison}`, message: "Envoi bloqué (consentement / ZDR / barrière)." },
        { status: 403, headers: ENTETES_ART9 },
      );
    }

    // Métrage best-effort, SERVER-AUTHORITATIVE : la clé d'idempotence est générée CÔTÉ SERVEUR
    // (jamais un en-tête client — revue 2.1), une ligne par requête logique. usage_ia est
    // deny-by-default → écriture via le client admin (service_role), tâche système non-art. 9
    // (AD-12). L'échec n'est PAS fatal (l'utilisatrice a déjà sa réponse) : c'est un « au plus une
    // fois » assumé ici ; la durabilité « exactement une fois » par réconciliation relève du
    // streaming (Story 2.2, NFR-014).
    const admin = createSupabaseAdminClient();
    const { error: erreurMetrage } = await admin.from("usage_ia").upsert(
      {
        utilisatrice_id: user.id,
        cle_idempotence: crypto.randomUUID(),
        tier: resultat.reponse.tier,
        modele: resultat.reponse.modele,
        tokens_entree: resultat.reponse.usage.tokensEntree,
        tokens_sortie: resultat.reponse.usage.tokensSortie,
      },
      { onConflict: "utilisatrice_id,cle_idempotence", ignoreDuplicates: true },
    );
    if (erreurMetrage) {
      console.error("usage_ia métrage échoué", { code: erreurMetrage.code });
    }

    return NextResponse.json({ texte: resultat.reponse.texte }, { headers: ENTETES_ART9 });
  } catch (e) {
    // Boot-guard (misconfig) ou erreur fournisseur : la réponse d'erreur reste une réponse art. 9
    // CONFORME (no-store + CSP), sans contenu art. 9 ni détail d'erreur en clair (NFR-022).
    console.error("anam/message : échec serveur", { nom: e instanceof Error ? e.name : "inconnu" });
    return NextResponse.json(
      { code: "erreur_serveur", message: "Service indisponible, réessaie." },
      { status: 500, headers: ENTETES_ART9 },
    );
  }
}
