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

export function journaliserIncidentSecurite(motif: string, detail?: unknown): void {
  // `code` = code Postgres (erreur Supabase `{ code }`, PAS une instance d'Error) OU nom d'exception.
  // JAMAIS de message/contenu art. 9 (NFR-022) — le code seul relie la panne à sa RPC, diagnosticable.
  const d = detail as { code?: unknown } | undefined;
  const code =
    d && typeof d.code === "string" ? d.code : detail instanceof Error ? detail.name : undefined;
  console.error("securite: indisponibilité d'une RPC de sécurité — repli sûr (AD-15)", { motif, code });
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
