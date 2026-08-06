-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 0034 — LE DÉSABONNEMENT, qui était promis et qui n'existait pas (revue 4.9, T5-2)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- Le gabarit disait : « Pour ne plus recevoir ces messages, réponds à ce courriel. » Trois vides derrière
-- cette phrase — aucune boîte entrante, aucun mécanisme d'opt-out, aucun en-tête `List-Unsubscribe`. Ses
-- seules sorties réelles étaient de résilier son abonnement ou de révoquer son consentement art. 9 :
-- renoncer au produit pour exercer un droit d'opposition.
--
-- Et le retour de flamme, qui est le pire des deux : une femme qui « répond au courriel » n'écrit pas
-- « stop », elle écrit POURQUOI. Ce texte libre est de l'art. 9, et il arrive dans une boîte ordinaire —
-- hors RLS, hors write-gate, hors ZDR, conservé indéfiniment. Le port empêchait l'art. 9 de SORTIR par le
-- corps du courriel ; le corps du courriel ouvrait un canal pour le faire ENTRER.
--
-- ── CE QUE CETTE MIGRATION POSE ────────────────────────────────────────────────────────────────────────
--
--   1. `preference_courriel` — un jeton opaque et un refus, rien d'autre ;
--   2. `jeton_courriel()` — le jeton, créé paresseusement au premier envoi ;
--   3. `regler_courriels_par_jeton()` — le désabonnement en un clic, SANS session ;
--   4. `reserver_notification()` — le refus devient une condition de la RÉSERVATION, donc infranchissable ;
--   5. `purger_notifications_envoyees()` — la trace ne devient pas un profil d'assiduité.
--
-- ── CE QU'IL N'ARRÊTE PAS, DÉLIBÉRÉMENT ────────────────────────────────────────────────────────────────
--
-- Le refus porte sur le CANAL, jamais sur le CONTENU. La synthèse continue d'être produite et reste
-- consultable dans l'application : se taire n'est pas la même chose que ne plus rien écrire pour elle. La
-- garde vit donc dans `reserver_notification` — le point de passage unique du canal — et surtout PAS dans
-- `eligible_a_synthese`, qui décide de l'egress art. 9 et n'a rien à voir avec une préférence d'envoi.

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 1. LA PRÉFÉRENCE — un jeton opaque, un refus
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- Pourquoi un JETON ALÉATOIRE plutôt que l'identifiant de l'utilisatrice signé ?
--
-- Le lien de désabonnement traverse Resend, puis un serveur de messagerie, puis les journaux de l'un et de
-- l'autre, et il y reste. Un uuid d'utilisatrice qui voyage dans une URL est un identifiant pseudonyme
-- réutilisable : il se recoupe avec tout ce qui porte le même uuid ailleurs. Un jeton propre au canal ne
-- se recoupe avec rien hors de cette table — et le corrompre ne donne accès à rien d'autre qu'au fait de
-- ne plus recevoir de courriel, c'est-à-dire à une action sans dommage et réversible.
--
-- C'est aussi ce qui évite un secret de signature à gérer, à faire tourner, et à perdre.

create table public.preference_courriel (
  utilisatrice_id uuid        primary key references public.utilisatrice(id) on delete cascade,
  jeton           uuid        not null default gen_random_uuid(),
  -- NULL = elle reçoit. Un horodatage = elle a refusé, et QUAND — la date est la preuve de la prise en
  -- compte de son opposition (art. 21), pas une métrique.
  refuse_le       timestamptz,
  maj_le          timestamptz not null default now()
);

create unique index preference_courriel_jeton on public.preference_courriel (jeton);

alter table public.preference_courriel enable row level security;
alter table public.preference_courriel force  row level security;

-- Lecture propriétaire seule — c'est ce qui rend la préférence visible dans son EXPORT (FR-067). Aucune
-- policy d'écriture : tout passe par les deux fonctions ci-dessous, y compris le chemin sans session.
create policy preference_courriel_proprietaire_lecture on public.preference_courriel
  for select
  using (auth.uid() = utilisatrice_id);

