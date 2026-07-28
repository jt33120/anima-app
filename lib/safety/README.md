# lib/safety — couche safety (voir ARCHITECTURE-SPINE AD-1/AD-10)

La sécurité n'est pas un module à côté : elle est **évaluée d'abord** dans un pipeline serveur unique
et peut **annuler** tout le reste du tour (AD-16). Aucune infra dans les modules purs (AD-1/AD-10).

## Le pipeline sécurité-d'abord (Story 2.3)

`pipeline.ts` — **`evaluerSecuriteDuTour(deps, messages)`**. Ordre imposé par tour utilisateur :

1. **Détection d'abord** (`detecteur-detresse.ts`) : classification au modèle **FORT** (capacité
   `detection` ⇒ tier fort inconditionnel, AD-5/NFR-012), sous l'**egress art. 9 unique** (AD-13).
2. **Niveau effectif** = `max(niveau détecté, épisode ouvert ? 1 : 0)` — le forçage vaut pour **tout
   l'épisode** (`DepotEpisode.episodeOuvert()`, lu AVANT le tour).
3. **Audit sans art. 9** (`journaliser-audit.ts` → `audit_securite`, migration 0009) : niveau,
   décision, tier, horodatage — pour mesurer le rappel et les **faux négatifs** (FR-078).
4. **Enregistrement de l'épisode** (`DepotEpisode.enregistrerTour(niveauDetecte)`) : appelé à **chaque
   tour** avec le niveau **DÉTECTÉ BRUT** (jamais l'effectif forcé — sinon un épisode ouvert ne s'éteint
   jamais). Ouvre / rehausse (≥ 1), compte les tours sûrs et éteint (= 0). Renvoie `limitesLevees`.
5. **Veto** (`doitExecuterTravailSchema`) : dès niveau ≥ 1, tout travail de schéma/reconceptualisation
   est suspendu (FR-037). Le point d'extension attend le writer de reconceptualisation (Epic 4).

## L'entité `episode_detresse` (Story 2.4 ; AD-17, migration 0010)

**Source unique de vérité** des règles vitales de détresse. Deux dérivations **distinctes** :

- **`limites_levees` = `fin IS NULL`** (épisode **ouvert**) → gouverne paywall/quota/bilan (AD-9). Le
  pipeline la retourne (`ResultatSecurite.limitesLevees`) ; la garde de **montage** est la Story 2.5.
- **garde de branche = ouvert OU `now() < fenetre_expire_at`** (72 h après extinction) → « aucune
  branche née d'un épisode » (FR-042). Exposée par `branche_bloquee_par_detresse()` (keyée `auth.uid()`,
  granted `authenticated`) — **couture Epic 4** : le write-gate de `branche` l'appellera dans son WITH CHECK.

**Extinction possédée** : `enregistrer_tour_detresse` (SQL, atomique, race-safe — 0010 + correctifs
0011) ferme l'épisode ssi **N tours sûrs consécutifs ET délai minimal écoulé DEPUIS LE DERNIER TOUR
ÉLEVÉ** (`dernier_niveau_eleve_le`, réarmé à chaque rehausse — jamais mesuré depuis `debut`, sinon un
pic tardif s'éteint trop tôt) — jamais levé à vie, jamais éteint trop tôt. Les **seuils**
(`SEUIL_TOURS_SURS`, `DUREE_MIN_EPISODE_MS`, provisoires) vivent dans le **pur** `episode-detresse.ts`
et sont **passés en arguments** au SQL (jamais figés — AD-14). La transition est l'**unique** vérité
(le modèle TS n'en est PAS une réimplémentation — seuls les seuils y vivent).

**Posture RLS (AC3)** : server-authoritative, **deny-by-default** (RLS + FORCE, aucune policy —
patron `usage_ia`/`audit_securite`). Un épisode est une **décision serveur** : la cliente ne l'écrit
ni ne le lit jamais. Accès uniquement via fonctions `security definer`. **Repli sûr** (`depot-episode.ts`) :
une panne RPC ne plante jamais le tour et penche vers la protection (`limitesLevees = true` par défaut).

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
- `pipeline.ts` — sécurité-d'abord ; **seul appelant du détecteur** ; audit ; épisode ; veto.
- `episode-detresse.ts` — **pur** (Story 2.4) : les **seuils** d'extinction (source unique, passés en
  arguments au SQL) ; provisoires (porte clinique). La LOGIQUE de transition vit dans le SQL (unique vérité).
- `depot-episode.ts` — serveur (Story 2.4) : dépôt réel `episode_detresse` via fonctions security definer ;
  **seul appelant** de `enregistrer_tour_detresse` ; repli sûr sur panne.
- `journaliser-audit.ts` — écriture de l'audit détresse (service_role, best-effort, ne lève jamais).
- `mesure-rappel.ts` — **pur** : machine de mesure du rappel / des faux négatifs (FR-078).
- `ressources-aide.ts` — **pur** (Story 2.5) : la **source unique** des ressources d'aide (groupées par
  famille de danger) + la gouvernance FR-044 (« Vérifié le », revue trimestrielle assignée). PROVISOIRE (porte clinique).
- `limites-commerciales.ts` — serveur (Story 2.5) : le prédicat de **garde de montage** `limitesCommercialesLevees`
  (dérive de `episode_detresse.fin IS NULL` ; repli sûr → `true`, le doute suspend le commerce).
- `rpc-repli.ts` — serveur (Story 2.5) : le squelette partagé « RPC de sécurité sous admin + repli sûr + incident
  sans art. 9 » (DRY, consommé par `depot-episode` et `limites-commerciales`).

## Le filet hors-IA + la garde de montage (Story 2.5 ; AD-9, AD-15)

**Le filet ne dépend JAMAIS du classifieur ni du fournisseur IA.** Deux garanties indépendantes de toute détection :

- **`/aide` (halte statique, `app/aide`)** — publique, sans compte, sans paywall, sans traceur, **sans import
  `lib/ai`** (garde de test). Les ressources viennent de `ressources-aide.ts` (source unique), en fiches sobres
  (`surface-elevee`/`bordure-forte`) **jamais alarmantes**, groupées par famille de danger, énoncées chiffre par
  chiffre. La **porte de secours** (surimpression, Story 1.8) y mène en 2 gestes, `porteSecours: true` au type.
- **La garde de montage `limites_levees`** — dès un épisode ouvert (`fin IS NULL`), `limitesCommercialesLevees`
  renvoie vrai et le composant **`<GardeCommerciale>`** (`app/_commerce`) **refuse de monter** paywall / bandeau
  de quota / carte d'abonnement / **bilan** (FR-043), y compris sur un compte gratuit à quota épuisé. La **décision**
  vit dans `lib/safety` ; `render/` la **consomme** sans la dériver (muet, AD-7). Prédicat appelé **uniquement** par
  la garde (aucun consommateur sauvage), garde **prospective** qui rejette toute future UI commerciale non enveloppée.

**Dégradation gracieuse (AC5, AD-15).** Modèle fort indisponible → le repli sûr (2.3/2.4) pose déjà `limites_levees`
+ journalise un incident sans art. 9 ; le filet non-IA reste inconditionnel → **Anam ne quitte jamais**. L'insertion
VISIBLE des haltes DANS la conversation (niveaux 2-3, `15/112` en tête, **sortie rapide** FR-074) est la Story 2.6.

**Gouvernance FR-044 (hybride)** : la cadence trimestrielle est enforçée *structurellement* (test déterministe) ; la
**péremption réelle** logue un avertissement pendant le dev et devient **hard-break sous `PRELANCEMENT=1`** (CI de prod).
