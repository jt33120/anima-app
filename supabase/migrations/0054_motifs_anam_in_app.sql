-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 0054 — LES MOTIFS D'ANAM, VUS DEPUIS L'APPLICATION (Story 6.3, FR-034 · AD-1, AD-15, AD-17)
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- ── CE QUE CETTE MIGRATION N'AJOUTE PAS, ET C'EST LA MOITIÉ DE SON INTENTION ────────────────────
--
--   • AUCUNE valeur au CHECK `notification_envoyee_motif_check` ;
--   • AUCUNE branche à `famille_motif` ;
--   • AUCUNE ligne de `reserver_notification` — le fichier n'est pas ouvert.
--
-- La 6.3 n'émet rien de nouveau : elle rend LISIBLE dans l'application ce qui existe déjà, et elle
-- ferme le trou qui compte — une annonce pouvait arriver sur un écran où l'app ne montrait rien.
--
-- ⚠️ `reserver_notification` NE SE RÉÉCRIT PAS. Sa réécriture en 4.10 a silencieusement rouvert le
-- trou de désabonnement de 0034, et aucun test de texte ne protège ses clauses (le harnais
-- `clausesDerniereDefinition` n'est câblé que sur `branche_insertion` / `branche_maj`). Comme la 6.3
-- n'ajoute aucun motif, il n'y a même pas de raison d'ouvrir le fichier.
--
-- ── POURQUOI UNE FONCTION, ET PAS TROIS `select` DANS LE DÉPÔT ─────────────────────────────────
--
-- Parce que la garde AD-17 doit vivre en base. Les policies de lecture existantes
-- (`intention_lecture` 0036:242, `synthese_proprietaire_lecture` 0029:48) ne portent QUE la
-- propriété — pas la fenêtre de détresse. Trois `select` écrits côté TypeScript diraient donc
-- « une échéance que tu as fixée arrive aujourd'hui » à quelqu'une en épisode, à la seconde où le
-- canal sortant, lui, refuse.
--
-- Le dépôt tranche déjà ce cas, et dans l'autre sens : `charger_proposition_branche` (0021:229) est
-- une lecture STRICTEMENT in-app, et elle porte `and not public.branche_bloquee_par_detresse()`.
-- Cette migration copie ce patron plutôt que d'en inventer un second.
--
-- ── POURQUOI PAS `personne_joignable` ──────────────────────────────────────────────────────────
--
-- Elle porte bien la détresse, mais elle exige AUSSI le consentement art. 9 vivant, l'absence de
-- barrière de minorité, et le non-refus de canal (art. 21) — toutes conditions de l'ENVOI, pas de
-- l'AFFICHAGE. Filtrer la carte là-dessus rendrait sa propre synthèse invisible à quelqu'un qui
-- s'est simplement désabonné des courriels. `branche_bloquee_par_detresse()` est la bonne garde :
-- keyée `auth.uid()`, `grant execute … to authenticated` depuis 0010, et déjà la source unique de
-- cette clause partout ailleurs.
--
-- ── L'ARBITRAGE N'EST PAS ICI ──────────────────────────────────────────────────────────────────
--
-- La fonction rend TOUS les motifs présents. Le choix de celui qui l'emporte est une règle de
-- produit, donc du domaine pur (`motifPrioritaire`, lib/domain/regime-anam.ts) — testable sans
-- base, et modifiable sans migration. Poser l'arbitrage en SQL le rendrait invisible aux tests de
-- domaine et coûterait une migration à chaque changement d'avis.
-- ════════════════════════════════════════════════════════════════════════════════════════════════

-- ── La lecture in-app des motifs d'Anam ──────────────────────────────────────────────────────────
--
-- `security invoker` : la RLS de chaque table borne à la propriétaire, comme pour
-- `charger_proposition_branche`. `stable` : trois lectures, aucune écriture.
--
-- Ce qui est rendu par motif :
--   • `echeance_intention`  → `titre` = le « si », `detail` = le « alors ». Art. 9, de sa main, et
--     c'est le POINT : AC3 exige que la spécificité vive dans l'app. L'application affiche déjà ces
--     deux champs verbatim dans le plan d'étapes, derrière l'authentification.
--   • `synthese_prete`      → `jour` = la fin de la période racontée. Aucun extrait du récit : la
--     carte annonce, elle ne résume pas.
--   • `proposition_branche` → `jour` = le jour du signal, et RIEN d'autre. Minimisation héritée de
--     4.5 : la proposition est générique, aucun verbatim ne traverse ce contrat.
create function public.motifs_anam_du()
returns table(motif text, jour date, titre text, detail text)
language sql
stable
security invoker
set search_path = ''
as $$
  -- (1) Une échéance d'intention tombant AUJOURD'HUI, jour civil de Paris.
  --
  -- Strictement `=`, jamais `<=` : une échéance passée n'est pas un rappel, c'est un reproche. La
  -- ligne s'éteint donc seule à minuit, et rien n'est jamais rattrapé — même sémantique que
  -- `intentions_echues` côté sortant, pour que les deux chemins ne puissent pas diverger.
  (select 'echeance_intention'::text, i.echeance, i.declencheur, i.action
   from public.intention i
   where i.utilisatrice_id = (select auth.uid())
     and i.echeance = (now() at time zone 'Europe/Paris')::date
     and not public.branche_bloquee_par_detresse()
   order by i.rang asc
   limit 1)

  union all

  -- (2) Une synthèse produite dans les trois derniers jours.
  --
  -- La MÊME fenêtre que `syntheses_non_annoncees(_, 3)` (0036:574), et pas une seconde horloge
  -- inventée : ce que le canal sortant considère encore annonçable est exactement ce que la carte
  -- considère encore frais. Il n'existe aucune notion de « lue » en base (table `synthese`, 0029 —
  -- pas de colonne `lu_le`), donc la ligne peut se répéter jusqu'à trois jours. Le correctif serait
  -- une colonne, donc une migration : décision suivante, pas celle-ci.
  (select 'synthese_prete'::text,
          (s.periode_fin at time zone 'Europe/Paris')::date,
          null::text,
          null::text
   from public.synthese s
   where s.utilisatrice_id = (select auth.uid())
     and s.cree_le > now() - interval '3 days'
     and not public.branche_bloquee_par_detresse()
   order by s.periode_fin desc
   limit 1)

  union all

  -- (3) Une proposition de branche, le LENDEMAIN d'une reconceptualisation.
  --
  -- ⚠️ On lit le SIGNAL, jamais la sortie de `chargerOuverture`. Celle-ci est un arbitrage à quatre
  -- sorties (complétion du socle, hypothèse d'ennéagramme, `null` avant même de lire le germe si le
  -- compte n'est pas premium, puis invitation) : dans ces quatre cas le signal reste `en_attente` —
  -- le motif EXISTE — et une carte branchée sur l'arbitrage resterait pourtant muette.
  --
  -- Mêmes clauses que `charger_proposition_branche` (0021:229), volontairement : jour civil Paris
  -- strictement antérieur, statut `en_attente`, hors fenêtre de détresse.
  (select 'proposition_branche'::text,
          (sr.cree_le at time zone 'Europe/Paris')::date,
          null::text,
          null::text
   from public.signal_reconceptualisation sr
   where sr.utilisatrice_id = (select auth.uid())
     and sr.statut = 'en_attente'
     and (sr.cree_le at time zone 'Europe/Paris')::date < (now() at time zone 'Europe/Paris')::date
     and not public.branche_bloquee_par_detresse()
   order by sr.cree_le asc
   limit 1);
$$;

revoke execute on function public.motifs_anam_du() from public, anon;
grant  execute on function public.motifs_anam_du() to authenticated;

comment on function public.motifs_anam_du() is
  'Story 6.3 (AC6/AC7/AC8) : les motifs d''Anam PRÉSENTS pour la propriétaire, vus depuis l''application. security invoker (RLS propriétaire) + `branche_bloquee_par_detresse()` sur les trois branches — même garde AD-17 que le canal sortant, portée en base et non en TypeScript. N''AJOUTE aucun motif de notification : le CHECK, `famille_motif` et `reserver_notification` sont intouchés. L''arbitrage entre motifs vit dans le domaine pur (motifPrioritaire), pas ici.';
