# QA tour 1 (2026-08-15) — le solde des 31 trouvailles

**Établi le 2026-08-18.** Les 31 trouvailles du rapport `QA_testing/extrait/anima-qa-2026-08-15/`
étaient suivies **éparpillées** dans `sprint-status.yaml`, au fil des stories qui les rencontraient.
Nulle part on ne pouvait lire « où en est-on ». Ce document est ce solde.

**Méthode : chaque statut a été VÉRIFIÉ DANS LE CODE, pas relu dans une note de story.** Là où la
vérification n'est pas possible sans navigateur ni séance réelle, c'est écrit.

---

## En une ligne

**19 fermées · 11 ouvertes · 1 arbitrée.** Aucune des 11 ouvertes n'empêche un test ; quatre d'entre elles ne peuvent être ni vues ni fermées autrement qu'**en conditions réelles** — ce qui est
précisément l'objet du prochain tour.

---

## Fermées (18)

| | Trouvaille | Ce qui l'a fermée, et comment je l'ai vérifié |
|---|---|---|
| T2 | Aucun moyen de s'abonner | Story 3.6 — `PRIX_ABONNEMENT_ANNUEL_EUROS = 69` et l'offre rendue sur `/abonnement` |
| T3 | La conversation disparaît au rechargement | `app/page.tsx` charge `historique` dans son `Promise.all` |
| T5 | Anam prétend ressentir une émotion | `lexique-interdit.ts` couvre `contente / fière / heureuse / ravie / triste / désolée / émue / touchée`, intensifs compris — et son commentaire cite la phrase exacte de la QA |
| T6 | Courriels d'authentification en anglais | Mesuré sur la config Auth de production : `mailer_subjects_magic_link = « Ton lien pour entrer »`, `confirmation = « Confirme ton adresse »`, gabarits HTML personnalisés. Les autres gabarits restent anglais — ils ne sont **jamais envoyés** (ni mot de passe, ni téléphone, ni MFA, ni invitation dans ce produit) |
| T7 | Mention IA sur 1 écran / 6 | Story 6.9 — `PiedHalte` sur **10 écrans**, la présence décidée par `lib/domain/pied-halte.ts` |
| T11 | Aucun service worker | `sw.js` servi, enregistrement câblé (`Reglages.tsx`) — T11-quater soldée le 16/08 |
| T12 | Page 404 de Next, en anglais | `app/not-found.tsx` existe, et la production rend bien un 404 maison (sondé) |
| T13 | 7 s sans signe de vie | Story 6.9 — ⚠️ **à reconfirmer à l'écran** : le correctif est posé, la mesure ne l'a pas été |
| T14 | Deux espaces manquants (texte à portée juridique) | Source correct aujourd'hui (`</strong> au sens de…`) — ⚠️ **à reconfirmer au rendu** |
| T15 | `/reglages` et `/abonnement` avant consentement | `if (etape === "consentement") redirect("/consentement")` présent sur les deux |
| T17 | L'heure de naissance jamais corrigeable | Story 6.5b |
| T18 | Commune non reconnue : bouton inerte, sans un mot | **Fermée le 18/08** — le motif du blocage est écrit, et distingue « rien tapé » de « tapé mais non reconnu » |
| T19 | Une date invalide vide tous les champs | **Fermée le 18/08** — l'action renvoie la saisie, les champs la reprennent |
| T20 | « Deux façons » suivi de trois options | Déjà corrigée : `etat.exaequo.length === 2 ? "Deux" : "Plusieurs"` |
| T22 | Aucun moyen de se déconnecter | **Fermée le 18/08** |
| T25 | `/ancrages` vend pendant la détresse | Revue Epic 5, R2 |
| T9 | Un rectangle plus clair autour du personnage du Seuil | **Fermée le 18/08** — mesurée au pixel dans un navigateur réel : saut de couleur de **56 en un pixel** avant, **≤ 5** après. Deux causes : `aspect-ratio: 4 / 5` sur une image en 0,767 (`object-fit: contain` laissait 6 px de bandes, et le masque est calculé sur la boîte), et un dégradé radial qui ne touchait jamais les flancs |
| T30 | Le 3919 sous un libellé périmé | **Fermée le 18/08** — et un test garde désormais les six appellations |
| T31 | L'erreur de consentement ne s'efface pas | **Fermée le 18/08** — plus **T31-bis**, trouvée en la corrigeant |

