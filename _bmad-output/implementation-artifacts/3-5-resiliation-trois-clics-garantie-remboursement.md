---
baseline_commit: ef097d2bc1ad67a8bec6687681a1afc3430dc08b
story_key: "3-5-resiliation-trois-clics-garantie-remboursement"
epic: 3
story: 5
title: "Résiliation en trois clics et garantie de remboursement"
epic_name: "Devenir premium"
covers: [FR-060, FR-089, FR-071, FR-029, FR-031, AD-9, AD-15, AD-12, AD-17, NFR-021]
depends_on:
  - "3-1-ossature-abonnement-stripe"
  - "3-2-paywall-cloture-premiere-seance"
  - "3-3-tronc-gratuit-branches-premium-socle-jamais-coupe"
  - "1-9-appliquer-barriere-minorite-detectee"
  - "4-9-synthese-periodique-modele-fort"
status: done
created: "2026-08-07"
sources:
  - _bmad-output/planning-artifacts/epics.md#story-3-5
  - _bmad-output/planning-artifacts/prds/prd-Anima-2026-07-21/prd.md#FR-060
  - _bmad-output/planning-artifacts/prds/prd-Anima-2026-07-21/prd.md#FR-089
  - _bmad-output/planning-artifacts/architecture/architecture-Anima-2026-07-22/ARCHITECTURE-SPINE.md
---

# Story 3.5 : Résiliation en trois clics et garantie de remboursement

Status: done

> **Revue de code : 2026-08-13.** Migrations 0043/0044 (reprise du remboursement, robustesse du webhook), déployées.
> Dossier complet : [`revue-dette-2026-08.md`](revue-dette-2026-08.md).

**Dernière story de l'Epic 3.** Elle ferme la boucle commerciale : 3.1 a posé l'ossature (Checkout,
webhooks idempotents, projection écrivain-unique), 3.2 la carte, 3.3 le périmètre premium, 3.4
l'allocation. 3.5 pose **la porte de sortie** — et c'est la seule story de l'epic où le produit doit
activement travailler *contre* son propre intérêt commercial.

## Story

En tant qu'**abonnée**, je veux pouvoir **résilier aussi simplement que je me suis abonnée** et **être
remboursée si le produit n'a rien produit**, afin de **partir sans friction et en confiance**.

## Contexte légal — ce n'est pas une préférence de design

- **Loi du 16 août 2022** (art. L215-1-1 C. consommation) : résiliation par voie électronique, aussi
  simple que la souscription. C'est une **obligation**, pas une courtoisie.
- **Art. L215-1** : information de l'abonnée **avant** reconduction tacite.
- **FR-089** : la garantie porte sur un **artefact du produit** (une branche posée), **jamais** sur son
  état ni sur un résultat personnel. Elle est **annoncée à l'abonnement** — et elle l'est déjà :
  `render/conversation/offre-abonnement.ts:39` porte la phrase. **3.5 doit la rendre vraie.**

---

## Acceptance Criteria

**AC1 — Trois clics, par la même voie.**
Étant donné une abonnée, quand elle veut résilier, alors elle le fait **par le web** (la voie de la
souscription) en **trois clics maximum** : point d'entrée → « L'abonnement » → « Résilier », **la
confirmation étant sur la même vue, un seul bouton**.

**AC2 — Aucun dark pattern. [DUR]**
Le parcours ne comporte **aucun questionnaire de départ, aucune offre de rétention, aucun « es-tu
sûre ? » à étages, aucun compte à rebours**. Gardé par un test d'inventaire de surface, sur le modèle
de `tests/tronc-absence.test.ts` (Story 3.3).

**AC3 — Résilier n'est jamais suspendu. [DUR — inversion d'AD-9]**
Étant donné un épisode de détresse **ouvert** (`limites_levees`), quand elle demande à résilier ou à
être remboursée, alors **la demande aboutit**. `limitesCommercialesLevees` garde le **commerce entrant**
(Checkout, carte, paywall) ; l'appliquer ici enfermerait quelqu'un en crise dans un abonnement. Le
doute s'inverse : côté Checkout le doute **suspend**, ici le doute **laisse passer**.

**AC4 — Information avant reconduction, hors du canal d'opt-out. [DUR]**
Étant donné une reconduction tacite à venir, quand l'échéance approche, alors une information est
envoyée par **courriel à objet neutre** — et cet envoi **ne passe ni par `reserver_notification` ni
par le plafond par famille** : un refus de canal (art. 21) porte sur les **notifications produit**, pas
sur une **obligation légale d'information contractuelle**.

