---
baseline_commit: af777f8
---

# Story 2-4b (remédiation) : L'extinction d'un épisode de détresse est idempotente au retry

Status: review

## Contexte — pourquoi cette story existe

Remédiation de la dette **F4** de la Story 4.1 (dette de racine **2.4**). La RPC possédée
`enregistrer_tour_detresse` (migrations `0010`/`0011`) — le SEUL point d'écriture de l'extinction
d'un épisode de détresse — n'a **aucune clé d'idempotence**. Un « Réessayer » (2.2) rejoue le même
tour logique (même `jetonTour`/`cleIdempotence`) → le pipeline sécurité (AD-16) s'exécute une 2ᵉ
fois → la RPC **ré-incrémente `tours_surs_consecutifs`** pour ce même tour. Si ce double-comptage
atteint le seuil un tour trop tôt (la garde temporelle des 30 min étant déjà franchie), l'épisode
**s'éteint prématurément** → `limites_levees` retombe avant l'heure → paywall/quota peuvent
réapparaître au cœur d'une détresse. **Affaiblissement direct d'AD-16/AD-17 (§5 PRD).**

La 4.1 a **élargi la fenêtre d'exposition** : son nouveau 500 (échec d'écriture du journal, APRÈS le
pipeline sécurité) crée un point d'échec synchrone banal (panne DB) qui déclenche le « Réessayer ».
La racine était déjà déclenchable par un 500 d'egress (pré-4.1).

Différée en story propre car elle **touche le pipeline sécurité** (surface la plus critique), à
tester à part. **Porte pré-lancement** (auto-correctif partiel : l'épisode rouvre au tour détresse
suivant ; fenêtre étroite).

## Story

En tant qu'**utilisatrice en détresse**,
je veux que **réessayer un message qui a échoué ne raccourcisse jamais ma période de protection**,
afin que **le paywall et les limites ne réapparaissent pas au milieu d'un moment vulnérable**.

## Acceptance Criteria

1. **Le tour sûr n'est compté qu'UNE fois par tour logique (idempotence, AD-17).** Étant donné un
   épisode ouvert et un tour de niveau 0 déjà enregistré sous une clé de tour `k`, quand la RPC est
   rappelée avec la **même** clé `k` (« Réessayer », double-soumission, doublon réseau), alors
   `tours_surs_consecutifs` **n'est pas ré-incrémenté** et l'état des limites renvoyé est **identique**
   au premier appel — aucune avance vers l'extinction.

2. **Pas d'extinction prématurée au retry (AD-16).** Étant donné un épisode ouvert avec
   `tours_surs_consecutifs = seuil − 1` et la garde temporelle déjà franchie, quand le même tour sûr
   (même clé) est rejoué, alors l'épisode **reste ouvert** (`fin IS NULL`, `limites_levees = true`) —
   seul un **nouveau** tour logique (clé différente) peut le faire atteindre le seuil.

3. **L'escalade de protection n'est JAMAIS supprimée (asymétrie, AD-15 « le doute protège »).** Étant
   donné qu'une re-tentative du même tour logique détecte un niveau **plus élevé** que la première
   (non-déterminisme du modèle : 0 → ≥ 1), quand la RPC est rappelée avec la même clé, alors elle
   **ouvre/rehausse quand même** (`niveau_max` monotone, compteur remis à 0, horloge ré-armée) : le
   court-circuit d'idempotence **ne s'applique qu'au chemin « tour sûr » (niveau 0)**, jamais au
   chemin « ouvre/rehausse » (niveau ≥ 1).

4. **Le comptage légitime reste exact.** Étant donné deux tours logiques **distincts** de niveau 0
   (clés différentes), quand ils sont enregistrés, alors chacun incrémente le compteur → l'extinction
   au seuil réel (après le délai minimal) est **préservée à l'identique** (aucune régression 2.4).

5. **Aucun art. 9, forward-only, posture inchangée.** Étant donné la migration `0017`, quand elle est
   appliquée, alors elle est **forward-only** (ne réécrit jamais `0010`/`0011`), n'ajoute **aucune
   colonne de contenu** (la clé de tour est un UUID opaque, patron `usage_ia`), la RPC reste
   `security definer` réservée `service_role` (jamais appelable sous JWT), et le repli sûr d'AD-15
   (une panne RPC → `limites_levees = true`) est **inchangé**.

## Tasks / Subtasks

