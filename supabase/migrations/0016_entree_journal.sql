-- Story 4.1 — le JOURNAL BRUT (`entree_journal`), couche 1 de la mémoire (AD-8).
--
-- VERBATIM des tours de conversation, art. 9, POSSÉDÉ par l'utilisatrice sous JWT (jamais service_role
-- applicatif, AD-12) et IMMUABLE. C'est la PREMIÈRE table de CONTENU art. 9 du produit : elle COPIE le
-- write-gate de `art9_temoin` (0005 — a_consenti_art9() en `with check`) mais DÉVIE pour être append-only.
--
-- Variance vs `art9_temoin` (qui est `for all`, donc mutable) — le journal est « inaltérable » :
--   1. DEUX policies séparées (select propriétaire + insert propriétaire+consentement) — AUCUNE
--      update/delete → refus deny-by-default sous JWT (AC2). L'effacement FR-067 passe par service_role
--      (moteur de rétention, Epic 6), jamais par le chemin de conversation.
--   2. Trigger `before update` qui LÈVE → immuabilité DURE, y compris service_role (que la RLS ne borne
--      pas : bypassrls). L'effacement supprime des LIGNES (delete), jamais un update → non affecté.
--   3. Colonne `role` ('utilisatrice'|'anam') posée dès maintenant (4.1 n'écrit que 'utilisatrice') :
--      « Voir dans la conversation » (4.6) et la lecture « échange source » (Epic 5) auront besoin des
--      tours d'Anam — l'inclure évite une migration de la contrainte d'unicité `(…, role)` après coup.
--
-- Idempotence par TOUR LOGIQUE : `cle_tour` = le jeton de tour client (Story 3.4), réutilisé au
-- « Réessayer »/à la reconnexion → l'index unique `(utilisatrice_id, cle_tour, role)` garantit UNE
-- entrée par côté et par tour (NFR-017 « aucune entrée perdue », sans doublon).

create table public.entree_journal (
  id              uuid        primary key default gen_random_uuid(),
  utilisatrice_id uuid        not null references public.utilisatrice(id) on delete cascade,
  role            text        not null default 'utilisatrice' check (role in ('utilisatrice', 'anam')),
  contenu         text        not null,               -- VERBATIM, mot pour mot (AC1) — aucune transformation
  cle_tour        text        not null,               -- idempotence par tour LOGIQUE (jeton client, Story 3.4)
  cree_le         timestamptz not null default now()  -- ISO 8601 UTC
);

-- Un tour LOGIQUE (jeton) = UNE entrée par rôle. La réémission (retry/reconnexion) retombe dessus.
create unique index entree_journal_tour_unique
  on public.entree_journal (utilisatrice_id, cle_tour, role);
-- Lecture ordonnée du journal d'une utilisatrice (export, rappel — Epic 4/5).
create index entree_journal_utilisatrice_idx
  on public.entree_journal (utilisatrice_id, cree_le);

alter table public.entree_journal enable row level security;
alter table public.entree_journal force  row level security;

-- Lecture propriétaire : `using` ouvert au propriétaire → export FR-067 + SURVIT à la révocation.
create policy entree_journal_lecture on public.entree_journal
  for select
  using (auth.uid() = utilisatrice_id);

-- Insertion write-gatée — COPIE FIDÈLE du gabarit courant `art9_temoin` (0005 + durcissement 0006) :
-- propriétaire ET consentement art. 9 valide/non révoqué (AD-13, `a_consenti_art9()`) ET compte NON
-- barré-minorité (`not est_barre_minorite()`, 0006 : « plus aucune écriture sous barrière »). En plus,
-- `role = 'utilisatrice'` ÉPINGLE le seul côté qu'un client puisse légitimement écrire : le côté `anam`
-- est server-authoritative (une future story l'écrira via une RPC attestée-serveur, jamais sous JWT
-- direct — sinon une utilisatrice forgerait de fausses paroles d'Anam, immuables). AUCUNE policy
-- update/delete → append-only sous JWT (AC2).
create policy entree_journal_insertion on public.entree_journal
  for insert
  with check (auth.uid() = utilisatrice_id
              and public.a_consenti_art9()
              and not public.est_barre_minorite()
              and role = 'utilisatrice');

-- Immuabilité DURE (AD-8, « inaltérable ») : refuse TOUT update, même service_role (hors RLS).
-- L'effacement (FR-067) supprime des lignes (delete) → jamais concerné par ce garde-fou.
create or replace function public.entree_journal_refuse_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'entree_journal est append-only : le verbatim est immuable (AD-8, Story 4.1)';
end;
$$;

-- Durcissement EXECUTE (convention 0007) : fonction-trigger, jamais appelée à la main ni exposée en
-- RPC → on retire le grant automatique Supabase à TOUS les rôles clients (aucun impact fonctionnel :
-- le trigger s'exécute indépendamment du privilège execute de l'appelant).
revoke execute on function public.entree_journal_refuse_update() from public, anon, authenticated;

create trigger entree_journal_no_update
  before update on public.entree_journal
  for each row execute function public.entree_journal_refuse_update();

comment on table public.entree_journal is
  'Journal brut (AD-8, couche 1) : VERBATIM des tours de conversation, art. 9, immuable. RLS propriétaire sous JWT (jamais service_role applicatif) + write-gate consentement (a_consenti_art9, 0005). Append-only : ni update (trigger) ni delete courant (aucune policy) ; seul l''effacement FR-067 (service_role, moteur de rétention, Epic 6) retire des lignes. `id` = extrait_source stable (branche/fait/lecture, Epic 4/5). Idempotence par (utilisatrice_id, cle_tour, role) — jeton de tour 3.4.';
