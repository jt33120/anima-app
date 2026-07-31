/**
 * Story 4.5 (T2) — le domaine PUR de la naissance d'une branche (AD-1 : 0 I/O, aucun Next/Supabase/DOM, aucun
 * modèle). Ici vivent les deux décisions CALCULÉES CÔTÉ SERVEUR : le texte de la proposition (déterministe —
 * jamais un LLM, jamais un décret) et la validité d'un nom (AC2). Les libellés STATIQUES de l'UI (« Ok. »,
 * « Comment tu l'appelles ? ») sont du chrome de rendu → `render/conversation/copie-proposition.ts` (le rendu
 * ne peut pas importer `lib/`, frontière AD-7).
 *
 * Séparation reconceptualisation ≠ détresse (comme `lib/domain/reconceptualisation.ts`) : ce module n'importe
 * AUCUN module de détresse. La garde AD-17 vit au point d'écriture (migration 0021), jamais ici.
 */

/** Jour civil (année, mois, jour) d'un instant DANS le fuseau Europe/Paris — DST géré par l'Intl. */
function jourCivilParis(d: Date): { y: number; m: number; j: number } {
  const parts = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const val = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { y: val("year"), m: val("month"), j: val("day") };
}

/** Nombre de jours civils Paris entre deux instants (b − a), indépendant de l'heure et du passage DST. */
function deltaJoursParis(a: Date, b: Date): number {
  const ja = jourCivilParis(a);
  const jb = jourCivilParis(b);
  return Math.round((Date.UTC(jb.y, jb.m - 1, jb.j) - Date.UTC(ja.y, ja.m - 1, ja.j)) / 86_400_000);
}

/**
 * Le tour de proposition d'Anam (charte §6.2, version canonique courte) — DÉTERMINISTE, aucun modèle : Anam
 * ne décrète pas une prise de conscience, elle demande. Le délai (jours civils Paris) choisit « hier soir »
 * (la veille) ou « l'autre jour » (si l'utilisatrice n'est pas revenue le lendemain). La question reste
 * fermée-douce (« Tu veux en faire une branche ? ») — jamais une affirmation.
 *
 * La citation du verbatim exact (« quand tu as écrit que… ») est DIFFÉRÉE (v1 générique) : éviter le
 * snippeting hasardeux d'un contenu art. 9. Voir Dev Notes de la story.
 */
export function phraseProposition({ signalCreeLe, maintenant }: { signalCreeLe: Date; maintenant: Date }): string {
  // « hier » (delta 1) / « l'autre jour » (plus ancien) — sans jamais affirmer le MOMENT de la journée (revue 4.5
  // #5 : le signal de la veille peut dater du matin ; « hier soir » mentirait sur des heures qu'on n'a pas).
  const quand = deltaJoursParis(signalCreeLe, maintenant) === 1 ? "hier" : "l'autre jour";
  return `Il s'est passé quelque chose ${quand}. Tu veux en faire une branche ?`;
}

/**
 * AC2 [DUR] — miroir applicatif du garde-fou serveur : un nom vide ou fait uniquement d'espaces N'EST PAS un
 * nom. Le doute ne fait naître aucune branche (la vérité atomique reste le CHECK + la policy + la RPC).
 */
export function nomValide(nom: string): boolean {
  return nom.trim().length > 0;
}
