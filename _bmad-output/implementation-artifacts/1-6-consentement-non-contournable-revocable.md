---
story_key: "1-6-consentement-non-contournable-revocable"
epic: 1
story: 6
title: "Rendre le consentement techniquement non contournable et révocable"
epic_name: "Franchir le seuil"
covers: [FR-012, FR-072, AD-13, AD-4, AD-12]
depends_on: ["1-5-consentement-art9-declaration-ia"]
status: done
baseline_commit: ce51ddba9e3376560b8d4ef5eecc53505e13977d
created: "2026-07-24"
sources:
  - _bmad-output/planning-artifacts/epics.md#epic-1--story-1-6
  - _bmad-output/planning-artifacts/architecture/architecture-Anima-2026-07-22/ARCHITECTURE-SPINE.md
---

# Story 1.6 : Rendre le consentement techniquement non contournable et révocable

Status: done

<!-- Note : validation optionnelle. Lancer validate-create-story avant dev-story pour un contrôle qualité. -->

## Story

En tant que **dev, au nom de la conformité art. 9**,
je veux **une garde d'écriture au niveau base qui refuse toute écriture sur une table art. 9 sans consentement valide et non révoqué, plus un contrôle de révocation qui suspend le traitement**,
afin que **la légalité du traitement ne dépende jamais d'un oubli d'interface** — même si un écran est buggé, contourné ou oublié, la base, elle, refuse.

## Acceptance Criteria

