/**
 * ordonnanceur-budget.ts — LE BUDGET DE L'ORDONNANCEUR UNIQUE (Story 6.1, AC1/AC3 · AD-1).
 *
 * ── POURQUOI CE FICHIER EXISTE ─────────────────────────────────────────────────────────────────
 *
 * Jusqu'à la 6.1, la garde du budget comparait `Σ delaiMs` à `maxDuration`, c'est-à-dire à **un
 * nombre écrit dans le fichier d'à côté par le développeur qui venait d'ajouter un job**. Une garde
 * qui mesure une décision contre elle-même est une garde décorative : elle rougit quand on oublie de
 * mentir, elle se tait quand on ment bien.
 *
 * Ce module apporte le terme que le dépôt ne choisit pas — **le plafond du palier**. La chaîne
 * devient :
 *
 *     Σ delaiMs + margeHorsDelais(n)  ≤  BUDGET_TICK_MS  ≤  PLAFOND_DUREE_MS[PALIER]
 *     └──────── ce qu'on promet ────┘     └ ce qu'on ┘     └── ce que la plateforme accorde ──┘
 *                                          s'accorde
 *
 * Les deux premiers termes nous appartiennent ; le troisième est un fait extérieur. C'est lui qui
 * empêche « je monte le plafond et je ne touche à rien » d'être vert.
 *
 * ── LA RÈGLE QUI GOUVERNE TOUT L'EPIC 6 ────────────────────────────────────────────────────────
 *
 * **Le budget se lève AU MOMENT où un job entre, jamais en prévision.** Chaque story qui ajoute un
 * job monte `BUDGET_TICK_MS` **et** le littéral `maxDuration` de `app/api/ordonnanceur/route.ts`
 * **dans le même commit**.
 *
 * Acheter du plafond « pour être tranquille » reconstruirait exactement le mou dans lequel la garde
 * cesse de mordre : à `BUDGET_TICK_MS = 300_000`, l'inégalité de gauche serait vraie pour toute
 * valeur du registre, donc verte pour toujours. On aurait supprimé la mesure en croyant régler le
 * problème.
 *
 * ── LES VALEURS, ET POURQUOI ELLES REPRODUISENT EXACTEMENT L'EXISTANT ───────────────────────────
 *
 * `margeHorsDelais(3)` vaut 8 000 — la constante plate qu'on remplace. `Σ + marge` vaut 58 000, et
 * `BUDGET_TICK_MS` reste 60 000. **Ce n'est pas une coïncidence heureuse, c'est le critère de
 * conception** : une story de mesure qui déplacerait une valeur au passage rendrait impossible de
 * distinguer « la mesure est meilleure » de « le système a changé ».
 *
 * ── AD-1 : DOMAINE PUR ─────────────────────────────────────────────────────────────────────────
 *
 * Aucun `process.env` — voir le commentaire de `PALIER`. Aucun `server-only`, aucune I/O, aucun
 * import de couche supérieure. Ce module se relit à l'identique dans un test, en CI et en
 * production.
 */

export type Palier = "hobby" | "pro";

/**
 * LE PALIER D'HÉBERGEMENT, écrit en toutes lettres.
 *
 * ⚠️ **Jamais `process.env`.** Une variable d'environnement ferait vérifier à la CI le plafond
 * `hobby` pendant que la production tourne sur un autre — et l'inverse le jour où quelqu'un la pose
 * en CI « pour que ça passe ». Un palier est une décision commerciale : elle se lit dans un diff.
 *
 * ⚠️ **Et jamais dans un second fichier de configuration.** Deux endroits pouvant déclarer le
 * budget, la CI n'en lirait qu'un — celui qui gagne en production ne serait pas celui qu'on mesure.
 * C'est la même faute que la clé `functions` de `vercel.json`, gardée dans
 * `tests/ordonnanceur-architecture.test.ts`.
 *
 * Le changer est un acte de commit, et il fait rougir la couture du littéral `maxDuration` tant que
 * la route n'a pas suivi.
 *
 * @see _bmad-output/implementation-artifacts/PORTES-AVANT-PUBLICATION.md §2 — la porte
 *      d'hébergement. Le plan Hobby interdit par ailleurs l'usage commercial ; ce palier n'est pas
 *      celui du jour du lancement.
 */
export const PALIER: Palier = "hobby";

/**
 * La durée maximale d'une fonction, par palier — **fait de plateforme, pas décision du dépôt**.
 *
 * Source : `vercel.com/docs/functions/configuring-functions/duration`, **lue le 14/08/2026**
 * (fluid compute actif, et le projet l'a). Hobby : 300 s par défaut ET au maximum. Pro : 300 s par
 * défaut, 800 s au maximum.
 *
 * ⚠️ **C'est la seule chose ici qu'aucune garde ne peut vérifier** — d'où la date. Si le tableau
 * change chez Vercel, rien dans cette CI ne le dira ; il faut relire la source.
 *
 * ⚠️ Le plafond de 60 s qu'a longtemps cru le dépôt n'a **jamais** été celui de la plateforme : il
 * venait de notre propre `app/api/ordonnanceur/route.ts`.
 */
export const PLAFOND_DUREE_MS: Readonly<Record<Palier, number>> = Object.freeze({
  hobby: 300_000,
  pro: 800_000,
});

