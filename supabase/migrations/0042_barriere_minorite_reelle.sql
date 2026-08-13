-- Migration forward-only — REVUE DE CODE du 2026-08-11, lot 2. Trouvaille CRITIQUE + gap de 0041.
--
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- UNE MINEURE DÉTECTÉE POUVAIT ÉCRIRE DANS LE JOURNAL ART. 9
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
--
-- Séquence reproduite de bout en bout contre l'API HTTP réelle, le 2026-08-11 :
--
--   1. elle déclare 14 ans → `app/(auth)/naissance/actions.ts` pose `mineur_detecte = true`,
--      laisse `date_naissance` à null, et appelle `signOut()` ;
--   2. **le compte n'est pas désactivé** : elle se reconnecte et obtient un JWT neuf ;
--   3. `est_barre_minorite()` rend `false` ;
--   4. `POST /rest/v1/consentement` → ACCEPTÉ, `a_consenti_art9()` passe à `true` ;
--   5. `POST /rest/v1/entree_journal` → ACCEPTÉ. Une enfant de quatorze ans écrit sa vie
--      intérieure dans une base de données art. 9.
--
-- LA CAUSE, en six lignes :
--
--     create function public.est_barre_minorite() ... as $$
--       select exists (select 1 from public.utilisatrice u
--         where u.id = auth.uid() and u.barriere_minorite_le is not null);
--     $$;
--
-- Elle porte le nom de la garde et n'en implémente que LA MOITIÉ. Il existe DEUX barrières de
-- minorité dans ce produit :
--   • celle de la DÉCLARATION d'âge (Story 1.4, FR-070) — `mineur_detecte`. Elle n'existait qu'en
--     TypeScript, dans `etapeOnboarding`, et un `signOut()` ne ferme rien ;
--   • celle de la DÉTECTION après coup (Story 1.9, FR-071) — `barriere_minorite_le`. Elle, elle
--     est en base, et le contrôle du test le prouve : elle tient.
--
-- QUATORZE policies, sur NEUF tables (`art9_temoin`, `branche`, `branche_retour`, `entree_journal`,
-- `fait_extrait`, `intention`, `resume_glissant`, `signal_reconceptualisation`, `theme_natal`)
-- appellent cette fonction en croyant fermer la porte aux mineures. Aucune ne la fermait à celles
-- qui se déclarent. Réparer la fonction les répare toutes les quatorze d'un coup — c'est
-- précisément pourquoi la garde doit vivre là et pas dans quatorze policies recopiées.
--
-- ── C'EST LE MÊME DÉFAUT POUR LA TROISIÈME FOIS ───────────────────────────────────────────────
--
-- 0041 a refermé la barrière auto-levable (S1) et la révocation art. 9 réversible (S2). Voici la
-- troisième occurrence du même patron : UNE GARDE ÉCRITE EN TYPESCRIPT A L'AIR D'UNE GARDE ET
-- N'EN EST PAS UNE, parce que `authenticated` porte les sept privilèges DML sur chaque table et
-- que la RLS, elle, est satisfaite — c'est SA ligne.
--
-- ── ET LE TROU QUE 0041 A LAISSÉ ──────────────────────────────────────────────────────────────
--
-- 0041 a gelé `revoked_at` et `cree_le` par trigger, mais a laissé l'`UPDATE` de TABLE sur
-- `consentement` pour ne pas casser l'upsert idempotent du consentement initial. Conséquence :
-- `art9_accorde`, `ia_reconnue` et `cgu_acceptees` restaient librement réécrivables dans les deux
-- sens. La date de la preuve était infalsifiable, son contenu ne l'était pas.
--
-- Le patron « révoquer la table, re-granter les colonnes » ne s'applique PAS ici : l'upsert
-- (`ON CONFLICT DO UPDATE`) touche nécessairement ces trois colonnes. Ce qu'il faut interdire
-- n'est donc pas l'écriture, c'est UNE TRANSITION — comme pour `mineur_detecte` en 0041.

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 1. `est_barre_minorite()` dit enfin ce que son nom promet
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

