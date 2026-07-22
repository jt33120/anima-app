---
title: "Intention — Publication sociale Anima / Anam"
status: draft
created: 2026-07-21
source: _bmad-output/brainstorming/brainstorm-publication-anima-2026-07-21/.memlog.md
---

# LA DÉCISION CENTRALE

Anima publie sous un personnage récurrent au visage jamais montré, et c'est **l'eau qui parle, pas Anima** — cette métaphore est le moteur éditorial, pas une image de marque.
Le format principal est le **carrousel** (Instagram + cross-post photo TikTok), pas le reel : c'est le format le plus performant sous 5K abonnés.
Le coût d'Anima passe d'un coût hebdomadaire érodable à un **coût unique en amont** (session corpus 4h) + ~15 min/semaine de validation ; nous produisons, elle valide et poste.

# LE PERSONNAGE — CE QUI EST TRANCHÉ

- **Charte conservée** : `docs/anima-contexte.md` reste la référence (traits, palette hex, §7 poses, §8 direction animée). La refaire coûterait des mois pour rien ; c'est déjà la marque du compte.
- **Visage jamais montré** : de dos, de profil, yeux clos, hors cadre (§7 suggère déjà « de dos face à la lune »). Résout d'un coup trois problèmes : neutralité (plus de sourire approbateur, qui est un jugement en image), coût de production, et cohérence sérielle (la dérive de visage est le premier mode d'échec de la génération d'images IA sur 50 visuels).
- **L'eau parle, pas Anima** : Anima est dans le cadre, la phrase inconfortable est prononcée par le comportement de l'eau. C'est la **garantie mécanique de neutralité** : on peut dire une chose très dure sans qu'aucun jugement soit porté. Effet de bord : le lexique se protège seul — « toxique », « dépendance » sont des verdicts sur une personne, l'eau n'a pas d'avis.
- **Deux surfaces, deux règles** : pastel = compte social d'Anima (marque existante) ; terracotta mat = app Anam, qui n'a **aucun** personnage (inchangé). La divergence de DA sert la doctrine site-humaine / app-automatisée au lieu de la trahir. Conflits A (personnage) et B (palette) tranchés ainsi.
- **Vocabulaire** : développement personnel en surface, astrologie en profondeur. Le nom choisi par Anima, « Éveil et Retour à soi », est déjà le positionnement optimal.

# LES 3 SÉRIES RETENUES (une par fonction)

| Série | Fonction | Propriété |
|---|---|---|
| **L'EAU** | le moteur | volume infini, zéro corpus requis, démarre immédiatement ; fonctionne sur l'amour (77%) comme sur le travail (73% des <35 ans) |
| **ELLE M'A DEMANDÉ** | la preuve | incopiable, alimentée par le corpus, seule vraie réponse à la peur du charlatan (92% chez les 25-34) |
| **TON THÈME NE DIT PAS ÇA** | le crochet | format à opinion, donc partageable ; va chercher les non-abonnés |

Entonnoir : le crochet amène, le moteur retient, la preuve fait confiance. **24 épisodes = 12 semaines à 2 publications.**
Réserve non retenue ce cycle : La troisième fois ; Le mot que tu répètes ; Ce que je refuse de dire ; Les semaines où il ne se passe rien ; L'heure que tu ne connais pas.

# LE MODÈLE OPÉRATOIRE

1. **Session corpus unique, ~4h avec Anima** (GO donné) : sa façon de lire, ses phrases, ses refus, ses histoires de consultation anonymisées. Tout est généré DEPUIS ce corpus — donc c'est sa voix. Cette session planifie enfin le point §9.3 de l'addendum resté ouvert.
   Un seul investissement, trois problèmes résolus : (a) actif défendable du projet, (b) réponse au risque charlatan, (c) protection algorithmique contre la règle Instagram du 30/04/2026.
