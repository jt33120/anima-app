# Story 5.9 : L'ancrage — l'exercice guidé premium

Status: review

## Story

En tant qu'utilisatrice premium,
je veux un ancrage — un exercice guidé court que je traverse pas à pas —,
afin de disposer d'un rendez-vous premium interactif, distinct du mantra du jour et de la lecture.

**Couvre :** FR-056, FR-080, FR-081 · AD-1, AD-7, AD-10, AD-12 · renvoi FR-023, FR-054, FR-055, FR-086.

---

## Ce que cette story livre, en une phrase

Une halte `/ancrages`, gardée par l'entitlement premium **côté serveur**, où un exercice guidé à
**structure fixe** se déroule **pas à pas** depuis le corpus d'Anima — sans base, sans modèle, sans
trace, et sans qu'aucun de ses textes ne puisse atteindre un client gratuit.

Elle ferme l'Epic 5.

---

## Acceptance Criteria

### AC1 — L'exercice est guidé, interactif, à structure fixe

**Étant donné** un compte premium, **quand** l'utilisatrice ouvre un ancrage, **alors** il se déroule
**pas à pas** — une étape à l'écran à la fois, avançée par elle —, sa séquence d'étapes est **fixe**
et déclarée dans le domaine, **et** tout son texte vient du **corpus d'Anima**.

### AC2 — Deux à cinq minutes, et c'est le code qui le vérifie

**Étant donné** la structure fixe, **quand** le module se charge, **alors** la durée impliquée par le
nombre d'étapes tombe dans la fourchette déclarée par `terme("ancrage").dureeMinutes` (2 à 5 min),
**et** une étape ajoutée qui ferait sortir le format de sa propre fourchette **jette au chargement**,
comme `assertCatalogueBorne` le fait pour la bibliothèque (5.6).

### AC3 — L'accès est gardé côté serveur, et il n'existe pas de seconde porte

**Étant donné** un compte gratuit, **quand** il ouvre `/ancrages`, **alors** l'accès est refusé
**côté serveur** (entitlement de la Story 3.1), **et** aucun texte d'ancrage n'est transporté vers le
client.
**Et** aucun composant client, aucune route d'API et aucun module de `render/` n'importe
`@/lib/corpus/ancrage` — c'est le test de frontière qui le prouve, pas une relecture.

### AC4 — Le socle gratuit n'est jamais dégradé

**Étant donné** l'arrivée de l'ancrage, **quand** un compte gratuit ouvre l'accueil, **alors** les
cinq cartes du socle sont servies à l'identique, **et** aucun teaser, cadenas, badge ni compteur
d'ancrage n'apparaît nulle part (FR-031, FR-055, FR-057).

### AC5 — Le vocabulaire ne se confond jamais

**Étant donné** un texte quelconque de l'ancrage — libellé, titre, copie de refus, étape —, **quand**
il est rendu, **alors** il ne nomme ni le **mantra du jour** ni la **lecture**
(`chercherConfusionVocabulaire`), **et** le mot **« soin » et ses dérivés n'y apparaissent jamais**
(FR-023, contrôle de voix bloquant de la 2.8).

### AC6 — L'absence se dit honnêtement

