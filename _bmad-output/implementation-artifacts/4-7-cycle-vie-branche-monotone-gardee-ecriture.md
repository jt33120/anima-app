---
baseline_commit: 2979d62
---

# Story 4.7 : Le cycle de vie d'une branche — naissance → feuillaison → rayonnement, monotone et gardé à l'écriture

Status: review

<!-- Story créée le 2026-08-04, immédiatement après la livraison de la 4.6 (CI verte 30914928189, 1346 tests).
     4.5 fait NAÎTRE la branche, 4.6 la MONTRE et la RENOMME, 4.7 la fait VIVRE. C'est la première story qui
     écrit `etat`/`intensite` : 0023 les épingle volontairement (`etat='naissance' and intensite=0` dans la
     policy d'insertion ET dans le trigger) — il faut RELÂCHER LES DEUX au même endroit, sinon la feuillaison
     est refusée en silence. Deux décisions load-bearing sont posées en Dev Notes et attendent un go du PO :
     (D1) comment se détecte le « retour spontané sur le thème », (D2) renommer l'enum SQL `fruit` →
     `rayonnement` maintenant. -->

## Story

En tant qu'utilisatrice,
je veux **voir une branche s'intégrer par degrés quand j'y reviens**, et **déclarer moi-même** quand elle entre en pleine lumière,
afin que ma croissance se lise **dans la matière et jamais dans un chiffre**, et qu'elle **ne recule jamais**.

## Acceptance Criteria

> **Rappel de partition.** 4.6 a livré la défense anti-régression **au rendu** (`reconcilierProjection`, un filet côté client). 4.7 livre la garantie **à l'écriture** : une **fonction de transition unique** dans `lib/domain/` **et** une **contrainte SQL** (trigger + CHECK). Le filet du rendu reste — mais il ne doit plus jamais avoir de raison de se déclencher.
>
> **Deux natures différentes** (EXPERIENCE L251) : la `feuillaison` est un **continuum inféré** rendu dans la matière ; le `rayonnement` est un **événement déclaré** par elle. Ne jamais les traiter par le même chemin d'écriture.

1. **[DUR]** **Étant donné** les transitions d'état, **quand** une branche change d'état, **alors** la transition est **strictement monotone** `naissance → feuillaison → rayonnement`, gardée **à l'écriture** par une **fonction de transition unique** dans `lib/domain/` **et** une **contrainte SQL** (trigger `before update`, qui mord aussi `service_role`), **et** le serveur ne régresse **jamais** l'état — ni `etat`, ni `intensite`. *(FR-028, FR-029, AD-8 ; epics 4.7 AC L908)*

2. **[DUR]** **Étant donné** la feuillaison, **quand** l'utilisatrice **revient spontanément** sur le thème d'une branche au fil des semaines, **alors** la feuillaison **s'amorce et progresse par degrés** via le champ `intensite` continu — **jamais** un simple flip d'enum —, **et aucun seuil, aucune étape numérotée, aucun « 2 retours sur 3 » n'est affiché**, l'utilisatrice n'ayant **rien à confirmer**. *(FR-028, FR-031, AD-8 ; epics 4.7 AC L909 ; EXPERIENCE L248)*

3. **[DUR]** **Étant donné** le rayonnement (la pleine lumière), **quand** il est acquis, **alors** c'est **uniquement** parce que l'utilisatrice l'a **déclaré elle-même** — geste **explicite** depuis la fiche, ou en réponse à une question d'Anam —, **et** il n'est **jamais** inféré du contenu de la conversation : **aucun chemin automatique ne peut écrire `rayonnement`** (garde d'architecture + garde SQL). *(FR-028, FR-026, AD-8 ; epics 4.7 AC L910)*

