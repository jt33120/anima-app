---
baseline_commit: 9e8d89f20c6e36509307a9eff1442b8ecbcc797a
story_key: "5-2-numerologie-complete-deterministe"
epic: 5
story: 2
title: "La numérologie complète et déterministe"
epic_name: "Le socle & la lecture"
covers: [FR-047, FR-048, FR-053, FR-054, FR-055, FR-086, AD-6, AD-1, NFR-011]
depends_on:
  - "1-4-date-naissance-majorite"
  - "2-8-voix-anam-controle-automatise-bloquant"
  - "5-1-theme-natal-calcule-une-fois-grave"
prepare_pour:
  - "5-3-degradation-gracieuse-sans-heure-completion-tronc"
  - "5-4-horoscope-mantra-du-jour"
  - "5-5-enneagramme-test-court-hypothese-anam"
  - "5-6-accueil-bibliotheque-en-cartes"
  - "5-7-tirage-isole-jeu-proprietaire"
status: done
migration: aucune
---

# Story 5.2 : La numérologie complète et déterministe

> **Ce que cette story a de particulier.** La 5.1 était un problème d'astronomie : des formules
> justes ou fausses, arbitrables par des faits extérieurs. La 5.2 est un problème de **provenance**.
> Le calcul est de l'arithmétique de collégien — quinze lignes. Ce qui est difficile, c'est que
> **FR-054 interdit d'écrire les interprétations** : elles viennent du corpus d'Anima, et Anima est
> une personne réelle (FR-086). Le travail de cette story est donc de bâtir une maison **vide** pour
> ces textes, construite de telle sorte que personne — ni un modèle, ni moi, ni un copier-coller
> d'un site de numérologie — ne puisse la remplir en douce.

---

## Story

En tant qu'utilisatrice,
je veux voir ma numérologie complète calculée à partir de mes données,
afin de disposer d'un socle gratuit et exact dès l'inscription.

---

## Le problème central : FR-054 n'est pas une préférence éditoriale

> **FR-054** — « Les interprétations proviennent du **corpus d'Anima**. Aucun texte générique acheté
> ou repris. »
> **FR-086** — « Anam ≠ Anima. Anam peut citer sa source **uniquement à partir du corpus fourni**.
> Elle ne fabrique jamais une parole d'Anima. **Toute citation inventée attribuée à une personne
> réelle est un défaut critique.** »

Ces deux exigences se combinent en une contrainte qu'on ne peut pas contourner par le soin :

- si un **modèle** écrit « le chemin de vie 7 invite au retrait et à l'étude », le texte est généré —
  FR-047 et FR-054 tombent ;
- si **je** l'écris, il est *repris* : je ne connais que la numérologie du domaine public, c'est-à-dire
  exactement le « texte générique » que FR-054 bannit ;
- si on l'**achète** ou qu'on le recopie d'un site, c'est le cas explicite de FR-054, doublé d'un
  problème de droit d'auteur ;
- et dans les trois cas, le texte finit **signé du nom d'Anima** — une personne réelle et
  identifiable. C'est le défaut critique de FR-086, commis à l'échelle de tout le socle.

