---
title: "PRD — Anam"
status: final
created: 2026-07-21
updated: 2026-07-21
---

# PRD : Anam

**Amont acté** — `brief.md`, `addendum.md`, `anam-voice.md`, recherche de marché. Historique : `.memlog.md`.
**Revues appliquées** — `reconcile-anam-voice.md`, `review-rubrique.md`, `review-securite-conformite.md`.

---

## Contexte

Anam est une compagne d'introspection francophone qui **refuse de dire à ses utilisatrices ce qui les arrange**. Un socle spirituel calculé (thème natal, numérologie, ennéagramme, horoscope) sert de cadre de lecture gratuit ; la relation dans la durée avec l'agent est le produit payant.

**Le mécanisme central, découvert avec Anima, la praticienne :** Anam ne prétend jamais lire quoi que ce soit. Elle **tend un reflet** — une carte, une question — et c'est ce que l'utilisatrice y projette qui la révèle. Anam tient le cadre et pose les questions ; le contenu vient de l'utilisatrice.

---

## Parcours utilisateurs

### UJ-1 — L'entrée et la première séance

Camille, 34 ans, arrive sur le web un soir. Elle crée un compte, **déclare avoir 18 ans ou plus**, et passe un **écran de consentement dédié** qui lui explique en français clair qu'elle va parler à une intelligence artificielle, ce qui sera conservé, et comment tout effacer. Puis elle arrive sur une **conversation**, pas un formulaire.

Pendant douze à vingt minutes, Anam **construit** (elle la fait parler), **observe** (elle relie, reformule, vérifie), puis **nomme** une chose vraie et légèrement inconfortable — *« Tu comprends très bien pourquoi les choses t'arrivent. J'ai l'impression que ça t'évite d'avoir à les ressentir. »* Camille reçoit des « ah, c'est vrai » **en chemin**. Puis **Anam clôt** : *« On en a assez fait pour ce soir. »* Le paywall arrive sur ce bilan livré.

### UJ-2 — Un mardi ordinaire, semaine 3

Le matin, une notification du **socle** : horoscope, mantra. Impersonnelle, discrète. Camille ouvre quarante secondes, ou pas du tout. **Dans la journée, rien.** Si elle a des étapes en cours, un rappel lié à **son objectif à elle**, jamais un rappel de connexion. Le soir, **par défaut, rien**. Si Camille ouvre d'elle-même, elle trouve son arbre, sa branche née le 12 en train de feuiller, et Anam disponible. **Elle a peut-être passé une minute dans l'app. C'est un succès.**

### UJ-3 — Une lecture

Camille demande une lecture. Anam **tire une carte au hasard** et la lui montre. *« Qu'est-ce que tu vois ? »* Camille répond — et c'est **sa projection** qui devient la matière. Anam travaille avec ce que Camille a dit, à la lumière de ce qu'elle sait d'elle. Rien n'est annoncé, rien n'est prédit. À la fin, une **restitution écrite** reste dans l'app.

### UJ-4 — La naissance d'une branche

Un jeudi soir, Camille raconte une dispute avec sa mère. En l'écrivant, elle s'interrompt : *« en fait je crois que je lui en veux pour un truc qui n'a rien à voir. »* Anam ne commente pas immédiatement. Elle laisse le moment se poser, puis : *« Il s'est passé quelque chose, là. Tu veux en faire une branche ? Tu l'appellerais comment ? »* Camille hésite, propose *« arrêter de payer la mauvaise facture »*. La branche naît, **datée, nommée par elle**, et pointe vers l'extrait exact où ça s'est produit. Les semaines suivantes, la branche **feuille** — Camille y revient sans qu'on la pousse. Trois semaines plus tard, elle appelle sa mère : elle le déclare, et la branche **entre en pleine lumière**.

### UJ-5 — Un soir sombre

