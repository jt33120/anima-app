---
baseline_commit: c61558e
---

# Story 2.1 : La frontière serveur, le port IA unique et l'egress gardé

Status: done

<!-- Note: Validation optionnelle. Lance validate-create-story pour un contrôle qualité avant dev-story. -->

## Story

En tant que **développeuse**,
je veux que **tout appel au modèle passe par une frontière serveur unique derrière le port `AiPort`, avec une seule clé serveur et un point d'egress qui revérifie consentement et ZDR**,
afin que **les données art. 9 ne quittent jamais le système sans garantie et que le fournisseur reste remplaçable**.

> **Nature de la story.** C'est de la **plomberie gardée, sans écran** (« en tant que développeuse »). Voulu par l'ordre de l'Epic 2 : d'abord le **socle du pipeline** (frontière serveur + port IA + egress), la conversation en streaming c'est la **Story 2.2**, le pipeline sécurité-d'abord la **Story 2.3**. La 2.1 se construit et se **teste entièrement sans vraie clé Mistral** : le gate ZDR/DPA bloque les vraies données art. 9, le dev/test se fait sur **données non sensibles / synthétiques** via un **adaptateur factice**.

## Acceptance Criteria

1. **(AC1 — aucun chemin client→fournisseur, usage métré)** Étant donné le navigateur, quand du code tente d'atteindre un fournisseur IA, alors **aucun chemin ne le permet** (aucune clé côté client, jamais une clé par utilisatrice) **et** tout appel transite par `app/api/**`, l'usage étant **métré par utilisatrice dans `usage_ia`** (base propre, **sans art. 9**).

2. **(AC2 — port unique, adaptateur Mistral stateless)** Étant donné l'applicatif, quand il a besoin du modèle, alors il **n'appelle que le port `AiPort`** (aucun SDK fournisseur hors `lib/ai/adapters/`) **et** l'adaptateur par défaut est **Mistral**, sur **endpoints stateless uniquement**.

3. **(AC3 — refus de démarrer sans ZDR/DPA)** Étant donné un adaptateur sur le **chemin art. 9**, quand il démarre **sans ZDR/DPA prouvés**, alors il **refuse de démarrer** (échec dur) **et** jamais aucune dégradation silencieuse ni bascule direct-US.

4. **(AC4 — egress-gate atomique au consentement + ZDR)** Étant donné un envoi de données art. 9 vers le fournisseur, quand l'`egress-guard` s'exécute, alors il **revérifie, au plus près de l'envoi**, que le **consentement est valide et non révoqué** **ET** que le **ZDR est actif**, **et** une **révocation en vol bloque l'envoi et ne poste rien**.

5. **(AC5 — routes art. 9 no-store + CSP stricte, zéro tiers)** Étant donné les routes art. 9, quand elles répondent, alors elles sont **`no-store`/`dynamic` sous CSP stricte** (`connect-src` limité au backend Anam) **et** aucun moniteur/APM tiers ni contenu art. 9 en clair n'apparaît dans les logs.

**Couvre :** AD-2, AD-3, AD-4, AD-13 · NFR-019, NFR-020 · (conventions Routes art.9, Métrage & paywall du SPINE).

**⚠️ Porte pré-lancement (ne bloque PAS le build, bloque les vraies données art. 9) :** **DPA art. 28 + ZDR Mistral (plan Scale)** requis avant tout traitement art. 9 réel. Les clés Mistral gratuites (« Experiment ») **s'entraînent sur les données** et **n'ont pas de ZDR** → en dev/test, **données non sensibles uniquement**. Le boot-guard (AC3) rend ce gate techniquement exécutoire.

## Tasks / Subtasks

