import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { creerDepotBranche } from "@/lib/data/depot-branche";
import { creerDepotSignalReconcept } from "@/lib/data/depot-reconceptualisation";
import { nomValide } from "@/lib/domain/branche";
import { journaliserIncidentSecurite, journaliserRefusGarde, estRefusMetier } from "@/lib/safety/rpc-repli";

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
  const { action, signalId, nom, brancheId } = (corps ?? {}) as {
    action?: string;
    signalId?: string;
    nom?: string;
    brancheId?: string;
  };

  try {
    if (action === "creer") {
      if (typeof signalId !== "string" || signalId.length === 0) {
        return NextResponse.json({ code: "signal_manquant" }, { status: 400 });
      }
      // [AC2] le nom donné par elle : échec rapide si vide (la RPC + le CHECK + la policy le regardent aussi).
      if (typeof nom !== "string" || !nomValide(nom)) {
        return NextResponse.json({ code: "nom_requis" }, { status: 400 });
      }
      await creerDepotBranche(supabase).creerDepuisSignal({ signalId, nom });
      return NextResponse.json({ ok: true });
    }
    if (action === "refus") {
      if (typeof signalId !== "string" || signalId.length === 0) {
        return NextResponse.json({ code: "signal_manquant" }, { status: 400 });
      }
      await creerDepotSignalReconcept(supabase).ecarter({ signalId });
      return NextResponse.json({ ok: true });
    }
    if (action === "renommer") {
      // Story 4.6 (AC6) : renommer une branche. Le nouveau nom reste donné par elle (AC2, échec rapide si vide).
      // Les gardes (consentement art. 9, propriétaire, nom non vide, immuabilité etat/intensite) vivent au point
      // d'écriture (policy branche_renommage + trigger, migration 0022) — l'endpoint ne fait que router/valider.
      if (typeof brancheId !== "string" || brancheId.length === 0) {
        return NextResponse.json({ code: "branche_manquante" }, { status: 400 });
      }
      if (typeof nom !== "string" || !nomValide(nom)) {
        return NextResponse.json({ code: "nom_requis" }, { status: 400 });
      }
      await creerDepotBranche(supabase).renommer({ brancheId, nom });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ code: "action_invalide" }, { status: 400 });
  } catch (e) {
    // On DISTINGUE le refus d'une garde de la panne. Un refus (consentement retiré, branche non possédée,
    // AD-17, nom hors forme) est un comportement ATTENDU : il ne doit pas s'annoncer comme une panne de RPC
    // de sécurité, sinon le canal des vrais incidents — celui où vivent les alertes de détresse — se noie
    // sous du bruit ordinaire (re-revue). Aucun art. 9 dans la réponse ni dans le journal, dans les deux cas.
    if (estRefusMetier(e)) {
      journaliserRefusGarde("branche_endpoint", e);
      return NextResponse.json({ code: "refuse" }, { status: 403 });
    }
    journaliserIncidentSecurite("branche_endpoint", e);
    return NextResponse.json({ code: "echec" }, { status: 500 });
  }
}
