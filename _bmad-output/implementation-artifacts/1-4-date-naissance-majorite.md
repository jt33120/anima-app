---
baseline_commit: 871db4deea7fd9446e98aaf79b36a7efaa27ed5e
story_key: "1-4-date-naissance-majorite"
epic: 1
story: 4
title: "Déclarer sa date de naissance et bloquer les moins de 18 ans"
epic_name: "Franchir le seuil"
covers: [FR-069, FR-070, FR-072, AD-6, NFR-023]
depends_on: ["1-3-creer-compte-sans-mot-de-passe"]
status: done # revue de code faite (0f14ec2, barrière mineur persistante) ; corrigé le 2026-08-07 (disait `ready-for-dev`).
created: "2026-07-23"
sources:
  - _bmad-output/planning-artifacts/epics.md#epic-1--story-1-4
  - _bmad-output/planning-artifacts/architecture/architecture-Anima-2026-07-22/ARCHITECTURE-SPINE.md
---

# Story 1.4 : Déclarer sa date de naissance et bloquer les moins de 18 ans

Status: review

<!-- Note : validation optionnelle. Lancer validate-create-story avant dev-story pour un contrôle qualité. -->

## Story

En tant qu'**utilisatrice**,
je veux **déclarer ma date de naissance une seule fois juste après la création du compte**,
afin de **confirmer que j'ai 18 ans ou plus et de fournir la donnée qui nourrira plus tard mon socle**.

## Acceptance Criteria

1. **Étant donné** un compte fraîchement créé (FR-072, étape 2, avant le consentement) **Quand** l'écran de déclaration d'âge s'affiche **Alors** l'âge minimum « 18 ans ou plus » est affiché explicitement (FR-069) **Et** l'étiquette du champ est visible, jamais un placeholder en guise d'étiquette.

2. **Étant donné** une date de naissance correspondant à moins de 18 ans **Quand** l'utilisatrice la soumet **Alors** la création du compte est bloquée côté serveur, en registre produit, sans culpabilisation **Et** aucune donnée de socle n'est calculée (FR-070).

3. **Étant donné** une date de naissance correspondant à 18 ans ou plus **Quand** l'utilisatrice la soumet **Alors** elle est stockée une seule fois sur `utilisatrice` (contrôle d'âge appliqué techniquement, NFR-023) **Et** le parcours avance vers l'écran de consentement (FR-072).

4. **Étant donné** une date de naissance valide déjà enregistrée **Quand** l'utilisatrice poursuit le parcours **Alors** la date n'est plus jamais redemandée (saisie unique, FR-070) **Et** elle est conservée pour alimenter le socle le moment venu (AD-6), sans recalcul ni re-saisie.

5. **Étant donné** que la date de naissance est une donnée personnelle ordinaire, non art. 9 **Quand** elle est collectée à l'étape 2, avant le consentement **Alors** FR-072 est respecté (aucune donnée *sensible* art. 9 avant consentement) **Et** le thème natal art. 9 qui en dérivera n'est calculé qu'après le consentement (frontière AD-4/AD-13, epic ultérieur).

## Tasks / Subtasks

- [x] **Tâche 1 — Migration 0003 : `date_naissance` + garde d'immuabilité + marqueur mineur** (AC : 3, 4)
  - [x] `supabase/migrations/0003_date_naissance.sql`, forward-only. Sur `public.utilisatrice` :
    ```sql
    alter table public.utilisatrice add column date_naissance date;
    -- Marqueur de minorité détectée (aucune DOB de mineur stockée — juste le drapeau).
    alter table public.utilisatrice add column mineur_detecte boolean not null default false;
    ```
  - [x] **Garde d'immuabilité (AD-6 / FR-070, saisie unique)** — trigger `before update` qui refuse toute modification de `date_naissance` une fois posée :
    ```sql
    create function public.date_naissance_immuable() returns trigger
      language plpgsql security definer set search_path = '' as $$
    begin
      if old.date_naissance is not null
         and new.date_naissance is distinct from old.date_naissance then
        raise exception 'date_naissance est immuable (AD-6)';
      end if;
      return new;
    end; $$;
    create trigger utilisatrice_date_naissance_immuable
      before update on public.utilisatrice
      for each row execute function public.date_naissance_immuable();
    ```
  - [x] La RLS existante (`auth.uid() = id`) suffit : l'utilisatrice écrit **sa** ligne sous sa session (jamais `service_role`, AD-12). Appliquer (`supabase db reset`) et vérifier colonnes + trigger.

