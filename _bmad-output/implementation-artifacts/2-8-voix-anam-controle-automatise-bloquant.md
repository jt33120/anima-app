---
baseline_commit: a3296531eea18d0aae46ffac28b22306fa3d4367
---

# Story 2.8: La voix d'Anam et le contrôle automatisé bloquant

Status: done

> **Revue de code : 2026-08-13.** Entités HTML invisibles aux détecteurs, miroir divergent entre les deux normalisations, règle emoji inversée, et la clause médicale absente de la voix vivante.
> Dossier complet : [`revue-dette-2026-08.md`](revue-dette-2026-08.md).

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant qu'**utilisatrice**,
je veux qu'Anam **parle court, en hypothèses, sans flatterie ni jargon médical, et sans jamais inventer une parole d'Anima**,
afin que la **franchise qui fait le produit** soit **garantie** (par un contrôle automatisé qui bloque le déploiement) et non simplement espérée.

> **La nature de cette story.** C'est **l'âme du produit rendue exécutable**. Deux livrables sous un même titre, tous deux **côté serveur** :
> 1. **La voix (a)** — la couche qui fait *enfin parler* l'arc posé en 2.7. Une **consigne système de voix** (forme, hypothèses réfutables, anti-flatterie, corpus Anima) préfixée à la génération, **plus** une **troncature déterministe à 3 phrases** sur le flux (le seul mécanisme que la spec impose comme déterministe : *« tronqué à la troisième ponctuation finale, manquement journalisé »*).
> 2. **Le contrôle bloquant (b)** — un **test-garde transversal** qui scanne **tout le contenu que l'utilisatrice voit** et rejette (échec CI → build cassé → déploiement bloqué) le lexique médical, les formulations bannies de `anam-voice.md`, et « soin/soigner ». C'est le point (b) du logement de tests bloquant de l'architecture (Opérations).
>
> **Frontière dure (à ne pas franchir).** Le contrôle **statique** ne peut attraper que ce qui est *lexical* (mots, phrases, emoji, `!`). Ce qui est *sémantique* — **verdict vs hypothèse** (FR-006), **appariement d'une citation au corpus d'Anima** (FR-086), **reculer sans flatter** (FR-009) — n'est **pas** détectable par un scan de source : c'est porté par la **consigne système** au runtime (et, pour le corpus Anima, **différé** tant qu'aucun corpus n'existe). 2.8 ne **revendique pas** ces trois-là comme mécanisés — elle les pose en consigne et documente la limite. Le **contenu** des consignes (voix, lexique) est **PROVISOIRE** — porte pré-lancement produit/clinique.
>
> **⚠️ Numérotation FR — piège.** `prd.md` porte la numérotation **FINALE** (voix = FR-082→087). Le document `reconcile-anam-voice.md` utilise une numérotation **antérieure et incompatible** (ses « FR-069 » ≠ ceux du PRD) : n'y puiser que le **contenu** (formulations, arbitrages), **jamais** un numéro. La **liste réelle** des formulations bannies vit dans `anam-voice.md` §11 (référencée par FR-085, non reproduite dans le PRD).

## Acceptance Criteria

