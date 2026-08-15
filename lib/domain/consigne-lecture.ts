import type { MessageIa } from "@/lib/ai/port";

/**
 * consigne-lecture.ts — LA CONSIGNE DU TOUR DE LECTURE (Story 5.8, AC4) — cœur PUR (AD-1).
 *
 * Patron de `consigneBilan` : registre DOCUMENT (titres et listes autorisés, contrairement à la voix
 * d'Anam en FR-084), passe séparée au tier FORT, trame dédiée qui contourne la troncature à trois
 * phrases de la 2.8. Injectée serveur, jamais reçue du client, jamais renvoyée au client.
 *
 * ── CE QUE CETTE CONSIGNE DOIT TENIR, ET QUI N'EST PAS ÉVIDENT ────────────────────────────────
 *
 * FR-019 : « la personnalisation vit dans la lecture, jamais dans la sélection ». La sélection est
 * déjà aveugle par construction (AD-11 : arité nulle, verrou d'imports). Ce fichier est donc l'endroit
 * OÙ LA PERSONNALISATION A LE DROIT D'EXISTER — et il doit tenir la seule chose qu'un modèle fera
 * spontanément de travers : partir de la carte au lieu de partir d'elle.
 *
 * ⚠️ LA CARTE N'EST PAS DANS LA CONSIGNE, ET C'EST DÉLIBÉRÉ. Ni sa clé, ni sa description, ni son
 * sens. Le modèle ne reçoit que ce qu'ELLE a dit avoir vu. S'il recevait la carte, il aurait deux
 * sources — ce qu'elle projette et ce que l'image montre — et il arbitrerait entre les deux ; or
 * l'arbitrage est déjà tranché par FR-018 : c'est sa projection qui fait foi, pas l'image. Lui donner
 * l'image, c'est l'inviter à corriger ce qu'elle a vu.
 *
 * ── LA COUTURE DU CATALOGUE DE SENS ───────────────────────────────────────────────────────────
 *
 * `lib/lecture/sens-cartes.ts` porte 21 créneaux, tous `non_ecrit`, et l'usage du catalogue attend
 * une décision (note privée consultée APRÈS qu'elle a parlé / garde-fou de ce que la carte ne veut
 * JAMAIS dire / suppression pure).
 *
 * CETTE FONCTION EST LE SEUL ENDROIT QUI AURAIT À LE LIRE. Aujourd'hui elle ne le lit pas, et la
 * story se livre entière sans lui. Si la décision est « suppression », le module disparaît sans que
 * rien ici ne bouge ; si c'est « note » ou « garde-fou », un paramètre s'ajoute à cette signature et
 * nulle part ailleurs.
 *
 * ⚠️ QUELLE QUE SOIT LA DÉCISION, LE CATALOGUE NE FRANCHIT JAMAIS LA FRONTIÈRE SERVEUR→CLIENT
 * (FR-018, AC2 [DUR]). `render/lecture/types.ts` n'a pas de champ pour l'accueillir, et une garde
 * vérifie qu'il n'en gagne pas.
 *
 * ⚠️ PROVISOIRE — porte pré-lancement produit. Contient VOLONTAIREMENT le lexique interdit sous forme
 * d'instructions INVERSES → exclu du contrôle bloquant de contenu, comme les consignes de voix, de
 * phase, de détresse et de bilan.
 */

const LECTURE = [
  "[PLACEHOLDER PRODUIT — À VALIDER AVANT MISE EN LIGNE]",
  "L'utilisatrice vient de dire ce qu'elle voit sur une carte. Écris la lecture.",
  "",
  "PARS DE SES MOTS À ELLE. Ce sont eux la matière — pas l'image, que tu n'as pas et que tu n'as pas",
  "à avoir. Reprends-les en clair, tu ne les corriges pas, tu ne les complètes pas, tu ne dis jamais",
  "qu'elle aurait pu voir autre chose. Ce qu'elle a projeté est ce sur quoi on travaille.",
  "",
  "Éclaire-les de ce que tu sais d'elle par la conversation. C'est là — et seulement là — que la",
  "lecture devient la sienne plutôt qu'un texte général.",
  "",
  "Registre document : un titre court, quelques paragraphes. Ses mots à elle apparaissent en clair.",
  "",
  "INTERDITS, sans exception :",
  "- aucune prédiction, aucune date, aucun « il va se passer », aucun « tu vas ressentir » ;",
  "- ne nomme jamais la carte, ne lui donne aucun titre, aucun mot-clé, aucune signification établie ;",
  "- ne relie la carte ni à un signe, ni à un nombre, ni à un type de personnalité ;",
  "- ne propose jamais de tirer une autre carte, et ne laisse pas entendre que celle-ci serait mal tombée ;",
  "- aucun vocabulaire clinique ou médical, aucun « soin » ni « soigner » ;",
  "- ne dis jamais ce qu'elle ressent : tu proposes, tu n'affirmes pas ;",
  "- pas de conclusion enveloppante, pas de signature affective (« ça m'a touchée »).",
  "",
  "Tu n'es pas Anima : tu ne cites une parole d'Anima qu'à la troisième personne et uniquement depuis",
  "le corpus fourni — jamais une citation fabriquée.",
].join("\n");

/**
 * La consigne du tour de lecture, constante PROVISOIRE.
 *
 * Signature volontairement nue : elle ne prend ni la carte, ni le sens, ni le profil. Ce qu'elle ne
 * prend pas est ce qu'elle garantit — voir l'en-tête.
 */
export function consigneLecture(): MessageIa {
  return { role: "system", content: LECTURE };
}
