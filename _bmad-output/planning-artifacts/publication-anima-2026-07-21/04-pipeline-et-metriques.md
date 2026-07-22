# 04 — Pipeline de publication & métriques de décision à 3 mois

**Destinataire :** Julian (dev)
**Stack :** Next.js sur Vercel + Supabase (Postgres + Storage)
**Source :** atelier PUBLICATION du 2026-07-21 (`_bmad-output/brainstorming/brainstorm-publication-anima-2026-07-21/.memlog.md`)
**Statut de cadrage :** le pipeline est **repoussé après 4 semaines de publication manuelle**. Ce document est **stagé** : l'Étape 0 commence maintenant, l'Étape 1 ne se code que si son critère de déclenchement est atteint.

---

## ⛔ Contrainte absolue, non négociable

**On n'automatise JAMAIS la publication en pilotant un navigateur ou l'interface Instagram.**

Pas de Puppeteer, pas de Playwright, pas de Selenium, pas d'extension, pas d'app tierce non officielle, pas de « bot » qui se connecte avec les identifiants d'Anima. C'est contraire aux conditions d'utilisation de Meta et la sanction courante est la **suspension du compte**.

Le compte d'Anima **est** le canal de distribution. C'est l'actif. On ne le met pas en jeu pour économiser trois minutes par semaine.

**La publication passe exclusivement par l'API Content Publishing officielle** (Instagram API with Instagram Login). Toute PR qui ajoute une dépendance de type navigateur headless dans ce périmètre est rejetée par principe, sans discussion technique.

---

## 1. Le principe

### 1.1 Ce que le pipeline automatise vraiment

Il automatise **une seule chose, et elle est structurelle : le découplage entre la présence d'Anima et la présence du compte.**

Aujourd'hui, si Anima est en consultation, malade, en vacances, ou simplement lassée en semaine 6 (c'est le mode d'échec normal de tous les dispositifs à la semaine), **le canal s'arrête**. Un canal qui s'arrête à 3 mois rend le point de contrôle ininterprétable : on ne saura pas si l'angle éditorial a échoué ou si c'est le dispositif qui a lâché.

Le pipeline transforme un **coût hebdomadaire érodable** (produire + poster, tous les mercredis, pour toujours) en **coût unique en amont** (session corpus de 4 h, gabarits, kit personnage) **plus ~15 min/semaine de validation en lot**.

Formulé en une phrase : **l'absence d'Anima ne casse plus le canal.**

Corollaire important, et c'est la conséquence technique honnête tirée de l'atelier : **si Anima valide ET poste elle-même, l'API ne sert à rien.** L'API ne devient utile qu'au moment où elle valide **en lot** et où le système publie ensuite **tout seul, au calendrier**. C'est exactement pour ça que l'Étape 1 est conditionnée à un tampon d'avance, et pas à une date.

### 1.2 Ce que le pipeline n'automatise PAS

| Non automatisé | Pourquoi |
| --- | --- |
| **L'écriture** | Les brouillons sont générés *depuis le corpus d'Anima*, pas depuis rien. Le corpus est (a) l'actif défendable du projet, (b) la seule réponse à la peur du charlatan (frein n°1, 92 % chez les 25-34 ans), (c) une protection algorithmique contre la règle Instagram du 30 avril 2026 sur le contenu non-original. Un contenu IA générique tombe sous cette règle et sort des recommandations. |
| **Le jugement** | **Aucune publication ne part sans un « oui » humain explicite et horodaté.** C'est un invariant de sécurité au même titre que l'interdiction du navigateur headless. Ce n'est pas une politique éditoriale, c'est un garde-fou (§6). |
| **Les reels** | L'API ne donne **pas** accès au catalogue sonore d'Instagram. Un reel avec son tendance **doit** se publier à la main. On ne cherche pas à contourner : on assume que les reels restent manuels. (Ils sont de toute façon repoussés : à 1-5 K abonnés, le carrousel fait ~1,7× les vues du reel — 993 vs 580, Socialinsider.) |
| **La réponse aux DM et commentaires** | C'est la relation. C'est le métier d'Anima. Zéro automatisation. |
| **La lecture des métriques** | Le pipeline collecte. L'interprétation est humaine, et §7 explique pourquoi c'est le point le plus facile à rater. |

---

## 2. L'architecture en 3 étapes

Chaque étape a un **critère de déclenchement**. Tant que le critère n'est pas rempli, coder l'étape est du gold-plating : ça coûte du temps de dev et ça ne produit aucun post supplémentaire.

### ÉTAPE 0 — Semaines 1 à 4 : tout à la main

**Déclenchement :** maintenant.

**Ce qui se passe :** Julian (ou Claude) produit les visuels et les légendes, les envoie à Anima, Anima poste elle-même depuis son téléphone. Zéro API. Zéro cron.

**Ce qu'on construit quand même — et seulement ça :**

1. **Le schéma de données complet** (§3). Il est écrit intégralement dès maintenant, même si seules les colonnes `statut`, `legende`, `medias` servent en semaine 1. Raison : migrer 60 posts existants d'un Google Sheet vers Postgres coûte plus cher que de créer les bonnes tables tout de suite.
2. **Le stockage des brouillons** : bucket Supabase Storage + lignes `post` / `post_media`. Même à la main, les visuels vivent là, pas dans un dossier iCloud.
3. **La file de validation** (§5) : une page. Anima ouvre, elle voit les cartes, elle valide ou elle biffe. En Étape 0 la validation ne déclenche rien — elle marque juste le post `approved` et Anima le poste ensuite. C'est délibéré : **on rode le geste humain avant de brancher la machine dessus.**
4. **La saisie manuelle des métriques.** Quatre chiffres par post relevés dans l'app Instagram (portée, partages, enregistrements, portée non-abonnés), tapés dans une table. 3 minutes par semaine. Ça construit la **ligne de base** sans laquelle les seuils de §7 ne veulent rien dire.

**Ce qu'on ne construit surtout pas :** l'app Meta, l'ordonnanceur, la reprise sur erreur. Rien de tout ça ne produit un post de plus en semaine 2.

**Critère de sortie vers l'Étape 1 — les trois conditions, cumulatives :**

- ≥ **12 publications** effectivement postées (soit 4 semaines à 3/semaine) ;
- un **tampon de ≥ 3 semaines** de contenu validé d'avance existe réellement dans la base (c'est le seul truc que le cron peut publier — sans tampon, l'ordonnanceur n'a rien à faire) ;
- **Anima a tenu 4 sessions de validation sur 4.** Si elle en a sauté deux, le problème n'est pas l'ordonnanceur, c'est le dispositif humain. Le coder maintenant reviendrait à automatiser un vide.

### ÉTAPE 1 — Publication automatique des carrousels au calendrier

**Déclenchement :** les trois conditions de sortie de l'Étape 0.

**Périmètre :** Instagram uniquement, carrousels et images uniquement. Les reels restent manuels (contrainte son).

**Composants :**

- **App Meta** en mode développement, compte d'Anima en rôle testeur (§4) ;
- **Stockage des médias** : Supabase Storage, bucket public à chemins non devinables — l'API Meta doit pouvoir **télécharger l'image par URL publique** ;
- **File de publication** : `post.scheduled_at` + `post.statut = 'approved'` ;
- **Ordonnanceur** : Vercel Cron toutes les 15 min (voir arbitrage ci-dessous) ;
- **Journal** : `publish_attempt`, une ligne par tentative, jamais écrasée ;
- **Reprise sur erreur** : backoff exponentiel, distinction erreur transitoire / permanente, verrou anti-double-publication (§6.4).

#### Arbitrage ordonnanceur : Vercel Cron vs GitHub Actions

| | **Vercel Cron** | **GitHub Actions (`schedule`)** |
| --- | --- | --- |
| Granularité | Minute (plan Pro). **Plan Hobby : 1 déclenchement/jour max, 2 crons.** | `*/15 * * * *` accepté, mais **dérive réelle de 5 à 20 min** en heure chargée, et exécutions parfois sautées |
| Env/secrets | Déjà là — mêmes variables que l'app, mêmes clés Supabase | À redéclarer dans les secrets du repo, deuxième endroit à maintenir |
| Auth | Vercel envoie `Authorization: Bearer $CRON_SECRET` automatiquement | À implémenter à la main |
| Durée max | Limite de la fonction (`maxDuration`, 60 s Hobby / 300 s Pro) | 6 h |
| Observabilité | Logs Vercel, au même endroit que le reste | Onglet Actions, séparé |
| Coût | Inclus (Pro : 20 $/mois) | Gratuit sur repo public, minutes gratuites sur privé |
| Piège | Hobby = daily only, rédhibitoire ici | Un repo sans commit pendant 60 jours voit ses crons **désactivés automatiquement** |

