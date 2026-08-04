-- Migration forward-only — Story 4.6, correctifs de la REVUE ADVERSARIALE (98 agents, 2026-08).
--
-- Ferme 9 findings de la couche base. Le plus grave (HAUTE, REPRODUIT EN LIVE — 201 Created) :
--
--   ⚠️  LEÇON R1, APPLIQUÉE À MOITIÉ. Le trigger `branche_renommage_garde` de 0022 était `BEFORE UPDATE`
--   SEULEMENT. Or `authenticated` a le grant table-level INSERT autant qu'UPDATE : un
--   `.from("branche").insert({etat:'fruit', intensite:1, date_naissance:'1999-01-01'})` DIRECT passait,
--   forgeant un « rayonnement » que l'utilisatrice n'a jamais déclaré — et de façon IRRÉVERSIBLE (aucune
--   policy delete sous JWT ; le chemin légitime 4.5 fait `on conflict do nothing` en brûlant le signal).
--   Une garde d'écriture doit couvrir TOUTES les commandes d'écriture, pas seulement celle qu'on avait en
--   tête. On ferme ici par DOUBLE défense : la policy d'insertion (WITH CHECK) ET le trigger (INSERT+UPDATE,
--   qui mord aussi service_role).

-- ── (1) [HAUTE] Le trigger couvre désormais INSERT *et* UPDATE ────────────────────────────────────────
-- Sur INSERT, `old` n'est pas assigné → brancher sur TG_OP. 4.5/4.6 n'écrivent QUE la naissance ; toute
-- transition etat/intensite appartient à la Story 4.7 (chemin UPDATE, sous sa propre garde à venir).
create or replace function public.branche_garde_renommage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if TG_OP = 'INSERT' then
    if new.etat <> 'naissance' or new.intensite <> 0 then
      raise exception 'branche : une branche naît en etat naissance / intensite 0 — forger un état à l''insertion pré-empte la Story 4.7';
    end if;
    -- Horodatages AUTORITAIRES en base pour tout écrivain sous JWT (l'écrivain service_role d'Epic 6 garde
    -- sa latitude : un effacement/réimport ne doit pas être réhorodaté).
    if (select auth.uid()) is not null then
      new.date_naissance := now();
      new.cree_le        := now();
    end if;
    return new;
  end if;

  -- UPDATE : seul `nom` (et `maj_le`, tenu par `branche_maj_le`) est mutable.
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

drop trigger branche_renommage_garde on public.branche;
create trigger branche_renommage_garde
  before insert or update on public.branche
  for each row execute function public.branche_garde_renommage();

