# Portes avant publication

**Ce document n'est pas une liste de tâches de développement.** Il rassemble les portes qu'**aucun
commit ne peut franchir** : elles demandent une signature, un achat, un domaine, un avis juridique ou
une décision d'exploitation. Elles étaient jusqu'ici dispersées dans `deferred-work.md`, au fil des
stories qui les ont rencontrées ; elles sont ici réunies pour qu'on puisse les relire d'un coup.

**Ce qui déclenche cette liste, ce n'est pas « la mise en production » — c'est LA PREMIÈRE VRAIE
PERSONNE.** Tant qu'Anima ne reçoit que les données de Julian, presque tout ce qui suit peut attendre.
Dès qu'une inconnue peut s'inscrire et se confier, chaque porte encore ouverte est un risque réel.

Ce n'est pas un détail de vocabulaire : **l'URL de production est publique et indexable aujourd'hui**
(`https://anima-app-swart.vercel.app`, plan Hobby — Vercel ne sait pas protéger un domaine de
production en dessous de Pro). « Phase de test » décrit notre intention, pas l'accessibilité réelle.

Dernière revue : **2026-08-13**.

---

## 1. Mistral — sous-traitant art. 28 · 🔴 BLOQUANTE

> **⚠️ LA PORTE A ÉTÉ OUVERTE EN PRODUCTION LE 13/08/2026, SUR DÉCLARATION DE JULIAN.**
> `AI_ADAPTER=mistral` et les trois attestations sont posées sur Vercel production. Julian a déclaré
> ce jour-là : *« on a le contrat, je le glisserai plus tard »*. **La pièce justificative n'a pas été
> produite au moment de la pose.** Ce paragraphe existe pour que la décision ait une date et un auteur :
> le jour où quelqu'un demandera « depuis quand Anima envoie-t-elle de la donnée art. 9 à Mistral, et
> sous quel contrat ? », la réponse est ici.
>
> **À faire :** ranger le DPA signé et la confirmation ZDR écrite, puis remplacer ce bloc par leur
> référence. Tant que ce n'est pas fait, les trois drapeaux affirment quelque chose que rien ne prouve.

**État constaté au 13/08/2026 : DPA non produit, compte sur clé gratuite, ZDR non confirmée par écrit.**