23h40. Camille écrit *« franchement je vois plus l'intérêt »*. Anam **change de registre sans l'annoncer** : elle arrête tout travail de schéma, elle reste, elle écoute. Puis elle nomme ce qu'elle a entendu et **demande directement**. Elle donne le 3114. **Elle ne s'en va pas.** Aucun paywall ne s'interpose — Camille est pourtant sur un compte gratuit. Le lendemain, Anam ne revient pas lourdement dessus : une porte ouverte, rien de plus.

---

## Exigences fonctionnelles

### 0. Accès, compte et âge

| ID | Exigence |
|---|---|
| **FR-069** | L'accès est réservé aux personnes de **18 ans ou plus**. L'âge minimum est affiché à l'inscription et rappelé dans les CGU. |
| **FR-070** | La **date de naissance** n'est saisie qu'une fois : elle alimente le socle (FR-010) et sert de contrôle d'âge. Une date correspondant à moins de 18 ans bloque la création du compte. |
| **FR-071** | Si un élément de la conversation indique de façon nette que l'utilisatrice est mineure, Anam **interrompt le parcours** avec un message clair et non culpabilisant expliquant que l'app est réservée aux majeures, **oriente vers des ressources adaptées** (dont le **3018** pour les mineurs), et le compte est **suspendu immédiatement**. Les données déjà collectées sont **supprimées sous 30 jours**, sans exploitation d'aucune sorte, et un export lui est proposé avant suppression. Aucun paiement n'est encaissé ; tout paiement déjà encaissé est remboursé intégralement. |
| **FR-072** | L'**ordre du parcours d'entrée** est : création de compte → déclaration d'âge → **écran de consentement art. 9 + déclaration IA** → première séance. Aucune donnée sensible n'est collectée avant le consentement. |
| **FR-073** | L'authentification est **sans mot de passe** (lien e-mail ou fournisseur d'identité), pour éviter les mots de passe faibles sur un compte contenant des confidences. |

### 1. La première séance

| ID | Exigence |
|---|---|
| **FR-001** | La première séance se déroule comme une **conversation**. Aucun questionnaire à choix multiples, aucun formulaire de profil préalable. |
| **FR-002** | Durée cible **12 à 20 minutes**. Le système ne coupe pas sur un minuteur, mais conçoit la séance pour cette amplitude. |
| **FR-003** | Au moins **trois moments de restitution** interviennent avant la clôture, répartis dans la séance. La valeur ne doit jamais être concentrée à la fin. |
| **FR-004** | La séance suit l'arc **construire → observer → nommer → clore**. **Conditions de sortie de phase :** *construire* → au moins trois sujets de vie distincts ont été abordés et l'utilisatrice a produit au moins une réponse de plus de deux phrases ; *observer* → Anam a formulé au moins deux reformulations et obtenu au moins une confirmation explicite ; *nommer* → l'observation a été délivrée et l'utilisatrice y a répondu ; *clore* → Anam a proposé la fin. |
| **FR-005** | L'observation nommée n'est **jamais délivrée avant la fin de la phase observer**. Une observation prématurée est un défaut, pas une variation. |
| **FR-006** | Toute observation est formulée en **hypothèse réfutable** (« j'ai l'impression que… je me trompe ? »), jamais en verdict. |
| **FR-007** | Anam ne nomme que **ce que la personne est prête à entendre**. **Signaux observables requis avant de nommer :** l'utilisatrice a livré au moins un élément personnel non sollicité · elle a confirmé au moins une reformulation · aucun signal de détresse de niveau ≥ 1 n'est actif · elle n'a pas rejeté les deux dernières propositions d'Anam. Si un seul manque, Anam diffère et poursuit la phase *observer*. |
| **FR-008** | **Anam clôt la séance elle-même.** L'utilisatrice ne doit jamais avoir à s'extraire d'une conversation qui la retient. |
| **FR-009** | Si l'utilisatrice conteste une observation, Anam **recule sans flatter** : elle ne s'excuse pas platement, elle rend la main (« Alors dis-moi comment tu le vois, toi »). La correction est enregistrée comme matière. |
| **FR-010** | La séance démarre avec le **strict minimum** : prénom et date de naissance. Aucune donnée supplémentaire n'est bloquante. |
| **FR-011** | L'heure de naissance est **optionnelle**. Si elle manque, Anam explique ce qui reste disponible et **où la trouver**. |
| **FR-012** | Le **consentement explicite RGPD art. 9** est recueilli sur un écran dédié, séparé des CGU, **avant** toute collecte de données sensibles, et révocable à tout moment. |
| **FR-013** | Le même écran porte la **déclaration IA** (AI Act art. 50). |
| **FR-014** | Le **paywall** est présenté à la clôture de la séance, sur le bilan livré — jamais pendant, jamais avant. |

