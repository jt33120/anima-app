import type { MessageIa } from "@/lib/ai/port";

/**
 * La CONSIGNE DE GÉNÉRATION DU BILAN (Story 2.9, T2) — cœur PUR (AD-1), patron de `consigneVoixAnam`.
 * Le bilan est un REGISTRE DIFFÉRENT de la conversation : c'est un BLOC DOCUMENT où les titres et les
 * listes sont AUTORISÉS (ils ne le sont jamais quand Anam parle — FR-084). Généré en une PASSE
 * SÉPARÉE au tier FORT (AD-5, registre document/synthèse) et émis dans une trame `bilan` dédiée qui
 * CONTOURNE la troncature 3 phrases de 2.8 (T3/T4). Injectée serveur, jamais reçue du client.
 *
 * Ce que le bilan reprend : les MOTS de l'utilisatrice, en clair — jamais une invention, jamais un
 * ajout, jamais une reformulation en verdict.
 *
 * ⚠️ Frontière honnête : la conformité du CONTENU GÉNÉRÉ (médical, affect, invention) est portée par
 * cette consigne AU RUNTIME — elle n'est PAS prouvable par un test statique (le texte n'existe pas en
 * source). Seuls les libellés STATIQUES du bloc document sont scannés par le contrôle bloquant (T6).
 *
 * ⚠️ PROVISOIRE — porte pré-lancement produit. Contient VOLONTAIREMENT le lexique interdit comme
 * instructions INVERSES → EXCLU du contrôle bloquant de contenu (T6), au même titre que les consignes
 * de voix, de phase et de détresse.
 */

const BILAN = [
  "[PLACEHOLDER PRODUIT — À VALIDER AVANT MISE EN LIGNE]",
  "Rédige le BILAN de la séance : un bloc document, pas un tour de conversation.",
  "",
  "Registre document : ici les titres et les listes sont AUTORISÉS (ils ne le sont jamais quand Anam",
  "parle). Structure clairement — un titre court, quelques points. Reprends les MOTS de l’utilisatrice,",
  "en clair. Tu ne restitues que ce qui a été dit : tu n’ajoutes rien, tu n’inventes rien, tu ne",
  "transformes pas une hypothèse en verdict.",
  "",
  "Interdits : aucun vocabulaire clinique ou médical, aucun « soin » ni « soigner ». Jamais une",
  "conclusion enveloppante (« n’oublie pas que tu es forte »), jamais un récapitulatif empathique",
  "(« il semble que tu ressentes… »). Le bilan n’est jamais signé d’un affect (« ça m’a touchée ») :",
  "il restitue, il ne s’attribue rien.",
  "",
  "Tu n’es pas Anima : tu ne cites une parole d’Anima qu’à la troisième personne et uniquement depuis",
  "le corpus fourni — jamais une citation fabriquée.",
].join("\n");

/** La consigne de génération du bilan, constante PROVISOIRE. Injectée pour la passe fort dédiée. */
export function consigneBilan(): MessageIa {
  return { role: "system", content: BILAN };
}
