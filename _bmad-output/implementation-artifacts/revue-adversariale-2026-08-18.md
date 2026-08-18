# Revue adversariale du 2026-08-18 — les 33 trouvailles retenues

**Six angles indépendants, 35 candidates, un sceptique par candidate avec consigne de RÉFUTER.**
27 confirmées, 6 plausibles, 2 réfutées. Elle a été lancée pour solder les 16 trouvailles que la
revue des Epics 1 à 4 n'avait jamais examinées (plafond d'agents atteint) ; elle a couvert bien plus
large, et les quatre trouvailles nommées de cette revue-là — #14, #15, #16 et #8 — en étaient
explicitement exclues.

> **Ce document est le solde vivant.** Chaque ligne fermée se barre ici, avec le commit qui l'a
> fermée. Ne pas en faire une seconde liste ailleurs : c'est ainsi que les 31 trouvailles de la QA
> tour 1 s'étaient éparpillées dans `sprint-status.yaml` jusqu'à ce qu'on ne puisse plus lire
> « où en est-on ».

## En une ligne

**8 hautes confirmées · 4 hautes plausibles · 15 moyennes confirmées · 2 moyennes plausibles · 4 basses.**
Trois d'entre elles coûtent de l'argent à quelqu'un, une rend le seul chemin d'abonnement
inatteignable, une casse la sortie de secours, et une laisse un compte en prendre un autre en otage.

---


## Hautes

### R1 — L'effacement total (art. 17) supprime le compte sans jamais annuler la souscription chez Stripe : la carte est débitée de 69 € pour un compte qui n'existe plus.

