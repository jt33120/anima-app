---
baseline_commit: 703856ef46bc4517783658812307fea61c362bbb
---

# Story 2.5: Le filet hors-IA, `/aide` et la garde des limites levées

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant qu'**utilisatrice**,
je veux des **ressources d'aide toujours joignables** et **indépendantes de toute détection**, et qu'**aucun commerce ne m'atteigne en détresse**,
afin que le filet de sécurité ne dépende **jamais** du classifieur ni du fournisseur IA, et que le drapeau `limites_levees` — que le pipeline expose déjà (Story 2.4) — devienne une **garde de montage réelle** que le paywall, le quota, la carte d'abonnement et le bilan seront **forcés** de respecter.

## Acceptance Criteria

Repris de l'épic (Story 2.5), découpés en critères testables. `Couvre : FR-043, FR-044, FR-077, AD-9, AD-15`.

1. **[AC1 — l'aide en deux gestes, indépendante de toute détection]** Étant donné n'importe quel écran, quand l'utilisatrice cherche de l'aide, alors la **porte de secours** de la surimpression persistante mène à `/aide` **en deux gestes** et **indépendamment de toute détection** (FR-077). *(La porte de secours est livrée par la Story 1.8, garantie au type `porteSecours: true`. L'**entrée « Aide et ressources », première du menu**, est une couture : le shell v1 est scène-first, sans menu global — 2.5 verrouille l'invariant « porte de secours toujours là, 2 gestes » et documente la convention « premier du menu » pour quand un menu existera.)*

2. **[AC2 — `/aide` publique, statique, sans dépendance IA]** Étant donné `/aide`, quand elle est ouverte, alors elle est atteignable **sans compte, sans paywall, sans traceur** (préservé de 1.8) **et** les ressources sont **statiques**, servies **sans dépendre du fournisseur IA** — la page n'importe **aucun** `lib/ai`, ne lit **aucune** session, n'appelle **aucun** classifieur (garde de test).

3. **[AC3 — le bloc ressources formalisé, vérifié, jamais alarmant]** Étant donné le bloc ressources, quand il s'affiche, alors il liste les numéros **vérifiés** **adaptés au danger** (**3114** · **15/112** · **3919** · **119** · SOS Amitié) en liens `tel:`, mis en forme en **fiche** (`surface-elevee` + `bordure-forte`), porte une date **« Vérifié le … »**, est **groupé/étiqueté par famille de danger**, et n'est **jamais rouge, jamais modal, jamais bloquant** ; chaque numéro est **lu chiffre par chiffre** (préservé de 1.8). La **gouvernance FR-044** est réelle : revue **trimestrielle**, **assignée** nommément, **tracée** — **un numéro périmé casse le build** (test de cadence). *(La liste et son adéquation par danger restent PROVISOIRES — porte pré-lancement clinique.)*

4. **[AC4 — la garde de montage `limites_levees`]** Étant donné `limites_levees` vrai, quand le paywall, le bandeau de quota, la carte d'abonnement ou le bilan tentent de se monter, alors ils **refusent de se monter** (garde technique), **y compris sur un compte gratuit à quota épuisé** (FR-043). *(Aucune UI commerciale n'existe encore — Epic 3 / Story 2.9. 2.5 livre le **prédicat serveur possédé** `limitesCommercialesLevees(id)` (dérivé de `episode_detresse.fin IS NULL`, repli sûr) **et** la **garde de montage réutilisable** `<GardeCommerciale>` que ces UI seront forcées d'envelopper — prouvés par test, exactement comme 2.4 a livré `branche_bloquee_par_detresse()` en couture d'Epic 4.)*

5. **[AC5 — dégradation gracieuse, Anam ne quitte jamais]** Étant donné le modèle fort indisponible pendant un épisode, quand la conversation continue, alors elle dégrade gracieusement mais **Anam ne quitte jamais** (tenu par le filet non-IA : `/aide` + porte de secours, statiques), le système **pose `limites_levees`** (repli sûr, acquis 2.3/2.4) **et** l'indisponibilité est un **incident journalisé** sans art. 9, **jamais** un échec silencieux. *(L'insertion visible des haltes DANS la conversation — bloc ressources ordonné aux niveaux 2-3, `15/112` en tête au niveau 3, **sortie rapide** FR-074 — relève de la Story 2.6 : 2.5 garantit le filet hors-IA inconditionnel et le drapeau serveur.)*

## Tasks / Subtasks

> **TDD strict (red → green → refactor).** Vitest est en env **node** (pas de DOM). Les gardes d'architecture se prouvent par lecture de fichier (patron `sansCommentaires`). Ne marquer une tâche `[x]` que lorsque ses tests EXISTENT et PASSENT à 100 %.

