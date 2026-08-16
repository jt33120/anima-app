---
baseline_commit: 01a32b4
---

# Story 6.5b : L'heure de naissance corrigeable

Status: review

## Story

En tant qu'utilisatrice,
je veux pouvoir corriger l'heure de naissance que j'ai enregistrée,
afin qu'une faute de frappe ne me condamne pas à un ascendant faux pour toujours.

**Couvre :** QA T17 · RGPD art. 16 (rectification) · FR-064 · AD-6 · AD-13.

---

## Ce que cette story livre, en une phrase

Elle n'écrit **aucun recalculateur** : le recalcul du thème natal existe déjà, il est paresseux, et
il se déclenche tout seul quand l'empreinte des entrées change. Il ne manquait qu'une chose — le
droit de changer l'heure.

---

## La note de suivi se trompait, et il faut le dire

L'item T17 annonçait : « corriger l'heure invalide le thème natal GRAVÉ (5.1) […] Il faut recalculer
et REGRAVER, alors que le write-gate art. 9 de 0039 grave "une seule fois" — la story devra ouvrir
une porte nommée, jamais contourner la garde. »

**0039 n'a jamais gravé une seule fois.** Son trigger `theme_natal_recalcul_declare` autorise
explicitement le recalcul (version + 1 ET empreinte différente), et la 5.3 s'en sert déjà tous les
jours : `lireThemeNatal` compare à chaque lecture l'empreinte gravée à celle des entrées du moment,
et recalcule si elles diffèrent. La porte était ouverte depuis 5.1, et c'est la 5.3 qui l'a
empruntée en premier.

La vraie serrure était ailleurs, sur `utilisatrice` : le trigger `naissance_ecrite_une_fois`
refusait `valeur → autre valeur`. **C'est la seule chose que cette story change.**

Conséquence pratique : le périmètre est passé de « recalcul + regravure + porte nommée » à « un
trigger, un écran, et rien d'autre ». Câbler un recalcul ici aurait rouvert les trois pièges que la
décision D5 de la 5.3 avait fermés — dont celui qui compte : une panne en cours de regravure
laisserait l'heure écrite et le thème périmé, **sans rien pour réessayer**.

---

## Les décisions

### D1 — La correction n'est PAS plafonnée

La première version de la migration disait « corrigible une fois ». C'est défendable côté produit
(FR-051, « le socle ne bouge pas ») et **indéfendable côté droit**.

L'art. 16 du RGPD est un droit inconditionnel à la rectification d'une donnée inexacte. Il ne
s'épuise pas au premier usage. Quelqu'un qui se trompe **dans sa correction** — 04:30 tapé 04:03 —
se retrouverait avec un ascendant faux pour toujours **et** son recours déjà consommé : strictement
pire qu'avant la story. Un plafond ne protégerait pas le socle, il transformerait une faute de
frappe en condamnation.

Ce qui protège FR-051 est donc autre chose :

1. une correction exige un **changement réel** (`is distinct from`) — réécrire la même heure n'en
   est pas une et n'est pas comptée ;
2. chaque correction est **comptée et datée par le serveur**, jamais par l'appelante ;
3. surtout : **elle n'est jamais aveugle** (D2).

### D2 — L'aperçu remplace le plafond

L'écran calcule le thème que produirait la nouvelle heure **avant d'écrire quoi que ce soit** —
`calculerThemeNatal` est pur (AD-6), donc on peut le faire sans rien graver — et montre l'ascendant
gagné et l'ascendant perdu. Deux temps, deux gestes.

⚠️ **L'aperçu doit savoir annoncer un APPAUVRISSEMENT.** Une correction peut faire *perdre* des
corps (une heure qui rend un signe ambigu). `corpsRegagnes` peut donc être négatif, et un
`Math.max(0, …)` posé « par propreté » ferait rougir un test nommé. Un aperçu qui ne saurait
annoncer que des gains mentirait exactement dans le cas où elle a le plus besoin de la vérité.

Et l'écriture envoie **l'heure de l'aperçu**, pas celle du champ : modifier le champ après avoir
regardé retire le bouton. Sans ça, l'aperçu serait un décor.

### D3 — Le LIEU reste write-once, et ce n'est pas un oubli de périmètre

