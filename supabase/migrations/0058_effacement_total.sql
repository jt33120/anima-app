-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 0058 — L'EFFACEMENT TOTAL (Story 6.7 · FR-067 · AD-14 · AD-4 · NFR-002/003)
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- ── LA TRACE DOIT SURVIVRE À LA PERSONNE, ET C'EST TOUT LE PROBLÈME ─────────────────────────────
--
-- L'AC5 demande que l'opération soit journalisée. Or `audit_securite` — le registre où vivent toutes
-- les autres traces — porte `utilisatrice_id … on delete cascade` : la trace de l'effacement serait
-- effacée PAR l'effacement, dans la même transaction. On garderait la preuve de tout sauf du seul
-- geste qu'un responsable de traitement doit pouvoir prouver.
--
-- D'où une table à part, `effacement`, SANS aucune clé étrangère vers elle. Elle ne porte pas son
-- identifiant mais son EMPREINTE (sha256) : après l'effacement, l'identifiant n'existe plus nulle
-- part chez nous, donc l'empreinte ne se remonte plus — elle sert à dater un geste, pas à retrouver
-- quelqu'un. C'est ce qu'on peut garder sans garder personne.
--
-- ── L'ORDRE N'EST PAS UN DÉTAIL : UNE SEULE CLÉ `RESTRICT` EXISTE ───────────────────────────────
--
-- Mesuré sur le schéma au 2026-08-16 : sur les 38 clés étrangères, **une seule** n'est pas en
-- cascade — `branche_extrait_meme_proprietaire`, en `on delete restrict`. C'est elle qui tient
-- l'AC4 (« l'extrait source d'une branche ne peut être supprimé isolément »), et elle est bonne.
--
-- Mais elle rend la cascade FRAGILE. Supprimer `auth.users` cascade vers `utilisatrice`, qui cascade
-- vers `branche` ET vers `entree_journal` — et l'ordre entre les deux dépend de l'ordre de création
-- des contraintes, c'est-à-dire du hasard des migrations. Si le journal part le premier, le
-- `restrict` mord et TOUT L'EFFACEMENT ÉCHOUE. Sur la base d'aujourd'hui l'ordre est favorable ;
-- c'est une immunité par accident, pas par construction, et la prochaine migration peut la retourner.
--
-- Le moteur retire donc les branches EXPLICITEMENT, en premier, avant de laisser la cascade faire le
-- reste. C'est ce que veut dire « la suppression prime sur FR-029 » : la monotonie de l'arbre est un
-- invariant du produit qui fonctionne, pas une objection au droit à l'effacement.
--
-- ⚠️ ET CETTE LIGNE-LÀ NE PEUT PAS ÊTRE PROUVÉE PAR UN TEST QUI EFFACE. Mesuré le 2026-08-16 : la
-- retirer laisse `tests/effacement-sql.test.ts` VERT — la cascade d'aujourd'hui passe. Seule la
-- garde structurelle (`tests/effacement-schema.test.ts`) la tue, et c'est pour ça qu'elle existe :
-- c'est une assurance contre un ordre qu'on ne contrôle pas, et une assurance ne se prouve pas en
-- observant le beau temps.
--
-- ── CE QUI N'EST PAS EFFACÉ, ET POURQUOI ON LE DIT ──────────────────────────────────────────────
--
-- Les pièces comptables chez Stripe restent : une facture émise relève d'une obligation légale de
-- conservation, pas du consentement. Le produit le DIT à l'écran plutôt que de le taire — voir
-- `lib/domain/sous-traitants.ts`, où chaque sous-traitant porte son verdict.

-- ────────────────────────────────────────────────────────────────────────────────────────────────
-- La trace, sans la personne.
-- ────────────────────────────────────────────────────────────────────────────────────────────────
create table public.effacement (
  id                  uuid        primary key default gen_random_uuid(),
  -- ⚠️ AUCUNE CLÉ ÉTRANGÈRE VERS `utilisatrice` : cette ligne doit survivre à sa disparition.
  empreinte           text        not null,
  motif               text        not null,
  fenetre_pitr_jours  integer     not null,
  demande_le          timestamptz not null default now(),
  base_effacee_le     timestamptz,
  -- La date au-delà de laquelle aucune copie ne peut subsister (sauvegardes et PITR, AD-14).
  survivance_jusqu_au timestamptz not null,
  constraint effacement_empreinte_forme check (empreinte ~ '^[0-9a-f]{64}$'),
  -- Les quatre motifs d'AD-14. La 6.8 utilisera les trois autres via le même moteur.
  constraint effacement_motif_connu check (motif in ('utilisatrice', 'minorite', 'inactivite', 'fermeture')),
  -- ⚠️ LA BORNE EST UNE CONTRAINTE DE TABLE, PAS UNE VÉRIFICATION DANS LA FONCTION. Un `check` lie
  -- AUSSI `service_role`, que la RLS ne borne pas : « fenêtre bornée » (AD-14) devient une propriété
  -- du schéma, que même une tâche système ne peut pas contourner. 35 jours est le maximum PITR de
  -- l'hébergeur ; au-delà, la promesse serait invérifiable.
  constraint effacement_fenetre_bornee check (fenetre_pitr_jours between 0 and 35),
  constraint effacement_survivance_coherente check (survivance_jusqu_au >= demande_le)
);