**Conséquence assumée : la 5.2 livre la numérologie avec ZÉRO interprétation écrite.** Le produit
affiche des nombres justes et dit honnêtement, pour chaque nombre, que le texte d'Anima n'est pas
encore écrit. C'est la même discipline que Chiron en 5.1 (`non_calcule` avec sa raison) et que
FR-050 (« je préfère ne pas te l'inventer ») : **l'absence déclarée bat l'invention plausible.**

Ce n'est pas un demi-produit, c'est la moitié qui vaut d'être codée. L'autre moitié est un travail
d'écriture, elle a un auteur, et cet auteur n'est pas une machine.

---

## Acceptance Criteria

1. **[FR-047 / AD-6]** Étant donné une date de naissance (et le nom complet s'il est fourni), quand
   la numérologie est demandée, alors **les six nombres** sont calculés par du **code pur** dans
   `lib/astro/`, sans aucun appel à un modèle de langage, et le calcul aboutit **sans heure ni lieu
   de naissance** (FR-048/FR-049).

2. **[FR-054 / FR-086 — LE CŒUR]** Étant donné un nombre affiché avec son sens, quand
   l'interprétation est rendue, alors le texte provient **exclusivement du corpus d'Anima** —
   structurellement : il est lu depuis `lib/corpus/`, **jamais** produit par `lib/ai/*`, jamais
   assemblé à la volée. Un créneau non écrit rend `{ statut: "non_ecrit" }`, **jamais** une chaîne
   vide, un texte de remplacement ni une valeur par défaut.

3. **[déterminisme]** Étant donné les mêmes entrées, quand le calcul est rejoué, alors le résultat
   est **strictement identique** — sérialisation comprise. Aucune fonction du module ne lit
   `Date.now()`, `new Date()` sans argument ni `Math.random()` : la date de référence de l'année
   personnelle est un **paramètre**, jamais une horloge implicite.

4. **[FR-053 — garde d'absence]** Étant donné une sortie numérologique, quand elle est présentée,
   alors elle ne formule **aucune prédiction**. La garde est un **détecteur réel** appliqué à chaque
   texte du corpus (futur simple, « tu vas », « ton avenir », « tu rencontreras »…), éprouvé pour
   lui-même sur des chaînes fabriquées, avec présence avant absence et un balayage jamais vide.

5. **[FR-023 / NFR-008 / 2.8]** Étant donné le contrôle de lexique bloquant, quand un texte de corpus
   est ajouté, alors il est balayé par `chercherInterdits` comme tout contenu destiné à
   l'utilisatrice — et le corpus n'est **jamais** ajouté aux exclusions de `tests/lexique-voix.test.ts`.

6. **[FR-048]** Étant donné que le prénom est **obligatoire** et le nom complet **optionnel**, quand
   une utilisatrice franchit le seuil, alors les deux sont **capturés** et écrits ; et quand le nom
   complet manque, alors les trois nombres qui en dépendent sont rendus `non_calcule` avec la raison
   `nom_absent`, sans que cela empêche les trois autres d'aboutir.

7. **[français]** Étant donné un nom porteur d'accents, de ligatures, de traits d'union ou
   d'apostrophes (`Zoé`, `Joël`, `François`, `Anaïs`, `Jean-Pierre`, `D'Artagnan`, `Lœwenstein`),
   quand les lettres sont converties en nombres, alors la conversion est correcte et documentée —
   en particulier **`Œ` et `Æ` ne se décomposent PAS en NFD** et sont traités explicitement.

8. **[FR-055 / FR-088]** Étant donné le registre premium, quand un compte gratuit consulte sa
   numérologie, alors **aucun chemin premium ne la garde** : elle est gratuite à vie, et
   `tests/socle-jamais-coupe.test.ts` l'inscrit comme existante avec la preuve positive
   correspondante.

9. **[AD-6 / AD-1]** Étant donné la frontière de déterminisme, quand la couche est balayée, alors
   ni `lib/astro/` ni `lib/corpus/` n'importe `@/lib/ai/*`, `@/lib/data/*`, `server-only`, Supabase,
   `app/` ni `render/` — et cette propriété est testée, pas seulement écrite.

---

## ⚠️ Les treize pièges — vérifiés dans le dépôt, pas supposés

### P1. Il existe DEUX méthodes de chemin de vie, et elles donnent des résultats différents

C'est le piège le plus coûteux de la story, parce qu'il ne plante jamais : les deux méthodes rendent
un nombre plausible entre 1 et 33.

| Méthode | Comment | Le sort des nombres maîtres |
|---|---|---|
| **Réduction séparée** (école française dominante) | on réduit le **jour**, le **mois** et l'**année** chacun de son côté, puis on additionne, puis on réduit | un 11 ou 22 apparu dans un sous-total est **conservé** |
| **Somme globale** | on additionne tous les chiffres de la date d'un coup, puis on réduit | **écrase** systématiquement les maîtres des sous-totaux |

**Le cas qui les sépare — à mettre en test, c'est le tueur de mutant :** le **28 novembre 1970**.

- *Séparée* : jour `28 → 10 → 1` · mois `11 → 11` (maître, conservé) · année `1970 → 17 → 8`.
  Total `1 + 11 + 8 = 20 → 2`. **Chemin de vie = 2.**
- *Globale* : `2+8+1+1+1+9+7+0 = 29 → 11`. **Chemin de vie = 11.**

Deux nombres qui n'ont rien à voir, pour la même personne. **Décision : réduction séparée**, parce
que c'est la convention majoritaire de la numérologie francophone — celle qu'attend une utilisatrice
française qui a déjà croisé son chemin de vie ailleurs. La méthode est **inscrite dans la sortie**
(`methode: "reduction_separee"`), jamais supposée : le jour où Anima préfère l'autre école, on change
un paramètre et on le voit dans les données.

> Sources : [calcul-numerologie.fr](https://calcul-numerologie.fr/calcul-chemin-de-vie/) ·
> [Centre Eden Formation](https://www.centre-eden-formation.fr/numerologie/calcul-chemin-de-vie-methodes-erreurs/) ·
> [Arkanae](https://www.arkanae.fr/calculer-chemin-de-vie-numerologie/)

### P2. La réduction naïve avale les nombres maîtres

```ts
while (n > 9) n = chiffres(n).reduce(somme);   // ❌ 11 → 2, 22 → 4, 33 → 6
```

Le bogue est silencieux et il détruit précisément ce que la numérologie a de plus identifiant. La
règle : **tester l'appartenance à `{11, 22, 33}` AVANT de réduire, à chaque tour**, jamais après.
Un test doit prouver que `reduire(11) === 11` et `reduire(29) === 11` (car `29 → 11`, on s'arrête),
tout en gardant `reduire(20) === 2`.

### P3. `Œ` et `Æ` ne se décomposent PAS en NFD — vérifié dans ce dépôt

```
'é' → NFD longueur 2 → 'e' après retrait des diacritiques  ✅
'ç' → NFD longueur 2 → 'c'                                  ✅
'œ' → NFD longueur 1 → 'œ'  ❌ reste telle quelle
'æ' → NFD longueur 1 → 'æ'  ❌
'ß' → NFD longueur 1 → 'ß'  ❌
```

Le normalisateur de `lib/domain/lexique-interdit.ts:38` (`NFD` + retrait de `[̀-ͯ]`) a
exactement ce trou. Pour un lexique c'est sans conséquence ; pour **compter des lettres**, une
ligature non dépliée disparaît de la somme et **change le nombre d'expression**. Il faut une table
d'expansion explicite : `œ→oe`, `æ→ae`, `ß→ss`, avant la décomposition.

### P4. `Y` : voyelle ou consonne ? La question décide de DEUX nombres

Le nombre intime compte les voyelles, le nombre de personnalité les consonnes. `Y` bascule d'un côté
ou de l'autre selon l'école, et le désaccord est réel. **Décision : `Y` est une voyelle**, sans
analyse contextuelle — la règle « voyelle quand elle en fait fonction » exigerait un analyseur
phonétique du français, avec ses propres erreurs, pour un gain nul. La règle est **déclarée dans le
module et dans la sortie**, pas enfouie dans une expression régulière.

### P5. L'année personnelle dépend d'« aujourd'hui » — et ça tue le déterminisme

`anneePersonnelle` est le seul nombre qui bouge dans le temps. Un `new Date()` à l'intérieur du
module rendrait la fonction non pure, le test vert aujourd'hui et rouge le 1ᵉʳ janvier, et
l'AC3 invérifiable.

La convention du dépôt existe déjà et il faut la suivre : `lib/domain/intention.ts:76`
(`echeanceRecevable(echeance, maintenant)`) et `lib/domain/branche.ts:40`
(`phraseProposition({ signalCreeLe, maintenant })`) prennent **la date en paramètre**. Idem ici.

Bascule : l'année personnelle change au **1ᵉʳ janvier**, pas à l'anniversaire (convention
majoritaire française). Décision inscrite dans la sortie.

### P6. La numérologie ne se STOCKE PAS — et c'est l'inverse du thème natal

Réflexe naturel après la 5.1 : « on grave, comme `theme_natal` ». Ce serait une faute, pour une
raison précise inscrite dans la migration 0039 :

> `supabase/migrations/0039_theme_natal.sql:69` — « PORTÉE : les seules ENTRÉES ASTRONOMIQUES.
> `prenom` et `nom_complet` en sont volontairement **exclus** » (correction possible, FR-064).

Le thème natal est cher à calculer (éphémérides) et bâti sur des entrées **gravées une fois**. La
numérologie est de l'arithmétique sur quelques caractères — quelques microsecondes — et elle dépend
d'un nom **corrigeable**. La stocker créerait un cache à invalider, donc un jour un nom corrigé et
une numérologie périmée qui a l'air juste.

**Aucune migration dans cette story.** C'est un résultat, pas un oubli : le coût marginal exigé par
FR-047 est déjà nul sans écriture, et une numérologie non stockée ne pose aucune question de
conservation art. 9 (rien à exporter, rien à effacer, rien à propager — FR-067).

### P7. Personne n'écrit `prenom` ni `nom_complet` aujourd'hui

Vérifié : les colonnes existent depuis 0039 (`0039_theme_natal.sql:30-31`) et **aucun fichier de
`app/`, `lib/` ou `render/` ne les écrit ni ne les lit**. Le seul formulaire du seuil
(`app/(auth)/naissance/formulaire-naissance.tsx`) ne collecte que `date_naissance`, et
`app/(auth)/actions.ts` n'écrit que ça.

Or FR-048 déclare le **prénom obligatoire**, et trois des six nombres dépendent du nom complet.
Sans capture, la « numérologie complète » de FR-055 serait à moitié creuse dès son inscription à
l'inventaire du socle.

D'où **T4**. Il est délibérément **minimal** : deux champs ajoutés au formulaire de naissance
existant, écrits dans la même mise à jour. **Aucune nouvelle étape, aucun changement de la machine
d'états** `etapeOnboarding` — parce que l'entrée est déjà notée comme à refondre, et qu'un écran de
plus serait un écran à jeter. Un champ dans un formulaire existant survit à une refonte de style.

> **Trou assumé, à consigner :** les comptes qui ont **déjà** une date de naissance ne repasseront
> pas par ce formulaire et resteront sans prénom. Pour eux, l'absence est déclarée honnêtement
> (`nom_absent`) et le rattrapage appartient à l'écran « ce qu'Anam retient » (FR-063/FR-064,
> Story 6.5). À inscrire dans `deferred-work.md`.

### P8. La garde « aucune prédiction » change de nature — et devient le type de garde le plus fragile

En 5.1, FR-053 était **structurel** : le thème natal n'a aucun champ de texte libre, donc aucun
endroit où écrire une prédiction (`lib/astro/theme-natal.ts:17-27`). Cette story **introduit du
texte**. La garde ne peut plus être « il n'y a pas d'endroit » ; elle devient « ce qui est écrit ne
prédit pas », c'est-à-dire un **détecteur**.

Les trois disciplines de `tests/astro-architecture.test.ts:26-30` et `tests/tronc-absence.test.ts`
s'appliquent intégralement, et elles ne sont pas négociables :

- **(a)** le détecteur est éprouvé **pour lui-même**, sur des chaînes fabriquées connues-mauvaises
  (« tu vas rencontrer », « cette année t'apportera », « ton avenir ») **et** connues-bonnes
  (« ce nombre décrit… », « on associe traditionnellement… ») ;
- **(b)** **présence avant absence** : on prouve d'abord que le balayage voit bien des textes ;
- **(c)** **le balayage n'est jamais vide** — et c'est le point dur ici, puisque le corpus v1 est
  vide. Le contrôle doit donc porter sur le **nombre de créneaux déclarés** (non nul) et le nombre
  de textes écrits (**qui peut valoir zéro**, sans rendre le test tautologique).

Un détecteur qui rendrait `[]` sur un corpus vide serait vert pour toujours et ne prouverait rien.

### P9. Le contrôle de voix de la 2.8 balaie déjà tout `lib/` — ne pas l'exclure

`tests/lexique-voix.test.ts:27-32` découvre récursivement `app/`, `render/` et `lib/`. Un corpus
posé dans `lib/corpus/` tombe donc **automatiquement** sous le contrôle bloquant de la 2.8 : lexique
médical, formulations bannies, « soigner », emoji. C'est gratuit et c'est exactement ce qu'on veut.

La seule façon de le perdre est d'ajouter `lib/corpus/` aux exclusions. **Interdit.** La revue 4.9
(T6-12) a déjà retiré quatre exclusions qui ne se justifiaient plus ; on n'en rajoute pas une.

### P10. `tests/socle-jamais-coupe.test.ts` va rougir — c'est le contrat, pas un incident

```
tests/socle-jamais-coupe.test.ts:56
{ item: "numérologie complète", existe: false, detecteur: /numerolog|numérolog/i }
```

Ce test est **armé** depuis la Story 3.3 pour détecter l'arrivée de l'Epic 5, et il a déjà attrapé
la 5.1. Créer `lib/astro/numerologie.ts` le fera rougir avec le message qu'il porte lui-même
(`:95`) : passer l'item à `existe: true` **et** prouver qu'aucun chemin premium ne le garde.
Honorer le contrat, jamais désarmer la garde.

### P11. Ce qui est art. 9 ici, et ce qui ne l'est pas

Un prénom et un nom sont des données personnelles ordinaires — pas de l'article 9. C'est pourquoi
0039 les a rangés hors du périmètre write-once, avec les entrées astronomiques. La numérologie
*dérivée*, elle, relève de la même catégorie que le thème natal (conviction / spiritualité) — mais
puisqu'elle n'est **jamais écrite** (P6), la question de son stockage art. 9 ne se pose pas.

En revanche la règle NFR-022 tient : **ni le nom ni la date ne paraissent dans un message d'erreur
ou un log**, comme `lib/data/depot-theme-natal.ts:47-51`.

### P12. Six nombres, et le mot « complète » veut dire quelque chose

Le périmètre v1, arrêté et fermé — l'ajouter un septième plus tard est un changement de version du
corpus, pas une retouche :

| Nombre | Entrée | Sans le nom ? |
|---|---|---|
| **Chemin de vie** | date complète | ✅ calculable |
| **Jour de naissance** | jour du mois, réduit | ✅ calculable |
| **Année personnelle** | jour + mois + année de référence | ✅ calculable |
| **Expression** | toutes les lettres du nom complet | ❌ `nom_absent` |
| **Intime** (âme) | les voyelles | ❌ `nom_absent` |
| **Personnalité** | les consonnes | ❌ `nom_absent` |

Table de conversion : **Pythagore** (A-I = 1-9, J-R = 1-9, S-Z = 1-8), la table de la numérologie
occidentale francophone — pas Chaldéenne.

**Les créneaux de corpus qui en découlent — 69, à compter exactement :**

| Nombre | Valeurs possibles | Créneaux |
|---|---|---|
| Chemin de vie · Expression · Intime · Personnalité · Jour de naissance | `1..9` + `11` + `22` + `33` | 5 × 12 = **60** |
| Année personnelle | `1..9` seulement — une année ne porte pas de nombre maître | **9** |
| | | **69** |

### P13. `nom_complet` contient-il le prénom ? La réponse décide du nombre d'expression

Piège de concaténation, et il est invisible : si le développeur écrit
`expression(prenom + " " + nom_complet)` alors que `nom_complet` vaut déjà `"Marie Dupont"`, le
prénom est **compté deux fois** et le nombre est faux sans que rien ne signale quoi que ce soit.

**Décision : `nom_complet` est le nom complet de naissance, prénom INCLUS** — c'est ce que la
numérologie appelle le nom de naissance, et c'est ce que le libellé du champ doit dire à
l'utilisatrice (« ton nom complet de naissance, prénoms compris »). `prenom` est une donnée
d'**adresse** (comment Anam la nomme), pas une entrée de calcul.

Conséquence directe : **les trois nombres du nom ne se calculent JAMAIS depuis `prenom` seul.**
Sans `nom_complet`, ils sont `non_calcule` / `nom_absent`, même si `prenom` est renseigné.

---

## Périmètre — ce que la 5.2 ne fait PAS

- **Elle n'écrit aucune interprétation.** Voir « Le problème central ». Le corpus v1 est **vide et
  complet en structure** : tous les créneaux existent, aucun n'est rempli.
- **Elle n'affiche rien.** L'accueil en cartes est la Story 5.6 ; la fiche du tronc incomplet est la
  5.3. La 5.2 livre le calcul, le corpus et le chemin de lecture serveur.
- **Elle ne stocke rien** et n'ajoute aucune migration (P6).
- **Elle ne touche pas au thème natal** : `lib/astro/theme-natal.ts` et `depot-theme-natal.ts`
  restent inchangés.
- **Elle ne refond pas l'onboarding** : deux champs dans un formulaire existant, rien de plus (P7).

---

## Tasks / Subtasks

- [x] **T1 — `lib/corpus/` : la maison des textes d'Anima** (AC2, AC5, AC9)
  - [x] `lib/corpus/README.md` — pourquoi cette couche existe *séparée* de `lib/astro/` : le socle
        est du calcul et n'a aucune prose (5.1) ; le corpus est de la prose et n'a aucun calcul.
        Qui a le droit d'y écrire (Anima, une personne réelle — FR-086), ce qui n'y arrive jamais
        (aucun modèle, aucun texte acheté ou repris — FR-054).
  - [x] `lib/corpus/port.ts` — `TexteCorpus = { statut: "ecrit"; texte: string } | { statut: "non_ecrit" }`.
        **Union, pas `string | undefined`** : même raison qu'en 5.1 (`lib/astro/port.ts`) — avec un
        optionnel, un `?? ""` quelque part transformerait « pas encore écrit » en « rien à dire ».
  - [x] `lib/corpus/numerologie.ts` — la table des créneaux : **69 clés** (P12), toutes déclarées,
        toutes `non_ecrit` en v1. Format de clé stable et lisible — `"chemin_de_vie:7"`,
        `"annee_personnelle:3"` — **réutilisé tel quel** par 5.4 (mantras) et 5.5 (ennéagramme) : le
        format se décide ici une fois, pas trois fois. La liste des clés est **exportée** pour que la
        complétude soit mesurable (« 0 / 69 écrits ») sans deviner.
  - [x] Écrire la **fiche d'écriture pour Anima** :
        `_bmad-output/implementation-artifacts/corpus-numerologie-a-ecrire.md` — un créneau par
        ligne, ce que chaque nombre désigne, et les règles de voix extraites de la charte
        (`anam-voice.md`) + du lexique interdit + de l'interdiction de prédire.
  - [x] Inscrire la **porte pré-lancement « corpus d'Anima »** dans `sprint-status.yaml`.

- [x] **T2 — La réduction et les nombres de date** (AC1, AC3 · P1, P2, P5)
  - [x] `lib/astro/numerologie.ts` — module **pur** : aucun `server-only`, aucun import de
        `lib/data`, `lib/ai`, `app/`, `render/`.
  - [x] `reduire(n)` — maîtres `{11, 22, 33}` testés **avant** chaque réduction (P2).
  - [x] `cheminDeVie(date)` — **réduction séparée** jour / mois / année (P1), méthode inscrite dans
        la sortie.
  - [x] `jourDeNaissance(date)` · `anneePersonnelle(date, dateReference)` — la date de référence est
        un **paramètre**, jamais une horloge (P5).
  - [x] **RED d'abord** : le test du 28/11/1970 (`2` en séparée, `11` en globale) écrit et **rouge**
        avant l'implémentation.

- [x] **T3 — Les lettres françaises** (AC7 · P3, P4)
  - [x] Expansion explicite des ligatures **avant** NFD : `œ→oe`, `æ→ae`, `ß→ss` (P3, vérifié).
  - [x] Retrait des diacritiques, mise en minuscules, rejet de tout ce qui n'est pas `a-z`
        (traits d'union, apostrophes droites **et typographiques**, espaces, points).
  - [x] Table de Pythagore ; `Y` = **voyelle**, règle déclarée et exportée (P4).
  - [x] `expression(nom)` · `intime(nom)` · `personnalite(nom)`.
  - [x] Cas de test obligatoires : `Zoé`, `Joël`, `François`, `Anaïs`, `Jean-Pierre`, `D'Artagnan`,
        `D’Artagnan` (apostrophe typographique), `Lœwenstein`, `Yves`, un nom en majuscules, un nom
        avec espaces multiples. Plus un **nom sans aucune lettre exploitable** (`"---"`) → doit
        rendre `non_calcule`, jamais `0`.

- [x] **T4 — La capture du prénom et du nom complet** (AC6 · P7, P13)
  - [x] Ajouter `prenom` (**requis**) et `nom_complet` (optionnel) à
        `app/(auth)/naissance/formulaire-naissance.tsx`, dans le formulaire **existant**. Le libellé
        du second dit explicitement « nom complet de naissance, **prénoms compris** » (P13).
  - [x] Écriture dans la même mise à jour que `date_naissance`
        (`app/(auth)/naissance/actions.ts`) — validation, bornes de longueur, aucun changement de
        `etapeOnboarding` (P7).
  - [x] **Ne pas casser le raccourci de développement** `app/(auth)/entrer/actions.ts:85`, qui écrit
        `date_naissance: "1990-01-01"` sur une ligne encore nulle. Il ne connaît pas les nouveaux
        champs et doit continuer de fonctionner tel quel.
  - [x] Test de rendu dans le projet Vitest `rendu` (`tests/rendu/*.test.tsx`, jsdom + Testing
        Library) : le champ prénom est **requis** et étiqueté, le champ nom complet est optionnel et
        son libellé porte bien « prénoms compris ».
  - [x] Consigner dans `deferred-work.md` le trou des comptes déjà créés → Story 6.5.

- [x] **T5 — L'assemblage et le chemin de lecture** (AC1, AC2, AC6)
  - [x] `calculerNumerologie(entrees, dateReference): Numerologie` — chaque nombre est une **union**
        `{ statut: "calcule", valeur, maitre } | { statut: "non_calcule", raison: "nom_absent" }`,
        exactement comme `LectureCorps` en 5.1. Le calcul **aboutit toujours** avec ce qui est
        disponible.
  - [x] La **jonction** nombre → texte : une fonction qui, pour un nombre calculé, va chercher son
        créneau de corpus et rend `TexteCorpus`. Elle **ne fabrique rien** : pas de texte de repli,
        pas de chaîne vide, pas de « interprétation à venir » codé en dur côté domaine.
        Un nombre `non_calcule` **n'a pas de créneau** : on ne cherche pas le sens d'un nombre qu'on
        n'a pas. Les deux absences restent distinctes de bout en bout — *je ne sais pas le calculer*
        (`nom_absent`) n'est pas *je ne l'ai pas encore écrit* (`non_ecrit`), et la 5.6 les affichera
        différemment.
  - [x] `lib/data/lire-numerologie.ts` — `import "server-only"`, **JWT utilisatrice** (patron
        `lib/data/lire-abonnement.ts` / `depot-theme-natal.ts`, jamais `service_role`), lit
        `prenom, nom_complet, date_naissance`, calcule, rend. **Aucune écriture, aucune table.**
        Erreurs : code Postgres seul, jamais le nom ni la date (NFR-022, P11).

- [x] **T6 — Le détecteur de prédiction** (AC4 · P8)
  - [x] `lib/domain/marqueurs-prediction.ts` — miroir structurel de `lexique-interdit.ts` : motifs
        ancrés sur des frontières de mots, appliqués au texte normalisé, anti-faux-positif
        (« ta vie **sera** » interdit ; « ce nombre **serait** associé à » toléré ; « avenir »
        interdit ; « à venir » toléré).
  - [x] `chercherPredictions(texte): Prediction[]`, testé **pour lui-même** sur connues-mauvaises et
        connues-bonnes avant tout balayage (P8-a).

- [x] **T7 — Les gardes** (AC3, AC4, AC5, AC8, AC9)
  - [x] `tests/numerologie.test.ts` — le calcul : réduction, maîtres, les six nombres, le cas
        28/11/1970, les noms français, le déterminisme (deux appels ⇒ JSON identique), l'absence de
        nom, l'année personnelle sur trois années de référence.
  - [x] `tests/corpus-architecture.test.ts` — `lib/corpus/` n'importe ni `lib/ai`, ni `lib/data`, ni
        `server-only`, ni Supabase ; **tout** texte écrit passe `chercherInterdits` **et**
        `chercherPredictions` ; l'inventaire de complétude est asserté **non vide en créneaux**
        (P8-c) ; contrôle du contrôle : un faux corpus fabriqué contenant « tu vas rencontrer »
        **doit** être rejeté par le même balayage.
  - [x] Étendre `tests/astro-architecture.test.ts` — `lib/astro/numerologie.ts` explicitement dans le
        balayage, et l'assertion « aucun `new Date()` sans argument, aucun `Date.now()`, aucun
        `Math.random()` dans `lib/astro/` » (AC3, P5).
  - [x] Modifier `tests/socle-jamais-coupe.test.ts` — item « numérologie complète » à `existe: true`
        **+** la preuve positive : aucun fichier du socle numérologique ne mentionne `premium`,
        `abonnement`, `entitlement`, `planOuvert`, `GardeCommerciale` ni `stripe` (P10).
  - [x] `tests/lexique-voix.test.ts` — vérifier que `lib/corpus/` est bien balayé et **n'est pas**
        dans les exclusions (P9).

- [x] **T8 — Vérification finale**
  - [x] `npx tsc --noEmit` · `npx eslint .` · `npx next build` propres.
  - [x] Suite complète verte, aucune régression.
  - [x] **Campagne de mutation** : au minimum — somme globale au lieu de séparée · maître avalé par
        la réduction · `Y` passé en consonne · ligature non dépliée · `new Date()` réintroduit ·
        texte de repli à la place de `non_ecrit` · exclusion de `lib/corpus/` du contrôle de voix ·
        détecteur de prédiction rendu vacu**e** (rend toujours `[]`). Chaque mutant doit **tuer**
        un test nommé. Restauration par **snapshot `cp`, jamais `git checkout`**.

---

## Dev Notes

### Décisions arrêtées dans cette story (à ne pas re-litiger en cours de route)

| # | Décision | Pourquoi |
|---|---|---|
| D1 | **Aucune interprétation écrite en v1** | FR-054 + FR-086 ne laissent aucune autre issue (voir « Le problème central ») |
| D2 | **Chemin de vie par réduction séparée** | convention francophone majoritaire ; inscrite dans la sortie (P1) |
| D3 | **`Y` = voyelle**, sans analyse contextuelle | un analyseur phonétique introduirait ses propres erreurs pour un gain nul (P4) |
| D4 | **Année personnelle au 1ᵉʳ janvier**, date de référence en paramètre | déterminisme (P5) ; convention du dépôt (`intention.ts:76`) |
| D5 | **Aucun stockage, aucune migration** | le nom est corrigeable ; un cache créerait une numérologie périmée plausible (P6) |
| D6 | **Le corpus vit dans `lib/corpus/`, pas dans `lib/astro/`** | le socle n'a aucune prose (garde structurelle de la 5.1) ; et `lib/` est déjà balayé par le contrôle de voix 2.8 (P9) |
| D7 | **Capture minimale du nom dans le formulaire existant** | l'entrée est à refondre : un champ survit à une refonte, un écran non (P7) |
| D8 | **Six nombres, périmètre fermé** | « complète » doit vouloir dire quelque chose de vérifiable (P12) |
| D9 | **`nom_complet` = nom de naissance, prénom inclus** ; `prenom` ne sert jamais au calcul | évite le prénom compté deux fois, faux et invisible (P13) |

### Stack — relue dans le dépôt

- Next.js 16.2.11 · React 19.2.0 · TypeScript 5.9.3 strict · Node ≥ 22 · Vitest 4.1.10
  (projets `node` et `rendu`).
- **Aucune dépendance nouvelle.** La numérologie est de l'arithmétique entière ; toute bibliothèque
  tierce ici serait une surface de confiance gratuite sur un calcul de quinze lignes.
- 155 fichiers de test, 2274 tests au vert au `9e8d89f`.

### Frontières à ne pas franchir

- `lib/astro/**` et `lib/corpus/**` : **purs**. Aucune I/O, aucun `server-only`, aucun Supabase,
  aucun `lib/ai`, aucun `lib/data`. La règle inverse (`lib/data` → `lib/astro`) reste permise et
  c'est le seul sens sûr (`depot-theme-natal.ts:38-45`).
- `lib/data/lire-numerologie.ts` : **JWT utilisatrice**, jamais `service_role`.
- Aucune donnée personnelle dans une erreur ou un log (NFR-022).
- Le contrôle de voix 2.8 ne perd **aucune** surface.

### Commande de test

```bash
npx vitest run
```

### Références

- Epic 5, Story 5.2 — `_bmad-output/planning-artifacts/epics.md:1009-1021`
- FR-047/048/053/054 — `prd.md:171-178` · FR-055/088 — `prd.md:184-186` · FR-086 — `prd.md:219`
- AD-6 (frontière de déterminisme) — `ARCHITECTURE-SPINE.md:64`
- Story 5.1 (couche et patrons) — `lib/astro/README.md`, `lib/astro/port.ts`,
  `lib/astro/theme-natal.ts:17-27`, `lib/data/depot-theme-natal.ts`
- Colonnes `prenom`/`nom_complet` et leur exclusion du write-once — `0039_theme_natal.sql:30-31, 69`
- Contrôle de voix bloquant — `tests/lexique-voix.test.ts`, `lib/domain/lexique-interdit.ts`
- Inventaire du socle gratuit — `tests/socle-jamais-coupe.test.ts:56`
- Discipline des gardes d'absence — `tests/astro-architecture.test.ts:20-30`
- Injection de l'horloge — `lib/domain/intention.ts:76`, `lib/domain/branche.ts:40`
- Couture 2.7 en attente du socle — `lib/domain/message-sans-heure.ts:4-8`

---

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context) — `claude-opus-5[1m]`.

### Debug Log References

- Valeurs numérologiques attendues **calculées avant d'être asserties** (script jetable dans le
  scratchpad), jamais recopiées de mémoire : deux écoles de calcul coexistent et l'intuition ne les
  départage pas.
- Deux échecs de test pendant l'écriture, tous deux des défauts réels de **mon** détecteur de
  prédiction (voir Completion Notes).
- Deux gardes existantes m'ont attrapé sur des références en commentaire (voir Completion Notes).

### Completion Notes List

#### Ce que la story livre

**Le calcul** (`lib/astro/numerologie.ts`, pur) — six nombres : chemin de vie, expression, intime,
personnalité, jour de naissance, année personnelle. Réduction séparée, nombres maîtres conservés,
table de Pythagore écrite comme un calcul (périodicité 9) plutôt que recopiée en 26 entrées.
Normalisation française avec expansion explicite des ligatures. Chaque nombre est une **union**
`calcule | non_calcule` avec sa raison, jamais un `number | undefined`.

**Le corpus** (`lib/corpus/`, pur) — une couche neuve, séparée de `lib/astro/` pour ne pas détruire
la garde structurelle de la 5.1 (« le socle ne porte aucune prose »). 69 créneaux déclarés,
**0 écrit**. Un créneau non écrit rend `{ statut: "non_ecrit" }` — jamais une chaîne vide, jamais un
texte de remplacement. `ecrit("")` jette à la construction ; `lireTexte` jette sur une clé non
déclarée plutôt que de la faire passer pour du travail d'écriture en attente.

**Le détecteur de prédiction** (`lib/domain/marqueurs-prediction.ts`) — miroir structurel de
`lexique-interdit.ts`. La sélectivité vient du **destinataire** (« tu verras », « ça t'apportera »)
et non de la terminaison verbale : chercher `-ras`/`-ra`/`-ront` nus ferait rougir « embarras »,
« caméra », « affront », on assouplirait le détecteur, et il finirait par ne plus rien attraper.

**La capture du nom** (T4) — deux champs dans le formulaire du seuil existant. Rien n'est écrit sur
le chemin mineur, et c'est testé.

**Le chemin de lecture** (`lib/data/lire-numerologie.ts`) — JWT utilisatrice, **aucune écriture,
aucune table, aucune migration**.

#### Trois décisions prises en cours de route, plus strictes que la story

1. **`anneeDeReference` est un ENTIER, pas un `Date`.** La story disait « la date de référence est un
   paramètre » (P5). En écrivant, j'ai vu qu'un `Date` ne suffit pas : extraire une année force à
   choisir entre `getFullYear()` et `getUTCFullYear()`, et les deux divergent le 1ᵉʳ janvier entre
   00 h et 01 h à Paris. Le domaine n'a aucun moyen de trancher un fuseau. La résolution vit donc
   dans `lire-numerologie.ts` (patron `jourCivilParis` de `branche.ts`), et le mutant M13 le prouve.

2. **Deux absences de nom, pas une.** La story prévoyait `nom_absent`. J'en ai ajouté trois autres :
   `nom_sans_lettre` (renseigné mais inexploitable — un défaut de saisie, pas un champ laissé vide),
   `nom_sans_voyelle`, `nom_sans_consonne`. Les confondre ferait passer un bogue pour une omission.

3. **Un test sur `app/(auth)/naissance/actions.ts`, qui n'en avait aucun.** La Story 1.4 avait livré
   le contrôle de majorité côté serveur (NFR-023, FR-070/FR-071) sans jamais l'exercer : la barrière
   de minorité tenait par relecture seule. Je touchais cette action ; je l'ai couverte, y compris le
   chemin mineur (M14).

#### Deux défauts de mon propre détecteur, trouvés par mes propres tests

- **« les cartes présagent »** passait. J'avais écrit `\bpresages?\b` — le NOM seul. La forme verbale,
  la plus prédictive des deux, n'était pas couverte.
- **« tu vas découvrir »** passait. Mon motif de futur proche exigeait un infinitif en `-er` ; les
  infinitifs en `-ir`, `-re` et `-oir` passaient à travers.

Les deux corrigés, et **« ce nombre annonce… »** ajouté au passage — c'est la formule prédictive type
du genre, et son absence était un trou réel.

#### Deux gardes existantes m'ont attrapé

- **`tests/socle-jamais-coupe.test.ts`** a rougi sur une référence **en commentaire** à
  `lire-abonnement.ts` dans mon nouveau fichier (`/abonnement/i`). Le test scanne délibérément les
  commentaires : son objet est le **registre** commercial dans le socle gratuit, pas seulement les
  appels. J'ai reformulé le commentaire plutôt qu'affaibli la garde, et expliqué la contrainte sur
  place.
- **Le même filet FR-055** a exigé, comme prévu depuis la 3.3, que « numérologie complète » passe à
  `existe: true` **avec** sa preuve positive. C'est son **deuxième** rougissement (le premier était la
  5.1), et le deuxième honoré.

Cas symétrique dans `tests/naissance-actions.test.ts` : l'en-tête de l'action dit légitimement
« jamais `service_role` », donc là j'ai retiré les commentaires avant de scanner. Les deux choix sont
justes et pour des raisons différentes ; c'est écrit dans les deux tests.

#### Campagne de mutation — 33 mutants, 33 tués

Restauration par **snapshot `cp`**, jamais `git checkout`. Arbre vérifié identique au snapshot à la
fin (aucune mutation résiduelle).

| # | Mutant | Tué par |
|---|---|---|
| M1 | chemin de vie par somme globale | `numerologie` (28/11/1970) |
| M2 | réduction avalant les nombres maîtres | `numerologie` |
| M3 | `Y` passée en consonne | `numerologie` (« Yves ») |
| M4 | ligature `œ` non dépliée | `numerologie` (`Lœwenstein` ≡ `Loewenstein`) |
| M5 | `new Date()` dans `lib/astro` | `astro-architecture` |
| M6 | texte de repli au lieu de `non_ecrit` | `corpus-architecture` |
| M7 | `lib/corpus` ajouté aux exclusions de voix | `corpus-architecture` |
| M8 | détecteur de prédiction rendu vacue | `corpus-architecture` |
| M9 | `ecrit("")` accepté | `corpus-architecture` |
| M10 | clé inconnue → `non_ecrit` au lieu de jeter | `corpus-architecture` |
| M11 | `prenom` lu et concaténable (P13) | `lire-numerologie` |
| M12 | écriture ajoutée au chemin de lecture | `lire-numerologie` |
| M13 | année de référence en UTC | `lire-numerologie` |
| M14 | prénom écrit avant la barrière de minorité | `naissance-actions` |
| M15 | `nom_complet` vide écrit `""` | `naissance-actions` |
| M16 | prénom devenu facultatif | `naissance-actions` |
| M17 | `required` sur le nom complet | `rendu/formulaire-naissance` |
| M18 | étiquette sans « prénoms compris » | `rendu/formulaire-naissance` |
| M19 | année personnelle avec nombres maîtres | `numerologie` |
| M20 | 69 créneaux devenus 72 | `corpus-architecture` |
| M21 | champ de prose dans la sortie du socle | `numerologie` |
| M22 | corpus mutable à l'exécution | `corpus-architecture` |
| M23 | table de conversion décalée | `numerologie` |
| M24 | `lib/corpus` importe `lib/ai` | `corpus-architecture` |
| M25 | date lue comme un instant UTC | `numerologie` |
| M26 | `reduire` accepte 0 | `numerologie` |
| M27 | absence de voyelle rendue en `0` | `numerologie` |
| M28 | garde premium sur le socle gratuit | `socle-jamais-coupe` |
| M29 | futur simple adressé non détecté | `corpus-architecture` |
| M30 | sortie du calcul mutable | `numerologie` |
| M31 | futur proche non détecté | `corpus-architecture` |
| M32 | détecteur élargi au conditionnel (faux positifs) | `corpus-architecture` |
| M33 | un texte apparu dans le corpus sans passer par Anima | `corpus-architecture` |

M33 mérite un mot : il vérifie que **la porte pré-lancement elle-même est gardée**. Si un texte
apparaît un jour dans le corpus, le test rougit avec un message qui demande de vérifier qu'il vient
bien d'Anima. C'est ce qui empêche le corpus de se remplir en silence.

### File List

**Neufs**
- `lib/astro/numerologie.ts`
- `lib/corpus/port.ts`
- `lib/corpus/numerologie.ts`
- `lib/corpus/README.md`
- `lib/domain/marqueurs-prediction.ts`
- `lib/data/lire-numerologie.ts`
- `tests/numerologie.test.ts`
- `tests/corpus-architecture.test.ts`
- `tests/lire-numerologie.test.ts`
- `tests/naissance-actions.test.ts`
- `tests/rendu/formulaire-naissance.test.tsx`
- `_bmad-output/implementation-artifacts/corpus-numerologie-a-ecrire.md`
- `_bmad-output/implementation-artifacts/5-2-numerologie-complete-deterministe.md`

**Modifiés**
- `app/(auth)/naissance/formulaire-naissance.tsx` — deux champs
- `app/(auth)/naissance/actions.ts` — validation + écriture des deux colonnes
- `tests/astro-architecture.test.ts` — `numerologie.ts` au balayage + garde « aucune horloge »
- `tests/socle-jamais-coupe.test.ts` — FR-055 « numérologie complète » → `existe: true` + preuve
- `_bmad-output/implementation-artifacts/deferred-work.md` — cinq résiduels
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — statut + porte « corpus d'Anima »

**Aucune migration.** C'est un résultat, pas un oubli (P6).

### Validation

| Contrôle | Résultat |
|---|---|
| `npx tsc --noEmit` | ✅ propre |
| `npx eslint .` | ✅ propre |
| `npx next build` | ✅ propre |
| Suite complète | ✅ **2370 tests / 170 fichiers** (+96 tests, +5 fichiers) |
| Campagne de mutation | ✅ **33 mutants, 33 tués** |
| Arbre restauré après mutation | ✅ identique au snapshot |

**Couverture des critères d'acceptation**

| AC | Où c'est prouvé |
|---|---|
| AC1 — six nombres, code pur, sans heure ni lieu | `numerologie.test.ts`, `astro-architecture.test.ts` |
| AC2 — texte du seul corpus, jamais de repli | `corpus-architecture.test.ts` (M6, M9, M10) |
| AC3 — déterminisme, aucune horloge | `numerologie.test.ts`, `astro-architecture.test.ts` (M5, M13) |
| AC4 — aucune prédiction, détecteur éprouvé | `corpus-architecture.test.ts` (M8, M29, M31, M32) |
| AC5 — contrôle de voix jamais contourné | `corpus-architecture.test.ts` (M7) |
| AC6 — prénom requis, nom optionnel, absence honnête | `naissance-actions.test.ts`, `rendu/` (M14–M18) |
| AC7 — accents, ligatures, apostrophes | `numerologie.test.ts` (M4) |
| AC8 — aucun chemin premium | `socle-jamais-coupe.test.ts` (M28) |
| AC9 — frontières de couche | `astro-architecture.test.ts`, `corpus-architecture.test.ts` (M24) |

---

## Change Log

| Date | Version | Description |
|---|---|---|
| 2026-08-07 | 0.1 | Dossier de story créé — analyse des artefacts, treize pièges, neuf décisions arrêtées. Statut `ready-for-dev`. |
| 2026-08-07 | 1.0 | T1→T8 livrés. Couche `lib/corpus/` posée (69 créneaux, 0 écrit — FR-054/FR-086), calcul numérologique pur, détecteur de prédiction, capture du prénom et du nom complet, chemin de lecture sans stockage. 2370 tests / 170 fichiers verts, 33 mutants tués, aucune migration. Statut `review`. |

## Status

done

> **Revue de code : 2026-08-13.** D1 (détecteur de prédiction élargi au mot intercalé) et D5 (chaîne de prototypes).
> Dossier complet : [`revue-dette-2026-08.md`](revue-dette-2026-08.md).
