# Le corpus numérologique — 69 textes à écrire

**Pour Anima.** Ce document liste, un par un, les textes d'interprétation dont l'application a
besoin. Personne d'autre ne peut les écrire : ni Anam, ni un modèle de langage, ni un texte acheté
ou repris ailleurs. C'est écrit noir sur blanc dans le cahier des charges du produit (FR-054), et
doublé d'une règle qui protège ton nom : **une parole attribuée à Anima et qu'Anima n'a pas dite est
un défaut critique** (FR-086).

Le code est prêt et il attend. Aujourd'hui, l'application calcule les nombres justes et dit
honnêtement, pour chacun : *ce texte n'est pas encore écrit*. Elle ne bouche pas le trou avec du
générique.

---

## Comment ça marche, concrètement

Chaque texte remplit **un créneau**, identifié par un nombre et une valeur. Par exemple le créneau
`chemin_de_vie:7` reçoit le texte qui parle du chemin de vie 7.

Tu peux les écrire **dans n'importe quel ordre et à n'importe quel rythme.** Chaque texte livré
part en ligne tout seul ; rien n'attend que les 69 soient finis.

**Par ordre d'urgence :**

| Priorité | Ce qu'il faut | Combien | Pourquoi |
|---|---|---|---|
| **1** | Le **chemin de vie** | 12 | C'est le seul nombre que les gens connaissent déjà. Ces douze textes suffisent à rendre la carte de numérologie vivante. |
| **2** | Le nombre d'**expression** | 12 | Le deuxième que les gens cherchent. |
| **3** | Les quatre autres | 45 | Complètent le tableau. |

---

## Les six nombres — ce que chacun désigne

| Nombre | Calculé à partir de | Ce qu'il éclaire |
|---|---|---|
| **Chemin de vie** | la date de naissance complète | le mouvement de fond d'une vie |
| **Expression** | toutes les lettres du nom complet de naissance | la manière de se manifester au monde |
| **Intime** | les voyelles du nom | ce qui pousse de l'intérieur |
| **Personnalité** | les consonnes du nom | ce que les autres perçoivent en premier |
| **Jour de naissance** | le jour du mois | un talent particulier, une couleur |
| **Année personnelle** | jour + mois de naissance + l'année en cours | le climat de l'année traversée |

*(Ces définitions sont indicatives — c'est toi qui sais. Si l'une d'elles ne correspond pas à ta
pratique, dis-le : c'est la définition qui change, pas ton texte.)*

---

## Les 69 créneaux

### 1 · Chemin de vie — **12 textes**

`chemin_de_vie:1` `chemin_de_vie:2` `chemin_de_vie:3` `chemin_de_vie:4` `chemin_de_vie:5`
`chemin_de_vie:6` `chemin_de_vie:7` `chemin_de_vie:8` `chemin_de_vie:9`
**`chemin_de_vie:11` `chemin_de_vie:22` `chemin_de_vie:33`**

### 2 · Expression — **12 textes**

`expression:1` … `expression:9`, plus **`expression:11` `expression:22` `expression:33`**

### 3 · Intime — **12 textes**

`intime:1` … `intime:9`, plus **`intime:11` `intime:22` `intime:33`**

### 4 · Personnalité — **12 textes**

`personnalite:1` … `personnalite:9`, plus **`personnalite:11` `personnalite:22` `personnalite:33`**

### 5 · Jour de naissance — **12 textes**

`jour_de_naissance:1` … `jour_de_naissance:9`, plus
**`jour_de_naissance:11` `jour_de_naissance:22` `jour_de_naissance:33`**

### 6 · Année personnelle — **9 textes seulement**

`annee_personnelle:1` … `annee_personnelle:9`

> Pas de 11, 22 ni 33 ici : une année personnelle parcourt un cycle de neuf ans et ne porte jamais
> de nombre maître. Trois textes de moins à écrire.

**Total : 5 × 12 + 9 = 69.**

---

## Les quatre règles que la machine vérifie toute seule

Ce ne sont pas des consignes de style — ce sont des contrôles **automatiques et bloquants**. Un
texte qui les enfreint empêche l'application de se construire, et le message d'erreur cite le mot en
cause. Tu ne peux donc pas te tromper sans le savoir.

### 1. Aucune prédiction

C'est la règle centrale du produit (FR-053). Le socle **décrit**, il n'annonce pas.

| ✗ Refusé | ✓ Accepté |
|---|---|
| « Tu vas rencontrer quelqu'un cette année. » | « C'est une année où la rencontre pèse plus lourd que d'habitude. » |
| « Cette année t'apportera de la clarté. » | « Ce nombre parle de clarté — à toi de voir ce que ça touche. » |
| « Ton avenir se joue maintenant. » | « Rien n'est joué : ce nombre décrit un terrain, pas une trajectoire. » |
| « Ce nombre annonce un retrait. » | « On associe ce nombre à un mouvement de retrait. » |
| « Ce nombre prédit… », « les cartes présagent… » | — |

En pratique : **pas de futur adressé à elle.** « tu verras », « tu seras », « ça t'apportera » sont
refusés. Le conditionnel passe (« ce serait une façon de le lire »), le présent aussi.

### 2. Aucun vocabulaire médical

Interdits : *thérapie*, *diagnostic*, *santé mentale*, *soigner* et ses formes verbales, *trouble*
précédé d'un déterminant (« ton trouble »), *patient*. Anam n'est pas soignante, et Anima non plus
dans ce cadre.

*(« santé » seul reste permis, « ça me trouble » aussi — le contrôle est fin, il ne mord pas sur du
légitime.)*

### 3. Aucun emoji

Le produit n'en emploie nulle part.

### 4. Aucune revendication d'affect

« je ressens », « ça me touche », « je suis fière de toi » : refusés. L'attention est permise —
« je lis », « je note », « je suis là ».

---

## Le reste, c'est toi

**La longueur.** Un texte s'affiche sur une carte. Trois à six phrases marchent bien ; en deçà ça
paraît sec, au-delà ça devient un article. Mais si un nombre demande plus, prends plus.

**Le registre.** Tutoiement ou non, direct ou détourné, imagé ou sobre : c'est ta voix, et c'est
précisément ce qu'aucune machine ne peut fabriquer. La charte de voix d'Anam
(`_bmad-output/brainstorming/brainstorm-anima-app-2026-07-20/anam-voice.md`) est là si tu veux voir
comment le produit parle ailleurs — mais elle décrit **Anam**, pas toi.

**Les nombres maîtres.** 11, 22, 33 méritent un texte à part entière, pas une variante du 2, du 4 ou
du 6. C'est même la raison pour laquelle le calcul les conserve au lieu de les réduire.

---

## Comment nous les livrer

Un fichier texte, un courriel, un document — la forme n'a aucune importance. Il faut juste que
chaque texte porte **son créneau** :

```
chemin_de_vie:7
[ton texte]

chemin_de_vie:8
[ton texte]
```

Julian les intègre dans `lib/corpus/numerologie.ts`, un créneau à la fois. Le compteur passe de
`0 / 69` à autant que tu en as écrits, et l'inventaire du dépôt le dit tout seul.

---

*Ce document a été produit avec la Story 5.2. Le suivi de la porte pré-lancement « LE CORPUS
D'ANIMA » vit dans `_bmad-output/implementation-artifacts/sprint-status.yaml`.*
