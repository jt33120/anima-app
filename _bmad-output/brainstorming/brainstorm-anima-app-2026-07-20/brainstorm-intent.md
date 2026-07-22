# Anima App — Document d'intention

Source : séance de brainstorming du 2026-07-20 (Mind Mapping, Persona Journey, Causal Loop Mapping, One Feature Only, convergence MoSCoW). Ne contient que les décisions retenues. Destiné à alimenter directement product-brief / PRD / market-research.

---

## 1. Produit en une phrase

Une application web de développement personnel spirituel qui **reconnecte une personne à son chemin de vie** : une bibliothèque spirituelle gratuite (numérologie, thème astral, horoscope calculé) sert de porte d'entrée, et un **agent IA à mémoire longue (Anam)** l'accompagne dans la durée pour l'aider à repérer et rompre ses schémas répétitifs.

Cible : adulte (persona Camille, cf. §13) déjà intéressé par l'astro/spiritualité, en quête de sens après une rupture ou un essoufflement, méfiant envers les apps de bien-être qu'il a déjà abandonnées.

---

## 2. Le problème et la peur fondatrice

- **Problème utilisateur** : « pourquoi ça recommence toujours pareil ? » — des schémas répétitifs invisibles de l'intérieur, et un horoscope générique qui ne dit rien de sa vie réelle.
- **Peur fondatrice (formulée par Julian, elle commande tout le produit)** : **ne pas avoir envie d'y retourner.** Il faut du simple, qui rend heureux, et qui apporte vraiment quelque chose dans la vie.
- **Contre-preuve intégrée** : la persona arrive **échaudée** — elle a déjà abandonné une app de bien-être. Le churn est une expérience passée, pas une hypothèse.

---

## 3. La vision cœur

**Reconnexion d'âme** : reconnecter les gens à leur chemin de vie.

- Pas un horoscope bateau : un contenu **précis, en lien avec ce qu'elle vit, qui la SUIT, à qui elle PARLE, et qui la fait se sentir COMPRISE**.
- Promesse d'expérience : **espoir et clarté**, en lien avec ses objectifs.
- Finalité : aller vers **la meilleure version de soi**, remplir sa **légende personnelle**, se réaliser.
- **Différenciateur anti-churn** : l'astro/numérologie donne le **cadre** ; ce sont **ses données** (conversation, journal, objectifs) qui donnent la **précision**. La boucle de personnalisation est la vraie rétention.

---

## 4. La colonne vertébrale

| Élément | Rôle produit |
|---|---|
| **Légende personnelle** | la **destination** |
| **Chemin de vie + thème astral + numérologie (+ ennéagramme)** | la **carte** |
| **Conversation / journal / humeur** | la **position actuelle** |
| **Anam** | le **guide** qui lit la carte depuis la position |

Cette spine unifie l'ensemble des features : toute fonctionnalité v1 doit se rattacher à l'une des quatre cases.

---

## 5. Le mécanisme central

### 5.1 La mémoire longue = LA feature (One Feature Only)

**Décision** : la feature unique du produit est **la mémoire longue** — suivre précisément, tout garder, être son meilleur allié. Les IA grand public font des sessions et retiennent quelques éléments ; ici on suit vraiment.

- **Le hook n'est pas le produit** : l'horoscope est la **porte d'entrée** (coût quasi nul, appâte large) ; la mémoire longue est le **produit**. **MVP = hook minimal + mémoire maximale.**
- **Architecture de la mémoire en 3 couches** : (1) journal/conversation brut → (2) **faits extraits** (profil vivant) → (3) **branches** (prises de conscience). Mémoire = extraction structurée + rappel au bon moment + synthèse périodique.

### 5.2 La prise de conscience comme unité de progrès

- Un médium lit l'**énergie** ; l'app est froide et ne peut pas la sentir. **L'équivalent applicatif de l'énergie, c'est la PRISE DE CONSCIENCE.**
- **Reframe fondateur** : le médium voit l'**instant**, Anam a la **mémoire** — Anam voit le **chemin**. Ce n'est pas un moins, c'est un autre sens.
- Détectable dans le langage : reconceptualisation (« avant je pensais X, maintenant je vois Y »), auto-distanciation / bascule de pronoms, meaning-making, granularité émotionnelle, glissement du langage subi → agentique, temps de rebond.

### 5.3 L'arbre

