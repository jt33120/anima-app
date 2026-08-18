-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 0065 — CORRIGER VEUT DIRE RETENIR (revue Epic 6, R1 · RGPD art. 16)
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- ⚠️ LE NUMÉRO A BOUGÉ DEUX FOIS pendant que cette migration attendait. La revue Epic 6 annonçait
-- « la prochaine libre est 0062 » ; 0062 (arrêt des courriels) puis 0063 (hypothèse gardée à la
-- parole) et 0064 (empreinte du jeu) sont entrées depuis. Celle-ci est donc la 0065. Renuméroter à
-- la volée est le geste qui fabrique deux migrations du même numéro dans deux branches : on le fait
-- une fois, au moment de poser, jamais en cours de rédaction.
--
-- ── LE DÉFAUT, REPRODUIT CONTRE LE POSTGRES LOCAL LE 2026-08-17 ────────────────────────────────
--
--   AVANT  : charger_faits_actifs()            → « elle aime la montagne »
--   GESTE  : fusionner_fait_extrait('utilisatrice','corrige','k','elle deteste la montagne',null)
--            — c'est-à-dire, littéralement, le bouton « Enregistrer » de l'écran /memoire
--   APRÈS  : charger_faits_actifs()            → 0 ligne
--            charger_faits_retenus(200)        → « elle deteste la montagne » [corrige]
--            materiau_synthese(...)->'faits'   → []
--
-- Elle ouvre « Ce qu'Anam retient », lit « Voici ce qu'Anam a retenu de vos échanges », trouve une
-- phrase fausse, la réécrit. L'écran lui montre sa phrase — deux fois, dont une re-servie par le
-- serveur. Anam ne la verra jamais, et a perdu au passage l'originale, que l'UPDATE écrase sur place
-- (0018:149). Corriger = supprimer en silence, sous un écran qui affirme le contraire.
--
-- ── CE QUE CETTE MIGRATION CHOISIT DE NE PAS FAIRE ─────────────────────────────────────────────
--
-- Elle ne touche AUCUN chemin d'écriture de contenu : ni la règle 4.2, ni la clause (1) du trigger
-- anti-résurrection, ni la clause WHERE de l'upsert auto, ni la valeur `statut` qu'une correction
-- pose. R1 n'est pas une écriture fautive — c'est DEUX LECTURES qui ne s'accordent pas sur le sens
-- de « corrigé ». On répare les lectures, et on ferme au niveau TABLE ce qui, sinon, ne serait gardé
-- que par un corps de fonction.
--
-- ⚠️ POURQUOI PAS « ON SUPPRIME LA VALEUR `corrige` » (statut binaire). C'était l'option la plus
-- séduisante : sur deux valeurs, `statut = 'actif'` et `statut <> 'supprime'` dénotent le même
-- ensemble par arithmétique, et deux lectures ne peuvent plus diverger. Elle a été écartée pour une
-- raison de produit, pas de base : la mention D6 de l'écran — « Tu as réécrit cette phrase. » — ne
-- repose QUE sur `statut = 'corrige'` (app/memoire/page.tsx). Effacer la valeur oblige à faire
-- descendre `origine` par la RPC de l'écran et à rebrancher le rendu, sous peine de faire mourir en
-- silence la seule marque de rectification visible — ce que l'énoncé de la 6.5 interdit
-- explicitement (« une correction étant une donnée et non une erreur à masquer »). Le §2 ci-dessous
-- obtient la même garantie sans rien détruire : il rend `corrige ⟹ origine = 'utilisatrice'` VRAI
-- PAR CONTRAINTE DE TABLE, donc la mention D6 devient vraie par construction au lieu de l'être par
-- convention.
--
-- ⚠️ POURQUOI PAS UNE COLONNE DE RETRAIT SÉPARÉE. Donner au retrait son propre axe est un beau
-- dessin, et c'est un GESTE DE PRODUIT NEUF (un troisième bouton, trois chaînes de copie, une RPC de
-- plus dans une table art. 9) là où R1 demande une réparation. Le geste manquant, s'il manque un
-- jour, se posera sur cette base sans rien reprendre d'ici.
--
-- ── CE QUI GARDE ENCORE L'EFFACEMENT, ET CE N'EST PLUS LE FILTRE ───────────────────────────────
--
-- Élargir une lecture sur une table art. 9 se justifie plutôt qu'il ne s'affirme. Ce qui protège une
-- SUPPRESSION n'est pas le filtre de statut : c'est `fait_extrait_tombstone_est_vide` (0056),
-- `(statut = 'supprime') = (contenu = '')`, une contrainte de TABLE opposable à service_role. Un
-- fait supprimé n'a plus de contenu à rappeler — il n'en existe plus nulle part. Même une lecture
-- qui oublierait le filtre ne pourrait rappeler que la chaîne vide.
--
-- Et ce qu'un fait corrigé rapporte au rappel, ce sont SES mots à elle — jamais ceux de la machine,
-- que l'UPDATE de 0018:149 a détruits sur place. AD-18 promet que ce qu'elle a RETIRÉ ne revient
-- pas ; rien ne revient.
-- ════════════════════════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- §1 — NORMALISER LES LIGNES QU'AUCUN GESTE NE PRODUIT, AVANT DE CONTRAINDRE
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- `origine = 'extrait'` avec un statut autre qu'`actif` : le dépôt ne le fabrique pas (la branche
-- utilisatrice tamponne toujours `origine`), mais rien ne l'interdit — MESURÉ le 2026-08-17 sous le
-- JWT de la propriétaire, un `update fait_extrait set statut = 'corrige'` sur une ligne
-- (extrait, actif) est ACCEPTÉ : le trigger ne se déclenche que sur `new.origine = 'extrait'` visant
-- une ligne qui n'est pas (extrait, actif), et c'en est une — c'est le « rafraîchissement légitime ».
--
-- On rend ces lignes à l'utilisatrice, jamais l'inverse : tout AD-18 est claveté sur `origine`, donc
-- c'est la direction qui PROTÈGE. (`UPDATE 0` attendu sur une base saine ; le `where` est là pour la
-- base qui ne l'est pas.) Le trigger tourne sur cet UPDATE et reste muet : clause (1) exige
-- `new.origine = 'extrait'`, clause (2) exige un `contenu` changé.
update public.fait_extrait
   set origine = 'utilisatrice'
 where origine = 'extrait' and statut <> 'actif';


