---
baseline_commit: 5f3b7301b6ba0bba53dbcfd5991e321d0e39c4bc
story_key: "5-5-enneagramme-test-court-hypothese-anam"
epic: 5
story: 5
title: "L'ennéagramme — test court ou hypothèse d'Anam"
epic_name: "Le socle & la lecture"
covers: [FR-052, FR-054, FR-055, FR-053, FR-031, FR-006, FR-009, FR-037, FR-072, FR-086, AD-3, AD-4, AD-5, AD-12, AD-13, AD-16, AD-17, NFR-008, NFR-009, NFR-010, NFR-015, NFR-017]
depends_on:
  - "1-5-consentement-art9-declaration-ia"
  - "4-5-naissance-branche-anam-propose-utilisatrice-valide-nomme"
  - "4-7-cycle-vie-branche-monotone-gardee-ecriture"
  - "5-3-degradation-gracieuse-sans-heure-completion-tronc"
prepare_pour:
  - "5-6-accueil-bibliotheque-en-cartes"
  - "6-5-ce-quanam-retient-consulter-corriger-supprimer"
status: review
migration: "0049_enneagramme.sql"
---

# Story 5.5 : L'ennéagramme — test court ou hypothèse d'Anam

> **Ce que cette story a de particulier.** Les quatre stories précédentes du socle décrivaient **le
> ciel**. Celle-ci décrit **la personne**. « Ton Soleil est en Balance » est une position
> astronomique ; « tu es un 4 » est une affirmation sur qui elle *est*. C'est la première fois que
> le produit range quelqu'un dans une case, et c'est exactement ce que FR-006 interdit de faire en
> verdict.
>
> Trois pièges dominent, tous du type « ça marche, et c'est faux ». Les trois ont été **mesurés
> contre les vrais modules du dépôt le 2026-08-13**, pas déduits :
>
> **(1) « Jamais assénée » n'est gardé par rien.** J'ai passé `"Tu es un 4."` et
> `"Ta blessure fondamentale est l'abandon."` dans `chercherPredictions` **et**
> `chercherInterdits` : **les deux sont VERTS**. Aucune garde de ce dépôt ne regarde l'affirmation
> péremptoire au présent sur la personne. La seule trace d'anti-assènement est de la prose dans un
> prompt (`lib/domain/consigne-voix.ts:29-32`), dont la seule vérification mécanique est qu'elle est
> *présente dans le prompt* (`tests/consigne-voix.test.ts:19-21`). Si on laisse le modèle **rédiger
> la phrase**, l'AC2 est livrée avec zéro garde exécutable.
>
> **(2) Le détecteur de prédiction est aveugle à la troisième personne.** Tous les motifs
> `futur_adresse` sont ancrés sur `tu` (`lib/domain/marqueurs-prediction.ts:104-114`, le fichier
> l'assume : « la sélectivité vient du destinataire »). Or un portrait d'ennéagramme s'écrit **sur le
> type**. Mesuré : `"Le 4 finira par se sentir seul."` → **VERT**. `"Le 9 évitera le conflit jusqu'à
> l'effacement."` → **VERT**. `"Le 2 développera un ressentiment silencieux."` → **VERT**. Le jour
> où Anima livre les neuf textes, **un corpus intégralement prédictif passerait la CI au vert**.
>
> **(3) Le lexique médical ne bannit que le substantif.** Mesuré : `"Le 6 vit dans l'anxiété."` →
> rouge, mais `"Le 6 est anxieux."` → **VERT**, et `"Le 5 est évitant et obsessionnel."` → **VERT**.
> Or l'adjectif attribut est *la* formulation canonique de la littérature ennéagramme. Le registre
> clinique — anxieux, évitant, obsessionnel, phobique — peut entrer intégralement dans le produit
> sans qu'aucun contrôle bloquant ne morde. Et l'amont est explicite : « une seule phrase du mauvais
> côté fait rejeter l'app lors de la revue **et change le régime juridique applicable** »
> (`addendum.md:139`, NFR-008 / NFR-010 / App Store 4.3(b)).
>
> **Les deux détecteurs se réparent AVANT d'écrire la première ligne de domaine** (T1). Les réparer
> après, c'est réparer une garde en ayant déjà écrit le code qu'elle devait garder.

---

## Story

**En tant qu'**utilisatrice,
**je veux** découvrir mon type d'ennéagramme soit par un test court, soit par une hypothèse qu'Anam
me propose sans l'asséner,
**afin d'**avoir le choix du chemin.

---

## Critères d'acceptation

1. **[FR-052 / FR-054]** **Étant donné** le test court, **quand** l'utilisatrice le complète,
   **alors** le type est déterminé par un **score calculé** — fonction pure, aucun modèle de langage,
   départage d'ex æquo **total et documenté** —, **et** l'écran de résultat s'appuie sur le **corpus
   d'Anima** (neuf créneaux déclarés, tous `non_ecrit` en v1, affichés honnêtement comme tels).

2. **[FR-052 / AD-3]** **Étant donné** l'alternative conversationnelle, **quand** Anam propose une
   hypothèse de type, **alors** l'appel passe par `AiPort` sous `envoyerSousEgressArt9` (AD-3/AD-4),
   **et** la phrase affichée est une **constante déterministe** de `lib/domain/` — jamais le texte
   du modèle —, **et** l'utilisatrice peut **accepter, refuser ou corriger**, avec une lisibilité
   strictement égale entre les trois.

3. **[FR-053 / FR-031]** **Étant donné** un type retenu (par test ou par hypothèse acceptée),
   **quand** il s'affiche, **alors** **aucune prédiction** ne lui est attachée, **et** ni score, ni
   pourcentage, ni classement des neuf types, ni barre de progression n'apparaît nulle part.

### Critères ajoutés au contexte (issus de l'état réel du dépôt)

4. **[DUR — AD-17 / FR-037]** **Étant donné** un épisode de détresse ouvert ou sa fenêtre de 72 h,
   **quand** une hypothèse de type est due, **alors** elle **n'est ni produite ni dite**, et la garde
   vit dans le **SQL** (`public.branche_bloquee_par_detresse()`), jamais dans une Server Action ni
   dans une RPC seule. Proposer une typologie de personnalité à quelqu'un en détresse est
   littéralement le « travail de schéma » que FR-037 suspend.

5. **[DUR — AD-12 / AD-13]** **Étant donné** `authenticated` qui détient les sept privilèges DML sur
   toute table de `public`, **quand** un type est écrit, corrigé ou refusé, **alors** toutes les
   gardes vivent dans le `WITH CHECK` d'une policy ou dans un trigger — **et** un `PATCH` REST direct
   sous son propre jeton est éprouvé en test.

6. **[DUR — droit de refuser]** **Étant donné** une utilisatrice qui a **révoqué** son consentement
   art. 9, **quand** elle refuse son type ou le supprime, **alors** l'opération **réussit**. Le
   `with check` du consentement gate le **dépôt** de contenu, jamais le **retrait**. Précédent
   littéral : `supabase/migrations/0021_branche.sql:114-118`.

7. **[DUR — FR-055]** **Étant donné** le gratuit à vie, **quand** un chemin du socle ennéagramme est
   lu, **alors** aucun `premium`, `abonnement`, `entitlement`, `GardeCommerciale` ni `stripe` n'y
   figure — **commentaires compris** — et le type reste disponible même si le thème natal, l'heure de
   naissance ou le socle quotidien sont indisponibles.

8. **[DUR — AD-8 / FR-006]** **Étant donné** le type retenu, **quand** un tour de conversation est
   assemblé, **alors** le type **n'entre jamais dans la charge utile envoyée au modèle**. Patron :
   l'AC7 dur de la 4.7 (« le nom d'une branche ne transite jamais vers un modèle »). Un type réinjecté
   à chaque tour, c'est Anam qui lit la personne à travers son étiquette en permanence — le verdict
   que FR-006 interdit, rendu structurel et définitif.

