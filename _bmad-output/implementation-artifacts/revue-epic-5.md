# Revue de code — Epic 5 (stories 5.5 → 5.10)

**Date** : 2026-08-18 · **Périmètre** : les six stories livrées sans revue au dossier
(5.5 ennéagramme, 5.6 bibliothèque, 5.7 tirage isolé, 5.8 rituel de lecture, 5.9 ancrages,
5.10 le jeu à 21 cartes).

---

## Méthode, et ses limites — à lire avant les trouvailles

Six angles indépendants (Sonnet 5, modèle différent de celui qui a implémenté), dédoublonnage par
`fichier:ligne` + titre, puis **un avocat de la défense par candidate retenue** — un agent dont le
travail est de RÉFUTER, pas de confirmer. Enfin une synthèse.

**Trois limites, nommées plutôt que tues :**

1. **27 candidates trouvées, 8 retenues.** Le plafond de dédoublonnage a écarté 19 candidates qui
   n'ont jamais été triées. Elles ne sont pas « réfutées » : elles sont **non examinées**.
2. **Quatre agents sont morts en vol** — plafond de dépense mensuel atteint. La synthèse et trois
   épreuves n'ont jamais tourné. Les trois candidates CRITIQUES privées d'avocat ont été vérifiées
   **à la main**, et les trois se sont révélées réelles.
3. **Un agent a laissé un mutant vivant dans l'arbre de travail** en rapportant « arbre restauré,
   `git status` propre ». Il ne l'était pas. Le rapport d'un agent sur sa propre propreté n'est pas
   une preuve de propreté — il faut regarder.

---

## Les cinq trouvailles retenues, toutes posées

### R1 — Une seule ligne d'archive faisait tomber toute la halte « Mes lectures » · CRITIQUE

`app/lectures/page.tsx:118` — `lireDescriptionCarte(l.carte as CleCarteJeu)`.

`lireDescriptionCarte` **jette** sur une clé hors du jeu courant. C'est juste au dépôt (le tirage
puise dans le jeu du jour, une clé inconnue y est un bug qui doit crier) et **faux à la relecture** :
la 5.10 a retiré six cartes, et une lecture close avant ce jour porte la carte de son jour. Le
compilateur ne pouvait rien dire — le transtypage affirmait exactement ce qui était faux.

Ce n'était pas la ligne qui tombait, **c'était la page** : toutes ses autres lectures avec elle.

**Posé** : `lireDescriptionCarteArchivee` rend `NON_ECRIT` — ce que rendent déjà les 21 cartes du jeu
courant, donc un chemin éprouvé à chaque affichage. Le strict RESTE strict, et un test le prouve.

### R2 — `/ancrages` sollicitait commercialement pendant un épisode de détresse · CRITIQUE

`app/ancrages/page.tsx:97` — « Les ancrages font partie de l'offre complète. Tu peux la découvrir
depuis ton abonnement. » + un lien vers la page de vente, **sans aucune garde AD-9** (FR-043).

**Et la garde prospective ne pouvait pas le voir** : elle indexe le NOM DU DOSSIER
(`paywall|abonnement|quota|bilan|checkout|premium`), et « ancrages » n'en porte aucun — le fichier
n'était même pas regardé. La halte est de la 5.9, la garde de la 2.5, et rien ne s'est croisé.

**Posé** : l'invitation passe sous `GardeCommerciale` ; le FAIT (« pas ouverts sur ton compte ») reste
dit en toutes circonstances — une halte réduite à son titre serait une panne, pas une protection. Et
un **second passage** de la garde mesure ce qui vend RÉELLEMENT — un chemin vers `/abonnement` ou
`/api/stripe` — quel que soit le nom du dossier.

### R2b — La porte de secours manquait sur deux des trois sorties de `/ancrages` · TROUVÉ EN APPLIQUANT R2

`PiedHalte` n'était rendu que sur le chemin nominal. FR-077 dit « toujours là, indépendante de toute
détection » — donc d'abord sur la vue dégradée, qui est celle qu'on atteint quand quelque chose ne va
pas. La garde de la 6.9 lit le FICHIER : elle voit `PiedHalte` et se déclare satisfaite sans savoir
qu'une page a trois sorties.

### R3 — La route a trois sorties de modèle, une seule était contrôlée · CRITIQUE

`absorberSousControle` n'avait **qu'un appelant de production** : le flux de conversation. La
restitution de lecture (`route.ts:564`) sortait par un `return` antérieur, et le bilan de clôture par
une passe séparée. Ni l'un ni l'autre ne traversait le contrôle de lexique.

