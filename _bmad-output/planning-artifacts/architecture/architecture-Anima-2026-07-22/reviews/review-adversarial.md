---
title: "Revue adversariale — ARCHITECTURE-SPINE Anam"
type: adversarial-architecture-review
posture: adversaire
cible: ../ARCHITECTURE-SPINE.md
contexte: ../../../prds/prd-Anima-2026-07-21/prd.md
created: '2026-07-22'
---

# Revue adversariale — attaque de la spine Anam

## Méthode

Pour chaque trou : je construis **deux unités** (stories/modules un cran sous les AD).
Chacune **respecte à la lettre tous les AD existants** — je le montre. Pourtant elles se
bâtissent de façon **incompatible** (forme de données divergente, double propriétaire, ordre
de mutation non arbitré, frontière ambiguë). L'incompatibilité prouve que la spine laisse un
degré de liberté qu'un AD nouveau ou resserré doit fermer.

Les AD proposés sont numérotés **AD-12 … AD-22** (suite de AD-11).

**Verdict :** la spine tient sur les frontières *statiques* (couches, art.9, déterminisme,
port IA) mais laisse **non-arbitrée toute la dynamique multi-écrivains** — surtout le chemin
de détresse, qui n'a aucune entité propriétaire alors qu'il pilote la sécurité, le paywall et
la suppression de branches. Onze trous, dont trois critiques de sécurité.

---

## CRITIQUE — sécurité

### T-1 — Détresse vs reconceptualisation : aucun arbitre sur le même message

**Unité A — `detect-reconceptualisation`** (§3, AD-8). À chaque tour, appelle `AiPort` au
tier **fort** (AD-5) pour repérer « avant je pensais X, maintenant Y » (FR-024) et **propose**
une branche (FR-025). Respecte AD-1 (domaine pur pour l'arc), AD-3 (port), AD-5 (fort =
reconceptualisation), AD-8 (branche proposée, non décrétée).

**Unité B — `detect-detresse`** (§5, AD-9). Sur le même tour, appelle `AiPort` au tier **le
plus capable** (AD-5), pose `limites_levees` (AD-9), suspend le travail de schéma (FR-037).
Respecte AD-5, AD-9, AD-4.

**Incompatibilité.** Les deux détecteurs se déclenchent sur **le même message** (« je vois
plus l'intérêt de continuer comme avant — avant je croyais que… »). La spine ne définit **ni
l'ordre, ni l'arbitre**. Si A s'exécute en parallèle ou avant B, une **proposition de branche
est émise pendant un début de détresse** — violation frontale de FR-042. Pire : AD-8 interdit
la branche « pendant l'épisode **+ 72 h** », mais la **naissance** d'une branche est un geste
utilisateur *différé* (validation + nommage, AD-8). L'unité qui **écrit** la branche 40 h plus
tard est encore un troisième module, qui n'a aucune raison de connaître l'épisode en cours.
La règle des 72 h est énoncée mais **rattachée à aucun point d'écriture**.

**AD-12 (nouveau) — Pipeline par message, sécurité d'abord.** Tout tour utilisateur passe par
un **unique pipeline serveur ordonné** dans `lib/safety/` → `lib/domain/` : (1) classification
de détresse **toujours en premier** ; (2) si niveau ≥ 1, la sortie de reconceptualisation est
**supprimée** (pas seulement ignorée) pour l'épisode. La **garde des 72 h est appliquée au
point d'écriture de la branche** (`create-branche` interroge l'entité épisode, AD-14), pas à la
proposition. Aucun module ne peut appeler le détecteur de reconceptualisation hors de ce
pipeline.

### T-2 — Tier du modèle : décision distribuée, et la *réponse* de détresse n'est pas épinglée

**Unité A — `sceance-turn`**. Décide « tour courant → tier **léger** » et génère la réponse
d'Anam en streaming (NFR-014). Respecte AD-3 (tier = paramètre du port), AD-5 (léger = échange
courant), AD-2 (médié serveur).

**Unité B — `safety-classify`**. Passe le tier **le plus capable** à `AiPort` pour la
**détection**. Respecte AD-5 (« détection de détresse utilise TOUJOURS le plus capable »).

**Incompatibilité.** AD-5 épingle le tier de la **détection** de détresse, mais **reste muet
sur le tier de la RÉPONSE** une fois la détresse détectée. Au niveau 1 (« bascule non
annoncée », FR-038), la réponse d'Anam à une personne en détresse est générée par… `sceance-turn`,
c.-à-d. **le modèle léger**, puisque rien ne dit le contraire. Deux unités conformes produisent
donc : détection au plus fort, **soutien réel au plus faible**. De plus, le choix du tier est
**distribué chez chaque appelant** (AD-3 : « le tier est un paramètre du port ») — il n'existe
**aucune table de politique**. Un auteur de capacité future (ancrage, synthèse, lecture)
choisit son tier sans référentiel : divergence garantie.

