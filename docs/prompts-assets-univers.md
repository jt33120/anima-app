# Prompts d'assets — l'univers immersif d'Anam (à passer à Gemini « banana »)

But : produire des **calques séparés** (fond transparent) qui, empilés à des profondeurs
différentes, forment un univers en parallaxe qui réagit au scroll. Le moteur temps réel
(Claude Code) les compose et les anime. Palette **Nuit galactique** :
`fond #0C0A1E · surface #16132F · texte/argent #EEECF7 · accent lotus #8FC1EF · lueur #CDE4F8`.

> Règle commune à tous : **fond parfaitement transparent (PNG, canal alpha)**, sujet **non rogné**
> (marges vides autour), **peinture douce et onirique** (jamais photoréaliste, jamais sci-fi dur),
> lumière lunaire froide. Si le modèle ne sait pas rendre transparent : **fond uni magenta pur
> `#FF00FF`** (je détoure ensuite).

---

## ⚠️ Contexte à fournir à Gemini (c'est ÇA qui garde Anam cohérente)

Gemini « banana » accepte des **images de référence** en plus du texte. Ce sont elles qui
garantissent que la nouvelle Anam est **la même femme** et que la palette reste la bonne.
Pour chaque génération :

1. **Glisse 1 à 3 images de référence** avant de coller le prompt, puis ajoute la phrase :
   « **même personnage et même style peint que l'image de référence** ».
2. **Références Anam** (pour P1 — cohérence du personnage) — utilise l'une de celles-ci :
   - `images/anam-gemini/Gemini_Generated_Image_wjvr97wjvr97wjvr.png` (la planche des visages/bustes)
   - `images/anam-gemini/Gemini_Generated_Image_iz7e95iz7e95iz7e.png` (corps entier, robe, lotus)
   - ou les découpes déjà propres : `public/scene/anam-seuil.png` (corps entier net) ·
     `public/scene/anam-cutout.png` (détourée)
3. **Référence palette / ambiance** (pour P2 nébuleuse, P3 eau) : joins une image nuit ci-dessus
   en disant « **garde cette palette Nuit galactique** ». Tu peux aussi coller les hex ci-dessous
   dans le prompt.
4. **Transparence** : si Gemini ne sort pas de PNG transparent, demande **fond uni magenta
   `#FF00FF`** — je détoure ensuite.

---

## P1 — Anam détourée, avec le lotus (le sujet, 3 formats)

> Peinture onirique d'Anam : une jeune femme aux **cheveux auburn** ondulés, **robe de nacre
> irisée** fluide et translucide, pieds nus, en **lévitation**, tenant à bout de bras un **lotus
> bleu lumineux** qui irradie une lueur froide. Style illustration peinte, doux, mat, spirituel
> mais sobre. **Éclairage de bord lunaire** (liseré argenté sur les contours). **AUCUN décor** :
> pas de lune, pas d'eau, pas d'étoiles, pas de ciel — **uniquement le personnage et son lotus**,
> **isolé sur fond transparent**, figure entière **centrée et non rognée** avec de la marge vide
> tout autour. Rendu net des bords pour un détourage propre.

Générer **3 cadrages** (même personnage, même style) :
1. **Plan large** — figure entière en lévitation (comme la référence).
2. **Buste** — Anam de face, poitrine et visage, le lotus près des cheveux (pour ses apparitions
   dans le dialogue).
3. **De dos / profil** — elle se retire, effacée (pour les moments de silence).

---

## P2 — Panneaux de nébuleuse (les calques de profondeur du ciel)

Trois bandes **larges et horizontales** (ratio ~21:9), peintes, à empiler du fond vers l'avant.
Chacune **sur fond transparent**, sans bord franc (les nuages se dissolvent dans le vide).

- **P2-a — Ciel lointain** : voûte indigo très profond (`#0C0A1E`) piquée de **poussière d'étoiles
  fine**, une **bande de galaxie** laiteuse en diagonale douce, très estompée. Contraste faible,
  presque un murmure.
- **P2-b — Nébuleuse médiane** : **nuages violets et bleu nuit** translucides, volutes lentes,
  quelques **points de lumière nacrés** (`#CDE4F8`). C'est la couche qui donne la couleur du monde.
- **P2-c — Volutes proches** : **écharpes de brume** bleu-lune très transparentes, filantes,
  destinées à passer vite au premier plan quand on scrolle. Surtout du vide, quelques traînées.

---

## P3 — Silhouettes de premier plan (la profondeur qui frôle)

Éléments **très sombres, presque en ombre chinoise**, sur transparent, pour la parallaxe la plus
proche (ils défilent vite au scroll) :

- **P3-a** — une **ligne d'horizon d'eau** avec de légers reflets argentés, bas de cadre.
- **P3-b** — un **champ de fleurs-étoiles / lotus** stylisé en silhouette basse, semis de points
  de lueur `#CDE4F8`.
- **P3-c** — quelques **herbes / roseaux** fins en silhouette, sur les côtés.

---

## P4 — (optionnel) L'arbre de nuit peint

> Un **arbre de nuit** onirique : **écorce argentée lunaire** (aucun brun), **feuillage bleu-lune**
> en touches fines, **un seul fruit qui luit** (bleu accent, halo nacré), racines étalées. Peinture
> douce, sur **fond transparent**, centré non rogné. Contre un vide (le ciel viendra derrière).

*(Alternative : je garde l'arbre en SVG vectoriel — il est net, animable et se colore tout seul
via les tokens. À voir selon le rendu peint.)*

---

### Après génération

Dépose les fichiers dans `images/anam-univers/` (crée le dossier). Je détoure ce qui doit l'être,
je les découpe en calques, et le moteur les compose en profondeur avec parallaxe au scroll +
étoiles/particules/lumière procédurales par-dessus.