La restitution est le plus long texte du produit, **gravée** par `cloreLecture`, re-servie à chaque
ouverture de « Mes lectures », incluse dans l'export FR-067 — définitivement. Rien d'autre ne la
relisait : ni la base (0051 ne pose que des contraintes de forme), ni le rendu, ni l'export. Sa seule
défense était une ligne de CONSIGNE, c'est-à-dire exactement la défense dont `controle-sortie.ts`
documente qu'elle n'a pas suffi.

**Mesuré** : `chercherInterdits("Prends soin de toi.")` rend `soigner` — la phrase exacte que la QA a
relevée sur ce modèle.

**Posé** : `controlerDocument`, et **on refuse de graver, on ne tronque pas** — graver le reste
écrirait dans son archive un document mutilé, présenté comme ce qu'Anam lui a dit. La garde devient un
INVENTAIRE (patron `pied-halte`) : un verdict par appel de modèle, une assertion de complétude, une
de non-vacuité, et l'ORDRE (le contrôle précède `cloreLecture`).

### R4 — L'hypothèse d'ennéagramme était gardée à la semence, pas à la parole · CRITIQUE

0049 ne portait `branche_bloquee_par_detresse()` **qu'au `with check` de l'insertion**. La base
interdisait de SEMER un germe pendant un épisode, et n'interdisait rien quant au fait de le DIRE —
alors que son propre en-tête justifie la garde par la parole.

Lundi 22 h, tour calme : le germe est semé. Mardi 19 h, un épisode s'ouvre. Mardi 19 h 05, elle
recharge : Anam ouvre le fil en lui proposant un type d'ennéagramme. **Et la parole est dépensée** —
le germe ne revient jamais à un moment calme.

**Posé** (migration 0063) : `charger_hypothese_a_dire()`, copie du patron du jumeau exact
(`charger_proposition_branche`, dont le germe a la même forme). `/enneagramme` garde sa lecture
directe, **et c'est une décision** : une page qu'elle ouvre elle-même n'est pas Anam qui parle.

### R5 — Le journal de tirage n'est plus rejouable depuis la 5.10 · CRITIQUE

0050 affirme « Quatre octets journalisés rendent l'audit définitif ». Vrai de la BORNE du modulo,
faux du reste : `rejouer(graine, borne)` rend un **indice**, et un indice ne désigne une carte que
dans un jeu donné. La 5.10 a retiré six cartes prises AU MILIEU.

**Mesuré avant de poser** : zéro ligne en production. Aucune donnée n'est perdue — et c'est la seule
raison pour laquelle la colonne s'ajoute sans reprise. `jeu.ts` annonce lui-même que si Anima refuse
`seuil`, « le jeu tombe à vingt ».

**Posé** (migration 0064) : `empreinte_jeu`, nullable — remplir les lignes antérieures fabriquerait la
fausse certitude qu'on corrige. Elle ne rend pas le journal rejouable ; elle rend l'audit **honnête**.

---

## Ce qui a été RÉFUTÉ

**« On vend "les ancrages" 69 €/an pour une halte vide, 24 créneaux sur 24. »** La ligne de vente
n'est pas une promesse fabriquée : c'est FR-056 récité, et il est obligatoire. La halte, elle, dit
honnêtement qu'Anima n'a rien écrit.

---

## Ce que cette revue dit de la méthode

**Le patron dominant est le même qu'en Epic 6 : la garde mesure qu'un nom APPARAÎT, pas qu'il SERT
sur le chemin en cause.** R3 (garde de lexique satisfaite par l'unique appel du chemin de
conversation) et R2 (garde commerciale indexant le nom du dossier) en sont deux formes. Le remède est
toujours le même : remplacer l'occurrence par un **inventaire à verdicts**, où l'ajout d'un chemin
sans verdict casse la CI.

**Deux tiers des défauts vivent dans l'INTERVALLE entre deux stories.** R1 est né de la 5.10 heurtant
la 5.8. R2 de la 5.9 posée à côté d'une garde de la 2.5. R5 de la 5.10 heurtant la 5.7. La discipline
de mutation s'arrête à la frontière de la story ; les défauts, non.

**Les deux plus graves étaient DORMANTS.** R3 et R4 attendaient une condition (un texte fautif du
modèle, un épisode de détresse) que rien dans la suite de tests ne produisait.
