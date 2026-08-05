-- Migration forward-only — Story 4.7, correctifs de la REVUE ADVERSARIALE (79 agents, 2026-08).
--
-- Deux défauts de la couche base, tous deux invisibles jusqu'à ce qu'ils fassent mal :
--   (1) une COURSE dans `progresser_feuillaison` : deux tours concurrents le même jour donnaient DEUX
--       incréments d'intensité — et comme l'arbre ne régresse jamais (FR-029), c'était définitif ;
--   (2) `branche_retour` n'avait aucun index soutenant ses clés étrangères : l'effacement FR-067
--       dégénérait en balayage séquentiel, sur le chemin où la lenteur est le moins acceptable.

-- ── (1) [REVUE] La course de la feuillaison ───────────────────────────────────────────────────────────
-- Séquence perdante : deux tours partent presque en même temps (double envoi, retry réseau, deux onglets).
-- A et B insèrent chacun leur ligne de retour — clés (branche, entrée) DIFFÉRENTES, donc aucun conflit.
-- Puis chacun teste « existe-t-il un AUTRE retour du même jour ? » : les deux transactions ne voient pas
-- encore la ligne de l'autre (READ COMMITTED), les deux répondent NON, les deux incrémentent. Résultat :
-- +0,4 au lieu de +0,2 pour un seul jour — « au fil des semaines » devient « au fil des doubles-clics ».
--
-- Le correctif est le patron déjà employé par `creer_branche_depuis_signal` (0021 L180) : SÉRIALISER sur
-- la ligne de branche avec un `select … for update` AVANT de lire le ledger. La seconde transaction
-- attend, voit alors le retour de la première, et renonce. On verrouille la BRANCHE (et pas le ledger)
-- parce que c'est elle la ressource disputée : une branche, un incrément par jour.
create or replace function public.progresser_feuillaison(p_branche_id uuid, p_cle_tour text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_entree  uuid;
  v_jour    date;
  v_inseres int;
  v_etat    text;
begin
  -- (1) [DUR / AD-17] fast-fail : l'arbre ne pousse pas pendant un épisode ni dans les 72 h (FR-042/FR-046).
  if public.branche_bloquee_par_detresse() then
    raise exception 'branche : aucune feuillaison ne progresse pendant un épisode de détresse ni dans les 72 h (AD-17, Story 4.7)';
  end if;

  -- (2) L'entrée du tour, résolue EN SQL depuis la clé de tour (patron `enregistrer_signal_reconceptualisation`,
  -- 0020). Ordre TOTAL (revue) : `limit 1` sans `order by` rendait la ligne choisie non déterministe si
  -- deux entrées partageaient la même clé de tour — donc l'idempotence elle-même devenait aléatoire.
  select e.id into v_entree
    from public.entree_journal e
   where e.utilisatrice_id = (select auth.uid())
     and e.cle_tour = p_cle_tour
     and e.role = 'utilisatrice'
   order by e.cree_le asc, e.id asc
   limit 1;
  if v_entree is null then
    raise exception 'branche : tour introuvable ou non possédé (isolation, Story 4.7)';
  end if;

  -- (3) La branche doit être POSSÉDÉE — et on la VERROUILLE ici (revue) : ce `for update` sérialise les
  -- tours concurrents sur cette branche. Sans lui, deux appels simultanés incrémentaient tous les deux.
  select b.etat into v_etat
    from public.branche b
   where b.id = p_branche_id and b.utilisatrice_id = (select auth.uid())
   for update;
  if v_etat is null then
    raise exception 'branche : branche introuvable ou non possédée (isolation, Story 4.7)';
  end if;

  v_jour := (now() at time zone 'Europe/Paris')::date;

  -- (4) Le LEDGER : idempotence STRUCTURELLE. Un retry du même tour ne franchit pas cette ligne.
  insert into public.branche_retour (branche_id, utilisatrice_id, entree_journal_id, jour_paris)
  values (p_branche_id, (select auth.uid()), v_entree, v_jour)
  on conflict (branche_id, entree_journal_id) do nothing;
  get diagnostics v_inseres = row_count;
  if v_inseres = 0 then
    return false; -- déjà consigné : rien ne bouge
  end if;

  -- (5) « AU FIL DES SEMAINES » : un seul incrément par jour civil Paris. Le verrou de (3) garantit que
  -- cette lecture voit bien les retours des transactions concurrentes déjà validées.
  if exists (select 1 from public.branche_retour r
              where r.branche_id = p_branche_id
                and r.jour_paris = v_jour
                and r.entree_journal_id <> v_entree) then
    return false;
  end if;

  -- (6) Une branche déjà en pleine lumière est arrivée : le retour reste consigné, la matière ne bouge plus.
  if v_etat not in ('naissance', 'feuillaison') then
    return false;
  end if;

  -- (7) La matière avance d'un DEGRÉ (jamais un flip d'enum, FR-028).
  update public.branche
     set etat             = 'feuillaison',
         intensite        = least(1::real, intensite + public.branche_pas_feuillaison()),
         date_feuillaison = case when date_feuillaison is null then now() else date_feuillaison end
   where id = p_branche_id and utilisatrice_id = (select auth.uid());

  return true;
end;
$$;

-- ── (2) [REVUE] Les index qui manquaient au ledger ────────────────────────────────────────────────────
-- `branche_retour` a une PK sur (branche_id, entree_journal_id) — donc `branche_id` est couvert par le
-- préfixe. Mais ses DEUX autres clés étrangères ne l'étaient pas : la cascade depuis `utilisatrice` et
-- celle depuis `entree_journal` déclenchaient un Seq Scan PAR LIGNE SUPPRIMÉE. Sur l'effacement FR-067
-- d'un compte de plusieurs milliers d'entrées de journal, c'est quadratique — et c'est précisément le
-- chemin où une lenteur se paie cher : une suppression qui traîne est une suppression qui inquiète.
create index branche_retour_utilisatrice_idx on public.branche_retour (utilisatrice_id);
create index branche_retour_entree_idx on public.branche_retour (utilisatrice_id, entree_journal_id);

comment on function public.progresser_feuillaison(uuid, text) is
  'Story 4.7 (AC2), corrigé par la revue : un RETOUR spontané fait avancer la matière d''un degré. Sérialisé par un `select … for update` sur la branche (deux tours concurrents le même jour donnaient DEUX incréments, définitivement). Résolution du tour en ordre TOTAL. Idempotent (ledger branche_retour), un incrément par jour civil Paris, plafonné à 1. Ne peut PAS écrire la pleine lumière. Gardé AD-17.';
