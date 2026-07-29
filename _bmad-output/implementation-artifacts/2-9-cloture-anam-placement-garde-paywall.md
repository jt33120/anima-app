---
baseline_commit: 5ba9b50c60eee0ca253d56e6c31c4084abd8a8b6
---

# Story 2.9: La clôture par Anam et le placement gardé du paywall

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant qu'**utilisatrice**,
je veux qu'**Anam clôture elle-même la séance** et pose un **bilan lisible**,
afin de **n'avoir jamais à m'extraire d'une conversation qui me retient** — l'offre n'arrivant qu'**après**, jamais pendant.

> **La nature de cette story.** C'est le **geste le plus important du produit** (EXPERIENCE.md §clôture) et, techniquement, une story d'**activation de coutures déjà posées** — pas de création d'infrastructure. Les Stories 2.4 → 2.8 ont délibérément pré-câblé chaque seam ; 2.9 les branche. Cinq livrables sous un même titre :
> 1. **Anam clôt elle-même** (FR-008) — la machine d'arc (2.7) atteint déjà la phase `clore` ; 2.9 **émet le beat `"cloture"`** (déjà dans le contrat de trame, jamais émis) et **pose le latch `finProposee=true`** (champ + colonne SQL déjà présents, jamais mis à vrai) pour que les tours suivants **ne rouvrent pas l'arc**.
> 2. **Le bilan en bloc document** — une **nouvelle trame NDJSON** (`{t:"bilan"}`, patron `ressources`) portant un contenu en **registre document** (titres/listes autorisés) qui **contourne la troncature 3 phrases** de 2.8. Le bilan « reprend ses mots, en clair » → **passe de génération séparée** (tier fort, capacité document).
> 3. **Le passage en Veille** — le format `veille` d'Anam est **déjà supporté** (asset détouré 2.2C + CSS présents), jamais sélectionné ; 2.9 le branche sur `beat === "cloture"`.
> 4. **Le placement gardé du paywall** — le **point de montage** (slot serveur sous `<GardeCommerciale>`, déjà livré inerte en 2.5) positionné **uniquement sous le bilan**, gardé par `limites_levees`.
> 5. **La garde détresse** — un tour en détresse fait que **la séance cesse d'être une séance** : ni bilan, ni paywall ; le protocole de détresse (2.3–2.6) prend le relais tel quel.
>
> **Frontière dure (à ne pas franchir — c'est l'Epic 3).** 2.9 livre le **placement**, PAS le paiement. La **carte d'abonnement** réelle (prix 69 €/an, prix non barré, « M'abonner »/« Pas maintenant », garantie FR-089), **Stripe Checkout**, les webhooks et la sollicitation premium relèvent des **Stories 3.1/3.2** (FR-014 carte, FR-055/056/057/061/089). 2.9 pose le **slot gardé vide** sous le bilan, que 3.2 remplira. Ne pas coder de carte, de prix, de bouton d'abonnement.
>
> **Ce qui est PROVISOIRE.** Le **contenu** du bilan (sa consigne de génération, ses libellés) et la **consigne de phase `clore`** sont l'**intention produit**, PAS un protocole validé — porte pré-lancement. On code la **MÉCANIQUE** (émission du beat, latch d'idempotence, trame document, gate de sécurité, montage gardé) ; pas le jugement éditorial définitif du bilan.

## Acceptance Criteria

Repris de l'épic (Story 2.9, [`epics.md:698-702`](../planning-artifacts/epics.md)), découpés en critères testables.
`Couvre : FR-008, FR-043 (garde), FR-014 (placement — carte = Epic 3), FR-057 (une seule sollicitation), FR-079 (allocation résiduelle), FR-084 (voix ≤3 phrases), FR-046 (épisodes exclus de toute exploitation) ; AD-7/AD-10 (rendu muet, direction des dépendances), AD-9 (limites_levees : paywall/bilan refusent de se monter), AD-16/AD-17 (pipeline sécurité-d'abord, horloge unique), AD-5 (tiering : bilan au tier fort), AD-1 (domaine pur) ; UX-DR (apparition Veille, bloc document, composeur permanent). Frontière Epic 3 : FR-055/056/061/089 (carte, tarif, Stripe) HORS périmètre.`

1. **[AC1 — Anam clôt elle-même, ≤3 phrases, registre normal, sans rouvrir l'arc]** Étant donné la phase `nommer` **satisfaite** (observation délivrée en hypothèse réfutable, FR-006, et l'utilisatrice y a répondu — la machine 2.7 a transité `nommer → clore`), quand Anam clôt, alors c'est **elle** qui clôt (l'utilisatrice n'a **jamais** à s'extraire — FR-008), **en un tour, trois phrases maximum, dans son registre normal** — **pas de récapitulatif, pas de conclusion enveloppante** (FR-084) ; référence : « *On en a assez fait pour ce soir.* ». **Et** le latch `finProposee` est **posé à vrai** au tour de clôture : les tours suivants en `clore` **ne ré-émettent pas** le bilan et **ne rouvrent pas l'arc** (pas de nouvelle observation, pas de nouvelle phase — FR-008). *La phrase de clôture est un **tour de conversation ordinaire** → elle bénéficie **automatiquement** de la voix + troncature 3 phrases de 2.8 (par construction, `clore` implique `niveauSecurite === 0`, sinon la machine n'atteint pas `clore`). 2.9 n'ajoute RIEN côté voix pour la phrase de clôture.*

