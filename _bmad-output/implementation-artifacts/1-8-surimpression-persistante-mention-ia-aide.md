---
story_key: "1-8-surimpression-persistante-mention-ia-aide"
epic: 1
story: 8
title: "La surimpression persistante — mention IA et porte de secours"
epic_name: "Franchir le seuil"
covers: [FR-013, FR-077, AD-9, AD-15, AD-7, AD-10, NFR-007, NFR-015]
depends_on:
  - "1-7-entrer-scene-2d-continue-sans-bord"
  - "1-5-consentement-art9-declaration-ia"
status: done
baseline_commit: 2f7dc1a67d6cd627acb0059f2b50115d78582303
created: "2026-07-24"
sources:
  - _bmad-output/planning-artifacts/epics.md#epic-1--story-1-8
  - _bmad-output/planning-artifacts/architecture/architecture-Anima-2026-07-22/ARCHITECTURE-SPINE.md#ad-9
  - _bmad-output/planning-artifacts/architecture/architecture-Anima-2026-07-22/ARCHITECTURE-SPINE.md#ad-15
  - _bmad-output/planning-artifacts/architecture/architecture-Anima-2026-07-22/ARCHITECTURE-SPINE.md#ad-7
  - _bmad-output/planning-artifacts/ux-designs/ux-Anima-2026-07-21/EXPERIENCE.md#component-patterns
  - _bmad-output/planning-artifacts/ux-designs/ux-Anima-2026-07-21/DESIGN.md
  - _bmad-output/planning-artifacts/prds/prd-Anima-2026-07-21/prd.md#fr-013-fr-077
---

# Story 1.8 : La surimpression persistante — mention IA et porte de secours

Status: done

<!-- Note : validation optionnelle. Lancer validate-create-story avant dev-story pour un contrôle qualité. -->

## Story

