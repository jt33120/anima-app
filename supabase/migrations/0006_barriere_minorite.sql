-- Migration forward-only — Story 1.9 : appliquer la barrière de minorité détectée (FR-071).
--
-- DISTINCTE de `mineur_detecte` (0003, blocage à la DÉCLARATION d'âge — compte jamais consenti,
-- abandonné → signOut + /entrer?refus=age). Ici la minorité est détectée APRÈS coup (le
-- classifieur en conversation relève d'un epic ultérieur ; ici le drapeau est INJECTÉ) sur un
-- compte qui a CONSENTI et accumulé des données. Conséquences (AD-14, AD-13, AD-9) :
--   • on SUSPEND (plus aucune écriture de contenu, plus aucun échange) ;
--   • on ENREGISTRE une échéance de suppression à 30 j — une DONNÉE que le moteur unique de
--     rétention/effacement (Story 6.8) consommera. 1.9 N'EFFACE RIEN elle-même (AD-14).
-- La légalité/sécurité ne dépend JAMAIS d'un écran : la base elle-même referme le write-gate.

-- ── État de suspension + échéance enregistrée ─────────────────────────────────────────────
-- `mineur_detecte` (0003) reste inchangé. On ajoute un état DISTINCT.
alter table public.utilisatrice
  add column barriere_minorite_le timestamptz,   -- null = compte actif ; non-null = suspendu
  add column echeance_suppression date;          -- échéance de suppression ENREGISTRÉE (moteur AD-14)

comment on column public.utilisatrice.barriere_minorite_le is
  'Story 1.9 (FR-071) : instant d''application de la barrière de minorité DÉTECTÉE (post-consentement). Non-null = compte suspendu. Distinct de mineur_detecte (blocage à la déclaration d''âge).';
comment on column public.utilisatrice.echeance_suppression is
  'Story 1.9 (AD-14) : date de suppression ENREGISTRÉE pour le moteur unique de rétention (Story 6.8). 1.9 ne supprime pas — elle pose la donnée.';

-- ── Prédicat de garde : le compte COURANT est-il sous barrière de minorité ? ───────────────
-- Sans paramètre : s'appuie sur auth.uid() (jamais un uid arbitraire) → pas d'oracle
-- inter-utilisatrices (acquis revue 1.6). security definer + search_path verrouillé, comme
-- a_consenti_art9() (0005). Ne rend qu'un booléen : ce n'est pas un accès service_role au
-- contenu, c'est un prédicat de garde.
create or replace function public.est_barre_minorite()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.utilisatrice u
    where u.id = (select auth.uid())
      and u.barriere_minorite_le is not null
  );
$$;

revoke all on function public.est_barre_minorite() from public;
grant execute on function public.est_barre_minorite() to authenticated;

-- ── Durcir le write-gate art. 9 : « plus aucune écriture » sous barrière (AC1) ─────────────
-- On RE-CRÉE la policy de 0005 en ajoutant `and not est_barre_minorite()` au WITH CHECK.
-- Le USING (lecture propriétaire) reste INCHANGÉ → l'export RGPD reste possible sous barrière
-- (AC3). Résultat : même avec un consentement art. 9 valide, un compte suspendu ne peut plus
-- écrire de contenu — la garde mord dans la base, pas dans l'UI (AD-13).
drop policy art9_temoin_ecriture on public.art9_temoin;
create policy art9_temoin_ecriture on public.art9_temoin
  for all
  using      (auth.uid() = utilisatrice_id)
  with check (auth.uid() = utilisatrice_id
              and public.a_consenti_art9()
              and not public.est_barre_minorite());

-- ── Enregistrement d'audit de sécurité — SANS art. 9 (AC4) ─────────────────────────────────
-- SPINE Opérations L241 : « Chaque classification de sécurité (détresse, minorité) émet un
-- enregistrement d'audit SANS art. 9 (niveau, décision, tier, horodatage). » Ici le drapeau
-- est INJECTÉ (pas classifié) → minimum honnête : type + décision + horodatage. Système-only :
-- RLS active SANS policy (deny-by-default, comme `probe`/0001) → ni lecture ni écriture RLS ;
-- alimentée uniquement par la fonction SECURITY DEFINER ci-dessous.
create table public.audit_securite (
  id              uuid primary key default gen_random_uuid(),
  utilisatrice_id uuid not null references public.utilisatrice(id) on delete cascade,
  type            text not null,          -- ex. 'minorite'
  decision        text not null,          -- ex. 'barriere_appliquee'
  cree_le         timestamptz not null default now()
);

alter table public.audit_securite enable row level security;
alter table public.audit_securite force  row level security;  -- aucune policy = deny-by-default

comment on table public.audit_securite is
  'Story 1.9 (SPINE Opérations) : audit des classifications de sécurité (minorité, plus tard détresse), SANS art. 9. Système-only (RLS sans policy) : alimentée par appliquer_barriere_minorite() en security definer.';

-- Défense en profondeur : au plus UN audit 'minorite' par utilisatrice (une décision = une ligne),
-- même si un appel concurrent contournait la sérialisation applicative ci-dessous.
create unique index audit_securite_minorite_unique
  on public.audit_securite (utilisatrice_id) where (type = 'minorite');

-- ── Application ATOMIQUE + idempotente de la barrière ──────────────────────────────────────
-- Décision SYSTÈME (le futur classifieur serveur, ou l'injection de test/DEV), PAS une écriture
-- de contenu par l'utilisatrice (AD-12) → security definer, réservée au rôle service. Idempotente :
-- si déjà suspendue, ne réécrit ni l'échéance (fenêtre 30 j STABLE) ni n'empile un audit.
-- La DATE d'échéance est calculée en amont (lib/safety, durée paramétrée) et passée en argument :
-- le SQL ne code JAMAIS « 30 » en dur (AD-14).
create or replace function public.appliquer_barriere_minorite(cible uuid, echeance date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Check-then-act SÉRIALISÉ (pas de SELECT nu + UPDATE inconditionnel — revue 1.9) : l'UPDATE
  -- conditionnel prend le verrou de ligne ; sous deux appels concurrents sur le même `cible` non
  -- barré (classifieur/retries d'Epic 2), seul le PREMIER à committer matche `barriere_minorite_le
  -- is null` — le second ré-évalue (EvalPlanQual) après le verrou et ne matche plus (0 ligne).
  update public.utilisatrice
     set barriere_minorite_le = now(),
         echeance_suppression = echeance
   where id = cible and barriere_minorite_le is null;
  if not found then
    return;  -- déjà suspendue (ou cible inexistante) : idempotent, aucun ré-audit ni échéance écrasée
  end if;
  -- Seul le gagnant arrive ici → un seul audit par décision (SPINE Opérations L241).
  insert into public.audit_securite (utilisatrice_id, type, decision)
  values (cible, 'minorite', 'barriere_appliquee');
end;
$$;

-- Jamais exécutable par l'utilisatrice (ni anon) : une décision de sécurité sur un compte.
revoke all on function public.appliquer_barriere_minorite(uuid, date) from public, anon, authenticated;
grant execute on function public.appliquer_barriere_minorite(uuid, date) to service_role;
