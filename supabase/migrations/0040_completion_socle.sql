-- Migration forward-only — Story 5.3 : la mention UNIQUE de la complétion du socle (FR-051, AC4).
--
-- « Anam le mentionne UNE SEULE FOIS puis plus jamais. » Trois mots de l'énoncé portent chacun une
-- exigence technique distincte, et aucune ne s'obtient sans les deux autres :
--
--   • UNE FOIS  → un marqueur persisté. Sans lui, la mention repart à chaque chargement de la scène.
--     C'est la faute que la 4.10 a déjà payée et documentée : « la plus agaçante des répétitions,
--     celle qui se répète parce qu'elle n'a pas obéi » (FR-034).
--   • UNE SEULE → la pose du marqueur doit être ATOMIQUE. Deux onglets ouverts en même temps ne
--     doivent pas pouvoir dire deux fois la même chose. La RÉSERVATION EST LA DÉCISION — patron
--     `reserver_notification` (0009) puis `reserver_invitation_integration` (0036).
--   • MENTIONNE → le marqueur se pose au moment où la mention est SERVIE, pas au moment du recalcul.
--     Posé au recalcul, il ferait perdre la mention à quelqu'un qui ne rouvrira la conversation que
--     trois jours plus tard : elle n'aurait jamais rien lu, et le système croirait l'avoir dit.

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 1. Le marqueur — une colonne ORDINAIRE, pas une table
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
--
-- `invitation_integration` (0036) est une table parce qu'elle porte une FENÊTRE réarmable : sa date
-- bouge, et un mouvement réel la réarme. Ici la mention est définitive — une date qui se pose une
-- fois et qu'on ne relit que pour savoir si elle existe. Une table pour ça serait une jointure de
-- plus sans une seule règle de plus.
--
-- Aucune donnée art. 9 : c'est l'horodatage d'un événement produit, pas un contenu.
alter table public.utilisatrice add column socle_complete_annonce_le timestamptz;

comment on column public.utilisatrice.socle_complete_annonce_le is
  'Story 5.3 (AC4) : quand Anam a mentionné — UNE SEULE FOIS — que l''heure de naissance était enregistrée et le thème recalculé. Posé par reserver_annonce_socle_complet() au moment où la mention est SERVIE, jamais au recalcul (elle serait perdue pour qui ne rouvre pas la conversation le jour même). `null` = jamais dit.';

-- ── PAS DE TRIGGER D'ÉCRITURE DIRECTE, ET C'EST UN CHOIX ───────────────────────────────────────
--
-- Ailleurs dans ce dépôt, une colonne posée par le serveur est protégée d'une écriture cliente
-- (`calcule_le`, 0039 ; `date_naissance`, 0003). Ici on ne le fait PAS, et la raison mérite d'être
-- écrite pour qu'on ne prenne pas cette absence pour un oubli.
--
-- `authenticated` a bien le grant UPDATE sur `utilisatrice` (c'est ainsi qu'un prénom se corrige,
-- FR-064), et la RLS le borne à SA PROPRE ligne. Le pire qu'une personne puisse donc se faire en
-- posant elle-même cette date, c'est **se priver d'une phrase**. Aucune donnée n'est perdue, aucune
-- garde n'est franchie, personne d'autre n'est touché.
--
-- Le seul moyen d'empêcher ça tout en laissant passer la RPC serait un drapeau de transaction que
-- le trigger consulterait. On ajouterait un mécanisme à comprendre, dans deux fonctions, pour
-- protéger quelqu'un de sa propre requête SQL contre son propre confort. Le rapport ne tient pas.

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 2. La réservation — atomique, et elle EST la décision
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
--
-- Rend `true` AU PLUS UNE FOIS dans la vie d'un compte. Quatre conditions, toutes nécessaires :
--
--   1. jamais dit (`socle_complete_annonce_le is null`) ;
--   2. l'heure de naissance EST là — c'est le fait que la mention rapporte ;
--   3. le thème a été RECALCULÉ (`version >= 2`). Sans cette condition, le jour où l'onboarding
--      demandera l'heure dès l'inscription, Anam annoncerait « j'ai recalculé ton thème » à
--      quelqu'un dont le thème n'a jamais été calculé qu'une fois. La version dit exactement ce
--      qu'on veut savoir, et elle est déjà là (0039) ;
--   4. AUCUN épisode de détresse en cours ni dans les 72 h (AD-17). Rien ne se superpose à un
--      épisode, pas même une bonne nouvelle. La mention n'est pas PERDUE pour autant : elle reste
--      due, et elle sortira après — c'est précisément l'intérêt d'un marqueur posé à la parole.
create function public.reserver_annonce_socle_complet()
returns boolean
language plpgsql
-- `security definer` par cohérence avec les deux autres réservations (0009, 0036), et parce que la
-- condition lit `theme_natal`, dont la policy ne garantit la lecture que sous RLS propriétaire.
-- `auth.uid()` reste celui de l'APPELANTE : il se lit dans les claims du jeton, que le mode de
-- sécurité ne change pas.
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_lignes integer;
begin
  if v_uid is null then return false; end if;

  -- Sel distinct de 4909 (notifications), 4910 (invitation d'intégration) et 0014 (Stripe) : quatre
  -- espaces de verrous qui ne doivent pas s'attendre l'un l'autre.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 4911));

  -- AD-17. Écrit ICI plutôt que côté appelant : une garde de détresse posée dans du TypeScript est
  -- une garde qu'un second appelant peut oublier. Celle-ci ne s'oublie pas.
  if public.branche_bloquee_par_detresse() then
    return false;
  end if;

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

revoke execute on function public.reserver_annonce_socle_complet() from public, anon;
grant  execute on function public.reserver_annonce_socle_complet() to authenticated;

comment on function public.reserver_annonce_socle_complet() is
  'Story 5.3 (AC4) : Anam a-t-elle le droit de mentionner MAINTENANT que l''heure est enregistrée et le thème recalculé ? Vrai AU PLUS UNE FOIS dans la vie d''un compte. La réservation EST la décision, atomique comme reserver_invitation_integration (0036) : deux onglets ne peuvent pas la dire deux fois. Suspendue pendant un épisode de détresse et les 72 h suivantes (AD-17) — la mention n''est alors pas perdue, elle reste due.';
