---
baseline_commit: f7f7811
---

# Story 6.4 : Le geste de pause

Status: review

## Story

En tant qu'utilisatrice,
je veux qu'Anam me propose de laisser respirer quand mon rythme s'intensifie, sans jamais m'imposer
de pause,
afin que la relation reste soutenable et que personne ne me punisse d'être calme ou active.

**Couvre :** FR-036 · contre-métrique de dépendance du PRD (« plus de 5 sessions par semaine ou plus
de 60 min/semaine ») · NFR-015 (aucune notification) · NFR-002 (journalisation sans art. 9) · AD-17
(fenêtre de détresse) · renvoi FR-031 (aucun compteur à l'écran), FR-034 (aucun message générique
récurrent), FR-084 (trois phrases).

**Ne couvre PAS :** la revue produit elle-même (la story pose la trace, pas le tableau de bord), ni
aucune modification du protocole de détresse.

---

## Ce que cette story livre, en une phrase

Anam dit **une fois par mois au maximum**, dans le fil et de sa propre voix, qu'il est permis de
laisser reposer — et le produit ne fait **rien d'autre** : aucun verrou, aucune minuterie, aucun
compteur, aucune notification, et rien du tout quand la semaine est calme.

---

## ⚠️ LA STORY LA PLUS FACILE À RATER PAR EXCÈS DE ZÈLE

Toutes les stories précédentes ajoutaient une capacité. Celle-ci en **retire** une : elle demande au
produit de dire à quelqu'un qu'il peut s'en éloigner. Les trois façons de la rater sont toutes des
formes de zèle.

**La première est le verrou.** Un seuil franchi appelle naturellement une conséquence : griser le
composeur, poser une minuterie, afficher « tu as beaucoup écrit aujourd'hui ». L'AC2 l'interdit
mot pour mot, et la raison n'est pas la douceur : quelqu'un qui écrit beaucoup peut être quelqu'un
qui traverse quelque chose. Un produit qui **ferme la porte au moment de l'intensité** ferme la
porte au pire moment possible. C'est aussi pourquoi la garde de détresse (AD-17) est ici plus
qu'une formalité — voir D8.

**La deuxième est la mesure de l'absence.** Compter les séances pour détecter l'intensité fabrique,
gratuitement et dans le même objet, la capacité de détecter le décrochage. L'AC4 dit l'inverse :
aucune absence n'est constatée, jamais. Rien n'empêche techniquement d'ajouter `if (seances === 0)`
— c'est une ligne. La garde est donc un **test qui prouve qu'une semaine calme ne produit rien du
tout** : pas d'ouverture, pas de ligne en base, pas de courriel, pas de poussée.

**La troisième est le compteur qui traverse.** « Tu as eu 7 séances cette semaine » est
statistiquement vrai, produit une preuve, et viole FR-031 en même temps qu'il transforme une
proposition en bulletin. Le type `Ouverture` n'a **aucun champ numérique**, et
`tests/arbitrage-frontiere.test.ts` existe déjà pour l'empêcher (4.10, AC5).

---

## Critères d'acceptation

- **AC1** — Étant donné qu'une utilisatrice dépasse le seuil de rythme (plus de 5 séances ou plus de
  60 minutes sur 7 jours glissants), **Quand** elle est en conversation, **Alors** Anam propose une
  pause dans le fil, en son registre normal et en trois phrases maximum, **Et** aucune condition de
  retour ni aucun engagement n'est extorqué.
- **AC2** — Étant donné la proposition de pause, **Quand** elle est faite, **Alors** le produit
  n'impose jamais la pause : aucun verrouillage, aucune minuterie, aucun écran « tu as assez utilisé
  l'app », **Et** le composeur reste actif.
- **AC3** — Étant donné qu'Anam a déjà proposé une pause, **Quand** l'utilisatrice continue malgré
  tout, **Alors** la proposition n'est pas répétée en boucle, **Et** le seuil ne redéclenche pas une
  nouvelle proposition avant une fenêtre d'apaisement raisonnable.
- **AC4** — Étant donné une semaine calme, **Quand** l'utilisatrice ne vient pas, **Alors** l'inverse
  est également vrai : aucune absence n'est traitée comme un décrochage et aucun message ne la
  constate.
- **AC5** — Étant donné le franchissement du seuil, **Quand** il est enregistré, **Alors** le cas est
  journalisé pour revue produit sans exposer de contenu art. 9, **Et** la proposition de pause n'est
  jamais portée par une notification : elle vit uniquement en conversation.

---

## Décisions

### D1 — La mesure vient d'`entree_journal`, colonne `cree_le` SEULE. Jamais d'`usage_ia`.

