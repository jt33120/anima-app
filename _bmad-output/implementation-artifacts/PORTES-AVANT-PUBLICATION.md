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

Dernière revue : **2026-08-14**.

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

## 2. L'hébergeur — Vercel, sous-traitant art. 28 · 🔴 BLOQUANTE

> **Ouverte le 14/08/2026**, en instruisant le budget de l'ordonnanceur pour l'Epic 6. Vercel était
> jusqu'ici le **seul sous-traitant de la pile sans porte dédiée** — Mistral (§1), Stripe (§4) et
> Resend (§5) en ont une. L'oubli n'était pas anodin : c'est celui qui exécute le code.

### Le fait qui décide — le DPA de Vercel INTERDIT les données de l'article 9

Lu à la source (`vercel.com/legal/dpa`, 14/08/2026), Schedule 1 §6.1 :

> *« Customers are **prohibited** from including sensitive data or special categories of data in
> Customer Data. »*

Et §1 : *« This Addendum shall become legally binding **upon Customer entering into the Agreement** or
upon execution of this Addendum. »*

**Auto-incorporé.** Il est déjà accepté, et il ne se négocie pas en libre-service. Anima traite des
données art. 9 — c'est la prémisse du produit, la raison d'être de l'écran de consentement non
contournable de la Story 1.5. **L'hébergeur actuel interdit par écrit ce que le produit fait.**

Ce n'est pas un détail de conditions d'utilisation. La chaîne art. 28 est rompue : on ne peut pas
démontrer que le sous-traitant est engagé pour ces données, puisqu'il refuse par écrit de l'être.

⚠️ **Ceci est une lecture de contrat faite par Claude, pas un avis juridique.** C'est le seul point qui
décide, et il doit être confirmé. Deux gestes, dans cet ordre :

1. **Poser la question par écrit à Vercel** : « acceptez-vous de traiter des données relevant de
   l'art. 9 du RGPD, et sous quel instrument ? » Garder la réponse.
2. **La faire relire par le juriste** déjà pressenti pour la copie de consentement (§6).

### Le second fait — le plan Hobby interdit l'usage commercial

`vercel.com/docs/limits/fair-use-guidelines`, §Commercial usage, mot pour mot :

> *« **Hobby teams are restricted to non-commercial personal use only.** All commercial usage of the
> platform requires either a Pro or Enterprise plan. »* — et parmi les exemples : *« Any method of
> requesting or processing payment from visitors of the site »*.

Anima encaisse 69 € par Stripe Checkout. **Le jour où la vente s'ouvre, Hobby est une violation**, quelle
que soit l'issue du point précédent. Pro = 20 $/mois.

### Le troisième fait, ajouté par la Story 6.2 — Hobby rend le socle quotidien INERTE

`vercel.com/docs/cron-jobs/usage-and-pricing` : Hobby autorise **un déclenchement par jour**, et *« cron
expressions that would run more frequently will fail during deployment »*. Pro descend à la minute.

Or FR-033 promet une manifestation quotidienne **à l'heure choisie par l'utilisatrice** (8 h par défaut).
Une cadence quotidienne ne peut honorer qu'une heure sur vingt-quatre : vingt-trois personnes sur
vingt-quatre ne seraient jamais servies à l'heure qu'elles ont demandée.

**Le mécanisme est livré et vérifié, et il refuse d'émettre** (`palierHonoreLHeure()`, décision D4 de la
6.2) plutôt que de pousser à une heure au hasard — AD-15 au littéral. L'écran de réglages le DIT à
l'utilisatrice, il ne l'accepte pas en silence.

**Deux gestes le jour du passage à Pro, et le second s'oublie facilement :**

1. changer `PALIER` en `"pro"` dans [ordonnanceur-budget.ts](../../lib/domain/ordonnanceur-budget.ts) ;
2. passer l'expression cron de `vercel.json` à **horaire** (`0 * * * *`).

Sans le second, le palier est payé et rien ne change. `tests/poussee-architecture.test.ts` garde la
couture dans les deux sens : une expression horaire déclarée sur `hobby` rougit en CI **avant** de faire
échouer le déploiement.

### Ce que ça règle au passage, et ce que ça ne règle pas