comment on table public.preference_courriel is
  'Story 4.9 / revue T5-2 : le droit d''opposition (art. 21) au CANAL courriel, sans passer par la révocation du consentement art. 9 ni par la résiliation. `jeton` est un identifiant opaque propre au canal, porté par le lien de désabonnement en un clic (RFC 8058) : il ne se recoupe avec aucun autre identifiant du produit et ne donne accès qu''à cette préférence. NON-art. 9 (aucune colonne de contenu). Cascade FR-067.';

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 2. LE JETON — créé au premier envoi, jamais avant
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- Création paresseuse plutôt qu'un déclencheur sur `utilisatrice` : une personne qui ne reçoit jamais de
-- courriel n'a aucune raison de porter un identifiant de canal. La ligne naît quand le canal sert.
create or replace function public.jeton_courriel(p_utilisatrice uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jeton uuid;
begin
  insert into public.preference_courriel (utilisatrice_id)
  values (p_utilisatrice)
  on conflict (utilisatrice_id) do nothing;

  -- `on conflict do nothing returning` ne rend RIEN quand la ligne existait déjà (le piège Postgres payé
  -- trois fois dans cette story). On relit donc, franchement, plutôt que d'espérer un `returning`.
  select p.jeton into v_jeton
    from public.preference_courriel p
   where p.utilisatrice_id = p_utilisatrice;

  return v_jeton;
end;
$$;

revoke execute on function public.jeton_courriel(uuid) from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 3. LE DÉSABONNEMENT PAR JETON — sans session, dans les deux sens
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- Sans session, parce qu'exiger une connexion pour faire cesser un envoi est exactement le mur que
-- l'article 21 interdit de dresser — et parce que Gmail et Yahoo exigent, depuis 2024, un désabonnement
-- en un clic (RFC 8058) pour les expéditeurs en volume.
--
-- DANS LES DEUX SENS, et ce n'est pas de la symétrie gratuite : sans le retour, un clic accidentel — ou un
-- scanner de sécurité qui suit le lien — la priverait définitivement de l'annonce, sans qu'elle sache
-- pourquoi ni où le rétablir. Le même jeton rouvre le canal ; il n'y a donc rien à retrouver.
--
-- Ce que le jeton NE peut pas faire : lire une synthèse, connaître une adresse, savoir qui est cette
-- personne. Il ne nomme qu'une ligne de cette table.
create or replace function public.regler_courriels_par_jeton(p_jeton uuid, p_refuse boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_touche integer;
begin
  if p_jeton is null or p_refuse is null then
    return false;
  end if;

  update public.preference_courriel
     set refuse_le = case when p_refuse then coalesce(refuse_le, now()) else null end,
         maj_le    = now()
   where jeton = p_jeton;

  get diagnostics v_touche = row_count;
  -- `false` = jeton inconnu. L'appelant doit le dire sans distinguer « jamais existé » de « effacé » :
  -- les deux réponses doivent se ressembler, sinon le lien devient un oracle d'existence de compte.
  return v_touche > 0;
end;
$$;

-- `anon` a le droit de l'exécuter : c'est tout l'objet d'un désabonnement en un clic. Le paramètre est un
-- uuid v4 — 122 bits d'aléa — et l'action est sans dommage et réversible. La route qui l'appelle passe
-- toutefois par la clé de service, comme le webhook Stripe : le chemin public reste fermé par défaut.
revoke execute on function public.regler_courriels_par_jeton(uuid, boolean) from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 4. LA RÉSERVATION REGARDE LE REFUS
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- Ici, et pas dans le job. Le job pourrait oublier ; la réservation est le point de passage unique du
-- canal, et elle est déjà ce qui décide « a-t-on le droit d'envoyer ». Un refus est une raison de plus de
-- répondre non, au même endroit que les deux autres.
--
-- AVANT le verrou consultatif et avant l'insertion : refuser ne doit RIEN consommer. Insérer puis refuser
-- brûlerait la clé d'idempotence de la période, et le jour où elle se réabonne, la synthèse de cette
-- période-là ne lui serait jamais annoncée.
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
  if p_plafond_heures is null or p_plafond_heures <= 0 then
    raise exception 'plafond_notification_invalide';
  end if;

  -- LE REFUS (T5-2). Rien n'est écrit, rien n'est consommé, rien n'est journalisé : son opposition ne
  -- laisse pas de trace dans la table des envois.
  if exists (
       select 1 from public.preference_courriel p
        where p.utilisatrice_id = p_utilisatrice
          and p.refuse_le is not null
     ) then
    return false;
  end if;

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

  return coalesce(v_reserve, false);
end;
$$;

revoke execute on function public.reserver_notification(uuid, text, text, integer) from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 5. LA PURGE — pour que la trace ne devienne pas un profil (revue 4.9, T5-3)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- `notification_envoyee` ne porte aucun contenu, et c'est vrai ligne à ligne. EMPILÉE, elle dit autre
-- chose : cinquante-deux lignes par an et par personne, c'est un calendrier d'assiduité — et son ABSENCE
-- est aussi parlante que sa présence (une semaine sans ligne est une semaine sans rien écrire). FR-033
-- portera ça à ~365 lignes par personne et par an.
--
-- Les deux usages sont bornés par construction : le plafond regarde 72 h, l'idempotence regarde une clé de
-- période qui ne peut plus être produite une fois la synthèse écrite (l'unicité sur `periode_debut` s'en
-- charge). Une ligne de plus de trente jours ne sert donc à rien — et « ne sert à rien » est exactement la
-- définition de ce qu'on n'a pas le droit de conserver (minimisation, NFR-021).
--
-- Le moteur de rétention unique (AD-14, Epic 6) reprendra cette purge avec les autres. En attendant, elle
-- existe et tourne : une durée de conservation qui attend un epic est une durée de conservation qui n'est
-- pas appliquée.
create or replace function public.purger_notifications_envoyees(p_jours integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supprimees integer;
begin
  -- Même garde que le plafond : `make_interval(days => null)` rendrait NULL, donc `envoye_le < NULL`
  -- rendrait NULL, donc la purge ne supprimerait rien — silencieusement. On refuse plutôt que de faire
  -- croire qu'on purge.
  if p_jours is null or p_jours <= 0 then
    raise exception 'retention_notification_invalide';
  end if;

  delete from public.notification_envoyee
   where envoye_le < now() - make_interval(days => p_jours);

  get diagnostics v_supprimees = row_count;
  return v_supprimees;
end;
$$;

revoke execute on function public.purger_notifications_envoyees(integer) from public, anon, authenticated;