**AC5 — La garantie, sur simple demande.**
Étant donné une abonnée depuis **trois mois** n'ayant **posé aucune branche**, quand elle demande le
remboursement depuis « L'abonnement » — **sans questionnaire, sans justification** — alors elle est
remboursée.

**AC6 — Aucun compte à l'écran. [DUR — FR-031]**
L'éligibilité est un **booléen**. Ni « il te reste N jours », ni « tu as posé 0 branche », ni jauge, ni
barre de progression. La page dit si le geste est disponible, jamais un décompte.

**AC7 — Rejouable sans double effet.**
Étant donné une résiliation ou un remboursement déclenchés, quand l'opération est rejouée (double-clic,
retry réseau, rejeu de webhook Stripe), alors **elle ne rembourse ni ne résilie deux fois**.

**AC8 — Rien ne régresse. [DUR — FR-029]**
Étant donné une résiliation, quand l'entitlement s'éteint **à la fin de la période déjà payée**, alors
**l'arbre, les branches, le journal et les faits sont intacts**. Continuité directe de la décision
**D1-A** de la 3.3 : un compte expiré lit, renomme et déclare le rayonnement — il ne peut plus faire
*naître*.

**AC9 — Le remboursement de minorité est branché.**
Le stub `declencherRemboursement` (`lib/safety/appliquer-barriere.ts:38`, posé en 1.9 / FR-071) cesse
d'être vide : il rembourse réellement. Les **deux chemins** de remboursement (garantie FR-089, minorité
FR-071) partagent **une seule** exécution idempotente.

---

## ⚠️ Les dix pièges — lus dans le code, pas supposés

### P1. « désabonnement » ≠ « résiliation ». Le mot est déjà pris.

Tout ce qui s'appelle `desabonnement` dans ce dépôt est le **retrait du canal courriel** (Story 4.9,
revue T5-2) — art. 21, opt-out de notification. **Rien à voir avec la résiliation d'abonnement.**

| Existant — canal courriel (4.9) | À créer — résiliation (3.5) |
|---|---|
| [app/desabonnement/page.tsx](app/desabonnement/page.tsx) | `app/abonnement/page.tsx` |
| [app/api/desabonnement/route.ts](app/api/desabonnement/route.ts) | `app/api/abonnement/resilier/route.ts` |
| [lib/courriel/desabonnement.ts](lib/courriel/desabonnement.ts) | `lib/stripe/resiliation.ts` |
| [lib/domain/jeton-desabonnement.ts](lib/domain/jeton-desabonnement.ts) | `lib/domain/resiliation.ts` |
| RPC `regler_courriels_par_jeton` | RPC `demander_remboursement` |

**Vocabulaire imposé : `resiliation` / `resilier` / `remboursement`. Le mot `desabonnement` est
interdit dans tout fichier nouveau de cette story.** Un test de garde doit le vérifier — la confusion
entre les deux produirait un bouton « se désabonner » qui coupe les courriels en laissant filer 69 €.

### P2. L'information de reconduction ne doit PAS passer par `reserver_notification`.