**Recommandation : Vercel Cron, sur le plan Pro.**

Raisons : (1) les créneaux visés sont mardi/mercredi 12 h-14 h et 18 h-21 h — une dérive de 20 min sur un créneau de 2 h est tolérable, mais la dérive de GitHub Actions est *non bornée* et des exécutions sautées sont documentées ; (2) l'unicité du plan de déploiement compte plus que 20 $/mois quand on est seul à maintenir ; (3) la désactivation automatique des Actions sur repo dormant est exactement le mode d'échec silencieux qu'on veut éviter sur un canal de distribution.

**Si le plan Pro n'est pas pris :** GitHub Action qui fait un simple `curl` authentifié vers la route Vercel. La logique reste dans le repo Next.js, l'Action n'est qu'un déclencheur. On peut basculer de l'un à l'autre sans toucher au code métier.

**Dans les deux cas, le cron ne « publie pas à 12 h 30 ».** Il tourne toutes les 15 min et demande : *y a-t-il un post approuvé dont `scheduled_at` est passé et qui n'est pas encore publié ?* Ce modèle « scan de file » est robuste à une exécution sautée — le post part 15 min plus tard, il ne se perd pas. Un modèle « un cron par créneau » perd le post.

**Critère de sortie vers l'Étape 2 :** 4 semaines de publications automatiques **sans incident** (aucun doublon, aucun post parti sans validation, aucune expiration de token subie).

### ÉTAPE 2 — Cross-post TikTok + production assistée

**Déclenchement :** critère de sortie de l'Étape 1 rempli, ET la mesure à 3 mois donne un « on continue » (§7.3).

**2a — Cross-post TikTok.** Le carrousel Instagram *est* un post photo TikTok. Coût marginal quasi nul, et TikTok a sa propre **Content Posting API** (endpoints `/v2/post/publish/content/init/` puis `/v2/post/publish/status/fetch/`). Ça compte parce que les mesures directes du 21/07/2026 montrent que **les mêmes créateurs francophones pèsent 4× à 32× plus sur TikTok que sur Instagram** dans ce créneau. L'actif existant est sur Instagram, la croissance mesurée est sur TikTok. On ne choisit pas : on publie sur les deux et **on laisse la mesure trancher à 3 mois**.

Implémentation : la table `publication` (§3) est déjà multi-plateforme. Le cross-post ajoute un *adapter*, pas une architecture.

⚠️ TikTok a une contrainte que Meta n'a pas : tant que l'app n'est pas auditée, les posts sont publiés **en privé / brouillon** (`SELF_ONLY`). À vérifier au moment de coder — ça peut transformer le cross-post en « dépôt de brouillon dans l'app TikTok qu'Anima publie d'un tap ». Ce qui reste un gain.

**2b — Production assistée.** Une **routine Claude Code planifiée** qui, chaque lundi :
1. lit le corpus d'Anima et la grille éditoriale (séries L'EAU / ELLE M'A DEMANDÉ / TON THÈME NE DIT PAS ÇA) ;
2. lit les métriques des 4 dernières semaines pour savoir ce qui a marché ;
3. génère les brouillons de la semaine (textes de cartes + légende + CTA) ;
4. les **dépose en `pending_review`** dans la base — jamais en `approved`.

Elle ne publie rien. Elle remplit la file. Anima garde le dernier mot.

---

## 3. Le schéma de données

Postgres / Supabase. À poser dans une migration dès l'Étape 0.