comment on table public.effacement is
  'Story 6.7 — la trace d''un effacement, SANS lien vers la personne effacée (l''empreinte sha256 ne '
  'se remonte plus une fois l''identifiant disparu). Prouve qu''un droit a été honoré, sans garder '
  'de quoi le rattacher à quelqu''un.';

alter table public.effacement enable row level security;
alter table public.effacement force row level security;
-- Aucune policy, volontairement : deny-by-default (patron de `audit_securite`/0006). Aucun écran ne
-- lit cette table — elle existe pour le responsable de traitement, pas pour le produit.

create index effacement_survivance_idx on public.effacement (survivance_jusqu_au);

-- ────────────────────────────────────────────────────────────────────────────────────────────────
-- LE MOTEUR UNIQUE (AD-14). Un seul propriétaire de l'effacement, appelé par l'écran aujourd'hui et
-- par l'ordonnanceur demain (6.8) — jamais un script manuel, jamais une tâche dispersée.
-- ────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.effacer_toutes_mes_donnees(p_fenetre_pitr_jours integer)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := (select auth.uid());
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'effacement_sans_identite' using errcode = '42501';
  end if;
  -- AD-14 : l'échéance est un ARGUMENT, jamais un littéral SQL. La contrainte de table en borne la
  -- valeur ; ici on refuse seulement l'absurde, tôt et clairement.
  if p_fenetre_pitr_jours is null or p_fenetre_pitr_jours < 0 then
    raise exception 'fenetre_invalide' using errcode = '22023';
  end if;

  -- ⚠️ LA TRACE EST POSÉE AVANT, ET PAS APRÈS. Après la suppression de `auth.users`, `auth.uid()`
  -- désigne quelqu'un qui n'existe plus ; et si l'insertion échouait à ce moment-là, on aurait
  -- effacé sans pouvoir le prouver. L'ordre inverse perd la preuve, jamais la donnée.
  insert into public.effacement (empreinte, motif, fenetre_pitr_jours, survivance_jusqu_au)
  values (
    encode(sha256(v_uid::text::bytea), 'hex'),
    'utilisatrice',
    p_fenetre_pitr_jours,
    now() + make_interval(days => p_fenetre_pitr_jours)
  )
  returning id into v_id;

  -- ⚠️ LES BRANCHES D'ABORD — voir l'encadré : c'est la seule clé `restrict` du schéma, et sans ce
  -- retrait explicite l'effacement dépendrait de l'ordre de cascade, c'est-à-dire du hasard.
  delete from public.branche where utilisatrice_id = v_uid;

  -- Puis la cascade possédée par le schéma : `utilisatrice` emporte les 27 autres tables.
  delete from public.utilisatrice where id = v_uid;
  -- Et l'identité elle-même : une ligne d'auth ne portant qu'une adresse est encore une donnée à
  -- caractère personnel. Partir complètement, c'est aussi ne plus pouvoir se reconnecter.
  delete from auth.users where id = v_uid;

  update public.effacement set base_effacee_le = now() where id = v_id;
  return v_id;
end;
$fn$;

revoke all on function public.effacer_toutes_mes_donnees(integer) from public, anon;
grant execute on function public.effacer_toutes_mes_donnees(integer) to authenticated;

comment on function public.effacer_toutes_mes_donnees(integer) is
  'Story 6.7 — le MOTEUR UNIQUE d''effacement (AD-14, FR-067). Retire les branches d''abord (seule '
  'clé « restrict » du schéma), puis `utilisatrice` (cascade), puis l''identité d''auth. Pose sa '
  'trace dans `effacement` AVANT d''effacer, sans lien vers la personne.';
