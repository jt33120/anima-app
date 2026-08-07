/**
 * projection.ts — La DOMAIN-PROJECTION serveur, en LECTURE SEULE (SPINE L155 + AD-7 :
 * « lib/scene/ projette l'état max »). Story 1.7, élargie en 4.6 (l'arbre réel).
 *
 * Le rendu ne l'ÉCRIT JAMAIS : il la reçoit en props et la dessine (muet). La monotonie de
 * l'arbre (les branches ne régressent pas — AD-8/FR-029) est gardée à l'ÉCRITURE par le SQL
 * (Story 4.7), jamais par le rendu. 4.6 ajoute UNE défense au rendu : `reconcilierProjection`
 * conserve l'état supérieur déjà connu si une projection ultérieure régresse (AC2 [DUR défensif]).
 *
 * PURETÉ (garde scene-architecture) : ce module n'importe RIEN (données pures, testables sans
 * navigateur) et ne nomme jamais un champ `message` (le concept de conversation ne fuit pas ici).
 */

/** Miroir LITTÉRAL du CHECK SQL `branche.etat` (0025). Le troisième état s'appelle « rayonnement »
 *  partout — en base, dans le modèle et à l'écran : le produit a banni la métaphore du fruit (DESIGN
 *  L586/L601), et une traduction à l'affichage aurait obligé chaque lecteur du SQL à connaître le décalage. */
export type EtatBranche = "naissance" | "feuillaison" | "rayonnement";

/** Une branche projetée : ce que le rendu doit dessiner et rendre adressable (le point d'accroche). */
export interface BrancheProjetee {
  readonly id: string;
  readonly etat: EtatBranche;
  /** Feuillaison progressive 0→1 (câblée 4.7). En 4.6, l'état persisté tel quel. */
  readonly intensite: number;
  /** Le message EXACT dont la branche est née (FR-027) — cible de « Voir dans la conversation ». */
  readonly extraitSourceId: string;
  /** Nom donné par elle (art. 9). Optionnel dans le type : jamais requis par le rendu géométrique. */
  readonly nom?: string;
  /** Date de naissance (ISO) — pour la fiche (« datée », FR-027). */
  readonly dateNaissance?: string;
  /** Story 4.7 (AC5) — quand la feuillaison s'est amorcée. Absente si la branche n'a jamais feuillu
   *  (le saut direct naissance → rayonnement est légal : la fiche ne doit pas prétendre le contraire). */
  readonly dateFeuillaison?: string;
  /** Story 4.7 (AC5) — depuis quand elle est en pleine lumière. La fiche dit ce qui a changé ET QUAND. */
  readonly dateRayonnement?: string;
  /** Verbatim de l'extrait source (art. 9) — la fiche le rend « comme un tour d'utilisatrice » (FR-027). */
  readonly extraitContenu?: string;
  /** Position déterministe du point d'accroche sur le canevas. En 4.6 le rendu la calcule ; optionnelle ici. */
  readonly accroche?: { readonly x: number; readonly y: number };
}

