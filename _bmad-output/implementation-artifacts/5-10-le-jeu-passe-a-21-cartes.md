---
baseline_commit: a227d87bf72bc2e9e14d1d6f9f80b305ae787664
---

# Story 5.10 : Le jeu passe de 24 à 21 cartes

Status: review

## Story

En tant qu'Anima,
je veux que le jeu ne contienne que des images que je reconnais comme miennes,
afin que la commande d'art puisse être passée sur un jeu que j'assume — et pas sur les vingt-quatre
noms qu'un assistant a inventés à ma place en juillet.

**Couvre :** FR-015, FR-016, FR-022 · AD-11 · renvoi FR-054, FR-086.

---

## Ce que cette story livre, en une phrase

Le jeu passe de **24 à 21 cartes** — six retirées sur sa demande explicite, trois ajoutées depuis ses
réponses —, tous les inventaires suivent, et **deux gardes naissent** de la faute que cette story a
failli commettre : aucune carte ne peut plus nommer la même chose qu'une autre, et l'arithmétique qui
justifie l'échantillonnage par rejet cesse de vivre uniquement dans un commentaire.

---

## ⚠️ CETTE STORY CORRIGE UN ARBITRAGE PRIS IL Y A DEUX JOURS, ET LA CORRECTION EST LE CŒUR

Le 15/08/2026, en l'absence de ses réponses, la cible avait été fixée à **23 cartes** :
18 survivantes + `la fleur` + `une porte` + `un seuil` + `un chemin` + `un oiseau`. Le raisonnement
disait : *« les images qu'elle a elle-même nommées dans le brief. Rien d'inventé : on lui rend le jeu
qu'elle a décrit. »*

**Elle n'a rien nommé.** Le brief `ANIMA-A57H`, dans sa forme brute :

```json
question  visuel-symboles-oui   type: "multi"
options[3]  value: "seuil"    label: "Une porte, un seuil, un chemin"
options[5]  value: "oiseau"   label: "Un oiseau, un vol"

session.answers["visuel-symboles-oui"] = { "value": ["seuil", "oiseau"], "by": "sanela" }
```

La question était **« quelles images vous viennent naturellement quand vous pensez à votre
travail ? »**, à cases multiples, dix options. Elle en a coché **deux**. « Une porte, un seuil, un
chemin » est le **libellé d'une case, écrit par le questionnaire** — trois quasi-synonymes offerts
ensemble pour qu'une seule coche suffise à désigner la famille. Le lire comme trois propositions
distinctes, c'est faire dire à une réponse le contenu de la question.

Ce que la lecture fautive aurait produit :

| Ajout prévu | Ce qui existe déjà dans les 18 survivantes |
|---|---|
| `une porte` | **`porte-entrouverte`** — le même mot, avec un adjectif |
| `un chemin` | **`sentier`** — le même objet dessinable |
| `un seuil` | voisin des deux |
| `un oiseau` | *rien ne vole dans le jeu* — le seul vrai manque |

Un jeu à deux portes et deux chemins, avec **8 cartes sur 23 sur le thème du passage** (35 % —
`porte-entrouverte`, `sentier`, `carrefour`, `escalier`, `pont`, plus les trois ajouts), et
deux visuels quasi identiques dans une commande d'art de 69 objets. Aucun test du dépôt ne l'aurait
vu : rien ne vérifie que deux cartes ne nomment pas la même chose. **C'est de là que vient la garde
de la tâche T3.**

Et la bonne nouvelle est réelle, elle aussi : sa coche **valide** `porte-entrouverte` et `sentier`.
Le jeu parlait déjà sa langue sans qu'on l'ait su.

---

## Le jeu cible

**Les six retraits tiennent** — arbitrage du 15/08, inchangé et non rouvert ici : `puits`, `corde`,
`fontaine`, `nid`, `metier-a-tisser`, `orage`. Elle a coché « les images sombres, tristes ou
angoissantes » parmi ce qu'elle ne veut **jamais** voir, et une image résiste par son ambiguïté, pas
par sa noirceur.