**Faux problème dissipé.** L'Epic 6 semblait bloqué par un plafond de 60 s sur l'ordonnanceur. Ce
plafond n'est pas celui de la plateforme (Hobby : **300 s**, par défaut ET au maximum, fluid compute
activé) : il est écrit dans notre propre code,
[route.ts:15](../../app/api/ordonnanceur/route.ts#L15). **Auto-infligé, donc levable — Story 6.1.**

**Vrai problème persistant.** La région d'exécution est `iad1` (Washington D.C.), aucune clé `regions`
dans `vercel.json`. Le verbatim art. 9 **s'exécute aux États-Unis aujourd'hui**. Recommandé dès la
Story 2.1, jamais câblé. `"regions": ["cdg1"]` est un geste d'une ligne — à faire quelle que soit la
suite. À noter : les **données au repos** sont, elles, en UE — projet Supabase `zlhlzoalmszohrxrnsmo`
en `eu-west-1` (Irlande), vérifié le 14/08.

**Asymétrie à corriger :** [cgu/page.tsx](../../app/cgu/page.tsx) nomme les États-Unis pour le
courrielleur et laisse le pays de l'hébergeur non dit.

### L'issue de secours, si Vercel dit non

**Tout sur Railway** — l'application Next entière, un seul hôte. Pas « le front sur Vercel et le back
sur Railway » : en App Router, cette couture n'existe pas (12 pages sur 16 ouvrent Supabase
directement, 22 fonctions serveur, cookie de session *host-only* par durcissement délibéré). Le split
exigerait une réécriture d'architecture **sans gagner une seconde de calcul**.

| | Vercel | Railway |
|---|---|---|
| Données art. 9 | **Interdites** (Schedule 1 §6.1) | Exhibit A : *« Sensitive Data: None »* |
| Le contrat | Auto-incorporé, en bloc | **Se signe** (DocuSign, contresigné) |
| Donc | Non amendable en libre-service | **Amendable ligne à ligne** |
| Région | `iad1` par défaut ; `cdg1` possible | US par défaut ; **`europe-west4` (Amsterdam)**, par service |

⚠️ **Le « None » de Railway est exactement le piège Mistral de §1.** Le signer tel quel déclarerait
qu'aucune donnée art. 9 n'est traitée — faux, et sans couverture. La différence n'est pas que Railway
dit oui : c'est que **Railway laisse une case où écrire la vérité, et Vercel dit non.**

Coût estimé de la bascule : 2 à 4 jours, dont environ la moitié en travail de sécurité réel et non en
configuration. Les points durs relevés à l'audit du 14/08 :

- **Le déclencheur périodique disparaît.** `vercel.json` est l'unique déclaration de cron du produit ;
  Railway ne le lit pas. Sans service cron dédié portant lui-même le `Bearer $CRON_SECRET` (Vercel
  l'injecte, Railway non), **plus un seul tick, et donc plus un seul incident** — panne totalement
  muette. La garde d'architecture qui prouve « un seul ordonnanceur » lit `vercel.json` **sans
  `existsSync`** : elle doit migrer avec le déclencheur, sinon la propriété cesse d'être prouvée.
- **Les egress Mistral ne sont bornés par rien** ([mistral.ts](../../lib/ai/adapters/mistral.ts) ne
  passe ni `timeoutMs` ni `AbortSignal` ; défaut SDK 300 s). Aujourd'hui c'est la plateforme qui coupe.
  Sur un conteneur, un blocage tiendrait cinq minutes, composeur figé. **C'est une garantie qu'on loue
  et qu'on ne possède pas** — à corriger avant toute bascule, et souhaitable même sans.
- `NEXT_PUBLIC_*` est **inliné à la construction**, pas lu à l'exécution : un build lancé là où
  `.env.local` existe scelle la base de développement dans l'artefact de production.
- Ce qu'on perd : le CDN (3,7 Mo de statique dans `public/`), l'optimisation d'images (2 fichiers
  seulement), les préversions par PR, le retour arrière instantané.

**Le socle, lui, est portable** : aucune dépendance `@vercel/*`, toutes les routes en runtime
`nodejs`, aucun edge. `next build && next start` suffit.

### Écart assumé à l'architecture

L'ARCHITECTURE-SPINE dit : *« PAS de Railway en v1 — à ne réintroduire que si un besoin concret le
force. »* Le besoin concret, s'il se confirme, n'est pas technique : **il est contractuel.** Si la
bascule a lieu, elle rouvre une décision d'architecture et doit être écrite comme telle.

---

## 3. Le domaine · 🔴 BLOQUANTE — elle en débloque quatre autres

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

## 4. Stripe · 🟠 non bloquante tant qu'on ne vend pas

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

## 5. Resend — le canal courriel · 🟠

- **DPA Resend** (transfert US à couvrir). Resend voit une adresse, un motif, un jeton opaque —
  jamais un mot de la synthèse ; la signature du port l'en empêche.
- **La boîte de l'expéditeur.** Le courriel n'invite plus à répondre (ça ouvrait un canal art. 9
  *entrant* hors RLS et hors ZDR), mais rien n'empêche quelqu'un de répondre. À trancher : adresse
  sans réception, ou boîte réellement relevée avec une politique de conservation. Ne pas faire de
  `ANIMA_COURRIEL_EXPEDITEUR` une adresse consultée sans décision explicite.