```sql
-- ============================================================
-- 00_types.sql — énumérations
-- ============================================================
create type post_statut as enum (
  'draft',          -- brouillon en cours de production
  'pending_review', -- déposé dans la file de validation d'Anima
  'approved',       -- validé par Anima, publiable
  'rejected',       -- biffé par Anima
  'scheduled',      -- approuvé + date fixée (état dérivé, voir contrainte)
  'publishing',     -- verrou pris par un worker
  'published',      -- au moins une plateforme OK
  'failed'          -- épuisement des tentatives
);

create type plateforme as enum ('instagram', 'tiktok');
create type media_type as enum ('image', 'video');
create type serie_edito as enum ('eau', 'elle_m_a_demande', 'ton_theme_ne_dit_pas_ca', 'energies_du_mois', 'hors_serie');

-- ============================================================
-- 01_post.sql — l'unité éditoriale
-- ============================================================
create table post (
  id              uuid primary key default gen_random_uuid(),
  serie           serie_edito not null,
  titre_interne   text not null,                 -- jamais publié, sert à s'y retrouver
  legende         text not null,                 -- < 30 mots : les légendes courtes surperforment
  cta             text,                          -- « envoie ça à quelqu'un » — voir §6.2
  statut          post_statut not null default 'draft',

  -- planification
  scheduled_at    timestamptz,                   -- null = pas encore planifié
  plateformes     plateforme[] not null default '{instagram}',

  -- validation humaine (invariant : rien ne part sans ces 2 colonnes remplies)
  validated_by    text,                          -- 'anima' | 'julian'
  validated_at    timestamptz,
  note_validation text,                          -- motif si biffé

  -- provenance : d'où vient le texte, pour l'audit anti-charlatan
  source_corpus   text,                          -- réf. de l'extrait de corpus utilisé
  genere_par      text not null default 'humain',-- 'humain' | 'claude-code'

  -- verrou de publication (anti double-post)
  lock_token      uuid,
  locked_until    timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- ⛔ GARDE-FOU DUR : impossible de planifier un post non validé
  constraint chk_validation_avant_planif check (
    scheduled_at is null
    or (validated_at is not null and validated_by is not null and statut <> 'rejected')
  )
);

create index idx_post_file_publication
  on post (scheduled_at)
  where statut in ('approved','scheduled') and scheduled_at is not null;

-- ============================================================
-- 02_post_media.sql — les cartes du carrousel
-- ============================================================
create table post_media (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references post(id) on delete cascade,
  position      smallint not null,               -- 1..10, l'ordre des slides
  type          media_type not null default 'image',
  storage_path  text not null,                   -- chemin dans le bucket Supabase
  public_url    text not null,                   -- URL que Meta va télécharger
  alt_text      text,                            -- accessibilité + indexation
  texte_carte   text,                            -- le texte imprimé sur la slide (sert au contrôle lexical)
  largeur       int,
  hauteur       int,
  octets        bigint,
  created_at    timestamptz not null default now(),

  unique (post_id, position),
  constraint chk_position check (position between 1 and 10),   -- carrousel : 10 médias max
  constraint chk_poids check (octets is null or octets <= 8 * 1024 * 1024)  -- 8 Mo max côté Meta
);

-- ============================================================
-- 03_publication.sql — une ligne par (post, plateforme)
-- ============================================================
create table publication (
  id             uuid primary key default gen_random_uuid(),
  post_id        uuid not null references post(id) on delete cascade,
  plateforme     plateforme not null,
  statut         text not null default 'pending',  -- pending | ok | error
  external_id    text,                             -- IG media id / TikTok publish id
  permalink      text,
  container_id   text,                             -- IG : creation_id du conteneur
  published_at   timestamptz,
  created_at     timestamptz not null default now(),

  -- ⛔ garantit qu'un post ne peut pas partir deux fois sur la même plateforme
  unique (post_id, plateforme)
);

-- ============================================================
-- 04_publish_attempt.sql — le journal, append-only
-- ============================================================
create table publish_attempt (
  id             bigserial primary key,
  post_id        uuid not null references post(id) on delete cascade,
  plateforme     plateforme not null,
  tentative      smallint not null,
  etape          text not null,        -- 'container' | 'container_status' | 'publish' | 'guardrail'
  ok             boolean not null,
  http_status    int,
  code_erreur    text,                 -- code Meta : 190, 4, 9007, 2207xxx…
  message        text,
  payload        jsonb,                -- requête envoyée, secrets retirés
  reponse        jsonb,
  duree_ms       int,
  created_at     timestamptz not null default now()
);

create index idx_attempt_post on publish_attempt (post_id, created_at desc);

-- ============================================================
-- 05_metrique.sql — une ligne par (publication, date de relevé)
-- ============================================================
create table metrique (
  id                  bigserial primary key,
  publication_id      uuid not null references publication(id) on delete cascade,
  releve_at           timestamptz not null default now(),
  age_heures          int not null,        -- âge du post au moment du relevé (24 / 72 / 168 / 720)

  reach               int,                 -- portée (comptes touchés)
  reach_non_abonnes   int,                 -- portée non-abonnés (breakdown follow_type)
  sends               int,                 -- PARTAGES EN DM — la métrique pilote (§7)
  saves               int,
  likes               int,
  comments            int,
  profile_visits      int,
  follows             int,                 -- abonnements générés par ce post
  views               int,

  source              text not null default 'api',  -- 'api' | 'manuel' (Étape 0)

  unique (publication_id, age_heures)
);

-- ratios calculés : on ne les stocke pas, on les dérive (voir vue §7.6)

-- ============================================================
-- 06_lexique_interdit.sql — le garde-fou éditorial (anam-voice §11)
-- ============================================================
create table lexique_interdit (
  id        serial primary key,
  motif     text not null,        -- expression régulière, insensible à la casse
  categorie text not null,        -- 'sante' | 'clinique' | 'promesse' | 'quantification' | 'verdict'
  gravite   text not null default 'bloquant',  -- 'bloquant' | 'alerte'
  remplacement_suggere text
);

insert into lexique_interdit (motif, categorie, gravite, remplacement_suggere) values
  ('\mgu[ée]ri(r|son|t)\M',        'sante',          'bloquant', 'avancer'),
  ('\msoign(er|e|ent)\M',          'sante',          'bloquant', 'accompagner'),
  ('\mtrait(er|ement)\M',          'sante',          'bloquant', 'regarder ce qui se répète'),
  ('\mth[ée]rap(ie|eutique|eute)\M','sante',         'bloquant', 'accompagnement'),
  ('\md[ée]pression?\M',           'clinique',       'bloquant', null),
  ('\manxi[ée]t[ée]\M',            'clinique',       'bloquant', null),
  ('\mtrouble(s)?\M',              'clinique',       'bloquant', null),
  ('\mdiagnostic\M',               'clinique',       'bloquant', 'hypothèse'),
  ('\msympt[ôo]me(s)?\M',          'clinique',       'bloquant', 'ça revient souvent'),
  ('\msant[ée] mentale\M',         'sante',          'bloquant', 'bien-être'),
  ('\mpathologie\M',               'clinique',       'bloquant', null),
  ('\msyndrome\M',                 'clinique',       'bloquant', null),
  ('\mburn.?out\M',                'clinique',       'alerte',   'épuisement (usage non médical uniquement)'),
  ('\mtraumatisme\M',              'clinique',       'alerte',   null),
  ('\mrechute\M',                  'clinique',       'bloquant', null),
  ('\msoulager\M',                 'sante',          'bloquant', null),
  ('\mprescri(re|t)\M',            'sante',          'bloquant', null),
  ('\mprendre en charge\M',        'sante',          'bloquant', 'accompagner'),
  ('\mtu iras mieux\M',            'promesse',       'bloquant', null),
  ('\m[çc]a va passer\M',          'promesse',       'bloquant', null),
  ('\mtu seras plus heureuse\M',   'promesse',       'bloquant', null),
  ('r[ée]dui(re|t) (ton|votre|le) stress', 'quantification', 'bloquant', null),
  ('am[ée]liore(r)? (ton|votre|le) sommeil','quantification','bloquant', null),
  ('\mtoxique\M',                  'verdict',        'bloquant', 'décrire le comportement, pas la personne'),
  ('\md[ée]pendance affective\M',  'verdict',        'bloquant', 'décrire le schéma qui se répète'),
  ('\mpervers narcissique\M',      'verdict',        'bloquant', null);

-- ============================================================
-- 07_meta_token.sql — le token longue durée (§4)
-- ============================================================
create table meta_token (
  id            smallint primary key default 1,
  plateforme    plateforme not null default 'instagram',
  access_token  text not null,               -- chiffré au repos, jamais exposé côté client
  ig_user_id    text not null,
  expires_at    timestamptz not null,
  refreshed_at  timestamptz not null default now(),
  refresh_count int not null default 0,
  constraint singleton check (id = 1)
);

alter table meta_token enable row level security;  -- aucune policy = aucun accès via anon key
alter table post          enable row level security;
alter table post_media    enable row level security;
alter table publication   enable row level security;
alter table publish_attempt enable row level security;
alter table metrique      enable row level security;
```

> **RLS :** toutes les tables sont en RLS **sans policy** — donc inaccessibles avec la clé `anon`. Le pipeline (routes cron) utilise la `service_role` key côté serveur uniquement. La file de validation (§5) passe par des Server Actions Next.js authentifiées, jamais par le client Supabase dans le navigateur. La `service_role` key ne doit **jamais** apparaître dans une variable `NEXT_PUBLIC_*`.

---

## 4. La mise en place Meta, pas à pas

### 4.1 Ce qu'on utilise, et pourquoi ça simplifie tout

**Instagram API with Instagram Login** (et non pas Instagram API with Facebook Login).

Conséquences vérifiées :
- **Pas besoin d'une Page Facebook.** Le compte Instagram professionnel suffit.
- Permissions requises : `instagram_business_basic` + `instagram_business_content_publish`. (Ajouter `instagram_business_manage_insights` pour la collecte de métriques de §7.)
- **Pas d'App Review Meta**, parce que l'app reste en **mode développement** et que le compte d'Anima y est en **rôle testeur**. En mode dev, une app n'accède qu'aux comptes ayant un rôle dans l'app — et c'est exactement notre besoin : on n'accède qu'au compte d'Anima. L'App Review devient nécessaire seulement le jour où on voudrait faire publier des comptes tiers. Ce jour n'arrivera pas.
- Limite : **100 publications par 24 h glissantes**. À 3 posts/semaine, non contraignant.
- Un carrousel de 10 médias = **1** publication au compteur.

### 4.2 La procédure

