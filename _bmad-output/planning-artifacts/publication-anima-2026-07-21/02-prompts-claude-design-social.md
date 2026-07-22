# Pack de prompts Claude Design — compte social d'Anima

Issu de l'atelier PUBLICATION du 21/07/2026 (`_bmad-output/brainstorming/brainstorm-publication-anima-2026-07-21/.memlog.md`).
Charte source conservée : `docs/anima-contexte.md`.

Ce fichier contient des prompts **prêts à copier-coller** dans Claude Design.
Chaque prompt est **autoportant** : il redonne tout le contexte nécessaire, on peut le coller seul sans avoir lu le reste du document.

---

# A. RAPPEL DE CADRAGE

## A.1 — Deux marques, deux directions artistiques. C'est voulu.

| | **Anima** (compte social) | **Anam** (l'application) |
|---|---|---|
| Surface | Instagram + TikTok, `@anima_retourasoi` | l'app mobile |
| Direction artistique | **Aquarelle pastel**, palette de `docs/anima-contexte.md` | **Terracotta mat**, bohème chic / yogi |
| Personnage | **OUI** — Anima, personnage récurrent | **NON** — aucun personnage, jamais |
| Pack de prompts | **ce fichier** | `_bmad-output/brainstorming/brainstorm-anima-app-2026-07-20/claude-design-prompts.md` |

**Ne jamais mélanger les deux packs.** Si un visuel social ressort en terracotta mat, c'est raté. Si un visuel d'app ressort avec un personnage féminin flottant, c'est raté. La séparation « site humain / app automatisée » est la doctrine du projet : la divergence de direction artistique la sert au lieu de la trahir.

## A.2 — Les trois corrections apportées à la charte

La charte `docs/anima-contexte.md` est **conservée telle quelle** (palette, typographies, traits non négociables, style aquarelle). Trois corrections seulement, mais elles sont impératives :

### Correction 1 — LE VISAGE N'EST JAMAIS MONTRÉ

Anima est toujours **de dos, de profil perdu (trois-quarts arrière), yeux clos, hors cadre, ou le visage caché par ses cheveux ou par son voile**. La charte §7 le suggérait déjà avec « de dos face à la lune » : on en fait la règle.

Trois raisons, toutes décisives :
1. **Neutralité.** Un sourire permanent est un jugement en image — une approbation. Le positionnement du compte est l'anti-complaisance et la neutralité absolue. Un visage souriant contredit chaque post.
2. **Coût.** Un personnage sans visage se décline beaucoup plus vite et se valide en un coup d'œil.
3. **Cohérence sérielle — la raison principale.** La dérive de visage est le **premier mode d'échec de la génération d'images IA sur une série**. Tenir un même visage sur 50 images est le problème le plus dur du médium. Pas de visage = pas de dérive.

### Correction 2 — ANIMA NE PRONONCE JAMAIS LA PHRASE DURE

C'est **L'EAU qui parle**. Anima est dans le cadre — au bord, la main dedans, regardant la rivière — mais elle n'est jamais la locutrice. Le texte appartient à l'eau, à la pluie, au gel, à la source.

Conséquence de composition, à respecter dans tous les gabarits : **le texte ne sort jamais de la bouche d'Anima**. Pas de bulle, pas de phylactère, pas de citation attribuée, pas de texte placé près de sa tête. Le texte est posé sur l'image, ou sur l'eau, ou dans le vide au-dessus d'elle. Anima **regarde** la phrase autant que la lectrice.

C'est ce dispositif qui permet de dire une chose très inconfortable sans jamais porter de jugement.

### Correction 3 — LE PERSONNAGE SERT D'ABORD LES CARROUSELS

La vidéo animée est **repoussée** (le carrousel fait ~1,7× plus de vues qu'un reel sur un compte de cette taille, et le kit d'animation coûte cher avant de produire quoi que ce soit). Tous les assets de ce pack sont donc pensés pour le **format image fixe 4:5**, en jeux de 5 à 8 cartes. La §8 de la charte (direction 3D et micro-animations) reste valide mais n'est pas commandée aujourd'hui.

## A.3 — Ce qui rend le compte reconnaissable

C'est la **reconnaissabilité dans le fil** qui fait la portée organique. Une lectrice doit identifier un post d'Anima **avant d'avoir lu un mot**, en scrollant vite. Les quatre signaux de reconnaissance, par ordre d'importance :

1. La **silhouette sans visage** — robe blanche, voile flottant, chevelure auburn ondulée, pieds nus.
2. La **palette pastel désaturée** — toujours les mêmes dix valeurs, jamais une couleur hors palette.
3. Le **grain de papier aquarelle** — visible sur chaque carte, y compris les cartes purement typographiques.
4. La **typographie sérif** — Cormorant Garamond en titre, jamais une grotesque, jamais une manuscrite fantaisie.

## A.4 — Les interdits absolus (valables sur TOUS les prompts de ce pack)

1. **Aucun visage visible.** Ni de face, ni de trois-quarts avant, ni entrevu, ni en reflet dans l'eau, ni flou. Aucun œil ouvert, aucune bouche, aucun sourire. Zéro exception.
2. **Aucune prédiction, aucun verdict.** Rien qui ressemble à « les astres disent que », à un pronostic, à un diagnostic. Le compte propose des outils de réflexion, jamais des certitudes.
3. **Aucun symbole ésotérique criard.** Pas de roue du zodiaque, pas de signes planétaires, pas de cartes de tarot, pas de boule de cristal, pas d'œil, pas de main de Fatma, pas de mandala, pas de chakra, pas de géométrie sacrée. **La lune est autorisée** (elle est dans la charte, c'est un halo, pas un symbole). Les étoiles sont autorisées **en poussière discrète seulement**, jamais en constellation dessinée.
4. **Aucun terracotta, aucun ocre brûlé, aucun mat texturé lin.** C'est la direction de l'app Anam, pas celle du social.
5. **Aucune couleur saturée, aucun néon, aucune ombre dure, aucun style cartoon / manga / 3D brillant.**
6. **Aucun texte anglais.** Tout est en français, tutoiement.
7. **Aucun vocabulaire de verdict** dans les textes générés : ni « toxique », ni « dépendance », ni « narcissique », ni aucun mot qui juge une personne.

---

# B. LES PROMPTS

> **Convention.** Chaque prompt est dans un bloc de code. On copie **tout le bloc**, du premier au dernier caractère, et on le colle dans Claude Design. Ce qui est écrit **hors** des blocs de code (« à quoi ça sert », « quoi joindre ») est pour Julian, pas pour Claude Design.

---

## 1. LE PERSONNAGE ANIMA SANS VISAGE — planche d'identité de référence

**À quoi ça sert :** c'est **l'asset maître du pack**, celui dont tout le reste découle. C'est l'image qu'on joindra à **chacune** des générations suivantes. Il faut y passer le temps nécessaire et itérer jusqu'à ce qu'elle soit vraiment juste : c'est de très loin l'investissement le plus rentable du pack. Ne lancez rien d'autre tant qu'elle n'est pas validée.

**Quoi joindre :** si des illustrations d'Anima existent déjà (celles qui ont servi à écrire la charte), joignez-les. Sinon, rien — ce prompt part de zéro.

