---
baseline_commit: 981d9da9753d924b712036026182a5b395ec2c2d
---

# Story 4.5: La naissance d'une branche — Anam propose, l'utilisatrice valide et nomme

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant qu'**utilisatrice**,
je veux qu'**Anam me propose de faire une branche d'un moment (le lendemain, jamais sur l'instant), que je décide oui ou non, et que je la nomme avec mes propres mots**,
afin que **rien ne soit décrété sur moi, que le moment reste le mien, et que la branche pointe exactement là où ça s'est produit**.

C'est le **consommateur** du signal produit muet par la Story 4.4 : le germe (`signal_reconceptualisation` en attente) devient, un jour plus tard et si l'utilisatrice le valide, une **branche nommée** — la troisième couche de la mémoire (AD-8) enfin écrite.

## Acceptance Criteria

1. **Étant donné** un signal de reconceptualisation retenu **la veille (ou un jour civil antérieur)**, **Quand** l'utilisatrice revient, **Alors** Anam **propose** une branche en conversation (**le lendemain, jamais sur l'instant**), avec deux réponses en ligne « Oui » / « Non », **Et** elle ne la crée **jamais** d'office. *(FR-025 ; charte §6.2 « effet trahison » ; le silence intermédiaire du jour même est garanti par le signal muet de 4.4.)*

2. **[DUR]** **Étant donné** une proposition acceptée, **Quand** l'utilisatrice nomme la branche, **Alors** un champ **vide** s'ouvre (**aucun** nom pré-rempli, **aucune** suggestion, **aucun** exemple), **Et** une branche **sans nom donné par elle n'est jamais persistée : elle n'existe pas**. *(FR-026 ; charte §6.3 « Tes mots, pas les miens ».)*

3. **Étant donné** une branche créée, **Quand** elle est écrite, **Alors** elle porte le **nom de l'utilisatrice**, sa `date_naissance`, l'état `naissance`, et un `extrait_source_id` pointant vers le **message exact** (`entree_journal`) dont elle provient. *(FR-027, FR-062 ; AD-8.)*

4. **Étant donné** un refus « Non », **Quand** l'utilisatrice répond, **Alors** Anam renvoie « **Ok.** » et **rien d'autre** (aucune insistance, aucun « tu es sûre ? »), **Et** la proposition n'est **jamais** rejouée pour le même moment. *(FR-025 ; charte §6.3.)*

5. **[DUR / AD-17]** **Étant donné** un épisode de détresse en cours **ou dans les 72 h**, **Quand** la création de branche est tentée, **Alors** elle est refusée **au point d'écriture** (le chemin d'écriture interroge `episode_detresse` via `branche_bloquee_par_detresse()`) — **aucune branche ne naît d'un moment de détresse**. **Et** la proposition elle-même n'est pas rendue pendant la fenêtre (FR-042). *(AD-8, AD-16, AD-17.)*

6. **Étant donné** l'extrait source d'une branche, **Quand** on tente de le supprimer **isolément**, **Alors** c'est refusé — le lien branche → extrait ne peut pas être cassé (seul l'effacement exhaustif FR-067, service_role, Epic 6, peut retirer une branche et sa source ensemble). *(FR-027 ; AD-8 « l'extrait source d'une branche ne peut être supprimé isolément » ; AD-14.)*

## Tasks / Subtasks

> **Discipline TDD (red → green → refactor), dépendances descendantes (AD-1) :** on écrit du bas vers le haut — migration/DB d'abord, puis domaine pur, puis data (I/O), puis endpoint serveur, puis rendu client. Chaque garde `[DUR]` a un test qui échoue AVANT le code, et une **mutation-vérification** (retirer la garde → le test redevient rouge). Commande de test : `npx vitest run` (Supabase local doit tourner, CLI **globale** `supabase`).

