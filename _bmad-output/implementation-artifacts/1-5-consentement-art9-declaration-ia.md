---
story_key: "1-5-consentement-art9-declaration-ia"
epic: 1
story: 5
title: "Poser la halte de consentement art. 9 et la déclaration IA"
epic_name: "Franchir le seuil"
covers: [FR-012, FR-013, FR-072, NFR-006, AD-9, AD-4, AD-12]
depends_on: ["1-4-date-naissance-majorite"]
status: done
baseline_commit: 0f14ec2790742fa443720ec6910199f1a1332cf1
created: "2026-07-23"
sources:
  - _bmad-output/planning-artifacts/epics.md#epic-1--story-1-5
  - _bmad-output/planning-artifacts/architecture/architecture-Anima-2026-07-22/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-Anima-2026-07-21/DESIGN.md
---

# Story 1.5 : Poser la halte de consentement art. 9 et la déclaration IA

Status: done

<!-- Note : validation optionnelle. Lancer validate-create-story avant dev-story pour un contrôle qualité. -->

## Story

En tant qu'**utilisatrice**,
je veux **un écran dédié qui s'arrête net avant la première séance, m'explique en français clair que je vais parler à une IA, et recueille mon consentement sensible séparément des CGU**,
afin de **savoir à quoi je consens avant qu'aucune confidence ne soit écrite**.

## Acceptance Criteria

1. **Étant donné** l'étape 3 du parcours (FR-072), après la déclaration d'âge et avant la première séance **Quand** l'écran s'affiche **Alors** il présente sur une seule page, sans défilement obligatoire, « Tu vas parler à une intelligence artificielle » (FR-013, AI Act art. 50) et le sens de la conservation puis de l'effacement, en français courant.

2. **Étant donné** l'écran **Quand** l'utilisatrice l'examine **Alors** deux cases distinctes et **non pré-cochées**, jamais groupées : (a) consentement explicite art. 9, (b) acceptation CGU + confirmation 18 ans ou plus **Et** le consentement art. 9 est **séparé** des CGU (FR-012, NFR-006).

3. **Étant donné** qu'au moins une case n'est pas cochée **Quand** l'utilisatrice regarde l'action primaire **Alors** « Je commence » est **désactivée** et le **motif du blocage est écrit en texte** (pas seulement l'état désactivé) **Et** le refus « Je ne veux pas » est de **lisibilité strictement égale**, jamais minoré.

4. **Étant donné** le lien CGU et le lien « Lire le détail » **Quand** l'utilisatrice les active **Alors** les CGU s'ouvrent dans un **nouvel onglet** sans perdre l'état de la page **Et** « Lire le détail » déplie le texte long **en place** (accordéon), la version courte restant principale.

5. **Étant donné** les deux cases cochées **Quand** l'utilisatrice active « Je commence » **Alors** une ligne `consentement` (art. 9 accordé + déclaration IA reconnue, **horodatée**) est écrite **sous son identité (RLS)** **Et** le parcours débloque l'entrée dans la scène (FR-072).

6. **Étant donné** l'écran **Quand** l'utilisatrice active « Je ne veux pas » **Alors** une page dit sans détour que l'app n'est pas utilisable sans cet accord, avec **une** confirmation, et **supprime le compte immédiatement**, sans rétention ni « es-tu sûre ? » culpabilisant.

7. **Étant donné** l'exigence qu'aucune donnée art. 9 ne soit écrite avant ce consentement (FR-072) **Quand** l'utilisatrice atteint cet écran **Alors** aucune table de contenu art. 9 n'a reçu d'écriture pour elle (vérifiable : seuls existent `utilisatrice`, sa `date_naissance`, et à la validation `consentement`).

## Tasks / Subtasks

- [x] **Tâche 1 — Migration 0004 : table `consentement` (RLS `auth.uid()`)** (AC : 5)
  - [x] `supabase/migrations/0004_consentement.sql`, forward-only :
    ```sql
    create table public.consentement (
      utilisatrice_id uuid primary key references public.utilisatrice(id) on delete cascade,
      art9_accorde    boolean not null,
      ia_reconnue     boolean not null,
      cgu_acceptees   boolean not null,
      cree_le         timestamptz not null default now(),
      revoked_at      timestamptz            -- révocation = Story 1.6, colonne préparée
    );
    alter table public.consentement enable row level security;
    alter table public.consentement force  row level security;
    create policy consentement_proprietaire on public.consentement
      for all using (auth.uid() = utilisatrice_id) with check (auth.uid() = utilisatrice_id);
    ```
  - [x] 1:1 (PK = utilisatrice_id). Écriture **sous la session RLS** de l'utilisatrice (jamais `service_role`). **PAS** le write-gate art. 9 ici (c'est la Story 1.6 — AD-13). Appliquer (`supabase db reset`), vérifier table + policy.