**Étant donné** que le corpus des ancrages est **déclaré et non écrit** (FR-054 + FR-086 : Anima seule
peut l'écrire), **quand** une utilisatrice premium ouvre la halte, **alors** elle lit une phrase qui
dit l'état réel — sans « bientôt », sans compte à rebours, sans texte de remplacement fabriqué.

### AC7 — Le texte, l'audio déféré

**Étant donné** la v1, **quand** l'ancrage est livré, **alors** il est **en texte** ; la variante
**audio est déférée en v1.1** et son report ne dégrade rien — aucune amorce audio, aucun bouton
inerte, aucune mention d'une version à venir.

---

## Les décisions de conception, tranchées ici

### D1 — L'ancrage n'est PAS une carte de la bibliothèque

`lib/domain/bibliotheque.ts` invite pourtant explicitement une sixième carte, et `vocabulaire.ts` rend
la mécanique gratuite : `cartesDisponibles` retirerait la carte `ancrage` d'un compte gratuit sans une
ligne de plus.

**On refuse quand même**, et la raison est FR-080 lui-même. Une `CarteVue` est une **vignette de texte
statique** : un titre, des faits, une prose. Un ancrage rendu par ce composant serait, à l'écran,
**exactement un mantra du jour** — un texte posé qu'on lit. C'est la confusion que FR-080 nomme comme
un défaut, obtenue par la porte de la réutilisation de composant.

L'ancrage vit donc dans **sa propre halte** (`/ancrages`), avec son propre rendu à progression. La
bibliothèque reste à **cinq** cartes.

Conséquence assumée : la halte n'est atteignable **que par URL** tant que le menu de compte n'existe
pas — exactement comme `/lectures`, `/synthese` et `/enneagramme`. La dette est déjà inscrite.

### D2 — Aucune migration, aucune table, aucune trace

L'ancrage ne persiste **rien** : ni ouverture, ni progression, ni achèvement. Trois raisons, dans cet
ordre :

1. **Aucun AC ne le demande.** Une reprise à l'étape 3 est une fonctionnalité qu'on n'a pas
   commandée, et elle coûterait une table art. 9 de plus.
2. **Ce qui n'est pas écrit n'a pas à être effacé** (FR-067) ni retenu (AD-14). L'inventaire
   d'effacement de l'Epic 6 ne gagne pas une ligne.
3. **Il n'y a rien à mesurer.** Contrairement à la lecture (5.8), l'ancrage ne fait **aucun appel
   modèle** : pas de métrage, pas d'allocation résiduelle (3.4), coût marginal nul.

### D3 — La garde de route suffit ICI, et il faut dire pourquoi

La doctrine de ce dépôt, payée sept fois (migrations 0041→0048, 0051) : **une garde qui ne vit que
dans une route ne garde rien**, parce que `authenticated` détient les sept privilèges DML sur chaque
table `public` et qu'un `.insert()` direct contourne la route.

Ce raisonnement ne s'applique pas ici, et pour une raison précise : **il n'y a pas de table**. La
ressource est une **constante côté serveur**. La seule façon de la fuiter n'est pas de contourner la
route — c'est de la faire **entrer dans le bundle client**.

Donc la garde n'est pas une policy, c'est une **frontière de dépendance** (AC3), vérifiée
mécaniquement : `lib/corpus/ancrage.ts` n'est importé que par `lib/domain/ancrage.ts` et
`lib/data/lire-ancrage.ts` (`server-only`). Aucun `"use client"`, aucun `render/`, aucune route
d'API ne l'atteint.

### D4 — Le corpus des ancrages est déclaré, et **aucun** créneau n'est écrit

Même forme et même raison qu'en 5.2, 5.4, 5.5 et 5.8 : FR-054 exige que les textes viennent du corpus
d'Anima, FR-086 rappelle qu'Anima est une personne réelle dont on ne fabrique jamais une parole.

**Le nombre d'ancrages et leurs titres sont une question pour Anima**, pas une décision de code —
exactement comme les 24 noms de carte (Q1, 5.7). On déclare donc **quatre** ancrages × (1 titre +
5 étapes) = **24 créneaux**, tous `NON_ECRIT`, et la question part dans `POUR-ANIMA`.

### D5 — Aucun appel modèle, et l'epic disait autre chose

Les epics listent AD-3 (« via `AiPort` ») et AD-4 sur cette story. **Le critère d'acceptation dit
l'inverse** : « déroulé pas à pas **depuis le corpus d'Anima** (FR-081) ». Un ancrage généré serait
une parole fabriquée signée d'une personne réelle (FR-086) et du socle non calculé (FR-054).

**Le critère gagne.** AD-3/AD-4 sont satisfaits par le vide : rien ne franchit la frontière art. 9
parce que rien ne sort. C'est un écart au document d'epic, assumé et nommé.

### D6 — La progression est pure, le rendu ne décide rien

`etapeSuivante` / `estDerniere` vivent dans `lib/domain/ancrage.ts` et se testent sans DOM. Le
composant client ne porte qu'un index. AD-7 : le rendu dessine, il ne décide pas.

Pas de minuterie forcée, pas de verrou d'étape : « le produit n'impose jamais » est une constante de
ce produit (cf. 6.4, le geste de pause). La fourchette 2–5 min est une **propriété du format**
vérifiée au chargement (AC2), pas un chronomètre imposé à l'utilisatrice.

---

## Tasks / Subtasks

- [x] **T1 — `lib/domain/ancrage.ts`** : `EtapeAncrage` (5, ordonnées, fixes), `CleAncrage` (4),
      `PACE_SECONDES`, l'assertion de cohérence de durée au chargement (AC2), `etapeSuivante`,
      `estDerniere`, `assemblerAncrage`. Pur (AD-1).
- [x] **T2 — `lib/corpus/ancrage.ts`** : 24 créneaux déclarés, 0 écrit, via `corpus()`/`NON_ECRIT`.
- [x] **T3 — `lib/domain/copie-ancrage.ts`** : titres de halte, refus premium, refus non écrit,
      libellés de progression. Sous `lib/` ⇒ balayé par le contrôle de voix (2.8).
- [x] **T4 — `lib/data/lire-ancrage.ts`** (`server-only`) : entitlement premium + assemblage ;
      union `{statut:"refuse"} | {statut:"ouvert", ancrages}`.
- [x] **T5 — `render/ancrage/types.ts` + `Ancrage.tsx` + `ancrage.module.css`** : progression pas à
      pas, aucun champ de type capable de porter un badge/compteur/cadenas.
- [x] **T6 — `app/ancrages/page.tsx`** : la halte, garde d'état d'onboarding copiée de `/lectures`,
      `dynamic = "force-dynamic"`, `metadata.title = "Anam"`.
- [x] **T7 — `tests/ancrage.test.ts`** : domaine, progression, assertion de durée (et son mutant).
- [x] **T8 — `tests/ancrage-corpus.test.ts`** : complétude des 24 créneaux, `chercherConfusionVocabulaire`
      sur tout texte, garde prouvée sur un faux corpus fautif.
- [x] **T9 — `tests/ancrage-frontiere.test.ts`** : AC3/AC4 — aucun import client de
      `@/lib/corpus/ancrage`, aucune route d'API, catalogue de bibliothèque toujours à 5, types de
      vue sans champ de mesure.
- [x] **T10 — `tests/rendu/ancrage.test.tsx`** : pas à pas, aucun texte inventé, aucun audio.
- [x] **T11 — Inventaire** : `corpus-quotidien-a-ecrire.md` + `POUR-ANIMA-ce-qui-attend.md`
      (Q6 : combien d'ancrages, et leurs titres).
- [x] **T12 — Vérification** : suite complète, `tsc`, `eslint`, `next build`, campagne de mutation.

---

## Dev Notes

### Ce qui existe déjà et qu'il ne faut pas réécrire

- `lib/domain/vocabulaire.ts` (5.6) — le terme `ancrage` est **déjà déclaré** : `interactif: true`,
  `premium: true`, `dureeMinutes: [2, 5]`. Ne pas le redéclarer, ne pas recopier le libellé.
  `chercherConfusionVocabulaire(texte, "ancrage")` est la garde de prose, déjà écrite.
- `lib/corpus/port.ts` — `corpus()`, `ecrit()`, `NON_ECRIT`, `lireTexte()` (qui **jette** sur une clé
  non déclarée), `clesNonEcrites()`, `textesEcrits()`.
- `lib/data/lire-abonnement.ts` — `estPremiumCourante()`.
- `app/lectures/page.tsx` — le patron de halte **complet** : garde d'état d'onboarding, `try/catch`
  qui distingue « je n'arrive pas à lire » de « tu n'as rien », `force-dynamic`, titre « Anam ».
- `tests/lexique-voix.test.ts` — balaie `lib/` en récursif. Tout texte posé sous `lib/` y passe
  automatiquement. Ne jamais y ajouter d'exclusion.

### Les pièges déjà payés dans ce dépôt

- **Le compte fuit par le type** (4.10, 5.6) : si `CarteVue`/`EtapeVue` gagne un champ `total`,
  `numero`, `restant`, FR-031 tombe. « Étape 2 sur 5 » est un compteur de progression **dans** un
  exercice ouvert, pas un compteur d'inventaire — il est licite ; un « 3 ancrages disponibles » ne
  l'est pas.
- **`jest-dom` n'existe pas** dans ce harnais : `toBeTruthy()` / `getAttribute()`, jamais
  `toBeInTheDocument()`.
- **Le mutant doit mourir** : un test vert ne prouve rien. Restaurer depuis un instantané `cp`,
  **jamais `git checkout`**.
- **Défenses redondantes** : si la garde de vocabulaire et la garde de voix couvrent le même mot,
  aucune des deux ne meurt à la mutation. Les cibler séparément.

### Ce qui reste ouvert après cette story

- Les **24 créneaux d'ancrage** attendent Anima (s'ajoutent aux 189 déjà déclarés).
- Le **menu de compte** : `/ancrages` rejoint les haltes atteignables par URL seulement.
- La **variante audio** (v1.1) — inscrite dans `deferred-work.md`, pas amorcée ici.

### References

- `_bmad-output/planning-artifacts/epics.md` § Story 5.9
- PRD : FR-023, FR-031, FR-054, FR-055, FR-056, FR-057, FR-067, FR-080, FR-081, FR-086
- `ARCHITECTURE-SPINE.md` : AD-1, AD-7, AD-10, AD-12, AD-14

---

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context) — implémentation, tests et campagne de mutation.