export interface ProjectionScene {
  readonly tronc: { readonly present: true };
  /** Les branches projetées (état persisté). Vide = arbre sans branche (« rien n'a encore été nommé »). */
  readonly branches: readonly BrancheProjetee[];
  /**
   * Vrai UNIQUEMENT quand la lecture serveur a échoué (repli sûr). Distingue « elle n'a pas encore de
   * branche » (vide légitime) de « je n'arrive pas à lire son arbre » (panne) — sans cette distinction, une
   * panne réseau affichait « Rien n'a encore été nommé » à quelqu'un qui a des branches, ce qui est un
   * MENSONGE et la pire régression possible au sens de FR-029 (revue 4.6, HAUTE).
   */
  readonly indisponible?: true;
  /**
   * Vrai pendant un épisode de détresse et les 72 h qui suivent (AD-17/FR-046, décision D3).
   *
   * ⚠️ REVUE — sans ce drapeau, la fiche offrait le geste irréversible, faisait lire la confirmation
   * solennelle (« elle y restera »), puis le point d'écriture refusait. Sanela venait de traverser une
   * crise ; l'app lui faisait vivre un refus juste après lui avoir demandé de s'engager. La garde
   * d'écriture était correcte, l'interface mentait par omission.
   *
   * On MASQUE le geste, sans l'expliquer : dire « tu sors d'un épisode » reviendrait à lui annoncer que
   * le système l'a classée, ce qu'aucune spec n'autorise. Le silence est ici le choix le plus doux.
   * Décidé dans `lib/scene` (AD-7) — le rendu constate, il ne déduit pas.
   */
  readonly gestesSuspendus?: true;
  /**
   * Story 4.10 (AC6 / FR-081) — le PLAN D'ÉTAPES est-il ouvert à l'écriture ?
   *
   * Vrai seulement si l'abonnement est actif ET qu'aucun geste n'est suspendu. Décidé dans `lib/scene`
   * (AD-7) : le rendu constate, il ne déduit pas — et surtout il ne relit pas l'entitlement lui-même.
   *
   * ⚠️ CE DRAPEAU N'EST PAS LA GARDE. La garde vit dans le `WITH CHECK` des policies (migration 0036) :
   * `authenticated` a le grant INSERT table-level, donc un gate d'interface seul est décoratif. Celui-ci
   * ne sert qu'à ne pas MENTIR PAR OMISSION — proposer un champ, la laisser écrire deux phrases sur sa
   * vie intérieure, puis refuser à l'enregistrement, c'est la faute exacte que la revue 4.7 a trouvée
   * sur le geste de rayonnement.
   *
   * Absent ≠ « son plan disparaît » : la LECTURE reste ouverte (voir `intention_lecture`, 0036). Un
   * paywall qui séquestre ce qui est déjà écrit n'est pas un paywall.
   *
   * ── Story 3.3 : CE DRAPEAU PORTE MAINTENANT DEUX GESTES, ET C'EST DÉLIBÉRÉ ─────────────────────────
   *
   * Depuis 0037, la NAISSANCE d'une branche est gardée par exactement le même prédicat que l'écriture
   * d'une intention : abonnement actif ET hors fenêtre de détresse. Ajouter un second champ
   * `naissanceOuverte` aurait fabriqué un MIROIR — deux valeurs toujours égales, jusqu'au jour où l'une
   * dérive sans l'autre. C'est la faute R1-bis, celle qui a coûté un test d'équivalence à
   * `render/intention.ts`. Un seul champ, donc.
   *
   * ⚠️ SI UN JOUR LES DEUX GESTES DIVERGENT (par exemple : écrire une intention redevient possible
   * pendant un épisode, alors qu'une branche ne peut toujours pas naître), il faudra SÉPARER les deux
   * drapeaux le jour même — pas continuer à en partager un qui ne dit plus la vérité pour l'un des deux.
   */
  readonly planOuvert?: true;
}

/**
 * Story 3.3 (AC6, décision D3-A) — faut-il dire OÙ naissent les branches ?
 *
 * La décision vit ICI, dans le modèle, pas dans le rendu (AD-7 : le rendu constate, il ne déduit pas).
 * Fonction PURE : quatre conditions, toutes nécessaires.
 *
 *   • l'arbre est VIDE — dès qu'une branche existe, la phrase n'a plus rien à expliquer et disparaît
 *     d'elle-même. C'est ça, « une seule fois » (D3-A) : elle n'APPARAÎT jamais, elle EST là ;
 *   • la lecture a RÉUSSI — sur une panne, l'écran dit « je n'arrive pas à afficher ton arbre » ; y
 *     ajouter une explication commerciale serait répondre à côté, et à quelqu'un qu'on fait déjà patienter ;
 *   • le compte est GRATUIT (`planOuvert` absent) — sinon on expliquerait à une abonnée ce qu'elle a déjà ;
 *   • AUCUN geste n'est suspendu — AD-9 [DUR] : rien de commercial ne se monte pendant un épisode de
 *     détresse ni dans les 72 h. Cette condition n'est PAS redondante avec la précédente : un compte
 *     PREMIUM en détresse a lui aussi `planOuvert` absent, et il ne doit rien voir non plus.
 */
export function doitDireOuNaissentLesBranches(p: ProjectionScene): boolean {
  return (
    p.branches.length === 0 && p.indisponible !== true && p.planOuvert !== true && p.gestesSuspendus !== true
  );
}

/** STUB de départ : tronc présent, aucune branche. Gelé (lecture seule réelle, pas seulement au type). */
export const projectionInitiale: ProjectionScene = Object.freeze({
  tronc: Object.freeze({ present: true as const }),
  branches: Object.freeze([] as BrancheProjetee[]),
});

/**
 * Ordre monotone des états — la SOURCE UNIQUE. `lib/domain/cycle-branche.ts` l'importe d'ici plutôt que
 * d'en garder une seconde copie : deux définitions de l'ordre qui divergeraient, c'est la faute R1-bis
 * appliquée au TypeScript, et celle-ci décide dans quel sens l'arbre a le droit d'aller (FR-029).
 */
export const ORDRE_ETAT: Record<EtatBranche, number> = { naissance: 0, feuillaison: 1, rayonnement: 2 };

