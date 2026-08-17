# Revue de code — Epic 6 (stories 6.1 → 6.9)

Date : 2026-08-17 · Périmètre : `571a922..27d3882`, 93 fichiers, 7 427 insertions, migrations 0053 → 0060.

**Méthode.** Six angles de recherche indépendants, confiés à des agents **Sonnet 5** — modèle différent
de l'Opus 5 qui a écrit le code, pour que ce ne soit pas une revue par l'auteur. Chaque trouvaille a
été **revérifiée à la main dans le code** avant d'entrer ici ; celles qui n'ont pas tenu ont été
écartées et ne figurent pas. Une trouvaille (R1) a été obtenue en suivant une piste d'agent **plus
loin que l'agent ne l'avait suivie**, et c'est la plus grave du lot.

Statut des onze stories au moment de la revue : `review`, aucune revue au dossier. C'est ce qui la
motivait : l'Epic 6 est celui qui **efface les données des gens** et décide des durées de conservation.

---

## 🔴 R1 — Corriger un souvenir le retire de la mémoire d'Anam

**Vivant aujourd'hui.** Stories 4.2/4.3 (sémantique) × 6.5 (écran). Art. 16 RGPD.

Deux fonctions de lecture, écrites à deux epics d'écart, ne s'accordent pas sur ce que veut dire
« corrigé » :

| Fonction | Filtre | Un fait `corrige` |
|---|---|---|
| `charger_faits_actifs` (0019:92) — ce qu'Anam **se rappelle** | `statut = 'actif'` | **exclu** |
| `charger_faits_retenus` (0056:96) — ce que l'écran **affiche** | `statut <> 'supprime'` | **affiché** |

Le parcours : elle ouvre « Ce qu'Anam retient », lit *« Voici ce qu'Anam a retenu de vos échanges »*,
trouve une phrase fausse, la corrige. L'écran lui montre sa correction. **Anam ne la verra jamais**, et
perd au passage le fait d'origine.

Corriger n'est donc pas corriger : c'est **supprimer en silence**, sous un écran qui affirme le
contraire. C'est le seul défaut de cette revue qui contredit une promesse écrite à l'écran, et il tombe
exactement sur le droit de rectification.

**L'origine de la collision.** La 4.3 écrit dans son commentaire « `statut='actif'` → un tombstone
n'entre jamais dans un rappel », en traitant tout ce qui n'est pas `actif` comme une pierre tombale. La
6.5 a ensuite décidé que `corrige` est un fait **vivant** : `estAffichable("corrige")` rend `true`, et
0056 réserve le contenu vide au seul `supprime`. Personne n'a rapproché les deux lectures.

**Correctif proposé** — que le chemin de correction produise un fait `actif` d'origine `utilisatrice`.
Cela demande de rouvrir la règle de la 4.2 « le chemin utilisatrice ne pose jamais `actif` », posée
contre la *ré-activation forgée* et non contre la correction. **C'est une story, pas un correctif.**

---

## 🔴 R2 — La minorité détectée est GRACIÉE au lieu d'être effacée

**Dormant.** Story 6.8 × 1.9. FR-071.

`trancher_echeance_suppression` (0059:223-236) lit **`mineur_detecte`** pour décider que « la minorité
ne se gracie pas, et aucun abonnement ne la protège ». Or les deux drapeaux de minorité sont distincts,
et c'est écrit noir sur blanc en 0042 :

- `mineur_detecte` — minorité **déclarée** au seuil d'âge (FR-070, story 1.4). Posé par
  `app/(auth)/naissance/actions.ts`, qui **ne pose aucune échéance**.
- `barriere_minorite_le` — minorité **détectée** après coup (FR-071, story 1.9). Posé par
  `appliquer_barriere_minorite` (0006:101-103) **avec** l'échéance — et cette fonction n'écrit
  **jamais** `mineur_detecte`.

