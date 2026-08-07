---
baseline_commit: 67eff0244e7e440512b314ad714631247a9b77bf
---

# Story 3.3 : Tronc gratuit, branches premium, socle jamais coupé

Status: review

Epic 3 · Dépend de : **3.1** (entitlement `abonnement.actif`, source de vérité unique), **3.2** (carte d'abonnement, FR-057 une seule sollicitation), **3.4** (allocation résiduelle, `doitCouperConversation`), **4.5** (naissance d'une branche), **4.6** (l'arbre, la fiche, la vue liste), **4.7** (cycle de vie), **4.10** (`est_premium_courante()`, le patron `planOuvert`), **2.5** (`limites_levees`, AD-9).

> **Ordonnancement.** Cette story a été volontairement **repoussée après les stories d'arbre de l'Epic 4** : elle décide ce qu'un compte gratuit voit de l'arbre, et il fallait que l'arbre existe. L'Epic 4 est clos (4.1 → 4.10, `67eff02`, migration `0036` déployée). Elle est débloquée.

---

## Story

En tant qu'utilisatrice sur un compte gratuit, je veux voir mon tronc et l'espace où mes branches pousseraient, afin de comprendre honnêtement ce que j'ai et ce qui viendrait, sans verrou humiliant.

**Couvre :** FR-088 (le tronc est gratuit, les branches sont premium) · FR-055 (périmètre gratuit à vie) · FR-058 (jamais coupé à zéro) · rappels FR-051 (tronc incomplet), FR-031 (aucun compte, aucune jauge), FR-057 (une seule sollicitation), FR-029 (l'arbre ne régresse jamais) ; AD-12 (RLS), AD-7 (rendu muet), AD-9 (aucun commerce sur la sécurité), AD-15 (repli sûr), AD-17.

---

## Acceptance Criteria

1. **[AC1 — le tronc et la destination]** Étant donné un compte gratuit, quand l'utilisatrice ouvre la destination **L'arbre**, alors elle **voit son tronc** (bâti sur le socle calculé, gratuit), y compris **incomplet**, **et** la destination Arbre est présente dans la navigation **exactement comme sur un compte premium** — **ni grisée, ni cadenassée, ni marquée d'une pastille « premium »**.
2. **[AC2 — DUR / le vide généreux]** Étant donné un compte gratuit sans branche, quand l'arbre s'affiche, alors elle voit **l'espace vide où les branches pousseraient** — le même vide qu'un compte premium sans branche — **et jamais** un cadenas sur le dessin, un aperçu flouté, des branches fantômes en pointillé, un bandeau « passez au premium », ni un compteur de branches manquantes (FR-088).
3. **[AC3 — DUR / la garde serveur]** Étant donné que le tronc est gratuit et les branches premium, quand un compte gratuit atteint la **naissance d'une branche**, alors l'accès est **gardé par l'entitlement premium (3.1) au point d'écriture** — dans le `WITH CHECK` de la policy, **jamais par un simple masquage client**, **jamais dans la seule RPC**.
4. **[AC4 — le périmètre gratuit à vie]** Étant donné FR-055, quand l'utilisatrice utilise l'app sans payer, alors restent accessibles **indéfiniment** : la **première séance intégrale jusqu'au bilan**, les **ressources d'aide (FR-077)**, le **tronc de l'arbre**, **la lecture de tout ce qu'elle a déjà écrit**, et — dès qu'ils existeront (Epic 5) — numérologie, thème natal, horoscope, mantra, ennéagramme.
5. **[AC5 — jamais coupé à zéro]** Étant donné un compte gratuit dont l'allocation résiduelle s'épuise (3.4), quand l'épuisement survient, alors le compte **n'est jamais coupé à zéro** (FR-058) : le socle reste entièrement accessible, et le message n'appâte pas.
6. **[AC6 — la phrase sobre]** Et une phrase sobre en **registre produit** peut, **une seule fois et sans bouton d'achat**, indiquer que les branches se posent en conversation — elle **ne clignote pas et ne réapparaît pas**.

---

## Décisions du PO — **À TRANCHER avant T2**

Ces quatre décisions changent le code. Elles sont posées ici avec une recommandation ; T1 (l'inventaire) peut démarrer sans elles.

### D1 — L'abonnement s'éteint. Que deviennent les branches déjà nées ?

FR-088 dit « les branches sont premium ». Prise au pied de la lettre, une résiliation ferait **disparaître l'arbre** — ce qui contredit frontalement FR-029 (« l'arbre ne régresse jamais ») et l'AC de la 3.5 (« l'arbre et les données ne régressent jamais du fait de la résiliation »).

La maison a déjà tranché ce genre de question, en 4.10, pour le plan d'étapes :

> *« Absent ≠ « son plan disparaît » : la LECTURE reste ouverte. Un paywall qui séquestre ce qui est déjà écrit n'est pas un paywall. »* — `lib/scene/projection.ts`

**Options :**
- **A — Seule la NAISSANCE est premium (recommandé).** Tout ce qui est déjà né reste lisible **et manipulable** : renommer, feuilleter, déclarer la pleine lumière, retirer. Le paywall porte sur ce qui s'ajoute, jamais sur ce qui est déjà à elle.
- **B — Naissance + gestes de progression premium.** Cohérent avec 4.10 (qui ferme l'ÉCRITURE d'une intention sur une branche existante), mais ferme le geste de rayonnement — FR-028, un geste de dignité, pas une fonctionnalité — à quelqu'un qui a arrêté de payer.

**Recommandation : A**, et le code la rend presque forcée. Depuis `0025`, il n'existe **qu'une seule policy UPDATE** sur `branche` — `branche_maj` — et elle couvre **tout** le cycle : renommage, feuillaison, rayonnement. Choisir B reviendrait donc à poser la clause premium sur la policy qui garde aussi le **renommage** : un compte dont l'abonnement s'éteint ne pourrait plus corriger le nom d'une branche qu'il a nommée lui-même. Séparer les trois gestes en trois policies pour y échapper serait une refonte du cycle de vie (4.7) au milieu d'une story de paywall.

Sur le fond, A tient aussi seule : le rayonnement est *« c'est devenu vrai en moi »*. Le facturer, c'est vendre le droit de reconnaître quelque chose sur soi-même. Le plan d'étapes (4.10) est différent — c'est un outil, et il est déjà gardé. Cette asymétrie est délibérée et doit être écrite noir sur blanc dans la migration.

### D2 — Anam propose-t-elle encore une branche à un compte gratuit ?

Aujourd'hui, `lib/safety/ouverture-branche.ts` ne regarde **pas** l'entitlement. Une fois AC3 en place, Anam proposerait une branche, l'utilisatrice la nommerait, et l'écriture serait **refusée**.

C'est exactement la faute que les revues 4.7 puis 4.10 ont trouvée deux fois : *offrir un geste que le point d'écriture refusera*. Sur le nommage, elle est pire qu'ailleurs — le nom est un contenu art. 9 qu'elle vient de composer.

**Options :**
- **A — Anam ne propose pas (recommandé).** Le drapeau premium remonte dans la décision d'ouverture, comme `planOuvert` en 4.10 : pas de proposition, pas de mensonge par omission. La garde d'écriture reste (défense en profondeur, exigée par AC3).
- **B — Anam propose quand même**, et le refus est traité côté client.

**Recommandation : A.** Avec une **précision qui n'est pas négociable** : cela ne doit **pas** dégrader la première séance (FR-059). La première séance se déroule **avant** toute clôture ; la proposition de branche vit dans le détecteur de reconceptualisation (4.4) et peut donc y survenir. Il faut donc vérifier explicitement, en test, qu'un compte gratuit **pendant sa première séance** garde le plein comportement, et que la fermeture ne s'applique qu'**après** le bilan.

> ⚠️ Si la vérification montre qu'une branche PEUT naître pendant la première séance gratuite, alors la première branche est **gratuite par conception** et D2-A doit être reformulée : « Anam ne propose plus **après** la première séance, sur un compte gratuit. » C'est la **première tâche de T1** de trancher ce point sur pièces, pas au jugé.

### D3 — Où vit la phrase sobre d'AC6, et que veut dire « une seule fois » ?

**Options :**
- **A — Elle fait partie de l'état vide de l'arbre (recommandé).** Un compte gratuit sans branche voit `VIDE_TITRE` / `VIDE_CORPS` plus une troisième ligne. Aucun bouton, aucune animation, aucune fermeture — et elle disparaît d'elle-même dès qu'une branche existe. « Une seule fois » = **une seule surface dans toute l'app**, jamais une relance.
- **B — Une occurrence persistée par compte** (colonne `vu_le`), affichée puis plus jamais.

**Recommandation : A.** B fabrique une table, un marqueur et un chemin d'écriture pour une phrase — et transforme une explication en événement commercial daté, ce que FR-057 refuse. A satisfait littéralement « ne clignote pas et ne réapparaît pas » : elle n'*apparaît* jamais, elle *est là*.

### D4 — `ALLOCATION_RESIDUELLE_TOURS` reste-t-elle non configurée ?

Constat de terrain, à ne pas confondre avec un défaut : `limiteAllocationResiduelle()` lit l'environnement à l'exécution ; la variable n'est posée **nulle part** ; `doitCouperConversation` renvoie donc toujours `false`. **La conversation gratuite est illimitée aujourd'hui.** C'est le comportement *conçu* par la 3.4 (« porte ops », `null` = jamais coupé à zéro), pas un trou.

**Options :** **A — on la laisse ouverte jusqu'au lancement** (recommandé, c'est une décision de lancement et pas de code) · **B — on pose une valeur maintenant** et AC5 devient exerçable en vrai.

