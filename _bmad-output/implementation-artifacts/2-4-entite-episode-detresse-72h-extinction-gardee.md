---
baseline_commit: 39e81ae853ee451b57503972ce8e9826431496aa
---

# Story 2.4: L'entité `episode_detresse`, la fenêtre 72 h et l'extinction gardée

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant que **développeuse**,
je veux une **entité de détresse possédée** (`episode_detresse`) dont **dérivent** les limites levées, la garde des 72 h et l'extinction,
afin que ces règles vitales proviennent d'**une seule vérité**, ne soient **jamais levées à vie** ni **éteintes trop tôt**, et que la couture `DepotEpisode` laissée prête par la Story 2.3 devienne réelle **sans refactor**.

## Acceptance Criteria

Repris de l'épic (Story 2.4), découpés en critères testables.

1. **[AC1 — l'entité et ses dérivations]** Étant donné l'entité `episode_detresse` (`utilisatrice_id, debut, niveau_max, fin` nullable, `fenetre_expire_at`), quand un épisode s'ouvre, alors :
   - `limites_levees` **dérive** de `fin IS NULL` (épisode ouvert ⇒ limites levées) — une seule source de vérité, jamais deux horloges (AD-17) ;
   - la **fenêtre 72 h** (FR-042) **dérive** de `fenetre_expire_at` ;
   - une **transition d'extinction unique et possédée** ferme l'épisode selon un critère **explicite** : **N tours sûrs consécutifs ET délai minimal écoulé** — le paywall **n'est jamais levé à vie** ni **éteint pendant que la personne est encore en détresse**.

2. **[AC2 — DUR / AD-17 — la garde de branche au point d'écriture]** Étant donné la garde « **aucune branche pendant l'épisode + 72 h** » (FR-042), quand une écriture de branche est tentée, alors elle est refusée **au point d'écriture** en interrogeant `episode_detresse` — **jamais** seulement à la proposition. *(La table `branche` n'existe pas encore — Epic 4 : cette story livre le **prédicat de garde possédé** que `create-branche` sera forcé d'appeler, prouvé par test, exactement comme `est_barre_minorite()` durcit le write-gate art. 9.)*

3. **[AC3 — la table naît protégée art. 9]** Étant donné la frontière art. 9, quand la table `episode_detresse` est créée, alors elle naît en **RLS deny-by-default** (activée + FORCE), protégée **par utilisatrice**, chiffrée au repos au même niveau que le reste (FR-046) — **une table art. 9 sans politique de protection casse le build** (test CI). Un épisode révèle un état de santé mentale : il est **exclu de toute analyse produit / synthèse / arbre** (FR-046) par construction (entité séparée du journal).

4. **[AC4 — la couture 2.3 devient réelle, sans régression]** Étant donné le pipeline sécurité-d'abord (Story 2.3), quand un tour est évalué, alors le `DepotEpisode` **réel** remplace le placeholder : `episodeOuvert()` dérive de `fin IS NULL`, l'épisode est **ouvert / rehaussé / compté / éteint** à chaque tour selon le **niveau DÉTECTÉ BRUT** (pas l'effectif forcé), et **les 402 tests de la 2.3 restent verts** (détection d'abord, forçage fort pour tout l'épisode, audit sans art. 9, repli sûr, veto — tous préservés).

## Tasks / Subtasks

> **TDD strict (red → green → refactor).** Vitest est en env **node** (pas de DOM). Les preuves SQL réelles tournent contre un **Supabase local** (voir *Testing standards*). Ne marquer une tâche `[x]` que lorsque ses tests EXISTENT et PASSENT à 100 %.

- [x] **T1 — Paramètres d'extinction + prédicats PURS** (`lib/safety/episode-detresse.ts`) (AC: 1, 2)
  - [x] RED : `tests/episode-detresse-modele.test.ts` (pur, zéro I/O) — la **décision de transition** `deciderTransition(etat, niveauDetecte, maintenant)` : ouvre si `niveauDetecte ≥ 1` et rien d'ouvert ; **rehausse** `niveau_max` si déjà ouvert ; **compte** un tour sûr si `niveauDetecte = 0` et ouvert ; **éteint** ssi (`tours_surs + 1 ≥ SEUIL` **ET** `maintenant − debut ≥ DUREE_MIN`). Les dérivations `limitesLevees(episode)` (= `fin IS NULL`) et `ecritureBrancheBloquee(episode, maintenant)` (= ouvert **OU** `maintenant < fenetre_expire_at`).
  - [x] GREEN : constantes exportées `SEUIL_TOURS_SURS`, `DUREE_MIN_EPISODE_MS`, `FENETRE_POST_EPISODE_MS` (= 72 h) — **jamais figées dans le SQL** (patron `barriere-minorite.ts` : la durée vit dans le pur, le SQL la reçoit en argument). Fonctions pures.
  - [x] ⚠️ Marquer `SEUIL_TOURS_SURS` / `DUREE_MIN_EPISODE_MS` **PROVISOIRE — porte pré-lancement clinique** (seuillage de sécurité, PRD §5, à valider par un pro).
  - [x] Aucun import React/Next/Supabase (AD-1/AD-10) — vérifié par la garde d'architecture (T7).

- [x] **T2 — Migration `0010_episode_detresse.sql` : la table protégée art. 9** (AC: 3)
  - [x] RED : `tests/episode-detresse.test.ts` (SQL réel) — la table existe ; **RLS active + FORCE, aucune policy** ⇒ une session cliente (publishable, authentifiée) **ne LIT ni n'ÉCRIT rien** ; contrainte **un seul épisode ouvert** par utilisatrice (index partiel unique `where fin is null`) ; `CHECK` `niveau_max between 1 and 3` ; `CHECK` `fin is null or fin >= debut` ; `CHECK` cohérence `fenetre_expire_at` (non-null ssi `fin` non-null).
  - [x] GREEN : la migration (forward-only, horodatée logiquement 0010) — colonnes `id uuid pk`, `utilisatrice_id uuid not null references utilisatrice on delete cascade`, `debut timestamptz not null default now()`, `niveau_max int not null`, `fin timestamptz` nullable, `fenetre_expire_at timestamptz` nullable, `tours_surs_consecutifs int not null default 0`. `enable` + `force row level security`, **aucune policy** (deny-by-default). `comment on table` documentant art. 9 + server-authoritative.

- [x] **T3 — La transition ATOMIQUE possédée `enregistrer_tour_detresse(...)`** (security definer, params passés) (AC: 1, 4)
  - [x] RED : `tests/episode-detresse.test.ts` (SQL réel) — un 1er `niveau ≥ 1` **ouvre** (`debut`, `niveau_max`, `fin IS NULL`, `tours_surs = 0`) ; un niveau supérieur **rehausse** `niveau_max` (jamais ne régresse) ; un `niveau = 0` **incrémente** `tours_surs_consecutifs` ; **extinction** ssi `tours_surs ≥ SEUIL` **ET** `now − debut ≥ DUREE_MIN` → pose `fin = now()`, `fenetre_expire_at = now() + 72 h` ; un niveau ≥ 1 pendant le comptage **remet le compteur à 0** ; concurrence : deux appels concurrents n'ouvrent **jamais** deux épisodes (check-then-act sérialisé, patron 0006) ; les seuils **arrivent en arguments** (`p_seuil_tours`, `p_duree_min_s`) — grep prouve **aucun littéral** de seuil dans le SQL (T7) ; fonction **révoquée** `public/anon/authenticated`, **granted** `service_role`.
  - [x] GREEN : `create or replace function public.enregistrer_tour_detresse(cible uuid, p_niveau int, p_seuil_tours int, p_duree_min_s int) returns … language plpgsql security definer set search_path = ''` — transition atomique (verrou de ligne sur l'épisode ouvert, patron `appliquer_barriere_minorite`). Retourne l'état des limites après le tour (`limites_levees boolean`) OU void + laisser `episode_detresse_ouvert` faire la lecture (choix dev, documenté).

- [x] **T4 — Les dérivations gardées : `episode_detresse_ouvert(cible)` + `branche_bloquee_par_detresse()`** (AC: 1, 2)
  - [x] RED : `tests/episode-detresse.test.ts` (SQL réel) — `episode_detresse_ouvert(cible)` (service_role) reflète `fin IS NULL` ; `branche_bloquee_par_detresse()` **sans paramètre, keyé sur `auth.uid()`** (patron `est_barre_minorite`, pas d'oracle inter-utilisatrices) renvoie **vrai pendant l'épisode ET pendant les 72 h après extinction**, **faux** hors fenêtre ; **granted `authenticated`** (couture Epic 4 : le futur write-gate `branche` l'appellera dans son `WITH CHECK`), `episode_detresse_ouvert` **révoqué** `authenticated`.
  - [x] GREEN : les deux fonctions SQL + grants. Contrôle positif (non-tautologique) : sous `service_role` sans `auth.uid()`, `branche_bloquee_par_detresse()` renvoie `false` (patron `privileges-fonctions.test.ts`).

- [x] **T5 — Le dépôt serveur RÉEL `creerDepotEpisode(utilisatriceId)`** (`lib/safety/depot-episode.ts`) remplace le placeholder (AC: 1, 4)
  - [x] RED : `tests/depot-episode.test.ts` (unit, admin RPC mocké) — `episodeOuvert()` appelle `episode_detresse_ouvert(cible)` ; `enregistrerTour(niveauDetecte)` appelle `enregistrer_tour_detresse` avec le niveau **détecté brut** + les seuils lus dans `lib/safety/episode-detresse` ; **repli sûr sur échec** (AD-15) — une erreur RPC **ne plante pas le tour** : incident journalisé **sans art. 9** (code d'erreur seul) et **`limitesLevees` par défaut = `true`** (le doute lève les limites : jamais de paywall sur un possible épisode).
  - [x] GREEN : `import "server-only"` + `createSupabaseAdminClient` (tâche système, AD-12 — `episode_detresse` n'est pas écrit par la cliente). Implémente l'interface `DepotEpisode` (contrat étendu, cf. T6).

- [x] **T6 — Câbler le pipeline : `enregistrerTour` CHAQUE tour, niveau BRUT ; retour `limitesLevees`** (`lib/safety/pipeline.ts`) (AC: 1, 4)
  - [x] RED : `tests/pipeline-episode.test.ts` — `enregistrerTour` est appelé à **chaque** tour (y compris niveau 0) avec `detection.verdict.niveau` (**brut**, pas l'effectif forcé) ; un épisode ouvert **force le fort** (`niveauEffectif = max(brut, 1)`, inchangé 2.3) **mais** le comptage d'extinction voit bien le **brut** (sinon l'épisode ne s'éteint jamais) ; `ResultatSecurite` (branche `bloque:false`) porte désormais `limitesLevees` ; l'ordre est préservé (détection → forçage via `episodeOuvert()` **pré-enregistrement** → audit → `enregistrerTour` → retour).
  - [x] GREEN : étendre l'interface `DepotEpisode` (`episodeOuvert()` + `enregistrerTour(niveauDetecte): Promise<EtatLimites>`), retirer `signaler`, mettre à jour `depotEpisodePlaceholder`, ajouter `limitesLevees` à `ResultatSecurite`.
  - [x] Préserver : **les 402 tests de la 2.3 restent verts** (`pipeline-securite.test.ts`, `detecteur-detresse.test.ts`, etc.). Adapter uniquement les tests qui référencent l'ancien `signaler`.

- [x] **T7 — Câbler la route + gardes d'architecture + doc** (AC: 1, 3)
  - [x] GREEN : `app/api/anam/message/route.ts` passe `depotEpisode: creerDepotEpisode(user.id)` à `evaluerSecuriteDuTour`. `limitesLevees` est **disponible** dans `securite` mais **pas encore consommé** (le refus de montage paywall/quota/bilan est la Story 2.5) — marquer le point d'extension. Le tour d'épisode n'est **jamais métré** (comme la détection, FR-043).
  - [x] Étendre `tests/pipeline-securite-architecture.test.ts` (garde par grep-source, patron `sansCommentaires`) : `episode_detresse` a **RLS + FORCE** dans 0010 ; `enregistrer_tour_detresse` est appelé **uniquement** via `lib/safety/depot-episode` (jamais ailleurs) ; **aucun littéral de seuil** (`SEUIL`/durée) codé en dur dans 0010 (les seuils viennent des arguments) ; `episode-detresse.ts` pur n'importe aucune infra.
  - [x] Mettre à jour `lib/safety/README.md` (l'entité, ses deux dérivations, le server-authoritative deny-by-default) et `_bmad-output/implementation-artifacts/deferred-work.md` (couture branche pour Epic 4 ; `limites_levees` consommé en Story 2.5 ; exclusion FR-046 des analyses à câbler quand journal/synthèse existeront).

- [x] **T8 — Validations complètes**
  - [x] `set -a && . ./.env.local && set +a && npx vitest run` (Supabase local **démarré** + migration 0010 appliquée) → **tout vert** (402 + nouveaux).
  - [x] `npx tsc --noEmit` propre · `npx eslint .` propre · `npm run build` propre.
  - [x] Vérifier les 4 ACs un par un ; noter dans *Completion Notes*.

## Dev Notes

### La frontière — ce que 2.4 possède, ce qu'elle NE fait PAS

| Concern | Story | 2.4 en fait… |
|---|---|---|
| Détection, classification, forçage fort, repli sûr, audit, veto | **2.3 (fait)** | rien — préservé à l'identique |
| **L'entité `episode_detresse` + `limites_levees` + fenêtre 72 h + extinction** | **2.4 (ici)** | **tout** : table, transition atomique, dérivations, dépôt réel |
| Le **prédicat de garde de branche** (`branche_bloquee_par_detresse`) | **2.4 (ici)** | **livre le prédicat** (seam) — la table `branche` et son write-gate sont **Epic 4** |
| Refuser le **montage** du paywall/quota/bilan quand `limites_levees` | **2.5 / 2.9** | expose `limitesLevees` (prêt) — **ne monte aucune garde UI** |
| `/aide`, filet hors-IA, ressources statiques | **2.5** | rien |
| La **réponse** d'Anam par niveaux (mots, blocs ressources) | **2.6** | rien |
| L'écriture de `branche` (Epic 4) qui **appellera** notre prédicat | **Epic 4** | rien — seam posé |

**Anti-front-running (identique à 2.3).** Pas de table `branche` (Epic 4), pas de paywall (Epic 3/2.5/2.9), pas d'analyse/synthèse/arbre (Epic 4). 2.4 livre **l'entité et ses dérivations possédées**, et les **coutures** que ces stories brancheront — prouvées par test, inertes jusqu'à leur consommateur. C'est exactement le geste de 2.3 (`DepotEpisode`, `doitExecuterTravailSchema`).

### La couture 2.3 qu'on rend réelle (le point de départ)

`lib/safety/pipeline.ts` porte déjà (Story 2.3) :
```ts
export interface DepotEpisode {
  episodeOuvert(): Promise<boolean>;              // → dérive de fin IS NULL
  signaler(niveau: NiveauSecurite): Promise<void>; // → ouvrir/mettre à jour episode_detresse
}
export const depotEpisodePlaceholder: DepotEpisode = { /* no-op honnête */ };
// …
const ouvert = await depot.episodeOuvert();
const niveauEffectif = Math.max(detection.verdict.niveau, ouvert ? 1 : 0);
// …
if (verdict.niveau >= 1) await depot.signaler(verdict.niveau);
```
**Ce que 2.4 change** — deux corrections de fond que le placeholder masquait :
1. **`signaler` devient `enregistrerTour` et est appelé à CHAQUE tour** (y compris niveau 0), sinon **aucun tour sûr n'est jamais compté** et l'épisode **ne s'éteint jamais**.
2. **On passe le niveau DÉTECTÉ BRUT (`detection.verdict.niveau`), pas l'effectif forcé (`verdict.niveau`).** Piège critique : pendant un épisode ouvert, `niveauEffectif` est forcé à ≥ 1 — si on comptait l'effectif, un « je vais mieux » (brut 0) serait vu comme 1 et l'épisode ne s'éteindrait **jamais** (paywall levé à vie — l'exact anti-cas d'AD-17). Le forçage (réponse au fort) et le comptage (extinction) lisent **deux niveaux différents** du même tour : effectif pour répondre, brut pour compter.

### L'entité (AC1, AC3, AD-17)

`episode_detresse` — **entité de première classe possédée par le serveur**, jamais écrite par la cliente (comme `usage_ia` / `audit_securite`) :

| Colonne | Type | Rôle |
|---|---|---|
| `id` | `uuid pk` | — |
| `utilisatrice_id` | `uuid not null → utilisatrice on delete cascade` | propriétaire (art. 9, per-user) |
| `debut` | `timestamptz not null default now()` | ouverture — base du **délai minimal** d'extinction |
| `niveau_max` | `int not null` (1–3) | plus haut niveau atteint (monotone, ne régresse pas) |
| `fin` | `timestamptz` **nullable** | **`NULL` = ouvert** → `limites_levees` en dérive |
| `fenetre_expire_at` | `timestamptz` nullable | posé à l'extinction = `fin + 72 h` → la **fenêtre 72 h** en dérive |
| `tours_surs_consecutifs` | `int not null default 0` | compteur d'extinction (remis à 0 par tout niveau ≥ 1) |

**Deux dérivations DISTINCTES du même entité** (ne pas les confondre) :
- **`limites_levees` = `fin IS NULL`** (épisode **ouvert**). Gouverne le **paywall/quota/bilan** (AD-9/AD-17). **Ne dure PAS** pendant les 72 h post-épisode.
- **garde de branche = `fin IS NULL OR maintenant < fenetre_expire_at`** (ouvert **OU** dans les 72 h après). Gouverne **uniquement** « aucune branche née d'un épisode » (FR-042, AD-8). **Plus large** que `limites_levees`.

**Contraintes (défense en profondeur, patron 0006/0008)** : index partiel **unique** `(utilisatrice_id) where fin is null` (**un seul épisode ouvert**) ; `CHECK niveau_max between 1 and 3` ; `CHECK fin is null or fin >= debut` ; `CHECK (fin is null) = (fenetre_expire_at is null)` (la fenêtre naît avec l'extinction).

### La transition d'extinction (AC1) — « unique et possédée »

Machine d'état, par tour, sur le niveau **détecté brut** :
- **brut ≥ 1** : aucun épisode ouvert → **OUVRE** (`debut=now, niveau_max=brut, tours_surs=0`) ; sinon → **REHAUSSE** (`niveau_max=max(niveau_max, brut), tours_surs=0`).
- **brut = 0** : aucun épisode → **rien** ; épisode ouvert → **`tours_surs += 1`** ; si `tours_surs ≥ SEUIL_TOURS_SURS` **ET** `now − debut ≥ DUREE_MIN_EPISODE_MS` → **ÉTEINT** (`fin=now, fenetre_expire_at=now + 72 h`).

**Propriétaire unique = la fonction SQL `enregistrer_tour_detresse` (atomique, race-safe).** Patron `appliquer_barriere_minorite` (0006) : `plpgsql`, `security definer`, `search_path=''`, check-then-act sérialisé (verrou de ligne), révoquée `public/anon/authenticated`, `grant execute … to service_role`. Les **seuils arrivent en arguments** (jamais de littéral dans le SQL — AD-14/convention SPINE « paramètres lus à l'exécution ») ; la logique est **aussi** exprimée en pur (`deciderTransition`, T1) et **prouvée en tests purs** — le pur documente la règle, le SQL l'applique de façon autoritaire (patron AD-8 : fonction de transition possédée **+** garde SQL).

### La posture RLS de `episode_detresse` (AC3) — ⚠️ décision d'architecture

**Recommandation retenue : server-authoritative, deny-by-default** (RLS activée + FORCE, **aucune policy**), écrite/lue **uniquement** via des fonctions `security definer` — **exactement `audit_securite` / `usage_ia`**, pas `art9_temoin`.

**Pourquoi** : un épisode est une **décision de sécurité authored par le serveur** (la personne ne « déclare » jamais sa détresse) ; l'utilisatrice **ne doit jamais** pouvoir l'écrire, le fermer ou le forger (sinon extinction/paywall jouables — l'exact contraire d'« unique et possédée », AD-17). `limites_levees` est **dérivé côté serveur** et poussé au client (Story 2.5) — le client **n'a jamais besoin de lire** `episode_detresse`. Les deux accès légitimes sont des prédicats `security definer` : `episode_detresse_ouvert(cible)` (service_role, pour le pipeline) et `branche_bloquee_par_detresse()` (auth.uid, granted `authenticated`, pour le futur write-gate `branche` — miroir exact d'`est_barre_minorite()`). L'export/effacement RGPD (FR-067) passe par le moteur unique `service_role` (AD-14), pas par une policy de lecture cliente.

**Lecture de l'AC épic « RLS deny-by-default sous JWT utilisatrice »** : « deny-by-default » = la posture ; « sous JWT utilisatrice » = art. 9, **scopé par utilisatrice, non contournable** (le vocabulaire que 0006/0008 emploient déjà pour décrire leur deny-by-default comme posture art. 9-safe). Ce **n'est pas** un octroi de DML à la session cliente. → **Question ouverte pour Julian en fin de story** (transparence : veut-on que la personne puisse *lire* son historique d'épisodes ? Défaut recommandé : non — ne pas ré-exposer un signal de santé mentale à la surface client).

**Garde de build (AC3 « une table art. 9 sans politique casse le build »)** : le test CI `rls.test.ts` **ne scanne pas** automatiquement toutes les tables — il teste `probe` et `art9_temoin` à la main. Il faut donc **ajouter à la main** dans `tests/episode-detresse.test.ts` la preuve que la session cliente ne lit/écrit rien (deny-by-default), comme `usage_ia.test.ts` / `audit-detresse.test.ts` le font.

### Repli sûr sur échec du dépôt (AD-15)

L'audit (2.3) est *best-effort* (perdre une ligne dégrade la **mesure**). L'épisode est différent : c'est de la **sécurité**. Deux modes d'échec, tous deux **repli vers la sécurité** :
- **Échec d'OUVERTURE** → si on ne lève pas les limites, un paywall pourrait frapper une personne en détresse (FR-043) → sur erreur RPC, **`limitesLevees = true` par défaut** + **incident journalisé** (jamais silencieux). Le doute lève les limites.
- **Échec d'EXTINCTION** → l'épisode reste ouvert plus longtemps → limites levées plus longtemps → sûr par nature (jamais de paywall trop tôt).
Dans les deux cas : **ne jamais planter le tour** (Anam ne quitte jamais, FR-039) — journaliser l'incident (code d'erreur seul, NFR-022) et poursuivre.

### Ce qui doit être préservé (ne rien casser)

- **Story 2.3** : détection d'abord, `niveauEffectif = max(brut, ouvert?1:0)`, forçage fort pour toute la réponse, audit sans art. 9, `repli_sur`, veto `doitExecuterTravailSchema`. **402 tests verts** — seule dérive attendue : les tests qui référencent l'ancien `signaler` migrent vers `enregistrerTour`.
- **Route 2.2/2.3** : ordre auth → validation → pipeline → egress → flux NDJSON → métrage `after()`. La détection **et** l'épisode ne sont **jamais métrés** (FR-043).
- **Conventions art. 9** : `no-store`, runtime Node, `service_role` réservé aux tâches système, jamais de contenu art. 9 en log.

### Pièges (revue adversariale probable)

1. **Compter l'effectif au lieu du brut** → épisode inextinguible (paywall à vie). *Le pire cas de la story.*
2. **`signaler` seulement si niveau ≥ 1** → tours sûrs jamais comptés → jamais d'extinction. Appeler `enregistrerTour` **chaque** tour.
3. **Confondre `limites_levees` (fin IS NULL) et la fenêtre 72 h (fenetre_expire_at)** — deux dérivations, deux portées.
4. **Seuil codé en dur dans le SQL** → viole AD-14 ; le grep-guard (T7) doit le rattraper.
5. **Deux épisodes ouverts** (race de deux tours) → index partiel unique + check-then-act sérialisé.
6. **`branche_bloquee_par_detresse()` param'd par `cible`** → oracle inter-utilisatrices. **Sans paramètre, keyé `auth.uid()`** (acquis revue 1.6).
7. **Extinction sur `now − debut`** : le **délai minimal** empêche un « ça va mieux » immédiat de fermer trop tôt ; ne pas mesurer depuis le dernier tour sûr.
8. **`fenetre_expire_at` relatif au `debut`** (faux) : il naît **à l'extinction** = `fin + 72 h`.

### Project Structure Notes

- **Nouveaux** : `lib/safety/episode-detresse.ts` (pur), `lib/safety/depot-episode.ts` (server-only), `supabase/migrations/0010_episode_detresse.sql`, `tests/episode-detresse-modele.test.ts` (pur), `tests/episode-detresse.test.ts` (SQL réel), `tests/depot-episode.test.ts` (unit), `tests/pipeline-episode.test.ts`.
- **Modifiés** : `lib/safety/pipeline.ts` (contrat `DepotEpisode`, `limitesLevees`), `app/api/anam/message/route.ts` (dépôt réel), `tests/pipeline-securite.test.ts` (`signaler`→`enregistrerTour`), `tests/pipeline-securite-architecture.test.ts` (+ gardes 2.4), `lib/safety/README.md`, `_bmad-output/implementation-artifacts/deferred-work.md`.
- Alignement couches (AD-1/AD-10) : pur `lib/safety/episode-detresse` ← dépôt `lib/safety/depot-episode` (server-only, `lib/data/supabase/admin`) ← pipeline ← route. Aucune remontée d'infra dans le pur.

### Testing standards

- **Runner** : Vitest env **node**. Lancer avec l'env chargé (Vitest ne lit pas `.env.local`) : `set -a && . ./.env.local && set +a && npx vitest run`.
- **SQL réel** : Supabase **local** démarré (CLI **global** `supabase`, jamais `npx supabase`), **migration 0010 appliquée** (`supabase migration up` ou `supabase db reset`). Env : `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (cf. `supabase status`). Patron `audit-detresse.test.ts` / `usage-ia.test.ts` : créer une utilisatrice via `admin.auth.admin.createUser`, nettoyer en `afterAll`.
- **Pur** : `episode-detresse-modele.test.ts` couvre exhaustivement la machine d'état + les deux dérivations (tables de vérité).
- **Garde d'architecture** : `pipeline-securite-architecture.test.ts` par grep-source (retire les commentaires — attention aux angles morts : cibler des appels avec `(`).
- **Ce qui n'est pas couvrable en node** (à noter, non bloquant) : la consommation UI de `limites_levees` (Story 2.5, DOM).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-2.4] (l. 604–616) — les 3 ACs, `Couvre : FR-042, FR-046, AD-17`, porte pré-lancement héritée de 2.3.
- [Source: ARCHITECTURE-SPINE.md#AD-17] — `episode_detresse` entité possédée ; `limites_levees` dérive de `fin IS NULL` ; 72 h dérive de `fenetre_expire_at` ; extinction unique (N tours sûrs **ET** délai) ; jamais levé à vie ; exclusion FR-046.
- [Source: ARCHITECTURE-SPINE.md#AD-16] — garde branche **au point d'écriture** (`create-branche` interroge `episode_detresse`), pas à la proposition.
- [Source: ARCHITECTURE-SPINE.md#AD-9] — `limites_levees` : paywall/quota/carte/bilan refusent de se monter tant qu'il est vrai (garde technique, FR-043).
- [Source: ARCHITECTURE-SPINE.md#AD-8] — aucune branche pendant épisode + 72 h ; transition possédée **+** contrainte SQL.
- [Source: ARCHITECTURE-SPINE.md#AD-14] — échéances **paramétrées**, jamais codées en dur ; épisode effaçable par le moteur unique (FR-067).
- [Source: ARCHITECTURE-SPINE.md#AD-12] — `service_role` = tâche système ; table art. 9 deny-by-default ; RLS non contournable.
- [Source: ARCHITECTURE-SPINE.md#AD-15] — repli sûr, incident journalisé, jamais silencieux.
- [Source: PRD §5 / FR-042, FR-043, FR-046] — pas de branche détresse ; pas de commercial en détresse ; épisodes protégés/exclus des analyses.
- Patrons de code : `supabase/migrations/0006_barriere_minorite.sql` (security definer atomique + audit + grants), `0008_usage_ia.sql` (deny-by-default server-authoritative), `lib/safety/barriere-minorite.ts` + `appliquer-barriere.ts` (délai paramétré dans le pur, RPC admin), `lib/safety/pipeline.ts` (la couture `DepotEpisode`), `tests/audit-detresse.test.ts` + `tests/privileges-fonctions.test.ts` (harness SQL réel + contrôle positif non-tautologique).

## Dev Agent Record

### Agent Model Used

Opus 4.8 (1M context) — dev-story TDD.

### Debug Log References

- `createUser: {}` transitoire au 1er run des tests SQL réels (conteneur auth « froid » après inactivité) — passé au re-run, non lié au code. Aucune autre anomalie.

### Completion Notes List

- **T1** — `lib/safety/episode-detresse.ts` pur : `deciderTransition` (ouvre/rehausse/compte/éteint) + `limitesLevees` (fin IS NULL) + `ecritureBrancheBloquee` (ouvert OU < 72 h). Seuils `SEUIL_TOURS_SURS=3` / `DUREE_MIN_EPISODE_MS=30 min` **provisoires** (porte clinique). 18 tests purs.
- **T2/T3/T4** — migration `0010_episode_detresse.sql` : table (contraintes `niveau_max 1-3`, `fin >= debut`, cohérence fenêtre, **index partiel unique un-seul-ouvert**), **RLS + FORCE deny-by-default** (server-authoritative, aucune policy). `enregistrer_tour_detresse` (plpgsql, `security definer`, atomique via `FOR UPDATE` + `ON CONFLICT`, **seuils reçus en arguments** — aucun littéral d'intervalle) ; `episode_detresse_ouvert(cible)` (service_role) ; `branche_bloquee_par_detresse()` (keyée `auth.uid()`, granted `authenticated` — couture Epic 4). 17 tests SQL réels (deny-by-default, contraintes, lifecycle, extinction seuil+délai, 72 h, réservation service_role, contrôle positif non-tautologique).
- **T5** — `lib/safety/depot-episode.ts` (`server-only`) : `creerDepotEpisode(id)` implémente `DepotEpisode` via RPC admin ; seuils lus dans le pur. **Repli sûr (AD-15)** : panne RPC → `limitesLevees=true` (jamais de paywall sur un doute) / `episodeOuvert=true` (force le fort) + incident sans art. 9. 6 tests (mock admin).
- **T6** — `lib/safety/pipeline.ts` : `DepotEpisode` étendu (`enregistrerTour(niveauDetecte): EtatLimites`, `signaler` retiré), `ResultatSecurite.limitesLevees` ajouté. **`enregistrerTour` appelé à CHAQUE tour avec le niveau DÉTECTÉ BRUT** (`detection.verdict.niveau`), jamais l'effectif forcé — le piège central (sinon inextinguible). `episodeOuvert()` lu AVANT (forçage inchangé). Tests 2.3 migrés (`signaler`→`enregistrerTour`, +`limitesLevees`) ; 6 nouveaux tests pipeline-épisode.
- **T7** — route `anam/message` : dépôt RÉEL câblé (`creerDepotEpisode(user.id)`) ; `limitesLevees` disponible, **non consommé** (garde de montage = Story 2.5, marquée). Gardes d'architecture 2.4 (pur sans infra, transition appelée que par le dépôt, table RLS+FORCE sans policy, seuils non figés). `README.md` + `deferred-work.md` mis à jour (coutures branche Epic 4 / limites_levees 2.5 / exclusion FR-046).
- **T8** — **453 tests verts (48 fichiers)** · `tsc --noEmit` propre · `eslint` propre · `next build` propre.
- **AC couverts** : AC1 (entité + 2 dérivations + extinction gardée) ✅ · AC2 (prédicat de garde de branche possédé, seam Epic 4) ✅ · AC3 (deny-by-default art. 9, casse-le-build via test hand-written) ✅ · AC4 (couture 2.3 réelle, aucune régression) ✅.
- **Décision d'archi posée (à confirmer par Julian)** : posture `episode_detresse` = server-authoritative deny-by-default (recommandation de la story). La cliente ne lit pas ses épisodes. Si transparence-lecture souhaitée → ajouter une policy SELECT `auth.uid()` (ajout simple, non fait).

### File List

**Nouveaux**
- `lib/safety/episode-detresse.ts` — modèle pur (machine d'état + dérivations + seuils provisoires)
- `lib/safety/depot-episode.ts` — dépôt serveur réel (RPC security definer, repli sûr)
- `supabase/migrations/0010_episode_detresse.sql` — table + transition + 2 dérivations gardées
- `tests/episode-detresse-modele.test.ts` — 18 tests purs
- `tests/episode-detresse.test.ts` — 17 tests SQL réels
- `tests/depot-episode.test.ts` — 6 tests (mock admin)
- `tests/pipeline-episode.test.ts` — 6 tests (câblage épisode)

**Modifiés**
- `lib/safety/pipeline.ts` — contrat `DepotEpisode`/`EtatLimites`, `ResultatSecurite.limitesLevees`, `enregistrerTour` chaque tour (niveau brut)
- `app/api/anam/message/route.ts` — dépôt réel `creerDepotEpisode(user.id)` câblé
- `tests/pipeline-securite.test.ts` — migration `signaler`→`enregistrerTour` + `limitesLevees`
- `tests/pipeline-securite-architecture.test.ts` — gardes d'architecture 2.4
- `lib/safety/README.md` — l'entité épisode + dérivations + posture RLS
- `_bmad-output/implementation-artifacts/deferred-work.md` — coutures 2.4

## Change Log

| Date | Version | Description | Author |
|---|---|---|---|
| 2026-07-27 | v0.1 | create-story — contexte d'implémentation complet (entité `episode_detresse`, transition possédée, dérivations, couture 2.3 rendue réelle, seam branche Epic 4). Story `ready-for-dev`. | Julian (create-story) |
| 2026-07-28 | v1.0 | dev-story — implémentation TDD complète (T1-T8). Migration 0010, modèle pur + dépôt serveur, pipeline câblé (niveau brut, limitesLevees), gardes d'architecture. 453 tests verts, tsc/eslint/build propres. Status `review`. | Opus 4.8 (dev-story) |