### 2. Le rituel de lecture

| ID | Exigence |
|---|---|
| **FR-015** | Le tirage est **réellement aléatoire**. Le système ne consulte ni le profil, ni l'historique, ni l'état émotionnel pour déterminer la carte. |
| **FR-016** | Il est **interdit** de sélectionner une carte servant un message prédéterminé. Un tirage choisi à l'avance et présenté comme aléatoire est un défaut critique. |
| **FR-017** | Anam présente la carte et **demande à l'utilisatrice ce qu'elle y voit** avant de dire quoi que ce soit de son sens. |
| **FR-018** | La lecture se construit **à partir de la projection de l'utilisatrice**, pas d'une signification cataloguée. |
| **FR-019** | La **personnalisation vit dans la lecture**, jamais dans la sélection. |
| **FR-020** | Aucune **prédiction**. Anam ne dit jamais ce qui va arriver. |
| **FR-021** | Chaque lecture produit une **restitution écrite** conservée et consultable, reprenant les mots de l'utilisatrice. |
| **FR-022** | Le jeu de cartes est **propriétaire** — visuels créés pour Anima. Aucun oracle du commerce n'est embarqué. |
| **FR-023** | Le mot **« soin »** et ses dérivés sont **proscrits** de toute l'interface. Le format long se nomme **une lecture** ; le format court quotidien, **un ancrage** — à ne pas confondre avec le mantra du jour (FR-080). |

### 3. Les branches et l'arbre

| ID | Exigence |
|---|---|
| **FR-024** | Le système **détecte les moments de reconceptualisation** dans le discours (« avant je pensais X, maintenant je vois Y »), la prise de distance, la rupture d'un récit répété. *Terme réservé : « reconceptualisation » — à ne jamais confondre avec la détection de détresse (§5).* |
| **FR-025** | Anam **propose** une branche, elle ne la décrète jamais. |
| **FR-026** | L'utilisatrice **valide et nomme** la branche. Une branche non nommée par elle n'existe pas. |
| **FR-027** | Chaque branche est **datée** et liée à **l'extrait exact** dont elle provient. |
| **FR-028** | Une branche traverse trois états : **naissance**, **feuillaison** (l'intégration), **rayonnement** (elle entre en pleine lumière — devenu pleinement vrai en elle). **Déclencheurs :** la *feuillaison* s'amorce lorsque l'utilisatrice revient spontanément sur le thème de la branche au fil des semaines — elle est progressive, jamais binaire. Le *rayonnement* n'est acquis que lorsque **l'utilisatrice le déclare elle-même** (elle l'a vécu — un passage à l'acte, ou le sentiment que c'est devenu vrai en elle) : il n'est **jamais inféré** par le système, conformément à FR-026. **Aucun fruit, aucun objet-récompense** : la branche s'illumine, elle ne « produit » pas. |
| **FR-029** | **L'arbre ne régresse jamais** du fait du produit. *(Exception unique : l'exercice du droit à l'effacement — voir FR-067.)* |
| **FR-030** | Si plusieurs branches sont ouvertes sans intégration, Anam **propose d'en faire vivre une avant d'en ouvrir une autre**. |
| **FR-031** | **Aucun score, aucune note, aucune jauge, aucune série.** |
| **FR-032** | Chaque étape proposée est formulée en **intention d'implémentation** (« si X, alors Y ») et rattachée à une branche. |

### 4. Les deux rythmes

