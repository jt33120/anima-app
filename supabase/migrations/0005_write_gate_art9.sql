-- Migration forward-only — Story 1.6 : write-gate art. 9 au niveau base (AD-13).
--
-- La légalité du traitement art. 9 ne doit JAMAIS dépendre d'un écran : la base elle-même
-- refuse toute écriture sur une table art. 9 sans `consentement` valide ET non révoqué (FR-072).
--
-- Mécanisme = RLS `WITH CHECK` (déclaratif, non contournable sous force RLS), PAS un trigger.
-- Le write-gate porte sur l'ÉCRITURE (with check) ; la LECTURE (using) reste ouverte au
-- propriétaire → export RGPD + effacement restent possibles même après révocation (AD-4/AD-14).
-- service_role reste réservé aux tâches système (AD-12) : ici tout passe par la session RLS.

-- ── Prédicat de garde réutilisable ──
-- SANS paramètre : s'appuie sur auth.uid() (jamais un uid arbitraire passé par l'appelant) →
-- impossible d'interroger le consentement d'AUTRUI (pas d'oracle inter-utilisatrices — revue 1.6).
-- security definer + search_path verrouillé : découple la garde de la policy de LECTURE de
-- `consentement` (la garde reste vraie même si cette policy change). Ne rend qu'un booléen —
-- ce n'est pas un accès service_role à du contenu applicatif (AD-12), c'est un prédicat de garde.
create or replace function public.a_consenti_art9()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.consentement c
    where c.utilisatrice_id = (select auth.uid())
      and c.art9_accorde = true
      and c.ia_reconnue  = true
      and c.revoked_at is null
  );
$$;

revoke all on function public.a_consenti_art9() from public;
grant execute on function public.a_consenti_art9() to authenticated;

-- ── Table témoin : gabarit + sonde vivante du write-gate (écho art. 9 de `probe`/0001) ──
-- Vide en prod. Prouve en continu (test CI) que le write-gate mord. Les vraies tables de
-- contenu art. 9 (journal, seance, tirage, socle) COPIERONT cette policy quand elles arriveront.
create table public.art9_temoin (
  id              uuid primary key default gen_random_uuid(),
  utilisatrice_id uuid not null references public.utilisatrice(id) on delete cascade,
  note            text not null,
  cree_le         timestamptz not null default now()
);

alter table public.art9_temoin enable row level security;
alter table public.art9_temoin force  row level security;

-- Write-gate en WITH CHECK (écriture bloquée sans consentement) ; USING ouvert au propriétaire
-- (lecture pour export + delete pour effacement, même après révocation).
create policy art9_temoin_ecriture on public.art9_temoin
  for all
  using      (auth.uid() = utilisatrice_id)
  with check (auth.uid() = utilisatrice_id and public.a_consenti_art9());

comment on table public.art9_temoin is
  'Gabarit + sonde vivante du write-gate art. 9 (AD-13). Vide en prod. Prouve en continu (test CI) qu''aucune écriture art. 9 n''est possible sans consentement valide et non révoqué. Toute future table de contenu art. 9 (journal, seance, tirage, socle) COPIE cette policy.';
