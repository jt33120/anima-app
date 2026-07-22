---
title: "Revue sécurité et conformité — PRD Anam"
status: draft
created: 2026-07-21
document_revu: "prd.md (statut : draft, 2026-07-21)"
posture: adversaire
---

# Revue sécurité et conformité — PRD Anam

**Périmètre.** `prd.md` v du 21/07/2026. Références croisées : `brief.md`, `addendum.md` §7 (Conformité), `anam-voice.md` §10-13, `market-…-research-2026-07-21.md` §risques réglementaires.

**Méthode.** Chaque constat cite l'exigence fautive (FR-xxx / NFR-xxx) ou nomme l'exigence absente. Les remarques de checklist sans conséquence concrète ont été écartées. Les exigences correctives proposées poursuivent la numérotation existante (FR-069+, NFR-019+) pour être insérables telles quelles.

---

## Verdict

Le PRD est **remarquablement mûr sur l'éthique de la voix et remarquablement immature sur le traitement des données**. Il énonce des garde-fous (art. 9, AI Act, lexique, anti-*dark pattern*) mais **n'ordonne presque aucun des mécanismes qui les rendent vrais** : aucune durée de conservation, aucun encadrement des sous-traitants IA alors que les confidences intimes leur sont envoyées par construction (NFR-012/013), aucune exigence d'authentification ni de contrôle des accès administrateur, aucun mot sur l'âge, et un protocole de détresse dont la **défaillance n'est ni mesurée ni compensée**. En l'état, le PRD n'est pas implémentable sans reconstituer ces décisions au fil du code — c'est-à-dire sans les prendre par défaut.

---

## Ce qui est bien traité (et ne sera pas commenté plus loin)

- **FR-012 / FR-013 / NFR-006 / NFR-007** — consentement art. 9 sur écran dédié, séparé des CGU, avant collecte, révocable, portant la déclaration IA. Base légale correctement identifiée, précédent Replika correctement intégré.
- **FR-043** — aucun paywall, aucune limite d'usage pendant un épisode de détresse, y compris en compte gratuit. C'est la meilleure exigence du document : elle subordonne explicitement le revenu à la sécurité. Elle sera reprise plus loin comme **modèle** à étendre.
- **FR-046 / NFR-002** — interdiction d'exploiter les données sensibles à des fins d'analyse, de marketing ou de publicité ; aucun traceur tiers sur les écrans de conversation.
- **NFR-004** — refus de l'inférence d'émotion vocale. Choix conservateur et juste (l'AI Act n'interdit la reconnaissance d'émotions qu'au travail et en éducation, art. 5(1)(f) — mais le terrain probatoire est mauvais et la posture est cohérente avec le positionnement).
- **NFR-005** — AIPD avant mise en ligne. Obligatoire ici, correctement posée.
- **NFR-008 + critère d'acceptation « Le lexique »** — contrôle automatisé bloquant avant publication. C'est la bonne forme : une règle exécutable, pas une intention.
- **FR-060 / FR-061 / FR-031** — résiliation trois clics, prix unique sans prix barré ni rareté artificielle, aucun score. Anti-*dark pattern* tenu.
- **FR-063 / FR-064** — transparence de la mémoire et droit de correction. Bonne traduction produit des art. 15 et 16 (mais voir É-3 : le mécanisme les défait).

---

## Synthèse des constats