L'art. 16 vaut pour le lieu aussi. La raison du refus est technique, et elle est décisive : le lieu
est **quatre colonnes solidaires** (nom, latitude, longitude, fuseau), re-résolues côté serveur
depuis un seul code INSEE. Un trigger ne peut pas vérifier qu'elles viennent de la même commune.
Ouvrir la porte permettrait de corriger la seule latitude et d'obtenir un nom de commune d'un côté,
des coordonnées d'une autre — plausible, invérifiable, faux.

L'heure, elle, est **une** colonne : sa correction ne peut pas être à moitié faite.

**DETTE NOMMÉE** : corriger son lieu exigera une RPC qui prend un code INSEE et pose les quatre
colonnes en un seul geste. Tant qu'elle n'existe pas, le refus est honnête, pas paresseux.

### D4 — Un effacement n'est pas une rectification

`valeur → null` reste refusé, par un motif propre (`naissance_effacement_refuse`). L'art. 17 a sa
porte (`effacer_toutes_mes_donnees`, 0058) et elle emporte tout le compte. Laisser une entrée
revenir à `null` par ce chemin-ci ferait surtout retomber le thème en `midi_par_defaut` sans le dire.

### D5 — Corriger fait bouger une donnée art. 9, donc la correction est gatée

Les *entrées* de naissance ne sont pas art. 9 (0039 le dit, et il a raison). Mais une *correction*
n'a qu'un seul effet : faire regraver le thème natal, qui l'est. Sans cette garde, quelqu'un qui a
révoqué son consentement corrigerait son heure et obtiendrait… rien : l'entrée changée, le thème
figé sur l'ancienne, **et aucune erreur nulle part**.

### D6 — La trace est montrée en DATE, jamais en NOMBRE