- **Verdict** : CONFIRME · **angle** : 
- **Où** : `app/mes-donnees/actions.ts:35`
- **Scénario** : Une abonnée active va sur /mes-donnees, coche la confirmation, `effacerTout` appelle `effacerToutesSesDonnees` → RPC `effacer_toutes_mes_donnees` (0058/0059) qui fait `delete from public.utilisatrice` + `delete from auth.users`. Aucun appel à `lib/stripe/*` sur ce chemin (grep : `resilierEnFinDePeriode` n'apparaît que dans `app/(auth)/consentement/actions.ts`, `app/api/abonnement/resilier/route.ts` et `lib/stripe/resiliation.ts`). La souscription Stripe reste `active`, `cancel_at_period_end = false`. À la date anniversaire, 69 € sont prélevés. Et rien ne peut le signaler : `reserver_information_reconduction` rend `false` sur compte absent (0044) donc le courriel L215-1 ne part pas, et `traiter_evenement_abonnement` rend `compte_absent` donc aucune projection. Plus de compte, plus de page /abonnement, plus de session : le seul recours est une opposition bancaire. C'est exactement le défaut M7 corrigé en 2026-08-11 dans `app/(auth)/consentement/actions.ts:93-107` — la garde n'a jamais été portée sur le chemin d'effacement de l'Epic 6, qui est celui qu'emprunte une utilisatrice installée.

<details><summary>Ce que le sceptique a trouvé en cherchant à réfuter</summary>

```
LIGNE FAUTIVE — /Users/juliantalou/anima-app/app/api/stripe/checkout/route.ts:144-148

  const { data: dejaAbonnee } = await supabase
    .from("abonnement")
    .select("etat, stripe_subscription_id")
    .maybeSingle<{ etat: string; stripe_subscription_id: string | null }>();
  if (dejaAbonnee?.stripe_subscription_id) { … }

L'`error` de PostgREST n'est pas destructurée. Le client est un `createServerClient` nu (/Users/juliantalou/anima-app/lib/data/supabase/server.ts, aucun `throwOnError`) : une erreur PostgREST rend `{ data: null, error }` sans lever. `dejaAbonnee` vaut donc `null`, `dejaAbonnee?.stripe_subscription_id` est falsy, et TOUT le bloc M9/R1 — y compris l'interrogation de Stripe et le refus `contrat_ouvert` — est sauté silencieusement. On tombe directement sur `checkout.sessions.create` (ligne 208).

J'AI CHERCHÉ LA GARDE AILLEURS — ELLE N'EXISTE PAS
- Base : `abonnement` (0013) n'a QU'une policy SELECT propriétaire ; aucune contrainte, aucun trigger ne peut empêcher la création d'une session Checkout chez Stripe. Le webhook (`traiter_evenement_abonnement`, 0014) ne fait qu'un upsert une-ligne-par-utilisatrice sous verrou consultatif : il ne détecte ni n'annule une seconde souscription vivante.
- Appelants : `checkout.sessions.create` n'apparaît que dans ce fichier (grep sur tout le dépôt hors node_modules).
- Tests : /Users/juliantalou/anima-app/tests/stripe-checkout-garde.test.ts couvre `data: null` (compte gratuit), les statuts Stripe, et « Stripe illisible → on REFUSE ». Aucun test n'injecte `{ data: null, error }` sur la lecture `abonnement`. Le mutant vit.

SCÉNARIO CONCRET (état + entrées → tort)
1. Ligne `abonnement` : `utilisatrice_id = u1`, `etat = 'expire'`, `stripe_subscription_id = 'sub_A'`, `resiliation_demandee_le = NULL`. Chez Stripe, `sub_A.status = 'past_due'` (carte refusée, relances en cours) — projeté `expire` chez nous.
2. `/abonnement` lui montre simultanément « Ton abonnement n'est plus actif », le bouton « Résilier » (`contratOuvert = abonnement?.subscriptionId != null`, page.tsx ~l.142) ET l'offre `MontagePaywall` avec « M'abonner » (page.tsx ~l.252 : `etape === "suite" && (!abonnement || (!actif && !resiliationDemandee))`). C'est exactement le cas R1 pour lequel le bloc de la ligne 148 a été écrit.
3. Elle clique « M'abonner » (form HTML, POST). `getUser` OK, `limitesCommercialesLevees` false, `etapeOnboardingPour` rend "suite", `clientStripe()` OK.
4. Le SELECT ligne 144 échoue : statement_timeout (57014) sur cette requête, reset de connexion du pooler, ou 5xx PostgREST transitoire.
5. Le bloc entier est sauté → […]
```
</details>

### R2 — Une fois la résiliation ABOUTIE, /abonnement devient un cul-de-sac : plus aucune offre, un bouton « Reprendre » qui échoue systématiquement, et « actif jusqu'au <date passée> ».

- **Verdict** : CONFIRME · **angle** : 
- **Où** : `app/abonnement/page.tsx:253`
- **Scénario** : Elle résilie (`cancel_at_period_end = true`, seul chemin du produit). À l'échéance Stripe émet `customer.subscription.deleted` avec `status = canceled` et `cancel_at` TOUJOURS renseigné ; `interpreterEvenementAbonnement` projette donc `etat = 'resilie'` ET `resiliation_demandee_le` non nul (écrasement franc, 0038/0044). Sur la page : `actif = false`, `resiliationDemandee = true`. Conséquences en chaîne — (1) le bloc d'état ligne 197 affiche ETAT_RESILIE + « actif jusqu'au … » avec une date révolue ; (2) le geste ligne 210 n'offre QUE « Reprendre », qui POSTe `?reprendre=1` → `subscriptions.update` sur une souscription `canceled`, refusé par Stripe (« a canceled subscription can only update its metadata ») → `/abonnement?etat=echec`, à chaque fois ; (3) ligne 253, `(!abonnement || (!actif && !resiliationDemandee))` est FAUX, donc `MontagePaywall` n'est jamais monté. Or depuis la 3.6 cette page est le seul chemin d'abonnement d'un compte sans branche. La route Checkout, elle, l'accepterait (`contratStripeVivant('canceled')` = faux) : il n'existe simplement plus aucun bouton pour l'appeler. Toute personne ayant résilié une fois est définitivement inencaissable, et lit un état faux sur la page qui parle d'argent.

<details><summary>Ce que le sceptique a trouvé en cherchant à réfuter</summary>

```
J'ai cherché la garde partout où elle pourrait vivre (appelant, RPC, policy, trigger, contrainte, webhook, ordonnanceur, tests) : elle n'existe nulle part sur ce chemin.

CE QUE J'AI LU

1. `app/mes-donnees/actions.ts` — les imports (lignes 3-6) sont `next/navigation`, `supabase/server`, `effacerToutesSesDonnees`, `journaliserIncidentSecurite`. AUCUN `lib/stripe/*`. Le corps utile est trois gestes : `getUser()`, le contrôle de la case (ligne 32), puis ligne 35 `await effacerToutesSesDonnees(supabase);`. Rien entre les deux.

2. `lib/data/effacer-donnees.ts:22` — un seul appel : `supabase.rpc("effacer_toutes_mes_donnees", { p_fenetre_pitr_jours })`. Aucun Stripe.

3. Le moteur SQL, dans sa version en vigueur (`0061_revue_epic_6.sql:223-280`, qui remplace 0059/0058) : trace dans `effacement`, puis `delete from public.branche`, `delete from public.utilisatrice`, `delete from auth.users`. Aucun appel sortant possible (pas de `pg_net`, pas de file d'attente de résiliation — j'ai vérifié : aucune table ni RPC de ce genre n'existe).

4. La garde M7 n'existe QUE dans `app/(auth)/consentement/actions.ts:82-107` (`resilierEnFinDePeriode` avant `deleteUser`, avec suspension si Stripe est injoignable). Le grep sur tout le dépôt ne donne que trois consommateurs de `resilierEnFinDePeriode` : ce fichier, `app/api/abonnement/resilier/route.ts:152`, et `lib/stripe/resiliation.ts`. Le test dédié `tests/effacement-stripe.test.ts:77` n'importe que `refuser` et `supprimerCompteRevoque` — il ne touche jamais `effacerTout`. La garde est donc bien restée sur le chemin de l'onboarding et n'a jamais été portée sur celui de l'Epic 6.

5. Rien ne peut rattraper après coup : `supabase/migrations/0013_abonnement.sql:27` porte `references public.utilisatrice(id) on delete cascade` — la ligne `abonnement`, donc `stripe_subscription_id`, disparaît dans la même transaction. Il ne reste plus rien à annuler ni de quoi savoir quoi annuler.

6. Et le silence est complet : `0044_webhook_robustesse.sql:195-196` — `if not exists (select 1 from public.utilisatrice u where u.id = p_utilisatrice) then return false;` dans `reserver_information_reconduction` : le courriel L215-1 ne part pas. `app/api/stripe/webhook/route.ts` ne traite nulle part la valeur `compte_absent` rendue par `traiter_evenement_abonnement` (0044:122) : la route répond 200 et ne fait rien.

SCÉNARIO CONCRET (entrées → tort)
Une abonnée dont `abonnement.etat = 'actif'`, `stripe_subscription_id = 'sub_X'`, `periode_fin = 2027-03-04`. Elle ouvre `/mes-donnees`, coche « J'ai compris que tout disparaît », soumet. `effacerTout` → RPC […]
```
</details>

### R3 — La garantie FR-089 est refusée en silence à qui y a droit après un réabonnement — avec un faux « le remboursement arrive sur ton moyen de paiement ».

- **Verdict** : CONFIRME · **angle** : 
- **Où** : `app/api/abonnement/remboursement/route.ts:66`
- **Scénario** : `remboursement` a `utilisatrice_id` en clé primaire et n'est jamais purgée (0038). Janvier 2026 : elle s'abonne, ne pose aucune branche, obtient la garantie en mai — `confirme_le` posé. La souscription court jusqu'à janvier 2027 puis meurt. Février 2027 : elle se réabonne (le Checkout l'autorise, contrat mort). Le webhook réécrit `debut_le` avec le `start_date` de la nouvelle souscription. Juin 2027 : `eligible_au_remboursement()` rend `true` (actif, > 3 mois, aucune branche) et /abonnement affiche le bouton de garantie. Au clic, `demander_remboursement` retrouve la ligne de 2026 → `deja_demande = true`, `confirme_le` non nul → cette ligne 66 renvoie `vers("rembourse")` SANS jamais appeler Stripe. L'écran affiche SUCCES_REMBOURSEMENT (« C'est demandé. Le remboursement arrive sur ton moyen de paiement. ») puis, en permanence, REMBOURSEMENT_CONFIRME — celui d'il y a un an. Aucun `console.error`, aucune trace : elle attend un virement de 69 € qui ne partira jamais, et le produit affirme qu'il est parti. Même trou côté minorité : `lib/safety/appliquer-barriere.ts:96` sort par le même prédicat.

<details><summary>Ce que le sceptique a trouvé en cherchant à réfuter</summary>

```
DÉFAUT CONFIRMÉ — un remboursement intégral n'éteint l'accès premium à aucun endroit du dépôt.

LIGNE FAUTIVE
`lib/stripe/resiliation.ts:142` (dans `rembourserIntegralement`) :
    await resilierEnFinDePeriode(subscriptionId);
qui ne fait que (ligne 31) :
    subscriptions.update(subscriptionId, { cancel_at_period_end: true })
puis lignes 146-154 :
    stripe.refunds.create({ payment_intent, metadata }, { idempotencyKey })  — SANS `amount`, donc 6900 centimes rendus en totalité (`lib/stripe/config.ts:9`).

ENTRÉES CONCRÈTES → TORT
1. Compte U, souscription annuelle 69 € le 2026-01-01 : `abonnement.etat='actif'`, `debut_le='2026-01-01'`, `stripe_subscription_id='sub_X'`, aucune ligne dans `branche`.
2. Le 2026-04-05 elle clique « Demander le remboursement » (`app/abonnement/page.tsx:264` → POST `/api/abonnement/remboursement`).
3. `demander_remboursement` accepte : `eligible_au_remboursement` (0038) exige seulement `etat='actif'` + `debut_le <= now() - interval '3 months'` + aucune branche — les trois sont vrais, et il n'y a AUCUNE borne haute.
4. `rembourserIntegralement` pose `cancel_at_period_end=true` puis rembourse 6900 centimes.
5. Chez Stripe, `subscription.status` reste `active` jusqu'au 2026-12-31 ; `etatDepuisStatutStripe` (`lib/domain/abonnement.ts:21-31`) rend donc `actif` — son propre en-tête (lignes 16-19) le dit noir sur blanc.
6. `estPremium` (`lib/domain/abonnement.ts:62-64`) et `est_premium_courante()` (`supabase/migrations/0036_intention_arbitrage.sql:152-165`) ne testent QUE `abonnement.etat = 'actif'` : elles rendent `true`.
7. Résultat : du 2026-04-05 au 2026-12-31 (≈ 9 mois), U conserve la création de branches (`0037:41,101`), les plans d'étapes (`0036:255,272`), la lecture premium (`0051:207`) et l'allocation — après avoir récupéré l'intégralité des 69 €.

LA GARDE N'EXISTE NULLE PART (vérifié, pas supposé)
- `confirmer_remboursement` (0038) ne modifie que `remboursement.confirme_le` ; `demander_remboursement` ne touche jamais `abonnement`.
- `grep "update public.abonnement"` sur toutes les migrations : une seule occurrence, le backfill 0038:73. Aucun trigger, aucune contrainte CHECK, aucune policy ne relie `remboursement` à l'entitlement.
- `app/api/stripe/webhook/route.ts:53-70` : sur `refund.created`, on écrit `confirme_le`, rien d'autre.
- `app/api/abonnement/remboursement/route.ts:73-84` : la route ne ferme aucun accès.
- Migrations 0061 et 0072 (les plus récentes touchant l'abonnement) prédiquent encore sur `a.etat = 'actif'` seul.

LA PRÉMISSE EST FAUSSE SUR CE CHEMIN
L'en-tête de `resilierEnFinDePeriode` (lignes 20-22) just […]
```
</details>

### R4 — La réserve du moteur de rétention (`RESERVE_RETENTION_MS` = 2 400 ms) est plus courte que l'opération qu'elle protège : `annoncer()` n'est borné nulle part dans le job, et l'adaptateur Resend porte son propre délai de 10 000 ms. Le job peut donc entrer dans une itération avec 2,5 s de budget et se faire couper entre l'envoi de l'avis et la pose de l'échéance.

- **Verdict** : CONFIRME · **angle** : 
- **Où** : `lib/ordonnanceur/jobs/retention.ts:112`
- **Scénario** : Phase 2, un compte inactif, Resend lent (ce pourquoi son délai de 10 s existe). Il reste 4 000 ms sur les 12 000 du job : 4 000 > 2 400, la boucle entre. `annoncerInactivite` poste le courriel « Ton compte va être supprimé » et rend `true` à t+10 s ; `avecDelai` du répartiteur a déjà rejeté le job à t+12 s (ligne 97 d'`executer.ts`). `poserEcheance` (ligne 121) n'est jamais appelé, ou l'est et est abandonné. Résultat : l'avis est parti, `echeance_suppression` reste `null`, donc `comptes_a_prevenir` re-sélectionne la personne demain et lui renvoie le même avis — chaque jour tant que l'envoi traîne. En prime la fenêtre est close en `echoue` avec un `job_echoue` mensonger (la phase 1 a peut-être effacé correctement) et la phase 3 est sautée. `rappel-echeance.ts:71` documente exactement cette règle (« le budget d'un job ne peut pas être plus court que la plus longue opération qu'il contient ») et borne son envoi à 4 s ; la rétention n'a repris ni la borne ni la réserve.

<details><summary>Ce que le sceptique a trouvé en cherchant à réfuter</summary>

```
LIGNE FAUTIVE (deux emplacements, tous deux vivants) :
- `supabase/migrations/0059_retention_automatique.sql:159-160` — `comptes_a_prevenir`, jamais recréée depuis :
  `and not exists (select 1 from public.abonnement a where a.utilisatrice_id = u.id and a.etat = 'actif')`
- `supabase/migrations/0061_revue_epic_6.sql:139-140` — version COURANTE de `trancher_echeance_suppression` (elle supersède le 0059:245 cité par la trouvaille, mais reconduit le prédicat mot pour mot) :
  `or exists (select 1 from public.abonnement a where a.utilisatrice_id = p_utilisatrice_id and a.etat = 'actif')`

POURQUOI LE PRÉDICAT EST FAUX — LE DÉPÔT LE DIT LUI-MÊME :
- `lib/domain/abonnement.ts:22-29` : `etatDepuisStatutStripe` a un `default: return "expire"` — `past_due`, `unpaid`, `incomplete`, `paused` y tombent tous.
- `lib/domain/abonnement.ts:34-49` : « ce sont des souscriptions que Stripe RELANCE et finira par encaisser […] Notre projection à trois valeurs les confond avec `incomplete_expired`, qui est mort. »
- `app/api/stripe/checkout/route.ts:105-127` : « `etat === "actif"` ne dit PAS “il existe un contrat” […] `expire` confond `past_due` (vivant) avec `incomplete_expired` (mort). » `contratStripeVivant` n'est utilisé QUE là (`route.ts:152`) — vérifié par grep sur tout le dépôt.
- `lib/stripe/evenement-abonnement.ts:58` écrit cet `etat` en base via `traiter_evenement_abonnement` : une carte refusée devient bien `expire` dans `public.abonnement`.

ENTRÉES CONCRÈTES PRODUISANT LE TORT (défauts en vigueur : INACTIVITE=24 mois, PREAVIS=3 mois, `lib/domain/retention.ts:19,29`) :
1. Utilisatrice U, `utilisatrice.cree_le = 2024-01-10`, abonnée annuelle (69 €/an) depuis ce jour, qui PAIE SANS JAMAIS OUVRIR L'APPLICATION — le cas que l'encadré de 0059:19-23 nomme explicitement. Aucune ligne dans `entree_journal`/`tirage`/`lecture`/`branche`, donc `derniere_activite(U) = cree_le = 2024-01-10` (0059:53-60, qui exclut délibérément `abonnement`).
2. 2026-01-10 : reconduction, la carte a expiré. Stripe envoie `customer.subscription.updated` avec `status = past_due` → `abonnement.etat = 'expire'`. Le tableau de bord Stripe est réglé sur « laisser past_due » ou « marquer unpaid » (deux des trois réglages standards) : la souscription reste VIVANTE, la facture reste ouverte et encaissable.
3. Tick du 2026-01-11 : `comptes_a_prevenir(24, 50)` sélectionne U — `echeance_suppression is null`, `mineur_detecte = false`, `derniere_activite <= now() - 24 mois`, et le `not exists ... etat = 'actif'` est SATISFAIT puisque l'état vaut `expire`. Courriel « ton compte sera supprimé », `echeance_supp […]
```
</details>

### R5 — /aide est prérendue STATIQUEMENT : ses scripts n'ont aucun nonce, la CSP `script-src 'nonce-…' 'strict-dynamic'` posée par proxy.ts les bloque tous, la page ne s'hydrate jamais et le bouton « Quitter » (sortie rapide, FR-074) ne fait rien.

- **Verdict** : CONFIRME · **angle** : 
- **Où** : `app/aide/page.tsx:31`
- **Scénario** : Vérifié dans la sortie de build, pas déduit. `.next/prerender-manifest.json` classe `/aide`, `/cgu` et `/_not-found` en `"compute": "static"` ; `grep -o 'nonce="[^"]*"' .next/server/app/aide.html` rend ZÉRO résultat, alors que le fichier contient une douzaine de `<script src="/_next/static/chunks/…">`. La doc Next livrée dans ce dépôt (`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`) le dit mot pour mot : « To use a nonce, your page must be dynamically rendered […] Static pages are generated at build time, when no request or response headers exist—so no nonce can be injected. » Or `proxy.ts` sert quand même `/aide` avec `script-src 'self' 'nonce-XXX' 'strict-dynamic'` — et `'strict-dynamic'` fait IGNORER `'self'` par le navigateur. Résultat en production : une femme sur /aide, avec quelqu'un de dangereux dans la pièce, appuie sur « Quitter » (`app/aide/SortieRapide.tsx`, `"use client"`, `onClick` → `window.location.replace`) et la page reste affichée. Le défaut est invisible : `style-src 'self' 'unsafe-inline'` n'a pas de `strict-dynamic`, donc la feuille de style se charge et l'écran paraît normal. Même effet sur `/cgu` et sur la 404, et `CouvercleConfidentialite` (monté dans `app/layout.tsx`, AC5) ne s'arme sur aucune des trois. `tests/csp-proxy.test.ts` ne peut pas le voir : il ne lit que la source de `proxy.ts` et la fabrique de directives. Correctif : `export const dynamic = "force-dynamic"` (ou `await connection()`) sur les pages statiques restantes.

<details><summary>Ce que le sceptique a trouvé en cherchant à réfuter</summary>

```
J'ai essayé de réfuter, je n'y suis pas arrivé : le défaut est reproduit dans un vrai navigateur, sur un vrai `next start` en production.

**1. La ligne fautive : ce que /aide n'écrit PAS.**
`/Users/juliantalou/anima-app/app/aide/page.tsx` — le fichier va des imports (l.1-7) à `export const metadata = { title: "Anam" }` (l.10) puis directement à `export default function PageAide()` (l.31). AUCUN `export const dynamic`. Le commentaire de tête le revendique même : « PAGE STATIQUE et PUBLIQUE ». Or 18 autres fichiers du dépôt posent la garde (`app/ancrages/page.tsx:27`, `app/reglages/page.tsx:23`, `app/memoire/page.tsx:25`, `app/lectures/page.tsx:20`, `app/abonnement/page.tsx:13`, `app/mes-donnees/page.tsx:15` …). `/aide`, `/cgu` et `app/not-found.tsx` sont les trois pages qui ne l'ont pas — et ce sont exactement les trois pages accessibles sans compte.

**2. La CSP est bien posée sur ces routes.** `proxy.ts` l.55-67 : hors `/api`, `const nonce = …randomUUID()` puis `cspPageArt9(nonce, …)` sur la requête ET `response.headers.set("Content-Security-Policy", csp)` sur la réponse ; le `matcher` (l.77-79) n'exclut que `_next/static`, `_next/image`, `favicon.ico`, `scene/` et les images. `lib/ai/entetes-art9.ts` (`cspPageArt9`) produit en production : `script-src 'self' 'nonce-…' 'strict-dynamic'` — et `'strict-dynamic'` fait ignorer `'self'` par le navigateur.

**3. Mesures runtime (`next build` du jour + `npx next start -p 3987`, NODE_ENV=production).**
- `.next/prerender-manifest.json` : `/aide` → `"compute": "static"`, `"response": "complete"` (idem `/cgu`, `/_not-found`).
- En-têtes réels de `GET /aide` : `x-nextjs-prerender: 1`, `x-nextjs-cache: HIT`, et pourtant `content-security-policy: … script-src 'self' 'nonce-NTY5ZWUyMmYt…' 'strict-dynamic'; …`.
- Corps servi : **16 balises `<script>`, ZÉRO attribut `nonce=`**. La charge Flight contient littéralement `"nonce":"$undefined"` (6 occurrences) — c'est Next qui déclare lui-même n'avoir aucun nonce à mettre.
- Comparaison sur le même serveur : `/aide` → 0 nonce, `/cgu` → 0, une 404 → 0, `/entrer` (dynamique) → **20 nonces**. Le mécanisme marche partout ailleurs ; il est mort sur les trois pages statiques.

**4. Le tort, mesuré au navigateur (Playwright, Chromium).** Sur `http://127.0.0.1:3987/aide` :
- 16 violations `Loading the script 'http://127.0.0.1:3987/_next/static/chunks/….js' violates the following Content Security Policy directive: "script-src 'self' 'nonce-…' 'strict-dynamic'"` — tous les chunks bloqués, y compris `turbopack-….js` et le runtime React.
- `window.__next_f === undefined` : la page ne  […]
```
</details>

### R6 — `form-action 'self'` bloque la redirection 303 du Checkout vers checkout.stripe.com sur Chrome et Safari : le seul chemin d'abonnement du produit est inatteignable.

- **Verdict** : CONFIRME · **angle** : 
- **Où** : `lib/ai/entetes-art9.ts:57`
- **Scénario** : Les deux uniques points de souscription sont des formulaires natifs — `app/_commerce/MontagePaywall.tsx:109` et `render/conversation/CarteAbonnement.tsx:77`, tous deux `<form method="post" action="/api/stripe/checkout">`, délibérément sans JavaScript. La route répond `NextResponse.redirect(session.url, 303)` vers `https://checkout.stripe.com/…`. La CSP du DOCUMENT qui porte le formulaire (posée par `proxy.ts` pour toutes les pages, dont `/abonnement` et la scène) contient `form-action 'self'`, et Chrome comme Safari appliquent `form-action` à la CIBLE DE REDIRECTION d'une soumission de formulaire (Firefox, lui, ne le fait pas depuis le bug 1354493). Scénario : une utilisatrice sous Chrome ouvre `/abonnement`, clique « M'abonner » ; la navigation est refusée (« Refused to send form data to 'https://checkout.stripe.com/…' because it violates the following Content Security Policy directive: form-action 'self' »), elle reste sur la page sans message. Aucun test ne peut l'attraper : `tests/stripe-checkout-garde.test.ts` teste la route en node et se contente d'une URL simulée. Le mot `checkout.stripe.com` n'apparaît nulle part dans la CSP du dépôt (`grep -rn form-action` → une seule occurrence, celle-ci).

<details><summary>Ce que le sceptique a trouvé en cherchant à réfuter</summary>

```
LIGNE FAUTIVE : lib/ai/entetes-art9.ts:57 — `"form-action 'self'",` dans le tableau retourné par `cspPageArt9(nonce, { dev })`. C'est la SEULE occurrence de `form-action` du dépôt (grep -rn hors node_modules/.next → 1 ligne). Aucune autre source de CSP n'existe : `next.config.ts` fait 5 lignes sans `headers()`, `vercel.json` ne contient que le cron, et le seul `meta http-equiv` du dépôt est dans `lib/domain/export-lisible.ts:293` (fichier d'export, pas une page servie).

CHAÎNE VÉRIFIÉE DANS LE CODE :
1. proxy.ts:45-62 — tout pathname qui n'est ni `/api` ni `/api/…` reçoit `const csp = cspPageArt9(nonce, …)` (l.51) posé sur la RÉPONSE : `response.headers.set("Content-Security-Policy", csp)` (l.61). Le matcher (l.72-74) n'exclut que `_next/static`, `_next/image`, `favicon.ico`, `scene/` et les extensions d'images/polices — `/abonnement` et `/` sont donc des documents porteurs de `form-action 'self'`.
2. app/_commerce/MontagePaywall.tsx:109 → `<form method="post" action="/api/stripe/checkout">` (sans `target`, sans JS), monté par app/abonnement/page.tsx:257.
   render/conversation/CarteAbonnement.tsx:77 → même formulaire, monté par render/conversation/Fil.tsx:203.
   `grep -rn "api/stripe/checkout"` ne trouve aucun autre point de souscription hors tests et scripts verif-*.
3. app/api/stripe/checkout/route.ts:241 → `return NextResponse.redirect(session.url, 303);` — `session.url` est l'URL Checkout hébergée (checkout.stripe.com), cross-origine. Les huit autres sorties de la route (l.49, 58, 88, 141, 164, 195, 232, 239) sont same-origin : SEULE la sortie nominale est cross-origine, donc seul le succès casse.

POINT TECHNIQUE : `form-action` ne retombe PAS sur `default-src`. Sans la ligne 57 il n'y aurait aucune restriction — la ligne 57 est bien la cause, pas un effet de bord. Vérifié en ligne le jour même : MDN (CSP form-action) porte toujours l'avertissement « Whether form-action should block redirects after a form submission is debated and browser implementations of this aspect are inconsistent (e.g., Firefox 57 doesn't block the redirects whereas Chrome 63 does) » ; l'état courant reste Chrome + Safari bloquent la cible de redirection, Firefox non (w3c/webappsec-csp#8 toujours ouvert).

RÉFUTATIONS TENTÉES ET ÉCHOUÉES :
- tests/csp-proxy.test.ts couvre connect-src, nonce, strict-dynamic, unsafe-eval, style-src, base-uri, object-src, frame-ancestors — jamais form-action, et jamais un navigateur.
- tests/stripe-checkout-garde.test.ts:50 fabrique une `NextRequest` node et mocke `sessions.create` : le 303 est lu comme une chaîne, aucune CSP n'existe dans ce  […]
```
</details>

### R7 — `abonner_poussee` est `security definer`, accordée à `authenticated`, et supprime une ligne d'`abonnement_poussee` sur le seul `endpoint` fourni par l'appelante — sans aucun contrôle de propriété. C'est la seule écriture inter-comptes du schéma.

- **Verdict** : CONFIRME · **angle** : 
- **Où** : `supabase/migrations/0053_socle_quotidien_poussee.sql:355`
- **Scénario** : Mallory possède un compte Anima ordinaire. Elle obtient l'endpoint de poussée de Bérénice (il voyage en clair dans l'export RGPD de Bérénice, cf. 0057, et dans les journaux du service de poussée). Elle appelle `POST /rest/v1/rpc/abonner_poussee {p_endpoint: "https://fcm.googleapis.com/…<endpoint de Bérénice>", p_p256dh: <87 car. base64url valides>, p_auth: <22 car.>}` sous son propre JWT. Le corps exécute `delete from public.abonnement_poussee where endpoint = p_endpoint` en `security definer` : la RLS ne s'applique pas, la ligne de Bérénice disparaît, puis la même ligne renaît au nom de Mallory. Résultat : Bérénice cesse silencieusement de recevoir son socle quotidien (FR-033) — aucune erreur, aucune trace, et l'écran /reglages de Bérénice affichera « aucun appareil » sans qu'elle ait rien fait. Le `revoke execute … from public, anon` de la ligne 366 ne ferme rien : c'est `authenticated` qui a le grant. La garde manquante est un `and utilisatrice_id = v_moi` OU, mieux, un `where endpoint = p_endpoint and utilisatrice_id is distinct from v_moi` accompagné d'une vérification que l'appelante prouve la possession de l'appareil.

<details><summary>Ce que le sceptique a trouvé en cherchant à réfuter</summary>

```
J'ai cherché à réfuter, et je n'ai trouvé aucune garde ailleurs — au contraire, un test du dépôt PROUVE que la prise d'un endpoint étranger réussit.

LA LIGNE FAUTIVE — /Users/juliantalou/anima-app/supabase/migrations/0053_socle_quotidien_poussee.sql:355, dans `abonner_poussee` (créée l. 340, `security definer`, `grant execute … to authenticated` l. 371) :

    delete from public.abonnement_poussee where endpoint = p_endpoint;

Aucune clause `utilisatrice_id`. Aucun trigger : `grep -rn "abonnement_poussee" supabase/migrations/` ne renvoie que 0053 et 0057 (l'export), aucun `create trigger`. Aucune redéfinition ultérieure (les migrations 0066-0072 n'y touchent pas). Les policies de la table (l. 246-251) sont bien propriétaires, mais `security definer` + `force row level security` ne les applique pas au propriétaire porteur de BYPASSRLS — et ce n'est pas une supposition : tests/socle-sql.test.ts:618-650 (« le second abonnement DÉLOGE le premier ») assert que, sous le JWT du compte B, la ligne du compte A change de `utilisatrice_id` pour `b.id`. Le franchissement inter-comptes est donc démontré par le dépôt lui-même.

LES ENTRÉES CONCRÈTES : Mallory, compte ordinaire, session valide. `POST /rest/v1/rpc/abonner_poussee` avec `p_endpoint` = l'endpoint de Bérénice (il passe l'allowlist d'hôtes par construction, puisqu'il vient d'un vrai navigateur), `p_p256dh` = 87 caractères base64url fabriqués, `p_auth` = 22 caractères. Les contraintes de forme (l. 210-217) ne regardent que la FORME : rien à prouver sur l'appareil. La transaction commit : la ligne de Bérénice est supprimée, réinsérée au nom de Mallory.

LE TORT, et il est pire que ne le dit la trouvaille. L'adaptateur (lib/poussee/adaptateurs/web-push.ts, l. 39-70) POSTe ZÉRO OCTET : « `p256dh` et `auth` de l'abonnement ne servent donc PAS ici ». Les clés forgées par Mallory n'ont donc aucune importance pour la livraison — seul l'endpoint compte. Conséquence : (1) Bérénice cesse de recevoir son socle (FR-033), sans erreur ni trace, /reglages affiche « aucun appareil » ; (2) le job du socle (lib/ordonnanceur/jobs/socle-quotidien.ts l. 134 → `endpoints_poussee(mallory)` → `reveiller`) POSTe désormais sur l'appareil de Bérénice à l'heure choisie par MALLORY, qu'elle règle librement via la policy d'update de `preference_socle` : `heure = 3`. Le téléphone de Bérénice sonne à 3 h du matin, tous les jours, sans qu'elle possède plus aucune ligne dans la base.

L'OBJECTION QUE J'AI TESTÉE — « c'est délibéré » (commentaire l. 331-339 : « CHANGEMENT DE PROPRIÉTAIRE, pas une fuite ; la garde n'est pas “la RPC vérifie”,  […]
```
</details>

### R8 — Le gate d'allocation ne consulte que `securite.limitesLevees`, jamais le niveau EFFECTIF : au tour qui éteint l'épisode, le verdict vaut encore `niveau_max` (plancher 0067) alors que `limites_levees` est déjà retombé — la conversation est coupée, le composeur désactivé et le bloc de numéros d'urgence n'est jamais émis.

- **Verdict** : CONFIRME · **angle** : 
- **Où** : `app/api/anam/message/route.ts:229`
- **Scénario** : Compte non premium, 1re séance close, allocation mensuelle déjà atteinte. Tour N : idéation active → `enregistrer_tour_detresse(3)` ouvre l'épisode, `limitesLevees = true` → le gate est court-circuité, elle parle librement, et chaque tour porte le bloc `{t:"ressources", position:"avant"}` (3114). Tours N+1..N+3 : niveau détecté 0, `plancherEpisode()` rend 3 → `niveauSecurite = 3` à chaque fois, bloc affiché. Au 3e tour sûr, ≥ 30 min après le dernier tour élevé, la RPC ÉTEINT l'épisode et renvoie `false`. Dans le MÊME tour : `securite.verdict.niveau === 3` (le plancher a été lu AVANT l'enregistrement, ligne 90 du pipeline), `trameRessources.position === "avant"` est calculée… mais `securite.limitesLevees === false` fait entrer le gate ligne 229, `doitCouperConversation` (qui n'a aucune notion de `niveauSecurite`) rend `true`, et la route `return` ligne 274 un flux ne portant QUE `{t:"quota"}`. Côté client, `onQuota` retire le tour d'Anam, pose `quotaEpuise` et `disabled={bloque}` sur le `<textarea>` : sur le tour même que le serveur classe « urgence », Anam disparaît, le composeur se ferme et le 3114 quitte l'écran. `tests/conversation-detresse.test.ts:71` affirme l'invariant inverse (« le champ n'est désactivé QUE par le quota, jamais en détresse ») en s'appuyant sur `gate-quota.test.ts`, qui ne vérifie que la présence littérale de `!securite.limitesLevees && seanceClose`.

<details><summary>Ce que le sceptique a trouvé en cherchant à réfuter</summary>

```
LIGNE FAUTIVE — /Users/juliantalou/anima-app/app/api/anam/message/route.ts:716-721

```ts
  if (egress.bloque) {
    return NextResponse.json(
      { code: `egress_bloque_${egress.raison}`, message: "Envoi bloqué (consentement / ZDR / barrière)." },
      { status: 403, headers: ENTETES_ART9 },
    );
  }
```

`trameRessources` (construite ligne 684-697, à partir de `blocRessourcesDetresse(securite.verdict)`) n'apparaît nulle part dans cette branche. Le `catch` jumeau, six lignes plus haut (713), fait exactement l'inverse : `return fluxDeTrames([...(trameRessources ? [trameRessources] : []), { t: "erreur" }]);` — avec un commentaire (706-712) qui documente mot pour mot le tort : « le client ne lit les ressources que dans une trame — l'écran de quelqu'un en détresse n'affichait qu'"une erreur est survenue", précisément au tour où le filet était dû ».

ENTRÉES CONCRÈTES → TORT

État : utilisatrice majeure, consentement art. 9 donné, `episode_detresse` OUVERT avec `niveau_plancher_episode = 3` (elle a été classée « idéation active » au tour N).

Tour N+1, elle écrit un nouveau message :
1. `evaluerSecuriteDuTour` (route:137) passe — sa propre traversée d'egress (`detecteur-detresse.ts:127` → `envoyerSousEgressArt9`) a réussi. `niveauEffectif = max(détecté, plancher) = 3` (`lib/safety/pipeline.ts:91`), donc `securite.bloque === false` et la ligne 158 n'attrape rien.
2. `bloc = blocRessourcesDetresse(verdict niveau 3)` → non nul, position `"avant"`, 3114 en tête (confirmé par tests/bloc-ressources-detresse.test.ts:38). `trameRessources` est prête ligne 684.
3. Ligne 703, `diffuserSousEgressArt9` rejoue `verifierGardesArt9` (/Users/juliantalou/anima-app/lib/ai/egress-guard.ts:38-54). Ligne 47-48 :
   `const { data: consenti, error: eConsent } = await supabase.rpc("a_consenti_art9");`
   `if (eConsent || consenti !== true) return "consentement";`
   Une erreur TRANSITOIRE de la RPC (blip réseau/PostgREST, quelques secondes après la RPC identique passée en 1) suffit : `eConsent` non nul ⇒ raison `"consentement"` ⇒ `{ bloque: true }`. Aucun changement d'état réel n'est requis. (Variante non aléatoire, même issue : révocation du consentement ou bascule de `est_barre_minorite` depuis un autre onglet entre les deux appels.)
4. La route tombe ligne 716 et rend un JSON 403.
5. Côté client, /Users/juliantalou/anima-app/render/conversation/useFluxAnam.ts:119 : `if (!reponse.ok || !reponse.body) throw new Error("reponse_non_ok");` → `issue = "echec"` → `onEchec` (/Users/juliantalou/anima-app/render/conversation/Conversation.tsx:326-331) marque le tour `etat: "echec"` et […]
```
</details>

### R9 — `personne_joignable()` — le seul filtre de consentement de la sélection du socle quotidien — n'exige pas `cgu_acceptees`. La 0072 a corrigé `a_consenti_art9()` et `eligible_au_periodique()` et a oublié ce troisième chemin, qui avait justement été extrait en 0053 « pour qu'il n'existe plus deux endroits où écrire » la règle.

- **Verdict** : PLAUSIBLE · **angle** : 
- **Où** : `supabase/migrations/0053_socle_quotidien_poussee.sql:58`
- **Scénario** : Un compte POSTe directement `consentement {art9_accorde:true, ia_reconnue:true, cgu_acceptees:false}` — la policy `consentement_proprietaire` (0004) n'a comme WITH CHECK que `auth.uid() = utilisatrice_id`, et 0072 ne l'a pas durcie. Il POSTe ensuite `abonnement_poussee` et `preference_socle` (mêmes policies, mêmes WITH CHECK ouverts). `eligible_au_periodique` le refusera pour la synthèse et le rappel ; `socle_quotidien_du` (0053:254) l'accepte, parce qu'il appelle `personne_joignable`, qui ne regarde que `art9_accorde` et `ia_reconnue`. Le produit pousse donc tous les jours une notification à quelqu'un qui n'a jamais accepté les CGU ni confirmé ses dix-huit ans — exactement le défaut que 0072 dit avoir refermé.

<details><summary>Ce que le sceptique a trouvé en cherchant à réfuter</summary>

```
J'ai lu tout le chemin. La MÉCANIQUE DE PAGE est exacte, ligne à ligne, ET elle n'est gardée nulle part ailleurs (aucun trigger, aucune contrainte : `grep resiliation_demandee_le supabase/migrations` ne rend que 0038 et 0044, qui l'écrivent en écrasement FRANC).

CE QUI EST VÉRIFIÉ (à partir d'une ligne `abonnement` portant etat='resilie' ET resiliation_demandee_le non nul) :
- app/abonnement/page.tsx:116 `resiliationDemandee = abonnement?.resiliationDemandeeLe != null` → vrai ; :128 `actif = etat === "actif"` → faux.
- :189 `!abonnement || (!actif && !resiliationDemandee)` → FAUX → branche :197 : `ETAT_RESILIE` + `ETAT_RESILIE_JUSQU_AU(finAcces)`, avec `finAcces = dateFr(resiliationDemandeeLe)` (:127) — une date RÉVOLUE. Le texte réel est « Ton abonnement est résilié. » / « Tu y as accès jusqu'au <date passée> » (render/abonnement/copie-abonnement.ts:33-34) — la trouvaille cite « actif jusqu'au », c'est un contresens de citation, pas de tort : `estPremium` est faux, donc la page affirme un accès qui n'existe pas.
- :210 seul geste offert = POST `/api/abonnement/resilier?reprendre=1` → `annulerResiliation` → `subscriptions.update(id,{cancel_at_period_end:false})` (lib/stripe/resiliation.ts:43). Sur une souscription `canceled`, Stripe REFUSE (docs Stripe, « Annuler des abonnements » : « Une fois l'abonnement annulé, vous ne pouvez plus le mettre à jour, à l'exception de ses metadata et cancellation_details » ; « Il est impossible de réactiver un abonnement résilié ») → catch route :171 → `/abonnement?etat=echec`, à chaque clic.
- :253 `etape === "suite" && (!abonnement || (!actif && !resiliationDemandee))` → FAUX → `MontagePaywall` jamais monté, alors que app/api/stripe/checkout/route.ts:150-165 accepterait (`contratStripeVivant("canceled")` = faux, lib/domain/abonnement.ts:56).

LE DOUTE QUE JE N'AI PAS PU LEVER (et qui décide de tout) : la trouvaille affirme que `customer.subscription.deleted` porte « TOUJOURS » `cancel_at`. Si Stripe rendait `cancel_at = null` sur cet événement, l'écrasement franc de 0044 remettrait `resiliation_demandee_le` à NULL, et la page basculerait sur `ETAT_TERMINE` + offre montée — c'est-à-dire le comportement voulu, et la trouvaille tomberait entièrement. Les docs Stripe ne tranchent pas (`cancel_at` = « A date in the future… », description écrite pour le cas actif) ; l'indice favorable est que `cancel_at_period_end` est documenté comme survivant (« did (if status=canceled) ») et qu'un exemple public de charge utile `customer.subscription.deleted` porte `cancel_at = ended_at` non nul avec `canceled_at` antérieur. Aucun test d […]
```
</details>

### R10 — « Tout effacer » (6.7/6.8) ne parle jamais à Stripe : la souscription reste active et la carte continue d'être débitée après la disparition du compte.

- **Verdict** : PLAUSIBLE · **angle** : 
- **Où** : `app/mes-donnees/actions.ts:35`
- **Scénario** : Une abonnée premium (abonnement.etat='actif', stripe_subscription_id posé, cancel_at_period_end=false) ouvre /mes-donnees, coche la case et clique « Tout effacer ». `effacerTout` appelle uniquement `effacer_toutes_mes_donnees` → `effacer_utilisatrice` (0061:220-280), dont le corps ne fait que trois `delete` SQL. La ligne `abonnement` — donc `stripe_subscription_id`, le seul lien vers Stripe — part en cascade. À l'échéance, Stripe renouvelle et débite 69 € une personne qui n'a plus de compte, plus de session, plus de page /abonnement ; le webhook ne retrouve aucune `utilisatrice_id` et journalise « événement d'état sans mapping » (app/api/stripe/webhook/route.ts:146). C'est exactement le défaut M7 réparé le 2026-08-11 sur l'ANCIEN chemin — app/(auth)/consentement/actions.ts:88-105 résilie avant d'effacer et suspend l'effacement si Stripe est injoignable, et tests/effacement-stripe.test.ts le garde — mais la garde ne couvre que `refuser`/`supprimerCompteRevoque`, jamais le chemin 6.7, qui est désormais le chemin canonique. Même trou pour le job de rétention : `trancher_echeance_suppression` efface un compte 'minorite' quel que soit l'abonnement, et `declencherRemboursement` (lib/safety/appliquer-barriere.ts:88-110) « ne lève jamais » — un échec Stripe y laisse un compte barré qui sera effacé sous 30 jours avec une souscription toujours vivante.

<details><summary>Ce que le sceptique a trouvé en cherchant à réfuter</summary>

```
MÉCANISME : VÉRIFIÉ. `lib/ordonnanceur/jobs/synthese.ts:233` et `:243` lèvent tous deux `("job_echoue", NOM_JOB, …)` — même type, même job. La dédup est `(type, job, jour)` : index unique `incident_systeme_dedup` (supabase/migrations/0027_ordonnanceur.sql:218) et `insert … on conflict (type, job, jour) do nothing` (0052_ordonnanceur_jeton_alarme.sql:352-354). Le test SQL le prouve directement : `lever_incident(p_detail:"a")` puis `("b")` le même jour → une seule ligne, la seconde est « un NON-ÉVÉNEMENT » (tests/ordonnanceur-sql.test.ts:404-410). Donc, les jours où la ligne 232 est vraie, `echecs_repetes` n'est effectivement jamais écrit, contre l'intention affichée l.238-239 (« ici on le DIT »). Aucun test ne peut le voir : le dépôt factice empile les incidents sans dédup (tests/synthese-job.test.ts:65) et les deux cas sont testés isolément (l.1249 « lot_entierement_echoue » ; l.1299 « echecs_repetes » avec candidates: []).

MAIS LA PORTÉE ANNONCÉE EST RÉFUTÉE SUR TROIS POINTS :
1) « précisément les jours où il compte » est à l'envers. Le disjoncteur a été posé pour le cas N=1 (0031_ordonnanceur_alarmes.sql:105-107 : « à N=1, "tout le lot a échoué" se déclenche au premier hoquet et ne veut rien dire ; "la même personne échoue depuis trois jours", si »), et le plancher `tentees >= 2` de la ligne 232 existe précisément pour que ce cas-là n'écrive PAS `lot_entierement_echoue` (commentaire l.230-231). Les deux alarmes couvrent des régimes complémentaires ; elles ne se percutent que les jours où la plus forte sonne déjà.
2) Le signal est DIFFÉRÉ, pas perdu. `personnes_en_echec_repete` (0031:108-125) est un comptage glissant sur 7 jours, indépendant de la candidature, et les lignes 241-243 s'exécutent inconditionnellement après la boucle, y compris avec `candidates` vide (l'absence de `return` anticipé est délibérée, cf. commentaire vers l.155-160). Comme l'écartée sort du tri (0031:155-160), dès que le lot n'échoue plus entièrement — au plus tard quand tous les fautifs sont écartés et que `tentees` retombe à 0, ce qui neutralise la ligne 232 — l'exécution suivante écrit bien `echecs_repetes`. Seule perte définitive résiduelle : trois échecs étalés sur presque 7 jours, cas où l'écartement expire de lui-même dès le lendemain (il n'y a alors presque rien à taire).
3) Aucune conséquence opérationnelle : `job_echoue` ne dégrade pas la sonde publique (0031 §2 ; 0052:308-312 ne lit que `job_en_retard`). Une ligne `job_echoue` pour ce job/ce jour existe de toute façon ; seul le CODE de détail est perdu, et `execution_job` garde chaque échec par personne avec son `mot […]
```
</details>

### R11 — Sur l'écran de révocation, le bouton d'export est désactivé (« disponible avant le lancement ») alors que /api/export existe : le seul geste possible est la suppression irréversible.

- **Verdict** : PLAUSIBLE · **angle** : 
- **Où** : `app/(auth)/consentement/revoque/page.tsx:64`
- **Scénario** : Une utilisatrice de longue date révoque son consentement art. 9 ; `revoquerConsentement` la renvoie sur /consentement/revoque. La page lui dit « Il te reste deux choses à portée : récupérer ce qui t'appartient, puis effacer ton compte », puis affiche un `<button disabled>` « Exporter mes données » suivi de « L'export sera disponible avant le lancement. » — texte figé de la story 1.6, jamais mis à jour après la 6.6 qui a livré /api/export (seuls app/mes-donnees/page.tsx:71 et app/barriere/page.tsx:85 y pointent). Le seul bouton actif est « Supprimer mon compte », qui efface tout sans retour. Or /mes-donnees ne redirige délibérément PAS les révoquées, précisément pour qu'elles puissent exporter — mais aucun lien ne l'indique et la halte « n'est atteignable que par URL tant que le menu de compte n'existe pas ». Résultat : quelqu'un qui exerce l'art. 17 perd définitivement ses données parce que le produit lui affirme que l'art. 15 n'est pas encore disponible.

<details><summary>Ce que le sceptique a trouvé en cherchant à réfuter</summary>

```
FAIT DE CODE CONFIRMÉ, MÉCANIQUE DU TORT PARTIELLEMENT FAUSSE.

1) Le constat matériel est exact. app/(auth)/entrer/page.tsx:22 — `{refus === "age" ? (…) : (<>…</>)}` — met la totalité du contenu dans le `else` (lignes 28-67), y compris `<p className={s.mentions}>` portant `<a href="/cgu">` (63) et `<a href="/aide">` (65). Sur `?refus=age`, la page ne rend que « Anam » (20), « Entrer » (21) et le `<p role="status">` des lignes 23-26 : zéro `<a>` en production (les boutons des lignes 69-85 sont sous `NODE_ENV === "development"`). Aucun `app/(auth)/layout.tsx` n'existe ; `app/layout.tsx` ne monte que `CouvercleConfidentialite` ; `proxy.ts` ne pose que CSP/session/X-Robots-Tag. Rien ne réintroduit de lien. Le contraste cité est réel : app/barriere/page.tsx liste 3018/119/Fil Santé Jeunes/3114 en `tel:`, et app/not-found.tsx garde `<Link href="/aide">` avec le commentaire « un écran d'erreur est le dernier endroit où l'on peut se permettre de retirer la sortie de secours ».

2) MAIS LE SCÉNARIO EST FAUX SUR SON POINT CENTRAL. `declarerAge` (app/(auth)/naissance/actions.ts) ne redirige pas vers `/entrer?refus=age` : sur `age < 18` elle fait `await declarerMinorite(...)`, `await supabase.auth.signOut()` puis `return { statut: "mineur" }`, et app/(auth)/naissance/formulaire-naissance.tsx:26-33 rend le refus EN PLACE, sur /naissance (« Ce lieu est réservé aux adultes. Reviens quand tu auras 18 ans… »). L'adolescente de 14 ans ne voit donc PAS l'écran incriminé à ce moment-là. Si elle recharge /naissance, `getUser()` est nul → `redirect("/entrer")` SANS paramètre, c'est-à-dire l'écran nominal, qui porte justement « Aide ». Le « chemin le plus certain de mener un mineur sur cet écran » invoqué par la trouvaille n'existe pas. Le vrai chemin est une RECONNEXION ultérieure : app/auth/confirm/route.ts:75-78, `etape === "mineur"` → `signOut()` → `"/entrer?refus=age"` (FR-070). L'écran est donc bien atteint par une mineure barrée, mais par une autre porte que celle décrite.

3) « Le seul visiteur du produit à qui aucune ressource n'est offerte » est réfuté. Le premier écran de refus (formulaire-naissance.tsx:26-33), celui qu'elle voit réellement, ne porte aucun lien non plus ; app/(auth)/naissance/page.tsx n'a aucun `href` ; app/(auth)/consentement/revoque/page.tsx — l'autre impasse — non plus (grep `href` sur app/(auth)/ : seules occurrences = revoquer/page.tsx:68 `href="/"`, formulaire-consentement.tsx:160 `href="/cgu"`, entrer/page.tsx:63 et 65). Tout le tunnel d'entrée est logé à la même enseigne.

4) L'absence est une décision ÉCRITE ET TESTÉE, pas un oubli. lib/do […]
```
</details>

### R12 — Sur `egress.bloque` à l'ouverture du flux de réponse, la route rend un JSON 403 nu et JETTE la `trameRessources` déjà décidée — exactement le défaut corrigé dans le `catch` situé six lignes plus haut, laissé ouvert sur la branche jumelle.

- **Verdict** : PLAUSIBLE · **angle** : 
- **Où** : `app/api/anam/message/route.ts:716`
- **Scénario** : La détection passe (son propre egress a réussi) et classe niveau 3 ; `trameRessources` (position `avant`, 3114 en tête) est construite ligne 684. À l'appel `diffuserSousEgressArt9`, `verifierGardesArt9` rejoue `a_consenti_art9()` : un simple ALÉA de la RPC suffit, car le test est `if (eConsent || consenti !== true) return "consentement"` (egress-guard.ts:48) — une erreur transitoire Supabase est traitée comme un refus. La route retourne alors `NextResponse.json(..., {status:403})` : `useFluxAnam` voit `!reponse.ok`, lève `reponse_non_ok`, et `onEchec` affiche « Je n’ai pas pu répondre. Ton message est gardé. » Aucun numéro n'atteint l'écran, alors que le commentaire ligne 706 documente ce cas précis pour le chemin `catch` (« l'écran de quelqu'un en détresse n'affichait qu'une erreur, précisément au tour où le filet était dû ») et le corrige en émettant `fluxDeTrames([...trameRessources, {t:"erreur"}])`.

<details><summary>Ce que le sceptique a trouvé en cherchant à réfuter</summary>

```
FAITS VÉRIFIÉS (la mécanique décrite existe bien)

1. `render/conversation/Conversation.tsx:89-95` — `toursDHistorique` ne fabrique que deux rôles :
   `t.role === "anam" ? {role:"anam", etat:"complet"} : {role:"utilisatrice"}`. Aucun rôle `ressource` n'en sort.
2. `lib/data/depot-fil.ts:85` — `if (l.role !== "utilisatrice" && l.role !== "anam") continue;` : la source
   ne contient donc rien d'autre.
3. `app/page.tsx:70-93` — la page ne passe que `projection`, `ouverture`, `bibliotheque`, `historique`.
   Aucun état d'épisode ne traverse le rendu serveur (et il ne le pourrait pas facilement :
   `tests/episode-detresse.test.ts:456` prouve que `niveau_plancher_episode` est HORS de portée d'une session JWT).
4. Aucun réémetteur : `grep ressource render/` ne donne que le chemin de trame (`useFluxAnam.ts:135` →
   `Conversation.tsx:336`), qui n'est parcouru qu'au prochain tour envoyé.
5. `render/conversation/rejeu.ts:37` dit bien « il ne doit JAMAIS pouvoir quitter l'écran ».

CE QUI EMPÊCHE DE CONFIRMER (la garde existe, ailleurs, et le tort est surévalué)

a) LA PORTE DE SECOURS EST INCONDITIONNELLE ET PERSISTANTE. `lib/scene/surimpression.ts:43` déclare
   `readonly porteSecours: true` — un type littéral : construire une surimpression sans elle ne compile pas.
   `surimpressionPour()` (ligne 74-82) la rend vraie sur TOUTES les régions, sans dépendre d'aucune détection
   (commentaire ligne 6-7 : « indépendante de toute détection (FR-077, AD-9/AD-15) »).
   `render/scene-dom.tsx:259-268` la monte EN TÊTE du DOM, hors de tout `inert`, donc elle survit au
   rechargement ; `render/surimpression.tsx:81-83` : `<Link href="/aide">Aide</Link>`, dernier arrêt de
   tabulation (tests/rendu/attente-et-filet.test.tsx:214). `/aide` sert `RESSOURCES_AIDE` en entier, 3114 compris.
   L'invariant « un numéro reste atteignable » est donc tenu par un mécanisme conçu exprès pour ne dépendre
   d'aucun état — ce qui contredit le « aucun mécanisme ne le réémet » de la trouvaille.

b) LE NUMÉRO EST DANS LE TEXTE D'ANAM, QUI, LUI, EST RESTITUÉ. `lib/safety/consigne-detresse.ts:54 et 58`
   imposent au niveau 2 « Donne-lui le ${num} » et au niveau 3 « Oriente sans attendre vers le ${num}
   (et le 15/112…) ». Ce tour d'Anam est journalisé (`consigner_tour_anam`, correctif #6) et revient par
   `toursDHistorique` en `etat:"complet"`. Dans le scénario même de la trouvaille (niveau 3), l'écran
   rechargé porte donc très probablement le numéro en toutes lettres — pas cliquable, mais présent.

c) L'OMISSION EST DÉLIBÉRÉE ET VERROUILLÉE PAR UN TEST, pas « un chemin jamais considéré […]
```
</details>


## Moyennes

### R13 — Un remboursement INTÉGRAL laisse l'accès premium ouvert jusqu'à la fin de la période payée — jusqu'à un an de produit payant offert après restitution des 69 €.

- **Verdict** : CONFIRME · **angle** : 
- **Où** : `lib/stripe/resiliation.ts:142`
- **Scénario** : Abonnée le 1er janvier, aucune branche posée, elle demande la garantie le 5 avril. `rembourserIntegralement` appelle `resilierEnFinDePeriode` (donc `cancel_at_period_end`, jamais `subscriptions.cancel`) puis `refunds.create` sans `amount` → 69 € rendus en totalité. Chez Stripe `status` reste `active` jusqu'au 31 décembre ; `etatDepuisStatutStripe` rend donc `actif`, `estPremium` rend vrai, et elle garde branches, arbre et allocation pendant près de neuf mois sans avoir rien payé. L'en-tête de `resilierEnFinDePeriode` justifie ce choix par « elle a payé l'année, elle garde l'accès jusqu'au bout » — prémisse qui cesse d'être vraie dès qu'on lui a rendu l'année. Le fichier argumente longuement l'ORDRE des deux gestes mais jamais la nature du premier : sur le chemin remboursement, la résiliation devrait être immédiate.

<details><summary>Ce que le sceptique a trouvé en cherchant à réfuter</summary>

```
J'ai tenté de réfuter par quatre angles (purge de la table, garde dans `eligible_au_remboursement`, garde côté page, garde côté Checkout). Aucun ne tient.

LA LIGNE FAUTIVE
`app/api/abonnement/remboursement/route.ts:66`
    if (reservation.dejaDemande && reservation.confirmeLe) return vers("rembourse");
Sortie sans appel Stripe, sans `console.error`, vers `/abonnement?etat=rembourse` → `SUCCES_REMBOURSEMENT` = « C'est demandé. Le remboursement arrive sur ton moyen de paiement. » (`render/abonnement/copie-abonnement.ts:129`).

CE QUE J'AI VÉRIFIÉ, FICHIER PAR FICHIER
1. `remboursement` est PK sur `utilisatrice_id` (0038:230), une ligne par COMPTE — pas par souscription, pas par période. Aucune purge : `grep 'delete from ... remboursement'` sur tout `supabase/` ne rend RIEN ; 0058 (effacement) et 0059 (rétention) ne la nomment jamais. Elle survit donc à la souscription qu'elle décrit.
2. `eligible_au_remboursement(uuid)` (0038:169-194) ne consulte QUE `abonnement` (`etat='actif'`, `debut_le is not null`, `debut_le <= now() - 3 months`) et `branche`. Elle n'interroge JAMAIS `remboursement`. Une seule définition dans tout le dépôt (aucun `create or replace` postérieur — vérifié par grep sur les 72 migrations).
3. `demander_remboursement` (0043:67-75) rend la ligne EXISTANTE avec son `confirme_le`, quelle que soit la souscription en cours.
4. La page n'a aucune garde : `app/abonnement/page.tsx:261` → `{eligible && retour !== "rembourse" && (…)}`. `etatRemboursement` n'entre pas dans la condition. Le bouton « Demander le remboursement » reparaît sous le texte « Aucune branche n'a été posée depuis trois mois. Tu peux demander le remboursement, sans avoir à te justifier. »

LA RÉACHABILITÉ, SANS DÉPENDRE DE LA CHRONOLOGIE PROPOSÉE
Le scénario du réabonnement marche (`contratStripeVivant` rend `false` sur `canceled`, donc le Checkout laisse passer ; `debut_le = coalesce(excluded.debut_le, …)` en 0038 ÉCRASE avec le `start_date` neuf). Mais il n'est même pas nécessaire — voici un chemin entièrement vérifiable dans le dépôt, avec un SECOND paiement réel :
• Jan 2026 : elle paie 69 €. `debut_le` = `subscription.start_date` (`lib/stripe/evenement-abonnement.ts:48`), volontairement STABLE à travers les reconductions (commentaire de colonne, 0038).
• Mai 2026 : garantie. `rembourserIntegralement` appelle `resilierEnFinDePeriode` → `cancel_at` posé, mais `status` Stripe reste `active` donc `etat` reste `actif` (`etatDepuisStatutStripe`). `confirme_le` est posé par le webhook. → dès le rechargement suivant, `eligible_au_remboursement()` rend ENCORE `true` (actif, `debut_ […]
```
</details>

### R14 — La garde anti-double-souscription disparaît sur une panne de lecture (l'`error` de Supabase est jetée), et une seconde souscription vivante est créée : 69 € débités deux fois.

- **Verdict** : CONFIRME · **angle** : 
- **Où** : `app/api/stripe/checkout/route.ts:144`
- **Scénario** : `const { data: dejaAbonnee } = await supabase.from("abonnement")…` ignore `error`. Si la lecture échoue — timeout PostgREST, JWT rafraîchi entre-temps, incident Supabase — `dejaAbonnee` vaut `undefined`, tout le bloc de vérification (y compris l'interrogation de Stripe) est sauté, et `checkout.sessions.create` monte une seconde souscription pour quelqu'un qui en a déjà une vivante. La cliente est alors débitée de 69 € une deuxième fois, et comme la projection est une-ligne-par-utilisatrice, `abonnement.stripe_subscription_id` bascule d'un contrat à l'autre au gré des `source_maj_le` : le bouton « Résilier » ne sait plus viser qu'un seul des deux, parfois le mort. C'est le scénario M9 que ce bloc existe pour empêcher. Le même fichier écrit dix lignes plus bas, pour la panne Stripe : « le repli est du côté qui ne débite pas deux fois » — la panne de base fait exactement l'inverse, en contradiction avec AD-15.

<details><summary>Ce que le sceptique a trouvé en cherchant à réfuter</summary>

```
LIGNE FAUTIVE — `supabase/migrations/0069_un_remboursement_qui_echoue_se_dit.sql:62-65` :

```sql
  update public.remboursement
     set echec_le = coalesce(echec_le, now())
   where utilisatrice_id = p_utilisatrice
     and confirme_le is null;   -- ← ligne 65
```

Aucune migration postérieure (0070-0072) ne redéfinit `echouer_remboursement`, aucun trigger ne touche `remboursement` (grep sur tout `supabase/migrations/`). La garde est donc l'état final.

CHAÎNE RÉELLE, LUE LIGNE À LIGNE
1. `lib/stripe/resiliation.ts:146` : `stripe.refunds.create({ payment_intent, metadata: { utilisatriceId } })` sur un paiement carte. Un remboursement carte naît `succeeded` (Stripe le soumet au réseau immédiatement) ; l'échec, lui, revient plus tard, quand la banque de la cliente renvoie les fonds (compte clos, carte remplacée).
2. `lib/stripe/evenement-sortie.ts:70-71` : `refund.status === "succeeded" ? "confirme" : … "failed" ? "echec"`. Donc l'événement `refund.created` (statut `succeeded`) produit `issue = "confirme"`.
3. `app/api/stripe/webhook/route.ts:66` : `confirmerRemboursement(...)` → RPC 0069:99-102, qui pose `confirme_le` SANS condition.
4. Douze jours plus tard, `refund.updated` / `failed` (même objet `Refund`, même `metadata.utilisatriceId`) : `route.ts:60` appelle `echouerRemboursement`, la RPC insère l'`event.id` dans `evenements_traites` (0069:52-58), rend `true` — et son `update` ne touche AUCUNE ligne à cause de la ligne 65. `echec_le` reste NULL.

TORT CONCRET, ENTRÉES PRÉCISES
Utilisatrice U, 69 €, `refund.created` = evt_A (`succeeded`, T0) puis `refund.updated` = evt_B (`failed`, T0+12 j) :
- Les 69 € sont revenus sur le solde Stripe d'Anima, U n'a rien.
- `lib/data/depot-resiliation.ts:232-234` : `if (data.confirme_le) return "confirme";` — l'échec n'est jamais atteint.
- `app/abonnement/page.tsx:121` affiche `c.REMBOURSEMENT_CONFIRME` = « Ton remboursement est parti sur ton moyen de paiement. » (`render/abonnement/copie-abonnement.ts:161`), en permanence. La phrase prévue pour ce cas exact, `REMBOURSEMENT_ECHOUE` (« Ta banque a refusé le remboursement… écris-moi depuis l'aide »), est devenue inatteignable dans l'ordre où le cas se produit vraiment.
- Second tour : `app/api/abonnement/remboursement/route.ts:66` — `if (reservation.dejaDemande && reservation.confirmeLe) return vers("rembourse");` — la route lui répond « c'est fait » sans rappeler Stripe. Elle n'a aucune porte : ni l'écran, ni la route.
- Aucun rattrapage ailleurs : pas de job de réconciliation (`lib/ordonnanceur` ne connaît pas `rembours`), pas d'incident en base. Seul un `console.e […]
```
</details>

### R15 — Un échec bancaire POSTÉRIEUR à la confirmation n'est jamais enregistré : l'écran continue d'affirmer « remboursé » à qui n'a rien reçu.

- **Verdict** : CONFIRME · **angle** : 
- **Où** : `supabase/migrations/0069_un_remboursement_qui_echoue_se_dit.sql:65`
- **Scénario** : `echouer_remboursement` n'écrit que `where … and confirme_le is null`. Or la séquence Stripe la plus courante d'un échec tardif est `refund.updated: succeeded` PUIS `refund.updated: failed` (compte clos, coordonnées bancaires invalides, fonds renvoyés par la banque de la cliente) — pas l'inverse. Déroulé : le premier événement pose `confirme_le` ; le second arrive, `echouer_remboursement` insère bien l'event dans `evenements_traites` et rend `true`, mais son `update` ne touche AUCUNE ligne. `remboursement.echec_le` reste nul, `lireEtatRemboursement` rend `confirme` (`confirme_le` domine, `lib/data/depot-resiliation.ts:232`) et /abonnement affiche REMBOURSEMENT_CONFIRME en permanence. Elle n'a pas ses 69 €, la base atteste du contraire, et si un jour elle redemande la garantie la ligne 66 de la route de remboursement lui répondra « c'est fait » sans rappeler Stripe. Le commentaire justifie ce sens unique par « l'argent rendu est un fait » — vrai d'un `succeeded` qui SUIT un `failed`, faux dans l'autre sens, et le code traite les deux ordres pareil.

<details><summary>Ce que le sceptique a trouvé en cherchant à réfuter</summary>

```
TENTATIVE DE RÉFUTATION — échouée. J'ai cherché la garde dans la fonction, dans les policies des trois tables, dans les triggers, dans la contrainte de table, dans l'appelant TypeScript et dans les tests de 0072. Elle n'existe nulle part.

1) LA LIGNE FAUTIVE — `supabase/migrations/0053_socle_quotidien_poussee.sql:56-60`, corps de `personne_joignable` :
       and exists (select 1 from public.consentement k
                    where k.utilisatrice_id = u.id
                      and k.art9_accorde = true
                      and k.ia_reconnue  = true
                      and k.revoked_at is null)                  -- consentement art. 9 VIVANT (0005)
`cgu_acceptees` n'y figure pas. `grep -rn personne_joignable supabase/` : la fonction est créée en 0053:43 et n'est JAMAIS redéfinie ensuite (0054 explique même pourquoi il ne l'appelle pas). 0072 est la dernière migration du dépôt.

2) 0072 A BIEN OUBLIÉ CE CHEMIN, et pire : elle a cassé la délégation. 0053:88 avait écrit `eligible_au_periodique` comme `select public.personne_joignable(...) and premium`. 0072:57-79 la réécrit en `create or replace` avec le corps ENTIER RÉINLINÉ (`u.barriere_minorite_le`, `u.mineur_detecte`, le `exists` sur consentement avec `k.cgu_acceptees = true` ligne 72, la clause AD-17). Donc après 0072, `eligible_au_periodique` n'appelle plus `personne_joignable` du tout — l'extraction que 0053 avait faite « pour qu'il n'existe plus deux endroits où écrire » la règle est défaite, et le second endroit est resté en arrière.

3) LES TROIS ÉCRITURES DU SCÉNARIO PASSENT TOUTES.
   • `consentement` : 0042:100 `create policy consentement_insertion ... with check (auth.uid() = utilisatrice_id and not public.est_barre_minorite())`. Aucune exigence de `cgu_acceptees`. Aucune contrainte CHECK sur la table (0004:15-21 : `cgu_acceptees boolean not null`, c'est tout). Le trigger 0042:123 `consentement_drapeaux_monotones` est `before UPDATE` seulement et n'interdit que `true → false` : un INSERT direct à `cgu_acceptees:false` est accepté. Le test 0072 « compléter les CGU après coup débloque » (tests/cgu-comptent.test.ts:115) confirme que cet état partiel est un état SUPPORTÉ du produit, pas une bizarrerie.
   • `preference_socle` : 0053:159 `for insert with check (auth.uid() = utilisatrice_id)`. Rien d'autre.
   • `abonnement_poussee` : 0053:222 `for insert with check (auth.uid() = utilisatrice_id)`. Les seules autres contraintes sont de FORME (allowlist d'hôtes, base64url) — un vrai abonnement navigateur les satisfait.

4) AUCUN RATTRAPAGE EN AVAL. `socle_quotidien_du` (0053:254) n'a que `public.p […]
```
</details>

### R16 — La chaîne gardée `Σ delaiMs + margeHorsDelais(n) ≤ BUDGET_TICK_MS` provisionne 800 ms par aller-retour hors `avecDelai`, alors que le dépôt en tolère 3 000 (`DELAI_DEPOT_MS`). La marge est donc calibrée sur un chiffre que le code n'impose pas, et la garde ne mord plus dès que la base ralentit.

- **Verdict** : CONFIRME · **angle** : 
- **Où** : `lib/domain/ordonnanceur-budget.ts:129`
- **Scénario** : Base chargée : chaque RPC met 2,5 s au lieu de 20 ms, sans jamais atteindre le délai de 3 s qui la ferait échouer. Hors `avecDelai` le répartiteur fait `environnementDeclare` + par job `reclamer` + `clore` (+ `leverIncident` sur le chemin d'échec) : 3 000 + 5 × 9 000 = 48 000 ms au pire, contre `margeHorsDelais(5)` = 12 800 provisionnés. Avec Σ delaiMs = 75 000, le tick peut atteindre ~123 s alors que `maxDuration` vaut 89. La plateforme tue la fonction au milieu du cinquième job — la rétention — : rien n'est clos, aucun incident n'est levé, la ligne reste `en_cours` sous son bail de 72 s. C'est mot pour mot l'échec muet que `registre.ts:170` dit que cette chaîne empêche.

<details><summary>Ce que le sceptique a trouvé en cherchant à réfuter</summary>

```
J'ai cherché la garde ailleurs (échéance globale du répartiteur, borne dans la route, test comportemental, doc de dette) : elle n'existe nulle part. La trouvaille tient.

LA LIGNE FAUTIVE
- `lib/domain/ordonnanceur-budget.ts:129` : `export const COUT_ALLER_RETOUR_MS = 800;` — d'où `COUT_PAR_JOB_MS = 3 × 800 = 2 400` (`:140`) et `margeHorsDelais(n) = 800 + n × 2 400` (`:157-159`).
- Or le SEUL plafond que le code impose réellement à un aller-retour de ce dépôt vaut 3 000 : `lib/data/depot-ordonnanceur.ts:71` `const DELAI_DEPOT_MS = 3_000;`, appliqué par `borne(...)` (`:85`) aux cinq méthodes (`environnementDeclare`, `reclamer`, `clore`, `etat`, `leverIncident`). Un appel qui met 2 900 ms est un appel NORMAL pour ce code : il ne lève rien, personne ne le coupe.
- Les appels concernés vivent bien HORS de tout `avecDelai` de job : `lib/ordonnanceur/executer.ts` — `await verifierEnvironnement(deps.depot)` (hors boucle), puis par job `await deps.depot.reclamer(...)`, `await deps.depot.clore(..., false, ...)`, `await deps.depot.leverIncident(...)` (chemin d'échec) ou `await deps.depot.clore(..., true, ...)`. Seul `job.executer(...)` est enveloppé d'`avecDelai(job.delaiMs)`. La marge est donc bien le seul terme censé les couvrir.
- Arithmétique vérifiée sur le registre réel (`lib/ordonnanceur/registre.ts`, 5 jobs : 9 000 + 36 000 + 8 000 + 10 000 + 12 000 = 75 000) : provisionné `margeHorsDelais(5) = 12 800` ; imposé au pire par le code : `3 000 + 5 × 3 × 3 000 = 48 000`. Pire cas réel du tick = 123 000 ms, contre `maxDuration = 89` (`app/api/ordonnanceur/route.ts:23`) et `BUDGET_TICK_MS = 89_000` (`ordonnanceur-budget.ts:169`). La chaîne gardée annonce 87 800 ≤ 89 000 : elle est fausse d'un facteur 1,4 dans le régime que le dépôt lui-même autorise.

SCÉNARIO CONCRET (déroulé pas à pas, base lente mais jamais en délai — chaque RPC répond en 2 500 ms)
t=0 `environnementDeclare` → 2,5 s. sante : `reclamer` (5,0) ; le job lit `etat()` (7,5) puis lève des incidents tant qu'il reste `RESERVE_INCIDENT_MS` (`jobs/sante.ts:64`) — coupé par son `avecDelai(9 000)` à 14,0 ; `clore(false)` (16,5) + `leverIncident` (19,0). synthese : `reclamer` (21,5), fan-out coupé à 57,5, `clore(false)` (60,0) + `leverIncident` (62,5). rappel : `reclamer` (65,0), job coupé à 73,0, `clore` (75,5) + `leverIncident` (78,0). socle : `reclamer` (80,5), le job démarre et **la plateforme tue la fonction à 89,0 s, en plein milieu**.
Tort causé : la ligne `execution_job` du socle reste `en_cours` sous son bail, rien n'est clos, aucun `job_echoue` n'est levé, la réponse HTTP ne part jamais, et le CI […]
```
</details>

### R17 — Dans le chemin de PRODUCTION, `notifier()` appelle `deps.courriel.envoyer` sans `avecDelai` : seul le délai de 10 s de l'adaptateur Resend le borne. `RESERVE_PERSONNE_MS` (31 000) ne couvre que l'appel modèle (25 000) plus six secondes d'allers-retours — pas ces dix secondes-là — dans un budget de job de 36 000.

- **Verdict** : CONFIRME · **angle** : 
- **Où** : `lib/ordonnanceur/jobs/synthese.ts:416`
- **Scénario** : Une seule candidate. Il reste 36 000 ms, donc ≥ 31 000 : la boucle entre. Le modèle prend ses 25 s pleines (c'est son plafond), la synthèse est gravée, `reserverNotification` consomme le droit d'envoyer, puis Resend traîne 10 s. Le job est coupé à 36 s : `ctx.depot.clore` (ligne 217) n'est jamais appelé, la ligne de la personne reste `en_cours` sous `BAIL_PERSONNE_S` = 180 s, la fenêtre du job est close en `echoue` et un `job_echoue` est levé alors que la synthèse est écrite et le courriel peut-être parti. Le chemin de rattrapage borne pourtant l'annonce à `DELAI_ANNONCE_MS` = 3 s (ligne 143) et `rappel-echeance.ts` borne le sien à 4 s : le seul chemin non borné est celui qui écrit vraiment.

<details><summary>Ce que le sceptique a trouvé en cherchant à réfuter</summary>

```
J'ai cherché la garde/la mention ailleurs (policy, trigger, copie, tests, migrations 0034→0072). Elle n'existe nulle part. Le couplage est réel, et il est PIRE que ce que dit la trouvaille.

LA LIGNE FAUTIVE (le couplage)
`supabase/migrations/0053_socle_quotidien_poussee.sql:259-260`, dans `socle_quotidien_du(p_limite)` :
```
     and not exists (select 1 from public.preference_courriel pc
                      where pc.utilisatrice_id = ps.utilisatrice_id and pc.refuse_le is not null)
```
Le commentaire juste au-dessus l'assume comme une décision (« le refus de canal vaut pour TOUTES les notifications produit, courriel comme poussée »), et `tests/socle-sql.test.ts:406` la verrouille (« une désabonnée du canal ne consomme pas une place »). La décision est donc délibérée côté SQL — le défaut n'est pas là, il est dans le fait que RIEN ne le dit à l'utilisatrice, et que deux écrans affirment le contraire.

LES DEUX ÉCRANS QUI AFFIRMENT LE CONTRAIRE
1. `app/desabonnement/page.tsx:98-100` : « Tu ne recevras plus de courriel quand une synthèse est prête. **Rien d'autre ne change** : ta synthèse continue d'être écrite… ». Faux : le clic écrit `preference_courriel.refuse_le` (`0034` par jeton, `0062:64-67` sous session) et éteint aussi la poussée quotidienne.
2. `lib/domain/copie-reglages.ts:118-120` (`DESCRIPTION_COURRIELS`) : « Anam t'écrit deux fois : … **Rien d'autre.** » ; `:133-135` (`COURRIELS_QUI_RESTENT`) énumère ce qui survit et ne cite QUE les courriels de connexion. Le bouton est `ARRETER_COURRIELS = "Ne plus recevoir de courriels"` (`:125`). Aucune des treize constantes du fichier ne mentionne la poussée.

L'ÉCRAN CONTINUE DE MENTIR APRÈS COUP
`app/reglages/page.tsx:122` calcule `abonneIci={(count ?? 0) > 0}` à partir du seul `abonnement_poussee` ; `refuse_le` n'y entre pas. `render/reglages/Reglages.tsx:128` (`recoit = abonne && !divergence`) et `:220` affichent donc `ETAT_ACTIF = "Cet appareil reçoit le rythme quotidien."` (`copie-reglages.ts:31`), et le `<select>` de la ligne `236` continue d'afficher son 08 h. La base, elle, l'a retirée du lot.

CE QUE LA TROUVAILLE SOUS-ESTIME : LE RETOUR EST PIÉGÉ
`abonner_poussee` (`0053:340-368`) n'efface PAS `refuse_le`. Donc « Ne plus rien recevoir sur cet appareil » puis « Recevoir le rythme quotidien » — le seul geste que l'écran propose pour rallumer le socle — ne rallume rien : `socle_quotidien_du` l'exclut toujours. L'unique retour est le bouton `REPRENDRE_COURRIELS`, qui n'est relié à la poussée par aucun mot.

SCÉNARIO CONCRET
Compte majeur, `consentement.art9_accorde/ia_reconnue` vivants, aucun `ep […]
```
</details>

### R18 — « Ne plus recevoir ces messages » (et « Ne plus recevoir de courriels » dans /reglages) éteint aussi, définitivement et sans le dire, la notification quotidienne par POUSSÉE — alors que les deux écrans énumèrent ce qui continue et n'en parlent jamais.

- **Verdict** : CONFIRME · **angle** : 
- **Où** : `app/desabonnement/page.tsx:98`
- **Scénario** : Elle règle son socle quotidien à 8 h dans /reglages (section juste au-dessus), puis clique « Ne plus recevoir de courriels », ou suit le lien du pied d'un courriel qui lui promet « Rien d'autre ne change : ta synthèse continue d'être écrite ». `regler_mes_courriels` / `regler_courriels_par_jeton` écrivent `preference_courriel.refuse_le`, et `socle_quotidien_du` (0053:259) exclut alors sa ligne — la poussée cesse pour toujours. L'écran des réglages continue d'afficher son heure choisie et l'état actif du socle, `socle-quotidien.ts` ne journalise rien (elle n'est plus dans le lot), et le seul texte qui énumère ce qui survit ne mentionne que les courriels de connexion. Elle n'a aucun moyen d'apprendre ni ce qui s'est arrêté ni où le rallumer.

<details><summary>Ce que le sceptique a trouvé en cherchant à réfuter</summary>

```
LIGNE FAUTIVE — `lib/ordonnanceur/jobs/synthese.ts:416` :

    await deps.courriel.envoyer(adresse, "synthese_prete", jeton);

Aucun `avecDelai`. L'appelant du chemin de PRODUCTION est nu lui aussi (`synthese.ts:356` : `if (syntheseId) await notifier(deps, utilisatriceId, syntheseId, instant);`), alors que le chemin de RATTRAPAGE, lui, borne le même `notifier` (`synthese.ts:141-145`, `DELAI_ANNONCE_MS = 3_000`, `lib/domain/synthese.ts:146`). J'ai cherché la garde ailleurs : elle n'existe pas. `creerPortCourriel()` (`lib/courriel/fabrique.ts:62`) rend directement `creerPortResend`, dont le seul plafond est interne : `lib/courriel/adaptateurs/resend.ts:20` → `const DELAI_MS = 10_000`.

L'ARITHMÉTIQUE NE FERME PAS :
- `lib/domain/synthese.ts:120` `DELAI_MODELE_MS = 25_000`
- `lib/domain/synthese.ts:126` `RESERVE_PERSONNE_MS = DELAI_MODELE_MS + 6_000` = 31 000, commenté « l'appel modèle, plus la marge des quatre allers-retours en base ET DE L'ENVOI »
- `lib/ordonnanceur/registre.ts:173` `delaiMs: 36_000`

Le pire cas déclaré d'une personne vaut 25 000 (modèle) + ~1 000 (5 allers-retours : `materiau`, `enregistrer`, `adresse`, `jetonDesabonnement`, `reserverNotification`) + 10 000 (envoi Resend) ≈ 36 000. La garde de `synthese.ts:183` n'exige que 31 000 ms restantes. Elle admet donc une personne dont le travail borné dépasse de ~5 000 ms ce qu'elle a réservé.

SCÉNARIO CONCRET (corrigé — voir réserve ci-dessous) : cron du matin, canal configuré, créneau diurne ouvert. Une annonce en rattrapage part et mord son plafond de 3 000 ms ; la boucle de rattrapage s'arrête ensuite sur `RESERVE_RATTRAPAGE_MS = 35_000` (`domain/synthese.ts:144`). Reste ≈ 31 500 ms. Une candidate : 31 500 ≥ 31 000, la boucle entre. `envoyerSousEgressArt9Ordonnanceur` rend sa réponse à 21 000 ms (sous le plafond, donc pas de rejet), `controlerDocument` + `validerSortieSynthese` passent, `enregistrer` grave la synthèse, `adresse`/`jetonDesabonnement`/`reserverNotification` consomment ~600 ms — la réservation est CONSOMMÉE — puis le POST Resend pend et n'expire qu'à ses 10 000 ms. Total 31 600 > 31 500 : le `avecDelai(job.executer(…), 36_000)` d'`executer.ts:87-99` a déjà gagné la course.

TORT : `executer.ts:101-110` clôt la fenêtre du jour en `echoue` avec le code `synthese_hebdomadaire_timeout` et lève `leverIncident("job_echoue", …)` — alors que la synthèse est gravée, la réservation consommée, le courriel peut-être parti. C'est mot pour mot le mensonge que ce fichier combat par ailleurs (`registre.ts:88-95`, `synthese.ts:179-182`). Et la conséquence n'est pas seulement cosmétique : la  […]
```
</details>

### R19 — Sur `?refus=age`, la branche du refus supprime les liens « Aide » et « CGU » : l'adolescente qu'on vient de refuser est le seul visiteur du produit à qui aucune ressource n'est offerte.

- **Verdict** : CONFIRME · **angle** : 
- **Où** : `app/(auth)/entrer/page.tsx:22`
- **Scénario** : Le ternaire de la ligne 22 met TOUT dans la branche `else` : le formulaire, mais aussi le bloc `<p className={s.mentions}>` des lignes 62-65 qui porte `<a href="/cgu">` et `<a href="/aide">`. Scénario complet : une personne de 14 ans saisit sa date sur `/naissance` ; `declarerAge` (app/(auth)/naissance/actions.ts) pose `mineur_detecte`, appelle `signOut()` et l'écran de refus est servi sur `/entrer?refus=age`. Elle y lit « Ce lieu est réservé aux 18 ans ou plus » et RIEN d'autre : pas de 3018, pas de 119, pas de Fil Santé Jeunes, pas de lien vers `/aide`, aucun chemin de retour. Le contraste est interne au dépôt et il est net : `app/barriere/page.tsx` — l'autre écran de minorité, celui de la détection après coup — liste explicitement quatre lignes d'écoute adaptées à l'âge, et `app/not-found.tsx` garde son lien « Aide » en écrivant « un écran d'erreur est le dernier endroit où l'on peut se permettre de retirer la sortie de secours ». Le chemin le plus certain de mener un mineur sur cet écran est aussi le seul où la porte de secours a été retirée.

<details><summary>Ce que le sceptique a trouvé en cherchant à réfuter</summary>

```
DÉFAUT CONFIRMÉ — l'écran de révocation nie un droit (art. 15) qui est pourtant livré, et n'offre que l'irréversible.

LIGNE FAUTIVE — app/(auth)/consentement/revoque/page.tsx:61-69 :
    <button className={s.boutonSecondaire} type="button" disabled style={{ opacity: 0.6 }}>
      <span className="t-bouton">Exporter mes données</span>
    </button>
    <p className={s.motif}>L&apos;export sera disponible avant le lancement.</p>
Suivi, lignes 71-75, du SEUL geste actif : <form action={supprimerCompteRevoque}> avec un bouton « Supprimer mon compte » — sans case de confirmation (contrairement à /mes-donnees, qui exige `compris=oui`, app/mes-donnees/actions.ts:32).

RÉFUTATIONS TENTÉES, TOUTES TOMBÉES :
1) « L'export ne marcherait pas pour une révoquée, le bouton est honnête. » FAUX. app/api/export/route.ts:57-60 ne pose AUCUNE garde d'onboarding et l'écrit : « Quelqu'un qui a révoqué aussi : l'accès (art. 15) survit à la révocation ». Et la RPC public.exporter_mes_donnees() (supabase/migrations/0057_export_donnees.sql:51-66) ne teste QUE `if v_uid is null` ; ni `a_consenti_art9`, ni `revoked_at is null` n'y figurent (grep sur le fichier : aucune occurrence de revoked_at ni a_consenti_art9). Une révoquée reçoit donc le document COMPLET.
2) « Un autre chemin le lui dit. » NON. grep "/api/export" sur app|lib|render : seulement app/mes-donnees/page.tsx:71 et app/barriere/page.tsx:85. grep "/mes-donnees" : seul lien cliquable = app/reglages/page.tsx:165, dont le commentaire admet « le seul chemin cliquable vers Mes données tant que le menu de compte n'existe pas ». L'écran /consentement/revoque ne porte ni PiedHalte ni lien : lib/domain/pied-halte.ts le classe HORS_HALTE avec le motif « impasse volontaire après révocation ». Aucune redirection ne l'y amène non plus (pas de proxy.ts routant vers /mes-donnees ; proxy.ts ne fait que session+CSP+X-Robots-Tag).
3) « C'est peut-être couvert par un test / déjà su. » Aucun test ne touche cet écran (grep "Exporter mes données" → seulement barriere/page.tsx:86 et revoque/page.tsx:67). Le commentaire de supprimerCompteRevoque (app/(auth)/consentement/actions.ts:120-121) porte encore la phrase périmée « L'export réel des données […] est différé à l'epic données (AD-14) », alors que app/barriere/page.tsx:85 a bien été migré vers un <a href="/api/export"> actif : la 6.6 a mis à jour /barriere et oublié /consentement/revoque.

AGGRAVANT NON RELEVÉ PAR LA TROUVAILLE : l'écran PRÉCÉDENT lui promet l'export. app/(auth)/consentement/revoquer/page.tsx:57-58 : « Si tu le retires, le traitement s'arrête […] Tu pourras alors exporter  […]
```
</details>

### R20 — Le GET du plan sert du verbatim art. 9 à un compte révoqué ou barré-minorité : c'est la seule route de `app/api/anam/` qui ne compare pas son état à `etapeOnboardingPour`, alors que sa voisine `echange` le fait pour cette raison exacte.

- **Verdict** : CONFIRME · **angle** : 
- **Où** : `app/api/anam/plan/route.ts:36`
- **Scénario** : `GET /api/anam/plan?brancheId=<uuid>` ne fait qu'`auth.getUser()` puis `charger_plan` (migration 0036:390, `security invoker`) ; la policy `intention_lecture` (0036:242) n'a pour tout prédicat que `auth.uid() = utilisatrice_id`, sans `a_consenti_art9()` ni `est_barre_minorite()` — délibérément, pour que l'export FR-067 survive. Le `declencheur` et l'`action` d'une intention sont ses mots à elle sur sa vie intérieure, donc de l'article 9. Scénario : elle révoque son consentement sur `/consentement/revoquer` ; toutes les surfaces la renvoient vers l'écran suspendu qui promet « le traitement de tes données sensibles est suspendu, plus rien n'est analysé ». Son cookie de session reste valide (c'est voulu, l'export en a besoin) : un GET sur cette route continue de lui servir son art. 9 dans l'application. Même chose pour un compte sous barrière de minorité (`barre`), à qui le produit n'affiche plus que `/barriere`. `app/api/anam/echange/route.ts:31` a tranché ce cas exact en ajoutant `if (etape !== "suite") return 403`, avec ce commentaire : « SERVIR le verbatim art. 9 dans l'app à quelqu'un qui a retiré son consentement — ou dont le compte est barré-minorité — n'est pas de l'export : c'est de l'usage produit. » Le POST du même fichier est couvert (les policies d'écriture citent les deux prédicats) ; c'est le GET qui a été oublié.

<details><summary>Ce que le sceptique a trouvé en cherchant à réfuter</summary>

```
J'ai cherché la garde partout où elle pouvait vivre (policy, trigger, contrainte, appelant, test) : elle n'existe sur aucun de ces chemins.

LIGNE FAUTIVE — le chemin 6.7 ne parle à personne d'autre qu'à Postgres
- /Users/juliantalou/anima-app/app/mes-donnees/actions.ts:35 — `await effacerToutesSesDonnees(supabase);` est le SEUL effet de `effacerTout` (le reste : `getUser`, la case `compris`, `signOut`, `redirect`). Aucun import Stripe dans le fichier.
- /Users/juliantalou/anima-app/lib/data/effacer-donnees.ts:22 — un unique `supabase.rpc("effacer_toutes_mes_donnees", …)`.
- 0059_retention_automatique.sql:122-137 — l'enveloppe ne fait que `return public.effacer_utilisatrice(v_uid, 'utilisatrice', p_fenetre_pitr_jours);`.
- 0061_revue_epic_6.sql:223-278 — le corps du moteur unique ne lit JAMAIS `public.abonnement` ; il pose la trace puis exécute trois `delete` (lignes 272-274) : `delete from public.branche` / `delete from public.utilisatrice` / `delete from auth.users`.
- 0013_abonnement.sql:27 — `utilisatrice_id uuid not null unique references public.utilisatrice(id) on delete cascade` : la ligne `abonnement` — donc `stripe_subscription_id`, seul lien vers Stripe — disparaît avec la cascade. Après le commit, plus rien en base ne permet de savoir quoi annuler.

LA GARDE N'EST NULLE PART AILLEURS
- Aucun trigger de suppression sur `abonnement` ni sur `utilisatrice` : `grep -rn "before delete|after delete"` sur `supabase/migrations/*.sql` ne rend qu'un seul résultat, 0027_ordonnanceur.sql:63 `before delete on public.environnement`.
- Aucune file d'attente / outbox : les seuls appelants de `resilierEnFinDePeriode` sont `app/api/abonnement/resilier/route.ts:168`, `app/(auth)/consentement/actions.ts:100` et `lib/stripe/resiliation.ts:142` (dans `rembourserIntegralement`). Le chemin 6.7 n'en est pas.
- La page ne gate rien : `app/mes-donnees/page.tsx` ne contient pas une seule occurrence de « abonn », « stripe » ou « paiement » ; ses seules redirections sont `barre`/`mineur`/`naissance`/`consentement` — une abonnée à jour arrive au formulaire.
- Le test M7 ne couvre pas ce chemin : `tests/effacement-stripe.test.ts:77` — `const { refuser, supprimerCompteRevoque } = await import("@/app/(auth)/consentement/actions");`. Il ne charge jamais `app/mes-donnees/actions`.
- La preuve que la doctrine du projet exige l'inverse est écrite dans le dépôt lui-même : `app/(auth)/consentement/actions.ts:88-105` lit `stripe_subscription_id`, appelle `resilierEnFinDePeriode` AVANT `deleteUser`, et `redirect(cheminEchec)` sans effacer si Stripe est injoignable — « EN CAS D'ÉCHEC ST […]
```
</details>

### R21 — `refuser` et `supprimerCompteRevoque` effacent par `auth.admin.deleteUser`, contournant le moteur unique : aucune ligne dans `effacement`, et aucun retrait préalable des branches.

- **Verdict** : CONFIRME · **angle** : 
- **Où** : `app/(auth)/consentement/actions.ts:109`
- **Scénario** : Une utilisatrice révoquée clique « Supprimer mon compte » : `effacerCompteCourant` appelle `admin.auth.admin.deleteUser(user.id)` et laisse la cascade `auth.users → utilisatrice` faire le reste. Deux conséquences. (1) AUCUNE TRACE : `public.effacement` — la table créée en 0058 précisément parce que « la trace doit survivre à la personne » et que l'AC5 exige que l'opération soit journalisée — reste vide ; le responsable de traitement ne peut prouver ni la date, ni le motif, ni la fenêtre PITR pour ce chemin. La garde tests/effacement-schema.test.ts:129 (« un seul endroit du corpus supprime l'utilisatrice ») ne lit que les définitions SQL : un `deleteUser` en TypeScript lui est invisible, donc l'invariant AD-14 « un moteur unique » est faux sans qu'aucun test ne rougisse. (2) FRAGILITÉ ASSUMÉE AILLEURS : 0058 explique que la cascade depuis `auth.users` touche `branche` et `entree_journal` dans un ordre non maîtrisé, et que si le journal part le premier la clé `branche_extrait_meme_proprietaire` (seul `on delete restrict` du schéma) mord et fait ÉCHOUER tout l'effacement — d'où le `delete from public.branche` explicite du moteur. Ce chemin-ci ne le fait pas : pour une révoquée qui a posé des branches, une simple réordonnance de contraintes rend sa suppression définitivement impossible (redirect vers ?erreur=suppression à chaque tentative).

<details><summary>Ce que le sceptique a trouvé en cherchant à réfuter</summary>

```
J'ai cherché la garde ailleurs (trigger, contrainte, autre insert, test) et je ne l'ai pas trouvée.

LA LIGNE FAUTIVE — /Users/juliantalou/anima-app/app/(auth)/consentement/actions.ts:109
    const { error } = await admin.auth.admin.deleteUser(user.id);
C'est le corps de `effacerCompteCourant`, appelé par `refuser()` (l. 121) et par `supprimerCompteRevoque()` (l. 130). Il n'y a AUCUN autre `delete` sur ce chemin : ni `delete from public.branche`, ni appel RPC. Dernier commit touchant ce fichier : e457d13 (revue 3.1/3.3/3.5) — antérieur à l'epic 6, le fichier n'a jamais été rapatrié sur le moteur.

CE CHEMIN EST BIEN ATTEIGNABLE, PAR UN BOUTON
/Users/juliantalou/anima-app/app/(auth)/consentement/revoque/page.tsx : `<form action={supprimerCompteRevoque}>` → bouton « Supprimer mon compte », sur l'écran où toute révoquée est renvoyée. Idem /Users/juliantalou/anima-app/app/(auth)/consentement/formulaire-consentement.tsx:93 pour `refuser`.

(1) AUCUNE TRACE — VÉRIFIÉ, PAS DÉDUIT
- `insert into public.effacement` n'apparaît QUE dans 0058:108, 0059:95 et 0061:262, tous les trois à l'INTÉRIEUR de `effacer_utilisatrice` / `effacer_toutes_mes_donnees`. Aucun code TS n'écrit dans `effacement` (grep sur app/ et lib/ : seules occurrences = `?echec=effacement` et les inventaires).
- Aucun trigger ne peut compenser : le seul `create trigger` sur `auth.users` du corpus est `on_auth_user_created … after INSERT` (0002:36), et le seul `before/after delete` du dépôt est sur `public.environnement` (0027:63). Rien ne s'accroche à la suppression d'une `utilisatrice`.
Donc : `deleteUser` → cascade `auth.users → utilisatrice → 27 tables`, et `public.effacement` reste vide. L'AC5 de la 6.7 (« l'opération est journalisée ») et AD-14 (« moteur unique ») sont contournés en TypeScript.

ENTRÉES CONCRÈTES → TORT
Une utilisatrice qui a consenti, tenu son journal et posé des branches, puis révoqué (`revoked_at` posé par `revoquerConsentement`) : elle atterrit sur /consentement/revoque, clique « Supprimer mon compte ». Résultat : compte détruit, 0 ligne dans `public.effacement`. Le responsable de traitement ne peut prouver ni la date, ni le motif, ni la fenêtre PITR (`survivance_jusqu_au`) de cet effacement — exactement ce que 0058 dit vouloir garantir (« la trace doit survivre à la personne »). Si elle passe au contraire par /mes-donnees (dont page.tsx ne redirige délibérément PAS `revoque` : « l'accès art. 15 survit à la révocation, exactement comme l'effacement art. 17 »), la même suppression pose une trace. Deux boutons, deux comportements de conformité : celui que l'écran de révocati […]
```
</details>

### R22 — L'avis d'inactivité annonce « d'ici trois mois » en dur alors que le préavis est un paramètre acceptant 1 à 24 mois : le compte peut être effacé bien avant la date annoncée.

- **Verdict** : CONFIRME · **angle** : 
- **Où** : `lib/courriel/gabarits.ts:186`
- **Scénario** : L'exploitant pose RETENTION_PREAVIS_MOIS=1 (valeur acceptée : PREAVIS_MOIS_MIN=1 dans lib/domain/retention.ts:31, et `dureeDepuisTexte` l'applique). `poser_echeance_suppression` écrit alors `echeance_suppression = aujourd'hui + 1 mois`, tandis que le courriel envoyé juste avant (jobs/retention.ts phase 2) dit mot pour mot « Sans usage d'ici trois mois, il sera supprimé ». Trente jours plus tard, `comptes_a_effacer` la sélectionne et `trancher_echeance_suppression` efface tout — deux mois avant la date annoncée, sans second avis. La seule notification légale du produit ment sur le délai, et le fichier interdit structurellement de l'interpoler (« la table est constante et ses deux seuls trous sont typés nominalement »), donc la divergence ne peut pas se corriger toute seule. C'est le pendant, côté copie, de la règle AD-14 « les seuils sont des paramètres lus à l'exécution, jamais codés en dur ».

<details><summary>Ce que le sceptique a trouvé en cherchant à réfuter</summary>

```
RECTIFICATION D'ADRESSE : la ligne fautive n'est pas gabarits.ts:186 (c'est `encadre,` du gabarit de reconduction) mais **/Users/juliantalou/anima-app/lib/courriel/gabarits.ts:224** :

    "Ce compte n'a pas servi depuis longtemps. Sans usage d'ici trois mois, il sera supprimé,",

CE QUE J'AI CHERCHÉ POUR RÉFUTER, ET QUI N'EXISTE PAS
1. Un paramètre dans la signature : `InformationLegale` (lib/courriel/port.ts:98-100) est une union discriminée où `{ motif: "inactivite_avant_suppression" }` ne porte AUCUN champ. `gabaritLegalPour(information, origine)` n'a donc structurellement aucune valeur où loger un préavis. `annoncerInactivite` (lib/courriel/avis-inactivite.ts:38) appelle `envoyerInformationLegale(adresse, { motif: "inactivite_avant_suppression" })` sans rien d'autre. Le courriel ne peut pas savoir quel préavis a été retenu.
2. Un verrou sur la valeur : aucun. lib/domain/retention.ts:29-31 pose `PREAVIS_MOIS_DEFAUT = 3`, `PREAVIS_MOIS_MIN = 1`, `PREAVIS_MOIS_MAX = 24`, et `preavisRecevable` (l.55-57) valide donc `1` comme recevable. À comparer avec `INACTIVITE_MOIS_MIN = 12`, plancher délibérément relevé « parce qu'aucune coquille plausible ne descend en dessous » : le plancher du préavis, lui, a été volontairement laissé à 1.
3. Un garde-fou côté SQL : `poser_echeance_suppression` (0061_revue_epic_6.sql:185-193) ne refuse que `null` ou `<= 0` ; elle écrit `((now() at time zone 'Europe/Paris') + make_interval(months => p_preavis_mois))::date`. Rien n'y impose 3.
4. Un test qui lie la copie au paramètre : aucun. tests/retention-avis.test.ts assère la signature, l'absence de « — Anam », l'URL `/mes-donnees`, la neutralité de l'objet — jamais le délai. Aucun `toMatch(/trois mois/)` n'existe sur ce gabarit dans tout le dépôt (vérifié par grep). Pire : le même fichier (l.186-201) stubbe `RETENTION_PREAVIS_MOIS="2"` et assère `p_preavis_mois: 2` — la suite de tests exerce donc elle-même une valeur qui rend le courriel faux, sans le remarquer.
5. Une consigne d'exploitation : `.env.example`, `.env.local`, `.env.test.local` et `vercel.json` ne contiennent AUCUNE entrée `RETENTION_*`. L'exploitant qui pose la variable n'a nulle part un avertissement lui disant que la copie du courriel est figée à 3.

LA CHAÎNE COMPLÈTE, AVEC `RETENTION_PREAVIS_MOIS=1`
- depot-retention.ts:46 → `dureeDepuisTexte("1", 3, preavisRecevable)` rend `1` (recevable).
- jobs/retention.ts:101 sélectionne une dormeuse via `comptes_a_prevenir` (0059:144-163 : `echeance_suppression is null`, non mineure, non abonnée active, inactive depuis `p_inactivite_mois`).
- jobs/retention.ts:112 `an […]
```
</details>

### R23 — L'export ne contient pas l'adresse e-mail ni les dates de connexion : elles vivent dans `auth.users`, hors de portée de la RPC et de sa garde d'inventaire.

- **Verdict** : CONFIRME · **angle** : 
- **Où** : `supabase/migrations/0057_export_donnees.sql:79`
- **Scénario** : Une utilisatrice télécharge son fichier depuis /mes-donnees. Le document s'ouvre sur « Ce fichier est complet : il porte toutes les couches » et ne déclare que deux retraits (clés de poussée, jeton de désabonnement). Or `exporter_mes_donnees` ne lit que des tables `public` : `utilisatrice` (0002) ne porte AUCUNE adresse — lib/data/depot-canal-courriel.ts:28 le dit explicitement (« L'adresse vit dans auth.users, jamais recopiée dans une table public ») et la lit par `auth.admin.getUserById`. La seule donnée directement identifiante que le responsable détient, plus les horodatages de connexion et de confirmation, sont donc absents du fichier et absents de la clé `retraits`. La garde tests/export-inventaire.test.ts ne peut pas le voir : elle construit son univers à partir des `create table` du corpus de migrations, ce qui exclut le schéma `auth` par construction — l'omission est invisible aux deux niveaux à la fois.