**AD-13 (nouveau) — Politique de tier unique et centralisée.** Une **table de politique**
serveur unique (dans `lib/ai/` ou `lib/safety/`) mappe `(capacité, niveau_sécurité) → tier`.
Les appelants **ne codent jamais** le tier en dur ; ils déclarent leur capacité, la politique
résout. **Dès niveau ≥ 1, TOUTE génération de l'épisode — réponse comprise, pas seulement la
détection — utilise le tier le plus capable.** Le tier reste un paramètre du port (AD-3
intact), mais son *choix* a un propriétaire unique.

### T-3 — « Épisode de détresse » : entité fantôme, deux horloges, personne ne l'éteint

**Unité A — `set-limites-levees`**. Au niveau 1, pose le drapeau serveur `limites_levees`
« pour la durée de l'épisode » (AD-9). Respecte AD-9 à la lettre.

**Unité B — `clear-limites-levees`** (nécessairement un autre module : rien n'éteint un
drapeau au même endroit qu'on l'allume). Décide quand « l'épisode » est fini.

**Incompatibilité.** La liste des **entités cœur** de la spine (utilisatrice, consentement,
theme_natal, entree_journal, fait_extrait, branche, lecture, abonnement, usage_ia) **ne
contient AUCUNE entité épisode de détresse.** Or `limites_levees` doit **persister entre
requêtes** et la fenêtre de 72 h (FR-042) doit être **interrogeable à l'écriture d'une
branche**. Sans propriétaire :
- Si B éteint le drapeau en fin de conversation mais que la suppression de branche court sur
  **72 h** (FR-042), on a **deux définitions de « épisode »** avec des bornes différentes.
- Si B n'éteint jamais (borne non définie) → paywall levé **à vie** (trou de revenu).
- Si B éteint trop tôt → **le paywall s'interpose sur quelqu'un encore en détresse** (violation
  de sécurité, contredit AD-9 et le critère d'acceptation « aucun paywall, y compris compte
  gratuit à quota épuisé »).

**AD-14 (nouveau) — L'épisode de détresse est une entité de première classe.** Ajouter
`episode_detresse` (utilisatrice, `debut`, `niveau_max`, `fin` nullable, `fenetre_expire_at`).
`limites_levees` **dérive** de `episode_detresse.fin IS NULL` ; la fenêtre 72 h **dérive** de
`fenetre_expire_at`. Une **transition d'extinction unique et possédée** ferme l'épisode
(critère explicite : N tours consécutifs sans signal ET délai minimal). Les gardes de T-1 et
T-4 interrogent cette table. Épisodes exclus d'analyse/synthèse/arbre (FR-046) via une clause
sur cette entité.

---

## HAUTE — conformité art.9 & intégrité mémoire

### T-4 — Consentement révoqué : la sortie art.9 ne revérifie rien atomiquement

**Unité A — `revoke-consent`** (FR-012, révocable à tout moment). Écrit `consentement` = faux.
Respecte AD-4, AD-9 (consentement révocable).

**Unité B — `ai-egress`** (route handler → Mistral, AD-2/AD-4). Envoie le tour art.9
serveur→Mistral sous ZDR. Respecte AD-2 (clé unique serveur), AD-4 (chemin serveur→fournisseur
ZDR), AD-10.

**Incompatibilité.** AD-4 régit **où** les données circulent, jamais **quand revérifier le
consentement**. Une séance en streaming (NFR-014) est en vol ; l'utilisatrice révoque dans un
autre onglet (A). B a déjà chargé le contexte et **poste le contenu art.9 à Mistral après la
révocation**. Les deux unités sont conformes ; le résultat est une **transmission art.9 sans
base légale** — exactement ce que NFR-006/FR-012 interdisent. Rien dans la spine ne rend la
vérification du consentement **transactionnelle avec l'envoi**.

**AD-15 (nouveau) — Garde de sortie art.9 unique et synchrone.** Toute egress art.9 passe par
**une seule garde** (`lib/ai/egress-guard`) qui revérifie, **dans la même transaction que
l'envoi**, `consentement = vrai` ET ZDR actif ; sinon elle refuse et ne poste rien. La
révocation est un simple drapeau que la garde lit ; aucun contexte n'est mis en cache au-delà
de ce point de contrôle (cohérent NFR-020).

