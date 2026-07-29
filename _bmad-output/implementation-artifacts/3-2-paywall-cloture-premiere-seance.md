---
baseline_commit: 55083669fb22438b44dbc28c6db856e5ceeb0f24
---

# Story 3.2 : Le paywall à la clôture de la première séance

**Épic 3 — Devenir premium · Statut : done**

## Story

En tant qu'utilisatrice qui vient de terminer sa première séance, je veux voir une proposition
d'abonnement claire, honnête et sans pression, afin de décider librement sur un bilan déjà livré.

**Couvre :** FR-014 · FR-057 · FR-061 · FR-089 (garantie sur la carte) · rappel du périmètre gratuit
(FR-055) et premium (FR-056) sur la même carte · AD-9 (garde `limites_levees`).

**Dépend de :** Story 3.1 (la CIBLE `/api/stripe/checkout` + le prix `PRIX_ABONNEMENT_ANNUEL_CENTIMES`),
Story 2.9 (le bilan de clôture streamé + `clotureAutorisee` dans la route), Story 2.5 (`GardeCommerciale`
+ `limitesCommercialesLevees`), Story 2.2 (le fil client + le transport NDJSON).

## Acceptance Criteria

- **AC1 — Sous le bilan, dans le fil, jamais une modale.** À la clôture de la première séance (bilan
  inséré dans le fil), la carte d'abonnement apparaît **sous le bilan uniquement** (FR-014) — jamais
  pendant, jamais avant — **et s'insère dans le fil**, jamais en modale, en plein écran ni en interstitiel.
- **AC2 — Prix unique, zéro dark pattern, deux actions d'égale lisibilité.** La carte porte un **prix
  unique 69 €/an sans prix barré**, **aucun compte à rebours, aucune mention de places limitées, aucun
  bandeau d'urgence** (FR-061). Action primaire **« M'abonner »** (→ Stripe Checkout, Story 3.1) et action
  secondaire **« Pas maintenant » de lisibilité strictement égale** (même rôle typo, même taille, vrai
  bouton — aucune hiérarchie visuelle qui pousse au clic).
- **AC3 — La garantie de remboursement, écrite sur la carte.** La garantie (FR-089) est **écrite sur la
  carte elle-même**, en `{typography.meta}` à côté du prix : « si aucune branche n'a été posée au bout de
  trois mois, remboursement sur simple demande » — formulée sur un **artefact du produit**, jamais en
  termes d'état ou de résultat personnel, jamais reléguée aux conditions générales ni derrière un lien.
- **AC4 — Périmètre gratuit + premium sur la même surface, en registre système.** La carte dit sur la même
  surface **ce qui reste gratuit** (FR-055) et **ce qu'inclut le premium** (FR-056), en **registre
  système — jamais la voix d'Anam** : Anam ne vend rien.
- **AC5 — Une seule sollicitation.** « Pas maintenant » → la carte **ne réapparaît plus dans la session**
  et le produit **ne relance jamais sur minuterie** (FR-057). L'abonnement reste ensuite atteignable depuis
  le menu de compte (surface différée — voir Deferred).
- **AC6 — Garde AD-9 : rien ne se monte en détresse.** Épisode de détresse actif (`limites_levees` vrai) →
  le **bilan, la carte d'abonnement et le bandeau de quota refusent de se monter** (garde technique, pas
  règle de contenu). Aucun paywall ne s'interpose sur la sécurité, y compris et surtout sur un compte
  gratuit à quota épuisé.

## Tasks / Subtasks

