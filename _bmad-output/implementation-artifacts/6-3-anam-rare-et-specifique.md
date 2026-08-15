---
baseline_commit: e07756f
---

# Story 6.3 : Anam rare et spécifique

Status: review

## Story

En tant qu'utilisatrice,
je veux qu'Anam ne se manifeste que lorsqu'elle a vraiment quelque chose à me dire — et que ce
quelque chose soit là quand j'ouvre —,
afin que sa parole garde sa valeur, et que je n'aie jamais à me demander si ça valait le geste.

**Couvre :** FR-034, FR-035 · AD-9, AD-15, AD-17 · renvoi FR-031, FR-032, FR-033, FR-066, NFR-015.
**Ne couvre PAS :** FR-036 (proposer une pause) — c'est la Story 6.4, et ça vit en conversation.

---

## Ce que cette story livre, en une phrase

L'ensemble **fermé** des motifs d'Anam, déclaré en un seul endroit ; **aucun canal nouveau** ; le
refus du soir posé avant toute réservation ; et la seule chose qui manquait vraiment — **la
garantie qu'une manifestation d'Anam n'est jamais vide à l'arrivée**, parce que ce qui l'annonce et
ce qui l'affiche dérivent de la même source.

---

## ⚠️ CETTE STORY N'ÉMET RIEN DE NOUVEAU, ET C'EST SA THÈSE

Trois conceptions ont été écrites puis soumises à un critique adversarial qui a vérifié chaque
affirmation dans le code. **Les trois ont été réfutées**, et leurs objections convergent :

**1. La poussée ne peut structurellement rien dire de spécifique.** L'adaptateur consomme le motif
sans l'utiliser (`void motif;`), le POST fait zéro octet, le service worker ne lit jamais
`evenement.data` et choisit son texte par index du jour, et le `tag` est fixe — un second motif
**remplacerait silencieusement** la notification du socle. Rendre l'aperçu spécifique demande soit
le chiffrement RFC 8291, soit un `fetch` depuis le service worker : une réouverture d'architecture,
pas un réglage.

**2. Et la discrétion promise en échange serait vide.** L'argument « une poussée d'Anam se noie
parmi celles du socle » suppose que le socle émette. Sur le palier `hobby`, `palierHonoreLHeure()`
le fait taire — **une poussée d'Anam serait donc le seul signal**, parfaitement identifiable par
quiconque regarde l'écran verrouillé. Il n'y a rien où se noyer.

**3. Un motif de plus classé `anam` ferait taire la synthèse.** Le plafond est compté **par
famille** en SQL, sous verrou consultatif. Une proposition de branche poussée lundi tuerait le
courriel de synthèse mardi. AD-15 tranche : le repli va vers **moins** d'effet.

**4. Un cinquième job rouvrirait toute la chaîne budgétaire.** `margeHorsDelais(5) = 12 800`, le
plancher du job de santé passerait de 8 000 à 8 400, `BUDGET_TICK_MS` et le littéral `maxDuration`
devraient monter dans le même commit. Pour annoncer en six mots génériques une proposition qui ne
périme jamais et qu'Anam dira elle-même à la prochaine ouverture.

**Ce que la 6.3 livre à la place** est ce que les trois critiques ont désigné comme le vrai trou :
aujourd'hui, **une annonce peut arriver sur un écran où l'application ne montrera rien**.

---

## Décisions

### D1 — Aucun canal nouveau, et c'est vérifiable

`MOTIFS_POUSSEE.length === 1` reste **vert**. Aucun motif ajouté au CHECK SQL, aucune branche
ajoutée à `famille_motif`, `reserver_notification` **pas ouverte**. `REGISTRE.length` reste à 4,
donc `BUDGET_TICK_MS = 74 000`, `maxDuration = 74`, le plancher du job de santé et `vercel.json`
sont intouchés — la chaîne `Σ delaiMs + margeHorsDelais(n) ≤ BUDGET_TICK_MS ≤ PLAFOND_DUREE_MS`
n'est pas rouverte.

Le troisième motif de l'ensemble fermé — **la proposition de branche** — existe, il est déclaré, et
il vit **in-app uniquement**. C'est une décision écrite, pas une omission : elle n'a rien d'urgent
(le signal reste `en_attente` indéfiniment) et sa spécificité ne tient pas en six mots.

### D2 — L'ensemble fermé est déclaré UNE fois, et le refus est le défaut

