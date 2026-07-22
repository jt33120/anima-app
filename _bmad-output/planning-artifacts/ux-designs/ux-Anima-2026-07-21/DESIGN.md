---
status: final
created: 2026-07-21
updated: 2026-07-22
sources:
  - _bmad-output/planning-artifacts/prds/prd-Anima-2026-07-21/prd.md
  - _bmad-output/brainstorming/brainstorm-anima-app-2026-07-20/anam-voice.md
  - _bmad-output/brainstorming/brainstorm-anima-app-2026-07-20/claude-design-prompts.md
  - _bmad-output/planning-artifacts/ux-designs/ux-Anima-2026-07-21/.working/color-themes-1.html
  - images/anam-gemini/  # personnage « Anam-la-nuit » — formats Seuil / Présence / Veille + planche du signe (réf. visuelle de la direction)
name: Anam
description: Compagne d'introspection francophone. Direction « Nuit galactique » — indigo profond, violet, lotus bleu lumineux, argent lunaire. Sombre natif, très imagé, texte blanc et petit qui apparaît en fondu. Anam a désormais un visage peint qui paraît aux seuils ; l'arbre de nuit au centre. Rien ne mesure, rien ne brille en vain, rien ne trahit.
palette: "Nuit galactique — mode sombre natif, ratios WCAG recalculés et vérifiés. Les tokens -clair ne sont PLUS un thème jour : ils portent le mode d'accessibilité « contraste renforcé / imagerie atténuée »."
colors:
  # ═══ MODE SOMBRE — MODE NATIF ET QUASI UNIQUE ═══
  # L'app se vit le soir, sur imagerie nocturne. Les tokens SANS suffixe sont la nuit.
  # Il n'existe PAS de thème jour parallèle. Le seul autre mode est un mode
  # d'accessibilité (tokens -clair, plus bas), déclenché par besoin, pas par goût.
  # UI froide et nocturne. La seule chaleur du produit (cheveux auburn) vient du
  # PERSONNAGE peint, jamais de l'interface.
  fond: '#0C0A1E'          # nuit profonde, indigo presque noir — jamais un noir pur, jamais un gris
  surface: '#16132F'       # premier voile de nuit
  surface-elevee: '#201C42' # second et dernier niveau — trois surfaces empilées, c'est une de trop
  texte: '#EEECF7'         # blanc lunaire, très légèrement mauve — jamais #FFFFFF pur (halation sur nuit)
  texte-doux: '#ABA6C9'    # pervenche éteinte — méta, dates, aide. JAMAIS le contenu de l'utilisatrice
  bordure: '#2A2648'       # séparateur purement décoratif — exempté WCAG 1.4.11
  bordure-forte: '#77719C' # tout ce qui délimite un contrôle + anneau de focus — doit rester ≥3:1
  accent: '#8FC1EF'        # LE lotus bleu. Couleur de l'ACTION uniquement (bouton, lien, fruit)
  accent-doux: '#241F47'   # aplat de mise en avant discret — porte du texte `texte`, jamais du `accent`
  sur-accent: '#0C0A1E'    # encre sur remplissage accent (= fond)
  arbre-tronc: '#6A6690'   # écorce LUNAIRE argentée — aucun brun, c'est un arbre de nuit
  arbre-branche: '#9A96BE' # bois clair argenté
  arbre-feuillage: '#8FB6D8' # feuillage bleu-lune
  succes: '#86B79E'        # vert-jade éteint — en texte seulement, jamais en fond ni pastille
  alerte: '#D0A05C'        # ambre lunaire — en texte seulement. PAS de rouge dans ce système
  lueur: '#CDE4F8'         # NOUVEAU — nacre lumineuse : points de lumière, halo du lotus, rosée du fruit, point du signe. N'est PAS l'accent-action
  # ═══ MODE ACCESSIBILITÉ « CONTRASTE RENFORCÉ » — tokens -clair ═══
  # Ce N'EST PAS un thème jour. C'est l'accommodation lisibilité : fond clair,
  # texte quasi-noir (cible AAA quand possible), IMAGERIE ATTÉNUÉE (les fonds
  # illustrés sont remplacés par des aplats). Déclenché par prefers-contrast: more
  # ou le réglage « Lisibilité renforcée », jamais proposé comme préférence de style.
  # Noms conservés (-clair) pour compatibilité EXPERIENCE.md / CSS existant.
  fond-clair: '#F3F1FB'
  surface-clair: '#FBFAFE'
  surface-elevee-clair: '#FFFFFF'
  texte-clair: '#1B1836'
  texte-doux-clair: '#4C476B'
  bordure-clair: '#DCD8EE'
  bordure-forte-clair: '#565179'
  accent-clair: '#265F91'
  accent-doux-clair: '#E2ECF8'
  sur-accent-clair: '#FFFFFF'
  arbre-tronc-clair: '#5A5680'
  arbre-branche-clair: '#4A4670'
  arbre-feuillage-clair: '#3C6C93'
  succes-clair: '#3B7357'
  alerte-clair: '#8A5A16'
  lueur-clair: '#3C6C93'
typography:
  display:
    fontFamily: 'Fraunces'
    fontSize: 32px
    fontWeight: '400'
    lineHeight: '1.15'
    letterSpacing: -0.01em
    fontVariationSettings: "'opsz' 48, 'SOFT' 30, 'WONK' 0"
  titre:
    fontFamily: 'Fraunces'
    fontSize: 24px
    fontWeight: '400'
    lineHeight: '1.25'
    fontVariationSettings: "'opsz' 32, 'SOFT' 30, 'WONK' 0"
  titre-sm:
    fontFamily: 'Fraunces'
    fontSize: 18px
    fontWeight: '500'
    lineHeight: '1.35'
    fontVariationSettings: "'opsz' 20, 'SOFT' 30, 'WONK' 0"
  anam:
    fontFamily: 'Fraunces'
    fontSize: 19px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: 0.005em
    fontVariationSettings: "'opsz' 14, 'SOFT' 20, 'WONK' 0"
  corps:
    fontFamily: 'Inter'
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.65'
  meta:
    fontFamily: 'Inter'
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.45'
  surtitre:
    fontFamily: 'Inter'
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.06em
    textTransform: none
  bouton:
    fontFamily: 'Inter'
    fontSize: 15px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.01em
rounded:
  sm: 4px
  DEFAULT: 8px
  md: 12px
  lg: 16px
  full: 9999px
spacing:
  unit: 8px
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 24px
  '6': 32px
  '7': 48px
  '8': 64px
  '9': 96px
  marge-mobile: 20px
  marge-desktop: 48px
  respiration: 40px
  mesure: 32rem
  contenu-max: 40rem
  cible-tactile: 44px
