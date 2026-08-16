---
baseline_commit: 82aced4
---

# Story 6.8 : Le moteur de rétention automatique

Status: review

## Story

En tant qu'utilisatrice,
je veux que mes données soient conservées le temps de la relation puis effacées automatiquement selon
des durées claires,
afin de ne jamais voir mes confidences traîner indéfiniment ni dépendre d'un geste manuel pour
disparaître.

**Couvre :** NFR-021 · AD-14 (le moteur d'effacement est le seul propriétaire des durées et de la
propagation), section Opérations (ordonnanceur), FR-071 (durée appliquée en cas de minorité détectée).

---

## Ce que cette story livre, en une phrase

Elle n'écrit **aucun** effaceur : la 6.7 en avait déjà posé un, et cette story lui ouvre une **seconde
porte** — celle par laquelle on efface quelqu'un qui n'a plus de session depuis vingt-sept mois.

---

## Les décisions

### D1 — Un seul moteur, deux portes

La 6.7 avait écrit `effacer_toutes_mes_donnees()`, clé sur `auth.uid()`. Juste pour elle : la personne
demande, la session la nomme. L'ordonnanceur, lui, n'a aucune session.

Le corps est donc devenu `effacer_utilisatrice(id, motif, fenêtre)`, réservée au rôle système, et
`effacer_toutes_mes_donnees` n'est plus qu'une enveloppe de trois lignes. **Après cette migration, la
définition courante ne contient qu'un seul `delete from public.utilisatrice` et un seul
`delete from auth.users` dans tout le schéma** — et une garde l'exige.

### D2 — Un compte dont l'abonnement est actif n'est jamais effacé pour inactivité

Le raisonnement est désagréable et il fallait l'écrire : **quelqu'un peut payer douze mois sans jamais
ouvrir l'application.** Ses traces d'activité ne bougent pas pour autant — seuls les webhooks de
paiement écrivent. Sans cette garde, le moteur effacerait les données d'une abonnée qui paie, et le
premier signe en serait sa carte débitée pour un compte vide.

La minorité détectée (FR-071) efface **quoi qu'il arrive** : c'est le seul cas où un abonnement actif
ne protège rien, parce que le compte n'aurait jamais dû exister.

### D3 — La grâce se recalcule, elle ne se nettoie pas

« Trois mois plus tard **sans reprise** » demandait un état à effacer quand elle revient : un drapeau
qu'on laisserait périmé. On ne pose rien à nettoyer. Au moment de trancher, **on remesure** — et si
elle a bougé, l'échéance est retirée. Revenir suffit ; personne n'a à s'en souvenir.

La décision vit en base, en un aller-retour : relire l'activité en TypeScript puis décider laisserait
un intervalle entre la lecture et l'effacement, et cet intervalle-là, c'est exactement le moment où
elle revient.

### D4 — « Dernière activité » ne compte que ce qu'ELLE fait

Ni `usage_ia`, ni `synthese`, ni `notification_envoyee`, ni `abonnement`. C'est la leçon de la 6.4, et
elle est ici plus lourde : ces quatre tables bougent quand le **produit** travaille. Les compter ferait
qu'un compte abandonné aurait l'air vivant à cause de nos propres jobs — la conservation deviendrait
éternelle par accident.

### D5 — On envoie l'avis d'abord, on pose l'échéance ensuite

L'ordre inverse serait le vrai danger : une échéance posée sans avis parti, et trois mois plus tard un
compte qui disparaît sans que personne n'ait été prévenu. **Aucune échéance n'est posée si l'avis n'est
pas parti** — canal absent, adresse introuvable, panne d'envoi. Le compte reste, et il ressortira
demain. AD-15 : le repli penche du côté du moindre effet.

### D6 — L'avis est un `MotifLegal`, pas un `MotifCourriel`

Le mettre dans `MotifCourriel` l'aurait soumis au refus de canal et au plafond par famille.
Autrement dit : un clic dans un pied de courriel, deux ans plus tôt, aurait dispensé de prévenir
quelqu'un avant d'effacer tout ce qu'il a écrit. Il est **émis par le produit et non signé d'Anam** —
lui faire annoncer qu'elle va effacer ce qu'on lui a confié, c'est lui faire jouer l'huissier.

### D7 — Aucune réclamation par personne

Les deux autres jobs à fan-out réclament une fenêtre par personne. Ici ce serait inutile
(l'idempotence est **structurelle** : un compte effacé ne ressort d'aucune sélection) et **absurde** :
la ligne de réclamation porterait `cible_id`, en cascade vers `utilisatrice` — elle serait effacée par
l'effacement qu'elle est censée garder. Une serrure emportée par la porte qu'elle ferme.

---

## Les deux trouvailles de la revue 6.1a, portées ici

**R1 — la rétention du journal de l'ordonnanceur : FERMÉE.** `purger_journal_ordonnanceur` retire les
exécutions terminées et les incidents de plus de 90 jours. ⚠️ **Seulement ce qui est TERMINÉ** : purger
une ligne `en_cours` libérerait sa fenêtre sous le bail de son détenteur et autoriserait un second
passage — sur la rétention, un second effacement.

**R2 — le silence possible du job de santé : NON CORRIGÉE, et voici pourquoi.** Le remède envisagé
(un incident levé par la sonde sur elle-même) est pire que le mal : il n'a aucun mécanisme d'extinction
— le job de santé se clôt `reussi` justement quand il rend la main. La vraie protection est le
**plancher gardé par test** (`COUT_ETAT_MS + RESERVE × (n+1)`), et cette story vient précisément de le
faire monter. Dette maintenue, avec son raisonnement.

