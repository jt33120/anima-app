-- Migration forward-only — revue des Epics 1 à 4 (trouvaille #6) : Anam n'écrivait jamais sa moitié.
--
-- ══ LE DÉFAUT ═══════════════════════════════════════════════════════════════════════════════════
--
-- `entree_journal` porte une colonne `role ('utilisatrice'|'anam')` depuis 0016, un index unique
-- `(utilisatrice_id, cle_tour, role)`, et TROIS lecteurs écrits en supposant les deux côtés :
--
--   • `depot-fil.ts` : « quarante entrées, soit vingt échanges » — c'est quarante entrées d'ELLE ;
--   • `toursDHistorique` (Conversation.tsx) : une branche `t.role === "anam"` jamais atteinte ;
--   • `PLAFOND_ENTREES` : « 200 entrées, c'est-à-dire environ cent tours de conversation ».
--
-- Aucun écrivain ne posait jamais `role = 'anam'`. Conséquence à l'écran : au rechargement, elle
-- retrouve ses propres messages À LA SUITE, sans une seule réponse d'Anam. Un monologue — sur une
-- application où l'écran de consentement promet « pour qu'elle se souvienne d'une fois sur l'autre ».
-- Et `contexte_branche` (0023), qui rend le fil autour d'une branche AVEC son `role`, n'a jamais eu
-- qu'un seul rôle à rendre.
--
-- ══ POURQUOI UNE RPC SERVICE_ROLE, ET PAS UNE POLICY ÉLARGIE ════════════════════════════════════
--
-- 0016 épingle `role = 'utilisatrice'` dans le WITH CHECK, et écrit pourquoi : « le côté anam est
-- server-authoritative (une future story l'écrira via une RPC attestée-serveur, jamais sous JWT
-- direct — sinon une utilisatrice forgerait de fausses paroles d'Anam, immuables) ». C'est cette
-- story-là. Élargir la policy, ou granter cette fonction à `authenticated`, rendrait exactement ce
-- que 0016 refuse : n'importe qui pourrait faire dire n'importe quoi à Anam, de façon inaltérable.
--
-- ══ LA GARDE, ET POURQUOI ELLE NE DUPLIQUE RIEN ═════════════════════════════════════════════════
--
-- On ne re-dérive PAS ici « consentement art. 9 vivant + majorité établie + propriétaire ». Deux
-- écritures de la même règle finissent par ne plus dire la même chose (leçon R1, payée assez de
-- fois). On exige plutôt que LE TOUR D'ELLE existe déjà pour cette clé : il a été gravé sous JWT,
-- donc à travers la policy, donc à travers les trois conditions — le même tour, la même seconde.
-- La garde est ainsi strictement plus forte ET plus simple : pas d'orpheline, pas de divergence.
--
-- ⚠️ LA LIMITE, DITE PLUTÔT QUE TUE. `on conflict do nothing` : si le flux aboutit côté serveur
-- (donc grave) mais que la connexion meurt avant que la cliente ne reçoive `fin`, elle voit un échec
-- et peut réessayer — même `cle_tour`, réponse différente. Le journal garde alors la PREMIÈRE, son
-- écran affiche la seconde. On ne peut pas trancher autrement : le verbatim est immuable (le trigger
-- de 0016 refuse tout update, y compris à service_role), et un second tour d'Anam sous la même clé
-- casserait l'idempotence qui protège du « Réessayer ». Fenêtre étroite, divergence nommée.

create or replace function public.consigner_tour_anam(
  cible uuid, p_cle_tour text, p_contenu text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Un tour vide n'est pas un tour. On ne grave pas une bulle vide : à la relecture, elle se lit
  -- comme un message effacé — l'angoisse exacte que le fil retrouvé répare.
  if p_contenu is null or btrim(p_contenu) = '' then
    return;
  end if;

  if not exists (
    select 1 from public.entree_journal e
     where e.utilisatrice_id = cible
       and e.cle_tour = p_cle_tour
       and e.role = 'utilisatrice'
  ) then
    raise exception 'consigner_tour_anam : aucun tour d''utilisatrice sous cette clé — le côté anam ne s''écrit jamais seul';
  end if;

  insert into public.entree_journal (utilisatrice_id, cle_tour, role, contenu)
  values (cible, p_cle_tour, 'anam', p_contenu)
  on conflict (utilisatrice_id, cle_tour, role) do nothing;
end;
$$;

revoke all on function public.consigner_tour_anam(uuid, text, text) from public, anon, authenticated;
grant execute on function public.consigner_tour_anam(uuid, text, text) to service_role;

comment on function public.consigner_tour_anam(uuid, text, text) is
  'Revue Epics 1-4 : grave le côté `anam` d''un tour — attesté SERVEUR (service_role seul ; un JWT ne peut pas forger de paroles d''Anam, 0016). Garde : le tour d''utilisatrice de la MÊME clé doit exister, ce qui prouve que la policy art. 9 est passée pour ce tour, sans re-dériver ses conditions (R1). Idempotent par (utilisatrice_id, cle_tour, role).';