**Recommandation : A**, avec T6 qui **prouve** AC5 en test (limite posée → coupure → le socle reste ouvert) sans rien poser en production.

---

## Tasks / Subtasks

### T1 — L'inventaire : qu'est-ce qui est déjà gardé, et qu'est-ce qui ne l'est pas ? (AC3, AC4)

- [x] **T1-1** Trancher D2 **sur pièces** : lire `lib/safety/reconceptualisation-pipeline.ts` et `app/api/anam/message/route.ts` et établir si un signal de branche peut naître **pendant** la première séance. Écrire la réponse dans le Debug Log **avant** d'écrire du code.
- [x] **T1-2** Dresser l'inventaire des surfaces premium de FR-056 et de leur garde actuelle. Il est déjà partiellement fait — **le vérifier, ne pas le refaire** :

  | Surface FR-056 | Gardée aujourd'hui ? | Où |
  |---|---|---|
  | conversation illimitée | ✅ | `doitCouperConversation` (3.4) — court-circuit `premium` |
  | plans d'étapes | ✅ | `intention_insertion` / `intention_maj` `WITH CHECK` + `est_premium_courante()` (0036) |
  | synthèse périodique | ✅ | `eligible_au_periodique()` → `a.etat = 'actif'` (0036) |
  | rappel d'échéance | ✅ | même fonction |
  | **les branches** | ❌ **RIEN** | `branche_insertion` (0023) n'a aucune clause premium |
  | lectures, ancrages | — | Epic 5, n'existent pas |
  | mémoire longue | — | à qualifier : les couches 1–3 existent (4.1/4.2/4.3), aucune n'est gardée |