- [x] **T1 — Prix affiché client-safe, COUPLÉ au prix facturé + copie en registre système (AC2, AC3, AC4).**
  - [x] NEW `render/conversation/offre-abonnement.ts` (PUR, n'importe RIEN — voir Debug Log : déplacé de `lib/domain` car `render/` ne connaît pas `lib/domain`, AD-7) : `formaterPrixAnnuel()` → « 69 € », la phrase de **garantie** (FR-089), le **périmètre gratuit** (FR-055) et le **périmètre premium** (FR-056), toutes en registre **système** (jamais signé Anam).
  - [x] TEST `tests/offre-abonnement.test.ts` : (a) COUPLAGE — le prix affiché (euros × 100) **est égal** à `PRIX_ABONNEMENT_ANNUEL_CENTIMES` de `lib/stripe/config` (jamais « affiche 69, facture 79 ») ; (b) la copie ne porte **aucun** marqueur de dark pattern (compte à rebours, « plus que », « seulement », « places limitées », « offre expire ») ni de **prix barré** ; (c) garantie + périmètre gratuit + périmètre premium présents ; (d) aucun marqueur de voix d'Anam.
- [x] **T2 — La trame `paywall` (transport pur, deux côtés) (AC1).**
  - [x] `lib/ai/flux-ndjson.ts` (serveur) : ajouter le variant `{ t: "paywall" }` à l'union émise (signal PUR — aucune donnée art. 9, aucun payload).
  - [x] `render/conversation/flux-ndjson-client.ts` (client) : ajouter `{ t: "paywall" }` à `TrameRecue` + parseur strict ; **NON terminale** (comme `bilan`/`beat`).
  - [x] TEST `tests/flux-ndjson-client.test.ts` (étendre) : `analyserTrame('{"t":"paywall"}')` → `{t:"paywall"}` ; la trame ne tombe **pas** dans le chemin terminal (ne coupe pas la lecture).
- [x] **T3 — Le gate SERVEUR : trame `paywall` retenue en détresse / si premium / sans bilan (AC6, AC1, AD-9).**
  - [x] NEW `lib/domain/proposer-abonnement.ts` (PUR) : `doitProposerAbonnement({ bilanEmis, premium })` — prédicat pur (le distress est **déjà** filtré en amont par `doitProduireBilan`, dérivé de `clotureAutorisee`).
  - [x] `app/api/anam/message/route.ts` : lire l'état premium (via `lib/data/lire-abonnement`, sous RLS/JWT) **quand `doitProduireBilan`** ; dans le stream, **après** avoir émis la trame `bilan` (structure non vide), émettre `{ t: "paywall" }` **ssi** `doitProposerAbonnement`. Jamais de paywall sans bilan (la carte s'ancre sous le bilan).
  - [x] TEST `tests/proposer-abonnement.test.ts` (pur) + garde de lecture de source route : détresse → pas de bilan → pas de paywall ; premium → bilan mais **jamais** paywall ; hors-détresse + non-premium + clore → paywall **après** le bilan (ordre).
- [x] **T4 — Le hook + l'orchestrateur : insertion du tour paywall sous le bilan, passif (AC1, AC5).**
  - [x] `render/conversation/useFluxAnam.ts` : rappel `onPaywall?()` (NON terminal, ne vole jamais le focus).
  - [x] `render/conversation/types.ts` : variant `{ role: "paywall" }` (id + `ancreId` = id du bilan).
  - [x] `render/conversation/Conversation.tsx` : `onPaywall` → insérer le tour paywall **après** le tour bilan (`insererTour`) ; handler `refuserAbonnement(id)` → retire le tour + pose un **verrou de session** (ne se réinsère plus) ; passif (composeur garde le focus).
  - [x] TEST : `insererTour` place le paywall après le bilan ; `onPaywall` dispatché sur la trame et **pas** sur `fin` ; le refus retire le tour et arme le verrou.
- [x] **T5 — La carte `CarteAbonnement` (client présentationnel) (AC1-AC4).**
  - [x] NEW `render/conversation/CarteAbonnement.tsx` : `<article>` DANS le flux (jamais modale), `fondu-texte` (neutralisé sous reduced-motion) ; prix « 69 € » sans barré ; garantie en `t-meta` à côté du prix ; périmètre gratuit + premium ; **primaire** « M'abonner » = `<form method="post" action="/api/stripe/checkout">` (redirection native 303, robuste sans JS) ; **secondaire** « Pas maintenant » = vrai bouton `onRefuser`, **lisibilité strictement égale** ; aucun compte à rebours / rareté / urgence ; anneau de focus jamais supprimé ; cibles ≥ 44 px.
  - [x] CSS dans `render/conversation/conversation.module.css`.
  - [x] TEST `tests/carte-abonnement.test.ts` : deux actions présentes ; **égalité de lisibilité** (même rôle typo `t-bouton`, aucune règle qui minore la secondaire) ; aucun élément barré ; « M'abonner » cible bien `/api/stripe/checkout` en POST ; garantie + périmètres sur la carte ; aucun marqueur de voix d'Anam.
