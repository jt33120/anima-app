---
baseline_commit: b8fa12aff79916929c51462fb46ae7aba831c5e7
story_key: "5-1-theme-natal-calcule-une-fois-grave"
epic: 5
story: 1
title: "Le thème natal, calculé une fois et gravé"
epic_name: "Le socle & la lecture"
covers: [FR-047, FR-048, FR-049, FR-053, FR-072, AD-6, AD-3, AD-4, AD-12, AD-13, NFR-011, NFR-013, NFR-022]
depends_on:
  - "1-3-creer-compte-sans-mot-de-passe"
  - "1-4-date-naissance-majorite"
  - "1-5-consentement-art9-declaration-ia"
  - "1-6-consentement-non-contournable-revocable"
  - "1-9-appliquer-barriere-minorite-detectee"
prepare_pour:
  - "5-2-numerologie-complete-deterministe"
  - "5-3-degradation-gracieuse-sans-heure-completion-tronc"
  - "5-4-horoscope-mantra-du-jour"
  - "5-6-accueil-bibliotheque-en-cartes"
status: review
created: "2026-08-07"
sources:
  - _bmad-output/planning-artifacts/epics.md#story-5-1
  - _bmad-output/planning-artifacts/prds/prd-Anima-2026-07-21/prd.md#FR-047
  - _bmad-output/planning-artifacts/architecture/architecture-Anima-2026-07-22/ARCHITECTURE-SPINE.md#AD-6
---

# Story 5.1 : Le thème natal, calculé une fois et gravé

Status: review

**Première story de l'Epic 5.** Elle ouvre la couche `lib/astro/`, qui n'existe aujourd'hui que sous la
forme d'un README d'une ligne. Tout le reste de l'epic s'appuie dessus : la numérologie (5.2) partage la
frontière de déterminisme, la dégradation sans heure (5.3) consomme la version du thème, l'horoscope
(5.4) part des positions natales, la bibliothèque (5.6) affiche le tout.

C'est aussi la **première table art. 9 depuis la 4.2** — et la première dont le contenu n'est pas du
texte écrit par elle, mais un calcul. La discipline art. 9 ne change pas pour autant.

## Story

En tant qu'**utilisatrice**, je veux que **mon thème natal soit calculé exactement à partir de mes
données de naissance puis conservé, jamais inventé par une intelligence artificielle**, afin de **pouvoir
m'y fier comme à un socle stable**.

---

## La frontière de déterminisme — ce n'est pas une optimisation

AD-6 et NFR-011 ne disent pas « le calcul est préférable au modèle ». Ils disent que le socle **est** un
calcul, et qu'un modèle de langage n'y a aucune place. La raison est produit, pas technique :

- Un modèle qui « calcule » un thème natal **hallucine des degrés**. Ils sont plausibles, invérifiables
  par l'utilisatrice, et faux. Le socle serait alors le seul endroit du produit où Anam ment sans le
  savoir — dans la partie que l'utilisatrice croit la plus objective.
- Un modèle **redonne un résultat différent** à chaque appel. Le tronc « bougerait ». FR-051 promet
  l'inverse : il ne se complète que quand elle ajoute son heure.
- Un modèle **coûte à chaque affichage**. FR-047 exige un coût marginal nul.

D'où la triple garde de cette story : le calcul est **pur**, il est **stocké**, et il est **versionné**.

---

## Acceptance Criteria

**AC1 — Calculé une fois, par du code pur, jamais par un modèle.**
Étant donné une utilisatrice dont le `consentement` art. 9 est **valide et non révoqué**, quand son thème
natal est demandé pour la première fois, alors il est calculé **par du code pur dans `lib/astro/`**,
stocké dans `theme_natal` (1:1, versionné), et **aucun appel à un modèle de langage n'intervient** —
gardé par un test de lecture de fichiers : aucun module de `lib/astro/` n'importe `@/lib/ai/*`
(FR-047, AD-6, NFR-011).

**AC2 — [DUR / conformité] Sans consentement, rien ne s'écrit.**
Étant donné une utilisatrice **sans** consentement art. 9 valide (jamais donné, ou révoqué), quand une
écriture de `theme_natal` est tentée — **y compris en direct via l'API REST sous son propre JWT** —
alors la **policy la refuse** (`WITH CHECK` portant `a_consenti_art9()`), et **aucune ligne n'existe**.
Idem pour un compte barré-minorité (`est_barre_minorite()`). Test bloquant en CI (FR-072, AD-13).

**AC3 — La table naît art. 9, fermée.**
Étant donné la frontière de données sensibles, quand `theme_natal` est créée, alors elle porte
`enable row level security` **et** `force row level security`, une policy propriétaire sous
`auth.uid()` (jamais `service_role` applicatif), **aucun grant `anon`**, et son écriture n'est possible
que sous le JWT de l'utilisatrice (AD-4, AD-12).

**AC4 — Coût marginal nul : relu, jamais recalculé.**
Étant donné un thème déjà calculé, quand l'utilisatrice réaffiche son socle, alors la valeur est
**relue depuis le stockage**, et l'`EphemerisPort` **n'est pas appelé une seule fois**. Prouvé par un
port doublé qui compte ses appels : deux lectures consécutives ⇒ **un** calcul (FR-047).

