-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 0049 — L'ENNÉAGRAMME : le type retenu, la tentative en cours, l'hypothèse d'Anam (Story 5.5)
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- ── CE QUE CETTE MIGRATION A DE DIFFÉRENT DES QUATRE PRÉCÉDENTES DU SOCLE ─────────────────────
--
-- 5.1 à 5.4 stockaient un CALCUL : le thème natal se dérive d'une date de naissance, la numérologie
-- et l'horoscope se recalculent à chaque lecture. Rien de tout cela n'était une déclaration d'elle.
--
-- Ici, si. Un type d'ennéagramme n'est pas une position astronomique, c'est une affirmation sur qui
-- elle EST — et elle vient soit de ses propres réponses, soit d'une inférence du produit. C'est la
-- première fois qu'Anima range quelqu'un dans une case, et tout ce qui suit découle de là.
--
-- ── TROIS TABLES, TROIS CYCLES DE VIE QUI N'ONT RIEN À VOIR ───────────────────────────────────
--
--   `enneagramme`             le type RETENU. Une ligne par utilisatrice, corrigeable, effaçable.
--   `enneagramme_tentative`   les réponses EN COURS. Éphémère par conception : effacée dès que le
--                             type est retenu (voir plus bas — c'est une décision, pas un oubli).
--   `enneagramme_hypothese`   le GERME de la proposition d'Anam. Naît `en_attente`, va vers
--                             `acceptee` ou `refusee`, et ne revient jamais.
--
-- Les fusionner aurait été plus court et faux : une hypothèse refusée ne doit JAMAIS pouvoir se lire
-- comme un type retenu, et confondre « Anam pense que » avec « elle a dit oui » est exactement la
-- faute que la revue de la 4.7 a payée sur les branches.
--
-- ── LES RÉPONSES BRUTES S'EFFACENT QUAND LE TYPE EST RETENU (décision Julian, 2026-08-13) ──────
--
-- Dix-huit auto-évaluations sur la manière dont on cède, dont on doute, dont on se protège, sont un
-- matériau PLUS INTIME que le type qu'on en tire. Les garder « au cas où » n'apporte rien qu'elle ne
-- puisse refaire en trois minutes, et ajoute à l'inventaire d'effacement (FR-067) une table dont
-- l'absence parlerait autant que la présence.
--
-- Elles sont donc persistées — pour qu'une fermeture d'onglet ne perde rien (NFR-017) — puis
-- effacées à la conclusion. `terminer_tentative_enneagramme` fait les deux d'un geste, dans la même
-- transaction : le type entre, la tentative sort.
--
-- ── OÙ VIT LA GARDE DE DÉTRESSE, ET OÙ ELLE NE VIT PAS (AD-17, décision explicite) ─────────────
--
-- `theme_natal` (0039) ne porte PAS `branche_bloquee_par_detresse()` ; `intention` (0036) et
-- `signal_reconceptualisation` (0020) la portent. Prendre un gabarit sans trancher, c'est décider
-- par accident. Ici, la ligne passe entre les deux, et voici où :
--
--   • `enneagramme_hypothese` LA PORTE. Une hypothèse est une parole d'Anam sur qui elle est —
--     précisément le « travail de schéma » que FR-037 suspend dès le premier signal, et qu'AD-17
--     borne jusqu'à 72 h après. Proposer une typologie de personnalité à quelqu'un en détresse est
--     la définition du mauvais moment.
--
--   • `enneagramme` et `enneagramme_tentative` NE LA PORTENT PAS. Compléter un test est un geste
--     D'ELLE, pas une parole du produit ; le socle n'est pas suspendu pendant un épisode (0039), et
--     lui retirer un geste qu'elle a choisi serait la punir de son état. Le refus et l'effacement,
--     eux, doivent rester ouverts en toutes circonstances.
--
-- ── LE REFUS SURVIT À LA RÉVOCATION DU CONSENTEMENT ────────────────────────────────────────────
--
-- Le gabarit le plus proche, `theme_natal_ecriture` (0039), est une policy `for all` unique dont le
-- `with check` porte `a_consenti_art9()`. Copiée telle quelle, elle gaterait aussi la CORRECTION et
-- l'EFFACEMENT du type.
--
-- Ce serait grave, et silencieusement : « UNE UPDATE BLOQUÉE PAR LA RLS NE LÈVE AUCUNE ERREUR, elle
-- renvoie zéro ligne » (0036). Une femme qui révoque son consentement — c'est-à-dire exactement
-- celle qui veut que l'étiquette disparaisse — verrait « c'est noté » sans que rien n'ait bougé.
--
-- Le dépôt a déjà tranché l'inverse pour un geste de refus, en toutes lettres (0021, policy update
-- de `branche`) : « une transition de statut d'un POINTEUR n'est pas un dépôt de contenu art. 9, et
-- “écarter” doit survivre à la révocation ». On applique la même règle :
--
--   DÉPOSER un type (insert) ou en déposer un AUTRE (update)  → gaté consentement + minorité
--   REFUSER une hypothèse, EFFACER son type ou sa tentative   → propriétaire seulement
--
-- ── CE QUI RESTE FRANCHISSABLE, ET POURQUOI ON L'ÉCRIT PLUTÔT QUE DE LE TAIRE ──────────────────
--
-- Le SCORE n'est pas une garde. `authenticated` peut poster directement le type de son choix par
-- l'API REST, sans avoir répondu à un seul énoncé. Ce n'est pas une faille : ce sont ses propres
-- données, aucun accès à autrui, et le pire qu'elle puisse se faire est de s'attribuer un type. Le
-- protéger demanderait de rejouer le barème en SQL, donc de le dupliquer — la divergence R1-bis
-- payée deux fois par ce dépôt, pour protéger quelqu'un de sa propre requête.
--
-- C'est le raisonnement déjà écrit dans 0040 et 0046 pour des cas jumeaux. Il est consigné ici pour
-- qu'une revue future ne le retrouve pas comme un oubli.