4. **[DUR]** **Étant donné** une régression tentée (état inférieur soumis, `intensite` en baisse, réécriture d'une date de transition, mauvais mois), **quand** la transition est soumise, **alors** la **contrainte de persistance la rejette** — y compris pour un écrivain `service_role` —, **et** seule l'**exception de l'effacement** (FR-067) peut retirer une branche, jamais le produit. *(FR-029, FR-067, AD-8 ; epics 4.7 AC L911)*

5. **Étant donné** un changement d'état, **quand** l'utilisatrice ouvre l'arbre, **alors** le changement est **déjà là** — **aucune animation de croissance**, aucune particule, aucun confetti, aucun son, aucune étincelle, aucun halo de récompense ; le rayonnement est **statique** —, **et** une **phrase sur la fiche dit ce qui a changé et quand**. *(FR-028, FR-031 ; epics 4.7 AC L912 ; DESIGN L601-L603)*

6. **[DUR / sécurité]** **Étant donné** un épisode de détresse en cours **ou** la fenêtre de 72 h qui le suit, **quand** un tour est traité, **alors** **aucune progression de feuillaison n'est évaluée ni écrite**, **et** **aucune déclaration de rayonnement n'est acceptée** (décision D3) — les deux gardées au **point d'écriture**, source unique `branche_bloquee_par_detresse()`, jamais dans la seule UI. *(FR-042, FR-046, AD-17, AD-16 ; miroir de la garde 4.4/4.5)*

7. **[DUR / art. 9]** **Étant donné** l'évaluation d'un retour sur le thème, **quand** elle sollicite le modèle, **alors** le **`nom` de branche ne transite JAMAIS vers un modèle** (0021 L9 : « proposition & nommage 100 % déterministes »), **et** aucun `nom`, aucun verbatim ne fuit dans un journal ou une erreur. *(NFR-020, NFR-022, AD-2, AD-3 ; migration 0021 L7-L9)*

## Tasks / Subtasks

> **Discipline TDD, dépendances descendantes (AD-1).** Pour chaque garde **[DUR]** : écrire d'abord le test **rouge**, implémenter le minimum pour le **vert**, puis **mutation-vérifier** (retirer la garde → le test redevient rouge → restaurer → re-run vert → `git status` / `pg_get_functiondef` en preuve). Ordre : base → modèle pur → data → sécurité/app → render → gardes.
> **⚠️ Le piège de la défense en profondeur** (mémoire `gardes-doivent-tuer-leur-mutant`) : quand la policy ET le trigger couvrent le même invariant, un test qui passe par le chemin JWT ne peut isoler ni l'une ni l'autre. **Utiliser `service_role`** (que la RLS ne borne pas) pour isoler le trigger seul.
> **Commande de test (Supabase local DOIT tourner)** : `set -a && . ./.env.local && set +a && npx vitest run`.
> **Supabase local** : CLI **globale** `supabase` (v2.67.1), **jamais** `npx supabase`. `supabase db reset` doit rejouer **0001→0025** proprement (critère de non-régression).
> **Deux projets Vitest** : `node` (`tests/**/*.test.ts`) et `rendu` (`tests/rendu/**/*.test.tsx`, jsdom + Testing Library). Une garde de **comportement** de rendu va dans `rendu` ; une garde de **source** ne prouve que le câblage.
> **Plancher de non-régression : 1346 tests verts / 120 fichiers** (état à la livraison de la 4.6, commit `2979d62`, CI 30914928189). `npx tsc --noEmit`, `npx eslint .` et `npm run build` doivent rester propres.

- [x] **T1 — Migration `0025_branche_cycle_vie.sql` : la garantie d'écriture** (AC: 1, 3, 4, 6, 7)
  - [x] **Relâcher les deux épingles de 0023 EN MÊME TEMPS** — la policy `branche_insertion` (`etat = 'naissance' and intensite = 0`) reste **telle quelle** (une branche naît toujours en naissance), mais le **trigger** `branche_garde_renommage` doit cesser d'interdire tout changement d'`etat`/`intensite` sur `UPDATE`. *(deferred-work L275 : « la 4.7 devra relâcher les deux au même endroit — sinon la feuillaison sera refusée »)*
  - [x] **(D2, tranché : oui)** Renommer la valeur d'enum `'fruit'` → `'rayonnement'` : nouveau CHECK `etat in ('naissance','feuillaison','rayonnement')`. **Aucune ligne existante ne porte `fruit`** (4.5/4.6 n'écrivent que `naissance`) → migration triviale **maintenant**, dette de traduction permanente sinon.
  - [x] Colonnes de transition, **write-once** : `date_feuillaison timestamptz null`, `date_rayonnement timestamptz null` — nécessaires à AC5 (« ce qui a changé **et quand** ») et prévues par EXPERIENCE L232.
  - [x] Table `branche_retour (branche_id, entree_journal_id, jour_paris date, cree_le)` + `unique (branche_id, entree_journal_id)` : **idempotence au retry** (patron 2-4b) et base du « au fil des semaines » (un incrément par **jour civil Paris** au plus). RLS possédée, miroir `branche`.
    - [x] **⚠️ Inventaire d'effacement (FR-067 / AD-4 / AD-14).** Une table neuve qui porte un lien vers `entree_journal` est de la donnée art. 9 dérivée : elle **doit** rejoindre l'effacement exhaustif d'Epic 6 (`on delete cascade` depuis `branche` **et** inscription explicite dans l'inventaire de suppression). Une table oubliée par l'effacement est un trou RGPD silencieux — c'est exactement le genre de dette qu'on ne retrouve pas deux epics plus tard.
  - [x] **Trigger `branche_garde_cycle`** (remplace/étend `branche_garde_renommage`, `before insert or update`, **mord `service_role`**) — LÈVE si :
    - `etat` recule dans l'ordre `naissance(0) < feuillaison(1) < rayonnement(2)` ;
    - `intensite` **baisse** (et reste bornée [0,1] par le CHECK 0023) ;
    - `date_feuillaison` / `date_rayonnement` passe de non-null à une **autre** valeur ou à null (write-once) ;
    - `date_naissance` / `extrait_source_id` / `utilisatrice_id` / `cree_le` / `id` changent (inchangé depuis 0022) ;
    - `etat = 'rayonnement'` sans `date_rayonnement` (ou l'inverse) — cohérence état/date.
  - [x] **RPC `progresser_feuillaison(p_branche_id uuid, p_cle_tour text)`** — `security invoker`. **Signature à respecter** : `consigner()` renvoie `void`, l'appelant n'a **pas** l'id de l'entrée de journal ; la RPC résout l'entrée **en SQL** depuis `cle_tour` (patron `enregistrer_signal_reconceptualisation`, 0020 L99). Insère le retour (`on conflict do nothing`), et **seulement si la ligne est neuve ET qu'aucun retour du même jour civil Paris n'existe déjà**, avance `intensite` d'un pas et pose `etat='feuillaison'` + `date_feuillaison` si c'est la première fois. **Elle ne peut PAS écrire `rayonnement`** (valeur littérale interdite dans son corps → garde de source + garde SQL). Fast-fail AD-17 `branche_bloquee_par_detresse()`, comme 0021 L167.
  - [x] **RPC `declarer_rayonnement(p_branche_id uuid)`** — `security invoker`, **seul** chemin vers `rayonnement`. Pose `etat='rayonnement'` + `date_rayonnement = now()`. **Idempotente** (déjà rayonnante → 0 changement, pas d'erreur). Lève si la branche n'est pas possédée (patron 0023 §6 : plus de succès silencieux). **(D3, tranché)** Lève aussi si `branche_bloquee_par_detresse()` — un basculement déclaré en crise n'entre pas en pleine lumière, et le geste ne se répare pas.
  - [x] **Policy UPDATE** : le WITH CHECK de `branche_renommage` couvre déjà owner + `a_consenti_art9()` + non-barré + nom significatif. Vérifier qu'il **reste suffisant** pour les deux nouveaux chemins, ou ajouter une policy dédiée. **Leçon R1** : `authenticated` a le grant UPDATE table-level → toute garde qui ne vivrait que dans la RPC serait illusoire.
  - [x] `comment on` sur table, trigger et les deux RPC (patron 0021/0022/0023).

- [x] **T2 — `lib/domain/cycle-branche.ts` : la fonction de transition UNIQUE (pure)** (AC: 1, 2)
  - [x] `ORDRE_ETAT` — source unique. Il existe déjà dans `lib/scene/projection.ts` L56 mais **n'est pas exporté** (module-private) : l'**exporter** et le faire importer par `cycle-branche.ts`, plutôt qu'en recopier une seconde définition. Deux copies de l'ordre monotone qui divergent, c'est la faute R1-bis en version TypeScript — et celle-ci décide dans quel sens l'arbre a le droit d'aller.
  - [x] `transitionner({ etat, intensite, date… }, evenement)` → nouvel état **ou refus explicite**. Pure, 0 I/O, testable sans base. **Aucun autre module n'a le droit de calculer une transition** (garde d'architecture T6).
  - [x] `PAS_FEUILLAISON` : le pas d'incrément d'`intensite`. **PLACEHOLDER PRODUIT** au même titre que `INSTRUCTION_RECONCEPTUALISATION` (0.2 = pleine feuillaison en 5 retours) — à valider avant mise en ligne, jamais affiché nulle part (FR-031).
  - [x] Idempotence : rejouer le même événement (même `entree_journal_id`) ne change **rien**.

- [x] **T3 — Détection du retour sur le thème** (AC: 2, 6, 7) — **(D1, tranché : hybride)**
  - [x] `lib/domain/retour-theme.ts` (pur, patron `reconceptualisation.ts`) : la **présélection déterministe** (candidats plausibles parmi les branches non-rayonnantes) + l'`INSTRUCTION_RETOUR_THEME` structurée + le **parser pur** de la sortie modèle. Le doute → **aucun retour** (jamais un faux « tu y es revenue »).
  - [x] `lib/safety/retour-theme-pipeline.ts` (patron `reconceptualisation-pipeline.ts`) : garde AD-17 (`fenetreDetresseActive`, repli sûr = `true` → supprime), garde `doitExecuterTravailSchema(verdict)`, budget de délai, `envoyerSousEgressArt9`, métrage, **repli sûr partout** (aucun tour ne casse à cause de ça).
  - [x] **[DUR / AC7]** La requête envoyée au modèle ne porte **QUE des extraits de journal** (contenu qui transite déjà légitimement) — **jamais un `nom` de branche**. Garde dédiée : construire la requête avec des noms distinctifs et vérifier qu'aucun n'apparaît dans le payload.
  - [x] Câblage dans `app/api/anam/message/route.ts`, dans le **même `after()`** que l'étage reconceptualisation (post-réponse, aucune latence ajoutée, aucun 500 possible), **après** le gate d'allocation.
  - [x] Nouvelle capacité `retour_theme` dans `CapaciteIa` (`lib/ai/port.ts`) + `politique-tier.ts` → **fort**.

- [x] **T4 — Le geste de déclaration (AC3) : endpoint + fiche + réponse à Anam** (AC: 3, 5)
  - [x] `app/api/anam/branche/rayonnement/route.ts` (ou extension de `app/api/anam/branche`) : POST `{ brancheId }`, 401 sans session, appelle `declarer_rayonnement`. **Aucune entrée textuelle, aucune sortie de modèle ne peut atteindre ce chemin** — il ne prend qu'un id et un geste.
  - [x] Fiche (`render/arbre/FicheBranche.tsx`) : action explicite, libellé dans `copie-arbre.ts`. **Formulation à trancher côté produit** — dire ce qu'elle a vécu, jamais féliciter (charte §6). Masquée si la branche rayonne déjà. Confirmation légère (le geste est **irréversible**).
  - [x] Affordance « en réponse à Anam » : bouton **explicite** (patron `PropositionBranche.tsx` de la 4.5), **jamais** un parsing du texte libre — sinon le rayonnement serait inféré, ce qu'AC3 interdit.
  - [x] Annonce a11y via la région live persistante existante (`onAnnoncer`).

- [x] **T5 — Le rendu : « ce qui a changé et quand » (AC5)** (AC: 5)
  - [x] `BrancheProjetee` porte `dateFeuillaison?` / `dateRayonnement?` ; `charger_branches_arbre()` et `depot-branche.ts` les remontent.
    - [x] **⚠️ `create or replace function` ne peut PAS changer le type de retour** (`ERROR 42P13`). `charger_branches_arbre()` gagne deux colonnes → il faut **`drop function public.charger_branches_arbre();` puis `create`**, et **re-poser le `revoke`/`grant`** (un `drop` les emporte). Même piège si `charger_echange_source` était touché.
  - [x] Fiche : une phrase sobre et **datée** (« En pleine lumière depuis le 12 mars. » / « Feuillaison amorcée le 3 février. »). Aucune félicitation, aucun chiffre, aucune jauge (FR-031).
  - [x] Vue liste : l'état reste écrit **en toutes lettres** (jamais la couleur seule) ; `LIBELLE_ETAT` s'aligne sur (D2).
  - [x] **Aucune animation de changement d'état** — garde de comportement dans le projet `rendu` : monter avec un état supérieur ne déclenche ni transition, ni keyframe, ni classe d'apparition.

- [x] **T6 — Les gardes** (AC: 1, 2, 3, 4, 6, 7)
  - [x] `tests/cycle-branche.test.ts` — la fonction pure : monotonie, refus de régression, idempotence, pas d'incrément.
  - [x] `tests/branche-cycle-sql.test.ts` — **contre la vraie base** : régression `etat`, régression `intensite`, réécriture de date, forge de `rayonnement` par `progresser_feuillaison`, **et les mêmes tentatives en `service_role`** (isole le trigger seul — sans ça la mutation ne meurt pas).
  - [x] `tests/retour-theme.test.ts` — parser pur, doute → non ; **AC7** : aucun `nom` dans le payload.
  - [x] `tests/retour-theme-pipeline.test.ts` — suppression en détresse/72 h, repli sûr, métrage, aucun 500.
  - [x] `tests/rayonnement-endpoint.test.ts` — 401, isolation, idempotence.
  - [x] **Garde d'architecture** : `declarer_rayonnement` n'a **qu'un seul appelant** (le dépôt appelé par la route du geste) ; **aucun** module de `lib/safety/` ni de pipeline ne le référence — c'est ça, « jamais inféré ».
  - [x] **Garde d'architecture** : aucun module hors `lib/domain/cycle-branche.ts` ne calcule une transition d'état (miroir de la garde « un seul appelant de `requeteReconceptualisation` », 4.4).
  - [x] `tests/rendu/arbre-cycle.test.tsx` — le changement est **déjà là**, sans animation (AC5).
  - [x] **Mutation-vérifier** au minimum : la garde de monotonie du trigger, l'interdiction d'écrire `rayonnement` depuis `progresser_feuillaison`, la garde AD-17 du pipeline, la garde art. 9 du payload.

## Dev Notes

### Le fait le plus important

**C'est la première story qui écrit `etat` et `intensite`.** 4.5 et 4.6 les ont volontairement **épinglés** (`etat='naissance' and intensite=0`) **à deux endroits** : la policy `branche_insertion` et le trigger `branche_garde_renommage` — précisément pour qu'aucune écriture prématurée ne puisse forger un rayonnement que l'utilisatrice n'a jamais déclaré. Relâcher **un seul** des deux donne une feuillaison silencieusement refusée ; relâcher **trop** rouvre la faille HAUTE reproduite en live pendant la revue 4.6 (un `.from("branche").insert({etat:'fruit'})` direct qui passait, de façon **irréversible**).

Le relâchement correct : la **naissance** reste épinglée (une branche naît toujours nue), et seul le **chemin UPDATE** s'ouvre — sous une garde de **monotonie**, pas sous une absence de garde.

### Le cœur en une phrase

`feuillaison` est un **continuum inféré** qui monte tout seul quand elle revient d'elle-même ; `rayonnement` est un **événement qu'elle déclare**. Les deux se lisent dans le dessin, **aucun des deux ne se lit dans un chiffre** (EXPERIENCE L251, FR-031).

### D1 — Comment se détecte le « retour spontané sur le thème » — **TRANCHÉ (PO, 2026-08-04) : hybride**

FR-028 : *« la feuillaison s'amorce lorsque l'utilisatrice revient spontanément sur le thème de la branche au fil des semaines »*. Rien dans le code actuel ne sait faire ça. Trois options ont été pesées :

| Option | Ce que ça donne | Le vrai coût |
|---|---|---|
| **A — déterministe seul** (recouvrement lexical extrait ⋂ tour) | 0 appel modèle, 0 egress, totalement testable | **Rate la paraphrase** — « ma mère » / « maman », « j'ai osé dire non » / « j'ai posé une limite ». C'est précisément ce cas-là qui compte. |
| **B — modèle fort seul** | Précision réelle sur la paraphrase | Un 5ᵉ appel fort par tour, payload qui grossit avec le nombre de branches |
| **C — hybride (recommandé)** | Présélection déterministe ≤3 candidats, puis **une** confirmation forte | Coût borné, surface art. 9 bornée, précision conservée |

**Décision PO : C.** Et une raison décide, plus que le coût : **l'effet est irréversible**. `intensite` ne redescend jamais. Un faux négatif retarde un épaississement de trait ; un faux positif inscrit **définitivement** dans son arbre qu'elle est revenue sur un thème qu'elle n'a pas abordé. L'asymétrie impose la **précision** avant le rappel — donc « en cas de doute, non », et un juge capable de lire une paraphrase.

**Contrainte dure qui tombe ici (AC7) :** le `nom` de branche **ne transite jamais vers un modèle** (0021 L7-L9). La comparaison se fait donc sur les **extraits source** (`entree_journal.contenu`), qui transitent déjà légitimement sous `envoyerSousEgressArt9`. Le modèle renvoie des **indices**, jamais des noms ; le mapping indice → branche se fait côté serveur.

### D2 — Renommer l'enum SQL `fruit` → `rayonnement` — **TRANCHÉ (PO, 2026-08-04) : renommer en 0025**

Les specs produit ont été réécrites (PRD FR-028, DESIGN L586/L601, epics) : le troisième état est le **rayonnement**, plus jamais un fruit. Le code garde `'fruit'` en base et **traduit à l'affichage** (`copie-arbre.ts` L13). L'ARCHITECTURE-SPINE (L150, AD-8) n'a pas été mise à jour et dit encore `fruit` — **divergence spec/spec à signaler**.

**Décision PO : renommer maintenant, en 0025.** C'est le **dernier moment gratuit** — aucune ligne ne porte `'fruit'` (4.5/4.6 n'écrivent que `naissance`) et 4.7 est justement la story qui écrit cette valeur pour la première fois. Sinon la traduction devient permanente, et chaque futur lecteur du SQL doit savoir que `fruit` veut dire « rayonnement » alors que le produit a explicitement banni la métaphore du fruit. Coût : `EtatBranche`, `ORDRE_ETAT`, `LIBELLE_ETAT`, `ArbreInteractif` L413, la vue liste, les tests. Petit et mécanique.

