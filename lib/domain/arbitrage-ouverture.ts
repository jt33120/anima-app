/**
 * Story 4.10 (T2) — le domaine PUR de l'ARBITRAGE D'OUVERTURE (FR-030/FR-031, AD-1 : 0 I/O, aucun import).
 *
 * La question, en une phrase : « un moment est mûr pour devenir une branche — mais elle en a déjà trois qui
 * n'ont jamais bougé. Anam propose-t-elle encore, ou invite-t-elle plutôt à faire vivre celles qui sont là ? »
 *
 * ── LE PARTAGE DES RÔLES (et il n'est pas arbitraire) ─────────────────────────────────────────────────
 *
 *   • ICI vit le SEUIL — une règle produit, qui se teste sans base.
 *   • EN BASE vit la RÉSERVATION DE LA PAROLE (`reserver_invitation_integration`, 0036) — parce qu'une
 *     réservation atomique est la seule façon d'empêcher deux rendus concurrents (deux onglets, un
 *     rafraîchissement) de dire deux fois la même chose. Le patron est celui de `reserver_notification` :
 *     la réservation EST la décision.
 *
 * ── AC5 [DUR] : LE COMPTE NE TRAVERSE JAMAIS LA FRONTIÈRE ────────────────────────────────────────────
 *
 * `Ouverture` est une UNION DISCRIMINÉE, et c'est ce qui rend FR-031 vrai par CONSTRUCTION plutôt que par
 * discipline. Le compte est lu côté serveur, il choisit une branche du `if`, et il n'existe dans AUCUN
 * champ du type qui part vers le client. Le rendu ne peut pas afficher « 3 branches en cours » : il n'a
 * jamais reçu de 3. Même patron exact que la projection muette de la 4.6 et que la trame `beat` de la 2.7.
 *
 * Une garde (`tests/arbitrage-frontiere.test.ts`) vérifie qu'aucun champ numérique n'entre dans ce type.
 */

/**
 * Combien de branches encore en `naissance` avant qu'Anam n'invite plutôt que de proposer (décision D2).
 *
 * ⚠️ PLACEHOLDER PRODUIT — au même titre que `PAS_FEUILLAISON`. Le PRD écrit « plus de 3 branches par mois »
 * (une fenêtre glissante) ; l'epic écrit « plusieurs branches ouvertes sans intégration (encore en
 * naissance) ». Ce ne sont pas la même mesure, et le PO a tranché pour la seconde : c'est la définition
 * LITTÉRALE d'« ouverte sans intégration », et elle ne dépend d'aucune fenêtre.
 *
 * Ce nombre n'est JAMAIS affiché, jamais approché, jamais suggéré (AC5). Il n'existe que pour choisir une
 * branche du `if`.
 */
export const SEUIL_BRANCHES_OUVERTES = 3;

/**
 * La fenêtre de silence d'Anam après une invitation (décision D3) — sept jours.
 *
 * Sans elle, FR-030 FABRIQUE la violation de FR-034 (« aucun message générique récurrent »). Le
 * raisonnement tient en trois lignes : le signal reste en attente (on ne le consomme pas), le seuil reste
 * franchi (rien n'a bougé), donc l'invitation repart — chaque jour. Et c'est la plus agaçante des
 * répétitions, puisqu'elle se répète PARCE QU'ELLE N'A PAS OBÉI.
 *
 * La base ajoute une seconde condition que ce nombre ne dit pas : la fenêtre écoulée ne suffit pas, il faut
 * aussi un MOUVEMENT RÉEL (une branche qui feuille ou qui rayonne). Anam le dit, puis elle se tait, et seul
 * un geste d'elle lui rend la parole.
 */
export const FENETRE_INVITATION_HEURES = 24 * 7;

/**
 * Ce que le serveur décide, et la SEULE chose qui traverse la frontière.
 *
 * `invitation` porte l'identifiant de la branche visée — et un identifiant n'est PAS un compte. Sans lui,
 * l'invitation ne mènerait nulle part, et une invitation qui ne mène nulle part est un reproche. Avec lui,
 * le rendu peut ouvrir la fiche de CETTE branche-là : le geste existe (plan d'étapes, retour sur le thème,
 * déclaration de pleine lumière), il est atteignable, et rien n'a été chiffré au passage.
 *
 * UNE branche, jamais une liste : une liste redeviendrait un compte.
 */
