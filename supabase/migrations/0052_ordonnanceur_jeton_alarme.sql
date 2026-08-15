-- Migration forward-only — Story 6.1a : la base de l'ordonnanceur grandit AVANT que la rétention ne
-- s'appuie dessus.
--
-- Quatre sujets, un seul thème. L'Epic 6 va brancher sur cet ordonnanceur un moteur qui EFFACE. Tout ce
-- qui, jusqu'ici, se rattrapait par un index d'unicité ou par une seconde synthèse inoffensive devient
-- irréversible. On ferme donc, dans l'ordre :
--
--   1. LE VOCABULAIRE FERMÉ — l'absence d'art. 9 cesse d'être une politesse d'appelant (NFR-020/022).
--   2. LE JETON DE PROPRIÉTÉ — seul celui qui détient la réclamation courante peut clore (dette T6-19).
--   3. LES CONTRAINTES DE FORME — la défense qui survit à un appelant distrait.
--   4. L'ALARME QUI PEUT S'ÉTEINDRE — un job réparé fait repasser `/api/health` à `ok`.
--
-- ⚠️ LIRE 0027 SEUL DONNE UNE VERSION PÉRIMÉE. `clore_execution` a été durcie par 0035 ;
-- `etat_ordonnanceur` et `sante_ordonnanceur_publique` réécrites par 0031. Cette migration est la
-- QUATRIÈME définition de la sonde publique. C'est pourquoi la garde de couture, côté TypeScript, vise
-- la définition COURANTE (`definitionCourante`, livrée par la 6.1) et jamais un numéro de migration.


