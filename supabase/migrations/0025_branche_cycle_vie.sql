-- Migration forward-only — Story 4.7 : le CYCLE DE VIE d'une branche, monotone et gardé À L'ÉCRITURE.
--
-- 4.5 fait NAÎTRE la branche. 4.6 la MONTRE et la RENOMME. 4.7 la fait VIVRE — et c'est la première
-- migration qui autorise `etat`/`intensite` à bouger. 0023 les avait volontairement ÉPINGLÉS à deux
-- endroits (la policy d'insertion ET le trigger), précisément pour qu'aucune écriture prématurée ne puisse
-- forger un « rayonnement » que l'utilisatrice n'a jamais déclaré. On ouvre ici le SEUL chemin qu'il faut :
--
--   • la NAISSANCE reste épinglée (`etat='naissance' and intensite=0` dans la policy d'insertion, inchangée,
--     et dans la branche TG_OP='INSERT' du trigger) — une branche naît toujours nue ;
--   • l'UPDATE s'ouvre, mais sous une garde de MONOTONIE, pas sous une absence de garde.
--
-- CE QUE CE FICHIER GARANTIT :
--   [FR-029] Aucun écrivain — JWT ou `service_role`, que la RLS ne borne pas — ne peut faire reculer `etat`
--     ou `intensite`, ni réécrire/effacer une date de transition déjà posée. C'est absolu.
--   [AC3] Aucun chemin AUTOMATIQUE ne peut écrire `rayonnement` : `progresser_feuillaison` ne sait pas
--     prononcer ce mot (garde de source + garde de comportement), et `declarer_rayonnement` n'est appelée
--     que par la route du geste explicite (garde d'architecture côté TypeScript).
--   [AD-17/D3] Ni la feuillaison ni la déclaration ne passent pendant un épisode de détresse ou dans les
--     72 h qui suivent — gardes AU POINT D'ÉCRITURE, jamais dans la seule UI.
--
-- CE QU'IL N'ESSAIE PAS DE GARANTIR, ET POURQUOI : l'utilisatrice qui ouvrirait sa console pourrait avancer
--   son PROPRE arbre par un UPDATE direct. C'est le même acte que d'appuyer sur le bouton — son arbre, son
--   geste, aucune donnée d'autrui, aucun score à truquer. Le verrouiller (drapeau de transaction, privilège
--   de colonne) coûterait la TESTABILITÉ de la monotonie : plus aucun chemin ne pourrait tenter une
--   régression, donc plus aucun test ne pourrait tuer le mutant de la garde qui compte vraiment.

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════
-- (1) [D2] `fruit` → `rayonnement` — l'enum parle enfin la langue du produit
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════
-- Les specs ont banni la métaphore du fruit (PRD FR-028, DESIGN L586/L601 : « la branche entre en pleine
-- lumière, aucun objet-fruit suspendu ») ; le code traduisait à l'affichage. 4.7 est la story qui écrit
-- cette valeur pour la PREMIÈRE fois, donc le dernier moment gratuit pour la renommer : aucune ligne ne
-- porte `'fruit'` aujourd'hui (4.5/4.6 n'écrivent que `naissance`). On ne PARIE pas là-dessus pour autant.
-- Ordre obligatoire : lever le CHECK, réparer les lignes, reposer le CHECK (un `add constraint` valide les
-- lignes existantes et échouerait sur un `fruit` résiduel).
alter table public.branche drop constraint branche_etat_check;
update public.branche set etat = 'rayonnement' where etat = 'fruit';
alter table public.branche
  add constraint branche_etat_check check (etat in ('naissance', 'feuillaison', 'rayonnement'));

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════
-- (2) Les dates de transition — « ce qui a changé ET QUAND » (AC5)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════
-- Prévues par EXPERIENCE L232. Sans elles, la fiche ne peut pas dire depuis quand une branche est en
-- pleine lumière — et AC5 l'exige. WRITE-ONCE (gardé par le trigger) : l'histoire ne se réinvente pas.
alter table public.branche
  add column date_feuillaison timestamptz,
  add column date_rayonnement timestamptz;

