---
baseline_commit: 2a531823784130c95091ba5667b0bb4b3306f5a4
story_key: "5-7-tirage-isole-jeu-proprietaire"
epic: 5
story: 7
title: "Le tirage isolé & le jeu propriétaire"
epic_name: "Le socle & la lecture"
covers: [FR-015, FR-016, FR-018, FR-019, FR-022, FR-023, FR-053, FR-054, FR-067, FR-080, FR-086, AD-1, AD-11, AD-12, AD-13, AD-17, NFR-016, NFR-022]
depends_on:
  - "1-5-consentement-art9-declaration-ia"
  - "2-4-entite-episode-detresse-72h-extinction-gardee"
  - "5-2-numerologie-complete-deterministe"
  - "5-6-accueil-bibliotheque-en-cartes"
prepare_pour:
  - "5-8-rituel-lecture-restitution-ecrite"
status: review
migration: "0050_tirage.sql"
---

# Story 5.7 : Le tirage isolé & le jeu propriétaire

## Ce que cette story est — et ce qu'elle n'est pas

Cette story livre **le mécanisme du tirage**, pas le rituel de lecture.

Le rituel — Anam présente la carte, demande « Qu'est-ce que tu vois ? », attend, puis construit la
lecture à partir de la projection, puis écrit la restitution — c'est la **5.8**. Ici on construit la
seule partie du rituel dont la correction ne se juge pas à l'usage mais **à la structure** : le point
où une carte est choisie.

C'est une inversion volontaire de l'ordre naturel. On aurait pu livrer le rituel entier d'un bloc.
Mais FR-016 qualifie de **défaut critique** le fait de présenter comme aléatoire une carte choisie à
l'avance, et un défaut critique ne se rattrape pas après coup : soit l'architecture rend le choix
dirigé **impossible**, soit elle le rend seulement **interdit** — et une interdiction se contourne par
distraction six mois plus tard. AD-11 dit d'ailleurs le mot : « contrainte d'architecture, **pas
règle de code** ».

Donc la 5.7 est la story où l'on prouve que le tirage ne peut pas mentir, avant qu'il n'y ait quoi que
ce soit à raconter avec.

---

## Story

**En tant qu'**utilisatrice,
**je veux** que le tirage d'une lecture soit réellement aléatoire et totalement coupé de mon profil,
**afin de** pouvoir faire confiance à ce que la carte me renvoie.

**Couvre :** FR-015, FR-016, FR-022 · AD-11.
**Étend (au-delà de l'epic, justifié en D7 et D8) :** AD-17, FR-067, NFR-016.

---

## Critères d'acceptation

**AC1 — Le point d'entrée du tirage n'a aucun accès au profil, à l'historique ni à l'état émotionnel.**
Contrainte d'architecture, pas règle de code (FR-015, AD-11). La garde est double et redondante par
construction : la **signature** (le point d'entrée ne prend aucun argument — il n'existe aucun canal
par lequel un profil pourrait entrer) et le **verrou d'imports** (`lib/tirage/**` ne peut importer ni
`@/lib/data`, ni `@/lib/domain`, ni `@/lib/safety`, ni `@/lib/ai`, ni `@supabase`, ni le catalogue de
sens).

**AC2 — La graine vient d'un CSPRNG système, jamais dérivée de l'identité, du profil ou de l'historique.**
L'identité ne sert qu'à l'**écriture RLS** de la ligne de tirage, jamais comme entrée de sélection
(AD-11). Ordre imposé et vérifiable : **on tire d'abord, on écrit ensuite** — la fonction qui tire ne
connaît pas l'utilisatrice, la fonction qui écrit ne tire pas.

**AC3 — Sur un grand nombre de tirages, la distribution est vérifiablement uniforme.**
Test bloquant sur grand N. **Et** chaque tirage est journalisé (graine + horodatage) pour audit — la
ligne journalisée doit permettre de **rejouer** le tirage et de retrouver exactement la même carte.

