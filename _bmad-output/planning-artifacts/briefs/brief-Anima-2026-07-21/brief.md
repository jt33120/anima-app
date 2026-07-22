---
title: "Product Brief — Anam"
status: draft
created: 2026-07-21
updated: 2026-07-21
---

# Product Brief : Anam

> **Boussole interne pour Julian et Anima.** Document de décision, pas de vente.
> Détail, chiffres et alternatives écartées : voir `addendum.md`. Historique des décisions : `.memlog.md`.

## Résumé exécutif

**Anam est une compagne d'introspection qui refuse de dire à ses utilisatrices ce qui les arrange.**

Elle ouvre par une **séance** — une vraie conversation, pas un questionnaire — au terme de laquelle elle dit à l'utilisatrice une chose vraie, précise et légèrement inconfortable que personne n'avait osé formuler. Puis elle se souvient : six semaines plus tard, elle peut remarquer que c'est la troisième fois que la même histoire est racontée de la même façon.

Le socle spirituel — thème natal, numérologie, ennéagramme, horoscope — n'est pas le produit : c'est le **cadre de lecture**, calculé, gratuit, sans coût marginal. Le produit, c'est la relation dans la durée, matérialisée par un **arbre** dont chaque branche est une prise de conscience nommée par l'utilisatrice elle-même.

Anam est construite par un développeur et une praticienne. **Le pari n'est pas technique. Il est de savoir si une voix qui refuse de flatter trouve un public.**

## Le problème

Camille, 34 ans, séparée depuis huit mois, suit trois comptes d'astrologie et a déjà abandonné une app de méditation. Elle veut comprendre pourquoi « ça recommence toujours pareil ». Elle a trois options, toutes mauvaises :

- **L'horoscope** lui envoie le même texte qu'à trois millions de personnes. Elle décroche en cinq jours.
- **La consultation** coûte 50 à 120 € la séance, et 85 % des gens comme elle redoutent de tomber sur un charlatan — 92 % dans sa tranche d'âge.
- **ChatGPT**, qu'elle utilise déjà pour ça — comme un Français de moins de 25 ans sur deux — lui donne raison. Toujours. Ce qui renforce exactement le schéma qu'elle voudrait rompre.

Aucune ne l'aide : aucune ne la connaît, et aucune n'ose la contredire.

## La solution

**La première séance.** Pendant douze à vingt minutes, Anam construit, observe, puis nomme — *« Tu comprends très bien pourquoi les choses t'arrivent. J'ai l'impression que ça t'évite d'avoir à les ressentir. »* La valeur arrive **pendant** l'échange, jamais seulement à la fin. Et c'est **Anam qui décide que la séance est finie**.

**Ensuite, la durée.** Anam pose une question, Camille répond. Le journal n'existe pas comme fonctionnalité : c'est une conversation archivée. Quand quelque chose bascule, Anam **propose** — jamais ne décrète — d'en faire une **branche**, que Camille valide et nomme. L'arbre pousse et ne régresse jamais. Chaque branche renvoie à ses propres mots, datés.

## Ce qui rend ce produit différent

1. **Une douleur réelle, pas une fonctionnalité.** Les gens se plaignent spontanément que l'IA leur raconte ce qu'ils veulent entendre ; personne ne réclame « de la mémoire ».
2. **Quelqu'un derrière.** Anima est identifiée : c'est la seule réponse à la peur du charlatan. L'application la plus chère du secteur est portée par une praticienne nommée.
3. **Une séance, pas un chatbot.** L'arc construire → observer → nommer → clore relève du soin, pas de la technique : il ne se clone pas en un week-end.
4. **Le français.** Le leader mondial récolte 2 800 avis en France sans proposer une ligne de français.
5. **Le refus.** Anam sait se taire, ne promet pas le bonheur, et ne cherche pas à retenir.

## À qui il s'adresse

**Les femmes de 25 à 34 ans** — le pic statistique absolu de l'adhésion aux parasciences en France, et deux fois plus de consommatrices actives que la moyenne nationale.