export type Ouverture =
  | { readonly type: "proposition"; readonly signalId: string; readonly phrase: string }
  | { readonly type: "invitation"; readonly phrase: string; readonly brancheCibleId: string }
  /**
   * Story 5.3 (AC4) — la mention UNIQUE de la complétion du socle. Elle ne porte QUE sa phrase :
   * rien à ouvrir, rien à répondre, rien à consommer. C'est un accusé de réception, pas une
   * proposition — et surtout pas une récompense.
   */
  | { readonly type: "socle-complete"; readonly phrase: string }
  /**
   * Story 5.5 (AC2) — Anam a une HYPOTHÈSE de type d'ennéagramme, et elle ouvre une porte.
   *
   * ⚠️ LE NUMÉRO N'EST PAS ICI, ET C'EST UNE DÉCISION, PAS UN OUBLI. La phrase du fil ne le nomme
   * pas (l'asséner au milieu d'une conversation est précisément ce que FR-006 interdit), et la halte
   * lit la ligne en base pour l'afficher. Le poser ici fabriquerait une SECONDE source pour le même
   * fait — la divergence R1-bis déjà payée deux fois par ce dépôt — et ouvrirait la porte au champ
   * `readonly type: number` que `tests/arbitrage-frontiere.test.ts` existe pour interdire.
   *
   * `hypotheseId` est un identifiant, pas une donnée : il sert à marquer la parole « dite » quand
   * elle a réellement atteint l'écran, et à ouvrir la bonne ligne à la halte.
   */
  | { readonly type: "hypothese-enneagramme"; readonly phrase: string; readonly hypotheseId: string }
  /**
   * Story 6.4 (AC1) — LE GESTE DE PAUSE. Comme `socle-complete`, elle ne porte QUE sa phrase : rien
   * à ouvrir, rien à répondre, rien à consommer.
   *
   * ⚠️ ET SURTOUT AUCUN NOMBRE, alors que c'est la seule ouverture du produit qui NAÎT d'un compte.
   * Les deux compteurs (séances, minutes) sont lus en base, ils choisissent une branche du `if`, et
   * ils meurent côté serveur — la ligne de `pause_rythme` les garde pour la revue produit, et
   * personne ne peut lire cette table. « Tu as eu 7 séances cette semaine » serait statistiquement
   * vrai, produirait une preuve, et transformerait une proposition en bulletin (FR-031).
   */
  | { readonly type: "pause"; readonly phrase: string };

/**
 * La voix de l'invitation — CONSTANTE, déterministe, jamais un modèle (patron `phraseProposition`).
 *
 * Une question, pas un constat, et surtout pas un décret (charte §6). Aucun chiffre, aucun « tu as
 * tendance à », aucun « tu devrais » : Anam n'a pas à diagnostiquer un travers, elle propose un geste.
 * Le mot « encore » fait tout le travail que ferait un compte, sans compter.
 */
export const PHRASE_INVITATION =
  "Il y a quelque chose que tu as déjà nommé et qui attend encore. Tu veux le faire vivre d’abord ?";

/**
 * Story 5.3 (AC4) — la mention de complétion. Dite UNE FOIS, puis plus jamais.
 *
 * ── CE QU'ELLE DIT, ET CE QU'ELLE SE GARDE DE DIRE ─────────────────────────────────────────────
 *
 * Elle rapporte un FAIT — l'heure est là, le thème a été recalculé — et elle s'arrête. Trois
 * tentations écartées, chacune pour une raison précise :
 *
 *   • « ton thème est enfin COMPLET » — ce serait faux dans un cas au moins : une naissance au pôle
 *     géographique exact n'a pas d'ascendant, quelle que soit l'heure. On ne promet pas un état
 *     qu'on n'a pas vérifié ; on rapporte le geste, qui est vrai partout.
 *   • « bravo », « tu as débloqué » — le socle n'est pas une récompense qu'on décroche (charte §6,
 *     et FR-051 : « motif de retour honnête, jamais une carotte »).
 *   • « va voir ton ascendant » — un impératif ferait de l'accusé de réception une relance.
 *
 * Aucun futur adressé (`tests/socle-incomplet.test.ts` applique `chercherPredictions` aux phrases de
 * cette story) : « tu le verras » deviendrait une petite promesse, là où « il est là » est un fait.
 */
export const PHRASE_SOCLE_COMPLETE =
  "Ton heure de naissance est enregistrée. J’ai repris ton thème avec elle — l’ascendant et les " +
  "maisons en font partie maintenant.";

/**
 * Y a-t-il trop de branches ouvertes sans intégration ? Le prédicat est ici, seul, et il ne rend qu'un
 * booléen — c'est déjà la première étape de « le compte ne sort pas ».
 */
export function tropDeBranchesOuvertes(branchesEnNaissance: number): boolean {
  // Un compte négatif ou non fini ne peut venir que d'une lecture cassée : le doute ne déclenche RIEN.
  // Se tromper en invitant coûte à Sanela une phrase qu'elle n'attendait pas ; se tromper dans l'autre
  // sens ne coûte qu'une proposition de plus, qu'elle peut refuser. L'asymétrie penche vers le silence.
  if (!Number.isFinite(branchesEnNaissance)) return false;
  return branchesEnNaissance >= SEUIL_BRANCHES_OUVERTES;
}
