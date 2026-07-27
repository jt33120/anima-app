/**
 * types.ts — Le modèle de VUE du fil de conversation (Story 2.2, B2). Éphémère en session : les
 * tours vivent dans l'état client (aucune table de conversation en 2.2 — la persistance est
 * l'Epic 4, AD-8). Ce n'est PAS du modèle de scène (lib/scene reste pur) : c'est une feature de
 * rendu (AD-7). Aucune règle de domaine ici — juste la forme d'un tour à l'écran.
 */

/** L'état d'un tour d'Anam : en cours de flux, terminé proprement, ou échec (coupure sans `fin`). */
export type EtatAnam = "flux" | "complet" | "echec";

/**
 * Un tour du fil. Union discriminée par `role` : les mots de l'utilisatrice n'ont pas d'état
 * (ils sont posés, optimistes, jamais retirés — AC1) ; la voix d'Anam porte un état de flux.
 */
export type Tour =
  | { readonly id: string; readonly role: "utilisatrice"; readonly texte: string }
  | { readonly id: string; readonly role: "anam"; readonly texte: string; readonly etat: EtatAnam };
