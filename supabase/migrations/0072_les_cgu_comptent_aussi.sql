-- Migration forward-only — revue des Epics 1 à 4 : les CGU n'étaient exigées NULLE PART.
--
-- ══ LE DÉFAUT ═══════════════════════════════════════════════════════════════════════════════════
--
-- L'écran de consentement présente DEUX cases distinctes, et 0004 dit pourquoi :
--   « cgu_acceptees : CGU acceptées + 18 ans confirmé (case DISTINCTE de l'art. 9 — FR-012/NFR-006) ».
--
-- Or `a_consenti_art9()` exige `art9_accorde` et `ia_reconnue`, jamais `cgu_acceptees`. Et côté
-- TypeScript, `etatConsentement` (etat-onboarding.ts) ne lit même pas la colonne : elle ne figure pas
-- dans son `select`.
--
-- La seule chose qui exigeait les CGU était le `if (!art9 || !cgu)` de la Server Action — c'est-à-dire
-- rien, pour qui écrit en direct. `authenticated` détient l'INSERT sur `consentement` : un
-- `POST /rest/v1/consentement {art9_accorde: true, ia_reconnue: true, cgu_acceptees: false}` passe la
-- policy, ouvre les quatorze policies art. 9, et l'onboarding la laisse entrer dans la scène.
--
-- **Le produit s'utilisait entièrement sans contrat.** Et la confirmation des dix-huit ans, que 0004
-- fait porter à cette même case, ne valait pas davantage.
--
-- C'est la famille de défauts la plus chère de ce dépôt, pour la sixième fois : une garde qui vit
-- dans une Server Action ne garde rien.
--
-- ══ LE CORRECTIF, ET SES TROIS POINTS ═══════════════════════════════════════════════════════════
--
-- (1) `a_consenti_art9()` — les quatorze policies héritent d'un coup, comme en 0042 et 0066.
-- (2) `eligible_au_periodique()` — le miroir de ces conditions pour l'ordonnanceur, qui n'a pas
--     d'`auth.uid()`. Sans lui, la synthèse hebdomadaire et le rappel d'échéance continueraient de
--     tourner pour quelqu'un sans contrat. Un test compare désormais les deux chemins sur ce point
--     précis, parce que deux écritures d'une même règle finissent par diverger (R1).
-- (3) Le TypeScript de l'onboarding, dans le même commit — sinon `etapeOnboarding` rendrait « suite »
--     à quelqu'un dont toutes les écritures art. 9 échouent ensuite en silence. Une garde qui laisse
--     entrer dans une pièce où plus rien ne fonctionne est pire que pas de garde.

create or replace function public.a_consenti_art9()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.consentement c
    where c.utilisatrice_id = (select auth.uid())
      and c.art9_accorde = true
      and c.ia_reconnue  = true
      -- Revue Epics 1-4 : la case des CGU (et de la confirmation des 18 ans, 0004) n'était exigée
      -- que par la Server Action. Le produit s'utilisait sans contrat par un POST direct.
      and c.cgu_acceptees = true
      and c.revoked_at is null
  );
$$;

create or replace function public.eligible_au_periodique(p_utilisatrice uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.utilisatrice u
      join public.abonnement a
        on a.utilisatrice_id = u.id and a.etat = 'actif'         -- premium, et seulement premium
     where u.id = p_utilisatrice
       and u.barriere_minorite_le is null                        -- barrière posée après coup (0006, FR-071)
       and u.mineur_detecte is not true                          -- barrière persistante (FR-070)
       and exists (select 1 from public.consentement k
                    where k.utilisatrice_id = u.id
                      and k.art9_accorde = true
                      and k.ia_reconnue  = true
                      and k.cgu_acceptees = true                 -- revue Epics 1-4 : miroir de a_consenti_art9
                      and k.revoked_at is null)                  -- consentement art. 9 VIVANT (0005)
       -- AD-17 — miroir EXACT de `branche_bloquee_par_detresse()`. Rien de nouveau ne lui est poussé
       -- pendant un épisode ni dans les 72 h qui suivent : ni bilan de semaine, ni rappel d'échéance.
       and not exists (select 1 from public.episode_detresse e
                        where e.utilisatrice_id = u.id
                          and (e.fin is null or e.fenetre_expire_at > now()))
  );
$$;
