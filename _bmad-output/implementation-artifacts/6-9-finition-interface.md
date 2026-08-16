---
baseline_commit: 56476cb
---

# Story 6.9 : La finition d'interface (QA T7, T13, T26)

Status: review

## Story

En tant qu'utilisatrice,
je veux trouver la porte de secours partout, savoir qu'Anam travaille quand j'attends, et voir les
ressources d'aide quand elles arrivent,
afin que le produit ne me laisse jamais seule devant un écran qui ne dit rien.

**Couvre :** QA T7 · T13 · T26 · FR-077 · AI Act art. 50 (FR-013) · AD-9 · AD-15.

---

## T7 — la mention IA hors scène, et ce que j'ai trouvé en ouvrant le dépôt

Le tour de QA disait : « la mention IA n'existe que sur la scène, pas sur les cinq haltes ».

**C'était plus grave.** Hors de la scène, **aucune page ne menait à `/aide`** — sauf `/barriere` et
`/aide` elle-même. Or la porte de secours n'est pas une commodité de navigation : FR-077 la veut
« toujours là, indépendante de toute détection », et `lib/scene/surimpression.ts` va jusqu'à la
garantir **au type** (`porteSecours: true` littéral). Pour la scène. Ailleurs, elle n'existait pas.

Quelqu'un qui va mal ne va pas forcément mal dans la région de conversation. Elle peut être en train
de relire ce qu'Anam retient d'elle.

### D1 — Un inventaire, pas une liste des pages actuelles

Un test qui vérifierait « les neuf haltes portent le pied » n'empêcherait pas la dixième d'être
écrite sans lui — c'est exactement comme ça que la neuvième est arrivée. `lib/domain/pied-halte.ts`
donne donc un verdict aux **9 haltes ET aux 10 pages exclues**, et le test exige que
`app/**/page.tsx` soit **exactement l'union des deux**. Même renversement de charge que les
inventaires d'export (6.6) et d'effacement (6.7).

### D2 — La mention IA n'est PAS mise partout, et c'est le point délicat

La règle n'est pas « partout ». La coller sur `/reglages`, où il n'y a que des cases à cocher, ne
protège personne — et l'affaiblit là où elle compte, en la transformant en décor de bas de page.

L'art. 50 couvre deux choses : être informé qu'on **interagit** avec une IA (§1 — c'est la
conversation, déjà tenue par la surimpression), et savoir qu'un **contenu** a été produit
artificiellement (§2). Les haltes relèvent du second : on n'y parle à personne, **on y relit ce
qu'une machine a écrit sur soi**. La mention est donc due sur `memoire`, `synthese`, `enneagramme`,
`lectures`, `ancrages` — et pas sur les quatre autres. Chaque verdict porte son motif.

### D3 — Le texte est hissé, pas recopié

`"Anam est une IA"` était un littéral dans le JSX de la surimpression. Deux littéraux d'une mention
à enjeu légal divergent au premier ajustement de copie, et l'un des deux devient faux. La constante
vit désormais dans `lib/scene/surimpression.ts` ; l'assertion de `tests/surimpression.test.ts` qui
exigeait le littéral **a été retournée** et exige maintenant son absence.

---

## T13 — 7,4 s sans signe de vie

Le constat n'était pas tout à fait exact : un signe existe depuis la 2.2 — le glyphe d'Anam épaissit
son trait dans la surimpression. Mais **il fait 20 px, il passe de 1,5 à 2,75 px, et il est en haut
de l'écran.** Elle vient d'appuyer sur « Envoyer » : elle regarde le bas.

Le signal était au bon endroit pour le produit, au mauvais endroit pour elle.

### D4 — On ne rouvre pas la décision de la 2.2, on la déplace

« Jamais trois points qui rebondissent » est une décision de produit, pas un détail de style : un
indicateur nerveux à l'endroit exact où une réponse intime va paraître dirait « la machine calcule ».
Le **même** geste — le trait épais, non cyclique — paraît maintenant en fin de fil, à taille lisible.
Le fait qu'il soit **apparu** est le signe. Un test lit la feuille de style et refuse tout
`@keyframes` dans ce bloc.

### D5 — L'annonce a11y passe par la région qui existe DÉJÀ

Le signe est `aria-hidden`. Quelqu'un sans écran vivait le même silence de sept secondes, sans même
le glyphe — ouvrir une **seconde** région `aria-live` aurait été la faute évidente (deux régions
vivantes se doublent sur NVDA). L'attente écrit dans la région unique du fil, que `aria-atomic`
fait remplacer par le message complet à la fin.

---

## T26 — le fil sort du champ au moment de la détresse

