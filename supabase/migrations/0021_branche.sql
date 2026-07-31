-- Migration forward-only — Story 4.5 : la table `branche`, TROISIÈME couche de la mémoire (AD-8).
--
-- Une branche est un moment de reconceptualisation que l'utilisatrice a VALIDÉ et NOMMÉ avec ses propres
-- mots (FR-025/026), DATÉ (FR-027) et lié à l'EXTRAIT EXACT (`entree_journal`) dont il provient. Elle naît
-- « le lendemain » d'un `signal_reconceptualisation` en attente (0020, Story 4.4), jamais sur l'instant.
--
-- POSTURE : possédée sous JWT (miroir `entree_journal`/`fait_extrait`/`signal_reconceptualisation`). Le `nom`
--   est du CONTENU art. 9 (il nomme un basculement psychologique) → write-gate consentement, chiffré au repos,
--   ne transite JAMAIS vers un modèle (proposition & nommage 100 % déterministes).
--
-- AD-17 (le cœur sûr, AC5 [DUR]) — la garde vit dans la POLICY WITH CHECK (leçon R1 de la revue 4.4 :
--   `authenticated` a le grant INSERT table-level → un `.from().insert()` DIRECT saute toute RPC ; une garde
--   qui ne vivrait que dans la RPC serait illusoire). `branche_bloquee_par_detresse()` (0010) a été conçue
--   EXPLICITEMENT pour ce write-gate (« le futur write-gate de branche (Epic 4) l'appellera dans son WITH CHECK »).
--
-- AC2 [DUR] : `nom` non vide (CHECK schéma + WITH CHECK policy + RPC) — une branche sans nom N'EXISTE PAS.
-- AC6 : `extrait_source_id` en `on delete RESTRICT` — le lien branche→extrait est INCASSABLE ; on ne peut
--   retirer l'extrait qu'en retirant d'abord la branche (l'effacement exhaustif FR-067/Epic 6 supprime dans
--   cet ordre). Idempotence / anti-double-naissance : `unique (utilisatrice_id, extrait_source_id)`.
--
-- La MONOTONIE naissance→feuillaison→fruit + `intensite` vivante + le renommage sont la 4.7 / la 4.6 : ici,
--   AUCUNE policy update/delete sous JWT (la branche naît, elle ne bouge pas en 4.5).

