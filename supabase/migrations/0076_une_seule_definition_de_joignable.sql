-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 0076 — UNE SEULE DÉFINITION DE « JOIGNABLE »
-- (revue adversariale du 2026-08-18, R9 et R28 · FR-012 · FR-070/FR-071 · NFR-006)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
--
-- ══ LA DÉLÉGATION EXISTAIT, ET ELLE A ÉTÉ ROMPUE PAR UN CORRECTIF ═════════════════════════════
--
-- La 0053 avait extrait le noyau et l'avait écrit noir sur blanc :
--
--     « Même geste qu'en 0036 avec `texte_significatif` : on EXTRAIT le noyau, et l'ancien nom
--       survit en DÉLÉGUANT. Il n'y a toujours qu'une seule définition de la clause de détresse
--       dans toute la base ; deux copies auraient divergé au premier amendement d'AD-17. »
--
-- Puis la 0072 a ajouté `cgu_acceptees` — et l'a fait en RÉ-INLINANT le corps dans
-- `eligible_au_periodique`, au lieu de l'ajouter au noyau. La délégation a disparu, les deux copies
-- ont divergé au premier amendement, exactement comme le commentaire l'annonçait. Et c'est
-- `personne_joignable`, le noyau, qui est resté sur l'ancienne règle.
--
-- ══ CE QUE ÇA PERMETTAIT ══════════════════════════════════════════════════════════════════════
--
-- La policy `consentement_proprietaire` (0004) n'a comme `with check` que
-- `auth.uid() = utilisatrice_id`. Un compte peut donc écrire, en direct sur PostgREST :
--
--     POST /rest/v1/consentement {art9_accorde: true, ia_reconnue: true, cgu_acceptees: false}
--
-- `a_consenti_art9()` et `eligible_au_periodique()` le refusent depuis la 0072. `socle_quotidien_du`
-- (0053, l. 254) l'accepte, parce qu'il appelle `personne_joignable`, restée sur `art9_accorde` et
-- `ia_reconnue` seuls. Le produit poussait donc une notification quotidienne à quelqu'un qui n'a
-- jamais accepté les CGU — et la case `cgu_acceptees` porte AUSSI la confirmation des dix-huit ans
-- (0004, FR-012/NFR-006). C'est le défaut même que la 0072 déclare avoir refermé.
--
-- ⚠️ ET LA MAJORITÉ N'ÉTAIT PAS POSITIVEMENT ÉTABLIE NON PLUS (R28). La 0066 a durci
-- `est_barre_minorite()` d'un `date_naissance is not null` — « toute absence barre », parce qu'un
-- compte qui saute `/naissance` n'a jamais fait se prononcer le trigger de la 0048. `personne_joignable`
-- ne demandait que l'ABSENCE de drapeaux de minorité : un compte sans date de naissance du tout
-- passait. La forme corrigée exige la présence, comme sa sœur.
--
-- ══ LA FORME DU CORRECTIF ═════════════════════════════════════════════════════════════════════
--
-- On ne recopie pas les deux clauses manquantes dans le noyau ET dans la copie : on RÉTABLIT la
-- délégation. Après cette migration il existe UNE définition de « joignable », et
-- `eligible_au_periodique` n'est plus que « joignable ET premium » — sa seule condition propre.
--
-- Ce qui compte n'est pas que les deux fonctions soient d'accord aujourd'hui. C'est qu'il redevienne
-- IMPOSSIBLE qu'elles divergent demain.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1. LE NOYAU, complété ────────────────────────────────────────────────────────────────────

create or replace function public.personne_joignable(p_utilisatrice uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.utilisatrice u
     where u.id = p_utilisatrice
       -- ⚠️ LA MAJORITÉ SE PROUVE, ELLE NE SE SUPPOSE PAS (R28, miroir de `est_barre_minorite`).
       -- Sans date, rien n'est établi : le trigger de la 0048 est armé sur cette colonne et n'a
       -- jamais eu l'occasion de se prononcer.
       and u.date_naissance is not null
       and u.barriere_minorite_le is null                        -- barrière posée après coup (0006, FR-071)
       and u.mineur_detecte is not true                          -- barrière persistante (FR-070)
       and exists (select 1 from public.consentement k
                    where k.utilisatrice_id = u.id
                      and k.art9_accorde = true
                      and k.ia_reconnue  = true
                      -- ⚠️ AJOUTÉ ICI ET NULLE PART AILLEURS (R9). La 0072 l'avait écrit dans la
                      -- copie plutôt que dans le noyau, ce qui a rompu la délégation. La case porte
                      -- les CGU ET la confirmation des dix-huit ans (0004, FR-012/NFR-006).
                      and k.cgu_acceptees = true
                      and k.revoked_at is null)                  -- consentement art. 9 VIVANT (0005)
       -- AD-17 — miroir EXACT de `branche_bloquee_par_detresse()`. Rien de nouveau ne lui est poussé
       -- pendant un épisode ni dans les 72 h qui suivent : ni bilan, ni rappel, ni socle.
       --
       -- ⚠️ Le socle est impersonnel et n'exige rien : on POURRAIT plaider qu'il ne nuit pas pendant une
       -- fenêtre de détresse. Ne pas l'envoyer ne coûte rien — il n'y a aucun rattrapage, la journée est
       -- simplement perdue. L'envoyer coûte un pari. On ne parie pas là-dessus.
       and not exists (select 1 from public.episode_detresse e
                        where e.utilisatrice_id = u.id
                          and (e.fin is null or e.fenetre_expire_at > now()))
  );
$$;

comment on function public.personne_joignable(uuid) is
  'Story 6.2, complétée par la revue adversariale du 2026-08-18 (R9/R28) : LE NOYAU de l''autorisation periodique, sans la condition premium — majorite POSITIVEMENT etablie (date de naissance presente), aucune barriere de minorite, consentement art. 9 VIVANT ET CGU acceptees (la meme case porte les dix-huit ans), aucune detresse en cours ni fenetre de 72 h chaude (AD-17). La 0072 avait ajoute `cgu_acceptees` a la COPIE (`eligible_au_periodique`) au lieu du noyau, rompant la delegation posee en 0053 : le socle quotidien partait alors a quelqu''un qui n''avait jamais accepte les CGU.';

-- ── 2. LA COPIE REDEVIENT UNE DÉLÉGATION ─────────────────────────────────────────────────────
--
-- Le corps était recopié depuis la 0053, puis amendé de son côté. Il ne reste ici que la condition
-- PROPRE à `eligible_au_periodique` : premium actif. Tout le reste est le noyau.

create or replace function public.eligible_au_periodique(p_utilisatrice uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.personne_joignable(p_utilisatrice)
     and exists (
       select 1 from public.abonnement a
        where a.utilisatrice_id = p_utilisatrice
          and a.etat = 'actif'                                   -- premium, et seulement premium
     );
$$;

comment on function public.eligible_au_periodique(uuid) is
  'Story 4.10, re-exprimee en 6.2 puis RE-DELEGUEE par la revue adversariale (R9) : `personne_joignable` (majorite etablie, minorite, consentement art. 9 + CGU, AD-17) ET premium actif. Le corps avait ete recopie par la 0072 pour y ajouter `cgu_acceptees` ; les deux definitions ont alors diverge, et le noyau est reste sur l''ancienne regle. Il n''existe de nouveau qu''UNE definition de « joignable ».';
