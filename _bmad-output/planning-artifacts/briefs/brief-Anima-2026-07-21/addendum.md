---
title: "Addendum — Product Brief Anam"
status: draft
created: 2026-07-21
updated: 2026-07-21
---

# Addendum au Product Brief — Anam

Ce document recueille la profondeur qui n'a pas sa place dans un brief d'une à deux pages, mais qui doit survivre jusqu'aux documents suivants (PRD, UX, architecture). Le brief reste la boussole ; ceci est la soute.

**Sources amont** — tout ce qui suit en découle ; les citations complètes s'y trouvent :
- `_bmad-output/brainstorming/brainstorm-anima-app-2026-07-20/brainstorm-intent.md`
- `_bmad-output/brainstorming/brainstorm-anima-app-2026-07-20/anam-voice.md`
- `_bmad-output/planning-artifacts/research/market-anam-spiritualite-coaching-ia-france-research-2026-07-21.md`

---

## 1. La première séance — spécification détaillée

**Durée cible : 12 à 20 minutes.** Trois minutes ne suffisent pas à mériter l'observation finale ; vingt-cinq à trente ne s'imposent pas. Repère de marché : la session médiane d'une app de méditation est de ~12 minutes.

**Contrainte absolue : la valeur arrive pendant, jamais seulement à la fin.** Camille (persona de référence, §4) doit recevoir des « ah, c'est vrai » en chemin. Sans cela, la séance devient une falaise de vingt minutes où tout abandon avant la fin est une perte sèche.

**L'arc de la séance — trois temps, puis la clôture**

| Phase | Ce que fait Anam |
|---|---|
| **Construire** | Elle la fait parler. Questions ouvertes, pas de QCM. Chaque réponse nourrit la suivante |
| **Observer** | Elle relie, elle reformule, elle vérifie. C'est ici que se gagne le droit de nommer |
| **Nommer** | L'observation vraie et légèrement inconfortable. Jamais avant d'avoir mérité ce droit |
| **Clore** | *« On en a assez fait pour ce soir. »* C'est Anam qui met fin, jamais l'inverse |

**Pourquoi l'arc est obligatoire.** L'observation finale prononcée à la deuxième minute, c'est de la voyance de comptoir. À la quatorzième, après que Camille a parlé, c'est une observation fondée. **La durée n'est pas un confort d'expérience : c'est ce qui rend la phrase légitime.**

**La phrase de référence, retenue le 21/07/2026 :**

> *« Tu comprends très bien pourquoi les choses t'arrivent. J'ai l'impression que ça t'évite d'avoir à les ressentir. »*

Elle fixe la barre pour tout le produit : une phrase vraie, précise, formulée en hypothèse, réfutable, et **sans flatterie finale**.

**Le repli obligatoire.** Anam se trompera parfois, ou touchera un point sensible. Elle doit pouvoir reculer **sans retomber dans la flatterie** : jamais *« pardon, tu as tellement raison »*, mais *« D'accord. Alors dis-moi comment tu le vois, toi. »* La correction devient de la matière, pas une excuse.

**Le paywall** se cale à la fin de la séance, sur un bilan livré — donc à J0. Justification en §2.

---

## 2. Alternatives écartées, et pourquoi