### ⚠️ Ce que je ne peux pas vérifier, et il faut le dire avant le reste

**jsdom n'a pas de moteur de mise en page.** Toutes les hauteurs y valent zéro. Le constat « le fil
ne fait que 307 px dans une fenêtre de 742 » est **invérifiable dans ce dépôt**, et le restera :
c'est une mesure de navigateur réel, elle ne se re-mesure que dans un navigateur réel.

**Julian doit re-mesurer.** Ce que je livre est le mécanisme, pas la preuve.

### D6 — Le filet vient à elle : l'unique exception au suivi non captif

Le suivi du bas est non captif depuis la 2.2 (AC3) : si elle a remonté le fil, on ne la ramène pas.
Bonne règle, et elle a exactement un cas où elle nuit. Si le bloc de ressources s'insère alors
qu'elle n'est pas ancrée en bas, **il paraît hors du champ** : le filet est là, et personne ne le
voit. AD-9/AD-15 tranchent — le filet doit ATTEINDRE. `scrollIntoView({ block: "nearest" })`, sur le
bloc de ressources **et rien d'autre**, une seule fois par épisode (un test mesure qu'un tour
ordinaire ne ramène rien : la correction ne doit pas fabriquer le défilement captif que la 2.2 a
refusé).

### D7 — La région de conversation rend l'air qu'elle payait sans défiler

`.region` réserve `--cible-tactile + --esp-6` en haut et en bas, soit 152 px. Cette réserve protège
un entête focalisé de passer sous la surimpression **en cas de débordement**. Or la région de
conversation ne défile pas (`overflow: hidden`) : c'est le fil qui défile, à l'intérieur. Les 64 px
d'air supplémentaires ne protégeaient rien et rétrécissaient le fil.

---

## Dev Agent Record

### Deux tests ont été retournés, et chacun avait servi

| Test | Ce qu'il exigeait | Pourquoi il change |
|---|---|---|
| `surimpression.test.ts` | le littéral « Anam est une IA » DANS le composant | il a été hissé en source unique — ce qui est gardé maintenant est plus fort |
| `rendu/porte-de-sortie.test.tsx` | (rien) — il montait la vraie page | la page monte désormais un composant SERVEUR async ; il est doublé, et sa garde vit dans son propre fichier |

### Vérification

- **269 fichiers / 4575 tests** verts ; `tsc --noEmit`, `eslint .`, `next build` propres
- Aucune migration : cette story ne touche pas la base
- **32 mutants, 32 tués** (campagne commune 6.9 / 3.6 / T4), en trois passages

### Ce que la campagne de mutation a trouvé, et c'est une leçon de méthode

Six survivants au premier passage. **Deux étaient des mutants équivalents — donc deux fautes à moi**
(élargir `porteSecours: true` en `true as const` ne change rien ; `>` en `>=` non plus, la branche
d'égalité étant traitée avant). Les quatre autres formaient **une seule famille**, et c'est ce qui
mérite d'être retenu :

> **Mes gardes vérifiaient qu'un nom APPARAÎT dans un fichier, pas qu'il SERT.**

- `mentionIA={false && piedPour("memoire").mentionIA}` éteignait la mention **en gardant les deux
  chaînes** que le test cherchait ;
- supprimer `<p>{RECONDUCTION}</p>` laissait le mot `RECONDUCTION` dans la **ligne d'import**, donc
  le test restait vert sur une surface de vente devenue muette sur la reconduction — c'est-à-dire
  en infraction à l'art. L215-1 ;
- comparer deux `indexOf` sur tout le fichier mesurait l'ordre des **imports** pendant que le rendu
  affichait deux fois le premium ;
- l'annonce d'attente aux lecteurs d'écran n'était **exercée par personne**.

C'est le même patron qu'en 6.7 (le `on delete restrict` compté dans un `comment on table`) et il
s'est reproduit **dans le test qui venait de le corriger** : ma garde « pas de seconde région
`aria-live` » comptait le commentaire qui explique pourquoi il n'y en a pas.

Deux gardes ont dû rester **de forme**, et le disent : le type littéral `porteSecours: true` (aucun
comportement ne peut mesurer une impossibilité) et le câblage exact du pied dans chaque page (la
seule alternative serait de monter des composants serveur qui lisent la base).

### Dette laissée

- ⚠️ **T26 doit être re-mesuré dans un vrai navigateur.** Aucun test ne peut statuer.
- Les haltes ne sont toujours atteignables que par URL (dette commune, déjà inscrite).

---

## Change Log

| Date | Ce qui change |
|---|---|
| 2026-08-16 | Story livrée. Ferme T7 et T13 ; livre le mécanisme de T26, dont la mesure reste à faire. |
