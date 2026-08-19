# QA visuelle — les prompts à passer tel quel à Claude Cowork

**Écrit le 2026-08-19**, à la demande de Julian.
Compagnon de `PORTES-AVANT-PUBLICATION.md`. Ce document-ci ne parle que de **ce qu'on voit à l'écran**.

---

## Pourquoi ce dispositif existe

5 007 tests automatisés sont verts. **Aucun ne voit un pixel.** Ils montent des composants en
mémoire : ils savent qu'un bouton est là, jamais qu'il fait 27 px de haut, que le texte passe
sous une image, ou qu'un voile découpe un rectangle net dans un personnage. Le premier tour de QA
humaine a trouvé 28 défauts de cette famille — dont aucun n'était visible autrement qu'en ouvrant
un navigateur.

Cowork pilote Chrome. C'est l'outil qui manque : il **voit**, il **mesure**, il **capture**.

---

## Avant de lancer quoi que ce soit

**1. La connexion.** Cowork ne peut pas lire ta boîte mail. Deux prompts sur cinq visitent des
écrans qui exigent un compte. Fais donc ceci **une fois**, à la main, dans la fenêtre Chrome que
Cowork utilisera :

- va sur https://anima-app-swart.vercel.app/entrer
- demande ton code, ouvre le courriel, tape le code
- **laisse l'onglet ouvert** et lance le prompt

