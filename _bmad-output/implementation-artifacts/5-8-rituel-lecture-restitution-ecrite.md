# Story 5.8 : Le rituel de lecture & la restitution écrite

Status: review

## Story

En tant qu'utilisatrice,
je veux qu'Anam me montre la carte et me demande d'abord ce que j'y vois, puis construise la lecture à partir de ma projection,
afin que le sens vienne de moi et reste consultable.

**Couvre :** FR-017, FR-018, FR-019, FR-020, FR-021, FR-022 · AD-3, AD-4, AD-9, AD-11, AD-12, AD-13, AD-16, AD-17 · renvoi FR-023.

---

## Ce que cette story livre, en une phrase

La 5.7 a livré **le moteur** : `tirerUneCarte()` produit une carte sans rien savoir de personne, et
`tirage` la journalise. Rien de tout cela n'a jamais atteint un écran. La 5.8 livre **le rituel** —
la demande, la carte qui se dépose, la question qui reste seule, la réponse d'elle, la lecture qui
en part, et la restitution qui se garde.

---

## Acceptance Criteria

### AC1 — La demande, et rien qu'elle, ouvre le rituel

**Étant donné** une conversation en cours, **quand** l'utilisatrice demande une lecture avec ses
mots, **alors** le rituel s'ouvre — **et** il n'existe **aucun bouton « tirer une carte » dans le
composeur** : le rituel se demande, il ne se déclenche pas
[Source: EXPERIENCE.md#Dossier — Le rituel de lecture].

**Étant donné** « Mes lectures » sans aucune lecture, **quand** la halte s'affiche, **alors** elle
dit « Aucune lecture pour l'instant. Tu peux en demander une à Anam. » et porte **un lien vers la
conversation** — jamais un déclencheur [Source: EXPERIENCE.md#États vides].

### AC2 — La présentation, et le silence de l'interface

**Étant donné** une carte tirée, **quand** elle est présentée, **alors** **un seul** visuel
propriétaire s'affiche pleine largeur de colonne, dépôt simple : **pas de retournement, pas de
scintillement, pas de son, pas de « mélange » animé, jamais plusieurs cartes** (FR-022).

**Étant donné** que l'utilisatrice n'a pas encore répondu, **quand** l'écran est affiché, **alors**
**aucune signification cataloguée n'apparaît nulle part** : pas de nom de carte, pas de mot-clé, pas
d'infobulle, pas de lien « en savoir plus », pas de panneau « signification » (FR-018). **[DUR]** La
charge utile serveur→client ne **porte pas de quoi** en afficher une : c'est une garde de type, pas
une politique de composant.

### AC3 — La question reste seule

**Étant donné** la carte déposée, **quand** Anam parle, **alors** elle demande **« Qu'est-ce que tu
vois ? »** — **et rien d'autre** (FR-017) : aucune phrase d'accompagnement, aucun indice, aucune
relance. Le composeur prend le focus.

**Étant donné** ce tour, **quand** il est produit, **alors** la question est un **texte constant du
produit**, jamais une génération : un modèle qui formule la question pourrait la teinter de ce qu'il
sait de la carte, et le teintage serait invisible.

### AC4 — La lecture part d'elle

**Étant donné** la réponse de l'utilisatrice, **quand** Anam construit la lecture, **alors** elle
part de **la projection de l'utilisatrice**, à la lumière de ce qu'elle sait d'elle — la
personnalisation vit **dans la lecture, jamais dans la sélection** (FR-019) — **et** elle passe par
`AiPort` (AD-3) sur un chemin art. 9 conforme (AD-4).

**Étant donné** une lecture, **quand** Anam parle, **alors** elle ne formule **aucune prédiction,
aucune date, aucun « il va se passer »** (FR-020, FR-053).

### AC5 — Un tirage, une lecture — et jamais un second

**Étant donné** une lecture ouverte et non encore répondue, **quand** le point d'entrée du rituel est
rappelé — par l'interface, par un rechargement, ou par un appel direct répété — **alors** **la même
carte** est rendue. **[DUR]** L'unicité est **structurelle** (index unique partiel en base), pas un
`if` applicatif : au plus **une** lecture en attente de réponse par utilisatrice.

**Étant donné** une réponse d'Anam interrompue en cours de streaming, **quand** l'échec se produit,
**alors** le texte partiel reste, « Réessayer » s'affiche sous le tour, **et la carte n'est pas
retirée et n'est jamais retirée** — un nouveau tirage nierait le rituel
[Source: EXPERIENCE.md#UJ-3 — Échec].

### AC6 — La restitution écrite

**Étant donné** une lecture terminée, **quand** elle se pose, **alors** une **restitution écrite**
est conservée et consultable dans « Mes lectures », **reprenant les mots de l'utilisatrice en
citation visuellement distincte** de la prose d'Anam, **et** portant **la date**, **le visuel de la
carte** et **un lien vers l'échange source** (FR-021).

**Étant donné** une restitution déjà écrite, **quand** une écriture ultérieure la vise, **alors**
elle est **refusée par la base** : la restitution s'écrit **une fois**.

### AC7 — Le refus se dit avec des mots, jamais avec une erreur

**Étant donné** une demande de lecture pendant une **fenêtre de détresse** (72 h, AD-17), **quand**
elle est formulée, **alors** **aucune carte n'est tirée**, **aucun paywall n'est montré** (AD-9), et
**Anam reste** — la réponse est une phrase d'elle dans le fil, jamais une erreur, jamais un code.

**Étant donné** une demande de lecture par une utilisatrice **non premium**, **quand** elle est
formulée hors détresse, **alors** l'offre est présentée dans le registre déjà acté (FR-056/FR-061),
et **le socle n'est pas coupé**.

**Étant donné** un **consentement art. 9 révoqué** ou une **barrière de minorité** active, **quand**
la demande est formulée, **alors** le refus est **distinct des deux autres causes** et dit avec des
mots. **[DUR]** Les quatre causes ne se confondent plus dans un `42501` indistinct
[Source: deferred-work.md#Story 5.7].

### AC8 — Le vocabulaire

**Étant donné** toute l'interface du rituel, **quand** ce format est nommé, **alors** il s'appelle
**« une lecture »** — jamais « un ancrage », jamais « un mantra » — et le mot **« soin » et ses
dérivés n'y apparaissent jamais** (FR-023, renvoi FR-080).

---

## Les décisions de conception, tranchées ici

Ces sept points sont les endroits où une implémentation raisonnable peut partir de travers. Ils sont
tranchés — ne les rouvre pas sans raison écrite.

### D1 — La demande se lit dans la passe qui tourne déjà, pas dans un appel de plus

Détecter « elle demande une lecture » réclame un modèle : la formulation est libre. Trois options
existaient, et le coût les départage.

| | |
|---|---|
| Un étage de détection dédié, en tour | Un appel modèle bloquant de plus, à **chaque** tour, pour un événement rare. Refusé. |
| Un étage en `after()`, comme la reconceptualisation | Impossible : la demande doit agir **sur ce tour-ci**. `after()` s'exécute après la réponse. |
| **Un signal de plus dans l'extraction d'arc** | **Retenu.** `requeteExtractionArc` tourne DÉJÀ en tour, au tier fort, sous egress art. 9. Un champ de plus dans son schéma de sortie coûte **zéro appel, zéro latence**. |

Conséquence à assumer et à documenter : l'extraction d'arc ne tourne que `if (etatArcCharge)`. Si la
trace de séance est illisible, l'arc part en repli **et la demande de lecture n'est pas vue ce
tour-là**. C'est acceptable — elle le redemandera, et c'est très exactement le comportement d'un
rituel qui « se demande » : il n'a pas à être infaillible au premier mot. Ce qui ne serait **pas**
acceptable, ce serait de dégrader vers un `includes("lecture")` côté serveur ; un tel filtre
ouvrirait le rituel sur la phrase « j'ai fini ma lecture du soir ».

### D2 — L'unicité vit en base, et c'est elle qui tue le re-tirage

Le résidu ouvert par la 5.7 est explicite : *« rien n'empêche encore de tirer dix fois de suite »*.
Tant que le tirage n'était rattaché à rien, il n'existait aucune clé sur laquelle poser l'unicité.
`lecture` naît ici, donc la clé existe :

```
create unique index lecture_une_seule_en_attente
  on public.lecture (utilisatrice_id)
  where reponse is null;
```

Au plus **une** lecture en attente de réponse. Le chemin nominal :

1. lire la lecture en attente → si elle existe, **rendre sa carte**, ne rien tirer ;
2. sinon tirer, insérer `tirage`, insérer `lecture` ;
3. si l'insert rend `23505` (course entre deux onglets), **relire** la lecture en attente et rendre
   **sa** carte.

L'étape 3 est ce qui distingue une garde d'un `if` : sans elle, deux onglets ouverts simultanément
produisent deux cartes et l'index n'a servi qu'à faire échouer la seconde.

⚠️ Ne pas remplacer par un test applicatif « a-t-elle déjà une lecture ouverte ? ». Un `select` puis
un `insert` n'est pas atomique, et c'est précisément la fenêtre qu'une utilisatrice déterminée
exploite.

### D3 — Le tirage reste hors SQL, et l'insert reste sous JWT

`tirerUneCarte()` vit en TypeScript parce que la graine vient de `globalThis.crypto` (AD-11). Elle ne
peut donc pas descendre dans une fonction plpgsql. On garde exactement la séparation de la 5.7 :
tirer d'abord (sans identité), écrire ensuite (sous JWT, RLS applique les quatre gardes de 0050).

`lecture` est écrite **par le même client JWT**, jamais `service_role` (AD-12).

### D4 — Les quatre causes se lisent AVANT de tirer, et dans cet ordre

La 5.7 a laissé un `42501` indistinct. On ne le rend pas lisible en décodant l'erreur — on interroge
les prédicats **avant**, par une RPC unique, et l'ordre du `if` est une décision de sécurité :

1. **fenêtre de détresse** (`branche_bloquee_par_detresse()`) → aucune carte, **aucun paywall**
   (AD-9), Anam reste. C'est premier parce qu'un paywall montré en détresse serait un défaut grave,
   et parce que la détresse ne se négocie pas.
2. **barrière de minorité** (`est_barre_minorite()`) → refus dit.
3. **consentement art. 9 révoqué** (`a_consenti_art9()`) → refus dit, avec le chemin pour le
   redonner.
4. **non premium** → l'offre, dans le registre déjà acté.

Inverser 1 et 4 met un paywall devant quelqu'un en détresse. C'est l'invariant AD-9, et il se teste.

### D5 — La question est une constante, la lecture est générée

`« Qu'est-ce que tu vois ? »` ne passe **jamais** par le modèle. Deux raisons :

- un modèle à qui l'on donne la carte pour formuler la question peut la teinter — « qu'est-ce que
  cette ouverture t'évoque ? » a déjà dit quelque chose ;
- un modèle à qui l'on **ne** donne **pas** la carte produirait la même phrase à chaque fois, au
  prix d'un appel. Autant l'écrire.

La lecture (tour suivant) est générée, capacité **`lecture`**, sur le chemin art. 9 conforme. La
personnalisation vit là, et seulement là (FR-019).

### D6 — Le catalogue de sens reste débranché, et la couture est nommée

`lib/lecture/sens-cartes.ts` porte 24 créneaux **tous `non_ecrit`**. Son usage dépend d'une décision
d'Anima non encore rendue (note privée / garde-fou / suppression). **La story se livre sans le
consulter.**

Une couture unique est prévue pour que ce branchement reste ouvert sans dette : `consigneLecture()`
construit la consigne système du tour de lecture. C'est le **seul** endroit qui aurait à lire le
catalogue si la décision tombait ainsi, et l'option « suppression » se solde par la suppression du
module sans toucher au reste.

**Interdit dans tous les cas :** que le catalogue franchisse la frontière serveur→client. AC2 [DUR]
tient quelle que soit la décision.

### D7 — La restitution s'écrit une fois, et la base le fait respecter

`lecture` a besoin d'un `UPDATE` — la réponse et la restitution s'écrivent après l'insert. La policy
le borne :

```
with check (reponse is not null and restitution is not null)
using (reponse is null)
```

`using` sur `reponse is null` : **seule** une lecture encore en attente est modifiable. Une fois
répondue, elle est close pour toujours. C'est la même doctrine que `tirage` sans policy `UPDATE` —
un rituel qu'on peut réécrire n'est plus un rituel.

---

## Tasks / Subtasks

- [x] **T1 — La migration `0051_lecture.sql`** (AC5, AC6, AC7)
  - [ ] Table `lecture` : `id`, `utilisatrice_id`, `tirage_id` (FK vers `tirage`, **unique**),
        `reponse` (texte d'elle, nullable jusqu'à sa réponse), `restitution` (prose d'Anam,
        nullable), `cle_tour_source` (le lien vers l'échange source, FR-021), `ouverte_a`,
        `close_a`. Horodatages **posés par trigger**, jamais par le processus (doctrine 0046).
  - [ ] `create unique index lecture_une_seule_en_attente on lecture (utilisatrice_id) where reponse is null` (D2)
  - [ ] `tirage_id` **unique** : un tirage sert au plus une lecture (le résidu 5.7 se ferme des deux côtés)
  - [ ] RLS `enable` **et** `force`. Policies : `lecture_lecture` (select owner),
        `lecture_depot` (insert : owner + `a_consenti_art9()` + `not est_barre_minorite()` +
        `not branche_bloquee_par_detresse()` — les **mêmes quatre** que `tirage`),
        `lecture_cloture` (update, bornée par D7). **Aucune policy `delete`** hors l'inventaire
        d'effacement de l'Epic 6 — à noter dans `deferred-work.md`.
  - [ ] RPC `causes_refus_lecture()` : rend les **quatre** prédicats en une passe (D4), sous JWT
  - [ ] Contrainte : `restitution is not null` ⇒ `reponse is not null` (une restitution sans ses mots
        à elle est un défaut FR-021, pas un état)

- [x] **T2 — Le domaine pur : l'arbitrage du refus** (AC7)
  - [ ] `lib/domain/acces-lecture.ts` — fonction PURE `(causes, premium) → Acces`, union discriminée
        `{type:"ouvert"} | {type:"detresse"} | {type:"minorite"} | {type:"consentement"} | {type:"offre"}`
  - [ ] L'ORDRE est dans cette fonction et nulle part ailleurs (D4). Une seule dérivation.
  - [ ] Aucun import framework/infra (AD-1, verrou eslint `lib/domain/**` déjà en place)

- [x] **T3 — Le signal de demande dans l'extraction d'arc** (AC1, D1)
  - [ ] Étendre `requeteExtractionArc` / `extraireSignauxArc` (`lib/domain/signaux-arc.ts`) d'un
        champ `demandeLecture: boolean`
  - [ ] ⚠️ **Ne pas casser l'arc.** Les signaux existants gardent leur forme ; `SIGNAUX_NEUTRES`
        gagne `demandeLecture: false`. Le repli (extraction bloquée/illisible) vaut **pas de
        demande** — jamais l'inverse.
  - [ ] Test : un tour qui parle de « ma lecture du soir » ne déclenche **pas** le rituel

- [x] **T4 — Le dépôt `lib/data/depot-lecture.ts`** (AC5, AC6)
  - [ ] `lectureEnAttente(supabase)` → la lecture ouverte, ou `null`
  - [ ] `ouvrirLecture(supabase, utilisatriceId)` → applique D2 dans l'ordre 1/2/3, y compris la
        **relecture sur `23505`**
  - [ ] `cloreLecture(supabase, id, {reponse, restitution, cleTourSource})` → l'update borné
  - [ ] `listerLectures(supabase)` → pour la halte « Mes lectures », ordonné du plus récent
  - [ ] Réutilise `tirerEtDeposer` (5.7) **sans le modifier** : la séparation tirer/écrire est acquise

- [x] **T5 — Le tour de PRÉSENTATION dans `app/api/anam/message/route.ts`** (AC2, AC3, AC7)
  - [ ] Placé **après** le pipeline sécurité et **après** le gate d'allocation (mêmes raisons que
        les étages existants : un tour coupé ne dépense rien)
  - [ ] Lit les quatre causes (T1) + premium → `acces` (T2) → si `ouvert`, `ouvrirLecture`
  - [ ] Trame NDJSON `carte` : **`cle` + `description` uniquement**. Pas de `sens`, pas de nom, pas
        de mot-clé (AC2 [DUR])
  - [ ] La question est émise comme **texte constant** (D5), pas comme un flux généré
  - [ ] Refus : une phrase d'Anam dans le fil (trame existante), jamais un statut d'erreur (AC7)

- [x] **T6 — Le tour de LECTURE** (AC4, AC6)
  - [ ] Nouvelle capacité `lecture` dans `CapaciteIa` (`lib/ai/port.ts`) + résolution de tier dans
        `lib/ai/politique-tier.ts`. **Tier fort** : c'est un texte long, personnel, qui reprend ses
        mots — le registre document, comme la synthèse.
  - [ ] `lib/domain/consigne-lecture.ts` — la consigne système. **La couture de D6.**
        Elle porte : partir de SES mots · aucune prédiction (FR-020) · registre document · jamais
        nommer la carte · jamais associer la carte à un signe, un nombre ou un type d'ennéagramme
  - [ ] Détecté par : ce tour répond à une lecture en attente (état en base, pas un drapeau client)
  - [ ] Métrage sous clé distincte `:lecture` (jamais exempté — FR-043 n'exempte que la détresse)
  - [ ] À la fin du flux : `cloreLecture` avec ses mots **verbatim** et la restitution

- [x] **T7 — Le rendu du fil** (AC2, AC3, AC5, AC6)
  - [ ] Nouveau `role: "carte"` dans `render/conversation/types.ts` — **aucun champ de
        signification**, garde de frontière comme `OuvertureData`
  - [ ] Monte `render/lecture/CarteTiree.tsx` (déjà livré en 5.7, rend l'absence honnête quand le
        visuel n'est pas dessiné — **23 des 24 manquent**)
  - [ ] **Aucune animation d'entrée** : « la carte est déjà là » (réduction de mouvement, AC2)
  - [ ] Le « Réessayer » d'un tour de lecture **ne purge pas la carte** (AC5) — c'est l'inverse du
        patron `ancreId` des blocs `ressource`/`bilan`/`paywall`. **À tester explicitement.**
  - [ ] La restitution : `BlocDocument` avec ses mots en **citation visuellement distincte**
        (`TourUtilisatrice` porte déjà le filet à gauche ; ne jamais mettre ses mots en `texte-doux`)

- [x] **T8 — La halte « Mes lectures »** (AC1, AC6, AC8)
  - [ ] Page + entrée au menu de compte, à sa place dans l'ordre invariable : *Aide et ressources,
        Ce qu'Anam retient, La synthèse, **Mes lectures**, L'abonnement, Mes données, Ce que j'ai
        accepté, Réglages* [Source: EXPERIENCE.md]
  - [ ] Chaque entrée : date, visuel, ses mots en citation, la restitution, **lien vers l'échange
        source**
  - [ ] État vide : la copie exacte de `EXPERIENCE.md` + lien vers la conversation, **jamais un
        déclencheur**
  - [ ] **Aucun partage** (UX : « ne jamais faire … partager une lecture »)

- [x] **T9 — Les gardes de frontière** (AC2 [DUR], AC8)
  - [ ] `tests/lecture-frontiere.test.ts` : aucun champ de signification dans la trame `carte` ni
        dans les types de vue ; `lib/lecture/**` n'est jamais importé par `render/**`
  - [ ] Le lexique FR-023 balaie **toute** la copie neuve (« soin » et dérivés, « ancrage » employé
        pour « lecture »)
  - [ ] Le balayage FR-020 (aucune prédiction) s'applique à la **consigne** de lecture

- [x] **T10 — Les tests SQL** (AC5, AC6, AC7)
  - [ ] L'index partiel : deux ouvertures concurrentes → une seule lecture en attente
  - [ ] L'update borné : une lecture close refuse une seconde écriture
  - [ ] Les quatre policies, chacune isolément (le piège des défenses redondantes : une garde qui
        n'est couverte que par sa voisine ne meurt pas quand on la mute)
  - [ ] `tirage_id` unique : un tirage ne peut pas servir deux lectures

- [x] **T11 — La suite complète + campagne de mutation**
  - [ ] `npx vitest run` (⚠️ **jamais** en sourçant `.env.local`), `tsc`, `eslint`, `next build`
  - [ ] `supabase db reset` 0001→0051 (⚠️ CLI **globale**, jamais `npx supabase`) —
        **AVANT** la passe de clôture, pas après
  - [ ] Campagne de mutation, TS **et** SQL. Le harnais SQL doit distinguer « migration invalide »
        de « reset qui hoquette » (le faux-kill de la 5.7)

- [x] **T12 — Clôture**
  - [ ] Dev Agent Record, `File List`, `deferred-work.md`, `sprint-status.yaml`
  - [ ] Fermer dans `deferred-work.md` le résidu 5.7 « rien n'empêche de tirer dix fois » et le
        résidu « le `42501` indistinct » — **en nommant la ligne qui les ferme**
  - [ ] `PORTES-AVANT-PUBLICATION.md` : les 23 visuels manquants deviennent bloquants **à l'écran**
        (jusqu'ici ils n'étaient visibles nulle part)

---

## Dev Notes

### L'ordre du pipeline, et pourquoi il ne se négocie pas

`app/api/anam/message/route.ts` est déjà un pipeline ordonné (AD-16), et chaque position a été payée
par une revue. L'étage lecture s'insère **après** le gate d'allocation, pour la raison qui vaut pour
tous les autres : un tour coupé par le quota ne doit dépenser aucun appel modèle et n'écrire aucune
ligne.

Il s'insère **avant** la génération, contrairement à la reconceptualisation / au retour sur le thème
/ à l'hypothèse d'ennéagramme, qui vivent en `after()`. Ces trois-là n'ont **rien à changer au tour
courant** ; la lecture, elle, **est** le tour courant.

### Ce qui existe déjà et qu'il ne faut pas réécrire

| Fichier | Ce qu'il donne | Ce qu'il ne faut pas y toucher |
|---|---|---|
| `lib/tirage/tirer.ts` | `tirerUneCarte()`, arité **nulle** | La signature. `expect(tirerUneCarte.length).toBe(0)` est la garde AD-11. |
| `lib/tirage/alea.ts` | Rejet d'échantillon, graine journalisable | Les bornes en dur des tests (3/24/40) — elles ne s'empruntent jamais à `TAILLE_JEU` |
| `lib/data/depot-tirage.ts` | `tirerEtDeposer` (tirer **puis** écrire) | L'ordre des deux appels : il est testé par un espion |
| `render/lecture/CarteTiree.tsx` | L'absence honnête quand le visuel manque | Le repli `role="img"` + `aria-label` : **23 cartes sur 24** passent par là |
| `lib/corpus/description-cartes.ts` | Les descriptions + le balayage AC8 de la 5.7 | Le balayage « décrire n'est pas signifier » |
| `lib/lecture/sens-cartes.ts` | Le catalogue, `server-only`, **hors** `lib/corpus/` | Ne pas le déplacer dans `lib/corpus/` : `tests/corpus-architecture.test.ts` y interdit `server-only` |
| `render/conversation/EchangeSource.tsx` | **Le lien vers l'échange source existe déjà.** FR-021 le réclame — ne pas en écrire un second | Le réutiliser tel quel |
| `render/conversation/BlocDocument.tsx` | Le registre document (titre + points, déjà structuré serveur) | Le rendu ne parse **aucun** markdown — le serveur structure, le rendu dessine (AD-7) |
| `render/conversation/TourUtilisatrice.tsx` | Ses mots, filet vertical à gauche, **pleine valeur** | Ne **jamais** passer ses mots en `texte-doux` : on ne met jamais ses mots en sourdine |

### Le verrou ESLint AD-11 et ce qu'il n'interdit pas

`lib/tirage/**` ne peut voir ni `@/lib/data`, ni `@/lib/domain`, ni `@/lib/safety`, ni `@/lib/ai`,
ni `@/lib/lecture`, ni `@/lib/corpus`, ni `@/app`, ni `@/render`, ni les chemins relatifs, ni
`import()` dynamique, ni `Math.random`.

**Cette story n'écrit rien dans `lib/tirage/`.** Elle écrit dans `lib/data/`, `lib/domain/`,
`app/api/`, `render/` — tous hors du verrou, et c'est normal : la frontière passe entre les modules.
Si une tâche te pousse à ajouter un paramètre à `tirerUneCarte()`, **arrête-toi** : c'est le signe
que la personnalisation est en train de migrer vers la sélection, ce que FR-019 interdit.

### Les pièges déjà payés dans ce dépôt

- **`jest-dom` n'est pas disponible** dans le projet `rendu`. Utiliser `toBeTruthy()` /
  `getAttribute()`, **jamais** `toBeInTheDocument()` / `toHaveAttribute()`.
- **La séquence `*/` dans une chaîne de test** ferme un commentaire de bloc et casse esbuild. Le
  motif `**/*.ts` s'écrit autrement dans un commentaire.
- **Le piège de la `key`** (trouvé en 4.6) : un composant monté à deux endroits fuit son état entre
  entités si la `key` ne porte pas l'identité. `CarteTiree` est monté dans le fil **et** dans « Mes
  lectures ».
- **Un test qui passe ne prouve rien tant que son mutant n'est pas mort**, et deux défenses
  redondantes se couvrent l'une l'autre — le mutant survit à travers la voisine.
- **Restaurer depuis un instantané `cp`**, jamais `git checkout`.

### Ce qui reste ouvert après cette story

- **Q2 (Anima)** : à quoi sert le catalogue de sens. La couture est `consigneLecture()` (D6).
- **Les 23 visuels manquants** : le rituel les rend visibles, donc bloquants. Les noms des cartes
  sont la Q1, également chez Anima.
- **Les 24 textes de sens** : dépendants de Q2 — ils peuvent disparaître.
- **L'effacement** (`delete` sur `lecture`) : rattaché à l'inventaire de l'Epic 6, FR-067.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.8]
- [Source: _bmad-output/planning-artifacts/prds/prd-Anima-2026-07-21/prd.md#FR-017..FR-023]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Anima-2026-07-21/EXPERIENCE.md#Dossier — Le rituel de lecture]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Anima-2026-07-21/EXPERIENCE.md#UJ-3 — Une lecture]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-Anima-2026-07-21/DESIGN.md#Typographie, #Rayons]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Anima-2026-07-22/ARCHITECTURE-SPINE.md#AD-3, #AD-4, #AD-5, #AD-9, #AD-11, #AD-12, #AD-16, #AD-17]
- [Source: _bmad-output/implementation-artifacts/5-7-tirage-isole-jeu-proprietaire.md]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Story 5.7]

---

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context)

### Completion Notes List

**Vérification :** 219 fichiers / 3528 tests verts · `tsc` + `eslint` + `next build` propres ·
`supabase db reset` 0001→0051 OK · **24 mutants, 24 tués**.

**Trois choses valent d'être retenues au-delà de cette story :**

1. **La garde premium manquait dans la policy.** `lecture_depot` avait les quatre gardes de 0050 mais
   pas `est_premium_courante()`, alors que la route arbitrait correctement. `authenticated` détient le
   grant INSERT table-level : un `.insert()` direct ouvrait une lecture premium sans croiser la route.
   Trouvé en relisant la doctrine de 0037, **pas par un test** — aucun test ne cherche ce qui n'a pas
   été écrit. C'est la septième fois que ce dépôt paie la même leçon.

2. **Mon harnais de mutation a rendu cinq non-verdicts** en décidant de la validité d'une migration
   par la présence du mot « error » dans la prose de `supabase db reset`. Repris en interrogeant
   Postgres : les cinq mutants sont tués. Le 502 sur « Restarting containers » s'est reproduit à
   l'identique de la 5.7.

3. **Un test de frontière vert qui ne gardait rien.** L'assertion « le « Réessayer » ne purge pas la
   carte » cherchait `t.role === "carte"` ; le mutant naturel s'écrit `t.role !== "carte"` et passait.
   Une assertion `not.toContain` sur une forme syntaxique ne garde que cette forme.

**Deux résidus de la 5.7 sont fermés**, et le survivant assumé de la 5.5 avec (la garde de tier vit
désormais dans une assertion de source, la seule place où elle pouvait vivre).

### File List

**Créés**
- `supabase/migrations/0051_lecture.sql`
- `lib/domain/acces-lecture.ts`, `lib/domain/consigne-lecture.ts`, `lib/domain/copie-lecture.ts`
- `lib/data/depot-lecture.ts`
- `render/lecture/Restitution.tsx`, `render/lecture/LienEchangeSource.tsx`
- `app/lectures/page.tsx`
- `tests/acces-lecture.test.ts`, `tests/depot-lecture.test.ts`, `tests/lecture-frontiere.test.ts`,
  `tests/lecture-sql.test.ts`, `tests/rendu/restitution.test.tsx`

**Modifiés**
- `app/api/anam/message/route.ts` (l'étage lecture — le seul du pipeline qui prend le tour à son compte)
- `lib/ai/port.ts`, `lib/ai/politique-tier.ts`, `lib/ai/flux-ndjson.ts`
- `lib/data/depot-tirage.ts` (relit l'identifiant : le rattachement ferme le re-tirage)
- `lib/domain/signaux-arc.ts` (la demande de lecture, passagère de la passe d'arc)
- `render/conversation/` : `Conversation.tsx`, `Fil.tsx`, `types.ts`, `useFluxAnam.ts`, `flux-ndjson-client.ts`
- `render/lecture/lecture.module.css`
- `tests/` : `politique-tier.test.ts`, `signaux-arc.test.ts`, `tirage-depot.test.ts`, `lexique-voix.test.ts`
- `_bmad-output/implementation-artifacts/` : `deferred-work.md`, `sprint-status.yaml`, `PORTES-AVANT-PUBLICATION.md`
