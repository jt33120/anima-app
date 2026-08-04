import "server-only"; // barrière de compilation : jamais côté client (AD-12 / AD-2)
import { createSupabaseAdminClient } from "@/lib/data/supabase/admin";

/**
 * rpc-repli.ts — Le squelette « appeler une RPC de sécurité sous le client admin, RETOMBER sur un
 * défaut SÛR à la moindre panne » (Story 2.5, extrait de `depot-episode` 2.4 — DRY, AD-15).
 * Partagé par le dépôt d'épisode (`depot-episode.ts`) ET la garde de montage (`limites-commerciales.ts`).
 *
 * L'incident est journalisé SANS art. 9 (motif + nom d'exception seuls, NFR-022) : jamais de contenu
 * sensible en log. Le repli sûr penche TOUJOURS vers la protection — c'est l'appelant qui choisit le
 * `defautSurEchec` protecteur (ex. « limites levées = true » : le doute suspend le commerce).
 */

/**
 * Forme d'un code d'erreur exploitable : SQLSTATE Postgres (`42501`, `22P02`) ou code PostgREST (`PGRST116`).
 * On ne journalise QUE ce qui ressemble à ça — c'est ce qui rend l'extraction ci-dessous sûre par
 * CONSTRUCTION plutôt que par convention. NFR-022 : du texte libre pourrait porter de l'art. 9.
 */
const FORME_CODE = /^[A-Z0-9]{5,10}$/i;

/**
 * Le code diagnosticable d'une erreur, ou `undefined`. Exporté pour être testé DIRECTEMENT (un test qui
 * passe par un mock qui jette prouve moins et casse plus).
 *
 * RE-REVUE — l'extraction vivait dans `lib/safety/projection-arbre.ts` et n'était appliquée QU'À un seul
 * appelant : les deux routes de 4.6 passaient l'`Error` brute et journalisaient toutes `code: "Error"`,
 * c'est-à-dire rien. Un refus RLS art. 9 y était indiscernable d'une panne réseau. L'extraction est donc
 * remontée DANS le journaliseur : plus personne ne peut l'oublier. Et le filtre `FORME_CODE` ferme du même
 * coup le repli qui journalisait le message entier quand il ne contenait pas « : ».
 */
export function codeJournalisable(detail?: unknown): string | undefined {
  const d = detail as { code?: unknown } | undefined;
  if (d && typeof d.code === "string") return d.code;
  if (!(detail instanceof Error)) return undefined;
  const queue = detail.message.split(": ").pop()?.trim();
  if (queue && FORME_CODE.test(queue)) return queue; // « branche.chargerBranches: 42501 » → « 42501 »
  return detail.name; // sinon le NOM de l'exception seul : jamais le message (il pourrait porter de l'art. 9)
}

/**
 * Codes Postgres qui veulent dire « une GARDE A REFUSÉ », pas « le système est en panne » :
 * 42501 (RLS/privilège), 23514 (CHECK), 23503 (clé étrangère), 22P02 (uuid mal formé), P0001 (`raise` d'un
 * trigger — c'est ainsi que parlent nos gardes AD-17 et d'immuabilité).
 *
 * RE-REVUE — sans cette distinction, TOUT refus métier était journalisé par `journaliserIncidentSecurite`,
 * dont le libellé annonce « indisponibilité d'une RPC de sécurité » : un observateur cherchait une panne de
 * RPC là où une utilisatrice avait simplement demandé quelque chose qui ne lui est pas permis. Le canal
 * réservé aux vrais incidents (celui où vivent les alertes de détresse) était noyé par du bruit ordinaire.
 */
const REFUS_METIER = new Set(["42501", "23514", "23503", "22P02", "P0001"]);

export function estRefusMetier(detail?: unknown): boolean {
  const code = codeJournalisable(detail);
  return typeof code === "string" && REFUS_METIER.has(code);
}

/** Un refus de garde : tracé pour le diagnostic, mais JAMAIS dans le canal des incidents de sécurité. */
export function journaliserRefusGarde(motif: string, detail?: unknown): void {
  console.warn("garde: écriture refusée (consentement, propriété, forme ou état) — comportement attendu", {
    motif,
    code: codeJournalisable(detail),
  });
}

export function journaliserIncidentSecurite(motif: string, detail?: unknown): void {
  console.error("securite: indisponibilité d'une RPC de sécurité — repli sûr (AD-15)", {
    motif,
    code: codeJournalisable(detail),
  });
}

/**
 * Appelle `nomRpc(args)` sous le client admin et RETOMBE sur `defautSurEchec` à la moindre panne
 * (erreur Supabase OU exception), en journalisant un incident sans art. 9.
 */
export async function rpcAvecRepli<T>(
  nomRpc: string,
  args: Record<string, unknown>,
  interpreter: (data: unknown) => T,
  defautSurEchec: T,
  motif: string,
): Promise<T> {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc(nomRpc, args);
    if (error) {
      journaliserIncidentSecurite(`${motif}_echoue`, error); // journalise le code Postgres
      return defautSurEchec;
    }
    return interpreter(data);
  } catch (e) {
    journaliserIncidentSecurite(`${motif}_exception`, e);
    return defautSurEchec;
  }
}
