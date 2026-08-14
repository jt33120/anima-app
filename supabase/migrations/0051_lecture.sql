-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 0051 — LA LECTURE : un tirage, une projection, une restitution (Story 5.8)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
--
-- ── CE QUE CETTE TABLE FERME ──────────────────────────────────────────────────────────────────
--
-- 0050 laissait un trou nommé, en toutes lettres : « RIEN N'EMPÊCHE AUJOURD'HUI DE TIRER DIX FOIS DE
-- SUITE ». Le diagnostic y était déjà : tant que le tirage n'est rattaché à rien, il n'existe aucune
-- clé sur laquelle poser l'unicité. `lecture` est cette clé, et le trou se ferme ici — par un INDEX,
-- pas par un `if`.
--
--     create unique index lecture_une_seule_en_attente
--       on public.lecture (utilisatrice_id) where reponse is null;
--
-- Au plus UNE lecture en attente de réponse. Rappeler le point d'entrée du rituel — par l'interface,
-- par un rechargement, par un appel direct répété — ne peut plus produire une seconde carte : la base
-- refuse, l'applicatif relit la lecture ouverte et rend LA MÊME carte. C'est aussi ce qui tient
-- l'exigence UX de l'échec de flux : « la carte n'est pas retirée et n'est JAMAIS retirée ».
--
-- ⚠️ Un `select` applicatif « a-t-elle déjà une lecture ouverte ? » suivi d'un `insert` NE TIENT PAS :
-- ce n'est pas atomique, et c'est exactement la fenêtre que deux onglets ouverts exploitent. L'index
-- est la garde ; le code doit traiter le `23505` en RELISANT, jamais en retirant.
--
-- ── ET `tirage_id` EST UNIQUE, PAR L'AUTRE BOUT ───────────────────────────────────────────────
--
-- Un tirage sert au plus une lecture. Sans cette contrainte, on pourrait tirer dix fois, choisir la
-- carte qui plaît, et n'ouvrir la lecture que sur celle-là — le re-tirage reviendrait par la porte de
-- derrière. Les deux unicités se complètent et aucune ne suffit seule.
--
-- ── LA RESTITUTION S'ÉCRIT UNE FOIS ───────────────────────────────────────────────────────────
--
-- `tirage` n'a aucune policy d'UPDATE (journal d'audit). `lecture`, elle, en a besoin : la réponse et
-- la restitution s'écrivent APRÈS l'insert, quand elles existent. La policy la borne des deux côtés :
--
--     using      (reponse is null)                          -- seule une lecture EN ATTENTE est modifiable
--     with check (reponse is not null and restitution is not null)  -- et l'écriture la CLÔT
--
-- Une lecture répondue est close pour toujours. Un rituel qu'on peut réécrire n'est plus un rituel :
-- la restitution reprend SES mots, et des mots qu'on peut corriger après coup ne sont plus les siens.
--
-- ── CE QUE `with check` NE PEUT PAS FAIRE, ET QUI VIT DONC DANS UN TRIGGER ────────────────────
--
-- Une policy d'UPDATE ne voit pas OLD : elle ne peut pas dire « `tirage_id` ne change pas ». Sans
-- garde, une utilisatrice pourrait clore sa lecture en la repointant sur un AUTRE de ses tirages —
-- c'est-à-dire choisir sa carte après avoir vu les deux. Le trigger `lecture_colonnes_figees` le
-- refuse. Une garde qui vit dans un commentaire n'existe pas ; celle-ci vit dans un trigger.
--
-- ── TOUTES LES GARDES DANS LA POLICY (0041→0048, la leçon payée six fois) ─────────────────────
--
-- `authenticated` détient les sept privilèges DML sur chaque table de `public`. Une garde écrite dans
-- une RPC, une route ou une Server Action est contournée par un `.insert()` direct depuis le client.
-- Les quatre gardes du dépôt sont donc dans le `with check`, à l'identique de 0050 — plus une
-- cinquième, propre à cette table : le tirage rattaché doit être LE SIEN.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1. LA TABLE ───────────────────────────────────────────────────────────────────────────────

create table public.lecture (
  id              uuid        primary key default gen_random_uuid(),
  utilisatrice_id uuid        not null references public.utilisatrice(id) on delete cascade,
  -- UNIQUE : un tirage sert au plus une lecture (voir l'en-tête). `on delete cascade` : effacer le
  -- journal de tirage (FR-067) emporte la lecture — l'inverse laisserait une lecture sans sa carte.
  tirage_id       uuid        not null unique references public.tirage(id) on delete cascade,
  -- SES MOTS, verbatim. `null` tant qu'elle n'a pas répondu — et c'est ce `null` qui porte l'unicité
  -- partielle : il ne signifie pas « vide », il signifie « le rituel est ouvert ».
  reponse         text,
  -- La prose d'Anam, registre document (FR-021). Jamais sans `reponse` (contrainte plus bas).
  restitution     text,
  -- Le lien vers l'échange source (FR-021). C'est la clé de tour du pipeline `message`, la même qui
  -- sert au journal brut (4.1) et au métrage — donc un point d'ancrage qui existe déjà.
  cle_tour_source text,
  ouverte_a       timestamptz not null default now(),
  close_a         timestamptz,

  -- Une restitution sans les mots d'où elle part est un défaut FR-021, pas un état atteignable.
  constraint lecture_restitution_apres_reponse
    check (restitution is null or reponse is not null),
  -- `close_a` et `reponse` vont ensemble, dans les deux sens : une lecture close sans réponse, ou une
  -- réponse sans date de clôture, sont deux façons de rendre « Mes lectures » incohérente.
  constraint lecture_cloture_coherente
    check ((reponse is null) = (close_a is null)),
  -- Des mots vides ne sont pas des mots. Sans ce garde-fou, `reponse = ''` clôt la lecture, libère
  -- l'index partiel, et autorise un nouveau tirage : la chaîne complète du re-tirage, par une chaîne vide.
  constraint lecture_reponse_non_vide
    check (reponse is null or length(btrim(reponse)) > 0),
  constraint lecture_restitution_non_vide
    check (restitution is null or length(btrim(restitution)) > 0)
);

alter table public.lecture enable row level security;
alter table public.lecture force  row level security;

-- ⚠️ LA GARDE CENTRALE DE LA STORY. Au plus une lecture en attente de réponse par utilisatrice.
create unique index lecture_une_seule_en_attente
  on public.lecture (utilisatrice_id)
  where reponse is null;

-- « Mes lectures » liste du plus récent au plus ancien.
create index lecture_par_personne on public.lecture (utilisatrice_id, ouverte_a desc);

comment on table public.lecture is
  'Story 5.8 — le rituel de lecture (FR-017→FR-021). L''index partiel `lecture_une_seule_en_attente` est la garde qui ferme le re-tirage laissé ouvert par 0050 : au plus une lecture en attente de réponse, et le tirage rattaché est unique.';

-- ── 2. LES HORODATAGES SONT POSÉS PAR LA BASE (doctrine 0046) ─────────────────────────────────
--
-- `ouverte_a` à l'insert, `close_a` au moment où `reponse` devient non nulle. Les laisser à
-- l'écrivain, c'est laisser dater une lecture d'hier — et « Mes lectures » est un document qu'elle
-- relira dans un an.

create function public.lecture_horodatage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- `service_role` (réimport FR-067) conserve les horodatages d'origine : même condition qu'en 0046.
  if (select auth.uid()) is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.ouverte_a := now();
    new.close_a   := case when new.reponse is null then null else now() end;
  else
    new.ouverte_a := old.ouverte_a;
    new.close_a   := case when new.reponse is null then null else now() end;
  end if;
  return new;
end;
$$;

create trigger lecture_horodatage
before insert or update on public.lecture
for each row execute function public.lecture_horodatage();

comment on function public.lecture_horodatage() is
  'Story 5.8 — `ouverte_a`/`close_a` posés par la BASE. Une lecture est un document daté qu''elle relira : l''heure ne se choisit pas.';

-- ── 3. CE QUE LA POLICY NE PEUT PAS GARDER : LES COLONNES FIGÉES ──────────────────────────────
--
-- `with check` ne voit pas OLD. Sans ce trigger, l'UPDATE de clôture pourrait repointer `tirage_id`
-- sur un autre tirage de la même personne — c'est-à-dire tirer deux fois, regarder, puis choisir.
-- La policy autorise l'UPDATE ; le trigger décide de CE QUI peut y changer.

create function public.lecture_colonnes_figees()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new; -- `service_role` : réimport FR-067, hors périmètre de cette garde
  end if;
  if new.utilisatrice_id is distinct from old.utilisatrice_id then
    raise exception 'lecture : la propriétaire ne change pas' using errcode = '42501';
  end if;
  if new.tirage_id is distinct from old.tirage_id then
    raise exception 'lecture : la carte ne change pas' using errcode = '42501';
  end if;
  -- Les mots d'elle ne se réécrivent pas non plus une fois posés — redondant avec `using
  -- (reponse is null)` de la policy, et VOULU : c'est la seule garde qui survivrait si la policy
  -- était un jour élargie « pour corriger une coquille ».
  if old.reponse is not null and new.reponse is distinct from old.reponse then
    raise exception 'lecture : ses mots ne se réécrivent pas' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger lecture_colonnes_figees
before update on public.lecture
for each row execute function public.lecture_colonnes_figees();

comment on function public.lecture_colonnes_figees() is
  'Story 5.8 — `with check` ne voit pas OLD : sans ce trigger, la clôture pourrait repointer `tirage_id` et transformer le rituel en choix de carte après coup.';

-- ── 4. LES POLICIES ───────────────────────────────────────────────────────────────────────────

-- LECTURE : propriétaire, et rien d'autre. Ni consentement, ni premium, ni détresse — l'export
-- FR-067 en dépend, et un socle qui séquestre ce qu'il a déjà écrit n'est pas un socle (doctrine
-- 0049/0050). Une femme dont le consentement est révoqué doit pouvoir relire et emporter ses lectures.
create policy lecture_lecture on public.lecture
  for select using (auth.uid() = utilisatrice_id);

-- DÉPÔT : les quatre gardes de 0050, plus la cinquième propre à cette table.
--
-- Le `exists` sur `tirage` s'exécute sous la RLS de l'appelante (`tirage_lecture` : propriétaire) —
-- il ne peut donc voir que SES tirages. Sans lui, `tirage_id` accepterait l'identifiant d'un tirage
-- d'autrui : la ligne serait bien à elle, mais la carte viendrait de quelqu'un d'autre.
create policy lecture_depot on public.lecture
  for insert
  with check (auth.uid() = utilisatrice_id
              and public.a_consenti_art9()
              and not public.est_barre_minorite()
              and not public.branche_bloquee_par_detresse()
              -- ⚠️ LA LECTURE EST PREMIUM (FR-088), ET LA GARDE VIT ICI, PAS DANS LA ROUTE.
              --
              -- La route arbitre déjà l'accès et choisit les MOTS du refus (`acces-lecture.ts`) —
              -- mais un arbitrage applicatif ne garde rien : `authenticated` détient le grant INSERT
              -- table-level, donc un `.insert()` direct depuis le client ouvrirait une lecture sans
              -- jamais croiser la route. C'est le raisonnement littéral de 0037 : « une garde premium
              -- posée uniquement dans la RPC serait décorative ».
              --
              -- L'ORDRE DANS LE `and` N'A AUCUNE IMPORTANCE ICI (Postgres n'en garantit pas
              -- l'évaluation, et le verdict est le même). L'ordre qui compte — détresse AVANT
              -- commerce, AD-9 — vit dans `accesLecture()`, où il décide de ce qu'elle LIT. La base
              -- refuse ; la route explique. Les deux sont testées séparément.
              and public.est_premium_courante()
              and exists (select 1 from public.tirage t
                          where t.id = tirage_id and t.utilisatrice_id = auth.uid()));

-- CLÔTURE : le seul UPDATE autorisé, et il ne peut que CLORE.
--
--   using      → seule une lecture EN ATTENTE est modifiable ;
--   with check → l'écriture doit poser SES mots ET la restitution — pas l'un sans l'autre.
--
-- Aucune garde de détresse ici, et c'est délibéré : une lecture OUVERTE avant l'épisode doit pouvoir
-- se clore. La bloquer laisserait une carte déposée, une question posée, et aucune façon d'y répondre
-- — l'index partiel resterait occupé, et le rituel serait gelé pendant 72 h. Le dépôt est gardé ;
-- la sortie ne se garde pas.
create policy lecture_cloture on public.lecture
  for update
  using       (auth.uid() = utilisatrice_id and reponse is null)
  with check  (auth.uid() = utilisatrice_id and reponse is not null and restitution is not null);

-- RETRAIT : propriétaire seulement (FR-067), sans condition — c'est le geste de celle qui vient de
-- révoquer son consentement.
create policy lecture_retrait on public.lecture
  for delete using (auth.uid() = utilisatrice_id);

-- ── 5. LES CAUSES DU REFUS, EN UNE PASSE ──────────────────────────────────────────────────────
--
-- 0050 laissait la 5.8 devant un `42501` indistinct des quatre gardes, et le résidu le disait : « la
-- 5.8 doit le dire avec des mots, pas avec une erreur ». On ne décode donc pas l'erreur — on
-- interroge les prédicats AVANT de tirer.
--
-- Une seule RPC pour les trois prédicats SQL (le premium se lit ailleurs, sous JWT, source unique
-- 3.1) : trois allers-retours pour ouvrir un rituel seraient trois latences ajoutées à un moment qui
-- doit être calme.
--
-- ⚠️ CETTE FONCTION NE GARDE RIEN. Elle RAPPORTE. Les gardes vivent dans les policies ci-dessus et
-- continueraient de refuser si un appelant sautait cette lecture. C'est ce qui la rend inoffensive :
-- on peut la mentir sans rien obtenir.

create function public.causes_refus_lecture()
returns table (consentement_donne boolean, barre_minorite boolean, detresse_active boolean)
language sql
security invoker
stable
set search_path = ''
as $$
  select public.a_consenti_art9(),
         public.est_barre_minorite(),
         public.branche_bloquee_par_detresse();
$$;

revoke all     on function public.causes_refus_lecture() from public;
grant  execute on function public.causes_refus_lecture() to authenticated;

comment on function public.causes_refus_lecture() is
  'Story 5.8 — RAPPORTE les trois prédicats SQL du refus de lecture en une passe, pour que l''applicatif le dise avec des mots plutôt qu''avec un 42501 indistinct. Ne garde rien : les gardes sont dans les policies de `lecture` et `tirage`.';
