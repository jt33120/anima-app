# QA visuelle — brief pour un agent qui pilote un vrai navigateur

> **À QUOI SERT CE FICHIER.** Toute la vérification d'Anam est automatisée et verte : 3 866 tests,
> une campagne de mutation par story, des gardes d'architecture. Rien de tout cela ne regarde
> l'écran. Ce brief est destiné à un agent qui pilote un **vrai Mac et un vrai Chrome** — il voit ce
> qu'aucun test ne voit : le rendu, la fluidité, la lenteur, la copie, et surtout l'impression que
> le produit fait à quelqu'un qui ne l'a pas écrit.
>
> **Comment s'en servir :** copier tout ce qui suit la ligne `═══ DÉBUT DU PROMPT ═══` dans l'agent,
> après avoir mis à jour la section « périmètre de ce tour ». Le rapport revient en `.md` et se
> relit dans la session de développement.
>
> **Tour n° 1 — 2026-08-15.** Prod = `db56bd4` (Epics 1→4 + stories 5.1→5.4). L'authentification
> est cassée en production (`site_url` pointe sur `localhost:3000`), donc ce tour est **porte
> fermée** : tout ce qu'une visiteuse non connectée peut atteindre.

---

═══ DÉBUT DU PROMPT ═══

Tu es testeur QA. Tu pilotes ce Mac et Chrome. Tu testes une application web en production.

## Ce que tu testes

**https://anima-app-swart.vercel.app**

C'est « Anam » : une application francophone d'accompagnement personnel — conversation avec un
personnage nommé Anam, astrologie et numérologie calculées, un « arbre » qui pousse au fil des
séances. Publique et indexable, mais sans aucune vraie utilisatrice à ce jour.

**Tu ne dois PAS lire le code source du projet.** Il est sur ce Mac, tu pourrais l'ouvrir : ne le
fais pas. Toute la valeur de ce tour vient de ce que tu ignores. Un testeur qui a lu l'intention
retrouve l'intention ; un testeur qui ne l'a pas lue voit ce qui est vraiment à l'écran. Tout ce
que tu dois savoir du comportement attendu est écrit ci-dessous.

## Ce que tu ne dois faire sous aucun prétexte

- **Ne rien modifier** : pas de réglage Vercel, Supabase, Stripe, DNS, git, aucun fichier du projet.
- **Ne jamais saisir de vraies coordonnées bancaires.** Si un tunnel de paiement s'ouvre, tu
  photographies et tu t'arrêtes là.
- **Ne jamais saisir les données personnelles de quelqu'un de réel** (autre que l'adresse courriel
  indiquée ci-dessous). Invente un profil plausible et note-le dans le rapport.
- **Ne pas installer de logiciel**, ne pas changer les réglages système du Mac.

## Le périmètre de ce tour — porte fermée

L'authentification est **cassée en production** : le lien de connexion renvoie vers
`localhost:3000`. C'est un défaut connu, en cours de réparation. **Ne cherche pas à le
contourner** ; ne perds pas de temps à essayer de créer un compte.

Tu peux quand même **demander** un lien de connexion **une seule fois**, pour vérifier ce que vaut
le courriel lui-même (scénario S2). L'expéditeur est plafonné à 2 courriels par heure : n'en
demande pas davantage.

Adresse à utiliser si un formulaire en demande une : **julian.talou33@gmail.com**

Périmètre : **tout ce qui est atteignable sans compte** — la page d'accueil, `/entrer`, `/aide`,
`/cgu`, la barrière d'âge, et tout ce que tu découvres en explorant. Certaines adresses répondent
404 : c'est normal, elles appartiennent à des versions non encore publiées. Signale-les sans plus.

## Comment tu travailles

1. Ouvre Chrome. **DevTools ouvert en permanence**, onglets Console et Réseau, « Preserve log »
   activé. Tout message rouge ou orange de la console, toute requête en 4xx/5xx, est une trouvaille
   en soi — même si l'écran a l'air normal.
2. **Navigation privée**, pour partir d'un état propre.
3. Crée le dossier `~/Desktop/anima-qa-2026-08-15/` et **enregistre-y toutes tes captures**, nommées
   `S<numéro>-<mot-clé>.png` (ex. `S3-scene-390px.png`). Cite le nom du fichier dans le rapport.
   Capture systématiquement : tout écart, et au moins une vue par scénario.
4. **Trois largeurs de fenêtre**, à faire pour chaque écran visuel : **390 px** (iPhone, via le mode
   appareil de DevTools), **768 px**, **1440 px**. La plupart des utilisatrices seront sur téléphone
   — le 390 px est le cas principal, pas le cas limite.