| # | Gravité | Constat | Exigence visée |
|---|---|---|---|
| C-1 | **CRITIQUE** | Aucune exigence sur les sous-traitants IA, les transferts hors UE, la non-réutilisation pour l'entraînement, la rétention côté fournisseur | absente ; NFR-012, NFR-013 les rendent nécessaires |
| C-2 | **CRITIQUE** | Faux négatifs de la détection de détresse : ni mesurés, ni compensés ; aucun accès aux ressources indépendant de la détection | §5 dans son ensemble, NFR-012, critère d'acceptation « La détresse » |
| C-3 | **CRITIQUE** | Les dangers non suicidaires (violences en cours, enfant en danger) ont disparu entre `anam-voice` §13.2 et le PRD ; FR-044 ne liste ni le 15/112, ni le 3919, ni le 119 | FR-044, tableau des quatre niveaux |
| C-4 | **CRITIQUE** | Silence total sur l'âge, alors que la date de naissance est déjà collectée et que le risque est documenté en amont | absente ; FR-010 |
| C-5 | **CRITIQUE** | Aucune durée de conservation nulle part, combinée à un journal brut déclaré immuable | absente ; FR-062 |
| É-1 | ÉLEVÉ | Sécurité réduite au chiffrement et au RLS : rien sur l'authentification, l'accès administrateur, la journalisation, la violation de données | NFR-001 |
| É-2 | ÉLEVÉ | La « suppression totale » promise n'est pas tenable : sauvegardes, sous-traitants, journaux fournisseur ; et elle contredit NFR-017 | FR-067, NFR-017 |
| É-3 | ÉLEVÉ | Le droit d'effacement est défait par le design : branche indélébile + journal immuable ⇒ ré-extraction d'un fait supprimé | FR-029, FR-062, FR-064 |
| É-4 | ÉLEVÉ | Données sensibles de tiers (l'ex, la mère, le patron) structurées dans les « faits extraits », sans base légale ni traitement de l'art. 14 | FR-062 |
| É-5 | ÉLEVÉ | FR-038 est en contradiction interne avec FR-040 et avec `anam-voice` §13.3 | FR-038, FR-040 |
| É-6 | ÉLEVÉ | Un niveau de risque suicidaire persistant = donnée de santé + argument de requalification en dispositif médical | FR-037, FR-038 |
| É-7 | ÉLEVÉ | Les contre-métriques de dépendance sont décoratives : agrégées, sans seuil, sans propriétaire, sans conséquence — face à un modèle « conversation illimitée » | §Métriques, FR-036, FR-056 |
| É-8 | ÉLEVÉ | Révocation du consentement : aucune conséquence définie ; consentement conditionnant l'accès à tout le service | FR-012 |
| M-1 | MOYEN | Aucune exigence de politique de confidentialité ni d'information art. 13 | absente |
| M-2 | MOYEN | « Chiffré au repos » non qualifié : contre quel adversaire ? | NFR-001 |
| M-3 | MOYEN | Le résumé glissant peut faire sortir un épisode antérieur du contexte de sécurité | NFR-013 |
| M-4 | MOYEN | Streaming sans contrôle de sortie préalable | NFR-014 |
| M-5 | MOYEN | Panne du fournisseur de modèle pendant un épisode = violation mécanique de FR-039 | FR-039 |
| M-6 | MOYEN | FR-046 interdit littéralement la mesure de sécurité exigée par C-2 | FR-046 |
| M-7 | MOYEN | Niveaux et formulations désalignés entre PRD §5 et `anam-voice` §13 | §5 |
| M-8 | MOYEN | « Pendant et après un épisode » : « après » non borné, dans les deux sens | FR-042, FR-043 |
| M-9 | MOYEN | FR-007 décrit une évaluation de la disponibilité psychique — formulation dangereuse | FR-007 |
| M-10 | MOYEN | Aucune minimisation de la charge utile envoyée au modèle (le prénom réel part avec les confidences) | FR-010, NFR-013 |
| M-11 | MOYEN | Rien n'interdit de cibler ou de relancer sur un état de vulnérabilité détecté (AI Act art. 5(1)(b)) | absente |
| F-1 | FAIBLE | La promesse figée « dans un an, tu sauras où tu vas » est une promesse d'état | NFR-010 |
| F-2 | FAIBLE | « Revue périodique planifiée » sans fréquence ni responsable | FR-044 |
| F-3 | FAIBLE | Déclaration IA limitée à l'onboarding ; mention persistante et réponse sur demande non exigées | FR-013 |
| F-4 | FAIBLE | Aucun mode pseudonyme, alors que la recherche amont lie divulgation et anonymat perçu | absente |

---

# CRITIQUE

## C-1 — Les confidences les plus intimes partent chez un sous-traitant que le PRD ne nomme, ne qualifie, ni ne contraint

**Exigence visée :** absente. Rendue indispensable par **NFR-012** (« modèle léger pour l'échange courant, modèle fort réservé à la détection… ») et **NFR-013** (« Contexte long **mis en cache** entre appels »).

**Le constat.** Le PRD organise en détail *comment* envoyer les données à un fournisseur de modèle de langage — découpage par tâche, mise en cache du contexte long, résumé glissant — et **ne dit pas un mot** de ce fournisseur. Ni son identité, ni sa localisation, ni le contrat qui le lie, ni ce qu'il a le droit de faire des données. **NFR-002** ne couvre que les outils d'analyse, de marketing et de publicité : le fournisseur de modèle n'est ni l'un ni l'autre, il passe entre les mailles.

**Pourquoi c'est critique.** C'est le seul endroit du système où la totalité des données de l'article 9 — confidences sur la santé mentale, la vie affective, la vie sexuelle, les convictions philosophiques — quitte l'infrastructure du responsable de traitement, en clair, à chaque tour de conversation. Trois obligations sont engagées simultanément et aucune n'est exprimée :

1. **Art. 28** — contrat de sous-traitance, instructions documentées, interdiction de sous-traitance ultérieure non autorisée.
2. **Art. 44-49** — la quasi-totalité des fournisseurs de premier plan sont américains ; il faut un mécanisme de transfert et une analyse d'impact du transfert. Le consentement de l'art. 49.1.a comme fondement d'un transfert *systématique et répétitif* n'est pas soutenable.
3. **Finalité et conservation chez le tiers** — la rétention par défaut (journaux d'abus conservés plusieurs semaines chez la plupart des fournisseurs) et la réutilisation pour l'entraînement doivent être contractuellement exclues. Ce n'est pas un réglage d'API : c'est une clause.

Et **NFR-013 aggrave** : la mise en cache du contexte long signifie que des données art. 9 sont **matérialisées et persistées sur l'infrastructure du fournisseur**, pas seulement transitées. C'est une exigence de coût qui crée une exposition juridique, et rien ne l'encadre.

Le même trou couvre **NFR-003** : « en saisie vocale, seule la transcription est conservée, l'audio est supprimé après traitement ». Supprimé **où** ? Si la transcription est faite par un tiers, l'audio a quitté le périmètre et sa suppression n'est pas dans les mains du produit.

**Exigence corrective**

> | **NFR-019** | Tout sous-traitant traitant des données de l'article 9 (fournisseur de modèle, transcription, hébergement, paiement) fait l'objet d'un **contrat art. 28** et est inscrit dans une **liste publique de sous-traitants** tenue à jour. Le contrat impose : **aucune réutilisation pour l'entraînement**, **rétention nulle ou plafonnée à 30 jours** pour les journaux d'abus, **notification de violation sous 24 h**, **suppression sur instruction**. |
> | **NFR-020** | Le traitement des conversations est réalisé **dans l'Union européenne** par défaut. Tout transfert hors UE exige un mécanisme de l'art. 46 (clauses types) **et** une analyse d'impact du transfert documentée dans l'AIPD (NFR-005). Le consentement art. 49.1.a n'est pas admis comme fondement d'un transfert systématique. |
> | **NFR-021** | La mise en cache du contexte (NFR-013) chez un fournisseur tiers n'est autorisée que si sa **durée de rétention est contractuellement plafonnée et documentée**. À défaut, le cache est local au responsable de traitement. |
> | **NFR-022** | La transcription vocale est réalisée **sans transmission de l'audio à un tiers**, ou avec une garantie contractuelle de suppression immédiate et vérifiable. NFR-003 est réputé non satisfait tant que le point de suppression n'est pas nommé. |

---

## C-2 — Le protocole de détresse ne prévoit pas sa propre défaillance

**Exigences visées :** §5 dans son ensemble ; **NFR-012** ; critère d'acceptation « La détresse ».

**Le constat.** Le protocole décrit avec soin ce qu'Anam fait **quand elle a correctement détecté**. Il ne dit rien de ce qui se passe quand elle ne détecte pas. Trois manques précis :

**a) Aucune mesure du faux négatif.** Le critère d'acceptation prévoit « sur un jeu de cas de test validé par un professionnel, Anam ne quitte jamais la conversation · aucun paywall ne s'interpose · le 3114 est présenté correctement aux niveaux 2 et 3 ». Tous ces tests présupposent que **le niveau a été correctement établi**. Ils vérifient la réponse, jamais la classification. Aucune exigence ne fixe un **rappel cible** sur les niveaux 2 et 3, n'impose un jeu de test contenant des cas **implicites, ironiques, métaphoriques ou étalés sur plusieurs jours** — précisément ceux que `anam-voice` §13.2 identifie comme les plus difficiles — ni ne prévoit une **revue humaine des cas manqués** en production. `anam-voice` §13.2 avertit explicitement : « la détection par IA produit des faux positifs ET des faux négatifs ». Le PRD a repris la prudence rédactionnelle et abandonné la conséquence : **il n'y a aucun dispositif pour savoir si ça marche.**

**b) Aucun chemin vers les ressources qui ne dépende pas de la détection.** Tout le protocole est conditionné au déclenchement. Si la détection rate, l'utilisatrice en niveau 3 se trouve face à une compagne d'introspection qui continue son travail de schéma — ce que FR-037 interdit pourtant en principe. Il n'existe **aucune exigence de ressource permanente, accessible sans détection** : pas de mention discrète, toujours atteignable, hors flux conversationnel. C'est le correctif le moins cher et le plus efficace du document : il transforme une défense unique en défense en profondeur.

**c) La détection de sécurité n'est affectée à aucun modèle, et le seul arbitrage de coût existant la défavorise.** **NFR-012** réserve le modèle fort à « la détection de bascule et à la synthèse périodique ». Or le mot « bascule » désigne **deux choses différentes** dans le même document : les moments de bascule des branches (**FR-024**) et la bascule du protocole de détresse (**FR-038**). Lu littéralement du côté FR-024, la détection de détresse — qui se produit dans « l'échange courant » — **tourne sur le modèle léger**. Aucune exigence ne l'interdit. Une optimisation de coût s'est glissée sur le chemin critique de sécurité par simple ambiguïté lexicale.

**Exigence corrective**

