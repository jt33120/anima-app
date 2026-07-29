---
baseline_commit: 3d13bddd3bffd6b1ef0b8322143fd4f58360c5d2
---

# Story 3.1: L'ossature d'abonnement — Stripe Checkout, webhooks idempotents, projection d'état

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant qu'utilisatrice,
je veux que ma souscription premium et son état soient enregistrés de façon fiable et sans double effet,
afin que mon accès reflète exactement ce que j'ai payé, sans double débit ni perte.

## Acceptance Criteria

1. **Session Checkout hébergée (FR-056, NFR-018, AD-2).** Une utilisatrice authentifiée qui lance la souscription déclenche, **côté serveur**, la création d'une **session Stripe Checkout hébergée** en mode `subscription` au prix unique de **69 €/an = `6900` entiers centimes EUR**. Le navigateur ne détient **jamais** de clé secrète Stripe : la clé secrète et le secret de signature webhook vivent en **secret serveur (env Vercel), jamais côté client, jamais préfixés `NEXT_PUBLIC_`**. La route redirige vers `session.url`.
2. **Webhook signé et idempotent (convention « Événements externes »).** Pour tout événement Stripe entrant (paiement réussi, renouvellement, échec, résiliation, remboursement), sa **signature Stripe est vérifiée AVANT tout traitement** (via le corps brut). Le traitement est **idempotent par `provider_event_id`** (l'`event.id` Stripe) via la table `evenements_traites` : un même événement rejoué **ne produit aucun second effet**.
3. **Table `abonnement` en projection à écrivain unique (convention « Événements externes »).** Toute évolution d'état passe par un **unique chemin de code** (une RPC `security definer` service-role) ; l'état vaut `actif | resilie | expire` (CHECK), jamais deux écrivains concurrents, jamais une régression sur événement obsolète (ordre non garanti par Stripe).
4. **Entitlement premium dérivé, source de vérité unique (FR-056).** L'entitlement premium **dérive de `abonnement.etat = 'actif'`** et constitue la **seule** source de vérité que les gardes des Stories 3.3/3.4 interrogeront (débloque les 7 capacités FR-056). Il n'est **jamais stocké en double** ni dérivé d'un flag client.
5. **Retour Stripe sobre, registre produit (FR-057, « Data & formats »).** Sur retour Stripe (succès, échec **ou** abandon), l'utilisatrice revient **exactement là où elle était** avec une **ligne système sobre**, sans message d'échec dramatisé, sans relance, en **registre produit — jamais signé de la voix d'Anam**.
6. **Libellé de relevé bancaire neutre et paramétré (lacune Z-1 signalée).** Le libellé porté sur le relevé bancaire est **neutre** et lu depuis un **paramètre de configuration, jamais codé en dur**. *(Valeur finale = porte pré-lancement, dépend de l'entité juridique — voir Dev Notes § Portes.)*

## Tasks / Subtasks

- [x] **Task 1 — Migration `0013` : tables `abonnement` + `evenements_traites`, RLS, RPC écrivain-unique (AC: #2, #3)**
  - [x] Tests DB (RED confirmé) dans `tests/abonnement.test.ts` sur Supabase local réel : lecture propriétaire positive, lecture croisée interdite, écriture client interdite, `evenements_traites` deny-by-default, RPC service-role-only, idempotence (`deja_traite`), anti-régression (`ignore_obsolete`), projection actif→resilie, CHECK état.
  - [x] `supabase/migrations/0013_abonnement.sql` (GREEN) : 2 tables, `enable`+`force RLS`, policy SELECT propriétaire d'`abonnement`, RPC atomique `security definer set search_path=''` (dédup + verrou + anti-régression + upsert), grants service_role-only, `comment on table`. Appliqué via CLI globale `supabase db reset`.
  - [x] Mutation-testing : 4 gardes cassées en une passe (policy SELECT, grant service_role, dédup, anti-régression) → **exactement** les 4 tests correspondants ROUGES, 5 autres verts → restauration `db reset` → 9/9 verts.

- [x] **Task 2 — Client Stripe + boot-guard + route Checkout + garde-frontière (AC: #1, #6)**
  - [x] `lib/stripe/client.ts` (`server-only`) : boot-guard (`throw` si `STRIPE_SECRET_KEY` absente), singleton mémoïsé `new Stripe(cle, { apiVersion: "2026-06-24.dahlia", typescript: true })`. `lib/stripe/config.ts` : `PRIX_ABONNEMENT_ANNUEL_CENTIMES=6900`, `DEVISE_ABONNEMENT`, `libelleReleveBancaire()` (AC6, lue depuis `STRIPE_STATEMENT_DESCRIPTOR`).
  - [x] `app/api/stripe/checkout/route.ts` : runtime Node, `getUser()` (401), **garde AD-9** `limitesCommercialesLevees` → 409, session `subscription` (6900 EUR), `metadata`+`subscription_data.metadata.utilisatriceId` (mapping sans dépendance d'ordre), `idempotencyKey`, redirect 303. Libellé de relevé attaché en metadata (traçabilité) ; application compte = porte ops.
  - [x] Raffiné `tests/garde-commerciale.test.ts` : `app/api/**` exclu de l'exigence de balise `<GardeCommerciale`, mais route commerciale API DOIT appeler `limitesCommercialesLevees` (contrôle non-vacue) ; consommateur « autorisé » du prédicat ajouté (route commerciale) au test anti-sauvage.
  - [x] `tests/frontiere-stripe.test.ts` : SDK `stripe` (package quoté) + secrets `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` confinés à `lib/stripe/` ; aucun secret en `NEXT_PUBLIC_`. Mutation-vérifiée (consommateur sauvage éphémère → 2 tests ROUGES).
  - [x] `tests/stripe-checkout.test.ts` (source-read) : runtime Node, auth d'abord, garde AD-9 avant la session (ordre `indexOf`), montant via constante (jamais flottant), mapping `subscription_data.metadata`, libellé via config, redirect 303. Dépendance `stripe@22.3.2` installée (tsc clean).

- [x] **Task 3 — Route Webhook : raw body, signature, dédup idempotente, projection (AC: #2, #3)**
  - [x] `lib/domain/abonnement.ts` (PUR, aucun import `stripe`) : `etatDepuisStatutStripe(statut)` + `estPremium(ab)`. Tests purs `tests/abonnement-domaine.test.ts` (positif+négatif de chaque transition).
  - [x] `lib/domain/depot-abonnement.ts` : port pur `DepotAbonnement` + type `EvenementAbonnementProjete`.
  - [x] `lib/data/depot-abonnement.ts` : `creerDepotAbonnement()` — client admin, RPC écrivain-unique ; PROPAGE l'erreur (throw → webhook 500 → rejeu Stripe sûr). Chemin d'erreur testé.
  - [x] `app/api/stripe/webhook/route.ts` : runtime Node, `request.text()` (corps BRUT, jamais `.json()`), signature vérifiée avant DB, `interpreterEvenementAbonnement` (lib/stripe, isole les types SDK) → dérive `etat` (pur) → dépôt → 200/400/500. Logs sans PII ; anomalie « type d'état sans mapping » journalisée (revue).
  - [x] `tests/stripe-webhook.test.ts` (source-read) + `tests/evenement-abonnement.test.ts` (interpréteur : metadata, periodeFin sur l'item, NO-OP checkout.session.completed, null si mapping absent).

- [x] **Task 4 — Entitlement premium dérivé, source de vérité unique (AC: #4)**
  - [x] `lib/data/lire-abonnement.ts` : `estPremiumCourante()` lit la ligne `abonnement` SOUS JWT (`createSupabaseServerClient`, RLS SELECT propriétaire) et renvoie `estPremium(...)` (dérivation pure). Aucun état dupliqué. Couture INERTE (consommée par 3.3/3.4).
  - [x] `tests/lire-abonnement.test.ts` (source-read) : lit sous JWT jamais admin, dérive via `estPremium`. La dérivation est testée pure (abonnement-domaine) + la policy SELECT en DB (abonnement.test).

- [x] **Task 5 — Retour de paiement sobre (AC: #5)**
  - [x] `lib/domain/retour-paiement.ts` (PUR) : `ligneRetourPaiement("succes"|"echec"|"annule")` — registre produit, ≤ 1 phrase, jamais signé Anam, jamais dramatisé. PROVISOIRE.
  - [x] `tests/retour-paiement.test.ts` : lignes sobres (pas de « ! », pas de 1re personne) + passent `chercherInterdits` (lexique propre). Le scan `lexique-voix.test.ts` couvre le module (non exclu).
  - [x] `success_url`/`cancel_url` → `/?paiement=succes|annule` (Task 2). Rendu in-fil différé à 3.2 ; 3.1 livre la cible + la ligne pure.

- [x] **Task 6 — Dépendance, env, différés (AC: tous)**
  - [x] `package.json` : `stripe@22.3.2` (`--save-exact`), apiVersion `2026-06-24.dahlia` (= version épinglée par le SDK, tsc clean).
  - [x] `.env.example` : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_STATEMENT_DESCRIPTOR`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
  - [x] Différés dans `deferred-work.md` (§ 3.1 : carte 3.2, gardes 3.3/3.4, remboursement 3.5, portes DPA/effacement/libellé) et `lib/domain/README.md` (section 3.1).
  - [x] **Validation complète** : 72 fichiers / **838 tests verts** (baseline 65/790), `tsc --noEmit` propre, `eslint .` propre, `npm run build` propre (routes checkout + webhook reconnues dynamiques).

## Dev Notes

### Périmètre chirurgical — ce que 3.1 fait / ne fait PAS

**3.1 = plomberie backend de paiement, UNIQUEMENT.** Checkout hébergée + webhook signé/idempotent + table `abonnement` (projection écrivain-unique) + entitlement dérivé + retour sobre + libellé paramétré. **Rien de visuel, rien de tarifaire affiché, aucune garde par fonctionnalité.**

| Différé à | Ce que 3.1 ne fait PAS |
|---|---|
| **3.2** (paywall UI/carte) | La carte d'abonnement, son placement sous le bilan, le prix *affiché* 69 €, les boutons « M'abonner »/« Pas maintenant », l'annonce de la garantie (FR-089), la garde `limites_levees` **au montage**. 3.1 fournit seulement la *cible* du bouton (route Checkout) + la *ligne de retour* pure. |
| **3.3** (gardes tronc/branches) | Les gardes serveur par fonctionnalité. 3.1 fournit l'entitlement qu'elles *interrogent*, pas les gardes. |
| **3.4** (allocation/métrage) | `usage_ia`, l'allocation résiduelle, le « jamais coupé à zéro ». Hors 3.1. |
| **3.5** (résiliation/remboursement) | Le parcours trois clics, l'éligibilité au remboursement, l'email avant reconduction. 3.1 fournit l'**idempotence** + la **projection écrivain-unique** que 3.5 réutilise. Le stub `declencherRemboursement` (`lib/safety/appliquer-barriere.ts:38`) reste à remplir plus tard. |

### Invariants d'architecture DURS (SPINE — non négociables)

1. **Clé secrète Stripe + secret webhook : env serveur Vercel uniquement, jamais client, jamais `NEXT_PUBLIC_`** (AD-2 / convention « State & cross-cutting »). Seule une clé **publishable** Stripe peut toucher le client.
2. **Webhooks idempotents par `provider_event_id` via `evenements_traites`** ; **`abonnement` = projection à écrivain unique** ; résiliation/remboursement **rejouables sans double effet** (convention « Événements externes »).
3. **Montants en entiers centimes EUR** (`6900`), jamais de flottant euros ; ids `uuid` ; erreurs `{ code, message }` en **registre système, jamais signé Anam** (convention « Data & formats »).
4. **RLS deny-by-default par utilisatrice** (`auth.uid()`) ; `service_role` réservé aux tâches système (le webhook, sans JWT, est une tâche système légitime — pas un contournement RLS opportuniste sur du contenu applicatif) (AD-12).
5. **Le commerce refuse de se monter quand `limites_levees`** (dérivé de `episode_detresse.fin IS NULL`, AD-17). La garde de *montage* est en 3.2 ; **la route Checkout de 3.1 la respecte côté serveur** (`limitesCommercialesLevees` → 409). Paywall = **offre**, jamais verrou (AD-9).
6. **L'abonnement n'est PAS de la donnée art. 9** (AD-4 : paiement absent du champ art. 9 ; `abonnement:"Stripe"` séparé dans le modèle d'entités) → **pas d'`egress-guard`**, pas de contrainte ZDR. **Corollaire STRICT : aucune donnée art. 9** (verbatim de conversation, contenu de lecture, faits, état émotionnel) ne doit **jamais** transiter vers Stripe (metadata, description, `product_data.name`, etc.).
7. **Direction des dépendances** (AD-1/AD-10) : le SDK Stripe + la vérif de signature vivent en couche route/données (`app/api/**`, `lib/stripe/**`, `lib/data/**`). La **logique de projection d'état** (transitions `actif|resilie|expire`) et l'entitlement sont **purs** (`lib/domain/abonnement.ts`) — **aucun import `stripe`, même `type`, dans `lib/domain/`**.
8. **Rétention** (AD-14) : `abonnement` relève du **moteur de rétention unique** (l'ordonnanceur, Epic 6) — **ne pas** coder de purge ad-hoc. L'effacement des données côté Stripe sur fermeture de compte est **sous-spécifié** (voir § Portes).
9. **Version épinglée** : `stripe` (node) **22.3.2** (SPINE : 22.3.x vérifié 2026-07-22 ; web 2026-07-29 : 22.3.2). apiVersion **`2026-06-24.dahlia`**.

### Patrons de code à RÉUTILISER (ne rien réinventer — chemins exacts)

| Besoin 3.1 | Patron | Chemin |
|---|---|---|
| Écrivain unique (webhook → DB) | `createSupabaseAdminClient()` (`server-only`, `service_role`, lit `SUPABASE_SECRET_KEY`) | `lib/data/supabase/admin.ts` |
| Lecture entitlement sous JWT | `createSupabaseServerClient()` (RLS, cookies) | `lib/data/supabase/server.ts` |
| Boot-guard secret serveur (échec DUR, jamais fail-open) | `assertConformiteArt9()` + garde clé au constructeur | `lib/ai/adapters/mistral.ts` |
| Import dynamique + interdit stub en prod | `creerAiPort()` (`VERCEL_ENV==="production"` → throw) | `lib/ai/fabrique.ts` |
| Structure route handler (Node runtime, auth, `{code,message}`, `after`, logs sans PII) | `POST` | `app/api/anam/message/route.ts` (l. 39-42 config, l. 50-60 auth) |
| Port pur + impl infra (dépôt) | `DepotSeance` / `creerDepotSeance` ; `creerDepotEpisode` + `rpcAvecRepli` | `lib/domain/depot-seance.ts`, `lib/data/depot-seance.ts`, `lib/safety/depot-episode.ts`, `lib/safety/rpc-repli.ts` |
| Table idempotente + RPC atomique `for update` + `security definer` + grants | `usage_ia` (index unique + `on conflict do nothing`) ; `enregistrer_tour_detresse` | `supabase/migrations/0008_usage_ia.sql`, `0010_episode_detresse.sql`, `lib/ai/metrage.ts` |
| Écriture best-effort qui ne lève jamais | `metrerUsageIa` / `journaliserAuditDetresse` | `lib/ai/metrage.ts`, `lib/safety/journaliser-audit.ts` |
| Garde de montage commerciale (pour 3.2) | `GardeCommerciale` / `MontagePaywall` / `limitesCommercialesLevees` | `app/_commerce/GardeCommerciale.tsx`, `MontagePaywall.tsx`, `lib/safety/limites-commerciales.ts` |
| Contrôle privilège positif+négatif (modèle boot-guard) | `service_role` PEUT / anon NE PEUT PLUS | `tests/privileges-fonctions.test.ts` |
| Garde-frontière serveur (grep nom brut) | package + variable-clé confinés serveur | `tests/frontiere-serveur.test.ts` |

### Patron DDL exact (migration `0013`)

Conventions **réelles** du dépôt (observées, non inventées) — **snake_case, colonnes FRANÇAIS** :
- `id uuid primary key default gen_random_uuid()` · FK `utilisatrice_id uuid not null references public.utilisatrice(id) on delete cascade` · horodatage `cree_le` / `mis_a_jour_le` (**pas** `created_at`/`updated_at`) · `timestamptz not null default now()` · énuméré `text not null check (etat in (...))`.
- **Une-ligne-par-utilisatrice** → `abonnement` porte `unique` sur `utilisatrice_id` (patron `seance` `0012` L26). `evenements_traites` **non** (N lignes).
- **Montants** : aucun précédent monétaire dans le dépôt → **décision à acter** : `integer` centimes (cohérent Stripe unités mineures). *(3.1 stocke surtout des états ; si un montant est persisté, `integer` centimes.)*
- Chaque table : `enable` **et** `force row level security` + `comment on table/column` citant Story 3.1 + AD. En-tête `-- Migration forward-only — Story 3.1 : ...`.

**`abonnement`** (lecture propriétaire, écriture interdite au client) :
- Colonnes : `id`, `utilisatrice_id (unique)`, `etat text check (etat in ('actif','resilie','expire'))`, `stripe_customer_id text`, `stripe_subscription_id text`, `periode_fin timestamptz`, `source_maj_le timestamptz not null` (horodatage de l'event Stripe appliqué — **anti-régression d'ordre**), `cree_le`, `mis_a_jour_le`.
- **Une seule policy** : `for select using (auth.uid() = utilisatrice_id)`. **Aucune** policy INSERT/UPDATE/DELETE → écriture réservée à la RPC `security definer`.

**`evenements_traites`** (registre système pur, deny-by-default intégral) :
- Colonnes : `id`, `provider_event_id text not null` **avec `unique` GLOBAL** (l'`event.id` Stripe est globalement unique et **non fourni par le client** → contrairement à `usage_ia` qui borne par utilisatrice, ici l'unicité globale est correcte), `type text not null`, `traite_le timestamptz not null default now()`. **Aucune** policy (deny-by-default).

**RPC écrivain-unique** `traiter_evenement_abonnement(...)` — `security definer`, `set search_path = ''`, `language plpgsql`, `revoke all ... from public, anon, authenticated; grant execute ... to service_role`. Corps atomique :
1. `insert into public.evenements_traites (provider_event_id, type) values (...) on conflict (provider_event_id) do nothing;` → `get diagnostics` : si **0 ligne** insérée → `return 'deja_traite'` (idempotence).
2. `select ... into ... from public.abonnement where utilisatrice_id = p_utilisatrice_id for update;` (sérialise les concurrents).
3. Si ligne existante **et** `source_maj_le > p_source_maj_le` → `return 'ignore_obsolete'` (événement plus ancien, ne pas régresser).
4. `insert into public.abonnement (...) values (...) on conflict (utilisatrice_id) do update set etat=..., stripe_...=..., periode_fin=..., source_maj_le=p_source_maj_le, mis_a_jour_le=now();`
5. `return 'traite'`.

**L'`etat` est dérivé côté domaine PUR (`etatDepuisStatutStripe`) AVANT l'appel** ; la RPC ne fait que persister l'état déjà dérivé (le CHECK est le garde-fou final). Écrivain unique = **cette RPC**. La route Checkout **n'écrit jamais** `abonnement` (elle crée seulement la session Stripe) : la ligne naît au webhook `checkout.session.completed`.

### Stripe 2026 — spécificités vérifiées (web, 2026-07-29)

- **Checkout hébergée** : `stripe.checkout.sessions.create({ mode:"subscription", line_items:[{ quantity:1, price_data:{ currency:"eur", unit_amount:6900, recurring:{ interval:"year", interval_count:1 }, product_data:{ name:"Abonnement Anima annuel" } } }], success_url, cancel_url, customer_email:user.email, client_reference_id:user.id, metadata:{ utilisatriceId:user.id }, subscription_data:{ metadata:{ utilisatriceId:user.id } } })` → rediriger sur `session.url` (303). `price_data` inline suffit en mode subscription (Price dashboard optionnel). Idempotency sortante possible : `{ idempotencyKey:"checkout:"+user.id }`.
- **Mapping utilisatrice ↔ Stripe (résout Z-4, SANS dépendance d'ordre)** : `subscription_data.metadata.utilisatriceId` fait que **tous** les `customer.subscription.*` portent l'`utilisatriceId` dans `subscription.metadata` → le webhook résout l'utilisatrice directement, jamais par lookup `customer_id` ordonné. `checkout.session.completed` la porte via `client_reference_id`/`session.metadata`.
- **Webhook — LE PIÈGE App Router** : lire **`await req.text()`** (corps BRUT) + en-tête `stripe-signature` ; `req.json()` **casse** la signature HMAC. **Pas** de `export const config = { api:{ bodyParser:false } }` (ça, c'est le Pages Router — inutile/erroné ici). `runtime="nodejs"` **obligatoire** (crypto). `stripe.webhooks.constructEvent(body, sig, secret)` (400 si throw).
- **Événements & état canonique** : l'**autorité** de l'état = `customer.subscription.created|updated|deleted` (champ `subscription.status`). `active|trialing → actif` · `canceled` (via `.deleted`, ou `.updated cancel_at_period_end=true` puis fin de période) `→ resilie` · `past_due|unpaid|incomplete_expired → expire`. `checkout.session.completed` sert à l'**activation initiale + rattachement** (pas d'état durable). `invoice.payment_succeeded|failed` = historique/relances. `charge.refunded`/`refund.created` = remboursement (accès si total). Écouter les 6.
- **Piège n°1 des tutos périmés** : `subscription.current_period_end` **SUPPRIMÉ** depuis `2025-03-31.basil` (absent en dahlia) → lire **`subscription.items.data[0].current_period_end`**.
- **Libellé relevé** : `statement_descriptor` **dynamique interdit sur cartes** depuis 2024 → en mode subscription, le libellé se règle au **niveau COMPTE** (`settings.card_payments.statement_descriptor_prefix`), pas sur la Checkout Session. 3.1 : lire la valeur depuis config (`STRIPE_STATEMENT_DESCRIPTOR`, jamais en dur) ; la **configuration compte** + la valeur finale = porte pré-lancement (entité juridique, Z-1).
- **Mode test/local** : `sk_test_`/`whsec_` ; `stripe listen --forward-to localhost:3000/api/stripe/webhook` (le `whsec_` de la CLI est stable entre redémarrages) ; `stripe trigger checkout.session.completed` ; cartes `4242…` (OK), `4000 0000 0000 9995` (échec).

### Zones grises / décisions à trancher (de la recherche)

- **Z-2 transitions fines** : période de grâce sur échec de renouvellement non spécifiée par la story. Défaut proposé : `past_due|unpaid → expire` (l'entitlement s'éteint ; le dunning fin relève de 3.5). Le passage `resilie → expire` (fin de période payée) suit `customer.subscription.deleted`.
- **Z-4 mapping** : résolu ci-dessus via `subscription_data.metadata`.
- **Z-5 double-clic « M'abonner »** : non couvert par les 6 AC. Stripe Checkout gère largement la double-session ; ajouter `idempotencyKey` sortante suffit. Ne pas sur-concevoir.
- **Z-6 RLS `abonnement`** : `abonnement` n'est pas art. 9 → échappe à la règle « RLS art.9 casse le build ». Mais l'entitlement étant la source de vérité d'accès, sa policy (SELECT propriétaire, écriture RPC-only) est posée explicitement (Task 1).

### Portes pré-lancement & différés (signaler, ne pas bloquer)

- **Compte Stripe réel + clés `sk_live`/`whsec_live` + endpoint webhook enregistré au dashboard** — porte pré-lancement (ops). Dev/test = mode test.
- **Stripe = sous-traitant art. 28** (FR-067/NFR-019) : DPA Stripe à acter (Stripe est standard mais reste un sous-traitant à documenter, comme Mistral).
- **Effacement propagé à Stripe sur fermeture de compte** (AD-14 / FR-067 / NFR-021) : la liste d'effacement art. 9 d'AD-14 **n'inclut pas** `abonnement` ; le sort des données Stripe (annulation d'abonnement + effacement client Stripe, à concilier avec les obligations légales de conservation comptable) est **sous-spécifié** → rattacher au moteur de rétention unique (Epic 6). `abonnement` et `evenements_traites` doivent entrer dans le périmètre d'effacement quand l'ordonnanceur existera.
- **Libellé de relevé bancaire (Z-1)** : valeur finale = entité juridique qui encaisse → juridique/facturation.
- **Configuration compte du `statement_descriptor_prefix`** (ops).
- **Contenu PROVISOIRE** : `ligneRetourPaiement` (registre produit) est l'intention produit, à valider avant mise en ligne.

### Project Structure Notes

Fichiers **NOUVEAUX** : `supabase/migrations/0013_abonnement.sql` · `lib/stripe/client.ts` · `lib/stripe/webhook.ts` · `lib/domain/abonnement.ts` · `lib/domain/depot-abonnement.ts` · `lib/data/depot-abonnement.ts` · `lib/data/lire-abonnement.ts` · `lib/domain/retour-paiement.ts` · `app/api/stripe/checkout/route.ts` · `app/api/stripe/webhook/route.ts` · tests (`abonnement.test.ts`, `abonnement-domaine.test.ts`, `retour-paiement.test.ts`, garde-frontière Stripe).

Fichiers **MODIFIÉS** : `package.json` + lockfile (stripe) · `tests/garde-commerciale.test.ts` (raffiner l'exclusion `app/api/**`) · `deferred-work.md` · `lib/domain/README.md` · éventuel `.env.local.example`.

**Alignement** : couches respectées (domaine pur ← données ← routes) ; migration forward-only unique = `0013` ; nommage FR snake_case ; `server-only` sur tout module à secret/écriture ; runtime Node sur les 2 routes. Fichiers de référence vérifiés existants : `tests/frontiere-serveur.test.ts`, `tests/garde-commerciale.test.ts`, `lib/domain/README.md`, `.env.example`, `lib/safety/appliquer-barriere.ts:38`.

**Conflit anticipé** : le tripwire `garde-commerciale.test.ts` matche `checkout` dans `app/api/stripe/checkout/route.ts` → **doit être raffiné** (une route API n'est pas de l'UI à envelopper d'un `<GardeCommerciale>` React ; elle applique la garde par `limitesCommercialesLevees` côté serveur). Sans ce raffinement, le build casse.

### Testing standards (repo)

- **Vitest 4.1.10, env `node` (pas de DOM)**, `tests/**/*.test.ts`, alias `@`→racine, `server-only` stubé (`tests/_stubs/server-only.ts` → modules `server-only` testables).
- Commande : **`set -a && . ./.env.local && set +a && npx vitest run`** (Vitest ne charge pas `.env.local`). Vars DB : `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY`. Supabase local via **CLI globale `supabase` v2.67.1**, **jamais `npx supabase`**.
- **Cœurs purs** (`lib/domain/`) testés en isolation (positif **ET** négatif) ; zéro import runtime infra.
- **Routes non invocables** → gardes de **lecture de source** : `sansCommentaires` (⚠️ aveugle aux chaînes), `readdirSync(recursive)` (jamais liste en dur), **contrôle positif + garde non-vacue** (`> seuil` fichiers), gardes d'ordre par `indexOf`, condition→destination liées dans **UNE** regex, grep du **nom brut** du package/variable.
- **Muter chaque garde** (casser ce qu'elle protège → confirmer ROUGE → Debug Log → reverter) : « une garde verte quand on casse ce qu'elle protège ne vaut rien ».
- Contrôle privilège **positif+négatif** (modèle `privileges-fonctions.test.ts`) pour le boot-guard : avec clé → se construit ; sans → **lève, échec dur**.
- **Ne cocher `[x]`** qu'une fois les tests existants **ET** nouveaux à 100 % verts. ⚠️ Contention DB en parallèle → faux échecs possibles ; re-run à froid / par fichier. Baseline : **65 fichiers / 790 tests** + `tsc`/`eslint`/`build` propres.

### References

- [Source: epics.md#Story-3.1] (l. 710-723) — user story, 6 AC, « Couvre : FR-056 · NFR-018 · conventions Événements externes / Data & formats ».
- [Source: epics.md#Epic-3] (l. 704-758) — objectif Epic 3, frontières 3.2/3.3.
- [Source: prd.md] — FR-056 (L185), NFR-018 (L267), FR-057 (L190), FR-061 (L194), FR-067 (L206), NFR-021 (L234), FR-043 (L135).
- [Source: ARCHITECTURE-SPINE.md] — AD-2 (frontière serveur/clé unique), convention Événements externes (l. 152), Data & formats (l. 150), AD-12 (RLS), AD-9/AD-17 (limites_levees), AD-14 (rétention), AD-4/AD-13 (art. 9), AD-1/AD-10 (couches), Stack `stripe` 22.3.x (l. 168).
- [Source: lib/ai/adapters/mistral.ts] (l. 20-63) — patron boot-guard secret serveur.
- [Source: lib/data/supabase/admin.ts] — écrivain unique `service_role`.
- [Source: supabase/migrations/0008_usage_ia.sql, 0010_episode_detresse.sql, 0012_seance.sql] — patrons RLS/idempotence/écrivain-unique/`security definer`.
- [Source: app/_commerce/GardeCommerciale.tsx, MontagePaywall.tsx, lib/safety/limites-commerciales.ts] — coutures commerciales (3.2).
- [Source: lib/safety/appliquer-barriere.ts:38] — stub `declencherRemboursement` (Epic 3).
- [Source: deferred-work.md] — coutures 2.5/2.9 (`GardeCommerciale`, gate serveur), dette « jeton de tour » (neutralisée côté Stripe par `event.id`).
- [Source: Stripe docs 2026] — versioning (SDK 22.3.2, apiVersion 2026-06-24.dahlia), checkout/sessions/create, webhooks (raw body App Router), subscription.items.data[0].current_period_end (basil), statement_descriptor (compte).

## Dev Agent Record

### Agent Model Used

Opus 4.8 (1M context) — claude-opus-4-8[1m]

### Debug Log References

- **Mutation-testing Task 1 (migration `0013`)** : 4 gardes cassées en une passe SQL live (docker exec) — `drop policy abonnement_proprietaire_lecture`, `grant execute ... to authenticated`, RPC sans `return 'deja_traite'`, RPC sans garde `source_maj_le`. Résultat : **exactement** 4 tests ROUGES (lecture propriétaire, service-role-only, idempotence, anti-régression), 5 autres verts. Restauration via `supabase db reset` → 9/9 verts. Chaque garde prouvée porteuse.
- **Mutation-testing Task 2 (frontière Stripe)** : fichier éphémère `lib/data/_mut_stripe.ts` (`import Stripe from "stripe"; process.env.STRIPE_SECRET_KEY`) → 2 tests ROUGES (SDK confiné, secret confiné). Fichier supprimé → 4/4 verts.
- **tsc — apiVersion** : le SDK `stripe@22.3.2` épingle exactement `2026-06-24.dahlia` (`node_modules/stripe/esm/apiVersion.js`) et le type `StripeConfig.apiVersion = LatestApiVersion` → l'épinglage explicite typecheck.
- **Piège dahlia confirmé** : `Subscription.current_period_end` supprimé (basil 2025-03-31) ; lu sur `SubscriptionItem.current_period_end` (`node_modules/stripe/esm/resources/SubscriptionItems.d.ts:54`).

### Completion Notes List

Ossature backend d'abonnement livrée et prouvée sur Supabase local réel + cœurs purs.

- **AC1** — route `/api/stripe/checkout` : session hébergée `subscription` à `6900` centimes EUR (constante partagée), clé secrète confinée à `lib/stripe/` (garde-frontière). Garde AD-9 (`limitesCommercialesLevees` → 409) avant la création de session.
- **AC2** — route `/api/stripe/webhook` : corps BRUT + vérif de signature AVANT tout accès DB ; idempotence par `provider_event_id` (table `evenements_traites`, `on conflict do nothing`) ; 400/500 corrects (rejeu Stripe sûr).
- **AC3** — RPC `traiter_evenement_abonnement` = écrivain UNIQUE atomique : dédup + verrou de ligne + **anti-régression d'ordre** (`source_maj_le`, Stripe n'ordonne pas) + upsert. État `actif|resilie|expire` (CHECK). Écriture client interdite.
- **AC4** — entitlement `estPremium` (pur) ⟺ `etat === 'actif'`, lu sous JWT (`lire-abonnement`), source de vérité unique. Non dupliqué.
- **AC5** — `ligneRetourPaiement` (pur) : ligne sobre, registre produit, passe le lexique. Rendu in-fil → 3.2.
- **AC6** — libellé de relevé lu depuis config (`STRIPE_STATEMENT_DESCRIPTOR`), jamais en dur ; application compte = porte ops.
- **Décisions** : mapping compte↔Stripe via `subscription_data.metadata.utilisatriceId` (sans dépendance d'ordre) ; SDK Stripe isolé dans `lib/stripe/` (miroir adaptateur Mistral) ; tripwire `garde-commerciale` raffiné (routes `app/api/**` gardées par `limitesCommercialesLevees`, pas par la balise React).
- **Différé (documenté)** : carte/prix/bouton = 3.2 ; gardes par fonctionnalité = 3.3/3.4 ; remboursement = 3.5 ; portes pré-lancement (clés live, DPA Stripe, effacement propagé, libellé/entité juridique).

### File List

**Nouveaux :**
- `supabase/migrations/0013_abonnement.sql`
- `lib/stripe/client.ts`, `lib/stripe/config.ts`, `lib/stripe/webhook.ts`, `lib/stripe/evenement-abonnement.ts`
- `lib/domain/abonnement.ts`, `lib/domain/depot-abonnement.ts`, `lib/domain/retour-paiement.ts`
- `lib/data/depot-abonnement.ts`, `lib/data/lire-abonnement.ts`
- `app/api/stripe/checkout/route.ts`, `app/api/stripe/webhook/route.ts`
- `tests/abonnement.test.ts`, `tests/abonnement-domaine.test.ts`, `tests/frontiere-stripe.test.ts`, `tests/stripe-checkout.test.ts`, `tests/stripe-webhook.test.ts`, `tests/lire-abonnement.test.ts`, `tests/retour-paiement.test.ts`

**Modifiés :**
- `package.json`, `package-lock.json` (dépendance `stripe@22.3.2`)
- `tests/garde-commerciale.test.ts` (raffinement tripwire + allowlist consommateur route)
- `.env.example` (variables Stripe)
- `lib/domain/README.md` (section 3.1)
- `_bmad-output/implementation-artifacts/deferred-work.md` (coutures & portes 3.1)

## Change Log

| Date | Version | Description | Auteur |
|---|---|---|---|
| 2026-07-29 | v0.1 | create-story — ingénierie de contexte (6 lecteurs parallèles), story rédigée, ready-for-dev | create-story (Opus 4.8) |
| 2026-07-29 | v1.0 | dev-story — 6 tâches TDD, 838 tests verts (tsc/eslint/build propres), mutation-testing des gardes ; statut → review | dev-story (Opus 4.8) |
| 2026-07-29 | v1.1 | Revue adversariale (6 dimensions × vérif, 23 trouvailles retenues) — corrections HAUTES/MOYENNES appliquées (voir ci-dessous) | code-review (Sonnet finders / Opus verify) |

### Revue adversariale 3.1 — trouvailles & corrections

Revue multi-agents (6 dimensions sur Sonnet 5, vérification adversariale sur Opus) : 29 trouvailles, 23 retenues (8 HAUTES). Corrections appliquées :

- **[HAUTE #1/#4/#7 — race de concurrence, la headline]** `FOR UPDATE` ne verrouille RIEN sur une ligne inexistante (pas de gap-lock Postgres) → deux events concurrents sur une **nouvelle** abonnée sautaient tous deux l'anti-régression, et le `do update` inconditionnel laissait l'event le plus ancien écraser le récent (régression permanente d'entitlement). **Corrigé (migration `0014`)** : `pg_advisory_xact_lock` par utilisatrice en tête (sérialise même sans ligne) + clause `where source_maj_le <= excluded.source_maj_le` sur le `do update` (anti-régression atomique). **Test de concurrence réel ajouté** (`Promise.all` racé 12×) — ROUGE sur 0013, VERT sur 0014.
- **[HAUTE #2/#10 — clé idempotence statique]** `checkout:${user.id}` → Stripe met la session en cache 24 h → réabonnement dans la fenêtre recevait la MÊME session déjà réglée. **Corrigé** : clé d'idempotence retirée (chaque appel = session neuve ; double-clic inoffensif, webhook idempotent par event.id). Test source-read anti-clé-statique.
- **[HAUTE #3/#21 — mapping absent silencieux]** un `customer.subscription.*` sans `metadata.utilisatriceId` renvoyait `null` sans trace. **Corrigé** : `estTypeEtatAbonnement` exporté ; la route journalise l'anomalie (ids Stripe non-art.9) en distinguant le NO-OP attendu.
- **[HAUTE #5 — garde AD-9 non exercée]** prouvée seulement par `indexOf`. **Corrigé** : `tests/stripe-checkout-garde.test.ts` invoque réellement `POST()` (mocks) → 409 + `sessions.create` jamais appelé ; regex source-read durcie (condition→409 liées).
- **[HAUTE #6/#11 — interpréteur non testé]** `interpreterEvenementAbonnement` (extraction metadata/periodeFin/types) sans aucun test. **Corrigé** : `tests/evenement-abonnement.test.ts` (7 cas, dont NO-OP + mapping absent + periodeFin sur l'item).
- **[HAUTE #8 — chemin d'erreur dépôt non testé]** **Corrigé** : test que `depot.traiterEvenement` avec état invalide `rejects.toThrow` (→ 500 → rejeu).
- **[HAUTE #18 — boot-guards non testés]** **Corrigé** : `tests/stripe-boot-guard.test.ts` (clientStripe + verifierEvenementStripe, positif+négatif, `resetModules`).
- **[MOYENNE #14 — atomicité dédup]** **Corrigé** : test que l'insert `evenements_traites` est annulé par le rollback si la projection échoue.
- **[MOYENNE #15 — periode_fin écrasée par null]** **Corrigé (`0014`)** : `coalesce(excluded.periode_fin, …)`.
- **[MOYENNE #13 — base URL depuis Host non validé]** **Corrigé** : origine de redirection lue depuis `NEXT_PUBLIC_SITE_URL` (repli origine requête en dev).
- **[MOYENNE #16/#17 — gardes source-read élargies]** **Corrigé** : couplage `unit_amount ↔ constante` en une regex ; `.json()` ancré à `request`.
- **[BASSE #20 — index redondant]** **Corrigé (`0014`)** : `drop index abonnement_utilisatrice_idx` (la contrainte `unique` suffit).
- **Différés documentés (deferred-work § 3.1)** : #9/#12 (ordre des events à la seconde près — `event.created` en secondes, repli sur l'ordre d'arrivée, rare), #19 (réutilisation du `customer` Stripe entre tentatives), #23 (le grep de frontière n'attrape pas un import construit dynamiquement — limitation partagée avec `frontiere-serveur`). 6 trouvailles réfutées à la vérif.
