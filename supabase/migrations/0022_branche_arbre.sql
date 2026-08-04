-- Migration forward-only — Story 4.6 : la PROJECTION de l'arbre + le RENOMMAGE d'une branche.
--
-- 4.5 a posé la table `branche` (couche 3, AD-8) avec la seule NAISSANCE (insert). 4.6 ajoute :
--   • deux LECTURES possédées (security invoker → la RLS propriétaire de 0021/0016 borne à l'appelante) :
--       - `charger_branches_arbre()`  : toutes les branches + le VERBATIM de leur extrait source (la fiche) ;
--       - `charger_echange_source()`  : le message EXACT + son voisinage immédiat (« Voir dans la conversation »).
--   • la PREMIÈRE ÉCRITURE mutante de `branche` : le RENOMMAGE. 0021 n'avait AUCUNE policy update (« renommage = 4.6 »).
--
-- LEÇON R1 (mémoire supabase-rls-write-gate-dans-policy) : `authenticated` a le grant UPDATE table-level → un
--   `.from("branche").update({nom})` DIRECT saute toute RPC et n'est borné QUE par la policy. Donc TOUTE garde
--   du renommage vit dans la POLICY WITH CHECK (atomique), pas dans la seule RPC :
--     • propriétaire + consentement art. 9 valide/non révoqué + compte non barré-minorité (AD-13) ;
--       `a_consenti_art9()` est OBLIGATOIRE ici — le `nom` est un DÉPÔT de contenu art. 9 neuf (miroir fait_extrait
--       0018:84, ≠ la transition de pointeur du signal 0021:118 qui l'omet volontairement) ;
--     • AC2 [DUR] : `nom` non vide, via `branche_nom_significatif` (0021:29, aligné .trim() — jamais length(btrim())).
-- LEÇON « fige tout sauf le nom » : le WITH CHECK ne voit QUE la ligne NEW (pas quelles colonnes changent) → un
--   update direct pourrait forger `etat='fruit'`/`date_naissance` et pré-empter le cycle de vie monotone de 4.7.
--   Un TRIGGER `before update` (mord service_role, que la RLS ne borne pas) LÈVE si toute colonne AUTRE que `nom`
--   (et `maj_le`, tenu par le trigger existant) change. En 4.7 ce trigger sera ÉTENDU pour autoriser la transition
--   monotone etat/intensite sous sa propre garde.

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════
-- LECTURES (projection de l'arbre + échange source) — security invoker, RLS propriétaire (0021/0016).
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════

-- Projection de l'arbre (AC1/AC3) : toutes les branches de l'appelante + le VERBATIM de leur extrait source.
-- Le join branche⋈entree_journal se fait EN BASE (pas d'embedding PostgREST ambigu sur la FK composite). Le
-- verbatim (art. 9) remonte ici DÉLIBÉRÉMENT : la fiche le rend « comme un tour d'utilisatrice » (FR-027) —
-- ≠ la 4.5 (proposition générique, verbatim retiré). NFR-022 vise les LOGS/erreurs, pas l'affichage légitime
-- à la propriétaire sous son propre JWT. Ordonné par date_naissance → placement stable (aucune régression visuelle).
create function public.charger_branches_arbre()
returns table(
  branche_id       uuid,
  nom              text,
  etat             text,
  intensite        real,
  date_naissance   timestamptz,
  extrait_source_id uuid,
  extrait_contenu  text,
  extrait_cree_le  timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select b.id, b.nom, b.etat, b.intensite, b.date_naissance, b.extrait_source_id, e.contenu, e.cree_le
  from public.branche b
  join public.entree_journal e
    on e.id = b.extrait_source_id and e.utilisatrice_id = b.utilisatrice_id
  where b.utilisatrice_id = (select auth.uid())
  order by b.date_naissance asc;
$$;
revoke execute on function public.charger_branches_arbre() from public, anon;
grant  execute on function public.charger_branches_arbre() to authenticated;

-- « Voir dans la conversation » (AC4) : le message EXACT (`est_cible=true`) + son VOISINAGE immédiat (jusqu'à 6
-- tours avant / 6 après, par cree_le) chez l'appelante. Fenêtre BORNÉE (v1 minimale, cf. chevauchement Epic 5).
-- Isolation : si l'extrait n'appartient pas à l'appelante, `cible` est vide → 0 ligne (jamais le journal d'autrui).
create function public.charger_echange_source(p_extrait_source_id uuid)
returns table(id uuid, role text, contenu text, cree_le timestamptz, est_cible boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  with cible as (
    select e.cree_le
    from public.entree_journal e
    where e.id = p_extrait_source_id and e.utilisatrice_id = (select auth.uid())
  ),
  avant as (
    select e.id, e.role, e.contenu, e.cree_le
    from public.entree_journal e, cible
    where e.utilisatrice_id = (select auth.uid()) and e.cree_le < cible.cree_le
    order by e.cree_le desc
    limit 6
  ),
  apres as (
    select e.id, e.role, e.contenu, e.cree_le
    from public.entree_journal e, cible
    where e.utilisatrice_id = (select auth.uid()) and e.cree_le > cible.cree_le
    order by e.cree_le asc
    limit 6
  ),
  cible_ligne as (
    select e.id, e.role, e.contenu, e.cree_le
    from public.entree_journal e
    where e.id = p_extrait_source_id and e.utilisatrice_id = (select auth.uid())
  )
  select f.id, f.role, f.contenu, f.cree_le, (f.id = p_extrait_source_id) as est_cible
  from (
    select * from avant
    union all select * from cible_ligne
    union all select * from apres
  ) f
  order by f.cree_le asc;
$$;
revoke execute on function public.charger_echange_source(uuid) from public, anon;
grant  execute on function public.charger_echange_source(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════
-- RENOMMAGE (AC6/AC7 [DUR]) — policy UPDATE gardée + trigger d'immuabilité (seul `nom` mutable).
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════

-- Policy UPDATE propriétaire — write-gate art. 9 COMPLET dans le WITH CHECK (leçon R1). Le renommage DÉPOSE du
-- contenu art. 9 neuf (le `nom`) → `a_consenti_art9()` OBLIGATOIRE (≠ la policy update du signal 0021:118).
create policy branche_renommage on public.branche
  for update
  using      (auth.uid() = utilisatrice_id)
  with check (auth.uid() = utilisatrice_id
              and public.a_consenti_art9()
              and not public.est_barre_minorite()
              and public.branche_nom_significatif(nom));

-- Trigger : SEUL `nom` (et `maj_le`, tenu par `branche_maj_le`/0021) est mutable. Fige etat/intensite/
-- date_naissance/extrait_source_id/utilisatrice_id/cree_le/id → un update direct ne peut ni forger un état
-- (pré-emption 4.7) ni falsifier la date de naissance ni repointer l'extrait. Mord service_role (hors RLS).
create function public.branche_garde_renommage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.etat is distinct from old.etat
     or new.intensite is distinct from old.intensite
     or new.date_naissance is distinct from old.date_naissance
     or new.extrait_source_id is distinct from old.extrait_source_id
     or new.utilisatrice_id is distinct from old.utilisatrice_id
     or new.cree_le is distinct from old.cree_le
     or new.id is distinct from old.id then
    raise exception 'branche : seul le nom est modifiable en 4.6 — etat/intensite/date/lien figés (le cycle de vie monotone est la Story 4.7)';
  end if;
  return new;
end;
$$;
revoke execute on function public.branche_garde_renommage() from public, anon, authenticated;
create trigger branche_renommage_garde
  before update on public.branche
  for each row execute function public.branche_garde_renommage();

-- RPC de CONFORT (fast-fail amical) — PAS la barrière (policy + trigger le sont). Miroir creer_branche_depuis_signal.
create function public.renommer_branche(p_branche_id uuid, p_nouveau_nom text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- [AC2] nom donné par elle — défense en profondeur au-delà du CHECK/policy (même sémantique que .trim()).
  if p_nouveau_nom is null or not public.branche_nom_significatif(p_nouveau_nom) then
    raise exception 'branche : un nom donné par l''utilisatrice ne peut pas être vide (AC2, Story 4.6)';
  end if;
  -- Seul le `nom` bouge (le trigger fige le reste ; la policy re-vérifie consentement + nom non vide ATOMIQUEMENT).
  update public.branche
     set nom = btrim(p_nouveau_nom, E' \t\n\r ')
   where id = p_branche_id and utilisatrice_id = (select auth.uid());
end;
$$;
revoke execute on function public.renommer_branche(uuid, text) from public, anon;
grant  execute on function public.renommer_branche(uuid, text) to authenticated;

comment on function public.charger_branches_arbre() is
  'Story 4.6 (AC1/AC3) : projection de l''arbre — toutes les branches de l''appelante + le verbatim de leur extrait source (la fiche, FR-027). security invoker (RLS propriétaire).';
comment on function public.charger_echange_source(uuid) is
  'Story 4.6 (AC4) : « Voir dans la conversation » — le message exact (est_cible) + son voisinage (±6 tours). security invoker (RLS propriétaire). Fenêtre minimale (chevauchement Epic 5 à surveiller).';
comment on function public.renommer_branche(uuid, text) is
  'Story 4.6 (AC6) : renommer une branche (nom donné par elle). RPC de confort ; la barrière est la policy branche_renommage (WITH CHECK : consentement art. 9 + nom non vide) + le trigger branche_garde_renommage (seul nom mutable).';
