-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 0046 — LES HORODATAGES ET LES ÉTATS INITIAUX SONT POSÉS PAR LA BASE, PAS PAR LE CLIENT
-- Revue de code du 2026-08-12, résidus du balayage des 27 tables
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
--
-- ── CE QUI A ÉTÉ MESURÉ, ET CE QUI A ÉTÉ RÉFUTÉ ───────────────────────────────────────────────
--
-- Le balayage des vingt-sept tables avait laissé cinq résidus. Éprouvés un à un sous un VRAI JWT,
-- deux d'entre eux se sont révélés FAUX — et il faut l'écrire, parce qu'ils reviendront à la
-- prochaine revue si personne ne dit qu'ils ont été examinés :
--
--   • « `fait_extrait` peut s'ancrer sur le journal d'une autre » → NON. Une contrainte `check` le
--     refuse (erreur 23514). L'ancrage croisé est fermé.
--   • « `branche_retour` accepte un INSERT direct pointant l'entrée d'autrui » → NON. La policy le
--     refuse (42501), et la clé étrangère COMPOSITE `(utilisatrice_id, entree_journal_id)` rend la
--     chose structurellement impossible.
--
-- Aucune frontière ENTRE PERSONNES n'est donc franchie. Ce qui reste est réel mais d'une autre
-- nature : le client choisit des valeurs que la base devrait imposer, sur SES PROPRES lignes.
--
-- ── CE QUI EST CORRIGÉ ICI ────────────────────────────────────────────────────────────────────
--
-- `cree_le` a `default now()` — un défaut, pas une règle. Un `.insert({ cree_le: <hier> })` direct
-- l'écrase. Mesuré : une entrée de journal antidatée de trente heures est acceptée.
--
-- Ça n'est pas cosmétique. `charger_proposition_branche` (0021) n'ouvre un moment qu'à partir du
-- JOUR CIVIL SUIVANT sa naissance — c'est ainsi que FR-059 empêche Anam de proposer une branche
-- pendant la première séance. Antidater le signal de trente heures suffit à faire tomber ce délai.
--
-- ── POURQUOI C'EST UNE CORRECTION DE COHÉRENCE, ET NON UNE NOUVELLE MÉCANIQUE ─────────────────
--
-- `branche` fait DÉJÀ exactement ça depuis la 4.7 : son trigger pose `new.cree_le := now()` et
-- `new.date_naissance := now()` dès que `auth.uid()` n'est pas nul, et refuse un état initial
-- forgé. Le patron est choisi, écrit, testé — il n'était simplement pas appliqué aux quatre tables
-- voisines. On l'étend, on n'invente rien.
--
-- ⚠️ `auth.uid() is not null` EST LA CONDITION, et elle est reprise mot pour mot de `branche` :
-- `service_role` garde sa latitude. L'Epic 6 (export puis réimport, FR-067) doit pouvoir restaurer
-- des lignes avec LEUR horodatage d'origine ; les réhorodater à l'import détruirait la mémoire
-- qu'on prétend rendre.
--
-- ── CE QUI N'EST DÉLIBÉRÉMENT PAS GARDÉ, ET POURQUOI ──────────────────────────────────────────
--
-- La CADENCE DE FEUILLAISON reste franchissable : un `update branche set etat='rayonnement',
-- intensite=1` direct saute le cycle que `progresser_feuillaison` étale sur des jours. Mesuré,
-- confirmé, et laissé tel quel — délibérément.
--
-- La monotonie (FR-029), l'anti-forge à l'insertion, la fixité de l'identité et la garde AD-17 sont
-- déjà dans le trigger `branche_cycle_garde` : une branche ne régresse pas, ne naît pas déjà mûre,
-- et ne pousse pas pendant un épisode de détresse. Ce qui reste, c'est le RYTHME — et le rythme ne
-- protège personne d'autre qu'elle-même. Le pire qu'elle puisse se faire est de voir son arbre en
-- pleine lumière sans l'avoir tendu ; c'est son arbre, et le rayonnement est de toute façon une
-- déclaration qui lui appartient.
--
-- C'est le raisonnement déjà écrit en toutes lettres dans la 0040 à propos de
-- `socle_complete_annonce_le` : « on ajouterait un mécanisme à comprendre, dans deux fonctions,
-- pour protéger quelqu'un de sa propre requête SQL contre son propre confort. Le rapport ne tient
-- pas. » Il tient ici pour la même raison, et il est consigné pour qu'une revue future ne le
-- retrouve pas comme un oubli.

