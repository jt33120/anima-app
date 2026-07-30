-- Migration forward-only — Story 4.3 : `resume_glissant` (réceptacle du RÉSUMÉ GLISSANT, AD-14) +
-- lecture possédée `charger_faits_actifs()` (le côté LECTURE de la mémoire — miroir de 4.2/écriture).
--
-- LE RÉSUMÉ GLISSANT : l'état condensé de la conversation en cours, en clair (art. 9), POSSÉDÉ par
--   l'utilisatrice sous JWT (jamais service_role applicatif, AD-12). AD-14 le NOMME explicitement comme
--   ligne art. 9 effaçable (FR-067). Posture POSSÉDÉE-JWT (comme `fait_extrait`/`entree_journal`), et
--   NON server-authoritative (contraste voulu avec `seance`/0012, deny-by-default nu) : c'est SA donnée,
--   qu'elle pourra VOIR (« Ce qu'Anam retient », Epic 6), EXPORTER et EFFACER — aucun enjeu de forge
--   (rien de « jouable » comme la phase d'arc). Donc RLS + policies + write-gate, pas `security definer`.
--
-- Cadrage PO « l'assembleur d'abord » (miroir de « le réceptacle d'abord » de 4.2) : le RÉDACTEUR du
--   résumé (résumer = tâche LLM) est DIFFÉRÉ (4.4/4.9). Ici : le réceptacle mécanique (rempli par
--   `enregistrerResume` / upsert), la lecture possédée des faits actifs, et leurs preuves. Aucun câblage
--   de prompt, aucun générateur LLM en prod (AD-4 interdit le stub-en-prod).
--
-- Cardinalité v1 : UN résumé par utilisatrice (`unique (utilisatrice_id)`, upsert), aligné sur `seance`
--   (une séance courante par utilisatrice). Le résumé par fil (multi-séance) est différé (deferred-work) —
--   pas de FK vers `seance` (qui est deny-by-default → invisible sous JWT).

create table public.resume_glissant (
  id              uuid        primary key default gen_random_uuid(),
  utilisatrice_id uuid        not null unique references public.utilisatrice(id) on delete cascade,  -- purge FR-067
  contenu         text        not null,               -- le résumé condensé (art. 9)
  cree_le         timestamptz not null default now(),
  maj_le          timestamptz not null default now()
);

create index resume_glissant_utilisatrice_idx on public.resume_glissant (utilisatrice_id);

alter table public.resume_glissant enable row level security;
alter table public.resume_glissant force  row level security;

-- Lecture propriétaire : `using` ouvert au propriétaire → export FR-067 + SURVIT à la révocation.
create policy resume_glissant_lecture on public.resume_glissant
  for select
  using (auth.uid() = utilisatrice_id);

-- Écriture write-gatée DURCIE — COPIE du gabarit `entree_journal`/`fait_extrait` (leçon F1 : consentement
-- art. 9 valide/non révoqué ET compte NON barré-minorité). Rafraîchir le résumé = déposer du contenu art. 9
-- → gaté aussi bien à l'insert (1re pose) qu'à l'update (rafraîchissement). Après révocation : plus d'écriture
-- (la lecture/export survit via la policy select ; l'effacement FR-067 reste service_role, Epic 6).
create policy resume_glissant_insertion on public.resume_glissant
  for insert
  with check (auth.uid() = utilisatrice_id
              and public.a_consenti_art9()
              and not public.est_barre_minorite());
create policy resume_glissant_maj on public.resume_glissant
  for update
  using      (auth.uid() = utilisatrice_id)
  with check (auth.uid() = utilisatrice_id
              and public.a_consenti_art9()
              and not public.est_barre_minorite());
-- AUCUNE policy `delete` sous JWT → l'effacement FR-067 = service_role (moteur de rétention, Epic 6).

-- ── `maj_le` autoritaire en BASE (revue 4.3, D) ──────────────────────────────────────────────────────
-- Le défaut de colonne `now()` ne joue qu'à l'INSERT ; sur l'UPDATE de l'upsert (rafraîchissement du résumé
-- glissant), il resterait figé. Plutôt que de fixer `maj_le` côté application (horloge Node non monotone
-- sous concurrence/skew multi-instance, et `maj_le < cree_le` possible), la BASE le tient — miroir de
-- `fusionner_fait_extrait`/0018 (`maj_le = now()`). Garantit `maj_le >= cree_le` et un ordre cohérent.
create function public.resume_glissant_touch_maj()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.maj_le = now();  -- heure de début de transaction (autoritaire base, jamais l'horloge cliente)
  return new;
end;
$$;
revoke execute on function public.resume_glissant_touch_maj() from public, anon, authenticated;
create trigger resume_glissant_maj_le
  before insert or update on public.resume_glissant
  for each row execute function public.resume_glissant_touch_maj();

-- ── Lecture POSSÉDÉE des faits actifs (AC3, le cœur côté lecture) ─────────────────────────────────────
-- `security INVOKER` : la RLS de `fait_extrait` s'applique à l'appelante → ne voit QUE ses propres faits
-- (jamais service_role — `fait_extrait` est possédé sous JWT, AD-12). Cette fonction préserve INTACTE la
-- garde 4.2 (le littéral de table `fait_extrait` reste banni côté applicatif : on ajoute une lecture
-- POSSÉDÉE, on n'ouvre pas l'accès direct). Elle est le SEUL endroit possédé qui définit « ce qui est
-- rappelable » : `where statut = 'actif'` → un tombstone (corrige/supprime) ne quitte JAMAIS la base vers
-- un rappel (AC3 [DUR], niveau base ; le filtre pur de `assemblerRappel` est le second niveau, domaine).
create function public.charger_faits_actifs()
returns table (cle_dedoublonnage text, contenu text, cree_le timestamptz, maj_le timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select f.cle_dedoublonnage, f.contenu, f.cree_le, f.maj_le
  from public.fait_extrait f
  where f.utilisatrice_id = (select auth.uid())   -- explicite (la RLS le fait déjà sous invoker — défense en profondeur)
    and f.statut = 'actif'                          -- ← LE filtre tombstone (AC3, niveau base)
  -- Ordre TOTAL (revue 4.3, B) : `cle_dedoublonnage` départage les `cree_le` égaux (ex. un futur batch
  -- multi-faits 4.4 en une transaction → même `now()`). Unique par utilisatrice (index 0018), opaque/art.9-safe.
  order by f.cree_le desc, f.cle_dedoublonnage asc; -- daté décroissant, déterministe (rappel du récent d'abord)
$$;

revoke execute on function public.charger_faits_actifs() from public, anon;
grant  execute on function public.charger_faits_actifs() to authenticated;

comment on table public.resume_glissant is
  'Résumé glissant (AD-8/AD-14) : l''état condensé de la conversation en cours, en clair (art. 9), possédé sous JWT (jamais service_role applicatif), corrigeable/rafraîchissable. Posture possédée-JWT (RLS + write-gate), NON server-authoritative (contraste voulu vs seance/0012). Un résumé par utilisatrice en v1 (multi-séance différé). Rédacteur LLM différé (Story 4.4/4.9). Effacement FR-067 = service_role (Epic 6) ; purge aussi par on delete cascade.';
comment on function public.charger_faits_actifs() is
  'Story 4.3 (AC3, AD-18) : lecture POSSÉDÉE des faits actifs de l''appelante (security invoker → RLS s''applique). Seul endroit possédé qui définit « ce qui est rappelable » : where statut=''actif'' → un tombstone n''entre jamais dans un rappel. Préserve intacte la garde 4.2 (le littéral fait_extrait reste banni côté applicatif).';
