---
title: "Revue qualité — PRD Anam"
status: review
created: 2026-07-21
reviewer: validator (rubrique bmad-prd)
source: prd-validation-checklist.md
---

# Revue qualité du PRD — Anam

**Document évalué** : `_bmad-output/planning-artifacts/prds/prd-Anima-2026-07-21/prd.md` (68 FR, 18 NFR, 3 UJ, 6 métriques appariées, 6 blocs de critères d'acceptation)
**Grille** : `.claude/skills/bmad-prd/assets/prd-validation-checklist.md` — sept dimensions + notes mécaniques
**Barre appliquée** : « complet, comme un produit financé » (décision actée au `.memlog.md`)

**Hors périmètre de cette revue, par consigne** : le nom, la promesse, le prix de 69 €/an, la stack Vercel + Supabase, le positionnement anti-complaisance, le périmètre MoSCoW, la langue française du document. Les choix d'implémentation technique ne sont pas exigés ici : UX et architecture suivent. Quand un constat touche l'une de ces zones, il porte sur la **cohérence interne du document** ou sur une **contrainte produit que le PRD doit posséder**, jamais sur la décision elle-même.

---

## Verdict global

Ce PRD est **au-dessus de la barre sur la pensée produit et en dessous sur la constructibilité**. La thèse est réelle et non interchangeable — « Anam ne prétend jamais lire quoi que ce soit. Elle tend un reflet » —, les contre-métriques sont d'une qualité qu'on voit rarement même dans des produits financés, et le protocole de détresse est un vrai travail de doctrine, encadré d'un avertissement honnête. Mais trois choses empêchent de le passer tel quel à l'UX et à l'architecture : une **contradiction sur le chemin de sécurité** (FR-043 promet une conversation ininterrompue « y compris pour un compte gratuit » alors que FR-055/056 privent le compte gratuit de toute conversation après la première séance), l'**inconstructibilité des deux doctrines centrales** (FR-004 exige des conditions de sortie de phase « explicites » qu'il ne donne pas ; FR-007 confie au système une évaluation de ce que la personne « est prête à entendre » sans un seul signal observable), et l'**absence des sections qui rendent un PRD autoportant** — non-buts, hypothèses indexées, questions ouvertes, glossaire, traçabilité FR → critères d'acceptation.

Autrement dit : le document sait très bien ce qu'il refuse, moins bien ce qu'il faut avoir livré pour dire que c'est fait.

---

## 1. Aptitude à la décision — **adéquat**

La rubrique demande : *« Can a decision-maker act on this PRD? Are the trade-offs surfaced honestly, or has the PRD smoothed everything to neutral? »*

| Critère de la rubrique | Statut |
|---|---|
| Décisions énoncées comme des décisions, pas enfouies en « considérations » | **Conforme** |
| Arbitrages nommés avec ce qui a été abandonné | **Non conforme** |
| Questions ouvertes réellement ouvertes | **Non conforme** (aucune section) |
| Callouts `[NOTE FOR PM]` aux vraies tensions | **Partiellement conforme** (une seule, mais la bonne) |
| Drapeau rouge : tout « équilibre », toute NFR « importante » | **Conforme** — absent, le document tranche |

**Ce qui tient.** Le registre est décisionnel de bout en bout, et c'est sa meilleure qualité. « Il est **interdit** de sélectionner une carte servant un message prédéterminé » (FR-016), « **L'arbre ne régresse jamais** » (FR-029), « **Aucun score, aucune note, aucune jauge, aucune série** » (FR-031), « Prix affiché **unique et sans prix barré** » (FR-061). Aucune de ces phrases ne pourrait être négociée à la baisse sans qu'on le voie. Le PRD ne souffre pas du défaut que la rubrique décrit comme drapeau rouge : rien n'y « équilibre » quoi que ce soit.

L'encadré de la section 5 est exactement le callout que la rubrique réclame, posé au bon endroit : *« Cette section décrit une INTENTION PRODUIT, pas un protocole clinique. Elle doit être revue et validée par un professionnel qualifié […] Ne pas expédier en l'état. »* C'est une tension réelle, signalée avec sa condition de levée. C'est le modèle à répliquer ailleurs — et il n'est répliqué nulle part.

**Ce qui manque.** Les arbitrages ont été faits, mais dans l'`addendum.md`, et rien n'a traversé. Un lecteur du seul PRD voit FR-014 — « Le **paywall** est présenté à la clôture de la séance » — sans savoir que l'alternative « paywall le lendemain » a été explicitement testée puis invalidée sur données (« 89,4 % des essais démarrent à J0 »). Idem pour l'absence de gamification (FR-031), qui est une décision appuyée sur une méta-analyse, et pour le refus de l'achat intégré (NFR-018), qui repose sur un écart de marge de 97 % contre 70-85 %. Ces trois décisions sont exactement celles qu'un lecteur tentera de rouvrir en phase de build, et le PRD ne leur oppose aucune raison. La rubrique est explicite sur ce point en dimension 6 : *« Each section makes sense pulled out alone »*.

Surtout : **aucune question ouverte n'est enregistrée**, alors que l'amont en liste sept (`addendum.md` §9), dont au moins quatre sont vivantes au moment de construire — la validation clinique du protocole, le corpus d'Anima « non planifié à ce jour », l'ennéagramme comme pilier « vérification partielle », la disponibilité du nom. Le PRD ne les hérite pas, ne les clôt pas, ne dit pas qu'elles sont traitées ailleurs. Elles disparaissent à la frontière du document.

### Constats
- **ÉLEVÉ** — Aucune section « Questions ouvertes » ni aucune hypothèse `[HYPOTHÈSE]` indexée (tout le document) — sept points ouverts existent en amont (`addendum.md` §9) et aucun n'est repris ; le lecteur du PRD croit tout tranché. *Correctif :* une section finale « Questions ouvertes » reprenant les points ouverts encore vivants, chacun avec son propriétaire et sa date de décision cible.
- **MOYEN** — Les arbitrages structurants sont sans justification dans le PRD (FR-014, FR-031, NFR-018) — les raisons sont dans l'addendum et ne survivent pas à la lecture isolée du PRD. *Correctif :* une ligne « pourquoi pas l'inverse » sous chacune de ces trois exigences (deux phrases suffisent, les chiffres existent déjà).
- **MOYEN** — Un seul `[NOTE FOR PM]` de fait (encadré §5) alors que plusieurs tensions non résolues existent (mesure vs NFR-002, audit du protocole vs FR-046, plafond de coût vs prix fixe — voir plus bas). *Correctif :* ajouter le callout à ces trois endroits, sur le modèle exact de celui de la détresse.

---

## 2. Substance contre décor — **fort**

La rubrique cherche : *« Is the content earned, or is it furniture? »* — et détaille quatre formes de décor.

| Forme de décor traquée | Statut |
|---|---|
| Théâtre de personas (plus de quatre, ou aucune décision pilotée) | **Conforme** — une seule persona, Camille, et elle pilote |
| Théâtre d'innovation (nouveauté revendiquée non nouvelle) | **Conforme** — aucune section « différenciation » ; le PRD ne revendique rien |
| Théâtre de NFR (boilerplate sans seuil produit) | **Conforme** sur le fond, réserve sur les bornes (voir dim. 4) |
| Théâtre de vision (énoncé transposable à n'importe quel PRD) | **Conforme** |

C'est la dimension la plus solide du document, et il faut le dire nettement.

Le paragraphe « Contexte » ne se transpose dans aucun autre PRD de la catégorie : *« Anam ne prétend jamais lire quoi que ce soit. Elle tend un reflet — une carte, une question — et c'est ce que l'utilisatrice y projette qui la révèle. »* C'est une thèse mécanique, pas une aspiration.

Les NFR sont l'inverse du boilerplate. NFR-004 — « **Aucune inférence d'émotion à partir de la voix** — science contestée et terrain réglementaire sensible » — est une exclusion motivée, propre à ce produit. NFR-008 énumère nommément le lexique interdit. NFR-016 ne dit pas « accessible » : il dit « les pastels désaturés échouent très probablement le ratio 4,5:1, des variantes accessibles sont requises pour le texte » — une NFR qui identifie sa propre zone de rupture. NFR-003 tranche le sort de l'audio. Aucune de ces quatre lignes ne pourrait être copiée-collée dans un autre produit.

Une seule persona, nommée, porteuse de trois angles morts qui deviennent des exigences (FR-011 sur l'heure de naissance, FR-035 et NFR-015 sur la discrétion). C'est de la persona qui travaille.

**Réserve unique** : le motif de la discrétion — la honte de la persona, la notification lue par-dessus l'épaule en open space — n'est nulle part dans le PRD. FR-035 et NFR-015 exigent la discrétion sans dire qu'elle est une conséquence du profil majoritaire visé et non un raffinement esthétique. Lu isolément, c'est la seule exigence du document qui ressemble à une préférence, alors que c'est la mieux fondée.

### Constats
- **FAIBLE** — La discrétion (FR-035, NFR-015) est exigée sans son motif (§4 « Les deux rythmes », NFR « Expérience ») — une équipe UX sous pression la traitera comme négociable. *Correctif :* une demi-phrase de motif — « le profil visé pratique sans l'assumer ; un aperçu explicite désinstalle l'app ».

---

## 3. Cohérence stratégique — **adéquat**

La rubrique demande : *« Does the PRD have a thesis? Do the features serve a unified arc, or is it a list of capabilities someone wanted? »*

| Critère de la rubrique | Statut |
|---|---|
| Thèse énoncée sur laquelle le PRD parie | **Conforme** |
| Priorisation des fonctionnalités qui découle de la thèse | **Partiellement conforme** |
| Métriques qui valident la thèse, pas l'activité | **Conforme** |
| Contre-métriques nommées | **Conforme** — et remarquables |
| Nature du périmètre MVP cohérente avec la logique de périmètre | **Partiellement conforme** |

**Ce qui tient, et fortement.** Les contre-métriques sont le meilleur passage du document. « **Durée moyenne de séance qui dérive à la hausse** = on retient au lieu d'accompagner », « **Fréquence d'usage anormalement élevée** = signal de dépendance, pas de succès », « **Plus de deux à trois branches par mois** = collectionnite d'insights sans intégration ». La rubrique signale comme tell l'usage de DAU/MAU quand la thèse porte sur la qualité de l'engagement : ici, non seulement le tell est évité, mais la fréquence élevée est explicitement traitée comme un échec. C'est un PRD qui a compris sa propre thèse jusqu'aux instruments de mesure.

**L'incohérence de fond.** Le PRD dit que le produit payant est la relation dans la durée : « le socle […] sert de cadre de lecture gratuit ; **la relation dans la durée avec l'agent est le produit payant** ». Or la densité de spécification dit autre chose :

- première séance (le moment gratuit) : **14 FR** + un bloc entier de critères d'acceptation ;
- ce qui est vendu sous FR-056 : « conversation illimitée · l'arbre et les branches · les lectures · **les ancrages** · **les plans d'étapes** · **la synthèse périodique** · la mémoire longue » — dont **trois éléments n'ont aucun bloc d'exigences** : « les ancrages » n'apparaissent qu'une fois ailleurs (FR-023, pour être nommés), « les plans d'étapes » ne sont adossés qu'à FR-032, « la synthèse périodique » tient dans FR-066 avec un intervalle non défini (« à intervalle régulier » — l'addendum disait « hebdomadaire »).

La métrique décisive est le renouvellement annuel à plus de 60 %. Ce qui produit ce renouvellement, ce sont les mois 2 à 12 — et les mois 2 à 12 sont le tiers le moins spécifié du document (§4 « Les deux rythmes » : 4 FR). Le PRD spécifie très bien le moment qu'il donne et beaucoup moins bien la chose qu'il facture.

**Périmètre.** Le `.memlog.md` acte un périmètre MoSCoW et le brief a une liste « Dehors, et assumé ». Le PRD ne porte ni l'un ni l'autre : pas de tableau de priorisation, pas de section hors-périmètre. Les exclusions les plus importantes ont bien survécu sous forme d'exigences (FR-031 pour la gamification, NFR-018 pour l'achat intégré, NFR-004 pour l'émotion vocale) — ce qui limite les dégâts — mais rien ne distingue, parmi les 68 FR, ce qui doit exister le jour de la mise en ligne de ce qui peut suivre.

### Constats
- **ÉLEVÉ** — Trois fonctionnalités vendues sans spécification (FR-056) — « les ancrages », « les plans d'étapes », « la synthèse périodique » figurent dans l'offre payante sans bloc d'exigences ni critère d'acceptation ; on ne peut pas construire, ni tester, ni décrire sur une page de vente ce qui est facturé. *Correctif :* un bloc FR par élément, ou les retirer de FR-056 jusqu'à ce qu'ils soient spécifiés.
- **ÉLEVÉ** — Asymétrie acquisition / rétention (§1 contre §4 et §8) — 14 FR pour la séance gratuite, 4 FR pour le rythme des mois suivants, alors que la métrique décisive est le renouvellement à 12 mois. *Correctif :* écrire la semaine 8 et le mois 6 comme des parcours (voir dim. 7), puis en dériver les exigences manquantes.
- **MOYEN** — Aucun périmètre de version dans le PRD (tout le document) — le MoSCoW acté en amont n'apparaît nulle part ; 68 FR sont présentés à plat. *Correctif :* une colonne M/S/C sur les tableaux d'exigences, ou une section « Périmètre v1 » reprenant la liste du brief.
- **FAIBLE** — Objectif « La distribution démarre » sans contre-métrique (tableau des métriques) — c'est le seul « — » du tableau, sur l'objectif que le brief désigne comme le vrai risque. *Correctif :* une contre-métrique de qualité d'audience (par ex. taux d'achèvement de la première séance des inscrites issues d'un contenu, contre la moyenne).

---

## 4. Clarté du « fini » — **mince**

La rubrique prévient : *« This is the dimension downstream story creation will lean on hardest. Be unforgiving here. »*

| Critère de la rubrique | Statut |
|---|---|
| Au moins une conséquence testable par FR | **Partiellement conforme** |
| Aucune formule du type « gère X gracieusement », « performance raisonnable » | **Partiellement conforme** |
| Critères d'acceptation implicites ou explicites | **Partiellement conforme** (4 sections de FR sur 8 couvertes) |
| Sections non fonctionnelles : des bornes, pas des adjectifs | **Non conforme** |

**Le cas le plus grave : les deux doctrines centrales ne sont pas construisibles.**

FR-004 : « La séance suit l'arc **construire → observer → nommer → clore**. **Chaque phase a une condition de sortie explicite.** » Le PRD exige que ces conditions soient explicites et ne les donne pas. FR-005 en dépend directement — « L'observation nommée n'est **jamais délivrée avant la fin de la phase observer**. Une observation prématurée est un défaut, pas une variation » — mais on ne peut pas détecter le défaut sans savoir quand la phase « observer » finit. Aucun critère d'acceptation ne teste cette frontière ; le bloc « La première séance » teste la présence de trois restitutions, la forme hypothétique de l'observation finale, la clôture par Anam et l'ordre du paywall — pas l'arc lui-même.

FR-007 : « Anam ne nomme que **ce que la personne est prête à entendre**. Le système évalue cette disponibilité à partir de ce qui a été dit dans la séance, et diffère sinon. » C'est le principe le plus important du produit, formulé par la praticienne (`.memlog.md` : « doctrine de calibrage, répond à la question du droit de nommer »), et il est ici sans un seul signal observable, sans exemple de ce qui fait différer, sans critère d'acceptation. Un développeur ne peut ni l'implémenter ni prouver qu'il l'a fait ; un relecteur ne peut pas dire qu'il a échoué.

**Adjectifs sans borne** — la rubrique demande de signaler chacun :

| Exigence | Formule non bornée |
|---|---|
| FR-034 | « lorsqu'elle a quelque chose de **spécifique** à dire » — spécifique n'est pas défini, aucun plafond de fréquence |
| FR-036 | « lorsque le rythme s'intensifie **trop** » |
| FR-042 | « désactivé pendant **et après** un épisode » — durée de la fenêtre absente |
| FR-065 | « rappelle **au bon moment** », « **spécifique et opportun** » |
| FR-066 | « à **intervalle régulier** » |
| NFR-014 | « premier caractère affiché **rapidement** » — aucun budget en millisecondes |
| NFR-017 | « Aucune entrée de journal ne peut être perdue » — l'absolu est une borne, mais sans objectif de durabilité ni comportement en cas de coupure pendant la saisie |

FR-042 mérite un mot : la fenêtre de suspension du mécanisme de branches après un épisode de détresse est une décision de sécurité, pas un détail. FR-045 laisse entendre au moins un jour (« Le lendemain, Anam ne revient pas lourdement »), mais rien ne le dit.

**Critères d'acceptation : couverture à moitié, aucune traçabilité.** Les six blocs couvrent la première séance, le rituel, les branches, la détresse, la conformité et le lexique. Ne sont couverts par **aucun** critère : §4 « Les deux rythmes » (notifications, régimes distincts socle/Anam), §6 « Le socle calculé » (hors le cas « sans heure de naissance »), §8 « La mémoire » (les trois couches, l'écran de consultation, la correction de faits, la synthèse). Aucun critère ne cite d'identifiant de FR : la reprise en stories devra reconstruire la correspondance à la main sur 68 exigences.

**Un critère est faux.** « Le rituel — **deux tirages successifs sur le même profil donnent des cartes différentes** de façon vérifiablement aléatoire ». Un tirage réellement aléatoire produit parfois deux fois la même carte ; ce critère échouerait sur une implémentation correcte et passerait sur un tirage curaté qui varie. Le second critère du même bloc — « aucune requête au profil ne précède la sélection » — est, lui, exactement le bon test et il est vérifiable à la revue de code.

**Ce qui est bien fait, et à répliquer.** Le bloc « Le lexique » — « un contrôle automatisé rejette tout terme interdit avant publication de n'importe quel contenu » — est un critère exécutable adossé à une NFR qui énumère nommément les termes. C'est le standard que les autres blocs devraient atteindre.

### Constats
- **CRITIQUE** — FR-004 et FR-007 ne sont ni implémentables ni testables (§1 « La première séance ») — l'arc exige des conditions de sortie « explicites » qu'il ne fournit pas, et le calibrage de ce que la personne « est prête à entendre » n'a aucun signal observable ; ce sont les deux doctrines dont dépend tout le reste du produit. *Correctif :* énoncer pour chaque phase sa condition de sortie observable (par ex. « observer se termine quand au moins deux éléments du récit ont été reliés et confirmés par l'utilisatrice »), et lister pour FR-007 les trois à cinq signaux qui font différer.
- **ÉLEVÉ** — Critères d'acceptation absents sur quatre sections d'exigences sur huit (§ Critères d'acceptation) — rien ne couvre les rythmes, le socle, la frontière gratuit/premium hors résiliation, ni la mémoire. *Correctif :* un bloc par section d'exigences, même court.
- **ÉLEVÉ** — Aucune traçabilité FR → critère d'acceptation (§ Critères d'acceptation) — les critères sont en prose sans identifiants ; la création de stories devra reconstituer la carte de couverture. *Correctif :* citer les identifiants de FR entre parenthèses dans chaque critère.
- **MOYEN** — Critère de hasard incorrect (§ Critères d'acceptation, « Le rituel ») — « deux tirages successifs donnent des cartes différentes » échoue sur un générateur correct. *Correctif :* remplacer par une distribution sur N tirages plus l'absence de lecture du profil avant sélection (déjà présente).
- **MOYEN** — Sept exigences bornées par des adjectifs (FR-034, FR-036, FR-042, FR-065, FR-066, NFR-014, NFR-017) — dont deux touchent la sécurité (FR-042, fenêtre après épisode) et une l'expérience centrale (NFR-014, latence du premier caractère). *Correctif :* une valeur pour chacune ; NFR-014 en millisecondes, FR-042 en jours.

---

## 5. Honnêteté du périmètre — **mince**

La rubrique demande : *« Are omissions explicit, or is the reader meant to infer them? »*

| Critère de la rubrique | Statut |
|---|---|
| Section « Non-buts » là où elle ferait un vrai travail | **Non conforme** |
| Callouts `[NON-GOAL for MVP]` là où l'omission peut être supposée acquise | **Non conforme** |
| Tags `[ASSUMPTION: …]` sur les inférences non confirmées, indexés | **Non conforme** |
| Callouts `[NOTE FOR PM]` aux décisions différées et tensions non résolues | **Partiellement conforme** (un seul) |
| Dé-périmétrage proposé honnêtement, pas fait en silence | **Partiellement conforme** |
| Densité d'items ouverts proportionnée aux enjeux | **Non conforme** — densité nulle sur un document destiné à lancer le build |

La rubrique le formule ainsi : *« High counts on a green-light-to-build PRD is a blocker. »* Ici c'est le symétrique et il est plus trompeur : **zéro** item ouvert sur un document qui va déclencher la construction, alors que l'amont en documente sept et que la revue en révèle une dizaine. Un compte nul ne signifie pas que tout est tranché : il signifie que ce qui ne l'est pas n'a pas été écrit.

**L'entête est périmé et il ment sur l'état du document.** Lignes 10 à 12 : « 🚧 **Brouillon — premier bloc.** Parcours 1 à 3 et exigences du cœur produit. Restent à couvrir : naissance d'une branche (parcours dédié), moment de détresse, paywall, socle calculé, frontière gratuit/premium, NFR, critères d'acceptation. » Sur ces sept items, **six sont livrés** dans le document. Le septième — « naissance d'une branche (parcours dédié) » — ne l'est pas et l'entête est le seul endroit où l'on apprend qu'il manque. C'est le pire des deux mondes : le lecteur qui croit l'entête cherche des sections présentes, et celui qui l'ignore ne voit pas le seul manque réel.

**Omissions silencieuses relevées** — aucune n'est signalée comme telle dans le document :

1. **Âge minimum.** Le produit collecte des données de l'article 9 par la conversation, vend un abonnement en ligne, et embarque un protocole de risque suicidaire calibré pour des adultes. Ni le PRD ni l'amont ne fixent d'âge minimum, ne prévoient de vérification, ni n'adaptent le protocole à une mineure. En France, le consentement propre aux services en ligne est fixé à 15 ans ; l'écran de consentement de FR-012 le suppose implicitement.
2. **Création de compte et authentification.** Aucune exigence. UJ-1 dit « Elle arrive sur une **conversation**, pas un formulaire » ; FR-012 impose un écran de consentement dédié **avant** toute collecte sensible ; FR-055 et FR-067 supposent un compte (gratuit à vie, export, suppression). Le moment où le compte est créé — avant la séance, ou au paywall — n'est écrit nulle part, et c'est le paramètre qui décide du taux d'achèvement, donc de la première métrique du produit.
3. **Le « bilan ».** Il porte le paywall (FR-014), il borne la gratuité (FR-055, « jusqu'au bilan ») et il n'est jamais défini : artefact écrit ou dernier message ? Reste-t-il consultable pour un compte gratuit qui ne convertit pas, alors que FR-058 promet que « le compte gratuit n'est jamais coupé à zéro » ?
4. **Durée de conservation** des données et sort des comptes inactifs — absente, alors que NFR-005 prévoit une AIPD qui l'exigera.
5. **Accès humain aux journaux.** NFR-002 interdit les outils d'analyse et de marketing, mais rien ne dit si un opérateur — Julian, Anima, un support — peut lire une conversation. Sur un corpus article 9, c'est une décision produit, pas un détail d'exploitation.
6. **Conditions imposées au fournisseur du modèle.** Les confidences transitent nécessairement vers un modèle tiers. NFR-002 est formulée avec précision sur l'analyse, le marketing et la publicité, et reste muette sur le fournisseur : pas d'exigence de non-entraînement sur les données, pas d'exigence de localisation ni d'accord de sous-traitance. Ce n'est pas un choix d'implémentation — c'est une contrainte que le PRD doit poser et que l'architecture devra respecter.
7. **Remboursement.** La contre-métrique cite le « taux de remboursement » ; aucune exigence ne décrit de politique ni de parcours.
8. **Révocation du consentement.** FR-012 la promet « à tout moment » ; le comportement du produit après révocation n'est écrit nulle part.

### Constats
- **CRITIQUE** — Aucun âge minimum ni traitement des mineures (§1, §5, § Conformité) — un produit qui collecte des données de l'article 9, encaisse un abonnement et gère un risque suicidaire ne peut pas rester muet sur l'âge ; la question ressortira à la validation juridique et forcera une reprise de l'entrée. *Correctif :* une exigence d'âge minimum avec sa méthode de contrôle, et une ligne dans le protocole de détresse.
- **ÉLEVÉ** — Le parcours d'entrée n'est spécifié nulle part (§1, UJ-1) — création de compte, authentification, ordre exact écran de consentement / début de la conversation, tout est implicite alors que UJ-1 promet « pas un formulaire » et que FR-012 impose un écran préalable. *Correctif :* un parcours d'entrée écrit, du premier écran au premier message d'Anam.
- **ÉLEVÉ** — Aucune contrainte posée sur le fournisseur du modèle (NFR « Sécurité et données ») — non-entraînement sur les données, localisation, sous-traitance : trois exigences absentes sur un corpus article 9. *Correctif :* trois NFR, formulées en contraintes et non en choix de fournisseur.
- **ÉLEVÉ** — Aucune section « Non-buts » ni marquage des omissions (tout le document) — le brief en a une (« Dehors, et assumé »), le PRD ne la porte pas. *Correctif :* reprendre la liste du brief, et marquer explicitement ce que le PRD a choisi de ne pas traiter (paiement récurrent en échec, mineures, accès opérateur…) plutôt que de le laisser inférer.
- **MOYEN** — Entête de brouillon périmé et trompeur (lignes 10-12) — annonce comme manquantes six sections livrées, et masque le seul manque réel (le parcours de naissance d'une branche). *Correctif :* réécrire l'entête sur l'état réel, ou le supprimer et passer le `status` à `review`.
- **MOYEN** — Le « bilan » n'est jamais défini alors qu'il porte le paywall (FR-014, FR-055, FR-058) — nature de l'artefact et persistance pour un compte gratuit indéterminées. *Correctif :* une exigence dédiée.
- **MOYEN** — Durée de conservation, accès humain aux journaux, comportement après révocation du consentement et politique de remboursement : quatre omissions non signalées (§ NFR, §7, §8). *Correctif :* une exigence chacune, ou un `[NON-BUT v1]` explicite.

---

## 6. Utilisabilité en aval — **mince**

La rubrique note que cette dimension compte davantage pour un PRD en tête de chaîne. C'est exactement le cas ici : l'UX et l'architecture sont annoncées comme suivantes.

| Critère de la rubrique | Statut |
|---|---|
| Glossaire présent ; chaque nom de domaine employé à l'identique partout | **Non conforme** |
| Identifiants FR / UJ / SM contigus, uniques, références résolues | **Partiellement conforme** — FR et NFR impeccables, aucun identifiant de métrique |
| Chaque section a du sens extraite seule | **Partiellement conforme** |
| Chaque UJ a une protagoniste nommée, aucun UJ flottant | **Conforme** |

**Ce qui est propre.** FR-001 à FR-068 : contigus, uniques, sans trou, répartis en huit blocs cohérents. NFR-001 à NFR-018 : idem. Trois UJ numérotés, tous portés par Camille, aucun parcours orphelin. C'est un travail d'identifiants sérieux, et c'est rare.

**Absence de glossaire, sur un produit qui invente son propre vocabulaire.** Le document crée ou détourne au moins onze termes de domaine : séance, bilan, restitution, lecture, ancrage, branche, arbre, naissance / feuillaison / fruit, socle, journal brut, faits extraits, synthèse périodique, plan d'étapes. Aucun n'est défini en un seul endroit. Trois dérives concrètes en découlent :

1. **« Ancrage » contre « mantra du jour » — l'ambiguïté tombe sur la ligne de revenu.** FR-023 : « le format court quotidien, **un ancrage** ». FR-055 place le « mantra du jour » **quotidien** dans le gratuit. FR-056 place « **les ancrages** » dans le premium. Le document décrit donc deux formats courts quotidiens, l'un gratuit, l'autre payant, sans jamais les distinguer. C'est la frontière gratuit/premium — la chose qu'un développeur doit implémenter sans se tromper.
2. **« Restitution » a deux sens.** FR-003 : « Au moins **trois moments de restitution** interviennent avant la clôture » — un moment de valeur en séance. FR-021 : « Chaque lecture produit une **restitution écrite** conservée et consultable » — un artefact. Le critère d'acceptation « au moins trois restitutions sont intervenues avant la clôture » hérite de l'ambiguïté et devient testable de deux façons.
3. **« Anam » contre « Anima ».** Deux noms séparés par une lettre, jamais définis dans le PRD : Anam est l'application, Anima la praticienne (le brief l'établit, pas le PRD). Selon cette convention, FR-054 est juste — « les textes […] proviennent du **corpus d'Anima** » — et **FR-022 est faux** : « Le jeu de cartes est **propriétaire** — visuels créés pour Anima » désigne un actif de l'application, donc d'Anam. Le titre du dossier (`prd-Anima-2026-07-21`) ajoute au brouillage.

**Aucun identifiant de métrique.** Le tableau des métriques n'a pas de colonne d'identifiants : rien en aval ne peut référencer « la contre-métrique de dérive de durée » autrement qu'en la recopiant.

**Extraction isolée.** Plusieurs sections se tiennent seules (détresse, socle, mémoire). Deux ne s'y prêtent pas : §7 « Frontière gratuit / premium » suppose connus « ancrages », « plans d'étapes » et « synthèse périodique » qui ne sont définis ni là ni ailleurs ; §4 « Les deux rythmes » suppose la doctrine socle-impersonnel / Anam-rare, qui n'est explicitée que dans le `.memlog.md`.

### Constats
- **ÉLEVÉ** — Ambiguïté « ancrage » / « mantra du jour » sur la frontière gratuit/premium (FR-023, FR-033, FR-055, FR-056) — deux formats courts quotidiens, un gratuit et un payant, jamais distingués. *Correctif :* définir les deux dans un glossaire et corriger les libellés de FR-055/FR-056.
- **ÉLEVÉ** — Aucun glossaire sur un produit à vocabulaire propriétaire (tout le document) — onze termes de domaine créés, aucun défini ; l'UX et l'architecture les redéfiniront chacune à leur façon. *Correctif :* une section « Glossaire » d'une page, en tête ou en queue.
- **MOYEN** — FR-022 confond l'application et la praticienne (§2 « Le rituel de lecture ») — « visuels créés pour Anima » devrait dire Anam selon la convention du projet. *Correctif :* corriger, et poser la distinction Anam / Anima dans le glossaire.
- **MOYEN** — « Restitution » employé en deux sens (FR-003 contre FR-021, repris dans les critères d'acceptation) — moment de valeur en séance, ou artefact écrit. *Correctif :* deux termes distincts.
- **MOYEN** — Aucun identifiant sur les métriques (§ Métriques) — rien en aval ne peut y faire référence. *Correctif :* SM-001 à SM-006 et CM-001 à CM-005.

---

## 7. Adéquation de forme — **adéquat**

La rubrique : *« Has the PRD been forced into a shape that doesn't match the product? »* — et pour ce cas précis : *« Consumer product / meaningful UX → UJs with named protagonists are load-bearing »* et *« Chain-top (feeds UX → architecture → stories) → downstream usability matters more »*.

| Critère | Statut |
|---|---|
| Forme adaptée au type de produit (grand public, très UX → parcours porteurs) | **Conforme** dans le principe |
| Ni sur-formalisé (densité de parcours pour un outil mono-opérateur) | **Conforme** |
| Ni sous-formalisé (produit grand public sans parcours) | **Partiellement conforme** |
| Rigueur ajustée aux enjeux convenus | **Conforme** — la barre « produit financé » est tenue sur la forme |

La méthode retenue est la bonne — le `.memlog.md` acte « COACHING par les PARCOURS (journey-led), protagoniste nommée Camille » — et les trois parcours écrits sont excellents : concrets, datés dans le temps de la relation, avec des phrases réelles. UJ-2 est un petit chef-d'œuvre de retenue : « **Elle a peut-être passé une minute dans l'app. C'est un succès.** » Une phrase qui annule à elle seule toute la pression d'engagement que l'équipe subira plus tard.

**Mais trois parcours couvrent environ un tiers de la surface d'exigences.** Sur huit blocs de FR, les parcours ne touchent que la séance (§1), partiellement les branches et les rythmes (§3, §4), et le rituel (§2). N'ont **aucun** parcours :

- **La naissance d'une branche** — le moment où le mécanisme central se produit, promis par l'entête (« naissance d'une branche (parcours dédié) ») et jamais écrit. Neuf exigences (FR-024 à FR-032) reposent sur un moment qu'aucun parcours ne montre.
- **Un épisode de détresse** — dix exigences et un protocole à quatre niveaux, sans une seule scène. C'est le passage qui doit être relu par un professionnel qualifié : un parcours narratif y serait plus utile qu'ailleurs, parce qu'un clinicien juge une conversation, pas un tableau.
- **Le paywall** — le moment de conversion, l'objet du pari économique, n'est décrit qu'en une phrase à la fin d'UJ-1.
- **La vie du compte gratuit à vie** (FR-058) — personne ne montre ce que voit, six mois après, une utilisatrice qui n'a pas converti.
- **La consultation et la correction de ce qu'Anam retient** (FR-063, FR-064) — un écran dédié, sans parcours, alors que c'est le lieu où se joue la confiance.

Deux frictions mineures de forme s'ajoutent : UJ-2 décrit des fonctionnalités payantes (l'arbre, les branches, les étapes) sans dire que Camille a souscrit, ce qui laisse croire qu'elles sont disponibles par défaut ; et un trait horizontal sépare visuellement les sections d'exigences 1-4 des sections 5-8, qui appartiennent pourtant au même niveau.

### Constats
- **ÉLEVÉ** — Cinq moments décisifs sans parcours (§3, §5, §7, §8) — naissance d'une branche, détresse, paywall, vie du compte gratuit, consultation de la mémoire ; sur un produit grand public conduit par les parcours, les zones sans parcours sont celles où l'UX inventera. *Correctif :* au minimum le parcours de naissance d'une branche (déjà promis) et un parcours de détresse — ce dernier sert directement la relecture clinique exigée par l'encadré.
- **FAIBLE** — UJ-2 mêle gratuit et payant sans le dire (§ Parcours) — arbre, branches et étapes y apparaissent sans mention de souscription. *Correctif :* une incise (« Camille a souscrit à la fin de sa première séance »).

---

## Notes mécaniques

- **Continuité des identifiants** — FR-001 à FR-068 : contigus, uniques, aucun doublon, répartition par section cohérente (14 / 9 / 9 / 4 / 10 / 8 / 7 / 7). NFR-001 à NFR-018 : contigus, uniques. UJ-1 à UJ-3 : contigus. **Aucun identifiant de métrique.** Aucune référence croisée cassée : le document ne pratique pas les renvois internes.
- **Roundtrip de l'index des hypothèses** — sans objet : ni tag `[HYPOTHÈSE]` inline, ni index. Voir dimension 5.
- **Protagonistes des parcours** — les trois UJ portent Camille, nommée, avec son âge. Le contexte qui la rend utile (elle « y croit à moitié », elle arrive échaudée, la honte au bureau) reste dans l'addendum ; les parcours fonctionnent quand même, mais l'exigence de discrétion perd son fondement (voir dimension 2).
- **Dérive de glossaire** — trois cas relevés : ancrage / mantra du jour, restitution en deux sens, Anam / Anima (FR-022). Détail en dimension 6.
- **Cohérence du lexique interdit** — NFR-008 présente une liste « Autorisé » et une liste « Interdit ». Lu comme une liste blanche, le vocabulaire propre au produit (branche, arbre, lecture, ancrage, prise de conscience) serait interdit ; le critère d'acceptation tranche implicitement pour une liste noire (« rejette tout terme interdit »). À expliciter. Par ailleurs, la liste « Autorisé » de NFR-008 a perdu « prise de conscience » et « se réaliser », présents dans l'addendum §7 et employés en permanence dans le PRD (FR-028, FR-042, FR-062).
- **Piège d'implémentation du contrôle automatisé** — FR-023 proscrit « le mot **soin** et ses dérivés ». Un contrôle par sous-chaîne rejetterait « be**soin** », mot très courant en français et naturel dans la voix d'Anam (« je suis là si besoin »). Le contrôle doit opérer sur des lemmes ou des frontières de mots, et sa liste d'exceptions fait partie de l'exigence.
- **Sections attendues à la barre « produit financé »** — présentes : contexte/thèse, parcours, exigences fonctionnelles, exigences non fonctionnelles, métriques et contre-métriques, critères d'acceptation. Absentes : glossaire, non-buts / périmètre de version, hypothèses indexées, questions ouvertes. Les objectifs sont présents mais implicites, portés par la colonne « Objectif » du tableau des métriques — ce qui suffit.
- **Métadonnées** — `status: draft` dans le frontmatter, cohérent avec l'entête mais pas avec l'état réel du contenu. Voir le constat sur l'entête périmé.

---

## Constats classés par gravité

### CRITIQUE

1. **La garantie de sécurité est inatteignable pour un compte gratuit.** FR-043 : « **Aucun paywall, aucune limite d'usage, aucune sollicitation commerciale** ne peut interrompre une conversation en détresse — **y compris pour un compte gratuit**. » Or FR-055 limite le gratuit à « la première séance intégrale » et FR-056 place « conversation illimitée avec Anam » dans le premium : après sa première séance, une utilisatrice gratuite n'a plus de conversation du tout. Soit FR-043 est sans objet hors séance 1, soit il implique une réouverture de la conversation sur détection de détresse pour un compte gratuit — comportement substantiel, non spécifié, non testé, et par ailleurs impossible à déclencher puisque la détection n'opère qu'à l'intérieur d'une conversation. S'y ajoute qu'aucune ressource d'aide n'est accessible en dehors d'une conversation : une utilisatrice gratuite en détresse qui ouvre l'application ne trouve ni Anam, ni le 3114. *Correctif :* trancher explicitement (accès permanent à une conversation de soutien pour tous les comptes, ou point d'entrée d'aide persistant indépendant de l'abonnement), l'écrire en exigence, et l'ajouter aux critères d'acceptation de la détresse.
2. **Les deux doctrines centrales ne sont ni implémentables ni testables** — FR-004 (conditions de sortie de phase « explicites », non fournies) et FR-007 (« ce que la personne est prête à entendre », sans signal observable). Tout le produit repose dessus, et rien en aval ne peut les construire ni prouver qu'elles fonctionnent.
3. **Aucun âge minimum, aucun traitement des mineures**, sur un produit qui collecte des données de l'article 9 par la conversation, encaisse un abonnement en ligne et embarque un protocole de risque suicidaire.

### ÉLEVÉ

4. **Trois fonctionnalités payantes sans spécification** — « les ancrages », « les plans d'étapes », « la synthèse périodique » (FR-056), sans bloc d'exigences ni critère d'acceptation.
5. **Ambiguïté « ancrage » (premium, FR-056) contre « mantra du jour » (gratuit, FR-055)** — deux formats courts quotidiens jamais distingués, sur la ligne de revenu exactement.
6. **Le parcours d'entrée n'existe pas** — création de compte, authentification, articulation entre l'écran de consentement obligatoire (FR-012) et la promesse « pas un formulaire » (UJ-1). C'est le paramètre qui décide du taux d'achèvement de la première séance, première métrique du produit.
7. **Aucune contrainte posée sur le fournisseur du modèle** — non-entraînement sur les données, localisation, sous-traitance : absents des NFR de sécurité, alors que les confidences article 9 y transitent nécessairement. Contrainte produit, pas choix d'architecture.
8. **Aucune exigence de disponibilité**, alors que FR-039 promet qu'« Anam ne quitte jamais la conversation » et FR-043 que « la conversation continue, quoi qu'il arrive » : le comportement en cas d'indisponibilité du modèle pendant un épisode de détresse n'est pas spécifié.
9. **Aucun plafond de coût par abonnée** face à un prix fixé à 69 €/an. NFR-012 et NFR-013 décrivent des leviers d'optimisation sans cible ; l'addendum pose l'économie mais le PRD ne pose aucune borne, sur un produit dont la marge est la condition de survie.
10. **Métriques non mesurables ou dégradées par rapport au brief** — « Note ≥ 4,0 » suppose une présence sur un store, alors que NFR-018 acte « Web d'abord […] Aucun achat intégré en v1 » ; le seuil plancher de 3,5 et la conversion ≥ 2,9 % du brief ont disparu ; « Taux d'achèvement de la première séance » et « Branches créées et validées » n'ont aucune cible.
11. **Tension non résolue entre mesure et protection** — les contre-métriques exigent durée moyenne de séance et fréquence d'usage, tandis que NFR-002 interdit tout traceur tiers sur les écrans de conversation ; rien ne dit comment on mesure. Symétriquement, FR-046 interdit d'exploiter les épisodes de détresse « à des fins d'analyse produit », ce qui rend le protocole non auditable après la mise en ligne.
12. **Critères d'acceptation absents sur quatre sections d'exigences sur huit** (rythmes, socle, frontière gratuit/premium hors résiliation, mémoire) et **aucune traçabilité FR → critère**.
13. **Cinq moments décisifs sans parcours** — naissance d'une branche (promis par l'entête, jamais écrit), détresse, paywall, vie du compte gratuit à vie, consultation et correction de la mémoire.
14. **Asymétrie acquisition / rétention** — 14 exigences pour la séance gratuite, 4 pour le rythme des mois suivants, alors que la métrique décisive est le renouvellement à 12 mois et que la thèse dit que « la relation dans la durée est le produit payant ».
15. **Aucune section « Non-buts »** et aucun marquage des omissions, alors que le brief en porte une.
16. **Aucune question ouverte, aucune hypothèse indexée**, alors que l'amont en documente sept encore vivantes.
17. **Aucun glossaire** sur un produit qui crée onze termes de domaine propres.

### MOYEN

18. **FR-038 se contredit avec son propre tableau** — « la bascule est silencieuse aux niveaux 0 à 2 […] Seul le niveau 3 est explicite », alors que la réponse de niveau 2 consiste à « **nommer ce qu'elle a entendu** », « **demander directement** » si la personne pense à se faire du mal, et mentionner le 3114. Le niveau 2 est explicite ; la bascule silencieuse tient aux niveaux 0 et 1.
19. **FR-042 sans fenêtre temporelle** — le mécanisme de branches est désactivé « pendant **et après** un épisode » sans durée, alors que c'est une règle de sécurité.
20. **Critère de hasard incorrect** — « deux tirages successifs sur le même profil donnent des cartes différentes » échoue sur un générateur correct.
21. **Sept exigences bornées par des adjectifs** — FR-034 « spécifique », FR-036 « trop », FR-065 « au bon moment », FR-066 « intervalle régulier » (l'addendum disait hebdomadaire), NFR-014 « rapidement » sans budget, NFR-017 sans objectif de durabilité, FR-042 ci-dessus.
22. **Entête de brouillon périmé** — annonce comme manquantes six sections livrées, et masque le seul manque réel.
23. **Le « bilan » n'est jamais défini** alors qu'il porte le paywall (FR-014) et borne la gratuité (FR-055).
24. **Quatre omissions non signalées** — durée de conservation des données, accès humain aux journaux, comportement après révocation du consentement (FR-012), politique de remboursement (impliquée par la contre-métrique).
25. **Arbitrages sans justification dans le PRD** — paywall à J0 (FR-014), absence de gamification (FR-031), pas d'achat intégré (NFR-018) : les preuves existent dans l'addendum et ne survivent pas à la lecture isolée du document.
26. **FR-022 confond l'application et la praticienne** — « visuels créés pour Anima » devrait dire Anam.
27. **« Restitution » employé en deux sens** (FR-003 contre FR-021), ambiguïté héritée par les critères d'acceptation.
28. **Aucun identifiant sur les métriques et contre-métriques.**
29. **Aucun périmètre de version dans le PRD** — le MoSCoW acté en amont n'apparaît nulle part ; 68 exigences sont présentées à plat.

### FAIBLE

30. **NFR-008 ambiguë entre liste blanche et liste noire**, et sa liste « Autorisé » a perdu « prise de conscience » et « se réaliser », employés en permanence dans le document.
31. **Le contrôle automatisé du lexique doit opérer sur des lemmes** — un test par sous-chaîne sur « soin » rejette « besoin ».
32. **Objectif « La distribution démarre » sans contre-métrique** — seul « — » du tableau, sur ce que le brief désigne comme le vrai risque.
33. **« Dix abonnées qui paient et reviennent » — « reviennent » n'est pas défini** ; le brief disait « ouvrent Anam chaque semaine ».
34. **La discrétion (FR-035, NFR-015) est exigée sans son motif**, ce qui la rendra négociable sous pression.
35. **UJ-2 mêle gratuit et payant sans le dire.**
36. **Trait horizontal séparant les sections d'exigences 1-4 des sections 5-8**, qui sont de même niveau.

---

## Ce qu'il faut protéger dans ce document

Une revue qui ne liste que des manques donne une fausse image. Cinq choses sont au-dessus de la barre d'un produit financé et ne doivent pas être perdues dans la reprise :

1. **Les contre-métriques appariées** — chaque métrique de succès gardée par une métrique qui empêche le produit de devenir ce qu'il a promis de ne pas être. C'est un dispositif que très peu de PRD financés possèdent.
2. **La règle qui suspend la règle** — « Anam refuse de flatter. Elle ne refuse jamais de soutenir. » Une doctrine formulée à l'endroit exact où deux principes du produit entrent en collision.
3. **La doctrine du tirage** — FR-015, FR-016, FR-019 : le hasard réel, l'interdit de la curation déguisée, la personnalisation qui vit dans la lecture et jamais dans la sélection. C'est du raisonnement produit de premier ordre, et c'est vérifiable à la revue de code.
4. **Les NFR qui excluent** — NFR-004 (pas d'inférence d'émotion vocale), NFR-003 (audio supprimé), FR-031 (aucun score), FR-061 (aucun dark pattern). Un produit se définit autant par ce qu'il refuse de construire.
5. **L'encadré de la section 5** — le seul avertissement du document, posé à la seule vraie tension, avec sa condition de levée. C'est le modèle des callouts qui manquent ailleurs.
