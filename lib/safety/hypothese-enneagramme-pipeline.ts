import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiPort, MessageIa, TierIa } from "@/lib/ai/port";
import { envoyerSousEgressArt9 } from "@/lib/ai/egress-guard";
import {
  lireTypeHypothese,
  momentDeProposer,
  requeteHypotheseEnneagramme,
  type FaitsHypothese,
} from "@/lib/domain/enneagramme-hypothese";
import type { TypeEnneagramme } from "@/lib/domain/enneagramme";
import { doitExecuterTravailSchema } from "./pipeline";
import { journaliserIncidentSecurite } from "./rpc-repli";
import type { VerdictSecurite } from "./classer-detresse";
import { avecDelai } from "@/lib/domain/delai";

/**
 * hypothese-enneagramme-pipeline.ts — L'ÉTAGE QUI SÈME LE GERME (Story 5.5, T7 — AC2/AC4).
 *
 * Frère jumeau de `retour-theme-pipeline` : c'est `lib/safety/` qui orchestre (l'I/O egress + la
 * persistance gardée) ; `lib/domain/enneagramme-hypothese` (pur) est appelé d'ici, jamais l'inverse
 * (AD-1). Il tourne dans `after()`, hors du flux de réponse : aucune latence, rien à l'écran ce
 * tour-là.
 *
 * ── [AD-17] LA DOUBLE DÉFENSE, ET POURQUOI ELLE EST PLUS SERRÉE ICI QU'AILLEURS ────────────────
 *
 *   (a) ICI — aucun appel fort si le verdict supprime le travail de schéma OU si la fenêtre détresse
 *       est active (en cours ou 72 h). Le doute SUPPRIME (repli sûr = `true`) ;
 *   (b) au POINT D'ÉCRITURE — la policy `enneagramme_hypothese_depot` (0049) porte
 *       `not branche_bloquee_par_detresse()`, et elle refuserait même si (a) était contourné.
 *
 * Proposer une typologie de personnalité à quelqu'un en détresse est la définition du mauvais
 * moment : c'est le « travail de schéma » que FR-037 suspend dès le premier signal.
 *
 * ⚠️ LA GARDE (b) N'EST PAS DE LA REDONDANCE DÉCORATIVE, et c'est mesurable : retirer (a) laisse le
 * germe refusé par la base, mais fait quand même DÉPENSER l'appel fort — le coût passe, la garde
 * tient. Retirer (b) laisse tout passer. Les deux mutants ont des signatures différentes, donc les
 * deux tests aussi.
 *
 * ── ANAM NE PROPOSE QU'UNE FOIS, ET LE PRÉDICAT EST PUR ───────────────────────────────────────
 *
 * `momentDeProposer` vit dans le domaine et ne prend que deux booléens. La lecture qui les produit
 * LÈVE en cas de panne, et le doute fait SE TAIRE — reproposer un numéro à quelqu'un qui vient d'en
 * refuser un est le message générique récurrent que FR-034 interdit.
 *
 * ── REPLI SÛR PARTOUT (AD-15) ─────────────────────────────────────────────────────────────────
 *
 * Cet étage ne fait JAMAIS échouer un tour. Un hang, une erreur, un egress bloqué → aucun germe, un
 * incident journalisé sans art. 9 (NFR-022). L'hypothèse qui ne naît pas ce soir naîtra à la clôture
 * suivante ; une réponse d'Anam qui casse, elle, ne se rattrape pas.
 */

/** Port d'accès aux deux faits + à l'écriture du germe (adapté sous JWT par `lib/data`). */
export interface DepotHypothese {
  /** Les deux faits de `momentDeProposer`. LÈVE sur échec réel — le doute fait se taire. */
  faits(): Promise<FaitsHypothese>;
  /**
   * Sème le germe. `null` = refusé (détresse, consentement, déjà une en attente) — un état NORMAL,
   * jamais une exception : c'est la garde qui fonctionne.
   */
  semer(args: { type: TypeEnneagramme }): Promise<string | null>;
}

/** Usage FORT à métrer (produit — FR-043 n'exempte QUE la détresse). */
export interface UsageHypothese {
  tier: TierIa;
  modele: string;
  tokensEntree: number;
  tokensSortie: number;
}

