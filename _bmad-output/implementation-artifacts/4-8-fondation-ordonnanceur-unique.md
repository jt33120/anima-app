---
baseline_commit: 04d4198
---

# Story 4.8 : La fondation de l'ordonnanceur unique

Status: review

<!-- Story créée le 2026-08-05, après la 4.7 (CI verte 30982420668, 1482 tests). C'est la première story
     d'INFRASTRUCTURE de l'Epic 4 : elle ne livre rien de visible à l'utilisatrice. Sa valeur est négative
     au sens strict — elle empêche. Elle empêche qu'un second rythme apparaisse, qu'un job s'exécute deux
     fois, qu'un déploiement de préversion efface les données de la prod. Trois choses qu'on ne voit que
     quand elles ont déjà eu lieu. -->

## Story

En tant qu'équipe Anam responsable de la fiabilité et de la conformité, je veux **fonder l'ordonnanceur unique** (Vercel Cron) qui possède tous les jobs périodiques et les exécute de façon idempotente, afin que la synthèse (Story 4.9) et les rappels d'échéance (Story 4.10) s'appuient sur lui **sans dépendre d'un epic ultérieur** — l'Epic 4 devenant livrable de façon autonome.

**Couvre :** section Opérations (Ordonnanceur unique), AD-14 (exécution périodique possédée) · fondation transverse, aucun FR de contenu direct.

## Acceptance Criteria

- **AC1** — **Étant donné** que le produit a besoin d'un mécanisme périodique (notifications de rythme, rétention, synthèse), **Quand** ce mécanisme est ajouté, **Alors** il est enregistré comme job de l'ordonnanceur unique, **Et** aucun mécanisme périodique n'existe hors de cet ordonnanceur — ni `setInterval` applicatif, ni cron dispersé, ni tâche déclenchée côté client.
- **AC2** — **Étant donné** un job planifié, **Quand** il est rejoué (même fenêtre, ou reprise après échec), **Alors** son effet est idempotent grâce à une clé d'exécution qui empêche tout double effet, **Et** une trace d'exécution est écrite sans aucune donnée art. 9 en clair.
- **AC3** — **Étant donné** deux environnements isolés (dev / prod), **Quand** un job accède aux données, **Alors** il n'opère que sur le projet Supabase de son propre environnement, **Et** la donnée de prod ne rejoint jamais un environnement de dev.
- **AC4** — **Étant donné** la CI, **Quand** une modification introduit un mécanisme périodique hors de l'ordonnanceur, **Alors** un test de garde échoue et casse le build.
- **AC5** — **Étant donné** qu'un job échoue, **Quand** l'échec survient, **Alors** il est réessayable sans double effet, **Et** une alerte de santé de l'ordonnanceur est levée sans exposer de contenu art. 9.

## Tasks / Subtasks

- [x] **T1 — Le domaine pur de la cadence** (AC2) — `lib/domain/ordonnanceur.ts`
  - [x] `Cadence` (`quotidien` | `hebdomadaire`), `fenetreDe(cadence, instant)` → clé déterministe en **Europe/Paris** (`2026-08-05`, `2026-W32`)
  - [x] `estEnRetard(job, derniereReussite, naissanceSysteme, instant)` — **`estDu` NON livrée, volontairement** : la réclamation atomique EST la décision, la dupliquer en mémoire aurait fait diverger deux réponses à la même question (voir Completion Notes)
  - [x] Tests purs : bascule de fenêtre à minuit Paris, passage à l'heure d'été, semaine ISO à cheval sur l'année
- [x] **T2 — La migration `0027_ordonnanceur.sql`** (AC2, AC3, AC5)
  - [x] Table `environnement` (ligne unique, `local` | `preview` | `production`), RLS deny-by-default, trigger anti-suppression — **cliquet anti-rétrogradation retiré** après examen (voir Completion Notes)
  - [x] Table `execution_job` (`job`, `fenetre`, `cible_id`, `statut`, `tentatives`, `bail_expire_le`, `motif_echec` borné) + index unique `nulls not distinct`
  - [x] Table `incident_systeme` (`type`, `job`, `detail`, `jour` Paris) + index unique de dédup — une alerte par job et par jour
  - [x] RPC `reclamer_execution` (réclamation ATOMIQUE avec bail) et `clore_execution`
  - [x] Aucune colonne de contenu : preuve art. 9 par la structure
