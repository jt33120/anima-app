# Plan de correction — après le tour de QA visuelle du 19 août 2026

**Écrit le 2026-08-19.** Compagnon de `QA-VISUELLE-COWORK.md` (les prompts) et de
`PORTES-AVANT-PUBLICATION.md` (les portes juridiques et contractuelles).

Ce document tient le **registre** : ce qui est fermé, ce qui reste, qui peut le fermer, et dans
quel ordre. Un constat qu'on ne tranche pas est un constat perdu.

---

## 1. Ce qui est fermé, et gardé

Chaque ligne a une garde qui **rougit** quand on réintroduit le défaut. Campagne de mutation :
6 mutants sur les gardes de source, 6 tués ; 1 mutant sur la garde E2E, tué.

| # | Défaut mesuré | Où vit la garde |
|---|---|---|
| — | Le code à six chiffres perdu au rechargement d'onglet | `e2e/entree.spec.ts` |
| Focus | **8 anneaux divergents sur 41** (7 en `--texte`, 1 en `--accent`) | `tests/qa-visuelle-19-aout.test.ts` |
| H2 | `/entrer` : les deux liens du pied à 27,7 × 43,4 px | `e2e/cibles-tactiles.spec.ts` |
| H2 | La scène : « Aide » à 43,7 px de large | idem |
| H2 | Les haltes : « Aide » à 27,7 px de large | idem + garde de source |
| M2 | L'accent peint sur une étiquette non cliquable | `tests/qa-visuelle-19-aout.test.ts` |
| M3 | Le seul vouvoiement du produit, à six mots d'un tutoiement | idem, sur TOUTES les chaînes |
| M4 | « Bonsoir » à 9 h 55 du matin | retiré (voir §4) |
| M5-bis | **Deux familles de titre** sur le même écran (Inter vs Fraunces) | `tests/qa-visuelle-19-aout.test.ts` |
| B3 | La racine du document en noir pur | idem |
| M6 | Les CGU inatteignables une fois connectée | lien posé dans `/reglages` |
| Barre | La barre du bas coupait le texte des régions autres que la conversation | `render/monde.module.css` |

---

## 2. Cinq constats du rapport qui étaient FAUX — et pourquoi ça compte

Cinq constats sur les vingt étaient faux. Les corriger vaut autant que corriger un défaut : un faux positif fait « réparer » du code juste,
et laisse croire qu'on a avancé.

**H1 — « la case d'effacement fait 13 × 13 px ».** Sa cible est le `<label>` qui l'enveloppe :
cliquer l'étiquette coche la case, c'est le comportement natif, et WCAG mesure ce qui est
réellement activable. Mesuré en navigateur : la cible fait toute la ligne. `e2e/cibles-tactiles.spec.ts`
le vérifie désormais à chaque exécution — parce que si quelqu'un sort un jour la case de son
label, plus rien ne le dirait.

**H5 — « 5,5 s d'attente sans aucun signe ».** La preuve visait l'élément `tourAnam`. Le signe
n'est pas là : il est inséré **en bas du fil**, dans son propre bloc, et l'annonce aux lecteurs
d'écran passe par la région `aria-live` unique du fil. Mesuré : le signe paraît en **moins d'une
seconde**, et la région vivante parle. Les deux existent depuis la Story 6.9.

**M1 — « la mention IA est absente de 5 écrans sur 13 ».** Absence **délibérée, et motivée écran
par écran** dans `lib/domain/pied-halte.ts`. L'AI Act art. 50 impose la mention là où du texte
produit par un modèle est affiché — pas ailleurs. Le code porte le motif de chacun :
`/reglages` → « des cases à cocher et une adresse ; aucun texte produit » ; `/mes-donnees` → « un
export de SES données ; le contenu affiché est le sien » ; `/abonnement` → « un état de contrat ».
L'inventaire est **fermé et gardé** : une page ajoutée sans verdict fait rougir la CI.

**B1 — « le pied apparaît puis disparaît en cours de tunnel ».** Même inventaire, même raison :
`/naissance` est « parcours d'entrée, avant le consentement art. 9 », et `/consentement` est
« l'écran qui DÉCLARE l'IA — y remettre la mention serait la répéter à elle-même ». Ce n'est pas
un traitement flottant, c'est une décision par écran.

**Focus — « 14 règles, toutes identiques ».** Démenti à tort *par la mesure elle-même* : un
navigateur ne voit que les feuilles chargées par les écrans qu'il a visités. La source en portait
**41, dont 8 divergentes**. ⚠️ **Leçon de méthode pour les tours suivants : sur une question de
COUVERTURE — « existe-t-il quelque part un X différent ? » — une mesure en navigateur ne peut pas
conclure par la négative.** Elle prouve ce qu'elle a vu, jamais ce qu'elle n'a pas ouvert.