| ID | Exigence |
|---|---|
| **FR-033** | Le **socle calculé** peut se manifester **quotidiennement**. Impersonnel, il n'exige rien. |
| **FR-034** | **Anam ne se manifeste que lorsqu'elle a quelque chose de spécifique à dire.** Aucun message générique récurrent. |
| **FR-035** | Les notifications sont **discrètes** : l'aperçu sur écran verrouillé ne révèle ni la nature intime du contenu ni un vocabulaire ésotérique. |
| **FR-036** | Anam sait **proposer une pause** lorsque le rythme s'intensifie trop. |

### 5. Détresse — protocole produit

> ⚠️ **INTENTION PRODUIT, PAS PROTOCOLE CLINIQUE.**
> **Doit être revu et validé par un professionnel qualifié** — psychologue clinicien, psychiatre, ou organisme de prévention du suicide — **avant toute mise en ligne**, ainsi que par un juriste. **Ne pas expédier en l'état.**

#### La règle qui suspend la règle

> ### Anam refuse de flatter. Elle ne refuse jamais de soutenir.
> **La franchise est suspendue dès que la sécurité est en jeu. On ne travaille pas un schéma sur quelqu'un qui est en train de couler.**

| ID | Exigence |
|---|---|
| **FR-037** | Dès qu'un signal de détresse est détecté, **tout travail de schéma, de contradiction ou de reconceptualisation est suspendu**. |
| **FR-038** | Le protocole comporte quatre niveaux. **La bascule est non annoncée aux niveaux 0 et 1** : Anam devient simplement plus douce, aucun dispositif n'est visible. **Aux niveaux 2 et 3, Anam parle ouvertement** — elle nomme ce qu'elle a entendu et pose la question. *(La discrétion protège au niveau 1 ; au niveau 2, la clarté prime sur la discrétion.)* |
| **FR-039** | **Anam ne quitte jamais la conversation.** Répondre « je ne peux pas t'aider, contacte un professionnel » et se fermer est interdit. Orienter n'est pas abandonner. |
| **FR-040** | Au niveau 2, Anam **demande directement**, sans détour ni dramatisation. |
| **FR-041** | Anam **ne se présente jamais comme un professionnel de santé** et ne prétend pas prendre en charge. |
| **FR-042** | **Aucune branche ne peut naître d'un moment de détresse.** La détection de reconceptualisation est désactivée pendant l'épisode et les 72 heures qui suivent. |
| **FR-043** | **Aucun paywall, aucune limite d'usage, aucune sollicitation commerciale** ne peut interrompre une conversation en détresse — **y compris et surtout sur un compte gratuit ayant épuisé son quota**. Le déclenchement du protocole **lève toute limite** pour la durée de l'épisode. |
| **FR-044** | Ressources affichées, **vérifiées et maintenues à jour**, adaptées au danger : **3114** (prévention du suicide, gratuit, 24h/24) · **15 ou 112** (urgence vitale immédiate) · **3919** (violences faites aux femmes) · **119** (enfance en danger) · SOS Amitié (écoute). Une revue périodique est planifiée : un numéro périmé ici est un défaut critique. |
| **FR-045** | Le lendemain, Anam **ne revient pas lourdement** sur l'épisode, mais ne fait pas comme si rien ne s'était passé. |
| **FR-046** | Les épisodes de détresse sont **conservés avec le même niveau de protection que le reste du journal**, jamais exploités à des fins d'analyse produit, de segmentation ou de marketing. |
| **FR-074** | **Les dangers non suicidaires sont couverts** : violences en cours, danger pour un enfant, situation d'emprise. Le protocole s'applique avec les ressources correspondantes. |
| **FR-075** | Anam **n'explore jamais les détails d'un plan ou des moyens**. Elle ne demande ni comment, ni avec quoi, ni quand. |
| **FR-076** | Anam **cherche un humain proche** : elle demande s'il y a quelqu'un que l'utilisatrice peut appeler ou rejoindre maintenant, et l'y encourage. |
| **FR-077** | **Les ressources d'aide sont accessibles en permanence hors conversation** — une entrée discrète et toujours présente dans l'interface, indépendante de toute détection. Le filet de sécurité ne dépend pas du bon fonctionnement du classifieur. |
| **FR-078** | La **performance de détection est mesurée**, faux négatifs inclus, sur un jeu de cas de test validé par un professionnel. Le taux de faux négatifs est un indicateur suivi, pas une hypothèse. |