<details><summary>Ce que le sceptique a trouvé en cherchant à réfuter</summary>

```
J'ai cherché la contre-preuve à quatre endroits (une colonne courriel dans `public`, un enrichissement côté route, une décision d'exclusion documentée, une garde de test). Aucune n'existe. La trouvaille tient.

## 1. La RPC ne lit que `public`, et `public.utilisatrice` n'a pas d'adresse

`supabase/migrations/0057_export_donnees.sql` lignes 68-155 : les 29 sous-requêtes sont toutes `from public.<table>`. La section « QUI ELLE EST » (l. 79-80) est :

```sql
'utilisatrice', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
                   from public.utilisatrice t where t.id = v_uid),
```

Colonnes réelles de cette table, reconstituées sur tout le corpus (`0002` puis `0003`, `0006`, `0039`, `0040`, `0060`) : `id, cree_le, date_naissance, mineur_detecte, barriere_minorite_le, echeance_suppression, prenom, nom_complet, heure_naissance, lieu_naissance, lieu_latitude, lieu_longitude, lieu_fuseau, socle_complete_annonce_le, naissance_corrections, naissance_corrigee_le`. **Aucune adresse.** `grep` sur `add column|create table` de tout `supabase/migrations/` ne rend qu'un seul objet portant « courriel » : la table `preference_courriel` (0034), qui ne porte qu'un refus et un jeton — pas d'adresse.

`lib/data/depot-canal-courriel.ts:28` le dit noir sur blanc — « L'adresse vit dans `auth.users`, jamais recopiée dans une table `public` » — et l. 64-66 la lit par `supabase.auth.admin.getUserById(...)` → `data.user?.email`. C'est le seul chemin d'accès à l'adresse dans tout le dépôt.

## 2. La route a l'objet `user` en main et n'en met rien dans le document

`app/api/export/route.ts` l. 51-53 fait `const { data: { user } } = await supabase.auth.getUser()` — donc `user.email`, `user.last_sign_in_at`, `user.email_confirmed_at`, `user.created_at` sont disponibles. Puis l. 62 `document = await chargerExport(supabase)` et l. 72 `rendreExportLisible(document)` : **le document part tel quel**, sans une seule ligne d'enrichissement. `lib/data/exporter-donnees.ts` ne fait que valider `genere_le`. `lib/domain/export-lisible.ts` itère sur `Object.keys(doc)` (`ordonnerSections`) : il ne peut rendre que ce que la RPC a mis.

## 3. Le document affirme le contraire, et ne déclare que deux retraits

`lib/domain/copie-mes-donnees.ts` :

```ts
export const DOCUMENT_PREAMBULE =
  "Ce fichier est complet : il porte toutes les couches, y compris celles que l'application ne " +
  "montre nulle part. …";
