-- Migration forward-only — Story 3.1 : l'ossature d'abonnement (convention « Événements externes », AD-2/AD-12).
--
-- Deux tables + une RPC écrivain-unique posent la plomberie de l'abonnement premium :
--
--   • `abonnement` : PROJECTION à écrivain unique de l'état Stripe (actif|resilie|expire). L'utilisatrice
--     LIT sa ligne (policy SELECT propriétaire — l'entitlement premium en dérive : etat='actif') mais ne
--     l'écrit JAMAIS (aucune policy d'écriture) : l'état est une DÉCISION dérivée des webhooks Stripe, pas
--     un droit que la cliente déclare. Une-ligne-par-utilisatrice (unique) — patron `seance`/0012.
--     NON-art. 9 : paiement/abonnement absent du champ art. 9 (AD-4) → écrit par service_role (tâche
--     système légitime, AD-12), aucune colonne de contenu de conversation.
--
--   • `evenements_traites` : registre système de DÉDUP des événements Stripe. Deny-by-default intégral
--     (patron `usage_ia`/0008) : invisible et non-inscriptible sous une session utilisatrice. L'unicité
--     porte sur `provider_event_id` (l'`event.id` Stripe) — GLOBALE (contrairement à usage_ia borné par
--     utilisatrice) car l'id d'événement est globalement unique par nature ET non fourni par le client.
--
-- IDEMPOTENCE + ÉCRIVAIN UNIQUE en UNE transaction (`traiter_evenement_abonnement`) : Stripe livre
--   at-least-once et sans ordre garanti. La RPC (1) dédoublonne par event.id (aucun second effet au
--   rejeu), (2) verrouille la ligne (sérialise deux events concurrents), (3) NE RÉGRESSE JAMAIS sur un
--   event plus ancien (garde `source_maj_le`), (4) projette l'état. L'`etat` est DÉRIVÉ côté domaine PUR
--   (`lib/domain/abonnement`) avant l'appel ; le CHECK est le garde-fou final. Patron atomique de
--   `enregistrer_tour_detresse`/0010 (for update + on conflict do nothing).

-- ── Table `abonnement` : projection écrivain-unique, lecture propriétaire ──────────────────────────
create table public.abonnement (
  id                     uuid        primary key default gen_random_uuid(),
  utilisatrice_id        uuid        not null unique references public.utilisatrice(id) on delete cascade,
  etat                   text        not null,
  stripe_customer_id     text,
  stripe_subscription_id text,
  periode_fin            timestamptz,                        -- fin de la période payée (items.data[0].current_period_end)
  source_maj_le          timestamptz not null,               -- horodatage de l'event Stripe appliqué (anti-régression d'ordre)
  cree_le                timestamptz not null default now(),
  mis_a_jour_le          timestamptz not null default now(),
  constraint abonnement_etat_valide check (etat in ('actif', 'resilie', 'expire'))
);

create index abonnement_utilisatrice_idx on public.abonnement (utilisatrice_id);

alter table public.abonnement enable row level security;
alter table public.abonnement force  row level security;

-- Lecture propriétaire seule : l'utilisatrice lit SON abonnement (l'entitlement en dérive). AUCUNE
-- policy INSERT/UPDATE/DELETE → l'écriture passe exclusivement par la RPC security definer ci-dessous.
create policy abonnement_proprietaire_lecture on public.abonnement
  for select
  using (auth.uid() = utilisatrice_id);

comment on table public.abonnement is
  'Story 3.1 : projection écrivain-unique de l''état d''abonnement Stripe (actif|resilie|expire). Lecture propriétaire (l''entitlement premium dérive de etat=actif) ; écriture réservée à traiter_evenement_abonnement (service_role). NON-art. 9. AD-2/AD-12, convention Événements externes.';

-- ── Table `evenements_traites` : dédup système des webhooks Stripe (deny-by-default) ───────────────
create table public.evenements_traites (
  id                uuid        primary key default gen_random_uuid(),
  provider_event_id text        not null unique,   -- event.id Stripe : idempotence globale
  type              text        not null,          -- type d'événement (observabilité), jamais de contenu art. 9
  traite_le         timestamptz not null default now()
);

alter table public.evenements_traites enable row level security;
alter table public.evenements_traites force  row level security;
-- Aucune policy créée volontairement : deny-by-default (registre système, patron usage_ia/0008).

comment on table public.evenements_traites is
  'Story 3.1 : registre de dédup des événements Stripe (idempotence par provider_event_id, convention Événements externes). Deny-by-default : écrit uniquement via traiter_evenement_abonnement (service_role). Aucune donnée art. 9.';

-- ── RPC écrivain-unique : dédup idempotente + projection anti-régression, en UNE transaction ───────
create or replace function public.traiter_evenement_abonnement(
  cible uuid,
  p_provider_event_id text,
  p_type text,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_etat text,
  p_periode_fin timestamptz,
  p_source_maj_le timestamptz
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_insere int;
  ab       public.abonnement;
begin
  -- 1) Dédup idempotente par event.id : un rejeu Stripe ne produit AUCUN second effet.
  insert into public.evenements_traites (provider_event_id, type)
  values (p_provider_event_id, p_type)
  on conflict (provider_event_id) do nothing;
  get diagnostics v_insere = row_count;
  if v_insere = 0 then
    return 'deja_traite';
  end if;

  -- 2) Verrou de ligne : sérialise deux events concurrents du même compte.
  select * into ab from public.abonnement where utilisatrice_id = cible for update;

  -- 3) Anti-régression : un event PLUS ANCIEN ne régresse jamais l'état (Stripe n'ordonne pas).
  if found and ab.source_maj_le > p_source_maj_le then
    return 'ignore_obsolete';
  end if;

  -- 4) Projection écrivain-unique (upsert une-ligne-par-utilisatrice). L'état est déjà dérivé côté
  --    domaine pur ; le CHECK abonnement_etat_valide est le garde-fou final. Les ids Stripe sont
  --    conservés si l'event courant ne les porte pas (coalesce).
  insert into public.abonnement (
    utilisatrice_id, etat, stripe_customer_id, stripe_subscription_id, periode_fin, source_maj_le, mis_a_jour_le
  ) values (
    cible, p_etat, p_stripe_customer_id, p_stripe_subscription_id, p_periode_fin, p_source_maj_le, now()
  )
  on conflict (utilisatrice_id) do update set
    etat                   = excluded.etat,
    stripe_customer_id     = coalesce(excluded.stripe_customer_id, public.abonnement.stripe_customer_id),
    stripe_subscription_id = coalesce(excluded.stripe_subscription_id, public.abonnement.stripe_subscription_id),
    periode_fin            = excluded.periode_fin,
    source_maj_le          = excluded.source_maj_le,
    mis_a_jour_le          = now();

  return 'traite';
end;
$$;

revoke all on function public.traiter_evenement_abonnement(uuid, text, text, text, text, text, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.traiter_evenement_abonnement(uuid, text, text, text, text, text, timestamptz, timestamptz)
  to service_role;
