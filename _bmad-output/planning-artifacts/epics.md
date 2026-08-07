---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-Anima-2026-07-21/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-Anima-2026-07-22/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-Anima-2026-07-21/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-Anima-2026-07-21/EXPERIENCE.md
---

# Anam - Epic Breakdown

## Overview

Ce document fournit le découpage complet en épics et stories pour Anam, en décomposant les exigences du PRD, de la conception UX et de l'architecture en stories implémentables.

## Requirements Inventory

### Functional Requirements

- FR-001 : La première séance se déroule en conversation, sans questionnaire ni formulaire de profil préalable.
- FR-002 : Durée cible de la séance 12 à 20 minutes, sans coupure sur minuteur.
- FR-003 : Au moins trois moments de restitution répartis avant la clôture, jamais concentrés à la fin.
- FR-004 : La séance suit l'arc construire → observer → nommer → clore, avec conditions de sortie de phase vérifiables.
- FR-005 : L'observation nommée n'est jamais délivrée avant la fin de la phase observer.
- FR-006 : Toute observation est formulée en hypothèse réfutable, jamais en verdict.
- FR-007 : Anam ne nomme que ce que la personne est prête à entendre (signaux observables requis avant de nommer).
- FR-008 : Anam clôt la séance elle-même ; l'utilisatrice n'a jamais à s'extraire.
- FR-009 : Si l'observation est contestée, Anam recule sans flatter, rend la main, et la correction est enregistrée comme matière.
- FR-010 : La séance démarre avec le strict minimum : prénom et date de naissance, rien de bloquant en plus.
- FR-011 : L'heure de naissance est optionnelle ; Anam explique ce qui reste disponible et où la trouver.
- FR-012 : Consentement explicite RGPD art. 9 sur écran dédié, séparé des CGU, avant toute collecte sensible, révocable.
- FR-013 : L'écran de consentement porte la déclaration IA (AI Act art. 50).
- FR-014 : Le paywall est présenté à la clôture de la séance, sur le bilan livré — jamais pendant, jamais avant.
- FR-015 : Le tirage de lecture est réellement aléatoire, sans consulter profil, historique ni état émotionnel.
- FR-016 : Interdit de sélectionner une carte servant un message prédéterminé (défaut critique).
- FR-017 : Anam présente la carte et demande ce que l'utilisatrice y voit avant d'en dire le sens.
- FR-018 : La lecture se construit à partir de la projection de l'utilisatrice, jamais d'une signification cataloguée.
- FR-019 : La personnalisation vit dans la lecture, jamais dans la sélection de la carte.
- FR-020 : Aucune prédiction ; Anam ne dit jamais ce qui va arriver.
- FR-021 : Chaque lecture produit une restitution écrite conservée, reprenant les mots de l'utilisatrice.
- FR-022 : Le jeu de cartes est propriétaire ; aucun oracle du commerce n'est embarqué.
- FR-023 : Le mot « soin » et ses dérivés sont proscrits ; format long = « lecture », format court quotidien = « ancrage ».
- FR-024 : Détection des moments de reconceptualisation dans le discours (prise de distance, rupture d'un récit répété).
- FR-025 : Anam propose une branche, ne la décrète jamais.
- FR-026 : L'utilisatrice valide et nomme la branche ; une branche non nommée par elle n'existe pas.
- FR-027 : Chaque branche est datée et liée à l'extrait exact dont elle provient.
- FR-028 : Une branche traverse naissance → feuillaison → rayonnement (pleine lumière) ; le rayonnement n'est jamais inféré, déclaré par l'utilisatrice.
- FR-029 : L'arbre ne régresse jamais du fait du produit (exception unique : droit à l'effacement, FR-067).
- FR-030 : Si plusieurs branches sont ouvertes sans intégration, Anam propose d'en faire vivre une avant d'en ouvrir une autre.
- FR-031 : Aucun score, aucune note, aucune jauge, aucune série.
- FR-032 : Chaque étape est formulée en intention d'implémentation (« si X, alors Y ») et rattachée à une branche.
- FR-033 : Le socle calculé peut se manifester quotidiennement, impersonnel, sans rien exiger.
- FR-034 : Anam ne se manifeste que lorsqu'elle a quelque chose de spécifique à dire ; aucun message générique récurrent.
- FR-035 : Les notifications sont discrètes ; l'aperçu ne révèle ni l'intimité du contenu ni un vocabulaire ésotérique.
- FR-036 : Anam sait proposer une pause lorsque le rythme s'intensifie trop.
- FR-037 : Dès un signal de détresse, tout travail de schéma, de contradiction ou de reconceptualisation est suspendu.
- FR-038 : Protocole de détresse à quatre niveaux ; bascule non annoncée aux niveaux 0-1, ouverte aux niveaux 2-3.
- FR-039 : Anam ne quitte jamais la conversation ; orienter n'est pas abandonner.
- FR-040 : Au niveau 2, Anam demande directement, sans détour ni dramatisation.
- FR-041 : Anam ne se présente jamais comme un professionnel de santé et ne prétend pas prendre en charge.
- FR-042 : Aucune branche ne peut naître d'un moment de détresse (détection désactivée pendant l'épisode et 72 h).
- FR-043 : Aucun paywall, limite d'usage ou sollicitation commerciale n'interrompt une conversation en détresse.
- FR-044 : Ressources d'aide vérifiées et à jour, adaptées au danger (3114, 15/112, 3919, 119, SOS Amitié).
- FR-045 : Le lendemain, Anam ne revient pas lourdement sur l'épisode mais ne fait pas comme si rien.
- FR-046 : Les épisodes de détresse sont conservés au même niveau de protection, jamais exploités (analyse/segmentation/marketing).
- FR-047 : Le socle est calculé, jamais généré par un modèle de langage ; coût marginal nul.
- FR-048 : Obligatoires : prénom, date de naissance ; optionnels : nom complet, heure et lieu de naissance.
- FR-049 : Dégradation gracieuse du socle sans heure (numérologie, soleil, planètes, horoscope ; manquent ascendant/maisons/lune).
- FR-050 : Anam annonce ce qui manque et pourquoi, et indique où trouver l'heure.
- FR-051 : Le tronc de l'arbre est incomplet sans l'heure et se complète lorsqu'elle est ajoutée.
- FR-052 : L'ennéagramme est disponible par test court ou par hypothèse proposée, jamais assénée.
- FR-053 : Le socle ne prédit jamais.
- FR-054 : Les interprétations proviennent du corpus d'Anima ; aucun texte générique acheté ou repris.
- FR-055 : Gratuit à vie : socle complet, mantra du jour, test d'ennéagramme, première séance intégrale, ressources d'aide, tronc.
- FR-056 : Premium : conversation illimitée, branches, lectures, ancrages, plans d'étapes, synthèse périodique, mémoire longue.
- FR-057 : Le passage au premium est proposé à la clôture de la première séance, une seule sollicitation, sans relance agressive.
- FR-058 : Le compte gratuit n'est jamais coupé à zéro ; le socle reste accessible indéfiniment.
- FR-059 : La qualité d'Anam n'est pas dégradée pendant la première séance gratuite.
- FR-060 : Résiliation en trois clics maximum, par la même voie que la souscription ; information avant reconduction tacite.
- FR-061 : Prix affiché unique 69 €/an, sans prix barré, sans rareté artificielle, sans dark pattern.
- FR-062 : Mémoire à trois couches : journal brut (verbatim), faits extraits (profil vivant), branches.
- FR-063 : L'utilisatrice peut consulter ce qu'Anam retient d'elle, en langage clair, sur un écran dédié.
- FR-064 : Elle peut corriger ou supprimer n'importe quel fait extrait.
- FR-065 : Anam rappelle au bon moment plutôt que d'accumuler ; le rappel doit être spécifique et opportun.
- FR-066 : Une synthèse périodique est produite à intervalle régulier.
- FR-067 : Export complet et suppression totale sans friction ; la suppression prime sur FR-029 et se propage aux sous-traitants.
- FR-068 : La mémoire rend la franchise possible : Anam ne compare que parce qu'elle a de quoi comparer.
- FR-069 : Accès réservé aux 18 ans ou plus, affiché à l'inscription et rappelé dans les CGU.
- FR-070 : Date de naissance saisie une fois : alimente le socle et sert de contrôle d'âge ; moins de 18 ans bloque la création.
- FR-071 : Minorité détectée → parcours interrompu, orientation (3018), compte suspendu, suppression sous 30 j, export proposé, remboursement.
- FR-072 : Ordre du parcours d'entrée : compte → déclaration d'âge → consentement art. 9 + IA → première séance.
- FR-073 : Authentification sans mot de passe (lien e-mail ou fournisseur d'identité).
- FR-074 : Les dangers non suicidaires sont couverts (violences en cours, enfant en danger, emprise).
- FR-075 : Anam n'explore jamais les détails d'un plan ou des moyens.
- FR-076 : Anam cherche un humain proche (quelqu'un à appeler ou rejoindre maintenant) et l'y encourage.
- FR-077 : Ressources d'aide accessibles en permanence hors conversation, indépendantes de toute détection.
- FR-078 : La performance de détection est mesurée, faux négatifs inclus, sur un jeu de cas validé par un professionnel.
- FR-079 : Le compte gratuit conserve une allocation résiduelle de conversation, paramétrable.
- FR-080 : Distinction mantra du jour (texte court gratuit, non interactif) / ancrage (exercice guidé interactif premium).
- FR-081 : Spécification des trois premium restants : ancrages, plans d'étapes, synthèse périodique (détail en phase UX).
- FR-082 : Formule fondatrice de la voix : neutre sur le jugement, chaleureuse sur l'attention.
- FR-083 : Paramètres fixes : tutoiement, aucun emoji, aucune exclamation, aucune majuscule d'emphase, français courant.
- FR-084 : Règles de débit : max trois phrases, aucune liste à puces, aucun récapitulatif empathique ni conclusion enveloppante.
- FR-085 : Formulations bannies de anam-voice.md reprises telles quelles, base du contrôle automatisé (phrases, pas que lexique).
- FR-086 : Anam ≠ Anima ; Anam ne fabrique jamais une parole d'Anima (citation uniquement depuis le corpus).
- FR-087 : Anam ne revendique jamais un affect qu'elle n'a pas (« je ressens », « ça me touche » interdits).
- FR-088 : Le tronc est gratuit, les branches premium ; l'utilisatrice gratuite voit son tronc et l'espace vide où pousseraient les branches.
- FR-089 : Garantie de remboursement si aucune branche n'a été posée au bout de trois mois d'abonnement, sur simple demande.

### NonFunctional Requirements

- NFR-001 : Journal et conversations chiffrés au repos et en transit ; isolation stricte par utilisatrice.
- NFR-002 : Les données art. 9 ne transitent jamais vers analytics, marketing ou publicité ; aucun traceur tiers sur la conversation.
- NFR-003 : Saisie vocale : seule la transcription est conservée, l'audio supprimé après traitement.
- NFR-004 : Aucune inférence d'émotion à partir de la voix.
- NFR-005 : Analyse d'impact (AIPD) réalisée avant mise en ligne.
- NFR-006 : RGPD art. 9 : consentement explicite, écran dédié, séparé des CGU, révocable.
- NFR-007 : AI Act art. 50 (applicable au 2 août 2026) : information claire dès la première interaction.
- NFR-008 : Lexique zéro médical sur toute l'interface, tous les contenus, toutes les communications.
- NFR-009 : Positionnement accompagnement, jamais prédiction, y compris dans les fiches des magasins d'applications.
- NFR-010 : Aucune allégation de santé, aucune promesse de résultat.
- NFR-011 : Le socle est déterministe : aucun appel à un modèle pour produire un thème, un nombre ou un horoscope.
- NFR-012 : Découpage par tâche ; la détection de détresse utilise toujours le modèle le plus capable, jamais le léger.
- NFR-013 : Interprétations écrites une fois puis mises en cache ; contexte long en cache sous réserve de NFR-020 ; résumé glissant.
- NFR-014 : Réponse en streaming, premier caractère affiché rapidement.
- NFR-015 : Discrétion : nom, icône et aperçus de notification ne révèlent ni l'intimité du contenu ni un registre ésotérique.
- NFR-016 : Contraste WCAG AA vérifié partout (les pastels désaturés échouent au ratio 4,5:1).
- NFR-017 : Aucune entrée de journal ne peut être perdue ; en vocal, la capture est indépendante du traitement.
- NFR-018 : Web d'abord ; paiement via Stripe ; aucun achat intégré en v1.
- NFR-019 : Le fournisseur de modèle est un sous-traitant art. 28 : interdiction d'entraîner, rétention nulle/minimale, transfert valide.
- NFR-020 : Le cache de contexte ne contient aucune donnée art. 9 en clair chez un tiers, ou est couvert par NFR-019 avec durée bornée.
- NFR-021 : Durées de conservation : inactivité 24 mois → notification puis suppression 3 mois plus tard ; fermeture → 30 j ; export proposé.
- NFR-022 : Sécurité opérationnelle : auth sans mot de passe, accès admin interdit par défaut, journalisation des accès, notification de violation.
- NFR-023 : Âge minimum 18 ans appliqué techniquement et mentionné dans les CGU.

### Additional Requirements

Exigences techniques issues de l'architecture (ARCHITECTURE-SPINE) qui pèsent sur le découpage en épics et stories.

**Décisions d'architecture (invariants AD-1 à AD-18) :**

- AD-1 : Paradigme en couches à dépendance descendante ; le domaine (`lib/domain/`) est pur (0 I/O, aucune dépendance à Next/Supabase/SDK/rendu).
- AD-2 : IA médiée par le serveur ; le navigateur ne parle jamais à un fournisseur IA ; une seule clé serveur (secret Vercel), usage métré dans `usage_ia`.
- AD-3 : Abstraction de fournisseur IA (port `AiPort`) ; aucun SDK fournisseur hors `lib/ai/adapters/` ; défaut Mistral UE ; bascule Opus seulement via route conforme UE.
- AD-4 : Frontière de données sensibles art. 9 : circulation serveur → fournisseur UE-éligible sous ZDR uniquement, jamais vers analytics ni direct-US ; adaptateur sans ZDR/DPA refuse de démarrer.
- AD-5 : Tiering de modèles (léger/fort) via une politique unique ; détection ET réponse de détresse au plus capable, jamais le léger ; à défaut, repli sûr.
- AD-6 : Frontière de déterminisme ; le thème natal est calculé une fois à l'inscription puis stocké, immuable (recalculé seulement si l'heure est ajoutée).
- AD-7 : Scène modèle/rendu séparés ; modèle de scène pur dans `lib/scene/`, rendu = adaptateur remplaçable (DOM/2D v1, WebGL/R3F v2 sans réécriture).
- AD-8 : Mémoire à trois couches (journal/faits/branches) ; arbre strictement monotone gardé à la persistance par une fonction de transition unique + contrainte SQL.
- AD-9 : Haltes toujours joignables (consentement, `/aide`, mention IA) ; drapeau `limites_levees` interdit paywall/quota/abonnement/bilan pendant la détresse.
- AD-10 : Direction des dépendances : client → backend → fournisseur ; rendu → modèle de scène ; applicatif → port IA ; toute arête inverse est un défaut.
- AD-11 : Isolation du tirage de lecture : point d'entrée sans accès profil/historique/état ; graine CSPRNG (jamais dérivée de l'identité), journalisée.
- AD-12 : Accès base lié à l'utilisatrice ; RLS non contournable (JWT, `auth.uid()`) ; `service_role` réservé aux migrations/système, jamais au contenu art. 9.
- AD-13 : Garde de consentement art. 9 : write-gate (aucun dépôt sans consentement valide) + egress-gate (revérification consentement + ZDR dans la transaction d'envoi).
- AD-14 : Propriétaire unique de rétention & effacement (moteur unique, jobs idempotents) ; effacement exhaustif propagé aux caches, sous-traitants et sauvegardes/PITR.
- AD-15 : Filet de sécurité hors-IA ; ressources et `/aide` statiques, indépendantes du fournisseur IA ; repli sûr forçant les haltes, jamais de dégradation en détresse.
- AD-16 : Pipeline par message, sécurité d'abord ; l'évaluation de sécurité s'exécute en premier et peut annuler toute autre écriture du tour ; garde 72 h au point d'écriture.
- AD-17 : L'épisode de détresse est une entité possédée (`episode_detresse`) ; `limites_levees` dérive de `fin IS NULL` ; extinction unique et gardée, jamais levée à vie.
- AD-18 : Faits extraits : provenance, idempotence, tombstones ; la correction utilisatrice prime, jamais de résurrection d'un fait corrigé/supprimé.

**Amorce de stack (SEED) — pas de starter template imposé :**

- Stack vérifiée : Next.js 16.2 (App Router), React 19.2, @supabase/supabase-js 2.110 (Postgres + Auth passwordless + RLS), stripe 22.3, @mistralai/mistralai 2.5 (endpoints stateless/ZDR), TypeScript 5.9.3 (pas 7.0), Node 22 LTS (plancher ≥ 20.9), Vercel (hébergement + secrets serveur + Cron). Éphémérides (`EphemerisPort`) et STT (`SttPort`) déférés.
- Aucun starter/scaffold imposé : projet greenfield Next + Supabase à échafauder en Epic 1 Story 1 (arborescence `app/`, `lib/{domain,scene,ai,astro,safety,data,config}/`, `render/`, `supabase/`).

**Enveloppe opérationnelle (contraintes de build/CI/exploitation) :**

- Un projet Supabase par environnement (dev/prod isolés) ; migrations `supabase/` forward-only, horodatées, appliquées en CI ; la donnée prod ne rejoint jamais un env de dev.
- Toute table art. 9 naît RLS deny-by-default ; une table art. 9 sans politique casse le build (test CI).
- Ordonnanceur unique (Vercel Cron ou pg_cron/Edge Functions) pour tous les mécanismes périodiques : notifications des deux rythmes, rétention/effacement, synthèse ; jobs idempotents.
- Sauvegardes + PITR à fenêtre bornée réconciliés avec l'effacement (fenêtre courte OU crypto-shredding) ; restauration testée, la perte de base n'est pas fatale.
- Tests bloquant le déploiement : (a) jeu de cas de détresse validé + mesure des faux négatifs, (b) contrôle voix & lexique zéro médical, (c) uniformité du tirage sur grand N, (d) RLS deny-by-default.
- Chaque classification de sécurité (détresse, minorité) émet un enregistrement d'audit sans art. 9 (niveau, décision, tier, horodatage).
- Secrets sensibles serveur uniquement (clé IA, `service_role`), rotation documentée ; clé publishable Supabase côté client.
- Routes art. 9 en `no-store`/`dynamic` + CSP stricte (`connect-src` limité au backend Anam) ; aucun moniteur d'erreurs/APM tiers ; journalisation par liste blanche de champs.
- Observabilité : monitoring/alerting sur la santé du classifieur et l'indisponibilité de sécurité (traitée comme incident).

**Portes pré-lancement (déférées — à signaler, ne donnent pas de story de code v1) :**

- Validation du protocole de détresse par un professionnel qualifié + un juriste, avant toute mise en ligne (PRD §5).
- DPA art. 28 + ZDR Mistral payant (plan Scale) requis avant toute vraie donnée art. 9 ; les clés Mistral gratuites = dev/test uniquement.
- Choix de la licence éphémérides (Swiss Ephemeris pro 700 CHF paiement unique, OU lib permissive moins précise) derrière `EphemerisPort`.
- AIPD (NFR-005) et procédure de notification de violation art. 33-34 (NFR-022) définies avant lancement.
- Décision sur le durcissement de l'accès admin / chiffrement au repos par utilisatrice (break-glass audité OU chiffrement applicatif art. 9), tranchée avant art. 9 réel.
- Fournisseur STT (`SttPort`) — sous-traitant art. 9 sous ZDR/DPA ou STT local, avant art. 9 réel.

### UX Design Requirements

Items UX actionnables extraits de DESIGN.md et EXPERIENCE.md.

- UX-DR-1 : Implémenter le système de tokens « Nuit galactique » : mode sombre natif (tokens sans suffixe) comme mode principal + mode d'accessibilité « contraste renforcé / imagerie atténuée » (tokens -clair, via `prefers-contrast: more` et réglage « Lisibilité renforcée »), jamais un thème jour de confort.
- UX-DR-2 : Tokens couleur : fond #0C0A1E, surface #16132F, surface-elevee #201C42, texte #EEECF7 (jamais #FFFFFF), texte-doux #ABA6C9 (jamais pour les mots de l'utilisatrice), deux bordures distinctes (bordure décorative #2A2648 exemptée / bordure-forte #77719C ≥ 3:1), accent #8FC1EF réservé à l'action, lueur #CDE4F8 pour les points de lumière (jamais cliquable), succès/alerte en texte seul, aucun rouge ; plus les équivalents -clair.
- UX-DR-3 : Tokens de l'arbre de vie : tronc #6A6690, branche #9A96BE, feuillage #8FB6D8 (argent lunaire / bleu-lune, aucun brun, aucun or), rayonnement = la branche en pleine lumière (lueur nacre), l'accent réservé au point d'accroche cliquable ; états portés par la matière (épaisseur de trait, densité de feuilles, montée de lumière), jamais par la couleur seule.
- UX-DR-4 : Deux familles typographiques : Fraunces (voix d'Anam — WONK 0, SOFT 20-30, graisse ≤ 500, opsz suivant la taille) et Inter (interface + mots de l'utilisatrice) ; échelle display / titre / titre-sm / anam / corps / meta / surtitre / bouton ; aucune capitale, aucune graisse > 500, interligne ≥ 1.6, ligne ≤ 32rem, tout en rem.
- UX-DR-5 : Espacements sur base 8px (4-8-12-16-24-32-48-64-96) ; marges 20px mobile / 48px desktop ; respiration 40px entre tours (jamais compressée) ; contenu-max 40rem, mesure 32rem ; cible tactile 44px ; colonne unique toujours, un seul niveau de modale.
- UX-DR-6 : Mouvement = fondu lent : durées 180 / 320 / 700 / 4200ms, courbe unique cubic-bezier(0.32,0.08,0.24,1), aucun rebond/ressort/overshoot ; primitives de fondu texte/image/personnage/région, dérive verticale ≤ 6px (jamais latérale) ; aucune ombre en mode nuit, grain ≤ 5 % anti-banding.
- UX-DR-7 : Scène 2D unique, continue et sans bord : cinq régions (accueil/bibliothèque, conversation, arbre, lecture, transparence/aide) reliées en fondu (700ms), ancrage spatial stable (arbre au centre, Anam à gauche) ; strictement 2D en v1, sans WebGL.
- UX-DR-8 : Transitions de région en fondu enchaîné, jamais par basculement d'écran ni glissement latéral ; sous `prefers-reduced-motion`, changement de région instantané (0ms), sans parallaxe.
- UX-DR-9 : Modèle de scène séparé du rendu : view-state client éphémère (région courante, cadrage) distinct de la domain-projection serveur en lecture seule (tronc, branches) ; rendu = adaptateur DOM/2D remplaçable, architecturé pour accueillir la 3D (v2) sans réécriture.
- UX-DR-10 : Séparation des zones par le ton, le voile et la respiration, jamais par un filet qui « ferme » une région ; seuls filets admis = fonctionnels (anneau de focus, contour de champ/contrôle en bordure-forte).
- UX-DR-11 : Navigation : barre basse fixe à 3 entrées (Accueil, Anam, L'arbre) en sm/md, rail latéral gauche en ≥ lg, présentes à l'identique sur compte gratuit et premium (aucun cadenas/grisé/pastille) ; menu de compte en feuille à un seul niveau, « Aide et ressources » toujours première entrée ; aucun badge, aucune pastille de non-lu, aucun compteur.
- UX-DR-12 : Personnage Anam en illustration peinte (jamais photoréaliste) décliné en trois formats : Seuil (4:5, plein cadre, accueil / ouverture de séance), Présence (96-140px, sans cadre ni cercle, bord plumeux fondu dans le fond), Veille (de dos / effacée, silence / fin de séance).
- UX-DR-13 : Le personnage (format Présence) ne paraît qu'à trois beats — ouverture, instant où Anam nomme l'observation, clôture (puis Veille) — jamais à côté d'un tour ordinaire ; entre les beats, seul le signe porte sa présence.
- UX-DR-14 : Signe-anam abstrait (courbe du voile) en argent lunaire (texte) + point de lumière optionnel (lueur), jamais l'accent ; lisible à 12px, respiration 1 → 1,03 sur 4,2s comme état « Anam prépare » ; jamais visage / onde sonore / points sautillants ; livré en SVG.
- UX-DR-15 : Production des assets personnage : découpage seuil / présence / veille + signe SVG ; WebP/AVIF + repli PNG, @2x, loading=lazy, alt sobre non-révélateur ; jamais présents dans l'icône, l'aperçu de notification ni la vignette multitâche.
- UX-DR-16 : Fil de conversation : flux vertical sans bulles opposées, Anam en typographie anam et utilisatrice en corps à pleine valeur (jamais texte-doux) avec filet vertical gauche en bordure-forte ; 3-4 échanges lisibles max, respiration 40px, aucun horodatage / coche / indicateur « en ligne ».
- UX-DR-17 : Apparition d'Anam (format Présence) aux trois beats, émergeant du fond sans cadre en fondu ; sous `prefers-reduced-motion`, elle paraît sans fondu, jamais supprimée.
- UX-DR-18 : Surimpression persistante sans bord (ni fond barré, ni filet, ni bande), sur toutes les régions, lisibilité tenue par le voile : porte le signe d'Anam, la mention IA persistante et la porte de secours en conversation ; ailleurs, seule la porte de secours ; rien d'autre n'y entre, jamais masquée ni repliée.
- UX-DR-19 : Mention IA persistante (« Anam est une IA » + lien vers la page de transparence) toujours présente sur la région de conversation, jamais masquée / repliée derrière un accordéon / dissoute dans le flux (FR-013, AI Act art. 50), jamais sous 13px, jamais sur imagerie sans voile ou zone protégée.
- UX-DR-20 : Porte de secours vers `/aide` : un mot « Aide » en meta / texte-doux, toujours au même endroit, indépendante de toute détection ; jamais rouge / pastille / icône d'alerte / majuscule ; atteignable en deux gestes et deux arrêts de tabulation depuis n'importe où.
- UX-DR-21 : Composeur : champ multiligne auto-extensible (max 6 lignes puis défilement interne), bouton d'envoi, icône micro — rien d'autre ; ne disparaît jamais (y compris après la clôture et pendant un épisode de détresse) ; sm : Entrée = saut de ligne, envoi par bouton ; ≥ md : Entrée envoie, Maj+Entrée insère une ligne.
- UX-DR-22 : Bloc document (bilan, restitution de lecture, synthèse, fiche de thème, plan d'étapes) : registre document (titres, listes, tableaux autorisés), fond surface, séparé du fil par une respiration double, non éditable, copiable, exportable.
- UX-DR-23 : Carte tirée (lecture) : un seul visuel propriétaire pleine colonne, apparition par simple dépôt (sans retournement, scintillement, mélange animé ni son) ; aucune signification cataloguée affichée nulle part avant la réponse de l'utilisatrice.
- UX-DR-24 : Arbre : canevas déplaçable et zoomable (pan au doigt ; zoom pincement / molette / boutons +/− au clavier ; double-tap = cadrer), doublé d'une vue liste de rang égal ; aucun compteur, pourcentage ni légende permanente ; role="img" + aria-label court sur le canevas.
- UX-DR-25 : Interaction centrale branche → extrait source : tap sur le point d'accroche ouvre la fiche, « Voir dans la conversation » positionne sur le message exact (surligné accent + fond accent-doux estompé en 2s), retour au même cadrage/zoom ; l'extrait source est protégé et non supprimable isolément.
- UX-DR-26 : Fiche de branche : étiquette posée sur l'illustration (jamais modale), nom donné par l'utilisatrice (titre-sm) + date (meta) + extrait exact rendu comme un tour-utilisatrice (corps, filet bordure-forte) ; actions « Voir dans la conversation » et « Renommer » ; le reste de l'arbre s'estompe sans flou.
- UX-DR-27 : Proposition de branche (le lendemain seulement) : un tour d'Anam + deux réponses en ligne Oui / Non ; un refus renvoie « Ok. » et n'est jamais rejoué pour le même moment ; champ de nom vide, sans suggestion ni exemple.
- UX-DR-28 : Fiche de fait extrait (« Ce qu'Anam retient ») : une phrase en langage clair + date + lien vers l'extrait source ; deux actions, « Corriger » (édition en place) et « Supprimer » (immédiat + annulation 10s) ; aucun score de confiance affiché.
- UX-DR-29 : Bloc ressources (détresse niveaux 2-3 et page `/aide`) : fiche document en surface-elevee + bordure-forte, jamais alerte / rouge / modale / bloquante ; numéros en lien `tel:`, date « vérifié le … » visible ; numéros d'urgence lus chiffre par chiffre (aria-label « 3 1 1 4 »).
- UX-DR-30 : Cartes de bibliothèque (accueil) : 4 à 6 objets max, ordre fixe non algorithmique, une carte du jour mise en avant en tête ; aucun badge / compteur / cadenas ; aucun symbole astrologique ni chiffre décoratif ; la carte « Anam » ne porte une ligne spécifique que si un motif existe (FR-034).
- UX-DR-31 : Carte d'abonnement : prix unique 69 €/an sans prix barré / compte à rebours / mention de rareté, action de refus « Pas maintenant » de lisibilité strictement égale, garantie de remboursement écrite sur la carte en meta, à côté du prix.
- UX-DR-32 : Halte consentement art. 9 + déclaration IA : une seule page sans défilement infini, trois blocs (deux phrases max), deux cases distinctes non pré-cochées (art. 9 séparée de CGU + 18 ans), « Lire le détail » en accordéon en place, action « Je commence » désactivée tant que non coché (motif écrit en texte), sortie honnête « Je ne veux pas » supprimant le compte.
- UX-DR-33 : Halte détresse (interface) : bloc ressources inséré dans le fil (niveau 2 après le tour d'Anam, niveau 3 avant), jamais de modale / redirection / écran de blocage, composeur actif gardé au focus, démontage commercial immédiat via `limites_levees`, aucune sémantique d'alerte visuelle ; le lendemain, aucune trace dans l'interface.
- UX-DR-34 : Halte paywall : sous le bilan uniquement, dans le fil (pas de modale, plein écran ni interstitiel), une seule sollicitation jamais rejouée dans la session ; « M'abonner » → Stripe Checkout hébergé, « Pas maintenant » de lisibilité égale ; retour Stripe sobre, sans message d'échec dramatisé ni relance.
- UX-DR-35 : Halte clôture de séance : Anam clôt en un tour (trois phrases max), respiration double, puis bilan inséré comme bloc document, puis carte d'abonnement dessous ; le composeur reste actif, aucun bouton « Terminer » ni « Reprendre la séance ».
- UX-DR-36 : Contraste WCAG 2.2 AA vérifié sur toute la surface (ratios mesurés, propriété de DESIGN.md), `lang="fr"` ; mode sombre et mode accessibilité vérifiés au même niveau.
- UX-DR-37 : Doublage non-spatial de rang égal : chaque région atteignable directement au clavier et au lecteur d'écran par un lien nommé sans traverser la scène, ordre de lecture linéaire garanti ; vue liste de l'arbre équivalente (état écrit en toutes lettres : naissance / feuillaison / rayonnement).
- UX-DR-38 : `prefers-reduced-motion` : aucune croissance animée, aucun dépôt de carte, aucun fondu de fil ni de transition de région, aucun épaississement du signe, aucune parallaxe ; transitions instantanées, textes apparaissant complets.
- UX-DR-39 : Voiles de lisibilité obligatoires sous tout texte blanc posé sur imagerie : mécanisme A (scrim en dégradé de fond, opacité ≥ 85 % sous texte courant / ≥ 70 % sous grand texte, grain anti-banding) ou mécanisme B (panneau surface ≥ 92 %) ; tailles minimales (jamais < 13px ; corps/anam ≥ 15-16px sur image) ; text-shadow interdit comme substitut au voile.
- UX-DR-40 : Discrétion à la surface exposée (NFR-015) : `<title>` = « Anam » sur toutes les routes, identifiants d'URL opaques, favicon = fragment abstrait tronc/branche, og: neutre, notification titre « Anam » + corps ≤ 6 mots sans contenu ni vocabulaire ésotérique, privacy-cover neutre au multitâche, icône sans lune/lotus/étoile/visage (testée à 40px, en monochrome).
- UX-DR-41 : Streaming accessible : conteneur du tour d'Anam en `aria-live="polite"` + `aria-busy`, annoncé une seule fois à la fin (jamais mot à mot) ; rendu par groupes de mots ; latence tenue 400-900ms ; suivi du bas qui s'arrête dès que l'utilisatrice remonte et ne reprend pas seul.
- UX-DR-42 : Plancher d'interaction : cibles ≥ 44×44px (dont points d'accroche de branche), anneau de focus visible en bordure-forte jamais supprimé, ordre de tabulation = ordre de lecture, zoom 200 % sans perte / redistribution à 400 %, aucune limite de temps (pas d'expiration de session en conversation) ; contraintes navigateur mobile : composeur au-dessus du clavier virtuel (`dvh` + `visualViewport`), dernier tour visible, Web Push optionnel dégradant proprement.

### FR Coverage Map

Chaque exigence fonctionnelle (FR-001 à FR-089) est rattachée à exactement un epic.

- FR-001 : Epic 2 — séance en conversation
- FR-002 : Epic 2 — durée sans minuteur
- FR-003 : Epic 2 — restitutions réparties
- FR-004 : Epic 2 — arc de séance
- FR-005 : Epic 2 — observation en fin
- FR-006 : Epic 2 — hypothèse réfutable
- FR-007 : Epic 2 — nommer si prête
- FR-008 : Epic 2 — clôture par Anam
- FR-009 : Epic 2 — recul si contestée
- FR-010 : Epic 2 — démarrage strict minimum
- FR-011 : Epic 2 — heure de naissance optionnelle
- FR-012 : Epic 1 — consentement art. 9
- FR-013 : Epic 1 — déclaration IA
- FR-014 : Epic 3 — paywall à la clôture
- FR-015 : Epic 5 — tirage réellement aléatoire
- FR-016 : Epic 5 — jamais carte prédéterminée
- FR-017 : Epic 5 — projection avant sens
- FR-018 : Epic 5 — lecture par projection
- FR-019 : Epic 5 — personnalisation dans la lecture
- FR-020 : Epic 5 — aucune prédiction
- FR-021 : Epic 5 — restitution écrite conservée
- FR-022 : Epic 5 — jeu de cartes propriétaire
- FR-023 : Epic 5 — lexique lecture / ancrage
- FR-024 : Epic 4 — détection de reconceptualisation
- FR-025 : Epic 4 — branche proposée
- FR-026 : Epic 4 — validée et nommée
- FR-027 : Epic 4 — datée et sourcée
- FR-028 : Epic 4 — naissance feuillaison rayonnement
- FR-029 : Epic 4 — arbre jamais régressé
- FR-030 : Epic 4 — intégrer avant d'ouvrir
- FR-031 : Epic 4 — aucun score
- FR-032 : Epic 4 — étapes en intention
- FR-033 : Epic 5 — socle quotidien impersonnel
- FR-034 : Epic 6 — Anam rare et spécifique
- FR-035 : Epic 6 — notifications discrètes
- FR-036 : Epic 6 — proposer une pause
- FR-037 : Epic 2 — suspension en détresse
- FR-038 : Epic 2 — protocole quatre niveaux
- FR-039 : Epic 2 — ne jamais quitter
- FR-040 : Epic 2 — demande directe niveau 2
- FR-041 : Epic 2 — jamais soignant
- FR-042 : Epic 2 — pas de branche détresse
- FR-043 : Epic 2 — pas de commercial détresse
- FR-044 : Epic 2 — ressources d'aide vérifiées
- FR-045 : Epic 2 — lendemain juste
- FR-046 : Epic 2 — épisodes protégés
- FR-047 : Epic 5 — socle calculé
- FR-048 : Epic 5 — champs obligatoires / optionnels
- FR-049 : Epic 5 — dégradation gracieuse
- FR-050 : Epic 5 — annonce ce qui manque
- FR-051 : Epic 5 — tronc sans heure
- FR-052 : Epic 5 — ennéagramme test / hypothèse
- FR-053 : Epic 5 — socle ne prédit pas
- FR-054 : Epic 5 — corpus Anima
- FR-055 : Epic 3 — gratuit à vie
- FR-056 : Epic 3 — périmètre premium
- FR-057 : Epic 3 — une seule sollicitation
- FR-058 : Epic 3 — jamais coupé à zéro
- FR-059 : Epic 3 — qualité gratuite préservée
- FR-060 : Epic 3 — résiliation trois clics
- FR-061 : Epic 3 — prix unique 69 €
- FR-062 : Epic 4 — mémoire trois couches
- FR-063 : Epic 6 — consulter ce qu'Anam retient
- FR-064 : Epic 6 — corriger / supprimer faits
- FR-065 : Epic 4 — rappel opportun
- FR-066 : Epic 4 — synthèse périodique
- FR-067 : Epic 6 — export et effacement
- FR-068 : Epic 4 — franchise par mémoire
- FR-069 : Epic 1 — accès 18 ans et plus
- FR-070 : Epic 1 — contrôle d'âge
- FR-071 : Epic 1 — minorité détectée
- FR-072 : Epic 1 — ordre du parcours
- FR-073 : Epic 1 — authentification sans mot de passe
- FR-074 : Epic 2 — dangers non suicidaires
- FR-075 : Epic 2 — jamais les moyens
- FR-076 : Epic 2 — chercher un humain
- FR-077 : Epic 2 — aide toujours accessible
- FR-078 : Epic 2 — mesure des faux négatifs
- FR-079 : Epic 3 — allocation résiduelle gratuite
- FR-080 : Epic 5 — mantra vs ancrage
- FR-081 : Epic 4 — trois premium restants
- FR-082 : Epic 2 — formule de voix
- FR-083 : Epic 2 — paramètres fixes voix
- FR-084 : Epic 2 — règles de débit
- FR-085 : Epic 2 — formulations bannies
- FR-086 : Epic 2 — Anam ≠ Anima
- FR-087 : Epic 2 — aucun affect revendiqué
- FR-088 : Epic 3 — tronc gratuit, branches premium
- FR-089 : Epic 3 — garantie de remboursement

## Epic List

### Epic 1 : Franchir le seuil

Objectif : l'utilisatrice crée un compte sans mot de passe, déclare 18 ans, passe l'écran de consentement art. 9 + déclaration IA, et entre dans la scène. Inclut l'échafaudage greenfield Next + Supabase et la RLS deny-by-default (story 1.1).

FRs couverts : FR-012, FR-013, FR-069, FR-070, FR-071, FR-072, FR-073.

### Epic 2 : Parler à Anam — la première séance & son filet

Objectif : l'utilisatrice vit sa première séance (arc construire → observer → nommer → clore), en streaming, avec la voix d'Anam, et EN SÉCURITÉ — le protocole de détresse est fusionné ici (même pipeline serveur sécurité-d'abord). Ne peut pas partir en prod sans ses stories de détresse validées par un pro (porte pré-lancement).

FRs couverts : FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-037, FR-038, FR-039, FR-040, FR-041, FR-042, FR-043, FR-044, FR-045, FR-046, FR-074, FR-075, FR-076, FR-077, FR-078, FR-082, FR-083, FR-084, FR-085, FR-086, FR-087.

### Epic 3 : Devenir premium

Objectif : à la clôture de la séance, l'utilisatrice s'abonne (Stripe web), débloque la relation ; tronc gratuit / branches premium, garantie de remboursement, résiliation en trois clics.

FRs couverts : FR-014, FR-055, FR-056, FR-057, FR-058, FR-059, FR-060, FR-061, FR-079, FR-088, FR-089.

### Epic 4 : La mémoire & l'arbre

Objectif : l'utilisatrice voit naître ses branches (proposées par Anam, validées et nommées par elle), son arbre pousser sans jamais régresser, et relit ses prises de conscience datées ; mémoire trois couches, synthèse périodique, plans d'étapes ; fonde l'ordonnanceur unique (Story 4.8).

FRs couverts : FR-024, FR-025, FR-026, FR-027, FR-028, FR-029, FR-030, FR-031, FR-032, FR-062, FR-065, FR-066, FR-068, FR-081.

### Epic 5 : Le socle & la lecture

Objectif : l'utilisatrice explore son thème natal, sa numérologie, son ennéagramme, reçoit son horoscope et son mantra du jour, et tire une lecture (tirage réellement aléatoire, isolé du profil).

FRs couverts : FR-015, FR-016, FR-017, FR-018, FR-019, FR-020, FR-021, FR-022, FR-023, FR-033, FR-047, FR-048, FR-049, FR-050, FR-051, FR-052, FR-053, FR-054, FR-080.

### Epic 6 : Les deux rythmes & tes données

Objectif : l'utilisatrice vit avec Anam dans la durée (socle quotidien impersonnel, Anam rare et spécifique, notifications discrètes, pauses proposées) et maîtrise ses données (voir ce qu'Anam retient, corriger, exporter, tout effacer). S'appuie sur l'ordonnanceur (fondé en Epic 4) et livre le moteur de rétention/effacement.

FRs couverts : FR-034, FR-035, FR-036, FR-063, FR-064, FR-067.


## Epic 1 : Franchir le seuil

L'utilisatrice traverse le seuil d'entrée : elle crée un compte sans mot de passe, déclare avoir 18 ans ou plus, s'arrête à la halte de consentement art. 9 + déclaration IA, puis entre dans la scène 2D continue et sans bord. Cet epic pose l'échafaudage greenfield en couches (avec la RLS deny-by-default *prouvée*, pas supposée), déroule la séquence d'entrée dans son ordre légal figé (FR-072), et installe la garde de consentement qui rend licite tout traitement art. 9 à venir. Aucun contenu art. 9 n'est encore écrit : l'epic livre un substrat qui tourne, un compte qui existe, un consentement dont la nécessité est techniquement démontrée, et la coquille de scène qui accueille la première séance — la transparence IA et le filet de sécurité y sont d'emblée toujours à portée.

### Story 1.1 : Poser l'échafaudage en couches et prouver la RLS deny-by-default

En tant que dev, je veux un projet greenfield Next.js 16.2 / React 19.2 / TypeScript 5.9.3 / Supabase structuré en couches à dépendance descendante, avec un test de fumée et une garde RLS deny-by-default vérifiée en CI, afin que chaque story suivante se construise sur un substrat qui tourne et dont l'isolation par utilisatrice est démontrée plutôt que présumée.

**Couvre :** AD-1, AD-10, AD-12 · Stack & Conventions (échafaudage — exception explicite de l'architecture, aucun FR direct)

**Critères d'acceptation :**

**Étant donné** un dépôt vide **Quand** le projet est initialisé **Alors** l'arborescence porte les couches `app/`, `lib/domain/`, `lib/scene/`, `lib/ai/`, `lib/astro/`, `lib/safety/`, `lib/data/`, `lib/config/`, `render/`, `supabase/` **Et** les versions épinglées sont Next.js 16.2.x, React 19.2.x, TypeScript 5.9.3, @supabase/supabase-js 2.110.x, Node ≥ 20.9.

**Étant donné** l'application déployée **Quand** un test de fumée charge la racine **Alors** l'app répond sans erreur et le test passe au vert en CI.

**Étant donné** la règle de dépendance descendante (AD-10) **Quand** `lib/domain/` importe Next, Supabase, un SDK fournisseur ou `render/` **Alors** la vérification d'architecture échoue et casse le build (le domaine reste pur, zéro I/O).

**Étant donné** une table témoin marquée « art. 9 » **Quand** la CI s'exécute **Alors** elle vérifie que la RLS est active et deny-by-default (aucun accès sans politique explicite) **Et** retirer la politique de cette table fait échouer la CI et bloque le déploiement (AD-12).

**Étant donné** le document HTML racine **Quand** une page est rendue **Alors** elle porte `lang="fr"` (UX-DR-36), l'app étant francophone de bout en bout.

### Story 1.2 : Fondation du design system — tokens, typographies, mouvement et accessibilité

En tant que dev, je veux poser le socle visuel d'Anam — les tokens de couleur « Nuit galactique », les deux familles typographiques, les primitives d'espacement et de mouvement, et le mode d'accessibilité à contraste renforcé, afin que chaque écran suivant se compose sur un système cohérent, accessible et vérifié plutôt que sur des valeurs improvisées.

**Couvre :** UX-DR-1, UX-DR-2, UX-DR-4, UX-DR-5, UX-DR-6, UX-DR-39 (fondation UX — équivalent visuel de la Story 1.1, aucun FR direct)

**Critères d'acceptation :**

**Étant donné** le système de couleur **Quand** les tokens sont définis **Alors** le mode sombre natif « Nuit galactique » est le mode principal (tokens sans suffixe : fond #0C0A1E, surface #16132F, surface-elevee #201C42, texte #EEECF7, texte-doux #ABA6C9, bordure décorative #2A2648, bordure-forte #77719C, accent #8FC1EF, lueur #CDE4F8) **Et** chaque token porte sa variante `-clair` pour le mode d'accessibilité (UX-DR-1, UX-DR-2).

**Étant donné** les paires texte-sur-fond **Quand** le contraste est mesuré **Alors** chaque paire atteint au moins WCAG AA (4,5:1 en texte courant, 3:1 en grand texte et pour bordure-forte), en mode sombre **comme** en mode accessibilité **Et** un token qui échoue le ratio casse le build (UX-DR-39, NFR-016).

**Étant donné** les deux familles typographiques **Quand** l'échelle est posée **Alors** Fraunces porte la voix d'Anam (WONK 0, SOFT 20-30, graisse ≤ 500, opsz suivant la taille) et Inter l'interface et les mots de l'utilisatrice, sur l'échelle display / titre / titre-sm / anam / corps / meta / surtitre / bouton — aucune capitale, aucune graisse > 500, interligne ≥ 1.6, tout en rem (UX-DR-4).

**Étant donné** les primitives d'espacement et de mouvement **Quand** elles sont définies **Alors** l'espacement suit la base 8px (4-8-12-16-24-32-48-64-96) et le mouvement est un fondu lent (durées 180 / 320 / 700 / 4200ms, courbe unique cubic-bezier(0.32,0.08,0.24,1), aucun rebond ni overshoot, dérive verticale ≤ 6px), exposé comme primitives de fondu texte / image / personnage / région (UX-DR-5, UX-DR-6).

**Étant donné** le mode d'accessibilité « contraste renforcé / imagerie atténuée » **Quand** l'utilisatrice l'active (`prefers-contrast: more` ou réglage « Lisibilité renforcée ») **Alors** les tokens `-clair` prennent le relais et l'imagerie est atténuée, sans jamais devenir un thème jour de confort **Et** ce mode est vérifié au même niveau que le mode sombre (UX-DR-1).

**Étant donné** `prefers-reduced-motion` **Quand** il est actif **Alors** les primitives de fondu sont neutralisées (transitions instantanées, textes apparaissant complets) **Et** aucune information n'est jamais portée par le seul mouvement (UX-DR-6).

### Story 1.3 : Créer un compte sans mot de passe

En tant qu'utilisatrice, je veux créer mon compte par lien e-mail (ou fournisseur d'identité), sans jamais choisir de mot de passe, afin d'entrer dans un espace de confidences sans la faille d'un mot de passe faible.

**Couvre :** FR-073, AD-2, AD-12 · Conventions (auth Supabase passwordless, isolation RLS par utilisatrice)

**Critères d'acceptation :**

**Étant donné** l'écran d'entrée **Quand** l'utilisatrice saisit son e-mail **Alors** un lien de connexion magique lui est envoyé **Et** aucun champ de mot de passe n'est jamais présenté (FR-073).

**Étant donné** un lien de connexion valide **Quand** l'utilisatrice l'ouvre **Alors** une ligne `utilisatrice` (1:1 avec le compte d'auth) est créée sous son identité **Et** l'accès à cette ligne est régi par la RLS `auth.uid()`, jamais via `service_role` depuis un route handler (AD-12).

**Étant donné** deux utilisatrices distinctes **Quand** l'une interroge la table `utilisatrice` **Alors** elle ne voit que sa propre ligne (isolation RLS vérifiée par test).

**Étant donné** une session établie **Quand** le temps passe pendant un usage normal **Alors** la session est de longue durée et aucune ré-authentification n'interrompt le parcours (Foundation UX, WCAG 2.2.1).

### Story 1.4 : Déclarer sa date de naissance et bloquer les moins de 18 ans

En tant qu'utilisatrice, je veux déclarer ma date de naissance une seule fois juste après la création du compte, afin de confirmer que j'ai 18 ans ou plus et de fournir la donnée qui nourrira plus tard mon socle.

**Couvre :** FR-069, FR-070, FR-072 (étape 2) · AD-6 (date saisie une fois, immuable, alimentera le socle), NFR-023 · UX : formulaire accessible (étiquette visible), registre produit non culpabilisant

**Critères d'acceptation :**

**Étant donné** un compte fraîchement créé (FR-072, étape 2, avant le consentement) **Quand** l'écran de déclaration d'âge s'affiche **Alors** l'âge minimum « 18 ans ou plus » est affiché explicitement (FR-069) **Et** l'étiquette du champ est visible, jamais un placeholder en guise d'étiquette.

**Étant donné** une date de naissance correspondant à moins de 18 ans **Quand** l'utilisatrice la soumet **Alors** la création du compte est bloquée côté serveur, en registre produit, sans culpabilisation **Et** aucune donnée de socle n'est calculée (FR-070).

**Étant donné** une date de naissance correspondant à 18 ans ou plus **Quand** l'utilisatrice la soumet **Alors** elle est stockée une seule fois sur `utilisatrice` (contrôle d'âge appliqué techniquement, NFR-023) **Et** le parcours avance vers l'écran de consentement (FR-072).

**Étant donné** une date de naissance valide déjà enregistrée **Quand** l'utilisatrice poursuit le parcours d'entrée **Alors** la date n'est plus jamais redemandée (saisie unique, FR-070) **Et** elle est conservée pour alimenter le socle le moment venu (AD-6), sans recalcul ni re-saisie.

**Étant donné** que la date de naissance est une donnée personnelle ordinaire, non art. 9 **Quand** elle est collectée à l'étape 2, avant le consentement **Alors** FR-072 est respecté (aucune donnée *sensible* art. 9 avant consentement) **Et** le thème natal art. 9 qui en dérivera n'est calculé qu'après le consentement (frontière AD-4/AD-13, epic ultérieur).

### Story 1.5 : Poser la halte de consentement art. 9 et la déclaration IA

En tant qu'utilisatrice, je veux un écran dédié qui s'arrête net avant la première séance, m'explique en français clair que je vais parler à une IA, et recueille mon consentement sensible séparément des CGU, afin de savoir à quoi je consens avant qu'aucune confidence ne soit écrite.

**Couvre :** FR-012, FR-013, FR-072 · AD-9, AD-4 · UX : halte de consentement (halte nette), cases distinctes non pré-cochées, sortie honnête, tokens Nuit galactique en registre produit

**Critères d'acceptation :**

**Étant donné** l'étape 3 du parcours d'entrée (FR-072), après la déclaration d'âge et avant la première séance **Quand** l'écran de consentement s'affiche **Alors** il présente sur une seule page, sans défilement obligatoire, « Tu vas parler à une intelligence artificielle » (déclaration IA, FR-013, AI Act art. 50) et le sens de la conservation puis de l'effacement, en français courant.

**Étant donné** l'écran de consentement **Quand** l'utilisatrice l'examine **Alors** deux cases distinctes et non pré-cochées, jamais groupées, sont présentes : (a) consentement explicite art. 9, (b) acceptation des CGU + confirmation d'avoir 18 ans ou plus **Et** le consentement art. 9 est séparé des CGU (FR-012, NFR-006).

**Étant donné** qu'au moins une des deux cases n'est pas cochée **Quand** l'utilisatrice regarde l'action primaire **Alors** « Je commence » est désactivée et le motif du blocage est écrit en texte, pas seulement signifié par la désactivation **Et** le refus « Je ne veux pas » est de lisibilité strictement égale, jamais minoré.

**Étant donné** le lien vers les CGU et le lien « Lire le détail » **Quand** l'utilisatrice les active **Alors** les CGU s'ouvrent dans un nouvel onglet sans faire perdre l'état de la page **Et** « Lire le détail » déplie le texte long en place (accordéon), la version courte restant la version principale.

**Étant donné** les deux cases cochées **Quand** l'utilisatrice active « Je commence » **Alors** une ligne `consentement` (art. 9 accordé + déclaration IA reconnue, horodatée) est écrite sous son identité (RLS) **Et** le parcours débloque l'entrée dans la scène (FR-072).

**Étant donné** l'écran de consentement **Quand** l'utilisatrice active « Je ne veux pas » **Alors** une page dit sans détour que l'app n'est pas utilisable sans cet accord, avec une confirmation unique, et supprime le compte immédiatement, sans tentative de rétention ni « es-tu sûre ? » culpabilisant.

**Étant donné** l'exigence qu'aucune donnée sensible art. 9 ne soit écrite avant ce consentement (FR-072) **Quand** l'utilisatrice atteint cet écran **Alors** aucune table de contenu art. 9 n'a encore reçu d'écriture pour elle (vérifiable : seuls existent `utilisatrice`, sa date de naissance et, à la validation, `consentement`).

### Story 1.6 : Rendre le consentement techniquement non contournable et révocable

En tant que dev (au nom de la conformité art. 9), je veux une garde d'écriture au niveau base qui refuse toute écriture sur une table art. 9 sans consentement valide et non révoqué, ainsi qu'un contrôle de révocation qui suspend le traitement art. 9, afin que la légalité du traitement ne dépende jamais d'un oubli d'interface.

**Couvre :** FR-012 (révocabilité) · AD-13 (write-gate), AD-4 · Conventions (garde technique, pas UI) · UX : état « consentement révoqué » (aucun écran de rétention)

**Critères d'acceptation :**

**Étant donné** une table témoin marquée art. 9 et une utilisatrice sans `consentement` valide **Quand** une écriture art. 9 est tentée pour elle **Alors** la garde d'écriture au niveau base (pas l'UI) la refuse (AD-13 write-gate) **Et** ce refus est couvert par un test bloquant en CI.

**Étant donné** une utilisatrice avec un `consentement` art. 9 valide et non révoqué **Quand** une écriture art. 9 est tentée pour elle **Alors** la garde l'autorise.

**Étant donné** une utilisatrice ayant consenti **Quand** elle révoque son consentement (`revoked_at` posé) **Alors** elle bascule en état « traitement art. 9 suspendu » **Et** toute écriture art. 9 ultérieure est de nouveau refusée par la garde (révocation testée de bout en bout).

**Étant donné** une révocation **Quand** elle survient **Alors** l'utilisatrice est dirigée vers l'export puis la suppression, sans aucun écran de rétention ni offre de reconquête (UX) **Et** la propagation effective de l'effacement est confiée au moteur unique de rétention/effacement (AD-14, epic données ultérieur), hors périmètre de cette story.

### Story 1.7 : Entrer dans la scène 2D continue et sans bord

En tant qu'utilisatrice ayant consenti, je veux franchir le seuil et arriver dans une scène 2D continue et sans bord où je circule en fondu sans jamais changer d'écran sec, afin d'entrer dans un monde et non dans une pile d'écrans.

**Couvre :** AD-7 (scène modèle/rendu séparés), AD-2 (coquille serveur), AD-15 (doublage non-spatial) · UX : coquille de scène sans bord, format Seuil du personnage, tokens Nuit galactique, accessibilité (doublage non-spatial, WCAG AA, prefers-reduced-motion), identité discrète des routes

**Critères d'acceptation :**

**Étant donné** une utilisatrice ayant consenti **Quand** elle franchit le seuil **Alors** elle arrive dans une scène 2D continue, sans cadre ni filet décoratif, ancrée (arbre au centre, Anam à gauche) **Et** le passage entre régions se fait en fondu, jamais par un basculement d'écran sec (AD-7, UX sans bord).

**Étant donné** la séparation modèle/rendu (AD-7) **Quand** l'état de la scène est défini **Alors** il vit comme modèle de données pur dans `lib/scene/` sans dépendance au rendu, et `render/` (DOM/2D v1) ne porte aucune logique métier **Et** l'architecture autorise un futur adaptateur WebGL sans réécriture du modèle.

**Étant donné** l'exigence de doublage non-spatial (accessibilité) **Quand** l'utilisatrice navigue au clavier ou au lecteur d'écran **Alors** chaque région est atteignable par un lien nommé (barre basse / rail) sans traverser la scène, l'ordre de lecture restant linéaire **Et** aucune information n'est jamais portée par le seul mouvement.

**Étant donné** `prefers-reduced-motion` **Quand** l'utilisatrice change de région **Alors** le changement devient instantané, sans fondu ni parallaxe.

**Étant donné** l'imagerie du format Seuil (personnage 4:5, accueil / ouverture) **Quand** du texte se pose dessus **Alors** il passe par le voile de lisibilité (jamais de texte sur image sans voile) et respecte le contraste WCAG AA (tokens DESIGN.md).

**Étant donné** la coquille serveur (AD-2) **Quand** on inspecte le bundle client **Alors** aucune clé de fournisseur IA n'y figure **Et** tout futur appel IA est routé par `app/api/**` (frontière serveur posée dès l'entrée, le navigateur ne parle jamais en direct au fournisseur).

**Étant donné** la surface exposée (NFR-015) **Quand** n'importe quelle route est rendue **Alors** le `<title>` vaut « Anam » sur **toutes les routes**, les identifiants d'URL sont opaques, le favicon est un fragment abstrait tronc/branche et l'`og:` reste neutre (UX-DR-40).

### Story 1.8 : La surimpression persistante — mention IA et porte de secours

En tant qu'utilisatrice, je veux qu'une surimpression discrète et sans bord flotte en permanence sur la scène, portant le signe d'Anam, la mention « Anam est une IA » et une porte de secours vers l'aide, afin que la transparence et le filet de sécurité soient toujours à portée, quelle que soit la région.

**Couvre :** FR-013 (mention IA persistante), FR-077 (porte de secours toujours présente) · AD-9 (haltes joignables), AD-15 (`/aide` statique) · UX : surimpression persistante sans bord, mention IA persistante, porte de secours

**Critères d'acceptation :**

**Étant donné** n'importe quelle région **Quand** la scène est affichée **Alors** la surimpression persistante flotte sans bord ni fond barré (lisibilité tenue par le voile) et porte la porte de secours « Aide » vers `/aide`, toujours au même endroit **Et** elle n'est jamais masquée, repliée ni dissoute au défilement.

**Étant donné** la région de conversation **Quand** elle est affichée **Alors** la surimpression porte aussi le signe d'Anam et la mention « Anam est une IA » liée à la page de transparence (FR-013, AI Act art. 50) — jamais sous 13px, jamais sur imagerie sans voile.

**Étant donné** la porte de secours **Quand** l'utilisatrice la suit **Alors** `/aide` — page statique atteignable sans compte, sans paywall, sans traceur (AD-15) — est joignable en deux gestes et deux arrêts de tabulation depuis n'importe où, connectée ou non (FR-077) **Et** indépendamment de toute détection.

**Étant donné** la porte de secours **Quand** elle est rendue **Alors** c'est un simple mot « Aide » en meta / texte-doux, jamais rouge, jamais une pastille, jamais un pictogramme d'alerte, jamais une majuscule (AD-9).

### Story 1.9 : Appliquer la barrière de minorité détectée

En tant qu'utilisatrice dont un signal net révèle qu'elle est mineure, je veux que le parcours s'interrompe par un message clair et non culpabilisant, m'oriente vers le 3018 et efface mes données sous 30 jours après m'avoir proposé un export, afin d'être protégée sans être punie ni voir mes données exploitées.

**Couvre :** FR-071 · AD-14 (échéance de suppression 30 j — minorité), AD-9 (halte, jamais de rouge ni de modale), NFR-002 · UX : état « Minorité détectée » (bloc ressources, registre produit)

**Critères d'acceptation :**

**Étant donné** un signal net de minorité levé pour une utilisatrice (le classifieur en conversation relève du pipeline de sécurité, epic ultérieur ; ici le drapeau est injecté) **Quand** la barrière s'applique **Alors** le compte est suspendu immédiatement : plus aucune écriture, plus aucun échange n'est possible (garde vérifiée).

**Étant donné** la suspension **Quand** l'écran s'affiche **Alors** un message clair et non culpabilisant, en registre produit et jamais signé d'Anam, explique que l'app est réservée aux majeures **Et** il oriente vers des ressources adaptées à l'âge — le 3018 en tête — rendues dans le bloc ressources habituel, jamais une modale, jamais de rouge, jamais de pictogramme de danger (AD-9).

**Étant donné** la suspension **Quand** l'utilisatrice consulte l'écran **Alors** il dit sans détour que les données seront supprimées sous 30 jours, sans exploitation d'aucune sorte, et un export lui est proposé avant suppression, en une action **Et** l'échéance de suppression à 30 jours est enregistrée pour le moteur unique de rétention/effacement (AD-14).

**Étant donné** les données déjà collectées **Quand** la barrière est active **Alors** elles ne sont exploitées à aucune fin (analyse produit, segmentation, marketing) pendant la fenêtre de 30 jours (FR-071, NFR-002).

**Étant donné** le parcours d'entrée, sans paiement à ce stade **Quand** la minorité est détectée **Alors** aucun paiement n'est encaissé **Et** si un paiement avait été encaissé (abonnement d'un epic ultérieur), le remboursement intégral est déclenché — le point de déclenchement du remboursement est posé ici (FR-071).

## Epic 2 : Parler à Anam — la première séance & son filet

**Objectif.** L'utilisatrice vit sa **première séance** de bout en bout — l'arc *construire → observer → nommer → clore* — en **streaming**, avec la **voix d'Anam** (neutre sur le jugement, chaleureuse sur l'attention), et **EN SÉCURITÉ**. La sécurité n'est pas un module à côté : le **protocole de détresse est fusionné dans le même pipeline serveur, où la sécurité est évaluée d'abord**. Anam refuse de flatter mais ne refuse jamais de soutenir : dès qu'un signal de détresse apparaît, tout travail de schéma s'efface, aucune limite commerciale ne s'interpose, les ressources restent joignables même si le modèle tombe, et Anam ne quitte jamais la conversation.

> Cet epic est le plus important du produit. Les stories sont ordonnées : d'abord le **socle du pipeline** (frontière serveur, port IA, streaming), puis la **sécurité intégrée au pipeline**, puis l'**arc de séance et la voix**, enfin la **clôture et le placement gardé du paywall** (l'intégration Stripe réelle relève de l'Epic 3).
>
> ⚠️ Quatre stories dépendent d'une **porte pré-lancement** (validation clinique + juridique du protocole de détresse ; DPA art.28 + ZDR Mistral). Ces portes ne bloquent pas le développement — elles bloquent la **mise en ligne sur données réelles**. Elles sont signalées story par story.
>
> **Note v1 — saisie vocale déférée.** Le composeur de la v1 est **texte seul** : la **saisie vocale** et les exigences associées (**NFR-003** audio supprimé après transcription, **NFR-004** aucune inférence d'émotion depuis la voix, **NFR-017** capture indépendante du traitement) sont **déférées en v1.1**, derrière `SttPort` (porte pré-lancement du SEED).

---

### Story 2.1 : La frontière serveur, le port IA unique et l'egress gardé

En tant que développeuse, je veux que tout appel au modèle passe par une **frontière serveur unique** derrière le port `AiPort`, avec **une seule clé serveur** et un **point d'egress** qui revérifie consentement et ZDR, afin que les données art.9 ne quittent jamais le système sans garantie et que le fournisseur reste remplaçable.

**Couvre :** AD-2, AD-3, AD-4, AD-13, NFR-019, NFR-020

**⚠️ Porte pré-lancement :** **DPA art.28 + ZDR Mistral** (plan Scale) requis avant toute vraie donnée art.9 ; en dev/test, données non sensibles uniquement (les clés Mistral gratuites ne couvrent pas le ZDR). Ne bloque pas le build, bloque le passage aux données réelles.

**Critères d'acceptation :**

- **Étant donné** le navigateur, **Quand** du code tente d'atteindre un fournisseur IA, **Alors** aucun chemin ne le permet (aucune clé côté client, jamais une clé par utilisatrice) **Et** tout appel transite par `app/api/**`, l'usage étant métré par utilisatrice dans `usage_ia` (base propre, sans art.9).
- **Étant donné** l'applicatif, **Quand** il a besoin du modèle, **Alors** il n'appelle que le port `AiPort` (aucun SDK fournisseur hors `lib/ai/adapters/`) **Et** l'adaptateur par défaut est Mistral, sur **endpoints stateless uniquement**.
- **Étant donné** un adaptateur sur le chemin art.9, **Quand** il démarre sans ZDR/DPA prouvés, **Alors** il **refuse de démarrer** (échec dur) **Et** jamais aucune dégradation silencieuse ni bascule direct-US.
- **Étant donné** un envoi de données art.9 vers le fournisseur, **Quand** l'`egress-guard` s'exécute, **Alors** il revérifie **dans la même transaction que l'envoi** que le consentement est valide et non révoqué **ET** que le ZDR est actif, **Et** une révocation en vol bloque l'envoi et ne poste rien.
- **Étant donné** les routes art.9, **Quand** elles répondent, **Alors** elles sont `no-store`/`dynamic` sous CSP stricte (`connect-src` limité au backend Anam) **Et** aucun moniteur/APM tiers ni contenu art.9 en clair n'apparaît dans les logs.

---

### Story 2.2 : Le fil de conversation en streaming et la politique de tiering

En tant qu'utilisatrice, je veux **parler à Anam dans un fil** et la voir répondre **en streaming** avec une latence tenue, afin que l'échange soit vivant sans jamais trahir la machine ni me presser.

**Couvre :** FR-001, AD-5, NFR-012, NFR-014 ; UX-DR : fil de conversation, apparition d'Anam (format Présence, 3 beats), composeur, voiles de lisibilité, surimpression (signe d'Anam).

**Critères d'acceptation :**

- **Étant donné** la première séance, **Quand** elle commence, **Alors** elle se présente comme une **conversation** (aucun questionnaire à choix multiples, aucun formulaire de profil préalable — FR-001) **Et** le fil est un flux vertical sans bulles opposées, les mots de l'utilisatrice rendus **à pleine valeur** (jamais en sourdine), distingués par la typographie et un filet, pas par l'extinction.
- **Étant donné** un message envoyé, **Quand** Anam prépare, **Alors** le signe d'Anam s'épaissit sans animation cyclique (pas de points qui rebondissent) **Et** une latence de **400 à 900 ms** est tenue avant le flux même si la réponse est prête plus tôt, le premier caractère paraissant sous 1 s.
- **Étant donné** la réponse, **Quand** elle s'affiche, **Alors** c'est **par groupes de mots** (jamais caractère par caractère — NFR-014), le conteneur portant `aria-busy="true"` pendant puis `false` à la fin **Et** le suivi du bas s'arrête dès que l'utilisatrice remonte et ne reprend pas seul.
- **Étant donné** la politique de tiering **unique** `(capacité, niveau_sécurité) → tier`, **Quand** un appelant déclare sa capacité, **Alors** le tier est résolu **côté serveur** (le client ne le choisit jamais) **Et** l'échange courant utilise le modèle **léger** tandis que reconceptualisation et synthèse utilisent le modèle **fort**.
- **Étant donné** du texte posé sur l'imagerie, **Quand** il est rendu, **Alors** il passe **toujours** par un voile de lisibilité (jamais directement sur l'image) **Et** le composeur (champ multiligne, bouton d'envoi — **texte seul en v1, aucun micro**) ne disparaît jamais.
- **Étant donné** l'un des trois beats (ouverture, nommer, clôture), **Quand** il est signalé, **Alors** le personnage paraît en **format Présence**, sans cadre ni cercle, en fondu (instantané sous `prefers-reduced-motion`) **Et** jamais à côté d'un tour ordinaire — entre les beats, seul le signe porte sa présence.
- **Étant donné** le composeur **texte seul** (champ multiligne auto-extensible, max 6 lignes puis défilement interne, bouton d'envoi — aucun micro en v1), **Quand** l'utilisatrice saisit, **Alors** en sm « Entrée » insère un saut de ligne et l'envoi se fait par le bouton, tandis qu'en ≥ md « Entrée » envoie et « Maj+Entrée » insère une ligne (UX-DR-21).
- **Étant donné** un navigateur mobile, **Quand** le clavier virtuel s'ouvre, **Alors** le composeur reste **au-dessus du clavier** (`dvh` + `visualViewport`) et le dernier tour reste visible **Et** l'interface tient le zoom 200 % sans perte et se redistribue à 400 %, sans limite de temps ni expiration de session en conversation (UX-DR-42).
- **Étant donné** les assets du personnage, **Quand** ils sont produits, **Alors** ils existent aux trois formats (Seuil 4:5 plein cadre, Présence 96-140px sans cadre à bord plumeux, Veille de dos) en WebP/AVIF avec repli PNG, @2x, `loading="lazy"` et un `alt` sobre non-révélateur **Et** ils ne paraissent jamais dans l'icône, l'aperçu de notification ni la vignette multitâche (UX-DR-15).

---

### Story 2.3 : Le pipeline serveur sécurité-d'abord

En tant que développeuse, je veux un **unique pipeline serveur ordonné** qui **évalue la sécurité en premier** et arbitre tout le reste du tour, afin que la détresse prime sur toute autre écriture et soit toujours analysée par le modèle le plus capable.

**Couvre :** FR-037, FR-046, FR-078, AD-16, AD-5, NFR-012

**⚠️ Porte pré-lancement :** la logique de détection et le **jeu de cas** doivent être **validés par un professionnel qualifié** (et un juriste) avant mise en ligne. Hérite aussi de la porte **DPA/ZDR** (le modèle fort passe par l'egress art.9 de la Story 2.1).

**Critères d'acceptation :**

- **Étant donné** un tour utilisateur, **Quand** il est traité, **Alors** il passe par un **unique pipeline serveur ordonné** (`lib/safety/` → `lib/domain/`) où l'**évaluation de sécurité s'exécute EN PREMIER** et peut **annuler** toute autre écriture du tour **Et** aucun module n'appelle un détecteur hors de ce pipeline.
- **Étant donné** la détection de détresse, **Quand** elle s'exécute, **Alors** elle utilise **TOUJOURS le modèle le plus capable disponible, JAMAIS le léger en aucune circonstance** **Et** à défaut du modèle fort le système **échoue vers la sécurité** (repli sûr), jamais une analyse au tier léger.
- **Étant donné** un niveau de détresse ≥ 1, **Quand** il est détecté, **Alors** tout travail de schéma / contradiction / reconceptualisation est **suspendu et sa sortie supprimée pour l'épisode** (pas seulement ignorée — FR-037) **Et** le modèle le plus capable est forcé pour la **détection ET la réponse**.
- **Étant donné** chaque classification de sécurité, **Quand** elle est produite, **Alors** un enregistrement d'audit **sans art.9** (niveau, décision, tier, horodatage) est émis pour mesurer le rappel et les **faux négatifs** (FR-078) **Et** les épisodes sont exclus de toute analyse produit, synthèse et arbre (FR-046).

---

### Story 2.4 : L'entité `episode_detresse`, la fenêtre 72 h et l'extinction gardée

En tant que développeuse, je veux une **entité de détresse possédée** dont dérivent les limites levées, la garde des 72 h et l'extinction, afin que ces règles vitales proviennent d'une seule vérité et ne soient jamais levées à vie.

**Couvre :** FR-042, FR-046, AD-17

**⚠️ Porte pré-lancement :** hérite de la porte de validation du protocole de détresse (Story 2.3).

**Critères d'acceptation :**

- **Étant donné** l'entité `episode_detresse` (`utilisatrice, debut, niveau_max, fin` nullable, `fenetre_expire_at`), **Quand** un épisode s'ouvre, **Alors** `limites_levees` **dérive** de `fin IS NULL` et la fenêtre 72 h **dérive** de `fenetre_expire_at` **Et** une transition d'extinction **unique et possédée** ferme l'épisode (N tours sûrs consécutifs **ET** délai minimal) — le paywall n'est jamais levé à vie.
- **[DUR / AD-17]** **Étant donné** la garde « aucune branche pendant l'épisode + 72 h » (FR-042), **Quand** une écriture de branche est tentée, **Alors** elle est refusée **au point d'écriture** en interrogeant `episode_detresse` (jamais seulement à la proposition).
- **Étant donné** la frontière art.9, **Quand** la table `episode_detresse` est créée, **Alors** elle naît en **RLS deny-by-default** sous JWT utilisatrice, chiffrée au même niveau que le journal (FR-046) — une table art.9 sans politique casse le build.

---

### Story 2.4b : L'idempotence du tour de détresse au retry

> **Story née en cours de route, pas issue du découpage initial.** Ajoutée ici le 2026-08-07 : elle existait
> depuis le 2026-07-30 comme fichier livré (`2-4b-idempotence-tour-detresse-au-retry.md`, statut `done`,
> revue faite en `0e40f6f`) mais l'inventaire des epics ne la connaissait pas. Un découpage qui ignore une
> story livrée ment sur ce qui a été construit.

En tant que développeuse, je veux qu'un **tour de détresse rejoué** (retry réseau, double soumission, reprise de flux interrompu) ne compte **qu'une fois**, afin que la fenêtre 72 h, le compteur de tours sûrs et l'extinction ne dérivent pas d'un accident de transport.

**Couvre :** FR-042, FR-046, AD-17 (durcissement de la Story 2.4)

**Dépend de :** Story 2.4 (l'entité `episode_detresse` et sa transition d'extinction).

**Critères d'acceptation :**

- **Étant donné** un tour de détresse déjà enregistré, **Quand** la même requête est rejouée, **Alors** l'épisode n'est ni rouvert ni prolongé, et le compteur de tours sûrs n'est ni incrémenté ni remis à zéro une seconde fois.
- **[DUR]** **Étant donné** que l'extinction dérive d'un comptage, **Quand** un retry survient, **Alors** l'idempotence est garantie **au point d'écriture** (clé possédée en base), jamais par une déduplication côté client ni par une fenêtre de temps approximative.

---

### Story 2.5 : Le filet hors-IA, `/aide` et la garde des limites levées

En tant qu'utilisatrice, je veux des **ressources d'aide toujours joignables** et **indépendantes de toute détection**, afin que le filet de sécurité ne dépende jamais du classifieur ni du fournisseur IA, et qu'aucun commerce ne m'atteigne en détresse.

**Couvre :** FR-043, FR-044, FR-077, AD-9, AD-15 ; UX-DR : surimpression (porte de secours), bloc ressources.

**⚠️ Porte pré-lancement :** la **liste des ressources** et leur pertinence par danger relèvent du **protocole de détresse à valider** par un professionnel qualifié ; une revue périodique des numéros est planifiée (un numéro périmé est un défaut critique).

**Critères d'acceptation :**

- **Étant donné** n'importe quel écran, **Quand** l'utilisatrice cherche de l'aide, **Alors** la **porte de secours** de la surimpression persistante et l'entrée « Aide et ressources » (première du menu, toujours) mènent à `/aide` **en deux gestes** **Et** indépendamment de toute détection (FR-077).
- **Étant donné** `/aide`, **Quand** elle est ouverte, **Alors** elle est atteignable **sans compte, sans paywall, sans traceur** **Et** les ressources sont **statiques**, servies sans dépendre du fournisseur IA.
- **Étant donné** le bloc ressources, **Quand** il s'affiche, **Alors** il liste les numéros **vérifiés** adaptés au danger (**3114** · **15/112** · **3919** · **119** · SOS Amitié) en liens `tel:`, porte une date « vérifié le … », **Et** n'est jamais rouge, jamais modal, jamais bloquant ; les numéros sont lus chiffre par chiffre.
- **Étant donné** `limites_levees` vrai, **Quand** le paywall, le bandeau de quota, la carte d'abonnement ou le bilan tentent de se monter, **Alors** ils **refusent de se monter** (garde technique) **Et** y compris sur un compte gratuit à quota épuisé (FR-043).
- **Étant donné** le modèle fort indisponible pendant un épisode, **Quand** la conversation continue, **Alors** elle dégrade gracieusement mais **Anam ne quitte jamais** (tenu par le filet non-IA), le système force l'affichage des haltes et pose `limites_levees` **Et** l'indisponibilité est un **incident journalisé**, jamais un échec silencieux.

---

### Story 2.6 : La réponse de détresse par niveaux, où Anam ne quitte jamais

En tant qu'utilisatrice en détresse, je veux qu'Anam **reste, nomme ce qu'elle a entendu et me donne les bons numéros** sans dramatiser ni m'abandonner, afin de me sentir accompagnée et non expédiée.

**Couvre :** FR-038, FR-039, FR-040, FR-041, FR-045, FR-074, FR-075, FR-076, AD-16, AD-5 ; UX-DR : bloc ressources.

**⚠️ Porte pré-lancement :** les **formulations de réponse** et le **seuillage des niveaux** doivent être **validés par un professionnel qualifié et un juriste** avant mise en ligne (intention produit, pas protocole clinique).

**Critères d'acceptation :**

- **Étant donné** les quatre niveaux, **Quand** le niveau évolue, **Alors** la bascule est **non annoncée aux niveaux 0 et 1** (Anam devient plus douce, aucun élément ajouté au DOM) **Et** Anam **parle ouvertement aux niveaux 2 et 3** — elle nomme et **demande directement**, sans détour ni dramatisation (FR-038, FR-040).
- **Étant donné** un signal de détresse, **Quand** Anam répond, **Alors** elle **ne quitte jamais la conversation** (FR-039), le composeur reste actif et gardé au focus **Et** elle **ne se présente jamais comme un professionnel de santé** et ne prétend pas prendre en charge (FR-041).
- **Étant donné** un échange en détresse, **Quand** Anam parle, **Alors** elle **n'explore jamais les détails d'un plan ou des moyens** (ni comment, ni avec quoi, ni quand — FR-075) **Et** elle cherche un **humain proche** : quelqu'un à appeler ou rejoindre maintenant, et l'y encourage (FR-076).
- **Étant donné** un danger non suicidaire (violences en cours, danger pour un enfant, emprise), **Quand** il est détecté, **Alors** le protocole s'applique avec les **ressources correspondantes** (FR-074) **Et** au niveau 3 avec danger vital, le bloc ressources est inséré **avant** le tour d'Anam, **15/112** en tête.
- **Étant donné** le lendemain d'un épisode, **Quand** Anam reprend le fil, **Alors** elle **ne revient pas lourdement** dessus mais ne fait pas comme si rien ne s'était passé (FR-045) **Et** en une phrase, sans bandeau, sans « suivi », sans carte « comment vas-tu ».

---

### Story 2.7 : L'arc de séance construire → observer → nommer → clore

En tant qu'utilisatrice, je veux une séance qui **me fait parler, relie, puis nomme une chose vraie au bon moment**, afin de recevoir de la valeur tout du long et une observation qui touche parce qu'elle est juste et bien placée.

**Couvre :** FR-002, FR-003, FR-004, FR-005, FR-007, FR-010, FR-011, AD-1, AD-16 ; UX-DR : apparition d'Anam (beats ouverture et nommer).

**Critères d'acceptation :**

- **Étant donné** la séance, **Quand** elle démarre, **Alors** elle part du **strict minimum** (prénom et date de naissance), aucune autre donnée n'étant bloquante (FR-010) **Et** sans heure de naissance, Anam **explique ce qui reste disponible et où la trouver** (FR-011), sans blocage jusqu'au bilan.
- **Étant donné** l'arc *construire → observer → nommer → clore*, **Quand** une phase progresse, **Alors** ses **conditions de sortie** sont évaluées côté serveur et écrites dans la **trace** (vérifiables sans être visibles : aucune étape, barre ou minuteur à l'écran) **Et** pour une durée cible de 12 à 20 min, le système ne coupe jamais sur un minuteur (FR-002, FR-004).
- **Étant donné** la phase *observer*, **Quand** l'observation n'a pas encore été délivrée, **Alors** elle n'est **JAMAIS délivrée avant la fin de la phase observer** (FR-005) **Et** au moins **trois moments de restitution** (marqués `restitution: true`) interviennent, répartis avant la clôture, rendus exactement comme n'importe quel tour (FR-003).
- **Étant donné** les signaux requis avant de nommer (au moins un élément personnel non sollicité · au moins une reformulation confirmée · **aucun signal de détresse de niveau ≥ 1 actif** · pas de rejet des deux dernières propositions), **Quand** un seul manque, **Alors** Anam **diffère** et poursuit la phase *observer* (FR-007).
- **Étant donné** le moment où Anam nomme, **Quand** l'observation est délivrée, **Alors** le beat « nommer » déclenche l'**apparition d'Anam en format Présence** (composant de la Story 2.2) **Et** l'observation vise ce que la personne est **prête à entendre**, une chose vraie et légèrement inconfortable.

---

### Story 2.8 : La voix d'Anam et le contrôle automatisé bloquant

En tant qu'utilisatrice, je veux qu'Anam parle **court, en hypothèses, sans flatterie ni jargon médical, et sans jamais inventer une parole d'Anima**, afin que la franchise qui fait le produit soit garantie et non espérée.

**Couvre :** FR-006, FR-009, FR-023, FR-082, FR-083, FR-084, FR-085, FR-086, FR-087, NFR-008

**Critères d'acceptation :**

- **Étant donné** un tour d'Anam, **Quand** il sort, **Alors** il fait **au maximum trois phrases** (tronqué à la troisième ponctuation finale, manquement journalisé), sans liste à puces, sans récapitulatif empathique, sans conclusion enveloppante (FR-084) **Et** en tutoiement, sans emoji, sans point d'exclamation, sans majuscule d'emphase (FR-083).
- **Étant donné** toute observation, **Quand** elle est formulée, **Alors** c'est en **hypothèse réfutable** (« j'ai l'impression que… je me trompe ? »), jamais en verdict (FR-006) **Et** neutre sur le jugement, chaleureuse sur l'attention (FR-082).
- **Étant donné** une observation contestée, **Quand** l'utilisatrice la rejette, **Alors** Anam **recule sans flatter** (elle ne s'excuse pas platement, elle rend la main : « alors dis-moi comment tu le vois, toi ») **Et** la correction est enregistrée comme matière (FR-009).
- **Étant donné** le contrôle automatisé bloquant, **Quand** il s'exécute en CI, **Alors** il s'applique à **toute l'interface et à tous les contenus** (libellés, e-mails, page `/aide`, CGU, fiches store, bilans, restitutions — pas seulement la conversation) et rejette **le lexique médical** (zéro médical — NFR-008), **les formulations bannies** de `anam-voice.md` (FR-085) **ET** le mot **« soin » / « soigner » et leurs dérivés** (FR-023) **Et** tout manquement **bloque le déploiement**.
- **Étant donné** une référence à Anima, **Quand** Anam cite sa source, **Alors** elle ne le fait qu'à partir du **corpus fourni** et à la troisième personne (Anam ≠ Anima — FR-086), ne **fabrique jamais une parole d'Anima** (défaut critique) **Et** ne revendique jamais un affect qu'elle n'a pas (ni « je ressens », ni « ça me touche », ni « je m'inquiète » — FR-087).

---

### Story 2.9 : La clôture par Anam et le placement gardé du paywall

En tant qu'utilisatrice, je veux qu'**Anam clôture elle-même la séance** et pose un bilan lisible, afin de n'avoir jamais à m'extraire d'une conversation qui me retient — l'offre n'arrivant qu'après, jamais pendant.

**Couvre :** FR-008, FR-043 (garde) ; UX-DR : apparition d'Anam (beat clôture → Veille), bloc document.

> Note : l'intégration **Stripe réelle**, la carte d'abonnement et la sollicitation premium (FR-014, FR-057) relèvent de l'**Epic 3**. Cette story livre le **placement gardé** (point de montage) et la clôture, pas le paiement.

**Critères d'acceptation :**

- **Étant donné** la phase *nommer* satisfaite (observation délivrée en hypothèse et l'utilisatrice y a répondu), **Quand** Anam clôt, **Alors** c'est **elle** qui clôt (l'utilisatrice n'a jamais à s'extraire — FR-008) **Et** en un tour, trois phrases maximum, dans son registre normal (pas de récapitulatif, pas de conclusion enveloppante). Référence : « on en a assez fait pour ce soir. »
- **Étant donné** la clôture, **Quand** elle survient, **Alors** le beat clôture déclenche l'apparition d'Anam qui passe en **format Veille** **Et** après une **respiration double**, le **bilan** s'insère dans le fil comme **bloc document** (registre document : titres et listes autorisés).
- **Étant donné** le bilan livré, **Quand** il est posé, **Alors** le **composeur reste actif** (aucun bouton « terminer », aucun « reprendre ») **Et** si l'utilisatrice écrit après, Anam répond dans l'allocation résiduelle mais **ne rouvre pas l'arc** (pas de nouvelle observation, pas de nouvelle phase).
- **Étant donné** le placement du paywall, **Quand** il se monte, **Alors** c'est **uniquement sous le bilan** (jamais pendant, jamais avant) **Et** uniquement si `limites_levees` est **faux** (garde de la Story 2.5) — l'intégration Stripe relève de l'Epic 3.
- **Étant donné** un signal de détresse en cours de séance, **Quand** il apparaît, **Alors** la séance **cesse d'être une séance** : le bilan et le paywall **ne sont pas produits** **Et** le protocole de détresse prend le relais (Stories 2.3–2.6).

## Epic 3 : Devenir premium

**Objectif :** à la clôture de la première séance, sur un bilan déjà livré, l'utilisatrice peut s'abonner par paiement web Stripe et débloquer la relation dans la durée. Le tronc reste gratuit, les branches sont premium ; le compte gratuit n'est jamais coupé à zéro ; le prix est unique et sans dark pattern ; la garantie de remboursement est annoncée sur la carte ; la résiliation se fait en trois clics, par la même voie que la souscription. Aucun paywall, aucune mécanique commerciale ne s'interpose jamais sur la sécurité.

---

### Story 3.1 : L'ossature d'abonnement — Stripe Checkout, webhooks idempotents, projection d'état

En tant qu'utilisatrice, je veux que ma souscription premium et son état soient enregistrés de façon fiable et sans double effet, afin que mon accès reflète exactement ce que j'ai payé, sans double débit ni perte.

**Couvre :** FR-056 · NFR-018 · conventions « Événements externes » (idempotence Stripe par `provider_event_id`, `abonnement` = projection à écrivain unique) et « Data & formats » (prix Stripe, EUR, entiers centimes).

**Critères d'acceptation :**

- **Étant donné** une utilisatrice authentifiée qui choisit de s'abonner, **Quand** elle lance la souscription, **Alors** le serveur crée une session **Stripe Checkout hébergée** (NFR-018) au prix unique de **69 €/an exprimé en entiers centimes EUR (6900)**, **Et** le navigateur ne détient jamais de clé secrète Stripe — la clé unique vit en secret serveur (env Vercel), jamais côté client.
- **Étant donné** un événement Stripe entrant (paiement réussi, renouvellement, échec, résiliation, remboursement), **Quand** le webhook le reçoit, **Alors** sa **signature Stripe est vérifiée** avant tout traitement, **Et** le traitement est **idempotent par `provider_event_id`** via la table `evenements_traites` : un même événement rejoué **ne produit aucun second effet**.
- **Étant donné** l'état d'abonnement d'une utilisatrice, **Quand** un événement le fait évoluer, **Alors** la table `abonnement` est écrite par un **unique chemin de code (projection à écrivain unique)** — jamais deux écrivains concurrents — et son état vaut `actif | resilie | expire`.
- **Étant donné** une souscription menée à son terme sur Stripe, **Quand** l'utilisatrice revient dans l'app, **Alors** l'**entitlement premium dérive de `abonnement.actif`** et constitue la **source de vérité unique** que les gardes par fonctionnalité (Stories 3.3 et 3.4) interrogent, débloquant les capacités de FR-056 : conversation illimitée, branches, lectures, ancrages, plans d'étapes, synthèse périodique, mémoire longue.
- **Étant donné** un retour de Stripe (succès, échec ou abandon), **Quand** l'utilisatrice est redirigée, **Alors** elle revient **exactement là où elle était** avec une **ligne système sobre**, sans message d'échec dramatisé et sans relance, **Et** ce texte est en **registre produit, jamais signé de la voix d'Anam**.
- **Et** le libellé porté sur le relevé bancaire est **neutre** (paramètre, jamais codé en dur ; sa valeur finale dépend de l'entité juridique — lacune signalée).

---

### Story 3.2 : Le paywall à la clôture de la première séance

En tant qu'utilisatrice qui vient de terminer sa première séance, je veux voir une proposition d'abonnement claire, honnête et sans pression, afin de décider librement sur un bilan déjà livré.

**Couvre :** FR-014 · FR-057 · FR-061 · FR-089 (annonce de la garantie sur la carte) · rappel du périmètre gratuit (FR-055) et premium (FR-056) sur la même carte · AD-9 (garde `limites_levees`).

**Critères d'acceptation :**

- **Étant donné** une première séance close par Anam et son bilan inséré dans le fil, **Quand** la clôture est atteinte, **Alors** la **carte d'abonnement apparaît sous le bilan uniquement** (FR-014) — **jamais pendant, jamais avant** — **Et** elle s'insère dans le fil, **jamais en modale, en plein écran ni en interstitiel**.
- **Étant donné** la carte d'abonnement, **Quand** elle s'affiche, **Alors** elle porte un **prix unique 69 €/an sans prix barré**, **aucun compte à rebours, aucune mention de places limitées, aucun bandeau d'urgence** (FR-061, zéro dark pattern), **Et** une **action primaire « M'abonner »** (vers Stripe Checkout, Story 3.1) et une **action secondaire « Pas maintenant » de lisibilité strictement égale**.
- **Étant donné** la carte, **Quand** elle est lue, **Alors** la **garantie de remboursement (FR-089) est écrite sur la carte elle-même**, en `{typography.meta}` à côté du prix : « si aucune branche n'a été posée au bout de trois mois, remboursement sur simple demande » — formulée sur un **artefact du produit**, **jamais** en termes d'état ou de résultat personnel, **jamais** reléguée aux conditions générales ni derrière un lien.
- **Et** la carte dit sur la même surface **ce qui reste gratuit** (FR-055) et **ce qu'inclut le premium** (FR-056), en **registre système — jamais la voix d'Anam** : Anam ne vend rien.
- **Étant donné** une utilisatrice qui touche « Pas maintenant », **Quand** elle refuse, **Alors** la carte **ne réapparaît plus dans la session** et le produit **ne relance jamais sur minuterie** — **une seule sollicitation** (FR-057) ; l'abonnement reste ensuite atteignable depuis le menu de compte.
- **Étant donné** un épisode de détresse actif (`limites_levees` vrai, AD-9), **Quand** une clôture surviendrait, **Alors** le **bilan, la carte d'abonnement et le bandeau de quota refusent de se monter** (garde technique, pas règle de contenu) — aucun paywall ne s'interpose sur la sécurité, y compris et surtout sur un compte gratuit à quota épuisé.

---

### Story 3.3 : Tronc gratuit, branches premium, socle jamais coupé

En tant qu'utilisatrice sur un compte gratuit, je veux voir mon tronc et l'espace où mes branches pousseraient, afin de comprendre honnêtement ce que j'ai et ce qui viendrait, sans verrou humiliant.

**Couvre :** FR-088 · FR-055 · FR-058.

**Critères d'acceptation :**

- **Étant donné** un compte gratuit, **Quand** l'utilisatrice ouvre la destination **L'arbre**, **Alors** elle **voit son tronc** (bâti sur le socle calculé, gratuit), y compris **incomplet**, **Et** la destination Arbre est présente dans la barre basse **exactement comme sur un compte premium** — **ni grisée, ni cadenassée, ni marquée d'une pastille « premium »**.
- **Étant donné** un compte gratuit sans branche, **Quand** l'arbre s'affiche, **Alors** elle voit **l'espace vide où les branches pousseraient** — le même vide généreux qu'un compte premium sans branche — **Et jamais** un cadenas sur le dessin, un aperçu flouté, des branches fantômes en pointillé, un bandeau « passez au premium » ni un compteur de branches manquantes (FR-088).
- **Étant donné** que le tronc est gratuit et les branches premium, **Quand** un compte gratuit atteint la création ou la persistance d'une branche, **Alors** l'accès est **gardé par l'entitlement premium (Story 3.1) côté serveur**, jamais par un simple masquage client.
- **Étant donné** le périmètre gratuit à vie (FR-055), **Quand** l'utilisatrice utilise l'app sans payer, **Alors** restent accessibles **indéfiniment** : numérologie complète, thème natal selon données disponibles, horoscope quotidien, mantra du jour, test d'ennéagramme, **la première séance intégrale jusqu'au bilan**, les **ressources d'aide (FR-077)** et le **tronc de l'arbre**.
- **Étant donné** un compte gratuit dont l'allocation résiduelle s'épuise (Story 3.4), **Quand** cet épuisement survient, **Alors** le compte **n'est jamais coupé à zéro** (FR-058) : le socle reste entièrement accessible.
- **Et** une phrase sobre en registre produit peut, **une seule fois et sans bouton d'achat**, indiquer que les branches se posent en conversation — elle ne clignote pas et ne réapparaît pas.

---

### Story 3.4 : Allocation résiduelle et métrage d'usage exactement-une-fois

En tant qu'utilisatrice gratuite, je veux continuer un moment à parler à Anam après ma première séance sans que la relation ne s'arrête net, et sans que la première séance soit dégradée, afin que l'abonnement se propose au bon moment.

**Couvre :** FR-079 · FR-059 · conventions « Métrage & paywall » (tokens écrits exactement une fois, interaction paywall/allocation résiduelle, garde `limites_levees` AD-9/AD-17).

**Critères d'acceptation :**

- **Étant donné** une requête IA logique, **Quand** elle est servie, **Alors** les **tokens serveur sont écrits exactement une fois** dans `usage_ia` (clé d'idempotence), **réconciliés à la fin ou à l'avortement du stream**, **Et** `usage_ia` **ne contient aucune donnée art. 9**.
- **Étant donné** la **première séance gratuite**, **Quand** elle se déroule, **Alors** sa **qualité n'est pas dégradée** (FR-059) — plein modèle, plein comportement — **Et** elle **n'est pas décomptée de l'allocation résiduelle**, qui ne s'applique qu'**après** le bilan (FR-079).
- **Étant donné** un compte gratuit après la première séance, **Quand** l'utilisatrice continue d'échanger, **Alors** elle dispose d'une **allocation résiduelle de conversation** dont le **volume est lu depuis la configuration à l'exécution** — paramètre produit ajustable, **jamais codé en dur** (FR-079).
- **Étant donné** l'allocation résiduelle épuisée, **Quand** l'utilisatrice tente de poursuivre, **Alors** une **ligne système unique** en registre produit l'indique (« L'échange avec Anam s'arrête ici pour ce mois-ci. Le reste de l'app reste ouvert. »), le **composeur reste visible mais désactivé** avec le motif en texte à côté, **Et** le socle reste entièrement accessible — jamais « Passe au premium pour continuer ».
- **Étant donné** un compte premium, **Quand** l'utilisatrice échange, **Alors** la **conversation est illimitée** (FR-056) : aucune coupure de quota.
- **Étant donné** un épisode de détresse (`limites_levees` vrai, AD-9/AD-17), **Quand** le quota serait épuisé, **Alors** la conversation **ne se coupe jamais** et aucun bandeau de quota ne s'affiche — le drapeau lève toute limite pour la durée de l'épisode ; **Et** en l'absence du sous-système de détresse, le drapeau vaut **faux par défaut** et ne bloque jamais la coupure de quota ordinaire.

---

### Story 3.5 : Résiliation en trois clics et garantie de remboursement

En tant qu'abonnée, je veux pouvoir résilier aussi simplement que je me suis abonnée et être remboursée si le produit n'a rien produit, afin de partir sans friction et en confiance.

**Couvre :** FR-060 · FR-089 (éligibilité et exécution du remboursement) · conventions « Événements externes » (résiliation et remboursement rejouables sans double effet).

**Critères d'acceptation :**

- **Étant donné** une abonnée, **Quand** elle veut résilier, **Alors** elle le fait **par la même voie que la souscription** (web), en **trois clics maximum** : menu → « L'abonnement » → « Résilier », **la confirmation étant sur la même vue, un seul bouton** (FR-060, loi du 16 août 2022).
- **Étant donné** le parcours de résiliation, **Quand** elle le suit, **Alors** il **ne comporte aucun questionnaire de départ, aucune offre de rétention, aucun « es-tu sûre ? » à étages** — aucun dark pattern.
- **Étant donné** une reconduction tacite à venir, **Quand** l'échéance approche, **Alors** une **information avant reconduction** est envoyée par **courriel à objet neutre** (FR-060).
- **Étant donné** une abonnée depuis **trois mois n'ayant posé aucune branche**, **Quand** elle **demande** le remboursement depuis « L'abonnement » (**sans questionnaire ni justification à fournir**), **Alors** elle est **remboursée** — la garantie porte sur un **artefact du produit (une branche posée)**, jamais sur son état ni sur un résultat personnel.
- **Étant donné** un remboursement ou une résiliation déclenchés, **Quand** l'opération est traitée via Stripe (Story 3.1), **Alors** elle est **rejouable sans double effet** : un rejeu ne rembourse ni ne résilie deux fois (idempotence des événements externes).
- **Et** l'état `abonnement` reflète la résiliation via la **projection à écrivain unique** (Story 3.1), l'entitlement premium s'éteignant à la fin de la période déjà payée — **et l'arbre et les données ne régressent jamais du fait de la résiliation**.

## Epic 4 : La mémoire & l'arbre

**Objectif.** L'utilisatrice voit naître ses branches — proposées par Anam, validées et **nommées par elle** —, son arbre pousser **sans jamais régresser**, et relit ses prises de conscience datées. La mémoire tient sur **trois couches** (journal brut, faits extraits, branches), avec **rappel opportun**, **synthèse périodique** et **plans d'étapes**. Deux garanties portent tout : rien n'est décrété sur elle, rien ne recule. L'epic **fonde aussi l'ordonnanceur unique** (Story 4.8), sur lequel s'appuient la synthèse et les rappels : il est ainsi livrable sans dépendre d'un epic ultérieur.

**Cadre invariant (rappel).** Anam **propose**, l'utilisatrice **valide et nomme** — une branche non nommée par elle n'existe pas (FR-025/026). L'arbre **ne régresse jamais** sauf effacement (FR-029, FR-067). La feuillaison est **progressive** et le rayonnement (pleine lumière) **jamais inféré, déclaré par elle** (FR-028). **Aucun score, note, jauge ni série** (FR-031). Un fait supprimé **ne ressuscite jamais** (AD-18). La **monotonie est gardée à l'écriture** (contrainte SQL), pas au rendu (AD-8). Aucune branche ne naît **pendant un épisode de détresse ni dans les 72 h** (AD-17). L'arbre est une **projection** du modèle de scène, le rendu reste **muet** (AD-7). Reconceptualisation et synthèse passent par le **modèle fort** (AD-5) ; la détection vit dans le **pipeline sécurité-d'abord** (AD-16).

---

### Story 4.1 : Le journal brut — la première couche, verbatim et inaltérable

En tant qu'utilisatrice, je veux que chacun de mes mots soit conservé exactement tel que je les ai écrits, afin qu'Anam se souvienne de moi sans jamais déformer ce que j'ai dit.

**Couvre :** FR-062 (couche « journal brut ») ; AD-8 (verbatim immuable), AD-4 / AD-12 (frontière art.9, RLS deny-by-default), NFR-017 (aucune entrée perdue).

**Critères d'acceptation :**

- **Étant donné** un tour que j'écris en conversation, **Quand** il est enregistré, **Alors** il est stocké dans `entree_journal` mot pour mot avec un horodatage ISO 8601 UTC, **Et** il n'est jamais réécrit ni modifié par le produit ensuite.
- **Étant donné** une entrée de journal déjà écrite, **Quand** le produit tente une écriture courante dessus, **Alors** seule l'insertion (append-only) est permise, **Et** toute mise à jour ou suppression courante est refusée — l'effacement au titre du droit (FR-067) restant la seule exception, traitée dans l'épic « données ».
- **Étant donné** la frontière de données sensibles, **Quand** la table `entree_journal` est créée, **Alors** elle naît en RLS deny-by-default, accessible uniquement sous le JWT de l'utilisatrice (jamais `service_role`), chiffrée au repos et en transit, **Et** une table art.9 sans politique casse le build (test CI).
- **Étant donné** une coupure réseau au moment de l'envoi, **Quand** la connexion revient, **Alors** le message est réémis et conservé sans qu'aucune entrée ne soit perdue — la capture est indépendante du traitement.
- **Étant donné** qu'une branche ou un fait devra pointer vers son origine, **Quand** une entrée est écrite, **Alors** elle porte un identifiant stable (`uuid`) utilisable comme `extrait_source`, positionnant le message exact (pas la journée, pas la séance).

---

### Story 4.2 : Les faits extraits — profil vivant, idempotent, à l'épreuve des résurrections

En tant qu'utilisatrice, je veux qu'Anam retienne des faits clairs sur moi sans jamais faire resurgir ce que j'ai corrigé ou supprimé, afin de garder la main sur l'image qu'elle se fait de moi.

**Couvre :** FR-062 (couche « faits extraits ») ; AD-18 (provenance, idempotence, tombstones), AD-8.

**Critères d'acceptation :**

- **Étant donné** un tour de conversation, **Quand** l'extraction post-tour s'exécute, **Alors** chaque fait est écrit dans `fait_extrait` avec `origine` (`extrait` | `utilisatrice`), `statut` (`actif` | `corrige` | `supprime`), une **clé de dédoublonnage stable** et un lien vers son entrée de journal source.
- **Étant donné** un fait déjà présent, **Quand** la même information est ré-extraite, **Alors** l'opération est un **upsert idempotent** par la clé de dédoublonnage, **Et** aucun doublon n'est créé.
- **[DUR]** **Étant donné** un fait que l'utilisatrice a corrigé ou supprimé (tombstone), **Quand** une ré-extraction ou une synthèse ultérieure rencontre la même information, **Alors** le fait n'est **jamais** réécrit ni ressuscité, **Et** la version de l'utilisatrice prime — le tombstone est respecté sans exception.
- **Étant donné** deux écrivains possibles (extraction automatique et édition par l'utilisatrice), **Quand** l'un ou l'autre écrit, **Alors** les deux passent par la **même** fonction de merge possédée dans `lib/domain/`, **Et** il n'existe aucun second chemin d'écriture.
- **Étant donné** la frontière art.9, **Quand** `fait_extrait` est créée, **Alors** la table naît en RLS deny-by-default sous JWT utilisatrice, chiffrée.

---

### Story 4.3 : Le rappel opportun — la franchise par la comparaison

En tant qu'utilisatrice, je veux qu'Anam me rappelle la bonne chose au bon moment plutôt que de tout ressasser, afin qu'elle puisse me faire remarquer une répétition parce qu'elle a vraiment de quoi comparer.

**Couvre :** FR-065 (rappel spécifique et opportun), FR-068 (franchise rendue possible par la mémoire) ; AD-18 (tombstones respectés), AD-4 (résumé glissant sous frontière art.9).

**Critères d'acceptation :**

- **Étant donné** un fil en cours, **Quand** Anam prépare sa réponse, **Alors** le contexte assemblé privilégie un rappel **spécifique et opportun** (résumé glissant + faits pertinents) plutôt qu'un déversement de tout l'historique.
- **Étant donné** un thème que l'utilisatrice a déjà abordé auparavant, **Quand** elle y revient, **Alors** Anam peut faire remarquer la répétition en s'appuyant sur des faits extraits **datés**, **Et** la remarque cite un point de comparaison réel, jamais une impression vague.
- **Étant donné** qu'un fait a été supprimé ou corrigé, **Quand** le rappel est assemblé, **Alors** seuls les faits `actif` alimentent la comparaison, **Et** un tombstone n'est jamais rappelé.
- **Étant donné** le résumé glissant, **Quand** il est mis en cache, **Alors** il reste sous la frontière art.9 (ZDR, `no-store`), **Et** il est purgé à l'effacement.
- **Étant donné** qu'aucun fait pertinent n'existe, **Quand** Anam répond, **Alors** elle n'invente pas de rappel — l'absence de matière n'est jamais comblée par une généralité.

---

### Story 4.4 : La détection de reconceptualisation — modèle fort, sécurité d'abord

En tant qu'utilisatrice, je veux que les moments où je change de regard sur moi-même soient repérés finement et jamais pendant que je vais mal, afin qu'une prise de conscience ne soit proposée que quand elle m'appartient vraiment.

**Couvre :** FR-024 (détection de reconceptualisation) ; AD-16 (pipeline par message, sécurité d'abord), AD-5 (modèle fort), AD-17 (suppression pendant l'épisode + 72 h).

**Critères d'acceptation :**

- **Étant donné** un tour utilisateur, **Quand** il entre dans le pipeline serveur, **Alors** l'**évaluation de sécurité s'exécute en premier**, **Et** la détection de reconceptualisation ne s'exécute qu'ensuite, dans le même pipeline ordonné (`lib/safety/` → `lib/domain/`) — aucun détecteur n'est appelé hors de ce pipeline.
- **Étant donné** la détection de reconceptualisation, **Quand** elle s'exécute, **Alors** elle utilise le modèle **fort** (jamais le léger, en aucune circonstance), le tier étant résolu par la politique serveur.
- **[DUR / AD-17]** **Étant donné** un niveau de détresse ≥ 1 (épisode en cours ou dans les 72 h suivantes), **Quand** un tour est traité, **Alors** la sortie de reconceptualisation est **supprimée** pour l'épisode (pas seulement ignorée), **Et** aucun marqueur n'est produit.
- **Étant donné** un marqueur détecté (« avant je pensais X, maintenant Y », prise de distance, rupture d'un récit répété), **Quand** il est retenu, **Alors** il est enregistré comme **signal en attente** rattaché à l'entrée de journal exacte, **Et** rien ne se manifeste à l'écran sur l'instant (aucun surlignage, aucune pastille).
- **Étant donné** le terme réservé « reconceptualisation », **Quand** le signal est traité, **Alors** il n'est **jamais** confondu avec la détection de détresse — ce sont deux évaluations distinctes du pipeline.

---

### Story 4.5 : La naissance d'une branche — Anam propose, l'utilisatrice valide et nomme

En tant qu'utilisatrice, je veux qu'Anam me propose de faire une branche d'un moment, que je décide et que je la nomme avec mes propres mots, afin que rien ne soit décrété sur moi et que la branche pointe exactement là où ça s'est produit.

**Couvre :** FR-025 (proposée, jamais décrétée), FR-026 (validée **et** nommée), FR-027 (datée, liée à l'extrait exact), FR-062 (troisième couche : branches) ; AD-8, AD-16 / AD-17 (garde au point d'écriture).

**Critères d'acceptation :**

- **Étant donné** un signal de reconceptualisation retenu la veille, **Quand** l'utilisatrice revient, **Alors** Anam **propose** une branche en conversation (le lendemain, jamais sur l'instant), avec deux réponses en ligne « Oui » / « Non », **Et** elle ne la crée jamais d'office.
- **[DUR]** **Étant donné** une proposition acceptée, **Quand** l'utilisatrice nomme la branche, **Alors** un champ **vide** s'ouvre (aucun nom pré-rempli, aucune suggestion, aucun exemple), **Et** une branche sans nom donné par elle n'est **jamais** persistée : elle n'existe pas.
- **Étant donné** une branche créée, **Quand** elle est écrite, **Alors** elle porte le **nom de l'utilisatrice**, sa `date_naissance`, l'état `naissance` et un `extrait_source_id` pointant vers le **message exact** dont elle provient.
- **Étant donné** un refus « Non », **Quand** l'utilisatrice répond, **Alors** Anam renvoie « Ok. » et rien d'autre, **Et** la proposition n'est **jamais** rejouée pour le même moment.
- **[DUR / AD-17]** **Étant donné** un épisode de détresse en cours ou dans les 72 h, **Quand** la création de branche est tentée, **Alors** elle est refusée **au point d'écriture** (`create-branche` interroge `episode_detresse`) — aucune branche ne naît d'un moment de détresse.
- **Étant donné** l'extrait source d'une branche, **Quand** on tente de le supprimer isolément, **Alors** c'est refusé — le lien branche → extrait ne peut pas être cassé.

---

### Story 4.6 : L'arbre — projection muette, fiche de branche, vue liste de rang égal

En tant qu'utilisatrice, je veux voir mes branches sur mon arbre et retrouver d'un geste l'extrait exact d'où chacune est née, afin d'avoir la preuve visible de mon chemin, sans jamais qu'on me le note ni qu'on me le mesure.

**Couvre :** FR-027 (fiche → extrait source), FR-029 (le rendu ne régresse jamais — projection de l'état max), FR-031 (aucun score, note, jauge, série) ; AD-7 (arbre = projection, rendu muet), AD-8.

**Critères d'acceptation :**

- **Étant donné** l'état persisté des branches, **Quand** l'arbre s'affiche, **Alors** `lib/scene/` **projette** l'état (tronc + branches, `etat` + `intensite`), **Et** `render/` reste **muet** — il ne décide ni ne garde aucune monotonie et ne porte aucune logique métier.
- **[DUR / défensif]** **Étant donné** une branche dont l'état maximal persisté est connu, **Quand** le serveur renvoie un état inférieur, **Alors** le client **conserve l'état supérieur** et journalise un incident — l'arbre ne régresse jamais au rendu, la monotonie d'écriture vivant en Story 4.7.
- **Étant donné** un point d'accroche de branche (cible ≥ 44 px), **Quand** l'utilisatrice le touche, **Alors** la fiche s'ouvre (nom donné par elle, date, extrait exact rendu **comme un tour d'utilisatrice**), **Et** « Voir dans la conversation » ouvre le fil **positionné sur le message exact** (FR-027), avec retour au même cadrage et au même zoom.
- **[DUR / FR-031]** **Étant donné** l'arbre et sa fiche, **Quand** ils sont rendus, **Alors** ils ne portent **aucun** compteur de branches, pourcentage, niveau, jauge, série, badge ni score, **Et** l'état d'une branche n'est jamais porté par la couleur seule.
- **Étant donné** le plancher d'accessibilité, **Quand** l'utilisatrice ouvre la **vue liste** (bascule persistée), **Alors** chaque branche y est listée de **rang égal** au canevas : nom, date, **état écrit en toutes lettres** (naissance / feuillaison / rayonnement), extrait — atteignable au clavier et au lecteur d'écran, le canevas portant `role="img"` et un `aria-label` court.
- **Étant donné** la fiche de branche (étiquette posée sur l'illustration, jamais modale), **Quand** elle est ouverte, **Alors** elle porte les deux actions **« Voir dans la conversation »** et **« Renommer »** — « Renommer » rouvre un champ, le nouveau nom restant donné par l'utilisatrice — **Et** le reste de l'arbre s'estompe sans flou (UX-DR-26).
- **Étant donné** le canevas de l'arbre, **Quand** l'utilisatrice le manipule, **Alors** il est **déplaçable et zoomable** (pan au doigt ; zoom pincement / molette / boutons +/− au clavier ; double-tap = cadrer), doublé de la vue liste de rang égal, **Et** aucun compteur, pourcentage ni légende permanente n'y figure (UX-DR-24).

---

### Story 4.7 : Le cycle de vie d'une branche — naissance → feuillaison → rayonnement, monotone et gardé à l'écriture

En tant qu'utilisatrice, je veux voir une branche s'intégrer par degrés quand j'y reviens, et déclarer moi-même quand elle entre en pleine lumière, afin que ma croissance se lise dans la matière et jamais dans un chiffre, et qu'elle ne recule jamais.

**Couvre :** FR-028 (naissance / feuillaison / rayonnement, feuillaison progressive, rayonnement jamais inféré — déclaré par elle), FR-029 (ne régresse jamais) ; AD-8 (transition monotone gardée à la persistance), AD-7.

**Critères d'acceptation :**

- **[DUR]** **Étant donné** les transitions d'état, **Quand** une branche change d'état, **Alors** la transition est strictement monotone `naissance → feuillaison → rayonnement`, gardée **à l'écriture** par une **fonction de transition unique** dans `lib/domain/` **et** une **contrainte SQL** (CHECK / trigger), **Et** le serveur ne régresse jamais l'état.
- **[DUR]** **Étant donné** la feuillaison, **Quand** l'utilisatrice revient spontanément sur le thème de la branche au fil des semaines, **Alors** la feuillaison s'amorce et progresse **par degrés** via un champ `intensite` continu (jamais un simple flip d'enum), **Et** aucun seuil, aucune étape numérotée ni « 2 retours sur 3 » n'est affiché, l'utilisatrice n'ayant rien à confirmer.
- **[DUR]** **Étant donné** le rayonnement (la pleine lumière), **Quand** il est acquis, **Alors** c'est **uniquement** parce que l'utilisatrice l'a **déclaré elle-même** (elle l'a vécu — passage à l'acte ou sentiment que c'est devenu vrai en elle ; geste explicite depuis la fiche ou en réponse à Anam), **Et** le rayonnement n'est **jamais** inféré du contenu de la conversation.
- **Étant donné** une régression tentée (mauvais mois, réécriture, état inférieur soumis), **Quand** la transition est soumise, **Alors** la contrainte de persistance la **rejette**, **Et** seule l'exception de l'effacement (FR-067) peut retirer une branche — jamais le produit.
- **Étant donné** un changement d'état, **Quand** l'utilisatrice ouvre l'arbre, **Alors** le changement est **déjà là**, sans animation de croissance, sans particule, sans confetti ni son, **Et** une phrase sur la fiche dit ce qui a changé et quand.

---

### Story 4.8 : La fondation de l'ordonnanceur unique

En tant qu'équipe Anam responsable de la fiabilité et de la conformité, je veux **fonder l'ordonnanceur unique** (Vercel Cron) qui possède tous les jobs périodiques et les exécute de façon idempotente, afin que la synthèse (Story 4.9) et les rappels d'échéance (Story 4.10) s'appuient sur lui **sans dépendre d'un epic ultérieur** — l'Epic 4 devenant livrable de façon autonome.

**Couvre :** section Opérations (Ordonnanceur unique), AD-14 (exécution périodique possédée) · fondation transverse, aucun FR de contenu direct

**Critères d'acceptation :**

- **Étant donné** que le produit a besoin d'un mécanisme périodique (notifications de rythme, rétention, synthèse), **Quand** ce mécanisme est ajouté, **Alors** il est enregistré comme job de l'ordonnanceur unique, **Et** aucun mécanisme périodique n'existe hors de cet ordonnanceur — ni `setInterval` applicatif, ni cron dispersé, ni tâche déclenchée côté client.
- **Étant donné** un job planifié, **Quand** il est rejoué (même fenêtre, ou reprise après échec), **Alors** son effet est idempotent grâce à une clé d'exécution qui empêche tout double effet, **Et** une trace d'exécution est écrite sans aucune donnée art. 9 en clair.
- **Étant donné** deux environnements isolés (dev / prod), **Quand** un job accède aux données, **Alors** il n'opère que sur le projet Supabase de son propre environnement, **Et** la donnée de prod ne rejoint jamais un environnement de dev.
- **Étant donné** la CI, **Quand** une modification introduit un mécanisme périodique hors de l'ordonnanceur, **Alors** un test de garde échoue et casse le build.
- **Étant donné** qu'un job échoue, **Quand** l'échec survient, **Alors** il est réessayable sans double effet, **Et** une alerte de santé de l'ordonnanceur est levée sans exposer de contenu art. 9.

---

### Story 4.9 : La synthèse périodique — le moment où Anam peut être la plus directe

En tant qu'utilisatrice, je veux recevoir à intervalle régulier un récapitulatif écrit de ce qui s'est dit, afin de relire mon chemin dans un moment où Anam peut être la plus franche.

**Couvre :** FR-066 (synthèse périodique), FR-081 (spécification premium — volet **synthèse**) ; AD-5 (modèle fort), AD-18 (tombstones respectés), AD-17 (exclut la détresse).

**Critères d'acceptation :**

- **Étant donné** l'ordonnanceur unique (fondé en Story 4.8), **Quand** l'intervalle de synthèse arrive, **Alors** la synthèse est produite par un **job idempotent** (aucun mécanisme périodique hors ordonnanceur), **Et** avec le modèle **fort**.
- **Étant donné** la synthèse, **Quand** elle est rédigée, **Alors** elle s'appuie sur les faits `actif` et le journal, **respecte les tombstones** (jamais un fait supprimé, AD-18), **Et** elle est rendue en **bloc document** (titres / listes autorisés hors conversation), conservée et consultable.
- **[AD-17]** **Étant donné** un épisode de détresse, **Quand** la synthèse est produite, **Alors** les épisodes de détresse en sont **exclus** par une clause sur `episode_detresse` — jamais exploités pour la synthèse.
- **Étant donné** une synthèse prête, **Quand** l'utilisatrice est notifiée, **Alors** la notification est discrète et impersonnelle (« Ta synthèse est prête »), dans l'ensemble fermé des motifs d'Anam (plafond une notification / 72 h), **Et** aucun contenu intime ne paraît sur l'écran verrouillé.
- **Étant donné** le registre premium, **Quand** un compte gratuit atteint l'échéance, **Alors** la synthèse n'est pas produite pour lui, **Et** le socle gratuit n'est jamais dégradé.

---

### Story 4.10 : Les plans d'étapes et l'arbitrage d'ouverture — faire vivre une branche avant d'en ouvrir une autre

En tant qu'utilisatrice, je veux transformer une branche en petites intentions concrètes rattachées à elle, et qu'Anam m'invite à en faire vivre une avant d'en ouvrir trop, afin d'intégrer vraiment plutôt que d'accumuler des prises de conscience.

**Couvre :** FR-032 (intentions d'implémentation rattachées à une branche), FR-030 (faire vivre une branche avant d'en ouvrir une autre), FR-031 (aucun compte affiché), FR-081 (spécification premium — volet **plans d'étapes**) ; AD-8.

**Critères d'acceptation :**

- **Étant donné** une branche, **Quand** un plan d'étapes est créé, **Alors** chaque étape est formulée en **intention d'implémentation** (« si X, alors Y »), **Et** elle est **rattachée** à cette branche — jamais une étape flottante.
- **Étant donné** un plan d'étapes, **Quand** l'utilisatrice le revoit, **Alors** il est **révisable** — les intentions peuvent être ajoutées, modifiées ou retirées : c'est une suite vivante, pas figée.
- **Étant donné** une intention avec une échéance qu'elle a elle-même fixée, **Quand** l'échéance arrive, **Alors** le rappel notifié porte sur **son objectif à elle** (motif fermé d'Anam), **Et** jamais un rappel de connexion.
- **[FR-030]** **Étant donné** plusieurs branches ouvertes sans intégration (encore en `naissance`), **Quand** un nouveau moment se présente, **Alors** Anam **propose d'en faire vivre une avant d'en ouvrir une autre**, en conversation, **Et** jamais en bandeau.
- **[DUR / FR-031]** **Étant donné** cet arbitrage, **Quand** Anam propose, **Alors** elle n'affiche **jamais** le compte de branches ouvertes (« 3 branches en cours ») ni aucun chiffre.
- **Étant donné** le registre premium, **Quand** un compte gratuit interagit, **Alors** les plans d'étapes sont une fonction premium, **Et** l'invitation à faire vivre une branche reste une parole d'Anam en conversation.

## Epic 5 : Le socle & la lecture

**Objectif :** l'utilisatrice explore son thème natal, sa numérologie et son ennéagramme, reçoit chaque jour son horoscope et son mantra, et peut tirer une lecture — un tirage réellement aléatoire, isolé de son profil, dont le sens naît de ce qu'elle projette. Le socle est un **calcul pur, jamais un modèle de langage** (FR-047, AD-6) ; la lecture, elle, passe par Anam (AD-3) sur un chemin de données art.9 conforme (AD-4).

> ⚠️ **Porte pré-lancement — licence éphémérides.** Le choix (licence Swiss Ephemeris pro à 700 CHF vs lib permissive moins précise) reste ouvert. Il **ne bloque aucune story** : tout le calcul astral est codé derrière `EphemerisPort`, l'adaptateur étant tranché avant lancement. Les stories concernées sont marquées ⚠️.

---

### Story 5.1 : Le thème natal, calculé une fois et gravé

En tant qu'utilisatrice, je veux que mon thème natal soit calculé exactement à partir de ma date de naissance puis conservé, jamais inventé par une intelligence artificielle, afin de pouvoir m'y fier comme à un socle stable.

**Couvre :** FR-047, FR-048, FR-053, FR-072 · AD-6, AD-3 (jamais l'IA), AD-13 (write-gate consentement), AD-4 (frontière art.9), AD-12 (RLS utilisatrice) · ⚠️ **porte pré-lancement éphémérides** (codable derrière `EphemerisPort`).

**Critères d'acceptation :**

- **Étant donné** une utilisatrice dont le `consentement` art.9 est **valide et non révoqué** (jamais « à la création du compte » — le thème natal est une donnée art.9), **quand** le thème natal est calculé, **alors** il l'est **une seule fois** par du code pur dans `lib/astro/`, **et** stocké (`theme_natal`, relation 1:1, immuable, versionné), **et** aucun appel à un modèle de langage n'intervient (FR-047, AD-6).
- **[DUR / conformité]** **Étant donné** une utilisatrice **sans** `consentement` art.9 valide, **quand** un calcul ou un stockage du thème natal est tenté, **alors** la **write-gate le refuse** (AD-13) — aucune donnée art.9 n'est écrite avant le consentement (FR-072) — **et** ce refus est couvert par un test bloquant en CI.
- **Étant donné** la frontière de données sensibles, **quand** la table `theme_natal` (art.9) est créée et écrite, **alors** elle naît en **RLS deny-by-default** sous le JWT de l'utilisatrice (`auth.uid()`, jamais `service_role` — AD-4, AD-12), chiffrée, **et** une table art.9 sans politique **casse le build** (test CI).
- **Étant donné** un thème déjà calculé, **quand** l'utilisatrice réaffiche son socle, **alors** la valeur est relue depuis le stockage sans recalcul, **et** le coût marginal est nul.
- **Étant donné** que les éphémérides vivent derrière `EphemerisPort` (implémentation déférée), **quand** le calcul s'exécute, **alors** aucun code hors `lib/astro/adapters/` n'appelle l'éphéméride, **et** l'adaptateur est remplaçable sans toucher au domaine.
- **Étant donné** les champs optionnels (nom complet, heure et lieu de naissance), **quand** ils manquent, **alors** le calcul aboutit quand même avec les données disponibles, sans blocage (FR-048).
- **Étant donné** n'importe quelle sortie du thème, **quand** elle est produite, **alors** elle ne contient **aucune prédiction** (FR-053).

---

### Story 5.2 : La numérologie complète et déterministe

En tant qu'utilisatrice, je veux voir ma numérologie complète calculée à partir de mes données, afin de disposer d'un socle gratuit et exact dès l'inscription.

**Couvre :** FR-047, FR-048, FR-053, FR-054.

**Critères d'acceptation :**

- **Étant donné** une date de naissance (et le nom complet s'il est fourni), **quand** la numérologie est demandée, **alors** le chemin de vie et l'ensemble des nombres sont calculés par du code pur dans `lib/astro/`, sans modèle de langage (FR-047), **et** restent disponibles même sans heure ni lieu de naissance (FR-048).
- **Étant donné** un nombre affiché avec son sens, **quand** l'interprétation est rendue, **alors** le texte provient exclusivement du **corpus d'Anima** — aucun texte générique acheté ou repris, aucune génération par un modèle (FR-054, FR-047).
- **Étant donné** une même date, **quand** le calcul est rejoué, **alors** le résultat est strictement identique (déterminisme vérifiable).
- **Étant donné** une sortie numérologique, **quand** elle est présentée, **alors** elle ne formule **aucune prédiction** (FR-053).

---

### Story 5.3 : Dégradation gracieuse sans heure & complétion du tronc

En tant qu'utilisatrice qui ne connaît pas son heure de naissance, je veux un socle honnête sur ce qu'il peut et ne peut pas calculer, et qui se complète le jour où j'ajoute mon heure, afin de ne jamais recevoir une donnée inventée.

**Couvre :** FR-049, FR-050, FR-051 · AD-6 · ⚠️ **porte pré-lancement éphémérides** (ascendant, maisons, lune derrière `EphemerisPort`).

**Critères d'acceptation :**

- **Étant donné** une date de naissance sans heure, **quand** le socle est calculé, **alors** la numérologie complète, le soleil, la quasi-totalité des planètes et l'horoscope quotidien sont disponibles, **et** seuls manquent l'ascendant, les maisons et la lune (si elle change de signe ce jour-là) (FR-049).
- **Étant donné** un élément manquant, **quand** l'utilisatrice consulte le socle, **alors** le produit **annonce clairement ce qui manque et pourquoi** (« je préfère ne pas te l'inventer ») **et** indique où trouver l'heure (copie intégrale de l'acte de naissance, mairie du lieu de naissance), **et** n'affiche jamais rouge, cadenas, pointillé ni pourcentage (FR-050).
- **Étant donné** l'absence d'heure, **quand** le tronc s'affiche, **alors** son état est `incomplet` (contour entier, matière en réserve), **et** il reste gratuit et visible, **et** le mot « incomplet » n'est jamais écrit sur le dessin (FR-051).
- **Étant donné** l'ajout ultérieur de l'heure de naissance, **quand** elle est enregistrée, **alors** le thème natal est **recalculé**, sa version incrémentée et les dépendants invalidés (AD-6), **et** le tronc passe à `complet` au chargement suivant sans animation ni « déblocage », **et** Anam le mentionne **une seule fois** puis plus jamais (motif de retour honnête, jamais une carotte) (FR-051).
- **Étant donné** la fiche explicative du tronc incomplet, **quand** elle est ouverte, **alors** elle porte exactement deux actions : « Ajouter mon heure » et « Où la trouver ».

---

### Story 5.4 : L'horoscope et le mantra du jour (socle quotidien)

En tant qu'utilisatrice, je veux recevoir chaque jour un horoscope et un mantra calculés et impersonnels, afin d'avoir un rendez-vous léger qui n'exige rien de moi.

**Couvre :** FR-033, FR-047, FR-053, FR-054 · ⚠️ **porte pré-lancement éphémérides** (transits derrière `EphemerisPort`).

**Critères d'acceptation :**

- **Étant donné** le thème natal stocké, **quand** un nouveau jour commence (bascule à minuit local), **alors** l'horoscope du jour est **calculé** (jamais généré par un modèle de langage) **et** servi sans attente depuis le cache (FR-033, FR-047).
- **Étant donné** le mantra du jour, **quand** il est affiché, **alors** c'est un **texte court, gratuit et non interactif** issu du corpus d'Anima (FR-054), distinct de l'ancrage et de la lecture (renvoi FR-080).
- **Étant donné** le socle quotidien, **quand** il se manifeste, **alors** il est impersonnel et n'exige rien (pas de série, pas de « tu as manqué hier »), **et** il n'est jamais signé par Anam, **et** il ne référence jamais le journal, une branche ou un échange.
- **Étant donné** une sortie du socle quotidien, **quand** elle est présentée, **alors** elle ne formule **aucune prédiction** (FR-053).

> Périmètre : cette story produit et met à disposition l'horoscope et le mantra du jour. La **notification poussée** du matin (canal, planification) est possédée par l'ordonnanceur du rythme de notifications et sort de ce périmètre.

---

### Story 5.5 : L'ennéagramme — test court ou hypothèse d'Anam

En tant qu'utilisatrice, je veux découvrir mon type d'ennéagramme soit par un test court, soit par une hypothèse qu'Anam me propose sans l'asséner, afin d'avoir le choix du chemin.

**Couvre :** FR-052, FR-054 · AD-3.

**Critères d'acceptation :**

- **Étant donné** le test court, **quand** l'utilisatrice le complète, **alors** le type est déterminé par un **score calculé** (aucun modèle de langage pour le score), **et** l'écran de résultat s'appuie sur le corpus d'Anima (FR-054, FR-052).
- **Étant donné** l'alternative conversationnelle, **quand** Anam propose une hypothèse de type, **alors** elle passe par `AiPort` (AD-3), **et** elle est formulée comme **hypothèse, jamais assénée**, **et** l'utilisatrice peut la refuser ou la corriger (FR-052).
- **Étant donné** un type retenu (par test ou par hypothèse acceptée), **quand** il s'affiche dans le socle, **alors** aucune prédiction ne lui est attachée.

---

### Story 5.6 : L'accueil — la bibliothèque en cartes

En tant qu'utilisatrice, je veux un accueil qui présente mon socle comme une petite bibliothèque de cartes dans un ordre fixe, afin de retrouver mes repères sans être pilotée par un algorithme.

**Couvre :** FR-033 (surface d'affichage), FR-023, FR-080 · présente les sorties de FR-047 (5.1, 5.2, 5.4, 5.5).

**Critères d'acceptation :**

- **Étant donné** l'accueil, **quand** il s'ouvre, **alors** il affiche **4 à 6 cartes maximum** (mantra du jour, horoscope, thème, nombres, ennéagramme) dans un **ordre fixe, jamais algorithmique**, **et** une seule carte est mise en avant par jour, en tête, **et** aucune carte ne porte de badge, de compteur ni de cadenas (FR-033).
- **Étant donné** le vocabulaire du produit, **quand** une carte ou un libellé nomme un contenu, **alors** les trois termes restent distincts : **« mantra du jour »** (court, gratuit, non interactif) · **« ancrage »** (exercice guidé interactif de 2 à 5 min, premium) · **« lecture »** (rituel long avec tirage, premium) — en employer un pour un autre est un défaut (FR-080).
- **Étant donné** le contrôle de lexique, **quand** un libellé de cette région est rendu, **alors** le mot **« soin » et ses dérivés sont absents** (FR-023).
- **Étant donné** une ouverture à froid, **quand** l'accueil s'affiche, **alors** le socle (calculé, mis en cache) paraît sans écran de démarrage animé ni attente.
- **Étant donné** un compte gratuit, **quand** l'accueil s'affiche, **alors** aucune carte premium cadenassée n'y figure : la bibliothèque ne montre que ce qui est disponible.

---

### Story 5.7 : Le tirage isolé & le jeu propriétaire

En tant qu'utilisatrice, je veux que le tirage d'une lecture soit réellement aléatoire et totalement coupé de mon profil, afin de pouvoir faire confiance à ce que la carte me renvoie.

**Couvre :** FR-015, FR-016, FR-022 · AD-11.

**Critères d'acceptation :**

- **Étant donné** une demande de lecture, **quand** la carte est tirée, **alors** le point d'entrée du tirage **n'a aucun accès** au profil, à l'historique ni à l'état émotionnel — **contrainte d'architecture, pas règle de code** (FR-015, AD-11).
- **Étant donné** la sélection, **quand** la graine est produite, **alors** elle provient d'un **CSPRNG système**, **jamais dérivée** de l'identité, du profil ou de l'historique, **et** l'identité ne sert qu'à l'écriture RLS de la `lecture`, jamais comme entrée de sélection (AD-11).
- **Étant donné** un grand nombre de tirages, **quand** on mesure la distribution, **alors** elle est **vérifiablement uniforme et indépendante du profil** (test bloquant sur grand N), **et** chaque tirage est journalisé (graine + horodatage) pour audit.
- **Étant donné** le catalogue de sens, **quand** une carte est tirée, **alors** le catalogue n'existe **que côté serveur** et n'a **aucune représentation côté client** avant la réponse de l'utilisatrice (FR-016, AD-11).
- **Étant donné** le jeu de cartes, **quand** une carte paraît, **alors** c'est un **visuel propriétaire** créé pour Anima, aucun oracle du commerce n'étant embarqué (FR-022).
- **Étant donné** l'interdiction FR-016, **quand** une carte est choisie, **alors** il est **impossible** de sélectionner une carte servant un message prédéterminé (défaut critique).

---

### Story 5.8 : Le rituel de lecture & la restitution écrite

En tant qu'utilisatrice, je veux qu'Anam me montre la carte et me demande d'abord ce que j'y vois, puis construise la lecture à partir de ma projection, afin que le sens vienne de moi et reste consultable.

**Couvre :** FR-017, FR-018, FR-019, FR-020, FR-021, FR-022 · AD-3, AD-4 · renvoi FR-023 (le rituel se nomme « une lecture »).

**Critères d'acceptation :**

- **Étant donné** une carte tirée, **quand** elle est présentée, **alors** un seul visuel propriétaire s'affiche pleine largeur (dépôt simple, sans retournement, sans son, sans mélange animé) (FR-022), **et** Anam demande **« Qu'est-ce que tu vois ? »** et rien d'autre **avant** de dire quoi que ce soit du sens (FR-017).
- **Étant donné** que l'utilisatrice n'a pas encore répondu, **quand** l'écran est affiché, **alors** **aucune signification cataloguée** n'apparaît nulle part : pas de nom de carte, pas de mot-clé, pas d'infobulle, pas de lien « en savoir plus », pas de panneau « signification » (FR-018).
- **Étant donné** la réponse de l'utilisatrice, **quand** Anam construit la lecture, **alors** elle part de **la projection de l'utilisatrice**, à la lumière de ce qu'elle sait d'elle (la personnalisation vit dans la lecture, jamais dans la sélection, FR-019), **et** elle passe par `AiPort` (AD-3) sur un chemin de données art.9 conforme (AD-4).
- **Étant donné** une lecture, **quand** Anam parle, **alors** elle ne formule **aucune prédiction**, aucune date, aucun « il va se passer » (FR-020).
- **Étant donné** une lecture terminée, **quand** elle se pose, **alors** une **restitution écrite** est conservée et consultable dans « Mes lectures », reprenant **les mots de l'utilisatrice** en citation distincte, **et** portant la date, le visuel de la carte et un lien vers l'échange source (FR-021).
- **Étant donné** l'interface du rituel, **quand** ce format est nommé, **alors** il s'appelle **« une lecture »**, et le mot « soin » et ses dérivés n'y apparaissent jamais (renvoi FR-023).

---

### Story 5.9 : L'ancrage — l'exercice guidé premium

En tant qu'utilisatrice premium, je veux un ancrage — un exercice guidé court que je traverse pas à pas —, afin de disposer d'un rendez-vous premium interactif, distinct du mantra du jour et de la lecture.

**Couvre :** FR-056 (périmètre premium), FR-080 (mantra ≠ ancrage), FR-081 (spécification premium — volet **ancrages**) · AD-3 (via `AiPort`), AD-4 (frontière art.9) · renvoi FR-023 (jamais le mot « soin »).

**Critères d'acceptation :**

- **Étant donné** un compte premium, **quand** l'utilisatrice ouvre un ancrage, **alors** c'est un **exercice guidé interactif de 2 à 5 minutes**, à **structure fixe**, déroulé pas à pas depuis le corpus d'Anima (FR-081), **et** l'accès est **gardé par l'entitlement premium (Story 3.1) côté serveur** (FR-056).
- **Étant donné** l'ancrage, **quand** il est présenté, **alors** il reste **strictement distinct** du **mantra du jour** (texte court gratuit non interactif) et de la **lecture** (rituel long avec tirage) — en employer un pour un autre est un défaut (FR-080).
- **Étant donné** le contenu de l'ancrage, **quand** un texte est rendu, **alors** le mot **« soin » et ses dérivés n'y apparaissent jamais** — le format se nomme **« un ancrage »** (renvoi FR-023).
- **Étant donné** la v1, **quand** l'ancrage est livré, **alors** il est **en texte** ; la **variante audio est déférée en v1.1** (hors périmètre v1) et son report ne dégrade pas l'exercice textuel.
- **Étant donné** un compte gratuit, **quand** il tente d'ouvrir un ancrage, **alors** l'accès est refusé côté serveur (premium), **et** le socle gratuit n'est jamais dégradé.

## Epic 6 : Les deux rythmes & tes données

**Objectif.** L'utilisatrice vit avec Anam dans la durée — un socle quotidien impersonnel qui n'exige rien, une Anam rare qui ne se manifeste que lorsqu'elle a quelque chose de spécifique à dire, des notifications discrètes qui ne trahissent rien sur l'écran verrouillé, et une pause proposée quand le rythme s'emballe — et elle maîtrise ses données : voir ce qu'Anam retient d'elle, corriger ou supprimer un fait, exporter l'ensemble, tout effacer. L'epic **s'appuie sur l'ordonnanceur unique fondé en Epic 4 (Story 4.8)** pour ses mécanismes périodiques et livre le **moteur unique de rétention/effacement** (durées appliquées automatiquement, effacement exhaustif propagé aux sous-traitants et aux sauvegardes).

---

### Story 6.1 : Brancher les rythmes et la rétention sur l'ordonnanceur unique

En tant qu'équipe Anam responsable de la fiabilité et de la conformité, je veux que les mécanismes périodiques de cet epic — les deux rythmes de notification et la rétention/effacement — **s'appuient sur l'ordonnanceur unique déjà fondé (Story 4.8)** au lieu d'en créer un second, afin qu'aucun rythme ni aucune rétention ne soit jamais dispersé ailleurs ni exécuté deux fois.

**Couvre :** section Opérations (Ordonnanceur), FR-033 et FR-034 (rythmes déclenchés par l'ordonnanceur), AD-14 (la rétention est logée sur l'ordonnanceur possédé) — **s'appuie sur la fondation de la Story 4.8, ne la recrée pas**.

**Critères d'acceptation :**

- **Étant donné** l'ordonnanceur unique **déjà fondé en Story 4.8**, **Quand** cet epic ajoute un mécanisme périodique (notification du socle, notification d'Anam, rétention/effacement), **Alors** il est enregistré comme **job de cet ordonnanceur existant**, **Et** aucun second ordonnanceur, `setInterval` applicatif, cron dispersé ni tâche côté client n'est créé.
- **Étant donné** un job de rythme ou de rétention, **Quand** il est rejoué (même fenêtre, ou reprise après échec), **Alors** son effet est **idempotent** par la clé d'exécution de l'ordonnanceur, **Et** une trace est écrite sans aucune donnée art. 9 en clair.
- **Étant donné** la CI, **Quand** une modification de cet epic introduit un mécanisme périodique hors de l'ordonnanceur unique, **Alors** le test de garde de la Story 4.8 échoue et casse le build.
- **Étant donné** qu'un job de rythme ou de rétention échoue, **Quand** l'échec survient, **Alors** il est réessayable sans double effet, **Et** l'alerte de santé de l'ordonnanceur est levée sans exposer de contenu art. 9.

---

### Story 6.2 : Le socle quotidien impersonnel et les notifications discrètes

En tant qu'utilisatrice, je veux recevoir, si je le souhaite, une manifestation quotidienne du socle qui reste impersonnelle et dont l'aperçu ne révèle rien, afin de vivre un rythme léger qui n'exige rien et ne me trahit jamais sur mon écran verrouillé.

**Couvre :** FR-033, FR-035, NFR-015 (discrétion des aperçus), NFR-002 (aucun traceur), NFR-004 (aucune inférence d'émotion ne déclenche une notification), et la fondation web push discrète (plomberie et gabarit d'aperçu).

**Critères d'acceptation :**

- **Étant donné** que le socle est calculé et jamais généré par un modèle de langage, **Quand** la notification quotidienne est préparée, **Alors** elle est produite par calcul déterministe (coût marginal nul), **Et** elle n'est jamais signée par Anam, **Et** elle ne fait jamais référence au journal, à une branche ou à un échange.
- **Étant donné** l'heure choisie par l'utilisatrice (8 h 00 locales par défaut), **Quand** cette heure arrive, **Alors** l'ordonnanceur peut émettre une notification du socle dont le titre est « Anam » et le corps ne dépasse pas six mots tirés d'un ensemble fini et relu, **Et** l'aperçu ne porte jamais le contenu spécifique, aucun vocabulaire ésotérique, ni aucun mot de l'utilisatrice.
- **Étant donné** une journée sans ouverture, **Quand** le lendemain arrive, **Alors** aucune notion de série, de rattrapage ou de « tu as manqué hier » n'existe, **Et** aucune notification de réengagement n'est jamais émise.
- **Étant donné** que le web push est refusé ou indisponible (par exemple Safari iOS hors écran d'accueil), **Quand** l'utilisatrice ouvre l'app, **Alors** le socle vit simplement dans l'app (dégradation propre), **Et** la permission n'est demandée qu'une seule fois, en contexte, depuis les réglages, sans bannière insistante.
- **Étant donné** le sélecteur de tâches du système, **Quand** l'app passe en arrière-plan, **Alors** la vignette affiche un privacy-cover neutre, jamais l'imagerie de séance.
- **Étant donné** la préparation et l'envoi d'une notification, **Quand** ils s'exécutent, **Alors** aucune donnée art. 9 ne transite vers un outil d'analyse, de marketing ou de publicité, **Et** aucune inférence d'émotion (voix ou texte) ne déclenche ni ne module la notification.

---

### Story 6.3 : Anam rare et spécifique

En tant qu'utilisatrice, je veux qu'Anam ne me notifie que lorsqu'elle a quelque chose de spécifique à me dire, afin que sa présence reste rare, jamais générique, et que le silence prouve qu'elle ne cherche pas à extraire mon temps.

**Couvre :** FR-034, FR-035 (discrétion réappliquée au régime d'Anam), NFR-015.

**Critères d'acceptation :**

- **Étant donné** le moteur de notification d'Anam, **Quand** aucun des trois motifs autorisés n'existe — proposition de branche le lendemain d'une reconceptualisation, échéance d'une intention d'implémentation formulée par l'utilisatrice, synthèse périodique prête — **Alors** Anam n'émet aucune notification, **Et** tout autre motif est refusé comme défaut.
- **Étant donné** qu'un motif autorisé existe, **Quand** l'ordonnanceur évalue l'émission, **Alors** au plus une notification d'Anam est émise par fenêtre de 72 heures, **Et** aucune n'est émise le soir en v1.
- **Étant donné** une notification d'Anam, **Quand** son aperçu s'affiche sur l'écran verrouillé, **Alors** il porte « Anam » et un corps d'au plus six mots d'un ensemble fini relu, **Et** il ne porte jamais le contenu spécifique, un mot de l'utilisatrice ou un registre ésotérique — la spécificité (FR-034) vit dans l'app.
- **Étant donné** une échéance d'intention d'implémentation, **Quand** elle arrive, **Alors** le rappel porte sur l'objectif propre de l'utilisatrice, jamais sur un rappel de connexion.
- **Étant donné** une semaine calme sans aucune ouverture, **Quand** le temps passe, **Alors** aucun message ne constate l'absence, **Et** aucune relance de type « tu nous manques » ou « reviens vite » n'est jamais émise.
- **Étant donné** la carte « Anam » de l'accueil, **Quand** Anam n'a rien de spécifique, **Alors** la carte reste neutre, sans pastille ni compteur de messages ; **Quand** un motif existe, **Alors** elle porte une seule ligne secondaire spécifique.

---

### Story 6.4 : Le geste de pause

En tant qu'utilisatrice, je veux qu'Anam me propose de laisser respirer quand mon rythme s'intensifie, sans jamais m'imposer de pause, afin que la relation reste soutenable et que personne ne me punisse d'être calme ou active.

**Couvre :** FR-036, contre-métrique de dépendance (plus de 5 séances ou plus de 60 min par semaine), NFR-015 (pas de bandeau, pas de notification), NFR-002 (journalisation sans art. 9).

**Critères d'acceptation :**

- **Étant donné** qu'une utilisatrice dépasse le seuil de rythme (plus de 5 séances ou plus de 60 minutes sur 7 jours glissants), **Quand** elle est en conversation, **Alors** Anam propose une pause dans le fil, en son registre normal et en trois phrases maximum, **Et** aucune condition de retour ni aucun engagement n'est extorqué.
- **Étant donné** la proposition de pause, **Quand** elle est faite, **Alors** le produit n'impose jamais la pause : aucun verrouillage, aucune minuterie, aucun écran « tu as assez utilisé l'app », **Et** le composeur reste actif.
- **Étant donné** qu'Anam a déjà proposé une pause, **Quand** l'utilisatrice continue malgré tout, **Alors** la proposition n'est pas répétée en boucle, **Et** le seuil ne redéclenche pas une nouvelle proposition avant une fenêtre d'apaisement raisonnable.
- **Étant donné** une semaine calme, **Quand** l'utilisatrice ne vient pas, **Alors** l'inverse est également vrai : aucune absence n'est traitée comme un décrochage et aucun message ne la constate.
- **Étant donné** le franchissement du seuil, **Quand** il est enregistré, **Alors** le cas est journalisé pour revue produit (contre-métrique de dépendance) sans exposer de contenu art. 9, **Et** la proposition de pause n'est jamais portée par une notification : elle vit uniquement en conversation.

---

### Story 6.5 : Ce qu'Anam retient — consulter, corriger, supprimer un fait

En tant qu'utilisatrice, je veux consulter en langage clair ce qu'Anam retient de moi et corriger ou supprimer n'importe quel fait extrait, afin de garder la main sur mon profil vivant, une correction étant une donnée et non une erreur à masquer.

**Couvre :** FR-063, FR-064, AD-18 (provenance, idempotence, tombstones), AD-8 (couche des faits extraits), NFR-001 (isolation RLS par utilisatrice).

**Critères d'acceptation :**

- **Étant donné** l'écran « Ce qu'Anam retient », **Quand** l'utilisatrice l'ouvre depuis le menu de compte, **Alors** chaque fait extrait s'affiche en une phrase de langage clair, avec sa date et un lien vers l'extrait source, **Et** aucun score de confiance n'est affiché.
- **Étant donné** un fait extrait, **Quand** l'utilisatrice le corrige en place, **Alors** la correction est enregistrée avec l'origine « utilisatrice » et le statut « corrigé », **Et** elle prime sur toute ré-extraction future.
- **Étant donné** un fait extrait, **Quand** l'utilisatrice le supprime, **Alors** la suppression est immédiate avec une annulation possible pendant 10 secondes, **Et** un tombstone est posé.
- **Étant donné** un fait corrigé ou supprimé par l'utilisatrice, **Quand** l'extraction post-tour ou la synthèse s'exécute en upsert idempotent, **Alors** elle ne réécrit ni ne ressuscite jamais ce fait — le tombstone et la correction de l'utilisatrice l'emportent.
- **Étant donné** l'état vide, **Quand** aucun fait n'est encore retenu, **Alors** l'écran affiche « Anam ne retient encore rien de précis sur toi. »
- **Étant donné** les trois couches de mémoire (journal brut, faits extraits, branches), **Quand** l'utilisatrice supprime un fait extrait, **Alors** seule la couche des faits extraits est touchée : le journal brut (verbatim immuable) et les branches ne sont pas affectés, **Et** le lien d'une branche vers son extrait source reste intact.

---

### Story 6.6 : L'export complet

En tant qu'utilisatrice, je veux exporter l'intégralité de mes données sans friction dissuasive, afin d'emporter tout ce qu'Anam sait de moi quand je le décide.

**Couvre :** FR-067 (volet export complet), AD-4 (frontière art. 9), NFR-002 (l'export ne passe pas par un outil d'analyse), NFR-003 (les transcriptions conservées sont incluses), NFR-005 (traitement couvert par l'AIPD).

**Critères d'acceptation :**

- **Étant donné** l'écran « Mes données », **Quand** l'utilisatrice demande un export, **Alors** elle reçoit un export complet couvrant toutes ses couches (journal brut, lectures, faits extraits, branches, thème natal, consentement, résumé glissant, transcriptions conservées), dans un format lisible, sans friction dissuasive — aucun questionnaire, aucun délai artificiel.
- **Étant donné** un export demandé, **Quand** il est produit, **Alors** il est **autonome** : fourni sans questionnaire ni délai artificiel, jamais conditionné à une fermeture de compte ou à une suppression.
- **Étant donné** l'export, **Quand** il s'exécute, **Alors** aucune donnée art. 9 ne transite vers un outil d'analyse, de marketing ou de publicité (NFR-002), **Et** l'opération est journalisée sans art. 9 en clair, **Et** le traitement est couvert par l'AIPD réalisée avant mise en ligne (NFR-005).

---

### Story 6.7 : L'effacement total exhaustif — propagé aux sous-traitants et au PITR

En tant qu'utilisatrice, je veux tout effacer sans friction dissuasive, avec la certitude que l'effacement marche vraiment — jusqu'aux sous-traitants et aux sauvegardes —, afin de pouvoir partir complètement.

**Couvre :** FR-067 (suppression totale, prime sur FR-029), AD-14 (moteur unique d'effacement, exhaustif par utilisatrice, propagé aux caches, aux sous-traitants et aux sauvegardes/PITR dans une fenêtre bornée), AD-4 (frontière art. 9), NFR-002, NFR-003 (les transcriptions conservées sont effacées).

**Critères d'acceptation :**

- **Étant donné** l'écran « Mes données », **Quand** l'utilisatrice demande la suppression totale, **Alors** un **moteur unique** efface exhaustivement toute ligne art. 9 de l'utilisatrice — `entree_journal`, `lecture`, `fait_extrait`, `branche`, `theme_natal`, `usage_ia`, `consentement`, résumé glissant et épisodes de détresse — y compris les branches, la suppression **primant sur FR-029**.
- **[DUR]** **Étant donné** la suppression totale, **Quand** elle s'exécute, **Alors** elle purge les caches dérivés (interprétations, projection du tronc), **Et** se propage aux sous-traitants (fournisseur IA, transcription), **Et** se propage aux **sauvegardes et au PITR** dans une fenêtre bornée (fenêtre PITR courte ou crypto-shredding de la clé propre à l'utilisatrice), de sorte qu'aucune donnée effacée ne survive au-delà de la fenêtre ni ne ressuscite par restauration (AD-14).
- **Étant donné** une demande de suppression, **Quand** elle est confirmée par une **confirmation unique**, **Alors** aucun écran de rétention, aucune offre, aucun « es-tu sûre ? » à étages ne s'interpose, **Et** un export (Story 6.6) est proposé avant la suppression.
- **Étant donné** qu'une branche a un extrait source dans le journal, **Quand** une suppression granulaire est tentée, **Alors** l'extrait source d'une branche ne peut être supprimé isolément — seul l'effacement total le retire — afin de ne jamais casser le lien branche vers extrait.
- **Étant donné** l'effacement, **Quand** il s'exécute, **Alors** aucune donnée art. 9 ne transite vers un outil d'analyse, de marketing ou de publicité (NFR-002), **Et** l'opération est journalisée sans art. 9 en clair.

---

### Story 6.8 : Le moteur de rétention automatique

En tant qu'utilisatrice, je veux que mes données soient conservées le temps de la relation puis effacées automatiquement selon des durées claires, afin de ne jamais voir mes confidences traîner indéfiniment ni dépendre d'un geste manuel pour disparaître.

**Couvre :** NFR-021, AD-14 (le moteur d'effacement est le seul propriétaire des durées et de la propagation), section Opérations (ordonnanceur), FR-071 (durée de suppression appliquée en cas de minorité détectée).

**Critères d'acceptation :**

- **Étant donné** un compte actif, **Quand** la relation se poursuit, **Alors** les données sont conservées pour la durée de la relation — la finalité même du produit — sans suppression automatique.
- **Étant donné** une inactivité de 24 mois, **Quand** l'ordonnanceur l'évalue, **Alors** une notification est émise par le produit, jamais signée d'Anam, **Et** 3 mois plus tard sans reprise, la suppression totale s'exécute via le moteur d'effacement (AD-14), un export ayant été proposé avant.
- **Étant donné** une fermeture de compte, **Quand** elle est demandée, **Alors** la suppression s'exécute sous 30 jours, propagée aux sous-traitants, un export ayant été proposé avant.
- **Étant donné** une minorité détectée (FR-071) et le compte suspendu, **Quand** le délai court, **Alors** les données sont supprimées sous 30 jours, sans exploitation d'aucune sorte, un export ayant été proposé avant.
- **Étant donné** les échéances de rétention, **Quand** elles sont définies, **Alors** ce sont des paramètres lus à l'exécution et jamais codés en dur, **Et** chaque exécution est idempotente et journalisée sans art. 9 en clair.
- **Étant donné** que ce moteur est le seul propriétaire des durées, **Quand** une suppression périodique doit avoir lieu, **Alors** elle passe exclusivement par lui via l'ordonnanceur, jamais par un script manuel ni une tâche dispersée.

