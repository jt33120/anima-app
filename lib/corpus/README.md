# lib/corpus — les textes d'Anima

**Tout ce qui est écrit ici a un auteur, et cet auteur est Anima.** Pas Anam (l'intelligence
artificielle), pas un modèle de langage, pas nous.

Ce n'est pas une politesse envers l'autrice, c'est deux exigences du produit qui se combinent :

- **FR-054** — « Les interprétations proviennent du **corpus d'Anima**. Aucun texte générique acheté
  ou repris. »
- **FR-086** — « Anam ≠ Anima. Anima est une **personne réelle et identifiable**. Anam ne fabrique
  jamais une parole d'Anima. **Toute citation inventée attribuée à une personne réelle est un défaut
  critique.** »

Les trois façons de remplir ces textes sans elle sont fermées, chacune pour sa raison :

| | Ce qui casse |
|---|---|
| Les faire **générer** par un modèle | FR-047 (le socle est calculé) **et** FR-054 |
| Les **écrire nous-mêmes** | c'est alors du texte générique repris — précisément ce que FR-054 bannit |
| Les **acheter** ou les **recopier** | FR-054, et le droit d'auteur par-dessus |

Et dans les trois cas, le texte finirait signé du nom d'une personne réelle.

## Pourquoi cette couche est séparée de `lib/astro/`

`lib/astro/` est le socle, et il ne produit **que des nombres et des énumérations**. C'est ce qui
rend FR-053 (« le socle ne prédit jamais ») **structurel** plutôt que déclaratif : il n'y existe
aucun endroit où une prédiction pourrait s'écrire, et une garde d'absence surveille l'apparition
d'un champ de texte (`tests/astro-architecture.test.ts`).

Poser de la prose dans `lib/astro/` détruirait cette propriété — la garde se mettrait à voir du
texte partout et ne protégerait plus rien. D'où deux couches, toutes deux **pures**, de deux natures :

```
lib/astro/   → du CALCUL, aucune prose.        lib/corpus/ → de la PROSE, aucun calcul.
```

## Ce que cette couche n'a pas le droit de connaître

Aucun import de `@/lib/ai/*` (il n'existe pas de « génération » de corpus), aucun de `@/lib/data/*`,
aucun `server-only`, aucun Supabase, aucun `app/`, aucun `render/`. Un corpus est une **constante** :
il se relit à l'identique, sans base, sans réseau, sans appel facturé.

Gardé par `tests/corpus-architecture.test.ts`.

## Deux contrôles que cette couche reçoit gratuitement

1. **Le contrôle de voix bloquant de la Story 2.8.** `tests/lexique-voix.test.ts` balaie `app/`,
   `render/` et `lib/` **en récursif** — donc tout texte déposé ici passe automatiquement sous le
   lexique médical (NFR-008), les formulations bannies (FR-085), « soigner » (FR-023) et l'interdit
   d'emoji. C'est une des raisons du choix de l'emplacement, et la raison pour laquelle
   **`lib/corpus/` ne doit JAMAIS être ajouté aux exclusions de ce test.**
2. **Le détecteur de prédiction (FR-053).** `lib/domain/marqueurs-prediction.ts`, appliqué à chaque
   texte écrit par `tests/corpus-architecture.test.ts`.

## L'état des corpus

| Corpus | Créneaux | Écrits | Story |
|---|---|---|---|
| **Numérologie** (`numerologie.ts`) | 69 | **0** | 5.2 |
| Mantras du jour | — | — | 5.4 |
| Ennéagramme | — | — | 5.5 |
| Sens des cartes | — | — | 5.7 |

Le corpus numérologique est **déclaré complet et écrit à zéro**. Ce n'est pas un travail inachevé,
c'est la seule forme conforme : les 69 créneaux existent, chacun se rend honnêtement `non_ecrit`, et
le jour où Anima en écrit un, il suffit de remplacer une entrée.

**Porte pré-lancement ouverte** — voir `sprint-status.yaml`, entrée « LE CORPUS D'ANIMA ». Par ordre
d'urgence : les 12 textes du **chemin de vie** (le seul nombre que les gens connaissent, il suffit à
rendre la carte vivante), puis les 12 de l'**expression**, puis les 45 restants. La fiche d'écriture
est `_bmad-output/implementation-artifacts/corpus-numerologie-a-ecrire.md`.

## Comment on écrit un créneau

```ts
import { ecrit } from "./port";
import { cleNumerologie } from "./numerologie";

// dans la table de CORPUS_NUMEROLOGIE :
[cleNumerologie("chemin_de_vie", 7)]: ecrit("…"),
```

`ecrit()` refuse une chaîne vide à la construction : un créneau vide déclaré « écrit » passerait le
compte de complétude et n'afficherait rien — le pire des deux mondes.
