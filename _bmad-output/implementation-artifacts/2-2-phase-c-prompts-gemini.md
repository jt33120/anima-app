# Story 2.2 — Phase C : prompts Gemini (assets Anam Présence & Veille)

Production visuelle hors-code (Julian, via Gemini). **Non bloquant** : `ImageAnam` a un repli plumeux
CSS tant que les assets manquent (aucune image cassée, build OK). En 2.2, seule la **Présence** est
réellement rendue (beat « ouverture ») ; la **Veille** est produite pour un usage ultérieur.

## 1. Contexte à donner à Gemini (à joindre)

Pour la COHÉRENCE du personnage (même visage, cheveux, robe, style), joindre à chaque génération :

1. **La bible du personnage** — `images/anam-gemini/Gemini_Generated_Image_wjvr97wjvr97wjvr.png`
   (feuille « Déclinaisons d'usage : Anam » : Colonne 2 = **Présence**, Colonne 3 = **Veille**).
2. **Le Seuil déployé** (verrou de palette/style) — `public/scene/anam-seuil.png`.

Consigne à Gemini : *« Garde exactement le même personnage que la référence jointe : visage, cheveux
auburn ondulés, robe iridescente argent-bleu, lotus bleu lumineux, style peinture douce romantique,
palette nuit profonde. »* Utiliser la génération d'image de Gemini (2.5 Flash Image / « Nano Banana »)
**avec la ou les images de référence attachées**.

## 2. Le fond : DÉTOURAGE obligatoire (leçon terrain)

⚠️ **Corrigé après test réel** : générer « sur fond sombre pour que ça se fonde » NE MARCHE PAS — le
fond des PNG Gemini (mauve `#574B5F` / bleu `#343549`) est bien plus clair que `--fond` `#0C0A1E` →
un **rectangle visible** + le **watermark ✦**. Il faut **détourer** (fond transparent).

Pipeline retenu (dans `scripts/generer-assets-anam.mjs`) :
1. **Matte IA** avec `rembg` (U2Net) → cutout transparent qui suit les cheveux, supprime fond +
   watermark. Commande dans l'en-tête du script.
2. **Bas plumeux** (sharp) → le buste coupé net se dissout dans la nuit (« émerge de l'ombre »).
3. Formats + tailles → `public/scene/…`.

Le prompt peut donc garder un fond nuit (`#0C0A1E`) — c'est le détourage qui fait le vrai travail.

## 3. Prompt PRÉSENCE (le format utilisé en 2.2) — buste, cadrage dialogue

Format cible : **portrait 4:5**. À coller tel quel (l'anglais donne des résultats plus fidèles) :

```
Soft painterly digital illustration, romantic ethereal storybook style, exactly matching the
attached character reference (same face, same auburn wavy hair, same iridescent gown, same style).
Portrait bust of the young woman: long wavy auburn hair, fair luminous skin, a calm serene gentle
gaze looking softly toward the viewer, wearing an iridescent silver-blue shimmering gown with a
sequined bodice. A single small glowing blue lotus flower tucked near her hair by her ear, casting
a soft cyan glow that lightly lights her face. Framing: head and shoulders (bust), centered.
Background: solid deep midnight blue-black (#0C0A1E); her hair, shoulders and the outer edges of the
image softly dissolve and fade into the dark background — a feathered vignette, NO hard border, NO
frame, NO circle, NO ring. Gentle rim light from the lotus. Muted midnight palette (indigo,
silver-blue, lilac). Vertical 4:5 portrait. Painterly soft edges, high detail on the face. No text,
no watermark, no logo.
```

## 4. Prompt VEILLE (pour plus tard) — de dos / effacée

Format cible : **portrait 2:3**. À coller tel quel :

```
Soft painterly digital illustration, romantic ethereal storybook style, exactly matching the
attached character reference (same young woman, same auburn hair, same iridescent gown, same style).
She is seen from BEHIND / three-quarter back, turned away, quiet and withdrawn — a resting, watching
presence. Long wavy auburn hair down her back, wearing the flowing iridescent silver-blue gown with
an open back. She gently holds a small glowing blue lotus at her side, its soft cyan glow the
brightest point. Framing: half-to-full figure from behind, centered. Background: solid deep midnight
blue-black (#0C0A1E); her figure and the outer edges softly dissolve into the dark — feathered, NO
hard border, NO frame. Muted midnight palette. Vertical 2:3 portrait. Understated and faded,
painterly soft edges. Face not visible (turned away). No text, no watermark, no logo.
```

## 5. Où déposer les fichiers (chemins attendus par `ImageAnam`)

```
public/scene/presence/anam-presence.avif      public/scene/presence/anam-presence@2x.avif
public/scene/presence/anam-presence.webp      public/scene/presence/anam-presence@2x.webp
public/scene/presence/anam-presence.png       public/scene/presence/anam-presence@2x.png
public/scene/veille/anam-veille.avif          public/scene/veille/anam-veille@2x.avif
public/scene/veille/anam-veille.webp          public/scene/veille/anam-veille@2x.webp
public/scene/veille/anam-veille.png           public/scene/veille/anam-veille@2x.png
```

## 6. ⚠️ Piège : il faut LES TROIS formats (avif + webp + png), pas seulement le PNG

`ImageAnam` sert les formats via `<picture><source avif><source webp><img png>`. Un navigateur qui
supporte l'AVIF **choisit** la source AVIF ; si seul le PNG est présent, l'AVIF manquant échoue et le
composant affiche le **repli plumeux** (pas le PNG). → fournir **avif + webp + png** (et les `@2x`).

**Solution simple** : un script de conversion (à demander à l'agent) prend les 2 PNG bruts de Gemini
et produit tous les formats + tailles + les range aux bons chemins, en une commande (via `sharp`).
Génère 2 images, lance le script, terminé.
