-- Migration forward-only — REVUE DE CODE du 2026-08-11, lot 2. Trouvailles M1/M2/M3 (la garantie).
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- LA GARANTIE DE REMBOURSEMENT N'A JAMAIS REMBOURSÉ PERSONNE
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
--
-- Trois défauts en chaîne, chacun suffisant à lui seul, et le troisième rendait les deux premiers
-- invisibles :
--
--   M1 — `lib/stripe/resiliation.ts` demandait `expand: ["latest_invoice"]`, ce qui NE RAMÈNE PAS
--        `latest_invoice.payments`. Mesuré le 2026-08-12 contre l'API Stripe réelle, sur une
--        facture réellement payée de 6900 centimes :
--            expand=["latest_invoice"]           → champ `payments` ABSENT, 0 paiement trouvé
--            expand=["latest_invoice.payments"]  → présent, 1 paiement, pi_3U3X5A…
--        Donc `paymentIntentDe` rendait `null`, `refunds.create` n'était JAMAIS atteint, et la
--        cliente était seulement résiliée. (Corrigé côté TypeScript, pas ici.)
--
--   M2 — la route jetait la valeur de retour `IssueRemboursement` et affichait « C'est demandé. Le
--        remboursement arrive sur ton moyen de paiement. » y compris sur `rien_a_rembourser`.
--        (Corrigé côté TypeScript.)
--
--   M3 — C'EST CE QUE RÉPARE CETTE MIGRATION. La route court-circuitait Stripe dès que la
--        réservation existait :
--            if (reservation.dejaDemande) return vers("rembourse");
--        Un premier appel Stripe échoué (timeout, 5xx, lambda tuée) devenait donc DÉFINITIF :
--        toute nouvelle tentative répondait « remboursée » sans jamais rappeler Stripe.
--
-- ── LA RPC AVAIT RAISON, C'EST LA ROUTE QUI LA TRAHISSAIT ─────────────────────────────────────
--
-- Le commentaire de `demander_remboursement` (0038) dit exactement ce qu'il fallait faire :
--     « Déjà demandé : on rend la MÊME clé. C'est ce qui fait qu'un retry de la route reparle à
--       Stripe de la même opération au lieu d'en ouvrir une seconde. »
-- Reparler à Stripe — pas répondre « c'est fait ». L'idempotence Stripe (`idempotencyKey`) est
-- précisément conçue pour qu'un rejeu ne rembourse pas deux fois ; le court-circuit la rendait
-- inutile tout en s'appuyant sur elle dans les commentaires.
--
-- Ce qui manquait à la route pour faire la différence entre « demandé » et « réellement remboursé »
-- existait déjà en base : `remboursement.confirme_le`, posée par le webhook `refund.created` via
-- `confirmer_remboursement`. Elle n'était **lue par personne** dans tout le dépôt. La RPC la rend
-- désormais, et c'est tout ce qu'il fallait.
--
-- ⚠️ La signature de retour change (3 colonnes → 4), donc `drop` puis `create` : Postgres refuse un
-- `create or replace` qui modifie le type de retour. Les grants sont re-posés à l'identique.

drop function public.demander_remboursement(uuid, text);

create function public.demander_remboursement(p_utilisatrice uuid, p_motif text)
returns table (cle uuid, subscription_id text, deja_demande boolean, confirme_le timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existant public.remboursement;
  v_sub      text;
begin
  if p_motif is null or p_motif not in ('garantie', 'minorite') then
    raise exception 'remboursement_motif_invalide';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_utilisatrice::text, 3500));

  -- Déjà demandé : on rend la MÊME clé, ET l'horodatage de confirmation.
  -- `confirme_le is null` signifie « la demande est réservée mais Stripe n'a jamais confirmé » :
  -- l'appelant DOIT rejouer avec cette clé. `confirme_le` non nul signifie « le webhook
  -- `refund.created` est passé » : là seulement, il peut répondre sans rappeler Stripe.
  select * into v_existant from public.remboursement r where r.utilisatrice_id = p_utilisatrice;
  if found then
    return query select v_existant.cle_idempotence,
                        v_existant.stripe_subscription_id,
                        true,
                        v_existant.confirme_le;
    return;
  end if;

  -- L'éligibilité ne gouverne QUE la garantie. La minorité rembourse sans condition (FR-071).
  if p_motif = 'garantie' and not public.eligible_au_remboursement(p_utilisatrice) then
    raise exception 'remboursement_non_eligible';
  end if;

  select a.stripe_subscription_id into v_sub
    from public.abonnement a where a.utilisatrice_id = p_utilisatrice;

  insert into public.remboursement (utilisatrice_id, motif, stripe_subscription_id)
  values (p_utilisatrice, p_motif, v_sub);

  return query
    select r.cle_idempotence, r.stripe_subscription_id, false, r.confirme_le
      from public.remboursement r where r.utilisatrice_id = p_utilisatrice;
end;
$$;

-- Grants à l'identique de 0038 : jamais `authenticated`, la réservation est une décision système.
revoke all     on function public.demander_remboursement(uuid, text) from public, anon, authenticated;
grant  execute on function public.demander_remboursement(uuid, text) to service_role;

comment on function public.demander_remboursement(uuid, text) is
  'Revue 2026-08-11 (M3) : rend aussi `confirme_le`. Sans elle, la route ne pouvait pas distinguer « demandé » de « remboursé », et un premier appel Stripe échoué devenait définitif.';
