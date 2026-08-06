import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { creerDepotIntention } from "@/lib/data/depot-intention";
import { intentionRecevable, echeanceRecevable } from "@/lib/domain/intention";
import { journaliserIncidentSecurite, journaliserRefusGarde, estRefusMetier } from "@/lib/safety/rpc-repli";

/** Les RPC prennent des `uuid` : un identifiant mal formé est une requête INVALIDE (400), pas une panne. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Story 4.10 (T3) — l'écriture du PLAN D'ÉTAPES. Trois actions sous JWT :
 *   • `ajouter`  { brancheId, declencheur, action, echeance? } → `ajouter_intention` ;
 *   • `reviser`  { intentionId, declencheur, action, echeance? } → `reviser_intention` ;
 *   • `retirer`  { intentionId } → `retirer_intention` (suppression FRANCHE, aucun tombstone).
 *
 * Les GARDES vivent au point d'écriture (policies WITH CHECK + RPC, migration 0036) : premium (FR-081),
 * consentement art. 9, barrière de minorité, AD-17, appartenance de la branche. Cet endpoint authentifie,
 * route, et valide la FORME en amont (échec rapide, AC1/AC3) — il ne re-décide aucune garde.
 *
 * AUCUNE clé IA, AUCUN secret ici (AD-2). Aucun appel modèle nulle part dans cette story (décision D1).
 * NFR-022 : la réponse ne porte jamais d'art. 9 — ni le `declencheur`, ni l'`action`, ni un message
 * d'erreur qui aurait pu en ramasser un au passage. Seulement un code neutre.
 *
 * ⚠️ `reviser` et `retirer` distinguent le REFUS (zéro ligne : 409) de la PANNE (500). Une UPDATE bloquée
 * par la RLS ne lève rien — répondre 200 sur zéro ligne ferait afficher « c'est enregistré » à quelqu'un
 * dont rien n'a été enregistré.
 */
/**
 * La LECTURE du plan d'une branche. Chargée à l'ouverture de la fiche, pas dans la projection de l'arbre :
 * les plans sont de l'art. 9, et les embarquer dans chaque rendu de la scène ferait voyager tout le
 * contenu de toutes les branches pour afficher un arbre où l'on ne lit rien (minimisation).
 *
 * Ouverte même quand l'abonnement s'est éteint : ses propres données lui restent lisibles (policy
 * `intention_lecture`, 0036). Un paywall qui séquestre ce qui est déjà écrit n'est pas un paywall.
 */
export async function GET(request: Request): Promise<Response> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "non_authentifie" }, { status: 401 });

  const brancheId = new URL(request.url).searchParams.get("brancheId");
  // ⚠️ LA FORME EST VÉRIFIÉE ICI (revue 4.10). `charger_plan(uuid)` lève `22P02` sur un identifiant mal
  // formé — un code que `estRefusMetier` connaît, mais que le `catch` de ce GET envoyait dans
  // `journaliserIncidentSecurite`, dont le libellé annonce « indisponibilité d'une RPC de sécurité ».
  // N'importe quelle session pouvait donc noyer, à volonté, le canal où vivent les alertes de détresse.
  if (!brancheId || !UUID.test(brancheId)) {
    return NextResponse.json({ code: "branche_manquante" }, { status: 400 });
  }

  try {
    // L'ordre vient de `charger_plan` (rang puis id) et n'est pas retouché ici : deux tris finiraient
    // par diverger, et le plan « bougerait tout seul » entre deux ouvertures (défaut corrigé en 0033).
    const plan = await creerDepotIntention(supabase).chargerPlan({ brancheId });
    return NextResponse.json({ plan });
  } catch (e) {
    // Même distinction qu'au POST : un refus de garde n'est pas une panne, et ne doit pas s'annoncer
    // comme telle dans le canal des incidents de sécurité.
    if (estRefusMetier(e)) {
      journaliserRefusGarde("plan_lecture", e);
      return NextResponse.json({ code: "refuse" }, { status: 403 });
    }
    journaliserIncidentSecurite("plan_lecture", e);
    // Une lecture en panne n'est PAS un plan vide : le dire ferait croire à un plan effacé. Le rendu
    // distingue les deux (même leçon que `indisponible` sur la projection de l'arbre, revue 4.6).
    return NextResponse.json({ code: "echec" }, { status: 500 });
  }
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
  const { action, brancheId, intentionId, declencheur, alors, echeance } = (corps ?? {}) as {
    action?: string;
    brancheId?: string;
    intentionId?: string;
    declencheur?: string;
    /** Le « alors ». Nommé ainsi dans le contrat HTTP parce que `action` est déjà pris par le routage. */
    alors?: string;
    echeance?: string | null;
  };

  /** La forme, en amont : « si X, alors Y », et une échéance qui a une chance de se déclencher un jour. */
  function formeInvalide(): string | null {
    if (typeof declencheur !== "string" || typeof alors !== "string") return "forme_requise";
    if (!intentionRecevable({ declencheur, action: alors })) return "forme_requise";
    const e = echeance ?? null;
    if (e !== null && typeof e !== "string") return "echeance_invalide";
    if (!echeanceRecevable(e, new Date())) return "echeance_invalide";
    return null;
  }

  try {
    const depot = creerDepotIntention(supabase);

    if (action === "ajouter") {
      if (typeof brancheId !== "string" || !UUID.test(brancheId)) {
        return NextResponse.json({ code: "branche_manquante" }, { status: 400 });
      }
      const invalide = formeInvalide();
      if (invalide) return NextResponse.json({ code: invalide }, { status: 400 });
      const id = await depot.ajouter({
        brancheId,
        declencheur: declencheur as string,
        action: alors as string,
        echeance: echeance ?? null,
      });
      return NextResponse.json({ ok: true, id });
    }

    if (action === "reviser") {
      if (typeof intentionId !== "string" || !UUID.test(intentionId)) {
        return NextResponse.json({ code: "intention_manquante" }, { status: 400 });
      }
      const invalide = formeInvalide();
      if (invalide) return NextResponse.json({ code: invalide }, { status: 400 });
      const bouge = await depot.reviser({
        intentionId,
        declencheur: declencheur as string,
        action: alors as string,
        echeance: echeance ?? null,
      });
      // Zéro ligne : la RLS a refusé (premium éteint, détresse, non possédée) ou l'étape n'existe plus.
      // On ne sait pas laquelle, et on n'a pas à le dire — mais on ne prétend pas avoir enregistré.
      if (!bouge) return NextResponse.json({ code: "refuse" }, { status: 409 });
      return NextResponse.json({ ok: true });
    }

    if (action === "retirer") {
      if (typeof intentionId !== "string" || !UUID.test(intentionId)) {
        return NextResponse.json({ code: "intention_manquante" }, { status: 400 });
      }
      const bouge = await depot.retirer({ intentionId });
      if (!bouge) return NextResponse.json({ code: "refuse" }, { status: 409 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ code: "action_invalide" }, { status: 400 });
  } catch (e) {
    // On DISTINGUE le refus d'une garde de la panne (patron `branche/route.ts`). Un refus est un
    // comportement ATTENDU : il ne doit pas s'annoncer comme une panne de RPC de sécurité, sinon le canal
    // des vrais incidents — celui où vivent les alertes de détresse — se noie sous du bruit ordinaire.
    if (estRefusMetier(e)) {
      journaliserRefusGarde("plan_endpoint", e);
      return NextResponse.json({ code: "refuse" }, { status: 403 });
    }
    journaliserIncidentSecurite("plan_endpoint", e);
    return NextResponse.json({ code: "echec" }, { status: 500 });
  }
}