components:
  mouvement:
    duree-courte: 180ms
    duree-standard: 320ms
    duree-longue: 700ms
    duree-respiration: 4200ms
    courbe: 'cubic-bezier(0.32, 0.08, 0.24, 1)'
    rebond: 'interdit'
    reduced-motion: 'toute durée > 180ms tombe à 0ms ; fondus en opacité seule ≤180ms sans dérive ; la respiration du signe s arrête ; le personnage paraît sans fondu'
  fondu:
    # LE FONDU est la primitive de mouvement de la nuit : rien ne glisse, tout paraît.
    texte: '{components.mouvement.duree-standard}'     # 320ms — apparition d un bloc de texte
    image: '{components.mouvement.duree-longue}'       # 700ms — fondu enchaîné entre deux imageries
    personnage: '{components.mouvement.duree-longue}'  # 700ms — Anam entre et se retire en fondu
    region: '{components.mouvement.duree-longue}'       # 700ms — passage d une région à l autre de la scène unique, fondu enchaîné ; JAMAIS un basculement d écran ni un glissement latéral
    derive: 6px                                        # translateY optionnel bas→haut, JAMAIS latéral
    reduced-motion: 'opacité seule, ≤180ms, aucune dérive ; le personnage paraît instantanément ; le changement de région devient instantané (0ms), sans parallaxe'
  ombre:
    douce: '0 2px 24px rgba(27, 24, 54, 0.06)'
    levee: '0 8px 32px rgba(27, 24, 54, 0.10)'
    sombre: 'aucune — en nuit la profondeur passe par le ton et le voile, jamais par l ombre'
  texture:
    grain-sombre: 'opacity 0.05'
    grain-clair: 'opacity 0.02'
    tuile: 180px
    portee: 'fonds, surfaces ET sous les dégradés de voile/ciel pour tuer le banding des aplats profonds — jamais sous un bloc de texte long'
  lumiere:
    portee: 'halo lunaire derrière le personnage/lotus, lueur du fruit, base de l arbre — jamais un dégradé d UI plat et gratuit'
    forme-halo: 'radial-gradient(58% 58% at 50% 42%, {colors.surface-elevee} 0%, transparent 68%)'
    forme-arbre: 'radial-gradient(130% 90% at 50% 100%, {colors.surface} 0%, {colors.fond} 60%)'
    regle: 'imagerie peinte = plage libre ; dégradés dessinés en CSS (hors imagerie) ≤6% de luminance et grain-sombre appliqué par-dessus'
  voile:
    # Le SCRIM de lisibilité. Sans lui, aucun texte ne touche une image.
    couleur: '{colors.fond}'
    opacite-texte-courant: 0.85   # sous corps/anam/meta — garantit ≥4,5:1 (plancher mesuré 60,6% sur pixel blanc)
    opacite-grand-texte: 0.70     # sous display/titre — garantit ≥3:1 (plancher mesuré 48,7%)
    luminance-fond-max-courant: 0.15  # luminance du fond composité tolérée sous un glyphe (texte courant)
    luminance-fond-max-grand: 0.25    # idem, grand texte
    forme-seuil: 'linear-gradient(to top, {colors.fond} 0%, {colors.fond} 22%, rgba(12,10,30,0.72) 48%, transparent 80%)'
    portee: 'TOUT texte posé sur imagerie, sans exception'
  imagerie:
    source: 'images/anam-gemini/'
    rendu: 'peinture — jamais photoréaliste (transparence : Anam est manifestement une illustration, pas une personne)'
    grain: '{components.texture.grain-sombre} par-dessus pour dither le banding sur indigo profond'
    surface-interdite: 'icône, aperçu de notification, vignette multitâche — voir NFR-015 et privacy-cover'
  focus:
    couleur: '{colors.bordure-forte}'
    epaisseur: 2px
    offset: 2px
    rayon: '{rounded.sm}'
    ratio-verifie: '4,29:1 nuit sur fond · 3,54:1 nuit sur surface-elevee · 6,59:1 accessibilité'
  bouton-primaire:
    fond: '{colors.accent}'
    texte: '{colors.sur-accent}'
    rayon: '{rounded.DEFAULT}'
    hauteur: '{spacing.cible-tactile}'
    padding: '0 {spacing.5}'
    typo: '{typography.bouton}'
    ratio-verifie: '10,25:1 nuit · 6,71:1 accessibilité'
  bouton-fantome:
    fond: 'transparent'
    texte: '{colors.accent}'
    bordure: '1px solid {colors.accent}'
    rayon: '{rounded.DEFAULT}'
    hauteur: '{spacing.cible-tactile}'
  champ-saisie:
    fond: '{colors.surface-elevee}'
    bordure: '1px solid {colors.bordure-forte}'
    rayon: '{rounded.DEFAULT}'
    padding: '{spacing.3} {spacing.4}'
    typo: '{typography.corps}'
    placeholder: '{colors.texte-doux}'
    hauteur-min: '{spacing.cible-tactile}'
  carte:
    fond: '{colors.surface}'
    bordure: '1px solid {colors.bordure}'
    rayon: '{rounded.md}'
    padding: '{spacing.5}'
    ombre-clair: '{components.ombre.douce}'
  carte-du-jour:
    fond: '{colors.surface-elevee}'
    rayon: '{rounded.lg}'
    padding: '{spacing.6}'
    titre: '{typography.titre}'
    ombre-clair: '{components.ombre.douce}'
  arbre:
    tronc: '{colors.arbre-tronc}'
    branche: '{colors.arbre-branche}'
    feuillage: '{colors.arbre-feuillage}'
    fruit: '{colors.accent}'
    lueur-fruit: '{colors.lueur}'
    cerne: '{colors.bordure-forte}'
    ciel: '{colors.fond}'
    trait-tronc: 5px
    trait-branche: 3.2px
    trait-branche-naissance: 2px
    cible-branche: '{spacing.cible-tactile}'
  fiche-branche:
    fond: '{colors.surface-elevee}'
    rayon: '{rounded.lg}'
    padding: '{spacing.5}'
    nom: '{typography.titre-sm}'
    date: '{typography.meta}'
    extrait: '{typography.corps}'
    extrait-filet: '1px solid {colors.bordure-forte}'
    extrait-retrait: '{spacing.4}'
    ombre-clair: '{components.ombre.levee}'
  signe-anam:
    couleur: '{colors.texte}'        # argent lunaire — PAS accent : l accent reste la couleur de l action
    point-lumiere: '{colors.lueur}'  # le point de vigil, deuxième couleur optionnelle
    taille: 18px
    taille-min: 12px
    couleurs-max: 2
    animation: 'respiration {components.mouvement.duree-respiration} — échelle 1 → 1.03'
  tour-anam:
    typo: '{typography.anam}'
    couleur: '{colors.texte}'
    largeur-max: '{spacing.mesure}'
    ecart: '{spacing.respiration}'
  tour-utilisatrice:
    typo: '{typography.corps}'
    couleur: '{colors.texte}'
    fil: '1px solid {colors.bordure-forte}'
    retrait: '{spacing.4}'
    largeur-max: '{spacing.mesure}'
  porte-de-secours:
    typo: '{typography.meta}'
    couleur: '{colors.texte-doux}'
    fond: 'transparent'
    interdits: 'rouge, pastille, icône d alerte, majuscules'
  mention-ia:
    typo: '{typography.meta}'
    couleur: '{colors.texte-doux}'
  personnage:
    seuil:
      ratio: '4:5'
      emploi: 'accueil, ouverture de séance'
      largeur: 'pleine largeur / fond perdu, voile de seuil sous tout texte'
      voile: '{components.voile.forme-seuil}'
    presence:
      taille: '96–140px'
      cadre: 'AUCUN — bord fondu dans {colors.fond}, ni cercle, ni vignette, ni contour'
      emploi: 'ouverture, quand Anam nomme, clôture — pas à chaque message'
    veille:
      cadre: 'aucun, de dos / profil, très effacée'
      emploi: 'retrait d Anam, fin de séance, semaine calme'
    fondu: '{components.fondu.personnage}'
    interdits: 'avatar rond répété à chaque tour ; rendu photoréaliste ; présence sur icône, notification ou aperçu multitâche'
  icone-app:
    fond: '{colors.surface-elevee}'   # indigo nuit profond — discret, jamais spirituel à petite taille
    forme: '{colors.arbre-branche}'   # un seul trait, argent lunaire
    couleurs-max: 2
    rayon: 'masque système, aucun arrondi peint dans l asset'
---

# DESIGN.md — Anam

## Brand & Style

Anam est une compagne d'introspection qui refuse de dire ce qui arrange. Le produit tient sur trois refus : **ne rien mesurer, ne rien prédire, ne rien trahir.** L'identité visuelle est la traduction littérale de ces trois refus.

**La direction est « Nuit galactique ».** Indigo profond, violet, nuit étoilée, lotus bleu lumineux, argent lunaire. Apaisant *et* rêveur. L'objet de référence n'est plus un atelier d'argile : c'est une **nuit claire** au bord de l'eau — étoiles, phases de lune, reflets, une présence qui flotte. Mat et lumineux à la fois : jamais une nuit lourde, jamais un noir d'écran, jamais du néon. La chaleur (les cheveux auburn du personnage) vient de la figure peinte ; **l'interface, elle, reste froide et nocturne.**