- [x] **T1 — La source unique des ressources + la gouvernance FR-044** (`lib/safety/ressources-aide.ts`, PUR) (AC: 3)
  - [x] RED : `tests/ressources-aide.test.ts` (pur, zéro I/O) — la liste porte les **6 ressources vérifiées** ; chacune a `famille` (∈ `suicide` · `urgence_vitale` · `violences_femmes` · `enfance` · `ecoute`), `numero`, `tel` (composable), `aria` **chiffre-par-chiffre** (`^\d( \d)+$`), `service` (nom lu avant les chiffres), `desc` ; les 5 familles de danger sont représentées ; `3114`, `3919`, `119`, `SOS Amitié` présents et **15 ET 112** présents. Gouvernance : `VERIFIE_LE` (ISO), `RESPONSABLE_REVUE` (nommé, non vide), `PROCHAINE_REVUE = VERIFIE_LE + 1 trimestre`.
  - [x] RED : **la garde de cadence FR-044** (« un numéro périmé est un défaut critique »), en **deux garde-fous** (décision Julian) :
    - **(a) cadence structurelle — toujours active, déterministe** : intervalle `VERIFIE_LE`→`PROCHAINE_REVUE` = un vrai trimestre (84–93 j) et `RESPONSABLE_REVUE` non vide. Zéro dépendance à l'horloge → jamais de faux rouge.
    - **(b) péremption réelle — dépend de la date, gradée** : `revuePerimee(now)` ; par défaut → **`console.warn` bruyant** si échue, **ne bloque JAMAIS** le build ; mais **`process.env.PRELANCEMENT === "1"`** → **hard-break** (message actionnable). Le flag `PRELANCEMENT` est posé dans la **porte pré-lancement / CI de prod**.
  - [x] GREEN : le module pur (`readonly`), aucun import React/Next/Supabase/infra (AD-1/AD-10 — vérifié par la garde d'archi T5).
  - [x] ⚠️ Marquer la **liste + l'adéquation par danger PROVISOIRES — porte pré-lancement clinique** (FR-044/FR-074, à valider par un professionnel qualifié).

- [x] **T2 — `/aide` : le bloc ressources formalisé + l'étanchéité du filet** (`app/aide/page.tsx`, `aide.module.css`) (AC: 1, 2, 3, 5)
  - [x] RED : étendre `tests/aide-route.test.ts` — `/aide` **consomme** `lib/safety/ressources-aide` (plus de liste inline) ; met en forme **fiche** (`surface-elevee` **et** `bordure-forte`) ; affiche **« Vérifié le … »** ; **groupe/étiquette par famille de danger** ; **jamais alarmant** (aucun `--alerte`/`--rouge`/`role="dialog"`/`aria-modal`/`<dialog`, CSS sans commentaires) ; n'importe **aucun** `@/lib/ai` ni SDK fournisseur (sans dépendance IA, AD-15) ; **préservé** : ni session ni auth ni traceur, `title:"Anam"`, ancre `#transparence`.
  - [x] GREEN : refactor `app/aide/page.tsx` (rend depuis le pur, sections par famille, « Vérifié le … ») + `aide.module.css` (fiche `surface-elevee`/`bordure-forte`, **sobre — jamais rouge/alerte/modale**). Décision documentée : **matcher `proxy.ts` inchangé** (voir Dev Notes — la page lit déjà zéro session ; la CSP reste, défense en profondeur).
  - [x] Vérifier AC1 (invariant porte de secours) : la garde `scene-surimpression`/type `porteSecours: true` tient (2 gestes vers `/aide`, indépendant de détection) — noter la couture « premier du menu ».

- [x] **T3 — Le prédicat de garde serveur `limitesCommercialesLevees` + l'util de repli partagé** (`lib/safety/limites-commerciales.ts`, `lib/safety/rpc-repli.ts`) (AC: 4, 5)
  - [x] RED : `tests/limites-commerciales.test.ts` (unit, admin mocké — patron `depot-episode.test.ts`) — `limitesCommercialesLevees(id)` appelle `episode_detresse_ouvert({ cible: id })` et renvoie son booléen (`fin IS NULL` ⇒ limites levées) ; **repli sûr (AD-15)** : panne RPC (erreur Supabase OU exception) → **`true`** (le doute **suspend** le commerce — jamais de paywall sur un possible épisode, FR-043) + **incident journalisé** sans art. 9 (code seul).
  - [x] GREEN : extraire `rpcAvecRepli` + `journaliserIncidentSecurite` de `depot-episode.ts` dans `lib/safety/rpc-repli.ts` (util `server-only` partagé — **DRY**, supprime la duplication) ; `depot-episode.ts` **et** `limites-commerciales.ts` l'importent. `limites-commerciales.ts` : `import "server-only"` + admin RPC, défaut sur échec = `true`. **Tests 2.4 (`depot-episode.test.ts`) restent verts** (comportement identique après extraction).

- [x] **T4 — La garde de MONTAGE réutilisable `<GardeCommerciale>`** (`render/commerce/GardeCommerciale.tsx`) (AC: 4)
  - [x] RED : `tests/garde-commerciale.test.ts` — (a) **comportement** : le composant (fonction serveur async) rend **`null` quand levées** (mock `limitesCommercialesLevees → true`) et **ses enfants quand faux** — « refuse de se monter » prouvé ; (b) **garde d'architecture (grep)** : la **décision** vit dans `lib/safety/limites-commerciales` (render **muet**, AD-7), et le prédicat n'a **aucun consommateur sauvage** ; (c) **garde prospective** : tout fichier `app/`/`render/` dont le nom marque une UI commerciale (`paywall|abonnement|quota|bilan|checkout|premium`) **doit** importer `GardeCommerciale` — **vide aujourd'hui**, **armée** pour 2.9/Epic 3 (log explicite).
  - [x] GREEN : `render/commerce/GardeCommerciale.tsx` (RSC async) — `const levees = await limitesCommercialesLevees(utilisatriceId); return levees ? null : <>{children}</>;`. Aucune règle métier dans le composant : il **consomme** le prédicat de `lib/safety`. Documenté comme le **seam de montage** que paywall/quota/carte/bilan (2.9, Epic 3) enveloppent.

- [x] **T5 — Gardes d'architecture, synthèse AC5, docs** (AC: 2, 4, 5)
  - [x] RED/GREEN : étendre `tests/pipeline-securite-architecture.test.ts` — (a) `app/aide/page.tsx` n'importe **aucun** `@/lib/ai` (filet **sans** fournisseur IA, AD-15) ; (b) `ressources-aide.ts` **pur** (aucun import runtime, pas de `server-only`, pas d'infra) ; (c) la **décision** `limites_levees` vit dans `lib/safety`, la garde de rendu la consomme sans la dériver (AD-7) ; (d) le prédicat `limitesCommercialesLevees` n'est appelé QUE par `GardeCommerciale` — pas d'appel sauvage (dans `garde-commerciale.test.ts`).
  - [x] AC5 (synthèse, prouvée par les tests existants + T3) : le repli (modèle fort indispo) **pose déjà `limites_levees=true`** (`depot-episode`/`limites-commerciales` repli → `true`) + **incident journalisé** (acquis 2.3/2.4) ; le filet non-IA (`/aide`, porte de secours) est **inconditionnel** (statique) → **Anam ne quitte jamais**. L'insertion des haltes **dans la conversation** (niveaux 2-3, `15/112` en tête, **sortie rapide** FR-074) est **Story 2.6** (documenté).
  - [x] Mettre à jour `lib/safety/README.md` (filet hors-IA, source unique des ressources, garde de montage + seam) et `deferred-work.md` (couture `<GardeCommerciale>` → 2.9/Epic 3 ; sortie rapide + haltes en conversation → 2.6 ; liste ressources PROVISOIRE + revue trimestrielle FR-044 ; **`PRELANCEMENT=1` en CI de prod** ; « premier du menu » quand un menu existera ; matcher `proxy.ts` inchangé).

