---
baseline_commit: e16035f12affe2c09805664e37be6c66d2dcc160
---

# Story 4.10 : Les plans d'étapes et l'arbitrage d'ouverture — faire vivre une branche avant d'en ouvrir une autre

Status: review

Epic 4 · Dépend de : 4.5 (naissance d'une branche), 4.6 (fiche de branche), 4.7 (cycle de vie), 4.8 (ordonnanceur unique), 4.9 (port courriel, `notification_envoyee`, désabonnement), 3.1 (abonnement premium), 2.4 (épisode de détresse).
**Dernière story de l'Epic 4.**

---

## Story

En tant qu'utilisatrice, je veux transformer une branche en petites intentions concrètes rattachées à elle, et qu'Anam m'invite à en faire vivre une avant d'en ouvrir trop, afin d'intégrer vraiment plutôt que d'accumuler des prises de conscience.

**Couvre :** FR-032 (intentions d'implémentation rattachées à une branche), FR-030 (faire vivre une branche avant d'en ouvrir une autre), FR-031 (aucun compte affiché), FR-081 (volet *plans d'étapes*), FR-034 (Anam ne se manifeste que si elle a quelque chose de spécifique à dire), FR-035 (discrétion des notifications) ; AD-8, AD-14 (rythme possédé par l'ordonnanceur), AD-17 (la détresse n'ouvre rien), AD-7 (rendu muet), AD-1 (domaine pur).

---

## Acceptance Criteria

1. **[AC1 — l'intention]** Étant donné une branche, quand un plan d'étapes est créé, alors chaque étape est formulée en **intention d'implémentation** (« si X, alors Y »), **et** elle est **rattachée** à cette branche — jamais une étape flottante.
2. **[AC2 — révisable]** Étant donné un plan d'étapes, quand l'utilisatrice le revoit, alors il est **révisable** — les intentions peuvent être ajoutées, modifiées ou retirées : c'est une suite vivante, pas figée.
3. **[AC3 — l'échéance]** Étant donné une intention avec une échéance **qu'elle a elle-même fixée**, quand l'échéance arrive, alors le rappel notifié porte sur **son objectif à elle** (motif fermé d'Anam), **et** jamais un rappel de connexion.
4. **[AC4 — FR-030, l'arbitrage]** Étant donné plusieurs branches ouvertes sans intégration (encore en `naissance`), quand un nouveau moment se présente, alors Anam **propose d'en faire vivre une avant d'en ouvrir une autre**, en conversation, **et** jamais en bandeau.
5. **[AC5 — DUR / FR-031]** Étant donné cet arbitrage, quand Anam propose, alors elle n'affiche **jamais** le compte de branches ouvertes (« 3 branches en cours ») ni aucun chiffre.
6. **[AC6 — le registre premium]** Étant donné le registre premium, quand un compte gratuit interagit, alors les plans d'étapes sont une **fonction premium**, **et** l'invitation à faire vivre une branche reste une **parole d'Anam en conversation**.

---

## Décisions du PO — **TRANCHÉES le 2026-08-06 (Julian)**

Les cinq décisions ci-dessous sont **actées** : le PO a retenu la recommandation dans chacun des cinq cas. Elles ne sont plus des questions ; elles sont le contrat d'implémentation. Le raisonnement est conservé parce qu'il porte les raisons — un futur relecteur doit pouvoir savoir *pourquoi* et pas seulement *quoi*.

**En une ligne chacune :** **D1 = A** (elle écrit, deux champs `si`/`alors`, forme garantie par le schéma) · **D2** = compter les branches encore en `naissance`, seuil ≥ 3, `PLACEHOLDER PRODUIT`, jamais affiché · **D3** = invitation au plus une fois par 7 jours, réarmée uniquement par un mouvement réel · **D4** = plafond rétabli **par famille** (`anam` | `socle`) **et** notification retentable indépendamment de la production · **D5** = **rééquilibrer** les `delaiMs` du registre (synthèse ~30 s, rappel ~8 s), ne jamais monter la marge de la garde `[T3-3]`.

### D1 — Qui écrit l'intention : elle, ou Anam ? → **A (acté)**

FR-032 dit « chaque étape **proposée** est formulée en intention d'implémentation ». Le mot « proposée » autorise deux lectures, et elles ne coûtent pas le même prix.

| | **A — elle écrit, la forme est structurelle** *(recommandé)* | **B — Anam propose des étapes candidates** |
|---|---|---|
| Mécanisme | deux champs, `si …` / `alors …`, tous deux non vides (CHECK SQL) | un appel au modèle fort sur le matériau de la branche |
| Coût | zéro appel modèle, zéro egress | un appel fort par plan, art. 9 sortant |
| Surface de sécurité | **aucune** — rien n'est généré | une intention d'implémentation **est une prescription comportementale** : « si tu te sens mal, alors … » tombe pile dans ce que le PRD interdit (aucun conseil de démarche, aucun verdict) |
| Cohérence produit | identique au nommage de branche : **champ vide, aucune suggestion, aucun exemple** | Anam décrète ce qu'elle devrait faire |

**ACTÉ : A.** La forme « si X, alors Y » est garantie par la *forme des données* (deux colonnes), pas par un prompt — la même stratégie que `assemblerRappel` (la non-invention est structurelle) et que `phraseProposition` (déterministe, jamais un LLM). Anam garde son rôle : l'**invitation** (« Tu veux en tirer quelque chose de concret ? »), jamais le contenu.

> Conséquence directe : **aucun appel modèle n'est ajouté par cette story**, donc aucune consigne, aucune passe de contrôle de voix, aucun egress art. 9 nouveau. Si B revenait un jour sur la table, ce serait une story à part entière.

### D2 — Le seuil de l'arbitrage FR-030 → **acté**

Le PRD (`prd.md:278`) écrit : « **Plus de 3 branches par mois** → accumulation sans intégration ». L'epic écrit : « plusieurs branches ouvertes sans intégration (encore en `naissance`) ». Ce n'est pas la même mesure.

**ACTÉ :** compter les branches **encore en `naissance`** (jamais feuillées, jamais déclarées) — c'est la définition littérale de « ouverte sans intégration », et elle ne dépend pas d'une fenêtre glissante. Seuil **≥ 3**, marqué `PLACEHOLDER PRODUIT` au même titre que `PAS_FEUILLAISON`, **jamais affiché** (AC5).

### D3 — À quelle fréquence Anam peut-elle redire l'invitation ? → **acté**

C'est le piège de FR-034. Si l'arbitrage se déclenche à chaque ouverture tant que le seuil est franchi, l'invitation devient exactement le **« message générique récurrent »** que le PRD interdit — et la plus agaçante des deux, puisqu'elle se répète *parce qu'elle n'a pas obéi*.

**ACTÉ :** l'invitation est dite **au plus une fois par période de 7 jours**, persistée comme un fait (`invitation_integration_dite_le`), et **réarmée seulement par un mouvement réel** (une branche qui feuille ou qui rayonne). Dit autrement : Anam le dit, puis elle se tait.

### D4 — Le plafond « une notification / 72 h » : par motif, ou par famille ? → **par FAMILLE (acté)**

Aujourd'hui `reserver_notification` compte le plafond **par motif** (`and n.motif = p_motif`, migration 0030). Avec un seul motif, per-motif et tous-motifs sont indistinguables. **Cette story ajoute le deuxième motif d'Anam** — et l'écart devient visible : deux courriels d'Anam en 72 h.

Or `EXPERIENCE.md:469-475` est explicite : les motifs d'Anam forment un **ensemble fermé de trois**, et « Plafond : **une notification d'Anam par 72 heures** ». Le plafond porte sur *Anam*, pas sur un motif. (Le socle FR-033, lui, n'est **jamais signé d'Anam** — c'est une autre famille, avec son propre rythme quotidien.)

Le passage au per-motif en 0030 avait une raison écrite et valable : avec un plafond tous-motifs, le courriel d'une période de synthèse était **définitivement perdu** quand deux périodes tombaient à moins de 72 h — parce que la production de la synthèse et la réservation du canal partagent la même réclamation `(job, semaine, utilisatrice)` : la semaine étant `deja_fait`, le courriel n'était jamais retenté.

**ACTÉ :** rétablir le plafond **par famille** (`anam` | `socle`), **et** rendre la notification retentable indépendamment de la production — la réservation du canal cesse d'être adossée à la réclamation de la synthèse. C'est le vrai correctif ; le per-motif en était le contournement.

> `EXPERIENCE.md` n'est donc **pas** modifié : c'est la base qui revient à ce que le document promet. Le dev doit vérifier que le régression-test qui a motivé 0030 (deux périodes à moins de 72 h → le courriel de la seconde n'est pas perdu) **reste vert** après le passage par famille : c'est lui qui prouve que le découplage production/notification fait bien le travail que le per-motif faisait.

### D5 — Le budget de temps de l'ordonnanceur est **plein** → **rééquilibrage (acté)**

Σ `delaiMs` du registre = 12 000 (santé) + 38 000 (synthèse) = **50 000 ms**. La garde `[T3-3]` exige `Σ + marge(8 000) ≤ maxDuration(60 000)`. Il reste **2 secondes**.

Un troisième job ne rentre pas. Trois issues étaient ouvertes :

1. **Rééquilibrer** : ramener la synthèse à ~30 s et donner ~8 s au rappel d'échéance (le rappel ne fait aucun appel modèle — il lit des échéances et réserve un canal ; 8 s suffisent largement).
2. **Monter `maxDuration`** au-delà de 60 s — dépend du palier Vercel, c'est une **porte OPS**.
3. **Loger le rappel dans le job de synthèse** — rejeté : ça casse AD-14 (« un job, un effet ») et rend le rappel dépendant de la réussite de la synthèse.

**ACTÉ : 1 (rééquilibrer).** Elle ne demande rien à personne et se vérifie par la garde existante. **La marge de `[T3-3]` (8 000 ms) ne bouge pas** — c'est elle qui rend le budget vérifiable ; l'élargir pour faire entrer un job reviendrait à supprimer la garde en prétendant la respecter.

---

## Dev Notes

### Le cœur en une phrase

Deux choses sans rapport apparent, unies par la même règle : **le produit ne montre jamais un compte, et n'écrit jamais à sa place.** Le plan d'étapes est de sa main ; l'arbitrage est un choix serveur dont seul un booléen traverse la frontière.

### Le point d'articulation de FR-030 : il existe déjà, et il est unique

`lib/safety/ouverture-branche.ts` est **le seul endroit du produit où l'on décide d'ouvrir une branche**. `chargerPropositionOuverture()` est appelée par `app/page.tsx` au franchissement du seuil et renvoie `{ signalId, phrase } | null`.

L'arbitrage ne s'ajoute donc pas à côté : il **se substitue** à ce point. Le type de retour devient une union discriminée :

```ts
type Ouverture =
  | { readonly type: "proposition"; readonly signalId: string; readonly phrase: string }
  | { readonly type: "invitation"; readonly phrase: string };   // aucun identifiant, aucun compte
```

**C'est ce qui rend AC5 vrai par construction et non par discipline.** Le compte est calculé serveur, sert à choisir une branche du `if`, et **n'existe dans aucun champ traversant la frontière**. Le rendu ne peut pas afficher un chiffre qu'il n'a pas reçu — même patron exact que la projection muette de la 4.6 et que la trame `beat` de la 2.7 (« la trame ne porte QUE l'identifiant »).

Une garde de test doit le prouver : **aucun nombre ne figure dans le type `Ouverture` ni dans les props du composant d'invitation.**

### Les deux pièges de l'arbitrage, tous deux silencieux

1. **Le signal ne doit PAS être consommé.** Si Anam dit l'invitation au lieu de proposer, le `signal_reconceptualisation` reste **en attente** : ce moment-là est réel, il n'a pas à disparaître parce qu'elle en avait déjà trois autres. L'écarter serait perdre définitivement une prise de conscience, sans trace et sans recours. → l'arbitrage lit, il n'écrit rien sur le signal.
2. **Le lendemain, la même chose se reproduit.** Le signal étant toujours là et le seuil toujours franchi, l'invitation repart — chaque jour. Voir D3 : sans garde de fréquence, FR-030 fabrique la violation de FR-034.

### « Faire vivre une branche » : quel geste, exactement ?

L'invitation doit mener quelque part, sinon c'est un reproche. Les gestes qui existent déjà et qui *sont* l'intégration :

- **le plan d'étapes** (cette story) — rattaché à une branche précise ;
- **le retour sur le thème** (4.7) — qui feuille tout seul, sans rien à confirmer ;
- **la déclaration de pleine lumière** (4.7) — « C'est devenu vrai en moi ».

L'invitation d'Anam pointe donc vers **une** branche en `naissance` (la plus ancienne — déterministe, ordre total par `date_naissance` puis `id`), pas vers une liste. Une liste redeviendrait un compte.

### Le rappel d'échéance : ce que Resend ne doit toujours pas voir

Le port courriel (4.9) prend un **motif** dans un ensemble fermé, **jamais un corps**. Cette story ajoute `"echeance_intention"` à `MotifCourriel` **et** au CHECK SQL de `notification_envoyee.motif`. C'est une valeur, pas un mécanisme — exactement ce que 0029 annonçait.

Le texte du gabarit **ne contient pas l'intention**. « Une échéance que tu as fixée arrive aujourd'hui » — pas le « si », pas le « alors », pas le nom de la branche. NFR-015 : l'objet paraît sur un écran verrouillé, potentiellement devant quelqu'un d'autre.

**« Jamais un rappel de connexion » est structurel, pas rédactionnel** : il n'existe aucun motif de reconnexion dans l'ensemble fermé, donc aucune place où en écrire un. C'est la même propriété que la signature de `PortCourriel`.

### AD-17 s'applique aussi ici

Un rappel d'échéance pendant un épisode de détresse (ou dans les 72 h) **ne part pas**. Rien de nouveau ne lui est poussé pendant un épisode — c'est la lecture constante d'AD-17 dans tout l'Epic 4. La garde vit **dans la requête SQL** qui sélectionne les échéances dues, jamais dans un filtre TypeScript (même raison qu'en 4.9, AC3 : un filtre applicatif s'oublie).

Conséquence assumée : une échéance passée pendant un épisode n'est **pas rattrapée** ensuite. Un rappel qui arrive avec trois jours de retard est un reproche daté. On le laisse tomber, en silence.

### Le premium se garde au point d'ÉCRITURE

FR-081 : les plans d'étapes sont premium. Comme pour tout le reste (AD-12, et la leçon RLS déjà apprise : **les gardes d'écriture vivent dans le `WITH CHECK`, jamais dans la RPC seule** — `authenticated` a le grant sur la table). Un gate d'UI seul est décoratif.

L'invitation FR-030, elle, **n'est pas gardée** : c'est une parole d'Anam, elle vaut pour tout le monde (AC6, littéralement).

⚠️ **Écart pré-existant, CONSIGNÉ et hors périmètre :** FR-088 dit « les branches sont premium », mais `creer_branche_depuis_signal` (0021) ne porte **aucune** garde premium — un compte gratuit peut aujourd'hui créer des branches, et il n'est pas non plus borné par le quota de conversation (`ALLOCATION_RESIDUELLE_TOURS` n'est posé nulle part → aucune coupure). Écrit dans `deferred-work.md` (section « FR-088 »), à trancher avant mise en ligne. **4.10 ne garde que ce qu'elle crée** (les plans d'étapes, FR-081) et ne touche pas à la policy de `branche`.

### Ce qu'on RÉUTILISE (ne pas réinventer)

| Besoin | Existant | Où |
|---|---|---|
| Le point d'ouverture unique | `chargerPropositionOuverture` | `lib/safety/ouverture-branche.ts` |
| Le rythme, l'idempotence, le bail | l'ordonnanceur | `lib/ordonnanceur/*` (4.8) |
| Le canal courriel, motif fermé | `PortCourriel`, `gabaritPour` | `lib/courriel/` (4.9) |
| Le plafond + le désabonnement | `reserver_notification`, `preference_courriel` | `0029`/`0030`/`0034` |
| Le rendu document | `BlocDocument` | `render/conversation/BlocDocument.tsx` |
| La fiche de branche et ses actions | `FicheBranche` + `copie-arbre.ts` | `render/arbre/` (4.6/4.7) |
| Le miroir de validation de saisie | `nomRecevable`, `rognerNom` | `render/nom-branche.ts` |
| Le refus métier ≠ la panne | `estRefusMetier`, `journaliserRefusGarde` | `lib/safety/rpc-repli.ts` |
| L'entitlement premium | `estPremiumCourante` | `lib/data/lire-abonnement.ts` |
| La cible tactile 44 px, gardée | `tests/cible-tactile.test.ts` | (posée au tri T6) |

### Ce que 4.10 ne fait PAS

- **Pas les ancrages** (le troisième volet de FR-081) — hors périmètre de l'Epic 4.
- **Pas le socle quotidien FR-033.** Il reste à l'Epic 5/6, et il appartient à l'**autre famille** de notifications (voir D4).
- **Pas de notification push ni de service worker.** Le courriel reste le canal.
- **Pas de plan d'étapes proposé par le modèle** (D1 acté = A). Aucun appel modèle n'est ajouté par cette story.
- **Pas de garde premium sur la création de branche** (FR-088) — écart pré-existant consigné, décision PO à part.
- **Pas d'écran de réglage des notifications.** Le désabonnement (4.9) reste le seul levier.

### Pièges connus, coûteux si redécouverts

1. **Le budget de l'ordonnanceur est plein à 2 s près** (D5). Le troisième job ne rentre pas sans rééquilibrage. La garde `[T3-3]` cassera le build — c'est voulu, ne pas la contourner en montant la marge.
2. **`now()` est figé au début de transaction.** Déjà mordu au T6-17 : une échéance écrite pendant le tick du job porte un horodatage antérieur au filigrane que ce job pose. Utiliser une borne, pas deux.
3. **Une échéance est une DATE CIVILE, pas un instant.** « Vendredi » à Paris n'est pas `2026-08-07T00:00:00Z`. Passer par `FUSEAU` / `dateCivileParis` (`lib/domain/ordonnanceur.ts`), jamais par un `Date` brut.
4. **Une UPDATE bloquée par la RLS ne lève AUCUNE erreur** — elle renvoie zéro ligne. Un test qui assère `error === null` sur une révision d'intention est un test qui ne prouve rien (leçon 4.9/T5).
5. **La révision (AC2) doit être une VRAIE suppression ou un tombstone ?** L'arbre ne régresse jamais (FR-029), mais une *intention* n'est pas une branche : elle est explicitement décrite comme « une suite vivante, pas figée ». Retirer une intention est donc une suppression franche — **et il faut le dire dans le code**, sinon quelqu'un appliquera AD-18 par réflexe et rendra le plan non révisable.
6. **L'ordre du plan doit être total et stable.** Sans départage explicite (`position` puis `id`), deux intentions créées dans la même transaction se réordonnent d'un chargement à l'autre. Même défaut que celui corrigé en 0033.

---

## Tasks / Subtasks

- [x] **T1 — La base.** Migration `0036` : table `intention` (rattachée à `branche` en cascade, `declencheur` + `action` non vides par CHECK, `echeance date` nullable, `position`, RLS propriétaire, **garde premium dans le `WITH CHECK`**) ; ajout du motif `echeance_intention` au CHECK de `notification_envoyee` ; RPC de sélection des échéances dues **avec la clause `episode_detresse`** ; correctif du plafond par famille (D4).
- [x] **T2 — Le domaine pur.** Forme de l'intention, ordre total du plan, éligibilité d'une échéance, seuil et fréquence de l'arbitrage (D2/D3). Zéro I/O (AD-1).
- [x] **T3 — Le dépôt.** Lecture/écriture/révision du plan sous JWT via RPC possédées — jamais `.from("intention")` direct, jamais `service_role`.
- [x] **T4 — L'arbitrage.** `chargerPropositionOuverture` devient une union discriminée ; le signal n'est **pas** consommé ; garde de fréquence persistée.
- [x] **T5 — Le job de rappel.** Entrée au registre, **après rééquilibrage des `delaiMs`** (D5) ; nouveau gabarit courriel sans contenu ; réservation avant envoi.
- [x] **T6 — Le rendu.** Entrée « Plan d'étapes » sur la fiche de branche ; le plan en bloc document ; les deux champs `si` / `alors` **vides, sans exemple** ; l'invitation d'Anam en conversation (jamais un bandeau) ; vue liste de rang égal ; cibles ≥ 44 px.
- [x] **T7 — Les gardes.** AC5 prouvé par le **type** (aucun nombre ne traverse la frontière) ; un seul appelant du canal courriel ; premium prouvé en base ; AD-17 prouvé en base ; ordre total du plan.
- [x] **T8 — Vérification.** Suite complète, `tsc`, `eslint`, `build`, `db reset` (`0001→0036`), puis **mutation-vérification de chaque garde neuve**.

---

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context) — `claude-opus-5[1m]`.

### Debug Log References

- **Validation finale :** 1923 tests / 151 fichiers verts, `tsc --noEmit` propre, `eslint` propre, `next build` compilé, `supabase db reset` rejouant `0001 → 0036` sans erreur.
- **Campagne de mutation : 63 mutants, 62 tués, 1 survivant documenté.** Détail plus bas.
- **Incident d'environnement, sans rapport avec le code :** le démon Docker s'est arrêté en cours de session, faisant échouer 43 tests d'un coup (`art9_temoin` introuvable, `/api/health` en `inconnu`). Redémarré, la suite est repassée intégralement verte. Après ~30 `db reset` consécutifs, le stack a commencé à répondre `502` au redémarrage des conteneurs — les deux derniers mutants SQL ont donc été appliqués **directement en base** (`create or replace` via `psql`) plutôt que par un cycle de migration complet. Même preuve, sans la fragilité.

### Completion Notes

**Ce qui a été livré, et la seule idée qui tient les deux moitiés ensemble :** *le produit ne montre jamais un compte, et il n'écrit jamais à sa place.*

**Le plan d'étapes (FR-032/FR-081).** La forme « si X, alors Y » est garantie par la **forme des données** — deux colonnes non vides —, jamais par un prompt. C'est la décision D1, et sa conséquence est nette : **aucun appel modèle n'est ajouté par cette story**, donc aucune consigne, aucun egress art. 9 nouveau, aucune surface de sécurité de plus.

**L'arbitrage d'ouverture (FR-030/FR-031).** `chargerOuverture` (ex-`chargerPropositionOuverture`) est devenu une **union discriminée**. Le compte de branches ouvertes est lu côté serveur, choisit une branche du `if`, et **n'existe dans aucun champ traversant la frontière** — AC5 [DUR] est vrai par construction, pas par discipline. Deux gardes le prouvent sous deux angles complémentaires : le **type** (`arbitrage-frontiere.test.ts`, qui refuse tout champ numérique dans les deux miroirs) et le **DOM** (`rendu/invitation-integration.test.tsx`, qui refuse tout chiffre à l'écran — y compris un chiffre dérivé de rien).

**Trois écarts d'implémentation par rapport aux Dev Notes, tous assumés :**

1. **L'invitation porte `brancheCibleId`**, là où les Dev Notes écrivaient « aucun identifiant, aucun compte ». Un identifiant n'est pas un compte, et sans lui l'invitation ne mène nulle part — or « une invitation qui ne mène nulle part est un reproche » est écrit dans ces mêmes notes. Le geste ouvre la fiche de **la** branche visée (jamais une liste : une liste redeviendrait un compte). Le type reste sans aucun champ numérique.
2. **Le rééquilibrage D5 prend le temps au job de SANTÉ, pas à la synthèse.** Les notes proposaient « synthèse ~30 s, rappel ~8 s » ; à 30 s la synthèse serait passée **sous** `RESERVE_PERSONNE_MS` (31 s) et n'aurait plus pu servir personne — une garde `[T3-3]` existante l'interdit d'ailleurs. Le job de santé lit un état et lève au plus trois incidents : ses 12 s étaient une réserve posée quand il était seul. Réparti en **6 + 36 + 8 = 50 s**, soit *exactement* ce que le registre consommait déjà. La plateforme ne voit aucune différence.
3. **Le plan est atteignable en VUE LISTE aussi**, pas seulement sur la fiche. La campagne de mutation a trouvé ce trou : la fiche n'est rendue que dans la vue canevas, donc le plan aurait été inaccessible au clavier et au lecteur d'écran — **mot pour mot** le défaut que la revue 4.6 avait corrigé sur le renommage.

**Trois dettes corrigées au passage, toutes rendues observables par cette story :**

- **D4 — le plafond « une notification d'Anam / 72 h ».** Compté par motif depuis 0030 ; indistinguable tant qu'Anam n'avait qu'un motif. Le second (`echeance_intention`) rend l'écart visible : deux courriels d'Anam en 72 h, contre un promis par `EXPERIENCE.md`. Rétabli **par famille** (`anam` | `socle`), ce qui restaure la promesse *et* garde la raison valable de 0030 (le socle quotidien FR-033 ne mangera pas le courriel de synthèse). Sa contrepartie est réparée pour de bon : `syntheses_non_annoncees` rend l'annonce **retentable indépendamment de la production** — le vrai correctif du défaut que 0030 décrivait sans le résoudre.
- **Deux prédicats ramenés à une définition unique.** `texte_significatif` / `rogner_texte` (extraits de 0024) et `eligible_au_periodique` (extrait de 0030) ; les anciens noms délèguent. Sans ça, cette story créait deux copies de la classe de caractères sans glyphe et deux copies des quatre conditions d'éligibilité — le piège des défenses redondantes, en double.
- **`MotifNotification` a disparu.** C'était un second ensemble fermé de motifs en face de `MotifCourriel`, sans aucune garde pour les tenir d'accord. Le canal courriel (`depot-canal-courriel.ts`) est désormais **composé** par les deux jobs au lieu d'être recopié.

**Deux régressions attrapées par la suite pendant le développement, et ce qu'elles ont appris :**

- Mon `create or replace function reserver_notification` était reparti de la version de **0030** et a silencieusement **effacé la garde de désabonnement de 0034** — un courriel repartait vers quelqu'un qui s'était désabonné. `desabonnement.test.ts` a rougi immédiatement. La migration porte désormais un avertissement en tête de cette fonction.
- La garde « un seul appelant du canal courriel » a rougi à l'arrivée du second expéditeur. Elle a été **renforcée plutôt qu'élargie** : elle vérifie maintenant que *tout* module capable d'envoyer réserve d'abord — et elle dit explicitement ce qu'elle ne peut pas prouver (un contournement à l'intérieur d'un expéditeur existant, couvert ailleurs par un test de comportement).

**Un test menteur retiré.** `synthese-sql.test.ts` assérait sur le *texte* de 0030 que « le plafond filtre sur le motif ». Ce test annonçait lui-même sa fin (« il redeviendra un vrai test de comportement le jour où un second motif existera ») ; ce jour est arrivé, et l'observation a renversé la conclusion. Le laisser en place l'aurait rendu vert **en décrivant l'inverse de ce que fait la base**.

**Campagne de mutation — 63 mutants, 62 tués, 1 survivant.**

Quatre mutants ont d'abord **survécu**, et chacun a révélé une garde qui ne gardait rien :

| Survivant initial | Ce qu'il a révélé | Correctif |
|---|---|---|
| un champ `number` ajouté à `Ouverture` | `corpsDuType` s'arrêtait au **premier `;`** — celui qui sépare deux membres d'objet. La garde AC5 lisait une ligne et demie : elle était **vide**. | découpage par ligne de fin de déclaration |
| un `.sort()` par rang dans le dépôt | le fixture servait trois lignes de **rang égal** : le tri de JS étant stable, le mutant ne changeait rien | rangs désordonnés dans le fixture |
| la vue liste perd le plan | **aucun test** ne couvrait la vue liste | `tests/rendu/plan-vue-liste.test.tsx` |
| la fenêtre de silence de l'invitation | piège des défenses redondantes : la clause de **mouvement** refusait à sa place | cas isolant : *elle obéit, et Anam doit quand même se taire* |

**Le survivant restant, assumé et documenté** (`intention-sql.test.ts`) : retirer `, i.id asc` de `charger_plan` ne change rien **aujourd'hui**, parce que l'index `intention_plan` fournit déjà cet ordre au planificateur. Le départage n'est pas décoratif pour autant — il fait la différence entre un ordre *spécifié* et un ordre *incident*, et l'ordre incident tombe le jour où le planificateur change d'avis. Le test verrouille la propriété observable ; prétendre prouver davantage serait pire que rien.

**Hors périmètre, consigné :** FR-088 (« les branches sont premium ») n'est gardé nulle part — `creer_branche_depuis_signal` (0021) ne porte aucune condition d'abonnement, et le quota de conversation `ALLOCATION_RESIDUELLE_TOURS` n'est posé nulle part non plus. Écrit dans `deferred-work.md`, à trancher avant mise en ligne. Cette story ne garde que ce qu'elle crée.

### Revue de code (2026-08-06) — 8 couches, 24 trouvailles retenues, toutes corrigées

**Dispositif.** Trois couches imposées à la même capacité que la session (Opus 5) et **en aveugle**, sans
mon contexte ni mes justifications : Blind Hunter, Edge Case Hunter, Acceptance Auditor. Quatre angles
ciblés sur Sonnet 5 (modèle différent) : SQL partagé, effet de bord au rendu serveur, rendu/état/a11y,
ordonnanceur/courriel/rétention, tests menteurs. Aucune trouvaille retenue sans vérification indépendante ;
**une a été réfutée** (l'affirmation que `planOuvert` ignorait la détresse — l'appelant compose bien
`!suspendus && premium`) et **une autre corrigée** (le préchargement des `<Link>` ne déclenche rien :
Next 16 ne précharge pas une route dynamique sans `loading.tsx`).

**Le défaut le plus grave, et il était invisible à la lecture.** `Conversation` reste montée en permanence
(correctif 4.6) et n'amorçait son fil que dans l'initialiseur de `useState`. Entrer dans la région arbre
déclenche `router.refresh()` → `app/page.tsx` se ré-exécute → `reserverParole()` **écrit** → la nouvelle
prop arrive → l'initialiseur ne rejoue pas. Parcours ordinaire : elle nomme sa 3ᵉ branche, elle clique sur
l'onglet arbre. **La fenêtre de sept jours était consommée et l'invitation n'était jamais affichée** —
Anam se taisait une semaine au moment précis où elle devait parler. `ouverture` est désormais réactive,
comparée sur une clé stable, selon le patron déjà validé pour `projLocale`.

**Les onze bloquants, tous corrigés et mutation-vérifiés :**

| # | Défaut | Correctif |
|---|---|---|
| 1 | la parole d'Anam brûlée sans que l'invitation soit dite | `ouverture` réactive dans `Conversation` |
| 2 | famine silencieuse de la synthèse (rattrapage à la même borne que le fan-out) | `RESERVE_RATTRAPAGE_MS` strictement au-dessus + `DELAI_ANNONCE_MS` |
| 3 | budget du rappel (8 s) < délai Resend (10 s) → job tué, fausse alarme | `DELAI_ENVOI_MS = 4 s`, borné sous le budget |
| 4 | réservation consommée sans envoi = rappel perdu **définitivement** | `liberer_notification` : la clé est rendue |
| 5 | **AC2 « modifiées » n'existait pas** — plomberie écrite, geste jamais câblé | bouton « Modifier », pré-remplissage, échéance passée vidée |
| 6 | **AC4 : « La voir » ne menait nulle part** en vue liste / arbre vide / indisponible | la fiche sort du ternaire canevas |
| 7 | la garde AC5 était **vide selon le formatage** (2ᵉ fois) | comptage d'imbrication + assertion de complétude |
| 8 | le rattrapage D4 n'était exercé par **aucun** test | 4 tests d'orchestration au niveau job |
| 9 | « l'échec d'UNE personne » ne testait pas ce qu'il annonçait | échec **par destinataire** au lieu d'un drapeau global |
| 10 | vue liste : focus perdu, plan non refermable | bouton bascule, `aria-expanded`, focus conservé |
| 11 | REFUS et PANNE confondus ; retrait annonçant « je n'ai pas pu enregistrer » | `REFUS_ETAPE`, `ECHEC_RETRAIT_ETAPE`, verrou synchrone |

**Treize corrections importantes :** `est_premium_courante` était exécutable par `anon` (leçon de 0007
reperdue — vérifié en base : ses deux sœurs ne l'étaient pas) · une échéance « aujourd'hui » était acceptée
alors que le tick de 06:00 UTC est déjà passé · les rappels étaient triés par uuid, donc **toujours les
dix mêmes** servies et jamais rattrapées → tri tournant par jour · les désabonnées occupaient les places de
rattrapage et de rappel · **une panne de l'arbitrage faisait taire aussi la proposition 4.5** (régression :
la 4.10 cassait une fonctionnalité de trois stories plus tôt) · `sante.ts` n'avait pas de garde de rendu de
main alors que j'avais réduit son budget de moitié · le GET du plan polluait le canal des incidents de
sécurité (validation uuid + refus ≠ panne) · `depot-arbitrage` et `depot-canal-courriel` n'étaient jamais
exécutés, seulement mockés · `aujourdhuiParis` employait la technique (`en-CA`) que le domaine documente
comme non fiable · ordre total de `syntheses_non_annoncees` · marqueur `purge FR-067` sur
`invitation_integration` · course de réponses concurrentes dans `PlanEtapes` · `useId` au lieu d'ids en dur.

**Trois décisions produit, tranchées par Julian le 2026-08-06 :** le seuil reste à **3** (Anam bascule dès
la troisième branche ouverte, ce qui s'écarte du « plus de 3 » du PRD — assumé) · la collision
synthèse/rappel : **on accepte la perte** (consignée) · Anam **rouvre la parole** après un long silence
(quatre fenêtres, soit 28 jours) plutôt que de se taire définitivement.

**Mutation-vérification des correctifs : 27 mutants, 27 tués.** Quatre ont d'abord survécu et chacun
désignait un test absent : la garde AC5 (une garde d'ABSENCE doit prouver qu'elle regarde au bon endroit —
chercher l'absence dans un extrait vide réussit toujours), le miroir de rendu des dates (jamais éprouvé
pour lui-même), le job de santé (aucun fichier de test n'existait), et le verrou de retrait (défenses
redondantes, nommé comme tel plutôt que dissimulé).

### File List

**Migration**
- `supabase/migrations/0036_intention_arbitrage.sql` *(nouveau)*

**Domaine pur (AD-1)**
- `lib/domain/intention.ts` *(nouveau)* · `lib/domain/arbitrage-ouverture.ts` *(nouveau)* · `lib/domain/synthese.ts`

**Données**
- `lib/data/depot-intention.ts` *(nouveau)* · `lib/data/depot-arbitrage.ts` *(nouveau)* · `lib/data/depot-canal-courriel.ts` *(nouveau)* · `lib/data/depot-synthese.ts`

**Sécurité / scène**
- `lib/safety/ouverture-branche.ts` · `lib/safety/projection-arbre.ts` · `lib/scene/projection.ts`

**Ordonnanceur & courriel**
- `lib/ordonnanceur/jobs/rappel-echeance.ts` *(nouveau)* · `lib/ordonnanceur/registre.ts` · `lib/ordonnanceur/jobs/synthese.ts` · `lib/courriel/port.ts` · `lib/courriel/gabarits.ts`

**Routes**
- `app/api/anam/plan/route.ts` *(nouveau)* · `app/page.tsx`

**Rendu**
- `render/intention.ts` *(nouveau)* · `render/arbre/PlanEtapes.tsx` *(nouveau)* · `render/conversation/InvitationIntegration.tsx` *(nouveau)* · `render/arbre/FicheBranche.tsx` · `render/arbre/VueListe.tsx` · `render/arbre/ArbreInteractif.tsx` · `render/arbre/copie-arbre.ts` · `render/arbre/arbre.module.css` · `render/conversation/Conversation.tsx` · `render/conversation/Fil.tsx` · `render/conversation/types.ts` · `render/conversation/copie-proposition.ts` · `render/scene-dom.tsx`

**Tests**
- *nouveaux :* `tests/intention-sql.test.ts` · `tests/intention-domaine.test.ts` · `tests/intention-endpoint.test.ts` · `tests/rappel-echeance-job.test.ts` · `tests/arbitrage-frontiere.test.ts` · `tests/rendu/plan-etapes.test.tsx` · `tests/rendu/plan-vue-liste.test.tsx` · `tests/rendu/invitation-integration.test.tsx`
- *modifiés :* `tests/ouverture-branche.test.ts` · `tests/synthese-domaine.test.ts` · `tests/synthese-sql.test.ts` · `tests/synthese-job.test.ts` · `tests/rendu/_installation.ts`

**Documentation**
- `_bmad-output/implementation-artifacts/deferred-work.md` (section FR-088)

### Change Log

| Date | Quoi |
|---|---|
| 2026-08-06 | Décisions PO D1–D5 tranchées et verrouillées dans la story. |
| 2026-08-06 | T1 — migration `0036` : `intention`, `invitation_integration`, motif `echeance_intention`, plafond **par famille**, RPC d'échéances dues et d'arbitrage, deux prédicats extraits. |
| 2026-08-06 | T2/T3 — domaine pur, dépôt possédé, route `POST`/`GET /api/anam/plan`. |
| 2026-08-06 | T4 — `chargerOuverture` : union discriminée, signal non consommé, parole réservée atomiquement. |
| 2026-08-06 | T5 — job de rappel d'échéance, registre rééquilibré (6+36+8 = 50 s), gabarit sans contenu, annonce retentable. |
| 2026-08-06 | T6 — plan d'étapes sur la fiche **et** en vue liste, deux champs vides, échéance bornée à aujourd'hui. |
| 2026-08-06 | T7 — gardes AC5 par le type et par le DOM ; garde d'envoi renforcée en « tout expéditeur réserve ». |
| 2026-08-06 | T8 — 1923 tests verts, `tsc`/`eslint`/`build`/`db reset` propres, 63 mutants (62 tués, 1 documenté). |
| 2026-08-06 | **Revue de code, 8 couches** — 24 trouvailles retenues (11 bloquantes), toutes corrigées. |
| 2026-08-06 | Décisions PO post-revue : seuil = 3 · perte de collision acceptée · réouverture de la parole après 28 j. |
| 2026-08-06 | Correctifs vérifiés : **1963 tests verts**, `tsc`/`eslint`/`build`/`db reset` propres, **27 mutants, 27 tués**. |

---

## References

- Spec de la story : `_bmad-output/planning-artifacts/epics.md:948`
- FR-030 / FR-031 / FR-032 : `prd.md:104-106` · FR-081 : `prd.md:189` · FR-088 : `prd.md:186` · seuil « plus de 3 branches / mois » : `prd.md:278`
- Ensemble fermé de trois motifs + plafond « une notification d'Anam / 72 h » : `EXPERIENCE.md:469-475`
- « Jamais un rappel de connexion » : `EXPERIENCE.md:543`
- Bloc document (titres/listes hors conversation) : `EXPERIENCE.md:116,153`
- FR-081 « détail à produire en phase UX » — lacune assumée : `EXPERIENCE.md:602`
- AD-8 (mémoire trois couches, arbre monotone) : `ARCHITECTURE-SPINE.md:71` · AD-7 (rendu muet) : `:69` · AD-14 (rythme possédé) : `:123`
- Point d'ouverture unique : `lib/safety/ouverture-branche.ts:22`
- Plafond par motif (à trancher, D4) : `supabase/migrations/0030_synthese_rattrapage.sql:380`
- Budget de temps du registre (à rééquilibrer, D5) : `lib/ordonnanceur/registre.ts:76`, `tests/ordonnanceur-architecture.test.ts:242`
