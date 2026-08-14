---
baseline_commit: 808123ecedaf5e7aacba4fd0e1621c49a7ffbe6d
story_key: "5-6-accueil-bibliotheque-en-cartes"
epic: 5
story: 6
title: "L'accueil — la bibliothèque en cartes"
epic_name: "Le socle & la lecture"
covers: [FR-033, FR-023, FR-080, FR-047, FR-050, FR-053, FR-055, FR-031, FR-057, FR-088, AD-5, AD-7, AD-12, NFR-015, NFR-017, NFR-022]
depends_on:
  - "1-7-entrer-scene-2d-continue-sans-bord"
  - "5-1-theme-natal-calcule-une-fois-grave"
  - "5-2-numerologie-complete-deterministe"
  - "5-3-degradation-gracieuse-sans-heure-completion-tronc"
  - "5-4-horoscope-mantra-du-jour"
  - "5-5-enneagramme-test-court-hypothese-anam"
prepare_pour:
  - "5-8-rituel-lecture-restitution-ecrite"
  - "5-9-ancrage-exercice-guide-premium"
status: review
migration: null
---

# Story 5.6 : L'accueil — la bibliothèque en cartes

> **Ce que cette story a de particulier.** Les cinq stories précédentes du socle ont *calculé*.
> Aucune n'a **montré**. `lireNumerologie`, `lireSocleQuotidien` et `lireThemeNatal` n'ont, à ce
> jour, **aucun appelant qui les affiche** — vérifié : les seuls consommateurs applicatifs sont
> `lib/safety/projection-arbre.ts` (qui lit le thème pour le tronc) et `app/enneagramme/page.tsx`.
> La région `accueil` de la scène rend encore une phrase d'attente en dur
> (`render/scene-dom.tsx:111` — « La bibliothèque de tes repères prendra place ici. »).
>
> Cette story est donc **la vitrine**. Et une vitrine révèle ce qu'il y a en stock.
>
> Trois constats, **mesurés contre les vrais modules du dépôt le 2026-08-13**, pas déduits :
>
> **(1) La garde de l'AC3 n'existe pas.** FR-023 proscrit « le mot *soin* et ses dérivés » de toute
> l'interface. Le contrôle bloquant (`tests/lexique-voix.test.ts`) balaie bien `app/`, `render/` et
> `lib/` — la mécanique est là. Mais le détecteur ne connaît que les formes **verbales**
> (`soigner/soignée/…`) et **une** locution à l'impératif (`prends soin de`,
> `lib/domain/lexique-interdit.ts:146-147`). Le substantif est libre. Mesuré, cinq chaînes passées
> dans `chercherInterdits` :
>
> | chaîne | verdict mesuré |
> |---|---|
> | `« Prendre soin de toi »` | **VERT** |
> | `« Un soin pour aujourd'hui »` | **VERT** |
> | `« Des soins quotidiens »` | **VERT** |
> | `« Ce soin dure trois minutes »` | **VERT** |
> | `« soin du jour »` | **VERT** |
> | `« Prends soin de toi »` | rouge (`prends soin de`) |
>
> `« Prendre soin de toi »` est *le* libellé qu'on écrit sans y penser sur une carte d'accueil de
> produit de bien-être, et c'est précisément celui que FR-023 existe pour tenir dehors. Le
> commentaire du module assume le choix (« jamais le substantif »), motivé par la peur du faux
> positif sur « be**soin** » — or `\bsoins?\b` ne mord pas sur « besoin » (frontière de mot), et le
> dépôt entier ne contient **que 6 occurrences** de la racine hors « besoin », **toutes** en
> commentaire ou dans un fichier déjà exclu du balayage. La réparation est gratuite. **Elle se fait
> en T1, avant la première ligne de bibliothèque** — réparer une garde après avoir écrit le code
> qu'elle devait garder, c'est la réparer en la regardant approuver ce qui existe déjà.
>
> **(2) Deux des cinq cartes n'ont, aujourd'hui, strictement rien à dire.** Le corpus d'Anima
> compte **165 créneaux déclarés, 0 écrit** (60 mantras, 27 horoscopes, 69 numérologie,
> 9 ennéagramme). Or les cinq cartes ne sont pas égales devant ce vide :
>
> | carte | fait calculé disponible | texte d'Anima |
> |---|---|---|
> | mantra du jour | **aucun** — la carte *est* le texte | 60 créneaux, 0 écrit |
> | horoscope | des énumérations (`lune:…`, `configuration:…`), pas de la prose | 27 créneaux, 0 écrit |
> | thème | Soleil en Balance, Lune en Poissons… | à écrire (hors périmètre 5.x) |
> | nombres | chemin de vie 7, expression 3… | 69 créneaux, 0 écrit |
> | ennéagramme | le type retenu | 9 créneaux, 0 écrit |
>
> **Trois cartes sur cinq peuvent montrer un fait ; deux sont structurellement vides.** Et
> `deferred-work.md` l'avait posé comme une question de conception à ne pas traiter à la va-vite —
> elle est ici. La 5.6 livre la mécanique complète et **dit honnêtement ce qui n'est pas écrit** ;
> elle ne peut pas inventer les textes (FR-054 + FR-086 : Anima est une personne réelle, toute
> citation inventée qui lui serait attribuée est un défaut critique). **Conséquence à assumer et à
> écrire noir sur blanc : l'accueil n'est pas publiable en l'état.** Ce n'est pas de la dette
> technique, c'est la porte pré-lancement d'écriture qui devient enfin visible — sur le premier
> écran, celui que tout le monde voit.
>
> **(3) « Aucun badge, aucun compteur, aucun cadenas » ne peut pas être un lint.** La leçon de la
> 4.10 (`tests/arbitrage-frontiere.test.ts`) est que la façon naturelle de faire fuir un compte est
> de l'ajouter à un type qui traverse la frontière — donc **c'est le type qui garde**. Ici le piège
> est pire, parce qu'un test « aucun chiffre dans le rendu » est *impossible* : la carte des nombres
> affiche des nombres et celle de l'ennéagramme affiche un type. La garde ne peut donc pas être
> lexicale ; elle doit être **structurelle** — aucun champ de `CarteBibliotheque` ne peut porter un
> badge, un compte ou un verrou, et une carte indisponible n'est **jamais construite** plutôt que
> construite-puis-masquée (UX : « teaser en permanence ce qu'on ne peut pas avoir contredit
> FR-057 »).