---

## Le problème central : deux moitiés, deux régimes opposés

Cette story a **deux moitiés qui n'obéissent pas aux mêmes lois**, et les mélanger casse quelque
chose dans un sens ou dans l'autre :

| | **AC1 — le test court** | **AC2 — l'hypothèse** |
|---|---|---|
| Origine du verdict | un **calcul pur** | un **modèle** (AD-3) |
| Origine du texte | le **corpus d'Anima** (`lib/corpus/`) | une **constante** (`lib/domain/`) |
| Registre de voix | **produit** — sobre, factuel, sans personnalité | **Anam** — trois phrases max, pose plus qu'elle n'affirme |
| Ce qui l'interdit | jamais d'`@/lib/ai` (garde `corpus-architecture`) | jamais de corpus (ce serait Anima qui parle, FR-086) |

Une hypothèse qui irait piocher un texte de corpus ferait passer le modèle pour Anima. Un créneau de
corpus rempli par le modèle est le défaut critique que FR-086 nomme. **Les deux moitiés partagent
exactement une chose : le type retenu.** Tout le reste est disjoint.

---

## Périmètre — ce que cette story ne fait PAS

| Hors périmètre | Qui le porte |
|---|---|
| La carte « ennéagramme » dans la bibliothèque d'accueil | **5.6** (`render/scene-dom.tsx:106` rend encore un placeholder) |
| Écrire les neuf textes de types | **Anima**, porte pré-lancement « LE CORPUS D'ANIMA » — la 5.5 livre `corpus-enneagramme-a-ecrire.md` |
| Ailes, instincts, flèches, sous-types | hors v1 — voir D6 |
| L'écran « Ce qu'Anam retient » (FR-063) | **6-5** |
| Brancher `assemblerRappel` sur le prompt | non commencé — mais l'AC8 pose dès maintenant la garde qui l'empêchera d'y verser le type |
| Valider le contenu clinique de l'instruction au modèle | porte pré-lancement, marquée `[PLACEHOLDER PRODUIT]` comme ses deux précédentes |

---

## Contexte développeur

### Ce qui existe déjà et qu'il ne faut PAS réinventer

| Besoin | Ce qui existe | Fichier |
|---|---|---|
| Le moule d'un morceau de socle | calcul pur → corpus → lecture → rendu | `lib/astro/numerologie.ts`, `lib/corpus/numerologie.ts`, `lib/data/lire-numerologie.ts` |
| Le port de corpus | complet, **rien à y ajouter** | `lib/corpus/port.ts` |
| Le squelette d'un corpus | `cleX` qui jette · `CLES_X` dérivée · `CORPUS_X` par `Object.fromEntries` · jonction `TexteCorpus \| null` | `lib/corpus/mantra.ts` |
| Le format de clé `"<domaine>:<valeur>"` | décidé en 5.2, **nomme explicitement la 5.5** | `lib/corpus/numerologie.ts:52-58` |
| Une parole d'ouverture d'Anam | `chargerOuverture()` → union à 3 variantes | `lib/safety/ouverture-branche.ts:67` |
| Proposer / accepter / refuser | germe `statut ∈ {en_attente, consomme, ecarte}` + trigger anti-résurrection | `supabase/migrations/0020`, `0021` |
| Lire une sortie de modèle | instruction constante + parser **strict** qui rend « rien » au moindre doute | `lib/domain/retour-theme.ts` |
| L'interface propose/refuse | deux réponses en ligne, `REPONSE_REFUS = "Ok."` | `render/conversation/PropositionBranche.tsx`, `copie-proposition.ts` |
| Une halte hors des trois régions | route Next, garde d'onboarding recopiée, « Revenir » | `app/heure-naissance/page.tsx` |
| Ne dépenser une parole qu'une fois **vue** | RPC de lecture seule + Server Action déclenchée par le **client** | `supabase/migrations/0045`, `app/_socle/marquer-annonce.ts` |
| Le gabarit d'une table art. 9 moderne | 4 policies **séparées par verbe** | `supabase/migrations/0036_intention_arbitrage.sql:200-400` |
| Le write-gate AD-13 | `a_consenti_art9()` + `est_barre_minorite()`, **inline dans le `with check`** | `0005`, `0042` |
| L'anti-forge de l'état initial | trigger `before insert` qui lève si `statut <> 'en_attente'` | `supabase/migrations/0046` |
| Le harnais de test SQL | `admin` (clé secrète) vs client sous **vrai JWT** | `tests/theme-natal-sql.test.ts` |

### Les gardes qui vont ROUGIR, et c'est voulu

| Garde | Pourquoi | Ce qu'il faut faire |
|---|---|---|
| `tests/socle-jamais-coupe.test.ts:65` | filet FR-055 **armé**, détecteur `/enneagramme\|ennéagramme/i` sur `app/` + `render/` + `lib/` | passer `existe: true` **ET** écrire la preuve positive « aucun gate premium », **commentaires compris**. La 5.2 puis la 5.4 s'y sont fait prendre chacune une fois : ce serait la **troisième** |
| `tests/corpus-architecture.test.ts:73` | `toBe(4)` fichiers dans `lib/corpus` | `toBe(5)` + `toContain("lib/corpus/enneagramme.ts")`. **Jamais** `toBeGreaterThan(4)` |
| `tests/lexique-voix.test.ts` | balaie `app/` + `render/` + `lib/` en **récursif** | chaque item du test y passe. **Ne jamais ajouter d'exclusion** — un test dédié exige que toute entrée d'`EXCLUS` prouve un vrai match |
| `tests/rls-catalogue.test.ts:91` | `PLANCHER_TABLES = 27` | une table sans `force row level security` ou sans `with check` fait rougir la garde générique |
| `tests/astro-architecture.test.ts:76` | inventaire en `toBeGreaterThanOrEqual` | ne rougit **pas** tout seul — donc à compléter à la main, sinon le nouveau fichier échappe au contrôle du contrôle |

**Mesuré**, à ne pas redécouvrir en route : `"Je m'inquiète de ce qui pourrait mal tourner."` →
**ROUGE** (`affect`), `"Ce n'est pas un diagnostic."` → **ROUGE** (`medical`). Les deux formulations
les plus naturelles d'un questionnaire — l'item au « je » et le disclaimer — **cassent le build**.
D5 les évite par construction ; les faire passer par une exclusion serait ouvrir un trou dans le seul
contrôle bloquant du produit.

---

## Décisions

### D1 — Le modèle ne rédige jamais la phrase : il rend un numéro, la phrase est une constante

L'AC2 dit « jamais assénée ». Une garde qu'aucun test ne peut prouver n'existe pas — et j'ai mesuré
que `"Tu es un 4."` passe les deux détecteurs au vert. Tant que la phrase vient du modèle,
« jamais assénée » est une intention, pas une propriété.

On transpose D1 de la 4.10 : **« la forme est garantie par la forme des données, jamais par un
prompt »**. Le modèle ne rend qu'une ligne structurée :

```
TYPE_HYPOTHESE: 3
```

lue par un parser **pur et strict** sur le patron `LIGNE_NUMERIQUE` de `lib/domain/retour-theme.ts:187`
— qui rejette en bloc toute ligne bavarde, scanne toutes les occurrences, retient la dernière conforme,
et rend **« rien »** au moindre doute. Hors format, hors `1..9`, ou `aucun` → aucune hypothèse.

La **phrase** est une constante de `lib/domain/enneagramme-hypothese.ts`, sur la forme canonique que
la charte de voix donne — et l'exemple de référence de `anam-voice.md:212` porte **littéralement sur
l'ennéagramme** :

