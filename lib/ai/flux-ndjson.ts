/**
 * Cadrage NDJSON du flux de conversation (Story 2.2) — une ligne JSON par événement, `\n` en
 * séparateur. Trames client : `{"t":"delta","c":"…"}` (fragment de texte), `{"t":"fin"}` (fin
 * propre), `{"t":"erreur"}` (échec fournisseur). Le tier/usage/modèle ne transitent JAMAIS ici
 * (métrage serveur uniquement, AD-2).
 *
 * `JSON.stringify` échappe les sauts de ligne du contenu (`\n` → `\\n`) : un delta multi-lignes
 * (listes, paragraphes) NE casse PAS la frontière de ligne NDJSON. Verrouillé par `tests/ndjson.test.ts`.
 *
 * ⚠️ Contrat client (Phase B) : le flux est `delta* (fin | erreur)`. `erreur` est une trame
 * TERMINALE au même titre que `fin` (aucun `fin` n'est émis après une `erreur`). Le client doit la
 * traiter comme fin d'échec (texte partiel conservé + « Réessayer »). [voir deferred-work.md]
 */
export type TrameClient =
  | { t: "delta"; c: string }
  | { t: "fin" }
  | { t: "erreur" };

/** Sérialise une trame en une ligne NDJSON (JSON compact + `\n` terminal). */
export function ligneNdjson(trame: TrameClient): string {
  return JSON.stringify(trame) + "\n";
}