> | **FR-069** | Un **accès permanent aux ressources d'urgence**, indépendant de toute détection, est disponible depuis chaque écran de conversation : discret, non alarmant, atteignable en un geste. La détection de détresse est un dispositif d'**amélioration**, jamais le seul chemin vers l'aide. |
> | **FR-070** | La détection de détresse est évaluée avant mise en ligne sur un **jeu de cas étiqueté par un professionnel qualifié**, comportant des formulations implicites, ironiques, métaphoriques et des dégradations réparties sur plusieurs sessions. Un **taux de rappel cible sur les niveaux 2 et 3** est fixé avec ce professionnel et constitue un critère de mise en ligne bloquant. |
> | **FR-071** | En cas d'**incertitude de classification**, le système retient **le niveau le plus élevé** parmi les niveaux plausibles. Un faux positif est un désagrément ; un faux négatif est un défaut critique. |
> | **FR-072** | Une **revue périodique des épisodes manqués** est réalisée, sur un échantillon minimal et strictement encadré (voir NFR-026), et alimente la révision des seuils avec le professionnel qualifié. |
> | **NFR-023** | La détection de détresse s'exécute sur le **modèle le plus capable disponible**, sur **chaque tour** de conversation, sans exception d'optimisation de coût. NFR-012 est modifié en conséquence : la répartition par tâche ne s'applique jamais au chemin de sécurité. Le terme « bascule » de NFR-012 désigne exclusivement FR-024. |

---

## C-3 — Le protocole ne couvre que le suicide, sur un produit qui recueillera d'abord des violences

**Exigences visées :** **FR-044**, tableau des quatre niveaux.

**Le constat.** `anam-voice` §13.2 classait explicitement en niveau 3 : « **Danger venant d'autrui : violences en cours, menaces, séquestration** » et « **Mention d'un enfant en danger** ». Ces deux lignes **ont disparu du PRD**. Le tableau des niveaux ne connaît qu'un seul axe — l'idéation suicidaire — et **FR-044** ne liste que deux ressources : le 3114 et SOS Amitié. `anam-voice` §13.5 mentionnait pourtant aussi le **15 / 112** comme ressource d'urgence vitale « à citer si un danger est en cours » : cette ressource a également disparu.

**Pourquoi c'est critique.** Le produit vise des **femmes de 25-34 ans**, invite à la confidence intime tardive et solitaire, et construit une mémoire longue de la vie affective. La probabilité qu'il recueille une révélation de violences conjugales, d'emprise ou de violences sexuelles est proche de la certitude, et probablement supérieure à celle d'une idéation suicidaire. Dans ce cas de figure, **le 3114 est la mauvaise ressource** et SOS Amitié est insuffisante. Le produit répondra à côté, avec la sérénité d'un protocole qu'il croit complet. Le cas de la révélation de violences était d'ailleurs listé comme point ouvert dans `anam-voice` §13.7 (« Que fait Anam en cas de révélation de violences subies ou de mise en danger d'un tiers ? ») : le PRD ne l'a ni tranché ni signalé comme ouvert — il l'a perdu.

Ajout aggravant : la mention d'un **enfant en danger** engage un registre entièrement différent (119), et sa disparition n'est pas une omission de rédaction mais une **régression fonctionnelle** par rapport à la source amont explicitement citée comme « amont acté » en tête de PRD.

**Exigence corrective**

> | **FR-073** | Le protocole couvre **quatre familles de danger**, pas une : (a) idéation et conduite suicidaires, (b) **danger provenant d'un tiers** — violences en cours, menaces, emprise, séquestration, (c) **enfant en danger**, (d) danger vital immédiat quelle qu'en soit la cause. Chaque famille a ses signaux propres et sa ressource propre. |
> | **FR-074** | FR-044 est étendue. Les ressources vérifiées et maintenues à jour sont : **3114** (prévention du suicide, gratuit, 24h/24) · **15 ou 112** (urgence vitale en cours) · **3919** (violences faites aux femmes, gratuit, anonyme, 24h/24) · **119** (enfance en danger, gratuit, 24h/24) · **SOS Amitié** (écoute, niveau 2). La ressource affichée correspond à la famille de danger détectée ; en cas de doute, la ressource d'urgence vitale prime. |
> | **FR-075** | En cas de danger provenant d'un tiers, Anam **ne conseille jamais de conduite à tenir** (partir, rester, porter plainte, confronter). Elle nomme, elle reste, elle oriente vers la ressource. Un conseil erroné dans ce contexte peut aggraver le danger physique. |

---

## C-4 — Le PRD ne dit rien de l'âge, alors qu'il collecte déjà la date de naissance

**Exigence visée :** absente. **FR-010** collecte la donnée nécessaire et ne l'utilise pas.

**Le constat.** Aucune exigence, nulle part, ne mentionne un âge minimum, une déclaration d'âge, une adaptation du protocole aux mineures, ou même le fait que la question se pose. C'est un angle mort **déjà identifié en amont** : `anam-voice` §13.7 listait « **Mineurs : le produit doit-il vérifier l'âge ? Le protocole diffère.** » comme point ouvert à trancher. Le PRD ne l'a pas tranché : il l'a laissé tomber, sans même le reporter en point ouvert.

**Pourquoi c'est critique.** La recherche amont documente **exactement** ce risque, avec les sanctions :
- **Replika, 5 M€** — RGPD : absence de base légale valide, information insuffisante, **et absence de vérification d'âge fonctionnelle**. C'est le précédent que le brief cite déjà pour justifier FR-012 ; il porte simultanément sur l'âge, et cette moitié-là n'a pas été reprise.
- **Character.AI** — chat ouvert **totalement supprimé pour les moins de 18 ans** depuis novembre 2025, après des procès portant sur la santé mentale d'adolescents.

Le contexte juridique est net : en France, le consentement d'un mineur à un service en ligne n'est valable qu'à partir de **15 ans** (art. 8 RGPD, art. 45 loi Informatique et Libertés) ; en deçà, le consentement conjoint du titulaire de l'autorité parentale est requis. Pour un consentement **explicite au titre de l'art. 9**, portant sur des confidences intimes recueillies par un agent à mémoire longue, la position défendable est plus haute. Et l'**AI Act art. 5(1)(b)** interdit l'exploitation des vulnérabilités liées à l'âge.

**Ce qui rend l'omission particulièrement coûteuse :** le produit **collecte déjà la date de naissance** en entrée obligatoire (FR-010, FR-048) pour calculer le socle. Le contrôle d'âge ne coûte **aucune donnée supplémentaire, aucun écran supplémentaire, aucune friction** — il se déduit d'un champ déjà saisi. C'est une des rares corrections de cette revue dont le coût d'implémentation est à peu près nul et le bénéfice de conformité maximal.

Et le protocole de détresse **change** pour une mineure : les ressources ne sont pas les mêmes (Fil Santé Jeunes, 119), et le risque de mise en cause est d'un autre ordre.

**Exigence corrective**

> | **FR-076** | Le service est **réservé aux personnes majeures**. Les CGU l'énoncent, et la **date de naissance déjà collectée par FR-010** est utilisée pour vérifier la condition d'âge **avant** l'écran de consentement FR-012. Aucune donnée supplémentaire n'est demandée pour ce contrôle. |
> | **FR-077** | Si la date de naissance saisie correspond à une personne mineure, la séance **ne démarre pas**. Un écran explique la raison, sans jugement, et affiche les ressources adaptées aux jeunes (**Fil Santé Jeunes 0 800 235 236**, **3114**, **119**). Aucune donnée de conversation n'est créée. |
> | **FR-078** | Une **déclaration d'âge cohérente** est exigée : une date de naissance modifiée après coup pour franchir le seuil ne rouvre pas l'accès sans revue. Le socle astrologique et la vérification d'âge lisent le **même** champ — il ne peut pas y en avoir deux. |
> | **NFR-024** | Le refus d'accès pour minorité et la **date de naissance déclarée** sont conservés au titre de la preuve de conformité, séparément des données de conversation, et ne sont utilisés à aucune autre fin. |