-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 1. LE VOCABULAIRE FERMÉ — on ne peut pas assainir un message, on ne peut que RECONNAÎTRE les siens
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- Jusqu'ici, la garantie « aucun art. 9 en base » ne tenait qu'à la LONGUEUR (`motif_echec` ≤ 120,
-- `detail` ≤ 200) et à la discipline des appelants. Une phrase courte contenant un prénom passait sans
-- rien déclencher. Or le moteur de rétention de l'Epic 6 écrira ses propres motifs d'échec, sur des
-- chemins qui manipulent des identifiants de personnes.
--
-- Le raisonnement est celui de `lib/domain/code-erreur.ts`, et il est plus strict qu'il n'en a l'air : un
-- message d'erreur est un ramasse-miettes. Il a pu traverser un adaptateur qui recopie l'entrée, une
-- bibliothèque qui cite la valeur fautive, un pilote qui rend la ligne. On ne peut donc PAS assainir un
-- message — on ne peut que reconnaître les nôtres et jeter le reste. Cette fonction est le miroir SQL de
-- cette décision, aux deux formes identiques.
--
-- ⚠️ ELLE NE LÈVE JAMAIS, et c'est le cœur de sa conception. La tentation était d'écrire le `CHECK` seul
-- et de laisser la contrainte rejeter : mais `clore_execution` s'appelle DANS un chemin d'erreur. Une
-- contrainte qui lève y ferait perdre la trace de l'échec qu'on essayait justement d'enregistrer —
-- l'erreur mangerait sa propre trace, et `executer.ts` laisserait la ligne `en_cours` sous son bail. Le
-- repli produirait plus de dégât que le chemin nominal : l'exact inverse d'AD-15.
create or replace function public.code_reconnu(p_texte text, p_max integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    -- Rien à dire se dit `null`, pas chaîne vide : une chaîne vide est une valeur qui ne veut rien dire
    -- et qu'il faudrait ensuite tolérer dans la contrainte de forme — donc un trou d'exactement un mot.
    when p_texte is null or p_texte = '' then null
    when length(p_texte) > p_max then 'erreur_non_identifiee'
    -- Un code interne : au moins DEUX segments en minuscules reliés par `_`. L'exigence de deux segments
    -- n'est pas cosmétique — sans elle, un mot unique en minuscules, c'est-à-dire un mot pris au verbatim
    -- d'une utilisatrice, passerait la garde.
    when p_texte ~ '^[a-z0-9]+(_[a-z0-9]+)+$' then p_texte
    -- Un code de nos RPC : « reclamer_execution: 42501 ».
    when p_texte ~ '^[a-z_]+: [A-Z0-9]+$' then p_texte
    else 'erreur_non_identifiee'
  end;
$$;

-- Supabase accorde AUTOMATIQUEMENT `execute` à `authenticated` sur toute nouvelle fonction du schéma
-- `public` (leçon de la migration 0007). Celle-ci est pure et inoffensive — mais la règle du dépôt est
-- qu'on ne laisse pas traîner un grant qu'on n'a pas décidé.
revoke execute on function public.code_reconnu(text, integer) from public, anon, authenticated;

comment on function public.code_reconnu(text, integer) is
  'Story 6.1a : miroir SQL de `lib/domain/code-erreur.ts`. Reconnaît les deux formes de code du produit, remplace tout le reste par `erreur_non_identifiee`. NE LÈVE JAMAIS — elle est appelée depuis des chemins d''erreur (NFR-020/NFR-022).';


-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 2. LE JETON DE PROPRIÉTÉ — la dette T6-19, refermée
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- CE QUE 0035 A FERMÉ, ET CE QU'IL A LAISSÉ OUVERT. La migration 0035 a rendu les états terminaux
-- terminaux (`and statut = 'en_cours'`) : une clôture tardive n'écrase plus un `reussi`. Reste le cas
-- que `deferred-work.md` nomme depuis :
--
--   A réclame la fenêtre, part travailler, et se fait geler (redémarrage serverless, GC, réseau).
--   Le bail expire. B réclame la même fenêtre — légitimement : c'est exactement le mécanisme de reprise.
--   A revient à la vie et clôt. La ligne est `en_cours` (celle de B), donc 0035 ne la protège pas :
--   la clôture de A s'applique à l'exécution de B.
--
-- Concrètement, sur la rétention : A clôt en `reussi` un effacement que B est en train de faire et qui
-- va échouer — la fenêtre est réputée purgée, et rien ne repassera jamais. Ou l'inverse : A clôt en
-- `echoue` ce que B a réussi, la fenêtre redevient réclamable, et la purge REJOUE.
--
-- LE JETON. `reclamer_execution` frappe un identifiant neuf à chaque prise de main et le rend à
-- l'appelant ; `clore_execution` ne l'accepte que s'il correspond au jeton COURANT de la ligne. A revient
-- avec un jeton périmé : sa clôture ne fait rien, et le dit.
--
-- ⚠️ LA GARDE VIT DANS LA FONCTION SQL, JAMAIS DANS LE TYPESCRIPT APPELANT. `authenticated` n'a pas
-- `execute` sur ces fonctions (revoke en 0027), donc la doctrine du dépôt — « une garde qui ne vit que
-- dans une route ou une RPC ne garde rien » — ne mord pas ici au sens littéral. La règle vaut quand
-- même : la vérité d'une écriture se garde là où l'écriture a lieu, sinon le prochain appelant l'oublie.

-- `not null default gen_random_uuid()` : les lignes existantes reçoivent un jeton qu'aucun appelant ne
-- détient, donc PLUS PERSONNE ne peut clore une exécution héritée de l'avant-migration. C'est la bonne
-- valeur par défaut : ces lignes-là sont soit terminées (rien à clore), soit orphelines d'un déploiement
-- précédent (leur bail expirera et quelqu'un les re-réclamera proprement).
alter table public.execution_job
  add column jeton uuid not null default gen_random_uuid();

comment on column public.execution_job.jeton is
  'Story 6.1a : le jeton de propriété de la réclamation COURANTE. Frappé neuf à chaque prise de main ; seul son détenteur peut clore. Un uuid opaque — aucune donnée, aucun lien avec une personne.';

-- ⚠️ `drop` OBLIGATOIRE, et pas `create or replace`. Postgres refuse de remplacer une fonction dont le
-- TYPE DE RETOUR change (`boolean` → `uuid`), et pour `clore_execution` un `create or replace` avec un
-- paramètre de plus ne remplace RIEN : il crée une SURCHARGE. L'ancienne signature à cinq arguments
-- resterait appelable — c'est-à-dire que le contournement de la garde qu'on vient d'écrire resterait
-- publié sur PostgREST, à côté d'elle.
drop function if exists public.reclamer_execution(text, text, uuid, integer);
drop function if exists public.clore_execution(text, text, uuid, boolean, text);

-- ── LA RÉCLAMATION : atomique, avec bail, et désormais NOMINATIVE ────────────────────────────────────
-- Renvoie le JETON si l'appelant a le droit d'exécuter, `null` si quelqu'un d'autre l'a déjà fait (ou le
-- fait en ce moment). Le contrat d'usage ne change pas d'un iota : c'est toujours un seul aller-retour,
-- une seule décision, un seul endroit.
create or replace function public.reclamer_execution(
  p_job           text,
  p_fenetre       text,
  p_cible_id      uuid,
  p_bail_secondes integer
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jeton uuid;
begin
  insert into public.execution_job (job, fenetre, cible_id, statut, bail_expire_le, jeton)
  values (p_job, p_fenetre, p_cible_id, 'en_cours',
          now() + make_interval(secs => p_bail_secondes), gen_random_uuid())
  on conflict (job, fenetre, cible_id) do update
    set statut         = 'en_cours',
        tentatives     = public.execution_job.tentatives + 1,
        bail_expire_le = now() + make_interval(secs => p_bail_secondes),
        commence_le    = now(),
        termine_le     = null,
        motif_echec    = null,
        -- LE JETON SE REFRAPPE À CHAQUE PRISE DE MAIN. Le reconduire rendrait la colonne décorative :
        -- l'exécution gelée reviendrait avec le bon jeton et clôturerait le travail de sa remplaçante.
        jeton          = gen_random_uuid()
    -- Les DEUX seuls cas où l'on reprend la main : l'exécution précédente a échoué, ou elle est morte en
    -- cours de route (bail expiré). Le cas `reussi` n'apparaît pas — c'est l'idempotence.
    where public.execution_job.statut = 'echoue'
       or (public.execution_job.statut = 'en_cours' and public.execution_job.bail_expire_le < now())
  returning jeton into v_jeton;

  -- `returning … into` laisse NULL quand le `where` du DO UPDATE exclut la ligne : zéro ligne affectée.
  -- `null` EST le refus — il n'y a rien à `coalesce`, et c'est la forme la plus sûre : un appelant qui
  -- oublierait de tester ne recevrait pas un jeton utilisable par accident.
  return v_jeton;
end;
$$;

revoke execute on function public.reclamer_execution(text, text, uuid, integer) from public, anon, authenticated;

-- ── LA CLÔTURE : elle RÉPOND, maintenant ────────────────────────────────────────────────────────────
-- `void` était le bon type tant que la clôture ne pouvait pas être refusée. Elle peut l'être : rendre un
-- booléen est ce qui permet à l'appelant de DIRE qu'il n'a rien clos.
--
-- C'est la même leçon que le chemin `deja_fait` de la 6.1 : une absence d'effet qu'on ne peut pas montrer
-- ne vaut pas mieux qu'un travail non fait. Sur un rejeu de purge (6.8), « la clôture a été refusée parce
-- qu'un autre détenait la fenêtre » est précisément la phrase à pouvoir produire.
create or replace function public.clore_execution(
  p_job      text,
  p_fenetre  text,
  p_cible_id uuid,
  p_reussi   boolean,
  p_motif    text,
  p_jeton    uuid
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clos boolean;
begin
  update public.execution_job
     set statut      = case when p_reussi then 'reussi' else 'echoue' end,
         termine_le  = now(),
         -- RECONNU, plus tronqué. `left(…, 120)` gardait les 120 premiers caractères d'un message
         -- quelconque — donc gardait le début d'un verbatim. On ne conserve désormais que ce qu'on
         -- sait nommer ; `motif_inconnu` (l'appelant n'a rien donné) et `erreur_non_identifiee` (il a
         -- donné quelque chose qu'on ne reconnaît pas) sont deux diagnostics différents, et les
         -- distinguer coûte un mot.
         motif_echec = case when p_reussi then null
                            else coalesce(public.code_reconnu(p_motif, 120), 'motif_inconnu') end
   where job = p_job
     and fenetre = p_fenetre
     and cible_id is not distinct from p_cible_id  -- `is not distinct from` : `null = null` vaut vrai ici
     -- T6-19 (0035) : SEULE une exécution en cours se clôt. Une clôture qui arrive après coup ne fait
     -- plus rien — et « ne fait rien » est exactement ce qu'on veut d'elle, la fenêtre ayant son verdict.
     and statut = 'en_cours'
     -- T6-19 (0052) : et seulement par CELUI QUI LA DÉTIENT.
     --
     -- ⚠️ `=` ET SURTOUT PAS `is not distinct from`. Sur `cible_id`, `is not distinct from` est
     -- indispensable parce que `null` y est une VALEUR MÉTIER (« job global »). Sur le jeton, `null` ne
     -- serait qu'une ignorance — et `is not distinct from` la ferait s'accorder avec elle-même : un
     -- appelant sans jeton clôturerait toute ligne sans jeton. `=` échoue fermé, ce qui est la règle du
     -- dépôt : dans le doute, NE PAS agir. (La colonne est `not null`, donc ce cas ne peut naître que
     -- d'un futur relâchement — c'est justement contre lui qu'on écrit.)
     and jeton = p_jeton
  returning true into v_clos;

  return coalesce(v_clos, false);
end;
$$;

revoke execute on function public.clore_execution(text, text, uuid, boolean, text, uuid) from public, anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 3. LES CONTRAINTES DE FORME — la défense qui survit à un appelant distrait
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- Les deux fonctions ci-dessus reconnaissent. Les deux contraintes ci-dessous ferment le chemin qui ne
-- passe PAS par elles : `service_role` détient tous les privilèges DML sur ces tables, et le moteur de
-- rétention de l'Epic 6 écrira sous `service_role`. Un `insert into execution_job` direct — par commodité,
-- une fois — est exactement la façon dont un verbatim finit dans une table système.
--
-- ⚠️ ORDRE OBLIGATOIRE : on NORMALISE d'abord, on contraint ensuite. Un `CHECK` qui rejette une valeur
-- déjà écrite fait échouer la migration sur la base de production — et le premier endroit où l'on s'en
-- apercevrait serait le déploiement.
update public.execution_job
   set motif_echec = public.code_reconnu(motif_echec, 120)
 where motif_echec is not null
   and motif_echec !~ '^[a-z0-9]+(_[a-z0-9]+)+$'
   and motif_echec !~ '^[a-z_]+: [A-Z0-9]+$';

update public.incident_systeme
   set detail = public.code_reconnu(detail, 200)
 where detail is not null
   and detail !~ '^[a-z0-9]+(_[a-z0-9]+)+$'
   and detail !~ '^[a-z_]+: [A-Z0-9]+$';

-- Les contraintes de LONGUEUR de 0027 restent : elles ne font pas double emploi avec celles de forme.
-- La forme n'exprime aucune borne (un code interne peut faire mille caractères) ; la longueur n'exprime
-- aucun vocabulaire (« Sophie va mal » tient en treize caractères). Chacune tue une classe distincte.
alter table public.execution_job
  add constraint execution_job_motif_forme check (
    motif_echec is null
    or motif_echec ~ '^[a-z0-9]+(_[a-z0-9]+)+$'
    or motif_echec ~ '^[a-z_]+: [A-Z0-9]+$'
  );

alter table public.incident_systeme
  add constraint incident_systeme_detail_forme check (
    detail is null
    or detail ~ '^[a-z0-9]+(_[a-z0-9]+)+$'
    or detail ~ '^[a-z_]+: [A-Z0-9]+$'
  );


-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 4. L'ALARME QUI PEUT S'ÉTEINDRE, ET L'HOMME MORT ALIGNÉ
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- ── 4a. LE PRÉDICAT SE RECALCULE, L'INCIDENT NE PORTE PAS D'ÉTAT (décision D1) ───────────────────────
--
-- `lever_incident` fait `on conflict do nothing` et aucune migration n'a jamais supprimé de ligne
-- d'`incident_systeme`. La sonde publique dégrade sur `jour >= today - 1` : une fois l'alarme levée,
-- elle sonne DEUX JOURS PLEINS, quoi qu'il arrive ensuite.
--
-- Aggravant, et c'est ce qui rend le défaut structurel plutôt qu'anecdotique : le job de santé est le
-- PREMIER du registre et à fenêtre quotidienne. Son verdict est rendu une fois par jour, au premier tick,
-- AVANT que les autres jobs de la journée n'aient tourné. Un moteur de rétention réparé à 6 h 05
-- laisserait donc la sonde en `degrade` jusqu'au surlendemain — et pendant tout ce temps, `/api/health`
-- dirait « quelque chose ne tourne plus » sans qu'on puisse distinguer la panne réparée de la suivante.
-- Une alarme qui ne peut pas s'éteindre finit par n'être plus lue.
--
-- DEUX FORMES ÉTAIENT POSSIBLES : ajouter `resolu_le` à `incident_systeme`, ou recalculer le verdict
-- depuis `execution_job`. On recalcule. Un état de résolution est un état à maintenir, donc un état
-- qu'on laissera périmé — et il faudrait décider qui l'écrit, et quand. Le recalcul n'a rien à
-- maintenir : la vérité est déjà dans `execution_job`.
--
-- LA RÈGLE, en une phrase : **une alarme s'éteint par une réussite POSTÉRIEURE à elle.** Elle ne demande
-- aucune tolérance, aucun seuil, aucune valeur recopiée depuis le registre TypeScript — juste un ordre
-- entre deux horodatages. Si le job repart en retard demain, un nouvel incident du jour sera levé (la
-- dédup est quotidienne) et sonnera de nouveau, cette fois postérieurement à la réussite.
--
-- ── 4b. L'HOMME MORT PASSE DE 48 h À 60 h (décision D2) ──────────────────────────────────────────────
--
-- Deux chiffres pour une seule décision, et ils ne se parlaient pas. Le registre a choisi 60 h
-- PRÉCISÉMENT pour ne jamais tomber pile sur un multiple de la cadence (`registre.ts:109-114`, défaut
-- n°9 de la revue 4.8) ; la SQL gardait 48 h en dur, c'est-à-dire EXACTEMENT deux fois la cadence
-- quotidienne. Un seul tick manqué plus quelques minutes de dérive suffisait à faire hurler l'homme
-- mort — et sur le palier `hobby`, la dérive annoncée est de ±59 min. La même panne alertait ou non
-- selon l'horaire.
--
-- 60 h place le seuil au MILIEU de l'intervalle [48 h, 72 h] : deux ticks manqués alertent toujours, un
-- seul jamais. Une garde d'architecture (`tests/ordonnanceur-architecture.test.ts`) lit désormais cette
-- valeur DANS CETTE DÉFINITION — jamais recopiée en TypeScript — et vérifie
-- `2 × intervalle du cron + dérive du palier ≤ fenêtre`.
create or replace function public.sante_ordonnanceur_publique()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
           select 1
             from public.incident_systeme i
            where i.jour >= ((now() at time zone 'Europe/Paris')::date - 1)
              -- `job_echoue` ne dégrade pas (0031) : un travail qui rate n'est pas un ordonnanceur qui
              -- va mal. Seul `job_en_retard` dit « un travail ne se fait PLUS ».
              and i.type = 'job_en_retard'
              -- … et il ne le dit plus dès que le job en question repasse. `cible_id is null` : LE JOB,
              -- pas une de ses personnes (0031, §1) — sans quoi une seule personne servie éteindrait
              -- l'alarme d'un fan-out mort.
              and not exists (select 1
                                from public.execution_job e
                               where e.job = i.job
                                 and e.cible_id is null
                                 and e.statut = 'reussi'
                                 and e.termine_le > i.cree_le))
      -- L'HOMME MORT. Le nom est celui du job de santé du registre — une garde d'architecture interdit
      -- de le renommer ou de le passer hebdomadaire sans casser le build, faute de quoi ce prédicat
      -- deviendrait faux en silence. Il n'a délibérément PAS de boucle de fermeture : il ne parle pas
      -- d'un job en panne, il parle de l'ordonnanceur qui ne tourne plus — et dans ce monde-là, il n'y a
      -- personne pour écrire la réussite qui l'éteindrait. C'est sa réussite À LUI qui l'éteint.
      or not exists (select 1 from public.execution_job
                      where job = 'sante-ordonnanceur'
                        and cible_id is null
                        and statut = 'reussi'
                        and termine_le > now() - interval '60 hours')
    then 'degrade' else 'ok' end;
$$;

revoke execute on function public.sante_ordonnanceur_publique() from public, anon, authenticated;

comment on function public.sante_ordonnanceur_publique() is
  'Story 6.1a : UN MOT pour `/api/health` (route publique). `degrade` si un `job_en_retard` du jour ou de la veille n''a pas été suivi d''une réussite globale du même job, OU si le job de santé lui-même n''a rien réussi depuis 60 h (homme mort, aligné sur `toleranceHeures` du registre).';

-- ── 4c. `lever_incident` passe par le vocabulaire fermé ──────────────────────────────────────────────
-- `left(coalesce(p_detail, ''), 200)` écrivait une CHAÎNE VIDE quand l'appelant ne donnait rien : une
-- valeur qui ne veut rien dire, qu'il aurait fallu tolérer dans la contrainte de forme — donc un trou
-- d'exactement un mot dans la garde qu'on vient de poser. `null` dit la même chose sans ouvrir de trou.
create or replace function public.lever_incident(
  p_type   text,
  p_job    text,
  p_detail text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.incident_systeme (type, job, detail)
  values (p_type, p_job, public.code_reconnu(p_detail, 200))
  on conflict (type, job, jour) do nothing;
end;
$$;

revoke execute on function public.lever_incident(text, text, text) from public, anon, authenticated;

comment on table public.execution_job is
  'Story 4.8 (AC2/AC5), étendue en 6.1a. Idempotence par (job, fenetre, cible_id) — une ligne `reussi` n''est jamais re-réclamable — et clôture réservée au détenteur du `jeton` courant. Deny-by-default : service_role uniquement. NON-art. 9 : aucune colonne de contenu ; `motif_echec` borné en longueur ET en forme (vocabulaire fermé). `cible_id` en cascade pour FR-067.';
