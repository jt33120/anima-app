-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 0048 — LA MAJORITÉ EST UNE GARDE DE BASE, PAS UNE GARDE DE FORMULAIRE
-- Revue de code du 2026-08-12, Lot 3 / Story 1.3 — FR-073, NFR-023, AD-13
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
--
-- ── LE DÉFAUT, EXPLOITÉ ────────────────────────────────────────────────────────────────────────
--
-- Le contrôle des 18 ans vivait ENTIÈREMENT dans `app/(auth)/naissance/actions.ts` : la Server
-- Action calcule l'âge, et selon le résultat écrit soit `date_naissance` (adulte), soit
-- `mineur_detecte = true` sans aucune date (mineure).
--
-- Or `authenticated` a le grant `UPDATE (date_naissance, …)` sur `public.utilisatrice` — c'est ce
-- qui permet à quelqu'un de corriger son prénom (FR-064) — et la RLS l'autorise sur SA ligne. Un
-- PATCH direct sur `/rest/v1/utilisatrice`, sous son propre jeton, contourne donc la Server Action
-- et le calcul d'âge avec elle. Mesuré le 2026-08-12 contre la base réelle :
--
--     PATCH /rest/v1/utilisatrice  { "date_naissance": "2013-06-15" }   → 200 ACCEPTÉ
--     en base : date_naissance = 2013-06-15, mineur_detecte = false
--     `etapeOnboardingPour` → « adulte », le parcours continue.
--
-- Treize ans, dans un produit qui traite des données de l'art. 9 et fait parler un modèle de
-- langage à quelqu'un sur sa vie intérieure. C'est la barrière légale la plus importante du
-- produit, et c'était la seule qui n'existait qu'en TypeScript.
--
-- ── LA QUATRIÈME FOIS ──────────────────────────────────────────────────────────────────────────
--
-- Le même défaut avait déjà été trouvé trois fois dans ce dépôt (barrière de minorité en 0042,
-- consentement en 0041, remboursement en 0043). La leçon ne change pas d'un mot :
--
--     **Une garde qui vit dans une Server Action, dans une RPC seule ou dans du TypeScript
--       n'existe pas.** Supabase accorde les sept privilèges DML à `authenticated` sur chaque
--       table de `public` ; seule une POLICY ou un TRIGGER est une garde.
--
-- ── POURQUOI UN TRIGGER ET PAS UNE CONTRAINTE ──────────────────────────────────────────────────
--
-- Un `check` ne peut pas appeler `now()` : PostgreSQL exige une expression IMMUTABLE, et une
-- contrainte doit rester vraie pour toujours — or « avoir 18 ans » devient vrai avec le temps, ce
-- qui est exactement le contraire d'un invariant de ligne. Le trigger vérifie AU MOMENT DE
-- L'ÉCRITURE, ce qui est la bonne sémantique : on ne réécrit jamais `date_naissance` (elle est
-- immuable depuis 0003), donc une ligne écrite majeure le reste.
--
-- ── LE FUSEAU : `Europe/Paris`, NOMMÉ ET ASSUMÉ ────────────────────────────────────────────────
--
-- L'âge se comptait en UTC côté TypeScript. Deux conséquences mesurées, opposées :
--
--   • en métropole, quelqu'un qui a 18 ans AUJOURD'HUI était REFUSÉ entre minuit et 2 h du matin
--     (heure de Paris), parce qu'UTC était encore la veille — un refus à tort, sans gravité ;
--   • aux Antilles (UTC−4), quelqu'un dont l'anniversaire est DEMAIN en heure locale était ADMIS
--     dès 20 h la veille, parce qu'UTC avait déjà basculé — une admission à tort, sur un mineur.
--
-- La Guadeloupe, la Martinique, la Guyane et La Réunion sont des départements français : ce n'est
-- pas un cas exotique pour un produit francophone.
--
-- On retient `Europe/Paris`, l'horloge déclarée du produit partout ailleurs (l'ordonnanceur, la
-- page d'abonnement). Le TypeScript est aligné dessus dans le même correctif, pour que le chemin
-- légitime ne se fasse jamais refuser par ce trigger.
--
-- RÉSIDU ASSUMÉ ET BORNÉ : une personne dans un département d'outre-mer à l'ouest de Paris peut
-- encore être admise jusqu'à six heures avant son anniversaire local. Le fermer complètement
-- exigerait de compter à UTC−12 — ce qui refuserait alors tout métropolitain pendant les quatorze
-- premières heures de son anniversaire. On préfère un résidu de quelques heures, nommé, à une
-- porte fermée une journée entière au visage de quelqu'un qui a l'âge.

create or replace function public.exiger_majorite()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_aujourdhui date := (now() at time zone 'Europe/Paris')::date;
begin
  if new.date_naissance is null then
    return new; -- une mineure détectée n'a JAMAIS de date stockée (AD-14) : rien à vérifier
  end if;

  -- Une date FUTURE n'est pas une naissance : c'est une donnée fausse, et l'accepter donnerait un
  -- âge négatif dont personne ne saurait quoi faire.
  if new.date_naissance > v_aujourdhui then
    raise exception 'date_naissance : une date de naissance ne peut pas être dans le futur';
  end if;

  -- `age(...)` de PostgreSQL compte en années/mois/jours civils : il gère les 29 février et les
  -- mois de longueurs inégales sans arithmétique maison.
  if new.date_naissance > (v_aujourdhui - interval '18 years') then
    raise exception
      'date_naissance : le produit est réservé aux 18 ans ou plus (FR-073). Une mineure n''a pas de date stockée — voir mineur_detecte.';
  end if;

  return new;
end;
$$;

drop trigger if exists utilisatrice_majorite on public.utilisatrice;
create trigger utilisatrice_majorite
  before insert or update of date_naissance on public.utilisatrice
  for each row
  execute function public.exiger_majorite();

comment on function public.exiger_majorite() is
  'Story 1.3 / revue du 2026-08-12 : le contrôle des 18 ans (FR-073) vivait uniquement dans la Server Action, donc contournable par un PATCH direct sur /rest/v1/utilisatrice sous le jeton de la personne — exploité, une date de naissance de 13 ans acceptée avec mineur_detecte à faux. La garde vit désormais là où elle ne s''oublie pas. Compte en heure de Paris, l''horloge déclarée du produit.';