- [x] **T1 — Migration `0021_branche.sql` : la table `branche`, ses gardes RLS, et les transitions du signal (AC2, AC3, AC5, AC6)** ✅ 27/27 verts ; gardes AD-17 + isolation mutation-vérifiées
  - [ ] Table `branche` (miroir du gabarit possédé-JWT `entree_journal`/`fait_extrait`/`signal_reconceptualisation`) : `id uuid pk`, `utilisatrice_id uuid not null references utilisatrice(id) on delete cascade` (purge FR-067), `extrait_source_id uuid not null references entree_journal(id) **on delete restrict**` (AC6 : lien incassable), `nom text not null`, `etat text not null default 'naissance' check (etat in ('naissance','feuillaison','fruit'))` (4.5 n'écrit QUE `naissance` ; la monotonie feuillaison/fruit est la 4.7), `intensite real not null default 0` (feuillaison progressive AD-8, câblée en 4.7), `date_naissance timestamptz not null default now()` (AC3 « datée »), `cree_le`, `maj_le`. **Contrainte `branche_nom_non_vide check (length(btrim(nom)) > 0)`** (AC2 [DUR] au niveau schéma).
  - [ ] Index : `unique (utilisatrice_id, extrait_source_id)` = **une branche par moment source** (idempotence / anti-double-naissance au retry) ; `(utilisatrice_id, etat)` pour la projection arbre (4.6).
  - [ ] RLS `enable` + `force`. Policy **select** propriétaire (survit à la révocation, export FR-067). Policy **insert `with check`** portant **TOUTES** les gardes ATOMIQUEMENT (leçon R1 de la 4.4 — `authenticated` a le grant INSERT table-level, un `.from().insert()` direct saute toute RPC) : `auth.uid() = utilisatrice_id AND a_consenti_art9() AND not est_barre_minorite() AND not branche_bloquee_par_detresse()` (AC5 [DUR] AD-17) `AND exists (entree_journal e where e.id = extrait_source_id and e.utilisatrice_id = (select auth.uid()))` (isolation : le FK seul ignore la RLS de la table référencée) `AND length(btrim(nom)) > 0` (AC2). **Aucune** policy `update`/`delete` sous JWT en 4.5 (le renommage est 4.6, le cycle de vie 4.7, l'effacement service_role Epic 6).
  - [ ] Trigger `maj_le` autoritaire base (patron `resume_glissant`/0019, `signal…_touch_maj`/0020).
  - [ ] **Transitions du signal (réservées explicitement à 4.5 par 0020:67)** : ajouter sur `signal_reconceptualisation` une policy **update** propriétaire (patron `fait_extrait_maj` — `using` propriétaire, `with check` propriétaire + `not est_barre_minorite()`, **sans** `a_consenti_art9()` : une transition de pointeur n'est pas un dépôt de contenu art. 9, et « écarter » doit survivre à la révocation) ; **plus** un trigger `before update` `signal_reconceptualisation_garde_transition` qui LÈVE si `old.statut <> 'en_attente'` (terminal immuable, anti-résurrection — mord aussi service_role) ou si `new.statut not in ('consomme','ecarte')` (seules cibles légales).
  - [ ] RPC **`creer_branche_depuis_signal(p_signal_id uuid, p_nom text)`** `security invoker`, atomique : (1) fast-fail `if branche_bloquee_par_detresse() then raise` (AD-17, message clair — la garantie atomique reste le WITH CHECK) ; (2) résout `v_entree := entree_journal_id from signal_reconceptualisation where id=p_signal_id and utilisatrice_id=auth.uid() and statut='en_attente'` — LÈVE si `null` (isolation **et** anti-rejeu : un signal déjà `consomme`/`ecarte` n'est plus `en_attente`) ; (3) `if length(btrim(p_nom))=0 then raise` (AC2, message clair) ; (4) `insert into branche(...) values(..., v_entree, btrim(p_nom), 'naissance') on conflict (utilisatrice_id, extrait_source_id) do nothing` ; (5) `update signal_reconceptualisation set statut='consomme' where id=p_signal_id and statut='en_attente'`. `revoke execute from public, anon ; grant to authenticated`.
  - [ ] RPC **`ecarter_signal_reconceptualisation(p_signal_id uuid)`** `security invoker` (chemin « Non ») : `update signal_reconceptualisation set statut='ecarte' where id=p_signal_id and utilisatrice_id=auth.uid() and statut='en_attente'` (idempotent, jamais rejoué : le trigger interdit tout re-changement depuis un état terminal). `revoke`/`grant` idem.
  - [ ] RPC **`charger_proposition_branche()`** `security invoker` `stable` : renvoie le **plus ancien** signal `en_attente` **éligible** — `returns table(signal_id uuid, extrait_contenu text, signal_cree_le timestamptz)` — `where s.utilisatrice_id = auth.uid() and s.statut='en_attente' and (s.cree_le at time zone 'Europe/Paris')::date < (now() at time zone 'Europe/Paris')::date` (**« le lendemain » [DUR AC1]**, jour civil strictement antérieur, fuseau Europe/Paris — DST géré par Postgres) `and not branche_bloquee_par_detresse()` (AC5/FR-042 : rien proposé en fenêtre détresse) `order by s.cree_le asc limit 1`. `revoke`/`grant` idem. *(La lecture reste ainsi dans une RPC — respecte la garde d'archi R6 qui bannit `.from("signal_reconceptualisation")` hors dépôt.)*

- [x] **T2 — Domaine pur `lib/domain/branche.ts` (AC1, AC2, AC4) — 0 I/O (AD-1)** ✅ 7/7. Note : les libellés d'affichage (« Ok. », invite de nommage) sont descendus en `render/conversation/copie-proposition.ts` (le rendu ne peut pas importer `lib/`, AD-7) ; le domaine ne garde que le calculé-serveur (`phraseProposition`, `nomValide`).
  - [ ] Constantes de voix (charte §6.3, citées) : `INVITE_NOMMAGE = "Comment tu l'appelles ?"`, `SOUS_TITRE_NOMMAGE = "Tes mots, pas les miens."`, `REPONSE_REFUS = "Ok."` (exactement, **sans** point d'exclamation ni relance — AC4).
  - [ ] `phraseProposition({ signalCreeLe, maintenant }): string` — construit le tour de proposition **déterministe** (aucun LLM) à partir du délai en jours civils Paris : `= 1 j` → « Il s'est passé quelque chose hier soir. Tu veux en faire une branche ? » ; `> 1 j` → « Il s'est passé quelque chose l'autre jour. Tu veux en faire une branche ? » (charte §6.2, version canonique courte). *La citation verbatim du mot exact (« quand tu as écrit que… ») est une amélioration différée — évite le snippeting hasardeux d'art. 9 en v1 ; voir Dev Notes.*
  - [ ] `nomValide(nom: string): boolean` = `btrim(nom).length > 0` — miroir applicatif du garde-fou serveur (AC2). Le doute (chaîne d'espaces) → invalide.
  - [ ] Aucune dépendance à `episode_detresse`/détresse ici (séparation reconceptualisation ≠ détresse, cf. 4.4 AC5). Aucun import Next/Supabase/DOM.

- [x] **T3 — Data `lib/data/depot-branche.ts` + extension `depot-reconceptualisation.ts` (AC2, AC3, AC4) — I/O sous JWT (AD-1)** ✅ 8/8
  - [ ] Étendre `DepotSignalReconcept` (`lib/data/depot-reconceptualisation.ts`) : ajouter `chargerProposition(): Promise<PropositionEnAttente | null>` (appelle `charger_proposition_branche` via `supabase.rpc`, mappe la 1re ligne ou `null`) et `ecarter({ signalId }): Promise<void>` (appelle `ecarter_signal_reconceptualisation`). Ne jamais faire `.from("signal_reconceptualisation")` (garde R6).
  - [ ] Nouveau `lib/data/depot-branche.ts` : `creerDepotBranche(client?)` → `creerDepuisSignal({ signalId, nom }): Promise<void>` (appelle `creer_branche_depuis_signal`). **NFR-022** : toute erreur relancée ne porte que le **code Postgres**, jamais `nom`/contenu/art. 9 (patron `depot-reconceptualisation.ts`). Ne jamais faire `.from("branche")`.
  - [ ] Réutiliser le client authentifié transmis (comme 4.4) pour éviter une relecture de cookie hors requête.

- [x] **T4 — Serveur : chargement à l'ouverture + endpoint d'écriture (AC1, AC2, AC3, AC4, AC5)** ✅ 9/9
  - [ ] `app/page.tsx` (déjà Server Component sous session RLS, après la garde onboarding, avant `<SceneDom>`) : appeler un orchestrateur `lib/safety/ouverture-branche.ts → chargerPropositionOuverture(supabase, maintenant)` qui lit `depotSignal.chargerProposition()` puis construit `{ signalId, phrase } = { signalId, phraseProposition(...) }` **ou `null`**. Repli sûr : toute erreur → `null` (jamais bloquer l'ouverture, jamais de 500 ; incident journalisé sans art. 9). Passer `propositionBranche` en **prop** à `SceneDom` → `Conversation` (aucune donnée art. 9 en clair dans la prop : seulement `signalId` + la phrase générique — pas le verbatim source en v1).
  - [ ] Nouvel endpoint `app/api/anam/branche/route.ts` (miroir structurel léger de `message/route.ts` : `createSupabaseServerClient` + `getUser` → 401) acceptant un corps discriminé : `{ action: "creer", signalId, nom }` → `creerDepotBranche(supabase).creerDepuisSignal(...)` ; `{ action: "refus", signalId }` → `depotSignal.ecarter(...)`. Valide `nom` non vide côté serveur (AC2, même si la RPC/table le garde aussi). Réponses neutres `{ ok: true }` / `{ code }` (NFR-022). Aucune clé IA, aucun `process.env` secret ici (AD-2).
  - [ ] Ne PAS toucher au pipeline de `message/route.ts` (la proposition est un chemin d'ouverture distinct, pas un tour utilisatrice — voir Dev Notes « point d'injection »).

- [x] **T5 — Rendu client : proposition Oui/Non + champ de nommage (AC1, AC2, AC4) — muet, AD-7** ✅ amorçage au montage, patron paywall
  - [ ] Nouveau variant de `Tour` (`render/conversation/types.ts`) : `{ role: "proposition-branche"; id; signalId; phrase; etat: "propose" | "nomme" | "refuse" | "nee" }` (patron de la carte `paywall`). Le rendu **ne décide rien** : il dessine et remonte des callbacks.
  - [ ] Composant `render/conversation/PropositionBranche.tsx` (patron `CarteAbonnement.tsx`) : le tour d'Anam (registre `anam`, sérif) + **deux boutons d'égale lisibilité** « Oui » / « Non » (cibles ≥ 44 px, anneau de focus jamais supprimé). « Non » → POST `{action:"refus"}` → remplace le bloc par le tour d'Anam « Ok. » (AC4), non rejouable. « Oui » → passe `etat="nomme"`.
  - [ ] Champ de nommage (état `nomme`) : **input dédié** (PAS le `Composeur`, lié à `/api/anam/message`), **vide**, avec **étiquette visible** « Comment tu l'appelles ? » (jamais placeholder-en-guise-d'étiquette), sous-titre « Tes mots, pas les miens. », **aucune** valeur par défaut / suggestion / exemple (AC2). Bouton de validation **désactivé tant que le champ trimmé est vide** (AC2 [DUR] côté UI — décision produit, voir Dev Notes) ; envoi par bouton (jamais par `Entrée` seul sur `sm`). Sur validation → POST `{action:"creer", signalId, nom}` → à succès, remplace le bloc par une confirmation **sobre, sans célébration** (le nom rendu dans la police de l'**utilisatrice**, `corps`/Inter, jamais `anam` — cf. règle load-bearing DESIGN.md), état `nee`. **Aucun** confetti / particule / animation festive (anti-pattern EXPERIENCE.md).
  - [ ] Câblage `Conversation.tsx` : au **montage**, si `propositionBranche` (prop serveur) est présente, **amorcer** le fil avec un tour `proposition-branche` (miroir du beat visuel `"ouverture"` déjà monté client). Callbacks Oui/Non/valider vers `fetch("/api/anam/branche")`. `Fil.tsx` : router le nouveau variant vers `PropositionBranche`.
  - [ ] Discrétion : `<title>` reste « Anam », l'URL ne porte aucun nom de branche ; le nom/verbatim ne quitte jamais l'app.

- [x] **T6 — Tests, gardes d'architecture, non-régression (tous AC)** ✅ 1178 verts (106/106), tsc/eslint/build propres, db 0001→0021 propre
  - [ ] `tests/branche.test.ts` (miroir de `signal-reconceptualisation.test.ts`, intégration DB) : schéma/contraintes ; **deny-by-default** ; **write-gate** (a_consenti_art9 / est_barre_minorite) ; **isolation** (extrait_source d'autrui refusé, direct ET via RPC) ; **AC5 [DUR] AD-17** — `.from("branche").insert()` **direct** pendant détresse/72 h REFUSÉ (contrôle positif hors fenêtre : accepté) ; **AC2** — `nom` vide/espaces refusé (table CHECK + RPC + policy) ; **idempotence/anti-double-naissance** (retry → une branche) ; **AC6** — delete direct de l'`entree_journal` source REFUSÉ (FK restrict / pas de policy delete) ; **transition signal** (en_attente→consomme via `creer`, en_attente→ecarte via `ecarter`, terminal→* refusé par le trigger, anti-rejeu AC4).
  - [ ] `tests/branche-domaine.test.ts` : `phraseProposition` (hier/l'autre jour), `nomValide` (vide/espaces/valide), constantes de voix (« Ok. » exact, pas de « ! »).
  - [ ] `tests/branche-lendemain.test.ts` (intégration) : signal daté d'hier (Paris) → renvoyé par `charger_proposition_branche` ; daté d'aujourd'hui → **exclu** (AC1 [DUR] « jamais sur l'instant ») ; en fenêtre détresse → exclu (AC5).
  - [ ] `tests/branche-endpoint.test.ts` : `POST /api/anam/branche` — 401 sans session ; `creer` heureux ; `refus` → ecarte ; `nom` vide → refus ; NFR-022 (aucune fuite art. 9 dans la réponse d'erreur).
  - [ ] **Garde d'archi** `tests/branche-architecture.test.ts` : bannit `.from("branche"` hors `lib/data/depot-branche.ts` (patron R6 de 4.4 : `/\bfrom\s*\(\s*[`'"]branche\b/`) ; vérifie que `lib/domain/branche.ts` n'importe ni Next, ni Supabase, ni détresse (AD-1, séparation) ; vérifie que `render/` ne lit aucun secret (AD-2).
  - [ ] `tests/consentement.test.ts` : ajouter `branche` à la sonde de frontière art. 9 (deny-by-default + write-gate), comme fait pour `signal_reconceptualisation` en 4.4.
  - [ ] **Non-régression** : la db reset 0001→0021 passe propre ; `projectionInitiale`/`lib/scene` inchangés (la projection réelle des branches reste la 4.6) ; les 1115 tests de 4.4 restent verts ; `tsc`/`eslint`/`build` propres. La garde onboarding de `app/page.tsx` est **préservée à l'identique** (l'ajout du chargement de proposition vient APRÈS `etape === "suite"`, jamais avant une redirection).

## Dev Notes

### Le fait le plus important : la proposition proactive à l'ouverture est **net-new**

L'epic supposait qu'Anam pouvait « proposer à l'ouverture ». **Ce n'est pas le cas aujourd'hui.** Le beat `"ouverture"` est purement **visuel** (une apparition d'image montée client — [render/conversation/Conversation.tsx:41-43](render/conversation/Conversation.tsx#L41-L43), [render/conversation/ApparitionAnam.tsx:19-31](render/conversation/ApparitionAnam.tsx#L19-L31)) ; le fil démarre **vide** ([Conversation.tsx:34](render/conversation/Conversation.tsx#L34)) ; la route [app/api/anam/message/route.ts](app/api/anam/message/route.ts) est **entièrement réactive** (elle exige un tour utilisatrice, journalise le dernier message, génère en réponse) ; il n'existe **aucun** endpoint « démarrer une séance », et le serveur n'émet **jamais** de beat `"ouverture"`.

**Mécanisme retenu (le plus aligné sur l'archi, sans nouveau streaming) :** [app/page.tsx](app/page.tsx) est **déjà** un Server Component sous session RLS. Après la garde onboarding (état `"suite"`), il lit une éventuelle proposition (`chargerPropositionOuverture`) et la passe en **prop** à `SceneDom` → `Conversation`, qui **amorce** le fil avec un tour de proposition + bloc Oui/Non au montage (miroir du beat visuel déjà monté client). Aucun tour d'Anam LLM, aucune fuite d'art. 9 dans la prop : seulement `signalId` + une phrase **générique déterministe**. Le champ de nommage et l'écriture passent par un **endpoint dédié** `POST /api/anam/branche`, jamais par la route `message`.

**Pourquoi pas un `generateMetadata`/streaming/nouvel endpoint d'ouverture ?** Parce que la proposition est un **contenu statique déterministe** (template + délai), calculable côté serveur au chargement — pas besoin du modèle, pas besoin de flux. Cela garde 4.5 shippable **sans** l'ordonnanceur (Story 4.8) ni l'infra de notification push.

### Périmètre — ce que 4.5 livre et ce qu'elle NE livre PAS

| Livré (4.5) | Différé (story) |
|---|---|
| La proposition **in-app** à l'ouverture (page load) | La **notification push** qui fait revenir (rare, 1/72 h, jamais le soir) → infra notif + ordonnanceur 4.8 (Epic 4/5) |
| Oui/Non en ligne, champ de nommage vide | La **projection visuelle** de la branche sur l'arbre → **4.6** |
| L'écriture de la branche (`etat='naissance'`) + gardes | Le **cycle de vie** monotone naissance→feuillaison→fruit (`intensite`, CHECK/trigger, fonction de transition) → **4.7** |
| Transition du signal en_attente→consomme/ecarte | Le **renommage** d'une branche (« Renommer » sur la fiche) → **4.6** |
| Citation verbatim déférée : proposition **générique** | La proposition ancrée « quand tu as écrit que… » (snippeting d'art. 9) → amélioration future |

### Modèle de données — décisions load-bearing

- **`extrait_source_id → entree_journal(id) ON DELETE RESTRICT`** (≠ `on delete set null` de `fait_extrait`) : AC6 + AD-8 « l'extrait source d'une branche ne peut être supprimé isolément ». Sous JWT, `entree_journal` n'a **déjà** aucune policy delete → un utilisateur ne peut de toute façon pas le supprimer ; le `restrict` durcit le niveau intégrité (même service_role) : on ne peut effacer la source qu'en effaçant d'abord la branche. ⚠️ **Contrainte pour Epic 6 (AD-14)** : le moteur d'effacement exhaustif DOIT supprimer `branche` **avant** son `entree_journal` source (l'ordre importe à cause du `restrict`). À documenter dans `deferred-work.md` comme dépendance de l'effacement. *(Il n'existe aucun chemin de suppression de compte en prod aujourd'hui → `restrict` est sûr maintenant.)*
- **`nom` = art. 9** (il nomme un basculement psychologique) → table de **contenu** art. 9 : write-gate `a_consenti_art9()` dans la policy insert, chiffrée au repos (Supabase). Le `nom` ne transite **jamais** vers un modèle (déterministe de bout en bout).
- **`unique (utilisatrice_id, extrait_source_id)`** : une branche par moment source → idempotence naturelle (un double-clic / retry sur « valider » = une seule branche, `on conflict do nothing`).
- **`etat`/`intensite` schéma-complets mais non gardés en 4.5** : l'enum complet + `intensite` sont posés maintenant (conventions SPINE : « état de branche = enum monotone + intensite continue ») pour éviter une migration de colonne en 4.7 ; mais **aucune** transition n'est écrite en 4.5 (pas de policy update sur `branche`), donc la monotonie SQL (CHECK/trigger) et la fonction de transition unique restent **entièrement** la 4.7.

### AD-17 — la double-défense, appliquée telle qu'apprise en 4.4 (leçon R1)

`branche_bloquee_par_detresse()` (0010) a été **conçue explicitement pour ce write-gate** : commentaire de 0010 — « le futur write-gate de `branche` (Epic 4) l'appellera dans son WITH CHECK ». Donc :
1. **Garde au point d'écriture (le [DUR] AC5)** : `not branche_bloquee_par_detresse()` dans la **policy insert WITH CHECK** de `branche` (atomique, couvre TOUT insert — direct `.from().insert()` **et** via RPC). Un fast-fail amical dans la RPC en plus, mais **la garantie vit dans la policy** (sinon « double-défense » illusoire — R1/R3 de 4.4, [[supabase-rls-write-gate-dans-policy]]).
2. **Garde à l'affordance** : `charger_proposition_branche()` filtre aussi sur `not branche_bloquee_par_detresse()` → la proposition **n'est pas rendue** en fenêtre détresse (FR-042). C'est un confort UX, **pas** la garantie de sécurité.

Un test de 4.5 DOIT reproduire l'attaque R1 : `.from("branche").insert(...)` **direct** pendant un épisode ouvert / dans les 72 h → **refusé** ; et pointant l'`entree_journal` d'autrui → **refusé** ; contrôle positif hors fenêtre → accepté. Mutation-vérifier (retirer la clause → rouge).

### « Le lendemain » — jour civil Paris, dans la RPC (autoritaire)

AC1 était une **contradiction PRD↔charte tranchée** (C-01, P-07 haute priorité, [reconcile-anam-voice.md:331-337](_bmad-output/planning-artifacts/prds/prd-Anima-2026-07-21/reconcile-anam-voice.md#L331-L337)) : la source motive « proposer sur l'instant produit un **effet trahison** ». Implémentation retenue : filtre `(cree_le at time zone 'Europe/Paris')::date < (now() at time zone 'Europe/Paris')::date` **dans `charger_proposition_branche`** — autoritaire (horloge serveur, jamais cliente), DST géré par Postgres, testable par un signal antidaté. Le **silence intermédiaire** du jour même est déjà garanti : 4.4 pose un signal **muet** (rien à l'écran), 4.5 ne le fait surgir que le lendemain.

### Voix (charte §6, source primaire — ne rien inventer)

- Règle d'or §6 : « **Anam PROPOSE. L'utilisatrice VALIDE et NOMME.** » Règle absolue §6.1 : « **Anam ne décrète JAMAIS une prise de conscience.** »
- Proposition §6.2 (courte, canonique) : « Il s'est passé quelque chose hier soir. Tu veux en faire une branche ? »
- Nommer §6.3 : « **Comment tu l'appelles ?** » / « **Tes mots, pas les miens.** »
- Refus §6.3 : « **Ok.** » — et **rien d'autre**, jamais deux fois pour le même moment.
- Contre-modèle §6.3 (à bannir absolument) : « Bravo, tu viens d'avoir une magnifique prise de conscience ! J'ai créé une branche : … » = « **trois fautes : flatterie, décret, nomination volée** ». **Aucune** célébration à la naissance (anti-pattern EXPERIENCE.md, DESIGN.md : « aucune étincelle, aucune particule, aucune animation festive »).
- Registre : la proposition/refus = voix d'Anam (sérif). Le **nom saisi** et l'**extrait source** = mots de l'**utilisatrice** → police `corps`/Inter, **jamais** `anam` (règle load-bearing DESIGN.md `fiche-branche` : mettre le nom en `anam` reviendrait à attribuer la prise de conscience à Anam — « l'inverse de la promesse du produit »).

### Décisions produit ouvertes (tranchées par défaut ici — à ratifier)

1. **Champ de nommage laissé vide** : **non spécifié** dans EXPERIENCE.md/DESIGN.md/anam-voice.md (le sous-agent UX l'a signalé). Défaut retenu : bouton « valider » **désactivé** tant que le champ trimmé est vide, **aucun** message d'erreur, **aucune** suggestion ; et refus serveur (CHECK + RPC + policy). Cohérent avec « une branche non nommée n'existe pas » et « ne rien inventer silencieusement ».
2. **Confirmation post-naissance** : sobre, sans félicitation — le bloc de nommage est remplacé par une ligne discrète montrant le nom (police utilisatrice) + date, **sans** phrase de célébration d'Anam (§8 « Anam sait se taire »). Wording exact à valider en revue.
3. **Proposition générique** (pas de citation verbatim) en v1.
4. **Notification push différée** — 4.5 = proposition in-app seulement.

### Point d'injection & non-régression

- L'ajout dans [app/page.tsx](app/page.tsx) vient **strictement après** `etape === "suite"` (ligne 34) — la garde onboarding (mineur → signOut+`/entrer?refus=age` ; naissance ; consentement ; revoque ; barre) reste **inchangée**. Repli sûr : toute erreur de lecture → `propositionBranche = null` (jamais de 500, jamais bloquer la scène).
- `lib/scene/` reste **pur** et **inchangé** (la projection réelle des branches est la 4.6 ; `projection.ts` garde son stub gelé). `render/` reste **muet** (AD-7) : il ne lit pas la DB, il reçoit `propositionBranche` par prop et remonte des callbacks.
- Patron UI à répliquer : la carte `paywall` — trame/variant `Tour` ([types.ts:55-61](render/conversation/types.ts#L55-L61)), composant 2 boutons `CarteAbonnement.tsx`, câblage `Conversation.tsx`/`Fil.tsx`.

### Project Structure Notes

- **NEW** : `supabase/migrations/0021_branche.sql`, `lib/domain/branche.ts`, `lib/data/depot-branche.ts`, `lib/safety/ouverture-branche.ts`, `app/api/anam/branche/route.ts`, `render/conversation/PropositionBranche.tsx`, `tests/branche*.test.ts` (+ `branche-domaine`, `branche-lendemain`, `branche-endpoint`, `branche-architecture`).
- **UPDATE** : `lib/data/depot-reconceptualisation.ts` (+ `chargerProposition`, `ecarter`), `render/conversation/types.ts` (variant), `render/conversation/Conversation.tsx` + `Fil.tsx` (câblage), `render/scene-dom.tsx` + `app/page.tsx` (prop `propositionBranche`), `tests/consentement.test.ts` (sonde art. 9).
- Conforme AD-1 (dépendances descendantes : `domain` pur → `data` I/O → `safety` orchestration → `app` → `render` muet), AD-7 (scène pure inchangée), AD-8 (couche 3), AD-16/AD-17 (garde au point d'écriture), AD-2 (aucune clé/secret côté render), AD-12/AD-13 (RLS deny-by-default + write-gate art. 9), NFR-022 (aucun art. 9 en log).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.5] (lignes 865-879) — user story + 6 AC.
- [Source: prd.md] FR-025/026/027/028/029/062/067 (lignes 99-106, 201, 206).
- [Source: reconcile-anam-voice.md#C-01 / P-07] — « le lendemain » vs « sur l'instant », effet trahison ; §6.3 chemin de refus.
- [Source: anam-voice.md#6 Le rituel de la branche] — voix (propose/nomme/refus/contre-modèle).
- [Source: EXPERIENCE.md / DESIGN.md] — Oui/Non en ligne (patron paywall), champ vide, extrait en police utilisatrice, accessibilité (≥44 px, focus, étiquette visible), anti-célébration, discrétion.
- [Source: ARCHITECTURE-SPINE.md] AD-1, AD-7, AD-8, AD-16, AD-17, AD-14 ; conventions (état branche = enum + intensite).
- [Source: supabase/migrations/0020_signal_reconceptualisation.sql] — gabarit possédé-JWT + « transitions consomme/ecarte = Story 4.5 » (ligne 67).
- [Source: supabase/migrations/0010_episode_detresse.sql:129-148] — `branche_bloquee_par_detresse()` « pour le write-gate de branche (Epic 4) ».
- [Source: supabase/migrations/0016_entree_journal.sql] / [0018_fait_extrait.sql] — gabarits table/RPC/trigger, `extrait_source_id`.
- [Source: mémoire [[supabase-rls-write-gate-dans-policy]]] — leçon R1 : gardes dans la policy WITH CHECK, jamais la RPC seule.

## Revue adversariale (IA) — 2026-07-31

Fan-out multi-agents (21 agents, ~1,4 M tokens, 6 angles → vérification adversariale avec reproduction live read-only). **15 findings vérifiés, 13 retenus, 2 réfutés — 0 critique, 0 élevée.** Le cœur (AD-17, isolation, write-gate, anti-rejeu) a **tenu**. Corrections appliquées + re-validées (1179 verts) :

**Corrigés :**
- **#1 [DUR / AC2] — CONFIRMÉ (R1-bis, reproduit live)** : `length(btrim(nom)) > 0` ne strippait que l'espace ASCII → un nom de **tab/NL/NBSP/espace Unicode** faisait naître une branche à nom **invisible** via `.from("branche").insert()` direct (l'app JS `.trim()` était plus stricte que le point d'écriture — exactement l'anti-patron R1). **Fix** : fonction `branche_nom_significatif()` alignée sur `.trim()` (couvre [:space:] + NBSP/espaces Unicode/BOM), utilisée au CHECK + policy + RPC. **Mutation-vérifié** (garde affaiblie → rouge).
- **#4/#8 — CONFIRMÉ (défense en profondeur)** : la policy UPDATE du signal omettait le contrôle d'appartenance de `entree_journal_id`. **Fix** : `exists(...)` ajouté au WITH CHECK (parité avec l'INSERT) + test de repointage refusé.
- **#6/#11 — CONFIRMÉ (NFR-022)** : `charger_proposition_branche` remontait le verbatim art. 9 (`extrait_contenu`) que le dépôt jetait. **Fix** : RPC réduite au pointeur (`signal_id` + horodatage), join supprimé — aucun art. 9 dans le contrat HTTP.
- **#7 — CONFIRMÉ (AC4 race)** : résolution du signal sans verrou → un « Non » concurrent pouvait laisser naître la branche. **Fix** : `for update` sur la ligne signal dans `creer_branche_depuis_signal`.
- **#10 — CONFIRMÉ (cohérence future)** : les deux FK indépendantes ne garantissaient l'appartenance-propriétaire que par la RLS (pas contre un écrivain service_role, Epic 6/4.6-4.7). **Fix** : FK **composite** `(utilisatrice_id, extrait_source_id) → entree_journal(utilisatrice_id, id)` — invariant dur au schéma (+ index unique requis).
- **#2 — CONFIRMÉ (WCAG 2.4.3)** : focus perdu sur `<body>` après « Non » et « Nommer » réussi. **Fix** : `requestAnimationFrame(focus composeur)` (convention `reessayer`/`refuserAbonnement`) + annonces a11y de « Ok. » et de la naissance.
- **#3 — CONFIRMÉ** : échec de « Nommer » totalement silencieux (impasse). **Fix** : ligne neutre `role="alert"` + annonce + champ retryable (jamais un faux « née »).
- **#12 — CONFIRMÉ** : double-POST au double-clic « Nommer ». **Fix** : verrou d'envoi (bouton désactivé pendant le vol).
- **#5 — CONFIRMÉ** : « hier soir » affirmait une heure non connue. **Fix** : « hier » (le filtre autoritaire reste le jour civil Paris SQL).

**Différés (documentés, non bloquants) :**
- **#9 [PLAUSIBLE]** — AC1 « jamais sur l'instant » n'est gardé qu'à la LECTURE (proposition), pas au point d'écriture. **Décision** : AC1 est une règle de **timing de proposition** (l'epic la porte sur la proposition, pas sur l'écriture) — un insert direct d'une branche same-day est l'utilisatrice écrivant sa propre donnée, pas une trahison ni une faille. Non gardé au write-point **par design**.
- **#13 [FAIBLE]** — « Non » optimiste : si le POST échoue, le germe reste en attente → re-proposé une autre session. **Décision** : trade-off assumé (la charte §6.3 veut « Ok. » **immédiat** ; une re-proposition après un échec réseau rare est **sûre**). Documenté.

## Dev Agent Record

### Agent Model Used

Opus 4.8 (1M context) — claude-opus-4-8[1m]

### Debug Log References

### Completion Notes List

Ultimate context engine analysis completed - comprehensive developer guide created. Deux sous-agents d'exploration (flux de séance, UX de la naissance) + lecture directe des migrations sœurs, du SPINE, du PRD et de la charte de voix. Découverte structurante : la proposition proactive à l'ouverture est net-new (mécanisme serveur→client au montage retenu). Décisions de conception documentées (FK restrict, « le lendemain » via jour civil Paris dans la RPC, champ vide, notif différée).

**Implémentation (cœur-d'abord, TDD) — DONE, prête pour revue :**
- **T1** migration `0021_branche.sql` : table `branche` (owned-JWT), gardes RLS `WITH CHECK` (write-gate art.9 + AD-17 + isolation + nom non vide, ATOMIQUES — leçon R1), FK `extrait_source_id` en `restrict` (AC6), unicité `(utilisatrice, extrait_source)` (anti-double-naissance), transitions du signal (policy update + trigger anti-résurrection), RPC `creer_branche_depuis_signal` / `ecarter_signal_reconceptualisation` / `charger_proposition_branche` (« le lendemain » = jour civil Paris + garde détresse). **Gardes AD-17 + isolation MUTATION-VÉRIFIÉES** (retrait → rouge, restauration → vert).
- **T2** `lib/domain/branche.ts` (pur) : `phraseProposition` (hier/l'autre jour), `nomValide`. Libellés d'affichage → `render/conversation/copie-proposition.ts` (frontière AD-7).
- **T3** `lib/data/depot-branche.ts` + extension `depot-reconceptualisation.ts` (`chargerProposition`, `ecarter`), NFR-022.
- **T4** `lib/safety/ouverture-branche.ts` (repli sûr null) + `app/api/anam/branche/route.ts` (creer/refus, 401, nom requis, NFR-022) + câblage `app/page.tsx`.
- **T5** rendu : variant `Tour` + `PropositionBranche.tsx` (Oui/Non ≥44px, champ vide étiqueté, sans suggestion, sobre sans célébration), câblage `Conversation`/`Fil`/`scene-dom`.
- **T6** 8 fichiers de tests (72 dédiés) + 2 gardes d'archi + sonde art.9. **1178 verts (106/106)**, tsc/eslint/build propres.

**À trancher en revue / avec le PO** : wording de la confirmation post-naissance (« Ta branche existe. ») ; champ vide → bouton désactivé (retenu) ; proposition générique (pas de verbatim) ; notif push différée.

### File List

**Nouveaux :**
- `supabase/migrations/0021_branche.sql`
- `lib/domain/branche.ts`
- `lib/data/depot-branche.ts`
- `lib/safety/ouverture-branche.ts`
- `app/api/anam/branche/route.ts`
- `render/conversation/PropositionBranche.tsx`
- `render/conversation/copie-proposition.ts`
- `tests/branche.test.ts`, `tests/branche-lendemain.test.ts`, `tests/branche-domaine.test.ts`, `tests/depot-branche.test.ts`, `tests/branche-endpoint.test.ts`, `tests/ouverture-branche.test.ts`, `tests/branche-architecture.test.ts`

**Modifiés :**
- `lib/data/depot-reconceptualisation.ts` (+ `chargerProposition`, `ecarter`, types)
- `render/conversation/types.ts` (variant `proposition-branche` + `PropositionBrancheData`)
- `render/conversation/Conversation.tsx`, `render/conversation/Fil.tsx`, `render/conversation/conversation.module.css`
- `render/scene-dom.tsx`, `app/page.tsx`
- `tests/consentement.test.ts` (sonde art.9 `branche`)

## Change Log

| Date | Version | Description | Author |
|---|---|---|---|
| 2026-07-30 | 0.1 | Création de la story (create-story) — analyse exhaustive, spec codable | Julian (via BMAD) |
| 2026-07-31 | 1.0 | Implémentation cœur-d'abord (T1-T6), TDD, gardes AD-17 + isolation mutation-vérifiées. 1178 verts, tsc/eslint/build propres. Status → review | Julian (via BMAD dev-story) |
| 2026-07-31 | 1.1 | Revue adversariale (21 agents) : 13 findings retenus (0 critique). 9 corrigés (dont #1 AC2 whitespace [DUR] mutation-vérifié, #10 FK composite, #2/#3/#12 UI-a11y, #6/#11 minimisation art. 9), 2 différés documentés (#9, #13). 1179 verts, build propre | Julian (via revue + fixes) |
