-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 0073 — UNE SYNTHÈSE S'EFFACE AUSSI (revue des Epics 1 à 4, trouvaille #8 · RGPD art. 17)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
--
-- ══ CE QUI ÉTAIT GRAVÉ ═════════════════════════════════════════════════════════════════════════
--
-- Le commentaire de la table `synthese` (0029) le disait sans détour, et sans le voir comme un
-- défaut :
--
--     « Une utilisatrice ne peut donc ni forger, ni corriger, ni effacer sa synthèse —
--       l'effacement passera par FR-067 (Epic 6), qui est un chemin gardé, pas un bouton. »
--
-- L'Epic 6 est arrivé. FR-067 efface le COMPTE ENTIER. La Story 6.5 a donné à `fait_extrait` sa
-- correction et sa suppression une par une. La synthèse, elle, est restée la seule chose qu'Anam
-- écrit SUR elle et qu'elle ne peut retirer qu'en supprimant tout.
--
-- C'est un récit de plusieurs paragraphes, rédigé par un modèle, à partir de ce qu'elle a confié un
-- soir. Il peut la décrire de travers. Aujourd'hui, sa seule issue est de tout perdre — l'arbre, les
-- branches, deux ans de journal — pour retirer un texte de quinze lignes. Le droit à l'effacement
-- (art. 17) porte sur des données, pas sur des comptes ; et la charte du produit dit que rien ne se
-- grave contre elle.
--
-- ══ POURQUOI UNE PIERRE TOMBALE, ET PAS UN `DELETE` ════════════════════════════════════════════
--
-- `materiau_synthese` (0065) calcule le point de départ de la prochaine synthèse ainsi :
--
--     select max(s.periode_fin) into v_depuis from public.synthese s where …
--
-- La table porte donc un FILIGRANE. Supprimer physiquement la dernière ligne le ferait RECULER, et
-- la synthèse suivante re-raconterait une période déjà racontée — c'est-à-dire ferait réapparaître,
-- rédigé à neuf, le récit qu'elle venait d'effacer. C'est exactement la résurrection qu'AD-18
-- interdit, et le même raisonnement que le tombstone de `fait_extrait` : la ligne reste pour occuper
-- sa clé, le CONTENU part.
--
-- ══ POURQUOI L'EFFACEMENT ET PAS LA CORRECTION ═════════════════════════════════════════════════
--
-- `fait_extrait` offre les deux, parce qu'un fait est une phrase qu'elle peut réécrire dans ses
-- mots — la correction y a un sens, et la version corrigée est celle qu'Anam se rappelle ensuite.
--
-- Une synthèse est le compte rendu de ce qui a été dit. La corriger reviendrait à réécrire à la main
-- ce qu'un modèle a écrit d'elle : ni un fait ni un souvenir, un texte hybride dont plus personne ne
-- saurait dire qui l'a produit. Le geste juste est de la retirer — et la suivante sera écrite depuis
-- les faits, qu'elle PEUT corriger (6.5). La correction existe donc, une couche plus bas, là où elle
-- a un sens.
--
-- ══ OÙ VIT LA GARDE ════════════════════════════════════════════════════════════════════════════
--
-- Dans la CONTRAINTE et dans la POLICY, jamais dans le code. `authenticated` détient les sept
-- privilèges DML sur cette table : une règle écrite dans une Server Action, ou dans le corps d'une
-- fonction, se contourne par un PATCH PostgREST direct.
--
--   • la contrainte lie tombstone et vide dans les DEUX SENS, et lie aussi `service_role` ;
--   • la policy UPDATE n'autorise QUE la transition vers la pierre tombale : le `with check` exige
--     `contenu = ''`, donc réécrire le récit est impossible même en visant sa propre ligne ;
--   • le `using` exclut les lignes déjà effacées : on ne ressuscite pas, on n'efface pas deux fois ;
--   • aucune policy DELETE, aucune policy INSERT — forger une synthèse reste hors d'atteinte ;
--   • un trigger FIGE les colonnes de période, parce qu'un `with check` ne voit pas OLD (voir plus bas).
--
-- ══ CE QUE LA CAMPAGNE DE MUTATION A DIT DE CES TROIS COUCHES ════════════════════════════════
--
-- Huit mutants, cinq tués, TROIS SURVIVANTS — et les trois survivants sont instructifs plutôt que
-- gênants. Retirer `length(btrim(contenu…)) = 0` du `with check`, retirer `supprime_le is not null`
-- du `with check`, ou retirer entièrement la clé de propriété du `with check` : aucun des trois ne
-- change ce qui arrive. Dans les trois cas, une AUTRE couche refuse déjà l'écriture — la contrainte
-- de table pour les deux premiers, le `using` de la policy pour le troisième.
--
-- Ces clauses sont donc des CEINTURES, pas la couche porteuse. Elles restent, et pour une raison
-- qu'il faut écrire plutôt que sous-entendre : les deux couches ne couvrent pas les mêmes acteurs.
-- La contrainte lie `service_role`, que la RLS ne borne pas ; la policy borne les sessions, que la
-- contrainte laisserait faire tant que l'état final reste cohérent. Le jour où l'une des deux est
-- réécrite — et 0073 est né d'une réécriture de 0032 — l'autre tient.
--
-- Ce qui serait malhonnête serait de compter ces trois-là comme des gardes éprouvées. Elles ne le
-- sont pas : aucun test du dépôt ne peut aujourd'hui dire laquelle des deux couches a refusé.
--
-- ⚠️ ET L'EFFACEMENT SURVIT À TOUT. Ni `a_consenti_art9()`, ni `est_barre_minorite()` n'entrent dans
-- cette policy, et c'est délibéré : le droit à l'effacement s'exerce précisément quand on a retiré
-- son consentement. C'est la doctrine déjà écrite pour `fait_extrait` (0018) — « VIDER survit à la
-- révocation ». Fermer la sortie serait la faute grave.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

