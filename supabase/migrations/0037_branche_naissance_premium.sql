-- Migration forward-only — Story 3.3 : « Le tronc est gratuit, les branches sont premium » (FR-088).
--
-- La 4.10 a posé `est_premium_courante()` et gardé le plan d'étapes. L'inventaire de la 3.3 a montré que
-- la NAISSANCE D'UNE BRANCHE était la SEULE surface premium de FR-056 sans aucune garde : `branche_insertion`
-- ne regardait pas l'abonnement. Cette migration ferme ce trou, et rien d'autre.
--
-- ══ ⚠️ AVERTISSEMENT DE RÉÉCRITURE — LIRE AVANT DE TOUCHER À `branche_insertion` ═══════════════════════
--
-- Cette policy a DEUX amendeurs dans l'historique, et il faut les connaître tous les deux :
--   • `0021_branche.sql` l. 80  — CRÉATION (propriétaire, art. 9, minorité, détresse, nom, exists journal) ;
--   • `0023_branche_arbre_correctifs.sql` l. 59 — REMPLACEMENT INTÉGRAL, qui AJOUTE `etat = 'naissance'`
--     et `intensite = 0` (défense en profondeur du trigger, finding HAUTE reproduit en live : un
--     `.from("branche").insert({etat:'fruit'})` direct forgeait un rayonnement jamais déclaré).
--   • `0025_branche_cycle_vie.sql` n'y a PAS touché — malgré le commentaire « à relâcher en 4.7 » laissé
--     par 0023. Vérifié sur pièces : 0025 ne remplace que la policy UPDATE. Le texte de référence
--     ci-dessous est donc celui de 0023, INTÉGRAL, plus UNE clause.
--
-- Pourquoi cet en-tête existe : en 4.10, `reserver_notification` a été réécrite depuis sa version 0030 en
-- perdant EN SILENCE la garde de désabonnement que 0034 avait ajoutée. Rien dans le fichier ne disait
-- qu'il y avait un second amendeur. Seul un test de comportement l'a rattrapée. On ne recommence pas :
-- l'en-tête nomme les amendeurs, et `tests/tronc-branche-sql.test.ts` LIT LE TEXTE de toutes les
-- migrations, découpe chaque définition en clauses et vérifie que la DERNIÈRE les contient TOUTES. Une
-- réécriture qui en perd une dit désormais LAQUELLE, et depuis quel fichier.

-- ══ (1) La garde d'écriture : la naissance d'une branche demande un abonnement actif (AC3 [DUR]) ═══════
--
-- LEÇON R1 — LA GARDE VIT DANS LA POLICY, JAMAIS DANS LA SEULE RPC. `authenticated` détient le grant
-- INSERT **table-level** sur `branche` : un `.from("branche").insert(...)` direct contourne toute RPC.
-- Une garde premium posée uniquement dans `creer_branche_depuis_signal` serait décorative. Le `WITH CHECK`
-- est la barrière ; le fast-fail de la RPC (§2) n'est qu'un message lisible.
--
-- AD-9 — AUCUN COMMERCE NE S'INTERPOSE SUR LA SÉCURITÉ, et c'est vérifiable ici plutôt qu'affirmé :
-- `branche_bloquee_par_detresse()` refuse déjà TOUTE naissance pendant un épisode et les 72 h qui suivent.
-- Les deux clauses ne peuvent donc jamais se disputer un cas : quand la détresse parle, il n'y a rien à
-- vendre parce qu'il n'y a rien à écrire. La clause premium ne retire aucun accès de sécurité.
drop policy branche_insertion on public.branche;
create policy branche_insertion on public.branche
  for insert
  with check (auth.uid() = utilisatrice_id
              -- ── LA SEULE CLAUSE AJOUTÉE PAR LA 3.3 (FR-088). Tout le reste est le texte de 0023. ──
              and public.est_premium_courante()
              and public.a_consenti_art9()
              and not public.est_barre_minorite()
              and not public.branche_bloquee_par_detresse()
              and public.branche_nom_significatif(nom)
              and etat = 'naissance'          -- 0023 : la naissance ne forge pas un état (revue 4.6, HAUTE)
              and intensite = 0
              and exists (select 1 from public.entree_journal e
                          where e.id = extrait_source_id
                            and e.utilisatrice_id = (select auth.uid())));

