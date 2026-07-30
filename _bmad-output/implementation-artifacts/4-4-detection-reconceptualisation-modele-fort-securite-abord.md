---
baseline_commit: 2018b7d
---

# Story 4.4: La détection de reconceptualisation — modèle fort, sécurité d'abord

Status: done

## Story

En tant qu'**utilisatrice**,
je veux que **les moments où je change de regard sur moi-même soient repérés finement et jamais pendant que je vais mal**,
afin qu'**une prise de conscience ne soit proposée que quand elle m'appartient vraiment**.

## Acceptance Criteria

1. **Pipeline ordonné, sécurité d'abord (AD-16).** Étant donné un tour utilisateur, quand il entre dans le pipeline serveur, alors l'**évaluation de sécurité s'exécute EN PREMIER** (déjà en place, Story 2.3), **et** la détection de reconceptualisation ne s'exécute qu'**ensuite**, dans le même pipeline ordonné (`lib/safety/` orchestre → `lib/domain/` est pur) — **aucun détecteur n'est appelé hors de ce pipeline** (garde d'architecture, patron `pipeline.ts` = seul appelant de `detecteur-detresse`). La détection **consomme** le verdict de sécurité (jamais une 2ᵉ classification).

2. **Modèle FORT, tier résolu serveur (AD-5).** Étant donné la détection de reconceptualisation, quand elle s'exécute, alors elle utilise le modèle **fort** (jamais le léger, en aucune circonstance), le tier étant résolu par la **politique unique serveur** (`requeteReconceptualisation` déclare `capacite: "reconceptualisation"` → `tierPour` renvoie `fort`, [politique-tier.ts](../../lib/ai/politique-tier.ts)). Le coût de la détection est **métré** (produit — FR-043 n'exempte QUE la détresse), sous clé distincte `:reconcept`.