La base compte (piste d'audit) ; l'écran montre « tu as déjà corrigé ton heure, le 16 août 2026 ».
« Tu as corrigé 3 fois » est un compteur, et FR-031 les refuse. C'est l'arbitrage déjà rendu à dix
centimètres de là, où la 6.5 affiche « Tu as réécrit cette phrase. » sans jamais dire combien de fois.

---

## ⚠️ Une propriété non prévue, mesurée par un test rouge, et conservée

La garde de D5 s'appuie sur `a_consenti_art9()`, qui s'appuie sur `auth.uid()`. **Le rôle système
n'a pas d'identité, donc il n'a jamais de consentement, donc AUCUN CHEMIN SYSTÈME NE PEUT CORRIGER
UNE ENTRÉE DE NAISSANCE.** Ni un job, ni un script, ni un support.

Ce n'était pas visé. C'est plus fort que ce que la story cherchait, et c'est la bonne direction pour
la donnée d'où dérive tout le socle : **une correction est toujours SON geste à elle, jamais un
geste fait sur elle.** Le prix est nommé — un correctif d'urgence exigerait de désactiver le trigger
à la main, c'est-à-dire un geste visible et délibéré.

---

## Deux messages devenus faux, réparés

La 5.3 affirmait « ton heure ne se modifie pas » et faisait cocher « ce que j'enregistre ici
s'enregistre une seule fois et ne pourra plus être modifié ». C'était vrai jusqu'à 0060.

**Un écran qui affirme une impossibilité levée est pire qu'un écran muet : il fait renoncer
quelqu'un à un droit qu'il a.** Les deux phrases disent maintenant exactement ce qui est vrai — la
commune ne bouge plus, l'heure reste corrigeable depuis `/memoire`.

---

## Dev Agent Record

### Une garde existante a mordu, et elle avait raison

| Garde | Ce qu'elle refusait | Ce qu'on a fait |
|---|---|---|
| `astro-architecture` (liste blanche des points de composition) | `lib/data/corriger-naissance.ts` compose l'adaptateur d'éphéméride | **déclaré** sur la liste, avec sa raison : c'est le seul point du produit qui calcule un thème **sans l'écrire** |

Une régression assumée : `theme-natal-sql.test.ts` exigeait « valeur → AUTRE valeur : refusé ».
L'assertion a été **retournée**, avec l'explication en tête du test — c'est le sens de la story.

### Ce que la campagne de mutation a trouvé

**31 mutants, 31 tués** — en trois passages. Sept survivants au premier :

- **M16 et M31 : deux mutants ÉQUIVALENTS, c'est-à-dire deux fautes à moi.** M16 mutait une
  condition **morte** (`actuelle !== null &&` devant `heure === actuelle`, où `heure` est toujours
  une chaîne) : la condition a été **retirée du code** plutôt que couverte par un test qui n'aurait
  rien mesuré. M31 changeait un import déjà déclaré sur la liste blanche ; réécrit en « un point de
  composition **non** déclaré apparaît », qui est ce que la garde existe pour attraper.
- **M7, M18, M30 : trois vrais trous.** Rien n'exerçait la barrière de minorité ; rien n'isolait un
  changement de précision seul (tous les autres cas font bouger l'ascendant *en même temps*) ; et
  surtout **rien n'exerçait `apercuDeCorrection`** — le test de rendu la remplaçait par un `vi.fn`,
  le test de domaine ne la voyait pas. Un aperçu qui aurait comparé le thème d'avant avec lui-même
  aurait affiché « rien ne change » quelle que soit l'heure, sans qu'un test rougisse. C'est
  exactement le patron de 6.8 (M25-M28), et c'est l'aperçu qui remplace le plafond : s'il ment, la
  story n'a plus de justification.
- **M11 et M23 : deux gardes que RIEN ne peut mesurer, gardées par leur FORME, et c'est dit.**
  - M11 (les deux CHECK de cohérence) : le trigger est un BEFORE UPDATE qui repose lui-même les deux
    colonnes ; une écriture incohérente est normalisée **avant** que la contrainte ne soit évaluée.
    Les CHECK ne servent que le jour où le trigger sera désactivé ou contourné.
  - M23 (le fuseau de la date affichée) : retirer `timeZone: "Europe/Paris"` ne change **rien** sur
    une machine réglée sur Europe/Paris — c'est-à-dire celle de développement. La 6.6 avait heurté le
    même mur (M14) et s'en était sortie en changeant l'heure du test, ce qui n'est possible que si
    les deux fuseaux diffèrent.

  Dans les deux cas la garde lit la SOURCE, comme la 6.1a garde les 60 h de l'homme mort en lisant
  la définition SQL. C'est plus faible qu'une mesure, et le test le dit en toutes lettres.

### Une erreur de banc, à ne pas reproduire

Un premier jet du test d'aperçu mesurait « rien ne change » sur un compte **sans coordonnées** :
sans latitude ni fuseau, les angles sont `non_calcule` et l'ascendant vaut `null` des deux côtés.
Un test vert sur un instrument débranché. Le compte de test pose désormais le lieu dès sa création.

### Vérification

- **265 fichiers / 4515 tests** verts ; `tsc --noEmit`, `eslint .`, `next build` propres
- `supabase db reset` : 0001 → 0060 appliquées
- **Cloud** : les deux colonnes présentes, trigger `utilisatrice_naissance_corrigible` en place,
  **`naissance_ecrite_une_fois` supprimée (0 occurrence)**, les deux CHECK présents, et l'UPDATE sur
  les colonnes de trace accordé à `service_role`/`postgres` **seulement** — jamais `authenticated`

### ⚠️ Le harnais SQL a saturé, et le diagnostic vaut d'être écrit

Après la campagne de mutation, la suite complète est passée de 87 s à **746 s**, avec **36 fichiers
SQL en expiration**. Un `supabase db reset` n'y a rien changé ; un `supabase stop && start` a tout
remis à zéro (265/265 verts en 87 s). Ce n'est pas un défaut produit : ce sont les conteneurs qui
restent chargés après quelques milliers d'allers-retours. La 6.8 avait vu la première marche de
cette pente (« trois fichiers rougis une fois chacun ») ; on connaît maintenant le remède.

### Dette laissée

- **Le lieu de naissance reste incorrigible** (D3), avec la RPC qui le débloquerait, nommée.
- **`/memoire` n'est atteignable que par URL**, comme les autres haltes — dette commune déjà inscrite.

---

## Change Log

| Date | Ce qui change |
|---|---|
| 2026-08-16 | Story livrée. Migration 0060 déployée cloud. 31/31 mutants tués. Ferme la QA T17. |
