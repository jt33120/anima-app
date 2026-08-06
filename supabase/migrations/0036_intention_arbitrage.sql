-- Migration forward-only — Story 4.10 : les PLANS D'ÉTAPES (FR-032/FR-081) et l'ARBITRAGE D'OUVERTURE
-- (FR-030/FR-031). Dernière migration de l'Epic 4.
--
-- Deux choses sans rapport apparent, unies par une seule règle : le produit ne montre jamais un compte,
-- et il n'écrit jamais à sa place.
--
--   • LE PLAN D'ÉTAPES — une suite d'intentions d'implémentation (« si X, alors Y ») rattachées à UNE
--     branche. La forme est garantie par la FORME DES DONNÉES (deux colonnes non vides), pas par un
--     prompt : décision PO D1. Aucun modèle n'écrit ici, donc aucune consigne, aucun egress, aucune
--     surface de sécurité nouvelle. Une intention d'implémentation EST une prescription comportementale ;
--     la faire générer par Anam tomberait pile dans ce que le PRD interdit.
--
--   • L'ARBITRAGE — « faire vivre une branche avant d'en ouvrir une autre ». Le compte de branches
--     ouvertes est calculé ICI, sert à choisir une branche du `if`, et ne traverse jamais la frontière
--     (FR-031 [DUR]).
--
-- ── CE QUE CETTE MIGRATION CORRIGE AU PASSAGE (dettes rendues observables par la 4.10) ────────────────
--
-- D4 — LE PLAFOND « une notification d'Anam / 72 h ». `reserver_notification` le comptait PAR MOTIF
--   depuis 0030. Avec un seul motif, per-motif et per-famille sont indistinguables ; cette story ajoute
--   le deuxième motif d'Anam, et l'écart devient deux courriels d'Anam en 72 h — contre EXPERIENCE.md
--   qui en promet UN. Le plafond redevient PAR FAMILLE (`anam` | `socle`), ce qui restaure la promesse
--   ET conserve la raison valable de 0030 : le socle quotidien (FR-033, Epic 6) est une autre famille,
--   avec son propre rythme, et ne mangera pas le courriel de synthèse.
--
--   La contrepartie de 0030 était que le courriel refusé par le plafond était perdu DÉFINITIVEMENT :
--   la production de la synthèse et la réservation du canal partageaient la même réclamation, si bien
--   qu'une synthèse écrite mais non annoncée ne redevenait jamais candidate. C'est réparé ici par
--   `syntheses_non_annoncees` — l'annonce est désormais RETENTABLE indépendamment de la production.

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 1. DEUX PRÉDICATS QUI EXISTAIENT DÉJÀ, RAMENÉS À UNE SEULE DÉFINITION
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- Cette story a besoin des deux, et les recopier serait exactement le piège des défenses redondantes :
-- deux expressions d'un même invariant, dont aucune n'est prouvée (retirer l'une laisse l'autre couvrir
-- le cas). On EXTRAIT plutôt qu'on ne duplique — l'ancien nom devient une délégation d'une ligne.

-- ── (a) « il reste quelque chose qui s'affiche », et son ROGNAGE ────────────────────────────────────
-- La classe de caractères SANS GLYPHE de la migration 0024, sortie de son contexte « nom de branche » :
-- elle n'a jamais eu rien de spécifique aux branches, et le plan d'étapes en a besoin mot pour mot.
--
-- ⚠️ C'est bien la classe de 0024 — celle de 0021 était plus étroite (elle laissait passer une vingtaine
-- d'invisibles, dont U+200B et U+FE0F, ce dernier présent dans presque tout copier-coller d'emoji), et
-- 0024 l'a élargie. Recopier la version de 0021 aurait ROUVERT le trou que 0024 a fermé, en croyant ne
-- faire qu'un déménagement. C'est exactement pourquoi il ne doit plus en exister qu'une seule.
create function public.texte_significatif(p_texte text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_texte ~ E'[^[:space:]\u00a0\u00ad\u034f\u061c\u115f-\u1160\u1680\u17b4-\u17b5\u180b-\u180f\u2000-\u200f\u2028-\u2029\u202f\u205f\u2060-\u206f\u2800\u3000\u3164\ufe00-\ufe0f\ufeff\uffa0\ufff9-\ufffb\U0001d173-\U0001d17a\U000e0000-\U000e01ef]';
$$;

comment on function public.texte_significatif(text) is
  'Story 4.10 : LA définition unique de « il reste quelque chose qui s''affiche ». Extraite de branche_nom_significatif (0024), qui la délègue désormais. Immuable → utilisable en contrainte CHECK.';

-- Le ROGNAGE, strictement aligné sur la garde (mêmes caractères, sans le `^`). Les deux vont par paire :
-- une garde plus large que son rognage laisse des invisibles en tête de chaîne, et le texte « change tout
-- seul » au premier réenregistrement — le défaut que 0024 avait corrigé pour les noms de branche.
create function public.rogner_texte(p_texte text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
           regexp_replace(p_texte, E'^[[:space:]\u00a0\u00ad\u034f\u061c\u115f-\u1160\u1680\u17b4-\u17b5\u180b-\u180f\u2000-\u200f\u2028-\u2029\u202f\u205f\u2060-\u206f\u2800\u3000\u3164\ufe00-\ufe0f\ufeff\uffa0\ufff9-\ufffb\U0001d173-\U0001d17a\U000e0000-\U000e01ef]+', ''),
           E'[[:space:]\u00a0\u00ad\u034f\u061c\u115f-\u1160\u1680\u17b4-\u17b5\u180b-\u180f\u2000-\u200f\u2028-\u2029\u202f\u205f\u2060-\u206f\u2800\u3000\u3164\ufe00-\ufe0f\ufeff\uffa0\ufff9-\ufffb\U0001d173-\U0001d17a\U000e0000-\U000e01ef]+$', '');
$$;

comment on function public.rogner_texte(text) is
  'Story 4.10 : LA définition unique du rognage des caractères sans glyphe. Extraite de branche_rogner_nom (0024), qui la délègue. Va par paire avec texte_significatif : une garde plus large que son rognage laisse des invisibles en tête de chaîne.';

-- Les anciens noms SURVIVENT (ils sont cités par la contrainte `branche_nom_significatif_ck`, par la
-- policy `branche_insertion`, par `renommer_branche` et par la RPC de naissance) mais ils ne contiennent
-- plus la règle : ils la délèguent. Une seule classe de caractères dans tout le dépôt côté base.
create or replace function public.branche_nom_significatif(p_nom text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select public.texte_significatif(p_nom);
$$;

create or replace function public.branche_rogner_nom(p_nom text)
returns text
language sql
immutable
set search_path = ''
as $$
  select public.rogner_texte(p_nom);
$$;

-- ── (b) « cette personne a-t-elle droit au travail périodique ? » ────────────────────────────────────
-- `eligible_a_synthese` (0030) réunit quatre conditions qui n'ont rien de propre à la synthèse : premium
-- actif, aucune barrière de minorité, consentement art. 9 vivant, aucune détresse en cours ni fenêtre de
-- 72 h chaude. Le rappel d'échéance a besoin des mêmes, à la virgule près — et notamment de la clause
-- détresse, que l'AC3 exige EN SQL et pas dans un filtre applicatif (un filtre TypeScript s'oublie au
-- premier appelant suivant ; une clause dans la fonction qui SÉLECTIONNE ne se contourne pas).
create function public.eligible_au_periodique(p_utilisatrice uuid)
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
                      and k.revoked_at is null)                  -- consentement art. 9 VIVANT (0005)
       -- AD-17 — miroir EXACT de `branche_bloquee_par_detresse()`. Rien de nouveau ne lui est poussé
       -- pendant un épisode ni dans les 72 h qui suivent : ni bilan de semaine, ni rappel d'échéance.
       and not exists (select 1 from public.episode_detresse e
                        where e.utilisatrice_id = u.id
                          and (e.fin is null or e.fenetre_expire_at > now()))
  );