---

## 3. Ce qui reste ouvert, par ordre de valeur

### 3.a — Ce que je peux faire, et qui attend seulement un feu vert

| # | Constat | Coût | Note |
|---|---|---|---|
| M5 | Cinq échelles de titre (40/28/24/18 px) | moyen | Demande de trancher l'échelle, pas seulement de l'appliquer. |
| B2 | Deux familles d'apostrophes selon l'écran | mécanique | La dette T21, connue : 486 droites contre 13 typographiques. |
| B4 | La cime de l'arbre traverse l'interstice entre deux cartes | petit | Visible sur `P2-05`. |
| H6 | Une réponse sur trois a échoué | à instrumenter | Aucune erreur console ni requête en 4xx/5xx relevée : il faut journaliser côté serveur avant de chercher. |

### 3.b — Ce que le code ne peut pas fermer

| # | Constat | Qui |
|---|---|---|
| H4 | Pas de passage « je viens de m'inscrire » → « je sais quoi faire ». Quatre cartes sur cinq disent « Anima n'a pas encore écrit cette carte » | **Anima + Julian.** C'est indissociable du corpus : un tutoriel qui présente des cartes vides ne présente rien. |
| — | Le corpus : 87 créneaux du quotidien, 9 textes d'ennéagramme, ancrages, numérologie | **Anima** |
| — | « Version provisoire — à finaliser avant le lancement » sur des CGU qu'on fait accepter | **Juridique** (porte §6) |
| — | Le protocole de détresse, jamais relu par un professionnel qualifié | **Juridique** (porte §6) |
| — | Stripe en mode TEST en production | **Julian** (porte §4) |
| — | Le DPA Mistral, le DPA Vercel qui **interdit** l'article 9, le domaine | **Julian** (portes §1–§3) |
| M4-bis | Quelle salutation remplace « Bonsoir » | **Anima.** Le rendre juste demande l'heure de l'utilisatrice — le serveur est en UTC — et `render/` n'a pas le droit d'importer `lib/domain` (AD-7/AD-10). Ce n'est pas un mot à replacer, c'est une donnée à faire descendre. En attendant, la phrase ne ment plus. |

### 3.c — Ce qui n'est pas un défaut, et qu'il ne faut pas « corriger »

**Le flux d'Anam n'arrive pas caractère par caractère, et c'est voulu.** Mesuré : 3 paliers pour
278 caractères, saut maximal de 197. La cause est nommée dans `app/api/anam/message/route.ts` :
le contrôle de sortie **retient une phrase tant qu'elle n'est pas ponctuée**, parce qu'une
demi-phrase n'est pas vérifiable. Trois paliers, ce sont trois phrases. Le plancher de latence
délibéré, lui, ne pèse que 500 ms : les 7 à 9 secondes sont celles du modèle.

Ce qui reste améliorable là n'est donc pas le rendu mais **le temps jusqu'à la première phrase** —
un sujet de modèle et de prompt, pas d'interface. `e2e/conversation-attente.spec.ts` enregistre le
chiffre à chaque exécution, sans le condamner : un seuil gravé rougirait un matin sans qu'une
ligne du produit ait changé.

---

## 4. L'ordre que je recommande

1. **Le corpus** (Anima). Rien d'autre ne débloque autant : quatre cartes sur cinq sont vides, et
   H4 ne se conçoit pas sans lui.
2. **B4, B2** — la finition mesurable, une session.
3. **H6** — instrumenter d'abord, chercher ensuite.
4. **H4** — le tutoriel, une fois le corpus écrit.
5. **M5** — l'échelle typographique, quand Anima aura relu la copie.
6. **Les portes juridiques** — indépendantes de tout le reste, et bloquantes pour la publication.

---

## 5. Les prompts du tour 2, à passer tel quel à Cowork

Le tour 1 a laissé sept points **NON TESTÉS**, et il a eu raison de le dire plutôt que de deviner.
Ces trois prompts les ferment.

⚠️ **Rappel de méthode à donner à Cowork, et que le tour 1 a appris à ses dépens** : une mesure
en navigateur prouve ce qu'elle a vu, jamais ce qu'elle n'a pas ouvert. Sur toute question de la
forme « existe-t-il quelque part un X différent ? », la conclusion honnête est « je n'en ai pas vu
sur les écrans que j'ai visités », jamais « il n'y en a pas ».

### Prompt 6 — Ce qui exige de vrais gestes

