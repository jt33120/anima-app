import { nomValide, NOM_LONGUEUR_MAX } from "@/lib/domain/branche";
import { fenetreDe } from "@/lib/domain/ordonnanceur";

/**
 * Story 4.10 (T2) — le domaine PUR du plan d'étapes (AD-1 : 0 I/O, aucun Next/Supabase/DOM, aucun modèle).
 *
 * ── CE QUI N'EST PAS ICI, ET POURQUOI ─────────────────────────────────────────────────────────────────
 *
 * L'ORDRE DU PLAN. Il vit dans `charger_plan` (migration 0036), et nulle part ailleurs. Le retrier ici
 * ferait DEUX ordres, et deux ordres finissent toujours par diverger — c'est précisément le défaut corrigé
 * en 0033. Le dépôt rend la liste dans l'ordre où la base la donne ; personne ne la retouche.
 *
 * LA GÉNÉRATION DES ÉTAPES. Décision PO D1 : elle écrit, Anam pas. Il n'y a donc aucune consigne, aucun
 * appel modèle, aucun egress dans cette story. Une intention d'implémentation EST une prescription
 * comportementale (« si tu te sens mal, alors… ») ; la faire produire par un modèle tomberait pile dans ce
 * que le PRD interdit. La forme est garantie par la FORME DES DONNÉES — deux colonnes non vides.
 */

/**
 * La borne haute d'une moitié d'intention. Ce n'est PAS une seconde valeur : c'est la même que celle du nom
 * de branche, importée. Écrire `300` ici en ferait une copie, donc une divergence en attente.
 */
export const INTENTION_LONGUEUR_MAX = NOM_LONGUEUR_MAX;

/** Une étape du plan, telle que la base la rend (`charger_plan`). L'ordre est celui de la liste, pas du rang. */
export interface Intention {
  readonly id: string;
  /** Le « si » — de sa main, art. 9. */
  readonly declencheur: string;
  /** Le « alors » — de sa main, art. 9. */
  readonly action: string;
  /** Date civile `YYYY-MM-DD`, ou `null` : une intention sans échéance est parfaitement légitime. */
  readonly echeance: string | null;
  readonly rang: number;
}

/**
 * Une moitié d'intention est-elle donnée ? C'est EXACTEMENT la règle du nom de branche — et c'est la MÊME
 * FONCTION, pas une copie : la classe de caractères sans glyphe n'a jamais eu rien de spécifique aux noms,
 * et la garde d'équivalence base ⟺ domaine ⟺ rendu (`nom-branche-equivalence.test.ts`) couvre donc aussi
 * le plan d'étapes, sans qu'on ait rien à re-prouver.
 *
 * Miroir applicatif de `public.texte_significatif` + des bornes `<= 300` (migration 0036). La vérité
 * atomique reste le CHECK et la policy ; ceci est l'échec rapide, pour ne pas laisser un bouton actif sur
 * une requête qui ne peut pas aboutir.
 */
export function moitieDonnee(texte: string): boolean {
  return nomValide(texte);
}

/** AC1 [DUR] — « si X, alors Y » : les DEUX moitiés, ou rien. Une seule fait une consigne, pas une intention. */
export function intentionRecevable(e: { declencheur: string; action: string }): boolean {
  return moitieDonnee(e.declencheur) && moitieDonnee(e.action);
}

/**
 * AC3 — l'échéance est « qu'elle a elle-même fixée », et c'est une DATE CIVILE, jamais un instant.
 * « Vendredi » à Paris n'est pas `2026-08-07T00:00:00Z` : le jour de référence passe donc par
 * `fenetreDe("quotidien", …)`, la même fonction que l'ordonnanceur — une seule notion de « aujourd'hui »
 * dans le produit.
 *
 * REFUSÉE AVANT DEMAIN, et c'est de l'honnêteté, pas de la rigueur.
 *
 * La sélection des rappels ne regarde QUE le jour même (`echeance = aujourd'hui`, jamais `<=`, parce
 * qu'un rappel en retard est un reproche daté). Une échéance d'hier ne se déclencherait donc jamais —
 * l'accepter reviendrait à lui laisser poser un rendez-vous dont on sait déjà qu'il n'aura pas lieu.
 *
 * ⚠️ ET « AUJOURD'HUI » EST DANS LE MÊME CAS (revue 4.10) : le tick de l'ordonnanceur passe à 06:00 UTC,
 * donc une échéance posée dans la journée arrive APRÈS son propre rappel. La première version acceptait
 * `>= aujourd'hui` et le champ de saisie la PROPOSAIT activement — l'argument écrit juste au-dessus
 * s'appliquait mot pour mot au cas le plus fréquent, et personne ne l'avait vu.
 *
 * AUCUNE BORNE HAUTE, délibérément. Une échéance à deux ans est peut-être étrange, mais c'est la sienne, et
 * inventer une limite que le produit n'a jamais demandée serait décider à sa place.
 */
export function echeanceRecevable(echeance: string | null, maintenant: Date): boolean {
  if (echeance === null) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(echeance)) return false;
  // `2026-02-31` passe la forme et n'est pas une date. Le seul contrôle fiable est l'aller-retour :
  // `Date.UTC` normalise silencieusement, donc une date inexistante ne se réécrit pas à l'identique.
  const [a, m, j] = echeance.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1, j));
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== m - 1 || d.getUTCDate() !== j) return false;
  // DEMAIN, pas aujourd'hui : voir ci-dessus. Le jour civil passe par `fenetreDe`, la seule notion
  // d'« aujourd'hui à Paris » du domaine — jamais un `toISOString().slice(0,10)`.
  return echeance >= fenetreDe("quotidien", new Date(maintenant.getTime() + 86_400_000));
}

/** La recevabilité COMPLÈTE d'une étape — ce que l'appelant doit vérifier avant d'écrire. */
export function etapeRecevable(
  e: { declencheur: string; action: string; echeance: string | null },
  maintenant: Date,
): boolean {
  return intentionRecevable(e) && echeanceRecevable(e.echeance, maintenant);
}