alter table public.synthese add column supprime_le timestamptz;

comment on column public.synthese.supprime_le is
  'Revue des Epics 1 a 4 (#8) : l''instant ou ELLE a retire ce recit. La ligne survit pour occuper sa cle — `materiau_synthese` lit `max(periode_fin)` comme filigrane, et une suppression physique le ferait reculer, donc re-raconterait la periode effacee (AD-18). Le contenu, lui, est parti.';

-- ── LA CONTRAINTE — l'équivalence, dans les deux sens, y compris pour `service_role` ────────────
--
-- Elle remplace `synthese_contenu_non_vide` (0032), qui interdisait le contenu blanc sans jamais
-- envisager qu'une ligne puisse légitimement n'en plus avoir. Sans l'équivalence, deux formes
-- bâtardes deviendraient possibles : une synthèse effacée qui a gardé son texte (une suppression qui
-- n'efface rien) et une synthèse vide qui n'est pas marquée effacée (un blanc que l'écran rendrait
-- comme « il n'y en a pas encore »). C'est mot pour mot la leçon de `fait_extrait_tombstone_est_vide`.

-- ⚠️ `btrim(contenu)` SANS SON SECOND ARGUMENT NE RETIRE QUE LES ESPACES — pas les retours à la
-- ligne, pas les tabulations. C'est tout l'objet de la migration 0032, intitulée « `btrim` ne fait
-- pas ce que son nom laisse croire », née d'un test écrit après coup : un modèle qui répond deux
-- retours à la ligne, et la synthèse s'écrit, le courriel part, et elle ouvre `/synthese` pour y
-- trouver une page vide présentée comme le récit de sa semaine.
--
-- La première version de cette migration-ci l'avait réintroduit, mot pour mot. Le test de 0032 l'a
-- attrapé — c'est exactement le service qu'on attend d'un test de contrainte : tenir la promesse
-- quand la contrainte est RÉÉCRITE, deux epics plus tard, par quelqu'un qui a lu le nom de la
-- fonction et pas sa documentation.

alter table public.synthese drop constraint synthese_contenu_non_vide;

alter table public.synthese
  add constraint synthese_tombstone_est_vide
  check ((supprime_le is not null) = (length(btrim(contenu, E' \t\n\r')) = 0));

comment on constraint synthese_tombstone_est_vide on public.synthese is
  'Revue des Epics 1 a 4 (#8) : une synthese effacee est vide, et rien d''autre ne l''est. Contrainte de TABLE et non trigger ni policy : elle lie aussi service_role, que la RLS ne borne pas — donc l''ordonnanceur lui-meme ne peut pas ecrire une ligne batarde.';

-- ── LA POLICY — le seul geste autorisé sous JWT, et il ne va que dans un sens ───────────────────

create policy synthese_proprietaire_effacement on public.synthese
for update to authenticated
using (
  (select auth.uid()) = utilisatrice_id
  -- Déjà effacée : rien à faire. Sans cette clause, un second UPDATE pourrait redéplacer `supprime_le`.
  and supprime_le is null
)
with check (
  (select auth.uid()) = utilisatrice_id
  -- LES DEUX CLAUSES QUI FONT TOUT LE TRAVAIL. `contenu` vidé : réécrire le récit est impossible.
  -- `supprime_le` posé : on ne peut pas vider en douce une ligne qui continuerait de passer pour vivante.
  and supprime_le is not null
  and length(btrim(contenu, E' \t\n\r')) = 0
);

-- ── LE TRIGGER — parce qu'un `with check` ne voit pas OLD ──────────────────────────────────────
--
-- ⚠️ L'ATTAQUE QU'IL FERME EST PRÉCISE, ET ELLE NE COÛTE RIEN À MONTER. La policy ci-dessus autorise
-- un UPDATE qui vide `contenu` et pose `supprime_le`. Elle ne dit RIEN des autres colonnes, qu'un
-- `with check` ne peut pas comparer à leur valeur d'avant. Un PATCH PostgREST direct :
--
--     PATCH /rest/v1/synthese?id=eq.…
--     { "contenu": "", "supprime_le": "…", "periode_fin": "2099-01-01T00:00:00Z" }
--
-- passe la policy et la contrainte — et déplace le filigrane à l'an 2099. Cette personne ne reçoit
-- plus jamais de synthèse, sans que rien ne le signale : le job la trouve à jour.
--
-- Dans l'autre sens (reculer `periode_fin`), le job re-raconte des semaines déjà racontées à chaque
-- passage. Le filigrane n'est pas une donnée d'affichage : c'est l'état d'une machine.

create or replace function public.synthese_effacement_ne_bouge_que_le_contenu()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- N'encadre QUE les écritures sous session. `service_role` (l'ordonnanceur) écrit la synthèse et
  -- n'a aucune raison de passer par ici ; l'y soumettre casserait l'écriture nominale.
  if (select auth.uid()) is null then
    return new;
  end if;

  -- ⚠️ LA LISTE VIENT DU SCHÉMA RÉEL, PAS DE LA MIGRATION QUI A CRÉÉ LA TABLE. La première version
  -- citait `new.semaine`, une colonne que 0030 a SUPPRIMÉE : le trigger levait `record "new" has no
  -- field "semaine"` à chaque effacement, donc la garde refusait tout — y compris le geste qu'elle
  -- existe pour permettre. Une garde qui refuse tout ressemble à une garde qui marche.
  if new.id              is distinct from old.id
     or new.utilisatrice_id is distinct from old.utilisatrice_id
     or new.periode_debut   is distinct from old.periode_debut
     or new.periode_fin     is distinct from old.periode_fin
     or new.tronquee        is distinct from old.tronquee
     or new.cree_le         is distinct from old.cree_le then
    raise exception 'synthese : effacer retire le contenu, et rien d''autre — `periode_fin` est le filigrane de la prochaine synthèse (revue 1-4, #8)';
  end if;

  return new;
end;
$$;

create trigger synthese_effacement_ne_bouge_que_le_contenu
  before update on public.synthese
  for each row
  execute function public.synthese_effacement_ne_bouge_que_le_contenu();

comment on function public.synthese_effacement_ne_bouge_que_le_contenu() is
  'Revue des Epics 1 a 4 (#8) : un `with check` ne voit pas OLD, donc la policy d''effacement ne peut pas empecher de deplacer `periode_fin` au passage. Or `periode_fin` est le filigrane lu par materiau_synthese : le pousser a 2099 prive quelqu''un de toute synthese future, sans aucun signal. Exempte service_role, qui ecrit la ligne nominale.';

-- ── LA LECTURE — une synthèse effacée n'est plus une synthèse ───────────────────────────────────
--
-- La policy de LECTURE (0029) reste ouverte sur toute la table : l'export FR-067 doit pouvoir
-- constater qu'une ligne existe et qu'elle est vide. C'est la SURFACE qui filtre — même règle que
-- `fait_est_vivant` pour les faits, et pour la même raison : une seule définition, citée et non
-- recopiée, plutôt que trois `where` écrits à des epics d'écart.

create or replace function public.synthese_est_vivante(p_supprime_le timestamptz)
returns boolean
language sql
immutable
set search_path = ''
as $$ select p_supprime_le is null $$;

comment on function public.synthese_est_vivante(timestamptz) is
  'Revue des Epics 1 a 4 (#8) : la SEULE definition de « cette synthese existe encore ». Miroir de fait_est_vivant (0065), ne pour la meme raison — deux definitions ecrites a deux epics d''ecart finissent par diverger, et celle qui diverge est celle qui montre ce qui devait etre efface.';

grant execute on function public.synthese_est_vivante(timestamptz) to authenticated, service_role;

-- ── LE FILIGRANE, LUI, IGNORE LA SUPPRESSION ───────────────────────────────────────────────────
--
-- ⚠️ `materiau_synthese` N'EST PAS TOUCHÉE, ET C'EST UN CHOIX QU'IL FAUT ÉCRIRE. Son
-- `max(s.periode_fin)` compte les pierres tombales — sinon effacer la dernière synthèse ferait
-- re-raconter la période, c'est-à-dire réécrirait ce qu'elle vient de retirer. Effacer un récit
-- n'efface pas le fait qu'on a déjà raconté cette semaine-là.
