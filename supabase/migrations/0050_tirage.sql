-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 0050 — LE JOURNAL DES TIRAGES : la graine, la taille du jeu, l'heure (Story 5.7)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
--
-- ── CE QUE CETTE TABLE EST ────────────────────────────────────────────────────────────────────
--
-- Un JOURNAL D'AUDIT, pas un état applicatif. AD-11 et le critère d'acceptation du PRD demandent que
-- « chaque tirage soit journalisé (graine + horodatage) pour audit ». La table existe pour qu'on
-- puisse REJOUER un tirage et retrouver la même carte — c'est ce qui rend l'uniformité vérifiable
-- autrement que sur parole.
--
-- Conséquence directe, et c'est la décision la plus structurante du fichier : IL N'Y A AUCUNE POLICY
-- D'UPDATE. Pas oubliée — absente. Un journal d'audit modifiable n'est pas un journal d'audit ; il a
-- l'air d'une preuve et n'en est pas une. Un tirage est un fait daté : il se produit, il s'efface
-- (FR-067), il ne se corrige jamais.
--
-- ── L'IDENTITÉ N'ENTRE QU'ICI, ET C'EST TOUT L'ENJEU D'AD-11 ──────────────────────────────────
--
-- AD-11 : « l'identité ne sert qu'à l'ÉCRITURE RLS de la lecture, jamais comme entrée de
-- sélection ». Cette migration est donc le SEUL endroit du tirage où `auth.uid()` apparaît. En
-- amont, `lib/tirage/tirer.ts` expose une fonction à ZÉRO ARGUMENT : il n'existe aucun canal par
-- lequel un profil pourrait influencer la carte. On tire d'abord, on écrit ensuite — et l'ordre est
-- testé (`tests/tirage-depot.test.ts`).
--
-- ── LA BASE N'ÉNUMÈRE PAS LES 24 CARTES, DÉLIBÉRÉMENT ─────────────────────────────────────────
--
-- Un `check (carte in ('porte-entrouverte', …))` aurait l'air plus sûr et créerait une SECONDE
-- source de vérité à côté de `lib/tirage/jeu.ts`. Les deux divergeraient à la première carte
-- ajoutée, et la divergence se manifesterait en production, sur une insertion refusée, au milieu
-- d'un rituel. La base valide donc la FORME d'une clé, pas la liste — la liste est du code, avec ses
-- tests.
--
-- ── CE QUI N'EST PAS GARDÉ ICI, ET QUI DOIT L'ÊTRE EN 5.8 ─────────────────────────────────────
--
-- ⚠️ RIEN N'EMPÊCHE AUJOURD'HUI DE TIRER DIX FOIS DE SUITE. L'UX interdit de PROPOSER un re-tirage
-- (« ne jamais faire : proposer un re-tirage »), mais tant que le tirage n'est pas rattaché à une
-- LECTURE — entité qui naît en 5.8 —, il n'existe pas de clé sur laquelle poser l'unicité. Une
-- utilisatrice déterminée pourrait rappeler le point d'entrée jusqu'à obtenir la carte qui lui
-- plaît. Ce n'est pas le défaut FR-016 (le SYSTÈME ne choisit pas), mais c'en est le voisin.
--
-- La 5.8 doit poser la contrainte au moment où `lecture` existe : un tirage par lecture, unicité
-- structurelle. Écrit ici plutôt que tu, et reporté dans `deferred-work.md`.
--
-- ── OÙ VIT LA GARDE DE DÉTRESSE, ET POURQUOI ELLE VIT ICI (AD-17) ─────────────────────────────
--
-- L'epic ne la demandait pas. Elle est ajoutée, et voici le raisonnement complet — à contester.
--
-- `theme_natal` (0039) ne la porte PAS : un calcul astronomique n'adresse rien à personne.
-- `enneagramme_hypothese` (0049) la PORTE : proposer une typologie de personnalité à quelqu'un en
-- détresse est exactement le « travail de schéma » que FR-037 suspend et qu'AD-17 borne à 72 h.
--
-- Un tirage est du côté de l'hypothèse, et plus chargé encore : une carte tirée pendant un épisode
-- ouvert, puis présentée comme porteuse de sens, c'est le registre que §5 suspend au moment précis
-- où le produit doit cesser d'être un oracle pour devenir un filet.
--
-- Et surtout : la table naît maintenant. Une garde ajoutée plus tard, c'est une migration de
-- rattrapage ET une fenêtre pendant laquelle elle n'existait pas. Coût assumé : pendant la fenêtre,
-- une demande de lecture est refusée — la 5.8 devra le dire avec des mots, pas avec une erreur.
--
-- ── TOUTES LES GARDES SONT DANS LE `with check` ───────────────────────────────────────────────
--
-- `authenticated` détient les sept privilèges DML sur chaque table de `public` (0041/0048). Une
-- garde qui ne vivrait que dans une RPC ou une Server Action serait contournée par un `.insert()`
-- direct depuis le client. La leçon est payée ; elle ne se repaie pas.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1. LA TABLE ───────────────────────────────────────────────────────────────────────────────