```
Tu es un expert en accessibilité et en interaction. Tu vas vérifier, dans Chrome, sept points
qu'un tour précédent a explicitement laissés NON TESTÉS parce qu'ils exigent de VRAIES frappes
clavier et de VRAIS gestes — un focus déclenché par script n'active pas `:focus-visible`, et un
clic simulé ne vaut pas une activation utilisateur. Tu ne modifies RIEN et tu ne proposes AUCUN
correctif : tu constates, tu mesures, tu captures.

Le navigateur est déjà connecté. Base : https://anima-app-swart.vercel.app/
Taille : mobile 390×844, puis 768×1024 — cette seconde taille n'a JAMAIS été couverte.

⚠️ MÉTHODE. Tout ce que tu ne peux pas déclencher par un vrai geste, tu le marques NON TESTÉ.
Ne devine pas. Un « conforme » deviné coûte plus cher qu'un trou déclaré.

1. TABULATION RÉELLE. Sur /entrer, sur la scène, sur la conversation et sur /reglages : appuie
   réellement sur Tab, écran par écran, et photographie CHAQUE anneau de focus qui apparaît.
   L'attendu est un seul style partout : contour de 2 px, couleur #77719C, décalé de 2 px.
   Dis pour chaque écran : combien d'arrêts, dans quel ordre, et si l'ordre suit ce qu'on voit.
2. LE DERNIER ARRÊT. Sur les écrans de type « halte » (/memoire, /reglages, /mes-donnees,
   /abonnement, /lectures, /synthese), le lien « Aide » doit être le DERNIER arrêt de tabulation.
   Vérifie-le en tabulant jusqu'au bout.
3. PIÈGE À FOCUS. Y a-t-il un endroit d'où Tab ne sort plus ? Essaie sur la conversation et sur
   l'arbre.
4. PAN ET ZOOM DE L'ARBRE. Avec une vraie molette et un vrai pincement (trackpad), sur la région
   « L'arbre » : le déplacement marche-t-il ? Le zoom ? Y a-t-il des limites ? Peut-on perdre
   l'arbre hors de l'écran sans moyen de le retrouver ?
5. DÉFILEMENT DU FIL. Écris trois messages dans la conversation pour la remplir. Pendant qu'une
   réponse s'écrit, remonte le fil avec un vrai geste : es-tu ramenée en bas de force ? Si oui,
   c'est un défaut ; si non, le fil suit-il quand tu es déjà en bas ?
6. LE CLAVIER MOBILE. À 390 px, touche le champ de saisie pour ouvrir le clavier virtuel. Le champ
   et le bouton « Envoyer » restent-ils visibles au-dessus du clavier, ou passent-ils dessous ?
7. 768 px. Traverse les onze écrans à cette largeur. Y a-t-il un débordement horizontal ? Un
   chevauchement ? Une colonne de texte trop large pour être lue confortablement ?

Rends : une liste numérotée de constats (gravité haute/moyenne/basse, mesure, capture), et une
liste SÉPARÉE et explicite de ce que tu n'as pas pu tester, avec la raison.
```

### Prompt 7 — Le compte abonné, et le refus du consentement

```
Tu es un testeur produit. Tu vas parcourir, dans Chrome, deux chemins qu'un tour précédent n'a pas
pu emprunter parce qu'ils sont destructifs ou payants. Tu ne modifies RIEN et tu ne proposes AUCUN
correctif.

⚠️ L'APPLICATION EST EN MODE PAIEMENT TEST : aucun euro ne sera débité. Utilise la carte de test
4242 4242 4242 4242, une date future, n'importe quel CVC.

── CHEMIN A : le refus du consentement, sur un compte DÉDIÉ
Crée un compte neuf avec une adresse en +refus1, va jusqu'à l'écran de consentement, et clique
« Je ne veux pas ».
1. Que se passe-t-il, exactement ? Capture chaque écran.
2. Le compte existe-t-il encore ? Peut-on se reconnecter avec cette adresse ? Que voit-on alors ?
3. La sortie est-elle expliquée, ou brutale ? Cite le texte exact.
4. Y a-t-il un moyen de revenir en arrière si on a cliqué par erreur ?

── CHEMIN B : l'arbre sur un compte ABONNÉ
Sur un compte neuf en +abonne1 : abonne-toi (69 €/an, carte de test), puis va dans la région
« L'arbre » et fais naître au moins deux branches en conversant avec Anam (les branches se posent
en conversation : demande-lui de nommer une prise de conscience).

L'arbre est censé respecter ceci — c'est là-dessus que tu le juges :
- Tronc trait 5px, couleur #6A6690. Racines 2,5px, larges et étalées. Branches 3,2px, #9A96BE.
- Feuillage #8FB6D8, en feuilles INDIVIDUELLES, opacités 0,78 à 1,0 — jamais un aplat.
- AUCUN BRUN, AUCUN VERT, aucune teinte d'automne, aucune feuille qui tombe.
- L'accent #8FC1EF n'apparaît QUE sur le point d'accroche cliquable d'une branche.
- Chaque point d'accroche a une zone tactile d'au moins 44×44 px.
- À la sélection d'une branche, le reste de l'arbre descend à opacité 0,55, SANS flou.
- L'arbre ne régresse jamais : une branche née reste à la même place, à la même échelle.

Mesure chaque point, à la pipette et au pixel, et capture en zoomant.
⚠️ Cherche ACTIVEMENT une découpe nette : une ligne droite ou un bord rectangulaire qui scierait
le feuillage ou le ciel. Un dégradé de lisibilité est le suspect.

Rends : les captures, une liste numérotée d'écarts (gravité, mesure), puis une demi-page de
directeur artistique sur l'arbre habité — est-il beau ? Ne me ménage pas.
```

