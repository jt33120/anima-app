---
baseline_commit: cd7f341
---

# Story 4.3: Le rappel opportun — la franchise par la comparaison

Status: done

## Story

En tant qu'**utilisatrice**,
je veux qu'**Anam me rappelle la bonne chose au bon moment plutôt que de tout ressasser**,
afin qu'**elle puisse me faire remarquer une répétition parce qu'elle a vraiment de quoi comparer**.

## Acceptance Criteria

1. **Rappel spécifique et opportun, pas un déversement (FR-065).** Étant donné un fil en cours, quand Anam prépare sa réponse, alors le contexte assemblé privilégie un **rappel spécifique et opportun** — un **résumé glissant** (l'état condensé de la conversation) **+** des **faits pertinents datés** — plutôt qu'un déversement de tout l'historique brut. L'assemblage est une **fonction domaine pure** (`lib/domain/`, AD-1) : elle sélectionne et met en forme, elle ne génère rien.

2. **La comparaison s'appuie sur des faits datés réels (FR-068).** Étant donné un thème que l'utilisatrice a déjà abordé auparavant, quand elle y revient, alors le contexte assemblé porte des **faits extraits datés** (`cree_le`/`maj_le`) permettant à Anam de faire remarquer la répétition en **citant un point de comparaison réel** — jamais une impression vague. Le rappel expose la **matière datée** ; l'intelligence qui *remarque* (le LLM d'Anam) reste hors périmètre (voir Cadrage PO).

