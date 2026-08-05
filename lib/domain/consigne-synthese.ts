import type { MessageIa } from "@/lib/ai/port";
import type { MateriauSynthese } from "@/lib/domain/synthese";

/**
 * LA CONSIGNE DE SYNTHÈSE (Story 4.9, T2) — cœur PUR (AD-1), patron de `consigneBilan` (2.9).
 *
 * La synthèse est le moment où Anam peut être la plus DIRECTE — c'est la promesse de la story, et elle
 * tient à une propriété du support : ce n'est pas un tour de conversation, c'est un BLOC DOCUMENT. Les
 * titres et les listes y sont autorisés (jamais quand Anam parle — FR-084), et la franchise y est
 * possible parce que l'utilisatrice vient LIRE, à froid, un texte qu'elle a choisi d'ouvrir.
 *
 * ⚠️ PROVISOIRE — porte pré-lancement produit, comme `consigneBilan`. Contient volontairement le lexique
 * interdit sous forme d'instructions INVERSES → exclue du contrôle bloquant de contenu (2.8).
 *
 * ⚠️ Frontière honnête : la conformité du TEXTE GÉNÉRÉ n'est pas prouvable par un test statique — il
 * n'existe pas en source. Ce que les tests prouvent ici, c'est ce qui ENTRE : jamais un fait tombstoné,
 * jamais une entrée d'épisode de détresse, jamais un verbatim au-delà du plafond.
 */

const SYNTHESE = [
  "[PLACEHOLDER PRODUIT — À VALIDER AVANT MISE EN LIGNE]",
  "Rédige la SYNTHÈSE de la période : un bloc document, pas un tour de conversation.",
  "",
  "Registre document : les titres et les listes sont AUTORISÉS ici (ils ne le sont jamais quand Anam",
  "parle). Structure clairement — un titre court, quelques mouvements, ce qui revient.",
  "",
  "C'est le moment où tu peux être la plus DIRECTE. Nomme ce qui se répète, y compris ce qui n'est pas",
  "agréable à lire — mais uniquement à partir de ce qui a été dit. Tu ne restitues que le matériau :",
  "tu n'ajoutes rien, tu n'inventes rien, tu ne transformes pas une hypothèse en verdict.",
  "",
  "Interdits : aucun vocabulaire clinique ou médical, aucun « soin » ni « soigner ». Jamais une",
  "conclusion enveloppante (« n'oublie pas que tu es forte »), jamais un récapitulatif empathique",
  "(« il semble que tu ressentes… »). La synthèse n'est jamais signée d'un affect : elle restitue.",
  "",
  "Aucun chiffre de progression, aucun compte, aucun score, aucune comparaison entre périodes.",
  "",
  "Tu n'es pas Anima : tu ne cites une parole d'Anima qu'à la troisième personne et uniquement depuis",
  "le corpus fourni — jamais une citation fabriquée.",
].join("\n");

/**
 * La consigne, constante PROVISOIRE. Injectée SERVEUR pour la passe fort dédiée — jamais reçue du client.
 */
export function consigneSynthese(): MessageIa {
  return { role: "system", content: SYNTHESE };
}

/**
 * Le matériau, mis en messages.
 *
 * Un seul message `user` plutôt qu'un message par entrée : le modèle doit lire une PÉRIODE, pas rejouer
 * une conversation. Rendre le journal sous forme de tours `user`/`assistant` l'inviterait à répondre au
 * dernier message au lieu de survoler l'ensemble — c'est le piège classique de la synthèse par chat.
 *
 * L'aveu de troncature est DANS le matériau, pas dans un champ à côté : le modèle doit pouvoir écrire
 * « cette synthèse commence le … » sans qu'on le lui rappelle après coup.
 */
export function messagesSynthese(materiau: MateriauSynthese): MessageIa[] {
  const lignes: string[] = [];

  if (materiau.faits.length > 0) {
    lignes.push("CE QU'ANAM RETIENT (faits actifs, déjà validés) :");
    for (const fait of materiau.faits) lignes.push(`- ${fait}`);
    lignes.push("");
  }

  if (materiau.tronquee) {
    lignes.push(
      `NOTE : la période contient ${materiau.total} échanges ; seuls les ${materiau.entrees.length} plus`,
      "récents te sont fournis. Dis dans la synthèse qu'elle ne couvre pas tout le début de la période.",
      "",
    );
  }

  lignes.push("LA PÉRIODE, DANS L'ORDRE :");
  for (const e of materiau.entrees) {
    lignes.push(`${e.role === "anam" ? "Anam" : "Elle"} : ${e.contenu}`);
  }

  return [{ role: "user", content: lignes.join("\n") }];
}