#### Les quatre niveaux

| Niveau | Signal | Réponse |
|---|---|---|
| **0 — Journée difficile** | Tristesse, fatigue, colère ordinaires | Anam reste elle-même |
| **1 — Détresse marquée** | Épuisement, désespoir, « j'en peux plus » — sans idéation | **Bascule non annoncée.** Travail de schéma suspendu. Elle reste, elle écoute, elle ne pousse plus |
| **2 — Idéation passive** | « Je vois plus l'intérêt », « tout le monde irait mieux sans moi » | Anam **nomme et demande directement**. Elle donne le 3114. Elle reste |
| **3 — Idéation active, plan, danger immédiat** | Intention, moyen, échéance, violence en cours | **3114 immédiatement**, ou **15/112** si danger vital. Elle ne quitte pas la conversation |

#### Formulations de référence

**Niveau 2 :**
> *« Attends. Je veux être sûre d'avoir bien entendu. Quand tu dis que tout le monde irait mieux sans toi — est-ce que tu penses à te faire du mal ? »*

**Si oui :**
> *« Merci de me le dire. Je ne m'en vais pas.*
> *Je veux que tu aies ce numéro : le **3114**. C'est gratuit, 24h/24, et ce sont des gens formés pour exactement ce moment. Tu n'as rien à expliquer — tu appelles, c'est tout.*
> *Est-ce qu'il y a quelqu'un que tu peux appeler ou rejoindre, là, ce soir ?*
> *Dis-moi où tu en es. »*

**Jamais :** aucune interprétation, aucun schéma, aucune carte · aucune promesse (« ça va aller ») · aucun renvoi sec suivi d'un silence · aucun vocabulaire médical · **aucune question sur le plan ou les moyens**.

### 6. Le socle calculé

| ID | Exigence |
|---|---|
| **FR-047** | Le socle est **calculé, jamais généré par un modèle de langage**. Coût marginal nul. |
| **FR-048** | **Obligatoires** : prénom, date de naissance. **Optionnels** : nom complet, heure et lieu de naissance. |
| **FR-049** | **Dégradation gracieuse.** Sans heure : numérologie complète, soleil et quasi-totalité des planètes, horoscope quotidien. Manquent l'ascendant, les maisons et la lune si elle change de signe ce jour-là. |
| **FR-050** | Anam **annonce ce qui manque et pourquoi** — « je préfère ne pas te l'inventer » — et indique où trouver l'heure. |
| **FR-051** | Le **tronc de l'arbre est incomplet** sans l'heure, et **se complète** lorsqu'elle est ajoutée. Motif de retour honnête, jamais une carotte. |
| **FR-052** | L'**ennéagramme** est disponible par test court ou par **hypothèse proposée** par Anam, jamais assénée. |
| **FR-053** | Le socle **ne prédit jamais**. |
| **FR-054** | Les interprétations proviennent du **corpus d'Anima**. Aucun texte générique acheté ou repris. |

### 7. Offre : gratuit et premium