create or replace function public.est_barre_minorite()
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1 from public.utilisatrice u
    where u.id = (select auth.uid())
      and (
        -- Story 1.9 / FR-071 : minorité DÉTECTÉE après coup, compte suspendu 30 jours.
        u.barriere_minorite_le is not null
        -- Story 1.4 / FR-070 : minorité DÉCLARÉE au seuil. C'est la moitié qui manquait.
        -- `mineur_detecte` est `not null default false` : pas de troisième valeur à gérer.
        or u.mineur_detecte
      )
  );
$$;

comment on function public.est_barre_minorite() is
  'Revue 2026-08-11 : couvre désormais les DEUX barrières — minorité déclarée (mineur_detecte, FR-070) ET détectée (barriere_minorite_le, FR-071). Elle n''en couvrait qu''une, et les 14 policies qui l''appellent laissaient donc écrire une mineure déclarée.';

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 2. `consentement` — une mineure ne consent pas
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
--
-- La policy `for all` de 0004 n'avait pour tout `with check` que la propriété de la ligne. Elle
-- est remplacée par trois policies, pour que le gate porte sur l'INSERTION sans jamais toucher à
-- la RÉVOCATION.
--
-- ⚠️ LA RÉVOCATION RESTE OUVERTE À UN COMPTE BARRÉ, et c'est délibéré : retirer son consentement
-- est un droit (FR-066), il ne se suspend pas avec le compte. C'est aussi ce dont a besoin une
-- mineure détectée pendant ses 30 jours (FR-071). Le gate de minorité ne va donc QUE sur l'INSERT.

drop policy consentement_proprietaire on public.consentement;

create policy consentement_lecture on public.consentement
  for select
  using (auth.uid() = utilisatrice_id);

create policy consentement_insertion on public.consentement
  for insert
  with check (auth.uid() = utilisatrice_id and not public.est_barre_minorite());

create policy consentement_maj on public.consentement
  for update
  using      (auth.uid() = utilisatrice_id)
  with check (auth.uid() = utilisatrice_id);

-- Aucune policy DELETE : le consentement est la PREUVE, il survit à tout sauf à l'effacement du
-- compte (cascade). 0041 avait déjà retiré le privilège ; l'absence de policy est la seconde
-- serrure.

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 3. Les trois drapeaux de consentement deviennent monotones
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
--
-- `false → true` reste permis : c'est le consentement initial, et c'est le rattrapage d'un
-- consentement partiel (`etapeOnboarding` renvoie vers /consentement tant que les drapeaux ne sont
-- pas tous vrais). `true → true` est un no-op, donc l'upsert idempotent passe.
-- `true → false` lève : la preuve de licéité ne se rétracte pas par une écriture directe — pour
-- cela il y a `revoked_at`, qui est le geste prévu, horodaté, et irréversible (0041).

create function public.consentement_drapeaux_monotones()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if old.art9_accorde and not new.art9_accorde then
    raise exception 'consentement : art9_accorde ne se retire pas par écriture — la sortie est revoked_at (Story 1.6)';
  end if;
  if old.ia_reconnue and not new.ia_reconnue then
    raise exception 'consentement : ia_reconnue ne se retire pas par écriture (FR-013 / AI Act art. 50)';
  end if;
  if old.cgu_acceptees and not new.cgu_acceptees then
    raise exception 'consentement : cgu_acceptees ne se retire pas par écriture (FR-012 / NFR-006)';
  end if;
  return new;
end;
$$;

create trigger consentement_drapeaux_monotones
  before update on public.consentement
  for each row execute function public.consentement_drapeaux_monotones();

revoke execute on function public.consentement_drapeaux_monotones() from public, anon, authenticated;

comment on function public.consentement_drapeaux_monotones() is
  'Revue 2026-08-11 : gap laissé par 0041. La date de la preuve art. 9 était figée, son contenu restait réécrivable dans les deux sens par le sujet lui-même.';