- [x] **Task 1 — Dépendance Mistral épinglée + sûre (AC2 ; supply-chain)**
  - [x] Ajouter `@mistralai/mistralai` **épinglé exact** `2.5.0` dans `dependencies` (pas de `^`), installer avec lockfile committé (`npm ci`).
  - [x] **NE JAMAIS** installer `2.4.6` (paquet **malveillant** Shai-Hulud, `MAL-2026-3432` — n'existe plus au registre ; toute résolution vers lui = alerte). Vérifier l'intégrité du lockfile après install.
  - [x] Confirmer que `npm audit` ne régresse pas de façon bloquante (les 5 vulns connues sont une porte pré-lancement, cf. deferred-work) ; noter tout nouveau high introduit.

- [x] **Task 2 — Le contrat `AiPort` + la politique de tier minimale (AC2)**
  - [x] `lib/ai/port.ts` : interface `AiPort` (méthode `completer(req)` pour la 2.1 ; `diffuser()`/streaming **ajouté en 2.2**), types `RequeteIa` / `ReponseIa` / `CapaciteIa` / `TierIa` / `MessageIa`. `import "server-only"` en tête. **Zéro** import de SDK ici (le port ne connaît aucun fournisseur).
  - [x] `lib/ai/politique-tier.ts` : résolveur **minimal** `capacite → tier → modeleId` (léger `mistral-small-2603` / fort `mistral-large-2512`). **NE PAS** implémenter la politique complète `(capacite, niveau_securite) → tier` (AD-5) — elle relève des Stories 2.2/2.3 ; laisser un commentaire explicite le signalant.
  - [x] `lib/ai/index.ts` : barrel `export * from` (port, politique, egress-guard, fabrique).
  - [x] Rédiger un vrai `lib/ai/README.md` (remplace le stub d'une ligne) : rôle de la couche, la règle AD-3 (aucun SDK hors `adapters/`), le boot-guard, le pointeur vers l'egress-guard.

- [x] **Task 3 — L'adaptateur Mistral, stateless-only, boot-guard art. 9 (AC2, AC3)**
  - [x] `lib/ai/adapters/mistral.ts` : `import "server-only"` ; **seul** module autorisé à `import { Mistral } from "@mistralai/mistralai"`.
  - [x] Lier **stateless uniquement** : n'utiliser que `client.chat.complete(...)` (2.1) / `client.chat.stream(...)` (préparé pour 2.2) ; **jamais** `agents`, `conversations`, `batch`, `fineTuning`, `libraries`, `beta.*`. Modèles par **id daté** (`-2512`/`-2603`), **jamais `-latest`** sur le chemin art. 9 (un repoint amont silencieux changerait le comportement).
  - [x] **Boot-guard art. 9** `assertConformiteArt9()` : lève une erreur dure si `MISTRAL_ZDR_CONFIRMED !== "true"` **ou** `MISTRAL_DPA_SIGNED !== "true"` **ou** `MISTRAL_PLAN !== "scale"`. Appelé **à la construction de l'adaptateur Mistral sur le chemin art. 9**. Aucune dégradation, aucune bascule direct-US en repli.
  - [x] L'adaptateur expose **`estZdrProuve(): boolean`** — Mistral : `true` uniquement si les 3 flags sont posés ; c'est **cette propriété** (pas une lecture d'env globale) que l'egress-guard interroge (AD-3 : l'egress reste agnostique au fournisseur).
  - [x] `lib/ai/adapters/factice.ts` : `AdaptateurFactice` (réponse déterministe synthétique + comptage de tokens simulé) — **le** chemin exercé en dev/CI, jamais de réseau, jamais de clé. `estZdrProuve()` renvoie **`true` par construction** (in-process, rien ne sort du système) → la route fonctionne en dev **sans** flags Mistral ni impasse.
  - [x] `lib/ai/fabrique.ts` : `creerAiPort()` choisit l'adaptateur selon l'environnement (`AI_ADAPTER=mistral|factice`, défaut `factice` hors prod) et applique le boot-guard art. 9 pour l'adaptateur Mistral.

- [x] **Task 4 — L'egress-guard, point d'egress art. 9 unique (AC4)**
  - [x] `lib/ai/egress-guard.ts` : `import "server-only"`. Fonction `envoyerSousEgressArt9({ supabase, adaptateur, contientArt9, appelAdaptateur })` — **le seul** endroit d'où du contenu art. 9 sort. Ordre : (1) si `contientArt9`, revérifier **au plus près de l'envoi** le consentement **en direct** via `supabase.rpc("a_consenti_art9")` (prédicat existant, keyé sur `auth.uid()`, sous session RLS) **ET** `adaptateur.estZdrProuve() === true` (propriété de l'adaptateur, pas de lecture d'env ici) ; (2) si l'un échoue → **bloquer, ne rien poster**, lever/retourner un refus typé ; (3) sinon appeler l'adaptateur.
  - [x] Documenter en tête l'interprétation d'AD-13 « même transaction que l'envoi » : l'envoi étant un POST HTTP (pas une transaction SQL), la garantie est que la **vérification lit l'état vivant du consentement immédiatement avant l'appel**, sans `await` intercalé qui rouvrirait une fenêtre de péremption ; une révocation qui atterrit **avant** ce contrôle **bloque**. Résiduel borné par le ZDR (rien retenu côté fournisseur) + le write-gate (rien persisté).
  - [x] Branche non-art. 9 : `contientArt9 === false` → passe sans contrôle consentement (données synthétiques dev/test).

- [x] **Task 5 — La table `usage_ia` (métrage), migration `0008` (AC1)**
  - [x] `supabase/migrations/0008_usage_ia.sql` (forward-only, en-tête commentée story + ADs). Table **NON-art. 9** — colonnes : `id uuid pk`, `utilisatrice_id uuid not null references utilisatrice(id) on delete cascade`, `cle_idempotence text not null`, `tier text`, `modele text`, `tokens_entree int`, `tokens_sortie int`, `cree_le timestamptz not null default now()`. **Aucune** colonne de contenu (jamais prompt/réponse/verbatim).
  - [x] **Patron `audit_securite` (deny-by-default), PAS `art9_temoin` (write-gate)** : `enable row level security` + `force row level security`, **aucune policy** → invisible ET non-inscriptible sous session utilisatrice (l'usage est **server-authoritative** : une cliente ne peut jamais forger ses propres compteurs). Idempotence : **index unique** sur `cle_idempotence`.
  - [x] Appliquer en local (`supabase db reset` via la CLI **globale** v2.67.1, jamais `npx supabase`).
  - [x] **Écriture = client admin direct** (`lib/data/supabase/admin.ts`, `service_role`, `server-only`) : `insert … on conflict (cle_idempotence) do nothing` → tokens écrits **exactement une fois** par requête logique. `service_role` légitime car `usage_ia` est **non-art. 9** (tâche système, AD-12) ; l'`utilisatrice_id` est fourni par le serveur après `getUser()`. **Pas** de fonction `security definer` ici (inutile — `service_role` contourne déjà la RLS ; on la réserve aux tables art. 9 comme `audit_securite`).

- [x] **Task 6 — La route serveur métrée (AC1, AC5)**
  - [x] `app/api/anam/message/route.ts` (`POST`) : seam **minimal** de la 2.1 (la 2.2 le convertit en streaming + fil). Ordre : `runtime="nodejs"` ; `getUser()` (rejet si pas de session) ; construire l'`AiPort` via la fabrique ; `envoyerSousEgressArt9({ contientArt9: true, … })` ; **métrer une fois** dans `usage_ia` (clé d'idempotence par requête logique) ; répondre `Cache-Control: no-store`.
  - [x] Exports de segment (art. 9) : `export const dynamic = "force-dynamic"`, `export const fetchCache = "force-no-store"`, `export const revalidate = 0`, `export const runtime = "nodejs"`. **Ne pas** activer `experimental.cacheComponents` (incompatible avec `export const dynamic` — laisser off sur le chemin art. 9).
  - [x] La route **n'importe aucun SDK fournisseur** (elle ne connaît que `lib/ai`) et **aucun** SDK analytics/APM.

- [x] **Task 7 — CSP stricte + en-têtes (AC5)**
  - [x] **Portée 2.1** : la seule route art. 9 existante est la route API de la Task 6 → y appliquer `no-store` + CSP `connect-src 'self'`. Poser le **mécanisme réutilisable** (helper d'en-têtes art. 9 dans `lib/ai/` ou `lib/config/`) ; la CSP **nonce des pages** art. 9 (écran de conversation) arrive avec l'UI en **Story 2.2** — ne pas verrouiller des pages qui n'existent pas encore.
  - [x] Le mécanisme CSP : Next 16 a renommé `middleware.ts` → **`proxy.ts`** (fonction `middleware` → `proxy`, runtime Node) : **choisi = en-têtes par route** (plus sûr tant que la dépréciation court ; ne pas migrer `middleware.ts` dans cette story). Directives cibles art. 9 (pour la 2.2 sur les pages, et `connect-src`/`frame-ancestors`/`object-src` dès maintenant sur la route) : `default-src 'self'; script-src 'self' 'nonce-<n>' 'strict-dynamic'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'nonce-<n>'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'`.
  - [x] **Zéro tiers** : ne pas importer `@vercel/analytics`, Sentry browser, gtag, etc. sur les routes art. 9 et leur layout. `connect-src 'self'` bloque toute exfiltration même en cas d'oubli.
  - [x] Journalisation : **liste blanche de champs** (niveau/décision/tier/horodatage), **jamais** prompt/réponse/verbatim ni clé (NFR-022).

- [x] **Task 8 — Les gardes CI (toutes mutation-testées)**
  - [x] `tests/frontiere-serveur.test.ts` : (a) scanner l'arbre **atteignable client** (`app/**` hors `**/route.ts` et modules `server-only`, `render/**`) → **aucune** référence à `@mistralai/mistralai` **ni** à `MISTRAL_` (nom de variable-clé), en couvrant imports statiques `from`, **side-effect** `import "x"`, **dynamiques** `await import("x")`, `require("x")`, et `process["env"]`/`globalThis.process` ; (b) scanner **tout le repo hors `lib/ai/adapters/`** → aucun import du SDK Mistral (AD-3). **Strip des commentaires avant match** (réutiliser `sansCommentaires`).
  - [x] `tests/adaptateur-mistral.test.ts` : **contrôle positif + négatif** (non tautologique) — avec les 3 flags ZDR/DPA/scale posés, l'adaptateur art. 9 **se construit** ; sans, il **lève** (échec dur). Plus : la source de l'adaptateur ne référence **que** des endpoints stateless (`chat.complete`/`chat.stream`/`fim`), jamais `agents|conversations|batch|fineTuning|libraries`.
  - [x] `tests/egress-guard.test.ts` (SQL réel) : consentement valide + ZDR actif → egress **procède** (positif) ; **révocation** → egress **bloqué, rien posté** (négatif) ; ZDR off → bloqué. Vérifier que l'adaptateur factice n'est **pas** appelé quand bloqué.
  - [x] `tests/usage-ia.test.ts` (SQL réel) : deny-by-default (session utilisatrice ne lit/écrit rien, `data ?? []` longueur 0) ; le **client admin** écrit **une fois** ; **rejouer la même clé d'idempotence n'ajoute pas** de ligne (`on conflict do nothing`) ; **schéma sans colonne de contenu** (assertion sur `information_schema.columns` — aucune colonne texte de type prompt/réponse/verbatim).
  - [x] `tests/routes-art9-entetes.test.ts` : énumérer `app/api/**/route.ts` (patron `identite-route`) ; sur la route art. 9 → source exporte `dynamic="force-dynamic"` / `fetchCache="force-no-store"` / `runtime="nodejs"` et pose `no-store` ; **aucun** import analytics/APM/SDK fournisseur ; si CSP par en-tête, assertion `connect-src 'self'` **sans hôte tiers**.
  - [x] **Muter chaque garde** : planter une fuite (clé au client / SDK hors adapters / adaptateur qui démarre sans ZDR / egress sans re-check) et **confirmer le rouge** ; consigner ces mutations dans le Debug Log.

- [x] **Task 9 — Env + non-régression (AC1..AC5)**
  - [x] `.env.local.example` (ou équivalent) : documenter `MISTRAL_API_KEY` (serveur, **jamais** `NEXT_PUBLIC_`), `MISTRAL_ZDR_CONFIRMED`, `MISTRAL_DPA_SIGNED`, `MISTRAL_PLAN`, `AI_ADAPTER`. Rappeler : en prod Vercel, marquer les secrets **« Sensitive »**.
  - [x] Lancer **toute** la suite (`npx vitest run`) — **aucune régression** des tests 1.1→1.9 ; noter le total avant/après.
  - [x] `npm run lint` propre (strict, `verbatimModuleSyntax` → `import type` pour les types).

## Dev Notes

### Périmètre — ce qui est DANS 2.1 et ce qui est explicitement HORS

**Dans 2.1 :** le contrat `AiPort` ; l'adaptateur Mistral (stateless-only + boot-guard art. 9) ; l'adaptateur factice ; la fabrique ; l'egress-guard ; la table `usage_ia` (0008) + son métrage idempotent ; **une** route serveur métrée minimale ; la CSP stricte + `no-store` sur le chemin art. 9 ; les 5 gardes CI mutation-testées.

**HORS 2.1 (ne pas construire) :**
- **Streaming + le fil de conversation + apparition d'Anam + composeur** → Story 2.2. En 2.1, `AiPort.completer()` suffit ; `diffuser()` est ajouté en 2.2.
- **La politique de tier complète `(capacite, niveau_securite) → tier`** (AD-5) → Stories 2.2/2.3. En 2.1, un résolveur `capacite → tier` minimal, sans dimension sécurité.
- **Le pipeline sécurité-d'abord / détection de détresse** (AD-16) → Story 2.3.
- **`episode_detresse`, `limites_levees`, la garde 72 h** → Stories 2.4/2.5.
> Résister à l'attraction de ces sujets : la 2.1 est le **socle remplaçable et gardé**, pas la séance.

### Invariants d'architecture (à respecter au mot)

- **AD-2 — IA médiée par le serveur `[ADOPTED]`** : le navigateur ne parle **JAMAIS** à un fournisseur. Tout appel via `app/api/**`. **Une seule** clé serveur (secret Vercel), jamais côté client, jamais une clé par utilisatrice. Usage métré dans `usage_ia` (notre base). [Source: ARCHITECTURE-SPINE.md#AD-2]
- **AD-3 — Abstraction de fournisseur `[ADOPTED]`** : aucun code hors `lib/ai/adapters/` n'appelle un SDK fournisseur ; l'applicatif ne connaît que `AiPort`. Défaut Mistral. Le tier est un **paramètre du port**, jamais un `if` fournisseur. [Source: ARCHITECTURE-SPINE.md#AD-3]
- **AD-4 — Frontière art. 9 `[ADOPTED]`** : données art. 9 uniquement **serveur → fournisseur UE-éligible sous ZDR**, jamais vers analytics/traceur. Fournisseur art. 9 = **sous-traitant art. 28 + ZDR + endpoints stateless uniquement** ; **sans ZDR/DPA prouvés → refuse de démarrer** (échec dur, jamais dégradation). **Aucun direct-US.** Logs : jamais de contenu art. 9 en clair. [Source: ARCHITECTURE-SPINE.md#AD-4]
- **AD-13 — Write-gate + egress-gate `[ADOPTED]`** : tout envoi art. 9 hors du système passe par un **point d'egress unique** (`lib/ai/egress-guard`) qui revérifie, **dans la même transaction que l'envoi**, `consentement = vrai` **ET** ZDR actif ; **une révocation en vol bloque** et ne poste rien. [Source: ARCHITECTURE-SPINE.md#AD-13]
- **Conventions Routes art. 9** : `no-store`/`dynamic` (jamais de cache CDN, NFR-020) ; **CSP stricte** — `connect-src` limité au backend Anam, toute origine tierce = **défaut de build** (NFR-002) ; **aucun moniteur/APM tiers** ; journalisation par **liste blanche de champs**. [Source: ARCHITECTURE-SPINE.md#Consistency-Conventions]
- **Conventions Métrage** : tokens serveur **écrits exactement une fois** par requête logique (**clé d'idempotence**) ; `usage_ia` **sans art. 9**. [Source: ARCHITECTURE-SPINE.md#Consistency-Conventions]
- **AD-12 (rappel)** : `service_role` réservé aux tâches système, **jamais** au contenu art. 9 en requête applicative. Le métrage `usage_ia` (non-art. 9) via `service_role` est une tâche système **autorisée**. [Source: ARCHITECTURE-SPINE.md#AD-12]

### Le modèle de consentement à réutiliser (ne rien réinventer)

Le prédicat de garde **existe déjà** (Story 1.6, migration `0005`) : `public.a_consenti_art9()` — `security definer`, `stable`, `set search_path=''`, keyé **uniquement** sur `auth.uid()` (pas d'oracle inter-utilisatrices), `grant execute to authenticated`, anon révoqué en 0007. Il vérifie `art9_accorde = true AND ia_reconnue = true AND revoked_at IS NULL`. **L'egress-guard l'appelle en RPC sous la session RLS de l'utilisatrice** (`createSupabaseServerClient()` → `.rpc("a_consenti_art9")`) juste avant l'envoi. [Source: supabase/migrations/0005_write_gate_art9.sql:17-34, 0004_consentement.sql:13-20]

### Patrons de code existants (à copier, pas à improviser)

- **Route handler + `no-store`** : `app/api/export/route.ts` (getUser d'abord → redirect si absent ; `Cache-Control: no-store` à la réponse). [Source: app/api/export/route.ts]
- **Client serveur RLS** : `createSupabaseServerClient()` (JWT via cookies, RLS active, jamais service_role). [Source: lib/data/supabase/server.ts]
- **Client admin service_role** : `createSupabaseAdminClient()` avec `import "server-only"` en tête — barrière de compilation client. **Réservé tâches système** (ici : métrage `usage_ia`). [Source: lib/data/supabase/admin.ts:1,17-23]
- **Table système deny-by-default + fonction service_role** : `audit_securite` (0006) — RLS enable+force, **aucune policy**, nourrie par `appliquer_barriere_minorite` (`security definer`, EXECUTE révoqué de public/anon/authenticated, réservé service_role), idempotence par **index unique partiel**. **`usage_ia` copie ce patron**, pas `art9_temoin`. [Source: supabase/migrations/0006_barriere_minorite.sql, tests/barriere-minorite.test.ts:189-195]
- **Module server-only appelé depuis une route** (jamais une action `"use server"` à argument arbitraire, client-invocable) : `lib/safety/appliquer-barriere.ts`. [Source: leçon revue 1.9]

### `AiPort` — forme proposée (l'implémenteur peut affiner les noms, garder l'esprit)

```ts
// lib/ai/port.ts
import "server-only";
export type CapaciteIa = "echange" | "reconceptualisation" | "synthese";
export type TierIa = "leger" | "fort";
export interface MessageIa { role: "user" | "assistant" | "system"; content: string; }
export interface RequeteIa {
  capacite: CapaciteIa;
  messages: MessageIa[];
  contientArt9: boolean; // détermine si l'egress-guard art.9 s'applique
}
export interface ReponseIa {
  texte: string;
  tier: TierIa;
  modele: string;
  usage: { tokensEntree: number; tokensSortie: number };
}
export interface AiPort {
  completer(req: RequeteIa): Promise<ReponseIa>;
  estZdrProuve(): boolean; // interrogé par l'egress-guard (agnostique au fournisseur, AD-3)
  // diffuser(req): AsyncIterable<...>  ← ajouté en Story 2.2 (streaming)
}
```

### Mistral 2026 — faits vérifiés (2026-07-27)

- **SDK** : `@mistralai/mistralai` **`2.5.0`** (dernière stable, publiée 2026-07-17). **Épingler exact**, lockfile committé, `npm ci`. ⚠️ **`2.4.6` = paquet malveillant** (worm « Shai-Hulud 2.0 », `MAL-2026-3432`, retiré du registre) — ne jamais résoudre vers lui. [source: registry npm ; CSA/Akamai advisories]
- **Appels stateless** (à lier) : `client.chat.complete({ model, messages })` (2.1) ; `client.chat.stream({ model, messages })` → `for await (const chunk of stream) { chunk.data.choices[0]?.delta?.content }` (2.2). **Stateful interdits sur art. 9** : Agents, Conversations, Batch, Fine-Tuning, Libraries, Le Chat (rétention hors fenêtre 30 j). [source: github.com/mistralai/client-ts]
- **Modèles (ids datés, jamais `-latest` sur art. 9)** : **léger** `mistral-small-2603` (échange courant) ; **fort** `mistral-large-2512` (reconceptualisation, synthèse, **et toujours la détection de détresse en 2.3**). [source: docs.mistral.ai changelogs]
- **ZDR/DPA** : ZDR **uniquement plan Scale**, **stateless uniquement** ; résidence UE par défaut ; DPA base RGPD (art. 28). **Aucune API ne dit « ZDR actif »** → attestation par **flags serveur** posés **après** signature du contrat : `MISTRAL_ZDR_CONFIRMED=true`, `MISTRAL_DPA_SIGNED=true`, `MISTRAL_PLAN=scale`. Le tier gratuit « Experiment » **s'entraîne sur les données** → dev/test synthétiques seulement. [source: docs Mistral privacy + revue secondaire ; **à re-vérifier sur les pages légales Mistral avant lancement**]

### Next.js 16 / Vercel — spécifiques vérifiés

- **Route handler streaming** : Web Streams (`ReadableStream`) ; pour le chemin art. 9, **`ReadableStream` fait main** (pas le paquet `ai` — surface CVE-2025-48985, et évite d'importer un SDK tiers). Runtime **Node** (`export const runtime="nodejs"`), clé serveur jamais sur Edge. Région Vercel UE (`fra1`) recommandée. [source: nextjs.org/docs streaming]
- **No-cache art. 9** : `dynamic="force-dynamic"` + `fetchCache="force-no-store"` + `revalidate=0` + `Cache-Control: no-store`. **`experimental.cacheComponents` OFF** (incompatible avec `export const dynamic`). [source: vercel/next.js discussions/84894]
- **`middleware.ts` → `proxy.ts`** (Next 16, fonction `middleware`→`proxy`, runtime Node, codemod fourni). CSP nonce ici **ou** en-têtes par route (choisi : en-têtes par route tant que la dépréciation court). [source: nextjs.org/blog/next-16 ; docs proxy]
- **Advisory Vercel** : marquer `MISTRAL_API_KEY` et secrets **« Sensitive »** dans Vercel (incident avril 2026 : les vars sensibles sont restées protégées).

### Testing standards (résumé — détail en Task 8)

- **Runner** : vitest `4.1.10`, `environment: "node"`, `test.include: ["tests/**/*.test.ts"]`. Alias `@`→racine ; **`server-only` stubé** via `tests/_stubs/server-only.ts` (les modules `import "server-only"` sont donc testables). [Source: vitest.config.ts]
- **Env des tests SQL réels** : `npx vitest run` (Vitest ne charge pas `.env.local`). Vars : `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY`. Local Supabase requis (`supabase start` via CLI **globale v2.67.1**, **jamais `npx supabase`** — casse le `service_role`).
- **Patron garde d'architecture** : `tests/scene-architecture.test.ts` — `readdirSync(recursive)` + `sansCommentaires()` (strip commentaires, préserve `://`) + regex d'imports. **Réutiliser `sansCommentaires`.**
- **Patron route « n'importe pas X »** : `tests/aide-route.test.ts`. **Patron énumération de routes** : `tests/identite-route.test.ts` (`.filter(f => f.endsWith("page.tsx"))` → adapter à `route.ts`).
- **Patron privilège positif+négatif (non tautologique)** : `tests/privileges-fonctions.test.ts` (service_role PEUT / anon NE PEUT PLUS). **Modèle exact pour le boot-guard ZDR (AC3).**

### Project Structure Notes

- Fichiers **kebab-case**, langage métier **français** (`utilisatrice`, `metrer_usage_ia`), types **PascalCase** (`AiPort`, `RequeteIa`), suffixe **`Port`** (net-new). `import type` obligatoire pour les types (`verbatimModuleSyntax`). Alias `@/*`→racine. [Source: tsconfig.json, conventions repo]
- Arborescence cible (SPINE Structural Seed) respectée : `lib/ai/` (port + adapters/), `lib/config/` peut accueillir les flags si besoin, `app/api/**/route.ts` seul point fournisseur, `usage_ia` dans `supabase/`. [Source: ARCHITECTURE-SPINE.md#Structural-Seed]
- **Migration = `0008`** (0001→0007 existantes). Une story = une migration, forward-only, en-tête commentée.

### Pièges connus / portes (deferred-work + revues)

- **DPA/ZDR Mistral** = porte pré-lancement **net-new** ici (aucun antécédent repo). Le boot-guard la rend exécutoire. À ajouter à `deferred-work.md`.
- **`middleware`→`proxy`** et **avertissement Turbopack « additional lockfile »** (lockfile parent `/Users/juliantalou/`) : portes non bloquantes connues. [Source: 1-7 completion notes]
- **`npm audit` 5 vulns** (porte pré-lancement) : l'ajout du SDK peut bouger la surface — noter tout nouveau high.
- **Open redirect `/auth/confirm`** (param `next` brut) : hors périmètre mais adjacent à l'hygiène de frontière — ne pas l'aggraver. [Source: deferred-work.md]

### Leçons de revue à NE PAS répéter (server-boundary + gardes)

1. **Une garde qui reste verte quand on casse ce qu'elle protège ne vaut rien** (revue 1.8) → **muter chaque garde** (Task 8).
2. **Lier condition→destination dans UNE regex, sur source sans commentaires** (revue 1.9) — sinon tautologie.
3. **Jamais un `revoke`/refus prouvé par le seul chemin positif** (revue 1.9) → contrôle **positif + négatif** (boot-guard, egress-guard, usage_ia).
4. **`server-only`, pas une action `"use server"` à argument arbitraire** (revue 1.9) pour le chemin à clé.
5. **Regex de garde larges, tous fichiers/blocs** (revues 1.7/1.8) ; la garde d'imports statique **rate** side-effect/dynamique/`require` → grep aussi le **nom brut du package** et le **nom de la variable-clé**.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-2.1] — énoncé, ACs, couverture AD/NFR, porte pré-lancement.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Anima-2026-07-22/ARCHITECTURE-SPINE.md] — AD-2, AD-3, AD-4, AD-5, AD-12, AD-13 ; conventions Routes art. 9 & Métrage ; Structural Seed ; Deferred (DPA/ZDR).
- [Source: supabase/migrations/0004_consentement.sql] · [Source: supabase/migrations/0005_write_gate_art9.sql] · [Source: supabase/migrations/0006_barriere_minorite.sql] · [Source: supabase/migrations/0001_rls_deny_by_default.sql]
- [Source: app/api/export/route.ts] · [Source: lib/data/supabase/server.ts] · [Source: lib/data/supabase/admin.ts] · [Source: middleware.ts] · [Source: lib/data/supabase/middleware.ts]
- [Source: tests/scene-architecture.test.ts] · [Source: tests/aide-route.test.ts] · [Source: tests/identite-route.test.ts] · [Source: tests/privileges-fonctions.test.ts] · [Source: vitest.config.ts]
- Recherche 2026 (à re-vérifier avant lancement sur pages légales Mistral) : `@mistralai/mistralai@2.5.0`, modèles `mistral-small-2603`/`mistral-large-2512`, ZDR plan Scale stateless-only, `MAL-2026-3432` (2.4.6 malveillant), CVE-2025-48985 (paquet `ai`), Next 16 `proxy.ts` + `cacheComponents`/`dynamic`.

## Dev Agent Record

### Agent Model Used

Opus 4.8 (1M context) — `claude-opus-4-8[1m]`.

### Debug Log References

- **Flakiness suite (résolue).** Au 1er run complet, 3 tests SQL-réels (rls, privileges, egress) ont dépassé le timeout par défaut (5 s test / 10 s hook) — pas une régression : `rls.test.ts` passe seul en 936 ms, Supabase répond en 0,44 s (REST) et tous les conteneurs sont *healthy*. Cause : l'import à froid du SDK Mistral (~42 s de transform) affame les workers parallèles pendant les `createUser`. **Fix :** `testTimeout: 15000` / `hookTimeout: 20000` dans `vitest.config.ts` (marge pour Docker sous charge, assertions inchangées). Run final : **255/255 verts** en 4,9 s.
- **Mutation-testing des 5 gardes (Task 8, leçon revue 1.8).** Chaque garde plantée puis vérifiée ROUGE, puis revertée :
  1. `frontiere-serveur` — chaîne `"@mistralai/mistralai"` + `process.env.MISTRAL_API_KEY` injectée dans `fabrique.ts` → rouge (grep du nom brut).
  2. `adaptateur-mistral` — boot-guard neutralisé (`if (false && …)`) → contrôles négatifs rouges.
  3. `egress-guard` — contrôle consentement neutralisé → test « révocation en vol » rouge.
  4. `usage-ia` — policy `SELECT` temporaire injectée (docker psql) → test « ne lit rien » rouge, puis `drop policy`.
  5. `routes-art9-entetes` — `https://evil.example` ajouté à `connect-src` → test CSP rouge.
- **`npm audit` : 5 → 9 vulnérabilités** après l'ajout de `@mistralai/mistralai@2.5.0` (deps transitives). **Non bloquant** (porte pré-lancement, consignée dans `deferred-work.md`) ; `npm audit fix --force` NON lancé (casse). `2.4.6` (malveillant) écarté : version résolue = `2.5.0`.

### Completion Notes List

Implémenté et testé (255/255, tsc + eslint propres) le socle IA gardé de l'Epic 2 :
- **Frontière serveur (AD-2)** — tout appel via `app/api/**` ; clé serveur unique (`MISTRAL_API_KEY`, jamais `NEXT_PUBLIC_`) ; usage métré dans `usage_ia`. Garde CI : `@mistralai/mistralai` et `MISTRAL_` n'existent QUE dans `adapters/mistral.ts` (grep du nom brut → attrape side-effect/dynamique/`require`).
- **Port unique (AD-3)** — l'applicatif ne connaît que `AiPort` ; le SDK est isolé dans l'adaptateur (import dynamique via la fabrique → SDK/clé non requis en dev/CI). Tier = paramètre du port (résolveur minimal ; politique complète AD-5 différée en 2.2/2.3).
- **Boot-guard art. 9 (AC3, AD-4)** — l'adaptateur Mistral refuse de démarrer sans `MISTRAL_ZDR_CONFIRMED`+`MISTRAL_DPA_SIGNED`+`MISTRAL_PLAN=scale`. Contrôles positif **et** négatif.
- **Egress-guard (AD-13, AC4)** — point d'egress unique : revérifie le consentement vivant (`a_consenti_art9()` sous RLS) + `estZdrProuve()` de l'adaptateur, au plus près de l'envoi ; révocation en vol → rien posté (prouvé par adaptateur-espion).
- **`usage_ia` (0008)** — deny-by-default, NON-art. 9, écrit server-authoritative (admin `service_role`), idempotent (`on conflict do nothing`).
- **CSP + no-store (AC5)** — en-têtes art. 9 (`connect-src 'self'`, `object-src/base-uri/frame-ancestors 'none'`), route en `dynamic`/`fetchCache: no-store`/runtime Node ; aucune route API n'importe un SDK/APM.

**Décisions d'implémentation** (signalées, non cachées) :
- Le ZDR est une **propriété de l'adaptateur** (`estZdrProuve()`), pas un flag global lu dans l'egress → évite l'impasse en dev (le factice atteste ZDR par construction) et garde l'egress agnostique au fournisseur.
- Métrage `usage_ia` = **insert admin direct `on conflict do nothing`** (pas de fonction `security definer` : superflue pour une table non-art. 9 puisque `service_role` contourne déjà la RLS).
- CSP par **en-têtes de route** (pas de migration `middleware.ts`→`proxy.ts` dans cette story) ; la CSP **nonce des pages** art. 9 arrive avec l'écran de conversation (Story 2.2).

**Portes pré-lancement** (consignées dans `deferred-work.md`) : DPA art. 28 + ZDR Mistral (plan Scale) ; `npm audit` 5→9 ; CSP nonce des pages (2.2). **Hors périmètre 2.1, différé 2.2/2.3** : streaming réel + politique de tier complète.

### Revue de code (ultrareview locale, 2026-07-27) — 15 confirmés, tous traités

Revue adversariale multi-agents (10 angles → vérif → sweep, 32 agents). 15 défauts confirmés, dédupliqués en 9 réels + nettoyages. **Tous corrigés** (sauf 1 non-défaut assumé) :

- **🔴 Sécurité — prompt système contrôlable par le client** (route:83) : `extraireMessages` acceptait le rôle `system`. Extrait dans `lib/ai/valider-messages.ts`, n'accepte plus que `user`/`assistant`. Test : `tests/valider-messages.test.ts`.
- **🔴 Sécurité — mineur barré non bloqué à l'egress** (egress-guard:40) : l'egress ne vérifiait que le consentement, pas `est_barre_minorite()` (la barrière ne révoque pas le consentement). Ajout du contrôle (miroir du write-gate 0006). Test : cas « minorite » dans `tests/egress-guard.test.ts`.
- **🔴 AD-4 — repli factice silencieux en prod** (fabrique:13) : `AI_ADAPTER != "mistral"` retombait sur le factice sans erreur. Ajout d'un **échec dur en production** (`VERCEL_ENV`/`NODE_ENV`). Le factice déclare désormais `modele:"factice"` (métrage honnête). Tests : `tests/fabrique.test.ts`.
- **🔴 AD-2 — métrage contournable par le client** (route:57, 0008:26) : clé d'idempotence lue d'un en-tête client + index global. Clé **générée côté serveur** (`crypto.randomUUID()`) ; index scopé `(utilisatrice_id, cle_idempotence)`.
- **🟠 CSP placebo sur réponse d'API** (entetes-art9) : commentaire honnête — une CSP sur une réponse JSON n'est pas appliquée par le navigateur ; le vrai verrou `connect-src` est la CSP de page (Story 2.2). Seul `no-store` est effectif ici.
- **🟠 Chemin d'erreur sans en-têtes art. 9** (route:43) : `try/catch` renvoyant `ENTETES_ART9` sur 500 (boot-guard ou erreur fournisseur).
- **🟠 Métrage best-effort** (route:70) : commentaire rendu honnête (« au plus une fois » assumé ; durabilité « exactement une fois » = réconciliation streaming, Story 2.2).
- **⚪ Nettoyage** : champ `zdrProuve` redondant (mistral) → `return true` ; barrel `lib/ai/index.ts` mort → supprimé.
- **⏭️ Non corrigé (assumé)** : pas de singleton d'adaptateur — rejouer le boot-guard art. 9 par requête est un choix défensif, coût négligeable devant l'appel réseau.

266/266 tests après corrections ; la nouvelle garde barrière-mineur a été mutation-vérifiée (rouge quand neutralisée).

### File List

**Nouveaux :**
- `supabase/migrations/0008_usage_ia.sql`
- `lib/ai/port.ts` · `lib/ai/politique-tier.ts` · `lib/ai/fabrique.ts` · `lib/ai/egress-guard.ts` · `lib/ai/entetes-art9.ts` · `lib/ai/valider-messages.ts`
- `lib/ai/adapters/factice.ts` · `lib/ai/adapters/mistral.ts`
- `app/api/anam/message/route.ts`
- `tests/frontiere-serveur.test.ts` · `tests/adaptateur-mistral.test.ts` · `tests/egress-guard.test.ts` · `tests/usage-ia.test.ts` · `tests/routes-art9-entetes.test.ts` · `tests/valider-messages.test.ts` · `tests/fabrique.test.ts`

**Modifiés :**
- `lib/ai/README.md` (stub → doc complète de la couche)
- `package.json` (+ `@mistralai/mistralai@2.5.0`, épinglé exact) · `package-lock.json`
- `vitest.config.ts` (timeouts SQL élargis)
- `.env.example` (variables IA : `AI_ADAPTER`, `MISTRAL_*`)
- `_bmad-output/implementation-artifacts/deferred-work.md` (portes pré-lancement 2.1)

**Supprimé (revue) :** `lib/ai/index.ts` (barrel mort).

## Change Log

| Date | Version | Description | Author |
|---|---|---|---|
| 2026-07-27 | 0.1 | Story créée (context engine : SPINE AD-2/3/4/13, patrons repo, recherche Mistral/Next 16 vérifiée) | Create-Story |
| 2026-07-27 | 1.0 | Implémentation complète (9 tasks) : AiPort + adaptateurs (Mistral boot-gardé + factice) + egress-guard + `usage_ia` (0008) + route métrée + CSP art. 9 + 5 gardes CI mutation-testées. 255/255 tests, tsc + eslint propres. Statut → review. | Dev-Story |
| 2026-07-27 | 1.1 | Revue de code (ultrareview locale) : 15 confirmés, tous traités — rôle `system` client rejeté, barrière-mineur ajoutée à l'egress, repli factice interdit en prod, clé de métrage server-side + index scopé, `try/catch` art. 9, commentaires CSP/métrage honnêtes, nettoyages. 266/266 tests. Statut → done. | Code-Review |
