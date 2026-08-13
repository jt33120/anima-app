---
baseline_commit: be163be
---

# Story 3.4 : Allocation résiduelle et métrage d'usage exactement-une-fois

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant qu'**utilisatrice gratuite**,
je veux **continuer un moment à parler à Anam après ma première séance sans que la relation ne s'arrête net, et sans que la première séance soit dégradée**,
afin que **l'abonnement se propose au bon moment, et que le reste de l'app me reste toujours ouvert**.

## Acceptance Criteria

1. **AC1 — Métrage exactement-une-fois par tour LOGIQUE.** Étant donné une **requête IA logique**, quand elle est servie, alors les **tokens serveur sont écrits exactement une fois** dans `usage_ia` (clé d'idempotence), **réconciliés à la fin ou à l'avortement du stream**, et `usage_ia` **ne contient aucune donnée art. 9**. Un **« Réessayer »** du même tour logique **ne recompte pas** (le jeton de tour est stable, fourni par le client, validé serveur, scopé à l'utilisatrice).
2. **AC2 — La première séance est gratuite ET non dégradée.** Étant donné la première séance gratuite, quand elle se déroule, alors sa **qualité n'est pas dégradée** (FR-059 — plein modèle, plein comportement, aucune bascule « gratuit = modèle léger ») **et** elle **n'est pas décomptée de l'allocation résiduelle**, qui ne s'applique qu'**après le bilan** (FR-079).
3. **AC3 — Allocation résiduelle, volume lu de la config à l'exécution.** Étant donné un compte gratuit après la première séance, quand l'utilisatrice continue d'échanger, alors elle dispose d'une **allocation résiduelle de conversation** dont le **volume est lu depuis la configuration à l'exécution** — paramètre produit ajustable, **jamais codé en dur** (FR-079, SPINE L.151).
4. **AC4 — Épuisement : ligne système, composeur visible-désactivé, socle ouvert.** Étant donné l'allocation résiduelle épuisée, quand l'utilisatrice tente de poursuivre, alors une **ligne système unique** en registre produit l'indique (« L'échange avec Anam s'arrête ici pour ce mois-ci. Le reste de l'app reste ouvert. »), le **composeur reste visible mais désactivé** avec **le motif en texte à côté**, et le **socle reste entièrement accessible** — **jamais « Passe au premium pour continuer »**, aucun dark pattern, aucun « Réessayer ».
5. **AC5 — Premium = conversation illimitée.** Étant donné un compte premium (`estPremiumCourante()`, source de vérité 3.1), quand l'utilisatrice échange, alors la **conversation est illimitée** (FR-056) : **aucune coupure de quota**, le gate est court-circuité avant toute lecture de consommation.
6. **AC6 — Détresse lève toute limite ; drapeau faux par défaut.** Étant donné un épisode de détresse (`limites_levees` vrai, AD-9/AD-17), quand le quota serait épuisé, alors la conversation **ne se coupe jamais** et **aucun bandeau/ligne de quota ne s'affiche** — le drapeau lève toute limite pour la durée de l'épisode ; **et** en l'absence du sous-système de détresse, le drapeau vaut **faux par défaut** et ne bloque jamais la coupure de quota ordinaire.

## Tasks / Subtasks

- [x] **T1 — Le jeton de tour stable : métrage exactement-une-fois par tour LOGIQUE (AC1).**
  - [x] RED : cœur pur `jetonTourValide(v: unknown): string | null` (`lib/ai/` ou `lib/domain/`) — accepte un UUID v4 canonique, rejette tout le reste (→ `null`, la route retombe sur son UUID serveur). Table de cas.
  - [x] Client : `Conversation.lancer` génère UN jeton stable par tour logique (`crypto.randomUUID()`), le stocke à côté de l'envoi (`envoisParTour` → `{messages, jeton}`) ; `reessayer` **réutilise le MÊME jeton** (le retry est le même tour logique). Le jeton part dans le corps POST (`{messages, jetonTour}`). `useFluxAnam.envoyer` transporte le jeton.
  - [x] Serveur : la route lit `jetonTour`, `const cleIdempotence = jetonTourValide(corps.jetonTour) ?? crypto.randomUUID()`. Les clés dérivées (`:arc`, `:bilan`) restent scopées dessus → toutes idempotentes.
  - [x] Tests : cœur pur (garde le contrat forward-compat) ; garde de source route (le jeton client alimente `cleIdempotence`, jamais un `randomUUID` inconditionnel) ; garde de source client (le retry réutilise le jeton, ne le régénère pas). Mettre à jour la note « jeton de tour stable **différé** » de `metrage.ts` / `Conversation.tsx` / `deferred-work.md` → **fait**.
  - [x] **Frontière** : le jeton n'est PAS art. 9 (un UUID opaque). Il ne franchit rien d'interdit. `usage_ia` reste sans contenu.

- [x] **T2 — Le paramètre d'allocation lu à l'exécution, jamais codé en dur (AC3).**
  - [x] RED : `limiteAllocationResiduelle(): number | null` (module `server-only`, patron `libelleReleveBancaire()` de `lib/stripe/config.ts`) — lit `process.env.ALLOCATION_RESIDUELLE_TOURS` à l'exécution ; **non posé / invalide → `null`** (aucune coupure : jamais de limite numérique en dur, jamais coupé à zéro, FR-058).
  - [x] Tests : env non posé → `null` ; env = `"20"` → `20` ; env = `"0"` → `0` (coupe après le bilan — cas produit valide) ; env = `"abc"`/négatif → `null` (repli sûr). Garde anti-hardcode : aucune limite numérique littérale dans le prédicat / la route.

- [x] **T3 — Le prédicat PUR de coupure : la dérivation UNIQUE (AC2/AC5/AC6, AD-17 « une seule dérivation »).**
  - [x] RED : `lib/domain/allocation-residuelle.ts` — `doitCouperConversation({ premium, limitesLevees, seanceClose, toursConsommes, limite }): boolean`. Ordre de court-circuit : `premium` → `false` ; `limitesLevees` → `false` (AC6) ; `!seanceClose` → `false` (AC2, pendant la 1ʳᵉ séance) ; `limite == null` → `false` (AC3, non configuré) ; sinon `toursConsommes >= limite`. Optionnel : `toursRestants(...)` pur (télémétrie, jamais affiché en chiffre).
  - [x] Tests : table exhaustive (chaque court-circuit isolé + le comptage). Contrôle : premium ET limitesLevees ET épuisé → `false` (n'importe quel court-circuit gagne).

- [x] **T4 — Le comptage post-séance : `usage_ia` + fenêtre mensuelle (AC2/AC3).**
  - [x] Migration `0015_usage_ia_post_seance.sql` (forward-only) : `alter table public.usage_ia add column post_premiere_seance boolean not null default false`. NON-art. 9 (booléen de phase, aucun contenu). Commentaire mis à jour. (RLS/policy inchangées — deny-by-default tient.)
  - [x] `metrerUsageIa` : accepte `postPremiereSeance?: boolean` (défaut `false`) → colonne. Posé **true UNIQUEMENT sur la ligne PRINCIPALE** du tour (jamais `:arc`/`:bilan` : ce sont des sous-coûts, pas des « tours »), et seulement quand la séance était **déjà close à l'entrée du tour**.
  - [x] `lib/data/lire-allocation.ts` (`server-only`) : `compterToursResiduelsDuMois(utilisatriceId): Promise<number>` — count des lignes `usage_ia` où `post_premiere_seance` **et** `cree_le >= date_trunc('month', now())`, via le client admin (service_role, `usage_ia` est deny-by-default). Repli sûr (AD-15) : panne → **lève** → la route ne coupe pas (fail-open, FR-058).
  - [x] Tests : DB behavioral (vrai Postgres, patron `lire-abonnement`/`usage-ia`) — le flag s'écrit ; une ligne du mois précédent n'est pas comptée ; les lignes `:arc`/`:bilan` ne comptent pas ; la première séance (flag false) ne compte pas.

- [x] **T5 — Le gate serveur dans la route : après la sécurité, avant la génération (AC2/AC4/AC5/AC6).**
  - [x] Hisser `const etatArcCharge = await depotSeance.charger()` **au-dessus** de l'étage arc (réutilisé ensuite par `avancerArc`) pour connaître l'état AVANT ce tour. `seanceClose = etatArcCharge.finProposee` (latch de clôture ; ne régresse pas).
  - [x] Gate (nouveau bloc, **après** `securite`/`clotureAutorisee`, **avant** l'extraction FORT) : si `!securite.limitesLevees` (AC6 court-circuité en amont) ET `seanceClose`, lire `premium = await estPremiumCourante()` (repli en cas de doute : `premium = true` → pas de coupure, cohérent avec 3.2 « le doute suspend le commerce » — MAIS ici le doute penche vers l'ACCÈS) puis `toursConsommes` + `limite`, et `doitCouperConversation(...)` → **couper**.
  - [x] Couper = retourner un flux NDJSON minimal `{t:"quota"}` puis clôturer (aucune génération, **aucun appel FORT**, aucune ligne `usage_ia`). En-têtes `ENTETES_ART9`.
  - [x] Sinon : procéder. Le métrage principal `after()` pose `postPremiereSeance: seanceClose` (le tour de clôture lui-même a `seanceClose=false` → gratuit ; le tour suivant l'aura `true`).
  - [x] Tests : garde de source (ordre : gate APRÈS `securite`, AVANT `diffuserSousEgressArt9` ; bypass si `limitesLevees` ; bypass si `premium` ; `postPremiereSeance` dérivé de l'état chargé, pas de `avancerArc`). Le comptage lit `estPremiumCourante` (source unique 3.1).

- [x] **T6 — L'UX épuisement : ligne système + composeur désactivé-visible (AC4).**
  - [x] Client : trame `{t:"quota"}` (miroir serveur `flux-ndjson.ts` + client `flux-ndjson-client.ts`, signal PUR comme `paywall`). Parser strict. `useFluxAnam` : `onQuota?` — NON terminale au sens « échec » : ce n'est ni un succès (aucun texte d'Anam) ni un échec re-tentable → **pas de « Réessayer »**.
  - [x] `Conversation` : `onQuota` insère une **ligne système** (registre système, jamais signé Anam) + arme un état `quotaEpuise` → passé au `Composeur`. Le tour optimiste de l'utilisatrice reste (jamais retiré). Annonce a11y polie.
  - [x] `Composeur` : prop `motifDesactive?: string` — champ + bouton **désactivés** mais **rendus** (jamais retirés), le **motif affiché à côté** (`aria-describedby`). Anneau de focus préservé sur le reste. Distinct de `occupe` (transitoire) : `quotaEpuise` est persistant.
  - [x] Copie render-local `render/conversation/` (PROVISOIRE, porte produit) : la ligne système + le motif. Garde anti-dark-pattern : la copie **ne contient jamais** « premium », « abonne », « paye », « débloque », « passe à » (le socle reste ouvert, on n'appâte pas). Garde : la ligne cite « le reste de l'app reste ouvert ».
  - [x] Tests : parser trame `quota` ; `Composeur` avec `motifDesactive` rend le motif + désactive (garde de source, env node — pas de DOM) ; garde de copie (interdits + présence du « reste ouvert »).

- [x] **T7 — Régression, différés, doc.**
  - [x] Suite complète verte (`npx vitest run`), tsc + eslint + `next build` propres. Supabase local via CLI GLOBALE (`supabase`), jamais `npx supabase`.
  - [x] `deferred-work.md` : marquer « jeton de tour stable » **RÉSOLU** (2.2/2.4/2.7/2.9) ; ajouter la section « Coutures 3.4 » (unité d'allocation confirmée, fenêtre mensuelle TZ, arc post-séance, `ALLOCATION_RESIDUELLE_TOURS` porte ops).
  - [x] Change Log.

## Dev Notes

### Périmètre exact (ce que 3.4 livre / ne livre PAS)

**Livre :** (1) le **jeton de tour stable** → métrage *exactement-une-fois par tour logique* (clôt la dette 2.2/2.4/2.7/2.9) ; (2) l'**allocation résiduelle** gratuite post-séance, volume **lu de la config à l'exécution** ; (3) le **gate serveur** de coupure (premier vrai consommateur de `estPremiumCourante()`) ; (4) l'**UX épuisement** (ligne système + composeur désactivé-visible) ; (5) les invariants **FR-058** (jamais coupé à zéro), **FR-059** (1ʳᵉ séance non dégradée), **FR-043/AC6** (détresse lève tout).

**Ne livre PAS :** le **paywall** (3.2, fait — l'épuisement de quota ≠ paywall : c'est une ligne système, jamais une carte d'achat) ; le **reset mensuel PROGRAMMÉ** (aucun Ordonnanceur — Epic 6 ; ici la fenêtre « ce mois-ci » est un COUNT filtré `date_trunc('month', now())`, pas un job de remise à zéro) ; l'**arc idempotent au retry** (dette du writer de séance à écrivain unique — 2.7/2.9, séparée : le jeton fixe le MÉTRAGE et l'ALLOCATION, pas les compteurs d'arc) ; la conversation **montée sur une page** (comme 2.2→3.2, on complète la machinerie, prouvée par tests — le montage scène→séance est ultérieur).

### Le design central (le point à challenger)

Le cœur de la 3.4 est **où** et **comment** couper. Trois invariants non négociables fixent l'ordre :

1. **AD-16 (sécurité d'abord) + FR-043/AC6** : le gate de quota vit **APRÈS** le pipeline de sécurité, pour que `securite.limitesLevees` le **lève** inconditionnellement. Un quota qui couperait avant la sécurité serait un défaut critique (paywall/coupure sur une personne en détresse).
2. **Coût** : le gate coupe **AVANT** l'extraction FORT et la génération — un tour bloqué ne doit **jamais** dépenser un appel modèle. D'où le hissage de `depotSeance.charger()` au-dessus de l'étage arc.
3. **AD-9 / offre-pas-verrou (SPINE L.153)** : la coupure de quota est une **ligne système**, jamais un paywall (« Passe au premium » interdit, AC4). Le socle reste ouvert (FR-058). La direction du doute est **l'accès** : toute panne (lecture premium, comptage, config absente) → **on ne coupe pas**.

**« Après le bilan » = l'état d'arc CHARGÉ (`finProposee`), lu AVANT `avancerArc`.** Le tour qui *livre* le bilan entre avec `finProposee=false` (la machine le pose CE tour) → il reste **gratuit** (dernier tour de la séance, non compté). Les tours **suivants** entrent avec `finProposee=true` → post-séance, comptés. C'est propre et réutilise l'état existant (aucune nouvelle horloge — AD-17).

**DÉCISION À CONFIRMER — l'unité d'allocation : TOURS (recommandé) vs TOKENS.** Recommandation **tours de conversation post-séance** comptés dans le mois : (a) légible (« l'échange s'arrête » = un échange), (b) robuste à la verbosité du modèle (équitable), (c) simple à tester, (d) **naturellement idempotent** via le jeton de tour (un tour = un jeton = une unité), (e) évite la garde faux-zéro tokens. Alternative *tokens* (somme `tokens_entree+tokens_sortie` post-séance vs budget) : plus fidèle au coût réel mais opaque/injuste et fragile au faux-zéro. → **à trancher avant dev-story.**

### Invariants SPINE touchés

| AD / conv. | Ce que 3.4 doit tenir |
|---|---|
| **Métrage & paywall** (SPINE L.153) | tokens écrits **exactement une fois** par requête LOGIQUE (jeton stable), réconciliés fin/avortement ; `usage_ia` sans art. 9 ; paywall = **offre**, coupure **seulement** à épuisement FR-079, **jamais** pendant `limites_levees`. |
| **L.151** (paramètres produit) | allocation **lue à l'exécution, jamais codée en dur**. |
| **AD-9 / FR-043** | `limites_levees` lève toute limite ; `/aide` et le socle jamais gardés. Drapeau **faux par défaut**. |
| **AD-17** | une **seule dérivation** de la décision (le prédicat pur), pas de 2ᵉ horloge ; `limites_levees` dérivé de `episode_detresse.fin IS NULL` (déjà, via `securite`). |
| **AD-2 / AD-12** | `usage_ia` server-authoritative (service_role) ; le client ne forge ni ses compteurs ni son entitlement ; le jeton client n'est qu'une clé d'idempotence scopée (un spoof ne collisionne que SON métrage). |
| **AD-7** | `render/` muet : le composeur ne décide RIEN (le serveur coupe, le client rend l'état) ; la copie système est render-local (comme `offre-abonnement.ts` en 3.2). |
| **AD-15** | tous les replis penchent vers **l'accès / le sous-comptage** (jamais couper à tort). |
| **FR-059** | 1ʳᵉ séance **plein modèle** — 3.4 ne doit INTRODUIRE aucune dégradation (aujourd'hui `tierPour` ne dégrade jamais selon le compte ; le prouver par garde). |

### Le gate serveur, précisément (route `app/api/anam/message/route.ts`)

Séquence cible (deltas vs l'existant) :
1. auth → validation → `cleIdempotence = jetonTourValide(corps.jetonTour) ?? crypto.randomUUID()` (**T1**, remplace le `randomUUID` inconditionnel L73).
2. pipeline sécurité (inchangé) → `securite`, `niveauSecurite`, `clotureAutorisee`.
3. `const etatArcCharge = await depotSeance.charger()` **hissé ici** (repli : `charger` lève → traiter comme `seanceClose=false`, ne pas couper). `seanceClose = etatArcCharge.finProposee`.
4. **GATE (T5)** : `if (!securite.limitesLevees && seanceClose)` → `premium = await estPremiumCourante()` (catch → `premium=true`, pas de coupure) ; si `!premium` → `toursConsommes = await compterToursResiduelsDuMois(user.id)` (catch → ne pas couper) ; `if (doitCouperConversation({premium, limitesLevees: securite.limitesLevees, seanceClose, toursConsommes, limite: limiteAllocationResiduelle()}))` → **retour flux `{t:"quota"}`** (aucun FORT, aucune génération, aucune ligne `usage_ia`).
5. étage arc : `avancerArc(etatArcCharge, …)` (réutilise l'état chargé — ne PAS re-`charger`).
6. génération (inchangée) ; `after()` : `metrerUsageIa({…, postPremiereSeance: seanceClose})` sur la ligne principale ; `:arc`/`:bilan` gardent `false`.

⚠️ **Ne jamais** lire premium/consommation pendant la 1ʳᵉ séance (`!seanceClose` court-circuite) ni pour un premium (court-circuit) — aucun surcoût DB hors du cas résiduel-gratuit.

### Le jeton de tour stable (client + serveur)

- Client (`Conversation.tsx`) : `envoisParTour: Map<string, {messages, jeton}>`. `lancer` reçoit/porte le jeton ; `surEnvoi` en crée un (`crypto.randomUUID()`) ; `reessayer` **réutilise** `envoisParTour.get(idAnam).jeton`. `useFluxAnam.envoyer(messages, jeton, rappels)` → body `{messages, jetonTour: jeton}`.
- Serveur : `jetonTourValide` (cœur pur) valide le format UUID (rejette tout autre → repli UUID serveur). Scopé utilisatrice par l'index unique `(utilisatrice_id, cle_idempotence)` (déjà là) → un jeton spoofé ne peut annuler que le PROPRE métrage de la spoofeuse (revue 2.1).
- Effet : un « Réessayer » (même tour logique) → même `cleIdempotence` → `upsert ignoreDuplicates` no-op → **pas de double-métrage, pas de double-consommation d'allocation**. L'arc, lui, n'est PAS rendu idempotent (dette writer de séance, séparée — le noter).

### L'UX épuisement (AC4)

- Trame `quota` = signal PUR (aucun payload) — la **copie vit côté client** (render-local, PROVISOIRE, porte produit), comme `offre-abonnement.ts`. La route ne transporte aucun texte produit.
- `Conversation` : ligne système (registre système, jamais signé Anam — patron `MESSAGE_ECHEC`) insérée sous le tour de l'utilisatrice ; le tour optimiste reste ; `quotaEpuise=true` → `Composeur`.
- `Composeur` : `motifDesactive?: string` → champ + bouton `disabled` mais **rendus** (jamais retirés), motif en `<span>` à côté relié par `aria-describedby`. Anneau de focus préservé. **Aucun bouton d'achat, aucun « Réessayer »** (retenter n'aide pas). Distinct d'`occupe` (transitoire).
- Copie interdite : `premium|abonn|paye|paie|débloqu|passe à|offre` — la coupure de quota **n'appâte pas** ; elle informe et rouvre le socle.

### Patrons de code à suivre (miroir de l'existant)

- Config lue à l'exécution : `libelleReleveBancaire()` [lib/stripe/config.ts].
- Prédicat pur + garde de source route : `doitProposerAbonnement` + `tests/proposer-abonnement.test.ts` (3.2).
- Lecture DB server-only + repli qui lève : `estPremiumCourante` [lib/data/lire-abonnement.ts], `metrerUsageIa` [lib/ai/metrage.ts].
- Trame NDJSON pure (union serveur + miroir client + parser strict + non-terminale) : `paywall` (3.2) dans `flux-ndjson.ts` / `flux-ndjson-client.ts` / `useFluxAnam.ts`.
- Copie render-local + garde anti-dark-pattern : `offre-abonnement.ts` + `tests/offre-abonnement.test.ts` (3.2).
- Migration additive deny-by-default : `0008_usage_ia.sql` (le fichier même qu'on étend).
- Tests DB behavioral sur vrai Postgres : `tests/lire-abonnement.test.ts`, `tests/usage-ia.test.ts`.

### Portes pré-lancement / différé (signaler, pas bloquer)

- **`ALLOCATION_RESIDUELLE_TOURS` = porte ops** : non posé en dev/test → aucune coupure. À poser en config de prod (valeur produit validée) pour activer l'allocation. La copie système est PROVISOIRE (porte produit).
- **Fenêtre mensuelle & fuseau** : `date_trunc('month', now())` en UTC en v1. « pour ce mois-ci » exact (Europe/Paris) est un raffinement produit mineur (dérive de bord de mois) — noter, ne pas bloquer.
- **Arc post-séance encore extrait/métré** : après la clôture, l'extraction FORT tourne encore (arc en `clore`, monotone). Micro-coût ; ré-optimisable (piggyback / court-circuit post-clôture) — hors périmètre, noter.
- **Dette writer de séance (2.7/2.9)** : le jeton stable ne rend PAS l'arc idempotent (concurrence 2 onglets → double-avance possible). Séparée ; l'allocation, elle, est idempotente (comptée depuis `usage_ia` scellé par le jeton).
- **Idempotence sortante Stripe / autres** : sans objet ici.

### References

- Story (epics) : [epics.md](../planning-artifacts/epics.md) §Story 3.4 (l.761-774), FR-055/056/058/059/079, FR-043.
- Métrage & paramètres : [ARCHITECTURE-SPINE.md](../planning-artifacts/architecture/architecture-Anima-2026-07-22/ARCHITECTURE-SPINE.md) L.151 (params à l'exécution), L.153 (Métrage & paywall), AD-9, AD-16, AD-17.
- Séquencement 3.4 avant 3.3 : mémoire `epic-3-reordonnancement` ; [deferred-work.md](deferred-work.md) §« Coutures 3.1 » (l.159 « gardes par fonctionnalité = 3.3/3.4 »).
- Points de touche : [route.ts](../../app/api/anam/message/route.ts), [metrage.ts](../../lib/ai/metrage.ts), [0008_usage_ia.sql](../../supabase/migrations/0008_usage_ia.sql), [lire-abonnement.ts](../../lib/data/lire-abonnement.ts), [Conversation.tsx](../../render/conversation/Conversation.tsx), [Composeur.tsx](../../render/conversation/Composeur.tsx), [useFluxAnam.ts](../../render/conversation/useFluxAnam.ts), [flux-ndjson-client.ts](../../render/conversation/flux-ndjson-client.ts), [depot-seance.ts](../../lib/data/depot-seance.ts).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context)

### Debug Log References

- **Unité d'allocation confirmée = TOURS post-séance** (décision Julian), aligné avec la conception de la story.
- **Insert par lot hétérogène (test T4) → violation NOT NULL 23502.** Un `.insert([...])` où seule la dernière ligne portait `cree_le` envoyait `cree_le: null` aux autres (le défaut `now()` ne couvre qu'une colonne OMISE, pas un NULL explicite). Corrigé : deux inserts homogènes (mois courant sans `cree_le` ; mois précédent avec `cree_le`).
- **3 gardes de régression mises à jour (légitime, pas un affaiblissement) :** (1) `garde-commerciale` — `ligne-quota.ts` matche le motif commercial → ajouté à la dérogation « gate serveur » (copie pure retenue en détresse par la route, comme `offre-abonnement.ts` en 3.2), ancrée au chemin exact + non-vacuité (`gate-quota.test.ts`) ; (2) `conversation-detresse` — le `<textarea>` peut être `disabled={bloque}` (quota) mais JAMAIS pour une raison de détresse (états mutuellement exclusifs : le gate retient `quota` si `limites_levees`) → garde affinée pour l'exiger ; (3) `conversation-accessibilite` — regex `<Composeur ` → `<Composeur\s` (JSX multi-lignes), invariant « rendu inconditionnel » préservé par les gardes négatives `?`/`&&`. `usage-ia` : ensemble de colonnes permises + `post_premiere_seance`.
- **Incident d'outil (récupéré) :** une mutation-vérification a restauré la route via `git checkout` (fichier suivi) → toutes mes éditions NON commitées de la route ont été effacées. Réappliquées intégralement à l'identique ; suite re-verte à 956. Mutations confirmées RED avant l'incident (prédicat premium : 3 échecs ; jeton route : 1 échec).

### Completion Notes List

- **T1** — `lib/ai/jeton-tour.ts` (`jetonTourValide`, UUID canonique, repli UUID serveur) ; client (`Conversation`/`useFluxAnam`) fournit + réutilise le jeton au « Réessayer » ; route l'emploie comme `cleIdempotence`. Dette 2.2/2.4/2.7/2.9 close (notes `metrage.ts`/`Conversation.tsx`/`deferred-work.md` mises à jour).
- **T2** — `lib/ai/allocation-config.ts` (`limiteAllocationResiduelle`, env à l'exécution, `null` si non posé/invalide ; aucun littéral numérique de limite dans la source).
- **T3** — `lib/domain/allocation-residuelle.ts` (`doitCouperConversation`, dérivation unique AD-17 ; court-circuits premium/détresse/1ʳᵉ-séance/non-configuré ; **mutation-vérifié**).
- **T4** — migration `0015` (colonne `post_premiere_seance`, NON-art. 9) ; `metrerUsageIa` porte le flag (ligne principale seule) ; `lib/data/lire-allocation.ts` (`compterToursResiduelsDuMois`, fenêtre mensuelle UTC, repli qui lève → fail-open).
- **T5** — gate dans la route APRÈS sécurité / AVANT extraction FORT ; trace chargée UNE fois (partagée gate+arc) ; `seanceClose` dérivé de `finProposee` chargé ; court-circuit premium ; `postPremiereSeance: seanceClose` au métrage principal ; coupure = flux `{t:"quota"}` seul.
- **T6** — trame `quota` (union serveur + miroir client + parser) ; `useFluxAnam` la traite terminale SANS échec (pas de « Réessayer ») ; `Conversation.onQuota` retire le placeholder + arme `quotaEpuise` ; `Composeur` `motifDesactive` (désactivé-visible, `role="status"`, `aria-describedby`) ; copie render-local `ligne-quota.ts` (ZÉRO appât, « reste ouvert »).
- **Validation** — **956 tests / 84 fichiers verts**, tsc + eslint + `next build` propres. Env `ALLOCATION_RESIDUELLE_TOURS` non posé → aucune coupure (porte ops).

### File List

**Nouveaux :**
- `lib/ai/jeton-tour.ts`
- `lib/ai/allocation-config.ts`
- `lib/domain/allocation-residuelle.ts`
- `lib/data/lire-allocation.ts`
- `render/conversation/ligne-quota.ts`
- `supabase/migrations/0015_usage_ia_post_seance.sql`
- `tests/jeton-tour.test.ts`, `tests/allocation-config.test.ts`, `tests/allocation-residuelle.test.ts`, `tests/lire-allocation.test.ts`, `tests/gate-quota.test.ts`, `tests/quota-client.test.ts`

**Modifiés :**
- `app/api/anam/message/route.ts` (jeton → cleIdempotence ; gate d'allocation ; trace chargée une fois ; `postPremiereSeance` au métrage)
- `lib/ai/metrage.ts` (champ `postPremiereSeance` ; note jeton résolu)
- `lib/ai/flux-ndjson.ts` (trame serveur `quota`)
- `render/conversation/flux-ndjson-client.ts` (miroir + parser `quota`)
- `render/conversation/useFluxAnam.ts` (jeton en param + corps ; `onQuota` terminal sans échec)
- `render/conversation/Conversation.tsx` (jeton stable + réutilisé au retry ; `quotaEpuise` + `onQuota` ; motif au composeur)
- `render/conversation/Composeur.tsx` (`motifDesactive` : désactivé-visible + motif ; focus redirigé, revue F8)
- `render/conversation/Fil.tsx` (masque le « Réessayer » résiduel si quota épuisé, revue F9)
- `render/conversation/conversation.module.css` (`.composeurZone`, `.motifDesactive`, `.champ:disabled`)
- `lib/data/lire-allocation.ts` (exclusion de la propre clé au comptage, revue F4/F5)
- `tests/usage-ia.test.ts`, `tests/garde-commerciale.test.ts`, `tests/conversation-detresse.test.ts`, `tests/conversation-accessibilite.test.ts` (gardes de régression mises à jour)
- `_bmad-output/implementation-artifacts/deferred-work.md` (jeton résolu + coutures 3.4)

### Revue adversariale (AI) — 3.4

Revue multi-agents (6 angles Sonnet × vérification adversariale Opus ; **15 examinées, 2 réfutées, 13 retenues → 10 bugs distincts**). Elle a rattrapé **2 vrais bugs que le TDD avait ratés** (le gate comptait sa propre ligne au « Réessayer » frontière ; un downgrade premium→gratuit polluait le comptage) — comme en 3.1 (concurrence) et 3.2 (2 HAUTES), la revue prouve à nouveau sa valeur.

**Corrigés et mutation-vérifiés (v1.1) — 6 :**
- **F4/F5 (HAUTE)** — gate idempotent au retry : `compterToursResiduelsDuMois` exclut la propre `cle_idempotence` du tour → un « Réessayer » à la frontière `toursConsommes==limite-1` n'est plus muré par sa propre tentative avortée. Mutation-vérifié.
- **F10 (MOYENNE)** — `post_premiere_seance` marqué via `tourAllocationResiduelle` (non premium + post-séance + hors détresse) au lieu de `seanceClose` brut → un downgrade premium→gratuit intra-mois ne recompte plus les tours illimités. Mutation-vérifié.
- **F7 (MOYENNE, a11y)** — annonce unique : `onQuota` ne fait plus `setAnnonce` (le motif `role="status"` du composeur porte seul l'annonce → pas de double).
- **F8 (MOYENNE, a11y)** — focus redirigé vers le motif (`tabIndex=-1` + effet) quand le champ passe `disabled` → jamais retombé sur `<body>` (WCAG 2.4.3).
- **F9 (MOYENNE)** — « Réessayer » résiduel d'un tour antérieur masqué dès `quotaEpuise` (passé au `Fil`) + ceinture dans `reessayer`.
- **F12 (BASSE)** — garde de test durcie : le `return {t:"quota"}` est prouvé IMBRIQUÉ sous `if (couper)` et avant l'étage arc (position bornée), pas seulement présent.

**Différés (réels, avec raison — tous DORMANTS derrière la porte ops `ALLOCATION_RESIDUELLE_TOURS`), cf. deferred-work.md :**
- **F1/F3 (HAUTE)** — `seanceClose` dérive de `finProposee` (latché à la transition) et non de la LIVRAISON du bilan : le fix propre (marqueur `bilan_livre`) touche le **port `DepotSeance` (2.7)** ; sharp-harm exige `limite=0` (anti-FR-079) ; la retentative ne re-livrait déjà pas le bilan (dette d'arc connue). **À acter avec Julian.**
- **F2/F6 (HAUTE→MOYENNE)** — jeton non lié au contenu : abus économique **hors-UI seulement** (l'UI régénère un jeton par tour) ; le fix robuste touche la **posture art. 9** (condensé de contenu) ou exige un **rate-limit** (absent globalement). **À acter avec Julian.**
- **F11 (BASSE)** — télémétrie provisoire figée au rejeu (coût seul, allocation intacte).
- **F13 (BASSE)** — `sansCommentaires` dupliqué (dette de test transverse, 23 fichiers).

## Change Log

| Date | Version | Description | Auteur |
|---|---|---|---|
| 2026-07-29 | v0.1 | create-story — contexte exhaustif ; conception du gate serveur + jeton de tour + allocation config-lue ; décision ouverte tours vs tokens | Julian + Claude |
| 2026-07-30 | v1.0 | dev-story TDD (T1→T7) — jeton de tour stable, allocation résiduelle config-lue, gate serveur post-sécurité, UX quota. 956 tests verts, tsc/eslint/build propres. Statut → review | Claude |
| 2026-07-30 | v1.1 | revue adversariale (13 retenues) — 6 corrigés + mutation-vérifiés (gate idempotent au retry, comptage non pollué par premium, 3× a11y, garde de test) ; 4 différés avec raison (2 HAUTES dormantes derrière la porte ops, à acter). **963 tests verts.** | Claude |
