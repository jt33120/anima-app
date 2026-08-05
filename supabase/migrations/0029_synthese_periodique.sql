-- Migration forward-only — Story 4.9 : la synthèse périodique.
--
-- Deux tables et cinq fonctions. Ce que la base garantit ici, et que le TypeScript ne peut pas garantir :
--
--   • UNE synthèse par utilisatrice et par semaine ISO (index unique) — c'est là que vit l'absence de
--     double effet, pas dans le job ;
--   • le matériau lu est TOUJOURS hors détresse (AC3, AD-17) et TOUJOURS sans tombstone (AD-18), parce que
--     la clause vit dans la fonction et non chez l'appelant ;
--   • le plafond d'une notification par 72 h ne peut pas être dépassé, même par deux appels simultanés
--     (verrou consultatif par utilisatrice).
--
-- Art. 9 : `synthese.contenu` EN EST (c'est le récit de sa vie intérieure). Il est donc protégé comme le
-- journal — lecture propriétaire seule, aucune écriture sous JWT, cascade à l'effacement (FR-067).
-- `notification_envoyee`, elle, n'en porte pas : un motif dans un ensemble fermé et une clé de période.

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 1. LA SYNTHÈSE — une par personne et par semaine ISO (AC1, AC2)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════

create table public.synthese (
  id              uuid        primary key default gen_random_uuid(),
  utilisatrice_id uuid        not null references public.utilisatrice(id) on delete cascade,
  -- La CLÉ D'IDEMPOTENCE : `2026-W32`, la même que celle du domaine (`fenetreDe("hebdomadaire", …)`).
  -- Elle n'est PAS la période racontée : celle-ci va de la dernière synthèse à maintenant, et peut donc
  -- couvrir plusieurs semaines si un tick a été manqué (décision D2 — aucun trou définitif).
  semaine         text        not null,
  periode_debut   timestamptz not null,
  periode_fin     timestamptz not null,
  contenu         text        not null,               -- art. 9 : le récit. Bloc document (titres, listes).
  -- Le plafond de volume a-t-il mordu ? La synthèse le DIT plutôt que de faire comme si de rien n'était.
  tronquee        boolean     not null default false,
  cree_le         timestamptz not null default now(),
  constraint synthese_periode_coherente check (periode_fin > periode_debut),
  constraint synthese_contenu_non_vide  check (length(btrim(contenu)) > 0)
);

-- L'invariant central de la story. Sans lui, un rejeu du job — ou une clôture perdue, le résidu assumé de
-- la 4.8 — produirait une SECONDE synthèse pour la même semaine.
create unique index synthese_cle on public.synthese (utilisatrice_id, semaine);
create index synthese_recente on public.synthese (utilisatrice_id, periode_fin desc);

alter table public.synthese enable row level security;
alter table public.synthese force  row level security;

-- Lecture propriétaire seule. AUCUNE policy d'écriture : la synthèse est produite par l'ordonnanceur sous
-- `service_role`, jamais par une session. Une utilisatrice ne peut donc ni forger, ni corriger, ni effacer
-- sa synthèse — l'effacement passera par FR-067 (Epic 6), qui est un chemin gardé, pas un bouton.
create policy synthese_proprietaire_lecture on public.synthese
  for select
  using (auth.uid() = utilisatrice_id);

comment on table public.synthese is
  'Story 4.9 (FR-066) : récapitulatif périodique rédigé par le modèle FORT. Une par (utilisatrice, semaine ISO) — l''index unique EST l''absence de double effet. `contenu` est de l''art. 9 : lecture propriétaire, aucune écriture sous JWT, cascade FR-067. La période racontée va de la dernière synthèse à maintenant (D2), donc `semaine` est une clé, pas un intervalle.';

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 2. LES NOTIFICATIONS ENVOYÉES — le plafond, générique dès maintenant (AC4)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- Le PO a tranché le canal courriel dès cette story, alors qu'un seul motif existe. La réserve du dev était
-- qu'un plafond « une notification / 72 h » écrit pour un motif unique serait à refaire à l'Epic 6, quand
-- FR-033 (socle quotidien) et FR-034 (rappels d'échéance) arriveront. D'où ce choix : le mécanisme est
-- GÉNÉRIQUE tout de suite, et l'ensemble des motifs est fermé par une contrainte. L'Epic 6 ajoutera une
-- valeur au CHECK — pas un mécanisme.
--
-- Aucun art. 9 possible ici, par structure : il n'existe aucune colonne de contenu. `motif` est une
-- énumération, `cle` une clé de période (`2026-W32`).

create table public.notification_envoyee (
  id              uuid        primary key default gen_random_uuid(),
  utilisatrice_id uuid        not null references public.utilisatrice(id) on delete cascade,
  motif           text        not null check (motif in ('synthese_prete')),
  cle             text        not null,
  envoye_le       timestamptz not null default now(),
  constraint notification_cle_courte check (length(cle) <= 40)
);

-- Idempotence : le MÊME motif pour la MÊME période ne part qu'une fois, même si le job repasse demain.
create unique index notification_envoyee_cle on public.notification_envoyee (utilisatrice_id, motif, cle);
-- Le plafond : « la dernière notification, tous motifs confondus, date-t-elle de moins de 72 h ? »
create index notification_envoyee_recente on public.notification_envoyee (utilisatrice_id, envoye_le desc);

alter table public.notification_envoyee enable row level security;
alter table public.notification_envoyee force  row level security;
-- Aucune policy : deny-by-default. C'est une trace opérationnelle, pas un contenu.

comment on table public.notification_envoyee is
  'Story 4.9 (AC4/FR-035) : trace des notifications parties, tous motifs confondus. Sert à DEUX choses distinctes — l''idempotence par (motif, clé de période) et le plafond d''une notification / 72 h. Ensemble de motifs FERMÉ par contrainte : l''Epic 6 y ajoutera FR-033 et FR-034. Deny-by-default, NON-art. 9 (aucune colonne de contenu).';

-- ── La RÉSERVATION du canal : atomique, plafond compris ─────────────────────────────────────────────────
-- Renvoie `true` si l'appelant a le droit d'envoyer. Le nom dit ce qu'il fait : on RÉSERVE avant d'envoyer,
-- exactement comme l'ordonnanceur réclame avant d'exécuter. Réserver après l'envoi laisserait la fenêtre
-- ouverte entre les deux — et cette fenêtre-là s'appelle « un deuxième courriel ».
--
-- Le verrou consultatif n'est pas décoratif. Sans lui, deux appels simultanés pour la même personne
-- passeraient tous deux le `not exists` (aucun n'ayant encore inséré) et deux courriels partiraient dans la
-- même seconde : l'index unique ne les arrêterait pas, leurs clés étant différentes. Le plafond serait
-- alors une intention, pas une garantie. Le verrou est de TRANSACTION : PostgREST en ouvre une par appel,
-- il se relâche donc tout seul.
create or replace function public.reserver_notification(
  p_utilisatrice    uuid,
  p_motif           text,
  p_cle             text,
  p_plafond_heures  integer
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reserve boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_utilisatrice::text, 0));

  insert into public.notification_envoyee (utilisatrice_id, motif, cle)
  select p_utilisatrice, p_motif, p_cle
   where not exists (
           select 1 from public.notification_envoyee n
            where n.utilisatrice_id = p_utilisatrice
              and n.envoye_le > now() - make_interval(hours => p_plafond_heures)
         )
  on conflict (utilisatrice_id, motif, cle) do nothing
  returning true into v_reserve;

  -- `returning … into` laisse NULL quand rien n'est inséré — que ce soit par le plafond (le `where`) ou
  -- par l'idempotence (le `on conflict`). Les deux veulent dire « n'envoie pas », et c'est tout ce que
  -- l'appelant a besoin de savoir.
  return coalesce(v_reserve, false);
end;
$$;

revoke execute on function public.reserver_notification(uuid, text, text, integer) from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 3. LE MATÉRIAU — là où vivent AC3 (détresse) et AD-18 (tombstones)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- L'AC3 demande littéralement que l'exclusion se fasse « par une clause sur `episode_detresse` ». Le
-- raisonnement derrière cette exigence : un filtre écrit en TypeScript s'oublie au premier appelant
-- suivant. Une clause dans la fonction qui LIT le matériau ne peut pas être contournée — il n'existe
-- aucun autre chemin de lecture pour le job.
--
-- LA BONNE LECTURE DE « EXCLURE LES ÉPISODES ». Deux interprétations, une seule juste :
--   ❌ exclure les UTILISATRICES ayant vécu un épisode → ce serait punir celle qui a le plus traversé,
--      en la privant seule de sa relecture ;
--   ✅ exclure les ENTRÉES tombées DANS l'intervalle d'un épisode → l'épisode est une parenthèse, on
--      l'enjambe. La phrase reste au journal ; elle ne nourrit simplement pas le récit.
--
-- Un épisode OUVERT (`fin is null`) exclut jusqu'à maintenant. C'est le repli sûr (AD-15) : tant qu'on
-- n'est pas sorti, rien de cette traversée n'alimente quoi que ce soit. Et s'il ne reste alors rien
-- d'éligible, aucune synthèse n'est produite — donc aucun courriel. Rien ne naît pendant la détresse (AD-17).
create or replace function public.entrees_hors_detresse(
  p_utilisatrice uuid,
  p_depuis       timestamptz,
  p_jusqu_a      timestamptz
) returns setof public.entree_journal
language sql
stable
security definer
set search_path = ''
as $$
  select j.*
    from public.entree_journal j
   where j.utilisatrice_id = p_utilisatrice
     and (p_depuis is null or j.cree_le > p_depuis)
     and j.cree_le <= p_jusqu_a
     and not exists (
           select 1 from public.episode_detresse e
            where e.utilisatrice_id = j.utilisatrice_id
              and j.cree_le >= e.debut
              and j.cree_le <= coalesce(e.fin, now())
         );
$$;

revoke execute on function public.entrees_hors_detresse(uuid, timestamptz, timestamptz) from public, anon, authenticated;

-- ── Le matériau complet, en un aller-retour ─────────────────────────────────────────────────────────────
-- `depuis` = la fin de la DERNIÈRE synthèse, jamais « il y a sept jours » (D2) : un tick manqué ne doit
-- pas creuser un trou définitif dans le récit. `null` pour la toute première — la fonction rend alors tout
-- le journal éligible, et c'est l'appelant qui datera le début sur la plus ancienne entrée GARDÉE.
--
-- `tronquee` dit que le plafond de volume a mordu. Il mord par le PLUS ANCIEN (on garde le récent), et le
-- dire est ce qui distingue une synthèse honnête d'une synthèse qui prétend couvrir ce qu'elle n'a pas lu.
create or replace function public.materiau_synthese(
  p_utilisatrice    uuid,
  p_plafond_entrees integer
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_depuis  timestamptz;
  v_jusqu_a timestamptz := now();
  v_total   integer;
  v_entrees jsonb;
  v_faits   jsonb;
begin
  select max(s.periode_fin) into v_depuis
    from public.synthese s where s.utilisatrice_id = p_utilisatrice;

  select count(*) into v_total
    from public.entrees_hors_detresse(p_utilisatrice, v_depuis, v_jusqu_a);

  select coalesce(
           jsonb_agg(jsonb_build_object('role', g.role, 'contenu', g.contenu, 'cree_le', g.cree_le)
                     order by g.cree_le),
           '[]'::jsonb)
    into v_entrees
    from (select e.role, e.contenu, e.cree_le
            from public.entrees_hors_detresse(p_utilisatrice, v_depuis, v_jusqu_a) e
           order by e.cree_le desc
           limit p_plafond_entrees) g;

  -- AD-18 : `statut = 'actif'` SEUL. Un tombstone (`corrige`/`supprime`) occupe la clé et son contenu a
  -- été vidé — le lire puis filtrer côté appelant produirait des lignes vides aujourd'hui, et le retour
  -- d'un fait corrigé dans le prompt du modèle le jour où quelqu'un oublie le filtre.
  select coalesce(jsonb_agg(f.contenu order by f.maj_le), '[]'::jsonb)
    into v_faits
    from public.fait_extrait f
   where f.utilisatrice_id = p_utilisatrice
     and f.statut = 'actif';

  return jsonb_build_object(
    'depuis',   v_depuis,
    'jusqu_a',  v_jusqu_a,
    'total',    v_total,
    'tronquee', v_total > p_plafond_entrees,
    'entrees',  v_entrees,
    'faits',    v_faits
  );
end;
$$;

revoke execute on function public.materiau_synthese(uuid, integer) from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 4. QUI SYNTHÉTISER — l'entitlement premium et le socle gratuit intact (AC5)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- Les quatre conditions sont réunies ICI, en une seule requête, et pas dispersées dans le job : c'est ce
-- qui rend l'AC5 vérifiable d'un seul test. `a_consenti_art9()` et `est_barre_minorite()` ne sont pas
-- utilisables — elles lisent `auth.uid()`, et l'ordonnanceur n'a pas de session. Leurs prédicats sont donc
-- réécrits ici pour une utilisatrice donnée ; un test compare les deux chemins pour qu'ils ne divergent pas.
--
-- L'ORDRE N'EST PAS COSMÉTIQUE. Le lot est borné (une lambda de 60 s, un appel au modèle fort par
-- personne) : trier par identifiant ou par date d'inscription servirait toujours les mêmes premières et
-- affamerait les dernières. On sert donc celle qui a attendu le plus longtemps — `nulls first`, c'est-à-dire
-- celle qui n'a jamais rien reçu.
create or replace function public.utilisatrices_a_synthetiser(
  p_semaine text,
  p_limite  integer
) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(c.id order by c.attente nulls first), '[]'::jsonb)
    from (
      select u.id,
             (select max(s.periode_fin) from public.synthese s where s.utilisatrice_id = u.id) as attente
        from public.utilisatrice u
        join public.abonnement a
          on a.utilisatrice_id = u.id and a.etat = 'actif'          -- AC5 : premium, et seulement premium
       where u.barriere_minorite_le is null                          -- barrière minorité (0006)
         and exists (select 1 from public.consentement k
                      where k.utilisatrice_id = u.id
                        and k.art9_accorde = true
                        and k.ia_reconnue  = true
                        and k.revoked_at is null)                    -- consentement art. 9 vivant (0005)
         and not exists (select 1 from public.synthese s
                          where s.utilisatrice_id = u.id and s.semaine = p_semaine)
         -- D3 : « rien à dire » = aucune entrée ÉLIGIBLE (donc hors détresse) depuis la dernière synthèse.
         -- Des faits anciens ne suffisent pas : ils ont déjà été racontés.
         and exists (select 1 from public.entrees_hors_detresse(
                       u.id,
                       (select max(s2.periode_fin) from public.synthese s2 where s2.utilisatrice_id = u.id),
                       now()))
       order by attente nulls first
       limit p_limite
    ) c;
$$;

revoke execute on function public.utilisatrices_a_synthetiser(text, integer) from public, anon, authenticated;

-- ── L'ÉCRITURE ──────────────────────────────────────────────────────────────────────────────────────────
-- Renvoie `false` si une synthèse existait déjà pour cette semaine : l'appelant apprend ainsi qu'il n'a
-- rien produit de neuf, et n'enchaîne donc PAS sur la notification.
create or replace function public.enregistrer_synthese(
  p_utilisatrice uuid,
  p_semaine      text,
  p_debut        timestamptz,
  p_fin          timestamptz,
  p_contenu      text,
  p_tronquee     boolean
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ecrit boolean;
begin
  insert into public.synthese (utilisatrice_id, semaine, periode_debut, periode_fin, contenu, tronquee)
  values (p_utilisatrice, p_semaine, p_debut, p_fin, p_contenu, coalesce(p_tronquee, false))
  on conflict (utilisatrice_id, semaine) do nothing
  returning true into v_ecrit;

  return coalesce(v_ecrit, false);
end;
$$;

revoke execute on function public.enregistrer_synthese(uuid, text, timestamptz, timestamptz, text, boolean)
  from public, anon, authenticated;