-- ── 1. LA FORME DES RÉPONSES ──────────────────────────────────────────────────────────────────
--
-- `immutable` : exigé pour servir dans une contrainte `check`. La fonction refuse tout ce qui n'est
-- pas un objet de dix-huit clés au plus, dont chaque clé est un identifiant d'énoncé et chaque
-- valeur un entier de 0 à 3. Sans elle, `reponses` accepterait 2 Mo de n'importe quoi.
--
-- ⚠️ LE MOTIF DES CLÉS EST UN MIROIR DE `lib/domain/enneagramme-items.ts`, et c'est une divergence
-- en attente — assumée, bornée, et gardée par un test qui compare les deux listes. On ne peut pas
-- l'éviter : la base ne lit pas le TypeScript. On la borne donc au minimum (la FORME d'un
-- identifiant), jamais le barème lui-même, qui n'existe qu'à un seul endroit.
create function public.reponses_enneagramme_valides(p_reponses jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p_reponses) = 'object'
     and (select count(*) from jsonb_object_keys(p_reponses)) <= 18
     and not exists (
       select 1
       from jsonb_each(p_reponses) as e(cle, valeur)
       where e.cle !~ '^e[1-9][ab]$'
          or jsonb_typeof(e.valeur) <> 'number'
          or (e.valeur)::numeric not in (0, 1, 2, 3)
     );
$$;

comment on function public.reponses_enneagramme_valides(jsonb) is
  'Story 5.5 — forme des réponses du test court : objet, <= 18 clés « e<1-9><a|b> », valeurs 0..3.';

-- ── 2. LE TYPE RETENU ─────────────────────────────────────────────────────────────────────────
--
-- 1:1 sur `utilisatrice_id` (patron `theme_natal`) : deux types concurrents n'ont aucun sens, et la
-- clé primaire rend l'unicité STRUCTURELLE plutôt que dépendante de la discipline de l'appelant.
--
-- ⚠️ AUCUNE COLONNE DE TEXTE LIBRE, et c'est ce qui rend FR-053 structurel : il n'existe pas
-- d'endroit où une prédiction pourrait s'écrire. L'interprétation vit dans `lib/corpus/`, sous le
-- balayage du détecteur ; la base ne porte que des nombres et des énumérations.
create table public.enneagramme (
  utilisatrice_id uuid        primary key references public.utilisatrice(id) on delete cascade,
  type            smallint    not null,
  -- D'où vient CE type : ses réponses, ou une hypothèse qu'elle a acceptée. L'écran le dit, et
  -- l'effacement de l'Epic 6 en aura besoin pour savoir ce qu'il retire.
  origine         text        not null,
  cree_le         timestamptz not null default now(),
  maj_le          timestamptz not null default now(),
  constraint enneagramme_type_borne     check (type between 1 and 9),
  constraint enneagramme_origine_close  check (origine in ('test', 'hypothese'))
);

