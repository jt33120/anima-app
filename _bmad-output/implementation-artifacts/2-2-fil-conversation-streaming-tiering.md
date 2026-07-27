---
baseline_commit: 48918421ea76bf7e6735e6b26e75487a655f7e3d
---

# Story 2.2 : Le fil de conversation en streaming et la politique de tiering

Status: in-progress

<!-- Note: Validation optionnelle. Lance validate-create-story pour un contrôle qualité avant dev-story. -->

## Story

En tant qu'**utilisatrice**,
je veux **parler à Anam dans un fil et la voir répondre en streaming avec une latence tenue**,
afin que **l'échange soit vivant sans jamais trahir la machine ni me presser**.

> **Nature de la story.** C'est la **première VUE conversationnelle**, posée sur la plomberie gardée de la Story 2.1. Elle a **deux moitiés séparables** : (A) le **socle streaming serveur** — `AiPort.diffuser()`, la route en streaming, la **politique de tier complète** `(capacité, niveau_sécurité) → tier` (AD-5), le métrage réconcilié « exactement une fois » — testable **sans UI** comme la 2.1 l'était ; puis (B) la **vue** — le fil, le composeur texte-seul, le streaming côté client, l'apparition d'Anam, les voiles, la CSP nonce des pages art. 9. La story **ne fait pas parler la vraie Anam** : le cerveau (arc de séance 2.7, voix 2.8, pipeline sécurité 2.3) vient après. En 2.2, l'échange de bout en bout se démontre et se teste via l'**adaptateur factice** (streaming déterministe par groupes de mots), Mistral câblé mais gardé. La dimension `niveau_sécurité` de la politique est **construite complète** mais son **producteur** (détection de détresse) est la Story 2.3 → en 2.2, `niveau_sécurité = 0` (échange courant → modèle léger).

## Acceptance Criteria

