---
baseline_commit: a227d87bf72bc2e9e14d1d6f9f80b305ae787664
---

# Story 6.1a : La SQL de l'ordonnanceur — le jeton, l'alarme, et la preuve par l'effet

Status: review

## Story

En tant qu'équipe Anam responsable de la fiabilité et de la conformité,
je veux que la base de l'ordonnanceur sache **qui a le droit de clore une exécution**, que son alarme
puisse **se rallumer ET s'éteindre**, et que l'idempotence soit prouvée **sur un effet compté** plutôt
que sur des jobs qui ne font rien,
afin que le moteur d'effacement de l'Epic 6 ne puisse jamais purger deux fois ni tomber en silence.

**Dépend de :** la Story 6.1 (la mesure). À faire **après**.
**Bloque :** la Story 6.8 (le moteur de rétention automatique) — et la dette T6-19 le dit déjà.

---

## ⚠️ Pourquoi cette story existe séparément

Elle a été extraite de la 6.1 à la validation. Le motif est net : la 6.1 ne touche **aucune base** et
n'a **aucun test rouge planifié** ; tout ce qui suit est de la SQL, une seule migration, et deux
décisions d'architecture qu'il fallait trancher avant d'écrire une ligne. Mélangées, les deux stories
devenaient invérifiables entre deux tâches — or dans ce dépôt, `npx vitest run` doit être vert à
chaque étape.

**Une seule migration : `0052`.** Quatre sujets, mais un seul thème — *la base de l'ordonnanceur
grandit avant que la rétention ne s'appuie dessus.*

---

## Décisions tranchées avant dev

**D1 — La boucle de fermeture : le prédicat se recalcule, l'incident ne porte pas d'état.**
Deux formes étaient possibles pour qu'une alarme puisse s'éteindre : ajouter `resolu_le` à
`incident_systeme`, ou recalculer le verdict depuis `execution_job`. **On recalcule.** Un état de
résolution est un état à maintenir, donc un état qu'on laissera périmé — et il faudrait décider *qui*
l'écrit et *quand*. Le recalcul n'a rien à maintenir : la vérité est déjà dans `execution_job`.

**D2 — La fenêtre d'homme mort passe de 48 h à 60 h, alignée sur `toleranceHeures`.**
Le registre a choisi 60 h précisément pour ne jamais tomber pile sur un multiple de la cadence
(`registre.ts:63-68`, défaut n°9 de la revue 4.8) — pendant que la SQL garde **48 h en dur**, c'est-à-dire
*exactement* deux fois la cadence. Un seul tick manqué plus quelques minutes de dérive suffit à faire
hurler l'homme mort. Et sur `hobby` la dérive annoncée est de **±59 min**. Deux chiffres pour une seule
décision : on n'en garde qu'un.

**D3 — ~~La preuve par l'effet a besoin d'une table à elle, et elle vivra en production.~~
🔴 CONTESTÉE ET RETIRÉE au développement.**

La proposition d'origine : déclarer `preuve_idempotence`, table de production inerte, au motif
qu'aucune table existante ne convient — `execution_job.tentatives` compte des *réclamations*, pas des
effets ; `incident_systeme` est dédoublonné par jour (`on conflict do nothing`), ce qui **masquerait**
le défaut cherché. **Les deux constats sont exacts. La conclusion ne l'était pas.**

Ce qui manquait aux trois preuves existantes, c'est le **dépôt factice**, pas le compteur. La preuve
livrée fait donc tourner `executerOrdonnanceur` sur le **vrai** `creerDepotOrdonnanceur()`, contre le
**vrai** Postgres local, avec un job d'essai injecté par `DepsOrdonnanceur.registre` — patron déjà
appliqué dans `tests/ordonnanceur-executeur.test.ts`. L'effet est compté dans le processus de test.

Un compteur en base n'aurait rien ajouté : le test est de toute façon un seul processus, et c'est la
réclamation SQL — pas le compteur — qui décide si le job tourne. Le coût évité est une table vide en
production dont personne ne saurait, dans deux ans, pourquoi elle existe.

**La règle qu'on en tire, et qui vaut au-delà de cette story : une table ne se déclare pas pour
servir un test.**

