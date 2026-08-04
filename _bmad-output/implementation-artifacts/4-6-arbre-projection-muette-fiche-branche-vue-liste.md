---
baseline_commit: 01efcb6
---

# Story 4.6 : L'arbre — projection muette, fiche de branche, « Voir dans la conversation », renommage, vue liste de rang égal

Status: done

<!-- Story créée le 2026-07-31 après réécriture des specs de l'arbre (fruit → rayonnement, arbre de vie) et
     une analyse parallèle de 5 sous-systèmes (workflow wf_8e901b8f-3fe, 5 agents, 455k tokens). Périmètre
     « Voir dans la conversation » tranché par le PO = COMPLET (rejeu du fil persisté + ancres + surlignage +
     caméra). Idée d'illumination sémantique (racines=ancrage / branches=liberté) PARQUÉE pour Sanela (voir Dev Notes). -->

## Story

En tant qu'utilisatrice,
je veux **voir mes branches sur mon arbre**, retrouver **d'un geste l'extrait exact** d'où chacune est née, et pouvoir **renommer** une branche avec mes mots,
afin d'avoir la **preuve visible de mon chemin**, sans jamais qu'on me le note ni qu'on me le mesure.

## Acceptance Criteria

> Rappel de partition (AD-7) : `lib/scene/` **projette** (modèle pur, lecture seule), `render/` **dessine** (muet, aucune règle). La monotonie d'**écriture** (transitions `etat`/`intensite`) est la **Story 4.7**, pas ici. 4.6 = **consultation + renommage** seulement.

1. **[DUR / AD-7]** **Étant donné** l'état persisté des branches, **quand** l'arbre s'affiche, **alors** `lib/scene/` **projette** l'état (tronc + `branches[]` portant `etat` + `intensite` + `extraitSourceId` + `accroche`), **et** `render/` reste **muet** — il ne décide, ne calcule ni ne garde **aucune monotonie**, ne porte **aucune logique métier**, ne lit **ni base ni secret**. *(AD-7, AD-8 ; epics 4.6 AC L890)*

2. **[DUR / défensif]** **Étant donné** une branche dont l'état maximal déjà connu est supérieur, **quand** une projection ultérieure renvoie un état inférieur, **alors** le client **conserve l'état supérieur** et **journalise un incident** (sans art. 9) — l'arbre ne régresse **jamais** au rendu. La monotonie d'**écriture** (fonction de transition unique + contrainte SQL) vit en **4.7**, pas ici. *(FR-029, AD-8 ; epics 4.6 AC L891 ; EXPERIENCE règle défensive L240)*

3. **Étant donné** un **point d'accroche** de branche (zone tactile **≥ 44 px**, indépendante du dessin), **quand** l'utilisatrice le touche, **alors** la **fiche** s'ouvre : **nom donné par elle**, **date**, et l'**extrait exact rendu comme un tour d'utilisatrice** (verbatim de `entree_journal.contenu`, police `corps`/Inter, jamais police Anam). *(FR-027, UX-DR-26 ; epics 4.6 AC L892)*

4. **[COMPLET]** **Étant donné** la fiche ouverte, **quand** l'utilisatrice active **« Voir dans la conversation »**, **alors** le fil s'ouvre **positionné sur le message exact** dont la branche provient (pas la journée, pas la séance) — rejoué depuis `entree_journal` persisté —, le message source **surligné** (filet permanent `accent` + fond `accent-doux` estompé en **2 s**, **immédiat** si `prefers-reduced-motion`), **et** le **retour** ramène à l'arbre **au même cadrage et au même zoom**. *(FR-027, UX-DR-25 ; epics 4.6 AC L892 ; EXPERIENCE L261-268)*

5. **[DUR / FR-031]** **Étant donné** l'arbre **et** la fiche, **quand** ils sont rendus, **alors** ils ne portent **aucun** compteur de branches, pourcentage, niveau, jauge, série, badge, note, score ni **aucune légende permanente**, **et** l'état d'une branche n'est **jamais** porté par la **couleur seule** (il se lit dans la matière : épaisseur de trait, densité de feuilles, montée de lumière — et **en toutes lettres** en vue liste). *(FR-031, UX-DR-3, UX-DR-24 ; epics 4.6 AC L893 & L896 ; DESIGN L609)*

