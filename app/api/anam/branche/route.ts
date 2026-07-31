import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { creerDepotBranche } from "@/lib/data/depot-branche";
import { creerDepotSignalReconcept } from "@/lib/data/depot-reconceptualisation";
import { nomValide } from "@/lib/domain/branche";
import { journaliserIncidentSecurite } from "@/lib/safety/rpc-repli";

/**
 * Story 4.5 (T4) — l'écriture de la naissance d'une branche (chemin d'ouverture, distinct du pipeline de
 * `message`). Deux actions sous JWT :
 *   • `creer` { signalId, nom } → `creer_branche_depuis_signal` (la branche naît, le signal est consommé) ;
 *   • `refus` { signalId }      → `ecarter_signal_reconceptualisation` (« Non » : jamais rejoué).
 *
 * Les GARDES de sécurité (consentement, AD-17, isolation, nom non vide) vivent au point d'écriture (policy
 * WITH CHECK + RPC, migration 0021) : cet endpoint ne fait qu'authentifier, router, et valider le nom en
 * amont (AC2, échec rapide). AUCUNE clé IA, AUCUN secret ici (AD-2). NFR-022 : la réponse ne porte jamais
 * d'art. 9 (ni `nom`, ni message d'erreur), seulement un code neutre.
 */
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
  const { action, signalId, nom } = (corps ?? {}) as { action?: string; signalId?: string; nom?: string };
  if (typeof signalId !== "string" || signalId.length === 0) {
    return NextResponse.json({ code: "signal_manquant" }, { status: 400 });
  }

  try {
    if (action === "creer") {
      // [AC2] le nom donné par elle : échec rapide si vide (la RPC + le CHECK + la policy le regardent aussi).
      if (typeof nom !== "string" || !nomValide(nom)) {
        return NextResponse.json({ code: "nom_requis" }, { status: 400 });
      }
      await creerDepotBranche(supabase).creerDepuisSignal({ signalId, nom });
      return NextResponse.json({ ok: true });
    }
    if (action === "refus") {
      await creerDepotSignalReconcept(supabase).ecarter({ signalId });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ code: "action_invalide" }, { status: 400 });
  } catch (e) {
    // Repli neutre : la garde (AD-17/consentement/isolation) a refusé, ou panne DB. Incident sans art. 9.
    journaliserIncidentSecurite("branche_endpoint", e);
    return NextResponse.json({ code: "echec" }, { status: 500 });
  }
}