### T-5 — Faits extraits : deux écrivains, aucune réconciliation → résurrection de données supprimées

**Unité A — `extract-faits`** (post-tour et/ou synthèse FR-066). Relit le journal, **upsert**
des `fait_extrait`. Respecte AD-8 (couche « faits extraits »), AD-1, AD-5 (fort pour synthèse).

**Unité B — `edit-faits`** (FR-063/FR-064). L'utilisatrice **corrige ou supprime** un fait.
Respecte AD-8 (« corrigeable/supprimable »), conventions (mutation via route handler).

**Incompatibilité.** Deux écrivains sur la **même entité**, sans forme canonique ni règle de
réconciliation. L'utilisatrice supprime le fait « je suis en conflit avec ma mère » (B). Le
tour suivant — ou la synthèse périodique (FR-066) — **relit le même verbatim immuable** et
**ré-extrait le fait supprimé** (A). Résultat : **la donnée que l'utilisatrice a effacée
ressuscite.** C'est une violation d'agentivité et de rectification (FR-064 « une correction est
une donnée, pas une erreur à masquer »). La spine ne définit ni **propriété de la forme
canonique**, ni **provenance**, ni **pierre tombale** pour distinguer « jamais vu » de
« l'utilisatrice l'a retiré ». L'ER n'a qu'un lien `source` — pas de champ « touché par
l'utilisatrice ».

**AD-16 (nouveau) — Faits : forme canonique + provenance + tombstones.** `fait_extrait` porte
`origine` (`extrait|utilisatrice`), `statut` (`actif|corrige|supprime`) et une clé de
dédoublonnage stable. L'extraction est un **upsert idempotent** qui **ne réécrit ni ne
ressuscite jamais** un fait `corrige`/`supprime` par l'utilisatrice (tombstone respecté). La
correction utilisatrice **prime** sur toute ré-extraction. Propriétaire unique de la forme :
`lib/domain/` (le pipeline d'extraction et l'éditeur passent par la même fonction de merge).

### T-6 — Monotonie de l'arbre : garde côté rendu, pas à l'écriture ; deux écrivains de `branche.etat`

**Unité A — `advance-feuillaison`** (FR-028). Détecte le retour spontané et fait progresser
`naissance → feuillaison`. Respecte AD-8 (« l'arbre dérive des branches »), AD-1.

**Unité B — `confirm-fruit`** (FR-028, jamais inféré). L'utilisatrice confirme → `fruit`.
Respecte AD-8 (« geste explicite »).

**Incompatibilité, triple.**
1. **La monotonie est gardée au mauvais étage.** AD-8 dit « le **client** ne rend jamais un
   état inférieur… et **journalise tout retour serveur inférieur** ». Cette phrase **admet que
   le serveur peut renvoyer un état inférieur** — donc il n'existe **aucun garde-fou de
   persistance**. Deux écrivains serveur (A, B) plus un éventuel recalcul de détection peuvent
   **régresser `branche.etat`** en base ; le client ne fait que masquer la régression.
2. **Où vit la garde ?** AD-8 la place « côté client », mais AD-7 interdit « **aucune logique
   applicative dans le rendu** ». Un « ne rends pas plus bas que le max, journalise » **est** de
   la logique applicative. Une unité la met dans le composant DOM (viole AD-7) ; une autre dans
   `lib/scene/`. Le mot « client » est **ambigu entre `lib/scene` (modèle) et `render`
   (adaptateur)** — deux implémentations conformes, deux emplacements contradictoires.
3. **Forme divergente.** La convention fige un enum discret `naissance|feuillaison|fruit`, mais
   FR-028 exige une feuillaison « **progressive, jamais binaire** ». Une unité stocke un simple
   flip d'enum ; une autre stocke un degré de progression. Le rendu de l'arbre (AD-7) ne sait
   pas laquelle est canonique.

**AD-17 (nouveau) — Monotonie à l'écriture, projection au modèle, rendu muet.** La transition
`naissance→feuillaison→fruit` est **strictement monotone et gardée à la persistance** par une
**fonction de transition unique et possédée** dans `lib/domain/` **plus** une contrainte SQL
(CHECK/trigger). **Seul l'effacement (FR-067) régresse.** La garde n'est **pas** « côté
client » : `lib/scene/` **projette** l'état max persisté, `render/` reste muet (AD-7 respecté).
La feuillaison canonique = enum `etat` (monotone) **+** champ séparé `intensite` (progressif,
FR-028) ; jamais porté par la couleur seule (convention).

---

## MOYENNE — frontière serveur, revenu, cohérence

### T-7 — Métrage : unité non définie, point de comptage flottant, paywall vs allocation résiduelle

**Unité A — `meter-on-complete`**. Après la fin du stream, écrit les **tokens réels** dans
`usage_ia`. Respecte AD-2 (« métré par utilisatrice dans usage_ia »).

**Unité B — `meter-on-start` / gate**. Réserve **un tour** au début et lit `usage_ia` pour
décider du paywall. Respecte AD-2.

**Incompatibilité.** AD-2 exige le métrage mais **ne définit pas l'unité** (tokens ? tours ?
séances ?) ni **le point de comptage** dans le cycle du stream (NFR-014). Stream avorté (onglet
fermé) : A n'a rien compté, B a décompté un tour → **soldes divergents**. Sur **réessai** d'un
appel IA transitoirement échoué, A **double-compte**. Pire, deux notions de barrière coexistent
sans relation définie : le **paywall à la clôture de la 1ʳᵉ séance** (FR-014, sur le bilan) et
l'**allocation résiduelle** post-séance (FR-079, param produit). Une unité coupe la
conversation au bilan (FR-014) ; une autre la garde ouverte (FR-079). **Qui arbitre le même
instant ?**

