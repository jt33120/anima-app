-- Migration forward-only — revue des Epics 1 à 4 (trouvaille #11) : le compte d'une mineure
-- DÉCLARÉE n'était jamais effacé.
--
-- ══ LE DÉFAUT ═══════════════════════════════════════════════════════════════════════════════════
--
-- Ce dépôt distingue DEUX minorités, et 0042 puis 0061 l'écrivent en toutes lettres :
--
--   • `mineur_detecte`       — DÉCLARÉE au seuil d'âge (FR-070, story 1.4), posée par
--                              `app/(auth)/naissance/actions.ts` ;
--   • `barriere_minorite_le` — DÉTECTÉE après coup (FR-071, story 1.9), posée par
--                              `appliquer_barriere_minorite` AVEC son échéance de suppression.
--
-- 0061 a réparé le second chemin : `trancher_echeance_suppression` lit désormais les DEUX drapeaux.
-- Mais elle ne tranche que des comptes qui ONT une échéance, et 0061 le dit lui-même au passage :
-- « `mineur_detecte` … posée par `naissance/actions.ts`, qui ne pose AUCUNE échéance ».
--
-- Résultat, pour une adolescente qui répond honnêtement à la question de son âge :
--   `mineur_detecte = true`, `echeance_suppression = null` ;
--   `comptes_a_prevenir` l'exclut explicitement (« la minorité a son propre chemin ») ;
--   `comptes_a_effacer` exige une échéance, qu'elle n'a pas.
--
-- **Son compte ne sera jamais effacé.** Il porte son adresse e-mail et le fait, désormais permanent,
-- qu'elle a moins de dix-huit ans — une donnée personnelle de mineure, conservée sans limite et sans
-- chemin d'effacement. C'est l'exact inverse de ce que FR-070 promet, par le trou entre deux stories.
--
-- ══ LE CORRECTIF, EN DEUX TEMPS ═════════════════════════════════════════════════════════════════
--
-- (1) LE CHEMIN NOMINAL — `declarer_minorite(cible, echeance)`, sœur exacte de
--     `appliquer_barriere_minorite` : même posture système (`service_role` seul, décision de
--     sécurité), même idempotence, et surtout **la date arrive DÉJÀ CALCULÉE**. Le SQL ne code
--     jamais « 30 » (AD-14) : la durée vit dans `lib/safety/barriere-minorite`, en un seul endroit.
--
-- (2) L'INVARIANT — le trigger de monotonie refuse désormais une transition `false → true` qui
--     laisserait `echeance_suppression` à `null`. C'est une GARDE, pas un calcul : aucun seuil n'y
--     entre. Elle ferme le PATCH direct sur `/rest/v1/utilisatrice` — `authenticated` garde le
--     privilège de colonne sur `mineur_detecte` mais ne l'a pas sur `echeance_suppression` (0041),
--     donc ce chemin ne peut plus créer un compte indestructible : il échoue, bruyamment.
--
-- ⚠️ ON NE FUSIONNE TOUJOURS PAS LES DEUX DRAPEAUX. 0061 a refusé de faire écrire `mineur_detecte`
-- par `appliquer_barriere_minorite`, parce qu'ils disent deux faits différents (« elle a déclaré
-- 14 ans » ≠ « on a détecté après coup »). On ajoute donc une porte, on n'en élargit pas une.

create or replace function public.declarer_minorite(cible uuid, echeance date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Check-then-act SÉRIALISÉ, patron exact d'`appliquer_barriere_minorite` (0006) : l'UPDATE
  -- conditionnel prend le verrou de ligne. Idempotent — une seconde déclaration ne repousse pas
  -- l'échéance, sinon quelqu'un qui rouvre la page repousserait sa propre suppression indéfiniment.
  update public.utilisatrice
     set mineur_detecte = true,
         echeance_suppression = coalesce(echeance_suppression, echeance)
   where id = cible and mineur_detecte is not true;
end;
$$;

revoke all     on function public.declarer_minorite(uuid, date) from public, anon, authenticated;
grant  execute on function public.declarer_minorite(uuid, date) to service_role;

comment on function public.declarer_minorite(uuid, date) is
  'Revue Epics 1-4 : pose la minorité DÉCLARÉE (FR-070) AVEC son échéance de suppression — que `naissance/actions.ts` ne posait pas, laissant le compte hors de portée du moteur de rétention. Date déjà calculée (AD-14 : le SQL ne code jamais la durée). Système-only, patron `appliquer_barriere_minorite`.';

-- ── L'INVARIANT : pas de minorité sans échéance ─────────────────────────────────────────────────
create or replace function public.mineur_detecte_monotone()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if old.mineur_detecte is true and new.mineur_detecte is distinct from true then
    raise exception 'mineur_detecte : une barrière de minorité se pose, elle ne se retire pas (FR-070)';
  end if;

  -- Revue Epics 1-4 : poser la minorité SANS échéance crée un compte que le moteur de rétention
  -- n'atteindra jamais — `comptes_a_prevenir` exclut les mineures, `comptes_a_effacer` exige une
  -- échéance. Le chemin légitime passe par `declarer_minorite`, qui écrit les deux d'un coup.
  if old.mineur_detecte is not true and new.mineur_detecte is true
     and new.echeance_suppression is null then
    raise exception
      'mineur_detecte : une minorité déclarée doit porter son échéance de suppression (FR-070) — passer par declarer_minorite()';
  end if;

  return new;
end;
$$;