export const DOCUMENT_TITRE_RETRAITS = "Deux choses ne sont pas dans ce fichier, et voici lesquelles :";
```

`0057` l. 71-76 : la clé `retraits` contient exactement deux entrées (`cl […]
```
</details>

### R24 — `lecture_depot` n'épingle pas l'état initial : le `WITH CHECK` ne dit rien de `reponse`/`restitution`/`close_a`. Un INSERT direct crée une lecture DÉJÀ CLOSE, avec une `restitution` (la prose d'Anam, FR-021) entièrement forgée puis rendue immuable — et libère du même coup l'index partiel `lecture_une_seule_en_attente`.

- **Verdict** : CONFIRME · **angle** : 
- **Où** : `supabase/migrations/0051_lecture.sql:189`
- **Scénario** : Sous son propre JWT, premium et hors détresse : (1) `POST /rest/v1/tirage {carte, graine, taille_jeu}` ; (2) `POST /rest/v1/lecture {tirage_id, reponse: "x", restitution: "Anam voit en toi …"}`. Le trigger `lecture_horodatage` (l. 110) pose `close_a := now()` puisque `reponse` n'est pas nul ; la contrainte `lecture_cloture_coherente` est satisfaite ; la ligne naît close. Deux conséquences. (a) `lecture_cloture` (l. 220) et le trigger `lecture_colonnes_figees` (l. 143) qui protègent « ses mots ne se réécrivent pas » ne sont JAMAIS traversés : la prose attribuée à Anam est écrite par la cliente, affichée telle quelle dans « Mes lectures » et exportée comme parole d'Anam — exactement ce que 0016 puis 0068 ont refusé pour `entree_journal.role='anam'` (« sinon une utilisatrice forgerait de fausses paroles d'Anam, immuables »), en fabriquant pour cela une RPC `service_role`. (b) L'index partiel `where reponse is null` n'est jamais occupé : on peut donc boucler (1)+(2) autant de fois qu'on veut, ce qui rouvre le re-tirage que l'en-tête de 0051 déclare fermé (« ne peut plus produire une seconde carte ») et que 0050 avait nommé comme dette. La garde manquante : `and reponse is null and restitution is null and close_a is null` dans le `WITH CHECK` de `lecture_depot`.

<details><summary>Ce que le sceptique a trouvé en cherchant à réfuter</summary>

```
J'ai cherché à réfuter sur quatre fronts (redéfinition ultérieure, garde dans une policy des deux tables, garde dans `reserver_notification`, garde dans le job TS). Aucun n'a tenu.

