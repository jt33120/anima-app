---
baseline_commit: a227d87bf72bc2e9e14d1d6f9f80b305ae787664
---

# Story 6.1 : La mesure de l'ordonnanceur — rendre les gardes capables de mordre

Status: review

## Story

En tant qu'équipe Anam responsable de la fiabilité et de la conformité,
je veux que le budget de l'ordonnanceur unique soit **mesuré contre une décision du produit** plutôt
que contre un nombre auto-déclaré, et que chacune de ses gardes **morde encore** quand l'Epic 6 y
logera trois jobs de plus,
afin qu'aucun rythme ni aucune rétention ne puisse mourir en silence sous une CI verte.

---

## ⚠️ Lis ceci avant tout

### Cette story ne construit aucun rythme, ne touche aucune base, et ne change AUCUNE valeur

L'ordonnanceur **existe** (4.8), éprouvé par les 4.9 et 4.10. Cette story **ne recrée rien, n'ajoute
aucun job, n'écrit aucune migration, et ne modifie aucun comportement en production.**

**Le seul livrable est la mesure.** À la fin, `Σ delaiMs` vaut toujours 50 000 ms, la marge toujours
8 000 ms, `maxDuration` toujours 60. Ce qui change, c'est ce que les gardes *signifient*.

> **Critère de relecture, à s'appliquer à soi-même :
> si un test devient vert PLUS FACILEMENT après ton passage, tu t'es trompé.**

### Le fait déclencheur, et il corrige une croyance du dépôt

Le plafond de 60 secondes **n'a jamais été celui de la plateforme**. Vérifié à la source le
14/08/2026 :

| Palier | Durée par défaut | Durée maximale | Crons/projet | Intervalle minimal | Précision |
|---|---|---|---|---|---|
| **hobby** | 300 s | **300 s** | 100 | **une fois par jour** | ±59 min |
| **pro** | 300 s | **800 s** | 100 | une fois par minute | à la minute |