> ⛔ « Ton type 2 t'empêche de dire non. » → ✅ « Il y a un truc qui revient : tu dis oui, puis tu t'en
> veux. Ça te parle ? »

« Jamais assénée » devient alors **testable sur la constante** : forme interrogative, ≤ 3 phrases,
`chercherPredictions` et `chercherInterdits` vides, aucun impératif — plus une garde de source
prouvant qu'**aucun chemin ne rend la sortie brute du modèle à l'écran**.

Corollaire AD-4 : la requête porte `contientArt9: true`, et **rien de la matière ne remonte dans le
contrat RPC/HTTP** — l'hypothèse ne transporte que le numéro et un identifiant, jamais l'extrait qui
l'a motivée (correctif #6/#11 de la revue 4.5).

### D2 — Un germe écrit en tâche de fond, une parole dite en deux temps

Le geste se décompose exactement comme la naissance d'une branche :

1. **Le germe** — un étage `after()` du tour de conversation appelle le modèle, obtient un numéro, et
   écrit une ligne `en_attente`, **idempotente par contrainte** (`unique (utilisatrice_id)` partielle
   sur `statut = 'en_attente'`) avec `on conflict do nothing`. C'est indispensable : les étages
   `after()` du dépôt **n'interrogent jamais `request.signal.aborted`**
   (`app/api/anam/message/route.ts:267-321` — seule la boucle de flux le consulte). Une utilisatrice
   qui ferme l'onglet pendant qu'Anam parle fait quand même tourner l'étage. Un germe réversible le
   supporte ; un « type retenu » écrit là serait posé sur quelqu'un qui n'a rien lu et rien dit.

2. **La parole** — une **4ᵉ variante d'`Ouverture`** (`hypothese-enneagramme`), lue en **lecture
   seule** au montage de la conversation, et **dépensée depuis le client** quand la phrase a
   réellement atteint l'écran (`regionActive`), patron `app/_socle/marquer-annonce.ts`.

Ce second temps n'est pas de l'élégance : le dépôt a payé la faute **deux fois** — 4.10
(`reserver_invitation_integration` consommée par un `router.refresh()`) puis migration 0045
(`reserver_annonce_socle_complet` dépensée dans une région `inert` que personne ne voyait). `app/page.tsx`
se ré-exécute à chaque rafraîchissement et la scène monte ses trois régions en permanence.

**Direction du doute, écrite en tête de 0049** : redire une hypothèse est un accroc ; ne jamais la
dire est la story qui ne tient pas. En cas de panne du marquage, **on redit**.

Contraintes héritées à ne pas rater : la variante s'inscrit dans `VARIANTES` de
`tests/arbitrage-frontiere.test.ts:85` (sinon l'extraction tronque et la garde d'absence devient vraie
sur un corps vide) ; `Ouverture` **interdit tout champ `: number`** (`:86-97`) — le type voyage donc en
littéral de chaîne, jamais en nombre ; et la variante se place **AVANT** `premiumSousJwt`
(`lib/safety/ouverture-branche.ts:73-83`), comme la mention de complétion du socle, parce que
l'ennéagramme est gratuit à vie. Chaque lecture ajoutée porte **son propre `try`** — la 4.10 avait
cassé la proposition de la 4.5 avec un `try` global.

### D3 — Le type retenu est du SOCLE, pas un fait extrait

`fait_extrait` a aujourd'hui un dépôt sans appelant, aucun écran, et `assemblerRappel` existe
précisément pour réinjecter les faits actifs dans le contexte de chaque tour. Y ranger le type
produirait, le jour où ce câblage se fait, **un enfermement permanent** : Anam lisant la personne à
travers son étiquette à chaque tour.

Le type vit donc dans sa propre table `enneagramme`, **1:1** (clé primaire sur `utilisatrice_id`,
patron `theme_natal`), avec `origine ∈ {test, hypothese}` et **aucune colonne de texte libre** — ce
qui rend l'AC3 **structurelle** : il n'existe pas de champ où une prédiction pourrait s'écrire. Et
l'AC8 pose la garde de source qui interdit au type d'entrer dans une charge utile de modèle.

**Ne pas copier le trigger d'immuabilité de `theme_natal`** : l'AC2 exige une ligne corrigeable.

### D4 — Policies séparées par verbe, et le refus survit à la révocation

`theme_natal` (0039) est une mono-policy `for all` — il a fallu 0041 pour révoquer le DELETE qu'elle
accordait implicitement. On copie **0036**, pas 0039 :

- `enneagramme_lecture` — `for select using (auth.uid() = utilisatrice_id)`, **rien d'autre** (l'export
  RGPD et l'effacement doivent survivre à tout).
- `enneagramme_insertion` / `enneagramme_revision` — `with check` portant `a_consenti_art9()` **et**
  `not est_barre_minorite()`. **Sans `est_premium_courante()`** : copier 0036 sans retirer cette
  clause paywallerait un item du socle libre, et l'AC7 le reprocherait.
- `enneagramme_retrait` (delete) et la transition vers `refuse` — **propriétaire seulement**, sans
  `a_consenti_art9()`. Précédent littéral, `0021:114-118` : « une transition de statut d'un pointeur
  n'est pas un dépôt de contenu art. 9, et “écarter” doit survivre à la révocation ». Sans cette
  asymétrie, celle qui révoque son consentement — c'est-à-dire précisément celle qui veut que
  l'étiquette disparaisse — ne peut plus ni refuser ni corriger : **l'UPDATE rend zéro ligne sans
  lever d'erreur** (`0036:315`), l'écran affiche « c'est noté », et rien n'a bougé.

Toute RPC de mutation rend un **booléen** (`get diagnostics ... row_count > 0`), jamais `void`. Les
tests **relisent la ligne** — asserter `error === null` ne prouve rien.

La clause AD-17 (`not branche_bloquee_par_detresse()`) porte sur **l'hypothèse**, pas sur le test
court : compléter volontairement un test pendant un épisode est un geste d'elle, pas une parole du
produit. `theme_natal` ne porte pas la clause, `intention` la porte — **ce choix s'écrit dans
l'en-tête de 0049**, quel qu'il soit ; le prendre par copier-coller, c'est décider par accident.

### D5 — Les items du test sont la voix du PRODUIT, pas le corpus d'Anima

Précédent D10 de la 5.3 : la porte FR-054/FR-086 couvre les **interprétations**, pas ce que le produit
dit de lui-même (`MESSAGE_SANS_HEURE`, `PHRASE_INVITATION` vivent dans `lib/domain/`). Les items sont
des énoncés à faire valider, pas des interprétations : ils vivent dans `lib/domain/enneagramme-items.ts`,
source unique, **jamais recopiés d'un inventaire existant** (FR-054 + droit d'auteur).

Deux conséquences mesurées, non négociables : les items sont formulés **en constat**, jamais en
« je ressens » — `"Je m'inquiète…"` est **rouge** ; et **aucun disclaimer médical** — `"Ce n'est pas un
diagnostic."` est **rouge**. La sortie réflexe (exclure le fichier du balayage) est fermée :
`ALLOWLIST` est vide et un test dédié exige que chaque entrée d'`EXCLUS` prouve un vrai match.

### D6 — 9 créneaux de corpus, et rien d'autre : le produit cartésien est refusé

Arithmétique sous la logique D11 de la 5.4 : axe minimal `enneagramme:<1..9>` = **9 créneaux**, portant
le corpus produit de 156 à 165 (+6 %). Les extensions traditionnelles sont toutes des produits
cartésiens que D6 de la 5.4 refuserait : ailes 18, instincts 27, flèches 18, croisement complet **54**
— soit le « 65 » que la 5.4 a explicitement écarté.