**AC5 — L'éphéméride est derrière un port, et nulle part ailleurs.**
Étant donné que les éphémérides vivent derrière `EphemerisPort`, quand le calcul s'exécute, alors
**aucun fichier hors `lib/astro/adapters/` n'importe `astronomy-engine`** (ni aucun autre moteur), et
l'adaptateur est remplaçable sans toucher au domaine. Garde de lecture de fichiers sur tout `app/`,
`lib/`, `render/`, sur le modèle de `tests/frontiere-stripe.test.ts` (AD-1, AD-6).

**AC6 — Les champs optionnels manquants ne bloquent rien.**
Étant donné l'absence de nom complet, d'heure ou de lieu de naissance, quand le thème est calculé,
alors il **aboutit avec les données disponibles** : les dix corps et les nœuds sont calculés à partir
de la seule date, et l'ascendant / le milieu du ciel / les maisons sont **déclarés absents avec leur
raison**, jamais approximés ni omis en silence (FR-048, FR-049).

**AC7 — [DUR] Aucune prédiction, structurellement.**
Étant donné n'importe quelle sortie du thème, quand elle est produite, alors elle ne contient
**aucune prose** : le contenu stocké est fait de nombres, d'énumérations et d'identifiants, jamais
d'une phrase. Une prédiction ne peut pas s'écrire là où aucun texte libre n'existe. Gardé par un test
qui balaie le contenu produit et rougit sur toute chaîne ressemblant à une phrase (FR-053).

**AC8 — Immuable, sauf pour un recalcul déclaré.**
Étant donné un thème stocké, quand un `update` est tenté, alors il est **refusé** — sauf s'il
**incrémente la version** ET part d'une **empreinte d'entrées différente**. C'est le seul levier que la
5.3 utilisera pour recalculer à l'ajout de l'heure ; il n'existe aucun autre chemin d'écriture
(AD-6, FR-051).

**AC9 — L'heure de naissance est écrivable une fois, pas immuable.**
Étant donné que `date_naissance` est immuable (trigger 0003), quand les colonnes de naissance
optionnelles sont ajoutées, alors elles sont **write-once** : `null → valeur` est permis,
`valeur → autre valeur` est refusé. Une immuabilité franche rendrait la 5.3 **impossible à livrer**.

---

## ⚠️ Les onze pièges — lus dans le code, pas supposés

### P1. `lib/astro/` est un dossier vide avec un README d'une ligne

`lib/astro/README.md` contient exactement `# lib/astro — couche astro (voir ARCHITECTURE-SPINE AD-1/AD-10)`.
Il n'y a **aucun fichier .ts**. Tu poses la couche entière. Écris le README comme l'ont été
`lib/domain/README.md` et `lib/data/README.md` : ils documentent chaque module et **pourquoi** il est
là. C'est le fichier que lira la 5.2.

### P2. `astronomy-engine` NE FOURNIT PAS Chiron. Julian l'a déclaré indispensable.

Vérifié dans `astronomy.d.ts@2.1.19` : l'énumération `Body` vaut exactement
`Sun, Moon, Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto, SSB, EMB, Star1..Star8`.
`Star1..Star8` sont des **points fixes définis par l'utilisateur** (`DefineStar`) — ils ne peuvent pas
représenter un astéroïde en mouvement. **Il n'y a aucun astéroïde, et il n'y en aura pas.**

Ce n'est donc **pas** un oubli à rattraper dans le code : c'est une limite de la source de données.
La story livre le **créneau**, pas la valeur :

```ts
chiron: { statut: "non_calcule", raison: "ephemeride_sans_asteroides" }
```

C'est exactement la discipline FR-050 (« je préfère ne pas te l'inventer ») appliquée à une donnée
que la source ne sait pas produire. Le thème étant **versionné** (AC8), le jour où une source de Chiron
existe, l'adaptateur la fournit, la version s'incrémente et le créneau se remplit — **sans une ligne de
domaine à réécrire**. C'est précisément à ça que sert le port.

> ⚠️ **NE FABRIQUE PAS UN CHIRON APPROXIMATIF.** Une propagation képlérienne à deux corps depuis des
> éléments osculateurs dérive de plusieurs degrés sur quelques décennies — donc de **plusieurs signes**.
> Un Chiron faux est infiniment pire qu'un Chiron absent : il est invérifiable et il a l'air juste.

### P3. Les nœuds lunaires, eux, sont gratuits — et Julian les a demandés aussi

Contrairement à Chiron, les nœuds sont atteignables sans licence, par deux chemins :

- **Nœud moyen** — polynôme de Meeus (47.7), quatre termes en `T` (siècles juliens depuis J2000).
  Domaine public, une dizaine de lignes, déterministe à la seconde d'arc près sur la plage utile.