```
Je conçois le personnage récurrent d'un compte Instagram francophone de développement personnel appelé « Éveil et Retour à soi ». Le personnage s'appelle Anima. J'ai besoin de sa PLANCHE D'IDENTITÉ DE RÉFÉRENCE : c'est le document maître, toutes les illustrations futures du compte devront s'y conformer exactement.

CONTEXTE
Anima est une figure féminine éthérée, présence calme et neutre, compagne de chemin. Le compte parle d'introspection avec une neutralité absolue : jamais de jugement, jamais d'approbation, jamais de prédiction. Le personnage sera décliné sur des dizaines de publications ; sa cohérence d'une image à l'autre est le critère numéro un de réussite.

CONTRAINTE FONDATRICE, NON NÉGOCIABLE : LE VISAGE N'EST JAMAIS VISIBLE
Anima ne montre jamais son visage. Aucune image, sous aucun angle, ne doit laisser voir ses yeux, sa bouche ou son expression. Les seuls cadrages autorisés sont :
• de dos, intégralement ;
• de profil perdu (trois-quarts arrière), où l'on ne voit que la ligne de la mâchoire et la nuque ;
• de profil strict avec les yeux clos et le visage en partie couvert par une mèche de cheveux ;
• tête inclinée vers le bas, le visage entièrement dans l'ombre de sa chevelure ;
• cadrage qui coupe au-dessus des épaules, le visage hors champ.
Ce n'est pas une préférence stylistique, c'est une règle produit. Une proposition qui montre un visage, même partiellement, même de loin, même flou, est hors sujet et doit être refaite.

IDENTITÉ VISUELLE — traits non négociables, identiques sur chaque image
• Jeune femme éthérée, gracile et élancée, silhouette en mouvement dansant ou en apesanteur. Jamais figée, jamais raide.
• Cheveux châtain-auburn ondulés, mi-longs jusqu'aux épaules, mèches lumineuses à reflets dorés, toujours portés par une brise. C'est le premier signe de reconnaissance du personnage — sa masse, sa couleur et son mouvement ne changent jamais.
• Longue robe blanche vaporeuse au tombé fluide, prolongée en voile flottant, texturée d'un fin scintillement nacré.
• Pieds nus. Toujours.
• Une tige feuillue verte fine s'enroule autour de son corps et de sa jambe.
• Une fleur rose poudré (magnolia ou lotus) qu'elle tient ou qui reste proche de ses mains.
• Une fine ligne de contour cuivrée / dorée cerne délicatement la silhouette et le voile.
• Une grande pleine lune lumineuse peut former un halo derrière elle.

STYLE
Illustration numérique façon aquarelle et gouache. Grain de papier visible. Dégradés doux et lumineux, lavis transparents, bords de couleur légèrement irréguliers comme un vrai lavis. Lignes fines cuivrées ou dorées cernant la silhouette. Lumière toujours diffuse et enveloppante : halo lunaire, lueur d'aube. Rien de dur, rien de contrasté. Ambiance apaisante et onirique.

PALETTE — valeurs exactes, aucune couleur en dehors de cette liste
Crème lumière #FAF0E6
Rose aube #F7DDD0
Blush pétale #ECB5A6
Rose fleur #E79DB0
Bleu brume #BFCDD6
Sauge d'eau #AEC4C0
Vert feuille #7E9B8E
Taupe lune #C8B4A2
Or / brun titre #9A7A55
Brun encre #6E5A46
Tons pastel désaturés et lumineux, jamais criards.

COMPOSITION DE LA PLANCHE
Une planche unique présentant le MÊME personnage sous six vues, toutes dans le même style, à la même échelle et sous la même lumière :
1. De dos, en pied, debout, immobile — la vue canonique de référence.
2. De dos, en pied, en mouvement dansant, voile et cheveux emportés.
3. De profil perdu (trois-quarts arrière), en pied.
4. De profil strict, yeux clos, assise, genoux repliés.
5. Buste de dos, cadrage rapproché, pour montrer la chevelure et l'attache du voile en détail.
6. Détail de la main tenant la fleur rose poudré, avec la tige feuillue.
Fond crème #FAF0E6 uni très légèrement texturé, généreusement aéré. Chaque vue nettement séparée des autres.

À ÉVITER ABSOLUMENT
- Tout visage visible, tout œil, toute bouche, tout sourire, toute expression — y compris de loin, y compris flou, y compris en reflet.
- Toute variation entre les six vues : ce doit être le même personnage, même chevelure, même robe, même morphologie, même âge apparent. Six vues d'une personne, pas six personnes.
- Les couleurs saturées, fluo ou néon ; toute couleur en dehors de la palette listée.
- Les ombres dures, les contrastes marqués, l'éclairage dramatique ou latéral appuyé.
- Le style cartoon, manga, anime, comics, le 3D rendu, le rendu brillant ou métallisé, le vectoriel plat lisse.
- Le rendu terracotta mat, sépia, ocre brûlé, lin brut (c'est la direction d'une AUTRE marque du même projet).
- Toute imagerie ésotérique explicite : roue du zodiaque, signes planétaires, cartes de tarot, boule de cristal, œil, main de Fatma, mandala, chakra, géométrie sacrée, constellations dessinées. La pleine lune en halo est autorisée, les étoiles seulement en poussière très discrète.
- Toute nudité, toute pose aguicheuse, tout cadrage suggestif. La silhouette est éthérée, pas sensuelle.
- Les compositions chargées, encombrées, avec des éléments décoratifs multipliés.
- Tout texte, toute légende, tout filigrane sur la planche.

LIVRABLE
1) La planche complète des six vues sur une seule image.
2) La vue 1 (de dos, debout, immobile) isolée en haute définition sur fond transparent — c'est l'image de référence qui sera jointe à toutes les générations suivantes.
3) Une fiche de spécification écrite en français listant précisément : la couleur et la longueur exactes des cheveux, la coupe et le tombé de la robe, le trajet de la tige feuillue sur le corps, l'espèce et la teinte de la fleur, l'épaisseur du contour doré. Cette fiche servira à vérifier la cohérence des images futures.
```

---

## 2. LA BIBLIOTHÈQUE DE POSES (10 poses, aucune ne montre le visage)

**À quoi ça sert :** c'est le stock. Une fois cette planche validée, on ne re-génère plus de personnage pour chaque post : on pioche une pose et on l'habille de texte. C'est ce qui fait passer la production d'un post de plusieurs heures à quelques minutes.

**Quoi joindre :** **impérativement** l'image de référence validée au prompt 1 (vue de dos isolée) + la planche des six vues.