Et contrairement au mantra, **le texte est lu une fois, pas chaque matin** : aucun besoin d'un cycle de
rotation. Les items, eux, relèvent de D5 et **ne consomment pas le budget d'écriture d'Anima**.

### D7 — Le barème vit à un seul endroit, et l'appariement est nominal

`render/` ne peut importer ni `@/lib/domain` (`tests/arc-architecture.test.ts:63-68`) ni `@/lib/corpus`.
Le réflexe — recopier les items dans un module de copie de rendu — est exactement la faute R1-bis, payée
deux fois (`render/nom-branche.ts` a coûté une garde d'équivalence caractère par caractère).

Donc : les items **descendent du serveur avec leur identifiant stable**, la réponse remonte en
`(itemId → valeur)` et **jamais en index de position**, le barème n'existe que dans `lib/domain/`, et une
garde d'équivalence assère que tout item servi a une entrée de barème **et réciproquement**.

Sans ça, insérer ou réordonner une question décale tout le score — et produirait un type faux de façon
parfaitement déterministe, donc invisible aux tests de déterminisme de l'AC1 et invisible à l'écran
tant que le corpus est vide (deux textes `non_ecrit` sont égaux).

### D8 — Le score se calcule, il ne se montre jamais

FR-031 : « aucun score, aucune note, aucune jauge, aucune série ». `DESIGN.md:695` bannit nommément
barre de progression, anneau de complétion, pourcentage, compteur, badge, **score**, graphique,
confettis. `EXPERIENCE.md:291` : « pas d'indicateur d'étape, pas de “étape 2 sur 4” ».

Une question à la fois, en **fondu** (`fondu-texte`, 320 ms — `DESIGN.md:308` : « rien ne glisse »),
aucun compteur, un **type** affiché, jamais un nombre de points ni un classement.

L'ex æquo se départage par une règle **totale, explicite et documentée** — jamais par un affichage de
deux scores. Elle se teste **sur le seul cas où deux ordres divergent** : `Array.sort` est stable depuis
ES2019, donc « le premier de la liste » et « le plus haut score » coïncident tant que les données sont
ordonnées. C'est la zone de coïncidence qui a produit trois des cinq survivants de la 5.4.

### D9 — La tentative a un identifiant, et le composant est remonté, jamais remis à zéro

`render/scene-dom.tsx:281-296` monte les trois régions **en permanence**, `inert` sauf l'active :
`Conversation` n'est jamais démontée. Un `useState` local de réponses n'est donc **jamais réinitialisé
par une navigation** — c'est mot pour mot le défaut n°6 de la 4.6 (le champ de renommage qui fuyait
d'une branche à l'autre, corrigé par `key={selectionnee.id}`).

Le composant du test est monté avec `key={tentativeId}` et « refaire le test » frappe un **nouvel
identifiant**. Et `localStorage` est **banni** pour tout ce qui touche l'art. 9
(`render/arbre/ArbreInteractif.tsx:13-17` : contamination entre comptes sur navigateur partagé).

### D10 — Réparer les deux détecteurs AVANT d'écrire quoi que ce soit

- **`marqueurs-prediction.ts`** : ajouter une famille de futur **à la troisième personne**, non ancrée
  sur `tu`. Éprouvée sur connus-mauvais **et** connus-bons, patron `chercherMarqueursQuotidiens` de
  `tests/corpus-quotidien.test.ts`.
- **`lexique-interdit.ts`** : étendre la famille `medical` aux **adjectifs cliniques attributs**
  (anxieux/anxieuse, évitant, obsessionnel, phobique, narcissique, compulsif…), avec leurs témoins
  connus-bons qui ne doivent **pas** matcher, et **miroir obligatoire** dans `lib/domain/consigne-voix.ts`
  — le lexique ne borne que le statique.

Et l'écrire dans la fiche d'écriture : **le type décrit un mouvement, jamais un état clinique ; le
présent décrit, le futur annonce.**

### D11 — Une halte `/enneagramme`, pas une quatrième région

`IdRegion` est une union fermée (`lib/scene/regions.ts:10`) et `EXPERIENCE.md:34` plafonne à trois
destinations. Mais 5.1 à 5.4 ont toutes livré **sans surface**, et un test sans écran n'existe pas.

