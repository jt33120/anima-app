import { type NextRequest, NextResponse, after } from "next/server";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { creerAiPort } from "@/lib/ai/fabrique";
import { diffuserSousEgressArt9 } from "@/lib/ai/egress-guard";
import { ENTETES_ART9 } from "@/lib/ai/entetes-art9";
import { extraireMessages } from "@/lib/ai/valider-messages";
import { modelePour, tierPour } from "@/lib/ai/politique-tier";
import { metrerUsageIa, resoudreMetrage, type EtatFlux, type FinFlux } from "@/lib/ai/metrage";
import { ligneNdjson } from "@/lib/ai/flux-ndjson";
import { evaluerSecuriteDuTour, type ResultatSecurite } from "@/lib/safety/pipeline";
import { journaliserAuditDetresse } from "@/lib/safety/journaliser-audit";
import type { AiPort, CapaciteIa, NiveauSecurite, RequeteIa } from "@/lib/ai/port";

/**
 * Route art. 9 (AD-2/AD-4) — le tour de conversation en STREAMING (Story 2.2). Ordre : auth →
 * validation → tier résolu SERVEUR (AD-5) → egress-guard (consentement + ZDR + barrière mineur,
 * AVANT le 1er octet) → flux NDJSON → métrage `usage_ia` (dans `after()`, post-réponse). Aucun SDK
 * fournisseur, aucun analytics ici. Le tier/usage ne transitent JAMAIS jusqu'au client.
 *
 * Segment art. 9 : `no-store`/`dynamic`, runtime Node (secret serveur jamais sur Edge). Ne PAS
 * activer `experimental.cacheComponents` (incompatible avec `export const dynamic`).
 *
 * ⚠️ Le vrai verrou anti-exfiltration (`connect-src 'self'` + nonce) vit sur la PAGE de conversation
 * (`proxy.ts`, Phase B) : la CSP d'une réponse d'API n'est pas appliquée par le navigateur. Ici,
 * seul `no-store` (ENTETES_ART9) est effectif ; on envoie la CSP comme déclaration d'intention.
 */
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const runtime = "nodejs";