Repris de l'épic (Story 2.8, `epics.md:674-685`), découpés en critères testables. `Couvre : FR-006, FR-009, FR-023, FR-082, FR-083, FR-084, FR-085, FR-086, FR-087, NFR-008 ; AD-1 (domaine pur), AD-2 (composition serveur), AD-16 (pipeline sécurité-d'abord), AD-5 (tiering), AD-7/AD-10 (rendu muet), AD-4 (egress/logs art. 9) ; Opérations « Tests & CI/CD (bloquants) » point (b).`

1. **[AC1 — débit & forme, troncature déterministe, gate détresse]** Étant donné un tour d'Anam **hors détresse** (`niveauSecurite === 0`), quand il sort, alors il fait **au maximum trois phrases** — **tronqué déterministiquement à la troisième ponctuation finale** (`. ! ? …`, les groupes consécutifs comptant pour une seule fin) et **un manquement de voix journalisé côté serveur** quand la troncature se déclenche — **sans liste à puces**, **sans récapitulatif empathique** (« il semble que tu ressentes… »), **sans conclusion enveloppante** (« n'oublie pas que tu es forte ») (FR-084), en **tutoiement**, **sans emoji**, **sans point d'exclamation**, **sans majuscule d'emphase** (FR-083). *⚠️ Garde de sécurité DURE : la troncature est **suspendue dès `niveauSecurite ≥ 1`** — une réponse de détresse (orienter, donner le 3114, rester) dépasse légitimement 3 phrases et ne doit **jamais** être coupée avant l'orientation. C'est le pendant serveur de « la franchise est suspendue dès que la sécurité est en jeu » (prd:124). La troncature est un mécanisme déterministe (`lib/domain/`, pur) ; la discipline emoji/`!`/majuscule **en sortie live** est portée par la **consigne** (non-tronçable proprement en flux), et **contrôlée statiquement** sur le contenu figé par AC4.*

2. **[AC2 — hypothèse réfutable, jamais verdict ; neutre/chaleureuse]** Étant donné toute observation, quand elle est formulée, alors c'est en **hypothèse réfutable** (« j'ai l'impression que… je me trompe ? », *poser plus qu'affirmer*), **jamais** en verdict (FR-006), **neutre sur le jugement, chaleureuse sur l'attention** (FR-082). *Non détectable par scan statique (un verdict « Tu as peur de l'abandon » ne contient aucun mot banni) → porté par la **consigne système de voix** (T3). La vérification comportementale réelle (LLM-juge / heuristique de forme) est **différée** — documentée, non revendiquée mécanisée.*

3. **[AC3 — contestation → recule sans flatter]** Étant donné une observation contestée, quand l'utilisatrice la rejette, alors Anam **recule sans flatter** — elle ne s'excuse pas platement, elle **rend la main** (« alors dis-moi comment tu le vois, toi ») — **et** la correction est enregistrée comme **matière** (FR-009). *Le comportement est porté par la **consigne de voix** (§5.2 d'`anam-voice.md` : accepter sans négocier, remercier une fois, repartir de la version corrigée). Le signal machine existe déjà : `rejetProposition` alimente `deuxDernieresPropositions` dans l'arc (2.7). L'**écriture durable** de la correction en mémoire relève d'Epic 4 (journal 3 couches) — différée.*

4. **[AC4 — le contrôle automatisé BLOQUANT, transversal]** Étant donné le contrôle automatisé, quand il s'exécute en CI, alors il s'applique à **toute l'interface et à tous les contenus destinés à l'utilisatrice** (libellés, pages, `/aide`, CGU — et, dès qu'ils existeront, e-mails, fiches store, bilans, restitutions) et **rejette** : (i) le **lexique médical** — zéro médical (NFR-008) ; (ii) les **formulations bannies** de `anam-voice.md` (FR-085) ; (iii) le mot **« soigner »/« soigné(e) »** et la locution **« prends soin de »** (FR-023) — **et** tout manquement **casse le build** (test Vitest rouge → CI rouge). *Le contrôle **découvre les fichiers récursivement** (jamais une liste en dur → les surfaces futures sont scannées automatiquement), est **insensible à la casse et aux accents**, travaille en **frontières de mots** (impératif : ne PAS casser sur « be**soin** », « **traite**ment », « **santé** » seul), **exclut** les consignes système (qui contiennent volontairement le lexique interdit comme instruction inverse) et **allowliste** le disclaimer « ni un service médical, ni psychologique ». Il embarque un **contrôle positif** (une chaîne connue-mauvaise DOIT être attrapée) + une **garde non-vacue** (nombre de fichiers scannés > seuil) — sinon un regex cassé passe silencieusement vert.*

5. **[AC5 — Anam ≠ Anima ; aucune revendication d'affect]** Étant donné une référence à Anima, quand Anam cite sa source, alors elle ne le fait qu'à partir du **corpus fourni** et **à la troisième personne** (Anam ≠ Anima — FR-086), ne **fabrique jamais** une parole d'Anima (**défaut critique** : mensonge sur une personne réelle et identifiable), **et** ne revendique **jamais** un affect qu'elle n'a pas (ni « je ressens », ni « ça me touche », ni « je m'inquiète » — FR-087). *Porté par la **consigne de voix**. L'**appariement d'une citation au corpus avant émission** (recommandé par le reconcile) est **impossible aujourd'hui** — aucun corpus Anima n'existe dans l'app : différé jusqu'à sa création, documenté. Les **revendications d'affect** (formulations fixes) SONT attrapables statiquement → incluses dans la liste bannie d'AC4, avec l'exemption des tournures d'**attention** autorisées (« je suis là », « je lis », « je note »).*

## Tasks / Subtasks

> **TDD strict (red → green → refactor).** Vitest est en env **node** (pas de DOM). La voix (troncature, consigne, lexique) est faite de **cœurs purs** `lib/domain/` testés en isolation (`toEqual`, contrôle positif **et** négatif) ; le câblage serveur est prouvé par des **gardes d'architecture par lecture de fichier** (patron `sansCommentaires` de `pipeline-securite-architecture.test.ts`) — la route n'est pas invocable en test (convention 2.7). Le contrôle bloquant (b) est **lui-même un test** qui scanne la source. **Muter chaque garde** (rouge vérifié puis reverté, consigné au Debug Log). Ne cocher `[x]` que lorsque les tests EXISTENT et PASSENT à 100 %. Commande : `npx vitest run` (Supabase local démarré).
>
> **⚠️ Porte pré-lancement produit + clinique :** la **consigne de voix** et la **liste du lexique/formulations** sont l'**intention produit**, PAS un protocole validé. Marquées **PROVISOIRES — à valider** (produit ; et juriste/pro pour tout ce qui borde la détresse et la mention d'une personne réelle) avant mise en ligne. On code la **MÉCANIQUE** (troncature déterministe, contrôle lexical, injection de consigne) ; pas le jugement éditorial définitif.

- [x] **T1 — Le lexique interdit : source unique PURE** (`lib/domain/lexique-interdit.ts`, `tests/lexique-interdit.test.ts`) (AC: 4, 5)
  - [x] RED : `tests/lexique-interdit.test.ts` (pur) — `chercherInterdits(texte): Interdit[]` miroir de `anam-voice.md` §11 + `EXPERIENCE.md` §Lexique. **Contrôle POSITIF** : 28 chaînes connues-mauvaises attrapées (thérapie/thérapeutique, dépression, anxiété, diagnostic, symptôme, santé mentale, guérir, burn-out, pathologie, syndrome, prendre en charge, tu iras mieux, ça va passer, **soigner**, prends **soin** de toi, excellente prise de conscience, c'est normal de ressentir, n'oublie pas que tu es forte, il semble que tu ressentes, bravo, tu as tout à fait raison, je suis fière, je ressens, ça me touche, je comprends ce que tu vis, 2 emoji). **Contrôle NÉGATIF (anti-faux-positif)** : n'attrape PAS « be**soin** », « **traite**ment », « **santé** » seul (Fil Santé Jeunes / professionnelle de santé), « ça me **trouble** », « je suis **là** / lis / note / me souviens », « le **soin** apporté », « suicide » (libellé d'aide).
  - [x] GREEN : module **PUR** (AD-1, zéro I/O, aucun import). Normalisation **casse + accents** (NFD + retrait diacritiques + unification apostrophes) ; **frontières de mots** `\b` ; « soin » ciblé par motif **contextuel** (`\bsoign\w*`, `\bprends? soin de`), jamais la sous-chaîne nue. Familles **nommées** (`medical`, `soigner`, `formulation`, `affect`, `emoji`) pour des messages parlants. L'attention (« je suis là ») n'est jamais dans les motifs → exemptée par construction. Emoji via `\p{Extended_Pictographic}` sur le texte d'origine. **PROVISOIRE.** ⚠️ **Déviation actée** : `!`/majuscule d'emphase **retirés du scan statique** (pullulent en code source : `!==`, `!bloque`, sigles) — l'AC bloquante (epics:683) ne vise que lexique/formulations/soin ; la discipline `!`/majuscule en sortie live est portée par la consigne (T3). Noté en Completion Notes.

- [x] **T2 — La troncature déterministe à 3 phrases : cœur PUR** (`lib/domain/voix-anam.ts`, `tests/voix-anam.test.ts`) (AC: 1)
  - [x] RED : `tests/voix-anam.test.ts` (pur) — réutilise le motif d'`estReponseLongue` (`/[.!?…]+/g`). `pointDeCoupe(texte): number | null` = index juste après le 3ᵉ groupe **si clos**, sinon `null`. **Insight** : grâce au `+` glouton, le caractère qui suit un groupe est toujours non-final → « clos » ⟺ « le groupe finit avant la fin de la chaîne ». Cas couverts : ≤ 2 groupes → null ; exactement 3 phrases → null (rien à couper) ; 4ᵉ phrase → coupe ; `?!`/`…`/`...` = une fin ; **3ᵉ groupe multi-car (`...`) préservé en entier** ; **streaming** (préfixes croissants → null tant que le 3ᵉ groupe peut grandir) ; `tronquerATroisPhrases` façade. **7 tests.**
  - [x] GREEN : module **PUR** (AD-1, aucune dépendance runtime). Motif partagé avec `estReponseLongue` (documenté, gardé synchrone) — deux fonctions distinctes (compter vs localiser). Point d'insertion streaming = route (T4).

- [x] **T3 — La consigne de voix : cœur PUR** (`lib/domain/consigne-voix.ts`, `tests/consigne-voix.test.ts`) (AC: 1, 2, 3, 5)
  - [x] RED : `tests/consigne-voix.test.ts` (pur) — `consigneVoixAnam(): MessageIa` (patron `consignePhaseArc`). Verrouille le **contrat** (`{role:"system"}` non vide) + les **invariants load-bearing** (hypothèse réfutable « je me trompe ? », corpus Anima « ne jamais fabriquer », interdit d'affect + attention autorisée, anti-flatterie « rends la main », ≤ 3 phrases) sans figer la prose au mot près. **5 tests.**
  - [x] GREEN : constante **PROVISOIRE**, **injectée inconditionnellement** — porte les invariants toujours vrais (aucun emoji, aucune revendication d'affect, jamais une parole d'Anima fabriquée, tutoiement, hypothèses) qui valent aussi en détresse. La brièveté ≤ 3 phrases est *encouragée* mais **garantie** par la troncature (T4, gatée `niveauSecurite === 0`) — la consigne ne la porte pas comme règle de sécurité. Contient volontairement le lexique interdit en instructions inverses → **EXCLUE** du scan T5. **PROVISOIRE — porte pré-lancement.**

- [x] **T4 — Câblage serveur : injection de la voix + troncature gated + manquement journalisé** (`app/api/anam/message/route.ts`) (AC: 1, 2, 3, 5)
  - [x] RED : étendre `tests/pipeline-securite-architecture.test.ts` (gardes par lecture de source de `route.ts`) —
    - (a) **injection** : `consigneVoixAnam()` est préfixée **en tête** de `prefixes` (`route.ts:174`) → ordre `[voix, consignePhase, consigneDetresse, …messages]` (la voix la plus **loin** des messages, la détresse la plus **près** → l'overlay sécurité garde la priorité, prd:124). Garde d'ordre par `indexOf`.
    - (b) **troncature gatée** : le point de troncature (`pointDeCoupe`/`tronquerATroisPhrases`) est appelé dans la boucle delta **et** encadré par `niveauSecurite === 0` (jamais de coupe en détresse). Garde par lecture : présence du gate `niveauSecurite === 0` autour de la troncature.
    - (c) **no-leak** : aucune nouvelle clé de trame NDJSON ; le « manquement » ne part **jamais** au client (allowlist des variants de trame, changelog 2.7 v1.1 §5).
    - (d) **drain** : la boucle **ne `break` pas** à la coupe — elle continue de consommer le flux jusqu'à `fin` (sinon l'usage réel `etat.finRecu` est perdu → sous-comptage, FR-043).
  - [x] GREEN : câbler dans le `ReadableStream` (`route.ts:245-260`). **Mécanique de coupe sur flux** : maintenir `texteGenere` (concat des `ev.texte`) et `emisJusqua` ; à chaque delta hors détresse, `limite = pointDeCoupe(texteGenere)` ; si `null` → émettre `texteGenere.slice(emisJusqua)` ; si `≠ null` → émettre `texteGenere.slice(emisJusqua, limite)`, marquer `tronque=true`, **cesser d'émettre** les deltas suivants **mais continuer à drainer** (accumuler `charsSortie` pour un repli honnête). À `tronque=true`, **journaliser un manquement** côté serveur **uniquement** (compteur/`console.warn` sans verbatim — patron `route.ts:89` qui ne logge que `e.name`), **jamais** d'art. 9, **jamais** de trame. En détresse (`niveauSecurite ≥ 1`) : **bypass total** de la troncature (émission telle quelle). **Invariants durs préservés** : sécurité AVANT arc AVANT génération (AD-16) ; egress art. 9 inchangé (aucun nouvel appel modèle — la voix est un **préfixe système**, zéro egress) ; le client (`useFluxAnam`) **inchangé** (il révèle ce qu'il reçoit).

- [x] **T5 — LE CONTRÔLE BLOQUANT : test-garde transversal de contenu** (`tests/lexique-voix.test.ts`) (AC: 4, 5)
  - [x] RED : `tests/lexique-voix.test.ts` — **découverte récursive** (`readdirSync(dir, { recursive: true })`) de `app/**` + `render/**` + les sources de libellés `lib/scene/regions.ts`, `lib/safety/ressources-aide.ts`, `lib/domain/message-sans-heure.ts`. Par fichier : `sansCommentaires` → `retirerAllowlist` → `chercherInterdits` (T1) → `toEqual([])` avec message citant fichier + mots.
    - **EXCLUSIONS** commentées : `consigne-detresse.ts`, `detecteur-detresse.ts`, `classer-detresse.ts`, `consigne-phase.ts`, `signaux-arc.ts`, `consigne-voix.ts` (consignes système / prompts, lexique en instructions inverses). Un test prouve que **l'exclusion est nécessaire** (consigne-detresse SERAIT rouge si scannée) — pas cosmétique.
    - **ALLOWLIST** : mécanisme prêt, **vide aujourd'hui** — le mot nu « médical » n'est PAS dans le lexique (charte §11.2 bannit les termes *cliniques*, pas l'adjectif) → le disclaimer « ni un service médical, ni psychologique » passe sans allowlist.
    - **CONTRÔLE POSITIF** : `"Cette app soigne ton anxiété."` attrapé à travers le **pipeline complet** (sansCommentaires+allowlist+chercherInterdits). **GARDE NON-VACUE** : `> 15` fichiers scannés. **51 tests.**
  - [x] GREEN : **vert honnête** — aucune surface actuelle ne contient d'interdit réel (`besoin`/`traitement`/`santé` seul/`suicide` épargnés). **Mutation vérifiée** : injecter « soigne ta dépression » dans `regions.ts` → le test du fichier vire au rouge (attrape `depression`+`soigne`), reverté. ⚠️ **Le « bloque le déploiement »** = `.github/workflows/ci.yml` (`npm test`) casse le build CI ; le lien build→refus de déploiement dépend d'une **protection de branche GitHub / Vercel** absente du dépôt → **porte ops** (Dev Notes + `deferred-work.md`).

- [x] **T6 — Gardes d'architecture restantes, docs, validations complètes** (AC: 1-5)
  - [x] RED/GREEN : gardes complétées — (a) `lib/domain/{voix-anam,consigne-voix,lexique-interdit}.ts` **PURS** : couverts automatiquement par la garde `arc-architecture.test.ts` (scan de tout `lib/domain/*`) **et** par une garde explicite ajoutée dans `pipeline-securite-architecture.test.ts` (bloc 2.8) ; (b) `render/` **muet** : la garde existante « render ne connaît pas `@/lib/domain` » couvre voix/troncature (aucun ajout render) ; (c) **aucun nouvel egress** : `frontiere-serveur.test.ts` reste vert (la voix est un préfixe système, la troncature est post-egress — aucun SDK ajouté).
  - [x] GREEN : `deferred-work.md` (section 2.8 : corpus Anima différé, LLM-juge différé, correction→journal Epic 4, lexique en entrée→consigne, enforcement déploiement→porte ops, surfaces futures auto-scannées, emoji/`!` sortie live→consigne, contenu PROVISOIRE). `lib/domain/README.md` mis à jour (voix : consigne + troncature + lexique).
  - [x] `npx vitest run` → **63 fichiers / 696 tests verts**. `npx tsc --noEmit` propre · `npx eslint .` propre · `npm run build` propre. 5 ACs vérifiés (voir *Completion Notes*).

## Dev Notes

### La frontière — ce que 2.8 possède, ce qu'elle NE fait PAS

| Concern | Story | 2.8 en fait… |
|---|---|---|
| Arc de séance (phases, trace, beat, consigne de PHASE) | 2.7 ✅ | **acquis** — 2.8 compose la voix **au-dessus** ; le beat « nommer » encadre déjà la livraison |
| Pipeline sécurité-d'abord + réponse par niveaux (overlay détresse) | 2.3/2.6 ✅ | **acquis** — l'overlay détresse garde la priorité ; la troncature s'y **efface** |
| Streaming NDJSON delta-par-delta + métrage honnête | 2.2 ✅ | **acquis** — la troncature coupe le flux **sans** casser le métrage (drain jusqu'à `fin`) |
| Point d'injection de consigne système `[…, …messages]` | 2.6/2.7 ✅ | **même point** (`route.ts:174`) ; la voix se préfixe **en tête** |
| **Consigne de voix** (forme, hypothèse, anti-flatterie, corpus, affect) | **2.8 🔨** | **T3** — `lib/domain/consigne-voix.ts`, patron `consignePhaseArc`, PROVISOIRE |
| **Troncature déterministe 3 phrases** (sur flux, gated détresse) | **2.8 🔨** | **T2+T4** — `voix-anam.ts` (pur) + boucle delta `route.ts` ; motif d'`estReponseLongue` |
| **Lexique interdit** (source unique, anti-faux-positif) | **2.8 🔨** | **T1** — `lib/domain/lexique-interdit.ts`, miroir `anam-voice.md` §11 |
| **Contrôle bloquant transversal** (scan récursif de tout le contenu) | **2.8 🔨** | **T5** — `tests/lexique-voix.test.ts`, exclusions + allowlist + contrôle positif |
| Verdict vs hypothèse (FR-006) — vérification sémantique | 2.8 (consigne) / ⏭️ | consigne (T3) ; LLM-juge **différé** (non détectable statiquement) |
| Appariement citation ↔ corpus Anima (FR-086) | ⏭️ Epic 4 | **différé** — aucun corpus Anima n'existe encore ; consigne « ne fabrique jamais » seule |
| « Correction enregistrée comme matière » (FR-009, écriture durable) | ⏭️ Epic 4 | différé — journal 3 couches ; le signal `rejetProposition` existe déjà (2.7) |
| Clôture rendue (bilan, beat Veille, paywall) | 2.9 ⏭️ | hors périmètre — 2.9 lit l'état « nommer satisfaite » posé par 2.7 |
| E-mails / fiches store / bilans / restitutions (contenu réel) | futur ⏭️ | n'existent pas ; **scannés automatiquement** dès leur création (découverte récursive T5) |

### Le mécanisme de troncature sur flux (le cœur technique)

Cartographié par lecture du code. Le texte d'Anam est **diffusé incrémentalement** (NDJSON delta-par-delta) — **aucun point serveur ne détient le texte complet** aujourd'hui ([`route.ts:245-260`](app/api/anam/message/route.ts#L245-L260)) ; le seul assemblage se fait **côté client** (`useFluxAnam`). La troncature doit donc **introduire une accumulation serveur** dans la boucle delta.

- **Point d'insertion** : la branche `ev.type === "delta"` ([`route.ts:248-255`](app/api/anam/message/route.ts#L248-L255)), seul endroit serveur qui voit le texte passer. **Ne PAS** bufferiser tout puis émettre d'un bloc (détruirait le streaming mot-à-mot, NFR-014) — couper **sur le flux**.
- **Réutiliser le motif** `/[.!?…]+/g` d'[`estReponseLongue`](lib/domain/signaux-arc.ts#L40-L43) : « une ponctuation finale » = un groupe de `. ! ? …` consécutifs, compté **une** fois (le `+`).
- **Piège de frontière (multi-delta)** : un groupe peut s'étendre sur plusieurs deltas (`"."` puis `"."` → `".."`). Règle sûre : ne considérer le 3ᵉ groupe **clos** que lorsqu'un caractère **non-final** le suit → `pointDeCoupe` renvoie `null` tant que non confirmé. Conséquence bénigne : une réponse d'**exactement** 3 phrases (sans caractère après le 3ᵉ point) n'est **pas** coupée (rien à couper) — correct.
- **Ne pas `break`** à la coupe : continuer à drainer pour recevoir `fin` (usage réel, [`route.ts:256-259`](app/api/anam/message/route.ts#L256-L259)) — sinon `resoudreMetrage` retombe sur `charsSortie` et **sous-compte**. Après la coupe : ne plus **émettre**, mais continuer d'**accumuler** `charsSortie` (repli honnête).

### ⚠️ La garde de sécurité DURE (absente de l'AC, requise pour ne pas régresser)

**La troncature à 3 phrases ne s'applique QUE si `niveauSecurite === 0`.** `niveauSecurite` est en main à [`route.ts:110`](app/api/anam/message/route.ts#L110). En détresse (`≥ 1`), la réponse est régie par `consigneReponse` (orienter, donner le **3114**, rester — [`consigne-detresse.ts:44-60`](lib/safety/consigne-detresse.ts#L44-L60)) et dépasse légitimement 3 phrases : une coupe dure **tronquerait avant l'orientation** = **régression de sécurité**. C'est le pendant serveur de « Anam refuse de flatter, ne refuse jamais de soutenir » (prd:124). Cette garde est **non négociable** — la tester explicitement (T4b).

### Le split déterministe / consigne (ce qui est mécanisé vs instruit)

`lib/domain/` est **pur** (AD-1) — il peut faire la **troncature** (texte→texte) et **héberger le lexique** (données→booléen), mais ne peut ni appeler le modèle ni contraindre sa prose. D'où le partage :

- **Déterministe (mécanisé, testable en CI)** : troncature à 3 phrases (T2/T4), contrôle lexical statique (T1/T5), injection de la consigne au bon rang (T4a). Ce sont les seules choses que la spec impose comme déterministes (« tronqué à… », « un contrôle automatisé rejette… »).
- **Consigne système (instruit au runtime, non mécanisé)** : hypothèse-vs-verdict (FR-006), reculer-sans-flatter (FR-009), citation à la 3ᵉ personne (FR-086), neutralité/chaleur (FR-082). Le modèle est **instruit** ; la conformité fine n'est pas prouvée par un test unitaire (LLM-juge différé).
- **Impossible aujourd'hui (différé)** : l'appariement d'une citation d'Anima à un corpus (FR-086) — **aucun corpus n'existe**. Ne **pas** prétendre le vérifier.

### La carte des FAUX POSITIFS du contrôle (impératif — sinon on casse du contenu légitime)

Le contrôle **doit** viser ce que l'utilisatrice **voit** et éviter ces pièges mesurés dans le code actuel :

- **`soin`** : la sous-chaîne casse sur **« besoin »** (8 occurrences : « Besoin de parler », « si tu as besoin… »). Cibler `\bsoign\w*` (soigner/soigné) et `prends?\s+soin\s+de` (locution bannie prd) — **jamais** `soin` nu. Le **substantif « le soin »** est même employé positivement par la charte (§13.6) → autorisé.
- **`traiter`** : casse sur **« traitement »** (13 occurrences, sens RGPD : « traitement des données », « traitement art. 9 suspendu »). L'interdit vise le **verbe médical**, pas le traitement de données.
- **`santé`** seul est **légitime** (« Fil Santé Jeunes », « professionnelle de santé ») ; seule la **locution** « santé mentale » est bannie.
- **`trouble`** : « ça me trouble » / « eau trouble » sont courants ; l'interdit vise le sens clinique (« trouble anxieux »).
- **Consignes système** (`consigne-detresse.ts`, `detecteur-detresse.ts`, `classer-detresse.ts`, `consigne-phase.ts`, `signaux-arc.ts`, **`consigne-voix.ts`**) : contiennent **volontairement** « santé » (« pas une professionnelle de **santé** »), « suicide », « prendre en charge » comme **instructions inverses** → **exclues** du scan (jamais renvoyées au client).
- **Disclaimers** : « ni un service **médical**, ni **psychologique** » (aide, cgu) → **allowlist** (négation légitime).
- **`ressources-aide.ts`** contient légitimement « suicide », « Souffrance psychique » (noms d'organismes/familles d'aide) — traiter avec discernement (ce sont des libellés d'aide, pas du lexique médical d'Anam).
- **Affect** : « je suis là », « je lis », « je note », « je me souviens » = **autorisés** ; « je ressens », « ça me touche », « je m'inquiète », « je suis fière » = interdits. NB : le protocole détresse utilise « m'inquiète » (« Ce que tu écris m'inquiète ») → couvert par l'exclusion des consignes.
- **Emoji / `!` / MAJUSCULES** : interdits en **conversation** ; légitimes hors conversation (sigles « IA », « SOS », « SAMU », titres de documents). Le scan doit **épargner** sigles/acronymes.

### Le point d'injection de la consigne (recopié de 2.6/2.7)

Ordre **déjà annoté** dans le code ([`route.ts:169-171`](app/api/anam/message/route.ts#L169-L171)) : *« La voix (2.8) se préfixera avant la consigne de phase. Ordre d'injection : [voix(2.8), consignePhase(2.7), consigneDétresse(2.6), …messages]. »* Concrètement, à [`route.ts:174`](app/api/anam/message/route.ts#L174) :

```ts
const consigneVoix = consigneVoixAnam();                 // 2.8, en TÊTE
const consignePhase = arc ? consignePhaseArc(arc.etat.phase) : null;   // 2.7
const consigneDetresse = consigneReponse(securite.verdict);           // 2.6
const prefixes = [consigneVoix, consignePhase, consigneDetresse].filter((c): c is MessageIa => c !== null);
```

La voix la plus **loin** des messages (base), la détresse la plus **près** (overlay prioritaire). Toutes `{role:"system"}`, **serveur uniquement**, jamais reçues ni renvoyées au client ([`valider-messages.ts:15`](lib/ai/valider-messages.ts#L15)).

### Le contrôle bloquant : mécanisme CI réel

- **`.github/workflows/ci.yml`** existe : `npm ci` → `npm run lint` → `supabase start` → **`npm test`** (commentaire : *« Bloque le build si un test échoue »*). Le nouveau `tests/lexique-voix.test.ts` est **pris automatiquement** (`vitest.config.ts` : `include: ["tests/**/*.test.ts"]`).
- **PAS** de `vercel.json` / `turbo.json`. Le lien « échec CI → **refus de déploiement** » dépend d'une **protection de branche GitHub** (required status check) **ou** d'un « wait for CI » Vercel — **ni l'un ni l'autre dans le dépôt**. **À signaler** (T5, `deferred-work.md`) : le test **casse le build CI** ; l'enforcement du déploiement est un réglage **externe** (porte pré-lancement ops).
- Germes existants réutilisables : [`consentement.test.ts:153-169`](tests/consentement.test.ts) (patron blocklist + contrôle positif) ; [`consigne-detresse.test.ts:42`](tests/consigne-detresse.test.ts) (`.not.toMatch(/diagnostic|thérap|médical|patient|soigner/i)` — germe de regex, mais appliqué à un seul module de consigne).

