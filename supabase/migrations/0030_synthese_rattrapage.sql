-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 0030 — REVUE ADVERSARIALE 4.9, LOT A : ce qui atteint une personne réelle
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- Six défauts corrigés ici. Deux d'entre eux remplacent le CŒUR TECHNIQUE de la 4.9, et il faut le dire
-- franchement : la clé d'idempotence n'est plus la semaine ISO.
--
-- ── POURQUOI LA SEMAINE ISO NE POUVAIT PAS RESTER LA CLÉ ────────────────────────────────────────────────
--
-- Le plafond de volume écartait les entrées les PLUS ANCIENNES, puis posait `periode_fin = now()`. Ce qui
-- avait été écarté passait donc sous le filigrane et n'entrait PLUS JAMAIS dans aucune synthèse. Ce n'est
-- pas un cas limite : la toute première synthèse a `depuis = null` et vise tout le journal depuis
-- l'inscription — une utilisatrice avec 1500 entrées perdait sa première année, dès le jour un.
--
-- Le correctif évident — mordre par le plus RÉCENT et faire suivre le filigrane — entrait en collision
-- avec la clé hebdomadaire : `utilisatrices_a_synthetiser` excluait celles qui avaient déjà une synthèse
-- pour la semaine, donc le rattrapage aurait avancé d'UNE TRANCHE PAR SEMAINE. Sa première synthèse en
-- août aurait parlé de février, la suivante de mars. Inacceptable.
--
-- D'où le remplacement, décidé en connaissance de cause :
--
--   • la CLÉ est désormais `periode_debut`. Les périodes se pavent bout à bout (chacune commence là où la
--     précédente s'est arrêtée), donc deux synthèses ne peuvent pas partager un début : l'unicité est
--     exacte, et elle ne dépend plus d'un calendrier civil.
--   • la RÉCLAMATION par personne se fait sur le JOUR (côté job), pas sur la semaine. Une personne est
--     donc tentée au plus une fois par jour — ce qui est exactement le rythme de rattrapage voulu.
--   • la CADENCE devient « sept jours depuis la dernière période racontée », SAUF si la dernière synthèse
--     était tronquée, auquel cas on enchaîne dès le lendemain jusqu'à ce que le retard soit résorbé.
--
-- Ce remplacement paie plus qu'il ne coûte : il fait tomber deux autres défauts de la revue sans une
-- ligne de plus. Une deuxième synthèse en 24 h au passage de semaine ISO (dimanche W32, lundi W33 pour
-- une seule phrase écrite entre les deux) est désormais impossible — sept jours, c'est sept jours. Et une
-- personne close en « rien à dire » ne brûle plus sa semaine : sa réclamation portant sur le jour, elle
-- redevient joignable dès le lendemain.
--
-- ── LES QUATRE AUTRES ───────────────────────────────────────────────────────────────────────────────────
--
--   • La détresse. La migration 0029 affirmait « rien ne naît pendant la détresse (AD-17) » ; c'était
--     faux. Sa clause n'écartait que les ENTRÉES tombées dans l'épisode — celles d'AVANT rendaient la
--     personne candidate, et une femme en épisode OUVERT recevait sa synthèse et son courriel. La garde
--     est ici alignée sur `branche_bloquee_par_detresse` : épisode ouvert OU fenêtre de 72 h encore
--     chaude, exactement le même prédicat que le reste de la maison.
--   • La garde d'éligibilité vivait dans la fonction de SÉLECTION, et nulle part ailleurs : appelées
--     directement, `materiau_synthese` rendait le verbatim d'une révoquée et `enregistrer_synthese`
--     écrivait de l'art. 9 pour n'importe qui. C'est le défaut R1+R3 de la 4.5, dont la leçon était
--     « une garde écrite dans l'appelant n'est plus une garde, c'est une politesse ». Elle est désormais
--     dans `eligible_a_synthese`, appelée par les TROIS fonctions.
--   • Le plafond de notification ignorait le MOTIF alors que l'unicité le regardait. Deux fenêtres
--     consécutives à moins de 72 h — banal quand on commence à tenir son journal un samedi — et le
--     courriel de la deuxième semaine était perdu à jamais, sans incident ni trace. Le plafond est
--     maintenant PAR MOTIF, ce qui le rend aussi compatible avec FR-033 (socle quotidien) à l'Epic 6 :
--     un motif quotidien ne mange plus le courriel de synthèse.
--   • Le plafond ne bornait que le NOMBRE d'entrées, jamais leur TAILLE. 200 entrées de 2,5 ko dépassent
--     la fenêtre du modèle : erreur 400, aucune écriture, `periode_fin` qui n'avance pas — donc les mêmes
--     200 entrées le lendemain, et la même erreur, tous les jours, pour toujours, en silence.
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 1. LA GARDE UNIQUE — une définition, trois appelants
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- `a_consenti_art9()` et `est_barre_minorite()` ne sont pas utilisables ici : elles lisent `auth.uid()`,
-- et l'ordonnanceur n'a pas de session. Leurs prédicats sont donc réécrits pour une utilisatrice donnée,
-- et un test compare les deux chemins pour qu'ils ne divergent pas.
--
-- Ce qu'elle NE contient PAS, délibérément : la cadence et l'existence de matériau. Ce sont des questions
-- de SÉLECTION (« faut-il la servir maintenant ? »), pas d'AUTORISATION (« a-t-on le droit de toucher à
-- ses données ? »). Mélanger les deux ferait qu'un futur appelant qui veut lire sans produire — un export,
-- un outil d'administration — devrait mentir sur la cadence pour obtenir l'autorisation.
create or replace function public.eligible_a_synthese(p_utilisatrice uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.utilisatrice u
      join public.abonnement a
        on a.utilisatrice_id = u.id and a.etat = 'actif'         -- AC5 : premium, et seulement premium
     where u.id = p_utilisatrice
       and u.barriere_minorite_le is null                        -- barrière posée après coup (0006, FR-071)
       and u.mineur_detecte is not true                          -- barrière persistante (FR-070)
       and exists (select 1 from public.consentement k
                    where k.utilisatrice_id = u.id
                      and k.art9_accorde = true
                      and k.ia_reconnue  = true
                      and k.revoked_at is null)                  -- consentement art. 9 VIVANT (0005)
       -- AD-17 — miroir EXACT de `branche_bloquee_par_detresse()` (0010:140-144). L'épisode OUVERT et la
       -- fenêtre de 72 h qui le suit bloquent tous deux : c'est la définition que le produit utilise
       -- partout ailleurs pour dire « rien ne naît maintenant », et la synthèse n'a aucune raison d'être
       -- l'exception. Une femme qui traverse quelque chose ne reçoit pas un bilan de sa semaine.
       and not exists (select 1 from public.episode_detresse e
                        where e.utilisatrice_id = u.id
                          and (e.fin is null or e.fenetre_expire_at > now()))
  );