$$;

revoke execute on function public.eligible_au_periodique(uuid) from public, anon, authenticated;

comment on function public.eligible_au_periodique(uuid) is
  'Story 4.10 : LA garde d''autorisation de TOUT travail périodique — premium actif, aucune barrière de minorité, consentement art. 9 vivant, aucune détresse en cours ni fenêtre de 72 h chaude. Extraite d''eligible_a_synthese (0030), qui la délègue : les conditions n''avaient rien de propre à la synthèse, et le rappel d''échéance (4.10) exige les mêmes à la virgule près.';

-- `eligible_a_synthese` garde son nom (trois fonctions de 4.9 l'appellent) et perd sa règle.
create or replace function public.eligible_a_synthese(p_utilisatrice uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.eligible_au_periodique(p_utilisatrice);
$$;

revoke execute on function public.eligible_a_synthese(uuid) from public, anon, authenticated;

-- ── (c) « suis-je premium, MAINTENANT, sous MON jeton ? » ────────────────────────────────────────────
-- Le pendant JWT du premium, pour les policies WITH CHECK. Patron `a_consenti_art9()` (0005) : keyée sur
-- `auth.uid()`, `security definer` (la RLS d'`abonnement` ne doit pas décider si le gate s'applique).
create function public.est_premium_courante()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.abonnement a
     where a.utilisatrice_id = (select auth.uid())
       and a.etat = 'actif'
  );
$$;

-- ⚠️ `revoke ... from public` NE SUFFIT PAS, et la migration 0007 le documente déjà : les
-- `alter default privileges` de Supabase donnent à `anon` un grant EXPLICITE que révoquer `public`
-- n'enlève pas. 0007 avait durci exactement de la même façon `a_consenti_art9()` et
-- `est_barre_minorite()` — les deux sœurs de cette fonction. L'oubli a été retrouvé par la revue :
-- `est_premium_courante` était appelable sans jeton via PostgREST. Sans conséquence (elle est clavetée
-- sur `auth.uid()`, nul pour `anon`, donc toujours `false`) — mais c'est le raisonnement exact que 0007
-- tenait avant de durcir quand même.
revoke all     on function public.est_premium_courante() from public, anon;
grant  execute on function public.est_premium_courante() to authenticated;

comment on function public.est_premium_courante() is
  'Story 4.10 (FR-081) : l''entitlement premium de l''APPELANTE, pour les write-gates. La garde vit dans le WITH CHECK des policies, jamais dans la seule RPC — `authenticated` a le grant INSERT table-level, donc une garde qui ne vivrait que dans la RPC serait illusoire (leçon R1 de la revue 4.4).';

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 2. LA TABLE `intention` — le plan d'étapes (AC1, AC2, FR-032/FR-081)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- LA FORME EST STRUCTURELLE. Deux colonnes, toutes deux non vides : il n'existe aucune façon d'écrire
-- une intention qui ne soit pas de la forme « si X, alors Y ». Ce n'est pas une consigne donnée à un
-- modèle, ni une validation d'interface qu'on peut contourner — c'est la forme de la ligne.
--
-- LE RATTACHEMENT EST STRUCTUREL AUSSI (AC1, « jamais une étape flottante ») : `branche_id` est NOT NULL
-- et sa FK est COMPOSITE — la branche et l'intention appartiennent forcément à la même utilisatrice,
-- invariant qui survit à un écrivain `service_role` (Epic 6), pas seulement à la RLS.
--
-- ⚠️ AD-18 NE S'APPLIQUE PAS ICI, ET C'EST DÉLIBÉRÉ. L'arbre ne régresse jamais (FR-029) et ses
-- suppressions sont des tombstones. Une INTENTION n'est pas une branche : l'AC2 la décrit comme « une
-- suite vivante, pas figée », et retirer une étape est un geste ordinaire de révision. Le `delete` est
-- donc FRANC. Quelqu'un appliquera un jour AD-18 par réflexe et rendra le plan non révisable — c'est
-- écrit ici pour que ce quelqu'un lise d'abord cette phrase.

-- La FK composite exige une unicité sur `(utilisatrice_id, id)` de `branche` (patron 0021 / entree_journal).
create unique index branche_util_id_unique on public.branche (utilisatrice_id, id);

create table public.intention (
  id              uuid        primary key default gen_random_uuid(),
  utilisatrice_id uuid        not null references public.utilisatrice(id) on delete cascade,  -- purge FR-067
  branche_id      uuid        not null,                                                        -- FK composite ci-dessous
  declencheur     text        not null,   -- le « si » — art. 9, de sa main
  action          text        not null,   -- le « alors » — art. 9, de sa main
  -- ⚠️ UNE ÉCHÉANCE EST UNE DATE CIVILE, PAS UN INSTANT. « Vendredi » à Paris n'est pas un timestamptz :
  -- le stocker comme tel ferait dépendre le jour du rappel du fuseau du serveur. `date` nu, et la
  -- conversion vers le jour civil Paris se fait au seul endroit qui la lit (`intentions_echues`).
  echeance        date,
  rang        integer     not null default 0,
  cree_le         timestamptz not null default now(),
  maj_le          timestamptz not null default now(),
  -- AC1 [DUR] — les deux moitiés de la forme, non vides. Même prédicat que le nom de branche : ce que
  -- l'app refuse, la base le refuse aussi (et réciproquement).
  constraint intention_declencheur_donne check (public.texte_significatif(declencheur)),
  constraint intention_action_donnee     check (public.texte_significatif(action)),
  -- Bornes hautes, miroir de `branche_nom_borne` (0023). Sans elles, un collage de 2 Mo entre en base.
  constraint intention_declencheur_borne check (length(declencheur) <= 300),
  constraint intention_action_borne      check (length(action)      <= 300),
  -- AC1 (rattachement incassable) + cohérence-propriétaire DURE (patron `branche_extrait_meme_proprietaire`).
  -- `on delete cascade` : effacer une branche efface son plan — un plan orphelin n'a aucun sens, et
  -- l'effacement exhaustif (FR-067, Epic 6) n'a alors rien de plus à savoir.
  constraint intention_branche_meme_proprietaire
    foreign key (utilisatrice_id, branche_id)
    references public.branche (utilisatrice_id, id) on delete cascade
);

-- Le PLAN d'une branche, dans son ORDRE. `rang` puis `id` : sans le départage explicite, deux
-- intentions créées dans la même transaction (donc au même `rang`) se réordonnaient d'un chargement
-- à l'autre — même défaut que celui corrigé en 0033, et invisible tant qu'on n'en crée qu'une à la fois.
create index intention_plan on public.intention (utilisatrice_id, branche_id, rang, id);
-- La sélection des échéances dues : une seule date par jour, sur peu de lignes.
create index intention_echeance on public.intention (echeance) where echeance is not null;

alter table public.intention enable row level security;
alter table public.intention force  row level security;

-- LECTURE : propriétaire, SANS gate premium et SANS gate consentement. Ses propres données lui restent
-- lisibles même si l'abonnement s'éteint ou si le consentement est révoqué — c'est ce que fait déjà
-- `branche_lecture`, et c'est ce qu'exige l'export FR-067. Un paywall qui séquestre les données déjà
-- écrites n'est pas un paywall, c'est une prise d'otage.
create policy intention_lecture on public.intention
  for select
  using (auth.uid() = utilisatrice_id);

-- ÉCRITURE (AC1 + AC6 / FR-081) — toutes les gardes ATOMIQUES dans le WITH CHECK :
--   • propriétaire ;
--   • PREMIUM (FR-081 : les plans d'étapes sont une fonction premium) ;
--   • consentement art. 9 valide + compte non barré-minorité (le contenu est de l'art. 9) ;
--   • AD-17 : rien ne s'écrit pendant un épisode de détresse ni dans les 72 h ;
--   • isolation : la branche visée appartient à l'appelante (le FK seul ignore la RLS de la table visée).
create policy intention_insertion on public.intention
  for insert
  with check (auth.uid() = utilisatrice_id
              and public.est_premium_courante()
              and public.a_consenti_art9()
              and not public.est_barre_minorite()
              and not public.branche_bloquee_par_detresse()
              and public.texte_significatif(declencheur)
              and public.texte_significatif(action)
              and exists (select 1 from public.branche b
                          where b.id = branche_id
                            and b.utilisatrice_id = (select auth.uid())));

-- RÉVISION (AC2). Mêmes gardes : modifier, c'est écrire. Le `using` borne CE QU'ON PEUT VISER, le
-- `with check` CE QU'ON PEUT ÉCRIRE — les deux sont nécessaires (sans `using`, on viserait la ligne
-- d'autrui ; sans `with check`, on y écrirait n'importe quoi).
create policy intention_revision on public.intention
  for update
  using      (auth.uid() = utilisatrice_id)
  with check (auth.uid() = utilisatrice_id
              and public.est_premium_courante()
              and public.a_consenti_art9()
              and not public.est_barre_minorite()
              and not public.branche_bloquee_par_detresse()
              and public.texte_significatif(declencheur)
              and public.texte_significatif(action)
              -- Le repointage vers la branche d'autrui est refusé au point d'écriture, comme en 0021.
              and exists (select 1 from public.branche b
                          where b.id = branche_id
                            and b.utilisatrice_id = (select auth.uid())));

-- RETRAIT (AC2) — propriétaire SEUL, sans gate premium ni consentement, et c'est un choix.
-- Retirer, c'est RÉDUIRE ce qu'on détient : le refuser à quelqu'un dont l'abonnement s'est éteint
-- l'enfermerait dans des données qu'elle ne peut plus ni réviser ni effacer. Et pendant un épisode de
-- détresse, retirer une intention devenue pesante est exactement le genre de geste qu'il ne faut pas
-- bloquer — AD-17 empêche que quelque chose NAISSE, pas qu'on allège.
create policy intention_retrait on public.intention
  for delete
  using (auth.uid() = utilisatrice_id);

-- `maj_le` autoritaire en BASE (patron `branche_touch_maj`/0021).
create function public.intention_touch_maj()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.maj_le = now();
  return new;
end;
$$;
revoke execute on function public.intention_touch_maj() from public, anon, authenticated;
create trigger intention_maj_le
  before insert or update on public.intention
  for each row execute function public.intention_touch_maj();

comment on table public.intention is
  'Story 4.10 (FR-032/FR-081) : une étape d''un plan, formulée en intention d''implémentation. La forme « si X, alors Y » est garantie par la FORME DES DONNÉES (deux colonnes non vides), jamais par un prompt — décision PO D1 : aucun modèle n''écrit ici. Rattachée à UNE branche par une FK composite (jamais flottante, AC1). Art. 9 : lecture propriétaire ouverte (survit à la révocation, export FR-067), écriture gatée premium + consentement + minorité + AD-17 dans le WITH CHECK. Le retrait est un DELETE FRANC, pas un tombstone : AD-18 ne s''applique pas — une intention est « une suite vivante, pas figée » (AC2).';

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 3. LES RPC DU PLAN — possédées, sous JWT (`security invoker`)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- ⚠️ UNE UPDATE BLOQUÉE PAR LA RLS NE LÈVE AUCUNE ERREUR : elle renvoie zéro ligne. Les RPC de révision
-- et de retrait rendent donc un BOOLÉEN (« quelque chose a-t-il bougé ? ») et pas `void` — sans quoi
-- l'appelant, et le test qui l'assère, prendraient un refus silencieux pour un succès (leçon 4.9/T5).

create function public.ajouter_intention(p_branche uuid, p_declencheur text, p_action text, p_echeance date)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rang integer;
  v_id       uuid;
begin
  -- Le rang suivant DANS CETTE BRANCHE. Deux ajouts concurrents peuvent obtenir la même : c'est
  -- précisément pourquoi l'ordre de lecture départage par `id` derrière `rang`.
  select coalesce(max(i.rang) + 1, 0) into v_rang
    from public.intention i
   where i.utilisatrice_id = (select auth.uid()) and i.branche_id = p_branche;

  insert into public.intention (utilisatrice_id, branche_id, declencheur, action, echeance, rang)
  values ((select auth.uid()), p_branche,
          public.rogner_texte(p_declencheur), public.rogner_texte(p_action),
          p_echeance, v_rang)
  returning id into v_id;

  return v_id;
end;
$$;
revoke execute on function public.ajouter_intention(uuid, text, text, date) from public, anon;
grant  execute on function public.ajouter_intention(uuid, text, text, date) to authenticated;

create function public.reviser_intention(p_intention uuid, p_declencheur text, p_action text, p_echeance date)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_touchees integer;
begin
  update public.intention
     set declencheur = public.rogner_texte(p_declencheur),
         action      = public.rogner_texte(p_action),
         echeance    = p_echeance
   where id = p_intention and utilisatrice_id = (select auth.uid());
  get diagnostics v_touchees = row_count;
  -- Zéro ligne = refusée (RLS, premium éteint, détresse) OU introuvable. L'appelant n'a pas à savoir
  -- laquelle : dans les deux cas, rien n'a changé, et c'est tout ce qu'il peut dire honnêtement.
  return v_touchees > 0;
end;
$$;
revoke execute on function public.reviser_intention(uuid, text, text, date) from public, anon;
grant  execute on function public.reviser_intention(uuid, text, text, date) to authenticated;

create function public.retirer_intention(p_intention uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_touchees integer;
begin
  delete from public.intention
   where id = p_intention and utilisatrice_id = (select auth.uid());
  get diagnostics v_touchees = row_count;
  return v_touchees > 0;
end;
$$;
revoke execute on function public.retirer_intention(uuid) from public, anon;
grant  execute on function public.retirer_intention(uuid) to authenticated;

-- LE PLAN, DANS SON ORDRE TOTAL ET STABLE. L'ordre vit ICI et nulle part ailleurs : le laisser au
-- rendu ou au dépôt en ferait deux, et deux ordres finissent toujours par diverger.
create function public.charger_plan(p_branche uuid)
returns table(id uuid, declencheur text, action text, echeance date, rang integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select i.id, i.declencheur, i.action, i.echeance, i.rang
    from public.intention i
   where i.utilisatrice_id = (select auth.uid())
     and i.branche_id = p_branche
   order by i.rang asc, i.id asc;   -- total ET stable — `id` départage les rangs égaux
$$;
revoke execute on function public.charger_plan(uuid) from public, anon;
grant  execute on function public.charger_plan(uuid) to authenticated;

comment on function public.charger_plan(uuid) is
  'Story 4.10 (AC2) : le plan d''une branche, dans son ordre TOTAL et STABLE (rang puis id). Le départage par id n''est pas décoratif : deux intentions créées dans la même transaction partagent leur rang et se réordonneraient d''un chargement à l''autre — le défaut corrigé en 0033, appliqué au plan.';

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 4. LE MOTIF `echeance_intention` ET LE PLAFOND PAR FAMILLE (D4, AC3)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════

-- Une VALEUR de plus dans l'ensemble fermé, pas un mécanisme de plus — exactement ce que 0029 annonçait.
alter table public.notification_envoyee
  drop constraint notification_envoyee_motif_check;
alter table public.notification_envoyee
  add  constraint notification_envoyee_motif_check
       check (motif in ('synthese_prete', 'echeance_intention'));

-- ── LA FAMILLE D'UN MOTIF ────────────────────────────────────────────────────────────────────────────
-- `anam` = ce qui est SIGNÉ D'ANAM, et dont EXPERIENCE.md promet « une notification d'Anam par 72 heures ».
-- `socle` = le rythme quotidien FR-033 (Epic 5/6), qui n'est jamais signé d'Anam et a son propre débit.
--
-- Un motif INCONNU rend NULL, et `reserver_notification` LÈVE dessus. C'est volontairement fail-closed :
-- le jour où quelqu'un ajoutera une valeur au CHECK ci-dessus sans la classer ici, l'envoi cassera
-- bruyamment plutôt que d'échapper au plafond en silence. Le CHECK ferme ce qui peut être STOCKÉ ; cette
-- fonction ferme ce qui peut être PLAFONNÉ — ce ne sont pas deux copies de la même règle, ce sont deux
-- règles qui doivent rester d'accord, et le désaccord est rendu bruyant.
create function public.famille_motif(p_motif text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_motif
           when 'synthese_prete'     then 'anam'
           when 'echeance_intention' then 'anam'
         end;
$$;

comment on function public.famille_motif(text) is
  'Story 4.10 (D4) : la FAMILLE d''un motif de notification. `anam` = signé d''Anam, plafonné à une notification par 72 h (EXPERIENCE.md) ; `socle` = le rythme quotidien FR-033, jamais signé d''Anam. NULL sur motif inconnu → reserver_notification lève : un motif non classé ne part pas, plutôt que d''échapper au plafond en silence.';

-- ── LA RÉSERVATION, PLAFONNÉE PAR FAMILLE ───────────────────────────────────────────────────────────
-- ⚠️ CE `create or replace` REMPLACE LE CORPS ENTIER, et la fonction a été amendée DEUX FOIS depuis sa
-- création : 0030 (le plafond par motif, la garde de plafond invalide, le sel du verrou) et 0034 (le
-- REFUS de désabonnement). Repartir de la version de 0030 rouvrait silencieusement le trou de 0034 — un
-- courriel repartait vers quelqu'un qui s'était désabonné. La suite l'a attrapé (`desabonnement.test.ts`) ;
-- il est écrit ici pour la prochaine fois. Toute réécriture future doit repartir de CE corps-ci.
create or replace function public.reserver_notification(
  p_utilisatrice    uuid,
  p_motif           text,
  p_cle             text,
  p_plafond_heures  integer
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reserve  boolean;
  v_famille  text;
begin
  -- `make_interval(hours => null)` rend NULL, donc `envoye_le > NULL` rend NULL, donc `not exists` rend
  -- TRUE : un plafond absent DÉSACTIVAIT silencieusement le plafond. Une valeur négative projetait la
  -- borne dans le futur, avec le même effet. On refuse plutôt que d'envoyer sans limite (0030).
  if p_plafond_heures is null or p_plafond_heures <= 0 then
    raise exception 'plafond_notification_invalide';
  end if;

  -- Un motif sans famille n'est pas plafonnable, donc il ne part pas (voir `famille_motif`). AVANT le
  -- verrou : lever en le tenant ferait attendre les appels concurrents pour rien.
  v_famille := public.famille_motif(p_motif);
  if v_famille is null then
    raise exception 'famille_motif_inconnue';
  end if;

  -- LE REFUS (0034 / T5-2). Rien n'est écrit, rien n'est consommé, rien n'est journalisé : son
  -- opposition ne laisse pas de trace dans la table des envois. AVANT le verrou et avant l'insertion —
  -- insérer puis refuser brûlerait la clé d'idempotence, et le jour où elle se réabonne, la
  -- notification de cette clé-là ne lui serait jamais envoyée.
  if exists (
       select 1 from public.preference_courriel p
        where p.utilisatrice_id = p_utilisatrice
          and p.refuse_le is not null
     ) then
    return false;
  end if;

  -- Le verrou est indispensable : sans lui, deux appels simultanés pour la même personne passeraient tous
  -- deux le `not exists` (aucun n'ayant encore inséré) et deux courriels partiraient dans la même seconde
  -- — l'index unique ne les arrêterait pas, leurs clés étant différentes.
  -- Le SEL (4909) sépare cet espace de verrous de celui de 0014 (webhooks Stripe).
  perform pg_advisory_xact_lock(hashtextextended(p_utilisatrice::text, 4909));

  insert into public.notification_envoyee (utilisatrice_id, motif, cle)
  select p_utilisatrice, p_motif, p_cle
   where not exists (
           select 1 from public.notification_envoyee n
            where n.utilisatrice_id = p_utilisatrice
              -- ⚠️ PAR FAMILLE, plus par motif (D4). Le per-motif de 0030 rendait le plafond d'Anam
              -- indistinguable de « un plafond par motif » tant qu'Anam n'avait qu'un motif ; la 4.10
              -- ajoute le second, et deux courriels d'Anam en 72 h contrediraient EXPERIENCE.md.
              -- La raison valable de 0030 est préservée : le socle est une AUTRE famille.
              and public.famille_motif(n.motif) = v_famille
              and n.envoye_le > now() - make_interval(hours => p_plafond_heures)
         )
  on conflict (utilisatrice_id, motif, cle) do nothing
  returning true into v_reserve;

  -- `returning … into` laisse NULL quand rien n'est inséré — que ce soit par le plafond (le `where`) ou
  -- par l'idempotence (le `on conflict`). Les deux veulent dire « n'envoie pas ».
  return coalesce(v_reserve, false);
end;
$$;

revoke execute on function public.reserver_notification(uuid, text, text, integer) from public, anon, authenticated;

-- ── RENDRE UNE RÉSERVATION QUI N'A PAS SERVI (revue 4.10) ───────────────────────────────────────────
--
-- La réservation précède l'envoi, et c'est la bonne posture : entre « j'envoie » et « je note que j'ai
-- envoyé » il y a une fenêtre, et cette fenêtre s'appelle « un deuxième courriel ». Mais elle a un prix
-- que la 4.9 avait assumé pour la synthèse et que la 4.10 ne peut PAS assumer pour le rappel :
--
--   • pour la SYNTHÈSE, un envoi qui échoue après réservation perd le courriel de la période — et la
--     clé se régénère à la période suivante. C'est un retard, pas une perte.
--   • pour le RAPPEL D'ÉCHÉANCE, la clé est le JOUR CIVIL, et l'échéance ne repasse jamais
--     (`echeance = aujourd'hui`, jamais `<=`). Un seul 5xx de Resend au mauvais moment effaçait donc
--     DÉFINITIVEMENT un rendez-vous qu'elle s'était fixé à elle-même, sans trace, sans reprise, et sans
--     que rien ne le lui redise jamais. L'asymétrie avait été héritée sans être vue.
--
-- Rendre la réservation referme le trou : le tick suivant (ou une relance du job le même jour) retente.
-- Ce n'est PAS un affaiblissement du plafond — on ne libère que ce qui n'a rien envoyé, et seulement la
-- clé exacte qu'on venait de poser.
create function public.liberer_notification(p_utilisatrice uuid, p_motif text, p_cle text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supprimees integer;
begin
  delete from public.notification_envoyee
   where utilisatrice_id = p_utilisatrice and motif = p_motif and cle = p_cle;
  get diagnostics v_supprimees = row_count;
  return v_supprimees > 0;
end;
$$;
revoke execute on function public.liberer_notification(uuid, text, text) from public, anon, authenticated;

comment on function public.liberer_notification(uuid, text, text) is
  'Story 4.10 (revue) : rend une réservation de canal qui n''a RIEN envoyé. Sans elle, un échec d''envoi après réservation perdait définitivement un rappel d''échéance — la clé étant le jour civil et l''échéance ne repassant jamais. Ne libère que la clé exacte posée juste avant ; le plafond reste intact pour tout le reste.';

comment on table public.notification_envoyee is
  'Story 4.9 (AC4/FR-035), revu en 0030 puis en 0036 : trace des notifications parties. Sert à DEUX choses — l''idempotence par (motif, clé) et le plafond de débit, désormais PAR FAMILLE (`anam` | `socle`). Le per-motif de 0030 laissait passer deux courriels d''Anam en 72 h dès qu''Anam a eu deux motifs (Story 4.10), contre EXPERIENCE.md qui en promet un ; le per-famille restaure la promesse tout en gardant la raison de 0030 (le socle quotidien FR-033 ne mange pas le courriel de synthèse). Ensemble de motifs FERMÉ par contrainte. Deny-by-default, NON-art. 9 (aucune colonne de contenu).';

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 5. L'ANNONCE DEVIENT RETENTABLE (la contrepartie de D4)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- Le défaut que 0030 décrivait — un courriel refusé par le plafond, perdu à jamais — venait de ce que
-- l'annonce était accrochée à la PRODUCTION : `notifier()` n'était appelée que dans le tour où la
-- synthèse venait d'être écrite. Refusée là, elle ne revenait jamais (la cadence retient la personne
-- sept jours, et la synthèse existant déjà, `enregistrer` rend `null`).
--
-- Le per-motif de 0030 ne réparait pas ce cas-là (deux synthèses à moins de 72 h portent le MÊME motif) :
-- il déplaçait le problème. Voici la vraie réparation — l'annonce est retrouvable par une requête, donc
-- retentable, indépendamment de toute réclamation.
--
-- BORNÉE DANS LE TEMPS, volontairement : au-delà de quelques jours, annoncer « ta synthèse est prête »
-- pour un texte de la semaine dernière est un courriel daté qui n'apporte rien. Le plafond a mordu, la
-- synthèse attend dans l'app, et c'est très bien ainsi.
create function public.syntheses_non_annoncees(p_limite integer, p_jours integer)
returns table(utilisatrice_id uuid, synthese_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select s.utilisatrice_id, s.id
    from public.synthese s
   where s.cree_le > now() - make_interval(days => p_jours)
     and public.eligible_au_periodique(s.utilisatrice_id)
     -- LE DÉSABONNEMENT SE REGARDE ICI AUSSI (revue 4.10). Sans cette clause, une personne qui s'est
     -- désabonnée reste dans le lot pendant toute la fenêtre de rattrapage : `reserver_notification`
     -- refusera bien de l'envoyer, mais elle aura consommé une des cinq places ET trois allers-retours
     -- par tick. À cinq désabonnées, plus aucune vraie synthèse en attente n'est jamais rattrapée.
     and not exists (select 1 from public.preference_courriel pc
                      where pc.utilisatrice_id = s.utilisatrice_id and pc.refuse_le is not null)
     and not exists (
           select 1 from public.notification_envoyee n
            where n.utilisatrice_id = s.utilisatrice_id
              and n.motif = 'synthese_prete'
              and n.cle   = s.id::text
         )
   order by s.cree_le asc, s.id asc   -- total ET stable : deux synthèses du même tick ne permutent pas
   limit p_limite;
$$;
revoke execute on function public.syntheses_non_annoncees(integer, integer) from public, anon, authenticated;

comment on function public.syntheses_non_annoncees(integer, integer) is
  'Story 4.10 (D4) : les synthèses écrites mais jamais annoncées, dans la fenêtre récente. C''est ce qui rend l''annonce RETENTABLE indépendamment de la production — le vrai correctif du défaut que 0030 décrivait et que le per-motif ne réparait pas (deux synthèses à moins de 72 h portent le même motif). Bornée dans le temps : un « ta synthèse est prête » de la semaine dernière est un courriel daté.';

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 6. LES ÉCHÉANCES DUES (AC3) — la clause détresse vit ICI, jamais dans un filtre TypeScript
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- UNE LIGNE PAR PERSONNE, pas par intention. Le courriel ne dit rien du contenu (« une échéance que tu as
-- fixée arrive aujourd'hui ») : deux intentions dues le même jour ne justifient pas deux courriels, et
-- envoyer par intention ferait mordre le plafond de famille sur la seconde, qui serait alors perdue.
-- La clé d'idempotence est donc le JOUR CIVIL, et le rappel du jour part au plus une fois.
--
-- `echeance = aujourd'hui`, STRICTEMENT — jamais `<=`. Une échéance passée pendant un épisode de détresse
-- n'est pas rattrapée ensuite : un rappel qui arrive avec trois jours de retard est un reproche daté.
-- Ce choix est ASSUMÉ, et il est structurel : il n'y a pas de file d'attente où le retard s'accumule.
create function public.rappels_echeance_dus(p_limite integer)
returns table(utilisatrice_id uuid, jour text)
language sql
stable
security definer
set search_path = ''
as $$
  select i.utilisatrice_id,
         to_char((now() at time zone 'Europe/Paris')::date, 'YYYY-MM-DD')
    from public.intention i
   where i.echeance = (now() at time zone 'Europe/Paris')::date
     -- AD-17 + premium + consentement + minorité, en UNE clause SQL non contournable (AC3).
     and public.eligible_au_periodique(i.utilisatrice_id)
     -- Une désabonnée occuperait une des dix places pour un courriel que le canal refusera de toute
     -- façon — et comme rien n'est jamais rattrapé ici, la place perdue l'est pour de bon (revue 4.10).
     and not exists (select 1 from public.preference_courriel pc
                      where pc.utilisatrice_id = i.utilisatrice_id and pc.refuse_le is not null)
   group by i.utilisatrice_id
   -- ⚠️ PAS `order by utilisatrice_id` — la revue 4.10 a montré que ce tri est une INJUSTICE STABLE :
   -- au-delà de dix échéances dues le même jour, ce sont TOUJOURS les mêmes uuid qui passent, et comme
   -- rien n'est rattrapé, les autres ne sont jamais rappelées. Jamais. Le job de synthèse évite ça en
   -- triant par attente ; un rappel n'a pas d'attente, alors on fait TOURNER : le hachage dépend du
   -- jour, donc l'ordre change chaque jour, et sur la durée personne n'est structurellement lésée.
   order by md5(i.utilisatrice_id::text || to_char((now() at time zone 'Europe/Paris')::date, 'YYYY-MM-DD'))
   limit p_limite;
$$;
revoke execute on function public.rappels_echeance_dus(integer) from public, anon, authenticated;

comment on function public.rappels_echeance_dus(integer) is
  'Story 4.10 (AC3) : les personnes dont une échéance tombe AUJOURD''HUI (jour civil Europe/Paris), une ligne chacune. La garde AD-17 (aucun rappel pendant un épisode de détresse ni dans les 72 h) vit dans cette clause SQL et pas dans un filtre applicatif — un filtre TypeScript s''oublie au premier appelant suivant. `echeance = aujourd''hui` et jamais `<=` : une échéance manquée n''est PAS rattrapée, un rappel en retard est un reproche daté.';

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 7. L'ARBITRAGE D'OUVERTURE (AC4/AC5, FR-030/FR-031)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- LE PARTAGE DES RÔLES, et il n'est pas arbitraire :
--   • LA BASE rend les FAITS (combien de branches encore en `naissance`, et laquelle est la plus
--     ancienne) et détient la RÉSERVATION de la parole — parce qu'une réservation atomique est la seule
--     façon d'empêcher deux rendus concurrents de dire deux fois la même chose.
--   • LE DOMAINE PUR décide du SEUIL (D2) : c'est une règle produit, elle se teste sans base (AD-1).
--
-- ⚠️ LE COMPTE NE TRAVERSE JAMAIS LA FRONTIÈRE (AC5 [DUR]). Il est calculé ici, il choisit une branche
-- du `if` côté serveur, et il n'existe dans aucun champ envoyé au client. Le rendu ne peut pas afficher
-- un chiffre qu'il n'a pas reçu — c'est ce qui rend FR-031 vrai par construction et non par discipline.

create table public.invitation_integration (
  utilisatrice_id uuid        primary key references public.utilisatrice(id) on delete cascade,  -- purge FR-067
  dite_le         timestamptz not null default now()
);

alter table public.invitation_integration enable row level security;
alter table public.invitation_integration force  row level security;
-- Aucune policy : deny-by-default. C'est une trace de RYTHME, pas un contenu — et rien dans l'app n'a
-- besoin de la lire autrement que par la RPC de réservation ci-dessous.

comment on table public.invitation_integration is
  'Story 4.10 (D3/FR-034) : quand Anam a dit, pour la dernière fois, « fais-en vivre une avant d''en ouvrir une autre ». Sans cette trace, FR-030 fabriquerait la violation de FR-034 : le signal étant toujours là et le seuil toujours franchi, l''invitation repartirait CHAQUE JOUR — et la plus agaçante des répétitions, puisqu''elle se répète parce qu''elle n''a pas obéi. Deny-by-default, NON-art. 9.';

-- ── LES FAITS ───────────────────────────────────────────────────────────────────────────────────────
-- `security invoker` : la RLS de `branche` borne à la propriétaire, comme partout ailleurs.
-- La branche CIBLE est la plus ancienne encore en `naissance`, départagée par `id` : ordre TOTAL, donc
-- la même d'un chargement à l'autre. Une seule, jamais une liste — une liste redeviendrait un compte.
create function public.faits_arbitrage_ouverture()
returns table(branches_en_naissance integer, branche_cible uuid)
language sql
stable
security invoker
set search_path = ''
as $$
  select (select count(*)::integer from public.branche b
           where b.utilisatrice_id = (select auth.uid()) and b.etat = 'naissance'),
         (select b.id from public.branche b
           where b.utilisatrice_id = (select auth.uid()) and b.etat = 'naissance'
           order by b.date_naissance asc, b.id asc
           limit 1);
$$;
revoke execute on function public.faits_arbitrage_ouverture() from public, anon;
grant  execute on function public.faits_arbitrage_ouverture() to authenticated;

-- ── LA RÉSERVATION DE LA PAROLE (D3) ────────────────────────────────────────────────────────────────
-- Rend `true` au plus une fois par fenêtre, ET seulement si un MOUVEMENT RÉEL a eu lieu depuis la
-- dernière fois — une branche qui a feuillé ou qui est entrée en pleine lumière. Dit autrement : Anam le
-- dit, puis elle se tait, et seul un geste de sa part à ELLE lui rend la parole.
--
-- Le verrou consultatif, comme pour `reserver_notification` : deux rendus concurrents (deux onglets, un
-- rafraîchissement) passeraient tous deux la lecture avant que l'un n'écrive.
create function public.reserver_invitation_integration(p_fenetre_heures integer)
returns boolean
language plpgsql
-- `security definer`, et c'est OBLIGATOIRE : `invitation_integration` est deny-by-default (aucune
-- policy), donc une fonction `invoker` ne pourrait pas y écrire. `auth.uid()` reste celui de
-- l'APPELANTE — il se lit dans les claims du jeton, que le mode de sécurité ne change pas. Même
-- posture que `reserver_notification`.
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_dite_le   timestamptz;
  v_mouvement boolean;
begin
  if v_uid is null then return false; end if;
  if p_fenetre_heures is null or p_fenetre_heures <= 0 then
    raise exception 'fenetre_invitation_invalide';
  end if;

  -- Sel distinct de 4909 (notifications) et de 0014 (Stripe) : trois espaces de verrous qui ne doivent
  -- pas s'attendre l'un l'autre.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 4910));

  select i.dite_le into v_dite_le
    from public.invitation_integration i where i.utilisatrice_id = v_uid;

  -- Jamais dit : Anam a la parole.
  if v_dite_le is null then
    insert into public.invitation_integration (utilisatrice_id, dite_le) values (v_uid, now());
    return true;
  end if;

  -- Dit récemment : elle se tait.
  if v_dite_le > now() - make_interval(hours => p_fenetre_heures) then
    return false;
  end if;

  -- La fenêtre est passée. Elle reprend la parole si quelque chose a BOUGÉ depuis — sinon l'invitation
  -- redeviendrait un message générique récurrent, à cadence hebdomadaire au lieu de quotidienne, ce qui
  -- ne change rien à ce que FR-034 interdit.
  select exists (select 1 from public.branche b
                  where b.utilisatrice_id = v_uid
                    and (b.date_feuillaison > v_dite_le or b.date_rayonnement > v_dite_le))
    into v_mouvement;

  -- ⚠️ MAIS PAS INDÉFINIMENT (revue 4.10, décision PO du 2026-08-06 : « rouvrir la parole, sans trop
  -- insister »). La composition des trois règles — le germe n'est jamais consommé, le seuil reste
  -- franchi, et le réarmement exige un mouvement — rendait Anam DÉFINITIVEMENT muette : ni invitation,
  -- ni proposition, pour tous les moments mûrs à venir, et le seul déverrouillage était précisément ce
  -- que la personne ne faisait pas. Un long silence rouvre donc la parole tout seul.
  --
  -- QUATRE FOIS la fenêtre ordinaire, et pas deux : à sept jours on redirait la même chose à quelqu'un
  -- qui vient de l'entendre ; à un mois, on lui redit une fois, et c'est tout ce que « sans trop
  -- insister » peut vouloir dire.
  if not v_mouvement and v_dite_le > now() - make_interval(hours => p_fenetre_heures * 4) then
    return false;
  end if;

  update public.invitation_integration set dite_le = now() where utilisatrice_id = v_uid;
  return true;
end;
$$;
revoke execute on function public.reserver_invitation_integration(integer) from public, anon;
grant  execute on function public.reserver_invitation_integration(integer) to authenticated;

comment on function public.reserver_invitation_integration(integer) is
  'Story 4.10 (D3/AC4) : Anam a-t-elle le droit de dire l''invitation MAINTENANT ? Vrai au plus une fois par fenêtre, et réarmé UNIQUEMENT par un mouvement réel (une branche qui feuille ou qui rayonne). La réservation EST la décision, atomique comme reserver_notification : deux rendus concurrents ne peuvent pas dire deux fois la même chose.';
