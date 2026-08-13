# Revue adversariale — la dette de revue des onze stories

**Date** : 2026-08-11 → 2026-08-13
**Périmètre** : les ONZE stories livrées sans aucune revue au dossier — 1.1, 1.2, 1.3, 2.8, 3.1, 3.3,
3.5, 5.1, 5.2, 5.3, 5.4.
**Méthode** : sous-agents adversariaux sur angles disjoints (modèle différent de celui qui a
implémenté), réfutation de chaque trouvaille avant de la retenir, puis campagne de mutation —
**103 mutants appliqués et restaurés par instantané `cp`, 103 tués**. Vérifications RÉELLES, jamais
sur parole : exploits joués contre la base de lancement, chaîne d'attaque du lien magique rejouée de
bout en bout contre un vrai Supabase, catalogue Postgres de production interrogé migration par
migration.

**État final** : 189 fichiers de test, **2895 tests verts**, `tsc` et `eslint` propres, migrations
**0041 → 0048** déployées et vérifiées sur le projet de lancement.

---

## LE FAIT CENTRAL, ET SES SIX OCCURRENCES

Supabase accorde à `anon` et `authenticated` **les sept privilèges DML sur toutes les tables de
`public`**. Une garde n'existe donc que si elle vit **dans une policy ou dans un trigger**. Écrite
dans une Server Action, dans une RPC seule ou en TypeScript, elle se contourne par un `PATCH` ou un
`POST` direct sur `/rest/v1/<table>` — avec le propre jeton de la personne, sans rien forcer.

Ce défaut est apparu **six fois**, dans six stories différentes, écrites à des semaines d'intervalle :

| # | Story | Ce qui était gardé « ailleurs » | Fermé par |
|---|---|---|---|
| S1 | 1.6 / 2.5 | la barrière de détresse | 0041 |
| S2 | 1.6 | la révocation du consentement, réversible par `PATCH` | 0041 |
| S6 | 1.9 | la barrière de minorité | 0042 |
| — | 4.1/4.2 | les horodatages, réécrivables par le client | 0046 |
| — | 4.2 | la provenance d'un fait extrait | 0047 |
| **Q** | **1.3** | **la majorité — les 18 ans** | **0048** |

La sixième est la plus grave du produit et elle a été **exploitée avant d'être fermée** : un `PATCH`
direct a écrit `date_naissance: "2013-06-15"` avec `mineur_detecte: false`, et
`etapeOnboardingPour` a répondu « adulte ». Une personne de treize ans admise dans un produit qui
traite des données de l'article 9 et fait parler un modèle de langage de sa vie intérieure.

En écrivant le trigger, un second défaut est apparu : l'âge se calculait en **UTC**. En métropole
cela refusait à tort quelqu'un pendant les deux premières heures de son anniversaire — sans gravité.
**Aux Antilles cela admettait un mineur la veille au soir**, UTC ayant déjà basculé. La Guadeloupe,
la Martinique, la Guyane et La Réunion sont des départements français. `0048` compte en
`Europe/Paris`.

---

## LES TROUVAILLES GRAVES, PAR ORDRE

### 1. Fixation de session sur le lien magique (story 1.3) — **exploité, puis fermé**

`app/auth/confirm/route.ts` acceptait deux flux : `?code=` (PKCE) et `?token_hash=` (`verifyOtp`).
Le second n'est lié à **aucun navigateur**. Chaîne rejouée en entier contre un vrai Supabase :

1. l'attaquant demande un lien magique **pour sa propre adresse** ;
2. il ouvre son courriel et en extrait le `token_hash` ;
3. il envoie à la victime `…/auth/confirm?token_hash=<le sien>&type=magiclink` ;
4. mesuré : **`verifyOtp` rend une session complète à un client neuf**, sans `code_verifier`.
   `getUser()` renvoie l'adresse de l'attaquant.

La victime navigue alors **dans le compte de l'attaquant**, sans le moindre signe. Tout ce qu'elle
confie ensuite à Anam — de l'article 9 — s'écrit chez lui, qui le relira quand il veut.

