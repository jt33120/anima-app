---
baseline_commit: 08d8770dba42b62510c0e450980efba85f196f88
story_key: "5-4-horoscope-mantra-du-jour"
epic: 5
story: 4
title: "L'horoscope et le mantra du jour (socle quotidien)"
epic_name: "Le socle & la lecture"
covers: [FR-033, FR-047, FR-053, FR-054, FR-055, FR-080, FR-086, AD-1, AD-6, AD-12, NFR-011, NFR-013, NFR-021, NFR-022]
depends_on:
  - "5-1-theme-natal-calcule-une-fois-grave"
  - "5-2-numerologie-complete-deterministe"
  - "5-3-degradation-gracieuse-sans-heure-completion-tronc"
prepare_pour:
  - "5-6-accueil-bibliotheque-en-cartes"
  - "epic-7-ordonnanceur-notification-du-matin"
status: done
migration: null
---

# Story 5.4 : L'horoscope et le mantra du jour (socle quotidien)

> **Ce que cette story a de particulier.** C'est **la surface la plus dangereuse du produit pour
> FR-053**. Un thème natal est un état ; un horoscope est un énoncé sur *aujourd'hui*, et le genre
> tout entier — celui des magazines — est bâti sur la prédiction. « Aujourd'hui, Mars te pousse à
> agir » est une prédiction, et c'est la phrase que tout le monde attend d'un horoscope.
>
> Trois pièges dominent, tous du type « ça marche, et c'est faux » :
>
> **(1) Le piège du copier-coller de la 5.3.** Sans heure, un signe indéterminable est une
> **absence**. Dans le ciel du jour, un changement de signe est un **fait** — et c'est même le fait
> le plus intéressant de la journée. Même calcul, conclusion inverse. Qui réutilise `signeAmbigu`
> sans réfléchir livre un horoscope où la Lune est absente deux jours sur cinq.
>
> **(2) Le piège des transitants lents.** Inclure Jupiter→Pluton dans les transits donne un
> « horoscope du jour » identique pendant des mois — Pluton reste à moins d'un degré d'un aspect
> pendant **deux ans**. Le produit dirait chaque matin la même chose, avec l'autorité d'un calcul.
>
> **(3) Le piège de la table.** Le réflexe, pour « servi sans attente depuis le cache », est une
> table `horoscope_jour`. Ce serait une ligne art. 9 dérivée par utilisatrice **et par jour**, à
> conserver, exporter, effacer et invalider — pour recalculer en quelques millisecondes ce qu'on a
> déjà. Et un cache à invalider dont la source **bouge** (la 5.3 recalcule le thème natal quand
> l'heure arrive) est une machine à produire un horoscope périmé qui a l'air juste.

---

## Story

En tant qu'utilisatrice,
je veux recevoir chaque jour un horoscope et un mantra calculés et impersonnels,
afin d'avoir un rendez-vous léger qui n'exige rien de moi.

---

## Critères d'acceptation

1. **[FR-033, FR-047]** Étant donné le thème natal stocké, quand un nouveau jour commence (bascule à
   minuit local), alors l'horoscope du jour est **calculé** (jamais généré par un modèle de langage)
   **et** servi sans attente depuis le cache.
2. **[FR-054, FR-080]** Étant donné le mantra du jour, quand il est affiché, alors c'est un **texte
   court, gratuit et non interactif** issu du corpus d'Anima, distinct de l'ancrage et de la lecture.
3. **[FR-033]** Étant donné le socle quotidien, quand il se manifeste, alors il est impersonnel et
   n'exige rien (pas de série, pas de « tu as manqué hier »), **et** il n'est jamais signé par Anam,
   **et** il ne référence jamais le journal, une branche ou un échange.
4. **[FR-053]** Étant donné une sortie du socle quotidien, quand elle est présentée, alors elle ne
   formule **aucune prédiction**.
5. **[FR-049 / continuité 5.3]** Étant donné un thème natal **incomplet** (sans heure : pas
   d'ascendant, corps au signe indéterminable, Chiron absent), quand l'horoscope du jour est calculé,
   alors il **aboutit quand même** avec les cibles natales disponibles, et ce qui manque est
   **déclaré avec sa raison**, jamais comblé.
6. **[FR-055 / dégradation]** Étant donné une utilisatrice dont le thème natal est **indisponible**
   (pas de date de naissance, ou lecture impossible), quand le socle quotidien est demandé, alors
   **le mantra du jour reste servi** — il ne dépend d'aucune donnée de naissance — et l'horoscope est
   déclaré indisponible avec sa raison.
7. **[FR-047 / déterminisme]** Étant donné un même jour et un même thème, quand le socle quotidien
   est rejoué, alors le résultat est **strictement identique** — y compris le départage entre deux
   configurations d'orbe égal.
8. **[NFR-021, FR-067]** Étant donné le socle quotidien, quand il est produit, alors **rien n'est
   écrit en base** : aucune nouvelle donnée art. 9 à conserver, à exporter ou à effacer, et aucune
   migration.

---

## Périmètre — ce que cette story ne fait PAS

| Hors périmètre | Qui le porte |
|---|---|
| L'**affichage** en cartes (accueil, bibliothèque) | Story 5.6 |
| La **notification poussée** du matin (canal, planification, 8 h) | Epic 7 / ordonnanceur ; note de périmètre de l'epic |
| L'**archive** des mantras passés | Lacune assumée par le contrat UX (EXPERIENCE.md §607) |
| L'**écriture des textes** par Anima | Porte pré-lancement — voir « le budget du corpus » |

> **Cette story ne livre aucune surface**, exactement comme la 5.2. C'est délibéré et c'est la
> lecture de l'epic (« cette story produit et met à disposition l'horoscope et le mantra du jour »).
> Elle livre : le **domaine calculé**, le **corpus déclaré**, et le **chemin de lecture** que la 5.6
> consommera. `lireNumerologie` (5.2) attend déjà dans le même état — aucun appelant applicatif.

---

## Contexte développeur

### Ce qui existe déjà et qu'il ne faut PAS réinventer

| Besoin | Ce qui existe | Fichier |
|---|---|---|
| Lire une éphéméride | `EphemerisPort` — **la seule porte** | `lib/astro/port.ts` |
| Positions, signes, degrés | `placer()`, `normaliserDegres()`, `SIGNES` | `lib/astro/theme-natal.ts` |
| Le thème natal gravé + recalcul paresseux | `lireThemeNatal()` | `lib/data/depot-theme-natal.ts` |
| Le fuseau du produit | `FUSEAU = "Europe/Paris"` | `lib/domain/ordonnanceur.ts:21` |
| Résoudre un jour civil Paris | patron `jourCivilParis` | `lib/domain/branche.ts:12` |
| Résoudre « maintenant » hors du domaine | patron « l'année de référence est résolue ici » | `lib/data/lire-numerologie.ts` |
| Un corpus déclaré, écrit ou non | `Corpus`, `TexteCorpus`, `corpus()`, `ecrit()`, `lireTexte()` | `lib/corpus/port.ts` |
| Le format de clé de corpus | `"<domaine>:<valeur>"`, **décidé une fois pour les corpus à venir** | `lib/corpus/numerologie.ts:52-67` |
| Détecter une prédiction | `chercherPredictions()` | `lib/domain/marqueurs-prediction.ts` |
| Détecter un mot interdit (« soin ») | `chercherInterdits()` | `lib/domain/lexique-interdit.ts` |

### Les gardes qui vont ROUGIR, et c'est voulu

Trois tests d'architecture comptent explicitement les fichiers de leur couche, pour que la garde ne
puisse pas devenir vide. Ils **doivent** être mis à jour, en ajoutant les nouveaux fichiers à
l'inventaire — **jamais** en relâchant l'assertion :

- `tests/astro-architecture.test.ts` — « la couche astro a bien été balayée » (inventaire de `lib/astro`) ;
- `tests/corpus-architecture.test.ts` — `expect(FICHIERS_CORPUS.length).toBe(2)` → **3** ;
- `tests/lexique-voix.test.ts` — balaie `lib/` en récursif : tout texte déposé dans `lib/corpus/`
  tombe automatiquement sous le contrôle de voix bloquant de la 2.8. **Ne jamais y ajouter d'exclusion.**

---

## Décisions

### D1 — Le ciel du jour : un changement de signe est un FAIT, pas une absence

La 5.3 a établi que sans heure, un corps dont le signe n'est pas déterminable est **absent**. Le
réflexe est de transposer : « la Lune change de signe aujourd'hui, donc son signe est indéterminable,
donc absente ». **C'est l'inverse qu'il faut faire.**

La différence est la nature de l'inconnue. Pour le thème natal, l'instant de naissance est un point
**inconnu** dans une fenêtre : dire « Lune en Cancer » est un pari sur une valeur unique qu'on ignore.
Pour le ciel du jour, il n'y a pas d'inconnue : la Lune est *réellement* en Cancer le matin et en
Lion le soir. Ce n'est pas une incertitude, c'est un **événement**, et c'est le fait le plus
intéressant de la journée.

Le ciel du jour porte donc :
- les positions à un **instant de référence déclaré** (voir D2) ;
- la liste des `changementsDeSigne` du jour — `{ corps, depuis, vers }`.

### D2 — L'instant de référence est MIDI, comme le thème de midi de la 5.1

Le jour dure 24 h ; la Lune y parcourt ~13,2°. Prendre minuit fait porter toute l'écart d'un côté ;
midi le divise par deux. C'est exactement l'argument de `resoudreInstant` (5.1) et il ne coûte rien
de le réutiliser. **Midi du jour civil Paris**, résolu en UTC par le patron `instantDepuisLocal` —
jamais « minuit + 12 h », qui est faux les deux jours de changement d'heure.

### D3 — Le jour civil du produit est celui d'`Europe/Paris`

« Bascule à minuit local » (EXPERIENCE.md). *Local* de qui ? Il n'existe **aucune colonne de fuseau
de résidence** — `utilisatrice.fuseau` n'existe pas ; le seul fuseau stocké est celui du **lieu de
naissance** (5.3), qui n'a rien à voir avec l'endroit où elle vit aujourd'hui.

Trois sources internes convergent déjà sur Paris : `FUSEAU` (ordonnanceur), `jourCivilParis`
(branche), et la résolution de l'année de référence de `lire-numerologie`. On suit. **Résidu écrit** :
une utilisatrice en Guadeloupe voit le jour basculer à 20 h locales. C'est réel, c'est assumé pour la
v1, et la correction est une colonne de préférence, pas une réécriture.

### D4 — Les transitants sont les corps RAPIDES, et c'est ce qui fait un « jour »

`CORPS_TRANSITANTS = [lune, soleil, mercure, venus, mars]`.

Un aspect de Pluton dure deux ans ; de Saturne, des mois. Les inclure produirait un horoscope
**identique pendant des mois** — et pire : la sélection « l'aspect le plus serré » se **verrouillerait**
sur le lent, parce qu'un corps lent stationne à 0,1° d'orbe pendant des semaines là où la Lune y
passe cinq heures. Le produit dirait chaque matin la même chose. Les transits lents sont réels et
importants en astrologie ; ils ne sont simplement pas l'unité du **jour**.

### D5 — Une orbe UNIQUE de 3°, déclarée, plutôt qu'une table d'orbes

L'usage astrologique module l'orbe par corps et par aspect. Ces tables ne se reconstruisent pas de
mémoire, et une erreur y est **indétectable** : elle n'échoue jamais, elle ajoute ou retire
simplement une configuration — plausible, invérifiable, faux. C'est mot pour mot l'argument qui a
fait refuser Placidus (5.1) et l'approximation de Chiron. Une constante unique, nommée et documentée,
est défendable ; une demi-table de mémoire ne l'est pas.

`ORBE_DEGRES = 3`. C'est un **paramètre**, pas une vérité : le jour où une astrologue tranche, une
constante bouge et rien d'autre.

### D6 — Les cibles natales sont le Soleil, la Lune et l'Ascendant

C'est la décision qui fixe le **coût d'écriture** du corpus (voir « le budget »). Aspecter les 13
corps natals donnerait 5 × 13 = 65 créneaux de texte ; les trois luminaires-et-angle en donnent 15.

Ce n'est pas seulement de l'économie : les transits aux luminaires et aux angles sont ceux qui
« comptent » dans la pratique, et ce sont les trois points qu'une personne identifie comme *elle*.
Les autres corps natals restent **calculés et exposés comme faits** — ils ne portent simplement pas
le texte du jour.

⚠️ L'ascendant n'existe pas sans heure de naissance (5.3). La cible disparaît alors, l'horoscope
aboutit quand même (AC5), et **rien n'invente un ascendant**.

### D7 — Aucune table, aucune migration : le cache est une mémoïsation de la partie IMPERSONNELLE

Le ciel du jour est **le même pour tout le monde**. Seuls les aspects au thème natal sont personnels,
et ils coûtent de l'arithmétique, pas des éphémérides. Donc :

- `cielDuJour(jour)` est mémoïsé dans la couche data, clé `(jour civil, identifiant d'adaptateur)`,
  **bornée à deux entrées** (hier et aujourd'hui) — un `Map` non borné dans un processus long est une
  fuite ;
- l'horoscope personnel se recalcule à chaque lecture, en quelques dizaines de microsecondes.

Trois conséquences, toutes bonnes : coût marginal nul sans écriture (FR-047), **aucune question de
conservation art. 9** (rien à exporter, rien à effacer, rien à propager — NFR-021, FR-067), et zéro
migration. C'est le raisonnement de `lire-numerologie.ts` (5.2), appliqué à une donnée qui a en plus
la mauvaise propriété d'être **datée**.

> **Ce qu'une table coûterait vraiment** : une ligne par utilisatrice **et par jour** (365/an/compte)
> de pure dérivation, art. 9, à conserver et à effacer — et un cache dont la source **bouge** : la 5.3
> recalcule le thème natal le jour où l'heure arrive. Un horoscope mis en cache avant ce recalcul
> resterait juste-en-apparence pour toujours.

### D8 — Le mantra ne dépend QUE du jour, et la signature de la fonction EST la garantie

FR-033 : « ne référence jamais le journal, une branche ou un échange ». Une consigne se contourne par
distraction. Ici c'est une propriété du type :

```ts
mantraDuJour(jour: JourCivil): TexteCorpus        // rien d'autre n'entre
horoscopeDuJour(theme: ThemeNatal, jour: JourCivil, ephemeride: EphemerisPort): HoroscopeDuJour
```

Il n'existe aucun paramètre par lequel le journal, une branche ou un échange pourrait entrer. Le même
mantra est servi à tout le monde le même jour — c'est le sens exact d'« impersonnel ».

La sélection est `indiceDuJour(jour, cardinal)` : jours écoulés depuis une époque fixe, modulo le
cardinal du corpus. Déterministe, sans horloge, sans hasard (les deux sont bannis de `lib/astro` par
`tests/astro-architecture.test.ts`).

### D9 — `indiceDuJour` vit dans `lib/astro/`, le texte dans `lib/corpus/`

La doctrine posée en 5.2 : `lib/astro/` → du **calcul**, aucune prose ; `lib/corpus/` → de la
**prose**, aucun calcul. Un modulo est un calcul ; la dépendance `corpus → astro` existe déjà
(`lib/corpus/numerologie.ts` importe `lib/astro/numerologie`). `lib/astro` ne doit **jamais** importer
`lib/corpus` — ce serait le cycle qui fait entrer la prose dans le socle.

D'où le paramètre `cardinal` : `lib/astro` ne peut pas connaître la taille du corpus, et n'a pas à la
connaître.

### D10 — Le socle quotidien ne porte AUCUNE prose (FR-053 structurel)

Comme `ThemeNatal` : `HoroscopeDuJour` est fait de nombres et d'énumérations. Aucun champ de texte
libre, donc **aucun endroit où une prédiction pourrait s'écrire**. La garde d'absence de
`tests/astro-architecture.test.ts` (« le thème natal ne contient aucune prose ») est étendue au
nouveau type — elle surveille l'*apparition* d'un endroit, pas un contenu.

Le texte, lui, est policé au niveau du corpus par `chercherPredictions` — et un horoscope est
précisément le genre où la prédiction est la norme. C'est la garde la plus chargée de la story.

---

## Pièges

| # | Le piège | Pourquoi il est mortel | La parade |
|---|---|---|---|
| **P1** | Réutiliser `signeAmbigu` pour déclarer la Lune du jour **absente** | Deux jours sur cinq, l'horoscope n'aurait plus de Lune — le corps qui *fait* le jour | D1 : un changement de signe est un **fait** typé (`changementsDeSigne`), pas une absence |
| **P2** | Inclure les transitants lents | Horoscope identique pendant des mois ; la sélection se verrouille sur Pluton pour deux ans | D4 : liste fermée `CORPS_TRANSITANTS`, avec un test qui **mesure** la variation sur 30 jours |
| **P3** | Calculer l'écart angulaire par une soustraction | Tout aspect à cheval sur 0° Bélier est raté : 359° et 2° sont à **3°**, pas à 357° | Arc le plus court : `d = |a−b| mod 360 ; min(d, 360−d)` — testé sur la traversée de 0° |
| **P4** | Départage non déterministe de la dominante | Deux configurations d'orbe égal → l'horoscope change entre deux exécutions. FR-047 tombe | Tri **total** : orbe, puis ordre fixe du transitant, puis ordre fixe de l'aspect, puis cible |
| **P5** | Bâtir midi comme « minuit + 12 h » | Faux les deux jours de changement d'heure — et invisible les 363 autres | `instantDepuisLocal(Date.UTC(a,m-1,j,12,0,0), FUSEAU)` |
| **P6** | Mémoïser dans un `Map` non borné | Fuite mémoire dans un processus long ; en serverless, personne ne la verrait avant la prod | D7 : deux entrées maximum, éviction explicite, testée |
| **P7** | Mémoïser **l'horoscope personnel** | Le thème natal **bouge** (recalcul 5.3) → horoscope périmé d'apparence juste, pour toujours | Seul le ciel du jour (impersonnel, immuable) est mémoïsé |
| **P8** | Passer l'identifiant de l'utilisatrice à `mantraDuJour` « pour varier » | FR-033 tombe : le mantra devient personnel, donc adressé, donc une attente | D8 : la signature n'a pas ce paramètre. Un test lit la signature |
| **P9** | Balayer un corpus **vide** et croire la garde verte | Toutes les gardes d'absence sont vacuement vraies : 0 texte écrit | Les trois disciplines de la 5.2 : (a) détecteur éprouvé pour lui-même, (b) **présence avant absence** (le nombre de créneaux DÉCLARÉS est asserté), (c) balayage prouvé sur un **faux corpus** connu-mauvais |
| **P10** | Oublier que `lireThemeNatal` **écrit** | Depuis la 5.3, une lecture peut déclencher calcul + écriture. L'appeler en boucle, ou depuis un contexte sans écriture, casse | Un seul appel par lecture de socle ; le chemin de lecture le documente |
| **P11** | Aspecter un corps natal **absent** | Chiron est toujours absent ; sans heure, d'autres le sont. Aspecter `undefined` → `NaN` → orbe 0 → dominante fantôme | Les cibles sont prises dans `theme.positions` (ce qui EXISTE), jamais dans `CORPS` |
| **P12** | Confondre mantra / ancrage / lecture | FR-080 : « en employer un pour un autre est un défaut » | Le module, le type et le corpus s'appellent `mantra`. Garde lexicale sur les identifiants ET les textes |
| **P13** | Un mantra signé, ou qui tutoie l'assiduité | FR-033 : jamais signé par Anam, pas de série, pas de « tu as manqué hier » | Garde de corpus : ni « Anam », ni marqueur de série/assiduité — éprouvée sur un faux corpus |
| **P14** | Écrire un texte de démonstration « en attendant » | Il aurait l'air d'un texte d'Anima, sous le nom d'une personne réelle (FR-086) | `NON_ECRIT` partout, comme la 5.2. Aucune valeur par défaut n'existe dans le type |

---

## Tâches

### T1 — `lib/astro/quotidien.ts` : le jour civil, l'indice, l'écart angulaire

- [x] `JourCivil { a, m, j }` — des **composantes**, jamais un `Date` : un `Date` charrie un fuseau,
      et c'est par là que « quel jour est-on ? » redeviendrait ambigu dans le domaine.
- [x] `indiceDuJour(jour, cardinal)` — jours écoulés depuis une époque fixe, modulo `cardinal`.
      Jette si `cardinal < 1`.
- [x] `ecartAngulaire(a, b)` — arc le plus court, `[0, 180]` (P3).
- [x] Tests : traversée de 0°, jours consécutifs, années bissextiles, `cardinal` de 1, déterminisme.

### T2 — `lib/astro/quotidien.ts` : le ciel du jour

- [x] `CielDuJour { instantReference, positions, absents, changementsDeSigne }`.
- [x] `cielDuJour(jour, ephemeride, instantReference)` — l'instant est **passé** (le domaine ne
      résout aucun fuseau ; c'est la couche data qui le fait, patron `lire-numerologie`).
- [x] Les changements de signe : échantillonnage horaire sur les 24 h du jour, **uniquement pour
      `CORPS_TRANSITANTS`** — un corps lent ne change pas de signe en un jour.
- [x] Tests : un jour où la Lune change de signe (fait vérifié contre l'éphéméride réelle), un jour
      où elle n'en change pas, Chiron absent avec sa raison, déterminisme.

### T3 — `lib/astro/quotidien.ts` : les configurations

- [x] `Aspect`, `ASPECTS` (nom + angle), `ORBE_DEGRES`, `CORPS_TRANSITANTS`, `CIBLES_NATALES`.
- [x] `Configuration { corpsTransitant, aspect, cible, orbe }` — la cible est de type
      `Corps | "ascendant"` : l'ascendant **n'est pas un corps** (il n'est dans aucune éphéméride),
      c'est un angle. Le glisser dans `Corps` casserait `CORPS`, sur lequel `calculerThemeNatal` itère.
- [x] `configurations(ciel, theme)` — toutes celles dans l'orbe, **triées par un ordre total** (P4).
- [x] La cible `ascendant` vient de `theme.angles` quand il est calculé, et **disparaît** sinon (P11).
- [x] Tests : aspect à cheval sur 0°, orbe limite (exactement 3° → dedans ; 3,001° → dehors),
      cible absente, thème sans heure, départage de deux orbes égaux.

### T4 — `HoroscopeDuJour` et l'absence de prose

- [x] `horoscopeDuJour(theme, jour, ephemeride, instantReference)` → `{ jour, ciel, configurations, dominante? }`.
- [x] ⚠️ **Pas de champ `schema`**, et ce n'est pas un oubli : `ThemeNatal.schema` existe parce que le
      thème est **gravé** et qu'une forme stockée doit pouvoir migrer (5.3, D4). Ici rien n'est stocké
      (D7) — un numéro de version serait un rite copié qui laisserait croire qu'il existe quelque part
      un document à migrer.
- [x] Étendre la garde « aucune prose » de `tests/astro-architecture.test.ts` au nouveau type (D10).
- [x] Test **de variation** : sur 30 jours consécutifs, la dominante change au moins N fois — c'est
      la garde qui tue le mutant P2 (transitants lents).

### T4bis — `luneRelative` : la Lune du jour rapportée au Soleil natal (D11)

- [x] `luneRelative(ciel, theme)` → `{ statut: "calcule", distance: 0..11 } | { statut: "non_calcule", raison }`.
- [x] La distance est en **signes**, pas en degrés : `(indexSigneLune − indexSigneSoleilNatal + 12) % 12`.
      Le `+ 12` n'est pas de la superstition — `%` garde le signe du dividende en JavaScript (le piège
      déjà documenté dans `normaliserDegres`), et un index négatif donnerait `undefined` sans planter.
- [x] Absente **avec sa raison** si le Soleil natal manque, ou si la Lune du jour manque. Jamais de repli.
- [x] Tests : les 12 valeurs atteignables, le passage Poissons→Bélier, Soleil natal absent.

### T5 — `lib/corpus/mantra.ts` (60 créneaux)

- [x] `CLES_MANTRA` (`"mantra:1"` … `"mantra:60"`), corpus déclaré, **tous `NON_ECRIT`**.
- [x] `mantraDuJour(jour)` → `TexteCorpus`, via `indiceDuJour(jour, CLES_MANTRA.length)`.
- [x] Mettre à jour `tests/corpus-architecture.test.ts` : inventaire à **3** fichiers.
- [x] Gardes de corpus, éprouvées sur un **faux corpus** connu-mauvais (P9, P13) : aucune prédiction,
      aucun mot interdit, aucune signature d'Anam, aucun marqueur de série.

### T6 — `lib/corpus/horoscope.ts` (27 créneaux)

- [x] 15 clés `aspect:<aspect>:<cible>` + 12 clés `lune_relative:<0..11>` — format cohérent avec 5.2
      (`"<domaine>:<valeur>"`, décidé une fois dans `lib/corpus/numerologie.ts:52-67`).
- [x] Constructeurs de clé qui **jettent hors domaine** (`cleAspect`, `cleLuneRelative`), comme
      `cleNumerologie` : une clé inconnue est un défaut de code, pas un texte en attente.
- [x] Tous `NON_ECRIT`. Même jeu de gardes que T5.
- [x] Fiche d'écriture pour Anima, sur le modèle de `corpus-numerologie-a-ecrire.md`.

### T7 — `lib/data/lire-quotidien.ts` : le chemin de lecture

- [x] `server-only`. Résout « maintenant » → `JourCivil` **Europe/Paris** et l'instant de midi (D2, D3).
- [x] ⚠️ **Ne pas réécrire la conversion local→UTC.** Elle existe : `instantDepuisLocal` dans
      `lib/astro/theme-natal.ts` (point fixe en deux passes, changement d'heure géré). Elle est
      **privée** — l'**exporter**, ne pas en faire une seconde. Deux implémentations de la même
      conversion divergeront un jour de changement d'heure, et ce jour-là personne ne regardera.
- [x] Mémoïsation bornée du ciel du jour (D7, P6).
- [x] Union de résultat : `{ statut: "calcule", … } | { statut: "indisponible", raison }` — patron
      `lire-numerologie.ts`. **Le mantra est rendu dans les deux cas** (AC6).
- [x] Sous le JWT de l'utilisatrice, jamais `service_role` (AD-12). Aucune donnée dans les erreurs (NFR-022).
- [x] Un seul appel à `lireThemeNatal` (P10).

### T8 — Les gardes d'architecture

- [x] `tests/astro-architecture.test.ts` : inventaire de `lib/astro` mis à jour ; ni horloge ni hasard
      dans `quotidien.ts` ; monopole de l'adaptateur inchangé.
- [x] `tests/corpus-architecture.test.ts` : inventaire à 3 ; pureté des deux nouveaux corpus.
- [x] Nouveau : `lib/astro` n'importe **jamais** `lib/corpus` (D9) — le cycle qui ferait entrer la
      prose dans le socle.
- [x] Nouveau : `quotidien.ts` et `mantra.ts` n'importent ni `lib/data`, ni `depot-journal`, ni
      `branche`, ni `seance` (FR-033, structurel — P8).
- [x] `tests/socle-jamais-coupe.test.ts` : **deux inventaires de fichiers du socle écrits en dur**
      (l. 192-195 et 221-224) — y ajouter `lib/astro/quotidien.ts`, `lib/corpus/mantra.ts`,
      `lib/corpus/horoscope.ts` et `lib/data/lire-quotidien.ts`. FR-055 met l'horoscope et le mantra
      dans le gratuit à vie : un fichier du socle absent de cet inventaire n'est **pas** contrôlé.
      ⚠️ Ce test refuse tout registre commercial **jusque dans les commentaires** (constat de la 5.2).

### T9 — Campagne de mutation

- [x] Snapshot par `cp` vers le scratchpad — **jamais** `git checkout` (le dépôt porte du travail non
      commité ; cette règle a été payée en 3.4).
- [x] Mutants obligatoires : orbe strict→large, arc long au lieu du plus court, transitants lents
      réintroduits, départage retiré, cible absente aspectée quand même, mémo non borné, mantra
      indexé sur autre chose que le jour, corpus vide déclaré « écrit ».

---

## D11 — Le budget du corpus : 87 créneaux (décision Julian, 2026-08-11)

Le code marche avec un corpus **entièrement non écrit**, exactement comme la 5.2 : les positions et
les configurations s'affichent, les textes se déclarent absents. Rien n'est bloqué. Mais le nombre de
créneaux **déclarés** est une décision, parce que chacun est du travail d'écriture pour **une seule
personne**, et qu'Anima en a déjà 69 devant elle.

**Option retenue : la complète — +87 créneaux, portant le corpus produit de 69 à 156.**

| Corpus | Clés | Nombre | Rôle |
|---|---|---|---|
| `horoscope` | `aspect:<aspect>:<cible>` | 5 × 3 = **15** | La configuration dominante, **quand elle existe** |
| `horoscope` | `lune_relative:<0..11>` | **12** | La Lune du jour rapportée au Soleil natal — **présent tous les jours** |
| `mantra` | `mantra:<1..60>` | **60** | Cycle de deux mois |

**Pourquoi les 12 de `lune_relative` sont ce qui justifie l'option.** Sans elles, une configuration
dans l'orbe n'existe qu'environ un jour sur deux — et les autres jours, la carte n'aurait que des
faits. Un « rendez-vous quotidien » à moitié vide n'est pas un rendez-vous. La distance en signes
entre la Lune du jour et le Soleil natal est toujours définie, elle est **personnelle**, elle ne
demande que le Soleil natal (disponible même sans heure de naissance), et c'est la base
traditionnelle de la lecture du jour.

⚠️ **Elle change tous les ~2,5 jours** — donc le même créneau `lune_relative` sort deux à trois jours
de suite. C'est ce qui rend la configuration dominante nécessaire par-dessus : c'est elle qui fait
qu'un jour ne ressemble pas au précédent. **Résidu à écrire** : sur une série de jours sans
configuration, le texte se répète. C'est le ciel qui est comme ça, pas le code — mais il faut que la
5.6 le sache avant de dessiner la carte.

⚠️ **`lune_relative` dépend du Soleil natal.** Si le Soleil est absent du thème (signe indéterminable
— rare, ~1 naissance sans heure sur 30, cf. 5.3/D1), le créneau **disparaît avec sa raison**. Il ne
se replie ni sur un signe deviné, ni sur la date de naissance.

Ajouter des clés plus tard ne casse rien et l'inventaire de complétude suit — mais on part d'ici.

---

## Ce qu'il faut vérifier avant de coder

1. `astronomy-engine@2.1.19` sait déjà tout faire ici — aucune dépendance nouvelle.
2. La fréquence réelle des configurations : **à mesurer** sur 90 jours avec un thème d'exemple avant
   de figer `ORBE_DEGRES`. Si moins d'un jour sur trois porte une configuration, l'orbe ou la liste
   des cibles est à revoir — et c'est une mesure, pas une intuition.

---

## Dev Agent Record

### Résultat

| | Avant (`08d8770`) | Après |
|---|---|---|
| Tests | 2528 / 176 | **2632 / 178** |
| Migrations | 0040 | **0040** — aucune ajoutée (D7) |
| Campagne de mutation | — | **22 mutants, 22 tués** |

`tsc --noEmit` propre · `eslint .` propre · `next build` propre. Snapshot `cp` avant campagne,
arbre vérifié **identique** au snapshot après ; le harnais a été supprimé.

### Ce que les tests m'ont appris (et que la relecture n'avait pas vu)

1. **Ma sonde astronomique était décalée d'un jour.** J'avais mesuré les changements de signe de la
   Lune sur des fenêtres UTC étiquetées « jour d », alors qu'elles couvraient le jour PARISIEN d+1.
   Trois tests ont rougi sur des faits que j'avais notés comme vérifiés. Les dates réelles sont le
   **13 août** (Lune lion→vierge) et le **23 août** (Soleil lion→vierge).
2. **`lexique-interdit` ne bannit pas le substantif « soin ».** Mon faux corpus de contrôle utilisait
   « un moment de soin » et n'était pas attrapé — le lexique vise le VERBE (`soigner`) et la locution
   (`prends soin de`), parce que bannir le substantif ferait sauter « be**soin** ». Décision de la
   2.8. Sans ce test, j'aurais conclu que le balayage était cassé.
3. **La garde FR-055 mord jusque dans les commentaires**, et elle a mordu sur les miens :
   `lib/corpus/mantra.ts` citait le registre de la facturation pour EXPLIQUER FR-080. Constat déjà
   consigné en 5.2 ; il fallait le payer une deuxième fois pour l'intégrer.
4. **Mon test de non-mémoïsation du personnel ne prouvait rien.** Il comparait deux thèmes du même
   jour de naissance (avec/sans heure) qui, ce jour-là, donnaient **exactement le même horoscope**.
   Remplacé par deux thèmes dont les Soleils sont dans des signes différents.
5. **Cinq mutants ont survécu à la première campagne** — voir ci-dessous. Aucun n'était inoffensif.

### Les cinq survivants de la première campagne

| Mutant | Pourquoi il a survécu | Ce que ça a changé |
|---|---|---|
| **M4** — départage total retiré | `Array.sort` est **stable** depuis ES2019, et l'ordre d'insertion coïncide avec le départage… sauf pour l'**aspect**, bouclé en dernier à l'insertion mais départagé AVANT la cible. Mon test tombait dans la zone de coïncidence. | Test refait sur le seul cas où les deux ordres DIVERGENT. La règle explicite est portante — mais elle ne l'est que là. |
| **M13** — distance de Lune signée | Mon cas « piège du modulo » donnait `11 − 0 = 11` : jamais négatif. Le `+ 12` n'était pas exercé. | Cas ajouté dans l'autre sens (Lune en bélier, Soleil en poissons). |
| **M17** — dominante = la plus lâche | Le jour réel testé ne portait **qu'une** configuration : `[0]` et `[length-1]` y sont le même élément. | Test sur un ciel fabriqué à trois configurations d'orbes distinctes. |
| **M18** — mantra figé sur le premier créneau | **Les 60 créneaux sont `non_ecrit` : deux mantras sont indiscernables par leur valeur.** Comparer les sorties ne pouvait rien prouver. | `cleMantraDuJour` **exporté** — la sélection devient observable. C'est une décision de conception née d'un mutant. |
| **M22** — mantra indexé sur l'utilisatrice | Même cause : `a.mantra` et `b.mantra` étaient égaux parce que tous deux vides. FR-033 n'était garanti que par la signature, pas par un test. | Espion sur l'ARGUMENT passé à `mantraDuJour` : un seul paramètre, égal au jour civil, identique pour deux comptes. |

> **La leçon, en une ligne :** un corpus vide rend toute assertion sur son CONTENU vacue. Ce qu'il
> faut observer, c'est la **sélection** — quelle clé a été demandée — pas le texte servi.

### Écarts assumés par rapport au dossier

- **`cielDuJour` prend un `JourResolu`, pas un `JourCivil` + un instant.** Le domaine ne peut pas
  dériver les bornes d'un jour sans choisir un fuseau ; le triplet (jour, fenêtre, référence) est
  produit par la couche data et consommé tel quel. C'est plus honnête que trois paramètres dont
  deux devraient rester cohérents entre eux.
- **`assemblerHoroscope` a été extrait de `horoscopeDuJour`.** Sans cette séparation, la
  mémoïsation du ciel (D7) était impossible sans mémoïser aussi le personnel (P7).
- **`instantDepuisLocal` a été EXPORTÉ de `theme-natal.ts`** plutôt que réécrit, comme le dossier
  l'exigeait.
- **`cleMantraDuJour` n'était pas prévu** — voir M18.

### File List

**Nouveaux**
- `lib/astro/quotidien.ts`
- `lib/corpus/mantra.ts`
- `lib/corpus/horoscope.ts`
- `lib/data/lire-quotidien.ts`
- `tests/quotidien.test.ts`
- `tests/corpus-quotidien.test.ts`
- `tests/lire-quotidien.test.ts`
- `_bmad-output/implementation-artifacts/corpus-quotidien-a-ecrire.md`
- `_bmad-output/implementation-artifacts/5-4-horoscope-mantra-du-jour.md`

**Modifiés**
- `lib/astro/theme-natal.ts` (export de `instantDepuisLocal`)
- `tests/astro-architecture.test.ts` (inventaire, 3ᵉ point de composition, D9, FR-033 structurel)
- `tests/corpus-architecture.test.ts` (inventaire 2 → 4)
- `tests/socle-jamais-coupe.test.ts` (filet FR-055 honoré ×2 + preuve positive)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/deferred-work.md`

### Couverture des critères d'acceptation

| AC | Où c'est prouvé |
|---|---|
| AC1 — calculé, jamais un modèle ; servi depuis le cache | `astro-architecture` (frontière AD-6) · `lire-quotidien` (« la SECONDE lecture ne relit AUCUNE éphéméride ») |
| AC2 — texte court, gratuit, non interactif, du corpus | `corpus-quotidien` (60 créneaux déclarés) · `socle-jamais-coupe` (aucune garde commerciale) |
| AC3 — impersonnel, jamais signé, ne référence rien | `astro-architecture` (P8/DUR, imports) · `lire-quotidien` (espion sur l'argument) · `corpus-quotidien` (détecteur de signature et de série) |
| AC4 — aucune prédiction | `quotidien` (aucune chaîne libre dans la sortie) · `corpus-quotidien` (balayage prouvé sur faux corpus) |
| AC5 — aboutit sur un thème incomplet | `quotidien` (thème sans heure) · `configurations` (P11, cible absente) |
| AC6 — le mantra sort même sans thème | `lire-quotidien` (`it.each` sur les trois raisons) |
| AC7 — déterminisme, y compris le départage | `quotidien` (P4/DUR × 2, déterminisme sur données réelles) |
| AC8 — rien en base, aucune migration | Aucune migration au dossier · `lire-quotidien.ts` ne contient aucun `insert`/`update`/`upsert` |

### Change Log

| Date | Quoi |
|---|---|
| 2026-08-11 | Dossier créé (`create-story`) — statut `ready-for-dev` |
| 2026-08-11 | Budget de corpus tranché par Julian : option complète, 87 créneaux (D11) |
| 2026-08-11 | T1→T9 livrées. 2632 tests / 178 fichiers. 22 mutants, 22 tués. Statut `review` |

## Status

done

> **Revue de code : 2026-08-13.** A4 : les cibles trop rapides pour être aspectées sans heure de naissance étaient quand même aspectées. B4 : le mantra gratuit à vie tombait avec le thème.
> Dossier complet : [`revue-dette-2026-08.md`](revue-dette-2026-08.md).