*Nota — arbitrage assumé :* fixer le seuil à 18 ans plutôt qu'à 15 ferme une part du « plus gros réservoir de conversion » identifié par la recherche (les moins de 25 ans). C'est un coût commercial réel. Il est proposé quand même : le secteur a déjà produit deux sanctions sur ce point exact, et un projet porté par une entité unique n'a pas les moyens d'un contentieux impliquant une mineure.

---

## C-5 — Aucune durée de conservation, sur une archive verbatim déclarée immuable

**Exigences visées :** absente ; **FR-062** l'aggrave ; **FR-067** ne la remplace pas.

**Le constat.** Le PRD ne contient **aucune durée de conservation**. Pas une. Ni pour le journal brut, ni pour les faits extraits, ni pour les branches, ni pour les restitutions écrites (FR-021), ni pour les épisodes de détresse (FR-046 dit « avec le même niveau de protection » — pas « pendant N mois »), ni pour les comptes inactifs, ni après résiliation, ni pour les sauvegardes.

Et **FR-062** pose l'inverse d'une politique de conservation : « le **journal brut** (verbatim, **jamais altéré**) ». Le document le plus sensible du système est explicitement désigné comme un **archivage intégral et perpétuel** de tout ce qu'une personne aura confié.

**Pourquoi c'est critique.** L'art. 5.1.e impose une durée n'excédant pas ce qui est nécessaire aux finalités. Une conservation indéfinie de données art. 9 est un manquement autonome, indépendant de la qualité du consentement — et c'est **le premier point que vérifie un contrôle**, parce qu'il est objectivable en une requête. **FR-067** (export et suppression totale) ne corrige rien : il donne un droit à l'utilisatrice ; il ne crée aucune obligation pour le responsable de traitement. Un compte abandonné en 2027 conservera son journal en 2035.

Le raisonnement produit qui a conduit à FR-062 est par ailleurs contestable en soi : `addendum` §6 dit que « la mémoire est une **extraction structurée** + un rappel au bon moment + une synthèse périodique, **pas un stockage de conversations** ». Le verbatim perpétuel n'est donc même pas requis par l'architecture mémoire décrite en amont — il est requis par **FR-027** (chaque branche liée à l'extrait exact) et **FR-021**, qui portent sur des **extraits**, pas sur l'intégralité.

**Exigence corrective**

> | **NFR-025** | Une **durée de conservation est fixée par couche de mémoire** et documentée dans l'AIPD : journal brut **24 mois glissants** ; extraits rattachés à une branche (FR-027) et restitutions écrites (FR-021) **conservés tant que la branche existe** ; faits extraits **tant que le compte est actif** ; épisodes de détresse **12 mois maximum**. Au-delà, suppression automatique et irréversible. FR-062 est amendée : le journal brut est **inaltérable pendant sa durée de conservation**, il n'est pas perpétuel. |
> | **NFR-026** | **Compte inactif** : après **24 mois** sans connexion, une notification est envoyée ; sans réaction sous 30 jours, le compte et toutes ses données sont supprimés. **Après résiliation** : conservation limitée à **3 mois** (fenêtre de réactivation annoncée), puis suppression. Les données de facturation sont conservées séparément selon la durée légale comptable. |
> | **NFR-027** | Les **sauvegardes** ont une rotation maximale de **35 jours**. Une suppression demandée au titre de FR-067 est réputée effective lorsqu'elle a traversé le cycle complet de sauvegarde ; ce délai est annoncé à l'utilisatrice. |

---

# ÉLEVÉ

## É-1 — La sécurité tient en une ligne et demie, et laisse dehors tout ce qui produit les incidents réels

**Exigence visée :** **NFR-001** — « Le journal et les conversations sont chiffrés au repos et en transit. Isolation stricte par utilisatrice (RLS). »

C'est la totalité de la sécurité du PRD. Ce qui n'y figure pas :

**a) L'authentification.** Le mot n'apparaît nulle part dans le document. Ni politique de mot de passe, ni second facteur, ni durée de session, ni procédure de récupération de compte. Sur ce produit, la **récupération de compte est le vecteur d'attaque le plus probable** : une prise de contrôle donne accès non pas à un profil, mais à l'intégralité des confidences d'une personne, structurées et résumées pour être lisibles en cinq minutes. Le RLS ne protège de rien contre un attaquant authentifié comme la victime.

**b) L'accès administrateur.** Rien. Le projet est porté par deux personnes, dont une praticienne dont le métier consiste précisément à lire des vies. Elles auront, par construction, accès à la base de production. **FR-046** interdit l'exploitation à des fins d'analyse produit ou de marketing — il n'interdit pas la **lecture humaine**. Aucune exigence n'impose de séparation des rôles, de procédure d'accès exceptionnel, de journalisation de cet accès, ni d'information de l'utilisatrice. C'est le risque le plus probable du système, et il n'est pas nommé.

**c) La journalisation.** Aucune trace d'accès n'est exigée. Conséquence directe : en cas de suspicion de fuite, **il sera impossible de déterminer ce qui a été consulté**, donc impossible de qualifier la violation, donc impossible de notifier correctement sous 72 h.

**d) La procédure de violation de données.** Rien sur les art. 33 et 34. Or ici, la notification **aux personnes concernées** (art. 34) serait quasi automatiquement due : données art. 9, risque élevé pour les droits et libertés. Une procédure improvisée le jour J est une seconde faute par-dessus la première.

**Exigence corrective**

> | **NFR-028** | **Authentification** : second facteur disponible et **fortement incité** ; la procédure de récupération de compte ne doit **jamais** permettre de reprendre la main sur les données sans une preuve de possession indépendante du seul courriel ; sessions expirantes ; alerte à l'utilisatrice à chaque nouvelle connexion depuis un appareil inconnu. |
> | **NFR-029** | **Accès administrateur** : aucun accès en lecture au journal, aux conversations ou aux faits extraits en dehors d'une **procédure d'accès exceptionnel** — motif écrit, durée limitée, **journalisé de manière inaltérable**, et **notifié à l'utilisatrice** sauf interdiction légale. L'accès en clair par confort d'exploitation, de support ou de curiosité est interdit et techniquement empêché. |
> | **NFR-030** | **Journalisation** : tout accès aux données art. 9, humain ou automatisé, est tracé (qui, quoi, quand, pourquoi) dans un journal séparé, à conservation propre (12 mois), non modifiable par les comptes qu'il trace. |
> | **NFR-031** | **Violation de données** : procédure écrite avant mise en ligne — détection, qualification, notification CNIL sous **72 h**, notification aux personnes concernées (art. 34, **présumée due** compte tenu de la nature des données), registre des violations. La procédure est testée une fois à blanc avant la mise en ligne. |

---

## É-2 — La « suppression totale » est une promesse que le système décrit ne peut pas tenir

**Exigences visées :** **FR-067**, en tension avec **NFR-017**, et dépendante de C-1.

**FR-067** promet « **export complet** et **suppression totale** du compte et des données ». Trois obstacles, aucun traité :