$$;

revoke execute on function public.eligible_a_synthese(uuid) from public, anon, authenticated;

comment on function public.eligible_a_synthese(uuid) is
  'Revue 4.9 (T1-1/T2-2) : LA garde d''autorisation de la synthèse — premium actif, aucune barrière de minorité, consentement art. 9 vivant, aucune détresse en cours ni fenêtre de 72 h chaude. Appelée par les TROIS fonctions qui touchent au contenu (sélection, lecture, écriture) : sous service_role la RLS ne porte rien, donc la garde doit être dans la fonction, jamais chez l''appelant.';


-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 2. LA CLÉ : la période, plus la semaine
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════

-- L'index `synthese_cle` portait sur `(utilisatrice_id, semaine)` : il tombe avec la colonne.
alter table public.synthese drop column semaine;

create unique index synthese_cle on public.synthese (utilisatrice_id, periode_debut);

-- `>` devient `>=`. Une période d'un seul instant est désormais légitime : quand le plafond mord sur une
-- tranche qui ne contient qu'une entrée, le filigrane EST l'horodatage de cette entrée. Refuser ce cas
-- ferait échouer l'écriture, donc rejouer la même tranche le lendemain — une boucle sans fin sur la seule
-- personne qu'on essayait d'aider.
alter table public.synthese drop constraint synthese_periode_coherente;
alter table public.synthese add constraint synthese_periode_coherente check (periode_fin >= periode_debut);