---

## Story

**En tant qu'**utilisatrice,
**je veux** un accueil qui présente mon socle comme une petite bibliothèque de cartes dans un ordre
fixe,
**afin de** retrouver mes repères sans être pilotée par un algorithme.

---

## Critères d'acceptation

1. **[FR-033 / UX-DR-30]** **Étant donné** l'accueil, **quand** il s'ouvre, **alors** il affiche
   **4 à 6 cartes maximum** dans un **ordre fixe déclaré en constante, jamais algorithmique** — le
   rang d'une carte ne dépend d'aucun signal de comportement, d'aucune donnée personnelle et
   d'aucune fraîcheur —, **et** une seule carte est mise en avant, **en tête**, **et** cette mise en
   avant est une **fonction pure du jour civil parisien** (patron `indiceDuJour`, 5.4), identique
   pour toutes les utilisatrices, changeante à minuit et à minuit seulement.

2. **[FR-031 DUR / UX-DR-30]** **Étant donné** le type `CarteBibliotheque`, **quand** on cherche où
   écrire un badge, un compteur ou un cadenas, **alors** **il n'existe aucun champ pour le porter** —
   la garde est structurelle, pas lexicale —, **et** une carte non disponible pour ce compte n'est
   **pas construite** (jamais construite puis masquée, jamais rendue verrouillée, FR-057).

3. **[FR-080]** **Étant donné** le vocabulaire du produit, **quand** une carte nomme un contenu,
   **alors** les trois termes restent distincts — **« mantra du jour »** (court, gratuit, non
   interactif) · **« ancrage »** (exercice guidé interactif de 2 à 5 min, premium) · **« lecture »**
   (rituel long avec tirage, premium) —, **et** cette distinction est portée par un **glossaire
   déclaratif** dont chaque carte tire son terme, de sorte qu'employer l'un pour l'autre **rougisse**
   au lieu de dépendre d'une relecture humaine.

