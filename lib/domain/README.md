# lib/domain — couche domain (voir ARCHITECTURE-SPINE AD-1/AD-10)

**Le cœur PUR.** Aucune I/O, aucune dépendance à Next / Supabase / SDK fournisseur / rendu (AD-1).
Seuls des `import type` (contrats de `@/lib/ai/port`) et des imports runtime de **siblings purs**
sont permis. La direction des dépendances est descendante (AD-10) : `render/` et `app/` dépendent de
`lib/domain`, jamais l'inverse. Gardé par ESLint (`no-restricted-imports`) **et** par
`tests/arc-architecture.test.ts` (lecture de fichiers : pas de `server-only`, pas d'import runtime infra).

## L'arc de séance (Story 2.7) — première logique de domaine

La MACHINE de la première séance : `construire → observer → nommer → clore`. C'est le **cerveau** de
la séance ; il consomme toute la sécurité (2.1→2.6) sans rien re-détecter et ne construit pas la voix
(Story 2.8).

- **`arc-seance.ts`** — `avancerArc(etat, signaux, niveauSecurite, maintenantMs)` : la fonction de
  transition **unique et possédée** (AD-8). Accumule les compteurs cross-tour, applique les conditions
  de sortie (FR-004), la conjonction `peutNommer` (FR-007), l'invariant DUR FR-005 (jamais nommer avant
  la clôture d'observer), le comptage des restitutions (FR-003). N'utilise JAMAIS le temps pour décider
  (FR-002 : aucun minuteur). Émet le beat « nommer » sur la transition `observer → nommer`.
- **`seuils-arc.ts`** — les seuils (≥ 3 sujets, ≥ 2 reformulations, ≥ 1 confirmation, ≥ 1 élément
  personnel, ≥ 3 restitutions, niveau détresse bloquant). **PROVISOIRES** (porte produit), passés à la
  machine (jamais figés ailleurs, AD-14).
- **`signaux-arc.ts`** — l'extraction : `INSTRUCTION_EXTRACTION_ARC` (structurée, PROVISOIRE),
  `extraireSignauxArc` (parser PUR, patron `detecteur-detresse`), `requeteExtractionArc` (passe FORT
  séparée, `capacite: "reconceptualisation"`, sous egress art. 9). `reponseLongue` est déterministe
  (sans le modèle). Le seul I/O (l'appel egress) vit dans le câblage route (T4), jamais ici.
- **`depot-seance.ts`** — le PORT `DepotSeance` (défini par le domaine ; l'infra `lib/data/depot-seance`
  l'implémente en `service_role`) + `depotSeancePlaceholder` (honnête, pour les tests unitaires).
- **`consigne-phase.ts`** — `consignePhaseArc(phase)` : la consigne système qui gate la génération par
  phase (surtout FR-005). **PROVISOIRE** ; la voix complète est la Story 2.8.
- **`message-sans-heure.ts`** — la formulation « sans heure de naissance » (FR-011). **COUTURE INERTE**
  (aucun consommateur : prénom → onboarding, disponibilité calculée → socle Epic 4). **PROVISOIRE**.

La **trace** (état persisté cross-tour) vit dans la table `seance` (migration `0012`, server-authoritative,
RLS deny-by-default), écrite/lue par `lib/data/depot-seance` via des fonctions `security definer`.

## La voix d'Anam (Story 2.8) — la couche qui fait parler l'arc

Trois cœurs PURS ; le câblage (injection de consigne, troncature sur flux) vit dans la route.

- **`consigne-voix.ts`** — `consigneVoixAnam()` : la consigne système de la **voix de base** (forme,
  hypothèses réfutables « je me trompe ? », anti-flatterie, corpus Anima, interdit d'affect). Injectée
  serveur **EN TÊTE** des préfixes `[voix, phase, détresse, …messages]` (la détresse reste au plus près
  des messages → overlay prioritaire). **PROVISOIRE**. Contient volontairement le lexique interdit en
  instructions inverses → **exclue** du contrôle bloquant.
- **`voix-anam.ts`** — `pointDeCoupe` / `tronquerATroisPhrases` : la **troncature déterministe à 3
  phrases** (FR-084), même définition de « ponctuation finale » qu'`estReponseLongue`. Appliquée sur le
  FLUX côté route, **GATÉE hors détresse** (`niveauSecurite === 0`) : en détresse la réponse dépasse
  légitimement 3 phrases et n'est jamais coupée avant l'orientation (garde de sécurité).
- **`lexique-interdit.ts`** — `chercherInterdits(texte)` : la **source unique** des interdits (médical
  NFR-008, « soigner » FR-023, formulations bannies FR-085, affect FR-087, emoji), miroir de
  `anam-voice.md` §11. Anti-faux-positif (frontières de mots, casse/accents insensibles). Alimente le
  **contrôle bloquant transversal** `tests/lexique-voix.test.ts` (scan récursif de tout le contenu
  utilisateur, exclusion des consignes, contrôle positif + garde non-vacue). **PROVISOIRE**.
