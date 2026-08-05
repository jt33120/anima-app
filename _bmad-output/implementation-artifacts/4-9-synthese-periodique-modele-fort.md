---
baseline_commit: 058be97
---

# Story 4.9 : La synthèse périodique — le moment où Anam peut être la plus directe

Status: review

Epic 4 · Dépend de : 4.1 (journal brut), 4.2 (faits extraits), 4.5/4.7 (branches), 2.4 (épisode de détresse), 3.1 (abonnement), **4.8 (l'ordonnanceur unique)**.
Premier vrai pensionnaire du registre fondé en 4.8.

---

## Story

En tant qu'utilisatrice, je veux recevoir à intervalle régulier un récapitulatif écrit de ce qui s'est dit, afin de relire mon chemin dans un moment où Anam peut être la plus franche.

**Couvre :** FR-066 (synthèse périodique), FR-081 (volet *synthèse*), FR-035 (discrétion des notifications), FR-034 (Anam ne se manifeste que si elle a quelque chose à dire) ; AD-5 (modèle fort), AD-17 (la détresse n'est jamais exploitée), AD-18 (tombstones respectés), AD-3 (port unique), AD-13 (egress gardé), AD-14 (rythme possédé par l'ordonnanceur).

---

## Acceptance Criteria

1. **[AC1 — l'ordonnanceur]** Étant donné l'ordonnanceur unique (4.8), quand l'intervalle de synthèse arrive, alors la synthèse est produite par un **job idempotent** enregistré au registre — aucun mécanisme périodique hors ordonnanceur — **et** avec le modèle **fort**.
2. **[AC2 — le matériau]** Étant donné la synthèse, quand elle est rédigée, alors elle s'appuie sur les faits `actif` et le journal, **respecte les tombstones** (jamais un fait supprimé ou corrigé, AD-18), **et** elle est rendue en **bloc document** (titres et listes autorisés hors conversation), conservée et consultable.
3. **[AC3 — DUR, AD-17]** Étant donné un épisode de détresse, quand la synthèse est produite, alors les épisodes de détresse en sont **exclus** par une clause sur `episode_detresse` — jamais exploités pour la synthèse, ni comme matériau, ni comme motif.
4. **[AC4 — la notification]** Étant donné une synthèse prête, quand l'utilisatrice est notifiée, alors la notification est **discrète et impersonnelle** (« Ta synthèse est prête »), dans l'**ensemble fermé** des motifs d'Anam (plafond **une notification / 72 h**), **et** aucun contenu intime ne paraît sur l'écran verrouillé ni dans l'objet du courriel.
5. **[AC5 — le registre premium]** Étant donné le registre premium, quand un compte gratuit atteint l'échéance, alors la synthèse **n'est pas produite** pour lui, **et** le socle gratuit n'est jamais dégradé.

---

## Décisions tranchées par le PO (2026-08-05, avant implémentation)

### D1 — La notification : **courriel via Resend, dès cette story**

Proposition alternative écartée par le PO : ne poser qu'un marqueur in-app et repousser le canal à l'Epic 6.

**Ce que ça implique, et qui est assumé :**

- **Resend devient un sous-traitant art. 28**, au même titre que le fournisseur de modèle. Il voit une **adresse de courriel** et **rien d'autre** : jamais un extrait, jamais un titre de branche, jamais un mot de la synthèse. L'objet et le corps sont **constants** — le seul élément variable est un lien vers la halte. C'est ce qui rend l'absence d'art. 9 structurelle et non disciplinaire (NFR-020), exactement comme les bornes de longueur de `execution_job` en 4.8.
- **Le plafond « une notification / 72 h » doit être inventé pour un motif unique**, puis rouvert à l'Epic 6 quand les deux autres motifs arriveront (FR-033 socle quotidien, FR-034 rappels d'échéance). **Réserve consignée par le dev, tranchée par le PO :** on le construit donc **générique dès maintenant** — une table `notification_envoyee` porteuse d'un `motif` dans un ensemble fermé, et une RPC de réservation atomique. L'Epic 6 ajoutera des motifs, pas un mécanisme.
- **Porte pré-lancement :** `RESEND_API_KEY` et le DPA Resend. Comme pour Mistral, l'adaptateur factice permet de tout tester sans clé ; **le boot-guard refuse d'envoyer si la clé manque** plutôt que d'envoyer en clair par un autre chemin.

### D2 — Le périmètre : **depuis la dernière synthèse**, pas une fenêtre glissante de 7 jours

Un tick manqué (panne, déploiement, cron non déclenché) ne doit **jamais** créer un trou définitif. Sur un produit dont la promesse est « relire mon chemin », une semaine jamais racontée est une trahison discrète — et invisible, ce qui est pire.

Conséquence assumée : **la fenêtre n'est plus bornée par construction**, il faut donc un plafond de volume envoyé au modèle fort. Le plafond mord par le **plus ancien** (on garde le récent), et quand il mord la synthèse **le dit** plutôt que de faire comme si de rien n'était.

Point de départ de la toute première synthèse : la **première entrée de journal** de l'utilisatrice, pas la création du compte — un compte créé il y a six mois et resté muet n'a pas six mois à raconter.

### D3 — Une période sans rien : **aucune synthèse, aucune trace, aucune notification**

FR-034, à la lettre : « Anam ne se manifeste que lorsqu'elle a quelque chose de spécifique à dire. Aucun message générique récurrent. » Une synthèse « il ne s'est rien passé cette semaine » **est** le message générique récurrent que le PRD interdit — et elle coûterait un appel au modèle fort pour le dire.

Ce qui compte comme « rien » est une décision de domaine, pas une intuition : **aucune entrée de journal éligible** dans la période (donc hors détresse, cf. AC3). Des faits anciens ne suffisent pas — ils ont déjà été racontés.

---

## Dev Notes

### Le fait le plus important

**C'est le premier job qui produit un EFFET VISIBLE.** Le job de santé de la 4.8 ne faisait que lire et écrire une ligne technique ; ici, un rejeu mal maîtrisé envoie **une seconde synthèse et un second courriel** à une vraie personne. La revue de la 4.8 a d'ailleurs trouvé et corrigé le chemin exact par lequel ça serait arrivé (`clore(succès)` dans le `try` du job). Le résidu documenté y reste vrai :

> « Un job qui produit un effet visible doit être idempotent **sur sa propre clé**, pas seulement sur sa fenêtre. »

C'est la contrainte n°1 de cette story. La fenêtre de l'ordonnanceur protège du rejeu du TICK ; elle ne protège pas d'un rejeu qui traverserait une clôture perdue. L'envoi du courriel doit donc être **réservé avant d'être fait**, comme la fenêtre est réclamée avant d'être exécutée.

### Le cœur en une phrase

Un job **quotidien** qui, chaque matin, cherche les utilisatrices dont la synthèse **hebdomadaire** est due, et en produit une **par personne et par semaine ISO** — la réclamation par `(job, semaine, utilisatrice)` étant ce qui empêche le double effet.

### Le piège de la cadence : pourquoi le job est QUOTIDIEN alors que la synthèse est HEBDOMADAIRE

Tentation évidente : `cadence: "hebdomadaire"` au registre. Elle est fausse, et d'une façon qui ne se verrait qu'en production.

Le répartiteur réclame **une** ligne par job et par fenêtre. Avec une cadence hebdomadaire, la fenêtre du job est la semaine ISO : le lundi, le fan-out tourne, réussit **partiellement** (trois utilisatrices sur cinq — une panne de modèle, un courriel refusé), et la ligne est close en `reussi`. Le mardi, le même tick trouve la fenêtre déjà réussie → `deja_fait` → **les deux utilisatrices en échec ne sont jamais reprises**, et ne le seront pas non plus la semaine suivante, qui aura sa propre période.

D'où le découplage, qui est le cœur technique de cette story :

| | Fenêtre | Ce que ça protège |
|---|---|---|
| **Le fan-out** (l'entrée du registre) | **quotidienne** | rien — il doit repasser chaque jour, c'est le mécanisme de reprise |
| **L'unité de travail** (une utilisatrice) | **hebdomadaire ISO** | le double effet : une synthèse par personne et par semaine, point |

Une utilisatrice traitée lundi est `deja_fait` mardi. Une utilisatrice en échec lundi est reprise mardi. C'est exactement la répartition que `execution_job.cible_id` attendait depuis la 4.8 — la colonne existe et l'index `nulls not distinct` a été posé pour ça.

### Le piège de l'exclusion de détresse (AC3, AD-17)

« Exclure les épisodes de détresse » a deux lectures, et **une seule est juste** :

- ❌ *Exclure les utilisatrices ayant vécu un épisode.* Ce serait punir la personne : celle qui a le plus traversé serait la seule privée de relecture.
- ✅ **Exclure les ENTRÉES DE JOURNAL tombées dans l'intervalle d'un épisode.** L'épisode est une parenthèse ; on l'enjambe, on ne supprime pas la phrase.

L'intervalle est `[debut, coalesce(fin, now())]` — un épisode **ouvert** exclut donc tout jusqu'à maintenant, ce qui est le bon repli (AD-15 : moins d'effet). Et si, après exclusion, il ne reste rien d'éligible, on retombe sur D3 : **aucune synthèse**. Une personne en épisode ouvert ne reçoit pas de courriel — c'est voulu, et c'est AD-17 pris au sérieux : rien ne naît pendant la détresse.

**La garde doit être une clause SQL, pas un filtre en TypeScript.** Un filtre applicatif s'oublie ; une clause dans la fonction qui lit le matériau ne peut pas être contournée par un appelant distrait — et c'est ce que l'AC3 demande littéralement (« par une clause sur `episode_detresse` »).

### Le piège des tombstones (AC2, AD-18)

`fait_extrait` a trois statuts : `actif`, `corrige`, `supprime`. Un tombstone **occupe la clé** (c'est ce qui empêche la résurrection en 4.2) et **son contenu est vidé**. Lire « tous les faits » puis filtrer donnerait un tableau où les tombstones apparaissent en lignes vides — inoffensif en apparence, mais c'est précisément par là qu'un `corrige` reviendrait un jour dans le prompt du modèle. La lecture est donc `statut = 'actif'`, dans la fonction, une fois.

### Le piège de l'egress (AD-13, NFR-020)

Deux sous-traitants sur ce chemin, et **ils ne voient pas la même chose** :

| | Ce qu'il reçoit | Ce qu'il ne doit JAMAIS recevoir |
|---|---|---|
| **Le modèle fort** (Mistral) | le journal et les faits — de l'art. 9, sous ZDR/DPA prouvés par le boot-guard | — |
| **Resend** | une adresse de courriel, un objet constant, un corps constant | un mot de la synthèse, un titre de branche, un prénom, un chiffre |

Le second est le nouveau, et le plus facile à casser par accident (« ajoutons juste le premier paragraphe en aperçu, c'est plus engageant »). D'où la même stratégie qu'en 4.8 pour `sante_ordonnanceur_publique` : **la discrétion est portée par la SIGNATURE**. Le port courriel n'accepte pas un corps libre — il accepte un `motif` d'un ensemble fermé et rien d'autre. La route ne peut pas en dire plus, même par accident.

### Ce qu'on RÉUTILISE (ne pas réinventer)

| Besoin | Existant | Où |
|---|---|---|
| Le rythme, l'idempotence, le bail | l'ordonnanceur | `lib/ordonnanceur/*` (4.8) |
| Le tier fort pour `synthese` | déjà câblé | `lib/ai/politique-tier.ts:34` |
| L'appel modèle non diffusé | `completer()` | `lib/ai/port.ts` |
| La borne de temps | `avecDelai` | `lib/domain/delai.ts` |
| Le repli sûr sur RPC | `rpcAvecRepli`, `journaliserIncidentSecurite` | `lib/safety/rpc-repli.ts` |
| Le rendu document | `BlocDocument` | `render/conversation/BlocDocument.tsx` |
| L'entitlement premium | `abonnement.etat = 'actif'` | `0013_abonnement.sql` |
| Le consentement art. 9 | `a_consenti_art9()` | migrations 1.x |
| La halte de compte | menu de compte, ordre invariable | EXPERIENCE.md §86 |

### Ce que 4.9 ne fait PAS

- **Pas les deux autres motifs de notification.** FR-033 (socle quotidien) et FR-034 (rappels d'échéance) restent à l'Epic 6 / 4.10. Le mécanisme de plafond, lui, est générique dès maintenant.
- **Pas de préférences de notification.** Pas d'écran de réglage, pas de fréquence choisie. Le désabonnement est un lien dans le courriel ; les réglages fins viendront avec les autres motifs.
- **Pas de synthèse à la demande.** Aucun bouton « générer maintenant » : ce serait une seconde porte vers le modèle fort, hors ordonnanceur, hors métrage.
- **Pas de notification push ni de service worker.** Le courriel est le canal, conformément à EXPERIENCE.md §449.

### Pièges connus, coûteux si redécouverts

1. **`auth.users` n'est pas lisible par PostgREST.** L'adresse vit dans `auth.users`, pas dans `public.utilisatrice` (qui ne porte que `id` et `cree_le`). Passer par l'API admin (`auth.admin.getUserById`) — et ne jamais recopier l'adresse dans une table `public`.
2. **Le fan-out est séquentiel dans une lambda de 60 s.** Le job a un `delaiMs` ; avec N utilisatrices et un appel au modèle fort chacune, le budget saute vite. Le job doit **traiter un lot borné par tick** et laisser le reste au lendemain — la reprise quotidienne est déjà le mécanisme prévu (voir le piège de la cadence).
3. **Deux effets à réserver, pas un.** La synthèse (écriture) et le courriel (envoi) sont deux effets distincts. Une synthèse écrite dont le courriel échoue ne doit pas être réécrite au tick suivant : la réservation du courriel est **séparée** de la production de la synthèse.
4. **Le plafond 72 h ne doit pas manger la synthèse.** Si le plafond refuse le courriel, la synthèse est quand même produite et consultable — le plafond borne le CANAL, jamais le CONTENU.
5. **Une semaine ISO n'est pas sept jours.** `fenetreDe("hebdomadaire", …)` donne `2026-W32` ; la PÉRIODE couverte, elle, va de la dernière synthèse à maintenant (D2). Ne pas confondre la clé d'idempotence et l'intervalle raconté.

---

## Tasks / Subtasks

- [x] **T1 — La base.** Migration `0029` : table `synthese` (période, contenu, RLS propriétaire en lecture, écriture `service_role`) ; table `notification_envoyee` (motif dans un ensemble fermé, dédup et plafond) ; RPC de lecture du matériau **avec la clause `episode_detresse` et le filtre `statut='actif'`** ; RPC de réservation atomique du canal.
- [x] **T2 — Le domaine pur.** Éligibilité, période à couvrir, plafond de volume, plafond 72 h. Zéro I/O (AD-1).
- [x] **T3 — Le dépôt.** Lecture du matériau, écriture de la synthèse, réservation du canal.
- [x] **T4 — Le port courriel.** Abstraction + adaptateur Resend + adaptateur factice + boot-guard. Signature fermée : un motif, jamais un corps libre.
- [x] **T5 — Le job.** `synthese-hebdomadaire` au registre, fan-out quotidien, claim par `(job, semaine, utilisatrice)`.
- [x] **T6 — Le rendu.** La halte « La synthèse » au menu de compte, bloc document, pastille discrète.
- [x] **T7 — Les gardes.** Architecture (un seul port courriel, un seul appelant), NFR-020/022 (rien d'art. 9 vers Resend), AC3 et AC5 prouvés en base.
- [x] **T8 — Vérification.** Suite complète, tsc, eslint, build, `db reset`, puis **mutation-vérification** de chaque garde neuve.

---

---

## Dev Agent Record

### Completion Notes

1. **Le job est QUOTIDIEN, la synthèse HEBDOMADAIRE.** C'est la décision technique centrale, et elle a été prise contre l'évidence apparente. Le fan-out repasse chaque jour (fenêtre quotidienne au registre) et réclame une fenêtre **hebdomadaire par personne** (`reclamer(job, semaine, utilisatriceId, bail)`). Une personne servie lundi est `deja_fait` mardi ; une personne en échec lundi est **reprise** mardi. Avec une cadence hebdomadaire au registre, un fan-out partiellement réussi aurait clos sa semaine et abandonné définitivement les personnes en échec. Mutation-vérifié dans les deux sens.

2. **`execution_job.cible_id` sert enfin à ce pour quoi elle a été posée en 4.8.** L'index `nulls not distinct` — dont la 4.8 disait qu'il était « le genre de faille invisible en test unitaire et visible une seule fois, en production » — porte maintenant deux formes de clé : `cible_id null` pour les jobs globaux, `cible_id = <personne>` pour le fan-out. Aucune migration n'a été nécessaire.

3. **Les trois gardes qui comptent sont en SQL, pas en TypeScript.** L'exclusion de détresse (AC3), le filtre des tombstones (AD-18) et les quatre conditions d'éligibilité (AC5) vivent dans les fonctions de lecture. Le job tourne sous `service_role`, qui contourne la RLS : une garde écrite dans l'appelant n'aurait été qu'une politesse, et le premier appelant suivant l'aurait oubliée. L'AC3 le demandait d'ailleurs littéralement.

4. **La bonne lecture d'« exclure les épisodes de détresse ».** Deux interprétations étaient possibles, et une seule est juste : on exclut les **entrées tombées dans l'intervalle**, pas les **personnes** qui en ont vécu un. L'autre lecture aurait puni celle qui a le plus traversé en la privant seule de sa relecture. Un épisode **ouvert** exclut jusqu'à maintenant — donc une personne en pleine traversée ne reçoit rien, ce qui est AD-17 pris au sérieux. Les deux lectures sont figées par des tests distincts.

5. **La discrétion du courriel est portée par la SIGNATURE du port, pas par la discipline.** `envoyer(destinataire, motif)` ne prend ni sujet, ni corps, ni variable. La phrase « ajoutons juste le premier paragraphe en aperçu » ne peut pas s'écrire : il n'y a pas de paramètre où la mettre. Une garde statique interdit en plus toute interpolation dans `gabarits.ts`. Resend voit une adresse et un motif — rien d'autre.

6. **Réserver AVANT d'envoyer, et `estConfigure()` avant de réserver.** Trois ordres possibles, un seul correct. Envoyer d'abord laisse une fenêtre où un plantage perd la trace → second courriel au tick suivant. Réserver avant de vérifier la configuration consomme le droit d'envoyer sans avoir envoyé → le plafond de 72 h bloque ensuite une annonce jamais partie. Les deux inversions sont mutation-vérifiées.

7. **Un défaut trouvé par la mutation, pas par la relecture.** Un `if (candidates.length === 0) return;` en tête de boucle **masquait** la garde `echecs > 0` du bas : on pouvait retirer cette dernière sans qu'aucun test ne rougisse, alors qu'elle est la seule à empêcher un incident quotidien les jours où personne n'a rien à raconter. Deux défenses du même invariant, un test qui prouve « au moins une existe ». C'est le piège payé en 4.7, retrouvé ici — le retour anticipé a été supprimé, le mutant meurt.

8. **`codeDErreur` a déménagé** de `lib/ordonnanceur/executer.ts` vers `lib/domain/code-erreur.ts` : le job en avait besoin, et le lui faire importer depuis le répartiteur aurait fermé un cycle (répartiteur → registre → job → répartiteur).

9. **Aucun parseur dans le rendu.** La fiche préserve la mise en forme du modèle (`white-space: pre-wrap`) au lieu d'en extraire titres et listes. Un parseur d'un texte de modèle est soit trop strict (il perd la structure), soit trop souple (il invente la sienne) — et dans les deux cas l'utilisatrice lit autre chose que ce qui a été écrit pour elle. Leçon de 4.7.

### Vérification

- **1628 tests verts** / 135 fichiers · `tsc --noEmit` propre · `eslint .` propre · `npm run build` propre (`/synthese` et `/api/ordonnanceur` enregistrées) · `supabase db reset` rejoue 0001→0029.
- **Mutation-vérification : 21 mutants, 21 tués** (10 SQL, 11 TypeScript). Restauration par **instantané**, jamais par `git checkout` — leçon de la revue 4.8, où le `checkout` avait effacé les correctifs non commités en même temps que les mutants et invalidé toute une passe.
- Nouveaux tests : `synthese-sql` (17), `synthese-job` (15), `synthese-domaine` (17).

### File List

**Nouveaux**
- `supabase/migrations/0029_synthese_periodique.sql`
- `lib/domain/synthese.ts` · `lib/domain/consigne-synthese.ts` · `lib/domain/code-erreur.ts`
- `lib/data/depot-synthese.ts`
- `lib/courriel/port.ts` · `gabarits.ts` · `fabrique.ts` · `adaptateurs/resend.ts` · `adaptateurs/factice.ts`
- `lib/ordonnanceur/jobs/synthese.ts`
- `app/synthese/page.tsx` · `render/synthese/FicheSynthese.tsx` · `render/synthese/synthese.module.css`
- `tests/synthese-sql.test.ts` · `tests/synthese-job.test.ts` · `tests/synthese-domaine.test.ts`

**Modifiés**
- `lib/ordonnanceur/registre.ts` (le second pensionnaire) · `lib/ordonnanceur/executer.ts` (`codeDErreur` extrait)
- `.env.example` (`RESEND_API_KEY`, `ANIMA_COURRIEL_EXPEDITEUR`)
- `tests/ordonnanceur-endpoint.test.ts` · `tests/ordonnanceur-executeur.test.ts` · `tests/lexique-voix.test.ts`

### Reste ouvert, assumé

- **La clé Resend n'est pas posée, et le DPA n'est pas signé.** Porte pré-lancement, au même titre que celle du fournisseur de modèle. Tant qu'elle manque, le port répond `estConfigure() === false` : la synthèse est produite et consultable, **aucune réservation n'est consommée**, et rien ne part. Le jour où la clé arrive, l'annonce de la semaine part.
- **Le lien du courriel pointe sur `https://anima.app/synthese`**, un domaine qui n'existe pas encore. À régler au premier déploiement, avec `RESEND_API_KEY` et `ANIMA_COURRIEL_EXPEDITEUR`.
- **La halte n'est pas encore dans un menu de compte.** `/synthese` est atteignable et c'est l'adresse du courriel, mais la feuille de compte à huit entrées spécifiée par EXPERIENCE.md §86 reste à faire — c'est une story d'UI à part entière, qui servira aussi « Ce qu'Anam retient », « Mes lectures » et « Mes données ».
- **Le plafond de 72 h est générique mais mono-motif.** Le mécanisme (table, RPC de réservation, verrou consultatif) accueillera FR-033 et FR-034 sans réécriture ; seul le `check` des motifs bougera. Ce qui n'est pas décidé : quel motif l'emporte quand deux se présentent dans la même fenêtre. À trancher à l'Epic 6, quand il y aura de quoi arbitrer.
- **Le texte de la consigne est un PLACEHOLDER produit**, comme celui du bilan (2.9). Ce que les tests prouvent, c'est ce qui ENTRE (jamais un tombstone, jamais une entrée d'épisode, jamais au-delà du plafond) — pas la qualité de ce qui sort.
- **`avecDelai` ne coupe pas le travail, il cesse de l'attendre.** Un appel au modèle qui dépasse laisse la requête HTTP vivre jusqu'à ce que la plateforme la tue. Sans double effet ici (l'écriture est idempotente sur `(utilisatrice, semaine)`), mais un `AbortSignal` traversant reste le bon outil le jour où un job écrira beaucoup.

## Change Log

| Date | Version | Description |
|---|---|---|
| 2026-08-05 | 0.1 | Story créée. D1/D2/D3 tranchés par le PO. D1 élargit le périmètre au canal courriel (Resend, sous-traitant art. 28) ; réserve du dev sur le plafond 72 h consignée et adressée par un mécanisme générique. |
| 2026-08-05 | 1.0 | Implémentée. 1628 tests verts, 21 mutants tués. Job quotidien / unité de travail hebdomadaire ; gardes AC3-AD-18-AC5 en SQL ; port courriel à signature fermée. Un défaut trouvé par la mutation (retour anticipé masquant une garde). Statut → review. |
