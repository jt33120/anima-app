# lib/safety — couche safety (voir ARCHITECTURE-SPINE AD-1/AD-10)

La sécurité n'est pas un module à côté : elle est **évaluée d'abord** dans un pipeline serveur unique
et peut **annuler** tout le reste du tour (AD-16). Aucune infra dans les modules purs (AD-1/AD-10).

## Le pipeline sécurité-d'abord (Story 2.3)

`pipeline.ts` — **`evaluerSecuriteDuTour(deps, messages)`**. Ordre imposé par tour utilisateur :

1. **Détection d'abord** (`detecteur-detresse.ts`) : classification au modèle **FORT** (capacité
   `detection` ⇒ tier fort inconditionnel, AD-5/NFR-012), sous l'**egress art. 9 unique** (AD-13).
2. **Niveau effectif** = `max(niveau détecté, épisode ouvert ? 1 : 0)` — le forçage vaut pour **tout
   l'épisode** (couture `DepotEpisode` → Story 2.4, qui posera l'entité `episode_detresse`).
3. **Audit sans art. 9** (`journaliser-audit.ts` → `audit_securite`, migration 0009) : niveau,
   décision, tier, horodatage — pour mesurer le rappel et les **faux négatifs** (FR-078).
4. **Veto** (`doitExecuterTravailSchema`) : dès niveau ≥ 1, tout travail de schéma/reconceptualisation
   est suspendu (FR-037). Le point d'extension attend le writer de reconceptualisation (Epic 4).

### Règle d'architecture (gardée par un test)

**`detecteur-detresse.ts` n'est appelé QUE par `pipeline.ts`** — aucun détecteur hors du pipeline
(AD-16). La route (`app/api/anam/message`) appelle le pipeline **avant** toute génération. Gardé par
`tests/pipeline-securite-architecture.test.ts` (grep source, style `frontiere-serveur`).

### Repli sûr (AD-15)

À défaut du modèle fort (appel qui lève, sortie illisible), le détecteur renvoie un **verdict de
repli** (`repliSur`, niveau plancher qui engage les haltes) + un **incident journalisé** sans art. 9
— jamais une re-tentative au tier léger, jamais un échec silencieux. Un **blocage d'egress**
(consentement/minorité/ZDR) est distinct : le tour s'arrête en amont.

### ⚠️ Contenu clinique PROVISOIRE (porte pré-lancement)

Le prompt de détection, les seuils de niveaux et le jeu de cas (`tests/fixtures/detresse-cas.provisoire.json`)
sont un **placeholder** : ils doivent être **validés par un professionnel qualifié (clinicien) et un
juriste** avant toute mise en ligne sur données réelles (PRD §5). On code la **machine** ; pas le jugement.

## Modules

- `barriere-minorite.ts` / `appliquer-barriere.ts` — barrière de minorité (Story 1.9, FR-071).
- `classer-detresse.ts` — **pur** : niveau (0-3) → `VerdictSecurite` ; entrée illisible → repli sûr.
- `detecteur-detresse.ts` — serveur : classification au fort sous egress ; repli sûr ; prompt placeholder.
- `pipeline.ts` — sécurité-d'abord ; **seul appelant du détecteur** ; audit ; veto ; couture épisode.
- `journaliser-audit.ts` — écriture de l'audit détresse (service_role, best-effort, ne lève jamais).
- `mesure-rappel.ts` — **pur** : machine de mesure du rappel / des faux négatifs (FR-078).