### References

- **Épic** : [`epics.md:674-685`](_bmad-output/planning-artifacts/epics.md) (Story 2.8, AC verbatim — L680 troncature/manquement, L682 recule sans flatter, L683 contrôle bloquant transversal, L684 corpus Anima).
- **PRD** (numérotation FINALE) : FR-006 `prd.md:70`, FR-009 `:73`, FR-023 `:` (mot « soin » proscrit, renvoi FR-080), FR-082 `:215`, FR-083 `:216`, FR-084 `:217`, FR-085 `:` (renvoi `anam-voice.md`), FR-086, FR-087, NFR-008 `:246`.
- **Charte voix** (source des formulations bannies, FR-085) : [`anam-voice.md`](_bmad-output/brainstorming/brainstorm-anima-app-2026-07-20/anam-voice.md) §2 (formule mère), §3.1 (6 règles de débit), §4.4 (formulations bannies), §5 (hypothèse/recul), §9.3 (Anam ≠ Anima, règles dures), §10.3 (affect interdit), §11 (lexique médical), Annexe (checklist 14 contrôles).
- **Reconcile** (contenu/arbitrages, **jamais** ses numéros FR) : [`reconcile-anam-voice.md`](_bmad-output/planning-artifacts/prds/prd-Anima-2026-07-21/reconcile-anam-voice.md) — clause « `anam-voice.md` prime pour la formulation », listes bannies P-03, lexique P-09, corpus Anima P-04, affect P-14.
- **UX** : [`EXPERIENCE.md:111`](_bmad-output/planning-artifacts/ux-designs/ux-Anima-2026-07-21/EXPERIENCE.md) (troncature à la 3ᵉ ponctuation + manquement journalisé), `:113` (emoji/`!`/majuscule = « Filtre de sortie »), `:132` (liste lexicale). [`DESIGN.md`](_bmad-output/planning-artifacts/ux-designs/ux-Anima-2026-07-21/DESIGN.md) (« au-delà de 3 phrases = défaut de génération »).
- **Architecture** : [`ARCHITECTURE-SPINE.md`](_bmad-output/planning-artifacts/architecture/architecture-Anima-2026-07-22/ARCHITECTURE-SPINE.md) — AD-1, AD-2, AD-4, AD-5, AD-7, AD-10, AD-16 ; Opérations « Tests & CI/CD (bloquants) » point (b) (formulations bannies + lexique zéro médical) ; Convention « registre système, jamais signée Anam ».
- **Code (points d'accroche)** : [`route.ts:169-176,245-260`](app/api/anam/message/route.ts), [`signaux-arc.ts:40-43`](lib/domain/signaux-arc.ts#L40-L43) (motif), [`consigne-phase.ts:30`](lib/domain/consigne-phase.ts#L30) (patron consigne), [`consigne-detresse.ts:44-60`](lib/safety/consigne-detresse.ts#L44-L60) (overlay détresse), [`ci.yml`](.github/workflows/ci.yml).
- **Coutures léguées** : [`deferred-work.md:36,54,56`](_bmad-output/implementation-artifacts/deferred-work.md) (composition voix `[voix, détresse, …messages]` ; voix ≤ 3 phrases / hypothèses / anti-flatterie ; distribution des restitutions portée par la voix/consigne).

## Dev Agent Record

### Agent Model Used

Opus 4.8 (1M context) — dev-story TDD (red → green → refactor), env node.

### Debug Log References

- **Décision de conception (déviation actée)** : `!` et majuscules d'emphase **retirés du scan statique** (T1/T5). Le code source regorge de `!==`, `!bloque`, sigles, constantes → un scan de `!`/MAJUSCULE sur la source produirait des faux positifs massifs. L'AC bloquante (epics:683) ne vise que **lexique médical + formulations + soin/soigner** ; la discipline `!`/majuscule concerne la **sortie live** d'Anam (FR-083) → portée par la consigne (T3). Emoji conservé dans le scan (sûr : quasi jamais en code).
- **Insight T2** : « le 3ᵉ groupe de ponctuation finale est clos » se réduit à « il finit avant la fin de la chaîne » — car le `+` glouton garantit que le caractère suivant un groupe est toujours non-final. Rend `pointDeCoupe` trivialement correct sur le flux (pas de coupe prématurée d'un groupe qui grandit).
- **Garde de sécurité DURE (T4)** : troncature `if (tronquerVoix = niveauSecurite === 0)` — en détresse, jamais de coupe (une orientation dépasse 3 phrases et ne doit pas être tronquée avant le 3114). La boucle **ne `break` pas** à la coupe : elle draine jusqu'à `fin` pour ne pas perdre l'usage réel (métrage honnête, FR-043).
- **Guard 2.7 mis à jour** : `pipeline-securite-architecture.test.ts` asseyait `[consignePhase, consigneDetresse]` → devient `[consigneVoix, consignePhase, consigneDetresse]` (la composition a évolué, l'invariant « détresse au plus près des messages » est préservé).
- **Mutation vérifiée (T5)** : injection de « soigne ta dépression » dans `lib/scene/regions.ts` → le test du fichier vire au rouge (attrape `depression`+`soigne`), reverté. Preuve que la boucle de scan lit les vrais fichiers (non-tautologique).

### Completion Notes List

Story livrée en 6 tâches TDD. **Deux livrables, tout serveur, tout prouvé en CI :**

- **La voix (a)** : `consigne-voix.ts` (consigne système de base, injectée en tête `[voix, phase, détresse, …messages]`) + `voix-anam.ts` (troncature déterministe à 3 phrases sur le flux, **gatée hors détresse**). Manquement journalisé serveur (aucun art. 9, aucune trame). Client inchangé.
- **Le contrôle bloquant (b)** : `lexique-interdit.ts` (source unique pure, anti-faux-positifs) + `tests/lexique-voix.test.ts` (scan récursif de `app/**`+`render/**`+libellés `lib`, exclusion des consignes système, allowlist prête, contrôle positif + garde non-vacue + mutation vérifiée). Casse le build CI.

**Vérification des 5 ACs :**
- **AC1** ✅ troncature déterministe à la 3ᵉ ponctuation finale (`pointDeCoupe`, 7 tests dont streaming multi-delta), gatée `niveauSecurite === 0`, manquement journalisé ; forme (pas de liste/récap/conclusion) + emoji/`!`/majuscule portés par la consigne.
- **AC2** ✅ hypothèse réfutable « je me trompe ? » dans la consigne (FR-006) — **non mécanisé statiquement** (documenté ; LLM-juge différé).
- **AC3** ✅ recule sans flatter dans la consigne (FR-009) ; écriture durable de la correction → Epic 4 (différé).
- **AC4** ✅ contrôle bloquant transversal, non-tautologique (contrôle positif + exclusion prouvée nécessaire + mutation), casse le build CI ; enforcement déploiement = porte ops (différé).
- **AC5** ✅ Anam ≠ Anima + interdit d'affect dans la consigne (FR-086/087) ; revendications d'affect fixes aussi dans le lexique ; **appariement citation↔corpus Anima différé** (aucun corpus n'existe).

**Validations** : `npx tsc --noEmit` propre · `npx eslint .` propre · **63 fichiers / 696 tests verts** (587 → 696, +109) · `npm run build` propre. Contenu (consigne, lexique) **PROVISOIRE** — porte pré-lancement produit/clinique.

### File List

**Nouveaux — cœurs purs (`lib/domain/`) :**
- `lib/domain/lexique-interdit.ts` — source unique des interdits (médical/soigner/formulation/affect/emoji), anti-faux-positif.
- `lib/domain/voix-anam.ts` — `pointDeCoupe` / `tronquerATroisPhrases` (troncature déterministe).
- `lib/domain/consigne-voix.ts` — `consigneVoixAnam()` (consigne système de voix, PROVISOIRE).

**Nouveaux — tests :**
- `tests/lexique-interdit.test.ts` (42) · `tests/voix-anam.test.ts` (7) · `tests/consigne-voix.test.ts` (5) · `tests/lexique-voix.test.ts` (51, le contrôle bloquant).

**Modifiés :**
- `app/api/anam/message/route.ts` — injection `consigneVoix` en tête + troncature sur flux (cœur pur `absorberDelta`) gatée `niveauSecurite === 0` + manquement journalisé (drain préservé).
- `lib/safety/consigne-detresse.ts` — (revue 2.8) puce de préséance : l'overlay détresse prime sur la voix (orientation directe, jamais en hypothèse ni compressée).
- `tests/pipeline-securite-architecture.test.ts` — guard 2.7 d'ordre mis à jour + bloc de gardes 2.8 (injection voix, troncature gatée, no-leak manquement, pureté des cœurs de voix).
- `lib/domain/README.md` — section « La voix d'Anam (Story 2.8) ».
- `_bmad-output/implementation-artifacts/deferred-work.md` — section « Story 2.8 » + trouvailles LOW de la revue.

## Change Log

| Date | Version | Description | Author |
|---|---|---|---|
| 2026-07-29 | v1.1 | **Revue adversariale multi-agents (locale, 24 agents, 6 dimensions) — corrections.** 18 trouvailles → 13 retenues (4 CONFIRMED, 9 PLAUSIBLE ; 5 réfutées) ; aucune n'était un trou de sécurité (la garde détresse tient, le 3114 part par la trame). Appliqué : **troncature** — `pointDeCoupe` ignore la queue blanche (plus de faux « manquement FR-084 », F5) et les points décimaux (`2.5` jamais coupé, F10) ; la mécanique de coupe sur flux extraite en cœur PUR `absorberDelta` **testé comportementalement** (multi-delta, drain, F11). **Lexique** — `soigner` borné aux formes verbales (plus de « soigneusement/soigneux/soignant », F1) ; `guérir` couvre le radical -iss- (F6) ; `trouble` gaté par déterminant (F7) ; emoji resserré à `Emoji_Presentation`|VS16 (épargne © ® ™ ♥, attrape les drapeaux, F2/F8) ; « traiter » volontairement omis (collision RGPD). **Contrôle bloquant** — scan récursif de tout `lib/` moins EXCLUS (plus la liste en dur de 3 fichiers ; futur module de libellés auto-couvert, F3). **Gardes** — assertion FR-086 dé-tautologisée (F12) ; puce de préséance ajoutée à l'overlay détresse (la voix ne dilue jamais l'orientation, F4). LOW différés documentés (CSS/SVG, strings, keycaps, résidu soigné). **63 fichiers / 748 tests verts · tsc/eslint/build propres.** | Julian (via Opus 4.8) |
| 2026-07-29 | v1.0 | **Implémentation (dev-story) — T1→T6 en TDD strict.** Deux livrables, tout serveur : **(a) la voix** — `consigne-voix.ts` (consigne de base injectée en tête `[voix, phase, détresse, …messages]`) + `voix-anam.ts` (troncature déterministe à 3 phrases sur le flux, **gatée `niveauSecurite === 0`** — jamais couper une réponse de détresse ; drain préservé pour le métrage honnête ; manquement journalisé serveur, no-leak) ; **(b) le contrôle bloquant** — `lexique-interdit.ts` (source unique pure, anti-faux-positif : `besoin`≠soin, `traitement`≠traiter, `santé` seul légitime) + `tests/lexique-voix.test.ts` (scan récursif `app`/`render`/libellés, exclusion des consignes système prouvée nécessaire, contrôle positif + garde non-vacue + **mutation vérifiée**, casse le build CI). Frontières honnêtes : verdict-vs-hypothèse (FR-006) et appariement corpus Anima (FR-086) portés par la consigne + **différés** (pas de corpus). Déviation actée : `!`/majuscule hors scan statique (faux positifs en code) → consigne. **63 fichiers / 696 tests verts · tsc/eslint/build propres · garde mutée.** Statut → review. | Julian (via Opus 4.8) |
| 2026-07-29 | v0.1 | Contexte d'implémentation créé (create-story) — 5 lecteurs parallèles (PRD+reconcile, charte voix, architecture, mécanique code/streaming, surfaces+gardes) + vérification sur pièces des points critiques (composition de consigne, boucle delta, `niveauSecurite`, motif `estReponseLongue`, CI). Deux livrables : **(a) voix** (consigne système `consigne-voix.ts` + troncature déterministe `voix-anam.ts` sur flux, **gatée `niveauSecurite === 0`**) et **(b) contrôle bloquant** (`tests/lexique-voix.test.ts` : scan récursif de tout le contenu, source unique `lexique-interdit.ts`, exclusions consignes + allowlist disclaimer + contrôle positif anti-tautologie). Frontières tranchées : verdict-vs-hypothèse (FR-006) et appariement corpus Anima (FR-086) **non détectables statiquement** → consigne + différé, non revendiqués mécanisés. Garde de sécurité dure identifiée (troncature suspendue en détresse). Enforcement déploiement = protection de branche externe (porte ops). Contenu consignes/lexique PROVISOIRE. | Julian (via Opus 4.8) |
