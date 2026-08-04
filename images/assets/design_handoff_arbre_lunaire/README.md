# Handoff : Arbre de Vie Lunaire (asset canvas, illumination par branche)

> **Remplace la version précédente** (`Arbre de Vie` — brun/or, slider de progression global).
> Changements imposés par le retour BMAD : argent lunaire, illumination **par branche**, harnais de dev supprimé.

## Overview
Arbre de Vie en argent lunaire sur ciel nocturne. **Chaque branche s'illumine indépendamment** :
une branche non vécue reste sombre pendant qu'une autre rayonne. Il n'y a **pas** de progression d'ensemble —
l'arbre remplace la barre de progression, il ne doit jamais y ressembler.
Format portrait, canvas 2D, pan/zoom.

## About the Design Files
Le `.dc.html` est une **référence de design** (prototype), pas du code de production à copier tel quel.
La tâche : **porter cet asset dans l'app** avec ses patterns (React/Vue/natif).
100 % Canvas 2D procédural — aucune image externe. Le cœur à porter est la classe JS, pas le markup.
`support.js` = runtime du prototype, **ne pas porter**.

## Fidelity
**High-fidelity.** Couleurs (au hex près), géométrie et logique d'états sont validées. Reproduire fidèlement.

## Charte (au hex près — ne pas dévier)
| Rôle | Hex |
|---|---|
| Fond ciel | `#0C0A1E` |
| Tronc / racines | `#6A6690` (**ne pas assombrir** — contraste 3.63:1) |
| Branches | `#9A96BE` |
| Feuillage | `#8FB6D8` |
| Lueur (illumination) | `#CDE4F8` nacre |
| Point d'accroche cliquable | `#8FC1EF` |

**Aucun brun, aucun or, aucune veine dorée** — le bois est argenté.
Paliers de feuille : `#262E4E · #3A527A · #6288B2 · #8FB6D8 · #CDE4F8`.
Typo : Marcellus (titres), Instrument Sans (texte).

## Le modèle d'état (le cœur)
13 branches, **une par bulbe de canopée**. Chaque branche porte sa propre valeur `lit ∈ [0,1]`,
totalement indépendante des autres. Aucun état global, aucun « arbre complété ».

| `lit` | État | Rendu |
|---|---|---|
| `0` | **Naissance** | trait fin ~2px nu, argent sombre `#4C4870` + point de lueur nacre à sa base (= point d'accroche) |
| `0 < lit < 1` | **Feuillaison** | le bois s'épaissit, les feuilles se déploient et la lumière monte le long de la branche **base → cime**, par degrés continus. Une feuille apparaît quand `leaf.u ≤ lit` (`u` = position normalisée le long de l'axe branche) |
| `1` | **Rayonnement** | pleine lumière : bois + feuillage baignés d'une lueur nacre **douce et statique**. Aucun fruit, aucun objet suspendu — c'est la branche qui rayonne |

**Point d'accroche** : à ~14 % de la longueur de la branche depuis son hub (évite que les branches d'un même hub aient des ancres superposées). Cliquable, **zone tactile 44 px** ; le clic fait passer `0 → 0.58 → 1 → 0`.

## Interdits absolus
- Aucune animation de croissance en direct
- Aucune particule / luciole / confetti / son
- Aucun compteur, aucun `%`, aucun badge, aucun slider, aucun bouton play
- Aucune aura globale ni « halo de cœur »
- **Toléré uniquement** : léger balancement ambiant du feuillage (≤3.4 px, `sin(time·0.5)`)

## API cible
```jsx
<TreeOfLife
  branchStates={[0, 0.58, 1, ...]}  // 13 valeurs, une par branche — la source de vérité
  onBranchTap={(i) => …}            // remonte l'index de la branche touchée
  sway={true}                       // balancement ambiant du feuillage
/>
```
Les presets du prototype (`Vide` / `Premiers pas` / `En chemin` / `Épanoui`) ne sont que des jeux de démo :
en production, `branchStates` vient des données métier (une branche = un domaine de vie vécu).
`Vide` = tous à 0 → tronc seul et beaucoup de vide (état de départ voulu).

## Architecture du rendu (à porter tel quel — la perf en dépend)
Canvas logique **1408×2503**, `dpr = 0.7` (backing 985×1752), `width:100%; height:auto`.
**4 couches en cache**, jamais redessinées par frame :

| Couche | Recalculée quand | Contenu |
|---|---|---|
| `base` | jamais (une fois) | tronc, racines, leaders, congés, ombre de contact |
| `wood` | un état change | bois des 13 branches (épaisseur selon `lit`) |
| `leaf` | un état change | feuilles (sprites), révélées selon `lit` |
| `glow` | un état change | lueur nacre montante + bloom de bulbe |

Par frame : uniquement 4 `drawImage` + les points d'accroche. Le balancement se fait en **décalant le blit**
de la couche feuilles, jamais feuille par feuille (une boucle par feuille avait gelé le thread principal).

### Géométrie (validée, tracée sur la référence)
- **Tronc** : plonge 210 px sous le sol, se prolonge en pivot. Largeur `36 + 70·exp(−(d/σ)²)`, σ=322 au-dessus / 168 en dessous. Sinuosité `sin(u·3.2)·9 + sin(u·1.6)·26` enveloppée par `sin(uπ)`.
- **Racines** : **ancrées sur la silhouette réelle du tronc** (7 par côté, de −76 px au-dessus du sol à +156 px dessous), elles longent le tronc vers le bas puis s'évasent (courbe concave = raccord sans couture). Enveloppe elliptique `RX=596, RY=980`. ⚠️ Ne **jamais** clamper la *position* des pointes (ça écrase les courbes en droites verticales) — borner la **longueur**.
- **Charpente permanente** : fourche `y=1060` → 3 leaders (fenêtre en cœur au centre).
- **Branches** : 13 hubs→bulbes (positions en dur), + rameaux récursifs (2 niveaux).
- **Feuilles** : 6 silhouettes lancéolées × 5 paliers de lumière (30 sprites), orientées vers l'extérieur.
- **Congés de jonction** : dégradé argent éclairé côté lumière + ombre décalée à l'opposé. ⚠️ Surtout **pas** de disque noir centré.
- Seed RNG **fixe** (`mulberry32(23)`) → arbre identique à chaque chargement.

## Livrable 2 : la planche
Le prototype inclut une **planche de référence** (canvas 1180×700) montrant **une même branche à ses 3 états**
côte à côte + le point d'accroche légendé. À utiliser comme spec visuelle pendant l'intégration ; inutile en prod.

## Files
- `Arbre de Vie Lunaire.dc.html` — prototype final (source de vérité)
- `support.js` — runtime du prototype (ne pas porter)
- `reference.png` — direction artistique d'origine
