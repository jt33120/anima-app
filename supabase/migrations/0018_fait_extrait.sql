-- Migration forward-only — Story 4.2 : `fait_extrait`, couche 2 de la mémoire (AD-8).
--
-- Un PROFIL VIVANT de faits en clair (art. 9), POSSÉDÉ par l'utilisatrice sous JWT (jamais service_role
-- applicatif, AD-12), IDEMPOTENT par une clé de dédoublonnage stable, et À L'ÉPREUVE DES RÉSURRECTIONS
-- (AD-18) : un fait que l'utilisatrice corrige ou supprime n'est JAMAIS réécrit par une ré-extraction.
--
-- Variance vs `entree_journal` (0016, immuable append-only) : les faits sont VIVANTS — l'utilisatrice
--   CORRIGE et SUPPRIME (FR-063/FR-064). Donc trois policies (select + insert + UPDATE), soft-delete
--   (aucune policy delete sous JWT), et un trigger de GARDE (pas d'immuabilité) qui refuse SEULEMENT la
--   résurrection auto.
--
-- Défense en profondeur anti-résurrection (le cœur, AC3 [DUR]) — même esprit que l'immuabilité du journal :
--   1. la clause `WHERE` de l'upsert auto → chemin normal = NO-OP silencieux sur tombstone/fait utilisatrice ;
--   2. le trigger `fait_extrait_no_resurrection` → le VRAI filet : toute écriture `origine='extrait'` sur un
--      fait qui n'est pas lui-même `extrait`+`actif` LÈVE (y compris service_role, que la RLS ne borne pas).
--   3. la suppression est un SOFT-DELETE (`statut='supprime'`) : un DELETE dur libérerait la clé → résurrection
--      à la ré-extraction. Seul l'effacement FR-067 (service_role, Epic 6) supprime des lignes.
--
-- Cadrage PO « réceptacle d'abord » : l'INTELLIGENCE d'extraction (prompt LLM, tiering, passe FORT) est
--   DIFFÉRÉE (Story 4.4). Ici : la table, le write-gate, la garde, et l'unique fonction de merge possédée.

create table public.fait_extrait (
  id                uuid        primary key default gen_random_uuid(),
  utilisatrice_id   uuid        not null references public.utilisatrice(id) on delete cascade,
  origine           text        not null check (origine in ('extrait', 'utilisatrice')),
  statut            text        not null default 'actif' check (statut in ('actif', 'corrige', 'supprime')),
  cle_dedoublonnage text        not null,               -- clé stable OPAQUE (jamais de contenu en clair, art. 9-safe)
  contenu           text        not null,               -- la phrase « Ce qu'Anam retient » (art. 9) ; vidée au tombstone (point b)
  extrait_source_id uuid        references public.entree_journal(id) on delete set null,  -- le message exact (AC1/AC5)
  cree_le           timestamptz not null default now(),
  maj_le            timestamptz not null default now()
);

-- Idempotence (AC2) : une info = UNE ligne par utilisatrice. Le tombstone occupe la clé → pas de résurrection.
create unique index fait_extrait_dedoublonnage_unique
  on public.fait_extrait (utilisatrice_id, cle_dedoublonnage);
-- Rappel/synthèse futurs (Epic 4) : ne lire que les faits `actif`.
create index fait_extrait_utilisatrice_idx
  on public.fait_extrait (utilisatrice_id, statut);

alter table public.fait_extrait enable row level security;
alter table public.fait_extrait force  row level security;

-- Lecture propriétaire : `using` ouvert au propriétaire → export FR-067 + SURVIT à la révocation.
create policy fait_extrait_lecture on public.fait_extrait
  for select
  using (auth.uid() = utilisatrice_id);

-- Insertion write-gatée DURCIE — COPIE du gabarit `entree_journal`/0016 (leçon F1 : consentement ART. 9
-- valide/non révoqué ET compte NON barré-minorité). L'extraction auto n'écrit QUE sous consentement actif.
create policy fait_extrait_insertion on public.fait_extrait
  for insert
  with check (auth.uid() = utilisatrice_id
              and public.a_consenti_art9()
              and not public.est_barre_minorite());

-- Mise à jour propriétaire — la correction/suppression est une écriture de contenu par l'utilisatrice.
-- La policy reste SANS `a_consenti_art9()` (elle ne voit pas OLD → ne distingue pas « vider » de « déposer du
-- neuf ») : la distinction fine du point (a) vit dans le TRIGGER (revue 4.2) — la SUPPRESSION (vider, contenu='')
-- survit à la révocation (droit à l'effacement RGPD art. 17) ; la CORRECTION (déposer un contenu non vide et
-- nouveau) exige un consentement valide (AD-13). Ici, gaté propriétaire ET `not est_barre_minorite()` (0006).
create policy fait_extrait_maj on public.fait_extrait
  for update
  using      (auth.uid() = utilisatrice_id)
  with check (auth.uid() = utilisatrice_id
              and not public.est_barre_minorite());
-- AUCUNE policy `delete` sous JWT → soft-delete (statut='supprime'). L'effacement FR-067 = service_role (Epic 6).

-- ── Garde anti-résurrection (AC3 [DUR]) — le vrai filet, même service_role (que la RLS ne borne pas) ──
-- Complément EXACT de la clause `WHERE` de l'upsert auto : une écriture `origine='extrait'` ne peut viser
-- QUE un fait lui-même `extrait`+`actif`. Toute autre cible (tombstone corrige/supprime, ou fait possédé
-- par l'utilisatrice) LÈVE → la ré-extraction ne ressuscite jamais ce que l'utilisatrice possède.
create or replace function public.fait_extrait_garde_resurrection()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- (1) ANTI-RÉSURRECTION (AD-18) : une écriture auto ne peut viser qu'un fait déjà `extrait`+`actif`.
  if new.origine = 'extrait'
     and not (old.origine = 'extrait' and old.statut = 'actif') then
    raise exception 'fait_extrait : une ré-extraction ne ressuscite jamais un fait possédé par l''utilisatrice (AD-18, Story 4.2)';
  end if;
  -- (2) WRITE-GATE ART.9 SUR LE DÉPÔT DE CONTENU (AD-13, revue 4.2) : déposer un contenu NON VIDE et NOUVEAU
  -- (correction, ré-activation) exige un consentement valide et non révoqué — MÊME sur une ligne existante
  -- (la policy UPDATE ne le voit pas ; le trigger, si). VIDER (suppression, contenu='') SURVIT à la révocation
  -- (droit à l'effacement RGPD art. 17, point (a) validé PO). Ne s'applique qu'aux écritures UTILISATRICE
  -- (auth.uid() non nul) — service_role (tâches système, jamais d'écriture de contenu applicative) est exempt.
  if (select auth.uid()) is not null
     and new.contenu <> '' and new.contenu is distinct from old.contenu
     and not public.a_consenti_art9() then
    raise exception 'fait_extrait : déposer un contenu art. 9 (correction) exige un consentement valide et non révoqué (AD-13, Story 4.2)';
  end if;
  return new;
end;
$$;

-- Durcissement EXECUTE (convention 0007) : fonction-trigger, jamais appelée à la main → on retire le grant
-- automatique Supabase à tous les rôles clients (le trigger s'exécute indépendamment du privilège execute).
revoke execute on function public.fait_extrait_garde_resurrection() from public, anon, authenticated;

create trigger fait_extrait_no_resurrection
  before update on public.fait_extrait
  for each row execute function public.fait_extrait_garde_resurrection();

-- ── Fonction de merge POSSÉDÉE (AC4) — le SEUL chemin d'écriture, sous JWT ──────────────────────────
-- `security INVOKER` (≠ la RPC détresse en `definer`) : `fait_extrait` est possédé sous JWT → on NE veut
-- PAS contourner la RLS ; on veut qu'elle ET le write-gate mordent AUSSI dans la fonction. Porte l'upsert
-- conditionnel que `supabase-js .upsert()` ne sait pas exprimer (ON CONFLICT DO UPDATE … WHERE).
--
--   • chemin AUTO (`p_origine='extrait'`) : upsert idempotent ; le `where` rend la ré-extraction d'un
--     tombstone/fait utilisatrice un NO-OP silencieux (AC2/AC3). Gaté consentement via la policy INSERT.
--   • chemin UTILISATRICE (`p_origine='utilisatrice'`, corriger/supprimer) : UPDATE SIMPLE d'un fait
--     EXISTANT. Ne dépend PAS de la policy INSERT (donc PAS du consentement) → survit à la révocation
--     (point (a)). Un `INSERT … ON CONFLICT` aurait forcé la policy INSERT même sur la branche update.
create function public.fusionner_fait_extrait(
  p_origine text, p_statut text, p_cle text, p_contenu text, p_extrait_source uuid
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_origine = 'extrait' then
    -- ISOLATION (revue 4.2, D) : le lien source doit appartenir à L'APPELANTE — sinon un fait pointerait
    -- vers le journal d'autrui (intégrité inter-tenant + oracle d'existence d'UUID). Sous security invoker
    -- la RLS masque déjà le journal d'autrui, mais on l'exige EXPLICITEMENT (défense en profondeur).
    if p_extrait_source is not null and not exists (
      select 1 from public.entree_journal
      where id = p_extrait_source and utilisatrice_id = (select auth.uid())
    ) then
      raise exception 'fait_extrait : extrait_source doit appartenir à l''utilisatrice (isolation, AC1/AC5)';
    end if;
    insert into public.fait_extrait
      (utilisatrice_id, origine, statut, cle_dedoublonnage, contenu, extrait_source_id)
    values ((select auth.uid()), 'extrait', 'actif', p_cle, p_contenu, p_extrait_source)
    on conflict (utilisatrice_id, cle_dedoublonnage)
    -- Rafraîchit le contenu ET sa source (revue 4.2, B) : la provenance suit le tour d'où vient la phrase
    -- courante (AC1 « le message exact »), jamais figée sur la première extraction. NO-OP sur tombstone/utilisatrice.
    do update set contenu = excluded.contenu, extrait_source_id = excluded.extrait_source_id, maj_le = now()
    where fait_extrait.origine = 'extrait' and fait_extrait.statut = 'actif';
  else
    -- corriger / supprimer : le fait EXISTE déjà (UI liste des faits). UPDATE simple → survit à la révocation
    -- pour la SUPPRESSION ; la CORRECTION (contenu non vide) est gatée consentement par le trigger (revue 4.2, A).
    -- Le chemin utilisatrice ne pose QUE corrige/supprime — jamais 'actif' (pas de ré-activation forgée, revue 4.2, A).
    if p_statut not in ('corrige', 'supprime') then
      raise exception 'fait_extrait : le chemin utilisatrice ne pose que corrige/supprime (Story 4.2)';
    end if;
    update public.fait_extrait
       set origine = 'utilisatrice',
           statut  = p_statut,
           contenu = p_contenu,
           maj_le  = now()
     where utilisatrice_id = (select auth.uid())
       and cle_dedoublonnage = p_cle;
  end if;
end;
$$;

revoke execute on function public.fusionner_fait_extrait(text, text, text, text, uuid) from public, anon;
grant  execute on function public.fusionner_fait_extrait(text, text, text, text, uuid) to authenticated;

comment on table public.fait_extrait is
  'Faits extraits (AD-8, couche 2) : profil vivant de faits en clair (art. 9), possédé sous JWT (jamais service_role applicatif), corrigeable/supprimable par l''utilisatrice. Idempotent par (utilisatrice_id, cle_dedoublonnage) ; à l''épreuve des résurrections (AD-18) : soft-delete + trigger `fait_extrait_no_resurrection` + clause WHERE de `fusionner_fait_extrait`. `extrait_source_id` → entree_journal(id) (message exact, AC5 de 4.1). Effacement FR-067 = service_role (Epic 6).';
comment on column public.fait_extrait.cle_dedoublonnage is
  'Story 4.2 (AD-18) : clé de dédoublonnage STABLE et OPAQUE (jamais de contenu art. 9 en clair) — une info = une ligne. Le tombstone (statut supprime/corrige) OCCUPE la clé → une ré-extraction ne ressuscite pas.';
