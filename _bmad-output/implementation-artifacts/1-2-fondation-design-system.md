---
baseline_commit: 6637ac29d07653d69bb64aef83a9f522ca575bb4
story_key: "1-2-fondation-design-system"
epic: 1
story: 2
title: "Fondation du design system — tokens, typographies, mouvement et accessibilité"
epic_name: "Franchir le seuil"
covers: [UX-DR-1, UX-DR-2, UX-DR-4, UX-DR-5, UX-DR-6, UX-DR-39, NFR-016]
depends_on: ["1-1-echafaudage-couches-rls"]
status: done # livrée et en prod depuis juillet ; corrigé le 2026-08-07 (disait `ready-for-dev`). Revue de code DUE.
created: "2026-07-22"
sources:
  - _bmad-output/planning-artifacts/epics.md#epic-1--story-1-2
  - _bmad-output/planning-artifacts/ux-designs/ux-Anima-2026-07-21/DESIGN.md
  - _bmad-output/planning-artifacts/architecture/architecture-Anima-2026-07-22/ARCHITECTURE-SPINE.md
---

# Story 1.2 : Fondation du design system — tokens, typographies, mouvement et accessibilité

Status: done

<!-- Note : validation optionnelle. Lancer validate-create-story avant dev-story pour un contrôle qualité. -->

## Story

En tant que **dev**,
je veux **poser le socle visuel d'Anam — les tokens de couleur « Nuit galactique », les deux familles typographiques variables, les primitives d'espacement et de mouvement, et le mode d'accessibilité à contraste renforcé — avec un test de contraste qui casse le build**,
afin que **chaque écran suivant se compose sur un système cohérent, accessible et vérifié plutôt que sur des valeurs improvisées** — l'équivalent visuel de la preuve RLS de la Story 1.1.

## Acceptance Criteria

1. **Étant donné** le système de couleur **Quand** les tokens sont définis **Alors** le mode sombre natif « Nuit galactique » est le mode principal (tokens sans suffixe : `fond #0C0A1E`, `surface #16132F`, `surface-elevee #201C42`, `texte #EEECF7`, `texte-doux #ABA6C9`, `bordure #2A2648`, `bordure-forte #77719C`, `accent #8FC1EF`, `lueur #CDE4F8`) **Et** chaque token porte sa variante `-clair` pour le mode d'accessibilité (UX-DR-1, UX-DR-2).

2. **Étant donné** les paires texte-sur-fond **Quand** le contraste est mesuré **Alors** chaque paire atteint au moins WCAG AA (4,5:1 texte courant, 3:1 grand texte et `bordure-forte`), en mode sombre **comme** en mode accessibilité **Et** un token qui échoue le ratio **casse le build** (UX-DR-39, NFR-016).

3. **Étant donné** les deux familles typographiques **Quand** l'échelle est posée **Alors** Fraunces porte la voix d'Anam (WONK 0, SOFT 20-30, graisse ≤ 500, opsz suivant la taille) et Inter l'interface et les mots de l'utilisatrice, sur l'échelle display / titre / titre-sm / anam / corps / meta / surtitre / bouton — aucune capitale, aucune graisse > 500, interligne ≥ 1.6, tout en rem (UX-DR-4).

4. **Étant donné** les primitives d'espacement et de mouvement **Quand** elles sont définies **Alors** l'espacement suit la base 8px (4-8-12-16-24-32-48-64-96) et le mouvement est un fondu lent (durées 180 / 320 / 700 / 4200ms, courbe unique `cubic-bezier(0.32,0.08,0.24,1)`, aucun rebond ni overshoot, dérive verticale ≤ 6px), exposé comme primitives de fondu texte / image / personnage / région (UX-DR-5, UX-DR-6).

5. **Étant donné** le mode d'accessibilité « contraste renforcé / imagerie atténuée » **Quand** l'utilisatrice l'active (`prefers-contrast: more` ou l'attribut `data-a11y="contraste"`) **Alors** les tokens `-clair` prennent le relais et l'imagerie est atténuée, sans jamais devenir un thème jour de confort **Et** ce mode est vérifié au même niveau que le mode sombre (UX-DR-1).