Patron `/heure-naissance` — « une **halte**, pas une région du monde : elle se pose par-dessus la scène
et y renvoie » (`app/heure-naissance/page.tsx:12-15`) : route Next, `metadata = { title: "Anam" }`,
garde d'onboarding recopiée, chemin « Revenir » explicite. Registre **produit** : sobre, tutoiement,
factuel — **Anam ne paraît pas sur cet écran** (elle n'a que trois beats, `EXPERIENCE.md:147`), et le
résultat n'est jamais en `t-anam`, sinon un calcul parlerait avec sa voix.

Le mot « ennéagramme » **ne sort jamais de l'application authentifiée** : `tests/identite-route.test.ts:77`
(Open Graph) et `tests/synthese-domaine.test.ts:267` (courriels) le bannissent déjà, et `DESIGN.md:672`
l'interdit en notification.

### D12 — La copie du consentement doit nommer ce qu'Anam DÉDUIT

Le texte actuel ne parle que de ce qu'**elle partage** : « ce que je partage sur mon intériorité, mes
croyances, mon vécu » (`app/(auth)/consentement/formulaire-consentement.tsx:76`). Or un type
d'ennéagramme n'est pas partagé : il est **produit** par un score ou **inféré** par un modèle. Et
l'amont acté par le PRD le qualifie : « Ennéagramme (profil psychologique) … catégories de données
sensibles » (`addendum.md:133`).

`a_consenti_art9()` ne vérifie qu'un booléen : il rendra `true` et laissera écrire — la garde technique
passera au vert en donnant une fausse impression de conformité. **C'est le libellé qui doit rattraper
ce que la 5.5 ajoute**, avant toute écriture (FR-072). C'est une phrase, pas une refonte ; l'écran
porte déjà la note qu'il attend une validation juridique.

---

## Pièges

| # | Le piège | Pourquoi il est mortel | La parade |
|---|---|---|---|
| P1 | Laisser le modèle rédiger la phrase | `"Tu es un 4."` est **vert** aux deux détecteurs — l'AC2 serait livrée sans garde | D1 : numéro + constante |
| P2 | Garder la détresse en TypeScript | `chargerOuverture` est appelée depuis un Server Component : le pipeline sécurité **ne s'exécute jamais** sur ce chemin ; et un `PATCH` REST direct contourne | AC4 : `branche_bloquee_par_detresse()` dans le SQL |
| P3 | Écrire le corpus au futur à la 3ᵉ personne | mesuré vert : « Le 4 finira par… », « Le 9 évitera… » | D10, **avant** d'écrire la fiche |
| P4 | Décrire les types au registre clinique | mesuré vert : « Le 6 est anxieux », « Le 5 est évitant et obsessionnel » | D10 + fiche d'écriture |
| P5 | Dépenser l'hypothèse pendant le rendu serveur | faute payée **deux fois** (4.10, puis 0045) : la phrase est comptée dite sans avoir atteint l'écran | D2, deux temps |
| P6 | Écrire un « type retenu » dans un `after()` | les étages `after()` **n'interrogent pas** `signal.aborted` : le type serait posé sur quelqu'un qui n'a rien lu | D2 : germe `en_attente` seulement |
| P7 | Une prop serveur qui n'est pas réactive | `Conversation` reste montée : l'initialiseur de `useState` **ne rejoue pas** (défaut le plus grave de la revue 4.10) | clé stable comparée à chaque rendu, **chaque** variante couverte |
| P8 | Gater le refus sur le consentement | l'UPDATE rend zéro ligne **sans erreur** : « c'est noté » et rien n'a bougé | D4, AC6 |
| P9 | Apparier les réponses par position | un type faux, parfaitement déterministe, invisible tant que le corpus est vide | D7 : identifiants stables |
| P10 | Asserter le **texte** de corpus | 9 créneaux `non_ecrit` sont **égaux** : le test est vrai de n'importe quelle implémentation (2 mutants survivants en 5.4) | exporter `cleEnneagramme(type)`, **espionner l'argument** |
| P11 | Basculer `existe: true` sans la preuve positive | la moitié qu'on oublie ; la 5.2 et la 5.4 s'y sont fait prendre — ce serait la **troisième** | AC7, commentaires compris |
| P12 | `for all` sur la nouvelle table | accorde le DELETE : `theme_natal` a dû être rattrapé par 0041 | D4, policies par verbe |
| P13 | Un trigger qui ne garde que l'UPDATE | défaut récurrent du dépôt (0039→0041, 0021→0046, 0019→0046) | `before insert or update` : anti-forge à l'INSERT, anti-résurrection à l'UPDATE |
| P14 | Une garde d'absence qui ne regarde rien | `tests/arbitrage-frontiere.test.ts` a été **fausse deux fois** ; chercher un interdit dans une chaîne vide réussit toujours | **présence avant absence** : assérer d'abord un corpus non vide et un détecteur qui mord sur un faux corpus |
| P15 | Le gratuit qui tombe avec sa dépendance | revue du 13/08 : « le mantra gratuit à vie tombait avec le thème » | `try` local, jamais global ; l'ennéagramme ne dépend d'aucune donnée de naissance |

---

## Tâches

- [x] **T1 — Réparer les deux détecteurs (D10).** Famille de futur 3ᵉ personne dans
      `lib/domain/marqueurs-prediction.ts` ; adjectifs cliniques dans `lib/domain/lexique-interdit.ts`
      + miroir dans `consigne-voix.ts`. Tests connus-mauvais **et** connus-bons pour chacun. **Rien
      d'autre ne commence avant que ce soit vert.**
- [x] **T2 — `lib/domain/enneagramme.ts`** : `Type = 1..9` (union littérale), `scorer(reponses): Scores`
      pur, `typeRetenu(scores): Type` avec départage **total** documenté, `cleEnneagramme(type)` exporté.
      Zéro I/O, zéro horloge, zéro modèle.
- [x] **T3 — `lib/domain/enneagramme-items.ts` (D5)** : les items, identifiants stables, formulés en
      constat. Garde d'équivalence items ↔ barème (T2), dans les deux sens.
- [x] **T4 — `lib/corpus/enneagramme.ts` (D6)** : 9 créneaux `enneagramme:<1..9>`, tous `NON_ECRIT`,
      patron `mantra.ts`. Mettre à jour `lib/corpus/README.md:62`.
- [x] **T5 — `supabase/migrations/0049_enneagramme.sql` (D3/D4)** : table 1:1, `enable` **et** `force`
      RLS, 4 policies par verbe, trigger `before insert or update`, `revoke all … from anon`, en-tête
      qui **écrit** le choix AD-17 et le résidu « le type posté est une donnée, pas une garde ».
- [x] **T6 — `lib/data/depot-enneagramme.ts` + `lib/data/lire-enneagramme.ts`** : sous JWT, jamais
      `service_role`, union `calcule | indisponible`, RPC rendant un **booléen**.
- [x] **T7 — L'hypothèse (D1/D2)** : instruction `[PLACEHOLDER PRODUIT]` + parser strict + capacité
      ajoutée à `CapaciteIa` **et tranchée dans `politique-tier.ts`** (tier **fort** : l'objet touche
      à l'identité) ; étage `after()` écrivant le germe ; 4ᵉ variante d'`Ouverture` + inscription dans
      `VARIANTES` ; marquage « dite » depuis le client.
- [x] **T8 — La halte `/enneagramme` (D11)** + le composant du test (`key={tentativeId}`, fondu, aucun
      compteur) + les trois réponses à l'hypothèse d'égale lisibilité, focus jamais perdu, échec jamais
      silencieux (`role="alert"`), verrou d'envoi en `useRef` **synchrone**.
- [x] **T9 — D12** : une phrase de plus dans la copie de consentement.
- [x] **T10 — Les gardes** : `socle-jamais-coupe` (`existe: true` + preuve positive),
      `corpus-architecture` (`toBe(5)` + `toContain`), AC8 (le type n'entre pas dans la charge utile),
      `astro-architecture` complété à la main, tests SQL sous vrai JWT + `PATCH` REST direct.
- [x] **T11 — `corpus-enneagramme-a-ecrire.md`**, patron `corpus-quotidien-a-ecrire.md`, portant les
      interdits de D10 en toutes lettres.
- [x] **T12 — Campagne de mutation.** Mutants **obligatoires** : retirer la `key={tentativeId}` ·
      inverser le départage d'ex æquo · réordonner deux items · rendre toujours le type 1 · retirer
      `branche_bloquee_par_detresse()` de la policy · retirer `a_consenti_art9()` du `with check` ·
      **ajouter** `a_consenti_art9()` au refus (doit rougir en AC6) · faire rendre `void` à la RPC ·
      marquer l'hypothèse « dite » pendant le rendu serveur · faire passer le type dans la charge utile
      du modèle · relâcher le parser pour accepter une ligne bavarde · retirer une famille de D10.

---

## Ce qu'il faut vérifier avant de coder

1. `git rev-parse HEAD` = `5f3b730` et la branche est `story/5-5-enneagramme`.
2. `supabase status` répond, CLI **globale** v2.67.1 (jamais `npx supabase`), `supabase db reset` vert
   sur 0001→0048.
3. `npx vitest run` : **1923+ tests verts** avant toute
   modification. Un test déjà rouge n'est pas de la 5.5.
4. Lire `lib/safety/ouverture-branche.ts` **en entier** — les directions du doute y sont hétérogènes
   **exprès** : « quiconque harmonise ces deux directions casse l'une des deux ».
5. Lire l'en-tête de `supabase/migrations/0045` : c'est le raisonnement complet de D2.

---

## Dev Notes

### Détails qui font perdre une heure si on les découvre en route

- `tests/socle-jamais-coupe.test.ts` rougit dès le **premier** fichier dont le chemin contient
  `enneagramme`. C'est le tout premier échec qu'on verra, avant toute assertion de la story.
- `Ouverture` **interdit tout champ numérique** et tout tableau : le type voyage en chaîne.
- `render/` ne peut importer ni `@/lib/domain` ni `@/lib/corpus`. Les items descendent en props.
- `lib/astro/` refuse toute chaîne de plus de 40 caractères ou contenant une espace : **les items ne
  peuvent pas y vivre**. D'où `lib/domain/`.
- Un commentaire qui cite `tests/…` ou `supabase/migrations/…` doit citer un fichier qui **existe**
  (garde en fin de `tests/corpus-architecture.test.ts`).
- Les tests SQL frappent le Supabase **local** (95 sessions par passe ; le cloud coupe à 32 / 5 min).

### Commandes

```bash
npx vitest run
npx tsc --noEmit && npx eslint . && npx next build
supabase db reset          # CLI GLOBALE
```

### Déploiement

Après livraison, `0049` part par la **Management API** (`SUPABASE_ACCESS_TOKEN`, projet
`zlhlzoalmszohrxrnsmo`, `User-Agent` non défaut — **jamais** `POST /v1/projects/{ref}/database/migrations`),
avec contrôle de parité fichiers/local/cloud à **49/49/49**.

### Références

- [Source: `_bmad-output/planning-artifacts/prds/prd-Anima-2026-07-21/prd.md#FR-052`]
- [Source: `_bmad-output/planning-artifacts/epics.md#story-55`]
- [Source: `_bmad-output/brainstorming/brainstorm-anima-app-2026-07-20/anam-voice.md#212`] — l'exemple
  canonique porte littéralement sur l'ennéagramme
- [Source: `_bmad-output/planning-artifacts/briefs/brief-Anima-2026-07-21/addendum.md#133`] — « profil
  psychologique … catégories de données sensibles »
- [Source: `supabase/migrations/0045_annonce_socle_dite_pas_servie.sql`] — le raisonnement de D2

---

## Questions pour Julian (à trancher, sans bloquer le démarrage)

1. **Combien d'items au test court ?** Défaut retenu : **18** (deux par type), une question à la fois,
   en fondu, sans compteur. Justification : « test **court** » est dans le titre de la story ; l'UX
   interdit tout indicateur de progression, donc un test long désoriente sans recours ; et au-delà
   d'une certaine longueur un questionnaire d'items ressemble à un instrument d'évaluation, ce que
   « accompagnement, jamais diagnostic » (NFR-009/010) ne peut pas porter. *Alternatives : 9 (un par
   type, probablement trop grossier pour départager) ou 27 (trois par type, plus robuste, plus long).*

2. **Les réponses partielles sont-elles persistées ?** Défaut retenu : **non** — le test se fait d'un
   trait, et l'abandonner ne laisse rien. Justification : persister, ce serait stocker une batterie
   d'auto-évaluations sur la peur, la honte et la colère — **un matériau art. 9 plus riche que le type
   lui-même**. Tension assumée et à écrire : NFR-017 promet qu'aucune entrée n'est perdue. Avec 18
   items sans compteur, l'interruption coûte peu ; avec 27, l'arbitrage se rediscute.

3. **D12 touche la copie de l'écran de consentement (story 1.5).** Une phrase pour nommer ce qu'Anam
   **déduit**, en plus de ce qu'elle partage. Je la considère dans le périmètre — sans elle, la 5.5
   écrit une catégorie art. 9 que le consentement ne nomme pas. Dis-moi si tu préfères que ça sorte.

---

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context).

### T1 — livrée le 2026-08-13 (les deux détecteurs)

Phase rouge d'abord : 17 tests neufs en échec, puis correctifs.

- **`lib/domain/marqueurs-prediction.ts`** — nouvelle famille `futur_type` : futur simple et futur
  proche à la 3ᵉ personne, **dans une phrase qui désigne un type**. La décision d'épargner le futur
  impersonnel n'est PAS renversée : un test prouve les deux sens (« le cycle se refermera » passe,
  « le 4 se refermera » ne passe plus).
- **`lib/domain/lexique-interdit.ts`** — treize adjectifs cliniques ajoutés à la famille `medical`,
  dont douze sans condition et **un seul gaté sur la position d'attribut** (« évitant » : « en
  évitant le conflit » doit rester écrivable).