### Prompt 8 — Le tour de non-régression

```
Tu es un testeur de non-régression. Onze corrections ont été déployées le 19 août 2026 après un
tour de QA. Tu vas vérifier, dans Chrome, que chacune tient — et surtout qu'aucune n'a cassé autre
chose. Tu ne modifies RIEN et tu ne proposes AUCUN correctif.

Le navigateur est connecté. Base : https://anima-app-swart.vercel.app/
Taille : mobile 390×844. Capture chaque vérification.

CE QUI DOIT ÊTRE VRAI MAINTENANT — vérifie-le une par une, et dis TIENT ou CASSÉ :

1. Sur /entrer : les liens « Conditions d'utilisation » et « Aide » font au moins 44 px de LARGE
   et 44 de HAUT. (Ils faisaient 139,8 × 43,4 et 27,7 × 43,4.)
2. Sur la scène : le lien « Aide » fait au moins 44 × 44. (Il faisait 43,7 × 44.)
3. Sur /memoire, /reglages, /mes-donnees, /abonnement, /lectures, /synthese : « Aide » fait au
   moins 44 × 44. (Il faisait 27,7 de large.)
4. Sur /memoire : la phrase d'introduction dit « de TES échanges », plus « de vos échanges ».
5. Sur l'écran d'accueil : l'étiquette « Mise en avant aujourd'hui » n'est PLUS bleue (#8FC1EF),
   elle est gris pervenche (#ABA6C9).
6. Sur l'écran d'accueil : les titres des cartes — « Tes nombres », « Le mantra du jour », « Ton
   ciel du jour », « Ton thème » — sont TOUS dans la même police (Fraunces, la serif). Ils étaient
   mélangés : deux en serif, deux en sans-serif grasse.
7. Sur l'écran d'accueil : le texte de la DERNIÈRE carte n'est plus coupé par la barre de
   navigation du bas. Fais défiler jusqu'en bas et regarde.
8. Sur tous les écrans : le fond du document, visible au rebond de défilement, est indigo
   (#0C0A1E) et non plus noir pur (#000000).
9. Sur le premier écran de la scène : la phrase d'accueil ne commence plus par « Bonsoir ».
10. Sur /reglages : il existe maintenant un lien « Conditions d'utilisation ». Clique-le : il mène
    bien à /cgu.
11. Sur /entrer : demande un code, puis RECHARGE la page. L'écran qui demande le code doit
    réapparaître, avec l'adresse affichée, et un lien « Recommencer ». (Avant, on repartait au
    formulaire d'adresse, avec un code en main et nulle part où le taper.)

PUIS, ET C'EST LE PLUS IMPORTANT : cherche ce que ces corrections ont pu CASSER.
Les changements ont touché les cibles tactiles (largeur minimale), la police des titres de cartes,
la réserve de hauteur en bas des régions, le fond de la racine, et l'anneau de focus de six
feuilles de style. Regarde donc particulièrement :
- des liens ou boutons devenus trop larges, mal alignés, ou qui se chevauchent ;
- des titres qui débordent ou passent à la ligne bizarrement ;
- un espace vide anormal en bas d'un écran ;
- un anneau de focus devenu invisible ou trop peu contrasté sur un fond clair.

Rends : le tableau des onze vérifications (TIENT / CASSÉ, avec la mesure et la capture), puis une
liste séparée de ce que tu as trouvé de neuf.
```

---

## 6. La règle qui gouverne tout ce document

Tout correctif issu de ces tours reçoit une garde qui **rougit quand on réintroduit le défaut** —
et cette garde n'est crue qu'après avoir vu son mutant mourir. Un test qui passe au vert après
correction ne prouve rien tant que le mutant survit.