-- ── (2) [HAUTE, défense en profondeur R1] La POLICY d'insertion épingle aussi l'état ──────────────────
-- Le trigger suffit fonctionnellement, mais la leçon R1 veut la garde DANS la policy (atomique avec
-- l'insert, et lisible comme contrat). À relâcher en 4.7 en même temps que le trigger.
drop policy branche_insertion on public.branche;
create policy branche_insertion on public.branche
  for insert
  with check (auth.uid() = utilisatrice_id
              and public.a_consenti_art9()
              and not public.est_barre_minorite()
              and not public.branche_bloquee_par_detresse()
              and public.branche_nom_significatif(nom)
              and etat = 'naissance'          -- 4.6 = consultation + renommage seulement (revue, HAUTE)
              and intensite = 0
              and exists (select 1 from public.entree_journal e
                          where e.id = extrait_source_id
                            and e.utilisatrice_id = (select auth.uid())));

-- ── (3) [MOYENNE] `intensite` bornée en base (mord service_role et la future 4.7) ─────────────────────
-- NB : `<= 1` exclut AUSSI `'NaN'::real` (en PostgreSQL, NaN est supérieur à tout réel). Ne PAS écrire
-- `intensite = intensite` en croyant exclure NaN : c'est TRUE pour NaN.
alter table public.branche
  add constraint branche_intensite_bornee check (intensite >= 0 and intensite <= 1);

-- ── (4) [BASSE] Borne de longueur du `nom` (art. 9 ; 2 000 000 de caractères étaient persistables) ────
alter table public.branche
  add constraint branche_nom_borne check (length(nom) <= 300);

-- ── (5) [BASSE] AC2 [DUR] — les caractères SANS GLYPHE ne sont pas un nom ─────────────────────────────
-- `branche_nom_significatif` n'excluait que les BLANCS Unicode (parité stricte avec JS .trim(), saine).
-- Mais U+200B (zero-width space), U+2800 (braille blank), U+3164 (hangul filler), U+00AD (soft hyphen)…
-- ne sont pas des blancs et n'ont AUCUN glyphe : « une branche sans nom n'existe pas » était contournable.
-- `lib/domain/branche.ts` est durci EN MÊME TEMPS (R1-bis : les deux gardes restent équivalentes, sinon le
-- bouton resterait actif côté app et la RPC lèverait un échec incompréhensible).
create or replace function public.branche_nom_significatif(p_nom text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_nom ~ E'[^[:space:]\u00a0\u00ad\u115f\u1160\u1680\u180e\u2000-\u200f\u2028\u2029\u202f\u205f\u2060-\u2064\u2800\u3000\u3164\ufeff]';
$$;

-- `create or replace` ne revalide PAS les lignes existantes : on répare celles qui auraient pu naître.
update public.branche set nom = '(sans nom)' where not public.branche_nom_significatif(nom);

-- ── (6) [BASSE] `renommer_branche` ne réussit plus SILENCIEUSEMENT sur une branche non possédée ───────
-- Avant : un `update … where id = … and utilisatrice_id = auth.uid()` touchant 0 ligne renvoyait `void`
-- sans erreur → l'UI affichait un renommage qui n'avait pas eu lieu (mise à jour optimiste mensongère).
create or replace function public.renommer_branche(p_branche_id uuid, p_nouveau_nom text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_touchees int;
begin
  if p_nouveau_nom is null or not public.branche_nom_significatif(p_nouveau_nom) then
    raise exception 'branche : un nom donné par l''utilisatrice ne peut pas être vide (AC2, Story 4.6)';
  end if;
  -- Trim par regex (btrim prend un JEU de caractères, sans plages) — même classe que la garde ci-dessus.
  update public.branche
     set nom = regexp_replace(regexp_replace(p_nouveau_nom, E'^[[:space:]\u00a0\u00ad\u115f\u1160\u1680\u180e\u2000-\u200f\u2028\u2029\u202f\u205f\u2060-\u2064\u2800\u3000\u3164\ufeff]+', ''), E'[[:space:]\u00a0\u00ad\u115f\u1160\u1680\u180e\u2000-\u200f\u2028\u2029\u202f\u205f\u2060-\u2064\u2800\u3000\u3164\ufeff]+$', '')
   where id = p_branche_id and utilisatrice_id = (select auth.uid());
  get diagnostics v_touchees = row_count;
  if v_touchees = 0 then
    raise exception 'branche : branche introuvable ou non possédée (isolation, Story 4.6)';
  end if;
end;
$$;

-- ── (7) [MOYENNE/BASSE] `charger_echange_source` : fenêtre BORNÉE + ex æquo déterministes ─────────────
-- Avant : le « voisinage immédiat » n'était borné que par `limit 6` — il pouvait recoller des tours de
-- séances séparées de plusieurs MOIS et les faire passer pour la suite du même échange. Et les messages au
-- MÊME `cree_le` que la cible étaient exclus, l'ordre final étant non déterministe.
-- Après : borne temporelle ±2 h (l'index `entree_journal_utilisatrice_idx (utilisatrice_id, cree_le)`
-- couvre le prédicat) + comparaison de tuples `(cree_le, id)` → ordre total, aucun ex æquo perdu.
create or replace function public.charger_echange_source(p_extrait_source_id uuid)
returns table(id uuid, role text, contenu text, cree_le timestamptz, est_cible boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  with cible as (
    select e.id, e.cree_le
    from public.entree_journal e
    where e.id = p_extrait_source_id and e.utilisatrice_id = (select auth.uid())
  ),
  avant as (
    select e.id, e.role, e.contenu, e.cree_le
    from public.entree_journal e, cible
    where e.utilisatrice_id = (select auth.uid())
      and (e.cree_le, e.id) < (cible.cree_le, cible.id)
      and e.cree_le >= cible.cree_le - interval '2 hours'
    order by e.cree_le desc, e.id desc
    limit 6
  ),
  apres as (
    select e.id, e.role, e.contenu, e.cree_le
    from public.entree_journal e, cible
    where e.utilisatrice_id = (select auth.uid())
      and (e.cree_le, e.id) > (cible.cree_le, cible.id)
      and e.cree_le <= cible.cree_le + interval '2 hours'
    order by e.cree_le asc, e.id asc
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
  order by f.cree_le asc, f.id asc;
$$;

-- ── (8) [BASSE] `charger_branches_arbre` : ordre TOTAL (le placement de l'arbre ne doit pas vaciller) ──
create or replace function public.charger_branches_arbre()
returns table(
  branche_id        uuid,
  nom               text,
  etat              text,
  intensite         real,
  date_naissance    timestamptz,
  extrait_source_id uuid,
  extrait_contenu   text,
  extrait_cree_le   timestamptz
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
  order by b.date_naissance asc, b.id asc;
$$;

comment on function public.branche_garde_renommage() is
  'Story 4.6 (revue) : garde d''écriture de `branche` sur INSERT *et* UPDATE. INSERT → naissance/intensite 0 imposés + horodatages autoritaires sous JWT (anti-forge ; leçon R1 : le grant table-level couvre INSERT autant qu''UPDATE). UPDATE → seul `nom` mutable (le cycle de vie monotone est la Story 4.7). Mord aussi service_role.';
comment on function public.charger_echange_source(uuid) is
  'Story 4.6 (AC4, revue) : « Voir dans la conversation » — le message exact (est_cible) + son voisinage borné à ±2 h (jamais des tours d''une autre séance), ordre total (cree_le, id). security invoker (RLS propriétaire).';