-- ── AC2 [DUR] : « nom donné par elle » = au moins un caractère NON-blanc (revue 4.5, #1) ──────────────
-- `btrim(nom)` par défaut ne strippe QUE l'espace ASCII U+0020 → un nom fait uniquement de tab/NL/NBSP/espace
-- Unicode passait `length(btrim(...)) > 0` et faisait naître une branche à nom INVISIBLE (asymétrie R1 : l'app
-- utilise JS `.trim()`, plus strict que le point d'écriture autoritaire). On aligne la BASE sur `.trim()` via
-- une fonction unique (CHECK + policy + RPC), immuable → utilisable en contrainte. Mord aussi service_role.
create function public.branche_nom_significatif(p_nom text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  -- Vrai s'il subsiste au moins un caractère hors [:space:] (espace ASCII, TAB/NL/CR/VT/FF) ET hors des espaces
  -- Unicode que JS .trim() retire aussi (NBSP U+00A0, U+1680, U+2000–200A, U+2028/29, U+202F, U+205F, U+3000, BOM).
  select p_nom ~ E'[^[:space:]\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]';
$$;

-- Cohérence-propriétaire DURE de la branche→extrait (revue 4.5, #10) : la FK composite exige que la branche et
-- son extrait source appartiennent à la MÊME utilisatrice, invariant qui survit à un écrivain service_role
-- (Epic 6 / 4.6-4.7), pas seulement à la RLS. Nécessite une unicité sur (utilisatrice_id, id) d'entree_journal.
create unique index entree_journal_util_id_unique on public.entree_journal (utilisatrice_id, id);

create table public.branche (
  id                uuid        primary key default gen_random_uuid(),
  utilisatrice_id   uuid        not null references public.utilisatrice(id) on delete cascade,           -- purge FR-067
  extrait_source_id uuid        not null,                                                                -- FK composite ci-dessous (AC6 + #10)
  nom               text        not null,                                                                -- art. 9, donné par elle (AC2)
  etat              text        not null default 'naissance' check (etat in ('naissance', 'feuillaison', 'fruit')),  -- 4.5 n'écrit que naissance
  intensite         real        not null default 0,                                                      -- feuillaison progressive AD-8 (câblée 4.7)
  date_naissance    timestamptz not null default now(),                                                  -- AC3 « datée »
  cree_le           timestamptz not null default now(),
  maj_le            timestamptz not null default now(),
  constraint branche_nom_significatif_ck check (public.branche_nom_significatif(nom)),  -- AC2 [DUR] (mord service_role)
  -- AC6 (lien incassable, on delete restrict) + #10 (cohérence-propriétaire dure) en une seule FK composite.
  constraint branche_extrait_meme_proprietaire
    foreign key (utilisatrice_id, extrait_source_id)
    references public.entree_journal (utilisatrice_id, id) on delete restrict
);

-- Idempotence (AC1/AC3) : UNE branche par moment source → un double-clic / retry = une seule branche.
create unique index branche_source_unique on public.branche (utilisatrice_id, extrait_source_id);
-- Projection de l'arbre (Story 4.6) : lecture des branches d'une utilisatrice par état.
create index branche_utilisatrice_idx on public.branche (utilisatrice_id, etat);

alter table public.branche enable row level security;
alter table public.branche force  row level security;

-- Lecture propriétaire : `using` ouvert au propriétaire → export FR-067 + projection arbre (4.6) + SURVIT à la révocation.
create policy branche_lecture on public.branche
  for select
  using (auth.uid() = utilisatrice_id);

-- Insertion write-gatée DURCIE — toutes les gardes ATOMIQUES dans le WITH CHECK (leçon R1) :
--   • propriétaire + consentement art. 9 valide/non révoqué + compte non barré-minorité (AD-13) ;
--   • AC5 [DUR / AD-17] : `not branche_bloquee_par_detresse()` — aucune branche née d'un épisode / des 72 h ;
--   • isolation : l'extrait source appartient à l'appelante (le FK seul ignore la RLS de la table référencée) ;
--   • AC2 [DUR] : nom non vide.
create policy branche_insertion on public.branche
  for insert
  with check (auth.uid() = utilisatrice_id
              and public.a_consenti_art9()
              and not public.est_barre_minorite()
              and not public.branche_bloquee_par_detresse()
              and public.branche_nom_significatif(nom)
              and exists (select 1 from public.entree_journal e
                          where e.id = extrait_source_id
                            and e.utilisatrice_id = (select auth.uid())));
-- AUCUNE policy update (renommage = 4.6, cycle de vie = 4.7) ni delete (effacement = service_role, Epic 6) sous JWT.

-- ── `maj_le` autoritaire en BASE (patron `signal…_touch_maj`/0020) ────────────────────────────────────
create function public.branche_touch_maj()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.maj_le = now();
  return new;
end;
$$;
revoke execute on function public.branche_touch_maj() from public, anon, authenticated;
create trigger branche_maj_le
  before insert or update on public.branche
  for each row execute function public.branche_touch_maj();

comment on table public.branche is
  'Story 4.5 (AD-8 couche 3) : branche validée ET nommée par l''utilisatrice (art. 9), datée, liée à extrait_source_id (le message exact). Possédée sous JWT ; write-gate art. 9 (a_consenti_art9, est_barre_minorite) + AD-17 (branche_bloquee_par_detresse) + isolation + nom non vide, TOUT dans la policy WITH CHECK (leçon R1 de 4.4). extrait_source_id on delete RESTRICT = lien incassable (AC6). Monotonie/intensite = 4.7 ; renommage = 4.6 ; effacement FR-067 = service_role (Epic 6).';

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════
-- Transitions du signal (réservées à 4.5 par 0020) : en_attente → consomme (Oui) | ecarte (Non).
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════

-- Policy update propriétaire — SANS a_consenti_art9() : une transition de statut d'un POINTEUR n'est pas un
-- dépôt de contenu art. 9, et « écarter » (Non) doit survivre à la révocation (droit de rejeter). Gaté
-- propriétaire + non barré-minorité (patron `fait_extrait_maj`/0018).
create policy signal_reconceptualisation_maj on public.signal_reconceptualisation
  for update
  using      (auth.uid() = utilisatrice_id)
  with check (auth.uid() = utilisatrice_id
              and not public.est_barre_minorite()
              -- Parité avec la policy INSERT (revue 4.5, #4/#8) : le point d'écriture UPDATE re-vérifie que
              -- entree_journal_id appartient à l'appelante → aucun repointage vers le journal d'autrui.
              and exists (select 1 from public.entree_journal e
                          where e.id = entree_journal_id
                            and e.utilisatrice_id = (select auth.uid())));

-- Trigger de transition (anti-résurrection + cibles légales) — mord aussi service_role (que la RLS ne borne pas).
-- Un signal n'est modifiable QUE depuis en_attente, et UNIQUEMENT vers consomme|ecarte. Tout le reste LÈVE :
-- un signal terminal ne bouge plus (le germe consommé/écarté ne renaît jamais).
create function public.signal_reconceptualisation_garde_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.statut <> 'en_attente' then
    raise exception 'signal_reconceptualisation : un signal % est terminal et ne peut plus changer (anti-résurrection, Story 4.5)', old.statut;
  end if;
  if new.statut not in ('consomme', 'ecarte') then
    raise exception 'signal_reconceptualisation : transition illégale vers % (seules consomme/ecarte, Story 4.5)', new.statut;
  end if;
  return new;
end;
$$;
revoke execute on function public.signal_reconceptualisation_garde_transition() from public, anon, authenticated;
create trigger signal_reconceptualisation_transition
  before update on public.signal_reconceptualisation
  for each row execute function public.signal_reconceptualisation_garde_transition();

-- ── Chemin d'écriture « Oui » : créer la branche + consommer le signal, ATOMIQUEMENT (AC2, AC3) ──────
-- `security invoker` (la branche est possédée sous JWT → RLS + write-gate mordent AUSSI ici). Rôle propre :
-- résoudre l'extrait exact depuis un signal EN ATTENTE possédé (isolation + anti-rejeu) puis faire naître la
-- branche et consommer le germe dans la MÊME transaction. Les gardes de sécurité vivent dans le WITH CHECK
-- de `branche` (atomique) ; le fast-fail AD-17 ci-dessous n'est qu'un message clair + défense en profondeur.
create function public.creer_branche_depuis_signal(p_signal_id uuid, p_nom text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_entree uuid;
begin
  -- (1) [DUR / AD-17] fast-fail (la garantie atomique reste le WITH CHECK de branche).
  if public.branche_bloquee_par_detresse() then
    raise exception 'branche : aucune branche ne naît pendant un épisode de détresse ni dans les 72 h (AD-17, Story 4.5)';
  end if;

  -- (2) résout l'extrait EXACT depuis le signal EN ATTENTE possédé (isolation + anti-rejeu : un signal
  -- consommé/écarté ou d'autrui n'est pas trouvé → LÈVE, jamais de branche volée ni rejouée). `FOR UPDATE`
  -- verrouille la ligne signal (revue 4.5, #7) : un « Non » concurrent (ecarter) ne peut plus s'intercaler
  -- entre la résolution et la consommation → jamais une branche née d'un signal simultanément écarté (AC4).
  select entree_journal_id into v_entree
    from public.signal_reconceptualisation
   where id = p_signal_id
     and utilisatrice_id = (select auth.uid())
     and statut = 'en_attente'
   for update;
  if v_entree is null then
    raise exception 'branche : signal introuvable, non possédé, ou déjà traité (isolation/anti-rejeu, Story 4.5)';
  end if;

  -- (3) [AC2] nom donné par elle — défense en profondeur au-delà du CHECK/policy (même sémantique que .trim()).
  if p_nom is null or not public.branche_nom_significatif(p_nom) then
    raise exception 'branche : une branche sans nom donné par l''utilisatrice n''existe pas (AC2, Story 4.5)';
  end if;

  -- (4) la branche NAÎT (le WITH CHECK re-vérifie AD-17 + appartenance + nom ATOMIQUEMENT). Idempotent :
  -- un retry sur le même moment source ne crée pas de doublon. `btrim` normalise les bords blancs courants.
  insert into public.branche (utilisatrice_id, extrait_source_id, nom, etat)
  values ((select auth.uid()), v_entree, btrim(p_nom, E' \t\n\r\u00a0'), 'naissance')
  on conflict (utilisatrice_id, extrait_source_id) do nothing;

  -- (5) le germe est CONSOMMÉ (le trigger de transition interdit tout retour → jamais rejoué).
  update public.signal_reconceptualisation
     set statut = 'consomme'
   where id = p_signal_id and statut = 'en_attente';
end;
$$;
revoke execute on function public.creer_branche_depuis_signal(uuid, text) from public, anon;
grant  execute on function public.creer_branche_depuis_signal(uuid, text) to authenticated;

-- ── Chemin « Non » : écarter le signal (jamais rejoué, AC4) ──────────────────────────────────────────
create function public.ecarter_signal_reconceptualisation(p_signal_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- en_attente → ecarte. Idempotent (un signal déjà terminal → 0 ligne, aucun effet). Survit à la révocation
  -- (la policy update ne gate pas a_consenti_art9 : rejeter n'est pas déposer du contenu).
  update public.signal_reconceptualisation
     set statut = 'ecarte'
   where id = p_signal_id and utilisatrice_id = (select auth.uid()) and statut = 'en_attente';
end;
$$;
revoke execute on function public.ecarter_signal_reconceptualisation(uuid) from public, anon;
grant  execute on function public.ecarter_signal_reconceptualisation(uuid) to authenticated;

-- ── Lecture de la proposition du LENDEMAIN (AC1 [DUR], AC5) ──────────────────────────────────────────
-- Renvoie le PLUS ANCIEN signal EN ATTENTE d'un jour civil Paris strictement ANTÉRIEUR (jamais sur l'instant)
-- et HORS fenêtre de détresse (FR-042). `security invoker` → la RLS de signal borne à la propriétaire.
-- MINIMISATION art. 9 (revue 4.5, #6/#11) : ne renvoie QUE le pointeur (signal_id + horodatage) — jamais le
-- verbatim `entree_journal.contenu`. La proposition v1 est GÉNÉRIQUE (aucune citation) → aucun art. 9 ne
-- traverse le contrat RPC exposé HTTP. Plus de join : le contenu n'est pas nécessaire.
create function public.charger_proposition_branche()
returns table(signal_id uuid, signal_cree_le timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.id, s.cree_le
  from public.signal_reconceptualisation s
  where s.utilisatrice_id = (select auth.uid())
    and s.statut = 'en_attente'
    -- « le lendemain, jamais sur l'instant » (AC1 [DUR]) : jour civil Europe/Paris strictement antérieur.
    and (s.cree_le at time zone 'Europe/Paris')::date < (now() at time zone 'Europe/Paris')::date
    -- (AC5 / FR-042) : rien proposé pendant un épisode / dans les 72 h.
    and not public.branche_bloquee_par_detresse()
  order by s.cree_le asc
  limit 1;
$$;
revoke execute on function public.charger_proposition_branche() from public, anon;
grant  execute on function public.charger_proposition_branche() to authenticated;

comment on function public.creer_branche_depuis_signal(uuid, text) is
  'Story 4.5 (AC2/AC3) : chemin « Oui », possédé sous JWT (security invoker). Résout l''extrait exact depuis un signal EN ATTENTE possédé (isolation/anti-rejeu), fait naître la branche (etat naissance) et consomme le germe, ATOMIQUEMENT. Gardes AD-17 + appartenance + nom : dans le WITH CHECK de branche.';
comment on function public.charger_proposition_branche() is
  'Story 4.5 (AC1 [DUR]/AC5) : le plus ancien signal en attente d''un jour civil Paris antérieur (jamais l''instant), hors fenêtre de détresse, avec l''extrait exact. security invoker (RLS propriétaire).';
