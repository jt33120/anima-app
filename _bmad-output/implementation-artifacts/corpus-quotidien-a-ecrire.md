# Le socle quotidien — 87 textes à écrire

**Pour Anima.** Deuxième fiche d'écriture, après les 69 textes de numérologie
(`corpus-numerologie-a-ecrire.md`). Même règle, et elle ne bouge pas : personne d'autre ne peut
écrire ces textes — ni Anam, ni un modèle de langage, ni un texte acheté ou repris ailleurs
(FR-054), et **une parole attribuée à Anima qu'Anima n'a pas dite est un défaut critique** (FR-086).

Le code est en place et il attend. Aujourd'hui l'application calcule tout — la position réelle des
planètes du jour, ce qu'elles touchent dans le thème de chacune — et dit honnêtement, créneau par
créneau : *ce texte n'est pas encore écrit.*

Tu peux les écrire **dans n'importe quel ordre et à n'importe quel rythme.** Chaque texte livré part
en ligne tout seul.

---

## Ce que l'application montre chaque jour

Deux choses, très différentes l'une de l'autre :

| | Ce que c'est | Pour qui |
|---|---|---|
| **Le mantra du jour** | Un texte court, posé. Il ne parle de personne en particulier. | **Le même pour tout le monde**, ce jour-là |
| **L'horoscope du jour** | Ce que le ciel d'aujourd'hui touche dans SON thème de naissance | Différent pour chacune |

⚠️ **Le mantra n'est pas signé.** Ce n'est pas Anam qui parle : c'est un texte posé là. Il ne dit
jamais « je », il ne s'adresse pas à quelqu'un en particulier, il ne demande rien — pas de série,
pas de « tu as manqué hier », pas de « reviens demain ». C'est ce qui rend un rendez-vous quotidien
supportable.

⚠️ **Un mantra n'est pas un ancrage.** Le mantra est court, gratuit, on le lit et c'est fini.
L'ancrage (plus tard) est un exercice guidé de deux à cinq minutes. Les deux ne se confondent jamais.

---

## La règle qui compte le plus : **ne jamais prédire**

C'est *la* difficulté de cette fiche, et elle est propre à l'horoscope : le genre tout entier — celui
des magazines — est bâti sur la prédiction. « Aujourd'hui, Mars te pousse à agir », c'est exactement
la phrase qu'on attend d'un horoscope, et exactement celle qui est interdite ici (FR-053).

Un contrôle automatique refuse le texte avant sa mise en ligne. Il attrape le **futur adressé** :

| ❌ Refusé | ✅ Accepté |
|---|---|
| « Tu vas ressentir une tension. » | « Une tension entre ce qui pousse et ce qui retient. » |
| « Cette journée t'apportera de la clarté. » | « Une journée où les contours se voient mieux. » |
| « Tu pourras avancer. » | « Tu peux avancer. » |
| « Une rencontre t'attend. » | *(rien de tel — c'est une prédiction même sans verbe au futur)* |

La sortie n'est pas de contourner le contrôle : **un aspect DÉCRIT une configuration du ciel, il
n'annonce rien.** Écrire ce qui est, pas ce qui va arriver.

Les mots proscrits partout dans l'application le sont ici aussi : le **verbe « soigner »**, « prends
soin de », et tout le vocabulaire clinique (thérapie, dépression, anxiété, symptôme…).

---

## Partie 1 — Les 60 mantras

Un cycle de deux mois : le mantra du 1ᵉʳ jour revient soixante jours plus tard. Il n'y a pas
d'archive en v1 — personne ne peut relire celui d'hier.

**Format :** court. Une à trois phrases. Pas de titre, pas de signature.

**Créneaux :** `mantra:1` … `mantra:60`

*(L'ordre n'a aucune importance : le cycle est une rotation, pas une progression. `mantra:1` n'est
pas « le premier » de quoi que ce soit.)*

- [ ] `mantra:1` — [ ] `mantra:2` — [ ] `mantra:3` — [ ] `mantra:4` — [ ] `mantra:5`
- [ ] `mantra:6` — [ ] `mantra:7` — [ ] `mantra:8` — [ ] `mantra:9` — [ ] `mantra:10`
- [ ] `mantra:11` … `mantra:60` *(même forme, cinquante de plus)*