### D3 — La déclaration de rayonnement pendant un épisode de détresse — **TRANCHÉ (PO, 2026-08-04) : bloquer aussi**

Ni l'epic ni le PRD ne tranchaient. Les deux lectures se défendaient :

- **Laisser passer** — c'est **son** geste sur **sa** vie ; le bloquer est paternaliste, et l'interface devrait expliquer un refus qu'elle ne comprendrait pas.
- **Bloquer (retenu)** — AD-17 interdit déjà qu'une branche **naisse** pendant un épisode + 72 h, exactement parce qu'un basculement vécu en crise n'est pas un basculement stable. Or **le rayonnement est irréversible** : rien ne peut le retirer, sauf l'effacement. Laisser entrer en pleine lumière une branche pendant la fenêtre où l'on interdit d'en faire naître une est incohérent — et l'erreur ne se répare pas.

**Attention à la confusion à ne pas faire :** AD-9 (« jamais de paywall sur la sécurité ») protège l'**accès aux haltes**, pas les gestes produit. Bloquer une déclaration n'est pas bloquer un filet de sécurité.

La garde vit au **point d'écriture** (`declarer_rayonnement` appelle `branche_bloquee_par_detresse()`), jamais dans la seule UI, et le libellé doit dire quelque chose de vrai et de doux — jamais « indisponible ».

