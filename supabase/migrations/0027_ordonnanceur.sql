-- Migration forward-only — Story 4.8 : la fondation de l'ordonnanceur unique.
--
-- Trois tables, aucune donnée art. 9. C'est une propriété de STRUCTURE, pas de discipline : il n'existe ici
-- aucune colonne capable d'accueillir du contenu. `motif_echec` et `detail` sont bornés à des codes courts
-- (contrainte de longueur) précisément pour qu'on ne puisse pas y déverser un message d'erreur qui aurait
-- ramassé un verbatim au passage (NFR-020/NFR-022).
--
--   • `environnement`   — ce que CETTE base déclare être. Le verrou de l'AC3.
--   • `execution_job`   — qui a fait quoi, dans quelle fenêtre. Le verrou de l'AC2.
--   • `incident_systeme`— ce qui ne tourne plus. Le verrou de l'AC5.
--
-- Toutes les trois sont en deny-by-default (RLS activée + FORCE, aucune policy) : elles n'appartiennent à
-- aucune utilisatrice et aucune session ne doit jamais les voir. Seul `service_role` y accède, depuis le
-- répartiteur côté serveur.

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 1. L'ENVIRONNEMENT DÉCLARÉ — le verrou qui empêche une préversion d'écrire dans la prod (AC3)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- LE SCÉNARIO QU'ON TUE. Une préversion Vercel dont on a collé par erreur l'URL Supabase de PROD dans les
-- variables d'environnement. Tout a l'air de marcher — jusqu'au jour où l'Epic 6 branche la rétention sur
-- cet ordonnanceur, et où un déploiement de test EFFACE des données réelles. Les variables d'environnement
-- ne prouvent rien à l'exécution : elles disent ce qu'on a tapé, pas où on a atterri. Le marqueur, lui, est
-- porté par la base elle-même — on ne peut pas se tromper de base sans que la base le dise.
--
-- La table naît VIDE, et c'est le cœur de la garde. Cf. la revue de la story (défaut n°2) : amorcer `local`
-- ici donnait le même mot aux deux « je ne sais pas » du verrou — celui de la base non promue et celui du
-- déploiement sans `ANIMA_ENV` — donc ils s'accordaient au lieu de se contredire. Sans ligne, une base cloud
-- non promue rend `base_muette` et l'ordonnanceur REFUSE de tourner. Oublier la promotion ne donne plus le
-- droit d'écrire ; ça donne un refus, bruyant et sans effet.
--
-- Le poste local et la CI reçoivent leur marqueur `local` par `supabase/seed.sql`, que `supabase start` et
-- `db reset` jouent après les migrations et qu'un projet cloud ne reçoit jamais.

create table public.environnement (
  id      boolean     primary key default true check (id),  -- ligne UNIQUE : `true` est la seule clé possible
  nom     text        not null check (nom in ('local', 'preview', 'production')),
  fige_le timestamptz not null default now()
);

alter table public.environnement enable row level security;
alter table public.environnement force  row level security;
-- Aucune policy : deny-by-default (patron `probe`/0001).

comment on table public.environnement is
  'Story 4.8 (AC3) : ce que CETTE base déclare être. L''ordonnanceur refuse de tourner si l''environnement du déploiement ne correspond pas. Amorcé à `local` ; un projet cloud doit être explicitement promu. Aucune donnée art. 9.';

-- Le marqueur ne se SUPPRIME pas. Une base sans marqueur ferait tomber la garde dans son repli (« je ne
-- sais pas où je suis » → refus), donc l'invariant tiendrait quand même — mais un refus muet se diagnostique
-- mal, et une erreur franche à la suppression dit tout de suite ce qui a été cassé.
create or replace function public.environnement_indelebile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Environnement : le marqueur ne se supprime pas (Story 4.8, AC3).';
end;
$$;

create trigger environnement_indelebile
  before delete on public.environnement
  for each row execute function public.environnement_indelebile();

revoke execute on function public.environnement_indelebile() from public, anon, authenticated;

