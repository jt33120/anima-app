# Handoff : Arbre de Vie (asset génératif animé, croissance 0→100)

> **Remplace l'ancien asset "Arbre Pomme Magique".** Si `MagicAppleTree` existe déjà dans l'app, ce composant le remplace (même API `progress`, plus de pomme).

## Overview
Arbre de Vie stylisé (nuit, bois sombre veiné d'or) qui pousse selon un paramètre `progress` de 0 à 100 :
racines → tronc → ramure → feuillage → **éveil** (l'arbre entier s'illumine, la lumière monte des racines vers la cime).
Symbolise ancrage / évolution / transformation. Format **portrait 9:16** (mobile).

## About the Design Files
Le `.dc.html` est une **référence de design** (prototype), pas du code de production à copier tel quel.
La tâche : **porter cet asset dans l'app** avec ses patterns (React/Vue/natif).
Tout est **du dessin Canvas 2D procédural** — aucune image externe. Le cœur à porter est la classe JS, pas le markup.

## Fidelity
**High-fidelity.** Couleurs, proportions, géométrie, timing et algorithme sont validés. Reproduire fidèlement.

## Fichier source de vérité
`Arbre de Vie.dc.html` → tout est dans le `<script data-dc-script>` (classe `Component`).
`support.js` = runtime du prototype, **ne pas porter** (sert seulement à ouvrir le HTML en local).

## API cible

```jsx
<TreeOfLife
  progress={0..100}     // pilote toute la croissance (slider, scroll, score…)
  autoplay={false}      // cycle de croissance en boucle
  lumiere="Or"          // "Or" | "Cyan"
  showControls={true}   // slider + play + jalons intégrés
  background="Nuit"     // "Nuit" | "Aube" | "Neutre"
/>
```

- `progress` est **animé en interne** (interpolation ease vers la cible, ~6/s) : passer une valeur brute suffit, la transition est fluide.
- Canvas logique **1408×2503** (ratio 9:16), `width:100%; height:auto`.
- **Slider intégré** (`showControls`) : `<input type=range 0..100>` + bouton play + 5 pastilles de jalon. Si l'app a son propre contrôle, passer `showControls={false}` et piloter par `progress`.

## Architecture du rendu (à porter tel quel)

**3 couches, 2 caches** — la performance en dépend :

| Couche | Quand elle est recalculée | Contenu |
|---|---|---|
| `wood` (cache) | `progress` change (seuil 0.008) | tronc, racines, branches, congés de jonction |
| `leafCanvas` (cache) | idem | ~3000 feuilles individuelles |
| composite (chaque frame) | 60 fps | blit des 2 caches + halos + lucioles + illumination |

⚠️ Ne **jamais** redessiner les feuilles par frame (c'était la cause d'un gel du thread principal).
Le balancement du feuillage se fait en décalant le blit du cache (`sin(time)`), pas feuille par feuille.
`dpr` volontairement à **0.7** (backing 985×1752) : le canvas est énorme, c'est le compromis netteté/perf validé.

### Géométrie (tracée sur la référence)
- **Tronc** : plonge **210 px sous le sol** et se prolonge en pivot. Largeur = `36 + 70·exp(−(d/σ)²)` (σ=322 au-dessus du sol, 168 en dessous) → évasement doux, pas de pied massif. Sinuosité en S : `sin(u·3.2)·9 + sin(u·1.6)·26`, enveloppée par `sin(uπ)`.
- **Racines** : **ancrées sur la silhouette réelle du tronc** (point d'attache calculé sur son contour, 7 par côté, de −76 px au-dessus du sol à +156 px dessous). Elles **longent le tronc vers le bas puis s'évasent** (courbe concave = raccord sans couture). Épaisseur héritée : 30–46 % de la largeur locale du tronc. Enveloppe elliptique `RX=596, RY=980` : l'éventail s'arrête à l'ellipse (large près du sol ~1300 px, resserré en profondeur ~300 px).
  ⚠️ Ne **jamais** clamper la *position* des pointes (ça écrase les courbes en droites verticales) — borner la **longueur**.
- **Ramure** : fourche en cœur à `y=1060` → 3 leaders (2 latéraux + 1 central) → branches vers **13 bulbes** de canopée (positions en dur dans `this.bulbs`) → rameaux récursifs qui remplissent chaque bulbe.
- **Feuilles** : 6 silhouettes lancéolées pré-rendues × 5 niveaux de lumière (30 sprites). Chacune est **orientée vers l'extérieur** (mélange direction-depuis-la-fourche / direction-depuis-le-centre-du-bulbe). Éclairage = f(hauteur, position dans le bulbe, distance au bord, aléa).
- **Congés de jonction** : à chaque fourche, un dégradé **couleur bois** (éclairé côté lumière) + ombre décalée à l'opposé + veine d'or continue. ⚠️ Surtout **pas** de disque noir centré (ancien défaut).

## Timing des étapes (t = progress/100)
| t | Étape |
|---|---|
| 0 → 0.14 | tronc + pivot |
| 0.02 → 0.26 | racines (par vagues) |
| 0.12 → 0.30 | leaders |
| 0.28 → 0.60 | branches vers les bulbes |
| 0.40 → 0.72 | rameaux |
| 0.42 → 0.96 | feuillage (révélé du tronc vers l'extérieur) |
| 0.40 → 1 | halo du cœur (fenêtre entre les leaders) |
| 0.60 → 0.92 | lucioles dorées |
| **0.72 → 1** | **éveil : illumination montante racines → cime** |

Jalons UI : Ancrage (<10) · Tronc (<24) · Ramure (<52) · Feuillage (<82) · Éveil (≥82).

## Design Tokens
- Fond : `radial-gradient(95% 72% at 50% 32%, #0c1826, #060d16 42%, #010204)` — le canvas lui-même est **transparent**.
- Bois : `#5c4526 → #2b1f12 → #0c0906`, arêtes `rgba(150,112,60,.3)` / `rgba(0,0,0,.55)`, stries `rgba(120,92,52,·)`.
- Veines d'or (permanentes) : `rgba(255,150,50,·)` + `rgba(255,210,124,·)`.
- Feuilles (5 paliers) : `#121e30 · #243c5c · #486c94 · #8caed2 · #cee0f4`.
- Lumière « Or » : halo `255,150,50` / mid `255,196,110` / core `255,232,168`. « Cyan » : `70,160,255` / `120,200,255` / `224,246,255`.
- Typo : Marcellus (titre), Instrument Sans (UI). Accent UI : `#ffb14d`.

## Notes d'intégration
- Seed RNG **fixe** (`mulberry32(23)`) → l'arbre est identique à chaque chargement. Exposer `seed` en option si des variantes sont voulues.
- L'animation utilise `requestAnimationFrame` : elle **se met en pause quand l'onglet est masqué** (comportement navigateur normal).
- Prévoir `cancelAnimationFrame` au démontage (déjà fait dans le prototype).

## Files
- `Arbre de Vie.dc.html` — prototype final (source de vérité)
- `support.js` — runtime du prototype (ne pas porter)
- `reference.png` — direction artistique d'origine
