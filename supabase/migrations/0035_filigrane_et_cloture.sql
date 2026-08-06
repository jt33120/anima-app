-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 0035 — deux fenêtres d'horloge (revue 4.9, T6-17 et T6-19)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- Rien de spectaculaire ici : deux endroits où le temps est lu d'une façon qui promet un peu plus que ce
-- qu'elle tient. Les deux ont en commun d'être invisibles jusqu'au jour où elles ne le sont plus.

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 1. LE FILIGRANE VIENT DE CE QUI A ÉTÉ LU, JAMAIS DE L'HORLOGE (T6-17)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- `now()` est figé au DÉBUT de la transaction, et `entree_journal.cree_le` vaut `now()`. Une entrée dont
-- la transaction démarre à T₀ et commite à T₀+3 ms n'est donc pas visible pour un job dont la transaction
-- démarre à T₀+1 ms — mais elle porte `cree_le = T₀`, qui est INFÉRIEUR au filigrane `T₀+1 ms` que ce job
-- s'apprêtait à poser. L'intervalle suivant lisant `cree_le > filigrane`, cette entrée n'est plus jamais
-- racontée. La fenêtre est étroite ; la perte est définitive, et silencieuse.
--
-- Le correctif est aussi une SIMPLIFICATION, et c'est ce qui le rend juste : il n'y avait pas une bonne
-- borne et une mauvaise, il y en avait DEUX là où une suffit. `v_borne` — le `cree_le` de la dernière
-- entrée réellement lue — était déjà calculé, déjà exact, et déjà utilisé dans le cas tronqué. Le cas non
-- tronqué prenait l'horloge à la place, sans qu'aucune raison ne le demande.
--
-- Le repli sur `v_instant` ne concerne que le cas « aucune entrée lue », où il n'est jamais persisté :
-- sans entrée, `periodeDe` rend `null`, le job conclut « rien à dire » et n'écrit aucune synthèse.
create or replace function public.materiau_synthese(
  p_utilisatrice     uuid,
  p_plafond_entrees  integer,
  p_plafond_octets   integer
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_depuis   timestamptz;
  v_instant  timestamptz := now();
  v_total    integer;
  v_tronquee boolean;
  v_borne    timestamptz;
  v_entrees  jsonb;
  v_faits    jsonb;
begin
  if not public.eligible_a_synthese(p_utilisatrice) then
    return jsonb_build_object('depuis', null, 'jusqu_a', v_instant, 'total', 0,
                              'tronquee', false, 'entrees', '[]'::jsonb, 'faits', '[]'::jsonb);
  end if;

  select max(s.periode_fin) into v_depuis
    from public.synthese s where s.utilisatrice_id = p_utilisatrice;

  with elig as (
    select e.id, e.contenu, e.cree_le,
           -- ORDRE TOTAL. `cree_le` seul ne départage pas les ex æquo, et ici ce n'est plus cosmétique :
           -- le filigrane est un `cree_le`, donc une coupe au milieu d'un horodatage perdrait les frères
           -- pour toujours (l'intervalle suivant est STRICTEMENT supérieur).
           row_number() over (order by e.cree_le, e.id) as rang,
           sum(length(e.contenu)) over (order by e.cree_le, e.id
                 rows between unbounded preceding and current row) as octets
      from public.entrees_hors_detresse(p_utilisatrice, v_depuis, v_instant) e
     -- Seulement CE QU'ELLE A ÉCRIT. Le jour où l'Epic 6 écrira les tours d'Anam, ce filtre devra être
     -- rouvert AVEC un chemin qui distingue structurellement les deux voix — pas par concaténation.
     where e.role = 'utilisatrice'
  ),
  gardees as (
    select e.* from elig e
     -- `rang = 1` d'abord : une entrée seule plus grosse que le plafond d'octets doit quand même passer,
     -- sinon la tranche est vide, le filigrane n'avance pas, et cette personne est bloquée pour toujours.
     where e.rang = 1
        or (e.rang <= p_plafond_entrees and e.octets <= p_plafond_octets)
  ),
  borne as (
    select max(g.cree_le) as fin from gardees g
  ),
  -- Le groupe d'ex æquo à la borne entre EN ENTIER. Combiné à l'ordre total ci-dessus, c'est ce qui
  -- garantit qu'aucune entrée ne tombe entre deux tranches.
  finales as (
    select e.* from elig e, borne b where b.fin is not null and e.cree_le <= b.fin
  )
  select (select count(*) from elig),
         (select count(*) from elig) > (select count(*) from finales),
         (select b.fin from borne b),
         coalesce((select jsonb_agg(jsonb_build_object(
                            'role',    'utilisatrice',
                            'contenu', left(f.contenu, p_plafond_octets),
                            'cree_le', f.cree_le)
                          order by f.cree_le, f.id)
                     from finales f), '[]'::jsonb)
    into v_total, v_tronquee, v_borne, v_entrees;

  -- AD-18 : `statut = 'actif'` SEUL. Un tombstone occupe la clé et son contenu a été vidé.
  select coalesce(jsonb_agg(f.contenu order by f.maj_le, f.cle_dedoublonnage), '[]'::jsonb)
    into v_faits
    from (select f2.contenu, f2.maj_le, f2.cle_dedoublonnage
            from public.fait_extrait f2
           where f2.utilisatrice_id = p_utilisatrice
             and f2.statut = 'actif'
           order by f2.maj_le desc, f2.cle_dedoublonnage
           limit 200) f;

  return jsonb_build_object(
    'depuis',   v_depuis,
    -- LE FILIGRANE (T6-17) : « jusqu'où cette tranche va », c'est-à-dire l'horodatage de la dernière
    -- entrée RÉELLEMENT LUE — tronquée ou non. Plus jamais l'horloge : elle avance plus vite que les
    -- commits, et tout ce qu'elle dépasse est perdu.
    'jusqu_a',  coalesce(v_borne, v_instant),
    'total',    coalesce(v_total, 0),
    'tronquee', coalesce(v_tronquee, false),
    'entrees',  coalesce(v_entrees, '[]'::jsonb),
    'faits',    coalesce(v_faits, '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.materiau_synthese(uuid, integer, integer) from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 2. UNE FENÊTRE TERMINÉE NE SE ROUVRE PAS (T6-19)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- `0027` affirme, en toutes lettres : « une ligne `reussi` n'est JAMAIS re-réclamable — c'est là que vit
-- l'idempotence de la fenêtre ». C'était faux. `clore_execution(p_reussi := false)` écrasait `reussi` en
-- `echoue` sans aucune condition, et une ligne `echoue` EST re-réclamable. Il suffisait d'une clôture
-- tardive, arrivant après qu'une autre exécution ait réussi, pour rouvrir une fenêtre terminée.
--
-- Sans conséquence aujourd'hui : sur la synthèse, l'unicité `(utilisatrice_id, periode_debut)` rattrape.
-- Ce ne sera pas le cas de la RÉTENTION (Epic 6), que `executer.ts` promet explicitement de protéger par
-- ce mécanisme — et une purge rejouée ne se rattrape par aucun index.
--
-- CE QUE CE CORRECTIF FAIT, ET CE QU'IL NE FAIT PAS. Il rend les états terminaux terminaux : `reussi` et
-- `echoue` ne se réécrivent plus. Il ne donne toujours PAS de jeton de propriété — deux exécutions
-- concurrentes après expiration de bail voient toutes deux `en_cours` et la seconde clôture écrase la
-- première. C'est une classe de défaut différente, inscrite dans `deferred-work.md` : elle demande une
-- colonne de bail et un identifiant d'exécution, donc une migration qui touche tous les appelants.
create or replace function public.clore_execution(
  p_job       text,
  p_fenetre   text,
  p_cible_id  uuid,
  p_reussi    boolean,
  p_motif     text
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
     and cible_id is not distinct from p_cible_id  -- `is not distinct from` : `null = null` vaut vrai ici
     -- T6-19 : SEULE une exécution en cours se clôt. Une clôture qui arrive après coup ne fait plus rien
     -- — et « ne fait rien » est exactement ce qu'on veut d'elle, puisque la fenêtre a déjà son verdict.
     and statut = 'en_cours';
end;
$$;

revoke execute on function public.clore_execution(text, text, uuid, boolean, text) from public, anon, authenticated;