**D4 — Le jeton se compare avec `=`, jamais avec `is not distinct from`** (décidé au développement).
La story annonçait le mutant inverse. Il est à l'envers : sur `cible_id`, `is not distinct from` est
indispensable parce que `null` y est une **valeur métier** (« job global ») ; sur le jeton, `null` ne
serait qu'une **ignorance**, et `is not distinct from` la ferait s'accorder avec elle-même. `=` échoue
fermé — la règle du dépôt. Le vrai danger n'est d'ailleurs ni l'un ni l'autre : c'est le raccourci de
compatibilité `and (p_jeton is null or jeton = p_jeton)` qu'on écrit sans y penser le jour où un
appelant n'a pas de jeton. Il ouvre une porte **exactement de la taille de la garde**, et c'est lui
qui est muté.

**D5 — `clore_execution` rend un booléen, et le refus se journalise** (décidé au développement).
`void` était le bon type tant que la clôture ne pouvait pas être refusée. Elle peut l'être. C'est la
même leçon que le chemin `deja_fait` de la 6.1 : une absence d'effet qu'on ne peut pas montrer ne vaut
pas mieux qu'un travail non fait. Sur un rejeu de purge (6.8), « la clôture a été refusée parce qu'un
autre détenait la fenêtre » est exactement la phrase à pouvoir produire.

---

## Acceptance Criteria

1. **Le jeton de propriété.** Deux exécutions concurrentes après expiration de bail ne peuvent plus
   s'écraser : seule celle qui détient la réclamation courante peut clore. Une clôture par un
   détenteur périmé est **refusée**, pas silencieusement appliquée.
2. **L'idempotence est prouvée sur un EFFET COMPTÉ**, contre le vrai Postgres, sur la clé globale
   **et** sur une clé par personne (`cible_id`) — la forme que les trois jobs de l'Epic 6 utiliseront
   exclusivement.
3. **L'alarme peut s'éteindre.** Un job réparé fait repasser `/api/health` à `ok` sans attendre deux
   jours.
4. **La fenêtre d'homme mort est alignée** sur la tolérance du registre, et l'assertion de non-recouvrement
   (`2 × intervalle + dérive ≤ fenêtre`) lit la valeur depuis la **définition courante**, jamais
   recopiée en TypeScript.
5. **L'absence d'art. 9 est structurelle**, plus une politesse d'appelant : un `CHECK` de forme sur
   `execution_job.motif_echec` et `incident_systeme.detail`.

---

## Tasks / Subtasks