*(`vercel.com/docs/functions/configuring-functions/duration` et `/docs/cron-jobs/usage-and-pricing`,
lus le 14/08/2026 ; fluid compute activé par défaut, et le projet l'a.)*

Les 60 s viennent de `app/api/ordonnanceur/route.ts:15` — **une ligne écrite par ce projet.** Le
dépôt le savait à demi-mot (4.10 : « dépend du palier Vercel, c'est une porte OPS » ;
`deferred-work.md:242` : « à ajuster au tier Vercel réel »). Le budget de l'Epic 6 n'est donc pas un
problème de plateforme, **c'est un problème de mesure.**

### Le piège qui EST le sujet

Monter `maxDuration` à 300 et s'arrêter là serait la pire issue. `[T3-3]`
(`Σ + marge ≤ maxDuration`) deviendrait `58 000 ≤ 300 000` : **vraie pour toute valeur, donc verte
pour toujours.** On aurait supprimé la mesure en croyant régler le problème — exactement ce que
`registre.ts:34-37` interdit à propos de la marge.

Et l'auto-certification est totale : la garde compare le registre à un nombre que le développeur vient
d'écrire dans le fichier d'à côté. **La seule chose qu'elle ne peut pas vérifier, c'est ce nombre-là.**

D'où la règle qui gouverne tout l'Epic 6 :

> **Le budget se lève AU MOMENT où un job entre, jamais en prévision.** Chaque story qui ajoute un job
> monte `BUDGET_TICK_MS` **et** le littéral `maxDuration` **dans le même commit**. Acheter du plafond
> devient un acte tracé, justifié par un job qui existe.

### Correction d'une idée fausse sur le multi-tick

Il a été dit en cadrage que plusieurs ticks par jour feraient passer l'invariant de `Σ delaiMs` à
`max(delaiMs)`, faisant entrer les jobs de l'Epic 6 sans effort. **C'est faux.**

`executer.ts:59` itère **tout le registre à chaque tick**, et `fenetreDe("quotidien", …)` rend la même
clé civile toute la journée (`lib/domain/ordonnanceur.ts:91-96`). Au tick 2 la réclamation refuse
(`0027:157-160` : une ligne `reussi` n'est jamais re-réclamable), `executer.ts:70-73` pousse
`deja_fait` et `continue` — **`job.executer` n'est jamais appelé.**

> **Le multi-tick est un mécanisme de REPRISE SUR ÉCHEC, pas un mécanisme de débit.** `Σ` reste
> l'invariant.

⚠️ **Et sur le palier actuel, le multi-tick est purement interdit** : Hobby plafonne à un cron par
jour, et *« Cron expressions that would run more frequently will fail during deployment »*. Servir la
notification « à 8 h locales » de la 6.2 exigera donc **deux choses distinctes** : le palier `pro`
(porte `PORTES-AVANT-PUBLICATION.md` §2), **et** un job qui forge lui-même une clé de fenêtre plus
fine — ce que la signature `reclamer(job, fenetre: string, …)` autorise déjà (patron `synthese.ts:176`).
La 6.1 rend le second **possible et prouvé** ; elle ne fait ni l'un ni l'autre.

### Ce que la story ne fait PAS, et où c'est parti

| Sorti vers | Quoi | Pourquoi |
|---|---|---|
| **Story 6.1a** | Jeton de propriété sur `clore_execution` (T6-19), fenêtre d'homme mort 48 h → 60 h, boucle de fermeture de l'alarme, idempotence prouvée sur un **effet compté** | Toute la SQL, une seule migration (`0052`), un seul thème. Mélangée ici, elle rendait la story impossible à vérifier entre deux tâches. |
| **Story 6.2** | Assouplir `crons.toHaveLength(1)` | On ne relâche pas un verrou pour un besoin qui n'arrive pas dans cette story — et sur `hobby` le second tick est refusé au déploiement. |
| `deferred-work.md` | Seuil du disjoncteur écrit deux fois, resélection du rappel, ordre du registre entre invocations | Ne mordent que sous multi-tick avec clé fine. À relire **avant** la 6.2. |

---

## Décisions — les valeurs, et pourquoi elles tombent juste

⚠️ **Toutes ces valeurs reproduisent EXACTEMENT le comportement d'aujourd'hui.** Ce n'est pas une
coïncidence heureuse : c'est le critère de conception. Une story de mesure qui déplacerait une valeur
au passage rendrait impossible de distinguer « la mesure est meilleure » de « le système a changé ».

| Constante | Valeur | D'où elle sort |
|---|---|---|
| `PALIER` | `"hobby"` | Littéral **dans le module de budget**. Ni `process.env` (absent en CI), ni un second fichier. Le changer est un acte de commit. |
| `PLAFOND_DUREE_MS` | `{ hobby: 300_000, pro: 800_000 }` | Doc Vercel lue le 14/08/2026. Commentaire daté obligatoire. |
| `TICKS_MAX_PAR_JOUR` | `{ hobby: 1, pro: 1440 }` | Idem. |
| `COUT_ALLER_RETOUR_MS` | `800` | Un aller-retour Supabase se compte en dizaines de ms ; 800 est le **pire cas qu'on accepte de provisionner** sur une base chargée. C'est un budget, pas une mesure. |
| `COUT_FIXE_MS` | `= COUT_ALLER_RETOUR_MS` (800) | Un seul appel hors boucle : `verifierEnvironnement` (`executer.ts:40`). |
| `COUT_PAR_JOB_MS` | `= 3 × COUT_ALLER_RETOUR_MS` (2 400) | **Pire cas** par job : `reclamer` (`:69`) + `clore(false)` (`:93`) + `leverIncident` (`:94`). Le chemin nominal n'en fait que deux ; on provisionne le mauvais. |
| `margeHorsDelais(n)` | `COUT_FIXE_MS + n × COUT_PAR_JOB_MS` | `margeHorsDelais(3)` = **8 000** — la valeur plate d'aujourd'hui, retrouvée et non postulée. |
| `BUDGET_TICK_MS` | `60_000` | Inchangé. `Σ + marge(3)` = 58 000 ≤ 60 000. |
| `RESERVE_DECLAREE_MS` | `2_000` | Le mou réel d'aujourd'hui : 60 000 − 58 000. |
| `COUT_ETAT_MS` | `1_200` | Vit **avec le job de santé** (`lib/ordonnanceur/jobs/sante.ts`), pas dans le module de budget : c'est son coût à lui. Plancher = 1 200 + 1 200 × 4 = **6 000** — le `delaiMs` d'aujourd'hui, exactement. |

**Vérification de faisabilité (l'assertion qui prouve que la story sert à quelque chose).** À six jobs
— fin de l'Epic 6 — `margeHorsDelais(6)` = 15 200 et le plancher du job de santé passe à
`1 200 + 1 200 × 7` = 9 600. Même en provisionnant 10 s par job neuf, on obtient
`Σ ≈ 83 600 + 15 200 = 98 800 ms`, **soit un tiers du plafond `hobby` (300 000).** Le registre de
l'Epic 6 rentre, et on le sait **avant** d'écrire la 6.2.

⚠️ **Corollaire à ne pas manquer : le plancher du job de santé rougira au premier job ajouté** (6 000
< 9 600 dès quatre jobs). C'est voulu — c'est la garde qui fait son travail. La story qui ajoutera ce
job devra monter `sante.delaiMs`, donc `Σ`, donc `BUDGET_TICK_MS`, dans le même commit.

---

## Acceptance Criteria

1. **La chaîne à trois termes.** `Σ delaiMs + margeHorsDelais(n) ≤ BUDGET_TICK_MS ≤ PLAFOND_DUREE_MS[PALIER]`,
   vérifiée en CI. `PALIER` est un littéral versionné dans le dépôt, jamais `process.env`, jamais un
   second module.
2. **Le mou est borné des deux côtés.** `BUDGET_TICK_MS − (Σ + marge) ≤ RESERVE_DECLAREE_MS`. Sans
   cette borne haute, desserrer le plafond satisfait toujours *mieux* l'inégalité : le mutant « je
   monte à 300 et je ne touche à rien » est vert par construction.
3. **La couture du littéral.** Deux assertions distinctes, dont **aucune ne remplace l'autre** :
   (a) `app/api/ordonnanceur/route.ts` porte un **littéral numérique** — Next exige une valeur
   statiquement analysable, une expression importée est **ignorée en silence** et la plateforme
   retombe sur son défaut ; (b) ce littéral **égale** `Math.ceil(BUDGET_TICK_MS / 1000)`. La première
   prouve que la plateforme reçoit une valeur, la seconde que c'est celle qu'on a décidée.
4. **La marge est une fonction pure, testée COMME fonction**, indépendamment de l'inégalité :
   `margeHorsDelais(0) > 0`, `margeHorsDelais(3) >= 8_000` (pas de régression sous la valeur déjà
   jugée juste), `margeHorsDelais(n+1) − margeHorsDelais(n) === COUT_PAR_JOB_MS` pour au moins deux
   `n`. ⚠️ **Toute formule calibrée à rebours passe l'inégalité** — y compris `0`, y compris
   `1_000 × n` qui *desserre* la garde de 5 s à trois jobs tout en ayant l'air de la renforcer.
5. **Chaque job déclare son plancher, et aucun n'y échappe.** La garde **itère** sur `REGISTRE` et
   assère `job.delaiMs >= job.reserveMs` pour tous, avec anti-vacuité
   `couverts.length === REGISTRE.length` : un job ajouté sans plancher rend le test **rouge**.
6. **Le budget du job de santé grandit avec le registre**, et son abandon cesse d'être silencieux.
7. **Le schedule du cron est vérifié sur sa VALEUR**, pas seulement sur sa forme, et le nombre de
   ticks est borné par le palier.
8. **Aucune garde ne vise une définition SQL morte.** La couture registre ↔ SQL vise la définition
   **courante** (plus haut numéro de migration), jamais un numéro de fichier figé.
9. **La trace existe sur les chemins silencieux du répartiteur**, et l'absence d'art. 9 y est
   structurelle et non une politesse d'appelant (AC2 de l'epic, moitié « trace »).
10. **Les appels de dépôt sont bornés.** Une marge, même fonction de `n`, ne protège de rien contre un
    appel qui **pend** — et la panne la plus banale d'une base n'est pas l'erreur, c'est le silence.
11. **La surface des gardes de non-existence couvre ce que l'Epic 6 va poser** (AC1/AC3 de l'epic).

---

## Tasks / Subtasks

- [x] **T1 — Le module de budget** (AC: 1, 3)
  - [x] Créer `lib/domain/ordonnanceur-budget.ts` — domaine pur (AD-1), **aucun `process.env`**.
        Toutes les constantes du tableau « Décisions » ci-dessus, aux valeurs indiquées.
  - [x] `export const PALIER: "hobby" | "pro" = "hobby";` — **un littéral, DANS ce fichier.** Ne pas
        créer de second module de configuration : ce serait exactement le défaut que la garde
        d'unicité ci-dessous empêche pour `vercel.json`.
  - [x] Commentaire d'en-tête **daté** donnant la source des deux tables de palier — c'est la seule
        chose qu'aucune garde ne peut vérifier.
  - [x] Garde d'unicité : `vercel.json` ne doit contenir **aucune** clé `functions` visant
        `app/api/ordonnanceur/**`. Deux endroits peuvent déclarer le budget ; la CI n'en lit qu'un.
  - [x] **Mutants à tuer :** `BUDGET_TICK_MS = 400_000` sur palier `pro` (dépasse 800 000 ? non —
        prendre `900_000`) ; `PALIER` changé sans changer `maxDuration` (la couture (b) doit rougir) ;
        `maxDuration` écrit comme expression importée au lieu d'un littéral (la couture (a) doit
        rougir).

