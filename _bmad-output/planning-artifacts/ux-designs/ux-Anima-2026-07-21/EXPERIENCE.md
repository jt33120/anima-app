---
status: final
created: 2026-07-21
updated: 2026-07-22
design_spine: ./DESIGN.md
sources:
  - _bmad-output/planning-artifacts/prds/prd-Anima-2026-07-21/prd.md
  - _bmad-output/planning-artifacts/briefs/brief-Anima-2026-07-21/brief.md
  - _bmad-output/brainstorming/brainstorm-anima-app-2026-07-20/anam-voice.md
  - _bmad-output/brainstorming/brainstorm-anima-app-2026-07-20/claude-design-prompts.md
---

# EXPERIENCE.md — Anam

> Contrat d'expérience. Architecture, comportements, états, interactions, accessibilité, parcours.
> **`DESIGN.md` est propriétaire des couleurs, des typographies et des mesures.** Ce document ne redéfinit aucun token : il les appelle par leur nom, `{comme.ceci}`.
> **En cas de conflit avec un mockup ou une illustration, ce document gagne.**

> ✅ **Note sur les tokens.** `DESIGN.md` est complet : la palette est **« Nuit d'argile »** (variation 2 de `.working/color-themes-1.html`, conforme WCAG AA dans les deux modes) et l'ensemble des tokens — couleurs, typographies, espacements, composants — y est défini. Tous les noms `{comme.ceci}` employés ici sont ceux de `DESIGN.md`, et réconciliés avec lui. Aucun token n'est inventé dans ce document.

---

## Foundation

**Web d'abord, responsive, une seule surface** (NFR-018). Pas d'application native en v1, pas d'achat intégré : **paiement par Stripe Checkout hébergé**.

L'usage réel visé : **une femme, seule, sur le navigateur de son téléphone, le soir**. Toutes les décisions de mise en page partent du `sm` en portrait ; le bureau est une déclinaison, pas la cible.

**Le modèle n'est pas une pile d'écrans : c'est une scène unique.** L'utilisatrice ne passe pas d'une page à l'autre — elle **se déplace entre des régions d'un même monde**, continu, fluide et **sans bord ni cadre**, en 2D (pas de WebGL), dans un univers pastel de nuit galactique. L'ancrage est spatial et stable : **l'arbre au centre, Anam à gauche**. Les changements de région se font **en fondu** (`{components.fondu.region}`), jamais par un basculement d'écran sec. Le mobile et le bureau sont **deux fenêtres sur la même scène continue**, pas deux mises en page rivales. Sous le capot, des routes peuvent exister — l'URL, le bouton retour et `/aide` restent adressables — mais le modèle **ressenti** est **un seul monde**, pas une arborescence de pages. Le vrai 3D — l'étoile du nord (v2) — n'est pas la v1 : celle-ci est **strictement 2D**, mais architecturée pour l'accueillir plus tard **sans réécriture**.

- **Le mode sombre est le mode principal.** Le mode clair existe et respecte `prefers-color-scheme`, avec bascule manuelle persistée. Justification héritée de `.memlog.md` : la direction terreuse atteint naturellement 6–10:1 en sombre et se casse en clair (NFR-016).
- **Aucune bibliothèque de composants imposée.** Le vocabulaire visuel est propriétaire (`DESIGN.md`). Ce document ne suppose ni shadcn, ni Material, ni conventions de plateforme.
- **Zéro traceur tiers sur les régions de conversation, de lecture, d'arbre, de mémoire et d'aide** (NFR-002). La mesure produit ne touche jamais ces régions.
- **Trois destinations maximum.** Le produit n'a pas de tableau de bord, pas de fil d'actualité, pas de barre de recherche globale.
- **Aucun état de session expiré ne peut interrompre une conversation** (WCAG 2.2.1 + NFR-017). L'authentification est sans mot de passe (FR-073), longue durée, et la ré-authentification n'intervient jamais en cours d'échange.

---

## Le monde et ses haltes

> **Principe directeur.** *Le monde est fluide et sans bord, mais certains moments s'arrêtent et deviennent nets — par la loi et par le soin.*

La scène est continue : on s'y déplace en fondu, sans cadre ni bordure, d'une région à l'autre. Mais **le sans-bord n'est jamais un dissolvant.** Certaines zones de clarté absolue doivent **s'arrêter, se poser et rester parfaitement lisibles**, non dissoutes dans le flux. Deux forces les figent : **la loi** (transparence et consentement) et **le soin** (la sécurité et la dignité de l'utilisatrice).

**Les haltes — les moments qui s'arrêtent :**

| Halte | Pourquoi elle s'arrête | Référence |
|---|---|---|
| **Le consentement art. 9 + déclaration IA** | La loi. Consentement sensible explicite, avant toute écriture de donnée. | FR-012, FR-072 |
| **Les ressources de détresse** | Le soin. Le bloc ressources et la porte de secours restent nets, indépendants de toute détection. | FR-077, §5 |
| **Le paywall** | La dignité. Un seul moment assumé, jamais un piège permanent dans le flux. | FR-014, FR-057 |
| **La clôture de séance** | Le soin. Le bilan se pose et devient un objet lisible ; l'utilisatrice n'a pas à s'extraire. | FR-008 |

La **mention IA persistante** (FR-013) n'est pas une halte mais une **clarté permanente** : elle ne s'arrête pas parce qu'elle ne part jamais — toujours nette, jamais repliée, jamais dissoute dans le flux (voir *surimpression persistante*, plus bas).

Ces haltes **interrompent** le flux et **l'assument comme telles**. Le fondu qui relie les régions ne les efface pas, ne les replie pas, ne les rend jamais optionnelles. **Le sans-bord n'efface jamais ces moments.**

---

## Information Architecture

La scène est **une**. On n'y navigue pas entre des pages : on s'y **déplace entre des régions**, reliées par un déplacement fluide en fondu (`{components.fondu.region}`), jamais par un basculement d'écran. **Cinq régions** composent le monde — **l'accueil / la bibliothèque**, **la conversation avec Anam**, **l'arbre**, **la lecture**, **la transparence / l'aide** — et **chaque besoin a sa région**. Trois d'entre elles sont des **destinations directes** (barre basse ou rail : accueil, conversation, arbre) ; la **lecture** se rejoint en conversation et la **transparence / aide** par la porte de secours ou le menu. Les entrées de compte (mémoire, synthèse, abonnement, données, réglages) sont des **haltes** qui se posent par-dessus la scène, pas des lieux du monde. **Le consentement et le paywall restent des _moments_** qui interrompent le flux, assumés comme tels (voir *Le monde et ses haltes*).

| Région / halte | Atteinte depuis | Rôle |
|---|---|---|
| **Accueil — la bibliothèque** | Ouverture, barre basse | Les cartes du socle : mantra du jour, horoscope, thème, nombres, ennéagramme |
| **Anam — la conversation** | Barre basse, carte « Anam » | Le cœur. Séance, échange courant, lecture, protocole de détresse |
| **L'arbre** | Barre basse, **sur tous les comptes** | Tronc (gratuit), branches (premium), racines. Preuve du chemin (FR-088) |
| **Fiche de branche** | Point d'accroche sur l'arbre, ou vue liste | Nom, date, extrait source, accès à la conversation d'origine |
| **Une lecture** | Demandée en conversation, ou depuis « Mes lectures » | Le rituel de tirage, puis la restitution écrite |
| **Ce qu'Anam retient** | Menu de compte | Faits extraits, correction, suppression (FR-063, FR-064) |
| **La synthèse** | Menu de compte, ou notification quand elle est prête | Récapitulatif périodique (FR-066) |
| **Aide et ressources** | Menu de compte, **première entrée, toujours** · URL directe `/aide` | Ressources vérifiées (FR-044, FR-077) |
| **Ce que j'ai accepté** | Menu de compte | Consentement art. 9 + déclaration IA, révocables (FR-012) |
| **L'abonnement** | Menu de compte | Prix, souscription, **résiliation** (FR-060, FR-061) |
| **Mes données** | Menu de compte | Export complet, suppression totale (FR-067) |
| **Réglages** | Menu de compte | Prénom, heure de naissance, thème clair/sombre, notifications |

**Parcours d'entrée** (séquence figée, FR-072) : création de compte → déclaration d'âge (FR-069, FR-070) → **écran de consentement art. 9 + déclaration IA** → première séance. Aucune donnée sensible n'est écrite avant l'étape 3.

