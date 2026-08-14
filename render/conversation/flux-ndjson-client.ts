/**
 * flux-ndjson-client.ts — Le CŒUR PUR du client de streaming (Story 2.2, B4). Miroir client du
 * transport NDJSON serveur (lib/ai/flux-ndjson.ts) : texte → texte, AUCUNE dépendance DOM/réseau,
 * pour rester testable en env node. Le hook `useFluxAnam` orchestre le `fetch`/reader ; toute la
 * logique DÉCIDABLE (découpe, parsing, révélation par mots) vit ici, seule et prouvée.
 *
 * AD-7 : ce module ne connaît NI `lib/ai` NI supabase NI `process.env` — le rendu ne parle qu'à
 * `app/api` (et ici, même pas : il ne manipule que des chaînes).
 */

import type { RessourceVue } from "./types";

/**
 * Trame reçue du serveur. `delta` = fragment ; `fin`/`erreur` = terminales (contrat delta* (fin|erreur)).
 * `ressources` (Story 2.6) = bloc de détresse, NON terminal, inséré avant/après le tour d'Anam.
 */
export type TrameRecue =
  | { t: "delta"; c: string }
  | { t: "fin" }
  | { t: "erreur" }
  | { t: "ressources"; position: "avant" | "apres"; verifieLe: string; ressources: RessourceVue[] }
  | { t: "beat"; beat: BeatRecu }
  | { t: "bilan"; titre: string; points: string[] }
  /** Proposition d'abonnement (Story 3.2) : signal PUR, aucun payload. NON terminale — la carte
   *  s'insère sous le bilan, on continue de lire jusqu'à `fin`. */
  | { t: "paywall" }
  /** Allocation résiduelle épuisée (Story 3.4) : signal PUR, aucun payload. SEULE trame du flux quand
   *  on coupe (aucun delta, aucun `fin`) — la copie (ligne système + motif) vit côté client. */
  | { t: "quota" }
  /**
   * LA CARTE DÉPOSÉE (Story 5.8) : NON terminale — le visuel se pose, puis la question arrive en
   * `delta`, puis `fin`.
   *
   * ⚠️ DEUX CHAMPS, ET C'EST UNE GARDE, PAS UNE ÉCONOMIE. Il n'y a pas de champ de signification et
   * il n'y en aura pas (FR-018) : le catalogue de sens existe côté serveur et n'a AUCUNE
   * représentation client avant la réponse de l'utilisatrice. `description` dit ce qui est DESSINÉ —
   * la matière que l'œil reçoit — jamais ce que ça veut dire ; elle peut être `null` (23 des 24
   * visuels ne sont pas encore dessinés, et le rendu dit l'absence plutôt que de la combler).
   */
  | { t: "carte"; cle: string; description: string | null }
  /** LA LECTURE (Story 5.8) : bloc DOCUMENT, comme `bilan`. NON terminale — `fin` suit. */
  | { t: "lecture"; lectureId: string; texte: string };

/** Beat d'apparition d'Anam (Story 2.7). Miroir client du variant serveur `flux-ndjson.ts`. */
export type BeatRecu = "ouverture" | "nommer" | "cloture";

/**
 * Découpe un tampon NDJSON en lignes complètes, en RENDANT la dernière ligne partielle (un chunk
 * réseau peut couper un objet JSON en deux). L'appelant recolle `reste` au chunk suivant. Les
 * lignes vides (double `\n`) sont écartées — jamais émises comme trames.
 */
export function extraireLignes(tampon: string): { lignes: string[]; reste: string } {
  const morceaux = tampon.split("\n");
  const reste = morceaux.pop() ?? ""; // dernière = partielle (ou "" si le tampon finit par \n)
  return { lignes: morceaux.filter((l) => l.length > 0), reste };
}

/**
 * Analyse une ligne NDJSON en trame typée. Ne jette JAMAIS (JSON invalide → `null`) et ignore les
 * trames inconnues (forward-compat : un futur type ne casse pas le client). Un `delta` dont le `c`
 * n'est pas une chaîne dégénère en `""` — jamais une valeur non-texte injectée dans le fil.
 */
export function analyserTrame(ligne: string): TrameRecue | null {
  let obj: unknown;
  try {
    obj = JSON.parse(ligne);
  } catch {
    return null;
  }
  if (typeof obj !== "object" || obj === null) return null;
  const t = (obj as { t?: unknown }).t;
  if (t === "delta") {
    const c = (obj as { c?: unknown }).c;
    return { t: "delta", c: typeof c === "string" ? c : "" };
  }
  if (t === "fin") return { t: "fin" };
  if (t === "erreur") return { t: "erreur" };
  if (t === "ressources") return analyserRessources(obj);
  if (t === "beat") return analyserBeat(obj);
  if (t === "bilan") return analyserBilan(obj);
  if (t === "paywall") return { t: "paywall" }; // signal pur (Story 3.2), aucun champ à valider
  if (t === "quota") return { t: "quota" }; // signal pur (Story 3.4), aucun champ à valider
  if (t === "carte") return analyserCarte(obj);
  if (t === "lecture") return analyserLecture(obj);
  return null;
}