/**
 * Normalise une intensité : hors [0,1] ou non finie (NaN/±Infinity) → repli sûr. Sans ça, `NaN > x` étant
 * faux DANS LES DEUX SENS, un NaN traversait la garde sans incident, la désarmait durablement (il finissait
 * dans le repère du max) et faisait disparaître le feuillage au rendu (revue 4.6). La base borne aussi la
 * colonne (0023), mais cette normalisation couvre EN PLUS le repère local, que la base ne voit pas.
 */
export function intensiteBornee(v: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}

/**
 * Faut-il ADOPTER la projection qui arrive, ou garder celle qu'on affiche déjà ?
 *
 * Règle : une lecture INDISPONIBLE n'efface JAMAIS un arbre déjà affiché. Le rafraîchissement serveur
 * (déclenché à chaque entrée dans la région arbre) peut échouer pour une raison passagère ; adopter son
 * repli remplacerait des branches RÉELLES par « je n'arrive pas à afficher ton arbre » — c'est-à-dire faire
 * disparaître l'arbre sous les yeux de l'utilisatrice à cause d'un hoquet réseau (re-revue). Tant qu'on a
 * quelque chose de vrai à montrer, on le montre ; l'écran d'indisponibilité est pour quand on n'a RIEN.
 *
 * Cette décision vit ICI et pas dans le rendu : le rendu dessine, il ne tranche pas (AD-7).
 */
export function adopterProjection(affichee: ProjectionScene, arrivee: ProjectionScene): ProjectionScene {
  if (arrivee.indisponible && affichee.branches.length > 0 && !affichee.indisponible) return affichee;
  return arrivee;
}

/** Une régression détectée au rendu — ne porte QUE l'id + le champ, JAMAIS le nom art. 9 (NFR-022). */
export interface IncidentRegression {
  readonly id: string;
  /** `disparition` = une branche connue n'est plus servie : la régression la plus grave (FR-029). */
  readonly champ: "etat" | "intensite" | "disparition";
}

/**
 * Défense anti-régression au rendu (AC2 [DUR défensif]) — fonction PURE, sans effet de bord.
 * Pour chaque branche de `nouvelle` dont l'état/intensité est INFÉRIEUR à ce que `precedente`
 * connaissait, on CONSERVE le supérieur et on liste l'incident (que l'appelant SERVEUR journalisera —
 * le rendu ne peut pas logguer). La monotonie d'ÉCRITURE reste garantie par le SQL (Story 4.7) ;
 * ceci n'est qu'un filet côté client, testable sans navigateur.
 */
export function reconcilierProjection(
  precedente: ProjectionScene,
  nouvelle: ProjectionScene,
): { projection: ProjectionScene; incidents: readonly IncidentRegression[] } {
  // Une lecture INDISPONIBLE n'est pas une régression : c'est une absence d'information. On la propage
  // telle quelle (le rendu dira « je n'arrive pas à afficher ton arbre », jamais « rien n'a été nommé »)
  // et SURTOUT on ne conclut rien — sinon la panne se lirait comme un effacement de toutes les branches.
  if (nouvelle.indisponible) return { projection: nouvelle, incidents: [] };

  const parId = new Map(precedente.branches.map((b) => [b.id, b]));
  const incidents: IncidentRegression[] = [];

  const branches = nouvelle.branches.map((b) => {
    const intensiteRecue = intensiteBornee(b.intensite);
    const avant = parId.get(b.id);
    if (!avant) return intensiteRecue === b.intensite ? b : { ...b, intensite: intensiteRecue };

    let etat = b.etat;
    let intensite = intensiteRecue;
    if (ORDRE_ETAT[avant.etat] > ORDRE_ETAT[b.etat]) {
      etat = avant.etat;
      incidents.push({ id: b.id, champ: "etat" });
    }
    // Une valeur non finie EST un incident (elle ne peut plus passer en silence), et le repère l'emporte.
    const intensiteAvant = intensiteBornee(avant.intensite);
    if (!Number.isFinite(b.intensite) || intensiteAvant > intensiteRecue) {
      intensite = intensiteAvant;
      incidents.push({ id: b.id, champ: "intensite" });
    }
    return etat === b.etat && intensite === b.intensite ? b : { ...b, etat, intensite };
  });

  // DISPARITION (revue 4.6, HAUTE) : une branche connue qui n'est plus servie est la régression la plus
  // grave — l'arbre s'efface. On ne la RÉINJECTE pas depuis le client (le repère local ne porte ni le nom
  // ni l'extrait, et fabriquer de la donnée de domaine au rendu serait pire), mais on la SIGNALE, pour que
  // l'appelant serveur journalise au lieu de laisser l'effacement passer inaperçu.
  const servies = new Set(nouvelle.branches.map((b) => b.id));
  for (const id of parId.keys()) {
    if (!servies.has(id)) incidents.push({ id, champ: "disparition" });
  }

  return { projection: { tronc: nouvelle.tronc, branches }, incidents };
}
