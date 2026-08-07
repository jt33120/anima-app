# lib/astro — le socle déterministe (voir ARCHITECTURE-SPINE AD-6/AD-1/AD-10)

**Le socle est un CALCUL, jamais un modèle de langage** (AD-6, NFR-011, FR-047). Ce n'est pas une
préférence d'implémentation :

- un modèle qui « calcule » un thème natal **hallucine des degrés** — plausibles, invérifiables par
  l'utilisatrice, faux. Ce serait le seul endroit du produit où Anam mentirait sans le savoir, dans
  la partie que l'utilisatrice croit la plus objective ;
- un modèle **redonne un résultat différent** à chaque appel : le tronc « bougerait », alors que
  FR-051 promet qu'il ne se complète qu'à l'ajout de l'heure de naissance ;
- un modèle **coûte à chaque affichage**, quand FR-047 exige un coût marginal nul.

La couche est **PURE** : aucune I/O, aucun `server-only`, aucun Supabase, aucun Next. Elle se teste
sans base et sans réseau. Gardée par `tests/astro-architecture.test.ts`, qui vérifie aussi
qu'**aucun module d'ici n'importe `@/lib/ai/*`** — c'est la frontière de déterminisme, rendue
mécanique.

## Les modules (Story 5.1)

- **`port.ts`** — `EphemerisPort`, la seule porte par laquelle une éphéméride entre dans le produit.
  Il déclare **ce que le domaine demande**, jamais ce que la bibliothèque du moment sait faire : un
  port écrit d'après son implémentation en hérite les trous. Une lecture est une **union**
  (`calcule | non_calcule` avec sa raison) et non un `number | undefined`, pour que l'appelant ne
  puisse pas écrire `?? 0` — 0° signifie « 0° du Bélier », une position parfaitement plausible.

- **`theme-natal.ts`** — le calcul. Zodiaque tropical, résolution de l'instant (fuseau IANA, midi
  UTC par défaut sans heure), ascendant / milieu du ciel par trigonométrie sphérique, maisons,
  empreinte d'entrées. **Aucune prose** : tout ce qui en sort est nombre ou énumération, donc
  FR-053 (« le socle ne prédit jamais ») est **structurel** et non déclaratif — il n'existe aucun
  endroit où une prédiction pourrait s'écrire. L'interprétation vit dans le corpus d'Anima
  (stories 5.2 et 5.6), jamais ici.

- **`adapters/astronomy-engine.ts`** — **seul fichier du dépôt autorisé à importer un moteur
  d'éphéméride** (garde de frontière, patron `tests/frontiere-stripe.test.ts`).

## Ce que l'adaptateur v1 sait faire — et ce qu'il ne sait pas

`astronomy-engine@2.1.19` : **MIT**, zéro dépendance transitive, ±1 minute d'arc (VSOP87 + NOVAS).
Choisi contre Swiss Ephemeris pour une raison de licence, pas de technique : `sweph` est
**AGPL-3.0**, et l'employer dans un service en réseau obligerait à publier tout Anima en open source.

| | v1 |
|---|---|
| Dix corps classiques (Soleil → Pluton) | ✅ |
| Ascendant, milieu du ciel, maisons | ✅ |
| Nœuds lunaires **moyen** et **vrai** | ✅ |
| **Chiron et les astéroïdes** | ❌ **porte pré-lancement** |

`astronomy-engine` n'a **aucun astéroïde** — son énumération `Body` s'arrête à Pluton. Chiron figure
donc dans `Corps` (le besoin produit est réel) et l'adaptateur le rend `non_calcule` avec sa raison.
**On ne l'approxime pas** : une propagation képlérienne dérive de plusieurs degrés en quelques
décennies, donc de plusieurs signes. Un Chiron faux est pire qu'un Chiron absent — il est
invérifiable et il a l'air juste. Le thème étant **versionné** (migration 0039, et l'identifiant
d'adaptateur entre dans l'empreinte), l'arrivée d'une source incrémentera la version sans qu'une
ligne de domaine change.

## Deux choix v1 à connaître avant d'ajouter quoi que ce soit

**Maisons en signes entiers.** Placidus demande un solveur itératif dont une erreur de signe
n'échoue jamais : elle range simplement chaque planète dans une maison voisine. Les signes entiers
sont exacts par construction, sans mode de rupture polaire, et l'ascendant — l'angle qui compte le
plus — est calculé exactement dans les deux cas. Le système est un **paramètre** et il est **inscrit
dans le thème**, jamais supposé.

**Calcul paresseux, pas à l'inscription.** `lib/data/depot-theme-natal.ts` lit, et ne calcule que
s'il n'y a rien. L'unicité vient de la **clé primaire**, pas de la discipline de l'appelant : deux
requêtes concurrentes ne produisent qu'une ligne, et une panne se répare d'elle-même à la lecture
suivante. C'est « calculé une seule fois » rendu plus fort que sa formulation littérale.

## Comment on teste de l'astronomie

`tests/theme-natal.test.ts` ne peut pas se relire pour se valider : ici l'intuition ne sert à rien,
et une formule fausse ne plante jamais — elle rend un nombre plausible. Trois recours :

1. **des faits extérieurs** — à l'équinoxe de mars le Soleil est à 0° du Bélier *par définition* du
   zodiaque tropical ; le nœud moyen vaut 125,0445° à J2000 ; l'obliquité décroît de ~47″ par siècle ;
2. **deux chemins indépendants qui doivent concorder** — notre ascendant analytique, confronté aux
   matrices de rotation d'`astronomy-engine` : s'il est juste, il est à altitude **exactement zéro**
   sur l'horizon et à l'**est** ; le milieu du ciel est à azimut 0° ou 180° selon l'hémisphère ;
3. **des propriétés structurelles** — déterminisme, bornes, monotonie du recul des nœuds.