**Anam a désormais un visage** — une femme peinte, un lotus bleu à la main, sous la lune. C'est un revirement assumé par rapport à l'ancienne charte (« Anam n'a pas de visage »). La transparence exigée par l'AI Act (art. 50, FR-013) **ne repose plus sur l'absence de figure** mais sur deux garde-fous : le rendu est ouvertement **peint, jamais photoréaliste** (on ne peut pas la confondre avec une personne réelle), et la **`mention-ia` persistante** reste le porteur littéral de la transparence. Anam paraît aux **seuils** — elle n'est pas collée à chaque message.

**L'app est très imagée.** De vraies illustrations en fond et aux seuils, bien plus que la moyenne des apps. La contrepartie est une contrainte d'accessibilité de premier ordre : **le texte est blanc, écrit relativement petit, et posé sur de l'image**. C'est le cas le plus difficile qui soit (le contraste varie pixel par pixel). Deux règles absolues en découlent, développées plus bas : **aucun texte ne touche une image sans voile de lisibilité**, et **tout texte paraît en fondu**, jamais en glissé.

**L'arbre — devenu arbre de nuit — reste l'objet signature.** Il remplace la barre de progression, le score, le badge et la série. Il ne régresse jamais (FR-029). Écorce argentée, feuillage bleu-lune, un fruit qui luit, poussant contre le ciel étoilé.

**La discrétion reste une contrainte de premier ordre** (NFR-015) — mais elle se joue désormais **à la surface, pas à l'intérieur**. L'imagerie riche (personnage, lune, lotus, étoiles) vit **dans la séance, derrière l'authentification**. Ce qui est exposé au monde — **l'icône, l'aperçu de notification, la vignette multitâche** — ne révèle jamais qu'il est question de spiritualité ou d'intimité. Le test opérationnel tient : on tend le téléphone deux secondes, sur l'écran verrouillé ou la grille d'icônes ; si « voyance » ou « astrologie » sort, c'est raté. L'app-switcher affiche un **privacy-cover** neutre, jamais l'imagerie de séance.

**Le mode sombre est le mode natif et quasi unique.** Il n'existe pas de thème jour parallèle : l'app se vit le soir, sur imagerie nocturne. Le seul autre mode est un **mode d'accessibilité « contraste renforcé / imagerie atténuée »** (voir *Colors*), déclenché par besoin et non par goût.

Quatre principes s'appliquent partout :

1. **Le vide est un matériau.** Marges très généreuses, une seule chose importante par vue. Sur imagerie, le vide, c'est le ciel.
2. **Le mouvement est un fondu lent.** Les choses **paraissent** et **s'effacent** ; rien ne glisse, rien ne rebondit, rien ne « pop », rien ne célèbre.
3. **Rien ne mesure.** Aucun élément d'interface n'exprime une quantité, une performance ou une comparaison.
4. **Le silence a un traitement visuel.** Les semaines calmes sont le cœur du produit. Elles ont droit à un traitement à part entière — souvent le format *Veille* du personnage — pas à une relance.
5. **La scène est sans bord.** Le monde est **continu** : on ne le découpe pas en cadres, on s'y déplace entre des **régions** reliées en fondu (`{components.fondu.region}`). La séparation vient de la **respiration, du voile et du ton**, jamais d'un filet qui *ferme* une zone. Les seuls filets qui subsistent sont **fonctionnels** — l'anneau de focus clavier et le contour des champs et contrôles (`bordure-forte`, obligation d'accessibilité). Aucun filet décoratif ne cerne une région ni n'encadre le monde.

## Colors

Palette **« Nuit galactique »**, échantillonnée au pixel sur l'imagerie de référence (`images/anam-gemini/`) puis **ajustée par calcul WCAG réel**. Aucune valeur n'est laissée non vérifiée ; les valeurs qui ne passaient pas ont été corrigées et la correction est indiquée.

> ⚠️ **Le mode sombre est le mode natif.** Les tokens sans suffixe (`fond`, `texte`, `accent`…) sont la **nuit**. En CSS : `:root` porte la nuit ; le mode accessibilité (`-clair`) s'active via `:root[data-a11y="contraste"]`, `@media (prefers-contrast: more)` et le réglage « Lisibilité renforcée ». **Il n'y a pas de `@media (prefers-color-scheme: light)` qui bascule vers un thème jour** — ce media query, s'il est branché, pointe vers le mode accessibilité, pas vers un décor de jour.

### Les rôles (mode nuit)

- **Fond `#0C0A1E`** — nuit profonde, indigo presque noir. Jamais un noir pur (qui ferait « écran éteint »), jamais un gris. C'est le socle sur lequel l'imagerie et l'arbre respirent.
- **Surface `#16132F`** et **surface élevée `#201C42`** — les deux seuls niveaux de profondeur. Trois surfaces empilées, c'est déjà une de trop.
- **Texte `#EEECF7`** — blanc lunaire à peine mauve. **Jamais `#FFFFFF` pur** : le blanc pur sur indigo profond provoque de la halation (le texte vibre) et fatigue le soir.
- **Texte doux `#ABA6C9`** — pervenche éteinte : métadonnées, dates, mentions, aide. **Jamais** pour le contenu écrit par l'utilisatrice.
- **Accent `#8FC1EF`** — **le lotus bleu.** C'est la couleur de l'action, et seulement de l'action : bouton primaire, lien, point d'accroche d'une branche, fruit. Jamais un fond de section, jamais un état, jamais décorative. La lueur du lotus dans l'imagerie n'est pas cet accent-UI : c'est de la peinture.
- **Lueur `#CDE4F8`** *(nouveau)* — nacre lumineuse pour les **points de lumière** : halo du lotus, rosée sur le fruit, point du signe, l'« essence de lumière ». **Distincte de l'accent** : la lueur brille mais n'est jamais cliquable. Ne jamais l'utiliser comme couleur d'action.
- **Accent doux `#241F47`** — aplat de mise en avant discret. Porte du texte `texte` uniquement, jamais du texte `accent`.
- **Succès `#86B79E`** et **Alerte `#D0A05C`** — discrets, **en texte uniquement**, jamais en fond ni en pastille. Il n'y a **pas de rouge** dans ce système : Anam est un journal, pas un formulaire (voir *porte de secours*).
- **Arbre : tronc `#6A6690`, branche `#9A96BE`, feuillage `#8FB6D8`** — argent lunaire et bleu-lune, réservés à l'illustration de l'arbre. **Aucun brun** : c'est un arbre de nuit. Ne jamais les employer comme couleurs d'interface.

### Les deux bordures — ne pas les confondre

| Token | Valeur | Rôle | Seuil |
|---|---|---|---|
| `bordure` | `#2A2648` | Séparateur **purement décoratif** : filets, divisions de liste, contour de carte. | Aucun. Exempté par WCAG 1.4.11. Mesuré à 1,36:1 sur `fond` — **c'est normal**. |
| `bordure-forte` | `#77719C` | Tout ce qui **délimite un contrôle** (champ, case, sélecteur) et **l'anneau de focus clavier**. | ≥ 3:1 obligatoire. Vérifié 4,29:1 sur `fond`, 3,96:1 sur `surface`, **3,54:1 sur `surface-elevee`**. |

> **Correction appliquée.** La valeur de départ `#6C6690` ne tenait qu'à **3,02:1** sur `surface-elevee` (le fond du `champ-saisie`) — au ras du seuil, donc à la merci de l'anti-crénelage. Elle a été **éclaircie à `#77719C`** pour remonter cette paire à **3,54:1**. Un champ de saisie bordé de `bordure` (décorative) reste un défaut d'accessibilité, pas une variante.

### Contrastes vérifiés — mode nuit