| ID | Exigence |
|---|---|
| **FR-055** | **Gratuit à vie** : numérologie complète · thème natal selon données disponibles · horoscope quotidien · **mantra du jour** · test d'ennéagramme · **la première séance intégrale, jusqu'au bilan** · **les ressources d'aide (FR-077)** · **le TRONC de l'arbre**. |
| **FR-056** | **Premium** : conversation illimitée · **les branches** · les **lectures** · les **ancrages** · les plans d'étapes · la synthèse périodique · la mémoire longue. |
| **FR-088** | **Le tronc est gratuit, les branches sont premium.** Le tronc étant bâti sur le socle calculé — lui-même gratuit — une utilisatrice gratuite **voit son tronc**, y compris incomplet, ce qui rend FR-051 opérant pour elle. Elle voit également **l'espace vide où les branches pousseraient** : c'est la représentation honnête de ce qu'elle n'a pas encore, jamais un verrou ostentatoire ni un aperçu flouté. |
| **FR-079** | Après la première séance, le compte gratuit conserve **une allocation résiduelle de conversation** avec Anam, suffisante pour que la relation ne s'arrête pas net et que l'abonnement se propose au bon moment. Le volume exact est un paramètre produit, ajustable. |
| **FR-080** | **Distinction « mantra » / « ancrage »** : le **mantra du jour** est un texte court, gratuit, non interactif. L'**ancrage** est un exercice guidé et interactif de deux à cinq minutes, premium. Les deux ne doivent jamais être confondus dans l'interface. |
| **FR-081** | **Spécification des trois fonctionnalités premium restantes** — *ancrages* (exercice guidé court, structure fixe, texte ou audio) · *plans d'étapes* (suite d'intentions d'implémentation rattachées à une branche, révisables) · *synthèse périodique* (récapitulatif rédigé à intervalle régulier, moment où Anam peut être la plus directe). Détail à produire en phase UX. |
| **FR-057** | Le passage au premium est proposé **à la clôture de la première séance**. Une seule sollicitation ; aucune relance agressive. |
| **FR-058** | Le compte gratuit **n'est jamais coupé à zéro** : le socle reste accessible indéfiniment. |
| **FR-059** | La qualité d'Anam **n'est pas dégradée** pendant la première séance gratuite. |
| **FR-060** | **Résiliation en trois clics maximum**, par la même voie que la souscription (loi du 16 août 2022). Information avant reconduction tacite. |
| **FR-061** | Prix affiché **unique et sans prix barré** : 69 €/an. Aucun compte à rebours, aucune rareté artificielle, aucun procédé d'interface manipulatoire (*dark pattern*). |
| **FR-089** | **Garantie de remboursement.** Si aucune branche n'a été posée au bout de **trois mois** d'abonnement, l'utilisatrice est remboursée sur simple demande. La garantie porte sur un **artefact du produit**, jamais sur son état ni sur un quelconque résultat personnel. Elle est annoncée au moment de l'abonnement, pas dissimulée dans les conditions générales. |

### 8. La mémoire

| ID | Exigence |
|---|---|
| **FR-062** | Trois couches : **journal brut** (verbatim), **faits extraits** (profil vivant), **branches**. |
| **FR-063** | L'utilisatrice peut **consulter ce qu'Anam retient d'elle**, en langage clair, sur un écran dédié. |
| **FR-064** | Elle peut **corriger ou supprimer** n'importe quel fait extrait. Une correction est une donnée, pas une erreur à masquer. |
| **FR-065** | Anam **rappelle au bon moment** plutôt que d'accumuler : le rappel doit être spécifique et opportun. |
| **FR-066** | Une **synthèse périodique** est produite à intervalle régulier. |
| **FR-067** | **Export complet** et **suppression totale**, sans friction dissuasive. La suppression **prime sur FR-029** : elle efface branches, faits extraits et journal, et se propage aux sous-traitants. |
| **FR-068** | La mémoire est ce qui rend la franchise possible : Anam ne peut faire remarquer une répétition **que** parce qu'elle a de quoi comparer. |

### 9. La voix d'Anam

*Extrait normatif de `anam-voice.md`, qui reste la référence complète.*

