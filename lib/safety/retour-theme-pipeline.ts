import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiPort, MessageIa, TierIa } from "@/lib/ai/port";
import { envoyerSousEgressArt9 } from "@/lib/ai/egress-guard";
import { preselectionner, requeteRetourTheme, lireRetoursTheme, type BrancheCandidate } from "@/lib/domain/retour-theme";
import { doitExecuterTravailSchema } from "./pipeline";
import { journaliserIncidentSecurite } from "./rpc-repli";
import type { VerdictSecurite } from "./classer-detresse";

/**
 * Story 4.7 (T3) — l'orchestrateur du RETOUR SUR LE THÈME, l'étage qui fait FEUILLER l'arbre. Frère
 * jumeau de `reconceptualisation-pipeline` : c'est `lib/safety/` qui orchestre (l'I/O egress + la
 * persistance gardée) ; `lib/domain/retour-theme` (pur) est appelé d'ici, jamais l'inverse (AD-1).
 *
 * [AC6 DUR / AD-17] Double défense, source unique `branche_bloquee_par_detresse()` :
 *   (a) ICI — aucun appel fort si le verdict supprime le travail de schéma OU si la fenêtre détresse
 *       est active (en cours ou 72 h). Le doute SUPPRIME (repli sûr = `true`) ;
 *   (b) au POINT D'ÉCRITURE — le trigger `branche_garde_cycle` et le WITH CHECK de `branche_retour`
 *       refusent, même si (a) est un jour contourné.
 *
 * REPLI SÛR PARTOUT (AD-15) : cet étage ne fait JAMAIS échouer un tour. Il tourne dans `after()`, hors
 * du flux de réponse. Un hang, une erreur, un egress bloqué → aucune progression, un incident sans
 * art. 9 (NFR-022). L'arbre qui ne feuille pas ce tour-ci feuillera au prochain retour ; une réponse
 * d'Anam qui casse, elle, ne se rattrape pas.
 */

/** Port de lecture des branches candidates (adapté sous JWT par `lib/data/depot-branche`). */
export interface DepotCandidatsRetour {
  /** Les branches encore vivantes (hors rayonnement) + leur extrait source. Lève sur échec RÉEL. */
  chargerCandidats(): Promise<BrancheCandidate[]>;
  /** Consigne un retour et fait avancer la matière d'un degré. Renvoie `true` si ça a bougé. */
  progresser(args: { brancheId: string; cleTour: string }): Promise<boolean>;
}

/** Usage FORT à métrer (produit — FR-043 n'exempte QUE la détresse). */
export interface UsageRetourTheme {
  tier: TierIa;
  modele: string;
  tokensEntree: number;
  tokensSortie: number;
}

export interface DepsRetourTheme {
  supabase: SupabaseClient;
  adaptateur: AiPort;
  depot: DepotCandidatsRetour;
  /** Lit `branche_bloquee_par_detresse()` sous JWT. Repli SÛR = `true` (le doute supprime). */
  fenetreDetresseActive: () => Promise<boolean>;
  delaiMs?: number;
}

export interface ResultatRetourTheme {
  /** AD-17 / veto : la garde de pipeline a supprimé l'évaluation (aucun appel fort). */
  supprime: boolean;
  /** Nombre de branches dont la matière a effectivement avancé (0 si aucune, ou si déjà vues ce jour). */
  progressions: number;
  /** Coût FORT à métrer (`null` si aucun appel — supprimé, aucun candidat, hang, ou egress bloqué). */
  usage: UsageRetourTheme | null;
}

const DELAI_RETOUR_MS = 8000;

function avecDelai<T>(p: Promise<T>, ms: number): Promise<T> {
  let minuteur: ReturnType<typeof setTimeout>;
  const delai = new Promise<never>((_, rej) => {
    minuteur = setTimeout(() => rej(new Error("retour_theme_timeout")), ms);
  });
  return Promise.race([p.finally(() => clearTimeout(minuteur)), delai]);
}

export async function evaluerRetourThemeDuTour(
  deps: DepsRetourTheme,
  args: { messages: MessageIa[]; verdict: VerdictSecurite; cleTour: string; tour: string },
): Promise<ResultatRetourTheme> {
  // (a) [AC6 DUR / AD-17] garde de PIPELINE. Ordre identique à la reconceptualisation : le prédicat pur
  // d'abord (pas de RPC si le verdict tranche déjà), la fenêtre détresse ensuite (elle seule couvre le
  // 72 h post-extinction, que le verdict ne porte pas).
  if (!doitExecuterTravailSchema(args.verdict) || (await deps.fenetreDetresseActive())) {
    return { supprime: true, progressions: 0, usage: null };
  }

  // (b) PRÉSÉLECTION déterministe — gratuite, et elle décide s'il y a lieu de dépenser un appel fort.
  // Une panne de lecture n'est PAS une raison de faire échouer le tour : on ne fait rien, c'est tout.
  let candidats: BrancheCandidate[];
  try {
    candidats = preselectionner(await deps.depot.chargerCandidats(), args.tour);
  } catch (e) {
    journaliserIncidentSecurite("retour_theme_candidats_exception", e);
    return { supprime: false, progressions: 0, usage: null };
  }
  if (candidats.length === 0) return { supprime: false, progressions: 0, usage: null };

  // (c) UNE confirmation FORTE sous egress art. 9. Budget borné : un hang du fort en tâche de fond ne
  // doit pas traîner derrière la réponse déjà rendue.
  let res;
  try {
    res = await avecDelai(
      envoyerSousEgressArt9({
        supabase: deps.supabase,
        adaptateur: deps.adaptateur,
        requete: requeteRetourTheme(args.messages, candidats),
      }),
      deps.delaiMs ?? DELAI_RETOUR_MS,
    );
  } catch (e) {
    journaliserIncidentSecurite("retour_theme_egress_exception", e);
    return { supprime: false, progressions: 0, usage: null };
  }
  if (res.bloque) return { supprime: false, progressions: 0, usage: null };

  const usage: UsageRetourTheme = {
    tier: res.reponse.tier,
    modele: res.reponse.modele,
    tokensEntree: res.reponse.usage.tokensEntree,
    tokensSortie: res.reponse.usage.tokensSortie,
  };

  const { indices } = lireRetoursTheme(res.reponse.texte, candidats.length);
  if (indices.length === 0) return { supprime: false, progressions: 0, usage };

  // (d) ÉCRITURE gardée, branche par branche. L'échec de l'une ne doit pas emporter les autres : un
  // refus (fenêtre détresse ouverte entre-temps, branche effacée) est un incident journalisé sans
  // art. 9, jamais une exception qui remonte. La RPC est idempotente — un retry ne double rien.
  let progressions = 0;
  for (const i of indices) {
    try {
      if (await deps.depot.progresser({ brancheId: candidats[i].id, cleTour: args.cleTour })) progressions++;
    } catch (e) {
      journaliserIncidentSecurite("retour_theme_persist_exception", e);
    }
  }
  return { supprime: false, progressions, usage };
}