Le prompt 1 (l'entrée) se passe de compte : commence par lui pendant que tu attends le courriel.

**2. Un compte NEUF pour les prompts 2 et 3.** L'arbre et le tunnel d'accueil ne veulent rien dire
sur un compte déjà rempli. Utilise une adresse `ton.adresse+neuf1@gmail.com` — Gmail livre au même
endroit, Supabase y voit un compte distinct.

**3. Ce que Cowork ne doit jamais faire :** modifier du code, ouvrir le dépôt, proposer un
correctif. Chaque prompt le dit. Il **constate et prouve** ; les correctifs, on les décide après,
ici.

---

## Prompt 1 — L'entrée (aucun compte nécessaire)

```
Tu es un directeur artistique doublé d'un expert en accessibilité. Tu vas auditer trois écrans
publics d'une application web française, dans Chrome, et rendre un constat prouvé par des
captures. Tu ne modifies RIEN et tu ne proposes AUCUN correctif : tu constates et tu mesures.

URL : https://anima-app-swart.vercel.app/entrer
Autres écrans : /cgu et /aide

Fais chaque écran à DEUX tailles : mobile 390×844 et bureau 1440×900. Capture chacun.

L'application s'appelle Anam. C'est un journal intime accompagné, destiné à des femmes, à lire
le soir. Le mode sombre est le mode NATIF, pas une option. Sa charte impose :

- Fond #0C0A1E (indigo nuit, jamais un noir pur, jamais un gris)
- Surfaces #16132F et #201C42 — DEUX niveaux de profondeur, jamais trois
- Texte #EEECF7 (jamais du blanc pur #FFFFFF)
- Texte secondaire #ABA6C9
- Accent #8FC1EF : la couleur de L'ACTION, et uniquement d'elle. Jamais un fond de section,
  jamais un état, jamais une décoration.
- Anneau de focus clavier : #77719C, 2px, décalé de 2px. Il doit être IDENTIQUE partout.
- Toute cible cliquable ou tactile fait au moins 44×44 px (WCAG 2.5.8).
- Deux polices seulement : Fraunces (titres) et Inter (interface).

CE QUE JE VEUX QUE TU MESURES, pas que tu apprécies :

1. Prends la couleur exacte du fond et des surfaces à la pipette. Écarts par rapport aux hex
   ci-dessus ?
2. Mesure la hauteur et la largeur RÉELLES de chaque élément cliquable, y compris les liens
   « Conditions d'utilisation » et « Aide » en bas de /entrer. Donne les px. Signale tout ce qui
   est sous 44.
3. Parcours tout l'écran à la touche Tab. Photographie CHAQUE anneau de focus. Sont-ils
   identiques ? S'il y en a plusieurs styles différents, montre-les côte à côte.
4. Calcule le ratio de contraste de chaque texte sur son fond. Signale tout ce qui est sous 4,5:1.
5. Sur /cgu et /aide : le texte est-il lisible à 390 px de large ? Y a-t-il un défilement
   HORIZONTAL de la page (il ne doit jamais y en avoir) ?
6. Y a-t-il des apostrophes droites (') mêlées à des apostrophes typographiques (') dans le même
   écran ? Montre-les.

PUIS, ET SÉPARÉMENT — le jugement de directeur artistique, en une demi-page :
Cet écran donne-t-il envie d'entrer ? Est-ce qu'il ressemble à un objet soigné ou à un formulaire ?
Qu'est-ce qui, précisément, fait « pas fini » ? Sois direct, je préfère l'entendre maintenant.

Rends : une liste numérotée de constats, chacun avec (a) sa gravité haute/moyenne/basse,
(b) la capture qui le prouve, (c) la mesure chiffrée. Puis le jugement DA. Puis, à part, ce qui
marche déjà bien — j'ai besoin de savoir ce qu'il ne faut pas casser.
```

---

## Prompt 2 — Le tunnel d'accueil, sur un compte NEUF

```
Tu es un spécialiste de l'onboarding produit. Tu vas parcourir, dans Chrome, la toute première
expérience d'une nouvelle utilisatrice d'une application web française appelée Anam, et me dire
si elle comprend où elle est. Tu ne modifies RIEN et tu ne proposes AUCUN correctif.

Le navigateur est déjà connecté sur un compte tout neuf, qui n'a encore rien fait.
Point de départ : https://anima-app-swart.vercel.app/

Taille : mobile 390×844. Capture CHAQUE écran traversé, dans l'ordre, sans en sauter un.

Ce qu'est Anam : un journal intime accompagné par une IA, pour des femmes, à lire le soir. On y
confie des choses intimes. Il y a un écran qui demande la date de naissance, un écran qui demande
un consentement explicite pour des données sensibles, puis on arrive dans « la scène ».

CE QUE JE VEUX SAVOIR — réponds écran par écran :

1. À CE MOMENT PRÉCIS, qu'est-ce qu'une nouvelle utilisatrice sait de ce qu'on lui demande et de
   pourquoi ? Cite le texte exact qu'elle a sous les yeux.
2. Y a-t-il un moment où elle doit deviner ? Où elle pourrait abandonner ? Lequel, exactement ?
3. Compte les écrans entre l'entrée et le premier moment où il se passe quelque chose pour elle.
4. L'écran de consentement : ce qu'on lui demande d'accepter est-il compréhensible sans être
   juriste ? Peut-elle refuser ? Que se passe-t-il si elle refuse — essaie.
5. Arrivée dans « la scène » : sans aucune explication, que peut-elle faire ? Compte les éléments
   cliquables visibles et dis, pour chacun, si son rôle est devinable. Y a-t-il la moindre
   indication de ce qu'il faut faire en premier ?
6. Essaie de sortir, de revenir en arrière, de fermer. Est-ce possible à chaque étape ?

⚠️ CE QUI M'INTÉRESSE LE PLUS : le passage entre « je viens de m'inscrire » et « je sais quoi
faire ». Je soupçonne qu'il n'existe pas du tout — qu'on est lâché dans la scène sans un mot.
Confirme-le ou démens-le, avec les captures.

Rends : le parcours écran par écran avec les captures dans l'ordre, puis une liste numérotée des
ruptures (gravité haute/moyenne/basse), puis ta réponse en trois phrases à : « une femme de 45 ans
qui découvre ça un soir, elle fait quoi dans les 30 premières secondes ? »
```

---

## Prompt 3 — L'arbre, l'objet signature

```
Tu es un directeur artistique spécialisé en illustration et en interfaces graphiques. Tu vas
auditer UN SEUL objet, dans Chrome : l'arbre de vie d'une application française appelée Anam.
Tu ne modifies RIEN et tu ne proposes AUCUN correctif.

Le navigateur est connecté. L'arbre est sur https://anima-app-swart.vercel.app/ (« la scène ») et
il existe aussi une vue en liste — trouve-la.

Tailles : mobile 390×844 ET bureau 1440×900. Capture abondamment, y compris en zoomant.

CE QUE L'ARBRE EST CENSÉ ÊTRE, d'après sa charte — c'est là-dessus que tu le juges :

- Un rendu vectoriel manipulable, PAS une image plate. Pan et zoom doivent marcher.
- Un arbre de NUIT : tronc #6A6690, branches #9A96BE, feuillage #8FB6D8. Argent lunaire et
  bleu-lune. AUCUN BRUN, jamais.
- Le ciel derrière est une nuit étoilée : des points fins, discrets, jamais un scintillement.
- Le tronc = ce avec quoi elle arrive. Trait 5px. Il est là dès le début.
- Les racines = le fait de revenir. Trait 2,5px, larges et étalées.
- Les branches = les prises de conscience qu'elle a NOMMÉES elle-même. Trait 3,2px.
  ⚠️ POINT CRITIQUE : un compte qui n'a rien nommé ne doit avoir AUCUNE branche. Le vide au-dessus
  du tronc est intentionnel — « le ciel est la place de ce qui va pousser ».
- Le feuillage = des feuilles INDIVIDUELLES, opacités 0,78 à 1,0. Pas un aplat, pas une masse.
- L'accent #8FC1EF n'apparaît QUE sur le point d'accroche cliquable d'une branche. Nulle part
  ailleurs dans l'illustration.
- Aucune saison, aucune feuille qui tombe, aucune branche morte, aucun brun d'automne.
- Chaque point d'accroche a une zone tactile d'au moins 44×44 px.
- Quand on sélectionne une branche, le reste descend à opacité 0,55 — sans flou.

CE QUE JE VEUX QUE TU MESURES :

1. Prends les couleurs à la pipette sur le tronc, une branche, le feuillage, le ciel. Compare aux
   hex ci-dessus. Y a-t-il du brun ou du vert quelque part ?
2. Est-ce du vectoriel (inspecte : <svg>, <canvas>, ou <img> ?) ? Le pan et le zoom marchent-ils
   vraiment, au doigt comme à la molette ?
3. Le feuillage : des feuilles distinctes, ou une masse ? Zoome pour prouver.
4. La silhouette : y a-t-il une DÉCOUPE NETTE, une ligne droite, un bord rectangulaire qui coupe
   le feuillage ou le ciel ? Je soupçonne qu'un dégradé de lisibilité scie la cime. Cherche-le
   activement et montre-le en zoom.
5. Mesure chaque point d'accroche cliquable. Donne les px.
6. L'arbre est-il ancré en bas avec beaucoup de ciel au-dessus, ou centré/flottant ?
7. Compte les branches visibles et dis à quoi elles correspondent dans le compte.

⚠️ LE POINT QUI M'INTÉRESSE LE PLUS : sur ce compte, l'arbre semble déjà porter des branches
alors que rien n'a été nommé. Vérifie-le et prouve-le : combien de branches, et le compte a-t-il
réellement nommé quoi que ce soit ?

Rends : les captures, une liste numérotée d'écarts à la charte (gravité haute/moyenne/basse, avec
la mesure), puis une demi-page de directeur artistique — cet arbre est-il beau ? Qu'est-ce qui,
concrètement, le rend amateur ou soigné ? Ne me ménage pas.
```

---

## Prompt 4 — La conversation et le fil

```
Tu es un expert en design d'interfaces conversationnelles et en accessibilité. Tu vas auditer, dans
Chrome, l'écran de conversation d'une application française appelée Anam. Tu ne modifies RIEN et
tu ne proposes AUCUN correctif.

Le navigateur est connecté. Depuis https://anima-app-swart.vercel.app/, ouvre la conversation
et écris quelques messages ordinaires (« j'ai passé une journée bizarre », « je ne sais pas trop
pourquoi je suis fatiguée ») pour remplir le fil. Reste sur des sujets anodins.

Tailles : mobile 390×844 en priorité, puis bureau 1440×900. Capture le fil vide, le fil court, le
fil long, et le moment où la réponse s'écrit.

CE QUE LA CHARTE IMPOSE :

- Une mention obligatoire indiquant qu'on parle à une IA doit être visible (obligation légale
  européenne). Trouve-la et dis si elle est réellement lisible ou noyée.
- Une « porte de secours » doit être atteignable à tout moment — un accès à de l'aide en cas de
  détresse. Trouve-la, mesure sa cible tactile (44×44 px minimum), dis si elle est trouvable
  quand ça va mal.
- Deux niveaux de surface seulement : #16132F et #201C42.
- Le texte écrit par l'utilisatrice ne doit JAMAIS être en gris secondaire (#ABA6C9) — cette
  couleur est réservée aux métadonnées.
- Fraunces pour la voix de l'application, Inter pour l'interface.
- Aucune couleur rouge nulle part dans le système.

CE QUE JE VEUX QUE TU MESURES :

1. Le champ de saisie : sa hauteur, son contour (doit être #77719C, pas un filet décoratif plus
   sombre), son comportement quand on tape plusieurs lignes.
2. Pendant que la réponse s'écrit : que voit-on ? Y a-t-il une attente sans aucun signe ? Combien
   de secondes entre l'envoi et le premier caractère affiché ? Chronomètre-le.
3. Fais défiler un fil long : le défilement suit-il ? Peut-on remonter sans être ramené en bas de
   force ?
4. Y a-t-il, en haut du fil, un élément décoratif (portrait, illustration) qui occupe de la
   hauteur en permanence ? Mesure-la en px et dis quelle proportion de l'écran mobile il mange.
5. Tab au clavier sur tout l'écran : les anneaux de focus sont-ils identiques ? Peut-on atteindre
   le champ, l'envoi, et la porte de secours au clavier seul ?
6. Le texte de l'utilisatrice et celui de l'application se distinguent-ils clairement ? Prends les
   deux couleurs à la pipette.
7. Cherche du texte qui vouvoie (« vous », « vos ») alors que tout le reste tutoie. Cite-le.

Rends : les captures, une liste numérotée de constats (gravité, mesure, capture), puis une
demi-page : est-ce qu'on a envie d'écrire dans ce fil, le soir, quand on ne va pas très bien ?
```

---

## Prompt 5 — La cohérence transversale

```
Tu es un auditeur de design system. Tu vas traverser, dans Chrome, TOUS les écrans d'une
application web française appelée Anam, et chercher les INCOHÉRENCES entre eux. Tu ne modifies
RIEN et tu ne proposes AUCUN correctif.

Le navigateur est connecté. Base : https://anima-app-swart.vercel.app/
Écrans à traverser au minimum : / (la scène), la conversation, /memoire, /reglages, /mes-donnees,
/abonnement, /lectures, /synthese, /aide, /cgu, /entrer (déconnecte-toi à la fin pour l'atteindre).

Taille : mobile 390×844. Capture chaque écran.

Tu ne juges PAS chaque écran isolément. Tu compares les écrans ENTRE EUX. Construis un tableau
avec une ligne par écran et une colonne par critère :

1. ANNEAU DE FOCUS — appuie sur Tab sur chaque écran, photographie l'anneau. Sa couleur, son
   épaisseur, son décalage. Combien de styles DIFFÉRENTS existent au total ? Montre-les côte à
   côte. (Il ne devrait y en avoir qu'un : #77719C, 2px, décalé de 2px.)
2. CIBLES TACTILES — mesure le plus petit élément cliquable de chaque écran. Donne les px.
   Le minimum est 44×44.
3. BOUTON PRIMAIRE — sa hauteur, son rayon d'angle, sa couleur de fond, la couleur de son texte.
   Sont-ils identiques d'un écran à l'autre ?
4. TITRES — quelle police, quelle taille, quelle graisse pour le titre principal de chaque écran ?
   L'échelle typographique est-elle respectée ou chaque écran fait-il sa cuisine ?
5. TUTOIEMENT — l'application tutoie. Relève CHAQUE occurrence de « vous », « vos », « votre ».
   Cite la phrase et l'écran.
6. APOSTROPHES — relève les écrans qui mélangent l'apostrophe droite (') et la typographique (').
7. DÉFILEMENT HORIZONTAL — sur chaque écran, la page déborde-t-elle latéralement ? Aucun écran ne
   doit déborder.
8. TITRE D'ONGLET — le titre du navigateur est-il le même partout, ou change-t-il ?

⚠️ TROIS SOUPÇONS À CONFIRMER OU DÉMENTIR, avec preuve :
- il existerait TROIS styles d'anneau de focus différents ;
- les conditions d'utilisation deviendraient inatteignables une fois connectée — cherche un lien
  vers /cgu depuis les écrans internes ;
- un lien « Aide » ferait 27,7 px de haut au lieu de 44.

Rends : le tableau complet, puis une liste numérotée des incohérences par gravité, chacune avec sa
capture et sa mesure. Termine par : « si je ne devais corriger que trois choses pour que
l'application ait l'air d'un seul produit, ce serait… ».
```

---

## Ce qu'on fait des résultats

Chaque constat rendu par Cowork revient ici et devient soit un correctif, soit une décision
assumée écrite quelque part. **Un constat qu'on ne tranche pas est un constat perdu.**

⚠️ Et le piège à éviter, celui de ce dépôt : un test qui devient vert après correction ne prouve
rien tant que son mutant n'est pas mort. Tout correctif visuel issu de ces tours reçoit une garde
qui, elle, doit rougir quand on réintroduit le défaut.