**Deux erreurs qui se masquaient l'une l'autre**, trouvées par les tests et pas par la relecture :
l'apostrophe laissée dans la classe de caractères faisait passer « l'aura » pour un verbe de six
lettres, ce qui compensait une borne basse (`{3,}`) qui excluait déjà « aura » et « ira » — les deux
verbes les plus courants du français. Corriger l'un seul rendait le détecteur plus faux qu'avant.

### Le dégât d'environnement découvert en route (hors périmètre de la story, corrigé quand même)

En vérifiant que T1 n'avait rien cassé, la suite complète a rendu **124 échecs sur 31 fichiers**,
tous SQL, tous en `42501 permission denied for table …`. Aucun ne pouvait venir de deux expressions
régulières. La chaîne réelle :

1. `.env.local` pointe sur le **projet de lancement** depuis le 2026-08-12 ;
2. la commande écrite dans **48 endroits** des dossiers de story le **sourçait avant vitest** ;
3. `tests/_environnement.ts` respecte délibérément l'environnement déjà posé (`??=`) ;
4. donc la suite interrogeait la production, y créait ses fixtures, et mourait sur le plafond de
   **32 connexions / 5 min** de Supabase hébergé — un `429` qui remonte déguisé en refus de
   privilèges.

L'avertissement était **déjà écrit**, en toutes lettres, dans l'en-tête du fichier concerné. Il n'a
arrêté personne : la démonstration exacte de la doctrine du dépôt, une garde qui vit dans un
commentaire n'existe pas. Corrigé par une **garde qui refuse** (`refusDeCible`, 13 tests dans
`tests/environnement-cible.test.ts`), la commande remplacée dans les 48 endroits, et **un test qui
interdit qu'elle revienne** par copier-coller.

Une fausse piste au passage, écrite ici pour qu'elle ne soit pas refaite : les plafonds
`[auth.rate_limit]` de `supabase/config.toml` ont été relevés, puis **annulés** — la CLI ne câble
aucune limite de connexion dans le conteneur d'auth local (`docker inspect` ne montre aucun
`GOTRUE_RATE_LIMIT_SIGN_IN_SIGN_UPS`). Le 429 mesuré venait du cloud, pas de la pile locale.

### T2 → T5 — livrées le 2026-08-13 (le domaine, les items, le corpus, la base)

- **`lib/domain/enneagramme.ts`** — union littérale `1..9`, `scorer` à appariement **nominal**,
  `conclure` qui rend `retenu | indecis | incomplet`. **À égalité, le produit refuse de trancher** et
  nomme les types ex æquo : le départage « par le plus petit numéro » aurait biaisé silencieusement
  vers le type 1. Le maximum se calcule sur les VALEURS (`Math.max`), jamais par un tri — c'est la
  zone de coïncidence qui avait produit trois survivants en 5.4.
- **`lib/domain/enneagramme-items.ts`** — 18 énoncés, deux par type, entrelacés pour que deux items
  consécutifs ne pèsent jamais le même type. `itemsPourAffichage()` ne rend que `{id, texte}` : **le
  barème ne descend jamais au client**, sans quoi on pourrait lire ce que chaque phrase pèse *pendant
  qu'on y répond*.
- **`lib/corpus/enneagramme.ts`** — 9 créneaux, tous `non_ecrit`. Le piège légué par la 5.4 est
  nommé dans le test : neuf créneaux vides sont ÉGAUX, donc « deux types donnent des textes
  différents » est vrai de n'importe quelle implémentation. La garde assère la **clé demandée**, via
  un espion sur `lireTexte`, jamais le texte rendu.
