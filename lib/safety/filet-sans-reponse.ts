import type { TrameClient } from "@/lib/ai/flux-ndjson";

/**
 * CE QU'ON REND QUAND LA RÉPONSE NE VIENT PAS — un seul endroit
 * (revue adversariale du 2026-08-18, R12).
 *
 * ══ POURQUOI UNE FONCTION POUR TROIS LIGNES ═══════════════════════════════════════════════════
 *
 * Le tort n'était pas une ligne oubliée. C'était qu'il existait DEUX endroits où écrire la même
 * règle, et que l'un des deux avait été corrigé sans l'autre. Six lignes les séparaient :
 *
 *   • le `catch` d'ouverture de flux rendait `[...(trameRessources ? [trameRessources] : []),
 *     { t: "erreur" }]`, avec un commentaire expliquant précisément pourquoi jeter le bloc était
 *     grave ;
 *   • sa branche jumelle, `if (egress.bloque)`, rendait un `NextResponse.json` 403 nu.
 *
 * Or le client fait `if (!reponse.ok) throw` : ce 403 devenait « une erreur est survenue », et le
 * 3114 n'atteignait jamais l'écran de quelqu'un que la classification venait de signaler.
 *
 * ══ CE QUE L'ORDRE PORTE ══════════════════════════════════════════════════════════════════════
 *
 * Le filet d'abord, `erreur` en dernier. `erreur` est TERMINALE (contrat `delta* (fin | erreur)`,
 * `lib/ai/flux-ndjson.ts`) : le client cesse de lire dès qu'il la voit. Émettre les ressources
 * après elle, c'est ne pas les émettre du tout.
 *
 * Et `erreur` ne se retire pas « pour ne pas alarmer » : c'est elle qui allume « Réessayer ». Un
 * filet sans issue serait un second mur.
 */
export function tramesQuandLaReponseManque(
  trameRessources: TrameClient | null,
): readonly TrameClient[] {
  return [...(trameRessources ? [trameRessources] : []), { t: "erreur" as const }];
}