`lib/domain/regime-anam.ts` porte les trois motifs, leur canal, et leur priorité. Un motif absent
de l'ensemble est **refusé**, pas ignoré. Aujourd'hui la vérité est éparpillée : deux littéraux
`MotifCourriel`, un CHECK SQL, une fonction `famille_motif`, et rien qui dise « ces trois-là, et
pas un de plus ».

### D3 — La spécificité vit dans l'app, et elle est VRAIMENT spécifique

C'est l'objection qui a tué la première conception, et elle était juste : sa carte d'accueil
recopiait **mot pour mot** le corps du courriel. Une fois connectée, l'utilisatrice n'apprenait donc
rien de plus que sur son écran verrouillé — la story ne livrait pas la moitié qui la justifie.

La carte porte donc **ses mots à elle** : pour une échéance, l'intention qu'elle a formulée
(« si X, alors Y ») ; pour une synthèse, la période qu'elle couvre ; pour une proposition, la
branche concernée. Le tabou de l'interpolation a été écrit pour ce qui **sort** du produit — l'app
affiche déjà le « si » et le « alors » verbatim dans le plan d'étapes, derrière l'authentification.

### D4 — AD-17 est porté par le SQL, jamais par TypeScript

La lecture in-app doit refuser pendant un épisode de détresse et sa fenêtre de 72 h, **exactement
comme le canal sortant**. Deux remèdes ont été examinés :

| | |
|---|---|
| `personne_joignable` (0053) | ❌ — porte la détresse, mais exclut aussi le premium et le consentement art. 9 sortants. Elle sélectionnerait des personnes à qui l'app ne montrerait rien. Elle est faite pour l'**envoi**, pas pour l'affichage. |
| `branche_bloquee_par_detresse()` (0010) | ✅ — keyée `auth.uid()`, `grant execute … to authenticated`, et c'est **déjà** ce que porte `charger_proposition_branche`, la seule autre parole in-app d'Anam. |

La migration **0054** ajoute une fonction de lecture `security invoker` qui porte cette clause. Le
« zéro migration » de la conception d'origine était faux, et le critique avait raison de le dire.

### D5 — Le motif in-app ne se lit PAS sur `chargerOuverture`

`chargerOuverture` est un **arbitrage à quatre sorties**, pas un détecteur d'existence : il rend
`socle-complete` d'abord, puis l'hypothèse d'ennéagramme, puis `null` **avant même de lire le
germe** si le compte n'est pas premium, puis éventuellement `invitation`. Dans ces quatre cas le
signal reste `en_attente` — le motif existe — et une carte branchée là-dessus resterait muette.

Le motif se lit donc sur **le signal lui-même**. Et la carte ne met **jamais un « je » dans la
bouche d'Anam** : la région Anam dit déjà « Il s'est passé quelque chose hier », et deux voix pour
un même événement, dont l'une invente une intimité que l'autre évite, est un défaut de copie.

### D6 — Le refus du soir vit dans `notifier`, et la signature change

La première conception plaçait un `return` « dans le bloc d'annonce » du job de synthèse. Il y a
**deux chemins d'annonce** dans une seule fonction : un `return` dans le bloc de rattrapage sort du
**job entier** et supprime la production. La garde vit donc dans `notifier`, dont la signature gagne
l'instant — et ses deux appelants avec. Ce n'est pas « +5 lignes », et le dire faux aurait produit
un job qui cesse de produire les synthèses du soir.

Le créneau est **fail-closed** et ses bornes sont posées **loin de l'heure de tir** (07 h/08 h
Paris) : une borne pile sur l'heure de tir ferait dépendre l'émission de la dérive de planification
(±59 min sur `hobby`) — la leçon de la 6.2, où j'avais d'abord mal raisonné sur cette dérive.

**Asymétrie assumée, à écrire dans le code** : la synthèse refusée le soir est rattrapée sur 3 jours
(`syntheses_non_annoncees`) ; le rappel d'échéance, lui, est **perdu** (l'échéance est strictement
« aujourd'hui », rien n'est rattrapé). C'est voulu — un rappel à 22 h est un reproche à l'heure du
coucher. Sans ce commentaire, quelqu'un « réparera » ça avec une file d'attente.

### D7 — La garde anti-relance balaie la source PRIVÉE DE SES COMMENTAIRES