1. **Les sauvegardes.** Une suppression logique laisse les données dans les sauvegardes jusqu'à rotation. Rien ne fixe cette rotation (voir NFR-027 proposée).
2. **Les sous-traitants.** Les journaux du fournisseur de modèle, le cache de contexte (NFR-013), les données Stripe, l'audio confié à un service de transcription (NFR-003). Sans les clauses de C-1, **le responsable de traitement n'a aucun moyen d'exiger cette suppression**, encore moins de la vérifier. « Suppression totale » est alors littéralement faux.
3. **La contradiction interne avec NFR-017** — « **Aucune entrée de journal ne peut être perdue.** […] Une perte est un défaut critique, pas un incident. » Une exigence de durabilité maximale et une exigence d'effaçabilité totale sur le même objet, sans règle d'arbitrage, produiront en pratique la victoire de la première : c'est celle qui est qualifiée de « défaut critique ».

**Exigence corrective**

> | **FR-079** | FR-067 est précisée : la suppression est **effective sur le système principal sous 72 h**, **propagée aux sous-traitants sous 30 jours** avec preuve contractuelle (NFR-019), et **effective en sauvegarde** au terme du cycle de rotation (NFR-027). Ces trois délais sont **annoncés à l'utilisatrice** au moment de la demande. Aucune formulation du produit ou du marketing ne promet une suppression « immédiate » ou « totale » sans ces réserves. |
> | **NFR-032** | Arbitrage explicite entre NFR-017 et FR-067 : **la durabilité protège contre la perte accidentelle, jamais contre la suppression demandée.** Une suppression à l'initiative de l'utilisatrice l'emporte toujours sur toute exigence de conservation ou d'intégrité du produit. |

---

## É-3 — Le droit d'effacement est neutralisé par deux principes de design

**Exigences visées :** **FR-029**, **FR-062** contre **FR-064**.

Deux mécanismes, chacun défendable isolément, se combinent en un blocage :

**a) La ré-extraction.** **FR-064** permet de « corriger ou supprimer n'importe quel fait extrait ». Mais **FR-062** rend le journal brut « jamais altéré » : le passage source du fait supprimé reste. Rien n'empêche le système de **ré-extraire le même fait** au prochain cycle. L'utilisatrice supprime, le fait revient. Du point de vue de l'art. 17, l'effacement est illusoire ; du point de vue de l'expérience, c'est une trahison caractérisée du contrat de confiance que FR-063 et FR-064 viennent d'établir.

**b) La branche indélébile.** **FR-029** : « L'arbre ne régresse jamais. **Aucune branche ne disparaît**, ne rétrécit, ne se fane. » **FR-064** ne couvre que les *faits extraits* — pas les branches. Une utilisatrice qui a nommé une branche sur une relation dont elle veut effacer la trace n'a, littéralement, **aucun droit de la supprimer**. Ce n'est pas un oubli : c'est une exigence produit qui contredit frontalement l'art. 17.

L'intention derrière FR-029 est bonne et doit être préservée. Elle porte sur ce que **le système** s'interdit de faire (ne pas dégrader, ne pas punir, ne pas faire faner), pas sur ce que **l'utilisatrice** a le droit de faire.

**Exigence corrective**

> | **FR-080** | Un fait supprimé au titre de FR-064 est inscrit dans une **liste de suppression persistante**. Il ne peut **jamais** être ré-extrait, ré-inféré ni réintroduit dans le contexte du modèle, y compris depuis le journal brut. La suppression d'un fait entraîne, au choix de l'utilisatrice, la **suppression du passage source** correspondant dans le journal brut. |
> | **FR-081** | FR-029 est précisée : **la règle de non-régression contraint le système, jamais l'utilisatrice.** Celle-ci peut supprimer une branche et son extrait source à tout moment, en un geste, sans justification et sans écran de dissuasion. Anam ne commente pas la suppression et ne cherche pas à en connaître la raison. |

---

## É-4 — Le produit construit des profils sensibles sur des tiers qui n'ont rien consenti

**Exigence visée :** **FR-062** (couche « faits extraits », « profil vivant »), et l'ensemble de la mécanique mémoire.

**Le constat.** Une confidence intime porte rarement sur soi seul. Le journal contiendra, avec une quasi-certitude : l'ex-conjoint, la mère, la sœur, le supérieur hiérarchique, l'enfant — nommés, identifiables, et décrits dans ce qu'ils ont de plus sensible (santé, orientation sexuelle, violences, convictions). La persona de référence elle-même — « séparée depuis huit mois », « une entreprise qui l'épuise » — garantit la présence de ces tiers.

La couche **faits extraits** transforme ce matériau en **profil structuré et requêtable**. Le produit ne se contente donc pas de stocker des propos rapportés : il **construit un profil de personnes qui ne sont pas ses utilisatrices**, sur des données art. 9, sans base légale et sans qu'elles puissent exercer le moindre droit.

**Pourquoi c'est élevé et non critique.** L'exemption de l'art. 14.5.b (effort disproportionné) est plausible et la finalité est strictement personnelle du point de vue de l'utilisatrice. Mais l'exemption « activité personnelle ou domestique » de l'art. 2.2.c **ne protège pas le responsable de traitement** — elle protège l'utilisatrice, pas l'éditeur qui exploite l'infrastructure. La position est tenable ; elle n'est pas tenue par le PRD, qui ne l'a pas identifiée.

**Exigence corrective**

> | **FR-082** | La couche **faits extraits** (FR-062) ne conserve les informations relatives à des tiers que sous forme **relationnelle et non identifiante** (« son ancien compagnon », « sa supérieure »), jamais sous forme de fiche nominative structurée. Les identifiants directs de tiers (nom, employeur, adresse) ne sont pas extraits. |
> | **FR-083** | Anam ne **sollicite jamais** d'information sur un tiers pour elle-même : elle ne pose pas de question dont l'objet est le tiers plutôt que ce que l'utilisatrice en vit. |
> | **NFR-033** | Le traitement de données de tiers est **explicitement analysé dans l'AIPD** (NFR-005) : base légale retenue, articulation avec l'art. 14.5.b, mesures de minimisation, et modalités de réponse si un tiers exerce ses droits. |

---

## É-5 — FR-038 se contredit avec FR-040 et avec sa propre source amont

**Exigences visées :** **FR-038** contre **FR-040** et le tableau des niveaux.

**FR-038** : « la **bascule est silencieuse** aux niveaux **0 à 2** : l'utilisatrice **ne doit pas sentir qu'un dispositif s'est déclenché sur elle**. Seul le niveau 3 est explicite. »

**FR-040** et le tableau, pour ce même niveau 2 : Anam « **nomme ce qu'elle a entendu** et **demande directement** », et « mentionne le 3114 ». La formulation de référence citée est : *« Attends. Je veux être sûre d'avoir bien entendu. […] est-ce que tu penses à te faire du mal ? »*

Une interruption brutale du fil, une question directe sur les idées suicidaires et la mention d'un numéro national de prévention **ne sont pas une bascule silencieuse**. Les deux exigences sont incompatibles au niveau 2, et un développeur qui applique FR-038 à la lettre **supprimera l'intervention de niveau 2** — c'est-à-dire exactement l'intervention la plus utile, celle qui intervient avant l'urgence.

Aggravant : `anam-voice` §13.3 dit l'inverse de FR-038 — « Elle change de mode, **visiblement** mais sans dramatiser ». Le PRD a transformé « sans dramatiser » en « imperceptible », ce qui n'est pas la même chose et n'est pas ce que la source disait.

**Exigence corrective**

