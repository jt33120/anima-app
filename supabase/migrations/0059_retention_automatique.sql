-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 0059 — LE MOTEUR DE RÉTENTION AUTOMATIQUE (Story 6.8 · NFR-021 · AD-14 · FR-071)
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- ── UN SEUL MOTEUR, DEUX PORTES ────────────────────────────────────────────────────────────────
--
-- La 6.7 a écrit `effacer_toutes_mes_donnees()`, clé sur `auth.uid()`. C'était juste pour elle : la
-- personne demande, la session la nomme. Mais l'ordonnanceur n'a AUCUNE session — il efface pour le
-- compte de quelqu'un qui n'est plus là depuis vingt-sept mois.
--
-- On n'écrit donc pas un second effaceur : on ouvre une seconde porte sur le même. Le corps devient
-- `effacer_utilisatrice(id, motif, fenêtre)`, réservée au rôle système ; `effacer_toutes_mes_donnees`
-- devient une enveloppe de trois lignes qui lui passe `auth.uid()`. AD-14 exige « un moteur unique » :
-- après cette migration, il n'existe littéralement qu'un seul `delete from public.utilisatrice` dans
-- tout le schéma, et une garde de test l'exige.
--
-- ── CE QU'AUCUNE ÉCHÉANCE NE DOIT POUVOIR FAIRE ────────────────────────────────────────────────
--
-- ⚠️ UN COMPTE DONT L'ABONNEMENT EST ACTIF N'EST JAMAIS EFFACÉ POUR INACTIVITÉ. Le raisonnement est
-- désagréable et il faut l'écrire : quelqu'un peut payer douze mois sans jamais ouvrir l'application.
-- Ses traces d'activité, elles, ne bougent pas — seuls les webhooks de paiement écrivent. Sans cette
-- garde, le moteur effacerait les données d'une abonnée qui paie, et le premier signe en serait sa
-- carte débitée pour un compte vide.
--
-- La minorité détectée (FR-071), elle, efface QUOI QU'IL ARRIVE : c'est le seul cas où un abonnement
-- actif ne protège rien, parce que le compte n'aurait jamais dû exister.
--
-- ── LA GRÂCE SE RECALCULE, ELLE NE SE NETTOIE PAS ──────────────────────────────────────────────
--
-- « Trois mois plus tard SANS REPRISE » demandait un état à effacer quand elle revient : un drapeau
-- que quelqu'un doit penser à retirer, donc un drapeau qu'on laissera périmé. On ne pose rien à
-- nettoyer. Au moment de trancher, on REMESURE son activité : si elle a bougé depuis, l'échéance est
-- retirée et rien n'est supprimé. Revenir suffit ; personne n'a à s'en souvenir.