-- ── NON RETENU, ET POURQUOI : le cliquet anti-rétrogradation ────────────────────────────────────────────
-- Premier jet : interdire aussi le passage de `production` vers autre chose, par symétrie avec la monotonie
-- de l'arbre (0025). Retiré après examen, pour deux raisons qui vont dans le même sens :
--
--   • La menace n'existe pas. Rétrograder le marqueur exige `service_role` — un rôle qui peut déjà tout
--     faire, y compris supprimer les données directement. Et la conséquence d'une rétrogradation est que la
--     PROD REFUSE DE TOURNER : un échec sûr, bruyant, sans perte. On durcissait un chemin qui échoue déjà
--     bien, pendant que le vrai danger (promouvoir une base de DEV en `production` puis y brancher la prod)
--     restait tout aussi ouvert avec ou sans cliquet.
--
--   • Le coût était une PORTE À SENS UNIQUE dans toute base de test. Un test qui promeut en `production`
--     empoisonne définitivement la base pour tous les tests suivants — et la première chose qu'on aurait
--     faite, c'est ouvrir une trappe pour la rouvrir. Une garde qu'on doit contourner pour se tester est
--     une garde qui finit contournée en production.
--
-- Le verrou réel de l'AC3 n'est pas ici : c'est la comparaison à l'exécution (`lib/ordonnanceur/
-- environnement.ts`), qui elle se teste dans les deux sens sans rien abîmer.

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 2. LES EXÉCUTIONS — la réclamation avec bail (AC2, AC5)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- L'AC2 (« rejoué → idempotent ») et l'AC5 (« réessayable sans double effet ») se contredisent si on les lit
-- vite. Marquer APRÈS le travail : un plantage en cours de route laisse la fenêtre libre, le job rejouera →
-- DOUBLE EFFET. Marquer AVANT : un plantage laisse la ligne coincée « en cours » → la fenêtre n'est JAMAIS
-- réessayée. La sortie est le BAIL : on réclame avant, on clôt après, et une ligne `en_cours` dont le bail a
-- expiré redevient réclamable. Un plantage franc coûte au plus un bail d'attente.
--
-- Une ligne `reussi` n'est JAMAIS re-réclamable. C'est là, et nulle part ailleurs, que vit l'idempotence de
-- la fenêtre.

create table public.execution_job (
  id             uuid        primary key default gen_random_uuid(),
  job            text        not null,
  fenetre        text        not null,                       -- clé déterministe : `2026-08-05`, `2026-W32`
  cible_id       uuid        references public.utilisatrice(id) on delete cascade,  -- null = job global
  statut         text        not null check (statut in ('en_cours', 'reussi', 'echoue')),
  tentatives     integer     not null default 1,
  bail_expire_le timestamptz not null,
  commence_le    timestamptz not null default now(),
  termine_le     timestamptz,
  motif_echec    text,
  -- Un CODE, jamais un message. La borne est ce qui rend l'absence d'art. 9 structurelle plutôt que polie.
  constraint execution_job_motif_court check (motif_echec is null or length(motif_echec) <= 120)
);

-- ⚠️ `nulls not distinct` (PostgreSQL 15+, ici 17.6) est INDISPENSABLE. Par défaut Postgres considère deux
-- `null` comme distincts : sans cette clause, l'index ne dédoublonnerait RIEN pour les jobs globaux
-- (`cible_id is null`) et un job global s'exécuterait autant de fois qu'il y a de ticks. C'est le genre de
-- faille invisible en test unitaire et visible une seule fois, en production.
create unique index execution_job_cle
  on public.execution_job (job, fenetre, cible_id) nulls not distinct;

create index execution_job_reussite_idx
  on public.execution_job (job, termine_le desc) where (statut = 'reussi');
create index execution_job_cible_idx on public.execution_job (cible_id) where (cible_id is not null);

alter table public.execution_job enable row level security;
alter table public.execution_job force  row level security;

comment on table public.execution_job is
  'Story 4.8 (AC2/AC5) : trace d''exécution des jobs de l''ordonnanceur unique. Idempotence par (job, fenetre, cible_id) — une ligne `reussi` n''est jamais re-réclamable. Deny-by-default : service_role uniquement. NON-art. 9 : aucune colonne de contenu ; `motif_echec` borné à 120 caractères. `cible_id` en cascade pour FR-067.';