- [x] **T2 — La marge devient une fonction, et elle est testée comme telle** (AC: 4)
  - [x] Sortir `MARGE_MS` de `tests/ordonnanceur-architecture.test.ts:266`. C'est le seul invariant
        transversal de l'ordonnanceur qui se vérifie **contre un nombre qu'il porte lui-même**.
  - [x] Test **[MÉTA] de calibrage** — confronter la fonction à un comptage mécanique, pas à un
        chiffre d'auteur. Dans `lib/ordonnanceur/executer.ts` : le motif `/await deps\.depot\./g` rend
        **4 occurrences statiques** (`reclamer` L69, `clore` L93, `leverIncident` L94, `clore` L106),
        **plus** l'appel indirect `await verifierEnvironnement(deps.depot)` L40 — dont le corps vit
        dans `lib/ordonnanceur/environnement.ts` et consomme un `environnementDeclare`.
        ⚠️ **Ne pas chercher `environnementDeclare` dans `executer.ts` : il n'y est pas.**
        Exiger `margeHorsDelais(n) >= COUT_FIXE_MS + n × 3 × COUT_ALLER_RETOUR_MS` (pire cas).
  - [x] ⚠️ **Cette garde pousse en sens INVERSE de `[T3-3]`** : `[T3-3]` se satisfait d'une marge
        assez PETITE, celle-ci exige qu'elle soit assez GRANDE. C'est ce qui les rend non-redondantes.

- [x] **T3 — Borner le mou, et prouver la faisabilité** (AC: 2)
  - [x] Ajouter le **dual** : `BUDGET_TICK_MS − (Σ + margeHorsDelais(REGISTRE.length)) <= RESERVE_DECLAREE_MS`.
  - [x] Assertion de **faisabilité** : `Σ_actuel + margeHorsDelais(6) <= PLAFOND_DUREE_MS[PALIER]` —
        la seule preuve que la story sert à quelque chose. On sait **avant** d'écrire la 6.2 que le
        registre de l'Epic 6 rentre.
  - [x] **Supprimer** `expect(somme).toBe(50_000)` de `tests/rappel-echeance-job.test.ts:251`.
        ⚠️ **Ne pas la rapatrier** : l'encadrement AC1 + AC2 enferme déjà `Σ` dans une fourchette de
        largeur `RESERVE_DECLAREE_MS`. Un `toBe` en plus est le « détecteur de changement » que cette
        story dénonce — vert par construction, informatif sur rien. Écrire dans le commentaire : *la
        valeur exacte de Σ n'est plus assertée ; c'est son encadrement qui la tient.*

- [x] **T4 — Un plancher par job, et la collision de noms qui piège l'import** (AC: 5)
  - [x] Ajouter `reserveMs` à `JobEnregistre` — **requis, jamais optionnel** : un `?` viderait de son
        sens l'anti-vacuité (un job sans plancher passerait en `undefined`).
  - [x] ⚠️ **Trois fabriques de tests construisent ce type en littéral et casseront `tsc`** :
        `tests/ordonnanceur-executeur.test.ts:62-77` (helper `job()`),
        `tests/sante-job.test.ts:41-49` (`REGISTRE_FACTICE`),
        `tests/ordonnanceur-endpoint.test.ts:49-67` (le `vi.mock` du registre).
  - [x] Faire **itérer** la garde sur `REGISTRE` — le plancher actuel est **nominatif**
        (`REGISTRE.find(j => j.nom === "synthese-hebdomadaire")`) et ne s'étendra jamais tout seul.
        Anti-vacuité : `expect(couverts.length).toBe(REGISTRE.length)`.
  - [x] ⚠️ **Renommer `RESERVE_PERSONNE_MS` de `lib/ordonnanceur/jobs/rappel-echeance.ts:75` en
        `RESERVE_ENVOI_MS`** (elle vaut `DELAI_ENVOI_MS` 4 000 + 1 500 = **5 500**, contre **31 000**
        pour son homonyme de `lib/domain/synthese.ts:126`). L'auto-complétion importe la mauvaise sans
        le moindre signal : **un plancher près de six fois trop laxiste, silencieusement.**
        Call sites à reprendre : `tests/rappel-echeance-job.test.ts:5, :226, :256, :268`, et les
        commentaires `registre.ts:28` et `:97`.