```
LES 18 SURVIVANTES
  porte-entrouverte   pont            racine
  serrure             lanterne        sentier
  pierre-levee        barque          escalier
  fenetre             bourgeon        braise
  miroir-d-eau        mue             ruche
  carrefour           tamis           horizon

LES 3 AJOUTS
  fleur     ← son emblème, réponse directe à une autre question du brief
  oiseau    ← sa coche « Un oiseau, un vol » ; aucune carte ne volait
  seuil     ← une ligne au sol, sans porte dans le cadre

= 21 cartes · 63 objets à produire (21 visuels + 21 descriptions + 21 sens)
```

---

## Décisions

### D1 — 21, et la preuve tient dans le JSON brut du brief

`type: "multi"`, `value: ["seuil", "oiseau"]`. Deux coches. Le raisonnement complet est dans l'encadré
ci-dessus ; il est reporté ici parce qu'une story qui corrige un arbitrage doit porter la preuve du
correctif, pas seulement sa conclusion.

### D2 — `porte-entrouverte` et `sentier` sont VALIDÉS, pas remplacés

L'alternative examinée était de les **renommer** vers ses mots (`porte`, `chemin`). Écartée : les
clés du jeu ne sont jamais affichées (l'UX interdit de nommer la carte à l'écran), elles identifient
un visuel et une ligne de journal. Un renommage aurait invalidé toutes les lignes de `tirage`
existantes en base pour un gain purement cosmétique dans un fichier que personne ne lit.
`porte-entrouverte` est en outre **plus précis** que `porte` — l'entrebâillement est ce qui pose une
question au lieu d'y répondre.

### D3 — `seuil` entre, et cette story dit que c'est NOUS qui l'ajoutons

Elle n'a pas demandé le seuil séparément. On l'ajoute comme **image distincte de la porte** — une
ligne au sol, une dalle usée, sans porte dans le cadre : le lieu du franchissement sans l'objet qui
le permet. C'est un ajout **de notre main**, et il est inscrit comme tel dans la liste des
arbitrages à lui soumettre (`POUR-ANIMA-ce-qui-attend.md`). Si elle le refuse, le jeu tombe à 20 et
rien d'autre ne bouge — la seule chose qui bouge est un compte, et aucun compte n'est écrit en dur
dans le code de production.

### D4 — 21 et le tarot : envisagé, écarté, écrit

Le tarot compte 22 arcanes majeurs (0 à 21), dont **21 numérotés**. L'argument qui avait écarté 78 en
5.7 était : *« on aurait emprunté la structure d'un jeu du commerce en croyant n'emprunter qu'un
nombre »*. La coïncidence est donc notée. Elle est écartée : un nombre ne porte pas une structure
— il n'y a ni numérotation, ni ordre, ni hiérarchie, ni famille dans ce jeu, et `JEU` documente
explicitement que son ordre n'a aucun sens. La garde qui compte est celle des **noms**
(`tests/jeu-proprietaire.test.ts`, 36 termes empruntés, prouvée sur un faux jeu), et elle ne bouge
pas.

### D5 — `tirage-alea.test.ts` NE BOUGE PAS, et ce n'est pas un oubli

Le fichier écrit ses bornes en dur — **3, 24 et 40** — et documente pourquoi : *« emprunter la borne
à `TAILLE_JEU` rendrait la garde otage du jeu »*. Le `24` qu'on y lit est une **borne d'essai
choisie**, pas la taille du jeu. La remplacer par 21 serait exactement ce que la note de
`deferred-work.md` demandait d'éviter : *« il faut le dire dans la story pour que personne ne
"répare" ce qui va bien »*.

Seuls les **commentaires narratifs** de ce fichier bougent, et uniquement là où ils laissent croire
que 24 est la taille du jeu.

### D6 — L'arithmétique des commentaires passe SOUS TEST, parce qu'elle était fausse

`lib/tirage/alea.ts:10` affirme :

> `2**32 = 178 956 970 × 24 + 8`, donc les 8 premiers indices ont une chance de plus que les 16 autres

