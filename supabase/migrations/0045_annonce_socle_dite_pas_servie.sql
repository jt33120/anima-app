-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 0045 — LA MENTION DE COMPLÉTION SE DÉPENSE QUAND ELLE EST DITE, PAS QUAND ELLE EST SERVIE
-- Revue de code du 2026-08-12, trouvaille B3 (Story 5.3, AC4 / FR-055)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
--
-- ── LE DÉFAUT ─────────────────────────────────────────────────────────────────────────────────
--
-- `reserver_annonce_socle_complet()` LIT et ÉCRIT d'un seul geste : « la réservation EST la
-- décision ». Elle est appelée par `chargerOuverture()`, donc depuis `app/page.tsx`, donc à CHAQUE
-- RENDU SERVEUR de la scène.
--
-- Or la scène monte ses trois régions en permanence et rend `inert` + `aria-hidden` toutes celles
-- qui ne sont pas actives. Une utilisatrice qui revient de la mairie avec son heure de naissance,
-- l'enregistre, et arrive sur la scène dans la région ARBRE fait dépenser la mention par un rendu
-- qui la place dans une région qu'aucun lecteur d'écran n'annonce et qu'aucun œil ne voit. Si elle
-- recharge la page avant d'ouvrir la conversation, l'état client repart de zéro, la RPC répond
-- désormais `false`, et la phrase est perdue DÉFINITIVEMENT — une seule chance dans la vie d'un
-- compte.
--
-- ── CE QUI REND CE DÉFAUT INSTRUCTIF ──────────────────────────────────────────────────────────
--
-- Le commentaire de 0040 décrit exactement ce mode d'échec et prétend s'en prémunir :
--
--     « Posé par reserver_annonce_socle_complet() au moment où la mention est SERVIE, jamais au
--       recalcul (elle serait perdue pour qui ne rouvre pas la conversation le jour même). »
--
-- L'intention était juste. Mais « servie » y désigne « rendue par le serveur », pas « lue par
-- quelqu'un » — et entre les deux il y a précisément le cas que la phrase voulait éviter. Un
-- commentaire qui nomme le bon danger n'est pas une garde contre lui.
--
-- C'est aussi, mot pour mot, le défaut le plus grave de la revue 4.10 : `reserver_invitation_
-- integration` consommée par un `router.refresh()` avant que l'invitation ne soit affichée. On
-- avait alors corrigé la RÉACTIVITÉ du composant ; on n'avait pas corrigé le fait qu'une écriture
-- irréversible soit déclenchée par un rendu.
--
-- ── LA CORRECTION : DEUX TEMPS ────────────────────────────────────────────────────────────────
--
--   `annonce_socle_due()`        — LECTURE SEULE. Les quatre mêmes conditions, aucun effet.
--   `marquer_annonce_socle_dite()` — L'ÉCRITURE, appelée quand la phrase a ATTEINT L'ÉCRAN.
--
-- ── LA DIRECTION DU DOUTE CHANGE, ET C'EST DÉLIBÉRÉ ───────────────────────────────────────────
--
-- En un temps, le doute allait vers le silence : « parler à tort la dépense ». En deux temps, le
-- risque bascule — si le marquage échoue, la mention sera redite au prochain chargement.
--
-- On l'accepte, parce que les deux coûts ne sont pas du même ordre : entendre deux fois une phrase
-- chaleureuse est un accroc ; ne jamais l'entendre après être allée chercher une copie intégrale
-- d'acte de naissance à la mairie, c'est la story 5.3 qui ne tient pas sa promesse. FR-051 demande
-- « un motif de retour honnête » — une phrase répétée reste honnête, une phrase jamais dite, non.
--
-- ── CE QUI NE CHANGE PAS ──────────────────────────────────────────────────────────────────────
--
-- Le verrou d'avis (sel 4911), l'exclusion AD-17 pendant un épisode de détresse et les 72 h
-- suivantes, `security definer` pour la lecture de `theme_natal`, et l'atomicité de l'écriture
-- (`where … is null`) qui empêche deux onglets de la poser deux fois.

-- ── 1. LA LECTURE ─────────────────────────────────────────────────────────────────────────────

create function public.annonce_socle_due()
returns boolean
language plpgsql
stable
-- `security definer` pour la même raison qu'en 0040 : la condition lit `theme_natal`, dont la
-- policy ne garantit la lecture que sous RLS propriétaire. `auth.uid()` reste celui de l'appelante.
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then return false; end if;

  -- AD-17, ÉCRIT ICI et pas côté appelant : une garde de détresse posée dans du TypeScript est une
  -- garde qu'un second appelant peut oublier. Rien ne se superpose à un épisode, pas même une bonne
  -- nouvelle — et la mention n'est pas perdue pour autant, elle reste due.
  if public.branche_bloquee_par_detresse() then
    return false;
  end if;

  return exists (
    select 1
      from public.utilisatrice u
     where u.id = v_uid
       and u.socle_complete_annonce_le is null   -- jamais dite
       and u.heure_naissance is not null         -- le fait que la mention rapporte
       and exists (                              -- et le thème a bien été RECALCULÉ (0039)
             select 1 from public.theme_natal t
              where t.utilisatrice_id = v_uid and t.version >= 2
           )
  );
end;
$$;

revoke execute on function public.annonce_socle_due() from public, anon;
grant  execute on function public.annonce_socle_due() to authenticated;

comment on function public.annonce_socle_due() is
  'Story 5.3 (AC4), revue B3 : la mention de complétion du socle est-elle DUE ? LECTURE SEULE — aucun effet de bord, donc appelable depuis un rendu serveur sans rien dépenser. C''est `marquer_annonce_socle_dite()` qui la consomme, et seulement une fois la phrase parvenue à l''écran.';

-- ── 2. L'ÉCRITURE ─────────────────────────────────────────────────────────────────────────────

create function public.marquer_annonce_socle_dite()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_lignes integer;
begin
  if v_uid is null then return false; end if;

  -- Même sel qu'en 0040 : deux onglets qui affichent la mention à la même seconde ne posent qu'une
  -- date. Distinct de 4909 (notifications), 4910 (invitation) et 0014 (Stripe).
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 4911));

  -- Les mêmes conditions qu'à la lecture, RÉAFFIRMÉES : la garde ne vit pas dans l'appelant. Sans
  -- `heure_naissance is not null` ici, un appel direct sur `/rest/v1/rpc/` — `authenticated` a le
  -- grant — poserait la date sur un compte sans heure et brûlerait la mention avant qu'elle ne soit
  -- due. C'est la leçon centrale de cette revue : une garde qui n'est pas dans la policy ou dans la
  -- fonction n'existe pas.
  update public.utilisatrice u
     set socle_complete_annonce_le = now()
   where u.id = v_uid
     and u.socle_complete_annonce_le is null
     and u.heure_naissance is not null
     and exists (
       select 1 from public.theme_natal t
        where t.utilisatrice_id = v_uid and t.version >= 2
     );

  get diagnostics v_lignes = row_count;
  return v_lignes > 0;
end;
$$;

revoke execute on function public.marquer_annonce_socle_dite() from public, anon;
grant  execute on function public.marquer_annonce_socle_dite() to authenticated;

comment on function public.marquer_annonce_socle_dite() is
  'Story 5.3 (AC4), revue B3 : la mention de complétion a ATTEINT L''ÉCRAN — on la dépense. Appelée par le client une fois la phrase visible, jamais par un rendu serveur. Idempotente (`where … is null`) et verrouillée : deux onglets ne la posent qu''une fois. Rend `true` si c''est CET appel qui l''a posée.';

-- ── 3. L'ANCIENNE PORTE EST FERMÉE ────────────────────────────────────────────────────────────
--
-- On ne la garde pas « au cas où ». Deux chemins vers la même décision, dont l'un dépense à la
-- lecture, c'est la garantie qu'un appelant futur reprendra le mauvais — et le défaut B3 revient
-- sans que personne ne l'ait décidé.
drop function public.reserver_annonce_socle_complet();