alter table public.enneagramme enable row level security;
alter table public.enneagramme force  row level security;

-- LECTURE : propriétaire, et RIEN d'autre. Ni consentement, ni premium, ni minorité — ses propres
-- données lui restent lisibles quoi qu'il arrive, parce que l'export FR-067 et l'effacement AD-14 en
-- dépendent. Un socle qui séquestre ce qu'il a déjà écrit n'est pas un socle.
create policy enneagramme_lecture on public.enneagramme
  for select using (auth.uid() = utilisatrice_id);

-- DÉPÔT : toutes les gardes d'écriture dans le WITH CHECK, jamais dans une RPC ni une Server Action
-- (0041/0048 : `authenticated` détient les sept privilèges DML sur chaque table de `public`).
create policy enneagramme_depot on public.enneagramme
  for insert
  with check (auth.uid() = utilisatrice_id
              and public.a_consenti_art9()
              and not public.est_barre_minorite());

-- CORRECTION : déposer un AUTRE type reste un dépôt. Le `using` borne ce qu'on peut viser, le
-- `with check` ce qu'on peut écrire — les deux sont nécessaires.
create policy enneagramme_correction on public.enneagramme
  for update
  using      (auth.uid() = utilisatrice_id)
  with check (auth.uid() = utilisatrice_id
              and public.a_consenti_art9()
              and not public.est_barre_minorite());

-- RETRAIT : propriétaire SEULEMENT. Voir l'en-tête — retirer une étiquette n'est pas en déposer une,
-- et c'est précisément le geste de celle qui vient de révoquer son consentement.
create policy enneagramme_retrait on public.enneagramme
  for delete using (auth.uid() = utilisatrice_id);

-- ── 3. LA TENTATIVE EN COURS ──────────────────────────────────────────────────────────────────
--
-- 1:1 également : une seule tentative vivante à la fois. « Refaire le test » remplace la ligne et
-- change `tentative_id`, ce qui remonte jusqu'au composant (la `key` de remontage) et garantit
-- qu'aucune réponse de la passe précédente ne survit à l'écran.
create table public.enneagramme_tentative (
  utilisatrice_id uuid        primary key references public.utilisatrice(id) on delete cascade,
  tentative_id    uuid        not null default gen_random_uuid(),
  reponses        jsonb       not null default '{}'::jsonb,
  cree_le         timestamptz not null default now(),
  maj_le          timestamptz not null default now(),
  constraint enneagramme_tentative_forme check (public.reponses_enneagramme_valides(reponses))
);

alter table public.enneagramme_tentative enable row level security;
alter table public.enneagramme_tentative force  row level security;

create policy enneagramme_tentative_lecture on public.enneagramme_tentative
  for select using (auth.uid() = utilisatrice_id);

create policy enneagramme_tentative_depot on public.enneagramme_tentative
  for insert
  with check (auth.uid() = utilisatrice_id
              and public.a_consenti_art9()
              and not public.est_barre_minorite());

create policy enneagramme_tentative_revision on public.enneagramme_tentative
  for update
  using      (auth.uid() = utilisatrice_id)
  with check (auth.uid() = utilisatrice_id
              and public.a_consenti_art9()
              and not public.est_barre_minorite());

-- Abandonner une tentative en cours ne dépend de rien : c'est un retrait.
create policy enneagramme_tentative_retrait on public.enneagramme_tentative
  for delete using (auth.uid() = utilisatrice_id);