6. **Étant donné** `prefers-reduced-motion: reduce` **Quand** il est actif **Alors** les primitives de fondu sont neutralisées (transitions ≤ 0/180ms, sans dérive) **Et** aucune information n'est jamais portée par le seul mouvement (UX-DR-6).

## Tasks / Subtasks

- [x] **Tâche 1 — Polices variables self-hostées via `next/font/local`** (AC : 3)
  - [x] Récupérer les fichiers de police **variables** au format `.woff2` et les committer dans `app/styles/fonts/` :
    - **Fraunces** — le woff2 variable qui porte les **4 axes** `opsz, SOFT, WONK, wght` (source : dépôt officiel `undercasetype/Fraunces`, `fonts/variable/Fraunces[SOFT,WONK,opsz,wght].woff2` — **roman seulement**, pas d'italique). Vérifier avec `fc-scan`/`wakamai-fondue` que les 4 axes sont bien dans le fichier avant de l'adopter.
    - **Inter** — `InterVariable.woff2` (source : `rsms/inter`, ou `@fontsource-variable/inter`).
  - [x] Créer `app/styles/polices.ts` : deux appels `localFont` (`next/font/local`) exposant chacun une **variable CSS** — `--police-anam` (Fraunces) et `--police-ui` (Inter). Pour Fraunces : `weight: '100 900'`, `style: 'normal'`, `display: 'swap'`. Les axes non-standard (opsz/SOFT/WONK) **ne se déclarent pas** ici : ils se pilotent en CSS via `font-variation-settings` (le woff2 les contient déjà — c'est l'avantage de `local` sur `google`).
  - [x] Dans `app/layout.tsx` : importer les deux polices et appliquer `${policeAnam.variable} ${policeUi.variable}` sur la className de `<html>` (conserver `<body suppressHydrationWarning>` posé en 1.1).
  - [x] Piles de repli (dans `globals.css`) : `var(--police-anam), 'Iowan Old Style', Georgia, serif` · `var(--police-ui), -apple-system, 'Segoe UI', system-ui, sans-serif`.
  - [x] **Ne PAS utiliser `next/font/google`** : sur Next 16.2 le fetch Google au build peut échouer et rendre la CI bloquante flaky (bug documenté). Self-host local = build déterministe, zéro requête externe (privacy art.9).

- [x] **Tâche 2 — Source de vérité des tokens + variables CSS (`:root` nuit + `-clair`)** (AC : 1, 4)
  - [x] Créer `app/styles/tokens.ts` — **SOURCE DE VÉRITÉ UNIQUE**, données pures typées (aucun import Next/infra) : `couleursNuit`, `couleursClair`, `echelleTypo`, `espacement`, `mouvement`. Copier les valeurs **exactes** du tableau Dev Notes → *Tokens*. C'est ce module qu'importe le test de contraste.
  - [x] Créer `app/styles/globals.css` : bloc `:root { … }` portant **toute** la palette nuit en variables CSS (`--fond: #0C0A1E;` etc.), plus les tokens d'espacement (`--esp-1`…`--esp-9`, marges, `--mesure`, `--contenu-max`, `--cible-tactile`), de rayon (`--rayon-sm/DEFAULT/md/lg/full`) et de mouvement (durées, `--courbe`).
  - [x] Poser les styles de base : `html { color-scheme: dark; }`, `body { background: var(--fond); color: var(--texte); font-family: <pile Inter>; }`, `box-sizing: border-box`, marges à 0. **Aucun** `@media (prefers-color-scheme: light)` vers un thème jour — ce media query, s'il est branché, pointe vers le mode accessibilité (Tâche 5), jamais vers un décor de jour.
  - [x] Importer `./styles/globals.css` dans `app/layout.tsx`.
  - [x] Mettre à jour `app/page.tsx` pour prouver visuellement le socle : un fond `--fond`, un titre en rôle `display` (Fraunces), un paragraphe `corps` (Inter) — remplacement du placeholder brut de 1.1. **Pas de composant produit** (l'arbre, la conversation, les cartes sont des stories ultérieures).

- [x] **Tâche 3 — Échelle typographique + règles dures** (AC : 3)
  - [x] Dans `globals.css`, définir des classes de rôle (ou `@layer`/custom props) pour les 8 rôles, **tout en `rem`** : `display` (Fraunces 2rem / **2.5rem ≥768px**, interligne 1.15, `font-variation-settings: 'opsz' 48,'SOFT' 30,'WONK' 0`, wght 400), `titre` (1.5rem/1.25, opsz 32), `titre-sm` (1.125rem/1.35, opsz 20, wght 500), `anam` (**1.1875rem/1.6**, opsz 14, SOFT 20, la parole d'Anam), `corps` (Inter 1rem/1.65), `meta` (0.8125rem/1.45), `surtitre` (0.75rem/1.4, `letter-spacing:0.06em`, **casse normale**), `bouton` (Inter 0.9375rem/1, wght 500).
  - [x] **Règles dures vérifiables** : jamais `text-transform: uppercase` ; jamais de graisse > 500 (les deux familles) ; interligne ≥ 1.6 sur tout texte de lecture (`corps`, `anam`) ; jamais sous 13px nulle part. Encoder ces bornes dans `tokens.ts` pour que le test les vérifie (Tâche 6).
  - [x] Le `surtitre` se distingue par l'interlettrage + la couleur `texte-doux`, **pas** par la casse (FR-083).

- [x] **Tâche 4 — Primitives de mouvement & d'espacement, `prefers-reduced-motion`** (AC : 4, 6)
  - [x] Exposer les **primitives de fondu** comme classes/utilitaires réutilisables (`.fondu-texte`, `.fondu-image`, `.fondu-personnage`, `.fondu-region`) : transition d'opacité 0→1 aux durées 320 / 700 / 700 / 700ms, courbe `var(--courbe)` = `cubic-bezier(0.32,0.08,0.24,1)`, dérive `translateY(6px)→0` **optionnelle** (jamais latérale). **Aucun** rebond, ressort ou overshoot.
  - [x] Réserver la **respiration** (4200ms, échelle 1→1.03) comme keyframe nommée `respiration` (servira au `signe-anam`, story ultérieure) — la définir mais ne l'appliquer nulle part ici.
  - [x] Bloc `@media (prefers-reduced-motion: reduce)` : toute durée > 180ms tombe à 0 ; les fondus deviennent opacité seule ≤ 180ms **sans dérive** ; `animation` de `respiration` désactivée. Règle transverse : **aucune information portée par le seul mouvement**.
  - [x] Espacement : générer les variables `--esp-1..9` = 4/8/12/16/24/32/48/64/96px, `--marge-mobile:20px`, `--marge-desktop:48px` (≥768px), `--respiration:40px` (écart entre tours), `--mesure:32rem`, `--contenu-max:40rem`, `--cible-tactile:44px`.

- [x] **Tâche 5 — Mode accessibilité « contraste renforcé / imagerie atténuée »** (AC : 5)
  - [x] Dans `globals.css`, définir le relais `-clair` sur **deux** déclencheurs équivalents : `:root[data-a11y="contraste"] { … }` **et** `@media (prefers-contrast: more) { :root { … } }`. Les deux réaffectent **toutes** les variables de couleur vers leurs valeurs `-clair` (`--fond: #F3F1FB;` etc.) + `html { color-scheme: light; }`.
  - [x] **Imagerie atténuée** : prévoir un hook CSS (ex. `[data-a11y="contraste"] .imagerie { … }` / variable `--imagerie-opacite`) qui remplace les fonds illustrés par des aplats. Pas d'imagerie à atténuer dans cette story (aucun écran produit) → **poser le mécanisme et le documenter**, l'appliquer réellement quand l'imagerie arrivera.
  - [x] Ce mode **n'est pas** un thème jour de confort et **ne se propose jamais** comme préférence de style : uniquement `prefers-contrast: more` ou le futur réglage « Lisibilité renforcée » (l'UI de réglage est une story ultérieure ; ici seulement l'attribut `data-a11y` + la media query).
  - [x] Vérifié au **même niveau** que la nuit : le test de contraste (Tâche 6) couvre **les deux** jeux de tokens.

- [x] **Tâche 6 — Le gate de contraste qui casse le build (équivalent design de la preuve RLS)** (AC : 2, 3, 5, 6)
  - [x] Créer `app/styles/contraste.ts` — helper **pur, zéro dépendance** : `luminanceRelative(hex)` (linéarisation sRGB : `c/255` ; `≤0.03928 ? /12.92 : ((c+0.055)/1.055)**2.4` ; `L = 0.2126R+0.7152G+0.0722B`) et `ratioContraste(hex1, hex2) = (Lclair+0.05)/(Lsombre+0.05)`.
  - [x] Créer `tests/contraste.test.ts` : importer `tokens.ts` + `contraste.ts`, encoder **la liste des paires** des deux tableaux DESIGN.md (§*Contrastes vérifiés — mode nuit* et *— mode accessibilité*) avec leur seuil (4,5:1 texte / 3:1 grand texte & objets graphiques & `bordure-forte`/focus), et **asserter chaque paire ≥ son seuil**. Inclure impérativement les marges les plus serrées — `arbre-tronc/fond = 3,63:1`, `bordure-forte/surface-elevee = 3,54:1`, `arbre-feuillage-clair/fond-clair = 5,00:1`. **Exclure** `bordure/fond` (décoratif, exempté WCAG 1.4.11). Un token modifié qui fait chuter une paire sous son seuil → **test rouge → CI rouge** (AC2).
  - [x] **Écrire une assertion négative** (méthode red-green de 1.1) : vérifier en local qu'en abaissant temporairement un token (ex. `texte` vers un gris qui casse 4,5:1) le test **échoue**, puis restaurer. Documenter dans le Debug Log.
  - [x] Créer `tests/tokens-parite.test.ts` (**garde anti-dérive**) : parser les blocs `:root` et `-clair` de `globals.css`, asserter que **chaque** variable de couleur `--x` égale `tokens.ts` → le CSS ne peut pas diverger de la source de vérité.
  - [x] Créer `tests/typographie.test.ts` : asserter depuis `tokens.ts` qu'aucun rôle n'a de graisse > 500, que `corps`/`anam` ont un interligne ≥ 1.6, qu'aucune taille n'est < 0.8125rem (13px), et qu'aucun rôle ne porte `text-transform: uppercase` (AC3).
  - [x] Créer `tests/accessibilite.test.ts` (garde de présence) : lire `globals.css` et asserter qu'il contient bien les sélecteurs `@media (prefers-reduced-motion: reduce)`, `@media (prefers-contrast: more)` et `[data-a11y="contraste"]` (empêche la régression silencieuse des hooks a11y — AC5, AC6).
  - [x] Vérifier localement : `npx vitest run` → **tous verts** (les 2 tests de 1.1 + les 4 nouveaux). La CI de 1.1 (`.github/workflows/ci.yml`) lance déjà `npm test` → **aucune modif CI nécessaire**, le gate de contraste est bloquant par construction. Confirmer `npm run lint` et `npx tsc --noEmit` verts.

## Dev Notes

### Périmètre STRICT de cette story

Fondation du design-system **uniquement**. **OUI** : tokens (couleur/typo/espace/mouvement) comme source de vérité + variables CSS, les 2 polices variables self-hostées, le mode accessibilité (hooks CSS + media queries), le gate de contraste qui casse le build. **NON** : aucun composant produit (l'`arbre`, la conversation, les `carte`s de bibliothèque, la `fiche-branche`, le `personnage` sont des stories ultérieures) ; **pas** d'UI de réglage « Lisibilité renforcée » (story ultérieure — ici seulement l'attribut `data-a11y` + la media query) ; **pas** d'imagerie réelle (on pose le *mécanisme* d'atténuation, sans image à atténuer) ; **pas** de dark/light toggle de confort (il n'existe pas de thème jour). `app/page.tsx` devient une simple **preuve visuelle** du socle (un titre `display`, un paragraphe `corps`), pas un écran produit.

### Continuité avec la Story 1.1 (déjà committée — `6637ac2`)

- Structure en couches en place ; **garde ESLint** `no-restricted-imports` active sur `lib/domain/**`. Nos fichiers vivent dans `app/` et `tests/` → **hors périmètre de la garde**, aucun conflit. `app/` (couche Vue/Rendu) peut importer `next/font` et tout vers le bas.
- `app/layout.tsx` porte déjà `<html lang="fr">` (UX-DR-36) et `<body suppressHydrationWarning>` (extensions type Grammarly). **Conserver les deux** ; y ajouter l'import CSS + les variables de police sur `<html>`.
- Runner **Vitest 4.1.10** déjà configuré (`vitest.config.ts`, alias `@`), script `npm test`. Les nouveaux tests s'y branchent sans config.
- La **CI bloquante** (`.github/workflows/ci.yml`) lance `npm run lint` puis `npm test` → le gate de contraste est **automatiquement** bloquant, comme la preuve RLS. Ne pas toucher la CI.
- Pattern établi à répliquer : **prouver l'invariant par un test qui casse le build** (1.1 = RLS deny-by-default ; 1.2 = contraste WCAG AA).

### Où vivent les tokens — respect des couches (AD-1, AD-7, AD-10)

Le design-system est une préoccupation de **présentation** → couche `app/` (Vue/Rendu). Ce **n'est pas** le modèle de scène (`lib/scene/`, qui reste de l'état pur sans rendu, AD-7). Des variables CSS ne sont pas des imports → aucune arête de dépendance créée. `tokens.ts` et `contraste.ts` sont **purs** (aucun import Next/infra) donc importables par `tests/`. Arborescence cible :

```
app/
  layout.tsx            # + import globals.css, + variables de police sur <html>
  page.tsx              # preuve visuelle du socle (remplace le placeholder 1.1)
  styles/
    globals.css         # :root nuit + -clair + base + reduced-motion + a11y
    tokens.ts           # SOURCE DE VÉRITÉ (données pures) — importée par les tests
    contraste.ts        # helper WCAG pur (zéro dépendance)
    polices.ts          # next/font/local → --police-anam, --police-ui
    fonts/              # Fraunces[opsz,SOFT,WONK,wght].woff2 + InterVariable.woff2
tests/
  contraste.test.ts     # GATE : chaque paire ≥ seuil, sinon build rouge
  tokens-parite.test.ts # anti-dérive CSS ↔ tokens.ts
  typographie.test.ts   # graisse ≤500, interligne ≥1.6, ≥13px, pas de capitales
  accessibilite.test.ts # présence des hooks reduced-motion / prefers-contrast / data-a11y
```

### Tokens — valeurs EXACTES (copier dans `tokens.ts` et `globals.css`)

> Source : `DESIGN.md` (frontmatter + §Colors). **Toutes les valeurs nuit et `-clair` ont un ratio WCAG déjà calculé et vérifié dans DESIGN.md** ; le test les re-vérifie par le calcul. Ne pas « ajuster à l'œil ».

**Couleurs — mode nuit (sans suffixe) :**
`fond #0C0A1E` · `surface #16132F` · `surface-elevee #201C42` · `texte #EEECF7` · `texte-doux #ABA6C9` · `bordure #2A2648` · `bordure-forte #77719C` · `accent #8FC1EF` · `accent-doux #241F47` · `sur-accent #0C0A1E` · `arbre-tronc #6A6690` · `arbre-branche #9A96BE` · `arbre-feuillage #8FB6D8` · `succes #86B79E` · `alerte #D0A05C` · `lueur #CDE4F8`

**Couleurs — mode accessibilité (`-clair`) :**
`fond-clair #F3F1FB` · `surface-clair #FBFAFE` · `surface-elevee-clair #FFFFFF` · `texte-clair #1B1836` · `texte-doux-clair #4C476B` · `bordure-clair #DCD8EE` · `bordure-forte-clair #565179` · `accent-clair #265F91` · `accent-doux-clair #E2ECF8` · `sur-accent-clair #FFFFFF` · `arbre-tronc-clair #5A5680` · `arbre-branche-clair #4A4670` · `arbre-feuillage-clair #3C6C93` · `succes-clair #3B7357` · `alerte-clair #8A5A16` · `lueur-clair #3C6C93`

**Rayons :** `sm 4px` · `DEFAULT 8px` · `md 12px` · `lg 16px` · `full 9999px`
**Espacement (base 8) :** `1:4 2:8 3:12 4:16 5:24 6:32 7:48 8:64 9:96` (px) · `marge-mobile 20px` · `marge-desktop 48px` · `respiration 40px` · `mesure 32rem` · `contenu-max 40rem` · `cible-tactile 44px`
**Mouvement :** `courte 180ms` · `standard 320ms` · `longue 700ms` · `respiration 4200ms` · courbe `cubic-bezier(0.32,0.08,0.24,1)` · rebond **interdit** · dérive **≤6px verticale**

**Échelle typo (tout en rem) :**

| Rôle | Famille | Taille | Interligne | `font-variation-settings` / graisse |
|---|---|---|---|---|
| `display` | Fraunces | 2rem (**2.5rem ≥768px**) | 1.15 | `'opsz' 48,'SOFT' 30,'WONK' 0`, wght 400 |
| `titre` | Fraunces | 1.5rem | 1.25 | `'opsz' 32,'SOFT' 30,'WONK' 0`, wght 400 |
| `titre-sm` | Fraunces | 1.125rem | 1.35 | `'opsz' 20,'SOFT' 30,'WONK' 0`, wght 500 |
| `anam` | Fraunces | 1.1875rem | 1.6 | `'opsz' 14,'SOFT' 20,'WONK' 0`, wght 400, `letter-spacing 0.005em` |
| `corps` | Inter | 1rem | 1.65 | wght 400 |
| `meta` | Inter | 0.8125rem | 1.45 | wght 400 |
| `surtitre` | Inter | 0.75rem | 1.4 | wght 500, `letter-spacing 0.06em`, casse normale |
| `bouton` | Inter | 0.9375rem | 1 | wght 500, `letter-spacing 0.01em` |

### Intégration des polices — `next/font/local` (décision vérifiée sur le web 2026-07-22)

- **Choix : self-host local, PAS `next/font/google`.** Raisons : (1) sur **Next 16.2**, le fetch Google au build peut échouer (« Failed to fetch Google Fonts ») → CI bloquante flaky ([vercel/next.js#76473](https://github.com/vercel/next.js/discussions/76473)) ; (2) zéro requête navigateur→Google = **privacy** (cohérent art.9, aucune donnée perso transférée) ; (3) avec `local`, les axes non-standard opsz/SOFT/WONK **n'ont pas à être déclarés** — ils sont dans le woff2 et pilotés en CSS via `font-variation-settings` ([vercel/next.js#67716](https://github.com/vercel/next.js/discussions/67716)). `next/font` self-hoste de toute façon au build ; on supprime juste la dépendance réseau.
- **Fraunces variable** doit contenir les 4 axes `opsz, SOFT, WONK, wght` dans **un seul** woff2 (dépôt `undercasetype/Fraunces`). `WONK` se substitue automatiquement au-delà d'opsz 18 : on le **force à 0 partout** via `font-variation-settings` (DESIGN.md : les variantes wonky basculent vers « boutique ésotérique »).
- `localFont({ src:'./fonts/…woff2', variable:'--police-anam', weight:'100 900', display:'swap' })`. Piles de repli dans le CSS (voir Tâche 1).
- **Vérifier au moment de l'install** : la présence effective des 4 axes dans le woff2 (`wakamai-fondue`/`fc-scan`) et l'API `next/font/local` en Next 16 (ne rien inventer).

### Le gate de contraste — algorithme WCAG 2.x (à implémenter tel quel)

```
canalLineaire(c8bits): c = c8bits/255 ; return c <= 0.03928 ? c/12.92 : ((c+0.055)/1.055)**2.4
L(hex): [r,g,b] = parseHex(hex) ; return 0.2126*canalLineaire(r) + 0.7152*canalLineaire(g) + 0.0722*canalLineaire(b)
ratio(h1,h2): L1=L(h1) ; L2=L(h2) ; return (max(L1,L2)+0.05) / (min(L1,L2)+0.05)
```

Seuils : **4,5:1** texte courant ; **3:1** grand texte (`display`,`titre`) + objets graphiques + `bordure-forte`/focus + parties de l'arbre. Les ratios attendus sont dans les tableaux DESIGN.md — le test recalcule et compare, il ne fait pas confiance aux nombres écrits. **`bordure/fond` (1,36:1) est exclu** (séparateur décoratif, exempté WCAG 1.4.11).

### Anti-patterns à prévenir (ne PAS faire)

- ❌ **Dupliquer les hex** entre `tokens.ts` et `globals.css` sans garde → la garde de parité (`tokens-parite.test.ts`) rend `tokens.ts` la source **imposée**.
- ❌ `next/font/google` (fragilité CI + requête externe).
- ❌ Un `@media (prefers-color-scheme: light)` qui bascule vers un **thème jour** de confort — il n'existe pas ; seul le mode accessibilité existe.
- ❌ `text-shadow` comme substitut de contraste, capitales, graisse > 500, emoji, tailles < 13px (FR-083, DESIGN.md).
- ❌ Poser un composant produit (arbre, conversation, cartes) — **hors périmètre**.
- ❌ Toucher `lib/` (surtout `lib/domain/`, `lib/scene/`) : rien du design-system n'y remonte.

### References

- [Source : epics.md#Epic 1 → Story 1.2] — story, 6 critères d'acceptation, UX-DR couverts.
- [Source : DESIGN.md#frontmatter (colors/typography/spacing/components)] — valeurs exactes des tokens.
- [Source : DESIGN.md#Colors → Contrastes vérifiés (nuit & accessibilité)] — paires + seuils + marges serrées.
- [Source : DESIGN.md#Mouvement, fondu & respiration] — durées, courbe, reduced-motion.
- [Source : DESIGN.md#Typography] — Fraunces/Inter, axes, échelle, règles dures.
- [Source : ARCHITECTURE-SPINE.md#AD-1/AD-7/AD-10] — couches ; design = présentation (`app/`), pas modèle de scène.
- [Source : Story 1.1 (`1-1-echafaudage-couches-rls.md`) — File List, garde ESLint, Vitest, CI bloquante] — continuité et pattern « prouver par un test bloquant ».
- [Web 2026-07-22 : vercel/next.js#76473 (échec fetch Google au build), #67716 (variable local), #64959/#64960 (axes)] — décision `next/font/local`.

## Dev Agent Record

### Implementation Plan

Ordre des tâches respecté (1→6). Polices variables self-hostées d'abord (axes vérifiés avant adoption), puis source de vérité `tokens.ts` + `globals.css` miroir, puis le gate de contraste sur le modèle red-green de la Story 1.1. **Aucune dépendance ajoutée** (helper WCAG fait maison). Périmètre strict tenu : aucun composant produit, `page.tsx` réduite à une preuve visuelle du socle.

### Agent Model Used

Claude Opus 4.8 (1M) — bmad-dev-story.

### Debug Log References

- **Axes Fraunces vérifiés par fonttools** (via `uv --with fonttools --with brotli`) : `opsz(9-144), wght(100-900), SOFT(0-100), WONK(0-1)` présents dans le woff2 → pas de HALT.
- **Inter** : le fichier Fontsource `latin-full-normal.woff2` n'existe pas (404) — Inter n'a pas de variante « full ». Récupéré `latin-wght-normal.woff2` (axe `wght` seul ; on n'utilise que 400/500).
- **Test typo initialement rouge** sur `surtitre` 12px < plancher 13px. Corrigé la **règle**, pas la valeur : `surtitre` est une exception documentée DESIGN.md (étiquette 12px sur zone protégée). Plancher général 13px conservé, exception `tailleMinExceptionRem` encodée dans `tokens.ts`.
- **Preuve red-green du gate** : `texte` abaissé à `#5A5A5A` → 4 paires rouges (`texte/fond`, `/surface`, `/surface-elevee`, `/accent-doux`) → build cassé comme attendu → restauré à `#EEECF7` → vert.

### Completion Notes List

- ✅ Polices Fraunces + Inter **variables self-hostées** (`next/font/local`) — **zéro requête externe** au build comme au runtime (CI déterministe, privacy art.9). Axes Fraunces vérifiés empiriquement.
- ✅ `tokens.ts` = **source de vérité** ; `globals.css` la reflète ; **garde de parité anti-dérive** → le CSS ne peut plus diverger d'une seule valeur.
- ✅ Palette Nuit (natif) + `-clair` (accessibilité), échelle typo 8 rôles avec axes Fraunces pilotés en CSS, espacement base-8, primitives de fondu, `prefers-reduced-motion`, mode accessibilité sur deux déclencheurs (`prefers-contrast: more` + `data-a11y="contraste"`).
- ✅ **Gate de contraste bloquant (AC2) — preuve red-green faite.** Un token qui casse un ratio WCAG casse le build : le jumeau design de la preuve RLS de 1.1.
- ✅ Régression : **88/88 tests verts** (2 de 1.1 + 86 nouveaux). `tsc --noEmit` + `eslint .` verts. **`next build` prod OK** (polices + CSS compilent, pages générées).
- ✅ `page.tsx` = preuve visuelle du socle (remplace le placeholder 1.1). **Aucun composant produit** (périmètre tenu).
- ⚠️ `next build` signale des lockfiles multiples (un `package-lock.json` traîne dans `~/`) → Turbopack choisit `~/` comme racine. Avertissement **environnemental hors périmètre 1.2**, build réussi ; à nettoyer côté machine.
- ℹ️ Supabase local requis seulement pour le test RLS de 1.1 (relancé via Docker pour la régression). La 1.2 ne touche aucune couche données.

### File List

- **Nouveaux** :
  - `app/styles/tokens.ts` (source de vérité), `app/styles/globals.css` (variables CSS + base + typo + mouvement + a11y), `app/styles/contraste.ts` (helper WCAG pur), `app/styles/polices.ts` (next/font/local)
  - `app/styles/fonts/fraunces-variable.woff2`, `app/styles/fonts/inter-variable.woff2`
  - `tests/contraste.test.ts` (le gate), `tests/tokens-parite.test.ts`, `tests/typographie.test.ts`, `tests/accessibilite.test.ts`
- **Modifiés** :
  - `app/layout.tsx` (import `globals.css` + variables de police sur `<html>` ; `lang="fr"` et `suppressHydrationWarning` conservés)
  - `app/page.tsx` (preuve visuelle du socle)

## Change Log

| Date | Version | Description | Auteur |
|---|---|---|---|
| 2026-07-22 | 0.1 | Création de la story (fondation design-system + gate de contraste bloquant) | create-story |
| 2026-07-23 | 0.2 | Implémentation : tokens (source de vérité), polices variables self-hostées, mouvement/espacement, mode accessibilité + gate de contraste bloquant (preuve red-green) ; 88/88 tests, build prod OK | dev-story |

## Status

done

> **Revue de code : 2026-08-13.** Fermée SANS revue adversariale — motif écrit dans le dossier (surface visuelle, déjà couverte par contraste / cibles tactiles / accessibilité).
> Dossier complet : [`revue-dette-2026-08.md`](revue-dette-2026-08.md).