C'est exactement ce que PKCE empêche. Garder à côté une porte qui ne demande pas le `code_verifier`
annulait la garantie : la serrure était bonne, la fenêtre était ouverte.

**Vérifié avant de retirer la branche** : le projet de lancement n'a **aucun gabarit de courriel
personnalisé**, et le lien réellement envoyé pointe sur le `/auth/v1/verify` de Supabase, qui
redirige vers `…/auth/confirm?code=…`. Mesuré : `303 → http://localhost:3000/auth/confirm?code=<…>`.
Le chemin retiré n'était emprunté par personne.

### 2. Redirection ouverte, sur la même route — **fermé**

`?next=` partait sans validation dans `new URL(next, origin)`, qui **n'est pas une garde** : la base
est ignorée dès que la valeur est absolue ou protocol-relative. Mesuré :

```
"https://evil.example"  →  https://evil.example/
"//evil.example"        →  https://evil.example/
"/\evil.example"        →  https://evil.example/     ← commence pourtant par « / »
```

La troisième forme est la raison pour laquelle la correction ne teste **pas** `startsWith("/")` :
elle passerait. On compare l'origine résolue et on ne garde que le chemin.

Les deux défauts se **combinent** : un seul lien connecte la victime au compte de l'attaquant puis la
dépose sur une fausse page Anima — à la seconde exacte où elle vient d'accorder sa confiance au lien
reçu.

### 3. Le cookie de session lisible par le JavaScript et transmissible en clair — **fermé**

`@supabase/ssr` 0.12.3 pose `httpOnly: false` et **ne pose jamais `Secure`** (vérifié dans le
paquet), sur un cookie qui porte l'`access_token` **et** le `refresh_token`.

Ce qui rend la correction gratuite : `createBrowserClient` **n'est importé par aucun fichier** de
`app/`, `lib/` ni `render/`. Toute l'autorisation passe par `getUser()` côté serveur. Le JavaScript
de page n'a jamais eu besoin de voir ce cookie — il pouvait simplement le lire.

Un seul objet partagé (`lib/data/supabase/cookies-session.ts`) sert les deux chemins qui posent des
cookies : durcir `server.ts` en laissant le proxy poser l'ancien n'aurait rien durci.

### 4. Le lien de connexion pouvait partir en clair — **fermé**

`const proto = h.get("x-forwarded-proto") ?? "http"` : un repli **ouvert**. Le contraste interne est
ce qui rend le défaut net — `lib/courriel/origine.ts` refuse déjà exactement cela (« un lien en clair
dans un courriel est interceptable et rétrogradable »), mais ne gardait que le courriel de synthèse.
Le courriel de **connexion**, celui qui ouvre le compte, n'en bénéficiait pas. Il utilise désormais le
même validateur.

### 5. La vente à un compte suspendu (story 3.1) — **fermé**