### Ce qu'on RÉUTILISE (ne pas réinventer)

| Besoin | Ce qui existe déjà | Où |
|---|---|---|
| Pipeline modèle fort post-réponse | `evaluerReconceptualisationDuTour` — garde AD-17, budget de délai, egress art. 9, métrage, repli sûr | `lib/safety/reconceptualisation-pipeline.ts` |
| Instruction + parser purs | `INSTRUCTION_RECONCEPTUALISATION` / `detecterReconceptualisation` (dernière ligne conforme, doute → `false`) | `lib/domain/reconceptualisation.ts` |
| Garde détresse au point d'écriture | `branche_bloquee_par_detresse()` | migration 0010, utilisée en 0021 L167 |
| Trigger anti-résurrection / transitions légales | `signal_reconceptualisation_garde_transition` | migration 0021 L132 |
| Ordre monotone des états | `ORDRE_ETAT` (à **faire importer**, pas à dupliquer) | `lib/scene/projection.ts` L56 |
| Affordance « oui/non » explicite d'Anam | `PropositionBranche.tsx` (4.5) | `render/conversation/` |
| RPC qui ne réussit plus en silence | patron `renommer_branche` + `get diagnostics` | migration 0023 §6 |
| Journalisation sans art. 9 | `journaliserIncidentSecurite`, `codeJournalisable` | `lib/safety/rpc-repli.ts` |
| Filet anti-régression au rendu | `reconcilierProjection` — **le garder**, il ne doit juste plus jamais mordre | `lib/scene/projection.ts` |