**AD-18 (nouveau) — Comptage exactement-une-fois + propriétaire de quota unique.** Unité de
métrage canonique = **tokens serveur**, écrite **exactement une fois** par requête logique,
clé d'**idempotence** (voir AD-19), **réconciliée à la fin (ou à l'avortement) du stream**. Un
**propriétaire unique de l'état de quota** dérive le solde. Le **paywall FR-014 est une *offre*
au bilan, pas un *verrou*** : la conversation ne se coupe qu'à épuisement de l'allocation
résiduelle FR-079 (jamais pendant `limites_levees`, AD-9/AD-14).

### T-8 — Webhooks Stripe rejoués & remboursement : `abonnement` a deux écrivains non idempotents

**Unité A — `stripe-webhook`** (`checkout.session.completed`, `invoice.paid`). Écrit/étend
`abonnement`. Respecte les conventions (Stripe, mutation via route handler).

**Unité B — `resiliation` / `refund`** (FR-060, FR-089). Écrit `abonnement` (statut) et
déclenche un remboursement si aucune branche à 3 mois. Respecte FR-060/FR-089.

**Incompatibilité.** Stripe **redélivre** les événements ; la spine n'a **aucune règle
d'idempotence**. Un `invoice.paid` rejoué **prolonge deux fois** l'abonnement ; un
`charge.refunded` rejoué **double-rembourse** (FR-089). `abonnement` a **deux écrivains** (A, B)
sans propriétaire de la forme d'état → états incohérents (actif + remboursé).

**AD-19 (nouveau) — Frontière d'événements externes idempotente.** Tout handler d'événement
externe est **idempotent par `provider_event_id`**, journalisé dans une table
`evenements_traites` (dédoublonnage). `abonnement` est une **projection à écrivain unique** du
dernier événement traité ; la résiliation/remboursement passe par la même projection. (Même
principe d'idempotence que le réessai IA d'AD-18.)

### T-9 — `theme_natal` recalculé : aucun contrat d'invalidation avec le cache d'interprétations

**Unité A — `add-birth-time`** (FR-051). Ajoute l'heure → **recalcule** `theme_natal`
(ascendant, maisons, lune éventuelle). Respecte AD-6 (« recalculé seulement si l'heure est
ajoutée »).

**Unité B — `cache-interpretations`** (NFR-013, FR-054). Écrit les interprétations **une fois
puis les met en cache**, indexées sur le `theme_natal` initial. Respecte NFR-013, AD-6, AD-3.

**Incompatibilité.** AD-6 autorise le recalcul et NFR-013 fige le cache — mais **rien ne lie
les deux**. Après recalcul (A), toutes les interprétations en cache (B) dérivent de l'**ancien**
thème : **contenu périmé servi**. Le **tronc de l'arbre** (FR-051, projeté dans la scène AD-7)
passe d'incomplet à complet, mais aucune règle ne dit que la projection de scène est
invalidée.

**AD-20 (nouveau) — `theme_natal` versionné, dépendants invalidés.** `theme_natal` porte une
**version**. Toute interprétation en cache (NFR-013) et la **projection du tronc** (AD-7/AD-8)
sont **clés par la version**. Le recalcul FR-051 **incrémente la version** et invalide les
dépendants. Immutabilité d'AD-6 = **immutabilité par version**, pas mutation en place.

---

## BASSE — à resserrer