---

## Partie 2 — Les 12 textes de la Lune du jour

**C'est la partie la plus utile à écrire en premier** : ces douze textes sortent **tous les jours**,
pour tout le monde. Sans eux, l'horoscope est vide la moitié du temps.

La Lune fait le tour du zodiaque en 27 jours. Chaque jour, elle se trouve à une certaine **distance
du signe solaire de la personne** — de 0 (la Lune est dans son signe) à 11 (elle est dans le signe
juste avant). Cette distance change tous les deux ou trois jours.

| Créneau | Ce que ça désigne |
|---|---|
| `lune_relative:0` | La Lune traverse **son** signe |
| `lune_relative:1` | Le signe suivant le sien |
| `lune_relative:2` | Deux signes plus loin |
| `lune_relative:3` | Trois signes — un carré |
| `lune_relative:4` | Quatre signes — un trigone |
| `lune_relative:5` | Cinq signes |
| `lune_relative:6` | À l'opposé de son signe |
| `lune_relative:7` | Sept signes |
| `lune_relative:8` | Huit signes — un trigone, de l'autre côté |
| `lune_relative:9` | Neuf signes — un carré, de l'autre côté |
| `lune_relative:10` | Dix signes |
| `lune_relative:11` | Le signe juste avant le sien |

*(Ces lectures sont indicatives — c'est toi qui sais. Si l'une ne correspond pas à ta pratique,
dis-le : c'est la définition qui change, pas ton texte.)*

**Format :** deux à quatre phrases. Le texte parle de la journée telle qu'elle se présente, jamais
de ce qu'elle apportera.

---

## Partie 3 — Les 15 textes d'aspect

Certains jours — environ un sur deux — une planète rapide (Lune, Soleil, Mercure, Vénus, Mars) forme
un angle net avec l'un des **trois points qui comptent** dans le thème de naissance. C'est ce qui
fait qu'un jour ne ressemble pas au précédent.

L'application ne retient **que la configuration la plus serrée** du jour : un seul texte sort.

| | **le Soleil natal** | **la Lune natale** | **l'Ascendant** |
|---|---|---|---|
| **Conjonction** (superposé) | `aspect:conjonction:soleil` | `aspect:conjonction:lune` | `aspect:conjonction:ascendant` |
| **Sextile** (60°, fluide) | `aspect:sextile:soleil` | `aspect:sextile:lune` | `aspect:sextile:ascendant` |
| **Carré** (90°, tension) | `aspect:carre:soleil` | `aspect:carre:lune` | `aspect:carre:ascendant` |
| **Trigone** (120°, aisance) | `aspect:trigone:soleil` | `aspect:trigone:lune` | `aspect:trigone:ascendant` |
| **Opposition** (180°, face à face) | `aspect:opposition:soleil` | `aspect:opposition:lune` | `aspect:opposition:ascendant` |

**Le texte ne nomme pas la planète qui transite** — c'est volontaire. L'écrire cinq fois (une par
planète) ferait 75 textes au lieu de 15. Le texte parle de **ce qui est touché** (le Soleil, la
Lune, l'Ascendant) et de **comment** (l'aspect). La planète, elle, s'affiche à côté comme un fait.

⚠️ **`aspect:*:ascendant` ne sort que pour les personnes qui ont donné leur heure de naissance.**
Sans heure, il n'y a pas d'ascendant — et l'application ne l'invente pas.

---

## Par où commencer

| Priorité | Quoi | Combien | Pourquoi |
|---|---|---|---|
| **1** | Les 12 `lune_relative` | 12 | Ils sortent **tous les jours, pour tout le monde**. Sans eux, la carte est vide un jour sur deux. |
| **2** | Les 15 `aspect` | 15 | C'est ce qui fait qu'un jour se distingue du précédent. |
| **3** | Les 60 `mantra` | 60 | Les plus longs à produire, mais chacun part en ligne dès qu'il est écrit. |

**27 textes** suffisent à rendre l'horoscope quotidien vivant.