4. **[FR-023]** **Étant donné** le contrôle de lexique, **quand** un libellé de cette région est
   rendu, **alors** le mot **« soin » et ses dérivés sont absents** — **et** le détecteur voit
   désormais le **substantif** (`un soin`, `des soins`) et l'**infinitif** (`prendre soin de`), pas
   seulement les formes verbales, **sans** mordre sur « besoin », « soigneusement », « soigneux »
   ni « soignant ».

5. **[FR-047 / FR-050 / FR-053]** **Étant donné** un créneau de corpus **non écrit**, **quand** la
   carte paraît, **alors** elle affiche **le fait calculé** s'il en existe un, **et** dit
   **honnêtement** que le texte d'Anima n'est pas encore écrit — sans excuse, sans « bientôt », sans
   compte à rebours —, **et** une carte dont *tout* le contenu est absent le dit **au lieu de
   paraître vide ou en panne** ; **et** la mise en avant du jour ne tombe **jamais** sur une carte
   qui n'a rien à montrer.

6. **[FR-050 / 5.3]** **Étant donné** un thème dont `precision = "midi_par_defaut"`, **quand** la
   carte du thème paraît, **alors** **aucun degré n'est affiché** — la vérité est ±7,7° et un degré
   à la minute serait de la précision fabriquée —, **et** l'absence est dite comme la 5.3 dit les
   signes indéterminables : un fait, jamais un reproche.

7. **[NFR-015 / AD-7]** **Étant donné** une ouverture à froid, **quand** l'accueil s'affiche,
   **alors** le socle paraît **sans écran de démarrage animé**, **et** le chargement de la
   bibliothèque **ne retarde pas l'ouverture de la scène** : une panne ou une lenteur d'une carte
   n'emporte **ni les autres cartes, ni la conversation, ni l'arbre** (chaque lecture porte son
   propre `try`, patron 5.4/B4).

8. **[FR-055 / AD-5]** **Étant donné** un compte gratuit, **quand** l'accueil s'affiche, **alors**
   **aucune carte premium cadenassée n'y figure**, **et** les cartes du socle — mantra, horoscope,
   thème, nombres, ennéagramme — **y sont toutes**, le socle n'étant jamais coupé.

9. **[FR-088]** **Étant donné** un arbre encore sans branche, **quand** la région arbre s'affiche,
   **alors** **le tronc y est dessiné** — dette reportée de la Story 3.3, assignée à celle-ci par
   `deferred-work.md` : « elle voit son tronc, y compris incomplet ».

---

## Tâches

### T1 — Réparer le détecteur FR-023 **avant** d'écrire un seul libellé
- [x] Ajouter à `lib/domain/lexique-interdit.ts`, famille `soigner` : le **substantif**
      (`\bsoins?\b`) et l'**infinitif** (`\bprendre soin de\b`).
- [x] `tests/lexique-interdit.test.ts` : les six chaînes du tableau ci-dessus passent au **rouge**,
      et les **connus-bons restent verts** — `besoin`, `besoins`, `au besoin`, `soigneusement`,
      `soigneux`, `soignant`, `moins`, `témoin`, `coin`, `point`.
- [x] Vérifier que le balayage bloquant (`tests/lexique-voix.test.ts`) **reste vert** sur le dépôt
      entier après la réparation (les 6 occurrences connues sont en commentaire ou dans un fichier
      exclu — le confirmer, ne pas le supposer).
- [x] **Mutant** : retirer le motif du substantif → le test de T1 rougit.

### T2 — Le glossaire FR-080 (`lib/domain/vocabulaire.ts`, pur)
- [x] Déclarer les trois termes avec leur **nature** : `mantra du jour` (bref, non interactif,
      gratuit) · `ancrage` (2–5 min, interactif, premium) · `lecture` (rituel long avec tirage,
      premium).
- [x] Chaque terme porte les propriétés qui le distinguent (`interactif`, `premium`, `duree`) — ce
      sont elles qui rendent la confusion détectable, pas la chaîne de caractères.
- [x] AD-1 : zéro I/O, zéro import `lib/data`, zéro `server-only`.
- [x] **Mutant** : donner à `mantra du jour` la nature de `ancrage` → la garde de T3 rougit.

