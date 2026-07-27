---
baseline_commit: 53aa9ef44c8b579ee2a9dff48aeb982ab3545340
---

# Story 2.3 : Le pipeline serveur sécurité-d'abord

Status: review

<!-- Note: Validation optionnelle. Lance validate-create-story pour un contrôle qualité avant dev-story. -->

## Story

En tant que **développeuse**,
je veux un **unique pipeline serveur ordonné qui évalue la sécurité EN PREMIER** et arbitre tout le reste du tour,
afin que la **détresse prime sur toute autre écriture** et soit **toujours analysée par le modèle le plus capable**.

> ⚠️ **INTENTION PRODUIT, PAS PROTOCOLE CLINIQUE.** Cette story construit **la machine** (l'ordonnancement,
> le forçage du modèle fort, le repli sûr, l'audit, le veto des écritures). Le **contenu clinique** — le prompt
> de détection, les seuils des niveaux, le jeu de cas — est livré **explicitement provisoire** et **doit être
> validé par un professionnel qualifié (clinicien) et un juriste avant toute mise en ligne sur données réelles**
> (PRD §5 · Deferred du SPINE). On ne traite jamais nos formulations comme cliniquement sûres.

## Acceptance Criteria

Repris de [epics.md → Story 2.3](../planning-artifacts/epics.md). Couvre **FR-037, FR-046, FR-078, AD-16, AD-5, NFR-012**.

1. **Pipeline ordonné, sécurité d'abord (AD-16).** Étant donné un tour utilisateur, quand il est traité, alors il passe par un **unique pipeline serveur ordonné** (`lib/safety/` → `lib/domain/`) où l'**évaluation de sécurité s'exécute EN PREMIER** et peut **annuler** toute autre écriture du tour, **et** **aucun module n'appelle un détecteur hors de ce pipeline**.

2. **Détection toujours au plus capable ; repli sûr (AD-5, NFR-012, AD-15).** Étant donné la détection de détresse, quand elle s'exécute, alors elle utilise **TOUJOURS le modèle le plus capable disponible, JAMAIS le léger, en aucune circonstance**, **et** à défaut du modèle fort le système **échoue vers la sécurité** (repli sûr) — jamais une analyse au tier léger, jamais un échec silencieux (incident journalisé).

3. **Niveau ≥ 1 → suspension ET suppression (FR-037).** Étant donné un niveau de détresse ≥ 1, quand il est détecté, alors tout travail de schéma / contradiction / reconceptualisation est **suspendu ET sa sortie supprimée pour l'épisode** (pas seulement ignorée — FR-037), **et** le modèle le plus capable est **forcé pour la détection ET la réponse**.

4. **Audit sans art.9 ; épisodes exclus (FR-078, FR-046).** Étant donné chaque classification de sécurité, quand elle est produite, alors un **enregistrement d'audit sans art.9** (niveau, décision, tier, horodatage) est émis pour mesurer le rappel et les **faux négatifs** (FR-078), **et** les épisodes sont **exclus de toute analyse produit, synthèse et arbre** (FR-046).

## Tasks / Subtasks

> TDD strict (red → green → refactor) ; runner Vitest node, `server-only` stubbé (cf. Dev Notes → Tests).
> Les tests SQL-réels tournent avec `set -a && . ./.env.local && set +a && npx vitest run` (jamais `npx supabase`).

- [x] **T1 — Capacité « détection » forcée au modèle fort (AC2)**
  - [x] Test rouge : `tierPour("detection", n)` renvoie `"fort"` pour **tout** `n` (0..3) ; le tier de détection ne peut JAMAIS valoir `"leger"`.
  - [x] Ajouter `"detection"` à `CapaciteIa` (`lib/ai/port.ts`) et la mapper à `"fort"` **inconditionnellement** dans `lib/ai/politique-tier.ts` (la détection ne peut pas dépendre du `niveauSecurite` qu'elle est justement en train de calculer — pas de résolution circulaire).
  - [x] Vérifier que `modelePour("fort")` = l'identifiant fort daté (`mistral-large-2512`), jamais `-latest`.

- [x] **T2 — Le classifieur PUR (AC1, AC3)** — `lib/safety/classer-detresse.ts`
  - [x] Test rouge : `classerDetresse(sortieStructurée)` → `VerdictSecurite { niveau, decision, supprimerTravailSchema }` pour chaque niveau 0..3 ; `niveau ≥ 1 ⇒ supprimerTravailSchema === true` ; sortie **mal formée / illisible ⇒ repli conservateur** (jamais niveau 0 par défaut sur une entrée illisible — le doute penche vers la sécurité).
  - [x] Fonction **pure** (aucune I/O, aucun import infra), sur le patron de `lib/safety/barriere-minorite.ts`.
  - [x] Mutation-test chaque garde (inverser `≥` → le test doit casser).

- [x] **T3 — Le détecteur au modèle fort, sous egress art.9 (AC2)** — `lib/safety/detecteur-detresse.ts`
  - [x] Test rouge (via l'adaptateur `factice`, déterministe, zéro réseau) : le détecteur appelle le modèle **fort** à travers `envoyerSousEgressArt9(...)` avec `capacite: "detection"`, `contientArt9: true`, puis parse via `classerDetresse`.
  - [x] **Repli sûr** : si l'appel modèle échoue / l'adaptateur signale le fort indisponible / la sortie est illisible ⇒ verdict de **repli** (`decision: "repli_sur"`, niveau plancher sûr qui engage les haltes) **+ incident journalisé** (structuré, sans art.9). **Jamais** de re-tentative au tier léger.
  - [x] Prompt de détection = **placeholder explicitement marqué** `À VALIDER PAR UN PRO — NE PAS EXPÉDIER` (cf. porte pré-lancement) ; sortie demandée **structurée** (le classifieur T2 ne fait pas d'interprétation libre).

- [x] **T4 — Le pipeline sécurité-d'abord (AC1, AC3)** — `lib/safety/pipeline.ts`
  - [x] Test rouge : `evaluerSecuriteDuTour(deps, messages)` (a) exécute la détection **en premier**, (b) applique le repli sûr, (c) **émet l'audit** (T5), (d) renvoie le `VerdictSecurite`. C'est **le seul** appelant du détecteur.
  - [x] **`niveauEffectif = max(niveauDétecté, (await deps.depotEpisode.episodeOuvert()) ? 1 : 0)`** — construire ce `max()` **dès maintenant** : quand 2.4 rendra `episodeOuvert()` réel, le forçage « fort pour TOUT l'épisode » (même un tour ultérieur classé 0) marchera **sans refactor**. Le verdict porte `niveauEffectif`.
  - [x] Établir le **point de veto** : le verdict peut annuler la phase d'écritures-domaine du tour (`supprimerTravailSchema`). **Le veto vise les écritures de schéma / reconceptualisation / branche — JAMAIS le métrage** (le métrage reste écrit une fois, il n'interrompt rien ; cf. Dev Notes → Métrage). Aucun writer de schéma n'existe encore (Epic 4) → matérialiser le point d'extension + un test qui prouve que `niveau ≥ 1` court-circuite la phase domaine.
  - [x] **Couture épisode → Story 2.4** : dépendance typée `DepotEpisode { episodeOuvert(): Promise<boolean>; signaler(niveau): Promise<void> }`. En 2.3, adaptateur placeholder **honnête** (pas d'état cross-tour persistant : `episodeOuvert()` → `false`, `signaler()` → n'émet que l'audit) documenté « remplacé par l'entité `episode_detresse` en Story 2.4 ». Ne PAS créer la table `episode_detresse` ici.

- [x] **T5 — L'audit sans art.9 (AC4, FR-078)** — migration `0009_audit_detresse.sql`
  - [x] `alter table public.audit_securite` : ajouter `niveau int` + `tier text` (colonnes de la trace du SPINE : niveau, décision, tier, horodatage). Reste **RLS deny-by-default forcée**, **par-utilisatrice**, **sans verbatim** (patron `audit_securite` de 0006 + `usage_ia` de 0008).
  - [x] Écriture via une fonction `security definer` accordée à `service_role` (jamais un `insert` client) ; l'appel côté app passe par `createSupabaseAdminClient()` (patron `metrerUsageIa`).
  - [x] **Idempotence** : l'audit est émis **une fois par tour** (clé d'idempotence par tour, comme `usage_ia`) et **juste après la classification** (pas conditionné à la fin du stream — la décision de sécurité doit être mesurable même si le tour avorte). Une re-tentative client ne double-compte pas la classification (sinon le rappel FR-078 est faussé).
  - [x] Test SQL-réel : un `type='detresse'` s'insère avec niveau/décision/tier ; **aucun champ de contenu** (liste blanche stricte) ; RLS bloque tout accès direct.

- [x] **T6 — Câblage de la route (AC1, AC2, AC3)** — `app/api/anam/message/route.ts`
  - [x] Test rouge : remplacer le hardcode `const niveauSecurite: NiveauSecurite = 0;` par le **verdict du pipeline**, calculé **AVANT** `creerAiPort()` / `diffuserSousEgressArt9()` / tout début de génération.
  - [x] `niveau ≥ 1` ⇒ `niveauSecurite` passe dans la `RequeteIa` de réponse ⇒ la **réponse** est aussi forcée `"fort"` (la politique le garantit déjà) **et** la phase d'écritures-domaine est vetoée.
  - [x] La détection réutilise la même session Supabase / le même egress-guard que la génération (consentement + ZDR revérifiés) ; un blocage d'egress (révocation en vol, minorité) arrête le tour **avant** la détection — distinct du repli « fort indisponible ».

- [x] **T7 — Garde d'architecture (AC1)** — `tests/pipeline-securite-architecture.test.ts`
  - [x] Sur le patron `tests/frontiere-serveur.test.ts` (grep source, `sansCommentaires`) : le détecteur (`lib/safety/detecteur-detresse.ts`) est importé **uniquement** par `lib/safety/pipeline.ts` ; aucune route, aucun adaptateur, aucun module domaine ne l'importe.
  - [x] La capacité `"detection"` résout **toujours** `"fort"` (garde re-testée au niveau architecture, pas seulement unité).
  - [x] Le domaine (`lib/domain/`) reste pur ; le pipeline ne dépend jamais du rendu.

- [x] **T8 — Harnais de mesure des faux négatifs (AC4, FR-078)** — `tests/detresse-mesure-rappel.test.ts`
  - [x] Faire tourner `classerDetresse` sur une **fixture étiquetée PROVISOIRE** (`tests/fixtures/detresse-cas.provisoire.json`, marquée `À REMPLACER PAR LE JEU VALIDÉ PAR UN PRO`) et calculer rappel / faux négatifs.
  - [x] Le test prouve que **la mesure fonctionne** (le mécanisme d'évaluation), **PAS** une exactitude clinique. Documenter en tête : « chiffres non cliniques ; porte pré-lancement FR-078 ».

- [x] **T9 — Régression & qualité**
  - [x] Suite complète verte (aucune régression 2.1/2.2) ; `tsc --noEmit` + `eslint` propres.
  - [x] Mettre à jour `lib/safety/README.md` (le pipeline et sa règle « détecteur jamais hors pipeline ») et le File List / Change Log de cette story.

## Dev Notes

### Ce que la story livre — et ce qu'elle NE livre PAS (frontières avec 2.4/2.5/2.6)

La 2.3 est **la machine d'arbitrage**, pas la réponse ni l'entité. Bornage strict :

| Concerne | Story | 2.3 fait… |
|---|---|---|
| Pipeline ordonné, détection au fort, repli sûr, veto, audit | **2.3 (ici)** | **tout** |
| Entité `episode_detresse`, fenêtre 72 h, extinction, `limites_levees`, garde branche au point d'écriture | **2.4** | définit **la couture `DepotEpisode`** ; ne crée PAS la table |
| Filet hors-IA, `/aide`, garde paywall lit `limites_levees` | **2.5** | rien (le repli « force les haltes » est un **signal** ; l'affichage est en 2.5) |
| La **réponse** par niveaux (mots d'Anam, niv.0/1 non annoncé, niv.2/3 ouvert, bloc ressources) | **2.6** | rien (2.3 **classifie et arbitre**, ne **répond** pas) ; 2.3 garantit seulement que la réponse d'un épisode est forcée `"fort"` |

> **Piège de sur-portée.** `app/aide/page.tsx` existe déjà (filet hors-IA de base). Ne pas le refondre ici.
> Ne pas écrire de logique de réponse de détresse (2.6). Ne pas créer `episode_detresse` (2.4). Ne pas toucher le paywall (2.5).

### La couture est déjà pré-taillée (état réel du code, vérifié)

- **Le hardcode à remplacer** : `app/api/anam/message/route.ts` contient aujourd'hui
  `const niveauSecurite: NiveauSecurite = 0;` puis `tierPour(CAPACITE, niveauSecurite)`. **C'est LE point d'insertion** : la détection doit produire le vrai `niveauSecurite` **avant** `creerAiPort()` et la génération.
- **Le forçage du fort existe déjà** : `lib/ai/politique-tier.ts` → `if (niveauSecurite >= 1) return "fort";`. Produire `niveau ≥ 1` suffit à forcer la **réponse** au fort. La **détection**, elle, doit forcer le fort **sans** connaître le niveau → d'où la capacité `"detection"` (T1).
- **Types déjà là** : `NiveauSecurite = 0|1|2|3`, `RequeteIa.niveauSecurite` (résolu **serveur uniquement**, le client ne le pose jamais) — `lib/ai/port.ts`.
- **L'egress art.9** : `envoyerSousEgressArt9({ supabase, adaptateur, requete })` (non-streaming, pour la classification) et `diffuserSousEgressArt9(...)` (streaming, pour la réponse) — `lib/ai/egress-guard.ts`. La détection = un envoi non-streaming sous egress (consentement + ZDR revérifiés).
- **`lib/safety/` existe** : `barriere-minorite.ts` (pur) + `appliquer-barriere.ts` (serveur, RPC). **Copier ce split** : classifieur pur (T2) + détecteur/pipeline serveur (T3/T4).
- **L'audit existe déjà** : `public.audit_securite` (migration `0006_barriere_minorite.sql`) — `utilisatrice_id, type, decision, cree_le`, **RLS deny-by-default forcée, sans politique**, écrite par une fonction `security definer` accordée à `service_role`. La 2.3 **ajoute `niveau` + `tier`** (migration 0009) et écrit un `type='detresse'`. La question « per-user donc art.9 ? » est **déjà tranchée** par le précédent minorité : par-utilisatrice + RLS forcée + **sans contenu** = conforme au « audit sans art.9 » du SPINE (Opérations).
- **L'adaptateur `factice`** (`lib/ai/adapters/factice.ts`, déterministe, zéro réseau/clé, `estZdrProuve()===true`) est le **chemin de test** : la détection au « fort » y est déterministe → pipeline testable sans vrai modèle.

### Le repli sûr — le vrai mécanisme neuf (AD-15)

Aucun chemin « modèle fort indisponible → sécurité » n'existe aujourd'hui (`tierPour` ne sait que mapper `leger`/`fort` ; le seul échec dur est le boot-guard Mistral ZDR). **À créer** : quand la classification ne peut pas s'obtenir au fort (exception réseau, adaptateur fort indisponible, sortie illisible), le détecteur renvoie un **verdict de repli** :
- `decision: "repli_sur"`, **niveau plancher qui engage les haltes** (le doute penche vers la sécurité, jamais vers `niveau 0`) ;
- **incident journalisé** structuré (sans art.9) — c'est un événement d'observabilité « indisponibilité de sécurité », pas un log silencieux ;
- **jamais** de repli vers le tier léger (AD-5), **jamais** d'échec silencieux (AD-15).
- Distinguer du **blocage d'egress** (révocation de consentement en vol, barrière minorité) : celui-ci arrête **tout le tour en amont** et n'est pas un « repli fort indisponible ».

### Métrage de la détection — piège FR-043 (à ne surtout pas rater)

La détection est un **appel modèle fort supplémentaire à CHAQUE tour** (niveau 0 compris) → coût réel, ~double des tokens du tour. **Garde-fou dur** : ce coût **ne doit JAMAIS être compté dans le quota conversationnel** de l'utilisatrice — sinon la sécurité, en tournant, épuiserait le quota et rapprocherait le paywall, ce qui **collisionne frontalement avec FR-043** (« la sécurité ne consomme jamais le quota, surtout sur un compte gratuit »). Donc : si le coût de détection est tracé (observabilité opérateur), c'est dans un **canal distinct ou un enregistrement `usage_ia` explicitement étiqueté**, **jamais** dans le compteur qui alimente l'allocation résiduelle / le paywall. Le métrage conversationnel de 2.2 (`resoudreMetrage` + `after(...)`) reste **inchangé** et ne mesure que la **réponse**, pas la détection.

### Tension connue à signaler : latence (AD-16 vs budget 2.2)

La détection est un appel **fort** qui doit résoudre **avant** la génération → un aller-retour supplémentaire par tour. En conflit apparent avec le budget 2.2 (plancher 400–900 ms, 1er caractère < 1 s).
- **Lecture retenue** : AD-16 dit « la sécurité s'exécute en premier et peut **annuler toute écriture** » — c'est un veto des **écritures**, la réponse par niveaux est en 2.6. Approche v1 recommandée : **séquentiel — classifier puis répondre** (correct, simple ; la latence réelle ne mord qu'en prod avec Mistral, elle-même derrière la porte DPA/ZDR ; en dev/CI sur `factice`, coût négligeable).
- **Écartée pour v1** : la classification spéculative en parallèle de la réponse (risque de laisser fuir un token « de schéma » avant suppression → viole l'esprit « sécurité d'abord »). À noter en optimisation différée, pas maintenant.

### Frontière serveur & invariants durs (à ne pas enfreindre)

- **AD-16** : un **unique** pipeline ordonné ; **aucun** détecteur appelé hors de lui (garde T7).
- **AD-5 / NFR-012** : détection **toujours** au plus capable, **jamais** léger ; tier résolu **côté serveur**, jamais choisi par le client.
- **AD-2 / AD-4 / AD-13** : la détection est un traitement art.9 → passe par l'**egress-guard unique** (consentement + ZDR revérifiés dans la transaction d'envoi) ; **une seule clé serveur** ; aucun SDK hors `lib/ai/adapters/`.
- **AD-12** : la table d'audit naît **RLS deny-by-default** — une table art.9 sans politique **casse le build** (test CI existant).
- **AD-1 / AD-10** : `lib/domain/` reste pur (0 I/O) ; le pipeline dépend vers le bas ; le rendu ne pilote rien.
- **NFR-022** : jamais de prompt/réponse/verbatim en clair dans les logs ni dans l'audit — **liste blanche de champs**.

### Project Structure Notes

Nouveaux fichiers (couche **Ports** `lib/safety/` + données) :
```
lib/safety/classer-detresse.ts        # PUR : sortie structurée → VerdictSecurite (testable, 0 I/O)
lib/safety/detecteur-detresse.ts      # serveur : appel FORT sous egress + parse ; repli sûr ; prompt placeholder gated
lib/safety/pipeline.ts                # sécurité-d'abord : détection → veto → audit → verdict ; SEUL appelant du détecteur
supabase/migrations/0009_audit_detresse.sql   # +niveau +tier sur audit_securite ; fn security definer 'detresse'
tests/pipeline-securite-architecture.test.ts  # garde : détecteur jamais hors pipeline ; detection ⇒ fort
tests/detresse-mesure-rappel.test.ts          # harnais faux négatifs (fixture PROVISOIRE)
tests/fixtures/detresse-cas.provisoire.json   # jeu de cas placeholder — À REMPLACER (porte pré-lancement)
```
Fichiers **modifiés** :
```
lib/ai/port.ts                 # CapaciteIa += "detection"
lib/ai/politique-tier.ts       # "detection" ⇒ "fort" inconditionnel
app/api/anam/message/route.ts  # remplace le hardcode niveauSecurite=0 par le verdict du pipeline (avant génération)
lib/safety/README.md           # documente le pipeline + la règle du détecteur
```
Conventions respectées : fichiers `kebab-case`, types `PascalCase`, tables/colonnes `snake_case`, migrations forward-only horodatées, `VerdictSecurite`/`DepotEpisode` en `PascalCase`.

### Tests (rappels opérationnels)

- Runner **Vitest env node** (pas de DOM) ; `@` → racine ; `server-only` stubbé via `tests/_stubs/server-only.ts` (déjà en place) → les modules serveur s'exécutent en test.
- **Détection déterministe** via `factice` (aucun vrai modèle en CI).
- **Tests SQL-réels** (migration 0009, RLS, fonction) : `set -a && . ./.env.local && set +a && npx vitest run` — **global `supabase` v2.67.1**, jamais `npx supabase`.
- Gardes d'architecture sur le patron `sansCommentaires` : mutation-tester chaque garde (une vraie violation doit faire rougir).
- **Piège du strip-commentaires** : la garde retire les commentaires puis grep — vérifier qu'un vrai import du détecteur (hors pipeline) est bien attrapé, pas seulement un commentaire.

### Porte pré-lancement (SIGNALER, ne pas bloquer le build)

- **Validation clinique + juridique** du protocole de détection (prompt, seuils, jeu de cas) — PRD §5, Deferred du SPINE. Le code livré est **la machine** ; le contenu clinique est **placeholder marqué**.
- Hérite de la porte **DPA art.28 + ZDR Mistral** (le fort passe par l'egress art.9 de la 2.1) — dev/test sur données non sensibles + `factice` uniquement.
- **FR-044** (numéros vérifiés) et l'affichage des ressources relèvent de **2.5** ; ici on ne fait qu'émettre le **signal** « forcer les haltes » au repli.

### References

- [Source: epics.md → Epic 2 → Story 2.3](../planning-artifacts/epics.md) — user story, 4 AC, couverture FR/AD.
- [Source: prd.md §5 — Détresse, protocole produit](../planning-artifacts/prds/prd-Anima-2026-07-21/prd.md) — FR-037/046/074-078, les 4 niveaux, formulations de référence, avertissement « intention produit, pas protocole clinique ».
- [Source: prd.md — NFR-012](../planning-artifacts/prds/prd-Anima-2026-07-21/prd.md) — détection détresse toujours au plus capable.
- [Source: ARCHITECTURE-SPINE.md — AD-16](../planning-artifacts/architecture/architecture-Anima-2026-07-22/ARCHITECTURE-SPINE.md) — pipeline par message, sécurité d'abord, veto des écritures.
- [Source: ARCHITECTURE-SPINE.md — AD-5](../planning-artifacts/architecture/architecture-Anima-2026-07-22/ARCHITECTURE-SPINE.md) — tiering ; détresse au plus capable ; politique unique `(capacité, niveau_sécurité) → tier`.
- [Source: ARCHITECTURE-SPINE.md — AD-15](../planning-artifacts/architecture/architecture-Anima-2026-07-22/ARCHITECTURE-SPINE.md) — filet hors-IA ; **repli sûr** ; incident journalisé.
- [Source: ARCHITECTURE-SPINE.md — AD-17](../planning-artifacts/architecture/architecture-Anima-2026-07-22/ARCHITECTURE-SPINE.md) — l'épisode est une entité possédée (couture vers Story 2.4).
- [Source: ARCHITECTURE-SPINE.md — Opérations](../planning-artifacts/architecture/architecture-Anima-2026-07-22/ARCHITECTURE-SPINE.md) — audit sans art.9 (niveau, décision, tier, horodatage) ; mesure des faux négatifs.
- Code existant : `lib/ai/port.ts`, `lib/ai/politique-tier.ts`, `lib/ai/egress-guard.ts`, `lib/ai/adapters/factice.ts`, `app/api/anam/message/route.ts`, `lib/safety/barriere-minorite.ts`, `lib/safety/appliquer-barriere.ts`, `supabase/migrations/0006_barriere_minorite.sql`, `supabase/migrations/0008_usage_ia.sql`, `tests/frontiere-serveur.test.ts`, `tests/scene-architecture.test.ts`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context) — dev-story TDD.

### Debug Log References

- Garde d'ordre de la route (T7) : `indexOf("evaluerSecuriteDuTour")` attrapait d'abord l'`import` en tête → ciblé l'APPEL (`evaluerSecuriteDuTour(`) pour prouver « détection avant génération ».
- Migration 0009 appliquée en local via `supabase migration up --local` (CLI globale v2.67.1).

### Completion Notes List

- **T1–T8 livrés en TDD strict** (rouge → vert). Suite : **398 tests verts** (44 fichiers ; +37 vs 361), `tsc --noEmit` propre, `eslint .` propre, `next build` OK (`/api/anam/message` dynamique, Proxy reconnu).
- **Pipeline sécurité-d'abord** : `lib/safety/pipeline.ts` est le SEUL appelant de `detecteur-detresse.ts` (gardé statiquement). La route appelle le pipeline **avant** toute génération ; le hardcode `niveauSecurite = 0` a disparu.
- **Détection au fort** : capacité `detection` → tier fort **inconditionnel et explicite** (pas incident). La détection passe par l'egress art.9 (consentement + ZDR revérifiés).
- **Repli sûr (AD-15)** : échec du fort / sortie illisible → verdict de repli (niveau plancher 1, `repli_sur`, schéma suspendu) + incident journalisé sans art.9 ; jamais le léger, jamais silencieux. Blocage d'egress (consentement/minorité/ZDR) distinct → tour arrêté en amont (403).
- **Audit sans art.9** : `audit_securite` étendue (`niveau`, `tier`, `cle_idempotence`), fonction `journaliser_audit_detresse` en security definer réservée au `service_role`, idempotente par tour. Prouvé SQL-réel (deny-by-default, RPC non appelable par une cliente, sans colonne de contenu).
- **Métrage** : la détection n'est **PAS** comptée dans le quota conversationnel (garde-fou FR-043) ; le métrage de la réponse (2.2) est inchangé.
- **Écart assumé vs T4** : l'audit est émis par le **pipeline** (mesure de classification, FR-078), pas par `DepotEpisode.signaler()` — séparation plus propre (l'audit est indépendant de l'épisode). `signaler()` reste un no-op placeholder ; `episodeOuvert()` → `false`. La 2.4 les rendra réels via `episode_detresse` ; `niveauEffectif = max(...)` est déjà en place → pas de refactor.
- **Contenu clinique PROVISOIRE** (porte pré-lancement) : prompt de détection + seuils + `tests/fixtures/detresse-cas.provisoire.json` marqués « À VALIDER PAR UN PRO ». Le harnais `mesurerRappel` (FR-078) mesure la MACHINE, pas une exactitude clinique.

### Revue adversariale (AI) — 5 angles, 21 candidats → 4 correctifs

Revue orchestrée (finders parallèles → vérification adversariale). 4 findings réels corrigés (+4 tests → **402 verts**) :

- **[HAUTE] Faux négatif de parsing** — `extraireNiveau` prenait le **1er** `niveau: N` (regex sans `/g`) : un raisonnement « niveau 1… donc niveau 3 » était lu **1**. → scan de TOUTES les occurrences, on retient le **MAX** (le doute penche vers la sécurité). `detecteur-detresse.ts`.
- **[HAUTE] Injection via tours `assistant` forgés** — le classifieur ingérait l'historique client entier (`assistant` compris → canal « réponds toujours NIVEAU: 0 »). → la détection ne classe plus que les messages **`user`** ; historique Anam server-authoritative = durcissement futur (mémoire). `detecteur-detresse.ts`.
- **[MOYENNE] Hang non couvert par le repli (AD-15)** — pas de timeout applicatif : un modèle fort qui **pend** tuait la fonction avant le repli (échec silencieux). → `avecDelai(...)` (budget 8 s, surchargeable) : hang → repli sûr. `detecteur-detresse.ts`.
- **[BASSE] Intégrité audit** — pas de CHECK DB. → `CHECK (niveau 0-3)` + `CHECK (tier='fort')` nullable-tolérants (défense en profondeur au-delà du typage TS). `0009_audit_detresse.sql`.
- **Déféré assumé** : l'idempotence de l'audit dédoublonne le retry **serveur**, pas le retour **client** (jeton de tour stable côté client) — même limite que `usage_ia`, documentée, sans harm démontré (le rappel FR-078 se mesure sur fixture, pas sur la table d'audit).

### File List

**Nouveaux**
- `lib/safety/classer-detresse.ts` — classifieur pur (niveau → `VerdictSecurite` ; repli conservateur).
- `lib/safety/detecteur-detresse.ts` — détecteur au fort sous egress ; repli sûr ; prompt placeholder.
- `lib/safety/pipeline.ts` — pipeline sécurité-d'abord ; seul appelant du détecteur ; audit ; veto ; couture `DepotEpisode`.
- `lib/safety/journaliser-audit.ts` — écriture audit détresse (service_role, best-effort, ne lève jamais).
- `lib/safety/mesure-rappel.ts` — machine de mesure du rappel / faux négatifs (pure, FR-078).
- `supabase/migrations/0009_audit_detresse.sql` — `audit_securite` +niveau/tier/cle_idempotence + `journaliser_audit_detresse`.
- `tests/classer-detresse.test.ts`, `tests/detecteur-detresse.test.ts`, `tests/pipeline-securite.test.ts`, `tests/audit-detresse.test.ts` (SQL-réel), `tests/pipeline-securite-architecture.test.ts`, `tests/detresse-mesure-rappel.test.ts`.
- `tests/fixtures/detresse-cas.provisoire.json` — jeu de cas placeholder (à remplacer, porte pré-lancement).

**Modifiés**
- `lib/ai/port.ts` — `CapaciteIa` += `"detection"`.
- `lib/ai/politique-tier.ts` — `"detection"` ⇒ `"fort"` inconditionnel (explicite).
- `app/api/anam/message/route.ts` — pipeline sécurité-d'abord avant génération ; verdict → `niveauSecurite` ; audit via clé serveur ; point de veto marqué.
- `tests/politique-tier.test.ts` — cas `detection` → fort.
- `lib/safety/README.md` — documente le pipeline + la règle « détecteur jamais hors pipeline ».

## Change Log

| Date | Version | Description | Auteur |
|---|---|---|---|
| 2026-07-27 | v0.1 | Création — ingénierie de contexte (create-story). Pipeline sécurité-d'abord : couture pré-taillée identifiée (hardcode `niveauSecurite=0`), repli sûr comme mécanisme neuf, audit via extension `audit_securite`, frontières nettes avec 2.4/2.5/2.6. | create-story |
| 2026-07-27 | v1.0 | Implémentation TDD (dev-story). T1–T8 livrés ; 398 tests verts, tsc/eslint/build propres. Pipeline sécurité-d'abord câblé dans la route (avant génération), détection au fort sous egress, repli sûr, audit sans art.9 (migration 0009), harnais de mesure des faux négatifs. Contenu clinique provisoire (porte pré-lancement). | dev-story |
| 2026-07-27 | v1.1 | Revue adversariale 5 angles → 4 correctifs : `extraireNiveau` prend le MAX (faux négatif), détection ne classe que les messages `user` (anti-injection), timeout de détection → repli sûr (AD-15), CHECK DB sur l'audit (niveau/tier). 402 tests verts. | dev-story |