1. **Compte Instagram** : vérifier qu'il est bien en **Professionnel** (Créateur ou Entreprise). Un compte personnel ne peut pas publier par API.
2. **developers.facebook.com** → Créer une app → type **« Autre »** → cas d'usage **« Instagram »**.
3. Dans l'app → produit **Instagram** → **API setup with Instagram login**.
4. Relever l'**Instagram App ID** et l'**Instagram App Secret** (≠ App ID/Secret Facebook — c'est un piège fréquent).
5. **Rôles** → **Testeurs Instagram** → ajouter `@anima_retourasoi`.
6. Anima accepte l'invitation : Instagram → Paramètres → Applications et sites web → **Invitations de testeur** → Accepter. **Tant que ce clic n'a pas eu lieu, rien ne marchera** et le message d'erreur ne le dira pas clairement.
7. **URI de redirection OAuth** : `https://<domaine>/api/meta/callback`.
8. Faire une fois le flux OAuth pour obtenir un code, l'échanger contre un **token courte durée (1 h)**, puis l'échanger contre un **token longue durée (60 jours)**.
9. Récupérer l'`ig_user_id` : `GET https://graph.instagram.com/v23.0/me?fields=id,username`.
10. Stocker `access_token`, `ig_user_id`, `expires_at` dans `meta_token`.

### 4.3 ⚠️ Le piège n°1 : l'expiration à 60 jours

**C'est LE point qui casse ce genre de pipeline**, et il casse *silencieusement*, deux mois après la mise en prod, quand plus personne n'y pense. Le symptôme : `error.code = 190`, et les posts ne partent plus. Personne ne s'en aperçoit avant une semaine.

Trois défenses, toutes les trois obligatoires :

1. **Rafraîchissement automatique.** Un token longue durée peut être rafraîchi (nouveau token de 60 jours) **à condition d'avoir au moins 24 h d'âge**. On rafraîchit tous les jours dès que `expires_at - now() < 30 jours`. Un token rafraîchi tous les jours ne peut mathématiquement jamais expirer.
2. **Alerte avant expiration.** Si `expires_at - now() < 10 jours`, e-mail/notification à Julian, tous les jours, jusqu'à résolution.
3. **Le rafraîchissement est monitoré comme un job critique.** Un rafraîchissement qui échoue 3 jours de suite = alerte de niveau supérieur. Un cron silencieux qui échoue est pire que pas de cron.

```ts
// app/api/cron/refresh-token/route.ts
// Vercel Cron : "0 4 * * *" (tous les jours, 4h)
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,   // jamais NEXT_PUBLIC_
);

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('unauthorized', { status: 401 });
  }

  const { data: tok } = await db.from('meta_token').select('*').eq('id', 1).single();
  if (!tok) return NextResponse.json({ error: 'no token' }, { status: 500 });

  const joursRestants = (new Date(tok.expires_at).getTime() - Date.now()) / 86_400_000;

  // Alerte : on prévient AVANT que ça casse.
  if (joursRestants < 10) {
    await alerte(
      `⚠️ Token Instagram : ${joursRestants.toFixed(1)} jours restants.`,
      joursRestants < 3 ? 'critique' : 'haute',
    );
  }

  // Rien à faire si on est encore loin.
  if (joursRestants > 30) {
    return NextResponse.json({ skip: true, joursRestants });
  }

  const url = new URL('https://graph.instagram.com/refresh_access_token');
  url.searchParams.set('grant_type', 'ig_refresh_token');
  url.searchParams.set('access_token', tok.access_token);

  const res = await fetch(url, { cache: 'no-store' });
  const json = await res.json();

  if (!res.ok || !json.access_token) {
    await alerte(`❌ Échec du refresh token Instagram : ${JSON.stringify(json)}`, 'critique');
    return NextResponse.json({ error: json }, { status: 500 });
  }

  await db.from('meta_token').update({
    access_token:  json.access_token,
    expires_at:    new Date(Date.now() + json.expires_in * 1000).toISOString(),
    refreshed_at:  new Date().toISOString(),
    refresh_count: tok.refresh_count + 1,
  }).eq('id', 1);

  return NextResponse.json({ ok: true, expires_in_days: json.expires_in / 86400 });
}
```

L'échange initial courte durée → longue durée, à faire une fois :

```bash
# 1. code OAuth -> token courte durée (1h)
curl -X POST https://api.instagram.com/oauth/access_token \
  -F client_id=$IG_APP_ID \
  -F client_secret=$IG_APP_SECRET \
  -F grant_type=authorization_code \
  -F redirect_uri=https://<domaine>/api/meta/callback \
  -F code=<CODE>

# 2. courte durée -> longue durée (60 jours)
curl -G https://graph.instagram.com/access_token \
  -d grant_type=ig_exchange_token \
  -d client_secret=$IG_APP_SECRET \
  -d access_token=<SHORT_LIVED_TOKEN>
```

### 4.4 Le flux de publication

Deux appels pour une image simple, N+2 pour un carrousel.

```ts
// lib/instagram.ts
const BASE = 'https://graph.instagram.com/v23.0';

type IgError = { code: number; message: string; error_subcode?: number };

async function ig(path: string, params: Record<string, string>, token: string) {
  const body = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    body,
    cache: 'no-store',
  });
  const json = await res.json();
  if (!res.ok) {
    const e = json.error as IgError;
    throw Object.assign(new Error(e?.message ?? 'erreur IG'), {
      code: e?.code, subcode: e?.error_subcode, http: res.status, json,
    });
  }
  return json;
}

/** Étape 1 : un conteneur par slide (is_carousel_item=true) */
export async function creerItemCarrousel(igId: string, token: string, imageUrl: string) {
  const r = await ig(`/${igId}/media`, {
    image_url: imageUrl,
    is_carousel_item: 'true',
  }, token);
  return r.id as string;
}

/** Étape 2 : le conteneur parent, qui référence les enfants dans l'ordre */
export async function creerConteneurCarrousel(
  igId: string, token: string, enfants: string[], legende: string,
) {
  if (enfants.length < 2 || enfants.length > 10) {
    throw new Error(`carrousel : 2 à 10 médias, reçu ${enfants.length}`);
  }
  const r = await ig(`/${igId}/media`, {
    media_type: 'CAROUSEL',
    children: enfants.join(','),
    caption: legende,
  }, token);
  return r.id as string;
}

/** Étape 3 : attendre que le conteneur soit FINISHED (Meta télécharge les images) */
export async function attendreConteneur(containerId: string, token: string, timeoutMs = 60_000) {
  const t0 = Date.now();
  let delai = 1500;
  while (Date.now() - t0 < timeoutMs) {
    const res = await fetch(
      `${BASE}/${containerId}?fields=status_code,status&access_token=${token}`,
      { cache: 'no-store' },
    );
    const { status_code, status } = await res.json();
    if (status_code === 'FINISHED') return true;
    if (status_code === 'ERROR' || status_code === 'EXPIRED') {
      throw new Error(`conteneur ${status_code} : ${status}`);
    }
    await new Promise(r => setTimeout(r, delai));
    delai = Math.min(delai * 1.6, 8000);
  }
  throw new Error('conteneur non prêt après 60 s');
}

/** Étape 4 : publier */
export async function publier(igId: string, token: string, creationId: string) {
  const r = await ig(`/${igId}/media_publish`, { creation_id: creationId }, token);
  return r.id as string;   // media id définitif
}
```

> **Deux points à ne pas rater.** (1) `image_url` doit être **publiquement accessible** : les serveurs de Meta téléchargent l'image, ils ne reçoivent pas d'upload. D'où Supabase Storage en bucket public. (2) Un conteneur créé **expire au bout de 24 h** s'il n'est pas publié. Un post bloqué en `publishing` depuis plus de 24 h doit repartir d'un conteneur neuf, pas réessayer l'ancien.

---

## 5. La file de validation

### 5.1 Le cahier des charges tient en une phrase

**Anima ouvre un lien sur son téléphone, voit les posts de la semaine à venir, et pour chacun : elle valide, ou elle biffe.** 15 minutes, une fois par semaine. Pas de compte, pas de mot de passe à retenir, pas de menu.

Tout ce qui s'ajoute à ça la fera décrocher en semaine 6. C'est la contrainte de conception dominante — plus importante que n'importe quelle élégance technique.

### 5.2 Ce qu'elle voit

Une page, `/valider`, une carte par post empilée verticalement :

- **le carrousel tel qu'il sortira** — swipe horizontal, vraies images, pas une liste de fichiers ;
- **la légende** telle qu'elle paraîtra, et le CTA ;
- **la date et l'heure de publication prévues**, en clair : « mercredi 29 juillet, 18 h 30 » ;
- **la série** (L'eau / Elle m'a demandé / Ton thème ne dit pas ça) en petit badge ;
- **deux boutons, gros, l'un à côté de l'autre : ✅ Publier — ✏️ Biffer** ;
- si elle biffe : un champ libre, une ligne, optionnel. « Pourquoi ? » Ça alimente le corpus et corrige la génération.
- un **bandeau d'alerte rouge** si le contrôle lexical a levé un drapeau (§6.1) — le post est alors non validable tant que le texte n'est pas corrigé.

En bas de page, une seule ligne d'information : **« Tampon : 3 semaines et 2 jours d'avance. »** C'est le seul chiffre qu'on lui montre. S'il passe sous 2 semaines il devient orange, sous 1 semaine rouge — et Julian reçoit l'alerte, pas elle.

### 5.3 Ce qu'elle ne voit pas

Pas de métriques. Pas de graphiques. Pas d'historique. Pas de réglages. Pas de champ « heure de publication » à modifier. Un post qu'elle valide est publié à la date prévue, point. Si la date ne va pas, elle biffe et le dit.

**Raison :** lui montrer les chiffres de performance transformerait la validation en évaluation de soi, et c'est le mécanisme exact qui fait abandonner. La lecture des métriques est le travail de Julian, à §7, une fois par mois.

### 5.4 Accès

Lien magique par e-mail (Supabase Auth, magic link), session longue durée. Elle clique le lien une fois, elle reste connectée sur son téléphone. Un rappel automatique le lundi matin avec le lien direct.

### 5.5 L'action de validation

```ts
// app/valider/actions.ts
'use server';
import { revalidatePath } from 'next/cache';
import { db, requireAnima } from '@/lib/server';
import { controlerLexique } from '@/lib/lexique';

export async function validerPost(postId: string) {
  const user = await requireAnima();   // 401 si session absente ou non autorisée

  const { data: post } = await db
    .from('post')
    .select('*, post_media(*)')
    .eq('id', postId)
    .single();

  if (!post) throw new Error('post introuvable');
  if (post.statut !== 'pending_review') throw new Error(`statut inattendu : ${post.statut}`);

  // GARDE-FOU : le contrôle lexical repasse ICI, même s'il a déjà tourné à la génération.
  const violations = await controlerLexique(post);
  if (violations.some(v => v.gravite === 'bloquant')) {
    throw new Error(`lexique interdit : ${violations.map(v => v.extrait).join(', ')}`);
  }

  await db.from('post').update({
    statut:       'approved',
    validated_by: user.email,
    validated_at: new Date().toISOString(),
  }).eq('id', postId).eq('statut', 'pending_review');   // update conditionnel : anti-course

  revalidatePath('/valider');
}

export async function bifferPost(postId: string, motif?: string) {
  const user = await requireAnima();
  await db.from('post').update({
    statut:          'rejected',
    validated_by:    user.email,
    validated_at:    new Date().toISOString(),
    note_validation: motif ?? null,
    scheduled_at:    null,
  }).eq('id', postId);
  revalidatePath('/valider');
}
```

---

## 6. Les garde-fous

### 6.1 Contrôle du lexique interdit, AVANT publication

Il tourne **trois fois** — à la génération, à la validation, et juste avant l'appel à l'API. Redondant volontairement : c'est le seul contrôle qui protège d'une allégation de santé publiée sous le nom d'une praticienne réelle.

Il porte sur **la légende, le CTA, et le texte de chaque carte** (`post_media.texte_carte`) — pas seulement la légende. Une allégation imprimée sur une image est aussi publiée qu'une allégation en texte.

```sql
-- Fonction SQL : renvoie les violations d'un post, en une requête.
create or replace function controler_lexique(p_post_id uuid)
returns table (champ text, extrait text, categorie text, gravite text, remplacement text)
language sql stable as $$
  with textes as (
    select 'legende' as champ, legende as t from post where id = p_post_id
    union all
    select 'cta', cta from post where id = p_post_id and cta is not null
    union all
    select 'carte_' || position, texte_carte
      from post_media where post_id = p_post_id and texte_carte is not null
  )
  select t.champ,
         (regexp_matches(unaccent(lower(t.t)), l.motif, 'g'))[1],
         l.categorie, l.gravite, l.remplacement_suggere
  from textes t
  join lexique_interdit l
    on unaccent(lower(t.t)) ~* l.motif;
$$;
```

> `unaccent` (extension Postgres, `create extension if not exists unaccent;`) évite qu'un « depression » sans accent passe à travers. Les motifs sont écrits sans accent côté base.

**Comportement :**
- `gravite = 'bloquant'` → le post ne peut ni être validé ni être publié. Erreur explicite affichée à Anima avec le mot fautif surligné et la reformulation suggérée.
- `gravite = 'alerte'` → le post est validable, mais la file affiche un bandeau orange. Anima tranche.

### 6.2 Aucune publication ne part sans validation humaine

Trois verrous indépendants, à trois niveaux différents. Un seul suffirait ; on en met trois parce que c'est l'invariant dont la violation est la plus coûteuse (contenu spirituel non relu publié sous le nom d'une praticienne réelle, sur un marché où la peur du charlatan est le frein n°1 à 92 %).

1. **Contrainte SQL** — `chk_validation_avant_planif` : `scheduled_at` non nul impose `validated_at` et `validated_by` non nuls. La base refuse physiquement de planifier un post non validé.
2. **Requête de la file** — le worker ne sélectionne que `statut = 'approved' AND validated_at IS NOT NULL`.
3. **Assertion applicative** — juste avant l'appel API, un `if (!post.validated_at) throw`. Une assertion redondante qui ne se déclenche jamais est une assertion qui a fait son travail.

### 6.3 Limite de débit

La limite Meta (100 pub / 24 h glissantes) n'est pas contraignante à 3 posts/semaine. Le vrai risque est une **boucle de retry emballée** qui brûlerait le quota ou déclencherait un throttling applicatif.

- Le worker publie **au maximum 1 post par exécution** (toutes les 15 min → plafond structurel de 96/jour, en dessous de la limite Meta).
- Garde-fou explicite : refuser si `count(publications sur 24 h glissantes) >= 25`. Un dépassement signale un bug, pas un besoin.
- Surveiller l'en-tête `x-app-usage` sur les réponses. Au-delà de 80 % sur n'importe quel compteur, pause d'une heure.

### 6.4 Quoi faire quand l'API renvoie une erreur

Deux familles, deux comportements. **Ne jamais réessayer une erreur permanente** — c'est comme ça qu'on brûle un quota et qu'on se fait remarquer.

| Code | Signification | Nature | Action |
| --- | --- | --- | --- |
| `190` | Token invalide / expiré | **Permanente** | Arrêt immédiat de la file, alerte critique. Ne pas réessayer : ça n'a aucune chance de marcher et ça ressemble à du brute force. |
| `4`, `17`, `32`, `613` | Rate limit applicatif ou utilisateur | Transitoire | Pause 1 h, puis reprise. Pas de retry serré. |
| `9007` | Média pas encore prêt | Transitoire | Attendre, re-sonder le conteneur (déjà géré par `attendreConteneur`). |
| `2207003` / `2207020` | Meta n'a pas pu télécharger le média | Permanente (côté nous) | Vérifier que `public_url` est bien joignable en anonyme. Alerte, pas de retry. |
| `2207032` / `2207001` | Création de conteneur échouée | Transitoire | 3 tentatives avec backoff, puis échec. |
| `2207050` | Compte inéligible (compte perso ?) | Permanente | Alerte, arrêt. Vérifier que le compte est bien Professionnel. |
| `HTTP 5xx` / timeout | Panne côté Meta | Transitoire | Backoff exponentiel : 1 min, 4 min, 15 min, 1 h. Max 5 tentatives sur 24 h. |
| Échec **après** `media_publish` (timeout réseau) | Publication peut-être passée | **Ambiguë** | ⚠️ **Ne jamais réessayer aveuglément.** Interroger `GET /{ig_id}/media?fields=id,timestamp,caption&limit=5` et comparer à la légende avant toute nouvelle tentative. Sinon on double-poste. |

Après épuisement des tentatives : `post.statut = 'failed'`, alerte à Julian, **et le post suivant de la file part quand même**. Un post cassé ne doit pas geler le canal.

Le verrou anti-double-publication :

```sql
-- Prise de verrou atomique : un seul worker peut prendre un post donné.
update post
   set statut = 'publishing',
       lock_token = $1,
       locked_until = now() + interval '10 minutes'
 where id = (
   select id from post
    where statut = 'approved'
      and validated_at is not null           -- garde-fou §6.2
      and scheduled_at <= now()
      and (locked_until is null or locked_until < now())
    order by scheduled_at
    limit 1
    for update skip locked                   -- pas de contention entre exécutions concurrentes
 )
returning *;
```

`FOR UPDATE SKIP LOCKED` + `locked_until` : même si deux exécutions du cron se chevauchent (ça arrive), un post ne peut être pris qu'une fois. Et la contrainte `unique (post_id, plateforme)` sur `publication` est le filet de dernier recours : un double-post échouerait en base avant d'atteindre Meta.

### 6.5 Alerte tampon sous 2 semaines

Le tampon (contenu validé d'avance) est **l'indicateur de santé du dispositif**. Il se dégrade lentement et personne ne le remarque jusqu'au jour où il n'y a plus rien à publier.

```sql
create or replace view v_tampon as
select
  count(*) filter (where statut = 'approved' and scheduled_at > now())    as posts_en_avance,
  max(scheduled_at) filter (where statut = 'approved')                    as dernier_planifie,
  extract(epoch from (
    max(scheduled_at) filter (where statut = 'approved') - now()
  )) / 604800                                                             as semaines_avance
from post;
```

Cron quotidien : `semaines_avance < 2` → alerte à **Julian** (production à relancer). `< 1` → alerte critique. `< 3` pendant 7 jours consécutifs → le dispositif dérive, à traiter comme un incident et pas comme un rappel.

**L'alerte va à Julian, jamais à Anima.** Si le tampon baisse, le problème est côté production, pas côté validation. Mettre la pression sur Anima pour un problème qui n'est pas le sien est le meilleur moyen de la faire décrocher.

### 6.6 La route d'ordonnancement, en entier

```ts
// app/api/cron/publier/route.ts
// vercel.json : { "crons": [{ "path": "/api/cron/publier", "schedule": "*/15 * * * *" }] }
import { NextResponse } from 'next/server';
import { db } from '@/lib/server';
import { controlerLexique } from '@/lib/lexique';
import {
  creerItemCarrousel, creerConteneurCarrousel, attendreConteneur, publier,
} from '@/lib/instagram';
import { journaliser, alerte, estTransitoire } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;   // les conteneurs carrousel prennent du temps

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('unauthorized', { status: 401 });
  }

  // 1) Garde-fou de débit (§6.3)
  const { count: publies24h } = await db
    .from('publication')
    .select('*', { count: 'exact', head: true })
    .eq('statut', 'ok')
    .gte('published_at', new Date(Date.now() - 86_400_000).toISOString());
  if ((publies24h ?? 0) >= 25) {
    await alerte(`Débit anormal : ${publies24h} publications en 24 h. File suspendue.`, 'critique');
    return NextResponse.json({ suspendu: true });
  }

  // 2) Prise de verrou atomique — 1 post par exécution
  const lockToken = crypto.randomUUID();
  const { data: post } = await db.rpc('prendre_post_a_publier', { p_lock: lockToken });
  if (!post) return NextResponse.json({ rien_a_faire: true });

  // 3) Assertion redondante (§6.2, verrou 3)
  if (!post.validated_at || !post.validated_by) {
    await db.from('post').update({ statut: 'failed', lock_token: null }).eq('id', post.id);
    await alerte(`🚨 Post ${post.id} arrivé en publication SANS validation. Bug de pipeline.`, 'critique');
    return NextResponse.json({ error: 'validation manquante' }, { status: 500 });
  }

  // 4) Contrôle lexical, troisième passage (§6.1)
  const violations = await controlerLexique(post.id);
  if (violations.some(v => v.gravite === 'bloquant')) {
    await db.from('post').update({ statut: 'failed', lock_token: null }).eq('id', post.id);
    await journaliser(post.id, 'instagram', 'guardrail', false, { violations });
    await alerte(`Post ${post.id} bloqué : lexique interdit (${violations.map(v => v.extrait)}).`, 'haute');
    return NextResponse.json({ bloque: 'lexique', violations });
  }

  // 5) Publication
  const { data: tok } = await db.from('meta_token').select('*').eq('id', 1).single();
  const medias = post.post_media.sort((a, b) => a.position - b.position);

  try {
    let containerId: string;
    if (medias.length === 1) {
      containerId = await creerItemCarrousel(tok.ig_user_id, tok.access_token, medias[0].public_url);
      // pour une image seule : refaire l'appel sans is_carousel_item + caption
    } else {
      const enfants: string[] = [];
      for (const m of medias) {
        enfants.push(await creerItemCarrousel(tok.ig_user_id, tok.access_token, m.public_url));
      }
      containerId = await creerConteneurCarrousel(
        tok.ig_user_id, tok.access_token, enfants,
        `${post.legende}\n\n${post.cta ?? ''}`.trim(),   // pas de hashtags : -31,7 % de vues
      );
    }

    await db.from('publication').upsert({
      post_id: post.id, plateforme: 'instagram', container_id: containerId, statut: 'pending',
    }, { onConflict: 'post_id,plateforme' });

    await attendreConteneur(containerId, tok.access_token);
    const mediaId = await publier(tok.ig_user_id, tok.access_token, containerId);

    await db.from('publication').update({
      statut: 'ok', external_id: mediaId, published_at: new Date().toISOString(),
    }).eq('post_id', post.id).eq('plateforme', 'instagram');

    await db.from('post').update({
      statut: 'published', lock_token: null, locked_until: null,
    }).eq('id', post.id);

    await journaliser(post.id, 'instagram', 'publish', true, { mediaId });
    return NextResponse.json({ ok: true, postId: post.id, mediaId });

  } catch (e: any) {
    await journaliser(post.id, 'instagram', 'publish', false, {
      code: e.code, subcode: e.subcode, message: e.message,
    });

    if (e.code === 190) {
      await alerte('🚨 Token Instagram invalide (190). File arrêtée.', 'critique');
      await db.from('post').update({ statut: 'approved', lock_token: null, locked_until: null })
        .eq('id', post.id);                    // on remet en file, on ne réessaie pas maintenant
      return NextResponse.json({ error: 'token' }, { status: 500 });
    }

    const tentatives = await compterTentatives(post.id);
    if (estTransitoire(e) && tentatives < 5) {
      // on relâche le verrou : la prochaine exécution du cron réessaiera
      await db.from('post').update({ statut: 'approved', lock_token: null, locked_until: null })
        .eq('id', post.id);
      return NextResponse.json({ retry: true, tentatives });
    }

    await db.from('post').update({ statut: 'failed', lock_token: null }).eq('id', post.id);
    await alerte(`Échec définitif du post ${post.id} : ${e.message}`, 'haute');
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
```

---

## 7. Les métriques de décision à 3 mois

**C'est la partie la plus importante du document.** Tout le reste n'existe que pour rendre cette mesure possible et interprétable.

### 7.1 La métrique pilote : SENDS PER REACH

**Sends per reach = partages en DM ÷ portée.** C'est la seule métrique qu'on pilote.

**Pourquoi elle et pas une autre.** Adam Mosseri, 22 janvier 2025 : les trois principaux signaux de classement sont **watch time, likes et sends** — et **« sends are slightly more important for unconnected content »**. « Unconnected content », c'est le contenu montré aux **non-abonnés**. Or c'est *exactement* ce qu'on mesure : la capacité d'un positionnement neuf à sortir du cercle des gens qui suivent déjà Anima.

Un like vient d'un abonné qui aime déjà Anima. Un partage en DM veut dire : *quelqu'un a pensé à une personne précise en lisant ça, et a pris le risque social de le lui envoyer.* C'est la seule preuve que le contenu **traverse**.

**Conséquences opérationnelles directes :**
- le CTA est **« envoie ça à quelqu'un »**. Pas « enregistre », pas « commente ». Le CTA doit demander la métrique qu'on pilote.
- on ne pilote **ni les likes, ni le nombre d'abonnés**. Les abonnés sont un *résultat retardé* de sends/reach ; les regarder chaque semaine, c'est regarder du bruit à la place du signal.

⚠️ **Deux honnêtetés à garder.** (1) Mosseri dit *« slightly »*, pas « 3× à 5× ». Le multiplicateur qui circule sur LinkedIn est du folklore. (2) **Il n'existe aucun benchmark public de sends/reach en francophone sur ce créneau.** On ne se compare donc à personne : on se compare **à sa propre ligne de base** des 4 premières semaines. C'est pour ça que l'Étape 0 relève les chiffres à la main dès le premier post.

### 7.2 Les métriques secondaires

Elles ne pilotent rien. Elles **expliquent** un mouvement de sends/reach, ou signalent que le dispositif se dégrade.

| Métrique | Ce qu'elle dit | Fréquence de lecture |
| --- | --- | --- |
| **Saves per reach** | Le contenu a de la valeur d'usage (on y reviendra), là où le send a de la valeur sociale. Un save/reach fort avec un sends/reach faible = le contenu est utile mais pas *partageable*. Le format est bon, l'angle ne fait pas parler. | Mensuelle |
| **Part de portée non-abonnés** | `reach_non_abonnes / reach`. Le thermomètre de la distribution froide. Sous 30 %, on tourne en circuit fermé et la mesure à 3 mois ne dit rien du marché. | Mensuelle |
| **Croissance nette d'abonnés** | Le résultat, pas le levier. À lire en tendance mensuelle, jamais en variation quotidienne. | Mensuelle |
| **Taux de validation d'Anima** | `approved / (approved + rejected)`. **Métrique de santé du dispositif, pas du contenu.** Sous 70 %, la génération dérive de sa voix — le corpus est mal exploité. Au-dessus de 98 % pendant un mois, elle est devenue un tampon encreur et ne lit plus : c'est le risque n°1 identifié à l'atelier, et il se voit ici. | Mensuelle |
| **Tenue du tampon** | Semaines d'avance (§6.5). Le meilleur prédicteur d'un abandon à la semaine 8. | Hebdomadaire |
| **Commentaires** | Contexte qualitatif. À 500 abonnés, 1 à 3 commentaires par post : **ce chiffre n'est pas une métrique, c'est une anecdote.** À lire, pas à moyenner. | Lecture, pas mesure |

Collecte par API :

```ts
// GET https://graph.instagram.com/v23.0/{media-id}/insights?metric=reach,shares,saved,likes,comments,total_interactions,views
// GET https://graph.instagram.com/v23.0/{ig-user-id}/insights
//        ?metric=reach&breakdown=follow_type&period=day&metric_type=total_value
//   -> renvoie la ventilation FOLLOWER / NON_FOLLOWER
// Nécessite la permission instagram_business_manage_insights.
// ⚠️ La disponibilité exacte des noms de métriques bouge d'une version d'API à l'autre.
//    Vérifier sur un post réel AVANT d'écrire le collecteur ; ne pas coder à l'aveugle.
```

Relevés à **24 h, 72 h, 7 j et 30 j** (colonne `age_heures`). Un carrousel continue de recevoir de la portée bien après 48 h, notamment via la mécanique « second chance » (Mosseri, oct. 2024 : si on ne swipe pas, Instagram remontre souvent le carrousel **en démarrant à la slide 2**). Juger un post à 24 h, c'est le juger avant sa deuxième vie. **Le relevé de référence pour toute décision est celui à 7 jours.**

### 7.3 Les seuils de décision

**Contexte de réalisme, à poser avant tout chiffre.** Le **plafond francophone du créneau est ~250 K abonnés** — aucun mega-compte FR (> 500 K) n'a été identifié sur tarot/voyance, contrairement à l'anglophone. Et **le cœur du marché est 15-90 K**. Viser six chiffres à 3 mois est hors-sol. Le churn est extrême : 4 comptes sur ~20 identifiés ont disparu en quelques mois, dont un à 79 300 abonnés.

Ce qu'on cherche à 3 mois n'est donc **pas une audience**. C'est **une preuve que le positionnement traverse** — sur ~36 publications, à un rythme de 3/semaine.

**⛳ ON CONTINUE (et on construit l'app) si les trois sont vraies :**

| Condition | Seuil | Pourquoi ce seuil |
| --- | --- | --- |
| **Sends/reach**, médiane groupée sur le dernier mois | **≥ 1,0 %**, et le **quartile supérieur ≥ 2,0 %** | 1 % veut dire : 1 personne sur 100 touchées envoie le post à quelqu'un. Le quartile supérieur compte davantage que la médiane — la distribution est très asymétrique et c'est le **haut** de la distribution qui construit la portée. |
| **Part de portée non-abonnés** | **≥ 40 %** en moyenne mois 3 | En dessous, on parle à un cercle. On n'a rien appris sur le marché. |
| **Abonnés nets** | **≥ +800** sur 3 mois, à partir d'une base quasi nulle | Ordre de grandeur pour un compte parti de rien à 3 posts/semaine sans budget pub. Ce n'est pas un objectif ambitieux, c'est un **seuil de non-échec**. |

**🟨 ZONE GRISE — on prolonge de 6 semaines, on ne construit pas encore :**
Sends/reach entre **0,5 % et 1,0 %**, ou portée non-abonnés entre 25 % et 40 %. Diagnostic à poser avant de prolonger : est-ce l'**angle** (le contenu ne fait pas parler) ou le **dispositif** (le tampon a lâché, on a publié 14 fois au lieu de 36) ? **Si moins de 24 publications ont été postées sur les 3 mois, la mesure est nulle et non avenue** — on n'a pas testé le positionnement, on a testé sa propre capacité à tenir. Dans ce cas on ne prolonge pas : on répare le dispositif et on relance le compteur.

**🛑 ON ARRÊTE DE CONSTRUIRE L'APP si :**

- **sends/reach médian < 0,5 %** sur le mois 3 **alors que ≥ 30 publications sont sorties** ; **et**
- **portée non-abonnés < 25 %** ; **et**
- **abonnés nets < 300** sur 3 mois.

Les trois ensemble veulent dire : avec un canal qui a réellement tourné, le positionnement ne traverse pas. Ce n'est pas un problème de dispositif, c'en est un d'angle ou de marché.

**Cette conclusion doit rester dicible.** Le contexte l'exige : le marché français est en reflux sur ses canaux mesurables (livre ésotérique −7,6 % en valeur, GfK/Livres Hebdo 2023-2024 ; Wikipedia FR janv. 2022 → janv. 2026 : Astrologie −58 %, Ésotérisme/Voyance −69 %, Ennéagramme −66 %). Une part est un effet de plateforme (IA, réponses générées dans le moteur de recherche), mais l'ampleur dépasse le déclin global de Wikipedia. **Un « on arrête » à 3 mois pour 500 € et 40 h investies est un excellent résultat comparé à un « on arrête » à 18 mois.** Le point de contrôle n'est utile que si on est prêt à l'écouter.

⚠️ **Les seuils de la première colonne sont des hypothèses de travail, pas des données.** Aucune donnée publique de sends/reach n'existe sur ce créneau en francophone. **Ils sont à recalibrer sur la ligne de base réelle à la fin de la semaine 4**, une fois 12 posts mesurés. Un seuil recalibré est plus honnête qu'un seuil inventé qu'on garde par entêtement.

### 7.4 Le protocole de test

Point de départ obligé : **les données de design de slide n'existent pas publiquement.** Nombre optimal de slides (la seule étude date de 2020, pré-Reels, et mesure surtout un effet de sélection), taux de complétion par nombre de slides (métrique même pas exposée par Instagram), design de la slide 1, typographique vs illustré, formats à révélation. Rien. **La seule voie est de tester soi-même.**

**Le protocole, en 6 règles :**

1. **Une variable à la fois.** On teste le design de la slide 1, OU le nombre de slides, OU le CTA. Jamais deux ensemble : à ces volumes on ne pourra pas démêler.
2. **Même contenu, deux variantes.** Le même texte de post, la même série, le même créneau horaire. Seule la variable testée change. Sinon on mesure le sujet, pas le design.
3. **Alterné dans le temps, pas simultané.** On ne peut pas publier deux fois le même post — Instagram déclasse le contenu dupliqué. Donc : semaine 1 variante A, semaine 2 variante B, semaine 3 A, semaine 4 B… avec **assignation tirée au sort** pour ne pas confondre la variante avec la tendance générale du compte (qui grandit).
4. **Minimum 8 publications par variante**, soit ~16 publications par test, soit ~5-6 semaines à 3/semaine. **On ne mène qu'un test à la fois**, et donc au maximum 2 tests sur les 3 mois. C'est peu. C'est pour ça qu'il faut tester ce qui compte : le **hook de slide 2** en premier (mécanique « second chance » : la slide 2 est vue en premier par une partie du trafic, donc elle doit être un hook autonome — la trame « Elle m'a demandé / Elle voulait savoir » est déjà conforme).
5. **Comparer avec le ratio des sommes, jamais la moyenne des ratios.**
   `sends/reach(A) = Σ sends(A) / Σ reach(A)`.
   La moyenne des ratios par post donne un poids énorme à un post à faible portée : un post vu 40 fois avec 2 sends affiche 5 % et écrase tout. C'est l'erreur de lecture la plus courante à cette taille de compte.
6. **Toujours à 7 jours d'âge.** Comparer un post relevé à 24 h avec un post relevé à 7 j ne mesure que l'écart de relevé.

**Le test à ne pas oublier — la plateforme elle-même.** Les mêmes créateurs francophones pèsent 4× à 32× plus sur TikTok que sur Instagram dans ce créneau (mesures directes du 21/07/2026 : @lesguidancesdesaturne 92 300 TikTok vs 2 846 IG ; @saralouvoyance 18 600 vs 965). **Le cross-post TikTok n'est pas un bonus, c'est le test le plus rentable des 3 mois** — coût marginal quasi nul, et il peut révéler que le canal était le mauvais depuis le début.

Requête d'analyse :

```sql
-- Comparaison de deux variantes, ratio des sommes, à 7 jours d'âge.
-- (post.titre_interne préfixé par 'VAR_A:' / 'VAR_B:' — ou une colonne dédiée si on teste souvent)
with mesures as (
  select
    case when p.titre_interne like 'VAR\_A:%' then 'A' else 'B' end as variante,
    m.reach, m.sends, m.saves
  from metrique m
  join publication pub on pub.id = m.publication_id
  join post p          on p.id  = pub.post_id
  where m.age_heures = 168                       -- 7 jours
    and pub.plateforme = 'instagram'
    and p.titre_interne ~ '^VAR_[AB]:'
)
select
  variante,
  count(*)                                       as n_posts,
  sum(reach)                                     as reach_total,
  sum(sends)                                     as sends_total,
  round(100.0 * sum(sends) / nullif(sum(reach),0), 2)  as sends_per_reach_pct,
  round(100.0 * sum(saves) / nullif(sum(reach),0), 2)  as saves_per_reach_pct,
  -- erreur-type de la proportion : sqrt(p(1-p)/n) — la marge à ± ~2 écarts-types
  round(100.0 * 2 * sqrt(
    (sum(sends)::numeric / nullif(sum(reach),0))
    * (1 - sum(sends)::numeric / nullif(sum(reach),0))
    / nullif(sum(reach),0)
  ), 2)                                          as marge_pct_95
from mesures
group by variante;
```

**Règle de lecture :** si les intervalles `sends_per_reach_pct ± marge_pct_95` des deux variantes **se chevauchent**, le test n'a **rien** montré. On ne tranche pas. On prolonge, ou on accepte de ne pas savoir. Choisir la variante « qui a l'air meilleure » quand les intervalles se chevauchent, c'est se raconter une histoire et la graver dans le gabarit pour six mois.

### 7.5 ⚠️ Avertissement statistique — à lire avant chaque analyse

**Sous 5 000 abonnés, les moyennes sont dominées par le bruit.** Ce n'est pas une précaution rhétorique, c'est un fait arithmétique. À cette taille : 1 enregistrement par post, 1 à 3 commentaires. Ces nombres sont trop petits pour qu'une moyenne veuille dire quoi que ce soit.

**Le calcul qui doit rester en tête.** L'erreur-type d'une proportion vaut `√(p(1−p)/n)`, avec `n` = la portée.

- Un post touchant **500 comptes** avec un vrai sends/reach de 1 % → erreur-type = **0,45 %**. Intervalle à ~95 % : **0,1 % à 1,9 %**. Autrement dit : **sur un seul post, on ne peut pas distinguer 1 % de 2 %.** Ils sont dans le même brouillard.
- Groupez **8 posts** (portée cumulée 4 000) → erreur-type = **0,16 %**. Intervalle : **0,7 % à 1,3 %**. Là seulement on commence à voir quelque chose.

**Les six règles qui découlent de ça :**

1. **Ne jamais conclure sur un post.** Jamais. Un post à 4 % de sends/reach n'est pas une découverte de format, c'est très probablement du bruit — ou une personne influente qui a partagé.
2. **Grouper par 8 minimum**, en fenêtre glissante de 4 semaines.
3. **Médiane plutôt que moyenne** pour décrire un ensemble de posts. La distribution de la portée organique est fortement asymétrique : un post qui perce multiplie la moyenne par 3 et donne l'illusion d'une amélioration générale.
4. **Ratio des sommes, pas moyenne des ratios** (§7.4 règle 5). C'est la même erreur, sous un autre déguisement.
5. **Ignorer purement et simplement les métriques dont le compteur est sous 10** sur la période. Un save par post : ce n'est pas « saves/reach = 0,2 % », c'est « on n'a pas assez de données pour parler des saves ». Ne pas mettre ce chiffre dans un tableau de bord — il sera lu comme une information alors que c'en est le contraire.
6. **Lire mensuellement, pas quotidiennement.** Chaque lecture supplémentaire est une occasion de réagir à du bruit. Une réaction à du bruit change le gabarit, et changer le gabarit détruit la comparabilité de tout ce qui a été publié avant. **Le coût d'un tableau de bord temps réel est négatif ici.** D'où §5.3 : Anima ne voit aucun chiffre.

**Le piège inverse, tout aussi réel :** attendre la significativité statistique pour tout. À ces volumes, on ne l'aura presque jamais. La règle pratique : **exiger la rigueur pour les décisions coûteuses et irréversibles** (construire l'app, refaire tous les gabarits) et **accepter l'intuition documentée pour les décisions réversibles** (essayer une accroche). Ce qu'on ne fait jamais : maquiller une intuition en donnée.

### 7.6 Le tableau de bord mensuel

Une vue, lue une fois par mois par Julian. Rien d'autre.

```sql
create or replace view v_dashboard_mensuel as
with base as (
  select
    date_trunc('month', pub.published_at)              as mois,
    pub.plateforme,
    p.serie,
    m.reach, m.reach_non_abonnes, m.sends, m.saves, m.follows,
    (m.sends::numeric / nullif(m.reach,0))             as ratio_post
  from metrique m
  join publication pub on pub.id = m.publication_id
  join post p          on p.id  = pub.post_id
  where m.age_heures = 168 and pub.statut = 'ok'
)
select
  mois,
  plateforme,
  count(*)                                                          as n_posts,
  sum(reach)                                                        as reach_total,
  -- métrique pilote : ratio des sommes
  round(100.0 * sum(sends)  / nullif(sum(reach),0), 2)              as sends_per_reach_pct,
  -- le haut de la distribution compte plus que le centre
  round(100.0 * percentile_cont(0.75) within group (order by ratio_post), 2) as sends_p75_pct,
  round(100.0 * percentile_cont(0.50) within group (order by ratio_post), 2) as sends_median_pct,
  round(100.0 * sum(saves)  / nullif(sum(reach),0), 2)              as saves_per_reach_pct,
  round(100.0 * sum(reach_non_abonnes) / nullif(sum(reach),0), 1)   as part_non_abonnes_pct,
  sum(follows)                                                      as abonnes_gagnes,
  -- garde-fou de lecture : au-dessous, on n'affiche rien (§7.5 règle 5)
  (count(*) >= 8)                                                   as lisible
from base
group by mois, plateforme
order by mois desc, plateforme;
```

Et la santé du dispositif, à côté :

```sql
create or replace view v_sante_dispositif as
select
  (select semaines_avance from v_tampon)                                  as tampon_semaines,
  round(100.0 * count(*) filter (where statut = 'approved')
        / nullif(count(*) filter (where statut in ('approved','rejected')), 0), 1)
                                                                          as taux_validation_pct,
  count(*) filter (where statut = 'failed')                               as posts_en_echec,
  (select extract(day from (expires_at - now())) from meta_token where id = 1)
                                                                          as token_jours_restants
from post
where created_at > now() - interval '30 days';
```

---

## 8. Récapitulatif décisionnel

| Question | Réponse |
| --- | --- |
| Quand coder le pipeline ? | Pas avant 12 publications manuelles + 3 semaines de tampon + 4 sessions de validation tenues sur 4. |
| Ordonnanceur ? | **Vercel Cron** (plan Pro), scan de file toutes les 15 min. GitHub Action en repli si Hobby. |
| Le piège n°1 ? | Le token 60 jours. Refresh quotidien dès J−30 + alerte à J−10 + monitoring de l'échec du refresh. |
| Ce qu'on ne fera jamais ? | Automatiser via navigateur ou UI Instagram. Publier sans validation humaine horodatée. Réessayer une erreur 190. |
| La métrique pilote ? | **Sends per reach**, relevé à 7 jours, groupé par ≥ 8 posts, ratio des sommes. |
| Le seuil de continuation ? | sends/reach ≥ 1,0 % médian **et** portée non-abonnés ≥ 40 % **et** ≥ 800 abonnés nets — avec ≥ 24 publications réellement sorties, sinon la mesure ne vaut rien. |
| L'erreur de lecture la plus probable ? | Conclure sur un post. À 500 de portée, l'intervalle autour de 1 % va de 0,1 % à 1,9 %. |
| Le test le plus rentable des 3 mois ? | Le cross-post TikTok. Coût marginal nul, et le créneau francophone y pèse 4× à 32× plus. |