> | **FR-038 (révisée)** | Le protocole comporte quatre niveaux. Aux niveaux **0 et 1**, la bascule est **imperceptible** : l'utilisatrice ne doit pas sentir qu'un dispositif s'est déclenché sur elle. Aux niveaux **2 et 3**, la bascule est **assumée mais non dramatisée** : Anam nomme ce qu'elle a entendu et pose sa question directement, sans alarme, sans changement de registre visuel, sans message système, sans encadré. Ce qui est proscrit, c'est la **mise en scène du dispositif**, jamais la franchise de la question. |

---

## É-6 — Stocker un niveau de détresse crée une donnée de santé et un argument de requalification

**Exigences visées :** **FR-037**, **FR-038** ; interaction avec **NFR-008**, **NFR-010**.

**Le constat.** **FR-038** institue une **échelle graduée de risque suicidaire à quatre niveaux**, calculée automatiquement à partir des propos d'une personne. Rien dans le PRD ne dit si ce niveau est **persisté**. S'il l'est — et l'implémentation naturelle est de le persister, ne serait-ce que pour FR-042 (« désactivé pendant **et après** un épisode ») et FR-045 (le lendemain) — alors la base contient, pour chaque utilisatrice, **un score de risque suicidaire daté**. C'est la définition d'une donnée de santé inférée. `anam-voice` §13.7 l'avait vu (« Ces données sont des données de santé inférées ») et posait la question ; le PRD ne l'a pas reprise.

**Le risque de bascule réglementaire.** La qualification d'un logiciel en dispositif médical dépend de sa **destination revendiquée**. Un logiciel destiné à la *prédiction*, au *pronostic* ou à la *surveillance* d'une maladie relève du règlement (UE) 2017/745. Une fonction qui **évalue et gradue le risque suicidaire d'un individu, le stocke, et suit son évolution dans le temps** est exactement ce que ferait un outil de dépistage. La seule défense sérieuse est la **destination déclarée** — et le PRD ne la déclare pas.

C'est le point demandé de la « frontière bien-être / santé » : **l'exigence qui ferait basculer le produit du côté médical n'est pas dans le lexique, elle est dans le protocole de détresse.** Le lexique (NFR-008) est bien tenu, y compris dans les formulations d'exemple de la section 5 — vérifié ligne à ligne : « je veux être sûre d'avoir bien entendu », « des gens formés pour exactement ce moment », aucun terme de la liste interdite, aucune promesse d'état, aucune interprétation. C'est propre. Le danger est en amont du vocabulaire : dans la **fonction**.

**Exigence corrective**

> | **FR-084** | Le niveau de détresse est un **état conversationnel éphémère**, jamais un attribut durable de l'utilisatrice. Il n'est **ni persisté comme score, ni historisé, ni agrégé, ni affiché**, ni utilisé pour segmenter, cibler, prioriser ou personnaliser quoi que ce soit. Seul est conservé un **indicateur binaire et daté** de « période de retenue en cours », strictement au service de FR-042 et FR-045, effacé au terme de cette période. |
> | **NFR-034** | La **destination du dispositif de détection est déclarée négativement** dans la documentation produit, les CGU et l'AIPD : il sert **exclusivement** à suspendre le comportement produit et à présenter des ressources publiques. Il **ne constitue ni un dépistage, ni une évaluation du risque, ni une surveillance, ni une orientation clinique**, et aucune communication ne peut le présenter comme tel. Toute évolution qui donnerait au niveau détecté une valeur en dehors de la conversation déclenche une **réévaluation du statut réglementaire** du produit avant déploiement. |

---

## É-7 — Les contre-métriques de dépendance sont décoratives

**Exigences visées :** tableau **Métriques et contre-métriques** ; **FR-036** ; **FR-056**.

Le PRD affiche trois contre-métriques : durée moyenne de séance qui dérive à la hausse, « fréquence d'usage anormalement élevée », plus de deux à trois branches par mois. Quatre défauts, chacun suffisant pour les rendre inopérantes :

**a) Aucun seuil, aucun propriétaire, aucune conséquence.** « Anormalement élevée » n'est pas défini. Aucune exigence ne dit **ce qui se passe** quand la contre-métrique se déclenche : qui regarde, à quelle fréquence, et quelle décision devient obligatoire. Une contre-métrique sans effet contraignant est un élément de discours, pas un garde-fou.

**b) Elles sont agrégées ; la dépendance est individuelle.** Une moyenne de session peut rester parfaitement stable pendant que 3 % des utilisatrices passent trois heures par nuit dans l'application. **La personne qui a le plus besoin d'un garde-fou est précisément celle qui disparaît dans la moyenne.** C'est le défaut structurel : le PRD surveille le produit, pas les personnes.

**c) Le modèle économique récompense ce que les contre-métriques prétendent surveiller.** **FR-056** vend la « conversation **illimitée** » ; le succès est mesuré par un renouvellement > 60 %. Une utilisatrice dépendante est une abonnée qui renouvelle. Rien dans le PRD ne subordonne le revenu à ce signal — alors que **FR-043 le fait, exemplairement, pour la détresse** : « aucun paywall, aucune limite d'usage, aucune sollicitation commerciale […] y compris pour un compte gratuit ». La structure existe ; elle n'a simplement pas été appliquée à la dépendance.

**d) Aucun garde-fou individuel n'est exigé.** **FR-036** dit qu'Anam « sait proposer une pause » lorsque le rythme s'intensifie « trop » — sans seuil, sans déclencheur, sans obligation. **FR-008** (Anam clôt la séance) ne vaut que pour la première séance. Après conversion, rien ne clôt rien.

**e) Trou spécifique : rien n'interdit à Anam de revendiquer un attachement.** `anam-voice` §10.3 est catégorique — « **Anam ne revendique jamais d'émotions ni d'expériences vécues** » — et §13.4 bannit « je serai toujours là » (« faux, et **déplace la dépendance vers la machine** »). **Aucune de ces deux interdictions n'a été reprise dans le PRD.** **FR-041** ne couvre que le fait de se présenter comme un professionnel de santé, et seulement dans le contexte de la détresse. En dehors de la section 5, **rien dans le PRD n'empêche Anam de dire « tu m'as manqué », « ça me touche », « je serai toujours là »** — c'est-à-dire précisément les phrases qui fabriquent l'attachement que le produit prétend refuser.

**Exigence corrective**