1. **(AC1 — c'est une conversation, pas un formulaire)** Étant donné la première séance, quand elle commence, alors elle se présente comme une **conversation** (aucun questionnaire à choix multiples, aucun formulaire de profil préalable — FR-001) **et** le fil est un **flux vertical sans bulles opposées**, les mots de l'utilisatrice rendus **à pleine valeur** (jamais `texte-doux`), distingués par la **typographie** (`corps` Inter vs `anam` Fraunces) et un **filet vertical gauche** (`bordure-forte`, retrait 16px), **pas** par l'extinction (FR-021).

2. **(AC2 — Anam prépare : latence tenue, signe épaissi, pas de points qui rebondissent)** Étant donné un message envoyé, quand Anam prépare, alors le **signe d'Anam s'épaissit** sans animation cyclique (**pas** de trois points qui rebondissent) **et** une **latence de 400 à 900 ms** est tenue avant le flux **même si la réponse est prête plus tôt**, le premier caractère paraissant **sous 1 s**.

3. **(AC3 — streaming par groupes de mots, annonce a11y unique, suivi du bas non captif)** Étant donné la réponse, quand elle s'affiche, alors c'est **par groupes de mots** (jamais caractère par caractère — NFR-014) **et** l'annonce au lecteur d'écran se fait **une fois, à la fin** (jamais mot à mot) **et** le **suivi du bas s'arrête dès que l'utilisatrice remonte** et **ne reprend pas seul**.

4. **(AC4 — politique de tier unique, résolue serveur)** Étant donné la politique de tiering **unique** `(capacité, niveau_sécurité) → tier`, quand un appelant déclare sa **capacité**, alors le **tier est résolu côté serveur** (le client ne le choisit **jamais**) **et** l'échange courant utilise le modèle **léger** tandis que reconceptualisation et synthèse utilisent le modèle **fort** **et** dès `niveau_sécurité ≥ 1` le modèle **fort** est **forcé** (AD-5, préparé pour la 2.3).

5. **(AC5 — voile obligatoire sur imagerie, composeur jamais masqué)** Étant donné du texte posé sur l'imagerie, quand il est rendu, alors il passe **toujours** par un **voile de lisibilité** (jamais directement sur l'image) **et** le composeur (champ multiligne, bouton d'envoi — **texte seul en v1, aucun micro**) **ne disparaît jamais**.

6. **(AC6 — apparition d'Anam en format Présence, aux beats seulement)** Étant donné l'un des trois beats (ouverture, nommer, clôture), quand il est signalé, alors le personnage paraît en **format Présence**, **sans cadre ni cercle**, en **fondu** (**instantané** sous `prefers-reduced-motion`) **et** **jamais à côté d'un tour ordinaire** — entre les beats, seul le **signe** porte sa présence. *(En 2.2 : le composant + le beat « ouverture » sont câblés ; « nommer »/« clôture » seront déclenchés par l'arc en 2.7/2.9.)*

7. **(AC7 — composeur texte-seul, Entrée contextuelle)** Étant donné le composeur **texte seul** (champ multiligne auto-extensible, **max 6 lignes** puis défilement interne, bouton d'envoi — **aucun micro** en v1), quand l'utilisatrice saisit, alors en **sm** « Entrée » **insère un saut de ligne** et l'envoi se fait par le **bouton**, tandis qu'en **≥ md** « Entrée » **envoie** et « Maj+Entrée » insère une ligne (UX-DR-21).

8. **(AC8 — clavier virtuel mobile, zoom, sans expiration)** Étant donné un navigateur mobile, quand le clavier virtuel s'ouvre, alors le composeur reste **au-dessus du clavier** (`dvh` + `visualViewport`) et le **dernier tour reste visible** **et** l'interface tient le **zoom 200 %** sans perte et se redistribue à **400 %**, sans limite de temps ni expiration de session en conversation (UX-DR-42).

9. **(AC9 — assets du personnage, trois formats, jamais dans icône/notif)** Étant donné les assets du personnage, quand ils sont produits, alors ils existent aux **trois formats** (Seuil 4:5 plein cadre, Présence 96–140px sans cadre à **bord plumeux**, Veille de dos) en **WebP/AVIF avec repli PNG**, **@2x**, `loading="lazy"` et un **`alt` sobre non-révélateur** **et** ils **ne paraissent jamais** dans l'icône, l'aperçu de notification ni la vignette multitâche (UX-DR-15).

**Couvre :** FR-001, AD-5, AD-7, AD-2, AD-3, AD-4, AD-13, NFR-012, NFR-014, NFR-020 · UX-DR-15, UX-DR-21, UX-DR-42 (fil de conversation, apparition d'Anam format Présence 3 beats, composeur, voiles de lisibilité, surimpression / signe d'Anam).

**⚠️ Portes pré-lancement (ne bloquent PAS le build) :**
- Hérite de la porte **DPA art. 28 + ZDR Mistral (plan Scale)** de la 2.1 : le vrai modèle passe par l'egress art. 9 → dev/test sur **factice / données synthétiques uniquement**.
- **`npm audit` 5→9** (héritée 2.1) : ne pas régresser.
- **CSP nonce des pages art. 9** : **livrée par cette story** (levée la porte 2.1 correspondante).

---

## Tasks / Subtasks

> **Structure en deux phases séparées par un point de commit naturel.** La **Phase A** (socle streaming serveur) est complète et testable **sans UI** — c'est le miroir 2.2 de la plomberie 2.1. La **Phase B** (vue) se construit dessus. La **Phase C** (assets peints) est une production visuelle (Gemini, hors code) — non bloquante grâce au repli gracieux. Voir la note de fin sur le découpage d'exécution.

### PHASE A — Le socle streaming serveur (backend, testable sans UI)

- [x] **Task A1 — `AiPort.diffuser()` + types d'événements de flux (AC3, AC4)**
  - [x] `lib/ai/port.ts` : ajouter à l'interface `AiPort` la méthode **`diffuser(req: RequeteIa): AsyncIterable<EvenementIa>`** (garder `completer()` — encore utile hors streaming). Type **`EvenementIa`** = union discriminée : `{ type: "delta"; texte: string }` | `{ type: "fin"; tier: TierIa; modele: string; usage: { tokensEntree: number; tokensSortie: number } }`. Le `fin` porte l'usage **réel de fin de flux** (métrage). `import "server-only"` conservé, **zéro** SDK ici.
  - [x] **Anti-injection tier (AD-5)** : le client ne fournit **jamais** ni `tier` ni `niveau_sécurité`. `RequeteIa` reste client-facing (`capacite`, `messages`, `contientArt9`). Le tier résolu est un **paramètre serveur** passé à l'adaptateur (champ interne résolu par la politique, jamais lu du corps client). Documenter ce point au-dessus de l'interface.

- [x] **Task A2 — La politique de tier COMPLÈTE `(capacité, niveau_sécurité) → tier` (AC4, AD-5)**
  - [x] `lib/ai/politique-tier.ts` : faire évoluer le résolveur minimal 2.1 vers la **politique unique** `tierPour(capacite: CapaciteIa, niveauSecurite: NiveauSecurite = 0): TierIa`. Type `NiveauSecurite = 0 | 1 | 2 | 3`. **Règle AD-5 exacte** : `if (niveauSecurite >= 1) return "fort"` (détresse → **fort forcé**, détection ET réponse, jamais le léger, en aucune circonstance) ; sinon `echange → leger`, `reconceptualisation|synthese → fort`. `modelePour(tier)` inchangé (léger `mistral-small-2603` / fort `mistral-large-2512`). **Retirer** le commentaire 2.1 « politique complète différée en 2.2/2.3 » (c'est fait ici pour la dimension sécurité ; la 2.3 branche seulement le **producteur** de `niveauSecurite`).
  - [x] **Un seul site de résolution** : la politique est appelée **une fois par tour**, côté serveur, dans la route/egress (voir A5). Les adaptateurs **ne rappellent pas** `tierPour` (ils reçoivent le tier résolu). C'est l'invariant AD-5 « jamais distribué chez chaque appelant ».

- [x] **Task A3 — `diffuser()` sur les deux adaptateurs (AC3, AC4)**
  - [x] `lib/ai/adapters/factice.ts` : implémenter `diffuser()` — **streaming déterministe par groupes de mots** (découper une réponse synthétique en fragments de 1–3 mots, `yield { type:"delta", texte }`), puis un `{ type:"fin", tier, modele:"factice", usage:{…simulé…} }`. C'est **le** chemin exercé en dev/CI (aucun réseau, aucune clé). `estZdrProuve()` reste `true` par construction.
  - [x] `lib/ai/adapters/mistral.ts` : implémenter `diffuser()` via **`this.client.chat.stream({ model, messages })`** — `for await (const chunk of stream) { const d = chunk.data.choices[0]?.delta?.content; if (d) yield { type:"delta", texte:d } }` ; le **dernier chunk** porte `usage` → émettre `{ type:"fin", tier, modele, usage }`. **Stateless uniquement** (jamais `agents`/`conversations`/`batch`), modèles par **id daté** (jamais `-latest`). Le boot-guard art. 9 reste appelé à la construction.
  - [x] Le `modele` du `fin` est **honnête** (le vrai id daté côté Mistral, `"factice"` côté factice — leçon revue 2.1 : pas de métrage falsifié).

- [x] **Task A4 — L'egress-guard, variante streaming (AC4, AD-13)**
  - [x] `lib/ai/egress-guard.ts` : ajouter **`diffuserSousEgressArt9(args): Promise<ResultatEgressFlux>`** où `ResultatEgressFlux = { bloque:true; raison:RaisonRefus } | { bloque:false; flux: AsyncIterable<EvenementIa> }`. **Mêmes trois gardes, dans le même ordre, AVANT le premier octet** : `estZdrProuve()` → `rpc("a_consenti_art9")` → `rpc("est_barre_minorite")` ; si l'un échoue → **bloquer, ne rien diffuser**. Sinon retourner `adaptateur.diffuser(requete)`.
  - [x] Documenter que « au plus près de l'envoi » (AD-13) = les gardes s'exécutent **juste avant d'ouvrir le flux** ; une révocation/suspension qui atterrit **avant** bloque. Résiduel (contenu déjà en vol après ouverture) borné par le ZDR + le write-gate — identique à la sémantique 2.1, appliquée au flux.

- [x] **Task A5 — La route en streaming NDJSON, latence tenue, métrage réconcilié (AC2, AC3, AC1 métrage, AD-2)**
  - [x] `app/api/anam/message/route.ts` : convertir le `POST` de `completer()`→JSON vers un **`ReadableStream` fait main** (pas le paquet `ai` — surface CVE-2025-48985, et pas de SDK tiers). Ordre : `getUser()` (401 si absent) → `extraireMessages` (400 si null) → `creerAiPort()` → **résoudre le tier serveur** `tierPour(capacite, /* niveauSecurite */ 0)` → `diffuserSousEgressArt9(...)` → si bloqué, **403** `egress_bloque_${raison}` (en-têtes art. 9). Sinon ouvrir le stream.
  - [x] **Transport = NDJSON** (une ligne JSON par événement) : `{"t":"delta","c":"…"}` par fragment texte, puis **une ligne terminale** `{"t":"fin"}` (fin propre) ou `{"t":"erreur"}` (échec fournisseur). Le client distingue ainsi **fin propre / interruption** (voir B4). **Jamais** de token ni de tier dans le flux client (le métrage est **serveur uniquement**). `Content-Type: application/x-ndjson`.
  - [x] **Latence tenue 400–900 ms (AC2)** : avant de flusher le **premier** `delta`, tenir un plancher côté serveur (retenir le premier fragment jusqu'à ce que ≥ ~500 ms se soient écoulés depuis la réception du tour). Ne pas retarder les fragments suivants. Premier caractère visé **< 1 s**.
  - [x] **Métrage « exactement une fois », réconcilié à la fin/à l'avortement (NFR-014)** : générer la **clé d'idempotence côté serveur** (`crypto.randomUUID()`) au début. Consommer le flux ; à l'événement `fin`, capter `usage`. Dans un **`finally`** (couvrant fin propre **ET** `request.signal` aborted / erreur), écrire `usage_ia` via l'admin `on conflict (utilisatrice_id, cle_idempotence) do nothing` avec les compteurs finaux (ou accumulés si avorté). C'est la **montée en durabilité** de la 2.1 (qui était « best-effort »).
  - [x] Exports de segment art. 9 **inchangés** : `dynamic="force-dynamic"`, `fetchCache="force-no-store"`, `revalidate=0`, `runtime="nodejs"`. Réponse en `no-store` (`ENTETES_ART9` — mais voir Task B1 : le **verrou CSP** effectif vit sur la **page**, pas sur cette réponse de flux). La route **n'importe aucun SDK** fournisseur ni analytics/APM.
  - [x] Gérer l'**abandon client** (`request.signal`) : si l'utilisatrice quitte, cesser de consommer le flux amont, fermer proprement, **métrer ce qui a été produit** (même clé → pas de double compte).

- [x] **Task A6 — Validation stricte de la requête serveur (anti-injection, AD-5)**
  - [x] `lib/ai/valider-messages.ts` (ou un `valider-requete.ts` adjacent) : garantir que le corps client **ne peut porter** ni `tier`, ni `niveau_sécurité`, ni rôle `system` (déjà : `system` rejeté en 2.1). Le serveur **ignore/rejette** tout champ de contrôle client. La `capacite` acceptée du client est **contrainte** (en 2.2, `"echange"` seulement ; reconceptualisation/synthèse sont des capacités **serveur**, 2.7+). Documenter : le client déclare au plus un tour d'`echange`.

- [x] **Task A7 — Gardes CI Phase A (toutes mutation-testées)**
  - [x] `tests/politique-tier.test.ts` (**net-new**) : la politique AD-5 — `(echange,0)→leger` ; `(reconceptualisation,0)→fort` ; `(synthese,0)→fort` ; **`(echange,1)→fort`, `(echange,2)→fort`, `(echange,3)→fort`** (détresse force le fort pour **toute** capacité). **Muter** : neutraliser la branche `niveauSecurite>=1` → confirmer le **rouge**.
  - [x] `tests/flux-anam.test.ts` (**net-new**, SDK stubé / factice) : `diffuser()` du factice émet des `delta` **par groupes de mots** puis **un** `fin` avec usage ; `diffuserSousEgressArt9` **bloque avant tout `delta`** quand consentement révoqué / ZDR faux / minorité (adaptateur-espion : **zéro** `delta` émis quand bloqué). Contrôle **positif + négatif**.
  - [x] `tests/metrage-flux.test.ts` (**net-new**, SQL réel) : après un flux complet, `usage_ia` porte **exactement une** ligne (clé serveur) ; **rejouer** la même clé n'ajoute rien ; un flux **avorté** métré **une fois** aussi. Étend le patron `usage-ia.test.ts`.
  - [x] `tests/routes-art9-entetes.test.ts` (**étendre**) : la route streaming garde `dynamic`/`fetchCache`/`runtime nodejs`, `no-store`, **aucun** import SDK/APM ; adapter les assertions à une réponse **NDJSON** (pas `NextResponse.json`).
  - [x] `tests/frontiere-serveur.test.ts` (**étendre**) : le nouveau code streaming ne fait **fuiter** ni `@mistralai/mistralai` ni `MISTRAL_` hors `adapters/mistral.ts` (grep du nom brut, side-effect/dynamique/`require`).
  - [x] **Muter chaque nouvelle garde** (leçon revues 1.8/2.1) et consigner le rouge dans le Debug Log.

 — La vue conversation (frontend)

- [ ] **Task B1 — CSP nonce des pages art. 9 : migration `middleware.ts` → `proxy.ts` (AC — Conventions Routes art. 9, NFR-020, NFR-002)**
  - [ ] **Migrer** `middleware.ts` → **`proxy.ts`** (Next 16 : fonction `middleware`→`proxy`, **runtime Node uniquement**, codemod fourni). **Préserver à l'identique** le rafraîchissement de session Supabase (`lib/data/supabase/middleware.ts`) — **risque de régression : boucle de déconnexion** si les cookies de réponse ne sont pas repropagés. Vérifier que l'onboarding et la session tiennent après migration.
  - [ ] **Poser la CSP nonce sur les pages art. 9** (recette officielle Next 16, doc à jour 2026-03) : générer le nonce par requête (`Buffer.from(crypto.randomUUID()).toString('base64')`), le poser **sur la requête** (`x-nonce` + en-tête `Content-Security-Policy`, via `NextResponse.next({ request:{ headers }})`) **ET sur la réponse**. Lire dans le Server Component via `(await headers()).get('x-nonce')`. **Piège critique** : sans le nonce sur la **requête**, les scripts d'hydratation RSC (`self.__next_f.push`) sont bloqués → **écran blanc**. Next nonce automatiquement ses propres scripts en lisant l'en-tête de requête.
  - [ ] Directives : `default-src 'self'; script-src 'self' 'nonce-<n>' 'strict-dynamic' <'unsafe-eval' en DEV uniquement>; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'`. **`connect-src 'self'`** est le **verrou anti-exfiltration** qui compte (bloque tout POST art. 9 vers un tiers). **Note styles** : pas de Tailwind ici (CSS modules + `next/font` self-hosté) — garder `style-src 'self' 'unsafe-inline'` (pragmatique, sûr) ; si le dev veut `'nonce'` sur les styles, vérifier **aucun écran blanc** (nonce et `'unsafe-inline'` sont **mutuellement exclusifs** par spec).
  - [ ] **Ne PAS activer `experimental.cacheComponents`** (incompatible `dynamic` — déjà off en 2.1 — **et** bug ouvert #89754 nonce+cacheComponents). Le nonce **force le rendu dynamique** : sans coût pour nous (les pages art. 9 sont déjà `force-dynamic`/`no-store`). **`matcher`** : appliquer la CSP art. 9 aux **pages de scène/conversation** (inclure `/`), **exclure** `api`, `_next/static`, `_next/image`, `favicon.ico`, prefetches.
  - [ ] Réutiliser/étendre `lib/ai/entetes-art9.ts` (`CSP_ART9`) comme **source unique** des directives, injectée avec le nonce par `proxy.ts`.

- [ ] **Task B2 — Le fil de conversation (AC1, AC5)**
  - [ ] Créer le module de vue **`render/conversation/`** (composants client) — c'est le **rendu** de la région `anam` (AD-7 : `render/` est l'adaptateur muet ; **aucune** décision de domaine ici — pas d'arc, pas de sécurité, pas de monotonie). Remplacer le placeholder `CORPS.anam` (« Ici s'ouvrira ta conversation avec Anam. ») dans `render/scene-dom.tsx` par `<Conversation />`.
  - [ ] `Fil` — **flux vertical unique, aucune bulle opposée**, sur `fond`. `TourAnam` (`{typography.anam}` Fraunces, `texte`, largeur ≤ `--mesure`, apparition `fondu-texte`, **pas** de fond/bulle/bordure). `TourUtilisatrice` (`{typography.corps}` Inter, `texte` **pleine valeur — jamais `texte-doux`**, **filet 1px `bordure-forte` à gauche + retrait 16px**). Écart entre tours = `--respiration`. **Aucun** horodatage / coche / « en ligne » / emoji / pièce jointe.
  - [ ] **Voile obligatoire sur imagerie (AC5)** : si le fond de conversation porte une imagerie, tout texte passe par un voile (`.voile-seuil` / mécanisme B) — **jamais** de texte nu sur image, **jamais** `text-shadow` en substitut. En 2.2, un aplat `fond` est acceptable comme fond de fil (le voile ne s'applique qu'aux zones sur imagerie).
  - [ ] Densité : **3 à 4 échanges lisibles** à l'écran max (la lenteur du défilement est le produit). Pagination de l'historique = **explicite** (« Charger la suite »), **jamais** infinie (hors périmètre de rendu 2.2 si l'historique n'est pas encore persisté — voir Dev Notes).

- [ ] **Task B3 — Le composeur texte-seul (AC5, AC7, AC8)**
  - [ ] `render/conversation/Composeur.tsx` : bande basse `surface-elevee`, bordure 1px `bordure-forte` (contrôle, seuil 3:1), `--rayon`. **Champ multiligne auto-extensible** (`<textarea>` qui grandit jusqu'à **6 lignes** puis défilement interne), **bouton d'envoi**. **AUCUN micro, aucune barre d'outils, aucun emoji, aucune pièce jointe** (v1 texte seul — voir la contradiction résolue en Dev Notes). **Ne disparaît jamais** — y compris après clôture et pendant un futur épisode de détresse.
  - [ ] **Entrée contextuelle (AC7, UX-DR-21)** : détecter le palier (`≥ md` vs `sm`, par media query / largeur). En **≥ md** : `Entrée` **envoie**, `Maj+Entrée` insère une ligne. En **sm** : `Entrée` **insère une ligne**, envoi par le **bouton** uniquement (on n'envoie jamais une confidence par accident).
  - [ ] **Clavier virtuel mobile (AC8)** : shell `min-height: 100dvh` **+** hook `visualViewport` (écouter `resize` **et** `scroll`, lire `height`+`offsetTop`, recaler le composeur en bas et re-scroller vers le dernier tour). `dvh` **seul ne suffit pas** (Chromium ne rétrécit pas les unités viewport à l'ouverture du clavier). Ajouter `interactive-widget=resizes-content` au meta viewport (surtout Android ; iOS repose sur `visualViewport`). Fallback `100svh` si `visualViewport` absent.
  - [ ] **Zoom (AC8)** : la colonne se **redistribue** à 200 %/400 % sans perte ; **aucune** limite de temps ni expiration de session en conversation.
  - [ ] Anneau de focus visible (`bordure-forte`, offset 2px) sur le champ **et** le bouton ; cibles ≥ **44px**.

- [ ] **Task B4 — L'état streaming côté client (AC2, AC3)**
  - [ ] `render/conversation/useFluxAnam.ts` (hook client) : `fetch("/api/anam/message", { method:"POST", signal })` → **`response.body.getReader()` + `TextDecoder({ stream:true })`**. Parser le **NDJSON** ligne à ligne (buffer + `split("\n")`, garder la dernière ligne partielle). Accumuler les `delta.c` et **flusher par GROUPES DE MOTS** (buffer + découpe sur le dernier espace — **jamais** caractère par caractère). `useState` (**pas** `use()`/Actions — inadaptés à un flux de deltas). Throttle optionnel via `requestAnimationFrame`.
  - [ ] **État « Anam prépare » (AC2)** : entre l'envoi et le premier `delta`, **épaissir le signe d'Anam** (état passé à `render/surimpression.tsx` — le `SigneAnam()` porte déjà un commentaire réservant cet épaississement) — **sans** animation cyclique, **pas** de points qui rebondissent. Le premier fragment n'apparaît qu'après le plancher serveur (400–900 ms).
  - [ ] **Annonce a11y fiable (AC3)** : **NE PAS** se reposer sur le toggling `aria-busy` seul (**cassé sur NVDA** — bug Mozilla #1682063). Pattern : le texte qui « tape » vit dans un conteneur **hors** live-region (ou visuel seul) ; à la **fin** du flux, écrire le message **complet, en une fois**, dans une région `aria-live="polite"` **`aria-atomic="true"`** → annonce **unique** fiable. `aria-busy="true"` pendant le flux reste un **complément** (calme JAWS/VoiceOver), pas le déclencheur.
  - [ ] **Suivi du bas non captif (AC3)** : suivre le bas **tant que** l'utilisatrice n'a pas remonté ; **dès qu'elle remonte**, arrêter le suivi et **ne pas** le reprendre seul.
  - [ ] **Interruption (AC3, robustesse)** : `AbortController` au démontage / départ ; **catcher `AbortError`** sans **vider** le texte partiel déjà affiché. Si la ligne terminale `{"t":"fin"}` n'est jamais reçue (coupure) → laisser le partiel + « **Réessayer** » sous le tour, message **jamais** retiré du fil. **Aucun** message d'erreur signé Anam (registre système : « Je n'ai pas pu répondre. Ton message est gardé. »).
  - [ ] Le tour de l'utilisatrice s'affiche **immédiatement** (optimiste) puis se stabilise ; **jamais** retiré en cas d'échec.

- [ ] **Task B5 — L'apparition d'Anam (format Présence) + le système d'assets 3 formats (AC6, AC9)**
  - [ ] `render/conversation/ApparitionAnam.tsx` : le personnage en **format Présence** (96–140px), **AUCUN cadre / cercle / vignette / pastille** — **bord plumeux** dissous dans `fond`. Entrée/sortie en **`fondu-personnage`** (700ms), **instantané** sous `prefers-reduced-motion` (jamais supprimé — a11y : jamais d'info par le seul mouvement). Prend un **prop `beat`** (`"ouverture" | "nommer" | "cloture" | null`). **Jamais** rendu à côté d'un tour ordinaire ; entre les beats, `null` → seul le **signe** (surimpression) porte la présence. **En 2.2 : câbler le beat `"ouverture"`** au montage de la conversation ; `"nommer"`/`"cloture"` restent des seams pour 2.7/2.9.
  - [ ] **Système d'assets (AC9, UX-DR-15)** : composant `<ImageAnam format="seuil|presence|veille" />` qui sert **WebP/AVIF + repli PNG**, **@2x**, `loading="lazy"` (hors 1re vue), `alt` **sobre non-révélateur** (« illustration nocturne » — jamais « femme au lotus »). Chemins **stables** sous `public/scene/` (ex. `public/scene/presence/anam-presence-a.{avif,webp,png}`). **Repli gracieux** si l'asset peint n'existe pas encore (le composant ne casse pas le build — voir Phase C). Le personnage **n'apparaît jamais** dans `app/icon.svg`, l'aperçu de notification ni la vignette multitâche.
  - [ ] `next/image` : `fill` + `sizes` corrects, ou dimensions fixes pour Présence (96–140px). Pas de parallaxe, pas de Ken Burns.

- [ ] **Task B6 — Gardes a11y & vue (Phase B)**
  - [ ] `tests/conversation-accessibilite.test.ts` (**net-new**, patron `scene-accessibilite.test.ts`) : le conteneur de streaming porte `aria-live="polite"`/`aria-atomic` **à la fin** (pas d'annonce mot-à-mot) ; l'apparition Présence est **instantanée** sous `prefers-reduced-motion` et **jamais supprimée** ; l'anneau de focus **jamais** retiré (`outline`) ; **aucun** `text-shadow` en substitut de voile ; cibles ≥ 44px ; ordre de lecture **linéaire** (DOM). Statique (lecture source/CSS) là où le runtime DOM n'est pas dispo.
  - [ ] `tests/composeur.test.ts` (**net-new**) : `Entrée` sm=saut de ligne / md=envoi, `Maj+Entrée`=ligne ; max 6 lignes puis scroll ; le composeur **existe toujours** (jamais démonté). *(Si le runtime DOM manque sous vitest node, tester la logique de décision clavier en pur + garde source.)*
  - [ ] `tests/scene-architecture.test.ts` (**étendre**) : `render/conversation/**` **n'importe** ni `lib/ai` ni `lib/data`/supabase ni `process.env`/secret (AD-2/AD-7 : le rendu ne connaît que `fetch` vers `app/api/**`). `lib/scene/**` **reste pur** (aucun concept de message/streaming n'y a fui).
  - [ ] `tests/identite-route.test.ts` (**vérifier**) : la page de conversation garde le titre « Anam » (AC7 identité de route héritée 1.7).

### PHASE C — Assets visuels du personnage (production Gemini, hors code)

- [ ] **Task C1 — Produire les assets Présence & Veille (Julian, via Gemini)**
  - [ ] À partir des planches de référence `images/anam-gemini/`, produire **Présence** (buste émergeant de la nuit, lotus près des cheveux, **fond transparent, bord plumeux ~16–24px**, ~560px + @2x) et **Veille** (de dos/profil/estompée, fond transparent). Déposer en `public/scene/{presence,veille}/anam-*.{avif,webp,png}`.
  - [ ] Je (l'agent) **fournis les prompts Gemini** dans les Completion Notes ; **non bloquant pour le build** (repli gracieux Task B5). Cohérent avec la charte : personnage jamais dans icône/notif/multitâche.

### Transverse

- [ ] **Task T1 — Env, non-régression, deferred-work**
  - [ ] Ajouter `interactive-widget=resizes-content` au meta viewport (`app/layout.tsx` `export const viewport`).
  - [ ] Lancer **toute** la suite (`set -a && . ./.env.local && set +a && npx vitest run`) — **aucune régression** 1.1→2.1 (266 tests actuels) ; noter total avant/après. `npm run lint` propre (`import type`, `verbatimModuleSyntax`).
  - [ ] Mettre à jour `_bmad-output/implementation-artifacts/deferred-work.md` : **lever** la porte « CSP nonce des pages art. 9 » (livrée) ; consigner ce qui reste 2.3+ (producteur `niveauSecurite`, arc/voix, historique persisté, hors-ligne NFR-017, quota résiduel FR-079).

---

## Dev Notes

### Périmètre — ce qui est DANS 2.2 et ce qui est explicitement HORS

**Dans 2.2 :**
- **Phase A (serveur)** : `AiPort.diffuser()` + `EvenementIa` ; la **politique de tier complète** `(capacité, niveau_sécurité) → tier` (AD-5, dimension sécurité incluse, `niveauSecurite` par défaut 0) ; `diffuser()` sur mistral (gardé) + factice ; l'**egress-guard streaming** ; la **route NDJSON** en streaming avec **latence tenue** et **métrage réconcilié exactement-une-fois** ; la validation stricte anti-injection ; les gardes CI.
- **Phase B (vue)** : la **CSP nonce des pages** art. 9 (`proxy.ts`) ; le **fil** (TourAnam/TourUtilisatrice, sans bulles, mots utilisatrice pleine valeur) ; le **composeur texte-seul** (Entrée contextuelle, clavier mobile) ; l'**état streaming client** (groupes de mots, signe épaissi, annonce a11y unique, suivi non captif, interruption gracieuse) ; l'**apparition d'Anam** (Présence, beat « ouverture » câblé) + le **système d'assets 3 formats** (repli gracieux) ; les gardes a11y.
- **Phase C** : les **prompts** de production des assets Présence/Veille (Julian les passe dans Gemini).

**HORS 2.2 (ne pas construire — résister à l'attraction) :**
- **La vraie voix / le cerveau d'Anam** (registre, formulations bannies, hypothèses réfutables) → **Story 2.8**. En 2.2, le factice répond de façon déterministe ; le prompt système Mistral reste un **placeholder minimal**.
- **L'arc de séance** construire→observer→nommer→clore, les conditions de sortie de phase, les 3 restitutions, les beats « nommer »/« clôture » → **Story 2.7**. En 2.2, seul le beat « ouverture » est câblé.
- **Le pipeline sécurité-d'abord / la détection de détresse** (le **producteur** de `niveauSecurite`) → **Story 2.3**. La politique de tier **consomme** `niveauSecurite` mais rien ne le lève encore (reste 0).
- **`episode_detresse`, `limites_levees`, la garde 72 h, le bloc ressources dans le fil, la démolition commerciale** → **Stories 2.4/2.5/2.6**.
- **Le bilan de clôture, la carte d'abonnement, le paywall** → **Stories 2.9 / Epic 3**.
- **La persistance de l'historique de conversation** (journal brut `entree_journal`, mémoire 3 couches) → **Epic 4 (AD-8)**. En 2.2, le fil peut être **éphémère en session** (les tours vivent dans l'état client + l'appel serveur) — **aucune table de conversation n'est créée ici**. La route reste **stateless** (endpoints stateless art. 4). *(Si un dev juge nécessaire de persister ne serait-ce que le tour courant, c'est un écart à signaler, pas à décider seul — l'écriture art. 9 relève du write-gate + AD-8.)*
- **Hors-ligne / réémission (NFR-017), quota résiduel épuisé (FR-079), séance close** → seams laissés visibles, comportements complets différés (2.5/2.9/Epic 3).
- **La saisie vocale (STT)** → **v1.1** (déférée, derrière `SttPort` — voir la contradiction DESIGN.md ci-dessous).

### La contradiction « micro » à trancher (DESIGN.md vs epic) — TRANCHÉE

`DESIGN.md` (`champ-saisie`, ligne 641) et `EXPERIENCE.md` (Composeur, ligne 152) décrivent **une icône de micro** dans le composeur. L'**epic 2.2 surcharge explicitement** : « **texte seul en v1, aucun micro** » (AC5, AC7) ; la note d'epic v1 défère **NFR-003/004/017** (audio, émotion, capture) en **v1.1 derrière `SttPort`**. → **En 2.2 : composeur texte seul, aucun micro, aucune icône micro.** C'est l'epic qui prime (décision produit v1). Ne pas ajouter de bouton micro « pour plus tard ».

### Invariants d'architecture (à respecter au mot)

- **AD-2 — IA médiée serveur `[ADOPTED]`** : le navigateur ne parle **jamais** à un fournisseur. Le client `fetch` **uniquement** `app/api/anam/message`. Le tier est **résolu serveur** ; le client ne l'envoie **jamais**. Usage métré dans `usage_ia`. [Source: ARCHITECTURE-SPINE.md#AD-2]
- **AD-3 — Abstraction fournisseur `[ADOPTED]`** : `diffuser()` est un **paramètre du port**, pas un `if` fournisseur ; aucun SDK hors `lib/ai/adapters/`. [Source: ARCHITECTURE-SPINE.md#AD-3]
- **AD-4 — Frontière art. 9 `[ADOPTED]`** : le vrai flux Mistral reste **UE-éligible sous ZDR, stateless**, boot-guard dur ; **aucun direct-US**, aucun traceur/APM sur le flux. Dev/test = **factice**. [Source: ARCHITECTURE-SPINE.md#AD-4]
- **AD-5 — Tiering ; détresse au plus capable `[ADOPTED]`** : politique **unique** `(capacité, niveau_sécurité) → tier`, **résolue serveur**, appelants déclarent la capacité. `niveau ≥ 1 → fort` (détection **ET** réponse), **jamais** le léger. À défaut du fort : **repli sûr** (AD-15, réel en 2.3/2.5). [Source: ARCHITECTURE-SPINE.md#AD-5]
- **AD-7 — Scène modèle/rendu séparés `[ADOPTED]`** : `lib/scene/` **reste pur** (aucun message/streaming n'y entre — le fil est une **feature de vue** dans `render/conversation/`, pas du modèle de scène). `render/` **muet** : il rend le fil et appelle l'API, il ne **décide** aucune règle de domaine (arc/sécurité/monotonie). La région `anam` (`REGION_CONVERSATION`) est le point d'ancrage. [Source: ARCHITECTURE-SPINE.md#AD-7]
- **AD-13 — Write-gate + egress-gate `[ADOPTED]`** : le flux art. 9 sort **uniquement** par `diffuserSousEgressArt9`, gardes **avant le 1er octet**. Révocation en vol → rien diffusé. [Source: ARCHITECTURE-SPINE.md#AD-13]
- **Conventions Routes art. 9** : `no-store`/`dynamic`, **CSP stricte `connect-src 'self'`** (verrou anti-exfiltration **sur la page**), **zéro tiers**, journalisation **liste blanche** (jamais prompt/réponse/verbatim). [Source: ARCHITECTURE-SPINE.md#Consistency-Conventions]
- **Conventions Métrage & paywall** : tokens **écrits exactement une fois** par requête logique, **réconciliés à la fin/l'avortement du stream** (NFR-014) ; `usage_ia` **sans art. 9**. [Source: ARCHITECTURE-SPINE.md#Consistency-Conventions, ligne 153]

### Ce qui existe déjà (Story 2.1) — à ÉTENDRE, pas réinventer

- **`lib/ai/port.ts`** — `AiPort { completer(); estZdrProuve() }` + `CapaciteIa`/`TierIa`/`MessageIa`/`RequeteIa`/`ReponseIa`. Le commentaire réserve **explicitement** `diffuser()`. [Source: lib/ai/port.ts]
- **`lib/ai/politique-tier.ts`** — `tierPour(capacite)` minimal + `modelePour(tier)`. Commentaire : politique complète **différée ici (2.2)**. [Source: lib/ai/politique-tier.ts]
- **`lib/ai/egress-guard.ts`** — `envoyerSousEgressArt9({supabase,adaptateur,requete})`, ordre `estZdrProuve()`→`a_consenti_art9()`→`est_barre_minorite()`→`completer()`. Ajouter la variante `diffuser`. [Source: lib/ai/egress-guard.ts]
- **`lib/ai/adapters/{mistral,factice}.ts`** — mistral : `chat.complete`, commentaire `chat.stream` « à venir en 2.2 », boot-guard. factice : déterministe, `estZdrProuve()→true`, « conçu pour développer la 2.2 dessus ». [Source: lib/ai/adapters/*]
- **`app/api/anam/message/route.ts`** — POST seam 2.1 (getUser → extraireMessages → creerAiPort → envoyerSousEgressArt9 → métrage best-effort upsert → `NextResponse.json`). Les commentaires internes annoncent la conversion streaming 2.2. [Source: app/api/anam/message/route.ts]
- **`lib/ai/valider-messages.ts`** — `extraireMessages(corps)` : n'accepte que `user`/`assistant` (rejette `system` client). [Source: lib/ai/valider-messages.ts]
- **`lib/ai/entetes-art9.ts`** — `CSP_ART9` + `ENTETES_ART9`. Commentaire : le **vrai verrou CSP** (`connect-src` + nonce) vit **sur la page** (2.2). Source unique des directives. [Source: lib/ai/entetes-art9.ts]
- **`usage_ia` (0008)** + admin `on conflict do nothing` : réutiliser tel quel, réconcilier au lieu de best-effort. [Source: supabase/migrations/0008_usage_ia.sql, lib/data/supabase/admin.ts]

### Ce qui existe déjà (scène 1.7 / surimpression 1.8) — à consommer

- **`lib/scene/regions.ts`** — **`REGION_CONVERSATION = "anam"`** (source unique — **ne jamais** coder `"anam"` en dur). `IdRegion = "seuil"|"accueil"|"anam"|"arbre"`. [Source: lib/scene/regions.ts]
- **`lib/scene/vue.ts`** — view-state `{ regionCourante }` + `reducteurVue` (pur, idempotent), hébergé par `useReducer` dans `render/scene-dom.tsx`. **Le fil n'y entre pas.** [Source: lib/scene/vue.ts]
- **`lib/scene/surimpression.ts`** — `surimpressionPour(region)` → `signeAnam`/`mentionIA` vrais **uniquement** en région `anam`. [Source: lib/scene/surimpression.ts]
- **`render/scene-dom.tsx`** — hôte du view-state ; régions en `<section>` `aria-hidden`/`inert` sauf active ; focus déplacé vers l'entête ; `CORPS.anam` = **placeholder à remplacer**. Surimpression montée **en tête**, hors régions inert. [Source: render/scene-dom.tsx]
- **`render/surimpression.tsx`** — `SigneAnam()` (SVG placeholder) ; commentaire : **épaississement « Anam prépare » différé (2.2)** → c'est **ici** que l'état streaming épaissit le signe. Mention IA `<Link href="/aide#transparence">Anam est une IA</Link>`, porte de secours `<Link href="/aide">Aide</Link>`. [Source: render/surimpression.tsx]
- **`render/monde.module.css`** — `.region`/`.regionActive` (crossfade opacité, reduced-motion neutralisé), `.voile-seuil` (globals), `.surimpression*`. [Source: render/monde.module.css]
- **Tokens (`app/styles/tokens.ts` + `globals.css`)** — variables CSS exactes : couleurs (`--fond`, `--surface-elevee`, `--texte`, `--texte-doux`, `--bordure-forte`, `--accent`, `--lueur`…), typo (`.t-anam`, `.t-corps`, `.t-meta`, `.t-surtitre`, `.t-bouton`), espacement (`--respiration:40px`, `--mesure:32rem`, `--contenu-max:40rem`, `--cible-tactile:44px`), mouvement (`--duree-courte:180ms`, `--duree-standard:320ms`, `--duree-longue:700ms`, `--courbe`), fondus (`.fondu-texte`, `.fondu-personnage`), voile (`--voile-opacite-texte-courant:0.85`). **Parité gardée** par `tests/tokens-parite.test.ts` : toute nouvelle var CSS doit exister dans `tokens.ts`. [Source: app/styles/tokens.ts, app/styles/globals.css]

### Architecture du streaming (le cœur de la Phase A)

```
Client (render/conversation/useFluxAnam.ts)
  fetch POST /api/anam/message  { messages:[{role:"user",content}], capacite:"echange" }
   │  body = ReadableStream (NDJSON)
   ▼
Route (app/api/anam/message/route.ts, runtime nodejs, force-dynamic)
  getUser() → extraireMessages() → creerAiPort()
  tier = tierPour("echange", 0)                    ← politique unique, SERVEUR
  diffuserSousEgressArt9({ supabase, adaptateur, requete })   ← gardes art.9 AVANT 1er octet
   │  si bloque → 403 egress_bloque_${raison}
   ▼  sinon AsyncIterable<EvenementIa>
  ReadableStream fait main :
    - plancher latence 400–900 ms avant le 1er delta
    - pour chaque {type:"delta"} → enqueue `{"t":"delta","c":…}\n`
    - {type:"fin"} → capter usage ; enqueue `{"t":"fin"}\n`
    - finally (fin propre OU request.signal aborted OU erreur) :
        usage_ia.upsert(on conflict do nothing, clé serveur)  ← exactement une fois
```

Le métrage **ne transite jamais** par le client. La clé d'idempotence est **serveur** (leçon revue 2.1 : une clé client était contournable).

### La politique de tier (le pur-domaine à durcir) — forme proposée

```ts
// lib/ai/politique-tier.ts
export type NiveauSecurite = 0 | 1 | 2 | 3;

/** Politique UNIQUE (AD-5). Appelée UNE fois par tour, côté serveur. */
export function tierPour(capacite: CapaciteIa, niveauSecurite: NiveauSecurite = 0): TierIa {
  if (niveauSecurite >= 1) return "fort"; // détresse → FORT forcé (détection ET réponse), jamais le léger
  return capacite === "echange" ? "leger" : "fort"; // reconceptualisation/synthese → fort
}
```
Invariants **mutation-testés** (Task A7) : `(echange,≥1)→fort` pour **tout** niveau ; la neutralisation de la garde `>=1` doit rougir un test.

### Faits techniques vérifiés (2026) — à appliquer, pas à redécouvrir

**Streaming client** (recherche 2026, sources docs Next/React + MDN) :
- `fetch` + `response.body.getReader()` + `new TextDecoder()` avec **`decode(value, { stream: true })`** (le flag `stream` évite de casser un caractère multi-octets à cheval sur deux chunks). Flush **par groupes de mots** = buffer + `lastIndexOf(" ")`, garder le mot en cours. **`useState`**, pas `use()`/Actions (inadaptés à des deltas successifs). `AbortController` au cleanup, **catcher `AbortError`** sans vider le texte. [Source: recherche — MDN Streams API, dev.to React 19 use()]
- Transport : **NDJSON** (une ligne JSON/événement) — permet de distinguer **fin propre vs interruption** sans lib. **Ne pas** utiliser `EventSource` (GET-only, pas d'en-têtes custom → incompatible POST authentifié). [Source: recherche — solovyov.net eventsource-post]

**A11y live-region** (recherche 2026) :
- **`aria-busy` toggling NON fiable** : NVDA ne dit rien quand `aria-busy` passe à `false` (**bug Mozilla #1682063**) ; une région `polite` remplie en continu peut être annoncée **au milieu**. **Solution fiable** : streamer hors live-region, puis écrire le message **complet en une fois** dans `aria-live="polite" aria-atomic="true"`. [Source: recherche — bugzilla.mozilla.org #1682063, adrianroselli.com 2026 live-region support]

**CSP nonce Next 16 + Turbopack** (recherche 2026, doc officielle Next à jour 2026-03) :
- Recette **`proxy.ts`** officielle : nonce `Buffer.from(crypto.randomUUID()).toString('base64')`, posé **sur requête (`x-nonce` + en-tête CSP) ET réponse**, lu via `(await headers()).get('x-nonce')`. **Sans le nonce sur la requête → écran blanc** (scripts d'hydratation RSC bloqués). Next nonce **automatiquement** ses propres scripts. `'unsafe-eval'` requis **en DEV** (React reconstruit les stacks). **SRI/hash** = webpack-only → **inutilisable sous Turbopack**. Le nonce **force le dynamique** (sans coût, on est déjà `force-dynamic`). **`cacheComponents` OFF** (bug #89754). `proxy` = **runtime Node uniquement**. [Source: recherche — nextjs.org/docs/app/guides/content-security-policy, github #89754/#89754]
- **Risque de régression auth** : à la migration middleware→proxy, **repropager les cookies de session** Supabase sinon **boucle de déconnexion**. [Source: recherche — dev.to nextjs-161-migration]

**Clavier mobile** (recherche 2026) :
- `dvh` **seul insuffisant** : le clavier ne rétrécit pas les unités viewport (**Chromium 40891557**). Combiner **`100dvh` + hook `visualViewport`** (`resize`+`scroll`, `height`+`offsetTop`). `interactive-widget=resizes-content` = surtout **Android** ; **iOS** repose sur `visualViewport` (le clavier « scrolle » la page sans changer le layout viewport, un `fixed bottom:0` peut être caché). Fallback `100svh`. [Source: recherche — Chromium 40891557, MDN VisualViewport]

**Mistral 2.5.0** (vérifié 2.1, inchangé) : `client.chat.stream({model,messages})` → `chunk.data.choices[0]?.delta?.content` ; usage dans le **dernier chunk**. **Stateless only**, ids datés `mistral-small-2603`/`mistral-large-2512`, **jamais `-latest`**. [Source: lib/ai/adapters/mistral.ts, story 2.1 recherche]

### Testing standards (résumé — détail en Tasks A7/B6)

- **Runner** vitest `4.1.10`, env node, `test.include: ["tests/**/*.test.ts"]`, alias `@`→racine, **`server-only` stubé** (`tests/_stubs/server-only.ts`). Timeouts SQL élargis (15000/20000). [Source: vitest.config.ts]
- **Env SQL réel** : `set -a && . ./.env.local && set +a && npx vitest run` (Vitest ne charge pas `.env.local`). Supabase local via CLI **globale v2.67.1**, **jamais `npx supabase`**. [Source: story 2.1]
- **Patrons de garde réutilisables** : `sansCommentaires()`/`fichiersTs()`/`imports()` de `tests/scene-architecture.test.ts` ; énumération de routes `tests/routes-art9-entetes.test.ts` ; a11y `tests/scene-accessibilite.test.ts` ; modèle pur `tests/scene-modele.test.ts` ; positif+négatif non tautologique `tests/privileges-fonctions.test.ts`. **Muter chaque garde.** [Source: tests/*]
- **Limite runtime DOM** : vitest est en env **node** (pas jsdom). Les composants React à interaction (composeur, streaming) se testent surtout par **logique pure extraite** (décision clavier, buffer word-groups, parsing NDJSON) + **gardes source/CSS**. Si un vrai test DOM est requis, signaler l'ajout d'un env jsdom localisé plutôt que basculer tout le runner.

### Project Structure Notes

- Nouveaux fichiers : `render/conversation/{Conversation,Fil,TourAnam,TourUtilisatrice,Composeur,ApparitionAnam,ImageAnam}.tsx`, `render/conversation/useFluxAnam.ts`, `render/conversation/conversation.module.css`. Migration `middleware.ts` → **`proxy.ts`** (racine). Étendre `lib/ai/{port,politique-tier,egress-guard,valider-messages}.ts`, `lib/ai/adapters/{mistral,factice}.ts`, `app/api/anam/message/route.ts`. Assets `public/scene/{presence,veille}/`.
- **kebab-case** fichiers, **PascalCase** composants/types, **français** métier (`diffuser`, `niveauSecurite`, `EvenementIa`), suffixe `Port`. `import type` obligatoire (`verbatimModuleSyntax`). Alias `@/*`. [Source: tsconfig.json, conventions repo]
- **AD-7 vérifié par test** : `render/conversation/**` ne touche ni `lib/ai` ni supabase ni `process.env` (il ne connaît que `fetch` vers `app/api/**`) ; `lib/scene/**` **reste pur**.
- **Une migration ? Non** : 2.2 **ne crée aucune table** (le fil est éphémère en session ; la persistance = Epic 4). Si un besoin de persistance émerge, c'est un **écart à signaler** (write-gate art. 9, AD-8), pas une décision de dev.

### Pièges connus / portes (deferred-work + revues)

- **Écran blanc CSP** : nonce absent sur la **requête** → hydratation RSC bloquée. Le piège n°1 de la recette. Tester la page réelle, pas seulement l'en-tête.
- **Boucle de déconnexion** à la migration proxy : repropager les cookies Supabase.
- **`aria-busy` seul** : bug NVDA — ne pas s'y fier pour l'annonce finale.
- **`dvh` seul** sur Android : composeur sous le clavier — hook `visualViewport` obligatoire.
- **Métrage falsifié / clé client** (leçon revue 2.1) : clé **serveur**, `modele` honnête, réconciliation `finally`.
- **Rôle `system` / tier / niveauSecurite injectés par le client** : rejet serveur strict (Task A6).
- **Turbopack « additional lockfile »** (parent `/Users/juliantalou/`) et **npm audit 5→9** : portes non bloquantes connues. [Source: deferred-work.md, story 2.1]
- **Open redirect `/auth/confirm`** : hors périmètre, ne pas aggraver.

### Leçons de revue à NE PAS répéter

1. **Une garde verte quand on casse ce qu'elle protège ne vaut rien** → **muter** chaque garde (A7/B6).
2. **Contrôle positif + négatif** (politique tier, egress streaming, métrage) — jamais un refus prouvé par le seul chemin positif.
3. **`server-only`** pour le chemin à clé ; le client ne connaît que `fetch`.
4. **Regex de garde larges** (nom brut du package + variable-clé), tous fichiers/blocs, source **sans commentaires**.
5. **Ne pas sur-vendre une protection** (2.1 : CSP inerte sur réponse API) — le verrou `connect-src` **effectif** est la CSP **de page**, livrée ici.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-2.2] — énoncé, 9 ACs, couverture FR-001/AD-5/NFR-012/NFR-014, note v1 micro déféré.
- [Source: ARCHITECTURE-SPINE.md] — AD-2, AD-3, AD-4, AD-5, AD-7, AD-13 ; Conventions Routes art. 9 & Métrage (ligne 153) ; Structural Seed ; Deferred (CSP nonce, tier complet).
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Anima-2026-07-21/EXPERIENCE.md] — Fil (146), Apparition (147), Surimpression (148), Signe (149), Mention IA (150), Porte secours (151), Composeur (152) ; States (170–188) ; Primitives (195) ; A11y (208–214) ; Rythme (297–301).
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Anima-2026-07-21/DESIGN.md] — personnage seuil/presence/veille (393–427), voile A/B + cibles chiffrées (437–464), mouvement/fondu/reduced-motion (466–477), tour-anam/utilisatrice (629–637), champ-saisie (639–641), focus (689–691), do/don't (704–716).
- [Source: _bmad-output/implementation-artifacts/2-1-frontiere-serveur-port-ia-egress-garde.md] — plomberie IA, patrons, décisions de revue.
- [Source: lib/ai/port.ts, politique-tier.ts, egress-guard.ts, fabrique.ts, adapters/*, entetes-art9.ts, valider-messages.ts] · [Source: app/api/anam/message/route.ts] · [Source: lib/scene/*, render/scene-dom.tsx, render/surimpression.tsx, render/monde.module.css] · [Source: app/styles/tokens.ts, globals.css] · [Source: middleware.ts, lib/data/supabase/middleware.ts, admin.ts].
- Recherche 2026 (à re-vérifier au besoin) : Next 16 CSP nonce `proxy.ts` (doc off. 2026-03) + bug #89754 ; MDN Streams/VisualViewport ; bug NVDA `aria-busy` (bugzilla #1682063) ; Chromium clavier viewport (40891557) ; Mistral 2.5.0 `chat.stream`.

## Dev Agent Record

### Agent Model Used

Opus 4.8 (1M context) — `claude-opus-4-8[1m]`.

### Debug Log References

- **Périmètre de la passe : PHASE A uniquement** (socle streaming serveur, Tasks A1→A7). Phases B (vue) et C (assets) **non commencées** — arrêt volontaire avant elles pour code-review + commit + `/compact`, à la demande de Julian.
- **Ligne de base** : 266/266 verts au commit `48918421` avant toute modification. **Après Phase A : 289/289** (+23 tests), tsc + eslint propres.
- **Mutation-testing des gardes (leçon revues 1.8/2.1)** — 6 mutations, chacune plantée puis vérifiée ROUGE, puis revertée ; tout revenu vert (26/26) :
  1. `politique-tier` — garde `niveauSecurite >= 1` neutralisée (`if(false)`) → `politique-tier.test.ts` rouge.
  2. `egress-guard` (flux) — garde consentement neutralisée dans `verifierGardesArt9` → `flux-anam-egress.test.ts` rouge (« révocation en vol »).
  3. `metrage` — `ignoreDuplicates: true → false` (idempotence cassée) → `metrage-flux.test.ts` rouge (« rejeu »).
  4. `frontiere-serveur` — réf `MISTRAL_ZDR_CONFIRMED` injectée dans `metrage.ts` (hors adapters) → `frontiere-serveur.test.ts` rouge.
  5. `routes-art9-entetes` — `application/x-ndjson → application/json` → test « répond en NDJSON » rouge.
  6. `routes-art9-entetes` — `const _tierClient = corps.tier` injecté dans la route → test anti-injection rouge.
- **Décision de conception (signalée, non cachée)** : `niveauSecurite` voyage sur `RequeteIa` (optionnel, **posé par le serveur**, défaut 0). Le client ne peut pas l'injecter (`extraireMessages` n'extrait que `messages[]` ; la route construit `capacite:"echange"` + `niveauSecurite:0` en dur). `tierPour(capacite, niveauSecurite)` reste **la seule** fonction de décision ; les adaptateurs l'appellent (une fonction, pas une logique dupliquée). Léger écart au libellé de la story (« adaptateurs reçoivent le tier résolu ») mais l'**esprit AD-5** est tenu : politique unique, résolue serveur, client ne choisit jamais.
- **Gardes d'egress factorisées** : `verifierGardesArt9` partagé par `envoyerSousEgressArt9` (completer) et `diffuserSousEgressArt9` (flux) → une seule définition des trois gardes, pas de dérive entre les deux chemins.
- **Métrage extrait** dans `lib/ai/metrage.ts` (`metrerUsageIa`) : testable en SQL réel, indépendamment du stream ; la route l'appelle dans un `finally` (fin propre, avortement `request.signal`, ou erreur → tous réconciliés, exactement une fois via la clé serveur).
- **Latence tenue** : plancher serveur `PLANCHER_LATENCE_MS = 500` (dans [400, 900]) retenu avant le 1er `delta` seulement. Timing réel non testé unitairement (flaky) ; la logique de plancher est isolée dans la route.

### Completion Notes List

**PHASE A implémentée et testée (289/289, tsc + eslint propres)** — le socle streaming serveur, entièrement exercé via l'adaptateur factice (aucune vraie clé Mistral) :

- **`AiPort.diffuser()` + `EvenementIa`** (A1) — union `delta`/`fin` ; le `fin` porte l'usage réel de fin de flux. `RequeteIa` gagne `niveauSecurite?` (serveur). [lib/ai/port.ts]
- **Politique de tier complète** (A2, AD-5) — `tierPour(capacite, niveauSecurite=0)` : `niveau ≥ 1 → fort` forcé pour toute capacité (détection ET réponse) ; sinon echange→léger, reconc/synthèse→fort. Résolue serveur, unique. [lib/ai/politique-tier.ts]
- **`diffuser()` sur les deux adaptateurs** (A3) — factice : streaming déterministe par groupes de 2 mots + `fin` (modele `"factice"`, honnête) ; Mistral : `chat.stream` stateless, usage du dernier chunk. [lib/ai/adapters/*]
- **Egress-guard streaming** (A4, AD-13) — `diffuserSousEgressArt9` : ZDR + consentement + barrière mineur **avant le 1er octet** (`async function*` non itéré si bloqué). Prouvé en SQL réel (positif + 3 négatifs, adaptateur-espion à zéro diffusion quand bloqué). [lib/ai/egress-guard.ts]
- **Route streaming NDJSON** (A5) — `ReadableStream` fait main (pas le paquet `ai`), plancher latence 400–900 ms, `{"t":"delta"}`/`{"t":"fin"}`/`{"t":"erreur"}`, tier/usage jamais envoyés au client, gestion de l'abandon (`request.signal`). [app/api/anam/message/route.ts]
- **Métrage exactement-une-fois** (A5, NFR-014) — `metrerUsageIa` réconcilié en `finally` (fin/avortement/erreur), clé d'idempotence **serveur**, `on conflict do nothing`. Montée en durabilité de la 2.1 (était best-effort). [lib/ai/metrage.ts]
- **Anti-injection** (A6) — le client ne peut poser ni `system`, ni `tier`, ni `niveauSecurite`, ni `capacite` (validation + construction serveur). Prouvé (runtime + garde statique sur la route).
- **Gardes CI** (A7) — 3 tests net-new (`politique-tier`, `flux-anam` + `flux-anam-egress`, `metrage-flux`), `routes-art9-entetes` + `frontiere-serveur` + `valider-messages` + `egress-guard` étendus. **6 mutations vérifiées rouges.**

**HORS de cette passe (Phase B / C, prochain cycle)** : la CSP nonce des pages (`proxy.ts`), le fil, le composeur, l'apparition d'Anam, le streaming client, les assets peints. La politique de tier consomme `niveauSecurite` mais rien ne le lève encore (producteur = Story 2.3).

### Revue de code (Phase A, ultrareview locale, 2026-07-27) — 5 angles, corrections appliquées

Revue adversariale (5 angles → convergence multi-angles + vérif contre le code réel). Presque tout se concentrait sur le **chemin de métrage** (plusieurs angles indépendants sur les mêmes lignes → forte confiance). Réfutations utiles : NDJSON non corruptible par `\n` (JSON.stringify échappe), gardes egress bien avant le 1er octet, l'abort coupe bien le flux Mistral amont.

**Corrigés (Phase A) :**
- **🔴 Métrage perdu en serverless** — l'écriture `usage_ia` s'exécutait **après `controller.close()`** → gelée/perdue sur Vercel. Déplacée dans **`after()`** (post-réponse, survit au gel). Restaure NFR-014 en prod.
- **🔴 Métrage malhonnête** — la route enregistrait `modelePour(tier)` (toujours un id Mistral) en **ignorant `fin.modele`**. Nouvelle fonction pure **`resoudreMetrage`** : le `fin` de l'adaptateur est la **source autoritaire** (factice → `"factice"`). Testée (`tests/metrage-resolution.test.ts`), mutation-vérifiée.
- **🟠 `fin` à 0 token** — garde faux-zéro dans `resoudreMetrage` (repli sur estimation si le fournisseur omet l'usage).
- **🟠 Delta Mistral `ContentChunk[]` perdu** — helper `extraireTexte` (gère `string` ET tableau de chunks) dans `mistral.ts`.
- **🟠 Tests de route = grep statique** — la décision de métrage est extraite en **fonction pure testée** (couvre honnêteté / faux-zéro / avortement / ligne fantôme). Garde route mise à jour (`after()`/`resoudreMetrage`).
- **🟡 Unité incohérente** (repli en caractères) → **`estimerTokens`** (≈ chars/4, unité token homogène) ; **ligne fantôme** sur échec d'ouverture → `resoudreMetrage` renvoie `null` (rien produit) ; **`metrerUsageIa` ne lève jamais** (try/catch, appelée dans `after()`).
- **🟡 Cadrage NDJSON** extrait dans `lib/ai/flux-ndjson.ts` + **verrou de non-régression `\n`** (`tests/ndjson.test.ts`).
- **⚪ Nettoyage** : helper `preparer` (tier/modele/messages) dans mistral + factice ; constante serveur unique `CAPACITE` (source unique tier/requête) ; `emettre`/`try` aplatis dans `start()`.

**Différés en Phase B (documentés, dépendent du client) :** déduplication d'un **retour client** (jeton de tour stable client, la clé serveur ne dédoublonne qu'une même clé) ; contrat client de la trame **`erreur`** (terminale, texte partiel + « Réessayer ») ; **test comportemental** complet de la route (avortement, plancher de latence) via un harness. [→ deferred-work.md]

**297/297 tests** (+8), tsc + eslint propres, 5 mutations re-vérifiées rouges.

### File List

**Nouveaux :**
- `lib/ai/metrage.ts` · `lib/ai/flux-ndjson.ts` *(revue)*
- `tests/politique-tier.test.ts` · `tests/flux-anam.test.ts` · `tests/flux-anam-egress.test.ts` · `tests/metrage-flux.test.ts`
- `tests/metrage-resolution.test.ts` · `tests/ndjson.test.ts` *(revue)*

**Modifiés :**
- `lib/ai/port.ts` (+ `EvenementIa`, `NiveauSecurite`, `diffuser()`, `RequeteIa.niveauSecurite`)
- `lib/ai/politique-tier.ts` (politique complète `(capacité, niveau_sécurité) → tier`)
- `lib/ai/adapters/factice.ts` · `lib/ai/adapters/mistral.ts` (+ `diffuser()`)
- `lib/ai/egress-guard.ts` (+ `diffuserSousEgressArt9`, `ResultatEgressFlux`, `verifierGardesArt9` factorisé)
- `app/api/anam/message/route.ts` (POST → streaming NDJSON + métrage réconcilié)
- `tests/routes-art9-entetes.test.ts` · `tests/valider-messages.test.ts` · `tests/egress-guard.test.ts` (étendus 2.2)

**Non modifié mais consommé :** `lib/ai/valider-messages.ts`, `lib/ai/entetes-art9.ts`, `lib/data/supabase/admin.ts`, `supabase/migrations/0008_usage_ia.sql`.

## Change Log

| Date | Version | Description | Author |
|---|---|---|---|
| 2026-07-27 | 0.1 | Story créée (context engine : epic 2.2, SPINE AD-5/AD-7/AD-2/13, specs UX conversation/apparition/composeur, cartographie code 2.1+scène 1.7/1.8, recherche 2026 Next 16 CSP nonce / streaming React 19 / a11y live-region / clavier mobile). Deux phases (socle serveur / vue) + assets Gemini. | Create-Story |
| 2026-07-27 | 0.2 | **Phase A** implémentée (Tasks A1→A7) : `diffuser()` + `EvenementIa`, politique de tier complète AD-5, streaming sur les 2 adaptateurs, egress-guard flux, route NDJSON + métrage réconcilié exactement-une-fois, anti-injection, 3 gardes net-new + 4 étendues, 6 mutations vérifiées. 289/289 tests, tsc + eslint propres. Phases B/C à suivre. | Dev-Story |
| 2026-07-27 | 0.3 | **Revue de code Phase A** (5 angles adversariaux) : corrigés — métrage perdu en serverless (→ `after()`), métrage malhonnête (→ `resoudreMetrage`, `fin` autoritaire), garde faux-zéro, delta `ContentChunk[]`, unité token homogène, ligne fantôme, `metrerUsageIa` non-levant, cadrage NDJSON verrouillé, nettoyages. 297/297 tests, tsc + eslint propres, 5 mutations re-vérifiées. Différés Phase B : idempotence retour-client, contrat trame `erreur`, test comportemental route. | Code-Review |