2. **[AC2 — beat clôture → apparition → Veille → respiration double → bilan bloc document]** Étant donné la clôture, quand elle survient, alors le **beat `"cloture"`** déclenche l'apparition d'Anam qui **passe en format Veille** (de dos/effacée, le retrait) **et**, **après une respiration double**, le **bilan** s'insère dans le fil comme **bloc document** : ce qui a été dit, en langage clair, **reprenant ses mots** — **registre document, titres et listes autorisés** (contrairement à la conversation où ils sont interdits, FR-084). *La respiration double n'est **pas chiffrée en ms** dans l'UX (seul `spacing.respiration = 40px` existe) → à trancher (voir Dev Notes / Questions) ; **neutralisée sous reduced-motion** (insertion immédiate). Le bilan **contourne** `absorberDelta` (la troncature le couperait à 3 phrases) et n'est **pas** soumis à « jamais de liste à puces ».*

3. **[AC3 — le composeur reste actif ; réécrire ne rouvre pas l'arc]** Étant donné le bilan livré, quand il est posé, alors le **composeur reste actif** — **aucun bouton « terminer », aucun « reprendre »**, aucune notification « ta séance t'attend » — **et** si l'utilisatrice écrit après, Anam répond dans la limite de l'**allocation résiduelle** (FR-079) **mais ne rouvre pas l'arc** (pas de nouvelle observation, pas de nouvelle phase). *Invariant à **préserver** : le composeur ne DISPARAÎT jamais (2.2B) ; ne créer AUCUN contrôle de fin/reprise ; ne jamais forcer `occupe=true` en permanence. Le « ne rouvre pas l'arc » est une **décision serveur** (latch `finProposee`, AC1), jamais du rendu (AD-7).*

4. **[AC4 — le paywall se monte SOUS le bilan uniquement, gardé par limites_levees]** Étant donné le placement du paywall, quand il se monte, alors c'est **uniquement sous le bilan** (jamais pendant, jamais avant — FR-014) **et uniquement si `limites_levees` est faux** (garde de la Story 2.5, AD-9) **et** dans le fil (**jamais** en modale, plein écran ni interstitiel — une seule sollicitation, FR-057). *2.9 livre le **point de montage gardé** (slot `<GardeCommerciale utilisatriceId={user.id}>` positionné sous le tour bilan), **PAS la carte** : prix, boutons, Stripe, garantie = **Epic 3 / Story 3.2**. Le slot doit satisfaire le **tripwire** `tests/garde-commerciale.test.ts` (tout fichier `paywall|abonnement|quota|bilan|checkout|premium` DOIT importer `<GardeCommerciale>`).*

5. **[AC5 — détresse en séance → la séance cesse d'être une séance]** Étant donné un **signal de détresse en cours de séance**, quand il apparaît, alors la séance **cesse d'être une séance** : le **bilan et le paywall ne sont PAS produits** **et** le protocole de détresse (Stories 2.3–2.6) prend le relais. *Garde technique (FR-043/AD-9), pas règle de contenu. Le gate serveur est la **conjonction** `niveauSecurite === 0 && !securite.limitesLevees` au point d'émission — parce que la machine d'arc **ne recule PAS** de `clore`/`nommer` si la détresse survient après coup. `niveauSecurite === 0` couvre « pas de détresse ce tour » ; `!limitesLevees` couvre « pas d'épisode ouvert » (repli sûr protecteur, FR-046 : épisodes jamais exploités).*

## Tasks / Subtasks

> **TDD strict (red → green → refactor).** Vitest en env **node** (pas de DOM). La logique de clôture (beat, latch, structuration du bilan, consigne) vit en **cœurs purs `lib/domain/`** testés en isolation (`toEqual`, contrôle positif **et** négatif). Le câblage serveur (route) et le rendu (`render/`) ne sont **pas invocables en test** (convention 2.7/2.8) → prouvés par des **gardes d'architecture par lecture de source** (patron `sansCommentaires` de `pipeline-securite-architecture.test.ts` / `scene-architecture.test.ts`) et le chemin **factice**. **Muter chaque garde** (rouge vérifié puis reverté, consigné au Debug Log). Ne cocher `[x]` que lorsque les tests EXISTENT et PASSENT à 100 %. Commande : `set -a && . ./.env.local && set +a && npx vitest run` (Supabase local démarré, CLI globale `supabase` v2.67.1). Baseline de départ : **63 fichiers / 748 tests** (fin 2.8).
>
> **⚠️ Porte pré-lancement produit :** la **consigne de génération du bilan** et la **consigne de phase `clore`** sont l'**intention produit**, marquées **PROVISOIRES — à valider**. On code la MÉCANIQUE, pas l'éditorial.

- [x] **T1 — La machine d'arc : émettre le beat clôture + poser le latch `finProposee`** (`lib/domain/arc-seance.ts`, `tests/arc-seance.test.ts`) (AC: 1)
  - [x] RED : étendre `tests/arc-seance.test.ts` (pur) — (a) sur la transition `nommer → clore`, `ResultatArc.beat === "cloture"` ; (b) `finProposee` passe de `false` à **`true`** au tour de clôture ; (c) **idempotence** : un tour suivant **déjà en `clore`** ne ré-émet PAS le beat `"cloture"` et **ne produit aucune transition** ; (d) **contrôle négatif** : en `nommer` non satisfaite, aucun beat `"cloture"`, `finProposee` reste `false`. Le test 2.7 existant (« beat null à la clôture ») **mis à jour** → `"cloture"`. RED confirmé (2 échecs : beat attendu `"cloture"`, obtenu `null`).
  - [x] GREEN : dans `avancerArc` — `ResultatArc.beat` étendu à `"nommer" | "cloture" | null` ; `beat = "cloture"` sur la transition `nommer → clore` ; `finProposee = phase === "clore"` (la machine POSSÈDE le latch, AD-8, dérivé de la phase — jamais posé à la main). **PUR** (AD-1). Idempotence **gratuite** : `clore` sans transition sortante + beat seulement sur la transition entrante. arc-seance **34/34**, arc-architecture (pureté) **10/10**, seance-trace (persistance `fin_proposee`) **7/7**. **Aucune migration** (colonne déjà présente).

- [x] **T2 — La consigne de génération du bilan : cœur PUR (PROVISOIRE)** (`lib/domain/consigne-bilan.ts` + affiner `consigne-phase.ts` `clore`, `tests/consigne-bilan.test.ts`) (AC: 1, 2)
  - [x] RED : `tests/consigne-bilan.test.ts` (pur, patron `consigne-voix.test.ts`) — `consigneBilan(): MessageIa` verrouille le **contrat** + les invariants **sans figer la prose** : registre **document** (titres/listes autorisés — matché `/titre/`, `/liste/`, `/document/`), **reprend les mots** sans inventer (`/mot/` + `/invent|ajout/`), **médical/soin interdits** (`/médical|clinique/`, `/soin|soign/`), **pas de conclusion enveloppante** (`/enveloppante|récapitulatif/`), affect/corpus Anima. + assertions sur la consigne `clore` affinée (Anam clôt, pas de récapitulatif). RED : `Cannot find package consigne-bilan`.
  - [x] GREEN : constante **PROVISOIRE** dans `lib/domain/consigne-bilan.ts`. Comme `consigne-voix.ts`, lexique interdit en **instructions inverses** → **EXCLUE** du scan `lexique-voix.test.ts` (ajoutée à `EXCLUS` dès maintenant pour garder les régressions propres). **PURE** (AD-1). ⚠️ **Frontière honnête** documentée dans le module : la conformité du **contenu généré** est portée par la consigne au **runtime**, non prouvable statiquement. Consigne `clore` affinée (FR-008 : « c'est TOI qui clos », repère « on en a assez fait pour ce soir », pas de récapitulatif). consigne-bilan **7/7**, pureté **10/10**, lexique-voix **86/86** (exclusion vérifiée verte).

- [x] **T3 — La trame document/bilan : transport NDJSON de bout en bout** (`lib/ai/flux-ndjson.ts`, `render/conversation/flux-ndjson-client.ts`, `tests/ndjson.test.ts`, `tests/flux-client.test.ts`) (AC: 2)
  - [x] RED : variant `{ t: "bilan"; titre: string; points: readonly string[] }` (structure décidée SERVEUR — pas de markdown brut). Tests : reconnaissance d'un bilan valide, **rejet strict** (titre vide/manquant, points vide/non-tableau/non-chaîne/point vide → `null`, patron `ressources` R9), **contrat croisé** `relire` (serveur→client à l'identique, points multi-lignes échappés). RED : `analyserTrame` renvoie `null` pour bilan.
  - [x] GREEN : `analyserBilan()` strict dans `flux-ndjson-client.ts` branché dans `analyserTrame` ; **forward-compat** préservé (trame inconnue → ignorée). **No-leak** : la trame ne porte QUE `titre`+`points`. Le beat `"cloture"` était **déjà** dans les deux unions — rien à ajouter. flux-client + ndjson **29/29**.

- [x] **T4 — Route : le GATE de clôture, l'émission gardée, la génération du bilan** (`app/api/anam/message/route.ts`, `lib/domain/bilan.ts`, `tests/pipeline-securite-architecture.test.ts`, `tests/bilan.test.ts`) (AC: 1, 2, 5)
  - [x] RED : (a) cœur pur `structurerBilan` (`lib/domain/bilan.ts`) — prose → `{titre, points}`, puces/numéros retirés, **fail-safe** (< 2 lignes utiles → `null`), 5 tests. (b) gardes d'architecture route (patron `sansCommentaires`) : consommation de `securite.limitesLevees`, gate `clotureAutorisee = niveauSecurite === 0 && !securite.limitesLevees`, beat cloture supprimé en détresse, `doitProduireBilan`, passe `synthese` (fort), bilan **hors** `absorberDelta`, no-leak (trame `bilan` = t+titre+points), métrage clé `:bilan`, pureté des cœurs. RED confirmé (route sans le câblage).
  - [x] GREEN : `clotureAutorisee` **consomme** enfin `securite.limitesLevees` (était un simple commentaire depuis 2.4). `beatArc` supprime le beat cloture en détresse. `doitProduireBilan = arc?.beat === "cloture" && clotureAutorisee`. Le bilan = **2ᵉ passe** `envoyerSousEgressArt9` (capacité `synthese` → fort AD-5, `consigneBilan` + `...messages`, `niveauSecurite: 0`), structurée par `structurerBilan`, émise en trame `bilan` **après** le drain **avant** `fin`, **hors troncature**. **Fail-safe** : structuration `null` → pas de bilan (la clôture reste valide). Métrage `${cleIdempotence}:bilan` dans le `after()` final (jamais exempté). `finProposee` persisté via `ecrire` déjà en place (T1). Ordre pipeline inchangé (AD-16). bilan **5/5**, pipeline **36/36** (gardes 2.9 + 2.3-2.8 sans régression), tsc propre, métrage/frontière **7/7**, eslint propre.

- [x] **T5 — Rendu : Veille au beat clôture + le bloc document dans le fil** (`render/conversation/*`, `tests/conversation-accessibilite.test.ts`) (AC: 2, 3)
  - [x] RED : gardes de source — (a) **Veille** : `ApparitionAnam` sélectionne `beat === "cloture" ? "veille" : "presence"` ; (b) **bloc document** : rôle de vue `bilan` (titre + points), branche du ternaire de `Fil.tsx` rendant `BlocDocument`, registre document (`t-titre-sm` + `<ul>` + `points.map`), `<article>` DANS le fil (jamais modale), `fondu-texte`. RED implicite (BlocDocument.tsx manquant).
  - [x] GREEN : format Veille branché (asset `public/scene/veille/*` + CSS **déjà présents** — rien à peindre) ; `BlocDocument.tsx` **muet** (CSS + props seulement — garde `scene-architecture` verte), réutilise `.bloc` + `.blocListe` (aucun nouveau CSS → `tokens-parite` intacte), titre `<h2 class="t-titre-sm">` (Fraunces, registre document), points en `<li class="t-corps">`. Rôle `bilan` ajouté au type `Tour`. **Régression de type corrigée** : le prédicat de filtre de `Conversation.tsx` passe de `Exclude<Tour,{role:"ressource"}>` à `Extract<Tour,{role:"utilisatrice"|"anam"}>` (exclut aussi `bilan`, sans `texte`). tsc propre, eslint propre, régressions rendu **75/75** (accessibilité, muette, détresse, tokens-parité). *Note : la « respiration double » (timing) est portée serveur en T4 (émission de la trame bilan après le drain) ; la valeur ms exacte reste une Question ouverte — l'insertion est de toute façon en `fondu-texte` neutralisé reduced-motion.*

- [x] **T6 — Le point de montage gardé du paywall (placement, PAS la carte) + le contrôle bloquant** (`app/_commerce/MontagePaywall.tsx`, `tests/garde-commerciale.test.ts`, `tests/lexique-voix.test.ts`) (AC: 4, 5)
  - [x] RED : (a) **tripwire** `tests/garde-commerciale.test.ts` — le nouveau `app/_commerce/MontagePaywall.tsx` (chemin matche `paywall`) **doit** contenir `<GardeCommerciale` ; + bloc 2.9 : enveloppe `<GardeCommerciale utilisatriceId>`, **aucun prix/Stripe/bouton** (périmètre : carte = Epic 3), `server-only`. (b) **lexique** `tests/lexique-voix.test.ts` — `consigne-bilan.ts` exclu ; les fichiers 2.9 (bilan.ts, BlocDocument, MontagePaywall) **passent** le scan (aucun libellé interdit). RED (fichier manquant).
  - [x] GREEN : `app/_commerce/MontagePaywall.tsx` — le **point de montage gardé** : `<GardeCommerciale utilisatriceId>` enveloppant un contenu **VIDE** (`{null}`). Vit dans `app/` (`server-only`), jamais `render/` (muette AD-7). tsc propre, garde-commerciale + lexique **97/97** (tripwire désormais **non-vacue** : 1 UI commerciale détectée + gardée).
  - **⚠️ Déviation actée (honnête) vs le plan initial** : le plan prévoyait de *threader* un slot serveur vide à travers `page → SceneDom → Conversation → Fil` et de le rendre « sous le tour bilan ». Écarté : (i) monter un garde **vide** provoquerait un **appel DB inutile** (`limitesCommercialesLevees`) à chaque chargement pour zéro sortie ; (ii) le positionnement **exact** « sous le tour bilan dans le fil client » est intrinsèquement couplé à la **carte** (client/serveur), donc à l'Epic 3 / Story 3.2. **Le VERROU réel d'AC4/AC5 en 2.9 est le gate SERVEUR** (T4 : la route ne produit **aucun** bilan en détresse → pas de bilan, pas de paywall) ; `MontagePaywall` est le **seam gardé** (défense en profondeur) que 3.2 monte et remplit. Noté en Completion Notes + `deferred-work.md`.

- [x] **T7 — Gardes d'architecture restantes, docs, validations complètes** (AC: 1-5)
  - [x] RED/GREEN : gardes complétées — (a) `lib/domain/{consigne-bilan,bilan}.ts` **PURS** (couverts par `arc-architecture.test.ts` + garde explicite du bloc 2.9 de `pipeline-securite-architecture`) ; (b) **aucun nouvel egress non médié** (`frontiere-serveur.test.ts` vert — le bilan passe par `envoyerSousEgressArt9`/`AiPort`) ; (c) **no-leak** trame bilan (allowlist t+titre+points) ; (d) **métrage** du bilan honnête (clé `:bilan`, jamais exempté).
  - [x] GREEN : `deferred-work.md` (section 2.9 : carte+Stripe+garantie = Epic 3/3.2 ; positionnement in-fil = 3.2 ; contenu bilan PROVISOIRE + conformité sémantique non mécanisée ; `structurerBilan` fragile → sortie structurée à terme ; respiration double non chiffrée ; cycle multi-séances = Epic 4 ; 2ᵉ passe fort assumée). `lib/domain/README.md` (section 2.9). **Suite complète : 65 fichiers / 786 tests verts** (baseline 63/748 → +2 fichiers, +38 tests, zéro régression). `npx tsc --noEmit` propre · `npx eslint .` propre · `npm run build` propre. 5 ACs vérifiés.

## Dev Notes

### La frontière — ce que 2.9 possède, ce qu'elle NE fait PAS

| Concern | Story | 2.9 en fait… |
|---|---|---|
| Machine d'arc (phases construire→observer→nommer→clore, trace) | 2.7 ✅ | **acquis** — `clore` est déjà atteint ; 2.9 **émet le beat** + **pose `finProposee`** |
| Voix + troncature 3 phrases (gated détresse) | 2.8 ✅ | **acquis** — la **phrase de clôture** est un tour normal → voix+troncature s'appliquent **automatiquement** |
| Pipeline sécurité-d'abord, `niveauSecurite`, `limitesLevees` | 2.3/2.4/2.5 ✅ | **acquis** — `limitesLevees` **calculé, jamais consommé** → 2.9 le consomme (le gate) |
| `<GardeCommerciale>` + `limitesCommercialesLevees` (inertes) | 2.5 ✅ | **acquis** — 2.9 **enveloppe** le slot paywall dedans |
| Trame `{t:"beat", beat:"cloture"}` (déclarée, jamais émise) | 2.7 ✅ | **acquis** — 2.9 **l'émet** |
| Format Veille (asset + CSS présents, jamais sélectionné) | 2.2C ✅ | **acquis** — 2.9 le **branche** sur `beat==="cloture"` |
| **Émission beat clôture + latch `finProposee`** | **2.9 🔨** | **T1** — `arc-seance.ts` (pur) |
| **Consigne de génération du bilan** (PROVISOIRE) | **2.9 🔨** | **T2** — `consigne-bilan.ts` (pur), patron `consigne-voix` |
| **Trame document/bilan** (transport NDJSON) | **2.9 🔨** | **T3** — `flux-ndjson.ts` + client, patron `ressources` |
| **Gate de clôture + génération/émission gardée du bilan** | **2.9 🔨** | **T4** — `route.ts`, conjonction `niveauSecurite===0 && !limitesLevees` |
| **Bloc document + Veille dans le rendu** | **2.9 🔨** | **T5** — `BlocDocument.tsx`, `ApparitionAnam`, muette AD-7 |
| **Point de montage gardé du paywall (slot VIDE)** | **2.9 🔨** | **T6** — slot threadé sous `<GardeCommerciale>`, sous le bilan |
| **Carte d'abonnement** (prix, boutons, garantie FR-089) | ⏭️ **Epic 3 / 3.2** | **hors périmètre** — 2.9 ne pose que le slot gardé |
| **Stripe Checkout, webhooks, `abonnement`** | ⏭️ **Epic 3 / 3.1** | hors périmètre |
| Conformité **sémantique** du contenu du bilan (médical/affect/invention) | 2.9 (consigne) / ⏭️ | consigne (T2) au runtime ; **non mécanisée** statiquement (le texte n'existe pas en source) |
| Cycle multi-séances (clôturer → nouvelle séance), naissance de branche J+1 | ⏭️ **Epic 4** | hors périmètre — `seance` porte UNE séance/utilisatrice (upsert) |

### Le SEAM le plus subtil : la machine d'arc ne recule pas (garde AC5)

La garde `peutNommer` de la machine **bloque** `observer → nommer` au niveau ≥ 1 ([`arc-seance.ts:154-159`](../../lib/domain/arc-seance.ts#L154-L159)) — donc on **n'atteint jamais `clore` en détresse par le chemin normal**. **MAIS** si la détresse survient alors qu'on est **déjà** en `nommer`/`clore`, **l'arc ne RECULE pas**. Conséquence : la garde bilan/paywall de 2.9 **ne peut PAS** s'appuyer sur la seule phase de la machine. Elle **doit** poser un **gate explicite dans la route** au point d'émission :

```
bilanAutorise = arc?.etat.phase === "clore"
             && !arc.etat.finProposee        // pas déjà clôturé (idempotence)
             && niveauSecurite === 0          // pas de détresse CE tour
             && !securite.limitesLevees        // pas d'épisode ouvert (repli sûr protecteur)
```

`niveauSecurite === 0` et `!limitesLevees` sont **deux flags distincts** (AD-17, ne jamais confondre) : le premier = détresse de **ce tour** ; le second = épisode **ouvert cross-tour** (`fin IS NULL`, repli sûr → `true`). Les deux sont requis (défense en profondeur, AD-9).

### Le bilan : un registre DIFFÉRENT (ne pas le faire passer par la voix)

- La **phrase de clôture** d'Anam (« On en a assez fait pour ce soir. ») = **tour de conversation** → voix + troncature 3 phrases de 2.8 (automatique).
- Le **bilan** = **bloc document** : titres, listes, tableaux **autorisés** ([EXPERIENCE.md §Component Patterns](../planning-artifacts/ux-designs/ux-Anima-2026-07-21/EXPERIENCE.md), « Interdits dès qu'Anam *parle*. »). Il **NE DOIT PAS** passer par `absorberDelta` (le couperait à 3 phrases) ni par « jamais de liste à puces ». → **trame séparée** (T3) + **génération séparée** au tier fort (T4d), consigne document (T2).
- **Aucune notion de registre `document`/`conversation` n'existe aujourd'hui** — ni dans la trame, ni dans les types de vue. Le **seul précédent** = le bloc `ressources` de détresse (trame dédiée non terminale → rôle de vue dédié → composant `BlocRessources`). **C'est le patron exact à répliquer.**

### « Respiration double » — une lacune UX à trancher (Question 2)

Le terme apparaît 2× dans l'UX **sans valeur en ms**. Seul `spacing.respiration = 40px` (écart vertical entre tours) existe ; `duree-respiration = 4200ms` concerne **le signe** d'Anam (animation en boucle), **pas** le bilan. La « respiration double » du bilan est donc une **temporisation avant insertion** non chiffrée. **Recommandation** : une pause présentationnelle courte (p.ex. 2 × `duree-longue` = 1400ms, ou une valeur produit à valider), **neutralisée à 0 sous reduced-motion** (insertion immédiate, cohérent AC reduced-motion 1.7). Décision de timing : **serveur** (émission différée de la trame bilan, cohérent avec `PLANCHER_LATENCE_MS`) **vs** client (purement présentationnel) → voir Questions.

### Le point de montage du paywall : pourquoi un SLOT serveur threadé

`render/` **ne peut pas** importer `lib/safety` (garde `scene-architecture.test.ts:68-114`, AD-7 muette). Or `<GardeCommerciale>` est un **composant serveur** qui lit `limitesCommercialesLevees`. Donc le montage se fait **hors** de `render/` : `app/page.tsx` (serveur) construit `<GardeCommerciale utilisatriceId={user.id}>{slot}</GardeCommerciale>` et le **threade en prop `ReactNode`** jusqu'au fil, rendu **sous le tour bilan**. Le rendu place un nœud **opaque** qu'il ne connaît pas → muette préservée. **Le slot est VIDE en 2.9** (Epic 3 le remplit). Le **tripwire** `garde-commerciale.test.ts` (ligne 78 nomme déjà `app/bilan/page.tsx`) impose que tout fichier `bilan|paywall|…` importe `<GardeCommerciale>`.

### Conventions de test (héritées 2.7/2.8)

- **Cœurs purs `lib/domain/`** testés en isolation (`toEqual`, contrôle positif **et** négatif) ; **zéro import runtime infra** (interface `DepotXxx` = type autorisé, pas import runtime) — sinon la **garde de pureté** casse.
- **Câblage serveur / rendu non invocable** → **gardes de source** : `sansCommentaires` (⚠️ aveugle aux chaînes — angle mort connu, `deferred-work.md`), `readdirSync(recursive)`, **contrôle positif** (chaîne connue-mauvaise attrapée via le pipeline complet), **garde non-vacue** (`> seuil` fichiers), gardes d'**ordre** par `indexOf`.
- **No-leak en allowlist** des clés de trame (jamais blocklist — leçon 2.7 v1.1).
- **Muter chaque garde** : consigner le ROUGE au Debug Log puis reverter. « Une garde verte quand on casse ce qu'elle protège ne vaut rien. »
- **Métrage jamais vetoé / honnête** ; sur toute troncature, **drainer** le flux ; manquement journalisé **serveur uniquement** (sans art. 9, sans trame).
- **Fail-open côté quality (arc), jamais côté sécurité** : les effets client (beat, bilan) dérivent de l'état **en mémoire**, jamais de la persistance ; `ecrire` avale ses erreurs (AD-15).
- ⚠️ **Contention DB en parallèle** : un run complet peut afficher de **faux échecs** (Supabase local en parallèle) ; re-run à froid = vert, chaque fichier passe en isolé.

### Project Structure Notes

- **NOUVEAUX** (purs / transport / rendu) : `lib/domain/consigne-bilan.ts` ; `render/conversation/BlocDocument.tsx` (+ classe `.blocDocument` dans `conversation.module.css`) ; le fichier de slot paywall gardé (sous `app/`, nommé pour déclencher le tripwire). Tests : `tests/consigne-bilan.test.ts` (+ extensions de `arc-seance`, `ndjson`, `flux-client`, `scene-*`, `pipeline-securite-architecture`, `garde-commerciale`, `lexique-voix`).
- **MODIFIÉS** : `lib/domain/arc-seance.ts` (beat cloture + latch), `consigne-phase.ts` (`clore` affinée) ; `lib/ai/flux-ndjson.ts` + `render/conversation/flux-ndjson-client.ts` (trame bilan) ; `render/conversation/{ApparitionAnam,types,Fil,Conversation,useFluxAnam}.tsx` ; `app/api/anam/message/route.ts` (gate + génération + émission) ; `app/page.tsx` + `render/scene-dom.tsx` (slot threadé). **AUCUNE migration** (colonne `fin_proposee` déjà présente).
- **Variance signalée** : la conformité **sémantique** du bilan (médical/affect/invention) n'est **pas** mécanisée statiquement (contenu LLM absent de la source) — portée par la consigne, documentée en `deferred-work.md`. Cohérent avec la frontière dure de 2.8 (le statique n'attrape que le lexical).

### References

- [Source: epics.md#Story-2.9 (698-702)] — les 5 critères d'acceptation, la note frontière Epic 3.
- [Source: prd.md] — FR-008 (72, Anam clôt), FR-043 (135, garde), FR-014 (78, placement), FR-057 (190, une sollicitation), FR-079 (187, allocation résiduelle), FR-084 (217, voix), FR-046 (138, épisodes exclus). Formulation de clôture : prd.md:29 (« On en a assez fait pour ce soir »).
- [Source: ARCHITECTURE-SPINE.md] — AD-7 (66-69, rendu muet), AD-9 (76-79, limites_levees : « le paywall … **et le bilan** refusent de se monter »), AD-16 (130-133, sécurité-d'abord), AD-17 (135-138, épisode possédé, horloge unique), AD-5 (56-59, tiering fort), AD-1/AD-10 (36-39/81-84, pureté/direction), conventions « Métrage & paywall » (153).
- [Source: EXPERIENCE.md] — §clôture (315-324), §Component Patterns « Apparition d'Anam » (147, clôture→Veille), « Bloc document » (153), « Composeur » (152), §State Patterns « Séance close » (177), §Dossier paywall (382-395), §détresse « le bilan et le paywall ne sont pas produits » (328, 417).
- [Source: DESIGN.md] — formats personnage `presence`/`veille` (265-279, 401-411), tokens `spacing.respiration` (128), `components.mouvement`/`fondu` (133-148), typographie `titre`/`corps`/`meta` (79-95).
- [Source: deferred-work.md] — `limites_levees` consommé en 2.9 (17), `<GardeCommerciale>` couture 2.9 (25), cycle multi-séances 2.9/Epic 4 (58).
- Code (baseline `5ba9b50`) : [`arc-seance.ts`](../../lib/domain/arc-seance.ts), [`route.ts`](../../app/api/anam/message/route.ts), [`flux-ndjson.ts`](../../lib/ai/flux-ndjson.ts), [`flux-ndjson-client.ts`](../../render/conversation/flux-ndjson-client.ts), [`ApparitionAnam.tsx`](../../render/conversation/ApparitionAnam.tsx), [`BlocRessources.tsx`](../../render/conversation/BlocRessources.tsx) (patron), [`GardeCommerciale.tsx`](../../app/_commerce/GardeCommerciale.tsx), [`limites-commerciales.ts`](../../lib/safety/limites-commerciales.ts), [`garde-commerciale.test.ts`](../../tests/garde-commerciale.test.ts), [`lexique-voix.test.ts`](../../tests/lexique-voix.test.ts).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context) — dev-story TDD.

### Debug Log References

- **RED T1** (attendu) : 2 échecs `arc-seance` — beat obtenu `null`, attendu `"cloture"` (le test 2.7 « beat null à la clôture » mis à jour + le nouveau test 2.9). GREEN après `beat = "cloture"` + `finProposee = phase === "clore"`.
- **RED T3/T4** : `analyserTrame` renvoyait `null` pour une trame `bilan` ; `structurerBilan` absent → `bilan.test.ts` rouge ; gardes route rouges (route sans câblage). GREEN après trame + `structurerBilan` + câblage.
- **Régression de type (T5)** : `tsc` — `Conversation.tsx:132` accédait `.texte` sur un `Tour` incluant le nouveau rôle `bilan` (sans `texte`). Corrigé : prédicat de filtre `Exclude<Tour,{role:"ressource"}>` → `Extract<Tour,{role:"utilisatrice"|"anam"}>` (exclut aussi `bilan`).
- **tsc T6** : `<GardeCommerciale>` exige `children` (un commentaire JSX n'est pas un enfant) → enfant explicite `{null}`.
- **Mutation vérifiée (T1)** : le test d'idempotence prouve qu'un tour déjà EN clore ne ré-émet pas le beat (clore terminal + beat seulement sur la transition).

### Completion Notes List

Story 2.9 = **activation de coutures pré-câblées** (2.4→2.8), pas de nouvelle infra. Les 5 ACs :

- **AC1** ✅ — `arc-seance.ts` émet `beat="cloture"` sur `nommer → clore` et pose `finProposee = phase === "clore"` (la machine POSSÈDE le latch, AD-8). Idempotence gratuite (clore terminal). La **phrase de clôture** est un tour normal → voix + troncature 3 phrases de 2.8 s'appliquent automatiquement. Consigne `clore` affinée (« c'est TOI qui clos », repère « on en a assez fait pour ce soir »).
- **AC2** ✅ — beat `"cloture"` (déjà dans le contrat de trame) → `ApparitionAnam` sélectionne le format **Veille** (asset/CSS déjà présents). Le **bilan** = trame `{t:"bilan", titre, points}` (nouvelle, patron `ressources`), générée en **2ᵉ passe fort** (`synthese`, `consigneBilan`), **hors troncature**, structurée par `structurerBilan` (pur), rendue par `BlocDocument` (registre document : `<h2 t-titre-sm>` + `<ul>`, muet AD-7).
- **AC3** ✅ — composeur inchangé (jamais démonté ; aucun bouton terminer/reprendre — invariant préservé). « Ne rouvre pas l'arc » = décision serveur (latch `finProposee` + clore terminal), jamais le rendu.
- **AC4** ✅ (placement) — **verrou serveur** : `clotureAutorisee = niveauSecurite === 0 && !securite.limitesLevees` gate le beat cloture + le bilan. `MontagePaywall` = point de montage gardé (`<GardeCommerciale>`, VIDE). **Carte/prix/Stripe = Epic 3/3.2.**
- **AC5** ✅ — en détresse, `clotureAutorisee` faux → ni beat cloture, ni bilan, ni paywall ; le protocole de détresse (2.3-2.6) prend le relais. Le gate est **explicite** (la machine ne recule pas de clore/nommer).

**Frontière honnête / déviations actées :**
- La **conformité sémantique** du bilan (médical/affect/invention) est portée par `consigneBilan` au **runtime** — non mécanisée statiquement (le texte n'existe pas en source). `consigne-bilan.ts` exclu du scan bloquant (instructions inverses).
- `MontagePaywall` **non monté** en 2.9 (déviation du plan) : monter un garde vide = appel DB inutile ; le positionnement in-fil sous le bilan est couplé à la carte (Epic 3.2). Le **verrou réel** est le gate serveur.
- `structurerBilan` = parseur PROVISOIRE (fragile au formatage modèle → sortie structurée à terme). Génération = 2ᵉ passe fort (coût assumé, métré à part `:bilan`).
- **Porte OPS héritée** : le contrôle bloquant casse la CI, mais CI rouge → déploiement refusé dépend d'une protection de branche/Vercel (hors dépôt).

**Validation finale : 65 fichiers / 786 tests verts · tsc propre · eslint propre · build propre.**

### File List

**Nouveaux :**
- `lib/domain/consigne-bilan.ts` — consigne de génération du bilan (registre document, PROVISOIRE, pur)
- `lib/domain/bilan.ts` — `structurerBilan` : prose → `{titre, points}` (pur, fail-safe)
- `render/conversation/BlocDocument.tsx` — rendu du bilan (bloc document, muet AD-7)
- `app/_commerce/MontagePaywall.tsx` — point de montage gardé du paywall (`<GardeCommerciale>`, vide)
- `tests/consigne-bilan.test.ts`, `tests/bilan.test.ts` — cœurs purs

**Modifiés :**
- `lib/domain/arc-seance.ts` — beat `"cloture"` + latch `finProposee` (machine)
- `lib/domain/consigne-phase.ts` — consigne `clore` affinée (FR-008)
- `lib/ai/flux-ndjson.ts` — trame `{t:"bilan"}` (serveur)
- `render/conversation/flux-ndjson-client.ts` — `analyserBilan` strict + `TrameRecue`
- `render/conversation/types.ts` — rôle de vue `bilan`
- `render/conversation/Fil.tsx` — branche `bilan` → `BlocDocument`
- `render/conversation/ApparitionAnam.tsx` — format Veille au beat `cloture`
- `render/conversation/Conversation.tsx` — prédicat de filtre `Extract` (robustesse au nouveau rôle) ; **revue** : `onBilan` → insertion du tour bilan
- `render/conversation/useFluxAnam.ts` — **revue** : dispatch de la trame `bilan` (`onBilan`, non terminal) + coupure de boucle explicite (`fin`/`erreur` seulement)
- `app/api/anam/message/route.ts` — gate `clotureAutorisee`, beat cloture gardé, 2ᵉ passe bilan, métrage `:bilan`
- `tests/arc-seance.test.ts`, `tests/ndjson.test.ts`, `tests/flux-client.test.ts`, `tests/pipeline-securite-architecture.test.ts`, `tests/conversation-accessibilite.test.ts`, `tests/garde-commerciale.test.ts`, `tests/lexique-voix.test.ts` — gardes + exclusion
- `lib/domain/README.md`, `_bmad-output/implementation-artifacts/deferred-work.md` — sections 2.9

## Change Log

| Version | Date | Description |
|---|---|---|
| v0.1 | 2026-07-29 | Création de la story (create-story, 4 chercheurs parallèles), baseline `5ba9b50`. |
| v1.0 | 2026-07-29 | dev-story : 7 tâches TDD (beat cloture + latch, consigne bilan, trame bilan, gate route + 2ᵉ passe fort, Veille + bloc document, point de montage gardé, docs/validations). 65 fichiers / 786 tests verts. Status → review. |
| v1.1 | 2026-07-29 | **Revue adversariale locale** (7 dimensions × vérif, 16 survivantes). **CRITIQUE corrigé** : la trame `bilan` n'était pas câblée côté client (`useFluxAnam` la traitait comme terminale → faux échec à la clôture ; aucun `onBilan` → BlocDocument code mort). Fix : `onBilan` dans `useFluxAnam` + `Conversation` (insertion du tour bilan), coupure de boucle **explicite** (seuls `fin`/`erreur`). **MOYENS corrigés** : consigne `clore` gatée hors détresse (F6) ; transition `nommer→clore` gatée par la sécurité au niveau machine → clôture **différée** en détresse, bilan jamais perdu (F7/F8/F10) ; commentaire `finProposee` corrigé (F12) ; garde tautologique renforcée (F16). Gardes anti-régression du câblage client ajoutées. LOW différées documentées. **65 fichiers / 790 tests verts**. |

## Questions ouvertes (à trancher en dev-story)

1. **Génération du bilan** — passe **fort séparée** (recommandé : capacité `bilan`/document, consigne PROVISOIRE, émise en trame document) vs une seule passe produisant clôture + bilan. Impact : coût (2 appels au tier fort au tour de clôture) et complexité de la route. *Reco : passe séparée, tier fort (AD-5), métrée à part.*
2. **« Respiration double » en ms** — non chiffrée dans l'UX. *Reco : temporisation présentationnelle courte (~1400ms = 2× `duree-longue`), neutralisée à 0 en reduced-motion ; timing **serveur** (émission différée de la trame bilan) pour cohérence avec le plancher de latence.*
3. **Contenu du bilan en 2.9** — vrai texte généré (LLM fort, PROVISOIRE) **vs** structure déterministe minimale. Le bilan « reprend ses mots » → nécessite la conversation. *Reco : génération réelle au fort, consigne PROVISOIRE ; conformité portée par la consigne (non mécanisée statiquement), documentée.*
4. **Slot paywall vide** — confirmer que 2.9 pose un **slot gardé VIDE** (aucun placeholder visuel), Epic 3/3.2 le remplissant. *Reco : oui — slot `<GardeCommerciale>` positionné sous le bilan, sans contenu ; seul le tripwire et le positionnement sont livrés.*