- [x] **T3 — Le dépôt** (AC2) — `lib/data/depot-ordonnanceur.ts`
  - [x] `environnementDeclare` / `reclamer` / `clore` / `etat` / `leverIncident` + `santePublique` (l'état agrégé pour `/api/health`)
- [x] **T4 — La garde d'environnement** (AC3) — `lib/ordonnanceur/environnement.ts`
  - [x] Compare `ANIMA_ENV` du déploiement à l'environnement **déclaré par la base** ; désaccord → refus TOTAL, aucun job
  - [x] Repli sûr : base muette ou illisible → refus (jamais « on continue »)
- [x] **T5 — Le registre et le répartiteur** (AC1, AC2, AC5) — `lib/ordonnanceur/registre.ts`, `lib/ordonnanceur/executer.ts`
  - [x] Un registre déclaratif ; le répartiteur réclame, exécute sous délai borné, clôt
  - [x] Un job qui échoue n'empêche pas les autres ; sa fenêtre reste réclamable au tick suivant
- [x] **T6 — La porte** (AC1, AC3) — `app/api/ordonnanceur/route.ts` + `vercel.json`
  - [x] `Authorization: Bearer $CRON_SECRET`, comparaison à temps constant, 401 sinon
  - [x] Secret absent → refus (jamais de porte ouverte), 503
  - [x] `vercel.json` : **exactement une** entrée `crons`
- [x] **T7 — Le job de santé** (AC5) — `lib/ordonnanceur/jobs/sante.ts`
  - [x] Vérifie chaque job enregistré ; en retard → `incident_systeme` (jamais d'art. 9)
  - [x] `/api/health` expose `ordonnanceur: "ok" | "degrade" | "inconnu"` — **aucun nom de job, aucun horodatage**
- [x] **T8 — Les gardes d'architecture** (AC1, AC4) — `tests/ordonnanceur-architecture.test.ts`
  - [x] Aucun `setInterval` dans `lib/`, `app/`, `render/`
  - [x] Aucun `pg_cron` / `cron.schedule` dans les migrations
  - [x] `vercel.json` ne déclare qu'un seul cron, et il pointe sur la porte unique
  - [x] Le répartiteur n'a qu'un seul appelant applicatif : la porte
  - [x] Chaque garde **tue son mutant** (mémoire `gardes-doivent-tuer-leur-mutant`)

## Dev Notes

### Le fait le plus important

**Rien de tout ceci n'est encore branché sur Vercel.** L'app n'est pas déployée (aucun projet `anima-app` sur le compte Vercel au 2026-08-05). Le `vercel.json` est donc une **déclaration en attente** : correcte, versionnée, vérifiée par un test — mais qui ne déclenchera rien tant que le premier déploiement n'aura pas eu lieu. C'est assumé et c'est le bon ordre : on fonde la mécanique et ses preuves maintenant, on branche le déclencheur au déploiement.

Conséquence directe sur la conception : **tout doit être prouvable sans Vercel.** La porte est une route HTTP ordinaire, testable avec un `Request` fabriqué ; la réclamation est une RPC Postgres, testable contre le Supabase local ; la garde d'environnement est une comparaison de deux valeurs lisibles. Aucune preuve ne dépend d'un service tiers.

### Le cœur en une phrase

Un ordonnanceur, c'est une **porte**, un **registre** et une **réclamation**. La porte dit qui a le droit d'entrer. Le registre dit ce qu'il y a à faire. La réclamation dit qui l'a déjà fait — et c'est elle, pas la porte, qui garantit qu'un rejeu ne produit pas de second effet.

### D1 — La porte : répartiteur unique — **TRANCHÉ (PO, 2026-08-05)**

Une seule route `/api/ordonnanceur` que Vercel Cron appelle ; le registre des jobs vit dans le code et le répartiteur exécute ceux qui sont dus.

Pourquoi, au-delà de la simplicité : l'AC1 demande de prouver qu'**aucun** mécanisme périodique n'existe ailleurs. Une propriété de non-existence se prouve mal ; elle se prouve nettement mieux quand il n'y a **qu'une seule porte** à surveiller. Avec une route par job, la garde CI devrait énumérer les portes légitimes — c'est-à-dire maintenir la liste de ce qu'elle est censée détecter, ce qui est exactement le genre de garde qui se périme en silence.

Bénéfice secondaire : le plan Hobby de Vercel plafonne à 2 crons avec une granularité quotidienne. Le répartiteur unique tient dans ce plafond quel que soit le nombre de jobs.

Coût assumé : un job lent mange le budget d'exécution des autres. On borne donc **chaque job** par un délai (`avecDelai`, déjà en place dans `lib/ai/`), et un dépassement clôt le job en échec sans empêcher les suivants.

### D2 — L'isolation dev/prod : marqueur d'environnement en base — **TRANCHÉ (PO, 2026-08-05)**

Chaque projet Supabase déclare son environnement dans une table à ligne unique. Le répartiteur compare `ANIMA_ENV` (du déploiement) à cette valeur (de la base). Désaccord → **aucun job ne tourne**.

Le scénario que ça tue, et qui justifie à lui seul la table : une préversion Vercel dont on a collé par erreur l'URL Supabase de prod dans les variables d'environnement. Sans marqueur, tout fonctionne « normalement » — jusqu'au jour où l'Epic 6 branche la rétention sur cet ordonnanceur et qu'un déploiement de test **efface des données réelles**. Les variables d'environnement ne prouvent rien à l'exécution ; le marqueur, si.

La migration amorce la valeur à `local`. Un projet cloud doit être **explicitement promu** en `production` — une étape manuelle, une fois. Si on l'oublie, le déploiement de prod refuse de tourner. C'est le bon sens de l'échec : il refuse au lieu d'effacer.

### D3 — L'alerte de santé : table en base + `/api/health` — **TRANCHÉ (PO, 2026-08-05)**

Un job de santé vérifie que chaque job enregistré a bien tourné dans sa fenêtre et écrit une ligne `incident_systeme` sinon. `/api/health` expose un état **agrégé** — `ok` / `degrade` / `inconnu` — et **rien d'autre** : ni nom de job, ni horodatage, ni compteur. La route est publique et non authentifiée ; ce qui y transite doit être inutile à un attaquant.

Écarté : le canal externe (courriel). Il alerterait vraiment, mais ajoute un sous-traitant, une clé et une porte pré-lancement pour une valeur nulle tant que le produit n'a pas d'utilisatrice. À rouvrir au lancement.

### Le piège de l'auto-référence du job de santé

Le job de santé est lui-même un job. Deux façons de se tromper :

1. **Alerter sur un job qui n'a jamais tourné** — au premier déploiement, tous les jobs sont « en retard » et l'ordonnanceur s'alerte lui-même sur toute la ligne. Bruit pur, le jour où on a le moins envie de bruit.
2. **Ne jamais alerter sur un job qui n'a jamais tourné** — c'est pourtant exactement la panne qu'on veut voir : un job enregistré mais jamais exécuté.

La règle retenue tient les deux : on compare à la **naissance du système** (l'exécution la plus ancienne connue, toutes lignes confondues). Un job sans aucune réussite n'est en retard que si le système, lui, vit depuis plus longtemps que la tolérance de ce job. Au premier tick, la naissance est « maintenant » → rien n'est en retard. Une semaine plus tard, un job jamais exécuté est en retard → alerte.

### La réclamation : au-moins-une-fois avec bail, pas au-plus-une-fois

L'AC2 (« rejoué → idempotent ») et l'AC5 (« réessayable sans double effet ») ne demandent pas la même chose et se contredisent si on les lit vite :

- Marquer l'exécution **après** le travail → un plantage en cours de route laisse la fenêtre libre, le job rejouera : **double effet**.
- Marquer l'exécution **avant** le travail → un plantage laisse la ligne coincée « en cours » et la fenêtre n'est **jamais** réessayée.

La sortie est le **bail** : on réclame avant (`en_cours` + `bail_expire_le`), on clôt après (`reussi` ou `echoue`). Une ligne `en_cours` dont le bail a expiré est réclamable à nouveau — un plantage franc coûte au plus un bail d'attente. Une ligne `reussi` n'est **jamais** re-réclamable : c'est là que vit l'idempotence de la fenêtre.

`(job, fenetre, cible_id)` en index unique `nulls not distinct` : `cible_id` vaut `null` pour un job global et l'identifiant de l'utilisatrice pour un job par utilisatrice (4.9, 4.10). **Attention** — sans `nulls not distinct`, Postgres considère deux `null` comme distincts et l'index ne dédoublonnerait rien pour les jobs globaux. C'est le genre de faille qui ne se voit jamais en test unitaire et se voit une fois en production, sous la forme d'un job global exécuté deux fois.

### Ce qu'on RÉUTILISE (ne pas réinventer)

| Besoin | Existant | Où |
|---|---|---|
| Client Supabase système | `createSupabaseAdminClient()` (`service_role`) | `lib/data/supabase/admin.ts` |
| Borner un appel dans le temps | `avecDelai` | `lib/ai/` (patron 4.4/4.7) |
| Journaliser un incident sans art. 9 | `journaliserIncidentSecurite` | `lib/safety/rpc-repli.ts` |
| RLS deny-by-default (aucune policy) | patron `probe` / `usage_ia` | `0001`, `0008` |
| Idempotence par clé + index unique | patron `usage_ia`, `evenements_traites` | `0008`, `0013` |
| Fenêtre journalière Paris | `jour_paris` | `0025` (`branche_retour`) |

### Ce que 4.8 ne fait PAS

- **Aucun job de contenu.** Ni synthèse (4.9), ni rappel d'échéance (4.10), ni rétention (Epic 6). Le seul job enregistré est celui de santé — explicitement demandé par l'AC5.
- **Aucune notification.** L'infrastructure de notification (web push) n'existe pas ; elle relève de l'Epic 5.
- **Aucun branchement Vercel effectif.** Voir « Le fait le plus important ».
- **Aucune interface.** L'ordonnanceur n'a pas d'écran. `/api/health` n'est pas un tableau de bord.

### Pièges connus, coûteux si redécouverts

1. **`date_trunc` sur `timestamptz` n'est pas immuable** — impossible à mettre dans un index d'expression. D'où une colonne `jour date` avec un défaut `(now() at time zone 'Europe/Paris')::date`.
2. **Vercel Cron émet des `GET`**, pas des `POST`. La porte doit donc répondre en `GET` — et donc refuser toute exécution sans le secret, puisqu'un `GET` est ce qu'un navigateur émet le plus facilement.
3. **Comparaison de secret à temps constant.** Une comparaison `===` sur une chaîne fuit sa longueur et son préfixe par le temps de réponse. `timingSafeEqual` sur des tampons de même longueur.
4. **La garde « aucun `setInterval` » doit ignorer les commentaires** — piège déjà payé deux fois (4.6, 4.7) : un mot dans un commentaire n'est pas un appel, et une garde qui les confond ment dans les deux sens.
5. **`nulls not distinct` exige PostgreSQL 15+.** Local et cloud sont en 17.6 (vérifié le 2026-08-05).

### Project Structure Notes

`lib/domain/ordonnanceur.ts` reste **pur** (AD-1) : aucune importation de `next`, `@supabase/*` ou `@/lib/data/*` — la règle ESLint le vérifie déjà pour tout `lib/domain/**`. Le câblage vit dans `lib/ordonnanceur/`, qui a le droit de descendre vers `lib/data/`.

### References

- `_bmad-output/planning-artifacts/epics.md` — Story 4.8, et Epic 6 (« s'appuie sur la fondation de la Story 4.8, ne la recrée pas »)
- `ARCHITECTURE-SPINE.md` — Opérations § Ordonnanceur ; AD-14 (rétention logée sur l'ordonnanceur possédé)
- `deferred-work.md` — les trois consommateurs en attente : suppression de la notif du lendemain (2.6), rédacteur du résumé glissant (4.4/4.9), notification push d'ouverture de branche (4.5)

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context).

### Completion Notes List

**1. `estDu` n'existe pas — et c'est le meilleur choix de la story.** Le premier découpage prévoyait une fonction pure « ce job est-il dû ? », puis une réclamation en base. Deux réponses à la même question, dans deux langages, avec deux horloges. Elles auraient divergé — pas tout de suite, mais au premier changement de cadence. La réclamation atomique EST la décision : on tente, et le `false` répond « déjà fait » sans qu'aucun code applicatif n'ait eu à le savoir. Le domaine pur ne garde donc que ce que la base ne peut pas dire : la clé de fenêtre et le retard.

**2. Le cliquet anti-rétrogradation du marqueur d'environnement a été écrit, testé, puis retiré.** Il interdisait de repasser de `production` à autre chose. Il a mordu au premier essai — bon signe — et c'est en le contournant pour tester la suite que le problème est apparu : il crée une **porte à sens unique dans toute base de test**. Un test qui promeut en `production` empoisonne la base pour tous les suivants, et la première chose qu'on aurait faite, c'est ouvrir une trappe pour la rouvrir. Une garde qu'on doit contourner pour se tester est une garde qui finit contournée en production. Examen fait : la menace n'existait pas non plus — rétrograder exige `service_role` (qui peut déjà tout), et la conséquence serait que la prod REFUSE de tourner, un échec sûr et sans perte. Le raisonnement complet est dans l'en-tête de `0027`, à l'endroit où quelqu'un se demandera pourquoi le cliquet manque.

**3. Le mutant qui a survécu, et ce qu'il a révélé.** `lever_incident` sans son `on conflict do nothing` passait le test de dédup — parce que l'index unique dédoublonne alors en **levant**, ce qui donne le même compte de lignes. Deux défenses couvraient le même invariant et le test ne pouvait pas dire laquelle était à l'œuvre (le piège de la défense en profondeur). La différence observable est l'**erreur**, pas le compte — et elle est loin d'être cosmétique : le job de santé lève ses incidents en série, donc un second appel qui lance ferait tomber l'organe même qui surveille les pannes, sur la deuxième panne de la journée. Le test assertait le compte ; il asserte maintenant l'absence d'erreur.

**4. Une mesure de mutation était fausse, encore une fois pour une raison bête.** Le premier passage a rendu 4 survivants sur 8. Aucun n'était réel : zsh ne découpe pas `$fichiers` en mots, donc les mutants dont la vérification portait sur deux fichiers de test ne lançaient **aucun** test — et « 0 rouge » se lisait « survivant ». Corrigé en `${=fichiers}`. La leçon, la même qu'en 4.7 : **une mesure de mutation doit elle-même être vérifiée avant d'être crue**, et un survivant inattendu est d'abord une hypothèse sur l'outil.

**5. Trois copies d'`avecDelai` existaient déjà** (détecteur de détresse, reconceptualisation, retour sur le thème), identiques au libellé de rejet près. L'ordonnanceur en aurait fait une quatrième. Extraite en `lib/domain/delai.ts`, avec le motif en paramètre pour préserver les libellés existants — et une garde d'architecture qui interdit la cinquième. Une garantie qu'on recopie est une garantie qui finit par diverger d'un seul côté ; ici le côté qui diverge est celui qui décide d'un repli sûr (AD-15).

**6. Un test a été retiré pour cause de fausse preuve.** `Bearer <secret> ` avec un espace final renvoie 200 — non parce que la porte l'accepte, mais parce que `Headers` supprime les espaces de fin avant que la route ne voie l'en-tête (spécification Fetch). Le garder aurait documenté une propriété de la couche HTTP en la faisant passer pour une propriété de notre garde.

**7. Trois tests comptaient les lignes de toute la base** et rougissaient en suite complète, parce que `ordonnanceur-sql` écrit dans les mêmes tables en parallèle. Bornés au registre. Un `count(*)` global dans une suite parallèle ne mesure pas ce qu'on croit.

**Mutation-vérifié : 23 mutants, 23 tués.** 15 côté TypeScript (fenêtre parisienne, année ISO, retard, filtre d'erreur, délai, isolation des jobs, désaccord d'environnement, repli d'environnement, secret absent, comparaison par préfixe, second cron, `setInterval`, détail exposé sur `/api/health`) et 8 côté SQL (`nulls not distinct`, fenêtre réussie re-réclamable, bail, dédup d'incident, troncature du motif, `is not distinct from`, trigger de suppression, `revoke execute`).

**État final vérifié :** 1555 tests verts / 132 fichiers · `tsc --noEmit` propre · `eslint .` propre · `npm run build` propre · `supabase db reset` rejoue 0001→0027 · migration 0027 montée sur le cloud.

### File List

**Nouveaux**
- `supabase/migrations/0027_ordonnanceur.sql`
- `lib/domain/ordonnanceur.ts` · `lib/domain/delai.ts`
- `lib/data/depot-ordonnanceur.ts`
- `lib/ordonnanceur/environnement.ts` · `lib/ordonnanceur/registre.ts` · `lib/ordonnanceur/executer.ts` · `lib/ordonnanceur/jobs/sante.ts`
- `app/api/ordonnanceur/route.ts`
- `vercel.json`
- `tests/ordonnanceur-domaine.test.ts` (14) · `tests/ordonnanceur-sql.test.ts` (17) · `tests/ordonnanceur-endpoint.test.ts` (7) · `tests/ordonnanceur-executeur.test.ts` (15) · `tests/ordonnanceur-architecture.test.ts` (11)

**Modifiés**
- `app/api/health/route.ts` (état agrégé de l'ordonnanceur) · `tests/smoke.test.ts`
- `lib/safety/detecteur-detresse.ts` · `lib/safety/reconceptualisation-pipeline.ts` · `lib/safety/retour-theme-pipeline.ts` (copies d'`avecDelai` supprimées)
- `.env.example` (`CRON_SECRET`, `ANIMA_ENV`)

### Reste ouvert, assumé

- **Le déclencheur n'est pas branché.** `vercel.json` est correct et versionné, mais l'app n'est pas déployée — aucun tick ne partira avant le premier déploiement. À ce moment-là : régler `CRON_SECRET` et `ANIMA_ENV=production` dans Vercel, et promouvoir le marqueur du projet cloud en `production`.
- **La granularité est quotidienne.** Suffisante pour la synthèse (4.9) et les rappels d'échéance (4.10), qui portent sur des jours. Un besoin plus fin exigerait le plan Pro de Vercel — à rouvrir si 4.10 le demande.
- **`avecDelai` ne coupe pas le travail, il cesse de l'attendre.** Un job qui pend est clos en échec et sa fenêtre libérée, mais la promesse sous-jacente continue jusqu'à ce que la plateforme tue le processus. Sans effet ici (le job de santé ne fait que lire) ; à revoir quand un job écrira beaucoup — un `AbortSignal` traversant serait alors le bon outil.

## Change Log

| Date | Version | Description |
|---|---|---|
| 2026-08-05 | 0.1 | Story créée. D1/D2/D3 tranchés par le PO avant implémentation. |
| 2026-08-05 | 1.0 | Implémentée. 1555 tests verts, 23 mutants tués. Cliquet d'environnement retiré après examen ; `estDu` non livrée par choix ; `avecDelai` déduplifiée. Statut → review. |