### T3 — Le modèle de la bibliothèque (`lib/domain/bibliotheque.ts`, pur)
- [x] `CarteBibliotheque` : **aucun champ** `badge`, `compte`, `verrouille`, `nouveau`, `total`
      (AC2 — la garde est le type).
- [x] `CATALOGUE_CARTES` : l'ordre **fixe**, en constante, dans l'ordre de `EXPERIENCE.md`
      (mantra du jour, horoscope, thème, nombres, ennéagramme).
- [x] `carteDuJour(jour, presentables)` : rotation **pure** via `indiceDuJour` sur le
      sous-ensemble **présentable** (AC5 — la mise en avant ne tombe jamais sur une carte muette).
- [x] `ordonnerBibliotheque(...)` : la carte du jour en tête, le reste dans l'ordre du catalogue.
- [x] **Contrôle du contrôle** : comme `cleMantraDuJour` (5.4), exporter la **clé** de la carte du
      jour séparément — tant que rien n'est écrit, deux cartes vides sont indiscernables, et une
      rotation cassée (« toujours la première ») serait invisible jusqu'à la mise en ligne.
- [x] **Mutants** : (a) figer la rotation sur l'indice 0 ; (b) trier le catalogue par fraîcheur ;
      (c) inclure les cartes non présentables dans la rotation.

### T4 — La lecture serveur (`lib/data/lire-bibliotheque.ts`)
- [x] Composer les quatre lectures : `lireSocleQuotidien` (mantra + horoscope), `lireNumerologie`,
      `lireEnneagramme`, et le **thème natal**.
- [x] ⚠️ **`lireThemeNatal` ne doit être appelé QU'UNE FOIS** (piège P10) : `lireSocleQuotidien`
      l'appelle déjà en interne, et il peut **écrire** (premier calcul, ou recalcul après ajout de
      l'heure). Deux appels = deux fois ~663 lectures d'éphéméride dans le cas dégradé. Trancher
      explicitement le partage (paramètre injecté ou remontée du thème dans `SocleQuotidien`) et
      **le prouver par un test qui compte les appels**.
- [x] Partager **une seule** instance d'`EphemerisPort`.
- [x] Chaque lecture dans **son propre `try`** : l'échec de l'une ne fait jamais taire les autres
      (leçon 5.4/B4 — une lenteur Supabase avait supprimé un morceau du socle gratuit).
- [x] Sous le **JWT** de l'utilisatrice, jamais `service_role` (AD-12). Aucune PII dans un log
      (NFR-022).

### T5 — L'absence honnête (le cœur de conception)
- [x] Rendre l'union `TexteCorpus` **sans jamais la coller** à un `?? ""` : un créneau non écrit se
      dit, il ne se tait pas.
- [x] Distinguer trois états de carte : **fait + texte**, **fait seul** (texte non écrit),
      **rien** (mantra aujourd'hui). Le troisième est celui qui décide de la qualité de l'écran.
- [x] Une carte « rien » est **présentable = false** → elle ne peut pas être la carte du jour (AC5).
- [x] Aucun « bientôt », aucun compte à rebours, aucune excuse (FR-057 : ne pas teaser).

### T6 — `precision = "midi_par_defaut"` ⇒ aucun degré (AC6)
- [x] La carte du thème **branche sur `precision`** ; sans heure, elle affiche le signe (quand la
      5.3 le déclare déterminable) et **jamais** le degré.
- [x] **Mutant** : afficher le degré inconditionnellement → un test rougit.

### T7 — Le rendu (`render/accueil/`)
- [x] `Bibliotheque.tsx` + `Carte.tsx` + `accueil.module.css`, montés dans la région `accueil` de
      `render/scene-dom.tsx` en remplacement de `CORPS.accueil`.
- [x] La carte est **un objet, pas une ligne de menu** (`EXPERIENCE.md` : fiches de bibliothèque
      imprimées). Deux colonnes en `md`, une en `sm`.
- [x] AD-7 : `render/` ne décide rien — il reçoit un modèle ordonné et le dessine. Aucun accès base,
      aucune variable d'environnement.
- [x] Accessibilité : la mise en avant du jour est **annoncée**, pas seulement plus grande.
- [x] `aria-label` et ordre du DOM ne portent **aucun compte** (AC2 — le chemin de fuite oublié).

### T8 — Le branchement dans `app/page.tsx` (AC7)
- [x] Ajouter la lecture de la bibliothèque **sans allonger le chemin critique de la scène** :
      mesurer d'abord, décider ensuite (streaming/Suspense contre lecture parallèle).
- [x] La panne de la bibliothèque **ne bloque jamais** l'ouverture de la scène (repli sûr →
      bibliothèque vide, jamais un 500).