**AC4 — Le catalogue de sens n'existe que côté serveur.**
Aucune représentation côté client avant la réponse de l'utilisatrice (FR-016, AD-11) — garantie par
`import "server-only"`, c'est-à-dire par un **échec de build**, pas par une convention.

**AC5 — Quand une carte paraît, c'est un visuel propriétaire créé pour Anima.**
Aucun oracle du commerce n'est embarqué (FR-022). Tant qu'un visuel n'est pas dessiné, la carte le
**dit** au lieu d'afficher un substitut — même doctrine d'absence honnête qu'en 5.6.

**AC6 — Il est impossible de sélectionner une carte servant un message prédéterminé (défaut critique FR-016).**
Le module qui tire n'importe pas le catalogue de sens : il ne peut pas savoir ce qu'une carte
« veut dire », donc il ne peut pas la choisir pour ça.

**AC7 — Aucun tirage pendant une fenêtre de détresse (AD-17).**
*Au-delà des critères de l'epic — justifié en D7.* La garde vit dans la policy `with check`, pas dans
l'appelant.

**AC8 — La description alternative dit ce qui est DESSINÉ, jamais ce que ça veut dire.**
*Au-delà des critères de l'epic — justifié en D8.* Une utilisatrice qui ne voit pas l'image doit
pouvoir projeter elle aussi ; lui donner le **sens** en texte alternatif pendant qu'on le refuse aux
autres serait une violation de FR-018 déguisée en accessibilité (NFR-016).

---

## Tâches

### T1 — Le jeu : 24 cartes qui ne portent aucun sens (`lib/tirage/jeu.ts`)

