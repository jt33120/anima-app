import "server-only";
import type { CapaciteIa, NiveauSecurite, TierIa } from "./port";

/**
 * Politique de tier — la politique UNIQUE `(capacité, niveau_sécurité) → tier` (AD-5, Story 2.2).
 *
 * C'est LA seule fonction qui décide du tier : les appelants déclarent leur CAPACITÉ, la politique
 * résout ; aucun `if` fournisseur, aucun tier codé en dur chez un appelant. Résolue CÔTÉ SERVEUR ;
 * le client ne choisit jamais le tier.
 *
 * Règle dure : dès `niveau_sécurité ≥ 1`, le modèle FORT est forcé — pour la détection ET la
 * réponse de détresse, jamais le léger, en aucune circonstance (AD-5, NFR-012). La Story 2.3
 * (pipeline sécurité) PRODUIT ce niveau ; ici il est CONSOMMÉ (défaut 0).
 *
 * Modèles par id DATÉ (jamais `-latest`) : un repoint amont silencieux ne doit pas changer le
 * comportement sur le chemin art. 9. (Vérifié 2026-07-27 : Small 4 / Large 3.)
 */

const MODELE: Record<TierIa, string> = {
  leger: "mistral-small-2603",
  fort: "mistral-large-2512",
};

/**
 * Résout le tier. Détresse (niveau ≥ 1) → FORT forcé pour toute capacité. Sinon : échange courant
 * → léger ; reconceptualisation & synthèse → fort.
 */
export function tierPour(capacite: CapaciteIa, niveauSecurite: NiveauSecurite = 0): TierIa {
  // La DÉTECTION de détresse (§5) est TOUJOURS au plus capable, jamais le léger, en aucune
  // circonstance (AD-5, NFR-012) — et sans dépendre du niveau qu'elle est en train de calculer.
  // Explicite (pas incident) : un futur repoint de la branche par défaut ne doit pas la casser.
  if (capacite === "detection") return "fort";
  // L'HYPOTHÈSE D'ENNÉAGRAMME (Story 5.5) est tranchée ICI, EXPLICITEMENT, alors que le repli
  // ci-dessous lui donnerait déjà « fort ». Ce n'est pas de la redondance décorative : le repli tient
  // à une seule expression (`=== "echange"`), et quiconque la retournerait un jour — pour donner le
  // léger à une capacité bon marché — ferait basculer CELLE-CI avec, sans le voir. L'objet touche à
  // l'IDENTITÉ : se tromper ne coûte pas une phrase maladroite, ça pose une étiquette fausse sur
  // quelqu'un. Le choix est donc écrit, pas hérité.
  if (capacite === "hypothese_enneagramme") return "fort";
  if (niveauSecurite >= 1) return "fort"; // AD-5 : détresse → le plus capable, jamais le léger
  // Tout le reste (reconceptualisation, synthèse, retour_theme) est du travail de schéma : FORT.
  return capacite === "echange" ? "leger" : "fort";
}

export function modelePour(tier: TierIa): string {
  return MODELE[tier];
}