/**
 * Valide STRICTEMENT une trame `carte` (Story 5.8). `cle` non vide obligatoire ; `description`
 * facultative — `null` quand le visuel n'est pas encore dessiné, et c'est un état NORMAL du produit
 * aujourd'hui (23 cartes sur 24).
 *
 * ⚠️ TOUT CHAMP SUPPLÉMENTAIRE EST IGNORÉ, ET C'EST LA DERNIÈRE LIGNE DE DÉFENSE DE FR-018. Si un
 * jour le serveur émettait un `sens` — par accident, par refactor, par zèle —, il n'atteindrait pas
 * le fil : cette fonction reconstruit la trame champ par champ au lieu de la laisser passer.
 */
function analyserCarte(obj: object): TrameRecue | null {
  const o = obj as { cle?: unknown; description?: unknown };
  if (typeof o.cle !== "string" || o.cle.length === 0) return null;
  const description = typeof o.description === "string" && o.description.length > 0 ? o.description : null;
  return { t: "carte", cle: o.cle, description };
}

/** Valide STRICTEMENT une trame `lecture` (Story 5.8) : un identifiant et un texte, tous deux non vides. */
function analyserLecture(obj: object): TrameRecue | null {
  const o = obj as { lectureId?: unknown; texte?: unknown };
  if (typeof o.lectureId !== "string" || o.lectureId.length === 0) return null;
  if (typeof o.texte !== "string" || o.texte.length === 0) return null;
  return { t: "lecture", lectureId: o.lectureId, texte: o.texte };
}

/**
 * Valide STRICTEMENT une trame `bilan` (Story 2.9) : un titre non vide ET au moins un point, tous
 * des chaînes non vides. Toute forme inattendue → `null` (forward-compat : un vieux client ignore la
 * trame ; le rendu reste muet). Le bilan est déjà STRUCTURÉ par le serveur — le client ne parse aucun
 * markdown, il ne fait que valider et transporter.
 */
function analyserBilan(obj: object): TrameRecue | null {
  const o = obj as { titre?: unknown; points?: unknown };
  if (typeof o.titre !== "string" || o.titre.length === 0) return null;
  if (!Array.isArray(o.points) || o.points.length === 0) return null;
  if (o.points.some((p) => typeof p !== "string" || p.length === 0)) return null;
  return { t: "bilan", titre: o.titre, points: o.points as string[] };
}

/**
 * Valide STRICTEMENT une trame `beat` (Story 2.7) : seul un identifiant connu passe ; tout autre →
 * `null` (forward-compat, un futur beat ne casse pas le client). No-leak : la trame ne porte QUE le beat.
 */
function analyserBeat(obj: object): TrameRecue | null {
  const b = (obj as { beat?: unknown }).beat;
  if (b === "ouverture" || b === "nommer" || b === "cloture") return { t: "beat", beat: b };
  return null;
}

/**
 * Valide STRICTEMENT une trame `ressources` (Story 2.6). Toute forme inattendue → `null` : une trame
 * malformée est simplement ignorée (forward-compat), et la sécurité NE dépend jamais de ce bloc — le
 * filet hors-IA (`/aide`, porte de secours) reste la garantie inconditionnelle (AD-15).
 */
function analyserRessources(obj: object): TrameRecue | null {
  const o = obj as { position?: unknown; verifieLe?: unknown; ressources?: unknown };
  const position = o.position === "avant" || o.position === "apres" ? o.position : null;
  // Tableau vide REFUSÉ : un bloc d'aide sans aucune ressource (juste la date) n'a pas de sens (R9).
  if (!position || typeof o.verifieLe !== "string" || !Array.isArray(o.ressources) || o.ressources.length === 0) {
    return null;
  }
  const ressources: RessourceVue[] = [];
  for (const r of o.ressources) {
    if (typeof r !== "object" || r === null) return null;
    const { numero, tel, aria, service, desc } = r as Record<string, unknown>;
    if ([numero, tel, aria, service, desc].some((v) => typeof v !== "string")) return null;
    ressources.push({
      numero: numero as string,
      tel: tel as string,
      aria: aria as string,
      service: service as string,
      desc: desc as string,
    });
  }
  return { t: "ressources", position, verifieLe: o.verifieLe, ressources };
}

/**
 * Détache du tampon les MOTS COMPLETS (jusqu'au dernier blanc) et garde le mot en cours dans
 * `reste` : c'est la garantie « par groupes de mots, jamais caractère par caractère » (AC3,
 * NFR-014), quelle que soit la granularité des deltas amont (le factice envoie par 2 mots ; un
 * fournisseur pourrait envoyer par token/caractère — la révélation reste au mot). À la trame
 * `fin`, l'appelant vide le `reste` (le dernier mot n'a pas de blanc terminal).
 */
export function detacherMotsComplets(tampon: string): { pret: string; reste: string } {
  // Dernier caractère blanc (espace OU saut de ligne) : on révèle tout ce qui précède, inclus.
  let coupe = -1;
  for (let i = tampon.length - 1; i >= 0; i--) {
    const ch = tampon[i];
    if (ch === " " || ch === "\n" || ch === "\t") {
      coupe = i;
      break;
    }
  }
  if (coupe < 0) return { pret: "", reste: tampon };
  return { pret: tampon.slice(0, coupe + 1), reste: tampon.slice(coupe + 1) };
}