- [x] **Tâche 2 — L'écran de consentement (halte nette, une page, mobile-first)** (AC : 1, 2, 3, 4)
  - [x] REMPLACER le placeholder `app/(auth)/consentement/page.tsx` par le vrai écran (client pour l'état des cases). Une seule page, sans défilement obligatoire.
  - [x] Texte en **français courant** : **« Tu vas parler à une intelligence artificielle »** (FR-013) + le sens de la **conservation** puis de l'**effacement**. Version courte principale ; **« Lire le détail » = accordéon** (`<details>`/`<summary>` ou état) qui déplie en place.
  - [x] **Deux cases distinctes, NON pré-cochées, jamais groupées** (chacune sa `<label>` visible) : (a) « Je consens au traitement de mes données sensibles (art. 9) » ; (b) « J'accepte les CGU et je confirme avoir 18 ans ou plus ». Lien **CGU** = `<a target="_blank" rel="noopener">` (nouvel onglet, état préservé). *(Page CGU minimale `/cgu` ou lien placeholder — noter.)*
  - [x] **« Je commence »** : `disabled` tant que les deux cases ne sont pas cochées, **+ un texte explicite** du motif (« coche les deux accords pour continuer ») — l'état désactivé ne suffit pas (AC3). **« Je ne veux pas »** : même poids typographique / lisibilité **strictement égale** (mêmes rôles de texte, pas de gris minoré, pas de dark pattern).
  - [x] Design-system 1.2 (rôles `t-*`, `champ`/cible-tactile, tokens), voix produit neutre non culpabilisante.

- [x] **Tâche 3 — « Je commence » : écrire le consentement → scène** (AC : 5)
  - [x] Server Action : re-valider **côté serveur** que les deux accords sont vrais (jamais confiance au client) ; écrire la ligne `consentement` (`art9_accorde=true, ia_reconnue=true, cgu_acceptees=true, cree_le=now()`) **sous la session RLS**. Idempotent (upsert sur PK si déjà présent).
  - [x] Rediriger vers la **scène** (`/` le prototype, ou un placeholder documenté) — l'entrée est débloquée (FR-072).

- [x] **Tâche 4 — « Je ne veux pas » : refus honnête + suppression immédiate** (AC : 6)
  - [x] Écran/état de refus franc : « Anam n'est pas utilisable sans cet accord », **une** confirmation, **aucune** rétention ni offre de reconquête ni « es-tu sûre ? » culpabilisant.
  - [x] **Suppression immédiate du compte** (AC6). **DÉCISION (voir Dev Notes)** : contrairement au mineur de 1.4 (drapeau + ordonnanceur), l'AC exige l'**immédiat** → **tâche système d'effacement de compte** via l'API admin (`auth.admin.deleteUser`), **isolée** dans un helper dédié `lib/data/supabase/admin.ts` (déjà prévu « migrations/système uniquement » en 1.1), déclenchée par une Server Action qui vérifie d'abord `auth.getUser()` (on ne supprime que SON propre compte). Ce n'est **pas** un `service_role` sur du **contenu** applicatif (AD-12) : c'est une suppression de compte, et **aucun art. 9 n'existe encore** (seuls `utilisatrice` + `date_naissance`). Le `on delete cascade` nettoie `utilisatrice`/`consentement`. Justifier ce choix dans le Debug Log.

- [x] **Tâche 5 — Étendre l'onboarding + brancher** (AC : 1, 5)
  - [x] Étendre `app/(auth)/onboarding.ts` `etapeOnboarding` pour prendre en compte le consentement : signature `(ligne, aConsenti: boolean)` → `"mineur" | "naissance" | "consentement" | "suite"`. Règles : mineur → refus ; pas de date → `naissance` ; date mais pas de consentement → `consentement` ; consenti → `suite` (scène). Mettre à jour les **tests** existants de `etapeOnboarding`.
  - [x] Brancher : `app/auth/confirm/route.ts` et la garde de `app/(auth)/naissance/page.tsx` interrogent aussi l'existence d'un `consentement` (non révoqué) ; `app/(auth)/consentement/page.tsx` : si déjà consenti → rediriger vers la scène ; si pas de date → `/naissance` ; si mineur → refus.

- [x] **Tâche 6 — Preuve par test, bloquante en CI** (AC : 5, 6, 7)
  - [x] `tests/consentement.test.ts` (modèle : `tests/utilisatrice-rls.test.ts`, sessions scopées) :
    - **AC5** : « Je commence » (les 2 accords) écrit une ligne `consentement` horodatée sous l'identité, lisible par elle seule (RLS).
    - **AC7** : avant validation, aucune table art. 9 n'a d'écriture pour elle (structurellement : seules `utilisatrice`/`date_naissance` existent ; aucune table de contenu art. 9 n'existe encore — l'asserter et le documenter).
    - **AC6** : la suppression retire le compte (auth + `utilisatrice` par cascade) — tester la fonction système d'effacement (compte de test).
    - **etapeOnboarding** : les 4 cas (mineur / naissance / consentement / suite) — étendre le test existant.
  - [x] Vérifs finales : `npx vitest run` (tout : 1.1→1.5), `npm run lint`, `npx tsc --noEmit`, `next build`.

### Review Findings

_Revue de code adversariale (3 couches à l'aveugle, même capacité), 2026-07-23. Commit 394b268._

**Décisions (arbitrées 2026-07-23) :**

- [x] [Review][Defer] AC1 « sans défilement obligatoire » — à vérifier sur vrai iPhone (porte pré-lancement) avant tout ajustement ; contenu dense + centrage `justify-content:center` qui rogne le débordement. [app/(auth)/consentement/page.tsx, consentement.module.css] — deferred (décision : vérif iPhone d'abord)
- [x] [Review][Patch] Adoucir le registre du refus — retirer « exister avec toi » / atténuer « ne peut pas t'accompagner », garder le fait ; rester dans la voix mais sûr côté non culpabilisant (AC6). [app/(auth)/consentement/formulaire-consentement.tsx:24-31]

**À corriger (fix non ambigu) :**

- [x] [Review][Patch] La garde ne lit jamais `art9_accorde` : `aConsenti` = existence d'une ligne non révoquée seulement → une ligne `art9_accorde=false` (écrite en direct via l'API REST sous RLS) ouvrirait la scène. Sélectionner et exiger `art9_accorde === true` (+ `ia_reconnue`). [app/(auth)/etat-onboarding.ts:25-30]
- [x] [Review][Patch] `donnerConsentement` n'exige pas l'état d'onboarding avant d'écrire — un POST direct (date null / mineur) persiste une preuve de consentement + « 18 ans confirmé ». Appeler `etapeOnboardingPour` et exiger l'étape "consentement" avant l'upsert. [app/(auth)/consentement/actions.ts:14-45]
- [x] [Review][Patch] `refuser` : `signOut()` s'exécute AVANT le test de `error`, et `/entrer` ignore `erreur=suppression` → échec de suppression silencieux, session détruite, compte + données conservés (RGPD). Ne détruire la session que si succès, et afficher le message sur `/entrer`. [app/(auth)/consentement/actions.ts:61-66 ; app/(auth)/entrer/page.tsx:10-12]
- [x] [Review][Patch] Les tests n'exécutent jamais les Server Actions (`donnerConsentement`/`refuser`) — ils répliquent l'upsert et appellent `deleteUser` en direct → re-validation serveur, garde `getUser`, `signOut`, redirections NON couvertes (fausse assurance CI). Tester réellement les actions (ou leur logique extraite). [tests/consentement.test.ts]
- [x] [Review][Patch] L'upsert ne réinitialise pas `revoked_at` → piège latent : dès la Story 1.6, re-consentir laissera `revoked_at` non-null → `aConsenti=false` en boucle. Ajouter `revoked_at: null` à l'upsert. [app/(auth)/consentement/actions.ts:31-39]
- [x] [Review][Patch] `admin.ts` (clé `service_role`) sans barrière `server-only` — isolation par convention seulement ; un futur import client embarquerait le secret. Installer + `import "server-only"`. [lib/data/supabase/admin.ts] *(ajout de dépendance = ton feu vert)*
- [x] [Review][Patch] Bouton « Confirmer et supprimer » sans état pending/disabled → double-clic = 2e `refuser` sur compte déjà supprimé → une suppression réussie peut afficher une erreur. Désactiver pendant l'action. [app/(auth)/consentement/formulaire-consentement.tsx:33-37]
- [x] [Review][Patch] `etapeOnboardingPour` avale les erreurs de lecture (`error` ignoré) → sur erreur transitoire, une adulte consentante est renvoyée à `/naissance` puis bloquée par l'immutabilité de la date. Distinguer erreur de lecture d'absence de ligne. [app/(auth)/etat-onboarding.ts:17-30]

**Différé (pré-existant ou hors périmètre 1.5) :**

- [x] [Review][Defer] La scène `/` n'a aucune garde — l'ordre âge→consentement→séance n'est tenu que par des redirections douces ; `/` est atteignable en tapant l'URL. Latent (prototype WebGL, zéro art. 9). À poser avec le write-gate art. 9 en Story 1.6 (AD-13). [middleware.ts ; app/page.tsx] — deferred
- [x] [Review][Defer] Aucune mention IA persistante après consentement (AD-9/FR-013) — la déclaration n'existe que sur `/consentement`, inatteignable une fois consenti. Relève de l'écran de séance (epic ultérieur). [app/(auth)/consentement/page.tsx] — deferred
- [x] [Review][Defer] Open redirect pré-existant dans `/auth/confirm` via `next` (non introduit par 1.5) : `next=https://evil.com` redirige hors domaine après échange de code valide. Allow-list « chemin interne commençant par / ». [app/auth/confirm/route.ts:39] — deferred, pre-existing

## Dev Notes

### Périmètre STRICT

Halte de consentement + déclaration IA **uniquement**. **OUI** : table `consentement`, écran (2 cases distinctes, accordéon, refus honnête), écriture du consentement sous RLS, suppression immédiate au refus, branchement onboarding, preuve par test. **NON** : le **write-gate art. 9 au niveau base** (AD-13) et la **révocation** = **Story 1.6** (la colonne `revoked_at` est préparée mais pas exploitée) ; la **première séance / la scène réelle / tout contenu art. 9** (epics ultérieurs) ; le **moteur d'effacement** propagé aux sous-traitants (AD-14). NE PAS toucher `app/page.tsx` (prototype). Le contenu juridique exact (texte des CGU, formulation art. 9) sera **validé par un juriste avant lancement** — ici, un texte clair et honnête, marqué à valider.

### Continuité 1.4 (à réutiliser)

- `app/(auth)/onboarding.ts` `etapeOnboarding` — à **étendre** (ajouter l'étape `consentement`). Ses tests aussi.
- Placeholder `app/(auth)/consentement/page.tsx` — à **remplacer**.
- Pattern d'écran (client + Server Action, `useActionState`, module CSS champ/bouton), design-system, migrations forward-only (0003 → **0004**), preuve RLS par test, table `utilisatrice` (+ `date_naissance`). `lib/data/supabase/admin.ts` prévu en 1.1 pour les tâches système (suppression).

### Décision : suppression immédiate au refus (AC6) vs drapeau (1.4)

En 1.4, le mineur → drapeau + ordonnanceur (pas de `service_role` applicatif). **Ici l'AC6 exige la suppression IMMÉDIATE.** Donc : une **tâche système d'effacement de compte** (API admin `deleteUser`), isolée dans `lib/data/supabase/admin.ts`, déclenchée par une Server Action qui vérifie d'abord `getUser()` (l'utilisatrice ne supprime que **son** compte). Acceptable au regard d'AD-12 car (1) c'est une **suppression de compte** (tâche système), pas un accès `service_role` à du **contenu** en requête applicative, et (2) **aucun art. 9 n'existe encore** à ce stade. `on delete cascade` propage à `utilisatrice`/`consentement`. Bien commenter, bien isoler.

### Frontière art. 9 (AD-4) & write-gate (AD-13, hors périmètre)

Aucune donnée art. 9 avant ce consentement (FR-072). Le **write-gate technique** (base refuse toute écriture art. 9 sans consentement) est la **Story 1.6** — ici on écrit seulement la **preuve de consentement** et on garantit qu'aucune table de contenu art. 9 n'a été écrite (elle n'existe pas encore). La ré-écriture/révocation viendra avec 1.6.

### Anti-patterns à prévenir (ne PAS faire)

- ❌ Cases **pré-cochées** ou **groupées** (art. 9 doit être distinct des CGU — FR-012/NFR-006).
- ❌ « Je ne veux pas » **minoré** (gris, petit, caché) — dark pattern interdit ; lisibilité strictement égale.
- ❌ « Je commence » désactivée **sans motif écrit** (AC3 : le texte, pas seulement l'état).
- ❌ Défilement **obligatoire** pour atteindre l'action ; CGU qui **remplacent** la page (doit être nouvel onglet).
- ❌ Re-confirmations culpabilisantes au refus / offre de rétention.
- ❌ Validation des accords **côté client seulement** → re-valider serveur avant d'écrire.
- ❌ Écrire le consentement via `service_role` (→ sous session RLS). `service_role` **uniquement** pour la suppression de compte (tâche système isolée).
- ❌ Toute écriture art. 9 / calcul de socle ici. NE PAS toucher `app/page.tsx`.

### Project Structure Notes

- Nouveaux : `supabase/migrations/0004_consentement.sql` ; `app/(auth)/consentement/{page.tsx (remplacé), formulaire-consentement.tsx, actions.ts, consentement.module.css}` ; helper suppression dans `lib/data/supabase/admin.ts` ; `tests/consentement.test.ts` ; éventuel `app/cgu/page.tsx` (CGU minimales/placeholder).
- Modifiés : `app/(auth)/onboarding.ts` (+ étape consentement) + ses tests ; `app/auth/confirm/route.ts` et `app/(auth)/naissance/page.tsx` (tenir compte du consentement).
- Couches : UI + Server Action = `app/` ; données = session RLS via `lib/data/supabase/server.ts` ; suppression système = `lib/data/supabase/admin.ts`. Rien dans `lib/domain`.

### References

- [Source : epics.md#Epic 1 → Story 1.5] — 7 critères, FR-012/013/072, NFR-006, AD-9/AD-4.
- [Source : ARCHITECTURE-SPINE.md#AD-9] — consentement + déclaration IA accessibles, jamais de paywall sur la sécurité.
- [Source : ARCHITECTURE-SPINE.md#AD-4] — frontière art. 9, aucune écriture art. 9 avant consentement.
- [Source : ARCHITECTURE-SPINE.md#AD-13] — write-gate (Story 1.6, contexte).
- [Source : ARCHITECTURE-SPINE.md#AD-12] — écriture sous RLS ; `service_role` réservé aux tâches système.
- [Source : Story 1.4] — onboarding (`etapeOnboarding`), placeholder `/consentement`, pattern d'écran, migrations, preuve par test.
- [Source : DESIGN.md / EXPERIENCE.md — halte de consentement] — halte nette, cases distinctes, refus égal, accordéon, registre non culpabilisant.

## Dev Agent Record

### Implementation Plan

1. Migration 0004 `consentement` (1:1 utilisatrice, RLS `auth.uid()` activée + **forcée**, cascade), appliquée par `supabase db reset` puis vérifiée en base.
2. Backbone d'abord : `etapeOnboarding` étendu (pur) + `etat-onboarding.ts` (helper serveur, **source unique** partagée par les 3 gardes) + `admin.ts` (client système isolé).
3. Server Actions : `donnerConsentement` (re-validation serveur + upsert sous RLS → `/`), `refuser` (suppression admin + signOut + sortie).
4. Écran : `page.tsx` (garde + déclaration IA + sens conservation/effacement + accordéon en place) et `formulaire-consentement.tsx` (2 cases distinctes, « Je commence » désactivée + motif écrit, « Je ne veux pas » lisibilité égale + une confirmation).
5. Branchement des gardes `/auth/confirm` et `/naissance` sur le helper partagé + `/cgu` minimale.
6. Preuves par test (RLS, cascade, absence art. 9) + mise à jour des tests `etapeOnboarding`. Vérifs vertes.

### Agent Model Used

Opus 4.8 (`claude-opus-4-8`, 1M context) — via `bmad-dev-story`.

### Debug Log References

- **Env des tests d'intégration** : Vitest ne charge PAS `.env.local` dans `process.env`. Les tests DB attendent les clés **exportées dans le shell** (déjà le cas en 1.4, explicite dans `rls.test.ts`). Lancement : `set -a && . ./.env.local && set +a && npx vitest run`. Aucun code applicatif touché (Next charge `.env.local` seul).
- **Helper `etat-onboarding.ts` (ajout non listé mais dans le périmètre de la Tâche 5 « brancher »)** : décision d'ISOLER la lecture d'état en un seul endroit pour que `/auth/confirm`, `/naissance` et `/consentement` ne divergent jamais — réponse directe à la faille de la revue 1.4 (barrière oubliée dans un seul chemin).
- **`etapeOnboarding(null)` : "suite" → "naissance"** (durcissement délibéré). Avec le consentement comme barrière dure, un cas défensif « ligne illisible » ne doit jamais ouvrir la scène. Le trigger `handle_new_user` garantit la ligne, donc pas de boucle en pratique. Test mis à jour en conséquence.
- **`server-only` non installé** → volontairement PAS importé dans `admin.ts` (ajouter une dépendance = HALT). Isolation assurée par convention + commentaire fort ; le module n'est importé que par la Server Action de refus.
- **Suppression au refus** : `auth.admin.deleteUser` (tâche système isolée), jamais `service_role` sur du contenu (AD-12) ; le `on delete cascade` (auth.users → utilisatrice → consentement) nettoie tout ; `signOut` efface les cookies avant `redirect`.

### Completion Notes List

- **AC1** : une page, déclaration « Tu vas parler à une intelligence artificielle » (FR-013/AI Act art. 50) + sens conservation puis effacement, français courant. ✅
- **AC2** : 2 cases DISTINCTES, non pré-cochées, jamais groupées ; art. 9 séparé des CGU (FR-012/NFR-006). ✅
- **AC3** : « Je commence » désactivée **avec motif écrit** (`#motif-blocage`, `aria-describedby`) ; « Je ne veux pas » de lisibilité strictement égale (même rôle `t-bouton`, texte pleine intensité, bordure — jamais minoré). ✅
- **AC4** : CGU en nouvel onglet (`target="_blank" rel="noopener noreferrer"`, état préservé) ; « Lire le détail » = `<details>` déplié en place. ✅
- **AC5** : `donnerConsentement` re-valide côté serveur puis **upsert sous RLS** (art9 + IA reconnue, horodaté) → débloque la scène. Prouvé : écriture/lecture sous identité, idempotence, refus d'usurpation (with check), isolement (RLS). ✅
- **AC6** : refus honnête + **une** confirmation + **suppression immédiate** (admin isolé, cascade). Prouvé : la suppression retire utilisatrice + consentement. ✅
- **AC7** : aucune table de contenu art. 9 n'existe encore — tripwire testé (le write-gate est la Story 1.6). ✅
- **Hors périmètre (respecté)** : write-gate base (AD-13) + révocation = Story 1.6 (colonne `revoked_at` préparée, non exploitée) ; scène/première séance/contenu art. 9 = epics ultérieurs ; `app/page.tsx` non touché.
- **À valider avant lancement** : texte juridique exact (CGU, formulation art. 9, durées) par un juriste — ici clair et honnête mais non définitif.
- **Vérifs** : `vitest` **108/108** (+6), `eslint` propre, `tsc --noEmit` propre, `next build` OK (`/consentement` dynamique, `/cgu` statique).

### File List

**Nouveaux**
- `supabase/migrations/0004_consentement.sql`
- `app/(auth)/etat-onboarding.ts`
- `app/(auth)/consentement/actions.ts`
- `app/(auth)/consentement/accords.ts` (revue de code : validation pure testable)
- `app/(auth)/consentement/formulaire-consentement.tsx`
- `app/(auth)/consentement/consentement.module.css`
- `lib/data/supabase/admin.ts`
- `app/cgu/page.tsx`
- `app/cgu/cgu.module.css`
- `tests/consentement.test.ts`

**Modifiés**
- `app/(auth)/onboarding.ts` (signature `etapeOnboarding(ligne, aConsenti)` + étape `consentement`)
- `app/(auth)/consentement/page.tsx` (placeholder → écran réel + garde)
- `app/(auth)/naissance/page.tsx` (garde sur le helper partagé)
- `app/auth/confirm/route.ts` (garde sur le helper partagé)
- `tests/date-naissance.test.ts` (tests `etapeOnboarding` mis à jour, +1 cas)

## Change Log

| Date | Version | Description | Auteur |
|---|---|---|---|
| 2026-07-23 | 0.1 | Création de la story (halte de consentement art.9 + déclaration IA : cases distinctes, refus honnête + suppression, table consentement, onboarding étendu) | create-story |
| 2026-07-23 | 0.2 | Implémentation : migration 0004 (consentement RLS+forcée), écran (2 cases distinctes + accordéon + refus égal), Server Actions (upsert consentement / suppression immédiate isolée), helper `etat-onboarding` partagé, gardes branchées, `/cgu`, 6 preuves par test. 108 tests / lint / tsc / build verts. | dev-story (Opus 4.8) |
| 2026-07-23 | 0.3 | Revue de code (3 couches adversariales à l'aveugle) : garde qui lit `art9_accorde`+`ia_reconnue` (plus la seule existence), garde d'état sur `donnerConsentement`, suppression RGPD non silencieuse (session conservée si échec + bannière), `revoked_at:null` à l'upsert, `server-only` sur `admin.ts`, bouton suppression anti-double-clic, validation extraite/testée, refus adouci. 113 tests / lint / tsc / build verts. Différés : garde de `/` → 1.6, mention IA persistante → séance, open redirect pré-existant, vérif défilement iPhone. | code-review (Opus 4.8) |

## Status

done
