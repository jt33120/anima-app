---
baseline_commit: 0e40f6f
---

# Story 4.2: Les faits extraits — profil vivant, idempotent, à l'épreuve des résurrections

Status: done

## Story

En tant qu'**utilisatrice**,
je veux qu'**Anam retienne des faits clairs sur moi sans jamais faire resurgir ce que j'ai corrigé ou supprimé**,
afin de **garder la main sur l'image qu'elle se fait de moi**.

## Acceptance Criteria

1. **Forme d'un fait écrit — provenance, source, clé stable (AD-18/AD-8).** Étant donné un fait à enregistrer (produit par l'extraction post-tour **ou** une édition de l'utilisatrice), quand il est écrit dans `fait_extrait`, alors la ligne porte : `origine` (`extrait`|`utilisatrice`), `statut` (`actif`|`corrige`|`supprime`), une **clé de dédoublonnage stable** (`cle_dedoublonnage`, opaque, art. 9-safe), le **contenu** du fait (une phrase en clair — art. 9), et un **lien vers l'entrée de journal source** (`extrait_source_id` → `entree_journal.id`, le contrat `extrait_source` posé par 4.1/AC5) — positionnant le **message exact**, jamais la journée ni la séance.

2. **Upsert idempotent par la clé de dédoublonnage (AD-18).** Étant donné un fait déjà présent (même `utilisatrice_id` + `cle_dedoublonnage`), quand la **même** information est ré-extraite, alors l'opération est un **upsert idempotent** : **aucun doublon** n'est créé (garanti par un index unique), et un ré-appel du même fait est un **no-op observable** (aucune ligne supplémentaire, aucune résurrection).

3. **[DUR] Tombstone jamais ressuscité — la version de l'utilisatrice prime (AD-18, le cœur de la story).** Étant donné un fait que l'utilisatrice a **corrigé** ou **supprimé** (tombstone : `statut` `corrige`/`supprime`, `origine='utilisatrice'`), quand une **ré-extraction automatique** ou une **synthèse ultérieure** (FR-066) rencontre la même information (même `cle_dedoublonnage`), alors le fait n'est **JAMAIS** réécrit ni ressuscité — ni son `contenu`, ni son `statut` ne repassent à la version automatique — **la correction de l'utilisatrice prime sans exception**. Garanti à **DEUX niveaux** : (a) la clause `WHERE` de l'upsert rend le chemin normal un **no-op silencieux** ; (b) un **trigger base dur** fait **lever** toute autre écriture `origine='extrait'` sur un fait qui n'est pas lui-même `extrait`+`actif` (le vrai filet, y compris `service_role`, miroir du trigger d'immuabilité du journal). La suppression est un **soft-delete** (`statut='supprime'`), **jamais** un `DELETE` dur — un `DELETE` libérerait la clé et permettrait la résurrection ; le seul `DELETE` dur est l'effacement FR-067 (service_role, Epic 6).

4. **Un seul chemin d'écriture possédé (AD-18/AD-1).** Étant donné deux écrivains possibles (extraction automatique `origine='extrait'` et édition utilisatrice `origine='utilisatrice'`), quand l'un ou l'autre écrit, alors les deux passent par la **même** fonction de merge possédée dans `lib/domain/` (propriétaire unique de la forme canonique), exécutée par le **seul** dépôt `lib/data/depot-faits.ts` sous JWT — **il n'existe aucun second chemin d'écriture** : aucune autre référence en écriture (`insert`/`update`/`upsert`/`delete`) à `fait_extrait` n'existe dans le code (garde de source statique, patron `frontiere-serveur.test.ts`).

5. **Frontière art. 9 + write-gate (AD-4/AD-12/AD-13).** Étant donné la frontière de données sensibles, quand `fait_extrait` est créée, alors elle naît **RLS deny-by-default** sous **JWT utilisatrice** (`auth.uid()`, jamais `service_role` sur le chemin applicatif), **chiffrée** au repos et en transit, avec un **write-gate** (`public.a_consenti_art9()` **et** `not public.est_barre_minorite()`) sur l'écriture ; **aucune policy `delete`** sous JWT (l'effacement FR-067 reste `service_role`, Epic 6) ; la lecture (export) reste possible même après révocation ; une table art. 9 sans policy casse le build (test vivant dédié, miroir de `entree-journal.test.ts`).

## Tasks / Subtasks

