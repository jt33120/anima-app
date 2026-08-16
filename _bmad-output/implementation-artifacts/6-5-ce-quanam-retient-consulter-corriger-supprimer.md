---
baseline_commit: 74a17c0
---

# Story 6.5 : Ce qu'Anam retient — consulter, corriger, supprimer un fait

Status: review

## Story

En tant qu'utilisatrice,
je veux consulter en langage clair ce qu'Anam retient de moi et corriger ou supprimer n'importe quel
fait extrait,
afin de garder la main sur mon profil vivant, une correction étant une donnée et non une erreur à
masquer.

**Couvre :** FR-063, FR-064 · AD-18 (provenance, idempotence, tombstones), AD-8 (couche des faits
extraits), NFR-001 (isolation RLS) · renvoi FR-031 (aucun score), AD-13 (write-gate art. 9).

---

## Ce que cette story livre, en une phrase

L'écran qui manquait à une base déjà complète : la Story 4.2 avait construit le tombstone, le trigger
anti-résurrection et l'unique fonction de fusion — **et personne ne pouvait rien en faire, parce
qu'aucune page n'existait pour voir un fait, encore moins pour le corriger.**

---

## ⚠️ CE QUE 4.2 AVAIT DÉJÀ FAIT, ET QU'IL NE FAUT PAS REFAIRE

Presque tout le mécanisme existe et il est bon. Le relire avant d'écrire une ligne :

| | |
|---|---|
| `origine` / `statut` | `('extrait','utilisatrice')` × `('actif','corrige','supprime')` — 0018 |
| L'idempotence | index unique `(utilisatrice_id, cle_dedoublonnage)` : une info = une ligne |
| L'anti-résurrection | trigger `fait_extrait_no_resurrection` **+** la clause `WHERE` de l'upsert |
| La survie à la révocation | supprimer (vider) passe ; corriger (déposer) est gaté consentement |
| Le chemin d'écriture unique | `fusionner_fait_extrait`, `security invoker` — la RLS mord dedans |

**AC4 est donc déjà vrai, et prouvé** par `tests/fait-extrait.test.ts` (blocs « anti-résurrection &
soft-delete » et « merge bout-en-bout »). Cette story n'y touche pas ; elle ajoute les tests nommés
qui manquent au niveau de l'ÉCRAN.

---

## Critères d'acceptation

- **AC1** — l'écran affiche chaque fait en une phrase de langage clair, avec sa date et un lien vers
  l'extrait source, **Et** aucun score de confiance n'est affiché.
- **AC2** — une correction en place est enregistrée avec l'origine « utilisatrice » et le statut
  « corrigé », **Et** elle prime sur toute ré-extraction future.
- **AC3** — une suppression est immédiate avec une annulation possible pendant 10 secondes, **Et** un
  tombstone est posé.
- **AC4** — l'extraction post-tour ou la synthèse en upsert idempotent ne réécrit ni ne ressuscite
  jamais un fait corrigé ou supprimé.
- **AC5** — l'état vide affiche « Anam ne retient encore rien de précis sur toi. »
- **AC6** — supprimer un fait ne touche QUE la couche des faits extraits : le journal brut et les
  branches ne sont pas affectés, **Et** le lien d'une branche vers son extrait source reste intact.

---

## Décisions

### D1 — ⚠️ UN TROU RÉEL TROUVÉ DANS LA MACHINE À ÉTATS DE 4.2, ET MESURÉ

Une **correction vide** est acceptée aujourd'hui. Mesuré contre le vrai Postgres avant d'écrire une
ligne de cette story :

```
fusionner_fait_extrait('utilisatrice', 'corrige', 'k1', '', null)
  → erreur : AUCUNE
  → ligne  : { origine: "utilisatrice", statut: "corrige", contenu: "" }
```

Cette ligne n'est **ni affichable ni un tombstone** : elle a le statut d'une correction et le contenu
d'une suppression. Le write-gate art. 9 du trigger ne la voit pas (il ne se déclenche que sur un
contenu NON vide), et le client peut donc fabriquer une suppression qui ne dit pas son nom — en
contournant la seule chose que le tombstone doit rendre lisible : *ceci a été effacé*.

C'est dans le périmètre de cette story, et pas ailleurs : les AC2 et AC3 sont précisément ce qui
distingue une correction d'une suppression.

**La garde est une CONTRAINTE DE TABLE, pas un trigger et surtout pas du TypeScript.** Un `check`
s'applique à *tous* les écrivains, `service_role` compris — que la RLS ne borne pas —, il est
déclaratif, et il ne peut pas être contourné par un chemin d'écriture futur :

```
statut = 'supprime'  ⇔  contenu = ''
```

Migration `0056`, qui NORMALISE d'abord les lignes existantes (une ligne vivante sans contenu devient
le tombstone qu'elle est déjà en pratique) avant de poser la contrainte.

### D2 — L'écran est atteignable par quelqu'un qui a RÉVOQUÉ son consentement