Ratios calculés par la formule WCAG 2.x (luminance relative sRGB linéarisée). Seuil AA = **4,5:1** pour le texte, **3:1** pour les objets graphiques et le focus. Toute paire de **texte** est listée avec son verdict.

| Paire (premier plan / fond) | Seuil | Ratio | Verdict |
|---|---|---|---|
| `texte` / `fond` | 4,5:1 | **16,68** | PASS AA |
| `texte` / `surface` | 4,5:1 | **15,39** | PASS AA |
| `texte` / `surface-elevee` | 4,5:1 | **13,76** | PASS AA |
| `texte-doux` / `fond` | 4,5:1 | **8,38** | PASS AA |
| `texte-doux` / `surface` | 4,5:1 | **7,73** | PASS AA |
| `texte-doux` / `surface-elevee` | 4,5:1 | **6,91** | PASS AA |
| `accent` en texte / `fond` | 4,5:1 | **10,25** | PASS AA |
| `accent` en texte / `surface` | 4,5:1 | **9,45** | PASS AA |
| `sur-accent` / remplissage `accent` | 4,5:1 | **10,25** | PASS AA |
| `texte` / `accent-doux` | 4,5:1 | **13,20** | PASS AA |
| `texte-doux` / `accent-doux` | 4,5:1 | **6,63** | PASS AA |
| `succes` en texte / `surface` | 4,5:1 | **7,94** | PASS AA |
| `alerte` en texte / `surface` | 4,5:1 | **7,59** | PASS AA |
| `bordure` / `fond` | — | 1,36 | exempté (1.4.11) |
| `bordure-forte` / focus sur `fond` | 3:1 | **4,29** | PASS |
| `bordure-forte` sur `surface-elevee` (champ) | 3:1 | **3,54** | PASS |
| `accent` (fruit) / `fond` | 3:1 | **10,25** | PASS |
| `arbre-tronc` / `fond` (ciel) | 3:1 | **3,63** | PASS |
| `arbre-branche` / `fond` | 3:1 | **6,94** | PASS |
| `arbre-feuillage` / `fond` | 3:1 | **9,14** | PASS |

> **La marge la plus faible du mode nuit est `arbre-tronc` / `fond` = 3,63:1** (objet graphique, seuil 3:1). Le tronc se dessine **contre le ciel `fond`**, pas contre `surface-elevee` — c'est cette paire qui fait foi. Ne pas assombrir le tronc, ne pas le poser sur une surface plus claire que `fond` sans re-mesurer. Le trait de 5px lui donne en outre de la marge perceptive.

### Contrastes vérifiés — mode accessibilité (`-clair`)

Ce mode **remplace l'imagerie par des aplats** et pousse le texte vers l'AAA quand c'est atteignable. Vérifié :

| Paire | Seuil | Ratio | Verdict |
|---|---|---|---|
| `texte-clair` / `fond-clair` | 4,5:1 | **15,27** | PASS (AAA) |
| `texte-doux-clair` / `fond-clair` | 4,5:1 | **7,76** | PASS (AAA) |
| `accent-clair` en texte / `fond-clair` | 4,5:1 | **6,01** | PASS AA |
| `sur-accent-clair` / remplissage `accent-clair` | 4,5:1 | **6,71** | PASS AA |
| `texte-clair` / `accent-doux-clair` | 4,5:1 | **14,29** | PASS (AAA) |
| `succes-clair` / `fond-clair` | 4,5:1 | **4,98** | PASS AA |
| `alerte-clair` / `fond-clair` | 4,5:1 | **5,28** | PASS AA |
| `bordure-forte-clair` / focus | 3:1 | **6,59** | PASS |
| `arbre-feuillage-clair` / `fond-clair` | 3:1 | **5,00** | PASS |

Toute couleur ajoutée au système arrive avec son ratio mesuré, ou n'arrive pas.

## Le personnage — système d'assets (NOUVEAU)

Anam est une femme peinte : cheveux **auburn**, robe de nacre irisée, un **lotus bleu lumineux** dans la main, sous la lune et au bord de l'eau. Elle n'est **pas** une mascotte plaquée à côté de chaque message. Elle est une **présence qui paraît aux seuils** et se **retire** dans le silence. C'est un **système à trois formats**, un par intention.

> **Règle d'or : présence ≠ répétition.** Anam paraît aux moments qui comptent — **l'ouverture** d'une séance, **quand elle nomme** une prise de conscience (naissance d'une branche), **la clôture**. Entre ces moments, **le `signe-anam` suffit**. Une figure à côté de chaque bulle détruirait à la fois la sobriété et la transparence.

### `personnage.seuil` — le plan large (4:5)

Le portrait vertical, plein cadre : Anam flotte au-dessus de l'eau (ou d'un champ d'étoiles-fleurs), lotus levé, phases de lune derrière elle. **Emploi :** région d'**accueil** et **ouverture de séance** — le rideau qui se lève.

- Ratio **4:5**, **fond perdu**, pleine largeur du contenu (borné à `{spacing.contenu-max}` au-delà de 40rem, le reste est du ciel).
- Tout texte posé dessus (salutation, « commencer ») passe par le **voile de seuil** (`{components.voile.forme-seuil}`) : le bas de l'image se fond dans `fond`, le texte vit dans cette zone dense.
- Apparaît en **fondu** `{components.fondu.image}` (700ms). Jamais de parallaxe, jamais de Ken Burns automatique.

### `personnage.presence` — le visage qui émerge (96–140px)

Le buste d'Anam, **émergeant de la nuit**, le lotus près des cheveux. **Emploi :** ses apparitions **dans le dialogue**, à 96–140px.

- **AUCUN cadre.** Ni cercle, ni vignette, ni contour, ni pastille : **elle sort du fond**. Techniquement, l'asset est un **détourage à bord plumeux** (masque alpha adouci sur ~16–24px) dont les bords se **dissolvent dans `{colors.fond}`**. Ce n'est pas un avatar de chat — c'est le contraire visuel d'une puce ronde.
- Placement : en **tête d'un groupe de tours**, ou centrée à un seuil de conversation — **jamais** répétée en regard de chaque message.
- Entrée/sortie en **fondu** `{components.fondu.personnage}` (700ms), sans glissement.

### `personnage.veille` — de dos, effacée

Anam **de dos, de profil, ou très estompée**, quand elle se retire. **Emploi :** **fin de séance**, **semaine calme**, **moment de silence**. C'est la traduction figurée du principe « le silence a un traitement visuel » : le calme n'est pas un vide, c'est Anam qui veille en retrait.

### Organisation & production des assets

Les trois planches de `images/anam-gemini/` sont la **source de référence** (contact sheets), pas les assets finaux. Découper et exporter dans une arborescence stable :

```
images/anam-gemini/
  seuil/     anam-seuil-{a,b,c}.png        # 4:5, plein cadre, ≥1200px de large, +@2x
  presence/  anam-presence-{a,b,c}.png     # bord plumeux, fond TRANSPARENT, ~560px, +@2x
  veille/    anam-veille-{a,b,c}.png        # de dos/profil, fond transparent ou fondu
  signe/     signe-anam.svg                 # voir §signe-anam
```

- Servir en **WebP/AVIF** + repli PNG ; `loading="lazy"` hors de la première vue ; toujours un `@2x`.
- Chaque asset porte un **`alt` sobre et non-révélateur** (« illustration nocturne » — pas « femme tenant un lotus sous la lune »), cohérent avec la discrétion.
- Le personnage **n'apparaît jamais** dans l'icône, l'aperçu de notification, ni la vignette multitâche (privacy-cover neutre).

## Imagerie & lisibilité du texte (NOUVEAU — critique)

Poser du **texte blanc et petit sur de l'imagerie galactique** est le cas d'accessibilité le plus difficile : le contraste change à chaque pixel de l'image. La réponse n'est pas « choisir de belles zones à l'œil », c'est un **dispositif chiffré**.

### Règle cardinale