C'est **la** décision structurante de la story. Lire
[0034_desabonnement_courriel.sql:170-178](supabase/migrations/0034_desabonnement_courriel.sql#L170-L178) :

```sql
-- LE REFUS (T5-2). Rien n'est écrit, rien n'est consommé, rien n'est journalisé
if exists (select 1 from public.preference_courriel p
            where p.utilisatrice_id = p_utilisatrice and p.refuse_le is not null)
then return false; end if;
```

Une personne qui a cliqué « ne plus recevoir » sur une synthèse **ne recevrait jamais son information
de reconduction** — et serait reconduite pour 69 € sans avoir été prévenue. À quoi s'ajoute le
**plafond par famille** de la 4.10, qui peut légitimement écarter un envoi.

Le refus porte sur le **canal des notifications produit**. Une information contractuelle légale n'est
pas une notification produit. **→ Chemin d'envoi séparé, avec sa propre idempotence.**

> **Recommandation :** ne PAS ajouter de motif à `MotifCourriel`
> ([lib/courriel/port.ts:50](lib/courriel/port.ts#L50)). Cet ensemble fermé est le miroir exact du CHECK
> `notification_envoyee.motif` et de `famille_motif` — trois choses qui doivent rester d'accord. Y
> glisser un motif légal ferait hériter l'obligation de tout l'appareil d'opt-out et de plafond.
> Prévoir un second chemin, avec sa propre table d'idempotence (`information_reconduction`), et
> **documenter dans `port.ts` pourquoi ce motif-là n'y est pas** — sans quoi quelqu'un l'ajoutera.

### P3. AD-9 s'applique à l'envers ici.

[lib/safety/limites-commerciales.ts:22](lib/safety/limites-commerciales.ts#L22) : repli sûr → `true`,
« le doute suspend le commerce ». La route Checkout
([app/api/stripe/checkout/route.ts:35](app/api/stripe/checkout/route.ts#L35)) refuse en 409.

**Ne jamais réutiliser cette garde en 3.5.** Empêcher de résilier pendant une crise, c'est le dark
pattern maximal, sur la personne la plus vulnérable. Un test doit prouver l'inversion : *épisode
ouvert → résiliation aboutit quand même*. C'est la troisième direction de doute du projet, après
`limitesCommercialesLevees` (→ `true`) et `premiumSousJwt` (→ `false`).

### P4. Il n'existe aucun menu.

[render/surimpression.tsx](render/surimpression.tsx) porte trois choses et rien d'autre : signe d'Anam,
mention IA, porte de secours. Son en-tête dit *« SANS BORD ni fond barré […] jamais une barre »*.

Et **`/aide` est interdit** comme point d'entrée : AD-9 et la Story 2.5 en ont fait une surface
**sans aucun commerce**. Y loger la résiliation ferait entrer le commercial dans le filet de sécurité.

> **DÉCISION D1 (Julian, 2026-08-07) — arbitrée, ne pas rouvrir.** Un point d'entrée **discret et
> permanent** dans la surimpression, en `t-meta` comme « Aide », visible **uniquement quand un
> abonnement existe** — un compte gratuit n'a rien à résilier et ne doit donc rien voir de nouveau. Il
> mène à `/abonnement`.
>
> Trois conséquences à respecter :
> 1. **C'est le MODÈLE qui décide, pas le rendu** (AD-7). `Surimpression` (`lib/scene`) gagne un champ
>    booléen ; `render/surimpression.tsx` le consomme sans le dériver. Même patron que `mentionIA`.
> 2. **Ce n'est pas une barre.** Le lien flotte dans le voile existant, comme « Aide ». Aucun fond,
>    aucun bord, aucune animation — l'en-tête de `surimpression.tsx` est une contrainte, pas un style.
> 3. **Ce n'est pas du commerce.** `<GardeCommerciale>` ne l'enveloppe PAS : sortir n'est jamais une
>    sollicitation, et le masquer pendant un épisode de détresse serait exactement AC3 à l'envers.
>
> Compte de clics : entrée (1) → « Résilier » (2) → confirmation (3). ✓ FR-060.
>
> *Alternatives écartées :* un repli sous le signe d'Anam (4 clics — dépasse FR-060) ; une entrée depuis
> `/cgu` (« dissimulée dans les conditions générales », ce que FR-089 nomme explicitement) ; attendre la
> région `accueil` (Epic 5.6 — bloquerait la fin de l'Epic 3 derrière un epic entier).

### P5. `charge.refunded` ne peut pas rejoindre `TYPES_ETAT`.

[lib/stripe/evenement-abonnement.ts:33](lib/stripe/evenement-abonnement.ts#L33) fait
`event.data.object as Stripe.Subscription`. Pour un `charge.refunded`, l'objet est un `Charge` : le cast
est faux, `sub.metadata?.utilisatriceId` serait `undefined`, `sub.items` aussi — silence total, aucune
erreur. **Chemin d'interprétation distinct**, avec son propre type de retour.

La 3.1 l'avait prévu et écrit : *« Les autres types […] sont NO-OP en 3.1 […] le remboursement = 3.5 »*.

### P6. La date de début d'abonnement n'existe nulle part.

`abonnement` ([0013_abonnement.sql:25-36](supabase/migrations/0013_abonnement.sql#L25-L36)) porte
`periode_fin`, `source_maj_le`, `cree_le` — **aucune date de début**. `cree_le` est la création de la
*ligne de projection*, pas de l'abonnement, et `periode_fin − 1 an` est une reconstruction fragile qui
casse au premier changement de plan ou de période d'essai.

> **Recommandation :** ajouter `debut_le timestamptz`, alimenté depuis `subscription.start_date` (stable
> à travers les reconductions, contrairement à `current_period_start`), via `interpreterEvenementAbonnement`
> et la RPC. L'éligibilité au remboursement doit être **auditable hors ligne** : ne pas la faire dépendre
> d'un appel Stripe au moment précis où quelqu'un réclame son argent.

### P7. L'éligibilité se décide en SQL, pas dans la route.

**Leçon R1** (`_bmad-output/implementation-artifacts/deferred-work.md`, et payée en 3.3) : une garde
qui ne vit que dans la RPC applicative est contournable, `authenticated` détenant les grants de table.
Ici le risque est symétrique et coûte de l'argent réel : une éligibilité calculée en TypeScript peut
rembourser quelqu'un qui a vingt branches.

> **Recommandation :** une fonction SQL `eligible_au_remboursement()` (`security definer`,
> `search_path=''`), qui rend un **booléen seul** — `debut_le <= now() - interval '3 months'` **et**
> `not exists (select 1 from branche where utilisatrice_id = auth.uid())`. La route la lit ; la RPC
> d'exécution la **re-vérifie** avant d'appeler Stripe. Booléen seul = AC6/FR-031 satisfait par
> construction : il n'y a pas de nombre à faire fuir.

### P8. Le registre de l'ordonnanceur est plein — et il n'a pas besoin de grossir.

[lib/ordonnanceur/registre.ts:20-37](lib/ordonnanceur/registre.ts#L20-L37) : `Σ delaiMs = 6 + 36 + 8 =
50 s`, marge 8 s, `maxDuration = 60 s`. **Un quatrième job ne rentre pas**, et l'en-tête interdit
explicitement de « régler » ça en montant la marge — *« l'élargir pour faire entrer un job reviendrait à
supprimer la garde en prétendant la respecter »*.

Le réflexe serait de rééquilibrer une troisième fois. **Ne pas le faire** : la reconduction n'a aucun
besoin d'un balayage quotidien. Stripe émet **`invoice.upcoming`** avant chaque renouvellement, sur sa
propre horloge de facturation — celle qui fait autorité. Notre job scannerait des dates pour redécouvrir,
moins bien, ce que Stripe sait déjà.

> **Recommandation :** brancher l'information de reconduction sur `invoice.upcoming` dans le webhook
> existant. Zéro job, zéro budget, zéro rééquilibrage — et le déclenchement suit la vraie échéance de
> facturation plutôt qu'une reconstruction locale. Le délai se règle au niveau du compte Stripe :
> **porte ops à documenter**, pas du code.

### P9. `debut_le` sera NULL sur les lignes existantes.

`alter table … add column` laisse les lignes déjà projetées à NULL, et
`null <= now() - interval '3 months'` rend **NULL**, donc l'éligibilité rendrait NULL → traité comme
non éligible en silence. Personne ne verrait rien ; simplement, la garantie ne marcherait pour personne
déjà abonné.

> **Recommandation :** backfill explicite dans la migration (`periode_fin - interval '1 year'` pour les
> lignes `actif`, en commentant que c'est une reconstruction et pourquoi elle est acceptable ici), **et**
> `coalesce(...)` défensif dans `eligible_au_remboursement()`. Un `null` doit produire un refus **motivé
> et testé**, jamais un refus accidentel. Même famille de piège que
> `make_interval(days => null)` dans [0034](supabase/migrations/0034_desabonnement_courriel.sql#L226-L228),
> qui purgeait silencieusement zéro ligne.

### P10. Rembourser sans résilier laisserait l'abonnement courir.

Un `refunds.create` seul rend l'argent **et** laisse la souscription active : elle serait re-facturée
l'année suivante. Le remboursement doit donc **toujours** entraîner la résiliation.

Montant : **intégral** (6900 centimes). FR-089 dit « remboursée », pas « remboursée au prorata » — et un
prorata sur une garantie « le produit n'a rien produit » serait une facturation pour un service qui, par
définition de l'éligibilité, n'a rien produit. Le chemin **minorité** (FR-071, AC9) est également
intégral : la 1.9 dit « remboursement **intégral** ».

---

## Tasks / Subtasks

- [x] **T1 — Migration `0038_resiliation_remboursement.sql`** (AC5, AC7, AC9, P6, P7)
  - [x] `debut_le` + `resiliation_demandee_le` (la 2ᵉ colonne n'était pas prévue — voir Déviation 4), avec backfill explicite
  - [x] `traiter_evenement_abonnement` en arité 10, réécrite depuis le texte de 0014, amendeurs nommés en en-tête
  - [x] `eligible_au_remboursement()` → booléen seul, deux entrées (paramétrée `service_role` / sans argument `authenticated`), une seule prédication
  - [x] Table `remboursement` — clé primaire sur `utilisatrice_id`, deux motifs (`garantie` / `minorite`) convergents
  - [x] Table `information_reconduction` — **hors** `notification_envoyee`, deux barrières d'idempotence
  - [x] `demander_remboursement()` / `confirmer_remboursement()` / `reserver_information_reconduction()`
  - [x] Grants vérifiés par test : `anon` refusé nommément (leçon 0007/0036)
- [x] **T2 — Domaine pur** (AC7, AC8, P5)
  - [x] ~~`lib/domain/resiliation.ts`~~ — **non créé** (Déviation 1)
  - [x] `lib/stripe/evenement-sortie.ts` — chemin distinct, jamais dans `TYPES_ETAT` (Déviation 2 : `refund.created`, pas `charge.refunded`)
  - [x] `interpreterEvenementAbonnement` porte `debut_le` et `resiliation_demandee_le`
- [x] **T3 — Exécution Stripe** (AC1, AC5, AC7, AC9)
  - [x] `lib/stripe/resiliation.ts` : `cancel_at_period_end`, `refunds.create` avec clé d'idempotence venue de la BASE, `annulerResiliation` (réversibilité, non prévue)
  - [x] `declencherRemboursement` (1.9) branché sur la même exécution — deux appelants, un chemin
- [x] **T4 — Routes** (AC1, AC3, AC5, AC7)
  - [x] `app/api/abonnement/resilier/route.ts` — POST seul, sens porté par l'URL, aucun corps lu (AC2 structurel)
  - [x] `app/api/abonnement/remboursement/route.ts` — aucun corps, éligibilité re-vérifiée en SQL
  - [x] Webhook : `refund.created`/`refund.updated` et `invoice.upcoming` routés AVANT l'abonnement
- [x] **T5 — Surface** (AC1, AC2, AC6, P4)
  - [x] `app/abonnement/page.tsx` — sans `"use client"`, deux formulaires HTML, confirmation par `?confirmer=1`
  - [x] `cheminAbonnement` dans le modèle `Surimpression` + `abonnementGerable` dans `ProjectionScene` (Déviation 3)
  - [x] Copie dédiée ; aucun compte, aucune jauge, aucune date chiffrée hors de l'état lui-même
- [x] **T6 — Information avant reconduction** (AC4, P2, P8)
  - [x] **Aucun nouveau job** — `invoice.upcoming` écouté dans le webhook existant
  - [x] `MotifLegal` séparé de `MotifCourriel` dans le port (Déviation 5), gabarit légal sans pied de désabonnement ni `List-Unsubscribe`
  - [x] `lib/courriel/reconduction.ts` — ne consulte ni `preference_courriel` ni le plafond
  - [ ] **PORTE OPS** — régler le délai « facture à venir » sur le compte Stripe. Hors code, à faire avant lancement.
- [x] **T7 — Tests** (tous AC)
  - [x] SQL : 4 cas croisés d'éligibilité + `debut_le` NULL + grants + oracle + idempotence
  - [x] Inversion AD-9 (`tests/sortie-abonnement.test.ts`) — épisode ouvert, sortie ouverte
  - [x] Non-régression FR-029 — après `resilie`, branches et journal intacts
  - [x] Inventaire d'absence AC2 — 10 interdits, 6 témoins de présence, balayage journalisé
  - [x] Garde lexicale P1 — `desabonnement` absent des 7 fichiers de la 3.5, présent dans le canal
  - [x] Rejeu : `refund.created` livré deux fois → un seul effet
  - [x] Campagne de mutation : 12 mutants, 11 tués, 1 documenté

---

## Dev Notes

### Ce que 3.1 a laissé exprès pour 3.5

- `charge.refunded` / `invoice.payment_*` NO-OP documentés
  ([evenement-abonnement.ts:15-16](lib/stripe/evenement-abonnement.ts#L15-L16)).
- `cancel_at_period_end` porté par l'**affichage**, pas par l'état
  ([abonnement.ts:16-19](lib/domain/abonnement.ts#L16-L19)) — donc `etat` reste `actif` jusqu'au
  `subscription.deleted`. **Ne pas « corriger » ça** : c'est ce qui fait que l'accès continue jusqu'à la
  fin payée (AC8).
- L'idempotence webhook (`evenements_traites`, dédup par `event.id`) et l'anti-régression d'ordre
  (`source_maj_le`) sont déjà là — 3.5 les réutilise, ne les redouble pas.

### Stack (vérifiée dans le dépôt, pas supposée)

`stripe@22.3.2`, apiVersion épinglée **`2026-06-24.dahlia`** ([lib/stripe/client.ts](lib/stripe/client.ts)).
`next@16.2.11`, `@supabase/ssr@0.12.3`. Node runtime obligatoire sur toute route Stripe.
⚠️ Piège dahlia déjà rencontré : `current_period_end` vit sur l'**item**, pas sur le `Subscription`.
Vérifier de même où vit `start_date` dans cette version avant de coder.

### Frontières à ne pas franchir

- **AD-2/AD-3** : `lib/stripe/` est le seul endroit qui importe le SDK — gardé par
  `tests/frontiere-stripe.test.ts`.
- **AD-7** : `render/` n'importe jamais `lib/` ; la copie d'UI vit dans `render/`.
- **AD-12** : écriture d'état par `service_role` via RPC uniquement ; l'utilisatrice ne déclare pas son
  propre état d'abonnement.
- **AD-1** : la dérivation d'état reste dans le domaine pur.

### Commande de test

```
npx vitest run
```
CLI Supabase **globale** (`/opt/homebrew/bin/supabase`), jamais `npx supabase`.
Vérification de mutation : restaurer depuis un snapshot `cp`, **jamais `git checkout`** (le dépôt porte
du travail non commité).

### Références

- [epics.md § Story 3.5](_bmad-output/planning-artifacts/epics.md)
- [prd.md FR-060, FR-089, FR-031, FR-029](_bmad-output/planning-artifacts/prds/prd-Anima-2026-07-21/prd.md)
- [0013_abonnement.sql](supabase/migrations/0013_abonnement.sql) · [0014](supabase/migrations/0014_abonnement_concurrence.sql) · [0034](supabase/migrations/0034_desabonnement_courriel.sql) · [0037](supabase/migrations/0037_branche_naissance_premium.sql)
- [deferred-work.md](_bmad-output/implementation-artifacts/deferred-work.md) — entrée « Le remboursement = Story 3.5 »
- Story 3.3, décision **D1-A** : l'arbre ne régresse pas à l'extinction de l'abonnement

---

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context) — `claude-opus-5[1m]`

### Debug Log References

**L'état ROUGE a été obtenu volontairement.** La 0038 change la SIGNATURE de `traiter_evenement_abonnement`
(arité 8 → 10). Après `db reset`, `tests/abonnement.test.ts` a rendu **PGRST202** sur 6 tests : preuve que
le `drop function if exists` de l'ancienne arité a bien mordu et qu'aucune surcharge résiduelle ne
subsiste. Sans ce `drop`, `create or replace` aurait créé une DEUXIÈME fonction et un appelant oublié
aurait continué d'écrire sans `debut_le` — c'est-à-dire une garantie FR-089 qui ne se déclenche jamais,
en silence.

**Deux pièges Stripe « dahlia » confirmés dans `stripe@22.3.2`, pas supposés :**
- `Subscription.start_date` et `cancel_at` sont restés **au niveau racine** (contrairement à
  `current_period_end`, migré vers l'item en basil et documenté par la 3.1) ;
- `Invoice.payment_intent` **n'existe plus** sur l'objet facture — remplacé par
  `invoice.payments[].payment.payment_intent`, avec un `status` à filtrer (`paid`).

### Completion Notes List

#### Cinq déviations au plan, toutes assumées

1. **`lib/domain/resiliation.ts` n'a pas été créé.** Le plan prévoyait un module pour dériver l'état
   affichable. À l'écriture, la dérivation tient en trois ternaires dans la page et ne porte aucune
   règle métier — un module aurait été de la cérémonie, pas de l'architecture.

2. **`charge.refunded` → `refund.created`.** Le plan (et le commentaire laissé par la 3.1) désignaient
   `charge.refunded`. Il porte une `Charge` : un objet que nous n'écrivons jamais, dont retrouver la
   propriétaire demanderait charge → facture → abonnement, soit deux appels API de plus au moment précis
   où l'on confirme qu'on a rendu de l'argent. `refund.created` porte **notre** `metadata.utilisatriceId`,
   posé à la création du remboursement — patron exact de `subscription_data.metadata` (3.1). Conséquence :
   `confirmer_remboursement` prend le type en **paramètre** au lieu de le coder en dur.

3. **`abonnementGerable` ajouté à `ProjectionScene`.** Non prévu. Le réflexe R1-bis disait de réutiliser
   `planOuvert` (les deux valent vrai pour une abonnée active). **Ils divergent, et le cas de divergence
   est celui qui coûte de l'argent** : un paiement en échec (`past_due`) projette `etat = 'expire'` →
   `planOuvert` absent, alors que la souscription Stripe est vivante. La sortie aurait disparu pour
   quelqu'un coincé entre un accès fermé et un contrat ouvert. Prédicat retenu : « un
   `stripe_subscription_id` existe », pas « le premium est ouvert ».

4. **`resiliation_demandee_le` ajouté (2ᵉ colonne).** Non prévu. Sans elle, quelqu'un qui vient de
   résilier voit « actif » et résilie une seconde fois. Projetée depuis `cancel_at`, en **écrasement
   franc** (et pas en `coalesce` comme `debut_le`) : une résiliation ANNULÉE doit effacer la date, sinon
   l'écran dirait éternellement « résilié » à quelqu'un revenu.

5. **`MotifLegal` séparé de `MotifCourriel`.** Non prévu sous cette forme. Ajouter un motif à l'union
   existante lui aurait fait hériter de `reserver_notification` — donc de l'opt-out (0034) et du plafond
   par famille (0036). La séparation est portée par le TYPE : `envoyer` n'accepte pas un `MotifLegal`, et
   `envoyerInformationLegale` n'accepte pas un `MotifCourriel`. Aucun des deux chemins ne peut emprunter
   les gardes de l'autre ni s'en dispenser.

#### Trois choses que le code existant a attrapées

- **`tests/garde-commerciale.test.ts` a fait rougir mes propres fichiers** (`app/abonnement/page.tsx`,
  `app/api/abonnement/remboursement/route.ts` : ils contiennent « abonnement » et n'appliquent aucune
  garde AD-9). Le réflexe — ajouter l'appel pour faire verdir — aurait **empêché de résilier quelqu'un
  en crise**. Dérogation ancrée aux chemins EXACTS, angles morts fermés (`app/abonnement/souscrire/`
  reste gardé), et non-vacuité exigeant l'existence de `tests/sortie-abonnement.test.ts`.
- **`abonnementGerable` faisait tomber tout l'arbre.** La lecture vivait dans le `try` de
  `chargerProjectionArbre` : une panne affichait « je n'arrive pas à afficher ton arbre » pour un
  raccourci de navigation. `try/catch` interne ajouté.
- **Mon propre test d'inversion a attrapé mon propre commentaire.** L'en-tête des routes EXPLIQUE
  pourquoi `limitesCommercialesLevees` n'y est pas, donc le nom y figure en prose. La garde interdisait
  d'écrire pourquoi la garde était absente. Elle lit désormais le code seul (`sansCommentaires`), avec
  un contrôle du contrôle sur le texte brut.

#### Campagne de mutation — 12 mutants, 11 tués, 1 documenté

| # | Mutation | Verdict |
|---|---|---|
| M1 | retirer `and a.debut_le is not null` de l'éligibilité | **survivant** → tué par assertion de TEXTE |
| M5 | inverser vérifier/réserver dans `demander_remboursement` | **survivant assumé** (voir ci-dessous) |
| M7 | imposer l'éligibilité au motif `minorite` | tué |
| M8 | faire lire `preference_courriel.refuse_le` à la reconduction | tué |
| M10 | `coalesce` sur `resiliation_demandee_le` | tué |
| M11 | écrasement franc sur `debut_le` | tué |
| M14 | appliquer `limitesCommercialesLevees` à la route de résiliation | tué |
| M15 | accepter un remboursement `pending`/`failed` | tué (2 tests) |
| M17 | rembourser SANS résilier | tué |
| M18 | `abonnementGerable` devient un miroir de `planOuvert` | tué (3 tests) |
| M20 | faire passer la reconduction par `reserverNotification` | tué |
| M22 | ajouter une offre de rétention dans la copie | tué |

**Les deux survivants ont révélé des commentaires FAUX que j'avais écrits, et les deux ont été corrigés
dans le code plutôt que contournés dans le test :**

- **M1** — j'affirmais que la clause `debut_le is not null` empêchait un refus accidentel. Elle est en
  fait **redondante** avec la sémantique NULL de `exists` (`null <= …` → NULL → la ligne sort → `false`).
  Le test prétendait la prouver ; il ne prouvait rien. La clause est conservée comme garde de réécriture
  (elle redevient load-bearing dès qu'on n'utilise plus `exists`) et **assertée sur le texte**.
- **M5** — j'affirmais que « réserver puis vérifier laisserait une ligne derrière ». Faux : la fonction
  refuse par `raise exception`, ce qui **abandonne la transaction** — l'insert est annulé quel que soit
  l'ordre. Le raisonnement de 0034 ne se transposait pas (là-bas on rend `false`). Le test a été
  remplacé par celui de la vraie propriété : *un refus n'a pas brûlé la clé — la même personne, devenue
  éligible, est remboursée*.

#### Ce qui reste ouvert

- **PORTE OPS** : le délai d'émission d'`invoice.upcoming` se règle sur le compte Stripe, pas dans le
  code. À faire avant lancement, avec les quatre autres portes humaines déjà listées.
- La migration `0038` **n'est pas encore déployée** sur `zlhlzoalmszohrxrnsmo`.

### File List

**Nouveaux (11)**
- `supabase/migrations/0038_resiliation_remboursement.sql`
- `lib/stripe/resiliation.ts` · `lib/stripe/evenement-sortie.ts` · `lib/data/depot-resiliation.ts`
- `lib/courriel/reconduction.ts`
- `app/api/abonnement/resilier/route.ts` · `app/api/abonnement/remboursement/route.ts`
- `app/abonnement/page.tsx` · `app/abonnement/abonnement.module.css` · `render/abonnement/copie-abonnement.ts`
- Tests : `resiliation-remboursement-sql` · `sortie-abonnement` · `sortie-absence` · `evenement-sortie` · `resiliation-stripe`

**Modifiés (14)**
- `lib/domain/depot-abonnement.ts` · `lib/data/depot-abonnement.ts` · `lib/stripe/evenement-abonnement.ts`
- `lib/safety/projection-arbre.ts` · `lib/safety/appliquer-barriere.ts`
- `lib/scene/surimpression.ts` · `lib/scene/projection.ts` · `render/surimpression.tsx` · `render/scene-dom.tsx` · `render/monde.module.css`
- `lib/courriel/port.ts` · `lib/courriel/gabarits.ts` · `lib/courriel/fabrique.ts` · `lib/courriel/adaptateurs/resend.ts` · `lib/courriel/adaptateurs/factice.ts`
- `app/api/stripe/webhook/route.ts`
- Tests ajustés : `abonnement` · `garde-commerciale` · `surimpression` · `synthese-job` · `rappel-echeance-job`

### Validation

`supabase db reset` 0001→0038 · `tsc --noEmit` propre · `eslint .` propre · `next build` propre
(`/abonnement`, `/api/abonnement/resilier`, `/api/abonnement/remboursement` présentes).
**2157 tests / 162 fichiers verts.**

## Change Log


| Version | Date | Description |
|---|---|---|
| v1.1 | 2026-08-07 | dev-story : T1→T7. Migration 0038 (2 colonnes, 2 tables, 5 fonctions), exécution Stripe, 2 routes de sortie, page `/abonnement`, information de reconduction via `invoice.upcoming` (zéro nouveau job). **5 déviations au plan** documentées, dont `refund.created` au lieu de `charge.refunded` et `abonnementGerable` qui n'est PAS un miroir de `planOuvert`. Campagne de mutation : 12 mutants, 11 tués, 1 documenté — les 2 survivants ont révélé 2 commentaires faux, corrigés dans le code. 2157 tests / 162 fichiers verts. Status → review. |
| v1.0 | 2026-08-07 | create-story : contexte assemblé depuis le code réel (3.1, 3.3, 4.9, 4.10, 1.9) — pas depuis epics.md seul. **10 pièges** identifiés et documentés, chacun avec sa recommandation. P8 supprime le besoin d'un 4ᵉ job (`invoice.upcoming` au lieu d'un balayage quotidien). Reste **une** décision ouverte : le point d'entrée vers « L'abonnement » (P4). |