6. **Étant donné** la fiche (**étiquette posée sur l'illustration, jamais modale**), **quand** elle est ouverte, **alors** elle porte les deux actions **« Voir dans la conversation »** et **« Renommer »** — **« Renommer »** rouvre un **champ vide** (aucun nom pré-rempli, aucune suggestion), le nouveau nom restant **donné par l'utilisatrice** —, **et** le reste de l'arbre s'**estompe sans flou** (`opacity: 0.55`, jamais de `blur`). *(UX-DR-26 ; epics 4.6 AC L895)*

7. **[DUR / sécurité — leçon R1]** **Étant donné** que 4.6 introduit la **première écriture** sur `branche` (le renommage), **quand** un renommage est tenté, **alors** il est gardé **au point d'écriture dans la policy `WITH CHECK`** (jamais dans la seule RPC) : `auth.uid() = utilisatrice_id` **et** `a_consenti_art9()` **et** `not est_barre_minorite()` **et** `branche_nom_significatif(nom)` ; **et** un **trigger** rejette toute mutation d'une colonne **autre que `nom`** (`etat`/`intensite`/`date_naissance`/`extrait_source_id`/… figés) — un `.from("branche").update(...)` **direct** ne peut ni forger un état ni contourner le write-gate. *(AD-12, AD-13 ; leçon R1/R1-bis ; epics 4.6 AC L895)*

8. **Étant donné** le **plancher d'accessibilité**, **quand** l'utilisatrice ouvre la **vue liste** (bascule **persistée**), **alors** chaque branche y est listée **de rang égal** au canevas — **nom**, **date**, **état écrit en toutes lettres** (`naissance` / `feuillaison` / `rayonnement`), **extrait** —, atteignable **au clavier et au lecteur d'écran** sans traverser la scène, le **canevas** portant `role="img"` + un `aria-label` court. *(UX-DR-24, UX-DR-37, Accessibility Floor EXPERIENCE L209/L211 ; epics 4.6 AC L894)*

9. **Étant donné** le canevas de l'arbre, **quand** l'utilisatrice le manipule, **alors** il est **déplaçable et zoomable** (pan au doigt ; zoom au pincement, à la molette, et par deux **boutons `+` / `−`** atteignables au clavier ; **double-tap = cadrer** la branche), **et** aucun compteur, pourcentage ni légende permanente n'y figure. Le zoom de l'arbre est **propre à l'arbre** (indépendant du zoom 200 %/400 % de la page). *(UX-DR-24 ; epics 4.6 AC L896 ; Accessibility Floor EXPERIENCE L197/L214)*

10. **Étant donné** un changement d'état survenu (feuillaison/rayonnement écrits en 4.7), **quand** l'utilisatrice ouvre l'arbre, **alors** le changement est **déjà là** — **aucune animation de croissance**, aucune particule, confetti, son, étincelle ni halo de récompense ; le rayonnement est **statique** ; seul un **léger balancement ambiant** du feuillage est toléré. *(FR-028, State Pattern EXPERIENCE L183 ; DESIGN L603)*

## Tasks / Subtasks

> **Discipline TDD, dépendances descendantes (AD-1).** Pour chaque garde **[DUR]** : écrire d'abord le test **rouge**, implémenter le minimum pour le **vert**, puis **mutation-vérifier** (retirer la garde → le test redevient rouge → restaurer). Ordre : base → modèle pur → data → sécurité/app → render → gardes.
> **Commande de test (Supabase local DOIT tourner)** : `set -a && . ./.env.local && set +a && npx vitest run`.
> **Supabase local** : CLI **globale** `supabase` (v2.67.1), **jamais** `npx supabase`. Rejouer depuis les fichiers : `supabase db reset` (0001→0022 propre = critère de non-régression).
> **4.6 n'a AUCUN appel LLM** : projection, renommage, lecture d'extrait = 100 % déterministes.

- [x] **T1 — Base : migration `0022_branche_arbre.sql` (forward-only ; jamais éditer 0021)** → AC1, AC3, AC4, AC7
  - [x] RPC de lecture **`charger_branches_arbre()`** `security invoker set search_path=''`, `returns table(branche_id uuid, nom text, etat text, intensite real, date_naissance timestamptz, extrait_source_id uuid, extrait_contenu text, extrait_cree_le timestamptz)` : join `branche ⋈ entree_journal` **en base** (via la FK composite), borné à `auth.uid()` par les deux policies SELECT owner déjà présentes. `revoke execute from public, anon ; grant to authenticated`.
  - [x] RPC de lecture de l'**échange source** **`charger_echange_source(p_extrait_source_id uuid)`** `security invoker` : renvoie le message exact **+ son voisinage immédiat** dans `entree_journal` (mêmes colonnes `id, role, contenu, cree_le`, ordonné par `cree_le`), borné à l'appelante. C'est le socle du « Voir dans la conversation » (périmètre COMPLET) ; documenter le chevauchement avec la lecture-journal d'Epic 5.
  - [x] **Policy UPDATE renommage** `branche_renommage FOR UPDATE USING (auth.uid()=utilisatrice_id) WITH CHECK (auth.uid()=utilisatrice_id AND public.a_consenti_art9() AND not public.est_barre_minorite() AND public.branche_nom_significatif(nom))`. **`a_consenti_art9()` est OBLIGATOIRE** ici (le `nom` est un dépôt de contenu art. 9 neuf, comme `fait_extrait` 0018 — contrairement à la policy UPDATE du signal qui l'omet). Réutiliser `public.branche_nom_significatif` (0021:29), **jamais** `length(btrim())>0` (R1-bis).
  - [x] **Trigger** `branche_garde_renommage` `before update` (patron `signal_reconceptualisation_garde_transition` 0021:132 / `fait_extrait_garde_resurrection` 0018:73, mord `service_role`) : **lève** si `new.etat<>old.etat OR new.intensite<>old.intensite OR new.date_naissance<>old.date_naissance OR new.extrait_source_id<>old.extrait_source_id OR new.utilisatrice_id<>old.utilisatrice_id OR new.cree_le<>old.cree_le`. Seul `nom` (et `maj_le`, tenu par le trigger existant) est mutable. En 4.7 ce trigger sera **étendu** pour autoriser la transition monotone `etat`/`intensite` sous sa propre garde.
  - [x] RPC de confort **`renommer_branche(p_branche_id uuid, p_nouveau_nom text)`** `security invoker` (fast-fail `branche_nom_significatif` + `update ... set nom=btrim(p_nouveau_nom) where id=p_branche_id and utilisatrice_id=(select auth.uid())`). **Ce n'est PAS la barrière** — policy + trigger le sont.
  - [x] Tests (miroir `tests/branche.test.ts`) : `supabase db reset` rejoue **0001→0022 propre** ; UPDATE **direct** `.from("branche").update({nom})` **refusé** sans consentement / sous barrière minorité / nom vide-Unicode / sur la branche d'autrui (isolation) ; UPDATE direct tentant de changer `etat`/`date_naissance`/`extrait_source_id` **rejeté par le trigger** (mutation-vérifier chaque clause) ; renommage heureux ; `charger_branches_arbre` ne remonte **que** les branches de l'appelante + le verbatim ; `charger_echange_source` isolé à l'appelante.

- [x] **T2 — Modèle pur : `lib/scene/projection.ts` + réconciliateur anti-régression + view-state caméra** → AC1, AC2, AC9
  - [x] Ajouter (SANS import — garde `scene-architecture.test.ts`) : `export type EtatBranche = "naissance" | "feuillaison" | "fruit"` (miroir **littéral** du CHECK SQL — l'enum reste `'fruit'` en base ; le libellé « rayonnement » est un mapping d'**affichage** côté render) ; `export interface BrancheProjetee { readonly id: string; readonly etat: EtatBranche; readonly intensite: number; readonly extraitSourceId: string; readonly nom?: string; readonly accroche?: { readonly x: number; readonly y: number } }`. Remplacer `branches: readonly []` par `readonly BrancheProjetee[]`. **Retirer le scalaire `eveil`** (placeholder de progression globale de 1.7 — un scalaire global d'ensemble est précisément ce que FR-031 interdit ; l'arbre se dessine désormais depuis `branches[]`). Ne **jamais** nommer un champ `message` (garde B6).
  - [x] Réconciliateur **pur** `export function reconcilierProjection(precedente, nouvelle): { projection: ProjectionScene; incidents: { id: string; champ: "etat" | "intensite" }[] }` — prend le **max par `id`** (ordre `naissance < feuillaison < fruit` ; `Math.max` sur `intensite`) et **liste** les régressions détectées. **Aucun effet de bord, aucun `nom` art. 9 dans les incidents** (id/champ seuls, NFR-022). Testable sans navigateur.
  - [x] `lib/scene/vue.ts` : élargir `EtatVue` pour porter la **caméra propre à l'arbre** (`pan`, `zoom`) + le contexte de **retour** (`origine?: IdRegion`, `brancheSelectionnee?: string`), et ajouter les `ActionVue` correspondantes (`cadrer`, `ouvrirFiche`, `voirDansConversation`, `revenir`). Réducteur **pur/idempotent** (propriétaire unique de la transition ; le rendu ne fait que consommer). Placement des `accroche` = fonction **déterministe** stable par branche (par ordre `date_naissance` sur des emplacements réservés ; cible d'alignement = les hubs de l'asset une fois le moteur porté).

- [x] **T3 — Data : `lib/data/depot-branche.ts` (étendre — jamais `.from("branche")`)** → AC3, AC4, AC7
  - [x] `chargerBranches()` → `.rpc("charger_branches_arbre")`, mappe snake_case → objet (nom, etat, intensite, dateNaissance, extraitSourceId, **extraitContenu** verbatim, extraitCreeLe). Erreur = **code Postgres seul** (`error.code ?? "echec"`), jamais `nom`/`contenu` (NFR-022).
  - [x] `chargerEchangeSource({ extraitSourceId })` → `.rpc("charger_echange_source", ...)`, mappe la fenêtre de messages ; même discipline NFR-022.
  - [x] `renommer({ brancheId, nom })` → `.rpc("renommer_branche", { p_branche_id, p_nouveau_nom })` ; NFR-022.
  - [x] Route/écriture côté endpoint : étendre `app/api/anam/branche/route.ts` avec `{action:"renommer", brancheId, nom}` (valide `nomValide` de `lib/domain/branche.ts`, réponses neutres `{code}`), miroir de la 4.5.

- [x] **T4 — Sécurité/app : orchestrateur à repli sûr + câblage serveur** → AC1, AC2
  - [x] `lib/safety/*` (patron `ouverture-branche.ts`) : `chargerProjectionArbre()` `import "server-only"` → `try { depot.chargerBranches() → BrancheProjetee[] → ProjectionScene } catch (e) { journaliserIncidentSecurite("projection_arbre", e); return { tronc:{present:true}, branches:[] } }`. **Jamais** de 500 ; l'arbre vide se rend comme un arbre sans branche.
  - [x] Anti-régression (AC2) : appliquer `reconcilierProjection` là où un état antérieur est connu ; **journaliser les `incidents`** via `journaliserIncidentSecurite` **côté serveur** (render/ ne peut pas logguer). Détection **client** → poster à une route `^/api/` minimale qui journalise (render a le droit de `fetch` `^/api/` seulement).
  - [x] `app/page.tsx` : remplacer `projection={projectionInitiale}` par la **projection réelle** chargée (repli sûr). Ne pas muter le stub gelé — construire frais.

- [x] **T5 — Render muet : arbre interactif, fiche, « Voir dans la conversation », vue liste, pan/zoom** → AC3-AC10
  - [x] Arbre : le canevas `arbre-vivant.tsx` reçoit `branches: readonly BrancheProjetee[]` (au lieu d'`eveil`) et dessine chaque branche (etat → forme/épaisseur, intensite → densité de feuilles/montée de lumière) ; `role="img"` + `aria-label` court ; **couche d'accroches** = `<button>` positionnés depuis `accroche`, **zone tactile ≥ 44 px**, couleur accent, anneau de focus jamais supprimé. Tokens **exacts** (tronc `#6A6690`, branche `#9A96BE`, feuillage `#8FB6D8`, **rayonnement = lueur nacre `#CDE4F8` statique**, accent `#8FC1EF` = accroche ; **aucun brun, aucun or, aucun rouge** ; ne pas assombrir le tronc, 3,63:1).
  - [x] `FicheBranche.tsx` (NEW, patron `PropositionBranche.tsx`) : **étiquette, jamais modale** ; nom (`titre-sm`, **police utilisatrice**), date (`meta`), extrait **comme un tour d'utilisatrice** (`corps`, filet `bordure-forte`, retrait 16px) ; actions **« Voir dans la conversation »** + **« Renommer »** (champ **vide**, bouton désactivé tant que `nomValide` est faux) ; reste de l'arbre `opacity:0.55` **sans flou** ; fermeture par tap à côté.
  - [x] **« Voir dans la conversation » (COMPLET)** : charge l'échange source persisté (`chargerEchangeSource` via route serveur), l'affiche dans la région conversation avec **ancre DOM** par tour (`data-entree-id={entree_journal.id}`, `scroll-margin-top` sous la surimpression), **surligne** le message exact (classe `.surligne` : filet `accent` + fond `accent-doux` estompé **2 s**, **immédiat** en reduced-motion), puis le **retour** restaure `origine`+`pan`+`zoom`+fiche via le view-state (T2). Ajouter les ancres sur `TourAnam.tsx`/`TourUtilisatrice.tsx`.
  - [x] **Vue liste de rang égal** (bascule **persistée** — `localStorage` documenté, pas de migration ; note : une préférence serveur pourrait la remplacer) : liste chaque branche (nom, date, **état en toutes lettres** `naissance`/`feuillaison`/**`rayonnement`**, extrait), atteignable clavier + lecteur d'écran, **mêmes branches et même état** que le canevas.
  - [x] **Pan/zoom** (AC9) : pan doigt/glisser, zoom pincement/molette/**boutons `+`/`−` clavier**, **double-tap = cadrer** ; zoom **propre à l'arbre**. Aucun compteur/%/légende.
  - [x] Libellés d'UI (le rendu ne peut pas importer `lib/`) dans `render/…/copie-*.ts` : « Voir dans la conversation », « Renommer », **mapping `fruit`→`rayonnement`** pour la vue liste.

- [x] **T6 — Gardes d'architecture + lexique interdit + non-régression** → toutes
  - [x] Étendre `tests/branche-architecture.test.ts` : les nouvelles RPC (`charger_branches_arbre`, `charger_echange_source`, `renommer_branche`) n'apparaissent **QUE** dans `lib/data/depot-branche.ts` ; **aucun** `.from("branche")` hors dépôt.
  - [x] `scene-architecture.test.ts` reste **verte** : `projection.ts` sans import ; aucun champ `message` ; `render/` (arbre + fiche + vue liste) sans `process.env`, sans `@supabase`, sans `@/lib/(data|domain|safety)`.
  - [x] **Lexique interdit FR-031** (test de type `tests/lexique-interdit.test.ts` sur les composants d'arbre + fiche) : bannir compteur/pourcentage/`%`/niveau/jauge/série/badge/score ; le scalaire de progression ayant été retiré, aucun chiffre global.
  - [x] Non-régression : `supabase db reset` (0001→0022 propre), `tsc`/`eslint`/`next build` propres, **tous les tests existants** (~1179 en fin de 4.5) restent verts.
  - [x] Ajouter `branche` (UPDATE) à la sonde de frontière art. 9 (comme l'INSERT en 4.5).

## Dev Notes

### Le fait le plus important
La 4.6 **dé-gèle la projection** (`lib/scene/projection.ts` : `branches: readonly []` → `readonly BrancheProjetee[]`, `eveil` **supprimé**) et introduit la **première écriture** sur `branche` (le **renommage**) — donc la **première policy UPDATE**, avec le piège **R1** en embuscade : `authenticated` a le grant UPDATE table-level → un `.from("branche").update(...)` **direct** saute toute RPC. La garde (write-gate art. 9 + `nom` non vide + **immuabilité de `etat`/`intensite`/`date`**) **DOIT** vivre dans la **policy `WITH CHECK` + un trigger**, jamais dans la seule RPC.

### Le cœur en une phrase
`lib/scene/` projette les branches (état max), `render/` les dessine **muet** (couche d'accroches ≥44px + fiche non-modale + vue liste de rang égal + pan/zoom), et « Voir dans la conversation » **rejoue l'échange source persisté** positionné sur le message exact — la monotonie d'**écriture** restant la 4.7.

### Livré (4.6) vs Différé
| Livré en 4.6 | Différé |
|---|---|
| Projection réelle des branches (dé-gel `projection.ts`) | Cycle de vie monotone `etat`/`intensite` (transitions, CHECK/trigger) → **4.7** |
| Fiche (nom/date/**extrait verbatim** comme tour utilisatrice) | Tronc `incomplet`/`complet` (dépend du **socle calculé**, FR-051) → **Epic 5** |
| **Renommage** (migration 0022, policy UPDATE gardée + trigger) | **Illumination sémantique** (racines=ancrage / branches=liberté) → **parquée, décision Sanela** (voir plus bas) |
| **« Voir dans la conversation »** COMPLET (rejeu persisté + ancres + surlignage 2s + caméra retour) | Greffe du **beau moteur Canvas** (asset `arbre_lunaire` recoloré) → itération visuelle parallèle |
| Vue liste de rang égal, pan/zoom, anti-régression au rendu | Effacement d'une branche → **service_role, Epic 6** (contrainte d'ordre RESTRICT déjà tracée) |

### Modèle de données — décisions load-bearing
- **L'enum SQL reste `('naissance','feuillaison','fruit')`** (0021:50). **NE PAS migrer l'enum.** Le libellé « rayonnement » est un **mapping d'affichage** (render/copie) ; l'AC vue liste exige l'état **en toutes lettres** `naissance`/`feuillaison`/**`rayonnement`**.
- **Renommage = dépôt de contenu art. 9 neuf** → la policy UPDATE **inclut `a_consenti_art9()`** (≠ la policy UPDATE du signal 0021:118 qui l'omet volontairement car transition de pointeur). Miroir : `fait_extrait` (0018:84).
- **Trigger d'immuabilité indispensable** : sans lui, une policy UPDATE owner+consentement laisserait un update direct forger `etat='fruit'`/`date_naissance` (le `WITH CHECK` ne voit que la ligne NEW, pas quelles colonnes changent) → pré-emption de 4.7.
- **`branche_bloquee_par_detresse()` sur le renommage : NON** (décision par défaut). AD-17 vise la **naissance** d'une branche, pas l'édition d'un nom ; corriger un nom à tout moment est protecteur. *(À confirmer en revue si Sanela veut le contraire.)*
- **Lecture avec verbatim (art. 9) assumée** : contrairement à la 4.5 (proposition générique, join retiré exprès, corrections #6/#11), la fiche 4.6 **doit** montrer le verbatim (FR-027). NFR-022 ne bloque pas l'**affichage** légitime à la propriétaire ; il interdit le verbatim/nom dans les **logs et messages d'erreur** (code Postgres seul) et impose la route art. 9 en `no-store`.

### Défense anti-régression au rendu (AC2) — où elle vit (sans casser AD-7)
`render/` ne peut **pas** journaliser (`@/lib/safety` interdit, `process.env` interdit) et s'interdit « aucune monotonie, aucune règle métier ». Donc : un **réconciliateur pur** dans `lib/scene` (`reconcilierProjection`, max par id) ; l'**appelant serveur** journalise les `incidents` (`journaliserIncidentSecurite`) ; une détection **client** passe par une route `^/api/` minimale (le rendu a le droit de `fetch` `^/api/` seulement). Les incidents ne portent **que** id/champ, jamais le `nom`.

### Ce qu'on RÉUTILISE (ne pas réinventer)
- `public.branche_nom_significatif(text)` (0021:29, aligné `.trim()`) — dans la policy UPDATE **et** la RPC de renommage (jamais `length(btrim())>0`).
- `public.a_consenti_art9()` / `public.est_barre_minorite()` (write-gate art. 9).
- Patrons trigger `before update` mordant `service_role` : `signal_reconceptualisation_garde_transition` (0021:132), `fait_extrait_garde_resurrection` (0018:73).
- Patrons RPC/lecture : `creer_branche_depuis_signal` (0021:157), `charger_faits_actifs`/`depot-rappel.ts` (RPC + mapping verbatim, erreur=code).
- `lib/safety/ouverture-branche.ts` + `rpc-repli.ts` (`journaliserIncidentSecurite`) — repli sûr à `null`/défaut, jamais de 500.
- `render/conversation/PropositionBranche.tsx` / `CarteAbonnement.tsx` — patron composant client muet + callbacks (pour `FicheBranche` + « Renommer »).
- `fil-ops.ts` (`insererTour`) + `scroll-margin-top: calc(var(--cible-tactile)+var(--esp-6))` (déjà utilisé sous la surimpression) — pour l'ancre surlignée.
- `lib/scene/vue.ts` (réducteur pur idempotent) — patron d'extension du view-state caméra/retour.
- Tokens design de la Story 1.2 (couleurs, arbre, `cible-tactile: 44px`, durées `180/320/700`, courbe unique) — consommer les variables CSS, ne rien redéfinir.

### Project Structure Notes
**NEW** : `supabase/migrations/0022_branche_arbre.sql` · `render/FicheBranche.tsx` (chemin indicatif) · le composant vue liste · éventuellement une route `^/api/` d'incident + de lecture d'échange source · tests (`tests/branche-arbre.test.ts`, `tests/branche-renommage.test.ts`, `tests/projection-arbre.test.ts`, `tests/lexique-interdit-arbre.test.ts`).
**UPDATE** : `lib/scene/projection.ts` (types + `branches` + réconciliateur, `eveil` retiré) · `lib/scene/vue.ts` (caméra/retour) · `lib/scene/index.ts` (si nouveaux exports) · `lib/data/depot-branche.ts` (chargerBranches/chargerEchangeSource/renommer) · `app/api/anam/branche/route.ts` (action « renommer ») · `app/page.tsx` (projection réelle) · `render/scene-dom.tsx` (branches + câblage onClick d'accroche → action de vue) · `render/arbre-vivant.tsx` (prop `branches`, accroches, mapping état→matière) · `render/monde.module.css` (accroche interactive, estompe 0.55) · `render/conversation/{Conversation,Fil,TourAnam,TourUtilisatrice,types}.tsx` + `conversation.module.css` (ancres DOM + `.surligne`) · `tests/branche-architecture.test.ts` + `tests/scene-architecture.test.ts` (extensions de garde).

### ⚠️ Chevauchement Epic 5 à assumer (périmètre COMPLET, décision PO)
La lecture de l'**échange source persisté** (`charger_echange_source`, rejeu du fil) est adjacente à la lecture-journal que la migration 0016 range plutôt en Epic 5. Le PO a tranché **COMPLET** pour 4.6 : on livre le « Voir dans la conversation » de bout en bout. À la revue, vérifier qu'on n'a pas dupliqué de mécanisme que Epic 5 devra re-généraliser (viser une lecture **minimale et réutilisable**, pas un moteur de journal complet).

### 🌿 Idée PARQUÉE pour Sanela — illumination sémantique (NE PAS implémenter en 4.6)
Julian a proposé (2026-07-31) que **différentes parties de l'arbre s'illuminent selon le sens** : **racines** pour l'**ancrage**, **branches** pour la **perspective/liberté**. Belle idée, mais **soul-of-product** : si le **système** classe une prise de conscience, le produit **catalogue** sa vie intérieure — ce qu'Anima s'interdit (FR-018 « jamais une signification cataloguée », FR-025 « propose, ne décrète jamais », charte « rien ne trahit »). Viable **uniquement si c'est ELLE** qui choisit la catégorie (cohérent avec « elle déclare le rayonnement »), au prix d'une friction sur le champ de nommage **vide** (UX-DR-27). **Décision réservée à Sanela.** Techniquement **additif** sur `BrancheProjetee` (un `categorie` choisi par elle) — **ne bloque pas 4.6**. Consigné aussi dans `deferred-work.md`.

### References
- [epics.md#Story-4.6](../planning-artifacts/epics.md) L882-896 (ACs), L793-797 (cadre invariant Epic 4), L214-232 (UX-DR-24/25/26/37/42).
- [prd.md#FR-027](../planning-artifacts/prds/prd-Anima-2026-07-21/prd.md) L101, FR-029 L103, FR-031 L105, FR-051 L175, FR-088.
- [ARCHITECTURE-SPINE.md](../planning-artifacts/architecture/architecture-Anima-2026-07-22/ARCHITECTURE-SPINE.md) AD-1, AD-2, AD-7, AD-8, AD-10, AD-12, AD-13.
- [DESIGN.md#arbre](../planning-artifacts/ux-designs/ux-Anima-2026-07-21/DESIGN.md) tokens L217-228, section arbre L573-612 (états mis à jour vers **rayonnement**), fiche-branche L623-627, contrastes L362-367.
- [EXPERIENCE.md](../planning-artifacts/ux-designs/ux-Anima-2026-07-21/EXPERIENCE.md) région arbre L155-162, State Patterns L181-183, Accessibility Floor L204-221, Dossier L'arbre L224-278. ⚠️ EXPERIENCE.md dit encore « fruit » (spec périmée) → lire **rayonnement**.
- Code : `supabase/migrations/0021_branche.sql` (schéma, `branche_nom_significatif`, patrons policy/trigger/RPC), `0016_entree_journal.sql` (verbatim `contenu`, cible d'ancrage), `0018_fait_extrait.sql` (précédent policy UPDATE + trigger art. 9), `lib/scene/projection.ts` (stub à dé-geler), `render/arbre-vivant.tsx` (moteur muet), `lib/data/depot-branche.ts` (dépôt à étendre), `lib/safety/ouverture-branche.ts` + `rpc-repli.ts` (repli sûr).
- Mémoire : `arbre-de-vie-rayonnement`, `supabase-rls-write-gate-dans-policy` (R1/R1-bis), `supabase-local-cli`.

## Revue adversariale (IA) — 2026-08-04

**Dispositif :** 7 angles de chasse indépendants → un sceptique mandaté pour RÉFUTER chaque finding (98 agents, 7,4 M tokens, 1 h 46). **91 findings, 14 réfutés, 77 retenus** (17 HAUTE, ~32 MOYENNE, ~28 BASSE). Décision PO : **corriger les 77**.

**Ce qui a tenu :** la couche base/modèle/données/serveur (T1→T4) — write-gate art. 9, isolation RLS, AD-17, NFR-022 sur les dépôts, pureté du modèle. **Ce qui a cassé :** le rendu (T5), sur des points structurants.

### Les 8 défauts HAUTE (les 17 findings dédupliqués) — tous corrigés

| # | Défaut | Correctif |
|---|---|---|
| 1 | **[R1 appliquée à moitié]** Le trigger d'immuabilité était `BEFORE UPDATE` seulement ; un `.from("branche").insert({etat:'fruit', intensite:1, date_naissance:'1999'})` DIRECT passait (**reproduit en live : 201 Created**), forgeant un rayonnement jamais déclaré, **irréversible** (aucune policy delete ; le chemin 4.5 fait `on conflict do nothing` en brûlant le signal) | 0023 : trigger `BEFORE INSERT OR UPDATE` (`TG_OP`) + horodatages autoritaires + **la policy d'insertion épingle `etat='naissance' and intensite=0`** (double défense). **Mutation-vérifié.** |
| 2 | **Les accroches n'étaient pas là où l'arbre est dessiné** (jusqu'à ~102 px) : un viewBox carré est *letterboxé*, or les boutons étaient positionnés en % du conteneur → **AC3 mort** (4 angles l'ont trouvé séparément) | Le **carré effectif** est mesuré (ResizeObserver) ; SVG et accroches partagent ce repère unique |
| 3 | **« Voir dans la conversation » DÉTRUISAIT la conversation** : `<Conversation>` était démontée → fil de séance perdu, proposition 4.5 ré-amorcée ; et sortir par la nav laissait la région Anam bloquée | La Conversation reste **montée** (`display:contents`/`none`), l'échange source se superpose ; la nav annule le rejeu |
| 4 | **Une branche née pendant la session n'apparaissait jamais** (`useState(props)` figé) | Resynchronisation props→état (patron React) + `router.refresh()` à l'entrée dans la région arbre |
| 5 | **La défense AC2 [DUR] s'auto-désarmait** : au repli, elle effaçait sa propre mémoire ; et **ignorait la disparition d'une branche** (la pire régression) | `indisponible` distingue panne et arbre vide ; le repère **fusionne** au lieu d'écraser ; `disparition` est un incident. **Mutation-vérifié.** |
| 6 | **Le champ de renommage fuyait d'une branche à l'autre** (pas de `key`) | `key={selectionnee.id}` + champ de renommage extrait en composant partagé |
| 7 | **La fiche était inatteignable/infermable au clavier** ; le « tap à côté ferme » n'existait pas | Focus entrant, Échap, focus rendu au déclencheur, couche cliquable |
| 8 | **Le zoom partait du coin haut-gauche** (l'arbre fuyait hors cadre en 4 clics) | `transform-origin: 50% 50%` + `cadrer` recalculé |

### Corrections notables (MOYENNE / BASSE)

- **art. 9 :** `/api/anam/echange` servait le verbatim **sans garde d'état** (révocation du consentement et barrière-minorité contournées) → garde `etapeOnboardingPour` + `force-dynamic` + validation UUID. `intensite`/`nom` bornés en base. Caractères **sans glyphe** (U+200B, U+2800, U+3164, U+00AD) refusés comme nom, **des deux côtés** (base + domaine + rendu, R1-bis).
- **Rémanence :** le repère anti-régression vivait en `localStorage` — non scopé par utilisatrice (contamination entre comptes), jamais purgé, empoisonnable, et il faisait planter la scène s'il était corrompu → **mémoire de session** (`useRef`). Seule la préférence d'affichage reste persistée.
- **`charger_echange_source` :** le voisinage n'était borné que par `limit 6` — il recollait des tours de séances vieilles de plusieurs mois → borne ±2 h + ordre total `(cree_le, id)` (ex æquo n'étaient plus perdus).
- **`renommer_branche` réussissait en silence** sur une branche non possédée (l'UI affichait un renommage fantôme) → lève désormais.
- **Vue liste :** « Renommer » n'ouvrait qu'une fiche rendue dans la vue canevas → **le « rang égal » d'AC8 était faux au clavier** ; champ de renommage désormais en place.
- **AC4 :** le message source était identifié par la **teinte seule** → repère textuel + filet accent permanent.
- **`/api/incident` :** le libellé mentait (« indisponibilité d'une RPC de sécurité ») et le canal était illimité → libellé propre + plafond par utilisatrice (le journal partagé porte les incidents de détresse).
- **Gestes :** seuil de glisser (déplacer en attrapant une accroche n'ouvre plus la fiche), `wheel` en écouteur **non passif**, pan au **clavier** (flèches), double-clic qui cadre sans être recouvert, `aria-pressed` contradictoire retiré, reflow WCAG rétabli sur la région.

### Les gardes de test, refaites

La revue a établi que **« toute la défense anti-régression pouvait être supprimée sans qu'un seul test vire au rouge »**, et que plusieurs gardes étaient tautologiques (le scan FR-031 ne lisait qu'un fichier de libellés ; `eveil === undefined` n'interdisait aucun nouveau scalaire ; les tests du trigger passaient **vacueusement** si un test antérieur laissait l'état sale). Corrigé : scan FR-031 sur **tout** `render/arbre/`, garde d'équivalence **render ↔ domaine** de la classe de nom (R1-bis), gardes de câblage AC2/AC3/AC4/AC6/AC8/AC9/AC10, `beforeEach` d'isolation sur les tests DB, sonde de frontière art. 9 **comportementale** pour `branche` (INSERT *et* UPDATE), 4 clauses du trigger enfin éprouvées.

### Différé (documenté dans deferred-work)

- **Harnais de test composant (RTL/jsdom)** : les gardes de rendu restent des lectures de source (convention du projet, environnement `node`). Ajouter `@testing-library/react` + `jsdom` est un **ajout de dépendance** — hors périmètre d'une correction de revue, à décider séparément. Compensé par des tests **purs** exhaustifs (réconciliateur, géométrie, domaine) et des gardes de câblage.
- **Tours d'Anam absents du rejeu** : `entree_journal` n'a aujourd'hui **aucun écrivain de tours `anam`** (la policy épingle `role='utilisatrice'`) → « Voir dans la conversation » rejoue un monologue. Prérequis rangé Epic 5.

## Dev Agent Record

### Agent Model Used
Claude Opus 4.8 (1M context) — claude-opus-4-8[1m]

### Debug Log References
- **T1 mutation-vérifiée** : (a) `a_consenti_art9()` retiré du WITH CHECK de `branche_renommage` → le test « UPDATE DIRECT après révocation » vire au ROUGE ; (b) clause `etat` retirée du trigger `branche_garde_renommage` → le test « update direct changeant etat » vire au ROUGE. Gardes restaurées → 14/14 verts. Les deux barrières R1 sont donc load-bearing, pas décoratives.
- `tsc --noEmit` propre après adaptation de `tests/scene-modele.test.ts` (retrait `eveil`, `EtatVue` élargi).
- 14 erreurs eslint dans `images/assets/design_handoff_*/support.js` (prototypes Claude Design, « ne pas porter ») → `images/**` ajouté aux ignores d'eslint.config.mjs. Le code applicatif linte propre.
- Suite complète après `supabase db reset` (0001→0022) : **1241 tests verts (113 fichiers)** — baseline 4.5 était 1179 (+62, zéro régression). `next build` propre (routes `/api/anam/echange` + `/api/incident` enregistrées).

### Completion Notes List
- **T1 (0022)** : `charger_branches_arbre()` (join branche⋈entree_journal EN BASE, verbatim pour la fiche) ; `charger_echange_source()` (message exact + voisinage ±6, `est_cible`) ; policy `branche_renommage` (WITH CHECK : owner + `a_consenti_art9()` + non-barré + `branche_nom_significatif` — leçon R1) ; trigger `branche_garde_renommage` (SEUL `nom` mutable ; `etat`/`intensite`/`date_naissance`/`extrait_source_id`/`utilisatrice_id`/`cree_le`/`id` figés — mord service_role, pré-emption 4.7 fermée) ; RPC `renommer_branche` (confort, pas barrière).
- **T2 (modèle pur)** : `EtatBranche`/`BrancheProjetee` (miroir littéral du CHECK SQL, `extraitSourceId` — jamais `message`, garde B6) ; `branches: readonly BrancheProjetee[]` ; **`eveil` SUPPRIMÉ** (scalaire de progression globale = jauge interdite FR-031) ; `reconcilierProjection()` pur (max par id, incidents id+champ seuls — jamais le nom, NFR-022) ; `vue.ts` élargi (caméra pan/zoom bornée DANS le modèle, fiche sélectionnée, `voirDansConversation`/`revenir` avec contexte de retour exact).
- **T3 (data)** : dépôt étendu (`chargerBranches`/`chargerEchangeSource`/`renommer`, erreurs = code Postgres seul) ; route `/api/anam/branche` action `renommer` (validation `nomValide` amont).
- **T4 (app)** : `lib/safety/projection-arbre.ts` (repli sûr → arbre vide, jamais un 500) ; route POST `/api/incident` (régression signalée par le client : champ seul journalisé, jamais l'id/nom) ; route GET `/api/anam/echange` (`no-store`) ; `app/page.tsx` charge proposition + projection EN PARALLÈLE.
- **T5 (render muet)** : `render/arbre/` — `geometrie.ts` (éventail déterministe stable, position sans taxonomie), `ArbreInteractif` (SVG argent lunaire ; état lu dans la MATIÈRE : trait 2/3.2px, feuillage densité=intensite, rayonnement = lueur nacre STATIQUE sans objet-fruit ; accroches = boutons ≥44px contre-scalés 1/zoom ; pan/glisser + pincement + molette + boutons +/− + double-tap=cadrer ; anti-régression AC2 côté client : max connu en localStorage + `reconcilierProjection` + POST `/api/incident` ; bascule vue liste persistée localStorage), `FicheBranche` (étiquette NON-modale, nom/extrait en voix UTILISATRICE, champ de renommage VIDE, estompe 0.55 sans flou), `VueListe` (rang égal, état EN TOUTES LETTRES naissance/feuillaison/**rayonnement**), `EchangeSource` (rejeu persisté, cible surlignée accent+accent-doux estompé 2 s, immédiat en reduced-motion, `scroll-margin-top` sous la surimpression), `copie-arbre.ts` (mapping d'affichage `fruit`→`rayonnement`) ; `arbre-vivant.tsx` réduit au DÉCOR (niveau fixe, plus de prop `eveil`) ; `scene-dom.tsx` câble tout (région arbre réelle, région anam ↔ échange source, renommage via `^/api/` avec mise à jour optimiste).
- **T6 (gardes)** : `branche-architecture.test.ts` étendu (3 RPC 4.6 confinées au dépôt) ; `arbre-rendu.test.ts` (lexique FR-031, rayonnement≠fruit, a11y, charte sans brun/or, reduced-motion) ; non-régression complète.
- **Décisions prises en implémentation** (à confirmer en revue) : bascule vue liste + état max anti-régression en `localStorage` (pas de migration ; préférence serveur possible plus tard) ; fenêtre de l'échange source bornée à ±6 tours (lecture minimale, chevauchement Epic 5 maîtrisé) ; le renommage n'est PAS gaté sur la détresse (AD-17 vise la naissance) ; l'incident de régression ne porte QUE `champ` (pas l'id de branche — encore plus strict que le spec).

## RE-REVUE adversariale (IA) — 2026-08-04

**Dispositif.** Menée APRÈS la passe de correction des 77 findings, ciblée sur les zones qu'elle avait
réécrites (le code neuf écrit vite est la zone la plus risquée). 6 angles de recherche indépendants +
1 balayage de lacunes, puis **vérification à charge de réfutation** : chaque candidat est confié à un
agent dont la mission est de le DÉTRUIRE, verdict par défaut « réfuté », reproduction exigée pour confirmer.
32 candidats bruts → 30 dédupliqués → 30 vérifiés → **6 réfutés, 24 retenus** (7 HAUTE), tous corrigés.

**Le constat qui compte : la passe précédente n'avait pas réparé ce qu'elle annonçait.** Trois gardes
« refaites » survivaient encore à leur mutation, dont le correctif PHARE (R1-ter, la garde d'état à
l'INSERT). La cause : les tests d'insertion passaient par une session JWT, où la **policy ET le trigger**
bloquent tous les deux — muter l'un laissait l'autre refuser. Ils prouvaient « au moins une des deux
moitiés existe », jamais l'une NI l'autre. Seul le chemin `service_role` (que la RLS ne borne pas) isole
le trigger. Vérifié à la main : la mutation laissait **1 289 tests verts** ; avec le test ajouté, elle en
tue exactement un.

### Les 7 défauts HAUTE

| # | Où | Le défaut |
|---|---|---|
| 1 | `ArbreInteractif.tsx:132` | L'effet de mesure dépendait de `[vueListe]` seul → un canevas monté PLUS TARD (arbre vide → 1re branche, ou reprise de panne) n'était jamais mesuré : `.monde` en 0×0, **arbre INVISIBLE au scénario nominal de la story**. Reproduit en jsdom. |
| 2 | `geometrie.ts:34` | `frac = i / (n − 1)` → la position dépendait du NOMBRE TOTAL : chaque naissance déplaçait toutes les branches déjà nées (221 unités mesurées de 1 à 2 branches). DESIGN.md l'interdit mot pour mot. Remplacé par un placement **par RANG** (inversion binaire). |
| 3 | `0023:24` | Le correctif R1-ter survivait intégralement à sa mutation ; c'est pourtant la seule défense sur le chemin `service_role`. |
| 4 | `echange/route.ts:32` | La garde d'état art. 9 de la route neuve n'était couverte par AUCUN test (le fichier n'était importé nulle part) : supprimable sans qu'un test rougisse, alors que la policy de lecture d'`entree_journal` n'a volontairement aucun prédicat de consentement (export FR-067). |
| 5 | `arbre-rendu.test.ts:58` | La garde FR-031 interdisait sept MOTS français : elle rougissait sur `niveauDuRang` et laissait passer `{nbBranches} branches nommées` + `Progression : 45 %`. |
| 6 | `ArbreInteractif.tsx:351` | Cibles de 44 px constantes contre un écartement en 1/N → au-delà de ~9 branches, on ouvrait la fiche de **la voisine**. |
| 7 | `scene-dom.tsx:118` | La synchro props→state adoptait `indisponible` inconditionnellement : un hoquet du rafraîchissement effaçait un arbre déjà affiché. |

### Les corrections structurelles (au-delà du symptôme)

- **Harnais de test COMPOSANT ajouté** (`jsdom` + Testing Library, projet Vitest `rendu` séparé). Le report
  a été invalidé par la revue elle-même : sept des vingt-quatre défauts étaient dans `render/`, et les gardes
  par lecture de source prouvent le CÂBLAGE, jamais le COMPORTEMENT. 26 tests de rendu réels.
- **La garde FR-031 déménage vers le DOM rendu** : « aucun chiffre dans la vue arbre » est un tueur de
  mutant par construction — un compteur peut s'appeler n'importe comment, un chiffre affiché ne ment pas.
- **`codeJournalisable` remonte DANS le journaliseur** (`rpc-repli.ts`) : l'extraction n'était appliquée
  qu'à un appelant, les deux routes de 4.6 journalisaient toutes `code: "Error"`. Un filtre de FORME
  (`SQLSTATE`/`PGRST`) ferme du même coup le risque NFR-022 du repli sur texte libre.
- **Refus métier ≠ incident de sécurité** : un refus de garde (P0001, 42501…) rend 403 et un journal
  honnête, au lieu de crier « indisponibilité d'une RPC de sécurité » dans le canal des alertes de détresse.
- **Migration 0024 — la classe sans-glyphe, mesurée trop étroite** : 20 invisibles passaient encore, dont
  **U+FE0F** (présent dans presque tout copier-coller d'emoji). La re-revue a fait naître 9 branches réelles
  au nom entièrement invisible. Classe étendue et **rognage extrait en fonction partagée**, la naissance
  s'alignant enfin sur le renommage (elles divergeaient : un nom collé changeait tout seul au 1er renommage).
- **`render/nom-branche.ts` — une seule copie client** de la validation de nom. Le durcissement R1-bis
  n'avait été appliqué qu'au renommage (4.6) et pas à la naissance (4.5). Une garde à trois branches
  (base ⟺ domaine ⟺ rendu) verrouille l'équivalence, caractère par caractère, contre la vraie base.
- **`adopterProjection` rejoint `lib/scene`** : décider si une lecture indisponible remplace l'affichage
  est une DÉCISION, pas un dessin — elle n'avait rien à faire dans le rendu (AD-7).

### Mutation-vérifié

| Garde | Mutation | Effet |
|---|---|---|
| Trigger `TG_OP='INSERT'` (0023:24) | `raise` retiré | 1 test rouge (avant : 0 sur 1 289) |
| `order by (date_naissance, id)` (0023:198) | `order by` retiré | 1 test rouge (avant : 0) |
| Garde d'état art. 9 (`/api/anam/echange`) | ligne retirée | 5 tests rouges (avant : 0) |
| Mesure du carré (`[canevasVisible]`) | dép. remise à `[vueListe]` | 2 tests rouges |

### File List
**Nouveaux :** `supabase/migrations/0022_branche_arbre.sql` · `lib/safety/projection-arbre.ts` · `app/api/incident/route.ts` · `app/api/anam/echange/route.ts` · `render/arbre/geometrie.ts` · `render/arbre/copie-arbre.ts` · `render/arbre/ArbreInteractif.tsx` · `render/arbre/FicheBranche.tsx` · `render/arbre/VueListe.tsx` · `render/arbre/arbre.module.css` · `render/conversation/EchangeSource.tsx` · `tests/branche-renommage.test.ts` · `tests/branche-arbre.test.ts` · `tests/projection-arbre.test.ts` · `tests/vue-arbre.test.ts` · `tests/orchestrateur-arbre.test.ts` · `tests/geometrie-arbre.test.ts` · `tests/arbre-rendu.test.ts`
**Ajoutés par la revue (2026-08-04) :** `supabase/migrations/0023_branche_arbre_correctifs.sql` · `render/arbre/ChampRenommage.tsx` · `tests/branche-correctifs.test.ts`
**Modifiés par la revue :** `lib/scene/projection.ts` (disparition/NaN/`indisponible`) · `lib/safety/projection-arbre.ts` (`detailJournalisable`, repli `indisponible`) · `lib/domain/branche.ts` (classe sans-glyphe) · `lib/data/depot-branche.ts` (borne d'intensité) · `render/arbre/{ArbreInteractif,FicheBranche,VueListe,copie-arbre,arbre.module.css}` · `render/conversation/EchangeSource.tsx` · `render/scene-dom.tsx` · `render/monde.module.css` · `app/api/anam/echange/route.ts` · `app/api/incident/route.ts` · `tests/{arbre-rendu,projection-arbre,orchestrateur-arbre,scene-modele,branche-renommage,consentement}.test.ts`
**Ajoutés par la RE-REVUE (2026-08-04) :** `supabase/migrations/0024_branche_nom_sans_glyphe.sql` · `render/nom-branche.ts` · `vitest.config.ts` (projet `rendu`) · `tests/rendu/_installation.ts` · `tests/rendu/_outils.ts` · `tests/rendu/arbre-mesure.test.tsx` · `tests/rendu/arbre-sans-mesure.test.tsx` · `tests/rendu/arbre-gestes.test.tsx` · `tests/rendu/renommage.test.tsx` · `tests/echange-endpoint.test.ts` · `tests/nom-branche-equivalence.test.ts`
**Modifiés par la RE-REVUE :** `render/arbre/{ArbreInteractif,ChampRenommage,FicheBranche,VueListe,geometrie,copie-arbre,arbre.module.css}` · `render/conversation/PropositionBranche.tsx` · `render/scene-dom.tsx` · `lib/scene/projection.ts` (`adopterProjection`) · `lib/safety/{rpc-repli,projection-arbre}.ts` · `lib/domain/branche.ts` · `app/api/{incident,anam/branche}/route.ts` · `package.json` (3 dép. de dev) · `tests/{arbre-rendu,geometrie-arbre,projection-arbre,orchestrateur-arbre,branche-correctifs,branche-endpoint}.test.ts`
**Modifiés :** `lib/scene/projection.ts` (types branches + réconciliateur, `eveil` retiré) · `lib/scene/vue.ts` (caméra/fiche/retour) · `lib/data/depot-branche.ts` (3 lectures/écritures) · `app/api/anam/branche/route.ts` (action renommer) · `app/page.tsx` (projection réelle en parallèle) · `render/scene-dom.tsx` (câblage arbre + échange source) · `render/arbre-vivant.tsx` (décor sans prop) · `render/monde.module.css` (`.regionArbre`) · `eslint.config.mjs` (ignore `images/**`) · `tests/scene-modele.test.ts` (adapté) · `tests/depot-branche.test.ts` (+4.6) · `tests/branche-endpoint.test.ts` (+renommer) · `tests/branche-architecture.test.ts` (+RPC 4.6)

## Change Log

| Date | Version | Description | Author |
|---|---|---|---|
| 2026-07-31 | 0.1 | Création du spec après réécriture des specs de l'arbre (fruit→rayonnement) + analyse parallèle 5 sous-systèmes ; périmètre « Voir dans la conversation » = COMPLET (décision PO) ; illumination sémantique parquée pour Sanela. | Claude Opus 4.8 (1M) |
| 2026-08-04 | 1.1 | **Revue adversariale (98 agents, 7,4 M tokens) : 77 findings retenus, TOUS corrigés** (décision PO). Migration **0023** (trigger INSERT anti-forge — bypass HAUTE reproduit en live —, policy d'insertion épinglant l'état, bornes intensite/nom, caractères sans glyphe, `renommer_branche` non silencieux, voisinage de l'échange source borné ±2 h + ordre total). Réconciliateur : disparition + NaN + `indisponible`. **ArbreInteractif réécrit** (alignement du repère carré, zoom centré, seuil de glisser, clavier, mémoire de session au lieu de localStorage). scene-dom : Conversation jamais démontée, resync props, piège de nav. Fiche/liste : `key`, focus, Échap, tap-à-côté, renommage au clavier. Routes durcies (garde d'état art. 9 sur `/echange`, UUID, `force-dynamic`, plafond d'incidents). Gardes de test dé-tautologisées + sonde art. 9 comportementale. 3 gardes clés mutation-vérifiées. **1287 tests verts** (+46), db 0001→0023, tsc/eslint/build propres. | Claude Opus 5 (1M) |
| 2026-08-04 | 1.2 | **RE-REVUE adversariale (27 agents, 3,3 M tokens) : 24 findings retenus sur 30 vérifiés, TOUS corrigés** (décision PO). 7 HAUTE, dont l'**arbre invisible au scénario nominal** et l'**arbre qui se réorganisait à chaque naissance**. Constat central : **trois gardes « refaites » survivaient encore à leur mutation**, dont le correctif phare R1-ter. **Harnais de test composant ajouté** (jsdom + Testing Library, projet Vitest `rendu` séparé — le report de la revue précédente a été invalidé par les faits). Migration **0024** (classe sans-glyphe étendue à 20 invisibles dont U+FE0F, rognage partagé naissance/renommage). `render/nom-branche.ts` : une seule copie client, équivalence base⟺domaine⟺rendu gardée caractère par caractère. Placement par RANG (permanence). Cible cliquable bornée par l'écartement réel. 4 gardes mutation-vérifiées. **1 346 tests verts** (+59), db 0001→0024, tsc/eslint/build propres. | Claude Opus 5 (1M) |
| 2026-07-31 | 1.0 | Implémentation TDD T1→T6 complète : migration 0022 (2 RPC lecture + policy UPDATE renommage R1 + trigger immuabilité, mutation-vérifiés) ; projection dé-gelée (`eveil` supprimé) + réconciliateur anti-régression ; caméra/retour dans le view-state ; dépôt + routes ; arbre interactif muet (fiche, vue liste, échange source, pan/zoom, a11y) ; gardes d'archi étendues. 1241 tests verts (+62), db 0001→0022, tsc/eslint/build propres. Status → review. | Claude Opus 4.8 (1M) |
