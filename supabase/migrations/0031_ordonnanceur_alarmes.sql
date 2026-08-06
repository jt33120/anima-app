-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 0031 — REVUE ADVERSARIALE 4.9, LOT B : les alarmes qui ne sonnent plus, et celle qui sonne pour rien
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- La 4.8 avait construit une observation : « un job qui ne tourne plus finit par le dire ». La 4.9 l'a
-- cassée sans y toucher — en ajoutant simplement le premier job qui écrit des lignes par PERSONNE. Trois
-- corrections ici, plus un disjoncteur.
--
-- Le fil commun mérite d'être nommé : une alarme ne se casse presque jamais en cessant de fonctionner.
-- Elle se casse en devenant vraie tout le temps, ou fausse tout le temps. Les deux premières corrections
-- sont exactement ces deux cas-là.

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 1. « LA DERNIÈRE RÉUSSITE DU JOB » avait cessé de vouloir dire ça
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- `etat_ordonnanceur` agrège `max(termine_le) group by job`. En 4.8 c'était exact : il existait exactement
-- UNE ligne par (job, fenêtre), avec `cible_id = null`. La 4.9 écrit, sous le MÊME `job`, une ligne par
-- personne servie.
--
-- Conséquence, vérifiée : le fan-out échoue (timeout), mais trois personnes ont été servies avant la
-- coupure et LEURS lignes sont `reussi`. `reussites['synthese-hebdomadaire']` vaut donc « aujourd'hui »,
-- `estEnRetard` répond `false`, et `job_en_retard` n'est JAMAIS levé — aussi longtemps qu'une seule
-- personne passe, et quand bien même le fan-out échouerait depuis un mois.
--
-- `cible_id is null` restaure le sens du mot : la dernière fois que LE JOB, en tant que tel, est allé au
-- bout. Les lignes par personne racontent autre chose, et cet autre chose n'est pas ce qu'on mesure ici.
create or replace function public.etat_ordonnanceur()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'naissance', (select min(commence_le) from public.execution_job where cible_id is null),
    'reussites', coalesce(
      (select jsonb_object_agg(t.job, t.derniere)
         from (select job, max(termine_le) as derniere
                 from public.execution_job
                where statut = 'reussi'
                  and cible_id is null          -- LE JOB, pas une de ses personnes
             group by job) t),
      '{}'::jsonb)
  );
$$;

revoke execute on function public.etat_ordonnanceur() from public, anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 2. « DÉGRADÉ » avait cessé de vouloir dire « l'ordonnanceur va mal »
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- La clause d'origine regardait TOUT `incident_systeme` du jour, sans filtre. En 4.8 seul le job de santé
-- y écrivait, donc `degrade` disait bien « l'ordonnanceur est en difficulté ». Depuis la 4.9, un lot de
-- synthèses entièrement en échec y écrit aussi : Mistral tombe une heure à 06 h, et la sonde PUBLIQUE
-- répond `degrade` pendant deux jours pleins, longtemps après le retour du fournisseur, alors que
-- l'ordonnanceur va parfaitement bien. Le mot avait changé de sens sans que la SQL, son commentaire ni
-- son test ne bougent.
--
-- LE BON DÉCOUPAGE, et il tient en une phrase : `job_echoue` dit « un travail a raté » — ça arrive, c'est
-- la vie d'un système qui dépend d'un tiers. `job_en_retard` dit « un travail ne se fait PLUS » — ça,
-- c'est l'ordonnanceur. On ne garde que le second.
--
-- Rien n'est perdu au passage : un job qui échoue tous les jours cesse d'avoir des réussites, donc
-- `estEnRetard` finit par le voir et lève `job_en_retard`. La panne durable remonte, le hoquet non. C'est
-- la couche du dessous qui fait le tri, et c'est sa place.
create or replace function public.sante_ordonnanceur_publique()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.incident_systeme
                  where jour >= ((now() at time zone 'Europe/Paris')::date - 1)
                    and type = 'job_en_retard')
      -- L'homme mort, inchangé. Le nom est celui du job de santé du registre — une garde d'architecture
      -- interdit de le renommer ou de le passer hebdomadaire sans casser le build, faute de quoi ce
      -- prédicat deviendrait faux en silence.
      or not exists (select 1 from public.execution_job
                      where job = 'sante-ordonnanceur'
                        and cible_id is null
                        and statut = 'reussi'
                        and termine_le > now() - interval '48 hours')
    then 'degrade' else 'ok' end;
