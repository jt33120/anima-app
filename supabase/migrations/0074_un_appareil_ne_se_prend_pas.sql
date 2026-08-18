-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 0074 — UN APPAREIL NE SE PREND PAS (revue adversariale du 2026-08-18, R7 et R26)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
--
-- ══ CE QUI ÉTAIT POSSIBLE, ET CE QUE LE COMMENTAIRE AFFIRMAIT ═════════════════════════════════
--
-- `abonner_poussee` (0053) est `security definer` et accordée à `authenticated`. Son commentaire
-- affirmait sa propre sûreté, en gras :
--
--     « CETTE FONCTION N'A PAS DE PARAMÈTRE `p_utilisatrice`, ET C'EST TOUTE SA SÛRETÉ. Elle lit
--       `auth.uid()`. Il n'existe donc aucune valeur à forger. »
--
-- C'était vrai du SUJET de l'insertion : on ne peut abonner que soi-même. C'était faux de l'OBJET de
-- la suppression, qui est un paramètre entièrement fourni par l'appelante :
--
--     delete from public.abonnement_poussee where endpoint = p_endpoint;
--
-- Aucune clause de propriété, et `security definer` ignore la RLS. C'était la seule écriture
-- inter-comptes du schéma. Il suffisait de connaître l'endpoint de quelqu'un — il voyage EN CLAIR
-- dans l'export RGPD de cette personne (0057) et dans les journaux du service de poussée.
--
-- ⚠️ ET LE TORT EST PIRE QUE « ELLE NE REÇOIT PLUS ». L'adaptateur POSTe ZÉRO OCTET
-- (`lib/poussee/adaptateurs/web-push.ts` : « `p256dh` et `auth` de l'abonnement ne servent donc PAS
-- ici »). Les clés forgées par l'attaquante n'ont donc aucune importance pour la livraison : seul
-- l'endpoint compte. Après la reprise, le job du socle lit `endpoints_poussee(attaquante)` et POUSSE
-- SUR L'APPAREIL DE LA VICTIME, à l'heure que l'attaquante choisit dans sa propre
-- `preference_socle`. Le téléphone de quelqu'un sonne à trois heures du matin, tous les jours, et
-- cette personne n'a plus aucune ligne en base pour l'expliquer — `/reglages` lui dit
-- « aucun appareil ».
--
-- ══ POURQUOI PAS `and utilisatrice_id = auth.uid()` ═══════════════════════════════════════════
--
-- Parce que ça casserait le cas que le `delete` existe pour servir, et il est banal : deux comptes
-- sur un même navigateur reçoivent LE MÊME endpoint — il appartient à l'appareil, pas au compte.
-- Sans reprise possible, l'index unique refuse l'insertion et la seconde personne n'est jamais
-- notifiée, silencieusement, puisque son navigateur s'est bien abonné.
--
-- ══ LE DISCRIMINANT ÉTAIT DÉJÀ ÉCRIT, AILLEURS ═══════════════════════════════════════════════
--
-- `0057_export_donnees.sql` retire `cle_p256dh` et `cle_auth` de l'export, et dit pourquoi : ce sont
-- « des CAPACITÉS — de quoi la désabonner sans être elle », dans un document « qu'elle va
-- transporter, envoyer par courriel, poser sur un disque partagé ».
--
-- C'est exactement la ligne qui sépare les deux cas. Qui POSSÈDE l'appareil connaît les clés :
-- `pushManager.subscribe()` rend au second compte du même navigateur la MÊME souscription — même
-- endpoint, mêmes clés. Qui a seulement LU un export ne les connaît pas.
--
-- La reprise est donc conditionnée à la présentation des clés en place. Le cas légitime passe sans
-- rien changer ; l'attaque échoue bruyamment.
--
-- ⚠️ EFFET DE BORD VOULU : R26 TOMBE AVEC R7. La revue reprochait à l'export de retirer la mauvaise
-- colonne — les clés plutôt que l'endpoint, alors que c'était l'endpoint SEUL qui était devenu la
-- capacité. Après ce correctif, l'endpoint seul ne permet plus rien : l'export retire de nouveau la
-- bonne colonne, et il n'a pas besoin d'être touché.
--
-- ⚠️ CE QUE CETTE GARDE N'EST PAS. Ce n'est pas une comparaison à temps constant. Deviner 87
-- caractères de base64url par force brute n'est pas un chemin d'attaque, et un oracle temporel à
-- travers PostgREST encore moins ; complexifier ici achèterait une propriété que rien ne menace.
-- La garde reste ce qu'elle doit être : on ne déloge que sur preuve de possession.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

create or replace function public.abonner_poussee(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moi          uuid := auth.uid();
  v_proprietaire uuid;
begin
  if v_moi is null then
    raise exception 'session_absente';
  end if;

  -- ⚠️ `for update` : entre le constat et la reprise il y a une fenêtre, et cette fenêtre s'appelle
  -- « deux propriétaires ». L'index unique reste le filet en dernier ressort, mais un échec d'index
  -- serait un message illisible là où on peut en donner un juste.
  select a.utilisatrice_id into v_proprietaire
    from public.abonnement_poussee a
   where a.endpoint = p_endpoint
   for update;

  -- L'appareil est à quelqu'un d'autre : il faut PROUVER qu'on l'a en main, pas seulement qu'on
  -- connaît son adresse. Les clés ne sortent jamais du navigateur ni de l'export (0057).
  if v_proprietaire is not null and v_proprietaire <> v_moi then
    if not exists (
      select 1
        from public.abonnement_poussee a
       where a.endpoint   = p_endpoint
         and a.cle_p256dh = p_p256dh
         and a.cle_auth   = p_auth
    ) then
      raise exception 'abonner_poussee : cet appareil est abonné ailleurs, et les cles presentees ne sont pas les siennes (revue adversariale, R7)';
    end if;
  end if;

  -- L'appareil change de main. Les contraintes de forme de la table s'appliquent à l'insertion
  -- ci-dessous exactement comme à une écriture directe : cette fonction ne les contourne pas.
  delete from public.abonnement_poussee where endpoint = p_endpoint;

  insert into public.abonnement_poussee (utilisatrice_id, endpoint, cle_p256dh, cle_auth)
  values (v_moi, p_endpoint, p_p256dh, p_auth);

  -- La préférence naît avec le premier abonnement, à l'heure par défaut. Création PARESSEUSE, sur le
  -- patron de `jeton_courriel` (0034) : quelqu'un qui ne s'abonne jamais n'a aucune raison de porter
  -- une préférence de notification. Et la sélection exige cette ligne — sans elle, l'abonnement
  -- n'aurait servi à rien.
  insert into public.preference_socle (utilisatrice_id)
  values (v_moi)
  on conflict (utilisatrice_id) do nothing;
end;
$$;

comment on function public.abonner_poussee(text, text, text) is
  'Story 6.2, durcie par la revue adversariale du 2026-08-18 (R7) : abonne l''APPELANTE (auth.uid(), jamais un parametre) et ne deloge la ligne d''un AUTRE compte que sur presentation des cles en place — preuve de possession de l''appareil. Le commentaire d''origine affirmait que l''absence de `p_utilisatrice` faisait « toute sa surete » : c''etait vrai du sujet de l''insertion, faux de l''objet de la suppression, dont l''endpoint est fourni par l''appelante et voyage en clair dans l''export RGPD. Deux comptes sur un meme navigateur partagent endpoint ET cles, donc le cas legitime passe. Cree paresseusement la preference d''heure.';