- [x] **Tâche 2 — Écran de déclaration d'âge (mobile-first, design-system)** (AC : 1)
  - [x] Nouvelle route dans le groupe `(auth)` : `app/(auth)/naissance/page.tsx`. Réutiliser le pattern de `app/(auth)/entrer/` (module CSS champ/bouton, formulaire client + Server Action).
  - [x] Afficher **explicitement « 18 ans ou plus »** (FR-069). Champ **date de naissance** avec **étiquette visible** (`<label>` lié — jamais un placeholder en guise d'étiquette). Registre **non culpabilisant** (voix produit neutre, pas de menace).
  - [x] Mobile-first (colonne unique, `cible-tactile`, marges mobiles), rôles `t-*` du design-system.

- [x] **Tâche 3 — Contrôle d'âge côté serveur + branchement (NFR-023)** (AC : 2, 3)
  - [x] Server Action `app/(auth)/naissance/actions.ts` : calcule l'âge **côté serveur** à partir de la date soumise (source de vérité = serveur, jamais le client).
  - [x] **< 18 ans** → **blocage** : poser `mineur_detecte = true` sur la ligne (sous la session RLS), **NE PAS** stocker la date (minimisation), **déconnecter** (signOut), rediriger vers un écran de refus **non culpabilisant** ; aucun socle calculé (il n'y en a pas à ce stade — juste ne rien enclencher). **Décision (voir Dev Notes) : drapeau + ordonnanceur (AD-14/FR-071), PAS de suppression admin depuis un route handler.**
  - [x] **≥ 18 ans** → écrire `date_naissance` **une seule fois** sur `utilisatrice` (sous la session RLS ; le trigger garantit l'immuabilité). Avancer le parcours (Tâche 4).
  - [x] Validation d'entrée : date plausible (pas dans le futur, pas absurde), sinon erreur en enveloppe neutre `{ code, message }` (jamais signée Anam).

- [x] **Tâche 4 — Brancher le parcours d'entrée (post-login → âge → consentement)** (AC : 3, 4)
  - [x] Après login, diriger vers `/naissance` **tant que** `date_naissance` est nulle **et** `mineur_detecte` faux. Modifier la redirection de `app/auth/confirm/route.ts` (défaut `next`) pour viser l'étape d'onboarding, OU ajouter la logique de redirection au point d'entrée. **Ne pas casser** le prototype `/` ni `/entrer`.
  - [x] `date_naissance` déjà posée → **ne jamais** re-afficher `/naissance` (redléger vers la suite). La suite = **placeholder de consentement** (Story 1.5 non construite) : une route `app/(auth)/consentement/` minimale (« bientôt ») ou une redirection documentée.
  - [x] `mineur_detecte` vrai → l'accès reste bloqué (écran de refus), pas de re-tentative.

- [x] **Tâche 5 — Preuve par test, bloquante en CI** (AC : 2, 3, 4)
  - [x] `tests/date-naissance.test.ts` : via une session scopée (comme `tests/utilisatrice-rls.test.ts`, admin+password pour minter la session) —
    - **< 18** : la logique serveur **rejette** (aucune `date_naissance` stockée ; `mineur_detecte` posé). *(Tester la fonction/Server Action de contrôle d'âge, ou reproduire sa règle côté test.)*
    - **≥ 18** : `date_naissance` stockée.
    - **Immuabilité** : une 2ᵉ écriture d'une `date_naissance` différente est **refusée** par le trigger (l'update échoue). C'est la preuve « saisie unique » (AD-6/FR-070).
  - [x] Assertion négative (red-green) : retirer le trigger d'immuabilité → la 2ᵉ écriture passe (régression) → restaurer. Documenter au Debug Log.
  - [x] Vérifs finales : `npx vitest run` tout vert (1.1 + 1.2 + 1.3 + 1.4), `npm run lint`, `npx tsc --noEmit`, `next build`.

## Dev Notes

### Périmètre STRICT

Déclaration d'âge + barrière 18 ans **uniquement**. **OUI** : `date_naissance` sur `utilisatrice` (ordinaire, immuable, saisie unique), écran mobile-first, contrôle serveur <18, drapeau mineur. **NON** : consentement art.9 (Story 1.5 → placeholder), calcul du **thème natal / socle** (epic ultérieur, APRÈS consentement — frontière AD-4/AD-13), l'**ordonnanceur** de suppression réel (AD-14, epic ultérieur — ici on pose juste le drapeau + le blocage d'accès), gestion de compte. **Ne pas** toucher `app/page.tsx` (prototype).

### Continuité 1.3 (à réutiliser, ne pas réinventer)

- Table `utilisatrice` (1:1 auth.users, RLS `auth.uid()=id`, trigger `handle_new_user`) → on l'ALTER (colonnes), on écrit **sous la session RLS** de l'utilisatrice (jamais `service_role`).
- Écran `/entrer` = pattern exact à copier pour `/naissance` : `entrer.module.css` (champ, bouton, cible-tactile), `formulaire-entree.tsx` (client, `useActionState`), `actions.ts` (Server Action), étiquette visible.
- Migrations forward-only 0001/0002 → **0003**. Session + middleware déjà en place (1.3). Preuve RLS par test (`tests/utilisatrice-rls.test.ts`) = modèle pour `tests/date-naissance.test.ts`.

### Décision : blocage <18 — drapeau + ordonnanceur (PAS de suppression admin en route handler)

Deux options :
- **(A) Supprimer le compte auth immédiatement** via l'API admin (clé secret) dans le Server Action. **Écarté** : introduit `service_role` dans un chemin applicatif (esprit AD-12), et double le propriétaire de la suppression (AD-14 possède rétention/effacement).
- **(B) Drapeau `mineur_detecte` + blocage d'accès immédiat, suppression par l'ordonnanceur** (AD-14/FR-071, 30j). **RETENU** : le route handler reste sans `service_role` ; l'effacement a **un seul propriétaire** (l'ordonnanceur, epic ultérieur). Ici : poser le drapeau (sous la session RLS de l'utilisatrice, sur sa propre ligne), déconnecter, écran de refus. Minimisation : **aucune DOB de mineur stockée**.

### Frontière art.9 (AD-4/AD-13) — pourquoi c'est OK ici

`date_naissance` est une donnée **ordinaire** (pas art.9). Elle est collectée à l'**étape 2, avant** le consentement art.9 → FR-072 respecté (aucune donnée *sensible* avant consentement). Le **thème natal** (art.9) qu'elle alimentera n'est calculé qu'**après** le consentement (epic ultérieur). Donc pas de write-gate art.9 ici — mais **ne rien calculer/déduire d'art.9** à ce stade.

### Contrôle d'âge — côté serveur (NFR-023)

L'âge se calcule **sur le serveur** (Server Action), jamais confiance au client. Règle : `< 18` si `date_naissance > (aujourd'hui - 18 ans)`. Le client peut afficher un indice, mais la **décision** est serveur. Le stockage passe par la session RLS (l'utilisatrice écrit sa ligne).

### Anti-patterns à prévenir (ne PAS faire)

- ❌ Contrôle d'âge **côté client** comme seule barrière (NFR-023 → serveur).
- ❌ **Placeholder en guise d'étiquette** sur le champ date.
- ❌ Registre **culpabilisant** pour le refus <18 (voix neutre, pas de menace).
- ❌ Stocker la **DOB d'un mineur** (minimisation → seulement le drapeau).
- ❌ `service_role`/suppression admin dans un route handler applicatif (AD-12) — c'est l'ordonnanceur (AD-14) qui supprime.
- ❌ Re-demander la date une fois posée / permettre de la changer (AD-6, trigger d'immuabilité).
- ❌ Calculer un socle ou toute inférence art.9 à ce stade (avant consentement).
- ❌ Toucher `app/page.tsx` (prototype).

### Project Structure Notes

- Nouveaux : `supabase/migrations/0003_date_naissance.sql` ; `app/(auth)/naissance/{page.tsx, formulaire-naissance.tsx, actions.ts}` (+ réutiliser/mutualiser le module CSS d'`entrer`) ; écran de refus `<18` (ex. `app/(auth)/naissance/refus.tsx` ou état du formulaire) ; placeholder `app/(auth)/consentement/page.tsx` ; `tests/date-naissance.test.ts`.
- Modifiés : `app/auth/confirm/route.ts` (redirection d'onboarding), possiblement `entrer.module.css` (mutualisation champ/bouton).
- Couches (AD-1/AD-10) : UI + Server Action = `app/` ; accès données = session RLS via `lib/data/supabase/server.ts`. Rien dans `lib/domain`.

### References

- [Source : epics.md#Epic 1 → Story 1.4] — 5 critères, FR-069/070/072, AD-6, NFR-023.
- [Source : ARCHITECTURE-SPINE.md#AD-6] — date saisie une fois, immuable, alimente le socle (jamais LLM).
- [Source : ARCHITECTURE-SPINE.md#AD-4/AD-13] — frontière art.9 ; DOB ordinaire avant consentement ; thème natal art.9 après.
- [Source : ARCHITECTURE-SPINE.md#AD-14 / FR-071] — minorité détectée → suppression 30j par l'ordonnanceur (propriétaire unique de l'effacement).
- [Source : ARCHITECTURE-SPINE.md#AD-12] — écriture sous session RLS, jamais service_role en route handler.
- [Source : Story 1.3] — table `utilisatrice`, session, pattern d'écran `/entrer`, preuve RLS par test.
- [Source : Story 1.2] — design-system (champ, bouton, cible-tactile, étiquette, accessibilité).

## Dev Agent Record

### Implementation Plan

Migration 0003 (`date_naissance` + `mineur_detecte` + trigger d'immuabilité). Écran `/naissance` sur le pattern `/entrer`. Contrôle d'âge serveur via helper **pur** `estMajeur` (séparé du Server Action, testable). `<18` → drapeau + `signOut` ; `≥18` → écrit sous session RLS → `/consentement`. Onboarding branché dans `/auth/confirm`. **Aucune dépendance ajoutée.**

### Agent Model Used

Claude Opus 4.8 (1M) — bmad-dev-story.

### Debug Log References

- **Immuabilité prouvée dès la migration** : 1re écriture OK, 2e différente **refusée** par le trigger (« date_naissance est immuable (AD-6) »).
- **Helper d'âge PUR** (`age.ts`) séparé du Server Action — un fichier `"use server"` n'exporte que des actions async, donc la règle testable vit à part.
- **Onboarding** : `/auth/confirm` redirige vers `/naissance` tant que `date_naissance` nulle & non mineure ; `/naissance` re-garde (date posée → `/consentement`, jamais redemandée, AC4).

### Completion Notes List

- ✅ **Migration 0003** : `date_naissance` (ordinaire, PAS art.9) + `mineur_detecte` + **trigger d'immuabilité** (AD-6, saisie unique FR-070).
- ✅ **Écran `/naissance`** mobile-first sur le design-system, **« 18 ans ou plus » explicite** (FR-069), **étiquette visible**, garde serveur (AC4).
- ✅ **Contrôle d'âge CÔTÉ SERVEUR** (NFR-023) : `<18` → drapeau + déconnexion + refus **non culpabilisant**, **aucune DOB de mineur stockée** ; `≥18` → stockée sous session RLS (jamais `service_role`, AD-12) → `/consentement`.
- ✅ **Frontière art.9** respectée : date ordinaire avant consentement (FR-072) ; aucun calcul art.9/socle ici.
- ✅ **Preuve par test** : règle de majorité (5 cas limites), stockage `≥18`, **immuabilité** (2e écriture refusée). Bloquant en CI.
- ✅ Régression : **98/98 tests**, `lint`, `tsc`, `next build` prod — tous verts.
- ℹ️ La **suppression réelle** des comptes mineurs = ordonnanceur (AD-14/FR-071), epic ultérieur ; ici seul le drapeau + le blocage d'accès.

### File List

- **Nouveaux** :
  - `supabase/migrations/0003_date_naissance.sql`
  - `app/(auth)/naissance/age.ts`, `actions.ts`, `formulaire-naissance.tsx`, `page.tsx`, `naissance.module.css`
  - `app/(auth)/onboarding.ts` (revue — décision d'onboarding pure)
  - `app/(auth)/consentement/page.tsx`
  - `tests/date-naissance.test.ts`
- **Modifiés** :
  - `app/auth/confirm/route.ts` (redirection d'onboarding + barrière mineur persistante)
  - `app/(auth)/naissance/page.tsx` (garde mineur en défense en profondeur)
  - `app/(auth)/entrer/page.tsx` (message de refus non culpabilisant sur `?refus=age`)

## Senior Developer Review (AI)

**Date :** 2026-07-23 · **Revue :** adversariale, contexte neuf (Opus). *Les 3 sous-agents (`bmad-review-adversarial-general`, `bmad-review-edge-case-hunter`, auditeur d'AC) ont été interrompus par une limite de session ; la revue a été complétée en direct à partir de leurs pistes.* · **Verdict :** Changes Requested → **corrigé**.

### Action Items

- [x] **[Haute] `mineur_detecte` n'était pas appliqué au re-login** (sécurité mineur). Le drapeau était posé mais jamais vérifié comme barrière : un compte signalé mineur pouvait redemander un magic link et atteindre l'app — alors que la Task 4 revendiquait « accès bloqué, pas de re-tentative ». **Corrigé** : helper pur `etapeOnboarding` ; `/auth/confirm` **et** `/naissance` refusent tout compte `mineur_detecte` (déconnexion + `/entrer?refus=age`) à **chaque** connexion. 4 tests ajoutés. Refus non culpabilisant affiché sur `/entrer`.

### Notes (Basses, non bloquantes)

- Calcul d'âge en **UTC cohérent** (la date de naissance est une date pure) — le cas du jour d'anniversaire et les bissextiles sont corrects.
- `/consentement` (placeholder de la 1.5) n'a **pas** de garde de session — aucune donnée sensible pour l'instant ; à traiter dans la vraie Story 1.5.
- Pas de protection de route générale (le middleware ne fait que le refresh) — **par design** ici ; une story dédiée viendra.

## Change Log

| Date | Version | Description | Auteur |
|---|---|---|---|
| 2026-07-23 | 0.1 | Création de la story | create-story |
| 2026-07-23 | 0.2 | Implémentation : date de naissance immuable + barrière 18 ans (contrôle serveur, drapeau mineur, parcours branché) ; 98 tests, build prod OK | dev-story |
| 2026-07-23 | 0.3 | Revue adversariale : correctif barrière mineur persistante (re-login) ; +4 tests → 102, build OK | code-review |

## Status

review