AC5 interdit toute relance de réengagement. La garde cherche `derniere_connexion|inactif|
reengagement|tu nous manques|reviens` — et le mot « reviens » est **déjà présent, en commentaire**,
dans le fichier qui explique pourquoi il est interdit. C'est exactement le mode d'échec payé en 6.2
(`sansCommentaires`, né d'un rouge sur `addEventListener("fetch"` trouvé dans son propre en-tête).

### D8 — La borne UX-DR-30 compte les objets RENDUS

La carte d'Anam ne rejoint **pas** `CATALOGUE_CARTES` — non pour la raison invoquée d'abord (elle
était mécaniquement fausse : `cleCarteDuJour` ne tourne que sur les cartes `estPresentable`), mais
parce que la carte d'Anam n'a ni fait calculé ni texte d'Anima, et que le repli « Anima n'a pas
encore écrit cette carte » n'a aucun sens pour elle.

Mais alors la borne « 4 à 6 objets » est **mesurée sur 5 pendant qu'on en rend 6** : une sixième
carte de catalogue livrerait 7 objets avec un build vert. La garde compte donc désormais les objets
rendus, pas le catalogue.

### D9 — `anam` vit sur `ResultatBibliotheque`, pas sur le domaine pur

Ajouter un champ requis à `Bibliotheque` casse la compilation dans le fichier même qu'on modifie
(`assemblerBibliotheque` rend deux littéraux sans lui). Et surtout : le domaine pur se mettrait à
déclarer un champ qu'il ne sait pas produire. `ResultatBibliotheque` est déjà l'endroit où `jour`
vit — c'est là que `anam` va.

### D10 — « La branche concernée » est IMPOSSIBLE, et l'AC6 est amendée

L'AC6 d'origine annonçait, pour la proposition, une ligne nommant « la branche concernée ». La table
le refuse : `signal_reconceptualisation` (0020) ne référence qu'une `entree_journal_id` — **il n'y a
pas de branche à nommer**, puisque la proposition consiste précisément à en ouvrir une. Et la seule
chose nommable de ce côté serait son verbatim de journal, que la 4.5 refuse de faire traverser.

Chaque motif est donc spécifique **de la façon dont il peut l'être**, jamais par un littéral
identique pour tout le monde : l'échéance porte **ses mots** (le « si » et le « alors » qu'elle a
écrits), la synthèse porte la **date de fin** de la période racontée, la proposition porte le **jour**
où quelque chose est venu. AC6 est réécrite en conséquence — l'ambition n'est pas réduite, elle est
rendue vraie.

### D11 — `jourLisible` n'utilise AUCUN `Date`, et c'est ce qui la rend prouvable

La première version reprenait le patron de `periodeLisible` : un `Date` ancré à midi, plus un
`timeZone` explicite. Deux défenses du même invariant — et **aucun test ne pouvait distinguer leur
contribution**, chacune couvrant la panne de l'autre. C'est exactement le piège payé en 4.7 puis
retrouvé en 4.9.

Or l'entrée est une colonne `date` : **une date civile n'est pas un instant**, et la convertir en
instant pour la reformater est précisément le geste qui fait basculer un jour. La fonction lit donc
`YYYY-MM-DD` au motif, et rend `null` sur tout le reste. Il n'y a plus qu'une seule chose à prouver,
et les douze mois se vérifient d'un coup.

### D12 — La carte n'apparaît pas : elle est TOUJOURS là

Une carte qui apparaît quand Anam a quelque chose à dire **est une pastille**, simplement dessinée
avec la carte au lieu d'un point rouge. Le champ `anam` est donc **requis** sur `BibliothequeVue`, la
carte est rendue en toutes circonstances, et la seule différence entre « rien » et « quelque chose »
est **une ligne de texte en plus**. Un test compare les deux rendus attribut par attribut : aucune
classe ne s'allume, aucun accent ne change. Un accent qui s'allume serait un badge sans le mot.

---

## Acceptance Criteria

### AC1 — L'ensemble est fermé, et tout le reste est refusé

**Étant donné** le régime d'Anam, **quand** aucun des trois motifs n'existe — proposition de branche
le lendemain d'une reconceptualisation, échéance d'une intention formulée par l'utilisatrice,
synthèse périodique prête —, **alors** Anam n'émet **rien**, **et** tout motif hors de l'ensemble
est **refusé par défaut** (jamais ignoré en silence), **et** l'ensemble est déclaré en **un seul
endroit** dont les trois vérités existantes (`MotifCourriel`, le CHECK SQL, `famille_motif`) sont
prouvées être le miroir.

### AC2 — Au plus une par 72 h, et jamais le soir