```
Je décline un personnage récurrent déjà validé pour un compte Instagram francophone de développement personnel. Le personnage s'appelle Anima. Je joins sa planche d'identité de référence : le personnage doit rester EXACTEMENT le même, immédiatement reconnaissable d'une pose à l'autre.

CONTRAINTE FONDATRICE, NON NÉGOCIABLE : LE VISAGE N'EST JAMAIS VISIBLE
Aucune des poses demandées ne doit laisser voir les yeux, la bouche ou l'expression d'Anima. Elle est de dos, de profil perdu, yeux clos, le visage caché par ses cheveux, ou hors cadre. Une pose qui montre un visage, même partiellement, même de loin, même flou, est hors sujet.

IDENTITÉ À CONSERVER À L'IDENTIQUE (voir l'image de référence jointe)
Jeune femme éthérée, gracile et élancée. Cheveux châtain-auburn ondulés mi-longs à reflets dorés, portés par une brise. Longue robe blanche vaporeuse prolongée d'un voile flottant nacré. Pieds nus. Tige feuillue verte fine enroulée autour du corps et de la jambe. Fleur rose poudré (magnolia / lotus) tenue ou proche des mains. Fine ligne de contour cuivrée sur la silhouette et le voile.

CE QUE JE CHERCHE — DIX POSES, chacune illustrée séparément, toutes dans le même style et sous la même lumière

1. LE DOS FACE À LA LUNE — debout, de dos, immobile, face à une grande pleine lune basse qui forme un halo autour d'elle. La pose la plus calme du lot. Usage : ouverture de série, carte de titre.
2. LA MÉDITATION — assise en lotus vue de dos ou de trois-quarts arrière, dos droit, mains en mudra sur les genoux, la fleur posée devant elle au sol. Usage : posts sur le retour à soi, le silence, la pause.
3. LE RECUEILLEMENT — assise de profil strict, yeux clos, genoux repliés, tenant la fleur près de son cœur, une mèche de cheveux couvrant la joue. Usage : posts intimes, la série des consultations.
4. L'APESANTEUR — flottant dans l'air, corps légèrement incliné, vue de dos, voile et cheveux emportés en longue traîne. Usage : posts sur le lâcher-prise, l'évidence, transitions.
5. LES BRAS OUVERTS — debout de dos, bras écartés vers le ciel, voile déployé, tête légèrement renversée mais visage hors champ vers le haut. Usage : posts d'ouverture, de reprise, d'énergie.
6. LA MARCHE — vue de dos, en train de s'éloigner sur un chemin ou une berge, robe et cheveux au vent, léger flou de mouvement. Usage : posts sur le départ, le changement, la fin d'un cycle.
7. L'ASSISE AU BORD — assise sur une pierre ou une berge, vue de trois-quarts arrière, jambes repliées de côté, pieds nus près de l'eau, regardant vers le bas et vers le loin. Usage : la pose la plus polyvalente, celle du moteur éditorial de l'eau.
8. LA MAIN QUI EFFLEURE — accroupie ou penchée, vue de dos, une main tendue vers le bas qui effleure une surface (eau, herbe haute, sol), cheveux tombant vers l'avant et masquant entièrement le profil. Usage : posts sur le contact, le détail, la sensation.
9. LE REGARD PAR-DESSUS L'ÉPAULE — debout de dos, buste très légèrement tourné, on devine la ligne de la mâchoire et rien d'autre, le reste du visage caché par la chevelure. La pose la plus narrative du lot. Usage : posts qui interpellent, cartes d'accroche.
10. LA SILHOUETTE ASSISE DE LOIN — très petite dans un grand cadre vide, assise de dos, beaucoup d'espace autour. Usage : posts sur la solitude, l'échelle, le temps long ; excellente carte de fin.

STYLE
Illustration numérique façon aquarelle et gouache, grain de papier visible, lavis transparents aux bords légèrement irréguliers, dégradés doux et lumineux. Fines lignes cuivrées cernant la silhouette. Lumière toujours diffuse et enveloppante : halo lunaire ou lueur d'aube. Rien de dur, rien de contrasté. Détails magiques discrets seulement : poussière d'étoiles, reflets nacrés, quelques pétales, fines feuilles. Moins c'est plus.

PALETTE — valeurs exactes, aucune couleur en dehors de cette liste
Crème lumière #FAF0E6, Rose aube #F7DDD0, Blush pétale #ECB5A6, Rose fleur #E79DB0, Bleu brume #BFCDD6, Sauge d'eau #AEC4C0, Vert feuille #7E9B8E, Taupe lune #C8B4A2, Or / brun titre #9A7A55, Brun encre #6E5A46.

COMPOSITION
Chaque pose en format portrait 4:5. Personnage plutôt centré ou décalé, avec BEAUCOUP d'espace vide autour et surtout dans le tiers supérieur : cet espace recevra du texte plus tard, il doit rester calme, peu texturé et sans détail. Fond simple : un lavis dégradé, une ligne d'horizon, une surface d'eau. Jamais de décor chargé.

À ÉVITER ABSOLUMENT
- Tout visage visible, tout œil, toute bouche, tout sourire, y compris flou ou en reflet.
- Toute dérive d'identité entre les dix poses : même chevelure exactement (couleur, longueur, ondulation), même robe, même morphologie, même âge apparent, même contour doré. Dix poses d'UNE personne, pas dix personnages.
- Les couleurs saturées ou néon, toute couleur hors palette.
- Les ombres dures, les contrastes marqués, l'éclairage dramatique.
- Le cartoon, le manga, l'anime, le 3D rendu, le brillant, le métallisé, le vectoriel plat.
- Le terracotta mat, le sépia, l'ocre brûlé, le lin brut.
- Toute imagerie ésotérique explicite : zodiaque, signes planétaires, tarot, boule de cristal, œil, mandala, chakra, constellations dessinées.
- Toute pose aguicheuse, toute nudité, tout cadrage suggestif.
- Le décor chargé ou le tiers supérieur encombré (il doit rester disponible pour le texte).
- Tout texte, toute légende, tout filigrane.

LIVRABLE
Les dix poses, chacune en image séparée au format 4:5 haute définition, plus une version de chaque sur fond transparent. Plus une planche-contact réunissant les dix vignettes côte à côte, avec le nom de la pose écrit dessous en petit sérif brun #6E5A46.
```

---

## 3. ANIMA ET L'EAU — les six mises en scène de la série moteur

**À quoi ça sert :** l'eau est **le moteur éditorial du compte**, la série à volume infini qui démarre immédiatement. Chaque comportement de l'eau donne un post. Et surtout, c'est le dispositif qui garantit la neutralité : **c'est l'eau qui parle, pas Anima**. On peut ainsi dire une chose très inconfortable sans jamais porter de jugement.

**Quoi joindre :** la référence personnage du prompt 1 + les poses 7, 8 et 10 du prompt 2.

