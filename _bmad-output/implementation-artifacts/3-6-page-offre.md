---
baseline_commit: 56476cb
---

# Story 3.6 : La page d'offre — le chemin d'abonnement d'un compte gratuit

Status: review

## Story

En tant qu'utilisatrice d'un compte gratuit,
je veux pouvoir m'abonner quand je le décide,
afin de ne pas dépendre d'une proposition que le produit ne me fera jamais.

**Couvre :** QA T2 · FR-055/FR-056 · FR-061 (zéro dark pattern) · FR-089 · art. L215-1 · AD-9.

---

## Le défaut, en une phrase

Le seul bouton de souscription du produit vivait sur `CarteAbonnement`, dans la conversation, et
n'apparaissait qu'au moment d'un paywall. Or **aucune branche n'est jamais proposée à un compte
gratuit** (3.3, décision D2-A) : sans branche, pas de paywall, donc **aucun chemin**.

Et `/abonnement` — la seule page qui en parle — répondait à ces gens : « Ton abonnement n'est plus
actif », à propos d'un abonnement qui n'a jamais existé. Un état inventé, sur la page qui parle
d'argent, au bout du cul-de-sac où `/ancrages` envoyait.

---

## Les décisions

### D1 — Elle n'invente rien, et c'est la condition pour qu'elle existe

La note de suivi disait, à raison, que « le prix, le contenu de l'offre, la mention de reconduction
et la garantie se décident ensemble, et aucun des quatre n'est un choix de développeur ».

**Les quatre étaient déjà décidés.** Trois par la 3.2 : le prix (couplé au centime près au prix
FACTURÉ, par test), les périmètres gratuit/premium, la garantie FR-089. Le quatrième par la 3.5,
dont tout le mécanisme d'information avant reconduction existe et tourne.

Cette page **importe** leur copie plutôt que de la recopier. Deux exemplaires d'un prix divergent au
premier ajustement, et l'un des deux devient un mensonge commercial.

### D2 — Une seule phrase est neuve, et c'était un manque LÉGAL

Aucune surface de vente ne disait que l'abonnement se reconduit. On demandait 69 € **sans dire
nulle part que ce serait 69 € l'an prochain aussi** (art. L215-1). La 3.5 avait construit
l'information *pendant* le contrat (le courriel avant reconduction) et personne n'avait vu que
l'information *au moment de la vente* manquait.

`RECONDUCTION` est posée dans la source unique de la copie d'offre — donc elle paraît aussi sur la
carte du fil. Elle nomme trois choses vraies et rien d'autre : la durée, la reconduction, la sortie.
L'avis par courriel y est mentionné **parce qu'il existe** ; jamais une promesse sans code derrière.

### D3 — Elle remplit la couture de la 2.9 plutôt que d'en ouvrir une seconde

`MontagePaywall` attendait depuis deux epics, avec cette phrase dans son en-tête : « RESTE la couture
gardée pour une future surface paywall RENDUE SERVEUR — inerte tant que cette surface n'existe pas ».
**C'est elle.** Deux points de montage commerciaux, ce serait deux endroits où oublier la garde.

Un test de la 2.9 interdisait tout prix dans ce fichier. Il **a été retourné** : il gardait une
inertie que le fichier lui-même présentait comme provisoire. Ce qui le remplace garde ce qui compte —
que la surface soit enveloppée, et que le prix vienne de la source couplée au prix facturé.

### D4 — Sortir n'est pas vendre : deux régimes sur la même page

C'est la décision centrale, et elle est délicate.

`/abonnement` refuse toute garde AD-9 depuis la 3.5, pour une raison qu'on ne rouvre pas :
`limites_levees` est vrai pendant un épisode de détresse, donc garder la page **empêcherait de
résilier quelqu'un en crise** — le dark pattern maximal, sur la personne la plus vulnérable du
produit.

Mais l'OFFRE est du commerce entrant, et FR-043 dit qu'aucun commerce n'atteint quelqu'un en
détresse. Les deux gestes vivent donc sur la même page **et n'ont pas le même régime**.

`tests/offre-gardee.test.ts` mesure les deux moitiés. Sans lui, la dérogation « sortie » de
`garde-commerciale` deviendrait un trou : elle exempte `app/abonnement/page.tsx` de porter la balise,
et cette page monte désormais une surface commerciale.

### D5 — « Jamais abonnée » et « abonnement terminé » cessent de dire la même chose

Les deux tombaient dans la même branche et lisaient la même phrase.

---

## ⚠️ Ce que cette story rend urgent, et qui n'est pas dans le code

**Les clés Stripe de production sont en mode TEST** (`pk_test_51TVGUr…`, mesuré le 16/08).

Ce n'était pas grave tant que personne ne pouvait atteindre Checkout. **Cette story a ouvert ce
chemin à tout le monde.** Quelqu'un peut désormais parcourir une souscription complète en
production, ne rien payer, et — selon ce que le mode test renvoie — se retrouver avec un abonnement
projeté en base.

Le code est juste ; c'est le compte qui est en test. La porte §4 passe de 🟠 à **🔴 BLOQUANTE**, et
`tests/offre-gardee.test.ts` exige qu'elle reste inscrite comme telle — même patron que
`sous-traitants.test.ts`, où un verdict doit désigner une porte réellement inscrite.

---

## Dev Agent Record

### Une garde a mordu, et elle avait raison

`garde-commerciale` a refusé un premier `render/abonnement/Offre.tsx` : une UI commerciale doit
porter la balise, et `render/` ne peut pas l'importer (elle est `server-only` et lit `lib/safety`).
Le fichier a été **supprimé** et son contenu déplacé dans la couture prévue, plutôt que dérogé par
une entrée d'allowlist de plus.

### Un test s'est appris tout seul

`offre-gardee.test.ts` a rougi sur les routes de sortie : elles **expliquent en commentaire**
pourquoi elles ne portent pas la garde, en la nommant. Sans `sansCommentaires`, le test mesurait la
prose au lieu du code — exactement le piège rencontré en 6.7 sur le `on delete restrict` compté dans
un `comment on table`.

### Vérification

- **269 fichiers / 4586 tests** verts ; `tsc --noEmit`, `eslint .`, `next build` propres
- Aucune migration

### Dette laissée

- La phrase de reconduction doit être relue par **Anima** (registre) et par un **juriste** (L215-1),
  en même temps que les CGU. Inscrite en porte §7.
- Le prix reste 69 €/an : aucune décision commerciale n'a été prise ici, et aucune ne devait l'être.

---

## Change Log

| Date | Ce qui change |
|---|---|
| 2026-08-16 | Story livrée. Ferme la QA T2. Fait passer la porte Stripe en BLOQUANTE. |
