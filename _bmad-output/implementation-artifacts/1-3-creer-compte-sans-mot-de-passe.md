---
baseline_commit: 6637ac29d07653d69bb64aef83a9f522ca575bb4
story_key: "1-3-creer-compte-sans-mot-de-passe"
epic: 1
story: 3
title: "Créer un compte sans mot de passe"
epic_name: "Franchir le seuil"
covers: [FR-073, AD-2, AD-12, NFR-015]
depends_on: ["1-1-echafaudage-couches-rls", "1-2-fondation-design-system"]
status: done # livrée (871db4d) et en prod ; corrigé le 2026-08-07 (disait `ready-for-dev`). Revue de code DUE.
created: "2026-07-23"
sources:
  - _bmad-output/planning-artifacts/epics.md#epic-1--story-1-3
  - _bmad-output/planning-artifacts/architecture/architecture-Anima-2026-07-22/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-Anima-2026-07-21/DESIGN.md
---

# Story 1.3 : Créer un compte sans mot de passe

Status: done

<!-- Note : validation optionnelle. Lancer validate-create-story avant dev-story pour un contrôle qualité. -->

## Story

En tant qu'**utilisatrice**,
je veux **créer mon compte par lien e-mail (magic link), sans jamais choisir de mot de passe**,
afin d'**entrer dans un espace de confidences sans la faille d'un mot de passe faible**.

## Acceptance Criteria

1. **Étant donné** l'écran d'entrée **Quand** l'utilisatrice saisit son e-mail **Alors** un lien de connexion magique lui est envoyé **Et** aucun champ de mot de passe n'est jamais présenté (FR-073).

