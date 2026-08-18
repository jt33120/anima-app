-- Migration forward-only — revue des Epics 1 à 4 (trouvaille #4) : un remboursement qui ÉCHOUE.
--
-- ══ LE DÉFAUT ═══════════════════════════════════════════════════════════════════════════════════
--
-- `interpreterRemboursement` ne retient que `refund.status = 'succeeded'` — et le commentaire dit
-- exactement pourquoi : « `refund.updated` existe précisément parce qu'un remboursement peut
-- ÉCHOUER après coup (compte fermé, carte expirée) ». Le raisonnement était juste ; sa conclusion
-- s'arrêtait à mi-chemin. Un échec rendait `null`, le webhook tombait dans la branche suivante,
-- répondait 200, et rien n'était écrit nulle part.
--
-- Pendant ce temps l'écran lui a dit, en toutes lettres : « C'est demandé. Le remboursement arrive
-- sur ton moyen de paiement. » Rien ne le contredit jamais — `confirme_le` n'est lue par aucune
-- surface, et aucun incident n'est levé. Elle attend un virement qui ne viendra pas, et personne,
-- ni elle ni nous, n'a de quoi s'en apercevoir.
--
-- C'est le patron déjà réparé une fois sur ce même écran (revue du 2026-08-11, M2 :
-- « quelqu'un lisait "le remboursement arrive" et attendait un virement qui ne viendrait jamais »).
-- Le cas « aucun paiement retrouvé » avait été traité ; le cas « Stripe a refusé » ne l'était pas.
--
-- ══ LE CORRECTIF ════════════════════════════════════════════════════════════════════════════════
--
-- Une colonne `echec_le`, et une RPC sœur de `confirmer_remboursement` — même patron d'idempotence
-- par `evenements_traites`, mêmes privilèges. La demande RESTE en base avec sa clé : un échec n'est
-- pas une annulation, et elle doit pouvoir redemander sans que Stripe rembourse deux fois.
--
-- ⚠️ `confirme_le` GAGNE TOUJOURS SUR `echec_le`, dans les deux sens. Stripe peut émettre un
-- `refund.updated` en `failed` puis un `succeeded` (nouvelle tentative sur un autre moyen), et
-- l'ordre de livraison des webhooks n'est pas garanti. Une confirmation efface donc l'échec, et un
-- échec ne s'écrit jamais par-dessus une confirmation : l'argent rendu est un fait, pas un état.

alter table public.remboursement
  add column echec_le timestamptz;

comment on column public.remboursement.echec_le is
  'Revue Epics 1-4 : horodatage d''un `refund.updated` en `failed` (compte fermé, carte expirée). NULL = aucun échec connu. Toujours dominé par `confirme_le` : l''argent rendu est un fait, un échec n''est qu''un état.';

create or replace function public.echouer_remboursement(
  p_utilisatrice uuid,
  p_provider_event_id text,
  p_type text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_insere int;
begin
  -- Idempotence par événement — patron EXACT de `confirmer_remboursement` (0038). Un rejeu de
  -- webhook (Stripe rejoue sur 5xx) ne doit produire aucun second effet.
  insert into public.evenements_traites (provider_event_id, type)
  values (p_provider_event_id, p_type)
  on conflict (provider_event_id) do nothing;
  get diagnostics v_insere = row_count;
  if v_insere = 0 then
    return false;
  end if;

  -- `confirme_le is null` : on n'écrit JAMAIS un échec par-dessus une confirmation. Les webhooks
  -- n'arrivent pas dans l'ordre, et l'argent rendu ne se dé-rend pas.
  update public.remboursement
     set echec_le = coalesce(echec_le, now())
   where utilisatrice_id = p_utilisatrice
     and confirme_le is null;

  return true;
end;
$$;

revoke all     on function public.echouer_remboursement(uuid, text, text) from public, anon, authenticated;
grant  execute on function public.echouer_remboursement(uuid, text, text) to service_role;

comment on function public.echouer_remboursement(uuid, text, text) is
  'Revue Epics 1-4 : marque un remboursement en échec (webhook `refund.updated` / `failed`). Idempotent par `evenements_traites`. N''écrase jamais une confirmation — l''ordre de livraison des webhooks n''est pas garanti.';

-- La confirmation, elle, EFFACE l'échec : une seconde tentative réussie doit rendre l'écran honnête.
create or replace function public.confirmer_remboursement(
  p_utilisatrice uuid,
  p_provider_event_id text,
  p_type text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_insere int;
begin
  insert into public.evenements_traites (provider_event_id, type)
  values (p_provider_event_id, p_type)
  on conflict (provider_event_id) do nothing;
  get diagnostics v_insere = row_count;
  if v_insere = 0 then
    return false; -- rejeu : aucun second effet
  end if;

  update public.remboursement
     set confirme_le = coalesce(confirme_le, now()),
         echec_le    = null   -- l'argent est rendu : l'échec qui précède n'a plus d'objet
   where utilisatrice_id = p_utilisatrice;

  return true;
end;
$$;