`usage_ia` était le candidat évident : non-art. 9 par construction (aucune colonne de contenu,
commentaire de 0008), déjà horodaté, déjà lu ailleurs (`lire-allocation.ts`). Et il est **faux
ici**.

Il compte les **appels au modèle**, pas les venues de l'utilisatrice — et il porte donc les travaux
de fond : la synthèse périodique (4.9), l'extraction de faits (4.2), la détection de
reconceptualisation (4.4). Une contre-métrique de dépendance qui se déclenche parce qu'un job de nuit
a tourné serait un mensonge, au seul endroit du produit où l'on prétend protéger quelqu'un de son
propre usage.

Le rythme de quelqu'un, c'est **quand elle écrit**. Donc `entree_journal`, `role = 'utilisatrice'`,
et **rien que `cree_le`** : la requête ne sélectionne aucune colonne de contenu. C'est de la
minimisation, pas une précaution de style — le verbatim est de l'art. 9 et il n'a aucune raison de
traverser pour qu'on compte des dates.

### D2 — Une séance est une GRAPPE de tours séparés par au plus 30 minutes de silence

La table `seance` (2.7) ne peut pas répondre : elle porte **un seul état d'arc courant** par
utilisatrice, réécrit à chaque tour (`ecrire_seance`). Ce n'est pas un historique, et lui en faire un
serait réécrire la 2.7 pour une contre-métrique.

Une grappe séparée par un silence est la définition usuelle d'une session et elle se calcule sans
rien persister de plus. Trente minutes : c'est la convention, et elle est généreuse pour un produit
où l'on réfléchit entre deux messages.

⚠️ **La mesure des minutes SOUS-ESTIME, et c'est délibéré.** Une grappe d'un seul tour dure zéro
minute ; le temps passé à lire après le dernier message n'est compté nulle part. Le seuil est donc
plus difficile à franchir qu'il n'en a l'air. C'est la bonne direction du doute : sur-estimer ferait
dire au produit « tu viens trop » à quelqu'un qui ne vient pas trop — soit exactement le jugement
que l'AC4 refuse dans l'autre sens.

### D3 — Le seuil est un OU, et il est STRICT

« Plus de 5 séances **ou** plus de 60 minutes », littéralement le PRD : `> 5` et `> 60`, jamais `>=`.
Cinq séances pile ne franchit rien.

### D4 — La proposition passe par `chargerOuverture`, et elle passe EN PREMIER

`chargerOuverture` est déjà « le seul endroit du produit où l'on décide d'ouvrir » (4.5/4.10). La
pause y entre comme une cinquième variante de l'union `Ouverture`. Deux raisons de la placer **avant
toutes les autres**, et la seconde est mécanique :

1. **Toutes les autres ouvertures invitent à faire PLUS** — une branche à ouvrir, une intégration à
   mener, une hypothèse à explorer. La pause est la seule dont l'objet est de faire moins. Proposer
   une branche à quelqu'un qui vient de franchir le seuil de rythme est très exactement le geste
   inverse de celui que FR-036 demande.
2. **Placée en premier, rien d'autre n'a encore été lu, donc rien ne peut être DÉPENSÉ.** La mention
   de complétion du socle (0045) et l'hypothèse d'ennéagramme se consomment ; placée en dernier, la
   pause les préempterait après coup et l'une des deux serait perdue pour toujours. C'est le défaut
   trouvé en revue 4.10, et il ne se rejoue pas ici.

### D5 — La phrase est une CONSTANTE, pas une génération

Précédent direct : `PHRASE_SOCLE_COMPLETE`, `PHRASE_INVITATION`, `PHRASE_OUVERTURE_HYPOTHESE` vivent
toutes en constantes de `lib/domain/`. La raison propre à cette story est dans l'AC1 : « aucune
condition de retour ni aucun engagement n'est extorqué » est une propriété **du texte**, et aucun
texte engendré ne peut la garantir. Une constante passe les détecteurs (lexique interdit 2.8,
marqueurs de prédiction, FR-023) et un détecteur neuf, propre à cette story : **aucune extorsion
d'engagement** (« promets-moi », « reviens demain », « je t'attends », « tu devrais », un point
d'interrogation qui demande une réponse).

Trois phrases maximum (FR-084), vérifié par le compteur existant.

### D6 — La fenêtre d'apaisement est de TRENTE JOURS, et elle n'a AUCUNE condition de réarmement

Le seuil se mesure sur sept jours glissants. Si elle garde le même rythme, il reste franchi en
permanence : sans fenêtre, la proposition repartirait à chaque ouverture de l'application.

Trente jours, donc — nettement plus que la fenêtre de mesure, pour que la parole reste rare.

