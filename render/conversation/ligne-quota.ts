/**
 * ligne-quota.ts — La copie de l'allocation résiduelle épuisée (Story 3.4, AC4). Registre SYSTÈME
 * (jamais signé Anam), PROVISOIRE (porte produit). Vit côté CLIENT (render-local, AD-7 : la trame
 * `quota` est un signal PUR, aucune copie serveur — même patron que `offre-abonnement.ts`, 3.2).
 *
 * N'APPÂTE JAMAIS : ni « premium », ni « abonne », ni bouton d'achat (ce n'est pas un paywall). Elle
 * informe que l'échange IA s'arrête pour le mois ET rappelle que le socle reste ouvert (FR-058).
 */
export const LIGNE_QUOTA_EPUISEE =
  "L’échange avec Anam s’arrête ici pour ce mois-ci. Le reste de l’app reste ouvert.";