- [x] **Mutant** : faire lever `lire-bibliotheque` → la scène s'ouvre quand même.

### T9 — Le tronc dessiné dans l'arbre vide (AC9, dette 3.3)
- [x] `render/arbre/EtatVideArbre.tsx` : dessiner le tronc au lieu de le remplacer par du texte.
- [x] Ne **rien** casser du chemin d'accès à la fiche du tronc (5.3 le rend atteignable dans les
      trois états).

### T10 — Les gardes bloquantes
- [x] FR-023 : le balayage existant couvre déjà `render/` — vérifier qu'il voit bien les nouveaux
      fichiers (assertion **par racine**, pas globale — leçon du 2026-08-12).
- [x] FR-031 : garde **structurelle** sur `CarteBibliotheque` (aucun champ de mesure) + garde de
      rendu (aucun compte dans le DOM ni dans les `aria-label`).
- [x] FR-080 : garde de glossaire (T2/T3).
- [x] FR-055 : `tests/socle-jamais-coupe.test.ts` — les cinq cartes du socle sont servies à un
      compte gratuit ; le registre commercial n'entre pas dans `lire-bibliotheque`.
- [x] AC1 : garde « ordre fixe » — le catalogue est une constante, et **aucun tri** ne s'applique
      entre le catalogue et le rendu hors la mise en tête de la carte du jour.

### T11 — Campagne de mutation
- [x] Chaque garde ci-dessus **tue son mutant**. Restauration depuis un instantané `cp`,
      **jamais** `git checkout`.
- [x] Documenter tout survivant assumé, avec la raison pour laquelle sa survie *est* la preuve.

### T12 — Clôture
- [x] Suite complète (`npx vitest run` — **sans** sourcer `.env.local`), `tsc`, `eslint`,
      `next build`.
- [x] Mettre à jour `deferred-work.md` (les quatre reports assignés à la 5.6 sont soldés ou
      re-assignés, jamais silencieusement perdus) et `PORTES-AVANT-PUBLICATION.md`.
- [x] `sprint-status.yaml` → `review`.

---

## Notes de développement

### D1 — Où la bibliothèque est lue, et pourquoi ce n'est pas anodin

`app/page.tsx` fait aujourd'hui **deux** lectures en parallèle (`chargerOuverture`,
`chargerProjectionArbre`) avant de rendre la scène. La bibliothèque en ajoute jusqu'à **quatre**, et
l'une d'elles (`lireThemeNatal`) peut **écrire** et coûter ~663 lectures d'éphéméride au tout
premier appel d'un compte, dans le cas dégradé (sans heure de naissance) — c'est écrit dans
`deferred-work.md`, et cette story est la première à le déclencher **pour tout le monde, au
chargement de la scène**.

Trois cartes sur cinq n'ont rien à afficher aujourd'hui : payer ce coût sur le chemin critique de
**toutes** les régions, y compris pour quelqu'un qui va droit à la conversation, serait le mauvais
arbitrage. La décision se prend **après mesure** (T8), et le repli est celui du dépôt : chaque
effet qui peut échouer porte son `try`, et l'échec de l'un ne fait jamais taire l'autre.

### D2 — Pourquoi la mise en avant est une fonction du **jour**, et de rien d'autre

« Ordre fixe, jamais algorithmique » n'interdit pas de *calculer* — il interdit de **classer selon
elle**. Une rotation sur le jour civil parisien est identique pour toutes les utilisatrices, ne lit
aucun signal de comportement, et change à minuit. C'est exactement le contrat de `cleMantraDuJour`
(5.4), primitive comprise (`indiceDuJour`) : on ne réinvente pas la rotation, on la réemploie.

