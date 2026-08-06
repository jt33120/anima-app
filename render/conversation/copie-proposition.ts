/**
 * Copie de la proposition de branche (Story 4.5) — chrome de RENDU, local à `render/` (patron
 * `offre-abonnement.ts`). Le rendu ne peut pas importer `lib/` (frontière AD-7) : les libellés statiques
 * vivent donc ici. La voix CALCULÉE côté serveur (la phrase de proposition « hier soir / l'autre jour »)
 * vit, elle, dans `lib/domain/branche.ts` et arrive par prop.
 *
 * Source : charte §6.3 — « Comment tu l'appelles ? » / « Tes mots, pas les miens. » / le refus « Ok. »
 * (rien d'autre, aucune insistance, aucun « ! »).
 */
export const INVITE_NOMMAGE = "Comment tu l'appelles ?";
export const SOUS_TITRE_NOMMAGE = "Tes mots, pas les miens.";
export const REPONSE_REFUS = "Ok.";
export const ACTION_NOMMER = "Nommer";
export const CONFIRME_NAISSANCE = "Ta branche existe.";
/** Échec de création (réseau / garde serveur) — neutre, sans dramatiser, retryable (revue 4.5, #3). */
export const ECHEC_NAISSANCE = "Je n'ai pas pu créer cette branche. Tu peux réessayer.";

/**
 * Story 4.10 (AC4) — le geste de l'invitation. « La voir » et rien de plus : ni « Y aller maintenant »
 * (qui presse), ni « Travailler dessus » (qui met au travail), ni un chiffre. Le libellé ne dit pas non
 * plus LAQUELLE — le nom de la branche est de l'art. 9, et il s'affichera sur sa fiche, chez elle.
 */
export const ACTION_ALLER_VERS_BRANCHE = "La voir";