### Completion Notes List

- **Aucune migration.** Première story de l'Epic 5 à n'en avoir aucune, et ce n'est pas un oubli : il
  n'y a rien à persister (D2). La doctrine « une garde de route ne garde rien » ne s'applique pas —
  elle vise le contournement par `authenticated` sur une table `public`, et il n'y a pas de table.
  La garde est une **frontière de dépendance** (`server-only` + `tests/ancrage-frontiere.test.ts`).
- **`vocabulaire.ts` (5.6) avait déjà tout prévu** : le terme `ancrage` y était déclaré
  `interactif: true, premium: true, dureeMinutes: [2, 5]`. Aucune redéclaration ; l'assertion de
  cohérence de durée LIT cette source unique et jette au chargement si la structure en sort (AC2).
- **L'ancrage n'entre PAS dans la bibliothèque** (D1) — la mécanique existait gratuitement, on ne
  l'a pas prise. Une `CarteVue` est une vignette de texte statique : un ancrage rendu ainsi serait à
  l'écran exactement le format court que FR-080 exige de distinguer.
- **Écart au document d'epic assumé** (D5) : les epics listent AD-3 (`AiPort`), le critère
  d'acceptation dit « depuis le corpus d'Anima ». Aucun appel modèle. Coût marginal nul, pas de
  métrage, pas d'allocation résiduelle.