3. **[DUR] Un tombstone n'est JAMAIS rappelé (AD-18, le cœur de la story côté lecture).** Étant donné qu'un fait a été **supprimé** ou **corrigé** (tombstone : `statut` `supprime`/`corrige`), quand le rappel est assemblé, alors **seuls les faits `actif`** alimentent la comparaison — un tombstone n'entre **jamais** dans un rappel. Garanti à **DEUX niveaux** : (a) la lecture possédée `charger_faits_actifs()` filtre `where statut = 'actif'` **en base** (le tombstone ne quitte jamais la base vers un rappel) ; (b) l'assembleur pur re-filtre défensivement `statut = 'actif'` **dans le domaine** (contrat pour tout futur appelant — export Epic 6, synthèse 4.9 — qui lui passerait un ensemble plus large). Les deux sont **mutation-vérifiés** et non redondants (miroir lecture de la double-défense d'écriture de 4.2 : clause `WHERE` + trigger).

4. **Le résumé glissant vit sous la frontière art. 9 (AD-4/AD-12/AD-14).** Étant donné le résumé glissant, quand il est persisté, alors la table `resume_glissant` naît **RLS deny-by-default** sous **JWT utilisatrice** (`auth.uid()`, jamais `service_role` applicatif), **chiffrée** au repos et en transit, avec un **write-gate** (`a_consenti_art9()` **et** `not est_barre_minorite()`) sur l'écriture ; la **lecture** (export) survit à la révocation ; l'effacement FR-067 le **purge** (`on delete cascade` depuis `utilisatrice` + table listée dans l'inventaire art. 9 effaçable, AD-14 nomme explicitement « résumé glissant »). Sur le futur **egress** (câblage 4.4), il ne partira **jamais** dans un cache tiers non-ZDR (`no-store`, AD-4) — contrat noté, egress hors périmètre 4.3.

5. **Aucun rappel inventé quand il n'y a pas de matière (FR-065, garde de sobriété).** Étant donné qu'aucun fait pertinent n'existe **et** qu'aucun résumé glissant n'est encore posé, quand le contexte est assemblé, alors l'assembleur renvoie une structure **vide et honnête** (`aDeLaMatiere = false`, `resume = null`, `faits = []`) — **jamais** une généralité fabriquée. L'absence de matière est un signal explicite pour qu'Anam ne rappelle rien, pas un trou comblé par du remplissage.

## Tasks / Subtasks

- [x] **T1 — Migration `0019_resume_glissant.sql` : réceptacle art. 9 possédé-JWT + lecture possédée des faits actifs (AC3, AC4)**
  - [x] RED : `tests/resume-glissant.test.ts` — la table `resume_glissant` existe, RLS `enable`+`force` ; colonnes exactes (`id uuid`, `utilisatrice_id uuid unique`, `contenu text`, `cree_le timestamptz`, `maj_le timestamptz`) ; index unique `(utilisatrice_id)` (un résumé par utilisatrice en v1 — le multi-séance est différé, cf. `seance` 0012) ; FK `utilisatrice_id` → `utilisatrice(id) on delete cascade` (purge FR-067).
  - [x] GREEN : créer la table en **copiant le write-gate DURCI** de `entree_journal`/`0016` (`a_consenti_art9()` **ET** `not est_barre_minorite()`). Trois policies : `select` (propriétaire, **survit à la révocation** → export), `insert` (write-gate durci), `update` (write-gate durci — rafraîchir le résumé = déposer du contenu art. 9). **Aucune** policy `delete` sous JWT (l'effacement FR-067 = `service_role`, Epic 6).
  - [x] GREEN : **fonction de lecture possédée** `public.charger_faits_actifs()` — **`security INVOKER`** (la RLS s'applique → ne voit que les faits de l'appelante), `set search_path=''`, `returns setof` de `(cle_dedoublonnage, contenu, cree_le, maj_le)` **où `statut = 'actif'`** (AC3 niveau (a) : le tombstone ne quitte jamais la base). `revoke execute … from public, anon` ; `grant execute … to authenticated`. **Elle préserve INTACTE la garde 4.2** (le littéral `fait_extrait` reste banni partout : on ajoute une lecture *possédée*, on n'assouplit pas le ban).
  - [x] GREEN : `comment on table resume_glissant` fidèle (art. 9, possédé sous JWT, résumé glissant AD-14, purge FR-067).
  - [x] Appliquer localement : `supabase migration up` (CLI **globale** v2.67.1, **jamais** `npx supabase`).

- [x] **T2 — Preuves RLS / write-gate / lecture des faits actifs au niveau base (AC3, AC4) — miroir de `fait-extrait.test.ts`**
  - [x] RED→GREEN dans `tests/resume-glissant.test.ts` (Supabase local) :
    - [x] **AC4** — le propriétaire lit/écrit son résumé ; une **autre** utilisatrice ne lit **rien** ; une session non authentifiée non plus (deny-by-default).
    - [x] **AC4/AD-13** — écriture **refusée sans consentement**, **refusée sous barrière minorité**, **refusée après révocation** ; la **lecture reste permise** après révocation (export FR-067 survit).
    - [x] **AC3 (base, DUR)** — `charger_faits_actifs()` renvoie **uniquement** les faits `actif` : semer un `actif` + un `corrige` + un `supprime` → la fonction ne renvoie que l'`actif` (mutation-cible : retirer `where statut='actif'` → le test devient rouge).
    - [x] **AC4/AC3** — un `DELETE` de `resume_glissant` sous JWT est **refusé** (aucune policy delete) ; un `DELETE` `service_role` **réussit** (siège de l'effacement FR-067).

- [x] **T3 — L'assembleur (domaine pur) : tombstone-safe, daté, non-invention (AC1, AC2, AC3, AC5)**
  - [x] `lib/domain/rappel.ts` (port **pur**, aucun I/O — AD-1) : types `FaitDate` (`cleDedoublonnage`, `contenu`, `statut`, `creeLe`, `majLe`), `Rappel` (`resume: string|null`, `faits: FaitRappel[]`, `aDeLaMatiere: boolean`), interface `DepotRappel` (`assembler(limite?)`, `enregistrerResume(contenu)`), et la fonction pure **`assemblerRappel({ resume, faits, limite })`**. RED : test de **pureté** (aucun import Next/Supabase/SDK).
  - [x] GREEN : `assemblerRappel` — (1) **filtre défensif `statut='actif'`** (AC3 niveau (b)) ; (2) **tri daté** décroissant sur `creeLe` (rappel = privilégier le récent/pertinent, base déterministe) ; (3) **sélection déterministe** plafonnée à `limite` (base de « pertinence » — le classement fin par embeddings est différé) ; (4) `resume` normalisé (`null` si vide/blanc) ; (5) **`aDeLaMatiere = resume !== null || faits.length > 0`** (AC5 : vide et honnête, jamais inventé).
  - [x] RED→GREEN (tests unitaires purs, sans base) : un tombstone dans l'entrée est **exclu** (AC3) ; l'ordre est daté décroissant ; `limite` plafonne ; entrée sans matière → `aDeLaMatiere=false`, `resume=null`, `faits=[]` (AC5) ; un résumé blanc `"   "` → `resume=null`.

- [x] **T4 — Le dépôt sous JWT (AC1, AC4) — le duo port/adaptateur à répliquer**
  - [x] `lib/data/depot-rappel.ts` (`import "server-only"`) : `creerDepotRappel(utilisatriceId)` implémente `DepotRappel` sous `createSupabaseServerClient()` (JWT) :
    - `assembler(limite?)` : lit le résumé (`.from("resume_glissant").select("contenu").maybeSingle()`) **et** les faits actifs (`.rpc("charger_faits_actifs")`) en parallèle, mappe vers `FaitDate`, délègue à `assemblerRappel`.
    - `enregistrerResume(contenu)` : `.from("resume_glissant").upsert({ utilisatrice_id, contenu }, { onConflict: "utilisatrice_id" })` (patron `depot-journal`). L'id est passé à la construction (backstop RLS : `auth.uid() = utilisatrice_id` rejette tout mismatch).
    - **Lève** sur erreur réelle ; **jamais** `contenu`/`cle_dedoublonnage` dans les logs (NFR-022 : code Postgres seul).
  - [x] RED→GREEN dans `tests/resume-glissant.test.ts` (bout-en-bout, Supabase local) : `enregistrerResume` puis `assembler` rend le résumé + les faits actifs datés ; un fait `supprime`/`corrige` semé n'apparaît **pas** dans `assembler()` (AC3 bout-en-bout) ; sans résumé ni fait → `aDeLaMatiere=false` (AC5 bout-en-bout).
  - [x] `tests/depot-rappel.test.ts` (client **mocké**, patron `depot-faits.test.ts`) : câblage exact (résumé via `.from(...).upsert`, faits via `.rpc("charger_faits_actifs")`), pureté de `lib/domain/rappel.ts`, adaptateur `server-only` + JWT (jamais `createSupabaseAdminClient`), NFR-022 (ni throw ni log ne porte le contenu).

- [x] **T5 — Gardes de source (AC3, AC4) : le ban `fait_extrait` reste intact + `resume_glissant` confiné**
  - [x] Étendre `tests/faits-architecture.test.ts` **CONSCIEMMENT** (le commentaire de 4.2 le prédisait) : le littéral `fait_extrait` reste **banni partout** (la lecture passe par la fonction possédée, pas par la table) ; ajouter que la RPC `charger_faits_actifs` n'est référencée **QUE** dans `lib/data/depot-rappel.ts` (comme `fusionner_fait_extrait` ↔ `depot-faits.ts`).
  - [x] `tests/rappel-architecture.test.ts` (ou section dédiée) : le littéral `resume_glissant` n'apparaît **QUE** dans `lib/data/depot-rappel.ts` (patron `frontiere-serveur.test.ts` / garde de table 4.2). Mutation-vérifiable (accès ailleurs → rouge). Contrôles positifs inline.

- [x] **T6 — Suite verte + gardes transverses (tout)**
  - [x] Toute la suite verte : `set -a && . ./.env.local && set +a && npx vitest run` (Supabase local **démarré** via CLI globale v2.67.1).
  - [x] Sondes art. 9 existantes **inchangées** ; `consentement.test.ts` (frontière art. 9 : réaligner si elle énumère les tables de contenu art. 9 — `resume_glissant` existe désormais). Garde 4.2 `faits-architecture.test.ts` **toujours verte** (ban `fait_extrait` intact).
  - [x] `npx tsc --noEmit`, `npx eslint`, `next build` propres.

## Dev Notes

### Le cœur en une phrase

La 4.3 est le **côté LECTURE de la mémoire** — le miroir de la 4.2 (qui a bâti le côté écriture). Elle livre un **assembleur de rappel** : une fonction domaine **pure** qui compose `{ résumé glissant + faits actifs datés }` pour qu'Anam puisse **remarquer une répétition en citant un point de comparaison réel** (FR-068), **sans jamais rappeler un tombstone** (AC3, [DUR]) ni **inventer** quand il n'y a pas de matière (AC5). Plus un **réceptacle** pour le résumé glissant (`resume_glissant`), art. 9 possédé sous JWT.

### Cadrage PO (Julian) — « l'assembleur d'abord » (miroir de « le réceptacle d'abord » de 4.2)

4.3 livre **uniquement le côté lecture possédé** : le réceptacle du résumé glissant, la lecture possédée des faits actifs, l'assembleur pur, et le dépôt sous JWT — le tout **prouvé bout-en-bout par tests avec des faits/résumés semés**. Ce qui est **explicitement DIFFÉRÉ** :

- **Le RÉDACTEUR du résumé glissant** (résumer une conversation = tâche **LLM**). En 4.3, le réceptacle se remplit par `enregistrerResume(contenu)` (persistance mécanique, testée avec du texte semé) ; **aucun générateur LLM en prod** (AD-4 interdit le stub-en-prod — un stub résumerait du vide silencieusement). Le vrai rédacteur arrive avec le « cerveau » (4.4) ou la synthèse périodique (4.9, sous l'ordonnanceur).
- **Le classement de PERTINENCE intelligent** (embeddings, scoring sémantique). En 4.3, base **déterministe** : faits actifs, triés par date décroissante, plafonnés par `limite`. L'ensemble actif est petit au début du produit ; le classement fin est une optimisation ultérieure. La couture est là (`limite`, tri daté).
- **Le CÂBLAGE dans le prompt live d'Anam** (pipeline Epic 2). Conséquence assumée, **identique à 4.2** : `fait_extrait` n'a **aucun rédacteur en production** avant 4.4 → en prod, `assembler()` rappellerait un ensemble vide. Câbler un rappel vide sur le chemin critique conversationnel n'a **aucune valeur bout-en-bout** et modifierait la réponse d'Anam sans matière à valider. On livre l'assembleur **possédé et appelable**, prouvé par tests ; le câblage rejoint 4.4, quand il y a de la matière à rappeler.

C'est délibéré et cohérent : on a bâti le coffre incorruptible (4.2), on bâtit maintenant la **serrure de lecture qui refuse de sortir un tombstone** (4.3), avant de brancher le cerveau qui remplit et interroge (4.4).

### État actuel (ce que 4.3 ajoute / préserve) — lecture faite du code

- **Les couches 1 et 2 existent (4.1, 4.2).** `entree_journal` (`0016`, verbatim immuable) et `fait_extrait` (`0018`, profil vivant idempotent, tombstones). La 4.3 **LIT** `fait_extrait` (les faits `actif` datés) pour la première fois — c'est la « future lecture » que le commentaire de `faits-architecture.test.ts` (4.2) **anticipait explicitement** (« une future lecture (Story 4.3)… devra l'assouplir CONSCIEMMENT »).
- **On honore la garde 4.2 SANS l'affaiblir.** Plutôt que d'autoriser `.from("fait_extrait").select()` dans `depot-rappel.ts` (ce qui rendrait le littéral de table présent hors `depot-faits.ts`), on ajoute une **lecture possédée** `charger_faits_actifs()` (security invoker, RLS s'applique). Résultat : le littéral `fait_extrait` reste **banni partout**, la règle tombstone (`where statut='actif'`) vit dans **un seul endroit possédé** en base (mutation-vérifiable), et la garde 4.2 reste **verte**. C'est mieux qu'un assouplissement.
- **Le socle de patterns est en place.** `entree_journal` (0016) = gabarit table art. 9 sous JWT ; `depot-journal.ts` (`.from().upsert()` confiné, id passé à la construction) = gabarit du réceptacle `resume_glissant` ; `fusion-fait.ts` + `depot-faits.ts` (port pur + adaptateur `server-only`) = gabarit du duo `rappel.ts` + `depot-rappel.ts` ; `faits-architecture.test.ts` = gabarit de la garde de source. Helpers write-gate `a_consenti_art9()` (0005) + `est_barre_minorite()` (0006) réutilisés tels quels.
- **Aucun changement de route ni de client en 4.3.** La route `app/api/anam/message/route.ts` n'est **pas** touchée (le câblage du rappel dans le prompt = 4.4).

### LE point de conception : le tombstone jamais rappelé (AC3, [DUR]) — la double-défense côté LECTURE

C'est le miroir de l'anti-résurrection de 4.2 (écriture), transposé à la lecture. Défense **en profondeur, à deux niveaux non redondants** :

1. **Niveau base — `charger_faits_actifs()` filtre `where statut = 'actif'`.** Le tombstone (`corrige`/`supprime`) ne **quitte jamais la base** vers un rappel. C'est la garde primaire (le chemin live). Mutation : retirer `and statut='actif'` → le test T2 devient rouge (un tombstone sort).
   ```sql
   create function public.charger_faits_actifs()
   returns table (cle_dedoublonnage text, contenu text, cree_le timestamptz, maj_le timestamptz)
   language sql stable security invoker set search_path = '' as $$
     select f.cle_dedoublonnage, f.contenu, f.cree_le, f.maj_le
     from public.fait_extrait f
     where f.utilisatrice_id = (select auth.uid())   -- explicite (la RLS le fait déjà sous invoker)
       and f.statut = 'actif';                        -- ← LE filtre tombstone (AC3 niveau a)
   $$;
   ```
2. **Niveau domaine — l'assembleur pur re-filtre `statut='actif'`.** `assemblerRappel` reçoit des `FaitDate` **portant `statut`** et **exclut** défensivement tout non-`actif`. Non redondant avec (1) : (1) protège le chemin live en base ; (2) protège le **contrat domaine** pour tout **autre** appelant qui passerait un ensemble plus large — l'export FR-067 (Epic 6) ou la synthèse périodique (4.9) réutiliseront `assemblerRappel` avec potentiellement tous les faits. Mutation (unitaire, hors base) : retirer le `.filter(actif)` → un tombstone semé dans l'entrée ressort → test T3 rouge.

C'est exactement l'esprit de la double-défense de 4.2 (clause `WHERE` de l'upsert **+** trigger dur) : deux gardes qui bloquent des vecteurs distincts, chacune mutation-vérifiée.

### La non-invention (AC5) : une garde structurelle, pas une décision LLM

L'assembleur ne **génère jamais** de contenu — il sélectionne et met en forme. Quand il n'y a ni résumé ni fait actif, la structure renvoyée est **vide et le dit** (`aDeLaMatiere=false`). C'est un **signal explicite** passé (plus tard) au prompt d'Anam pour qu'elle ne rappelle rien. L'invention ne peut venir que du LLM ; le contrat de l'assembleur — « passe de la vraie matière ou passe rien » — la rend impossible à ce niveau. Testé : entrée sans matière → `{ resume: null, faits: [], aDeLaMatiere: false }`.

### Le réceptacle `resume_glissant` : possédé-JWT (comme les faits), PAS server-authoritative (comme `seance`)

Décision de posture, à motiver explicitement :

- **`seance` (0012)** est **server-authoritative deny-by-default** (aucune policy, accès `security definer` service_role) parce que l'utilisatrice ne doit **jamais** lire ni forger sa phase (« nommage prématuré jouable »).
- **`resume_glissant`** n'a **aucun** enjeu de forge de ce type : c'est **sa** donnée, qu'elle pourra **voir** (« Ce qu'Anam retient », Epic 6) et qui doit être **effaçable** (FR-067) et **exportable**. Elle est donc **possédée sous JWT** — RLS + policies + write-gate — exactement comme `fait_extrait`/`entree_journal`. Pas `security definer`, pas deny-by-default nu.
- **Cardinalité v1 : un résumé par utilisatrice** (`unique (utilisatrice_id)`, upsert), aligné sur `seance` (une séance courante par utilisatrice). Le multi-séance (résumé par fil) est **différé** avec le cycle multi-séances (deferred-work) — couture notée, pas de FK vers `seance` (qui est deny-by-default → invisible sous JWT).

### Le duo à répliquer : port pur + adaptateur (jamais service_role, jamais SDK)

- **`lib/domain/rappel.ts`** (domaine PUR, AD-1) :
  ```ts
  import type { StatutFait } from "@/lib/domain/fusion-fait"; // domaine → domaine (pur), OK
  export interface FaitDate { cleDedoublonnage: string; contenu: string; statut: StatutFait; creeLe: string; majLe: string; }
  export interface FaitRappel { cleDedoublonnage: string; contenu: string; creeLe: string; majLe: string; }
  export interface Rappel { resume: string | null; faits: FaitRappel[]; aDeLaMatiere: boolean; }
  export interface DepotRappel {
    /** Assemble le rappel opportun sous JWT : résumé glissant + faits actifs datés (jamais un tombstone). */
    assembler(limite?: number): Promise<Rappel>;
    /** Persiste le résumé glissant (le contenu vient du futur rédacteur LLM — 4.4/4.9). */
    enregistrerResume(contenu: string): Promise<void>;
  }
  export function assemblerRappel(entree: { resume: string | null; faits: FaitDate[]; limite?: number }): Rappel { /* pur */ }
  ```
- **`lib/data/depot-rappel.ts`** (`import "server-only"`) : `creerDepotRappel(utilisatriceId)` sous `createSupabaseServerClient()` (JWT). `assembler` lit résumé (`.from`) + faits (`.rpc("charger_faits_actifs")`) et délègue au pur. `enregistrerResume` fait l'`.upsert()` (patron `depot-journal`). Lève sur erreur réelle, jamais d'art. 9 en clair (NFR-022).

### Invariants durs (à ne pas violer)

- **AD-18** — les tombstones respectés **aussi à la lecture** : `charger_faits_actifs()` + filtre pur. **AD-8** — couche mémoire ; le rappel lit les faits (couche 2) datés. **AD-4** — `resume_glissant` chiffré, art. 9, jamais de contenu/clé en clair dans les logs (NFR-022) ; sur egress (4.4) `no-store`/ZDR. **AD-12** — RLS sous JWT, jamais `service_role` applicatif ; table art. 9 sans policy = feature cassée (sonde vivante). **AD-13** — write-gate `a_consenti_art9()` + `not est_barre_minorite()`. **AD-14** — `resume_glissant` **nommé** dans l'inventaire art. 9 effaçable ; purge par `on delete cascade` + moteur d'effacement (Epic 6).
- **AD-1** — dépendances descendantes : `lib/domain/rappel.ts` (pur) → `lib/data/depot-rappel.ts` (I/O sous JWT). Le domaine n'importe jamais l'infra (test de pureté). `rappel.ts` → `fusion-fait.ts` (domaine → domaine) autorisé.
- **AD-16** — quand le rappel sera injecté dans le prompt (4.4), ce sera dans le pipeline sécurité-d'abord (sécurité AVANT rappel) ; **hors périmètre 4.3**, noté pour ne pas bâtir à contre-sens.

### Testing standards

- Vitest (env node) ; **Supabase local requis** ; commande : `set -a && . ./.env.local && set +a && npx vitest run`. CLI Supabase **globale** v2.67.1, **jamais** `npx supabase`.
- Tests base : `admin` (`SUPABASE_SECRET_KEY`) pour semer/nettoyer + prouver le `delete` service_role ; session `publishable` pour RLS/write-gate (patrons `fait-extrait.test.ts`, `entree-journal.test.ts`). Helpers réutilisés : `creerUtilisatrice`, `donnerConsentement`, `graverSource` (copier depuis `fait-extrait.test.ts`).
- **Mutation-vérification obligatoire** sur les gardes DURES : retirer `where statut='actif'` de `charger_faits_actifs()` → test AC3 base rouge ; retirer le `.filter(actif)` de `assemblerRappel` → test AC3 pur rouge ; retirer la garde `aDeLaMatiere` (forcer `true`) → test AC5 rouge ; ajouter un accès `resume_glissant`/`charger_faits_actifs` hors `depot-rappel.ts` → garde T5 rouge.
- Garde de source (T5) : patron `faits-architecture.test.ts` — lire le code, retirer les commentaires, ancrer sur le **littéral de table**/le nom de RPC ; contrôles positifs inline (le regex DOIT matcher un vrai littéral).

### Project Structure Notes

- **NOUVEAUX** : `supabase/migrations/0019_resume_glissant.sql`, `lib/domain/rappel.ts`, `lib/data/depot-rappel.ts`, `tests/resume-glissant.test.ts`, `tests/depot-rappel.test.ts`, `tests/rappel-architecture.test.ts`.
- **MODIFIÉS** : `tests/faits-architecture.test.ts` (extension consciente : ban `fait_extrait` maintenu + confiner `charger_faits_actifs`) ; `tests/consentement.test.ts` (si elle énumère les tables art. 9 — `resume_glissant` s'ajoute) ; `_bmad-output/implementation-artifacts/deferred-work.md` (OPS : `0019` à la liste des migrations cloud ; couture rédacteur LLM + câblage prompt en 4.4).
- **NON TOUCHÉ** : `app/api/anam/message/route.ts`, aucun fichier client, `lib/ai/port.ts`.
- Conventions : `snake_case`, `id uuid`, `timestamptz` UTC, fichiers `kebab-case`, port pur + adaptateur `server-only`.

### References

- [Source: epics.md#Story-4.3] (AC 1-5) ; #Epic-4 (rappel spécifique, franchise par la mémoire).
- [Source: ARCHITECTURE-SPINE.md#AD-18] (tombstones respectés aussi à la lecture) ; #AD-8 (mémoire 3 couches) ; #AD-4 (frontière art. 9, résumé glissant sous la frontière) ; #AD-12 (RLS non contournable) ; #AD-13 (write-gate) ; #AD-14 (« résumé glissant » nommé, purge à l'effacement) ; #AD-1 (dépendances descendantes) ; #AD-16 (pipeline sécurité-d'abord, pour 4.4).
- [Source: prd.md#FR-065] (rappel spécifique et opportun) ; #FR-068 (franchise rendue possible par la mémoire) ; #FR-066 (synthèse — le rédacteur du résumé, différé) ; #FR-067 (effacement) ; #NFR-022 (pas d'art. 9 en clair).
- Story précédente : [4-2-faits-extraits-...md] (double-défense anti-résurrection, port/dépôt, garde de source, le commentaire qui anticipait cette lecture).
- Code : `supabase/migrations/0018_fait_extrait.sql` (la table lue) ; `0016_entree_journal.sql` (gabarit table art. 9) ; `0012_seance.sql` (posture server-authoritative — le contraste) ; `0005`/`0006` (write-gate helpers) ; `lib/domain/fusion-fait.ts` + `lib/data/depot-faits.ts` + `lib/data/depot-journal.ts` (duos à répliquer) ; `tests/fait-extrait.test.ts` (helpers + patron base) ; `tests/faits-architecture.test.ts` (garde à étendre).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (1M context) — dev-story TDD red-green + mutation-vérification.

### Debug Log References

- **T1** RED : `resume-glissant.test.ts` → 7 échecs (table/fonction absentes). GREEN après `0019` appliqué (CLI globale v2.67.1) → 10/10.
- **MUT1** (garde base tombstone) : `charger_faits_actifs()` SANS `where statut='actif'` (via docker psql) → le test AC3 devient ROUGE (le tombstone `corrige-` fuit) ; fonction restaurée → vert. Prouve que le filtre base mord.
- **T3** GREEN 9/9 (assembleur pur : tombstone exclu, tri daté, `limite`, non-invention, résumé blanc→null).
- **MUT2** (filtre pur) : `assemblerRappel` sans `.filter(actif)` → tests tombstone ROUGES ; restauré → vert. **MUT3** (non-invention) : `aDeLaMatiere = true` forcé → tests AC5 ROUGES ; restauré → vert. Les deux gardes domaine mordent.
- **T4** GREEN — mock de câblage (résumé `.from`, faits `.rpc("charger_faits_actifs")`, délégation au pur, lève sur erreur) + bout-en-bout base (chemin réel JWT nourrit `assemblerRappel` : résumé + 2 actifs datés, tombstone absent, ordre récent d'abord ; sans matière → vide honnête). Correctif : insert par lot PostgREST exige des clés uniformes (`cree_le` sur chaque ligne).
- **T5** GREEN 6/6. **MUT4** : fichier temporaire `lib/data/_mut-rappel.ts` avec `.from("resume_glissant")` + `charger_faits_actifs` → les deux gardes (faits-architecture étendue + rappel-architecture) ROUGES ; fichier supprimé → vert.
- **T6** : **1061 tests verts** (+34, 94 fichiers) au 2ᵉ run (1ᵉʳ run à froid : flakiness rate-limit auth, non déterministe) ; `tsc`/`eslint`/`next build` propres ; `supabase db reset` rejoue toutes les migrations depuis les fichiers (0019 inclus) → 48/48 des tests 4.3 verts sur la DB reconstruite.

### Completion Notes List

- **Rappel opportun livré (côté LECTURE de la mémoire)** : l'assembleur pur `assemblerRappel` compose `{ résumé glissant + faits actifs datés }` — tombstone-safe, daté, non-inventé — et le dépôt `creerDepotRappel` sous JWT (lecture résumé + faits via la fonction possédée `charger_faits_actifs`, écriture résumé en upsert).
- **Réceptacle `resume_glissant`** : art. 9 **possédé-JWT** (RLS + policies + write-gate durci `a_consenti_art9()` + `not est_barre_minorite()`), contraste motivé vs `seance` (server-authoritative). Lecture survit à la révocation (export FR-067) ; aucune policy delete (effacement = service_role) ; purge par `on delete cascade`.
- **Double-défense tombstone côté lecture (AC3 [DUR])** : `charger_faits_actifs()` filtre `statut='actif'` **en base** (MUT1) **+** `assemblerRappel` re-filtre **dans le domaine** (MUT2). Non redondants (base = chemin live ; domaine = contrat pour export/synthèse futurs). Non-invention (AC5) mutation-vérifiée (MUT3).
- **Garde 4.2 PRÉSERVÉE INTACTE** : la « future lecture » anticipée par `faits-architecture.test.ts` est HONORÉE sans affaiblir le ban — la lecture passe par la fonction possédée `charger_faits_actifs`, le littéral `fait_extrait` reste banni partout. `charger_faits_actifs` confinée à `depot-rappel.ts` ; littéral `resume_glissant` confiné à `depot-rappel.ts` (MUT4).
- **Cadrage « l'assembleur d'abord »** : aucun rédacteur LLM du résumé (4.4/4.9), aucun classement pertinence par embeddings, aucun câblage de prompt. Aucun appelant de production n'interroge encore l'assembleur (délibéré — pas de matière avant 4.4).
- Validation : **1061 tests verts** (+34), `tsc`/`eslint`/`next build` propres, db reset propre depuis les fichiers.

### File List

- **NOUVEAU** `supabase/migrations/0019_resume_glissant.sql`
- **NOUVEAU** `lib/domain/rappel.ts`
- **NOUVEAU** `lib/data/depot-rappel.ts`
- **NOUVEAU** `tests/resume-glissant.test.ts`
- **NOUVEAU** `tests/rappel.test.ts`
- **NOUVEAU** `tests/depot-rappel.test.ts`
- **NOUVEAU** `tests/rappel-architecture.test.ts`
- **MODIFIÉ** `tests/faits-architecture.test.ts` (extension consciente : ban `fait_extrait` maintenu + `charger_faits_actifs` confinée à `depot-rappel.ts`)
- **MODIFIÉ** `tests/consentement.test.ts` (fidélité frontière art. 9 : `resume_glissant` existe désormais)

### Écarts vs le plan indicatif de la story (documentés, red-green)

1. **`tests/rappel.test.ts` séparé** (non listé initialement) : les tests unitaires PURS de `assemblerRappel` (sans base) ont leur propre fichier — ordre TDD propre (T3 rouge avant que `depot-rappel` existe). `depot-rappel.test.ts` garde le câblage mocké + les gardes de pureté/NFR-022.
2. **`maj_le` : d'abord bumpé côté app, puis corrigé en trigger base (revue 4.3, D).** L'implémentation initiale posait `maj_le: new Date().toISOString()` côté app (le défaut SQL `now()` ne joue qu'à l'insert). La revue a signalé la non-monotonie (horloge Node vs ordre de commit, `maj_le < cree_le` possible). **Résolu (v1.1)** : trigger base `resume_glissant_touch_maj` (`maj_le = now()` sur insert+update) + retrait du `new Date()` applicatif → base autoritaire, cohérent avec `fait_extrait`.

## Revue adversariale (AI) — 4.3

Workflow 6 angles (finders **Sonnet** — diversité de modèle ; vérificateurs **Opus** biais-réfutation). **18 agents, ~1,27 M tokens. 12 trouvailles brutes → 6 retenues (CONFIRME/PLAUSIBLE) → 6 corrigées + mutation-vérifiées, le reste réfuté.**

**Le cœur a tenu** : la thèse « double-défense tombstone illusoire » (le mapping `statut:"actif"` de `depot-rappel` masquerait un tombstone) a été **réfutée** — le filtre pur EST testé indépendamment avec des tombstones (`rappel.test.ts`), et `charger_faits_actifs` filtre déjà en base ; l'**isolation** de `charger_faits_actifs` (inter-tenant) : **0 trouvaille** ; l'asymétrie write-gate résumé vs `fait_extrait` (pas de « vider ») : **réfutée** (le résumé n'a pas de suppression utilisatrice — overwrite-only, effacement service_role).

**Corrigées (toutes mutation-vérifiées) :**
- **A (HAUTE)** — la garde NFR-022 était un **regex statique aveugle** au dump d'objet (`console.error(faitsRes)` ferait fuir l'art. 9 en clair sans être détecté ; le code actuel ne fuit pas, mais le filet était insuffisant). **Fix :** test **RUNTIME** qui espionne `console` + inspecte l'erreur levée avec des secrets art. 9 semés dans `data` ET `error`. **MUT-A** : en injectant un `console.error({resumeRes, faitsRes})`, le test runtime **rougit** pendant que l'ancien regex statique **reste vert** — preuve que le runtime est strictement plus fort.
- **B (MOY)** — pas de **départage** sur `cree_le` → ordre/sélection sous `limite` non déterministe en cas d'égalité (futur batch multi-faits 4.4 en une transaction = même `now()`). **Fix :** clé secondaire `cle_dedoublonnage` (unique/opaque) aux **deux** niveaux (SQL `order by … , cle_dedoublonnage asc` + tri domaine). **MUT-B**.
- **C (MOY)** — le **périmètre** des gardes ne scannait que `app/lib/render` en `.ts/.tsx` → `proxy.ts` (racine, chaque requête) et `scripts/*.mjs` (dont un futur `purge-*.mjs` en service_role qui BYPASS la RLS) échappaient ; prose « PARTOUT/NULLE PART » sur-large. **Fix :** scan étendu (`scripts` + racine `proxy.ts`/`instrumentation.ts` + `.mjs/.js/.jsx`) sur les **deux** gardes 4.3 + prose corrigée. **MUT-C** (un `.mjs` de `scripts/` référant la table rougit les gardes). Dette transverse notée (les ~5 autres gardes de source partagent l'angle mort).
- **D (MOY)** — `maj_le` calculé **côté app** (horloge Node, non monotone sous concurrence/skew ; `maj_le < cree_le` possible), en rupture avec `fait_extrait` (`now()` base). **Fix :** trigger base `resume_glissant_touch_maj` (`before insert or update → maj_le = now()`) + retrait du `new Date()` applicatif. **MUT-D** (trigger retiré → le bump/override rougit).
- **E (BASSE)** — `.trim()` rate les invisibles Unicode `\p{Cf}` (U+200B zéro-largeur) → faux positif de matière (AC5). **Fix :** helper `estBlanc` (`\p{White_Space}` + `\p{Cf}`). **MUT-E**.
- **F (BASSE)** — le regex `TABLE_LITERAL` (nom collé entre quotes) ratait le **SQL brut** (`from fait_extrait …`) et le nom **qualifié** (`"public.fait_extrait"`). **Fix :** frontière de mot `\bfait_extrait\b` / `\bresume_glissant\b` (exclut toujours les RPC possédées, `_`-préfixées) + contrôles positifs SQL brut/qualifié inline.

**Réfutées (non corrigées, à raison) :** double-défense « illusoire » (le filtre pur est bien testé) ; `aDeLaMatiere` post-troncature (sémantique correcte — il décrit le rappel ASSEMBLÉ, pas le stock) ; impureté ISO `localeCompare` (déterministe sur ISO canoniques) ; `creeLe` malformé → TypeError (aucun crash, V8 n'appelle pas le comparateur sur 2 éléments dont l'ordre est fixé) ; asymétrie self-clear write-gate résumé (pas de « vider » utilisatrice — overwrite-only).

## Change Log

| Date | Version | Description | Auteur |
|---|---|---|---|
| 2026-07-30 | 0.1 | Création de la story (analyse exhaustive : SPINE AD-18/AD-8/AD-4/AD-12/AD-13/AD-14, PRD FR-065/068, patterns code réels — faits 4.2, journal 4.1, seance 2.7). Cadrage PO « l'assembleur d'abord » (miroir de « le réceptacle d'abord » : rédacteur LLM + classement pertinence + câblage prompt différés). Conception figée : réceptacle `resume_glissant` art. 9 possédé-JWT (contraste motivé vs `seance` server-authoritative), lecture possédée `charger_faits_actifs()` qui **préserve intacte** la garde 4.2, assembleur pur avec double-défense tombstone (base + domaine) et garde de non-invention. | Create-Story (Opus 4.8) |
| 2026-07-30 | 1.1 | Revue adversariale (6 angles, 18 agents, finders Sonnet / vérif Opus biais-réfutation, 12 trouvailles → 6 retenues). 6 corrigées + mutation-vérifiées : A (garde NFR-022 runtime vs regex statique aveugle, MUT-A), B (départage déterministe `cle_dedoublonnage` SQL+domaine, MUT-B), C (périmètre de scan des gardes étendu scripts/racine/.mjs + prose, MUT-C), D (trigger base `maj_le` au lieu de l'horloge app, MUT-D), E (invisibles Unicode `\p{Cf}`, MUT-E), F (frontière de mot pour le nom de table, contrôles positifs SQL brut/qualifié). Le cœur a tenu : double-défense tombstone, isolation `charger_faits_actifs`, write-gate résumé — tous réfutés côté attaque. **1066 tests verts** (+5), db reset propre depuis les fichiers, tsc/eslint/build propres. | Revue + corrections (Opus 4.8) |
| 2026-07-30 | 1.0 | Implémentation TDD T1→T6 (baseline `cd7f341`). Migration `0019` (réceptacle `resume_glissant` art. 9 possédé-JWT + write-gate durci + lecture possédée `charger_faits_actifs`) + port pur `lib/domain/rappel.ts` (`assemblerRappel`) + dépôt `lib/data/depot-rappel.ts` (JWT). Double-défense tombstone côté lecture mutation-vérifiée (MUT1 filtre base, MUT2 filtre domaine, non redondants) ; non-invention mutation-vérifiée (MUT3) ; gardes de source mutation-vérifiées (MUT4) — **la garde 4.2 reste intacte** (ban `fait_extrait` maintenu, la lecture passe par la fonction possédée). Cadrage tenu : rédacteur LLM + classement pertinence + câblage prompt différés (4.4). **1061 tests verts** (+34), db reset propre depuis les fichiers, tsc/eslint/build propres. Statut → review. | Dev-Story (Opus 4.8) |