Le piège de testabilité est le même qu'en 5.4 et il faut le reprendre tel quel : **tant qu'aucun
texte n'est écrit, deux cartes vides sont indiscernables**. Une rotation cassée resterait invisible
jusqu'au jour de la mise en ligne. D'où l'export séparé de la **clé** de la carte du jour.

### D3 — La carte du jour ne tombe jamais sur une carte muette

C'est le point où l'AC1 et l'AC5 se rencontrent. Faire tourner la mise en avant sur les cinq cartes
donnerait, aujourd'hui, **deux jours sur cinq un accueil qui s'ouvre sur une carte vide en tête**.
Restreindre la rotation aux cartes **présentables** reste déterministe, reste impersonnel, et cesse
d'être absurde. Le prix à écrire honnêtement : l'ensemble présentable dépend de l'état du corpus,
donc la carte d'un jour donné **changera** quand Anima écrira. Il n'y a pas d'archive en v1
(`EXPERIENCE.md` §607), donc personne ne peut constater l'écart — mais c'est un fait à connaître,
pas un détail à taire.

### D4 — `lune_relative` ne bouge que tous les ~2,5 jours

Report explicite de la 5.4 vers cette story : la Lune met deux jours et demi à traverser un signe,
donc **le même texte d'horoscope sort deux à trois jours de suite**. « Afficher deux jours de suite
un texte identique sans rien d'autre autour se lirait comme une panne. » La carte doit donc porter
**la date du jour**, pour que l'identité du texte se lise comme « le ciel n'a pas bougé » et non
comme « l'application est bloquée ». C'est du ciel, pas du code.

### D5 — La garde FR-031 ne peut pas être lexicale, et c'est le nœud

Un test « aucun chiffre dans le rendu de l'accueil » est **impossible** : la carte des nombres
affiche des nombres, celle de l'ennéagramme affiche un type, celle du thème affiche des degrés
(quand l'heure est connue). La 4.10 a déjà payé cette leçon sur l'arbitrage —
`tests/arbitrage-frontiere.test.ts` : « la façon naturelle de faire fuir un compte est de l'ajouter
au type qui traverse la frontière, donc c'est le type qui garde ».

Ici, deux gardes complémentaires, et aucune n'est suffisante seule :
1. **structurelle** — `CarteBibliotheque` n'a aucun champ capable de porter une mesure ;
2. **de construction** — une carte indisponible n'est pas construite. Pas de champ `verrouille`,
   donc pas de rendu verrouillé possible. C'est aussi ce qui applique littéralement le refus de
   conception d'`EXPERIENCE.md` §511.

Et le chemin de fuite à ne pas oublier, celui que la 4.10 a trouvé après coup : **les `aria-label`
et l'ordre du DOM**. Un compte peut fuir par là sans jamais apparaître à l'écran.

### D6 — Le glossaire, parce qu'une distinction de vocabulaire ne se relit pas

FR-080 dit que « mantra », « ancrage » et « lecture » ne doivent **jamais** être confondus. Écrit
comme une règle éditoriale, cela dépend d'une relecture humaine à chaque libellé ajouté — et les
stories 5.8 (lecture) et 5.9 (ancrage) vont précisément en ajouter. Déclarer les trois termes avec
leur **nature** (interactif ? premium ? durée ?) et faire tirer à chaque carte son terme du
glossaire transforme la règle en contrainte : une carte brève, gratuite et non interactive **ne
peut pas** se nommer « ancrage » sans qu'un test rougisse. C'est la doctrine du dépôt appliquée au
vocabulaire — une garde qui ne vit que dans un document ne garde rien.

### D7 — Le socle n'est jamais coupé (AC8), et le registre commercial n'entre pas ici

FR-055 : mantra, horoscope, thème, nombres, ennéagramme sont **gratuits à vie**.
`tests/socle-jamais-coupe.test.ts` balaie déjà `lire-quotidien.ts` et refuse qu'un registre
commercial y apparaisse — **commentaires compris**. `lire-bibliotheque.ts` doit entrer dans ce
balayage : c'est le fichier où quelqu'un écrira un jour, de bonne foi, « si premium alors ».

Le corollaire : la bibliothèque de la v1 ne contient **que** des cartes gratuites, parce que les
deux cartes premium (lecture, ancrage) n'existent pas encore. La mécanique de disponibilité doit
néanmoins être construite et testée **maintenant** — sinon la 5.8 et la 5.9 la câbleront dans
l'urgence, et la carte cadenassée reviendra par la porte de derrière.

### D8 — Les quatre reports que cette story reprend

De `deferred-work.md`, assignés explicitement à la 5.6 :
1. **le corpus vide** — « le rendu de cette absence est une vraie question de conception, pas un cas
   dégradé à traiter à la va-vite » (T5) ;
2. **le degré incertain sous `midi_par_defaut`** — « la Story 5.6 doit brancher sur `precision` ;
   aucune garde ne l'y oblige aujourd'hui » (T6) ;
3. **le tronc non dessiné dans l'arbre vide** — dette de la 3.3 (T9) ;
4. **`lune_relative` figée ~2,5 jours** — « la 5.6 doit le savoir avant de dessiner la carte » (D4).

Aucun ne doit disparaître silencieusement : soldé ou re-assigné, jamais perdu.

### D9 — Ce que cette story ne peut pas livrer, et qu'il faut dire à Julian

**L'accueil sera mécaniquement complet et éditorialement vide.** Deux cartes sur cinq n'auront rien
à montrer tant qu'Anima n'aura pas écrit, et l'accueil est le premier écran. Les trois issues
possibles se tranchent avec Julian, pas ici :

- **écrire d'abord** les 60 mantras et les 27 horoscopes (87 créneaux — la fiche
  `corpus-quotidien-a-ecrire.md` existe déjà) ;