$$;

revoke execute on function public.sante_ordonnanceur_publique() from public, anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 3. LE DISJONCTEUR — une personne ne peut plus brûler un appel au modèle fort tous les jours, à vie
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- Le scénario, et il n'a rien de tordu : une personne dont le matériau fait échouer le modèle de façon
-- DÉTERMINISTE — un contenu qui déclenche un refus, une taille limite, un caractère qui casse un parseur
-- chez le fournisseur. Rien n'est écrit, donc le filigrane n'avance pas, donc demain elle est candidate
-- avec exactement le même matériau. Et comme le tri sert d'abord celle qui a attendu le plus longtemps,
-- elle est PREMIÈRE. Tous les jours. Pour toujours.
--
-- Trois échecs en sept jours et on la met de côté. Ce n'est pas un abandon : la fenêtre glisse, donc elle
-- revient d'elle-même au bout d'une semaine — et entre-temps le lot sert les autres. C'est aussi le seul
-- signal fiable dans un produit qui compte quelques utilisatrices : à N=1, « tout le lot a échoué » se
-- déclenche au premier hoquet et ne veut rien dire ; « la même personne échoue depuis trois jours », si.
create or replace function public.personnes_en_echec_repete(p_job text, p_seuil integer default 3)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
    from (select e.cible_id
            from public.execution_job e
           where e.job = p_job
             and e.cible_id is not null
             and e.statut = 'echoue'
             and e.termine_le > now() - interval '7 days'
        group by e.cible_id
          having count(*) >= p_seuil) t;
$$;

revoke execute on function public.personnes_en_echec_repete(text, integer) from public, anon, authenticated;


-- ── La sélection, munie du disjoncteur ──────────────────────────────────────────────────────────────────
drop function if exists public.utilisatrices_a_synthetiser(integer);

create or replace function public.utilisatrices_a_synthetiser(p_job text, p_limite integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(c.id order by c.attente nulls first, c.cree_le), '[]'::jsonb)
    from (
      select u.id, u.cree_le, d.periode_fin as attente
        from public.utilisatrice u
        left join lateral (
          select s.periode_fin, s.tronquee
            from public.synthese s
           where s.utilisatrice_id = u.id
           order by s.periode_fin desc
           limit 1
        ) d on true
       where public.eligible_a_synthese(u.id)
         and (d.periode_fin is null
              or d.tronquee
              or d.periode_fin <= now() - interval '7 days')
         and exists (select 1 from public.entrees_hors_detresse(u.id, d.periode_fin, now()) e
                      where e.role = 'utilisatrice')
         -- LE DISJONCTEUR. Trois échecs en sept jours, et on passe son tour — le temps que la fenêtre
         -- glisse, ou qu'un correctif arrive.
         and (select count(*) from public.execution_job ej
               where ej.job = p_job
                 and ej.cible_id = u.id
                 and ej.statut = 'echoue'
                 and ej.termine_le > now() - interval '7 days') < 3
       order by attente nulls first, u.cree_le
       limit p_limite
    ) c;
$$;

revoke execute on function public.utilisatrices_a_synthetiser(text, integer) from public, anon, authenticated;

-- L'index qui rend le disjoncteur gratuit : la sous-requête est évaluée par candidate.
create index if not exists execution_job_echecs_par_cible
  on public.execution_job (job, cible_id, termine_le)
  where statut = 'echoue' and cible_id is not null;