1. **Étant donné** une table témoin marquée art. 9 et une utilisatrice **sans `consentement` valide** **Quand** une écriture art. 9 est tentée pour elle **Alors** la garde au **niveau base** (pas l'UI) la **refuse** (AD-13 write-gate) **Et** ce refus est couvert par un **test bloquant en CI**.

2. **Étant donné** une utilisatrice avec un `consentement` art. 9 **valide et non révoqué** **Quand** une écriture art. 9 est tentée pour elle **Alors** la garde l'**autorise**.

3. **Étant donné** une utilisatrice ayant consenti **Quand** elle **révoque** son consentement (`revoked_at` posé) **Alors** elle bascule en état **« traitement art. 9 suspendu »** **Et** toute écriture art. 9 ultérieure est de **nouveau refusée** par la garde (révocation testée de bout en bout).

4. **Étant donné** une révocation **Quand** elle survient **Alors** l'utilisatrice est dirigée vers l'**export puis la suppression**, **sans aucun écran de rétention ni offre de reconquête** (UX) **Et** la **propagation effective de l'effacement** est confiée au **moteur unique** de rétention/effacement (AD-14, epic données ultérieur), **hors périmètre** de cette story.

## Tasks / Subtasks

- [x] **Tâche 0 — Préambule : garde de la scène `/` (différé de la revue 1.5)** (AC : contexte)
  - [x] `app/page.tsx` : brancher la scène derrière la garde `etat-onboarding` (compte + majorité + consentement), en remplacement du prototype WebGL non gardé. **DÉJÀ RÉALISÉ** lors de l'assainissement de l'accueil (préambule à cette story) ; sera **committé avec 1.6**. Résout le différé revue 1.5 « la scène `/` n'a aucune garde → Story 1.6 (AD-13) ». `tsc` + `lint` verts.
  - [x] À **compléter** en Tâche 3 : la garde de `/` doit router l'état **`revoque`** vers l'écran de révocation, jamais vers la scène.

- [x] **Tâche 1 — Migration 0005 : le write-gate art. 9 au niveau base** (AC : 1, 2)
  - [x] `supabase/migrations/0005_write_gate_art9.sql`, forward-only. **Fonction de garde réutilisable** (le prédicat qu'appelleront TOUTES les futures tables art. 9) :
    ```sql
    -- Prédicat de consentement art. 9 : vrai ssi consentement EXPLICITE, IA reconnue, NON révoqué.
    -- security definer + search_path verrouillé : la garde ne dépend pas de la policy de LECTURE
    -- de `consentement` (découplage) ; ce n'est PAS un service_role sur du contenu (AD-12) —
    -- c'est un prédicat de garde qui ne rend qu'un booléen. Voir Dev Notes « Décision technique ».
    create or replace function public.a_consenti_art9(uid uuid)
    returns boolean
    language sql
    stable
    security definer
    set search_path = ''
    as $$
      select exists (
        select 1 from public.consentement c
        where c.utilisatrice_id = uid
          and c.art9_accorde = true
          and c.ia_reconnue  = true
          and c.revoked_at is null
      );
    $$;
    revoke all on function public.a_consenti_art9(uuid) from public;
    grant execute on function public.a_consenti_art9(uuid) to authenticated;
    ```
  - [x] **Table témoin `art9_temoin`** — gabarit + sonde vivante du write-gate (écho art. 9 de `probe`/0001), **vide en prod** :
    ```sql
    create table public.art9_temoin (
      id              uuid primary key default gen_random_uuid(),
      utilisatrice_id uuid not null references public.utilisatrice(id) on delete cascade,
      note            text not null,
      cree_le         timestamptz not null default now()
    );
    alter table public.art9_temoin enable row level security;
    alter table public.art9_temoin force  row level security;
    -- Write-gate en WITH CHECK (écriture) ; la LECTURE reste ouverte au propriétaire (export RGPD
    -- avant suppression, même après révocation). DELETE (using) reste permis (droit à l'effacement).
    create policy art9_temoin_ecriture on public.art9_temoin
      for all
      using      (auth.uid() = utilisatrice_id)
      with check (auth.uid() = utilisatrice_id and public.a_consenti_art9(auth.uid()));
    comment on table public.art9_temoin is
      'Gabarit + sonde vivante du write-gate art. 9 (AD-13). Vide en prod. Prouve en continu (test CI) qu''aucune écriture art. 9 n''est possible sans consentement valide et non révoqué. Toute future table de contenu art. 9 (journal, seance, tirage, socle) COPIE cette policy.';
    ```
  - [x] Appliquer (`supabase db reset`), vérifier : fonction présente, table `art9_temoin` RLS forcée + policy, `probe` toujours deny-by-default.

- [x] **Tâche 2 — Le contrôle de révocation (Server Action, sous RLS)** (AC : 3)
  - [x] `revoquerConsentement()` dans `app/(auth)/consentement/actions.ts` : `getUser()` d'abord (on ne révoque que **son** consentement) ; poser `revoked_at = now()` sur `consentement` **sous la session RLS** (jamais `service_role`), uniquement si non déjà révoqué (idempotent) ; rediriger vers l'écran de révocation. Poser `revoked_at` **suffit** à re-fermer le write-gate (le prédicat exige `revoked_at is null`) — c'est le lien à prouver bout en bout.
  - [x] Route de révocation `app/(auth)/consentement/revoquer/page.tsx` : confirmation franche (une action), déclenche `revoquerConsentement`. Point d'entrée UI définitif (menu compte / page transparence) = **1.7+** ; pour 1.6, la route + l'action + l'écran suspendu + les tests suffisent à prouver AC3/AC4.

- [x] **Tâche 3 — L'état « traitement art. 9 suspendu » (onboarding + gardes)** (AC : 3, 4)
  - [x] Étendre `app/(auth)/onboarding.ts` : nouvel état `EtapeOnboarding` = `… | "revoque"`. Distinguer **`revoque`** (`art9_accorde=true` **mais** `revoked_at ≠ null`) de **`consentement`** (jamais consenti) — une révoquée ne doit **jamais** être renvoyée re-consentir (pas de reconquête, AC4).
  - [x] `app/(auth)/etat-onboarding.ts` : calculer un statut de consentement **ternaire** (`aucun` / `valide` / `revoque`) au lieu du booléen `aConsenti`, et le passer à `etapeOnboarding`. Continuer à lire sous RLS, fail-loud sur erreur (acquis 1.5).
  - [x] Router `revoque` dans les gardes : `/` (Tâche 0), `/naissance`, `/consentement`, `/auth/confirm` → **écran de révocation**, jamais la scène, jamais `/consentement` pour re-cocher.

- [x] **Tâche 4 — L'écran de révocation : export puis suppression, sans rétention** (AC : 4)
  - [x] `app/(auth)/consentement/revoque/…` (écran « suspendu ») : dit franchement que le traitement des données sensibles est **suspendu**, propose **exporter** (bouton présent — l'export réel est **différé**, voir Périmètre) **puis supprimer le compte**. **Aucune** rétention, **aucune** offre de reconquête, **aucun** « es-tu sûre ? » culpabilisant. Registre produit, **jamais signé Anam**.
  - [x] **Suppression finale** : réutiliser telle quelle la suppression de compte de 1.5 (`refuser` → `admin.deleteUser` isolé, cascade). Ne pas ré-implémenter.

- [x] **Tâche 5 — Preuve par test, bloquante en CI** (AC : 1, 2, 3)
  - [x] `tests/write-gate-art9.test.ts` (modèle : sessions scopées de `consentement.test.ts`) :
    - **AC1** : utilisatrice **sans** consentement valide → `insert` dans `art9_temoin` **REFUSÉ** (RLS with check) ; `a_consenti_art9` = `false`.
    - **AC2** : utilisatrice **avec** consentement valide → `insert` **autorisé** ; `a_consenti_art9` = `true`.
    - **AC3** : après `revoquerConsentement` (`revoked_at` posé) → `insert` de **nouveau REFUSÉ** ; `etapeOnboardingPour` = `"revoque"` ; la **lecture** de ses lignes art. 9 déjà posées reste **permise** (export).
  - [x] Ajuster le **tripwire** existant (`consentement.test.ts` « Frontière art. 9 ») : `art9_temoin` existe désormais **volontairement** (c'est le gabarit gardé) ; le tripwire doit continuer à vérifier qu'aucune **vraie table de contenu** art. 9 (`journal`/`seance`/`tirage`/`socle`) n'existe encore.
  - [x] Vérifier que `tests/rls.test.ts` (RLS deny-by-default, AD-12) reste vert et **couvre** `art9_temoin` comme table gardée (policy présente ≠ défaut de build).
  - [x] Mettre à jour les tests de `etapeOnboarding` (nouvel état `revoque`).
  - [x] Vérifs finales : `npx vitest run` (tout : 1.1→1.6), `npm run lint`, `npx tsc --noEmit`, `next build`.

### Review Findings

_Revue de code adversariale (Edge Case Hunter + Acceptance Auditor ; Blind Hunter a échoué → couche manquée), 2026-07-24. Commit bf75435._

**Décision requise :**

- [x] [Review][Decision] Ton des écrans de révocation — `t-anam` (voix d'Anam, Fraunces) vs registre produit (`t-corps`, Inter). La story dit « registre produit, jamais signé Anam » mais les écrans revoquer/revoque ouvrent en `t-anam`. Copie neutre (2ᵉ personne, pas de « je ») donc probablement conforme sur le fond ; l'habillage-voix est à trancher. [app/(auth)/consentement/revoque/page.tsx, revoquer/page.tsx]

**À corriger (patch) :**

- [x] [Review][Patch] **[HIGH]** `donnerConsentement` n'a AUCUNE garde pour l'état `revoque` (gère mineur/naissance/suite, oublie revoque) → une révoquée (session vivante, pas de signOut à la révocation) qui rejoue l'action voit `revoked_at` remis à `null` (upsert l.50) → `a_consenti_art9` rerépond true → **le write-gate se rouvre** : reconquête, contourne « non contournable » (AC4). Trouvé par edge+auditor. Ajouter `if (etape === "revoque") redirect("/consentement/revoque")` avant l'upsert + corriger le commentaire l.50. [app/(auth)/consentement/actions.ts:37-50]
- [x] [Review][Patch] **[MEDIUM]** `revoquerConsentement` sans garde d'état (contrairement à `donnerConsentement`) → un POST direct pose `revoked_at` sur une ligne `art9_accorde=false` (état incohérent, lu comme « aucun ») ou « réussit » en n'updatant 0 ligne (faux succès, redirige vers l'écran suspendu sans rien avoir révoqué). Ajouter une garde `etapeOnboardingPour` (ne révoquer que depuis `suite`). [app/(auth)/consentement/actions.ts:108-123]
- [x] [Review][Patch] **[LOW]** `revoked_at` posé sans `date_naissance` → `etapeOnboarding` teste `!date → naissance` AVANT `revoque` → une révoquée sans date est routée vers le tunnel `/naissance` au lieu de l'écran suspendu. Déplacer le test `revoque` avant le test date. [app/(auth)/onboarding.ts:35-42]
- [x] [Review][Patch] **[LOW]** `a_consenti_art9(uid)` prend un `uid` arbitraire, `security definer`, exposée en RPC à tout `authenticated` → oracle booléen inter-utilisatrices (B apprend si A a un consentement art. 9 actif). Passer à une variante sans paramètre s'appuyant sur `auth.uid()`. [supabase/migrations/0005_write_gate_art9.sql:15-32]
- [x] [Review][Patch] **[LOW]** AC3 « bout en bout » : la révocation est testée en rejouant l'UPDATE à la main, jamais via la Server Action `revoquerConsentement` (getUser + idempotence + redirect non couverts). Renforcer la couverture (lié au patch MEDIUM ci-dessus). [tests/write-gate-art9.test.ts]

**✅ Correctifs appliqués (2026-07-24).** Les 5 patchs + la décision (registre produit `t-corps` sur les écrans de révocation) sont appliqués. Le bug HIGH est fermé : `donnerConsentement` redirige une révoquée vers l'écran suspendu avant tout upsert ; `revoquerConsentement` gagne la même garde d'état ; l'oracle `a_consenti_art9(uid)` devient sans paramètre (`auth.uid()`) ; l'ordre `revoque`-avant-date est corrigé ; idempotence couverte. **119 tests / tsc / lint / build verts.** Blind Hunter : couche manquée (à relancer sur une prochaine story).

## Dev Notes

### Périmètre STRICT

Le **write-gate art. 9 au niveau base** + la **révocation** — **uniquement**.

**OUI** : fonction de garde `a_consenti_art9`, table témoin `art9_temoin` gardée, migration 0005, Server Action de révocation (pose `revoked_at` sous RLS), état onboarding `revoque` + routage des gardes, écran de révocation honnête (dirige vers export/suppression, réutilise la suppression 1.5), garde de `/` (préambule déjà fait), preuves par test bloquantes.

**NON (hors périmètre, tracé)** :
- **Egress-gate** (AD-13, 2ᵉ volet) — le point d'egress unique `lib/ai/egress-guard` qui revérifie consentement + ZDR **dans la même transaction que l'envoi** au fournisseur : **epic IA** (aucun appel IA n'existe encore).
- **Export réel des données** — l'écran le *propose* mais l'implémentation (assemblage + livraison) relève de l'**epic données** ; ici un bouton honnête, marqué « à venir ».
- **Moteur d'effacement / propagation** aux sous-traitants + sauvegardes/PITR (AD-14) — la suppression **de compte** de 1.5 (cascade) suffit à ce stade ; la propagation exhaustive est l'epic données.
- **Vraies tables de contenu art. 9** (`journal`, `seance`, `tirage`, `socle`) — elles arriveront dans leurs epics et **copieront** la policy du gabarit. NE PAS les créer ici.
- Le **texte juridique exact** (formulation de la révocation) : clair et honnête ici, **à valider par un juriste** avant lancement.

### Continuité 1.5 (à réutiliser, ne pas réinventer)

- **Table `consentement`** (migration 0004) : `revoked_at timestamptz` est **déjà préparée** « pour la Story 1.6 » (commentaire ligne 7). 1.6 l'**exploite** enfin.
- **`app/(auth)/etat-onboarding.ts`** : source **unique** partagée par les 3 gardes ; lit déjà `art9_accorde, ia_reconnue, revoked_at` et fail-loud sur erreur de lecture. À **enrichir** (statut ternaire), pas à refondre.
- **`app/(auth)/onboarding.ts`** : `etapeOnboarding` pur (+ ses tests) — à **étendre** (`revoque`).
- **`lib/data/supabase/admin.ts`** (`import "server-only"`) : suppression de compte système déjà isolée — **réutiliser** pour la suppression finale.
- **Pattern migration** forward-only `0004 → 0005` ; **précédent `probe`** (0001) = table-sonde permanente qui prouve un invariant RLS → `art9_temoin` est son équivalent art. 9.
- **Env des tests** : Vitest ne charge PAS `.env.local` → `npx vitest run`.

### Décision technique : RLS `WITH CHECK` + fonction, PAS un trigger

Le write-gate est porté par une **policy RLS `WITH CHECK`** appelant `a_consenti_art9(auth.uid())`, et **non** par un trigger `BEFORE INSERT`.

- **RLS + fonction (choisi)** : *déclaratif* ; **non contournable** sous `force row level security` ; **même mécanisme** que tout le reste du système (cohérence AD-12, rien de neuf à auditer) ; **factorisable** — chaque future table art. 9 copie une ligne de policy ; **testable via l'API REST** (PostgREST) sans exécuter de DDL dans les tests.
- **Trigger `BEFORE INSERT` (rejeté)** : impératif ; **redondant** avec la RLS ; ne participe pas au modèle *deny-by-default* ; un trigger peut être désactivé/contourné par un rôle privilégié — on ne veut **pas** que la garde en dépende.

**`security definer` (choisi) vs `security invoker`** : la fonction est `security definer` avec `set search_path = ''` (schémas qualifiés → pas de hijack) et `revoke public / grant authenticated`. Raison : **découpler** la garde de la policy de *lecture* de `consentement` — le write-gate reste vrai même si demain la lecture de `consentement` est durcie. **Ce n'est pas une violation d'AD-12** : AD-12 interdit `service_role` sur du **contenu applicatif en requête** ; ici la fonction ne *rend qu'un booléen de garde*, n'expose aucun contenu, et c'est le pattern Supabase établi pour les prédicats de policy. `invoker` marcherait aussi (l'utilisatrice peut lire son propre `consentement`), mais est plus fragile au couplage.

**Lecture vs écriture** : le write-gate est en **`WITH CHECK`** (INSERT/UPDATE). Le **`USING`** reste `auth.uid() = utilisatrice_id` **sans** condition de consentement → après révocation, l'utilisatrice peut encore **lire** (export RGPD) et **supprimer** (droit à l'effacement) ses données art. 9 déjà posées ; elle ne peut plus en **écrire** de nouvelles. Détail fin mais délibéré.

### Décision : table témoin permanente `art9_temoin`

Une table témoin **permanente** (pas éphémère) : les tests d'intégration passent par l'API REST et ne font pas de DDL ; prouver que le **pattern de migration** est correct exige une table réelle, gardée, en base. Elle est **vide en prod**, sert de **preuve vivante** (test CI en continu) **et** de **gabarit** copiable. Précédent assumé dans le projet : `probe` (0001).

### Décision : distinguer `revoque` de `consentement` (pas de reconquête)

Une utilisatrice révoquée (`art9_accorde=true` + `revoked_at≠null`) **ne doit pas** retomber sur `/consentement` pour re-cocher (ce serait une reconquête déguisée, contraire à AC4). D'où un **état distinct** `revoque` qui la route vers l'écran « suspendu → export/suppression ». C'est pourquoi `etat-onboarding` passe d'un booléen `aConsenti` à un statut ternaire.

### Anti-patterns à prévenir (ne PAS faire)

- ❌ Write-gate en **trigger** (impératif, contournable, hors deny-by-default) — c'est de la **RLS `WITH CHECK`**.
- ❌ Fonction `security definer` **sans `search_path` verrouillé** (faille d'injection de schéma).
- ❌ Mettre le write-gate en **`USING`** (bloquerait la lecture → casserait l'export RGPD). Le write-gate est en **`WITH CHECK`**.
- ❌ Poser `revoked_at` via **`service_role`** — c'est **sous la session RLS** de l'utilisatrice.
- ❌ Renvoyer une **révoquée** vers `/consentement` pour re-consentir (reconquête) — elle va vers export/suppression.
- ❌ Écran de révocation avec **rétention** / « es-tu sûre ? » / offre de reconquête ; ou **signé Anam**.
- ❌ Créer une **vraie** table de contenu art. 9 (`journal`/`seance`/…) ici, ou implémenter l'**export réel** / le **moteur d'effacement** (AD-14).
- ❌ Créer `art9_temoin` **sans** sa policy → **défaut de build** (AD-12 : table art. 9 sans politique casse la CI).

### Project Structure Notes

- **Nouveaux** : `supabase/migrations/0005_write_gate_art9.sql` ; `app/(auth)/consentement/revoquer/page.tsx` (confirmation) + `app/(auth)/consentement/revoque/page.tsx` (écran suspendu) *(nommage exact à la main du dev)* ; `tests/write-gate-art9.test.ts`.
- **Modifiés** : `app/(auth)/onboarding.ts` (+ état `revoque`) + ses tests ; `app/(auth)/etat-onboarding.ts` (statut ternaire) ; `app/(auth)/consentement/actions.ts` (+ `revoquerConsentement`) ; gardes `app/(auth)/naissance/page.tsx`, `app/(auth)/consentement/page.tsx`, `app/auth/confirm/route.ts` (router `revoque`) ; `app/page.tsx` (préambule, déjà fait) ; `tests/consentement.test.ts` (tripwire ajusté).
- **Couches** : SQL = `supabase/migrations/` ; garde = **base** (RLS/fonction), jamais applicative ; UI + Server Action = `app/` ; données sous session RLS via `lib/data/supabase/server.ts` ; suppression système = `lib/data/supabase/admin.ts`. Rien dans `lib/domain`.

### References

- [Source : epics.md#Epic 1 → Story 1.6] — 4 critères, FR-012/FR-072, AD-13/AD-4.
- [Source : ARCHITECTURE-SPINE.md#AD-13] — write-gate : aucun dépôt art. 9 sans consentement valide **et non révoqué**, garde technique (pas UI) ; la révocation bascule en « traitement art. 9 suspendu ». (L'egress-gate est le 2ᵉ volet, epic IA.)
- [Source : ARCHITECTURE-SPINE.md#AD-12] — écriture sous RLS ; `service_role` réservé aux tâches système ; table art. 9 sans policy = défaut de build.
- [Source : ARCHITECTURE-SPINE.md#AD-4] — frontière art. 9 non contournable ; lecture pour export, effacement propagé (AD-14).
- [Source : ARCHITECTURE-SPINE.md#AD-14] — moteur unique de rétention/effacement, export avant suppression : **contexte**, propagation **hors périmètre** 1.6.
- [Source : supabase/migrations/0004_consentement.sql] — `revoked_at` préparée ; policy propriétaire ; RLS forcée.
- [Source : supabase/migrations/0001_rls_deny_by_default.sql] — précédent `probe` (table-sonde d'invariant RLS).
- [Source : Story 1.5] — `etat-onboarding` (source unique), `admin.ts` (suppression isolée), pattern d'écran + preuve par test.

## Dev Agent Record

### Implementation Plan

1. **Backbone base d'abord** — migration 0005 : fonction `a_consenti_art9` (definer, search_path verrouillé) + table `art9_temoin` gardée (WITH CHECK). `supabase db reset`, vérifier en base.
2. **État** — `onboarding.ts` (`revoque`) + `etat-onboarding.ts` (statut ternaire) + tests `etapeOnboarding`.
3. **Révocation** — Server Action `revoquerConsentement` (pose `revoked_at` sous RLS) + route de confirmation.
4. **Routage** — les 4 gardes dirigent `revoque` vers l'écran suspendu (jamais la scène / jamais re-consentir).
5. **Écran suspendu** — export (différé) + suppression (réutilise 1.5), sans rétention.
6. **Preuves** — `write-gate-art9.test.ts` (AC1/2/3 bout en bout : sans / avec / après révocation), tripwire ajusté, `rls.test.ts` couvre `art9_temoin`. Vérifs vertes.

### Agent Model Used

Opus 4.8 (`claude-opus-4-8`, 1M context) — via `bmad-dev-story`.

### Debug Log References

- **Env des tests d'intégration** : Vitest ne charge pas `.env.local` → lancés avec `npx vitest run`. Migration appliquée via `supabase db reset` (Docker local).
- **`security definer` + `search_path = ''`** : `a_consenti_art9` qualifie `public.consentement` ; `revoke all from public` + `grant execute to authenticated` → seule une session authentifiée l'appelle (3 tests write-gate le confirment). Un non-authentifié est de toute façon bloqué en amont par `auth.uid() = utilisatrice_id`.
- **Write-gate en WITH CHECK, pas USING** : vérifié en test — après révocation, l'écriture est refusée MAIS la lecture des lignes déjà posées reste permise (export RGPD). Intention délibérée.
- **Refactor `refuser` sans casser 1.5** : suppression de compte extraite en helper privé `effacerCompteCourant(cheminEchec)` ; `refuser()` (signature inchangée) et `supprimerCompteRevoque()` délèguent. Zéro duplication, échec jamais silencieux.
- **Signature `etapeOnboarding`** : booléen `aConsenti` → statut ternaire (`aucun`/`valide`/`revoque`) pour distinguer « jamais consenti » de « révoqué » (sinon une révoquée serait renvoyée re-consentir). Impact : 6 appels de `date-naissance.test.ts` mis à jour + 1 cas `revoque`.
- **psql absent** de l'environnement → structure de la migration validée par le comportement (tests d'intégration via l'API REST), pas par introspection SQL directe.
- **Warnings de build non bloquants (pré-existants, pas introduits par 1.6)** : `middleware`→`proxy` (déprécation Next 16, porte pré-lancement connue) ; `package-lock.json` parent dans `/Users/juliantalou/` détecté comme racine Turbopack — à nettoyer.

### Completion Notes List

- **AC1** : sans consentement valide, la base REFUSE l'écriture art. 9 (RLS with check) — prouvé (`a_consenti_art9`=false, insert refusé). ✅
- **AC2** : avec consentement valide et non révoqué, la base AUTORISE l'écriture. ✅
- **AC3** : après révocation (`revoked_at`), écriture de NOUVEAU refusée + bascule en état « revoque » (`etapeOnboardingPour`) ; lecture des lignes déjà posées encore permise (export). ✅
- **AC4** : révocation → écran « suspendu » (`/consentement/revoque`) proposant export (différé, marqué honnêtement) puis suppression (réutilise la suppression de compte de 1.5), SANS rétention ni reconquête ; les 4 gardes routent « revoque » vers cet écran, jamais vers la scène ni un re-consentement. ✅
- **Write-gate** = RLS `WITH CHECK` + fonction `a_consenti_art9` (security definer, search_path verrouillé) sur la table témoin `art9_temoin` (gabarit + sonde vivante, écho art. 9 de `probe`). PAS de trigger.
- **Garde de `/` (préambule)** : la scène est désormais gardée (compte + majorité + consentement), remplaçant le prototype WebGL non gardé — résout le différé de la revue 1.5.
- **Hors périmètre (respecté)** : egress-gate IA, export réel des données, moteur d'effacement/propagation (AD-14), vraies tables de contenu art. 9 — tous différés et tracés.
- **À valider avant lancement** : texte de révocation (juriste) ; export réel à brancher avant lancement (aujourd'hui : bouton désactivé + motif écrit).
- **Vérifs** : `vitest` **119/119** (+6 : write-gate ×3, `revoque` onboarding, tripwire ×2 dont `art9_temoin` deny-by-default), `tsc --noEmit` propre, `eslint` propre, `next build` OK (`/`, `/consentement/revoque`, `/consentement/revoquer` en dynamique).

### File List

**Nouveaux**
- `supabase/migrations/0005_write_gate_art9.sql` (fonction `a_consenti_art9` + table témoin `art9_temoin` gardée)
- `app/(auth)/consentement/revoquer/page.tsx` (confirmation de révocation)
- `app/(auth)/consentement/revoque/page.tsx` (écran « traitement suspendu » → export/suppression)
- `tests/write-gate-art9.test.ts` (AC1/AC2/AC3 : write-gate + révocation bout en bout)

**Modifiés**
- `app/page.tsx` (préambule : scène 2D gardée au lieu du spike WebGL ; route l'état `revoque`)
- `app/(auth)/onboarding.ts` (signature statut ternaire + état `revoque`)
- `app/(auth)/etat-onboarding.ts` (calcul du statut de consentement ternaire)
- `app/(auth)/consentement/actions.ts` (+ `revoquerConsentement`, + `supprimerCompteRevoque`, refactor `refuser` via helper `effacerCompteCourant`)
- `app/(auth)/naissance/page.tsx`, `app/(auth)/consentement/page.tsx`, `app/auth/confirm/route.ts` (routage de l'état `revoque`)
- `tests/date-naissance.test.ts` (appels `etapeOnboarding` → statut ternaire + cas `revoque`)
- `tests/consentement.test.ts` (tripwire ajusté : `art9_temoin` existe, vraies tables de contenu non)
- `tests/rls.test.ts` (+ `art9_temoin` fermée par défaut pour une clé non authentifiée)

## Change Log

| Date | Version | Description | Auteur |
|---|---|---|---|
| 2026-07-24 | 0.1 | Création de la story (write-gate art. 9 au niveau base : fonction `a_consenti_art9` + table témoin gardée `art9_temoin` en RLS `WITH CHECK` ; révocation `revoked_at` sous RLS ; état onboarding `revoque` + écran suspendu sans rétention ; garde de `/` en préambule ; preuves par test bloquantes). Périmètre : egress-gate / export réel / moteur d'effacement (AD-14) explicitement différés. | create-story |
| 2026-07-24 | 0.2 | Implémentation : migration 0005 (fonction `a_consenti_art9` security definer + table témoin `art9_temoin` gardée en RLS WITH CHECK), Server Action `revoquerConsentement` (revoked_at sous RLS), état onboarding `revoque` (statut ternaire) + routage des 4 gardes, écrans `/consentement/revoquer` + `/consentement/revoque` (export différé → suppression réutilisant 1.5), garde de `/` (préambule). 119 tests / lint / tsc / build verts. | dev-story (Opus 4.8) |
| 2026-07-24 | 0.3 | Revue de code (Edge Case Hunter + Acceptance Auditor ; Blind Hunter manqué). 1 bug HIGH — reconquête : `donnerConsentement` oubliait l'état `revoque` → une révoquée pouvait re-consentir et rouvrir le write-gate ; corrigé. + garde d'état sur `revoquerConsentement`, oracle `a_consenti_art9` rendu sans paramètre (`auth.uid()`), ordre `revoque`-avant-date, registre produit sur les écrans de révocation, couverture d'idempotence. 119 tests / lint / tsc / build verts. | code-review (Opus 4.8) |

## Status

done