`POST /api/stripe/checkout` n'avait qu'une garde d'état, dérivée de `episode_detresse.fin IS NULL`.
Ni `barriere_minorite_le`, ni `mineur_detecte`, ni `revoked_at` n'y entraient. Un compte **suspendu
pour minorité soupçonnée** — à trente jours de sa suppression, et à qui l'application n'affiche plus
que `/barriere` — pouvait POSTer cette route et être débité de 69 €. Sa session survit délibérément à
la suspension (l'export en a besoin) : le cookie était valide, rien ne s'y opposait.

La garde réutilise `etapeOnboardingPour`, la machine d'état de toutes les pages, plutôt que d'ajouter
une troisième lecture des mêmes colonnes. Elle borne **l'entrée** dans le paiement seulement : la
sortie (résilier, rembourser) reste ouverte sans condition, et un test le prouve.

### 6. AC4 de la story 1.1 : la garde promise n'avait jamais été écrite — **écrite**

La story 1.1 promet, mot pour mot : « retirer la politique de cette table fait échouer la CI et
bloque le déploiement (AD-12) », et décrit un garde structurel interrogeant le catalogue Postgres
pour **toute** table art. 9. Ce garde n'existait pas. Ce qui existait — et qui est bon — c'est
`tests/rls.test.ts` : **deux** tables éprouvées à la main. Vingt-cinq autres sont nées depuis, dont
`entree_journal`, `fait_extrait` et `theme_natal`, c'est-à-dire tout le contenu art. 9. L'invariant
tenait par la discipline de celui qui écrivait la migration — et la discipline ne casse pas le build.

Mesuré sur la base de lancement : **27/27 tables en RLS activée ET forcée**, zéro fonction
`security definer` sans `search_path` figé, zéro policy d'écriture sans `with check`, aucune dérive
entre le corpus de migrations et la base. L'invariant était **vrai** ; il n'était pas **gardé**.
`tests/rls-catalogue.test.ts` le garde désormais des deux côtés : le corpus de migrations (toujours,
sans base) et la base vivante (une session étrangère balaie les 27 tables).

### 7. AC3 de la story 1.1 : la garde de couches existait mais ne mordait qu'à moitié — **fermé**

Deux formes d'import traversaient `no-restricted-imports` **et** toutes les gardes vitest :

- **le chemin relatif qui remonte** — les motifs sont comparés au spécificateur brut, donc
  `"../data/depot-branche"` ne ressemble à aucun `@/…`. Un fichier du domaine pouvait tirer Supabase
  par `../data/…` et le build restait vert ;
- **l'import dynamique** — la règle ne visite que `ImportDeclaration` / `ExportNamedDeclaration` /
  `ExportAllDeclaration` ; `await import("@supabase/supabase-js")` ne lui est jamais présenté.

`lib/domain/` et `lib/scene/` étant **plats**, tout `../` sort de la couche : l'interdiction est
totale, sans exception à ménager. L'import dynamique est interdit en bloc — le domaine est pur, il
n'en a aucun usage. Sept formes fautives ont été soumises au lint, sept ont été refusées.

---

## LES PORTES PRÉ-LANCEMENT — configuration, pas code

Lues sur le projet de lancement le 2026-08-13. **Aucune n'est corrigeable dans le dépôt.**

| Réglage | Valeur actuelle | Conséquence |
|---|---|---|
| `site_url` | `http://localhost:3000` | les liens de connexion ramèneraient sur **localhost** : personne ne peut se connecter en production |
| `uri_allow_list` | *(vide)* | aucune URL de production autorisée comme destination de retour |
| `rate_limit_email_sent` | **2 / heure**, pour tout le projet | deux requêtes suffisent à **empêcher tout le monde de se connecter** pendant une heure — le lien magique est le seul chemin d'entrée |
| `security_captcha_enabled` | `false` | rien n'étrangle l'envoi de liens ; aucune limite applicative non plus |
| `mailer_otp_exp` | 3600 s | une heure de fenêtre par lien |

Les trois premières sont **bloquantes pour la mise en ligne**. La quatrième mérite d'être décidée
avant d'ouvrir : sans CAPTCHA ni étranglement, bombarder la boîte d'une personne de courriels signés
« Anam » ne coûte rien — et dans un produit dont la population est, par conception, exposée à des
tiers hostiles, un courriel « Anam » qui arrive dans une boîte surveillée est un dommage en soi.

---

## CE QUI RESTE OUVERT, DÉLIBÉRÉMENT

- **M4 — remboursement intégral jusqu'à neuf mois d'usage.** Ce n'est **pas** un défaut : c'est une
  décision de générosité assumée par Julian, écrite ici pour qu'aucune revue future ne la
  « corrige ».
- **Les flèches `import type` du domaine vers `@/lib/ai/port` et `@/lib/astro/`.** Effacées à la
  compilation, documentées, zéro arête à l'exécution. Une garde value-only les couvre déjà
  (`tests/arc-architecture.test.ts`).
- **Les couches sans garde ESLint** (`app/`, `render/`, `lib/data/`, `lib/ai/`, `lib/safety/`…).
  Aucune n'est violée aujourd'hui — vérifié — et `render/` et `lib/scene/` sont tenues par des tests.
  L'extension de la garde à toutes les frontières est du travail, pas un défaut.
- **La moitié « base vivante » du garde RLS ne tourne pas en production.** Elle interroge la base que
  la suite atteint (le stack local). La production est vérifiée **au déploiement**, à la main, par
  interrogation du catalogue. C'est un écart réel, énoncé plutôt que masqué.

---

## CE QUE LA MÉTHODE A APPRIS, ET QUI VAUT POUR LA SUITE

**Un mutant qui survit est d'abord une commande à vérifier.** Cinq fois cette campagne, une mutation
« survivante » venait d'un `perl` qui n'avait rien remplacé, ou d'une mutation visant une fonction qui
n'était pas celle qu'on croyait. Un mutant invalide fait croire à une garde faible ; c'est l'inverse
qui coûte le plus cher.

**Deux défenses redondantes se couvrent l'une l'autre.** Supprimer la clé étrangère composite de
`fait_extrait` laissait les tests verts — la policy la couvrait. Il a fallu passer par `service_role`,
qui contourne la RLS, pour éprouver la clé seule.

**Une garde aveugle est verte, et c'est le pire état possible.** En écrivant le garde du catalogue,
mon extracteur retirait les commentaires `/* */` avant les `--`. Un `/*` égaré dans un commentaire de
ligne de `0039` s'est refermé sur le `*/` de `0044` : **cinq migrations avalées**, 26 tables vues sur
27 — et le garde était vert, puisqu'il ne restait aucune faute dans ce qu'il voyait encore. Le même
piège s'est reproduit trois heures plus tard, sur les gardes TypeScript : elles rougissaient sur
**l'explication du correctif**, qui cite la forme fautive. Une garde qui force à effacer la mémoire du
défaut pour redevenir verte est une garde qui se retournera contre le code. Les deux familles
d'extracteurs testent désormais **l'extracteur lui-même**, sur une entrée qui n'existe pas encore dans
le corpus.

**Une mutation trop étroite accuse à tort.** Un mutant a « survécu » simplement parce que je n'avais
lancé qu'un seul fichier de test ; la garde existait ailleurs.

---

## JOURNAL DES LOTS

| Lot | Périmètre | État |
|---|---|---|
| **1** | Epic 5 (5.1 → 5.4) | **CORRIGÉ** — A2/A4/A7, B3→B6, D1/D5, gardes E ; 37 mutants |
| **2** | L'argent (3.1, 3.3, 3.5) | **CORRIGÉ** — M1 → M12, migrations 0043/0044, preuve Stripe réelle ; 33 mutants |
| **3a** | Story 2.8 — la voix | **CORRIGÉ** — entités HTML, miroir divergent, émoji, clause médicale absente ; 5 mutants |
| **3b** | Story 1.3 — la majorité | **CORRIGÉ** — exploitée puis fermée par 0048 ; résidus 27 tables par 0046/0047 ; 4 mutants |
| **3c** | Story 1.1 — fondations RLS et couches | **CORRIGÉ** — garde de catalogue écrite, garde de couches refermée ; 14 mutants |
| **3d** | Story 1.3 — le lien magique | **CORRIGÉ** — fixation de session, redirection ouverte, cookies, origine ; 8 mutants |
| **3e** | Story 3.1 — la vente à un compte suspendu | **CORRIGÉ** — 2 mutants |
| **1.2** | Fondation du design-system | **FERMÉE SANS REVUE ADVERSARIALE** — motif ci-dessous |

**Pourquoi la 1.2 est fermée sans revue adversariale.** Elle ne livre ni garde, ni écriture, ni
frontière : des jetons CSS, des typographies et un layout racine. Sa surface de défaut est visuelle,
et elle est déjà couverte par des tests exécutés — contraste (`tests/contraste.test.ts`), cibles
tactiles, accessibilité. Une revue adversariale y chercherait des failles qu'elle ne peut pas
contenir. Le motif est écrit ici pour que « done » ne se lise pas comme « relue ».
