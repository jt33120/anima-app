---
baseline_commit: 6e67642
---

# Story 6.6 : L'export complet

Status: review

## Story

En tant qu'utilisatrice,
je veux exporter l'intégralité de mes données sans friction dissuasive,
afin d'emporter tout ce qu'Anam sait de moi quand je le décide.

**Couvre :** FR-067 (volet export) · AD-4 (frontière art. 9), AD-12 (accès lié à l'utilisatrice),
NFR-002 (rien vers un outil d'analyse), NFR-003 (les transcriptions conservées sont incluses),
NFR-005 (traitement couvert par l'AIPD) · renvoi FR-071 (l'export d'une adolescente barrée).

---

## Ce que cette story livre, en une phrase

L'export existait déjà — et il servait **quatre couches sur vingt-neuf**. Cette story ne l'ajoute
pas : elle l'élargit, et surtout elle rend l'exhaustivité **vérifiable au lieu d'être promise**.

---

## Ce qui existait, et ce qui manquait

La Story 1.9 avait ouvert `/api/export` pour tenir sa promesse « un export proposé avant
suppression », en écrivant noir sur blanc : *« SCOPE 1.9 : export MINIMAL et honnête […] l'export
EXHAUSTIF FR-067 est la Story 6.6, qui élargira ce seam. »*

| | 1.9 | 6.6 |
|---|---|---|
| Couches servies | 4 (compte, consentement, synthèses, préférence de courriel) | **29** |
| Journal brut, branches, faits, thème natal, lectures | absents | présents |
| Format | JSON | un HTML lisible **portant le JSON complet** |
| Exhaustivité | affirmée | **gardée par le corpus de migrations** |

⚠️ **On a élargi celle-ci, on n'en a pas ouvert une seconde.** Deux exports coexistants auraient été
le pire résultat possible : `/barriere` aurait continué de pointer vers l'ancien, et une adolescente
barrée — précisément celle qui a trente jours pour tout emporter (FR-071) — serait repartie avec
quatre morceaux en croyant tout tenir. Une garde interdit désormais qu'une deuxième route serve un
fichier.

---

## Les décisions

### D1 — Une porte `security definer`, contre la lettre d'AD-12, et pour sa raison d'être

AD-12 exige que le contenu utilisateur se lise sous l'identité de l'utilisatrice, RLS active. Une
lecture table par table sous le JWT respecterait la lettre — et produirait un export **faux**.

Mesuré sur la base au 2026-08-16 : sur les 29 tables qui portent quelque chose d'elle, **onze sont
deny-by-default et le resteront** (`episode_detresse`, `audit_securite`, `usage_ia`, `seance`,
`pause_rythme`, `invitation_integration`, `notification_envoyee`, `information_reconduction`…).
Sous le JWT, chacune rend **zéro ligne sans erreur**. L'export aurait été vert, complet en
apparence, et muet sur onze couches — et sur cet écran-là, un vide se lit « le produit ne sait rien
de moi ».

Les deux issues étaient : ouvrir onze policies de lecture (élargir définitivement la surface de
lecture de l'application pour un seul écran), ou **une porte nommée**. Porte nommée, comme
`charger_faits_actifs`, `rappels_echeance_dus`, `motifs_anam_du`.

Le prix est réel et il est payé : chaque sous-requête porte son `where utilisatrice_id = v_uid`, une
seule oubliée fuiterait tout, et **deux utilisatrices semées dans les 29 tables** l'éprouvent à
chaque exécution de la CI (M1/M2/M3 de la campagne).

### D2 — Un seul fichier, HTML, portant le JSON complet

Deux droits tirent dans deux directions. L'article 15 veut qu'elle **comprenne** ; l'article 20 veut
qu'une machine puisse **reprendre**. Un JSON brut honore le second et se moque du premier. Et
proposer les deux, c'est poser une question — « quel format ? » — à quelqu'un qui n'a pas à savoir
ce qu'est un format ; l'AC1 interdit le questionnaire, et un choix technique posé sur le chemin en
est un.

Un HTML qui s'ouvre partout, hors ligne, pour toujours — et qui porte le document complet dans un
`<script type="application/json" id="donnees-brutes">`. Un clic, un fichier, les deux droits.

### D3 — `application/octet-stream`, jamais `text/html`

Le corps est du HTML fabriqué avec **son texte à elle**. Servi en `text/html` depuis notre origine,
il suffirait qu'un navigateur ignore le `Content-Disposition` pour que tout ce qu'elle a écrit
s'exécute dans l'origine de l'application. L'échappement existe — mais une seule défense, sur un
chemin dont le contenu est intégralement contrôlé par l'utilisatrice, c'est une défense de trop peu.

### D4 — Deux capacités retirées, et déclarées

`abonnement_poussee.cle_p256dh` / `.cle_auth` et `preference_courriel.jeton` ne sont pas des données
**sur** elle : ce sont des **capacités** — de quoi pousser une notification sur son appareil, de quoi
la désabonner sans être elle. Les mettre dans un fichier qu'elle va transporter, c'est fabriquer une
fuite de pouvoir sans rien lui apprendre. **Les lignes, elles, sortent** : elle voit qu'un appareil
est abonné et depuis quand. Le retrait est **annoncé dans le document lui-même** — un export qui
cache ce qu'il retire ment deux fois.

### D5 — `episode_detresse`, `audit_securite`, `usage_ia`, `seance` sont DANS l'export

Ce sont des données à caractère personnel la concernant (art. 15). Lui refuser l'accès à la façon
dont le système l'a classée, ce serait garder pour nous **le seul jugement que le produit porte sur
elle**.

### D6 — `revoque` n'est pas redirigé

Même décision qu'en 6.5 et pour la même raison : l'accès (art. 15) survit à la révocation, comme
l'effacement (art. 17). `barre`, en revanche, l'est — `/barriere` porte déjà le même lien d'export,
et c'est la page qui lui explique où elle en est. **La route, elle, ne pose aucune garde
d'onboarding** : la seule condition pour exporter est d'être soi.

---

## Le cœur : l'exhaustivité est *gardée*, pas promise

Un export complet écrit à la main est complet **le jour où on l'écrit**. La 6.7 ajoutera une table,
la 6.8 une autre, et l'export continuera de répondre « voici tout » en ayant cessé d'être vrai.
Aucune erreur ne se produira : le fichier sera juste plus court, et personne ne compte les sections
d'un export — surtout pas la personne à qui il est destiné, qui ne sait pas ce qui devrait s'y
trouver.

La charge est donc inversée, sur trois étages :

1. **`lib/domain/inventaire-export.ts`** déclare un verdict pour **chacune des 35 tables** du schéma.
2. **`tests/export-inventaire.test.ts`** lit le corpus de migrations : toute table créée sans verdict
   **casse le build**. Il vérifie aussi que les clés de la RPC == les tables « inclus », exactement.
3. **`rendreExportLisible` itère sur les clés du DOCUMENT, jamais sur l'inventaire** : une section
   que la base rendrait sans que le rendu la connaisse est rendue quand même. C'est ce qui empêche
   qu'une table ajoutée demain disparaisse en silence du fichier lisible — le seul endroit où
   personne n'irait vérifier.

⚠️ **Ce n'est pas la même liste que celle de l'effacement (6.7)**, et il ne faudra pas les fusionner
à la légère : `execution_job` est hors export (elle ne lui apprend rien) et devra pourtant
disparaître avec elle. Exporter et effacer répondent à deux droits différents.

---

## Deux gardes existantes ont mordu, et on les a suivies

| Garde | Ce qu'elle refusait | Ce qu'on a fait |
|---|---|---|
| `faits-architecture` / `rappel-architecture` | le littéral `fait_extrait` / `resume_glissant` hors du dépôt possédé | exclusion **prouvée** : un test mesure à chaque exécution que l'inventaire n'a aucun accès base (AD-1) |
| `lexique-voix` | un emoji dans une chaîne destinée à l'utilisatrice | l'emoji retiré du motif d'inventaire |

---

## Tâches

- [x] T1 — `0057_export_donnees.sql` : la RPC possédée, 29 sections, la borne d'identité, la trace
- [x] T2 — `lib/domain/inventaire-export.ts` : le verdict des 35 tables
- [x] T3 — `lib/domain/export-lisible.ts` : le document (échappement, fuseau, annexe JSON)
- [x] T4 — `lib/domain/copie-mes-donnees.ts` : les mots
- [x] T5 — `lib/data/exporter-donnees.ts` : la lecture qui lève au lieu de servir un vide
- [x] T6 — `app/api/export/route.ts` : la route élargie (octet-stream, attachment, nosniff)
- [x] T7 — `app/mes-donnees/page.tsx` + le lien depuis `/reglages`
- [x] T8 — les cinq fichiers de test + les deux gardes existantes réconciliées
- [x] T9 — campagne de mutation, déploiement cloud, parité

---

## Dev Agent Record

### Ce qu'un test a trouvé

`nomFichierExport` rabotait son propre repli : le nettoyage `[^\d-]` s'appliquait aussi à la chaîne
`sans-date`, produisant `anam-mes-donnees--.html` — un nom qui ne dit plus rien et se confond avec le
suivant dans un dossier de téléchargements.

### Ce que la campagne de mutation a trouvé

**M14 a survécu au premier passage.** Le test du nom de fichier utilisait `23 h 30 UTC` : Paris (le
17 à 01 h 30) et la machine du test (UTC+14, le 17 à 13 h 30) tombent le **même jour**. Le nom était
donc identique avec ou sans fuseau — le test était vert en ne prouvant rien. Repris à `21 h UTC`,
où les deux jours divergent.

À noter : le fichier de test **déplace le fuseau de la machine** (`process.env.TZ`) avant tout
import. Sans ça, sur une machine réglée à Paris, un rendu ayant oublié `timeZone` donnerait
exactement le bon résultat — vert chez le développeur, faux en production (Vercel vit en UTC).

### Vérification

- **255 fichiers / 4323 tests** verts ; `tsc --noEmit`, `eslint .`, `next build` propres
- `supabase db reset` : 0001 → 0057 appliquées
- **Campagne de mutation : 19 mutants, 19 tués** (18 au premier passage, M14 après correction du test)
- **Cloud** : parité 57 fichiers / 57 local / 57 cloud ; `exporter_mes_donnees` présente,
  `prosecdef = true`, `provolatile = v`, exécutable par `authenticated`, **refusée à `anon`**

### Dette laissée

- `/mes-donnees` n'est atteignable que par URL et par le lien de `/reglages` — la dette du menu de
  compte reste commune aux sept haltes.
- L'export construit le document entier en mémoire. Borné par son propre historique, donc sans objet
  avant la mise en ligne ; à revoir si une utilisatrice dépasse plusieurs milliers de tours.
- **AC3, volet AIPD** : « le traitement est couvert par l'AIPD réalisée avant mise en ligne » est une
  **porte pré-lancement humaine**, pas du code. Elle reste ouverte.

---

## Change Log

| Date | Ce qui change |
|---|---|
| 2026-08-16 | Story livrée. Migration 0057 déployée cloud. 19/19 mutants tués. |