En tant qu'**utilisatrice**,
je veux **qu'une surimpression discrète et sans bord flotte en permanence sur la scène — portant, en conversation, le signe d'Anam et la mention « Anam est une IA », et partout une porte de secours vers l'aide**,
afin que **la transparence (je sais toujours que je parle à une machine) et le filet de sécurité (je peux toujours atteindre de l'aide) soient à portée, quelle que soit la région, sans jamais dépendre d'une détection**.

**Sous le capot (l'enjeu de fond, pour le dev) :** cette story pose deux invariants qui ne se négocient jamais — la **mention IA persistante** (FR-013, AI Act art. 50, applicable au 2 août 2026) et la **porte de secours toujours joignable, indépendante de toute détection** (FR-077, AD-9/AD-15). Le piège serait de traiter ça comme « du CSS dans le rendu ». Ce n'en est pas : *quels* éléments la surimpression porte selon la région est une **règle légale/de sécurité**, pas une décision de pixels — elle vit donc dans le **modèle** (`lib/scene/`, AD-7), et `render/` reste **muet** (il dessine ce que le modèle décide). Un futur adaptateur WebGL (v2) doit hériter de la mention IA et de la porte de secours **sans qu'on ait à y repenser**. C'est la première story « frontière art. 50/§5 dans le visible » : bâclée, elle expose l'app à un manquement réglementaire et à un trou dans le filet de sécurité.

## Acceptance Criteria

1. **Étant donné** n'importe quelle région de la scène **Quand** elle est affichée **Alors** la **surimpression persistante** flotte **sans bord, sans fond barré (`surface`), sans filet (`bordure`), sans bande** — sa lisibilité est tenue par le **voile** (`{components.voile}`, jamais une barre) — **Et** elle porte la **porte de secours « Aide »** vers `/aide`, **toujours au même endroit**, **jamais** masquée, repliée derrière un accordéon, ni dissoute au défilement. *(FR-077, AD-9/AD-15 ; UX-DR-18 ; EXPERIENCE §Component Patterns L148/L151 ; epics AC L511)*

2. **Étant donné** la région de conversation (`anam`) **Quand** elle est affichée **Alors** la surimpression porte **aussi** le **signe d'Anam** et la **mention « Anam est une IA »**, cette mention étant un **lien vers la page de transparence** (`/aide`) — présente sur **toute** la région de conversation (FR-013, AI Act art. 50), **jamais sous 13px** (rôle `meta`), **jamais posée sur imagerie sans voile ni zone protégée**, jamais dissoute dans le flux. **Et** hors conversation, seule la porte de secours demeure (ni signe, ni mention). *(FR-013, NFR-007 ; UX-DR-19 ; EXPERIENCE L150, DESIGN L663 ; epics AC L513)*

3. **Étant donné** la porte de secours **Quand** l'utilisatrice la suit **Alors** `/aide` est une **page statique** atteignable **sans compte, sans paywall, sans traceur** (AD-15, NFR-002), **connectée ou non**, **indépendamment de toute détection** (FR-077) — **Et** elle est joignable **en deux gestes** (un déplacement au clavier + une activation) et **au plus deux arrêts de tabulation** depuis l'entrée de la scène, **sans traverser la scène** (doublage non-spatial, UX-DR-37). *(FR-077, AD-15 ; UX-DR-20 ; EXPERIENCE L216/L429/L430 ; epics AC L515)*

4. **Étant donné** la porte de secours **Quand** elle est rendue **Alors** c'est un **simple mot « Aide »** en `{typography.meta}` sur `{colors.texte-doux}`, fond transparent — **jamais `{colors.alerte}`, jamais de rouge, jamais une pastille, jamais un pictogramme d'alerte, jamais une majuscule** (`text-transform` interdit), **jamais un `outline: none`**. *(FR-077, AD-9 ; UX-DR-20 ; EXPERIENCE L151 ; epics AC L517)*

5. **Étant donné** la séparation modèle/rendu (AD-7) **Quand** on décide *quels* éléments la surimpression porte selon la région **Alors** cette décision vit dans un **modèle pur** (`lib/scene/`, sans React/Next/DOM), la **porte de secours y est inconditionnelle** (type garanti toujours présent) et la **mention IA/le signe** ne s'y activent que sur la région de conversation — **Et** `render/` **consomme** ce modèle sans porter aucune règle métier/légale (dépendance `render/ → lib/scene/`, jamais l'inverse — AD-10). *(AD-7, AD-10 ; SPINE L69/L84)*

6. **Étant donné** `prefers-reduced-motion: reduce` **Quand** l'utilisatrice change de région **Alors** l'apparition/disparition du signe et de la mention est **instantanée** (aucun fondu, aucun « stagger », aucun épaississement animé du signe) — la surimpression reste **constante et lisible**, jamais « dissoute ». *(AC4/AC6 de la 1.7 ; UX-DR-38 ; DESIGN §Mouvement L213)*

> **Périmètre — ce que 1.8 NE fait PAS** (garde-fous de scope) :
> - **Pas** la marque « Anam » (mot-marque en `surtitre` à gauche + glyphe de menu à droite) : c'est une **autre** surimpression, sans AC ici → hors périmètre. La cible de tabulation d'AC3 est tenue en plaçant la porte de secours **tôt dans le DOM**, pas en construisant la marque ni le menu de compte.
> - **Pas** le **comportement animé** du signe d'Anam (épaississement « Anam prépare », 3 beats de présence) → **Epic 2 / Story 2.1**. Ici : un **signe placeholder statique**, sobre, remplaçable.
> - **Pas** le **bloc ressources formalisé** de `/aide` (fiches `surface-elevee` + `bordure-forte`, date « vérifié le … », revue périodique FR-044, adaptation aux niveaux 2-3, **sortie rapide** FR-074, garde `limites_levees`) → **Story 2.5** (FR-043/044, UX-DR-29). Ici : `/aide` **existe, est publique et réelle** (les numéros essentiels en `tel:` + doublage vocal par chiffre), la mise en forme « fiche » et la gouvernance de vérification arrivent en 2.5.
> - **Pas** le **vrai visuel d'Anam** (asset Claude Design, prochain à produire) → placeholder abstrait en attendant, remplaçable en une passe (comme le favicon 1.7).
> - **Pas** une nouvelle route protégée : `/aide` reste **hors de toute garde** d'auth/onboarding.

## Tasks / Subtasks

- [x] **Tâche 1 — Le modèle : *quels éléments la surimpression porte selon la région* (pur, `lib/scene/`)** (AC : 2, 5)
  - [x] `lib/scene/regions.ts` — ajouter la **source unique** de la région de conversation (ne pas coder `"anam"` en dur ailleurs) :
    ```ts
    /** La région où vit la conversation avec Anam (porteuse de la mention IA légale, FR-013). */
    export const REGION_CONVERSATION: IdRegion = "anam";
    ```
  - [x] `lib/scene/surimpression.ts` (NOUVEAU) — modèle pur. La **porte de secours est inconditionnelle** (type littéral `true` → impossible à construire à `false`) ; le **signe** et la **mention IA** ne s'activent que sur la région de conversation. Contrat proposé :
    ```ts
    import { REGION_CONVERSATION, type IdRegion } from "./regions";

    /**
     * Ce que la surimpression persistante porte, PAR région (AD-7 : décision de MODÈLE,
     * pas de rendu). La porte de secours est TOUJOURS présente (FR-077, AD-9/AD-15) —
     * garantie au type. Le signe d'Anam et la mention IA (FR-013, art. 50) ne paraissent
     * que sur la région de conversation.
     */
    export interface Surimpression {
      /** Toujours vraie, partout, indépendante de toute détection (FR-077, AD-9/AD-15). */
      readonly porteSecours: true;
      /** Présence d'Anam → seulement en conversation. */
      readonly signeAnam: boolean;
      /** « Anam est une IA », légalement requise sur la conversation (FR-013, art. 50). */
      readonly mentionIA: boolean;
    }

    export function surimpressionPour(region: IdRegion): Surimpression {
      const enConversation = region === REGION_CONVERSATION;
      return { porteSecours: true, signeAnam: enConversation, mentionIA: enConversation };
    }
    ```
  - [x] `lib/scene/index.ts` — exporter le nouveau module (`export * from "./surimpression";`).
  - [x] La cible du lien est une **constante d'URL partagée** (évite les fautes de frappe) : `export const URL_AIDE = "/aide";` (dans `surimpression.ts` ou un petit `lib/scene/liens.ts`). `render/` l'importe, ne réécrit pas la chaîne.

- [x] **Tâche 2 — Le rendu : la surimpression flottante, sans bord, voile-portée (`render/`)** (AC : 1, 2, 4, 5, 6)
  - [x] `render/surimpression.tsx` (NOUVEAU) — composant `"use client"` **muet** : reçoit `{ modele: Surimpression }`, dessine dans cet ordre le **signe d'Anam** (si `signeAnam`), la **mention IA** (si `mentionIA`, lien vers `URL_AIDE`), la **porte de secours** « Aide » (toujours, lien vers `URL_AIDE`, alignée à droite). Aucune logique métier, aucun `process.env`, aucun accès infra. Aucun élément autre que ces trois n'y entre.
  - [x] Câbler dans `render/scene-dom.tsx` : calculer `const surimpression = surimpressionPour(region);` et rendre `<Surimpression modele={surimpression} />` **en tout premier enfant** de `<main className={s.monde}>` (avant le ciel/les régions) → la porte de secours devient le **premier arrêt de tabulation**, hors des régions `inert` (AC3). La surimpression n'est **jamais** dans une section `inert`.
  - [x] `render/monde.module.css` — styles de la surimpression :
    - **Flottante, sans bord** : `position: absolute` (ancrée en haut de `.monde`, `inset: 0 0 auto 0`), `pointer-events: none` sur le conteneur + `pointer-events: auto` sur les liens (le reste de la scène reste cliquable dessous). **Interdits** : `background: var(--surface*)`, `border`, `box-shadow` façon barre. `z-index` au-dessus des régions.
    - **Lisibilité par le voile** (pas une barre) : un **voile en dégradé** derrière la zone de texte, réutilisant le mécanisme 1.7 — `--voile-couleur: var(--fond)` composité à `var(--voile-opacite-texte-courant)` (0.85), fondu **uniquement** en marge, jamais un aplat fermé. Réutiliser/factoriser la logique de `.voile-seuil` (globals.css) plutôt que réinventer.
    - **Porte de secours** : `.t-meta` (13px) sur `color: var(--texte-doux)`, `background: transparent`, `text-transform: none`, **aucun** `var(--alerte)`/rouge/pastille/icône. `outline: 2px …` au focus (jamais `outline: none`).
    - **Mention IA** : `.t-meta` (≥ 13px, jamais réduit), lien souligné/discret vers `/aide`.
    - **Signe d'Anam (placeholder)** : petit fragment abstrait (SVG inline ou glyphe tronc/branche, teinté `--arbre-branche`/`--accent`), **statique**, `aria-hidden` (décoratif ; la présence sémantique passe par la mention IA). Aucune animation (l'épaississement est différé Epic 2).
    - **Reduced-motion / jamais dissoute** : le contenu de la surimpression **change instantanément** avec la région (aucune `transition` d'opacité sur ces slots) → jamais de fondu qui la « dissoudrait » (AC1/AC6). Ne rien ajouter au `@media (prefers-reduced-motion: reduce)` existant pour ces éléments (ils n'animent pas).
  - [x] La surimpression **suit le défilement** et reste visible sur toutes les régions (elle n'appartient à aucune région ; c'est une couche constante).