3. **[DUR / AD-17] Supprimée pendant l'épisode + 72 h — double-défense.** Étant donné un niveau de détresse ≥ 1 (épisode en cours) **OU** un tour dans les **72 h** suivant l'extinction, quand un tour est traité, alors la sortie de reconceptualisation est **SUPPRIMÉE** (pas seulement ignorée), **et aucun marqueur n'est produit**. Garanti à **DEUX niveaux**, réutilisant la **source unique** `branche_bloquee_par_detresse()` (0010, `fin IS NULL OR fenetre_expire_at > now()`) : (a) **garde de pipeline** — l'orchestrateur ne fait AUCUN appel fort si `!doitExecuterTravailSchema(verdict)` (le VETO déjà marqué, [pipeline.ts:107](../../lib/safety/pipeline.ts#L107)) **ou** si la fenêtre détresse est active ; (b) **garde au point d'écriture** — la fonction possédée `enregistrer_signal_reconceptualisation` LÈVE si `branche_bloquee_par_detresse()` (miroir de la garde de branche 4.5 : « le point d'écriture interroge `episode_detresse` »). Les deux sont **mutation-vérifiés**.

4. **Marqueur → signal en attente rattaché à l'entrée EXACTE, muet à l'écran.** Étant donné un marqueur détecté (« avant je pensais X, maintenant Y », prise de distance, rupture d'un récit répété), quand il est retenu, alors il est enregistré comme **signal en attente** (`statut = 'en_attente'`) **rattaché à l'entrée de journal EXACTE** (`entree_journal_id`, résolu depuis le `cle_tour` sous `auth.uid()` → isolation), **et rien ne se manifeste à l'écran sur l'instant** (aucune trame, aucun surlignage, aucune pastille : la détection tourne HORS du flux de réponse). **Idempotent** par `(utilisatrice_id, entree_journal_id)` : une ré-émission/retry du même tour ne crée jamais de doublon, et un signal déjà `consomme`/`ecarte` (par 4.5) n'est **jamais ressuscité** en `en_attente` (`on conflict do nothing`).

5. **Terme réservé « reconceptualisation » ≠ détection de détresse.** Étant donné le terme réservé « reconceptualisation », quand le signal est traité, alors il n'est **JAMAIS** confondu avec la détection de détresse — ce sont **deux évaluations distinctes du pipeline** : modules séparés (`lib/domain/reconceptualisation.ts` ≠ `lib/safety/detecteur-detresse.ts`/`classer-detresse.ts`), étapes séparées (sécurité d'abord PRODUIT le verdict ; reconceptualisation le CONSOMME), aucune ne référence l'autre (garde d'architecture).

## Tasks / Subtasks

- [x] **T1 — Migration `0020_signal_reconceptualisation.sql` : le récepteur art. 9 possédé-JWT + la garde AD-17 au point d'écriture (AC3, AC4)**
  - [x] RED : `tests/signal-reconceptualisation.test.ts` — la table `signal_reconceptualisation` existe, RLS `enable`+`force` ; colonnes exactes (`id uuid`, `utilisatrice_id uuid`, `entree_journal_id uuid`, `statut text default 'en_attente' check in (en_attente,consomme,ecarte)`, `cree_le timestamptz`, `maj_le timestamptz`) ; index **unique `(utilisatrice_id, entree_journal_id)`** (idempotence par entrée, AC4) ; FK `utilisatrice_id` → `utilisatrice(id) on delete cascade` **et** `entree_journal_id` → `entree_journal(id) on delete cascade` (un signal sans son entrée-source n'a aucun sens → purgé FR-067 avec elle).
  - [x] GREEN : créer la table en **copiant le gabarit** `entree_journal`/`fait_extrait` : deux policies — `select` (propriétaire, **survit à la révocation** → export FR-067) et `insert` write-gatée DURCIE (`a_consenti_art9()` **ET** `not est_barre_minorite()`). **Aucune** policy `update` (les transitions `consomme`/`ecarte` = Story 4.5) ni `delete` sous JWT (l'effacement FR-067 = `service_role`, Epic 6). Pointeur-seul : **aucune colonne de contenu art. 9 en clair** (le contenu vit dans l'entrée pointée).
  - [x] GREEN : **fonction de merge possédée** `public.enregistrer_signal_reconceptualisation(p_cle_tour text)` — **`security INVOKER`** (la RLS + le write-gate mordent), `set search_path=''`. (1) **résout `entree_journal_id`** depuis `(auth.uid(), p_cle_tour, role='utilisatrice')` — LÈVE si l'entrée n'existe pas (intégrité/isolation, miroir `fusionner_fait_extrait`) ; (2) **[DUR/AD-17] LÈVE si `branche_bloquee_par_detresse()`** (garde au point d'écriture, double-défense) ; (3) `insert … values (auth.uid(), entree, 'en_attente') on conflict (utilisatrice_id, entree_journal_id) do nothing` (idempotent, anti-résurrection AC4). `revoke execute … from public, anon` ; `grant execute … to authenticated`.
  - [x] GREEN : trigger `signal_reconceptualisation_touch_maj` (`new.maj_le = now()`, before insert or update — patron `resume_glissant` 0019) + `comment on table` fidèle (art. 9 possédé sous JWT, pointeur-seul, signal en attente AD-8/AD-16/AD-17, purge FR-067).
  - [x] Appliquer localement : `supabase db reset` (CLI **globale** v2.67.1, **jamais** `npx supabase` — rejoue 0001→0020 depuis les FICHIERS).

- [x] **T2 — Preuves base : RLS / write-gate / isolation / idempotence / garde AD-17 au point d'écriture (AC3, AC4)**
  - [x] RED→GREEN dans `tests/signal-reconceptualisation.test.ts` (Supabase local) :
    - [x] **AC4** — le propriétaire enregistre un signal (via la RPC) ; une **autre** utilisatrice ne le lit **rien** ; une session non authentifiée non plus (deny-by-default).
    - [x] **AC4/AD-13** — enregistrement **refusé sans consentement**, **refusé sous barrière minorité**, **refusé après révocation** ; la **lecture reste permise** après révocation (export FR-067 survit).
    - [x] **AC4 (isolation)** — un `p_cle_tour` qui ne correspond à AUCUNE entrée de l'appelante LÈVE (jamais de signal orphelin ni d'oracle d'existence inter-tenant).
    - [x] **AC4 (idempotence + anti-résurrection)** — deux appels au même `(utilisatrice, cle_tour)` → **UN** signal ; un signal forcé à `consomme` (service_role, simulant 4.5) puis ré-enregistré → **reste `consomme`** (jamais ré-ouvert en `en_attente`).
    - [x] **AC3 [DUR / AD-17]** — avec un épisode OUVERT (semé service_role) **et** dans les 72 h après extinction (`fenetre_expire_at > now()`, semé), l'enregistrement **LÈVE** (mutation-cible : retirer la garde `branche_bloquee_par_detresse()` → le test devient rouge) ; HORS fenêtre → réussit.
    - [x] **AC4/effacement** — un `DELETE` de `signal_reconceptualisation` sous JWT est **refusé** (aucune policy delete) ; un `DELETE` `service_role` **réussit** (siège de l'effacement FR-067) ; le `on delete cascade` depuis `entree_journal` purge le signal.

- [x] **T3 — Le détecteur PUR (domaine, AD-1) + la requête fort (AC1, AC2, AC5)**
  - [x] `lib/domain/reconceptualisation.ts` (module **PUR**, aucun I/O — patron `signaux-arc.ts`) :
    - [x] `INSTRUCTION_RECONCEPTUALISATION` — **PLACEHOLDER PRODUIT, « À VALIDER AVANT MISE EN LIGNE »** : demande une sortie STRUCTURÉE (`RECONCEPTUALISATION: oui|non`), aucune interprétation libre. On code la MACHINE, pas le jugement clinique.
    - [x] `detecterReconceptualisation(sortieModele): { detecte: boolean }` — parser PUR (patron `lireBooleen` : dernière ligne conforme, insensible à la casse ; **doute → `false`**, un marqueur non manifeste ne franchit rien).
    - [x] `requeteReconceptualisation(messages): RequeteIa` — `capacite: "reconceptualisation"` (⇒ fort, AC2), `contientArt9: true` (passe par l'egress art. 9, jamais l'adaptateur nu). Cadrage de messages décidé en dev (ancré sur le discours de l'utilisatrice ; forge à faible enjeu car 4.5 exige la validation).
  - [x] RED→GREEN `tests/reconceptualisation.test.ts` (unitaires PURS) : `RECONCEPTUALISATION: oui` → `detecte:true` ; `non`/absent/illisible → `false` (doute) ; **pureté** (aucun import Next/Supabase/SDK) ; `requeteReconceptualisation` porte bien `capacite:"reconceptualisation"` + `contientArt9:true`.

- [x] **T4 — L'orchestrateur de pipeline (`lib/safety`) + le dépôt sous JWT (AC1, AC2, AC3, AC4)**
  - [x] `lib/safety/reconceptualisation-pipeline.ts` (`import "server-only"`) — l'étage ordonné APRÈS la sécurité (AD-16). `evaluerReconceptualisationDuTour(deps, { messages, verdict, cleTour })` :
    - [x] **AC3 garde de pipeline** : si `!doitExecuterTravailSchema(verdict)` (VETO existant) **ou** `await deps.fenetreDetresseActive()` (branche_bloquee, repli **true** = le doute supprime) → retour `{ supprime:true, detecte:false, usage:null }` **sans AUCUN appel fort**.
    - [x] **AC2** : sinon `envoyerSousEgressArt9(requeteReconceptualisation(messages))` (fort, sous egress) ; egress bloqué (race consentement) → aucun signal. Budget de temps borné (patron `avecDelai` de `detecteur-detresse`, repli sûr : aucun signal) — un hang du fort en tâche de fond ne traîne pas.
    - [x] **AC4** : `detecterReconceptualisation(reponse.texte)` (pur) ; si `detecte`, `deps.depotSignal.enregistrer({ cleTour })` (la garde AD-17 au point d'écriture re-mord). Retourne toujours `usage` (le coût fort est métré même si non détecté). **Ne lève pas** — la persistance en repli journalise un incident sans art. 9.
    - [x] `fenetreDetresseActive(supabase, motif)` — lecteur de `branche_bloquee_par_detresse()` (JWT, keyé auth.uid()) avec **repli sûr true** (patron `episode-lecture`).
  - [x] `lib/data/depot-reconceptualisation.ts` (`import "server-only"`) : `creerDepotSignalReconcept()` implémente `DepotSignalReconcept` sous `createSupabaseServerClient()` (JWT) → `.rpc("enregistrer_signal_reconceptualisation", { p_cle_tour })`. **Lève** sur erreur réelle ; **jamais** de `cle_tour`/contenu dans les logs (NFR-022 : code Postgres seul).
  - [x] RED→GREEN `tests/depot-reconceptualisation.test.ts` (client **mocké**) : câblage exact (`.rpc("enregistrer_signal_reconceptualisation", …)`), adaptateur `server-only` + JWT (jamais `createSupabaseAdminClient`), **NFR-022 statique ET runtime** (ni throw ni log ne porte le `cle_tour` ; patron du test runtime de 4.3).
  - [x] RED→GREEN (orchestrateur, dépendances **fausses** en test) : la garde AD-17 court-circuite l'appel fort (verdict supprimé **ou** fenêtre active → l'adaptateur factice n'est JAMAIS appelé) ; hors garde, une sortie factice `RECONCEPTUALISATION: oui` → `depotSignal.enregistrer` appelé une fois ; `non` → jamais ; `usage` toujours renvoyé (métrage).

- [x] **T5 — Câblage LIVE dans la route + gardes d'architecture (AC1, AC2, AC4, AC5)**
  - [x] Câbler l'étage dans [app/api/anam/message/route.ts](../../app/api/anam/message/route.ts) : APRÈS `evaluerSecuriteDuTour` (AC1) **et** après la gravure du journal brut (l'entrée à rattacher existe), sur un tour `role === "user"`, dans un `after()` (HORS du flux de réponse → AC4 « rien à l'écran ») ; métré `:reconcept` (produit). Consomme `securite.verdict` + `cleIdempotence`. Repli : un échec journalise un incident sans art. 9, jamais un 500 (la réponse d'Anam ne dépend pas de la détection). **Vérifier en dev que le client JWT (`createSupabaseServerClient`) lit bien les cookies dans `after()`** ; à défaut, repli documenté : appel INLINE concurrent de l'extraction d'arc (latence ≈ inchangée, les deux passes fort se recouvrent).
  - [x] `tests/reconceptualisation-architecture.test.ts` : (a) le littéral `signal_reconceptualisation` **et** la RPC `enregistrer_signal_reconceptualisation` n'apparaissent QUE dans `lib/data/depot-reconceptualisation.ts` (patron garde de table 4.3, frontière de MOT `\b…\b`, périmètre `app`+`lib`+`render`+`scripts`+racine) ; (b) `requeteReconceptualisation`/`evaluerReconceptualisationDuTour` ne sont appelés QUE depuis l'orchestrateur + la route (AC1 « aucun détecteur hors du pipeline ») ; (c) **AC5** — `lib/domain/reconceptualisation.ts` ne référence AUCUN module de détresse (`detecteur-detresse`/`classer-detresse`/`consigne-detresse`) et réciproquement (deux évaluations distinctes).
  - [x] Étendre `tests/consentement.test.ts` : `signal_reconceptualisation` rejoint le bloc de fidélité de la frontière art. 9 (table de contenu/dérivé art. 9 possédée sous JWT).

- [x] **T6 — Suite verte + gardes transverses (tout)**
  - [x] Toute la suite verte : `set -a && . ./.env.local && set +a && npx vitest run` (Supabase local **démarré** via CLI globale v2.67.1).
  - [x] Gardes existantes **inchangées** : `pipeline-securite-architecture` (le détecteur de détresse reste confiné, AC5), `frontiere-serveur`, les sondes art. 9. La route reste sans SDK fournisseur / sans secret client.
  - [x] `npx tsc --noEmit`, `npx eslint`, `next build` propres. `supabase db reset` rejoue 0001→0020 sans erreur (migration FILE correcte, pas seulement le delta appliqué à la main).

## Dev Notes

### Le cœur en une phrase

La 4.4 est le **premier cerveau CÂBLÉ LIVE** de la mémoire : à chaque tour d'utilisatrice, le **modèle fort** cherche un moment de **reconceptualisation** (« avant je pensais X, maintenant Y »), **après** la sécurité et **jamais** pendant une détresse ou dans les 72 h (AD-17, double-défense) ; s'il en trouve un, il pose un **signal en attente** rattaché à l'**entrée de journal exacte** — muet à l'écran. Ce signal est le **germe d'une branche** (que la Story 4.5 proposera le lendemain, validée et nommée par l'utilisatrice).

### Cadrage PO (Julian) — « câbler le cerveau live » (choix explicite, ≠ 4.2/4.3)

Pour 4.2 (récepteur de faits) et 4.3 (assembleur de rappel), le câblage était **forcément différé** (aucune source/aucun puits de production). Pour la 4.4, **tout l'amont existe** (pipeline sécurité 2.3, egress 2.1, tiering 2.2, épisode 2.4, journal 4.1) — le détecteur **peut** tourner. Le seul manque est l'**aval** (le consommateur = la proposition de branche 4.5). Julian a tranché : **on câble maintenant**. Conséquence assumée : **+1 appel modèle FORT par tour de séance gratuite** (le coût variable principal), sans bénéfice visible avant la 4.5 — de vrais signaux s'accumulent dans le récepteur en attendant leur consommateur. Placement en `after()` → **coût en $, pas en latence**.

### Réconciliation de périmètre (dette tracée)

Le commentaire d'en-tête de `0018_fait_extrait.sql` dit « l'intelligence d'extraction (prompt LLM…) est DIFFÉRÉE (Story 4.4) ». Mais la 4.4 telle qu'écrite dans les epics produit un **signal de reconceptualisation → branche** (couche 3), **PAS** un `fait_extrait` (couche 2). Ce sont **deux cerveaux distincts**. **Après la 4.4, `fait_extrait` n'a toujours aucun writer de production** — ce n'est pas un blocage (le récepteur se remplit plus tard), mais c'est tracé dans `deferred-work.md` comme concern séparé (writer de faits). La 4.4 reste **stricte sur sa définition** (reconceptualisation).

### Ce qu'on RÉUTILISE (rien de réinventé)

- **VETO AD-16 déjà marqué** : `doitExecuterTravailSchema(verdict)` ([pipeline.ts:107](../../lib/safety/pipeline.ts#L107)) — le code disait *« le point d'extension : l'écriture de reconceptualisation devra le consulter avant d'écrire »*. La 4.4 le **consomme**.
- **Fenêtre AD-17 « en cours + 72 h »** : `branche_bloquee_par_detresse()` (0010, source unique keyée `auth.uid()`, granted `authenticated`, sans appelant de prod) — réutilisée pour les DEUX gardes (pipeline + point d'écriture). Le commentaire de 0010 l'annonçait : *« le futur write-gate de branche (Epic 4) l'appellera »*.
- **Tier fort gratuit** : `capacite:"reconceptualisation"` → `tierPour` renvoie `fort` (existe depuis 2.2).
- **Patron du cerveau pur** : `signaux-arc.ts` (INSTRUCTION structurée placeholder + parser pur + requête fort) → décalque exact.
- **Patron du récepteur art. 9** : `fait_extrait`/`entree_journal` (RLS deny-by-default + write-gate durci + owned merge function + soft-erase service_role).
- **Patron de l'egress** : `envoyerSousEgressArt9` (non-streaming, `{bloque, reponse}`) comme l'extraction d'arc.

### AD-17 double-défense (le cœur sûr, AC3 [DUR])

| Niveau | Où | Ce qu'il garde |
|---|---|---|
| (a) pipeline | `evaluerReconceptualisationDuTour` | `!doitExecuterTravailSchema(verdict)` **ou** `fenetreDetresseActive()` → **aucun appel fort**, aucune sortie. Couvre le chemin LIVE. |
| (b) point d'écriture | `enregistrer_signal_reconceptualisation` (SQL) | LÈVE si `branche_bloquee_par_detresse()` — même service_role via un futur appelant, ou si (a) est un jour contourné. Couvre le CONTRAT. |

Non redondants (miroir de la double-défense de 4.2 clause `WHERE`+trigger et de 4.3 base+domaine) : (a) protège le chemin vivant et évite le coût fort ; (b) protège l'invariant pour tout futur appelant. Les deux lisent la **même source unique** `branche_bloquee_par_detresse()` (AD-17 : aucune 2ᵉ dérivation de la fenêtre 72 h).

### Posture art. 9 du signal — possédé-JWT, pointeur-seul

`signal_reconceptualisation` est **possédé sous JWT** (miroir `fait_extrait` : *dérivé* côté serveur mais *possédé* par l'utilisatrice pour lecture/effacement) et **pointeur-seul** (aucun contenu art. 9 en clair — il pointe l'entrée de journal, où vit le verbatim). Choix conscients :

- **Possédé (pas server-authoritative comme `episode`/`seance`)** : l'utilisatrice l'exporte (FR-067) et l'efface (AD-14) ; le write se fait sous `auth.uid()` (security invoker) → `branche_bloquee_par_detresse()` (keyé auth.uid()) enforce AD-17 au write ; l'egress vérifie le consentement LIVE (auth.uid()). **Forge à faible enjeu** : un client pourrait appeler la RPC directement, mais (1) idempotent par entrée, (2) 4.5 exige validation+nommage (rien de décrété), (3) write-gaté consentement + non-barré + hors détresse. Documenté comme choix (patron de la note de forge de l'arc).
- **Pointeur-seul** : minimise la surface art. 9 (AD-14) et évite d'injecter une interprétation LLM figée/forgeable ; 4.5 relira l'entrée exacte pour proposer la branche.

### AC5 — reconceptualisation ≠ détresse (deux évaluations)

Séparation **structurelle**, pas seulement conventionnelle : la sécurité (détresse) est un module `lib/safety/*detresse*` qui PRODUIT un verdict EN PREMIER ; la reconceptualisation est un module `lib/domain/reconceptualisation.ts` qui CONSOMME ce verdict ENSUITE. Aucun ne référence l'autre (garde d'architecture T5c). La détresse gouverne la sécurité (§5) ; la reconceptualisation gouverne la mémoire/l'arbre (AD-8) — jamais mélangées.

### Placeholders produit (portes pré-lancement, ne pas expédier tel quel)

`INSTRUCTION_RECONCEPTUALISATION` est un **placeholder** (comme `INSTRUCTION_EXTRACTION_ARC` et le prompt de détresse). On code la MACHINE (structure de sortie → décision → persistance gardée) ; le **jugement** (quels marqueurs, quelle finesse) est une porte produit/clinique tracée dans `deferred-work.md`. La 4.4 ne prétend PAS que la détection est juste — elle prétend que le squelette (ordre, AD-17, isolation, idempotence, art. 9) est **incorruptible et prouvé**.

### Rappels opérationnels

- Tests : `set -a && . ./.env.local && set +a && npx vitest run` (Vitest ne charge pas `.env.local`). Supabase local via CLI **globale** v2.67.1, **jamais** `npx supabase`.
- Migration en local : `supabase db reset` (rejoue 0001→0020 depuis les FICHIERS — reprend une migration éditée).
- La migration 0020 rejoint la **porte OPS cloud** (`deferred-work.md`) : à déployer avant prod (Management API + `sbp_` token, projet `zlhlzoalmszohrxrnsmo`).

## Dev Agent Record

### Context Reference

Story auto-cadrée (analyse exhaustive du pipeline existant) puis implémentée en TDD. Périmètre « câbler le cerveau live » (choix PO explicite via AskUserQuestion).

### Debug Log

- Mutation AD-17 niveau (b) — DB : neutralisé `branche_bloquee_par_detresse()` dans la RPC → les 2 tests [DUR] (épisode ouvert + fenêtre 72 h) rougissent → garde load-bearing → restauré.
- Mutation AD-17 niveau (a) — pipeline : neutralisé la garde de l'orchestrateur → les 2 tests (détresse → aucun appel fort ; fenêtre → aucun appel fort) rougissent → restauré.
- Bug attrapé par la suite (gate-quota) : l'étage reconceptualisation placé AVANT le gate d'allocation faisait un appel fort + un métrage `:reconcept` sur un tour COUPÉ par le quota (viole « aucun appel fort, aucune ligne usage_ia » du tour coupé). Corrigé : l'étage est DÉPLACÉ après le `return` précoce du gate → un tour coupé le saute (comme l'arc et la génération).

### Completion Notes

Périmètre « câbler le cerveau live » livré et prouvé bout-en-bout. Le squelette est incorruptible : ordre (sécurité d'abord → reconceptualisation), AD-5 (fort résolu serveur), AD-17 double-défense (pipeline + point d'écriture, source unique `branche_bloquee_par_detresse`, les deux mutation-vérifiées), AC4 (signal en attente pointeur-seul, rattaché à l'entrée exacte, isolé, idempotent, anti-résurrection), AC5 (reconceptualisation ≠ détresse, séparation structurelle gardée). Le JUGEMENT (prompt/finesse) reste une porte produit (placeholder). 1111 tests verts, tsc/eslint/build propres, `db reset` rejoue 0001→0020.

### File List

- **NOUVEAU** `supabase/migrations/0020_signal_reconceptualisation.sql` — table possédée-JWT (pointeur-seul) + RPC merge possédée `enregistrer_signal_reconceptualisation` (garde AD-17 au point d'écriture + isolation + idempotence) + trigger `maj_le`.
- **NOUVEAU** `lib/domain/reconceptualisation.ts` — détecteur PUR (INSTRUCTION placeholder + parser + `requeteReconceptualisation` fort).
- **NOUVEAU** `lib/safety/reconceptualisation-pipeline.ts` — orchestrateur (garde AD-17 pipeline, egress fort borné, persistance gardée) + `fenetreDetresseActive` (JWT, repli sûr).
- **NOUVEAU** `lib/data/depot-reconceptualisation.ts` — dépôt sous JWT (client réutilisable pour `after()`).
- **MODIFIÉ** `app/api/anam/message/route.ts` — étage reconceptualisation en `after()` APRÈS le gate d'allocation, métré `:reconcept`.
- **NOUVEAUX tests** `signal-reconceptualisation.test.ts` (16), `reconceptualisation.test.ts` (8), `reconceptualisation-pipeline.test.ts` (6), `depot-reconceptualisation.test.ts` (5), `reconceptualisation-architecture.test.ts` (6).
- **MODIFIÉ** `tests/consentement.test.ts` — `signal_reconceptualisation` rejoint la frontière art. 9.
- **MODIFIÉ** `_bmad-output/implementation-artifacts/deferred-work.md` — 0020 à la porte OPS cloud + coutures 4.4 différées.

## Revue adversariale (AI) — 4.4

Workflow multi-agents (26 agents, ~1,83M tokens, 6 angles Sonnet × réfutation Opus par finding + synthèse). 19 findings vérifiés → 8 retenus. **Le cœur a résisté SAUF un vrai trou de sécurité confirmé EN LIVE** (le même patron de valeur que 4.2/4.3 : une hypothèse fausse rattrapée par l'attaque).

**R1+R3 [HAUTE, CONFIRMÉ EN LIVE] — CORRIGÉ + mutation-vérifié.** Ma « double-défense » AD-17 était en réalité **mono-défense** : les gardes (AD-17 + isolation) vivaient dans la RPC `security invoker`, mais `authenticated` a le grant INSERT table-level → un `.from(...).insert()` DIRECT sautait la RPC et ne voyait qu'une policy qui ne vérifiait ni la détresse ni l'appartenance de l'entrée. Reproduit en live : signal né en détresse + signal pointant le journal d'autrui (+ oracle d'existence d'UUID inter-tenant). **Fix** : les deux gardes portées dans la policy `WITH CHECK` (patron `entree_journal`/`fait_extrait`) → couvrent TOUT insert ET rendent l'AD-17 atomique avec l'insert (tue le TOCTOU R3). Garde d'archi R6 ajoutée (bannit `.from("signal_reconceptualisation")`).

**R5 [MOY, PLAUSIBLE] — CORRIGÉ.** `export const maxDuration = 60` posé : l'appel fort en `after()` ne partage plus le plafond par défaut du stream.

**R7 [MOY, CONFIRMÉ] — CORRIGÉ.** La garde AC5 codée en dur sur 2 fichiers → glob de tout `lib/safety/` (hors orchestrateur).

**R2 [HAUTE, CONFIRMÉ, HÉRITÉ 2.4] — DIFFÉRÉ (à trancher).** La source unique AD-17 (`episode_detresse`) peut être perdue silencieusement à l'ouverture (`rpcAvecRepli` avale l'échec) → au tour suivant, les deux gardes relisent une table vide. **Pas introduit par 4.4** (affaiblit déjà paywall/forcing) ; fix propre = durabilité de l'ouverture d'épisode en Story 2.4 (arbitrage à ne pas bâcler). Tracé dans deferred-work, à trancher avec le PO.

**R4 [MOY, CONFIRMÉ, HÉRITÉ] — DIFFÉRÉ.** Repli sans jeton → N retries = N entrées + N signaux (résidu pré-existant, fix côté robustesse client).

**R8 [BASSE, PLAUSIBLE, latent] — DIFFÉRÉ.** `sansCommentaires()` naïf (dette transverse déjà tracée).

## Change Log

| Version | Date | Description |
|---|---|---|
| 0.1 | 2026-07-30 | Création de la story (périmètre « câbler le cerveau live »), baseline 2018b7d. |
| 1.0 | 2026-07-30 | Implémentation TDD T1-T6. Migration 0020 + détecteur pur + orchestrateur + dépôt + câblage route live. Double-défense AD-17 (mutation-vérifiée × 2). Bug tour-coupé attrapé et corrigé (étage déplacé après le gate d'allocation). 1111 tests verts. Status → review. |
| 1.1 | 2026-07-30 | Revue adversariale (26 agents). **R1+R3 corrigés (faille de sécu confirmée en live : insert direct sautait les gardes RPC → portées dans la policy WITH CHECK, atomique, mutation-vérifié).** R5 (maxDuration), R6 (garde table nue), R7 (glob AC5) corrigés. R2/R4/R8 différés (hérités/systémiques, tracés). 1115 tests verts, tsc/eslint/build propres, db reset propre. |
