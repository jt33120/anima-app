/**
 * types.ts — Le modèle de VUE du fil de conversation (Story 2.2, B2). Éphémère en session : les
 * tours vivent dans l'état client (aucune table de conversation en 2.2 — la persistance est
 * l'Epic 4, AD-8). Ce n'est PAS du modèle de scène (lib/scene reste pur) : c'est une feature de
 * rendu (AD-7). Aucune règle de domaine ici — juste la forme d'un tour à l'écran.
 */

/** L'état d'un tour d'Anam : en cours de flux, terminé proprement, ou échec (coupure sans `fin`). */
export type EtatAnam = "flux" | "complet" | "echec";

/**
 * Une ressource d'aide telle que RENDUE dans le fil (Story 2.6). Type de VUE LOCAL : le rendu ne
 * connaît pas `lib/safety` (frontière AD-7/AD-10) — la donnée arrive par la trame serveur, déjà
 * sélectionnée et ordonnée. Le rendu ne fait que dessiner ; il ne décide rien.
 */
export interface RessourceVue {
  readonly numero: string;
  readonly tel: string;
  readonly aria: string;
  readonly service: string;
  readonly desc: string;
}

/**
 * Un tour du fil. Union discriminée par `role` : les mots de l'utilisatrice n'ont pas d'état
 * (ils sont posés, optimistes, jamais retirés — AC1) ; la voix d'Anam porte un état de flux ; le
 * bloc `ressources` (détresse niveaux 2-3, Story 2.6) porte les ressources + la date « Vérifié le … ».
 */