-- ── 4. L'HYPOTHÈSE D'ANAM ─────────────────────────────────────────────────────────────────────
--
-- Le cycle est isomorphe à `signal_reconceptualisation` (0020) : un germe naît `en_attente`, et va
-- vers un état terminal dont il ne revient pas.
--
-- ⚠️ `dite_le` EST SÉPARÉ DE `cree_le`, ET C'EST TOUTE LA LEÇON DE 0045. Une hypothèse PRODUITE
-- n'est pas une hypothèse DITE : la scène monte ses trois régions en permanence, `inert` sauf
-- l'active, et `app/page.tsx` se ré-exécute à chaque rafraîchissement. Une parole marquée « dite »
-- pendant le rendu serveur se dépense sans avoir jamais atteint un écran — la faute a été payée
-- deux fois (revue 4.10, puis migration 0045). `dite_le` ne se pose donc que sur un geste du CLIENT,
-- quand la région est active.
create table public.enneagramme_hypothese (
  id              uuid        primary key default gen_random_uuid(),
  utilisatrice_id uuid        not null references public.utilisatrice(id) on delete cascade,
  type            smallint    not null,
  statut          text        not null default 'en_attente',
  dite_le         timestamptz,
  cree_le         timestamptz not null default now(),
  maj_le          timestamptz not null default now(),
  constraint enneagramme_hypothese_type_borne  check (type between 1 and 9),
  constraint enneagramme_hypothese_statut_clos check (statut in ('en_attente', 'acceptee', 'refusee'))
);

-- UNE SEULE hypothèse en attente à la fois. L'unicité est STRUCTURELLE : l'étage `after()` qui
-- produit le germe ne consulte jamais `request.signal.aborted`, donc il s'exécute même quand elle a
-- fermé l'onglet — et il peut s'exécuter deux fois. Sans cet index, Anam finirait par avoir trois
-- hypothèses en attente et en dirait une par chargement.
create unique index enneagramme_hypothese_une_en_attente
  on public.enneagramme_hypothese (utilisatrice_id)
  where statut = 'en_attente';

-- La lecture du germe dû : la plus ancienne en attente, jamais dite.
create index enneagramme_hypothese_due
  on public.enneagramme_hypothese (utilisatrice_id, cree_le)
  where statut = 'en_attente' and dite_le is null;

alter table public.enneagramme_hypothese enable row level security;
alter table public.enneagramme_hypothese force  row level security;

create policy enneagramme_hypothese_lecture on public.enneagramme_hypothese
  for select using (auth.uid() = utilisatrice_id);

-- DÉPÔT DU GERME — c'est ici, et NULLE PART AILLEURS, que vit la garde de détresse (voir l'en-tête).
-- L'anti-forge de l'état initial est dans le trigger : une policy ne peut pas empêcher un `update`
-- ultérieur de reconstruire ce qu'un `insert` a refusé.
create policy enneagramme_hypothese_depot on public.enneagramme_hypothese
  for insert
  with check (auth.uid() = utilisatrice_id
              and public.a_consenti_art9()
              and not public.est_barre_minorite()
              and not public.branche_bloquee_par_detresse());

-- RÉPONSE À L'HYPOTHÈSE — accepter, refuser, ou marquer qu'elle a été dite.
--
-- ⚠️ SANS `a_consenti_art9()`, DÉLIBÉRÉMENT, et c'est la clause la plus importante de cette
-- migration. Une transition de statut n'est pas un dépôt de contenu : REFUSER doit rester possible
-- après révocation. Le dépôt correspondant, lui — l'écriture du type accepté dans `enneagramme` —
-- passe par la policy `enneagramme_depot`, qui est gatée. Accepter sans consentement échoue donc là
-- où il faut, et refuser réussit toujours.
create policy enneagramme_hypothese_reponse on public.enneagramme_hypothese
  for update
  using      (auth.uid() = utilisatrice_id)
  with check (auth.uid() = utilisatrice_id);

create policy enneagramme_hypothese_retrait on public.enneagramme_hypothese
  for delete using (auth.uid() = utilisatrice_id);