### T31-bis — trouvée en écrivant le test de T31, et plus grave qu'elle

React 19 **réinitialise le DOM du formulaire** après chaque action. Les deux cases de consentement
sont contrôlées : leur état React reste `true`, et React ne réécrit pas une propriété DOM dont la
valeur rendue n'a pas changé.

Mesuré : après un envoi qui échoue, `[false, false]` à l'écran pendant que `pret` vaut vrai. Sur
l'écran de consentement art. 9, ça donne **deux cases visuellement décochées, « Je commence » actif,
aucun motif de blocage** — et un nouveau clic postait un `FormData` vide, à quoi le serveur répondait
« Coche les deux accords pour continuer. » à quelqu'un qui venait de les cocher.

L'écran le plus sensible du produit affichait le contraire de ce qu'il croyait.

---

## Ouvertes (12)

### Que seule une séance réelle peut fermer — 4

| | Trouvaille |
|---|---|
| T4 | Le filet de détresse s'est déclenché sur « on parlait de mon travail et de ma sœur » |
| T8 | Anam refuse de tirer une carte, alors que `/lectures` invite à lui en demander une |
| T16 | « Je n'ai pas pu répondre » — 2 fois sur ~14 envois, sans trace réseau |
| T24 | Aucune branche n'a jamais été proposée en 12 échanges ; l'arbre est resté vide |

Ce sont des comportements de **modèle** et de **parcours**, pas des lignes de code fautives. Aucun
test unitaire ne les produit — c'est pour ça qu'ils sont encore là.

### Que seul un navigateur peut voir — 2

| | Trouvaille |
|---|---|
| T26 | ⚠️ **La plus sérieuse.** Au moment de la détresse, le fil se cale sur la carte de ressources : ce que la personne vient d'écrire sort de l'écran |
| T10 | À 390 px, la barre de navigation est transparente et recouvre le contenu qui défile dessous |

### Hors code — 3

| | Trouvaille |
|---|---|
| T1 | Les CGU se déclarent « version provisoire » et il faut les cocher pour entrer (porte §6) |
| T23 | Ni mentions légales ni politique de confidentialité (porte §6) |
| T27 | Aucune page publique : la racine redirige vers la porte — décision produit, pas défaut |

### Petites, non traitées — 2

| | Trouvaille | Pourquoi pas aujourd'hui |
|---|---|---|
| T21 | Apostrophes droites sur presque toute l'interface | **MESURÉ le 18/08 : 486 droites contre 13 courbes dans les chaînes affichées** (commentaires retirés ; le compte brut de 10 458 sur `lib+render+app` était trompeur — il comptait les commentaires français). C'est borné et faisable d'un bloc. Reporté quand même : churner 486 chaînes juste avant un tour de QA rendrait ce tour illisible, et beaucoup de tests assertent des phrases exactes. À faire APRÈS le tour 2, en une passe |
| T28 | Message de validation natif en anglais | Le correctif (`noValidate` + messages du produit) touche le chemin d'entrée, le plus critique du produit. À faire avec un tour de vérification, pas à l'aveugle |

---

## Arbitrée (1)

**T29 — « Prends soin de toi ».** La QA signalait sans trancher. La revue Epic 5 (R3) a tranché :
**la règle s'applique aussi au texte généré.** `chercherInterdits("Prends soin de toi.")` rend
`soigner`, et depuis R3 la restitution de lecture n'est **pas gravée** si le contrôle relève un
manquement — on refuse d'écrire, on ne tronque pas.

---

## Ce que ce solde dit du dispositif de test

**Sept des douze trouvailles ouvertes sont invisibles à la suite de tests, par construction** — quatre
demandent une séance réelle, trois un navigateur. Le dépôt compte 4 696 tests et **aucun dans un
navigateur** : les projets `node` et `rendu` (jsdom) ne voient ni la mise en page, ni le défilement,
ni le temps d'attente réel.

T31-bis est l'exception qui le prouve : elle a été trouvée dès qu'on a **monté un composant** au lieu
de lire du source. Ce n'est pas un argument pour une suite de navigateur — si le web est un banc
d'essai avant une application mobile, elle serait jetée — c'est un argument pour **un second tour de
QA humaine**, avec ce document comme référence.
