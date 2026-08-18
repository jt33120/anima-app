import type { Tour } from "./types";

/**
 * rejeu.ts — CE QUE « RÉESSAYER » RETIRE DU FIL, ET SURTOUT CE QU'IL N'EN RETIRE PAS.
 *
 * ══ POURQUOI CES DEUX FONCTIONS SONT SORTIES DU COMPOSANT ═══════════════════════════════════════
 *
 * La règle qu'elles portent a coûté à ce dépôt sa trouvaille la plus grave côté écran (revue des
 * Epics 1 à 4). Tant qu'elle vivait à l'intérieur d'un `setTours` dans `Conversation.tsx`, aucun test
 * ne pouvait l'exercer : les gardes se rabattaient sur la LECTURE DU SOURCE — « le filtre cite-t-il
 * le mot `carte` ? » —, et un test qui lit un fichier ne voit pas ce qu'un fil devient.
 *
 * ══ LA RÈGLE ═══════════════════════════════════════════════════════════════════════════════════
 *
 * `reessayer` retire le tour d'Anam en échec, et avec lui les blocs qu'un rejeu réémettrait EN
 * DOUBLE : le bilan et le paywall (revue 2.6 R2 / 3.2 — un tour de clôture qui échoue APRÈS avoir
 * émis son bilan en laisserait un orphelin, et le rejeu en insérerait un second).
 *
 * ⚠️ LE BLOC DE RESSOURCES DE DÉTRESSE N'EN FAIT PAS PARTIE, ET C'EST TOUTE LA QUESTION. Il y était.
 * Le 3114 disparaissait donc par le geste même que l'écran propose à quelqu'un dont le tour vient
 * d'échouer — et il ne revenait pas : la seconde tentative retombe sur le même fournisseur dégradé,
 * le repli rend un niveau bas, et aucun bloc n'est réémis sous le niveau 2. Une femme classée
 * « idéation active » se retrouvait sans un seul numéro, de façon déterministe dès que la panne
 * durait plus d'un tour.
 *
 * Le doublon qu'on craignait se règle donc à l'INSERTION (`blocRessourcesDejaPresent`), jamais par
 * une suppression préalable : refuser d'AJOUTER ne peut pas laisser l'écran vide — retirer, si.
 * C'est le patron déjà écrit pour la carte de lecture, qui n'a délibérément aucun `ancreId`.
 */

/** Le fil APRÈS un « Réessayer » sur le tour d'Anam `idAnam`. */
export function toursApresRejeu(tours: readonly Tour[], idAnam: string): Tour[] {
  return tours.filter(
    (t) =>
      t.id !== idAnam &&
      // Seuls le bilan et le paywall partent avec leur ancre. Ni la carte (elle n'a pas d'ancre), ni
      // le bloc de ressources (il ne doit JAMAIS pouvoir quitter l'écran).
      !((t.role === "bilan" || t.role === "paywall") && t.ancreId === idAnam),
  );
}

/**
 * Ce bloc de ressources est-il DÉJÀ dans le fil pour ce tour ? Comparé sur les numéros, parce que
 * c'est ce qu'elle lit : deux blocs portant les mêmes numéros sont le même filet, quel que soit l'id
 * que le client leur a donné.
 */
export function blocRessourcesDejaPresent(
  tours: readonly Tour[],
  idAnam: string,
  ressources: readonly { readonly numero: string }[],
): boolean {
  const numeros = signature(ressources);
  return tours.some(
    (t) => t.role === "ressource" && t.ancreId === idAnam && signature(t.ressources) === numeros,
  );
}

const signature = (r: readonly { readonly numero: string }[]) => r.map((x) => x.numero).join("|");
