---
baseline_commit: d8129378366762c00ff5a1c029701c385fa1e98b
---

# Story 2.6: La réponse de détresse par niveaux, où Anam ne quitte jamais

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

En tant qu'**utilisatrice en détresse**,
je veux qu'Anam **reste, nomme ce qu'elle a entendu et me donne les bons numéros** sans dramatiser ni m'abandonner,
afin de me sentir accompagnée et non expédiée — la **forme** de sa réponse s'adaptant au niveau (`decision` déjà produite par le pipeline 2.3), et les **ressources adaptées au danger** s'insérant dans le fil (niveau 2 après son tour, niveau 3 vital **avant**, `15/112` en tête), sans qu'aucune mécanique ne s'interpose jamais.

## Acceptance Criteria

Repris de l'épic (Story 2.6), découpés en critères testables. `Couvre : FR-038, FR-039, FR-040, FR-041, FR-045, FR-074, FR-075, FR-076, AD-16, AD-5 ; UX-DR : bloc ressources.`

1. **[AC1 — bascule non annoncée aux niveaux 0-1, parole ouverte aux 2-3]** Étant donné les quatre niveaux, quand le niveau évolue, alors la bascule est **non annoncée aux niveaux 0 et 1** (Anam devient plus douce, **aucun élément ajouté au DOM** du fait du protocole) **et** Anam **parle ouvertement aux niveaux 2 et 3** — elle **nomme** et **demande directement**, sans détour ni dramatisation (FR-038, FR-040). *La forme dérive de `securite.verdict.decision` (`poursuivre|adoucir|intervenir|urgence|repli_sur`, déjà produit par 2.3) injectée en **consigne système** de la réponse — jamais une seconde classification.*

2. **[AC2 — Anam ne quitte jamais, composeur actif au focus, jamais soignante]** Étant donné un signal de détresse, quand Anam répond, alors elle **ne quitte jamais la conversation** (FR-039 — pas de « je ne peux pas t'aider, contacte un pro » suivi d'une fermeture), le **composeur reste actif et gardé au focus** (préservé — le `<textarea>` n'est jamais `disabled`/masqué) **et** elle **ne se présente jamais comme une professionnelle de santé** et ne prétend pas prendre en charge (FR-041).

3. **[AC3 — jamais les moyens, chercher un humain proche]** Étant donné un échange en détresse, quand Anam parle, alors elle **n'explore jamais les détails d'un plan ou des moyens** (ni comment, ni avec quoi, ni quand — FR-075) **et** elle cherche un **humain proche** : quelqu'un à appeler ou rejoindre maintenant, et l'y encourage (FR-076). *(Interdits durs de la consigne système, prouvés par le **contenu** du module pur.)*

4. **[AC4 — dangers non suicidaires + bloc ressources placé par niveau]** Étant donné un **danger non suicidaire** (violences en cours, danger pour un enfant, emprise), quand il est détecté, alors le protocole s'applique avec les **ressources correspondantes** (FR-074) **et** au **niveau 3 avec danger vital**, le **bloc ressources est inséré AVANT le tour d'Anam, `15/112` en tête** ; au **niveau 2**, le bloc s'insère **APRÈS** son tour (UX-DR). Le bloc est un **`article` dans le flux** — `surface-elevee` + `bordure-forte`, liens `tel:` **lus chiffre par chiffre**, date « Vérifié le … » —, **jamais rouge, jamais modal, jamais bloquant, jamais de pictogramme de danger**. *(La **sortie rapide** en tête de `/aide` — navigue vers un site neutre + remplace l'historique, pratique standard des pages violences, FR-074 — est livrée ici.)*