⚠️ **Et pas de « réarmé par un mouvement », contrairement à l'invitation d'intégration (4.10, D3).**
Là-bas, le réarmement demandait qu'une branche ait bougé. Ici, le seul « mouvement » observable
serait qu'elle ait ralenti — c'est-à-dire que le produit **vérifie si elle a obéi**. Une fenêtre
plate dit la seule chose acceptable : Anam l'a dit une fois, elle ne le redira pas avant un mois, et
elle ne regarde pas si ça a servi.

### D7 — La réservation EST la décision, en SQL, sur une table sans policy

Patron de `reserver_invitation_integration` (0036) et `reserver_notification` : `security definer`,
`search_path = ''`, verrou consultatif de transaction avec un **sel distinct**, la ligne insérée
étant elle-même la preuve que la parole a été prise.

La table `pause_rythme` est **deny-by-default** (aucune policy créée, comme `usage_ia`/0008,
`probe`/0001, `audit_securite`/0006). C'est la doctrine cardinale du dépôt : `authenticated` détient
le DML sur toute table de `public`, donc une garde qui ne vivrait que dans la RPC ne garderait rien —
on pourrait insérer une ligne pour se faire taire Anam, ou en supprimer une pour la faire parler.

### D8 — La pause est REFUSÉE pendant la fenêtre de détresse, et le refus ne coûte pas la réservation

AD-17. Proposer de « laisser reposer » à quelqu'un qui traverse un épisode de détresse se lit comme
« tu utilises trop cette application » au moment précis où elle en a besoin. La garde est dans la
RPC, en SQL, comme les trois branches de `motifs_anam_du()` (0054).

⚠️ **Elle est évaluée AVANT l'insertion.** Un refus pour cause de détresse ne doit pas consommer la
fenêtre de trente jours : sinon l'épisode de détresse ferait taire la pause pour un mois, et le seul
effet de la garde serait de supprimer la proposition au lieu de la différer.

### D9 — La journalisation d'AC5, c'est la ligne de réservation elle-même

`pause_rythme (utilisatrice_id, propose_le, seances, minutes)`. Les deux compteurs vivent **en base
et nulle part ailleurs** : ils servent la revue produit (la contre-métrique du PRD) et ils ne
traversent jamais vers le client, puisque `Ouverture` n'a aucun champ numérique et que la table est
deny-by-default. Aucune colonne de contenu, donc aucun art. 9 (NFR-002).

### D10 — Aucun canal ne s'ouvre (AC5, seconde moitié)

La 6.3 a déclaré l'ensemble **fermé** des motifs de poussée (`MOTIFS_POUSSEE`, 3) et de courriel
(`MotifCourriel`, 2). Cette story n'en ajoute aucun, et une garde le prouve en comparant les deux
ensembles à leur contenu attendu — la pause vit en conversation, un point c'est tout.

---

## Tâches

- [x] **T1 — Le domaine pur** (`lib/domain/rythme-pause.ts`, AD-1) : `SEUIL_SEANCES`,
      `SEUIL_MINUTES`, `FENETRE_JOURS`, `SILENCE_SEANCE_MINUTES`, `APAISEMENT_JOURS` ;
      `mesurerRythme(horodatages, maintenant)` → `{ seances, minutes }` ; `seuilFranchi(mesure)` ;
      la phrase `PHRASE_PAUSE`.
- [x] **T2 — La migration 0055** : table `pause_rythme` deny-by-default + RPC
      `reserver_pause_rythme(p_seances, p_minutes, p_apaisement_jours)` avec la garde de détresse
      AVANT l'insertion, le verrou consultatif à sel distinct, et le `grant` à `authenticated` seul.
- [x] **T3 — Le dépôt** (`lib/data/depot-rythme.ts`) : lecture des `cree_le` de `entree_journal`
      (`role = 'utilisatrice'`, fenêtre de 7 jours, aucune colonne de contenu) + appel de la RPC.
- [x] **T4 — Le branchement** dans `lib/safety/ouverture-branche.ts`, en PREMIER, avec son propre
      `try` (repli sûr : une panne de la pause ne doit pas faire taire les quatre autres ouvertures).
- [x] **T5 — Le rendu** : cinquième cas de `cleDOuverture` et `toursDOuverture` — un tour d'Anam
      ORDINAIRE (comme `socle-complete`), parce qu'il n'y a rien à faire de cette phrase.
- [x] **T6 — Les gardes** : AC2 (composeur actif, aucun verrou nulle part), AC4 (une semaine calme
      ne produit rien), AC5 (aucun motif de canal ajouté), FR-031/FR-084/D5 (détecteurs sur la
      phrase).