-- ── 5. LES HORODATAGES ET L'ANTI-FORGE (patron 0046) ──────────────────────────────────────────
--
-- `default now()` n'est qu'un défaut : un `.insert({cree_le: <hier>})` direct l'écrase. La condition
-- `auth.uid() is not null` est reprise mot pour mot de `branche` — `service_role` garde sa latitude
-- pour le réimport FR-067, sans quoi restaurer un export détruirait les dates qu'il prétend rendre.

create function public.enneagramme_horodatage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    if tg_op = 'INSERT' then new.cree_le := now(); end if;
    new.maj_le := now();
  end if;
  return new;
end;
$$;

create trigger enneagramme_horodatage
before insert or update on public.enneagramme
for each row execute function public.enneagramme_horodatage();

create trigger enneagramme_tentative_horodatage
before insert or update on public.enneagramme_tentative
for each row execute function public.enneagramme_horodatage();

-- ⚠️ `before insert OR update`, JAMAIS `before update` seul. Le trigger qui ne garde que l'UPDATE est
-- le défaut RÉCURRENT de ce dépôt : 0039→0041, 0021→0046, 0019→0046. Un germe forgé directement en
-- `acceptee` par un POST REST sauterait toute la machine ; une hypothèse refusée qui redevient
-- `en_attente` par un UPDATE reviendrait hanter l'écran.
create function public.enneagramme_hypothese_garde()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new; -- service_role : réimport FR-067, voir 0046
  end if;

  if tg_op = 'INSERT' then
    new.cree_le := now();
    new.maj_le  := now();
    -- Une hypothèse NAÎT en attente et NON DITE. La forger autrement, c'est se faire proposer par
    -- Anam une chose qu'elle n'a jamais formulée.
    if new.statut is distinct from 'en_attente' then
      raise exception 'enneagramme_hypothese : une hypothèse naît « en_attente » (reçu : %)', new.statut;
    end if;
    if new.dite_le is not null then
      raise exception 'enneagramme_hypothese : « dite_le » ne se pose pas à la naissance';
    end if;
    return new;
  end if;

  new.maj_le := now();
  -- L'anti-résurrection : un état terminal est terminal. Le `unique index` ne suffirait pas — il
  -- laisserait passer `refusee -> acceptee`, qui ne viole aucune unicité.
  if old.statut <> 'en_attente' and new.statut <> old.statut then
    raise exception 'enneagramme_hypothese : « % » est un état terminal', old.statut;
  end if;
  -- `dite_le` ne se rétracte pas : une parole dite ne se reprend pas.
  if old.dite_le is not null and new.dite_le is distinct from old.dite_le then
    raise exception 'enneagramme_hypothese : « dite_le » ne se réécrit pas';
  end if;
  -- Le type proposé est celui qu'Anam a formulé ; le réécrire ferait accepter autre chose que ce
  -- qui a été montré.
  if new.type <> old.type then
    raise exception 'enneagramme_hypothese : le type proposé ne se réécrit pas';
  end if;
  return new;
end;
$$;

create trigger enneagramme_hypothese_garde
before insert or update on public.enneagramme_hypothese
for each row execute function public.enneagramme_hypothese_garde();

-- ── 6. LES PRIVILÈGES ─────────────────────────────────────────────────────────────────────────
--
-- Supabase accorde les sept privilèges DML à `anon` et `authenticated` sur chaque table de `public`.
-- Le refus doit tomber au PRIVILÈGE pour `anon`, pas seulement à la RLS — depuis 0041, les tests
-- attendent le code `42501` et non « zéro ligne ».
revoke all on public.enneagramme            from anon;
revoke all on public.enneagramme_tentative  from anon;
revoke all on public.enneagramme_hypothese  from anon;

-- Les fonctions-trigger ne sont exécutables par aucun rôle client (patron 0007).
revoke execute on function public.enneagramme_horodatage()       from public, anon, authenticated;
revoke execute on function public.enneagramme_hypothese_garde()  from public, anon, authenticated;

-- Le prédicat de forme, lui, sert dans une contrainte : il doit rester évaluable.
revoke all     on function public.reponses_enneagramme_valides(jsonb) from public;
grant  execute on function public.reponses_enneagramme_valides(jsonb) to authenticated;