```
Je conçois les mises en scène d'une série éditoriale pour un compte Instagram francophone de développement personnel. Le personnage s'appelle Anima ; je joins sa référence validée, il doit rester EXACTEMENT le même personnage.

LE DISPOSITIF, à comprendre avant de dessiner
La série repose sur une métaphore : l'eau. Chaque publication observe un comportement de l'eau et en tire une phrase sur la vie intérieure. Le point crucial est que C'EST L'EAU QUI PARLE, PAS ANIMA. Anima est présente dans le cadre — au bord, la main dedans, regardant la rivière — mais elle n'est jamais celle qui prononce. Elle observe l'eau en même temps que la lectrice. Ce dispositif permet de dire quelque chose d'inconfortable sans jamais porter de jugement sur personne.
Conséquence directe pour la composition : le personnage n'est JAMAIS le sujet principal de l'image. L'EAU est le sujet. Anima est petite, décentrée, secondaire — une présence, pas une héroïne. Elle n'occupe jamais plus d'un tiers de la hauteur du cadre.

CONTRAINTE FONDATRICE, NON NÉGOCIABLE : LE VISAGE N'EST JAMAIS VISIBLE
Anima est de dos, de profil perdu, yeux clos ou le visage caché par ses cheveux. Aucune image ne doit laisser voir ses yeux, sa bouche ou son expression — y compris dans un reflet dans l'eau. Un reflet ne doit JAMAIS renvoyer un visage : il renvoie une silhouette, une forme diffuse, ou rien.

IDENTITÉ À CONSERVER À L'IDENTIQUE
Jeune femme éthérée, gracile. Cheveux châtain-auburn ondulés mi-longs à reflets dorés. Longue robe blanche vaporeuse prolongée d'un voile flottant nacré. Pieds nus. Tige feuillue verte enroulée autour du corps. Fleur rose poudré. Fin contour cuivré sur la silhouette.

CE QUE JE CHERCHE — SIX MISES EN SCÈNE, chacune illustrée séparément

1. AU BORD — Anima assise sur une berge ou une pierre plate, vue de trois-quarts arrière, pieds nus au ras de l'eau, très petite dans un large cadre. L'eau occupe la moitié basse : rivière calme, courant lisible aux plis de surface. Ambiance : l'observation patiente.
2. LA MAIN DEDANS — cadrage rapproché sur une main et un avant-bras qui entrent dans l'eau claire, avec les cercles concentriques que le contact provoque. Anima n'est présente que par cette main et une amorce de manche de robe ; sa tête est totalement hors champ. Ambiance : le contact, la perturbation minuscule.
3. LE REFLET — Anima debout de dos au bord d'une eau immobile. Son reflet est présent mais DÉLIBÉRÉMENT INCOMPLET ET DIFFUS : on reconnaît la robe et la masse des cheveux, jamais un visage. Le reflet peut être fragmenté par une ride de surface. Ambiance : ce que l'on voit de soi et ce qui manque.
4. LA PLUIE — Anima de dos sous une pluie fine et verticale, cheveux et robe alourdis, tenant peut-être la fleur au creux d'une main. Surface d'eau au sol constellée d'impacts. Ambiance : ce qui arrive sans qu'on l'ait demandé, ce qu'on traverse.
5. LE GEL — une surface d'eau prise dans la glace, fine fissure claire qui la traverse, cristaux en dentelle sur les bords. Anima est au loin, minuscule, de dos, à peine perceptible. La glace et la fissure sont le vrai sujet. Ambiance : ce n'est pas la force qui fend, c'est la répétition du cycle.
6. LA SOURCE — un filet d'eau qui sort de la roche ou de la mousse, très petit, très net, dans un environnement de pierre et de vert feuille. Anima accroupie de dos à côté, mains proches sans toucher, cheveux tombant vers l'avant et masquant tout le profil. Ambiance : le commencement, ce qui est déjà là avant qu'on s'en aperçoive.

TRAITEMENT DE L'EAU — c'est le sujet, elle doit être remarquable
Aquarelle transparente en lavis superposés. On voit à travers l'eau : le fond, les galets, une ombre. Reflets rendus par des réserves de blanc de papier et de fines touches nacrées, jamais par du blanc opaque. Les mouvements (rides, cercles, courant, impacts de pluie, fissure de gel) sont dessinés par des lignes fines cuivrées et par des variations de lavis, jamais par un effet numérique lisse. L'eau est bleu brume #BFCDD6 et sauge d'eau #AEC4C0, avec des passages crème là où la lumière la traverse.

STYLE
Illustration numérique façon aquarelle et gouache, grain de papier visible, bords de lavis légèrement irréguliers. Lumière diffuse d'aube ou de clair de lune, enveloppante, jamais dure. Ambiance contemplative, apaisée, jamais mélancolique ni dramatique. Détails magiques très discrets : poussière d'étoiles, reflets nacrés, un pétale. Moins c'est plus.

PALETTE — valeurs exactes, aucune couleur en dehors de cette liste
Crème lumière #FAF0E6, Rose aube #F7DDD0, Blush pétale #ECB5A6, Rose fleur #E79DB0, Bleu brume #BFCDD6, Sauge d'eau #AEC4C0, Vert feuille #7E9B8E, Taupe lune #C8B4A2, Or / brun titre #9A7A55, Brun encre #6E5A46.

COMPOSITION
Format portrait 4:5. L'eau occupe la moitié basse ou plus. Le tiers supérieur reste TRÈS calme, quasi uni, faiblement texturé : il recevra du texte, aucun détail ne doit s'y trouver. Anima toujours petite et décentrée, jamais au centre géométrique, jamais en gros plan sauf pour la mise en scène 2.

À ÉVITER ABSOLUMENT
- Tout visage visible, y compris et surtout dans un reflet dans l'eau.
- Anima trop grande, centrée, héroïque ou dominante dans le cadre : elle est secondaire, l'eau est le sujet.
- Toute bulle de dialogue, tout phylactère, tout texte semblant sortir de sa bouche, toute citation attribuée à elle. Le texte n'appartient jamais au personnage.
- L'eau rendue en dégradé numérique lisse, en 3D, en photoréalisme, avec du caustique brillant ou du lens flare.
- L'océan tropical turquoise saturé, la piscine, la cascade spectaculaire, le paysage de carte postale.
- L'ambiance triste, noyée, dramatique, orageuse ; les eaux noires ou menaçantes.
- Les couleurs saturées ou néon, toute couleur hors palette. Les ombres dures.
- Le cartoon, le manga, le 3D rendu, le brillant, le vectoriel plat.
- Le terracotta mat, le sépia, l'ocre brûlé, le lin brut.
- Toute imagerie ésotérique explicite : zodiaque, signes planétaires, tarot, boule de cristal, œil, mandala, constellations dessinées.
- Tout texte sur l'image à ce stade.

LIVRABLE
Les six mises en scène en 4:5 haute définition. Pour chacune, ajouter une variante « fond seul », sans le personnage, utilisable comme carte intermédiaire de carrousel.
```

---

## 4. LE GABARIT DE CARROUSEL

**À quoi ça sert :** c'est le moule. Une fois ce gabarit validé, produire un carrousel consiste à remplacer le texte et le fond — plus jamais à re-concevoir une mise en page. C'est ce qui rend tenable la cadence de 3 à 5 publications par semaine.

**Deux mécaniques Instagram commandent ce gabarit, et elles ne sont pas négociables :**
- **La carte 2 doit tenir seule.** Si la lectrice ne swipe pas, Instagram remontre souvent le carrousel **en démarrant à la carte 2**. Une carte 2 qui ne se comprend qu'après la carte 1 gaspille cette seconde chance.
- **Le CTA final est « envoie ça à quelqu'un ».** Les partages en messages privés gouvernent la portée auprès des non-abonnés. Pas « enregistre », pas « commente ».

**Quoi joindre :** la référence personnage + 2 ou 3 poses validées + 2 fonds du prompt 5 s'ils existent déjà.