> **Le texte ne se pose JAMAIS directement sur une image sans voile.** Deux mécanismes, aucun troisième.

### Mécanisme A — Voile de lisibilité (scrim en dégradé)

Un dégradé de `{colors.fond}` posé **entre l'image et le texte**, dense là où le texte vit, transparent ailleurs (l'image respire).

**Cible chiffrée.** Sous chaque glyphe, la **luminance du fond composité** doit tomber :
- **≤ 0,15** pour le texte courant (`corps`, `anam`, `meta`) → ratio ≥ **4,5:1** avec `texte` `#EEECF7` ;
- **≤ 0,25** pour le grand texte (`display`, `titre`) → ratio ≥ **3:1**.

**Traduction en opacité de voile.** Sur le **pire cas absolu** — un pixel **blanc** sous le texte — un voile `fond` doit atteindre au minimum **60,6 %** d'opacité (texte courant) et **48,7 %** (grand texte) pour tenir ces planchers. Comme l'imagerie est générée et non mesurable pixel par pixel par un dev seul, on **spécifie une marge** :

| Sous… | Opacité `fond` minimale **spécifiée** | Plancher mesuré (pixel blanc) | Garantit |
|---|---|---|---|
| texte courant (`corps`/`anam`/`meta`) | **85 %** | 60,6 % | ≥ 4,5:1 |
| grand texte (`display`/`titre`) | **70 %** | 48,7 % | ≥ 3:1 |

`{components.voile.forme-seuil}` code exactement ce profil pour un texte ancré en bas : opaque de 0 % à 22 % de hauteur, ~72 % à 48 %, transparent à 80 %. **Le bloc de texte doit tenir entièrement dans la bande ≥ 85 %.** Sous un dégradé de voile, appliquer `{components.texture.grain-sombre}` pour éviter le banding.

### Mécanisme B — Zone de texte protégée

Quand le texte doit vivre **au milieu** d'une image (une citation, un titre de carte flottant), il repose sur un **panneau** `surface` opaque à **≥ 92 %**, rayon `{rounded.lg}`, padding `{spacing.5}` — c'est-à-dire une carte posée sur l'image. Le contraste redevient celui, déjà vérifié, du texte sur `surface`.

### Tailles minimales sur imagerie

Le « texte blanc petit » a un plancher **plus haut** sur image que sur aplat :
- **Jamais sous 13px**, nulle part (règle générale).
- **Sur imagerie**, le texte de lecture soutenue ne descend pas **sous 15–16px** (`corps`), même sous voile.
- **`surtitre` 12px et `meta` 13px** ne se posent **que** sur une **zone protégée** (mécanisme B) ou un aplat, **jamais** sur un voile en dégradé.
- Poids : ne pas descendre `corps`/`anam` sous 400 ; l'ombre portée de texte (`text-shadow`) est **interdite** comme substitut au voile (elle salit le rendu peint et ne garantit rien).

## Mouvement, fondu & respiration

Le mouvement de la nuit est le **fondu** : les choses **paraissent** et **s'effacent**. Rien ne glisse latéralement, rien ne rebondit, rien ne « pop ».

- **`{components.fondu.texte}` (320ms)** — un bloc de texte paraît en opacité 0 → 1, avec une **dérive optionnelle de 6px** du bas vers le haut (`{components.fondu.derive}`). Jamais d'entrée par la gauche/droite.
- **`{components.fondu.image}` (700ms)** — fondu enchaîné entre deux imageries (changement de seuil, de fond).
- **`{components.fondu.personnage}` (700ms)** — Anam entre et se retire en fondu, jamais en surgissement.
- **`{components.fondu.region}` (700ms)** — le passage d'une **région** à l'autre de la scène unique se fait en **fondu enchaîné**, jamais par un basculement d'écran sec ni un glissement latéral. L'ancrage (arbre au centre, Anam à gauche) reste stable : c'est le **cadrage** qui se déplace et se fond, pas l'app qui change de page. **Sous `prefers-reduced-motion`, le changement de région est instantané** — pas de fondu, pas de parallaxe.
- **Respiration du signe** — `signe-anam` respire à `{components.mouvement.duree-respiration}` (4,2s), échelle 1 → 1,03, aller-retour amorti. C'est le seul mouvement en boucle du produit.
- Courbe unique **`cubic-bezier(0.32, 0.08, 0.24, 1)`**. **Aucun rebond, aucun ressort, aucun overshoot.**

**`prefers-reduced-motion: reduce`** → toute durée > 180ms tombe à 0 ; les fondus deviennent des **apparitions en opacité seule ≤ 180ms sans dérive** ; la respiration du signe s'arrête ; le personnage paraît **instantanément**. Aucune information n'est jamais portée par le seul mouvement.

## Typography

**Deux familles, et une règle qui porte tout le produit :**

> **Le sérif, c'est Anam qui parle. La grotesque, c'est toi qui écris et l'interface qui se tait.**

La règle tient exactement comme avant — mais elle porte maintenant une charge nouvelle : **beaucoup de ce texte est blanc, petit, et posé sur image.** La typographie doit donc être choisie et bornée pour rester lisible dans ce pire cas.

### Fraunces — la voix

Sérif humaniste variable, contrasté modérément, terminaisons vivantes. Axes : `opsz` 9–144, `wght` 100–900, `SOFT` 0–100, `WONK` 0–1.

- **`WONK` toujours à 0.** Les variantes wonky font basculer vers la « boutique ésotérique ». La direction est plus rêveuse qu'avant, mais la lettre reste sobre : c'est l'imagerie qui rêve, pas le texte.
- **`SOFT` entre 20 et 30** : terminaison adoucie, mate, non tranchante.
- **Graisse maximale 500.** Aucun gras, aucune capitale de titre.
- **`opsz` suit la taille de rendu** : 48 en display, 32 en titre, 14 pour la parole d'Anam.

### Inter — l'interface

Grotesque neutre, très lisible aux petites tailles, diacritiques françaises impeccables, chiffres tabulaires disponibles. Sa neutralité est le point : la chaleur vient de l'imagerie et du sérif. Inter porte le texte de l'utilisatrice, les libellés, les métadonnées, les boutons, les mentions légales.

Piles de repli : `Fraunces, 'Iowan Old Style', Georgia, serif` · `Inter, -apple-system, 'Segoe UI', system-ui, sans-serif`.

### L'échelle

| Rôle | Famille | Taille | Interligne | Emploi |
|---|---|---|---|---|
| `display` | Fraunces 400 | 32 / **40 px ≥ 768px** | 1.15 | La seule chose importante d'une vue. Une occurrence, jamais deux. |
| `titre` | Fraunces 400 | 24 px | 1.25 | Titre de carte, en-tête de lecture, nom de section. |
| `titre-sm` | Fraunces 500 | 18 px | 1.35 | Nom d'une branche, titre de fiche. |
| `anam` | Fraunces 400 | 19 px | 1.6 | **La parole d'Anam.** Un peu plus grande que le corps — c'est ce qu'on relit. |
| `corps` | Inter 400 | 16 px | 1.65 | Texte de l'utilisatrice, documents, prose d'interface. |
| `meta` | Inter 400 | 13 px | 1.45 | Dates, mentions, aide, transparence IA. |
| `surtitre` | Inter 500 | 12 px | 1.4 | Étiquette au-dessus d'un titre. |
| `bouton` | Inter 500 | 15 px | 1 | Libellés d'action. |

**Règles dures :**

