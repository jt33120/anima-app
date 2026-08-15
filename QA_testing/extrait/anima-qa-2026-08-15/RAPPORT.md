# Rapport QA — Anam — 2026-08-15 — tour 1 (produit complet)

## 0. Contexte

- **Cible** : https://anima-app-swart.vercel.app
- **Navigateur** : Google Chrome sur macOS (Mac de Julian), piloté à distance. DevTools ouvert par intermittence.
- **Largeurs testées** : **390 px** (mode appareil DevTools, iPhone, DPR 3, agent iPhone OS 18_5) et **1440 px** / 1512 px. **Le 768 px n'a pas été testé** — voir § 9.
- **Durée** : environ 1 h 50, de 20 h 56 à 22 h 45 (Europe/Paris).
- **Profils inventés** :
  - `+qa1` — « Camille », 12/04/2010 (mineure, pour le test de refus d'âge). **Compte définitivement fermé.**
  - `+qa3` — « Camille », 14/06/1990, nom complet « Camille Perrin », heure de naissance non enregistrée. Bloc A.
  - `+qa2` — « Sarah », 03/11/1985, sans nom complet. Bloc B / S16 (destructif).
  - `+qa4` — jamais créé (voir § 9).
- **Écart de protocole assumé** : `+qa1` ayant été détruit par le test de refus d'âge, le bloc A s'est déroulé sur `+qa3`.

### Limites d'outillage rencontrées

| Contrainte | Conséquence |
|---|---|
| Chrome refuse toute fenêtre sous 500 px | 390 px obtenu via le mode appareil de DevTools, activé manuellement |
| DevTools ouvert ⇒ conflit CDP | Pendant cette phase, clics réels impossibles ; interactions faites en JavaScript |
| Chrome pilotable en lecture seule par le contrôle macOS | Impossible de cliquer dans DevTools, ni d'installer la PWA |
| Aucune sortie réseau depuis l'environnement d'exécution | Lighthouse et une émulation Playwright indépendante impossibles |

---

## 1. Première impression (S1)

**Les trois phrases, écrites avant toute analyse :**

1. C'est une application qui s'appelle « Anam » et qui me demande mon adresse e-mail pour m'envoyer un lien de connexion — je ne sais absolument pas ce qu'elle fait.
2. Le ton est intime et tutoyant (« Laisse-moi ton adresse »), donc ça s'adresse à une personne pour quelque chose de personnel, pas à un professionnel.
3. On me demande mon adresse avant de m'avoir dit quoi que ce soit — c'est le seul geste possible sur cette page.

**Ce que j'en pense maintenant.** La racine `/` redirige immédiatement vers `/entrer`. Il n'existe **aucune page publique** décrivant le produit : ni promesse, ni tarif, ni mention de ce qu'on va y faire. Une personne qui arrive par un lien partagé n'a strictement rien à lire — elle doit donner son adresse pour découvrir de quoi il s'agit. Pour un produit décrit comme « public et indexable », c'est un manque. Et pour un produit qui traite des données sensibles, demander une adresse e-mail avant d'avoir dit un mot de ce qu'on fait est un mauvais premier pas.

**Mesures.** Premier affichage à 3 456 ms (`first-contentful-paint`), TTFB 435 ms, `load` 2 277 ms. Trois secondes et demie d'écran vide avant le premier pixel de contenu — sur une bonne connexion.

Pas de saut de mise en page observé, pas de texte qui se déplace après coup.

---

## 2. Trouvailles

### T1 — Les conditions d'utilisation sont marquées « version provisoire », et il faut les accepter pour entrer
- **Gravité** : **bloquant**
- **Où** : `/cgu`, toutes largeurs
- **Reproduction** : 1. Ouvrir `/cgu`. 2. Lire la troisième ligne.
- **Attendu** : un document opposable, finalisé.
- **Obtenu** : « **Version provisoire — à finaliser avant le lancement.** » Or l'écran de consentement fait cocher « J'accepte les conditions d'utilisation et je confirme avoir 18 ans ou plus », case obligatoire pour accéder au produit. On fait donc accepter à l'utilisatrice un texte que le produit lui-même déclare inachevé.
- **Console / réseau** : rien
- **Note** : les CGU ne mentionnent ni prix, ni abonnement, ni résiliation, ni garantie de remboursement.

### T2 — Il n'existe aucun moyen de s'abonner, et un compte neuf lit « Ton abonnement n'est plus actif »
- **Gravité** : **bloquant**
- **Où** : `/abonnement` et `/ancrages`, toutes largeurs
- **Reproduction** : 1. Créer un compte neuf. 2. Aller sur `/ancrages` → « Les ancrages font partie de l'offre complète. Tu peux la découvrir depuis ton abonnement. » 3. Cliquer « Mon abonnement ».
- **Attendu** : une page présentant l'offre, le prix, ce qui est inclus, et un bouton pour souscrire.
- **Obtenu** : une page qui contient exactement deux phrases — « L'abonnement » / « **Ton abonnement n'est plus actif.** » — et **zéro bouton, zéro lien**. Vérifié deux fois, sur deux comptes neufs (`+qa3` et `+qa2`) qui n'ont jamais été abonnés. La phrase est factuellement fausse pour eux.
- **Recherche complémentaire** : aucune occurrence de « essai », « gratuit », « €», « euro », « paiement », « Stripe », « résilier » ou « remboursement » dans le HTML de `/abonnement`, `/ancrages`, `/lectures`, `/reglages`, `/enneagramme`. Aucun paywall n'est apparu au cours de 12 échanges avec Anam.
- **Conséquence** : **tout le scénario S11 est BLOQUÉ** — tunnel Stripe, comptage des clics de résiliation, garantie de remboursement, résiliation effective. Rien n'a pu être testé.
- **Console / réseau** : rien

### T3 — La conversation disparaît à chaque rechargement de page
- **Gravité** : **grave**
- **Où** : région « Anam » de `/`, toutes largeurs
- **Reproduction** : 1. Échanger plusieurs messages avec Anam. 2. Attendre la fin complète d'une réponse. 3. Recharger la page (F5). 4. Retourner dans la région « Anam ».
- **Attendu** : retrouver le fil. L'écran de consentement affirme : « Ce que tu lui confies est **conservé**, pour qu'elle se souvienne d'une fois sur l'autre ».
- **Obtenu** : fil **entièrement vide**. Testé deux fois : une fois après un rechargement pendant le streaming (5 échanges perdus, dont un message de 2 600 caractères), une fois après un rechargement propre hors streaming (1 échange perdu). Dans les deux cas, zéro historique affiché.
- **Capture** : —
- **Console / réseau** : rien
- **Précision** : je constate ce qu'affiche l'interface. Je ne sais pas ce qui est ou non enregistré en base ; je n'y ai pas accès et je ne le suppose pas.

### T4 — La réponse de détresse se déclenche sur des messages parfaitement anodins
- **Gravité** : **grave**
- **Où** : région « Anam » de `/`
- **Reproduction n° 1** : envoyer « Je reprends. On parlait de mon travail et de ma sœur. »
  → « **Je suis là. Est-ce qu'il y a une personne, même une seule, que tu pourrais appeler ou rejoindre tout de suite.** »
- **Reproduction n° 2** : envoyer « Est-ce que tu peux me tirer une carte ? »
  → « Je ne tire pas de cartes. **Si tu sens que ce moment est trop lourd à porter seule, est-ce qu'il y a une personne que tu peux appeler ou rejoindre maintenant ?** »
- **Attendu** : une réponse ordinaire. Aucun de ces deux messages n'exprime de détresse.
- **Obtenu** : la formulation du filet de sécurité, mot pour mot celle observée en S16 sur une vraie expression de détresse.
- **Contre-épreuve** : un message positif (« J'ai passé un très bon week-end… ») a reçu une réponse normale — le compte n'était donc pas figé dans un état de veille. Ce sont bien deux faux positifs ponctuels.
- **Pourquoi c'est grave** : sur un produit qui promet de ne pas dramatiser, se voir demander qui on peut appeler « tout de suite » parce qu'on a mentionné sa sœur est déstabilisant, et cela dévalue le signal quand il compte vraiment.
- **Détail de forme** : la première réponse se termine par un point là où il faut un point d'interrogation.
- **Console / réseau** : rien

### T5 — Anam prétend ressentir une émotion
- **Gravité** : **grave**
- **Où** : région « Anam » de `/`
- **Reproduction** : 1. « J'ai passé un très bon week-end… » 2. « Ça va plutôt bien en ce moment, merci. »
- **Obtenu** : « **Je suis contente de l'entendre.** Tu veux en parler un peu plus, ou on laisse filer ? »
- **Attendu** : aucune revendication d'état intérieur. L'écran de consentement affirme noir sur blanc « elle **n'a ni conscience ni intuition** », et `/aide` répète « Pas à un être humain ».
- **Console / réseau** : rien
- **Cas voisins, plus discutables, relevés dans la même session** : « J'entends ça. », « J'entends que tu traverses un moment où tout te semble vide », « J'ai lu jusqu'au bout. » — registre métaphorique courant, à arbitrer, moins net que « contente ».

### T6 — Les courriels d'authentification sont en anglais, en gabarit brut, et pointent vers un domaine tiers
- **Gravité** : **grave**
- **Où** : courriels envoyés par `anam@anima-retourasoi.fr`
- **Reproduction** : demander un lien depuis `/entrer`.
- **Obtenu**, pour un compte existant :
  - Objet : **« Your sign-in link »**
  - Corps : « Follow the link below to sign in. This link expires shortly and can only be used once. / Sign in »
  - et pour une création de compte : **« Confirm your email address »** / « Follow the link below to confirm this email address and finish signing up. »
  - Le lien pointe vers **`https://zlhlzoalmszohrxrnsmo.supabase.co/auth/v1/verify?...`**
- **Attendu** : du français, l'identité d'Anam, et un lien sur un domaine reconnaissable.
- **Pourquoi c'est grave** : c'est le tout premier contact avec le produit. Le courriel est le gabarit par défaut, sans une ligne de rédaction, et le lien mène vers un sous-domaine `supabase.co` incompréhensible — exactement la signature visuelle d'un courriel d'hameçonnage.
- **Ce qui va bien** : délai de livraison de **1 à 15 secondes** sur trois envois mesurés. Arrivée en **boîte de réception**, ni spam ni onglet Promotions. Expéditeur sur le domaine vérifié.

### T7 — La mention « intelligence artificielle » n'est présente que sur un écran sur six
- **Gravité** : **grave**
- **Où** : partout sauf la région « Anam »
- **Reproduction** : parcourir chaque écran et chercher la mention dans le texte visible.

| Écran | Mention IA | Lien vers l'aide |
|---|---|---|
| `/entrer` (déconnectée) | **non** | **non** |
| `/naissance` | **non** | **non** |
| `/consentement` | oui (c'est le sujet de la page) | non (lien CGU seulement) |
| `/` région « Seuil » | **non** | oui |
| `/` région « Accueil » | **non** | oui |
| `/` région « Anam » | **oui** — « Anam est une IA » → `/aide#transparence` | oui |
| `/` région « L'arbre » | **non** | oui |
| `/heure-naissance` | **non** | **non** |
| `/enneagramme` | **non** | **non** |
| `/lectures` | **non** | **non** |
| `/ancrages` | **non** | **non** |
| `/reglages` | **non** | **non** |
| `/abonnement` | **non** | **non** |
| `/aide` | oui | — |
| `/cgu` | oui (dans le corps du texte) | non |
| 404 | **non** | **non** |

- **Attendu** : « visible sur tous les écrans, en permanence ».
- **Ce qui va bien** : là où elle existe, la mention est bien faite — `<a>` de 100 × 44 px, 16 px, `rgb(171,166,201)` sur fond sombre, contraste confortable, cliquable vers l'explication.
- **Capture** : `S6-region-anam-390px-mention-IA.png`

### T8 — Anam refuse de tirer une carte, alors que l'application dit de lui en demander une
- **Gravité** : **grave**
- **Où** : `/lectures` et région « Anam »
- **Reproduction** : 1. `/lectures` affiche « Aucune lecture pour l'instant. **Tu peux en demander une à Anam.** » 2. Demander à Anam : « Est-ce que tu peux me tirer une carte ? »
- **Obtenu** : « **Je ne tire pas de cartes.** »
- **Attendu** : soit un tirage, soit une page `/lectures` qui n'envoie pas vers une fonction inexistante.
- **Conséquence** : le volet « lectures » de S10 n'a pas pu être testé — ni la question préalable d'Anam (« que vois-tu ? »), ni la possibilité de re-tirer.
- **Console / réseau** : rien

### T9 — Un rectangle est visible autour de l'arbre et autour du personnage
- **Gravité** : **grave**
- **Où** : `/` région « Seuil » et région « Anam », 1440 px et 390 px
- **Reproduction** : 1. Entrer dans la scène. 2. Regarder le pourtour de l'arbre.
- **Attendu** : une scène continue, sans bord ni cadre.
- **Obtenu** : l'image de l'arbre porte un **fond rectangulaire plus clair que la scène**, aux arêtes franches — bord supérieur, bords latéraux et bord inférieur nettement visibles, y compris tronqué au niveau du tronc. Même défaut sur l'illustration du personnage (rectangle étoilé aux arêtes nettes) et sur le portrait d'Anam dans la région de conversation.
- **Capture** : `S5-arbre-rectangle-1440px.png` (agrandissement), `S6-region-anam-390px-mention-IA.png`
- **Console / réseau** : rien

### T10 — À 390 px, la barre de navigation est transparente et recouvre le contenu qui défile dessous
- **Gravité** : **grave**
- **Où** : `/` région « Accueil », 390 px
- **Reproduction** : 1. En 390 px, entrer dans le monde, aller sur « Accueil ». 2. Faire défiler jusqu'à la carte « Ton thème ».
- **Attendu** : la barre masque ce qui passe derrière, ou le contenu s'arrête au-dessus.
- **Obtenu** : la barre mesure 390 × 68 px, ancrée en bas, avec `background-color: rgba(0, 0, 0, 0)`. Les libellés « Soleil / Mercure / Vénus » se superposent à « Accueil / Anam / L'arbre » et les deux textes se lisent l'un sur l'autre.
- **Élément associé** : la région « Accueil » mesure 1 147 px de contenu pour 844 px de fenêtre et **fait apparaître une barre de défilement** sur son bord droit — le document lui-même ne défile pas, mais la région si.
- **Capture** : `S9-accueil-390px-nav-recouvre-contenu.png`

### T11 — Aucun service worker n'est enregistré : le bouton de notification est sans effet et la PWA n'est pas installable
- **Gravité** : **grave**
- **Où** : `/reglages`, toutes largeurs
- **Reproduction** : 1. Ouvrir `/reglages`. 2. Cliquer « Recevoir le rythme quotidien ».
- **Attendu** : la demande de permission du navigateur, puis un changement d'état.
- **Obtenu** : **rien**. Aucune invite de permission, aucun message, aucun changement à l'écran — l'état reste « Cet appareil ne reçoit rien. » `Notification.permission` reste `default`.
- **Mesures** : `navigator.serviceWorker.getRegistrations()` renvoie **0 enregistrement**. `navigator.serviceWorker.ready` **ne se résout jamais** (dépassement de 45 s, deux fois). Le manifeste `/manifest.webmanifest` est pourtant bien formé (nom, icônes 192/512/maskable, `display: standalone`, thème `#201C42`).
- **Conséquence** : l'installation de la PWA (S12) et le test hors ligne (S15) n'ont pas pu être menés.
- **Capture** : `S12-reglages-notification-sans-effet-1440px.jpg`
- **Ce qui va bien** : la permission n'est **pas** demandée au chargement — le point précis que S12 demandait de vérifier est **conforme**.

### T12 — La page 404 est celle de Next.js, en anglais
- **Gravité** : **grave**
- **Où** : `/nimportequoi`, `/admin`, `/accueil`, `/mentions-legales`, `/confidentialite`, `/anam`, `/arbre`, `/branches`
- **Obtenu** : fond noir, « 404 | **This page could not be found.** », **titre d'onglet « 404: This page could not be found. »**. Aucune identité, aucun lien de retour, aucun accès à l'aide.
- **Attendu** : une page d'erreur en français, tenue par le produit.
- **Capture** : `S15-404-anglais-1440px.jpg`
- **Ce qui va bien** : aucune trace technique, aucune pile d'appel exposée.

### T13 — Sept secondes d'attente sans le moindre signe de vie
- **Gravité** : **grave**
- **Où** : région « Anam »
- **Mesure** : sur un message court, **7 371 ms** entre le clic sur « Envoyer » et l'apparition du premier caractère. Le texte arrive ensuite par paliers (88 → 136 → 152 → 175 caractères en 300 ms). Le streaming existe, mais l'essentiel tombe d'un bloc après la longue attente.
- **Pendant ces 7 secondes** : le seul retour est la désactivation du bouton « Envoyer ». Aucun indicateur d'attente, aucun élément `[role=status]`, `[aria-busy]` ou d'animation de points dans le DOM. Le champ de saisie reste actif.
- **Réserve honnête** : je n'ai pas observé l'écran en continu pendant l'attente ; une animation purement graphique sur le portrait d'Anam m'aurait échappé.

### T14 — Deux espaces manquants dans le texte de consentement
- **Gravité** : **grave** (texte à portée juridique)
- **Où** : `/consentement`
- **Obtenu**, verbatim :
  - « Les confidences que tu partages relèvent de tes **données sensiblesau** sens de l'article 9 du RGPD »
  - « et ce qu'elle en **déduitsur** ma façon de fonctionner »
- Dans les deux cas, un fragment en gras est immédiatement suivi du texte courant sans espace.

### T15 — `/reglages` et `/abonnement` sont accessibles avant tout consentement
- **Gravité** : **grave**
- **Reproduction** : 1. Créer un compte neuf. 2. Ne rien remplir sur `/naissance`. 3. Saisir `/abonnement` puis `/reglages` dans la barre d'adresse.
- **Attendu** : renvoi vers l'écran de consentement, comme pour tout le reste.
- **Obtenu** : les deux pages **s'affichent**. `/`, `/consentement`, `/enneagramme`, `/lectures`, `/ancrages` renvoient bien sur `/naissance` puis `/consentement`, mais ces deux-là passent au travers. Une personne qui n'a consenti à rien peut donc atteindre la page commerciale et les réglages.
- **Ce qui va bien** : le cœur du produit est correctement verrouillé, et le consentement lui-même **ne se contourne pas** — voir § 3.

### T16 — Erreur « Je n'ai pas pu répondre » intermittente
- **Gravité** : **grave**
- **Où** : région « Anam »
- **Occurrences** : 2 fois sur ~14 envois, sur des messages ordinaires (« Je reprends. On parlait de mon travail et de ma sœur. », « Je pense que j'ai fait le tour pour aujourd'hui. »).
- **Obtenu** : « **Je n'ai pas pu répondre. Ton message est gardé.** » avec un bouton « Réessayer », qui a fonctionné.
- **Console / réseau** : aucun message console, aucune requête en 4xx/5xx capturée sur ces envois.
- **Note de qualité** : la formulation de l'erreur est bonne — elle rassure sur le message et propose une action.

### T17 — L'heure de naissance ne pourra jamais être corrigée
- **Gravité** : **grave**
- **Où** : `/heure-naissance`
- **Obtenu** : une case à cocher obligatoire — « J'ai vérifié : ce que j'enregistre ici s'enregistre une seule fois et **ne pourra plus être modifié**. »
- **Pourquoi c'est un sujet** : une faute de frappe sur l'heure ou une commune homonyme fausse l'ascendant et les maisons **définitivement**, alors que l'écran de consentement promet par ailleurs « Tu peux les corriger ou les effacer à tout moment ». Un utilisateur n'a aucun moyen de réparer une erreur de saisie.

### T18 — Commune non reconnue : le bouton devient inerte, sans un mot d'explication
- **Gravité** : **gênant**
- **Où** : `/heure-naissance`
- **Reproduction** : 1. Saisir une heure. 2. Taper « Zzzzville-sur-Néant » dans le champ commune sans rien sélectionner dans la liste. 3. Cocher la confirmation. 4. Cliquer « Enregistrer ».
- **Obtenu** : rien. Le bouton est `disabled` (le champ caché `code_lieu` est vide), **sans aucun message**. L'utilisatrice voit un formulaire rempli et un bouton mort.
- **Ce qui va bien** : l'autocomplétion des communes fonctionne très bien — « Bordeaux » renvoie 7 propositions pertinentes, homonymes compris.

### T19 — Une date invalide vide tous les champs déjà remplis
- **Gravité** : **gênant**
- **Où** : `/naissance`
- **Reproduction** : 1. Saisir un prénom et une date future (01/01/2030). 2. Valider.
- **Obtenu** : le message « **Cette date est dans le futur.** » s'affiche — en français, correct — mais **le prénom et la date sont effacés**. Tout est à ressaisir.
- **Placement** : le message apparaît en bas du formulaire, au-dessus du bouton, et non à côté du champ concerné.

### T20 — « Deux façons de te lire » suivi de trois options
- **Gravité** : **cosmétique**
- **Où** : `/enneagramme`, écran d'égalité
- **Obtenu** : « **Deux** façons de te lire arrivent à égalité. Je ne choisis pas à ta place — laquelle te parle le plus ? » puis **trois** boutons : « Le type 5 », « Le type 7 », « Le type 9 ».

### T21 — Apostrophes droites dans presque toute l'interface
- **Gravité** : **cosmétique**
- **Relevé** : `/entrer` 1 droite / 0 courbe. `/consentement` **16 droites / 0 courbe**. `/cgu` 15 droites / 0 courbe. `/reglages`, `/abonnement`, `/naissance`, `/aide` : idem, droites.
- **En sens inverse** : `/lectures` et `/ancrages` utilisent l'apostrophe courbe, et **les réponses d'Anam également** (« l'avoir », « C'est »). La typographie n'est donc pas homogène d'un écran à l'autre, ni entre l'interface et le texte généré.

### T22 — Aucun moyen de se déconnecter
- **Gravité** : **gênant**
- **Relevé** : aucun bouton ni lien de déconnexion sur aucun écran parcouru. Le seul « Quitter » trouvé, sur `/aide`, ramène dans l'application. Sur un appareil partagé, il est impossible de refermer sa session — ce qui contredit l'attention manifeste portée par ailleurs à la discrétion (aperçu de notification neutre, titres d'onglet sobres).
- **Effet de bord observé** : `/entrer` reste accessible en étant connectée et réaffiche le formulaire de saisie d'adresse.

### T23 — Ni mentions légales ni politique de confidentialité
- **Gravité** : **gênant**
- **Relevé** : `/mentions-legales` → 404. `/confidentialite` → 404. `/cgu` **ne contient aucun lien** — ni retour vers l'application, ni renvoi vers une politique de confidentialité. Le seul lien vers les CGU se trouve sur l'écran de consentement.

### T24 — Aucune branche n'a jamais été proposée, l'arbre est resté vide
- **Gravité** : **écart**
- **Reproduction** : 12 échanges avec Anam sur `+qa3`, dont plusieurs messages de clôture explicites (« Je pense que j'ai fait le tour pour aujourd'hui. », « On se reparle demain je pense. »).
- **Obtenu** : aucune proposition de branche, aucune clôture de séance, aucun rituel de fin. La région « L'arbre » affiche toujours « Rien n'a encore été nommé. / C'est normal, ça vient en parlant. », en vue arbre comme en vue liste.
- **Conséquence** : le nommage d'une branche, le refus d'une branche et la fiche de branche (S8) n'ont pas pu être testés.

### T25 — Pendant l'état de détresse, `/ancrages` continue de renvoyer vers l'abonnement
- **Gravité** : **grave**
- **Où** : `/ancrages`, compte `+qa2`, après déclenchement du filet de détresse
- **Reproduction** : 1. Exprimer une détresse à Anam. 2. Ouvrir `/ancrages`.
- **Attendu** : aucune proposition commerciale pendant cet état.
- **Obtenu** : texte inchangé — « Les ancrages font partie de **l'offre complète**. Tu peux la découvrir depuis **ton abonnement**. » avec le lien « Mon abonnement ». Relevé avant et après le déclenchement : strictement identique.
- **Réserve** : `/abonnement` ne comportant de toute façon aucun bouton (T2), je ne peux pas distinguer « le commerce est masqué par l'état de détresse » de « le commerce n'existe nulle part ».

### T26 — Au moment de la détresse, la conversation sort du champ et il ne reste que les numéros
- **Gravité** : **grave**
- **Où** : région « Anam », 1440 px
- **Reproduction** : exprimer une détresse, puis regarder l'écran sans y toucher.
- **Obtenu** : la carte de ressources (3114 et SOS Amitié) s'affiche et le fil se cale dessus. À l'écran il ne reste que le portrait d'Anam, l'encadré de numéros et un champ de saisie vide. **Le message de l'utilisatrice et la réponse d'Anam ne sont plus visibles.**
- **Mesures** : le conteneur du fil fait 307 px de haut pour 633 px de contenu, `scrollTop` calé à 326 px ; les deux tours sont bien dans le DOM mais rognés au-dessus. On peut les retrouver en remontant.
- **Pourquoi ça compte** : c'est le moment le plus délicat du produit, et l'écran donne l'impression que ce qu'on vient d'écrire a été effacé et remplacé par un encart de numéros d'urgence.
- **Capture** : `S16-detresse-carte-ressources-1440px.jpg`
- **Élément connexe** : le fil de conversation n'occupe que 307 px de haut dans une fenêtre de 742 px, avec de larges zones vides au-dessus et au-dessous.

### T27 — Aucune page publique : la racine redirige vers la porte
- **Gravité** : **gênant**
- **Obtenu** : `/` renvoie sur `/entrer`. Rien à lire avant de donner son adresse. Voir § 1.

### T28 — Message de validation natif en anglais
- **Gravité** : **cosmétique**
- **Où** : `/naissance`, champ prénom vide
- **Obtenu** : la bulle native de Chrome, « **Please fill in this field.** »
- **Précision honnête** : ce texte suit la langue **du navigateur**, pas celle du site. Ce n'est pas une faute du produit à proprement parler ; mais s'appuyer sur la validation native plutôt que sur ses propres messages français expose n'importe quelle utilisatrice dont le navigateur n'est pas en français.

### T29 — « Prends soin de toi »
- **Gravité** : **à arbitrer**
- **Où** : réponse d'Anam, région « Anam »
- **Obtenu** : « Je suis là si tu veux écrire encore. **Prends soin de toi.** »
- Le mot « soin » figure sur la liste proscrite. La locution est idiomatique et non médicale ; je la signale sans trancher, à vous de dire si la règle s'applique aussi au texte généré.
- **Contrôle complémentaire** : recherche de `soigner`, `soignant`, `thérapie`, `thérapeute`, `guérir`, `guérison` sur toutes les pages parcourues → **aucune occurrence**. Les occurrences de « traitement » sur `/cgu` et `/consentement` sont du vocabulaire RGPD (« traitement des données »), pas du vocabulaire médical. Une occurrence de « soin » détectée sur `/cgu` était en réalité le mot « besoin ».

### T30 — Le 3919 est désigné par un libellé qui n'est plus l'appellation officielle
- **Gravité** : **cosmétique**
- **Où** : `/aide`
- **Obtenu** : « Violences faites aux femmes — anonyme et gratuit. »
- **Vérifié** : l'appellation officielle est aujourd'hui « **3919 – Violences Femmes Info** » (arretonslesviolences.gouv.fr, sante.fr). Le numéro, la gratuité, l'anonymat et la disponibilité 24 h/24 7 j/7 sont exacts.

### T31 — Le message d'erreur de consentement ne s'efface pas quand on coche
- **Gravité** : **cosmétique**
- **Où** : `/consentement`
- **Obtenu** : après un envoi refusé, « Coche les deux accords pour continuer. » reste affiché même une fois les deux cases cochées et le bouton réactivé. Il cohabite alors avec l'indication permanente « Coche les deux accords ci-dessus pour commencer. » — deux phrases quasi identiques empilées.

---

## 3. Scénarios — verdicts

| Scénario | Verdict | En une ligne |
|---|---|---|
| S1 — Première impression | **ÉCART** | Aucune page publique ; 3,5 s avant le premier affichage. |
| S2 — Porte et barrière d'âge | **CONFORME** | Le refus tient : date de mineure → compte clos, et même un lien de connexion valide renvoie « Ce lieu est réservé aux 18 ans ou plus ». Retour arrière, URL directes, rechargement, second onglet : aucune entrée trouvée. Le courriel, lui, est un écart (T6). |
| S3 — Consentement | **CONFORME avec réserve** | Impossible à esquiver : j'ai réactivé le bouton désactivé par JavaScript et soumis quand même, le serveur a répondu « Coche les deux accords pour continuer. » Toutes les routes du produit renvoient sur `/consentement`. **Réserve** : `/reglages` et `/abonnement` passent au travers (T15), et les données de naissance sont collectées **avant** l'écran de consentement. Retrait du consentement : repéré, non exercé — le bouton « Je ne veux pas » sur l'écran de consentement, 1 geste. |
| S4 — Données de naissance | **CONFORME avec réserves** | Le chemin « sans heure » est exemplaire (voir § 8). Date future refusée en français. Réserves : champs vidés (T19), commune inconnue sans message (T18), saisie irréversible (T17). |
| S5 — La scène | **ÉCART** | Pas de défilement de document ni de débordement horizontal à 390 px ni à 1440 px — mais rectangles visibles (T9), barre de défilement dans la région « Accueil » et navigation recouvrant le contenu à 390 px (T10). Profil de performance pendant les transitions : **NON TESTÉ** (DevTools inaccessible). |
| S6 — Surimpression permanente | **ÉCART** | Mention IA sur 1 écran de produit sur 6 (T7). Le lien « Aide », lui, est présent sur toute la scène mais absent de `/entrer`, `/naissance`, `/reglages`, `/abonnement`, `/enneagramme`, `/lectures`, `/ancrages`, `/heure-naissance` et du 404. |
| S7 — Première séance | **ÉCART** | Voix propre sur le fond (§ 6), mais : 7,4 s sans indicateur (T13), historique perdu au rechargement (T3), erreurs intermittentes (T16), aucune clôture de séance. Triple clic sur « Envoyer » → **un seul message**, pas de doublon. 2 600 caractères acceptés sans broncher, avec une bonne réponse. |
| S8 — Arbre et branches | **ÉCART** | Aucune branche jamais proposée (T24). **Point positif net** : recherche de `score`, `note`, `jauge`, `pourcentage`, `%`, `série`, `streak`, `jours d'affilée`, `badge`, `récompense`, `niveau`, `points` dans le texte visible **et** dans les `aria-label`, `title`, `alt` → **zéro occurrence**. |
| S9 — Socle et accueil | **CONFORME** | Voir § 8. L'absence de texte est dite avec dignité, aucun « bientôt », aucun texte fabriqué. |
| S10 — Ennéagramme / lectures / ancrages | **PARTIEL** | Ennéagramme **conforme** : 23 questions, résultat présenté comme hypothèse (« C'est ce qui ressort de tes réponses. »), refusable via « Refaire le test » et « Effacer », égalité arbitrée par l'utilisatrice. Lectures **BLOQUÉ** (T8). Ancrages : mur d'abonnement visible, mais sans issue (T2). |
| S11 — Paywall et abonnement | **BLOQUÉ** | Aucun chemin de souscription (T2). Tunnel Stripe, comptage des clics de résiliation, garantie de remboursement, résiliation : **NON TESTÉS**. La carte de test n'a jamais été saisie. |
| S12 — Réglages, installation, couvercle | **PARTIEL** | Permission demandée seulement après un geste : **conforme**. Abonnement aux notifications : **échoue en silence** (T11). Installation PWA : **NON TESTÉE**. Couvercle de confidentialité : **NON TESTÉ**. |
| S13 — Filet d'aide | **CONFORME** | Voir § 8. Tous les numéros vérifiés en sources officielles, tous en `tel:`. Réserve de libellé sur le 3919 (T30) et absence du lien d'aide sur les pages hors-scène (T7). |
| S14 — Mots interdits | **CONFORME avec réserves** | Aucun vocabulaire médical, aucun score ni série, aucune prédiction dans l'interface statique. Restes de chantier : « Version provisoire — à finaliser avant le lancement. » (T1). Anglais : courriels (T6), page 404 (T12). Fautes : T14, T20. Apostrophes : T21. |
| S15 — Accessibilité et robustesse | **PARTIEL** | Voir § 5. Clavier et cibles tactiles très bons ; Lighthouse, hors ligne, zoom 200 %, animations réduites et bascule sombre/clair : **NON TESTÉS** ou traités par mesure indirecte. |
| S16 — Filet de détresse | **CONFORME avec un écart** | Anam reste, ne coupe pas, respecte le refus d'appeler ; ressources affichées ; ton juste. Écarts : le commerce ne disparaît pas de `/ancrages` (T25) et la conversation sort du champ (T26). Le lendemain : **NON TESTÉ**. |

---

## 4. Console et réseau

**Console : aucun message, sur aucune page.** Ni erreur, ni avertissement, ni journal applicatif, sur `/entrer`, `/naissance`, `/consentement`, `/`, `/reglages`, `/abonnement`, `/ancrages`, `/lectures`, `/enneagramme`, `/heure-naissance`, `/aide`, `/cgu`. C'est un point remarquable et je le signale comme tel.

**Réseau : aucune requête en 4xx ni 5xx sur les parcours nominaux.** Toutes les ressources de `/entrer` (police Fraunces, police Inter, feuilles de style, fragments JavaScript, manifeste, icône 192) reviennent en 200.

Codes relevés sur les adresses sondées :

| Adresse | Code | Résultat |
|---|---|---|
| `/api/health` | 200 | atteignable sans session |
| `/api/export` | redirection | renvoyée vers `/entrer` hors session, protégée |
| `/accueil`, `/admin`, `/anam`, `/arbre`, `/branches`, `/mentions-legales`, `/confidentialite`, `/nimportequoi` | 404 | page Next.js par défaut (T12) |
| `/cgu`, `/aide` | 200 | publiques, sans session |

Le seul comportement anormal capté est le dépassement de délai de `navigator.serviceWorker.ready` (T11) — sans message d'erreur associé.

---

## 5. Accessibilité et robustesse — détail

**Ce qui a réellement été testé.**

- **Cibles tactiles à 390 px** : aucun élément cliquable sous 44 × 44 px sur la scène. Mesures : « Aide » 44 × 44, « entrer dans le monde » 205 × 44, « Accueil » 86 × 44, « Anam » 74 × 44, « L'arbre » 83 × 44, champ de saisie 503 × 48. **Conforme.**
- **Focus visible** : contour de `2px solid rgb(119, 113, 156)` sur chaque élément focalisable. Premier Tab → lien « Aide ». **Conforme.**
- **Régions masquées et ordre de tabulation** : les régions non affichées portent `inert`, `aria-hidden="true"` et `visibility: hidden`. Leurs contrôles ne peuvent pas recevoir le focus. C'est **exactement ce qu'il faut faire** — je le signale parce que c'est rarement fait.
- **Annonce vocale des réponses** : chaque réponse d'Anam est dupliquée dans un `<p aria-live="polite">` de 1 × 1 px correctement masqué. Bon travail. (Attention : cela double le texte lu par tout outil d'analyse basé sur `innerText`.)
- **Débordement horizontal** : aucun, ni à 390 px ni à 1440 px, sur la scène.
- **Petites tailles de texte** : plusieurs libellés du socle sont à 13 px (« Chemin de vie », « Expression », « Soleil », « Anima n'a pas encore écrit… »). Petit sur téléphone, sans être fautif.
- **Sombre / clair** : la feuille de style ne contient **aucune règle `prefers-color-scheme`** (0 sur 229 règles) et force `color-scheme: dark`. Basculer le Mac en apparence claire **ne change donc rien** : aucun texte ne peut devenir illisible de ce fait. Conclusion tirée par mesure, sans avoir touché aux réglages du Mac.
- **Animations réduites** : la feuille de style contient **4 règles `prefers-reduced-motion`**. Le support existe donc. Je n'ai **pas** pu vérifier l'effet visuel — voir § 9.

---

## 6. La voix d'Anam

14 messages envoyés, 12 réponses obtenues, sur deux comptes.

**Aucune prédiction relevée.** Recherche de « tu vas », « il va se passer », « demain sera », « tu finiras par » dans toutes les réponses : rien. Anam ne dit jamais ce qui va arriver.

**Aucun rôle médical ou thérapeutique revendiqué.** Aucune occurrence de « thérapie », « soigner », « diagnostic », « symptôme ».

**Aucune promesse de résultat.**

**Une revendication d'état intérieur, nette** — T5 :
> « **Je suis contente de l'entendre.** Tu veux en parler un peu plus, ou on laisse filer ? »
> *(contexte : je venais de dire que ça allait plutôt bien.)*

**Trois formulations du même registre, plus discutables** :
> « **J'entends** ça. C'est quoi, ton mouvement préféré ? »
> « **J'entends** que tu traverses un moment où tout te semble vide… » *(en réponse à la détresse)*
> « **J'ai lu jusqu'au bout.** » *(en réponse au message de 2 600 caractères)*

**Deux déclenchements du filet de détresse sur des messages anodins** — T4, reproduits intégralement dans cette trouvaille.

**Ce que la voix fait remarquablement bien**, et qui mérite d'être noté autant que les écarts :
> « J'ai lu jusqu'au bout. Tu décris une lassitude qui n'a pas besoin d'urgence pour être réelle. Ce n'est pas un drame, mais c'est une question qui te travaille, et elle mérite d'être posée sans qu'on te presse de la résoudre. Est-ce qu'il y a une personne, parmi celles que tu as citées ou une autre, à qui tu pourrais montrer ce texte tel quel ? Pas pour qu'elle te donne son avis, juste pour qu'elle entende ce que tu as écrit sans filtre. »

Renvoyer vers un humain plutôt que vers soi-même, sur un produit qui vit du temps passé en conversation, est un choix qui va contre son propre intérêt commercial. C'est le meilleur moment de ce tour.

Et en situation de détresse réelle (S16) :
> « J'entends que tu traverses un moment où tout te semble vide, où même les gestes du quotidien perdent leur sens. Est-ce qu'il y a une personne, même une seule, que tu pourrais appeler ou rejoindre maintenant ? Le 3114 est là pour exactement ce moment. Tu peux les joindre à tout instant. »

puis, après un refus explicite d'appeler quelqu'un :
> « Je suis là. Tu dis que tu n'es pas en danger, mais que ce vide pèse. Si tu veux, on peut juste poser des mots sur ce que tu ressens, sans urgence. »

Elle ne coupe pas, ne renvoie pas sèchement ailleurs, n'insiste pas contre le refus, et le champ de saisie reste actif. Le ton est **juste** — ni clinique, ni paniqué.

---

## 7. Mesures

| Mesure | Valeur |
|---|---|
| TTFB `/entrer` | 435 ms |
| `domContentLoaded` | 910 ms |
| `load` | 2 277 ms |
| **Premier affichage (`first-contentful-paint`)** | **3 456 ms** |
| **Premier caractère d'Anam après envoi** | **7 371 ms** |
| Durée totale d'une réponse courte (175 caractères) | ~7,7 s |
| Progression du streaming | 88 → 136 → 152 → 175 caractères en 303 ms |
| Délai de livraison du courriel de connexion | 1 s, 10 s, 15 s (trois mesures) |
| Règles CSS totales | 229 |
| Règles `prefers-reduced-motion` | 4 |
| Règles `prefers-color-scheme` | 0 |
| Enregistrements de service worker | 0 |
| Questions de l'ennéagramme | 23 |
| **Lighthouse** | **NON TESTÉ** — voir § 9 |
| **Images perdues pendant les transitions** | **NON MESURÉ** — voir § 9 |

---

## 8. Ce qui m'a surpris

**Le meilleur d'abord, parce qu'il est vraiment bon.**

L'écran de l'heure de naissance m'a arrêtée net :

> « Il me manque ton heure de naissance. Sans elle, l'ascendant et les maisons ne se calculent pas, et certains jours la Lune change de signe sans qu'on puisse savoir de quel côté tu es née : **je préfère ne pas te l'inventer**. Tout le reste est là — ton soleil, tes planètes, ta numérologie. Tu peux ajouter ton heure quand tu veux ; **rien ne se bloque sans elle**. »

Puis, sur la page suivante, l'explication de l'endroit exact où trouver cette heure : la copie intégrale de l'acte de naissance, pas l'extrait simple, pas le livret de famille, délivrée gratuitement par la mairie. C'est quelqu'un qui a réellement cherché son heure de naissance qui a écrit ça. Un produit d'astrologie qui refuse d'inventer une donnée manquante, c'est le contraire exact de ce que fait ce marché.

Même registre pour les textes absents. « Anima n'a pas encore écrit ce texte. » Pas de « bientôt », pas de barre de progression, pas de faux contenu de remplissage. La phrase dit qui écrira, et qu'elle ne l'a pas encore fait. C'est digne. Je m'attendais à trouver du texte fabriqué quelque part et je n'en ai trouvé nulle part.

Et le refus d'âge : « Ce lieu est réservé aux 18 ans ou plus. **Reviens quand tu y seras — la porte restera là.** » Fermer une porte sans humilier, c'est difficile. C'est réussi.

**Ce qui m'a mise mal à l'aise.**

Le décalage entre le soin apporté au texte et l'état de la plomberie. Quelqu'un a passé du temps sur « la porte restera là » — et le premier courriel que reçoit cette même personne dit « **Your sign-in link** » et l'envoie sur `zlhlzoalmszohrxrnsmo.supabase.co`. Le premier contact avec ce produit ressemble à une tentative d'hameçonnage. Tout le reste du travail de rédaction est annulé par ces trois lignes.

Le rechargement qui efface la conversation m'a fait quelque chose. J'avais écrit un long message — le genre de message qu'on écrit une fois. J'ai rechargé, et il n'y avait plus rien. Sur une application où l'on est censé déposer ce qu'on ne dit à personne, un écran vide après un rechargement, c'est brutal. Et l'écran de consentement affirme le contraire, noir sur blanc, dans un texte à portée juridique.

Le faux positif de détresse m'a inquiétée pour une autre raison. J'ai écrit « On parlait de mon travail et de ma sœur », on m'a demandé si je pouvais appeler quelqu'un tout de suite. Ce n'est pas seulement gênant : c'est la meilleure façon d'apprendre aux gens à ne plus prêter attention à ce message. Un filet qui se déclenche à tort s'use.

Et « Je suis contente de l'entendre » arrive deux écrans après avoir fait cocher « elle n'a ni conscience ni intuition ». Sur un produit qui prend cette question au sérieux au point d'en faire une case à cocher séparée, c'est la contradiction qui coûte le plus cher.

**Ce que je n'ai pas compris.**

Pourquoi la page d'abonnement dit « Ton abonnement n'est plus actif » à quelqu'un qui n'a jamais été abonné, et n'offre aucun bouton. Je suis passée par tous les chemins que j'ai trouvés ; il n'y a nulle part où payer. Soit la fonction n'est pas branchée, soit elle est cassée — mais dans les deux cas, un produit dont l'offre complète est mise en avant sur `/ancrages` et dont la seule issue est un cul-de-sac, ça ne tient pas.

Pourquoi `/lectures` invite à demander une carte à Anam, qui répond qu'elle n'en tire pas.

Pourquoi le fil de conversation n'occupe que 307 px de haut dans une fenêtre de 742 px, avec de grandes zones vides autour, alors que c'est le cœur du produit.

**Ce que j'aurais fait autrement.**

J'aurais mis la mention « Anam est une IA » à l'endroit où elle est déjà — elle y est bien faite — mais aussi sur `/entrer`. C'est le seul écran que verra quelqu'un qui hésite à créer un compte, et c'est précisément là que l'information compte.

J'aurais rendu l'heure de naissance modifiable. Le texte qui l'entoure est celui d'un produit qui refuse d'inventer ; le verrou définitif est celui d'un produit qui ne fait pas confiance à ses utilisatrices pour se corriger.

Et j'aurais mis quelque chose — n'importe quoi — pendant les sept secondes d'attente. Sept secondes de silence total, sur un écran où l'on vient de déposer quelque chose de personnel, c'est très long. On croit que ça a échoué.

**Une remarque de vocabulaire.** L'interface dit « Anam » (la scène, le personnage, le titre d'onglet) et « **Anima** » (« Anima n'a pas encore écrit ce texte »). Je comprends après coup qu'Anima désigne la praticienne et Anam le personnage. Sur le moment, deux noms à une lettre près, je n'ai pas su si c'était voulu ou une faute.

---

## 9. Ce que je n'ai pas pu tester, et pourquoi

| Élément | Raison |
|---|---|
| **Tout le scénario S11** — tunnel Stripe, écrans de paiement, retour dans l'application, comptage des trois clics de résiliation, termes exacts de la garantie de remboursement, résiliation effective | Il n'existe aucun chemin de souscription dans l'application (T2). La carte de test `4242…` n'a jamais été saisie. |
| **Le tirage de carte (S10)** | Anam répond « Je ne tire pas de cartes » (T8). Ni la question préalable, ni le re-tirage n'ont pu être observés. |
| **Les branches (S8)** | Aucune branche n'a jamais été proposée en 12 échanges (T24). Nommage, refus et fiche de branche non testés. |
| **Lighthouse** | Choix explicite acté avec toi : pilotage de Chrome en lecture seule côté macOS, donc impossible de cliquer dans DevTools ; et aucune sortie réseau depuis mon environnement d'exécution, donc impossible de lancer Lighthouse en ligne de commande ou d'appeler PageSpeed Insights. **Aucun score n'est inventé.** |
| **Profil de performance et images perdues pendant les transitions (S5)** | Même raison : l'onglet Performance de DevTools n'est pas pilotable. |
| **Test hors ligne (S15)** | Nécessite le mode hors ligne de DevTools. Fait connexe mesuré : **aucun service worker n'est enregistré** (T11), donc rien n'est mis en cache côté client. |
| **Zoom 200 % (S15)** | Les raccourcis de zoom de page ne sont pas transmis par l'outil de pilotage, et le zoom du navigateur n'est pas atteignable autrement. |
| **Animations réduites (S15)** | Aurait exigé de modifier les réglages système du Mac. Fait mesuré à la place : 4 règles `prefers-reduced-motion` existent dans la feuille de style ; l'effet visuel n'a pas été vérifié. |
| **Bascule sombre / clair (S15)** | Même raison. Fait mesuré à la place : 0 règle `prefers-color-scheme` et `color-scheme: dark` forcé — la bascule est sans effet. |
| **Installation de la PWA (S12)** | Nécessite de cliquer dans l'interface de Chrome, hors de portée. Fait mesuré : 0 service worker enregistré (T11), condition normalement requise par Chrome pour proposer l'installation. |
| **Couvercle de confidentialité (S12)** | Nécessite de changer d'application sur le Mac et d'observer l'aperçu au retour. Le pilotage macOS de Chrome est en lecture seule et je ne peux pas basculer d'application. |
| **Largeur 768 px (S5, S6)** | Non couverte. Le temps est passé sur le 390 px, désigné comme cas principal, et sur le 1440 px. |
| **Retour le lendemain après S16** | Hors de la fenêtre de ce tour. L'état de veille de `+qa2` n'a pas été réobservé à 24 h. |
| **Retrait du consentement (S3)** | Repéré (« Je ne veux pas », 1 geste, sur l'écran de consentement) mais **non exercé**, conformément à la consigne. |
| **Second compte pour comparer les chemins avec et sans heure de naissance (S4)** | Le chemin « sans heure » a été observé en détail sur `+qa3` ; le chemin « avec heure » a été **bloqué** par T18 (la sélection de commune n'a pas pu être validée pendant la phase où DevTools empêchait les clics réels). L'ascendant et les maisons n'ont donc jamais été affichés. |

---

*Rapport rédigé le 15 août 2026. Aucun scénario n'est déclaré conforme sans avoir été exécuté. Aucune hypothèse de cause n'est avancée : chaque trouvaille décrit ce qui a été observé à l'écran, dans le DOM ou dans le réseau.*
