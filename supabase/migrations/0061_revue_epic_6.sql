-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 0061 — CE QUE LA REVUE DE L'EPIC 6 A TROUVÉ, ET QUI SE RÉPARE EN SQL
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- Quatre défauts, dont DEUX DORMANTS — et c'est ce qui les rend graves. Ni la minorité détectée ni la
-- poussée nocturne ne se manifestent aujourd'hui : le classifieur n'est pas branché, le palier
-- n'honore aucune heure. Ils se réveilleraient à un changement d'infrastructure, c'est-à-dire au
-- moment où plus personne ne relit ce fichier.
--
-- Les quatre naissent du même endroit : **l'intervalle entre deux stories**. Chaque story est correcte
-- isolément ; le défaut vit dans ce qu'elles supposent l'une de l'autre.
--
-- Voir `_bmad-output/implementation-artifacts/revue-epic-6.md` (R2, R3, R10, R11).

-- ────────────────────────────────────────────────────────────────────────────────────────────────
-- R3 — LE CRÉNEAU DIURNE MORDAIT PARTOUT, SAUF LÀ OÙ IL RÉVEILLE QUELQU'UN
-- ────────────────────────────────────────────────────────────────────────────────────────────────
--
-- `creneauDiurneOuvert` (6 h ≤ h < 21 h, Europe/Paris) est appelé par `synthese.ts` et
-- `rappel-echeance.ts` — les deux jobs de COURRIEL. Le job de POUSSÉE, lui, ne le référence nulle
-- part : il lit l'heure choisie et pousse. Or c'est le seul des trois qui allume un écran verrouillé.
--
-- La 6.3 a bien posé le créneau « avant toute réservation dans `notifier()` ». Le socle ne passe pas
-- par `notifier()` : il appelle `reveiller()` sur le port de poussée. La garde n'a jamais couvert le
-- canal le plus intrusif.
--
-- ── OÙ LA GARDE SE POSE, ET POURQUOI PAS DANS LA COLONNE ──────────────────────────────────────
--
-- ⚠️ **J'AI D'ABORD ÉCRIT `check (heure between 6 and 20)` ICI, ET C'ÉTAIT LE MAUVAIS ENDROIT.**
--
-- `socle_quotidien_du` sélectionne les personnes dont l'heure choisie ÉGALE l'heure courante à Paris,
-- calculée en base (0053, « leçon de 0046 » : l'heure n'est pas un paramètre, sinon la garde ne
-- garderait plus que la sincérité de l'appelant). Borner la COLONNE bornait donc mécaniquement
-- l'émission — c'était séduisant, et douze tests sont devenus rouges d'un coup : ils construisent une
-- personne « due maintenant », ce qui exige que l'heure courante soit choisissable. **La suite se
-- serait mise à échouer tous les soirs après 21 h.** Une suite en laquelle on ne peut pas croire le
-- soir ne prouve rien le matin non plus.
--
-- Le créneau appartient à l'ÉMISSION, pas à la préférence. C'est déjà là que les deux jobs jumeaux le
-- posent (`synthese.ts`, `rappel-echeance.ts` appellent `creneauDiurneOuvert(ctx.instant)`), et il n'y
-- a ici aucun adversaire à contenir : celui qui émet, c'est notre propre ordonnanceur sous
-- `service_role`. La doctrine « la garde vit dans la base » protège contre un CLIENT authentifié qui
-- écrit en direct — un client ne peut pas se faire pousser une notification.
--
-- Le job gagne donc sa garde (`lib/ordonnanceur/jobs/socle-quotidien.ts`), exactement comme ses deux
-- frères. Et le sélecteur cesse de proposer 21 h à 5 h : promettre un réglage qui ne produira jamais
-- rien serait une panne invisible, ce que la 6.2 refuse déjà ailleurs.
--
-- Reste une seule chose à faire en SQL — remettre d'aplomb les préférences déjà écrites hors créneau
-- (le produit a proposé 00 h à 23 h depuis la 6.2). Sans ça, leur `<select>` n'aurait plus d'option
-- correspondante et s'afficherait vide : on leur montrerait un réglage qu'elles n'ont pas choisi.
--
-- ⚠️ Personne ne perd un réglage qui PRODUISAIT quelque chose : le palier `hobby` n'a jamais rien
-- émis. Cette ligne est la différence entre « on la réveille à 3 h le jour du passage en `pro` » et
-- « on ne la réveille pas ».
update public.preference_socle
   set heure = 8, maj_le = now()
 where heure < 6 or heure > 20;

comment on column public.preference_socle.heure is
  'Story 6.2 — l''heure choisie, en heure de Paris. Revue Epic 6 (R3) : le CRÉNEAU DIURNE (AD-17) '
  'n''est pas une contrainte de cette colonne mais une garde d''ÉMISSION, posée dans le job comme dans '
  'ses deux jumeaux (synthese, rappel-echeance). Borner la colonne aurait rendu la suite de tests '
  'dépendante de l''heure réelle — rouge tous les soirs après 21 h. Les préférences déjà écrites hors '
  'créneau ont été ramenées à 8 h par cette migration, faute de quoi leur sélecteur s''afficherait vide.';

-- ────────────────────────────────────────────────────────────────────────────────────────────────
-- R2 — LA MINORITÉ DÉTECTÉE NE PASSAIT PAS LA PORTE ÉCRITE POUR ELLE
-- ────────────────────────────────────────────────────────────────────────────────────────────────
--
-- ⚠️ **CE DÉPÔT A DÉJÀ APPRIS CETTE LEÇON, EN 0042, SUR LA MÊME PAIRE DE COLONNES.**
--
-- Il existe DEUX barrières de minorité, et 0042 le dit en toutes lettres :
--
--   • `mineur_detecte`       — minorité DÉCLARÉE au seuil d'âge (FR-070, story 1.4). Posée par
--                              `app/(auth)/naissance/actions.ts`, qui ne pose AUCUNE échéance.
--   • `barriere_minorite_le` — minorité DÉTECTÉE après coup (FR-071, story 1.9). Posée par
--                              `appliquer_barriere_minorite` (0006) AVEC l'échéance, et cette
--                              fonction n'écrit JAMAIS `mineur_detecte`.
--
-- `trancher_echeance_suppression` ne lisait que le premier. Conséquence : la seule population qui
-- obtienne une `echeance_suppression` par le chemin de la minorité est celle pour laquelle le test
-- vaut `false`. **La branche FR-071 était inatteignable pour les personnes qu'elle protège.**
--
-- Elles tombaient dans la grâce ordinaire — et la passaient : la barrière venant d'être posée, leur
-- `derniere_activite` est récente. `echeance_suppression` repassait donc à `null`. Et elle ne pouvait
-- plus être reposée : `appliquer_barriere_minorite` exige `barriere_minorite_le is null`, désormais
-- faux. Le compte restait **suspendu à vie et jamais effacé** — l'exact inverse de FR-071.
--
-- ⚠️ La réparation ne consiste PAS à faire écrire `mineur_detecte` par `appliquer_barriere_minorite`.
-- Les deux drapeaux disent deux faits différents (« elle a déclaré 14 ans » ≠ « on a détecté après
-- coup »), et 0042 a délibérément refusé de les confondre. C'est le LECTEUR qui doit lire les deux —
-- exactement ce que `est_barre_minorite()` a fini par faire en 0042.
create or replace function public.trancher_echeance_suppression(
  p_utilisatrice_id     uuid,
  p_inactivite_mois     integer,
  p_preavis_mois        integer,
  p_fenetre_pitr_jours  integer
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_echeance date;
  v_mineure  boolean;
begin
  if p_inactivite_mois is null or p_inactivite_mois <= 0
     or p_preavis_mois is null or p_preavis_mois <= 0 then
    raise exception 'echeances_invalides' using errcode = '22023';
  end if;

  -- LES DEUX BARRIÈRES, pas une seule (R2). `mineur_detecte` est `not null default false` ;
  -- `barriere_minorite_le` est nullable — pas de troisième valeur à gérer d'un côté comme de l'autre.
  select u.echeance_suppression,
         (u.mineur_detecte or u.barriere_minorite_le is not null)
    into v_echeance, v_mineure
    from public.utilisatrice u
   where u.id = p_utilisatrice_id;

  -- Compte déjà parti, ou échéance retirée entre la sélection et ici : un non-événement.
  if v_echeance is null or v_echeance > (now() at time zone 'Europe/Paris')::date then
    return 'ignoree';
  end if;

  -- FR-071 : la minorité ne se gracie pas, et aucun abonnement ne la protège.
  if v_mineure then
    perform public.effacer_utilisatrice(p_utilisatrice_id, 'minorite', p_fenetre_pitr_jours);
    return 'effacee';
  end if;

  -- ⚠️ LA GRÂCE : elle est revenue, ou elle s'est abonnée. Dans les deux cas on RETIRE l'échéance et
  -- on ne supprime rien. Remesuré ici, jamais lu plus tôt — l'intervalle entre les deux serait
  -- précisément le moment où elle revient.
  if public.derniere_activite(p_utilisatrice_id)
       > now() - make_interval(months => p_inactivite_mois + p_preavis_mois)
     or exists (select 1 from public.abonnement a
                 where a.utilisatrice_id = p_utilisatrice_id and a.etat = 'actif')
  then
    update public.utilisatrice set echeance_suppression = null where id = p_utilisatrice_id;
    return 'graciee';
  end if;

  perform public.effacer_utilisatrice(p_utilisatrice_id, 'inactivite', p_fenetre_pitr_jours);
  return 'effacee';
end;
$fn$;

revoke execute on function public.trancher_echeance_suppression(uuid, integer, integer, integer)
  from public, anon, authenticated;

comment on function public.trancher_echeance_suppression(uuid, integer, integer, integer) is
  'Story 6.8, corrigée par la revue Epic 6 (R2) : lit les DEUX barrières de minorité — déclarée '
  '(mineur_detecte, FR-070) ET détectée (barriere_minorite_le, FR-071). Elle n''en lisait qu''une, et '
  'c''était celle que le chemin de la détection n''écrit jamais : la branche FR-071 était donc '
  'inatteignable pour les seules personnes qu''elle protège, qui repartaient graciées et sans échéance '
  'reposable. Même oubli qu''en 0042, sur la même paire de colonnes.';

-- ────────────────────────────────────────────────────────────────────────────────────────────────
-- R10 — L'ÉCHÉANCE POSÉE EN UTC, COMPARÉE EN HEURE DE PARIS
-- ────────────────────────────────────────────────────────────────────────────────────────────────
--
-- `poser_echeance_suppression` calculait `(now() + interval)::date` — donc la date du jour civil UTC.
-- Les deux fonctions qui la consomment comparent, elles, à `(now() at time zone 'Europe/Paris')::date`
-- (0059:229 et 0059:269), comme les quinze autres comparaisons de date du dépôt.
--
-- Entre 22 h et minuit UTC (selon la saison), le jour civil parisien est déjà le lendemain : l'échéance
-- posée tombait alors **un jour plus tôt** que le préavis promis. Inerte avec le cron actuel (06 h UTC),
-- vivant au premier changement d'horaire — ou au premier appel hors cron.
create or replace function public.poser_echeance_suppression(
  p_utilisatrice_id uuid,
  p_preavis_mois    integer
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_pose boolean;
begin
  if p_preavis_mois is null or p_preavis_mois <= 0 then
    raise exception 'preavis_invalide' using errcode = '22023';
  end if;
  update public.utilisatrice
     -- Le jour civil de PARIS, comme partout ailleurs (R10). Le préavis se compte en jours vécus.
     set echeance_suppression =
           ((now() at time zone 'Europe/Paris') + make_interval(months => p_preavis_mois))::date
   where id = p_utilisatrice_id
     -- ⚠️ ON N'ÉCRASE JAMAIS UNE ÉCHÉANCE EXISTANTE. Celle de la minorité (1.9) est plus courte ;
     -- la repousser de trois mois ferait durer un compte qui doit disparaître sous trente jours.
     and echeance_suppression is null
  returning true into v_pose;
  return coalesce(v_pose, false);
end;
$fn$;

revoke execute on function public.poser_echeance_suppression(uuid, integer) from public, anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────────────────────────
-- R11 — DEUX GESTES, DEUX TRACES, UN SEUL EFFACEMENT
-- ────────────────────────────────────────────────────────────────────────────────────────────────
--
-- L'écran d'auto-effacement est un formulaire HTML pur, sans JavaScript et sans bouton désactivable —
-- choix assumé de la 6.7, et bon choix : il n'y a rien à charger pour exercer un droit. Le corollaire
-- est qu'un double-tap (courant sur un geste « important », surtout sur mobile) envoie deux requêtes.
--
-- Les deux `delete` sont idempotents et ne se voient pas — mais les deux `insert into effacement`
-- réussissent. **La trace censée prouver qu'un droit a été honoré mentait par duplication.** Le même
-- mécanisme vaut pour une collision entre l'auto-effacement et le job de rétention.
--
-- ⚠️ **LA RÉPARATION REND LA TRACE EXISTANTE, ELLE NE LÈVE PAS.** Lever ferait échouer la seconde
-- requête d'un double-tap — c'est-à-dire montrer une erreur à quelqu'un dont l'effacement vient de
-- réussir. `lib/data/effacer-donnees.ts` traite d'ailleurs un `null` comme un échec (« un null
-- voudrait dire qu'on a répondu sans effacer ») : rendre l'identifiant déjà posé est la seule issue
-- qui soit à la fois idempotente et honnête.
--
-- L'empreinte étant un SHA-256 déterministe de l'identifiant, la trace se retrouve sans clé étrangère —
-- ce que 0058 avait précisément prévu en refusant toute FK vers `utilisatrice`.
create or replace function public.effacer_utilisatrice(
  p_utilisatrice_id   uuid,
  p_motif             text,
  p_fenetre_pitr_jours integer
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_id        uuid;
  v_empreinte text;
begin
  if p_utilisatrice_id is null then
    raise exception 'effacement_sans_identite' using errcode = '42501';
  end if;
  if p_fenetre_pitr_jours is null or p_fenetre_pitr_jours < 0 then
    raise exception 'fenetre_invalide' using errcode = '22023';
  end if;

  v_empreinte := encode(sha256(p_utilisatrice_id::text::bytea), 'hex');

  -- ⚠️ LE VERROU ET L'EXISTENCE EN UN SEUL GESTE (R11). `for update` fait attendre le second appel
  -- jusqu'au commit du premier, PUIS relit : la ligne a disparu, `not found` est posé. Deux requêtes
  -- concurrentes ne peuvent donc plus poser deux traces pour un seul effacement.
  perform 1 from public.utilisatrice where id = p_utilisatrice_id for update;
  if not found then
    -- Déjà effacée. On rend la trace DÉJÀ POSÉE plutôt que d'en poser une seconde ou de lever.
    select e.id into v_id
      from public.effacement e
     where e.empreinte = v_empreinte
     order by e.demande_le desc
     limit 1;
    return v_id;
  end if;

  -- La trace AVANT l'effacement, et sans lien vers elle (voir 0058).
  insert into public.effacement (empreinte, motif, fenetre_pitr_jours, survivance_jusqu_au)
  values (
    v_empreinte,
    p_motif,
    p_fenetre_pitr_jours,
    now() + make_interval(days => p_fenetre_pitr_jours)
  )
  returning id into v_id;

  -- Les branches d'abord : seule clé `on delete restrict` du schéma (voir l'encadré de 0058).
  delete from public.branche where utilisatrice_id = p_utilisatrice_id;
  delete from public.utilisatrice where id = p_utilisatrice_id;
  delete from auth.users where id = p_utilisatrice_id;

  update public.effacement set base_effacee_le = now() where id = v_id;
  return v_id;
end;
$fn$;

revoke all on function public.effacer_utilisatrice(uuid, text, integer) from public, anon, authenticated;

comment on function public.effacer_utilisatrice(uuid, text, integer) is
  'Story 6.8, corrigée par la revue Epic 6 (R11) : LE MOTEUR UNIQUE d''effacement (AD-14), désormais '
  'IDEMPOTENT. `for update` verrouille et constate l''existence en un geste ; un second appel (double-tap '
  'sur un formulaire sans JavaScript, ou collision avec le job de rétention) rend la trace déjà posée '
  'au lieu d''en écrire une seconde. Réservé au rôle système : l''ordonnanceur efface pour quelqu''un '
  'qui n''a plus de session.';