- [x] **T6 — Évolution de la garde-tripwire + docs (AC6, dette).**
  - [x] `tests/garde-commerciale.test.ts` : la carte `CarteAbonnement` est de l'UI commerciale **gardée par le gate serveur** (trame retenue en détresse/premium) — l'ajouter à un allowlist explicite et commenté (analogue à la dérogation `app/api/**` de 3.1), en nommant la garde comportementale (`proposer-abonnement.test.ts`). La carte ne peut pas s'auto-envelopper (composant client dans un fil client streamé).
  - [x] `MontagePaywall.tsx` : rafraîchir le commentaire — la carte in-fil est livrée **client + gate serveur** (3.2) ; `MontagePaywall` reste la couture gardée pour une future surface paywall **rendue serveur** (menu de compte, 3.3+). Ses assertions 2.9 restent vertes (la carte vit ailleurs).
  - [x] `deferred-work.md` : marquer 3.2 fait ; noter le refus **persisté serveur** différé à Epic 4 (fil éphémère aujourd'hui) et la **surface menu de compte** différée.

## Dev Notes

### Périmètre exact (ce que 3.2 livre / ne livre PAS)

3.2 **complète le paywall dans la machinerie de conversation** — la carte, son câblage in-fil sous le
bilan, et le gate serveur qui la propose. La conversation elle-même **n'est montée sur aucune page**
(`app/page.tsx` rend `SceneDom` ; le fil vit dans `render/conversation/` en couture, démontré par les
tests depuis 2.2). 3.2 suit ce même patron : elle est **prouvée par tests**, pas par une page live. Le
montage de la conversation dans la scène est une intégration ultérieure (hors 3.2).

**NE livre PAS :** le montage de la conversation sur une route ; la lecture du param `?paiement=succes|annule`
au retour de Stripe (couture 3.1 `ligneRetourPaiement`, à brancher quand la conversation est montée) ; le
menu de compte (« l'abonnement reste atteignable depuis le menu de compte », AC5) ; la persistance serveur
du refus (fil éphémère — Epic 4).

### Le PIVOT d'architecture (le point à challenger)

2.9 anticipait que la carte **remplirait `MontagePaywall`** (composant SERVEUR enveloppé de
`<GardeCommerciale>`). La réalité l'en empêche, et `deferred-work.md:138` (écrit en 2.9) l'avait déjà vu :

> « Le bilan est un tour CLIENT (streamé) ; `<GardeCommerciale>` est un composant SERVEUR (lit
> `lib/safety`). L'interfoliage client/serveur sous un tour streamé est intrinsèquement couplé à la carte
> → différé avec elle. **Le verrou réel d'AC4/AC5 en 2.9 est le gate SERVEUR** (`route.ts`). »

**Résolution :** la carte est un **composant CLIENT** inséré comme tour `role:"paywall"` **après le tour
bilan** dans le fil client, déclenché par une **trame serveur `paywall`** émise **uniquement** hors-détresse
(elle suit le bilan, lui-même produit ssi `clotureAutorisee`) **et** si l'utilisatrice n'est pas déjà
premium. La garde **AD-9 de la carte = le gate serveur** : la trame est **retenue** en détresse (pas de
bilan → pas de paywall) et si premium. C'est le **même patron que la route Checkout de 3.1** (gardée
serveur, dérogée dans la tripwire, prouvée par un test comportemental) — pas la balise `<GardeCommerciale>`.

`MontagePaywall`/`<GardeCommerciale>` **restent** la couture gardée pour une future surface paywall
**rendue serveur** (menu de compte, 3.3+) : défense en profondeur, pas le chemin in-fil.

### Invariants SPINE touchés

| AD | Ce que 3.2 doit respecter |
|----|---------------------------|
| **AD-7** (modèle/rendu séparés) | `render/` **ne décide rien** : la trame `paywall` est un signal ; la décision (détresse ? premium ?) est **serveur**. Le prix/copie sont des **constantes** (pures), pas de la logique. |
| **AD-9** (garde `limites_levees`) | Verrou réel = **gate serveur** (trame retenue en détresse). La carte ne re-dérive jamais `limites_levees`. |
| **AD-2** (frontière serveur) | La carte est **client** : aucun secret Stripe, aucune `process.env`. « M'abonner » **POST** vers `/api/stripe/checkout` (3.1 confine la clé). `lib/stripe/config` reste `server-only` → la carte lit le prix depuis un module **pur** couplé par test au prix serveur. |
| **AD-17** (source unique `limites_levees`) | Le gate réutilise `clotureAutorisee` (déjà dérivé une fois dans la route) — **aucune 2ᵉ dérivation**. |
| **Data & formats** | Prix en **entiers centimes EUR** côté facturation ; l'affichage « 69 € » est **couplé par test** à `PRIX_ABONNEMENT_ANNUEL_CENTIMES`. Erreurs `{code,message}`, jamais la voix d'Anam. |
| **FR-061 / zéro dark pattern** | Prix unique, pas de barré, pas de rareté/urgence/minuterie ; secondaire d'égale lisibilité. Testé sur la copie ET la carte. |

### Patrons de code à suivre (miroir de l'existant)

| Besoin | Suivre exactement |
|--------|-------------------|
| Nouvelle trame stream | `bilan`/`beat`/`ressources` : union serveur (`lib/ai/flux-ndjson.ts`) + `TrameRecue` client + parseur strict `analyser*` (forward-compat : inconnu → `null`) ; **NON terminale** (ne pas tomber dans le `break boucle` de `useFluxAnam`). |
| Rappel de flux passif | `onBilan`/`onBeat` : NON terminal, **ne vole jamais le focus** (le composeur reste actif). |
| Insertion sous le bilan | `insererTour(prev, ancreId, "apres", tour)` (déjà utilisé pour bilan/ressources dans `Conversation.tsx`). |
| Bloc document dans le fil | `BlocDocument.tsx` : `<article className="… fondu-texte">`, `aria-label`, jamais une modale. |
| Gate serveur + garde comportementale | 3.1 `stripe-checkout-garde.test.ts` (invoque le handler, mocke les deps, prouve l'effet) + dérogation allowlist dans `garde-commerciale.test.ts`. |
| Prédicat pur + garde de lecture de source | `clotureAutorisee`/`doitProduireBilan` (route 2.9) : logique dans une constante lisible, gardée par test. |
| Constante client-safe couplée au serveur | `lib/domain/*` pur (ex. `abonnement.ts`, `retour-paiement.ts`) — jamais `server-only`. |

### Le gate serveur, précisément (route `app/api/anam/message`)

- Aujourd'hui : `clotureAutorisee = niveauSecurite === 0 && !securite.limitesLevees` ; `doitProduireBilan =
  arc?.beat === "cloture" && clotureAutorisee`.
- Ajouter : quand `doitProduireBilan`, lire `premium` (via `lib/data/lire-abonnement`, `estPremiumCourante`,
  sous JWT/RLS — jamais admin). Calculer `doitProposerAbonnement = doitProduireBilan && !premium` **avant** le
  stream.
- Dans le stream, dans le bloc `if (doitProduireBilan)`, **après** `if (structure) emettre({t:"bilan",…})` :
  `if (structure && doitProposerAbonnement) emettre({ t: "paywall" })`. **Jamais** de paywall si la
  structuration du bilan a échoué (fail-safe : pas de bilan → pas de carte, la carte s'ancre sous le bilan).
- La lecture premium ne doit **jamais** faire planter le tour (repli sûr : erreur → traiter comme non-premium
  n'est PAS sûr côté commerce ; mais l'inverse — erreur → ne pas proposer — est le repli honnête ; en cas de
  doute on **ne propose pas** la carte, cohérent avec « le doute suspend le commerce »).

### La carte (registre, copie, actions)

- **Registre système, jamais Anam** (AC4) : titres/listes autorisés (registre document, comme le bilan) ;
  aucune signature, aucun affect. La copie vit dans `lib/domain/offre-abonnement.ts` (pure), testée.
- **Garantie (AC3)** : « si aucune branche n'a été posée au bout de trois mois, remboursement sur simple
  demande » — sur la carte, en `t-meta`, **jamais** en termes d'état/résultat personnel, **jamais** derrière
  un lien/CGU.
- **Deux actions d'égale lisibilité (AC2)** : « M'abonner » (primaire, `<form>` POST natif → 303 Stripe) et
  « Pas maintenant » (secondaire, bouton `onRefuser`). Même rôle typo (`t-bouton`), même taille de cible ;
  la seule différence admise est la couleur de remplissage (primaire = accent), **jamais** la taille, la
  graisse ou la mise en retrait qui dévalorise le refus.
- **Zéro dark pattern (AC2/FR-061)** : pas de `<s>`/prix barré, pas de compte à rebours, pas de « places
  limitées », pas de bandeau d'urgence, pas de relance. Testé sur la copie ET le rendu.

### Le refus / une seule sollicitation (AC5, FR-057)

- Le fil est **éphémère en session** (aucune table de conversation — Epic 4, AD-8). La trame `paywall` est
  émise **une seule fois** (beat `cloture` idempotent : la machine d'arc ne ré-émet pas). Donc **FR-057 est
  structurellement tenu** : une seule sollicitation, aucune minuterie.
- « Pas maintenant » retire le tour paywall côté client **et** arme un **verrou de session** (défensif : si
  la trame se re-présentait, aucune ré-insertion).
- **Différé (Epic 4)** : quand le fil **persistera**, le serveur devra retenir la trame après un refus
  enregistré (sinon la carte réapparaîtrait au rechargement du bilan persisté). Aujourd'hui, rien à persister.

### Portes pré-lancement / différé (signaler, pas bloquer)

- **Surface « menu de compte »** (AC5, « l'abonnement reste atteignable depuis le menu de compte ») — différée
  (le menu de compte n'existe pas encore). `MontagePaywall` (serveur, gardé) est la couture prête pour elle.
- **Retour Stripe `?paiement=succes|annule`** — `ligneRetourPaiement` (pur, 3.1) existe ; son branchement à la
  page de conversation est différé avec le montage de la conversation.
- **Refus persisté serveur** — Epic 4 (fil persistant).
- **Réutilisation du Customer Stripe (#19, 3.1)** — inchangée ici ; à durcir avec le portail 3.5.

### Références

- Epics : `_bmad-output/planning-artifacts/epics.md` §Story 3.2 (l.727-741).
- Couture 2.9/3.1 : `deferred-work.md` l.135-138 (pivot), l.155-172 (cible checkout, retour paiement).
- Fil & transport : `render/conversation/{Conversation,Fil,useFluxAnam,flux-ndjson-client,types,BlocDocument}.tsx|ts`.
- Route & gate : `app/api/anam/message/route.ts` (l.116-165 clôture/bilan), `lib/ai/flux-ndjson.ts`.
- Garde AD-9 : `app/_commerce/{GardeCommerciale,MontagePaywall}.tsx`, `lib/safety/limites-commerciales.ts`, `tests/garde-commerciale.test.ts`.
- Abonnement (3.1) : `lib/stripe/config.ts` (prix), `lib/data/lire-abonnement.ts` (premium), `lib/domain/abonnement.ts` (`estPremium`), `app/api/stripe/checkout/route.ts` (cible).
- Design : `app/styles/tokens.ts` (`t-meta`, `t-bouton`, `fondu-texte`, cibles 44px).

## Dev Agent Record

### Debug Log

- **Correction d'architecture (AD-7) découverte en dev.** Le module de copie était d'abord posé en
  `lib/domain/offre-abonnement.ts`. Les gardes `tests/scene-architecture.test.ts` et
  `tests/arc-architecture.test.ts` interdisent à `render/` d'importer `@/lib/domain` (le rendu est
  l'adaptateur MUET). → 3 tests RED. **Fix :** la copie (prix affiché, garantie, périmètres — chrome de
  présentation, comme les libellés de boutons) est déplacée RENDER-LOCAL en
  `render/conversation/offre-abonnement.ts` (n'importe rien) ; le prix affiché reste couplé PAR TEST au
  prix facturé (`lib/stripe/config`, que le test — hors render — peut importer). `proposer-abonnement.ts`
  (prédicat de gate) reste en `lib/domain` : il n'est importé que par la ROUTE, pas par `render/`.
- **Tripwire élargie (garde-commerciale).** `render/conversation/offre-abonnement.ts` matche `abonnement`
  → la garde prospective le réclamait enveloppé de `<GardeCommerciale>` (1 test RED). La copie est de
  pures constantes (aucun JSX à envelopper) et fait partie de la surface carte gardée par le gate serveur
  → dérogation NOMMÉE élargie aux deux fichiers exacts (`CarteAbonnement.tsx` + `offre-abonnement.ts`),
  avec non-vacuité (les deux fichiers + la garde comportementale doivent exister).
- **Vert final :** `tsc` clean, `eslint` clean, `next build` OK, **895 tests / 78 fichiers verts**.

### Completion Notes

- **Pivot livré comme conçu :** carte CLIENT sous le bilan via trame serveur `paywall` ; garde AD-9 = gate
  serveur (trame retenue en détresse — pas de bilan → pas de carte — et si premium). Prouvé par
  `proposer-abonnement.test.ts` (prédicat pur + ordre d'émission bilan→paywall + lecture premium gatée).
- **Zéro dark pattern** vérifié sur la COPIE (`offre-abonnement.test.ts` : 14 marqueurs interdits, bornes de
  mot) ET la CARTE (`carte-abonnement.test.ts` : pas de barré/minuterie/rareté, deux actions `t-bouton`).
- **Prix couplé** : `69 × 100 === PRIX_ABONNEMENT_ANNUEL_CENTIMES` (6900) — jamais « affiche 69, facture 79 ».
- **A11y :** « M'abonner » = form POST natif (marche sans JS) ; « Pas maintenant » redéplace le focus vers le
  composeur (jamais `<body>`, WCAG 2.4.3) ; cibles ≥ 44 px ; anneau de focus conservé ; carte non annoncée
  (l'annonce du bilan prime — voir deferred-work.md).
- **Différé** (voir deferred-work.md §3.2) : montage de la conversation sur une page ; retour Stripe
  `?paiement=…` ; surface menu de compte ; persistance serveur du refus (Epic 4).

### File List

**Nouveaux**
- `render/conversation/offre-abonnement.ts` — copie de la carte (render-local, pure), prix couplé.
- `render/conversation/CarteAbonnement.tsx` — la carte client (présentationnel, form POST → Checkout).
- `lib/domain/proposer-abonnement.ts` — prédicat pur du gate de proposition.
- `tests/offre-abonnement.test.ts`, `tests/proposer-abonnement.test.ts`, `tests/carte-abonnement.test.ts`.

**Modifiés**
- `lib/ai/flux-ndjson.ts` (+ trame `paywall`), `render/conversation/flux-ndjson-client.ts` (+ parseur).
- `render/conversation/{types.ts,useFluxAnam.ts,Conversation.tsx,Fil.tsx,conversation.module.css}`.
- `app/api/anam/message/route.ts` (lecture premium gatée + émission `paywall` sous le bilan).
- `app/_commerce/MontagePaywall.tsx` (commentaire du pivot — code inerte inchangé).
- `tests/{flux-client.test.ts,garde-commerciale.test.ts}`.
- `lib/domain/README.md`, `_bmad-output/implementation-artifacts/deferred-work.md`.

### Revue adversariale (AI) — 3.2

Workflow 7 dimensions (finders Sonnet → réfutation Opus) : 31 trouvailles brutes → 25 retenues (dédupliquées
en ~8 défauts distincts). Corrigées + **mutation-vérifiées** (chaque garde cassée → test RED → restauré) :

- **HAUTE — `lire-abonnement.ts` avalait l'erreur PostgREST.** `estPremiumCourante()` ignorait `error` et
  renvoyait `false` sur panne (postgrest-js ne LÈVE pas, `shouldThrowOnError=false`) → le repli « le doute
  suspend le commerce » de la route ne s'engageait JAMAIS → une abonnée premium pouvait voir la carte sur une
  erreur DB transitoire. **Fix :** lire `error` + relancer (miroir de `depot-abonnement`) + test comportemental
  (erreur → lève ; absence normale → non premium sans lever). Mutation-vérifié.
- **HAUTE — dérogation tripwire sur BASENAME.** `estCarteGardeeParGateServeur` matchait le seul nom de fichier
  → un futur homonyme (surface paywall serveur `app/.../compte/CarteAbonnement.tsx`) aurait été auto-exempté de
  `<GardeCommerciale>` (angle mort AD-9). **Fix :** ancrage au chemin exact `render/conversation/` + contrôle
  négatif fermant l'angle mort. Mutation-vérifié.
- **MOYENNE — `reessayer()` laissait bilan/carte orphelins.** Un tour de clôture échouant APRÈS avoir émis
  bilan+carte laissait ceux-ci dans le fil → double au rejeu. **Fix :** `ancreId` sur les tours bilan+paywall,
  purgés avec leur tour d'Anam (patron ressources 2.6 R2). Ferme aussi le trou latent 2.9.
- **MOYENNE — gardes de source route renforcées.** Couplage exigé à la VALEUR (`bilanEmis: !!structure, premium`)
  et lecture premium prouvée DANS le bloc `if (doitProduireBilan)` — plus la seule présence de clés. Mutation-vérifié.
- **MOYENNE — égalité de lisibilité prouvée par le CSS** (la primaire ne change QUE la couleur, jamais taille/
  graisse/échelle) ; **BASSE — contrôle POSITIF anti-dark-pattern** (canari de non-vacuité) ; **BASSE —**
  commentaires `lib/domain/offre-abonnement` → `render/conversation/offre-abonnement`.

**Résiduels réels, différés avec raison** (voir `deferred-work.md` §revue 3.2) : concurrence du writer de séance
(arc) — PRÉEXISTANT 2.7/2.9, correction propre = writer à écrivain unique, story dédiée ; arc persisté en `clore`
avant génération (ré-émission du bilan au rejeu) — 2.9 ; CSRF du POST natif Checkout — atténué par cookies
`SameSite=Lax` (POST cross-site → pas de cookie → 401), effet max = session Checkout sans débit.

## Change Log

| Date | Version | Description |
|------|---------|-------------|
| 2026-07-29 | v0.1 | create-story — contexte engineeré (archéologie in-first du fil client, du transport NDJSON, du gate 2.9, de la couture 3.1). Pivot d'architecture documenté (carte client + trame serveur, pas `MontagePaywall`). |
| 2026-07-29 | v1.0 | dev-story (TDD T1→T6) — trame `paywall`, gate serveur (prédicat pur + lecture premium gatée), carte client (form POST → Checkout, deux actions d'égale lisibilité, garantie/périmètres, zéro dark pattern), insertion sous le bilan + refus session, tripwire élargie. Correction AD-7 : copie déplacée `lib/domain` → render-local (Debug Log). 895 tests / tsc / eslint / build verts. Statut → review. |
| 2026-07-29 | v1.1 | Revue adversariale (7 dim., 31→25 trouvailles) + corrections mutation-vérifiées : 2 HAUTES (repli premium `lire-abonnement` ; ancrage dérogation tripwire), 3 MOYENNES (orphelins bilan/carte au rejeu ; gardes de source route ; égalité de lisibilité par CSS), 2 BASSES (canari dark-pattern ; commentaires). Résiduels différés avec raison (concurrence writer séance ; CSRF atténué SameSite). 901 tests / tsc / eslint / build verts. |
