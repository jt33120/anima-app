-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 0062 — ARRÊTER LES COURRIELS D'ANAM DEPUIS L'APPLICATION (revue Epic 6, R7 · art. 21)
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- ⚠️ **IL N'EXISTAIT AUCUN CHEMIN, ET PERSONNE NE L'AVAIT VU.**
--
-- La 4.9 a construit le désabonnement PAR JETON (`regler_courriels_par_jeton`) : sans session, en un
-- clic, depuis le lien porté par chaque courriel — c'est l'obligation RFC 8058 et c'est bien fait.
--
-- Mais aucun fichier de `app/` ne lit ni n'écrit `preference_courriel`, et **aucun lien de
-- l'application ne mène à `/desabonnement`**. Le seul moyen d'arrêter les courriels d'Anam était donc
-- de retrouver un courriel déjà reçu. Quelqu'un qui les a supprimés, ou classés en indésirables,
-- n'avait plus de porte du tout.
--
-- Pire, l'écran s'intitule « Réglages » et son unique bouton dit « Ne plus rien recevoir sur cet
-- appareil » : elle clique, croit avoir tout arrêté, et continue de recevoir rappels d'échéance et
-- synthèses. Le produit n'a pas menti — il a laissé croire, ce qui revient au même quand c'est nous
-- qui avons choisi les mots.
--
-- ── CE CHEMIN N'EST GARDÉ PAR AUCUNE CONDITION, ET C'EST DÉLIBÉRÉ ──────────────────────────────
--
-- Ni consentement art. 9, ni barrière de minorité, ni fenêtre de détresse (AD-9). Le raisonnement est
-- celui de la 3.5 sur la résiliation, et il ne se rouvre pas : `limites_levees` est vrai PENDANT un
-- épisode de détresse. Garder ce geste empêcherait quelqu'un en crise de faire cesser des courriels
-- qu'elle ne supporte plus — le dark pattern maximal, sur la personne la plus vulnérable du produit.
--
-- L'article 21 ne connaît d'ailleurs aucune condition : l'opposition au canal s'exerce, elle ne se
-- mérite pas. Un compte suspendu pour minorité garde le droit de faire taire nos envois.
--
-- ── POURQUOI UNE FONCTION ET PAS UNE POLICY D'ÉCRITURE ────────────────────────────────────────
--
-- `preference_courriel` n'a AUCUNE policy d'écriture depuis 0034 : tout passe par des fonctions, y
-- compris le chemin sans session. Ouvrir un `update` sous JWT ici laisserait l'utilisatrice écrire
-- `jeton` — c'est-à-dire se donner le jeton de quelqu'un d'autre, ou s'en fabriquer un connu d'elle
-- seule. La colonne qu'elle a le droit de bouger est `refuse_le`, et rien d'autre ; une fonction est
-- la seule forme qui le dise exactement.
create or replace function public.regler_mes_courriels(p_refuse boolean)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'courriels_sans_identite' using errcode = '42501';
  end if;
  if p_refuse is null then
    raise exception 'courriels_choix_absent' using errcode = '22023';
  end if;

  -- La ligne naît au premier ENVOI (création paresseuse, 0034) : quelqu'un qui n'a encore rien reçu
  -- n'en a pas. Refuser d'avance doit pourtant marcher — sinon le réglage ne serait disponible qu'après
  -- avoir subi ce qu'on veut arrêter.
  insert into public.preference_courriel (utilisatrice_id)
  values (v_uid)
  on conflict (utilisatrice_id) do nothing;

  -- `coalesce(refuse_le, now())` : la date est la PREUVE de la prise en compte de son opposition
  -- (art. 21), pas un compteur. Un second refus ne la repousse pas — sinon on effacerait la date du
  -- jour où elle a dit non pour la première fois.
  update public.preference_courriel
     set refuse_le = case when p_refuse then coalesce(refuse_le, now()) else null end,
         maj_le    = now()
   where utilisatrice_id = v_uid;

  return true;
end;
$fn$;

revoke all    on function public.regler_mes_courriels(boolean) from public, anon;
grant  execute on function public.regler_mes_courriels(boolean) to authenticated;

comment on function public.regler_mes_courriels(boolean) is
  'Revue Epic 6 (R7 · art. 21) : arrêter ou reprendre les courriels d''Anam DEPUIS L''APPLICATION. '
  'Jumelle sous session de `regler_courriels_par_jeton` (4.9), qui ne servait que le lien RFC 8058 d''un '
  'courriel déjà reçu — seul chemin existant, donc inatteignable pour qui les avait supprimés. '
  'Volontairement gardée par RIEN : ni art. 9, ni minorité, ni détresse. Même raison qu''en 3.5 pour la '
  'résiliation — `limites_levees` est vrai pendant un épisode, et garder ce geste enfermerait quelqu''un '
  'en crise dans un canal qu''elle ne supporte plus. Une fonction plutôt qu''une policy d''écriture : '
  'sous un `update` ouvert, elle pourrait écrire `jeton`.';