- [x] **Tâche 3 — La page `/aide` : statique, publique, réelle (`app/aide/`)** (AC : 2, 3)
  - [x] `app/aide/page.tsx` (NOUVEAU) — **Server Component statique**, sur le patron de `app/cgu/page.tsx`. **Aucun** appel d'auth/session (pas de `createSupabaseServerClient`, pas de `getUser`), **aucun** traceur → publique, atteignable connectée ou non (AC3). `export const metadata = { title: "Anam" };` (identité de route, garde `identite-route.test.ts`).
  - [x] Contenu — deux zones claires, sobres, voix Anam (tutoiement, zéro emoji, zéro exclamation, zéro lexique médical/« soin ») :
    1. **Transparence (cible de la mention IA)** : reprendre la déclaration art. 50 en français courant de `app/(auth)/consentement/page.tsx` (Anam est une IA, opérée par un prestataire ; ni médical ni psychologique). C'est là qu'atterrit le lien « Anam est une IA ».
    2. **Filet de sécurité (réel dès maintenant)** : bloc ressources **statique** et **non alarmant** — **3114** (prévention du suicide), **15 / 112** (urgence vitale), **3919** (violences faites aux femmes), **119** (enfance en danger), **SOS Amitié** (écoute). Numéros en lien `tel:` avec **doublage vocal chiffre par chiffre** (`aria-label="3 1 1 4"`). *Pas* de rouge, *pas* de modale, *pas* de bloc bloquant.
  - [x] `app/aide/aide.module.css` (NOUVEAU, ou réutiliser le patron `cgu.module.css`) — sobre, lisible, sans alerte.
  - [x] **Note de scope à laisser dans le fichier** : la mise en forme « fiche » (`surface-elevee` + `bordure-forte`), la date « vérifié le … », la revue périodique (FR-044), l'adaptation aux niveaux 2-3, la **sortie rapide** (FR-074) et la garde `limites_levees` sont **Story 2.5** — 1.8 livre la version statique atteignable et réelle.

