import { type NextRequest, NextResponse, after } from "next/server";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { creerAiPort } from "@/lib/ai/fabrique";
import { diffuserSousEgressArt9, envoyerSousEgressArt9 } from "@/lib/ai/egress-guard";
import { ENTETES_ART9 } from "@/lib/ai/entetes-art9";
import { extraireMessages } from "@/lib/ai/valider-messages";
import { modelePour, tierPour } from "@/lib/ai/politique-tier";
import { metrerUsageIa, resoudreMetrage, type EtatFlux, type FinFlux } from "@/lib/ai/metrage";
import { jetonTourValide } from "@/lib/ai/jeton-tour";
import { ligneNdjson } from "@/lib/ai/flux-ndjson";
import { evaluerSecuriteDuTour, type ResultatSecurite } from "@/lib/safety/pipeline";
import { journaliserAuditDetresse } from "@/lib/safety/journaliser-audit";
import { creerDepotEpisode } from "@/lib/safety/depot-episode";
import { consigneReponse } from "@/lib/safety/consigne-detresse";
import { blocRessourcesDetresse } from "@/lib/safety/bloc-ressources-detresse";
import { verifieLeLibelle } from "@/lib/safety/ressources-aide";
import { creerDepotSeance } from "@/lib/data/depot-seance";
import { creerDepotJournal } from "@/lib/data/depot-journal";
import { evaluerReconceptualisationDuTour, fenetreDetresseActive } from "@/lib/safety/reconceptualisation-pipeline";
import { evaluerRetourThemeDuTour } from "@/lib/safety/retour-theme-pipeline";
import { creerDepotBranche } from "@/lib/data/depot-branche";
import { creerDepotSignalReconcept } from "@/lib/data/depot-reconceptualisation";
import { avancerArc, SIGNAUX_NEUTRES, type EtatArc } from "@/lib/domain/arc-seance";
import { requeteExtractionArc, extraireSignauxArc } from "@/lib/domain/signaux-arc";
import { consignePhaseArc } from "@/lib/domain/consigne-phase";
import { consigneVoixAnam } from "@/lib/domain/consigne-voix";
import { consigneBilan } from "@/lib/domain/consigne-bilan";
import { structurerBilan } from "@/lib/domain/bilan";
import { doitProposerAbonnement } from "@/lib/domain/proposer-abonnement";
import { doitCouperConversation } from "@/lib/domain/allocation-residuelle";
import { estPremiumCourante } from "@/lib/data/lire-abonnement";
import { compterToursResiduelsDuMois } from "@/lib/data/lire-allocation";
import { limiteAllocationResiduelle } from "@/lib/ai/allocation-config";
import { absorberDelta, etatTroncatureInitial } from "@/lib/domain/voix-anam";
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
// L'étage reconceptualisation (Story 4.4) déporte un appel modèle FORT (budget 8 s) + une RPC dans `after()`,
// APRÈS le flux déjà streamé — le premier `after()` du produit à faire un vrai appel modèle (les autres ne font
// que des upserts de métrage). `after()` s'exécute sous le plafond de la route (doc Next.js) → on le pose
// EXPLICITEMENT plutôt que de subir le défaut plateforme (revue 4.4, R5), sinon un dépassement TUE l'invocation
// en plein appel fort/écriture : ni signal, ni métrage, ni log (le catch ne s'exécute pas). [porte OPS : ajuster au tier Vercel]
export const maxDuration = 60;

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

  // Clé d'idempotence du tour LOGIQUE (Story 3.4, AC1) : le JETON CLIENT stable d'abord (réutilisé au
  // « Réessayer » → un retry ne recompte ni tokens ni allocation, et grave UNE seule entrée journal
  // 4.1), l'UUID SERVEUR en repli si le jeton est absent/mal formé. Scopée à l'utilisatrice par l'index
  // unique `usage_ia` → un spoof ne collisionne que SON propre métrage (revue 2.1). Sert aussi les clés
  // dérivées `:arc`/`:bilan` ET le journal brut (4.1).
  const jetonValide = jetonTourValide((corps as { jetonTour?: unknown } | null)?.jetonTour);
  if (!jetonValide) {
    // Repli NON idempotent au retry (revue 4.1/2-4b) : sans jeton canonique, une clé FRAÎCHE est générée
    // par tentative → au « Réessayer » (1) le journal (4.1) peut dupliquer sa ligne (contenu art. 9
    // permanent) ET (2) l'ÉPISODE de détresse (2-4b) peut RE-COMPTER un tour sûr → extinction prématurée
    // possible (AD-16/AD-17). Résidu SYSTÉMIQUE partagé (métrage 2.1 / journal 4.1 / épisode 2-4b) : sur le
    // chemin nominal le client réutilise TOUJOURS son jeton stable → l'idempotence tient. On rend le chemin
    // dégradé MESURABLE (jamais d'art. 9 ni de jeton en clair : un simple drapeau, patron NFR-022).
    console.warn("anam/message : jeton de tour absent/mal formé — repli UUID serveur (idempotence de retry perdue : doublon journal ET re-comptage épisode possibles)");
  }
  const cleIdempotence = jetonValide ?? crypto.randomUUID();

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
        // Story 2-4b : le jeton de tour rend l'enregistrement idempotent au « Réessayer » (un rejeu du
        // même tour sûr ne rapproche pas l'extinction → jamais de retombée prématurée des limites).
        depotEpisode: creerDepotEpisode(user.id, cleIdempotence),
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

  // ── JOURNAL BRUT (Story 4.1, AD-8 couche 1, NFR-017) ──────────────────────────────────────────
  // Grave le VERBATIM du tour AVANT toute génération et INDÉPENDAMMENT de son issue (échec modèle,
  // coupure de quota 3.4, détresse) : « capture indépendante du traitement ». Placé APRÈS la garde
  // `securite.bloque` (un tour mineur/ZDR/consentement révoqué n'est JAMAIS journalisé) et AVANT le
  // gate d'allocation. Idempotent par le JETON DE TOUR (même clé que le métrage) → réémission au
  // retour réseau / « Réessayer » = UNE entrée. Échec → 500 : on ne diffuse pas un tour qu'on n'a pas
  // pu graver ; le client garde le message + « Réessayer » (2.2), la retentative est idempotente.
  const dernierMessage = messages[messages.length - 1];
  if (dernierMessage?.role === "user") {
    try {
      await creerDepotJournal(user.id).consigner({
        cleTour: cleIdempotence,
        role: "utilisatrice",
        contenu: dernierMessage.content,
      });
    } catch (e) {
      console.error("anam/message : journal brut illisible (tour non gravé)", { nom: e instanceof Error ? e.name : "inconnu" });
      return NextResponse.json(
        { code: "erreur_serveur", message: "Service indisponible, réessaie." },
        { status: 500, headers: ENTETES_ART9 },
      );
    }
  }

  // Story 2.4 : `securite.limitesLevees` (dérivé de `episode_detresse.fin IS NULL`) est DISPONIBLE
  // ici — la garde de MONTAGE (paywall/quota/bilan refusent de se monter, FR-043).
  const niveauSecurite: NiveauSecurite = securite.verdict.niveau;

  // Story 2.9 — la GARDE DE MONTAGE de la clôture (AD-9). Le beat Veille et le bilan (et, sous le
  // bilan, le point de montage du paywall) ne se produisent QUE hors détresse : `niveauSecurite === 0`
  // (pas de détresse CE tour) ET `!securite.limitesLevees` (pas d'épisode ouvert cross-tour — repli
  // sûr protecteur, dérivé de `episode_detresse.fin IS NULL`, AD-17). En détresse la séance CESSE
  // d'être une séance : le protocole de détresse (2.3–2.6) prend le relais, aucun bilan (AC5). La
  // machine d'arc ne recule pas de clore/nommer → ce gate est EXPLICITE ici, réévalué à chaque tour.
  const clotureAutorisee = niveauSecurite === 0 && !securite.limitesLevees;

  // Trace de séance chargée UNE fois (Story 2.7) — sert au GATE d'allocation (3.4) PUIS à l'étage arc
  // (une seule lecture, jamais deux). `charger` LÈVE sur panne (jamais un état initial qu'un `ecrire`
  // écraserait, 2.7) → repli : arc null ET gate d'allocation neutralisé (seanceClose=false).
  const depotSeance = creerDepotSeance(user.id);
  let etatArcCharge: EtatArc | null = null;
  try {
    etatArcCharge = await depotSeance.charger();
  } catch (e) {
    console.error("anam/message : trace de séance illisible (repli)", { nom: e instanceof Error ? e.name : "inconnu" });
    etatArcCharge = null;
  }
  // `seanceClose` = la 1ʳᵉ séance est-elle DÉJÀ close À L'ENTRÉE de ce tour ? (`finProposee` latché, lu
  // AVANT `avancerArc`). Le tour qui LIVRE le bilan entre `false` → il reste gratuit (non décompté,
  // FR-059/AC2) ; les tours SUIVANTS entrent `true` → post-séance, soumis à l'allocation résiduelle.
  const seanceClose = etatArcCharge?.finProposee ?? false;

  // ── GATE ALLOCATION RÉSIDUELLE (Story 3.4, AC2/AC4/AC5/AC6) ────────────────────────────────────
  // APRÈS la sécurité (la détresse lève TOUTE limite via `limites_levees`, AC6/FR-043) et AVANT
  // l'extraction FORT + la génération (un tour coupé ne dépense AUCUN appel modèle, ne métré RIEN).
  // Court-circuité si premium (AC5). Direction du DOUTE : l'ACCÈS — toute panne (lecture premium,
  // comptage) → on ne coupe pas (FR-058, « jamais coupé à zéro »). Décision = dérivation UNIQUE.
  //
  // `tourAllocationResiduelle` : ce tour TIRE-t-il réellement sur l'allocation gratuite ? (non premium,
  // post-séance, hors détresse). Sert de marque de métrage `post_premiere_seance` (revue 3.4, F10) : un
  // tour PREMIUM (illimité, AC5) ou de DÉTRESSE (gate non entré) ne doit JAMAIS polluer le décompte —
  // sinon un downgrade premium→gratuit en cours de mois recompterait rétroactivement des tours illimités.
  let tourAllocationResiduelle = false;
  if (!securite.limitesLevees && seanceClose) {
    let premiumConv = true; // défaut PRUDENT : lecture en échec → premium → aucune coupure (fail-open)
    try {
      premiumConv = await estPremiumCourante();
    } catch (e) {
      console.error("anam/message : lecture premium (quota) en repli — pas de coupure", { nom: e instanceof Error ? e.name : "inconnu" });
      premiumConv = true;
    }
    if (!premiumConv) {
      tourAllocationResiduelle = true; // non premium + post-séance + hors détresse → décompte réel
      let couper = false;
      try {
        // Exclut la PROPRE ligne du tour LOGIQUE courant (même `cleIdempotence`) : au « Réessayer », la
        // ligne écrite par une 1ʳᵉ tentative avortée ne doit pas murer la retentative (revue 3.4, F4/F5 —
        // le gate devient idempotent par tour logique, comme le métrage ; FR-058 renforcé).
        const toursConsommes = await compterToursResiduelsDuMois(user.id, cleIdempotence);
        couper = doitCouperConversation({
          premium: premiumConv,
          limitesLevees: securite.limitesLevees,
          seanceClose,
          toursConsommes,
          limite: limiteAllocationResiduelle(),
        });
      } catch (e) {
        console.error("anam/message : comptage allocation en repli — pas de coupure", { nom: e instanceof Error ? e.name : "inconnu" });
        couper = false; // le doute ne coupe jamais (FR-058)
      }
      if (couper) {
        // Allocation épuisée : le flux ne porte QUE la trame `quota` (aucune génération, aucun appel
        // FORT, aucune ligne `usage_ia`). Ce n'est PAS un paywall — le client rend une ligne système +
        // désactive le composeur, jamais « Passe au premium » (AC4). Le socle reste entièrement ouvert.
        const corpsQuota = new ReadableStream<Uint8Array>({
          start(controller) {
            try {
              controller.enqueue(new TextEncoder().encode(ligneNdjson({ t: "quota" })));
            } catch {
              /* client déjà parti */
            }
            try {
              controller.close();
            } catch {
              /* déjà fermé */
            }
          },
        });
        return new Response(corpsQuota, {
          headers: { ...ENTETES_ART9, "Content-Type": "application/x-ndjson; charset=utf-8" },
        });
      }
    }
  }

  // ── ÉTAGE RECONCEPTUALISATION (Story 4.4, AD-16 : APRÈS la sécurité ; AD-5 : fort ; AD-17 : supprimé
  // en détresse + 72 h) ──────────────────────────────────────────────────────────────────────────────
  // Le VETO FR-037 déjà marqué (`doitExecuterTravailSchema`) a désormais SON writer : la détection de
  // reconceptualisation. Elle tourne dans `after()` (post-réponse) → AUCUNE latence ajoutée et RIEN à
  // l'écran ce tour (AC4). Ordonnée après la sécurité (consomme `securite.verdict`) ET APRÈS le gate
  // d'allocation (un tour COUPÉ par le quota ne dépense AUCUN appel fort — il a déjà `return`, comme
  // l'extraction d'arc et la génération). On RÉUTILISE le client JWT authentifié (`supabase`) — égress,
  // fenêtre détresse ET persistance sous la même session (pas de relecture de cookies dans `after()`).
  // Métré `:reconcept` (produit — FR-043 n'exempte QUE la détresse). Un échec journalise un incident sans
  // art. 9 ; JAMAIS un 500 (la réponse d'Anam ne dépend pas de la détection).
  if (dernierMessage?.role === "user") {
    after(async () => {
      try {
        const reconcept = await evaluerReconceptualisationDuTour(
          {
            supabase,
            adaptateur,
            depotSignal: creerDepotSignalReconcept(supabase),
            fenetreDetresseActive: () => fenetreDetresseActive(supabase, "reconcept"),
          },
          { messages, verdict: securite.verdict, cleTour: cleIdempotence },
        );
        if (reconcept.usage) {
          await metrerUsageIa({ utilisatriceId: user.id, cleIdempotence: `${cleIdempotence}:reconcept`, ...reconcept.usage });
        }
      } catch (e) {
        console.error("anam/message : étage reconceptualisation en repli", { nom: e instanceof Error ? e.name : "inconnu" });
      }
    });
  }

  // ── ÉTAGE RETOUR SUR LE THÈME (Story 4.7, AC2) ─────────────────────────────────────────────────
  // Ce que la 4.4 fait pour la NAISSANCE d'une branche, cet étage le fait pour sa CROISSANCE : « ce
  // tour revient-il sur le thème d'une branche déjà nommée ? ». Même posture exactement — `after()`
  // (aucune latence, rien à l'écran ce tour), après la sécurité (consomme `securite.verdict`) et après
  // le gate d'allocation, sur le même client JWT, métré `:retour_theme`. Un échec journalise un
  // incident sans art. 9 ; JAMAIS un 500 : l'arbre qui ne feuille pas ce tour-ci feuillera au prochain
  // retour, alors qu'une réponse d'Anam qui casse ne se rattrape pas.
  if (dernierMessage?.role === "user") {
    after(async () => {
      try {
        const depot = creerDepotBranche(supabase);
        const retour = await evaluerRetourThemeDuTour(
          {
            supabase,
            adaptateur,
            depot: {
              chargerCandidats: () => depot.chargerCandidatsRetour(),
              progresser: (a) => depot.progresserFeuillaison(a),
            },
            fenetreDetresseActive: () => fenetreDetresseActive(supabase, "retour_theme"),
          },
          {
            messages,
            verdict: securite.verdict,
            cleTour: cleIdempotence,
            tour: dernierMessage.content,
          },
        );
        if (retour.usage) {
          await metrerUsageIa({ utilisatriceId: user.id, cleIdempotence: `${cleIdempotence}:retour_theme`, ...retour.usage });
        }
      } catch (e) {
        console.error("anam/message : étage retour sur le thème en repli", { nom: e instanceof Error ? e.name : "inconnu" });
      }
    });
  }

  // ── ÉTAGE ARC DE SÉANCE (Story 2.7, AD-16 : APRÈS la sécurité ; AD-1 : machine PURE) ───────────
  // Extrait les signaux (modèle FORT, passe SÉPARÉE sous egress art. 9, D1) → la machine pure fait
  // avancer l'arc → réécrit la trace. Réutilise `etatArcCharge` (partagé avec le gate). Le niveau de
  // détresse est LU du verdict (jamais re-détecté — une seule horloge, AD-16/AD-17). Ne plante JAMAIS.
  let arc: ReturnType<typeof avancerArc> | null = null;
  let usageExtractionArc: { tier: TierIa; modele: string; tokensEntree: number; tokensSortie: number } | null = null;
  if (etatArcCharge) {
    try {
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
      arc = avancerArc(etatArcCharge, signaux, niveauSecurite, Date.now());
      await depotSeance.ecrire(arc.etat);
    } catch (e) {
      // L'arc ne quitte jamais le tour : en repli, on génère sans consigne de phase (Anam répond).
      console.error("anam/message : étage arc en repli", { nom: e instanceof Error ? e.name : "inconnu" });
      arc = null;
    }
  }
  // Le beat remonte de la machine (2.7 « nommer », 2.9 « cloture »). Le beat « cloture » est SUPPRIMÉ
  // en détresse (la séance cesse d'être une séance, AC5) ; le beat « nommer » ne peut pas y survenir
  // (peutNommer gate l'entrée en nommer). No-leak : la trame ne portera QUE l'identifiant.
  const beatArc = arc?.beat && (arc.beat !== "cloture" || clotureAutorisee) ? arc.beat : null;
  // Le bilan est produit UNE seule fois, au tour de TRANSITION vers clore (beat cloture) et seulement
  // hors détresse. `arc.beat === "cloture"` = ce tour EST la clôture (idempotent : la machine ne
  // ré-émet pas le beat une fois EN clore → un tour ultérieur dans clore ne reproduit pas de bilan).
  const doitProduireBilan = arc?.beat === "cloture" && clotureAutorisee;

  // Story 3.2 — la carte d'abonnement se propose APRÈS le bilan (AC1), UNIQUEMENT si l'utilisatrice
  // n'est pas déjà premium. Entitlement lu SOUS JWT/RLS (source de vérité unique 3.1) et SEULEMENT
  // quand un bilan est attendu (aucun surcoût DB les autres tours). Repli en cas de DOUTE (lecture en
  // échec) : on RETIENT la carte (`premium = true`) — le doute suspend le commerce. C'est un choix
  // PRODUIT, jamais de sécurité : le verrou AD-9 (aucun paywall en détresse) est DÉJÀ tenu par
  // `doitProduireBilan` (pas de bilan en détresse → pas de trame `paywall`, émise sous le bilan).
  let premium = false;
  if (doitProduireBilan) {
    try {
      premium = await estPremiumCourante();
    } catch (e) {
      console.error("anam/message : lecture premium en repli (carte retenue)", { nom: e instanceof Error ? e.name : "inconnu" });
      premium = true;
    }
  }

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
  // Ordre d'injection : [voix (2.8), consignePhase (2.7), consigneDetresse (2.6), …messages]. La
  // consigne de détresse reste au plus PRÈS des messages → l'overlay sécurité garde la priorité ; la
  // VOIX de base (Story 2.8) se préfixe EN TÊTE (la plus loin des messages) : elle porte les invariants
  // toujours vrais (forme, hypothèses, corpus Anima, interdit d'affect) qui valent aussi en détresse.
  // Toutes sont `{role:"system"}`, jamais reçues du client, jamais renvoyées au client.
  const consigneVoix = consigneVoixAnam();
  // En détresse au moment d'une clôture, on NE demande PAS au modèle de clore (la séance cesse d'être
  // une séance, AC5) : la consigne de phase `clore` (« c'est toi qui clos… ») est supprimée — seul
  // l'overlay détresse régit le tour. Les autres phases restent injectées (bénignes en détresse ;
  // `nommer` est de toute façon inatteignable en détresse via `peutNommer`).
  const consignePhase =
    arc && (arc.etat.phase !== "clore" || clotureAutorisee) ? consignePhaseArc(arc.etat.phase) : null;
  const consigneDetresse = consigneReponse(securite.verdict);
  const prefixes = [consigneVoix, consignePhase, consigneDetresse].filter((c): c is MessageIa => c !== null);
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

  // Métrage du bilan de clôture (2.9) — rempli DANS le stream (passe fort séparée), relevé par le
  // after() final. Produit → jamais exempté (FR-043 n'exempte QUE la détresse), clé distincte.
  let usageBilan: { tier: TierIa; modele: string; tokensEntree: number; tokensSortie: number } | null = null;

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
      // ── VOIX : troncature déterministe à 3 phrases (Story 2.8, FR-084) ──────────────────────────
      // GATE DE SÉCURITÉ DURE : on ne tronque QUE hors détresse. À `niveauSecurite ≥ 1`, la réponse
      // (orienter, donner le 3114, rester) dépasse légitimement 3 phrases et ne doit JAMAIS être coupée
      // avant l'orientation. `pointDeCoupe` (pur) localise la fin du 3ᵉ groupe de ponctuation finale sur
      // le texte ACCUMULÉ serveur ; une fois coupé, on cesse d'émettre mais on continue de DRAINER le
      // flux (pour recevoir `fin` = usage réel, sinon le métrage sous-compte). Le manquement est
      // journalisé SERVEUR uniquement (jamais une trame, jamais de verbatim art. 9).
      const tronquerVoix = niveauSecurite === 0;
      let voixEtat = etatTroncatureInitial(); // cœur pur de troncature sur flux (texte accumulé jamais loggé)
      let voixTronquee = false; // vrai dès la coupe → on n'émet plus, on draine
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
            etat.charsSortie += ev.texte.length; // repli honnête : compte TOUT le texte généré, même coupé
            if (!tronquerVoix) {
              emettre({ t: "delta", c: ev.texte }); // détresse : jamais de coupe
            } else {
              // Cœur pur : accumule, localise la coupe, n'émet que le texte autorisé. Une fois `termine`,
              // n'émet plus rien mais la boucle poursuit le drain jusqu'à `fin` (métrage honnête).
              const r = absorberDelta(voixEtat, ev.texte);
              voixEtat = r.etat;
              if (r.aEmettre) emettre({ t: "delta", c: r.aEmettre });
              if (r.tronque) voixTronquee = true;
            }
          } else {
            const fin: FinFlux = { tier: ev.tier, modele: ev.modele, usage: ev.usage };
            etat.finRecu = fin; // source AUTORITAIRE du métrage (tier/modele/usage réels)
          }
        }
        if (!request.signal.aborted) {
          // FR-084 : « au-delà de trois phrases, c'est un défaut de génération » → manquement journalisé
          // (serveur uniquement, aucun art. 9 ni verbatim — patron du log d'erreur qui ne porte que `e.name`).
          if (voixTronquee) console.warn("anam/message : voix tronquée à 3 phrases (manquement de voix, FR-084)");
          // ── BILAN DE CLÔTURE (Story 2.9, AC2) — passe FORT séparée, registre document ─────────────
          // Le bilan « reprend ses mots, en clair » : généré À PART (consigne document, capacité
          // `synthese` → tier fort AD-5), HORS troncature 3 phrases, dans une trame `bilan` dédiée
          // (titres/listes autorisés). Émis UNIQUEMENT si la clôture est autorisée (hors détresse,
          // `doitProduireBilan`) et une seule fois (beat cloture). Fail-safe : structuration vide →
          // PAS de bilan (jamais un bloc malformé) ; la clôture reste valide (Anam a clos, le fil continue).
          if (doitProduireBilan) {
            try {
              const bilan = await envoyerSousEgressArt9({
                supabase,
                adaptateur,
                requete: { capacite: "synthese", messages: [consigneBilan(), ...messages], contientArt9: true, niveauSecurite: 0 },
              });
              if (!bilan.bloque) {
                const structure = structurerBilan(bilan.reponse.texte);
                if (structure) emettre({ t: "bilan", titre: structure.titre, points: structure.points });
                // Story 3.2 — la carte s'ancre SOUS le bilan : jamais de trame `paywall` si la
                // structuration a échoué (pas de bilan → pas de carte), ni si premium (gate serveur,
                // AD-9). Prédicat PUR (source unique — pas de 2ᵉ dérivation de `limites_levees`, AD-17).
                if (doitProposerAbonnement({ bilanEmis: !!structure, premium })) emettre({ t: "paywall" });
                const u = bilan.reponse.usage; // produit → métré à part (clé distincte), jamais exempté
                usageBilan = { tier: bilan.reponse.tier, modele: bilan.reponse.modele, tokensEntree: u.tokensEntree, tokensSortie: u.tokensSortie };
              }
            } catch (e) {
              console.error("anam/message : bilan de clôture en repli", { nom: e instanceof Error ? e.name : "inconnu" });
            }
          }
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
    // Story 3.4 (revue F10) : la ligne PRINCIPALE est marquée `post_premiere_seance` UNIQUEMENT si ce
    // tour a réellement tiré sur l'allocation gratuite (`tourAllocationResiduelle` : non premium,
    // post-séance, hors détresse). Un tour premium/détresse reste `false` → aucun résidu ne pollue le
    // comptage (un downgrade premium→gratuit ne recompte pas des tours illimités). Le tour de clôture
    // reste `false` (gate non entré : seanceClose=false à l'entrée) → gratuit (FR-059/AC2).
    if (usage) await metrerUsageIa({ utilisatriceId: user.id, cleIdempotence, ...usage, postPremiereSeance: tourAllocationResiduelle });
    // Story 2.9 : le bilan de clôture (passe fort séparée) est métré à part — clé distincte, jamais
    // exempté ; `postPremiereSeance` reste false (sous-coût, pas un « tour » d'allocation, 3.4).
    if (usageBilan) await metrerUsageIa({ utilisatriceId: user.id, cleIdempotence: `${cleIdempotence}:bilan`, ...usageBilan });
  });

  return new Response(corpsFlux, {
    headers: { ...ENTETES_ART9, "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}