- **Nœud vrai** — `SearchMoonNode(t)` / `NextMoonNode(n)` d'`astronomy-engine` donnent l'**instant** des
  passages au nœud. La longitude écliptique de la Lune **à cet instant** EST la longitude du nœud, et
  `NodeEventInfo.kind` dit s'il est ascendant ou descendant. Encadre l'instant de naissance par deux
  passages consécutifs et prends le nœud ascendant.

Livre **les deux** et nomme-les distinctement (`noeud_moyen`, `noeud_vrai`) : les astrologues ne les
utilisent pas indifféremment, et un champ `noeud` ambigu obligerait la 5.6 à deviner lequel il porte.

### P4. `heure_naissance` immuable tuerait la 5.3

`date_naissance` est immuable pour une raison précise (`0003_date_naissance.sql:20` — saisie unique
FR-070, contrôle d'âge). Copier ce trigger sur `heure_naissance` serait le réflexe — et une faute :
la story 5.3 promet exactement que « **l'ajout ultérieur de l'heure** » recalcule le thème. Une colonne
immuable rendrait cette promesse intenable, et on ne s'en apercevrait qu'en développant la 5.3.

Le bon invariant est **write-once** : `old IS NULL → new` permis, `old IS NOT NULL AND new <> old`
refusé. Un seul trigger pour toutes les colonnes de naissance optionnelles, dans la même migration.

### P5. « Immuable » et « versionné » se contredisent si on n'écrit pas la règle

L'AC de l'épic dit `theme_natal` **immuable ET versionné**. Pris au pied de la lettre, c'est
contradictoire : ce qui est immuable ne se re-version pas. La lecture juste est :
**il ne change jamais tant que ses entrées ne changent pas.**

Implémentation : un trigger `before update` qui refuse tout, **sauf** si
`new.version = old.version + 1` **ET** `new.empreinte_entrees is distinct from old.empreinte_entrees`.
L'empreinte est un hachage des entrées effectivement utilisées (date, heure, lat/lon/fuseau, système
de maisons, identifiant d'adaptateur). Elle prouve mécaniquement que le recalcul avait une raison —
au lieu de faire confiance à l'appelant.

> L'identifiant d'adaptateur DOIT entrer dans l'empreinte. Le jour où une source de Chiron arrive, les
> entrées de naissance n'auront pas changé : sans lui, le trigger refuserait le recalcul (P2).

### P6. Le calcul paresseux, pas le calcul à l'inscription

AD-6 dit « calculé UNE FOIS à l'inscription ». Câbler un appel après l'écran de consentement serait la
lecture littérale — et un piège : si cet appel échoue (réseau, déploiement en cours), **aucune ligne
n'est écrite et rien ne réessaie**. L'utilisatrice se retrouve durablement sans socle, sans que personne
le sache.

Fais-le **paresseux et idempotent** : `lireThemeNatal()` lit ; s'il n'y a rien, il calcule, insère avec
`onConflict: "utilisatrice_id", ignoreDuplicates: true`, puis relit. L'unicité est garantie par la
**clé primaire**, pas par la discipline de l'appelant — même patron que `depot-journal.ts:22`. Deux
requêtes concurrentes ne produisent qu'une ligne, et une panne se répare toute seule à la lecture
suivante.

Ça satisfait « une seule fois » **plus** fortement que l'appel unique : ce n'est plus une convention,
c'est une contrainte de base.

### P7. `service_role` n'a rien à faire ici

Le réflexe pour « écrire du calculé » est de passer `service_role` — c'est ce que fait `depot-seance`
(trace server-authoritative). **Pas ici** : le thème natal est un contenu art. 9 **possédé par
l'utilisatrice**, comme `entree_journal`. `service_role` contournerait la RLS **et** le write-gate,
c'est-à-dire les deux gardes que l'AC2 exige (AD-12, AD-13).

Le patron à copier est `lib/data/depot-journal.ts` (JWT utilisatrice, `createSupabaseServerClient`),
**pas** `lib/data/depot-seance.ts`.

### P8. Placidus casse au-delà du cercle polaire

Si tu implémentes les maisons Placidus (le système par défaut en astrologie française), la formule
diverge pour `|latitude| > 66,5°` : certaines cuspides n'existent tout simplement pas. Une naissance à
Tromsø ou Rovaniemi n'est pas théorique.

Deux exigences : (a) un **repli documenté** au-delà de la limite — le système de maisons effectivement
employé est **inscrit dans le contenu** (`systeme_maisons: "placidus" | "signes_entiers"`), jamais
supposé ; (b) le système est un **paramètre du domaine**, pas une constante enfouie — la 5.6 pourrait
vouloir l'exposer.

### P9. `NaN` traverse les gardes dans les deux sens

C'est exactement la faute trouvée en revue 4.6 sur `intensite` (`lib/scene/projection.ts:intensiteBornee`) :
`NaN > x` **et** `NaN < x` sont faux tous les deux, donc une valeur non finie franchit toute comparaison
sans incident et se propage.

Le calcul astral en produit facilement : une heure absente devenue `NaN` dans un jour julien, une
`atan2` sur des coordonnées nulles. **Toute longitude qui sort du domaine est validée finie et
normalisée dans `[0, 360)` avant d'être stockée**, et une valeur non finie est une **erreur**, jamais
un `0` silencieux — un `0` signifie « 0° du Bélier », ce qui est une position parfaitement plausible.

### P10. Les positions sont art. 9 ; les erreurs et les logs ne les portent jamais

NFR-022 : jamais de contenu art. 9 en clair dans les logs. `depot-journal.ts:25` montre la discipline —
l'erreur ne porte que le code Postgres, jamais le contenu. Applique-la : `theme_natal.contenu: ${error.code}`,
jamais le payload, jamais la date de naissance, jamais une longitude.

Et si tu ajoutes une route (voir Périmètre) : elle est art. 9, donc `no-store` + `dynamic` —
`tests/routes-art9-entetes.test.ts` la balaiera automatiquement.

### P11. La garde « aucune prédiction » est une garde d'absence — le type le plus facile à écrire faux

`tests/tronc-absence.test.ts` porte l'avertissement en tête de fichier, et il a été trouvé faux
**deux fois** en revue 4.10 : un extracteur qui découpe au mauvais endroit, puis un extracteur devenu
vide après reformatage — une chaîne vide ne contient jamais le mot interdit, donc **verte**.

Les trois disciplines valent ici :
- **(a)** l'extracteur du contenu est éprouvé pour lui-même, sur des cas fabriqués ;
- **(b)** présence avant absence : prouve que le balayage trouve les champs qu'on SAIT présents
  (`soleil`, `lune`, `noeud_vrai`) avant d'affirmer qu'il n'y a pas de prose ;
- **(c)** le balayage n'est jamais vide : le nombre de champs inspectés est asserté `> 0`.

---

## Périmètre — ce que la 5.1 NE fait PAS

| Hors périmètre | Story propriétaire |
|---|---|
| Toute interface d'affichage du thème | **5.6** (la bibliothèque en cartes) |
| Le texte d'interprétation des positions (corpus Anima) | **5.2** / **5.6** |
| L'annonce « il me manque ton heure » et sa fiche | **5.3** (`MESSAGE_SANS_HEURE` existe déjà, inerte) |
| Le formulaire de saisie de l'heure et le recalcul | **5.3** |
| L'état `incomplet` du tronc dans la scène | **5.3** |
| La numérologie | **5.2** |
| Les transits du jour | **5.4** |
| Le géocodage d'un lieu en lat/lon/fuseau | **5.3** — 5.1 stocke les colonnes, ne les remplit pas |

**Aucun composant `render/`, aucune page `app/` dans cette story.** Si tu ajoutes une route, elle sert
uniquement à rendre AC4 observable ; préfère t'en passer — le dépôt suffit et se teste mieux.

---

## Tasks / Subtasks

- [x] **T1 — Migration `0039_theme_natal.sql`** (AC2, AC3, AC8, AC9)
  - [x] Colonnes de naissance optionnelles sur `utilisatrice` (nullable) : `prenom`, `nom_complet`,
        `heure_naissance time`, `lieu_naissance text`, `lieu_latitude`, `lieu_longitude`,
        `lieu_fuseau text`. **Données ordinaires, pas art. 9** — comme `date_naissance` (0003).
  - [x] Trigger **write-once** sur ces colonnes (P4) — `null → valeur` permis, réécriture refusée.
        Ne PAS copier `date_naissance_immuable()`.
  - [x] Table `theme_natal` : PK `utilisatrice_id`, `version int not null default 1`,
        `empreinte_entrees text not null`, `contenu jsonb not null`, `calcule_le timestamptz`.
  - [x] `enable` + `force row level security` ; policy propriétaire
        `using (auth.uid() = utilisatrice_id)` /
        `with check (auth.uid() = utilisatrice_id and public.a_consenti_art9() and not public.est_barre_minorite())`
        — copie littérale du gabarit `0005_write_gate_art9.sql:51` durci par `0006`.
  - [x] Trigger `before update` : refus sauf `version+1` **ET** empreinte différente (P5).
  - [x] Aucun grant `anon` ; `comment on table` documentant le contrat, comme `0016:81`.

- [x] **T2 — `lib/astro/port.ts` : `EphemerisPort`** (AC5)
  - [x] Le port déclare **ce que le domaine demande**, pas ce qu'`astronomy-engine` sait faire :
        longitudes écliptiques des dix corps, nœud moyen, nœud vrai, **Chiron**, temps sidéral.
  - [x] Chaque lecture est soit une valeur, soit une **indisponibilité motivée** — jamais `undefined`
        nu. C'est ce qui rend le créneau Chiron (P2) exprimable sans mentir.
  - [x] Un `identifiantAdaptateur` exposé par le port (entre dans l'empreinte, P5).

- [x] **T3 — `lib/astro/theme-natal.ts` : le domaine PUR** (AC1, AC6, AC7, AC9)
  - [x] `calculerThemeNatal(entrees, ephemeride)` → structure de nombres et d'énumérations, **zéro prose** (AC7).
  - [x] Signes et degrés dérivés des longitudes (`Math.floor(lon / 30)`), jamais d'une table de dates.
  - [x] Ascendant / MC / maisons **seulement** si heure + latitude + longitude sont là ; sinon un
        champ d'absence motivée (AC6). Système de maisons **paramètre**, repli polaire documenté (P8).
  - [x] Normalisation `[0, 360)` + rejet du non-fini (P9).
  - [x] Aucun `import` runtime d'infra, aucun `server-only` — testable en projet `node`.

- [x] **T4 — `lib/astro/adapters/astronomy-engine.ts`** (AC5, P2, P3)
  - [x] Ajouter `astronomy-engine@2.1.19` aux dépendances (MIT, **zéro dépendance transitive**, `.d.ts` fourni).
  - [x] Dix corps via `EclipticLongitude` / `EclipticGeoMoon` ; temps sidéral via `SiderealTime`.
  - [x] Nœud moyen (polynôme de Meeus) **et** nœud vrai (encadrement `SearchMoonNode`/`NextMoonNode`) (P3).
  - [x] Chiron → indisponibilité motivée `ephemeride_sans_asteroides` (P2). **Ne rien approximer.**
  - [x] **Seul fichier du dépôt** autorisé à importer `astronomy-engine`.

- [x] **T5 — `lib/data/depot-theme-natal.ts`** (AC4, P6, P7, P10)
  - [x] `import "server-only"` + JWT utilisatrice (patron `depot-journal.ts`), **jamais `service_role`**.
  - [x] `lireThemeNatal()` : lit → si absent, calcule → insère `ignoreDuplicates` → relit (P6).
  - [x] Erreurs portant le seul code Postgres (P10).

- [x] **T6 — Tests SQL** (AC2, AC3, AC8, AC9) — `tests/theme-natal-sql.test.ts`
  - [x] Sans consentement / après révocation / compte barré ⇒ insert refusé, **zéro ligne**.
  - [x] Avec consentement ⇒ insert accepté ; une **deuxième** insert ⇒ conflit, toujours une ligne.
  - [x] `update` nu refusé ; `update` avec version+1 **et** empreinte différente accepté ;
        version+1 **sans** changement d'empreinte refusé (le mutant qui compte).
  - [x] `relrowsecurity` **et** `relforcerowsecurity` vrais ; **aucun grant `anon`**.
  - [x] Write-once : heure `null → 07:15` ok, `07:15 → 08:00` refusé, `date_naissance` toujours immuable.

- [x] **T7 — Tests de domaine** (AC1, AC6, AC7, AC9) — `tests/theme-natal.test.ts`
  - [x] Déterminisme : même entrée rejouée ⇒ résultat **strictement identique**.
  - [x] Une date de référence vérifiable à la main (par ex. un solstice) tombe au bon degré.
  - [x] Sans heure ⇒ dix corps + nœuds présents, ascendant/maisons **absents avec raison**, aucun throw.
  - [x] Chiron ⇒ `non_calcule` avec sa raison ; **jamais** une longitude fabriquée.
  - [x] Longitude non finie en entrée ⇒ erreur, **jamais un `0` silencieux** (P9).
  - [x] Latitude polaire ⇒ repli déclaré dans `systeme_maisons`, pas un `NaN` de cuspide (P8).

- [x] **T8 — Gardes d'architecture** (AC1, AC5, AC7) — `tests/astro-architecture.test.ts`
  - [x] `lib/astro/**` n'importe **jamais** `@/lib/ai/*` (la frontière de déterminisme, AD-6).
  - [x] `astronomy-engine` n'est importé **que** dans `lib/astro/adapters/` — balayage de `app/`,
        `lib/`, `render/`, patron `tests/frontiere-stripe.test.ts`. Garde **non vacue** :
        le nombre de fichiers balayés est asserté `> 0`.
  - [x] `lib/astro/**` est pur : aucun `server-only`, aucun import runtime de `@/lib/data`, `@/app`,
        `@/render` (patron `arc-architecture.test.ts:38`) — l'adaptateur inclus.
  - [x] **Aucune prose dans le contenu** : balayage du thème produit, discipline (a)(b)(c) de P11.

- [x] **T9 — Validation complète**
  - [x] `supabase db reset` (0001→0039) ; `tsc --noEmit` ; `eslint .` ; `next build`.
  - [x] Suite complète verte (~2167 tests avant cette story).
  - [x] Campagne de mutation sur les gardes DUR : write-gate, trigger de version, write-once,
        frontière `astronomy-engine`, absence de prose. **Restaurer depuis un `cp`, jamais `git checkout`.**
  - [x] `lib/astro/README.md` écrit pour de bon (P1).

---

## Dev Notes

### Décisions prises avec Julian (2026-08-07)

| # | Décision | Conséquence |
|---|---|---|
| **D1** | Adaptateur v1 = **`astronomy-engine@2.1.19`** (MIT, 0 dépendance, ±1′) | La porte pré-lancement « licence éphémérides » **ne bloque plus le développement**. Elle reste ouverte pour Chiron seul. |
| **D2** | Chiron **déclaré indispensable** par Julian, **absent** de la source MIT | Créneau honnête `non_calcule` + version (P2). La porte pré-lancement est **re-cadrée** : elle n'achète plus « la précision », elle achète **Chiron**. |
| **D3** | Nœuds lunaires : **moyen ET vrai**, gratuits | P3. |
| **D4** | Calcul **paresseux et idempotent**, pas post-consentement | P6 — écart assumé à la lettre d'AD-6, plus sûr que le littéral. |
| **D5** | Données de naissance sur `utilisatrice` (ordinaires) ; **seul** `theme_natal` est art. 9 | Cohérent avec `date_naissance` (0003), qui n'a jamais été art. 9. |

### Stack — vérifiée dans le dépôt, pas supposée

- Next 16.2.11 · React 19.2.0 · TypeScript 5.9.3 strict · Node ≥ 22 · Vitest 4.1.10
  (projets **`node`** et **`rendu`**) · `@supabase/ssr` 0.12.3 · Postgres 17.6.
- **Nouvelle dépendance : `astronomy-engine@2.1.19`** — MIT, `main`/`module`/`types` fournis,
  **aucune dépendance transitive** (vérifié sur le registre npm le 2026-08-07).
- Migrations : **0001 → 0038** existent ; la tienne est **0039**.

### Frontières à ne pas franchir

- `lib/astro/` est **pur** (AD-1) : ni `server-only`, ni `@/lib/data`, ni `@/lib/ai`, ni `@/render`.
- `lib/astro/adapters/` est le **seul** endroit qui connaît le moteur d'éphémérides (AD-6, AC5).
- L'écriture passe par le **JWT utilisatrice** (AD-12), jamais `service_role` (P7).
- `lib/scene/` **ne doit pas** importer `lib/astro` — `tests/scene-architecture.test.ts:72` l'interdit
  déjà explicitement. La projection du tronc appartient à la 5.3.
- Le graphe d'imports reste **acyclique** (`tests/modules-acycliques.test.ts`).

### Commande de test

```bash
set -a && . ./.env.local && set +a && npx vitest run
```

Le stack Supabase local doit tourner. **CLI globale `supabase` (`/opt/homebrew/bin/supabase`, v2.67.1)
— jamais `npx supabase`.** `supabase db reset` est permis ; ne jamais supprimer le stack.

### Références

- [epics.md#story-5-1](../planning-artifacts/epics.md) — critères d'acceptation d'origine
- [ARCHITECTURE-SPINE.md#AD-6](../planning-artifacts/architecture/architecture-Anima-2026-07-22/ARCHITECTURE-SPINE.md) — frontière de déterminisme ; §Deferred — licence éphémérides
- [prd.md#FR-047](../planning-artifacts/prds/prd-Anima-2026-07-21/prd.md) — FR-047 à FR-053, FR-072
- [0005_write_gate_art9.sql](../../supabase/migrations/0005_write_gate_art9.sql) — **le gabarit à copier**
- [0006_barriere_minorite.sql](../../supabase/migrations/0006_barriere_minorite.sql) — `est_barre_minorite()`
- [depot-journal.ts](../../lib/data/depot-journal.ts) — patron du dépôt art. 9 sous JWT
- [tronc-absence.test.ts](../../tests/tronc-absence.test.ts) — la discipline des gardes d'absence (P11)
- [frontiere-stripe.test.ts](../../tests/frontiere-stripe.test.ts) — patron de garde de frontière (AC5)

---

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context) — `claude-opus-5[1m]`.

### Debug Log References

- `supabase db reset` 0001 → **0039**, propre.
- `tsc --noEmit` propre · `eslint .` propre · `next build` propre (aucune route ajoutée : la story
  est entièrement serveur, conformément à son périmètre).
- **2274 tests / 165 fichiers**, tous verts (2167 avant la story ⇒ **+107**).
- Campagne de mutation : **22 mutants, 22 tués**.

### Completion Notes List

#### Ce que la story livre

| Couche | Fichier | Rôle |
|---|---|---|
| Base | `supabase/migrations/0039_theme_natal.sql` | entrées de naissance write-once + `theme_natal` art. 9 versionnée |
| Port | `lib/astro/port.ts` | `EphemerisPort` — la seule porte d'entrée d'une éphéméride |
| Domaine | `lib/astro/theme-natal.ts` | le calcul, pur, sans prose |
| Adaptateur | `lib/astro/adapters/astronomy-engine.ts` | 10 corps + 2 nœuds ; Chiron déclaré absent |
| Données | `lib/data/depot-theme-natal.ts` | lecture sous JWT ; calcul paresseux et idempotent |

#### Écarts assumés par rapport à la lettre de la story

1. **Le write-once ne couvre PAS `prenom` / `nom_complet`** (T1 disait « ces colonnes »). Ce sont des
   champs d'identité, pas des entrées de calcul céleste : les figer graverait une faute de frappe à
   vie, contre FR-064 (la correction par l'utilisatrice prime). Ils n'entrent pas dans l'empreinte —
   un test le prouve. Le write-once porte sur les cinq entrées astronomiques.

2. **Maisons en signes entiers, pas Placidus.** Placidus demande un solveur itératif dont une erreur
   de signe **n'échoue jamais** : elle range chaque planète dans une maison voisine — plausible,
   invérifiable, faux. C'est le raisonnement exact qui fait refuser un Chiron approximatif ; il
   s'applique ici. Les signes entiers sont exacts par construction et sans rupture polaire, et
   **l'ascendant lui-même est calculé exactement** dans les deux cas. Le système est un paramètre et
   il est **inscrit dans le thème**, jamais supposé. ⚠️ **Décision produit à confirmer avec Julian.**

3. **Deux raisons d'absence nées de l'écriture des tests** — `fuseau_invalide` (un identifiant IANA
   erroné faisait exploser tout le thème ; il dégrade désormais, en se nommant, parce qu'un défaut
   de donnée doit rester trouvable) et `latitude_polaire` (une naissance au pôle exact faisait
   remonter l'exception du calcul d'ascendant jusqu'à annuler les dix corps — contre AC6).

4. **Chiron : le créneau, jamais la valeur.** `astronomy-engine` n'a aucun astéroïde. Le port le
   déclare, l'adaptateur rend `non_calcule` avec sa raison, et le thème étant versionné (l'identifiant
   d'adaptateur entre dans l'empreinte), une future source le remplira sans réécrire une ligne de
   domaine. **Porte pré-lancement re-cadrée** dans `sprint-status.yaml` : elle n'achète plus « la
   précision », elle achète Chiron — trois voies y sont consignées.

#### Deux erreurs à moi, attrapées par le code

- **Un commentaire faux dans l'adaptateur.** J'avais écrit qu'`Astronomy.Ecliptic()` rend de
  l'écliptique **J2000**. Faux : elle rend le vrai-de-la-date, comme notre chemin. Mon propre test
  anti-J2000 a échoué en le mesurant. Corrigé dans le code (le vrai piège est
  `Rotation_EQJ_ECL()`, dont le nom ne diffère que par le `T` final) et le test est devenu une
  **contre-vérification** : les deux chemins concordent à la précision machine.
- **Un test SQL que j'avais écrit vide.** Ma première version de l'assertion « RLS forcée » appelait
  une RPC d'introspection inexistante et se terminait par `expect(error === null || error !== null)`
  — verte quoi qu'il arrive. Remplacée par une assertion de texte sur la migration **avec contrôle
  du contrôle**, plus les preuves comportementales (anon, isolation inter-locataires).

#### Trois pièges de l'API évités par lecture des typages, pas par supposition

- `Astronomy.EclipticLongitude()` est **héliocentrique** (« as seen from the center of the Sun ») —
  c'est pourtant la fonction qu'on chercherait en premier. L'employer donne un thème vu depuis le
  Soleil : tout faux, rien ne plante. Un test anti-héliocentrique le garde désormais.
- Le repère doit être l'écliptique **vrai de la date** : `Rotation_EQJ_ECL()` perd 0,37° de
  précession en 2026, et l'écart grandit chaque année.
- La Lune a sa propre théorie (`EclipticGeoMoon`), déjà en écliptique de la date.

#### Une garde existante m'a attrapé — pour la troisième story d'affilée

`tests/socle-jamais-coupe.test.ts` (Story 3.3) portait un **inventaire prospectif** : cinq items
FR-055 marqués `existe: false` avec leur détecteur, précisément pour rougir le jour où l'Epic 5
arriverait. Il a rougi. Le contrat qu'il impose a été honoré : l'item passe à `existe: true` **et**
une preuve positive est ajoutée — aucun fichier du socle ne mentionne `premium`, `abonnement`,
`entitlement`, `planOuvert`, `GardeCommerciale` ni `stripe`. La seule garde qui pèse sur le thème
natal est celle du **consentement art. 9**, qui est légale et non commerciale ; les confondre
reviendrait à faire payer une conformité.

#### Campagne de mutation — 22 mutants, 22 tués

| # | Mutation | Issue |
|---|---|---|
| M1 | write-gate `a_consenti_art9()` retiré de la policy | ✅ tué |
| M2 | `est_barre_minorite()` retiré de la policy | ✅ tué |
| M3 | recalcul autorisé sans changement d'empreinte | ✅ tué |
| M4 | saut de version autorisé (`<=` au lieu de `+1`) | ✅ tué |
| M5 | `force row level security` retiré | ✅ tué |
| M6 | write-once retiré sur `heure_naissance` | ✅ tué |
| M7 | version d'insert non forcée à 1 | ✅ tué |
| M8 | garde du non-fini retirée de `normaliserDegres` | ✅ tué |
| M9 | normalisation naïve (`% 360` seul, négatifs préservés) | ✅ tué |
| M10 | signe inversé dans la formule de l'ascendant | ✅ tué |
| M11 | obliquité retirée du milieu du ciel | ✅ tué |
| M12 | longitude **héliocentrique** (le piège n° 1) | ✅ tué |
| M13 | écliptique **J2000** au lieu de la date (piège n° 2) | ✅ tué |
| M14 | minuit au lieu de midi quand l'heure manque | ✅ tué |
| M15 | nœud vrai remplacé par une copie du nœud moyen | ✅ tué |
| M16 | Chiron **fabriqué** au lieu d'être déclaré absent | ✅ tué |
| M17 | identifiant d'adaptateur retiré de l'empreinte | ✅ tué |
| M18 | garde polaire retirée (le thème entier explose) | ✅ tué |
| M19 | borne temporelle basse élargie à l'an 1000 | ✅ tué |
| M20 | upsert écrasant au lieu d'ignorer le conflit | ✅ tué |
| M21 | import d'`astronomy-engine` hors de son adaptateur | ✅ tué |
| M22 | champ de **prose** ajouté au thème | ✅ tué |

Restauration depuis un instantané `cp`, jamais `git checkout` (le dépôt porte du travail non commité).

### File List

**Nouveaux**
- `supabase/migrations/0039_theme_natal.sql`
- `lib/astro/port.ts`
- `lib/astro/theme-natal.ts`
- `lib/astro/adapters/astronomy-engine.ts`
- `lib/data/depot-theme-natal.ts`
- `tests/theme-natal-sql.test.ts` (26 tests)
- `tests/theme-natal.test.ts` (56 tests)
- `tests/astro-architecture.test.ts` (20 tests)

**Modifiés**
- `lib/astro/README.md` (le README d'une ligne devient la documentation de la couche)
- `tests/socle-jamais-coupe.test.ts` (inventaire FR-055 : « thème natal » passe à `existe: true`, + preuve d'absence de gate premium)
- `package.json` / `package-lock.json` (`astronomy-engine` **2.1.19**, épinglé exactement — MIT, zéro dépendance transitive)

### Validation

- `supabase db reset` : 0001 → 0039 ✅
- `tsc --noEmit` ✅ · `eslint .` ✅ · `next build` ✅
- **2274 tests / 165 fichiers** ✅
- Mutation : **22 / 22** ✅
- Migration 0039 **déployée et vérifiée** sur `zlhlzoalmszohrxrnsmo` (2026-08-07), enregistrée sous
  la version `0039` / nom `theme_natal`. Parité fichiers 39 / local 39 / cloud 39.

#### Vérifications post-déploiement

| Contrôle | Résultat |
|---|---|
| 7 colonnes de naissance, toutes `nullable` | ✅ |
| `theme_natal` : `relrowsecurity` **et** `relforcerowsecurity` | ✅ |
| `WITH CHECK` = `auth.uid() = utilisatrice_id AND a_consenti_art9() AND NOT est_barre_minorite()` | ✅ les deux gardes |
| Les 3 triggers (recalcul déclaré, write-once, immuabilité 0003) actifs | ✅ |
| Fonctions-trigger : `{postgres, service_role}` seulement, **aucun `anon`** | ✅ |
| 3 contraintes de plage sur les coordonnées | ✅ |
| Non-régression 0038 — `traiter_evenement_abonnement` toujours en arité 10 | ✅ |
| Non-régression 0003 — `date_naissance` toujours immuable | ✅ |

#### ⚠️ Correction d'une affirmation de l'AC3

L'AC3 dit « **aucun grant `anon`** ». C'est **vrai des FONCTIONS** (vérifié ci-dessus) et **faux au
niveau TABLE** : `anon` porte les 7 privilèges de table par défaut sur `theme_natal` — exactement
comme sur les neuf autres tables art. 9 du projet (`art9_temoin`, `entree_journal`, `branche`,
`fait_extrait`, `consentement`, `intention`, `synthese`, `seance`), vérifié par comparaison.

Ce sont les *default privileges* que Supabase pose sur le schéma `public` — ceux-là mêmes que la
migration 0007 documente pour les fonctions. Ils ne constituent pas une fuite : la garde est la
**RLS forcée**, et sous `anon` `auth.uid()` est nul, donc le `USING` ne rend aucune ligne et le
`WITH CHECK` refuse toute écriture. Les deux tests comportementaux le prouvent (lecture anonyme →
`[]`, écriture anonyme → erreur), et c'est le même raisonnement que celui écrit dans 0007.

**Ce qui est corrigé ici, c'est la formulation de l'AC, pas le code** : `theme_natal` n'introduit
aucune régression, elle est strictement alignée sur la posture existante. Si un jour le projet décide
de révoquer les grants de table `anon`, ce sera une migration transverse sur les dix tables, pas un
correctif de la 5.1.

---

## Change Log

| Version | Date | Description |
|---|---|---|
| 1.0 | 2026-08-07 | Story créée. Décisions D1→D5 arrêtées avec Julian ; onze pièges relevés par lecture du dépôt. |
| 1.1 | 2026-08-07 | Story livrée. T1→T9 complets, 2274 tests, 22/22 mutants. Quatre écarts assumés (write-once limité aux entrées astronomiques, maisons en signes entiers, deux raisons d'absence ajoutées, créneau Chiron). Deux erreurs à moi attrapées par les tests. |