- [x] **T1 — Migration `0018_fait_extrait.sql` : table + RLS + write-gate + garde tombstone (AC1, AC2, AC3, AC5)**
  - [x] RED : `tests/fait-extrait.test.ts` — la table existe, RLS `enable`+`force` ; colonnes exactes (`id uuid`, `utilisatrice_id uuid`, `origine text`, `statut text`, `cle_dedoublonnage text`, `contenu text`, `extrait_source_id uuid`, `cree_le timestamptz`, `maj_le timestamptz`) ; `check` sur `origine in ('extrait','utilisatrice')` et `statut in ('actif','corrige','supprime')` ; index unique `(utilisatrice_id, cle_dedoublonnage)` ; FK `extrait_source_id` → `entree_journal(id)` et FK `utilisatrice_id` → `utilisatrice(id) on delete cascade`.
  - [x] GREEN : créer la table en **copiant le write-gate DURCI** de `entree_journal`/`0016` (`a_consenti_art9()` **ET** `not est_barre_minorite()` — la version durcie 0006, PAS la 0005 nue : leçon F1 de la revue 4.1). Variance vs journal documentée en Dev Notes (table **mutable** : correction/suppression → policies `select`+`insert`+`update`, soft-delete, **aucune** policy `delete`).
  - [x] GREEN : **trigger anti-résurrection** `before update` — lève dès qu'une écriture `origine='extrait'` viserait un fait qui n'est pas lui-même `extrait`+`actif` (le complément exact de la clause `WHERE` de l'upsert). Fonction-trigger `set search_path=''`, **`revoke execute` à tous les rôles clients** (convention 0007).
  - [x] GREEN : **fonction de merge possédée** `public.fusionner_fait_extrait(p_origine text, p_statut text, p_cle text, p_contenu text, p_extrait_source uuid)` — **`security INVOKER`** (la RLS + le write-gate s'appliquent au caller, JWT préservé — PAS `security definer`, contraste voulu avec la RPC détresse qui est server-authoritative). C'est ELLE qui porte l'`INSERT … ON CONFLICT DO UPDATE … WHERE` atomique que `supabase-js .upsert()` ne sait pas exprimer (voir Dev Notes « Pourquoi une fonction SQL »). `grant execute … to authenticated`.
  - [x] GREEN : `comment on table` + `comment on column cle_dedoublonnage` fidèles (art. 9, provenance, tombstone respecté, clé opaque jamais de contenu).
  - [x] Appliquer localement : `supabase migration up` (CLI **globale** v2.67.1, **jamais** `npx supabase`).

- [x] **T2 — Preuves RLS / write-gate / tombstone au niveau base (AC3, AC5) — miroir de `entree-journal.test.ts`**
  - [x] RED→GREEN dans `tests/fait-extrait.test.ts` (Supabase local) :
    - [x] **AC5** — le propriétaire lit ses faits ; une **autre** utilisatrice n'en lit **aucun** ; une session non authentifiée n'en lit aucun (deny-by-default).
    - [x] **AC5/AD-13** — insertion **refusée sans consentement** ; **refusée sous barrière minorité** (`est_barre_minorite`) ; **refusée après révocation** ; la **lecture reste permise** après révocation (export FR-067 survit).
    - [x] **AC3 (base, DUR)** — une écriture directe `origine='extrait'` sur une ligne `corrige`/`supprime` (ou `origine='utilisatrice'`) → le **trigger lève**, y compris `service_role` (mutation-cible : retirer le trigger → le test devient rouge).
    - [x] **AC3/AC5** — un `DELETE` sous JWT est **refusé** (aucune policy `delete`) ; un `DELETE` `service_role` **réussit** (siège de l'effacement FR-067, prouvé nominalement).

- [x] **T3 — Fonction de merge possédée (domaine pur) + dépôt sous JWT (AC1, AC2, AC4)**
  - [x] `lib/domain/fusion-fait.ts` (port **pur**, aucun I/O — AD-1) : types `OrigineFait`, `StatutFait`, `FaitCandidat` (`cleDedoublonnage`, `contenu`, `extraitSourceId`), `EcritureFait` (union extraction/édition portant `origine`), interface `DepotFaits` (`fusionner`, `corriger`, `supprimer` — TOUTES routées vers l'unique fusion). RED : test de **pureté** (aucun import Next/Supabase/SDK dans le fichier domaine).
  - [x] `lib/data/depot-faits.ts` (`import "server-only"`) : `creerDepotFaits(utilisatriceId)` → l'unique écriture sous `createSupabaseServerClient()` (JWT), via **un seul `supabase.rpc("fusionner_fait_extrait", …)`** (la fonction possédée fait le `ON CONFLICT … WHERE` atomique). `fusionner` → `p_origine='extrait'` ; `corriger`/`supprimer` → `p_origine='utilisatrice'`. **Lève** sur erreur réelle ; **jamais** de `contenu` ni `cle_dedoublonnage` dans les logs (NFR-022 : erreur = code Postgres seul). Patron `lib/safety/depot-episode.ts` (dépôt qui enrobe une RPC).
  - [x] RED→GREEN : `creerDepotFaits(u).fusionner(...)` grave une ligne avec la forme AC1 ; deux `fusionner` de même clé/contenu → **une** ligne (idempotence bout-en-bout, patron `depot-journal.test.ts`).

- [x] **T4 — Idempotence & anti-résurrection de bout en bout via le merge (AC2, AC3)**
  - [x] RED→GREEN dans `tests/depot-faits.test.ts` :
    - [x] ré-extraction (`fusionner`, `origine='extrait'`) de la **même** clé → **une** ligne, no-op observable (AC2).
    - [x] **[DUR]** l'utilisatrice `corrige` un fait (statut `corrige`, `origine='utilisatrice'`, contenu = sa version) → une ré-extraction ultérieure de la même clé **ne réécrit rien** (AC3).
    - [x] **[DUR]** l'utilisatrice `supprime` un fait (soft, statut `supprime`) → une ré-extraction ultérieure **ne recrée pas** le fait (AC3) ; la ligne tombstone demeure.
    - [x] la correction/suppression passe par **`fusionner`/le même dépôt** (AC4), jamais par un `.update()`/`.delete()` ad hoc.

- [x] **T5 — Garde « aucun second chemin d'écriture » (AC4)**
  - [x] `tests/faits-architecture.test.ts` (patron `frontiere-serveur.test.ts`, `pipeline-securite-architecture.test.ts`) : scanner le code, prouver qu'**aucune** écriture (`insert`/`update`/`upsert`/`delete`) sur `"fait_extrait"` n'existe **hors** `lib/data/depot-faits.ts`. Mutation-vérifiable (ajouter une écriture ailleurs → rouge).

- [x] **T6 — Suite verte + gardes transverses (tout)**
  - [x] Toute la suite verte : `npx vitest run` (Supabase local **démarré** via CLI globale v2.67.1).
  - [x] Sondes art. 9 existantes **inchangées** : `write-gate-art9.test.ts`, `entree-journal.test.ts`, `rls.test.ts`, `frontiere-serveur.test.ts`, `consentement.test.ts` (frontière art. 9 : réaligner si elle énumère les tables de contenu art. 9 — `fait_extrait` existe désormais).
  - [x] `npx tsc --noEmit`, `npx eslint`, `next build` propres.

## Dev Notes

### Le cœur en une phrase

`fait_extrait` est la **couche 2 de la mémoire** (AD-8) : un **profil vivant** de faits en clair (art. 9), **possédé par l'utilisatrice sous JWT**, **idempotent** par une clé de dédoublonnage stable, et **à l'épreuve des résurrections** — un fait que l'utilisatrice corrige ou supprime n'est **jamais** réécrit par une ré-extraction ou une synthèse. Un **seul** chemin d'écriture (fusion possédée dans `lib/domain/`) sert les deux écrivains.

### Cadrage PO (Julian) — « le réceptacle d'abord »

4.2 livre **uniquement la couche de persistance sûre** : la table, le write-gate, la garde anti-résurrection, la fonction de merge unique, et sa preuve exhaustive. L'**intelligence d'extraction LLM** (le prompt qui lit un tour et en *décide* les faits) **n'est PAS dans le périmètre** — elle relève du pipeline sécurité-d'abord (AD-16) et du **modèle fort** (AD-5), territoire de la Story 4.4. La couture est documentée (`FaitCandidat` = ce que le futur extracteur produira), mais **aucun adaptateur ni câblage de route** n'est ajouté en 4.2 (voir « La couture d'extraction, différée »). Conséquence assumée : à la fin de 4.2, le réceptacle est complet et prouvé, **mais aucun appelant de production ne l'alimente encore** (l'extraction auto arrive en 4.4 ; l'UI « Ce qu'Anam retient » / correction-suppression, UX-DR-28, arrive à l'Epic 6). C'est délibéré : on bâtit le coffre incorruptible avant d'y déposer quoi que ce soit.

### État actuel (ce que 4.2 ajoute / préserve) — lecture faite du code

- **La couche 1 existe (4.1).** `entree_journal` (`0016`) est la première table de contenu art. 9 : verbatim immuable sous JWT, write-gate durci (`a_consenti_art9()` + `not est_barre_minorite()`), et surtout `entree_journal.id` = **`extrait_source` stable** — c'est **la cible** de `fait_extrait.extrait_source_id` (AC1/AC5). 4.2 est la **deuxième** table de contenu art. 9.
- **Le socle de patterns est en place.** Port pur `lib/domain/depot-journal.ts` + adaptateur `lib/data/depot-journal.ts` (`server-only`, upsert JWT, `ignoreDuplicates`) : **le gabarit exact** du duo à répliquer pour les faits. Helpers de write-gate `public.a_consenti_art9()` (`0005`) et `public.est_barre_minorite()` (`0006`) réutilisés tels quels. Client JWT `createSupabaseServerClient()` (`lib/data/supabase/server.ts`), client `service_role` `lib/data/supabase/admin.ts` (semis/effacement de test uniquement).
- **La couture d'extraction/synthèse existe côté IA** mais **hors périmètre 4.2** : `lib/ai/port.ts` porte déjà `CapaciteIa` avec `synthese` et `reconceptualisation` (pas encore d'`extraction`) ; la fabrique `creerAiPort()` résout **Mistral en prod / factice en CI**, le **repli factice étant INTERDIT en prod** (AD-4). C'est pourquoi 4.2 ne câble **pas** un extracteur stub dans la route : un stub en prod extrairait du vide silencieusement (violation AD-4). Le câblage réel (passe FORT métrée, patron 2.7/2.8) = **Story 4.4**.
- **Aucun changement de route ni de client en 4.2.** La route `app/api/anam/message/route.ts` n'est **pas** touchée (contraste avec 4.1 qui y insérait le hook journal). L'appel post-tour d'extraction viendra en 4.4, naturellement dans le `after()` post-réponse (là où vit déjà le métrage `usage_ia`) ou dans le pipeline `lib/safety/` → `lib/domain/` (AD-16).

### LE point de conception : la garantie anti-résurrection (AC3, [DUR])

C'est l'invariant qui définit la story. Défense **en profondeur, à deux niveaux** — exactement l'esprit du journal (upsert idempotent **+** trigger d'immuabilité dur) et de la détresse (2-4b : idempotence applicative **+** verrou base) :

1. **Niveau applicatif — la clause `WHERE` de l'upsert (chemin normal = no-op silencieux).** L'extraction automatique écrit :
   ```
   insert into public.fait_extrait (…) values (…, origine='extrait', statut='actif', …)
   on conflict (utilisatrice_id, cle_dedoublonnage)
   do update set contenu = excluded.contenu, maj_le = now()
   where fait_extrait.origine = 'extrait' and fait_extrait.statut = 'actif';
   ```
   La clause `where` porte sur la ligne **existante**. Elle échoue — donc **aucune écriture, aucune erreur** (idempotence) — dès que le fait existant est **possédé par l'utilisatrice** (`origine='utilisatrice'`) **ou** est un **tombstone** (`statut in ('corrige','supprime')`). L'auto ne touche jamais ce que l'utilisatrice possède.

2. **Niveau base — le trigger dur (le vrai filet, même contre `service_role`).** Un `before update` lève sur **toute** tentative d'écriture `origine='extrait'` visant un fait qui n'est pas lui-même `extrait`+`actif` — le **complément exact** de la clause `WHERE` :
   ```sql
   create function public.fait_extrait_garde_resurrection() returns trigger
   language plpgsql set search_path = '' as $$
   begin
     if new.origine = 'extrait'
        and not (old.origine = 'extrait' and old.statut = 'actif') then
       raise exception 'fait_extrait : une ré-extraction ne ressuscite jamais un fait possédé par l''utilisatrice (AD-18, Story 4.2)';
     end if;
     return new;
   end; $$;
   ```
   La clause `WHERE` fait que le chemin normal ne **déclenche même pas** le trigger (aucun `update` n'a lieu) ; le trigger n'existe que pour **faire échouer haut et fort** tout chemin d'écriture bogué/direct qui essaierait de forcer la résurrection. La RLS ne borne pas `service_role` (`bypassrls`) → le trigger est la seule garde qui tient aussi contre lui (comme l'immuabilité du journal).

3. **La suppression est un SOFT-DELETE.** Supprimer = `update … set statut='supprime', origine='utilisatrice'` (une ligne tombstone qui **demeure** et **occupe la clé de dédoublonnage**). Un `DELETE` dur libérerait la clé → la prochaine ré-extraction recréerait le fait = **résurrection**. Donc : **aucune policy `delete` sous JWT** ; le seul `DELETE` dur est l'effacement FR-067 (`service_role`, moteur de rétention, Epic 6). C'est la raison structurelle du tombstone.

**Écriture utilisatrice (toujours prioritaire).** Corriger → `statut='corrige'`, `origine='utilisatrice'`, `contenu` = version utilisatrice. Supprimer → `statut='supprime'`, `origine='utilisatrice'`. Ces écritures portent `new.origine='utilisatrice'` → le trigger les **autorise** (il ne barre que `new.origine='extrait'`). La correction prime, sans exception (AC3).

### Pattern à COPIER : `entree_journal` (`0016`) — contenu art. 9 sous JWT, write-gate durci

⚠️ Copier le write-gate **DURCI** (`a_consenti_art9()` **ET** `not est_barre_minorite()`) — c'est la leçon **F1** de la revue 4.1 (0016 avait d'abord copié la version 0005 nue en oubliant `est_barre_minorite`, corrigé en HAUTE). On reprend : `enable`+`force` RLS, FK `on delete cascade` vers `public.utilisatrice(id)`, `id uuid default gen_random_uuid()`, `cree_le timestamptz default now()`, write-gate `with check`, et le **test vivant dédié** (`fait-extrait.test.ts`) qui « garde » la table art. 9 (il n'existe **aucun** scanner statique de tables art. 9 — la garde est une sonde vivante contre Supabase local, cf. Dev Notes 4.1).

### Variance DÉLIBÉRÉE vs `entree_journal` (le journal est immuable ; les faits sont vivants)

`entree_journal` est **append-only** (2 policies select+insert, trigger d'immuabilité qui refuse **tout** update). `fait_extrait` est un **profil VIVANT** : l'utilisatrice **corrige et supprime** (FR-063/FR-064). Donc on **dévie** :

1. **Trois policies** au lieu de deux : `select` (propriétaire, survit à la révocation), `insert` (write-gate durci), **`update`** (write-gate durci — la correction/suppression est une écriture de contenu). **Aucune** policy `delete` sous JWT (soft-delete + effacement `service_role`).
2. **Trigger de GARDE (pas d'immuabilité)** : au lieu de refuser tout update, il refuse **seulement** la résurrection auto (`origine='extrait'` sur un fait non-`extrait`+`actif`). Les updates légitimes (utilisatrice, ou ré-extraction sur fait auto-actif) passent.
3. **Points de conception ouverts (à trancher en dev/revue — ne pas coder au hasard, tester explicitement) :**
   - **(a) Write-gate `update` vs révocation.** Le write-gate `update` doit-il **survivre à la révocation** de consentement pour la **suppression** ? Effacer/rectifier est un **droit** de la personne concernée (RGPD art. 16/17) qui ne devrait pas être bloqué par la révocation art. 9. Le journal ne tranche pas (il est immuable). Proposition par défaut : gater `insert` + correction-de-contenu sur le consentement ; **autoriser la suppression (soft) même après révocation**. (Le SQL de référence omet déjà `a_consenti_art9()` du `with check` de l'`update` — cohérent avec cette proposition.)
   - **(b) Contenu à la suppression.** Le tombstone `supprime` doit **occuper la clé de dédoublonnage** (sinon résurrection) mais le `contenu` art. 9 devrait-il être **rédigé/vidé** (l'utilisatrice veut l'oublier) tout en gardant la ligne ? Proposition : à la suppression, **conserver la clé, rédiger le `contenu`** (sentinelle ou vide) — le tombstone bloque la résurrection sans reconserver le contenu supprimé. La signature `supprimer(cleDedoublonnage)` ne passe donc pas de contenu ; la RPC doit gérer le `contenu not null` (sentinelle) ou rendre `contenu` nullable. À figer en red-green.

### SQL de référence (migration `0018`, forme indicative — le dev fige en red-green)

```sql
create table public.fait_extrait (
  id                uuid        primary key default gen_random_uuid(),
  utilisatrice_id   uuid        not null references public.utilisatrice(id) on delete cascade,
  origine           text        not null check (origine in ('extrait','utilisatrice')),
  statut            text        not null default 'actif' check (statut in ('actif','corrige','supprime')),
  cle_dedoublonnage text        not null,               -- clé stable OPAQUE (jamais de contenu en clair, art. 9-safe)
  contenu           text        not null,               -- la phrase « Ce qu'Anam retient » (art. 9)
  extrait_source_id uuid        references public.entree_journal(id) on delete set null,
  cree_le           timestamptz not null default now(),
  maj_le            timestamptz not null default now()
);

-- Idempotence (AC2) : une info = une ligne par utilisatrice.
create unique index fait_extrait_dedoublonnage_unique
  on public.fait_extrait (utilisatrice_id, cle_dedoublonnage);
create index fait_extrait_utilisatrice_idx
  on public.fait_extrait (utilisatrice_id, statut);

alter table public.fait_extrait enable row level security;
alter table public.fait_extrait force  row level security;

-- Lecture propriétaire (export FR-067, survit à la révocation).
create policy fait_extrait_lecture on public.fait_extrait
  for select using (auth.uid() = utilisatrice_id);

-- Écriture write-gatée durcie (copie 0016 : consentement + non-barré-minorité).
create policy fait_extrait_insertion on public.fait_extrait
  for insert with check (auth.uid() = utilisatrice_id
                         and public.a_consenti_art9()
                         and not public.est_barre_minorite());
create policy fait_extrait_maj on public.fait_extrait
  for update using (auth.uid() = utilisatrice_id)
             with check (auth.uid() = utilisatrice_id
                         and not public.est_barre_minorite());
-- AUCUNE policy delete sous JWT (soft-delete ; effacement FR-067 = service_role, Epic 6).

-- Garde anti-résurrection (AC3 [DUR]) — le vrai filet, même service_role.
create function public.fait_extrait_garde_resurrection() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.origine = 'extrait'
     and not (old.origine = 'extrait' and old.statut = 'actif') then
    raise exception 'fait_extrait : une ré-extraction ne ressuscite jamais un fait possédé par l''utilisatrice (AD-18, Story 4.2)';
  end if;
  return new;
end; $$;
revoke execute on function public.fait_extrait_garde_resurrection() from public, anon, authenticated;
create trigger fait_extrait_no_resurrection
  before update on public.fait_extrait
  for each row execute function public.fait_extrait_garde_resurrection();

-- Fonction de merge POSSÉDÉE (AC4) — security INVOKER : RLS + write-gate s'appliquent au caller (JWT).
-- Porte l'upsert conditionnel que supabase-js ne sait pas exprimer. Le `where` rend la ré-extraction
-- d'un tombstone/fait utilisatrice un NO-OP silencieux (AC2/AC3) ; le trigger reste le filet dur.
create function public.fusionner_fait_extrait(
  p_origine text, p_statut text, p_cle text, p_contenu text, p_extrait_source uuid
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_origine = 'extrait' then
    insert into public.fait_extrait (utilisatrice_id, origine, statut, cle_dedoublonnage, contenu, extrait_source_id)
    values ((select auth.uid()), 'extrait', 'actif', p_cle, p_contenu, p_extrait_source)
    on conflict (utilisatrice_id, cle_dedoublonnage)
    do update set contenu = excluded.contenu, maj_le = now()
    where fait_extrait.origine = 'extrait' and fait_extrait.statut = 'actif';  -- NO-OP sur tombstone/utilisatrice
  else
    -- Écriture UTILISATRICE (corriger/supprimer) : prime toujours. p_statut ∈ ('actif','corrige','supprime').
    insert into public.fait_extrait (utilisatrice_id, origine, statut, cle_dedoublonnage, contenu, extrait_source_id)
    values ((select auth.uid()), 'utilisatrice', p_statut, p_cle, p_contenu, p_extrait_source)
    on conflict (utilisatrice_id, cle_dedoublonnage)
    do update set origine = 'utilisatrice', statut = excluded.statut, contenu = excluded.contenu, maj_le = now();
  end if;
end; $$;
revoke execute on function public.fusionner_fait_extrait(text, text, text, text, uuid) from public, anon;
grant  execute on function public.fusionner_fait_extrait(text, text, text, text, uuid) to authenticated;
```

> Note conception : le write-gate `update` ci-dessus **omet volontairement** `a_consenti_art9()` (voir « Point de conception ouvert » — la suppression comme droit RGPD survivant à la révocation). À valider/tester explicitement ; si la revue tranche l'inverse, ajouter la clause. **Ne pas laisser ce choix implicite.**

### Port + dépôt (jamais service_role, jamais SDK) — le duo à répliquer

- **`lib/domain/fusion-fait.ts`** (domaine PUR, aucun I/O — AD-1) :
  ```ts
  export type OrigineFait = "extrait" | "utilisatrice";
  export type StatutFait = "actif" | "corrige" | "supprime";
  /** Ce que le FUTUR extracteur (4.4) produira — la couture. En 4.2, alimenté par les tests. */
  export interface FaitCandidat { cleDedoublonnage: string; contenu: string; extraitSourceId: string; }
  export interface DepotFaits {
    /** Écrivain AUTO (origine='extrait') : upsert idempotent, no-op sur tombstone/fait utilisatrice. */
    fusionner(fait: FaitCandidat): Promise<void>;
    /** Écrivain UTILISATRICE (origine='utilisatrice') : prime toujours. */
    corriger(cleDedoublonnage: string, contenu: string): Promise<void>;
    supprimer(cleDedoublonnage: string): Promise<void>;
  }
  ```
  Les trois méthodes convergent vers **une** logique d'écriture ; la « forme canonique » (validation, normalisation) vit ici. C'est l'AC4 : un seul propriétaire de la forme.
- **`lib/data/depot-faits.ts`** (`import "server-only"`) : `creerDepotFaits(utilisatriceId)` implémente `DepotFaits` via `createSupabaseServerClient()` (JWT), en appelant l'**unique RPC** `fusionner_fait_extrait` (`.rpc(...)`). `fusionner` → `p_origine='extrait'` ; `corriger` → `p_origine='utilisatrice', p_statut='corrige'` ; `supprimer` → `p_origine='utilisatrice', p_statut='supprime'`. **Lève** sur erreur réelle ; ne logge **jamais** `contenu`/`cle_dedoublonnage` (NFR-022, code Postgres seul). Patron : `lib/safety/depot-episode.ts` (dépôt qui enrobe une RPC), forme miroir de `lib/data/depot-journal.ts`.

**Pourquoi une fonction SQL (et pas `.upsert()`).** Le client `supabase-js` `.upsert()` ne sait **pas** exprimer un `ON CONFLICT DO UPDATE … WHERE` conditionnel — il fait soit `DO UPDATE` inconditionnel, soit `DO NOTHING` (`ignoreDuplicates`). Or : `DO UPDATE` inconditionnel sur un tombstone **déclencherait le trigger → erreur dure** (casse l'idempotence AC2, qui veut un *no-op*) ; `DO NOTHING` ne rafraîchirait **jamais** le contenu d'un fait auto actif ré-extrait (profil figé). Seul un `ON CONFLICT … WHERE` atomique donne les deux : rafraîchir l'actif-auto, ignorer silencieusement le tombstone. D'où la fonction possédée (atomicité en base, sous verrou d'index) — même raison que la RPC détresse (2.4/2-4b). `security INVOKER` (≠ la détresse en `definer`) car `fait_extrait` est **possédé sous JWT** : on ne veut PAS contourner la RLS, on veut qu'elle et le write-gate mordent aussi dans la fonction.

### La couture d'extraction, différée (pourquoi pas de câblage en 4.2)

`FaitCandidat` **est** le contrat entre le futur extracteur (4.4) et le réceptacle (4.2). En 4.4, une passe FORT (`capacite: "extraction"` à ajouter à `CapaciteIa`, métrée clé `…:extraction`, sous egress-guard art. 9) produira des `FaitCandidat[]` et les passera à `fusionner`. **Rien de tout cela en 4.2** — parce que (a) Julian a cadré « réceptacle d'abord », (b) AD-4 interdit un stub d'extraction en prod, (c) le tir réel est gated DPA/ZDR comme la détection 2.3 et l'arc 2.7/2.8. Le réceptacle prouvé rend ce branchement futur trivial et sûr.

### Invariants durs (à ne pas violer)

- **AD-18** — provenance (`origine`) + tombstones + upsert idempotent ; la ré-extraction/synthèse **ne ressuscite jamais** ; propriétaire unique de la forme = `lib/domain/`, un seul chemin d'écriture. **AD-8** — couche 2 de la mémoire, liée à `extrait_source_id` ; l'arbre/branches (couche 3) viendront pointer plus tard. **AD-4** — art. 9 chiffré, `no-store`, jamais de contenu ni de clé en clair dans les logs (NFR-022) ; pas de dégradation silencieuse. **AD-12** — RLS sous JWT, jamais `service_role` applicatif ; table art. 9 sans policy = feature cassée (sonde vivante). **AD-13** — write-gate `a_consenti_art9()` (+ `not est_barre_minorite()`). **AD-14** — mutable en écriture courante (correction/suppression) mais l'effacement dur FR-067 reste `service_role` (Epic 6) ; le soft-delete est le tombstone, pas l'effacement.
- **AD-1** — dépendances descendantes : `lib/domain/` (pur) → `lib/data/` (I/O sous JWT). Le domaine n'importe jamais l'infra (test de pureté).
- **AD-16** — quand l'extraction sera câblée (4.4), elle vivra dans le pipeline sécurité-d'abord (sécurité AVANT extraction) ; **hors périmètre 4.2**, noté pour ne pas bâtir à contre-sens.

### Testing standards

- Vitest (env node) ; **Supabase local requis** pour les tests base ; commande : `npx vitest run` (Vitest ne charge pas `.env.local`). CLI Supabase **globale** v2.67.1, **jamais** `npx supabase` (casse le mapping `sb_secret_`→`service_role`).
- Tests base : `admin` (`SUPABASE_SECRET_KEY`) pour semer/nettoyer + prouver le trigger contre `service_role` ; session `publishable` pour prouver RLS/write-gate (patrons `entree-journal.test.ts`, `write-gate-art9.test.ts`, `depot-journal.test.ts`). Nettoyage en `afterAll` (`delete .eq("utilisatrice_id", u.id)` puis `deleteUser`).
- **Mutation-vérification obligatoire** sur les gardes DURES (discipline 2.4b/4.1) : retirer le trigger anti-résurrection → le test AC3 base devient rouge ; élargir la clause `WHERE` (retirer `and statut='actif'`) → le test AC3 bout-en-bout devient rouge ; ajouter une écriture `fait_extrait` hors dépôt → la garde T5 devient rouge.
- Garde de source (T5) : patron `frontiere-serveur.test.ts` / `pipeline-securite-architecture.test.ts` — lire le code, retirer les commentaires, ancrer sur l'**usage** (`.from("fait_extrait")` en écriture).

### Project Structure Notes

- **NOUVEAUX** : `supabase/migrations/0018_fait_extrait.sql`, `lib/domain/fusion-fait.ts`, `lib/data/depot-faits.ts`, `tests/fait-extrait.test.ts`, `tests/depot-faits.test.ts`, `tests/faits-architecture.test.ts`.
- **MODIFIÉ (potentiel)** : `tests/consentement.test.ts` (si elle énumère les tables de contenu art. 9 — `fait_extrait` s'y ajoute, comme `entree_journal` en 4.1/F9).
- **NON TOUCHÉ** : `app/api/anam/message/route.ts` (l'extraction auto = 4.4), aucun fichier client, `lib/ai/port.ts` (la capacité `extraction` = 4.4).
- Conventions : tables/colonnes `snake_case`, `id uuid`, dates `timestamptz` UTC, fichiers `kebab-case`, port pur + adaptateur `server-only` (miroir `DepotJournal`/`creerDepotJournal`).

### References

- [Source: epics.md#Story-4.2] (AC 1-5) ; [Source: epics.md#Epic-4] (cadre invariant : rien décrété, rien ne recule, un fait supprimé ne ressuscite jamais).
- [Source: ARCHITECTURE-SPINE.md#AD-18] (provenance, idempotence, tombstones, propriétaire unique) ; #AD-8 (mémoire 3 couches, couche faits) ; #AD-4 (frontière art. 9) ; #AD-12 (RLS non contournable) ; #AD-13 (write-gate) ; #AD-14 (effacement) ; #AD-1 (dépendances descendantes) ; #AD-16 (pipeline sécurité-d'abord, pour 4.4) ; #Consistency-Conventions (naming, uuid, timestamptz).
- [Source: prd.md#FR-062] (couche faits extraits) ; #FR-063/FR-064 (correction/suppression, la version utilisatrice prime) ; #FR-066 (synthèse idempotente) ; #FR-067 (effacement) ; #NFR-022 (pas d'art. 9 en clair).
- [Source: ux-designs/DESIGN.md#UX-DR-28] (fiche « Ce qu'Anam retient » : phrase claire + date + lien source ; Corriger/Supprimer ; **aucun score de confiance** — l'UI est Epic 6, mais le modèle de données doit la permettre).
- Story précédente : [4-1-journal-brut-...md] (patterns : write-gate durci F1, port/dépôt, sonde vivante art. 9, idempotence par index unique, immuabilité par trigger).
- Code : `supabase/migrations/0016_entree_journal.sql` (gabarit table art. 9 sous JWT) ; `0005_write_gate_art9.sql:17-34` (`a_consenti_art9`) ; `0006_barriere_minorite.sql:28-43` (`est_barre_minorite`) ; `0007_durcir_execute_fonctions.sql` (`revoke execute`) ; `lib/domain/depot-journal.ts` + `lib/data/depot-journal.ts` (duo port/dépôt) ; `tests/entree-journal.test.ts`, `tests/depot-journal.test.ts` (miroirs de test) ; `lib/data/supabase/server.ts` (client JWT), `admin.ts` (service_role) ; `lib/ai/port.ts`, `fabrique.ts` (couture IA, pour 4.4).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (1M context) — dev-story TDD red-green + mutation-vérification.

### Debug Log References

- **T1** RED : `fait-extrait.test.ts` → PGRST205 (table absente). GREEN après `0018` appliqué (CLI globale v2.67.1, `supabase migration up`) → 4/4.
- **T2** GREEN 13/13 (deny-by-default, write-gate durci, barrière minorité, suppression survit à la révocation, tombstone base).
- **MUT1** (garde dure trigger) : `drop trigger fait_extrait_no_resurrection` → les 2 tests `[DUR]` deviennent ROUGES (la résurrection réussit) ; trigger recréé → vert. Prouve que le trigger mord.
- **T3** GREEN 6/6 (câblage RPC, pureté domaine, NFR-022).
- **T4** GREEN — scénario bout-en-bout extraire→ré-extraire→corriger→ré-extraire(no-op)→supprimer→ré-extraire(no-op).
- **MUT2** (clause WHERE) : fonction merge SANS `where` → T4 ROUGE au step 4 (la ré-extraction écrase la correction) ; restaurée → vert. Prouve que la clause WHERE et le trigger ne sont PAS redondants (le trigger ne barre que `origine='extrait'` ; la clause WHERE empêche l'écrasement de contenu d'un tombstone/fait utilisatrice).
- **T5** GREEN 3/3. **MUT3** : fichier temporaire `lib/data/_mut-faits.ts` avec `.from("fait_extrait").insert(...)` → garde ROUGE ; fichier supprimé → vert.
- **T6** : 1023 tests verts (90 fichiers, +26), `tsc`/`eslint`/`next build` propres.

### Écarts de conception vs le SQL/port indicatif de la story (documentés, red-green)

1. **`creerDepotFaits()` NE PREND PAS d'`utilisatriceId`** (la story écrivait `creerDepotFaits(utilisatriceId)`). L'identité vient du JWT via `(select auth.uid())` DANS la RPC `security invoker` → jamais fournie par l'appelant (plus sûr : aucun vecteur de mismatch d'id). Contraste assumé avec `creerDepotJournal(id)`.
2. **Chemin UTILISATRICE = `UPDATE` simple, pas `INSERT … ON CONFLICT`.** Découverte à l'implémentation : sous RLS, un `INSERT … ON CONFLICT DO UPDATE` évalue la policy INSERT (`with check`, donc le consentement) sur la ligne proposée MÊME quand la branche update est prise → cela AURAIT cassé le point (a) (suppression après révocation). Un `UPDATE` simple ne dépend que de la policy UPDATE (non gatée consentement) → la suppression/correction d'un fait existant survit à la révocation. Le chemin AUTO garde l'`INSERT … ON CONFLICT … WHERE` (l'extraction n'écrit que sous consentement actif — correct).
3. **T4 (merge bout-en-bout) placé dans `fait-extrait.test.ts`** (vrai Supabase) et non `depot-faits.test.ts` (qui mocke le client, aucune base) — même découpage que 4.1 (mock du câblage dans `depot-*.test.ts`, comportement base dans la table `*.test.ts`).

### Completion Notes List

- **Faits extraits livrés** : `fait_extrait` (art. 9, couche 2, profil vivant) sous JWT + write-gate durci (`a_consenti_art9()` + `not est_barre_minorite()`). Trois policies (select+insert+update), **soft-delete** (aucune policy delete sous JWT), `extrait_source_id` → `entree_journal(id)` (AC5 de 4.1).
- **Anti-résurrection à double défense (AC3 [DUR])** : la clause `WHERE` de l'upsert (no-op silencieux, chemin normal) **+** le trigger `fait_extrait_no_resurrection` (le vrai filet, même service_role). MUT1 et MUT2 prouvent que les deux mordent et ne sont pas redondants.
- **Un seul chemin d'écriture (AC4)** : l'unique fonction possédée `fusionner_fait_extrait` (`security invoker`), enrobée par `creerDepotFaits()` ; garde de source T5 (mutation-vérifiée) — aucun second chemin.
- **Points PO tenus** : (a) la suppression/correction survit à la révocation (UPDATE non gaté consentement) ; (b) `supprimer()` vide le `contenu` au tombstone (la clé demeure, bloque la résurrection).
- **Cadrage « réceptacle d'abord »** : aucun câblage de route ni d'extracteur LLM (Story 4.4) ; `FaitCandidat` documente la couture. Aucun appelant de production n'alimente encore la table (délibéré).
- Validation : **1023 tests verts** (+26), `tsc`/`eslint`/`next build` propres.

### File List

- **NOUVEAU** `supabase/migrations/0018_fait_extrait.sql`
- **NOUVEAU** `lib/domain/fusion-fait.ts`
- **NOUVEAU** `lib/data/depot-faits.ts`
- **NOUVEAU** `tests/fait-extrait.test.ts`
- **NOUVEAU** `tests/depot-faits.test.ts`
- **NOUVEAU** `tests/faits-architecture.test.ts`
- **MODIFIÉ** `tests/consentement.test.ts` (fidélité frontière art. 9 : `fait_extrait` existe désormais — couche 2)

## Revue adversariale (AI) — 4.2

Workflow 6 angles (finders **Sonnet** — diversité de modèle ; vérificateurs **Opus** biais-réfutation, 2 lentilles diverses correctness + sécurité/art.9). **46 agents, ~2,3 M tokens. 20 trouvailles brutes → 14 retenues → 5 corrigées + mutation-vérifiées, le reste réfuté/accepté.**

**Le cœur a tenu** : la « résurrection par une autre porte » (reframe HAUTE) a été **réfutée** — le chemin auto/machine est bien bloqué (WHERE + trigger, MUT1/MUT2) ; aucune fuite inter-utilisatrices sur les lectures, aucun trou de résurrection machine.

**Corrigées (mutation-vérifiées) :**
- **A (HAUTE)** — l'implémentation du point (a) était **trop large** : correction ET suppression exemptées du consentement, alors que le design acté gatait la correction. Un contenu art. 9 **nouveau** pouvait être déposé après révocation. **Fix (décision PO reconfirmée : correction gatée) :** garde de contenu dans le **trigger** — déposer un `contenu` non vide et nouveau exige `a_consenti_art9()` (service_role exempt via `auth.uid() is not null`) ; **vider** (suppression) survit à la révocation (droit à l'effacement). En plus, le chemin utilisatrice refuse `p_statut='actif'` (pas de ré-activation forgée). **MUT4** (retrait du gate → correction post-révoc rouge).
- **B (HAUTE)** — le chemin auto rafraîchissait `contenu` mais **pas `extrait_source_id`** → provenance figée sur la 1ʳᵉ source (viole AC1). Le test T4 réutilisait la même source → angle mort. **Fix :** `do update set … extrait_source_id = excluded.extrait_source_id` + test à source distincte. **MUT5**.
- **D (MOY)** — `extrait_source_id` n'exigeait pas l'**appartenance** de l'entrée de journal à l'appelante (intégrité inter-tenant + oracle d'UUID). **Fix :** garde d'appartenance dans la RPC (`exists … where utilisatrice_id = auth.uid()`) + test inter-tenant. **MUT6**.
- **F (BASSE)** — le test deny-by-default anonyme ne vérifiait que `data`, pas `error` (faux-vert « table absente »). **Fix :** assertion `error` toBeNull.
- **C (MOY)** — la garde de source (regex verbe-par-verbe) ratait l'indirection par variable, les template-literals, et `sansCommentaires` pouvait manger une vraie ligne. **Fix :** interdiction du **littéral de table** `fait_extrait` partout dans app/lib/render (attrape tout accès quel que soit le chaînage) + contrôles positifs inline ; résidu (nom construit dynamiquement) documenté, backstop base.

**Réfutées / acceptées (non corrigées, à raison) :**
- **E** — `corriger/supprimer` sur clé inexistante réussit en silence : **réfuté** (clé opaque stable venant de la liste UI ; un 0-ligne prouve que la donnée est déjà absente ; sémantique idempotente correcte pour l'effacement). Résidu d'observabilité UI relève d'Epic 6.
- **Chemin utilisatrice : `extrait_source_id` non touché à la correction** : **réfuté** (provenance = le tour d'ORIGINE ; le conserver est le bon modèle, le vider perdrait l'origine). Distinct du fix B (qui vise le chemin AUTO).
- La lecture des faits (4.3) et l'UI Corriger/Supprimer (Epic 6) rendront la garde C rouge → à assouplir **consciemment** à ce moment (tripwire voulu).

## Change Log

| Date | Version | Description | Auteur |
|---|---|---|---|
| 2026-07-30 | 0.1 | Création de la story (analyse exhaustive : SPINE AD-18/AD-8/AD-4/AD-12/AD-13, PRD FR-062/063/064/066, patterns code réels — journal 4.1, write-gate durci, port/dépôt, couture IA). Cadrage PO « réceptacle d'abord » (extraction LLM différée en 4.4). Conception figée : table `fait_extrait` mutable copiant le write-gate `entree_journal` (variance : 3 policies + soft-delete + trigger anti-résurrection), défense en profondeur à deux niveaux (clause `WHERE` de l'upsert + trigger base dur), fusion possédée unique dans `lib/domain/`, idempotence par `(utilisatrice_id, cle_dedoublonnage)`. Points ouverts signalés (write-gate `update` vs révocation ; dérivation clé opaque). | Create-Story (Opus 4.8) |
| 2026-07-30 | 1.1 | Revue adversariale (6 angles, 46 agents, finders Sonnet / vérif Opus, 20 trouvailles → 14 retenues). 5 corrigées + mutation-vérifiées : A (correction gatée consentement — trigger content-gate + p_statut, MUT4), B (rafraîchissement `extrait_source_id` auto, MUT5), D (isolation inter-tenant de la source, MUT6), F (faux-vert deny-by-default), C (garde de source durcie par le littéral de table). Réfutées/acceptées : 0-ligne silencieux, source non touchée à la correction (provenance=origine), reframe résurrection HAUTE. **1027 tests verts** (+4), db reset propre depuis les fichiers, tsc/eslint/build propres. | Revue + corrections (Opus 4.8) |
| 2026-07-30 | 1.0 | Implémentation TDD T1→T6 (baseline `0e40f6f`). Migration `0018` (table + RLS + write-gate durci + trigger anti-résurrection + fonction de merge possédée `security invoker`) + port pur `lib/domain/fusion-fait.ts` + dépôt `lib/data/depot-faits.ts` (RPC sous JWT). Défense anti-résurrection à deux niveaux mutation-vérifiée (MUT1 trigger, MUT2 clause WHERE) ; garde chemin unique mutation-vérifiée (MUT3). Points PO tenus : (a) suppression survit à la révocation (UPDATE simple non gaté consentement) ; (b) contenu vidé au tombstone. Écarts documentés (identité par JWT, chemin utilisatrice = UPDATE). **1023 tests verts** (+26), tsc/eslint/build propres. Statut → review. | Dev-Story (Opus 4.8) |