- **`supabase/migrations/0049_enneagramme.sql`** — trois tables (type retenu / tentative / germe
  d'hypothèse), policies séparées par verbe, `revoke all … from anon`, triggers `before insert or
  update`. Deux décisions écrites plutôt que copiées : la garde de détresse ne vit **que** sur
  l'hypothèse (un test est un geste d'elle), et les policies de RETRAIT ne portent **pas**
  `a_consenti_art9()` — le refus doit survivre à la révocation.

**Une affirmation du dépôt corrigée en route.** 0036 écrit qu'une UPDATE bloquée par la RLS « ne lève
aucune erreur, elle renvoie zéro ligne ». C'est vrai du `using`, **faux du `with check`**, qui lève
42501. Mesuré, documenté, et la conséquence pratique posée dans `lib/data` : on ne sait pas d'avance
laquelle des deux moitiés mordra, donc **toute mutation relit ce qui a bougé**.

Un test sans valeur a été retiré : la borne « au plus 18 réponses » est **inatteignable** (le motif
des clés n'admet que dix-huit chaînes). Il est remplacé par un test qui le DIT — sans quoi une
campagne de mutation future conclurait à tort que la borne est inutile.

### T6 — livrée le 2026-08-13 (le dépôt et les lectures)

`lib/data/depot-enneagramme.ts`, `lib/data/lire-enneagramme.ts`, et **deux RPC ajoutées à 0049**.

**Peu de RPC, et la ligne est explicite.** `authenticated` détient les sept privilèges DML : une RPC
n'ajoute aucune garde, elle n'offre qu'un second chemin vers la même table. Les deux qui existent le
sont pour la **transaction**, pas pour la garde — `terminer_tentative_enneagramme` (le type entre, la
tentative sort) et `accepter_hypothese_enneagramme` (la réponse et le type). Tout le reste s'écrit en
direct sous RLS. Les deux sont **`security invoker`** : `definer` — le réflexe, et ce que fait 0045 —
ferait disparaître consentement, minorité et appartenance d'un seul mot.

**Trois décisions qui ne se déduisent pas du gabarit :**

1. **Accepter prend le type de la LIGNE, jamais de l'appelante.** Un `p_type` en paramètre laisserait
   accepter « le 4 » pendant qu'Anam avait proposé le 7 — et le trigger anti-réécriture ne le verrait
   pas, puisqu'il garde la colonne de l'hypothèse, pas ce qu'on en fait.
2. **« À dire » et « à répondre » sont deux lectures.** Une hypothèse dite ne se redit pas (Anam qui
   répète harcèle), mais reste **répondable** — sans quoi les trois portes disparaîtraient de la
   halte dès la première phrase affichée.
3. **42501 et 23505 sont avalés pour le germe seulement.** L'étage `after()` ne doit mourir ni d'une
   garde de détresse qui fonctionne, ni d'un second germe que l'index refuse. Tout le reste lève.

**Campagne de mutation (6 mutants, 6 tués) :**

| Mutant | Tué par |
|---|---|
| `tentative_id` dans la charge utile de l'upsert | « `tentative_id` est STABLE d'un enregistrement à l'autre » |
| deux appels au lieu de la RPC (atomicité perdue) | 3 tests, dont « le consentement coupé ne lui coûte pas ses réponses » |
| `seulementADire` ignoré | « une fois DITE, elle ne se redit pas — mais reste À RÉPONDRE » |
| `accepter` en `security definer` | 2 tests d'AC6 (révocation) |
| « une tentative absente ne se conclut pas » retiré | 2 tests d'AC1 |
| filtre `en_attente` retiré de l'acceptation | « accepter deux fois : la seconde rend `false` » |

Le second est celui qui compte : il passe **tous** les autres tests du fichier et perd dix-huit
réponses art. 9 le jour où l'écriture du type est refusée.

**195 fichiers, 3062 tests verts, `tsc` et `eslint` propres.** `0049` n'est **pas** encore déployée
sur le cloud : elle gagnera d'autres pièces en T7, et partira d'un bloc en fin de story.

### T7 — livrée le 2026-08-13 (l'hypothèse d'Anam)

Onze fichiers touchés, quatre créés. Le chemin complet : `after()` à la clôture → passe FORTE sous
egress art. 9 → parser strict → germe `en_attente` → 4ᵉ variante d'`Ouverture` → phrase constante →
marquage « dite » déclenché par le CLIENT.

**Trois décisions qui s'écartent du dossier, et pourquoi.**

1. **Le numéro ne franchit PAS la frontière avec l'ouverture.** D2 prévoyait qu'il voyage « en
   littéral de chaîne » pour contourner l'interdit de champ numérique. En écrivant la phrase, la
   raison de le transporter a disparu : la phrase du fil ne nomme aucun type — c'est la forme ✅ de
   la charte (`anam-voice.md:212`), et nommer un numéro au milieu d'une conversation, c'est
   l'asséner. La halte lit la ligne en base. Le porter dans le contrat aurait fabriqué une SECONDE
   source du même fait, la divergence R1-bis déjà payée deux fois.

2. **Le gate n'est pas une fenêtre glissante mais « une seule fois, jamais deux ».** L'index partiel
   de 0049 n'empêche que deux hypothèses EN ATTENTE ; il n'empêche pas Anam de reproposer un autre
   numéro le lendemain d'un refus. Or un refus veut dire « ce n'est pas moi ». `momentDeProposer`
   regarde donc TOUS les statuts. Ce qu'on perd est assumé : Anam ne se ravise jamais, et le test
   court reste ouvert en permanence.

3. **L'étage ne tourne qu'à la CLÔTURE de séance** (`arc?.beat === "cloture"`, émis une seule fois
   par la machine). Le moment d'abord — une séance qui vient de se clore a produit de la matière,
   et interrompre un échange pour proposer une grille de personnalité serait le pire moment. Le coût
   ensuite : sans ce gate, une passe FORTE partirait à chaque tour d'un compte sans type, et
   `momentDeProposer` ne l'aurait bornée qu'APRÈS le premier germe écrit.

**Ce qui rend « jamais assénée » testable.** Les deux détecteurs sont VERTS sur `"Tu es un 4."` —
mesuré, et le test le dit en toutes lettres. La garde est donc un jeu de contraintes propre à cette
story (forme interrogative, ≤ 3 phrases, aucun « tu es », aucun « ton type », aucun trait de fond)
appliqué aux constantes **et** à quatre verdicts connus-mauvais qui doivent ROUGIR. Sans ce contrôle
négatif, le contrôle positif serait vrai du verdict aussi.

**Le tier est écrit, pas hérité.** Le repli `capacite === "echange" ? "leger" : "fort"` donnait déjà
« fort ». La ligne dédiée est là parce que le repli tient à une seule expression : quiconque la
retournerait un jour ferait basculer celle-ci avec, sans le voir. Le mutant qui retire cette ligne
laisse `tests/politique-tier.test.ts` **vert** — seule la garde de SOURCE le tue. C'est écrit dans
les deux fichiers.

**Campagne de mutation (9 mutants, 9 tués) :**

| Mutant | Tué par |
|---|---|
| parser relâché (accepte une ligne bavarde) | « une ligne BAVARDE est rejetée EN BLOC » |
| « dite » marquée sans exiger la région active | « région INERTE → RIEN n'est dépensé » |
| hypothèse lue sans `seulementADire` | « une hypothèse dite ne se redit pas » |
| garde de détresse retirée du pipeline | « fenêtre détresse ACTIVE → aucun appel fort » |
| `momentDeProposer` ignoré | 2 tests, dont « elle a déjà REFUSÉ → aucun appel, jamais » |
| tier explicite retiré | garde de SOURCE (le test de comportement reste vert) |
| numéro ajouté au contrat d'ouverture | 2 tests d'`arbitrage-frontiere` (serveur + miroir) |
| `try` local de l'hypothèse retiré | « une panne ne fait pas taire la proposition de la 4.5 » |
| étage déplacé sur chaque tour | « l'étage ne tourne QU'À LA CLÔTURE » |

**198 fichiers, 3121 tests verts, `tsc` et `eslint` propres.**

⚠️ **Reste ouvert pour T8** : le bouton « Voir » de l'hypothèse mène à `/enneagramme`, qui n'existe
pas encore. La halte, le composant du test et les trois réponses d'égale lisibilité sont T8.

### T8 — livrée le 2026-08-13 (la halte `/enneagramme`)

Six fichiers créés sous `app/enneagramme/` — page, actions, CSS, et trois composants clients. La
route compile (`next build`), et le mot « ennéagramme » ne sort toujours pas de l'application
authentifiée : `metadata = { title: "Anam" }`.

**Trois écrans, un ordre motivé** : `?refaire` (intention explicite, passe devant tout) → hypothèse
en attente (une question ouverte se répond avant qu'on affiche une réponse acquise) → type retenu →
le test, repris là où elle s'était arrêtée.

**Deux décisions de produit prises en écrivant l'écran :**

1. **« Refaire le test » n'efface pas son type.** Le réflexe — repartir d'une page blanche — la
   laisserait SANS TYPE si elle abandonne au huitième énoncé, pour avoir voulu vérifier son
   résultat. On efface seulement la passe en cours (pour que la `key` change et que rien ne fuie de
   l'ancienne) ; le type reste jusqu'à ce qu'un nouveau le remplace.

2. **Refuser et corriger n'emmènent pas au même endroit.** Les deux écrivent la même chose en base.
   Sans une destination différente — refuser ramène à la scène, corriger ouvre le test — le
   troisième bouton de l'AC2 serait un doublon, et un doublon présenté comme un choix est une
   fausse liberté.

**⚠️ DEUX TESTS NE PROUVAIENT RIEN, ET LA CAMPAGNE DE MUTATION L'A ÉTABLI. C'est la trouvaille de
cette tâche.**

- **Le verrou d'envoi.** Le mutant qui remplace le `useRef` par un `useState` a **survécu** :
  `userEvent.click` rend la main entre deux clics, React vide sa file, le bouton passe `disabled`,
  et le second clic ne part jamais. Le test a été réécrit avec deux `.click()` **natifs et
  synchrones**, dans le même tick — c'est le seul montage où un `useState` échoue et un `useRef`
  tient. Il tue maintenant le mutant.

- **Le focus.** Le mutant qui retire le `useEffect` de déplacement du focus a **survécu** aussi, et
  la raison a changé le CODE plutôt que le test : les quatre `<li>` sont clés sur le LIBELLÉ, qui ne
  varie pas d'un énoncé à l'autre — React réconcilie les mêmes nœuds DOM et le focus reste
  naturellement sur le bouton cliqué. L'effet ne gardait donc rien : il **déplaçait** le focus, de
  « Tout à fait » vers « Pas du tout », c'est-à-dire vers une réponse qu'elle n'avait pas choisie.
  L'effet a été retiré ; le test asserte désormais que le focus reste sur le degré choisi, et le
  vrai mutant (`key={`${courant.id}-${libelle}`}`, qui démonte les quatre boutons) le tue.

**Campagne de mutation (10 mutants, 10 tués — dont 2 après réparation du test) :**

| Mutant | Tué par |
|---|---|
| `useRef` → `useState` sur le verrou d'envoi | « le verrou est SYNCHRONE » *(après réécriture)* |
| clé des `<li>` dépendant de l'énoncé | « le focus ne retombe jamais sur `<body>` » *(après réécriture)* |
| un compteur « 3 sur 18 » ajouté | 2 tests FR-031 |
| un degré de l'échelle dessiné différemment | « les quatre degrés ont la même forme » |
| « Oui » reçoit le dessin du bouton principal | « les trois boutons ont le MÊME dessin » |
| refuser et corriger vers la même destination | « n'emmènent PAS au même endroit » |
| « Refaire » efface le type d'abord | « n'efface PAS son type » |
| `key={cleTentative}` retirée de la page | garde de source D9 |
| `exaequo[0]` pris au lieu de rendre la main | « à ÉGALITÉ, rien n'est écrit » |
| type hors ex æquo accepté | « un type qui n'est PAS à égalité est refusé » |

**200 fichiers, 3160 tests verts**, `tsc`, `eslint` et `next build` propres.

### T9 à T12 — livrées le 2026-08-13

**T9 — la copie de consentement (D12).** La case art. 9 ne couvrait que ce qu'elle **partage**. Un
type d'ennéagramme n'est pas partagé : il est produit par un score ou inféré par un modèle, et
l'amont l'a qualifié (« profil psychologique … catégories de données sensibles »). `a_consenti_art9()`
ne vérifie qu'un booléen — la garde technique serait restée **verte** en laissant écrire une
catégorie que le libellé ne nommait pas, c'est-à-dire une conformité d'apparence. Le libellé porte
désormais « et **ce qu'elle en déduit** sur ma façon de fonctionner », et le détail dit que ces
déductions se **corrigent** et s'**effacent**. Deux mutants (retirer l'ajout / remplacer le partage
par la déduction) sont tués.

**T10 — les gardes.** Trois ajouts, dont un qui répare une promesse creuse :

- **La position de l'hypothèse au-dessus du gate premium n'était gardée par rien.** L'en-tête
  d'`ouverture-branche.ts` affirmait « `tests/socle-jamais-coupe.test.ts` garde cette position » — et
  c'était faux. *Une garde qui ne vit que dans un commentaire n'existe pas* : c'est la doctrine que
  cette story a payée en T1, retrouvée dans son propre code. Le test existe maintenant, éprouvé par
  le comportement (compte explicitement non premium), et le mutant qui déplace le bloc le tue.
- **AC8** : aucun autre constructeur de `RequeteIa` ne connaît l'ennéagramme, et la route de
  conversation ne lit du type que son EXISTENCE (deux booléens), jamais sa valeur.
- **`astro-architecture`** : l'inventaire n'avait **rien** à recevoir — un type d'ennéagramme ne
  dérive d'aucune position astronomique. Ce qui a été ajouté, c'est la garde inverse : `lib/astro`
  ne doit jamais s'en approcher, parce que c'est du calcul déterministe sur des nombres et que la
  tentation est réelle.

**T11 — la fiche d'écriture d'Anima, et le trou qu'elle a trouvé.** `corpus-enneagramme-a-ecrire.md`
porte les neuf créneaux et les trois refus automatiques en toutes lettres. Un test **exécute les
vrais détecteurs sur les exemples de la fiche**, extraits du markdown : chaque ❌ doit être refusé,
chaque ✅ doit passer.

⚠️ **Il a immédiatement échoué.** L'exemple « Ce type va chercher la reconnaissance. » était donné
comme refusé, et il était **vert** : la famille `futur_type` exigeait un CHIFFRE dans la désignation.
Or un portrait reprend naturellement son sujet sans le renuméroter. Le détecteur a été étendu
(troisième alternative, avec un `(?!\s+de)` qui écarte « le type DE… », sinon la famille mordrait sur
du français ordinaire), avec quatre connus-mauvais et quatre connus-bons de plus. **La fiche a trouvé
un trou que trois relectures du détecteur n'avaient pas vu.**

**T12 — campagne de mutation finale : les douze mutants obligatoires du dossier.**

| # | Mutant | Résultat |
|---|---|---|
| 1 | retirer la `key={tentativeId}` | tué (garde de source D9) |
| 2 | inverser le départage d'ex æquo | tué (2 tests, serveur + rendu) |
| 3 | réordonner deux items | **survivant ATTENDU** — c'est la preuve de l'appariement nominal (D7) : réordonner ne décale rien. Le variant qui met deux items du même type côte à côte, lui, est tué par la garde d'entrelacement |
| 4 | rendre toujours le type 1 | tué (l'espion sur `lireTexte` — la clé, pas le texte) |
| 5 | retirer `branche_bloquee_par_detresse()` de la policy | tué (3 tests, dont le témoin « le même appel réussit une fois l'épisode clos ») |
| 6 | retirer `a_consenti_art9()` du `with check` | tué (4 tests) |
| 7 | **ajouter** `a_consenti_art9()` au refus | tué (5 tests d'AC6) — exactement comme le dossier l'avait prédit |
| 8 | faire rendre `void` à la RPC | tué (3 tests) |
| 9 | marquer l'hypothèse « dite » pendant le rendu serveur | tué |
| 10 | faire passer le type dans la charge utile du modèle | tué |
| 11 | relâcher le parser | tué |
| 12 | retirer une famille de D10 | tué (5 tests pour `futur_type`, 3 pour les adjectifs cliniques) |

**Total de la story : 40 mutants exécutés, 39 tués, 1 survivant assumé et documenté** (le n° 3, dont
la survie EST la propriété recherchée).

**201 fichiers, 3174 tests verts**, `tsc`, `eslint` et `next build` propres.

### Debug Log References

_À remplir._

---

## Status

review