export type Tour =
  | { readonly id: string; readonly role: "utilisatrice"; readonly texte: string }
  | { readonly id: string; readonly role: "anam"; readonly texte: string; readonly etat: EtatAnam }
  | {
      readonly id: string;
      readonly role: "ressource";
      /** Id du tour d'Anam auquel ce bloc est rattaché → « Réessayer » purge les deux ensemble (jamais
       *  un bloc orphelin ni doublé — revue 2.6, R2). */
      readonly ancreId: string;
      readonly ressources: readonly RessourceVue[];
      readonly verifieLe: string;
    }
  /**
   * Le BILAN de clôture (Story 2.9). Bloc DOCUMENT : titre + points, DÉJÀ structuré par le serveur
   * (trame `bilan`) — le rendu ne parse aucun markdown, il dessine (AD-7). Registre document : titres
   * et listes autorisés, contrairement à la voix d'Anam (FR-084).
   */
  | {
      readonly id: string;
      readonly role: "bilan";
      /** Id du tour d'Anam qui a produit ce bilan → « Réessayer » purge les deux ensemble (jamais un
       *  bilan orphelin ni doublé au rejeu — même patron que le bloc `ressource`, revue 2.6/3.2). */
      readonly ancreId: string;
      readonly titre: string;
      readonly points: readonly string[];
    }
  /**
   * La carte d'abonnement (Story 3.2). Tour CLIENT présentationnel inséré SOUS le bilan (AC1). Ne
   * porte aucune donnée : prix et copie sont des constantes (`render/conversation/offre-abonnement`), la
   * décision (proposer ou non) est SERVEUR (trame `paywall` retenue en détresse/premium, AD-9). `ancreId`
   * = le tour d'Anam producteur → « Réessayer » purge la carte avec lui (jamais une carte orpheline).
   */
  | { readonly id: string; readonly role: "paywall"; readonly ancreId: string }
  /**
   * La proposition de branche « le lendemain » (Story 4.5). Tour CLIENT amorcé au MONTAGE depuis une prop
   * serveur (jamais un tour utilisatrice, jamais le pipeline `message`). `signalId` = le germe à consommer /
   * écarter ; `phrase` = la proposition déterministe d'Anam (générique, aucun art. 9). `etat` porte le petit
   * cycle local : proposée → (nomme | refuse) → nee. `nom` : une fois née, le nom DONNÉ PAR ELLE (rendu dans
   * SA police — jamais celle d'Anam : la prise de conscience est la sienne).
   */
  | {
      readonly id: string;
      readonly role: "proposition-branche";
      readonly signalId: string;
      readonly phrase: string;
      readonly etat: EtatProposition;
      readonly nom?: string;
    }
  /**
   * L'INVITATION À INTÉGRER (Story 4.10, FR-030/AC4). Tour CLIENT amorcé au MONTAGE, exactement comme la
   * proposition — parce que c'est la MÊME décision serveur, prise à l'autre embranchement du `if`.
   *
   * ⚠️ AUCUN CHAMP NUMÉRIQUE, ET C'EST L'AC5 [DUR]. Pas de compte, pas de « 3 », pas de liste : le serveur
   * a compté, il a choisi, et le nombre n'a pas franchi la frontière. Le rendu ne PEUT pas l'afficher.
   * `brancheCibleId` est un identifiant, pas un compte — c'est lui qui empêche l'invitation d'être un
   * reproche : elle mène quelque part.
   *
   * EN CONVERSATION, JAMAIS EN BANDEAU (AC4, littéralement) : c'est un tour du fil, comme tout ce
   * qu'Anam dit.
   */
  | {
      readonly id: string;
      readonly role: "invitation-integration";
      readonly phrase: string;
      readonly brancheCibleId: string;
    }
  /**
   * L'HYPOTHÈSE D'ENNÉAGRAMME (Story 5.5, AC2). Tour CLIENT amorcé au MONTAGE, comme la proposition
   * et l'invitation — même origine : une décision serveur, à un autre embranchement.
   *
   * ⚠️ AUCUN NUMÉRO. Pas de `type`, ni en nombre ni en chaîne : la phrase du fil ne le nomme pas, et
   * la halte le lit en base. Le poser ici en ferait une SECONDE source du même fait, et rendrait
   * l'assènement techniquement possible à un composant qui n'a aujourd'hui pas de quoi.
   */
  | {
      readonly id: string;
      readonly role: "hypothese-enneagramme";
      readonly phrase: string;
      readonly hypotheseId: string;
    }
  /**
   * LA CARTE DÉPOSÉE (Story 5.8, AC2). Tour du fil, comme tout ce qu'Anam pose.
   *
   * ⚠️ AUCUN CHAMP DE SIGNIFICATION, ET C'EST L'AC2 [DUR]. Pas de `sens`, pas de mot-clé, pas de nom
   * affichable — le catalogue de sens existe côté serveur et n'a AUCUNE représentation client avant
   * la réponse de l'utilisatrice (FR-018). Même garde que `invitation-integration`, où le COMPTE ne
   * franchit pas la frontière : ce que le rendu n'a pas, il ne peut pas l'afficher.
   *
   * `cle` désigne un fichier de visuel — elle ne s'affiche jamais (l'UX interdit de nommer la carte
   * devant celle qui la tire). `description` dit ce qui est DESSINÉ, pour le texte alternatif ;
   * `null` quand le visuel n'est pas encore dessiné, et le rendu dit alors l'absence.
   *
   * ⚠️ PAS D'`ancreId`, ET C'EST DÉLIBÉRÉ — c'est l'inverse exact du patron `ressource`/`bilan`/
   * `paywall`. Ceux-là se purgent avec le tour d'Anam au « Réessayer » ; la carte, jamais : « la
   * carte n'est pas retirée et n'est JAMAIS retirée » (UX, échec de UJ-3). Un nouveau tirage nierait
   * le rituel. Ne pas lui donner d'ancre est ce qui rend la purge impossible plutôt qu'interdite.
   */
  | {
      readonly id: string;
      readonly role: "carte";
      readonly cle: string;
      readonly description: string | null;
    }
  /**
   * LA LECTURE (Story 5.8, AC4/AC6). Bloc DOCUMENT, même registre que le bilan : elle reprend ses
   * mots en clair et échappe à la troncature à trois phrases de la voix (FR-084).
   *
   * `lectureId` la relie à « Mes lectures » — sans lui, la restitution consultable et le bloc du fil
   * seraient deux textes sans lien, et FR-021 demande précisément qu'ils n'en fassent qu'un.
   */
  | {
      readonly id: string;
      readonly role: "lecture";
      readonly lectureId: string;
      readonly texte: string;
    };

/** Le petit cycle local d'une proposition de branche dans le fil (Story 4.5). */
export type EtatProposition = "propose" | "nomme" | "refuse" | "nee";

/**
 * La prop serveur→client de l'OUVERTURE (Story 4.5, arbitrée en 4.10) — miroir de `Ouverture`
 * (`lib/domain/arbitrage-ouverture.ts`). Le rendu ne peut pas importer `lib/` (frontière AD-7) : ce type
 * est donc une copie volontaire, et une garde (`tests/arbitrage-frontiere.test.ts`) verrouille l'absence
 * de champ numérique dans les DEUX.
 *
 * Générique : aucun art. 9. Deux identifiants et une phrase constante, rien d'autre.
 */
export type OuvertureData =
  | { readonly type: "proposition"; readonly signalId: string; readonly phrase: string }
  | { readonly type: "invitation"; readonly phrase: string; readonly brancheCibleId: string }
  /** Story 5.3 (AC4) — la mention UNIQUE de la complétion du socle. Une phrase, rien d'autre :
   *  rien à ouvrir, rien à répondre, rien à consommer. */
  | { readonly type: "socle-complete"; readonly phrase: string }
  /** Story 5.5 (AC2) — Anam a une hypothèse de type. Une phrase qui ne nomme AUCUN numéro, et
   *  l'identifiant de la ligne : le rendu n'a pas de quoi asséner quoi que ce soit. */
  | { readonly type: "hypothese-enneagramme"; readonly phrase: string; readonly hypotheseId: string };
