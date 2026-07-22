-- Migration forward-only — RLS deny-by-default (AD-12).
--
-- Table sonde (« probe ») qui PROUVE l'invariant : RLS activée + FORCE, AUCUNE policy.
-- Toute lecture/écriture par un rôle non privilégié (anon / authenticated) est REFUSÉE.
-- Une ligne insérée via service_role (qui contourne la RLS) reste INVISIBLE à anon :
-- c'est ce que vérifie tests/rls.test.ts.

create table if not exists public.probe (
  id     uuid primary key default gen_random_uuid(),
  secret text not null,
  created_at timestamptz not null default now()
);

alter table public.probe enable row level security;
alter table public.probe force  row level security;

-- Aucune policy créée volontairement : deny-by-default.
