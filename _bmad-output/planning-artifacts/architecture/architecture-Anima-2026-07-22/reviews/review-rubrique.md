---
title: "Revue de rubrique — ARCHITECTURE-SPINE Anam"
type: architecture-review
method: rubric-walker
target: _bmad-output/planning-artifacts/architecture/architecture-Anima-2026-07-22/ARCHITECTURE-SPINE.md
reference: _bmad-output/planning-artifacts/prds/prd-Anima-2026-07-21/prd.md
reviewer: rubric-walker
date: 2026-07-22
---

# Revue de rubrique — ARCHITECTURE-SPINE (Anam)

## Verdict

Spine **excellente sur les invariants produit/domaine** (art.9, mémoire, arbre monotone, isolation du tirage, filet de sécurité), mais **percée par le silence sur toute l'enveloppe opérationnelle** — sauvegardes/restauration, panne fournisseur IA en séance (y compris en détresse), tests/CI, pipeline vocal, planification/notifications : plusieurs dimensions porteuses sont entièrement muettes. **À ne pas figer avant d'avoir décidé ou déféré explicitement ces dimensions.**

## Méthode et périmètre

Marche de rubrique « bonne spine » : (1) fixe-t-elle les vrais points de divergence des stories sans en rater ? (2) chaque Rule d'AD est-elle applicable et bloque-t-elle réellement la divergence ? (3) rien sous Deferred ne peut laisser deux unités diverger ? (4) technos vérifiées-actuelles ? (5) capacités porteuses du PRD toutes adressées (AD / seed / deferred) ? (6) **chaque dimension que l'altitude possède est-elle décidée, déférée ou question ouverte** — priorité à l'enveloppe opérationnelle et aux dimensions silencieuses.

## Points forts (à préserver — ne pas « corriger »)

- **AD-4** (frontière art.9) : franchissement unique serveur→fournisseur/ZDR, interdiction OpenRouter/intermédiaire US, RLS par utilisatrice. Invariant fort, applicable, testable.
- **AD-8** (mémoire trois couches + arbre strictement monotone, exception unique = effacement FR-067) : verrou de divergence net et vérifiable.
- **AD-9** (drapeau serveur `limites_levees`, jamais de paywall sur la sécurité) : garde technique concrète, pas une intention. Excellente.
- **AD-11** (isolation du tirage : le point d'entrée n'a aucun accès au profil, « contrainte d'architecture, pas de code ») : traite FR-016 (défaut critique) à la racine.
- **AD-5** (détresse toujours au modèle le plus capable) et **AD-6** (socle déterministe, thème calculé une fois) : bien posés.

La faiblesse n'est donc pas dans le cœur produit — elle est **exclusivement dans l'enveloppe opérationnelle et quelques chemins de données transverses**, c.-à-d. exactement la zone que la rubrique désigne comme prioritaire.

---

## Constats classés

### CRITIQUE

**C1 — Sauvegardes / restauration : dimension entièrement silencieuse, en collision avec le droit à l'effacement.**
La proposition de valeur *est* la mémoire longue de données art.9 ; or aucune décision sur backup / PITR / procédure de restauration n'existe (ni AD, ni seed, ni deferred). Deux conséquences porteuses : (a) perte de la base = perte de tout le produit, sans stratégie de reprise ; (b) **tension non résolue** entre FR-067 / NFR-021 (« suppression propagée aux sous-traitants », « conservation appliquée automatiquement ») et l'existence de sauvegardes qui, par nature, **retiennent** des données art.9 effacées. Une story « suppression totale » et une story « sauvegarde » divergeront inévitablement (l'une efface, l'autre conserve) sans invariant qui arbitre la fenêtre de rétention des backups et leur purge. Défaut de conformité, pas seulement d'ops.

**C2 — Panne / dégradation du fournisseur IA en séance vive, en particulier pendant un épisode de détresse, non définie.**
AD-5 impose « le modèle le plus capable **disponible** » (ligne 59) mais rien ne dit ce qui se passe quand le fournisseur time-out, renvoie une erreur ou rate-limit **au milieu d'un niveau 2/3 de détresse** (§5). Le Deferred ne défère que le *pool de clés pour le scaling* (ligne 207) — il défère donc **implicitement et à tort** le traitement d'erreur du chemin vif. Points de divergence concrets entre stories, avec une utilisatrice suicidaire en ligne : afficher une erreur ? retomber sur un message caché ? réessayer en silence ? basculer de tier ? La spine doit fixer le comportement de repli (au minimum : jamais de fermeture, ressources 3114/§5 servies en dur hors LLM, message de continuité), sinon FR-039 (« Anam ne quitte jamais ») n'est pas garanti sous panne. Silence à teneur de sécurité.

### ÉLEVÉ

**E1 — Stratégie de tests + CI/CD : dimension muette malgré des exigences testables dures et porteuses.**
FR-078 (jeu de cas de détresse validé par un professionnel ; taux de faux négatifs = indicateur suivi, « tout faux négatif est un incident »), FR-085 (contrôle automatisé des formulations bannies), FR-015/016 + critères d'acceptation (« distribution vérifiablement uniforme sur un grand nombre de tirages », « vérifiable dans les traces »). Ces harnais sont architecturalement porteurs (où vivent-ils, qu'est-ce qui bloque un déploiement) et **aucun AD/seed/deferred** ne les adresse. Sans décision, chaque story invente son propre test ou n'en met aucun ; le gate faux-négatifs devient déclaratif.