**1. La ligne fautive existe et n'a jamais été amendée.**
`personne_joignable` n'est définie qu'une seule fois dans tout le dépôt : `supabase/migrations/0053_socle_quotidien_poussee.sql:43`. Un `grep -rn "personne_joignable"` sur les migrations ne rend aucun autre `create`/`create or replace` — 0054 ne fait que dire pourquoi elle ne l'utilise PAS, 0061 ne touche que le commentaire de colonne `preference_socle.heure`. Son corps (l. 51-72) porte :

```
and u.barriere_minorite_le is null                        -- l. 54
and u.mineur_detecte is not true                          -- l. 55
and exists (select 1 from public.consentement k
             where k.utilisatrice_id = u.id
               and k.art9_accorde = true
               and k.ia_reconnue  = true
               and k.revoked_at is null)                  -- l. 56-60
```

Ni `k.cgu_acceptees = true`, ni `u.date_naissance is not null`. Alors que 0072 (l. 48) a ajouté le premier à `a_consenti_art9`, l'a ré-écrit à la main dans `eligible_au_periodique` (0072:72), et que 0066 a ajouté le second à `est_barre_minorite` (`u.date_naissance is not null`, forme `not exists (tout va bien)`).

**2. 0072 a bien cassé la délégation, et le point est aggravant.** 0053:81-92 écrivait `eligible_au_periodique` comme `select public.personne_joignable(...) and exists (abonnement actif)`, avec l'argument explicite « il n'existe plus deux endroits où écrire AD-17 ». 0072:53-80 la ré-inline intégralement (jointure `abonnement` + minorité + consentement + AD-17). Il y a donc désormais **trois** copies de la clause, et `personne_joignable` est celle qu'on a oubliée. Le test de couplage écrit exprès pour ça, `tests/cgu-comptent.test.ts:173-197`, ne relit que les deux corps présents dans 0072 (`corps("a_consenti_art9")`, `corps("eligible_au_periodique")`) : la troisième copie lui est invisible. Rien dans la suite ne peut donc voir la divergence.