Les deux chiffres sont faux et le sens est inversé : `178 956 970 × 24 = 4 294 967 280`, donc le reste
vaut **16**, et ce sont **16** indices qui ont une chance de plus que les 8 autres. Le fichier voisin
`tests/tirage-alea.test.ts:13` porte la bonne version. L'écart relatif annoncé (`1,4 · 10⁻⁸`) est faux
lui aussi dans les deux fichiers : il vaut `1 / 178 956 970 ≈ 5,6 · 10⁻⁹`.

Aucun test ne l'a vu **parce que les commentaires ne sont pas exécutés** — et c'est le commentaire qui
porte toute la justification de l'échantillonnage par rejet, dans le fichier dont c'est le seul sujet.

La correction ne suffit pas : on ajoute une assertion qui **exécute les nombres cités**
(`2 ** 32 % 21 === 4`, `2 ** 32 % 24 === 16`, `2 ** 32 % 32 === 0`). Un commentaire dont l'arithmétique
est asservie à un test ne peut plus dériver en silence.

Pour 21 : `2**32 = 204 522 252 × 21 + 4` — **4** indices sur 21 ont une chance de plus que les
17 autres, écart relatif `1 / 204 522 252 ≈ 4,9 · 10⁻⁹`. La zone de rejet reste **non vide**, donc le
chemin de rejet est réellement emprunté en production, ce qui était le seul des trois arguments de
`jeu.ts` à porter une propriété technique.

### D7 — Aucune migration SQL, et c'est vérifié plutôt que supposé