C'est la décision la plus contre-intuitive de la story, et 4.2 l'a déjà à moitié prise : la base
autorise délibérément une suppression après révocation (« droit à l'effacement RGPD art. 17 ») et
refuse une correction (« déposer un contenu art. 9 exige un consentement valide »).

Ce serait sans effet si l'écran, lui, redirigeait — **on ne peut pas supprimer ce qu'on ne voit
pas.** Toute la construction de 4.2 serait alors inatteignable, exactement au moment où elle sert.

⚠️ **Et ce n'est pas la même décision que pour le fil de conversation.** `depot-fil.ts` refuse de
servir le verbatim à quelqu'un qui a révoqué, et il a raison : c'est le PRODUIT QUI FONCTIONNE.
Ici, c'est l'EXERCICE D'UN DROIT — accès (art. 15) et effacement (art. 17), qui survivent tous deux
à la révocation. La ligne entre les deux est réelle, et elle passe par la finalité, pas par la donnée.

Conséquence à l'écran : les faits s'affichent, « Supprimer » fonctionne, « Corriger » est refusé avec
son motif. Le refus vient de la base (le trigger lève) ; l'écran l'annonce d'avance plutôt que de
laisser quelqu'un composer une phrase pour rien.

### D3 — L'annulation RE-DÉPOSE, elle ne rembobine pas — et ça ne peut pas être autrement

Le tombstone **vide le contenu** : c'est sa raison d'être, faire partir l'art. 9. Un rembobinage
parfait exigerait donc soit de garder le contenu supprimé (ce qui annule le tombstone), soit de
rouvrir le chemin de ré-activation que 4.2 a fermé exprès (`le chemin utilisatrice ne pose que
corrige/supprime — jamais 'actif'`). Aucun des deux n'est acceptable.

L'annulation est donc une **re-déposition** : le client garde la phrase en mémoire pendant dix
secondes et la repose comme une CORRECTION. Trois conséquences, toutes assumées et écrites :

- le fait revient en `utilisatrice`/`corrige`, pas en `extrait`/`actif` — il devient **possédé**,
  donc la ré-extraction ne le touchera plus jamais. C'est la bonne direction : après un aller-retour
  par la corbeille, la phrase est celle qu'elle a **ré-affirmée**, pas celle qu'une machine a produite ;
- `extrait_source_id` **survit** (ni la suppression ni la correction n'y touchent) : le lien vers le
  message d'origine tient d'un bout à l'autre ;
- quelqu'un qui a révoqué peut supprimer mais **pas** annuler. C'est cohérent avec D2 et avec 4.2 :
  annuler, c'est déposer.

### D4 — La suppression est écrite IMMÉDIATEMENT, jamais différée de dix secondes

Le réflexe serait de retarder l'écriture et d'annuler avant qu'elle parte. C'est plus simple et
**c'est faux** : si elle ferme l'onglet dans les dix secondes, elle croit avoir effacé et rien n'a
été effacé. Pour un droit à l'effacement, le sens de l'erreur n'est pas négociable. L'AC3 le dit
d'ailleurs au littéral — « la suppression est immédiate […] **Et** un tombstone est posé ».

### D5 — La source s'AFFICHE, elle ne se « lie » pas

L'AC1 demande « un lien vers l'extrait source ». Il n'existe aucune ancre par message dans la
conversation, et la leçon de la 4.10 est écrite : **une question sans issue est un reproche** ; un
lien qui ne mène nulle part en est un aussi. Le message d'origine est donc affiché sur place, replié
dans un `<details>` — c'est ce que « voir d'où ça vient » veut dire.

### D6 — Une correction est une DONNÉE, donc elle se voit

L'énoncé de la story le demande : « une correction étant une donnée et non une erreur à masquer ».
Un fait corrigé porte donc une mention discrète. Ce n'est pas un compteur (FR-031 vise les scores,
séries et progressions) : c'est une provenance, la même que celle que 4.2 persiste déjà en base.

### D7 — Ce que cette story NE fait PAS : l'heure de naissance

Je l'avais annoncée ici (arbitrage QA du 16/08, T17). **En implémentant, l'AC6 tranche contre moi** :
« seule la couche des faits extraits est touchée ». L'heure de naissance vit dans `entree_naissance`
et `theme_natal` — une autre couche, avec un write-gate qui grave *une seule fois* et un thème à
recalculer derrière.

Elle appartient au même ÉCRAN mais pas à la même story. Inscrite en `action_items` sous le nom
**6.5b**, avec le problème réel écrit : corriger l'heure invalide l'ascendant, les maisons et ce que
l'horoscope du jour en dérive.

---

## Tâches

- [x] **T1 — La migration 0056** : normalisation des lignes incohérentes puis contrainte
      `statut='supprime' ⇔ contenu=''`.
- [x] **T2 — Le domaine** (`lib/domain/memoire-retenue.ts`, `copie-memoire.ts`) : fenêtre
      d'annulation, validation d'une correction, la copie sous détecteurs.
- [x] **T3 — La lecture** (`lib/data/lire-memoire.ts`) : faits vivants + leur extrait source.
- [x] **T4 — La halte** `/memoire` + ses actions serveur, avec la garde d'onboarding SANS `revoque`.
- [x] **T5 — Le rendu** : liste, correction en place, suppression, annulation de dix secondes.
- [x] **T6 — Les gardes** : AC1 (aucun score), AC5 (état vide), AC6 (les autres couches intactes),
      D2 (révoquée : supprimer oui, corriger non).
- [x] **T7 — Campagne de mutation.**
- [x] **T8 — Vérification complète, déploiement de 0056, commit.**

---

## Dev Agent Record

### Campagne de mutation — 15 mutants, 15 tués (deux passages)

Le premier passage a rendu **13 tués / 2 survivants**, et les deux survivants étaient de vrais trous
de couverture : le rendu doublait les actions serveur, la base doublait la lecture, et **personne ne
regardait entre les deux**. `tests/memoire-actions.test.ts` est né de ce constat.

- **M6** — `annulerSuppression` passait la phrase comme « texte actuel » au lieu d'une chaîne vide.
  L'annulation aurait été refusée comme « inchangée », donc cassée **pour toujours et en silence** —
  le seul symptôme aurait été un message sans aucun sens à cet endroit.
- **M12** — la lecture perdait son `error`. Sur cette page-là, une panne se serait lue « Anam ne
  retient encore rien de précis sur toi. » : le vide s'y confond avec un effacement réussi.

Les trois plus instructifs du reste :

- **M13/M14/M15 [SQL]** — les trois affaiblissements de la contrainte. L'implication simple
  (`supprime ⇒ vide`) laisse repasser la correction vide ; l'implication inverse laisse un tombstone
  garder son art. 9. **L'équivalence était nécessaire dans les deux sens.**
- **M7** — la halte redirige une personne qui a révoqué. C'est le mutant que quelqu'un écrira de
  bonne foi en harmonisant les sept haltes.
- **M9** — la suppression différée de dix secondes. Elle reste « correcte » à l'observation, et elle
  ment : un onglet fermé dans l'intervalle, et rien n'a été effacé.

### Deux gardes existantes ont rougi, et les deux avaient raison

**`faits-architecture.test.ts`** — la première version de `lire-memoire.ts` écrivait
`.from("fait_extrait")`. Le dépôt exige que ce littéral n'apparaisse NULLE PART dans le code
applicatif : tout passe par une fonction possédée. J'ai suivi le patron plutôt que d'affaiblir la
garde — d'où `charger_faits_retenus` dans 0056. Le gain n'est pas cosmétique : la FORME de ce qui
sort d'une table art. 9 est décidée en un seul endroit auditable, et la jointure vers le journal
devient explicite au lieu de reposer sur l'inférence de relation de PostgREST.

**`cible-tactile.test.ts`** — le champ de correction portait
`min-height: calc(var(--cible-tactile) * 2)`. La garde exige la forme EXACTE, et elle a raison : une
expression peut dériver sous les 44 px sans que personne ne le voie.

### Ce que 0056 a cassé ailleurs, et pourquoi c'est une bonne nouvelle

`tests/synthese-sql.test.ts` posait un tombstone portant « CE QU'ELLE A SUPPRIMÉ » — l'état que la
contrainte interdit désormais. La garde ne faiblit pas : **le vecteur de fuite qu'elle surveillait
n'existe plus au niveau du schéma**, ce qui est plus fort qu'un test. La fixture pose maintenant un
tombstone vide, et l'exclusion se prouve par l'égalité exacte du matériau.

### Ce qui n'est PAS dans cette story

- **L'heure de naissance (T17, décision D7).** Voir `action_items` de `sprint-status.yaml` sous le
  nom **6.5b**. L'AC6 borne cette story à la couche des faits extraits, et corriger l'heure invalide
  le thème natal gravé — c'est un autre travail.
- **Le menu de compte.** `/memoire` n'est atteignable que par URL, comme les six autres haltes.
  Dette commune, déjà inscrite.
- **La revue produit de la contre-métrique**, qui appartient à la 6.4.

### Fichiers

**Créés** — `supabase/migrations/0056_fait_extrait_coherence.sql`, `lib/domain/memoire-retenue.ts`,
`lib/domain/copie-memoire.ts`, `lib/data/lire-memoire.ts`, `app/memoire/{page.tsx,actions.ts}`,
`render/memoire/{Memoire.tsx,memoire.module.css}`, `tests/memoire-retenue.test.ts` (64),
`tests/memoire-sql.test.ts` (12), `tests/memoire-actions.test.ts` (11),
`tests/rendu/memoire.test.tsx` (14).

**Modifiés** — `tests/faits-architecture.test.ts` (la nouvelle RPC de lecture, confinée à son dépôt),
`tests/synthese-sql.test.ts` (la fixture de tombstone).

### Change Log

| Date | Quoi |
|---|---|
| 2026-08-16 | Story implémentée. Migration `0056`, déployée cloud (parité 56/56/56). 15 mutants, 15 tués. |
| 2026-08-16 | ⚠️ Trou trouvé et fermé dans la machine à états de 4.2 : une correction VIDE était acceptée et produisait une ligne ni affichable ni tombstone. |
