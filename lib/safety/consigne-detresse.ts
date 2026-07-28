import type { MessageIa } from "@/lib/ai/port";
import type { VerdictSecurite } from "./classer-detresse";
import { numeroEnTete } from "./bloc-ressources-detresse";

/**
 * consigne-detresse.ts — la FORME de la réponse d'Anam par niveau (Story 2.6, AC1/2/3), PURE.
 *
 * La forme dérive de `verdict.decision` (déjà produite par le pipeline 2.3, AD-16) — JAMAIS une
 * seconde classification, jamais une seconde horloge de sécurité (AD-17). Cette consigne est
 * INJECTÉE côté serveur en `{ role: "system" }` juste avant la génération (route) ; le client ne
 * peut pas la forger (`valider-messages` refuse `system`). Elle ne transite JAMAIS jusqu'au client.
 *
 * Couture de la voix (Story 2.8) : 2.6 pose l'OVERLAY détresse ; 2.8 composera la voix de base
 * d'Anam au-dessus (`[voix, détresse, …messages]`). Ici, uniquement l'overlay de sécurité.
 *
 * ⚠️ CONTENU PROVISOIRE — porte pré-lancement clinique + juridique (PRD §5). Les formulations
 * ci-dessous sont l'INTENTION PRODUIT (cf. « Formulations de référence » du PRD), NON un protocole
 * clinique validé : à faire valider par un professionnel qualifié et un juriste avant mise en ligne.
 * On code la MACHINE (quelle consigne pour quelle décision) ; pas le jugement clinique.
 */

/** Interdits durs présents dans TOUTE consigne ≥ 1 (FR-039/041/075/076). Aucun numéro ici : le
 *  niveau 1 ne montre AUCUN dispositif (AC1). Les numéros vivent dans les addenda 2 et 3. */
const PREAMBULE = [
  "Tu es Anam. Cette personne traverse un moment de détresse. Règles absolues, non négociables :",
  "- Tu ne t’en vas pas : tu restes avec elle. Orienter n’est pas abandonner.",
  "- Tu n’es pas une professionnelle de santé et tu ne prétends jamais la prendre en charge.",
  "- N’explore jamais le plan ni les moyens : ni comment, ni avec quoi, ni quand.",
  "- Cherche s’il y a quelqu’un qu’elle peut appeler ou rejoindre maintenant, et encourage-la à le faire.",
  "- Aucune promesse creuse, aucune formule creuse, aucun jargon.",
].join("\n");

/** Niveau 1 (et repli sûr) : la bascule n’est PAS annoncée — Anam devient plus douce, rien de plus. */
const ADOUCIR = [
  "Bascule non annoncée : tu deviens simplement plus douce.",
  "Tu restes, tu écoutes, tu ne pousses plus. N’annonce aucun changement, ne nomme aucun dispositif.",
].join(" ");

/**
 * L'addendum spécifique à la décision. Aux niveaux 2-3, le numéro NOMMÉ dérive de `numeroEnTete(verdict)`
 * — le MÊME que la carte mène (voix ↔ carte cohérentes, quelle que soit la famille — revue 2.6, R1).
 * Jamais un numéro codé en dur : une victime de violences s'entend nommer le 3919, pas le 3114.
 */
function addendum(verdict: VerdictSecurite): string {
  switch (verdict.decision) {
    case "adoucir":
    case "repli_sur":
      return ADOUCIR;
    case "intervenir": {
      const num = numeroEnTete(verdict) ?? "3114";
      return `Nomme ce que tu as entendu et demande-lui directement, sans détour ni dramatisation. Donne-lui le ${num}, la ligne adaptée à sa situation, et dis-lui qu'il est là pour exactement ce moment.`;
    }
    case "urgence": {
      const num = numeroEnTete(verdict) ?? "3114";
      return `Parle ouvertement, avec calme. Oriente sans attendre vers le ${num} (et le 15/112 en cas de danger vital immédiat). Reste avec elle.`;
    }
    default:
      return ADOUCIR; // `poursuivre` est filtré en amont (consigneReponse) ; défaut protecteur par sûreté.
  }
}

/**
 * La consigne système à préfixer à la réponse, dérivée du verdict. `null` au niveau 0 (`poursuivre`) :
 * Anam reste elle-même, RIEN n’est ajouté (AC1 — aucune consigne, aucun élément).
 */
export function consigneReponse(verdict: VerdictSecurite): MessageIa | null {
  if (verdict.decision === "poursuivre") return null;
  return { role: "system", content: `${PREAMBULE}\n\n${addendum(verdict)}` };
}