- [x] **T1 — RED : tests d'idempotence comportementaux DB (AC1–AC4)** dans `tests/episode-detresse.test.ts`
  - [x] Adapter le helper `tour(...)` pour passer `p_cle_tour` (défaut : **UUID frais par appel** →
        les tests 2.4 existants gardent la sémantique « chaque tour = un tour logique distinct »).
  - [x] **AC1/AC2** — ouvre (≥ 1), compte un tour sûr sous clé `k` (`tours=1`), **rejoue** sous `k` →
        `tours` reste `1`, épisode ouvert. Puis un tour sous clé `k2` → `tours=2` → extinction au seuil.
  - [x] **AC2 bord d'extinction** — `seuil=2`, `dureeMinS=0` : tour sûr `k` (`tours=1`, ouvert), rejeu
        `k` (toujours ouvert, `tours=1`), tour `k2` (`tours=2` → **éteint**). Prouve que le retry seul
        n'éteint pas.
  - [x] **AC3** — tour sûr sous `k` (`tours=1`), puis **même clé `k` mais niveau 3** → l'épisode
        **rehausse** (`niveau_max=3`, `tours=0`, horloge ré-armée), **pas** de court-circuit.
  - [x] **AC4** — deux clés distinctes de niveau 0 comptent bien deux tours (non-régression du
        comptage) ; l'extinction au seuil réel reste identique.
  - [x] Confirmer RED : ces tests échouent contre `0011` (signature 5-args, aucune notion de clé).

- [x] **T2 — RED→GREEN : câblage `p_cle_tour` (AC1, AC5)** dans `tests/depot-episode.test.ts`
  - [x] `creerDepotEpisode(CIBLE, CLE)` : `enregistrerTour(niveau)` appelle
        `enregistrer_tour_detresse` avec **`p_cle_tour: CLE`** en plus des seuils. Repli sûr inchangé.

