/**
 * copie-lecture.ts — LES MOTS DU RITUEL QUI NE SONT PAS GÉNÉRÉS (Story 5.8, AC3 / AC7).
 *
 * ── POURQUOI LA QUESTION EST UNE CONSTANTE ────────────────────────────────────────────────────
 *
 * FR-017 : Anam demande « Qu'est-ce que tu vois ? » — ET RIEN D'AUTRE. Deux façons de la produire,
 * et une seule tient :
 *
 *   - la faire générer EN DONNANT LA CARTE au modèle : il peut la teinter. « Qu'est-ce que cette
 *     ouverture t'évoque ? » a déjà dit quelque chose, et le teintage est invisible — personne ne
 *     relit une question de trois mots en se demandant si elle a fuité ;
 *   - la faire générer SANS donner la carte : le modèle rend la même phrase à chaque fois, au prix
 *     d'un appel et d'une latence. Autant l'écrire.
 *
 * Elle est donc constante, et le fait qu'elle soit constante est vérifiable — ce qu'une consigne ne
 * sera jamais.
 *
 * ── LES REFUS SE DISENT AVEC DES MOTS ─────────────────────────────────────────────────────────
 *
 * 0050 refusait en détresse avec un `42501` indistinct, et le résidu exigeait mieux. Ces quatre
 * phrases sont ce « mieux ». Elles sont émises comme un tour d'Anam dans le fil — jamais un statut
 * d'erreur, jamais un bandeau, jamais un code.
 *
 * ⚠️ LA PHRASE DE DÉTRESSE NE MENTIONNE NI CARTE, NI LECTURE, NI PLUS TARD. Dire « on fera ça plus
 * tard » transforme un filet en salle d'attente, et donne à la détresse le statut d'un obstacle à ce
 * qu'elle voulait. Anam reste, et c'est tout ce que la phrase dit (AD-9, §5).
 *
 * Aucune de ces phrases ne porte « soin » ni ses dérivés, aucune ne dit « ancrage » pour « lecture »
 * (FR-023) — le balayage du lexique passe sur ce fichier comme sur le reste.
 */

/** FR-017. Rien avant, rien après, rien autour. */
export const QUESTION_LECTURE = "Qu'est-ce que tu vois ?";

/**
 * Détresse (AD-17). Anam reste — aucune carte, aucune offre, aucune promesse de report.
 */
export const REFUS_DETRESSE = "Je reste là. On peut continuer à parler, aussi longtemps que tu veux.";

/** Barrière de minorité. Le compte est barré : rien d'autre ne lui est proposé. */
export const REFUS_MINORITE = "Je ne peux pas ouvrir ce moment ici.";

/**
 * Consentement art. 9 révoqué. On dit la cause ET le chemin — un refus sans chemin est une impasse,
 * et celle-ci se rouvre d'un geste.
 */
export const REFUS_CONSENTEMENT =
  "Ce moment demande ton accord pour que je travaille avec ce que tu me confies. Tu peux le redonner dans « Ce que j'ai accepté ».";

/**
 * Hors détresse et non premium. L'offre, sans urgence fabriquée : aucun prix barré, aucun compte à
 * rebours, aucune place limitée (FR-061). Le socle n'est pas coupé, et la phrase ne le laisse pas
 * croire.
 */
export const OFFRE_LECTURE =
  "Les lectures font partie de l'abonnement. Le reste de ce que tu as ici ne change pas.";