### Ce que 4.7 ne fait PAS

- **FR-030** (« plusieurs branches ouvertes sans intégration → Anam propose d'en faire vivre une ») = **Story 4.10**, pas ici.
- **L'illumination sémantique** (racines = ancrage / branches = liberté) reste **PARQUÉE** pour Sanela — ne pas implémenter.
- Le dessin fin de la feuillaison (feuilles individuelles, opacités 0.78→1.0, DESIGN L584) reste au niveau livré en 4.6 ; 4.7 câble la **donnée**, pas une refonte graphique.
- La densité de l'arbre au-delà d'une quinzaine de branches (ramification) reste ouverte — voir `deferred-work.md`.

### Pièges connus, coûteux si redécouverts

- **La défense en profondeur masque la mutation** : policy + trigger sur le même invariant ⇒ un test JWT ne prouve **jamais** lequel des deux mord. Passer par `service_role` (hors RLS) pour isoler le trigger. *(mémoire `gardes-doivent-tuer-leur-mutant`)*
- **`NaN` en `real`** : `intensite <= 1` exclut `NaN` (NaN > tout réel en Postgres) ; `intensite = intensite` ne l'exclut **pas**. Déjà borné par 0023 §3 — ne pas défaire.
- **Une garde par liste de mots est fausse dans les deux sens** : pour « aucun chiffre affiché », interroger le **DOM rendu**, pas les identifiants du code.
- **`create or replace` ne revalide pas les lignes existantes** — si un CHECK change, réparer explicitement (patron 0023 L98).
- **Le WITH CHECK ne voit que la ligne NEW**, jamais quelles colonnes ont changé : toute règle « telle colonne ne bouge pas » appartient au **trigger**, pas à la policy.

### Project Structure Notes

Nouveaux : `supabase/migrations/0025_branche_cycle_vie.sql`, `lib/domain/cycle-branche.ts`, `lib/domain/retour-theme.ts`, `lib/safety/retour-theme-pipeline.ts`, route du geste de déclaration. Modifiés : `lib/scene/projection.ts` (nouveaux champs de date + `ORDRE_ETAT` exporté), `lib/data/depot-branche.ts`, `app/api/anam/message/route.ts`, `render/arbre/{FicheBranche,VueListe,copie-arbre}`, `lib/ai/{port,politique-tier}.ts`. Direction des dépendances inchangée (AD-10) : `render/` → `lib/scene/` seulement ; `lib/safety/` orchestre et appelle `lib/domain/`, jamais l'inverse.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.7 (L900-L912)]
- [Source: _bmad-output/planning-artifacts/prds/prd-Anima-2026-07-21/prd.md#FR-028, FR-029, FR-031, FR-067 (L102-L105, L206)]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Anima-2026-07-22/ARCHITECTURE-SPINE.md#AD-8 (L71-L74), AD-7 (L66-L69), Data & formats (L150)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Anima-2026-07-21/EXPERIENCE.md#États d'une branche (L232-L251), parcours (L546, L574)]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Anima-2026-07-21/DESIGN.md#États d'une branche (L586, L597-L608)]
- [Source: _bmad-output/implementation-artifacts/4-6-arbre-projection-muette-fiche-branche-vue-liste.md#Dev Notes]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#L275 (ordre de relâchement pour la 4.7)]
- [Source: supabase/migrations/0021_branche.sql, 0022_branche_arbre.sql, 0023_branche_arbre_correctifs.sql]

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context) — implémentation et gardes.

### Debug Log References

- `supabase db reset` rejoue **0001→0025** proprement (vérifié deux fois, dont après le renommage de l'enum).
- Commande de suite : `set -a && . ./.env.local && set +a && npx vitest run`.

### Completion Notes List

**Ce qui a été livré.** La monotonie de l'arbre vit désormais **à l'écriture**, dans le trigger
`branche_garde_cycle` — le seul endroit qui connaît la ligne *précédente*, donc le seul qui puisse
garantir FR-029. Aucun écrivain, JWT ou `service_role`, ne peut faire reculer `etat` ou `intensite`, ni
réécrire une date de transition posée. La feuillaison progresse **par degrés** au rythme des retours
(un par jour civil Paris au plus, idempotent par le ledger `branche_retour`), et la pleine lumière n'est
atteignable **que** par le geste de l'utilisatrice.

**Trois choses valent d'être retenues, parce qu'elles ont changé le code :**

1. **Un fast-fail qui ne mourait pas.** Le garde AD-17 de `declarer_rayonnement` a **survécu à sa
   mutation** une fois la clause de détresse posée dans le trigger : plus aucun test ne pouvait le tuer,
   parce qu'il n'apportait plus rien d'observable. Il a été **retiré** plutôt que gardé décoratif. Une
   garde qu'aucun test ne peut tuer n'est pas une garde, c'est un commentaire exécutable.

2. **La garde AD-17 ne pouvait pas vivre dans la policy.** `branche_maj` est partagée avec le renommage :
   y mettre `not branche_bloquee_par_detresse()` aurait rendu impossible de **renommer** une branche
   pendant un épisode — absurde et cruel. Elle vit donc dans le trigger, qui couvre tous les écrivains
   sous JWT sans toucher au droit de parole. Un test de contrôle positif verrouille ça.

3. **Ce que la garantie ne couvre PAS, dit explicitement.** L'utilisatrice qui ouvrirait sa console
   pourrait avancer son propre arbre par un UPDATE direct. Le verrouiller (drapeau de transaction,
   privilège de colonne) coûterait la **testabilité de la monotonie** — plus aucun chemin ne pourrait
   tenter une régression, donc plus aucun test ne pourrait tuer le mutant de la garde qui compte. Le
   choix est documenté en tête de `0025` et dans le fichier de test, pas laissé implicite.

**Mutation-vérifié** (garde retirée → rouges comptés → restaurée → re-run vert) :

| Garde | Où | Rouges |
|---|---|---|
| Monotonie de l'état | trigger `branche_garde_cycle` | 1 |
| Monotonie de l'intensité | trigger | 1 |
| Dates de transition write-once | trigger | 1 |
| AD-17/FR-046 « l'arbre ne pousse pas en détresse » | trigger | 3 |
| Fast-fail AD-17 (message clair) | `progresser_feuillaison` | 1 |
| Garde AD-17 du pipeline | `retour-theme-pipeline` | 2 |
| [AC7] le `nom` ne part pas au modèle | `requeteRetourTheme` | 2 |
| [AC3] aucun pipeline ne déclare le rayonnement | garde d'architecture | 2 |

*Une mesure a d'abord été fausse* : la boucle de restauration réappliquait un fichier périmé d'une série
antérieure, ce qui contaminait deux mutants. Refaite proprement, elle donne les chiffres ci-dessus.

**Chiffres.** 1439 tests verts / 126 fichiers (plancher 4.6 : 1346 / 120). `tsc`, `eslint`, `next build`
propres. `supabase db reset` rejoue 0001→0025.

**Reste ouvert / à valider avant mise en ligne :**
- `PAS_FEUILLAISON = 0,2` et `INSTRUCTION_RETOUR_THEME` sont des **placeholders produit**, au même titre
  qu'`INSTRUCTION_RECONCEPTUALISATION` — à éprouver sur données réelles.
- La présélection lexicale est volontairement **large** (un mot porteur commun suffit) : c'est le modèle
  qui tranche. Si le coût des appels forts devient un sujet, c'est le premier levier à resserrer.
- L'ARCHITECTURE-SPINE (AD-8, L150) dit encore `fruit` : à mettre à jour, la base et le code disent
  `rayonnement` depuis 0025.

### File List

**Nouveaux**
- `supabase/migrations/0025_branche_cycle_vie.sql`
- `lib/domain/cycle-branche.ts`
- `lib/domain/retour-theme.ts`
- `lib/safety/retour-theme-pipeline.ts`
- `tests/branche-cycle-sql.test.ts`
- `tests/cycle-branche.test.ts`
- `tests/retour-theme.test.ts`
- `tests/retour-theme-pipeline.test.ts`
- `tests/cycle-architecture.test.ts`
- `tests/rendu/arbre-cycle.test.tsx`

**Modifiés**
- `lib/scene/projection.ts` (enum `rayonnement`, `ORDRE_ETAT` exporté, dates de transition)
- `lib/data/depot-branche.ts` (dates, candidats, progression, déclaration)
- `lib/safety/projection-arbre.ts` (dates remontées à la scène)
- `lib/ai/port.ts`, `lib/ai/politique-tier.ts` (capacité `retour_theme` → fort)
- `app/api/anam/message/route.ts` (étage retour sur le thème dans `after()`)
- `app/api/anam/branche/route.ts` (action `rayonnement`)
- `render/arbre/FicheBranche.tsx`, `render/arbre/copie-arbre.ts`, `render/arbre/ArbreInteractif.tsx`,
  `render/arbre/arbre.module.css`, `render/scene-dom.tsx`
- `tests/branche.test.ts`, `tests/branche-renommage.test.ts`, `tests/projection-arbre.test.ts`,
  `tests/arbre-rendu.test.ts`, `tests/rendu/arbre-sans-mesure.test.tsx` (assertions que 4.7 change)

## Change Log

| Date | Version | Description | Auteur |
|---|---|---|---|
| 2026-08-04 | v1.0 | Création de la story (analyse epics/PRD/SPINE/UX + code 4.5/4.6 livré). Trois décisions load-bearing posées : D1 (détection du retour sur le thème), D2 (renommage de l'enum `fruit` → `rayonnement`), D3 (déclaration pendant un épisode de détresse). | Claude Opus 5 |
| 2026-08-04 | v1.1 | **D1 = hybride** (présélection déterministe + confirmation par le modèle fort), **D2 = renommer en 0025**, **D3 = bloquer aussi la déclaration pendant l'épisode + 72 h**. Tranchées par le PO. | Julian (PO) |
| 2026-08-04 | v2.0 | Implémentation complète (T1→T6). 1439 tests verts, 8 gardes mutation-vérifiées, un fast-fail retiré parce qu'il survivait à sa mutation. Statut → review. | Claude Opus 5 |