- [x] **T3 — GREEN : migration `0017_episode_detresse_idempotence.sql` (AC1–AC5)**
  - [x] Colonne `dernier_tour_compte text` (nullable, sans défaut : NULL ≠ toute clé → jamais de
        court-circuit fantôme) + `comment on column`.
  - [x] `drop function public.enregistrer_tour_detresse(uuid,int,int,int,int)` puis **CREATE** la
        version **6-args** (`+ p_cle_tour text`) : court-circuit **asymétrique** — au chemin niveau 0
        épisode trouvé, si `ep.dernier_tour_compte = p_cle_tour` → **no-op**, renvoie `true` (encore
        ouvert) ; sinon incrémente/éteint **et** `dernier_tour_compte = p_cle_tour`. Le chemin
        niveau ≥ 1 (ouvre/rehausse) mute **toujours** et **estampille** aussi la clé.
  - [x] `revoke all ... from public, anon, authenticated` + `grant execute ... to service_role` sur la
        **nouvelle** signature (la 5-args droppée disparaît → plus d'overload orphelin).
  - [x] Appliquer localement via `supabase db reset` (CLI **globale** v2.67.1, jamais `npx supabase`).

- [x] **T4 — GREEN : câblage data + route (AC1)**
  - [x] `lib/safety/depot-episode.ts` : `creerDepotEpisode(utilisatriceId, cleTour)` passe
        `p_cle_tour: cleTour` (la clé est **baquée à la construction** — l'interface `DepotEpisode` du
        pipeline reste **inchangée** ; l'idempotence est un détail de la couche data, AD-1).
  - [x] `app/api/anam/message/route.ts` : `creerDepotEpisode(user.id, cleIdempotence)` (le jeton coule
        déjà — 3.4 — **aucun changement client**).

- [x] **T5 — Suite verte + non-régression (AC4)**
  - [x] `set -a && . ./.env.local && set +a && npx vitest run` — toute la suite verte (Supabase local
        démarré, CLI globale). Les tests 2.4 existants (rehausse/compte/éteint/F3) **inchangés et verts**.
  - [x] `npx tsc --noEmit`, `npx eslint`, `next build` propres.

## Dev Notes

### Le cœur en une phrase

La RPC d'extinction devient **idempotente au tour logique** — mais **asymétriquement** : le
court-circuit ne couvre QUE le chemin dangereux (compter un tour sûr, qui rapproche l'extinction) et
**jamais** l'escalade de protection (ouvrir/rehausser).

### La correction du croquis de la dette (décision de conception centrale)

Le `deferred-work.md` proposait « RPC idempotente par `p_cle_tour` ». **Rendre TOUS les chemins
idempotents sur la clé serait un bug de sécurité :**

> La détection tourne le LLM à chaque tentative. Un « Réessayer » peut, par non-déterminisme,
> classer **plus haut** que la 1ʳᵉ fois (0 → 2). Si la clé court-circuitait aussi la rehausse, on
> **supprimerait une escalade de protection** — l'inverse d'AD-15.

D'où l'**asymétrie** (AC3) :
- **niveau 0, épisode ouvert** → court-circuit si `dernier_tour_compte = p_cle_tour` (c'est le seul
  chemin qui *rapproche* l'extinction).
- **niveau ≥ 1** → **jamais** court-circuité : `greatest(niveau_max)`, `tours=0`, ré-armement de
  l'horloge sont déjà idempotents **dans la bonne direction** (refaire ne fait que *retarder*
  l'extinction). La protection ne peut que monter.

### Pourquoi une seule colonne `dernier_tour_compte` (et le résidu accepté)

Le « Réessayer » ne vise QUE le tour **courant** (un tour n'avance qu'après succès). Le verrou
`FOR UPDATE` sur l'épisode ouvert rend le *check-and-set* atomique (deux POST concurrents du même
tour sérialisent : le 1ᵉʳ compte, le 2ᵉ voit `dernier == clé` → no-op). Une seule colonne suffit
donc pour : N re-tentatives du tour courant + double-soumission concurrente.

**Résidu accepté, borné, auto-cicatrisant** : un doublon réseau *hors-ordre* d'un tour *non-courant*
(clé ≠ dernière) échapperait au court-circuit → **au pire un incrément parasite**. Pour nuire, il
faudrait `tours = seuil−1` **et** la garde 30 min franchie **et** exactement ce doublon tardif — et
même alors, l'épisode **rouvre au tour détresse suivant**. Un keying complet (table/array
`tours_comptes`) serait une croissance non bornée sur une entité délibérément minimale : sur-ingénierie
pour un résidu déjà dominé. `NULL` (lignes existantes / première fois) n'égale jamais un UUID canonique
→ aucun court-circuit fantôme.

### Où la clé entre dans le pipeline

`evaluerSecuriteDuTour(deps, messages)` n'a **pas** besoin de connaître la clé : le dépôt réel la
**baque à la construction** (`creerDepotEpisode(user.id, cleIdempotence)`), exactement comme
`emettreAudit` capture déjà `cleIdempotence` dans la route (`route.ts:104`) et comme
`creerDepotJournal(user.id)` (4.1). L'interface `DepotEpisode.enregistrerTour(niveau)` et le
`depotEpisodePlaceholder` restent **inchangés** — la clé est un détail d'implémentation de la couche
data (AD-1/AD-10 : couches descendantes, l'idempotence est une préoccupation de persistance).

### SQL de référence (migration `0017`, forward-only)

```sql
alter table public.episode_detresse
  add column dernier_tour_compte text;  -- NULL ≠ toute clé → jamais de court-circuit fantôme

comment on column public.episode_detresse.dernier_tour_compte is
  'Story 2-4b (F4) : clé du DERNIER tour logique enregistré (jeton de tour 3.4). Idempotence au
   « Réessayer » : un rejeu du MÊME tour sûr (niveau 0) ne re-compte pas → jamais d''extinction
   prématurée (AD-16/AD-17). UUID opaque, jamais de contenu (art. 9-safe, patron usage_ia).';

-- Signature CHANGE (ajout p_cle_tour) → DROP l'ancienne 5-args (pas un overload orphelin) puis CREATE.
drop function if exists public.enregistrer_tour_detresse(uuid, int, int, int, int);

create function public.enregistrer_tour_detresse(
  cible uuid, p_niveau int, p_seuil_tours int, p_duree_min_s int, p_fenetre_s int, p_cle_tour text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  ep      public.episode_detresse;
  v_tours int;
begin
  select * into ep
    from public.episode_detresse
   where utilisatrice_id = cible and fin is null
   for update;

  if p_niveau >= 1 then
    -- ESCALADE : JAMAIS court-circuitée (la protection ne peut que monter, AD-15). Estampille la clé
    -- pour qu'un tour sûr du MÊME tour logique (retry mixte 0→…) ne re-compte pas ensuite.
    if not found then
      insert into public.episode_detresse
        (utilisatrice_id, niveau_max, tours_surs_consecutifs, dernier_niveau_eleve_le, dernier_tour_compte)
      values (cible, p_niveau, 0, now(), p_cle_tour)
      on conflict (utilisatrice_id) where (fin is null)
      do update set niveau_max = greatest(public.episode_detresse.niveau_max, excluded.niveau_max),
                    tours_surs_consecutifs = 0,
                    dernier_niveau_eleve_le = now(),
                    dernier_tour_compte = excluded.dernier_tour_compte;
      return true;
    end if;
    update public.episode_detresse
       set niveau_max = greatest(niveau_max, p_niveau),
           tours_surs_consecutifs = 0,
           dernier_niveau_eleve_le = now(),
           dernier_tour_compte = p_cle_tour
     where id = ep.id;
    return true;
  end if;

  -- p_niveau = 0
  if not found then
    return false;  -- aucun épisode ouvert : rien à compter (inhérremment idempotent)
  end if;

  -- IDEMPOTENCE (AC1/AC2) : ce tour sûr a-t-il déjà été compté ? Court-circuit → pas de ré-incrément.
  if ep.dernier_tour_compte is not null and ep.dernier_tour_compte = p_cle_tour then
    return ep.fin is null;  -- même réponse qu'au 1ᵉʳ appel (ici : encore ouvert)
  end if;

  v_tours := ep.tours_surs_consecutifs + 1;
  if v_tours >= p_seuil_tours
     and now() - ep.dernier_niveau_eleve_le >= make_interval(secs => p_duree_min_s) then
    update public.episode_detresse
       set fin = now(),
           fenetre_expire_at = now() + make_interval(secs => p_fenetre_s),
           tours_surs_consecutifs = v_tours,
           dernier_tour_compte = p_cle_tour
     where id = ep.id;
    return false;  -- limites RETOMBÉES (extinction légitime)
  end if;

  update public.episode_detresse
     set tours_surs_consecutifs = v_tours,
         dernier_tour_compte = p_cle_tour
   where id = ep.id;
  return true;
end;
$$;

revoke all on function public.enregistrer_tour_detresse(uuid, int, int, int, int, text)
  from public, anon, authenticated;
grant execute on function public.enregistrer_tour_detresse(uuid, int, int, int, int, text)
  to service_role;
```

### Invariants durs (à ne pas violer)

- **AD-16 / AD-17** — l'épisode ne s'éteint qu'aux conditions réelles (seuil de tours sûrs
  **distincts** + délai). Un retry ne rapproche jamais l'extinction. La détection reste au fort (AD-5),
  le pipeline sécurité-d'abord inchangé.
- **AD-15** — le doute protège : (1) le repli RPC (`rpcAvecRepli`) → `limites_levees = true` inchangé ;
  (2) l'escalade (niveau ≥ 1) n'est **jamais** court-circuitée.
- **AD-14 / SPINE Opérations** — migration **forward-only** : `0017` ajoute par-dessus (`ALTER` +
  `DROP`/`CREATE FUNCTION`), ne réécrit jamais `0010`/`0011`. Les seuils restent **passés en arguments**
  (jamais figés dans le SQL).
- **AD-12 / art. 9** — RPC `security definer` **service_role only** ; `p_cle_tour` est un UUID opaque,
  **aucune colonne de contenu** ajoutée (posture « `episode_detresse` sans art. 9 » préservée).

### Testing standards

- Vitest (env node) ; **Supabase local requis** ; `set -a && . ./.env.local && set +a && npx vitest run`.
  CLI Supabase **globale** v2.67.1, **jamais** `npx supabase`. Appliquer `0017` via `supabase db reset`
  (rejoue depuis les fichiers). Gotcha connu : si le seed Realtime échoue → `supabase stop --no-backup
  && supabase start`.
- Le harnais `episode-detresse.test.ts` sème/nettoie via `admin` (service_role) et prouve la RLS via
  session `publishable`. Le helper `tour(...)` gagne un `p_cle_tour` (défaut UUID frais → sémantique
  2.4 préservée) ; les nouveaux tests passent une **clé explicite partagée** pour prouver l'idempotence.

### Project Structure Notes

- **NOUVEAU** : `supabase/migrations/0017_episode_detresse_idempotence.sql`.
- **MODIFIÉ** : `lib/safety/depot-episode.ts` (signature + `p_cle_tour`), `app/api/anam/message/route.ts`
  (1 argument), `tests/episode-detresse.test.ts` (helper + tests idempotence), `tests/depot-episode.test.ts`
  (assertion `p_cle_tour`).
- Zéro changement client. Conventions : `snake_case`, forward-only, seuils en arguments.

### References

- [Source: ARCHITECTURE-SPINE.md#AD-16] (pipeline sécurité-d'abord) ; #AD-17 (transition d'extinction
  unique et possédée) ; #AD-15 (le doute protège) ; #AD-14 (forward-only, effacement) ; #AD-12 (RLS/
  service_role) ; #AD-1/#AD-10 (couches descendantes, idempotence = préoccupation data).
- [Source: prd.md §5] (détresse, extinction) ; #FR-042/#FR-043 (limites levées) ; #NFR-012 (détection au
  fort) ; #NFR-022 (pas d'art. 9 en log).
