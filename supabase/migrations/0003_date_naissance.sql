-- Migration forward-only — Story 1.4 : date de naissance + barrière 18 ans.
--
-- `date_naissance` : donnée ORDINAIRE (pas art.9), saisie UNE fois puis immuable (AD-6).
-- `mineur_detecte` : drapeau si < 18 détecté (aucune DOB de mineur stockée — minimisation).
--                    La suppression du compte est déférée à l'ordonnanceur (AD-14/FR-071).

alter table public.utilisatrice add column date_naissance date;
alter table public.utilisatrice add column mineur_detecte boolean not null default false;

-- Immuabilité (AD-6, saisie unique FR-070) : une fois posée, date_naissance ne change plus.
create function public.date_naissance_immuable()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if old.date_naissance is not null
     and new.date_naissance is distinct from old.date_naissance then
    raise exception 'date_naissance est immuable (AD-6)';
  end if;
  return new;
end;
$$;

create trigger utilisatrice_date_naissance_immuable
  before update on public.utilisatrice
  for each row execute function public.date_naissance_immuable();