comment on table public.synthese is
  'Story 4.9 (FR-066), revu en 0030 : récapitulatif périodique rédigé par le modèle FORT. La CLÉ est `periode_debut` — les périodes se pavent bout à bout, donc deux synthèses ne peuvent pas partager un début, et l''unicité ne dépend plus d''un calendrier civil. `tronquee` signale qu''une tranche suit : le rattrapage reprend au lendemain là où celle-ci s''est arrêtée. `contenu` est de l''art. 9 : lecture propriétaire, aucune écriture sous JWT, cascade FR-067.';


-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 3. LE MATÉRIAU — rattrapage chronologique, borné en nombre ET en taille
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════

drop function if exists public.materiau_synthese(uuid, integer);

-- TOUT tient en UNE seule instruction SQL, et ce n'est pas de la coquetterie. En plpgsql, chaque
-- instruction prend son propre instantané : l'ancienne version comptait dans une instruction et lisait
-- dans une autre, si bien qu'une entrée validée entre les deux faisait mentir `tronquee` — il annonçait
-- « rien n'a été écarté » pendant que la coupe en jetait une. Un seul passage, un seul instantané.
create or replace function public.materiau_synthese(
  p_utilisatrice    uuid,
  p_plafond_entrees integer,
  p_plafond_octets  integer
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
           -- pour toujours (l'intervalle suivant est STRICTEMENT supérieur). La convention avait déjà été
           -- posée en 0019 après la revue 4.3 ; la 4.9 l'avait perdue.
           row_number() over (order by e.cree_le, e.id) as rang,
           sum(length(e.contenu)) over (order by e.cree_le, e.id
                 rows between unbounded preceding and current row) as octets
      from public.entrees_hors_detresse(p_utilisatrice, v_depuis, v_instant) e
     -- Seulement CE QU'ELLE A ÉCRIT. Aucune ligne `role = 'anam'` n'existe aujourd'hui (la policy de 0016
     -- épingle `utilisatrice` à l'insertion, précisément « sinon une utilisatrice forgerait de fausses
     -- paroles d'Anam, immuables »). Le jour où l'Epic 6 écrira les tours d'Anam, ce filtre devra être
     -- rouvert AVEC un chemin qui distingue structurellement les deux voix — pas par concaténation.
     where e.role = 'utilisatrice'
  ),
  gardees as (
    select e.* from elig e
     -- `rang = 1` d'abord : une entrée seule plus grosse que le plafond d'octets doit quand même passer,
     -- sinon la tranche est vide, le filigrane n'avance pas, et cette personne est bloquée pour toujours
     -- sur une entrée trop longue. Son contenu est coupé plus bas — le progrès prime.
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

  -- AD-18 : `statut = 'actif'` SEUL. Un tombstone occupe la clé et son contenu a été vidé — le lire puis
  -- filtrer côté appelant ferait revenir un fait corrigé dans le prompt le jour où quelqu'un l'oublie.
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
    -- LE FILIGRANE, et le mot compte : ce n'est plus « l'instant de lecture », c'est « jusqu'où cette
    -- tranche va ». Quand le plafond a mordu, c'est l'horodatage de la dernière entrée réellement lue —
    -- la tranche suivante reprendra exactement là, et rien ne tombe entre les deux.
    'jusqu_a',  case when v_tronquee then v_borne else v_instant end,
    'total',    coalesce(v_total, 0),
    'tronquee', coalesce(v_tronquee, false),
    'entrees',  coalesce(v_entrees, '[]'::jsonb),
    'faits',    coalesce(v_faits, '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.materiau_synthese(uuid, integer, integer) from public, anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 4. QUI SYNTHÉTISER — la cadence, et le rattrapage qui la court-circuite
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════

drop function if exists public.utilisatrices_a_synthetiser(text, integer);

create or replace function public.utilisatrices_a_synthetiser(p_limite integer)
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
        -- La DERNIÈRE synthèse écrite. `left join lateral` plutôt que deux sous-requêtes corrélées : on
        -- a besoin de sa date ET de son drapeau de troncature, et les lire séparément ouvrirait la porte
        -- à ce qu'ils viennent de deux lignes différentes.
        left join lateral (
          select s.periode_fin, s.tronquee
            from public.synthese s
           where s.utilisatrice_id = u.id
           order by s.periode_fin desc
           limit 1
        ) d on true
       where public.eligible_a_synthese(u.id)
         -- LA CADENCE. Sept jours depuis la fin de la dernière période racontée — pas depuis un lundi.
         -- L'ancienne clé hebdomadaire produisait une « synthèse hebdomadaire » couvrant 22 heures et une
         -- phrase quand la semaine ISO basculait le lendemain d'un envoi : exactement le message générique
         -- récurrent que FR-034 interdit.
         and (d.periode_fin is null                                  -- jamais servie
              or d.tronquee                                          -- rattrapage : on enchaîne demain
              or d.periode_fin <= now() - interval '7 days')
         -- D3 / FR-034 : « rien à dire » = aucune entrée ÉLIGIBLE depuis la dernière période. Des faits
         -- anciens ne suffisent pas — ils sont cumulatifs, donc « il existe des faits » serait vrai pour
         -- toujours dès la première semaine, et on synthétiserait même les périodes vides.
         and exists (select 1 from public.entrees_hors_detresse(u.id, d.periode_fin, now()) e
                      where e.role = 'utilisatrice')
       -- ÉQUITÉ. Le lot est borné : servir dans l'ordre des identifiants affamerait toujours les mêmes.
       -- On sert celle qui a attendu le plus longtemps, `nulls first` étant celle qui n'a jamais rien reçu
       -- — et à égalité, la plus anciennement inscrite. Sans ce second critère, l'ordre entre celles qui
       -- n'ont jamais rien reçu était laissé au plan d'exécution, donc instable d'un jour à l'autre.
       order by attente nulls first, u.cree_le
       limit p_limite
    ) c;
$$;

revoke execute on function public.utilisatrices_a_synthetiser(integer) from public, anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 5. L'ÉCRITURE — rend l'identifiant, pour que l'annonce sache de QUOI elle parle
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- Renvoie `null` si rien n'a été écrit — parce que la tranche existait déjà, ou parce que l'éligibilité
-- a changé pendant la production. L'appelant apprend ainsi qu'il n'a rien produit de neuf, et n'enchaîne
-- donc PAS sur la notification. Quand il y a écriture, l'identifiant renvoyé devient la clé d'idempotence
-- de l'annonce : une synthèse, une annonce, et le lien entre les deux est exact.
drop function if exists public.enregistrer_synthese(uuid, text, timestamptz, timestamptz, text, boolean);

create or replace function public.enregistrer_synthese(
  p_utilisatrice uuid,
  p_debut        timestamptz,
  p_fin          timestamptz,
  p_contenu      text,
  p_tronquee     boolean
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  -- La garde est ICI, pas seulement dans la sélection. Entre le moment où le lot a été constitué et
  -- celui-ci, il s'est écoulé jusqu'à une minute et vingt appels au modèle fort : une révocation, une
  -- barrière ou un épisode de détresse ont eu tout le temps d'atterrir.
  if not public.eligible_a_synthese(p_utilisatrice) then
    return null;
  end if;

  insert into public.synthese (utilisatrice_id, periode_debut, periode_fin, contenu, tronquee)
  values (p_utilisatrice, p_debut, p_fin, p_contenu, coalesce(p_tronquee, false))
  on conflict (utilisatrice_id, periode_debut) do nothing
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.enregistrer_synthese(uuid, timestamptz, timestamptz, text, boolean)
  from public, anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 6. LA RÉSERVATION — le plafond regarde enfin le motif
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- L'unicité regardait `(utilisatrice, motif, clé)` ; le plafond, lui, ne regardait que « une notification,
-- n'importe laquelle, dans les 72 h ». Les deux se contredisaient dès que deux périodes consécutives
-- tombaient à moins de 72 h — banal quand on commence à tenir son journal en milieu de semaine. Le
-- courriel de la deuxième période était refusé, sa clé n'était jamais réservée, aucun incident n'était
-- levé, et elle ne redevenait pas candidate : perdu à jamais, en silence.
--
-- Le plafond est désormais PAR MOTIF. Ce n'est pas un assouplissement : c'est ce qui le rend vrai. Et
-- c'est ce qui le rend compatible avec l'Epic 6, où FR-033 (socle quotidien) était structurellement
-- impossible sous « une notification tous motifs confondus / 72 h » — chaque envoi quotidien aurait
-- mangé le courriel de synthèse.
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
  -- `make_interval(hours => null)` rend NULL, donc `envoye_le > NULL` rend NULL, donc `not exists` rend
  -- TRUE : un plafond absent DÉSACTIVAIT silencieusement le plafond. Une valeur négative projetait la
  -- borne dans le futur, avec le même effet. Le commentaire promettait une garantie de la base ; c'était
  -- une garantie de l'appelant. On refuse plutôt que d'envoyer sans limite.
  if p_plafond_heures is null or p_plafond_heures <= 0 then
    raise exception 'plafond_notification_invalide';
  end if;

  -- Le verrou est indispensable : sans lui, deux appels simultanés pour la même personne passeraient tous
  -- deux le `not exists` (aucun n'ayant encore inséré) et deux courriels partiraient dans la même seconde
  -- — l'index unique ne les arrêterait pas, leurs clés étant différentes.
  -- Le SEL (4909) sépare cet espace de verrous de celui de 0014 (webhooks Stripe), qui dérivait sa clé du
  -- même uuid par la même fonction : un webhook lent bloquait la réservation d'une notification sans
  -- qu'aucun des deux fichiers ne mentionne l'autre.
  perform pg_advisory_xact_lock(hashtextextended(p_utilisatrice::text, 4909));

  insert into public.notification_envoyee (utilisatrice_id, motif, cle)
  select p_utilisatrice, p_motif, p_cle
   where not exists (
           select 1 from public.notification_envoyee n
            where n.utilisatrice_id = p_utilisatrice
              and n.motif = p_motif
              and n.envoye_le > now() - make_interval(hours => p_plafond_heures)
         )
  on conflict (utilisatrice_id, motif, cle) do nothing
  returning true into v_reserve;

  -- `returning … into` laisse NULL quand rien n'est inséré — que ce soit par le plafond (le `where`) ou
  -- par l'idempotence (le `on conflict`). Les deux veulent dire « n'envoie pas ».
  return coalesce(v_reserve, false);
end;
$$;

comment on table public.notification_envoyee is
  'Story 4.9 (AC4/FR-035), revu en 0030 : trace des notifications parties. Sert à DEUX choses — l''idempotence par (motif, clé) et le plafond de débit, désormais PAR MOTIF. Le plafond tous-motifs-confondus faisait perdre définitivement le courriel d''une période quand deux périodes tombaient à moins de 72 h, et rendait FR-033 impossible. Ensemble de motifs FERMÉ par contrainte. Deny-by-default, NON-art. 9 (aucune colonne de contenu).';
