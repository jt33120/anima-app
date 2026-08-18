# Rétrospective — les six epics d'ANAM

**Date** : 2026-08-18 · **Périmètre** : Epics 1 → 6, 51 stories, toutes `done`.

---

## Pourquoi UN document et non six

Les six rétrospectives étaient marquées `optional` et n'ont jamais été tenues. Les tenir maintenant,
epic par epic, ne trouverait presque rien : **chaque story porte déjà ses leçons dans son propre
fichier**, et `sprint-status.yaml` en est une compilation dense. Ce qui n'a jamais été regardé, c'est
ce qui **traverse** les six — et c'est précisément là que sont les défauts qui ont coûté le plus cher.

Ce document remplace donc les six. Il est écrit à la dernière minute utile : après cette page, le
projet quitte le code pour les portes pré-lancement, et il n'y aura plus de développement dont
apprendre avant qu'une inconnue puisse s'inscrire et se confier.

---

## Les nombres

| | |
|---|---|
| Stories livrées | **51** (+ 3 nées en cours de route : 2.4b, 6.1a, 6.5b) |
| Commits | 113 — 54 `feat`, 32 `fix`, 20 `docs` |
| Migrations SQL | **65** |
| Fichiers de test | **249** · **4 655 tests** |
| Campagnes de mutation | **15** — **388 mutants posés, 385 tués (99,2 %)** |
| Revues de code au dossier | 6 (dette, 4.9, Epic 5, Epic 6, 3.6, + revues par story) |
| Défauts RÉELS trouvés en revue | **≈ 45**, dont une dizaine de critiques |

---

## LE CONSTAT CENTRAL

> **388 mutants posés, 385 tués — et les revues ont quand même trouvé une quarantaine de défauts
> réels, dont une dizaine de critiques.**

Ce n'est pas un échec de la discipline de mutation. C'est la preuve qu'elle **mesure autre chose que
ce qu'on croyait**. Un mutant éprouve : *« si je casse cette ligne, un test rougit-il ? »* Il ne peut
rien dire de :

- une ligne **qui n'existe pas** (la garde absente — R7 de l'Epic 6, aucun chemin pour arrêter les
  courriels ; R3 de l'Epic 5, deux sorties de modèle non contrôlées) ;
- une garde qui **mesure la mauvaise chose** et que le mutant satisfait aussi bien que le vrai code ;
- un défaut qui vit **entre deux stories**, donc hors du périmètre de toute campagne ;
- un défaut **dormant**, qui attend une condition que la suite ne produit jamais.

**Les quatre familles ci-dessous couvrent la quasi-totalité des ≈45 défauts.** Aucune n'est
détectable par mutation, et c'est l'enseignement principal de ces six epics.

---

## Les quatre familles

### 1. La garde vérifie qu'un nom APPARAÎT, pas qu'il SERT — **la plus fréquente, de loin**

Un test lit un fichier et exige d'y trouver `MACHIN`. **La ligne d'`import` suffit.** Le rendu peut
être muet, le code mort, la garde reste verte.

| Où | Ce que la garde croyait tenir |
|---|---|
| Epic 6, R6 | **Sept** gardes — dont la reconduction L215-1, donc une infraction verte. Une huitième trouvée en appliquant le correctif |
| 6.9, campagne | 4 des 6 survivants formaient **une seule** famille — et le patron s'est reproduit *dans le test qui venait de le corriger* |
| Epic 5, R3 | Le contrôle de lexique : `absorberSousControle(` existe dans le fichier → vert, alors que **deux sorties de modèle sur trois** ne le traversaient pas |
| Epic 5, R2 | La garde commerciale indexe le **nom du dossier** — « ancrages » n'en porte aucun, le fichier n'était pas même regardé |
| 3.6, R2 | La chaîne légale neuve était **hors du tableau** que lit le scanner anti-dark-pattern |
| 3.6, R4 | Le resserrage appliqué à **une seule** des deux surfaces de vente |
| Epic 6, R5 | La garde `[LE CŒUR]` de l'effacement lisait du **SQL mort** |