-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- §2 — CE QUE LA MACHINE POSSÈDE EST VIVANT (la moitié ENFORÇABLE de la règle 4.2)
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- ⚠️ CETTE CONTRAINTE EST LE CŒUR DU CORRECTIF, PAS SON ORNEMENT. À partir du §3, un fait `corrige`
-- entre dans ce qu'Anam se rappelle. Sans elle, une ligne (extrait, corrige) — fabricable
-- aujourd'hui par un simple PATCH REST, mesuré — entrerait dans un prompt de modèle SOUS L'ÉTIQUETTE
-- « Tu as réécrit cette phrase. », c'est-à-dire une phrase de machine présentée à quelqu'un comme
-- étant de sa main. Avec elle, `statut <> 'actif' ⟹ origine = 'utilisatrice'` : réécrire et effacer
-- sont des gestes d'ELLE, par contrainte, et la mention D6 de l'écran devient vraie PAR
-- CONSTRUCTION plutôt que par convention.
--
-- Elle est aussi la moitié de la règle 4.2 qui, elle, GARDE quelque chose. « Le chemin utilisatrice
-- ne pose que corrige/supprime » ne vit que dans le corps de `fusionner_fait_extrait` : aucune
-- policy, aucun trigger, aucun CHECK ne la reprend, et aucun `revoke` n'a jamais retiré l'UPDATE de
-- table à `authenticated` (0041 n'a durci que `utilisatrice`, `consentement`, `theme_natal`, en
-- écrivant noir sur blanc qu'il laissait les 24 autres). Le dépôt le prouve lui-même :
-- `tests/fait-extrait.test.ts:193` fait un PATCH direct sous JWT et attend `error === null`. Une
-- règle qui ne vit que dans une fonction ne garde rien (leçon 0041/0042/0047) — celle-ci vit dans la
-- table, donc elle est opposable à service_role, au PATCH REST, et à toute RPC écrite demain.
--
-- ET ELLE RESSERRE AD-18 SANS AJOUTER UN SEUL TRIGGER. Combinée à la clause (1) existante
-- (`new.origine = 'extrait' and not (old.origine = 'extrait' and old.statut = 'actif')`), elle rend
-- `origine` MONOTONE : puisque `old.origine = 'extrait'` implique désormais `old.statut = 'actif'`,
-- la clause (1) se réduit exactement à « une ligne possédée ne redevient jamais une ligne de
-- machine ». L'invariant que l'on aurait dû écrire dans une clause de trigger supplémentaire est
-- déjà là, gratuitement.
alter table public.fait_extrait
  add constraint fait_extrait_machine_reste_vivante
  check (origine = 'utilisatrice' or statut = 'actif');

comment on constraint fait_extrait_machine_reste_vivante on public.fait_extrait is
  'Revue Epic 6 (R1) : une ligne possedee par l''extraction est toujours `actif`. Reecrire ou effacer sont des gestes de l''UTILISATRICE, et ils tamponnent `origine`. Trois consequences. (1) La moitie ENFORCABLE de la regle 4.2, qui ne vivait que dans le corps de `fusionner_fait_extrait` alors qu''`authenticated` detient l''UPDATE de table. (2) `statut = ''corrige'' ⟹ origine = ''utilisatrice''` : la mention D6 de l''ecran (« Tu as reecrit cette phrase ») devient vraie par CONSTRUCTION — indispensable depuis que 0065 fait entrer un fait corrige dans les prompts. (3) `old.origine = ''extrait''` implique `old.statut = ''actif''`, donc la clause (1) du trigger anti-resurrection se reduit a « une ligne possedee ne redevient jamais une ligne de machine » : `origine` est monotone, sans clause de trigger supplementaire.';


-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- §3 — UNE SEULE DÉFINITION DE « VIVANT »
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- R1 n'est pas né d'une faute : il est né de DEUX DÉFINITIONS de « vivant » écrites à deux epics
-- d'écart, chacune juste dans son fichier. Recopier `statut <> 'supprime'` en trois endroits
-- reconstruit exactement la condition qui a produit le défaut — la quatrième lecture divergera. Il
-- n'y a donc plus qu'UNE définition, et les trois lectures la CITENT :
--
--   • `charger_faits_rappelables()` — ce qu'Anam se rappelle en conversation (4.3)
--   • `charger_faits_retenus(int)`  — ce que l'écran /memoire affiche (6.5)
--   • `materiau_synthese(...)`      — ce que la synthèse périodique reçoit (4.9) ← LE SEUL VIVANT
--
-- ⚠️ CE N'EST PAS UNE GARDE, et il ne faut pas la vendre comme telle : `authenticated` conserve
-- SELECT sur la table. Elle achète de la cohérence, pas de la sécurité. Ce qui garde est au §2, au
-- §7, et dans les contraintes de 0056.
--
-- ⚠️ CORPS `begin atomic` (PostgreSQL 14+), et c'est délibéré. Deux propriétés à la fois, qu'un
-- corps `$$ … $$` ne donne pas ensemble : (a) les objets du corps sont résolus À LA CRÉATION et
-- enregistrés comme dépendances — le `search_path` de l'appelant ne peut rien détourner, donc pas
-- besoin d'un `set search_path` ; (b) la fonction reste INLINABLE par le planificateur, ce qu'un
-- `set` interdirait (`pg_proc.proconfig` non nul), et l'index `fait_extrait_utilisatrice_idx
-- (utilisatrice_id, statut)` reste utilisable. MESURÉ : `explain` rend bien
-- `Filter: (statut <> 'supprime'::text)` — l'inlining a lieu.
create function public.fait_est_vivant(p_statut text)
returns boolean
language sql
immutable
parallel safe
returns null on null input
begin atomic
  select p_statut <> 'supprime';
end;

revoke execute on function public.fait_est_vivant(text) from public, anon;
grant  execute on function public.fait_est_vivant(text) to authenticated;

comment on function public.fait_est_vivant(text) is
  'Revue Epic 6 (R1) : la SEULE definition de « ce fait est vivant » — statut <> ''supprime''. Les trois lectures de fait_extrait (charger_faits_rappelables, charger_faits_retenus, materiau_synthese) la citent au lieu de la recopier : R1 est ne de deux definitions ecrites a deux epics d''ecart, et la troisieme lecture existait deja. Ce n''est PAS la garde de l''effacement — celle-la est fait_extrait_tombstone_est_vide (0056), une contrainte de table : un fait supprime n''a plus de contenu, donc meme une lecture qui oublierait le filtre ne pourrait rappeler que la chaine vide.';


-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- §4 — LE RAPPEL : `charger_faits_actifs` → `charger_faits_rappelables`
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- ⚠️ LE NOM CHANGE PARCE QUE LE NOM EST LA MOITIÉ DU DÉFAUT. « charger_faits_actifs » ÉNONCE le
-- filtre `statut = 'actif'`. Le garder tout en rappelant les corrigés, ce serait réécrire R1 dans le
-- dictionnaire au lieu de le corriger, et poser sous le nez du prochain lecteur exactement le piège
-- qui a coûté deux epics. Le renommage est gratuit AUJOURD'HUI et ne le sera plus : `creerDepotRappel`
-- n'a aucun appelant de production (la 4.4 branchera le rappel plus tard), donc aucune fenêtre de
-- déploiement ne peut voir un client appeler l'ancien nom. La garde d'architecture
-- (`faits-architecture.test.ts`) tient : son contrôle POSITIF rougit si l'on renomme sans la mettre
-- à jour — elle ne peut pas devenir vide en silence.
--
-- ⚠️ `statut` DESCEND MAINTENANT, et ce n'est pas cosmétique. `depot-rappel.ts` tamponnait
-- `statut: "actif"` sur chaque ligne parce que la colonne n'était pas renvoyée : le filtre « second
-- niveau » d'`assemblerRappel` était donc INATTEIGNABLE en production — deux gardes qui se
-- couvraient l'une l'autre, et aucune ne tuait son mutant. La colonne descend pour que le domaine
-- puisse à nouveau mordre sur ce qu'il prétend filtrer.
drop function if exists public.charger_faits_actifs();

create function public.charger_faits_rappelables()
returns table (cle_dedoublonnage text, contenu text, statut text, cree_le timestamptz, maj_le timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select f.cle_dedoublonnage, f.contenu, f.statut, f.cree_le, f.maj_le
  from public.fait_extrait f
  where f.utilisatrice_id = (select auth.uid())   -- explicite (la RLS le fait déjà sous invoker — défense en profondeur)
    and public.fait_est_vivant(f.statut)
  -- Ordre TOTAL (revue 4.3, B) : `cle_dedoublonnage` départage les `cree_le` égaux.
  -- ⚠️ L'ORDRE RESTE SUR `cree_le`, PAS `maj_le` — à la différence de l'écran (0056). L'écran montre
  -- « ce qui vient d'être touché » ; le rappel raconte une chronologie de vie. Une phrase réécrite
  -- hier n'est pas devenue le fait le plus récent d'une existence.
  order by f.cree_le desc, f.cle_dedoublonnage asc;
$$;

revoke execute on function public.charger_faits_rappelables() from public, anon;
grant  execute on function public.charger_faits_rappelables() to authenticated;

comment on function public.charger_faits_rappelables() is
  'Story 4.3 (AC3, AD-18), corrigee par la revue Epic 6 (R1) : lecture POSSEDEE de ce qu''Anam peut se rappeler (security invoker → la RLS de fait_extrait mord). Remplace charger_faits_actifs, dont le NOM enoncait le defaut : un fait CORRIGE est un fait retenu (art. 16), pas une pierre tombale — l''ecran le montrait deja comme retenu, et Anam ne le voyait jamais. Meme predicat que charger_faits_retenus et materiau_synthese : public.fait_est_vivant, cite et non recopie. Rend `statut`, pour que le filtre du domaine (assemblerRappel) redevienne ATTEIGNABLE — il ne l''etait plus depuis que le depot tamponnait la valeur. Ordre par cree_le (chronologie), la ou l''ecran trie par maj_le (recence du geste).';


-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- §5 — L'ÉCRAN : même prédicat, comportement inchangé, promesse enfin tenue
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- Rien ne change pour /memoire : `statut <> 'supprime'` et `fait_est_vivant(statut)` rendent le même
-- ensemble, aujourd'hui et après. Ce qui change est qu'il n'y a plus deux phrases à garder d'accord —
-- il y en a une. `statut` continue de descendre : c'est lui, et lui seul, qui porte la mention D6
-- « Tu as réécrit cette phrase. », et le §2 vient de la rendre vraie par contrainte de table.
--
-- Le titre de la halte est au présent — « Ce qu'Anam retient » — et l'introduction promet « Voici ce
-- qu'Anam a retenu de vos échanges […] Tu peux corriger ou supprimer chaque ligne ». Aucune des
-- quinze chaînes de l'écran n'a été touchée par cette migration, et toutes deviennent vraies.
create or replace function public.charger_faits_retenus(p_max integer)
returns table (
  cle          text,
  contenu      text,
  statut       text,
  jour         date,
  source_texte text,
  source_jour  date
)
language sql
stable
security invoker
set search_path = ''
as $$
  select f.cle_dedoublonnage, f.contenu, f.statut, f.maj_le::date, j.contenu, j.cree_le::date
    from public.fait_extrait f
    -- `left join` : un extrait source disparu (le journal a pu être effacé) ne doit pas faire
    -- disparaître le fait — sinon un effacement partiel rendrait invisible ce qui reste à corriger.
    left join public.entree_journal j on j.id = f.extrait_source_id
   where public.fait_est_vivant(f.statut)
   order by f.maj_le desc
   limit greatest(p_max, 0);
$$;

comment on function public.charger_faits_retenus(integer) is
  'Story 6.5 (AC1), amendee par la revue Epic 6 (R1) : les faits VIVANTS de l''appelante, avec leur date et leur extrait source. security invoker — la RLS de fait_extrait (0018) et celle d''entree_journal (0016) mordent, jointure comprise. Le predicat de vie est public.fait_est_vivant, PARTAGE avec charger_faits_rappelables et materiau_synthese : c''est la divergence entre ces lectures qui etait R1. Rend `statut` : `corrige` porte la mention D6, et depuis fait_extrait_machine_reste_vivante il implique origine = utilisatrice, donc la mention ne peut plus mentir.';


-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- §6 — LA SYNTHÈSE : le seul chemin par lequel R1 est VÉCU aujourd'hui
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- ⚠️ CE BLOC N'EST PAS OPTIONNEL. Le job `synthese` est au registre de l'ordonnanceur et en service
-- depuis le 2026-08-05 ; le rappel de conversation (4.3), lui, est livré mais INERTE. Ne réparer que
-- le rappel serait réparer ce que personne ne subit et laisser intact ce que tout le monde subit.
--
-- Le corps est celui de 0035 (T6-17), recopié sans un mot de changé SAUF le prédicat des faits.
-- Postgres ne sait pas rapiécer un corps de fonction ; forward-only veut dire réécrire en entier, et
-- c'est mieux ainsi — la définition courante se lit d'un bloc au dernier fichier qui la porte.
--
-- ⚠️ ET LA CONSIGNE ENVOYÉE AU MODÈLE DEVIENT FAUSSE. `lib/domain/consigne-synthese.ts` écrit
-- l'en-tête « CE QU'ANAM RETIENT (faits actifs, déjà validés) » : « actifs » cesse d'être vrai, le
-- matériau contient désormais ce qu'elle a réécrit. Cette chaîne DOIT partir dans le même commit,
-- sinon on répare la mémoire en installant un mensonge dans la consigne.
create or replace function public.materiau_synthese(
  p_utilisatrice     uuid,
  p_plafond_entrees  integer,
  p_plafond_octets   integer
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_depuis   timestamptz;
  v_instant  timestamptz := now();
  v_total    integer;
  v_tronquee boolean;
  v_borne    timestamptz;
  v_entrees  jsonb;
  v_faits    jsonb;
begin
  if not public.eligible_a_synthese(p_utilisatrice) then
    return jsonb_build_object('depuis', null, 'jusqu_a', v_instant, 'total', 0,
                              'tronquee', false, 'entrees', '[]'::jsonb, 'faits', '[]'::jsonb);
  end if;

  select max(s.periode_fin) into v_depuis
    from public.synthese s where s.utilisatrice_id = p_utilisatrice;

  with elig as (
    select e.id, e.contenu, e.cree_le,
           -- ORDRE TOTAL. `cree_le` seul ne départage pas les ex æquo, et ici ce n'est plus cosmétique :
           -- le filigrane est un `cree_le`, donc une coupe au milieu d'un horodatage perdrait les frères
           -- pour toujours (l'intervalle suivant est STRICTEMENT supérieur).
           row_number() over (order by e.cree_le, e.id) as rang,
           sum(length(e.contenu)) over (order by e.cree_le, e.id
                 rows between unbounded preceding and current row) as octets
      from public.entrees_hors_detresse(p_utilisatrice, v_depuis, v_instant) e
     -- Seulement CE QU'ELLE A ÉCRIT. Le jour où l'Epic 6 écrira les tours d'Anam, ce filtre devra être
     -- rouvert AVEC un chemin qui distingue structurellement les deux voix — pas par concaténation.
     where e.role = 'utilisatrice'
  ),
  gardees as (
    select e.* from elig e
     -- `rang = 1` d'abord : une entrée seule plus grosse que le plafond d'octets doit quand même passer,
     -- sinon la tranche est vide, le filigrane n'avance pas, et cette personne est bloquée pour toujours.
     where e.rang = 1
        or (e.rang <= p_plafond_entrees and e.octets <= p_plafond_octets)
  ),
  borne as (
    select max(g.cree_le) as fin from gardees g
  ),
  -- Le groupe d'ex æquo à la borne entre EN ENTIER. Combiné à l'ordre total ci-dessus, c'est ce qui
  -- garantit qu'aucune entrée ne tombe entre deux tranches.
  finales as (
    select e.* from elig e, borne b where b.fin is not null and e.cree_le <= b.fin
  )
  select (select count(*) from elig),
         (select count(*) from elig) > (select count(*) from finales),
         (select b.fin from borne b),
         coalesce((select jsonb_agg(jsonb_build_object(
                            'role',    'utilisatrice',
                            'contenu', left(f.contenu, p_plafond_octets),
                            'cree_le', f.cree_le)
                          order by f.cree_le, f.id)
                     from finales f), '[]'::jsonb)
    into v_total, v_tronquee, v_borne, v_entrees;

  -- ⚠️ REVUE EPIC 6 (R1). Ce filtre disait `statut = 'actif'` SEUL, avec pour raison « AD-18 : un
  -- tombstone occupe la clé et son contenu a été vidé ». La raison était juste, la conclusion trop
  -- large : elle traitait `corrige` comme un tombstone. Un tombstone est VIDE (contrainte 0056) ; un
  -- fait corrigé porte les mots qu'ELLE a choisis, et c'est exactement ce qu'une synthèse doit lire.
  -- AD-18 est préservé côté ÉCRITURE, par `origine` — jamais par ce `where`.
  select coalesce(jsonb_agg(f.contenu order by f.maj_le, f.cle_dedoublonnage), '[]'::jsonb)
    into v_faits
    from (select f2.contenu, f2.maj_le, f2.cle_dedoublonnage
            from public.fait_extrait f2
           where f2.utilisatrice_id = p_utilisatrice
             and public.fait_est_vivant(f2.statut)
           order by f2.maj_le desc, f2.cle_dedoublonnage
           limit 200) f;

  return jsonb_build_object(
    'depuis',   v_depuis,
    -- LE FILIGRANE (T6-17) : « jusqu'où cette tranche va », c'est-à-dire l'horodatage de la dernière
    -- entrée RÉELLEMENT LUE — tronquée ou non. Plus jamais l'horloge : elle avance plus vite que les
    -- commits, et tout ce qu'elle dépasse est perdu.
    'jusqu_a',  coalesce(v_borne, v_instant),
    'total',    coalesce(v_total, 0),
    'tronquee', coalesce(v_tronquee, false),
    'entrees',  coalesce(v_entrees, '[]'::jsonb),
    'faits',    coalesce(v_faits, '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.materiau_synthese(uuid, integer, integer) from public, anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- §7 — LA TABLE PERD SES PRIVILÈGES D'ÉCRITURE LARGES (patron 0041)
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- ⚠️ CE BLOC RÉPARE UNE RÉSURRECTION ENCORE OUVERTE, MESURÉE LE 2026-08-17, ET SANS RAPPORT AVEC LE
-- FILTRE. Sous le JWT de la propriétaire, en transaction annulée :
--
--     select fusionner_fait_extrait('utilisatrice','supprime','k','',null);   -- tombstone posé
--     update fait_extrait set cle_dedoublonnage = 'k-libere' where … ;        -- UPDATE 1  ← ACCEPTÉ
--     select fusionner_fait_extrait('extrait','actif','k','elle aime la montagne',null);
--     → DEUX lignes : (extrait, actif, 'k', « elle aime la montagne »)
--                   + (utilisatrice, supprime, 'k-libere', '')
--
-- Le tombstone n'a jamais été touché : on lui a retiré sa CLÉ. Or c'est la clé qui bloque, pas la
-- ligne — l'index unique (utilisatrice_id, cle_dedoublonnage) est ce qui force la ré-extraction à
-- tomber en `on conflict`. Libérée, elle insère du neuf, et `fait_extrait_naissance` (0046) laisse
-- passer : c'est une naissance parfaitement régulière. Le fait supprimé revient, contenu compris.
-- `fait_extrait_no_resurrection` est BEFORE UPDATE et ne voit rien.
--
-- Ce trou est antérieur à R1 et lui survivrait. Mais il devient inacceptable au moment précis où le
-- §2 fait reposer tout AD-18 sur `origine` : on ferme donc du seul endroit qui ferme quoi que ce
-- soit — le GRANT. Patron de 0041, appliqué pour la première fois hors des trois tables du seuil :
-- révoquer la TABLE, puis re-granter NOMMÉMENT les colonnes que l'application écrit vraiment. Un
-- revoke de colonne seul ne perce pas un grant de table (piège documenté par 0041 après mesure).
--
-- CE QUI SORT :
--   • `cle_dedoublonnage` — LE TROU ci-dessus. Aucun chemin applicatif ne réécrit cette colonne.
--   • `utilisatrice_id`   — donner ou voler une ligne art. 9 entre comptes.
--   • `cree_le`           — antidater une naissance (`fait_extrait_naissance` la tient à l'insertion).
--   • `id`                — repointer une clé étrangère.
--
-- CE QUI RESTE ÉCRIVABLE, et c'est exactement le nécessaire :
--   origine, statut, contenu, maj_le   → la branche utilisatrice de `fusionner_fait_extrait`
--   contenu, extrait_source_id, maj_le → le `do update` de la branche auto
--
-- ⚠️ CONSÉQUENCE À CONNAÎTRE, la même qu'en 0041 : toute colonne AJOUTÉE plus tard à `fait_extrait`
-- sera en lecture seule pour l'application tant qu'on ne l'aura pas nommée dans ce grant. C'est
-- voulu — le défaut sûr est « je ne peux pas écrire ».

-- `anon` ne franchit aucune policy (auth.uid() est nul), donc il n'obtient rien aujourd'hui. On le
-- révoque quand même : le jour où une policy est écrite `using (true)` par copie d'un gabarit, le
-- privilège absent est la deuxième serrure. (0018 avait laissé `fait_extrait_lecture` et
-- `fait_extrait_maj` sans clause `to`, donc sur le rôle PUBLIC — asymétrie jamais harmonisée.)
revoke all on public.fait_extrait from anon;

-- Aucune policy `delete` n'existe sous JWT (0018, délibéré : le soft-delete est ce qui garde la clé
-- occupée). Le privilège, lui, était toujours là : un DELETE ne supprimait rien mais répondait 200.
-- Retiré, il répond une erreur — un refus qui se dit vaut mieux qu'un refus qui se devine.
revoke delete, truncate on public.fait_extrait from authenticated;

revoke update on public.fait_extrait from authenticated;
grant update (origine, statut, contenu, extrait_source_id, maj_le)
  on public.fait_extrait to authenticated;


-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- §8 — LES COMMENTAIRES QUI DÉCRIVAIENT L'ANCIEN SENS
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- Un commentaire faux est pire qu'un commentaire absent : celui de `lib/data/lire-memoire.ts` a
-- survécu six semaines en affirmant qu'`origine` descendait par la RPC de l'écran, ce qui n'a jamais
-- été vrai depuis 0056. Ceux-ci disaient qu'un `corrige` était une pierre tombale.
comment on table public.fait_extrait is
  'Faits extraits (AD-8, couche 2) : profil vivant de faits en clair (art. 9), possede sous JWT (jamais service_role applicatif), corrigeable/supprimable par l''utilisatrice. DEUX AXES, DEUX QUESTIONS (revue Epic 6, R1) : `origine` (extrait|utilisatrice) dit A QUI la ligne appartient — c''est lui, et lui seul, qui porte AD-18 ; `statut` (actif|corrige|supprime) dit ou elle en est, et une seule de ses valeurs la sort de la memoire d''Anam : `supprime`. Un fait CORRIGE est RETENU — c''est ce que l''ecran affirme depuis toujours, et depuis 0065 c''est vrai. Idempotent par (utilisatrice_id, cle_dedoublonnage). A l''epreuve des resurrections (AD-18) : soft-delete + trigger `fait_extrait_no_resurrection` + clause WHERE de `fusionner_fait_extrait` + contrainte `fait_extrait_machine_reste_vivante` + `cle_dedoublonnage` hors du grant UPDATE d''`authenticated`. Effacement FR-067 = service_role (Epic 6).';

comment on column public.fait_extrait.statut is
  'Revue Epic 6 (R1) : `actif` (extraite, jamais touchee), `corrige` (elle l''a reecrite, ou re-deposee apres une suppression annulee), `supprime` (tombstone, contenu vide par contrainte 0056). SEUL `supprime` sort de la memoire d''Anam : les trois lectures filtrent `public.fait_est_vivant(statut)`, la meme. `corrige` n''est PAS une pierre tombale — c''est le contraire, une phrase qu''elle a affirmee (art. 16), et elle implique `origine = utilisatrice` (contrainte `fait_extrait_machine_reste_vivante`).';

comment on column public.fait_extrait.origine is
  'Revue Epic 6 (R1) : la colonne qui porte AD-18, seule. ''utilisatrice'' = la phrase est d''elle (correction, restauration, saisie) → aucune re-extraction ne la touchera jamais (trigger, clause 1). MONOTONE de fait : `fait_extrait_machine_reste_vivante` garantit que toute ligne ''extrait'' est ''actif'', donc la clause (1) du trigger se reduit a « une ligne possedee ne redevient jamais une ligne de machine ».';

comment on column public.fait_extrait.cle_dedoublonnage is
  'Story 4.2 (AD-18) : cle de dedoublonnage STABLE et OPAQUE (jamais de contenu art. 9 en clair) — une info = une ligne. Le tombstone OCCUPE la cle → une re-extraction ne ressuscite pas. ⚠️ C''est la CLE qui bloque, pas la ligne : la renommer liberait la place et la re-extraction inserait du neuf, contenu supprime compris (mesure du 2026-08-17). Elle est donc hors du grant UPDATE d''`authenticated` depuis 0065.';