- [x] **Tâche 4 — Les gardes (tests) : légal + sécurité + frontière, prouvés par fichier** (AC : 1-6)
  - [x] `tests/scene-surimpression.test.ts` (NOUVEAU, env node — modèle pur) :
    - `porteSecours === true` pour **chaque** `IdRegion` (boucle sur `CATALOGUE_REGIONS`, seuil inclus) → la porte de secours est **inconditionnelle**.
    - `mentionIA` **et** `signeAnam` sont `true` **uniquement** pour `REGION_CONVERSATION`, `false` partout ailleurs.
    - `REGION_CONVERSATION` est une région connue (`estRegion(REGION_CONVERSATION)`), c'est une **destination directe** (atteignable au clavier), et vaut `"anam"`.
    - Pureté : appeler `surimpressionPour` deux fois ne mute rien ; l'objet est cohérent.
  - [x] `tests/surimpression.test.ts` (NOUVEAU, env node — garde CSS/rendu par lecture de fichier, comme `voile.test.ts`/`scene-accessibilite.test.ts` ; **strip commentaires** avant de matcher) :
    - **Sans bord** : le(s) sélecteur(s) de la surimpression n'emploie(nt) **ni** `background: var(--surface`, **ni** `border:` avec `--bordure`, **ni** `text-shadow:`.
    - **Voile** : la zone de texte consomme `var(--fond)` / `var(--voile-opacite-texte-courant)` (lisibilité portée par le voile, pas une barre).
    - **Contraste (compositing, pire cas image blanche)** : composer `--fond` à `voile.opaciteTexteCourant` sur `#FFFFFF`, puis `ratioContraste(sousVoile, texte-doux) ≥ 4.5` **et** `≥ 4.5` pour `texte` (réutiliser l'helper `composer` de `voile.test.ts`).
    - **Porte de secours** : couleur = `--texte-doux`, **jamais** `--alerte`/rouge, `text-transform` **jamais** `uppercase`, taille `meta` (≥ 13px), focus `outline: 2px` (jamais `outline: none`).
    - **Mention IA** : jamais rendue sous 13px (pas de `font-size` réduisant `meta` sur ces éléments).
    - **Câblage** : `render/scene-dom.tsx` importe `surimpressionPour`/`Surimpression` depuis `@/lib/scene` (frontière `render/ → lib/scene/`) et rend la surimpression **hors** des sections `inert`.
  - [x] `tests/aide-route.test.ts` (NOUVEAU, ou étendre `identite-route.test.ts`) :
    - `app/aide/page.tsx` existe, `title: "Anam"` (déjà couvert par la garde d'identité, la vérifier).
    - **Publique/sans traceur** : `app/aide/page.tsx` **n'importe pas** `@/lib/data/supabase/*` et n'appelle **pas** `getUser`/`auth` (preuve « sans compte, indépendante de toute détection », AC3).
    - Le patron `/aide` ⇒ chaîne `URL_AIDE = "/aide"` bien la cible des deux liens (porte de secours + mention IA).
  - [x] La garde **existante** `tests/scene-architecture.test.ts` couvre déjà automatiquement la **pureté** de `lib/scene/surimpression.ts` (aucun import react/next/render/infra) et le **mutisme** de `render/surimpression.tsx` — **vérifier** qu'elle passe (elle scanne les dossiers entiers).

- [x] **Tâche 5 — Validation complète + journal** (AC : 1-6)
  - [x] `npx tsc --noEmit` (0 erreur, strict), `npm run lint` (0 erreur), build Turbopack OK.
  - [x] Tests : `set -a && . ./.env.local && set +a && npx vitest run` — **tous** verts (188 : 160 de base + 28 nouveaux). *(Rappel : Vitest ne charge pas `.env.local` seul.)*
  - [x] **Vérif manuelle** — le build marque `/aide` en `○ (Static)` (prérendue, donc sans session/auth → publique, AC3) ; la surimpression est rendue **premier enfant** de `.monde` hors `inert` (porte de secours = 1ᵉʳ arrêt de tabulation) ; les slots signe/mention n'ont **aucune** transition (jamais dissous, reduced-motion sûr). *Reste un coup d'œil visuel en navigateur recommandé pour Julian (voir Completion Notes).*
  - [x] Mettre à jour **File List**, **Change Log**, **Completion Notes**, puis passer **Status → review** (le code-review clôturera en `done`).

## Dev Notes

### Ce qui EXISTE déjà — à RÉUTILISER, ne pas réinventer

- **Le modèle de scène pur** [lib/scene/](lib/scene/) : [regions.ts](lib/scene/regions.ts) (`IdRegion`, `CATALOGUE_REGIONS`, `REGIONS`, `REGION_ENTREE`, `estRegion`), [vue.ts](lib/scene/vue.ts) (`reducteurVue`, view-state), [projection.ts](lib/scene/projection.ts) (`projectionInitiale`, `eveil`), barrel [index.ts](lib/scene/index.ts). **Ajouter** `surimpression.ts` + `REGION_CONVERSATION` **sans** rien casser.
- **L'hôte du view-state** [render/scene-dom.tsx](render/scene-dom.tsx) : c'est LUI qui connaît `region` (via `useReducer(reducteurVue)`). La surimpression se calcule à partir de `region` et se rend en **premier enfant** de `<main className={s.monde}>`. Ne pas dupliquer la source du view-state.
- **Le voile de lisibilité** : `.voile-seuil` dans [app/styles/globals.css](app/styles/globals.css) + tokens `voile.opaciteTexteCourant` (0.85) dans [tokens.ts](app/styles/tokens.ts). C'est LE mécanisme « lisibilité sans barre » — la surimpression réutilise la même idée (dégradé `--fond`, jamais un aplat fermé). L'helper de compositing de [tests/voile.test.ts](tests/voile.test.ts) se réutilise tel quel.
- **Le patron « page statique »** [app/cgu/page.tsx](app/cgu/page.tsx) : `s.page`/`s.contenu`, classes typo globales `t-surtitre`/`t-titre`/`t-titre-sm`/`t-corps`/`t-meta`, `metadata = { title: "Anam" }`. `/aide` le calque.
- **La déclaration art. 50** dans [app/(auth)/consentement/page.tsx](app/(auth)/consentement/page.tsx) (bloc « Déclaration IA — FR-013 / AI Act art. 50 ») : reprendre le ton/le fond pour la zone transparence de `/aide`.
- **Les gardes d'architecture** [tests/scene-architecture.test.ts](tests/scene-architecture.test.ts) (pureté modèle + mutisme rendu), [tests/identite-route.test.ts](tests/identite-route.test.ts) (title « Anam » sur toutes les routes) : elles **scannent les dossiers entiers** → les nouveaux fichiers sont couverts d'office.

### Décision technique n°1 — La composition de la surimpression est du MODÈLE (le cœur d'AD-7 ici)

Le réflexe naïf serait d'écrire `{region === "anam" && <MentionIA/>}` **dans le rendu**. C'est un **défaut AD-7** : la règle « la conversation exige la mention IA » est une **obligation légale** (art. 50), pas un choix de dessin ; « la porte de secours est partout » est un **invariant de sécurité** (AD-9/AD-15). Ces deux vérités doivent survivre à une réécriture du rendu (WebGL v2). Donc : `lib/scene/surimpression.ts` **décide** (`surimpressionPour(region) → {porteSecours, signeAnam, mentionIA}`), `render/` **dessine**. Le type `porteSecours: true` (littéral, pas `boolean`) rend l'omission de la porte de secours **impossible à compiler** — c'est voulu.

**Pourquoi `lib/scene/` et pas `lib/safety/` ?** `lib/safety/` est le pipeline serveur (détection de détresse, haltes, garde `limites_levees`) — logique serveur, jamais dans le bundle client. La *composition visuelle par région* est une projection **de scène**, pure et consommée par le client. `lib/scene/` est déjà la maison des régions et est déjà importée par `render/`. La porte de secours de la surimpression **n'est pas** la détection de détresse : elle en est justement **indépendante** (FR-077). (Le drapeau serveur `limites_levees` et le bloc ressources adaptatif, eux, viendront en `lib/safety/` — Story 2.5.)

### Décision technique n°2 — « Sans bord » **et** « lisible sur imagerie » = le voile, pas une barre

Contradiction apparente entre AC1 (« sans fond barré, sans filet, sans bande ») et « jamais de texte sur imagerie sans voile » (AC2). Résolution : le **voile est un dégradé doux** (scrim), pas un aplat fermé ni une bordure. `.voile-seuil` (1.7) en est la preuve vivante : `linear-gradient` de `--fond` à 0.85 qui se fond en marge. La surimpression fait pareil derrière sa zone de texte. Ce n'est **ni** `background: var(--surface)` (interdit), **ni** `border` (interdit), **ni** une bande pleine : c'est une présence flottante dont seul le texte est garanti lisible. La preuve de contraste se fait **par compositing** (pire cas = image blanche), comme `voile.test.ts` — pas par un `text-shadow` (interdit).

### Décision technique n°3 — `/aide` publique = zéro garde, zéro session, zéro traceur

`middleware.ts` ne protège **aucune** route (il ne fait que rafraîchir la session). La seule garde d'accès est dans `app/page.tsx` (la scène, derrière l'onboarding). Donc `app/aide/page.tsx`, en **Server Component statique sans appel d'auth**, est publique **par construction** — atteignable connectée ou non (AC3). **Ne pas** y lire la session, **ne pas** y router selon l'état, **ne pas** y ajouter de traceur. La garde `aide-route.test.ts` verrouille l'absence d'import `@/lib/data/supabase/*` et de `getUser`.

### Piège n°1 — La mention IA « sous 13px » et le rôle `meta`

`meta` = Inter **13px** (0.8125rem), soit **exactement** le plancher (`reglesTypo.tailleMinRem`). C'est conforme (« jamais **sous** 13px »), mais **tendu** : ne rien appliquer qui réduise `meta` sur ces éléments (pas de `font-size: smaller`, pas de `%` < 100 hérité). `surtitre` (12px) est **interdit** ici (c'est l'exception « zone protégée/aplat », pas un voile en dégradé). La garde `surimpression.test.ts` vérifie l'absence de réduction.

### Piège n°2 — « Jamais dissoute au défilement / dans le flux »

Trois façons de rater AC1/AC2 : (a) mettre la surimpression **dans** une région (elle disparaîtrait au changement de région) → elle doit être un **enfant direct de `.monde`, hors régions** ; (b) lui coller une `transition: opacity` qui la ferait « fondre » → **aucune** transition sur ses slots (apparition/disparition instantanée) ; (c) la rendre `position: sticky` dans un conteneur `overflow` qui la masquerait → `position: absolute/fixed` sur `.monde`, `z-index` au-dessus. Elle **suit** le défilement, ne se **replie** pas, ne se **remplace** pas.

### Piège n°3 — Le focus et l'ordre de tabulation (AC3)

La 1.7 déplace le focus vers l'entête de la **région activée** (`entetes.current[region]?.focus()`). La surimpression ne doit **pas** entrer en conflit : elle n'est pas une région, elle ne vole pas le focus au montage. Pour AC3 (« deux arrêts de tabulation, sans traverser la scène »), la porte de secours doit être **tôt dans le DOM** (premier enfant de `.monde`) et **hors** de tout `inert`. Vérifier au clavier : depuis l'arrivée sur la scène, `Tab` atteint « Aide » en premier. Les liens de la surimpression ont `pointer-events: auto` même si le conteneur est `pointer-events: none`.

### Piège n°4 — Le signe d'Anam n'existe pas encore comme asset

Le vrai visuel d'Anam est le **prochain asset Claude Design** de Julian (pas encore produit). En 1.8, le signe est un **placeholder abstrait statique** (fragment tronc/branche teinté, cohérent avec le favicon 1.7), `aria-hidden` (décoratif). Sa **sémantique** de transparence est portée par la **mention IA** (le texte + le lien), pas par le glyphe. L'épaississement animé (« Anam prépare ») est **Epic 2 / Story 2.1** — ne pas l'implémenter. Le remplacement du placeholder par l'asset final devra être une **passe isolée** (un seul composant).

### Conflits inter-docs — DÉJÀ tranchés (à ne pas rouvrir)

- **Cible du lien « Anam est une IA »** : `/aide`. Le modèle de régions ne compte **qu'une** région « transparence / aide » (EXPERIENCE L62) qui résout à `/aide` ; aucune route `/transparence` n'existe (revoquer/page.tsx L15). La déclaration art. 50 **primaire** vit déjà sur la halte de consentement (1.5) **et** dans la mention persistante elle-même (DESIGN L663 : « la mention-ia persistante reste le porteur littéral de la transparence ») — la page liée est l'**élaboration**, portée par `/aide` (zone transparence). *(Alternative « page `/transparence` dédiée » : voir Questions au dev, en bas.)*
- **Anam a un visage** (DESIGN L295) : revirement assumé vs l'ancienne charte « sans visage ». La transparence ne repose plus sur l'absence de figure mais sur (1) rendu **peint, jamais photoréaliste** et (2) la **mention IA persistante**. En 1.8, seul (2) est en jeu.

### Accessibilité — le socle (AC2/AC3/AC4/AC6), rappel opérationnel

- Liens à **nom accessible clair** : « Aide », « Anam est une IA ». Numéros `/aide` en `tel:` + `aria-label` **chiffre par chiffre**.
- Anneau de focus **visible et jamais supprimé** (`outline: 2px`, jamais `outline: none`) — garde héritée de `scene-accessibilite.test.ts`.
- Contraste **WCAG 2.2 AA ≥ 4.5:1** prouvé **par calcul** (compositing), pas à l'œil.
- `prefers-reduced-motion` : surimpression **instantanée**, jamais de fondu.
- Rien porté par la **seule** couleur/position/mouvement : « Aide » et « Anam est une IA » sont **du texte**.

### Project Structure Notes

- **Nouveaux** : `lib/scene/surimpression.ts`, `render/surimpression.tsx`, `app/aide/page.tsx`, `app/aide/aide.module.css`, `tests/scene-surimpression.test.ts`, `tests/surimpression.test.ts`, `tests/aide-route.test.ts`.
- **Modifiés** : `lib/scene/regions.ts` (+`REGION_CONVERSATION`), `lib/scene/index.ts` (+export), `render/scene-dom.tsx` (+câblage surimpression), `render/monde.module.css` (+styles surimpression). Éventuellement `tests/identite-route.test.ts` si on y adosse la vérif `/aide` plutôt qu'un fichier dédié.
- **Cohérent avec le seed SPINE** : `app/aide/` (L181, « halte ressources : sans compte, sans traceur »), `lib/scene/` (modèle), `render/` (adaptateur muet). Aucune variance.
- **Aucune** dépendance nouvelle (npm), **aucune** migration SQL, **aucun** appel réseau/IA (frontière serveur intacte).

### References

- Story & AC : [epics.md](_bmad-output/planning-artifacts/epics.md) L503-L517 (Story 1.8) ; L207-L210 (UX-DR-18/19/20) ; L219 (UX-DR-29, → 2.5).
- Invariants : [ARCHITECTURE-SPINE.md](_bmad-output/planning-artifacts/architecture/architecture-Anima-2026-07-22/ARCHITECTURE-SPINE.md) AD-9 (L76-79), AD-15 (L125-128), AD-7 (L66-69), AD-10 (L81-84), seed `app/aide/` (L181).
- Exigences : [prd.md](_bmad-output/planning-artifacts/prds/prd-Anima-2026-07-21/prd.md) FR-013 (L77), FR-077 (L142), FR-044 (L136, → 2.5), NFR-007 art. 50 (L245), NFR-002.
- UX/visuel : [EXPERIENCE.md](_bmad-output/planning-artifacts/ux-designs/ux-Anima-2026-07-21/EXPERIENCE.md) L84-85 (surimpressions), L148-151 (Component Patterns), L216/L429-430 (accès `/aide`), L209/L213 (a11y) ; [DESIGN.md](_bmad-output/planning-artifacts/ux-designs/ux-Anima-2026-07-21/DESIGN.md) L511 (`meta` 13px), L663 (mention-ia porteur de transparence), L295 (Anam a un visage).
- Story précédente : [1-7-entrer-scene-2d-continue-sans-bord.md](_bmad-output/implementation-artifacts/1-7-entrer-scene-2d-continue-sans-bord.md) (frontière modèle/rendu, voile, gardes).

## Questions au dev (tranchées par Julian avant l'implémentation)

1. **Cible de « Anam est une IA »** → **`/aide`** (RETENU). Une section « transparence » (ancre `#transparence`) sur `/aide`.
2. **Ressources dans `/aide` dès 1.8** → **oui, incluses** (RETENU) : numéros essentiels en `tel:` statiques ; mise en forme « fiche » + gouvernance de vérification → Story 2.5.
3. **Signe d'Anam placeholder** → **oui** (RETENU) : fragment abstrait statique, remplacé en une passe isolée quand l'asset Claude Design « Anam » sera prêt.

## Dev Agent Record

### Agent Model Used

Opus 4.8 (1M context) — `claude-opus-4-8[1m]`

### Debug Log References

- Red→green modèle : `tests/scene-surimpression.test.ts` a d'abord échoué (7/7, `surimpressionPour is not a function`) avant l'ajout de `lib/scene/surimpression.ts` → 7/7 verts.
- Suite complète : **188/188** (`set -a && . ./.env.local && set +a && npx vitest run`). `tsc --noEmit` : 0 erreur. `eslint .` : 0 erreur. Build Turbopack : OK, `/aide` en `○ (Static)`.

### Completion Notes List

- **Frontière AD-7 tenue** : *quels* éléments la surimpression porte vit dans le modèle pur `lib/scene/surimpression.ts` (`surimpressionPour(region)`). La porte de secours est typée `porteSecours: true` (littéral) → il est **impossible de compiler** une surimpression sans elle. `render/surimpression.tsx` ne fait que dessiner ; il n'importe que `@/lib/scene` + `next/link` (garde `scene-architecture.test.ts` verte).
- **Sans bord, lisibilité par le voile** : la surimpression est `position: absolute` en tête de `.monde`, `pointer-events: none` (liens `auto`) ; sa lisibilité tient à un **voile en dégradé** (mêmes tokens que `.voile-seuil`, orienté vers le bas), jamais un fond `--surface`/`border`/bande. Contraste AA prouvé **par compositing** (pire cas image blanche) : texte-doux **5,6:1**, texte **11:1** — asserté dans `tests/surimpression.test.ts`.
- **Tabulation (AC3)** : surimpression rendue **premier enfant** de `.monde`, hors de toute section `inert` → « Aide » est le 1ᵉʳ arrêt de tabulation (au seuil) ; en conversation, « Anam est une IA » (arrêt 1) puis « Aide » (arrêt 2) = **≤ 2 arrêts**.
- **`/aide` réellement publique** : le build la prérend en **statique** (`○`), confirmant qu'elle ne lit ni session ni auth → atteignable **connectée ou non**, sans paywall, sans traceur (AD-15, FR-077). Ordre **crise d'abord** : ressources en tête (cible de « Aide »), transparence ancrée `#transparence` (cible de « Anam est une IA »). Numéros en `tel:` + `aria-label` **chiffre par chiffre**.
- **Scope respecté** : marque « Anam » + menu, épaississement animé du signe (Epic 2), bloc ressources « fiche » + « vérifié le » + revue périodique + sortie rapide FR-074 + garde `limites_levees` (Story 2.5) — **non** implémentés, notés dans le code.
- **Note pour Julian (honnêteté)** : la vérif « manuelle » a été faite par **analyse statique + build + tests**, pas par une session navigateur interactive (je ne clique pas dans un vrai navigateur). Recommandé : lancer `npm run dev`, `Tab` depuis la scène (« Aide » en 1er), ouvrir `/aide` en navigation privée (doit s'afficher déconnectée), aller en région « Anam » (la mention IA doit apparaître). `middleware.ts` couvre toujours `/aide` (rafraîchissement de session, no-op sans compte) — inoffensif, pas un traceur ; on pourra l'exclure du matcher plus tard si souhaité.

### File List

**Nouveaux**
- `lib/scene/surimpression.ts` — modèle pur (`Surimpression`, `surimpressionPour`, `URL_AIDE`)
- `render/surimpression.tsx` — rendu muet de la surimpression persistante
- `app/aide/page.tsx` — halte `/aide` statique + publique (ressources + transparence)
- `app/aide/aide.module.css` — styles de `/aide`
- `tests/scene-surimpression.test.ts` — garde modèle (porte de secours inconditionnelle, mention/signe en conversation seule)
- `tests/surimpression.test.ts` — garde CSS/rendu (sans bord, voile, contraste compositing, porte de secours discrète)
- `tests/aide-route.test.ts` — garde `/aide` (publique, sans auth/traceur, numéros accessibles, ancre transparence)

**Modifiés**
- `lib/scene/regions.ts` — ajout de `REGION_CONVERSATION` (source unique)
- `lib/scene/index.ts` — export du module `surimpression`
- `render/scene-dom.tsx` — câblage de `<Surimpression modele={surimpressionPour(region)} />` en tête de scène
- `render/monde.module.css` — styles de la surimpression (flottante, voile, porte de secours, mention IA, signe)

### Change Log

| Version | Date       | Description                                   | Auteur |
|---------|------------|-----------------------------------------------|--------|
| v0.1    | 2026-07-24 | Création de la story (create-story) — prête pour dev | Claude |
| v0.2    | 2026-07-24 | Implémentation (dev-story) : modèle `surimpression` + rendu flottant voile-porté + `/aide` statique publique + 3 gardes (28 tests). 188/188, tsc/lint/build OK. Status → review | Claude |
| v0.3    | 2026-07-26 | Revue de code (workflow 9 lentilles + vérif croisée inter-modèles). 11 trouvailles confirmées, 1 faux positif réfuté, 0 blocker. Correctifs appliqués (8/11) : gardes durcies (gating mention IA, câblage, sans-bord élargi, /aide complet), cible tactile mention IA 44px, survol vivant, entête sous surimpression au zoom, service dans le nom accessible tel:. 197/197, tsc/lint/build OK. [2] laissé en décision. | Claude |

## Senior Developer Review (AI)

**Date :** 2026-07-26 · **Méthode :** workflow adversarial (9 lentilles parallèles → vérification croisée par 2 sceptiques inter-modèles/finding → synthèse triée). 33 agents, ~2,4 M tokens.
**Résultat :** **Changes Requested (mineur)** — 0 blocker, le code livré est correct ; valeur principale = **trous de garde** (les tests ne prouvaient pas tout ce qu'ils prétendent) + nits a11y/tactile. 1 faux positif correctement réfuté (texte dans le fondu du voile).

### Action Items

- [x] **[1] MED** — La conditionnalité RENDU de la mention IA (art. 50) n'était prouvée par aucune garde (mutation « mention inconditionnelle » → 188/188 vert). → assertions de gating `modele.mentionIA &&` / `modele.signeAnam &&` ajoutées (`tests/surimpression.test.ts`).
- [x] **[2] MED — ACCEPTÉ tel quel par Julian (2026-07-26)** — Après une navigation, le focus va au `h1` (contrat 1.7) → Tab-avant part vers le nav, pas vers « Aide ». Décision : accepter — le filet reste **présent, visible, cliquable et Shift-Tab-atteignable**, et AC3 (« depuis l'entrée de la scène ») est respecté ; le contrat de focus 1.7 (orientation lecteur d'écran) est préservé. Aucun changement de code.
- [x] **[3] MED** — Cible tactile de « Anam est une IA » ~19px < 44px (standard DESIGN.md L534). → `min-height: var(--cible-tactile)` + inline-flex sur `.mentionIa`.
- [x] **[4] MED** — Câblage (surimpression avant les régions, hors `inert`) non gardé. → garde d'ordre DOM ajoutée (`tests/surimpression.test.ts`).
- [x] **[5] MED** — Garde « sans bord » trop étroite (`border:` seul, 1er bloc seul). → regex `border(-[a-z]+)?:` + tous les blocs (média inclus).
- [x] **[6]/[10] LOW** — Survol des liens = code mort (`.t-meta` figeait la couleur). → `.mentionIa .t-meta, .porteSecours .t-meta { color: inherit }`.
- [x] **[8] LOW** — Entête focalisé sous la surimpression au zoom 200 %/paysage court. → `padding-top` de `.region` réserve la hauteur de la surimpression + `scroll-margin-top` sur les `h1`.
- [x] **[9] LOW** — Garde `/aide` partielle (15/112 non vérifiés, doublage vocal du seul 3114). → 15/112 via `tel:`, aria espacé vérifié pour CHAQUE ressource.
- [x] **[11] INFO** — Nom accessible des liens `tel:` = chiffres nus. → `aria-label` = « Service, chiffres » (ex. « Prévention du suicide, 3 1 1 4 »).
- [x] **Faux positif réfuté** — « le texte tombe dans le fondu du voile » : overlay ~76px, texte sur la bande dense ≥85 % — écarté par le reproducteur.