- [x] **T7 — Campagne de mutation** (harnais Python à baseline obligatoire).
- [x] **T8 — Vérification complète et commit.**

---

## Dev Notes

**Fichiers à lire avant de toucher :** `lib/safety/ouverture-branche.ts` (l'ordre des blocs y est
argumenté ligne à ligne — ne pas le réordonner sans lire), `lib/domain/arbitrage-ouverture.ts`
(l'union `Ouverture` et pourquoi elle n'a aucun nombre), `supabase/migrations/0036_intention_arbitrage.sql`
(le patron de réservation), `render/conversation/Conversation.tsx` (`cleDOuverture` et
`toursDOuverture` sont des `switch` exhaustifs — TypeScript refusera d'oublier le cinquième cas).

**Le piège de la clé d'ouverture.** `cleDOuverture` distingue « une nouvelle chose à dire » de « la
même chose re-servie par un rafraîchissement ». La pause n'a rien à distinguer dans un mois donné :
sa clé est constante, comme `s:socle`.

**La discipline de test du dépôt.** `tests/depot-fil.test.ts` (QA T3) est le patron le plus proche :
il tourne contre le VRAI Postgres, parce que la propriété qui compte (« B ne voit pas le rythme de
A ») est portée par la RLS et qu'une doublure la rendrait invérifiable par construction.

---

## Dev Agent Record

### Ce que la campagne de mutation a éprouvé

**15 mutants, 15 tués**, harnais Python à baseline obligatoire (le mode d'échec « aucun test exercé,
donc silence, donc succès » est refusé par construction — quatrième verdict).

Les trois plus instructifs :

- **M14 [SQL] — la garde de détresse déplacée APRÈS l'insertion.** Le refus resterait « correct » à
  l'observation : Anam se tait bien pendant l'épisode. Mais la ligne serait écrite, donc la fenêtre
  consommée — l'épisode ne DIFFÉRERAIT plus la pause, il la SUPPRIMERAIT pour un mois. Un test qui
  ne vérifie que le `false` ne voit pas la différence ; celui qui compte les lignes le voit.
- **M7 — le OU du seuil devenu ET.** Rien ne casse, tout reste vert à l'œil, et personne ne voit
  jamais la phrase. C'est le mode d'échec le plus silencieux de cette story : une fonctionnalité
  morte qui a l'air complète.
- **M11 — la marge du dépôt ramenée à sept jours.** C'est le piège des défenses redondantes : deux
  filtres identiques se couvrent l'un l'autre, et le mutant de la borne du domaine survivrait grâce
  à celle de la requête. La marge d'un jour est ce qui rend la borne du domaine réellement testable.

### Ce qui n'est PAS dans cette story, et qu'il faut savoir

- **La revue produit elle-même.** La story pose la trace (`pause_rythme`, deux compteurs par
  franchissement) ; elle ne construit aucun tableau de bord. La contre-métrique du PRD se lit
  aujourd'hui par une requête `service_role`, et c'est suffisant tant qu'il n'y a pas de volume.
- **Aucun réglage.** Il n'existe pas d'écran pour changer le seuil ni pour demander à Anam de se
  taire. Un tel réglage transformerait la contre-métrique en fonctionnalité, donc en quelque chose
  qu'on optimise.

### Fichiers

**Créés**
- `lib/domain/rythme-pause.ts` — seuils, découpage en grappes, la phrase
- `lib/data/depot-rythme.ts` — la mesure (une seule colonne, une date) et la réservation
- `supabase/migrations/0055_pause_rythme.sql` — table deny-by-default + `reserver_pause_rythme`
- `tests/rythme-pause.test.ts` (24), `tests/pause-rythme-sql.test.ts` (15),
  `tests/rendu/pause-fil.test.tsx` (7)

**Modifiés**
- `lib/domain/arbitrage-ouverture.ts` — cinquième variante de l'union, sans champ numérique
- `lib/safety/ouverture-branche.ts` — le bloc de pause, EN PREMIER, avec son propre repli
- `render/conversation/types.ts` — le miroir de rendu (frontière AD-7)
- `render/conversation/Conversation.tsx` — cinquième cas des deux `switch` exhaustifs
- `tests/ouverture-branche.test.ts` — le bloc D4 (préempter sans rien dépenser)

### Change Log

| Date | Quoi |
|---|---|
| 2026-08-16 | Story implémentée. Migration `0055`, déployée cloud (parité 55/55/55). 15 mutants, 15 tués. |
| 2026-08-16 | ⚠️ Trouvé au déploiement : la migration `0054` (Story 6.3) n'avait JAMAIS été poussée en cloud. Appliquée dans la foulée. |
