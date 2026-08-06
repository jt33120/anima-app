import { nomDonne, rognerNom, NOM_LONGUEUR_MAX } from "@/render/nom-branche";

/**
 * intention.ts — La validation d'une ÉTAPE DE PLAN, côté RENDU (Story 4.10).
 *
 * ⚠️ CE MODULE NE CONTIENT AUCUNE RÈGLE NOUVELLE, ET C'EST TOUT SON INTÉRÊT. La forme d'une moitié
 * d'intention est EXACTEMENT celle d'un nom de branche : au moins un caractère qui s'affiche, dans la
 * même borne. Il réutilise donc `nom-branche.ts` — la même fonction, pas une copie.
 *
 * `render/` ne peut pas importer `lib/` (frontière AD-7), d'où l'existence de miroirs ; la leçon R1-bis
 * dit que chaque miroir supplémentaire est une divergence en attente. Ici il n'y en a pas de nouveau :
 * la garde d'équivalence base ⟺ domaine ⟺ rendu (`nom-branche-equivalence.test.ts`) couvre donc aussi
 * le plan d'étapes, sans qu'on ait rien à re-prouver.
 *
 * Miroirs côté serveur : `public.texte_significatif` (migration 0036) et `lib/domain/intention.ts`.
 */

/** La borne haute d'une moitié — LA MÊME que celle du nom, importée. Jamais un second `300`. */
export const INTENTION_LONGUEUR_MAX = NOM_LONGUEUR_MAX;

/** Une moitié est-elle donnée ? Reste-t-il quelque chose qui s'affiche, une fois les invisibles retirés ? */
export const moitieDonnee = (texte: string) => nomDonne(texte);

/** La moitié rognée comme le fera la base (`public.rogner_texte`) — pour ne rien envoyer d'autre. */
export const rognerMoitie = (texte: string) => rognerNom(texte);

/** Recevable = donnée ET dans la borne, sur les DEUX moitiés. Une seule ne fait pas une intention. */
export function etapeRecevable(declencheur: string, alors: string): boolean {
  const moitie = (t: string) => moitieDonnee(t) && rognerMoitie(t).length <= INTENTION_LONGUEUR_MAX;
  return moitie(declencheur) && moitie(alors);
}

/**
 * Le jour civil Europe/Paris, au format que la base attend (`YYYY-MM-DD`).
 *
 * ⚠️ `formatToParts` ET PAS une locale « qui rend du ISO » (`en-CA`, `sv-SE`…). La première version
 * utilisait `en-CA` — précisément la technique que `lib/domain/ordonnanceur.ts` refuse explicitement :
 * « ces astuces dépendent des données de locale de l'environnement, et une CI qui change de conteneur
 * les casse en silence ». On lit les champs par leur NOM, comme le domaine.
 */
function jourParis(instant: Date): string {
  const parties = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const lire = (type: string) => parties.find((x) => x.type === type)!.value;
  return `${lire("year")}-${lire("month")}-${lire("day")}`;
}

/**
 * La première date qu'une échéance peut porter : DEMAIN à Paris.
 *
 * ⚠️ PAS aujourd'hui, et la revue 4.10 l'a établi : le rappel du jour part au tick de l'ordonnanceur
 * (06:00 UTC), et `rappels_echeance_dus` ne regarde QUE `echeance = aujourd'hui`, jamais `<=`. Une
 * échéance posée aujourd'hui après ~08 h à Paris ne se déclencherait donc jamais — et rien n'est
 * rattrapé. C'est mot pour mot l'argument qui fait refuser hier (« lui laisser poser un rendez-vous
 * dont on sait déjà qu'il n'aura pas lieu »), appliqué au cas le plus fréquent.
 */
export const demainParis = (maintenant: Date = new Date()) =>
  jourParis(new Date(maintenant.getTime() + 86_400_000));

/**
 * L'échéance est-elle recevable ? MIROIR CLIENT de `echeanceRecevable` (`lib/domain/intention.ts`), que
 * le rendu ne peut pas importer (frontière AD-7).
 *
 * Elle manquait entièrement : `etapeRecevable` ne regardait que les deux moitiés, et le seul garde-fou
 * était l'attribut `min` — figé au rendu, donc faux pour un formulaire ouvert au passage de minuit, et
 * ignoré par les navigateurs sans contrainte native sur `type=date`. Un refus DÉFINITIF (400) était
 * alors présenté comme réessayable, sur un champ dont rien n'indiquait qu'il était le fautif.
 */
export function echeanceRecevable(echeance: string | null, maintenant: Date = new Date()): boolean {
  if (echeance === null || echeance === "") return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(echeance)) return false;
  const [a, m, j] = echeance.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1, j));
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== m - 1 || d.getUTCDate() !== j) return false;
  return echeance >= demainParis(maintenant);
}