Conséquence : la seule population qui obtienne une `echeance_suppression` par le chemin de la minorité
est celle pour laquelle `v_mineure` vaut **`false`**. La branche FR-071 est **inatteignable pour les
personnes qu'elle protège**.

Elles tombent alors dans la grâce ordinaire — et la passent : la barrière ayant été posée récemment,
`derniere_activite` est récente, donc `echeance_suppression` est **remise à `null`**. Pire, elle ne peut
plus être reposée : `appliquer_barriere_minorite` exige `barriere_minorite_le is null`, désormais faux.

> **Le compte d'une mineure détectée est suspendu à vie et jamais effacé** — l'exact inverse de FR-071.

**Pourquoi c'est dormant, et pourquoi c'est grave quand même.** Le seul appelant en production de
`appliquerBarriereMinorite` est `entreeDemoSuspendue` (`app/(auth)/entrer/actions.ts:164`), neutralisée
hors `development`. Le vrai classifieur reste à brancher. Le défaut **se réveillera le jour où il le
sera** — c'est-à-dire le jour où plus personne ne relira 0059.

**Le test masque le défaut au lieu de le révéler.** `tests/retention-sql.test.ts:105-109` écrit
`mineur_detecte: true` sous le commentaire « comme le pose `appliquer_barriere_minorite` ». Ce n'est pas
ce que cette fonction fait. La fixture fabrique un état que la production ne produit jamais.

**Correctif proposé** — que `trancher_echeance_suppression` teste `mineur_detecte OR
barriere_minorite_le is not null`, et que la fixture du test passe par la vraie RPC plutôt que par un
`update` direct. Le dépôt a **déjà appris cette leçon** en 0042, sur `est_barre_minorite()`, où les 14
policies ne couvraient qu'une des deux barrières.

---

## 🔴 R3 — Une poussée à 2 h du matin, qui attend son heure

**Dormant.** Story 6.2/6.3. AD-17.

Le sélecteur de `/reglages` propose 00 h à 23 h (`Reglages.tsx:229`), la contrainte SQL accepte `0..23`
(0053:144), et **`creneauDiurneOuvert` n'est appelé que par `synthese.ts` et `rappel-echeance.ts`** —
vérifié : `lib/ordonnanceur/jobs/socle-quotidien.ts` ne le référence nulle part.

Inerte aujourd'hui (palier `hobby`, le job refuse d'émettre). **Le jour du passage en `pro`** — porte
pré-lancement déjà inscrite — les 24 heures deviennent honorables, et qui a choisi 02 h reçoit « Anam »
sur son écran verrouillé à 2 h du matin.

La 6.3 a bien posé le créneau diurne « avant toute réservation dans `notifier()` ». Le socle ne passe
pas par `notifier()`.

**Correctif proposé** — borner à 6–21 dans la contrainte SQL (qui lie aussi `service_role`), pas
seulement dans le `<select>`.

---

## 🟠 R4 — Le compteur de ses épisodes de détresse, dans le document qu'on lui tend

**Vivant.** Story 6.6. FR-031.

`export-lisible.ts:190` et `:259` affichent un compte par section dans le fichier d'export :

> Les moments où le produit s'est inquiété **(12)**

et sous chaque section : `12 éléments · episode_detresse`.

La ligne du PRD dit « aucun score, aucune note, aucune jauge, aucune série » — pas littéralement
« aucun compteur ». **Mais ce dépôt a tranché quatre fois dans l'autre sens** :
`arbitrage-frontiere`, `bibliotheque-frontiere`, `ancrage-frontiere` et `arbre-rendu` portent tous une
garde « le compte ne traverse pas la frontière », dont une qui dit « aucun compte de branches ouvertes
n'est jamais affiché ».

L'export a échappé au patron parce que le compte n'y est pas un champ typé mais un `rows.length`
calculé au rendu — invisible aux détecteurs, qui scrutent des chaînes statiques.