- **Trois issues gardées distinctes** sur la halte : panne de lecture ≠ refus d'offre ≠ rien d'écrit.
  `estPremiumCourante` relance sur panne (3.1, « le doute suspend le commerce ») ; un `?? false`
  aurait lu une panne comme « tu n'as pas l'offre » pour une abonnée active.
- **La garde de corpus de la 5.2 a rougi comme prévu** : `tests/corpus-architecture.test.ts` compte
  les fichiers de `lib/corpus/` de façon EXACTE. Le compte a été porté de 6 à 7 et `ancrage.ts`
  inscrit nommément — jamais en relâchant l'assertion.
- **Vérification** : 223 fichiers / 3588 tests verts, `tsc` + `eslint` + `next build` propres,
  route `/ancrages` bien dynamique. **Campagne de mutation : 26 mutants, 26 tués** (M18 identifié
  ÉQUIVALENT et remplacé par M18b, M21 par M21b — documentés dans `deferred-work.md`).

### File List

**Créés**
- `lib/domain/ancrage.ts`
- `lib/domain/copie-ancrage.ts`
- `lib/corpus/ancrage.ts`
- `lib/data/lire-ancrage.ts`
- `render/ancrage/types.ts`
- `render/ancrage/Ancrage.tsx`
- `render/ancrage/ancrage.module.css`
- `app/ancrages/page.tsx`
- `tests/ancrage.test.ts`
- `tests/ancrage-corpus.test.ts`
- `tests/ancrage-frontiere.test.ts`
- `tests/rendu/ancrage.test.tsx`
- `_bmad-output/implementation-artifacts/corpus-ancrages-a-ecrire.md`

**Modifiés**
- `tests/corpus-architecture.test.ts` (compte exact 6 → 7)
- `_bmad-output/implementation-artifacts/POUR-ANIMA-ce-qui-attend.md` (pile 5️⃣ + Q6)
- `_bmad-output/implementation-artifacts/PORTES-AVANT-PUBLICATION.md` (213 créneaux)
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
