/**
 * flux-ndjson-client.ts — Le CŒUR PUR du client de streaming (Story 2.2, B4). Miroir client du
 * transport NDJSON serveur (lib/ai/flux-ndjson.ts) : texte → texte, AUCUNE dépendance DOM/réseau,
 * pour rester testable en env node. Le hook `useFluxAnam` orchestre le `fetch`/reader ; toute la
 * logique DÉCIDABLE (découpe, parsing, révélation par mots) vit ici, seule et prouvée.
 *
 * AD-7 : ce module ne connaît NI `lib/ai` NI supabase NI `process.env` — le rendu ne parle qu'à
 * `app/api` (et ici, même pas : il ne manipule que des chaînes).
 */

/** Trame reçue du serveur. `delta` = fragment ; `fin`/`erreur` = terminales (contrat delta* (fin|erreur)). */
export type TrameRecue = { t: "delta"; c: string } | { t: "fin" } | { t: "erreur" };

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
  return null;
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
