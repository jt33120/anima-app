-- Migration forward-only — Story 4.4 : `signal_reconceptualisation` — le SIGNAL EN ATTENTE d'un moment
-- de reconceptualisation (« avant je pensais X, maintenant Y »), germe d'une future branche (Story 4.5).
--
-- POSTURE : possédé sous JWT (miroir `fait_extrait`/0018 : DÉRIVÉ côté serveur — le détecteur fort — mais
--   POSSÉDÉ par l'utilisatrice pour lecture/effacement). POINTEUR-SEUL : aucune colonne de contenu art. 9
--   en clair — le signal POINTE l'entrée de journal exacte (où vit le verbatim). Il révèle un moment de
--   bascule psychologique → protégé art. 9 (RLS, chiffré au repos), mais content-safe (aucun verbatim).
--
-- AD-17 (le cœur sûr, AC3 [DUR]) — DOUBLE-DÉFENSE réutilisant la SOURCE UNIQUE `branche_bloquee_par_detresse()`
--   (0010, `fin IS NULL OR fenetre_expire_at > now()` = épisode OUVERT ou dans les 72 h) :
--     (a) garde de PIPELINE (`evaluerReconceptualisationDuTour`) → aucun appel fort en détresse ;
--     (b) garde au POINT D'ÉCRITURE (ci-dessous) → la fonction possédée LÈVE si la fenêtre est active,
--         même si (a) est un jour contourné (défense en profondeur, miroir de la garde de branche 4.5).
--
-- IDEMPOTENCE + ANTI-RÉSURRECTION (AC4) : `unique (utilisatrice_id, entree_journal_id)` + `on conflict do
--   nothing` → une ré-émission/retry du même tour = UN signal ; un signal déjà `consomme`/`ecarte` (posé par
--   4.5) n'est JAMAIS ré-ouvert en `en_attente` par une re-détection.

create table public.signal_reconceptualisation (
  id                uuid        primary key default gen_random_uuid(),
  utilisatrice_id   uuid        not null references public.utilisatrice(id) on delete cascade,          -- purge FR-067
  entree_journal_id uuid        not null references public.entree_journal(id) on delete cascade,        -- le message EXACT (AC4)
  statut            text        not null default 'en_attente' check (statut in ('en_attente', 'consomme', 'ecarte')),
  cree_le           timestamptz not null default now(),
  maj_le            timestamptz not null default now()
);

-- Idempotence (AC4) : un signal par (utilisatrice, entrée-source). Le signal consommé/écarté OCCUPE la clé
-- → une re-détection ne le ressuscite pas (`on conflict do nothing`).
create unique index signal_reconceptualisation_entree_unique
  on public.signal_reconceptualisation (utilisatrice_id, entree_journal_id);
-- Lecture des signaux EN ATTENTE d'une utilisatrice (Story 4.5 : proposer une branche le lendemain).
create index signal_reconceptualisation_attente_idx
  on public.signal_reconceptualisation (utilisatrice_id, statut);

alter table public.signal_reconceptualisation enable row level security;
alter table public.signal_reconceptualisation force  row level security;

-- Lecture propriétaire : `using` ouvert au propriétaire → export FR-067 + SURVIT à la révocation.
create policy signal_reconceptualisation_lecture on public.signal_reconceptualisation
  for select
  using (auth.uid() = utilisatrice_id);

-- Insertion write-gatée DURCIE — COPIE du gabarit `entree_journal`/`fait_extrait`/`resume_glissant` :
-- consentement art. 9 valide/non révoqué ET compte NON barré-minorité (AD-13, leçon F1). Poser un signal =
-- traiter de l'art. 9 → gaté. Après révocation : plus de nouveau signal ; la lecture/export survit.
--
-- ⚠️ LE VRAI POINT D'ÉCRITURE (revue 4.4, R1/R3, CRITIQUE) : `authenticated` a le grant INSERT table-level
-- (la RLS deny-by-default est la seule barrière, pas l'absence de grant). Un `.from(...).insert()` DIRECT
-- ne traverse PAS la RPC `security invoker` → les gardes AD-17 + isolation DOIVENT vivre ICI (dans la policy),
-- pas seulement dans le corps de la RPC — sinon la « double-défense » est illusoire (un insert direct saute
-- les deux). C'est le patron `entree_journal`/`fait_extrait` (write-gate DANS la policy). En prime, mettre la
-- garde AD-17 dans le WITH CHECK la rend ATOMIQUE avec l'insert (une seule instruction, un seul snapshot →
-- plus de TOCTOU check→insert, R3) :
--   • `not branche_bloquee_par_detresse()` — AD-17 [DUR] : aucun signal né pendant un épisode / dans les 72 h ;
--   • `exists (entree_journal appartenant à l'appelante)` — isolation AC4 : le signal se rattache à SON journal
--     (le FK seul ignore la RLS de la table référencée → un id d'autrui passerait le FK ; ce `exists` le refuse).
create policy signal_reconceptualisation_insertion on public.signal_reconceptualisation
  for insert
  with check (auth.uid() = utilisatrice_id
              and public.a_consenti_art9()
              and not public.est_barre_minorite()
              and not public.branche_bloquee_par_detresse()
              and exists (select 1 from public.entree_journal e
                          where e.id = entree_journal_id
                            and e.utilisatrice_id = (select auth.uid())));
-- AUCUNE policy `update` sous JWT (les transitions consomme/ecarte = Story 4.5) ni `delete` (l'effacement
-- FR-067 = service_role, moteur de rétention, Epic 6). Pointeur-seul : rien à corriger côté contenu.

-- ── `maj_le` autoritaire en BASE (patron `resume_glissant`/0019) ──────────────────────────────────────
create function public.signal_reconceptualisation_touch_maj()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.maj_le = now();  -- heure de début de transaction (autoritaire base, jamais l'horloge cliente)
  return new;
end;
$$;
revoke execute on function public.signal_reconceptualisation_touch_maj() from public, anon, authenticated;
create trigger signal_reconceptualisation_maj_le
  before insert or update on public.signal_reconceptualisation
  for each row execute function public.signal_reconceptualisation_touch_maj();

-- ── Fonction de merge possédée (AC4) — le chemin d'écriture APPLICATIF, sous JWT ─────────────────────
-- `security INVOKER` (comme `fusionner_fait_extrait`/`charger_faits_actifs`) : `signal_reconceptualisation`
-- est possédé sous JWT → la RLS ET le write-gate (policy ci-dessus) mordent AUSSI dans la fonction. Son rôle
-- PROPRE : résoudre l'entrée EXACTE depuis le `cle_tour` (le client ne fournit jamais un id d'entrée →
-- pas d'oracle inter-tenant, pas de signal orphelin) puis insérer un signal en attente.
--
-- ⚠️ Les gardes DE SÉCURITÉ (AD-17 + appartenance de l'entrée) vivent désormais dans la POLICY WITH CHECK
-- (revue 4.4, R1) : elles s'appliquent à TOUT insert, y compris un `.from(...).insert()` direct qui saute
-- cette fonction. Les vérifs ci-dessous sont un FAST-FAIL amical (message clair, échec précoce) + défense en
-- profondeur — la garantie atomique reste le WITH CHECK.
--
-- Ordre : (1) fast-fail AD-17 (message clair) ; (2) résout l'entrée sous auth.uid() (LÈVE si absente) ;
-- (3) insert idempotent `en_attente` — dont le WITH CHECK re-vérifie AD-17 + appartenance ATOMIQUEMENT.
create function public.enregistrer_signal_reconceptualisation(p_cle_tour text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_entree uuid;
begin
  -- (1) [DUR / AD-17] — garde au POINT D'ÉCRITURE (double-défense, source unique branche_bloquee).
  -- Refuse tant que l'épisode est OUVERT ou dans les 72 h suivant l'extinction — aucun signal né d'une détresse.
  if public.branche_bloquee_par_detresse() then
    raise exception 'signal_reconceptualisation : aucun signal ne naît pendant un épisode de détresse ni dans les 72 h (AD-17, Story 4.4)';
  end if;

  -- (2) ISOLATION (miroir `fusionner_fait_extrait`) : l'entrée EXACTE doit appartenir à l'appelante.
  -- Sous security invoker la RLS masque déjà le journal d'autrui, mais on l'exige EXPLICITEMENT.
  select id into v_entree
    from public.entree_journal
   where utilisatrice_id = (select auth.uid())
     and cle_tour = p_cle_tour
     and role = 'utilisatrice';
  if v_entree is null then
    raise exception 'signal_reconceptualisation : entree_journal introuvable pour ce tour (isolation, AC4, Story 4.4)';
  end if;

  -- (3) SIGNAL EN ATTENTE — idempotent + anti-résurrection (un consomme/ecarte n'est jamais ré-ouvert).
  insert into public.signal_reconceptualisation (utilisatrice_id, entree_journal_id, statut)
  values ((select auth.uid()), v_entree, 'en_attente')
  on conflict (utilisatrice_id, entree_journal_id) do nothing;
end;
$$;

revoke execute on function public.enregistrer_signal_reconceptualisation(text) from public, anon;
grant  execute on function public.enregistrer_signal_reconceptualisation(text) to authenticated;

comment on table public.signal_reconceptualisation is
  'Story 4.4 (AD-8 couche 3 / AD-16 / AD-17) : signal EN ATTENTE d''un moment de reconceptualisation, germe d''une branche (4.5). Possédé sous JWT (dérivé serveur, possédé utilisatrice), POINTEUR-SEUL (aucun contenu art. 9 en clair — pointe entree_journal, le message exact AC4). RLS deny-by-default + write-gate durci (a_consenti_art9, est_barre_minorite). Idempotent par (utilisatrice_id, entree_journal_id) ; anti-résurrection (on conflict do nothing). AD-17 double-défense : garde pipeline + garde au point d''écriture (branche_bloquee_par_detresse). Effacement FR-067 = service_role (Epic 6) ; purge aussi par on delete cascade (utilisatrice ET entree_journal).';
comment on function public.enregistrer_signal_reconceptualisation(text) is
  'Story 4.4 (AC3/AC4) : SEUL chemin d''écriture du signal, possédé sous JWT (security invoker). (1) LÈVE si branche_bloquee_par_detresse() (AD-17, point d''écriture) ; (2) résout l''entrée exacte depuis (auth.uid(), cle_tour, ''utilisatrice'') — LÈVE si absente (isolation) ; (3) insert idempotent en_attente (anti-résurrection).';
