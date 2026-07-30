---
baseline_commit: 7ab4dcf
---

# Story 4.1: Le journal brut — la première couche, verbatim et inaltérable

Status: done

## Story

En tant qu'**utilisatrice**,
je veux que **chacun de mes mots soit conservé exactement tel que je les ai écrits**,
afin qu'**Anam se souvienne de moi sans jamais déformer ce que j'ai dit**.

## Acceptance Criteria

1. **Verbatim horodaté (AD-8).** Étant donné un tour que j'écris en conversation, quand il est enregistré, alors il est stocké dans `entree_journal` **mot pour mot** (`contenu` = le message brut, sans transformation), avec un `cree_le` `timestamptz` en UTC (sérialisé ISO 8601), **et** il n'est jamais réécrit ni modifié par le produit ensuite.

2. **Append-only, immuable (AD-8/AD-14).** Étant donné une entrée déjà écrite, quand le produit tente une écriture courante dessus, alors **seule l'insertion est permise** : toute **mise à jour est refusée** (immuabilité dure, y compris `service_role`) et toute **suppression courante sous JWT est refusée** — l'effacement au titre du droit (FR-067) restant la **seule exception**, exécuté par le moteur de rétention (`service_role`, Epic 6), jamais par le chemin de conversation.

3. **Frontière art. 9 + write-gate (AD-4/AD-12/AD-13).** Étant donné la frontière de données sensibles, quand la table `entree_journal` est créée, alors elle naît **RLS deny-by-default**, accessible **uniquement sous le JWT de l'utilisatrice** (`auth.uid()`, jamais `service_role` sur le chemin applicatif), chiffrée au repos et en transit, **et** aucune insertion n'est possible sans **consentement art. 9 valide et non révoqué** (`public.a_consenti_art9()`) — la lecture (export) restant possible même après révocation.

4. **Aucune entrée perdue — capture indépendante du traitement (NFR-017).** Étant donné une coupure réseau ou un échec de génération au moment de l'envoi, quand le tour est (ré)émis, alors le verbatim est gravé **avant** toute génération et **indépendamment** de son issue (échec modèle, coupure de quota 3.4, détresse) ; l'écriture est **idempotente par le jeton de tour** (réutilisé au « Réessayer »/à la reconnexion) → **exactement une entrée** ; un échec d'écriture renvoie 500 (le client garde le message + « Réessayer », 2.2) plutôt que de perdre silencieusement l'entrée.

5. **Identifiant stable = extrait source (AD-8).** Étant donné qu'une branche ou un fait devra pointer vers son origine, quand une entrée est écrite, alors elle porte un **`id` `uuid` stable** (immuable) utilisable comme `extrait_source`, positionnant le **message exact** (pas la journée, pas la séance) — référencé plus tard par `branche`/`fait_extrait`/`lecture` (Epic 4/5).

## Tasks / Subtasks

