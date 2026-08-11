---
baseline_commit: 12adc44a6e7f57cd371c37dc5123ef99a465733a
story_key: "5-3-degradation-gracieuse-sans-heure-completion-tronc"
epic: 5
story: 3
title: "Dégradation gracieuse sans heure & complétion du tronc"
epic_name: "Le socle & la lecture"
covers: [FR-049, FR-050, FR-051, FR-048, FR-053, FR-055, FR-064, FR-088, AD-6, AD-7, AD-12, AD-13, AD-17, NFR-011, NFR-022]
depends_on:
  - "5-1-theme-natal-calcule-une-fois-grave"
  - "5-2-numerologie-complete-deterministe"
  - "4-6-arbre-projection-muette-fiche-branche-vue-liste"
  - "4-10-plans-etapes-arbitrage-ouverture"
  - "2-8-voix-anam-controle-automatise-bloquant"
prepare_pour:
  - "5-4-horoscope-mantra-du-jour"
  - "5-6-accueil-bibliotheque-en-cartes"
status: review
migration: "0040_completion_socle.sql"
---

# Story 5.3 : Dégradation gracieuse sans heure & complétion du tronc

> **Ce que cette story a de particulier.** La 5.1 a livré un thème qui sait dire « je n'ai pas
> calculé l'ascendant, et voici pourquoi ». La 5.2 a livré un corpus qui sait dire « ce texte n'est
> pas écrit ». Les deux ont produit des **absences honnêtes que personne ne lit encore**.
>
> La 5.3 est la story qui **les met sous les yeux de quelqu'un**. C'est le premier écran du produit
> dont le sujet est ce qu'il ne sait pas. Et c'est aussi la première fois qu'une absence peut être
> **réparée par l'utilisatrice** — d'où la moitié la plus délicate : le recalcul.
>
> Trois pièges dominent, et ils sont tous les trois du type « ça marche, et c'est faux » :
> **(1)** un thème dont la forme change sans levier de recalcul **brique tous les comptes existants** ;
> **(2)** une heure de naissance sans lieu ne sert **strictement à rien** — la promesse « le tronc se
> complète » serait tenue en apparence et fausse en fait ; **(3)** sans heure, la Lune (et parfois
> une autre planète) n'a **pas de signe déterminable** — l'afficher quand même est exactement le
> mensonge plausible que la 5.1 a passé une story entière à refuser.

---

## Story

En tant qu'utilisatrice qui ne connaît pas son heure de naissance,
je veux un socle honnête sur ce qu'il peut et ne peut pas calculer, et qui se complète le jour où
j'ajoute mon heure,
afin de ne jamais recevoir une donnée inventée.

---

## Critères d'acceptation

1. **[FR-049]** Étant donné une date de naissance sans heure, quand le socle est calculé, alors la
   numérologie complète, le soleil, la quasi-totalité des planètes et l'horoscope quotidien sont
   disponibles, **et** seuls manquent l'ascendant, les maisons et la lune (si elle change de signe
   ce jour-là).
2. **[FR-050]** Étant donné un élément manquant, quand l'utilisatrice consulte le socle, alors le
   produit **annonce clairement ce qui manque et pourquoi** (« je préfère ne pas te l'inventer »)
   **et** indique où trouver l'heure (copie intégrale de l'acte de naissance, mairie du lieu de
   naissance), **et** n'affiche jamais rouge, cadenas, pointillé ni pourcentage.
3. **[FR-051]** Étant donné l'absence d'heure, quand le tronc s'affiche, alors son état est
   `incomplet` (contour entier, matière en réserve), **et** il reste gratuit et visible, **et** le
   mot « incomplet » n'est jamais écrit sur le dessin.
4. **[FR-051 / AD-6]** Étant donné l'ajout ultérieur de l'heure de naissance, quand elle est
   enregistrée, alors le thème natal est **recalculé**, sa version incrémentée et les dépendants
   invalidés, **et** le tronc passe à `complet` au chargement suivant sans animation ni
   « déblocage », **et** Anam le mentionne **une seule fois** puis plus jamais.
5. Étant donné la fiche explicative du tronc incomplet, quand elle est ouverte, alors elle porte
   **exactement deux actions** : « Ajouter mon heure » et « Où la trouver ».

### Critères ajoutés au contexte (issus de l'état réel du dépôt)

6. **[DUR / régression]** Étant donné un thème natal déjà gravé sous l'ancienne forme, quand le
   produit est déployé avec la nouvelle forme, alors ce thème est **recalculé automatiquement à la
   lecture suivante** — aucun compte existant ne devient illisible, et aucune intervention manuelle
   n'est requise.
7. **[DUR / FR-050]** Étant donné une heure de naissance enregistrée **sans lieu exploitable**,
   quand le socle est consulté, alors l'ascendant et les maisons restent **déclarés absents** avec
   leur raison — le tronc ne passe **pas** à `complet`, et rien ne prétend le contraire.
8. Étant donné le caractère **write-once** de l'heure et du lieu (migration 0039), quand
   l'utilisatrice s'apprête à les enregistrer, alors elle est prévenue **avant** l'écriture que ce
   geste ne se refait pas, et elle doit le confirmer explicitement.

---

## Le problème central : trois absences, une seule discipline

Le produit connaît déjà trois façons de ne pas savoir, et elles vivent déjà dans le code :

| Absence | Où elle est déclarée | Depuis |
|---|---|---|
| un corps que l'éphéméride ignore (Chiron) | `theme.absents[]` avec `RaisonNonCalcule` | 5.1 |
| les angles incalculables | `theme.angles = { statut: "non_calcule", raison }` | 5.1 |
| un texte d'interprétation non écrit | `TexteCorpus = { statut: "non_ecrit" }` | 5.2 |

La 5.3 en ajoute **une quatrième**, et c'est la plus subtile parce qu'elle ne ressemble pas à une
absence :

> **le signe d'un corps peut être indéterminable alors que le corps, lui, est parfaitement calculé.**