-- ────────────────────────────────────────────────────────────────────────────────────────────────
-- 1. LA DERNIÈRE ACTIVITÉ — et rien que CE QU'ELLE FAIT, elle
-- ────────────────────────────────────────────────────────────────────────────────────────────────
--
-- ⚠️ NI `usage_ia`, NI `synthese`, NI `notification_envoyee`, NI `abonnement`. C'est la leçon de la
-- 6.4, et elle est ici bien plus lourde de conséquences : ces quatre tables bougent quand le PRODUIT
-- travaille — une synthèse nocturne, un webhook de paiement, une notification poussée. Les compter
-- comme de l'activité ferait qu'un compte abandonné aurait l'air vivant à cause de nos propres jobs,
-- et ne serait jamais effacé. La conservation deviendrait éternelle par accident.
--
-- `utilisatrice.cree_le` sert de plancher : un compte neuf n'est jamais « inactif depuis toujours ».
create or replace function public.derniere_activite(p_utilisatrice_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $fn$
  select greatest(
    (select u.cree_le  from public.utilisatrice u  where u.id = p_utilisatrice_id),
    (select max(j.cree_le)  from public.entree_journal j where j.utilisatrice_id = p_utilisatrice_id
                                                          and j.role = 'utilisatrice'),
    (select max(t.tire_a)   from public.tirage t     where t.utilisatrice_id = p_utilisatrice_id),
    (select max(l.ouverte_a) from public.lecture l   where l.utilisatrice_id = p_utilisatrice_id),
    (select max(b.cree_le)  from public.branche b    where b.utilisatrice_id = p_utilisatrice_id)
  );
$fn$;

revoke execute on function public.derniere_activite(uuid) from public, anon, authenticated;

comment on function public.derniere_activite(uuid) is
  'Story 6.8 — le dernier geste qu''ELLE a fait. Exclut délibérément tout ce que le produit écrit '
  'seul (usage_ia, synthese, notification_envoyee, abonnement) : les compter rendrait un compte '
  'abandonné éternellement vivant à cause de nos propres jobs.';

-- ────────────────────────────────────────────────────────────────────────────────────────────────
-- 2. LE MOTEUR, DÉPLACÉ DERRIÈRE UNE PORTE SYSTÈME
-- ────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.effacer_utilisatrice(
  p_utilisatrice_id   uuid,
  p_motif             text,
  p_fenetre_pitr_jours integer
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_id uuid;
begin
  if p_utilisatrice_id is null then
    raise exception 'effacement_sans_identite' using errcode = '42501';
  end if;
  if p_fenetre_pitr_jours is null or p_fenetre_pitr_jours < 0 then
    raise exception 'fenetre_invalide' using errcode = '22023';
  end if;

  -- La trace AVANT l'effacement, et sans lien vers elle (voir 0058).
  insert into public.effacement (empreinte, motif, fenetre_pitr_jours, survivance_jusqu_au)
  values (
    encode(sha256(p_utilisatrice_id::text::bytea), 'hex'),
    p_motif,
    p_fenetre_pitr_jours,
    now() + make_interval(days => p_fenetre_pitr_jours)
  )
  returning id into v_id;

  -- Les branches d'abord : seule clé `on delete restrict` du schéma (voir l'encadré de 0058).
  delete from public.branche where utilisatrice_id = p_utilisatrice_id;
  delete from public.utilisatrice where id = p_utilisatrice_id;
  delete from auth.users where id = p_utilisatrice_id;

  update public.effacement set base_effacee_le = now() where id = v_id;
  return v_id;
end;
$fn$;

revoke all on function public.effacer_utilisatrice(uuid, text, integer) from public, anon, authenticated;

comment on function public.effacer_utilisatrice(uuid, text, integer) is
  'Story 6.8 — LE MOTEUR UNIQUE d''effacement (AD-14). Corps déplacé depuis '
  '`effacer_toutes_mes_donnees` (6.7), qui n''en est plus qu''une enveloppe. Réservé au rôle système : '
  'l''ordonnanceur efface pour quelqu''un qui n''a plus de session.';

-- La porte de l'utilisatrice : trois lignes, et elle ne décide plus rien d'autre que QUI.
create or replace function public.effacer_toutes_mes_donnees(p_fenetre_pitr_jours integer)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'effacement_sans_identite' using errcode = '42501';
  end if;
  return public.effacer_utilisatrice(v_uid, 'utilisatrice', p_fenetre_pitr_jours);
end;
$fn$;

revoke all on function public.effacer_toutes_mes_donnees(integer) from public, anon;
grant execute on function public.effacer_toutes_mes_donnees(integer) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────────────────────────
-- 3. QUI PRÉVENIR — l'inactivité, mesurée à l'exécution
-- ────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.comptes_a_prevenir(p_inactivite_mois integer, p_max integer)
returns table (utilisatrice_id uuid)
language sql
stable
security definer
set search_path = ''
as $fn$
  select u.id
    from public.utilisatrice u
   where u.echeance_suppression is null            -- personne n'a encore été prévenue
     and u.mineur_detecte = false                  -- la minorité a son propre chemin (FR-071)
     and public.derniere_activite(u.id) <= now() - make_interval(months => p_inactivite_mois)
     -- ⚠️ JAMAIS UNE ABONNÉE ACTIVE. Voir l'encadré : payer sans ouvrir l'application est un usage,
     -- pas un abandon, et ses traces d'activité ne bougent pas pour autant.
     and not exists (select 1 from public.abonnement a
                      where a.utilisatrice_id = u.id and a.etat = 'actif')
   order by u.cree_le
   limit greatest(p_max, 0);
$fn$;

revoke execute on function public.comptes_a_prevenir(integer, integer) from public, anon, authenticated;

/* La pose du préavis. Rendue APRÈS l'envoi du courriel — voir `jobs/retention.ts` : un courriel en
   double coûte moins qu'une suppression jamais annoncée. */
create or replace function public.poser_echeance_suppression(p_utilisatrice_id uuid, p_preavis_mois integer)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_pose boolean;
begin
  if p_preavis_mois is null or p_preavis_mois <= 0 then
    raise exception 'preavis_invalide' using errcode = '22023';
  end if;
  update public.utilisatrice
     set echeance_suppression = (now() + make_interval(months => p_preavis_mois))::date
   where id = p_utilisatrice_id
     -- ⚠️ ON N'ÉCRASE JAMAIS UNE ÉCHÉANCE EXISTANTE. Celle de la minorité (1.9) est plus courte ;
     -- la repousser de trois mois ferait durer un compte qui doit disparaître sous trente jours.
     and echeance_suppression is null
  returning true into v_pose;
  return coalesce(v_pose, false);
end;
$fn$;

revoke execute on function public.poser_echeance_suppression(uuid, integer) from public, anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────────────────────────
-- 4. TRANCHER — effacer, gracier, ou ne rien faire
-- ────────────────────────────────────────────────────────────────────────────────────────────────
--
-- UNE SEULE RPC, et un seul aller-retour par personne. La décision vit là où vivent les faits qui la
-- fondent : relire l'activité en TypeScript pour décider ensuite laisserait un intervalle entre la
-- lecture et l'effacement — et cet intervalle-là, c'est exactement le moment où elle revient.
create or replace function public.trancher_echeance_suppression(
  p_utilisatrice_id     uuid,
  p_inactivite_mois     integer,
  p_preavis_mois        integer,
  p_fenetre_pitr_jours  integer
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_echeance date;
  v_mineure  boolean;
begin
  if p_inactivite_mois is null or p_inactivite_mois <= 0
     or p_preavis_mois is null or p_preavis_mois <= 0 then
    raise exception 'echeances_invalides' using errcode = '22023';
  end if;

  select u.echeance_suppression, u.mineur_detecte
    into v_echeance, v_mineure
    from public.utilisatrice u
   where u.id = p_utilisatrice_id;

  -- Compte déjà parti, ou échéance retirée entre la sélection et ici : un non-événement.
  if v_echeance is null or v_echeance > (now() at time zone 'Europe/Paris')::date then
    return 'ignoree';
  end if;

  -- FR-071 : la minorité ne se gracie pas, et aucun abonnement ne la protège.
  if v_mineure then
    perform public.effacer_utilisatrice(p_utilisatrice_id, 'minorite', p_fenetre_pitr_jours);
    return 'effacee';
  end if;

  -- ⚠️ LA GRÂCE : elle est revenue, ou elle s'est abonnée. Dans les deux cas on RETIRE l'échéance et
  -- on ne supprime rien. Remesuré ici, jamais lu plus tôt — l'intervalle entre les deux serait
  -- précisément le moment où elle revient.
  if public.derniere_activite(p_utilisatrice_id)
       > now() - make_interval(months => p_inactivite_mois + p_preavis_mois)
     or exists (select 1 from public.abonnement a
                 where a.utilisatrice_id = p_utilisatrice_id and a.etat = 'actif')
  then
    update public.utilisatrice set echeance_suppression = null where id = p_utilisatrice_id;
    return 'graciee';
  end if;

  perform public.effacer_utilisatrice(p_utilisatrice_id, 'inactivite', p_fenetre_pitr_jours);
  return 'effacee';
end;
$fn$;

revoke execute on function public.trancher_echeance_suppression(uuid, integer, integer, integer)
  from public, anon, authenticated;

create or replace function public.comptes_a_effacer(p_max integer)
returns table (utilisatrice_id uuid)
language sql
stable
security definer
set search_path = ''
as $fn$
  select u.id
    from public.utilisatrice u
   where u.echeance_suppression is not null
     and u.echeance_suppression <= (now() at time zone 'Europe/Paris')::date
   order by u.echeance_suppression
   limit greatest(p_max, 0);
$fn$;

revoke execute on function public.comptes_a_effacer(integer) from public, anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────────────────────────
-- 5. LA RÉTENTION DU JOURNAL DE L'ORDONNANCEUR (trouvaille R1 de la revue 6.1a)
-- ────────────────────────────────────────────────────────────────────────────────────────────────
--
-- `purger_notifications_envoyees` existait depuis 0034 ; rien n'existait pour `execution_job` ni
-- `incident_systeme`. Or `socle-quotidien` et `rappel-echeance` y écrivent UNE LIGNE PAR PERSONNE ET
-- PAR JOUR. La seule table sans rétention était celle qui trace le moteur de rétention.
--
-- ⚠️ ON NE TOUCHE QUE CE QUI EST TERMINÉ. Une ligne `en_cours` peut appartenir à une exécution vivante
-- sous son bail ; la purger libérerait sa fenêtre et autoriserait un second passage — sur la rétention,
-- un second effacement. La borne est donc `termine_le`, jamais `commence_le`.
create or replace function public.purger_journal_ordonnanceur(p_jours integer)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_supprimees integer;
  v_total      integer;
begin
  -- Même garde que `purger_notifications_envoyees` : `make_interval(days => null)` rendrait NULL,
  -- donc la comparaison rendrait NULL, donc la purge ne supprimerait rien — en silence.
  if p_jours is null or p_jours <= 0 then
    raise exception 'retention_journal_invalide' using errcode = '22023';
  end if;

  delete from public.execution_job
   where termine_le is not null
     and termine_le < now() - make_interval(days => p_jours);
  get diagnostics v_total = row_count;

  delete from public.incident_systeme
   where cree_le < now() - make_interval(days => p_jours);
  get diagnostics v_supprimees = row_count;

  return v_total + v_supprimees;
end;
$fn$;

revoke execute on function public.purger_journal_ordonnanceur(integer) from public, anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────────────────────────
-- 6. CE QU'ON N'A PAS ÉCRIT, ET POURQUOI UNE GARDE L'A REFUSÉ
-- ────────────────────────────────────────────────────────────────────────────────────────────────
--
-- Une première version de cette migration ajoutait `retention_inactivite` au `CHECK` de
-- `notification_envoyee.motif`, et une RPC pour y tracer l'avis. `tests/regime-anam.test.ts` a rougi,
-- et elle avait raison : ce `CHECK` est le MIROIR des motifs à canal (les `MotifCourriel` plus la
-- poussée du socle). Or l'avis d'inactivité est délibérément un `MotifLegal` — il échappe au refus de
-- canal et au plafond par famille, parce qu'il est DÛ. Le faire entrer dans cette table l'aurait rangé
-- dans le régime auquel on venait précisément de le soustraire.
--
-- Et la trace n'aurait rien apporté : `purger_notifications_envoyees` (0034) l'aurait effacée, tandis
-- que `utilisatrice.echeance_suppression` — posée juste après l'envoi — est une trace DURABLE, qui vit
-- exactement aussi longtemps que le compte qu'elle concerne. C'est elle qui rend l'avis idempotent :
-- `comptes_a_prevenir` ne sélectionne que les échéances nulles.
