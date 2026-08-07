-- Migration forward-only — Story 5.1 : le thème natal, calculé une fois et gravé (AD-6, AD-13, AD-12).
--
-- Deux choses distinctes, et la distinction est le cœur de la migration :
--
--   1. les ENTRÉES de naissance (heure, lieu, prénom) → colonnes ORDINAIRES sur `utilisatrice`,
--      exactement comme `date_naissance` (0003). Ce ne sont PAS des données art. 9 : une date et un
--      lieu de naissance sont de l'état civil, pas une conviction.
--   2. la SORTIE (le thème natal lui-même) → table `theme_natal`, ART. 9, RLS deny-by-default +
--      write-gate consentement (gabarit 0005, durci 0006). Le thème natal EST une donnée relative
--      aux convictions philosophiques : c'est sa production qui bascule dans l'art. 9, pas ses entrées.
--
-- FRONTIÈRE DE DÉTERMINISME (AD-6/NFR-011) : rien ici n'appelle un modèle de langage, et le SQL n'a
-- aucun moyen de le faire. La garde effective vit dans `tests/astro-architecture.test.ts` (aucun
-- module de `lib/astro/` n'importe `@/lib/ai/*`). Cette migration porte l'autre moitié de AD-6 :
-- « calculé UNE FOIS puis stocké », rendu vrai par la clé primaire + le trigger de recalcul déclaré.

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 1. Les entrées de naissance optionnelles (FR-048) — données ORDINAIRES
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
--
-- Toutes NULLABLES : FR-048 ne rend obligatoires que le prénom et la date de naissance, et FR-049
-- exige que le socle se calcule quand même sans l'heure. Aucune de ces colonnes n'a de valeur par
-- défaut : « absent » doit rester distinguable de « renseigné », sinon la dégradation gracieuse
-- (5.3) n'a plus rien sur quoi s'appuyer.
--
-- La CAPTURE de ces champs n'est PAS dans cette story (5.3 pour l'heure, refonte de l'onboarding
-- pour le prénom). Elles naissent inertes, et c'est assumé : le calcul du thème doit être écrit
-- CONTRE leur absence, et il ne peut pas l'être si elles n'existent pas.