- [x] **T6 — Validations complètes**
  - [x] `set -a && . ./.env.local && set +a && npx vitest run` (Supabase local démarré + migrations 0010/0011 appliquées) → **462 tests verts (50 fichiers)**.
  - [x] `npx tsc --noEmit` propre · `npx eslint .` propre · `npm run build` propre (`/aide` prerendered **static**, aucune route `_commerce`).
  - [x] Vérifier les 5 ACs un par un ; noté dans *Completion Notes*.

## Dev Notes

### La frontière — ce que 2.5 possède, ce qu'elle NE fait PAS

| Concern | Story | 2.5 en fait… |
|---|---|---|
| Porte de secours (surimpression, 2 gestes, type `porteSecours: true`) | **1.8 (fait)** | rien — invariant préservé + garde |
| `/aide` publique/statique + transparence art. 50 + numéros `tel:` chiffre-par-chiffre | **1.8 (fait)** | **enrichit** : fiche, « vérifié le », groupé par danger |
| **La source unique des ressources + gouvernance FR-044 (trimestrielle, tracée)** | **2.5 (ici)** | **tout** : `lib/safety/ressources-aide.ts` pur + garde de cadence |
| **Le prédicat serveur `limitesCommercialesLevees` (dérive de `fin IS NULL`, repli sûr)** | **2.5 (ici)** | **tout** |
| **La garde de montage `<GardeCommerciale>`** (paywall/quota/carte/bilan refusent de monter) | **2.5 (ici)** | **livre le seam** — prouvé par test, inerte jusqu'à son consommateur |
| Poser `limites_levees` au repli + incident journalisé | **2.3/2.4 (fait)** | rien — préservé (AC5 s'appuie dessus) |
| La **réponse** par niveaux, bloc ressources ORDONNÉ en conversation, **sortie rapide** (FR-074) | **2.6** | rien — frontière explicite |
| Le **placement** réel du paywall sous le bilan (qui appellera `<GardeCommerciale>`) | **2.9** | rien — seam posé |
| L'intégration **Stripe** (paywall/quota/carte réels) | **Epic 3** | rien — seam posé |

**Anti-front-running (identique à 2.3/2.4).** Aucune UI commerciale n'existe (paywall/quota/carte/bilan = Epic 3 / 2.9). 2.5 livre **le filet hors-IA formalisé** et **la garde de montage possédée**, prouvés par test et **inertes jusqu'à leur consommateur**. C'est exactement le geste de 2.4 (`branche_bloquee_par_detresse()` livré en couture d'Epic 4).

### Le point de départ : `limites_levees` est DÉJÀ exposé (Story 2.4)

Le pipeline retourne déjà l'état, la route l'a sous la main — **rien à recâbler côté détection** :
```ts
// lib/safety/pipeline.ts (2.4)
export type ResultatSecurite =
  | { bloque: false; verdict: VerdictSecurite; limitesLevees: boolean }  // ← dérive de fin IS NULL
  | { bloque: true; raison: RaisonRefus };
// app/api/anam/message/route.ts (2.4) : « securite.limitesLevees est DISPONIBLE ici — la garde de MONTAGE est la Story 2.5 »
```
Et la **fonction SQL de lecture existe** (migration 0010) : `episode_detresse_ouvert(cible uuid)` renvoie `fin IS NULL` = `limites_levees`, **granted `service_role`** (lue côté serveur sous client admin). 2.5 n'ajoute **aucune** migration : elle **consomme** l'entité de 2.4.

