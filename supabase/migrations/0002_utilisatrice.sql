-- Migration forward-only — Story 1.3 : compte sans mot de passe.
--
-- Table `utilisatrice` : ancrage du compte, 1:1 avec auth.users. AUCUNE donnée art.9.
-- RLS deny-by-default + policy propriétaire (auth.uid() = id) — AD-12.
-- La ligne est créée par un TRIGGER sur auth.users (tâche système, security definer),
-- jamais via service_role depuis un route handler applicatif (AD-12).

create table public.utilisatrice (
  id      uuid primary key references auth.users(id) on delete cascade,
  cree_le timestamptz not null default now()
);

alter table public.utilisatrice enable row level security;
alter table public.utilisatrice force  row level security;

-- Owner-only : chaque utilisatrice ne voit et n'écrit que SA ligne.
create policy utilisatrice_proprietaire on public.utilisatrice
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Création atomique au signup (pattern Supabase handle_new_user).
-- security definer + search_path='' obligatoires (sécurité ; sinon get_advisors le signale).
create function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  insert into public.utilisatrice (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