- **Tailles minimales sûres** (voir *Imagerie & lisibilité*) : jamais sous 13px ; sur imagerie, `corps`/`anam` ne descendent pas sous 15–16px ; `surtitre` 12px et `meta` 13px seulement en zone protégée ou sur aplat.
- **Aucune capitale.** Ni titres, ni `text-transform: uppercase`, ni emphase en majuscules. Le `surtitre` se distingue par l'interlettrage (0.06em) et la couleur, pas par la casse (FR-083).
- **Interligne ≥ 1.6** sur tout texte de lecture. **Longueur de ligne ≤ `{spacing.mesure}` (32rem)**, ~60 caractères en `corps`, ~55 en `anam`.
- **Aucune graisse au-delà de 500**, dans les deux familles.
- **Aucune liste à puces dans la conversation** (FR-084). Listes, tableaux, titres sont autorisés **hors** conversation (synthèses, fiches, plans). Le CSS de la vue conversation neutralise `ul`, `ol`, `h1–h6`.
- **Aucun emoji**, nulle part (FR-083).
- Taille système respectée : tout en `rem`, aucun `px` figé sur du texte.

## Layout & Spacing

Base **8px**. Échelle : 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96.

- **Marges latérales** : 20px en mobile, 48px à partir de 768px.
- **Colonne unique, toujours.** Aucune vue à deux colonnes, aucun tableau de bord, aucune grille dense. Le produit est une bibliothèque et une conversation, pas un back-office.
- **`{spacing.contenu-max}` (40rem)** borne cartes et documents ; **`{spacing.mesure}` (32rem)** borne tout texte de lecture. Au-delà de 40rem, la fenêtre gagne du **ciel**, pas du contenu.
- **`{spacing.respiration}` (40px)** est l'écart vertical entre deux tours de conversation. Token nommé parce qu'il porte une intention : le silence occupe de la place. Ne jamais le compresser.
- **Trois ou quatre tours visibles maximum** dans la région de conversation.
- **`{spacing.cible-tactile}` (44px)** est le minimum absolu de toute zone touchable, y compris les points d'accroche des branches.

Un seul niveau de modale, jamais deux. La fiche de branche n'est pas une modale (voir *Components*).

## Elevation & Depth

**En nuit — le mode natif — la profondeur passe par le ton et le voile, jamais par l'ombre.** Une ombre portée ne se lit pas sur `#0C0A1E` ; elle y produit une auréole sale. Empilement : `fond` → `surface` → `surface-elevee`, plus un filet `bordure` 1px **seulement** si le ton et la respiration ne suffisent pas — **jamais pour _fermer_ une région** : dans la scène continue, un filet ne cerne rien et n'encadre pas le monde. Un panneau flottant sur imagerie se détache par son **voile** (mécanisme B), pas par une ombre. `{components.ombre.sombre}` vaut `aucune`, littéralement.

**En mode accessibilité**, deux ombres seulement, teintées d'indigo froid (`rgba(27, 24, 54, …)`), jamais de gris neutre :

- `{components.ombre.douce}` — `0 2px 24px rgba(27, 24, 54, 0.06)` : cartes au repos.
- `{components.ombre.levee}` — `0 8px 32px rgba(27, 24, 54, 0.10)` : au survol et sur la fiche de branche.

> **Les tokens d'ombre des composants sont nommés `ombre-clair`** (`carte.ombre-clair`, etc.). Le nom est la spécification : ces ombres **ne s'appliquent qu'en mode accessibilité**. En nuit, **aucune ombre portée**, sur aucun composant. Un composant qui porte une ombre en nuit est un défaut.

**La hiérarchie ne vient jamais de l'ombre.** Elle vient de la place, du vide, de la typographie, et — nouveau — de **l'imagerie et de son voile**. Aucune ombre nette material design, aucun `box-shadow` à faible flou, aucun glassmorphism, aucun neumorphism.

**Grain, pas dégradé numérique gratuit.** Un grain de nuit (fine poussière) est appliqué sur fonds et surfaces à `{components.texture.grain-sombre}` (5 %) — il **tue aussi le banding** des aplats indigo profonds et des voiles, ce qui est ici essentiel. Tuile 180px. On doit le sentir sans le voir. Jamais sous un bloc de texte long.