- [x] **T5 — Le job de santé : son budget grandit, et son silence cesse** (AC: 6)
  - [x] `COUT_ETAT_MS = 1_200` **dans `lib/ordonnanceur/jobs/sante.ts`** (c'est son coût, pas celui du
        budget). Garde : `sante.delaiMs >= COUT_ETAT_MS + RESERVE_INCIDENT_MS × (REGISTRE.length + 1)`
        → 6 000 aujourd'hui, exactement sa valeur. Son propre en-tête l'annonce (`sante.ts:25-26` :
        « un job de plus au registre taxe DEUX fois ce budget ») et **rien ne le vérifie**.
  - [x] Test **comportemental sur le VRAI `REGISTRE` avec le VRAI `delaiMs`**.
        ⚠️ **Ce qui existe déjà, pour ne pas le réécrire :** `tests/sante-job.test.ts` a bien deux
        tests dédiés au rendu de main (describe « [REVUE 4.10] il REND LA MAIN plutôt que de se faire
        couper », `:79-113`), avec leurs mutants-cibles. Mais ils tournent sur un `REGISTRE_FACTICE`
        de **trois** jobs à `delaiMs: 1_000`, avec une échéance **forgée** — `3_600_000` (deux tests,
        soit 600 fois le budget réel) ou `0` (deux tests). **Le chemin n'est jamais exercé avec le
        `delaiMs` réel du registre : c'est ce cas-là, et lui seul, que T5 ajoute.**
  - [x] Assertion : `incidents.length === REGISTRE.length`, pas « au moins un ». Anti-vacuité : la
        même scène avec une échéance délibérément trop courte doit rendre **strictement moins**.
  - [x] Faire parler `sante.ts:42` avant son `return`, **sous la forme interpolée du dépôt**
        (patron `synthese.ts:170`, `rappel-echeance.ts:102`) :
        `journaliserExploitation("sante_lot_incomplet", { code: \`restants_${ctx.registre.length - rang}\` })`.
        ⚠️ `synthese.ts` et `rappel-echeance.ts` journalisent tous deux quand ils rendent la main ;
        **la seule alarme du produit est la seule à se taire.**
  - [x] **Le scénario à tuer, en toutes lettres :** budget de santé rogné « parce qu'il ne fait que
        lire un état » → `etat()` consomme 800 ms → `return` avant le premier `leverIncident` → clos
        en `reussi` → l'homme mort voit une réussite → `/api/health` dit `ok`. **Plus aucun
        `job_en_retard` n'est jamais levé, pour aucun job** — et c'est le SEUL incident qui dégrade la
        sonde (`0031:69-91` ; un `job_echoue` ne dégrade pas). Un moteur de rétention en panne devient
        invisible.

- [x] **T6 — La couture registre ↔ SQL vise la définition COURANTE** (AC: 8)
  - [x] `tests/ordonnanceur-architecture.test.ts:210` lit `0028_sante_homme_mort.sql`. Or **trois**
        migrations définissent `sante_ordonnanceur_publique` (0027, 0028, 0031) et **c'est 0031 qui
        gagne**. Les migrations étant immuables, 0028 contiendra la chaîne attendue pour toujours :
        **la garde ne peut plus rougir, quoi qu'on fasse.**
  - [x] Écrire `definitionCourante(nomFonction): string` — parcourir `supabase/migrations/*.sql`,
        retenir les fichiers portant `create or replace function public.<nom>`, prendre **le plus haut
        numéro**. Deux anti-vacuités : `definitions.length >= 1` (un renommage rendrait le test muet
        et vert) et le nom du fichier retenu **affiché dans le message d'échec**.
  - [x] Périmètre **fermé** : la seule chaîne concernée à ce jour est `sante-ordonnanceur`. Écrire que
        `definitionCourante` est réutilisable et qu'aucune autre chaîne ne l'est aujourd'hui.
        *(L'audit des 16 gardes ancrées sur un numéro de migration est consigné dans
        `deferred-work.md` — hors périmètre, et toutes ne sont pas des défauts.)*

- [x] **T7 — Le schedule est vérifié sur sa valeur** (AC: 7)
  - [x] `intervalleMinimalDuCron(schedule): number` (secondes entre deux déclenchements, pire cas),
        avec tests **[MÉTA]** sur cas connus : `0 6 * * *` → 86 400, `0 */4 * * *` → 14 400,
        `*/15 * * * *` → 900. ⚠️ La garde actuelle n'exige que **cinq champs** : `*/5 * * * *` la
        satisfait intégralement.
  - [x] `86_400 / intervalleMinimalDuCron(schedule) <= TICKS_MAX_PAR_JOUR[PALIER]`. Sur `hobby`, une
        expression plus fréquente **fait échouer le déploiement** — la CI doit le dire avant Vercel.
  - [x] `intervalle × 1000 >= BUDGET_TICK_MS + margeHorsDelais(REGISTRE.length)` — deux ticks ne
        peuvent pas se chevaucher. **Cette assertion tue au passage la course d'invocations
        recouvrantes** : `executer.ts` n'a aucun verrou au niveau du registre, seulement par job, et
        sans elle le job N+1 d'un tick peut s'exécuter pendant le job N d'un autre — l'arbitrage du
        plafond par famille (« la synthèse passe avant le rappel, **toujours** ») deviendrait un
        tirage au sort.
  - [x] La garde de tolérance (`test:221-224`) calcule son pas depuis `intervalleMinimalDuCron`, plus
        depuis l'énumération `cadence`.
  - [x] **DST** : ⚠️ le schedule s'interprète en **UTC** pendant que `fenetreDe` tranche en
        **Europe/Paris** — l'assertion porte donc sur la *conversion*. Énumérer les ticks sur les
        journées encadrant les deux bascules et assérer que **chaque date civile Paris reçoit au moins
        un tick**. La journée d'automne dure 25 h, celle du printemps 23 h.
  - [x] `existsSync` avant le `readFileSync(vercel.json)` (`test:86`) : la garde casserait en `ENOENT`
        si le fichier disparaissait — voir la porte d'hébergement, `PORTES-AVANT-PUBLICATION.md` §2.
  - [x] ⚠️ **NE PAS toucher `expect(vercel.crons).toHaveLength(1)`.** Cette story n'ajoute aucun tick,
        et sur `hobby` elle ne le pourrait pas. L'assouplissement appartient à la 6.2.
  - [x] **Écrire dans l'en-tête du registre** que le multi-tick est un mécanisme de reprise et non de
        débit, avec le pourquoi.
  - [x] ⚠️ **Ne PAS écrire l'assertion `2 × intervalle < 48 h`** : avec `0 6 * * *`, `2 × 86 400` vaut
        **exactement** la fenêtre d'homme mort. Elle serait rouge à la seconde où elle est écrite. Le
        fond est réel et **traité en 6.1a** (alignement de la fenêtre sur `toleranceHeures`).

