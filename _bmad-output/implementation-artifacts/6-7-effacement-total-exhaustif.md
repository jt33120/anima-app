---
baseline_commit: e3a40ae
---

# Story 6.7 : L'effacement total exhaustif — propagé aux sous-traitants et au PITR

Status: review

## Story

En tant qu'utilisatrice,
je veux tout effacer sans friction dissuasive, avec la certitude que l'effacement marche vraiment —
jusqu'aux sous-traitants et aux sauvegardes —,
afin de pouvoir partir complètement.

**Couvre :** FR-067 (suppression totale, prime sur FR-029) · AD-14 (moteur unique, exhaustif,
propagé), AD-4 (frontière art. 9), NFR-002, NFR-003 · renvoi FR-071 (l'effacement d'un compte barré).

---

## Ce que cette story livre, en une phrase

Un moteur unique qui efface pour de vrai — et une manière de le PROUVER : on sème une utilisatrice
dans les trente-et-une tables qui la nomment, on efface, puis on cherche son identifiant **dans les
trente-six tables du schéma**.

---

## Les décisions

### D1 — La trace doit survivre à la personne, donc elle ne peut pas être dans `audit_securite`

L'AC5 demande que l'opération soit journalisée. Or `audit_securite` — le registre où vivent toutes
les autres traces — porte `utilisatrice_id … on delete cascade` : **la trace de l'effacement aurait
été effacée par l'effacement**, dans la même transaction. On aurait gardé la preuve de tout sauf du
seul geste qu'un responsable de traitement doit pouvoir prouver.

D'où une table à part, `effacement`, **sans aucune clé étrangère**. Elle ne porte pas son
identifiant mais son **empreinte** (sha256) : une fois l'identifiant disparu de partout, l'empreinte
ne se remonte plus. C'est ce qu'on peut garder sans garder personne.

### D2 — L'ordre du moteur n'est pas laissé à la cascade

Mesuré sur le schéma : sur les 38 clés étrangères, **une seule** n'est pas en cascade —
`branche_extrait_meme_proprietaire`, en `on delete restrict`. C'est elle qui tient l'AC4, et elle
est bonne. Mais elle rend la cascade fragile : supprimer `auth.users` cascade vers `branche` **et**
vers `entree_journal`, et l'ordre entre les deux dépend de l'ordre de création des contraintes. Si
le journal part le premier, le `restrict` mord et **tout l'effacement échoue**.

Le moteur retire donc les branches explicitement, en premier. C'est ce que veut dire « la
suppression prime sur FR-029 » : la monotonie de l'arbre est un invariant du produit qui fonctionne,
pas une objection au droit à l'effacement.

⚠️ **Cette ligne ne peut pas être prouvée par un test qui efface** — voir plus bas.

### D3 — L'identité d'auth part aussi

Une ligne `auth.users` ne portant qu'une adresse est encore une donnée à caractère personnel. Partir
complètement, c'est aussi ne plus pouvoir se reconnecter. Vérifié que le propriétaire de la fonction
(`postgres`) a bien le privilège `DELETE` sur `auth.users` **sur le projet cloud**, pas seulement en
local — c'était le vrai risque de cette décision.

### D4 — La propagation aux sous-traitants est un registre à verdicts, pas un commentaire

L'AC2 est marquée [DUR]. La réponse facile aurait été une phrase disant que le fournisseur IA est en
zéro-rétention. Une phrase ne casse aucun build et vieillit sans bruit.

`lib/domain/sous-traitants.ts` donne à chacun un verdict dans un ensemble fermé, et **chaque verdict
désigne ce qui le rend vrai** — un fichier de garde qui doit exister, ou une porte pré-lancement qui
doit être inscrite au suivi de sprint. Les deux sont vérifiés à chaque exécution de la CI.

| | verdict | ce qui le rend vrai |
|---|---|---|
| le modèle | `rien_retenu` | l'egress-guard **refuse l'envoi** sans `estZdrProuve()` |
| la base | `fenetre_bornee` | `effacement.survivance_jusqu_au` + la contrainte de table |
| le paiement | `retention_legale` | porte `conservation-comptable` |
| le courriel | `aucun_art9` | `tests/courriel-origine.test.ts` |
| l'hébergement | `aucun_art9` | `tests/routes-art9-entetes.test.ts` |
| la transcription | `non_lie` | porte `sous-traitant-transcription` |

**Ce que l'effacement ne peut pas retirer est DIT à l'écran**, et la phrase est *fabriquée* depuis ce
registre : le jour où la liste change, l'écran change avec elle.

### D5 — La fenêtre PITR est un paramètre, sa borne est une contrainte de table

AD-14 : « échéances paramétrées, jamais codées en dur ». La fenêtre est lue à l'exécution
(`EFFACEMENT_FENETRE_PITR_JOURS`, 7 j par défaut) et passée **en argument**. Sa borne (0–35 j) est un
`check` de table — donc elle lie aussi `service_role`, que la RLS ne borne pas.

⚠️ **Une valeur illisible retombe sur le défaut, elle ne lève pas.** Le repli habituel de ce dépôt
penche vers le moins d'effet ; ici l'inverse est le bon sens : refuser d'effacer parce qu'une
variable est mal écrite ferait d'une faute de frappe un refus de droit.