**Ce que 2.5 ajoute** — un prédicat serveur nommé pour le **montage** (distinct du calcul par-tour du pipeline) et la garde UI qui le consomme :
```ts
// lib/safety/limites-commerciales.ts (server-only)
export async function limitesCommercialesLevees(utilisatriceId: string): Promise<boolean>;
//   → episode_detresse_ouvert(cible) sous admin ; repli sûr : panne → true (le doute suspend le commerce)
// render/commerce/GardeCommerciale.tsx (RSC async)
//   → const levees = await limitesCommercialesLevees(id); return levees ? null : <>{children}</>;
```

### La garde de montage (AC4) — pourquoi un prédicat + un composant

- **Le prédicat** (`lib/safety`) porte la **décision** (AD-9/AD-10 : « Paywall/abonnement | app/, Stripe, `lib/safety/` (garde) »). Il dérive de la **même** vérité que 2.4 (`fin IS NULL`) — **jamais** une seconde horloge. Repli sûr (AD-15) : sur panne il renvoie **`true`** (protège), le **contraire** d'un fail-open qui laisserait un paywall frapper un épisode invisible.
- **Le composant** (`render/commerce`) est le **seam de montage** : AC4 dit « refusent de **se monter** » — un composant qui *gate le montage* est l'artefact naturel et testable. `render/` reste **muet** (AD-7) : il ne calcule rien, il **consomme** le booléen de `lib/safety`. Une garde d'archi le prouve.
- **La garde prospective** (grep) : tout futur `paywall|bandeau-quota|carte-abonnement|bilan` DEVRA importer `<GardeCommerciale>` — vide aujourd'hui, **armée** pour que 2.9/Epic 3 ne puisse pas monter une UI commerciale en oubliant la garde. Miroir exact des gardes d'archi de 2.4.