alter table public.utilisatrice add column prenom          text;
alter table public.utilisatrice add column nom_complet     text;
alter table public.utilisatrice add column heure_naissance time;
alter table public.utilisatrice add column lieu_naissance  text;
alter table public.utilisatrice add column lieu_latitude   double precision;
alter table public.utilisatrice add column lieu_longitude  double precision;
-- Identifiant IANA (« Europe/Paris »), jamais un décalage en heures : le décalage d'un lieu DÉPEND
-- de la date (heure d'été, et surtout les changements historiques de fuseau). Stocker « +01:00 »
-- rendrait faux tout thème d'un été, ou d'avant 1976 en France.
alter table public.utilisatrice add column lieu_fuseau     text;

-- Plages physiques. Une latitude à 300° n'est pas une donnée dégradée, c'est une donnée fausse :
-- elle produirait un ascendant plausible et faux, ce qui est le pire des deux mondes (P9).
alter table public.utilisatrice
  add constraint utilisatrice_lieu_latitude_plage
  check (lieu_latitude is null or (lieu_latitude >= -90 and lieu_latitude <= 90));
alter table public.utilisatrice
  add constraint utilisatrice_lieu_longitude_plage
  check (lieu_longitude is null or (lieu_longitude >= -180 and lieu_longitude <= 180));
-- Un lieu à moitié renseigné donne un ascendant à moitié faux. Les deux coordonnées vont ensemble.
alter table public.utilisatrice
  add constraint utilisatrice_lieu_coordonnees_ensemble
  check ((lieu_latitude is null) = (lieu_longitude is null));

-- ── WRITE-ONCE, et surtout PAS immuable (P4) ───────────────────────────────────────────────────
--
-- ⚠️ NE PAS COPIER `date_naissance_immuable()` (0003) ICI. Ce trigger-là refuse TOUT changement,
-- parce que la date de naissance porte le contrôle de majorité (FR-070) : la laisser bouger
-- laisserait quelqu'un contourner la barrière des 18 ans en se vieillissant puis se rajeunissant.
--
-- L'heure de naissance ne porte aucun contrôle de ce genre, et la story 5.3 promet EXACTEMENT
-- qu'on peut l'ajouter après coup (« le tronc se complète »). Une immuabilité franche rendrait
-- cette promesse intenable — et on ne s'en apercevrait qu'en développant la 5.3, après avoir écrit
-- la migration, les tests et la moitié de l'epic.
--
-- Le bon invariant est WRITE-ONCE : `null → valeur` permis (c'est la 5.3), `valeur → autre valeur`
-- refusé (le socle ne « bouge » pas, FR-051). Un effacement (`valeur → null`) est refusé aussi :
-- il rouvrirait la porte à un aller-retour valeur → null → autre valeur.
--
-- PORTÉE : les seules ENTRÉES ASTRONOMIQUES. `prenom` et `nom_complet` en sont volontairement
-- EXCLUS — ce sont des champs d'identité, pas des entrées de calcul céleste, et les figer
-- graverait une faute de frappe pour toujours. La correction par l'utilisatrice prime (FR-064).
create function public.naissance_ecrite_une_fois()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if old.heure_naissance is not null
     and new.heure_naissance is distinct from old.heure_naissance then
    raise exception 'heure_naissance : write-once — elle s''ajoute une fois, elle ne se réécrit pas (Story 5.1, AC9)';
  end if;
  if old.lieu_naissance is not null
     and new.lieu_naissance is distinct from old.lieu_naissance then
    raise exception 'lieu_naissance : write-once (Story 5.1, AC9)';
  end if;
  if old.lieu_latitude is not null
     and new.lieu_latitude is distinct from old.lieu_latitude then
    raise exception 'lieu_latitude : write-once (Story 5.1, AC9)';
  end if;
  if old.lieu_longitude is not null
     and new.lieu_longitude is distinct from old.lieu_longitude then
    raise exception 'lieu_longitude : write-once (Story 5.1, AC9)';
  end if;
  if old.lieu_fuseau is not null
     and new.lieu_fuseau is distinct from old.lieu_fuseau then
    raise exception 'lieu_fuseau : write-once (Story 5.1, AC9)';
  end if;
  return new;
end;
$$;

create trigger utilisatrice_naissance_ecrite_une_fois
  before update on public.utilisatrice
  for each row execute function public.naissance_ecrite_une_fois();

revoke execute on function public.naissance_ecrite_une_fois() from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 2. `theme_natal` — la sortie, art. 9, 1:1, versionnée
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
--
-- CLÉ PRIMAIRE SUR `utilisatrice_id` : c'est ELLE qui rend vrai « calculé une seule fois » (AD-6).
-- Pas une convention d'appelant, pas un `if (!existe)` dans un dépôt : une contrainte de base. Deux
-- requêtes concurrentes au premier affichage ne peuvent pas produire deux thèmes.
--
-- `contenu` est du JSONB de NOMBRES ET D'ÉNUMÉRATIONS, jamais de prose (FR-053, AC7) : une
-- prédiction ne peut pas s'écrire là où aucun texte libre n'existe. La garde est dans
-- `tests/astro-architecture.test.ts` ; ici on documente l'intention pour le prochain lecteur.
--
-- `empreinte_entrees` est un hachage des entrées effectivement employées (date, heure, coordonnées,
-- fuseau, système de maisons, identifiant d'adaptateur). Elle n'est PAS un cache : c'est la PREUVE
-- qu'un recalcul avait une raison (voir le trigger plus bas). Elle ne porte aucune donnée en clair.
create table public.theme_natal (
  utilisatrice_id   uuid        primary key references public.utilisatrice(id) on delete cascade,
  version           integer     not null default 1,
  empreinte_entrees text        not null,
  contenu           jsonb       not null,
  calcule_le        timestamptz not null default now(),
  constraint theme_natal_version_positive check (version >= 1)
);

alter table public.theme_natal enable row level security;
alter table public.theme_natal force  row level security;

-- Copie LITTÉRALE du gabarit `art9_temoin_ecriture` (0005 durci par 0006).
-- USING ouvert à la propriétaire → export RGPD et effacement restent possibles même après révocation
-- (AD-4/AD-14). WITH CHECK gaté → aucune écriture sans consentement valide et hors barrière (AD-13).
create policy theme_natal_ecriture on public.theme_natal
  for all
  using      (auth.uid() = utilisatrice_id)
  with check (auth.uid() = utilisatrice_id
              and public.a_consenti_art9()
              and not public.est_barre_minorite());

-- ── « Immuable ET versionné » : la règle, écrite (P5) ──────────────────────────────────────────
--
-- Pris à la lettre, l'énoncé de l'epic se contredit : ce qui est immuable ne se re-version pas.
-- La lecture juste est : IL NE CHANGE JAMAIS TANT QUE SES ENTRÉES N'ONT PAS CHANGÉ.
--
-- D'où ce trigger, qui refuse tout `update` SAUF s'il apporte les deux preuves à la fois :
--   • la version s'incrémente d'exactement 1 — un saut de version masquerait un historique ;
--   • l'empreinte des entrées DIFFÈRE — sans quoi « recalculer » veut dire « réécrire le même
--     thème autrement », c'est-à-dire faire bouger le socle, ce que FR-051 interdit.
--
-- C'est le SEUL levier de la story 5.3 (recalcul à l'ajout de l'heure), et il n'y en a pas d'autre.
--
-- `calcule_le` est POSÉ PAR LE SERVEUR, jamais accepté de l'appelant (patron 0023/0025) : une date
-- de calcul forgée ferait mentir toute enquête ultérieure sur « depuis quand ce thème est-il là ».
create function public.theme_natal_recalcul_declare()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Le premier thème part TOUJOURS de 1 : autoriser un `version: 99` à l'insert rendrait la suite
    -- des versions ininterprétable, sans rien apporter à personne.
    new.version    := 1;
    new.calcule_le := now();
    return new;
  end if;

  if new.utilisatrice_id is distinct from old.utilisatrice_id then
    raise exception 'theme_natal : la propriétaire d''un thème ne change pas';
  end if;
  if new.version is distinct from old.version + 1 then
    raise exception 'theme_natal : un recalcul incrémente la version de 1 exactement (AD-6, Story 5.1 AC8)';
  end if;
  if new.empreinte_entrees is not distinct from old.empreinte_entrees then
    raise exception 'theme_natal : un recalcul exige des entrées DIFFÉRENTES — sinon le socle bouge sans raison (FR-051, AC8)';
  end if;
  new.calcule_le := now();
  return new;
end;
$$;

create trigger theme_natal_immuable_sauf_recalcul
  before insert or update on public.theme_natal
  for each row execute function public.theme_natal_recalcul_declare();

revoke execute on function public.theme_natal_recalcul_declare() from public, anon, authenticated;

comment on table public.theme_natal is
  'Thème natal (Story 5.1, AD-6) : art. 9, 1:1 avec utilisatrice, CALCULÉ (jamais généré par un modèle de langage, NFR-011) et stocké une seule fois — l''unicité vient de la clé primaire, pas de la discipline de l''appelant. RLS propriétaire sous JWT + write-gate consentement (a_consenti_art9, 0005) et barrière minorité (est_barre_minorite, 0006) ; jamais service_role applicatif (AD-12). `contenu` = nombres et énumérations UNIQUEMENT, aucune prose : FR-053 (« le socle ne prédit jamais ») est rendu structurel, pas déclaratif. Immuable SAUF recalcul déclaré (version+1 ET empreinte d''entrées différente) — le seul levier de la Story 5.3 à l''ajout de l''heure de naissance.';

comment on column public.theme_natal.empreinte_entrees is
  'Hachage des entrées employées (date, heure, coordonnées, fuseau, système de maisons, identifiant d''adaptateur d''éphéméride). PREUVE qu''un recalcul avait une raison — pas un cache. L''identifiant d''adaptateur en fait partie EXPRÈS : le jour où une source de Chiron arrive, les entrées de naissance n''auront pas changé, et sans lui le trigger refuserait le recalcul.';