**3. Aucune garde ailleurs sur le chemin.**
- Policies des deux tables : `preference_socle_proprietaire_creation` (0053:159) et `abonnement_poussee_proprietaire_creation` (0053:222) n'ont pour tout `with check` que `auth.uid() = utilisatrice_id`. Ni `est_barre_minorite()`, ni `a_consenti_art9()`. Aucune migration postérieure ne les modifie (`grep` sur les deux noms de table hors 0053 → seulement 0057 export et 0061 commentaire). Aucun trigger non plus.
- `consentement_insertion` (0042:100) : `auth.uid() = u […]
```
</details>

### R25 — Le plafond d'OCTETS de `materiau_synthese` ne couvre que les entrées de journal ; la branche `faits` n'est bornée qu'en NOMBRE de lignes (`limit 200`), et `fait_extrait.contenu` n'a aucune contrainte de longueur — seule `branche.nom` en a une dans tout le schéma (0023:80).

- **Verdict** : CONFIRME · **angle** : 
- **Où** : `supabase/migrations/0065_corriger_veut_dire_retenir.sql:338`
- **Scénario** : Sous JWT, consentement valide, majorité établie : `POST /rest/v1/fait_extrait {utilisatrice_id: <moi>, cle_dedoublonnage: "k1", contenu: <10 Mo>, extrait_source_id: null}`. La policy `fait_extrait_insertion` (0047:61) accepte (propriétaire + consentement + majorité + source nulle autorisée), `fait_extrait_naissance` force `statut='actif'`, rien ne borne `contenu`. Répété 200 fois avec des clés distinctes. Au tick hebdomadaire, `materiau_synthese` applique bien `left(f.contenu, p_plafond_octets)` aux entrées (l. 320) et la fenêtre `octets <= p_plafond_octets` (l. 305), mais la sous-requête des faits (l. 332-338) n'a que `limit 200` : le jsonb rendu pèse ~2 Go. Torts : (a) l'appel au modèle fort échoue ou est tronqué, donc CETTE personne n'a jamais sa synthèse — et comme `synthese` n'est pas écrite, le filigrane n'avance pas et le cas se rejoue chaque semaine ; (b) le lot est traité SÉQUENTIELLEMENT sous une échéance de tick (`lib/ordonnanceur/jobs/synthese.ts`), donc la personne obèse consomme le budget du tick et les autres du même lot sont abandonnées. Le plafond d'octets existe précisément pour ça depuis 0035 ; il n'a jamais été étendu aux faits.

<details><summary>Ce que le sceptique a trouvé en cherchant à réfuter</summary>