- [x] `CleCarteJeu` (union de 24 littéraux), `CarteJeu` (`{ cle }` — **et rien d'autre**), `JEU`.
- [x] ⚠️ **Collision de noms avec la 5.6** : `CleCarte` / `CarteBibliotheque` sont déjà pris par
      `lib/domain/bibliotheque.ts` (les cartes de l'accueil). Les deux notions n'ont rien à voir. Le
      suffixe `Jeu` est là pour qu'aucune relecture ne les confonde.
- [x] `TAILLE_JEU = JEU.length`, gelé. Un test vérifie l'unicité des clés et le compte.
- [x] Le jeu ne contient **ni sens, ni description, ni chemin d'image** : uniquement des identités.
      Tout ce qui pourrait servir à choisir une carte vit ailleurs.

### T2 — L'échantillonneur uniforme, sans biais de modulo (`lib/tirage/alea.ts`)

- [x] `SourceAlea` : port minimal `() => number` rendant un entier non signé sur 32 bits.
- [x] `csprngSysteme` : adaptateur sur `globalThis.crypto.getRandomValues` (Node 22 **et** Edge —
      pas de `node:crypto`, qui exclurait le runtime Edge).
- [x] `indiceUniforme(source, borne)` : **échantillonnage par rejet**. `limite = 2**32 - (2**32 % borne)` ;
      tout mot ≥ `limite` est **rejeté et retiré**. Rend `{ indice, graine }` — `graine` étant le mot
      **accepté**, celui qui détermine la carte.
- [x] `rejouer(graine, borne)` : la fonction d'audit. `rejouer(g, b) === indice` pour toute ligne
      journalisée. C'est elle qui rend AC3 vérifiable et pas seulement déclaré.
- [x] ⚠️ **Le biais de modulo ne se voit pas statistiquement.** Sur 24 cartes il vaut ~1,4·10⁻⁸ : aucun
      test sur grand N ne le détectera jamais. La garde est donc **déterministe** (T11), pas statistique.

### T3 — Le point d'entrée à zéro argument (`lib/tirage/tirer.ts`)

- [x] `import "server-only"` — un tirage côté client serait re-jouable à volonté.
- [x] `export function tirerUneCarte(): Tirage` où `Tirage = { cle, graine, tailleJeu }`.
      **Aucun paramètre.** C'est la garde AC1 : ce qui n'a pas d'entrée ne peut pas être influencé.
- [x] `tailleJeu` est rendu **avec** la graine : sans lui, l'audit casse le jour où le jeu grandit
      (voir D4 — c'est le défaut que l'on ne verrait qu'une fois qu'il serait trop tard).
- [x] Aucun horodatage ici : l'heure est **autoritaire côté base** (doctrine 0046). Le tirage rend ce
      qu'il sait ; la base date ce qu'elle reçoit.

### T4 — Le verrou d'architecture (ESLint + test)

- [x] `eslint.config.mjs` : bloc `files: ["lib/tirage/**/*.{ts,tsx}"]` avec `no-restricted-imports` sur
      `@/lib/data/*`, `@/lib/domain/*`, `@/lib/safety/*`, `@/lib/ai/*`, `@/lib/lecture/*`, `@/app/*`,
      `@/render/*`, `@supabase/*`, `next`, et `../*` (même fermeture des chemins relatifs qu'en AD-10 :
      un `../` échappe aux motifs par alias).
- [x] `no-restricted-syntax` sur `ImportExpression` — l'import dynamique n'est jamais visité par
      `no-restricted-imports` (leçon déjà payée sur `lib/domain/`).
- [x] `no-restricted-properties` / `no-restricted-syntax` sur `Math.random` dans `lib/tirage/**`.
- [x] `tests/tirage-architecture.test.ts` : la garde de la garde. Vérifie au niveau **source** que le
      verrou existe dans la config ET que `lib/tirage/**` ne contient aucun import interdit — un test
      qui ne lit que le fichier de config serait vert si le bloc visait un mauvais chemin.
- [x] `expect(tirerUneCarte.length).toBe(0)` — l'arité comme garde. Ajouter un paramètre rend rouge.

### T5 — Le catalogue de sens, server-only (`lib/lecture/sens-cartes.ts`)

- [x] `import "server-only"` **puis** un `Corpus` de 24 créneaux construit avec `corpus()` de
      `@/lib/corpus/port` — les créneaux déclarés, **aucun écrit** (FR-054/FR-086 : ces textes sont
      d'Anima, et de personne d'autre).
- [x] **Hors de `lib/corpus/`, et c'est délibéré** : `tests/corpus-architecture.test.ts` interdit
      `server-only` dans `lib/corpus/**` (un corpus du socle est une constante partagée). Celui-ci est
      l'inverse : sa valeur tient à ce qu'il **ne franchisse jamais** la frontière client. Le poser dans
      `lib/corpus/` aurait obligé à percer une exception dans une garde saine.
- [x] L'ajouter aux balayages de voix et de prédiction (FR-053, Story 2.8) **par chemin explicite**, et
      à l'inventaire de la porte pré-lancement — en le comptant **à part** des 165 créneaux du socle.

### T6 — Les descriptions littérales (`lib/corpus/description-cartes.ts`)

- [x] 24 créneaux déclarés. Ce corpus, lui, **franchit** la frontière (c'est le texte alternatif).
- [x] `chercherSensDansDescription(texte)` : le balayage AC8. Rejette les verbes de signification —
      `symbolise`, `représente`, `signifie`, `évoque`, `annonce`, `invite à`, `parle de`, `suggère`,
      `incarne`, `veut dire`, `renvoie à`. Une description dit *une porte entrouverte dans un mur de
      pierre*, jamais *le passage vers une nouvelle étape*.
- [x] Prouver le balayage sur un **faux** corpus (24 créneaux vides ⇒ toute assertion sur le contenu
      réel est vacue — la leçon des deux mutants survivants de la 5.4).

### T7 — La migration `0050_tirage.sql`

- [x] Table `tirage` : `id`, `utilisatrice`, `carte` (text), `graine` (text), `taille_jeu` (int),
      `tire_a` (timestamptz, autoritaire côté base).
- [x] RLS `deny-by-default`. `with check` portant : `utilisatrice = auth.uid()` **et**
      `a_consenti_art9()` **et** `not public.branche_bloquee_par_detresse()` (AC7).
- [x] Aucune garde dans une RPC seule : `authenticated` a le grant table, donc une garde qui ne vit pas
      dans le `with check` n'existe pas.
- [x] Contrainte `graine ~ '^[0-9a-f]{8}$'` et `taille_jeu > 0` — une ligne d'audit non rejouable est
      pire qu'une ligne absente : elle a l'air d'une preuve.
- [x] Inventaire d'effacement (FR-067) : la table part avec le compte. Le test d'effacement ordonné
      l'inclut dès sa naissance — une table art.9-adjacente ajoutée à l'inventaire six stories plus
      tard, c'est un trou RGPD qui a existé six stories.

### T8 — La couche data (`lib/data/depot-tirage.ts`)

- [x] `deposerTirage(supabase, tirage)` — prend le résultat **déjà tiré**. Elle ne tire pas.
- [x] `tirerEtDeposer(supabase)` : appelle `tirerUneCarte()` **puis** `deposerTirage`. Deux appels,
      dans cet ordre, et c'est l'ordre qui est testé (AC2).
- [x] Sur échec d'écriture : le tirage est **perdu**, pas rejoué. Rejouer après échec ouvrirait la porte
      au re-tirage silencieux, que l'UX interdit explicitement.

### T9 — Le rendu de la carte (`render/lecture/CarteTiree.tsx`)

- [x] `render/lecture/types.ts` : vue re-déclarée (le rendu ne peut pas importer `lib/domain`), portant
      `{ cle, description }` — **et pas le sens**. Le sens ne traverse pas, comme `terme` ne traversait
      pas en 5.6.
- [x] Visuel propriétaire quand il existe ; sinon **l'absence dite** : « Le visuel de cette carte n'est
      pas encore dessiné. » Pas de dos de carte générique, pas de silhouette d'emprunt.
- [x] Aucun retournement, aucun scintillement, aucun son, aucun « mélange » animé (UX, §2 du dossier
      rituel) : la carte est déjà là.
- [x] Le composant est livré **isolé**, non branché — comme `TroncSeul` en 5.6. La 5.8 le monte.

### T10 — La garde FR-022 : aucun oracle du commerce

- [x] `tests/jeu-proprietaire.test.ts` : aucune clé, aucun libellé, aucune description ne peut porter un
      nom de jeu du commerce ni un nom d'arcane — `tarot`, `oracle`, `rider`, `waite`, `marseille`,
      `lenormand`, `thoth`, `belline`, `arcane`, `le pendu`, `la papesse`, `le mat`, `l'hermite`…
- [x] Prouver le balayage sur un faux jeu contenant ces noms.
- [x] Vérifier qu'aucun binaire d'image n'entre dans le dépôt sans passer par le répertoire propriétaire.

### T11 — Les gardes bloquantes

- [x] **Rejet, déterministe** — avec une source scriptée : `limite - 1` est **accepté** ; `limite` est
      **rejeté** et le mot suivant est consommé. C'est la seule garde qui tue le mutant `%` (T2).
- [x] **Uniformité, grand N** — 240 000 tirages sur le CSPRNG réel, χ² à un seuil **très lâche**
      (quantile 0,9999) : la probabilité d'échec fortuit est de l'ordre de 10⁻⁴, et elle est écrite
      dans le test. Un χ² à 5 % rendrait la suite rouge un jour sur vingt sans qu'aucun code ne bouge.
- [x] **Rejouabilité** — pour 10 000 tirages, `rejouer(graine, tailleJeu)` retrouve la carte.
- [x] **Indépendance du profil** — ⚠️ elle ne se teste **pas** statistiquement : on ne mesure pas la
      corrélation à une entrée qui n'existe pas. La garde est l'arité (T4) + le verrou d'imports. Le
      test le **dit**, plutôt que de simuler une mesure qui n'en serait pas une.

### T12 — Campagne de mutation

- [x] Snapshot `cp` avant, restauration depuis le snapshot — **jamais** `git checkout`.
- [x] Mutants prévus : `%` sans rejet · rejet inversé · graine journalisée ≠ mot accepté · `taille_jeu`
      non journalisé · `Math.random` à la place du CSPRNG · un paramètre ajouté à `tirerUneCarte` ·
      le catalogue de sens importé par `lib/tirage/` · le sens qui traverse jusqu'à la vue · la garde
      détresse retirée du `with check` · un nom d'arcane glissé dans une description · une description
      qui signifie au lieu de décrire · l'ordre tirer/écrire inversé.

### T13 — Clôture

- [x] Suite complète verte, `tsc`, `eslint`, `next build`, `db reset` 0001→0050.
- [x] `deferred-work.md` : la commande d'art (24 visuels + 24 descriptions) et les 24 créneaux de sens.
- [x] `sprint-status.yaml`, `PORTES-AVANT-PUBLICATION.md`.

---

## Notes de développement

### D1 — Pourquoi la signature est la garde, et le lint seulement la ceinture

`tirerUneCarte()` ne prend aucun argument. Ce n'est pas une élégance : c'est la traduction en code de
« le point d'entrée n'a aucun accès au profil ».

Une fonction `tirerUneCarte(utilisatriceId)` qui *promettrait* de ne pas se servir de son argument
serait vraie aujourd'hui et fausse le jour où quelqu'un voudra « éviter de retomber deux fois de suite
sur la même carte » — une intention parfaitement bienveillante qui produirait exactement le défaut
critique FR-016. Sans paramètre, cette pensée ne peut pas s'écrire ici.

Le verrou d'imports ferme l'autre porte : une fonction sans argument peut quand même aller *chercher*
un profil. Elle ne le peut plus si elle ne peut rien importer qui en contienne.

Les deux gardes sont redondantes, et c'est voulu. Mais attention au piège déjà rencontré : **deux
défenses qui se couvrent l'une l'autre laissent survivre le mutant**. D'où deux mutants distincts en
T12 (ajouter un paramètre ; ajouter un import), chacun devant tuer sa propre garde.

### D2 — Le biais de modulo : le défaut que le test statistique ne verra jamais

`mot % 24` est presque uniforme. « Presque » vaut ici 1,4 · 10⁻⁸ d'écart relatif. Pour le détecter par
un χ², il faudrait de l'ordre de 10¹⁶ tirages.

C'est le cas d'école du test qui **rassure sans prouver**. Le grand N de l'AC3 est nécessaire (il
attrape une source cassée, un indice figé, un décalage d'un rang) mais il est **structurellement
aveugle** à la faute la plus probable du code que l'on écrit ici.

D'où l'inversion : la garde principale est un test déterministe à trois mots scriptés, qui interroge la
frontière exacte du rejet. Le χ² reste, en second, pour ce que lui seul attrape.

Corollaire à ne pas oublier : `2**32 % 24 ≠ 0`, donc le rejet est **vivant sur le chemin réel**. Si le
jeu passait un jour à 32 cartes (puissance de deux), la zone de rejet deviendrait vide et le mutant `%`
survivrait à tout. Les tests de T11 fixent donc la borne **explicitement** (3, 24, 40), et ne
l'empruntent jamais à `TAILLE_JEU`.

### D3 — Ce que la ligne journalisée prouve, et ce qu'elle ne prouve pas

Elle prouve la **rejouabilité** : la graine et la taille du jeu redonnent la carte. Un tirage falsifié
après coup ne survit pas à `rejouer()`.

Elle ne prouve **pas** que le mot accepté était le premier tiré. Un code malveillant qui rejetterait
les mots menant à une carte indésirable produirait un journal parfaitement cohérent. Ce résidu est
réel, il est borné par le fait qu'un tel rejet sélectif **déforme la distribution** et tombe donc sous
le χ² de T11 — et il est écrit dans `deferred-work.md` plutôt que tu.

### D4 — `taille_jeu` dans le journal, ou l'audit qui casse en silence

Le jour où le jeu passe de 24 à 26 cartes, toutes les lignes antérieures deviennent injouables si l'on
rejoue avec la taille *courante* : `graine % 24 ≠ graine % 26`. Le journal aurait alors l'air d'un
journal, et `rejouer()` rendrait des cartes fausses avec assurance.

Journaliser la taille au moment du tirage coûte quatre octets et rend l'audit **définitif**. C'est le
genre de détail qu'on ne remarque jamais à l'écriture et qui ne se répare pas rétroactivement.

### D5 — Pourquoi le catalogue de sens existe, alors que FR-018 interdit de s'en servir

Contradiction apparente à trancher explicitement, sinon quelqu'un la tranchera par accident.

FR-018 : « la lecture se construit à partir de la projection de l'utilisatrice, **pas d'une
signification cataloguée** ». AD-11 : « le catalogue de sens n'existe que **côté serveur** ». Donc il
existe, et il ne fonde pas la lecture.

La 5.7 ne résout pas cette tension — elle **déclare le catalogue et prouve qu'il ne traverse pas**.
Le rôle exact qu'Anam lui donne (et l'ordre : jamais avant qu'elle ait parlé) est une décision de la
5.8, où il y aura une conversation pour l'incarner. Trancher ici serait trancher à l'aveugle.

Ce qui est acquis dès maintenant : `import "server-only"` transforme « il ne doit pas traverser » en
**échec de build**. C'est la version forte d'AC4.

### D6 — Un jeu de 24, et pourquoi ce nombre plutôt qu'un autre

- **Non-puissance de deux** — le rejet reste vivant sur le chemin réel (D2).
- **Assez grand** pour qu'un doublon ne soit pas la norme : deux lectures dans le mois retombent sur la
  même carte une fois sur 24.
- **Assez petit** pour que la commande d'art soit réelle : 24 visuels + 24 descriptions + 24 créneaux
  de sens, c'est 72 objets à produire. À 78 (la forme du tarot), c'en serait 234 — et on aurait
  emprunté la forme d'un jeu du commerce en croyant n'emprunter qu'un nombre.

Les identités des 24 cartes sont **internes** (elles ne s'affichent jamais : l'UX interdit de nommer la
carte). Les renommer plus tard coûte un `UPDATE` sur `tirage.carte` — c'est réversible, contrairement
au reste de cette story.

### D7 — La garde de détresse sur le tirage (AC7, au-delà de l'epic)

L'epic ne demande pas AD-17 ici. Je l'ajoute, et voici le raisonnement — à contester si Julian le juge
excessif.

Une carte tirée pendant un épisode de détresse ouvert, puis présentée comme porteuse de sens, c'est
exactement le registre que §5 et AD-17 suspendent : le produit arrête le travail de schéma et devient
un filet. `enneagramme_hypothese` (0049) porte la garde pour la même raison — proposer une typologie à
quelqu'un en détresse. Un tirage est du même ordre, en plus chargé.

Et surtout : la table naît maintenant. Une garde ajoutée à une table qui existe déjà, c'est une
migration de rattrapage et une fenêtre pendant laquelle elle n'existait pas.

Le coût assumé : pendant la fenêtre de 72 h, une demande de lecture est refusée. La 5.8 devra le dire
avec des mots, pas avec une erreur.

### D8 — Le texte alternatif, ou l'accessibilité qui trahirait le rituel (AC8)

Le point le plus fin de la story.

L'UX est catégorique : tant qu'elle n'a pas répondu, « **aucune signification n'est affichée nulle
part** : pas de nom de carte, pas de mot-clé, pas d'infobulle ». Mais une image sans texte alternatif
est une faute d'accessibilité, et une utilisatrice au lecteur d'écran ne peut pas projeter sur une
image qu'on ne lui décrit pas.

La sortie n'est pas de choisir entre les deux — c'est de voir que **décrire n'est pas signifier**. Ce
que voit l'utilisatrice voyante, c'est un dessin : *une porte entrouverte dans un mur de pierre, au
crépuscule*. Ce n'est pas un sens ; c'est la matière sur laquelle elle projette. Le texte alternatif
doit lui être **strictement équivalent** : la même matière, dans l'autre canal.

D'où le balayage de T6, qui rejette les verbes de signification. Sans lui, la première description
écrite par distraction dirait « le passage vers une nouvelle étape » — et le lecteur d'écran
recevrait la lecture avant d'avoir eu la carte.

### D9 — Ce que cette story ajoute à la dette d'écriture, et qu'il faut regarder en face

Après la 5.6 : **165 créneaux déclarés, 0 écrit**, et l'accueil les rend visibles.

La 5.7 ajoute **24 créneaux de sens** (Anima, FR-054), **24 descriptions littérales** (produites avec
les visuels — pas d'Anima, comptées séparément) et **24 visuels propriétaires** (commande d'art).

Total après cette story : **189 créneaux d'Anima**, plus 48 objets à produire pour le jeu. Le tirage
sera mécaniquement irréprochable et n'aura **rien à montrer**. C'est cohérent avec la doctrine du
projet — on livre la structure et on dit l'absence — mais ça veut dire que la lecture n'est pas
publiable avant la commande d'art, et cette porte doit être écrite noir sur blanc.

### D10 — Nommage : trois « lecture » et deux « carte » dans le même dépôt

Piège de relecture, à poser avant de s'y prendre les pieds :

- `lib/safety/episode-lecture.ts` = **lire** un épisode de détresse. Rien à voir.
- `lib/lecture/` (nouveau) = le **rituel** de lecture. C'est le sens FR-023.
- `lecture` dans `vocabulaire.ts` (5.6) = le terme FR-080, premium, interactif.
- `CleCarte` / `CarteBibliotheque` (5.6) = les cartes de **l'accueil**.
- `CleCarteJeu` / `CarteJeu` (ici) = les cartes du **jeu**.

---

## Contraintes permanentes du dépôt

- Suite : `npx vitest run` — **jamais** en sourçant `.env.local` (la garde `refusDeCible` refuse).
- Supabase : CLI globale `/opt/homebrew/bin/supabase`, **jamais** `npx supabase`. `db reset` autorisé,
  suppression de la stack locale interdite.
- Mutation : restauration depuis un snapshot `cp`, **jamais** `git checkout`.
- Aucune clé (Stripe, Mistral, Resend, Supabase) n'entre dans l'arbre — le dépôt est **public**.
- Commit uniquement sur demande explicite de Julian.

---

## Dev Agent Record

### Ce qui a été livré

| | |
|---|---|
| **Migration** | `0050_tirage.sql` — table `tirage`, RLS, 4 gardes dans le `with check`, trigger d'horodatage, **aucune policy d'UPDATE** |
| **Suite** | **214 fichiers, 3439 tests** verts · `tsc`, `eslint`, `next build` propres · `db reset` 0001→0050 OK |
| **Mutation** | **28 mutants, 28 tués** |
| **Dette ajoutée** | 24 créneaux de sens (Anima) · 24 descriptions littérales · 24 visuels propriétaires |

### Fichiers

**Créés** — `lib/tirage/jeu.ts`, `lib/tirage/alea.ts`, `lib/tirage/tirer.ts`, `lib/lecture/sens-cartes.ts`,
`lib/corpus/description-cartes.ts`, `lib/data/depot-tirage.ts`, `render/lecture/types.ts`,
`render/lecture/visuels.ts`, `render/lecture/CarteTiree.tsx`, `render/lecture/lecture.module.css`,
`supabase/migrations/0050_tirage.sql`, et sept fichiers de tests (`tirage-alea`, `tirage-architecture`,
`tirage-frontiere`, `tirage-depot`, `tirage-sql`, `jeu-proprietaire`, `description-cartes`,
`rendu/carte-tiree`).

**Modifiés** — `eslint.config.mjs` (le verrou AD-11), `lib/corpus/README.md` (inventaire 165 → 189, plus
la table séparée des textes qui ne sont pas d'Anima), `tests/corpus-architecture.test.ts` (le 6ᵉ fichier
de `lib/corpus/`, et l'assertion que le sens vit AILLEURS), `tests/consentement.test.ts` (`tirage` retiré
des « couches art. 9 à venir »).

### La campagne de mutation

Vingt-huit mutants, tous tués. Les six qui comptent vraiment :

| Mutant | Tué par |
|---|---|
| `mot % borne` sans rejet | `tirage-alea` §1 — **et par lui seul** : le χ² sur 240 000 tirages reste vert |
| Un paramètre ajouté à `tirerUneCarte` | `tirage-architecture` — l'arité comme assertion |
| Le catalogue de sens importé par le tireur | `tirage-architecture` — le balayage des imports RÉELS |
| Un champ `sens?` ajouté au modèle de vue | `tirage-frontiere` §3 |
| Une policy d'UPDATE ajoutée sur `tirage` | `tirage-sql` — le PATCH direct touche 0 ligne |
| La garde de détresse retirée du `with check` | `tirage-sql` |

**⚠️ QUATRE FAUX KILLS ONT ÉTÉ DÉTECTÉS ET REPRIS.** Le harnais de mutation SQL comptait pour « tué »
tout mutant dont le `db reset` échouait. Or `supabase db reset` rend un `502` sur le redémarrage des
conteneurs — un hoquet d'infrastructure, sans rapport avec la migration, qui s'appliquait très bien.
Quatre mutants (policy d'UPDATE, contrainte de graine, trigger d'horodatage, propriété dans le
`with check`) ont donc été déclarés morts sans qu'aucun test ne les ait vus. Repris un à un avec un
harnais qui distingue « la migration est invalide » de « le reset a hoqueté » : les quatre sont
réellement tués, par les bons tests. La leçon est celle du dépôt, appliquée au harnais lui-même —
**un contrôle aveugle est vert**.

### Ce que la story ne livre pas, et qui est dit

1. **Les 24 visuels n'existent pas.** Chaque carte le dit à l'écran. Porte pré-lancement.
2. **Le rituel est la 5.8.** `CarteTiree` est livré isolé, non monté — comme `TroncSeul` en 5.6.
3. **Rien n'empêche encore de tirer dix fois de suite.** L'unicité n'a pas de clé sur laquelle se poser
   tant que l'entité `lecture` n'existe pas. Tâche obligatoire de la 5.8, écrite dans `deferred-work.md`.
4. **Le journal prouve la rejouabilité, pas la primauté du mot accepté.** Résidu borné par le χ².

---

## Journal des modifications

| Date | Auteur | Modification |
|---|---|---|
| 2026-08-14 | Claude (Opus 5) | Création de la story. Décisions structurantes : jeu de 24 (D6), rejet déterministe comme garde principale (D2), `taille_jeu` journalisé (D4), garde de détresse ajoutée au-delà de l'epic (D7), texte alternatif descriptif et non signifiant (D8). |
| 2026-08-14 | Claude (Opus 5) | Implémentation T1→T13. 28 mutants, 28 tués — dont 4 faux kills détectés et repris. Statut → `review`. |