| Écarté | Raison |
|---|---|
| **Paywall « demandé le lendemain »** | Décision d'idéation, invalidée par les données : **89,4 % des essais démarrent à J0**, 86,1 % pour cette catégorie, presque rien entre J1 et J3. Attendre le lendemain revenait à renoncer à l'essentiel de la fenêtre de conversion, sans budget d'acquisition pour compenser. **Résolu en dissociant deux jalons : la valeur — le bilan, livré en séance 1 — et la première branche, qui reste un moment de fidélisation.** |
| **Entonnoir commercial app → consultation** | Recommandation initiale de l'analyse, **écartée par Anima**, qui souhaite préserver une distinction nette entre son site (elle, humaine) et l'app (automatisée). Le lien subsiste en version douce : une utilisatrice qui lit « créé par Anima » tous les jours trouvera le site d'elle-même. |
| **Mini-jeux, points, séries, scores** | Intuition initiale de Julian, confirmée par la recherche : les récompenses extrinsèques érodent la motivation intrinsèque, et une méta-analyse conclut que les apps gamifiées dédiées à la dépression ne produisent **ni meilleure adhérence ni meilleure efficacité**. Un score de résilience qui baisse un mauvais jour ajoute de la honte à la souffrance. |
| **« Elle se souvient de toi » comme message d'acquisition** | La mémoire longue est devenue un **standard gratuit** en douze mois (OpenAI « Dreaming » juin 2026, rappel factuel 82,8 % ; Claude gratuit depuis ~mars 2026). Et ce n'est **pas une douleur verbalisée** : elle apparaît en éloge chez les concurrents qui la proposent, jamais en grief chez ceux qui ne la proposent pas. Conservée comme moteur de rétention et comme *preuve* de l'honnêteté — un chatbot sans mémoire ne peut pas être franc, il n'a rien à quoi comparer ce qu'il entend. |
| **Le personnage Anima comme mascotte de l'app** | La séparation site/app l'interdit. Par ailleurs, la recherche montre que la divulgation de soi augmente avec **l'anonymat perçu**, pas avec le réalisme : un avatar hyper-humanisé pourrait *réduire* l'honnêteté des échanges. |
| **Questionnaire d'onboarding à 18-30 écrans** | Pattern dominant du marché (Noom, Nebula), mais **sans aucune preuve causale publiée**. Remplacé par la conversation, qui différencie davantage et récolte une matière first-party plus riche. Règle conservée : tout écran dont la réponse ne réapparaît nulle part est du pur coût de friction. |

---

## 3. Pourquoi ce projet peut dépasser son prédécesseur

**Nummi** — astrologie védique + « mémoire cognitive », 7,99 $/mois, ~6 200 téléchargements cumulés (~17/jour) malgré une production SEO intensive. Société, équipe et financement introuvables.

Cinq mécanismes différenciants, chacun opposable à une faiblesse identifiée :

1. **Ils vendaient une fonctionnalité, Anam vend une phrase.** « Mémoire cognitive » ne correspond à aucune demande exprimée ; « elle ne te dit pas ce que tu veux entendre » répond à une douleur que les gens formulent spontanément.
2. **Ils étaient anonymes, Anima est identifiée.** Dans un marché où 92 % des 25-34 ans redoutent le charlatan, l'anonymat est disqualifiant. Le modèle de la praticienne nommée soutient le prix le plus élevé du marché.
3. **Ils faisaient du SEO, ce projet vise une audience.** Dix-sept téléchargements par jour, c'est le rendement du SEO grand public. Une audience engagée convertit à plus de 10 % contre 2 %.
4. **Ils étaient génériques, Anam est française.** L'astrologie védique auprès d'un public occidental est une niche dans une niche.
5. **Ils avaient un agent conversationnel, Anam a une séance.** L'arc en trois temps, avec clôture par l'agent, relève du soin et non de la technique — c'est la seule barrière réelle.

**La leçon principale n'est cependant pas différenciante mais structurelle** : Nummi avait le produit et personne à qui le montrer. C'est une preuve sur la distribution, pas sur le concept. Cette leçon justifie à elle seule la priorité donnée à l'audience dans le brief.

**Contre-exemple utile apporté par Julian** : dans l'IA grand public, arriver second avec une meilleure exécution est un chemin éprouvé — le premier prouve la demande, le second gagne, et presque toujours sur la distribution et le soin, pas sur l'idée.

---

## 4. Persona de référence