Le seul endroit du produit où un nombre lui est montré est le décompte de ses propres effondrements.

---

## 🟠 R5 — La garde `[LE CŒUR]` de l'effacement lit du SQL mort

`tests/effacement-schema.test.ts:30` épingle `SQL_0058`. Or la 6.8 a **remplacé**
`effacer_toutes_mes_donnees` : le moteur réel vit dans `effacer_utilisatrice` (0059:73-112), et 0058
n'est plus qu'une enveloppe de trois lignes.

Toutes les assertions « LE CŒUR » — l'ordre trace-avant-suppression, le retrait des branches en
premier, le refus d'identité nulle, l'absence de durée figée — valident un corps que la base
n'exécute plus.

**La propriété tient encore** (vérifié : l'ordre est correct dans 0059). C'est la **garde** qui est
morte. Et le test comportemental ne compense pas : 0058:33-37 explique lui-même qu'une observation
post-commit ne peut pas distinguer un ordre insert-puis-delete d'un ordre delete-puis-insert.

⚠️ Le même piège dort sur `tests/export-inventaire.test.ts`, épinglé sur `0057`. Il n'a pas encore
mordu parce que personne n'a redéfini `exporter_mes_donnees` — ce qui vient d'arriver à sa jumelle.

---

## 🟠 R6 — Sept gardes satisfaites par une ligne d'import ou un commentaire

C'est **une famille, pas sept accidents** — et c'est le patron que l'artefact 6.9 avait lui-même nommé
(« mes gardes vérifiaient qu'un nom APPARAÎT, pas qu'il SERT »), reproduit d'un cran plus loin.

| Test | Le mutant qui survit | Ce que ça coûte |
|---|---|---|
| `export-route.test.ts:152` | retirer `...ENTETES_ART9` de la réponse en gardant l'import | un export art. 9 devient cachable par un intermédiaire |
| `export-route.test.ts:30-37` | remplacer `chargerExport(supabase)` par un objet vide | l'art. 15 sert un fichier quasi vide, aucun test ne rougit |
| `garde-commerciale.test.ts:289` | supprimer `{formaterPrixAnnuel()}` du paywall | une page qui demande de l'argent sans dire combien |
| `pied-halte.test.ts:126` | **commenter** la ligne `mentionIA={piedPour("memoire").mentionIA}` | la mention IA (AI Act art. 50) disparaît d'une halte |
| `effacement-ecran.test.ts:60` | garder le formulaire derrière `?confirmer=2` (état serveur, pas `useState`) | réintroduit le « es-tu sûre ? » à étages interdit par l'AC3 |
| `rendu/carte-anam.test.tsx:49` | allumer une classe sur un `<p>` enfant selon `carte.ligne` | la pastille-sans-le-mot que le composant dit interdire |
| `pied-halte.test.ts:189` | ajouter un `<a>` brut à côté des deux `<Link>` | le pied de secours redevient un footer ordinaire |

`pied-halte.test.ts` n'utilise **pas** `sansCommentaires`, alors que `tests/_absence.ts` existe
précisément pour ça — et que ce test-là s'était déjà fait survivre un mutant, documenté dix lignes plus
haut dans le même fichier.

---

## 🟡 Sept points moyens, vérifiés

| # | Où | Le défaut |
|---|---|---|
| R7 | `app/` entier | **Aucun moyen d'arrêter les courriels depuis l'application.** Aucun fichier de `app/` ne lit `preference_courriel`, aucun lien vers `/desabonnement`. Le seul chemin est le jeton d'un courriel déjà reçu. Qui clique « Ne plus rien recevoir » dans un écran nommé *Réglages* continue de recevoir rappels et synthèses. |
| R8 | `app/reglages/actions.ts:71` | `desabonnerAppareil` est la seule des trois actions **sans `getUser()`**. Sur session expirée le `DELETE` touche zéro ligne sans erreur et renvoie `ok` ; `Reglages.tsx:180` **ne teste pas ce statut**, contrairement à `activer()`. L'écran dit « désabonnée », la base garde la ligne. |
| R9 | `app/(auth)/consentement/page.tsx:60` | « gardé chiffré » — aucune migration ne chiffre (`pgcrypto`/`pgsodium` absents des 60 fichiers). Ce que la phrase désigne est le chiffrement disque de l'hébergeur. Pas un mensonge, mais ambigu au pire moment. Déjà inscrit en M-2 de la revue de sécurité, jamais fermé. |
| R10 | `0059:183` | `poser_echeance_suppression` calcule l'échéance **sans** `at time zone 'Europe/Paris'`, alors que les deux fonctions qui la consomment (0059:229, 0059:269) comparent en heure de Paris. Inerte avec le cron actuel (06 h UTC) ; mordrait si l'horaire changeait. |
| R11 | `0059:94` + `app/mes-donnees/actions.ts` | Le formulaire d'effacement est du HTML pur, **sans désactivation du bouton** (choix assumé), et `effacer_utilisatrice` n'a **aucune garde d'idempotence**. Un double-tap produit **deux lignes d'audit** pour un seul geste — la trace censée prouver qu'un droit a été honoré ment par duplication. |
| R12 | `0018:62` | `fait_extrait` : la règle « le chemin utilisatrice ne pose que `corrige`/`supprime` » ne vit **que dans la RPC**. Un `PATCH` PostgREST direct forge `origine='utilisatrice', statut='actif'`. Ses propres données, aucune fuite — mais c'est la doctrine cardinale. **Si R1 est corrigé, cet état cesse d'être illégitime.** |
| R13 | `0055:115` | `pause_rythme` : `seances`/`minutes` sont fournis par le client sans recalcul serveur. Assumé et écrit dans le fichier. Conséquence unique : ces colonnes ne prouvent rien et ne doivent pas servir de mesure produit. |

Deux points mineurs supplémentaires, notés sans être retenus comme défauts : `derniere_activite`
(0059:53) ignore les trois tables d'ennéagramme, où l'écriture est pourtant un geste explicite de la
personne — une utilisatrice qui n'utiliserait *que* l'ennéagramme serait comptée dormante ; et
`p_fenetre_pitr_jours` est contrôlable par l'appelante via PostgREST, ce qui fait de
`effacement.survivance_jusqu_au` une métadonnée auto-déclarée plutôt qu'une valeur dérivée de la
configuration serveur.

---

## Ce qui a résisté, et qui mérite d'être dit

L'audit systématique n'a **rien** trouvé sur les axes suivants, et ils avaient été cherchés :

- **Les huit migrations passent la revue RLS.** RLS activée et forcée sur les quatre tables créées,
  `WITH CHECK` symétriques aux `USING` sur toutes les policies d'écriture, `set search_path = ''` sur
  les vingt fonctions `security definer` du lot.
- **Le remplacement de trigger 0039 → 0060** (`naissance_ecrite_une_fois` → `naissance_corrigible`) ne
  perd aucune clause — vérifié champ par champ. C'était l'inquiétude la mieux fondée, elle est levée.
- **L'inventaire d'effacement est complet.** Les 36 tables `public` du schéma sont toutes soit en
  cascade vers `utilisatrice`, soit un système documenté sans donnée personnelle, soit `effacement`
  elle-même. Aucune table orpheline.
- **Aucune cascade ne traverse vers autrui** : le seul `on delete restrict` et le seul
  `on delete set null` sont des FK **composites** liant `utilisatrice_id`.
- **`DELETE` direct sur `utilisatrice` est fermé** — révoqué au niveau table en 0041:78, jamais
  regranté. La piste a été explicitement testée et écartée.
- **L'isolation de l'export est doublement gardée**, statiquement (29 sous-requêtes filtrées par
  `= v_uid`) et en vivant (deux comptes semés, marqueur croisé sur le document entier). AD-12 respecté :
  jamais `service_role`.
- **L'export suit les colonnes** : `to_jsonb(t)` sur la ligne entière, donc une colonne ajoutée demain
  sort sans liste figée à maintenir.
- **L'ordonnanceur** : jeton `reclamer_execution`/`clore_execution`, verrou consultatif, chaîne de
  budgets `Σ + marge ≤ BUDGET_TICK_MS ≤ PLAFOND_DUREE_MS` — aucun défaut de concurrence trouvé.
- **Le nettoyage des abonnements morts** (404/410 → `oublier_endpoint_poussee`, jamais sur `refuse`) et
  **la clé VAPID privée** (jamais lue côté client, jamais `NEXT_PUBLIC_`) sont corrects.
- **L'ensemble fermé des motifs** (CHECK + `famille_motif` + RLS deny-by-default, un seul chemin
  d'écriture) tient.
- **La mécanique tombstone / anti-résurrection** (contrainte bidirectionnelle de 0056) est éprouvée.
- **Aucun dark pattern de sortie** : le formulaire d'effacement est une case et un bouton.
- **Aucun plafond de correction** sur l'heure de naissance (art. 16), vérifié et testé.

---

## Ce que la revue dit de la méthode

Trois observations qui valent au-delà de cet epic.

**1. Les deux défauts les plus graves sont DORMANTS.** R2 et R3 ne se manifestent pas aujourd'hui : le
classifieur de minorité n'est pas branché, le palier n'honore aucune heure. Ils se réveilleront à
l'occasion d'un changement d'infrastructure — c'est-à-dire au moment où personne ne relira ce code. Une
fonctionnalité désactivée ne peut pas être testée, et c'est exactement pour ça qu'elle doit être relue.

**2. Deux fois sur trois, le défaut naît d'une story qui en déplace une autre.** R1 (la 6.5 redéfinit
ce que la 4.3 filtrait), R5 (la 6.8 déplace ce que la 6.7 gardait), R2 (la 6.8 lit un drapeau que la
1.9 n'écrit pas). Le code de chaque story est correct **isolément**. Le défaut vit dans l'intervalle.

**3. La discipline de mutation est réelle mais s'arrête à la frontière de la story.** Les campagnes des
commits `27d3882` et suivants ont tué 32 puis 31 mutants, et les commentaires du corpus documentent
honnêtement des mutants déjà tués. Les sept gardes de R6 sont les endroits où cette discipline n'a pas
été poussée jusqu'au bout — souvent **à côté du commentaire qui décrit le piège pour le cas voisin**.

---

## Suites proposées

| | Nature | Décision |
|---|---|---|
| **R3** | correctif court (borne SQL 6–21 + sélecteur) | prêt à poser |
| **R2** | correctif court (`OR barriere_minorite_le is not null`) + fixture de test à rebrancher sur la vraie RPC | prêt à poser |
| **R5, R6** | retourner les gardes vers la définition courante ; `sansCommentaires` là où il manque ; mesurer l'usage et non l'apparition | prêt à poser |
| **R4** | ✅ **POSÉ** le 2026-08-17, avec la garde qui mesure la SORTIE | fait |
| **R8, R10, R11** | correctifs courts | prêts à poser |
| **R1** | **une story** : rouvrir la règle 4.2 pour que la correction produise un fait `actif` | en cours |
| **R7** | ✅ **POSÉ** le 2026-08-17 — migration 0062 | fait |
| **R9** | ✅ **REFORMULÉ** le 2026-08-17 ; le texte final reste à valider avec un juriste | fait |

---

## Ce qui a été corrigé — migration 0061, le 2026-08-17

**Six correctifs posés : R2, R3, R5, R6, R8, R10, R11.** R1, R4, R7 et R9 restent ouverts : ce sont des
décisions produit, pas des correctifs.

### R3 a changé d'endroit en cours de route, et c'est la décision la plus intéressante

J'ai d'abord écrit `check (heure between 6 and 20)` sur `preference_socle.heure` — la garde en base,
selon la doctrine du dépôt. **Douze tests sont devenus rouges d'un coup.**

`socle_quotidien_du` sélectionne les personnes dont l'heure choisie égale l'heure courante à Paris,
calculée EN BASE (0053, « leçon de 0046 »). Borner la colonne bornait donc l'émission — élégant — mais
les tests qui construisent une personne « due maintenant » exigent que l'heure courante soit
choisissable. **La suite se serait mise à échouer tous les soirs après 21 h.** Une suite en laquelle on
ne peut pas croire le soir ne prouve rien le matin non plus.

La garde est donc allée là où ses deux jumelles vivent déjà : dans le JOB
(`creneauDiurneOuvert(ctx.instant)`, comme `synthese.ts` et `rappel-echeance.ts`). La doctrine « la
garde vit dans la base » protège contre un CLIENT authentifié qui écrit en direct — or **un client ne
peut pas se faire pousser une notification**. Il n'y a ici aucun adversaire à contenir : celui qui émet
est notre propre ordonnanceur.

Le sélecteur et `heureValide` sont bornés à 6–20, et 0061 ramène à 8 h les préférences déjà écrites
hors créneau — sans quoi leur `<select>` s'afficherait vide.

### Ce que les correctifs ont eux-mêmes trouvé

- **Une huitième garde de la famille R6**, découverte en appliquant le dépouillement des commentaires :
  `[ANTI-VACUITÉ] /barriere garde son propre lien vers l'aide` **disait une chose fausse**. Ce lien
  n'existe pas — les deux seules occurrences de `/aide` dans ce fichier sont des commentaires. Ce qui
  protège réellement quelqu'un est plus fort qu'un lien : les numéros d'urgence en clair, chacun en
  `tel:`, joignables d'un appui. La garde mesure désormais ça.
- **Un dépouilleur de commentaires inadapté** : `_sql-courant.ts` réutilisait d'abord `sansCommentaires`
  de `_absence.ts`, qui connaît `//` et `/* */` — du TypeScript, pas `--`. Une garde d'export a rougi
  immédiatement en comptant `to_jsonb(t) - 'colonne'` écrit dans une phrase d'explication.
- **Deux gardes resserrées trop loin**, corrigées après un test rouge : bannir `searchParams` de
  `/mes-donnees` cassait le message d'erreur légitime, et comparer les empreintes de `CarteAnam` par
  ÉGALITÉ ignorait que la carte avec motif rend un `<p>` de plus, licitement. Les deux sont devenues
  des inventaires plutôt que des interdits.

### Campagne de mutation — 12 mutants, 12 tués

| | Mutant | Verdict |
|---|---|---|
| M1 | garde diurne retirée du job | TUÉ |
| M2 | borne haute élargie (`h <= 21`) | TUÉ |
| M3 | `retirer()` réignore le statut du serveur | TUÉ |
| M4 | `heuresHonorables` reprend les 24 heures | TUÉ |
| M5 | `...ENTETES_ART9` retiré de la réponse d'export | TUÉ |
| M6 | mention IA **commentée** plutôt que supprimée | TUÉ |
| M7 | prix retiré de la surface de vente | TUÉ |
| M8 | pastille allumée sur un élément **enfant** | TUÉ |
| M9 | troisième lien en `<a>` brut dans le pied | TUÉ |
| M10 | la minorité DÉTECTÉE redevient invisible | TUÉ |
| M11 | garde d'idempotence de l'effacement retirée | TUÉ |
| M12 | échéance reposée en UTC | TUÉ — **au second essai** |

⚠️ **M12 a d'abord été annoncé TUÉ, et c'était faux.** En cherchant QUELLE assertion l'avait tué, la
réponse était une panne de préparation (`createUser: {}`, pile Supabase saturée) — pas un test. Le
test de pose existant tolère 80 à 95 jours, bien trop large pour voir un jour d'écart : **rien
n'exerçait le fuseau.** Une garde a donc été écrite, et elle ne garde pas la ligne corrigée mais la
RÈGLE — dans les quatre fonctions de rétention, tout jour civil dérivé de `now()` passe par Paris.

> **Un mutant tué pour la mauvaise raison est un mutant vivant.** Sans cette vérification, il serait
> inscrit « mort » dans ce tableau, et R10 serait non gardé sous une ligne verte.

### Vérification

- **269 fichiers / 4589 tests** verts ; `tsc --noEmit`, `eslint .`, `next build` propres
- Migration 0061 appliquée en local (`db reset` complet, 0001 → 0061)
- ⚠️ **0061 n'est PAS encore déployée en cloud** — à faire par l'API de gestion, comme les précédentes


---

## Second passage — R4, R7, R9 posés le 2026-08-17

**R4** — les deux comptes ont quitté l'export. La garde qui les remplace mesure la **sortie** et non la
source : deux documents de tailles différentes doivent rendre le même habillage. C'est ce qui rattrape
un compte calculé au rendu, que les détecteurs FR-031 — qui lisent des chaînes statiques — ne peuvent
pas voir. Le nom technique de la table reste : il sert à recouper avec l'annexe JSON (art. 20).

**R7** — migration 0062, `regler_mes_courriels(boolean)`. Une **fonction** et non une policy
d'écriture : sous un `update` ouvert, `jeton` serait à sa portée, et elle pourrait se donner celui
d'une autre. Un test le vérifie. La surface est un formulaire nu, sans îlot client.

> Trois tests prouvent que ce geste n'est gardé par **rien** — consentement art. 9 révoqué, barrière de
> minorité posée, épisode de détresse **en cours**. Même décision qu'en 3.5 : `limites_levees` est vrai
> pendant un épisode, et garder ce geste enfermerait dans nos courriels la personne la plus vulnérable
> du produit.

**R9** — « et gardé chiffré » a quitté l'écran de consentement. Ce qui le remplace dit la partie
inconfortable. **À valider avec le juriste, avec les CGU.**

### Vérification du second passage

- **270 fichiers / 4613 tests** verts ; `tsc`, `eslint`, `next build` propres
- **0061 et 0062 déployées en cloud** le 2026-08-17, et les corps vérifiés un par un : `trancher`
  lit bien `barriere_minorite_le`, `effacer_utilisatrice` porte bien son `for update`,
  `poser_echeance_suppression` calcule bien en `Europe/Paris`, et aucune préférence hors créneau ne
  subsiste en base.

### ✅ Ce que le navigateur a tranché, et qu'aucun test ne pouvait trancher

Protocole en huit gestes exécuté par Julian le 2026-08-17 (Chrome, production). **Tout passe.**

Ferme définitivement deux items ouverts de longue date :

- **QA T11** — les quatre états de permission se disent correctement ; la révocation faite depuis le
  navigateur est détectée au rechargement ; le bouton **repropose** de s'abonner. Le piège d'origine —
  devoir *demander à ne rien recevoir* pour pouvoir se réabonner — ne se reproduit pas.
- **QA T26** — dans une fenêtre de ~742 px, au moment de la détresse, le bloc de ressources est
  **visible sans avoir à défiler**. jsdom n'ayant pas de moteur de mise en page, c'était la seule
  façon de statuer.

Vérifiés au passage : R3 (le sélecteur ne propose plus que 06 h – 20 h), R7 (la section « Les
courriels d'Anam » existe et bascule dans les deux sens), R8 (le désabonnement dit vrai). Console
propre — aucun compteur n'a fui par cette porte (FR-031).