**E2 — Pipeline vocal / transcription : probable sous-traitant art.9 et invariant de durabilité, tous deux non traités.**
NFR-003 (seule la transcription conservée, audio supprimé après traitement), NFR-017 (**capture indépendante du traitement, aucune entrée de journal ne peut être perdue**), NFR-004 (aucune inférence d'émotion depuis la voix). La transcription passe très probablement par un service STT tiers → **chemin art.9 que AD-4 devrait couvrir**, mais aucun fournisseur STT n'est dans la Stack et aucune règle « capture durable avant traitement » n'existe. NFR-017 est un invariant de durabilité (perte de données) laissé sans AD.

**E3 — Notifications / planification : « à définir » — or ce sous-système muet porte plusieurs piliers et tous les mécanismes « automatiques ».**
La Capability Map inscrit littéralement « à définir (web push + planif) » (ligne 198) pour FR-033/034/035 (les deux rythmes) + NFR-015. Pire, **aucun ordonnanceur n'est décidé** alors que la spine s'appuie dessus partout : NFR-021 « conservation appliquée automatiquement » (AD-4, ligne 54), suppression après inactivité 24 mois, FR-066 synthèse périodique. « À définir » n'est ni une décision ni une déférence propre (Vercel Cron ? Supabase pg_cron / Edge Functions ? ). Deux stories planifieront de deux façons.

### MOYEN

**M1 — Environnements (dev/prod) et processus de migration Supabase non gouvernés.**
Seules des mentions incidentes (« toléré dev/test uniquement », AD-4 ; « dev/test uniquement », Deferred). Aucune décision sur la topologie d'environnements (un projet Supabase par env ? mapping des env Vercel ?) ni sur le **workflow de migration** (`supabase/` n'est qu'un dossier au seed, ligne 147 : forward-only ? nommage ? appliquées par qui/quand ? rollback ?). Porteur vu l'art.9 : garantir que la donnée prod ne rejoint jamais un env de dev est un invariant, pas un détail.

**M2 — Rotation des secrets, idempotence des webhooks Stripe, monitoring/alerting : couverture mince.**
(a) Secrets « serveur uniquement / clé IA unique » (AD-2, conventions) mais **rotation muette** — une clé IA unique fait de sa rotation/compromission un enjeu réel, non traité par NFR-022. (b) Stripe est dans la Stack et `abonnement` existe, mais **vérification de signature + idempotence des webhooks** (le chemin standard de synchro d'abonnement, de FR-060 résiliation et FR-089 remboursement) n'est mentionnée nulle part → double-traitement / états divergents. (c) Le « faux négatif = incident » (PRD, métriques) et la santé du classifieur n'ont **aucun logement d'observabilité/alerting** décidé.

**M3 — Versions de Stack affirmées mais non vérifiées ; TypeScript 7.0.x paraît anachronique.**
Seul Node porte « (vérifié) » (ligne 119). TypeScript 7.0.x (portage natif, ligne 120), Next.js 16.2.x, Stripe 22.3.x, @mistralai/mistralai 2.5.x sont **non marqués vérifiés**. La rubrique exige « technos vérifiées-actuelles » : au minimum épingler et dater chaque version (surtout TS 7.0, dont l'existence-en-stable gouverne le build) avant de figer. (Non re-vérifiable ici — recherche web interdite ; à confirmer hors revue.)

### FAIBLE

**F1 — Le jeu de « portes pré-lancement » est incomplet.** Le Deferred porte DPA art.28/ZDR et validation clinique+juridique de la détresse, mais **pas** NFR-005 (AIPD avant mise en ligne) ni NFR-022 (procédure de notification de violation art.33-34 « définie avant lancement »). À ajouter comme portes explicites pour homogénéité.

**F2 — AD-4 « conservation appliquée automatiquement » et propagation d'effacement : le *quoi* est fixé, le *comment* est indécidable en l'état** (dépend de M1/E3). Une story ne peut pas implémenter « automatiquement » sans mécanisme décidé.

**F3 — Contrat de `EphemerisPort` non spécifié.** Le port fixe la frontière (bon), mais ce qu'il retourne (système de coordonnées, précision, fuseau) n'est pas défini → risque mineur de divergence entre unités sous la déférence de licence. Faible car thème calculé une fois et stocké.

**F4 — NFR-014 (streaming) non mentionné**, alors qu'il contraint le route handler IA. Mineur.

**F5 — Métadonnée `altitude: feature`** alors que le scope « gouverne le build v1 » (altitude système/produit). Ce sous-cadrage explique peut-être l'omission des dimensions opérationnelles : à altitude système, l'enveloppe opérationnelle *appartient* à la spine.

**F6 — FR-081 « coquille comportementale fixée » (Deferred, ligne 210)** : la coquille des premium (ancrages/plans/synthèse) est déclarée fixée mais n'est pas réellement spécifiée dans la spine ; la synthèse (FR-066) dépend en outre de la planification muette (E3).

---

## Récapitulatif des dimensions silencieuses (checklist de la rubrique)

| Dimension | Statut dans la spine | Constat |
|---|---|---|
| Environnements dev/prod | Mentions incidentes seulement | M1 |
| Migrations de schéma Supabase | Dossier `supabase/` au seed ; process non gouverné | M1 |
| **Sauvegardes / restauration** | **Entièrement silencieux** (+ collision FR-067) | **C1** |
| Monitoring / alerting | Silencieux | M2 |
| **Stratégie de tests** | **Silencieux** (malgré FR-078/085/015) | **E1** |
| CI/CD | Silencieux | E1 |
| Gestion des secrets | Décidé (serveur only) ; **rotation muette** | M2 |
| **Rate-limit + erreurs fournisseur IA** | **Rate-limit déféré ; erreurs en séance/détresse muettes** | **C2** |
| Idempotence webhooks Stripe | Silencieux | M2 |
| Pipeline vocal / STT (art.9) | Silencieux | E2 |
| Notifications / ordonnanceur | « à définir » | E3 |

## Couverture PRD — FR/NFR porteurs non (ou mal) adressés

- **NFR-003, NFR-004, NFR-017** — pipeline vocal / durabilité de capture : non adressés (E2).
- **FR-033 / FR-034 / FR-035, NFR-015** — notifications / deux rythmes : « à définir » (E3).
- **FR-066** — synthèse périodique : tier fixé (AD-5) mais production/planification muette (E3).
- **FR-078, FR-085** — mesure détection + contrôle voix : pas de logement de test (E1).
- **FR-060, FR-089** — résiliation / remboursement : dépendent de webhooks Stripe non gouvernés (M2).
- **NFR-005, NFR-022 (art.33-34)** — portes de conformité manquantes au Deferred (F1).
- **NFR-014** — streaming non mentionné (F4).

Le reste des FR/NFR porteurs (art.9, mémoire, arbre, tirage, détresse-continuité, socle déterministe, auth passwordless, 18+) est **correctement ancré** par un AD, une convention ou le seed.

## Recommandations d'action (ordre de priorité)

1. Ajouter un **AD « Résilience & reprise »** : politique de backup/PITR + fenêtre de rétention des sauvegardes + purge post-effacement qui réconcilie FR-067/NFR-021 (résout C1).
2. Étendre **AD-5 (ou nouvel AD « Dégradation IA »)** : comportement de repli en panne/erreur/rate-limit fournisseur, avec garantie de continuité et ressources §5 servies **hors LLM** en détresse (résout C2).
3. Décider l'**ordonnanceur** (une ligne : Vercel Cron ou Supabase pg_cron) — débloque E3, F2 et rend AD-4 « automatiquement » implémentable.
4. Ajouter un **AD « Frontière de test / gates »** : où vivent le jeu de détresse (FR-078) et le contrôle voix (FR-085), et ce qu'ils bloquent (E1).
5. Étendre **AD-4** au **chemin vocal/STT** (sous-traitant art.9) + poser NFR-017 comme invariant « capture durable avant traitement » (E2).
6. Ajouter env/migrations, rotation des secrets, idempotence Stripe (M1/M2) ; compléter les portes pré-lancement (F1) ; épingler/dater les versions (M3).