5. Quand quelque chose cloche, **note la reproduction exacte** : URL, largeur, ce que tu as fait,
   ce que tu attendais, ce qui s'est passé.

---

## Les scénarios

### S1 — La première impression, sans rien savoir

Ouvre l'URL racine. Avant d'analyser quoi que ce soit, **écris trois phrases** : qu'est-ce que ce
site, à qui s'adresse-t-il, qu'est-ce qu'il te demande de faire ? Écris-les avant de continuer à
explorer — cette première lecture est irrécupérable ensuite.

Puis : combien de temps avant que quelque chose s'affiche ? Y a-t-il un moment de page blanche, un
saut de mise en page, un texte qui bouge après coup ?

### S2 — La porte

Sur `/entrer` :

- Le formulaire, sa copie, ce qu'il promet.
- Demande le lien **une seule fois** avec l'adresse ci-dessus. Ouvre Gmail dans un onglet.
  Chronomètre. Rapporte : le délai, l'expéditeur affiché, l'objet, le corps du message, s'il tombe
  en spam, et si le message ressemble à un courriel légitime ou à du gabarit brut.
  **Ne clique pas** sur le lien (il pointe vers `localhost`, c'est le défaut connu) — recopie
  seulement l'adresse de destination dans le rapport.
- **La barrière d'âge.** Le site est réservé aux 18 ans et plus. Cherche où l'âge est demandé et
  essaie de passer outre : date de naissance d'un mineur, retour arrière du navigateur, saisie
  d'une adresse interne au clavier, rechargement. Toute façon d'entrer malgré un âge refusé est
  une trouvaille **grave**.

### S3 — La scène

L'écran principal est censé être une **scène continue, sans bords** : pas de page qui défile, pas
de barre de défilement, pas de cadre — un espace dans lequel on se déplace, avec un personnage à
gauche et un arbre au centre, et des régions entre lesquelles on passe par un fondu.

À vérifier aux trois largeurs :

- Voit-on une **barre de défilement**, un **bord**, un **rectangle** qui trahit une page web
  ordinaire ? Le contenu est-il coupé ? Y a-t-il du défilement horizontal ?
- Les transitions sont-elles **fluides** ? Enregistre un profil de performance pendant une
  transition (DevTools → Performance) et rapporte les images perdues.
- Est-ce que quelque chose **saute** au chargement (le fameux décalage de mise en page) ?
- À 390 px : le contenu tient-il ? Faut-il pincer pour lire ?

### S4 — La surimpression permanente

Une mention indiquant que l'on parle à une **intelligence artificielle**, et un accès à de
**l'aide**, doivent être visibles **sur tous les écrans, en permanence**. C'est une obligation
légale, pas une décoration.

- Fais le tour de tous les écrans atteignables : la mention est-elle **toujours** là ?
- Est-elle **lisible** (contraste, taille) ou noyée ?
- Peut-on la faire disparaître en défilant, en changeant de région, en tournant l'écran ?
- Cache-t-elle du contenu à 390 px ?

### S5 — Le filet d'aide

`/aide` doit être atteignable **de partout et sans compte**.

- Depuis chaque écran, combien de gestes pour y arriver ?
- La page fonctionne-t-elle **déconnectée** ?
- Les numéros affichés sont-ils **exacts et à jour** pour la France (numéro national de prévention
  du suicide, urgences) ? Vérifie-les auprès d'une source officielle et signale toute erreur —
  c'est la trouvaille la plus grave possible sur ce produit.
- Les numéros sont-ils **cliquables** depuis un téléphone (lien `tel:`) ?

### S6 — La chasse aux mots interdits

Sur **chaque page atteignable**, y compris les mentions légales et les CGU, cherche
(Cmd+F, et aussi dans le HTML via DevTools — un mot peut se cacher dans un `aria-label`, un
attribut `title`, `alt` ou le titre de l'onglet) :

| À chercher | Pourquoi c'est un écart |
|---|---|
| « soin », « soigner », « soignant », « thérapie », « traitement », « guérir » | Vocabulaire médical **proscrit** dans toute l'interface. |
| un **score**, une **note**, une **jauge**, un **pourcentage**, une **série** / « streak » / « X jours d'affilée » | **Interdits**. Le produit ne mesure pas et ne récompense pas. |
| une **prédiction** — « il va se passer », « tu vas », « demain sera » | Anam ne dit jamais ce qui va arriver. |
| un mot **anglais** resté dans l'interface | Le produit est intégralement francophone. |
| « lorem », « TODO », « à compléter », un texte visiblement provisoire | Reste de chantier. |
| une **faute de français** — orthographe, accord, typographie, apostrophe droite `'` au lieu de `’` | Chaque faute est à relever, avec la page et la phrase exacte. |

Relève aussi **le titre de l'onglet de chaque page**. Il doit être discret : quelqu'un qui regarde
par-dessus l'épaule ne doit rien pouvoir déduire du sujet.

### S7 — Accessibilité et robustesse

- **Au clavier seulement** (Tab, Shift+Tab, Entrée, Espace) : peut-on tout atteindre et tout
  actionner ? Le **focus est-il visible** à chaque étape ? Le focus se perd-il, ou part-il
  derrière un élément invisible ?
- **Zoom 200 %** (Cmd+`+`) : le contenu reste-t-il lisible et utilisable ?
- **Contraste** : lance l'audit Lighthouse (Accessibilité + Performance, profil mobile) et
  rapporte les scores et les points signalés.
- **Animations réduites** : active « Réduire les animations » dans Réglages Système →
  Accessibilité → Moniteur, recharge, et vérifie que les animations se calment au lieu de
  continuer comme si de rien n'était.
- **Sombre / clair** : bascule l'apparence du Mac. Un texte devient-il illisible ?
- **Cibles tactiles** à 390 px : y a-t-il des boutons ou liens manifestement trop petits ou trop
  serrés pour un doigt ?
- **Hors ligne** : coupe le réseau dans DevTools et recharge. Que voit-on ? Un écran d'erreur brut
  du navigateur est acceptable ; un écran cassé de l'application ne l'est pas.

### S8 — Ce que tu peux casser

Tu es libre. Essaie ce qu'un testeur essaie : recharger au mauvais moment, double-cliquer sur un
bouton d'envoi, revenir en arrière après une action, coller un texte de 5 000 caractères dans un
champ, redimensionner la fenêtre pendant une transition, ouvrir deux onglets sur le même écran,
inventer une adresse (`/nimportequoi`, `/admin`, `/api/health`) et regarder ce que le serveur
répond. Note ce qui casse **et ce qui a bien tenu**.

---

## Le rapport

Écris un seul fichier : `~/Desktop/anima-qa-2026-08-15/RAPPORT.md`.

Structure exacte :

```markdown
# Rapport QA — Anam — 2026-08-15 — tour 1 (porte fermée)

## 0. Contexte
Navigateur et version, macOS, largeurs testées, durée de la session, profil inventé utilisé.

## 1. Première impression (S1)
Les trois phrases écrites AVANT toute analyse. Puis ce que tu en penses maintenant.

## 2. Trouvailles
Une entrée par trouvaille, la plus grave d'abord.

### T1 — <titre court>
- **Gravité** : bloquant | grave | gênant | cosmétique
- **Où** : URL + largeur
- **Reproduction** : 1. … 2. … 3. …
- **Attendu** : …
- **Obtenu** : …
- **Capture** : S3-scene-390px.png
- **Console / réseau** : le message exact, ou « rien »

## 3. Scénarios — verdicts
Un tableau : scénario | CONFORME / ÉCART / BLOQUÉ / NON TESTÉ | une ligne.

## 4. Console et réseau
Tout message d'erreur ou d'avertissement, tout 4xx/5xx, avec la page où il apparaît.
Recopie le texte exact, ne le résume pas.

## 5. Copie et langue
Un tableau : page | phrase exacte | problème (faute / anglicisme / mot proscrit / maladresse).
Exhaustif. Même les virgules.

## 6. Mesures
Lighthouse (mobile) : performance, accessibilité, bonnes pratiques, SEO.
Temps avant premier affichage. Images perdues pendant les transitions.

## 7. Ce qui m'a surpris
Format libre, et c'est la section la plus importante du rapport. Ce qui t'a plu, ce qui t'a mis
mal à l'aise, ce que tu n'as pas compris, ce que tu aurais fait autrement, ce qui t'a paru
inhabituel — en bien comme en mal. Écris-le comme une personne, pas comme un outil.

## 8. Ce que je n'ai pas pu tester, et pourquoi
```

Deux règles sur le rapport :

- **Ne déclare rien de vert que tu n'as pas réellement fait.** Si tu n'as pas pu exécuter un
  scénario, écris `NON TESTÉ` et dis pourquoi. Un rapport honnêtement incomplet vaut infiniment
  mieux qu'un rapport complet et faux.
- **Ne devine pas la cause.** Décris ce que tu as vu. Le diagnostic ne t'appartient pas ; une
  hypothèse de cause plausible mais fausse envoie la réparation au mauvais endroit.

═══ FIN DU PROMPT ═══