- [x] **T1-3** Qualifier « mémoire longue » : si le rappel opportun (4.3) doit être premium, **le dire ici et le différer explicitement** dans `deferred-work.md` avec sa raison. Ne pas le garder en douce dans cette story.

### T2 — La garde d'écriture de la naissance d'une branche (AC3) — **migration `0037`**

- [x] **T2-1** `drop policy branche_insertion` / `create policy` avec la clause **ajoutée** `and public.est_premium_courante()`. Reprendre **toutes** les clauses existantes de 0023 à la virgule près (propriétaire, `a_consenti_art9()`, `est_barre_minorite()`, `branche_bloquee_par_detresse()`, `branche_nom_significatif(nom)`, `etat = 'naissance'`, `intensite = 0`, l'`exists` sur `entree_journal`).
  > ⚠️ **La faute de la 4.10 était exactement celle-là** : réécrire une policy amendée par plusieurs migrations et en perdre une clause en silence. Poser un en-tête d'avertissement nommant `0021`, `0023` et `0036` comme amendeurs, et **écrire un test qui compare la liste des clauses avant/après**.
- [x] **T2-2** `creer_branche_depuis_signal` : ajouter le **fast-fail amical** premium (échec rapide lisible), en écrivant dans le commentaire que **la RPC n'est pas la barrière** — `authenticated` détient le grant `INSERT` table-level (leçon R1, mémoire `supabase-rls-write-gate-dans-policy`).
- [x] **T2-3** Selon **D1** : commenter explicitement, dans la migration, **pourquoi** la policy UPDATE **`branche_maj`** (0025 — elle couvre renommage **et** feuillaison **et** rayonnement, il n'y en a qu'une) **ne reçoit pas** la clause premium. Un futur relecteur doit trouver la raison sur place, pas la deviner. Écrire aussi qu'un `INSERT` gardé et un `UPDATE` ouvert **est le contrat**, pas un oubli.
- [x] **T2-4** `tests/tronc-branche-sql.test.ts` — l'aller-retour réel : compte gratuit → insert refusé ; premium → accepté ; **et** compte dont l'abonnement passe de `actif` à `expire` : la branche existante **reste lisible et renommable** (D1-A), seule la naissance est refusée.
- [x] **T2-5** Vérifier `revoke`/`grant` de toute fonction touchée (leçon 0007 : `revoke ... from public` **ne retire pas** `anon`).

### T3 — Ne pas mentir par omission : la proposition (AC3, D2)

- [x] **T3-1** Selon **D2-A** : porter l'entitlement dans la décision d'ouverture (`lib/safety/ouverture-branche.ts`), **au patron `planOuvert` de 4.10** — repli sûr, `try/catch` propre pour qu'une panne du gate ne fasse pas taire toute l'ouverture (c'est la régression que la revue 4.10 a trouvée sur ce fichier même).
- [x] **T3-2** Décider dans `lib/` — **jamais** dans `render/` (AD-7). Le rendu constate ; il ne relit pas l'entitlement.
- [x] **T3-3** Test : compte gratuit **pendant la première séance** → comportement **inchangé** (FR-059). Compte gratuit **après le bilan** → aucune proposition. Compte premium → inchangé.

### T4 — L'arbre d'un compte gratuit (AC1, AC2)

- [x] **T4-1** Vérifier — et **ne rien changer si c'est déjà vrai** — que `chargerProjectionArbre` sert `tronc: { present: true }` quel que soit l'entitlement, et que l'état vide d'un compte gratuit est **littéralement le même composant** que celui d'un compte premium sans branche.
- [x] **T4-2** Si un écart existe, le corriger dans `lib/scene` (le modèle), jamais par une branche conditionnelle dans `ArbreInteractif`.
- [x] **T4-3** Test de rendu (`tests/rendu/arbre-gratuit.test.tsx`) : la **même** projection vide rendue « comme gratuite » et « comme premium » produit **le même DOM**. C'est la formulation la plus forte d'AC2 : elle ne dépend pas de la liste des choses interdites.

### T5 — La garde d'ABSENCE (AC2 [DUR], AC1) — **lire l'encadré ci-dessous avant d'écrire une ligne**

- [x] **T5-1** `tests/tronc-absence.test.ts`. Vocabulaire interdit sur les surfaces de l'arbre et de la navigation : `cadenas`, `verrou`, `lock`, `flou`/`blur`, `fantome`/`pointillé`/`dashed`, `passez au premium`, `passe au premium`, `débloque`, `badge`, `pastille`, `premium` **en libellé visible**, et tout **compteur de branches manquantes**.
- [x] **T5-2 — LA CONDITION DE VALIDITÉ.** Chaque assertion d'absence est précédée d'une **assertion de présence non-tautologique** qui prouve que l'extrait examiné est le bon : au moins un libellé **connu** de la surface (`VIDE_TITRE`, `BASCULE_LISTE`, le nom des trois régions…) doit y être trouvé **avant** toute assertion négative.
- [x] **T5-3** Nommer explicitement le **matcher** et son **inventaire de surfaces** (chemins exacts, jamais un basename — patron `garde-commerciale.test.ts`), et **journaliser le nombre de surfaces balayées** (`console.info`) : une garde qui balaie zéro fichier passe au vert.
- [x] **T5-4** Mutation obligatoire, deux sens : (a) injecter « Passe au premium » dans l'état vide → **doit rougir** ; (b) casser le chemin de collecte (pointer le matcher sur un dossier vide) → **doit rougir aussi**.
- [x] **T5-5** Garde de navigation : les trois destinations sont rendues à l'identique quel que soit l'entitlement, et `REGIONS` ne porte **aucun** champ dérivé du premium.

### T6 — Le socle n'est jamais coupé (AC4, AC5)

- [x] **T6-1** `tests/socle-jamais-coupe.test.ts` — l'inventaire **positif** de FR-055, exécutable : pour chaque item qui existe aujourd'hui (1ʳᵉ séance jusqu'au bilan, `/aide` FR-077, tronc, lecture de l'existant), prouver qu'aucun chemin premium ne le garde.
- [x] **T6-2** Le **filet pour l'Epic 5** : la garde énumère les items FR-055 **qui n'existent pas encore** et **échoue le jour où ils apparaissent sans être inscrits dans l'inventaire**. C'est ce qui transforme AC4 en promesse durable au lieu d'un constat daté.
- [x] **T6-3** AC5 en comportement, sans rien poser en production : `ALLOCATION_RESIDUELLE_TOURS` **posée dans le test seul** → la conversation coupe **et** le tronc, la fiche, la vue liste, `/aide` restent atteignables ; la copie reste `LIGNE_QUOTA_EPUISEE` (zéro appât — déjà gardé en 3.4, le re-prouver **du côté du socle**).
- [x] **T6-4** AD-9 : en détresse (`limites_levees`), **rien** de commercial ne se monte — y compris la phrase d'AC6. La garde existante (`garde-commerciale.test.ts`) doit couvrir la nouvelle surface ; l'étendre plutôt que d'en écrire une seconde.

### T7 — La phrase sobre (AC6)

- [x] **T7-1** Selon **D3-A** : une constante dans `render/arbre/copie-arbre.ts`, en registre **produit** — **jamais** signée de la voix d'Anam (Anam ne vend rien, 3.2). Aucun exemple d'achat, aucun prix, aucun lien.
- [x] **T7-2** Rendue **uniquement** sur un compte gratuit **et** un arbre vide **et** hors détresse. Trois conditions, décidées dans `lib/scene`, constatées par le rendu.
- [x] **T7-3** Test : présente dans ce cas précis · **absente** dès qu'une branche existe · **absente** en premium · **absente** en détresse · **aucun** élément interactif dans le même bloc (ni bouton, ni lien).

### T8 — Vérification finale

- [x] **T8-1** Suite complète verte, `tsc`, `eslint`, `next build`, `supabase db reset` 0001→0037.
- [x] **T8-2** **Campagne de mutation** sur chaque garde neuve — en particulier T5, où une garde d'absence qui ne tue pas son mutant ne prouve **rien**.
- [x] **T8-3** Mettre à jour `deferred-work.md` : fermer l'entrée FR-088, et inscrire ce que cette story laisse ouvert (items FR-055 d'Epic 5, « mémoire longue » si différée en T1-3).

---

## Dev Notes

### ⚠️ La leçon qui gouverne cette story : une garde d'absence doit prouver qu'elle regarde au bon endroit

La moitié des critères d'acceptation sont des exigences d'**absence**. C'est le type de garde le plus facile à écrire et le plus facile à écrire **faux**, parce qu'il échoue silencieusement dans le bon sens.

La revue 4.10 l'a trouvé **deux fois sur le même test** :

1. `corpsDuType()` découpait le type à la première `;` — sur une union multi-lignes, il ne renvoyait qu'un fragment. La recherche du mot interdit portait sur un extrait tronqué : **verte**.
2. Corrigé une première fois, il restait dépendant du formatage. Un simple reformatage rendait l'extrait **vide**. Chercher un mot interdit dans une chaîne vide réussit toujours : **encore verte**.

Le correctif n'est pas « mieux découper ». C'est **prouver d'abord la présence** : une assertion d'absence n'est recevable que si une assertion **positive** a démontré, juste avant, que l'extrait examiné contient bien ce qu'on croit examiner. C'est T5-2, et c'est non négociable.

Le second piège est le **balayage vide** : un matcher de fichiers qui ne trouve aucun fichier passe toutes ses boucles au vert. `garde-commerciale.test.ts` s'en protège par des assertions de **non-vacuité** explicites (`expect(routesCommerciales.length).toBeGreaterThan(0)`) — reprendre ce patron mot pour mot.

### La règle R1 : la garde vit dans la policy, jamais dans la RPC seule

`authenticated` détient le grant `INSERT` **table-level** sur `branche`. Un `.from("branche").insert(...)` direct **contourne toute RPC**. Une garde premium posée uniquement dans `creer_branche_depuis_signal` serait donc **décorative** — et AC3 dit littéralement « jamais par un simple masquage client ». La barrière est le `WITH CHECK`. La RPC ne porte qu'un échec rapide amical.

C'est déjà le patron de la 4.10 (`intention_insertion`) : le copier, ne pas l'inventer.

### La faute à ne pas refaire : réécrire une policy amendée sans relire ses amendements

`branche_insertion` a été créée en `0021` puis **remplacée intégralement** en `0023` (qui a ajouté `etat`, `intensite`, la borne de nom et l'`exists` sur `entree_journal`). En 4.10, j'ai réécrit `reserver_notification` depuis la version `0030` et **effacé en silence** la garde de désabonnement ajoutée par `0034`. Seul un test de comportement l'a rattrapée.

**Procédure imposée pour T2-1 :** partir du texte de `0023`, pas de mémoire ; ajouter **une** clause ; et écrire un test qui énumère les clauses attendues, pour que la prochaine réécriture ne puisse pas en perdre une.

### Le sens du doute, garde par garde

Le repli sûr n'a pas un sens unique dans ce projet — il a le sens de ce qu'il protège. Les trois exemples voisins :

| Garde | Panne → | Pourquoi |
|---|---|---|
| `limitesCommercialesLevees` | `true` | le doute **suspend le commerce** (AD-9) |
| `estPremiumCourante` (route message) | `premium = true` | le doute **ne coupe pas** l'accès (FR-058) |
| `planOuvert` (4.10) | `false` | le doute **ferme l'écriture** — mieux vaut un champ absent qu'un refus après coup |

La garde de naissance de branche suit le **troisième** modèle côté proposition (D2 : le doute ne fait pas parler Anam) et le **premier** modèle nulle part : une panne de lecture d'entitlement ne doit **jamais** faire naître une branche à quelqu'un qui n'y a pas droit — mais elle ne doit pas non plus effacer le tronc. Écrire ce raisonnement dans le code, comme partout ailleurs ici.

### État des lieux du code — ce qui existe déjà, à réutiliser tel quel

| Besoin | Existe déjà | Chemin |
|---|---|---|
| Entitlement premium (TS) | ✅ | `lib/data/lire-abonnement.ts` → `estPremiumCourante()` |
| Entitlement premium (SQL, sous JWT) | ✅ | `est_premium_courante()` (0036) — `security definer`, `authenticated` seul |
| Dérivation pure | ✅ | `lib/domain/abonnement.ts` → `estPremium()` |
| Garde de montage commerciale | ✅ | `app/_commerce/GardeCommerciale.tsx` |
| Patron « ne pas mentir par omission » | ✅ | `planOuvert` dans `lib/safety/projection-arbre.ts` |
| Coupure de conversation | ✅ | `lib/domain/allocation-residuelle.ts` |
| Copie sans appât | ✅ | `render/conversation/ligne-quota.ts` |
| État vide de l'arbre | ✅ | `render/arbre/copie-arbre.ts` → `VIDE_TITRE` / `VIDE_CORPS` |
| Navigation sans cadenas | ✅ (par construction, **non gardée**) | `render/scene-dom.tsx` → `<nav className={s.nav}>` |
| Garde d'écriture premium sur `branche` | ❌ **c'est le travail de cette story** | `branche_insertion` (0023) |

**Ne rien réinventer.** En particulier : ne pas créer un second prédicat premium, ne pas créer une seconde garde de montage, ne pas dupliquer `sansCommentaires` (dette de test connue, 23 fichiers — la laisser telle quelle).

### Frontières à ne pas franchir

- **AD-7** — `render/` ne lit ni la base, ni l'environnement, ni l'entitlement. Il reçoit un drapeau et dessine. Toute décision « gratuit vs premium » vit dans `lib/scene` ou `lib/safety`.
- **AD-12** — jamais `service_role` pour lire un entitlement d'utilisatrice, jamais `.from()` direct : RPC possédées.
- **AD-9** — aucun commerce ne s'interpose sur la sécurité. La phrase d'AC6 est du commerce au sens de cette règle : elle passe sous la garde.
- **NFR-022** — aucun contenu art. 9 dans un log ou un message d'erreur, y compris dans les nouveaux refus.
- **FR-031** — aucun compte, aucune jauge. Un « compteur de branches manquantes » viole AC2 **et** FR-031 : la garde doit citer les deux.

### Ce que cette story ne fait PAS

- Elle ne touche **pas** à la carte d'abonnement (3.2) ni au tunnel Stripe (3.1).
- Elle n'implémente **pas** la résiliation ni la garantie (3.5).
- Elle ne crée **aucun** item du socle (Epic 5) — elle pose la garde qui les protégera quand ils arriveront.
- Elle ne **pose pas** `ALLOCATION_RESIDUELLE_TOURS` en production (D4-A).

### Environnement et outillage

- **Supabase local** : CLI **globale** `supabase` (v2.67.1), **jamais** `npx supabase`. La stack locale est le banc d'essai — ne pas la détruire.
- **Tests** : `set -a && . ./.env.local && set +a && npx vitest run`. Deux projets Vitest : `node` (`tests/**/*.test.ts`) et `rendu` (jsdom, `tests/rendu/**/*.test.tsx`).
- **Mutation-vérification** : appliquer le mutant → compter les rouges → restaurer depuis un instantané `cp`, **jamais `git checkout`** (le dépôt porte du travail non commité ; l'incident est documenté dans la 3.4). `-1` ou 0 test exécuté est une **erreur**, pas un survivant.
- **Migration** : `0037`. Déploiement cloud (`zlhlzoalmszohrxrnsmo`) via la Management API, avec un `User-Agent` non par défaut, **après** feu vert.

### References

- [epics.md#Story 3.3](../planning-artifacts/epics.md) — critères d'acceptation d'origine (l. 744-761)
- [prd.md#FR-055/FR-056/FR-058/FR-088](../planning-artifacts/prds/prd-Anima-2026-07-21/prd.md) — l. 184-192
- [EXPERIENCE.md](../planning-artifacts/ux-designs/ux-Anima-2026-07-21/EXPERIENCE.md) — « Accès — le tronc est gratuit » (l. 275-281), navigation (l. 82-88), tronc incomplet (l. 181)
- [DESIGN.md](../planning-artifacts/ux-designs/ux-Anima-2026-07-21/DESIGN.md) — `tronc-incomplet` (l. 594), interdits d'interface (l. 712)
- [0023_branche_arbre_correctifs.sql](../../supabase/migrations/0023_branche_arbre_correctifs.sql) — la policy `branche_insertion` à amender (texte de référence pour T2-1)
- [0025_branche_cycle_vie.sql](../../supabase/migrations/0025_branche_cycle_vie.sql) — `branche_maj`, l'unique policy UPDATE (l. 198-205), et `progresser_feuillaison` / `declarer_rayonnement`
- [0036_intention_arbitrage.sql](../../supabase/migrations/0036_intention_arbitrage.sql) — `est_premium_courante()`, `eligible_au_periodique()`, le patron `WITH CHECK` premium
- [garde-commerciale.test.ts](../../tests/garde-commerciale.test.ts) — le patron de garde structurelle avec non-vacuité
- [3-4-allocation-residuelle-metrage-exactement-une-fois.md](3-4-allocation-residuelle-metrage-exactement-une-fois.md) — Dev Agent Record : les 3 gardes de régression mises à jour, l'incident `git checkout`

---

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context) — `claude-opus-5[1m]`

### Debug Log References

#### Arbitrages du PO — D1 à D4 tranchés par Julian le 2026-08-06

Les quatre recommandations écrites dans la section « Décisions du PO » sont **retenues telles quelles** :
**D1-A** (seule la naissance est premium) · **D2-A** (Anam ne propose pas, sous réserve de T1-1) ·
**D3-A** (la phrase vit dans l'état vide, sans persistance) · **D4-A** (`ALLOCATION_RESIDUELLE_TOURS`
reste non configurée). T2 est débloquée.

#### T1-1 — D2 sur pièces : une branche peut-elle naître pendant la première séance gratuite ?

**Réponse : non, pas le jour même — et la formulation de D2-A tient sans reformulation.**

Le verrou n'est pas dans le pipeline, il est dans `charger_proposition_branche`
(`0021_branche.sql` l. 241) :

```sql
and (s.cree_le at time zone 'Europe/Paris')::date < (now() at time zone 'Europe/Paris')::date
```

Le jour civil **Paris** du signal doit être **strictement antérieur** à celui de la lecture. Un signal né
pendant la première séance n'est donc **jamais** proposable ce jour-là. Et `creer_branche_depuis_signal`
(0024 l. 91-99) exige un signal `en_attente` **dont l'app ne connaît l'identifiant que par cette RPC** :
sans proposition, pas d'identifiant, pas de naissance.

**Le cas résiduel, nommé pour ne pas mentir :** `seanceClose` vaut `etatArcCharge?.finProposee ?? false`
(`app/api/anam/message/route.ts` l. 192) — la « première séance » dure tant que le bilan n'a pas été
proposé. Une utilisatrice qui parle jour 1 sans atteindre le bilan et revient jour 2 est donc, formellement,
**encore dans sa première séance** et pourrait y voir une proposition. Le gate premium la lui retirerait.

**Ce cas ne dégrade pas FR-059**, et pour une raison de périmètre, pas de commodité : FR-055 énumère le
gratuit à vie et **n'y fait figurer aucune branche** ; FR-056 les classe explicitement en premium. La
première séance est gratuite en tant que **conversation** — sa qualité, sa longueur, son bilan. Une branche
n'a jamais fait partie du gratuit, ni jour 1 ni jour 2. Fermer la proposition ne retire donc rien à
FR-059 ; l'ouvrir donnerait un artefact premium.

**Conséquence de conception, qui devient la garantie réelle de FR-059 :** on ferme la **PROPOSITION**, on
ne touche **jamais** au **SIGNAL**. `evaluerReconceptualisationDuTour` continue d'enregistrer les signaux
d'un compte gratuit à l'identique. C'est la doctrine que le module porte déjà pour l'arbitrage — *« l'écarter
serait perdre définitivement une prise de conscience, sans trace et sans recours »* — et elle vaut ici
mot pour mot : le jour où elle s'abonne, ses moments mûrs sont là, intacts. Un gate posé sur le signal les
aurait effacés en silence, et c'est le seul endroit de cette story où l'on pouvait détruire quelque chose.

C'est ce que T3-3 prouve : compte gratuit → le pipeline de détection et la persistance du signal sont
**inchangés** ; seule la proposition se tait.

#### T1-2 — Inventaire des surfaces FR-056 vérifié sur pièces

| Surface FR-056 | Gardée ? | Vérifié où |
|---|---|---|
| conversation illimitée | ✅ | `doitCouperConversation` l. 28 — `if (e.premium) return false` |
| plans d'étapes | ✅ | `intention_insertion` l. 255 / `intention_revision` l. 272 (0036) |
| synthèse périodique | ✅ | `eligible_au_periodique()` → `join abonnement … etat = 'actif'` (0036) |
| rappel d'échéance | ✅ | même fonction |
| **les branches** | ❌ **rien** | `branche_insertion` — dernière définition en **0023** l. 59-70, aucune clause premium |
| lectures, ancrages | — | Epic 5, n'existent pas |
| mémoire longue | ⏭️ | différée — voir T1-3 |

`est_premium_courante()` n'a que **deux appelants** dans tout le SQL (0036 l. 255 et l. 272). La naissance
d'une branche est bien la seule surface premium non gardée.

**Point vérifié en plus, contre le risque de la 4.10 :** `branche_insertion` n'a été touchée que par `0021`
(création) et `0023` (remplacement intégral). `0025` a remplacé `branche_renommage` par `branche_maj` mais
**n'a pas touché à l'insertion** — malgré le commentaire de 0023 « à relâcher en 4.7 ». Le texte de
référence pour T2-1 est donc bien celui de **0023**, et lui seul.

#### T1-3 — « mémoire longue » : différée, explicitement

Les trois couches (4.1 journal brut, 4.2 faits extraits, 4.3 rappel opportun) existent et **aucune n'est
gardée**. Elles ne le seront pas dans cette story, pour une raison qui n'est pas de la paresse : garder le
**stockage** ferait qu'Anam **oublie** ce qu'on lui a confié le jour où l'abonnement s'éteint — c'est-à-dire
exactement la régression que D1-A vient d'interdire pour les branches. Le seul découpage défendable
porterait sur le **rappel opportun au-delà de la séance courante** (4.3), et c'est une décision de produit
qui a besoin d'un arbitrage PO à elle. Inscrite dans `deferred-work.md` en T8-3, jamais gardée en douce.

#### Trois choses que l'implémentation a changées par rapport au plan de la story

**(1) `premiumSousJwt` a été EXTRAIT plutôt que recopié.** T3-1 disait « au patron `planOuvert` de 4.10 ».
Recopier ce patron aurait fabriqué un **second prédicat premium** — ce que les Dev Notes interdisent
explicitement (« ne pas créer un second prédicat premium »). Le corps de `planOuvert` vit désormais dans
`lib/safety/entitlement-premium.ts`, avec un `motif` paramétré ; `projection-arbre.ts` et
`ouverture-branche.ts` l'appellent tous deux. Comportement, repli et motifs de journal **inchangés**.

**(2) L'état vide de l'arbre a été UNIFIÉ en un composant.** T4-1 demandait de vérifier que le vide
gratuit est « littéralement le même composant » que le vide premium. La vérification a montré que non :
`VIDE_TITRE`/`VIDE_CORPS` étaient rendus par **deux** blocs, un dans `ArbreInteractif`, un dans
`VueListe`. Deux copies du même écran, c'est deux endroits où poser un cadenas — et un endroit où
l'oublier. `render/arbre/EtatVideArbre.tsx` rend AC2 structurel au lieu de coïncident.

**(3) La phrase d'AC6 nomme l'abonnement.** AC6 n'exigeait littéralement que « les branches se posent en
conversation ». S'en tenir là aurait recréé, sur un compte gratuit, la faute même que cette story ferme :
depuis T3, Anam ne propose plus de branche sans abonnement — une phrase qui dirait seulement « ça vient
en parlant » enverrait quelqu'un parler en attendant quelque chose qui n'arrivera pas. FR-088 demande la
représentation « **honnête** » de ce qu'elle n'a pas encore ; honnête veut dire complète. Le mot retenu
est « abonnement », jamais « premium » (registre de l'étiquette, interdit par AC1). Cela a fait tomber de
la liste des interdits le mot `abonn`, que j'y avais mis par réflexe — le partage se fait sur le
**registre** (le nom décrit, le verbe « abonne-toi » vend), et c'est écrit dans la garde.

#### Deux tests qui passaient pour de mauvaises raisons — trouvés et corrigés en cours de route

- **`arbre-gratuit.test.tsx`** : la première version retirait la *chaîne* de la phrase avant de comparer
  les DOM, laissant un `<p></p>` vide derrière elle. La garde a rougi sur sa propre approximation. On
  retire désormais l'**élément entier**.
- **`socle-jamais-coupe.test.ts`** : le client factice répondait `data: false` à toutes les RPC ;
  `chargerBranches` faisait donc `false.map(...)`, levait, et le `catch` rendait `ARBRE_INDISPONIBLE` —
  qui porte lui aussi `tronc: { present: true }`. Le test était vert **sans avoir exécuté une seule
  ligne du chemin qu'il prétendait garder**. Corrigé : le client répond par RPC, et l'assertion
  `indisponible === undefined` prouve qu'on est sur le chemin nominal.

#### Régression attendue, réparée sans rien affaiblir

Cinq tests de 4.5/4.6 sont tombés à l'ajout de la garde : leurs fixtures faisaient naître des branches
sans abonnement. `creerUtilisatrice` pose désormais un abonnement actif dans `tests/branche.test.ts` et
`tests/branche-correctifs.test.ts`. **Ce n'était pas une commodité** : sans abonnement, leurs REFUS
seraient devenus ambigus — un insert refusé pourrait l'être par la clause premium au lieu de la clause
sous test, et chaque garde passerait pour une raison qui n'est pas la sienne (le piège des défenses
redondantes). Aucune assertion n'a été touchée.

#### Campagne de mutation — 23 mutants, 23 tués (T8-2)

| # | Mutation | Tué par |
|---|---|---|
| m1 | `est_premium_courante()` retiré du `WITH CHECK` de 0037 | 5 tests (dont le refus 42501) |
| m2 | commerce AVANT sécurité dans la RPC (AD-9 inversé) | test d'ordre des gardes |
| m3 | `est_premium_courante()` ajouté à `branche_maj` | garde D1-A |
| m4 | **une clause de 0023 perdue à la réécriture** (la faute 4.10) | conservation de clauses — nomme la clause ET le fichier |
| n1 | gate premium retiré de `chargerOuverture` | 2 tests |
| n2 | repli de `premiumSousJwt` basculé à `true` | test du sens du doute |
| n3 | entitlement introduit dans le pipeline de détection | garde FR-059 |
| n4 | **chemin de collecte cassé** (mauvais fichier examiné) | non-vacuité |
| p1 | pastille ajoutée à l'écran gratuit | diff DOM (sans connaître son nom) |
| p2 | clause détresse retirée de la décision AC6 | 2 tests |
| p3 | `VueListe` reprend sa propre copie du vide | garde UX-DR-37 |
| q1 | « Passe au premium » injecté dans l'état vide | vocabulaire interdit |
| q2 | **inventaire de surfaces vidé** | existence + témoins |
| q3 | **extracteur rendant `[]`** | 5 tests |
| q4 | champ premium ajouté à une région | forme de `CATALOGUE_REGIONS` |
| q5 | `disabled` ajouté à la navigation | garde du bloc `<nav>` |
| r1 | `app/(scene)/horoscope/page.tsx` créé | filet Epic 5 (T6-2) |
| r2 | tronc rendu conditionnel | garde FR-088 |
| r3 | 1ʳᵉ séance décomptée | garde FR-059 |
| r4 | `/aide` se met à lire la session | garde FR-077 |
| s1 | phrase AC6 réécrite dans la voix d'Anam | 2 tests de registre |
| s2 | **phrase AC6 vidée** | 8 tests |
| s3 | prix ajouté à la phrase AC6 | 2 tests |

Les six mutants en gras sont ceux qui cassent le **chemin de collecte** plutôt que le code gardé — la
moitié de la mutation à deux sens exigée par T5-4, et la seule qui prouve qu'une garde d'absence
regarde vraiment quelque chose.

### Completion Notes List

- **AC1** ✅ — `CATALOGUE_REGIONS` ne porte que `{id, nom, destinationDirecte}` (garde de forme) ; le bloc
  `<nav>` ne lit ni la projection ni l'entitlement ; la bascule vue liste/arbre est offerte à l'identique.
- **AC2 [DUR]** ✅ — deux gardes complémentaires : le **diff DOM** gratuit/premium (rougit sur n'importe
  quelle différence, même sans nom) et la **garde de vocabulaire** (9 interdits × 9 surfaces, 316 chaînes
  visibles balayées, comptage journalisé).
- **AC3 [DUR]** ✅ — `est_premium_courante()` dans le `WITH CHECK` de `branche_insertion` (0037), prouvé
  par un `.from("branche").insert()` DIRECT sous JWT — le seul chemin où la policy joue seule (leçon R1).
  Fast-fail amical dans la RPC, **après** la garde de détresse (AD-9).
- **AC4** ✅ — inventaire FR-055 exécutable, **armé pour l'Epic 5** : les 5 items à venir portent un
  détecteur, et leur apparition fait rougir le test avec le mode d'emploi dans le message.
- **AC5** ✅ — `ALLOCATION_RESIDUELLE_TOURS` posée **dans le test seul** (D4-A) : la coupure est prouvée,
  le socle reste ouvert, la copie n'appâte pas, la détresse lève toujours la limite.
- **AC6** ✅ — une phrase, dans l'état vide, sans persistance, sans bouton, sans lien ; absente dès qu'une
  branche existe, absente en premium, absente en détresse (AD-9), absente sur une panne de lecture.
- **D1-A** ✅ — un abonnement éteint LIT toujours sa branche, la RENOMME et déclare le RAYONNEMENT ; seule
  une nouvelle naissance est refusée.
- **D2-A** ✅ — Anam se tait sur un compte gratuit **sans que le germe soit lu** (minimisation), et le
  SIGNAL n'est jamais gaté : rien de ce qu'elle a compris n'est perdu.

**Vérifications finales** : 2036 tests / 157 fichiers verts (après `supabase db reset` 0001→0037),
`tsc --noEmit` propre, `eslint .` propre, `next build` propre.

**Non déployé en cloud** : la migration `0037` attend le feu vert (Dev Notes, « après feu vert »).

### File List

**Nouveaux**
- `supabase/migrations/0037_branche_naissance_premium.sql`
- `lib/safety/entitlement-premium.ts`
- `render/arbre/EtatVideArbre.tsx`
- `tests/tronc-branche-sql.test.ts`
- `tests/tronc-absence.test.ts`
- `tests/socle-jamais-coupe.test.ts`
- `tests/rendu/arbre-gratuit.test.tsx`

**Modifiés**
- `lib/safety/ouverture-branche.ts` — gate premium D2-A, en tête ; note sur les deux doutes opposés
- `lib/safety/projection-arbre.ts` — `planOuvert` délègue à `premiumSousJwt`
- `lib/scene/projection.ts` — `doitDireOuNaissentLesBranches` ; note sur le drapeau partagé
- `render/arbre/copie-arbre.ts` — `VIDE_OU_NAISSENT_LES_BRANCHES`
- `render/arbre/ArbreInteractif.tsx` — état vide unifié, décision AC6 lue du modèle
- `render/arbre/VueListe.tsx` — état vide unifié
- `tests/ouverture-branche.test.ts` — client premium par défaut ; blocs D2-A et FR-059
- `tests/garde-commerciale.test.ts` — la surface AC6 entre dans l'inventaire AD-9
- `tests/branche.test.ts`, `tests/branche-correctifs.test.ts` — précondition d'abonnement restaurée
- `_bmad-output/implementation-artifacts/deferred-work.md` — FR-088 fermé ; 3 reports ouverts

---

## Change Log

| Date | Version | Description | Auteur |
|---|---|---|---|
| 2026-08-06 | 1.0 | Story créée. Ordonnancée après l'Epic 4 (décision actée : la 3.3 est une story d'arbre). Quatre décisions PO posées avec recommandation. Inventaire des gardes premium existantes établi sur pièces : seule la naissance d'une branche est non gardée. | Julian + Claude Opus 5 |
| 2026-08-07 | 1.1 | D1–D4 tranchées (toutes les recommandations retenues). T1→T8 implémentées : migration `0037`, gate d'ouverture, état vide unifié, deux gardes d'absence complémentaires, inventaire FR-055 armé pour l'Epic 5, phrase AC6. Campagne de mutation 23/23. Suite complète verte après `db reset` 0001→0037. Statut → review. | Claude Opus 5 |