**Les dégradés autorisés sont ceux qui ont un sens physique** : `{components.voile}` (lisibilité), `{components.lumiere.forme-halo}` (halo lunaire derrière le personnage/lotus), `{components.lumiere.forme-arbre}` (lueur basse sous l'arbre). L'imagerie peinte a une plage libre ; **les dégradés dessinés en CSS restent ≤ 6 % de luminance et reçoivent le grain**. Aucun dégradé décoratif gratuit ailleurs.

## Shapes

Le tranchant est agressif, la pilule trop numérique. Le langage est **doucement adouci**.

| Token | Valeur | Emploi |
|---|---|---|
| `sm` | 4px | Champs, puces, petits marqueurs. |
| `DEFAULT` | 8px | Boutons, champs de saisie, chips. |
| `md` | 12px | Cartes de bibliothèque. |
| `lg` | 16px | Feuilles pleine largeur, fiche de branche, carte du jour, zones de texte protégées. |
| `full` | 9999px | **Un seul usage : la cible tactile du micro.** Nulle part ailleurs. |

Aucun bouton en pilule. Aucune surface parfaitement circulaire — **et surtout aucun cercle autour du personnage** (voir `personnage.presence`). Aucun « gros arrondi mou » de wellness app. Les images suivent exactement le rayon de leur conteneur ; le `personnage.seuil` est à fond perdu (pas d'arrondi) et le `personnage.presence` n'a pas de conteneur du tout (bord plumeux).

L'icône de l'app est livrée **carrée et à fond perdu**, sans arrondi peint : le masque du système s'en charge.

## Components

### `arbre` — l'objet signature, en arbre de nuit

L'arbre est un composant à part entière, un rendu vectoriel manipulable — pas une image plate. **Il reste identique dans sa mécanique ; seule sa matière devient nocturne.**

**Anatomie — chaque partie porte un sens et reste distincte :**

| Partie | Sens produit | Token | Trait |
|---|---|---|---|
| Tronc | Ce avec quoi elle arrive (thème natal, chemin de vie) | `arbre-tronc` (écorce argentée) | 5px |
| Branches | Les prises de conscience, nommées par elle | `arbre-branche` | 3,2px |
| Racines | La régularité, le fait de revenir | `arbre-tronc` | 2,5px, larges et étalées |
| Feuillage | La granularité émotionnelle | `arbre-feuillage` (bleu-lune) | feuilles **individuelles**, opacités 0.78 → 1.0 |
| Nœuds et cicatrices | Les tempêtes traversées | `cerne` | marques d'honneur, jamais des défauts |
| Fruit | Le passage à l'action | `accent`, halo `lueur` | un seul par branche, **il luit** |

Le fruit prend la couleur d'accent parce que l'accent **est** la couleur de l'action ; sa **lueur** (`{colors.lueur}`) est celle des points de lumière de la nuit. C'est la seule apparition de l'accent dans l'illustration.

**Le ciel derrière l'arbre est désormais une nuit étoilée** (`{colors.fond}` + étoiles discrètes + `{components.lumiere.forme-arbre}` en base). C'est un **revirement** par rapport à l'ancien « aplat chaud et vide, aucune étoile » : les étoiles sont maintenant autorisées, avec goût — des points fins, jamais un scintillement clinquant.

**États du tronc** (FR-051)

- `tronc-incomplet` — heure de naissance absente. Le **contour** est tracé, la **matière** (grain, cernes, éclat argenté) s'arrête en cours de route et laisse une réserve sombre. Aucun rouge, aucun pointillé, aucun cadenas, aucune icône, aucun aplat grisé, aucun pourcentage. **Le tronc est gratuit et reste visible même incomplet** (FR-088) : c'est un travail en cours, pas une erreur.
- `tronc-complet` — **même silhouette exactement**, même échelle, même endroit. Seule la matière change. Transition `{components.mouvement.duree-longue}`, vécue comme un apaisement, pas un déblocage : aucun flash, aucune étincelle, aucun halo de récompense, aucune coche.

**États d'une branche** (FR-028)

- `naissance` — fine (2px), nue, bois clair argenté, jonction fraîche. Un seul geste franc.
- `feuillaison` — même géométrie, trait à 3,2px, teinte assombrie, feuilles qui se déplient. L'état le plus riche en matière.
- `fruit` — pleinement feuillue, **un** fruit dense qui **luit** doucement et fait légèrement ployer la branche. Forme simple, sans espèce reconnaissable.

> **La progression se lit dans la MATIÈRE** — épaisseur de trait, densité de feuilles, éclat du bois — **jamais dans un effet de récompense ajouté.** La lueur du fruit fait partie de sa nature nocturne (elle est **statique**) ; elle n'est pas un « pop » de célébration. Aucune étincelle, aucune particule, aucune animation festive au changement d'état.

**Règles d'invariance**

- **L'arbre ne régresse jamais** (FR-029). Une branche née reste née, même place, même échelle. Rien ne rétrécit, rien ne se réorganise, rien ne disparaît. **Seule exception au monde : le droit à l'effacement** (FR-067).
- **Aucune saison, aucun état de perte.** Pas d'arbre nu, pas de feuille qui tombe, pas de branche morte, pas de teinte automnale.
- **Aucun compteur de branches**, aucun chiffre de synthèse, aucune légende permanente.
- L'arbre est ancré en bas, beaucoup de ciel au-dessus : **le vide (le ciel) est la place de ce qui va pousser.**

**Interaction** — pan et zoom. Chaque branche porte un point d'accroche discret (un nœud) et une zone tactile de `{spacing.cible-tactile}` minimum. Sélection : le reste de l'arbre descend à `opacity: 0.55` en `{components.mouvement.duree-standard}`, sans flou.

### `signe-anam` — l'abstraction du personnage

La marque qui signifie « c'est Anam ». **Abstraction directe du personnage**, dans la famille de la planche de référence : **la courbe du voile** (un seul trait fluide, la ligne de sa robe/voile), **le calice de lotus**, **le croissant-vigil** (croissant tenant un point de lumière sur une hampe fine), **le point de lumière** (l'« essence »). Jamais un visage, jamais une bulle, jamais une onde sonore.

- **Glyphe primaire retenu : la courbe du voile** — un geste unique, `{colors.texte}` (argent lunaire), lisible jusqu'à **12px**. C'est le plus abstrait, donc le plus discret.
- **Une à deux couleurs maximum** : argent lunaire (`texte`) + un **point de lumière** optionnel en `{colors.lueur}`. **Pas l'accent** : le signe apparaît près de chaque parole d'Anam ; le teindre en `accent` diluerait la règle « accent = action ».
- **État « Anam réfléchit »** : le signe **respire** — échelle 1 → 1,03 sur `{components.mouvement.duree-respiration}` (4,2s), aller-retour amorti ; le point de lumière peut pulser en douceur. **Pas de trois points qui sautillent, pas de curseur clignotant, pas de barre de chargement.**
- Livré en **SVG** (`images/anam-gemini/signe/signe-anam.svg`), une à deux couleurs, sans dégradé, testé à 12px.

### `fiche-branche`

Le panneau qui s'ouvre sur sélection d'une branche. **Ce n'est pas une modale** : c'est une étiquette posée sur l'illustration — `surface-elevee`, `{rounded.lg}`, `{components.ombre.levee}` **en mode accessibilité uniquement** (en nuit, aucune ombre : la profondeur vient du ton). Contenu : le nom donné par l'utilisatrice en `titre-sm`, la date en `meta`, l'extrait exact de conversation dont la branche provient (FR-027). Pas de bouton de fermeture proéminent : un tap à côté ferme.

**L'extrait source est rendu en `{typography.corps}`, filet 1px `{colors.bordure-forte}`, retrait 16px — exactement comme un `tour-utilisatrice`.** Ce n'est pas une inadvertance : l'extrait est une phrase **de l'utilisatrice**, pas d'Anam. La règle — *le sérif, c'est Anam ; la grotesque, c'est toi* — s'applique sans exception. Le mettre en `anam` reviendrait à faire dire à Anam les mots dont la branche est née, c'est-à-dire à lui attribuer la prise de conscience. C'est l'inverse de la promesse du produit.

### `tour-anam` et `tour-utilisatrice`

**Pas de bulles de chat opposées.** Un flux vertical unique, très aéré, sur `fond` (nuit) — le fond de conversation peut être un aplat `fond` ou une imagerie **très** estompée sous voile.

- `tour-anam` — `{typography.anam}`, couleur `texte`, largeur ≤ `{spacing.mesure}`, apparition en `{components.fondu.texte}`. Au-delà de trois phrases, c'est un défaut de génération, pas un cas d'affichage. Pas de fond, pas de bulle, pas de bordure.
- `tour-utilisatrice` — `{typography.corps}`, couleur `texte` **à pleine valeur, pas `texte-doux`**. Distinction par la famille et un fil de 1px `bordure-forte` à gauche, retrait 16px — jamais en éteignant ses mots (FR-021).
- Écart entre deux tours : `{spacing.respiration}`.
- **Aucun horodatage permanent, aucune coche de lecture, aucun indicateur « en ligne », aucune réaction, aucun emoji picker, aucune pièce jointe.**
- **`personnage.presence` paraît en tête des groupes qui comptent** (ouverture, nomination, clôture) — pas à chaque tour.

### `champ-saisie`

Une bande de nuit posée en bas de l'écran. Fond `surface-elevee`, bordure 1px `bordure-forte` (c'est un contrôle : seuil 3:1 — vérifié 3,54:1 sur ce fond), `{rounded.DEFAULT}`. Une icône de micro sobre à droite, seule cible en `{rounded.full}`. **Rien d'autre** : pas de barre d'outils, pas de trombone, pas de sélecteur d'emoji, pas de bouton d'envoi coloré.

### `bouton-primaire` / `bouton-fantome`

Primaire : aplat `accent`, libellé `sur-accent`, `{rounded.DEFAULT}`, hauteur 44px, padding horizontal 24px (silhouette allongée). Contraste vérifié 10,25:1. Fantôme : transparent, texte et bordure 1px `accent`. **Un seul bouton primaire à la fois.** Aucun dégradé, aucune ombre, aucune pilule. Sur imagerie, un bouton pose son propre aplat `accent` (opaque) — il n'a pas besoin de voile.

### `carte` / `carte-du-jour` (la bibliothèque)

Quatre à six cartes maximum, une colonne aérée sur `fond`. Chaque carte a l'air d'un objet : `surface`, `{rounded.md}`, `{components.ombre.douce}` **en accessibilité uniquement** — en nuit, ce sont **le saut de ton et la respiration** qui la détachent, pas un cadre. Un filet `bordure` reste **optionnel et discret**, jamais un cadre qui la *ferme* ni qui l'isole de la scène. Elle porte un `surtitre`, un `titre` en Fraunces, une ligne de `meta`, et un petit motif abstrait — **jamais un symbole astrologique, jamais un chiffre décoratif**. Un motif de constellation **très** abstrait est toléré s'il ne se lit pas comme un signe du zodiaque.

Une carte est mise en avant aujourd'hui (`carte-du-jour` : `surface-elevee`, `{rounded.lg}`, plus grande, seule en haut) pour donner le sentiment de **recevoir** plutôt que de chercher.

En surimpression, en haut : le mot « Anam » en petit, et rien d'autre — une **marque flottante sans barre ni filet**, pas un en-tête bordé. **Aucune barre de statistiques, aucun compteur de jours, aucun message bavard, aucune pastille rouge.**

### `porte-de-secours` (FR-077)

L'accès permanent aux ressources d'aide, hors conversation, atteignable en deux gestes. **Ne doit jamais avoir l'air d'une alerte** : `meta` en `texte-doux`, fond transparent, un mot simple, toujours au même endroit. Aucun rouge, aucune pastille, aucune sirène, aucune majuscule. Ne dépend d'aucune détection, jamais masquée. Elle vit dans la **surimpression persistante** (EXPERIENCE.md) : posée sur la scène **sans bande ni filet**, sa lisibilité sur imagerie tenue par le voile (`{components.voile}`), jamais par un fond barré.