/** Capacité du tour en 2.2 (échange courant). Source UNIQUE : sert au tier ET à la requête adaptateur. */
const CAPACITE: CapaciteIa = "echange";
/** Latence tenue avant le 1er fragment (AC2 : 400–900 ms, même si la réponse est prête plus tôt). */
const PLANCHER_LATENCE_MS = 500;
const attendre = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

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

  const cleIdempotence = crypto.randomUUID(); // clé SERVEUR par requête : audit ET métrage (revue 2.1)

  // ── PIPELINE SÉCURITÉ-D'ABORD (Story 2.3, AD-16) ──────────────────────────────────────────────
  // La DÉTECTION de détresse (modèle FORT, sous egress) s'exécute AVANT toute génération et arbitre
  // le tour. `niveauSecurite` en découle (plus de hardcode 0) : au niveau ≥ 1, la RÉPONSE est aussi
  // forcée au fort (AD-5). Le coût de la détection n'est JAMAIS métré dans le quota (FR-043).
  let adaptateur: AiPort;
  let securite: ResultatSecurite;
  try {
    adaptateur = await creerAiPort(); // boot-guard (misconfig) → capté ici
    securite = await evaluerSecuriteDuTour(
      {
        supabase,
        adaptateur,
        emettreAudit: (a) => journaliserAuditDetresse({ utilisatriceId: user.id, cleIdempotence, ...a }),
      },
      messages,
    );
  } catch (e) {
    console.error("anam/message : échec du pipeline sécurité", { nom: e instanceof Error ? e.name : "inconnu" });
    return NextResponse.json(
      { code: "erreur_serveur", message: "Service indisponible, réessaie." },
      { status: 500, headers: ENTETES_ART9 },
    );
  }

  if (securite.bloque) {
    // Egress bloqué EN AMONT (consentement révoqué, ZDR non prouvé, barrière de minorité) → rien diffusé.
    return NextResponse.json(
      { code: `egress_bloque_${securite.raison}`, message: "Envoi bloqué (consentement / ZDR / barrière)." },
      { status: 403, headers: ENTETES_ART9 },
    );
  }

  // FR-037 — le VETO : le futur travail de schéma/reconceptualisation (Epic 4) devra consulter
  // `doitExecuterTravailSchema(securite.verdict)` avant d'écrire. Aucun writer de schéma n'existe
  // aujourd'hui → point d'extension marqué, rien à annuler ici. Le métrage n'est JAMAIS vetoé.
  const niveauSecurite: NiveauSecurite = securite.verdict.niveau;
  const tierServeur = tierPour(CAPACITE, niveauSecurite); // repli de métrage si le flux avorte avant `fin`
  const modeleServeur = modelePour(tierServeur);

  // La RÉPONSE : `niveauSecurite ≥ 1` force le tier FORT (la réponse suit la détection, AD-5).
  let egress;
  try {
    const requete: RequeteIa = { capacite: CAPACITE, messages, contientArt9: true, niveauSecurite };
    egress = await diffuserSousEgressArt9({ supabase, adaptateur, requete });
  } catch (e) {
    console.error("anam/message : échec d'ouverture du flux", { nom: e instanceof Error ? e.name : "inconnu" });
    return NextResponse.json(
      { code: "erreur_serveur", message: "Service indisponible, réessaie." },
      { status: 500, headers: ENTETES_ART9 },
    );
  }

  if (egress.bloque) {
    return NextResponse.json(
      { code: `egress_bloque_${egress.raison}`, message: "Envoi bloqué (consentement / ZDR / barrière)." },
      { status: 403, headers: ENTETES_ART9 },
    );
  }

  const flux = egress.flux;
  const debut = Date.now();

  // État observé pendant le stream → dérive un métrage HONNÊTE dans `after()`. `charsEntree` sert de
  // repli d'unité TOKEN si le flux avorte avant que `fin` ne porte l'usage réel.
  const etat: EtatFlux = {
    finRecu: null,
    aProduit: false,
    charsSortie: 0,
    charsEntree: messages.reduce((n, m) => n + m.content.length, 0),
    tierServeur,
    modeleServeur,
  };

  const corpsFlux = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const emettre = (trame: Parameters<typeof ligneNdjson>[0]) => {
        try {
          controller.enqueue(encoder.encode(ligneNdjson(trame)));
        } catch {
          /* contrôleur déjà fermé (client parti) — rien à signaler */
        }
      };
      let premierDelta = true;
      try {
        for await (const ev of flux) {
          if (request.signal.aborted) break; // l'utilisatrice a quitté : on cesse de consommer
          etat.aProduit = true;
          if (ev.type === "delta") {
            if (premierDelta) {
              const reste = PLANCHER_LATENCE_MS - (Date.now() - debut);
              if (reste > 0) await attendre(reste); // tenir la latence AVANT le 1er fragment (AC2)
              premierDelta = false;
            }
            etat.charsSortie += ev.texte.length; // repli si `fin` n'arrive jamais (avortement)
            emettre({ t: "delta", c: ev.texte });
          } else {
            const fin: FinFlux = { tier: ev.tier, modele: ev.modele, usage: ev.usage };
            etat.finRecu = fin; // source AUTORITAIRE du métrage (tier/modele/usage réels)
          }
        }
        if (!request.signal.aborted) emettre({ t: "fin" });
      } catch (e) {
        console.error("anam/message : flux interrompu", { nom: e instanceof Error ? e.name : "inconnu" });
        emettre({ t: "erreur" });
      } finally {
        try {
          controller.close();
        } catch {
          /* déjà fermé */
        }
      }
    },
  });

  // Métrage APRÈS la réponse (survit au gel de l'instance serverless — sinon perdu, revue 2.2). Ne
  // s'exécute qu'une fois le flux clos → `etat` est complet. `resoudreMetrage` retourne `null` si
  // rien n'a été produit (pas de ligne fantôme). `metrerUsageIa` ne lève jamais.
  after(async () => {
    const usage = resoudreMetrage(etat);
    if (usage) await metrerUsageIa({ utilisatriceId: user.id, cleIdempotence, ...usage });
  });

  return new Response(corpsFlux, {
    headers: { ...ENTETES_ART9, "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}