2. **Étant donné** un lien de connexion valide **Quand** l'utilisatrice l'ouvre **Alors** une ligne `utilisatrice` (1:1 avec le compte d'auth) est créée sous son identité **Et** l'accès à cette ligne est régi par la RLS `auth.uid()`, jamais via `service_role` depuis un route handler (AD-12).

3. **Étant donné** deux utilisatrices distinctes **Quand** l'une interroge la table `utilisatrice` **Alors** elle ne voit que sa propre ligne (isolation RLS vérifiée par test, bloquant en CI).

4. **Étant donné** une session établie **Quand** le temps passe pendant un usage normal **Alors** la session est de longue durée et aucune ré-authentification n'interrompt le parcours (Foundation UX, WCAG 2.2.1).

## Tasks / Subtasks

- [x] **Tâche 1 — Migration `utilisatrice` : table 1:1 auth.users, RLS `auth.uid()`, trigger de création** (AC : 2, 3)
  - [x] Migration forward-only `supabase/migrations/0002_utilisatrice.sql`. Créer :
    ```sql
    create table public.utilisatrice (
      id uuid primary key references auth.users(id) on delete cascade,
      cree_le timestamptz not null default now()
    );
    alter table public.utilisatrice enable row level security;
    alter table public.utilisatrice force  row level security;
    create policy utilisatrice_proprietaire on public.utilisatrice
      for all using (auth.uid() = id) with check (auth.uid() = id);
    ```
  - [x] **Trigger de création atomique** (pattern Supabase `handle_new_user`) — c'est le mécanisme retenu (voir Dev Notes → *Décision : trigger vs écriture applicative*) :
    ```sql
    create function public.handle_new_user() returns trigger
      language plpgsql security definer set search_path = '' as $$
    begin
      insert into public.utilisatrice (id) values (new.id);
      return new;
    end; $$;
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
    ```
  - [x] `security definer set search_path = ''` est obligatoire (sécurité ; sinon `get_advisors` le signale). La fonction s'exécute au niveau DB (tâche système), **pas** dans un route handler applicatif → AD-12 respecté (aucun `service_role` côté app).
  - [x] Appliquer en local (`supabase db reset`) et confirmer : table + policy + trigger présents.

- [x] **Tâche 2 — Middleware de refresh de session (sessions longues, AC4)** (AC : 4)
  - [x] Créer `lib/data/supabase/middleware.ts` : `updateSession(request)` qui crée un `createServerClient` lié aux cookies **de la requête ET de la réponse** (pattern @supabase/ssr) et appelle **`await supabase.auth.getUser()`** (rafraîchit le token si expiré). Retourner la réponse avec les cookies mis à jour.
  - [x] Créer `middleware.ts` (racine) qui appelle `updateSession`, avec un `matcher` excluant les assets statiques (`_next/static`, `_next/image`, favicon, images).
  - [x] **`getUser()` jamais `getSession()`** en code serveur (getUser revalide le token auprès du serveur Auth ; getSession ne garantit rien — NFR sécurité). Le mettre en Dev Notes comme règle dure.
  - [x] Vérifier : après connexion, naviguer/attendre ne déconnecte pas (session longue, WCAG 2.2.1).

- [x] **Tâche 3 — Écran d'entrée mobile-first, sur le design-system (AC1)** (AC : 1)
  - [x] Nouvelle route `app/(auth)/entrer/page.tsx` (groupe `(auth)` sans segment d'URL → chemin `/entrer`). **NE PAS** toucher `app/page.tsx` (prototype immersif).
  - [x] Formulaire : **un seul champ e-mail**, avec **étiquette visible** (`<label>` lié, jamais un placeholder en guise d'étiquette — DESIGN.md, WCAG). **AUCUN champ mot de passe, jamais** (FR-073). Bouton primaire « recevoir mon lien ».
  - [x] Soumission via **Server Action** : `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: <origin>/auth/confirm } })` (client serveur de `lib/data/supabase/server.ts`). `shouldCreateUser` par défaut `true` (crée le compte). Gérer l'erreur en enveloppe `{ code, message }` neutre (jamais signée Anam — Conventions).
  - [x] **État de confirmation** : après envoi, afficher « regarde ta boîte mail » (voix d'Anam, `t-anam`) — pas de fuite d'info sur l'existence du compte (message identique que l'e-mail existe ou non).
  - [x] **Habillage design-system (1.2)** : composer avec les rôles `.t-display/.t-anam/.t-corps/.t-bouton`, les tokens `champ-saisie` (fond `surface-elevee`, bordure `bordure-forte`, `cible-tactile` 44px) et `bouton-primaire` (fond `accent`, texte `sur-accent`). Créer des composants minimaux `app/(auth)/_composants/ChampTexte.tsx` + `Bouton.tsx` (premiers vrais composants UI) ou un CSS module — réutilisables. Mobile-first (marge-mobile, colonne unique).
  - [x] **Discrétion (NFR-015)** : le titre d'onglet/route ne trahit ni spiritualité ni intimité.

- [x] **Tâche 4 — Route de confirmation `/auth/confirm` (échange du lien → session)** (AC : 2)
  - [x] `app/auth/confirm/route.ts` (route handler GET) : lire `token_hash` et `type` des search params ; `supabase.auth.verifyOtp({ type, token_hash })` (client serveur) → établit la session (cookies) ; rediriger vers `next` (défaut `/`) en cas de succès, vers `/entrer?erreur=lien` sinon.
  - [x] **Template d'e-mail magic link** : le lien doit pointer vers `/auth/confirm?token_hash={{ .TokenHash }}&type=email` (pattern PKCE token_hash). Le configurer dans `supabase/config.toml` (section auth email templates) ou `supabase/templates/`. **Vérifier la doc Supabase actuelle** pour le template exact + le flux (token_hash/`verifyOtp` **ou** `?code=`/`exchangeCodeForSession` — les deux existent ; retenir celui de la doc courante, ne rien inventer).
  - [x] Vérifier en local via **Inbucket** (http://127.0.0.1:54324) : saisir un e-mail sur `/entrer` → récupérer le lien dans Inbucket → l'ouvrir → session établie, ligne `utilisatrice` présente.

- [x] **Tâche 5 — Config Supabase local (auth e-mail, session longue)** (AC : 1, 4)
  - [x] `supabase/config.toml` : activer l'auth e-mail, `enable_confirmations`/OTP selon le pattern retenu, `site_url` + `additional_redirect_urls` incluant `/auth/confirm`. Durée de session longue (JWT expiry raisonnable + refresh par le middleware). **Vérifier les clés config actuelles** (le CLI évolue).
  - [x] `.env.example` : aucune nouvelle variable secrète attendue (l'auth passe par la clé publishable + cookies). Confirmer.

- [x] **Tâche 6 — Preuve d'isolation RLS par test (AC3), bloquante en CI** (AC : 3)
  - [x] `tests/utilisatrice-rls.test.ts` : créer **deux** utilisatrices via l'API admin (clé **secret**, setup de test uniquement) → le trigger crée leurs deux lignes `utilisatrice`. Obtenir une **session scopée** pour chacune (voir Dev Notes → *Obtenir 2 sessions en test*), puis avec un client porteur du JWT de chaque utilisatrice : `select * from utilisatrice` → asserter **exactement 1 ligne, la sienne** (jamais celle de l'autre). C'est la preuve d'isolation (comme la preuve RLS de 1.1).
  - [x] Assertion négative (red-green) : vérifier que retirer la policy `utilisatrice_proprietaire` fait **échouer** le test (fuite inter-locataires), puis restaurer. Documenter au Debug Log.
  - [x] La CI de 1.1 lance déjà `npm test` sur Supabase local → ce test est **automatiquement bloquant**. Ne pas modifier la CI (sauf si le flux magic-link exige une étape ; alors l'ajouter en la faisant échouer le job).
  - [x] Vérif finale : `npx vitest run` tout vert, `npm run lint`, `npx tsc --noEmit`, `next build` OK.

## Dev Notes

### Périmètre STRICT de cette story

Auth **sans mot de passe uniquement**. **OUI** : écran d'entrée (e-mail), magic link, route de confirmation, table `utilisatrice` 1:1 + RLS + trigger, middleware de session, preuve d'isolation. **NON** : **déclaration d'âge / blocage 18 ans** (Story 1.4), **consentement art.9 + déclaration IA** (Story 1.5), thème natal/socle (epic ultérieur), déconnexion/gestion de compte, tout écran produit. **NE PAS** toucher `app/page.tsx` (le prototype immersif reste la home ; l'auth vit sur `/entrer`). `utilisatrice` ne porte **aucune** donnée art.9 (juste l'ancrage du compte).

### Continuité 1.1 & 1.2 (à réutiliser, ne pas réinventer)

- **Clients Supabase déjà là** (`lib/data/supabase/server.ts` = `createServerClient` cookies scopés ; `client.ts` = `createBrowserClient` clé publishable). Le Server Action `signInWithOtp` et `/auth/confirm` `verifyOtp` utilisent le **client serveur**. `server.ts` note déjà « middleware à venir » → c'est la Tâche 2.
- **Pattern RLS de 1.1** (`0001_rls_deny_by_default.sql` : `enable` + `force row level security`) à répliquer sur `utilisatrice`, **mais avec** une policy propriétaire (probe n'en avait aucune ; utilisatrice a besoin de l'accès owner).
- **Env** (`.env.example`) : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (client + serveur cookies), `SUPABASE_SECRET_KEY` (**tests/tâches système uniquement**, jamais en route handler). Clés locales nouveau format `sb_publishable_`/`sb_secret_`.
- **Design-system 1.2** : `app/styles/globals.css` (rôles `t-*`, tokens couleur, `champ-saisie`, `bouton-primaire`, `cible-tactile`, mode accessibilité, reduced-motion). L'écran d'entrée s'y compose entièrement.
- **Garde ESLint de couches** : l'UI (`app/`) peut importer `lib/data` ; `lib/domain` reste pur. `signInWithOtp` vit dans un Server Action (`app/`), pas dans `lib/domain`.

### Décision : trigger DB vs écriture applicative (AC2 / AD-12)

Deux façons de créer la ligne `utilisatrice` au premier login :
- **(A) Trigger `handle_new_user` sur `auth.users`** — RETENU. Atomique au signup, s'exécute au niveau DB (`security definer`), **aucun `service_role` dans un route handler**, aucune course, la ligne existe toujours. C'est le pattern Supabase standard.
- (B) Insert applicatif au premier login sous RLS (`auth.uid()`) — possible mais ajoute une étape post-login, une gestion d'idempotence/course, et un point d'échec. Écarté.

Le trigger respecte AD-12 : « `service_role` réservé aux migrations et **tâches système**, jamais au contenu art.9 en **requête applicative** » — un trigger DB est une tâche système, `utilisatrice` n'est pas art.9.

### Le flux magic link (vérifié web 2026-07-23 — re-vérifier la doc au moment de coder)

1. `/entrer` (Server Action) → `signInWithOtp({ email, options: { emailRedirectTo: <origin>/auth/confirm } })`. `shouldCreateUser` défaut `true`.
2. Supabase envoie l'e-mail. En local, il atterrit dans **Inbucket** (`:54324`).
3. Le lien → `/auth/confirm?token_hash=…&type=email` → route handler `verifyOtp({ type, token_hash })` → session (cookies) → redirect.
4. **Middleware** `getUser()` rafraîchit la session à chaque requête → session longue (AC4).

> Deux patterns Supabase coexistent : **token_hash + `verifyOtp`** (nécessite de personnaliser le template d'e-mail) OU **`?code=` + `exchangeCodeForSession`** (marche avec `{{ .ConfirmationURL }}` par défaut). Retenir **celui de la doc Supabase courante** pour App Router ; ne pas mélanger. Sources : [Supabase Server-Side Auth Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs), [Passwordless](https://supabase.com/docs/guides/auth/auth-email-passwordless).

### Obtenir 2 sessions scopées en test (Tâche 6)

Le test a besoin de 2 clients porteurs chacun du JWT d'une utilisatrice distincte. Approche pragmatique et fiable :
1. Client admin (clé **secret**) : `auth.admin.createUser({ email, password, email_confirm: true })` pour 2 e-mails (mot de passe **de test uniquement** — l'app, elle, reste passwordless). Le trigger crée les 2 lignes `utilisatrice`.
2. Pour chaque : un client `@supabase/supabase-js` clé **publishable** → `signInWithPassword({ email, password })` → récupère la session (JWT) → requêtes scopées.
3. Asserter : chaque client ne voit que **sa** ligne dans `utilisatrice`.

*(Alternative « fidèle » sans mot de passe : `auth.admin.generateLink({ type:'magiclink', email })` → `hashed_token` → `verifyOtp` → session. Plus proche du vrai flux, plus verbeux. Au choix du dev.)*

### Anti-patterns à prévenir (ne PAS faire)

- ❌ **Un champ mot de passe**, où que ce soit (FR-073). Pas de `signInWithPassword` dans l'app (uniquement toléré en test pour minter une session).
- ❌ `service_role`/clé secret dans un **route handler** ou Server Action applicatif (AD-12). La création de ligne passe par le **trigger**.
- ❌ `getSession()` en code serveur/middleware pour une décision d'auth → utiliser **`getUser()`**.
- ❌ **Placeholder en guise d'étiquette** sur le champ e-mail → `<label>` visible.
- ❌ Fuite d'existence de compte : message de confirmation **identique** que l'e-mail existe ou non.
- ❌ Toucher `app/page.tsx` / le prototype immersif. L'auth vit sur `/entrer`.
- ❌ Message d'erreur signé « Anam » : les erreurs système sont en registre neutre `{ code, message }` (Conventions).

### Project Structure Notes

- Nouveaux : `app/(auth)/entrer/page.tsx` (+ Server Action), `app/(auth)/_composants/` (champ + bouton), `app/auth/confirm/route.ts`, `middleware.ts`, `lib/data/supabase/middleware.ts`, `supabase/migrations/0002_utilisatrice.sql`, `tests/utilisatrice-rls.test.ts`.
- Modifiés : `supabase/config.toml` (auth e-mail + redirect + template), éventuellement `.env.example` (confirmer : rien de neuf).
- Couches (AD-1/AD-10) : UI + Server Action + route handler = `app/` ; accès données = `lib/data/`. Rien ne remonte dans `lib/domain`.

### References

- [Source : epics.md#Epic 1 → Story 1.3] — story, 4 critères d'acceptation, FR-073/AD-2/AD-12.
- [Source : ARCHITECTURE-SPINE.md#AD-2] — IA médiée serveur, une clé serveur, jamais côté client.
- [Source : ARCHITECTURE-SPINE.md#AD-12] — RLS non contournable, `service_role` jamais sur contenu en requête applicative, table art.9 deny-by-default.
- [Source : ARCHITECTURE-SPINE.md#Consistency Conventions] — auth Supabase passwordless (FR-073), enveloppe d'erreur `{code,message}` non signée Anam, secrets serveur uniquement, session/mutations via route handlers.
- [Source : Story 1.1] — pattern RLS deny-by-default + preuve par test ; clients Supabase ; CI bloquante ; env.
- [Source : Story 1.2] — design-system (rôles `t-*`, `champ-saisie`, `bouton-primaire`, cible-tactile, accessibilité) pour l'écran d'entrée.
- [Source : DESIGN.md#Typography / Components] — étiquette visible, champ, bouton, discrétion.
- [Web 2026-07-23 : Supabase Server-Side Auth (Next.js), Passwordless email logins] — `signInWithOtp`, `/auth/confirm` `verifyOtp` token_hash, middleware `updateSession`+`getUser`.

## Dev Agent Record

### Implementation Plan

Ordre des tâches respecté. **Trigger DB** retenu pour créer la ligne `utilisatrice` (AC2/AD-12 — aucun `service_role` applicatif). Flux magic link : le template custom `token_hash` ne s'appliquant pas via le CLI local, **bascule sur `code`/`exchangeCodeForSession`** (template Supabase par défaut, sanctionné par la story) ; route rendue **robuste aux deux flux**. Isolation RLS prouvée red-green. **Aucune dépendance ajoutée.**

### Agent Model Used

Claude Opus 4.8 (1M) — bmad-dev-story.

### Debug Log References

- **Trigger `handle_new_user` vérifié** : créer un compte auth (admin) crée automatiquement la ligne `utilisatrice` (1:1, id correspond).
- **Template e-mail custom non appliqué** même après `supabase stop/start` (résolution `content_path` avec CLI 2.67) → basculé sur le flux `code`/`exchangeCodeForSession` (défaut). Route `/auth/confirm` gère désormais **code ET token_hash**.
- **Capteur d'e-mails local = Mailpit** (pas Inbucket), API sur `:54324`.
- **Preuve red-green isolation** : policy `utilisatrice_proprietaire` retirée à chaud (docker exec psql) → « chaque utilisatrice ne voit que sa ligne » **échoue** (0 ligne, RLS forcée = deny-all) → policy restaurée.
- **AC2 prouvé sans navigateur** : `generateLink` + `verifyOtp` → session établie → sous cette session, elle voit exactement **sa** ligne.
- **Next 16** déprécie `middleware.ts` → `proxy.ts` (avertissement au build ; fonctionne, enregistré « Proxy (Middleware) »).

### Completion Notes List

- ✅ **Table `utilisatrice`** 1:1 `auth.users`, RLS deny-by-default + policy `auth.uid() = id`, **trigger** `handle_new_user` (`security definer`, `search_path=''`) — AD-12 tenu.
- ✅ **Écran `/entrer`** mobile-first sur le **design-system 1.2** (champ e-mail à **étiquette visible**, bouton primaire, voix d'Anam). **AUCUN champ mot de passe** (FR-073). Server Action `signInWithOtp` ; message de confirmation **identique** que le compte existe ou non (pas de fuite).
- ✅ **Route `/auth/confirm`** robuste (`code`→`exchangeCodeForSession` **et** `token_hash`→`verifyOtp`).
- ✅ **Middleware** de refresh (`getUser`, jamais `getSession`) + rotation des refresh tokens → **session longue** (AC4).
- ✅ **Preuve d'ISOLATION RLS (AC3)** : 2 utilisatrices, chacune ne voit que sa ligne, une ne peut pas lire l'autre — **verte + prouvée red**. Bloquante en CI.
- ✅ **AC1** : magic link envoyé **sans mot de passe** (vérifié via Mailpit). **AC2** : lien valide → session → sa ligne, prouvé end-to-end.
- ✅ Régression : **91/91 tests**, `lint`, `tsc`, `next build` prod — tous verts.
- ⚠️ Le **clic e-mail→session complet en navigateur** reste à vérifier manuellement (Mailpit `:54324` → ouvrir le lien) ; le cœur (`verifyOtp`→session→ligne) est prouvé par script.
- ⚠️ `middleware.ts` déprécié en Next 16 (→ `proxy.ts`) : fonctionne, **à renommer en suivi**.
- ℹ️ Supabase redémarré pendant le dev (config `site_url`/redirects). Les données locales persistent (volume Docker).

### File List

- **Nouveaux** :
  - `supabase/migrations/0002_utilisatrice.sql`
  - `lib/data/supabase/middleware.ts`, `middleware.ts` (racine)
  - `app/(auth)/entrer/page.tsx`, `formulaire-entree.tsx`, `actions.ts`, `entrer.module.css`
  - `app/auth/confirm/route.ts`
  - `tests/utilisatrice-rls.test.ts`
- **Modifiés** :
  - `supabase/config.toml` (`site_url` → localhost:3000 ; `additional_redirect_urls` → localhost/127 wildcards)

## Change Log

| Date | Version | Description | Auteur |
|---|---|---|---|
| 2026-07-23 | 0.1 | Création de la story (compte sans mot de passe) | create-story |
| 2026-07-23 | 0.2 | Implémentation : magic link + `utilisatrice` RLS + trigger + middleware + preuve d'isolation (red-green) ; 91 tests, build prod OK | dev-story |

## Status

done

> **Revue de code : 2026-08-13.** Quatre défauts : la majorité contournable par PATCH direct (exploitée, fermée par 0048), une fixation de session par le flux token_hash (rejouée de bout en bout), une redirection ouverte sur ?next=, et des cookies de session lisibles et transmissibles en clair.
> Dossier complet : [`revue-dette-2026-08.md`](revue-dette-2026-08.md).
