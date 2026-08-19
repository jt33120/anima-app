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
  const quand = deltaJoursParis(signalCreeLe, maintenant) === 1 ? "hier" : "l’autre jour";
  return `Il s’est passé quelque chose ${quand}. Tu veux en faire une branche ?`;
}

/**
 * AC2 [DUR] — miroir applicatif du garde-fou serveur : un nom fait uniquement de caractères SANS GLYPHE
 * n'est pas un nom. Le doute ne fait naître aucune branche (la vérité atomique reste le CHECK + la policy).
 *
 * R1-bis (revue 4.5, ré-appliqué en 4.6) : cette classe doit rester ÉQUIVALENTE à celle de
 * `public.branche_nom_significatif` (migration 0023) — ni plus faible (la base laisserait passer ce que
 * l'app refuse), ni plus stricte (le bouton resterait actif et la RPC lèverait un échec incompréhensible).
 * `\s` couvre déjà [:space:] + les espaces Unicode ; on y ajoute les invisibles SANS CHASSE, qui ne sont
 * pas des blancs au sens Unicode mais n'affichent rien : U+00AD (soft hyphen), U+115F/U+1160 (jamo fillers),
 * U+180E, U+200B–U+200F, U+2060–U+2064, U+2800 (braille blank), U+3164 (hangul filler), U+FEFF (BOM).
 */
const SANS_GLYPHE = /[\s\u00a0\u00ad\u034f\u061c\u115f-\u1160\u1680\u17b4-\u17b5\u180b-\u180f\u2000-\u200f\u2028-\u2029\u202f\u205f\u2060-\u206f\u2800\u3000\u3164\ufe00-\ufe0f\ufeff\uffa0\ufff9-\ufffb\u{1d173}-\u{1d17a}\u{e0000}-\u{e01ef}]/gu;

/** MIROIR du CHECK `branche_nom_borne` (migration 0023). Sans lui, la base est plus stricte que l'app :
 *  le bouton reste actif et la RPC lève un échec incompréhensible (asymétrie R1-bis en sens inverse). */
export const NOM_LONGUEUR_MAX = 300;

export function nomValide(nom: string): boolean {
  const reste = nom.replace(SANS_GLYPHE, "");
  return reste.length > 0 && nom.trim().length <= NOM_LONGUEUR_MAX;
}
