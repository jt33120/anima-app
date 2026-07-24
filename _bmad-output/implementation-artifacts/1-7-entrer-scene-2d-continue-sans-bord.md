---
story_key: "1-7-entrer-scene-2d-continue-sans-bord"
epic: 1
story: 7
title: "Entrer dans la scène 2D continue et sans bord"
epic_name: "Franchir le seuil"
covers: [AD-7, AD-2, AD-15, AD-10, AD-1, NFR-018, NFR-015, NFR-016]
depends_on: ["1-6-consentement-non-contournable-revocable", "1-2-fondation-design-system"]
status: done
baseline_commit: f4423f2ba8664f8b64a22754c56a0c79eb0b0a15
created: "2026-07-24"
sources:
  - _bmad-output/planning-artifacts/epics.md#epic-1--story-1-7
  - _bmad-output/planning-artifacts/architecture/architecture-Anima-2026-07-22/ARCHITECTURE-SPINE.md#ad-7
  - _bmad-output/planning-artifacts/ux-designs/ux-Anima-2026-07-21/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-Anima-2026-07-21/DESIGN.md
---

# Story 1.7 : Entrer dans la scène 2D continue et sans bord

Status: done

<!-- Note : validation optionnelle. Lancer validate-create-story avant dev-story pour un contrôle qualité. -->

## Story

En tant qu'**utilisatrice ayant consenti**,
je veux **franchir le seuil et arriver dans une scène 2D continue et sans bord où je circule en fondu sans jamais changer d'écran sec**,
afin d'**entrer dans un monde, et non dans une pile d'écrans**.