Sans heure, `resoudreInstant` prend **midi UTC** ([`lib/astro/theme-natal.ts:196`](lib/astro/theme-natal.ts#L196)).
Le calcul aboutit, la longitude est un nombre fini, `placer()` rend un signe. **Rien ne signale que
ce signe est un pari.** Si la Lune était à 29°50' du Cancer à midi et qu'elle est entrée dans le
Lion à 14 h, la moitié des naissances de ce jour-là ont une Lune en Lion et le produit leur annonce
Cancer, avec l'autorité d'un calcul.

C'est **mot pour mot** la faute que la 5.1 a refusé de commettre sur Chiron :

> *« Un Chiron faux est pire qu'un Chiron absent — il est invérifiable et il a l'air juste. »*
> — [`lib/astro/adapters/astronomy-engine.ts:24`](lib/astro/adapters/astronomy-engine.ts#L24)

FR-049 le dit d'ailleurs explicitement, et c'est le seul endroit du PRD qui parle d'une planète
conditionnellement absente : *« Manquent l'ascendant, les maisons et la lune **si elle change de
signe ce jour-là** »*. Le « si » est la story.

---

## Décisions de conception

### D1 — L'ambiguïté de signe est **générique**, pas un cas particulier de la Lune

Le réflexe serait d'écrire un `if (corps === "lune")`. Ce serait faux, et facilement.

Sans heure, la fenêtre d'incertitude vaut **au moins 24 h**. En 24 h :

| Corps | déplacement | probabilité de traverser une cuspide |
|---|---|---|
| Lune | ~13,2° | ~44 % |
| Soleil | ~1,0° | ~3 % |
| Mercure / Vénus | ~1,2° | ~4 % |
| Mars | ~0,5° | ~2 % |
| les lentes | < 0,1° | négligeable, **mais non nulle** |

Un cas particulier sur la Lune laisserait donc passer **un Soleil sur trente** — et le Soleil est
LE nombre que tout le monde connaît. Une utilisatrice née le 22 août dont on annonce « Lion » alors
qu'elle est Vierge n'a aucun moyen de le savoir, et c'est le genre d'erreur qui détruit la confiance
dans tout le reste d'un coup.

**Règle retenue :** pour chaque corps, si son signe n'est pas le même **partout** dans la fenêtre
d'incertitude, le corps part dans `absents` avec la raison `signe_ambigu_sans_heure`. Il n'est pas
« affiché avec un avertissement » : il est **absent**, comme Chiron.

C'est aussi la lecture exacte de FR-049 : *« la **quasi-totalité** des planètes »*. Le « quasi »
n'était pas une précaution rédactionnelle — c'est ce cas-là.

### D2 — La fenêtre d'incertitude : trois cas, une seule formule

`resoudreInstant` distingue déjà trois raisons d'absence d'heure
([`theme-natal.ts:119`](lib/astro/theme-natal.ts#L119)). Chacune a une fenêtre différente, et les
confondre coûterait des ambiguïtés fantômes (fenêtre trop large) ou des signes faux (trop étroite).

Soit `naif` = la lecture de calendrier local interprétée comme si elle était UTC.

| Cas | Ce qu'on ignore | Fenêtre `[min, max]` | Durée |
|---|---|---|---|
| heure connue **et** fuseau connu | rien | `[t, t]` | **0** — aucun échantillonnage, aucun surcoût |
| heure absente, fuseau **connu** | l'heure dans le jour local | `[minuit local, minuit local + 24 h]` | 24 h |
| heure absente, fuseau **inconnu** | l'heure **et** le décalage | `[naif(00:00) − 14 h, naif(24:00) + 12 h]` | **50 h** |
| heure connue, fuseau absent/invalide | le décalage seul | `[naif − 14 h, naif + 12 h]` | 26 h |

Les bornes −12 h / +14 h sont les décalages UTC extrêmes réellement en vigueur (Baker à UTC−12,
Kiribati à UTC+14). Ce ne sont pas des marges de confort : ce sont les bornes du possible.

> ⚠️ **Le cas « 50 h » est le plus fréquent aujourd'hui**, parce qu'aucun lieu de naissance n'est
> capturé nulle part dans le produit (voir D5). Sur 50 h la Lune parcourt ~27° : son signe est
> ambigu **près de neuf fois sur dix**. C'est honnête, et c'est aussi la meilleure raison de
> capturer le lieu dans cette story plutôt que dans une autre.

### D3 — L'ambiguïté est cherchée **par échantillonnage horaire**, pas aux deux bornes

Tester seulement les deux extrémités est plus simple, et faux dans un cas précis : un corps **proche
d'une station** (fin de rétrogradation) peut sortir d'un signe et y revenir à l'intérieur de la
fenêtre. Les deux bornes donneraient le même signe, la vérité serait l'autre.

**Règle retenue :** échantillonnage **toutes les heures**, bornes incluses. Coût maximal : 51
instants × 13 corps = **663 lectures d'éphéméride**, une seule fois, au calcul — jamais à la
lecture (le thème est gravé, AD-6). Quand l'heure est connue, la fenêtre est un point : **zéro
lecture supplémentaire**. Le surcoût ne frappe donc que le cas dégradé.

**Résidu assumé** (à inscrire dans `deferred-work.md`) : un corps qui franchirait une cuspide et
reviendrait en moins d'une heure échapperait encore à l'échantillonnage. Cela suppose une station à
moins de ~0,05° d'une cuspide. La correction exacte serait un solveur de changement de signe
(recherche de racine) ; elle est **déférée**, et le résidu est écrit plutôt que tu.

### D4 — Le schéma du thème passe à **2**, et l'empreinte à **`v2`** — sinon tous les comptes existants sont briqués

**C'est le piège le plus grave de la story.** Il faut le lire en entier avant d'écrire une ligne.

`themeExploitable` refuse tout contenu dont `schema !== 1`
([`depot-theme-natal.ts:97`](lib/data/depot-theme-natal.ts#L97)). Si l'on passe à `schema: 2` **sans
rien d'autre**, voici ce qui se passe pour une utilisatrice existante :

1. lecture du thème stocké → `schema: 1` → `themeExploitable` = faux → on ne le rend pas ;
2. on recalcule, on `upsert` avec `ignoreDuplicates: true` → **conflit ignoré, aucune erreur** ;
3. on relit → toujours `schema: 1` → `themeExploitable` = faux → **`lecture_impossible`**.

Résultat : le socle est mort pour tous les comptes déjà calculés, **définitivement**, et sans une
seule erreur dans les logs. Le mode d'échec est silencieux dans les deux sens.

Le levier existe déjà, et il n'y en a qu'un — 0039 l'a écrit exprès :

> *« un recalcul exige des entrées DIFFÉRENTES »* — [`0039_theme_natal.sql:181`](supabase/migrations/0039_theme_natal.sql#L181)

Or `chaineEmpreinte` commence par le littéral `"v1"`
([`theme-natal.ts:475`](lib/astro/theme-natal.ts#L475)). **Ce préfixe est le levier de migration de
forme.** Le passer à `"v2"` change l'empreinte de tout le monde, sans qu'aucune donnée de naissance
n'ait bougé — donc le trigger autorise exactement **un** recalcul par compte, et la version
s'incrémente comme AD-6 l'exige.

**Règle retenue :** toute modification de la **forme** de `ThemeNatal` s'accompagne, dans le même
commit, de l'incrément du préfixe d'empreinte. Un test bloquant lie les deux (voir T9) : le mutant
« bumper `schema` sans bumper le préfixe » doit rougir.

### D5 — Le recalcul est **paresseux** et déclenché par l'empreinte, jamais par l'action d'écriture

Deux façons de recalculer après l'ajout de l'heure :

| | Recalculer dans l'action qui écrit l'heure | Recalculer à la lecture quand l'empreinte diffère |
|---|---|---|
| une panne pendant le recalcul | l'heure est écrite, le thème reste **périmé pour toujours** | réparé à la lecture suivante |
| deux onglets | double calcul, double `update`, un des deux viole `version+1` | le second voit l'empreinte déjà à jour et ne fait rien |
| migration de forme (D4) | **ne se déclenche jamais** — personne n'a « ajouté son heure » | se déclenche pour tout le monde |
| coût | 1 requête de moins par lecture | +1 `select` sur `utilisatrice` par lecture de socle |

C'est la même conclusion que la décision **D4 de la 5.1** (*« paresseux et idempotent, pas calculé à
l'inscription »*, [`depot-theme-natal.ts:26`](lib/data/depot-theme-natal.ts#L26)), appliquée à
l'autre bout du cycle de vie. Et surtout : **c'est le seul mécanisme qui couvre AC6**, la migration
de forme. Un recalcul câblé sur l'action ne pourrait pas la couvrir, quoi qu'on fasse.

> ⚠️ **Repli obligatoire** : si le recalcul échoue (consentement révoqué → `WITH CHECK` refuse,
> barrière minorité, panne), on **rend le thème stocké** tel quel. Perdre un socle valide parce
> qu'un recalcul a été refusé serait faire disparaître une donnée juste au profit de rien. Le
> nouveau thème est meilleur ; l'ancien reste vrai.

### D6 — `tronc.incomplet?: true` — et **pas** `etat: "complet" | "incomplet"`

Trois états sont possibles dans la vraie vie : complet, incomplet, **et « je n'ai pas réussi à
savoir »** (le thème n'a pas pu être lu). Un énuméré à deux valeurs force à mentir dans le troisième
cas.

Le modèle de scène a déjà tranché ça deux fois, et la règle est écrite :

> *« la projection ne porte que ce qui est VRAI […] Un champ absent ne se lit pas de travers. »*
> — [`lib/scene/projection.ts:112`](lib/scene/projection.ts#L112)

**Règle retenue :** `tronc: { present: true, incomplet?: true }`. Absent ⇒ le tronc se dessine
normalement et **rien n'est annoncé**. Le tronc « complet » n'est pas un état spécial : c'est le
tronc. C'est aussi ce qui rend AC4 (« passe à complet sans animation ni déblocage ») vrai par
construction — il n'y a **rien** à animer, un drapeau disparaît.

Répli sûr sur panne de lecture du thème : **pas de drapeau**. Se tromper en n'annonçant rien coûte
une invitation différée ; se tromper en annonçant « il me manque ton heure » à quelqu'un qui vient
de la donner est un mensonge, juste après le geste qu'on lui avait demandé.

### D7 — Le lieu de naissance est capturé **dans cette story**, derrière un `LieuxPort`

Sans lieu, l'heure ne sert à rien : `resoudreInstant` exige le **fuseau**
([`theme-natal.ts:202`](lib/astro/theme-natal.ts#L202)) et `calculerAngles` exige les
**coordonnées** ([`theme-natal.ts:433`](lib/astro/theme-natal.ts#L433)). Une story qui capturerait
l'heure seule tiendrait AC4 en apparence — « l'heure est enregistrée, le thème est recalculé » — et
produirait exactement le même thème qu'avant, ascendant toujours absent. La promesse serait tenue
mot à mot et fausse en fait.

Le libellé d'AC5 reste **« Ajouter mon heure »** : c'est ce qu'elle cherche, c'est ce qu'elle a sur
son acte de naissance. Le formulaire demande les deux dans le même geste.

**D'où viennent les coordonnées ?** Trois voies, une seule tenable :

| Voie | Verdict |
|---|---|
| coordonnées **écrites de mémoire** par le développeur ou un modèle | **INTERDITE.** C'est fabriquer de la donnée. Une longitude fausse de 2° décale l'ascendant de ~2° : plausible, invérifiable, faux. La règle Chiron s'applique mot pour mot. |
| **géocodeur tiers** appelé à l'écriture | Ajoute un sous-traitant pour de la donnée d'état civil, une dépendance réseau au moment exact où l'écriture est *write-once*, et une DPA de plus. Contraire à la posture NFR-019 / AD-2 (un seul fournisseur externe, derrière un port). |
| **jeu de données public embarqué** | ✅ Retenue. |

**Adopté :** le référentiel officiel des communes françaises (`geo.api.gouv.fr`, Licence Ouverte
Etalab, données INSEE). **Vérifié le 2026-08-07** : `GET https://geo.api.gouv.fr/communes?fields=nom,code,centre&format=json&geometry=centre`
→ **34 969 communes**, toutes avec centroïde. Compacté en `[nom, codeInsee, lat, lon]` :
**1,36 Mo** brut, **507 Ko** gzip. 223 communes d'outre-mer (codes 97x/98x), dont les fuseaux
diffèrent — table de correspondance explicite d'une douzaine d'entrées, jamais `Europe/Paris` par
défaut.

**Périmètre v1 : la France (métropole + outre-mer).** Une naissance à l'étranger ne trouve pas son
lieu → le lieu reste absent → l'ascendant reste absent, **déclaré**, avec sa raison. C'est la
discipline Chiron une troisième fois : on ne couvre pas tout, et on le dit. L'extension à un
référentiel mondial est un remplacement d'**adaptateur**, pas une réécriture — c'est précisément ce
que le port achète.

> **Si le jeu de données ne peut pas être obtenu** au moment du développement : livrer le port et un
> adaptateur qui se déclare **vide**, et le formulaire dit honnêtement qu'il ne sait pas encore
> placer les lieux. Ne **jamais** combler avec une liste écrite de mémoire.

### D8 — La mention unique d'Anam ne peut **pas** passer par le chemin actuel de `chargerOuverture`

AC4 exige qu'Anam mentionne la complétion **une fois**. Le mécanisme évident est `Ouverture`
(union discriminée, tour amorcé au montage de la conversation). Il y a un obstacle, et il est
dirimant :

> [`lib/safety/ouverture-branche.ts:92`](lib/safety/ouverture-branche.ts#L92) —
> `if (!(await premiumSousJwt(...))) return null;` — **la toute première ligne**.

Le socle est **gratuit à vie** (FR-055) et le tronc est **gratuit** (FR-088). Une mention de
complétion de socle derrière le gate premium serait une coupure du socle gratuit — exactement ce que
`tests/socle-jamais-coupe.test.ts` garde. Une utilisatrice gratuite ajouterait son heure et
n'entendrait **jamais** rien.

**Règle retenue :** la mention est évaluée **avant** le gate premium ; le gate ne garde plus que la
proposition/invitation de branche. Un commentaire dans le fichier et un test dédié empêchent
l'« harmonisation » de remettre le gate en tête (le fichier prévient déjà contre ce réflexe pour les
deux directions de repli, [`ouverture-branche.ts:53`](lib/safety/ouverture-branche.ts#L53)).

**Priorité :** la mention passe **en premier** quand elle est due. Elle est ponctuelle et
s'auto-éteint ; la faire perdre à chaque arbitrage reviendrait à ne jamais la dire.

**Fenêtre de détresse (AD-17) :** la mention est **suspendue** pendant un épisode et les 72 h
suivantes. Elle n'est pas perdue — elle reste due, et elle sortira après. Rien ne se superpose à un
épisode, pas même une bonne nouvelle.

### D9 — L'heure est **write-once** : elle se confirme avant de s'écrire

La migration 0039 refuse `valeur → autre valeur` sur `heure_naissance`, `lieu_*`
([`0039:72`](supabase/migrations/0039_theme_natal.sql#L72)). Conséquence concrète : **quelqu'un qui
tape 07:15 au lieu de 19:15 a un ascendant faux pour toujours** — et un ascendant faux a l'air
juste.

Le produit sait déjà traiter un geste irréversible : la déclaration de rayonnement demande une
confirmation solennelle. Même patron ici. **Le formulaire dit, avant l'écriture, que ce geste ne se
refait pas, et exige une confirmation explicite.**

**Ce qu'on ne fait PAS dans cette story :** assouplir le trigger 0039. Affaiblir une garde déployée
comme effet de bord d'une autre story est précisément la façon dont les gardes meurent. Si le besoin
de correction se manifeste (support, faute de frappe), c'est une **décision produit** avec sa propre
migration — inscrite en résidu, pas bricolée ici.

### D10 — Les phrases de cette story ne relèvent **pas** du corpus d'Anima

La porte pré-lancement « corpus d'Anima » (FR-054/FR-086) couvre les **interprétations** : le sens
d'un chemin de vie, d'un signe, d'une carte. Elle ne couvre pas ce que le produit dit **de
lui-même**. « Il me manque ton heure de naissance » n'interprète rien : c'est un aveu de limite.

Même catégorie que `PHRASE_INVITATION` (4.10) ou `VIDE_OU_NAISSENT_LES_BRANCHES` (3.3), tous deux
écrits sans passer par le corpus.

**Mais c'est de la voix d'Anam** — FR-050 cite littéralement une première personne
(« je préfère ne pas te l'inventer »). Donc : source unique dans `lib/domain/`, contrôle de voix 2.8
applicable de plein droit, et — discipline supplémentaire retenue ici — le texte doit passer
`chercherPredictions` (5.2) : cela oblige à écrire « tu **peux** l'ajouter » plutôt que « tu
**pourras** », ce qui est de toute façon la meilleure phrase.

`MESSAGE_SANS_HEURE` ([`lib/domain/message-sans-heure.ts`](lib/domain/message-sans-heure.ts))
existe depuis la 2.7, **inerte, sans consommateur, et explicitement provisoire**. La 5.3 est la
story qui la réveille — et qui doit la **réécrire** : la version actuelle dit « dans ton profil »
(il n'y a pas de profil) et ne dit **rien** de l'acte de naissance ni de la mairie, alors que FR-050
l'exige.

---

## Les pièges — treize choses qui marcheront et qui seront fausses

### P1. Bumper `schema` sans bumper le préfixe d'empreinte
Voir **D4**. Brique tous les comptes existants, silencieusement, dans les deux sens.
**Mutant obligatoire.**

### P2. Recalculer sans repli sur le thème stocké
Consentement révoqué → le `WITH CHECK` de 0039 refuse l'`update` → si l'on rend
`indisponible`, on a **détruit l'accès à un socle valide** pour améliorer un détail. Le vieux thème
reste vrai.

### P3. Croire que `ignoreDuplicates` protège du recalcul
`upsert(..., { ignoreDuplicates: true })` est le chemin de **création**. Le recalcul est un
`update` explicite avec `version: version + 1`. Employer l'`upsert` pour recalculer ne ferait
**rien du tout** (conflit ignoré) et rendrait un succès.

### P4. Incrémenter la version côté client depuis une valeur relue trop tôt
Le trigger exige `new.version = old.version + 1` **exactement**. Deux recalculs concurrents lisant
la même version envoient tous deux `v+1` : l'un passe, l'autre viole la contrainte. C'est **le bon
comportement** (une seule écriture gagne) à condition que le perdant **rende le thème relu**, pas
une erreur.

### P5. Tester l'ambiguïté de signe sur les deux bornes seulement
Voir **D3**. Rate les stations près d'une cuspide.

### P6. Calculer la fenêtre en heures locales avec `new Date(chaine)`
`new Date("1970-11-28")` est interprété **UTC**. La 5.2 s'est déjà fait prendre : `eclaterDate` y
passe par une regex précisément pour ça
([`lib/astro/numerologie.ts`](lib/astro/numerologie.ts)). Même règle ici : jamais
`new Date(chaîne)` dans `lib/astro/`.

### P7. Une fenêtre de 24 h quand le fuseau est inconnu
Le jour **local** n'est pas connu si le fuseau ne l'est pas. La fenêtre réelle est de 50 h (D2).
Prendre 24 h déclarerait « signe certain » des corps dont le signe ne l'est pas — le mensonge exact
que la story existe pour empêcher.

### P8. Mettre le tronc `complet` dès que l'heure existe
L'heure sans lieu ne produit **aucun** angle (AC7). Le prédicat de complétude est
« **les angles sont calculés** », jamais « l'heure est renseignée ». Une seule source :
`theme.angles.statut`.

### P9. Écrire l'heure et le lieu en deux `update` séparés
Un lieu écrit sans heure (ou l'inverse) est un état à moitié valide **et write-once** : la seconde
moitié ne pourra plus être ajoutée si la première a échoué… ou pire, elle le pourra, laissant deux
gestes solennels là où il en fallait un. **Un seul `update`**, comme la 5.2 l'a fait pour
`prenom`/`nom_complet` ([`app/(auth)/naissance/actions.ts:71`](app/(auth)/naissance/actions.ts#L71)).

### P10. Laisser fuir un pourcentage ou une couleur d'alerte
AC2 interdit rouge / cadenas / pointillé / **pourcentage**. `tests/tronc-absence.test.ts` balaie
déjà le vocabulaire de la région arbre mais **n'a aucun motif pour le pourcentage**, et
`pointillé` y est déjà. Ajouter le motif manquant, et **prouver que la nouvelle surface est
inventoriée** (discipline c : le balayage n'est jamais vide).

### P11. La mention unique qui se répète
Sans marqueur persisté, la mention repart à chaque chargement. C'est la faute que 4.10 a déjà payée
et documentée : *« la plus agaçante des répétitions : celle qui se répète parce qu'elle n'a pas
obéi »* ([`ouverture-branche.ts:40`](lib/safety/ouverture-branche.ts#L40)). Le marqueur se pose
**au moment où la mention est servie**, pas au moment du recalcul.

### P12. La mention servie mais jamais vue
Symétrique du précédent : poser le marqueur trop tôt (au recalcul) fait perdre la mention à
quelqu'un qui ne rouvrira la conversation que trois jours plus tard. Le marqueur suit la **parole**,
comme `reserver_invitation_integration` en 4.10.

### P13. Faire porter au thème un champ dérivé de `precision`
Le degré d'un corps est incertain dès que `precision === "midi_par_defaut"`. Ajouter un
`degreIncertain?: true` sur chaque position serait un **miroir** de `precision` — la faute R1-bis,
deux valeurs toujours égales jusqu'au jour où l'une dérive. `precision` reste la source unique ; le
rendu du degré est un problème de **5.6**, inscrit en résidu.

---

## Périmètre — ce que la 5.3 NE fait PAS

| Hors périmètre | Story propriétaire |
|---|---|
| L'affichage du thème natal lui-même (cartes, positions, maisons) | **5.6** |
| Le texte d'interprétation des positions | **corpus d'Anima** (porte pré-lancement) |
| L'horoscope quotidien (AC1 le nomme comme *disponible*, il n'est pas livré ici) | **5.4** |
| Le rendu du degré quand `precision = midi_par_defaut` | **5.6** — résidu inscrit |
| Un référentiel de lieux **mondial** | résidu — remplacement d'adaptateur |
| L'assouplissement du write-once de l'heure | décision produit — résidu |
| La refonte de l'onboarding (qui demanderait l'heure dès l'entrée) | refonte onboarding, déjà actée |

**Sur AC1 :** « l'horoscope quotidien est disponible » se prouve ici comme une **propriété du
socle** (aucun de ses intrants ne dépend de l'heure), pas comme une fonctionnalité livrée. Le test
d'AC1 est un test de **l'inventaire de ce qui manque**, pas un test d'horoscope.

---

## Tasks / Subtasks

- [x] **T1 — `lib/astro/theme-natal.ts` : la fenêtre d'incertitude et l'ambiguïté de signe** (AC1, AC7)
  - [x] `fenetreIncertitude(entrees): { min: Date; max: Date }` — pure, les quatre cas de **D2**,
        jamais `new Date(chaîne)` (**P6**). Fenêtre de durée nulle quand l'heure **et** le fuseau
        sont connus.
  - [x] `signeAmbigu(corps, fenetre, ephemeride): boolean` — échantillonnage **horaire**, bornes
        incluses (**D3**). Sortie anticipée dès qu'un signe diffère.
  - [x] Élargir `CorpsNonCalcule.raison` : `RaisonAbsenceCorps = RaisonNonCalcule | "signe_ambigu_sans_heure"`.
        La raison est **domaine**, pas éphéméride : ne PAS l'ajouter à `RaisonNonCalcule` dans
        `port.ts` (l'adaptateur ne peut pas la produire).
  - [x] `calculerThemeNatal` : un corps au signe ambigu part dans `absents`, **pas** dans `positions`.
  - [x] `schema: 1` → `schema: 2` **et** préfixe de `chaineEmpreinte` `"v1"` → `"v2"`, **dans le
        même commit** (**D4 / P1**).
  - [x] Aucun champ dérivé de `precision` sur les positions (**P13**).

- [x] **T2 — `lib/astro/lieux/` : le port et son adaptateur** (AC7, D7)
  - [x] `lib/astro/lieux/port.ts` — `LieuxPort { identifiant; chercher(requete, limite): LieuNaissance[] }`,
        `LieuNaissance { nom, code, latitude, longitude, fuseau }`. Pur, n'importe rien (même
        discipline que `EphemerisPort`).
  - [x] Script de fabrication du jeu de données (`scripts/`), depuis
        `https://geo.api.gouv.fr/communes?fields=nom,code,centre&format=json&geometry=centre`.
        Sortie compacte `[nom, code, lat, lon]`, provenance et date inscrites dans un en-tête.
        **Aucune coordonnée écrite à la main** (**D7**).
  - [x] Table de fuseaux outre-mer explicite (préfixes 97x/98x → identifiant IANA). Jamais
        `Europe/Paris` par défaut : un `Europe/Paris` posé sur une naissance à Cayenne donne un
        ascendant faux de plusieurs signes.
  - [x] Adaptateur `lieux-france` : recherche insensible à la casse, aux accents et aux tirets
        (réutiliser la normalisation existante, ne pas en écrire une seconde).
  - [x] Le module de données n'est importé que par l'adaptateur — jamais par le chemin de lecture du
        socle (1,36 Mo à parser au démarrage à froid).

- [x] **T3 — `lib/domain/socle-incomplet.ts` : l'inventaire de ce qui manque** (AC1, AC2, AC8)
  - [x] Fonction **pure** `manquantsDuSocle(theme): Manquant[]` — union fermée
        (`ascendant_et_maisons`, `corps_ambigu`), chacune portant sa raison. Aucune I/O, aucun accès
        base : le domaine décide, la couche data ne fait que lui donner le thème.
  - [x] `socleComplet(theme): boolean` ≡ `theme.angles.statut === "calcule"` — **une seule
        source** (**P8**).
  - [x] Réécrire `MESSAGE_SANS_HEURE` : dit ce qui manque, **pourquoi** (« je préfère ne pas te
        l'inventer »), et **où trouver l'heure** — *copie intégrale de l'acte de naissance*, *mairie
        du lieu de naissance* (FR-050). Retirer « dans ton profil » (il n'existe pas).
  - [x] Le texte passe `chercherPredictions` (5.2) et le contrôle de voix 2.8 (**D10**).

- [x] **T4 — `lib/data/depot-theme-natal.ts` : le recalcul paresseux** (AC4, AC6, AC7)
  - [x] Toujours lire les entrées de naissance, calculer l'empreinte courante, la comparer à
        `empreinte_entrees` stockée.
  - [x] Empreintes égales **et** contenu exploitable → rendre le thème stocké, **sans appeler
        l'éphéméride une seule fois** (la propriété « coût marginal nul » de 5.1 doit rester
        mesurée, pas supposée).
  - [x] Empreintes différentes **ou** contenu inexploitable → recalculer, `update` explicite avec
        `version: version + 1` et la nouvelle empreinte (**P3**), puis **relire**.
  - [x] Échec du recalcul (refus `WITH CHECK`, contrainte de version, panne) → **rendre le thème
        stocké** s'il est exploitable (**P2**, **P4**). Ne jamais faire disparaître un socle valide.
  - [x] Aucune donnée art. 9 dans les messages d'erreur (NFR-022).

- [x] **T5 — `lib/scene/projection.ts` + `lib/safety/projection-arbre.ts` : l'état du tronc** (AC3)
  - [x] `tronc: { present: true; incomplet?: true }` (**D6**). Mettre à jour `projectionInitiale`,
        `ARBRE_INDISPONIBLE`, `reconcilierProjection`.
  - [x] `chargerProjectionArbre` lit le thème dans son **propre `try/catch`** — patron
        `abonnementGerable` ([`projection-arbre.ts:73`](lib/safety/projection-arbre.ts#L73)) : une
        panne du socle ne doit **jamais** faire retomber tout l'arbre sur « je n'arrive pas à
        afficher ton arbre ».
  - [x] Repli sur panne : **aucun drapeau** (**D6**).

- [x] **T6 — `render/arbre/` : le tronc adressable et sa fiche** (AC2, AC3, AC5)
  - [x] Tronc en « **matière en réserve** » quand `incomplet` : contour **entier** (jamais
        pointillé), matière atténuée. Aucun rouge, aucun cadenas, aucun pourcentage.
  - [x] Tronc **cliquable** au pointeur et au clavier, cible ≥ 44 px, `aria-label` honnête qui
        n'emploie pas le mot « incomplet ».
  - [x] `FicheTronc.tsx` — **exactement deux actions** : « Ajouter mon heure » et « Où la trouver ».
        « Où la trouver » **révèle sur place** (acte de naissance / mairie), sans quitter la scène.
  - [x] Quand le tronc est complet : **aucune fiche, aucune affordance**. Rien à fermer, rien à
        animer (AC4).

- [x] **T7 — La saisie de l'heure et du lieu** (AC4, AC7, AC8)
  - [x] Page + formulaire + Server Action, derrière les mêmes gardes que la scène (session,
        majorité, consentement) — réutiliser `etapeOnboardingPour`, ne pas réécrire une garde.
  - [x] Recherche de lieu servie par le `LieuxPort` **côté serveur** (le jeu de données ne part
        jamais au client).
  - [x] **Confirmation explicite d'irréversibilité** avant écriture (**D9**), et la phrase le dit en
        clair.
  - [x] **Un seul `update`** portant heure + lieu + coordonnées + fuseau (**P9**). Écriture sous le
        JWT de l'utilisatrice, jamais `service_role` (AD-12).
  - [x] Heure malformée, lieu introuvable, valeur déjà écrite : trois messages distincts, aucun
        n'expose de donnée personnelle.

- [x] **T8 — La mention unique d'Anam** (AC4)
  - [x] Migration `0040_completion_socle.sql` : colonne nullable
        `socle_complete_annonce_le timestamptz` sur `utilisatrice`, posée **par le serveur**
        (`now()`), jamais acceptée de l'appelant (patron 0023/0025). `comment on column`.
  - [x] Nouvelle variante d'`Ouverture` : `{ type: "socle-complete", phrase }`. **Aucun champ
        numérique** — la garde `tests/arbitrage-frontiere.test.ts` s'applique telle quelle.
  - [x] `chargerOuverture` : la mention est évaluée **avant** le gate premium (**D8**), et en
        **premier** quand elle est due. Commentaire expliquant pourquoi le gate ne peut pas remonter.
  - [x] **Suspendue** pendant la fenêtre de détresse, **non consommée** (AD-17).
  - [x] Le marqueur est posé **au moment où la mention est servie** (**P11**, **P12**), de façon
        atomique — deux onglets ne peuvent pas la dire deux fois.
  - [x] Rendu du tour dans la conversation, registre Anam, aucune célébration, aucun « débloqué ».

- [x] **T9 — Gardes et tests**
  - [x] `tests/theme-natal.test.ts` : fenêtres (les quatre cas), ambiguïté de signe sur un cas réel
        **connu** de Lune à cheval, un cas de Soleil à cheval, et un cas **non** ambigu (présence
        avant absence).
  - [x] **Le test qui lie `schema` et le préfixe d'empreinte** (**P1**) : bumper l'un sans l'autre
        doit rougir. C'est le test le plus important de la story.
  - [x] `tests/theme-natal-sql.test.ts` : recalcul contre le vrai SQL — version incrémentée d'un,
        empreinte différente, ancien thème conservé sur refus, coût marginal nul quand rien n'a
        changé (port doublé qui **compte ses appels**).
  - [x] `tests/tronc-absence.test.ts` : inventorier `FicheTronc.tsx`, ajouter le motif
        **pourcentage**, et prouver que le mot « incomplet »/« incomplète » n'atteint jamais l'écran
        de la région arbre — `aria-label` compris (**P10**). Discipline (a)(b)(c) obligatoire.
  - [x] `tests/socle-jamais-coupe.test.ts` : la mention de complétion n'est **pas** derrière le gate
        premium (**D8**) — un compte gratuit l'entend.
  - [x] `tests/rendu/` : le tronc incomplet est atteignable au clavier, la fiche porte
        **exactement** deux actions, le tronc complet n'a **aucune** affordance.
  - [x] Campagne de mutation, mutants obligatoires : P1, P2, P3, P5, P7, P8, P9, P11, D6 (repli
        drapeau posé sur panne), D8 (gate remis en tête).

---

## Dev Notes

### Ce qui existe déjà et qu'il ne faut pas réécrire

| Besoin | Ce qui existe | Où |
|---|---|---|
| dire qu'un corps est absent avec sa raison | `CorpsNonCalcule`, `theme.absents[]` | `lib/astro/theme-natal.ts:326` |
| dire que les angles manquent | `AnglesAbsents`, `RaisonSansAngles` | `lib/astro/theme-natal.ts:268` |
| savoir que l'heure manquait | `precision: "midi_par_defaut"` | `lib/astro/theme-natal.ts:344` |
| le levier de recalcul | `theme_natal_recalcul_declare()` | `supabase/migrations/0039_theme_natal.sql:160` |
| le write-once heure/lieu | `naissance_ecrite_une_fois()` | `supabase/migrations/0039_theme_natal.sql:72` |
| une phrase « sans heure » | `MESSAGE_SANS_HEURE` (**inerte, à réécrire**) | `lib/domain/message-sans-heure.ts` |
| un drapeau optionnel dans la projection | `gestesSuspendus`, `planOuvert`, `abonnementGerable` | `lib/scene/projection.ts` |
| une fiche superposée à l'arbre | `FicheBranche.tsx` | `render/arbre/` |
| une garde d'absence de vocabulaire | `tests/tronc-absence.test.ts` | `tests/` |
| un détecteur de prédiction | `chercherPredictions` | `lib/domain/marqueurs-prediction.ts` |
| un `try/catch` local qui protège le reste de l'arbre | `abonnementGerable` | `lib/safety/projection-arbre.ts:73` |

### Détails qui font perdre une heure si on les découvre en route

- **Aucune colonne de lieu n'est à créer.** 0039 a déjà posé `heure_naissance time`,
  `lieu_naissance text`, `lieu_latitude`, `lieu_longitude`, `lieu_fuseau`, toutes nullables. La
  migration 0040 n'ajoute **que** `socle_complete_annonce_le`.
- **`heure_naissance` est de type `time`** : supabase-js la relit en `"07:15:00"`.
  `resoudreInstant` accepte déjà `HH:MM` **et** `HH:MM:SS` — ne rien « normaliser » au passage.
- **La contrainte `utilisatrice_lieu_coordonnees_ensemble`** (0039) exige `lat` et `lon` toutes deux
  nulles ou toutes deux posées. Un `update` qui n'en pose qu'une est refusé par la base — ce qui est
  la bonne nouvelle : P9 est déjà gardé côté SQL.
- **`themeExploitable` doit exiger `schema === 2`**, pas « 1 ou 2 ». Accepter les deux rendrait un
  thème d'ancienne forme sans le champ `absents` élargi. L'ordre du dépôt règle le reste :
  l'empreinte est comparée **avant**, et elle diffère toujours après le passage à `"v2"`.
  Cas résiduel (contenu inexploitable **et** empreinte identique) : recalculer **une fois**, puis
  déclarer `lecture_impossible` — jamais de boucle.
- **Un nouveau `Tour`** dans `render/conversation/types.ts` pour la mention, sur le patron
  `proposition-branche` / `invitation-integration` : amorcé au **montage**, jamais par le pipeline
  `message`.
- **La recherche de lieu passe par une Server Action**, pas par une nouvelle route publique : elle
  est déjà authentifiée, et cela n'ajoute aucune surface d'API.
- **La numérologie (5.2) ne dépend ni de l'heure ni du lieu.** Elle n'a rien à changer ; AC1 la
  mentionne comme *disponible*, ce qui est déjà vrai et se prouve par un test d'inventaire.

### Contraintes d'architecture qui s'appliquent

- **AD-6** — le socle est du calcul pur dans `lib/astro/`, jamais un modèle. `tests/astro-architecture.test.ts`
  interdit déjà `@/lib/ai/*`, **et** (depuis 5.2) toute horloge / hasard / `process.env` dans
  `lib/astro/`. La fenêtre d'incertitude se calcule à partir des **entrées**, jamais de l'heure
  courante.
- **AD-7** — `render/` dessine, il ne décide pas. « Le tronc est-il incomplet » se décide dans
  `lib/scene`/`lib/safety`, jamais dans le composant.
- **AD-10** — `lib/astro/` n'importe jamais `lib/data`. La règle inverse (`lib/data` → `lib/astro`)
  est autorisée et gardée.
- **AD-12 / AD-13** — écriture sous le JWT de l'utilisatrice ; le `WITH CHECK` de `theme_natal`
  reste la garde réelle du recalcul.
- **AD-17** — la fenêtre de détresse suspend la mention (D8).
- **NFR-022** — ni heure, ni lieu, ni coordonnées dans un log ou un message d'erreur.

### Le socle ne se coupe jamais (FR-055)

`tests/socle-jamais-coupe.test.ts` porte un inventaire d'items FR-055 avec un drapeau `existe`. La
« dégradation gracieuse » **n'y est pas un item** : ce n'est pas un contenu de socle, c'est la
manière dont le socle dit ce qu'il ignore. Rien à basculer, donc — mais **deux obligations** :

1. les fichiers nouveaux du chemin socle passent la preuve positive « aucun gate premium ne le
   garde » (le test balaie **les commentaires aussi** : la 5.2 s'y est fait prendre sur une simple
   référence à un nom de fichier) ;
2. un test **nouveau** prouve que la mention de complétion n'est pas derrière le gate premium (D8).

### Le thème natal n'a encore **jamais** été calculé en production

`lireThemeNatal` n'a **aucun appelant applicatif** aujourd'hui — seulement des tests
(`grep -rn "lireThemeNatal" app/ render/ lib/` ne rend rien hors du dépôt lui-même). La 5.3 lui en
donne son premier : `chargerProjectionArbre`. Trois conséquences à ne pas découvrir en production :

- le **write-gate art. 9** de 0039 sera exercé pour de vrai pour la première fois ;
- au premier chargement après déploiement, **chaque compte** déclenche un calcul + une écriture ;
- ce calcul emprunte le **cas dégradé** (aucun lieu n'est capturé nulle part aujourd'hui) : fenêtre
  de 50 h, échantillonnage horaire, ~663 lectures d'éphéméride. C'est la seule fois. Mesurer, et
  inscrire le chiffre dans les notes de complétion.

### « Invalider les dépendants » (AD-6) : il n'y en a **aucun** aujourd'hui

Le SPINE écrit *« le recalcul FR-051 incrémente la version et invalide les dépendants »*. Aucun
cache ne dépend du thème pour l'instant — l'horoscope (5.4) sera le premier. **Ne pas construire une
couche d'invalidation de cache dans cette story.** L'obligation ici se réduit à : la version
s'incrémente et devient lisible par les futurs dépendants. Le reste appartient à la 5.4.

### Commandes

```bash
set -a && . ./.env.local && set +a && npx vitest run
npx tsc --noEmit && npx eslint . && npx next build
supabase db reset          # CLI GLOBALE (/opt/homebrew/bin/supabase) — jamais npx supabase
```

État de départ : **2370 tests / 170 fichiers**, `tsc` + `eslint` + `next build` propres, migrations
0001→0039 locales et cloud (parité 39/39/39).

### Déploiement

Cette story **ajoute la migration 0040** → déploiement cloud requis après livraison
(Management API + `SUPABASE_ACCESS_TOKEN`, projet `zlhlzoalmszohrxrnsmo`, `User-Agent` non
défaut). La parité devra passer à 40/40/40.

### Références

- [Source: `_bmad-output/planning-artifacts/epics.md#Story 5.3`]
- [Source: `_bmad-output/planning-artifacts/prds/prd-Anima-2026-07-21/prd.md` — FR-049, FR-050, FR-051, FR-088]
- [Source: `ARCHITECTURE-SPINE.md#AD-6`] — « recalculé seulement si l'heure de naissance est ajoutée (FR-051) »
- [Source: `ARCHITECTURE-SPINE.md` — Cache & versions] — « projection du tronc **clés par version** ; le recalcul FR-051 incrémente la version et invalide les dépendants »
- [Source: `_bmad-output/implementation-artifacts/5-1-theme-natal-calcule-une-fois-grave.md#Périmètre`] — les quatre lignes explicitement renvoyées à la 5.3
- [Source: `supabase/migrations/0039_theme_natal.sql:54-71`] — « le bon invariant est WRITE-ONCE […] c'est la 5.3 »

---

## Questions pour Julian (à trancher, sans bloquer le démarrage)

1. **Le référentiel de lieux : France seule en v1 ?** Le jeu de données officiel (34 969 communes,
   507 Ko gzip) couvre métropole + outre-mer. Une naissance à l'étranger n'aura pas d'ascendant, et
   le dira. Étendre au monde est un remplacement d'adaptateur — plus tard, sans réécriture.
   *Défaut retenu : France seule.*
2. **Le write-once de l'heure.** Une faute de frappe est définitive et produit un ascendant faux
   d'aspect normal. Je garde le write-once + une confirmation solennelle, et j'inscris
   « autoriser la correction » en résidu. *Défaut retenu : on ne touche pas à la garde déployée.*
3. **Où vit la saisie ?** Une petite page dédiée atteignable depuis la fiche du tronc, plutôt que
   dans l'onboarding (qui doit être refondu). *Défaut retenu : page dédiée.*

---

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context) — analyse et implémentation inline, aucun sous-agent.

### État final vérifié

| | Avant (12adc44) | Après |
|---|---|---|
| Tests | 2370 / 170 fichiers | **2526 / 175 fichiers** (+156) |
| `tsc --noEmit` | propre | propre |
| `eslint .` | propre | propre |
| `next build` | propre | propre (`/heure-naissance` servie) |
| Migrations locales | 0001→0039 | **0001→0040** |
| Campagne de mutation | — | **28 mutants, 28 tués** |

### Ce que les tests m'ont appris (et que la relecture n'avait pas vu)

Cinq défauts trouvés par la suite, pas par l'œil. Ils sont notés ici parce qu'ils disent où porte
réellement le risque de cette story :

1. **`chercher` n'est pas `trouverParCode`.** Le point d'écriture résolvait la commune choisie via
   `chercher(code)` — or `chercher` interroge le **nom**, et aucune commune ne s'appelle « 33063 ».
   Le formulaire refusait **toutes** les saisies valides. Le port a gagné une opération distincte,
   avec son contrat écrit.
2. **`schema: 2` seul ne compile pas** — `tsc` a montré le piège P1 immédiatement (`themeExploitable`
   testait `=== 1`). C'est la seule fois où le compilateur a attrapé ce que la story annonçait comme
   son défaut le plus grave.
3. **Un port doublé change l'empreinte.** Le test « le thème n'est pas recalculé à chaque affichage »
   employait un port de test : autre `identifiant`, donc autre empreinte, donc recalcul **légitime**.
   Le test mesurait l'inverse de ce qu'il croyait. Corrigé en *enveloppant* le vrai adaptateur — et
   la propriété découverte au passage (changer d'adaptateur recalcule) est devenue un test à part.
4. **`lib/scene` bannit le mot `message`.** Le champ portant la phrase du tronc s'appelait `message` ;
   `tests/scene-architecture.test.ts` a rougi. La garde avait raison — le concept de conversation ne
   doit pas fuir dans le modèle de scène. Renommé `phrase`, comme `Ouverture.phrase`.
5. **La mise en scène d'un test peut mentir.** Le test AD-17 refermait un épisode de détresse avec
   `fin` 96 h dans le passé, ce qui viole `episode_fin_apres_debut`. L'écriture était refusée, le test
   échouait, et il accusait le code. L'erreur PostgREST est désormais **assérée**.

### Écarts assumés par rapport au contexte de story

- **`socleComplet` n'existe pas ; c'est `manqueLHeure` qui décide.** Le contexte écrivait
  `socleComplet ≡ angles.statut === "calcule"`. C'est vrai partout sauf au **pôle géographique
  exact**, où l'ascendant n'existe pas : le tronc s'y serait affiché incomplet et la fiche aurait
  réclamé une heure déjà donnée. Le prédicat dérive donc de l'**inventaire des absences réparables**,
  pas d'un statut. Un seul prédicat, et il dit la vérité partout. Le cas est testé.
- **Les phrases voyagent par la projection, pas par `copie-arbre.ts`.** `render/` ne peut pas importer
  `lib/domain` (AD-10) ; recopier les textes aurait fabriqué une divergence en attente. Elles
  transitent comme données dans `tronc.incomplet`, exactement comme `Ouverture.phrase` depuis la 4.10.
- **Pas de trigger d'écriture directe sur `socle_complete_annonce_le`.** Le pire qu'une personne
  puisse se faire en posant elle-même cette date, c'est **se priver d'une phrase** — sur sa propre
  ligne, sous RLS. Le seul moyen de l'empêcher tout en laissant passer la RPC aurait été un drapeau de
  transaction lu par le trigger : un mécanisme à comprendre dans deux fonctions, pour protéger
  quelqu'un de sa propre requête SQL contre son propre confort. L'absence est **documentée dans la
  migration** pour qu'on ne la prenne pas pour un oubli.
- **T9 a produit deux corrections d'outillage** : `texteVisible` écarte désormais les interpolations
  `${…}` (un nom de variable n'est pas du texte visible), et la garde du pourcentage porte une
  exception CSS **nommée et éprouvée pour elle-même** (`estValeurCss`) plutôt qu'un motif affaibli.

### Campagne de mutation — 28 mutants, 28 tués

| | Mutant | Tué par |
|---|---|---|
| M1 | `schema` bumpé sans le préfixe d'empreinte | theme-natal |
| M2 | préfixe d'empreinte figé à `v1` | theme-natal |
| M3 | l'ambiguïté redevient un cas particulier de la Lune | theme-natal |
| M4 | échantillonnage réduit aux deux bornes | theme-natal |
| M5 | fenêtre de 24 h sans fuseau (au lieu de 50 h) | theme-natal |
| M6 | jour local = « minuit + 24 h » (casse au changement d'heure) | theme-natal |
| M7 | le tronc dérive du statut des angles (casse au pôle) | socle-incomplet |
| M8 | le tronc devient incomplet à cause de Chiron | socle-incomplet |
| M9 | recalcul par `upsert` (conflit ignoré → succès muet) | theme-natal-sql |
| M10 | un recalcul refusé détruit le socle gravé | theme-natal-sql |
| M11 | plus de comparaison d'empreinte (aucun recalcul) | theme-natal-sql |
| M12 | une panne du socle POSE le drapeau | orchestrateur-arbre |
| M13 | « socle illisible » se lit « il manque ton heure » | orchestrateur-arbre |
| M14 | la mention repasse sous le gate premium | socle-jamais-coupe |
| M15 | une troisième action dans la fiche | rendu/tronc-incomplet |
| M16 | l'affordance du tronc rendue en permanence | rendu/tronc-incomplet |
| M17 | l'écriture découpée en deux `update` | heure-naissance-actions |
| M18 | les coordonnées postées sont acceptées | heure-naissance-actions |
| M19 | la confirmation n'est plus exigée côté serveur | heure-naissance-actions |
| M20 | `Europe/Paris` par défaut sur tous les territoires | lieux |
| M21 | les communes sans fuseau redeviennent résolubles | lieux |
| M22 | le mot « incomplet » atteint l'écran | tronc-absence |
| M23 | 0040 — la garde de détresse saute | annonce-socle-sql |
| M24 | 0040 — la condition « thème recalculé » saute | annonce-socle-sql |
| M25 | 0040 — le verrou consultatif saute | annonce-socle-sql |
| M26 | l'exception CSS élargie à tout `%` | tronc-absence |
| M27 | l'extracteur cesse d'écarter les interpolations | tronc-absence |

Snapshot/restauration par `cp` (jamais `git checkout`) ; arbre vérifié **identique** au snapshot
après la campagne, et `db reset` rejoué de part et d'autre des trois mutants SQL.

### Couverture des critères d'acceptation

| AC | Où c'est prouvé |
|---|---|
| AC1 — la quasi-totalité du socle sans heure | `theme-natal.test.ts` (ambiguïté générique), `socle-incomplet.test.ts` (inventaire) |
| AC2 — ce qui manque, pourquoi, où chercher | `socle-incomplet.test.ts` (FR-050 mot pour mot), `rendu/tronc-incomplet.test.tsx` |
| AC3 — tronc `incomplet`, jamais le mot | `orchestrateur-arbre.test.ts`, `tronc-absence.test.ts`, `rendu/tronc-incomplet.test.tsx` |
| AC4 — recalcul, version + 1, mention unique | `theme-natal-sql.test.ts`, `annonce-socle-sql.test.ts` |
| AC5 — exactement deux actions | `rendu/tronc-incomplet.test.tsx` |
| AC6 — une forme périmée se répare seule | `theme-natal-sql.test.ts` (« le mutant qui compte ») |
| AC7 — heure sans lieu ⇒ tronc toujours incomplet | `socle-incomplet.test.ts` (P8) |
| AC8 — irréversibilité confirmée avant l'écriture | `heure-naissance-actions.test.ts` |

### Déploiement — À FAIRE

La migration **0040** n'est PAS déployée. Parité actuelle : fichiers 40 / local 40 / **cloud 39**.
Le déploiement passe par la Management API (`SUPABASE_ACCESS_TOKEN`, projet `zlhlzoalmszohrxrnsmo`,
`User-Agent` non défaut).

### File List

**Nouveaux**
- `lib/astro/lieux.ts` — `LieuxPort`, table des fuseaux français, normalisation de recherche
- `lib/astro/adapters/lieux-france.ts` — l'adaptateur (seul autorisé à lire le référentiel)
- `lib/astro/adapters/communes-france.json` — 34 969 communes (Etalab/INSEE, généré)
- `lib/domain/socle-incomplet.ts` — l'inventaire de ce qui manque et ce que l'heure réparerait
- `scripts/construire-lieux-france.mjs` — fabrique le référentiel depuis la source publique
- `supabase/migrations/0040_completion_socle.sql` — marqueur + réservation atomique
- `app/heure-naissance/page.tsx`, `formulaire-heure.tsx`, `actions.ts`, `heure-naissance.module.css`
- `render/arbre/FicheTronc.tsx`, `render/arbre/BoutonTronc.tsx`
- `tests/lieux.test.ts`, `tests/socle-incomplet.test.ts`, `tests/heure-naissance-actions.test.ts`,
  `tests/annonce-socle-sql.test.ts`, `tests/rendu/tronc-incomplet.test.tsx`

**Modifiés**
- `lib/astro/theme-natal.ts` — fenêtre d'incertitude, ambiguïté de signe, `schema: 2`, empreinte `v2`
- `lib/data/depot-theme-natal.ts` — recalcul paresseux par empreinte, repli sur le thème gravé
- `lib/data/depot-arbitrage.ts` — `reserverAnnonceSocle()`
- `lib/domain/message-sans-heure.ts` — réécrit (FR-050 : où trouver l'heure)
- `lib/domain/arbitrage-ouverture.ts` — variante `socle-complete` + `PHRASE_SOCLE_COMPLETE`
- `lib/safety/projection-arbre.ts` — état du tronc, `try/catch` interne
- `lib/safety/ouverture-branche.ts` — la mention AVANT le gate premium
- `lib/scene/projection.ts` — `tronc.incomplet`
- `render/arbre/` — `ArbreInteractif`, `EtatVideArbre`, `VueListe`, `copie-arbre`, `arbre.module.css`
- `render/conversation/` — `types.ts`, `Conversation.tsx`
- `app/page.tsx` — passe `user.id` à la projection
- `tests/` — `theme-natal`, `theme-natal-sql`, `astro-architecture`, `orchestrateur-arbre`,
  `socle-jamais-coupe`, `tronc-absence`, `arbitrage-frontiere`, `sortie-abonnement`
- `_bmad-output/implementation-artifacts/` — `sprint-status.yaml`, `deferred-work.md`

### Change Log

| Date | Version | Description |
|---|---|---|
| 2026-08-07 | 0.1 | Contexte créé — 8 AC, 10 décisions, 13 pièges, 9 tâches |
| 2026-08-11 | 1.0 | T1→T9 livrés — 2526 tests / 175 fichiers, 28/28 mutants tués, migration 0040 locale |