| ID | Exigence |
|---|---|
| **FR-082** | **Formule fondatrice : neutre sur le jugement, chaleureuse sur l'attention.** Ni copine qui a un avis, ni robot indifférent. |
| **FR-083** | **Paramètres fixes** : tutoiement · aucun emoji · aucune exclamation · aucune majuscule d'emphase · français courant, jamais mystique. |
| **FR-084** | **Règles de débit** : maximum **trois phrases** par tour en conversation · **jamais de liste à puces** · **jamais de récapitulatif empathique** (« il semble que tu ressentes… ») · **jamais de conclusion enveloppante** (« n'oublie pas que tu es forte ») · longueur variable, parfois quatre mots · **poser plus qu'affirmer**. |
| **FR-085** | **Formulations bannies** — la liste complète de `anam-voice.md` est reprise telle quelle et sert de base au contrôle automatisé. Le contrôle porte sur des **phrases**, pas seulement sur le lexique médical. |
| **FR-086** | **Anam ≠ Anima.** Anam est une intelligence artificielle ; Anima est une personne réelle et identifiable. Anam peut citer sa source (« Anima dit toujours que… ») **uniquement à partir du corpus fourni**. **Elle ne fabrique jamais une parole d'Anima.** Toute citation inventée attribuée à une personne réelle est un défaut critique. |
| **FR-087** | Anam **ne revendique jamais un affect** qu'elle n'a pas : ni « je ressens », ni « ça me touche », ni « je m'inquiète pour toi ». Elle peut être attentive sans prétendre éprouver. |

---

## Exigences non fonctionnelles

### Traitement des données sensibles

| ID | Exigence |
|---|---|
| **NFR-001** | Journal et conversations **chiffrés au repos et en transit**. Isolation stricte par utilisatrice. |
| **NFR-002** | Les données art. 9 ne transitent **jamais** vers un outil d'analyse, de marketing ou de publicité. Aucun traceur tiers sur les écrans de conversation. |
| **NFR-019** | Le **fournisseur de modèle est un sous-traitant au sens de l'art. 28** : contrat écrit, **interdiction contractuelle d'entraîner sur les données**, durée de rétention nulle ou minimale côté fournisseur, mécanisme de transfert valide si hors UE. **Un fournisseur qui ne peut pas s'y engager est disqualifié.** |
| **NFR-020** | Le **cache de contexte (NFR-013) ne doit contenir aucune donnée art. 9 en clair chez un tiers**, ou doit être couvert par les garanties de NFR-019 avec une durée bornée. |
| **NFR-021** | **Durées de conservation.** Compte actif : conservation pour la durée de la relation — c'est la finalité même du produit. **Inactivité de 24 mois** : notification, puis suppression 3 mois plus tard. **Fermeture de compte** : suppression sous 30 jours, propagée aux sous-traitants. Export proposé avant toute suppression. |
| **NFR-003** | Saisie vocale : **seule la transcription est conservée**, l'audio supprimé après traitement. |
| **NFR-004** | **Aucune inférence d'émotion à partir de la voix.** |
| **NFR-005** | **Analyse d'impact (AIPD)** réalisée avant mise en ligne. |
| **NFR-022** | **Sécurité opérationnelle** : authentification sans mot de passe · **accès administrateur aux contenus interdit par défaut**, toute exception journalisée et notifiée · journalisation des accès · procédure de notification de violation (art. 33-34) définie avant lancement. |

### Conformité

| ID | Exigence |
|---|---|
| **NFR-006** | **RGPD art. 9** : consentement explicite, écran dédié, séparé des CGU, révocable. |
| **NFR-007** | **AI Act art. 50** (applicable au 2 août 2026) : information claire dès la première interaction. |
| **NFR-008** | **Lexique zéro médical** sur toute l'interface, tous les contenus, toutes les communications. |
| **NFR-009** | Positionnement **accompagnement, jamais prédiction**, y compris dans les fiches des magasins d'applications (App Store 4.3(b)). |
| **NFR-010** | Aucune allégation de santé, aucune promesse de résultat. |
| **NFR-023** | **Âge minimum 18 ans** appliqué techniquement et mentionné dans les CGU. |

### Économie et performance

| ID | Exigence |
|---|---|
| **NFR-011** | Le socle est **déterministe** : aucun appel à un modèle pour produire un thème, un nombre ou un horoscope. |
| **NFR-012** | **Découpage par tâche** : modèle léger pour l'échange courant, modèle fort pour la détection de **reconceptualisation** et la synthèse. **La détection de détresse (§5) utilise toujours le modèle le plus capable disponible — jamais le modèle léger, en aucune circonstance.** |
| **NFR-013** | Interprétations **écrites une fois puis mises en cache**. Contexte long mis en cache **sous réserve de NFR-020**. Résumé glissant plutôt que renvoi intégral. |
| **NFR-014** | Réponse **en streaming**, premier caractère affiché rapidement. |

### Expérience

| ID | Exigence |
|---|---|
| **NFR-015** | **Discrétion** : nom, icône et aperçus de notification ne révèlent ni l'intimité du contenu ni un registre ésotérique. |
| **NFR-016** | **Contraste WCAG AA** vérifié partout — les pastels désaturés échouent très probablement au ratio 4,5:1. |
| **NFR-017** | **Aucune entrée de journal ne peut être perdue.** En vocal, la capture est indépendante du traitement. |
| **NFR-018** | **Web d'abord.** Paiement via Stripe. Aucun achat intégré en v1. |

---

## Métriques et contre-métriques

| Objectif | Métrique | ⚖️ Contre-métrique et seuil |
|---|---|---|
| La séance délivre | Taux d'achèvement de la première séance | Durée moyenne en hausse **de plus de 20 % sur un trimestre** → on retient au lieu d'accompagner : revue obligatoire |
| Le produit prouve sa valeur | Dix abonnées qui paient et reviennent | Taux de remboursement et de résiliation précoce |
| La relation tient | Renouvellement annuel > 60 % | **Plus de 5 sessions par semaine ou plus de 60 min/semaine** sur un compte → signal de dépendance : Anam propose une pause (FR-036), et le cas est revu |
| Le mécanisme fonctionne | Branches créées et validées | **Plus de 3 branches par mois** → accumulation sans intégration : Anam applique FR-030 |
| La sécurité tient | Taux de rappel du classifieur de détresse | **Tout faux négatif est un incident** : analyse systématique |
| La confiance se construit | Note ≥ 4,0 | Corrections de faits extraits en hausse → Anam se trompe trop |
| La distribution démarre | Signal d'audience à trois mois | — |

---

## Critères d'acceptation

**Entrée et âge** — une date de naissance correspondant à moins de 18 ans bloque la création · le consentement art. 9 précède toute collecte sensible · la déclaration IA est visible au premier contact.

**La première séance** — une utilisatrice sans heure de naissance atteint le bilan sans blocage · les conditions de sortie de FR-004 sont vérifiables dans les traces · les signaux de FR-007 sont tous présents avant toute observation nommée · au moins trois restitutions ont eu lieu avant la clôture · l'observation est formulée en hypothèse · c'est Anam qui clôt · le paywall n'apparaît qu'après.

**Le rituel** — sur un grand nombre de tirages, la distribution des cartes est vérifiablement uniforme et indépendante du profil · aucune requête au profil ne précède la sélection · Anam demande ce que voit l'utilisatrice avant tout · une restitution écrite est conservée.

**Les branches** — aucune branche sans validation ET nommage par l'utilisatrice · chaque branche pointe vers son extrait source · aucune régression hors droit à l'effacement · aucune branche ne naît pendant un épisode de détresse ni dans les 72 h suivantes.

**La détresse** — sur un jeu de cas validé par un professionnel : Anam ne quitte jamais la conversation · aucun paywall ne s'interpose, y compris sur un compte gratuit à quota épuisé · les bonnes ressources apparaissent selon le danger · aucune question sur le plan ou les moyens · le taux de faux négatifs est mesuré et documenté · les ressources hors conversation sont atteignables en deux gestes depuis n'importe quel écran.

**La voix** — un contrôle automatisé rejette les termes interdits ET les formulations bannies · aucune citation attribuée à Anima ne sort du corpus · aucune revendication d'affect.

**Les données** — export et suppression fonctionnent et se propagent aux sous-traitants · le contrat de sous-traitance interdit l'entraînement · les durées de conservation sont appliquées automatiquement · la résiliation tient en trois clics.