-- ── La RÉCLAMATION : atomique, avec bail ────────────────────────────────────────────────────────────────
-- Renvoie `true` si l'appelant a le droit d'exécuter, `false` si quelqu'un d'autre l'a déjà fait (ou le fait
-- en ce moment). Un seul aller-retour, une seule décision, un seul endroit — c'est pourquoi le domaine pur
-- ne comporte volontairement PAS de fonction `estDu` : elle ferait la même décision une deuxième fois.
create or replace function public.reclamer_execution(
  p_job           text,
  p_fenetre       text,
  p_cible_id      uuid,
  p_bail_secondes integer
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reclame boolean;
begin
  insert into public.execution_job (job, fenetre, cible_id, statut, bail_expire_le)
  values (p_job, p_fenetre, p_cible_id, 'en_cours', now() + make_interval(secs => p_bail_secondes))
  on conflict (job, fenetre, cible_id) do update
    set statut         = 'en_cours',
        tentatives     = public.execution_job.tentatives + 1,
        bail_expire_le = now() + make_interval(secs => p_bail_secondes),
        commence_le    = now(),
        termine_le     = null,
        motif_echec    = null
    -- Les DEUX seuls cas où l'on reprend la main : l'exécution précédente a échoué, ou elle est morte en
    -- cours de route (bail expiré). Le cas `reussi` n'apparaît pas — c'est l'idempotence.
    where public.execution_job.statut = 'echoue'
       or (public.execution_job.statut = 'en_cours' and public.execution_job.bail_expire_le < now())
  returning true into v_reclame;

  -- `returning … into` laisse NULL quand le `where` du DO UPDATE exclut la ligne : zéro ligne affectée.
  return coalesce(v_reclame, false);
end;
$$;

revoke execute on function public.reclamer_execution(text, text, uuid, integer) from public, anon, authenticated;

create or replace function public.clore_execution(
  p_job      text,
  p_fenetre  text,
  p_cible_id uuid,
  p_reussi   boolean,
  p_motif    text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.execution_job
     set statut      = case when p_reussi then 'reussi' else 'echoue' end,
         termine_le  = now(),
         -- `left(…, 120)` TRONQUE au lieu de laisser la contrainte lever : un motif trop long est une
         -- maladresse d'appelant, pas une raison de perdre la trace de l'échec qu'on essayait d'écrire.
         motif_echec = case when p_reussi then null else left(coalesce(p_motif, 'inconnu'), 120) end
   where job = p_job
     and fenetre = p_fenetre
     and cible_id is not distinct from p_cible_id;  -- `is not distinct from` : `null = null` vaut vrai ici
end;
$$;

revoke execute on function public.clore_execution(text, text, uuid, boolean, text) from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 3. LES INCIDENTS SYSTÈME — l'alerte de santé (AC5)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- Une alerte par job et par jour. Sans cette dédup, un job mort produirait une ligne à chaque tick et
-- l'information « ce job est mort » se noierait dans sa propre répétition.

create table public.incident_systeme (
  id      uuid        primary key default gen_random_uuid(),
  -- Deux types, et pas un de plus. Le désaccord d'environnement n'en est PAS un : quand le répartiteur
  -- conclut qu'il n'est peut-être pas dans la bonne base, il n'y écrit rien — pas même une plainte.
  -- Cf. `lib/ordonnanceur/executer.ts`.
  type    text        not null check (type in ('job_en_retard', 'job_echoue')),
  job     text        not null,
  detail  text,
  -- `date_trunc(text, timestamptz)` est STABLE, pas IMMUTABLE : impossible dans un index d'expression.
  -- D'où une vraie colonne, remplie par défaut avec le jour civil de Paris.
  jour    date        not null default ((now() at time zone 'Europe/Paris')::date),
  cree_le timestamptz not null default now(),
  constraint incident_systeme_detail_court check (detail is null or length(detail) <= 200)
);

create unique index incident_systeme_dedup on public.incident_systeme (type, job, jour);
create index        incident_systeme_jour_idx on public.incident_systeme (jour desc);

alter table public.incident_systeme enable row level security;
alter table public.incident_systeme force  row level security;

comment on table public.incident_systeme is
  'Story 4.8 (AC5) : alertes de santé de l''ordonnanceur. Dédup une par (type, job, jour Paris). Deny-by-default. NON-art. 9 : `job` est un identifiant technique, `detail` un code borné à 200 caractères — jamais de contenu utilisatrice.';

create or replace function public.lever_incident(
  p_type   text,
  p_job    text,
  p_detail text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.incident_systeme (type, job, detail)
  values (p_type, p_job, left(coalesce(p_detail, ''), 200))
  on conflict (type, job, jour) do nothing;
end;
$$;

revoke execute on function public.lever_incident(text, text, text) from public, anon, authenticated;

-- ── L'ÉTAT, en un aller-retour ──────────────────────────────────────────────────────────────────────────
-- Le job de santé a besoin de deux choses : la dernière réussite de chaque job, et la NAISSANCE du système
-- (l'exécution la plus ancienne connue, tous jobs confondus — voir `estEnRetard` pour ce qu'elle résout).
-- Les agréger ici plutôt que de rapatrier les lignes évite que le coût de la santé croisse avec l'historique.
create or replace function public.etat_ordonnanceur()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'naissance', (select min(commence_le) from public.execution_job),
    'reussites', coalesce(
      (select jsonb_object_agg(t.job, t.derniere)
         from (select job, max(termine_le) as derniere
                 from public.execution_job
                where statut = 'reussi'
             group by job) t),
      '{}'::jsonb)
  );
$$;

revoke execute on function public.etat_ordonnanceur() from public, anon, authenticated;

-- ── L'ÉTAT PUBLIC : un mot, et rien d'autre ─────────────────────────────────────────────────────────────
-- `/api/health` est une route PUBLIQUE et non authentifiée. Ce qui y transite doit être inutile à qui la
-- sonde. Cette fonction ne renvoie pas un objet qu'on filtrerait ensuite côté route — elle renvoie UN MOT.
-- La discrétion est ainsi portée par la signature : la route ne peut pas en dire plus, même par accident.
create or replace function public.sante_ordonnanceur_publique()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.incident_systeme
                  where jour >= ((now() at time zone 'Europe/Paris')::date - 1))
    then 'degrade' else 'ok' end;
$$;

revoke execute on function public.sante_ordonnanceur_publique() from public, anon, authenticated;