À l'intérieur, les numéros (3114, 15/112, 3919, 119) sont en `texte` pleine valeur, `titre-sm`, cible 44px. Discret pour y aller, parfaitement lisible une fois dedans. **S'ils sont posés sur imagerie, mécanisme B (zone protégée) obligatoire** — une ressource de secours ne tolère aucune ambiguïté de contraste.

### `mention-ia` (FR-013, AI Act art. 50)

Mention persistante portée par la **surimpression persistante** — hors du fil lui-même, mais **toujours présente sur la région de conversation** — en `meta` / `texte-doux`. **C'est le porteur de la transparence maintenant que le personnage a un visage** : discrète mais **jamais masquée, jamais repliée derrière un accordéon, jamais dissoute dans le flux**, jamais sous 13px, et **jamais posée sur imagerie sans zone protégée** ni voile (`{components.voile}`). **Sans bande ni filet** : c'est une présence flottante, pas une barre.

### `notification` — DISCRÉTION (NFR-015, FR-035)

Le composant le plus contraint après l'icône. L'aperçu vit sur un écran verrouillé posé sur une table.

- Titre de la notification = `Anam`. Jamais le contenu, jamais une question, jamais un extrait.
- **Aucune imagerie, aucun personnage, aucun lotus, aucune lune** dans l'aperçu.
- **Le corps ne cite jamais l'utilisatrice**, ni un mot de sa conversation, ni le nom d'une branche.
- **Vocabulaire interdit** : horoscope, astral, thème, signe, tirage, carte, lune, ascendant, numérologie, chemin de vie, ennéagramme, mantra, énergie, spirituel, intuition, guidance.
- ✅ « Ton texte du matin est là. » · « Il y a quelque chose pour toi. »
- ❌ « Ton horoscope Bélier du jour » · « Anam a remarqué que tu reparles de ta mère »
- **Aucune pastille de compteur.** Aucune relance de connexion (FR-034) : Anam ne notifie que lorsqu'elle a quelque chose de spécifique à dire.

### `icone-app` — DISCRÉTION (NFR-015)

Deux couleurs maximum, tout mat. Fond `surface-elevee` (`#201C42`, indigo nuit), forme `arbre-branche` (`#9A96BE`, trait argent lunaire). Une forme abstraite d'un seul geste : glyphe, galet, nœud, ou fragment de jonction tronc-branche assez abstrait pour ne pas se lire comme « arbre ».

**Liste noire, sans exception — sur l'ICÔNE uniquement** (à l'intérieur de l'app, lune/lotus/étoiles sont désormais permis) : lune, croissant, étoile, constellation, lotus, roue du zodiaque, symbole planétaire, cristal, mandala, chakra, œil, main, carte de tarot, chiffre, visage, silhouette, robot, cerveau, bulle de chat.

**Tests à passer** : lisible à 40px · tient en monochrome (widget, écran verrouillé) · posée entre réseaux sociaux et banque, ne se perd pas et ne détonne pas · un inconnu deux secondes doit pouvoir la prendre pour une app de notes ou de papeterie.

### `mouvement`

`{components.mouvement.duree-courte}` (180ms) pour un retour tactile, `duree-standard` (320ms) pour une transition d'état / un fondu de texte, `duree-longue` (700ms) pour la matière du tronc, l'imagerie et le personnage. Courbe amortie unique `cubic-bezier(0.32, 0.08, 0.24, 1)`. **Aucun rebond, aucun ressort, aucun overshoot.** Voir *Mouvement, fondu & respiration* pour le détail des fondus et de `reduced-motion`.

### `focus`

Anneau 2px `bordure-forte`, offset 2px, rayon `{rounded.sm}`. Vérifié 4,29:1 sur `fond`, 3,54:1 sur `surface-elevee`, 6,59:1 en accessibilité. Visible sur **tous** les éléments interactifs, y compris les branches. Ne jamais utiliser `outline: none` sans remplaçant équivalent. **Sur imagerie**, l'anneau reste `bordure-forte` sur le voile ; si le voile est trop clair localement, doubler d'un liseré interne `fond` de 1px.

### Composants explicitement absents du système

Ces composants **n'existent pas** et ne doivent pas être créés (FR-031) : barre de progression · jauge · anneau de complétion · pourcentage · compteur de série · badge · médaille · trophée · note en étoiles · score · graphique d'évolution · courbe · classement · confettis · animation de célébration. Si un besoin semble en réclamer un, la réponse est l'arbre.

## Do's and Don'ts

| ✅ Faire | ❌ Ne pas faire |
|---|---|
| Nuit native, `#0C0A1E` indigo profond, mat et lumineux | Noir pur · gris neutre · nuit lourde d'écran éteint |
| **Violet, étoiles, lune, lotus — avec goût** : ils sont désormais permis | **Violet fluo · paillettes clinquantes · or brillant façon voyance de foire · scintillement kitsch** |
| Texte blanc `#EEECF7`, petit, qui **paraît en fondu** | `#FFFFFF` pur (halation) · texte qui glisse ou « pop » |
| **Voile de lisibilité sous tout texte posé sur image** (≥85 % courant / ≥70 % grand) | **Texte directement sur image sans voile** · `text-shadow` en guise de voile |
| Personnage aux **seuils** (ouverture, nomination, clôture), sinon le signe | **Avatar réaliste collé à chaque message** · personnage photoréaliste · cercle/vignette autour d'elle |
| Anam en illustration **peinte** + `mention-ia` persistante pour la transparence | Faire passer Anam pour une personne réelle · masquer la mention IA |
| Arbre de **nuit** : écorce argentée, feuillage bleu-lune, fruit qui luit, ciel étoilé | Arbre brun/terreux · halo de récompense · pop de célébration au changement d'état |
| L'arbre comme unique représentation du chemin | Barres de progression · jauges · séries · scores · badges · pourcentages |
| Signe abstrait (courbe du voile) en argent lunaire, ≤ 2 couleurs, lisible à 12px | Signe en `accent` (dilue l'action) · visage · orbe · bulle · onde sonore |
| Accent `#8FC1EF` = action seule ; `lueur` = points de lumière (jamais cliquables) | Accent en fond de section ou en état · lueur sur un bouton |
| Sérif pour Anam, grotesque pour l'utilisatrice et l'interface, `WONK 0`, graisse ≤ 500 | Mélanger les voix · tout en sérif · variantes wonky · gras · capitales de titre |
| Texte seul pour les états (« Noté. ») | Icônes d'état · coches vertes · pastilles · **emojis** |
| Deux tokens de bordure distincts, focus ≥ 3:1 (bordure-forte `#77719C`) | Border un champ avec `bordure` décorative |
| Grain de nuit ≤ 5 % (dither le banding), aucune ombre en nuit | Dégradé numérique gratuit · glow · lens flare · 3D · métallisé · ombre nette material |
| Une seule chose importante par vue, marges généreuses (le ciel) | Tableau de bord · grille dense · liste serrée · barre d'onglets chargée |
| **Scène continue sans bord** : régions reliées en fondu, séparation par le ton, le voile et la respiration ; filets **fonctionnels** seulement (focus, champs, contrôles) | **Cadre ou filet décoratif qui _ferme_ une zone** · basculement d'écran sec · barre/bande bordée persistante · encadrer une région ou le personnage |
| Discrétion **à la surface** : icône/notif/multitâche ne révèlent rien | Icône ou aperçu montrant lune, lotus, étoile, personnage, ou disant « horoscope » |
| Mode accessibilité `-clair` = contraste renforcé, imagerie atténuée, sur besoin | Le présenter comme un « thème jour » de confort |
| Silence traité comme un état visuel légitime (format *Veille*) | Écran de relance · badge de rappel · « ça fait 3 jours ! » |
| Ratio de contraste **mesuré** pour toute couleur ajoutée | Introduire une teinte « parce qu'elle est jolie en vignette » |