-- ── 1. LE JOURNAL BRUT ────────────────────────────────────────────────────────────────────────

create function public.entree_journal_horodatage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- `service_role` (réimport FR-067) conserve l'horodatage d'origine : voir l'en-tête.
  if (select auth.uid()) is not null then
    new.cree_le := now();
  end if;
  return new;
end;
$$;

create trigger entree_journal_horodatage
before insert on public.entree_journal
for each row execute function public.entree_journal_horodatage();

comment on function public.entree_journal_horodatage() is
  'Revue du 2026-08-12 : `cree_le` est posé par la BASE pour tout écrivain sous JWT. `default now()` n''est qu''un défaut — un insert direct l''écrasait, et une entrée antidatée fait tomber le délai « le lendemain » de FR-059. Patron repris de `branche_cycle_garde` (0026).';

-- ── 2. LE SIGNAL DE RECONCEPTUALISATION ───────────────────────────────────────────────────────

create function public.signal_reconceptualisation_naissance()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    new.cree_le := now();
    -- ANTI-FORGE, symétrique de `branche` : un signal naît EN ATTENTE. L'insérer déjà `consomme`
    -- ou `ecarte` court-circuiterait le trigger de transition (0021), qui ne garde que l'UPDATE —
    -- exactement la leçon R1-ter de la revue 4.6 : le grant de table couvre INSERT autant qu'UPDATE.
    if new.statut is distinct from 'en_attente' then
      raise exception 'signal_reconceptualisation : un signal naît en_attente (anti-forge, Story 4.5)';
    end if;
  end if;
  return new;
end;
$$;

create trigger signal_reconceptualisation_naissance
before insert on public.signal_reconceptualisation
for each row execute function public.signal_reconceptualisation_naissance();

comment on function public.signal_reconceptualisation_naissance() is
  'Revue du 2026-08-12 : horodatage autoritaire + état initial imposé. Le trigger de transition de 0021 ne garde que l''UPDATE ; sans celui-ci, un insert direct posait un signal déjà `consomme`.';

-- ── 3. LES FAITS EXTRAITS ─────────────────────────────────────────────────────────────────────

create function public.fait_extrait_naissance()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    new.cree_le := now();
    -- `fait_extrait_no_resurrection` (0019) garde les transitions ; l'insertion, elle, ne doit pas
    -- pouvoir poser d'emblée un état terminal.
    if new.statut is distinct from 'actif' then
      raise exception 'fait_extrait : un fait naît actif (anti-forge)';
    end if;
  end if;
  return new;
end;
$$;

create trigger fait_extrait_naissance
before insert on public.fait_extrait
for each row execute function public.fait_extrait_naissance();

comment on function public.fait_extrait_naissance() is
  'Revue du 2026-08-12 : horodatage autoritaire + état initial imposé, symétrique de `branche` et du signal.';

-- ── 4. LE REGISTRE DES RETOURS ────────────────────────────────────────────────────────────────
--
-- `jour_paris` EST la clé de la cadence : `progresser_feuillaison` refuse un second incrément le
-- même jour en interrogeant cette colonne. Laissée au client, elle permettait d'inscrire un retour
-- daté d'un autre jour — sans gagner d'intensité (seule la RPC en accorde), mais en salissant le
-- registre qui sert de preuve. On la calcule ici, dans le même fuseau que l'ordonnanceur.

create function public.branche_retour_horodatage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    new.cree_le    := now();
    new.jour_paris := (now() at time zone 'Europe/Paris')::date;
  end if;
  return new;
end;
$$;

create trigger branche_retour_horodatage
before insert on public.branche_retour
for each row execute function public.branche_retour_horodatage();

comment on function public.branche_retour_horodatage() is
  'Revue du 2026-08-12 : `jour_paris` est la clé de la cadence de feuillaison — elle se calcule en base, dans le fuseau de l''ordonnanceur, jamais depuis le client.';