```
Je conçois le gabarit de carrousel d'un compte Instagram francophone de développement personnel appelé « Éveil et Retour à soi ». J'ai besoin d'un SYSTÈME DE MISE EN PAGE réutilisable, pas d'un one-shot : ce gabarit servira à produire des dizaines de carrousels.

FORMAT
Portrait 4:5, 1080 × 1350 pixels. Jeu de 6 cartes.

LA GRILLE — c'est le cœur de la demande
Définis et documente une grille unique, appliquée à toutes les cartes :
• Marges de sécurité généreuses et identiques sur les quatre côtés. Aucun texte ne doit approcher les bords : sur Instagram, le bas de l'image est partiellement recouvert par l'interface, et l'aperçu en grille de profil recadre en carré central. Le texte doit rester lisible dans un recadrage carré centré.
• Une colonne de texte unique, largeur de ligne courte (environ 20 à 30 caractères par ligne). Jamais deux colonnes.
• Une zone de texte fixe et identique d'une carte à l'autre — le texte ne saute pas d'un coin à l'autre entre deux cartes. Le regard doit rester posé au même endroit pendant tout le swipe.
• Une échelle typographique à trois niveaux seulement : titre, corps, mention. Documente les tailles en pixels.
• Interlignage très généreux, minimum 1.5 sur le corps de texte.

TYPOGRAPHIE
• Titres : Cormorant Garamond. Serif élégant et romantique.
• Accents et signature : Petit Formal Script. Calligraphie délicate, à doser très parcimonieusement — jamais pour un texte long, jamais pour une information à lire vite.
• Corps de texte : EB Garamond.
Aucune capitale criée, aucune graisse lourde, aucune police manuscrite fantaisie, aucune grotesque.
Couleur de texte par défaut : brun encre #6E5A46. Accents en or / brun #9A7A55.

LES SIX CARTES

CARTE 1 — L'ACCROCHE
Rôle : arrêter le pouce. Une seule phrase courte, en très gros Cormorant Garamond, occupant les deux tiers hauts. Le fond est une texture pastel calme ou une scène d'eau très sobre. Le personnage est ABSENT ou réduit à une silhouette minuscule en bas de cadre : la carte 1 est typographique avant tout. Aucun élément décoratif ne doit concurrencer la phrase. Un discret marqueur de swipe en bas à droite (une fine flèche cuivrée ou trois points), assez petit pour ne pas devenir un élément graphique.

CARTE 2 — LE RETOURNEMENT, ET ELLE DOIT TENIR SEULE
Règle absolue : cette carte doit être entièrement compréhensible SANS avoir lu la carte 1. Instagram remontre souvent un carrousel en démarrant à la carte 2 ; une carte 2 qui dépend de la précédente gaspille cette seconde chance. Elle porte donc une phrase autonome, aussi forte que la carte 1, dans la même zone de texte et à une taille à peine inférieure. Elle ne commence jamais par « et », « donc », « alors », « c'est pourquoi », ni par un pronom dont le référent est sur la carte 1.

CARTES 3 à 5 — LE DÉVELOPPEMENT
Une phrase par carte, jamais plus. Jamais de liste à puces, jamais de paragraphe. Les longueurs de phrase sont volontairement irrégulières d'une carte à l'autre — c'est un parti pris de rythme. Chaque carte a un fond différent des autres mais visiblement de la même famille : ce sont des variations de texture et de cadrage, pas des univers différents. Le personnage peut apparaître sur une ou deux de ces cartes, toujours petit, décentré, et jamais avec le texte accolé à sa tête.

CARTE 6 — LA SIGNATURE ET L'APPEL À L'ACTION
Voir le prompt dédié à la carte de signature. Elle porte l'appel « envoie ça à quelqu'un », le nom du compte et rien d'autre.

RÈGLE DE PLACEMENT DU TEXTE, IMPÉRATIVE
Le texte n'appartient jamais au personnage. Aucune bulle de dialogue, aucun phylactère, aucun texte sortant de sa bouche, aucun texte placé juste à côté de sa tête, aucune citation qui lui soit attribuée. Le texte est posé sur le vide, sur le ciel ou sur l'eau. Le personnage regarde le texte au même titre que la lectrice.
Corollaire : sur chaque carte, la zone de texte est un aplat calme, presque uni, peu texturé. Si le fond est chargé à cet endroit, éclaircir cette zone par un très léger voile crème #FAF0E6 — jamais par un rectangle blanc opaque à bords nets.

LISIBILITÉ — à tester dans le livrable
Le contraste du texte doit tenir dans un fil qui défile vite, sur un petit écran, à luminosité réduite. Vérifie le contraste du brun encre #6E5A46 sur chaque fond proposé et signale toute combinaison qui passe sous un ratio de 4.5:1. Les pastels désaturés sur crème échouent facilement ce test : c'est le risque principal de ce système, traite-le explicitement.

STYLE
Aquarelle pastel douce, grain de papier visible sur toutes les cartes y compris les cartes purement typographiques. Lumière diffuse et enveloppante. Composition très aérée, le vide est un matériau. Aucune bordure dessinée, aucun cadre, aucun encadré, aucune carte à coins arrondis simulée.

PALETTE — valeurs exactes, aucune couleur en dehors de cette liste
Crème lumière #FAF0E6, Rose aube #F7DDD0, Blush pétale #ECB5A6, Rose fleur #E79DB0, Bleu brume #BFCDD6, Sauge d'eau #AEC4C0, Vert feuille #7E9B8E, Taupe lune #C8B4A2, Or / brun titre #9A7A55, Brun encre #6E5A46.

À ÉVITER ABSOLUMENT
- Tout visage visible sur toute carte.
- Toute bulle de dialogue, tout phylactère, toute citation attribuée au personnage.
- Les zones de texte qui se déplacent d'une carte à l'autre ; les tailles de texte qui changent sans raison.
- Le texte trop petit, trop clair, ou posé sur une zone texturée : c'est le défaut le plus fréquent et le plus disqualifiant.
- Le texte placé à moins d'une marge de sécurité du bord, ou dans une zone qui disparaît au recadrage carré.
- Les numéros de carte proéminents (« 1/6 » en gros), les barres de progression, les flèches criardes, les gros boutons « swipe ».
- L'anglais, les emoji, les hashtags écrits sur l'image.
- Les couleurs saturées ou néon, toute couleur hors palette, les ombres dures, les ombres portées d'interface numérique.
- Le terracotta mat, l'ocre brûlé, le sépia, le lin brut.
- Toute imagerie ésotérique explicite : zodiaque, signes planétaires, tarot, boule de cristal, œil, mandala, constellations dessinées.
- Tout ce qui ressemble à une prédiction, un pronostic, un horoscope daté, un verdict.
- Le style « citation Pinterest » : guillemets décoratifs géants, cadre doré, script illisible, fond flouté.

LIVRABLE
1) Le jeu complet des 6 cartes en 1080 × 1350, remplies avec un exemple de texte français réaliste.
2) La grille documentée : marges en pixels, zone de texte, tailles typographiques, interlignages, couleurs et leurs rôles.
3) Une simulation du carrousel vu dans un fil Instagram sur téléphone, à taille réelle, pour juger la lisibilité.
4) Une simulation de la carte 1 vue dans la grille du profil, recadrée en carré, pour vérifier que rien d'essentiel n'est coupé.
5) Un second jeu de 6 cartes avec un texte différent et des fonds différents, pour prouver que le gabarit est réutilisable sans se ressembler.
```

---

## 5. LES FONDS ET TEXTURES DÉCLINABLES (8 fonds)

**À quoi ça sert :** c'est ce qui empêche les carrousels de se ressembler tout en gardant l'évidence qu'ils viennent du même compte. Sans cette banque, tous les posts finissent identiques au bout de trois semaines, et la lectrice décroche.

**Quoi joindre :** la palette validée + une carte du gabarit (prompt 4).

```
Je conçois la banque de fonds d'un compte Instagram francophone de développement personnel. Ces fonds serviront de support à des cartes de carrousel typographiques. J'ai besoin de HUIT fonds distincts mais manifestement issus du même compte.

L'ENJEU EXACT
Deux exigences contradictoires à tenir en même temps :
1. VARIÉTÉ — deux carrousels publiés à une semaine d'intervalle ne doivent pas se ressembler. La lectrice ne doit jamais avoir l'impression de revoir le même post.
2. UNITÉ — mais on doit reconnaître le compte instantanément en scrollant, sans lire un mot. La palette et le grain de papier sont les invariants qui portent cette reconnaissance.
La variété doit donc venir de la TEXTURE, du CADRAGE et de la RÉPARTITION DES VALEURS — jamais d'un changement de palette ni de technique.

CONTRAINTE COMMUNE À TOUS LES FONDS
• Grain de papier aquarelle visible sur les huit.
• Aucune couleur en dehors de la palette listée plus bas.
• Une zone calme, quasi unie et peu texturée occupant au minimum le tiers supérieur : elle recevra le texte. Sur chaque fond, cette zone doit offrir assez de contraste avec le brun encre #6E5A46 pour rester lisible sur un petit écran.
• Format portrait 4:5, 1080 × 1350 pixels.
• Aucun personnage, aucune figure humaine sur ces fonds : ils sont neutres et se combineront séparément avec le personnage.

LES HUIT FONDS

1. LAVIS D'AUBE — dégradé vertical très doux de crème #FAF0E6 vers rose aube #F7DDD0, bords de lavis irréguliers, quelques auréoles d'aquarelle. Le fond le plus neutre et le plus utilisé.
2. SURFACE D'EAU — vue de dessus d'une eau calme, plis de surface en fines lignes cuivrées, transparences en bleu brume #BFCDD6 et sauge d'eau #AEC4C0. Moitié haute apaisée.
3. BRUME — voile de bleu brume #BFCDD6 sur crème, dégradés très étalés, aucun bord net, sensation d'air chargé d'humidité.
4. PAPIER NU — quasi uni, crème #FAF0E6, uniquement le grain du papier et une très légère variation de teinte, avec une fine marge de lavis irrégulier sur un seul bord. Le fond le plus silencieux, à réserver aux phrases les plus fortes.
5. VÉGÉTAL — quelques feuilles fines et une tige, en vert feuille #7E9B8E et sauge d'eau #AEC4C0, cantonnées à un angle bas ou à un seul bord. Les trois quarts de la carte restent vides.
6. HALO LUNAIRE — un grand disque de lumière diffuse en taupe lune #C8B4A2 et crème, décentré, sans contour dessiné, avec une poussière d'étoiles très discrète. Aucun croissant, aucune constellation.
7. PÉTALES — deux ou trois pétales rose fleur #E79DB0 et blush #ECB5A6 posés sur un lavis crème, avec leur ombre portée très douce. Très peu d'éléments, beaucoup de vide.
8. NUIT DOUCE — le seul fond sombre. Bleu brume #BFCDD6 assombri vers un bleu-gris profond mais jamais noir, avec des reflets nacrés. Sur celui-ci, le texte passe en crème #FAF0E6 et non en brun : documente cette inversion.

STYLE
Aquarelle et gouache, lavis transparents superposés, réserves de blanc de papier, bords de couleur légèrement irréguliers. Aucun dégradé numérique lisse, aucun bruit numérique, aucun filtre. Lumière diffuse. Tout doit avoir l'air peint, jamais généré.

PALETTE — valeurs exactes, aucune couleur en dehors de cette liste
Crème lumière #FAF0E6, Rose aube #F7DDD0, Blush pétale #ECB5A6, Rose fleur #E79DB0, Bleu brume #BFCDD6, Sauge d'eau #AEC4C0, Vert feuille #7E9B8E, Taupe lune #C8B4A2, Or / brun titre #9A7A55, Brun encre #6E5A46.

À ÉVITER ABSOLUMENT
- Toute figure humaine, toute silhouette, tout visage.
- Toute couleur hors palette, toute saturation, tout néon, tout dégradé violet-bleu de « wellness app ».
- Le dégradé numérique lisse, le flou gaussien, le bokeh, le lens flare, le glow, le bruit numérique.
- Les motifs répétitifs de type papier peint, les trames régulières, les damiers, les grilles.
- Les fonds trop chargés dans le tiers supérieur — c'est le défaut disqualifiant, la zone de texte doit rester exploitable.
- Toute imagerie ésotérique explicite : zodiaque, signes planétaires, tarot, cristaux, mandala, chakra, constellations dessinées, croissant de lune stylisé, géométrie sacrée.
- Le terracotta mat, l'ocre brûlé, le sépia, le lin brut, la trame textile (direction d'une AUTRE marque du projet).
- Le noir pur, y compris sur le fond sombre.
- Tout texte, tout filigrane, tout logo.

LIVRABLE
1) Les huit fonds en 1080 × 1350 haute définition.
2) Une planche-contact des huit vignettes côte à côte, pour vérifier d'un coup d'œil qu'ils sont variés ET de la même famille.
3) Pour chaque fond, une version avec un exemple de phrase française posée dessus en Cormorant Garamond brun encre #6E5A46 (crème #FAF0E6 sur le fond 8), afin de valider la lisibilité.
4) Une note écrite indiquant, pour chaque fond, le ratio de contraste du texte et le type de message auquel il convient le mieux.
```