**Camille, 34 ans, Lyon.** Chargée de communication dans une entreprise qui l'épuise. Séparée depuis huit mois. Suit trois comptes d'astrologie, a consulté une médium deux fois, a téléchargé une app de méditation en septembre et ne l'a plus ouverte depuis novembre.

- **Ce qu'elle cherche sans l'avoir formulé** : comprendre pourquoi ça recommence toujours pareil.
- **Ce dont elle ne parle à personne au bureau** : qu'elle y croit un peu.
- **Ce qu'elle a déjà** : ChatGPT, gratuit, dans sa poche, qui lui donne raison.

**Trois angles morts qu'elle révèle immédiatement**
1. **La honte.** Nom sur l'écran d'accueil, icône, notification lue par-dessus l'épaule en open space. La discrétion devient une exigence produit.
2. **L'heure de naissance.** Un thème précis l'exige ; la plupart des gens ne la connaissent pas. Ne jamais bloquer : la numérologie est complète sans elle, et Anam indique où la trouver (copie intégrale d'acte de naissance, gratuite en mairie du lieu de naissance).
3. **Elle arrive échaudée.** Le décrochage n'est pas une hypothèse pour elle, c'est un souvenir.

---

## 5. Contexte de prix

Relevés sur les fiches App Store françaises le 21/07/2026 (EUR TTC) :

| App | Mensuel | Annuel |
|---|---|---|
| Calm | ~12,99 € | ~49,99 € |
| Headspace | 12,99 € | 57,99 € |
| **Petit BamBou** | 9,99 € | **69,99 €** |
| The Pattern | — | 83,99 € |
| **CHANI** | 13,49 € | **109,99 €** |
| Rosebud | 14,99 € | 119,99 € |

**Enseignements** : l'ancrage mensuel français est une bande étroite de 8-15 € · l'annuel s'étale de 40 à 120 € · **l'astrologie se vend plus cher que la méditation** (CHANI dépasse Calm et Headspace, dont les coûts de production sont sans commune mesure) · **l'IA est toujours un étage tarifaire séparé**, jamais incluse · la France est indexée à ~1,3× la référence en consentement à payer.

**Le prix de 69 €/an se situe donc au niveau de Petit BamBou, avec une marge de manœuvre à la hausse démontrée par CHANI.** Le bon comparateur n'est pas l'app de méditation mais **la consultation** (50-120 € la séance) : une année entière pour moins qu'une seule séance.

**Vente sur le web via Stripe** (~97 % net) plutôt qu'en achat intégré iOS (70-85 % net).

---

## 6. Économie et contraintes techniques

**Le socle ne coûte rien.** Thème natal, numérologie et horoscope sont du **calcul** (éphémérides + textes pré-écrits), pas de l'IA générative. L'offre gratuite peut donc rester ouverte à vie sans risque financier.

**La frontière premium épouse la frontière du coût** : ce qui coûte cher (l'agent) est aussi ce qui a de la valeur, donc ce qui est payant.

**Leviers d'optimisation** : découpage **par tâche** et non par utilisateur (petit modèle pour les tâches routinières, modèle fort pour la détection des prises de conscience et la synthèse hebdomadaire) · interprétations écrites une fois puis mises en cache · *prompt caching* du contexte long · résumé glissant plutôt que renvoi de tout l'historique. **Ne pas dégrader la qualité de l'agent pour les comptes gratuits** : cet échantillon est le seul sur lequel se décide l'abonnement.

**Voix** : ne stocker que la transcription, supprimer l'audio. **Ne jamais inférer l'émotion à partir du ton de la voix** — science contestée et terrain réglementaire sensible. Le texte suffit.

**Architecture de la mémoire, en trois couches** : journal brut → faits extraits (profil vivant) → branches. La mémoire est une **extraction structurée + un rappel au bon moment + une synthèse périodique**, pas un stockage de conversations.

**Cycle de vie d'une branche** : naissance (prise de conscience) → feuillaison (intégration, les semaines calmes) → fruit (passage à l'action). Plusieurs branches coexistent à des stades différents : **l'arbre bouge toujours**, sans distribuer de récompenses.

---

## 7. Conformité — détail

**RGPD article 9.** Ennéagramme (profil psychologique) + thème natal (conviction philosophique) + confidences (santé mentale, vie affective) = plusieurs catégories de données sensibles **simultanément**. Base légale réaliste : **consentement explicite** (art. 9.2.a), écrit, clair, spécifique, séparé du consentement général aux CGU, librement révocable. **Écran dédié, pas une case à cocher.** Précédent sectoriel : 5 M€ d'amende pour absence de base légale valide.

**AI Act article 50**, applicable au **2 août 2026** : information claire dès la première interaction. Le même écran porte utilement les deux obligations, et devient un argument de confiance — 85 % des jeunes réclament davantage d'information sur les risques.

**Résiliation (loi française du 16 août 2022)** : souscription électronique ⇒ **résiliation électronique en trois clics**, information préalable à la reconduction tacite. Sanction : 75 000 € pour une personne morale.

**Vocabulaire.** Autorisé : clarté, chemin, comprendre, avancer, se connaître, prise de conscience, accompagnement, bien-être, équilibre, objectifs, se réaliser, espoir. **Interdit** : guérir, soigner, traiter, thérapie, dépression, anxiété, trouble, diagnostic, symptôme, santé mentale, toute allégation de santé. Une seule phrase du mauvais côté fait rejeter l'app lors de la revue et change le régime juridique applicable.

**App Store, règle 4.3(b)** : la voyance est explicitement listée comme catégorie saturée, nouvelles soumissions refusées sauf « expérience significativement différente ». Positionner sur l'accompagnement, jamais sur la prédiction.

---

## 8. Distribution — matière pour le plan d'acquisition

**Angles issus directement du positionnement**, à tester par Anima :
- *« Ce que ton astrologue ne te dira jamais »*
- *« Ton thème ne dit pas que tout ira bien »*
- *« Les trois phrases que je refuse de dire en consultation »*

**Terrain** : 65 % des utilisateurs quotidiens de TikTok croient à au moins une discipline divinatoire. L'écosystème astro francophone est substantiel mais **personne ne l'a mesuré** — donc des tarifs vraisemblablement pas encore gonflés. Aucun benchmark de partenariat n'existe : sourcer par devis directs.

**Levier gratuit à ne pas rater** : sous 3,5 étoiles la visibilité App Store s'effondre et 50 % des gens n'envisagent pas de télécharger une app sous 4 étoiles. Solliciter un avis **après un moment de valeur ressentie**, jamais au deuxième lancement.

**À mesurer soi-même**, faute de données publiques : volumétrie des hashtags astro francophones (TikTok Creative Center, gratuit) et coût par installation réel en France (100-300 € suffisent).

---

## 9. Points ouverts

1. **Le signal d'audience à trois mois** — c'est le seul chiffre qui décide de la suite, et il n'existe pas encore.
2. **L'accord entre Julian et Anima** (propriété, rémunération, engagement) — soulevé une fois, **écarté par Julian**, non rouvert depuis. Subsiste un point opérationnel : une entité juridique est nécessaire pour encaisser des abonnements en France.
3. **Le corpus d'Anima** — l'actif défendable du projet, qui demande des heures de travail à Anima. Non planifié à ce jour.
4. **Le nom Anam** — disponibilité domaine, INPI et stores non vérifiée.
5. **L'ennéagramme comme pilier** — angle mort probable du marché grand public (les acteurs existants sont soit des GPT jetables, soit des plateformes B2B), mais la vérification reste partielle.
6. **Le protocole de détresse** — rédigé, en attente de validation par un professionnel qualifié.
7. **Stack technique** — Next.js puis réécriture *vs* Expo (un seul code pour le web, iOS et Android), et Railway à justifier face à Supabase seul. À trancher en phase d'architecture.