5. **[AC5 — le lendemain juste]** Étant donné le lendemain d'un épisode, quand Anam reprend le fil, alors elle **ne revient pas lourdement** dessus mais ne fait pas comme si rien ne s'était passé (FR-045) — **en une phrase, sans bandeau, sans « suivi », sans carte « comment vas-tu »**. *(⚠️ La reprise « le lendemain » **dépend de la mémoire de conversation (Epic 4)** et la suppression de la notif du socle **dépend de l'Ordonnanceur (non bâti)** : 2.6 livre le **prédicat de récence** `episodeRecemmentClos()` en **couture inerte** et l'**interdit d'interface** (aucun bandeau/carte de reprise ne peut se monter), et **défère le comportement** — Décision D3, **validée**.)*

## Tasks / Subtasks

> **TDD strict (red → green → refactor).** Vitest est en env **node** (pas de DOM). Les gardes d'architecture et de contenu se prouvent par **lecture de fichier** (patron `sansCommentaires` de `pipeline-securite-architecture.test.ts`) ; le rendu DOM réel est une **porte pré-lancement** (vérif navigateur), prouvé en CI par cœurs purs + gardes statiques (comme la vue conversation 2.2). Ne marquer une tâche `[x]` que lorsque ses tests EXISTENT et PASSENT à 100 %.
>
> **⚠️ Porte pré-lancement clinique + juridique (héritée de 2.3/§5) :** les **formulations de réponse**, le **seuillage/étiquetage des niveaux et familles de danger**, et la **sortie rapide** sont l'**intention produit**, PAS un protocole clinique validé. Tout contenu textuel de détresse et l'adéquation des ressources par danger sont **PROVISOIRES — à valider par un professionnel qualifié et un juriste avant mise en ligne sur données réelles**. On code la MACHINE ; pas le jugement clinique.

- [x] **T1 — La consigne de réponse par niveau (module PUR)** (`lib/safety/consigne-detresse.ts`) (AC: 1, 2, 3)
  - [x] RED : `tests/consigne-detresse.test.ts` (pur, zéro I/O) — `consigneReponse(verdict): MessageIa | null` :
    - `decision === "poursuivre"` (niveau 0) → **`null`** (Anam reste elle-même ; aucune consigne ajoutée — AC1).
    - `"adoucir"` (niveau 1) → consigne **non annoncée** : reste, écoute, **ne pousse plus**, aucun dispositif nommé (FR-038).
    - `"intervenir"` (niveau 2) → **nomme + demande directement** (FR-040), donne le **3114** dans le fil.
    - `"urgence"` (niveau 3) → parle ouvertement, oriente vers l'urgence.
    - `"repli_sur"` → **au moins aussi protecteur** que `adoucir` (le doute protège — AD-15).
    - **Interdits durs présents dans TOUTE consigne ≥ 1** (assertions de contenu) : ne quitte jamais (FR-039) · jamais « professionnel de santé »/prise en charge (FR-041) · **jamais** le plan ni les moyens — « ni comment, ni avec quoi, ni quand » (FR-075) · cherche un **humain proche** à appeler/rejoindre maintenant (FR-076) · aucune promesse (« ça va aller ») · aucun vocabulaire médical.
  - [x] GREEN : module `server-only`-**libre** et PUR (aucun import runtime hors `import type`, aucun React/Next/Supabase/`@/lib/data`/`@/lib/ai` runtime — vérifié par la garde d'archi T8). Retourne un `MessageIa` `{ role: "system", content }`.
  - [x] ⚠️ Marquer le **contenu PROVISOIRE — porte pré-lancement clinique** (les *Formulations de référence* du PRD §5 sont l'intention, non un protocole validé).

- [x] **T2 — La famille de danger : extension du détecteur + du verdict** (`lib/safety/classer-detresse.ts`, `lib/safety/detecteur-detresse.ts`) (AC: 4)
  - [x] RED : étendre `tests/classer-detresse.test.ts` — `VerdictSecurite` porte `famille?: FamilleDanger` (∈ `suicide|urgence_vitale|violences_femmes|enfance|ecoute`, réutilisée de `ressources-aide.ts` — **jamais un second enum**) ; `classerDetresse(niveau, famille?)` la propage ; `repliSur()` → `famille` **absente** (le repli ne fabrique pas de danger précis, il protège au plancher).
  - [x] RED : étendre `tests/detecteur-detresse.test.ts` — la sortie structurée demande AUSSI `FAMILLE: X` ; `extraireFamille(texte)` (PUR) mappe la sortie du modèle → `FamilleDanger` (défaut `suicide` quand niveau ≥ 2 sans famille lisible : l'idéation suicidaire est le cas majoritaire ; **jamais** de famille inventée hors liste). Le doute penche vers la sécurité, **jamais** vers « pas de danger ».
  - [x] GREEN : détecteur émet `INSTRUCTION_DETECTION_PLACEHOLDER` étendue (`NIVEAU: N` **+** `FAMILLE: X`, toujours PROVISOIRE) ; `classer-detresse` et le pipeline propagent `famille`. **Tests 2.3/2.4 restent verts** (`famille` optionnelle → aucun appelant existant cassé).
  - [x] ⚠️ Marquer le **prompt de famille PROVISOIRE — porte pré-lancement clinique**.

- [x] **T3 — Le bloc ressources : sélecteur pur + placement par niveau** (`lib/safety/bloc-ressources-detresse.ts`, PUR) (AC: 4)
  - [x] RED : `tests/bloc-ressources-detresse.test.ts` (pur) — `blocRessourcesDetresse(verdict): BlocRessources | null` :
    - niveau **0-1** → **`null`** (aucun bloc — AC1 « zéro élément ajouté au DOM »).
    - niveau **2** → `{ position: "apres", ressources }` adaptées à `famille` (défaut `suicide` : **3114** en tête + SOS Amitié).
    - niveau **3** → `{ position: "avant", ressources }` ; **danger vital / violences** ⇒ **`15/112` (ou `3919` violences) en tête** ; **suicide** ⇒ **`3114` en tête**.
    - Consomme **uniquement** `RESSOURCES_AIDE`/`FAMILLES_ORDRE`/`LIBELLE_FAMILLE` de `lib/safety/ressources-aide` — **jamais** de liste inline (source unique, acquis 2.5).
  - [x] GREEN : module PUR (aucun import infra). `BlocRessources = { position: "avant" | "apres"; familleAffichee: FamilleDanger; ressources: ReadonlyArray<RessourceAide> }`.

- [x] **T4 — Le câblage serveur : consigne injectée + trame ressources émise** (`app/api/anam/message/route.ts`) (AC: 1, 2, 3, 4)
  - [x] RED : étendre `tests/pipeline-securite-architecture.test.ts` (ou `tests/flux-anam.test.ts` selon la couverture existante) — **entre `route.ts:103` (verdict en main) et la construction de `RequeteIa`** : la consigne de T1 est **préfixée** aux `messages` en `{ role:"system" }` **côté serveur** (le client ne peut pas forger `system`, `valider-messages.ts:15`) quand `decision ≠ poursuivre` ; le bloc de T3 (si non `null`) est émis comme **trame NDJSON `{ t:"ressources", … }`** — **AVANT** le premier `delta` si `position:"avant"`, **après** le dernier `delta` (avec/juste avant `fin`) si `position:"apres"`.
  - [x] GREEN : câbler dans `route.ts` + le `ReadableStream.start()`. **Invariants durs à préserver** : (a) la consigne système **ne transite JAMAIS au client** (elle va serveur→modèle) ; (b) le `niveau`/`tier`/`usage` **ne fuient pas** — seule la trame `ressources` (contenu **destiné** à l'utilisatrice) part ; (c) la détection reste **avant** la génération (AD-16, garde d'ordre existante) ; (d) le **métrage n'est jamais vetoé** et le coût de détection reste hors quota (FR-043).
  - [x] Documenter : la couture d'injection est la **même** que la future **voix d'Anam (Story 2.8)** — 2.6 pose l'overlay détresse ; 2.8 composera la voix de base au-dessus (`[voix, détresse, …messages]`).

- [x] **T5 — Le client : nouveau tour `ressource` + rendu dans le fil** (`render/conversation/{types.ts,flux-ndjson-client.ts,useFluxAnam.ts,Fil.tsx,BlocRessources.tsx}`) (AC: 4)
  - [x] RED : étendre `tests/flux-client.test.ts` — `analyserTrame` **reconnaît** `{ t:"ressources", position, ressources }` (aujourd'hui les trames inconnues sont **ignorées** → forward-compat déjà en place : ajout **non cassant**) ; le cœur pur d'insertion place le tour `ressource` **avant** ou **après** le tour `anam` selon `position`.
  - [x] RED : garde d'architecture conversation (`tests/conversation-accessibilite.test.ts` ou nouvelle `tests/conversation-detresse.test.ts`, grep) — `Fil.tsx` rend le bloc en **`<article>`** (jamais `role="dialog"`/`aria-modal`/`<dialog`), **`surface-elevee`+`bordure-forte`**, **aucun** `--alerte`/`--rouge`/rouge brut, numéros `tel:` **chiffre par chiffre** (`aria-label` type `^\d( \d)+$`), « Vérifié le … » ; le bloc **apparaît via `fondu-texte`** (opacity, neutralisé en reduced-motion), **jamais** de glissement.
  - [x] GREEN : `types.ts` gagne le discriminant `{ readonly id; readonly role:"ressource"; readonly bloc: BlocRessources }` ; `useFluxAnam` insère le tour `ressource` (avant/après le tour `anam`) sur réception de la trame ; `Fil.tsx` gagne la branche de rendu → `render/conversation/BlocRessources.tsx` (présentational, lit `ressources-aide` — pur, importable côté client). **Le focus n'est JAMAIS volé** (le bloc apparaît sans `.focus()` ; le composeur garde le focus — AC2).
  - [x] ⚠️ Duplication assumée : `BlocRessources.tsx` (render/) et le bloc de `app/aide/page.tsx` rendent la même donnée — à **mutualiser** plus tard si un 3ᵉ consommateur apparaît (noté en Dev Notes / deferred-work).

- [x] **T6 — Gardes d'invariants : composeur actif (AC2) + zéro DOM aux niveaux 0-1 (AC1)** (`render/conversation/`, tests) (AC: 1, 2)
  - [x] RED : garde (grep) — `Composeur.tsx` : le `<textarea>` **n'a jamais** `disabled`, **n'est jamais** conditionnellement démonté (préservé — « ne DISPARAÎT jamais ») ; seul le **bouton envoyer** peut être gated. `Conversation.tsx` re-focus le champ (`champRef`) — préservé (WCAG 2.4.3).
  - [x] RED : garde de comportement — pour `decision ∈ {poursuivre, adoucir}` (niveaux 0-1), `blocRessourcesDetresse` → `null` **et** aucune trame `ressources` émise → **aucun élément ajouté au DOM** (AC1). Prouvé au niveau pur (T3) + garde serveur (T4).

- [x] **T7 — La sortie rapide en tête de `/aide` (FR-074)** (`app/aide/SortieRapide.tsx`, `app/aide/page.tsx`, `aide.module.css`) (AC: 4)
  - [x] RED : étendre `tests/aide-route.test.ts` — `/aide` monte un contrôle **« Quitter »/sortie rapide** en tête ; il **remplace l'entrée d'historique** (`history.replaceState`/`location.replace`) et navigue vers une **URL neutre** ; discret, **jamais alarmant** (aucun rouge). Client component **minimal** — n'introduit **aucune** dépendance session/IA/traceur sur `/aide` (étanchéité 2.5 préservée : la page reste statique/publique).
  - [x] GREEN : `SortieRapide.tsx` (`"use client"`, un bouton), monté en tête de `PageAide`. **URL neutre en constante** documentée PROVISOIRE (à valider juriste/pro). Vérifier que `/aide` **reste prerendered static** au build.

- [x] **T8 — AC5 (le lendemain) : prédicat de récence + interdit d'interface, comportement déféré** (`lib/safety/`, docs) (AC: 5)
  - [x] RED : `tests/…` — `episodeRecemmentClos(id, maintenant?): Promise<boolean>` (server-only, admin RPC ou lecture `episode_detresse`) → **vrai** si un épisode de **niveau_max ≥ 2** s'est **clos récemment** (`fin` dans une fenêtre courte, ex. ≤ 36 h) ; **repli sûr** sur panne → **false** (ne PAS fabriquer une reprise si l'état est incertain — ici le doute penche vers *ne rien dire*, jamais vers un faux « comment vas-tu »).
  - [x] GREEN + DÉFÉRÉ : livrer le prédicat **inerte** (aucun consommateur : ni reprise de session, ni Ordonnanceur n'existent). **L'interdit d'interface** (aucun bandeau, aucune carte « suivi »/« comment vas-tu », aucune reprise lourde) est un **invariant documenté** ; le **comportement** (une phrase de reprise + suppression de la notif du socle du lendemain) est **déféré Epic 4 (mémoire) + Ordonnanceur**. Consigner dans `deferred-work.md`. *(Décision D3, validée — couture inerte conservée.)*

- [x] **T9 — Gardes d'architecture, docs, validations complètes** (AC: 1-5)
  - [x] RED/GREEN : étendre `tests/pipeline-securite-architecture.test.ts` — (a) `consigne-detresse.ts` **PUR** (aucun import runtime, pas de `server-only`, pas d'infra) ; (b) `bloc-ressources-detresse.ts` **PUR** et **consomme** `ressources-aide` (jamais inline) ; (c) la **consigne de réponse** vit dans `lib/safety` (la décision de sécurité ne migre pas dans `render/`/`app/` — AD-16) ; (d) `render/` **muet** : `BlocRessources.tsx` n'importe **aucun** `@/lib/ai`/`@/lib/data`/`@/lib/safety/pipeline` (il lit seulement le modèle pur `ressources-aide`, AD-7).
  - [x] GREEN : `lib/safety/README.md` (la réponse par niveaux : consigne système, famille, bloc placé par niveau, sortie rapide) + `deferred-work.md` (couture AC5 « lendemain » → Epic 4/Ordonnanceur ; contenu détresse + famille + sortie rapide PROVISOIRES → porte clinique/juridique ; mutualisation `BlocRessources`).
  - [x] `npx vitest run` (Supabase local démarré + migrations appliquées) → **tous verts**. `npx tsc --noEmit` propre · `npx eslint .` propre · `npm run build` propre (`/aide` toujours static). Vérifier les 5 ACs un par un ; noté dans *Completion Notes*.

## Dev Notes

### La frontière — ce que 2.6 possède, ce qu'elle NE fait PAS

| Concern | Story | 2.6 en fait… |
|---|---|---|
| Détection du niveau (0-3) au modèle fort, repli sûr | 2.3 ✅ | **consomme** `securite.verdict.niveau` (ne re-détecte JAMAIS) |
| Forçage du tier FORT dès niveau ≥ 1 (détection **et** réponse) | 2.3/2.2 ✅ (AD-5) | **acquis** — `route.ts` passe déjà `niveauSecurite`, `tierPour` force `fort` |
| `limites_levees` + garde de montage commerciale | 2.4/2.5 ✅ | **acquis** — aucune UI commerciale ne se monte en détresse (`<GardeCommerciale>`) |
| Filet hors-IA (`/aide` statique, porte de secours 2 gestes) | 1.8/2.5 ✅ | **acquis** — Anam ne quitte jamais même modèle indispo ; 2.6 **ajoute la sortie rapide** sur `/aide` |
| Source unique des ressources + familles + gouvernance FR-044 | 2.5 ✅ | **consomme** `RESSOURCES_AIDE`/`FamilleDanger` (jamais de liste inline) |
| **Forme de la réponse par niveau** (consigne système) | **2.6 🔨** | **T1** — `consigne-detresse.ts` (pur), injectée serveur |
| **Famille de danger** (suicide vs violences/enfant/…) | **2.6 🔨** | **T2** — étend détecteur + verdict (`famille?`), prompt PROVISOIRE |
| **Bloc ressources dans le fil**, placé par niveau (avant/après), ordonné | **2.6 🔨** | **T3-T5** — sélecteur pur + trame NDJSON + tour `ressource` |
| **Sortie rapide** (FR-074) en tête de `/aide` | **2.6 🔨** | **T7** — client minimal, `history.replaceState` + URL neutre |
| Voix de base d'Anam (≤ 3 phrases, hypothèses, anti-flatterie) | 2.8 ⏭️ | **hors périmètre** — 2.6 pose l'overlay détresse ; 2.8 compose la voix au-dessus |
| Arc de séance (construire→observer→nommer→clore) | 2.7 ⏭️ | hors périmètre |
| Clôture + placement paywall sous le bilan | 2.9 ⏭️ | hors périmètre (la garde `limites_levees` est déjà là) |
| **« Le lendemain » (FR-045)** : reprise + suppression notif | **2.6 ↩️ déféré** | **T8** — prédicat inerte + interdit d'interface ; comportement → **Epic 4 (mémoire) + Ordonnanceur** (D3) |

### La couture d'injection (le cœur) — où tout se branche

Cartographié par lecture du code (2026-07-28). **Aujourd'hui la réponse est un pass-through verbatim** : `route.ts` passe les `messages` client bruts au modèle, sans **aucune** consigne système ; `niveauSecurite` ne pilote QUE le tier. 2.6 introduit la 1ʳᵉ couche de consigne de **réponse**.

- **Le verdict est en main à** [`app/api/anam/message/route.ts:103`](app/api/anam/message/route.ts#L103) (`securite.verdict.{niveau,decision}` + `securite.limitesLevees`), **la requête se construit à** [`route.ts:110`](app/api/anam/message/route.ts#L110). **La couture = entre les deux.**
- Le client **ne peut pas** forger un rôle `system` : [`lib/ai/valider-messages.ts:15`](lib/ai/valider-messages.ts#L15) n'accepte que `user`/`assistant`. Préfixer `{role:"system"}` côté serveur est donc sûr.
- `VerdictSecurite = { niveau; decision; supprimerTravailSchema }` : [`lib/safety/classer-detresse.ts:19`](lib/safety/classer-detresse.ts#L19). `decision` (`poursuivre|adoucir|intervenir|urgence|repli_sur`) **EST** la clé naturelle par niveau. T2 y ajoute `famille?`.
- La trame se pousse via `emettre(...)` dans le `ReadableStream.start()` : [`app/api/anam/message/route.ts:144`](app/api/anam/message/route.ts#L144). Émettre la trame `ressources` **avant** la boucle `for await` (position `avant`) ou après (position `apres`).
- Le fil client **ignore déjà les trames inconnues** (forward-compat) : [`render/conversation/flux-ndjson-client.ts:30`](render/conversation/flux-ndjson-client.ts#L30) → l'ajout de `{t:"ressources"}` est **non cassant**. Contrat actuel : `TrameRecue = {t:"delta";c} | {t:"fin"} | {t:"erreur"}` ([`:12`](render/conversation/flux-ndjson-client.ts#L12)).
- Modèle de tour à étendre : `Tour` (union sur `role`, éphémère, **pas** le modèle de scène) : [`render/conversation/types.ts:9`](render/conversation/types.ts#L9). Insertion dans `Fil.tsx` (binaire `anam`/`utilisatrice` aujourd'hui) : [`render/conversation/Fil.tsx:53`](render/conversation/Fil.tsx#L53).
- Composeur — **déjà** conforme AC2 : `<textarea>` jamais `disabled`/masqué ; seul le bouton envoyer est gated `disabled={!valeur.trim() || occupe}` : [`render/conversation/Composeur.tsx:93`](render/conversation/Composeur.tsx#L93). Re-focus champ : [`render/conversation/Conversation.tsx:126`](render/conversation/Conversation.tsx#L126). ⇒ AC2 est surtout une **garde à préserver**.

### Le placement du bloc par niveau (la nuance qui compte)

Deux sources, deux placements — **cohérents une fois séparés par niveau** :
- **Niveau 2** (idéation passive) → Anam **nomme et demande dans le fil**, donne le 3114 **dans son texte**, puis le bloc ressources s'insère **APRÈS** son tour (UX-DR, [DESIGN/EXPERIENCE §Détresse ligne 409]). « Un seul élément apparaît : le bloc ressources. »
- **Niveau 3** (idéation active / danger vital) → le bloc ressources s'insère **AVANT** le tour d'Anam, **`15/112` en tête** si danger vital (AC4 de l'épic). L'urgence prime sur le tour.
- **Aucune sémantique d'alerte** : `surface-elevee` + `bordure-forte`, **jamais** `alerte`/rouge/pictogramme/modale — « dramatiser ajoute de la peur là où il faut du calme » (UX-DR, décision délibérée à confirmer avec le pro).

### Le no-leak, précisé (ne pas se tromper de règle)

Le commentaire route « le tier/usage ne transitent JAMAIS jusqu'au client » vise le **métrage** (facturation/analytics). Il **n'interdit pas** la trame `ressources` : le bloc est un **artefact destiné à l'utilisatrice** (c'est tout l'intérêt qu'elle le voie). Ce qui ne fuite pas : `niveau` brut, `decision`, `tier`, `usage`, `modele`, et la **consigne système** (serveur→modèle seulement). Ce qui part : la trame `ressources` (contenu d'aide). **Ne pas** sérialiser `niveau`/`decision` dans la trame — seulement `position` + `ressources`.

### Dégradation gracieuse (AD-15) — le bloc est un bonus, `/aide` est la garantie

Si le modèle fort tombe, le détecteur renvoie **repli sûr (niveau 1)** → **aucun bloc** ce tour-là (niveau 1). Mais le **filet non-IA** (`/aide` statique + porte de secours 2 gestes, acquis 2.5) reste **inconditionnel** → Anam ne quitte jamais (AD-15/FR-039). Le bloc dans le fil est un **enrichissement du chemin IA** ; il ne remplace jamais le filet hors-IA. À documenter pour que le dev ne « durcisse » pas le bloc en dépendance de sécurité.

### Pièges (issus des revues 2.2-2.5 et de la lecture du code)

1. **NE PAS re-classifier côté réponse** — la forme dérive de `verdict.decision` **déjà** produit (une seule horloge de sécurité, AD-16/AD-17). Une 2ᵉ classification = un 2ᵉ juge divergent.
2. **`import type` obligatoire** (`verbatimModuleSyntax`) pour tout type importé (`MessageIa`, `VerdictSecurite`, `FamilleDanger`, `RessourceAide`).
3. **Modules purs = zéro `server-only`, zéro import runtime infra** (`consigne-detresse`, `bloc-ressources-detresse`) — sinon la garde d'archi T9 casse (patron `classer-detresse`/`ressources-aide`).
4. **`famille` optionnelle** dans `VerdictSecurite` — un champ requis casserait `repliSur()` et les tests 2.3/2.4. Le repli **n'a pas** de famille (protège au plancher, ne fabrique pas un danger).
5. **CSS : commentaires strippés avant assertion** (`.replace(/\/\*[\s\S]*?\*\//g,"")`) — piège récurrent (un `--alerte` dans un commentaire a déjà fait un faux rouge en 2.5). Rejeter `#[0-9a-fA-F]{3,8}`, `\b(rgb|hsl)a?\(`, rouges nommés, `--alerte|--rouge`.
6. **Vitest env node** — pas de test DOM. Prouver le client par **cœurs purs** (parse trame, insertion de tour) + **gardes statiques** (grep) ; le rendu réel (focus non volé, fondu, `tel:` sur mobile) est une **porte pré-lancement** (vérif navigateur), à consigner comme les vérifs runtime 2.2.
7. **Ordre de trame** — la trame `ressources` « avant » doit sortir **avant** le 1ᵉʳ `delta` (donc avant même le plancher de latence de 500 ms). Ne pas la coincer derrière la boucle de streaming.
8. **Focus** — le bloc s'insère **sans** voler le focus (pas de `.focus()` sur le bloc) : le composeur reste au focus (AC2). Une insertion qui déplace le focus est un défaut a11y en détresse.
9. **`/aide` doit rester static** — `SortieRapide.tsx` est un `"use client"` **feuille**, monté dans la page ; ne pas transformer `PageAide` en client, ne pas y introduire session/IA (étanchéité 2.5).
10. **Trame inconnue = ignorée** — `analyserTrame` ignore déjà l'inconnu : les vieux clients ne cassent pas, mais **le nouveau client doit** brancher `ressources` explicitement (sinon le bloc n'apparaît jamais).

### Décisions (validées par Julian, 2026-07-28)

- **D1 ✅ — Famille de danger : détectée maintenant (prompt PROVISOIRE), pas éludée.** AC4/FR-074 exigent des **« ressources correspondantes »** et « `15/112` en tête » au niveau 3 vital : impossible sans un signal de **famille**. On étend la sortie structurée du détecteur (`FAMILLE: X`) et le verdict (`famille?`), en réutilisant l'enum `FamilleDanger` de 2.5. La **machine** de sélection/ordre est définitive ; le **prompt** de famille est PROVISOIRE (même porte clinique que le niveau). *Alternative écartée : liste fixe non adaptée au danger — viole « ressources correspondantes ».*
- **D2 ✅ — Bloc ressources = trame serveur, pas décision client.** Le SERVEUR décide quand/quoi montrer (sécurité-d'abord, AD-16) et émet `{t:"ressources"}` ; le client **rend** ce qu'on lui dit (muet, AD-7). Le niveau ne fuite pas (seul le contenu d'aide part). *Seule option serveur-autoritaire cohérente.*
- **D3 ✅ — AC5 « le lendemain » : couture inerte + interdit d'interface, comportement DÉFÉRÉ.** La reprise « en une phrase » **exige la mémoire de conversation (Epic 4)** ; la suppression de la notif du socle **exige l'Ordonnanceur (non bâti)**. 2.6 livre `episodeRecemmentClos()` (prédicat inerte, T8) + l'invariant « aucun bandeau/carte de reprise ne se monte », et **défère** le comportement. *Bâtir la reprise maintenant serait factice (aucune frontière de session ni notif).*

### Project Structure Notes

- **Nouveaux (purs, `lib/safety/`)** : `consigne-detresse.ts`, `bloc-ressources-detresse.ts` — patron `classer-detresse`/`ressources-aide` (readonly, aucun import runtime infra).
- **Modifiés (`lib/safety/`)** : `classer-detresse.ts` (+`famille?`), `detecteur-detresse.ts` (+`extraireFamille`, prompt étendu), `pipeline.ts` (propage `famille`), `episode-*`/`depot-episode.ts` **seulement si** T8 câble `episodeRecemmentClos` (lecture).
- **Modifié (`app/`)** : `app/api/anam/message/route.ts` (câblage), `app/aide/{page.tsx,aide.module.css}` (sortie rapide), **nouveau** `app/aide/SortieRapide.tsx` (`"use client"`).
- **Modifiés (`render/conversation/`)** : `types.ts` (tour `ressource`), `flux-ndjson-client.ts` (parse trame), `useFluxAnam.ts` (insertion), `Fil.tsx` (branche rendu), **nouveau** `BlocRessources.tsx`.
- **Tests** : nouveaux `consigne-detresse.test.ts`, `bloc-ressources-detresse.test.ts` (+ `conversation-detresse.test.ts` si besoin) ; étendus `classer-detresse.test.ts`, `detecteur-detresse.test.ts`, `flux-client.test.ts`, `aide-route.test.ts`, `pipeline-securite-architecture.test.ts`.
- **Docs** : `lib/safety/README.md`, `deferred-work.md`.
- **Aucune migration SQL** attendue (2.6 consomme `episode_detresse` de 2.4). Si T8 lit la récence via RPC, **réutiliser** une lecture existante plutôt que créer une transition (aucune écriture nouvelle).

### References

- Épic 2, Story 2.6 : [epics.md:638](_bmad-output/planning-artifacts/epics.md#L638) (+ voisines 2.3 [:587], 2.5 [:620], 2.7 [:656], 2.9 [:688]).
- PRD §5 Détresse : FR-037→046 [prd.md:129](_bmad-output/planning-artifacts/prds/prd-Anima-2026-07-21/prd.md#L129) ; **Les quatre niveaux + Formulations de référence** [prd.md:145](_bmad-output/planning-artifacts/prds/prd-Anima-2026-07-21/prd.md#L145) ; FR-074/075/076/077 [prd.md:139].
- UX-DR : *Le protocole de détresse, côté interface* (tableau par niveau, bloc `article` jamais modal, sortie rapide, le lendemain) — EXPERIENCE.md §399-434 ; *Bloc ressources* EXPERIENCE.md:160/179-180 ; DESIGN.md:657-659 (porte de secours jamais alerte, mécanisme B contraste).
- SPINE : AD-5 (détresse au plus capable, détection **et** réponse forcées fort) [ARCHITECTURE-SPINE.md:56] ; AD-16 (pipeline sécurité-d'abord) [:130] ; AD-15 (filet hors-IA, repli sûr) [:125] ; AD-9 (haltes joignables, jamais de paywall sur la sécurité) [:76] ; AD-7 (render muet) [:66] ; AD-17 (épisode possédé, une seule horloge) [:135].
- Code (contrats à modifier) : `route.ts:103-110/144`, `classer-detresse.ts:17-26`, `pipeline.ts:61-98`, `port.ts:26-37`, `detecteur-detresse.ts:54-121`, `ressources-aide.ts:21-64`, `flux-ndjson-client.ts:12-30`, `types.ts:9-17`, `Fil.tsx:53-64`, `Composeur.tsx:93`, `Conversation.tsx:126`.
- Story précédente (patrons) : 2.5 [2-5-filet-hors-ia-aide-garde-limites-levees.md] (source unique ressources, garde d'archi par lecture, provisoire clinique, seams) ; deferred-work.md:21-29 (haltes en conversation + sortie rapide **explicitement renvoyées à 2.6**).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context)

### Debug Log References

- **Faux positif garde de pureté (T4)** : `not.toMatch(/@\/lib\/ai\//)` rejetait `consigne`/`bloc` qui importent `import type { MessageIa } from "@/lib/ai/port"` (surface de TYPE du port, erasée). Corrigé : la garde principale reste « aucun import runtime » ; l'infra n'est rejetée qu'au runtime (`import type` du port permis).
- **`bloc-ressources` a un import runtime légitime** (`RESSOURCES_AIDE`, source unique) : la pureté = « pas d'infra/IO », pas « zéro import ». Garde scindée : `consigne`/`lendemain` type-only, `bloc` consomme la source unique.
- **`tsc` — rétrécissement de `Tour` (T5)** : `tours.filter(...).map(t => t.texte)` cassait après l'ajout du tour `ressource` (sans `texte`). Corrigé par une **garde de type** `Exclude<Tour, { role: "ressource" }>` dans le filtre.
- **Faux positif « Plausible » (T7)** : le mot « plausible » dans un commentaire de `SortieRapide.tsx` matchait `/plausible/i` (outil analytics). Reformulé (« crédible »).

### Completion Notes List

Implémenté en TDD strict (RED → GREEN → refactor), 9 tâches, toutes ACs vérifiées une par une :

- **AC1** — `consigneReponse` : `null` au niveau 0 (rien ajouté) ; niv. 1 non annoncé (plus douce, aucun dispositif) ; niv. 2/3 nomme + demande. `blocRessourcesDetresse` → `null` aux niv. 0-1 (zéro élément au DOM, prouvé pur).
- **AC2** — composeur **jamais** `disabled`/masqué (garde préservée) ; bloc inséré **sans voler le focus** (insertion passive, aucun `.focus()`) ; interdits « ne quitte jamais » / « pas soignante » dans la consigne.
- **AC3** — interdits durs FR-075 (« ni comment, ni avec quoi, ni quand ») + FR-076 (humain à appeler/rejoindre) prouvés par le **contenu** du module pur.
- **AC4** — famille de danger (détecteur + verdict `famille?`) ; bloc placé **niv. 2 après / niv. 3 vital avant**, `15/112` **en tête** si vital, `3114` en tête si suicide ; trame NDJSON `{t:"ressources"}` (no-leak : ni niveau ni décision) ; rendu `<article>` calme, `tel:` chiffre par chiffre, « Vérifié le … ». **Sortie rapide** en tête de `/aide` (replace history + site neutre).
- **AC5** — `estLendemainDEpisode` (prédicat pur, couture inerte) ; **comportement déféré** Epic 4 (mémoire) + Ordonnanceur (D3 validée par Julian).
- **Décision d'implémentation (D3)** : T8 livré comme **prédicat PUR** (aucune I/O, date injectée) plutôt qu'une RPC/migration spéculative — cohérent avec « aucune migration » et « couture inerte » (aucun consommateur n'existe). La lecture réelle de `episode_detresse` viendra avec son consommateur (Epic 4).
- **Couture voix 2.8** : la consigne est injectée au même point que la future voix de base ; composition `[voix, détresse, …messages]` documentée.
- **Validations** : **508 tests verts (54 fichiers)** — aucune régression (462/50 au départ). `tsc` clean · `eslint` clean · `next build` clean, `/aide` toujours **static**. **Aucune migration SQL** (2.6 consomme l'épisode de 2.4).
- ⚠️ Tout contenu de détresse (consigne, prompt de famille, adéquation ressources, URL/libellé sortie rapide) est **PROVISOIRE** — porte pré-lancement clinique + juridique.

### Revue de code max-effort (2026-07-28)

Revue adversariale multi-agents (28 agents, ~1,4 M tokens) sur le diff non commité. **20 candidats → 13 confirmés → aucun critique, 3 majeurs, 6 mineurs, 4 nettoyages.** 9 corrigés (R1-R9), 2 différés (fiables seulement à la porte pré-lancement).

- **R1 [majeur] ✅** — `consigne-detresse.ts` codait « le 3114 » depuis `decision` seul, alors que la carte route par `famille` → Anam recommandait verbalement la ligne prévention-suicide à une victime de **violences** pendant que la carte affichait le 3919. **Fix** : la consigne nomme `numeroEnTete(verdict)` — le **même** numéro que la carte mène (voix ↔ carte cohérentes, sans reclassification, AD-16). [lib/safety/consigne-detresse.ts, bloc-ressources-detresse.ts]
- **R2 [majeur] ✅** — « Réessayer » retirait le tour d'Anam mais laissait le **bloc ressources orphelin**, et le rejeu en insérait un second → deux blocs 15/112 en urgence. **Fix** : le tour `ressource` porte un `ancreId` ; `reessayer` purge les deux ensemble. [render/conversation/Conversation.tsx, types.ts]
- **R3 [majeur] ✅** — le bloc était inséré au DOM **muet** pour le lecteur d'écran. **Fix** : `aria-live="polite"` sur le `<article>` + annonce polie dans la région dédiée du fil (`setAnnonce`), sans voler le focus (AC2 tenu). [render/conversation/BlocRessources.tsx, Conversation.tsx]
- **R4 [mineur] ✅** — `extraireFamille` prenait la **première** occurrence (une mention parasite en amont masquait la ligne FAMILLE finale → mauvais routage). **Fix** : scan global, retient la **dernière** ligne conforme (comme `extraireNiveau` prend le max). [lib/safety/detecteur-detresse.ts]
- **R5 [mineur] ✅** — le bloc niveau 2 (« apres ») était perdu si le flux erronait mid-stream. **Fix** : émis aussi dans le `catch` (le filet ne dépend pas d'un flux propre). [app/api/anam/message/route.ts]
- **R6 [mineur+nettoyage] ✅** — au niveau 3, une famille `ecoute` n'avait pas de plancher urgent (bloc mené par une ligne d'écoute) ; `FAMILLES_VITALES` contenait un no-op (`urgence_vitale`). **Fix** : niveau 3 → `15/112` en tête pour **toute** famille sauf suicide (couvre `ecoute`, supprime le no-op). [lib/safety/bloc-ressources-detresse.ts]
- **R7 [mineur] ✅** — WCAG 2.5.3 (Label in Name) : le libellé visible (« 15 ») n'était pas dans le nom accessible (« SAMU, 1 5 ») → liens d'urgence non activables en commande vocale. **Fix** : `aria-label` commence par le numéro visible (bloc **et** `/aide`). [render/conversation/BlocRessources.tsx, app/aide/page.tsx]
- **R8 [mineur] ✅** — la garde no-leak avait une fenêtre trop courte + repli `?? ""` vacue (une fuite `niveau` en fin d'objet passait verte) ; la garde NDJSON était tautologique. **Fix** : fenêtre couvrant tout l'objet + assertion positive ; whitelist des clés du variant de trame. [tests/pipeline-securite-architecture.test.ts]
- **R9 [nettoyage] ✅** — `analyserRessources` acceptait un tableau `ressources` VIDE (bloc d'aide sans ressource). **Fix** : rejet si `length === 0`. [render/conversation/flux-ndjson-client.ts]
- **Différé — sortie rapide, entrée d'historique précédente.** `SortieRapide` écrase l'entrée `/aide` mais un « Précédent » depuis le site neutre peut restaurer la conversation. Un effacement fiable de l'historique n'est pas atteignable côté client ; la sortie rapide est déjà PROVISOIRE (porte juriste/pro) → traité à ce gate. [app/aide/SortieRapide.tsx]
- **Différé — mutualisation `LigneRessource`.** La ligne de ressource est dupliquée bloc ↔ `/aide` (même fix R7 appliqué des deux côtés). Extraction d'un feuillet présentationnel partagé → altitude/nettoyage, à faire si un 3ᵉ consommateur apparaît (noté deferred-work). [render/conversation/BlocRessources.tsx, app/aide/page.tsx]

Après correctifs : **512 tests verts (54 fichiers)**, tsc/eslint/build propres, `/aide` toujours static.

### File List

**Nouveaux — modules purs (`lib/safety/`)**
- `lib/safety/consigne-detresse.ts` — consigne système par `decision` (pur)
- `lib/safety/bloc-ressources-detresse.ts` — sélecteur + placement du bloc (pur)
- `lib/safety/lendemain.ts` — prédicat de récence `estLendemainDEpisode` (pur, couture inerte)

**Nouveaux — rendu (`render/conversation/`)**
- `render/conversation/BlocRessources.tsx` — le bloc dans le fil (présentational, muet)
- `render/conversation/fil-ops.ts` — `insererTour` (cœur pur d'insertion)

**Nouveau — `app/aide/`**
- `app/aide/SortieRapide.tsx` — sortie rapide (`"use client"`, FR-074)

**Modifiés — `lib/safety/`**
- `lib/safety/classer-detresse.ts` — `VerdictSecurite.famille?` + `classerDetresse(niveau, famille?)`
- `lib/safety/detecteur-detresse.ts` — `extraireFamille` + prompt étendu (`FAMILLE: X`)
- `lib/safety/pipeline.ts` — propage `famille` au bump d'épisode
- `lib/safety/README.md` — section « réponse de détresse par niveaux »

**Modifiés — `lib/ai/` + `app/`**
- `lib/ai/flux-ndjson.ts` — trame `ressources` (type structurel, no-leak)
- `app/api/anam/message/route.ts` — injection consigne + émission trame ressources
- `app/aide/page.tsx` — montage `<SortieRapide />`
- `app/aide/aide.module.css` — style `.sortieRapide`

**Modifiés — `render/conversation/`**
- `render/conversation/types.ts` — `RessourceVue` + tour `ressource`
- `render/conversation/flux-ndjson-client.ts` — parse trame `ressources`
- `render/conversation/useFluxAnam.ts` — rappel `onRessources`
- `render/conversation/Conversation.tsx` — insertion du tour ressource + garde de type
- `render/conversation/Fil.tsx` — branche de rendu `ressource`
- `render/conversation/conversation.module.css` — style du bloc (fiche)

**Tests (nouveaux)**
- `tests/consigne-detresse.test.ts` · `tests/bloc-ressources-detresse.test.ts` · `tests/lendemain.test.ts` · `tests/conversation-detresse.test.ts`

**Tests (étendus)**
- `tests/classer-detresse.test.ts` · `tests/detecteur-detresse.test.ts` · `tests/flux-client.test.ts` · `tests/aide-route.test.ts` · `tests/pipeline-securite-architecture.test.ts`

**Docs**
- `_bmad-output/implementation-artifacts/deferred-work.md` — coutures 2.6

## Change Log

| Date | Version | Description | Author |
|---|---|---|---|
| 2026-07-28 | v0.1 | Contexte d'implémentation créé (create-story). Réponse de détresse par niveaux : consigne système par `decision`, famille de danger (prompt provisoire), bloc ressources placé par niveau (2 après / 3 vital avant, `15/112` en tête), sortie rapide `/aide`, AC5 « lendemain » déféré (D3). | Julian (via Opus 4.8) |
| 2026-07-28 | v1.0 | Implémentation TDD complète (T1-T9). 3 modules purs (consigne/bloc/lendemain) + famille de danger + trame NDJSON `ressources` + rendu client `<article>` + sortie rapide `/aide`. 508 tests verts (54 fichiers), tsc/eslint/build propres, aucune migration. Status → review. | Julian (via Opus 4.8) |
| 2026-07-28 | v1.1 | Revue de code max-effort (28 agents). 9 défauts corrigés (R1-R9) : voix ↔ carte famille-aware (majeur), « Réessayer » sans bloc orphelin (majeur), annonce lecteur d'écran (majeur), extraireFamille dernière occurrence, bloc niv.2 survit à l'erreur, plancher 15/112 niv.3 universel, WCAG 2.5.3, gardes no-leak/NDJSON durcies, rejet trame vide. 2 différés (sortie rapide historique, mutualisation LigneRessource). 512 tests verts. | Julian (via Opus 4.8) |