- Code : `supabase/migrations/0010_episode_detresse.sql`, `0011_episode_detresse_corrections.sql` (RPC
  possédée, patron du court-circuit `FOR UPDATE`) ; `lib/safety/depot-episode.ts`, `lib/safety/pipeline.ts`
  (câblage) ; `app/api/anam/message/route.ts:83-110` (jeton + pipeline) ; `tests/episode-detresse.test.ts`
  (harnais) ; `deferred-work.md` §« Story 4.1 » F4 (l'énoncé de la dette).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (1M context) — dev-story TDD red-green.

### Debug Log References

- **RED** : helper `tour(...)` étendu de 6 args (`p_cle_tour`) → les 15 tests DB `tour()`-dépendants virent au rouge (RPC 5-args introuvable) ; câblage `depot-episode.test.ts` rouge (`p_cle_tour` absent de l'appel). Confirme la RED des deux côtés.
- **GREEN** : `supabase db reset` a échoué sur le seed Realtime (flaky, connu) → récupération `stop --no-backup && start`. Colonne `dernier_tour_compte` + signature 6-args vérifiées via `docker exec psql` (5-args droppée, aucun overload orphelin). 30 tests ciblés verts.
- **Mutation-vérif (avant revue)** : MUT1 (retrait du court-circuit) → **AC1/AC2 rouges**, AC3/AC4 verts ; MUT2 (court-circuit **symétrique** — le bug du croquis) → **AC3 rouge** seul ; restauration → 4/4 verts. Prouve que chaque garde mord précisément la bonne propriété.
- **Mutation-vérif (garde de revue F1)** : régression route l.109 → `crypto.randomUUID()` → la garde de source 2-4b vire au rouge ; restaurée.

### Completion Notes List

- **Idempotence ASYMÉTRIQUE livrée** : `enregistrer_tour_detresse` court-circuite le SEUL chemin « tour sûr » (niveau 0) quand `dernier_tour_compte = p_cle_tour` ; l'escalade (niveau ≥ 1) n'est JAMAIS court-circuitée (la protection ne peut que monter, AD-15). Un « Réessayer » ne rapproche plus jamais l'extinction (AD-16/AD-17).
- **Une seule colonne `dernier_tour_compte`** (le retry ne vise que le tour courant ; `FOR UPDATE` = check-and-set atomique). Résidu documenté honnêtement (revue F4) : un doublon HORS-ORDRE d'un tour non-courant au bord = UNE extinction prématurée, auto-cicatrisée au tour détresse suivant, JAMAIS cascadante (post-extinction, tout rejeu est inerte).
- **Clé baquée à la construction du dépôt** (`creerDepotEpisode(user.id, cleIdempotence)`) — interface `DepotEpisode` du pipeline inchangée, placeholder inchangé, zéro changement client (le jeton 3.4 coule déjà).
- **Migration forward-only** `0017` (ALTER + DROP/CREATE FUNCTION) ; seuils toujours en arguments ; art. 9-safe (UUID opaque, aucune colonne de contenu) ; `security definer` service_role only.
- Validation : **997 tests** verts (+7 : 4 idempotence DB + 1 rejeu-extinction + 2 gardes de source), `tsc`/`eslint`/`next build` propres.

### File List

- **NOUVEAU** `supabase/migrations/0017_episode_detresse_idempotence.sql`
- **MODIFIÉ** `lib/safety/depot-episode.ts` (`creerDepotEpisode(id, cleTour)` → `p_cle_tour`)
- **MODIFIÉ** `app/api/anam/message/route.ts` (`creerDepotEpisode(user.id, cleIdempotence)` ; commentaire du repli dégradé nommant aussi la conséquence épisode, revue F2)
- **MODIFIÉ** `tests/episode-detresse.test.ts` (helper `p_cle_tour` + 5 tests idempotence, dont rejeu-extinction F3)
- **MODIFIÉ** `tests/depot-episode.test.ts` (assertion `p_cle_tour`)
- **MODIFIÉ** `tests/pipeline-securite-architecture.test.ts` (2 gardes de source 2-4b : route→dépôt clé partagée F1, dépôt→RPC `p_cle_tour`)

## Revue adversariale (AI) — 2-4b

Workflow 5 angles safety (finders + vérificateurs Opus 4.8, biais réfutation) — 19 agents. **AUCUN bug de correctness dans la logique SQL** : le design asymétrique a tenu sous les 5 angles. **4 trouvailles retenues** (test-coverage + honnêteté doc), **2 corrigées, 2 durcissements doc** :

**Corrigées :**
- **F1 (CONFIRMED, MOY)** — la JOINTURE centrale de la story (route passe `cleIdempotence` à `creerDepotEpisode`) n'était verrouillée par AUCUN test → une régression en `randomUUID()`/clé dérivée aurait réintroduit F4 avec la suite verte. **Garde de source ajoutée** (patron `journal-route`/`gate-quota`) **+ mutation-vérifiée** (rouge sur la régression). Garde complémentaire dépôt→RPC (`p_cle_tour`).
- **F3 (BASSE, couverture)** — le rejeu du tour d'EXTINCTION lui-même n'était pas testé (idempotence par `fin IS NULL`, pas par la clé). **Test ajouté** (rejeu → `false` cohérent, pas de résurrection, pas de re-comptage).

**Durcissements doc (aucun bug, honnêteté) :**
- **F2 (BASSE)** — l'invariant tient *si le client réutilise son jeton stable* ; le chemin dégradé sans jeton reste non-idempotent (résidu SYSTÉMIQUE partagé métrage/journal/épisode). Le commentaire du repli (`route.ts`) nomme désormais aussi la conséquence épisode (re-comptage), pas seulement le doublon journal.
- **F4 (BASSE)** — commentaire migration resserré : le résidu hors-ordre au bord = **UNE extinction prématurée** (pas « juste un incrément »), auto-cicatrisée, **jamais cascadante** (post-extinction tout rejeu est inerte). Le vérificateur a **réfuté** l'escalade « file PWA non bornée » (aucune file de replay n'existe ; déclencheur non atteignable via le flux réel sérialisé).

**Résidus acceptés (documentés) :** keying mono-colonne (un doublon hors-ordre d'un tour non-courant, borné/auto-cicatrisant) ; idempotence dépendante du jeton client (chemin dégradé sans jeton = résidu systémique partagé, mesurable via `console.warn`).

## Change Log

| Date | Version | Description | Auteur |
|---|---|---|---|
| 2026-07-30 | 0.1 | Création de la story de remédiation (dette F4 de 4.1, racine 2.4). Conception figée : idempotence **asymétrique** de `enregistrer_tour_detresse` par `p_cle_tour` (colonne `dernier_tour_compte`), court-circuit du seul chemin « tour sûr » (niveau 0), escalade (niveau ≥ 1) jamais supprimée. Correction du croquis initial de la dette (l'idempotence symétrique aurait supprimé des escalades — bug AD-15). | Dev (Opus 4.8) |
| 2026-07-30 | 1.0 | Implémentation TDD (baseline `af777f8`). Migration `0017` + câblage dépôt/route. Mutation-vérif MUT1/MUT2 (chaque garde mord la bonne propriété). 994 tests verts, tsc/eslint/build propres. Statut → review. | Dev-Story (Opus 4.8) |
| 2026-07-30 | 1.1 | Revue adversariale (5 angles, 19 agents, 0 bug de correctness). F1 corrigée (garde de source mutation-vérifiée) + F3 (test rejeu-extinction) ; F2/F4 durcissements doc. 997 tests verts, tsc/eslint/build propres. | Revue + corrections (Opus 4.8) |