create table public.tirage (
  id              uuid        primary key default gen_random_uuid(),
  utilisatrice_id uuid        not null references public.utilisatrice(id) on delete cascade,
  -- La clé de carte. Forme validée, liste NON (voir l'en-tête).
  carte           text        not null,
  -- Le mot de 32 bits ACCEPTÉ par l'échantillonnage par rejet, en hexadécimal. C'est lui, et lui
  -- seul, qui détermine la carte : `rejouer(graine, taille_jeu)` doit retrouver `carte`.
  graine          text        not null,
  -- ⚠️ LA PIÈCE SANS LAQUELLE L'AUDIT CASSE EN SILENCE. Le jour où le jeu passe de 24 à 26 cartes,
  -- rejouer une ligne ancienne avec la taille COURANTE donne `graine % 26` au lieu de `graine % 24` :
  -- une carte fausse, rendue avec assurance, sur toutes les lignes antérieures. Quatre octets
  -- journalisés rendent l'audit définitif.
  taille_jeu      integer     not null,
  tire_a          timestamptz not null default now(),

  -- Une clé du jeu : minuscules et tirets, jamais vide, jamais bornée par un tiret. Un `check` de
  -- forme attrape la corruption et l'injection de casse sans dupliquer le catalogue.
  constraint tirage_carte_forme  check (carte ~ '^[a-z]+(-[a-z]+)*$' and length(carte) <= 64),
  -- Exactement huit caractères hexadécimaux minuscules — le format que `rejouer()` sait relire. Une
  -- ligne non rejouable est PIRE qu'une ligne absente : elle a l'air d'une preuve.
  constraint tirage_graine_forme check (graine ~ '^[0-9a-f]{8}$'),
  -- Plancher à 2 : un « tirage » dans un jeu d'une carte est une constante déguisée, et il passerait
  -- n'importe quel test de distribution. Plafond généreux : au-delà, ce n'est plus une décision
  -- produit, c'est une valeur corrompue.
  constraint tirage_taille_borne check (taille_jeu between 2 and 4096)
);

alter table public.tirage enable row level security;
alter table public.tirage force  row level security;

-- L'accès « Mes lectures » (5.8) lit les tirages d'une personne du plus récent au plus ancien.
create index tirage_par_personne on public.tirage (utilisatrice_id, tire_a desc);

comment on table public.tirage is
  'Story 5.7 — journal d''audit des tirages (AD-11). Immuable par conception : aucune policy d''UPDATE. `graine` + `taille_jeu` rendent chaque ligne rejouable ; `taille_jeu` est indispensable le jour où le jeu change de taille.';

-- ── 2. L'HORODATAGE EST POSÉ PAR LA BASE ──────────────────────────────────────────────────────
--
-- `default now()` n'est qu'un défaut : un `.insert({ tire_a: <hier> })` direct l'écrase. Sur un
-- journal d'audit, une heure choisie par l'écrivain vide la journalisation de son sens. Patron repris
-- mot pour mot de 0046.

create function public.tirage_horodatage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- `service_role` (réimport FR-067) conserve l'horodatage d'origine : même condition qu'en 0046.
  if (select auth.uid()) is not null then
    new.tire_a := now();
  end if;
  return new;
end;
$$;

create trigger tirage_horodatage
before insert on public.tirage
for each row execute function public.tirage_horodatage();

comment on function public.tirage_horodatage() is
  'Story 5.7 — `tire_a` est posé par la BASE pour tout écrivain sous JWT : sur un journal d''audit, une heure choisie par l''écrivain n''atteste de rien.';

-- ── 3. LES POLICIES ───────────────────────────────────────────────────────────────────────────

-- LECTURE : propriétaire, et rien d'autre. Ni consentement, ni premium, ni détresse — ses propres
-- lignes lui restent lisibles quoi qu'il arrive, parce que l'export FR-067 en dépend. Même doctrine
-- qu'en 0049 : un socle qui séquestre ce qu'il a déjà écrit n'est pas un socle.
create policy tirage_lecture on public.tirage
  for select using (auth.uid() = utilisatrice_id);

-- DÉPÔT : les quatre gardes, toutes dans le `with check`.
--
-- `a_consenti_art9()` mérite sa justification, parce qu'un mot de 32 bits n'est pas en soi une
-- donnée sensible : le tirage OUVRE un rituel dont la suite immédiate — « qu'est-ce que tu vois ? »
-- — recueille de l'art. 9. On garde la porte, pas la pièce. Et le sens de la garde est le bon : si
-- le consentement est révoqué en vol, le tirage échoue, il ne se poursuit pas.
create policy tirage_depot on public.tirage
  for insert
  with check (auth.uid() = utilisatrice_id
              and public.a_consenti_art9()
              and not public.est_barre_minorite()
              and not public.branche_bloquee_par_detresse());

-- RETRAIT : propriétaire seulement (FR-067). Effacer ce qu'on a tiré ne dépend d'aucune condition —
-- c'est précisément le geste de celle qui vient de révoquer son consentement.
create policy tirage_retrait on public.tirage
  for delete using (auth.uid() = utilisatrice_id);

-- ⚠️ AUCUNE POLICY D'UPDATE, ET C'EST LA DÉCISION, PAS UN OUBLI. Voir l'en-tête. Si une story
-- future en ajoute une, elle devra d'abord expliquer ce qu'un tirage corrigé pourrait bien vouloir
-- dire — `tests/tirage-sql.test.ts` la fera échouer d'ici là.
