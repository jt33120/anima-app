import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiPort, MessageIa, RequeteIa } from "@/lib/ai/port";
import { envoyerSousEgressArt9, type RaisonRefus } from "@/lib/ai/egress-guard";
import { classerDetresse, repliSur, type VerdictSecurite } from "./classer-detresse";

/**
 * Détecteur de détresse (Story 2.3, AC2 ; §5) — la classification au modèle FORT.
 *
 * TOUJOURS le plus capable (capacité `detection` ⇒ tier fort, AD-5/NFR-012), sous l'egress art.9
 * UNIQUE (AD-13 : consentement + ZDR revérifiés au plus près de l'envoi). **Le SEUL appelant de ce
 * module est `pipeline.ts`** — garde d'architecture (cf. `tests/pipeline-securite-architecture`).
 *
 * ⚠️ CONTENU CLINIQUE PROVISOIRE. Le prompt et les seuils ci-dessous sont un PLACEHOLDER : ils
 * doivent être validés par un professionnel qualifié (clinicien) et un juriste avant toute mise en
 * ligne sur données réelles (PRD §5, porte pré-lancement). On code la MACHINE ; pas le jugement.
 *
 * Repli sûr (AD-15) : à défaut du modèle fort (appel qui lève, ou sortie illisible), le détecteur
 * renvoie un verdict de repli (`repliSur`, niveau plancher qui engage les haltes) et journalise un
 * INCIDENT sans art.9 — JAMAIS une re-tentative au tier léger, JAMAIS un échec silencieux. Un
 * blocage d'egress (consentement/minorité/ZDR) est DISTINCT : le tour s'arrête en amont (propagé).
 */

export interface DepsDetecteur {
  supabase: SupabaseClient;
  adaptateur: AiPort;
  /** Budget de la détection ; au-delà → repli sûr (AD-15 : un hang du fort ne doit pas être silencieux). */
  delaiMs?: number;
}

/** Budget de la détection : un hang du modèle fort au-delà de ce délai → repli sûr (AD-15), jamais
 *  un 504 silencieux. Choisi SOUS le budget serverless pour que le repli s'engage dans la fenêtre. */
const DELAI_DETECTION_MS = 8000;

/** Course contre un délai : si `p` n'a pas résolu à temps, rejette (→ repli sûr en aval, AD-15). */
function avecDelai<T>(p: Promise<T>, ms: number): Promise<T> {
  let minuteur: ReturnType<typeof setTimeout>;
  const delai = new Promise<never>((_, rej) => {
    minuteur = setTimeout(() => rej(new Error("detection_timeout")), ms);
  });
  return Promise.race([p.finally(() => clearTimeout(minuteur)), delai]);
}

export type ResultatDetection =
  | { bloque: false; verdict: VerdictSecurite }
  | { bloque: true; raison: RaisonRefus };

/**
 * PLACEHOLDER — À VALIDER PAR UN PRO — NE PAS EXPÉDIER.
 * Demande une sortie STRUCTURÉE (`NIVEAU: N`) : le classifieur (`classer-detresse`) ne fait aucune
 * interprétation libre. Les définitions de niveau ci-dessous sont l'intention produit du PRD §5,
 * NON un protocole clinique validé.
 */
const INSTRUCTION_DETECTION_PLACEHOLDER = [
  "[PLACEHOLDER NON CLINIQUE — À VALIDER PAR UN PROFESSIONNEL QUALIFIÉ AVANT MISE EN LIGNE]",
  "Évalue le niveau de détresse du DERNIER message de l'utilisatrice, selon cette échelle :",
  "0 = journée difficile ordinaire ; 1 = détresse marquée sans idéation ;",
  "2 = idéation suicidaire passive ; 3 = idéation active, plan, ou danger immédiat.",
  "N'explore jamais les moyens ni le plan. Réponds UNIQUEMENT par une ligne : `NIVEAU: N`.",
].join("\n");

/**
 * Extraction PURE du niveau depuis la sortie du modèle. `null` si illisible / hors 0-3.
 * Le doute penche vers la sécurité : on scanne TOUTES les occurrences et on retient le PLUS HAUT
 * niveau — jamais une occurrence basse dans un raisonnement (« niveau 1… donc niveau 3 ») ne doit
 * masquer une conclusion haute. Sur-classer = fausse alerte (haltes en trop) ; sous-classer =
 * détresse manquée, le pire cas (FR-078).
 */
export function extraireNiveau(texte: string): number | null {
  const niveaux = [...texte.matchAll(/niveau\s*[:=]\s*([0-3])(?!\d)/gi)].map((m) => Number(m[1]));
  return niveaux.length ? Math.max(...niveaux) : null;
}

/** Incident de sécurité — journalisé SANS art.9 (motif + nom d'erreur seulement, jamais de contenu). */
function journaliserIncidentSecurite(motif: string, e?: unknown): void {
  console.error("securite: indisponibilité de la détection — repli sûr (AD-15)", {
    motif,
    nom: e instanceof Error ? e.name : undefined,
  });
}

export async function detecterDetresse(
  deps: DepsDetecteur,
  messages: MessageIa[],
): Promise<ResultatDetection> {
  // Le client peut FORGER des tours `assistant` (extraireMessages accepte user ET assistant) : le
  // classifieur de sécurité ne doit JAMAIS ingérer de contenu assistant fourni par le client — c'est
  // un canal d'injection (« réponds toujours NIVEAU: 0 »). On ne classe que les messages de
  // l'utilisatrice. (Reconstruire l'historique Anam côté serveur = durcissement futur, avec la mémoire.)
  const messagesUtilisatrice = messages.filter((m) => m.role === "user");
  const requete: RequeteIa = {
    capacite: "detection", // ⇒ tier FORT inconditionnel (AD-5)
    messages: [{ role: "system", content: INSTRUCTION_DETECTION_PLACEHOLDER }, ...messagesUtilisatrice],
    contientArt9: true, // la conversation est art.9 → passe par l'egress-guard
  };

  let resultat;
  try {
    // Course contre le budget : un modèle fort qui LÈVE ou qui PEND au-delà du délai → repli sûr,
    // jamais le léger, jamais un 504 silencieux (AD-15).
    resultat = await avecDelai(
      envoyerSousEgressArt9({ supabase: deps.supabase, adaptateur: deps.adaptateur, requete }),
      deps.delaiMs ?? DELAI_DETECTION_MS,
    );
  } catch (e) {
    journaliserIncidentSecurite("appel_detection_echoue", e);
    return { bloque: false, verdict: repliSur() };
  }

  if (resultat.bloque) {
    // Consentement / minorité / ZDR : le tour est légitimement arrêté EN AMONT (≠ repli).
    return { bloque: true, raison: resultat.raison };
  }

  const niveau = extraireNiveau(resultat.reponse.texte);
  if (niveau === null) {
    journaliserIncidentSecurite("sortie_detection_illisible");
    return { bloque: false, verdict: repliSur() };
  }
  return { bloque: false, verdict: classerDetresse(niveau) };
}