> | **FR-085** | **Anam ne revendique jamais d'émotion, d'affect, de manque, d'attachement ni de permanence.** Elle peut nommer l'attention (« je suis là », « je lis »), jamais le ressenti (« ça me touche », « tu m'as manqué », « je serai toujours là »). Cette règle s'applique **partout**, pas seulement pendant un épisode de détresse, et fait partie du contrôle automatisé du lexique (critère d'acceptation « Le lexique »). |
> | **FR-086** | Les signaux de dépendance sont évalués **par utilisatrice** et non en agrégat : sessions dépassant une durée seuil, sessions nocturnes répétées, nombre de sessions par jour, retour immédiat après clôture. Des **seuils chiffrés** sont fixés avant mise en ligne et documentés. |
> | **FR-087** | Lorsqu'un seuil de FR-086 est franchi, Anam **clôt la session** comme elle clôt la première séance (FR-008) et **propose une pause** (FR-036). La clôture est effective, pas suggérée. Le franchissement répété déclenche une **revue humaine** de la situation, encadrée par NFR-029. |
> | **FR-088** | **Extension de FR-043 à la dépendance :** aucune considération de revenu, de rétention ou de renouvellement ne peut s'opposer au déclenchement d'un garde-fou de FR-087. Une baisse d'usage consécutive à un garde-fou est un **succès** et est comptabilisée comme tel. |
> | **NFR-035** | Chaque contre-métrique du tableau reçoit un **seuil chiffré**, un **propriétaire nommé** et une **action obligatoire** en cas de franchissement. Une contre-métrique sans les trois est retirée du document plutôt que conservée à titre décoratif. |

---

## É-8 — Le consentement est révocable, mais rien ne dit ce que révoquer produit

**Exigence visée :** **FR-012**.

**FR-012** pose un consentement « révocable à tout moment ». Le PRD s'arrête là. Trois questions restent sans réponse, et elles sont toutes structurantes :

1. **Que devient le service ?** L'ensemble du produit — y compris le socle gratuit, puisque le thème natal est une donnée de conviction philosophique — repose sur des données art. 9. Un retrait de consentement rend le service **entièrement impossible**. La révocation équivaut donc à une fermeture de compte, ce que l'utilisatrice doit savoir **avant** de cliquer, sans que cette information soit une manœuvre de dissuasion.
2. **Que deviennent les données ?** Le retrait ne vaut pas effacement automatique en droit, mais ici la finalité disparaît entièrement avec le consentement : la conservation n'a plus de fondement. Aucune exigence ne le dit.
3. **Que devient l'abonnement ?** Rien. Un retrait en cours d'année annuelle (69 €) sans règle de remboursement ouvre un contentieux facile et une mauvaise histoire publique, sur le produit dont le positionnement entier est l'honnêteté.

Point de fond que le PRD ne traite pas : le consentement conditionnant l'accès à **la totalité** du service, son caractère **librement donné** (art. 7.4) est discutable. C'est probablement inévitable ici — il n'existe pas de version du produit sans données art. 9 — mais **cela doit être analysé et justifié dans l'AIPD**, pas ignoré.

**Exigence corrective**

> | **FR-089** | L'écran de FR-012 énonce **avant le consentement** que le service est impossible sans ces données, et que le retrait entraînera la fermeture du compte. Le **parcours de retrait** est aussi accessible que celui du consentement (art. 7.3) et n'excède pas trois actions. |
> | **FR-090** | Un retrait de consentement entraîne : **arrêt immédiat** de tout traitement, **proposition d'export** (FR-067) avant suppression, **suppression** selon FR-079, et **remboursement au prorata** de la période d'abonnement restante. Aucun écran de dissuasion, aucune offre de rétention, aucune relance ne s'intercale. |
> | **NFR-036** | L'AIPD (NFR-005) analyse explicitement le **caractère librement donné** du consentement au regard de l'art. 7.4, le service étant intégralement conditionné à des données de l'article 9, et documente la justification retenue. |

---

# MOYEN

**M-1 — Aucune politique de confidentialité exigée.** Le PRD impose l'écran de consentement (FR-012) mais **aucune information au titre de l'art. 13** : identité du responsable, finalités, destinataires (dont les sous-traitants de C-1), durées (dont C-5), droits, réclamation CNIL. L'écran de consentement n'y supplée pas.
> | **NFR-037** | Une **politique de confidentialité** conforme à l'art. 13 est publiée avant mise en ligne, accessible depuis l'écran FR-012 et depuis les paramètres, et énonce nommément les **destinataires** (NFR-019), les **durées** (NFR-025/026) et les modalités d'exercice des droits. Un **registre des traitements** est tenu. |

**M-2 — « Chiffré au repos » ne dit rien de l'adversaire.** NFR-001 est compatible avec un chiffrement disque de l'hébergeur, qui ne protège ni de l'administrateur, ni d'une clé d'API compromise, ni d'une faille applicative — les trois scénarios réels. Le chiffrement de bout en bout est par ailleurs **impossible** ici : le modèle doit lire le texte en clair. Il faut le dire, plutôt que laisser le marketing suggérer davantage.
> | **NFR-038** | NFR-001 est précisée : le contenu des conversations et du journal est chiffré **au niveau applicatif**, avec des clés gérées hors de la base de données, de sorte qu'un accès direct à la base ne suffise pas à lire les contenus. Le produit **n'affirme jamais** un chiffrement de bout en bout : le traitement par un modèle de langage l'exclut, et cette limite est énoncée honnêtement dans la politique de confidentialité. |

**M-3 — Le résumé glissant peut faire sortir un épisode antérieur du contexte.** NFR-013 remplace l'historique intégral par un résumé glissant. Rien ne garantit que la mention de détresse d'il y a trois jours survive à ce résumé — alors que `anam-voice` §13.2 fait de la « détérioration cumulative sur plusieurs jours » un signal de niveau 2, présenté comme la valeur unique de la mémoire longue. L'optimisation de coût peut donc effacer le signal que le produit revendique comme sa force.
> | **NFR-039** | Les signaux de détresse et les périodes de retenue (FR-084) sont **exclus du résumé glissant** et systématiquement présents dans le contexte, quelle que soit l'ancienneté, pendant toute leur durée de conservation. |

**M-4 — Streaming sans contrôle de sortie.** NFR-014 impose l'affichage en streaming. Si le contrôle de conformité (lexique, absence d'interprétation en mode détresse) est postérieur à la génération, la phrase fautive est **déjà lue** quand elle est détectée.
> | **NFR-040** | Les contrôles bloquants — lexique interdit (NFR-008), interdictions de la section 5, FR-085 — s'appliquent **avant émission** du segment concerné. Le gain de latence de NFR-014 ne peut être obtenu au prix de l'émission d'un contenu non conforme. |

**M-5 — Une panne rend FR-039 mécaniquement fausse.** « Anam ne quitte jamais la conversation » : si l'appel au fournisseur échoue au milieu d'un épisode de niveau 3, elle le quitte — sans le savoir, et au pire moment.
> | **FR-091** | En cas d'indisponibilité du modèle **pendant une période de retenue**, un **repli déterministe** — texte pré-écrit, non généré — maintient la présence et affiche les ressources de FR-074. Le silence système est proscrit dans ce contexte. |

**M-6 — FR-046 interdit littéralement la mesure de sécurité de C-2.** « Jamais exploités à des fins d'**analyse produit** » : la revue des faux négatifs (FR-072) et l'évaluation du rappel sont des analyses. La rédaction, telle quelle, interdit la seule chose qui rendrait le protocole vérifiable.
> | **FR-046 (révisée)** | Les épisodes de détresse sont conservés avec le même niveau de protection que le reste du journal, et **jamais exploités à des fins de segmentation, de marketing, de ciblage, de tarification ou d'optimisation de l'engagement**. Une **exception unique** est admise : l'amélioration de la sécurité elle-même (FR-070, FR-072), sur accès nominatif restreint, journalisé (NFR-030), et documentée dans l'AIPD. |

**M-7 — Les niveaux ne correspondent pas entre les deux documents.** `anam-voice` §13.2 place la question directe et le 3114 au **niveau 3** ; le PRD les place au **niveau 2** ; `anam-voice` §13.6 étiquette « Niveau 3 » des formulations que le PRD reprend en « Niveau 2 ». Les deux documents sont cités comme « amont acté » en tête de PRD. Un développeur ou un professionnel qui les lit ensemble mappera la mauvaise réponse au mauvais signal.
> **Correctif :** faire du PRD §5 la **référence unique** de la numérotation, réaligner `anam-voice` §13 en conséquence avant la validation clinique, et **soumettre au professionnel la version réalignée** — pas les deux.

**M-8 — « Pendant et après un épisode » n'est borné dans aucun sens.** FR-042 désactive la détection de branches « pendant et après » — sans durée. FR-043 suspend tout paywall pendant un épisode — sans condition de fin. Conséquences symétriques : soit la désactivation est perpétuelle et le produit s'arrête, soit elle est arbitraire ; et l'accès illimité gratuit devient trivialement déclenchable par une phrase.
> | **FR-092** | La **période de retenue** consécutive à un épisode a une **durée définie** (proposition : 72 h après un niveau 2, 7 jours après un niveau 3), fixée avec le professionnel qualifié. Pendant cette période s'appliquent FR-037, FR-042 et FR-043. Sa fin est **silencieuse** — jamais annoncée, jamais commentée. Aucune limitation commerciale ne peut être réintroduite pendant cette période, y compris si elle a été déclenchée à tort. |

**M-9 — FR-007 décrit une évaluation de la disponibilité psychique.** « Anam ne nomme que ce que la personne est **prête à entendre**. Le **système évalue cette disponibilité**. » L'intention est juste, la formulation décrit une appréciation clinique automatisée — mauvaise phrase à trouver dans un document produit lors d'un contrôle, et mauvaise consigne pour un développeur.
> | **FR-007 (révisée)** | Anam **diffère une observation** tant que les éléments donnés dans la conversation ne la fondent pas suffisamment, ou tant que l'échange porte des signaux de détresse (section 5). Ce report est une **règle de conduite conversationnelle**, non une évaluation de l'état psychique de l'utilisatrice, et n'est jamais restitué, stocké ni affiché comme tel. |

**M-10 — Aucune minimisation de ce qui est envoyé au modèle.** FR-010 collecte le prénom pour la relation ; rien n'exige de le retirer de la charge utile envoyée au tiers. Le prénom réel voyage donc, à chaque tour, attaché aux confidences.
> | **NFR-041** | La charge utile transmise à un sous-traitant de modèle est **minimisée** : identifiant technique non signifiant, prénom et données d'état civil **substitués** avant émission et réinjectés à l'affichage. Aucune donnée d'identification directe ne quitte l'infrastructure du responsable de traitement lorsqu'elle n'est pas nécessaire à la génération. |

**M-11 — Rien n'interdit d'exploiter la vulnérabilité détectée.** La recherche amont recommande de « vendre l'état, pas la discipline » : le flou, la rupture, la transition. Le produit détecte ces états en interne. Aucune exigence n'interdit de s'en servir pour relancer, notifier, proposer ou tarifer — et l'**AI Act art. 5(1)(b)** interdit l'exploitation des vulnérabilités tenant à la situation d'une personne.
> | **FR-093** | Aucun message, notification, relance, offre, tarification ou variation d'expérience ne peut être **déclenché par un état de vulnérabilité détecté** (détresse, isolement, humeur basse, période de rupture). Le socle quotidien (FR-033) et les rappels liés aux objectifs (UJ-2) sont les seuls déclencheurs autorisés, et sont indépendants de l'état de la personne. |

---

# FAIBLE

**F-1 — La promesse figée est une promesse d'état.** `anam-voice` §14.2 fige « **Dans un an, tu sauras où tu vas — et pourquoi.** », en soutenant qu'elle porte sur des artefacts. « Tu sauras » porte sur un état de connaissance de la personne, pas sur un livrable. **NFR-010** l'interdit ; le contrôle automatisé du lexique porte, lui, sur les termes interdits, pas sur les promesses d'état.
> | **NFR-042** | Le contrôle automatisé du lexique est étendu aux **promesses d'état** (« tu sauras », « tu iras mieux », « tu comprendras ») et couvre **explicitement** les pages de vente, les fiches store, les publications d'acquisition et les courriels, pas seulement l'interface. |

**F-2 — FR-044 : « revue périodique planifiée » sans fréquence ni responsable.** Une exigence qui qualifie elle-même le manquement de « défaut critique » ne peut pas laisser sa propre périodicité indéterminée.
> | **FR-044 (complétée)** | La revue des ressources est **trimestrielle**, assignée nommément, et tracée. Chaque numéro est revérifié à cette occasion. |

**F-3 — La déclaration IA se limite à l'onboarding.** **FR-013** couvre l'écran initial. `anam-voice` §10.2 exige en plus une **mention persistante hors conversation** et une **réponse immédiate et sans esquive** à toute question directe. L'AI Act art. 50 vise l'information de la personne physique qui interagit — l'exigence d'un écran unique au premier contact est une lecture minimale.
> | **FR-094** | La nature d'IA d'Anam est rappelée par une **mention persistante hors conversation**, et Anam répond **toujours et immédiatement** — sans humour, sans esquive — à toute question sur sa nature. Elle distingue explicitement Anam (IA) d'Anima (personne réelle) dès que la confusion est possible. |

**F-4 — Aucun mode pseudonyme.** `addendum` §2 relève que la divulgation de soi augmente avec l'**anonymat perçu**. Le produit exige le prénom (FR-010) ; rien ne permet d'utiliser un prénom d'usage. C'est à la fois une minimisation gratuite et un levier de qualité de la matière recueillie.
> | **FR-095** | L'utilisatrice peut fournir un **prénom d'usage** distinct de son identité civile, sans justification. Le socle calculé n'a pas besoin du prénom réel ; seule la **numérologie fine optionnelle** l'utilise, et cette dépendance est annoncée au moment où elle est proposée. |

---

## Ce qu'il faut faire avant de coder

Par ordre de rendement, tous constats confondus :

1. **Nommer le fournisseur de modèle et son régime contractuel** (C-1). Rien d'autre dans cette liste n'est décidable avant : les durées, la suppression, la minimisation et la localisation en dépendent toutes.
2. **Décider l'âge minimum** (C-4). Coût technique quasi nul, la donnée est déjà collectée ; coût commercial réel et assumé. C'est une décision, pas une tâche.
3. **Fixer les durées de conservation par couche** (C-5). Une demi-journée de travail ; premier point vérifié en cas de contrôle.
4. **Compléter le protocole avant de le soumettre au professionnel** (C-2, C-3, É-5, M-7) : rétablir les dangers non suicidaires, ajouter les ressources manquantes, ajouter l'accès permanent hors détection, corriger la contradiction de FR-038, réaligner la numérotation avec `anam-voice`. **Ne pas faire valider une version amputée** — la validation clinique ne vaut que pour ce qu'on lui soumet.
5. **Écrire les quatre exigences de sécurité manquantes** (É-1) : authentification, accès administrateur, journalisation, violation de données.
6. **Rendre les contre-métriques contraignantes ou les retirer** (É-7). En l'état, elles exposent le projet au reproche exact qu'il adresse à ses concurrents : dire ce qui arrange.

---

*Revue conduite en posture adversaire sur `prd.md` au 21/07/2026. Les exigences correctives sont rédigées pour insertion directe et poursuivent la numérotation du PRD (FR-069 à FR-095, NFR-019 à NFR-042) ; les révisions d'exigences existantes sont signalées par la mention « révisée » ou « complétée ». Cette revue ne se substitue ni à la validation juridique ni à la validation clinique exigées par le PRD lui-même.*