---

## 6. LA CARTE DE SIGNATURE (fin de carrousel, CTA « envoie ça à quelqu'un »)

**À quoi ça sert :** c'est la carte la plus rentable du pack. Elle est identique sur **tous** les carrousels : produite une fois, réutilisée indéfiniment. Elle porte le seul appel à l'action du dispositif — l'envoi en message privé, qui est le signal qui gouverne la portée auprès des non-abonnés.

**Attention :** cette carte ne demande **jamais** d'email. Le post fait la portée ; c'est le **profil** qui convertit.

**Quoi joindre :** la référence personnage (pose 10, silhouette de loin) + le gabarit du prompt 4.

```
Je conçois la carte de fin de carrousel d'un compte Instagram francophone de développement personnel appelé « Éveil et Retour à soi ». Cette carte sera IDENTIQUE sur tous les carrousels du compte : c'est la signature visuelle du compte, elle doit être excellente et intemporelle.

RÔLE DE LA CARTE
Elle porte un seul appel à l'action : « envoie ça à quelqu'un ». C'est délibérément l'envoi en message privé qui est demandé, pas l'enregistrement ni le commentaire.
Ton visé : une invitation calme, jamais une injonction marketing. On ne dit pas « TAGUE UNE AMIE », on ne met pas de flèche criarde, on ne met pas d'emoji. La formulation reste douce et fait confiance à la lectrice.

CE QUE LA CARTE CONTIENT — et rien d'autre
1. La phrase d'appel : « Envoie ça à quelqu'un. » en Cormorant Garamond, taille moyenne, brun encre #6E5A46. C'est l'élément principal.
2. Éventuellement une seconde ligne très courte et plus discrète, en EB Garamond, du type « Elle saura pourquoi. »
3. Le nom du compte : « Éveil et Retour à soi », en petit, en Petit Formal Script ou en Cormorant Garamond, en or / brun #9A7A55.
4. La silhouette d'Anima, minuscule, de dos, en bas de cadre, très discrète — une présence, pas un sujet. Elle ne montre jamais son visage.
Rien d'autre. Pas d'icône, pas de logo de réseau social, pas de flèche, pas d'arobase criée, pas de mention « lien en bio », pas d'adresse email, pas de formulaire, pas de code QR.

STYLE
Aquarelle pastel douce, grain de papier visible. Fond très calme, presque uni : crème #FAF0E6 ou un lavis rose aube #F7DDD0 très étalé. Lumière diffuse. Composition centrée, extrêmement aérée, silencieuse. Cette carte est la plus vide du carrousel : c'est un point final, pas une conclusion bavarde.

PALETTE — valeurs exactes, aucune couleur en dehors de cette liste
Crème lumière #FAF0E6, Rose aube #F7DDD0, Blush pétale #ECB5A6, Rose fleur #E79DB0, Bleu brume #BFCDD6, Sauge d'eau #AEC4C0, Vert feuille #7E9B8E, Taupe lune #C8B4A2, Or / brun titre #9A7A55, Brun encre #6E5A46.

FORMAT
Portrait 4:5, 1080 × 1350 pixels. Marges de sécurité larges : cette carte doit rester lisible même quand l'interface d'Instagram recouvre le bas de l'image.

À ÉVITER ABSOLUMENT
- Tout visage visible.
- Toute esthétique de publicité : bouton, encadré, bandeau de couleur, flèche épaisse, badge, pastille, contraste agressif.
- Les emoji, les majuscules criées, les points d'exclamation multiples, l'anglais.
- Les icônes de réseaux sociaux, les logos de plateformes, les codes QR.
- Toute demande d'email, tout formulaire, toute mention d'inscription ou de newsletter sur cette carte.
- Les mentions « abonne-toi », « like », « enregistre », « commente » : le seul appel est l'envoi en message privé.
- Les guillemets décoratifs géants, le style « citation Pinterest ».
- Les couleurs saturées ou néon, toute couleur hors palette, les ombres dures.
- Le terracotta mat, l'ocre brûlé, le sépia, le lin brut.
- Toute imagerie ésotérique explicite : zodiaque, tarot, cristaux, mandala, constellations dessinées.

LIVRABLE
1) Trois variantes de la carte, sur trois fonds différents de la palette, pour choisir la définitive.
2) La variante retenue déclinée sur le fond sombre « nuit douce », avec le texte en crème #FAF0E6.
3) Une simulation de la carte vue en fin de carrousel sur téléphone, avec l'interface d'Instagram par-dessus, pour vérifier que rien d'important n'est masqué.
```

---

## 7. LA PHOTO DE PROFIL ET LA REFONTE DU PROFIL

**À quoi ça sert :** le post fait la portée, **le profil convertit**. C'est le seul mécanisme de capture du dispositif, et il se construit **une fois** pour zéro minute par semaine ensuite. C'est aussi l'asset le plus rentable du pack après le personnage.

**Quoi joindre :** la référence personnage + la carte de signature validée.

