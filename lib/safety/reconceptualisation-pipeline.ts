import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiPort, MessageIa, TierIa } from "@/lib/ai/port";
import { envoyerSousEgressArt9 } from "@/lib/ai/egress-guard";
import { requeteReconceptualisation, detecterReconceptualisation } from "@/lib/domain/reconceptualisation";
import { doitExecuterTravailSchema } from "./pipeline";
import { journaliserIncidentSecurite } from "./rpc-repli";
import type { VerdictSecurite } from "./classer-detresse";
import { avecDelai } from "@/lib/domain/delai";

/**
 * Orchestrateur de la DÉTECTION DE RECONCEPTUALISATION (Story 4.4, AD-16) — l'étage ordonné APRÈS la
 * sécurité. C'est `lib/safety/` qui orchestre (l'I/O egress + la persistance gardée) ; `lib/domain/`
 * (le détecteur pur) est appelé d'ici, jamais l'inverse (AD-1). **Ce module (avec la route) est le SEUL
 * appelant de `requeteReconceptualisation`** (garde d'architecture, AC1 : aucun détecteur hors du pipeline).
 *
 * AC3 [DUR / AD-17] — double-défense, source unique `branche_bloquee_par_detresse()` :
 *   (a) ICI (garde de pipeline) — AUCUN appel fort si le verdict supprime le travail de schéma (le VETO
 *       déjà marqué, `doitExecuterTravailSchema`) OU si la fenêtre détresse est active (en cours ou 72 h) ;
 *   (b) au POINT D'ÉCRITURE (la RPC `enregistrer_signal_reconceptualisation` LÈVE) — le contrat, même si
 *       (a) est un jour contourné.
 *
 * Repli sûr partout (AD-15) : la détection ne fait JAMAIS échouer un tour (elle tourne hors du flux de
 * réponse). Un hang/erreur du fort → aucun signal ; un échec de persistance → incident sans art. 9.
 */

/** Port de persistance du signal (adapté sous JWT par `lib/data/depot-reconceptualisation`). */
export interface DepotSignalReconcept {
  /** Enregistre un signal EN ATTENTE rattaché à l'entrée de journal du tour `cleTour`. Lève sur échec RÉEL. */
  enregistrer(args: { cleTour: string }): Promise<void>;
}

/** Usage FORT à métrer (produit — FR-043 n'exempte QUE la détresse). */
export interface UsageReconcept {
  tier: TierIa;
  modele: string;
  tokensEntree: number;
  tokensSortie: number;
}

export interface DepsReconcept {
  supabase: SupabaseClient;
  adaptateur: AiPort;
  depotSignal: DepotSignalReconcept;
  /** Lit `branche_bloquee_par_detresse()` sous JWT (en cours OU 72 h). Repli SÛR = `true` (le doute supprime). */
  fenetreDetresseActive: () => Promise<boolean>;
  /** Budget de la détection ; au-delà → aucun signal (un hang du fort en tâche de fond ne traîne pas). */
  delaiMs?: number;
}

export interface ResultatReconcept {
  /** AD-17 : la garde de pipeline a supprimé la détection (aucun appel fort). */
  supprime: boolean;
  /** Un marqueur a-t-il été retenu (et un signal tenté) ? */
  detecte: boolean;
  /** Coût FORT à métrer (`null` si aucun appel — supprimé, hang, ou egress bloqué). */
  usage: UsageReconcept | null;
}

/** Budget de la détection : un hang du modèle fort au-delà → aucun signal (repli sûr). Patron `detecteur-detresse`. */
const DELAI_RECONCEPT_MS = 8000;

/** Course contre un délai : si `p` n'a pas résolu à temps, rejette (→ repli en aval, aucun signal). */
/**
 * Lecteur de la fenêtre détresse SOUS JWT (en cours OU 72 h). `branche_bloquee_par_detresse()` est keyée
 * sur `auth.uid()` → à appeler avec le client JWT (JAMAIS le client admin, qui n'a pas d'auth.uid() et
 * renverrait toujours `false` — un fail-open dangereux). Repli SÛR = `true` : le doute SUPPRIME la détection.
 */
export async function fenetreDetresseActive(supabase: SupabaseClient, motif: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("branche_bloquee_par_detresse");
    if (error) {
      journaliserIncidentSecurite(`${motif}_echoue`, error);
      return true; // doute → supprime (protecteur)
    }
    return data === true;
  } catch (e) {
    journaliserIncidentSecurite(`${motif}_exception`, e);
    return true; // doute → supprime (protecteur)
  }
}

export async function evaluerReconceptualisationDuTour(
  deps: DepsReconcept,
  args: { messages: MessageIa[]; verdict: VerdictSecurite; cleTour: string },
): Promise<ResultatReconcept> {
  // (a) AC3 [DUR / AD-17] — garde de PIPELINE : aucun appel fort si le tour supprime le travail de schéma
  // (VETO existant) OU si la fenêtre détresse est active. Ordre : le prédicat pur d'abord (pas de RPC si
  // le verdict tranche déjà), la fenêtre ensuite (couvre le 72 h post-extinction, non porté par le verdict).
  if (!doitExecuterTravailSchema(args.verdict) || (await deps.fenetreDetresseActive())) {
    return { supprime: true, detecte: false, usage: null };
  }

  // (b) AC2 — modèle FORT sous egress art. 9 (requeteReconceptualisation ⇒ tier fort). Budget borné.
  let res;
  try {
    res = await avecDelai(
      envoyerSousEgressArt9({
        supabase: deps.supabase,
        adaptateur: deps.adaptateur,
        requete: requeteReconceptualisation(args.messages),
      }),
      deps.delaiMs ?? DELAI_RECONCEPT_MS,
      "reconcept_timeout",
    );
  } catch (e) {
    journaliserIncidentSecurite("reconcept_egress_exception", e); // hang/erreur fort → aucun signal
    return { supprime: false, detecte: false, usage: null };
  }
  if (res.bloque) return { supprime: false, detecte: false, usage: null }; // egress bloqué (race) → aucun signal

  const usage: UsageReconcept = {
    tier: res.reponse.tier,
    modele: res.reponse.modele,
    tokensEntree: res.reponse.usage.tokensEntree,
    tokensSortie: res.reponse.usage.tokensSortie,
  };
  const { detecte } = detecterReconceptualisation(res.reponse.texte); // parser PUR
  if (!detecte) return { supprime: false, detecte: false, usage };

  // (c) AC4 — persiste le signal EN ATTENTE (la garde AD-17 au point d'écriture re-mord). Un échec de
  // persistance journalise un incident (jamais d'art. 9) ; le coût fort déjà consommé reste métré.
  try {
    await deps.depotSignal.enregistrer({ cleTour: args.cleTour });
  } catch (e) {
    journaliserIncidentSecurite("reconcept_persist_exception", e);
    return { supprime: false, detecte: true, usage };
  }
  return { supprime: false, detecte: true, usage };
}