- [x] **T8 — Borner les appels de dépôt** (AC: 10)
  - [x] Les cinq `await` de `lib/data/depot-ordonnanceur.ts` (`environnementDeclare`, `reclamer`,
        `clore`, `etat`, `leverIncident`) sont **nus**. Les envelopper d'`avecDelai`, avec le
        `Promise.resolve(...)` **obligatoire** — le constructeur PostgREST est un *thenable* sans
        `.finally`, piège déjà payé au défaut n°8 de la revue 4.8. *(Le seul appel borné du fichier
        est `santePublique`, `:103-107` — parce que ce défaut l'avait attrapé là et nulle part
        ailleurs.)*
  - [x] Garde de source, sur le patron du fichier : aucun `await supabase.rpc(` ni
        `await supabase.from(` dans `depot-ordonnanceur.ts` hors d'un `avecDelai`.
  - [x] Test comportemental : un dépôt dont `reclamer` **ne résout jamais** doit produire un rapport et
        une réponse HTTP — pas une route qui pend. Ajouter à
        **`tests/ordonnanceur-executeur.test.ts`** (avec « eur »), qui applique déjà le patron
        `executerOrdonnanceur({ depot, registre: [...] })` (voir `:126`, `:206`) plutôt que `vi.mock`.
  - [x] ⚠️ **Correctif de robustesse pur, sans changement de contrat.** L'échéance globale du
        répartiteur et l'issue `reporte` — qui élargiraient `IssueJob` (`executer.ts:22`) donc le corps
        JSON de la route — sont **hors périmètre** : elles arriveront avec le premier job qui en aura
        besoin.