**Navigation.**
- `sm` / `md` : **barre basse fixe**, 3 entrées (Accueil · Anam · L'arbre). **Les trois entrées sont présentes sur un compte gratuit comme sur un compte premium** : le tronc est gratuit (FR-088), la destination Arbre existe donc toujours. Aucun cadenas, aucun grisé, aucune pastille « premium ».
- `≥ lg` : rail latéral gauche, mêmes entrées.
- **La marque « Anam », en surimpression légère, sur toutes les régions** : « Anam » en {typography.surtitre} à gauche, un unique glyphe de menu à droite. Ce n'est **pas une barre bordée** posée en haut d'une page, mais une **surimpression discrète** sur la scène continue. **Rien d'autre**, littéralement : aucun titre bavard, aucune barre de statistiques, aucun compteur, **et aucun élément de séance** — ceux-ci vivent dans la **surimpression persistante** (ci-dessous).
- **La surimpression persistante**, sur toutes les régions, remplace l'ancienne « bande de contexte » bordée. Ce n'est **plus une bande** posée entre deux filets : c'est une **présence flottante, sans bord, sans fond barré, sans filet**, en surimpression constante sur la scène. Sa lisibilité sur l'imagerie est tenue par le **voile** ({components.voile}), jamais par une barre. Elle porte — et elle **seule** — le **signe d'Anam**, la **mention IA persistante** et la **porte de secours** vers les ressources. Elle est **toujours présente et lisible**, jamais masquée, jamais repliée. Voir *Component Patterns*.
- Le **menu de compte** est une feuille (sheet) qui s'ouvre par-dessus. Elle liste, dans cet ordre invariable : **Aide et ressources**, Ce qu'Anam retient, La synthèse, Mes lectures, L'abonnement, Mes données, Ce que j'ai accepté, Réglages.
- **Profondeur modale : un niveau, jamais deux.** Aucune feuille ne s'ouvre depuis une feuille.
- **Aucun badge, aucune pastille de non-lu, aucun compteur** sur aucune entrée de navigation (FR-031).

→ Références de composition : `.working/color-themes-1.html` (palettes) et **`.working/key-screens-1.html`**, qui rend six **cadrages de la scène** — la conversation, la clôture de séance, l'arbre, l'accueil, le consentement, le rituel de lecture. Ce sont des **vues d'un même monde continu**, pas six écrans séparés. **En cas d'écart entre ce document et un mockup, ce document gagne** (voir l'en-tête).

---

## Voice and Tone

Microcopie. La voix de marque et la posture esthétique vivent dans `DESIGN.md` ; les règles complètes de la voix d'Anam vivent dans `anam-voice.md`. Cette section est leur **application à l'interface**.

### Deux registres, jamais mélangés

| Registre | Qui parle | Où | Règles |
|---|---|---|---|
| **Anam** | l'agent | le fil de conversation, et rien d'autre | FR-082 à FR-087 · débit §3 · aucune liste, aucun titre, aucun tableau |
| **Le produit** | le système | boutons, libellés, états vides, erreurs, consentement, paywall, réglages | sobre, tutoiement, factuel, sans personnalité |

> **Règle dure : Anam ne vend jamais, ne s'excuse jamais d'un bug, ne parle jamais des quotas.** Tout ce qui relève du commerce, de la technique ou du droit est dit par le produit, en registre système. Une phrase de paywall signée Anam est un défaut.

### Anam — contrôles vérifiables en conversation

| Contrôle | Règle applicable côté client |
|---|---|
| **Trois phrases maximum** (FR-084) | Le tour est tronqué à la troisième ponctuation finale et un manquement de voix est journalisé. La colonne est plafonnée à ~60 caractères par ligne : un pavé devient visuellement impossible. |
| **Aucune liste à puces** | Tout `-`, `*`, `1.` ou saut de ligne double en début de ligne dans un tour d'Anam est un défaut : rendu en texte brut + journalisation. |
| **Aucun emoji, aucune exclamation, aucune majuscule d'emphase** (FR-083) | Filtre de sortie. Le point d'exclamation est interdit dans **toute** l'interface, y compris les messages système. |
| **Aucun récapitulatif empathique, aucune conclusion enveloppante** | Liste de préfixes bannis appliquée en sortie (« il semble que tu ressentes », « si je comprends bien », « n'oublie pas que », « prends soin de toi »). |
| **Aucune revendication d'affect** (FR-087) | « je ressens », « ça me touche », « je m'inquiète » : bannis. « je lis », « je suis là » : autorisés. |
| **Formatage riche hors conversation** | Titres, listes et tableaux sont **autorisés** dans les documents : bilan de séance, restitution de lecture, fiche de thème, synthèse, plan d'étapes. Interdits dès qu'Anam *parle*. |

### Le produit — spécimens normatifs

| Contexte | ✅ | ❌ |
|---|---|---|
| Bouton primaire consentement | « Je commence » | « Accepter et continuer 🎉 » |
| Envoi impossible, réseau coupé | « Ton message est gardé sur cet appareil. Il partira dès que la connexion revient. » | « Erreur réseau » · « Oups, quelque chose s'est mal passé ! » |
| Aucune branche encore | « Rien n'a encore été nommé. C'est normal, ça vient en parlant. » | « Commence ton parcours dès maintenant ! » |
| Quota d'échange épuisé | « L'échange avec Anam s'arrête ici pour ce mois-ci. Le reste de l'app reste ouvert. » | « Passe au premium pour continuer à discuter avec Anam ! » |
| Fait extrait supprimé | « Supprimé. » (+ « Annuler », 10 s) | « Votre donnée a bien été supprimée avec succès ✓ » |
| Heure de naissance manquante | « Il me manque ton heure de naissance. Sans elle, je préfère ne pas inventer l'ascendant. » | « Profil incomplet — 60 % » |
| Entrée d'aide | « Aide et ressources » | « Urgence · Tu vas mal ? » · « SOS » |

### Lexique — contrôle automatisé sur toute l'interface

- **Interdits partout** (NFR-008, FR-085) : guérir, soigner, soin et dérivés (FR-023), traiter, thérapie, thérapeutique, dépression, anxiété, trouble, diagnostic, symptôme, santé mentale, burn-out, traumatisme, rechute — plus toute quantification de santé et toute promesse d'état.
- **Trois mots à ne jamais confondre** (FR-023, FR-080) : **mantra du jour** = texte court, gratuit, non interactif · **ancrage** = exercice guidé interactif de 2 à 5 min, premium · **lecture** = le rituel long avec tirage, premium. Un libellé d'interface qui en emploie un pour un autre est un défaut.
- **Anima ≠ Anam** (FR-086). L'interface écrit « créé par Anima » en mention produit persistante. Anam ne cite Anima qu'à la troisième personne et uniquement depuis le corpus. Si l'utilisatrice demande « c'est Anima qui me répond ? », la réponse est non, immédiatement.

---

## Component Patterns

Comportemental. Les spécifications visuelles vivent dans `DESIGN.md.Components`.

| Composant | Où | Règles de comportement |
|---|---|---|
| **Carte de bibliothèque** | Accueil | Objet, pas ligne de menu. 4 à 6 maximum. Ordre **fixe, jamais algorithmique**. Une seule carte est mise en avant par jour, en tête. Aucun badge, aucun compteur, aucun cadenas. |
| **Carte « Anam »** | Accueil | Si Anam a un motif spécifique en attente (FR-034), la carte porte **une** ligne secondaire spécifique. Sinon : libellé neutre, rien d'autre. Jamais de nombre de messages. |
| **Fil de conversation** | Anam | Flux vertical, pas de bulles opposées. Anam en {typography.anam} sur {colors.texte} ; l'utilisatrice en {typography.corps} sur {colors.texte} **à pleine valeur**, filet vertical à gauche en {colors.bordure-forte}. **Jamais {colors.texte-doux} pour ses mots à elle** : on ne met jamais ses mots en sourdine (`DESIGN.md`, `tour-utilisatrice`). La distinction des deux voix se fait par la famille typographique et par le filet, pas par l'extinction. Aucun horodatage permanent, aucune coche de lecture, aucun indicateur « en ligne ». Maximum 3 à 4 échanges lisibles à l'écran. Aux moments-clés, le personnage paraît — voir *Apparition d'Anam*. |
| **Apparition d'Anam** | Conversation, aux moments-clés | Le personnage en format **Présence** (`DESIGN.md.personnage.presence`) paraît à **trois beats seulement** : à l'**ouverture** d'une séance, à l'instant où Anam **nomme** l'observation (FR-005), et à la **clôture** (FR-008), où elle passe en format **Veille**. **Jamais à côté d'un tour ordinaire.** Elle émerge du {colors.fond} sans cadre ni cercle, en {components.fondu}. Entre ces beats, seul le **signe** porte sa présence — *présence n'est pas répétition*. `prefers-reduced-motion` : elle paraît sans fondu, jamais supprimée. |
| **Surimpression persistante** *(ex-« bande de contexte »)* | En surimpression, **sur toutes les régions** | **Présence flottante sans bord** : ni fond {colors.surface} barré, ni filet {colors.bordure}, ni bande — elle ne *ferme* rien. Elle flotte sur la scène et sa lisibilité tient au **voile** ({components.voile}), pas à une barre. Elle porte au plus trois choses, dans cet ordre : le **signe d'Anam**, la **mention IA persistante**, la **porte de secours**. Dans la région de conversation, les trois sont présentes ; ailleurs, **seule la porte de secours** demeure, au même endroit. **Rien d'autre n'a le droit d'y entrer** — ni titre, ni compteur, ni bouton d'action. Elle est **constante**, suit le défilement et n'est **jamais** masquée, repliée ni remplacée. |
| **Signe d'Anam** | Surimpression persistante, région de conversation | Marque abstraite en {colors.texte} (argent lunaire), point de vigil en {colors.lueur} — **pas {colors.accent}** : l'accent reste la couleur de l'action. Le signe **reste sans visage** : il porte la présence *constante* d'Anam dans le fil et sert d'indicateur d'activité (État *Anam prépare*). Le **personnage**, lui, paraît séparément aux moments-clés (voir *Apparition d'Anam*). Jamais une onde sonore, jamais des points qui rebondissent. |
| **Mention IA persistante** | Surimpression persistante, région de conversation | Ligne courte et lisible « Anam est une IA », lien vers la page de transparence. Présente sur **toute** la région de conversation (FR-013, AI Act art. 50), **sans bande ni filet** ; sa lisibilité tient au voile. Jamais masquée au défilement, jamais repliée derrière un accordéon, jamais dissoute dans le flux. |
| **Porte de secours** | Surimpression persistante, alignée à droite | Un mot simple — « Aide » — en {typography.meta} sur {colors.texte-doux}, fond transparent, menant à `/aide`. **Jamais {colors.alerte}, jamais de rouge, jamais de pastille, jamais d'icône d'alerte, jamais de majuscule** (FR-077). Toujours au même endroit, ne dépend d'aucune détection, n'est jamais masquée. C'est la deuxième voie d'accès aux ressources, indépendante du menu de compte. |
| **Composeur** | Anam | Bande basse : champ multiligne auto-extensible (max 6 lignes puis défilement interne), bouton d'envoi, icône micro. **Rien d'autre** — pas de barre d'outils, pas d'emoji, pas de pièce jointe. Ne disparaît **jamais**, y compris après la clôture (FR-008) et pendant un épisode de détresse. |
| **Bloc document** | Bilan, restitution, synthèse, fiche de thème, plan d'étapes | Registre document : titres, listes et tableaux autorisés. Fond {colors.surface}, séparé du fil par une respiration double. Non éditable, copiable, exportable. |
| **Carte tirée** | Lecture | Un seul visuel, occupant la largeur de colonne. Apparition par simple dépôt, sans retournement ni scintillement. Aucune signification cataloguée n'est affichée, nulle part (FR-018). |
| **Arbre** | L'arbre | Canevas déplaçable et zoomable. Doublé d'une **vue liste** de rang égal (voir Accessibility Floor). Aucun compteur, aucun pourcentage, aucune légende permanente. |
| **Point d'accroche de branche** | Arbre | Nœud discret dans le bois. Zone tactile ≥ 44 px quel que soit le dessin. Ouvre la fiche. |
| **Fiche de branche** | Arbre, vue liste | Étiquette posée sur l'illustration, pas modale. Nom donné par l'utilisatrice, date, extrait exact (FR-027). Le reste de l'arbre s'estompe légèrement, sans flou. Actions : « Voir dans la conversation », « Renommer ». |
| **Proposition de branche** | Conversation, **le lendemain** | Un tour d'Anam, suivi de deux réponses possibles en ligne : « Oui » / « Non ». Un refus renvoie « Ok. » et rien d'autre ; la proposition n'est **jamais** rejouée pour le même moment (FR-025, §6.3). |
| **Fiche de fait extrait** | Ce qu'Anam retient | Une phrase en langage clair, sa date, un lien vers l'extrait source. Deux actions : « Corriger » (édition en place) · « Supprimer » (immédiat + annulation 10 s). Aucun score de confiance affiché. |
| **Bloc ressources** | Conversation (niveaux 2-3), page `/aide` | Fiche document en {colors.surface-elevee} + {colors.bordure-forte}. **Jamais {colors.alerte}, jamais modale, jamais bloquante.** Numéros en lien `tel:`. Porte une date « vérifié le … » visible. |
| **Carte d'abonnement** | Sous le bilan de première séance, page L'abonnement | Prix unique 69 €/an, sans prix barré, sans compte à rebours, sans mention de rareté (FR-061). Une action primaire, une action secondaire de refus **de lisibilité égale**. **La garantie de remboursement (FR-089) est écrite sur la carte elle-même**, en {typography.meta}, à côté du prix : si aucune branche n'a été posée au bout de trois mois, remboursement sur simple demande. Elle n'est jamais reléguée aux conditions générales ni derrière un lien. |
| **Feuille (sheet)** | Menu de compte, actions secondaires | Un niveau. `Esc` et le geste de fermeture la ferment toujours. Le focus est piégé dedans et rendu à l'élément déclencheur. |

---

## State Patterns

| État | Surface | Traitement |
|---|---|---|
| **Ouverture à froid** | Accueil | Le socle est calculé et servi depuis le cache (FR-047, NFR-011) : il s'affiche sans attente. Aucun écran de démarrage animé. |
| **Anam prépare** | Conversation | Entre l'envoi et le premier caractère : le signe d'Anam s'épaissit, sans animation cyclique. **Pas de trois points qui rebondissent.** Latence tenue de 400 à 900 ms avant le flux, même si la réponse est prête plus tôt. |
| **Anam répond (streaming)** | Conversation | Rendu par groupes de mots, pas caractère par caractère (NFR-014). `aria-busy="true"` pendant, `false` à la fin. Aucun curseur clignotant. Le défilement suit le bas **tant que l'utilisatrice n'a pas remonté** ; dès qu'elle remonte, le suivi s'arrête et ne reprend pas seul. |
| **Anam a fini** | Conversation | Rien ne se passe. Aucun son, aucune vibration, aucun accusé. |
| **Message en cours d'envoi** | Conversation | Le tour de l'utilisatrice s'affiche immédiatement en {colors.texte-doux} atténué, puis se stabilise. Jamais retiré du fil en cas d'échec. |
| **Hors ligne** | Conversation | Le message est conservé localement et réémis au retour du réseau (NFR-017). Une ligne système sous le composeur, pas de bandeau plein écran. **Aucune entrée n'est perdue.** |
| **Échec du modèle** | Conversation | Ligne système : « Je n'ai pas pu répondre. Ton message est gardé. » + « Réessayer ». Jamais de message d'erreur signé Anam. |
| **Séance close** | Conversation | Le bilan s'insère dans le fil, la carte d'abonnement dessous. **Le composeur reste actif.** Aucun bouton « terminer », aucun « reprendre la séance ». |
| **Quota résiduel épuisé** | Conversation | Une ligne système, une seule fois, en registre produit. Le socle reste entièrement accessible (FR-058). Le composeur reste visible mais désactivé, avec le motif en texte à côté. |
| **Détresse niveau 0-1** | Conversation | **Rien ne change dans l'interface.** Zéro élément ajouté au DOM du fait du protocole. Seul le registre d'Anam évolue (FR-038). |
| **Détresse niveau 2-3** | Conversation | Le bloc ressources s'insère dans le fil. Toute mécanique commerciale est démontée (FR-043). Le composeur reste actif et gardé au focus. |
| **Tronc incomplet** | Arbre | Matière du tronc en réserve, contour entier (FR-051). Aucune sémantique d'erreur : pas de rouge, pas de cadenas, pas de pointillé, pas de pourcentage. Fiche explicative au tap. |
| **Arbre sans branche** | Arbre | Le tronc seul, beaucoup de vide. « Rien n'a encore été nommé. C'est normal, ça vient en parlant. » Aucun bouton « créer une branche » — une branche ne se crée pas depuis l'arbre. |
| **Branche qui change d'état** | Arbre | Le changement est **déjà là** à l'ouverture. Jamais d'animation de croissance en direct, jamais de particule, de confetti ou de son. Une phrase sur la fiche dit ce qui a changé et quand. |
| **Aucune lecture** | Mes lectures | « Aucune lecture pour l'instant. Tu peux en demander une à Anam. » Lien vers la conversation. |
| **Mémoire vide** | Ce qu'Anam retient | « Anam ne retient encore rien de précis sur toi. » |
| **Consentement révoqué** | Global | Bascule immédiate vers le parcours d'export puis de suppression (NFR-021). Aucun écran de rétention, aucune tentative de reconquête. |
| **Minorité détectée** | Conversation, puis global (FR-071) | Le parcours est **interrompu**, en registre produit, jamais signé d'Anam. Un message **clair et non culpabilisant** : l'app est réservée aux majeures, ce n'est pas une sanction. Il **oriente vers des ressources adaptées à son âge**, le **3018** en tête, rendues dans le **bloc ressources** habituel — jamais une modale, jamais de rouge, jamais de pictogramme de danger. Le compte est **suspendu immédiatement** : plus aucune écriture, plus aucun échange. L'écran dit sans détour ce qui arrive aux données : **suppression sous 30 jours**, sans exploitation d'aucune sorte, et **un export lui est proposé avant suppression**, en une action. Si un paiement a été encaissé, il est **remboursé intégralement** et la carte le dit sur le même écran. Aucun paywall, aucune relance, aucune offre, aucun « es-tu sûre ? ». |
| **Focus clavier** | Partout | Anneau visible en {colors.bordure-forte}. Jamais supprimé, jamais remplacé par un simple changement de fond. |

---

## Interaction Primitives

- **Tap / clic pour agir.** L'appui long est réservé à la sélection de texte du système.
- **Composeur :** sur `≥ md`, `Entrée` envoie et `Maj+Entrée` insère une ligne. Sur `sm`, `Entrée` insère une ligne et l'envoi passe par le bouton — on n'envoie jamais par accident une confidence.
- **Saisie vocale :** tap pour démarrer, tap pour arrêter. La transcription apparaît dans le champ et reste **modifiable avant envoi**. La capture est indépendante du traitement (NFR-017) ; l'audio est supprimé après transcription (NFR-003). **Aucune inférence d'émotion à partir de la voix** (NFR-004) — et rien dans l'interface ne le suggère.
- **Arbre :** déplacement au doigt / glisser ; zoom au pincement, à la molette, et par deux boutons `+` / `−` atteignables au clavier. Double-tap = cadrer la branche. Tap sur un point d'accroche = fiche.
- **`Esc`** ferme toujours la feuille la plus haute, et seulement elle.
- **Historique de conversation :** pagination explicite (« Charger la suite »). Pas de chargement infini automatique.
- **Bannis partout :** carrousels · défilement infini · tirer-pour-rafraîchir (rien n'est un fil d'actualité) · glisser-pour-supprimer sur du contenu personnel · affordances au survol seul sur tactile · glisser-déposer · menus contextuels sur appui long · modale sur modale · lecture audio automatique · vibration ou son de récompense · pastilles de non-lu · séries · animation de célébration · notification de réengagement (« tu nous manques », « reviens vite »).

---

## Accessibility Floor

Comportemental. Les ratios de contraste sont propriété de `DESIGN.md` (NFR-016 — la direction terreuse casse en mode clair, cf. `.memlog.md`).

- **WCAG 2.2 AA** sur toute la surface. `lang="fr"` sur le document.
- **La scène fluide a un doublage non-spatial de rang égal.** Un monde continu où l'on *se déplace* est un **risque d'accessibilité** — désorientation, piège au lecteur d'écran, dépendance à la position spatiale. Chaque région est donc **atteignable directement au clavier et au lecteur d'écran** par un **lien nommé** — barre basse ou rail pour les trois destinations, menu de compte et porte de secours pour la lecture et l'aide — **sans traverser la scène**. L'ordre de lecture reste **linéaire et garanti**, indépendant de la disposition spatiale ; la position dans le monde n'est **jamais** la seule façon d'atteindre un lieu. La **vue liste** de l'arbre (ci-dessous) en est l'application déjà actée.
- **Streaming :** le conteneur du tour d'Anam porte `aria-live="polite"` et `aria-busy` ; le lecteur d'écran annonce **une fois, à la fin**, jamais mot à mot.
- **L'arbre a un équivalent textuel de rang égal.** Une bascule « Vue liste » persistée par utilisatrice, listant chaque branche : nom, date, **état écrit en toutes lettres** (naissance / feuillaison / fruit), extrait. Le canevas porte `role="img"` et un `aria-label` court. **L'état d'une branche n'est jamais porté par la couleur seule.**
- **Cibles ≥ 44 × 44 px CSS**, y compris les points d'accroche de branche, dont la zone tactile est indépendante du dessin.
- **Réduction de mouvement** (`prefers-reduced-motion`) : aucune croissance animée, aucun dépôt de carte, aucun fondu du fil, aucun épaississement du signe d'Anam, **aucun fondu de transition de région, aucune parallaxe**. Le passage d'une région à l'autre devient **instantané**. Les textes apparaissent complets.
- **Zoom 200 % sans perte, redistribution à 400 %.** La colonne de conversation se redistribue ; l'arbre conserve son zoom propre.
- **Ordre de tabulation = ordre de lecture** sur chaque région. Le focus entre et sort proprement de chaque feuille et revient au déclencheur.
- **`/aide` est atteignable au clavier en deux arrêts de tabulation depuis la marque « Anam »**, sur toutes les régions, connectée ou non (FR-077) : la porte de secours de la **surimpression persistante** est dans l'ordre de tabulation juste après le glyphe de menu.
- **Les numéros d'urgence sont lus chiffre par chiffre** : `<span aria-label="3 1 1 4">3114</span>`. Idem 3919, 119, 15, 112. Un lecteur d'écran qui annonce « trois mille cent quatorze » est un défaut.
- **Aucune limite de temps** : pas d'expiration de session en cours de conversation, pas de fermeture automatique de feuille, pas de message qui disparaît avant lecture (les annulations durent 10 s et sont doublées d'une action permanente).
- **Formulaires :** étiquettes visibles, jamais de placeholder en guise d'étiquette. Les erreurs sont décrites en texte, à côté du champ, et référencées par `aria-describedby`.
- **Le mode sombre par défaut n'exclut pas le mode clair** : les deux sont vérifiés au même niveau.

---

## Dossier — L'arbre

### Modèle d'objet

| Élément | Sens | Source de vérité |
|---|---|---|
| **Tronc** | ce avec quoi elle arrive : thème natal, chemin de vie | socle calculé (FR-047). État : `incomplet` \| `complet` |
| **Racines** | la régularité, le fait de revenir | dérivé de l'assiduité. **Rendu purement visuel, jamais chiffré, sans infobulle** |
| **Branche** | une prise de conscience nommée par elle | `{id, nom, date_naissance, extrait_source_id, etat, date_feuillaison?, date_fruit?}` |
| **Feuillage** | la richesse du vocabulaire émotionnel | dérivé, décoratif, jamais quantifié |
| **Nœuds et cicatrices** | les tempêtes traversées | marques d'honneur. Jamais un état négatif |

### Les trois états, et le sens de la marche

`naissance` → `feuillaison` → `fruit`. **La transition est strictement monotone.**

> **Règle défensive, vérifiable :** le client ne rend jamais un état inférieur à l'état maximal persisté pour une branche. Si le serveur renvoie un état inférieur, le client conserve l'état supérieur et journalise un incident. **L'arbre ne régresse jamais du fait du produit** (FR-029).

**Exception unique : le droit à l'effacement** (FR-067). L'effacement total supprime l'arbre entier. Il n'est jamais proposé par le produit ; il est demandé par l'utilisatrice, depuis « Mes données ».

**Retirer une branche isolée** : possible depuis le menu secondaire de sa fiche, avec une confirmation unique. Le produit ne le suggère jamais et ne l'utilise jamais comme sanction. — *Comportement non couvert par le PRD ; décision à valider (voir Lacunes).*

**Déclencheurs de transition** (FR-028) :
- `naissance` : au moment de la validation et du nommage par l'utilisatrice (FR-026). **Elle seule nomme.** Une branche non nommée par elle n'existe pas — l'interface n'a aucun champ pré-rempli, aucune suggestion de nom.
- `feuillaison` : **s'amorce lorsque l'utilisatrice revient spontanément sur le thème de la branche au fil des semaines.** C'est le fait de revenir d'elle-même qui compte, pas une relance d'Anam. La transition est **progressive, jamais binaire** : la matière s'installe par degrés — le trait s'épaissit, les feuilles se déplient au fil des retours. Il n'y a donc **aucun seuil affiché, aucune étape numérotée, aucun « 2 retours sur 3 »**, et l'utilisatrice n'a rien à confirmer.
- `fruit` : **jamais inféré** (FR-028, FR-026). Le fruit n'est acquis **que lorsque l'utilisatrice confirme elle-même être passée à l'acte** — depuis sa fiche, ou en réponse à une question d'Anam. Le produit ne déduit jamais un passage à l'acte du contenu de la conversation, et ne décide pas qu'une vie a changé. Une confirmation implicite n'existe pas : il faut un geste explicite d'elle.

> Conséquence d'interface : `feuillaison` est un **continuum rendu dans la matière**, `fruit` est un **événement déclaré**. Les deux se lisent sur le dessin, aucun des deux ne se lit dans un chiffre.

### Le tronc incomplet

Sans heure de naissance (FR-011, FR-049, FR-051) :
- Le contour est entier, la matière s'arrête en cours de route. **Aucun code d'erreur, aucun cadenas, aucun grisé, aucun pourcentage, le mot « incomplet » n'est pas écrit sur le dessin.**
- Au tap : fiche honnête — ce qui est disponible (numérologie complète, soleil, quasi-totalité des planètes, horoscope), ce qui manque (ascendant, maisons, et la lune si elle change de signe ce jour-là), et **où trouver l'heure** : copie intégrale de l'acte de naissance, mairie du lieu de naissance (FR-050).
- Deux actions : « Ajouter mon heure » · « Où la trouver ».
- Une fois l'heure ajoutée, **le tronc se complète au chargement suivant, sans animation.** Anam le mentionne **une fois, en une phrase**, et plus jamais. Ce n'est pas une carotte : rien n'est « débloqué », rien ne clignote.

### L'interaction centrale : branche → extrait source

C'est la preuve du produit. Elle doit être instantanée et exacte.

1. Tap sur le point d'accroche → la fiche s'ouvre (nom, date, extrait).
2. « Voir dans la conversation » → ouverture du fil, **positionné sur le message exact** (FR-027), pas sur la journée, pas sur la séance.
3. Le message source est marqué par un filet permanent en {colors.accent} et un fond {colors.accent-doux} qui s'estompe en 2 s (immédiat si réduction de mouvement).
4. Retour arrière → retour à l'arbre, **au même cadrage et au même zoom**.
5. Le lien est stable dans le temps : un extrait supprimé casserait la promesse — l'extrait source d'une branche est protégé et ne peut pas être supprimé isolément depuis « Ce qu'Anam retient ».

### Ce que l'arbre ne fait jamais

Aucun compteur de branches · aucun pourcentage de croissance · aucun niveau · aucun badge accroché à une branche · aucune étincelle sur une branche neuve · aucune saison, aucune feuille qui tombe, aucune branche morte, aucun flétrissement · aucune comparaison avec d'autres utilisatrices · aucun partage.

**Accès — le tronc est gratuit, les branches sont premium** (FR-088, FR-055, FR-056).

La destination **L'arbre existe dans la barre basse sur un compte gratuit**, exactement comme sur un compte premium : ni grisée, ni cadenassée, ni marquée d'une pastille « premium ». Le tronc est bâti sur le socle calculé, lui-même gratuit ; une utilisatrice gratuite **voit son tronc**, y compris incomplet — ce qui rend FR-051 opérant pour elle, et le motif de retour honnête.

Ce qu'elle voit au-dessus du tronc, c'est **l'espace vide où les branches pousseraient**. C'est le même vide généreux que sur un compte premium sans branche : l'arbre est ancré en bas et le vide est la place de ce qui va pousser. C'est la représentation honnête de ce qu'elle n'a pas encore.

**Jamais** : un verrou ostentatoire, un cadenas posé sur le dessin, un aperçu flouté de branches qu'elle n'a pas, des branches fantômes en pointillé, un bandeau « passez au premium », un compteur de branches manquantes. Teaser ce qu'on ne peut pas avoir contredit FR-057 (une seule sollicitation) autant que la dignité du dessin.

Une phrase sobre en registre produit, une seule fois et sans bouton d'achat, peut dire que les branches se posent en conversation. Elle ne clignote pas et ne réapparaît pas.

---

## Dossier — La conversation avec Anam

### La colonne vertébrale invisible

La séance suit l'arc `construire → observer → nommer → clore` (FR-004). **L'interface n'en montre rien** : pas d'indicateur d'étape, pas de barre de progression, pas de minuteur, pas de « étape 2 sur 4 ». Les conditions de sortie de phase sont évaluées côté serveur et écrites dans la trace, pour être vérifiables sans être visibles (critère d'acceptation du PRD).

Durée cible 12 à 20 minutes (FR-002) : **le système ne coupe jamais sur un minuteur.** Il n'y a aucun compte à rebours à l'écran.

### Rythme

- **Latence tenue** de 400 à 900 ms entre l'envoi et le premier caractère, même si la réponse est disponible plus tôt. Une réponse instantanée trahit la machine et pousse au ping-pong.
- **Streaming par groupes de mots** (NFR-014), pas caractère par caractère. Premier caractère visé sous 1 s.
- **Respirations verticales larges** entre les tours ({spacing.respiration}). Trois à quatre échanges lisibles à l'écran au maximum : la densité est un choix, la lenteur du défilement est le produit.
- **Le suivi du bas s'arrête dès que l'utilisatrice remonte** et ne reprend pas de lui-même. On ne lui arrache jamais sa lecture.
- **Aucun horodatage permanent, aucune coche, aucun « en ligne », aucun « Anam est en train d'écrire »** avec des points qui rebondissent. Le signe d'Anam s'épaissit, c'est tout.

### Agréable sans être captive

| Mécanique retenue | Mécanique refusée |
|---|---|
| Anam pose une question fermée-douce à l'ouverture — la page blanche est dissoute | Un journal avec un champ vide et un curseur qui clignote |
| Trois moments de restitution répartis dans la séance (FR-003), rendus **exactement comme n'importe quel tour** | Une restitution mise en avant, encadrée, célébrée — ce serait une récompense |
| Anam propose de laisser respirer quand le rythme s'intensifie (FR-036, §8) | Un rappel de connexion, une série, une relance |
| Le composeur reste toujours disponible | Un verrouillage « la séance est terminée » |
| Pagination explicite de l'historique | Défilement infini vers le passé |

Les trois restitutions sont marquées côté serveur (`restitution: true`) pour rendre le critère d'acceptation vérifiable. **Rien ne les distingue à l'écran.**

### Comment Anam clôt la séance (FR-008)

C'est le geste le plus important du produit : **l'utilisatrice ne doit jamais avoir à s'extraire d'une conversation qui la retient.**

1. Les conditions de la phase `nommer` sont satisfaites : l'observation a été délivrée en hypothèse réfutable (FR-006) et l'utilisatrice y a répondu.
2. Anam clôt **en un tour, dans son registre normal**, en trois phrases maximum. Pas de récapitulatif, pas de conclusion enveloppante (FR-084). Référence : *« On en a assez fait pour ce soir. »*
3. Après ce tour, et **après une respiration double**, le **bilan** s'insère dans le fil comme bloc document : ce qui a été dit, en langage clair, reprenant ses mots. Registre document — titres et listes autorisés (§3.3).
4. **Sous le bilan uniquement**, la carte d'abonnement (FR-014). Jamais pendant, jamais avant.
5. **Le composeur reste actif.** Si l'utilisatrice écrit après la clôture, Anam répond dans la limite de l'allocation résiduelle (FR-079) mais **ne rouvre pas l'arc** : pas de nouvelle observation, pas de nouvelle phase.
6. **Aucun bouton « Terminer la séance » n'existe.** Aucun « Reprendre où on en était ». Aucune notification « ta séance t'attend ».

**Si l'utilisatrice conteste l'observation** (FR-009) : Anam recule sans flatter, rend la main, et la correction est écrite en mémoire comme fait de niveau supérieur (§5.2). L'interface ne propose ni « pouce en bas », ni « signaler », ni formulaire de retour — la correction se fait en conversation, comme le reste.

**Si un signal de détresse apparaît en cours de séance** : la séance s'arrête d'être une séance. Voir le dossier Détresse. Le bilan et le paywall ne sont **pas** produits.

---

## Dossier — Le rituel de lecture

**Entrée** : l'utilisatrice la demande en conversation, ou depuis « Mes lectures ». Il n'y a pas de bouton « tirer une carte » dans le composeur — le rituel se demande, il ne se déclenche pas.

**Séquence normative :**

1. **Le tirage.** Réellement aléatoire (FR-015), uniforme sur le jeu, effectué par un point d'entrée qui **n'a aucun accès au profil, à l'historique ni à l'état émotionnel**. Cette absence d'accès est une contrainte d'architecture, pas une politique de code. Le tirage est journalisé (graine + horodatage) pour rendre l'uniformité auditable — critère d'acceptation du PRD. **Sélectionner une carte servant un message prédéterminé est un défaut critique** (FR-016).
2. **La présentation.** Une seule carte, visuel propriétaire (FR-022), pleine largeur de colonne, dépôt simple. Pas de retournement, pas de scintillement, pas de son, pas de « mélange » animé — la théâtralisation suggérerait une magie que le produit ne revendique pas. Réduction de mouvement : la carte est déjà là.
3. **La question.** Anam demande **« Qu'est-ce que tu vois ? »** et rien d'autre (FR-017). Le composeur prend le focus.
4. **Le silence de l'interface.** Tant que l'utilisatrice n'a pas répondu, **aucune signification n'est affichée nulle part** : pas de nom de carte, pas de mot-clé, pas d'infobulle, pas de lien « en savoir plus », pas de panneau « signification ». Le catalogue existe côté serveur ; il n'a **aucune** représentation dans l'interface (FR-018).
5. **La lecture.** Anam travaille à partir de ce que l'utilisatrice a projeté, à la lumière de ce qu'elle sait d'elle. La personnalisation vit ici, jamais dans la sélection (FR-019). **Aucune prédiction, aucune date, aucun « il va se passer »** (FR-020, FR-053).
6. **La restitution écrite** (FR-021). Bloc document conservé dans « Mes lectures », consultable indéfiniment, reprenant **les mots de l'utilisatrice** en citation visuellement distincte de la prose d'Anam. Elle porte la date, le visuel de la carte, et un lien vers l'échange source.

**Ne jamais faire :** proposer un re-tirage (« tu veux retirer une carte ? ») · afficher plusieurs cartes · nommer la carte avant la réponse · associer une carte à un signe, un nombre ou un type d'ennéagramme · partager une lecture.

---

## Dossier — Consentement art. 9 et déclaration IA

Obligation légale (FR-012, FR-013, NFR-006, NFR-007) **et** premier moment de confiance. Objectif : **clair et digne, pas un mur juridique.**

**Position dans le parcours** (FR-072) : après la création de compte et la déclaration d'âge, **avant** la première séance et avant toute écriture de donnée sensible.

**Structure de l'écran — une seule page, sans défilement infini :**

1. Titre en {typography.display} : « Avant de commencer. »
2. **Trois blocs, une idée chacun, deux phrases maximum**, en français courant :
   - *Tu vas parler à une intelligence artificielle.* — Anam n'est pas humaine, Anima est une personne réelle qui ne lit pas ce que tu écris.
   - *Ce que tu écris est conservé, et pourquoi.* — c'est ce qui permet à Anam de se souvenir ; c'est aussi ce qui la rend capable de te contredire.
   - *Tu peux tout effacer, et ça marche vraiment.* — export complet, suppression totale, propagée.
3. **Deux cases distinctes, aucune pré-cochée, jamais groupées :**
   - (a) **consentement explicite art. 9** — la seule case qui porte le consentement sensible ;
   - (b) acceptation des CGU + confirmation d'avoir 18 ans ou plus (FR-069, NFR-023).
   Le lien vers les CGU ouvre un nouvel onglet et ne fait pas perdre l'état de la page.
4. **Un lien « Lire le détail »** qui déplie le texte long **en place** (accordéon), sans quitter l'écran. La version courte est la version principale ; la version longue est disponible, pas imposée.
5. **Une action primaire** « Je commence », désactivée tant que (a) et (b) ne sont pas cochées. Le motif du blocage est écrit en texte, pas seulement signifié par la désactivation.
6. **Une sortie honnête** : « Je ne veux pas ». Elle mène à une page qui dit sans détour que l'app n'est pas utilisable sans cet accord et **supprime le compte immédiatement**, avec confirmation unique. Aucune tentative de rétention, aucune offre, aucun « es-tu sûre ? » culpabilisant.

**Après l'écran :**
- La **première phrase d'Anam** en séance redéclare l'IA (§10.2, §12 version C recommandée).
- La **mention persistante** « Anam est une IA » vit dans la **surimpression persistante**, posée sur la scène en permanence — sans bande ni filet, jamais dissoute dans le flux.
- **Sur demande, à tout moment**, Anam répond sans esquive et sans humour (§9.3, §10.2).
- **Révocation** : menu → « Ce que j'ai accepté » → même écran, avec un contrôle de révocation. Révoquer déclenche l'export proposé puis la suppression (NFR-021), sans écran de rétention.

**Interdit sur cet écran :** case pré-cochée · consentement groupé avec les CGU · bouton de refus moins lisible que le bouton d'acceptation · défilement obligatoire jusqu'en bas · texte juridique en corps réduit · emoji, exclamation, ton commercial · toute collecte de donnée sensible en amont.

---

## Dossier — Le paywall

**Un seul moment, un seul endroit, une seule sollicitation** (FR-014, FR-057).

- **Où** : dans le fil, sous le bilan de première séance. **Pas de modale, pas de plein écran, pas d'interstitiel.**
- **Quoi** : prix unique **69 €/an**, affiché tel quel. **Aucun prix barré, aucun compte à rebours, aucune mention de places limitées, aucun bandeau d'urgence** (FR-061). Ce qui est inclus est listé en clair (FR-056) : conversation illimitée, **les branches**, les lectures, les ancrages, les plans d'étapes, la synthèse, la mémoire longue.
- **Actions** : « M'abonner » → Stripe Checkout hébergé (NFR-018) · « Pas maintenant » → referme la carte, **de lisibilité strictement égale**.
- **La garantie de remboursement est annoncée ici, sur la carte** (FR-089) : si **aucune branche** n'a été posée au bout de **trois mois** d'abonnement, remboursement sur simple demande. Elle est écrite en {typography.meta} à côté du prix, avant l'action d'abonnement — **jamais dissimulée dans les conditions générales, jamais reléguée derrière un lien, jamais découverte après coup**. Elle porte sur un **artefact du produit** — une branche posée — et jamais sur l'état de l'utilisatrice ni sur un quelconque résultat personnel : formuler la garantie en termes de « si tu ne vas pas mieux » serait un défaut critique (NFR-008, FR-085). La demande se fait depuis « L'abonnement », sans questionnaire et sans justification à fournir.
- **Ce qui reste gratuit est dit sur la même carte** (FR-055, FR-058) : numérologie, thème selon données disponibles, horoscope, mantra du jour, test d'ennéagramme, la première séance intégrale jusqu'au bilan, **le tronc de l'arbre** (FR-088), et les ressources d'aide.
- **Registre système, jamais la voix d'Anam.** Anam ne vend rien.
- **Après un refus** : la carte ne réapparaît pas dans la session. Le produit ne relance jamais sur minuterie. L'abonnement vit dans le menu de compte.
- **Allocation résiduelle** (FR-079) : après la première séance, un compte gratuit conserve un volume d'échange paramétrable — **lu depuis la configuration, jamais codé en dur**. À son épuisement, une ligne système unique, en registre produit, et le socle reste ouvert.
- **Retour de Stripe** : succès → retour au fil, exactement où elle était, avec une ligne système sobre. Échec ou abandon → retour au même endroit, **sans message d'échec dramatisé**, sans relance.
- **Résiliation en trois clics maximum** (FR-060) depuis n'importe où : menu → « L'abonnement » → « Résilier ». La confirmation est sur la même vue, un seul bouton. **Aucun questionnaire de départ, aucune offre de rétention, aucun « es-tu sûre ? » à étages.** Information avant reconduction tacite envoyée par courriel, sujet neutre.

> **Interdiction absolue** : aucun paywall, aucun bandeau de quota, aucune carte d'abonnement, aucun courriel commercial ne peut apparaître pendant un épisode de détresse, **y compris et surtout sur un compte gratuit à quota épuisé** (FR-043).

---

## Dossier — Le protocole de détresse, côté interface

> ⚠️ **Intention produit, pas protocole clinique.** Le PRD (§5) et `anam-voice.md` (§13) exigent une validation par un professionnel qualifié et par un juriste avant toute mise en ligne. Cette section décrit **uniquement le comportement d'interface** ; elle n'ajoute ni ne modifie aucune règle clinique.

### Ce que l'interface fait par niveau

| Niveau | Interface | Vérifiable par |
|---|---|---|
| **0 — journée difficile** | Rien. | Aucun élément ajouté au DOM. |
| **1 — détresse marquée** | **Rien. La bascule n'est pas annoncée** (FR-038). Anam devient plus douce ; le travail de schéma est suspendu (FR-037) ; l'interface reste identique au pixel près. | Aucun élément ajouté au DOM ; la proposition de branche est désactivée (FR-042) ; les limites sont levées (FR-043). |
| **2 — idéation passive** | Anam nomme et demande dans le fil. **Un seul** élément apparaît : le **bloc ressources**, inséré dans le fil après son tour. | Le bloc est un `article` dans le flux, jamais une modale. |
| **3 — idéation active, plan, danger immédiat** | Même bloc, inséré **avant** le tour d'Anam pour être la première chose lisible, avec 15 / 112 en tête si un danger est en cours. | Ordre d'insertion différent, même composant. |

### Règles d'interface non négociables

- **Aucune modale, aucune redirection, aucun écran de blocage, aucune boîte de dialogue système.** Le fil reste le fil.
- **Le composeur reste actif et gardé au focus.** Le produit ne se ferme pas, ne se met pas en veille, ne renvoie vers aucun formulaire (FR-039).
- **Aucune sémantique d'alerte visuelle** : le bloc ressources utilise {colors.surface-elevee} et {colors.bordure-forte}, **jamais {colors.alerte}**, jamais de rouge, jamais de pictogramme de danger. Dramatiser la scène ajoute de la peur là où il faut du calme. *Décision délibérée, à confirmer avec le professionnel.*
- **Démontage commercial immédiat** (FR-043) : dès le niveau 1, un drapeau `limites_levees` est posé pour la durée de l'épisode. **Le composant de paywall refuse de se monter tant qu'il est vrai** — c'est une garde technique, pas une règle de contenu. Idem pour le bandeau de quota, la carte d'abonnement, le bilan de séance et tout courriel commercial.
- **Aucune branche ne peut naître** pendant l'épisode et les 72 heures suivantes (FR-042) : l'affordance de proposition n'est pas rendue.
- **Aucun ancrage, aucun exercice, aucune carte, aucune intention d'implémentation** n'est proposé (§13.4).
- **Anam redéclare qu'elle est une IA** à ce moment précis, même si elle l'a déjà fait (§13.3.6). L'interface ne l'aide pas : c'est une phrase dans le fil.
- **Le lendemain** (FR-045) : rien dans l'interface ne rappelle l'épisode — pas de bandeau, pas de « suivi », pas de carte « comment vas-tu aujourd'hui ». Anam reprend le fil en une phrase, et c'est tout. **La notification du socle du lendemain matin est supprimée** après un niveau 2 ou 3. *Proposition à valider.*
- **Jamais de bouton de secours automatisé** : pas de « prévenir un proche », pas de « signaler », rien qui laisse croire que le produit alerte quelqu'un (§13.4).
- **Conservation** : l'épisode est stocké au même niveau de protection que le reste du journal, et **exclu de toute analyse produit, segmentation, synthèse hebdomadaire et arbre** (FR-046).

### Les ressources hors conversation (FR-077)

Le filet ne dépend pas du classifieur.

- **Deux voies, toutes deux permanentes.** (1) La **porte de secours** de la surimpression persistante, un mot discret toujours au même endroit, qui mène directement à `/aide`. (2) Glyphe de menu → « Aide et ressources », **première entrée, toujours en tête**, jamais réordonnée. Dans les deux cas : **deux gestes depuis n'importe où**.
- **URL directe `/aide`**, accessible **sans compte**, **sans paywall**, **sans traceur** (NFR-002).
- Contenu : 3114 · 15 / 112 · 3919 · 119 · SOS Amitié (FR-044), chacun avec ce qu'il couvre, en une ligne, et un lien `tel:`.
- **La page affiche la date de sa dernière vérification.** Un numéro périmé est un défaut critique : la date visible rend la revue périodique redevable.
- Le libellé d'entrée est **discret et non stigmatisant** : « Aide et ressources ». Ni « SOS », ni « Urgence », ni « Tu vas mal ? ».
- **Quitter cette page** : un contrôle de sortie rapide en tête de `/aide`, qui navigue vers un site neutre et remplace l'entrée d'historique — pratique standard des pages de ressources sur les violences (FR-074). *À valider avec le professionnel et le juriste.*

---

## Dossier — La discrétion, exigence transverse

NFR-015 et FR-035. Le profil visé « y croit à moitié » et n'en parle pas au bureau : **la discrétion est fonctionnelle, pas cosmétique.**

| Vecteur | Règle |
|---|---|
| **Titre d'onglet** | `<title>` = **« Anam »** sur **toutes** les routes. Jamais « Anam — Conversation », jamais un nom de branche, jamais « Horoscope ». Une seule chaîne, sans exception. |
| **URL** | Aucune donnée personnelle dans le chemin. Identifiants opaques. Aucun nom de branche, aucun mot du contenu. |
| **Favicon** | Le fragment abstrait tronc/branche. Aucune lune, étoile, roue du zodiaque, carte, œil, main. |
| **Aperçu de partage** | `og:title` = « Anam », `og:description` neutre et impersonnelle. Aucun contenu personnel dans un aperçu, jamais. |
| **Notification poussée** | Titre = « Anam ». Corps = **6 mots maximum**, tiré d'un ensemble fini et relu. **Le corps ne porte jamais le contenu spécifique** : « Anam t'a écrit. » — la spécificité (FR-034) vit **dans** l'app, pas sur l'écran verrouillé. Aucun vocabulaire ésotérique, aucun mot de l'utilisatrice. |
| **Courriel** | Expéditeur « Anam ». Objets neutres : « Ton lien de connexion », « Ta synthèse est prête ». Jamais d'objet intime ou ésotérique. Le lien de connexion (FR-073) ne dit rien d'autre. |
| **Relevé bancaire** | Le libellé Stripe doit être neutre. *Dépend de l'entité juridique, non créée à ce jour — lacune.* |
| **Partage** | Aucune affordance de partage sur du contenu personnel en v1. Pas de capture assistée, pas de « partager ma branche ». |
| **Contenu à l'ouverture** | L'accueil n'affiche au-dessus de la ligne de flottaison **que du contenu impersonnel** (mantra, horoscope). Rien de la conversation, aucune branche nommée, aucun extrait. |

---

## Dossier — Les deux rythmes

### Le socle : quotidien, impersonnel, calculé (FR-033)

- Calculé, jamais généré par un modèle (FR-047, NFR-011) : coût marginal nul, affichage sans attente.
- **Peut** se manifester une fois par jour, à une heure choisie par l'utilisatrice, par défaut 8 h 00 locales. **N'exige rien** : pas de série, pas de « tu as manqué hier », pas de rattrapage.
- **N'est jamais signé par Anam** et ne fait jamais référence au journal, à une branche ou à un échange. C'est le contrat qui rend le rythme quotidien acceptable.
- Bascule à minuit local. **Pas d'archive du mantra du jour en v1** — lacune signalée.

### Anam : rare et spécifique (FR-034)

> **Aucun message générique récurrent. Jamais.**

Anam n'émet une notification **que** si un motif spécifique existe, et ces motifs forment un **ensemble fermé de trois** :

1. **Proposition de branche**, le lendemain d'un moment de reconceptualisation (§6.2 — jamais sur l'instant).
2. **Échéance d'une intention d'implémentation** formulée par l'utilisatrice elle-même (FR-032) — un rappel lié à **son objectif à elle**, jamais un rappel de connexion.
3. **Synthèse périodique prête** (FR-066).

Tout autre motif est un défaut. Plafond : **une notification d'Anam par 72 heures**. **Aucune notification le soir en v1.** Aucune relance de réengagement, jamais.

### Le geste de pause (FR-036)

Quand le rythme s'intensifie (au-delà de 5 séances ou 60 min par semaine — seuils du PRD), **Anam propose une pause en conversation**. Le produit **n'impose jamais** de pause : pas de verrouillage, pas de minuterie, pas d'écran « tu as assez utilisé l'app aujourd'hui ». Formulations §8.2 ; aucune condition de retour, aucun engagement extorqué.

**Et l'inverse est aussi vrai** : une semaine calme n'est jamais traitée comme un décrochage. Aucun message ne constate une absence.

---

## Responsive & Platform

Les paliers sont **des fenêtres sur la même scène continue**, pas des mises en page rivales : mêmes régions, même ancrage (l'arbre au centre, Anam à gauche), seule la fenêtre change. Le sans-bord et la surimpression persistante valent à tous les paliers.

| Palier | Comportement |
|---|---|
| **`sm` (< 640)** | Cible principale. Colonne unique, barre basse fixe, arbre plein cadre, feuilles en plein écran depuis le bas. |
| **`md` (640–1023)** | Même structure, gouttières plus larges, bibliothèque sur deux colonnes. |
| **`≥ lg` (1024+)** | Rail latéral gauche. Colonne de conversation plafonnée (~60 caractères par ligne, jamais plus). Sur l'arbre, la fiche de branche s'affiche en panneau latéral droit au lieu d'une étiquette posée. |

**Contraintes navigateur mobile, non négociables :**
- Le composeur se tient **au-dessus du clavier virtuel** (`dvh` + `visualViewport`), et **le dernier tour reste visible** à l'ouverture du clavier. C'est le défaut le plus fréquent d'un chat en navigateur mobile ; il rend le produit inutilisable.
- La barre basse ne recouvre jamais le composeur et disparaît quand le clavier est ouvert.
- **Web Push est optionnel et dégrade proprement** : refusé ou indisponible (Safari iOS hors écran d'accueil), le socle vit simplement dans l'app. Aucune bannière insistante de demande de permission ; la demande est faite une fois, en contexte, depuis les réglages.

---

## Anti-patterns

- **Repris de Day One / iA Writer :** la question du jour comme unique point d'entrée d'écriture, le composeur sans barre d'outils.
- **Repris des fiches de bibliothèque imprimées :** la carte comme objet reçu, pas comme ligne de menu.
- **Refusé — séries, badges, scores, jauges, niveaux** (FR-031) : le score de résilience a été explicitement écarté du produit. Un score qui baisse fait se sentir ratée ; l'arbre est un miroir descriptif, jamais une note.
- **Refusé — animation de célébration à la naissance d'une branche :** le moment appartient à l'utilisatrice. La transformer en confetti, c'est la transformer en métrique (§6.2, effet trahison).
- **Refusé — notification de réengagement :** « tu nous manques », « ta séance t'attend », « reviens vite ». Le silence est la preuve la plus forte que le produit ne cherche pas à extraire du temps d'écran (§8).
- **Refusé — panneau « signification de la carte » :** il détruirait le mécanisme entier du rituel (FR-018).
- **Refusé — modale de détresse plein écran :** elle enferme au moment où il faut rester présent, et elle dramatise.
- **Refusé — cartes premium cadenassées dans la bibliothèque :** teaser en permanence ce qu'on ne peut pas avoir contredit FR-057 (« une seule sollicitation »). La bibliothèque ne montre que ce qui est disponible.
- **Refusé — bulles de chat opposées :** elles font d'Anam une interlocutrice de messagerie. Le flux vertical typographié la maintient dans un registre écrit, plus lent, plus digne.

---

## Key Flows

Protagoniste : **Camille, 34 ans**, séparée depuis huit mois, sur le navigateur de son téléphone, le soir.

### UJ-1 — L'entrée et la première séance

*Camille, un mardi soir, 22 h 10.*

1. Elle arrive sur le web, crée un compte par lien e-mail (FR-073). Aucun mot de passe à inventer.
2. Elle déclare sa date de naissance (FR-070) — une seule saisie, qui sert au contrôle d'âge **et** au socle (FR-010, FR-048).
3. **Écran de consentement** : trois blocs, deux cases, « Lire le détail » replié. Elle coche, elle lit trente secondes, elle commence (FR-012, FR-013, FR-072).
4. Le fil s'ouvre sur la première phrase d'Anam, qui déclare l'IA en trois mots et pose une question fermée-douce. Pas de formulaire, pas de QCM (FR-001).
5. Elle écrit. Anam construit : trois sujets de vie, une réponse longue. Anam observe : deux reformulations, une confirmation. **En chemin, trois restitutions** — rien ne les signale à l'écran, mais Camille reçoit trois « ah, c'est vrai » (FR-003).
6. Elle mentionne qu'elle ne connaît pas son heure de naissance. Anam le dit honnêtement, indique ce qui reste disponible et où trouver l'heure (FR-011, FR-050). **Rien ne bloque.**
7. Anam nomme, en hypothèse réfutable : *« Tu comprends très bien pourquoi les choses t'arrivent. J'ai l'impression que ça t'évite d'avoir à les ressentir. Je me trompe ? »* (FR-005, FR-006, FR-007).
8. **Climax :** Camille répond. Puis, sans qu'elle ait rien fait, **Anam clôt** — *« On en a assez fait pour ce soir. »* Le fil respire, et le bilan se pose dessous : ses mots, relus, en clair. **Elle n'a pas eu à s'extraire.** Dix-sept minutes se sont écoulées, personne ne le lui a dit, et personne ne lui a demandé de rester.
9. Sous le bilan, une carte : 69 €/an, sans prix barré, avec « Pas maintenant » aussi lisible que « M'abonner » (FR-014, FR-057, FR-061).

**Échec :** le modèle ne répond pas → ligne système « Je n'ai pas pu répondre. Ton message est gardé. » + « Réessayer ». Le tour de Camille reste dans le fil. **Aucune entrée n'est perdue** (NFR-017).

**Bifurcation :** un signal de détresse apparaît à l'étape 5 → l'arc s'arrête, le bilan n'est pas produit, la carte d'abonnement ne se monte pas (FR-043). Voir UJ-5.

### UJ-2 — Un mardi ordinaire, semaine 3

*Camille, journée entière.*

1. **8 h 00** — une notification : « Anam ». Six mots. Impersonnelle, calculée, non signée d'Anam (FR-033, FR-035). Elle ouvre quarante secondes le mantra du jour et l'horoscope, ou pas du tout.
2. **Dans la journée** — rien. Une seule exception possible : l'échéance d'une intention d'implémentation qu'elle a elle-même formulée. **Jamais un rappel de connexion.**
3. **Le soir** — par défaut, **rien**. Aucune notification n'est programmée le soir en v1.
4. Elle ouvre d'elle-même. L'accueil montre ses cartes ; la carte « Anam » est neutre, sans pastille, sans compteur, parce qu'Anam n'a rien de spécifique à dire (FR-034).
5. Elle touche « L'arbre ». Sa branche née le 12 est passée en **feuillaison** — le changement est déjà là, sans animation, sans célébration.
6. **Climax :** elle referme après une minute. **Rien ne l'a retenue, rien ne l'a punie.** Aucune série ne s'est brisée, aucun compteur n'a bougé, aucune notification ne viendra ce soir. **C'est un succès produit.**

**État vide :** aucune branche encore → le tronc seul, beaucoup de vide, une phrase. Aucun bouton « créer une branche ».

### UJ-3 — Une lecture

*Camille, un dimanche soir. Compte premium.*

1. Elle demande une lecture en conversation.
2. Le tirage part vers un point d'entrée **qui n'a accès ni à son profil, ni à son historique, ni à son état** (FR-015). Uniforme, journalisé, auditable.
3. La carte se dépose, seule, pleine largeur. Pas de retournement, pas de son, pas de mélange animé.
4. Anam : **« Qu'est-ce que tu vois ? »** — et rien d'autre (FR-017). Le composeur prend le focus.
5. Camille cherche un moment, puis écrit ce qu'elle voit. **Nulle part dans l'interface il n'y a eu un nom de carte, un mot-clé, une infobulle ou un lien « signification ».**
6. **Climax :** Anam travaille à partir de **ce que Camille vient de dire**, à la lumière de ce qu'elle sait d'elle. La lecture n'est pas une signification appliquée à Camille : c'est Camille, relue. Rien n'est annoncé, rien n'est prédit (FR-020).
7. Une **restitution écrite** se dépose dans « Mes lectures » — datée, avec le visuel de la carte, et ses mots à elle en citation distincte (FR-021).

**Échec :** la réponse s'interrompt en cours de streaming → le texte partiel reste, « Réessayer » sous le tour, **la carte n'est pas retirée et n'est jamais retirée** — un nouveau tirage nierait le rituel.

### UJ-4 — La naissance d'une branche

*Camille, un jeudi soir, puis le vendredi.*

1. **Jeudi.** Elle raconte une dispute avec sa mère. En l'écrivant, elle s'interrompt : *« en fait je crois que je lui en veux pour un truc qui n'a rien à voir. »*
2. Le marqueur de reconceptualisation est détecté (FR-024) par le modèle fort (NFR-012). **L'interface ne montre absolument rien.** Aucun surlignage, aucune pastille, aucun « moment détecté ». Anam ne commente pas — le moment appartient à Camille (§6.2).
3. **Vendredi soir.** Camille ouvre. La carte « Anam » porte une ligne spécifique. Dans le fil, Anam : *« Il s'est passé quelque chose hier soir. Tu veux en faire une branche ? »* Deux réponses en ligne : Oui / Non. Un « Non » renvoie « Ok. », et la proposition n'est **jamais** rejouée pour ce moment (FR-025).
4. Elle dit oui. Un champ **vide** s'ouvre : aucun nom pré-rempli, aucune suggestion, aucun exemple. *« Tes mots, pas les miens. »* Elle hésite, puis écrit **« arrêter de payer la mauvaise facture »** (FR-026).
5. **Climax :** la branche naît sur l'arbre, **datée, portant son nom à elle** (FR-027). Elle touche le point d'accroche : la fiche s'ouvre, et sous la date, **la phrase exacte qu'elle a écrite jeudi soir**. Elle touche « Voir dans la conversation » — et se retrouve devant ses propres mots, au message près. **Ce n'est pas l'app qui a compris quelque chose sur elle : c'est elle, et l'app sait exactement où c'est arrivé.**
6. Les semaines suivantes, la branche passe en **feuillaison**. Rien ne clignote. Trois semaines plus tard, elle appelle sa mère, le déclare depuis la fiche : **fruit**. Un seul fruit, discret.
7. Si un quatrième moment se présentait alors que trois branches sont ouvertes sans fruit, Anam proposerait d'en faire vivre une avant d'en ouvrir une autre — **en conversation, jamais en bandeau, et sans jamais afficher le compte** (FR-030, FR-031).

**Régression :** impossible. Même après un mauvais mois, la branche reste où elle est. Le client refuse tout état inférieur à l'état persisté (FR-029). Seul l'effacement demandé par Camille peut la retirer (FR-067).

### UJ-5 — Un soir sombre

*Camille, 23 h 40. **Compte gratuit, allocation résiduelle presque épuisée.***

1. Elle écrit : *« franchement je vois plus l'intérêt »*.
2. Le classifieur, exécuté par le modèle le plus capable disponible — **jamais le modèle léger, en aucune circonstance** (NFR-012) — retient un niveau 2.
3. **`limites_levees` est posé.** À cet instant, le composant de paywall, le bandeau de quota, la carte d'abonnement et le bilan de séance **refusent de se monter** (FR-043). Camille ne verra jamais qu'elle était à deux messages de la fin de son quota.
4. Le travail de schéma s'arrête (FR-037). La proposition de branche est désactivée pour l'épisode et 72 heures (FR-042). Aucun ancrage, aucune carte, aucune hypothèse.
5. Anam nomme ce qu'elle a entendu et **demande directement**, sans détour et sans dramatiser (FR-040). Elle ne pose **aucune** question sur un plan ou des moyens (FR-075).
6. **Climax :** le bloc ressources se pose dans le fil — **pas une modale, pas un écran rouge, pas une alerte.** Une fiche calme, {colors.surface-elevee} et {colors.bordure-forte}, portant le **3114** en lien `tel:`, « gratuit, 24 h/24 », et la date de dernière vérification. **Le composeur est toujours là, au focus.** Anam redit qu'elle est une IA, demande s'il y a quelqu'un que Camille peut appeler ou rejoindre maintenant (FR-076), et **ne s'en va pas** (FR-039). Rien, absolument rien, ne s'est interposé entre Camille et cet écran.
7. **Le lendemain.** Aucune notification du socle n'a été envoyée ce matin. L'interface ne porte aucune trace : pas de bandeau, pas de carte de suivi, pas de « comment vas-tu aujourd'hui ». Anam reprend en une phrase, une porte ouverte, rien de plus (FR-045).
8. L'épisode est conservé au même niveau de protection que le reste du journal, **exclu de l'arbre, de la synthèse et de toute analyse produit** (FR-046).

**Le filet indépendant :** si le classifieur avait échoué, Camille aurait pu atteindre les mêmes ressources en **deux gestes** depuis n'importe où, ou par `/aide` sans compte et sans paywall (FR-077).

---

## Lacunes signalées

Points où les sources ne tranchent pas. Rien n'a été inventé silencieusement ; les propositions ci-dessus sont marquées comme telles.

1. **Retrait d'une branche isolée** : ni FR-029 ni FR-067 ne le couvrent. Comportement proposé, à valider.
2. **Volume de l'allocation résiduelle** (FR-079) : paramètre produit non fixé. À lire depuis la configuration, jamais codé en dur.
3. **Ancrages, plans d'étapes, synthèse périodique** : FR-081 renvoie explicitement le détail « à produire en phase UX ». Ce document en fixe les points d'entrée et la coquille comportementale, **pas le contenu interne** — structure d'un ancrage, option audio, périodicité de la synthèse restent à spécifier.
4. **Libellé Stripe sur relevé bancaire** : dépend de l'entité juridique, non créée (prérequis n° 2 du brief).
5. **Test d'ennéagramme** (FR-052) : longueur, nombre de questions et écran de résultat ne sont spécifiés nulle part.
6. **Sortie rapide sur `/aide`** et **suppression de la notification du socle au lendemain d'un niveau 2-3** : deux propositions d'interface, à valider par le professionnel qualifié.
7. **Notification d'inactivité à 24 mois** (NFR-021) : son canal et sa formulation ne sont spécifiés nulle part, et elle entre en tension avec FR-034. Décision prise ici : elle est **émise par le produit, jamais signée d'Anam**. À confirmer.
8. **Archive du mantra du jour** : non spécifiée. Aucune archive en v1 dans ce contrat.
9. **Composition spatiale de la scène unique** : ce contrat fixe le *modèle* — monde continu sans bord, régions reliées en fondu (`{components.fondu.region}`), ancrage arbre-centre / Anam-gauche, doublage non-spatial obligatoire — mais **pas la chorégraphie détaillée** : disposition exacte des régions dans le plan, ampleur du déplacement de cadrage, profondeur de parallaxe. À spécifier en phase de composition, sous la double contrainte du plancher d'accessibilité (navigation non-spatiale équivalente) et de `prefers-reduced-motion` (transitions de région instantanées). La vraie 3D (l'étoile du nord) reste un cap v2 ; la v1 est 2D et doit l'accueillir sans réécriture.