- [x] **T1 — Migration `0052` : le jeton de propriété** (AC: 1)
  - [x] `reclamer_execution` rend un **jeton** (uuid) au lieu d'un booléen ; `clore_execution` le
        reçoit et n'agit que s'il correspond au jeton courant de la ligne.
  - [x] ⚠️ **`drop function` obligatoire, découvert à l'écriture.** Postgres refuse de *remplacer* une
        fonction dont le type de retour change (`boolean` → `uuid`), donc `reclamer_execution` était
        auto-protégée. Mais `clore_execution` avec un paramètre de plus n'aurait **rien remplacé** :
        `create or replace` aurait créé une **SURCHARGE**, et l'ancienne signature à cinq arguments
        serait restée publiée sur PostgREST — le contournement de la garde livré à côté d'elle. Une
        garde dédiée l'interdit désormais (`[LA PORTE À CÔTÉ]`).
  - [x] Cinq appelants repris : `lib/data/depot-ordonnanceur.ts` (l'interface), `lib/ordonnanceur/
        executer.ts` (×2), `lib/ordonnanceur/jobs/synthese.ts` (le fan-out par personne).
  - [x] Le refus de réclamation vaut désormais `null`, et le dépôt le teste **par la forme**
        (`typeof data === "string"`), pas par `?? null` — même esprit que le `=== true` d'avant :
        dans le doute, NE PAS exécuter.
  - [x] Décision **D4** : la comparaison est `=`, et le mutant annoncé par la story était à l'envers.

- [x] **T2 — Migration `0052` : la boucle de fermeture de l'alarme** (AC: 3) — décision **D1**
  - [x] Le prédicat se recalcule depuis `execution_job` : **une alarme s'éteint par une réussite
        POSTÉRIEURE à elle.** Aucune tolérance, aucun seuil, aucune valeur recopiée du registre —
        juste un ordre entre deux horodatages, et rien à maintenir.
  - [x] `cible_id is null` conservé dans la fermeture : une personne servie n'éteint pas l'alarme
        d'un fan-out mort (c'est mot pour mot le défaut n°1 de la revue 4.9).
  - [x] L'homme mort, lui, n'a **délibérément pas** de boucle de fermeture : il parle d'un
        ordonnanceur qui ne tourne plus, et dans ce monde-là il n'y a personne pour écrire la
        réussite qui l'éteindrait. C'est sa réussite à LUI qui l'éteint.
  - [x] Test SQL rouge avant la migration, vert après.

- [x] **T3 — Migration `0052` : la fenêtre d'homme mort à 60 h** (AC: 4) — décision **D2**
  - [x] `interval '48 hours'` → `interval '60 hours'`.
  - [x] La garde d'architecture lit la valeur **dans la définition courante** et vérifie la chaîne
        **dans les deux sens** : `2 × intervalle + dérive ≤ fenêtre < 3 × intervalle`. Sans la borne
        haute, « aligner » se réglerait en montant la fenêtre à l'infini — une alarme qu'on n'entend
        plus est le repli le plus tentant, et le pire.
  - [x] `DERIVE_PLANIFICATION_MS` ajoutée à `lib/domain/ordonnanceur-budget.ts` (hobby : ±59 min),
        avec une assertion qu'elle est **strictement positive** : aucun planificateur externe n'est à
        la seconde, et la poser à zéro rendrait la chaîne satisfaisable par le 48 h qu'on retire.

- [x] **T4 — Migration `0052` : l'absence d'art. 9 devient structurelle** (AC: 5)
  - [x] `CHECK` de forme sur `execution_job.motif_echec` et `incident_systeme.detail`, au vocabulaire
        exact de `lib/domain/code-erreur.ts` (deux segments minuscules, ou un code de RPC).
  - [x] ⚠️ **Un `CHECK` seul aurait été un piège**, et c'est la correction majeure apportée au plan :
        `clore_execution` s'appelle DANS un chemin d'erreur. Une contrainte qui lève y ferait perdre
        la trace de l'échec qu'on essayait justement d'enregistrer — l'erreur mangeant sa propre
        trace, et `executer.ts` laissant la ligne `en_cours`. Le repli produirait plus de dégât que le
        chemin nominal : l'exact inverse d'AD-15.
  - [x] D'où `public.code_reconnu(texte, max)` — miroir SQL de `codeDErreur`, qui **ne lève jamais**.
        Les deux défenses couvrent des chemins différents et sont mutées séparément : la fonction
        filtre ce qui passe par les RPC, la contrainte ferme l'écriture directe sous `service_role`
        (celle que le moteur de rétention de l'Epic 6 fera).
  - [x] Les lignes existantes sont **normalisées avant** que la contrainte ne soit posée.
  - [x] `lever_incident` écrit `null` au lieu de la chaîne vide : `''` aurait dû être toléré par la
        contrainte, donc un trou d'exactement un mot dans la garde qu'on vient de poser.
  - [x] Les contraintes de LONGUEUR de 0027 restent : la forme n'exprime aucune borne, la longueur
        aucun vocabulaire. Chacune tue une classe distincte.

- [x] **T5 — ~~la table de preuve~~ : décision D3 CONTESTÉE, aucune table déclarée** (AC: 2)

- [x] **T6 — La preuve par l'effet** (AC: 2) — `tests/ordonnanceur-idempotence-sql.test.ts`, 5 tests
  - [x] Vrai dépôt (`creerDepotOrdonnanceur`), vrai Postgres, job d'essai injecté par
        `DepsOrdonnanceur.registre`.
  - [x] Deux passages, même fenêtre → **un seul effet**, et la ligne le montre (`reussi`,
        `tentatives = 1` : le rejeu n'a même pas repris la main).
  - [x] **Anti-vacuité** : la fenêtre suivante refait l'effet (compteur 2, deux clés distinctes).
  - [x] Le `clore(true)` perdu en réseau : la ligne reste `en_cours` sous son bail, et un rejeu
        immédiat **ne refait rien** — le seul endroit où l'idempotence tient au BAIL et non au statut.
  - [x] Le contrôle inverse : un échec franc laisse la fenêtre réclamable, le second passage refait
        l'effet, `tentatives = 2`, motif du vocabulaire fermé.
  - [x] **Fan-out par personne** : deux cibles, un effet chacune, indépendantes ; le rattrapage ne
        ressert personne alors que le job retraverse bien sa boucle.

- [x] **T7 — Vérification et campagne de mutation**
  - [x] Suite complète, `tsc`, `eslint`, `next build`. `supabase db reset` (0001 → 0052).
  - [x] Campagne de mutation : voir le Dev Agent Record.
  - [x] Déploiement de `0052` en cloud via l'API de gestion, et vérification du schéma déployé.

---

## Dev Notes

### L'état de la dette, textuellement

> **T6-19 (résiduel) — `clore_execution` n'a toujours pas de jeton de propriété.** Les états terminaux
> sont désormais terminaux (`and statut = 'en_cours'`, migration 0035), ce qui referme le trou que la
> migration 0027 prétendait déjà fermé. Reste le cas de deux exécutions concurrentes après expiration
> de bail : les deux voient `en_cours`, la seconde clôture écrase la première. Le vrai correctif demande
> une colonne de bail et un identifiant d'exécution, donc une migration qui touche tous les appelants —
> **à faire AVANT que le moteur de rétention (Epic 6) ne s'appuie dessus.**
> — `deferred-work.md:379-384`

### ⚠️ Lire 0027 seul donne une version PÉRIMÉE

`clore_execution` durcie par **0035** ; `etat_ordonnanceur` et `sante_ordonnanceur_publique` réécrites
par **0031** (filtre `cible_id is null`, et **seul `job_en_retard` dégrade** — un `job_echoue` ne
dégrade pas). `0052` sera donc la **quatrième** définition de la sonde : raison de plus pour que la
garde de couture vise la définition courante (6.1, T6) et non un numéro.

### Doctrine du dépôt — non négociable

- **Une garde qui ne vit que dans une route, une Server Action ou une RPC ne garde rien** :
  `authenticated` détient les sept privilèges DML sur chaque table publique. Les gardes vivent dans
  les policies `WITH CHECK` ou dans des triggers.
- **Un test vert ne prouve rien tant que son mutant n'est pas mort.** Restauration depuis un
  instantané `cp`, **jamais `git checkout`**.
- **Le piège des défenses redondantes** : viser chaque garde séparément.
- **Aucune donnée art. 9 en clair dans un journal** (NFR-022) — et à partir de cette story, plus
  seulement par convention.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-6] — AC2 et AC4 de la story 6.1
- [Source: _bmad-output/implementation-artifacts/deferred-work.md:379-384] — la dette T6-19
- [Source: supabase/migrations/0027_ordonnanceur.sql:150-190] — réclamation et clôture d'origine
- [Source: supabase/migrations/0031_ordonnanceur_alarmes.sql:69-91] — la sonde publique courante
- [Source: supabase/migrations/0035] — le durcissement `and statut = 'en_cours'`
- [Source: lib/ordonnanceur/registre.ts:63-68] — pourquoi la tolérance vaut 60 h et pas 48
- [Source: vercel.com/docs/cron-jobs/usage-and-pricing, lu le 14/08/2026] — précision ±59 min sur hobby

---

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context) — `claude-opus-5[1m]`.

### Debug Log References

- `supabase db reset` (0001 → 0052) rejoué à chaque mutant SQL : c'est la seule façon de muter une
  migration honnêtement, et ça coûte ~40 s par mutant.
- Trois suites sont tombées à l'ajout du sixième paramètre, et **c'est la bonne nouvelle** :
  `synthese-sql.test.ts` avalait silencieusement le retour de ses deux RPC. Quand `clore_execution` a
  changé de signature, l'appel s'est mis à répondre « fonction introuvable », les lignes n'ont plus
  jamais été closes en `echoue`, et les trois tests du disjoncteur mesuraient un monde où rien
  n'échouait. Ils sont tombés — mais ils auraient tout aussi bien pu rester verts si le disjoncteur
  avait été écrit à l'envers. L'aide `echouer()` lève désormais.

### Completion Notes List

**Ce que la story a changé par rapport à son plan.** Trois décisions ont été prises contre le
document de contexte, et chacune est écrite plus haut :

1. **D3 retirée** — pas de table `preuve_idempotence` en production. Ce qui manquait aux preuves
   existantes était le *dépôt factice*, pas le compteur.
2. **D4** — le jeton se compare avec `=` ; le mutant annoncé par la story était à l'envers, et le
   vrai danger est le raccourci de compatibilité `(p_jeton is null or …)`.
3. **Le `CHECK` seul aurait été un piège** — une contrainte qui lève dans un chemin d'erreur fait
   perdre la trace de l'échec qu'elle protège. D'où `code_reconnu`, qui ne lève jamais, et la
   contrainte reléguée au rôle de fermeture de l'écriture directe.

**Une faute trouvée en écrivant les gardes, et qui aurait été invisible.** La garde du vocabulaire
fermé lisait **le dernier argument** de `clore(…)`. C'était juste tant que `motif` était le dernier —
et cette story lui ajoute `jeton` derrière. La garde serait restée **verte** en inspectant désormais un
uuid : elle aurait cessé de regarder ce qu'elle surveille, sans un mot. C'est exactement la faute que
la 6.1 venait de réparer sur les migrations lues par leur numéro, et elle appelle le même correctif :
ne pas figer une position, la **dériver du contrat courant** (`positionDuParametre`, qui lit la
signature dans `depot-ordonnanceur.ts` et exige au passage que l'interface et son implémentation
listent les mêmes paramètres dans le même ordre).

**⚠️ SEPT MUTANTS SUR SEIZE ÉTAIENT COMPTÉS MORTS SANS QU'AUCUN TEST NE LES AIT VUS.** La campagne
prenait le code de retour de `supabase db reset` pour « la migration a été refusée » — un critère qui a
l'air solide, et qui ne l'est pas : la pile locale rend régulièrement un **`502` au REDÉMARRAGE DES
CONTENEURS**, c'est-à-dire *après* que toutes les migrations et le seed sont passés. Reproduit à la
main sur le mutant S6 : la migration s'applique parfaitement, et le `db reset` sort quand même en
erreur.

Le verdict « TUÉ » était donc rendu par une panne d'outillage, sur des mutants qui n'avaient jamais
rencontré un seul test. **C'est la même faute que celle que cette story passe son temps à traquer —
une garde qui a l'air de garder — appliquée cette fois à l'outil qui vérifie les gardes.** Les huit
concernés ont été rejoués avec un critère qui ne peut plus confondre les deux : la migration est
réputée appliquée si la sortie contient la ligne de *seed*, qui n'est imprimée qu'après le passage de
toutes les migrations ; sinon on réessaie trois fois, parce qu'un 502 est transitoire et qu'un SQL
fautif ne l'est pas.

**La règle à retenir pour toute campagne future de ce dépôt : un mutant n'est tué que par un TEST.**
Toute autre cause de rouge — l'outillage, le réseau, un délai — doit être distinguée explicitement,
sans quoi la campagne mesure la santé de la machine et pas celle des gardes.

**Une autre du même genre, dans le test lui-même.** Le `[MÉTA]` de `definitionCourante` attendait
« 0031 » en dur. La quatrième définition de la sonde l'a fait rougir. Le figer sur « 0052 » aurait
reconstruit exactement la fragilité que `definitionCourante` existe pour tuer : l'attendu se
**recalcule** désormais, par un chemin délibérément plus bête (recherche de sous-chaîne, sans
expression rationnelle), pour que les deux implémentations ne puissent pas se tromper ensemble.

**Campagne de mutation : 24 mutants, 23 tués, 1 équivalent documenté.**

| Volet | Mutants | Issue |
|---|---|---|
| SQL (migration `0052`) | 16 | 15 tués, 1 équivalent |
| TypeScript (dépôt, répartiteur, fan-out, gardes) | 8 | 8 tués |

**Deux mutants ont d'abord survécu, et les deux ont ouvert un vrai trou** — aucun n'était un
équivalent :

- **T3 — le fan-out clôturait chaque personne avec un jeton figé.** Aucun des 41 tests de
  `synthese-job.test.ts` ne regardait le jeton par personne. Or le fan-out en détient autant que de
  personnes, et fermer la suivante avec le jeton de la précédente serait refusé en base,
  silencieusement, pour tout le monde sauf la première. Une assertion `["jeton-u1", "jeton-u2"]`
  ferme le trou.
- **T7 — le dépôt acceptait n'importe quelle réponse pour un jeton.** Contre le vrai Postgres,
  `data ?? null` et le test de forme se comportent pareil : la RPC ne rend jamais qu'un uuid ou
  `null`. Ce n'était pourtant pas une équivalence, mais un trou de couverture — et la seule façon de
  l'exercer était de faire répondre à la base ce qu'elle ne répond pas d'elle-même. Si PostgREST
  rendait `false` (régression de sérialisation, surcharge ancienne qui répondrait encore un booléen),
  `false` n'est pas `null` : le répartiteur recevrait un « jeton » et **exécuterait le job**. Sur la
  rétention de l'Epic 6, c'est une purge lancée sur une fenêtre qu'on ne détient pas. Un bloc neuf de
  `ordonnanceur-depot-borne.test.ts` mocke la réponse et tue les deux formes (`reclamer` et `clore`).

**Le seul équivalent, établi et non masqué :** `=` vs `is not distinct from` sur le jeton. Les deux
opérateurs ne divergent que si les deux côtés sont `null` — or la colonne est `not null`. Ce qui porte
la propriété, c'est ce `not null`, et **son** mutant meurt. Consigné dans `deferred-work.md`.

**Déploiement cloud** (`zlhlzoalmszohrxrnsmo`, 15/08/2026) : `0052` appliquée, `schema_migrations`
à jour, vérifié en base — `clore_execution` n'a **qu'une** signature (la surcharge à cinq arguments
n'existe pas non plus en production), `code_reconnu` est là, les deux contraintes de forme sont
posées, `jeton` est `not null`. `sante_ordonnanceur_publique()` répond `degrade` : c'est l'homme mort,
et il a raison — le projet cloud n'a **aucune** exécution (`execution_job` est vide, la porte cron
n'a jamais tourné). État antérieur à cette story, pas une régression.

### File List

**Créés**
- `supabase/migrations/0052_ordonnanceur_jeton_alarme.sql`
- `tests/ordonnanceur-idempotence-sql.test.ts`

**Modifiés**
- `lib/data/depot-ordonnanceur.ts` — l'interface (`reclamer` → jeton, `clore` → booléen + jeton)
- `lib/ordonnanceur/executer.ts` — l'aller-retour du jeton, et le refus de clôture journalisé
- `lib/ordonnanceur/jobs/synthese.ts` — idem, par personne
- `lib/domain/ordonnanceur-budget.ts` — `DERIVE_PLANIFICATION_MS`
- `tests/ordonnanceur-architecture.test.ts` — `appelsDe` / `positionDuParametre`, la garde d'homme
  mort, le `[MÉTA]` de `definitionCourante` recalculé
- `tests/ordonnanceur-sql.test.ts` — le jeton, l'alarme qui s'éteint, la forme fermée
- `tests/ordonnanceur-executeur.test.ts`, `tests/synthese-job.test.ts`, `tests/sante-job.test.ts`,
  `tests/synthese-sql.test.ts` — les dépôts factices, plus les deux gardes nées de la mutation
- `tests/ordonnanceur-depot-borne.test.ts` — le bloc « une réponse qu'on ne comprend pas n'est pas un
  feu vert »

### Change Log

| Date | Quoi |
|---|---|
| 2026-08-15 | Story implémentée. Migration `0052`. D3 contestée et retirée ; D4 et D5 ajoutées. |