### D6 — Une confirmation, sur le même écran, et pas d'îlot client

Une case et un bouton, dans le même formulaire. Aucune sous-route (une garde le vérifie), aucun
`useState`, aucun JavaScript. Un échec renvoie sur la halte avec un motif — **jamais un écran d'adieu
sur un effacement qui a échoué**, qui serait le pire mensonge que ce produit puisse dire.

L'adieu, sur `/entrer`, est en **registre produit** : faire parler Anam après un effacement serait
la dernière tentative de retenir quelqu'un qui vient de tout retirer.

---

## L'inventaire d'effacement est DISTINCT de celui de l'export

La 6.6 l'avait écrit noir sur blanc, et l'exemple n'est pas théorique : **`execution_job` porte un
`cible_id` qui peut être son identifiant**. Elle ne lui apprend rien — la ligne dit « tel job a
tourné » —, donc elle est **hors export** ; elle doit pourtant disparaître, parce qu'une trace
nominative de traitement reste une donnée la concernant. Un inventaire commun aurait tranché les deux
d'un seul geste, et c'est cette table-là qu'on aurait perdue. Un test le garde explicitement.

---

## Dev Agent Record

### Ce que la campagne de mutation a trouvé

**24 mutants, 24 tués** — en deux passages. Trois survivants au premier :

| | ce que c'était |
|---|---|
| **M1** | un mutant **mal écrit** de ma part : il préfixait un insert vide et gardait l'original. Réécrit. |
| **M4** | **le piège des défenses redondantes.** « Une fenêtre négative est refusée » était vrai *sans* la garde de la fonction : la contrainte `survivance_jusqu_au >= demande_le` refusait l'insertion de toute façon. Deux défenses qui se couvrent l'une l'autre, et un test incapable de dire laquelle a mordu. Le test exige désormais le motif `fenetre_invalide` — ce qui distingue le refus paramétré du refus par ricochet, et donne au passage ce qui compte : qu'un opérateur lise « ton paramètre est faux » plutôt qu'une violation de contrainte sur une colonne qu'il n'a pas écrite. |
| **M21** | **un vrai trou.** La phrase « ce qui ne peut pas partir » vivait dans le JSX derrière un `RETENUS_PAR_LA_LOI.length > 0 &&`. Remplacer la condition par `false` taisait la rétention légale **sans** faire disparaître le nom du registre du fichier — et la garde ne regardait que ça. La phrase a quitté la page pour `lib/domain`, où elle est une valeur qu'on éprouve. |

### La ligne qu'aucun test comportemental ne peut prouver

Mesuré : retirer `delete from public.branche` laisse `effacement-sql.test.ts` **vert** — la cascade
d'aujourd'hui passe. Seule la garde structurelle le tue.

Ce n'est pas une faiblesse du test, c'est la nature de la ligne : **une assurance ne se prouve pas en
observant le beau temps.** Une garde interdit par ailleurs qu'une deuxième clé `on delete restrict`
apparaisse sans que le moteur ne retire sa table explicitement.

### Deux gardes existantes ont mordu, et on les a suivies

`faits-architecture` / `rappel-architecture` refusaient les littéraux de table dans le nouvel
inventaire : l'exclusion (déjà posée en 6.6) couvre maintenant les deux inventaires, et se **prouve**
à chaque exécution. `cible-tactile` refusait une case à cocher dimensionnée à la main (18 px) : la
cible est désormais portée par le **label**, sur toute la ligne, comportement natif.

### Vérification

- **259 fichiers / 4392 tests** verts ; `tsc --noEmit`, `eslint .`, `next build` propres
- `supabase db reset` : 0001 → 0058 appliquées
- **Cloud** : parité 58 / 58 / 58 ; fonction `security definer`, propriétaire `postgres`,
  exécutable par `authenticated`, **refusée à `anon`**, et **`postgres` a bien `DELETE` sur
  `auth.users` sur le projet cloud** — la vérification qui décidait de la faisabilité de D3
- `effacement` : 0 clé étrangère, contrainte de borne présente

### Dette laissée, et elle est nommée

- **Le crypto-shredding n'est pas construit.** AD-14 autorise deux branches (fenêtre PITR courte OU
  clé par utilisatrice détruite à l'effacement) ; on tient la première. La seconde reste ouverte.
- **La fenêtre PITR réellement réglée sur le projet hébergé est un réglage d'infrastructure**, pas
  du code. Porte pré-lancement inscrite : ce que le produit *annonce* et ce que l'hébergeur *fait*
  doivent coïncider, et seul un humain peut le vérifier.
- **`conservation-comptable`** : confirmer la durée de conservation des pièces chez le prestataire de
  paiement, et que l'effacement d'un compte ne les touche pas.
- **`sous-traitant-transcription`** : aucun prestataire n'est lié ; en lier un exigera un DPA art. 28
  + ZDR **et** un verdict de propagation.

---

## Change Log

| Date | Ce qui change |
|---|---|
| 2026-08-16 | Story livrée. Migration 0058 déployée cloud. 24/24 mutants tués. |
