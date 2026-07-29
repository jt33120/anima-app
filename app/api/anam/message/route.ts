import { type NextRequest, NextResponse, after } from "next/server";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { creerAiPort } from "@/lib/ai/fabrique";
import { diffuserSousEgressArt9, envoyerSousEgressArt9 } from "@/lib/ai/egress-guard";
import { ENTETES_ART9 } from "@/lib/ai/entetes-art9";
import { extraireMessages } from "@/lib/ai/valider-messages";
import { modelePour, tierPour } from "@/lib/ai/politique-tier";
import { metrerUsageIa, resoudreMetrage, type EtatFlux, type FinFlux } from "@/lib/ai/metrage";
import { ligneNdjson } from "@/lib/ai/flux-ndjson";
import { evaluerSecuriteDuTour, type ResultatSecurite } from "@/lib/safety/pipeline";
import { journaliserAuditDetresse } from "@/lib/safety/journaliser-audit";
import { creerDepotEpisode } from "@/lib/safety/depot-episode";
import { consigneReponse } from "@/lib/safety/consigne-detresse";
import { blocRessourcesDetresse } from "@/lib/safety/bloc-ressources-detresse";
import { verifieLeLibelle } from "@/lib/safety/ressources-aide";
import { creerDepotSeance } from "@/lib/data/depot-seance";
import { avancerArc, SIGNAUX_NEUTRES } from "@/lib/domain/arc-seance";
import { requeteExtractionArc, extraireSignauxArc } from "@/lib/domain/signaux-arc";
import { consignePhaseArc } from "@/lib/domain/consigne-phase";
import type { AiPort, CapaciteIa, MessageIa, NiveauSecurite, RequeteIa, TierIa } from "@/lib/ai/port";

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
        // Story 2.4 : le dépôt RÉEL d'épisode remplace le placeholder. Ouvre/rehausse/compte/éteint
        // `episode_detresse` à chaque tour, et rend `episodeOuvert()` réel (forçage cross-tour).
        depotEpisode: creerDepotEpisode(user.id),
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
  //
  // Story 2.4 : `securite.limitesLevees` (dérivé de `episode_detresse.fin IS NULL`) est DISPONIBLE
  // ici — la garde de MONTAGE (paywall/quota/bilan refusent de se monter, FR-043) est la Story 2.5.
  const niveauSecurite: NiveauSecurite = securite.verdict.niveau;

  // ── ÉTAGE ARC DE SÉANCE (Story 2.7, AD-16 : APRÈS la sécurité ; AD-1 : machine PURE) ───────────
  // Charge la trace → extrait les signaux (modèle FORT, passe SÉPARÉE sous egress art. 9, D1) → la
  // machine pure fait avancer l'arc → réécrit la trace. Le niveau de détresse est LU du verdict
  // (jamais re-détecté — une seule horloge, AD-16/AD-17). L'arc ne plante JAMAIS le tour (repli sûr).
  const depotSeance = creerDepotSeance(user.id);
  let arc: ReturnType<typeof avancerArc> | null = null;
  let usageExtractionArc: { tier: TierIa; modele: string; tokensEntree: number; tokensSortie: number } | null = null;
  try {
    const etatArc = await depotSeance.charger();
    const extraction = await envoyerSousEgressArt9({
      supabase,
      adaptateur,
      requete: requeteExtractionArc(messages),
    });
    let signaux = SIGNAUX_NEUTRES; // egress bloqué (rare, race) → aucun signal : l'arc n'avance pas
    if (!extraction.bloque) {
      const dernierTourUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
      signaux = extraireSignauxArc(extraction.reponse.texte, dernierTourUser);
      // L'extraction d'arc EST métrée (produit — FR-043 n'exempte QUE la détresse) : clé DISTINCTE.
      const u = extraction.reponse.usage;
      usageExtractionArc = {
        tier: extraction.reponse.tier,
        modele: extraction.reponse.modele,
        tokensEntree: u.tokensEntree,
        tokensSortie: u.tokensSortie,
      };
    }
    arc = avancerArc(etatArc, signaux, niveauSecurite, Date.now());
    await depotSeance.ecrire(arc.etat);
  } catch (e) {
    // L'arc ne quitte jamais le tour : en repli, on génère sans consigne de phase (Anam répond).
    console.error("anam/message : étage arc en repli", { nom: e instanceof Error ? e.name : "inconnu" });
    arc = null;
  }
  const beatArc = arc?.beat ?? null; // capturé pour la trame (évite un re-narrowing dans le stream)

  // La capacité de génération SUIT la phase : en NOMMER, la formulation est une reconceptualisation
  // (fort, AD-5) ; sinon échange. La VOIX qui exploite réellement l'arc relève de la Story 2.8.
  const capaciteGeneration: CapaciteIa = arc?.etat.phase === "nommer" ? "reconceptualisation" : CAPACITE;
  const tierServeur = tierPour(capaciteGeneration, niveauSecurite); // repli de métrage si le flux avorte avant `fin`
  const modeleServeur = modelePour(tierServeur);

  // Métrage de l'extraction d'arc — enregistré ICI (PAS dans le after() final) : les returns précoces
  // de la garde egress de génération (403/500) surviennent APRÈS ce point ; enregistré tôt, le coût FORT
  // déjà consommé est compté même si la génération avorte (revue 2.7). Clé distincte ; jamais exempté
  // (FR-043 n'exempte QUE la détresse).
  if (usageExtractionArc) {
    const usageArc = usageExtractionArc;
    after(async () => {
      await metrerUsageIa({ utilisatriceId: user.id, cleIdempotence: `${cleIdempotence}:arc`, ...usageArc });
    });
  }

  // ── RÉPONSE PAR NIVEAUX (Story 2.6, AD-16/AD-5) ───────────────────────────────────────────────
  // La FORME de la réponse dérive du verdict (jamais une 2ᵉ classification). La consigne système est
  // PRÉFIXÉE aux messages CÔTÉ SERVEUR (le client ne peut pas forger `system`, `valider-messages`) et
  // ne transite JAMAIS jusqu'au client. Le bloc ressources (niveaux 2-3) part par une trame dédiée.
  // Ordre d'injection : [consignePhase (2.7), consigneDetresse (2.6), …messages]. La consigne de
  // détresse reste au plus PRÈS des messages → l'overlay sécurité garde la priorité. La voix (2.8)
  // se préfixera avant la consigne de phase. Toutes sont `{role:"system"}`, jamais reçues du client.
  const consignePhase = arc ? consignePhaseArc(arc.etat.phase) : null;
  const consigneDetresse = consigneReponse(securite.verdict);
  const prefixes = [consignePhase, consigneDetresse].filter((c): c is MessageIa => c !== null);
  const messagesReponse = prefixes.length ? [...prefixes, ...messages] : messages;
  const bloc = blocRessourcesDetresse(securite.verdict);
  const trameRessources = bloc
    ? {
        t: "ressources" as const,
        position: bloc.position, // "avant" (niv. 3 vital) ou "apres" (niv. 2) — placement UX-DR
        verifieLe: verifieLeLibelle(), // « Vérifié le … » (FR-044) porté par la trame (frontière AD-7)
        ressources: bloc.ressources.map((r) => ({
          numero: r.numero,
          tel: r.tel,
          aria: r.aria,
          service: r.service,
          desc: r.desc,
        })),
      }
    : null;

  // La RÉPONSE : `niveauSecurite ≥ 1` force le tier FORT (la réponse suit la détection, AD-5).
  let egress;
  try {
    const requete: RequeteIa = { capacite: capaciteGeneration, messages: messagesReponse, contientArt9: true, niveauSecurite };
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
      // Bloc ressources AVANT le tour d'Anam (niveau 3 vital, AC4) : émis IMMÉDIATEMENT, avant même le
      // plancher de latence — l'urgence prime. Le placement "apres" (niveau 2) sort juste avant `fin`.
      // Beat « nommer » (Story 2.7, AC5) : l'apparition d'Anam en Présence encadre la livraison de
      // l'observation → émis au DÉBUT du tour nommer (décidé par avancerArc). No-leak : la trame ne
      // porte QUE l'identifiant du beat (jamais phase/signaux/compteurs).
      if (beatArc) emettre({ t: "beat", beat: beatArc });
      if (trameRessources && trameRessources.position === "avant") emettre(trameRessources);
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
        if (!request.signal.aborted) {
          // Bloc ressources APRÈS le tour d'Anam (niveau 2, AC4) : juste avant la trame terminale.
          if (trameRessources && trameRessources.position === "apres") emettre(trameRessources);
          emettre({ t: "fin" });
        }
      } catch (e) {
        console.error("anam/message : flux interrompu", { nom: e instanceof Error ? e.name : "inconnu" });
        // Le filet de sécurité ne dépend pas d'un flux propre : le bloc « apres » (niveau 2) est émis
        // AVANT la trame d'échec, même si le modèle a coupé en cours de route (revue 2.6, R5).
        if (!request.signal.aborted && trameRessources && trameRessources.position === "apres") {
          emettre(trameRessources);
        }
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
