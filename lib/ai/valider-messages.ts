import "server-only";
import type { MessageIa } from "./port";

/**
 * Valide le corps d'une requête de message SANS jamais journaliser le contenu (art. 9).
 *
 * N'accepte QUE les rôles `user`/`assistant` du client. Le rôle `system` est **injecté côté
 * serveur** (Story 2.2), JAMAIS accepté depuis le navigateur : sinon une cliente contrôlerait le
 * prompt système et contournerait les garde-fous (divulgation IA, détresse) — revue 2.1.
 */
export function extraireMessages(corps: unknown): MessageIa[] | null {
  if (typeof corps !== "object" || corps === null || !("messages" in corps)) return null;
  const brut = (corps as { messages: unknown }).messages;
  if (!Array.isArray(brut)) return null;
  const rolesClient = new Set(["user", "assistant"]); // JAMAIS "system" depuis le client
  const messages: MessageIa[] = [];
  for (const m of brut) {
    if (typeof m !== "object" || m === null) return null;
    const { role, content } = m as { role?: unknown; content?: unknown };
    if (typeof role !== "string" || !rolesClient.has(role) || typeof content !== "string") {
      return null;
    }
    messages.push({ role: role as MessageIa["role"], content });
  }
  return messages.length > 0 ? messages : null;
}