### T-10 — État de scène : aucune partition vue-éphémère / projection-domaine ; transition de région sans propriétaire

**Unité A — `region-nav`**. Traite « région courante » comme **état de vue éphémère** côté
client (lien nommé, clavier — AD-7). Respecte AD-7.

**Unité B — `tree-region`**. Traite l'état de scène (positions de branches, croissance du
tronc) comme **projection du domaine** côté serveur (AD-8). Respecte AD-7.

**Incompatibilité.** AD-7 dit « le modèle de scène ne dépend jamais du rendu » mais **ne
partitionne pas** l'état de scène entre (a) **vue/navigation éphémère** (client) et (b)
**projection d'entités domaine** (serveur, lecture seule). Deux unités écrivent « la scène »,
l'une localement, l'autre depuis le serveur, et **divergent sur la source de vérité** (ex.
position/croissance des branches). **Qui possède la transition de région ?** Non défini.

**AD-21 (nouveau) — Partition du modèle de scène.** `lib/scene/` sépare explicitement
**view-state** (client, éphémère : région courante, cadrage) et **domain-projection** (serveur,
lecture seule : tronc, branches, états AD-8). Le rendu n'écrit ni l'un ni l'autre (AD-7). La
**transition de région** a un propriétaire unique (view-state client).

### T-11 — Isolation du tirage : AD-11 n'interdit pas une graine RNG dérivée de l'utilisatrice

**Unité A — `draw-rng`**. Journalise « graine + horodatage » (AD-11) et, **pour reproductibilité
d'audit**, dérive la graine de `user_id`. Respecte AD-11 à la lettre (pas d'accès profil/
historique/état émotionnel ; RNG « uniforme » ; graine journalisée) et la convention RLS
(identité utilisatrice présente pour écrire `lecture`).

**Unité B — `draw-rng`** bis. Tire la graine d'une **entropie système** indépendante.

**Incompatibilité.** AD-11 interdit l'accès au **profil**, mais l'identité utilisatrice (RLS,
métrage AD-2) transite légitimement. Rien n'interdit de **semer le RNG depuis `user_id`** : le
tirage devient alors une **fonction déterministe de l'utilisatrice** tout en restant
« uniforme » — précisément l'esprit que FR-016 (« carte servant un message prédéterminé »)
proscrit. Deux unités conformes, l'une auditable-mais-déterministe-par-personne, l'autre
vraiment aléatoire.

**AD-22 (resserrement d'AD-11) — Graine indépendante de l'identité.** La graine RNG provient
d'une source **prouvablement indépendante** de l'identité/du profil/de l'historique
(CSPRNG système) ; elle est journalisée pour audit mais **jamais dérivée de données
utilisatrice**. Le point d'entrée du tirage reçoit l'identité **uniquement** pour l'écriture
RLS de `lecture`, jamais comme entrée de sélection.

---

## Synthèse par gravité

| # | Trou | Gravité | AD proposé |
|---|---|---|---|
| T-1 | Détresse vs reconceptualisation non arbitrées sur le même message ; garde 72 h non rattachée à l'écriture | Critique | AD-12 |
| T-2 | Tier distribué ; réponse de détresse non épinglée au plus fort | Critique | AD-13 |
| T-3 | « Épisode de détresse » sans entité ; `limites_levees` jamais éteint proprement, 2 horloges | Critique | AD-14 |
| T-4 | Egress art.9 ne revérifie pas le consentement atomiquement (course à la révocation) | Haute | AD-15 |
| T-5 | Faits extraits : 2 écrivains, ré-extraction ressuscite un fait supprimé | Haute | AD-16 |
| T-6 | Monotonie de l'arbre gardée au rendu, pas à l'écriture ; 2 écrivains de `etat` ; forme divergente | Haute | AD-17 |
| T-7 | Métrage : unité + point de comptage flottants ; paywall FR-014 vs résiduel FR-079 non arbitrés | Moyenne | AD-18 |
| T-8 | Webhooks Stripe / remboursement non idempotents ; `abonnement` à 2 écrivains | Moyenne | AD-19 |
| T-9 | Recalcul `theme_natal` sans invalidation du cache d'interprétations ni du tronc | Moyenne | AD-20 |
| T-10 | Scène : vue-éphémère vs projection-domaine non partitionnées ; transition de région sans propriétaire | Basse | AD-21 |
| T-11 | Graine RNG possiblement dérivée de l'utilisatrice (AD-11 muet) | Basse | AD-22 |

**Racine commune des trois critiques :** le chemin de détresse n'a **aucun état possédé**
(pipeline ordonné + entité épisode + politique de tier). C'est le premier chantier à fermer.