```
J'ai cherché la garde ailleurs (policy, trigger, contrainte, appelant, rendu, test) et elle n'existe nulle part. La chaîne est complète et chaque maillon est lu dans le fichier.

1. L'EXPORT SORT BIEN L'ENDPOINT EN CLAIR — supabase/migrations/0057_export_donnees.sql:152-154 :
   'abonnement_poussee', (select coalesce(
       jsonb_agg((to_jsonb(t) - 'cle_p256dh' - 'cle_auth') order by t.cree_le), '[]'::jsonb)
      from public.abonnement_poussee t where t.utilisatrice_id = v_uid)
   Seules deux clés sont ôtées. Et le document DÉCLARE positivement que ce sont les seules (0057:72) : jsonb_build_object('table','abonnement_poussee','colonnes', jsonb_build_array('cle_p256dh','cle_auth'), 'motif','clés de poussée : une capacité sur ton appareil, pas une donnée sur toi'). Le motif voisin, ligne 75, est mot pour mot la propriété de l'endpoint : « jeton de désabonnement : quiconque le lit peut te désabonner sans être toi ». L'inventaire TS répète le même retrait partiel (lib/domain/inventaire-export.ts:106 retraits: ["cle_p256dh","cle_auth"]).

2. L'ENDPOINT VOYAGE DEUX FOIS DANS LE FICHIER TÉLÉCHARGÉ — lib/domain/export-lisible.ts:136-148, rendreGenerique itère Object.entries(r) (« Rien n'est jamais omis ») : la fiche affiche « Endpoint — https://fcm.googleapis.com/… ». Et ligne 284/308, tout le document est ré-embarqué : `<script type="application/json" id="donnees-brutes">${JSON.stringify(doc)}</script>`. app/api/export/route.ts:70-76 le sert en pièce jointe. Aucun filtrage côté route ni côté rendu.

3. L'ENDPOINT EST UNE CAPACITÉ, ET LA BASE LE TRAITE PARTOUT AILLEURS COMME UN SECRET :
   - RLS lecture réservée à la propriétaire (0053:220-221, `abonnement_poussee_proprietaire_lecture ... using (auth.uid() = utilisatrice_id)`), suppression réservée à la propriétaire (0053:224-225) ;
   - `endpoints_poussee(uuid)` est révoquée à `authenticated` (0053:296), ce que tests/socle-sql.test.ts:609 vérifie (« permission denied »).
   Donc aucune autre voie API ne donne l'endpoint d'autrui. L'export est LA seule fuite.

4. LA PORTE QUE L'ENDPOINT OUVRE — supabase/migrations/0053_socle_quotidien_poussee.sql:355, dans une fonction `security definer` (0053:343-344) accordée à `authenticated` (0053:371) :
       delete from public.abonnement_poussee where endpoint = p_endpoint;
   Aucun `and utilisatrice_id = v_moi`. L'en-tête l'assume (0053:329-330 : « supprimer la ligne de l'autre exige de voir une ligne qui ne lui appartient pas, ce que `abonnement_poussee_proprietaire_retrait` interdit — à raison ») et le justifie par une hypothèse que l'export détruit (0053:338-339 : « […]
```
</details>

### R26 — L'export retire `cle_p256dh` et `cle_auth` d'`abonnement_poussee` au motif que ce sont « des CAPACITÉS, pas des données sur elle », mais conserve `endpoint` — qui EST la capacité de faire disparaître l'abonnement de quelqu'un via `abonner_poussee` (cf. trouvaille n° 1). Le raisonnement appliqué à `preference_courriel.jeton` (« quiconque le lit peut te désabonner sans être toi ») vaut mot pour mot pour cette colonne.

- **Verdict** : CONFIRME · **angle** : 
- **Où** : `supabase/migrations/0057_export_donnees.sql:152`
- **Scénario** : Bérénice exerce son droit d'accès, télécharge son JSON, se l'envoie par courriel ou le dépose sur un disque partagé — c'est l'usage que l'export invite à faire. Le document contient `abonnement_poussee[].endpoint` en clair. Quiconque lit le fichier et possède un compte Anima peut alors, par un seul `rpc/abonner_poussee`, supprimer l'abonnement de Bérénice sans être elle et sans laisser de trace. L'export fabrique donc exactement la « fuite de pouvoir » que sa propre clé `retraits` prétend éviter, avec en prime la déclaration écrite que seules les deux clés cryptographiques ont été retirées.

<details><summary>Ce que le sceptique a trouvé en cherchant à réfuter</summary>

```
J'ai tenté de réfuter et je n'y arrive pas : la garde n'existe nulle part ailleurs, et le fichier se contredit lui-même à 29 lignes d'écart.

LIGNE FAUTIVE — `app/api/anam/message/route.ts:229` :
`if (!securite.limitesLevees && seanceClose) {` … puis `couper = doitCouperConversation({ premium, limitesLevees: securite.limitesLevees, seanceClose, toursConsommes, limite })` et `return new Response(corpsQuota, …)` (l. 274). Ni la condition d'entrée ni `doitCouperConversation` (lib/domain/allocation-residuelle.ts — ses 5 court-circuits sont `premium`, `limitesLevees`, `seanceClose`, `limite === null`, `toursConsommes`) ne connaissent `niveauSecurite`. Or la MÊME route écrit à la l. 200 : `const clotureAutorisee = niveauSecurite === 0 && !securite.limitesLevees;` — la garde de clôture, elle, exige les DEUX. L'asymétrie est dans le même fichier, sur la même variable.

LA FENÊTRE EST RÉELLE ET UNIQUE, prouvée par le SQL. `lib/safety/pipeline.ts:90-92` lit `plancherEpisode()` AVANT `enregistrerTour()` et pose `niveauEffectif = max(détecté, plancher)`. `0067_plancher_episode_niveau_atteint.sql` : `niveau_plancher_episode` rend `niveau_max` de l'épisode dont `fin is null`. `0011_episode_detresse_corrections.sql` : pour `p_niveau >= 1` la fonction renvoie TOUJOURS `true` ; le seul chemin qui renvoie `false` avec un épisode encore ouvert à la lecture du plancher est l'extinction (`v_tours >= p_seuil_tours and now() - dernier_niveau_eleve_le >= p_duree_min_s` → `set fin = now() … return false`). Donc l'état `verdict.niveau ≥ 2` ET `limitesLevees === false` existe exactement à un tour : celui de l'extinction. Seuils réels : `SEUIL_TOURS_SURS = 3`, `DUREE_MIN_EPISODE_MS = 30 min` (lib/safety/episode-detresse.ts).

ENTRÉES CONCRÈTES → TORT. Compte non premium, `finProposee = true` (1re séance close), `ALLOCATION_RESIDUELLE_TOURS=20` posé en env (précondition ops : sans lui `limite === null` et rien ne coupe), 20 lignes `usage_ia` `post_premiere_seance` déjà écrites ce mois. Tour N à 14 h 00 : idéation active → `enregistrer_tour_detresse(3)` ouvre l'épisode, `limites_levees = true` → gate l. 229 non entré, aucun décompte (`tourAllocationResiduelle` reste false), bloc `{t:"ressources", position:"avant"}` avec 3114 émis. Tours N+1, N+2 à 14 h 05 et 14 h 20 : détecté 0, plancher 3 → `verdict.niveau = 3`, bloc émis, toujours pas de décompte. Tour N+3 à 14 h 35 (≥ 30 min depuis le dernier tour élevé, 3e tour sûr) : `plancherEpisode()` rend encore 3 (l'épisode est ouvert au moment de la lecture) → `niveauSecurite = 3`, puis `enregistrerTour(0)` ÉTEINT et rend `false`. Le gate l […]
```
</details>

### R27 — La policy `enneagramme_depot` ne porte pas `branche_bloquee_par_detresse()` : accepter l'hypothèse de type d'Anam écrit une étiquette de personnalité permanente pendant un épisode ouvert ou dans les 72 h, alors que semer le germe (0049:249) et le DIRE (0063) sont tous deux gardés.

- **Verdict** : CONFIRME · **angle** : 
- **Où** : `supabase/migrations/0049_enneagramme.sql:142`
- **Scénario** : Lundi, hors détresse : l'étage `hypothese-enneagramme-pipeline` sème un germe `en_attente`, Anam le dit. Mardi, épisode de détresse ouvert (ou dans les 72 h qui suivent son extinction). La halte `/enneagramme` appelle `lireHypotheseEnneagramme(..., { seulementADire: false })` (app/enneagramme/page.tsx:91) — un simple `select` sur `enneagramme_hypothese`, sans aucun prédicat de détresse, contrairement à `charger_hypothese_a_dire` que 0063 a précisément gardée. L'écran `Hypothese` s'affiche avec son bouton « Oui ». Un clic → Server Action `accepterHypothese` → RPC `accepter_hypothese_enneagramme` (0049:458, `security invoker`, sans garde AD-17) → `insert into public.enneagramme (type, origine='hypothese')`, autorisé par `enneagramme_depot` dont le `with check` ne teste que `auth.uid()`, `a_consenti_art9()` et `est_barre_minorite()`. Résultat : une étiquette de personnalité posée sur elle en pleine crise — le « travail de schéma » que FR-037 suspend dès niveau ≥ 1 et qu'AD-17 interdit partout ailleurs pendant 72 h. Rien ne l'empêche non plus par POST PostgREST direct, `authenticated` détenant les grants DML.

<details><summary>Ce que le sceptique a trouvé en cherchant à réfuter</summary>

```
J'ai essayé de réfuter, je n'ai trouvé la garde nulle part.

LA LIGNE FAUTIVE — `supabase/migrations/0065_corriger_veut_dire_retenir.sql:331-338` :

```
  select coalesce(jsonb_agg(f.contenu order by f.maj_le, f.cle_dedoublonnage), '[]'::jsonb)
    into v_faits
    from (select f2.contenu, f2.maj_le, f2.cle_dedoublonnage
            from public.fait_extrait f2
           where f2.utilisatrice_id = p_utilisatrice
             and public.fait_est_vivant(f2.statut)
           order by f2.maj_le desc, f2.cle_dedoublonnage
           limit 200) f;
```

À comparer avec la branche sœur, 26 lignes plus haut dans la MÊME fonction : les entrées ont DEUX bornes d'octets (l. 305 `e.octets <= p_plafond_octets` sur la somme cumulée, et l. 320 `left(f.contenu, p_plafond_octets)` par entrée). Les faits n'ont qu'un compte de lignes. `p_plafond_octets` n'apparaît pas une seule fois dans la requête des faits.

OÙ J'AI CHERCHÉ LA GARDE, ET CE QUE J'AI TROUVÉ :

1. Contrainte de table — `0018_fait_extrait.sql:28` : `contenu text not null`, sans `check`. J'ai passé au grep tous les `check … length(…)` du schéma : `branche_nom_borne` (0023:80), `execution_job_motif_court` (0027:111), `incident_systeme_detail_court` (0027:215), `intention_declencheur_borne`/`intention_action_borne` (0036:218-219), `tirage_carte_forme` (0050:86), `notification_cle_courte` (0029:74), `endpoint` (0053:202). Aucune sur `fait_extrait`. (Le résumé de la trouvaille se trompe en disant que `branche.nom` est la seule du schéma — il y en a sept ; mais aucune ne touche `fait_extrait.contenu`, et c'est le seul point qui compte.)
2. Contraintes existantes sur `fait_extrait` : `fait_extrait_source_meme_proprietaire` (0047:90), `fait_extrait_tombstone_est_vide` (0056:54), `fait_extrait_machine_reste_vivante` (0065:111). Aucune ne parle de longueur.
3. Triggers : `fait_extrait_naissance` (0046:114) impose `statut='actif'` et `cree_le`, rien d'autre ; `fait_extrait_garde_resurrection` (0018:71) est BEFORE UPDATE et ne voit pas une insertion (0065:376 le dit lui-même).
4. Policy : `fait_extrait_insertion` réécrite en 0047:63-80 — `auth.uid() = utilisatrice_id and a_consenti_art9() and not est_barre_minorite() and (extrait_source_id is null or …)`. `extrait_source_id is null` est explicitement permis. Rien sur `contenu`.
5. Privilèges : le §7 de 0065 (l. 400-408) révoque `delete, truncate` puis `update` (re-granté colonne par colonne), mais **pas `insert`**. `authenticated` garde donc l'INSERT de table.
6. Côté TypeScript, la seule borne de longueur d'un fait est `CORRECTION_LONGUEUR_MAX = 280` dans `lib/domain/m […]
```
</details>

### R28 — `personne_joignable` n'exige ni `cgu_acceptees` (ajouté par 0072 à `a_consenti_art9` et à `eligible_au_periodique`) ni la majorité POSITIVEMENT établie (`date_naissance is not null`, ajouté par 0066 à `est_barre_minorite`). 0072 a ré-inliné `eligible_au_periodique` et rompu la délégation que 0053 avait justement posée pour qu'il n'existe qu'une définition — laissant le seul appelant restant, `socle_quotidien_du` (l. 254), sur l'ancienne règle.

- **Verdict** : PLAUSIBLE · **angle** : 
- **Où** : `supabase/migrations/0053_socle_quotidien_poussee.sql:43`
- **Scénario** : Le compte que 0072 décrit en toutes lettres : `POST /rest/v1/consentement {art9_accorde:true, ia_reconnue:true, cgu_acceptees:false}` passe la policy `consentement_insertion` (0042:100), qui ne regarde pas les CGU. Depuis 0072, `a_consenti_art9()` rend `false` : plus aucune écriture art. 9, la scène se referme — le correctif fonctionne pour la conversation, la synthèse hebdomadaire et le rappel d'échéance. Mais `preference_socle` et `abonnement_poussee` ne sont gardées QUE par la propriété (l. 157-161 et 220-224) : elle appelle `abonner_poussee`, choisit son heure, et `socle_quotidien_du` la sélectionne parce que `personne_joignable` ne lit que `barriere_minorite_le`, `mineur_detecte`, art9+ia_reconnue et la détresse. Le produit lui pousse donc une notification quotidienne sur son téléphone alors qu'elle n'a jamais accepté de contrat ni confirmé ses dix-huit ans (0004 fait porter les deux à cette même case). Même mécanique pour les comptes créés avant 0066 qui portent un consentement sans `date_naissance` : `personne_joignable` les tient pour joignables alors qu'`est_barre_minorite()` les barre partout ailleurs.

<details><summary>Ce que le sceptique a trouvé en cherchant à réfuter</summary>

```
TOUT CE QUE LA TROUVAILLE AFFIRME SUR LE CODE EST EXACT — je l'ai vérifié ligne à ligne, et je n'ai trouvé AUCUN chemin alternatif.

1. La fermeture existe, et elle est exactement où la trouvaille la place :
   • /Users/juliantalou/anima-app/app/mes-donnees/page.tsx:57 — `if (etape === "barre") redirect("/barriere");` — placé AVANT le rendu, donc avant la `<section>` d'effacement (lignes 90-124) et son formulaire `action={effacerTout}` (ligne 104).
   • Même redirection en tête de app/(auth)/consentement/page.tsx:28, consentement/revoquer/page.tsx:30, consentement/revoque/page.tsx:28, et dans les DEUX Server Actions de consentement/actions.ts:38 et :151. Plus reglages/page.tsx:72, ancrages:62, memoire:64, synthese:46, lectures:52, enneagramme:77, heure-naissance:42, abonnement:63, page.tsx:32, auth/confirm/route.ts:73. Quatorze sites, tous vers /barriere.
   • app/barriere/page.tsx : je l'ai lu en entier (92 lignes). Il ne contient QUE la liste RESSOURCES (3018/119/Fil Santé/3114), la phrase « Tes données seront supprimées sous 30 jours » (l.82) et `<a href="/api/export">` (l.85). Aucun formulaire, aucun `effacer`, aucun `PiedHalte` (donc même pas le lien /aide).
   • Aucune route d'effacement ailleurs : app/api ne contient que abonnement/{remboursement,resilier}, anam/*, desabonnement, export, health, incident, ordonnanceur, stripe/*. Et `grep -rn "mailto"` sur app/, lib/, render/ ne rend RIEN hors lib/poussee/vapid.ts — il n'existe pas même une adresse de contact pour demander l'effacement par un autre canal, alors que app/cgu/page.tsx:29 promet « tu peux les exporter et les effacer à tout moment ».
   • La fermeture n'est même pas technique : public.effacer_toutes_mes_donnees (0058_effacement_total.sql:85-133) ne teste NI `barriere_minorite_le` NI `mineur_detecte` — un compte barré est parfaitement effaçable côté base. Seule la redirection l'empêche.
   • Ironie relevée au passage : le commentaire de mes-donnees/page.tsx:33-38 pose lui-même le principe (« l'accès (art. 15) survit à la révocation, exactement comme l'effacement (art. 17) »), l'applique à `revoque`… et justifie la redirection de `barre` par le seul export (« /barriere porte déjà le même lien d'export »).

DEUX DOUTES QUE JE N'AI PAS PU LEVER, ET QUI M'EMPÊCHENT DE CONFIRMER :

A) Je ne peux PAS nommer d'entrées qui produisent ce tort dans le produit livré. L'état `barre` naît uniquement de `barriere_minorite_le` non-null, posé par `appliquer_barriere_minorite` (0006_barriere_minorite.sql:90-112, `grant execute … to service_role` seulement). Son UNIQUE appelant applicatif est lib/safety/a […]
```
</details>

### R29 — Au niveau 2, le bloc de numéros n'est émis qu'APRÈS le drain complet du flux et le bilan ; aucun appel modèle du tour n'est borné par un délai, si bien qu'un dépassement de `maxDuration` (60 s) fait disparaître le filet en entier, sans passer par le `catch`.

- **Verdict** : PLAUSIBLE · **angle** : 
- **Où** : `app/api/anam/message/route.ts:892`
- **Scénario** : Verdict niveau 2 → `blocRessourcesDetresse` rend `position: "apres"`, donc rien n'est émis avant la fin. Le tour dépense ensuite jusqu'à 8 s de détection (`DELAI_DETECTION_MS`), puis une passe FORTE d'extraction d'arc (`envoyerSousEgressArt9(requeteExtractionArc(...))`, ligne 359) qui n'est enveloppée d'AUCUN `avecDelai`, puis la génération elle-même, également sans budget. Fournisseur dégradé — la situation même que AD-15 vise : la somme dépasse `maxDuration = 60` (ligne 83), la plateforme tue l'invocation en plein `for await`. Le `catch` ligne 913 ne s'exécute pas (l'instance est supprimée, pas une exception JS), donc le repli qui réémet le bloc « apres » avant `{t:"erreur"}` ne joue pas non plus. Le client reçoit des `delta` puis une fermeture sans `fin` → `onEchec` : le texte partiel reste, et pas un seul numéro n'a atteint l'écran d'une personne classée « idéation passive ».

<details><summary>Ce que le sceptique a trouvé en cherchant à réfuter</summary>

```
MÉCANIQUE VÉRIFIÉE (la trouvaille dit vrai sur les faits) :

1. `app/api/anam/message/route.ts:892` — `if (trameRessources && trameRessources.position === "apres") emettre(trameRessources);` est bien la SEULE émission du bloc niveau 2 sur le chemin nominal, posée après le `for await` complet (l.791-822) et après `terminerControle` (l.829). `blocRessourcesDetresse` (lib/safety/bloc-ressources-detresse.ts) rend bien `position = verdict.niveau >= 3 ? "avant" : "apres"` → au niveau 2, rien avant la fin.
2. `route.ts:359` — `await envoyerSousEgressArt9({ …, requete: requeteExtractionArc(messages) })` : aucun `avecDelai`. Idem pour `diffuserSousEgressArt9` (l.703) et la boucle `for await (const ev of flux)` (l.791). `lib/ai/adapters/mistral.ts` ne pose ni `AbortSignal`, ni `timeoutMs`, ni `setTimeout` (grep sur tout `lib/ai/` : zéro occurrence). Seule la détection est bornée (`lib/safety/detecteur-detresse.ts:35` `DELAI_DETECTION_MS = 8000`, via `avecDelai` l.128).
3. `route.ts:83` — `export const maxDuration = 60`, sans `functions` override dans `vercel.json` (vérifié : le fichier ne contient qu'un `crons`). Et l'en-tête l.79-82 écrit lui-même la règle du jeu : « un dépassement TUE l'invocation … ni signal, ni métrage, ni log (le catch ne s'exécute pas) ». Le `catch` l.913 et son repli l.917-918 ne couvrent donc bien que les échecs OBSERVABLES en JS.

