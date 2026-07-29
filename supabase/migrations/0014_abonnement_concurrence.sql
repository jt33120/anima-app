-- Migration forward-only — Story 3.1 (revue) : durcissement concurrence de la projection d'abonnement.
--
-- Corrige un défaut de CONCURRENCE de 0013 (revue adversariale) : `select ... for update` ne pose
-- AUCUN verrou quand la ligne `abonnement` n'existe pas encore (Postgres n'a pas de gap-lock). Deux
-- events Stripe concurrents sur une NOUVELLE abonnée obtenaient donc tous deux `found = false`,
-- sautaient la garde anti-régression, et le `on conflict ... do update` INCONDITIONNEL laissait
-- l'event committé en second écraser l'état — régression permanente possible de l'entitlement.
--
-- Deux remparts (défense en profondeur) :
--   1. `pg_advisory_xact_lock` par utilisatrice EN TÊTE : sérialise TOUS les appels du même compte,
--      y compris avant l'existence de la ligne → le 2ᵉ appel trouve la ligne et la garde s'applique.
--   2. Clause `where ... source_maj_le <= excluded.source_maj_le` sur le DO UPDATE : anti-régression
--      atomique au niveau écriture, correcte même si le verrou venait à sauter.
-- Aussi : `periode_fin` COALESCE (ne pas écraser une fin connue par un null), et suppression de
-- l'index redondant `abonnement_utilisatrice_idx` (la contrainte `unique` crée déjà l'index).

drop index if exists public.abonnement_utilisatrice_idx;

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
  -- 0) Sérialise tous les appels concurrents du MÊME compte (même sans ligne existante : le FOR UPDATE
  --    seul ne verrouille rien sur une ligne absente). pg_catalog schéma-qualifié (search_path='').
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(cible::text, 0));

  -- 1) Dédup idempotente par event.id : un rejeu Stripe ne produit AUCUN second effet.
  insert into public.evenements_traites (provider_event_id, type)
  values (p_provider_event_id, p_type)
  on conflict (provider_event_id) do nothing;
  get diagnostics v_insere = row_count;
  if v_insere = 0 then
    return 'deja_traite';
  end if;

  -- 2) Verrou de ligne (désormais garanti sérialisé par le verrou consultatif ci-dessus).
  select * into ab from public.abonnement where utilisatrice_id = cible for update;

  -- 3) Anti-régression : un event PLUS ANCIEN ne régresse jamais l'état (Stripe n'ordonne pas).
  if found and ab.source_maj_le > p_source_maj_le then
    return 'ignore_obsolete';
  end if;

  -- 4) Projection écrivain-unique (upsert une-ligne-par-utilisatrice). La clause WHERE rend
  --    l'anti-régression atomique avec l'écriture. `periode_fin`/ids Stripe : conservés si absents.
  insert into public.abonnement (
    utilisatrice_id, etat, stripe_customer_id, stripe_subscription_id, periode_fin, source_maj_le, mis_a_jour_le
  ) values (
    cible, p_etat, p_stripe_customer_id, p_stripe_subscription_id, p_periode_fin, p_source_maj_le, now()
  )
  on conflict (utilisatrice_id) do update set
    etat                   = excluded.etat,
    stripe_customer_id     = coalesce(excluded.stripe_customer_id, public.abonnement.stripe_customer_id),
    stripe_subscription_id = coalesce(excluded.stripe_subscription_id, public.abonnement.stripe_subscription_id),
    periode_fin            = coalesce(excluded.periode_fin, public.abonnement.periode_fin),
    source_maj_le          = excluded.source_maj_le,
    mis_a_jour_le          = now()
  where public.abonnement.source_maj_le <= excluded.source_maj_le;

  return 'traite';
end;
$$;

revoke all on function public.traiter_evenement_abonnement(uuid, text, text, text, text, text, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.traiter_evenement_abonnement(uuid, text, text, text, text, text, timestamptz, timestamptz)
  to service_role;