- [x] **T1 — Migration `0016_entree_journal.sql` : table + RLS + write-gate + immuabilité (AC1, AC2, AC3, AC5)**
  - [x] RED : `tests/entree-journal.test.ts` — la table existe, RLS `enable`+`force`, colonnes exactes (`id uuid`, `utilisatrice_id uuid`, `role text`, `contenu text`, `cle_tour text`, `cree_le timestamptz`), `id` est un `uuid`, `cree_le` un `timestamptz` par défaut `now()`.
  - [x] GREEN : créer la table en **copiant le write-gate de `art9_temoin`** (`0005`), avec la **variance append-only** documentée en Dev Notes (deux policies séparées, pas de `for all` ; trigger d'immuabilité).
  - [x] Index unique `(utilisatrice_id, cle_tour, role)` (idempotence par tour logique) + index `(utilisatrice_id, cree_le)` (lecture ordonnée future).
  - [x] `comment on table` fidèle (art. 9, immuable, `id` = extrait_source, effacement = seule exception).
  - [x] Appliquer localement : `supabase migration up` (CLI **globale** v2.67.1, jamais `npx supabase`).

- [x] **T2 — Preuves RLS / write-gate / append-only (AC2, AC3) — miroir vivant de `write-gate-art9.test.ts`**
  - [x] RED→GREEN dans `tests/entree-journal.test.ts` (Supabase local) :
    - [x] **AC3** — le propriétaire lit ses entrées ; une **autre** utilisatrice n'en lit **aucune** ; une session non authentifiée n'en lit aucune (deny-by-default).
    - [x] **AC3/AD-13** — insertion **refusée sans consentement** ; **refusée après révocation** (`revoked_at`/`art9_accorde=false`) ; la **lecture reste permise** après révocation (export FR-067 survit).
    - [x] **AC2** — une **mise à jour** (`update`) est refusée (le trigger lève, y compris `service_role`) ; une **suppression sous JWT** est refusée (aucune policy `delete`) ; une suppression `service_role` **réussit** (siège de l'effacement Epic 6, prouvé nominalement).
    - [x] **AC1** — le `contenu` relu est **strictement identique** à l'inséré (aucune transformation), `cree_le` présent.

- [x] **T3 — Idempotence & inaltérabilité du verbatim (AC1, AC4)**
  - [x] RED→GREEN : upsert deux fois la **même** `(utilisatrice_id, cle_tour, role)` avec un `contenu` **différent** → **une seule ligne**, le contenu **d'origine préservé** (`ignoreDuplicates` + immuabilité).
  - [x] `cle_tour` différent → deux lignes ; **même** `cle_tour` mais `role` différent (`utilisatrice`/`anam`) → deux lignes (un tour logique = un côté chacun).
  - [x] `id` relu = `uuid` **stable** (inchangé entre deux lectures) → contrat `extrait_source` (AC5).

- [x] **T4 — Port + dépôt sous JWT (AC1, AC3, AC4)**
  - [x] `lib/domain/depot-journal.ts` (port **pur**) : `DepotJournal.consigner(entree)`, types `RoleJournal`, `EntreeAConsigner` (`cleTour`, `role`, `contenu`). RED : test de **pureté** (aucun import infra dans le fichier domaine).
  - [x] `lib/data/depot-journal.ts` (`import "server-only"`) : `creerDepotJournal(utilisatriceId)` → `consigner` **upsert** sous `createSupabaseServerClient()` (JWT), `onConflict: "utilisatrice_id,cle_tour,role", ignoreDuplicates: true` ; **lève** sur erreur réelle ; erreurs loggées **sans art. 9** (jamais `contenu`).
  - [x] RED→GREEN : `creerDepotJournal(u).consigner(...)` grave une ligne ; deux `consigner` de même `cleTour` → une ligne (idempotence de bout en bout, miroir de `lire-allocation.test.ts`).

- [x] **T5 — Intégration route conversation (AC1, AC4) — `app/api/anam/message/route.ts`**
  - [x] GREEN : graver le **dernier message si `role === "user"`** via `creerDepotJournal(user.id).consigner({ cleTour: cleIdempotence, role: "utilisatrice", contenu })`, **awaité**, placé **APRÈS** la garde `securite.bloque` et **AVANT** le gate d'allocation (3.4) et `diffuserSousEgressArt9`. Échec → `return 500` (`ENTETES_ART9`), pas de perte silencieuse.
  - [x] RED→GREEN : `tests/journal-route.test.ts` (gardes de source, patron `gate-quota.test.ts`) — import présent ; appel awaité ; `cleTour: cleIdempotence` + `role: "utilisatrice"` ; ordonné **avant** `doitCouperConversation` **et** `diffuserSousEgressArt9` mais **après** le `return` de `securite.bloque` ; garde `role === "user"` sur le dernier message ; 500 sur échec.
  - [x] **Non-régression** : le gate d'allocation (3.4), l'ordre sécurité-d'abord (AD-16), l'étage arc (2.7) et le métrage (`usage_ia`, clés `:arc`/`:bilan`) restent **inchangés**.

- [x] **T6 — Suite verte + gardes transverses**
  - [x] Toute la suite verte : `set -a && . ./.env.local && set +a && npx vitest run` (Supabase local **démarré** via CLI globale).
  - [x] `usage-ia.test.ts` (schéma exact) **inchangé** ; `frontiere-serveur.test.ts` (fuite SDK) **inchangé** ; la sonde vivante `write-gate-art9.test.ts` (`art9_temoin`) reste verte.
  - [x] `npx tsc --noEmit`, `npx eslint`, `next build` propres.

## Dev Notes

### Le cœur en une phrase

`entree_journal` est la **couche 1 de la mémoire** (AD-8) : le **verbatim brut** des tours, **art. 9**, **possédé par l'utilisatrice sous JWT**, **immuable**, gravé **tôt et inconditionnellement** dans la route, **idempotent par le jeton de tour** — sur lui pointeront branches, faits et lectures.

### État actuel (ce que 4.1 change / préserve) — lecture faite du code

- **Le verbatim n'est stocké NULLE PART aujourd'hui.** `usage_ia` (0008) = métrage sans contenu ; `seance` (0012) = signaux d'arc sans verbatim ; `episode_detresse` (0010) = état de détresse sans contenu. Le journal 3 couches est **explicitement différé à Epic 4** (`0012:14-15`), et le nom `journal` est **déjà réservé** comme future table art. 9 (`0005:37,57`). **4.1 introduit la première table de CONTENU art. 9.**
- **La route `app/api/anam/message/route.ts` est le point d'intégration.** Elle possède déjà : le client JWT `supabase` (`:57`), `user.id` (`:59`), `cleIdempotence` = jeton de tour stable (3.4, `:81-82`), le pipeline sécurité (`:88-117`), le gate d'allocation (`:161-212`), l'étage arc (`:220-247`), le métrage en `after()` (`:473-484`). **4.1 insère UN bloc d'écriture journal** entre la garde sécurité et le gate d'allocation — **sans toucher** au reste.
- **Aucun changement client.** Le client envoie déjà `{ messages, jetonTour }` (3.4) et garde le tour + « Réessayer » en échec (2.2). 4.1 est **serveur + base uniquement**.

### Pattern à COPIER : `art9_temoin` (0005) — contenu art. 9 sous JWT

⚠️ **Ne PAS copier `seance`/`usage_ia`** (service_role, deny-by-default, server-authoritative) : le journal est **possédé et exportable** par l'utilisatrice. Le gabarit canonique est **`art9_temoin`** (`0005:39-57`), désigné nommément comme modèle du futur `journal`. On reprend : `enable`+`force` RLS, FK `on delete cascade` vers `public.utilisatrice(id)`, `id uuid default gen_random_uuid()`, `cree_le timestamptz default now()`, et le **write-gate `public.a_consenti_art9()`** (fonction `stable security definer` déjà existante, `0005:17-34`, **réutilisée telle quelle**, aucun trigger de consentement à ajouter).

### Variance DÉLIBÉRÉE vs `art9_temoin` (documentée — le journal est spécial)

`art9_temoin` utilise **une** policy `for all` (owner peut update/delete). Le journal est **immuable** (AD-8, titre « inaltérable ») → on **dévie** :

1. **Deux policies séparées** au lieu de `for all` :
   - `for select using (auth.uid() = utilisatrice_id)` — lecture propriétaire (export FR-067, survit à la révocation).
   - `for insert with check (auth.uid() = utilisatrice_id and public.a_consenti_art9())` — write-gate.
   - **Aucune** policy `update`/`delete` → refus deny-by-default sous JWT (**AC2**). L'effacement (FR-067) passe par `service_role` (moteur de rétention, Epic 6).
2. **Trigger `before update` qui lève** → immuabilité **dure**, y compris `service_role` (que la RLS **ne borne pas** : `bypassrls`). L'effacement supprime des **lignes** (`delete`), jamais un `update` → non affecté.
3. **Colonne `role` (`utilisatrice`|`anam`)** posée maintenant, écrite **seulement** `utilisatrice` en 4.1. Motif : « Voir dans la conversation » (4.6) et la lecture « échange source » (Epic 5) auront besoin des tours d'Anam ; l'inclure évite une **migration de la contrainte d'unicité** `(…, role)` après coup. L'index unique `(utilisatrice_id, cle_tour, role)` supporte les deux côtés partageant un jeton.

### SQL de référence (migration `0016`)

```sql
create table public.entree_journal (
  id              uuid        primary key default gen_random_uuid(),
  utilisatrice_id uuid        not null references public.utilisatrice(id) on delete cascade,
  role            text        not null default 'utilisatrice' check (role in ('utilisatrice','anam')),
  contenu         text        not null,                 -- VERBATIM, mot pour mot (AC1)
  cle_tour        text        not null,                 -- idempotence par tour LOGIQUE (jeton 3.4)
  cree_le         timestamptz not null default now()
);

create unique index entree_journal_tour_unique
  on public.entree_journal (utilisatrice_id, cle_tour, role);
create index entree_journal_utilisatrice_idx
  on public.entree_journal (utilisatrice_id, cree_le);

alter table public.entree_journal enable row level security;
alter table public.entree_journal force  row level security;

-- Append-only (AC2) : lecture propriétaire + insertion write-gatée ; AUCUNE update/delete.
create policy entree_journal_lecture on public.entree_journal
  for select using (auth.uid() = utilisatrice_id);

create policy entree_journal_insertion on public.entree_journal
  for insert with check (auth.uid() = utilisatrice_id and public.a_consenti_art9());

-- Immuabilité dure (AD-8) : refuse TOUT update, même service_role.
create or replace function public.entree_journal_refuse_update()
returns trigger language plpgsql
set search_path = '' as $$
begin
  raise exception 'entree_journal est append-only : le verbatim est immuable (AD-8, Story 4.1)';
end;
$$;

create trigger entree_journal_no_update
  before update on public.entree_journal
  for each row execute function public.entree_journal_refuse_update();
```

### Port + dépôt (jamais service_role, jamais SDK)

- **`lib/domain/depot-journal.ts`** (domaine PUR, aucun I/O — AD-1) :
  ```ts
  export type RoleJournal = "utilisatrice" | "anam";
  export interface EntreeAConsigner { cleTour: string; role: RoleJournal; contenu: string; }
  export interface DepotJournal { consigner(entree: EntreeAConsigner): Promise<void>; }
  ```
- **`lib/data/depot-journal.ts`** (`import "server-only"`) : `creerDepotJournal(utilisatriceId)` → `consigner` fait un **`upsert`** via `createSupabaseServerClient()` (JWT, `lib/data/supabase/server.ts`), `{ onConflict: "utilisatrice_id,cle_tour,role", ignoreDuplicates: true }` ; **lève** si `error` non nul (RLS/write-gate/DB) ; ne logge **jamais** `contenu` (NFR-022). `ignoreDuplicates` → un conflit ne produit **pas** d'`error` (idempotence).

### Hook de route (placement exact)

Insérer **après** la garde `securite.bloque` (`:117`) et la dérivation `niveauSecurite` (`:125`), **avant** le gate d'allocation (`:161`) :

```ts
// ── JOURNAL BRUT (Story 4.1, AD-8 couche 1, NFR-017) ──
// Grave le VERBATIM AVANT toute génération et INDÉPENDAMMENT de son issue (échec modèle, coupure de
// quota 3.4, détresse) : « capture indépendante du traitement ». Après securite.bloque (un tour
// mineur/ZDR/consentement révoqué n'est JAMAIS journalisé). Idempotent par le jeton (même clé que le
// métrage) → réémission = UNE entrée. Échec → 500 : on ne diffuse pas un tour qu'on n'a pas pu graver.
const dernierMessage = messages[messages.length - 1];
if (dernierMessage?.role === "user") {
  try {
    await creerDepotJournal(user.id).consigner({
      cleTour: cleIdempotence, role: "utilisatrice", contenu: dernierMessage.content,
    });
  } catch (e) {
    console.error("anam/message : journal brut illisible (tour non gravé)", { nom: e instanceof Error ? e.name : "inconnu" });
    return NextResponse.json(
      { code: "erreur_serveur", message: "Service indisponible, réessaie." },
      { status: 500, headers: ENTETES_ART9 },
    );
  }
}
```

Import à ajouter : `import { creerDepotJournal } from "@/lib/data/depot-journal";`.

### Invariants durs (à ne pas violer)

- **AD-8** — verbatim immuable ; `id` stable = extrait_source. **AD-4** — art. 9 : chiffré, `no-store` (déjà porté par `ENTETES_ART9`), jamais de contenu en clair dans les logs (NFR-022). **AD-12** — RLS sous JWT, jamais `service_role` applicatif ; table art. 9 sans policy = feature cassée (le vrai filet). **AD-13** — write-gate `a_consenti_art9()` en `with check`. **AD-14** — immuable en écriture courante mais **effaçable** (FR-067, Epic 6, service_role). **AD-16** — la détresse n'annule **jamais** le journal brut (l'épisode est conservé au même niveau que le reste du journal, exclu seulement de la synthèse/arbre — [Source: EXPERIENCE.md:423]).
- **NFR-017** — aucune entrée perdue. Côté client déjà livré (2.2 garde le tour + 3.4 jeton stable réutilisé — [Source: EXPERIENCE.md:175,534]) ; 4.1 ajoute l'écriture durable **idempotente** côté serveur. Limite connue : si le client n'envoyait **pas** de jeton (chemin dégradé), le repli `crypto.randomUUID()` pourrait dupliquer au retry — acceptable (NFR-017 interdit la **perte**, pas la duplication ; le client envoie toujours le jeton).

### Réalité de la garde CI (AD-12) — pas de scanner statique

Il n'existe **aucun** registre/liste blanche de tables art. 9 ni scanner de migrations. La garde est un **test vivant** contre Supabase local : `rls.test.ts` (deny-by-default générique), `write-gate-art9.test.ts` (cycle de vie sur `art9_temoin`, la sonde permanente). **4.1 ajoute un test dédié** (`entree-journal.test.ts`) en **miroir**, ciblant nommément `entree_journal` — c'est ainsi que le repo « garde » chaque table art. 9. *(Écart connu vs SPINE : aucun scanner générique n'existe ; hors périmètre 4.1, candidat durcissement — à signaler à Julian.)*

### Testing standards

- Vitest (env node) ; **Supabase local requis** pour les tests base ; commande : `set -a && . ./.env.local && set +a && npx vitest run` (Vitest ne charge pas `.env.local`). CLI Supabase **globale** v2.67.1, **jamais** `npx supabase`.
- Tests base : `admin` (`SUPABASE_SECRET_KEY`) pour semer/nettoyer, session `publishable` pour prouver la RLS/write-gate (patron `usage-ia.test.ts`, `write-gate-art9.test.ts`, `lire-allocation.test.ts`). Nettoyage en `afterAll` (`delete .eq("utilisatrice_id", u.id)` puis `deleteUser`).
- Gardes de source pour la route (patron `gate-quota.test.ts`) : lire le fichier, retirer les commentaires, prouver l'ordre/awaited/500 par ancrage sur l'**usage** (pas l'import).

### Project Structure Notes

- **NOUVEAUX** : `supabase/migrations/0016_entree_journal.sql`, `lib/domain/depot-journal.ts`, `lib/data/depot-journal.ts`, `tests/entree-journal.test.ts`, `tests/journal-route.test.ts`.
- **MODIFIÉ** : `app/api/anam/message/route.ts` (un bloc + un import).
- Conventions respectées : tables/colonnes `snake_case`, `id uuid`, dates `timestamptz` UTC, fichiers `kebab-case`, port suffixe implicite (`DepotJournal` comme `DepotSeance`), `import "server-only"` sur l'adaptateur data.

### References

- [Source: epics.md#Story-4.1] (AC 1-5) ; [Source: epics.md#Epic-4] (cadre invariant).
- [Source: ARCHITECTURE-SPINE.md#AD-8] (mémoire 3 couches, verbatim immuable) ; #AD-4 (frontière art. 9) ; #AD-12 (RLS non contournable) ; #AD-13 (write-gate) ; #AD-14 (effacement, seule exception) ; #AD-16 (détresse n'annule pas le journal) ; #Consistency-Conventions (naming, uuid, timestamptz).
- [Source: prd.md#FR-062] (couche journal brut) ; #FR-067 (effacement prime) ; #FR-068 (franchise par la mémoire) ; #NFR-001 (chiffrement/isolation) ; #NFR-017 (aucune entrée perdue) ; #NFR-021 (rétention) ; #NFR-022 (pas d'art. 9 en clair).
- [Source: EXPERIENCE.md:175] (hors-ligne, réémission) ; :534 (échec modèle, « ton message est gardé ») ; :423 (épisode conservé au niveau du journal, exclu de l'analyse).
- Code : `supabase/migrations/0005_write_gate_art9.sql:17-57` (a_consenti_art9 + gabarit art9_temoin) ; `0008_usage_ia.sql:19,27-28` (idempotence `text` + index unique) ; `app/api/anam/message/route.ts:57,81-82,117,125,161` (points d'ancrage) ; `lib/data/supabase/server.ts:11-34` (client JWT) ; `lib/data/depot-seance.ts`, `lib/domain/depot-seance.ts` (patron port/dépôt) ; `tests/write-gate-art9.test.ts` (miroir de tests).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (1M context) — dev-story TDD red-green.

### Debug Log References

- T1 RED : `tests/entree-journal.test.ts` → 10 échecs (table absente) ; GREEN après `0016` appliqué (`supabase migration up`, CLI globale v2.67.1) → 12/12.
- T4 RED : import de `@/lib/data/depot-journal` manquant → module introuvable ; GREEN après port + dépôt → 5/5 (client JWT mocké via `vi.mock`).
- T5 RED : gardes de source échouent (route non câblée) → 4 échecs ; GREEN après import + bloc journal. Ajustement : fenêtre du garde 500 élargie 220→400 (le log précède `status: 500` de plus de 220 car.).
- Immuabilité dure vérifiée : `update` service_role → le trigger `entree_journal_no_update` lève (la RLS ne borne pas `service_role`) ; `delete` service_role réussit (siège effacement FR-067).

### Completion Notes List

- **Journal brut livré** : `entree_journal` (art. 9, verbatim, immuable) sous JWT utilisatrice + write-gate `a_consenti_art9()` réutilisé. Append-only par 2 policies (select+insert, aucune update/delete) **+** trigger d'immuabilité (couvre même `service_role`). `id uuid` stable = futur `extrait_source`.
- **Idempotence par le jeton de tour 3.4** : `cle_tour` = `cleIdempotence`, upsert `onConflict (utilisatrice_id, cle_tour, role) ignoreDuplicates` → réémission/retry = une entrée, verbatim d'origine préservé.
- **Hook de route** entre `securite.bloque` et le gate d'allocation, awaité, 500 sur échec — capture indépendante du traitement (NFR-017). Zéro changement client. Gate 3.4 / sécurité / arc / métrage inchangés.
- **Colonne `role`** posée (écrit `utilisatrice` uniquement) : forward-compat pour les tours d'Anam (4.6/Epic 5) sans migration de contrainte.
- Validation : **986 tests** verts (+23), `tsc`/`eslint`/`next build` propres.

### File List

- **NOUVEAU** `supabase/migrations/0016_entree_journal.sql`
- **NOUVEAU** `lib/domain/depot-journal.ts`
- **NOUVEAU** `lib/data/depot-journal.ts`
- **NOUVEAU** `tests/entree-journal.test.ts`
- **NOUVEAU** `tests/depot-journal.test.ts`
- **NOUVEAU** `tests/journal-route.test.ts`
- **MODIFIÉ** `app/api/anam/message/route.ts` (import + bloc journal ; split `jetonValide` + `console.warn` du repli, revue F5)
- **MODIFIÉ** `tests/consentement.test.ts` (frontière art. 9 réalignée : `entree_journal` existe désormais, revue F9)
- **MODIFIÉ** `tests/jeton-tour.test.ts` (garde de source réalignée sur le split `jetonValide`, revue F5)

## Revue adversariale (AI) — 4.1

Workflow 5 angles (finders Sonnet / vérificateurs Opus, biais réfutation) : **17 trouvailles, 9 retenues** (8 réfutées). **7 corrigées + mutation-vérifiées** (F1/F2), **2 différées documentées**.

**Corrigées :**
- **F1 (HAUTE)** — le write-gate omettait `and not est_barre_minorite()` (0016 copiait la version 0005, pas le gabarit durci 0006) → un tour barré-minorité pouvait être gravé. Clause ajoutée **+ test de barrière** (mutation-vérifié : rouge sans la clause). Test d'ordre renforcé (borne après le 403 du bloc `securite.bloque`, mirror 3.4/F12).
- **F2 (HAUTE)** — la policy INSERT ne contraignait pas `role` → une utilisatrice pouvait forger des tours `anam` immuables sous son JWT. `and role = 'utilisatrice'` ajouté (le côté `anam` sera server-authoritative) **+ test de forge** (mutation-vérifié : rouge sans la clause).
- **F3 (MOY)** — la garde de test `role === "user"` matchait l'occurrence arc → ancrée sur `if (dernierMessage?.role === "user")`.
- **F5 (MOY)** — repli `crypto.randomUUID()` sans jeton, invisible → `console.warn` (drapeau, zéro art. 9) pour mesurer le chemin dégradé.
- **F6 (MOY)** — AC4/AD-16 « la détresse n'annule pas le journal » non testé → garde de source (journal gravé AVANT la dérivation du niveau, aucune réf. détresse entre `bloque` et le hook).
- **F7 (BASSE)** — `revoke execute` manquant sur la fonction-trigger (convention 0007) → ajouté.
- **F9 (BASSE)** — `consentement.test.ts` affirmait « aucune table de contenu art. 9 » → réaligné (entree_journal existe).

**Différées (documentées dans deferred-work.md) :**
- **F4 (MOY)** — la RPC `enregistrer_tour_detresse` (2.4) n'est **pas idempotente** ; le nouveau 500 du journal amplifie un double-comptage possible au « Réessayer » → extinction d'épisode prématurée (AD-16/AD-17). **Racine pré-existante à 4.1** ; le fix (clé d'idempotence sur la RPC détresse) touche le pipeline sécurité → **sa propre story** (à traiter avant le lancement).
- **F8 (BASSE)** — `messages[length-1]` suppose « dernier = user » ; déclencheur **hypothétique** (aucun client encore), **aucune perte** dans les cas réalistes (le tour a déjà été gravé sous son jeton). À revisiter quand le client de conversation existera.

## Change Log

| Date | Version | Description | Auteur |
|---|---|---|---|
| 2026-07-30 | 0.1 | Création de la story (analyse exhaustive : SPINE, PRD, patterns code réels via traceur). Conception figée : table `entree_journal` copiant le write-gate `art9_temoin` avec variance append-only (2 policies + trigger d'immuabilité), colonne `role` forward-compat, idempotence par le jeton de tour 3.4, hook de route entre garde sécurité et gate d'allocation. | Create-Story (Opus 4.8) |
| 2026-07-30 | 1.0 | Implémentation TDD T1→T6 (baseline `7ab4dcf`). Migration `0016` + port/dépôt sous JWT + hook de route. 986 tests verts, tsc/eslint/build propres. Statut → review. | Dev-Story (Opus 4.8) |
| 2026-07-30 | 1.1 | Revue adversariale (17 trouvailles, 9 retenues). 7 corrigées : F1 (write-gate + `est_barre_minorite`, mutation-vérifié), F2 (`role` épinglé, mutation-vérifié), F3/F5/F6/F7/F9. 2 différées (F4 idempotence RPC détresse — pré-existante ; F8 `messages[-1]`). 990 tests verts, tsc/eslint/build propres. | Revue + corrections (Opus 4.8) |