CE QUI M'EMPÊCHE DE CONFIRMER :

a) Une erreur factuelle dans la chaîne décrite. Le scénario invoque « puis le bilan » comme consommateur de budget : au niveau 2 il ne tourne PAS. `route.ts:200` : `const clotureAutorisee = niveauSecurite === 0 && !securite.limitesLevees;` → `doitProduireBilan = arc?.beat === "cloture" && clotureAutorisee` est faux dès niveau ≥ 1. La passe FORTE de bilan (l.859) est hors scénario.

b) Le déclencheur n'est pas une entrée, c'est une hypothèse d'environnement. Je peux nommer le verdict (niveau 2, décision `intervenir`), pas la condition « le fournisseur cale assez longtemps pour dépasser 60 s ». Rien dans le dépôt ne la produit ni ne la mesure.

c) Le dépôt porte une contre-conception EXPLICITE, écrite, pas déduite. `render/conversation/flux-ndjson-client.ts:137-139` : « la sécurité NE dépend jamais de ce bloc — le filet hors-IA (`/aide`, porte de secours) reste la garantie inconditionnelle (AD-15) ». Et cette porte existe vraiment à l'écran de conversation : `lib/scene/surimpression.ts` déclare `readonly porteSecours: true` (type littéral, une surimpression sans porte ne compile pas) et `render/surimpression.tsx` la rend « toujours présente, indépendante de toute détection », en tê […]
```
</details>


## Basses

### R30 — La garde « on n'efface jamais une abonnée » repose sur `etat = 'actif'`, un prédicat que le produit déclare lui-même incapable de dire si Stripe facture encore.

- **Verdict** : CONFIRME · **angle** : 
- **Où** : `supabase/migrations/0059_retention_automatique.sql:245`
- **Scénario** : `comptes_a_prevenir` (l.160) et la clause de grâce de `trancher_echeance_suppression` (l.245) protègent le compte si `abonnement.etat = 'actif'`. Mais `etatDepuisStatutStripe` projette `past_due`, `unpaid`, `incomplete` et `paused` en `expire` — précisément les souscriptions « que Stripe RELANCE et finira par encaisser », comme l'écrit `lib/domain/abonnement.ts:34-49`, qui a créé `contratStripeVivant` exprès pour ce cas et ne l'utilise que dans la route Checkout. Un compte dont la carte a été refusée passe donc `expire`, n'est plus protégé, et peut être effacé par le moteur de rétention ; comme `effacer_utilisatrice` ne parle pas non plus à Stripe (`lib/ordonnanceur/jobs/retention.ts` n'importe rien de `lib/stripe`), le contrat survit à la suppression du compte et continue d'être relancé puis encaissé. Le prédicat correct existe déjà dans le dépôt et n'a pas été employé ici.

<details><summary>Ce que le sceptique a trouvé en cherchant à réfuter</summary>

```
CONFIRMÉ. La réserve de la rétention ne couvre aucune des opérations qu'elle prétend garder, et rien ne rattrape ça ailleurs.

LA LIGNE FAUTIVE
`lib/ordonnanceur/jobs/retention.ts:46` : `export const RESERVE_RETENTION_MS = 2_400;`
gardant `lib/ordonnanceur/jobs/retention.ts:104` (`if (reste() < RESERVE_RETENTION_MS)`) devant
`lib/ordonnanceur/jobs/retention.ts:112` : `if (!(await annoncer(utilisatriceId)))` — appel NU, aucun `avecDelai`.

LA CHAÎNE D'APPEL, LUE JUSQU'AU BOUT
- `retention.ts:63` : `const annoncer = deps?.annoncer ?? annoncerInactivite;`
- `lib/courriel/avis-inactivite.ts:35` : `await creerDepotCanalCourriel().adresse(...)` → `lib/data/depot-canal-courriel.ts:63-67` : `supabase.auth.admin.getUserById(...)`, **aucune borne de temps**.
- `avis-inactivite.ts:38` : `await port.envoyerInformationLegale(...)` → `lib/courriel/adaptateurs/resend.ts:71-88`, borné à `DELAI_MS = 10_000` (`resend.ts:20`).
Donc une itération de phase 2 peut légitimement consommer 10 s + un getUserById non borné + `poserEcheance` (`depot-retention.ts:29`, `DELAI_DEPOT_MS = 3_000`), soit ≥ 13 s — pour un budget de job de 12 000 ms (`retention.ts:49`) et une réserve de 2 400 ms.

ENTRÉES CONCRÈTES QUI PRODUISENT LE TORT
Production, `RESEND_API_KEY` + `ANIMA_COURRIEL_EXPEDITEUR` + origine renseignés (`fabrique.ts:49-62` rend donc le vrai port Resend). Une utilisatrice U : `derniere_activite(U) <= now() - 24 mois`, `echeance_suppression is null`, `mineur_detecte = false`, aucun abonnement `actif` — elle est sélectionnée par `comptes_a_prevenir` (`0059_retention_automatique.sql:145-160`).
Phase 1 a tranché trois échéances dues, chacune ~2,7 s sous la borne de 3 000 ms du dépôt → il reste ~4 000 ms sur les 12 000.
`4 000 > 2 400` : la boucle entre (ligne 104). `annoncer(U)` poste le courriel « inactivite_avant_suppression » ; Resend accepte le POST puis met 5 s à répondre (sous sa borne de 10 s, donc aucune exception).
`avecDelai` du répartiteur (`lib/ordonnanceur/executer.ts:87-99`, `job.delaiMs = 12_000`) rejette la promesse du job à t+12 s, avant le retour d'`annoncer`.

LE TORT
1. `poserEcheance` (`retention.ts:121`) n'est jamais appelé. `echeance_suppression` reste `null`.
2. `comptes_a_prevenir` ne filtre QUE sur `echeance_suppression is null` : U ressort demain, et reçoit un deuxième « ton compte va être supprimé ». Puis un troisième, chaque jour que l'envoi traîne.
3. Aucune autre trace n'existe pour l'en empêcher : `retention.ts:116-120` dit explicitement qu'aucune ligne n'est écrite dans `notification_envoyee`, l'échéance est la seule trace. Et le repli invoqué au c […]
```
</details>

### R31 — `lever_incident` dédoublonne par `(type, job, jour)` : le signal du disjoncteur (`echecs_repetes`) est silencieusement avalé dès qu'un autre `job_echoue` a déjà été levé le même jour pour ce job — c'est-à-dire précisément les jours où il compte.

- **Verdict** : CONFIRME · **angle** : 
- **Où** : `lib/ordonnanceur/jobs/synthese.ts:243`
- **Scénario** : Le lot du jour échoue entièrement (base du modèle en panne) : ligne 233, `leverIncident("job_echoue", "synthese-hebdomadaire", "lot_entierement_echoue")` insère la ligne du jour. Ligne 241, `personnesEnEchecRepete` rend 1 — quelqu'un vient d'être écartée pour trois échecs en sept jours — et ligne 243 le second `leverIncident` tombe sur `on conflict (type, job, jour) do nothing` (0052) : rien n'est écrit. Le commentaire d'à côté dit « ici on le DIT — sinon l'écartement serait silencieux, et “cette personne n'a plus de synthèse” est précisément ce qu'il faut savoir » ; c'est justement ce qui ne se dit pas. Même collision avec le `leverIncident("job_echoue", job.nom, code)` du répartiteur (`executer.ts:108`), qui écrit le premier.

<details><summary>Ce que le sceptique a trouvé en cherchant à réfuter</summary>

```
J'ai cherché la garde partout (route, policy, RPC, trigger, appelant, tests) : elle n'existe nulle part. Chaque maillon du scénario est vérifié dans le fichier.

**1. La route ne pose aucune garde d'état.**
`/Users/juliantalou/anima-app/app/api/anam/plan/route.ts:36-56` — le GET fait exactement trois choses : `auth.getUser()`, un `if (!user) → 401` (ligne 41), la validation de FORME de l'UUID (ligne 48), puis `chargerPlan({ brancheId })` (ligne 55) et `return NextResponse.json({ plan })` (ligne 56). Aucun import d'`etapeOnboardingPour` dans le fichier — vérifié par grep sur tout le dépôt : `app/api/anam/echange/route.ts:4` l'importe, `app/api/anam/plan/route.ts` non.

**2. La RPC ne filtre que la propriété.**
`supabase/migrations/0036_intention_arbitrage.sql:390-401`, `charger_plan(p_branche uuid)`, `security invoker`, corps entier :
```sql
select i.id, i.declencheur, i.action, i.echeance, i.rang
  from public.intention i
 where i.utilisatrice_id = (select auth.uid())
   and i.branche_id = p_branche
```
Pas d'`a_consenti_art9()`, pas d'`est_barre_minorite()`. `grant execute … to authenticated` (ligne 404).

**3. La policy de lecture non plus.**
`0036:242-244` — prédicat complet : `using (auth.uid() = utilisatrice_id)`. Le commentaire au-dessus (0036:238-241) l'assume : « LECTURE : propriétaire, SANS gate premium et SANS gate consentement ». `0054_motifs_anam_in_app.sql:22-23` le reconfirme de l'extérieur : « les policies de lecture existantes (`intention_lecture` 0036:242 …) ne portent QUE la propriété ». Aucune migration postérieure ne touche cette policy (grep `policy … on public.intention` → seulement 0036, lignes 242/252/268/288).

**4. Le contenu servi est bien de l'art. 9 — la base le dit elle-même.**
`0054:53-55` : « `echeance_intention` → `titre` = le « si », `detail` = le « alors ». **Art. 9, de sa main**, et c'est le POINT ». Et le doc de la route elle-même, `plan/route.ts:30` : « les plans sont de l'art. 9 ».

**5. Le cookie de session survit à la révocation ET à la barrière — c'est écrit, pas supposé.**
`app/(auth)/consentement/actions.ts:151` : `if (etape === "barre") redirect("/barriere"); // minorité détectée (1.9) : suspendu, **sans signOut**`. Et `revoquerConsentement` (lignes 160-167) pose `revoked_at` puis `redirect("/consentement/revoque")` — aucun `signOut` sur ce chemin (le seul `signOut` du fichier est ligne 153, réservé à `etape === "mineur"`, et ligne 112 pour l'effacement de compte).

**6. La voisine a tranché le cas inverse.**
`app/api/anam/echange/route.ts:27-32` : « SERVIR le verbatim art. 9 dans l'app à quelqu'un qui a retir […]
```
</details>

### R32 — Un compte sous barrière de minorité n'a aucun chemin d'effacement : toutes les haltes le renvoient vers /barriere, qui ne propose que l'export.

- **Verdict** : CONFIRME · **angle** : 
- **Où** : `app/mes-donnees/page.tsx:57`
- **Scénario** : Un compte détecté mineur (`barriere_minorite_le` posé) est suspendu. /mes-donnees redirige `barre` vers /barriere avant même d'afficher la section « Tout effacer » ; /consentement, /consentement/revoquer et /consentement/revoque font tous la même redirection en tête de fichier. app/barriere/page.tsx n'offre que « Exporter mes données » et la phrase « Tes données seront supprimées sous 30 jours ». La personne la plus vulnérable du produit ne peut donc pas demander l'effacement immédiat de ce qu'elle a écrit : elle doit attendre que le job de rétention tranche son échéance. L'art. 17 est le seul droit du triptyque export/rectification/effacement qui lui soit fermé, et il l'est par une redirection posée dans trois pages, pas par une décision écrite quelque part.

<details><summary>Ce que le sceptique a trouvé en cherchant à réfuter</summary>

```
J'ai tenté de réfuter et je n'y arrive pas : la garde n'existe nulle part.

LA LIGNE FAUTIVE — /Users/juliantalou/anima-app/supabase/migrations/0051_lecture.sql:189-209

    create policy lecture_depot on public.lecture
      for insert
      with check (auth.uid() = utilisatrice_id
                  and public.a_consenti_art9()
                  and not public.est_barre_minorite()
                  and not public.branche_bloquee_par_detresse()
                  and public.est_premium_courante()
                  and exists (select 1 from public.tirage t
                              where t.id = tirage_id and t.utilisatrice_id = auth.uid()));

Aucun des cinq prédicats ne parle de `reponse`, `restitution` ni `close_a`. L'état INITIAL de la ligne n'est pas épinglé.

CE QUE J'AI CHERCHÉ POUR RÉFUTER, ET QUI N'EXISTE PAS
1. Aucune migration postérieure ne retouche la table : `grep "public.lecture"` sur 0052→0072 ne rend que deux LECTURES (0057:118 export, 0059:58 rétention). `lecture_depot` n'a jamais été rejouée.
2. Aucune contrainte CHECK de table ne l'interdit. Les quatre du fichier (l. 76-87) sont toutes SATISFAITES par la ligne forgée : `lecture_restitution_apres_reponse` (restitution non nulle ET reponse non nulle → ok) ; `lecture_cloture_coherente` `check ((reponse is null) = (close_a is null))` → satisfaite parce que le trigger BEFORE INSERT `lecture_horodatage` (l. 120-122) pose lui-même `new.close_a := case when new.reponse is null then null else now() end` ; les deux `non_vide` passent avec du texte.
3. `lecture_colonnes_figees` (l. 169-171) est `before UPDATE` seulement — un INSERT ne le traverse jamais. Sa garde « ses mots ne se réécrivent pas » (l. 162) ne s'applique qu'à un OLD existant.
4. `lecture_cloture` (l. 220-223) `using (… and reponse is null)` : la ligne naît avec `reponse` non nul, elle ne sera JAMAIS candidate à cet UPDATE. La prose forgée est donc immuable (seul `lecture_retrait` reste).
5. Aucun REVOKE de colonne : le fichier ne contient que `revoke/grant` sur la fonction `causes_refus_lecture()` (l. 256-257).
6. Aucun test ne couvre le cas : dans /Users/juliantalou/anima-app/tests/lecture-sql.test.ts, les 12 `insert` sur `lecture` ne passent que `{ utilisatrice_id, tirage_id }` (l. 109, 179, 182, 191, 277, 308, 332, 363, 373, 392, 429) et un seul ajoute `ouverte_a` (l. 445, pour éprouver l'horodatage). Aucun n'envoie `reponse`/`restitution` à l'INSERT.

LE SCÉNARIO CONCRET (entrées précises)
Alice, majeure, `a_consenti_art9()` vrai, aucun `episode_detresse` ouvert, `abonnement.etat='actif'` — donc les cinq prédicats de `lecture_ […]
```
</details>

### R33 — `reserver_pause_rythme` est `security definer` accordée à `authenticated`, et reçoit de l'appelante à la fois le SEUIL de la fenêtre d'apaisement (`p_apaisement_jours`) et les deux mesures journalisées pour la revue produit (`p_seances`, `p_minutes`). L'en-tête de la migration nomme précisément ce risque pour justifier le deny-by-default de la table — puis le rouvre par les paramètres.

- **Verdict** : CONFIRME · **angle** : 
- **Où** : `supabase/migrations/0055_pause_rythme.sql:72`
- **Scénario** : L'en-tête dit : « on pourrait insérer une ligne pour se faire taire Anam pendant un mois, ou en supprimer une pour la faire parler à volonté », d'où l'absence de policy. Or, sous son propre JWT : `POST /rest/v1/rpc/reserver_pause_rythme {p_seances: 6, p_minutes: 30, p_apaisement_jours: 1}` rend `true` tous les jours — la fenêtre de 30 jours (`APAISEMENT_JOURS`, lib/domain/rythme-pause.ts:59) ne garde plus que la sincérité de l'appelante, et FR-036 (« au plus une fois par mois ») tombe. Symétriquement, `{p_apaisement_jours: 36500}` insère une ligne datée d'aujourd'hui et fait taire la proposition de pause pour un siècle. Et comme la ligne insérée EST la journalisation AC5, `{p_seances: 0, p_minutes: 20160}` écrit un couple de mesures inventé dans la table qui sert de contre-métrique produit — la seule chose que 0055 demande de garder vraie. Le paramétrage du seuil est légitime (AD-14), mais il doit venir d'un appelant `service_role` ou d'un `environnement`, pas du client qui en subit la règle.

<details><summary>Ce que le sceptique a trouvé en cherchant à réfuter</summary>

```
J'ai cherché à réfuter, et le noyau tient — mais DEUX des trois scénarios de la trouvaille sont mécaniquement FAUX et doivent être retirés.

CE QUI EST RÉFUTÉ
1. « `{p_apaisement_jours: 1}` rend true tous les jours → FR-036 tombe » : FAUX. Le booléen rendu à l'appelante ne fait rien dire à Anam. La phrase n'est rendue que par `lib/safety/ouverture-branche.ts:108` (`seuilFranchi(mesure) && await rythme.reserver(mesure)`), et `lib/data/depot-rythme.ts:106` passe TOUJOURS la constante `APAISEMENT_JOURS = 30`. Raccourcir la fenêtre depuis le client ne fait qu'insérer des lignes supplémentaires, ce qui rend le chemin légitime PLUS muet, jamais plus bavard. « Faire parler Anam à volonté » est hors d'atteinte, et la suppression de lignes l'est aussi (RLS deny-by-default, prouvée par tests/pause-rythme-sql.test.ts:109-116).
2. « `{p_apaisement_jours: 36500}` fait taire la pause pour un siècle » : FAUX. `propose_le` n'est pas un paramètre — c'est le `default now()` de la colonne (0055:36). La ligne est datée d'aujourd'hui quel que soit l'argument, et le chemin légitime la compare à SES 30 jours. Le silence dure 30 jours, pas cent ans.

CE QUI EST CONFIRMÉ — et c'est un vrai défaut
La RPC n'a AUCUNE garde de seuil. Lignes 93-95 : elle ne refuse que `null` et le négatif. Lignes 115-116 : `insert into public.pause_rythme (utilisatrice_id, seances, minutes) values (v_uid, p_seances, p_minutes);` — aucune lecture d'`entree_journal`, aucun contrôle que le rythme a réellement été franchi. Le seul contrôle de seuil du dépôt vit en TypeScript (`lib/data/depot-rythme.ts:101`, `if (!seuilFranchi(mesure)) return false;`), donc, par la doctrine cardinale, il ne garde rien : `execute` est accordé à `authenticated` (0055:122) et la RPC est joignable par POST /rest/v1/rpc sous le JWT de l'utilisatrice.

Entrées concrètes et tort produit :
- Utilisatrice U, JWT ordinaire, journal VIDE (aucune écriture depuis des semaines). `POST /rest/v1/rpc/reserver_pause_rythme {p_seances: 0, p_minutes: 20160, p_apaisement_jours: 30}` → contrainte `pause_rythme_mesure_plausible` satisfaite (0055:44), ligne insérée, `true`.
- Tort A (contre-métrique produit) : la table porte désormais un couple IMPOSSIBLE — 0 séance et 14 jours de conversation — alors que le commentaire de table (0055:55) affirme « une ligne = une proposition de pause effectivement faite » et que la story dit que la contre-métrique du PRD « se lit aujourd'hui par une requête service_role ». C'est très exactement la seule chose que 0055 demande de garder vraie.
- Tort B (protection désactivable) : la ligne datée de now() fait ren […]
```
</details>