-- ══ (2) `branche_maj` NE REÇOIT PAS la clause premium — décision D1-A, et c'est le CONTRAT ════════════
--
-- Un lecteur qui trouve un INSERT gardé et un UPDATE ouvert doit pouvoir lire ICI pourquoi, sans avoir à
-- deviner qu'il s'agit d'un oubli. Ce n'en est pas un.
--
-- `branche_maj` (0025 l. 199) est l'UNIQUE policy UPDATE de la table, et elle couvre TOUT le cycle :
-- le RENOMMAGE (4.6), la FEUILLAISON (4.7) et le RAYONNEMENT (4.7). Y poser la clause premium
-- reviendrait à empêcher quelqu'un dont l'abonnement s'est éteint de CORRIGER LE NOM d'une branche
-- qu'elle a nommée elle-même. Et le rayonnement, ce n'est pas une fonctionnalité : c'est « c'est devenu
-- vrai en moi » (FR-028). Le facturer reviendrait à vendre le droit de reconnaître quelque chose sur soi.
--
-- La règle de la maison, écrite en 4.10 dans `lib/scene/projection.ts` :
--   « Absent ≠ son plan disparaît : la LECTURE reste ouverte. Un paywall qui séquestre ce qui est déjà
--     écrit n'est pas un paywall. »
-- La 3.3 l'élargit d'un cran : le paywall porte sur ce qui S'AJOUTE, jamais sur ce qui est DÉJÀ À ELLE.
-- FR-029 (« l'arbre ne régresse jamais ») et la 3.5 (« l'arbre ne régresse pas du fait de la résiliation »)
-- l'exigent l'un comme l'autre.
--
-- L'ASYMÉTRIE AVEC LE PLAN D'ÉTAPES (0036) EST DÉLIBÉRÉE, PAS UNE INCOHÉRENCE : `intention_revision`
-- porte bien `est_premium_courante()`. Un plan d'étapes est un OUTIL qu'on continue d'alimenter ; une
-- branche déjà née est un ACQUIS. Et `intention_retrait`, lui, est ouvert sans gate — pour exactement la
-- même raison qu'ici : réduire ce qu'on détient ne se facture pas.
--
-- Ne PAS « harmoniser » ces trois policies sans rouvrir la décision D1 avec le PO.

-- ══ (3) Le fast-fail amical de la RPC — un message lisible, PAS la barrière ═══════════════════════════
--
-- Texte de référence : `0024_branche_nom_sans_glyphe.sql` l. 78 (dernière définition). Une seule clause
-- ajoutée. L'ORDRE DES DEUX GARDES EST SIGNIFIANT : la détresse d'abord, le commerce ensuite (AD-9).
-- Quelqu'un qui sort d'un épisode ne doit pas recevoir un refus qui parle d'abonnement — la seule chose
-- vraie à ce moment-là, c'est que rien ne naît pendant un épisode, quel que soit son abonnement.
--
-- NFR-022 : aucun des deux messages ne porte de contenu art. 9 (ni `p_nom`, ni l'extrait).
create or replace function public.creer_branche_depuis_signal(p_signal_id uuid, p_nom text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_entree uuid;
begin
  if public.branche_bloquee_par_detresse() then
    raise exception 'branche : aucune branche ne naît pendant un épisode de détresse ni dans les 72 h (AD-17, Story 4.5)';
  end if;

  -- Story 3.3 (AC3) — échec RAPIDE et LISIBLE. La vraie barrière est le WITH CHECK de `branche_insertion`
  -- (leçon R1) : sans ce fast-fail, le refus arriverait quand même, mais sous la forme d'un 42501 opaque
  -- APRÈS que le signal ait été verrouillé pour mise à jour.
  if not public.est_premium_courante() then
    raise exception 'branche : la naissance d''une branche demande un abonnement actif (FR-088, Story 3.3)';
  end if;

  select entree_journal_id into v_entree
    from public.signal_reconceptualisation
   where id = p_signal_id
     and utilisatrice_id = (select auth.uid())
     and statut = 'en_attente'
   for update;
  if v_entree is null then
    raise exception 'branche : signal introuvable, non possédé, ou déjà traité (isolation/anti-rejeu, Story 4.5)';
  end if;

  if p_nom is null or not public.branche_nom_significatif(p_nom) then
    raise exception 'branche : une branche sans nom donné par l''utilisatrice n''existe pas (AC2, Story 4.5)';
  end if;

  insert into public.branche (utilisatrice_id, extrait_source_id, nom, etat)
  values ((select auth.uid()), v_entree, public.branche_rogner_nom(p_nom), 'naissance')
  on conflict (utilisatrice_id, extrait_source_id) do nothing;

  update public.signal_reconceptualisation
     set statut = 'consomme'
   where id = p_signal_id and statut = 'en_attente';
end;
$$;

-- ══ (4) Privilèges — la leçon 0007, re-appliquée par principe ═════════════════════════════════════════
-- `create or replace function` PRÉSERVE les privilèges existants ; on les repose quand même, comme 0024
-- l'avait fait, pour que le fichier porte son contrat complet. Et surtout : `revoke ... from public` NE
-- RETIRE PAS `anon` — les `alter default privileges` de Supabase lui donnent un grant EXPLICITE. C'est
-- exactement ce que 0007 a dû corriger après coup sur `a_consenti_art9()`, et ce que la revue 4.10 a
-- retrouvé sur `est_premium_courante()` elle-même.
revoke all     on function public.creer_branche_depuis_signal(uuid, text) from public, anon;
grant  execute on function public.creer_branche_depuis_signal(uuid, text) to authenticated;

comment on function public.creer_branche_depuis_signal(uuid, text) is
  'Story 4.5 (AC2/AC3), gardée premium par la 3.3 (FR-088) : chemin « Oui », possédé sous JWT (security invoker). Résout l''extrait exact depuis un signal EN ATTENTE possédé (isolation/anti-rejeu), fait naître la branche (etat naissance) et consomme le germe, ATOMIQUEMENT. Fast-fail détresse PUIS premium (AD-9 : la sécurité parle avant le commerce) ; les barrières réelles sont dans le WITH CHECK de branche_insertion.';