```
Je refonds le profil Instagram d'un compte francophone de développement personnel appelé « Éveil et Retour à soi ». Le compte publie des carrousels illustrés autour d'un personnage récurrent appelé Anima, une figure féminine éthérée dont le visage n'est jamais montré. Je joins sa référence visuelle.

CE QUE LE PROFIL DOIT FAIRE
Une visiteuse arrive depuis un carrousel qu'on lui a envoyé en message privé. Elle a environ trois secondes. Le profil doit lui faire comprendre en un coup d'œil de quoi il s'agit, et lui donner une seule chose à faire ensuite. C'est le profil qui convertit, pas le post.
Positionnement à faire sentir : de l'introspection honnête. Ni voyance, ni prédiction, ni promesse de destin. Une neutralité calme, jamais de complaisance, jamais de verdict.

J'AI BESOIN DE QUATRE CHOSES

1. LA PHOTO DE PROFIL
Elle s'affiche en cercle, souvent à moins de 40 pixels de diamètre. Contrainte de lisibilité extrême : tout détail fin disparaît.
Explore six propositions :
• La silhouette d'Anima de dos, très simplifiée, buste seul, devant un disque de pleine lune — réduite à trois ou quatre valeurs.
• Le seul mouvement de sa chevelure, traité comme une forme abstraite.
• La fleur rose poudré seule, très simplifiée, en aplat aquarelle.
• Une goutte ou un cercle concentrique sur l'eau, en lignes cuivrées.
• Un croissant de lumière diffuse, sans contour, sans devenir un croissant de lune ésotérique.
• La lettre A en Cormorant Garamond, traitée comme une marque taillée, sur un aplat crème.
Deux à trois valeurs maximum par proposition. Aucun texte long, aucun détail fin, aucun contour à moins de 3 pixels d'épaisseur à taille réelle.

2. LA BIO
Rédige trois propositions de bio en français, chacune en 4 lignes maximum, tutoiement, ton calme et net. Chaque bio doit :
• dire ce qu'on trouve ici, sans jargon spirituel et sans promesse de prédiction ;
• contenir des mots que les gens tapent réellement dans une recherche (développement personnel, retour à soi, introspection, bien-être) ;
• se terminer par une ligne qui envoie vers le lien.
INTERDIT dans la bio : « voyance », « médium », « ton avenir », « prédiction », « les astres te disent », toute promesse de résultat, toute accumulation d'emoji, tout anglais.
Fournis aussi le libellé exact du lien : court, concret, qui dit ce qu'on obtient en cliquant.

3. LE POST ÉPINGLÉ — un carrousel de présentation en 5 cartes
Il s'adresse à quelqu'un qui vient d'arriver. Sa mise en page suit le même gabarit que les autres carrousels du compte.
• Carte 1 : ce qu'est ce compte, en une phrase courte, en très gros Cormorant Garamond.
• Carte 2 : ce que ce compte NE fait PAS — pas de prédiction, pas de verdict. Elle doit se comprendre seule, sans avoir lu la carte 1.
• Carte 3 : la promesse, en une phrase.
• Carte 4 : à qui ça s'adresse, en une phrase.
• Carte 5 : la carte de signature, avec l'appel « envoie ça à quelqu'un ».
Une seule phrase par carte. Jamais de liste à puces. Jamais de paragraphe.

4. LES COUVERTURES DE STORIES À LA UNE
Six couvertures, en cercle, très lisibles à petite taille, formant une rangée visiblement cohérente :
« L'eau » · « Elle m'a demandé » · « Ton thème » · « Commencer » · « Questions » · « Le lien »
Chacune : un aplat de la palette + un motif abstrait aquarelle extrêmement simple + éventuellement un mot très court en Cormorant Garamond. Aucune photo, aucune icône générique, aucun pictogramme d'interface.

STYLE COMMUN À TOUT
Aquarelle pastel douce, grain de papier visible, lumière diffuse et enveloppante, composition très aérée.
Typographie : titres en Cormorant Garamond, accents en Petit Formal Script (très parcimonieux), corps en EB Garamond.

PALETTE — valeurs exactes, aucune couleur en dehors de cette liste
Crème lumière #FAF0E6, Rose aube #F7DDD0, Blush pétale #ECB5A6, Rose fleur #E79DB0, Bleu brume #BFCDD6, Sauge d'eau #AEC4C0, Vert feuille #7E9B8E, Taupe lune #C8B4A2, Or / brun titre #9A7A55, Brun encre #6E5A46.

À ÉVITER ABSOLUMENT
- Tout visage visible sur la photo de profil ou ailleurs.
- Une photo de profil trop détaillée : tout ce qui devient illisible à 40 pixels est raté.
- Toute imagerie ésotérique explicite : roue du zodiaque, signes planétaires, tarot, boule de cristal, œil, main de Fatma, mandala, chakra, constellations dessinées.
- Tout vocabulaire de voyance ou de prédiction dans la bio.
- Les emoji en rafale, l'anglais, les majuscules criées, les points d'exclamation multiples.
- Les icônes génériques d'application, les pictogrammes d'interface sur les couvertures de stories.
- Les couleurs saturées ou néon, toute couleur hors palette, les ombres dures.
- Le terracotta mat, l'ocre brûlé, le sépia, le lin brut.

LIVRABLE
1) Les six propositions de photo de profil, chacune montrée à trois tailles (1024 px, 150 px, 40 px) et présentée en cercle.
2) Une simulation de la meilleure proposition en haut d'un profil Instagram réel, à taille réelle.
3) Les trois propositions de bio en texte français, avec le libellé du lien.
4) Le carrousel épinglé, 5 cartes en 1080 × 1350.
5) Les six couvertures de stories, en cercle, plus une simulation de la rangée complète telle qu'elle apparaît sur le profil.
6) Une simulation de la grille du profil avec neuf publications, pour vérifier que l'ensemble se tient visuellement.
```

---

# C. ORDRE D'EXÉCUTION

L'ordre n'est pas indicatif. Chaque étape consomme la sortie de la précédente : la sauter produit de la dérive qu'on paiera plus tard en re-générations.

| Étape | Prompt | Quoi joindre | Ne pas passer à la suite tant que… |
|---|---|---|---|
| **1** | **1 — Le personnage sans visage** | Les illustrations d'Anima existantes, si elles existent | …la planche des 6 vues est vraiment juste. **Itérez autant qu'il faut ici.** C'est l'étape qui détermine tout le reste. |
| **2** | **5 — Fonds et textures** | La sortie 1 (pour la cohérence de palette et de grain) | …les 8 fonds sont variés ET manifestement de la même famille, et que la lisibilité du texte est validée sur chacun. |
| **3** | **2 — Bibliothèque de poses** | **La vue de dos isolée du prompt 1** + la planche des 6 vues | …les 10 poses montrent la même personne, sans aucune dérive de chevelure, de robe ou de morphologie. |
| **4** | **3 — Anima et l'eau** | La référence personnage + les poses 7, 8 et 10 | …l'eau est bien le sujet et Anima bien secondaire, et qu'aucun reflet ne renvoie un visage. |
| **5** | **4 — Gabarit de carrousel** | La référence personnage + 2-3 poses + 2 fonds | …le second jeu de 6 cartes prouve que le gabarit se réutilise sans se ressembler. |
| **6** | **6 — Carte de signature** | La référence personnage (pose 10) + le gabarit | …elle est lisible avec l'interface Instagram par-dessus. |
| **7** | **7 — Profil** | La référence personnage + la carte de signature | …la photo de profil tient à 40 pixels. |

**La règle qui tient tout le pack : la référence personnage validée à l'étape 1 est jointe à TOUTES les générations suivantes.** Sans exception. Redécrire le personnage avec des mots à chaque fois est le mode d'échec numéro un — les mots dérivent, l'image jointe ne dérive pas.

**Où passer le temps.** Étape 1 : autant qu'il faut, c'est l'investissement le plus rentable du pack. Étape 5 (le gabarit) : le second poste d'effort, parce que c'est lui qui rendra la production hebdomadaire tenable. Tout le reste doit aller vite si les étapes 1 et 5 sont solides.

---

# D. GRILLE DE VALIDATION

À passer sur **chaque** sortie, avant de valider. Une seule case décochée = on refait. Ne validez jamais « pour cette fois » : ce qui est validé une fois devient la référence de tout ce qui suit, et l'erreur se propage.