- [x] **T9 — La trace, et ce qu'elle ne peut pas contenir** (AC: 9)
  - [x] ⚠️ **La moitié « trace » de l'AC2 de l'epic n'est couverte par rien aujourd'hui**, et la trace
        n'existe pas sur le chemin du rejeu : `executer.ts:70-73` pousse `deja_fait` dans le rapport
        HTTP puis `continue` — **rien en base** (la ligne `execution_job` est celle d'hier,
        `tentatives` n'est pas incrémenté), **rien dans les journaux**. Le rapport part vers
        l'ordonnanceur externe et se perd. Sur un rejeu de purge (6.8), il ne resterait aucune trace
        disant « la rétention a été rejouée et n'a rien refait ».
  - [x] `journaliserExploitation("ordonnanceur_deja_fait", { code: job.nom })` sur ce chemin.
  - [x] Garde de source sur `lib/ordonnanceur/**` : les arguments `motif` / `detail` atteignant
        `clore(...)` et `leverIncident(...)` sont des **littéraux d'un vocabulaire fermé** ou
        `codeDErreur(...)`. Avec le contrôle **[MÉTA]** positif/négatif que le fichier applique déjà à
        ses trois autres détecteurs textuels.
  - [x] ⚠️ Aujourd'hui l'absence d'art. 9 dans `execution_job.motif_echec` et `incident_systeme.detail`
        n'est structurelle que **par la longueur** (`0027:111` ≤ 120, `0027:215` ≤ 200) : rien
        n'empêche un futur job de rétention d'y passer un `detail` libre. *(Le `CHECK` de forme en base
        est en 6.1a, avec la migration.)*
  - [x] Rappel : `journaliserIncidentSecurite` **ne recopie pas** l'objet qu'on lui passe — il en
        extrait `code` et jette le reste. Un `{motif, detail}` sort en `code: undefined` : l'alerte
        existe, vide de sens (défaut n°10 de la revue 4.8).

- [x] **T10 — La surface des gardes couvre ce que l'Epic 6 va poser** (AC: 11)
  - [x] `SOURCES` (`tests/ordonnanceur-architecture.test.ts:44-49`) = `lib` + `app` + `render` +
        fichiers racine, en `.ts/.tsx` seulement, et le seul motif est `setInterval(`. Or **la 6.2
        apporte le web push**, donc un service worker — et `public/` **n'est pas balayé**, ni
        `scripts/` (deux fichiers `.mjs` existants).
  - [x] Étendre `SOURCES` à `public/**` et `scripts/**`, en `.js/.mjs/.ts/.tsx`.
  - [x] Ajouter au détecteur le vocabulaire du rythme côté client : `periodicSync`,
        `registerPeriodicSync`, `showTrigger`, et le `setTimeout` récursif.
  - [x] Contrôle **[MÉTA]** positif/négatif obligatoire : un faux `public/sw.js` fautif doit rendre le
        test **rouge**, et une simple mention en commentaire ne doit **pas** le faire.
  - [x] ⚠️ Sans ça, la garde censée « casser le build » (AC3 de l'epic) est aveugle **exactement là où
        l'Epic 6 posera son premier mécanisme périodique hors ordonnanceur.**

- [x] **T11 — Généalogie** (AC: 1)
  - [x] Récrire l'en-tête du registre contre `BUDGET_TICK_MS` au lieu de `maxDuration(60 s)` :
        `registre.ts:22`, `:34`, `:92-94`.
  - [x] Remplacer « la dérive de planification de Vercel Cron » par « l'ordonnanceur externe » —
        `registre.ts:67` et `:109` **seulement** (`:87` renvoie par référence, rien à récrire) —, plus
        `tests/ordonnanceur-architecture.test.ts:218` qui répète la phrase, et
        `app/api/ordonnanceur/route.ts:7,11` (« Vercel Cron l'appelle »).
  - [x] ⚠️ **NE PAS CHANGER LES VALEURS.** Le raisonnement sur `toleranceHeures: 60` **survit** : aucun
        planificateur externe ne garantit la minute (Hobby annonce ±59 min). Seule la **généalogie**
        change.

- [x] **T12 — Vérification et campagne de mutation**
  - [x] Suite complète (`npx vitest run` — ⚠️ **ne jamais sourcer `.env.local` d'abord**), `npx tsc
        --noEmit`, `npx eslint .`, `npx next build`. `supabase db reset` **AVANT** la passe de
        clôture, jamais après.
  - [x] Campagne de mutation. ⚠️ **Une story qui ne livre QUE des gardes est la dernière qui puisse
        s'en passer** : rien d'autre ne prouvera qu'aucune n'est décorative. Restauration depuis un
        instantané `cp`, **jamais `git checkout`**. Mutants obligatoires :
        1. `maxDuration` désaccordé de `BUDGET_TICK_MS` ; 2. `maxDuration` écrit en expression
        importée ; 3. `BUDGET_TICK_MS` au-delà du plafond du palier ; 4. `margeHorsDelais` → `0` ;
        5. → `1_000 × n` ; 6. `COUT_PAR_JOB_MS` divisé au lieu de multiplié ; 7. `reserveMs` retiré
        d'un job ; 8. `reserveMs` rendu optionnel ; 9. `sante.delaiMs` rogné à 2 000 ;
        10. `RESERVE_INCIDENT_MS` mis à 0 ; 11. une clé `functions` visant l'ordonnanceur dans
        `vercel.json` ; 12. le `job = '…'` renommé dans la migration **courante** ; 13. `0031` ignorée
        au profit de `0028` dans `definitionCourante` ; 14. le schedule passé à `*/5 * * * *` ;
        15. un `avecDelai` retiré d'un RPC du dépôt ; 16. le `Promise.resolve` retiré ; 17. un
        `setInterval` posé dans `public/sw.js` ; 18. le `journaliserExploitation` de `sante.ts` retiré.
  - [x] Un mutant **équivalent** se documente dans `deferred-work.md`, il ne se masque pas.

---

## Dev Notes

### Le moteur, en une page — pour coder sans rouvrir les fichiers

**Domaine pur** (`lib/domain/ordonnanceur.ts`, AD-1) — deux notions, et **délibérément aucune
`estDu()`** : « la réclamation atomique EST la décision ».

```ts
type Cadence = "quotidien" | "hebdomadaire";
const FUSEAU = "Europe/Paris";
interface DescriptionJob { nom; cadence; toleranceHeures; enServiceDepuis: Date; delaiMs }
fenetreDe(cadence, instant): string           // "2026-08-05" | "2026-W32", civil Paris
estEnRetard(job, derniereReussite|null, naissanceSysteme, instant): boolean
```

⚠️ Un `retentionEstDue(instant)` écrit en mémoire prendrait la même décision **à deux endroits** —
mémoire *et* SQL. Ils divergeront, et la rétention s'exécutera deux fois ou jamais.

**Dépôt** (`lib/data/depot-ordonnanceur.ts`) — la totalité de la surface disponible depuis `ctx.depot` :

```ts
environnementDeclare(): Promise<string | null>
reclamer(job, fenetre, cibleId: string|null, bailSecondes): Promise<boolean>
clore(job, fenetre, cibleId, reussi, motif): Promise<void>
etat(): Promise<{ naissance: Date|null; reussites: ReadonlyMap<string, Date> }>
leverIncident(type: "job_en_retard" | "job_echoue", job, detail): Promise<void>
```

⚠️ **Deux types d'incident, pas trois.** La table porte un `CHECK` : inventer `retention_bloquee`
exige une migration, sinon l'insert lève `23514` et **l'incident est perdu**.

**Répartiteur** (`lib/ordonnanceur/executer.ts`) — vérifier l'environnement, puis par job : réclamer
(`cibleId = null`, bail = `ceil(delaiMs/1000) + 60`), exécuter sous `avecDelai`, clore. Le fan-out par
personne est fait **par le job**, qui rappelle `reclamer(NOM, fenetre, utilisatriceId, …)`.

**Le patron obligatoire de tout job** : rendre la main **soi-même** avant l'échéance
(`ctx.echeance.getTime() - Date.now() < RESERVE`). Se faire couper par `avecDelai` clôt en `echoue` et
lève un `job_echoue` — **un mensonge sur du travail peut-être accompli**.

### ⚠️ `instant` décide de la FENÊTRE, `Date.now()` décide du TEMPS

`DepsOrdonnanceur.instant` est injectable (`executer.ts:33-35`) et les tests le fixent **dans le
passé** — `tests/ordonnanceur-executeur.test.ts:322-337` passe `instant: new Date("2026-08-05T23:30:00Z")`.
`executer.ts:79` a déjà tranché pour l'échéance par job : il utilise `Date.now()`, pas `instant`.
Confondre les deux casse le test ajouté en réparation du défaut n°7 de la revue 4.8 — celui qui prouve
que la clé de fenêtre part bien vers la base.

### ⚠️ Lire 0027 seul donne une version PÉRIMÉE de trois fonctions

- `clore_execution` durcie par **0035** (`and statut = 'en_cours'`) ;
- `etat_ordonnanceur` et `sante_ordonnanceur_publique` réécrites par **0031** (filtre
  `cible_id is null`, et **seul `job_en_retard` dégrade**).

C'est ce qui rend la garde T6 décorative, et la raison pour laquelle un moteur de rétention en panne
ne se verrait **que par son retard**, jamais par ses échecs.

### Doctrine du dépôt — non négociable

- **Une garde qui ne vit que dans une route, une Server Action ou une RPC ne garde rien** :
  `authenticated` détient les sept privilèges DML sur chaque table publique. Les gardes vivent dans les
  policies `WITH CHECK` ou dans des triggers. *(Exception établie en 5.9 : quand la ressource est une
  constante serveur, la garde est une frontière de dépendance.)* **Cette story ne touche aucune table —
  toutes ses gardes sont des gardes de source et de domaine.**
- **Un test vert ne prouve rien tant que son mutant n'est pas mort.**
- **Le piège des défenses redondantes** : deux gardes qui se couvrent l'une l'autre laissent le mutant
  survivre. Cette story contient des paires **volontairement opposées** (T2 vs `[T3-3]`, T3 borne haute
  vs borne basse) — c'est ce qui les rend non-redondantes.
- **Aucune donnée art. 9 en clair dans un journal** (NFR-022).

### Tests

Deux projets Vitest : `node` (`tests/**/*.test.ts`) et `rendu` (jsdom). Lancer **`npx vitest run`**.
⚠️ **Ne jamais sourcer `.env.local` d'abord** — la garde `refusDeCible` refuse. Pile Supabase locale :
`supabase` global (`/opt/homebrew/bin`, v2.67.1), **jamais `npx supabase`**.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-6] — story 6.1 et le périmètre 6.2 à 6.8
- [Source: lib/domain/ordonnanceur.ts] — fenêtre, retard, absence délibérée d'`estDu`
- [Source: lib/ordonnanceur/executer.ts] — boucle réclamer/exécuter/clore
- [Source: lib/ordonnanceur/registre.ts:20-37] — l'interdiction de monter la marge
- [Source: lib/ordonnanceur/jobs/sante.ts:16-28] — « un job de plus taxe DEUX fois ce budget »
- [Source: supabase/migrations/0027_ordonnanceur.sql:150-168] — la réclamation atomique
- [Source: supabase/migrations/0031_ordonnanceur_alarmes.sql:69-91] — la sonde publique **courante**
- [Source: _bmad-output/implementation-artifacts/PORTES-AVANT-PUBLICATION.md#2] — la porte d'hébergement
- [Source: vercel.com/docs/functions/configuring-functions/duration, lu le 14/08/2026]
- [Source: vercel.com/docs/cron-jobs/usage-and-pricing, lu le 14/08/2026]

---

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context).

### Debug Log References

Trois erreurs commises en cours d'implémentation, toutes corrigées, et les trois valent d'être
gardées parce qu'elles se reproduiront :

1. **Un test vert à zéro incident.** La première version du test « avec le VRAI budget du registre,
   il sert TOUS les jobs » passait `instant: 2026-08-06`, trop proche des `enServiceDepuis` réels
   pour qu'un seul job soit en retard : l'assertion valait `expect(0).toBe(0)` — exactement
   l'illusion que ce test existe pour détruire. L'instant est désormais **dérivé** du registre
   (`max(enServiceDepuis + toleranceHeures) + 1 h`), donc il restera juste quand un job entrera.
2. **`*/5 * * * *` écrit dans un commentaire de bloc `/* … */`.** La séquence ferme le commentaire :
   `esbuild` a refusé de parser le fichier. Le commentaire dit maintenant l'expression en toutes
   lettres.
3. **La virgule finale d'un appel multi-lignes.** `dernierArgument` découpait sur la dernière virgule
   de profondeur 1 et rendait une chaîne **vide** pour `sante.ts`, que `argumentFerme` refusait — une
   garde rouge sur du code parfaitement sain. Elle collecte désormais tous les arguments et retient
   le dernier non vide, et le cas est figé dans un test `[MÉTA]`.

### Completion Notes List

**Ce qui a changé de sens, et non de valeur.** `Σ delaiMs` vaut toujours 50 000 ms,
`margeHorsDelais(3)` vaut 8 000 ms, `maxDuration` vaut toujours 60. Ce qui a changé :

| | Avant | Après |
|---|---|---|
| La chaîne | `Σ + 8000 ≤ maxDuration` — un nombre du dépôt contre un autre nombre du dépôt | `Σ + margeHorsDelais(n) ≤ BUDGET_TICK_MS ≤ PLAFOND_DUREE_MS[PALIER]` |
| Le mou | non borné : desserrer le plafond satisfaisait *mieux* la garde | borné haut par `RESERVE_DECLAREE_MS` |
| La marge | constante plate dans un test | fonction calibrée sur un **comptage** de `executer.ts` |
| Le plancher | nominatif, sur un seul job | itère sur `REGISTRE`, avec anti-vacuité |
| La couture SQL | lisait `0028` — **ne pouvait plus rougir** | `definitionCourante()`, plus haute migration |
| Le schedule | « cinq champs » | sa **valeur** : ticks/jour ≤ palier, pas de chevauchement, DST |
| La surface | `.ts`/`.tsx` sous `lib`/`app`/`render` | `+ public/**` et `+ scripts/**`, `.js`/`.mjs` inclus |

**Trois changements de comportement, tous assumés et voulus :**

- `lib/data/depot-ordonnanceur.ts` — les cinq appels sont **bornés** à 3 s. Une marge ne protège de
  rien contre un appel qui **pend**, et un `try/catch` n'attrape que des rejets. Ce défaut avait déjà
  été payé une fois (revue 4.8, n°8) et corrigé **uniquement** sur `santePublique` : on avait réparé
  l'instance, pas la classe.
- `lib/ordonnanceur/jobs/sante.ts` — son rendu de main **parle**. Il était le seul des trois à se
  taire, alors que c'est la seule alarme du produit et qu'un rendu de main la clôt en `reussi`.
- `lib/ordonnanceur/executer.ts` — le chemin `deja_fait` **laisse une trace**. Il n'en laissait
  aucune, nulle part : sur un rejeu de purge (6.8), rien n'aurait pu attester que « la rétention a
  été rejouée et n'a rien refait ».

**Trouvé en chemin, hors périmètre écrit de la story :**

- Le faux registre de `tests/ordonnanceur-endpoint.test.ts` **n'a pas cassé** sous `tsc` comme la
  story le prévoyait : la fabrique de `vi.mock` n'est pas typée. Un faux registre peut donc diverger
  du vrai type en silence. Complété à la main, avec l'avertissement sur place.
- Aucune migration ne nomme une clé de carte (vérifié) — sans rapport avec cette story, mais
  consigné dans `deferred-work.md` pour la story du jeu à 19 cartes.

**Campagne de mutation : 33 mutants, 32 tués, 1 équivalent documenté.**

| Vague | Mutants | Issue |
|---|---|---|
| Les 18 exigés par la story, plus le mou et la trace du rejeu | 20 | 20 tués |
| Nés de la revue adversariale — chaque garde rejouée sous sa forme d'avant | 12 | 11 tués, 1 équivalent |
| Le porteur réel de la sémantique Vixie, isolé pour lever un doute | 1 | tué |

Le mutant `reserveMs?` — que je croyais équivalent puisque tous les jobs le déclarent — est **tué par
`tsc`** : `job.reserveMs` devient `number | undefined`, et `toBeGreaterThanOrEqual(undefined)` ne
compile pas.

⚠️ **Deux « survivants » étaient mes mutants qui étaient faux, et il a fallu les refaire pour le
savoir.** Le premier ne changeait que la date de départ de la fenêtre cron alors que la faute
d'origine changeait aussi sa longueur ; le second mutait l'assertion d'un test en tautologie, ce qui
survit toujours puisque rien ne teste le test — le vrai mutant casse la COUVERTURE de la boucle. Les
deux refaits correctement : tués. **Un mutant qui survit accuse la garde, mais il faut d'abord
vérifier qu'il accuse la bonne chose.**

**Le seul équivalent, documenté et non masqué** (`deferred-work.md`) : la borne `[0, 7]` du champ
jour-de-semaine du parseur cron est inerte — `max` ne sert qu'à l'expansion de `*` et `*/n`, un
littéral `7` fixe `debut = fin` sans la consulter, et la normalisation replie 7 sur 0 dans les deux
cas. Ce qui porte la propriété est la NORMALISATION, isolée et tuée par son propre mutant.

### Revue adversariale — ce qu'elle a trouvé, et ce que ça a coûté

Cinq angles indépendants sur le diff, chaque trouvaille soumise à un sceptique chargé de la réfuter :
**30 trouvailles, 22 survivantes.** Le reproche central est celui que la story écrivait elle-même en
exergue — *« si un test devient vert plus facilement après ton passage, tu t'es trompé »*.

**La seule qui touchait la production.** En bornant les cinq appels du dépôt (T8), j'ai fait **lever**
`environnementDeclare`, dont le commentaire jure deux lignes plus bas qu'elle ne lève jamais. Rien
n'attrape entre `executer.ts:40` et `app/api/ordonnanceur/route.ts:50` : une base muette — *exactement
le cas que la borne existe pour traiter* — produisait un **500** au lieu du refus `base_muette`
documenté avec son incident de sécurité. Le repli faisait plus de dégât que le chemin nominal : l'exact
inverse d'AD-15, et invisible parce que `Promise<string | null>` ne dit rien des exceptions.

**Deux contournements du vocabulaire fermé, tous deux critiques (NFR-022).** `argumentFerme` ne testait
que le **début** de l'expression : `codeDErreur(e) + ": " + branche.nom` passait intégralement. Et
`variablesDeCode` blanchissait un nom pour tout le fichier dès une affectation, sans suivre les
réaffectations : `let code = codeDErreur(e); … code = e.message;` passait aussi.

**Deux paires de défenses que j'annonçais indépendantes et qui n'en faisaient qu'une.**

- Le test « avec le VRAI budget, il sert tous les jobs » ne rougissait pas pour `sante.delaiMs → 2 000`
  — la mutation que son propre commentaire nommait. Le dépôt factice répondant en ~0 ms, `Date.now()`
  ne bougeait pas et l'assertion se réduisait à `delaiMs > RESERVE_INCIDENT_MS`. Ma campagne tuait bien
  ce mutant, mais **par l'autre garde** ; celle-ci rassurait.
- Les deux assertions `maxDuration` (a) et (b) portaient la **même** expression régulière, donc (a)
  était strictement incluse dans (b). Fusionnées en trois propriétés réellement distinctes, dont une
  neuve : « `maxDuration` se déclare exactement une fois ».

**Deux anti-vacuités qui n'en étaient pas.** `REGISTRE.filter(job => { expect(…); return true })` puis
comparer la longueur au registre : le prédicat rend inconditionnellement `true`, l'égalité était vraie
par construction. Et celle de `public/` ne vérifiait **jamais** `public/` — supprimer la branche
laissait les 41 tests verts, `public/` ne contenant aujourd'hui aucun `.js`. Remplacée par une **sonde
réelle** posée puis retirée dans un `finally`.

**Trois défauts du parseur cron, dont un que mon commentaire certifiait faussement.** La fenêtre de
28 jours depuis le 1ᵉʳ janvier ne franchit **aucune** frontière de mois, alors que le commentaire
affirmait qu'« un `1-31/2` montre bien son resserrement de fin de mois » : la fonction sur-estimait
l'intervalle du double, dans le sens permissif. Plus : dimanche s'écrit `0` **ou** `7` en sémantique
Vixie, et `7` rendait un ensemble vide donc zéro tick ; et un pas nul faisait **boucler à l'infini** —
le test pendait au lieu de rougir, ce qui est la pire façon d'échouer parce qu'une CI qui pend se lit
comme une lenteur. *(Ce dernier a fait pendre la campagne de mutation elle-même : confirmation nette.)*

**Un faux positif attrapé en corrigeant.** L'élargissement du détecteur de rythme aux fonctions
fléchées acceptait d'abord `= <identifiant>`, ce qui faisait de `const r = absorberDelta(…)` un nom de
fonction et rougissait sur le `setTimeout(r, ms)` d'un sommeil ponctuel dans
`app/api/anam/message/route.ts`. Resserré aux vraies définitions de fonction, et le cas est figé dans
le `[MÉTA]` — une garde qui rougit sur du code sain finit par être désactivée.

**Ce que la seconde campagne a révélé, et que la revue n'avait pas vu.** Retirer le coût par incident
du dépôt de test laissait tous les autres tests verts : ils prouvaient le terme `COUT_ETAT_MS` et
**rien** du terme `RESERVE_INCIDENT_MS × (n + 1)` — celui qui fait grandir le plancher avec le
registre, c'est-à-dire toute la raison d'être de la garde. Un test neuf l'exerce : un budget suffisant
pour démarrer le lot mais pas pour le finir, qui lève exactement deux incidents sur trois.

**Vérification de clôture**, dans l'ordre prescrit : `supabase db reset` (0001→0051) **avant** la
passe, puis `npx vitest run` (**3629 tests / 224 fichiers**), `npx tsc --noEmit`, `npx eslint .`,
`npx next build` — tous propres.

### File List

**Créés**
- `lib/domain/ordonnanceur-budget.ts` — le module de budget (domaine pur, AD-1)
- `tests/ordonnanceur-depot-borne.test.ts` — les cinq méthodes du dépôt, bornées et prouvées

**Modifiés**
- `app/api/ordonnanceur/route.ts` — le littéral `maxDuration` et sa raison d'être
- `lib/data/depot-ordonnanceur.ts` — `borne()` autour des cinq appels
- `lib/ordonnanceur/executer.ts` — la trace du rejeu
- `lib/ordonnanceur/jobs/sante.ts` — `COUT_ETAT_MS`, `RESERVE_INCIDENT_MS` exporté, le rendu de main qui parle
- `lib/ordonnanceur/jobs/rappel-echeance.ts` — `RESERVE_PERSONNE_MS` → `RESERVE_ENVOI_MS`
- `lib/ordonnanceur/registre.ts` — `reserveMs`, l'en-tête réécrit, la généalogie
- `tests/ordonnanceur-architecture.test.ts` — l'essentiel des gardes neuves
- `tests/sante-job.test.ts` — le plancher qui grandit, le budget réel, le silence levé
- `tests/rappel-echeance-job.test.ts` — le renommage, et la suppression du `toBe(50_000)`
- `tests/ordonnanceur-executeur.test.ts`, `tests/ordonnanceur-endpoint.test.ts` — les fabriques
- `tests/ordonnanceur-sql.test.ts` — la généalogie