comment on table public.enneagramme is
  'Story 5.5 — le type d''ennéagramme RETENU (1:1). Aucun texte : l''interprétation vit dans lib/corpus.';
comment on table public.enneagramme_tentative is
  'Story 5.5 — les réponses EN COURS du test court. Effacée dès que le type est retenu (art. 9).';
comment on table public.enneagramme_hypothese is
  'Story 5.5 — le germe d''une hypothèse d''Anam : en_attente -> acceptee | refusee, sans retour.';

-- ── 7. LES DEUX SEULES ÉCRITURES QUI NE PEUVENT PAS ÊTRE UN SIMPLE `INSERT` ────────────────────
--
-- ⚠️ POURQUOI SI PEU DE RPC. Le réflexe, après 0036, serait de faire passer TOUTE écriture par une
-- fonction. Ce serait de la cérémonie : `authenticated` détient les sept privilèges DML, donc une
-- RPC n'ajoute AUCUNE garde — toutes vivent déjà dans les `with check` ci-dessus, et une RPC de plus
-- ne ferait qu'offrir un second chemin vers la même table, à re-garder à chaque migration.
--
-- Enregistrer une réponse, refuser une hypothèse, marquer qu'elle a été dite, effacer son type :
-- une table, une ligne, une policy. Le dépôt les écrit en direct, sous RLS, et c'est tout.
--
-- Les DEUX cas ci-dessous sont d'une autre nature : ils touchent DEUX tables qui doivent bouger
-- ensemble. C'est là, et seulement là, que la fonction paie son coût — pour la TRANSACTION, jamais
-- pour la garde.
--
-- ⚠️ `security INVOKER` DANS LES DEUX CAS, ET C'EST LA CLAUSE QUI PORTE TOUT. `security definer`
-- serait le réflexe (c'est ce que fait 0045), et il ferait disparaître les policies d'un coup : plus
-- de consentement, plus de barrière de minorité, plus d'appartenance. La fonction s'exécute sous
-- l'identité de l'appelante, donc sous sa RLS, et les gardes mordent DEDANS.
--
-- Toutes deux rendent un BOOLÉEN, jamais `void` : « est-ce CET appel qui a conclu ? ». `false` veut
-- dire « rien n'a bougé » — l'autre onglet est passé avant, ou il n'y avait rien à conclure — et
-- l'appelant RELIT plutôt que d'annoncer un échec. Une erreur Postgres, elle, reste une erreur.

-- ── 7a. CONCLURE LE TEST : le type entre, la tentative sort, d'un seul geste ───────────────────
--
-- L'en-tête l'a promis (§ « les réponses brutes s'effacent ») : dix-huit auto-évaluations sur la
-- manière dont on cède et dont on se protège sont un matériau plus intime que le type qu'on en tire.
-- En deux appels séparés, une panne entre les deux laisserait le type retenu ET les réponses en
-- place — c'est-à-dire exactement le résidu art. 9 que la décision voulait supprimer.
--
-- Le DELETE est en premier, et c'est lui qui sérialise : deux onglets qui concluent en même temps se
-- bloquent sur la même ligne, et le second voit zéro. Aucun verrou consultatif n'est nécessaire —
-- contrairement à 0045, où la cible était une colonne nullable d'une ligne qui, elle, ne bouge pas.
--
-- ⚠️ LE TYPE EST UN PARAMÈTRE, PAS UN CALCUL. Rejouer le barème en SQL le dupliquerait (R1-bis, payé
-- deux fois par ce dépôt). Le raisonnement complet est dans l'en-tête : le score n'est pas une garde,
-- et le pire qu'elle puisse se faire est de s'attribuer un type. La borne 1..9, elle, est dans la
-- contrainte de la table — donc une valeur hors domaine LÈVE (23514) au lieu d'entrer.
create function public.terminer_tentative_enneagramme(p_type smallint)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid        uuid := (select auth.uid());
  v_supprimees integer;
begin
  if v_uid is null then return false; end if;

  delete from public.enneagramme_tentative t where t.utilisatrice_id = v_uid;
  get diagnostics v_supprimees = row_count;
  -- Rien à conclure : soit l'autre onglet a gagné la course, soit personne n'a jamais répondu. Dans
  -- les deux cas on n'écrit AUCUN type — une tentative absente ne se conclut pas.
  if v_supprimees = 0 then return false; end if;

  -- Le `on conflict` est le chemin de la CORRECTION (AC2) : refaire le test remplace le type. Il
  -- passe par `enneagramme_correction`, donc sous consentement — et si celui-ci a été révoqué entre
  -- le premier énoncé et le dernier, l'insert LÈVE et la transaction entière est annulée : ses
  -- réponses lui restent.
  insert into public.enneagramme (utilisatrice_id, type, origine)
  values (v_uid, p_type, 'test')
  on conflict (utilisatrice_id) do update
    set type = excluded.type, origine = excluded.origine;

  return true;
end;
$$;

revoke execute on function public.terminer_tentative_enneagramme(smallint) from public, anon;
grant  execute on function public.terminer_tentative_enneagramme(smallint) to authenticated;

comment on function public.terminer_tentative_enneagramme(smallint) is
  'Story 5.5 (AC1) — conclut le test court : le type entre dans `enneagramme` (origine « test ») et la tentative est effacée, dans la MÊME transaction. Rend `true` si c''est cet appel qui a conclu. `security invoker` : les policies s''appliquent.';

-- ── 7b. ACCEPTER UNE HYPOTHÈSE : la réponse et le type, ensemble ───────────────────────────────
--
-- ⚠️ LE TYPE VIENT DE LA LIGNE, JAMAIS DE L'APPELANTE. C'est la clause de fond : accepter, c'est
-- accepter CE QUI A ÉTÉ MONTRÉ. Un `p_type` en paramètre laisserait un client accepter « le 4 »
-- pendant qu'Anam avait proposé le 7 — et le trigger anti-réécriture ne le verrait pas, puisqu'il
-- garde la colonne de l'hypothèse, pas ce qu'on en fait.
--
-- Le `statut = 'en_attente'` dans le WHERE est ce qui rend l'opération idempotente : une hypothèse
-- déjà acceptée ou déjà refusée rend zéro ligne, donc `false`, et rien n'est écrit. L'appartenance
-- n'est PAS répétée ici : elle est dans la policy `enneagramme_hypothese_reponse`, et l'ajouter ici
-- ferait une défense redondante qui couvrirait le retrait de l'autre (leçon de la campagne 5.4).
--
-- REFUSER n'a pas de fonction jumelle, et c'est voulu : refuser ne touche qu'une table. Le dépôt
-- l'écrit en direct, sans consentement requis, exactement comme la policy le prévoit.
create function public.accepter_hypothese_enneagramme(p_hypothese uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_type    smallint;
  v_touchee integer;
begin
  if v_uid is null then return false; end if;

  update public.enneagramme_hypothese h
     set statut = 'acceptee'
   where h.id = p_hypothese
     and h.statut = 'en_attente'
  returning h.type into v_type;

  get diagnostics v_touchee = row_count;
  if v_touchee = 0 then return false; end if;

  -- Si le consentement a été révoqué entre la proposition et l'acceptation, CET insert lève et la
  -- transaction est annulée : l'hypothèse RESTE en attente. C'est le bon état — elle n'a pas obtenu
  -- son type, donc rien ne doit se lire comme si elle l'avait accepté. Refuser, lui, reste ouvert
  -- (voir l'en-tête, § « le refus survit à la révocation »).
  insert into public.enneagramme (utilisatrice_id, type, origine)
  values (v_uid, v_type, 'hypothese')
  on conflict (utilisatrice_id) do update
    set type = excluded.type, origine = excluded.origine;

  return true;
end;
$$;

revoke execute on function public.accepter_hypothese_enneagramme(uuid) from public, anon;
grant  execute on function public.accepter_hypothese_enneagramme(uuid) to authenticated;

comment on function public.accepter_hypothese_enneagramme(uuid) is
  'Story 5.5 (AC2) — accepte l''hypothèse d''Anam : la ligne passe à « acceptee » et son type (celui de la LIGNE, jamais celui de l''appelante) entre dans `enneagramme` avec origine « hypothese ». Même transaction. Rend `true` si c''est cet appel qui a accepté.';