- **publier avec l'absence dite honnêtement**, ce que la story livre ;
- **réduire la bibliothèque** aux trois cartes qui montrent un fait — mais UX-DR-30 pose un plancher
  de quatre.

La story livre la deuxième, parce que c'est la seule qui ne dépende de personne — et elle rend le
choix visible au lieu de le laisser se découvrir à la mise en ligne.

---

## Contraintes permanentes du dépôt

- Une garde n'existe **que** dans une policy (`WITH CHECK`) ou un trigger — jamais dans une RPC ou
  une Server Action seule. *(Sans objet ici : aucune migration.)*
- Une garde qui vit dans un commentaire **n'existe pas**.
- Un test vert ne prouve rien tant que **son mutant n'est pas mort**.
- Restauration de mutation depuis un instantané `cp`, **jamais** `git checkout`.
- Suite : `npx vitest run` — **ne jamais** sourcer `.env.local` d'abord.
- CLI Supabase **globale** (`/opt/homebrew/bin/supabase`), jamais `npx supabase`.
- `render/` → `lib/scene/` uniquement, jamais l'inverse (AD-10). Aucun secret, aucun accès base,
  aucune variable d'environnement dans `render/`.

---

## Journal des modifications

| Date | Auteur | Modification |
|---|---|---|
| 2026-08-14 | Claude Opus 5 | **Livrée.** 15 mutants exécutés, 15 tués. 206 fichiers / 3300 tests verts ; tsc, eslint et `next build` propres. Aucune migration. Trouvaille non prévue par la story : `chargerProjectionArbre` ET la bibliothèque lisaient chacun `lireThemeNatal`, **dans le même `Promise.all`** — deux premiers calculs concurrents et deux écritures en course. Fermé par un thème lu une seule fois dans `app/page.tsx`. Deux corrections d'en-tête menteur (une garde promise à `socle-jamais-coupe` qui ne pouvait pas exister sous forme lexicale ; trois fichiers de test cités avant d'être écrits — attrapé par `corpus-architecture`). |
| 2026-08-13 | Claude Opus 5 | Story créée. Trois constats mesurés contre le dépôt : (1) le détecteur FR-023 est aveugle au substantif « soin » — 5 chaînes vertes, réparation en T1 ; (2) 2 cartes sur 5 sont structurellement vides (165 créneaux, 0 écrit) ; (3) la garde « aucun compteur » doit être structurelle, un test lexical étant impossible sur une carte de nombres. |
