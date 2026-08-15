-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 0053 — LE SOCLE QUOTIDIEN ET LA POUSSÉE DISCRÈTE (Story 6.2)
--
-- FR-033 (le socle se manifeste quotidiennement, impersonnel), FR-035 / NFR-015 (l'aperçu ne trahit
-- rien), NFR-020 (aucun art. 9 chez un tiers), NFR-004 (aucune inférence d'émotion), AD-15, AD-17.
--
-- ── CE QUE CETTE MIGRATION NE FAIT PAS, ET C'EST LE PLUS IMPORTANT ────────────────────────────────────
--
-- Elle ne réécrit PAS `reserver_notification`. En 4.10, la réécrire a coûté la garde de désabonnement
-- de 0034 ; l'en-tête de 0036 le raconte, celui de 0038 le répète. Le socle entre par les deux gestes
-- que 0029 avait annoncés comme la façon d'étendre l'ensemble : **une valeur** au CHECK des motifs,
-- **une branche** à `famille_motif`. Le corps de la réservation n'est pas touché d'une ligne.
--
-- ── LA CHARGE UTILE N'EXISTE PAS (décision D1) ────────────────────────────────────────────────────────
--
-- Rien dans cette migration ne stocke un texte de notification, parce qu'il n'en part aucun. RFC 8030
-- autorise un corps vide ; le service de poussée reçoit zéro octet de contenu, et le titre comme le
-- corps sont choisis dans le service worker à partir d'un ensemble fini embarqué
-- (`lib/domain/socle-quotidien.ts`). C'est la stratégie de `PortCourriel` (4.9) transposée : la phrase
-- « ajoutons juste le mantra du jour dans l'aperçu » n'a nulle part où s'écrire.
--
-- Conséquence à ne pas perdre de vue en relisant : les seules colonnes de texte créées ici portent des
-- IDENTIFIANTS DE TRANSPORT (une URL d'endpoint, deux clés base64url). Elles sont donc contraintes de
-- forme — un `text` libre écrit par `authenticated` est exactement le trou que la doctrine du dépôt
-- traque, et ce serait le premier endroit où quelqu'un rangerait de l'art. 9 sans le vouloir.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 1. LA GARDE PARTAGÉE, EXTRAITE — « peut-on lui pousser quoi que ce soit ? »
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- `eligible_au_periodique` (0036) réunit CINQ conditions, dont quatre n'ont rien à voir avec le fait
-- d'être abonnée : barrière de minorité, minorité persistante, consentement art. 9 vivant, et AD-17
-- (aucun épisode de détresse en cours ni fenêtre de 72 h chaude).
--
-- Le socle a besoin de ces quatre-là et surtout PAS de la cinquième : il est le TRONC GRATUIT (FR-088).
-- Un socle réservé aux abonnées serait une régression de la 3.3, et elle passerait inaperçue — la
-- fonction s'appelle « éligible au périodique », pas « éligible si elle paie ».
--
-- Même geste qu'en 0036 avec `texte_significatif` : on EXTRAIT le noyau, et l'ancien nom survit en
-- DÉLÉGUANT. Il n'y a toujours qu'une seule définition de la clause de détresse dans toute la base ;
-- deux copies auraient divergé au premier amendement d'AD-17.
create function public.personne_joignable(p_utilisatrice uuid)
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
       and u.barriere_minorite_le is null                        -- barrière posée après coup (0006, FR-071)
       and u.mineur_detecte is not true                          -- barrière persistante (FR-070)
       and exists (select 1 from public.consentement k
                    where k.utilisatrice_id = u.id
                      and k.art9_accorde = true
                      and k.ia_reconnue  = true
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

revoke execute on function public.personne_joignable(uuid) from public, anon, authenticated;

comment on function public.personne_joignable(uuid) is
  'Story 6.2 : LE NOYAU de l''autorisation périodique, sans la condition premium — aucune barrière de minorité, consentement art. 9 vivant, aucune détresse en cours ni fenêtre de 72 h chaude (AD-17). Extrait d''eligible_au_periodique (0036), qui le délègue. Le socle quotidien (FR-033) est le TRONC GRATUIT (FR-088) : il lui faut ces quatre conditions et surtout pas la cinquième.';

-- L'ANCIEN NOM SURVIT et ne contient plus la règle : il la délègue, et ajoute la seule condition qui
-- lui était propre. Toute la surface d'appel de 0036 (rappels_echeance_dus, eligible_a_synthese) est
-- inchangée ; ce qui change, c'est qu'il n'existe plus deux endroits où écrire AD-17.
create or replace function public.eligible_au_periodique(p_utilisatrice uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.personne_joignable(p_utilisatrice)
     and exists (select 1 from public.abonnement a
                  where a.utilisatrice_id = p_utilisatrice
                    and a.etat = 'actif');                       -- premium, et seulement premium
$$;

comment on function public.eligible_au_periodique(uuid) is
  'Story 4.10, ré-exprimée en 6.2 : `personne_joignable` (minorité, consentement art. 9, AD-17) ET premium actif. Le corps a été extrait pour que la clause de détresse n''ait qu''une définition dans toute la base ; la sémantique est inchangée à la virgule près, et tests/socle-sql.test.ts vérifie les CINQ refus un par un.';

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 2. LE MOTIF DU SOCLE — une valeur, une branche, rien d'autre
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════

alter table public.notification_envoyee
  drop constraint notification_envoyee_motif_check;
alter table public.notification_envoyee
  add  constraint notification_envoyee_motif_check
       check (motif in ('synthese_prete', 'echeance_intention', 'socle_quotidien'));

-- La FAMILLE `socle` que 0036 avait nommée en la réservant pour cet epic. Elle existe enfin.
--
-- Ce qu'elle change concrètement : le socle ne consomme PAS le plafond d'Anam, et Anam ne consomme pas
-- celui du socle. Une synthèse annoncée hier n'empêche pas la manifestation quotidienne, et
-- réciproquement — c'était toute la raison du passage « par motif » → « par famille » en 4.10.
create or replace function public.famille_motif(p_motif text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_motif
           when 'synthese_prete'     then 'anam'
           when 'echeance_intention' then 'anam'
           when 'socle_quotidien'    then 'socle'
         end;
$$;

comment on function public.famille_motif(text) is
  'Story 4.10 (D4), étendue en 6.2 : la FAMILLE d''un motif de notification. `anam` = signé d''Anam, plafonné à une notification par 72 h (EXPERIENCE.md) ; `socle` = le rythme quotidien FR-033, jamais signé d''Anam, plafonné à 20 h. NULL sur motif inconnu → reserver_notification lève : un motif non classé ne part pas, plutôt que d''échapper au plafond en silence.';

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 3. L'HEURE CHOISIE
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- Table à part, sur le patron de `preference_courriel` (0034), et pas une colonne de `utilisatrice` :
-- une préférence de canal n'est pas une propriété de la personne, et la mêler à une table dont
-- plusieurs colonnes sont write-once (0039) mélangerait deux régimes d'écriture dans une seule policy.
--
-- ⚠️ L'HEURE EST UNE HEURE DE PARIS (décision D3). `utilisatrice.lieu_fuseau` existe (0039) mais c'est
-- le fuseau du LIEU DE NAISSANCE, pas de résidence, et il est write-once : s'en servir ici serait une
-- faute de sens qui ne se verrait jamais. Tout le dépôt tranche déjà `Europe/Paris` (`jour_paris`,
-- 0046). Le jour où le produit sort de France, c'est une story, pas un `coalesce`.
create table public.preference_socle (
  utilisatrice_id uuid        primary key references public.utilisatrice(id) on delete cascade,
  heure           smallint    not null default 8,
  maj_le          timestamptz not null default now(),
  constraint preference_socle_heure_ck check (heure between 0 and 23)
);

alter table public.preference_socle enable row level security;
alter table public.preference_socle force  row level security;

-- ⚠️ LA GARDE D'ÉCRITURE VIT DANS LE `WITH CHECK`, jamais dans une route ni une Server Action :
-- `authenticated` détient les sept privilèges DML sur toute table `public`, et une garde applicative
-- se contourne avec un client Supabase et trente secondes. C'est la doctrine cardinale du dépôt.
--
-- `using` ET `with check` sur l'update, et les deux sont nécessaires : `using` décide quelles lignes
-- elle peut viser, `with check` décide ce qu'elles ont le droit de devenir. Sans le second, elle
-- pourrait réattribuer sa préférence à quelqu'un d'autre.
create policy preference_socle_proprietaire_lecture on public.preference_socle
  for select using (auth.uid() = utilisatrice_id);
create policy preference_socle_proprietaire_creation on public.preference_socle
  for insert with check (auth.uid() = utilisatrice_id);
create policy preference_socle_proprietaire_maj on public.preference_socle
  for update using (auth.uid() = utilisatrice_id) with check (auth.uid() = utilisatrice_id);

-- Aucune policy de suppression : la ligne meurt avec le compte (cascade, FR-067). Se « désabonner » du
-- socle, c'est supprimer son abonnement de poussée — voir la décision D6 ci-dessous.

comment on table public.preference_socle is
  'Story 6.2 (AC2) : l''heure à laquelle le socle peut se manifester, en heure de PARIS (décision D3), 8 h par défaut. NON-art. 9 : aucune colonne de contenu, et l''heure choisie n''apprend rien de l''intimité. Cascade FR-067.';

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 4. L'ABONNEMENT DE POUSSÉE — et pourquoi ses colonnes sont contraintes de forme
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- D6 : **l'abonnement EST le consentement au canal.** Pas de colonne `active`, pas de bascule séparée.
-- Il y a une ligne, ou il n'y en a pas. Se désabonner, c'est supprimer la ligne — le navigateur et la
-- base disent alors la même chose, et il n'existe aucun état où l'un des deux ment.
--
-- Plusieurs lignes par personne : un téléphone et un ordinateur sont deux abonnements. L'idempotence
-- de la notification reste PAR PERSONNE ET PAR JOUR (`notification_envoyee`) — deux appareils ne
-- justifient pas deux réservations, ils justifient deux POST.
create table public.abonnement_poussee (
  id              uuid        primary key default gen_random_uuid(),
  utilisatrice_id uuid        not null references public.utilisatrice(id) on delete cascade,
  endpoint        text        not null,
  cle_p256dh      text        not null,
  cle_auth        text        not null,
  cree_le         timestamptz not null default now(),

  -- ⚠️ CES TROIS CONTRAINTES SONT LA GARDE ART. 9 DE CETTE TABLE, pas de la cosmétique.
  --
  -- Trois colonnes `text` que `authenticated` peut écrire, sans contrainte de forme, sont trois
  -- endroits où de l'art. 9 finirait par se ranger — au mieux par une erreur de câblage, au pire
  -- parce que quelqu'un a trouvé pratique d'y « juste » mettre un libellé d'appareil. Une colonne
  -- dont la forme est fermée n'a pas cette conversation.
  --
  -- L'ALLOWLIST D'HÔTES est délibérément stricte, et son coût est assumé : le jour où un navigateur
  -- change d'hôte de poussée, l'abonnement échouera pour lui — bruyamment, à l'écran des réglages,
  -- et la réparation est une valeur de plus dans cette liste. C'est le bon sens du refus : sans elle,
  -- n'importe quelle session pourrait faire POSTer notre serveur vers l'URL de son choix (SSRF en
  -- aveugle), l'en-tête VAPID en prime.
  constraint abonnement_poussee_endpoint_ck check (
    length(endpoint) <= 800
    and endpoint ~ '^https://([a-z0-9-]+\.)*(push\.services\.mozilla\.com|fcm\.googleapis\.com|web\.push\.apple\.com)/[A-Za-z0-9._~:/?#@!$&*+,;=%-]+$'
  ),
  -- base64url, et rien d'autre. p256dh = 65 octets non compressés → 87 caractères ; auth = 16 → 22.
  -- Les bornes sont larges d'un facteur deux, la CHARSET ne l'est pas.
  constraint abonnement_poussee_p256dh_ck check (cle_p256dh ~ '^[A-Za-z0-9_-]{80,180}$'),
  constraint abonnement_poussee_auth_ck   check (cle_auth   ~ '^[A-Za-z0-9_-]{16,60}$')
);

-- Un endpoint est unique au monde : c'est l'identifiant que le service de poussée nous a donné. S'il
-- réapparaît pour quelqu'un d'autre (réinstallation, appareil revendu), la ligne doit CHANGER de
-- propriétaire, pas se dédoubler — sans quoi l'ancienne propriétaire continuerait de recevoir.
create unique index abonnement_poussee_endpoint on public.abonnement_poussee (endpoint);
create index abonnement_poussee_par_personne on public.abonnement_poussee (utilisatrice_id);

alter table public.abonnement_poussee enable row level security;
alter table public.abonnement_poussee force  row level security;

create policy abonnement_poussee_proprietaire_lecture on public.abonnement_poussee
  for select using (auth.uid() = utilisatrice_id);
create policy abonnement_poussee_proprietaire_creation on public.abonnement_poussee
  for insert with check (auth.uid() = utilisatrice_id);
create policy abonnement_poussee_proprietaire_retrait on public.abonnement_poussee
  for delete using (auth.uid() = utilisatrice_id);
-- Aucune policy d'UPDATE, et c'est délibéré : un abonnement qui change n'est pas un abonnement
-- amendé, c'est un autre abonnement. Sans cette absence, une ligne pourrait garder son `id` en
-- changeant d'endpoint — et l'unicité ci-dessus ne dirait plus ce qu'elle prétend dire.

comment on table public.abonnement_poussee is
  'Story 6.2 (D6) : un abonnement web push. LA LIGNE EST LE CONSENTEMENT AU CANAL — pas de colonne `active`, se désabonner c''est la supprimer. NON-art. 9, et structurellement : les trois colonnes texte sont des identifiants de TRANSPORT, contraints de forme (allowlist d''hôtes, base64url) précisément pour qu''aucun contenu ne puisse y être rangé. Cascade FR-067.';

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 5. LA SÉLECTION — l'heure se calcule EN BASE, jamais depuis l'applicatif
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- ⚠️ Aucun paramètre `p_heure`. C'est la leçon de 0046 (`jour_paris`) appliquée à l'heure : si
-- l'applicatif dit à la base quelle heure il est, alors la garde « à l'heure choisie » ne garde plus
-- que la sincérité de l'appelant. Ici, la base lit sa propre horloge dans son propre fuseau, et
-- l'ordonnanceur n'a aucun moyen de lui faire croire qu'il est huit heures.
create function public.socle_quotidien_du(p_limite integer)
returns table(utilisatrice_id uuid, jour text)
language sql
stable
security definer
set search_path = ''
as $$
  select ps.utilisatrice_id,
         to_char((now() at time zone 'Europe/Paris')::date, 'YYYY-MM-DD')
    from public.preference_socle ps
   where ps.heure = extract(hour from (now() at time zone 'Europe/Paris'))::smallint
     -- Minorité, consentement art. 9 vivant, AD-17 — en UNE clause SQL non contournable. Et PAS de
     -- condition premium : le socle est le tronc gratuit (FR-088).
     and public.personne_joignable(ps.utilisatrice_id)
     -- Le refus de canal (art. 21, 0034) vaut pour TOUTES les notifications produit, courriel comme
     -- poussée : l'opposition porte sur le traitement, pas sur le transport qui le porte. La retenir
     -- ici plutôt qu'à la réservation n'est pas un doublon — c'est une PLACE de lot qui ne se perd
     -- pas pour quelqu'un que le canal refusera de toute façon (leçon de la revue 4.10).
     and not exists (select 1 from public.preference_courriel pc
                      where pc.utilisatrice_id = ps.utilisatrice_id and pc.refuse_le is not null)
     -- Au moins un appareil. Sans abonnement, il n'y a rien à pousser — et occuper une place du lot
     -- pour ne rien faire, sans rattrapage, c'est perdre la journée de quelqu'un d'autre.
     and exists (select 1 from public.abonnement_poussee ap
                  where ap.utilisatrice_id = ps.utilisatrice_id)
     -- Déjà servie aujourd'hui. `reserver_notification` le dirait aussi, mais trop tard : la place
     -- serait consommée. Même raison que ci-dessus.
     and not exists (select 1 from public.notification_envoyee n
                      where n.utilisatrice_id = ps.utilisatrice_id
                        and n.motif = 'socle_quotidien'
                        and n.cle   = to_char((now() at time zone 'Europe/Paris')::date, 'YYYY-MM-DD'))
   -- ⚠️ PAS `order by utilisatrice_id` — la revue 4.10 a montré que ce tri est une INJUSTICE STABLE :
   -- au-delà du lot, ce sont TOUJOURS les mêmes uuid qui passent, et comme rien n'est rattrapé, les
   -- autres ne sont jamais servies. Jamais. On fait TOURNER : le hachage dépend du jour, donc l'ordre
   -- change chaque jour, et sur la durée personne n'est structurellement lésée.
   order by md5(ps.utilisatrice_id::text || to_char((now() at time zone 'Europe/Paris')::date, 'YYYY-MM-DD'))
   limit p_limite;
$$;
revoke execute on function public.socle_quotidien_du(integer) from public, anon, authenticated;

comment on function public.socle_quotidien_du(integer) is
  'Story 6.2 (AC2) : les personnes dont l''heure choisie est l''heure COURANTE à Paris, une ligne chacune. L''heure se calcule EN BASE et n''est pas un paramètre (leçon de 0046) : sinon la garde « à l''heure choisie » ne garderait plus que la sincérité de l''appelant. AD-17, minorité et consentement vivent dans `personne_joignable` ; aucune condition premium (FR-088, tronc gratuit).';

-- ── LES APPAREILS D'UNE PERSONNE ────────────────────────────────────────────────────────────────────
create function public.endpoints_poussee(p_utilisatrice uuid)
returns table(endpoint text, cle_p256dh text, cle_auth text)
language sql
stable
security definer
set search_path = ''
as $$
  select ap.endpoint, ap.cle_p256dh, ap.cle_auth
    from public.abonnement_poussee ap
   where ap.utilisatrice_id = p_utilisatrice
   order by ap.cree_le asc, ap.id asc;   -- total ET stable (leçon 0033)
$$;
revoke execute on function public.endpoints_poussee(uuid) from public, anon, authenticated;

-- ── OUBLIER UN ENDPOINT MORT ────────────────────────────────────────────────────────────────────────
--
-- Un service de poussée qui répond 404 ou 410 dit que l'abonnement n'existe plus (désinstallation,
-- permission révoquée, navigateur réinitialisé). Sans cette suppression, la table accumule des
-- endpoints morts pour toujours, et chacun consomme du budget de tick à chaque jour — jusqu'à ce que
-- le fan-out n'atteigne plus les vivants. Une fuite lente qui ne se voit qu'au moment où elle fait mal.
create function public.oublier_endpoint_poussee(p_endpoint text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with mort as (
    delete from public.abonnement_poussee where endpoint = p_endpoint returning 1
  )
  select exists (select 1 from mort);
$$;
revoke execute on function public.oublier_endpoint_poussee(text) from public, anon, authenticated;

comment on function public.oublier_endpoint_poussee(text) is
  'Story 6.2 : supprime un abonnement dont le service de poussée a dit 404/410. Sans elle, les endpoints morts s''accumulent et consomment le budget du tick jusqu''à ce que le fan-out n''atteigne plus les vivants.';

-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
-- 6. S'ABONNER — la seule écriture qui doit pouvoir DÉLOGER quelqu'un d'autre
-- ═══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- Le cas qui l'impose, et il est banal : deux comptes sur le même navigateur. Le premier s'abonne, la
-- ligne est posée ; le second s'abonne, et le navigateur lui rend LE MÊME endpoint — c'est le sien, il
-- appartient à l'appareil, pas au compte. L'index unique refuse alors l'insertion, et la seconde
-- personne n'est jamais notifiée. Silencieusement, puisque son navigateur, lui, s'est bien abonné.
--
-- Une policy ne peut pas régler ça : supprimer la ligne de l'autre exige de voir une ligne qui ne lui
-- appartient pas, ce que `abonnement_poussee_proprietaire_retrait` interdit — à raison.
--
-- ⚠️ **CETTE FONCTION N'A PAS DE PARAMÈTRE `p_utilisatrice`, ET C'EST TOUTE SA SÛRETÉ.** Elle lit
-- `auth.uid()`. Il n'existe donc aucune valeur à forger : quelle que soit la façon dont on l'appelle,
-- elle ne peut abonner QUE l'appelante. C'est ce qui permet de la donner à `authenticated` sans
-- rouvrir ce que les policies ferment — la garde n'est pas « la RPC vérifie », elle est « la RPC n'a
-- pas de quoi se tromper ».
--
-- La suppression préalable est un CHANGEMENT DE PROPRIÉTAIRE, pas une fuite : on n'expose rien de
-- l'ancienne propriétaire, on retire un endpoint que son navigateur a de toute façon cessé de servir.
create function public.abonner_poussee(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moi uuid := auth.uid();
begin
  if v_moi is null then
    raise exception 'session_absente';
  end if;

  -- L'appareil change de main. Les contraintes de forme de la table s'appliquent à l'insertion
  -- ci-dessous exactement comme à une écriture directe : cette fonction ne les contourne pas.
  delete from public.abonnement_poussee where endpoint = p_endpoint;

  insert into public.abonnement_poussee (utilisatrice_id, endpoint, cle_p256dh, cle_auth)
  values (v_moi, p_endpoint, p_p256dh, p_auth);

  -- La préférence naît avec le premier abonnement, à l'heure par défaut. Création PARESSEUSE, sur le
  -- patron de `jeton_courriel` (0034) : quelqu'un qui ne s'abonne jamais n'a aucune raison de porter
  -- une préférence de notification. Et la sélection exige cette ligne — sans elle, l'abonnement
  -- n'aurait servi à rien.
  insert into public.preference_socle (utilisatrice_id)
  values (v_moi)
  on conflict (utilisatrice_id) do nothing;
end;
$$;

revoke execute on function public.abonner_poussee(text, text, text) from public, anon;
grant  execute on function public.abonner_poussee(text, text, text) to authenticated;

comment on function public.abonner_poussee(text, text, text) is
  'Story 6.2 : abonne l''APPELANTE (auth.uid(), jamais un paramètre) et déloge l''éventuelle ligne portant le même endpoint — deux comptes sur un même navigateur partagent l''endpoint, qui appartient à l''appareil. Crée paresseusement la préférence d''heure. Les contraintes de forme de la table s''appliquent : la fonction ne les contourne pas.';