Vérifié le 14/08 puis re-vérifié ici : **aucune migration ne nomme une clé de carte**. La colonne
`tirage.carte` est du texte libre ; `taille_jeu` est journalisée avec chaque tirage (0050) précisément
pour que l'audit des lignes anciennes reste exact après un changement de taille — `rejouer(graine,
taille_jeu_de_la_ligne)`, jamais avec la taille courante. **Cette story est la première à exercer
pour de vrai la raison d'être de cette colonne.**

Conséquence à écrire noir sur blanc : **les lignes de `tirage` déjà en base qui portent une carte
retirée restent valides et rejouables.** On ne les touche pas. Une lecture ancienne sur `puits` se
rejoue correctement avec `taille_jeu = 24`.

### D8 — `puits.webp` sort de `public/jeu/`, et une garde d'orphelin naît

C'est le **seul visuel dessiné du jeu**, et c'est l'une des six retirées. Il reste au dépôt comme
unique référence de style pour la commande d'art — mais pas sous `public/jeu/`, où il serait un
visuel servi publiquement pour une carte qui n'existe plus, à une adresse devinable.

Il part vers `images/reference-jeu/` (hors de `public/`, donc non servi). Et
`tests/jeu-proprietaire.test.ts` gagne la garde **inverse** de celle qui existe : aujourd'hui le test
vérifie que *chaque clé déclarée a un fichier* ; il vérifiera aussi que **chaque fichier de
`public/jeu/` est une carte du jeu**. C'est la garde qui aurait crié toute seule ici.

### D9 — La garde anti-doublon, tirée de la faute de cette story

Deux mécanismes, parce qu'un seul ne suffit pas :

1. **Mécanique** — aucune clé n'est une sous-chaîne d'une autre après normalisation. `porte` ⊂
   `porte-entrouverte` aurait été attrapé par là, sans qu'aucun humain ait à y penser.
2. **Déclaré** — une table de familles de synonymes (`chemin`/`sentier`/`voie`/`route`,
   `porte`/`portail`/`huis`, …) qu'aucune paire de cartes ne peut satisfaire ensemble. `chemin` vs
   `sentier` n'est pas mécaniquement détectable ; il faut le dire une fois.

Les deux sont prouvés **sur un faux jeu**, comme le reste du fichier : sans preuve sur faux, une
garde sur 21 clés déjà propres est verte sans rien démontrer.

### D10 — Ce que 21 coûte, dit franchement

Un doublon de tirage passe d'une fois sur 24 à **une fois sur 21**. C'est le seul argument de la 5.7
qui s'affaiblit, et il s'affaiblit peu. L'unicité de `lecture.tirage_id` et l'index partiel de 0051
continuent d'empêcher de tirer dix fois pour choisir la carte qui plaît ; ce dont on parle ici, c'est
seulement la répétition d'une image d'un mois sur l'autre.

---

## Acceptance Criteria

### AC1 — Le jeu contient exactement les 21 cartes décidées

**Étant donné** `lib/tirage/jeu.ts`, **quand** le module est chargé, **alors** `CLES_JEU` vaut
exactement les 18 survivantes + `fleur` + `oiseau` + `seuil`, **et** aucune des six clés retirées n'y
figure, **et** `TAILLE_JEU` vaut 21 sans qu'aucun 21 ne soit écrit en dur dans le code de production.

### AC2 — Aucune carte ne nomme la même chose qu'une autre

**Étant donné** le jeu, **quand** la garde s'exécute, **alors** aucune clé n'est une sous-chaîne
normalisée d'une autre, **et** aucune paire de clés n'appartient à la même famille de synonymes
déclarée, **et** les deux détecteurs sont prouvés sur un faux jeu portant `porte` et
`porte-entrouverte`, puis `chemin` et `sentier`.

### AC3 — L'échantillonnage reste uniforme et prouvé

**Étant donné** la nouvelle taille, **quand** les gardes d'aléa s'exécutent, **alors** la zone de
rejet est non vide (`2**32 % 21 = 4`), **et** les bornes déterministes du §1 de
`tests/tirage-alea.test.ts` restent 3/24/40 sans emprunt à `TAILLE_JEU`, **et** l'arithmétique citée
dans les commentaires est **assertée** par un test qui rougit si un chiffre dérive.

### AC4 — Les corpus suivent le jeu, sans qu'une liste ait été recopiée

**Étant donné** `sens-cartes.ts` et `description-cartes.ts`, **quand** ils sont chargés, **alors**
chacun déclare exactement 21 créneaux dérivés de `CLES_JEU`, tous `non_ecrit`, **et** aucun créneau
orphelin ne subsiste, **et** `lireSensCarte` / `lireDescriptionCarte` jettent sur une clé retirée
(erreur de compilation) comme sur une clé inconnue (erreur d'exécution).

### AC5 — Le manifeste des visuels ne ment ni dans un sens ni dans l'autre

**Étant donné** `public/jeu/`, **quand** la garde s'exécute, **alors** chaque clé déclarée dessinée
correspond à un fichier présent ET à une carte du jeu (garde existante), **et** chaque fichier présent
sous `public/jeu/` correspond à une carte du jeu (garde nouvelle), **et** le répertoire ne contient
plus `puits.webp`, **et** le contrôle est prouvé sur un faux répertoire.

### AC6 — Les inventaires disent le vrai

**Étant donné** `lib/corpus/README.md`, **quand** on le lit, **alors** le total déclaré vaut **186**
(69 + 60 + 27 + 9 + 21), **et** la ligne des descriptions vaut 21, **et** aucun commentaire du code de
production n'annonce encore 24 cartes.

### AC7 — Les lignes de tirage déjà en base restent rejouables

**Étant donné** une ligne de `tirage` portant `carte = 'puits'` et `taille_jeu = 24`, **quand** l'audit
la rejoue, **alors** `rejouer(graine, 24)` rend l'indice d'origine, **et** rien dans la story n'écrit,
ne migre ni ne supprime une ligne existante.

### AC8 — Rien d'autre n'a bougé

**Étant donné** la suite complète, **quand** elle s'exécute après `supabase db reset`, **alors** tout
est vert, **et** `tsc` / `eslint` / `next build` sont propres, **et** aucune migration n'a été ajoutée.

---

## Tasks / Subtasks

- [x] **T1 — La story** (ce fichier)
- [x] **T2 — `lib/tirage/jeu.ts`** : le type `CleCarteJeu`, le tableau `JEU`, et la réécriture
      complète de l'en-tête « POURQUOI 24 » → « POURQUOI 21 », avec l'arithmétique juste.
- [x] **T3 — Les deux gardes nouvelles** dans `tests/jeu-proprietaire.test.ts` : anti-doublon
      (sous-chaîne + familles de synonymes) et orphelin de `public/jeu/`, chacune prouvée sur faux.
      Plus l'assertion d'arithmétique dans `tests/tirage-alea.test.ts`.
- [x] **T4 — `public/jeu/puits.webp`** → `images/reference-jeu/puits.webp`.
- [x] **T5 — Les tests qui citent une clé retirée** : `depot-lecture` (×4), `lecture-frontiere` (×2),
      `lecture-sql` (×4), `tirage-sql` (×1), `description-cartes` (×1) — remplacées par une clé
      survivante, **sauf** celles qui doivent délibérément exercer une carte historique (AC7).
      Plus les comptes en dur : `jeu-proprietaire:167`, `description-cartes:52`.
- [x] **T6 — Les inventaires et les commentaires** : `sens-cartes.ts`, `description-cartes.ts`,
      `render/lecture/visuels.ts`, `lib/tirage/alea.ts`, `lib/tirage/tirer.ts`,
      `lib/corpus/ancrage.ts`, `lib/corpus/README.md`.
- [x] **T7 — Vérification et mutation** : `db reset`, suite complète, `tsc`, `eslint`, `next build`,
      puis campagne de mutation ciblant les deux gardes nouvelles (une garde née dans cette story doit
      tuer son mutant, ou elle n'existe pas).
- [x] **T8 — Les documents** : `deferred-work.md` (la section « le jeu passe à 23 » devient l'histoire
      de la correction), `POUR-ANIMA-ce-qui-attend.md` (l'arbitrage à lui soumettre change de forme),
      `PORTES-AVANT-PUBLICATION.md` (63 objets au lieu de 72), `sprint-status.yaml`.

---

## Dev Notes

**Ce qui ne doit surtout pas être « réparé » :**

- les bornes 3/24/40 de `tests/tirage-alea.test.ts` (D5) ;
- `TAILLE_JEU`, qui est dérivé de `JEU.length` et ne s'écrit jamais en dur — c'est exactement le cas
  pour lequel il avait été dérivé en 5.7 ;
- la garde `TAILLE_JEU < 2`, qui reste satisfaite ;
- les lignes de `tirage` en base (D7).

**Les comptes écrits en dur, et pourquoi ils le restent.** `jeu-proprietaire:167`
(`CLES_JEU.length - VISUELS_DESSINES.size`) et `description-cartes:52` (`clesNonEcrites(...).length`)
sont des **inventaires de porte pré-lancement** : leur rôle est précisément de rougir quand le compte
bouge, pour qu'aucun changement de jeu ne passe inaperçu. Ils sont donc mis à jour à la main, pas
dérivés.

**Le piège du corpus vide, déjà payé deux fois en 5.4.** Les 21 sens et les 21 descriptions sont tous
`non_ecrit`. Toute assertion sur leur CONTENU est vacue. Chaque balayage reste doublé d'une preuve sur
faux.

---

## Dev Agent Record

### Debug Log

**Deux tests que j'ai dû réparer avant qu'ils ne prouvent quoi que ce soit.**

1. **La garde d'orphelin était vacue.** `public/jeu/` ne contenant plus que `.gitkeep`, remplacer la
   lecture du disque par un `[]` littéral donnait exactement le même verdict — la garde « aucun
   orphelin » était verte sur un répertoire qu'elle ne regardait pas. C'est le piège du corpus vide
   de la 5.4, transposé au système de fichiers. Correctif : asserter l'inventaire BRUT
   (`expect(fichiers.sort()).toEqual([".gitkeep"])`), au même titre que `VISUELS_DESSINES.size`.
   **Trouvé par le mutant M11, pas par une relecture.**

2. **Le contrôle d'extension ne se distinguait pas de son absence.** Le faux répertoire de la preuve
   ne contenait aucun cas où `slice(0, -5)` produit une clé VALIDE à partir d'une mauvaise extension.
   Retirer `endsWith(".webp")` laissait donc la garde verte. Ajouté `fleur.jpeg` — `.jpeg` fait
   exactement cinq caractères. **Trouvé en CONCEVANT le mutant M10, avant de l'exécuter.**

**Deux défauts du harnais de mutation lui-même, dont un grave** (consignés dans `deferred-work.md`) :

- un mutant qui **ne compile pas** fait imprimer `Test Files N failed` **sans** ligne `Tests N
  failed` ; le harnais lisait la ligne `Tests` seule et concluait **SURVIT**. Il accusait donc une
  garde alors que le mutant n'avait jamais tourné. C'est le miroir de la faute de la 6.1a, en pire :
  un faux mort rassure à tort, un faux survivant envoie réécrire une garde qui allait bien ;
- le heredoc ajoutait un saut de ligne final au texte de remplacement, qui atterrissait au milieu
  d'une expression — c'est ce qui rendait M13 incompilable, donc faussement survivant.

Après correction : **M13 est tué par quatre fichiers nommés.**

**Ce que je n'ai PAS touché, et qui a été vérifié plutôt que supposé :** aucune migration ne nomme
une clé de carte (D7) ; les bornes 3/24/40 de `tirage-alea.test.ts` (D5) ; les fixtures `puits` /
`tailleJeu: 24` de `depot-lecture` et `lecture-frontiere`, désormais commentées comme délibérées.

### Completion Notes

| | |
|---|---|
| Suite complète | **234 fichiers / 3876 tests** (+10) |
| `tsc` · `eslint` · `next build` | propres |
| Migrations ajoutées | **zéro** |
| Mutation | **14 mutants — 13 tués, 1 mal posé** |

Le seul « survivant » (M12) retire une assertion d'un test : aucune autre assertion ne le couvre,
**par construction**. Le mutant bien posé pour une assertion porte sur son SUJET — c'est M11, qui
meurt. Compté comme mal posé plutôt que masqué ou déguisé en équivalent.

Les mutants tués couvrent les deux gardes nouvelles séparément (détecteur mécanique M3–M5, détecteur
déclaré M6–M8, orphelin M9–M11), la liste elle-même (M1 une carte en moins, M2 un doublon d'entrée,
M13 une carte en plus) et un contrôle de non-régression sur l'échantillonneur de la 5.7 (M14).

**Ce qui reste ouvert :** un seul arbitrage pour Anima — garde-t-on `seuil` ? Si non, 20 cartes, et
aucune autre ligne ne bouge.

### File List

**Production** — `lib/tirage/jeu.ts` (la liste, le type, la justification), `lib/tirage/alea.ts`
(arithmétique corrigée), `lib/tirage/tirer.ts`, `lib/lecture/sens-cartes.ts`,
`lib/corpus/description-cartes.ts`, `lib/corpus/ancrage.ts`, `lib/corpus/README.md`,
`lib/domain/consigne-lecture.ts`, `lib/ai/flux-ndjson.ts`, `render/lecture/visuels.ts`.

**Actifs** — `public/jeu/puits.webp` → `images/reference-jeu/puits.webp` ; `public/jeu/.gitkeep`.

**Tests** — `tests/jeu-proprietaire.test.ts` (deux gardes nouvelles), `tests/tirage-alea.test.ts`
(§0 arithmétique), `tests/tirage-architecture.test.ts`, `tests/tirage-frontiere.test.ts`,
`tests/tirage-sql.test.ts`, `tests/description-cartes.test.ts`, `tests/corpus-architecture.test.ts`,
`tests/depot-lecture.test.ts`, `tests/lecture-frontiere.test.ts`, `tests/lecture-sql.test.ts`,
`tests/rendu/carte-tiree.test.tsx`.

**Documents** — `deferred-work.md`, `POUR-ANIMA-ce-qui-attend.md`, `PORTES-AVANT-PUBLICATION.md`,
`sprint-status.yaml`.

### Change Log

| Date | Ce qui a changé |
|---|---|
| 2026-08-15 | Story créée. Cible **21** au lieu des 23 arbitrés le 15/08 — le brief a été relu dans sa forme brute. |
| 2026-08-15 | Livrée. 13/14 mutants tués ; deux gardes nouvelles ; deux défauts du harnais de mutation corrigés et consignés. |