-- Cohérence état ⟺ date, en CHECK (mord TOUT écrivain, y compris service_role) :
--   • une branche en pleine lumière SAIT depuis quand ; une branche qui ne rayonne pas n'a pas cette date ;
--   • une date de feuillaison n'existe que sur une branche qui a effectivement feuillu. Le SAUT direct
--     naissance → rayonnement reste légal (monotone ≠ obligation de gravir chaque marche : elle a pu vivre
--     la chose sans jamais y revenir en séance) — dans ce cas `date_feuillaison` reste null, et la fiche
--     ne prétendra pas le contraire.
alter table public.branche
  add constraint branche_rayonnement_date check ((etat = 'rayonnement') = (date_rayonnement is not null)),
  add constraint branche_feuillaison_date check (date_feuillaison is null or etat in ('feuillaison', 'rayonnement'));

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════
-- (3) `branche_retour` — le LEDGER des retours sur le thème (idempotence + « au fil des semaines »)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════
-- Deux rôles, et un seul suffirait à justifier la table :
--   • IDEMPOTENCE (patron 2-4b) : un retry du même tour ne doit pas compter deux fois. La clé primaire
--     (branche, entrée) le rend structurel plutôt que déclaratif.
--   • « AU FIL DES SEMAINES » (FR-028) : `jour_paris` permet de n'accorder qu'UN retour par jour civil —
--     revenir trois fois dans la même soirée, c'est un seul retour.
-- FR-067 : `on delete cascade` DES DEUX CÔTÉS (la branche et l'entrée), plus la cascade utilisatrice —
-- une table dérivée d'art. 9 qui survivrait à un effacement serait un trou RGPD silencieux.
create table public.branche_retour (
  branche_id        uuid        not null references public.branche(id) on delete cascade,
  utilisatrice_id   uuid        not null references public.utilisatrice(id) on delete cascade,
  entree_journal_id uuid        not null,
  jour_paris        date        not null,
  cree_le           timestamptz not null default now(),
  primary key (branche_id, entree_journal_id),
  -- Cohérence-propriétaire DURE (patron `branche_extrait_meme_proprietaire`, 0021:57) : le retour, son
  -- entrée de journal et sa propriétaire sont forcément la même personne — invariant qui survit à un
  -- écrivain service_role, pas seulement à la RLS.
  constraint branche_retour_meme_proprietaire
    foreign key (utilisatrice_id, entree_journal_id)
    references public.entree_journal (utilisatrice_id, id) on delete cascade
);
create index branche_retour_jour_idx on public.branche_retour (branche_id, jour_paris);

alter table public.branche_retour enable row level security;
alter table public.branche_retour force  row level security;

-- Lecture propriétaire (export FR-067 ; le rythme de retour d'une utilisatrice est une donnée art. 9 dérivée).
create policy branche_retour_lecture on public.branche_retour
  for select
  using (auth.uid() = utilisatrice_id);

-- Écriture write-gatée, toutes les gardes ATOMIQUES dans le WITH CHECK (leçon R1 : `authenticated` a le
-- grant INSERT table-level → une garde qui ne vivrait que dans la RPC serait illusoire).
create policy branche_retour_insertion on public.branche_retour
  for insert
  with check (auth.uid() = utilisatrice_id
              and public.a_consenti_art9()
              and not public.est_barre_minorite()
              and not public.branche_bloquee_par_detresse()
              and exists (select 1 from public.branche b
                          where b.id = branche_id
                            and b.utilisatrice_id = (select auth.uid())));
-- AUCUNE policy update/delete sous JWT : un retour consigné est un fait, il ne se réécrit pas.

comment on table public.branche_retour is
  'Story 4.7 : ledger des RETOURS spontanés sur le thème d''une branche (FR-028). Clé (branche, entrée) = idempotence au retry ; `jour_paris` = un retour par jour civil au plus (« au fil des semaines »). Cascade depuis branche ET entree_journal : l''effacement FR-067 l''emporte sans avoir à le connaître.';

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════
-- (4) Le TRIGGER de cycle — remplace `branche_garde_renommage` (0022/0023), dont le nom mentirait
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════
-- Il mord `service_role`, que la RLS ne borne pas : c'est le SEUL endroit qui connaît la ligne PRÉCÉDENTE,
-- donc le seul qui puisse parler de monotonie (un CHECK de colonne ne voit jamais `old`).
create function public.branche_garde_cycle()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_ordre_old int;
  v_ordre_new int;
begin
  if TG_OP = 'INSERT' then
    -- Une branche naît NUE. Forger un état à l'insertion reste interdit (leçon R1-ter, revue 4.6 : le grant
    -- table-level couvre INSERT autant qu'UPDATE, et un `.from("branche").insert({etat:...})` direct passait).
    if new.etat <> 'naissance' or new.intensite <> 0
       or new.date_feuillaison is not null or new.date_rayonnement is not null then
      raise exception 'branche : une branche naît en etat naissance, intensite 0, sans date de transition (anti-forge, Story 4.7)';
    end if;
    -- Horodatages AUTORITAIRES en base pour tout écrivain sous JWT (l'écrivain service_role d'Epic 6 garde
    -- sa latitude : un effacement/réimport ne doit pas être réhorodaté).
    if (select auth.uid()) is not null then
      new.date_naissance := now();
      new.cree_le        := now();
    end if;
    return new;
  end if;

  -- ── UPDATE : l'IDENTITÉ et l'ORIGINE restent figées (clause héritée de 0022, elle ne s'ouvre pas) ──
  if new.date_naissance    is distinct from old.date_naissance
     or new.extrait_source_id is distinct from old.extrait_source_id
     or new.utilisatrice_id   is distinct from old.utilisatrice_id
     or new.cree_le           is distinct from old.cree_le
     or new.id                is distinct from old.id then
    raise exception 'branche : l''identité et l''origine d''une branche sont figées (date de naissance, moment source, propriétaire)';
  end if;

  -- ── MONOTONIE DE L'ÉTAT (AC1/AC4, FR-029) : naissance(0) < feuillaison(1) < rayonnement(2) ──────────
  v_ordre_old := case old.etat when 'naissance' then 0 when 'feuillaison' then 1 else 2 end;
  v_ordre_new := case new.etat when 'naissance' then 0 when 'feuillaison' then 1 else 2 end;
  if v_ordre_new < v_ordre_old then
    raise exception 'branche : l''arbre ne régresse jamais — % → % est interdit (FR-029, Story 4.7)', old.etat, new.etat;
  end if;

  -- ── MONOTONIE DE L'INTENSITÉ : le feuillage ne se dégarnit pas ──────────────────────────────────────
  -- NB : `NaN` est supérieur à tout réel en PostgreSQL, donc il ne déclenche PAS ce raise — c'est
  -- `branche_intensite_bornee` (0023) qui l'arrête. Ne pas « corriger » l'un en croyant couvrir l'autre.
  if new.intensite < old.intensite then
    raise exception 'branche : la feuillaison ne recule pas (% → %, FR-029, Story 4.7)', old.intensite, new.intensite;
  end if;

  -- ── [AD-17 / FR-046 / D3] L'ARBRE NE POUSSE PAS PENDANT UNE DÉTRESSE ────────────────────────────────
  -- Ici et pas seulement dans les RPC : les deux fast-fails des RPC sont REDONDANTS avec les policies
  -- (`branche_retour` pour la feuillaison) et ne servent qu'à donner un message clair. Un `.from("branche")
  -- .update({etat:'rayonnement'})` direct, lui, ne croise AUCUNE garde de détresse — la policy `branche_maj`
  -- ne peut pas en porter une, sinon RENOMMER une branche deviendrait impossible pendant un épisode, ce qui
  -- serait absurde et cruel. Le trigger est donc le seul endroit qui couvre TOUS les écrivains sous JWT.
  -- `branche_bloquee_par_detresse()` est keyée sur `auth.uid()` : `service_role` (Epic 6) n'est pas concerné.
  if (new.etat is distinct from old.etat or new.intensite is distinct from old.intensite)
     and (select auth.uid()) is not null
     and public.branche_bloquee_par_detresse() then
    raise exception 'branche : l''arbre ne pousse pas pendant un épisode de détresse ni dans les 72 h qui suivent (AD-17/FR-046, Story 4.7)';
  end if;

  -- ── DATES DE TRANSITION : WRITE-ONCE — ni réécrites, ni effacées ─────────────────────────────────────
  if old.date_feuillaison is not null and new.date_feuillaison is distinct from old.date_feuillaison then
    raise exception 'branche : la date de feuillaison est posée une fois pour toutes (Story 4.7)';
  end if;
  if old.date_rayonnement is not null and new.date_rayonnement is distinct from old.date_rayonnement then
    raise exception 'branche : la date de pleine lumière est posée une fois pour toutes (Story 4.7)';
  end if;

  return new;
end;
$$;
revoke execute on function public.branche_garde_cycle() from public, anon, authenticated;

drop trigger branche_renommage_garde on public.branche;
drop function public.branche_garde_renommage();
create trigger branche_cycle_garde
  before insert or update on public.branche
  for each row execute function public.branche_garde_cycle();

-- La policy UPDATE de 0022 s'appelait `branche_renommage` : elle couvre désormais tout le cycle de vie.
-- Contenu INCHANGÉ (propriétaire + consentement art. 9 + non barré-minorité + nom significatif) — seul le
-- nom de la policy est mis en vérité, pour qu'un lecteur ne croie pas que seul le renommage passe ici.
drop policy branche_renommage on public.branche;
create policy branche_maj on public.branche
  for update
  using      (auth.uid() = utilisatrice_id)
  with check (auth.uid() = utilisatrice_id
              and public.a_consenti_art9()
              and not public.est_barre_minorite()
              and public.branche_nom_significatif(nom));

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════
-- (5) Le PAS de feuillaison — une seule valeur, partagée base ⟺ domaine
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════
-- ⚠️ PLACEHOLDER PRODUIT, au même titre qu'`INSTRUCTION_RECONCEPTUALISATION` : 0,2 = feuillage plein en
-- cinq retours espacés. À valider sur données réelles avant mise en ligne. Il n'est JAMAIS affiché nulle
-- part (FR-031 : aucun seuil, aucune étape numérotée, aucun « 2 retours sur 3 »).
-- Exposé en fonction pour qu'une garde puisse prouver l'équivalence avec `lib/domain/cycle-branche.ts` —
-- deux copies d'un même nombre qui divergent, c'est la faute R1-bis appliquée à l'arithmétique.
create function public.branche_pas_feuillaison()
returns real
language sql
immutable
set search_path = ''
as $$ select 0.2::real $$;
grant execute on function public.branche_pas_feuillaison() to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════
-- (6) `progresser_feuillaison` — le chemin AUTOMATIQUE, qui ne sait pas dire « pleine lumière »
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════
-- `security invoker` : la RLS + les policies mordent aussi ici. Le mot `rayonnement` n'apparaît NULLE PART
-- dans ce corps — c'est ce qui rend AC3 (« jamais inféré ») structurel et non déclaratif.
create function public.progresser_feuillaison(p_branche_id uuid, p_cle_tour text)
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
  -- La garde atomique est aussi dans le WITH CHECK de `branche_retour` ; ceci est le message clair.
  if public.branche_bloquee_par_detresse() then
    raise exception 'branche : aucune feuillaison ne progresse pendant un épisode de détresse ni dans les 72 h (AD-17, Story 4.7)';
  end if;

  -- (2) L'entrée du tour, résolue EN SQL depuis la clé de tour (patron `enregistrer_signal_reconceptualisation`,
  -- 0020) : `consigner()` renvoie `void`, l'appelant n'a jamais l'id. Isolation : un tour d'autrui n'est pas trouvé.
  select e.id into v_entree
    from public.entree_journal e
   where e.utilisatrice_id = (select auth.uid())
     and e.cle_tour = p_cle_tour
     and e.role = 'utilisatrice'
   limit 1;
  if v_entree is null then
    raise exception 'branche : tour introuvable ou non possédé (isolation, Story 4.7)';
  end if;

  -- (3) La branche doit être POSSÉDÉE — sinon on lève, jamais un succès silencieux (patron 0023 §6).
  select b.etat into v_etat
    from public.branche b
   where b.id = p_branche_id and b.utilisatrice_id = (select auth.uid());
  if v_etat is null then
    raise exception 'branche : branche introuvable ou non possédée (isolation, Story 4.7)';
  end if;

  v_jour := (now() at time zone 'Europe/Paris')::date;

  -- (4) Le LEDGER d'abord : idempotence STRUCTURELLE. Un retry du même tour ne franchit pas cette ligne.
  insert into public.branche_retour (branche_id, utilisatrice_id, entree_journal_id, jour_paris)
  values (p_branche_id, (select auth.uid()), v_entree, v_jour)
  on conflict (branche_id, entree_journal_id) do nothing;
  get diagnostics v_inseres = row_count;
  if v_inseres = 0 then
    return false; -- déjà consigné : rien ne bouge
  end if;

  -- (5) « AU FIL DES SEMAINES » : un seul incrément par jour civil Paris. Revenir trois fois dans la même
  -- soirée reste UN retour — le retour est consigné (c'est un fait), mais la matière ne bouge pas.
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

  -- (7) La matière avance d'un DEGRÉ (jamais un flip d'enum, FR-028). `date_feuillaison` n'est posée qu'au
  -- moment où la feuillaison s'amorce vraiment — le trigger la rendra write-once ensuite.
  update public.branche
     set etat             = 'feuillaison',
         intensite        = least(1::real, intensite + public.branche_pas_feuillaison()),
         date_feuillaison = case when date_feuillaison is null then now() else date_feuillaison end
   where id = p_branche_id and utilisatrice_id = (select auth.uid());

  return true;
end;
$$;
revoke execute on function public.progresser_feuillaison(uuid, text) from public, anon;
grant  execute on function public.progresser_feuillaison(uuid, text) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════
-- (7) `declarer_rayonnement` — le SEUL chemin vers la pleine lumière, et il vient d'ELLE
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════
create function public.declarer_rayonnement(p_branche_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_touchees int;
begin
  -- [D3 / AD-17] Une branche n'entre pas en pleine lumière pendant un épisode ni dans les 72 h : un
  -- basculement vécu en crise n'est pas un basculement stable, et ce geste-ci est IRRÉVERSIBLE.
  -- La garde vit DANS LE TRIGGER, pas ici. Un fast-fail local serait purement décoratif : le trigger
  -- refuse déjà l'avancée d'état avec un message tout aussi explicite, et sa mutation est mortelle (elle
  -- tue trois tests) alors qu'un doublon ici survivrait au sien — une garde qu'aucun test ne peut tuer
  -- n'est pas une garde, c'est un commentaire exécutable.
  update public.branche
     set etat             = 'rayonnement',
         date_rayonnement = now()
   where id = p_branche_id
     and utilisatrice_id = (select auth.uid())
     and etat <> 'rayonnement';
  get diagnostics v_touchees = row_count;

  if v_touchees = 0 then
    -- Déjà en pleine lumière → IDEMPOTENT, aucun bruit (un double-tap ne doit pas afficher d'échec).
    -- Introuvable / non possédée → on LÈVE : plus de succès silencieux (patron 0023 §6).
    if not exists (select 1 from public.branche b
                    where b.id = p_branche_id and b.utilisatrice_id = (select auth.uid())) then
      raise exception 'branche : branche introuvable ou non possédée (isolation, Story 4.7)';
    end if;
  end if;
end;
$$;
revoke execute on function public.declarer_rayonnement(uuid) from public, anon;
grant  execute on function public.declarer_rayonnement(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════
-- (8) La projection sert les dates de transition (AC5 : « ce qui a changé et QUAND »)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════
-- ⚠️ `create or replace function` ne peut PAS changer le type de retour (ERROR 42P13) : il faut DROP puis
-- CREATE — et reposer `revoke`/`grant`, qu'un drop emporte.
drop function public.charger_branches_arbre();
create function public.charger_branches_arbre()
returns table(
  branche_id        uuid,
  nom               text,
  etat              text,
  intensite         real,
  date_naissance    timestamptz,
  date_feuillaison  timestamptz,
  date_rayonnement  timestamptz,
  extrait_source_id uuid,
  extrait_contenu   text,
  extrait_cree_le   timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select b.id, b.nom, b.etat, b.intensite, b.date_naissance, b.date_feuillaison, b.date_rayonnement,
         b.extrait_source_id, e.contenu, e.cree_le
  from public.branche b
  join public.entree_journal e
    on e.id = b.extrait_source_id and e.utilisatrice_id = b.utilisatrice_id
  where b.utilisatrice_id = (select auth.uid())
  order by b.date_naissance asc, b.id asc;
$$;
revoke execute on function public.charger_branches_arbre() from public, anon;
grant  execute on function public.charger_branches_arbre() to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════

comment on function public.branche_garde_cycle() is
  'Story 4.7 : garde d''écriture de `branche` sur INSERT *et* UPDATE. INSERT → naissance nue imposée (anti-forge, leçon R1-ter). UPDATE → identité/origine figées + MONOTONIE stricte de `etat` et `intensite` + dates de transition write-once. Mord aussi service_role : c''est le seul endroit qui connaît la ligne précédente, donc le seul qui puisse garantir FR-029.';
comment on function public.progresser_feuillaison(uuid, text) is
  'Story 4.7 (AC2) : un RETOUR spontané sur le thème fait avancer la matière d''un degré. Idempotent (ledger branche_retour), un incrément par jour civil Paris au plus, plafonné à 1. Ne peut PAS écrire la pleine lumière — le mot n''apparaît pas dans son corps (AC3). Gardé AD-17.';
comment on function public.declarer_rayonnement(uuid) is
  'Story 4.7 (AC3) : le SEUL chemin vers la pleine lumière, et il vient de l''utilisatrice (geste explicite). Idempotent ; lève sur branche non possédée ; refusé pendant un épisode de détresse et les 72 h suivantes (D3) — le geste est irréversible.';
comment on function public.branche_pas_feuillaison() is
  'Story 4.7 : le pas d''intensité d''un retour. PLACEHOLDER PRODUIT à valider sur données réelles. Exposé en fonction pour qu''une garde prouve l''équivalence avec lib/domain/cycle-branche.ts (R1-bis appliqué à l''arithmétique). Jamais affiché (FR-031).';
comment on function public.charger_branches_arbre() is
  'Story 4.6 (AC1/AC3), étendue en 4.7 : projection de l''arbre — branches de l''appelante + verbatim de l''extrait source + dates de transition (AC5). security invoker (RLS propriétaire). Ordre total (date_naissance, id).';
