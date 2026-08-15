---
baseline_commit: a227d87bf72bc2e9e14d1d6f9f80b305ae787664
---

# Story 6.2 : Le socle quotidien impersonnel et les notifications discrètes

Status: review

## Story

En tant qu'utilisatrice, je veux recevoir, si je le souhaite, une manifestation quotidienne du socle qui
reste impersonnelle et dont l'aperçu ne révèle rien, afin de vivre un rythme léger qui n'exige rien et ne
me trahit jamais sur mon écran verrouillé.

**Couvre :** FR-033, FR-035, NFR-015 (discrétion des aperçus), NFR-002 (aucun traceur), NFR-004 (aucune
inférence d'émotion ne déclenche une notification), NFR-020 (aucun art. 9 chez un tiers), AD-14, AD-15,
AD-17 — et la fondation web push (plomberie, manifeste, service worker, gabarit d'aperçu) dont la
Story 6.3 héritera.

---

## ⚠️ Ce que cette story rend possible et ce qu'elle ne peut pas rendre vivant

Cette story livre le mécanisme complet. Elle ne le fait pas **partir** aujourd'hui, et ce n'est pas une
lacune : c'est une collision avec un fait de plateforme, qui est déjà mesuré dans le dépôt.

`TICKS_MAX_PAR_JOUR` (`lib/domain/ordonnanceur-budget.ts`, Story 6.1) dit que le palier `hobby` autorise
**un déclenchement par jour**, avec une dérive annoncée de **±59 minutes**. L'AC2 exige une notification
**à l'heure choisie par l'utilisatrice**. Les deux ne peuvent pas être vrais en même temps :

- une seule cadence quotidienne ne peut honorer qu'**une** heure sur vingt-quatre — vingt-trois personnes
  sur vingt-quatre ne seraient jamais servies à l'heure qu'elles ont choisie ;
- et cette heure-là même n'est pas garantie : le déclenchement quotidien est posé à une heure fixe
  (`0 6 * * *`), et rien n'oblige quiconque à choisir 6 h.

⚠️ **Correction apportée en cours de dev** (voir D11) : la première rédaction ajoutait « et la dérive de
59 minutes déplace le déclenchement d'une heure civile à l'autre ». C'est FAUX sur une cadence horaire —
8 h 00 + 59 min = 8 h 59, toujours dans l'heure 8. La dérive ne disqualifie qu'à partir d'une heure
pleine. La conclusion ne bouge pas : c'est la CADENCE qui disqualifie `hobby`, pas la dérive.

Le repli est donc **fail-closed, et il est la story** : sur `hobby`, le job du socle ne pousse rien et le
dit. Pas de notification à une heure au hasard, pas de « à peu près 8 h ». C'est AD-15 appliqué au
littéral — le repli produit MOINS d'effet, jamais plus.

Le passage au palier `pro` est **déjà** une porte avant publication (le plan Hobby interdit l'usage
commercial, et Anima encaisse). Cette story y ajoute une seconde raison et un second geste : passer
l'expression cron à l'heure.

---

## Décisions tranchées avant dev

### D1 — La poussée ne porte AUCUNE charge utile

RFC 8030 autorise un corps vide. On s'en sert.

Le service de poussée — APNs pour Safari/iOS, FCM pour Chrome, Mozilla pour Firefox — voit alors : une
adresse d'endpoint, et zéro octet. Il ne peut rien apprendre, parce qu'on ne lui donne rien. Le titre et
le corps sont choisis **dans le service worker**, à partir d'un ensemble fini embarqué.

C'est la stratégie exacte de `PortCourriel` (Story 4.9), transposée : *« on ne demande pas à l'appelant
d'être discipliné, on lui retire le moyen de ne pas l'être »*. La phrase « ajoutons juste le mantra du
jour dans l'aperçu, c'est plus engageant » devient inécrivable — **il n'existe aucun paramètre où la
mettre**. NFR-015 et NFR-020 cessent d'être des règles de rédaction pour devenir une propriété de la
signature.

Effet de bord assumé : le corps est **le même pour tout le monde** ce jour-là. C'est exactement ce que
FR-033 demande — « impersonnel ».

### D2 — Aucune dépendance nouvelle : VAPID signé avec WebCrypto

`web-push` est la bibliothèque usuelle, mais l'essentiel de ce qu'elle apporte est le **chiffrement de
charge utile** (aes128gcm), dont D1 nous dispense entièrement. Ce qui reste est un JWT ES256 sur P-256 :
`crypto.subtle` le signe nativement, et sa sortie brute `r‖s` est déjà le format que JWS attend.

Environ soixante lignes, aucune dépendance, et — le point qui décide — **testable** : un test vérifie
notre propre JWT avec la clé publique via `crypto.subtle.verify`, ce qu'on ne peut pas faire d'une
bibliothèque tierce sans la réimplémenter.

### D3 — Un seul fuseau : `Europe/Paris`

`utilisatrice.lieu_fuseau` existe (0039) mais c'est le fuseau du **lieu de naissance**, pas de résidence,
et il est write-once : s'en servir pour l'heure d'une notification serait une faute de sens qui ne se
verrait jamais. Tout le dépôt tranche déjà `Europe/Paris` (`jour_paris` en 0046, la décision D3 de la
5.4). L'heure choisie est une heure de Paris. Le jour où le produit sort de France, c'est une story.

### D4 — L'heure choisie exige le palier `pro` — refus fail-closed sur `hobby`

Voir l'encadré ci-dessus. La garde vit dans le **domaine pur** (`heuresHonorables(PALIER)`), pas dans le
job : une condition écrite dans le job serait invisible à la CI et s'oublierait au premier refactor.

### D5 — Le service worker ne fait QUE la poussée

Aucun gestionnaire `fetch`, aucun cache, aucune stratégie hors-ligne. Un service worker qui met en cache
est la façon la plus fiable de livrer une application que l'utilisatrice ne peut plus mettre à jour — et
sur un produit qui porte de l'art. 9, servir une version périmée d'un écran de consentement est une faute
grave.

**Verrou de source** : un test lit `public/sw.js` et échoue si `addEventListener("fetch"` ou `caches.`
y apparaît. La discipline sans garde n'est pas de la discipline.

### D6 — L'abonnement de poussée EST le consentement au canal

Pas de colonne `pousse_active`, pas de bascule séparée. Il y a un abonnement, ou il n'y en a pas. Se
désabonner, c'est supprimer la ligne — le navigateur et la base disent alors la même chose, et il n'existe
aucun état où l'un des deux ment.

### D7 — `reserver_notification` n'est PAS réécrite

En 4.10, la réécrire a coûté la garde de désabonnement de 0034 ; l'en-tête de 0036 le raconte. Cette story
n'y touche pas d'une ligne. Elle ajoute **une valeur** au CHECK de `notification_envoyee.motif` et **une
branche** à `famille_motif` — les deux gestes que 0029 avait annoncés comme la façon d'étendre l'ensemble.

Conséquence assumée, et elle est juridiquement la bonne : un refus déposé via `preference_courriel.refuse_le`
**vaut aussi pour la poussée**. L'art. 21 est un droit d'opposition au *traitement* de notification produit,
pas au *transport* qui le porte. Une opposition qui ne vaudrait que pour le courriel serait une opposition
qu'on aurait réduite en la respectant.

### D8 — La suppression pendant un épisode de détresse (AD-17) est gratuite, donc elle est prise

Le socle est impersonnel et n'exige rien : on pourrait défendre qu'il ne nuit pas pendant une fenêtre de
détresse. Mais ne pas l'envoyer ne coûte **rien** (il n'y a aucun rattrapage, la journée est simplement
perdue), et l'envoyer coûte un pari. On ne parie pas là-dessus. La garde vit dans la **RPC de sélection**,
comme celle de `rappels_echeance_dus` — jamais dans un filtre TypeScript.

### D9 — `/reglages` naît ici, minimal

L'AC4 exige que la permission soit demandée « en contexte, depuis les réglages ». Il n'existe aucun écran
de réglages. Cette story en crée un, qui ne porte **que** les notifications — pas le menu de compte complet
(qui reste à concevoir). Une halte de plus atteignable par URL, dans la lignée de `/lectures`, `/synthese`,
`/ancrages`.

### D10 — Le budget du tick monte de 60 s à 74 s, dans le même commit

Règle de la 6.1 : `Σ delaiMs + margeHorsDelais(n) ≤ BUDGET_TICK_MS ≤ PLAFOND_DUREE_MS[PALIER]`, et le mou
reste borné par le haut (`RESERVE_DECLAREE_MS`).

    Σ      = 8 000 + 36 000 + 8 000 + 10 000 = 62 000
    marge  = margeHorsDelais(4) = 800 + 4 × 2 400 = 10 400
    Σ+marge= 72 400  ≤  BUDGET_TICK_MS = 74 000  ≤  300 000 ✓
    mou    = 1 600  ≤  RESERVE_DECLAREE_MS = 2 000 ✓

`maxDuration` passe à 74 **en littéral** dans `app/api/ordonnanceur/route.ts`.

⚠️ **Les 8 s du job de SANTÉ ne sont pas un arrondi de confort, et je ne les avais pas prévus.** Ce job
lève au plus un incident PAR JOB DU REGISTRE : son plancher vaut `COUT_ETAT_MS + RESERVE_INCIDENT_MS ×
(n + 1)` et grandit donc quand un job entre. L'arrivée du socle l'a porté à 7 200 ms, au-dessus des
6 000 qu'il avait — et c'est `tests/sante-job.test.ts` qui l'a dit, pas une relecture.

C'est exactement ce que la 6.1 avait construit : le budget est une ressource **partagée**, et un job qui
entre peut renchérir le coût d'un autre sans le toucher. Un plafond acheté « pour être tranquille »
aurait avalé ce signal.

### D11 — `heureHonorable(ticks, dérive)` a été extraite POUR ÊTRE MUTABLE (ajoutée en cours de route)

La garde de l'AC8 lisait d'abord un **palier**, et son second terme était alors intestable : les deux
paliers réels échouent ou passent les deux conditions ensemble, donc amputer la clause de dérive rendait
exactement le même verdict. Un mutant survivant, et survivant pour une bonne raison — il n'existait
aucune entrée qui sépare les deux clauses.

Le prédicat prend désormais les deux **faits** ; le palier hypothétique qui les sépare s'écrit alors en
une ligne de test, et le mutant meurt. C'est la leçon des « défenses redondantes » du dépôt, appliquée à
une conjonction plutôt qu'à deux gardes.

⚠️ Ce travail a aussi corrigé une **erreur de raisonnement de la story elle-même** : une dérive de
59 minutes sur une cadence horaire ne fait PAS sortir de l'heure choisie (déclenchement à 8 h 00 + 59 min
= 8 h 59, toujours l'heure 8). Ce qui en fait sortir, c'est une dérive d'une heure ou plus. La conclusion
sur `hobby` ne bouge pas d'un pouce — c'est la CADENCE (1 tick/jour) qui disqualifie, pas la dérive.

---

## Acceptance Criteria

- **AC1 — Calculé, jamais généré.** Le corps de la notification vient d'un ensemble **fini et relu**,
  choisi par calcul déterministe sur le jour civil. Aucun appel modèle sur ce chemin. Le texte n'est jamais
  signé d'Anam, et ne fait référence ni au journal, ni à une branche, ni à un échange.
- **AC2 — L'heure, le titre, six mots.** Le titre est « Anam ». Le corps ne dépasse **jamais six mots**. Il
  ne porte aucun vocabulaire ésotérique (détecteur FR-023 existant), aucune prédiction (détecteur 5.2),
  aucun mot de l'utilisatrice. La notification n'est émise que quand l'heure choisie (8 h Paris par défaut)
  est arrivée, et **au plus une fois par personne et par jour civil**.
- **AC3 — Aucune série, aucun rattrapage.** Un tick manqué perd la journée, définitivement. Il n'existe
  aucune file où le retard s'accumule, aucun compteur de jours consécutifs, et aucun motif de réengagement
  — structurellement, pas par discipline.
- **AC4 — Dégradation propre.** Poussée refusée ou indisponible ⇒ le socle vit dans l'app, sans erreur ni
  bandeau. La permission est demandée **une seule fois**, à la demande, depuis `/reglages`. Aucune bannière
  insistante, aucune demande au chargement.
- **AC5 — Privacy-cover.** Quand le document passe en arrière-plan, la scène est masquée par un couvercle
  neutre avant que le système ne prenne sa vignette.
- **AC6 — Rien ne fuit.** La poussée part **sans charge utile** : le sous-traitant de poussée ne reçoit
  aucun octet de contenu. Aucune inférence d'émotion n'entre dans la décision d'émettre. Aucun traceur,
  aucun appel analytique sur ce chemin.
- **AC7 — Le service worker ne met rien en cache.** Aucun gestionnaire `fetch`, aucune API `caches`, et un
  test de source casse le build si l'un des deux apparaît.
- **AC8 — Le palier est déclaré, pas subi.** Sur un palier incapable d'honorer une heure choisie, le job
  refuse d'émettre et le dit. L'expression cron de `vercel.json` est gardée contre
  `TICKS_MAX_PAR_JOUR[PALIER]` : une cadence horaire déclarée sur `hobby` rougit en CI **avant** de faire
  échouer le déploiement.
- **AC9 — Le budget.** `Σ + margeHorsDelais(4) ≤ BUDGET_TICK_MS ≤ PLAFOND_DUREE_MS[PALIER]`, mou borné, et
  `maxDuration` en littéral d'accord avec `BUDGET_TICK_MS`.
- **AC10 — Cascade FR-067.** Abonnement de poussée et préférence d'heure s'effacent avec le compte.

---

## Tasks / Subtasks

- [x] **T1 — Le domaine pur** (`lib/domain/socle-quotidien.ts`) — AC1, AC2, AC8
  - [x] `CORPS_POUSSEE` : l'ensemble fini, relu, ≤ 6 mots.
  - [x] `corpsDuJour(jour)` déterministe ; `TITRE_POUSSEE`.
  - [x] `HEURE_PAR_DEFAUT = 8`, `heureValide`, `heuresHonorables(palier)`.
  - [x] Tests : ≤ 6 mots, lexique interdit, détecteur de prédiction, déterminisme, anti-vacuité.
- [x] **T2 — Migration 0053** — AC2, AC3, AC10, D7, D8
  - [x] `preference_socle` (heure, RLS propriétaire, write-gate dans le `WITH CHECK`).
  - [x] `abonnement_poussee` (endpoint unique, clés, RLS propriétaire, cascade).
  - [x] `'socle_quotidien'` ajouté au CHECK `notification_envoyee.motif` + `famille_motif → 'socle'`.
  - [x] RPC `socle_quotidien_du(p_heure, p_limite)` : heure, consentement vivant, pas de barrière de
        minorité, **hors fenêtre de détresse**, abonnement présent.
  - [x] Tests SQL contre le vrai Postgres.
- [x] **T3 — Le port de poussée** (`lib/poussee/`) — AC6, D1, D2
  - [x] `port.ts` : signature sans charge utile, motifs fermés.
  - [x] `vapid.ts` : JWT ES256 via WebCrypto ; test de vérification par la clé publique.
  - [x] `adaptateurs/web-push.ts` : POST RFC 8030, `TTL`, `Urgency`, borné par `avecDelai`.
- [x] **T4 — Manifeste + service worker** — AC4, AC5, AC7, D5
  - [x] `public/manifest.webmanifest` neutre (nom « Anam », icône déjà discrète).
  - [x] `public/sw.js` : `push` + `notificationclick` seulement.
  - [x] Verrou de source : ni `fetch`, ni `caches.`, et l'ensemble fini d'accord avec le domaine.
- [x] **T5 — Le job** (`lib/ordonnanceur/jobs/socle-quotidien.ts`) + registre + budget — AC2, AC3, AC8, AC9
  - [x] Fan-out par personne, réserve de fin de lot, refus fail-closed sur palier incapable.
  - [x] `BUDGET_TICK_MS = 72_000` + `maxDuration = 72` littéral.
  - [x] Garde `vercel.json` × `TICKS_MAX_PAR_JOUR[PALIER]`.
- [x] **T6 — `/reglages` + l'abonnement** — AC4, D6, D9
  - [x] Page serveur + îlot client : permission à la demande, heure, désabonnement.
  - [x] Routes API d'abonnement / désabonnement (session, pas `service_role`).
- [x] **T7 — Le privacy-cover** — AC5
- [x] **T8 — Vérification** : suite complète, `tsc`, `eslint`, `next build`, `db reset`, campagne de
      mutation, déploiement cloud de 0053.

---

## Dev Notes

### Doctrine du dépôt — non négociable

- `authenticated` détient les sept privilèges DML sur toute table `public` : **une garde qui ne vit que
  dans une route, une Server Action ou une RPC ne garde rien.** Elle vit dans le `WITH CHECK` d'une policy
  ou dans un trigger.
- Un test vert ne prouve rien tant que son mutant n'est pas mort. Restauration par instantané `cp`, jamais
  `git checkout`. Un mutant équivalent se documente, il ne se masque pas.
- Piège des défenses redondantes : deux gardes qui se couvrent l'une l'autre laissent le mutant survivre.
  Chacune se mute séparément.
- **Un mutant n'est tué que par un TEST.** Toute autre cause de rouge (outillage, réseau, délai) se
  distingue explicitement — la 6.1a a compté sept faux morts sur seize à cause d'un 502 de `db reset`.
- **Une table ne se déclare pas pour servir un test** (D3 contestée de la 6.1a).

### References

- `_bmad-output/planning-artifacts/epics.md` — Story 6.2
- `_bmad-output/planning-artifacts/ux-designs/ux-Anima-2026-07-21/EXPERIENCE.md:461,498`
- `_bmad-output/planning-artifacts/ux-designs/ux-Anima-2026-07-21/DESIGN.md:301,427` (privacy-cover)
- `lib/domain/ordonnanceur-budget.ts` (6.1) — `PALIER`, `TICKS_MAX_PAR_JOUR`, `margeHorsDelais`
- `lib/ordonnanceur/jobs/rappel-echeance.ts` (4.10) — le patron du fan-out borné
- `supabase/migrations/0036_intention_arbitrage.sql:429` — `famille_motif`, et l'en-tête sur la réécriture
- `supabase/migrations/0034_desabonnement_courriel.sql:44` — le patron `preference_*`

---

## Dev Agent Record

### Agent Model Used

claude-opus-5[1m]

### Debug Log References

- `supabase db reset` 0001→0053 : appliquée sans erreur, deux fois (avant et après la campagne).
- Suite complète : **233 fichiers / 3848 tests**, deux passes consécutives vertes.
- `tsc --noEmit`, `eslint .`, `next build` : propres.

### Completion Notes List

#### Ce que la story a changé contre son propre plan

**Le raisonnement d'ouverture était à moitié faux, et le test l'a dit.** La story affirmait qu'une dérive
de 59 minutes déplace la notification d'une heure civile à l'autre. C'est faux : 8 h 00 + 59 min = 8 h 59,
toujours l'heure 8. Ce qui fait sortir de l'heure, c'est une dérive d'une **heure pleine**. La conclusion
sur `hobby` ne bouge pas — c'est la CADENCE (un tick par jour) qui disqualifie, pas la dérive — mais
l'argument est désormais celui qui tient. Voir D11.

**Le job de SANTÉ a dû passer de 6 s à 8 s, et je ne l'avais pas prévu.** Son plancher croît avec la
longueur du registre (`COUT_ETAT_MS + RESERVE_INCIDENT_MS × (n + 1)`) : l'entrée du quatrième job l'a
porté à 7 200 ms. C'est `tests/sante-job.test.ts` qui l'a signalé, et c'est exactement le mécanisme que la
6.1 avait construit — le budget est une ressource partagée, et un job qui entre renchérit le coût d'un
autre sans le toucher.

**`eligible_au_periodique` a été RÉÉCRITE, et c'est la dette de 4.10.** Le socle est le tronc gratuit
(FR-088) : il lui faut les quatre conditions de cette fonction et surtout pas la cinquième (premium).
Plutôt que d'écrire une seconde fois la clause AD-17, on a extrait `personne_joignable` et fait déléguer
l'ancien nom. Réécrire cette famille de fonctions a déjà coûté une garde entière en silence — les **cinq**
refus sont donc éprouvés un par un dans `socle-sql.test.ts`.

#### Trois choses que rien n'aurait signalées

1. **La garde du service worker accusait sa propre documentation.** Le test cherchait
   `addEventListener("fetch"` dans `public/sw.js` et le trouvait dans l'en-tête qui explique pourquoi il
   ne doit pas s'y trouver. Une garde qui rougit sur son propre commentaire pousse à l'affaiblir plutôt
   qu'à la corriger — c'est comme ça qu'on finit avec une expression si étroite qu'elle ne trouve plus
   rien. Elle scanne désormais le CODE, commentaires retirés.

2. **Le second terme de la garde de palier était intestable.** Tant que le prédicat lisait un *palier*,
   `hobby` échouait les deux conditions et `pro` les passait toutes les deux : amputer la clause de dérive
   rendait le même verdict, et le mutant survivait pour une bonne raison. Extraire
   `heureHonorable(ticks, dérive)` rend le palier hypothétique qui les sépare écrivable en une ligne.

3. **La suite entière est devenue instable, et ce n'était pas une assertion.** Deux passes complètes, deux
   fichiers DIFFÉRENTS en échec, tous deux sur *« An invalid response was received from the upstream
   server »* — un 502 de la passerelle Supabase locale, pas un test. `socle-sql.test.ts` créait
   vingt-cinq comptes dont seize ne se servaient **jamais** de leur session. Les seize
   `signInWithPassword` inutiles ont été retirés ; deux passes complètes vertes ensuite. C'est la règle
   de la 6.1a appliquée : un rouge qui ne vient pas d'un test se diagnostique, il ne se contourne pas par
   un délai plus long.

#### Ce que les tests NE prouvent PAS, et qui reste à vérifier à la main

- **Que le privacy-cover arrive avant la photo.** jsdom ne peint rien. Le test prouve que l'attribut est
  posé de façon **synchrone** (sans passer par un rendu React), ce qui est la seule chose qui rende la
  course gagnable — mais la course elle-même se vérifie sur un vrai téléphone.
- **Qu'une vraie poussée arrive.** Aucune clé VAPID n'existe encore, et la fabrique refuse de construire
  l'adaptateur réel sous Vitest (leçon 4.9/T4-3 : une suite de tests avait déjà envoyé du vrai courrier).
  Le JWT est vérifié cryptographiquement contre sa propre clé publique ; le reste est un aller-retour
  HTTP qui demande un appareil.
- **Que le manifeste s'installe sur iOS.** Les icônes existent et sont référencées ; l'installation
  elle-même se constate.

#### Campagne de mutation

**44 mutants — 43 tués, 1 survivant documenté.** 26 TypeScript (26 tués), 18 SQL (17 tués).

Deux survivants au premier passage, tous deux instructifs :

- **T17 — `reserverPoussee` acceptait tout sauf `false`.** Aucun test n'exerçait le VRAI dépôt :
  `socle-sql` appelle les RPC directement, `socle-job` double le dépôt entièrement. C'est le mutant
  identique à T7 de la 6.1a, à un fichier près. Fermé par `tests/poussee-depot.test.ts`.
- **T18 — le service worker affichait un texte non relu.** Le mutant n'avait jamais été appliqué : une
  erreur de citation dans le script de mutation. **Compté comme un non-verdict, pas comme un kill** —
  c'est précisément la faute qui avait produit sept faux morts en 6.1a. Rejoué à la main : tué.

**Le survivant, S7 — le `WITH CHECK` de l'UPDATE sur `preference_socle`.** Trois sondes ont établi que
le refus est porté par la policy de **SELECT** appliquée à la nouvelle ligne, pas par le `with check` :
c'est le *piège des défenses redondantes* du dépôt à l'état pur. Le `with check` est conservé quand même —
sans lui la propriété reposerait sur le fait que le client relit la ligne après écriture, un comportement
de bibliothèque et non une garantie de la base. Détail et tableau des sondes dans `deferred-work.md`.

⚠️ **Ce mutant a d'abord été compté TUÉ par mon propre script de rejeu**, qui acceptait n'importe quel
rouge comme un verdict. C'est la faute des sept faux morts de la 6.1a, retournée : là-bas un vrai mutant
passait pour mort à cause d'un 502 ; ici un survivant passait pour mort à cause d'un rouge transitoire. Le
rejeu isolé, qui affiche QUEL test échoue, a rendu le bon verdict.

**Deux tests de cette story étaient faux, et ce sont des mutants qui l'ont dit :**

- **S9 — un test VACUEUX.** Les quatre cas « clés refusées » fabriquaient leur endpoint à partir du
  LIBELLÉ du cas (« p256dh trop court »), donc avec des ESPACES, que la contrainte d'endpoint refuse. Les
  quatre échouaient bien — toutes pour la mauvaise raison. La contrainte de clés n'était jamais atteinte.
- **S14 — un cas manquant.** Seule une heure FUTURE était éprouvée ; `heure <=` au lieu de `heure =` ne se
  distingue de `=` que sur une heure PASSÉE. Sans ce cas, à 20 h toutes les personnes ayant choisi une
  heure antérieure auraient été poussées ensemble — l'inverse exact d'« à l'heure que tu choisis ».

La conception de la campagne a par ailleurs révélé **un trou de couverture** : rien n'éprouvait le
`delete` préalable d'`abonner_poussee`, c'est-à-dire le seul cas pour lequel cette fonction existe (deux
comptes sur un même navigateur se partagent l'endpoint, qui appartient à l'appareil). Sans elle, la
seconde personne n'est jamais notifiée et les poussées continuent d'arriver à la première. Deux tests
ajoutés.

### File List

**Créés**

- `supabase/migrations/0053_socle_quotidien_poussee.sql`
- `lib/domain/socle-quotidien.ts`, `lib/domain/copie-reglages.ts`
- `lib/poussee/port.ts`, `lib/poussee/vapid.ts`, `lib/poussee/base64url.ts`, `lib/poussee/fabrique.ts`,
  `lib/poussee/adaptateurs/web-push.ts`
- `lib/data/depot-poussee.ts`
- `lib/ordonnanceur/jobs/socle-quotidien.ts`
- `app/reglages/page.tsx`, `app/reglages/actions.ts`
- `render/reglages/Reglages.tsx`, `render/reglages/reglages.module.css`
- `render/confidentialite/CouvercleConfidentialite.tsx`, `render/confidentialite/couvercle.module.css`
- `public/sw.js`, `public/manifest.webmanifest`, `public/marque/icone-192.png`,
  `public/marque/icone-512.png`, `public/marque/icone-apple-180.png`
- `tests/socle-quotidien.test.ts`, `tests/socle-sql.test.ts`, `tests/socle-job.test.ts`,
  `tests/poussee-vapid.test.ts`, `tests/poussee-adaptateur.test.ts`, `tests/poussee-depot.test.ts`,
  `tests/poussee-architecture.test.ts`, `tests/rendu/reglages.test.tsx`,
  `tests/rendu/couvercle-confidentialite.test.tsx`

**Modifiés**

- `lib/ordonnanceur/registre.ts` (4ᵉ job ; santé 6 s → 8 s)
- `lib/domain/ordonnanceur-budget.ts` (`BUDGET_TICK_MS` 60 000 → 74 000)
- `app/api/ordonnanceur/route.ts` (`maxDuration` 60 → 74)
- `app/layout.tsx` (manifeste, apple-touch-icon, privacy-cover)
- `tests/ordonnanceur-architecture.test.ts` (plancher du 4ᵉ job)
- `_bmad-output/implementation-artifacts/PORTES-AVANT-PUBLICATION.md` (§2, troisième fait)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

| Date | Quoi |
|---|---|
| 2026-08-15 | Story écrite, tranchée (D1–D10), implémentée, mutée (44/44), déployée en cloud. D11 ajoutée en cours de dev. |