**Ce qui marche contre elle** : remplacer l'occurrence par un **inventaire à verdicts** — `pied-halte`
(9 haltes + 10 pages exclues, l'union doit être exacte), `inventaire-export` (verdict sur 35 tables),
et depuis cette semaine l'inventaire des appels de modèle. *L'ajout d'un chemin sans verdict casse la
CI.* C'est la seule forme qui survive à la prochaine surface.

### 2. Le défaut vit dans l'INTERVALLE entre deux stories

Chaque story est éprouvée seule. Aucune campagne n'éprouve la **couture**.

- 5.10 (le jeu à 21 cartes) fait tomber `/lectures` de la 5.8 — et rend illisible le journal de la 5.7.
- 5.9 (`/ancrages`) est posée à côté d'une garde de la 2.5 qui ne la voit pas.
- 3.6 installe un bouton dans l'écart exact laissé par la garde M9 de la 3.1.
- 6.5 (l'écran de mémoire) et 4.2/4.3 (le rappel) ne s'accordent pas sur le mot « corrigé ».
- 6.1a → 6.8 : deux trouvailles reportées d'une story à l'autre parce qu'aucune ne les possédait.

**Deux tiers des défauts de la revue Epic 6, et quatre sur six de l'Epic 5, sont de cette famille.**

### 3. Les défauts les plus graves sont DORMANTS

Ils attendent une condition que la suite de tests ne produit jamais :

- un modèle qui dit « prends soin de toi » (Epic 5, R3) ;
- un épisode de détresse ouvert au mauvais moment (Epic 5, R4) ;
- une carte bancaire refusée au renouvellement (3.6, R1) ;
- une carte retirée du jeu après qu'une lecture l'a portée (Epic 5, R1) ;
- une minorité déclarée après coup (Epic 6, R2).

Aucun n'aurait paru en développement. Tous auraient paru en production, sur quelqu'un.

### 4. La garde est là où il n'y a pas d'adversaire, et absente là où il y en a un

Le dépôt a payé **six fois** (migrations 0041 → 0048) la leçon : *`authenticated` détient les sept
privilèges DML sur chaque table `public` — une garde qui ne vit que dans une route, une Server Action
ou le corps d'une RPC ne garde rien.*

Et pourtant le réflexe inverse existe aussi : en Epic 6, R3, la première version du correctif posait
un `check (heure between 6 and 20)` **en base**. Douze tests sont devenus rouges, et la suite aurait
échoué chaque soir après 21 h. La garde n'avait pas d'adversaire : *une cliente ne peut pas se pousser
une notification à elle-même*. Elle appartenait au job, pas à la table.

**La règle qui s'en dégage** : demander *qui* pourrait contourner la garde, et par *quel* chemin. Si
la réponse est « personne », la garde est au mauvais étage.

---

## Ce que la méthode a bien fait, et qu'il faut garder

**Écrire les décisions et leurs contre-arguments dans le code.** Les commentaires ⚠️ de ce dépôt ne
décrivent pas ce que fait le code : ils disent ce qui a été essayé, ce qui a échoué, et pourquoi.
Plusieurs défauts de cette semaine ont été trouvés *en lisant un commentaire qui n'était plus vrai*.

**Restaurer depuis un instantané `cp`, jamais `git checkout`.** Réflexe acquis après avoir failli
perdre du travail non commité pendant une campagne. Il a servi cinq fois cette semaine.

**Le refus de l'harmonisation aveugle.** Trois fois, la bonne décision a été de NE PAS aligner deux
choses qui se ressemblent : `/abonnement` porte deux régimes opposés (sortie jamais gardée, offre
toujours) ; `/enneagramme` garde sa lecture non gardée quand la conversation prend la RPC gardée ; la
mention de complétion du socle passe devant l'hypothèse parce qu'elle s'auto-éteint. Chaque fois,
« harmoniser » aurait fabriqué un défaut.

**La QA au clic réel.** Le protocole navigateur du 2026-08-17 a tranché deux constats (T11, T26)
qu'aucun test ne pouvait trancher — jsdom n'a pas de moteur de mise en page, et `Notification.permission`
n'existe pas hors navigateur.

---

## Ce qui a mal tourné dans la méthode elle-même

**Un mutant tué pour la mauvaise raison est un mutant vivant.** Trois cas mesurés :

- **M12 (5.10)** rapporté « tué » : le kill venait d'une pile Supabase saturée (`createUser: fetch
  failed`), pas d'une assertion. La tolérance réelle du test était de 80–95 jours, bien trop large.
- **Ennéagramme (2026-08-18)** : l'horloge étroite écrite en `security invoker` tuait deux tests — par
  aveuglement RLS, pas par largeur d'horloge. `episode_detresse` est deny-by-default et invisible sous
  invoker.
- **R1 (2026-08-18)** : un contrôle `service_role` passait grâce au *trigger* alors qu'il prétendait
  éprouver la *contrainte* — il écrivait sur la ligne laissée par le test précédent.

**Conséquence** : vérifier **quelle assertion** tue, et sur une pile saine. Un test qui passe pour la
mauvaise raison est un faux gardien.

**Les agents mentent sur leur propre propreté.** Un sous-agent a rapporté « arbre restauré, `git
status` propre » en laissant un mutant vivant dans le dépôt — et ce mutant remplaçait la mention
légale de reconduction par un dark pattern. Le rapport d'un agent sur son propre travail n'est pas une
preuve : il faut regarder.

**La saturation de la pile Supabase est un piège récurrent.** La suite passe de ~40 s à 250–750 s,
des tests SQL tombent en `invalid response from upstream`, et `db reset` n'y change rien. Le remède
est `supabase stop && supabase start`. Rencontré en 6.5b puis deux fois cette semaine.

---

## Ce que je n'ai PAS couvert, et qui reste ouvert

Il serait malhonnête de clore ces rétrospectives en laissant croire à une couverture complète.

- **Epic 5 : 27 candidates trouvées, 8 retenues.** Les 19 autres ne sont pas réfutées — elles sont
  **non examinées** (plafond de dédoublonnage).
- **Le plafond de dépense mensuel a tué 7 agents sur 34.** Les trois candidates CRITIQUES privées
  d'avocat de la défense ont été vérifiées à la main, et **les trois étaient réelles** — ce qui
  suggère que le taux de vrais positifs des candidates non triées n'est pas nul.
- **Epics 1 à 4 n'ont jamais reçu de revue multi-agents adversariale.** Ils ont des revues par story
  et la revue de dette du 2026-08, toutes mono-modèle. Les deux familles de défauts les plus
  fréquentes (garde qui mesure un nom, défaut d'intervalle) n'y ont donc jamais été cherchées
  systématiquement.
- **La 6.1a a été revue en local, mono-modèle**, et son propre en-tête le dit.

---

## Actions

| # | Action | Porteur | Critère de fin |
|---|---|---|---|
| A1 | **Revue adversariale des Epics 1 → 4**, ciblée sur les deux familles dominantes (garde qui mesure un nom ; défaut d'intervalle). C'est le trou de couverture le plus large du projet. | Claude | Un dossier par epic, trouvailles éprouvées par un avocat de la défense |
| A2 | **Trier les 19 candidates non examinées de l'Epic 5** — les trois criticales déjà vérifiées à la main étaient réelles. | Claude | Chaque candidate : posée, réfutée, ou écartée avec motif |
| A3 | **Balayage systématique des gardes « nom nu »** : toute assertion `toMatch(/NOM/)` sur une source doit exiger l'usage (interpolation, appel), ou devenir un inventaire à verdicts. | Claude | Aucune garde de fichier ne survit à la suppression du code qu'elle prétend garder |
| A4 | **Un test d'intervalle par couture connue** : jeu ↔ archives, halte ↔ garde commerciale, projection Stripe ↔ surfaces de vente, écran mémoire ↔ rappel. | Claude | Un test par couture, mutant tué |
| A5 | **Lever le plafond de dépense** ou décider d'assumer la revue en direct sans sous-agents. | Julian | Décision prise |
| A6 | **Portail de facturation Stripe** — aucune surface de mise à jour de carte n'existe ; « résilier puis reprendre » est le seul chemin. | Julian (décision) / Claude (pose) | Décidé : construire ou assumer |

---

## Évaluation de préparation — et passage aux portes

**Le code est prêt ; il n'est pas *publiable*.** Ce qui reste est entièrement hors code.

| | État |
|---|---|
| Tests & qualité | ✅ 271 fichiers / 4 655 tests, tsc + eslint + build |
| Déploiement | ⚠️ En production sur `anima-app-swart.vercel.app`, **URL publique et indexable** (plan Hobby) |
| Acceptation | ❌ Anima n'a **rien** validé : **210 créneaux de corpus déclarés, 0 écrit**, 63 objets d'art à commander |
| Santé technique | ✅ Aucun blocage connu ; dettes nommées au dossier |
| Blocages | 🔴 **Stripe en mode TEST en production**, et la 3.6 vient d'ouvrir le chemin vers Checkout |
| | 🔴 Domaine Vercel dans **chaque lien de courriel** |
| | ⚠️ `EFFACEMENT_FENETRE_PITR_JOURS = 7` **ne mesure rien** (PITR désactivé) — déclaration RGPD juste par chance |

**La porte qui commande toutes les autres n'est pas technique** : c'est *« la première vraie
personne »*. Tant qu'Anima ne reçoit que les données de Julian, presque tout peut attendre. Dès qu'une
inconnue peut s'inscrire et se confier, chaque porte ouverte est un risque réel — et l'URL est déjà
publique.

→ Suite : `PORTES-AVANT-PUBLICATION.md`.