**Sous le capot (l'enjeu de fond, pour le dev) :** cette story pose le squelette porteur de tout le visible à venir — la **séparation modèle/rendu (AD-7)**. L'état de la scène devient un **modèle de données pur** (`lib/scene/`, testable sans DOM) et le dessin un **adaptateur muet et remplaçable** (`render/`, DOM/2D aujourd'hui, WebGL demain **sans réécriture**). C'est la première story où l'on construit le *beau* — mais le beau repose sur une frontière propre, sinon l'Epic 4 (l'arbre) et la v2 (3D) devront tout jeter.

## Acceptance Criteria

1. **Étant donné** une utilisatrice ayant consenti (état `suite`) **Quand** elle franchit le seuil **Alors** elle arrive dans une scène 2D **continue, sans cadre ni filet décoratif**, ancrée (**arbre au centre, présence d'Anam à gauche**) **Et** le passage entre régions se fait **en fondu** (`--duree-longue` = 700 ms, `--courbe`), **jamais** par un basculement d'écran sec ni un glissement latéral. *(AD-7 ; UX sans bord ; UX-DR-7/8 ; epics AC L489)*

2. **Étant donné** la séparation modèle/rendu (AD-7) **Quand** l'état de la scène est défini **Alors** il vit comme **modèle de données pur** dans `lib/scene/` **sans aucune dépendance au rendu** (ni React, ni Next, ni DOM), et `render/` (DOM/2D v1) **ne porte aucune logique métier** **Et** l'architecture autorise un futur adaptateur WebGL **sans réécriture du modèle** (la dépendance ne va que `render/ → lib/scene/`, jamais l'inverse — AD-10). *(AD-7, AD-10 ; UX-DR-9 ; epics AC L491)*

3. **Étant donné** l'exigence de **doublage non-spatial de rang égal** (accessibilité) **Quand** l'utilisatrice navigue au clavier ou au lecteur d'écran **Alors** chaque région est atteignable par un **lien nommé** (barre basse en `sm`/`md`, rail à gauche en `≥ lg`) **sans traverser la scène**, l'**ordre de lecture restant linéaire** **Et** **aucune information n'est jamais portée par le seul mouvement** ni la seule position spatiale. *(AD-7, AD-15 ; UX-DR-37 ; epics AC L493)*

4. **Étant donné** `prefers-reduced-motion: reduce` **Quand** l'utilisatrice change de région **Alors** le changement devient **instantané** (0 ms), **sans fondu ni parallaxe** **Et** les textes apparaissent complets, la respiration du signe est arrêtée. *(UX-DR-38 ; DESIGN.md §Mouvement ; epics AC L495)*

5. **Étant donné** l'imagerie du format **Seuil** (personnage 4:5, accueil / ouverture) **Quand** du texte se pose dessus **Alors** il passe par le **voile de lisibilité** (jamais de texte sur image sans voile) **Et** respecte le contraste **WCAG 2.2 AA** (tokens DESIGN.md, vérifié par calcul). *(UX-DR-39, NFR-016 ; epics AC L497)*

6. **Étant donné** la coquille serveur (AD-2) **Quand** on inspecte le bundle client **Alors** **aucune clé de fournisseur IA n'y figure** **Et** tout futur appel IA est routé par `app/api/**` (frontière serveur posée dès l'entrée ; le navigateur ne parle jamais en direct au fournisseur). *(AD-2 ; epics AC L499)*

7. **Étant donné** la surface exposée (NFR-015) **Quand** n'importe quelle route est rendue **Alors** le `<title>` vaut **« Anam » sur toutes les routes**, les identifiants d'URL sont **opaques**, le **favicon** est un **fragment abstrait tronc/branche** (aucune lune, étoile, lotus, visage) et l'`og:` reste **neutre et impersonnel**. *(NFR-015 ; UX-DR-40 ; epics AC L501)*

> **Périmètre — ce que 1.7 NE fait PAS** (garde-fous de scope) :
> - **Pas** la surimpression persistante (signe d'Anam + mention « Anam est une IA » + porte de secours `/aide`) → **Story 1.8**.
> - **Pas** le contenu réel des régions : la bibliothèque d'Accueil (Epic 5), la conversation avec Anam (Epic 2), la vraie projection tronc/branches de l'arbre (Epic 4). 1.7 livre la **coquille** fonctionnelle et conforme + un contenu **placeholder** sobre par région.
> - **Pas** le chantier « entrée immersive + auth Google/Apple » (différé, cf. [deferred-work.md](deferred-work.md)).
> - **Pas** la parallaxe / chorégraphie fine : explicitement **différée** par l'architecture (SPINE §Deferred L272, « hors modèle »). Le **fondu de région est la seule grammaire de mouvement** en 1.7.

## Tasks / Subtasks

- [x] **Tâche 1 — Le modèle de scène pur : `lib/scene/`** (AC : 2)
  - [x] `lib/scene/regions.ts` — le **catalogue** des régions + les types. Données pures, aucun import infra. Contrat proposé :
    ```ts
    export type IdRegion = "seuil" | "accueil" | "anam" | "arbre";
    export interface Region {
      readonly id: IdRegion;
      readonly nom: string;            // libellé du lien nommé (doublage non-spatial, UX-DR-37)
      readonly destinationDirecte: boolean; // apparaît dans la barre basse / rail (Accueil, Anam, Arbre)
    }
    // ORDRE = ordre de lecture linéaire garanti (AC3), indépendant de la disposition spatiale.
    export const REGIONS: readonly Region[] = [
      { id: "accueil", nom: "Accueil", destinationDirecte: true },
      { id: "anam",    nom: "Anam",    destinationDirecte: true },
      { id: "arbre",   nom: "L'arbre", destinationDirecte: true },
    ] as const;
    export const REGION_ENTREE: IdRegion = "seuil"; // le rideau qui se lève ; pas une destination de la barre
    export const estRegion = (v: string): v is IdRegion => /* garde de type */ ;
    ```
  - [x] `lib/scene/vue.ts` — le **view-state client éphémère** (région courante, cadrage) + la **transition, propriétaire unique** (SPINE L155). **Réducteur pur** (aucun React) :
    ```ts
    export interface EtatVue { readonly regionCourante: IdRegion; }
    export const etatInitial: EtatVue = { regionCourante: REGION_ENTREE };
    export type ActionVue = { type: "aller"; cible: IdRegion };
    export function reducteurVue(etat: EtatVue, action: ActionVue): EtatVue; // transition pure, idempotente sur la même cible
    ```
  - [x] `lib/scene/projection.ts` — la **domain-projection serveur, en lecture seule** (SPINE L155 + AD-7 « `lib/scene/` projette l'état max »). **STUB en 1.7** (les branches = Epic 4/AD-8), mais la **frontière et le type sont posés** :
    ```ts
    // Lecture seule. Le rendu ne l'écrit jamais (AD-7). En 1.7 : tronc présent, aucune branche.
    export interface ProjectionScene {
      readonly tronc: { readonly present: true };
      readonly branches: readonly []; // Epic 4 remplira ; le type reste `readonly`
    }
    export const projectionInitiale: ProjectionScene = { tronc: { present: true }, branches: [] };
    ```
  - [x] `lib/scene/index.ts` — barrel d'exports. Mettre à jour `lib/scene/README.md` (aujourd'hui une ligne) : décrire modèle pur / view-state / projection / interdit d'import rendu.
  - [x] **Invariant dur** : aucun fichier de `lib/scene/` n'importe `react`, `next`, ni `render/` (prouvé en Tâche 6).

- [x] **Tâche 2 — L'adaptateur de rendu DOM/2D muet : `render/`** (AC : 1, 2)
  - [x] `render/scene-dom.tsx` — le composant **client** (`"use client"`), **seul** hôte du view-state via `useReducer(reducteurVue, etatInitial)`. Il **consomme** le modèle (`EtatVue` + `ProjectionScene` reçue en props) et **dessine** ; il ne **décide** rien (aucune monotonie, aucune règle métier — AD-7). Contrat = props (le futur adaptateur WebGL implémentera le même contrat) :
    ```tsx
    export interface ProprietesSceneRendue { projection: ProjectionScene; }
    export default function SceneDom({ projection }: ProprietesSceneRendue): JSX.Element;
    ```
  - [x] Le **monde continu** (repris/nettoyé du prototype `app/_scene/scene-immersive.tsx` + `scene.module.css`, migrés ici) : ciel persistant, étoiles (générées après montage → pas de décalage d'hydratation), lune, grain. **La scène est une** : le fond ne change jamais ; seul le **cadrage/premier plan** se fond entre régions.
  - [x] **Ancrage stable** (AC1) : **arbre au centre**, **présence d'Anam à gauche**. Régions = cadrages du même monde, reliées en **fondu** (réutiliser la classe partagée `.fondu-region` de `globals.css`, PAS une transition CSS maison — cf. Dev Notes « Bug reduced-motion »).
  - [x] `render/arbre-decor.tsx` — l'arbre **ancré**, SVG **statique et muet** (repris de la fonction `ArbreDeNuit` du prototype ; tokens `--arbre-tronc/-branche/-feuillage`, un fruit `--accent` + halo `--lueur`). **PAS** de croissance pilotée ici (la vraie projection tronc/branches = Epic 4, dans `lib/scene/`). `role="img"` + `aria-label` court.
  - [x] `render/voile.tsx` (ou classe utilitaire) — le **voile de lisibilité** (Tâche 4).
  - [x] Contenu **placeholder** sobre par région (Accueil / Anam) : un titre + une phrase en registre produit, en attendant les epics 2/5. Conforme aux tokens ; jamais de faux contenu trompeur.
  - [x] **Invariant dur** : `render/` importe `lib/scene/` (types + réducteur), **jamais l'inverse** ; `render/` ne lit aucune base, n'appelle aucun port, ne référence aucun secret (prouvé en Tâche 6).

- [x] **Tâche 3 — Doublage non-spatial + fondu + reduced-motion** (AC : 1, 3, 4)
  - [x] **Barre de navigation nommée** (`render/`) : `sm`/`md` = **barre basse fixe, 3 entrées** (Accueil · Anam · L'arbre) ; `≥ lg` = **rail latéral gauche**, mêmes entrées. `<nav aria-label="Régions">` avec des `<button>` nommés qui **dispatchent** `reducteurVue`. **Identiques** quel que soit l'état (aucun cadenas, badge, pastille, compteur — FR-031). Cibles **≥ 44×44 px** (`--cible-tactile`).
  - [x] **Ordre de lecture linéaire** : les régions dans le DOM dans l'ordre de `REGIONS` ; la région active est visible et focusable, **les inactives sont `aria-hidden` + `inert`** (jamais focusables, jamais lues). Au changement de région, **déplacer le focus** vers l'entête de la région activée (et le rendre programmatiquement focusable).
  - [x] **Anneau de focus** visible partout : `outline: 2px solid var(--bordure-forte)`, `outline-offset: 2px` — jamais supprimé (réutiliser le motif déjà présent dans le prototype).
  - [x] **Fondu de région** via `.fondu-region` (grammaire partagée de `globals.css`). **Corriger le bug du prototype** : sous `prefers-reduced-motion: reduce`, le changement de région DOIT être **instantané** (0 ms). Ne PAS réintroduire de `transition: opacity` maison non neutralisée (cf. Dev Notes).
  - [x] **Retirer la parallaxe au pointeur** du prototype (différée, hors modèle — SPINE L272). Le fondu suffit.

- [x] **Tâche 4 — Le format Seuil + le voile de lisibilité + tokens** (AC : 5)
  - [x] Ajouter les **tokens de voile** à `app/styles/tokens.ts` (objet `voile`) et leur reflet en variables CSS dans `app/styles/globals.css` — valeurs DESIGN.md (`components.voile`) :
    - `--voile-opacite-texte-courant: 0.85` (sous `corps`/`anam`/`meta` → garantit ≥ 4,5:1)
    - `--voile-opacite-grand-texte: 0.70` (sous `display`/`titre` → garantit ≥ 3:1)
    - `--voile-couleur: var(--fond)` ; forme-seuil = `linear-gradient(to top, var(--fond) 0%, var(--fond) 22%, rgba(12,10,30,0.72) 48%, transparent 80%)`
  - [x] Classe/utilitaire `.voile-seuil` : le bloc de texte tient **entièrement dans la bande ≥ 85 %** ; appliquer `grain` par-dessus (anti-banding). **`text-shadow` interdit** comme substitut.
  - [x] **Région Seuil** (`render/`) : le personnage 4:5 (`/scene/anam-seuil.png`, déjà présent) apparaît en **fondu image** (700 ms) ; **tout texte posé dessus** passe par `.voile-seuil` (jamais de texte nu sur image). Tailles sur imagerie : `corps`/`anam` ≥ 15-16 px, jamais < 13 px.
  - [x] Soumettre l'imagerie au **mode accessibilité** (`--imagerie-opacite`, hook déjà posé en 1.2) : en `-clair`, l'imagerie cède aux aplats.

- [x] **Tâche 5 — Identité discrète des routes (layout + favicon + og)** (AC : 7)
  - [x] `app/layout.tsx` : centraliser le titre — `metadata.title = { default: "Anam", template: "Anam" }` → **« Anam » garanti sur toutes les routes**, même si une page définit son propre `title` (le template littéral l'absorbe). Aucune page ne doit utiliser `title.absolute`.
  - [x] `metadata.openGraph = { title: "Anam", description: "<neutre, impersonnel, sans lexique ésotérique>" }`. Revoir `description` racine pour qu'elle ne trahisse ni l'intimité ni l'ésotérisme (NFR-015).
  - [x] `app/icon.svg` (convention de fichier Next) : **fragment abstrait tronc/branche**, 2 couleurs mates (`--surface-elevee` fond, `--arbre-branche` trait), **aucune** lune/étoile/constellation/lotus/roue/œil/main/visage/chiffre. Lisible à 40 px, tient en monochrome.
  - [x] **URL opaques** : vérifier qu'aucune route ne porte de donnée perso ni de mot du contenu dans son chemin (état actuel OK : `/entrer`, `/naissance`, `/consentement`, `/cgu`, `/aide`). Invariant à préserver.

- [x] **Tâche 6 — Nettoyage du code mort (spike WebGL) et câblage de l'entrée** (AC : 1, 2, 6)
  - [x] **Supprimer** `app/_scene/univers.tsx` (spike WebGL Three.js, **non importé**, contraire à l'invariant 2D v1 — SPINE §Deferred L268, UX-DR-7).
  - [x] **Retirer** `three` (deps) et `@types/three` (devDeps) de `package.json` (utilisés uniquement par `univers.tsx`). `npm install` pour régénérer le lockfile.
  - [x] **Supprimer** les assets du spike : `public/scene/univers/` (anam-presence.png, anam-seuil.png, anam-veille.png, eau.png).
  - [x] **Retirer** `app/_scene/arbre-vivant.tsx` (arbre génératif **piloté au scroll**, non branché) : sa logique de **croissance monotone** appartient à AD-8/Epic 4, dans `lib/scene/` (projection) — pas dans le rendu. Git conserve l'historique ; la reprise se fera via la projection.
  - [x] **Migrer puis vider `app/_scene/`** : le pur → `lib/scene/`, le rendu (`scene-immersive.tsx`, `scene.module.css`, l'arbre) → `render/`. `app/_scene/` disparaît.
  - [x] `app/page.tsx` : **préserver la garde onboarding 1.6 à l'identique** (redirections `mineur`/`naissance`/`consentement`/`revoque` ; scène seulement en `suite`). Ne changer que la cible du rendu : monter `<SceneDom projection={projectionInitiale} />` (import depuis `render/`). La projection réelle (lecture DB) arrivera avec l'Epic 4 ; en 1.7 elle est le stub.
  - [x] **Frontière serveur (AC6)** : `app/page.tsx` reste un **Server Component** (garde + éventuelle projection serveur) qui monte l'adaptateur **client** ; aucun secret ne franchit la frontière ; convention `app/api/**` documentée (route `health` déjà en place comme témoin du pattern).

- [x] **Tâche 7 — Tests (gardes bloquantes, 1 famille ≈ 1 AC)** (AC : 1–7)
  - [x] `tests/scene-modele.test.ts` (AC1/AC2, **logique pure sans DOM**, pattern `age.ts`/`etat-onboarding.ts`) : `reducteurVue` (transition vers chaque destination, idempotence sur la même cible, entrée = `seuil`) ; `REGIONS` (3 destinations directes, ordre de lecture stable) ; `projectionInitiale` (tronc présent, `branches` vide et `readonly`).
  - [x] `tests/scene-architecture.test.ts` (AC2/AC6, **garde de frontière** par lecture de fichiers) : aucun fichier `lib/scene/**` n'importe `react`/`next`/`render` ; `render/**` n'importe pas `lib/data`/`lib/ai`/`@supabase` et ne référence aucun secret (`process.env` interdit dans `render/`) ; `render/ → lib/scene/` autorisé.
  - [x] `tests/scene-accessibilite.test.ts` (AC3/AC4, **regex sur le CSS du rendu**, pattern `accessibilite.test.ts`) : le fondu de région est **neutralisé** sous `@media (prefers-reduced-motion: reduce)` (transition/animation → 0/`none`) ; **aucune** règle de parallaxe résiduelle ; le CSS n'introduit pas de `transition: opacity` de région non neutralisée. Vérifier la présence d'un `<nav aria-label>` + boutons nommés (via lecture du composant `render/`).
  - [x] `tests/identite-route.test.ts` (AC7) : `app/layout.tsx` définit `title.default = "Anam"` **et** `title.template = "Anam"` ; `app/icon.svg` existe et ne contient aucun terme interdit (lune/étoile/lotus…) ; `openGraph` neutre ; **aucune** page n'exporte `title.absolute` ; le CSS ne contient pas `prefers-color-scheme: light` (déjà gardé — non-régression).
  - [x] `tests/voile.test.ts` (AC5, `contraste.ts`) : tokens de voile présents dans `tokens.ts` **et** `globals.css` (parité) ; le ratio du texte sur le fond composité **sous voile ≥ 85 %** atteint **≥ 4,5:1** (calcul via `ratioContraste` sur la couleur composite `--fond` @0.85 vs `--texte`).
  - [x] **Non-régression** : les **119 tests actuels restent verts** (gardes onboarding 1.4/1.5/1.6, write-gate art. 9, parité tokens, typographie, contraste, smoke). `tsc` + `lint` + `build` verts.
  - [x] Rappel opérationnel : **Vitest ne charge PAS `.env.local`** → les tests base tournent via `set -a && . ./.env.local && set +a && npx vitest run`. La logique de scène est **pure** (ne touche pas la base) : la majorité des nouveaux tests tournent sans env.

## Dev Notes

### Ce qui EXISTE déjà — à RÉUTILISER, ne pas réinventer

- **Design system complet (Story 1.2)** — [app/styles/tokens.ts](../../app/styles/tokens.ts) est la **source de vérité unique** (objet TS pur, importable par les tests), reflétée par [app/styles/globals.css](../../app/styles/globals.css), **verrouillée** par [tests/tokens-parite.test.ts](../../tests/tokens-parite.test.ts). Toute couleur/valeur ajoutée passe par ce module, jamais « à l'œil ».
  - Variables CSS déjà disponibles : couleurs (`--fond`, `--accent`, `--texte`, `--texte-doux`, `--bordure-forte`, `--arbre-tronc/-branche/-feuillage`, `--lueur`…), espacement (`--esp-1..9`, `--marge-mobile`, `--mesure`, `--contenu-max`, `--cible-tactile`), rayons, **mouvement** (`--duree-courte/standard/longue`, `--courbe`).
  - **Classes de fondu partagées déjà posées** : `.fondu-region`, `.fondu-texte`, `.fondu-image`, `.fondu-personnage`, `.respiration` — **et leur neutralisation `prefers-reduced-motion` est déjà correcte** dans `globals.css`. **Utiliser `.fondu-region`** pour le passage de région (ne PAS réimplémenter).
  - Classes typo : `.t-display`, `.t-titre`, `.t-anam`, `.t-corps`, `.t-meta`, `.t-surtitre`, `.t-bouton`.
  - **Mode accessibilité** `-clair` : déclenché par `:root[data-a11y="contraste"]` **ou** `@media (prefers-contrast: more)` — **ce n'est PAS un thème jour** ; ne jamais brancher `prefers-color-scheme: light` (gardé par `accessibilite.test.ts`). Hook d'atténuation d'imagerie `--imagerie-opacite` prêt.
- **Helper contraste** — [app/styles/contraste.ts](../../app/styles/contraste.ts) : `ratioContraste(hex1, hex2)` pur, WCAG 2.x. Réutiliser pour le test du voile (AC5).
- **Polices** — [app/styles/polices.ts](../../app/styles/polices.ts) charge Fraunces/Inter en `next/font/local` (woff2 dans `app/styles/fonts/`), exposées en `--police-anam` / `--police-ui`. Layout applique `lang="fr"` (UX-DR-36).
- **Le prototype de scène** — [app/_scene/scene-immersive.tsx](../../app/_scene/scene-immersive.tsx) + [scene.module.css](../../app/_scene/scene.module.css) contiennent le **beau déjà là** (ciel, étoiles anti-hydratation, lune, grain, arbre SVG, fondu de région, signe lotus, respiration). **Récolter ce visuel** en le migrant dans `render/` — mais en le débranchant de sa logique d'état (qui part dans `lib/scene/`).
- **Garde d'onboarding (Story 1.6)** — [app/page.tsx](../../app/page.tsx) route déjà `mineur`/`naissance`/`consentement`/`revoque` et ne rend la scène qu'en `suite`. **NE PAS la casser** : seule la cible du `return` change.
- **Pattern route handler / smoke** — [app/api/health/route.ts](../../app/api/health/route.ts) + [tests/smoke.test.ts](../../tests/smoke.test.ts) : le témoin de la frontière serveur (AC6). La convention `app/api/**` est déjà en place.

### Décision technique n°1 — La structure modèle/rendu (le cœur d'AD-7)

L'architecture (SPINE §Design Paradigm, table des couches, AD-7, AD-10, §Structural Seed, diagramme « Scène modèle/rendu ») **impose** :

```
lib/scene/    # MODÈLE PUR — état, régions, transition, projection. 0 React/Next/DOM. Testable seul.
render/       # ADAPTATEUR DOM/2D — dessine le modèle. 0 logique métier. Muet. Remplaçable (WebGL v2).
app/page.tsx  # ENTRÉE — Server Component gardé (1.6) qui monte l'adaptateur client avec la projection.
```

- **Dépendance unidirectionnelle** : `render/ → lib/scene/`, **jamais** `lib/scene/ → render/` (AD-10 : « rendu → modèle de scène, jamais l'inverse »). C'est l'invariant qui rend la v2 (WebGL/R3F) possible **sans réécriture du modèle** — un second adaptateur consommera le même modèle.
- **Partition de `lib/scene/` (SPINE L155)** : deux moitiés distinctes —
  1. **view-state client éphémère** (`vue.ts`) : région courante, cadrage. **Propriétaire unique de la transition de région.** Réducteur **pur**, hébergé par `useReducer` dans `render/scene-dom.tsx`.
  2. **domain-projection serveur, lecture seule** (`projection.ts`) : tronc, branches (AD-8). **Le rendu ne l'écrit jamais.** STUB en 1.7 ; l'Epic 4 la remplira depuis l'état max persisté, gardé à l'écriture par SQL — jamais par le rendu.
- **Le « port de rendu »** (diagramme SPINE L224-231 : `Adaptateur DOM/2D → port de rendu → Modèle`) est réalisé, en 1.7, par le **contrat de props** de `SceneDom` (`{ projection }`) + le view-state interne. Léger et suffisant : un adaptateur WebGL futur exposera la même surface.

### Décision technique n°2 — Navigation = view-state, PAS des routes Next

« **La scène est une**, pas une pile d'écrans » (EXPERIENCE.md) + « jamais un basculement d'écran sec » (AC1) ⇒ les **3 destinations** (Accueil, Anam, L'arbre) sont des **régions** naviguées par **changement de view-state** (fondu), montées **en continu** dans un **seul** composant client à `/`. **Aucune région n'est une route Next distincte en v1** (une navigation de route remonterait le layout = écran sec). Le `app/(scene)/` du Structural Seed est une **organisation future** (quand les régions auront un contenu propre, epics 2/4/5) ; le **modèle de navigation reste view-state** même alors. Les vraies routes séparées (`/aide`, `/cgu`, les haltes légales) gardent `title = "Anam"` (AC7).

### Décision technique n°3 — Nettoyage du spike WebGL (dette conforme)

`app/_scene/univers.tsx` (Three.js, 419 l.) est un **spike vers la v2 3D**, **non importé** depuis l'assainissement de l'accueil. Le laisser = dette + contradiction de l'invariant « strictement 2D v1 » (SPINE §Deferred L268, UX-DR-7) + risque de deps `three` embarquées. **1.7 le supprime**, retire `three`/`@types/three` et les assets `public/scene/univers/`. L'AD-7 (adaptateur remplaçable) est ce qui rendra la 3D possible **le moment venu** — proprement, pas via un spike mort. `arbre-vivant.tsx` (génératif au scroll, non branché) part pour la même raison : sa croissance monotone appartient à `lib/scene/` (projection AD-8), pas au rendu.

### Piège n°1 — Le bug `prefers-reduced-motion` du prototype (AC4)

Dans [scene.module.css](../../app/_scene/scene.module.css), le fondu de région est une **`transition: opacity 700ms`** maison — et le bloc `@media (prefers-reduced-motion: reduce)` neutralise le ciel, la parallaxe et les *animations*, **mais pas cette transition de région**. Résultat : sous reduced-motion, changer de région **fait encore un fondu de 700 ms** → **viole AC4**. **Fix** : piloter le fondu de région par la classe partagée `.fondu-region` (dont la neutralisation reduced-motion est déjà correcte), **ou** ajouter explicitement `@media (prefers-reduced-motion: reduce) { transition: none }` sur la région. Le test `scene-accessibilite.test.ts` verrouille ce point.

### Piège n°2 — Le voile n'est pas cosmétique (AC5)

« **Le texte ne se pose JAMAIS directement sur une image sans voile** » (DESIGN.md, UX-DR-39). Le prototype place le texte du Seuil *sous* l'image (pas dessus) — donc conforme par évitement, mais 1.7 doit **fournir le mécanisme** (`.voile-seuil` + tokens) pour le vrai format Seuil (texte dans la bande dense). `text-shadow` **interdit** comme substitut. Le ratio doit être **calculé** (contraste.ts), pas supposé.

### Conflits inter-docs UX — DÉJÀ tranchés (autorité = DESIGN.md), à ne pas rouvrir

1. **Nom de la palette** = « **Nuit galactique** » (DESIGN.md). La note « Nuit d'argile » d'EXPERIENCE.md L19 est un vestige — ignorer. `tokens.ts` porte déjà les bonnes valeurs.
2. **Pas de thème jour** sur `prefers-color-scheme`. Les tokens `-clair` sont un **mode d'accessibilité** (contraste renforcé), pas un décor de jour. Déjà implémenté correctement en 1.2 (gardé par `accessibilite.test.ts`).

### Accessibilité — le socle (AC3/AC4/AC5), rappel opérationnel

- **Doublage non-spatial de rang égal (UX-DR-37)** : chaque destination atteignable par un **lien nommé** (barre basse / rail) **sans traverser la scène** ; **ordre de lecture linéaire** ; régions inactives `aria-hidden` + `inert` ; focus déplacé vers la région activée ; **aucune info par le seul mouvement / la seule position / la seule couleur**.
- **WCAG 2.2 AA** partout ; anneau de focus `--bordure-forte` jamais supprimé ; cibles ≥ 44 px ; zoom 200 % sans perte ; **aucune limite de temps**.
- **Marge de contraste la plus faible du mode nuit** : `arbre-tronc`/`fond` = **3,63:1** (le tronc se dessine contre le ciel) — **ne pas assombrir le tronc** sans re-mesurer.

### Project Structure Notes

- **Nouveaux dossiers/fichiers** : `lib/scene/{regions,vue,projection,index}.ts` (+ README) ; `render/{scene-dom.tsx, arbre-decor.tsx, voile.tsx, monde.module.css}` (noms indicatifs) ; `app/icon.svg`.
- **Modifiés** : `app/page.tsx` (cible du rendu, garde inchangée), `app/layout.tsx` (title template + og), `app/styles/tokens.ts` + `app/styles/globals.css` (tokens voile), `package.json` (retrait `three`).
- **Supprimés** : `app/_scene/univers.tsx`, `app/_scene/arbre-vivant.tsx`, `public/scene/univers/*`, et à terme le dossier `app/_scene/` (contenu migré vers `render/`).
- **Nommage** : français pour le domaine (fichiers, fonctions, types) — cohérent avec `etat-onboarding.ts`, `age.ts`, `tokens.ts`.
- **Alignement archi** : `lib/scene/` + `render/` correspondent exactement à la table des couches et au Structural Seed du SPINE. Variance assumée : `app/(scene)/` n'est **pas** créé en 1.7 (navigation en view-state, cf. Décision n°2) — à réévaluer quand les régions auront un contenu propre.

### References

- [Source: epics.md#Story 1.7 (L481-501)] — les 7 critères d'acceptation d'origine.
- [Source: ARCHITECTURE-SPINE.md#AD-7 (L66-69)] — modèle/rendu séparés, cap 3D v2, `render/` muet.
- [Source: ARCHITECTURE-SPINE.md#AD-2 (L41-44)] — IA médiée serveur, clé jamais au client, `app/api/**`.
- [Source: ARCHITECTURE-SPINE.md#AD-10 (L81-99)] — direction des dépendances `rendu → modèle de scène`.
- [Source: ARCHITECTURE-SPINE.md#Conventions (L155)] — partition view-state / domain-projection.
- [Source: ARCHITECTURE-SPINE.md#Structural Seed (L176-192) + Deferred (L268, L272)] — arborescence ; 3D et parallaxe différées.
- [Source: EXPERIENCE.md] — scène unique sans bord, 5 régions, haltes, doublage non-spatial, format Seuil, discrétion des routes.
- [Source: DESIGN.md] — tokens Nuit galactique, voile de lisibilité (`components.voile`), format `personnage.seuil` 4:5, contrastes WCAG vérifiés, icône/notif discrètes.
- [Source: app/styles/tokens.ts, globals.css, contraste.ts] — design system à réutiliser.
- [Source: app/_scene/scene-immersive.tsx, scene.module.css] — le visuel à récolter et à débrancher de son état.
- [Source: app/page.tsx] — garde d'onboarding 1.6 à préserver.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (1M context) — dev-story.

### Debug Log References

- **Bug reduced-motion du prototype (AC4), confirmé puis corrigé** : dans l'ancien `scene.module.css`, la transition d'opacité de région (700 ms) n'était pas neutralisée sous `prefers-reduced-motion`. Le nouveau `render/monde.module.css` neutralise explicitement `.region { transition: none }` dans le bloc `@media (prefers-reduced-motion: reduce)` → changement **instantané (0 ms)**. Verrouillé par `scene-accessibilite.test.ts`.
- **Faux positifs de gardes sur leurs propres commentaires** (`text-shadow`, `parallaxe`, `process.env` cités en commentaire explicatif) : les tests-gardes retirent désormais les commentaires avant de chercher un motif interdit → ils testent le **code**, pas la prose.

### Completion Notes List

- **7 AC livrés. Gate vert : 158 tests (119 socle + 39 nouveaux), `tsc` 0 erreur, `lint` propre, `build` ✓ (12/12 pages, `/icon.svg` détecté, `/` dynamique — garde onboarding intacte).**
- **Séparation modèle/rendu (AD-7)** : `lib/scene/` pur (`reducteurVue` propriétaire unique de la transition, `REGIONS`, `projectionInitiale` STUB gelé) ; `render/` muet (`SceneDom` consomme `projection` en lecture seule, ne décide rien). La dépendance ne va que `render/ → lib/scene/`. La garde eslint (lib/scene ✗→ render) est complétée par `scene-architecture.test.ts` (react/next/infra interdits côté modèle ; `process.env`/infra interdits côté rendu).
- **Navigation = view-state** (Décision n°2) : 3 destinations en fondu dans un seul composant client à `/`, aucune route Next par région.
- **Décision de conception résolvant une tension interne de la story** : AC4 exige « 0 ms », or la classe partagée `.fondu-region` retombe à **180 ms** d'opacité sous reduced-motion. J'ai donc piloté le crossfade de région par une **transition CSS de module explicitement neutralisée** (0 ms), et réservé `.fondu-region`/`.fondu-*` à l'**apparition one-shot** du contenu (personnage, texte) — où 180 ms opacité est la grammaire admise du design system. C'est l'option que le « Piège n°1 » de la story autorisait, et la plus fidèle à AC4.
- **AC7 durci** : 4 pages portaient des titres discrets mais **parlants** (« Bienvenue », « Entrer », « Avant de commencer », « Conditions d'utilisation »). Unifiés en **« Anam » partout** (layout `title.default` + `template` littéral + `title:"Anam"` explicite par page). `identite-route.test.ts` interdit toute régression + vérifie le favicon abstrait (aucun symbole ésotérique) + l'og neutre.
- **Voile (AC5)** : tokens `voile` + variables CSS + utilitaire `.voile-seuil`. Contraste **prouvé par calcul** (compositing pire cas = image blanche) : 85 % → **11:1** (≥ 4,5:1 requis). `text-shadow` interdit comme substitut (gardé).
- **Nettoyage de dette (Tâche 6)** : supprimés `app/_scene/univers.tsx` (spike WebGL Three.js), `app/_scene/arbre-vivant.tsx`, tout `app/_scene/` (visuel récolté dans `render/`), les deps `three`/`@types/three` (**élaguées du lockfile et de `node_modules`**), et `public/scene/univers/*`. Aucune référence résiduelle.
- **Variances assumées vs story (sans perte de couverture)** : (a) pas de `render/voile.tsx` séparé → utilitaire global `.voile-seuil` (la story permettait « ou classe utilitaire ») ; (b) `identite-route.test.ts` ne redouble pas la garde `prefers-color-scheme: light` (déjà couverte par `accessibilite.test.ts`) ; (c) `app/(scene)/` non créé (navigation en view-state, cf. Décision n°2).
- **À signaler (NON introduit par 1.7, NON bloquant — portes pré-lancement connues)** : avertissement Turbopack « additional lockfile » (lockfile parent dans `/Users/juliantalou/`) ; dépréciation `middleware` → `proxy` (Next 16) ; `npm audit` = 5 vulnérabilités (2 basses, 3 hautes) dans l'arbre de dépendances.
- **Différé (hors 1.7, cadré)** : surimpression persistante + mention « Anam est une IA » + porte `/aide` → **Story 1.8** ; contenu réel des régions (conversation Epic 2, bibliothèque Epic 5, vraie projection tronc/branches Epic 4) ; parallaxe / vrai 3D → v2.

### Suivi de revue + intégration de l'asset (v0.3)

**Revue de code (3 couches adversariales : Blind Hunter, Edge Case Hunter, Acceptance Auditor).** Aucun bug bloquant ; refactor sain. Corrections appliquées :
- **Voile (AC5) — vrai défaut, consensus des 3 couches, corrigé.** Les tokens `--voile-*` étaient morts et le test « prouvait » des constantes non utilisées, tandis que le texte se posait dans la bande transparente du dégradé. `.voile-seuil` consomme désormais réellement `var(--voile-couleur)` à `var(--voile-opacite-texte-courant)` (via `color-mix`), dense sur toute la hauteur du texte (fondu confiné au padding haut). Token `opaciteGrandTexte` mort supprimé. `voile.test.ts` vérifie ce qui est **peint** (consommation des tokens + contraste composité), plus une tautologie.
- **`h1` par région** (fin du trou de hiérarchie : une seule `h1` exposée à la fois).
- **Reflow (WCAG 1.4.10)** : régions défilables (`overflow-y:auto` + `margin-top:auto`), plus de rognage au zoom 200 %/paysage court.
- **Panneaux dérivés de `REGIONS`** (fin de la double source de vérité ordre/libellés).
- **Mode -clair** : halo/lune/étoiles neutralisés (plus de couleur codée en dur non adaptée).
- **Focus** entêtes sur `:focus` (armé sur focus programmatique) ; garde de montage robuste au StrictMode ; `aria-current="location"`.
- **Nettoyage** : `.fondu-region` morte retirée, orphelin `public/scene/anam-cutout.png` supprimé, README `lib/scene` corrigé (portée réelle de la garde eslint).
- **Différés assumés (choix produit, documentés, non corrigés)** : bouton Retour navigateur = sortie (nav en view-state, pas d'historique) ; nav visible sur le seuil ; `alt=""` sur le personnage.

**Premier vrai asset intégré.** L'arbre génératif Canvas « Arbre Pomme Magique » (Claude Design), ré-habillé aux tokens Nuit galactique, remplace le SVG placeholder. Il vit dans `render/` (adaptateur muet) et **dessine** `projection.eveil` (0→100) sans le calculer — la croissance réelle et sa monotonie (AD-8) restent au modèle/Epic 4. Rendu **statique** par défaut (sobriété batterie + reduced-motion par construction) ; vie ambiante = ajout futur optionnel. `eveil` est un scalaire **jamais affiché en chiffre** (« on ne note pas les gens »).

### File List

**Nouveaux**
- `lib/scene/regions.ts`, `lib/scene/vue.ts`, `lib/scene/projection.ts` (+ champ `eveil`), `lib/scene/index.ts`
- `render/scene-dom.tsx`, `render/arbre-vivant.tsx` (arbre génératif Canvas, remplace le SVG `arbre-decor` posé puis retiré en revue), `render/monde.module.css`
- `app/icon.svg`
- `tests/scene-modele.test.ts`, `tests/voile.test.ts`, `tests/identite-route.test.ts`, `tests/scene-architecture.test.ts`, `tests/scene-accessibilite.test.ts`

**Modifiés**
- `app/page.tsx` (cible du rendu → `SceneDom projection={projectionInitiale}` ; garde onboarding inchangée)
- `app/layout.tsx` (`title` default+template, `openGraph`, description neutre)
- `app/styles/tokens.ts` (objet `voile`), `app/styles/globals.css` (variables voile + `.voile-seuil`)
- `app/cgu/page.tsx`, `app/(auth)/consentement/page.tsx`, `app/(auth)/entrer/page.tsx`, `app/(auth)/naissance/page.tsx` (`title` → « Anam »)
- `package.json` + `package-lock.json` (retrait `three` / `@types/three`)
- `lib/scene/README.md`

**Supprimés**
- `app/_scene/` (`univers.tsx`, `arbre-vivant.tsx`, `scene-immersive.tsx`, `scene.module.css`)
- `public/scene/univers/` (`anam-presence.png`, `anam-seuil.png`, `anam-veille.png`, `eau.png`)

## Change Log

| Date       | Version | Description                     | Auteur |
|------------|---------|---------------------------------|--------|
| 2026-07-24 | 0.1     | Création de la story (create-story) | Julian (via Anam) |
| 2026-07-24 | 0.2     | Implémentation dev-story — modèle/rendu AD-7, scène 2D sans bord, doublage non-spatial, voile, identité de route « Anam », nettoyage du spike WebGL. 158 tests / tsc / lint / build verts. | Julian (via Anam) |
| 2026-07-24 | 0.3     | Revue de code (3 couches adversariales) appliquée : voile AC5 **réellement** piloté par les tokens et couvrant le texte (plus de fausse garantie), `h1` par région, régions défilables (reflow), panneaux dérivés de `REGIONS`, mode -clair neutralisé, focus/`aria-current` corrigés, tokens/CSS morts retirés. Intégration du **premier vrai asset** : arbre génératif Canvas (« Arbre Pomme Magique ») piloté par `projection.eveil`, en remplacement du SVG placeholder. 160 tests / tsc / lint / build verts. | Julian (via Anam) |