2. **Nous produisons** (personnage, séries, textes, prompts). Julian ne génère pas le créatif ; il pilote objectif des posts, fréquence, automatisation, prompts Claude Design.
3. **Anima valide en lot (~15 min/semaine) et poste.**
4. **Tampon de 3 semaines d'avance** en permanence : son absence ne bloque jamais le canal.
5. Le **post** fait la portée et l'accroche (aucune capture d'email dedans, ça dégraderait le contenu) ; le **profil** convertit (bio, lien, post épinglé, canal de diffusion) — construit une fois, zéro minute/semaine.
6. **Livrables Claude Design séquencés** : ordre des prompts + références à joindre à chaque étape + grille de validation par sortie. Pas de prompt unique. Cron : Vercel Cron ou GitHub Action suffisent.

# LES FAITS DE PLATEFORME QUI COMMANDENT LES CHOIX

- **Carrousel > reel sous 5K abonnés** (Socialinsider, 35M posts : 993 vs 580 vues, images 417) → le format principal est le carrousel ; le conseil « fais des reels » est calibré sur les gros comptes.
- **Sends per reach = signal des non-abonnés** (Mosseri, 22/01/2025 : watch time, likes, sends ; sends « slightly more important for unconnected content ») → le CTA est « envoie ça à quelqu'un », jamais « enregistre » ni « commente ». Le multiplicateur 3-5x qui circule est du folklore.
- **Hashtags : -31,70% de vues, -33,89% d'interactions** (Metricool, 24,4M posts) → supprimer les hashtags, écrire pour la recherche par mots-clés dans la légende (<30 mots).
- **Second chance : le carrousel non swipé est remontré en démarrant à la slide 2** (Mosseri, oct 2024) → la slide 2 doit être un hook autonome et compréhensible seul (le retournement, pas la suite).
- **Contenu non-original exclu des recommandations depuis le 30/04/2026** (règle étendue aux photos/carrousels ; sanction = exclusion d'Explore/Reels, pas des abonnés) → le corpus d'Anima est une protection algorithmique. NB : le label « AI Creator » (mai 2026) n'affecte pas la distribution.
- **Faceless = format natif du créneau, pas un pis-aller** (@notallgeminis 0→347k en 11 mois, ~522k aujourd'hui ; @alicecartomagie en FR, sans visage, 17k→37,6k en 22 mois) → l'anonymat n'est pas un handicap.
- **TikTok domine le créneau FR** (mêmes créateurs 4x à 32x plus gros : @lesguidancesdesaturne 92 300 vs 2 846 ; @saralouvoyance 18 600 vs 965) → cross-poster systématiquement, coût marginal quasi nul, laisser la mesure trancher à 3 mois. Nuance : panel tarot/voyance ; en astro pure Instagram tient (Astrotruc 260-360k, Sisters Astro 185k).
- **#developpementpersonnel 5 061 387 posts = 13x #astrologie 393 662** (et #bienetre 7,89M) → réservoir d'audience FR = développement personnel. Le français est une langue de masse en dev perso, de niche en astrologie.
- **#astrologue : 9 087 posts mais 1 558 likes / 21 commentaires de moyenne** → tag des prescripteurs, pas du public. À travailler pour toucher le milieu.
- **Rythme 3-5 posts/semaine** (Buffer, 2,1M posts, effets fixes) ; sous 2/sem on perd la moitié de la croissance ; la pénalité d'irrégularité est réelle mais faible (0,08 σ).
- **Créneaux FR mardi/mercredi 12-14h et 18-21h** — mais l'audience astro est week-end (+4 à +5 pts) et l'ennéagramme semaine ouvrée (lundi 106 / samedi 91). Deux publics, deux rythmes.
- **Question dans le post : +36,70% de commentaires ; CTA orienté commentaire : +202,78%** (Metricool). Légendes courtes (<30 mots) > longues (Socialinsider, 9,1M posts).
- **Format-pivot du créneau : « les énergies du mois »** — utilisé par tous les acteurs FR actifs. Squelette calendaire à reprendre.
- **La newsletter est le canal le plus vide en francophone** (une seule newsletter astro FR indépendante identifiée) → c'est le canal adressable qui manquait, avec avantage concurrentiel.
- **Plafond de verre francophone ~250k** ; cœur de marché 15k-90k. **Churn extrême** : 4 comptes sur ~20 ont disparu en quelques mois (dont un à 79 300) → re-mesurer toute base de créateurs trimestriellement.
- **Données inexistantes, à ne pas inventer** : nombre optimal de slides, taux de complétion par slide, design de la slide 1, typographique vs illustré. Seule voie : tester en comparant sends/reach et saves/reach.

# LES DATES QUI COMMANDENT LE CALENDRIER

- **12 août 2026 — ÉCLIPSE TOTALE DE SOLEIL. Priorité n°1.** Première totale en Europe depuis 1999. En France partielle : Paris 92,1%, Biarritz 99,4%, max vers 20h17-20h30. Demande déjà +173% en 20 jours ; l'article éclipse pèse ~20x l'article astrologie. Plus gros rendez-vous mesurable de l'année, dans 3 semaines.
- 26 juillet 2026 : nœud Nord en Verseau.
- 28 août 2026 : éclipse lunaire.
- 24 oct – 13 nov 2026 : chevauchement Vénus R + Mercure R → pic éditorial d'automne.
- 24 décembre 2026 : superlune.
- Janvier 2027 : pic saisonnier réel (mois le plus fort 4 années sur 5, +45% à +115% vs creux) + Mars R du 10 janv au 1er avril (81 jours, tous les 2 ans).
- **Septembre est le creux annuel** → abandonner l'hypothèse « pic de rentrée ».
- Socle permanent : 12-13 lunaisons/an, requêtes systématiquement datées.

# CE QUI EST REPOUSSÉ

- **Les reels animés** (renversement majeur de la séance). Le carrousel fait 1,7x plus de vues à cette taille de compte et le kit d'animation coûte cher avant de produire. Le kit personnage sert d'abord aux carrousels. La vidéo revient quand le compte prouve qu'il grandit. Note : l'animation image par image de @1924us (illustrateur pro plein temps) est hors de portée d'un facteur 20-30 ; la cible serait de l'animation limitée/découpée (8-12 poses, 15-25 min/reel).
- **Le pipeline API Instagram.** Rien à gagner sans volume ni tampon : 4 semaines à la main d'abord. Contraintes connues : pas de planification native, pas de son du catalogue via API (donc tout reel à son tendance se poste à la main), carrousels/images pleinement automatisables, pas d'App Review nécessaire (mode dev + rôle testeur, Instagram Login). L'API ne devient utile que si Anima valide EN LOT et que le système publie ensuite seul.

# CE QUI EST ÉCARTÉ

- **Trial Reels** — réservé aux comptes ≥1000 abonnés.
- **Mesure des hashtags via TikTok Creative Center** — outil fermé sans compte pub.
- **Objectif d'audience à 6 chiffres** — plafond francophone ~250k jamais franchi sur ce créneau en FR ; viser 250k est hors-sol.
- **« Anima peut être dure »** — refusé. Anima = neutralité, zéro jugement. La franchise passe par la structure (l'eau), pas par le ton. Cohérent avec anam-voice §2 (neutralité = formule mère) et §4.2 (confrontation documentaire, jamais morale).

# POINTS OUVERTS ET CORRECTIONS À FAIRE AILLEURS

1. **Corriger le brief** : il avance 76% de croyance chez les femmes 25-34 ans. La source primaire IFOP (terrain 28-29 avril 2022, n=1012, crosstabs bruts) donne **50% chez les 25-34 tous sexes** et **54% chez les femmes tous âges** ; le croisement femme × 25-34 n'est pas publié et **s'estime à 60-65%**. À re-sourcer ou corriger. Autres chiffres IFOP fiables : 44% des Français croient à l'astrologie (33% en 2000), 64% lisent leur horoscope, 17% ont consulté un voyant (femmes 22%), mais **seulement 5-7% modifient leurs projets** → usage ludique et introspectif, pas décisionnel : valide le refus de la prédiction.
2. **Phase 0 du brief à amender** : l'action « mesurer la volumétrie des hashtags dans TikTok Creative Center » n'est plus réalisable (vérifié 22/07/2026 : plus d'objet challengeInfo, API fermée sans compte pub). Tout chiffre « #astrotok = X milliards » est gelé d'avant 2024 ou inventé.
3. **Modèle économique à débattre (hors périmètre de cet atelier, à remonter)** : le 69 €/an mérite d'être challengé. En France le **paiement à l'acte domine** — Sisters Astro (SAS, 3-5 salariés, 185k abonnés) fait 100-200 questions/jour à 20-45 € via hotline ; monétisation dominante observée en bio FR = DM/WhatsApp → consultation privée + lives ; **aucune app, aucun abonnement**. Aucune preuve de traction du modèle Co-Star/CHANI en France (Co-Star 2 822 notes FR vs 205 406 US = 1,4% ; CHANI 259). Contexte favorable au produit malgré tout : Co-Star n'est toujours pas traduite en français et les avis FR le réclament ; aucune app FR premium éditorialisée n'existe.
4. **AI Act art. 50, applicable au 2 août 2026** (dans 12 jours) : obligation de marquage des contenus synthétiques image/vidéo. Portée réelle pour une créatrice individuelle **à faire vérifier par le juriste déjà prévu au brief**.
5. **Signal contraire à intégrer** : le marché FR est en reflux sur ses canaux mesurables — livre ésotérique -7,6% en valeur (GfK/Livres Hebdo, oct 2023-sept 2024) après -2,7% ; Wikipedia FR janv 2022→janv 2026 : Astrologie -58%, Ennéagramme -66%, Voyance -69%. Une part est un effet de plateforme (IA, SGE), mais l'ampleur dépasse le déclin global de Wikipedia.
6. **Ennéagramme — hypothèse « angle mort du marché » FAUSSE en notoriété** (2 014 vues/mois Wikipedia FR juin 2026 = ~4,4x le MBTI, ~la moitié de l'astrologie). L'angle mort est de **registre** : l'offre FR est institutionnelle/formation, la demande est appliquée et relationnelle (Google Suggest « ennéagramme type 4 » : métier, couple, amour, compatibilité, blessure, évolution). Porte d'entrée = un **test gratuit**.
7. **Comportement le mieux validé par la donnée : la compatibilité** — 41% des 25-34 ans demandent le signe d'une personne rencontrée, 33% pour un partenaire durable (51% / 41% chez les 18-24). C'est aussi le moteur viral de Co-Star. À exploiter côté produit et côté social.
8. **Risque de connotation** : le champ lexical « ce que ton astrologue ne te dira jamais » est aujourd'hui squatté par l'apologétique évangélique (BLF) et le SEO putaclic de cabinets de voyance. Le reprendre exige une signature visuelle et tonale très distincte.
9. **Piège ASO** : sur l'App Store FR, « tarot » remonte quasi exclusivement des jeux de cartes (Tarot Classique Multijoueur : 36 449 notes). Utiliser **cartomancie, oracle, tirage** — jamais tarot seul. Hashtags réels FR : #spiritualite 498k, #astrologie 394k, #voyance 156k, #cartomancie 61k, #zodiaque 52k, #signeastrologique 48k, #guidancedujour 18k, #themeastral 2,4k. Les tags « nationalisés » (#astrologiefrancaise, #astrologiefr, #numerologie, #themenatal) n'existent pas. Poster les deux graphies (accentuée et non).
10. **La place est libre, confirmé** : aucun compte FR dont l'identité éditoriale soit « praticienne qui critique l'astro pop ». Bret-Morel critique en ayant quitté l'astro (public zététique masculin 35-55) ; Camille Teste est l'analogue structurel pour le yoga — il n'existe pas en astrologie.
11. **Modèle atypique à étudier** : @roseligoul (Elina, citée par Konbini) — tirage hebdomadaire par signe, vidéos d'1h-1h30, distribuées par WeTransfer via mailing-list, croissance par bouche-à-oreille. Newsletter-first dans le créneau exact. Existence actuelle du compte non confirmée.