**Étant donné** les deux jobs qui émettent, **quand** ils s'exécutent, **alors** le plafond de 72 h
reste celui que **SQL** applique par famille (aucun compteur maison en TypeScript — deux horloges
pour une promesse est le défaut qu'AD-17 nomme), **et** aucune émission ne part hors du créneau
diurne de Paris, **et** le refus survient **avant** toute réservation (refuser ne consomme rien),
**et** une garde vérifie sur 70 jours que le cron déclaré dans `vercel.json` tombe dans le créneau,
changement d'heure compris.

### AC3 — L'aperçu ne porte jamais la spécificité, et c'est prouvé

**Étant donné** les objets de courriel et l'aperçu de poussée, **quand** les gardes s'exécutent,
**alors** chaque objet fait **≤ 6 mots**, **et** aucun ne contient de racine du lexique interdit
d'aperçu, **et** aucun n'est interpolé (aucun `${`), **et** l'aperçu de poussée reste exactement
celui de la 6.2 — impersonnel, jamais signé d'Anam.

### AC4 — Le rappel porte sur SON objectif, jamais sur sa connexion

**Étant donné** une échéance d'intention, **quand** Anam la rappelle, **alors** le contenu porte sur
**l'intention qu'elle a formulée**, **et** aucun fichier du chemin de notification ne sélectionne
sur une date de dernière ouverture ni ne contient de vocabulaire de réengagement — **la garde
balayant la source privée de ses commentaires**.

### AC5 — Une semaine sans ouverture ne produit rien

**Étant donné** un compte inactif depuis sept jours sans qu'aucun des trois motifs n'existe,
**quand** l'ordonnanceur passe, **alors** **aucune** notification n'est émise, **et** aucun
mécanisme du dépôt ne peut en produire une (prouvé par la garde d'AC4, sur faux).

### AC6 — La carte « Anam » de l'accueil : neutre, puis spécifique

**Étant donné** l'accueil, **quand** aucun motif n'existe, **alors** la carte d'Anam est **neutre** —
sans pastille, sans compteur, sans chiffre, y compris dans ses attributs d'accessibilité (FR-031) ;
**quand** un motif existe, **alors** elle porte **exactement une** ligne secondaire, **et** cette
ligne est **spécifique** — les **mots** de son intention, la **date de fin** de la période racontée,
le **jour** où quelque chose est venu —, jamais un littéral identique pour tout le monde, **et** la
carte est rendue dans les deux cas (voir D10 et D12).

⚠️ **Amendée en cours d'implémentation** : la version d'origine promettait « la branche concernée »
pour la proposition. C'est impossible — il n'existe pas encore de branche à ce moment-là, et la seule
chose nommable serait son verbatim de journal, que la 4.5 refuse de faire traverser. Décision D10.

### AC7 — La détresse ferme la porte in-app comme elle ferme le canal

**Étant donné** une utilisatrice en épisode de détresse ou dans sa fenêtre de 72 h, **quand**
l'accueil se charge, **alors** la carte d'Anam est **neutre**, **et** ce refus est porté **par le
SQL** (`branche_bloquee_par_detresse()`), pas par une condition TypeScript, **et** un test le prouve
en base contre le vrai Postgres.

### AC8 — Ce qui est annoncé est là à l'arrivée

**Étant donné** une notification d'Anam émise pour un motif, **quand** l'utilisatrice ouvre
l'application, **alors** ce motif est **visible** — parce que l'annonce et l'affichage dérivent de
la **même** source, et qu'une garde le prouve plutôt que de l'espérer.

### AC9 — Rien d'autre n'a bougé

**Étant donné** la suite complète, **quand** elle s'exécute après `supabase db reset`, **alors** tout
est vert, **et** `MOTIFS_POUSSEE.length === 1`, **et** `REGISTRE.length === 4`, **et**
`BUDGET_TICK_MS === 74_000`, **et** `reserver_notification` est **inchangée octet pour octet**.

---

## Tasks / Subtasks

- [x] **T1 — La story** (ce fichier)
- [x] **T2 — `lib/domain/regime-anam.ts`** : l'ensemble fermé, les canaux, la priorité, le créneau
      diurne. Pur, sans I/O (AD-1).
- [x] **T3 — Migration 0054** : la fonction de lecture du motif in-app, `security invoker`, portant
      `branche_bloquee_par_detresse()`. **Aucun motif ajouté, `reserver_notification` non ouverte.**
- [x] **T4 — Le créneau du soir** dans `notifier` (signature + deux appelants) et dans le job de
      rappel, avant toute réservation, avec l'asymétrie de rattrapage écrite dans le code.
- [x] **T5 — La carte « Anam »** : dépôt, `ResultatBibliotheque`, composant, copie spécifique.
- [x] **T6 — Les gardes** : ensemble fermé miroité sur les trois vérités existantes, ≤ 6 mots +
      lexique + pas d'interpolation, anti-relance sur source décommentée, créneau vs `vercel.json`
      sur 70 jours, borne UX-DR-30 sur les objets rendus, carte neutre sans chiffre.
- [x] **T7 — Vérification et mutation** : `db reset`, suite complète, `tsc`, `eslint`, `next build`,
      puis campagne de mutation ciblant chaque garde nouvelle **séparément**.
- [x] **T8 — Les documents** : `deferred-work.md`, `sprint-status.yaml`, et la porte de publication
      si l'implémentation en découvre une.

---

## Dev Notes

**Ce qui ne doit sous aucun prétexte être touché :** `reserver_notification` (sa réécriture en 4.10
a silencieusement rouvert le trou de désabonnement de 0034, et aucun test de texte ne protège ses
clauses) ; le CHECK de `notification_envoyee.motif` ; `famille_motif` ; `public/sw.js` ;
`lib/poussee/**` ; le registre de jobs et toute la chaîne budgétaire.

**Deux homonymes à ne pas confondre :** `lib/safety/lendemain.ts` est le lendemain d'un **épisode de
détresse** (FR-045, 36 h, niveau ≥ 2), pas le lendemain d'une **reconceptualisation**. Et
`personne_joignable` n'est pas `eligible_au_periodique` — le second exige en plus le premium.

**Le plafond de 72 h n'est pas à construire.** Il existe, en SQL, sous verrou consultatif, compté
par famille. `PLAFOND_NOTIFICATION_HEURES = 72` vit dans `lib/domain/synthese.ts` et les deux
appelants le passent déjà.

---

## Dev Agent Record

*(à remplir)*

### Change Log

| Date | Ce qui a changé |
|---|---|
| 2026-08-15 | Story créée après un atelier de trois conceptions **toutes réfutées** par un critique adversarial. La story retient la colonne vertébrale validée (« ne rien émettre de plus ») et corrige les sept objections. |

---

## Dev Agent Record — ce qui a été fait, et ce que ça a coûté

### Vérification

`supabase db reset` 0001→0054 · `npx tsc --noEmit` · `npx eslint .` · `npx next build` ·
**239 fichiers / 3999 tests verts**.

### Campagne de mutation — 44 mutants, 43 tués, 1 équivalent documenté

| Lot | Mutants | Tués | Ce qu'ils éprouvent |
|---|---|---|---|
| T4 — le créneau | 16 | 15 | les deux chemins d'annonce, les bornes, le fuseau, le cycle horaire, l'arbitrage |
| T5/T6 — la carte et les gardes | 25 | 25 | le fail-closed, la date civile, le rognage, le câblage dépôt→carte, les miroirs, l'aperçu, l'anti-relance, le cron |
| SQL — la migration 0054 | 4 | 4 | AD-17 sur les trois branches, `=` vs `<=`, « le lendemain », la fenêtre de 3 jours |

**Le survivant** (`en-GB` → `en-US` dans `heureParis`) est équivalent une fois `hourCycle` épinglé —
et sa découverte a corrigé une affirmation FAUSSE que j'avais écrite en commentaire : la locale ne
protégeait pas du « 24 » à minuit. C'est `hourCycle: "h23"` qui le fait, et il est désormais écrit
plutôt qu'espéré. Les deux mutants qu'il a fait naître (`h24`, `h12`) sont tués.

### Trois corrections de mes propres affirmations

1. **`service_role` peut appeler `motifs_anam_du()`** — j'avais annoncé l'inverse sur une mesure
   antérieure au `db reset`. Ce qui ferme la porte est `security invoker` + `auth.uid()`, pas le
   grant, et c'est une propriété plus forte.
2. **`hour12: false` ne dépend pas de la locale** depuis ECMA-402 2021 ; `hourCycle` est maintenant
   explicite.
3. **`jourLisible` n'utilise aucun `Date`** — la version d'origine avait deux défenses (ancre à midi
   + `timeZone`) dont aucun test ne pouvait distinguer la contribution.

### Ce que les gardes du dépôt m'ont attrapé

- Une **référence morte** : j'avais cité `tests/motifs-anam-sql.test.ts` dans un commentaire avant de
  l'écrire.
- Un **`comment on function`** qui nommait, dans sa propre chaîne, les trois choses que 0054
  s'interdit de toucher — le mode d'échec de la 6.2 rejoué en SQL.
- La déclaration `readonly objet: string;` de l'interface `Gabarit`, que la garde d'interpolation
  prenait pour une affectation.