Plus précisément, celles qui **y croient à moitié** : elles pratiquent plus qu'elles ne l'assument, et n'en parlent pas au bureau. C'est le profil majoritaire, pas une niche, et il impose une conséquence directe : **la discrétion est une exigence fonctionnelle** (nom, icône, notifications), pas un raffinement.

## ⚠️ Le vrai risque

**Il n'y a pas encore d'audience.** L'acquisition payante est structurellement non rentable à ce prix, et l'audience d'Anima est embryonnaire : **le projet n'a pas de canal de distribution.** C'est exactement ce qui a tué son plus proche prédécesseur : bon produit, personne à qui le montrer.

**D'où la décision structurante de ce brief : la distribution n'est pas une phase qui suit le produit — la distribution *est* le projet.**

La ressource rare n'est pas l'ingénierie : le développement est assisté par IA et ne coûte presque rien. **C'est l'attention.** Anam et son audience se construisent donc **en parallèle**, avec un garde-fou non négociable : Anima publie à un rythme fixe quoi qu'il arrive côté développement, et **un point de contrôle à trois mois** décide si l'on continue à construire.

L'actif décisif est déjà là, et il est gratuit : **le positionnement est un angle de contenu.** *« Ce que ton astrologue ne te dira jamais »* se remarque immédiatement face aux comptes qui promettent monts et merveilles. **La voix construite pour Anam est d'abord celle qu'Anima doit prendre en public.**

## Critères de succès

**Premier jalon : dix personnes qui paient et qui reviennent.** Pas cinq cents. Dix. Avec dix abonnées qui ouvrent Anam chaque semaine, le produit est prouvé. Avant ça, tout le reste est une projection.

| Indicateur | Seuil ou cible |
|---|---|
| Signal d'audience à 3 mois | croissance réelle, sinon on arrête de construire |
| Achèvement de la première séance | à maximiser — c'est là que tout se joue |
| Conversion téléchargement → payant | ≥ 2,9 % |
| Note App Store | ≥ 4,0, jamais sous 3,5 |
| Renouvellement annuel | > 60 % |

## Périmètre v1

**Dedans.** Onboarding sans blocage (heure de naissance optionnelle) · numérologie complète · horoscope calculé · **la première séance** · mémoire longue structurée · détection et proposition de branches · l'arbre · les règles de voix · protocole de détresse · sécurité du journal · paywall en fin de première séance · paiement web via Stripe.

**Dehors, et assumé.** Gamification, points, séries et scores — contre-productifs et documentés comme tels · application mobile native — le web d'abord · backend séparé tant que Supabase suffit · inférence d'émotion depuis la voix · régression de l'arbre · le personnage Anima comme mascotte de l'application.

## Garde-fous non négociables

- **Zéro vocabulaire médical.** Ce n'est pas seulement de la conformité, c'est une condition d'existence : les acteurs qui ont franchi cette ligne se font poursuivre.
- **Anam propose, l'utilisatrice dispose.** Des hypothèses, jamais des verdicts. Aucun score.
- **Consentement explicite RGPD article 9** sur un écran dédié, séparé des conditions générales — ce même écran porte la déclaration IA obligatoire.
- **Protocole de détresse** validé par un professionnel qualifié avant toute mise en ligne.
- **Immersif, jamais captif.** Anam clôt les séances elle-même.

## Préalables avant de coder

1. ✅ Anima publie — **la tâche numéro un est en cours**. À maintenir à rythme fixe jusqu'au point de contrôle des trois mois.
2. Faire valider par un juriste l'écran de consentement et créer l'entité qui encaissera les abonnements.
3. Vérifier la disponibilité du nom *Anam* (domaine, INPI, stores).
4. Enregistrer le corpus d'Anima : sa façon de lire un thème, ses mots, ses refus.
5. Mesurer un coût par installation réel en France — un budget de test de cent à trois cents euros suffit.

## Vision

Si le pari tient, Anam devient **la référence francophone d'un accompagnement spirituel qui ne ment pas**, et Anima la praticienne dont la voix est reconnaissable. L'application n'a pas vocation à remplacer ses consultations : elle les précède, les prolonge, et fait connaître sa manière de voir. Le produit et la praticienne grandissent ensemble.

**C'est un tremplin, pas une sortie.**