---

## Le prix du cinquième job, payé dans le même commit

Le registre est une **ressource partagée**, et `jobs/sante.ts` l'avait prédit mot pour mot : « cette
formule rendra rouge la garde au premier job ajouté ». Elle a rougi.

```
Σ      = 9 000 + 36 000 + 8 000 + 10 000 + 12 000 = 75 000
marge  = margeHorsDelais(5) = 800 + 5 × 2 400     = 12 800
Σ+marge= 87 800 ≤ BUDGET_TICK_MS = 89 000 ≤ PLAFOND hobby = 300 000
mou    = 1 200 ≤ RESERVE_DECLAREE_MS = 2 000
```

`sante.delaiMs` 8 000 → 9 000, `BUDGET_TICK_MS` 74 000 → 89 000, `maxDuration` 74 → 89.

---

## Ce que l'AC3 demandait, et qui était déjà vrai plus fortement

« Fermeture de compte → suppression sous 30 jours ». Dans ce produit, la fermeture de compte **est**
l'effacement total de la 6.7, et il est **immédiat**. Zéro jour vaut mieux que trente ; rien n'a été
ajouté pour dégrader ce chemin.

---

## Dev Agent Record

### Deux gardes existantes ont mordu, et elles avaient raison

| Garde | Ce qu'elle refusait | Ce qu'on a fait |
|---|---|---|
| `regime-anam` | `retention_inactivite` ajouté au `CHECK` de `notification_envoyee.motif` | **retiré** — cette table est le miroir des motifs à CANAL ; l'avis relève du régime légal. La trace y aurait de toute façon été purgée par `purger_notifications_envoyees`, alors que `echeance_suppression` vit aussi longtemps que le compte |
| `synthese-domaine` | le job obtenait un port d'envoi sans réserver | l'envoi a **déménagé dans `lib/courriel/avis-inactivite.ts`**, jumeau de `reconduction.ts` — c'est là que vit le régime légal, et la garde exclut ce dossier exprès |

### Ce que la campagne de mutation a trouvé

**29 mutants, 29 tués** — en trois passages. Six survivants au premier :

- **M2 et M16 : deux fautes de MES tests.** M2 (« une mineure entre par le chemin de l'inactivité »)
  était couvert par une seconde clause : la mineure de test avait *déjà* une échéance, donc elle était
  exclue pour une autre raison. Le piège des défenses redondantes, une fois de plus. M16 appelait la
  porte système avec `p_utilisatrice_id: null` : accorder `execute` à `authenticated` ne faisait rien
  rougir, puisque la fonction levait de toute façon sur l'identité absente.
- **M25, M26, M27, M28 : quatre vrais trous.** Rien n'exerçait le dépôt ni le module d'avis — le job
  les doublait tous les deux. L'avis pouvait prétendre être parti sans adresse, partir sans canal
  configuré, être signé « — Anam », et une réponse incomprise du moteur pouvait être lue comme un
  effacement. `tests/retention-avis.test.ts` (17 tests) est né de ces quatre-là.

### ⚠️ Mon harnais de mutation a corrompu le dépôt, et il fallait le dire

Il archivait les fichiers par **nom de base**. `lib/domain/retention.ts` et
`lib/ordonnanceur/jobs/retention.ts` s'y sont écrasés l'un l'autre, et la restauration a rendu le JOB
à la place du DOMAINE. Détecté immédiatement, fichier réécrit, harnais corrigé pour archiver sur le
chemin relatif entier. **Un harnais de mutation qui corrompt le dépôt qu'il éprouve est pire
qu'aucun harnais** — et les campagnes 6.6/6.7 avaient le même défaut latent, sans collision de nom.

### Vérification

- **262 fichiers / 4455 tests** verts ; `tsc --noEmit`, `eslint .`, `next build` propres
- `supabase db reset` : 0001 → 0059 appliquées
- **Cloud** : parité 59 / 59 / 59 ; les 7 fonctions présentes ; `effacer_utilisatrice` **fermée à
  `authenticated`**, `effacer_toutes_mes_donnees` ouverte à elle
- **Contrôle avant vol en production** : 97 comptes, **0 avec échéance, 0 à effacer, 0 à prévenir,
  0 ligne de journal à purger** au premier tick. Le moteur démarre à vide.

### Flakiness observée, et sa cause

Trois fichiers de test SQL ont rougi une fois chacun en suite complète, et passent tous en isolation.
Cause probable : les deux nouveaux fichiers SQL de 6.7/6.8 créent beaucoup de comptes d'auth en
parallèle, et le délai de 3 s de `depot-ordonnanceur` se joue alors sur la charge du Postgres local.
Ce n'est pas un défaut produit ; c'est le harnais de test qui approche sa limite. À surveiller.

### Dette laissée

- **R2 (le silence possible de la sonde)** — maintenue, avec son raisonnement ci-dessus.
- **Le palier `hobby` n'autorise qu'un tick par jour.** Le moteur tranche donc au plus 50 échéances et
  50 avis par jour (`LOT_MAX`). Suffisant très longtemps ; à revoir avec le passage `pro`.
- **Aucune interface** n'affiche l'échéance à l'utilisatrice : elle la reçoit par courriel, et
  `/mes-donnees` ne la mentionne pas. À trancher si le menu de compte est conçu.

---

## Change Log

| Date | Ce qui change |
|---|---|
| 2026-08-16 | Story livrée. Migration 0059 déployée cloud. 29/29 mutants tués. Ferme l'Epic 6. |
