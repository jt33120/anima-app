-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 0055 — LE GESTE DE PAUSE (Story 6.4, FR-036 · AD-17 · NFR-002)
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- Anam peut dire, au plus une fois par mois et uniquement dans le fil, qu'il est permis de laisser
-- reposer. Cette migration porte la seule chose qui ne peut PAS vivre en TypeScript : la RÉSERVATION
-- DE LA PAROLE, et la garde de détresse qui la précède.
--
-- ── CE QU'ELLE N'AJOUTE PAS ────────────────────────────────────────────────────────────────────
--
--   • AUCUNE valeur au CHECK `notification_envoyee_motif_check` — la pause vit en conversation, un
--     point c'est tout (AC5, seconde moitié). `reserver_notification` n'est pas ouverte.
--   • AUCUNE policy sur la table créée — voir juste en dessous.
--   • AUCUNE lecture de `entree_journal` ici : la mesure se fait côté domaine (`rythme-pause.ts`),
--     à partir des seuls horodatages. La base reçoit deux nombres déjà calculés et ne les recalcule
--     pas — une seconde source pour la même mesure serait la divergence R1-bis, déjà payée deux fois.
--
-- ── POURQUOI LA TABLE N'A AUCUNE POLICY ────────────────────────────────────────────────────────
--
-- Doctrine cardinale du dépôt : `authenticated` détient le DML sur toute table de `public`. Une
-- garde qui ne vivrait que dans la RPC ne garderait donc rien — on pourrait insérer une ligne pour
-- se faire taire Anam pendant un mois, ou en supprimer une pour la faire parler à volonté.
--
-- `pause_rythme` est deny-by-default, comme `usage_ia` (0008), `probe` (0001) et `audit_securite`
-- (0006) : aucune policy n'est créée, donc aucune session utilisatrice ne la lit ni ne l'écrit. Le
-- SEUL chemin est la fonction `security definer` ci-dessous.
--
-- C'est aussi ce qui rend l'AC5 vrai par construction : les deux compteurs journalisés pour la revue
-- produit ne peuvent atteindre aucun client, puisque personne ne peut lire la table. Ils n'ont pas
-- non plus à traverser le type `Ouverture`, qui n'a aucun champ numérique (FR-031).
-- ════════════════════════════════════════════════════════════════════════════════════════════════

create table public.pause_rythme (
  id              uuid        primary key default gen_random_uuid(),
  utilisatrice_id uuid        not null references public.utilisatrice(id) on delete cascade,
  propose_le      timestamptz not null default now(),
  -- ⚠️ LES DEUX SEULES COLONNES DE MESURE, ET AUCUNE COLONNE DE CONTENU. C'est la journalisation de
  -- l'AC5 (« le cas est journalisé pour revue produit sans exposer de contenu art. 9 ») : des
  -- nombres, une date, rien de ce qui a été écrit. NFR-002.
  seances         integer     not null,
  minutes         integer     not null,
  -- Une contre-métrique qui accepterait des nombres absurdes ne mesurerait plus rien. La borne haute
  -- est large à dessein : elle attrape le défaut de calcul, pas l'usage intense.
  constraint pause_rythme_mesure_plausible check (seances >= 0 and minutes >= 0 and minutes <= 20160)
);

create index pause_rythme_utilisatrice_idx on public.pause_rythme (utilisatrice_id, propose_le desc);

alter table public.pause_rythme enable row level security;
alter table public.pause_rythme force  row level security;

-- Aucune policy créée VOLONTAIREMENT : deny-by-default. Voir l'en-tête.

comment on table public.pause_rythme is
  'Story 6.4 (FR-036) : une ligne = une proposition de pause effectivement faite. Sert deux choses a la fois — la fenetre d''apaisement (la reservation EST la decision) et la journalisation pour revue produit. NON-art. 9 : aucune colonne de contenu. Deny-by-default, ecrite uniquement par reserver_pause_rythme().';

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- LA RÉSERVATION EST LA DÉCISION
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- Patron de `reserver_invitation_integration` (0036) et de `reserver_notification` : deux rendus
-- concurrents — deux onglets, un rafraîchissement — ne peuvent pas dire deux fois la même chose.
--
-- ⚠️ LA GARDE DE DÉTRESSE EST ÉVALUÉE AVANT L'INSERTION, ET C'EST TOUT L'ENJEU DE L'ORDRE DES
-- LIGNES. Proposer de « laisser reposer » à quelqu'un qui traverse un épisode se lit comme « tu
-- utilises trop cette application » au moment précis où elle en a besoin (AD-17). Mais si le refus
-- consommait la fenêtre de trente jours, l'épisode ferait TAIRE la pause pour un mois : la garde
-- n'aurait plus pour effet de la différer, mais de la supprimer. Un `return false` avant tout
-- `insert` est la différence entre les deux.
-- ════════════════════════════════════════════════════════════════════════════════════════════════

create function public.reserver_pause_rythme(
  p_seances          integer,
  p_minutes          integer,
  p_apaisement_jours integer
)
returns boolean
language plpgsql
-- `security definer`, et c'est OBLIGATOIRE : `pause_rythme` est deny-by-default, donc une fonction
-- `invoker` ne pourrait pas y écrire. `auth.uid()` reste celui de l'APPELANTE — il se lit dans les
-- claims du jeton, que le mode de sécurité ne change pas.
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_dernier   timestamptz;
begin
  if v_uid is null then return false; end if;
  if p_apaisement_jours is null or p_apaisement_jours <= 0 then
    raise exception 'apaisement_invalide';
  end if;
  if p_seances is null or p_minutes is null or p_seances < 0 or p_minutes < 0 then
    raise exception 'mesure_invalide';
  end if;

  -- ⚠️ AVANT TOUT VERROU ET AVANT TOUT `insert` (AD-17). Voir l'en-tête du bloc.
  if public.branche_bloquee_par_detresse() then
    return false;
  end if;

  -- Sel distinct de 4909 (notifications), 4910 (invitation d'intégration) et 0014 (Stripe) : quatre
  -- espaces de verrous qui ne doivent pas s'attendre l'un l'autre.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 4911));

  select max(p.propose_le) into v_dernier
    from public.pause_rythme p where p.utilisatrice_id = v_uid;

  -- Dit récemment : elle se tait. AUCUNE condition de réarmement autre que le temps — vérifier si
  -- elle a ralenti reviendrait à vérifier si elle a obéi (décision D6 de la story).
  if v_dernier is not null and v_dernier > now() - make_interval(days => p_apaisement_jours) then
    return false;
  end if;

  insert into public.pause_rythme (utilisatrice_id, seances, minutes)
  values (v_uid, p_seances, p_minutes);
  return true;
end;
$$;

revoke all    on function public.reserver_pause_rythme(integer, integer, integer) from public, anon;
grant  execute on function public.reserver_pause_rythme(integer, integer, integer) to authenticated;

comment on function public.reserver_pause_rythme(integer, integer, integer) is
  'Story 6.4 (AC3/AC5) : Anam a-t-elle le droit de proposer une pause MAINTENANT ? Vrai au plus une fois par fenetre d''apaisement, jamais pendant la fenetre de detresse — et un refus pour detresse ne consomme PAS la fenetre. La reservation EST la decision, atomique comme reserver_invitation_integration. La ligne inseree porte aussi la journalisation de revue produit (deux nombres, aucun contenu).';