Représentation vivante du progrès (posture de l'arbre en yoga), **remplace barre de progression ET mini-jeux**.

| Partie | Signification |
|---|---|
| **Tronc** | ce avec quoi elle arrive : thème natal, chemin de vie, numérologie |
| **Branches** | les **prises de conscience** (part d'un tronc, s'élargit branche après branche) |
| **Racines** | la régularité |
| **Feuillage** | la granularité émotionnelle |
| **Cernes / cicatrices** | les tempêtes traversées |

- **L'arbre NE RÉGRESSE JAMAIS** — le faire rétrécir serait méchant. Un streak punit (on perd), un arbre n'enlève jamais : **monotone croissant = honnête**. Une prise de conscience acquise reste acquise même dans un mauvais mois.
- **Branche cliquable** : chaque branche renvoie à l'entrée exacte où elle a compris (« voilà la nuit où tu as compris que tu n'avais pas à te justifier »).
- **Garde-fou autonomie** : Anam **propose** (« il s'est passé quelque chose là, tu veux en faire une branche ? »), **elle valide et NOMME**. Elle est l'auteure de son arbre.
- **Apaisement comme preuve** : « tu peux être remué, tu restes un arbre, tu restes droit, tu l'accueilles ».

### 5.4 Rupture de boucle

**Rompre les schémas répétitifs.** L'arbre EST la boucle rompue rendue visible : **chaque branche = un schéma cessé**. L'**ennéagramme** est le catalogue de ces schémas (chaque type est une typologie de schéma répétitif : fixation, passion, mécanisme de défense, comportement sous stress ; ses flèches intégration/désintégration sont littéralement un chemin) — il donne à Anam une **hypothèse sur sa boucle dès le jour 1**.

### 5.5 Le rythme intégration → action

**Trop de prises de conscience d'un coup = on fonce dans le mur.** Il faut un temps d'**intégration**, puis le **passage à l'action**.

**Vie d'une branche en 3 temps** : (1) **naissance** = la prise de conscience ; (2) **feuillaison** = l'intégration (les semaines calmes) ; (3) **fruit** = le passage à l'action. Plusieurs branches à des stades différents → **l'arbre bouge toujours**.

- Ceci **bouche le trou des semaines calmes** : ce ne sont pas des semaines vides, c'est l'intégration. La branche ne naît pas finie.
- **Anam gardien du rythme** : si trop de branches ouvertes, il propose d'en faire vivre une avant d'en ouvrir une autre. C'est là que se branchent les **plans d'étapes** (intentions d'implémentation « si X alors Y »).
- **Risque nommé** : addiction à l'insight / bypass spirituel = collectionner les prises de conscience au lieu de changer.

---

## 6. L'agent Anam

- **Nom acté (provisoire)** : **ANAM** (d'*Anam Cara*, « ami de l'âme », gaélique). Changeable plus tard.
- **L'agent ne s'appelle PAS Anima** — décision tranchée : le personnage Anima reste sur le site web, pas dans l'app.
- **Formule de la voix** : **NEUTRE sur le jugement, CHALEUREUSE sur l'attention. Ni copine, ni robot.** Pas trop mystique, **tutoiement**, ton de coach de bien-être.

### Principes non négociables

| Principe | Règle |
|---|---|
| **Hypothèses, jamais verdicts** | « J'ai l'impression que… je me trompe ? » — anti-surinterprétation et garde-fou transparence |
| **Anti-sycophancie** | Une IA qui valide toujours **renforce** les schémas répétitifs : elle ne dégrade pas le produit, elle le **nie**. **La mémoire est l'antidote** : seule une IA qui se souvient peut dire « c'est la 3e fois que tu me racontes ça de la même façon » |
| **Se tromper est productif** | Chaque correction de l'utilisatrice augmente la précision — rendre la correction facile et bienvenue |
| **Règles de débit** | Jamais plus de **2-3 phrases** en conversation ; **jamais de listes à puces** ; pas de récapitulatif type « il semble que tu ressentes » ; pas de conclusion enveloppante ; varier la longueur (parfois 4 mots) ; **poser plus qu'affirmer** |
| **Anam sait se taire** | « On a beaucoup parlé, je te laisse respirer. » Combat la lassitude, montre du soin, coûte zéro token. Positionnement radical dans un marché qui optimise l'engagement |
| **Effet wouaw = auteur, pas imitation** | Ne jamais faire croire qu'Anam est humaine (interdit) mais faire sentir qu'elle est **écrite par une humaine**. Device : « Anima dit toujours que… » |
| **Précision = humanité** | Ce qui fait humain n'est pas la chaleur du ton mais **être rappelée exactement** (« tu m'avais dit que le mardi c'est la réunion qui te vide »). Générique = robot, spécifique = humain |

**Point de levier du produit (révisé et retenu) : LA JUSTESSE** = précision de l'analyse + concision du débit + exactitude de la mémoire. Les trois sont un seul levier.

### Le journal disparaît comme feature

Anam pose une question, elle répond. C'est une **conversation archivée**, pas une page blanche. Dissout la flemme ET la peur de l'écran blanc. **Les branches sont extraites de la conversation.**
Freins traités : la flemme, « parler à une machine », « pas assez proche ».
**Retournement clé** : la **neutralité de l'IA est un ATOUT** — on se confie plus à une machine qu'à un humain sur les sujets sensibles (désirabilité sociale réduite). La contrainte « l'app est froide » est devenue la douve.

---

## 7. Positionnement & douve

- **Séparation site / app (décision structurante)** : le **SITE WEB = Anima humaine** (médiumnité, elle derrière) ; l'**APP = automatisée, non humaine**.
- **Style de l'app** : **bohème chic / yogi** — délibérément différent de la charte existante (charte = référence, pas contrainte).
- **« Créé par Anima »** = transfert de crédibilité **et douve**. Si Anima est réellement l'auteure du corpus interprétatif (ses lectures, ses mantras, sa langue), ce n'est pas du marketing, c'est vrai, et **personne ne peut le copier**. Positionnement : *tu ne t'en remets pas à une IA, tu t'en remets à Anima — Anam est sa voix, disponible tous les soirs.*
- **Chantier identifié** : **capturer le corpus interprétatif d'Anima** = l'actif défendable du produit.
- **Pourquoi pas juste ChatGPT** : (1) mémoire **STRUCTURÉE** (branches nommées, datées, reliées au thème / ennéagramme / chemin de vie) et non un tas de notes ; (2) **PROACTIVE** (elle revient vers toi) ; (3) **INCARNÉE** (le corpus d'Anima) ; (4) avec un **BUT** (la légende personnelle).
- **Synergie business** : l'app ne doit **pas concurrencer** les consultations d'Anima, elle doit les **alimenter**. Une abonnée qui dépose depuis 6 mois est la meilleure cliente possible pour une vraie consultation. Frontière de marque site/app = **entonnoir économique**.

---

## 8. Modèle économique

| Palier | Contenu | Prix |
|---|---|---|
| **Gratuit — pour toujours** | Bibliothèque : thème natal, numérologie, horoscope calculé + **assez d'Anam pour atteindre la première branche** | 0 € |
| **Premium Anam** | Anam complet : mémoire longue, arbre, personnalisation | **69 €/an** (poussé) ou **11,99 €/mois** (volontairement peu attractif pour rendre l'annuel évident) |

- **Ne JAMAIS couper à zéro** : le gratuit continue, mais très limité.
- **Paywall AU JALON, pas au chrono** : demander après avoir livré une vraie valeur, pas après 7 jours. **Le jalon = SA PREMIÈRE BRANCHE** (première prise de conscience validée et nommée par elle) = pic de valeur ressentie. **Ne jamais interrompre le moment** : laisser la branche être à elle et **demander LE LENDEMAIN** — sinon effet trahison.
- **Réancrage du prix** : le comparateur n'est **pas** une app de méditation mais **une consultation de médium/astro en France (~50-120 € la séance)**. 69 €/an = moins d'une seule consultation pour une année entière d'accompagnement. Repères marché à vérifier : Petit BamBou ~6-8 €/mois, The Pattern ~5-8, Chani ~12.
- **Vendre l'ANNÉE** : l'arbre pousse sur un an, le produit **EST** un chemin.
- **Vente sur le WEB (Stripe, ~97 % net)** plutôt qu'en in-app iOS (Apple prend 15-30 %) — argument fort en faveur du web-first.
- **Économie de la marge** : le socle (thème, numérologie, horoscope) est du **calcul pur** (éphémérides + textes pré-écrits) = coût quasi nul ; **l'IA Anam est ce qui coûte, ce qui a de la valeur et ce qui est payant** — la frontière premium épouse naturellement la frontière du coût.
- **Ne pas dégrader la qualité d'Anam pour les gratuits** : leur seul échantillon détermine la conversion. Préférer **peu d'interactions excellentes** à beaucoup de médiocres. **Tiering par TÂCHE** (petit modèle pour le routinier, gros pour la détection d'insight et la synthèse hebdo), **jamais par utilisateur**.
- **Leviers de coût** : calcul déterministe pour astro/numérologie (zéro IA), tiering par tâche, cache des interprétations écrites une fois, prompt caching du contexte long, résumé glissant plutôt que renvoi de tout l'historique. *Modèles et prix exacts à vérifier en phase archi — ne pas citer de mémoire.*
- **Idée de bundle** (plus tard) : annuel + 1 consultation Anima.

---

## 9. La promesse et ses garanties

**Principe de craft** : **garantir ce que le PRODUIT LIVRE, jamais ce que l'UTILISATRICE DEVIENT.** C'est exactement la ligne qui sépare le développement personnel du médical.

> **PROMESSE FIGÉE : « Dans un an, tu sauras où tu vas — et pourquoi. »**

**Les 4 garanties (validées)** — « En un an, tu ne perdras rien de ce que tu auras compris » :
1. **Mémoire totale**
2. **Branches nommées, datées et relisables**
3. **Temps de rebond visible qui raccourcit**
4. **Le chemin reste consultable** (l'arbre ne régresse jamais)

**Garantie commerciale (validée)** : **si au bout de 3 mois tu n'as pas posé une seule branche, on te rembourse.** Le risk-reversal porte sur l'**artefact du produit** (la branche), jamais sur sa santé.

**Ce qu'Anam ne promet JAMAIS** : aucune prédiction d'avenir ; aucune garantie que ça ira mieux ; ne remplace ni thérapeute ni proche.

---

## 10. Périmètre v1 — MoSCoW

**Validé tel quel par Julian.**

### MUST (v1)

| # | Item |
|---|---|
| 1 | **Onboarding sans blocage** — ne jamais bloquer sur une donnée manquante ; dégradation gracieuse + demande différée |
| 2 | **Numérologie complète** (porte d'entrée : date + nom complet suffisent, aucune heure requise) |
| 3 | **Horoscope quotidien calculé** (le hook, coût quasi nul) |
| 4 | **Conversation quotidienne** — Anam pose une question, jamais de page blanche |
| 5 | **MÉMOIRE LONGUE STRUCTURÉE en 3 couches** (brut / faits extraits / branches) |
| 6 | **Détection de prise de conscience → branche proposée par Anam, validée et NOMMÉE par elle** |
| 7 | **Arbre visuel** (tronc + branches, ne régresse jamais, branches cliquables vers l'entrée source) |
| 8 | **Règles de voix** : débit court, hypothèses jamais verdicts, anti-sycophancie |
| 9 | **Transparence IA** (déclaration dès la première phrase) |
| 10 | **Lexique zéro médical** |
| 11 | **PROTOCOLE DE DÉTRESSE** (non négociable) |
| 12 | **Sécurité du journal** : chiffrement, RLS, export / suppression |
| 13 | **Paywall au jalon + gratuit à vie** |
| 14 | **Paiement web Stripe** |

### SHOULD (v1.1)

- Thème astral complet + **mécanique du tronc incomplet** (le tronc se complète visuellement quand elle ajoute son heure de naissance)
- Saisie **vocale → transcription**
- **Synthèse hebdomadaire**
- **Plans d'étapes** (intentions d'implémentation « si X alors Y »)
- **« Créé par Anima »** + device « Anima dit toujours que… »
- **Discrétion** : icône neutre, notifications neutres
- **Anam sait se taire**

### COULD (plus tard)

- Test d'ennéagramme complet, ou type inféré au fil des conversations et proposé en hypothèse
- Accueil en **tirage 3 cartes du jour** (on reçoit au lieu de chercher)
- Mantras
- Affichage du temps de rebond et de la granularité émotionnelle
- Vie de branche en 3 temps (feuillaison, fruit)
- Bundle consultation Anima
- Mood explicite
- « Les petits bonheurs »

### WON'T (this time) — écartés explicitement, avec raison

| Écarté | Raison |
|---|---|
| **Mini-jeux / gamification / points / streaks** | Effet de surjustification : les récompenses extrinsèques **érodent la motivation intrinsèque**. Un streak punit ; l'arbre remplace |
| **Score de résilience** | Un score qui baisse fait se sentir raté. Préférer un **miroir descriptif, jamais une note** |
| **App mobile native** | Web-first (marge Stripe ~97 % vs 15-30 % Apple) |
| **Backend Railway** | **À justifier — Supabase suffit probablement** |
| **Inférence émotionnelle depuis la voix** | Science contestée + catégorie sensible en régulation IA. Ne stocker que la **transcription**, supprimer l'audio |
| **Régression de l'arbre** | Malhonnête et punitif |
| **Le personnage Anima comme mascotte de l'app** | Anima reste humaine, sur le site. L'app est explicitement non humaine |

---

## 11. Garde-fous & conformité

- **Transparence IA (AI Act UE)** : déclarer qu'Anam est une IA **dès la première phrase** de l'onboarding — c'est l'endroit naturel.
- **Ne jamais faire croire qu'Anam est humaine.** Faire sentir qu'elle est **écrite** par une humaine, c'est autorisé et c'est l'effet wouaw.
- **Lexique**
  - **AUTORISÉ** : clarté, chemin, comprendre, avancer, se connaître, prise de conscience, accompagnement, bien-être, équilibre, objectifs, se réaliser.
  - **INTERDIT** : guérir, soigner, traiter, thérapie, dépression, anxiété, diagnostic, symptôme, santé mentale, « réduire le stress de X % ».
  - Les claims santé font **rejeter en review App Store** et sont réglementés en UE : le lexique protège le lancement.
- **Protocole de détresse** — MUST non négociable. Le produit repose sur une personne seule qui se confie à 23h ; ce point n'a été identifié qu'en fin de séance et doit être conçu explicitement.
- **Données ultra sensibles** : le journal impose chiffrement, RLS Supabase, export et suppression.
- **Voix** : ne stocker que la transcription, supprimer l'audio, **ne pas inférer l'émotion depuis la voix**.
- **Jamais de score, jamais de note** — miroir descriptif uniquement.
- **Anam propose, l'utilisatrice valide et nomme** — évite l'IA présomptueuse et nourrit son besoin d'autonomie.
- **Honnêteté comme signature** : « je préfère ne pas te la deviner plutôt que te raconter n'importe quoi ».

---

## 12. Questions ouvertes / à valider

| Sujet | À faire |
|---|---|
| **Prix (69 €/an)** | Hypothèse non validée. Validation la moins chère = **demander aux vraies clientes d'Anima** |
| **Analyse économique / concurrence** | **Prochaine étape demandée par Julian** (très flou côté Julian et Anima) → skill `bmad-market-research`. Vérifier repères FR : Petit BamBou, The Pattern, Chani |
| **Nom « Anam »** | Provisoire. Vérifier disponibilité (marque, domaine, App Store) |
| **« Les petits bonheurs »** | Mot de Julian, réponse directe à sa propre peur, **jamais conçu**. C'est ce qui doit **habiller les semaines d'intégration**. Priorité pour une prochaine session |
| **Backend Railway** | À justifier — **Supabase suffit probablement** |
| **Modèles IA et coûts exacts** | À vérifier en phase architecture, **ne pas citer de mémoire** |
| **Corpus interprétatif d'Anima** | Chantier de capture à lancer (lectures, mantras, langue) — c'est l'actif défendable |
| **Boucle B1 (l'absence)** | Semaine chargée → elle ne vient pas → Anam perd le fil → la reprise est gênante (« j'ai rien à dire ») → décrochage. Contre-mesure à concevoir (la mécanique d'intégration y répond partiellement) |

---

## 13. Persona de référence

**Camille, 34 ans, Lyon.** Chargée de com essorée, séparée il y a 8 mois, suit des comptes astro sur Insta, a déjà consulté une médium, a abandonné Petit Bambou. Elle veut comprendre **pourquoi ça recommence toujours pareil**.

Trois angles morts qui deviennent des exigences produit : **la honte** (elle n'en parle pas à ses collègues → discrétion de l'icône et des notifications) ; **l'heure de naissance** qu'elle ne connaît pas (→ jamais de blocage, numérologie en porte d'entrée, tronc incomplet qui se complète) ; **elle arrive échaudée** (→ le churn est son vécu, pas une hypothèse).