### D.1 — Le visage (bloquant absolu)
- [ ] **Aucun visage visible**, sous aucun angle, sur aucune image de la sortie.
- [ ] Aucun œil, aucune bouche, aucun sourire — y compris flou, entrevu, ou à très petite taille.
- [ ] **Aucun reflet dans l'eau ne renvoie un visage.** (Le piège le plus fréquent du prompt 3 : le modèle « complète » spontanément le reflet.)
- [ ] En zoomant à 200 % sur la zone de la tête, il n'apparaît toujours aucun trait de visage.

### D.2 — Cohérence avec la référence
- [ ] La chevelure a exactement la même couleur, la même longueur et le même type d'ondulation que sur la planche de référence.
- [ ] La robe a la même coupe, le même tombé, le même voile.
- [ ] La morphologie et l'âge apparent sont identiques.
- [ ] Les pieds sont nus.
- [ ] La tige feuillue et la fleur rose poudré sont présentes et conformes.
- [ ] Le contour cuivré fin est présent, à la même épaisseur.
- [ ] **Test décisif :** posée à côté de la référence, la nouvelle image donne-t-elle l'impression que c'est la même personne, ou seulement une personne qui lui ressemble ? Si c'est le second cas, on refait.

### D.3 — Palette et style
- [ ] Aucune couleur en dehors des dix valeurs de la charte.
- [ ] Aucune saturation, aucun néon, aucune ombre dure.
- [ ] Le grain de papier aquarelle est visible.
- [ ] Rien de terracotta, d'ocre brûlé, de sépia ou de lin brut (ce serait la direction de l'app Anam).
- [ ] Rien de cartoon, de manga, de 3D rendu, de brillant, de vectoriel plat.

### D.4 — Lisibilité dans un fil
- [ ] **Le test du téléphone :** regarder l'image sur un téléphone, à bout de bras, à luminosité moyenne. Le texte est-il lisible sans effort ? Sinon, on refait.
- [ ] **Le test de la seconde :** scroller vite dans une page où l'image est mêlée à d'autres. Reconnaît-on le compte avant d'avoir lu ? Sinon, la signature visuelle est trop faible.
- [ ] Le texte ne touche aucun bord et survit à un recadrage carré centré.
- [ ] Le texte n'est jamais posé sur une zone texturée ou contrastée.
- [ ] Le bas de l'image ne porte rien d'essentiel (l'interface Instagram le recouvre partiellement).
- [ ] **La carte 2 se comprend entièrement sans la carte 1.** Testez en la lisant seule, à froid.

### D.5 — Le fond éditorial
- [ ] Rien ne ressemble à une **prédiction** : pas de pronostic, pas de « il va se passer », pas de date d'avenir, pas de verdict sur une personne.
- [ ] **Aucun symbole ésotérique criard** : ni roue du zodiaque, ni signes planétaires, ni tarot, ni boule de cristal, ni œil, ni main de Fatma, ni mandala, ni chakra, ni géométrie sacrée, ni constellation dessinée. (La pleine lune en halo est autorisée ; la poussière d'étoiles discrète l'est aussi.)
- [ ] **Le texte n'est jamais attribué à Anima** : aucune bulle, aucun phylactère, aucun texte accolé à sa tête. C'est l'eau qui parle.
- [ ] Aucun mot de verdict (« toxique », « dépendance », « narcissique », ou tout mot qui juge une personne).
- [ ] Tout est en français, en tutoiement. Aucun emoji sur l'image, aucun hashtag écrit sur l'image.
- [ ] Aucune pose aguicheuse, aucune nudité, aucun cadrage suggestif.

---

# E. LES PIÈGES DE LA GÉNÉRATION EN SÉRIE

Ce sont les échecs qui arrivent **au bout de plusieurs semaines**, pas au premier essai. Ils ne se voient pas image par image — seulement quand on aligne trois mois de production. D'où l'intérêt de les traiter dès maintenant.

### E.1 — La dérive d'identité

**Ce que c'est.** Image après image, le personnage change insensiblement : les cheveux s'allongent, la robe se complexifie, la silhouette s'amincit ou vieillit. Chaque image prise isolément semble correcte ; alignées, elles montrent cinq personnes différentes. C'est le mode d'échec numéro un.

**Pourquoi ça arrive.** Quand on génère depuis une image générée qui vient elle-même d'une image générée, chaque petit écart s'accumule. C'est une photocopie de photocopie.

**Comment on l'évite :**
- **Toujours repartir de la référence originale** du prompt 1, jamais de la dernière image produite. C'est la règle la plus importante de ce document.
- **Ne jamais chaîner** : on ne demande pas « refais celle-ci en changeant X » trois fois de suite. Au troisième aller-retour, on relance depuis la référence.
- **Le contrôle mensuel :** une fois par mois, aligner la référence et les six dernières images produites sur une même planche. Si l'une détonne, elle sort du stock et on la refait.
- **Le visage caché est déjà une grosse partie de la solution** : la dérive de visage étant le cas le plus difficile, l'avoir supprimé retire à peu près la moitié du problème. La chevelure et la robe restent à surveiller.

### E.2 — La dérive de palette

**Ce que c'est.** Les pastels se réchauffent, se saturent ou se désaturent lentement. Un post d'octobre à côté d'un post de juillet donne l'impression de deux comptes différents.

**Comment on l'évite :**
- **Recoller les dix valeurs hexadécimales dans chaque prompt, littéralement, à chaque fois.** Ne jamais écrire « la palette habituelle » ou « comme avant ».
- **Garder une bande de référence** : une image simple portant les dix aplats et leurs codes hex, à joindre en pièce jointe avec la référence personnage.
- **Le contrôle du gris :** convertir une nouvelle image en noir et blanc et la comparer à une ancienne convertie de même. Si la répartition des valeurs claires et sombres a nettement changé, la palette a dérivé même si les couleurs semblent bonnes.
- **Ne jamais appliquer de filtre ni de retouche colorimétrique après coup**, ni dans Instagram, ni ailleurs. C'est une source de dérive silencieuse et irrattrapable.

### E.3 — La dérive de style entre deux sessions

**Ce que c'est.** On reprend la production trois semaines plus tard, dans une nouvelle conversation, et le rendu change : l'aquarelle devient plus numérique, le grain disparaît, les bords de lavis deviennent nets, l'éclairage devient plus contrasté. Rien dans le prompt n'a changé — c'est le contexte de la conversation précédente qui manquait.

**Comment on l'évite :**
- **Ne jamais démarrer une session de production sans joindre au moins trois images validées** : la référence personnage, un fond, et une carte de carrousel finie.
- **Recoller le prompt intégral**, sections « À ÉVITER » comprises. C'est précisément cette section qui empêche la dérive vers l'esthétique générique. Si un résultat dérive, la cause est presque toujours qu'une ligne de cette section a été retirée pour raccourcir.
- **Constituer un dossier de référence** dans le dépôt, avec les images validées et le prompt exact qui les a produites. Le prompt qui a marché vaut autant que l'image.
- **Le contrôle de la grille :** avant de publier, poser les neuf dernières publications dans une grille 3×3 comme sur le profil. C'est là, et seulement là, que la dérive de style devient visible.

### E.4 — Les trois pièges spécifiques à ce compte

- **Le reflet qui fabrique un visage.** Dès qu'il y a de l'eau, le modèle a une forte tendance à « compléter » un reflet avec des traits de visage. À vérifier systématiquement en zoomant, sur chaque image du prompt 3.
- **Le personnage qui reprend la vedette.** Sur la série de l'eau, le modèle tend à recentrer et à agrandir Anima au fil des générations, parce que c'est le sujet le plus saillant. Or l'eau doit rester le sujet. Redonner explicitement la contrainte « elle n'occupe jamais plus d'un tiers de la hauteur » à chaque relance.
- **L'ésotérisme qui revient par la fenêtre.** À force d'images de lune et d'eau, le modèle ajoute spontanément des constellations, des croissants stylisés, de la géométrie sacrée. Ce sont ces éléments qui feraient basculer le compte dans le registre voyance — exactement le registre dont il doit se distinguer. Relire la ligne d'interdiction dans chaque prompt, à chaque fois.