export interface DepsHypothese {
  supabase: SupabaseClient;
  adaptateur: AiPort;
  depot: DepotHypothese;
  /** Lit `branche_bloquee_par_detresse()` sous JWT. Repli SÛR = `true` (le doute supprime). */
  fenetreDetresseActive: () => Promise<boolean>;
  delaiMs?: number;
}

export interface ResultatHypothese {
  /** AD-17 / veto / pas le moment : aucune évaluation, donc aucun appel fort. */
  supprime: boolean;
  /** L'identifiant du germe écrit, ou `null` (rien à proposer, refusé, ou panne). */
  germeId: string | null;
  /** Coût FORT à métrer (`null` si aucun appel — supprimé, hang, ou egress bloqué). */
  usage: UsageHypothese | null;
}

const DELAI_HYPOTHESE_MS = 8000;

export async function evaluerHypotheseEnneagramme(
  deps: DepsHypothese,
  args: { messages: MessageIa[]; verdict: VerdictSecurite },
): Promise<ResultatHypothese> {
  // (a) [AD-17] garde de PIPELINE. Ordre identique à la reconceptualisation et au retour sur le
  // thème : le prédicat pur d'abord (pas de RPC si le verdict tranche déjà), la fenêtre détresse
  // ensuite (elle seule couvre le 72 h post-extinction, que le verdict ne porte pas).
  if (!doitExecuterTravailSchema(args.verdict) || (await deps.fenetreDetresseActive())) {
    return { supprime: true, germeId: null, usage: null };
  }

  // (b) EST-CE LE MOMENT ? Deux booléens, une fonction pure. La lecture lève en cas de panne : on ne
  // propose pas dans le doute. C'est aussi le gate de COÛT — sans lui, un appel fort partirait à
  // chaque clôture de séance d'un compte qui a déjà répondu.
  let faits: FaitsHypothese;
  try {
    faits = await deps.depot.faits();
  } catch (e) {
    journaliserIncidentSecurite("hypothese_enneagramme_faits_exception", e);
    return { supprime: true, germeId: null, usage: null };
  }
  if (!momentDeProposer(faits)) return { supprime: true, germeId: null, usage: null };

  // (c) UNE passe FORTE sous egress art. 9. Budget borné : un hang du fort en tâche de fond ne doit
  // pas traîner derrière la réponse déjà rendue.
  let res;
  try {
    res = await avecDelai(
      envoyerSousEgressArt9({
        supabase: deps.supabase,
        adaptateur: deps.adaptateur,
        requete: requeteHypotheseEnneagramme(args.messages),
      }),
      deps.delaiMs ?? DELAI_HYPOTHESE_MS,
      "hypothese_enneagramme_timeout",
    );
  } catch (e) {
    journaliserIncidentSecurite("hypothese_enneagramme_egress_exception", e);
    return { supprime: false, germeId: null, usage: null };
  }
  if (res.bloque) return { supprime: false, germeId: null, usage: null };

  const usage: UsageHypothese = {
    tier: res.reponse.tier,
    modele: res.reponse.modele,
    tokensEntree: res.reponse.usage.tokensEntree,
    tokensSortie: res.reponse.usage.tokensSortie,
  };

  // (d) LE PARSER STRICT. `null` couvre trois cas qui méritent la même réponse — rien : le modèle a
  // dit `aucun`, il a bavardé, ou il a rendu autre chose qu'un chiffre. Aucun n'autorise à poser une
  // étiquette sur quelqu'un.
  const type = lireTypeHypothese(res.reponse.texte);
  if (type === null) return { supprime: false, germeId: null, usage };

  // (e) L'ÉCRITURE — un GERME `en_attente`, et rien d'autre. Jamais un type retenu : cet étage
  // s'exécute même quand elle a fermé l'onglet (les `after()` de ce dépôt n'interrogent JAMAIS
  // `request.signal.aborted` — seule la boucle de flux le fait). Un germe réversible le supporte ;
  // un type posé sur quelqu'un qui n'a rien lu et rien dit, non.
  try {
    return { supprime: false, germeId: await deps.depot.semer({ type }), usage };
  } catch (e) {
    journaliserIncidentSecurite("hypothese_enneagramme_persist_exception", e);
    return { supprime: false, germeId: null, usage };
  }
}