/**
 * Le nombre maximal de déclenchements par jour, par palier.
 *
 * Source : `vercel.com/docs/cron-jobs/usage-and-pricing`, **lue le 14/08/2026**. Hobby : **une fois
 * par jour**, et *« cron expressions that would run more frequently will fail during deployment »*
 * — ce n'est pas une dégradation silencieuse, c'est un refus de déploiement. Pro : à la minute.
 *
 * La précision suit le palier : ±59 min sur `hobby`, à la minute sur `pro`. C'est ce qui justifie
 * `toleranceHeures: 60` au registre, et cette justification **survit** au changement de palier :
 * aucun ordonnanceur externe ne garantit la minute.
 */
export const TICKS_MAX_PAR_JOUR: Readonly<Record<Palier, number>> = Object.freeze({
  hobby: 1,
  pro: 1_440,
});

/**
 * LA DÉRIVE DE PLANIFICATION ANNONCÉE, par palier (Story 6.1a).
 *
 * Même source, même date : sur `hobby`, un cron est déclenché *« within the hour »* — donc jusqu'à
 * **59 minutes** après l'heure demandée ; sur `pro`, à la minute.
 *
 * ⚠️ **Ce n'est pas la même chose qu'un tick manqué**, et confondre les deux est précisément ce qui a
 * fait poser la fenêtre d'homme mort à 48 h — c'est-à-dire à *exactement* deux fois la cadence.
 * L'homme mort compare un âge à un seuil : à 48 h, deux ticks nominaux plus quelques minutes de dérive
 * suffisent à le franchir. La même panne alertait donc, ou non, selon l'horaire du jour.
 *
 * Ce nombre existe pour que la garde puisse l'écrire : `2 × intervalle + dérive ≤ fenêtre`. Il n'a
 * aucun usage à l'exécution, et c'est normal — il mesure la plateforme, pas le produit.
 */
export const DERIVE_PLANIFICATION_MS: Readonly<Record<Palier, number>> = Object.freeze({
  hobby: 59 * 60_000,
  pro: 60_000,
});

/**
 * Le coût provisionné d'un aller-retour vers Supabase.
 *
 * Un aller-retour depuis une lambda se compte en **dizaines** de millisecondes. 800 ms est le **pire
 * cas qu'on accepte de provisionner** sur une base chargée. Ce n'est pas une mesure, c'est un
 * budget : le rôle de ce nombre est d'être trop grand, jamais trop juste.
 */
export const COUT_ALLER_RETOUR_MS = 800;

/** Le coût hors boucle : un seul appel, `verifierEnvironnement` (`lib/ordonnanceur/executer.ts:40`). */
export const COUT_FIXE_MS = COUT_ALLER_RETOUR_MS;

/**
 * Le coût par job, **au pire cas** : `reclamer` + `clore(false)` + `leverIncident`.
 *
 * Le chemin nominal n'en fait que deux (`reclamer` + `clore(true)`). On provisionne le mauvais
 * chemin, parce que c'est celui où le temps manque déjà.
 */
export const COUT_PAR_JOB_MS = 3 * COUT_ALLER_RETOUR_MS;

/**
 * La marge qui couvre tout ce qui vit **hors** des `avecDelai` : la vérification d'environnement,
 * les `reclamer` / `clore` / `leverIncident` de chaque job, la sérialisation de la réponse.
 *
 * ⚠️ **Elle GRANDIT avec le nombre de jobs.** C'est tout l'intérêt d'en faire une fonction : la
 * constante plate de 8 000 ms qu'elle remplace était juste à trois jobs et devenait un mensonge à
 * six, en restant verte. `margeHorsDelais(3) === 8_000` — la valeur d'hier, retrouvée et non
 * postulée.
 *
 * ⚠️ **Ne JAMAIS l'élargir pour faire entrer un job.** Elle est bornée des deux côtés : par le bas
 * dans le test de calibrage `[MÉTA]` (qui compte mécaniquement les appels du répartiteur), par le
 * haut dans la chaîne `Σ + marge ≤ BUDGET_TICK_MS`. Les deux gardes poussent en sens inverse — c'est
 * ce qui les rend non-redondantes, et ce qui rend impossible de satisfaire l'une en trichant sur
 * l'autre.
 */
export function margeHorsDelais(nombreDeJobs: number): number {
  return COUT_FIXE_MS + nombreDeJobs * COUT_PAR_JOB_MS;
}

/**
 * Le budget d'un tick — **ce qu'on s'accorde**, à distinguer de ce que la plateforme autorise.
 *
 * `app/api/ordonnanceur/route.ts` doit porter `Math.ceil(BUDGET_TICK_MS / 1000)` **en littéral**
 * (Next exige une valeur statiquement analysable ; une expression importée est ignorée en silence et
 * la plateforme retombe sur son défaut). Deux assertions distinctes gardent cette couture, et aucune
 * ne remplace l'autre.
 */
export const BUDGET_TICK_MS = 74_000;

/**
 * Le mou toléré entre ce que le registre promet et ce qu'on s'accorde.
 *
 * ⚠️ **C'est une borne HAUTE, et c'est contre-intuitif.** Sans elle, desserrer le budget satisfait
 * toujours *mieux* l'inégalité `Σ + marge ≤ BUDGET_TICK_MS` : le mutant « je monte à 300 000 et je ne
 * touche à rien » serait vert par construction. Cette borne dit que le budget doit rester **serré**
 * autour du registre — donc qu'on ne peut pas acheter du plafond sans job pour le justifier.
 *
 * 2 000 ms = 60 000 − 58 000, le mou réel du jour où cette borne a été posée (6.1). À quatre jobs
 * (Story 6.2) le mou vaut 74 000 − 72 400 = 1 600 : la borne n'a pas eu à bouger, et c'est le signe
 * qu'elle mesure la bonne chose — un registre qui grandit ne desserre pas sa propre garde.
 */
export const RESERVE_DECLAREE_MS = 2_000;