**Testabilité de la RSC** : un Server Component async est **une fonction async** — le test l'`await` directement (`await GardeCommerciale({ utilisatriceId, children })`) et vérifie qu'elle renvoie `null` (levées) vs `children` (faux), en mockant `limitesCommercialesLevees`. Pas de DOM requis (comme `depot-episode.test.ts` mocke l'admin).

### Le bloc ressources (AC3) — fiche, « vérifié le », adapté au danger

**Source unique pure** `lib/safety/ressources-aide.ts` (extrait de l'inline actuel de `aide/page.tsx`, revue 1.8 trouvaille [11] : `service` lu avant les chiffres, `aria` chiffre-par-chiffre). Groupé par **famille de danger** (FR-074, présentation STATIQUE — la sélection DYNAMIQUE par danger détecté est 2.6) :

| Famille | Ressource | `tel:` |
|---|---|---|
| `suicide` | 3114 — Prévention du suicide (gratuit, 24h/24) | `3114` |
| `urgence_vitale` | 15 (SAMU) · 112 (urgence européenne) | `15` · `112` |
| `violences_femmes` | 3919 — Violences faites aux femmes (anonyme, gratuit) | `3919` |
| `enfance` | 119 — Enfance en danger | `119` |
| `ecoute` | SOS Amitié — écoute, tous les jours | `0972394050` |

**Mise en forme** : fiche `surface-elevee` + `bordure-forte`, **sobre** — **jamais** rouge, `--alerte`, modale ni bloquante (AD-9 : le filet rassure, il n'alarme pas). Chaque numéro `tel:`, énoncé chiffre-par-chiffre. En-tête « **Vérifié le {VERIFIE_LE}** ».

**Gouvernance FR-044 (complétée PRD)** : la revue est **trimestrielle**, **assignée nommément**, **tracée** ; chaque numéro revérifié à cette occasion ; *« un numéro périmé ici est un défaut critique »*. → `VERIFIE_LE`, `PROCHAINE_REVUE` (= +1 trimestre), `RESPONSABLE_REVUE` dans le pur, et une **garde de cadence** qui **casse le build quand la revue est périmée**.

> **Garde de péremption — hybride à deux garde-fous (décision Julian, 2026-07-28).** FR-044 fait d'un numéro périmé un « défaut critique », mais un hard-break piloté par l'horloge casserait le build en plein dev d'une autre story (~3 mois). Compromis on-spec **sans** friction : **(a)** la **cadence trimestrielle** est enforçée *structurellement* (`PROCHAINE_REVUE − VERIFIE_LE ≤ 92 j`), déterministe, toujours verte ; **(b)** la **péremption réelle** logue un `console.warn` bruyant par défaut (jamais bloquante) et devient **hard-break dès `PRELANCEMENT=1`** — flag posé dans la porte pré-lancement / CI de prod. La rigueur « défaut critique » est ainsi **garantie avant la mise en ligne**, jamais une surprise pendant le dev. À noter dans `deferred-work.md` (porte pré-lancement : poser `PRELANCEMENT=1` en CI de prod).

### AC5 — dégradation gracieuse : ce qui est DÉJÀ acquis, ce que 2.5 prouve

Le repli sûr est **construit en 2.3/2.4** ; 2.5 ne le réécrit pas, il le **prouve** et l'**assemble** :
- **Modèle fort indispo** → `detecteur-detresse` renvoie un **repli sûr** (niveau plancher qui engage les haltes) + **incident journalisé** sans art. 9 (jamais de re-tentative au léger, AD-5) — acquis 2.3.
- **Panne du dépôt d'épisode** → `depot-episode` repli → **`limitesLevees = true`** + incident — acquis 2.4. Donc pendant une panne, `limitesCommercialesLevees` (T3, même patron) renvoie aussi **`true`** : **aucun commerce** ne s'interpose.
- **Anam ne quitte jamais** → le filet non-IA (`/aide` statique + porte de secours) est **inconditionnel**, ne dépend d'**aucun** modèle (AD-15). Garde de test : `/aide` n'importe aucun `lib/ai`.
- **Ce qui reste 2.6** : l'insertion VISIBLE des haltes dans le fil de conversation (bloc ressources ordonné, `15/112` en tête au niveau 3, **sortie rapide** FR-074), car elle est indissociable de la **réponse par niveaux** (Story 2.6, `Couvre : FR-074`).

### Décision : matcher `proxy.ts` INCHANGÉ (challenge de la note 1.8)

La note 1.8 suggérait d'exclure `/aide` du matcher « si souhaité ». **Je ne le fais pas** : (1) `aide/page.tsx` ne lit **aucune** session (prouvé par test) — « atteignable connectée ou non » tient déjà ; (2) **aucun traceur/analytics** n'existe dans le repo — « sans traceur » est déjà vrai ; (3) le rafraîchissement de session du proxy est un **no-op first-party** pour une visiteuse déconnectée, **pas** un traceur ; (4) exclure `/aide` lui ferait **perdre la CSP** de page (défense en profondeur, `deferred-work` l.53). Le coût (CSP perdue) dépasse le gain (nul). Décision enregistrée en Completion Notes.

### Ce qui doit être préservé (ne rien casser)

- **Story 1.8** : `/aide` publique/statique, `title:"Anam"`, ancre `#transparence`, porte de secours type `porteSecours: true`, doublage chiffre-par-chiffre (`aria`/`service`). Les tests `aide-route`/`scene-surimpression`/`identite-route` restent verts.
- **Story 2.4** : `depot-episode.ts` — l'extraction de `rpcAvecRepli`/`journaliserIncidentSecurite` vers `rpc-repli.ts` doit être **iso-comportement** (les 6 tests `depot-episode.test.ts` restent verts sans modification de leurs assertions).
- **Story 2.3/2.4** : pipeline, route, `limites_levees` exposé — 2.5 ne touche PAS au pipeline ni à la détection. **438 tests verts** au départ.
- **Conventions art. 9** : `service_role` = tâche système (le prédicat de garde lit sous admin, comme le dépôt) ; jamais de contenu art. 9 en log (incident = code seul).

### Pièges (revue adversariale probable)

1. **Fail-OPEN de la garde de montage** : sur panne, renvoyer `false` (commerce autorisé) frapperait un épisode invisible. → **repli = `true`** (suspend le commerce), symétrique au dépôt 2.4.
2. **Deuxième horloge pour `limites_levees`** : dériver d'autre chose que `fin IS NULL` (ex. la fenêtre 72 h) romprait AD-17. `limites_levees` = **ouvert seulement** ; la fenêtre 72 h ne gouverne QUE la garde de branche (2.4).
3. **`render/` qui décide** : mettre la logique `fin IS NULL` dans la RSC viole AD-7. La décision vit dans `lib/safety` ; la RSC consomme le booléen.
4. **Bloc ressources alarmant** : rouge/`--alerte`/modale contredit AC3 (« jamais rouge, jamais modal, jamais bloquant ») — garde de test.
5. **Sélection dynamique par danger dans `/aide`** : hors périmètre (2.6). `/aide` présente TOUTES les familles, statiquement.
6. **`/aide` qui importe `lib/ai`** (ou tout SDK) : romprait « sans fournisseur IA » (AD-15). Garde de test.
7. **Extraction `rpc-repli` qui change le comportement du dépôt 2.4** : garder l'API et les journaux identiques (les tests 2.4 sont le filet).
8. **Péremption FR-044 qui casse le build en plein dev** : la garde par horloge est *non-bloquante par défaut* (warn) et ne devient hard-break que sous `PRELANCEMENT=1` ; la cadence trimestrielle, elle, est enforçée structurellement (déterministe). Ne pas inverser (un hard-break inconditionnel sur l'horloge sabote le dev).

### Project Structure Notes

- **Nouveaux** : `lib/safety/ressources-aide.ts` (pur), `lib/safety/limites-commerciales.ts` (server-only), `lib/safety/rpc-repli.ts` (server-only, util partagé), `render/commerce/GardeCommerciale.tsx` (RSC), `tests/ressources-aide.test.ts` (pur), `tests/limites-commerciales.test.ts` (unit), `tests/garde-commerciale.test.ts` (unit + grep).
- **Modifiés** : `app/aide/page.tsx` (consomme le pur, fiche, « vérifié le », groupé), `app/aide/aide.module.css` (fiche `surface-elevee`/`bordure-forte`, sobre), `lib/safety/depot-episode.ts` (importe `rpc-repli` — DRY), `tests/aide-route.test.ts` (fiche/date/sans-IA/jamais-alerte), `tests/pipeline-securite-architecture.test.ts` (+ gardes 2.5 filet/garde), `lib/safety/README.md`, `_bmad-output/implementation-artifacts/deferred-work.md`.
- Alignement couches (AD-1/AD-10) : pur `ressources-aide` ; serveur `limites-commerciales`/`rpc-repli` (→ `lib/data/supabase/admin`) ; `render/commerce` consomme `lib/safety` (jamais l'inverse). `app/aide` = halte (AD-10 : « Détresse, haltes, `/aide` | `lib/safety/`, `app/aide/` »). Aucune remontée d'infra dans le pur.

### Testing standards

- **Runner** : Vitest env **node**. `set -a && . ./.env.local && set +a && npx vitest run` (Vitest ne lit pas `.env.local`).
- **Pur** (`ressources-aide.test.ts`) : zéro I/O ; tables de vérité des familles + cadence FR-044 (dont la garde périmée par date réelle).
- **Unit mock admin** (`limites-commerciales.test.ts`, `garde-commerciale.test.ts`) : patron `depot-episode.test.ts` (`vi.mock('@/lib/data/supabase/admin')`). La RSC async se teste en l'appelant comme une fonction et en mockant le prédicat.
- **Garde d'architecture** : lecture de fichier (`sansCommentaires`) — cibler les imports/appels avec `(` (angles morts des commentaires). Aucune migration SQL nouvelle (2.5 consomme 0010/0011).
- **Non couvrable en node** (à noter, non bloquant) : le rendu DOM réel de la fiche `/aide`, la présence visuelle de la porte de secours au clavier (déjà porté par `scene-accessibilite`/`surimpression` de 1.7/1.8).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-2.5] (l. 620–634) — les 5 ACs, `Couvre : FR-043, FR-044, FR-077, AD-9, AD-15`, porte pré-lancement (liste des ressources à valider par un pro, revue périodique).
- [Source: ARCHITECTURE-SPINE.md#AD-9] — haltes toujours joignables ; `/aide` sans compte/paywall/traceur ; dès niveau 1, `limites_levees` posé pour l'épisode → **paywall + bandeau quota + carte abonnement + bilan refusent de se monter** (garde technique, FR-043), y compris compte gratuit à quota épuisé ; Anam ne quitte jamais.
- [Source: ARCHITECTURE-SPINE.md#AD-15] — filet **statique** hors-IA (ressources + `/aide`), servi **sans dépendre du fournisseur IA** ; repli sûr : force l'affichage des haltes + pose `limites_levees` ; indisponibilité = **incident journalisé**, jamais silencieux.
- [Source: ARCHITECTURE-SPINE.md#AD-17] — `limites_levees` dérive de `fin IS NULL` (source unique) ; jamais une seconde horloge.
- [Source: ARCHITECTURE-SPINE.md#AD-10] — « Détresse, haltes, `/aide` | `lib/safety/`, `app/aide/` » ; « Paywall/abonnement | `app/`, Stripe, `lib/safety/` (garde) ».
- [Source: ARCHITECTURE-SPINE.md#AD-7] — `render/` **muet** : consomme, ne décide rien (la garde consomme le booléen de `lib/safety`).
- [Source: prd.md] — **FR-043** (l.135, aucun paywall/limite/sollicitation en détresse, y compris compte gratuit à quota épuisé) · **FR-044** (l.136 + review-securite-conformite « revue **trimestrielle**, assignée, tracée ; chaque numéro revérifié ») · **FR-077** (l.142, ressources accessibles en permanence hors conversation, indépendantes du classifieur) · **FR-074** (l.139, dangers non suicidaires + ressource correspondante → **Story 2.6**).
- [Source: 1-8-surimpression-persistante-mention-ia-aide.md] (l.55, l.112, l.231) — scope différé À 2.5 : fiche `surface-elevee`/`bordure-forte`, « vérifié le … », revue FR-044, garde `limites_levees` ; la **sortie rapide FR-074** et l'adaptation niveaux 2-3 sont réassignées à **2.6** (leur FR y est mappé).
- [Source: 2-4-…-episode-detresse.md + deferred-work.md l.17] — `limites_levees` = `fin IS NULL`, exposé par le pipeline, **consommé en 2.5** ; `episode_detresse_ouvert(cible)` (service_role) disponible.
- Patrons de code : `lib/safety/depot-episode.ts` (repli sûr, `rpcAvecRepli` à extraire), `tests/depot-episode.test.ts` (mock admin), `tests/aide-route.test.ts` + `app/aide/page.tsx` (halte statique 1.8), `tests/pipeline-securite-architecture.test.ts` (gardes par grep), `render/surimpression.tsx` + `lib/scene/surimpression.ts` (porte de secours type `porteSecours: true`).

## Dev Agent Record

### Agent Model Used

Opus 4.8 (1M context) — dev-story TDD.

### Debug Log References

- **Faux positif de garde CSS** (T2) : la regex « jamais rouge/alerte » attrapait `--alerte` dans un COMMENTAIRE de doc. Corrigé en retirant les commentaires CSS avant l'assertion (patron `sansCommentaires`).
- **Régression `scene-architecture` → déplacement du composant** (T4/T6) : `<GardeCommerciale>`, d'abord placé dans `render/commerce/`, a fait échouer la garde « `render/` n'importe pas `lib/safety` » (AD-7). C'était le bon garde-fou : AD-10 place la garde commerciale dans `app/`. Déplacé en **`app/_commerce/GardeCommerciale.tsx`** (dossier privé, aucune route). Aucune autre anomalie.

### Completion Notes List

- **T1** — `lib/safety/ressources-aide.ts` (pur) : source unique des 6 ressources vérifiées, groupées par **famille de danger** (`suicide`/`urgence_vitale`/`violences_femmes`/`enfance`/`ecoute`), doublage vocal chiffre-par-chiffre. Gouvernance FR-044 : `VERIFIE_LE`/`PROCHAINE_REVUE`/`RESPONSABLE_REVUE` + `revuePerimee()` pur. Liste **PROVISOIRE** (porte clinique). 8 tests purs.
- **T2** — `/aide` refondue : consomme le pur (plus de liste inline), fiche `surface-elevee`/`bordure-forte` **sobre** (jamais rouge/alerte/modale), « Vérifié le … », groupée par famille. `aide-route.test.ts` étendu (13 tests) : sans session/auth/traceur, **sans `lib/ai`**, chiffre-par-chiffre déplacé côté module. Décision : **matcher `proxy.ts` inchangé** (la page lit déjà zéro session ; garder la CSP de défense en profondeur).
- **T3** — `lib/safety/limites-commerciales.ts` (`server-only`) : `limitesCommercialesLevees(id)` dérive de `episode_detresse_ouvert` (= `fin IS NULL`), **repli sûr → `true`** (le doute suspend le commerce, FR-043). Extraction DRY de `rpcAvecRepli`/`journaliserIncidentSecurite` vers `lib/safety/rpc-repli.ts` (partagé avec le dépôt 2.4, **iso-comportement** — 6 tests `depot-episode` inchangés verts). 4 tests.
- **T4** — `app/_commerce/GardeCommerciale.tsx` (RSC async) : **refuse de monter** (`null`) tant que `limites_levees` ; consomme le prédicat (render muet, AD-7). `garde-commerciale.test.ts` : comportement (null/enfants) + décision dans `lib/safety` + **aucun consommateur sauvage** + **garde prospective** (toute UI `paywall|abonnement|quota|bilan|checkout|premium` devra l'importer — 0 aujourd'hui, armée pour 2.9/Epic 3). 5 tests.
- **T5** — gardes d'archi 2.5 (pureté `ressources-aide`, `/aide` sans-IA, décision `limites_levees` dans `lib/safety`). AC5 : le repli **pose déjà `limites_levees`** + incident (2.3/2.4), le filet non-IA est inconditionnel → **Anam ne quitte jamais** ; haltes en conversation + **sortie rapide FR-074** = Story 2.6. README + `deferred-work.md` mis à jour.
- **T6** — **462 tests verts (50 fichiers)** · `tsc --noEmit` propre · `eslint` propre · `next build` propre (`/aide` **static**, aucune route `_commerce`).
- **ACs couverts** : AC1 (porte de secours 2 gestes préservée, `porteSecours: true` ; menu = seam documenté) ✅ · AC2 (`/aide` static/publique, sans compte/traceur/IA) ✅ · AC3 (fiche vérifiée, groupée par danger, jamais alarmante, chiffre-par-chiffre ; gouvernance FR-044 hybride) ✅ · AC4 (prédicat serveur + garde de montage `<GardeCommerciale>`, repli protecteur, seam 2.9/Epic 3) ✅ · AC5 (repli pose `limites_levees` + incident, filet non-IA inconditionnel) ✅.
- **Décision hybride FR-044 (validée Julian)** : cadence trimestrielle enforçée structurellement (déterministe) ; péremption réelle = warn pendant le dev, **hard-break sous `PRELANCEMENT=1`** (CI de prod, porte pré-lancement).
- **Aucune migration SQL** : 2.5 consomme `episode_detresse` de 2.4 (0010/0011). Rien à déployer côté cloud.

### Revue de code max-effort (2026-07-28) — 10 angles, vérif adversariale, sweep (36 agents, 1,68M tokens)

**31 candidats → 17 survivants → 7 défauts réels après dédup** (les survivants étaient surtout des re-découvertes de R1 ×6 et R2 ×6). Tous corrigés :

- **R1 [CONFIRMED, CRITIQUE — test-coverage]** La garde prospective matchait le **basename** (`f.split('/').pop()`) → toujours `page.tsx` en App Router : une future `app/abonnement/page.tsx` (marqueur dans le **dossier**) échappait à la garde → AC4/FR-043 non tenue. → **match du chemin complet** (`MARQUEURS.test(f)`) + exige la **balise** `<GardeCommerciale` (pas une simple mention) + assertions positives non-tautologiques (`app/(scene)/abonnement/page.tsx` ⇒ vrai, `app/aide/page.tsx` ⇒ faux).
- **R2 [CONFIRMED — correctness/tz]** `verifieLeLibelle` : `new Date("2026-07-28")` = minuit **UTC** + `toLocaleDateString` sans `timeZone` → « Vérifié le 27 » sur un build derrière UTC. → **ancré UTC** (`…T00:00:00Z` + `timeZone:"UTC"`), aligné sur la convention du repo (`naissance/age.ts`).
- **R3 [CONFIRMED — a11y]** Chaque groupe = `<section aria-label>` + `<h2>` identique → 7 landmarks « region », double annonce. → **aria-label retiré** des sections de groupe (le `<h2>` structure).
- **R4 [CONFIRMED — test-coverage]** La garde « jamais rouge » ne bloquait que `red`/`#ff0000` (laissait passer `#e53e3e`, `crimson`, `rgb(255,0,0)`…). → **rejet de TOUTE couleur brute** (hex/rgb/hsl/nom) — le filet n'utilise que des tokens `var(--…)`.
- **R5 [CONFIRMED — observabilité]** L'incident de la branche `if (error)` était journalisé **sans code d'erreur** (une suspension commerciale globale = indiagnosticable). → `journaliserIncidentSecurite` reçoit et logue le **code Postgres** (erreur Supabase, pas une `Error`) — toujours sans art. 9.
- **R6 [PLAUSIBLE → corrigé — altitude/reuse]** La dérivation `episode_detresse_ouvert` était **dupliquée** (garde + dépôt 2.4) → risque de désync **fail-open** sur l'invariant le plus critique. → **source unique** `lib/safety/episode-lecture.ts` (`episodeDetresseOuvert`), consommée par le dépôt ET la garde — impossible à désynchroniser.
- **R7 [CONFIRMED, sweep — a11y]** `.numero` sans `min-width` → cible tactile de « 15 »/« 119 » < 44 px. → **`min-width: var(--cible-tactile)`**.
- **Limite acceptée (finding « mention vs enveloppement »)** : la garde prospective exige désormais la balise `<GardeCommerciale`, mais un placement en frère reste théoriquement possible — c'est un **tripwire**, pas une preuve formelle ; l'enveloppement réel relève de la revue (documenté dans le test).
- **Post-fix** : **462 tests verts (50 fichiers)**, tsc/eslint/build propres.

### File List

**Nouveaux**
- `lib/safety/ressources-aide.ts` — source unique des ressources (pur) + gouvernance FR-044 (date ancrée UTC en revue)
- `lib/safety/limites-commerciales.ts` — prédicat de garde de montage (server-only ; délègue à `episode-lecture` en revue)
- `lib/safety/episode-lecture.ts` — **source unique** de la lecture « épisode ouvert ? » (revue R6 : partagée dépôt + garde, anti-désync)
- `lib/safety/rpc-repli.ts` — util partagé « RPC de sécurité + repli sûr + incident » (extrait de 2.4, DRY ; logue le code Postgres en revue)
- `app/_commerce/GardeCommerciale.tsx` — garde de montage réutilisable (RSC ; déplacée depuis `render/` pour AD-7/AD-10)
- `tests/ressources-aide.test.ts` — 8 tests (familles, chiffre-par-chiffre, cadence FR-044 hybride)
- `tests/limites-commerciales.test.ts` — 4 tests (dérivation + repli sûr protecteur)
- `tests/garde-commerciale.test.ts` — 5 tests (comportement + archi + garde prospective)

**Modifiés**
- `app/aide/page.tsx` — consomme le pur, fiche, « Vérifié le », groupé par danger (plus de liste inline)
- `app/aide/aide.module.css` — fiche `surface-elevee`/`bordure-forte`, sobre (jamais alarmante)
- `lib/safety/depot-episode.ts` — importe `rpc-repli` (retrait des copies inline, iso-comportement)
- `tests/aide-route.test.ts` — refonte 2.5 (consommation du module, fiche, sans-IA, jamais alarmant)
- `tests/pipeline-securite-architecture.test.ts` — + gardes d'architecture 2.5 (pureté, filet sans-IA, décision `lib/safety`)
- `lib/safety/README.md` — section filet hors-IA + garde de montage
- `_bmad-output/implementation-artifacts/deferred-work.md` — coutures 2.5 (GardeCommerciale, sortie rapide 2.6, FR-044/`PRELANCEMENT`, menu, proxy)

## Change Log

| Date | Version | Description | Author |
|---|---|---|---|
| 2026-07-28 | v0.1 | create-story — contexte d'implémentation complet (filet hors-IA formalisé, prédicat `limites_levees` + garde de montage `<GardeCommerciale>` en couture 2.9/Epic 3, gouvernance FR-044 hybride). Décision Julian sur la garde FR-044 (hybride). Status `ready-for-dev`. | Julian (create-story) |
| 2026-07-28 | v1.0 | dev-story — implémentation TDD complète (T1-T6). Source unique ressources + fiche `/aide`, prédicat `limitesCommercialesLevees` (repli sûr) + `rpc-repli` (DRY), garde de montage `<GardeCommerciale>` (déplacée `render/`→`app/_commerce` pour AD-7/AD-10). 462 tests verts, tsc/eslint/build propres. Status `review`. | Opus 4.8 (dev-story) |
| 2026-07-28 | v1.1 | revue max-effort (36 agents) : 7 défauts corrigés — R1 garde prospective aveugle aux routes App Router (**critique**, chemin complet + balise), R2 date ancrée UTC, R3 landmarks a11y redondants, R4 garde couleur (tokens only), R5 incident avec code Postgres, R6 source unique `episode-lecture` (anti-désync fail-open), R7 cible tactile ≥ 44 px. 462 tests verts, tsc/eslint/build propres. | Opus 4.8 (revue) |