- **SPF / DKIM / DMARC** — voir porte n°2.

---

## 6. Juridique et contenu · 🔴 BLOQUANTE

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
  proposition, jamais comme un verdict.
- **📄 La fiche de synthèse pour Anima est `POUR-ANIMA-ce-qui-attend.md`** — les quatre piles dans
  l'ordre d'urgence, les règles de voix, et les six questions. **Mise à jour le 14/08/2026 avec le
  brief `ANIMA-A57H` (42 réponses sur 74) :** Q1 tranchée, puis **relue le 15/08/2026** : le jeu passe de **24 à 21 cartes** (Story 5.10 — six
  retirées, `fleur`, `oiseau` et `seuil` ajoutées ; la cible de 23 arbitrée le matin même reposait sur
  une lecture fautive d'une case à cocher du brief), Q3 répondue « je connais mais je ne m'en sers pas vraiment »
  (l'ennéagramme reste, mais ses 9 textes sont les moins certains des 186), Q4 validée, Q5 répondue.
  **Restent ouvertes :** Q2 (le rôle du catalogue de sens — sa réponse est « il faut que j'essaie »,
  donc lui demander **un** sens sur une vraie carte plutôt que 21 d'un coup), Q6 (les ancrages,
  absente du brief), et **trois questions de suite posées le 14/08/2026** — les trois images
  difficiles du jeu, des cartes de remplacement, et le visage d'Anam (voir plus bas).
- **Les 21 textes de SENS DES CARTES (Stories 5.7 puis 5.10) restent à écrire** — ils vivent hors de
  `lib/corpus/`, sous `server-only` (`lib/lecture/sens-cartes.ts`), parce qu'ils ne doivent JAMAIS
  franchir la frontière client. Derniers par ordre d'urgence : le rituel de lecture n'est de toute
  façon pas publiable avant la commande d'art ci-dessous.
- **Les 24 textes des ANCRAGES (Story 5.9) restent à écrire.** Fiche : `corpus-ancrages-a-ecrire.md`
  (4 ancrages × 1 titre + 5 temps). ⚠️ **Seule pile où il vaut mieux finir UN ancrage que d'en
  commencer quatre** : un exercice est servi seulement s'il est complet — un temps manquant laisserait
  un écran vide au milieu de la traversée. Conséquence en v1 : `/ancrages` ne montre AUCUN exercice, à
  une abonnée qui paie. Ce n'est pas une panne, c'est l'état réel du corpus, dit honnêtement — mais
  **la halte ne doit pas être annoncée dans le menu de compte avant qu'un ancrage soit complet.**
  Et une question précède l'écriture (Q6) : combien d'ancrages, et sous quels noms.
  **210 créneaux déclarés au total, 0 écrit** — le jeu est figé à 21 cartes depuis la Story 5.10.
- **⚠️ DEPUIS LA STORY 5.6, CETTE PORTE EST DEVENUE LA PLUS VISIBLE DU PRODUIT.** L'accueil affiche
  désormais le socle en cartes — et **deux cartes sur cinq n'ont rien à montrer** : le mantra du jour
  EST son texte (60 créneaux vides) et l'horoscope ne produit que des clés de corpus (27 vides). Les
  trois autres montrent des faits calculés sans interprétation. Le code dit l'absence honnêtement
  (« Anima n'a pas encore écrit cette carte »), sans « bientôt » et sans repli fabriqué — c'est la
  seule forme conforme à FR-054 + FR-086. **Mais c'est le PREMIER ÉCRAN.** L'accueil n'est pas
  publiable en l'état. Priorité d'écriture : les 87 créneaux du quotidien
  (`corpus-quotidien-a-ecrire.md`) avant tout le reste — ce sont eux qui remplissent la vitrine.
- **⚠️ AUCUN DES 21 VISUELS DU JEU N'EXISTE — LE SEUL QUI ÉTAIT DESSINÉ A QUITTÉ LE JEU.
  DEPUIS LA 5.8 ÇA SE VOIT À L'ÉCRAN
  (Stories 5.7/5.8, FR-022).** Tant que `CarteTiree` était livré isolé, monté nulle part, l'absence
  n'était vue par personne. **Le rituel de lecture la montre** : les 21 tirages rendent tous « Le
  visuel de cette carte n'est pas encore dessiné. » C'est honnête, et ce n'est pas publiable — cette
  porte est passée de « à préparer » à **bloquante**. `puits` — la carte mère, seul style validé — a été RETIRÉE du jeu par Anima ;
  son visuel vit désormais dans `images/reference-jeu/`, hors de `public/`, comme unique référence de
  style pour la commande (Story 5.10). Le tirage, lui, est mécaniquement
  irréprochable — arité nulle, CSPRNG, échantillonnage par rejet, journal rejouable — et il n'a
  **rien à montrer**. Chaque carte le dit à l'écran plutôt que d'afficher un dos de carte générique :
  un substitut « en attendant » serait littéralement un visuel non créé pour Anima, à la place d'un
  visuel d'Anima. **Il faut deux choses par carte, et elles vont ensemble** : le visuel
  (`public/jeu/<cle>.webp`) et sa **description littérale** (le texte alternatif — ce qui est
  *dessiné*, jamais ce que ça *veut dire* ; un balayage bloquant rejette « symbolise », « représente »,
  « évoque », l'adresse à la deuxième personne). Sans description, le visuel ne s'affiche pas : une
  image sans texte alternatif utilisable ferait recevoir « une image » à une utilisatrice au lecteur
  d'écran, à qui on demanderait ensuite ce qu'elle y voit. **À trancher avec Anima AVANT de
  commander : les noms de carte** — internes et renommables aujourd'hui, figés de fait dès qu'un
  visuel est dessiné. **TRANCHÉ, et le jeu est figé (Story 5.10, 15/08/2026)** : elle retire `puits`,
  `corde`, `fontaine`, `nid`, `metier-a-tisser`, `orage` ; entrent `fleur` (son emblème), `oiseau`
  (sa coche « un oiseau, un vol » — rien ne volait) et `seuil` (de NOTRE main, à lui faire
  arbitrer) → **21 cartes, 63 objets à produire**. Ironie coûteuse : **le seul visuel dessiné,
  `puits.webp`, est l'une des six retirées.** ⚠️ Un seul arbitrage reste à lui soumettre avant de
  commander : **garde-t-elle `seuil` ?** Si non, le jeu tombe à 20 et rien d'autre ne bouge.
- **La copie de consentement a changé (Story 5.5, D12)** : elle couvre désormais ce qu'Anam
  **déduit**, pas seulement ce que l'utilisatrice partage. Un type d'ennéagramme est produit par un
  score ou inféré par un modèle — l'amont le qualifie de catégorie art. 9. **À faire relire par le
  juriste avec le reste de l'écran**, la formulation ayant une portée juridique directe.
- **🆕 ANIMA RELIT TOUTE LA COPIE DE L'APPLICATION, PAS SEULEMENT SES TEXTES.** Question
  `appli-relire-autour` du brief `ANIMA-A57H` : *« Voulez-vous relire ce que l'application affiche
  autour de vos textes ? »* → **« Oui, je veux tout relire. »** Ce n'est pas une préférence, c'est
  une porte : l'application parle sous son nom sur des écrans qu'elle n'a jamais vus (consentement,
  paywall, barrière de minorité, filet de détresse, désabonnement, courriels). **Aucune ligne de
  copie visible ne devrait franchir la publication sans son passage.** À organiser dans le format
  qu'elle a elle-même demandé — une chose à la fois, comme le questionnaire.
- **🆕 LE VISAGE D'ANAM — à trancher AVANT toute commande d'art supplémentaire.** Du personnage,
  elle a écrit : *« C'est moi, en version dessinée »* et *« je préfère rester derrière, le personnage
  me représente très bien »*. Or `public/scene/presence/anam-presence.png` est ce même personnage,
  recoloré en nuit — et dans l'application c'est lui qui **parle**, alors que ce n'est pas elle qui
  parle mais un programme. **FR-086** interdit à Anam de *fabriquer une parole* d'Anima ; un visage
  n'est pas une parole, donc ce n'est pas une violation littérale — mais c'est exactement la
  confusion que FR-086 existe pour empêcher, et l'identification entre la personne réelle et le
  personnage est désormais **écrite de sa main**. Question posée le 14/08/2026. Si elle est mal à
  l'aise, Anam change de visage tant que c'est encore facile.
- **🟡 LA PALETTE DE L'APPLICATION NE LUI A JAMAIS ÉTÉ SOUMISE.** Sa marque est claire et chaude
  (crème `#FBF8F4`, terracotta `#A87560`, pêche, rose poudré) ; l'application est une nuit
  (`--fond: #0C0A1E`, accent `#8FC1EF`). Elle a choisi « les couleurs de mon site » — donc la famille
  chaude, contre la famille vert-eau qui lui était opposée — et coché « les images sombres, tristes
  ou angoissantes » parmi ce qu'elle ne veut **jamais** voir. **Trois nuances avant d'en faire un
  défaut** : cette question portait sur son compte Instagram, pas sur l'application ; un ciel de nuit
  n'est pas une image triste ; et `public/marque/anima-nuit.webp` montre que la traduction en nuit
  était **délibérée**, pas un oubli. **À porter à sa relecture — pas à corriger dans son dos.**

---

## 7. Exploitation · 🟡

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

## 8. Ce qui n'est pas une porte mais une obligation légale non encore codée

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