Le boot-guard de [mistral.ts:20-32](../../lib/ai/adapters/mistral.ts#L20-L32) refuse de démarrer
l'adaptateur sans `MISTRAL_ZDR_CONFIRMED=true`, `MISTRAL_DPA_SIGNED=true` et `MISTRAL_PLAN=scale`.
Ces trois drapeaux sont une **attestation humaine**, pas un réglage : aucune API ne dit « ZDR active ».

Pourquoi ça bloque : le plan gratuit (« Experiment ») est précisément celui où les échanges peuvent
nourrir l'entraînement. Ce qui transite ici, ce sont des confidences intimes — de la donnée art. 9.

### Deux points relevés dans les textes de Mistral le 13/08/2026 (à confirmer avec eux)

- **Le DPA standard déclare, en Exhibit 1 §2 : « Special categories of personal data (if applicable):
  None. »** Autrement dit, le contrat type de Mistral affirme qu'aucune donnée art. 9 n'est traitée —
  ce qui est faux pour Anima et *seulement* pour Anima. Signer le DPA standard tel quel ne couvrirait
  donc pas notre usage : il faut faire amender cet Exhibit, ou obtenir un accord entreprise. **C'est
  une négociation, pas une case à cocher — prévoir du délai.**
- **§4.3 des conditions commerciales : la ZDR ne s'applique PAS aux modèles « Labs » ni « Preview ».**
  Le code n'appelle que des identifiants datés stables (`mistral-small-2603`, `mistral-large-2512`,
  [politique-tier.ts:20-21](../../lib/ai/politique-tier.ts#L20-L21)) — à ne jamais remplacer par un
  modèle Labs/Preview sans revérifier cette clause.

### Où les drapeaux sont posés

| Emplacement | `AI_ADAPTER` | Les trois attestations | Depuis |
|---|---|---|---|
| `.env.local` (machine de Julian, jamais poussé) | `mistral` | `true` | 13/08/2026 |
| Vercel **production** | `mistral` | `true` | 13/08/2026, sur déclaration |
| Vercel **preview** | `factice` | absentes | — |

Les préversions restent volontairement sur l'adaptateur factice : elles n'ont pas besoin d'un vrai
modèle, et une clé de moins en circulation est une clé de moins à faire tourner.

---

## 2. Le domaine · 🔴 BLOQUANTE — elle en débloque quatre autres

Aucun domaine possédé à ce jour. Une seule décision, qui referme d'un coup :

- `ANIMA_SITE_URL` — sans elle, **aucun courriel ne part** ([origine.ts](../../lib/courriel/origine.ts))
  et **le Checkout Stripe refuse de vendre** en production (503,
  [checkout/route.ts:115-122](../../app/api/stripe/checkout/route.ts#L115-L122)).
- `site_url` Supabase — la cible des liens de connexion sans mot de passe.
- Le quota de courriels Supabase — non relevable **sans SMTP personnalisé**, donc sans Resend, donc
  sans domaine vérifié. Vérifié empiriquement le 12/08 : l'API de gestion refuse le champ.
- SPF / DKIM / DMARC — sans eux les messages partent en indésirables, quel qu'en soit le contenu.

⚠️ **`anima.app` est parqué et EN VENTE chez Afternic.** Le gabarit de courriel l'a porté en dur. Qui
l'achète peut servir une fausse page de connexion à des femmes qu'un courriel signé « Anam » vient
d'avertir qu'un texte intime les attend. Une garde de dépôt interdit désormais tout hôte écrit en dur
dans `app/`, `lib/`, `render/`.

**Déjà fermé :** `uri_allow_list` Supabase, réduite à `http://localhost:3000/**` (12/08).

---

## 3. Stripe · 🟠 non bloquante tant qu'on ne vend pas

Le mode test est **entièrement câblé et vérifié** en production (13/08) : clé secrète, endpoint webhook
`we_1U3vAf…` abonné aux six événements que le code sait lire, secret de signature vérifié par mutation
(bon secret → 200, un caractère changé → 400). Restent :

- **Compte Stripe activé** (`charges_enabled` est `false` aujourd'hui) + clés `sk_live` / `whsec_live`
  + endpoint webhook enregistré sur le domaine réel.
- **DPA Stripe** à acter et documenter, comme Mistral et Resend.
- **`STRIPE_STATEMENT_DESCRIPTOR`** = l'entité juridique qui encaisse. En mode `subscription`, le
  libellé **effectif** se règle au niveau *compte* Stripe (`statement_descriptor_prefix`).
- **Effacement propagé à Stripe** à la fermeture de compte (AD-14 / FR-067), à concilier avec la
  conservation comptable légale. `abonnement` et `evenements_traites` n'entrent pas encore dans le
  périmètre d'effacement → Story **6-7**.
- **Contenu provisoire** : `ligneRetourPaiement` (registre produit) à valider avant mise en ligne.

---

## 4. Resend — le canal courriel · 🟠

- **DPA Resend** (transfert US à couvrir). Resend voit une adresse, un motif, un jeton opaque —
  jamais un mot de la synthèse ; la signature du port l'en empêche.
- **La boîte de l'expéditeur.** Le courriel n'invite plus à répondre (ça ouvrait un canal art. 9
  *entrant* hors RLS et hors ZDR), mais rien n'empêche quelqu'un de répondre. À trancher : adresse
  sans réception, ou boîte réellement relevée avec une politique de conservation. Ne pas faire de
  `ANIMA_COURRIEL_EXPEDITEUR` une adresse consultée sans décision explicite.
- **SPF / DKIM / DMARC** — voir porte n°2.

---

## 5. Juridique et contenu · 🔴 BLOQUANTE

- **`/cgu` est un placeholder auto-déclaré.** La politique de confidentialité complète et l'écran de
  consentement doivent être rédigés et validés par un juriste. 4.9 a ajouté **un destinataire**
  (Resend, US) et **une finalité nouvelle** (l'adresse de compte, jusque-là réservée aux liens de
  connexion, sert désormais à une notification produit) — information art. 13 à mettre à jour.
- **Le protocole de détresse (§5, AD-15/17) doit être validé par un professionnel.** C'est la porte
  la plus lourde du produit : le code applique un protocole que personne de qualifié n'a encore relu.
- **Les 87 créneaux de corpus du quotidien (Story 5.4) restent à écrire** — le rendez-vous quotidien
  tourne sur un corpus incomplet.
- **Les 9 textes d'ennéagramme (Story 5.5) restent à écrire.** Fiche :
  `corpus-enneagramme-a-ecrire.md`. C'est la plus courte des trois fiches et la plus délicate — le
  texte est lu par quelqu'un qui vient de dire « oui, ça me parle », et il doit se lire comme une
  proposition, jamais comme un verdict. **165 créneaux déclarés au total, 0 écrit.**
- **La copie de consentement a changé (Story 5.5, D12)** : elle couvre désormais ce qu'Anam
  **déduit**, pas seulement ce que l'utilisatrice partage. Un type d'ennéagramme est produit par un
  score ou inféré par un modèle — l'amont le qualifie de catégorie art. 9. **À faire relire par le
  juriste avec le reste de l'écran**, la formulation ayant une portée juridique directe.

---

## 6. Exploitation · 🟡

- **Bascule d'environnement (Story 4.8).** `ANIMA_ENV` est **volontairement absente** de Vercel
  production : sans elle, le déploiement se déclare `local`, désaccord avec la base qui déclare
  `production`, et **l'ordonnanceur refuse d'exécuter le moindre job**. À poser à `production` le jour
  du lancement — et pas avant.
- **`AI_ADAPTER=mistral` est posée en production depuis le 13/08/2026** (voir porte n°1). La fabrique
  n'accepte que cette valeur en production : elle échoue en dur plutôt que de servir un adaptateur
  factice à quelqu'un qui croit parler à Anam.
- **Effacer les fausses données** de la base de lancement (`zlhlzoalmszohrxrnsmo`) — décidé le 12/08.
  **Volume constaté le 13/08 : 92 comptes**, tous des fixtures de la suite de tests
  (`cyc-eff-autre-…@exemple.fr`, `ann-b3-…@exemple.fr`), 43 le 12/08 et 49 le 13/08. Ils n'y sont pas
  par erreur de saisie : la commande de test documentée dans tous les dossiers de story sourçait
  `.env.local`, qui pointe sur la base de lancement depuis le 12/08 — la suite entière tournait donc
  contre la production, y créait ses comptes, puis mourait sur un `429` en se plaignant de
  *privilèges de table*. Le trou est refermé côté code (`tests/_environnement.ts` refuse désormais
  toute cible non locale), mais **les données déjà écrites, elles, sont toujours là** — et pas
  seulement dans `auth.users` : chaque fixture a pu écrire dans les tables art. 9 en cascade.
- **`npm audit` : 8 vulnérabilités (6 hautes, 2 basses)** au 13/08. À trier avant lancement.
  **Ne pas lancer `npm audit fix --force`** — ça casse le build.
- **`noindex` ou protection de l'URL publique** tant que le produit n'est pas prêt à être trouvé.
  Décision du 12/08 : laissée telle quelle, à revoir.
- **Licence des éphémérides** — choix déféré depuis l'architecture, à trancher avant lancement.

---

## 7. Ce qui n'est pas une porte mais une obligation légale non encore codée

L'**Epic 6 entier** (8 stories, aucune commencée) porte le droit à l'effacement et à la portabilité :
`6-5` consulter/corriger/supprimer ce qu'Anam retient, `6-6` export complet, `6-7` effacement total
exhaustif, `6-8` moteur de rétention automatique. **FR-067 et NFR-021 ne sont pas satisfaits tant que
ces stories n'existent pas.** Ce n'est pas une signature à obtenir : c'est du code à écrire, et il doit
l'être avant la première vraie utilisatrice.

Deux décisions à ne pas redécouvrir quand ce moteur sera écrit :

- **`synthese` n'a pas de purge périodique, et c'est délibéré** : ces récits sont ce que la personne
  vient relire, et les seuls textes du produit qu'elle n'a pas écrits elle-même. Ils vivent et meurent
  avec le compte (cascade FK).
- **`notification_envoyee` est purgée à 30 jours**, déjà, à chaque tick du job de synthèse — empilée,
  la table était un calendrier d'assiduité dont l'absence parle autant que la présence.
