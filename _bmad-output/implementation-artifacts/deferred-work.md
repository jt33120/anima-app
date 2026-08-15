# Travail différé

Éléments réels, non actionnables maintenant (pré-existants ou hors périmètre de la story en cours), à reprendre au bon moment.

> **Les portes pré-lancement sont désormais rassemblées dans [PORTES-AVANT-PUBLICATION.md](PORTES-AVANT-PUBLICATION.md).**
> Elles restent écrites ici, dans la section de la story qui les a rencontrées — ce fichier garde le
> contexte, l'autre donne la vue d'ensemble. Une porte nouvelle s'écrit aux deux endroits.

## Deferred from: code review of 1-5-consentement-art9-declaration-ia (2026-07-23)

- **✅ Garde de route sur la scène `/` — FAIT (Story 1.6).** `/` est désormais gardée par `etapeOnboardingPour` (compte + majorité + consentement, + routage de l'état `revoque`) et rend la scène 2D à la place du prototype WebGL. [app/page.tsx]
- **Mention IA persistante (AD-9 / FR-013)** — la déclaration « Tu vas parler à une intelligence artificielle » n'existe que sur `/consentement`, inatteignable une fois le consentement donné. AD-9 demande une mention IA accessible en continu. **Relève de l'écran de séance / conversation** (epic ultérieur). [app/(auth)/consentement/page.tsx]
- **Open redirect dans `/auth/confirm` (pré-existant, Story 1.3)** — le paramètre `next` est utilisé tel quel dans la redirection : `?next=https://evil.com` renvoie hors domaine après un échange de code valide (exploitabilité limitée : exige un code à usage unique valide). **Correctif simple** : allow-list « chemin interne commençant par `/` ». Non introduit par 1.5 mais le fichier est touché par le diff. [app/auth/confirm/route.ts:39]
- **AC1 « sans défilement obligatoire » — vérification iPhone** (décision de revue 2026-07-23) — l'écran de consentement est dense (déclaration + conservation/effacement + accordéon + 2 cases à texte long + boutons) et `.page` centre le contenu (`justify-content:center`), ce qui rogne le débordement plutôt que de le rendre défilable. **À mesurer sur un vrai iPhone (~375×667) avant tout ajustement** — porte pré-lancement. Fix probable si confirmé : centrage → flux (`flex-start`), rythme vertical resserré, sans retirer de texte légalement requis. [app/(auth)/consentement/page.tsx, consentement.module.css]

## Coutures de la Story 2.4 (entité `episode_detresse`) — à brancher au bon moment

L'entité et ses dérivations sont livrées et prouvées ; leurs **consommateurs** relèvent de stories ultérieures :

- **Garde de branche `branche_bloquee_par_detresse()` — couture Epic 4.** La fonction SQL (keyée `auth.uid()`, granted `authenticated`) est livrée et testée mais **inerte** : la table `branche` n'existe pas encore. Quand Epic 4 créera `create-branche` (write art. 9 sous JWT), son write-gate DOIT appeler `branche_bloquee_par_detresse()` dans son `WITH CHECK` (patron `est_barre_minorite()` durcissant `art9_temoin`). C'est le point d'application « au point d'écriture » d'AD-16/FR-042. [supabase/migrations/0010_episode_detresse.sql]
- **`limites_levees` — consommé en Story 2.5 / 2.9.** Le pipeline retourne `ResultatSecurite.limitesLevees` (dérivé de `fin IS NULL`), **disponible** dans la route mais **pas encore consommé** : la garde de **montage** (paywall, bandeau de quota, carte d'abonnement, bilan **refusent de se monter** tant qu'il est vrai — FR-043) est la Story 2.5 (garde UI) et la Story 2.9 (placement du paywall sous le bilan). [app/api/anam/message/route.ts, lib/safety/pipeline.ts]
- **Exclusion FR-046 des analyses — à câbler quand journal/synthèse/arbre existeront (Epic 4).** `episode_detresse` est une **entité séparée** du journal → aucune analyse actuelle ne l'inclut. Quand la synthèse (FR-066) et l'arbre analyseront le journal, elles devront **exclure** les entrées écrites pendant un épisode + 72 h (même fenêtre que `ecritureBrancheBloquee`). Rien à faire tant que ces analyses n'existent pas. [lib/safety/episode-detresse.ts]
- **Seuils d'extinction PROVISOIRES — porte pré-lancement clinique (héritée de 2.3).** `SEUIL_TOURS_SURS` (3) et `DUREE_MIN_EPISODE_MS` (30 min) sont des placeholders de seuillage de sécurité (PRD §5), à valider par un professionnel qualifié. La **structure** (transition unique possédée, paramétrée) est définitive ; les **valeurs**, non. [lib/safety/episode-detresse.ts]

## Coutures de la Story 2.5 (filet hors-IA + garde de montage) — à brancher au bon moment

Le filet et la garde sont livrés et prouvés ; leurs **consommateurs** relèvent de stories ultérieures :

- **`<GardeCommerciale>` — couture 2.9 / Epic 3.** Le composant (`app/_commerce/GardeCommerciale.tsx`) et le prédicat `limitesCommercialesLevees` sont livrés et testés mais **inertes** : aucune UI commerciale n'existe. Story 2.9 (placement du bilan/paywall sous la clôture) et Epic 3 (Stripe : paywall, bandeau de quota, carte d'abonnement) DOIVENT envelopper leur UI dans `<GardeCommerciale utilisatriceId={user.id}>`. La **garde prospective** (`tests/garde-commerciale.test.ts`) rejette toute UI commerciale (fichier `paywall|abonnement|quota|bilan|checkout|premium`) qui ne l'importe pas. [app/_commerce/GardeCommerciale.tsx, lib/safety/limites-commerciales.ts]
- **✅ Haltes DANS la conversation + sortie rapide (FR-074) — FAIT (Story 2.6).** Bloc ressources inséré dans le fil (niv. 2 après / niv. 3 vital avant, `15/112` en tête), ordonné par famille de danger, via une trame NDJSON `{t:"ressources"}` ; **sortie rapide** livrée en tête de `/aide`. [render/conversation/BlocRessources.tsx, lib/safety/bloc-ressources-detresse.ts, app/aide/SortieRapide.tsx]
- **Liste des ressources PROVISOIRE + revue trimestrielle FR-044.** `ressources-aide.ts` (numéros, familles de danger, libellés) est un **placeholder** à valider par un professionnel qualifié (et un juriste) avant mise en ligne (PRD §5). La revue est **trimestrielle, assignée, tracée** (`VERIFIE_LE`/`PROCHAINE_REVUE`/`RESPONSABLE_REVUE`). **Porte pré-lancement : poser `PRELANCEMENT=1` en CI de prod** — active le hard-break de péremption (« un numéro périmé est un défaut critique »). Transférer `RESPONSABLE_REVUE` au professionnel qualifié. [lib/safety/ressources-aide.ts]
- **Entrée « Aide et ressources », premier du menu (FR-077) — quand un menu existera.** Le shell v1 est scène-first, sans menu global : la **porte de secours** (surimpression, 2 gestes) EST l'accès toujours-présent. Quand un menu sera introduit, son **premier** item doit être « Aide et ressources » → `/aide`. [render/surimpression.tsx, lib/scene/surimpression.ts]
- **Décision archi : matcher `proxy.ts` inchangé.** `/aide` n'est PAS exclue du matcher (contre la suggestion 1.8) : la page lit déjà zéro session (garde de test), aucun traceur n'existe, le rafraîchissement de session est un no-op first-party pour une visiteuse déconnectée, et l'exclure ferait perdre la CSP de défense en profondeur. [proxy.ts]

## Coutures de la Story 2.6 (réponse de détresse par niveaux) — à brancher au bon moment

La réponse par niveaux, le bloc ressources et la sortie rapide sont livrés et prouvés. Restent :

- **AC5 « le lendemain » (FR-045) — comportement déféré Epic 4 (mémoire) + Ordonnanceur.** 2.6 livre le prédicat **pur** `estLendemainDEpisode` (`lib/safety/lendemain.ts`) en **couture inerte** : aucun consommateur (ni reprise de session, ni Ordonnanceur n'existent). Quand Epic 4 lira la conversation persistée, la reprise « en une phrase » l'appellera (lecture réelle de `episode_detresse`) ; la **suppression de la notif du socle du lendemain** (après un niveau 2-3) relève de l'**Ordonnanceur**. **Invariant tenu dès maintenant** : aucun bandeau / carte « comment vas-tu » / « suivi » ne se monte le lendemain. Fenêtre de récence (36 h) PROVISOIRE. [lib/safety/lendemain.ts]
- **Couture de la VOIX (Story 2.8).** 2.6 pose l'**overlay détresse** en consigne système ; 2.8 composera la **voix de base** d'Anam au-dessus (`[voix, détresse, …messages]`) — le point d'injection est le même (route, entre le verdict et la requête). La voix ≤ 3 phrases / hypothèses / anti-flatterie de 2.8 s'ajoutera sans déloger l'overlay de sécurité. [app/api/anam/message/route.ts, lib/safety/consigne-detresse.ts]
- **Contenu détresse + étiquetage niveau/famille + sortie rapide PROVISOIRES — porte pré-lancement clinique + juridique.** Les formulations (`consigne-detresse.ts`), le prompt de famille (`detecteur-detresse.ts`), l'adéquation des ressources par danger (`bloc-ressources-detresse.ts`) et l'URL neutre / le libellé de la sortie rapide (`SortieRapide.tsx`) sont l'**intention produit** (PRD §5, « Formulations de référence »), NON un protocole validé : à valider par un professionnel qualifié **et un juriste** avant mise en ligne sur données réelles. [lib/safety/, app/aide/SortieRapide.tsx]
- **Mutualisation du bloc ressources (dette légère).** `render/conversation/BlocRessources.tsx` (bloc dans le fil) et `app/aide/page.tsx` (bloc sur `/aide`) rendent la même donnée avec le même style (fiche `surface-elevee`/`bordure-forte`, `tel:` chiffre par chiffre, nom accessible « numéro, service, chiffres » après R7). Frontières différentes (render/ vs app/, types de vue distincts pour respecter AD-7) → duplication **assumée** aujourd'hui ; à mutualiser (feuillet présentationnel partagé `LigneRessource`) si un 3ᵉ consommateur apparaît. [render/conversation/BlocRessources.tsx, app/aide/page.tsx]
- **Sortie rapide — neutralisation de l'entrée d'historique PRÉCÉDENTE (revue 2.6, différé).** `SortieRapide` fait `location.replace` → écrase l'entrée `/aide` courante, mais un « Précédent » depuis le site neutre peut restaurer la page in-app (conversation) atteinte via un `Link` Next.js. Un effacement FIABLE de l'historique n'est pas atteignable côté client (API navigateur limitée). La sortie rapide étant déjà **PROVISOIRE** (porte juriste + professionnel qualifié), la neutralisation plus profonde (ex. pile d'historique, ou ouverture du site neutre en remplacement total) relève de ce gate. [app/aide/SortieRapide.tsx]
- **Jeu de cas famille de danger (FR-078 étendu).** La mesure du rappel (2.3) porte sur le niveau ; l'exactitude de la **famille** détectée (suicide vs violences/enfance/vital) n'est pas encore mesurée. À ajouter au jeu de cas validé quand le prompt de famille sera durci (porte clinique). [tests/fixtures/, lib/safety/mesure-rappel.ts]

## Différés de la revue de code 2.4 (2026-07-28) — réels, non corrigés (avec raison)

- **Fail-safe du classifieur en panne prolongée (F7) — comportement VOULU, à surveiller côté ops.** Si la détection tombe durablement, chaque tour renvoie un repli sûr (niveau 1) → l'épisode reste ouvert → `limites_levees=true` tant que la panne dure (aucun paywall). C'est le fail-safe d'AD-15 (le doute protège), pas un bug. Le garde-fou est l'**alerting sur la santé du classifieur** (SPINE Observabilité, déjà prévu) : une indisponibilité prolongée est un incident ops, pas une dégradation silencieuse. [lib/safety/pipeline.ts, lib/safety/detecteur-detresse.ts]
- **Idempotence PAR TOUR de l'épisode (F8) — même racine que la dette 2.2, dépend du jeton client.** `enregistrer_tour_detresse` n'a pas de clé d'idempotence : la route génère un UUID **par requête HTTP** (pas par tour logique), donc un « Réessayer » rejoue le tour → double-incrémente `tours_surs_consecutifs` (risque d'extinction avant le seuil réel). Le correctif est le **jeton de tour stable côté client** déjà différé pour `usage_ia` (cf. plus haut, Reports Phase B 2.2) — le même jeton scopera l'épisode. Atténué par le correctif F3 (délai depuis le dernier pic). [supabase/migrations/0010+0011, app/api/anam/message/route.ts]
- **Une seule RPC par tour au lieu de deux (F12) — micro-opt, hors périmètre sûr.** Le pipeline appelle `episode_detresse_ouvert` (pour le forçage) puis `enregistrer_tour_detresse` : la seconde connaît déjà l'état pré-tour via son `FOR UPDATE`. On pourrait fusionner (retourner « était ouvert » + « limites après »), mais ça réordonne le pipeline de sécurité pour un gain négligeable (le LLM domine la latence). Non fait. [lib/safety/depot-episode.ts, lib/safety/pipeline.ts]
- **`createSupabaseAdminClient()` reconstruit à chaque appel (F13) — mémoïsation transverse.** Le client admin est sans état et réutilisable ; il est recréé à chaque RPC (épisode ×2, audit, métrage). Mémoïser un singleton au niveau module bénéficierait à TOUS les appelants — changement d'infra partagée, à faire séparément (pas propre à 2.4). [lib/data/supabase/admin.ts]
- **Harnais de test Supabase dupliqué (F15) — helper partagé à extraire.** `admin`/`clientScope()`/`createUser`+teardown sont recopiés à l'identique dans `episode-detresse`, `audit-detresse`, `usage-ia`, `barriere-minorite`, `consentement`. Extraire `tests/_stubs/supabase-scope.ts` — nettoyage transverse pré-existant, pas propre à 2.4. [tests/]

## Coutures de la Story 2.7 (arc de séance) — à brancher au bon moment

La MACHINE de l'arc (`lib/domain/`), la trace persistée (`seance`, migration `0012`), le beat « nommer » et le câblage serveur sont livrés et prouvés (CI factice + E2E multi-tours sur vrai Postgres). Restent :

- **Appel d'extraction *live* + voix qui pilote réellement l'arc — Story 2.8 (D3).** 2.7 câble la passe FORT d'extraction (`requeteExtractionArc` → `envoyerSousEgressArt9` → `extraireSignauxArc`) et la prouve en CI par le **factice** (déterministe, gratuit). Le **tir réel par tour** (métré, `capacite: "reconceptualisation"`) et la **voix** (≤ 3 phrases, hypothèse réfutable « je me trompe ? », anti-flatterie, FR-006/FR-008) qui exploite l'arc relèvent de 2.8 — même posture que la détection 2.3 (câblée + factice + données réelles gated DPA/ZDR). Contenu (prompts d'extraction, seuils FR-004, consigne de phase, formulation « sans heure ») **PROVISOIRE** → porte produit (et clinique/juriste pour le bord détresse). [lib/domain/signaux-arc.ts, lib/domain/consigne-phase.ts, app/api/anam/message/route.ts]
- **Levier de coût : piggyback vs appel séparé (différé, D3).** L'extraction est une **passe FORT séparée pré-génération** (sûre pour FR-005 : l'observation ne se génère pas tant qu'observer n'est pas close). Elle ajoute un appel modèle **par tour** + re-vérifie l'egress (consentement/minorité/ZDR) une 3ᵉ fois (après détection et génération). Optimisation possible (piggyback des signaux sur la génération quand la phase le permet) **différée** — le LLM domine la latence, la correction produit prime. L'extraction **est métrée** (clé `…:arc` distincte) : produit, seule la détresse est exemptée (FR-043). [app/api/anam/message/route.ts]
- **Distribution des ≥ 3 restitutions — voix (Story 2.8).** La machine mécanise le **compte** (≥ 3 avant clore, FR-003) ; la **répartition** (« réparties, jamais concentrées à la fin » — prd:67) est portée par la voix / la consigne de phase, PAS par la machine. Ne pas la revendiquer mécanisée. [lib/domain/arc-seance.ts, lib/domain/consigne-phase.ts]
- **Prénom → refonte onboarding ; disponibilité calculée « sans l'heure » → socle Epic 4 (AC1/D3).** 2.7 livre l'**invariant non-bloquant** (la machine n'a AUCUNE précondition de profil, FR-010) + la constante `MESSAGE_SANS_HEURE` **PROVISOIRE** en **couture INERTE** (le prénom n'est pas dans le schéma → capture à la refonte onboarding ; le calcul de « ce qui reste disponible sans l'heure » — soleil/planètes/numérologie vs ascendant/maisons/Lune, FR-049 — relève du socle Epic 4). Ne PAS la câbler à une donnée inexistante (patron `estLendemainDEpisode` 2.6). La fiche visuelle « tronc incomplet » relève de la région Arbre. [lib/domain/message-sans-heure.ts]
- **Cycle multi-séances — Story 2.9 / Epic 4.** La table `seance` porte UNE séance courante par utilisatrice (upsert sur `utilisatrice_id`) : suffisant pour la **première** séance (2.7). La clôture rendue (bilan bloc-document, beat Veille, paywall) est la **Story 2.9** (elle lit l'état « nommer satisfaite » / la phase `clore` posés ici) ; le cycle « clôturer → ouvrir une nouvelle séance » et la naissance de branche (geste explicite de l'utilisatrice, J+1, AD-8) relèvent d'Epic 4. Le beat « cloture » → Veille n'est PAS émis en 2.7. [supabase/migrations/0012_seance.sql, render/conversation/ApparitionAnam.tsx]
- **Durcissement des tours `assistant` forgeables (nommer prématuré *gameable*) — Epic 4.** L'extraction lit l'historique `messages` fourni par le client (`assistant` inclus — l'arc a BESOIN des reformulations d'Anam, contrairement au détecteur de détresse qui filtre `user`-only). Un client peut donc forger des tours (« reformulation confirmée ») pour forcer `peutNommer` → nommage prématuré. Défaut **PRODUIT**, PAS de sécurité : le gate `niveauSecurite < 1` reste **non-forgeable** (verdict serveur). Le durcissement (reconstruction serveur de l'historique) rejoint la mémoire de conversation (Epic 4), au même point que la note `detecteur-detresse.ts:121`. [lib/domain/signaux-arc.ts, app/api/anam/message/route.ts]
- **Jeton de tour stable (hérité 2.2/2.4) — l'arc compte des tours.** Un « Réessayer » rejoue la requête HTTP (UUID par requête, pas par tour logique) : comme l'arc **incrémente** compteurs/restitutions, un rejeu peut sur-compter. Le repli du dépôt penche vers **sous**-compter (jamais sur-avancer), mais l'idempotence propre exige le **jeton de tour stable côté client** déjà différé pour `usage_ia`/`episode_detresse` — le même jeton scopera la trace d'arc. [lib/data/depot-seance.ts, app/api/anam/message/route.ts]
- **Vérif RUNTIME de l'apparition Présence + focus (env node, porte pré-lancement).** Le beat « nommer » → `ApparitionAnam beat="nommer"` est prouvé par cœurs purs (trame) + gardes statiques (Conversation réagit à `onBeat`, ne vole pas le focus). Le rendu DOM réel (fondu 700 ms / instantané en `reduced-motion`, focus jamais volé au composeur) exige un **navigateur**. [render/conversation/Conversation.tsx, render/conversation/ApparitionAnam.tsx]

**Différés de la revue de code 2.7 (2026-07-29) — réels (LOW), non corrigés (avec raison) :**

- **Beat « nommer » perdu si la génération échoue au tour EXACT de transition (LOW).** Sur le tour observer→nommer, la trace persiste phase=nommer AVANT le stream ; le beat n'est émis que dans le corps du stream. Si `diffuserSousEgressArt9` lève (500) ou bloque (403) sur ce tour précis, le beat n'est jamais envoyé, et au tour suivant `avancerArc` renvoie beat=null (le beat ne naît que sur la transition). L'observation, elle, EST re-délivrée au tour suivant (la consigne de phase reste « nommer ») — seule l'apparition en Présence est perdue. Rare + quality (pas safety). Un correctif propre (ré-émettre le beat tant que l'apparition n'a pas été confirmée) exige un flag « beat montré » dans la trace — différé. [app/api/anam/message/route.ts, lib/domain/arc-seance.ts]
- **`ecrire` avale ses erreurs → double-apparition possible sur un rare échec d'écriture (LOW).** La route dérive les effets client (beat, consigne, tier) de l'`arc` EN MÉMOIRE, jamais de la persistance ; `ecrire` échoue en silence (AD-15 : ne jamais planter le tour). Sur un échec d'écriture au tour de transition, l'utilisatrice voit l'apparition + l'observation, mais la trace reste `observer` → le tour suivant peut REJOUER la transition (2ᵉ apparition). Fail-open assumé (l'arc est quality ; la sécurité, elle, n'écrit jamais en mémoire seule). Gater le beat sur le succès d'écriture (faire remonter un booléen de `ecrire`) complexifierait le repli — différé. [lib/data/depot-seance.ts, app/api/anam/message/route.ts]

## Portes pré-lancement de la Story 2.1 (frontière serveur IA)

- **DPA art. 28 + ZDR Mistral (plan Scale)** — **porte pré-lancement bloquant les vraies données art. 9** (pas le build). Le boot-guard de `lib/ai/adapters/mistral.ts` refuse de démarrer sans `MISTRAL_ZDR_CONFIRMED` + `MISTRAL_DPA_SIGNED` + `MISTRAL_PLAN=scale` ; ces flags = attestation humaine posée **après** signature. Les clés gratuites « Experiment » s'entraînent sur les données → dev/test sur **données synthétiques uniquement**. **À re-vérifier sur les pages légales Mistral** (portée ZDR, texte DPA, résidence UE) avant lancement. [lib/ai/adapters/mistral.ts]
- **`npm audit` : 5 → 9 vulnérabilités** après l'ajout du SDK Mistral (deps transitives, plusieurs hautes). Non bloquant pour le build ; à trier avant lancement (ne PAS lancer `npm audit fix --force` — casse). Porte pré-lancement héritée. [package.json]
- **✅ CSP des PAGES art. 9 (nonce) — LIVRÉE (Story 2.2, B1).** `proxy.ts` (ex-`middleware.ts`, Next 16) pose la CSP nonce des documents (`connect-src 'self'` effectif) via `cspPageArt9` (source unique dans `entetes-art9.ts`), nonce sur requête + réponse. **Porte levée.** Reste une **vérif navigateur** (ci-dessous). [proxy.ts, lib/ai/entetes-art9.ts]
- **✅ Streaming réel + politique de tier complète `(capacité, niveau_sécurité)` — LIVRÉS (Story 2.2, Phase A).** `diffuser()` + route NDJSON + `tierPour(capacite, niveauSecurite)` (AD-5). Reste le **producteur** de `niveauSecurite` (détection de détresse) → **Story 2.3**. [lib/ai/port.ts, lib/ai/politique-tier.ts]

## Reports Phase B de la Story 2.2 (revue de code Phase A, 2026-07-27)

Différés de la revue du socle streaming serveur — dépendent du **client de conversation** (Phase B), qui n'existe pas encore :

- **Idempotence d'un RETOUR CLIENT (toujours ouvert après Phase B)** — la clé `usage_ia` est un UUID serveur par requête HTTP → « exactement une fois PAR REQUÊTE ». La Phase B a AJOUTÉ un vrai « Réessayer » (`Conversation.reessayer`) → un retry **recompte** les tokens (double-comptage → quota/paywall NFR-014). **Fix** : le client fournit un **jeton de tour stable** (idempotency token), validé serveur (format UUID, scopé à l'utilisatrice — un spoof ne collisionne que SON propre métrage). Signalé dans le code de `reessayer`. [lib/ai/metrage.ts, app/api/anam/message/route.ts, render/conversation/Conversation.tsx]
- **✅ Contrat client de la trame `erreur` — TRAITÉ (Story 2.2, B4).** `useFluxAnam` traite `erreur` ET une coupure (flux clos sans `fin`) comme fin d'échec : texte partiel CONSERVÉ + « Réessayer » (registre système, jamais signé Anam), jamais retiré du fil. [render/conversation/useFluxAnam.ts]
- **Test COMPORTEMENTAL de la route (toujours ouvert)** — le corps du `ReadableStream` (avortement en vol, plancher de latence 400–900 ms, once-in-`after()`) n'a qu'une couverture statique + décision de métrage en test pur. Idem côté client : `useFluxAnam` (fetch/reader) est couvert par ses **cœurs purs** (`flux-ndjson-client`) mais pas par un test DOM d'exécution. Ajouter un harness (undici + env jsdom localisé) plutôt que basculer tout le runner. [app/api/anam/message/route.ts, render/conversation/useFluxAnam.ts, tests/]
- **Adaptateur Mistral : demander l'`usage` en streaming** — vérifier que `chat.stream` renvoie bien `usage` au dernier chunk (option type `include_usage` selon la version SDK) ; sinon le métrage tombe sur l'estimation `estimerTokens`. À valider quand la vraie clé Mistral (porte ZDR/DPA) sera branchée. [lib/ai/adapters/mistral.ts]

## Vérifs RUNTIME de la vue conversation (Story 2.2, Phase B — non couvrables en CI node)

Vitest est en env **node** (pas de DOM) : ces points sont prouvés par gardes statiques + cœurs purs, mais leur comportement RÉEL exige un navigateur / un appareil. **Portes pré-lancement, non bloquantes pour le build** (build `next build` OK, `ƒ Proxy (Middleware)` reconnu).

- **CSP nonce — pas d'écran blanc, pas de boucle de déconnexion** — vérifier sur le **dev server réel** (`npm run dev`, puis un navigateur) : (1) la page `/` s'hydrate (scripts RSC nonce-és — sinon écran blanc), (2) l'onboarding + la session tiennent après la migration `middleware.ts → proxy.ts` (cookies repropagés — sinon boucle de déco), (3) l'en-tête `Content-Security-Policy` du document porte bien `connect-src 'self'` + `nonce-…`. En **prod**, s'assurer que `'unsafe-eval'` est ABSENT. [proxy.ts]
- **Clavier virtuel mobile (AC8)** — sur un **vrai** téléphone (Android + iOS) : le composeur reste au-dessus du clavier (`visualViewport` + `--decalage-clavier`) et le dernier tour reste visible. Le repli `dvh`/`svh` si `visualViewport` absent. [render/conversation/Conversation.tsx, conversation.module.css]
- **Zoom 200 %/400 % (AC8)** — vérifier la redistribution sans perte ni chevauchement (aucun `maximumScale`/`userScalable` posé — le zoom reste possible). [app/layout.tsx]
- **Streaming visible** — avec le factice, les deltas arrivent en rafale (aucun espacement serveur) : le rendu « pop » après le plancher de 500 ms. Le vrai rythme de streaming viendra avec Mistral (débit réseau). Un cadencement client (rAF) reste optionnel si le ressenti l'exige.
- **`connect-src 'self'` vs futur client navigateur (revue 2.2)** — la CSP de page est posée sur TOUTES les pages non-/api (défense en profondeur, sûr aujourd'hui : l'auth est 100 % Server Actions, aucun `createSupabaseBrowserClient` monté). **Piège latent** : dès qu'un composant client parlera à `<ref>.supabase.co` (realtime, auth client), à un CDN d'images ou à de l'analytics, `connect-src`/`img-src 'self'` bloquera SILENCIEUSEMENT. À ce moment : élargir `cspPageArt9` (ajouter l'origine Supabase à `connect-src`) — **et jamais** pour la route/page art. 9 elle-même (le verrou `connect-src 'self'` y reste non négociable). [lib/ai/entetes-art9.ts]
- **Quitter la région conversation en plein flux (revue 2.2)** — les régions restent MONTÉES (juste `inert`/`aria-hidden`), l'abort n'est câblé qu'au démontage de page. Si l'utilisatrice navigue ailleurs pendant un flux : la requête finit en fond (métrage serveur réconcilié, aucun souci art. 9 — l'egress était déjà autorisé) mais l'annonce a11y de fin tombe dans un sous-arbre `aria-hidden` → non restituée. **Acceptable en 2.2** (elle est partie) ; le vrai traitement (pause/reprise ou abort au changement de région) est entrelacé avec l'arc de séance (2.7) et la persistance (Epic 4). [render/conversation/Conversation.tsx, render/scene-dom.tsx]

## Phase C — Assets peints du personnage (Story 2.2, production Gemini, hors code)

- **Produire Présence & Veille** — `ImageAnam` sert `public/scene/{presence,veille}/anam-{presence,veille}.{avif,webp,png}` (@2x) avec **repli gracieux** (halo plumeux CSS tant que l'asset manque → aucune image cassée, build OK). Prompts Gemini à fournir dans les Completion Notes de la story. Personnage **jamais** dans icône/notif/multitâche. [render/conversation/ImageAnam.tsx]

## Chantier « Entrée dans l'app » — retour produit Julian (2026-07-24)

Julian a testé le localhost : l'arrivée (magic link → âge → consentement) est trop abrupte, pas assez « app mobile ». **Cible CONFIRMÉE : web mobile-first (PWA), PAS d'app native App Store** (NFR-018). **Décision : finir d'abord les fondations (epic 1), puis reprendre ce chantier.** À traiter en fin de fondations :

- **Auth par fournisseur d'identité (Google, éventuellement Apple)** — déjà prévu par FR-073 (« lien e-mail OU fournisseur d'identité ») ; seul le magic link est posé (Story 1.3). Ajouter Google (OAuth Supabase, simple sur le web) ; « Sign in with Apple » web possible mais exige un compte développeur Apple payant. Magic link = dernier recours. Vérifier la discrétion (NFR-015 : trace d'autorisation dans le compte Google/Apple).
- **Accueil immersif AVANT le compte** — aujourd'hui la 1re chose vue est `/entrer` (formulaire de lien e-mail) ; rien ne présente Anam ni ne donne le ton avant de demander l'inscription. Ajouter un accueil, **sans aucune collecte** (voir garde-fous).
- **La vraie immersion = la première séance** — le « dialogue où on apprend ce que la personne vient chercher » (idée de Julian) est exactement UJ-1 (« elle arrive sur une conversation, pas un formulaire »). C'est le CŒUR, epic ultérieur.

**Garde-fous NON négociables :**
- L'ordre compte → âge → consentement art. 9 → séance est **figé par la loi** (FR-072) ; **aucune donnée sensible collectée/traitée avant le consentement** — c'est ce que verrouille la Story 1.6.
- Donc un « faire parler la personne avant le compte » (proposé par Julian) ne peut PAS recueillir/stocker/envoyer au LLM du sensible. Un accueil peut avoir la *forme* d'un dialogue (Anam donne le ton) mais ne recueille rien avant le consentement ; le vrai dialogue vient juste après (séance). Levier anti-friction principal = **compte 1-tap (Google) + consentement beau et rapide**, pas déplacer la collecte avant le consentement.

## Story 2.8 — voix & contrôle bloquant : coutures différées

La voix de base et le contrôle bloquant de lexique sont posés et prouvés en CI. Restent différés :

- **Appariement d'une citation au corpus d'Anima (FR-086)** — la règle « ne jamais fabriquer une parole d'Anima » est portée par la **consigne** (T3). L'**appariement runtime** (toute citation attribuée à Anima vérifiée contre un corpus stocké avant émission, recommandé par le reconcile) est **impossible aujourd'hui : aucun corpus Anima n'existe dans l'app**. À câbler quand le corpus est créé (Epic 4/socle). Ne pas revendiquer FR-086 comme mécanisé.
- **Verdict vs hypothèse (FR-006) — vérification sémantique** — non détectable par scan de source (« Tu as peur de l'abandon » ne contient aucun mot banni). Porté par la **consigne**. Une vérification comportementale (LLM-juge ou heuristique de forme : affirmation catégorique sur la personne sans marqueur d'hypothèse) est **différée**.
- **« Recule sans flatter » / « correction enregistrée comme matière » (FR-009)** — le comportement est porté par la consigne ; le signal `rejetProposition` existe déjà (arc 2.7). L'**écriture durable** de la correction en mémoire relève du **journal 3 couches (Epic 4)**.
- **Lexique médical EN ENTRÉE** — si l'utilisatrice emploie elle-même un mot clinique (« je crois que je fais une dépression »), Anam ne le reprend pas à son compte (charte §11.4). Comportement de **consigne** (le contrôle statique ne vise QUE les sorties/contenus d'app, jamais les entrées) ; à durcir/valider avec le protocole clinique.
- **Enforcement du déploiement (porte OPS)** — `tests/lexique-voix.test.ts` (+ jeu de cas détresse, RLS) **casse le build CI** (`.github/workflows/ci.yml` → `npm test`). Le lien **CI rouge → déploiement Vercel refusé** dépend d'une **protection de branche GitHub** (required status check) OU d'un « wait for CI » / « Ignored Build Step » Vercel — **ni l'un ni l'autre dans le dépôt**. À établir avant lancement (réglage externe GitHub/Vercel).
- **Migrations à déployer au CLOUD avant prod (porte OPS)** — les migrations sont appliquées en **local uniquement** ; le cloud (projet ref `zlhlzoalmszohrxrnsmo`) doit être synchronisé avant la mise en ligne, **dans l'ordre migration-AVANT-app** (sinon une table/fonction manquante → l'app tombe sur son repli sûr : côté détresse `limites_levees=true` protège ; côté faits/journal l'écriture lève un 500 plutôt que de perdre/corrompre). À vérifier notamment : `0016_entree_journal` (journal brut), `0017_episode_detresse_idempotence` (idempotence détresse), `0018_fait_extrait` (faits extraits — table + RLS + trigger anti-résurrection + fonction de merge), `0019_resume_glissant` (résumé glissant + lecture possédée `charger_faits_actifs` — table + RLS + write-gate durci), `0020_signal_reconceptualisation` (signal de reconceptualisation — table possédée-JWT pointeur-seul + RPC `enregistrer_signal_reconceptualisation` avec garde AD-17 au point d'écriture + trigger `maj_le`), `0021_branche` (Story 4.5 — table `branche` couche 3 + fonction `branche_nom_significatif` + FK composite cohérence-propriétaire + policies RLS avec AD-17/isolation/nom au WITH CHECK + transitions du signal + RPC `creer_branche_depuis_signal`/`ecarter_signal_reconceptualisation`/`charger_proposition_branche` + index unique `entree_journal(utilisatrice_id, id)`). Déploiement via l'API Management + token `sbp_` (le MCP Supabase est sur le MAUVAIS compte). [supabase/migrations/]
- **Surfaces futures (e-mails, fiches store, bilans, restitutions)** — n'existent pas encore ; le contrôle bloquant les **scannera automatiquement dès leur création** (découverte récursive `app/**` + `render/**`, jamais une liste en dur). Les e-mails Supabase (templates hors dépôt) restent à couvrir par un contrôle dédié quand ils seront rédigés.
- **Discipline emoji / `!` / majuscule en SORTIE LIVE** — portée par la consigne (non tronçable proprement en flux) ; retirée du scan STATIQUE (le code source regorge de `!==`, `!bloque`, sigles → faux positifs). La troncature à 3 phrases reste le seul mécanisme déterministe imposé par la spec.
- **Contenu PROVISOIRE** — la consigne de voix et la liste du lexique interdit sont l'intention produit, **à valider** (produit ; juriste/pro pour ce qui borde la détresse et la mention d'Anima) avant mise en ligne.

### Revue adversariale 2.8 — trouvailles LOW différées

La revue multi-agents (18 examinées, 13 retenues) a été appliquée pour l'essentiel (regex du lexique resserrées, troncature durcie, scan élargi, gardes dé-tautologisées). Restent différés, non bloquants :

- **Contrôle bloquant : surfaces CSS / SVG non scannées (F9)** — `fichiersTs` ne retient que `.ts/.tsx`. Un `content:"…"` de pseudo-élément CSS ou un `<text>` inline SVG portant du lexique interdit échapperait au scan. Aujourd'hui aucun `content:` ne porte de mot interdit (seuls des symboles `＋`/`－`). À traiter en extrayant le texte réellement rendu (valeurs `content:`, nœuds `<text>/<title>/<desc>`) quand une telle surface apparaîtra.
- **`sansCommentaires` aveugle aux chaînes (F13)** — le strip des commentaires opère sur la source brute : une chaîne utilisateur contenant `//` ou `/* */` verrait sa fin retirée avant le scan (angle mort d'évasion). Aucune occurrence aujourd'hui. Fix éventuel : ne retirer que les commentaires en tête de ligne, ou ajouter un contrôle positif ciblé.
- **Emoji : keycaps `1️⃣` hors périmètre (F8 résiduel)** — le motif attrape les pictogrammes à présentation emoji et les drapeaux, mais pas les keycaps (chiffre + VS16 + U+20E3). Faux négatif étroit ; à élargir si un keycap apparaît dans un contenu.
- **« soigné » (participe/adjectif) ↔ « soigne » (verbe) — collision assumée (F1 résiduel)** — après retrait des accents, « soigné » se normalise en « soigne » et coïncide avec le verbe banni : un libellé légitime « un travail soigné » serait attrapé. Aucun aujourd'hui ; ALLOWLIST prête dans `tests/lexique-voix.test.ts` si un tel libellé arrive.
- **« traiter » (verbe médical) volontairement non banni** — trop surchargé RGPD dans cette app (« Anam traite / le traitement de tes données », déjà présents dans le consentement). Le bannir créerait le faux positif même que le design évite. Distinction médical/RGPD non faisable lexicalement → à traiter par revue humaine / consigne si besoin.
- **Gate de troncature prouvé par cœur pur + garde de source, pas par un test route (F11 partiel)** — la mécanique de coupe sur flux est désormais un cœur pur testé comportementalement (`absorberDelta`) ; le GATE `niveauSecurite === 0` lui-même reste prouvé par garde de lecture de source (convention du repo : la route n'est pas invocable en test). Un test bout-en-bout de la route (avec adaptateur factice + verdict stubé) reste un durcissement possible, entrelacé avec l'invocabilité de la route (hors périmètre 2.8).

## Story 2.9 — Coutures de la clôture, du bilan et du placement gardé du paywall

- **La CARTE d'abonnement = Epic 3 (Stories 3.1/3.2)** — 2.9 pose la clôture + le bilan + le **point de montage gardé** (`app/_commerce/MontagePaywall.tsx`, enveloppé `<GardeCommerciale>`, VIDE). Le prix (69 €/an), les actions « M'abonner »/« Pas maintenant », la garantie de remboursement (FR-089), Stripe Checkout et les webhooks relèvent de l'Epic 3. `MontagePaywall` n'est **pas monté** en 2.9 : la 3.2 le remplit et le monte.
- **Positionnement exact du paywall « sous le tour bilan » dans le fil = Epic 3.2** — le bilan est un tour CLIENT (streamé) ; `<GardeCommerciale>` est un composant SERVEUR (lit `lib/safety`). L'interfoliage client/serveur sous un tour streamé est intrinsèquement couplé à la carte → différé avec elle. **Le verrou réel d'AC4/AC5 en 2.9 est le gate SERVEUR** (`route.ts` : `clotureAutorisee = niveauSecurite === 0 && !securite.limitesLevees` → aucun bilan en détresse → pas de paywall). `MontagePaywall` est la seconde couche (défense en profondeur).
- **Contenu du bilan PROVISOIRE** — la `consigneBilan` (registre document) est l'intention produit, **à valider** avant mise en ligne. La conformité SÉMANTIQUE du bilan généré (médical, affect, invention) est portée par la consigne au **runtime** — **non mécanisée** statiquement (le texte n'existe pas en source ; `consigne-bilan.ts` est exclu du scan comme les autres consignes). Un LLM-juge de bilan reste différé.
- **`structurerBilan` — parseur PROVISOIRE** (`lib/domain/bilan.ts`) — 1re ligne = titre, suivantes = points, puces/numéros retirés ; fail-safe (< 2 lignes → `null` → pas de bilan émis). **Fragile au formatage du modèle** : à durcir, ou remplacer par une **sortie structurée (JSON)** du modèle, quand la génération réelle du bilan sera validée produit.
- **Respiration double (timing) non chiffrée dans l'UX** — seul `spacing.respiration = 40px` existe ; `duree-respiration = 4200ms` concerne le SIGNE, pas le bilan. En 2.9 le bilan est émis **après le drain** de la phrase de clôture (temporisation serveur naturelle) et inséré en `fondu-texte` (neutralisé reduced-motion). La valeur ms exacte d'une pause dédiée reste à caler produit.
- **Cycle multi-séances (clôturer → ouvrir une nouvelle séance) + naissance de branche J+1 = Epic 4** — la table `seance` porte UNE séance courante par utilisatrice (upsert). 2.9 rend la clôture de la PREMIÈRE séance ; le latch `finProposee` empêche l'arc de rouvrir, mais le geste explicite « nouvelle séance » et la naissance de branche (AD-8) sont l'Epic 4.
- **Génération du bilan = 2ᵉ passe FORT** — au tour de clôture, la route fait un **second appel** egress (capacité `synthese` → tier fort) pour le bilan, en plus de la phrase de clôture. Coût assumé (métré à part, clé `:bilan`). Si le coût devient un enjeu, envisager de fusionner clôture + bilan en une passe à sortie structurée (hors périmètre 2.9).

### Revue adversariale 2.9 — trouvailles LOW différées

La revue multi-agents (7 dimensions × vérif adversariale, 16 survivantes) a rattrapé un **bug CRITIQUE** (la trame `bilan` non câblée côté client → faux échec à la clôture + BlocDocument en code mort) et 3 MOYENS (consigne `clore` non gatée en détresse ; clôture perdue si détresse pile au tour de transition), **tous corrigés** (voir Change Log v1.1). Restent différés, non bloquants :

- **POST concurrents du même tour de clôture → deux bilans (F11)** — `cleIdempotence` est un UUID aléatoire par requête et le read-modify-write de l'arc (`charger`→`ecrire`) n'est pas transactionnel : deux POST simultanés du même message de clôture généreraient deux bilans, deux trames, deux métrages `:bilan`. C'est la **dette d'idempotence de tour** déjà connue (jeton de tour stable, hérité 2.2/2.4) — à résorber globalement, pas propre à 2.9.
- **Métrage `:bilan` sans garde faux-zéro (F13)** — `usageBilan` lit `bilan.reponse.usage` en brut ; si un fournisseur omettait l'usage, le bilan fort serait métré à 0 (silencieusement exempté). **Cohérent avec le métrage de l'extraction d'arc** (`usageExtractionArc`, même lecture brute des passes non-streamées) ; à durcir des deux côtés ensemble si un fournisseur réel s'avère omettre l'usage.
- **2ᵉ passe bilan sans timeout (F14)** — `await envoyerSousEgressArt9` (bilan) est bloquant avant `emettre({t:"fin"})` : un STALL fournisseur (≠ throw, déjà attrapé) retarderait la finalisation du tour de clôture. Même risque que tout egress ; le timeout plateforme (Vercel) s'applique. À doter d'un timeout dédié si nécessaire.
- **`structurerBilan` : 1re ligne = titre inconditionnel (F15)** — un bilan rendu comme simple liste SANS titre verrait son 1er point promu en `<h2>`. La consigne demande « un titre court, quelques points » → le modèle DOIT produire un titre ; parseur **PROVISOIRE**, à remplacer par une sortie structurée (JSON) du modèle quand la génération sera validée.

## Coutures & portes de la Story 3.1 (ossature abonnement Stripe)

3.1 pose la plomberie backend (Checkout hébergée, webhook signé/idempotent, projection écrivain-unique `abonnement`, entitlement dérivé). Restent :

- **La CARTE d'abonnement + le montage in-fil = Story 3.2.** 3.1 fournit la CIBLE (`/api/stripe/checkout`) et la ligne de retour pure (`ligneRetourPaiement`), PAS la carte (prix affiché 69 €, « M'abonner »/« Pas maintenant », garantie FR-089), ni son placement sous le bilan, ni la lecture du param `?paiement=succes|annule`. `MontagePaywall` (couture 2.9) reste vide → 3.2 le remplit et enveloppe la carte de `<GardeCommerciale>`. [app/_commerce/MontagePaywall.tsx, lib/domain/retour-paiement.ts]
- **Les gardes par fonctionnalité = Stories 3.3/3.4.** `estPremiumCourante()` (`lib/data/lire-abonnement.ts`) est l'entitlement, **couture INERTE** : aucun consommateur en 3.1. Les gardes (branches premium 3.3, allocation 3.4) l'interrogeront côté serveur (source de vérité unique). [lib/data/lire-abonnement.ts]
- **Le remboursement = Story 3.5.** Le stub `declencherRemboursement` (`lib/safety/appliquer-barriere.ts:38`) reste vide ; 3.1 fournit l'idempotence + la projection rejouables que 3.5 réutilise. Les events `charge.refunded`/`invoice.payment_*` sont **NO-OP en 3.1** (l'état canonique = `subscription.status` via `customer.subscription.*`) → interprétés `null`, la route répond 200 sans projeter. [lib/stripe/evenement-abonnement.ts]
- **PORTE pré-lancement — compte Stripe réel + clés `sk_live`/`whsec_live` + endpoint webhook enregistré au dashboard** (ops). Dev/test = mode test (`sk_test_`/`whsec_`, `stripe listen --forward-to localhost:3000/api/stripe/webhook`).
- **PORTE — Stripe sous-traitant art. 28** (FR-067/NFR-019) : DPA Stripe à acter et documenter (comme Mistral).
- **PORTE — effacement propagé à Stripe sur fermeture de compte** (AD-14/FR-067/NFR-021) : la liste d'effacement art. 9 d'AD-14 n'inclut PAS `abonnement` ; `abonnement`/`evenements_traites` doivent entrer dans le périmètre d'effacement quand le moteur de rétention unique (ordonnanceur, Epic 6) existera. L'annulation d'abonnement + l'effacement des données client Stripe à la fermeture, à concilier avec la conservation comptable légale, sont à trancher. `evenements_traites` est un registre système sans `utilisatrice_id` (dédup par `event.id` global) → scoping d'effacement à définir. [supabase/migrations/0013_abonnement.sql]
- **PORTE — libellé de relevé bancaire (Z-1)** : valeur finale = entité juridique qui encaisse. En mode subscription, le libellé EFFECTIF s'applique au niveau **COMPTE** Stripe (`statement_descriptor_prefix`, ops) — 3.1 paramètre la valeur (`STRIPE_STATEMENT_DESCRIPTOR`) et l'attache à la session pour traçabilité. [lib/stripe/config.ts]
- **Contenu PROVISOIRE** — `ligneRetourPaiement` (registre produit) à valider avant mise en ligne.
- **Idempotence à l'aller (double-clic « M'abonner »)** — non couverte par les AC ; atténuée par `idempotencyKey` sortante sur la création de session. Stripe Checkout gère largement la double-session côté hébergé. [app/api/stripe/checkout/route.ts]
- **Dépendance `stripe@22.3.2`** épinglée exact, apiVersion `2026-06-24.dahlia`. `npm audit` : à re-trier avant lancement (l'ajout du SDK Stripe peut introduire des deps transitives — ne PAS lancer `npm audit fix --force`). Porte pré-lancement héritée.

### Résiduels de la revue adversariale 3.1 (réels, non corrigés — avec raison)

- **Ordre des events à la seconde près (#9/#12, MOYENNE)** — `source_maj_le` dérive de `event.created` (timestamp Unix en SECONDES). Deux events du même compte créés dans la MÊME seconde sont à égalité stricte (`>`) → l'anti-régression ne les départage pas, l'ordre d'ARRIVÉE tranche. Le verrou consultatif (`0014`) sérialise mais ne restaure pas l'ordre chronologique vrai à sous-seconde. Aucun champ d'ordre plus fin n'est universellement fourni par Stripe ; le cas (deux changements d'état conflictuels du même abonnement dans la même seconde, arrivés inversés) est extrêmement rare. À revisiter avec un job de réconciliation (Epic 6) qui relit l'état canonique depuis Stripe. [supabase/migrations/0014_abonnement_concurrence.sql]
- **Réutilisation du `customer` Stripe entre tentatives (#19, BASSE)** — la session Checkout ne passe que `customer_email`, jamais `customer:` (aucun `stripe_customer_id` n'est stocké AVANT le 1er webhook). Chaque tentative de souscription (abandon puis retry, réabonnement) peut donc créer un nouveau Customer Stripe pour le même email → doublons de Customers côté Stripe (pas de double-facturation : un seul abonnement aboutit). À durcir quand le `stripe_customer_id` connu sera relu et passé en `customer:` (couplé à la carte 3.2 / au portail de gestion 3.5). [app/api/stripe/checkout/route.ts]
- **Garde-frontière : import construit dynamiquement (#23, BASSE)** — `tests/frontiere-stripe.test.ts` grep le package quoté et les noms de secrets bruts (attrape import/require/`import()`/`process.env.X`). Un import assemblé dynamiquement (`"str"+"ipe"`) ou un accès env par chaîne concaténée échapperait. Limitation **partagée avec `frontiere-serveur.test.ts`** (même patron, accepté) ; évasion exotique, non observée. À traiter globalement si un besoin réel de chargement dynamique apparaît. [tests/frontiere-stripe.test.ts]

## Story 3.2 — La carte d'abonnement in-fil, le gate serveur, coutures différées

- **Le PIVOT résolu : carte CLIENT + trame serveur, pas `MontagePaywall`.** 2.9/3.1 imaginaient que la carte remplirait `MontagePaywall` (serveur, enveloppé `<GardeCommerciale>`). La réalité l'en empêche (le bilan sous lequel la carte s'insère est un tour CLIENT streamé ; un composant serveur ne s'y insère pas). 3.2 résout : carte CLIENT (`render/conversation/CarteAbonnement.tsx`) insérée comme tour `paywall` sous le bilan, déclenchée par une **trame serveur `paywall`** émise APRÈS le bilan, hors-détresse (elle suit le bilan) et si NON premium. **La garde AD-9 = le gate serveur** (trame retenue), pas la balise `<GardeCommerciale>` — même patron que la route Checkout (3.1), dérogé nommément dans `tests/garde-commerciale.test.ts`, prouvé par `tests/proposer-abonnement.test.ts`. `MontagePaywall` reste la couture gardée pour une future surface paywall **rendue serveur** (menu de compte). [app/_commerce/MontagePaywall.tsx, render/conversation/CarteAbonnement.tsx, app/api/anam/message/route.ts]
- **La conversation n'est montée sur AUCUNE page** — `app/page.tsx` rend `SceneDom`. 3.2 (comme 2.2–2.9) complète le paywall DANS la machinerie de conversation, prouvé par tests ; le montage de la conversation dans la scène (et la navigation scène→séance) est une intégration ultérieure. Le retour Stripe `?paiement=succes|annule` (`ligneRetourPaiement`, pur, 3.1) se branchera à la page de conversation quand elle sera montée. [app/page.tsx, render/conversation/Conversation.tsx, lib/domain/retour-paiement.ts]
- **Refus « Pas maintenant » — CLIENT en v1, persistance serveur différée (Epic 4).** Le fil est éphémère (aucune table de conversation, AD-8) et la trame `paywall` n'est émise qu'une fois (beat `cloture` idempotent) → FR-057 « une seule sollicitation » est structurellement tenu ; le refus retire la carte + arme un verrou de session (ceinture). Quand le fil PERSISTERA (Epic 4), le serveur devra retenir la trame après un refus enregistré (sinon la carte réapparaîtrait au rechargement du bilan persisté) — rien à persister aujourd'hui. [render/conversation/Conversation.tsx]
- **Surface « menu de compte » différée (AC5).** « L'abonnement reste atteignable depuis le menu de compte » : le menu de compte n'existe pas encore. `MontagePaywall` (serveur, gardé) est la couture prête pour cette surface. [app/_commerce/MontagePaywall.tsx]
- **La carte n'est PAS annoncée au lecteur d'écran (choix a11y).** L'annonce `aria-live` aria-atomic est unique et serait écrasée : le bilan (contenu important) garde l'annonce ; la carte, insérée juste dessous, reste navigable au clavier/lecteur d'écran mais ne vole ni le focus ni l'annonce. À revisiter si une annonce discrète distincte est jugée nécessaire (région live séparée). [render/conversation/Conversation.tsx, render/conversation/Fil.tsx]
- **Repli de la lecture premium = RETENIR la carte.** Une lecture d'entitlement en échec (`estPremiumCourante`) est traitée comme premium (`premium = true` → pas de carte) : le doute suspend le commerce. Choix PRODUIT (jamais de sécurité — le verrou AD-9 est déjà tenu par `doitProduireBilan`). Une indisponibilité durable de la lecture supprimerait la proposition ; à surveiller côté ops si le taux de propositions chute. [app/api/anam/message/route.ts]

### Résiduels de la revue adversariale 3.2 (réels, non corrigés — avec raison)

- **Concurrence du writer de séance (arc) — PRÉEXISTANT 2.7/2.9, surfacé par 3.2 (HAUTE mais hors périmètre).** Le cycle `charger()→avancerArc()→ecrire()` de la trace `seance` (upsert sur `utilisatrice_id`, migration `0012`) n'a NI verrou NI version optimiste. Deux requêtes concurrentes de la MÊME utilisatrice (2 onglets/appareils, ou un double-envoi) peuvent chacune transiter nommer→clore et émettre CHACUNE un bilan — et depuis 3.2, une carte. Ce n'est pas introduit par 3.2 (le double-bilan était déjà possible en 2.9) : 3.2 y ajoute seulement la carte, à la même racine. La correction propre = un writer de séance à ÉCRIVAIN UNIQUE (verrou consultatif `pg_advisory_xact_lock` + WHERE atomique, comme `abonnement` en 3.1), ce qui touche la Story 2.7 → différé en story dédiée. Atténuation actuelle : le composeur client bloque pendant `enCours` (un seul client ne peut pas doubler facilement) ; le fil est éphémère. [supabase/migrations/0012_seance.sql, lib/data/depot-seance.ts, app/api/anam/message/route.ts]
- **Arc persisté en `clore` AVANT la génération — PRÉEXISTANT 2.9.** `depotSeance.ecrire(arc.etat)` fixe la phase `clore` avant la boucle de génération. Si la génération (ou la passe bilan) échoue ensuite, le tour affiche « Réessayer » ; le rejeu ne RE-ÉMET pas de bilan (la machine est déjà EN clore, beat non ré-émis) → le rejeu réussit sans bilan/carte. Comportement 2.9 hérité (le bilan est best-effort, la clôture reste valide). Côté client, 3.2 ferme le trou d'ORPHELIN (le « Réessayer » purge désormais bilan+carte via `ancreId`, comme les ressources 2.6) → pas de DOUBLE carte. La ré-émission du bilan au rejeu reste différée avec le durcissement du writer de séance ci-dessus. [app/api/anam/message/route.ts, render/conversation/Conversation.tsx]
- **CSRF du POST natif « M'abonner » vers `/api/stripe/checkout` (BASSE) — atténué, non corrigé.** La carte expose un `<form method="post">` natif vers la route Checkout (auth par cookie, sans jeton CSRF ni contrôle Origin). Atténuation RÉELLE : les cookies de session Supabase sont `SameSite=Lax` par défaut → un POST cross-site (navigation de haut niveau) N'EMPORTE PAS le cookie → `getUser()` renvoie null → 401 avant tout effet. Et l'effet maximal serait la création d'une session Checkout (aucun débit sans que l'utilisatrice complète sur Stripe). Un contrôle `Origin`/`Referer` explicite sur la route (défense en profondeur, touche la 3.1) est différé — l'atténuation `SameSite=Lax` suffit à ce niveau de risque. [render/conversation/CarteAbonnement.tsx, app/api/stripe/checkout/route.ts, lib/data/supabase/server.ts]

## Story 3.4 — Allocation résiduelle, métrage exactly-once, coutures différées

- **✅ Jeton de tour stable — RÉSOLU (dette 2.2/2.4/2.7/2.9).** Le client fournit un UUID stable par tour LOGIQUE (`jetonTour`), réutilisé au « Réessayer » ; le serveur le valide (`jetonTourValide`, repli UUID serveur) et l'emploie comme `cleIdempotence` (scopée à l'utilisatrice par l'index unique `usage_ia`). Le MÉTRAGE et l'ALLOCATION sont donc exactement-une-fois par tour logique (un retry ne recompte pas). **NB — l'ARC reste NON idempotent au retry** : `avancerArc` sur un rejeu re-avance les compteurs (double-envoi 2 onglets, cf. « Concurrence du writer de séance » ci-dessus, HAUTE, différée en story dédiée). Le jeton fixe le métrage/l'allocation, pas la trace d'arc. [lib/ai/jeton-tour.ts, lib/ai/metrage.ts, app/api/anam/message/route.ts]
- **`ALLOCATION_RESIDUELLE_TOURS` = porte OPS (pré-lancement).** Non posé en dev/test → **aucune coupure** (le mécanisme est inerte, prouvé par tests avec l'env posé). À poser en config de prod (valeur produit validée) pour activer l'allocation. `limiteAllocationResiduelle()` lit l'env à l'exécution (jamais codé en dur, FR-079/SPINE L.151). La copie de la ligne système (`ligne-quota.ts`) est PROVISOIRE (porte produit). [lib/ai/allocation-config.ts, render/conversation/ligne-quota.ts]
- **Fenêtre mensuelle en UTC — fuseau exact (Europe/Paris) différé.** Le comptage filtre `cree_le >= date_trunc('month', now())` en **UTC** (`Date.UTC(...,1)`). « pour ce mois-ci » à la frontière de mois pour une utilisatrice française présenterait une dérive de quelques heures. Raffinement produit mineur (un fuseau configurable, ou un `date_trunc` côté DB avec TZ) — à caler si le bord de mois devient sensible. [lib/data/lire-allocation.ts]
- **Arc encore extrait/métré APRÈS la clôture (micro-coût).** Post-séance, l'extraction FORT tourne encore (arc en `clore`, monotone — elle n'avance plus rien mais coûte un appel). Ré-optimisable (court-circuit de l'extraction quand `seanceClose`, ou piggyback) — hors périmètre 3.4, le gate de quota prime sur le micro-coût. [app/api/anam/message/route.ts]
- **Refus/épuisement CLIENT en session — persistance serveur = Epic 4.** `quotaEpuise` est un état de session (le fil est éphémère, AD-8) : un rechargement réel réévalue le comptage mensuel côté serveur au tour suivant. Aucune persistance à faire aujourd'hui. [render/conversation/Conversation.tsx]
- **Interaction quota × paywall (3.2) — mutuellement exclusifs par construction.** Le paywall (`{t:"paywall"}`) s'émet sous le bilan (tour de clôture, `seanceClose=false`) ; le quota (`{t:"quota"}`) coupe AVANT génération sur un tour post-séance (`seanceClose=true`). Un tour n'est jamais les deux à la fois. Le premier tour post-bilan n'est pas coupé si l'allocation ≥ 1. [app/api/anam/message/route.ts]

### Revue adversariale 3.4 — 6 corrigés (mutation-vérifiés), 4 différés (réels, avec raison)

La revue multi-agents (6 angles Sonnet × vérif adversariale Opus ; 15 examinées, 2 réfutées, 13 retenues → 10 bugs distincts) a rattrapé **2 vrais bugs que le TDD avait ratés** (gate qui compte sa propre ligne au retry ; downgrade premium qui pollue le comptage). **Corrigés et mutation-vérifiés (v1.1) :** gate idempotent au retry (exclusion de la propre `cle_idempotence`, F4/F5) ; `post_premiere_seance` marqué SEULEMENT pour un vrai tour d'allocation — jamais premium/détresse (F10) ; annonce a11y unique (F7) ; focus redirigé vers le motif quand le champ se désactive (F8, WCAG 2.4.3) ; « Réessayer » résiduel masqué + garde (F9) ; garde de test présence→imbrication (F12). **Différés (tous DORMANTS tant que `ALLOCATION_RESIDUELLE_TOURS` n'est pas posé — porte ops) :**

- **`seanceClose` dérive de `finProposee` (latché à la TRANSITION), pas de la LIVRAISON du bilan (F1/F3, HAUTE — différé, porte ops).** Si la génération du bilan échoue au tour de transition nommer→clore APRÈS que l'arc a persisté `finProposee=true` (route l.231, avant le stream), un « Réessayer » (même jeton) relit `seanceClose=true` → le gate s'active sur le tour censé livrer le bilan gratuit : avec `ALLOCATION_RESIDUELLE_TOURS=0`, la retentative est COUPÉE (jamais de bilan) ; avec limite > 0, ce tour est mal décompté (une unité). Nuance : l'arc étant déjà terminal en `clore`, la retentative ne re-livrait de toute façon PAS le bilan (dette d'idempotence d'arc CONNUE, hors périmètre) ; 3.4 y ajoute un mur de quota trompeur. **Correctif recommandé** = un marqueur persisté `bilan_livre` (distinct de `finProposee`), posé APRÈS l'émission effective de la trame `bilan`, et `seanceClose = bilanLivre`. **Différé car** : (1) DORMANT (le sharp-harm exige `limite=0`, qui contredit l'intention même de FR-079 « que la relation ne s'arrête pas net ») ; (2) le fix propre touche le **port `DepotSeance` (2.7)** — changer la signature de `charger()` casse `seance-trace`/`depot-seance-data`, ou impose une 2ᵉ lecture DB/tour → décision de conception cross-story à acter. Direction du doute déjà sûre pour le reste (fail-open FR-058). [app/api/anam/message/route.ts:149, lib/data/depot-seance.ts, supabase/migrations/0012]
- **Le jeton client n'est lié à aucun contenu → un jeton ÉPINGLÉ sur des messages différents fige le décompte (F2/F6, HAUTE→MOYENNE — différé).** Un client hors-UI qui réutilise volontairement un même `jetonTour` sur des tours logiques DIFFÉRENTS obtient une conversation post-séance illimitée : `metrerUsageIa` (upsert `ignoreDuplicates`) devient un no-op → une seule ligne `post_premiere_seance` → `compterToursResiduelsDuMois` figé → `doitCouperConversation` ne coupe jamais. **N'affecte JAMAIS l'UI** (`Conversation.surEnvoi` régénère un jeton par tour ; le jeton n'est réutilisé QUE pour un vrai retry). Abus économique, préconditionné à du scripting direct. **Correctif recommandé** = lier la `cle_idempotence` à un condensé du contenu (`jeton:sha256(messages)`), OU un compteur de tours serveur-autoritaire, OU un rate-limit. **Différé car** : (1) DORMANT (env non posé → aucun gate) ; (2) un condensé de contenu dans `usage_ia` touche la **posture art. 9** (table déclarée « aucun contenu ») → décision produit/conformité ; (3) le vrai garde-fou de l'abus économique est un **rate-limit**, absent GLOBALEMENT de la route (dette transverse, pas propre à 3.4). À trancher avec Julian avant lancement. [app/api/anam/message/route.ts:81, lib/ai/jeton-tour.ts, lib/ai/metrage.ts]
- **Un « Réessayer » après échec PARTIEL fige la télémétrie provisoire du 1er essai (F11, BASSE — différé).** Si le 1er essai produit un flux partiel puis casse, `resoudreMetrage` métré un repli approximatif ; au retry réussi (même jeton), l'`upsert ignoreDuplicates` est un no-op → la ligne garde les tokens approximatifs, jamais les réels. **N'affecte QUE la télémétrie de coût (NFR-014)** — l'allocation compte des LIGNES, pas des tokens, donc intacte. Correctif (optionnel) = colonne `metrage_provisoire` + UPDATE autoritaire-sur-provisoire. Différé (BASSE, télémétrie seule). [lib/ai/metrage.ts]
- **`sansCommentaires` dupliqué (F13, BASSE — dette de test transverse).** 4 nouvelles copies verbatim du helper (23 fichiers au total le définissent). À extraire dans `tests/_helpers/sans-commentaires.ts` — nettoyage transverse pré-existant (pas propre à 3.4), à faire globalement. [tests/]

## Story 4.1 — Journal brut, coutures différées

### Revue adversariale 4.1 — 7 corrigés (F1/F2 mutation-vérifiés), 2 différés (réels, avec raison)

La revue 5 angles (finders Sonnet × vérif Opus, biais réfutation ; 17 examinées, 8 réfutées, 9 retenues) a rattrapé **2 vrais trous de conformité que le TDD avait ratés** : write-gate omettant la barrière minorité, et policy INSERT ne contraignant pas `role`. **Corrigés et mutation-vérifiés (v1.1) :** F1 (`and not est_barre_minorite()` — le 0016 copiait la version 0005, pas le gabarit durci 0006 ; test de barrière rouge sans la clause) ; F2 (`and role = 'utilisatrice'` — sinon une utilisatrice forge des tours `anam` immuables sous son JWT ; test de forge rouge sans la clause). Plus F3 (garde `role==="user"` ancrée), F5 (observabilité du repli jeton), F6 (test AC4/AD-16 détresse), F7 (`revoke execute` convention 0007), F9 (frontière art. 9 réalignée). **Différés :**

- **✅ La RPC `enregistrer_tour_detresse` n'était pas idempotente au retry — RÉSOLU (Story 2-4b).** Un « Réessayer » (même jeton) rejouait le pipeline → `enregistrer_tour_detresse` réincrémentait `tours_surs_consecutifs` sans clé d'idempotence → extinction possible un tour trop tôt → `limites_levees` retombait avant l'heure (AD-16/AD-17). **Corrigé** par la migration `0017` : idempotence **asymétrique** par `p_cle_tour` (colonne `dernier_tour_compte`) — court-circuit du seul chemin « tour sûr » (niveau 0), l'escalade (niveau ≥ 1) n'étant JAMAIS supprimée (AD-15). Câblé via `creerDepotEpisode(user.id, cleIdempotence)` (jeton baqué), garde de source mutation-vérifiée. **Résidus acceptés** (voir `2-4b-…`) : keying mono-colonne (doublon hors-ordre d'un tour non-courant, borné/auto-cicatrisant, non cascadant) ; chemin dégradé sans jeton client = résidu systémique partagé (métrage/journal/épisode), mesurable via `console.warn`. [supabase/migrations/0017, lib/safety/depot-episode.ts, app/api/anam/message/route.ts]
- **`messages[length-1]` suppose « dernier = user » (BASSE, différé).** Le hook journal grave le dernier message si `role==="user"` ; l'étage arc/sécurité, eux, utilisent un `reverse-find` défensif (le client PEUT forger des tours `assistant`). Un tableau finissant par `assistant` avec un vrai tour user en amont ne serait pas gravé — mais **aucune perte réelle** (ce tour user antérieur a déjà été gravé sous SON jeton) et **déclencheur hypothétique** (aucun client de conversation n'existe encore — Epic 4/6). **À revisiter** quand le client existera : soit rejeter tôt (400) un dernier ≠ user, soit aligner sur le `reverse-find`. [app/api/anam/message/route.ts:127]

## Story 4.3 — Rappel opportun (côté lecture), coutures différées

Cadrage PO « l'assembleur d'abord » : 4.3 livre le côté LECTURE possédé (réceptacle `resume_glissant`, lecture possédée `charger_faits_actifs`, assembleur pur `assemblerRappel`, dépôt `depot-rappel`), prouvé bout-en-bout. Ces coutures sont **livrées mais INERTES** (aucun appelant de production) — délibéré, car il n'y a pas de matière à rappeler avant que 4.4 n'écrive des faits :

- **Le RÉDACTEUR du résumé glissant = 4.4/4.9.** `enregistrerResume(contenu)` persiste mécaniquement, mais le CONTENU (résumer une conversation) est une tâche LLM différée. Aucun générateur en prod (AD-4 interdit le stub-en-prod — un stub résumerait du vide). Le vrai rédacteur = le « cerveau » (4.4) ou la synthèse périodique (4.9, sous l'ordonnanceur 4.8). [lib/data/depot-rappel.ts, lib/domain/rappel.ts]
- **Le CÂBLAGE du rappel dans le prompt live d'Anam — TOUJOURS différé après 4.4.** `creerDepotRappel(...).assembler()` est appelable mais aucun pipeline ne l'injecte encore dans le prompt. **4.4 a câblé la RECONCEPTUALISATION (→ branche), PAS l'injection du rappel** (ce sont deux cerveaux distincts, cf. section 4.4). Le rappel reste inerte tant que `fait_extrait` n'a aucun writer de production (aucune matière à rappeler). Quand ce sera câblé, ce sera DANS le pipeline sécurité-d'abord (sécurité AVANT rappel, AD-16), et le résumé/faits sortants passeront sous egress-guard art. 9 (`no-store`/ZDR, AD-4) — jamais dans un cache tiers non-ZDR. [app/api/anam/message/route.ts, lib/ai/egress-guard.ts]
- **Le classement de PERTINENCE par embeddings — différé.** `assemblerRappel` fait une base déterministe (faits actifs, tri daté décroissant, plafond `limite`). Le scoring sémantique fin (quels faits sont « pertinents » pour le tour courant) est une optimisation ultérieure ; la couture est là (`limite`, tri). L'ensemble actif est petit au début du produit. [lib/domain/rappel.ts]
- **Résumé par FIL (multi-séance) — différé.** `resume_glissant` est keyé `unique (utilisatrice_id)` (un résumé courant par utilisatrice, aligné sur `seance` 2.7). Le cycle multi-séances (résumé par fil) le fera évoluer (pas de FK vers `seance`, qui est deny-by-default). [supabase/migrations/0019_resume_glissant.sql]
- **✅ `maj_le` du résumé — RÉSOLU (revue 4.3, D).** Bumpé côté app à l'origine ; corrigé en trigger base `resume_glissant_touch_maj` (`maj_le = now()` insert+update), `new Date()` applicatif retiré. Base autoritaire, `maj_le >= cree_le` garanti. [supabase/migrations/0019_resume_glissant.sql]
- **Dette transverse : périmètre des gardes de source (revue 4.3, C — signalée, non entièrement résorbée).** Les gardes 4.3/4.4 (`faits-architecture`, `rappel-architecture`, `reconceptualisation-architecture`) scannent désormais `app/lib/render/scripts` + racine (`proxy.ts`/`instrumentation.ts`) en `.ts/.tsx/.mjs/.js/.jsx`. Mais les **~5 autres gardes de source** (`arc-architecture`, `pipeline-securite-architecture`, `frontiere-serveur`, `frontiere-stripe`, `lexique-voix`…) gardent l'ancien scan étroit (`app/lib/render` en `.ts/.tsx` seulement) → un futur `scripts/*.mjs` ou un ajout dans `proxy.ts` contournant leurs invariants passerait la CI. À harmoniser globalement (extraire un helper `fichiersSource` partagé, cf. aussi la dette `sansCommentaires` dupliqué). [tests/*-architecture.test.ts, tests/frontiere-*.test.ts]

## Story 4.4 — Détection de reconceptualisation (câblée live), coutures & portes différées

Cadrage PO « câbler le cerveau live » : 4.4 livre le premier cerveau CÂBLÉ (détecteur fort de reconceptualisation → signal en attente, rattaché à l'entrée exacte), gardé par AD-17 (double-défense pipeline + point d'écriture) et métré `:reconcept`. Le SQUELETTE est prouvé/incorruptible ; le JUGEMENT et l'aval restent des portes :

- **`INSTRUCTION_RECONCEPTUALISATION` PROVISOIRE — porte pré-lancement produit/clinique.** Le prompt de détection (sortie structurée `RECONCEPTUALISATION: oui|non`) est un PLACEHOLDER (comme `INSTRUCTION_EXTRACTION_ARC` et le prompt de détresse). On code la MACHINE (ordre, AD-17, isolation, idempotence, art. 9) ; la finesse de détection (quels marqueurs sont de vrais moments de reconceptualisation) est à valider sur données réelles avant mise en ligne. La détection tourne en CI par le **factice** (déterministe, gratuit). [lib/domain/reconceptualisation.ts]
- **Le CONSOMMATEUR du signal = Story 4.5.** Les signaux `en_attente` s'accumulent dans `signal_reconceptualisation` mais RIEN ne les consomme encore — 4.5 (Anam propose une branche le lendemain, validée et nommée) lira les signaux et posera leurs transitions (`consomme`/`ecarte`). Producteur-avant-consommateur assumé (choix PO « câbler live ») : coût fort par tour dès maintenant, bénéfice visible à la 4.5. La table n'a **pas encore de policy `update` sous JWT** (les transitions = 4.5). [supabase/migrations/0020_signal_reconceptualisation.sql]
- **⚠️ `fait_extrait` n'a TOUJOURS aucun writer de production (réconciliation de périmètre).** Le commentaire d'en-tête de `0018` disait « l'intelligence d'extraction différée (Story 4.4) », mais 4.4 (per epics) produit un signal de reconceptualisation → branche (couche 3), PAS un `fait_extrait` (couche 2) — deux cerveaux distincts. **Le writer de FAITS (extraction → couche 2) reste sans story assignée** : à cadrer (probablement un « cerveau d'extraction de faits » dédié, ou un volet de 4.9 synthèse). Tant qu'il n'existe pas, `fait_extrait`/`resume_glissant`/le rappel (4.2/4.3) restent inertes en prod. [supabase/migrations/0018_fait_extrait.sql]
- **Double appel FORT au « Réessayer » (coût mineur, non-idempotent).** Le métrage `:reconcept` est idempotent (clé unique `usage_ia`) et le signal est idempotent (clé unique par entrée), mais l'APPEL fort de détection RE-TOURNE au retry (comme l'extraction d'arc). Coût $ dupliqué sur un retry (rare). Atténuation possible ultérieure : sauter la détection si un signal existe déjà pour l'entrée (lecture supplémentaire). [app/api/anam/message/route.ts, lib/safety/reconceptualisation-pipeline.ts]
- **Cadrage des messages de la requête de détection — à affiner avec le prompt.** `requeteReconceptualisation` passe les messages du tour tels quels (comme l'arc). Le forge (un client injectant de faux tours pour déclencher un signal) est à FAIBLE enjeu (4.5 exige validation+nommage, rien de décrété), mais l'historique reconstruit-serveur (durcissement, cf. dette arc 2.7) couvrirait aussi ce détecteur. [lib/domain/reconceptualisation.ts]
- **Placement `after()` + client JWT réutilisé — à re-vérifier en runtime.** L'étage tourne en `after()` (post-réponse, zéro latence) en RÉUTILISANT le client `supabase` déjà authentifié (jeton en mémoire) plutôt qu'en relire les cookies. Prouvé par tests unitaires (orchestrateur + dépôt) ; le comportement RÉEL de `after()` sous charge Vercel (le fort finit-il bien avant le gel de l'instance ?) est une **porte pré-lancement** à observer côté ops (comme le métrage `after()` existant). Repli documenté si besoin : appel INLINE concurrent de l'arc. `maxDuration=60` posé (revue 4.4, R5) — à ajuster au tier Vercel réel. [app/api/anam/message/route.ts]

### Revue adversariale 4.4 — findings différés (R2/R4/R8) ; R1/R3/R5/R6/R7 corrigés

- **⚠️ R2 (HAUTE, CONFIRMÉ, HÉRITÉ 2.4 — cross-cutting AD-17, à trancher).** La « double-défense » AD-17 lit la MÊME source unique `branche_bloquee_par_detresse()` → la MÊME ligne `episode_detresse`. Or l'OUVERTURE d'un épisode (niveau ≥ 1) passe par `enregistrer_tour_detresse` appelée via `rpcAvecRepli` (`depot-episode.ts`), qui **avale toute erreur RPC/réseau** et renvoie le défaut sûr `{limitesLevees:true}` en mémoire **sans écrire la ligne ni retenter**. Le tour N reste protégé (verdict dérivé du niveau brut), mais AUCUNE trace en base → au tour N+1 (niveau 0 porteur d'un marqueur), les deux gardes relisent une table vide → un signal `en_attente` naît alors que l'utilisatrice était en détresse un tour plus tôt. **Ce n'est PAS introduit par 4.4** : le même silent-loss affaiblit déjà le paywall/forcing (2.4) ; 4.4 en aggrave la conséquence (donnée persistante vs limite transitoire). **Le fix propre est en 2.4** (l'ouverture d'un épisode de détresse ne doit pas partager le sort « best-effort » du métrage : échec bruyant, ou retry durable) — un vrai arbitrage durabilité-vs-disponibilité de la Story 2.4, à ne PAS bâcler dans 4.4. **DÉCISION PO (2026-07-30) : 4.4 shippée ; R2 → STORY DÉDIÉE « durabilité de l'ouverture d'épisode de détresse (2.4) », HAUTE priorité, à planifier tôt.** [lib/safety/rpc-repli.ts, lib/safety/depot-episode.ts, supabase/migrations/0010]
- **R4 (MOY, CONFIRMÉ, HÉRITÉ — repli sans jeton).** Quand `jetonTour` est absent/mal formé, `cleIdempotence = crypto.randomUUID()` change à chaque tentative → une NOUVELLE entrée de journal (`0016` unique par `cle_tour`) → un `entree_journal_id` distinct → l'index unique `(utilisatrice_id, entree_journal_id)` ne déduplique PAS → N retries = N signaux `en_attente` (risque de branches 4.5 dupliquées). **Résidu pré-existant** (le chemin sans-jeton dupliquait déjà journal/épisode, cf. commentaire route.ts:87-93) que 4.4 étend à une nouvelle surface. Fix à la SOURCE (dériver une clé stable côté client, ou refuser le tour sans jeton valide) → hors périmètre 4.4, à traiter avec la robustesse client / refonte onboarding. [app/api/anam/message/route.ts:95]
- **R8 (BASSE, PLAUSIBLE, latent — robustesse de test).** `sansCommentaires()` (gardes d'archi) est un strip textuel naïf : un `//` non-protocole en milieu de ligne tronque la queue avant le grep. Aucun fichier de l'arbre ne le déclenche aujourd'hui, et l'isolation réelle est portée par la RLS (pas ce test statique). À durcir avec la dette transverse `sansCommentaires`/`fichiersSource` déjà tracée (section 4.3). [tests/*-architecture.test.ts]
- **✅ R1+R3 (HAUTE, CONFIRMÉ EN LIVE) — CORRIGÉ.** La RPC `security invoker` n'était PAS « le seul chemin d'écriture » : `authenticated` a le grant INSERT table-level → un `.from(...).insert()` direct sautait la RPC et ses gardes (AD-17 + isolation), ne voyant qu'une policy qui ne les vérifiait pas (reproduit en live : signal né en détresse + signal pointant le journal d'autrui). **Fix** : les deux gardes portées dans la policy `WITH CHECK` (`not branche_bloquee_par_detresse()` + `exists(entree_journal appartenant à l'appelante)`) → s'appliquent à TOUT insert, et le WITH CHECK rend l'AD-17 ATOMIQUE avec l'insert (tue le TOCTOU R3). Mutation-vérifié (les 2 clauses load-bearing). Garde d'archi R6 ajoutée (bannit `.from("signal_reconceptualisation")`). [supabase/migrations/0020_signal_reconceptualisation.sql:47-58]

## Story 4.5 — La naissance d'une branche (Anam propose, l'utilisatrice valide et nomme)

- **Notification push « le lendemain » — DIFFÉRÉE.** La 4.5 livre la proposition **in-app** à l'ouverture (page load). La notification discrète qui **fait revenir** l'utilisatrice (rare, plafond 1/72 h, jamais le soir — EXPERIENCE.md) dépend de l'**ordonnanceur unique (Story 4.8)** + d'une infra de notification (probablement Epic 5/6). Tant qu'elle n'existe pas, la proposition n'apparaît que si l'utilisatrice rouvre l'app d'elle-même. [app/page.tsx, lib/safety/ouverture-branche.ts]
- **Projection visuelle de l'arbre = Story 4.6.** 4.5 écrit la branche (`etat='naissance'`) mais `lib/scene/projection.ts` reste un stub gelé (`branches: []`). La fiche de branche, le lien « Voir dans la conversation », le renommage, la vue liste = 4.6. Le cycle de vie monotone (feuillaison/fruit, `intensite`, CHECK/trigger) = 4.7. [lib/scene/projection.ts]
- **Citation verbatim de la proposition — DIFFÉRÉE.** La proposition v1 est **générique** (« Il s'est passé quelque chose hier. Tu veux en faire une branche ? »). La version ancrée (« quand tu as écrit que… ») exigerait de remonter un extrait art. 9 au client + un snippeting fiable — écarté en v1 (minimisation art. 9, revue #6/#11). [lib/domain/branche.ts]
- **⚠️ Effacement FR-067 (Epic 6) — CONTRAINTE D'ORDRE.** La FK `branche → entree_journal` est `on delete restrict` (lien incassable, AC6). Le moteur d'effacement exhaustif DOIT donc supprimer `branche` **AVANT** son `entree_journal` source (l'ordre importe). À câbler dans le moteur de rétention Epic 6. [supabase/migrations/0021_branche.sql]
- **Décisions produit à confirmer (revue) :** wording de la confirmation post-naissance (« Ta branche existe. ») ; wording du message d'échec (« Je n'ai pas pu créer cette branche. Tu peux réessayer. »). Défauts sobres, sans célébration — à valider par le PO.

### Revue adversariale 4.5 — findings différés (0 critique, non bloquants)

- **#9 (PLAUSIBLE) — AC1 « jamais sur l'instant » non gardé au point d'écriture.** Le gabarit « le lendemain » (jour civil Paris) ne vit qu'à la LECTURE (`charger_proposition_branche`) ; un `.from("branche").insert()` direct peut créer une branche pour un signal same-day. **Décision PO : NON gardé au write-point par design** — AC1 porte sur le *timing de la proposition* (l'epic), pas sur l'écriture ; un insert direct est l'utilisatrice écrivant sa propre donnée, pas une trahison. Si l'on veut la parité DUR un jour : filtre d'antériorité civile Paris dans `creer_branche_depuis_signal`. [supabase/migrations/0021_branche.sql]
- **#13 (FAIBLE) — « Non » optimiste avale l'échec réseau.** Si le POST `refus` échoue, le germe reste `en_attente` → re-proposé une autre session. **Décision : trade-off assumé** (la charte §6.3 veut « Ok. » immédiat ; une re-proposition après un échec réseau rare est *sûre*). Si durcissement souhaité : confirmer côté serveur avant de figer « Ok. », ou retry. [render/conversation/Conversation.tsx]

## Story 4.6 — L'arbre (projection muette, fiche, « Voir dans la conversation », renommage, vue liste)

Specs de l'arbre réécrites le 2026-07-31 (**fruit → rayonnement**, arbre de vie) avant cadrage. Périmètre « Voir dans la conversation » = **COMPLET** (décision PO). Portes / différés :

- **🌿 Illumination sémantique — PARQUÉE, décision Sanela.** Idée (Julian, 2026-07-31) : les **racines** s'illuminent pour l'**ancrage**, les **branches** pour la **perspective/liberté** — « encore plus de significations » dans l'arbre. **Risque soul-of-product** : si le **système** classe les prises de conscience, le produit **catalogue** sa vie intérieure (FR-018 « jamais une signification cataloguée », FR-025, charte « rien ne trahit »). Viable **seulement si c'est ELLE** qui choisit la catégorie (au prix d'une friction sur le champ de nommage vide, UX-DR-27). **Additif** sur `BrancheProjetee` (un `categorie` choisi par elle) → **ne bloque pas 4.6**. À trancher avec Sanela ; si retenu = petite story additive. [lib/scene/projection.ts]
- **⚠️ Chevauchement Epic 5 (lecture-journal).** Le « Voir dans la conversation » COMPLET lit l'**échange source persisté** (`charger_echange_source`, rejeu du fil) — adjacent à la lecture-journal que 0016 range en Epic 5. Viser une lecture **minimale et réutilisable**, pas un moteur de journal complet (à vérifier en revue). [supabase/migrations/0016_entree_journal.sql]
- **Tronc `incomplet`/`complet` (FR-051) — différé Epic 5.** Le tronc dépend du **socle calculé** (thème natal / heure de naissance), absent avant Epic 5. 4.6 rend `tronc.present` ; l'état incomplet/complet vient avec le socle. [lib/scene/projection.ts]
- **Greffe du beau moteur Canvas — itération parallèle.** L'asset `images/assets/design_handoff_arbre_lunaire/` (recoloré argent lunaire, illumination par branche, API `branchStates[]`) sera porté dans `render/` **après** l'arbre honnête de 4.6. Prompt de relance « rendu plus fourni sans trahir la charte » disponible si Sanela veut plus de densité. [render/arbre-vivant.tsx]
- **Bascule vue liste = `localStorage` (v1).** « Persistée par utilisatrice » implémentée en préférence navigateur (pas de migration) ; une préférence serveur (multi-appareils) pourrait la remplacer plus tard. [render/]
- **Renommage NON gardé sur la détresse (défaut).** AD-17 vise la *naissance*, pas l'édition d'un nom ; à confirmer si Sanela veut le contraire. [supabase/migrations/0022_branche_arbre.sql]

### Revue adversariale 4.6 — 77 findings retenus, TOUS corrigés (migration 0023) ; 2 différés

- **~~Harnais de test COMPOSANT absent (RTL/jsdom)~~ — LEVÉ le 2026-08-04.** Le report a été invalidé par la RE-REVUE, qui a reproduit en dix minutes (jsdom) un arbre INVISIBLE au scénario nominal que les gardes par lecture de source ne pouvaient pas voir. `jsdom` + `@testing-library/react` + `@testing-library/user-event` ajoutés en dépendances de dev, avec un **projet Vitest séparé** (`rendu`, environnement jsdom) pour ne pas ralentir les ~1300 tests `node`. [vitest.config.ts, tests/rendu/]
- **« Voir dans la conversation » rejoue un MONOLOGUE.** `entree_journal` n'a aujourd'hui **aucun écrivain de tours `anam`** : la policy d'insertion épingle `role='utilisatrice'` (0016) et l'unique appelant écrit ce rôle en dur. Le rejeu ne contient donc que les tours de l'utilisatrice. La colonne `role` existe et est déjà rendue ; le côté Anam attend une RPC serveur-attestée, rangée **Epic 5**. [supabase/migrations/0016_entree_journal.sql]
- **Ordre de relâchement pour la Story 4.7.** 0023 épingle `etat='naissance' and intensite=0` **dans la policy d'insertion ET dans le trigger** (double défense anti-forge). La 4.7, qui livre les transitions monotones, devra **relâcher les deux au même endroit** — sinon la feuillaison sera refusée. [supabase/migrations/0023_branche_arbre_correctifs.sql]
- **`app/error.tsx` / `global-error.tsx` manquants (transverse).** Un throw de rendu rend aujourd'hui la page entière inutilisable au lieu d'un repli. Relevé pendant la revue 4.6 mais **hors périmètre** (transverse à tout le produit) — à traiter avec la robustesse client.

### RE-REVUE adversariale 4.6 (2026-08-04) — 30 candidats vérifiés, 24 retenus et corrigés

Menée après la passe de correction des 77 findings, sur les zones RÉÉCRITES par cette passe. 6 angles de
recherche, vérification **à charge de réfutation** (verdict par défaut « réfuté »), puis balayage de lacunes.
32 candidats bruts → 30 dédupliqués → 30 vérifiés → **6 réfutés, 24 retenus** (7 HAUTE), tous corrigés.

Le résultat le plus utile n'est aucun des bugs : c'est le constat que **la passe de correction précédente
n'avait pas réparé ce qu'elle annonçait avoir réparé**. Trois gardes « refaites » survivaient encore à leur
mutation, dont le correctif PHARE (R1-ter). La cause était subtile et vaut d'être retenue : les tests
d'insertion passaient par une session JWT, où la **policy ET le trigger** bloquent tous les deux — muter
l'un laissait l'autre refuser, donc le test restait vert. Ils prouvaient « au moins une des deux moitiés
existe », jamais l'une NI l'autre. Le chemin `service_role` (que la RLS ne borne pas) isole le trigger seul :
c'est lui qui tue le mutant.

**Reste ouvert après cette passe :**

- **La densité de l'arbre au-delà d'une quinzaine de branches.** L'éventail de 150° à un seul niveau de
  ramification divise l'écartement angulaire par deux à chaque niveau de remplissage. Le placement par RANG
  (permanence) et le raccourcissement par niveau repoussent le problème ; la zone cliquable est désormais
  bornée à 0,9 × l'écartement réel, ce qui garantit qu'on **n'ouvre jamais la mauvaise branche** — mais à
  zoom 1 et 25 branches, une cible fait ~10 px. Le zoom la fait regrandir, et la **vue liste** reste
  l'équivalent non spatial garanti (AC3). La vraie réponse serait de la RAMIFICATION (sous-branches) :
  c'est un sujet de design, pas de correctif de revue. [render/arbre/geometrie.ts]
- **Le plafond de `/api/incident` est per-instance.** Il vit dans une `Map` de portée module : sur Vercel,
  N instances = N × 12/min. Réfuté comme défaut (ce qu'il protège est la LISIBILITÉ d'un flux de journal,
  pas une donnée), mais à revoir si le journal devient un vrai canal d'alerte. [app/api/incident/route.ts]
- **`app/error.tsx` / `global-error.tsx`** toujours manquants (déjà relevé plus haut, toujours transverse).


## Story 4.9 — le canal courriel : portes pré-lancement (revue adversariale, lot T5)

Le canal courriel est le premier chemin du produit qui atteint une personne **hors de l'application**.
Les corrections T5 l'ont rendu sûr par défaut : sans configuration, rien ne part. Restent des portes que
seul un humain peut franchir.

- **PORTE — LE DOMAINE.** `ANIMA_SITE_URL` doit désigner un domaine **réellement possédé**. Le gabarit
  portait `https://anima.app` en dur ; ce domaine est **parqué et EN VENTE chez Afternic** (NS afternic,
  MX null), relié à aucun déploiement. Quiconque l'achète peut servir une fausse page de connexion Anam
  sur `/synthese`, à des femmes qu'un courriel signé « Anam » vient d'avertir qu'un texte intime les
  attend : l'hameçonnage arrive alors avec la crédibilité du produit. **Tant que la variable est absente
  ou invalide, `estConfigure()` répond `false` et aucun courriel ne part** — la synthèse est produite et
  consultable, aucune réservation n'est consommée. Une garde de dépôt interdit désormais tout hôte écrit
  en dur dans `app/`, `lib/`, `render/`. [lib/courriel/origine.ts, .env.example]
- **PORTE — Resend sous-traitant art. 28** (FR-067/NFR-019) : DPA Resend à signer et documenter, comme
  Mistral et Stripe. Resend voit **une adresse, un motif, un jeton opaque** — jamais un mot de la synthèse
  (la signature du port l'en empêche). Transfert US à couvrir. [lib/courriel/port.ts]
- **PORTE — la boîte de l'expéditeur.** Le courriel n'invite plus à répondre (la phrase « réponds à ce
  courriel » ouvrait un canal art. 9 **entrant** vers une boîte ordinaire, hors RLS, hors ZDR — et cette
  boîte n'existait pas). Mais rien n'empêche quelqu'un de répondre quand même. À trancher côté ops :
  adresse d'expédition sans boîte de réception, ou boîte réellement relevée avec une politique de
  conservation. Ne PAS faire de `ANIMA_COURRIEL_EXPEDITEUR` une adresse consultée sans décision explicite.
- **PORTE — information art. 13.** 4.9 ajoute **un destinataire** (Resend, US) et **une finalité nouvelle**
  (l'adresse de compte, jusqu'ici réservée aux magic links, sert à une notification produit). `/cgu` les
  nomme désormais, mais reste un placeholder auto-déclaré : la politique de confidentialité complète et
  l'écran de consentement restent à rédiger/valider par un juriste. [app/cgu/page.tsx]
- **Rétention de `synthese` — DÉCISION, pas un oubli.** Aucune purge périodique : ces récits sont ce que
  la personne vient relire, et ce sont les seuls textes du produit qu'elle n'a pas écrits elle-même, donc
  qu'elle ne peut pas reconstituer. Ils vivent et meurent avec le compte (cascade FK, vérifiée en base),
  et entrent dans l'export dès maintenant. Le moteur de rétention unique (AD-14, Epic 6) doit hériter de
  cette décision, pas la redécouvrir.
- **Rétention de `notification_envoyee` — FAITE**, 30 jours, exécutée à chaque tick du job de synthèse
  (`purger_notifications_envoyees`). Empilée, la table était un calendrier d'assiduité dont l'ABSENCE
  parle autant que la présence. Le moteur unique de l'Epic 6 reprendra cette purge avec les autres ; d'ici
  là elle tourne, parce qu'une durée de conservation qui attend un epic n'est pas appliquée.
- **Le désabonnement est CÂBLÉ**, dans les deux sens : lien dans le corps (`/desabonnement`, geste
  confirmé) et en-têtes `List-Unsubscribe` / `List-Unsubscribe-Post` (RFC 8058, exigés par Gmail et Yahoo
  depuis février 2024). Le refus porte sur le CANAL : la synthèse continue de s'écrire et reste
  consultable. Reste à faire côté ops : **enregistrements SPF/DKIM/DMARC** sur le domaine, sans quoi les
  messages partent en indésirables quoi qu'ils contiennent. [supabase/migrations/0034]
- **Aucun lien entrant vers `/synthese` ni vers `/desabonnement` depuis l'application** (T6-14, non traité
  ici) : les deux haltes ne sont atteignables que par leur URL. À câbler avec le menu de compte, qui
  n'existe pas encore.

## Story 4.9 — ce que le tri T6 a laissé de côté, et pourquoi

Sur les vingt défauts mineurs de la revue, **dix-sept sont fermés** (neuf étaient tombés en corrigeant
les lots A/B/C, sept ont été traités au tri, un — T6-3 — s'est révélé déjà résolu : les tris sont totaux
dans les définitions vivantes, vérifié en base). Restent trois items, gardés ouverts **délibérément**.

- **T6-16 — LA SYNTHÈSE N'A AUCUN FILET DE SÉCURITÉ EN SORTIE (AD-16).** C'est le plus important de tous
  les résiduels, et le seul qui touche la sécurité. Le matériau d'entrée est bien filtré (les épisodes de
  détresse en sont exclus, AC3), mais huit semaines classées niveau 0 peuvent s'agréger en quelque chose
  de lourd — lu seul, à froid, sans personne en face, avec une consigne qui ordonne « c'est le moment où
  tu peux être la plus DIRECTE ».
  **Pourquoi ce n'est PAS un correctif de tri** : le faire proprement veut dire un SECOND appel modèle par
  personne et par semaine (détection sur le texte produit, au modèle fort — NFR-012 interdit le tier
  léger). Or l'enveloppe de temps du job vient d'être calée au plus juste (25 s pour le modèle, 6 s de
  réserve par personne, 38 s pour le job dans une lambda à 60 s) : un second appel la fait exploser. C'est
  une décision de coût et d'architecture, donc une story, pas une ligne.
  **Piste** : détection sur la sortie + bloc ressources statique (non-IA, donc AD-15-compatible) en tête
  de la synthèse quand le verdict est ≥ 1, et le job passe à deux personnes par tick au lieu de vingt le
  jour où ça se produit. À arbitrer avec le PO.
- **T6-13 — la mise en page rend le calendrier de détresse lisible.** Les périodes affichées sur
  `/synthese` ne sont pas contiguës (les entrées d'épisode sont exclues du matériau), donc un trou de huit
  jours épouse exactement un épisode. Ce n'est pas un chiffre au sens de FR-031, mais c'est de
  l'information sur sa détresse restituée par la forme. Le correctif est un choix de design (afficher les
  périodes autrement, ou ne pas les afficher) — pas un correctif technique. [app/synthese/page.tsx]
- **~~T6-19 (résiduel) — `clore_execution` n'a toujours pas de jeton de propriété.~~ ✅ REFERMÉE le
  15/08/2026, migration `0052` (Story 6.1a).** Le rappel de ce qu'elle disait : les états terminaux
  étaient devenus terminaux (`and statut = 'en_cours'`, 0035), mais deux exécutions concurrentes après
  expiration de bail voyaient toutes deux `en_cours` et la seconde clôture écrasait la première.
  `reclamer_execution` frappe désormais un **jeton** neuf à chaque prise de main et le rend à
  l'appelant ; `clore_execution` ne l'accepte que s'il correspond au jeton courant de la ligne, et rend
  un booléen pour que le refus se journalise (`ordonnanceur_cloture_refusee`). Cinq appelants repris.
  Une garde interdit que l'ancienne signature à cinq arguments survive en surcharge — le contournement
  qu'un `create or replace` aurait livré à côté de la garde. [supabase/migrations/0052]
- **T6-6 (résiduel) — la garde de cible tactile ne couvre que les commandes NOMMÉES.** `tests/cible-tactile.test.ts`
  attrape `button`, `summary`, `input`/`select`/`textarea` et les classes « bouton »/« champ ». Les
  commandes dont le nom ne les trahit pas (`.sortieRapide`, `.numero` de la page d'aide) portent bien les
  44 px mais restent tenues par la relecture. La garde empêche la RÉGRESSION, pas l'oubli sur un nom
  inédit — c'est écrit dans son en-tête.

## ✅ FR-088 — FERMÉ par la Story 3.3 (migration `0037`, 2026-08-07)

`branche_insertion` porte désormais `est_premium_courante()` dans son `WITH CHECK`, et
`chargerOuverture` ne propose plus de branche à un compte gratuit (D2-A). Les quatre décisions PO qui
bloquaient ce report ont été tranchées :

- **D1-A** — seule la **naissance** est premium. `branche_maj` (l'unique policy UPDATE, qui couvre
  renommage + feuillaison + rayonnement) reste **ouverte** : le paywall porte sur ce qui s'ajoute,
  jamais sur ce qui est déjà à elle (FR-029, 3.5). Gardé par `tests/tronc-branche-sql.test.ts`.
- **D2-A** — Anam ne propose plus, mais **le SIGNAL n'est jamais gaté** : un compte gratuit continue
  d'accumuler ses moments mûrs, intacts, pour le jour où il s'abonne (garde FR-059 dans
  `tests/ouverture-branche.test.ts`).
- **D3-A** — la phrase sobre d'AC6 vit dans l'état vide, sans persistance ni bouton.
- **D4-A** — `ALLOCATION_RESIDUELLE_TOURS` reste **non configurée** (voir l'entrée dédiée ci-dessous).

Le second point de l'analyse d'origine reste vrai et **assumé** : la détection de reconceptualisation
n'a toujours aucune garde premium, et c'est délibéré — la gater détruirait en silence des prises de
conscience réelles. Le coût du modèle fort sur un compte gratuit est donc une **dépense consentie**, à
relire le jour où `ALLOCATION_RESIDUELLE_TOURS` sera posée.

<details><summary>Le constat d'origine (conservé pour l'historique)</summary>

**Le fait.** `creer_branche_depuis_signal` (migration 0021) ne porte **aucune** condition d'abonnement,
ni dans la RPC, ni dans le `WITH CHECK` de la policy `branche`. `app/api/anam/branche/route.ts` non plus
(ses gardes portent sur la propriété et sur la détresse, pas sur l'entitlement). Un compte gratuit qui
atteint une proposition d'ouverture peut donc créer, nommer, faire feuiller et déclarer en rayonnement
autant de branches qu'il veut. FR-088 (`prd.md:186`) dit l'inverse.

**Pourquoi ce n'est pas « borné en pratique » comme on pourrait le croire.** L'argument naturel est
« de toute façon un compte gratuit ne parle pas assez pour déclencher une reconceptualisation ». Il ne
tient pas aujourd'hui, pour deux raisons vérifiées :

1. **Le quota gratuit est INERTE.** `limiteAllocationResiduelle()` lit `ALLOCATION_RESIDUELLE_TOURS`,
   qui n'est **posé nulle part** (ni `.env.local`, ni Vercel) → `null` → `doitCouperConversation` renvoie
   toujours `false`. Un compte gratuit a donc, à cette date, une **conversation illimitée**. Le
   raisonnement « il ne parlera pas assez » ne commence à exister qu'une fois cette porte ops posée.
2. **La détection de reconceptualisation n'a elle non plus aucune garde premium.**
   `evaluerReconceptualisationDuTour` tourne sur *chaque* tour post-sécurité et dépense un appel au
   **modèle fort**. Le coût réel n'est donc pas la branche : il est en amont, dans la détection, et il
   est déjà entièrement ouvert au gratuit.

**Ce que ça veut dire.** FR-088 n'est pas une frontière de coût, c'est la frontière **produit** : si un
compte gratuit peut faire pousser tout un arbre, l'offre premium n'a plus grand-chose à vendre. C'est
une décision de PO, pas un correctif technique évident — d'où le report.

**Correctif quand il sera tranché** : la garde va dans le `WITH CHECK` de la policy d'écriture de
`branche` (leçon RLS déjà apprise : `authenticated` a le grant sur la table, une garde dans la seule RPC
ne protège rien), avec un repli explicite sur le doute — et il faut décider ce que devient une branche
existante quand un abonnement s'éteint (lecture seule ? gelée ? intacte ?). **À trancher avant mise en
ligne**, en même temps que la valeur de `ALLOCATION_RESIDUELLE_TOURS`. Hors périmètre de la 4.10, qui ne
garde que ce qu'elle crée (les plans d'étapes, FR-081).
[supabase/migrations/0021_branche.sql, app/api/anam/branche/route.ts, lib/ai/allocation-config.ts,
lib/safety/reconceptualisation-pipeline.ts]

</details>

## Story 3.3 — ce qu'elle laisse ouvert (2026-08-07)

### FR-056 « la mémoire longue » — non gardée, et pas par oubli

**Le fait.** Les trois couches de mémoire (4.1 journal brut, 4.2 faits extraits, 4.3 rappel opportun)
existent et **aucune n'est gardée par l'entitlement**. FR-056 (`prd.md:185`) classe pourtant « la
mémoire longue » en premium. La 3.3 a inventorié cette surface (T1-3) et a **choisi de ne pas la
garder**.

**Pourquoi.** Garder le **stockage** ferait qu'Anam **oublie** ce qu'on lui a confié le jour où
l'abonnement s'éteint — c'est-à-dire exactement la régression que D1-A vient d'interdire pour les
branches, et que la 4.10 avait déjà refusée pour le plan d'étapes (« un paywall qui séquestre ce qui
est déjà écrit n'est pas un paywall »). Le seul découpage défendable porterait sur le **rappel
opportun au-delà de la séance courante** (4.3) : Anam se souviendrait toujours, mais ne ramènerait
spontanément un souvenir ancien que pour une abonnée.

**Ce qu'il faut pour trancher.** Une décision de PO à part entière, pas un correctif technique — et
elle interagit avec FR-059 (la qualité d'Anam n'est pas dégradée pendant la première séance). **À
trancher avant mise en ligne.** La garder en douce dans une story de paywall aurait été le pire des
deux mondes.
[lib/data/depot-faits.ts, lib/data/depot-rappel.ts, lib/safety/mesure-rappel.ts, prd.md:185]

### Les cinq items FR-055 de l'Epic 5 — armés, pas implémentés

Numérologie, thème natal, horoscope, mantra du jour, ennéagramme sont **gratuits à vie** (FR-055) et
n'existent pas encore. `tests/socle-jamais-coupe.test.ts` porte leur inventaire avec un **détecteur par
item** : le jour où l'un d'eux apparaît dans `app/`, `render/` ou `lib/`, **le test rougit** et exige
qu'on l'inscrive et qu'on prouve qu'aucun gate premium ne le garde. Ce n'est pas une dette : c'est le
filet qui empêche AC4 de devenir un constat daté.

### La conservation des clauses de policy — généralisable, non généralisée

`tests/tronc-branche-sql.test.ts` compare, pour `branche_insertion`, les clauses de **toutes** les
définitions historiques avec celles de la dernière, et rougit si une clause disparaît (la faute
`reserver_notification` de la 4.10, rejouée). L'analyseur est générique ; la garde ne couvre
aujourd'hui que `branche_insertion` et `branche_maj`, seules policies dont la 3.3 raisonne. L'étendre à
**toutes** les policies redéfinies du dépôt (aujourd'hui : `art9_temoin_ecriture`) fermerait la classe
entière — au prix d'une liste d'exemptions pour les relâchements délibérés. À faire quand une
troisième policy sera réécrite, pas avant.
[tests/tronc-branche-sql.test.ts]

---

## Story 4.10 — ce que la revue a laissé ouvert, et pourquoi

- **La collision synthèse ↔ rappel d'échéance est DÉTERMINISTE, et la perte est ACCEPTÉE (décision PO du
  2026-08-06).** Les deux motifs partagent la famille `anam`, plafonnée à une notification par 72 h
  (EXPERIENCE.md). Le registre exécute la synthèse AVANT le rappel dans le même tick : si les deux tombent
  le même jour, la réservation de `synthese_prete` est déjà posée et le rappel est refusé — toujours, pas
  parfois. Et ~43 % des jours de la semaine suivant une synthèse sont dans la fenêtre de blocage.
  Contrairement à la synthèse (rattrapée trois jours par `syntheses_non_annoncees`), **le rappel n'est
  jamais rattrapé** : `echeance = aujourd'hui`, jamais `<=`. Julian a tranché : on accepte la perte plutôt
  que d'introduire une priorité entre motifs. **À rouvrir si l'usage montre des rappels manqués** — le
  correctif serait une priorité de famille, ou une fenêtre de rattrapage d'un jour pour le rappel seul.
  [supabase/migrations/0036, lib/ordonnanceur/registre.ts]

- **La famille `socle` n'existe nulle part encore.** Toute l'argumentation D4 repose sur deux familles, et
  `famille_motif` ne produit que `anam` ou `NULL`. La promesse « le socle quotidien FR-033 ne mangera pas
  le courriel de synthèse » n'est donc vérifiée par aucun test — elle le sera le jour où l'Epic 5/6 ajoutera
  le premier motif de socle. Le mécanisme est prêt (fail-closed sur motif non classé, testé) ; c'est la
  seconde famille qui manque. [supabase/migrations/0036, lib/courriel/port.ts]

- **`faits_arbitrage_ouverture` est exécutable par `authenticated`, donc le compte de branches ouvertes est
  lisible par le client.** AC5 [DUR] est tenu au sens strict — le PRODUIT n'affiche jamais ce nombre, et le
  type qui traverse la frontière n'a aucun champ numérique — mais l'affirmation « le rendu ne PEUT pas
  l'afficher » est plus faible qu'annoncé : trois lignes dans une console suffisent à le récupérer. On ne
  peut pas révoquer `authenticated` (la RPC est appelée sous le jeton de l'utilisatrice) ; les vraies
  options sont de déplacer le seuil en SQL (au prix d'AD-1, qui veut la règle produit testable sans base)
  ou d'accepter que quelqu'un puisse lire SON PROPRE compte dans SA base. **À trancher si le sujet
  ressort.** [supabase/migrations/0036, lib/domain/arbitrage-ouverture.ts]

- **L'inventaire d'effacement d'`ARCHITECTURE-SPINE.md` n'a pas été mis à jour** pour `intention` et
  `invitation_integration`. Les cascades SQL fonctionnent (vérifié), donc l'effacement RÉEL n'est pas perdu ;
  le risque est en aval, si le moteur de rétention de l'Epic 6 s'appuie sur cette liste plutôt que sur une
  découverte dynamique des FK — notamment pour le volet EXPORT, qu'une cascade ne produit pas.
  **Aucun test du dépôt ne vérifie dynamiquement que toute table portant `utilisatrice_id` est en cascade** —
  la discipline repose entièrement sur la relecture. [ARCHITECTURE-SPINE.md:123]

- **`RATTRAPAGE_ANNONCE_JOURS` (3 j) est exactement égal à `PLAFOND_NOTIFICATION_HEURES` (72 h).** Aucune
  marge entre la durée pendant laquelle une synthèse reste rattrapable et celle pendant laquelle le plafond
  la bloque. Deux synthèses à quelques heures d'intervalle — le cas littéral que 0030 décrivait — perdent
  toujours l'annonce de la seconde. Allonger le rattrapage à 4-5 jours rendrait la fenêtre réellement
  utile ; non fait parce qu'au-delà de trois jours, « ta synthèse est prête » devient un courriel daté.
  [lib/domain/synthese.ts]

- **Deux `300` littéraux en SQL** (`intention_declencheur_borne` / `intention_action_borne`) là où le domaine
  évite scrupuleusement la seconde valeur (`INTENTION_LONGUEUR_MAX = NOM_LONGUEUR_MAX`). Aucune borne unique
  extraite côté base. [supabase/migrations/0036]

- **La garde des cibles tactiles ne voit pas les classes `actionSecondaire` / `carteAction`.**
  `tests/cible-tactile.test.ts` ne reconnaît une classe que si son nom contient « bouton » ou « champ ».
  Tous les contrôles neufs de la 4.10 sont conformes (les deux classes déclarent `min-height`), mais rien ne
  garde la non-régression sur ces deux classes omniprésentes. Élargit le résiduel T6-6 déjà consigné.
  [tests/cible-tactile.test.ts]

---

## Story 5.2 — la numérologie complète et déterministe

- **Les comptes DÉJÀ créés n'ont ni prénom ni nom complet, et aucun chemin ne le leur demandera.** La
  capture (T4) vit dans le formulaire du seuil, que seuls les comptes sans `date_naissance` traversent.
  Pour tous les autres, `prenom` et `nom_complet` restent `null` : Anam n'a pas de quoi les nommer, et
  trois des six nombres numérologiques (expression, intime, personnalité) restent `non_calcule` avec la
  raison `nom_absent`. L'absence est honnête et non bloquante — mais elle est **définitive** tant qu'aucun
  écran de correction n'existe. Le rattrapage appartient à « ce qu'Anam retient d'elle » (FR-063/FR-064,
  **Story 6.5**), qui doit permettre d'ajouter ces deux champs au même titre que de corriger un fait.
  Sans lui, l'application accumulera des comptes à numérologie partielle. [app/(auth)/naissance/actions.ts]

- **Le corpus d'interprétation est vide, et c'est la seule forme conforme.** 69 créneaux déclarés, 0 écrit
  (FR-054 + FR-086 : seule Anima peut les écrire). Ce n'est pas de la dette technique mais une **porte
  pré-lancement** — suivie dans `sprint-status.yaml`, avec sa fiche d'écriture
  (`corpus-numerologie-a-ecrire.md`). Conséquence à ne pas perdre de vue : la Story 5.6 (l'accueil en
  cartes) devra afficher une carte de numérologie dont **tous** les textes sont absents. Le rendu de cette
  absence est une vraie question de conception, pas un cas dégradé à traiter à la va-vite.
  [lib/corpus/numerologie.ts]
  **TRAITÉ le 2026-08-14 (5.6/T5)** : trois états de carte — fait + texte, fait seul, rien. L'absence
  est DITE, sans « bientôt », sans excuse et sans repli fabriqué. Voir ci-dessous : ce traitement
  rend la dette d'écriture visible sur le premier écran, ce qui est le vrai sujet.

- **Le détecteur de prédiction ne couvre que le français, et volontairement plus large que nécessaire.**
  « tu pourras » est signalé alors qu'il est souvent anodin — arbitrage assumé (un faux positif coûte une
  reformulation, un faux négatif publie une prédiction sous le nom d'une personne réelle). Deux angles
  morts connus : la prédiction sans marqueur grammatical (« une rencontre, bientôt ») et la prédiction
  portée par une image plutôt que par un temps verbal. Aucun détecteur lexical ne les attrapera ; c'est une
  relecture humaine qui les attrape. [lib/domain/marqueurs-prediction.ts]

- **`tests/socle-jamais-coupe.test.ts` balaie les commentaires autant que le code.** Un fichier du socle
  qui cite simplement une couche de facturation en commentaire fait rougir la garde — c'est arrivé pendant
  cette story. Le comportement est défendable (le registre commercial n'a rien à faire dans le socle
  gratuit) mais il n'est écrit nulle part dans le test lui-même, et le prochain qui le rencontrera perdra
  du temps. [tests/socle-jamais-coupe.test.ts]

- **`app/(auth)/naissance/actions.ts` n'avait AUCUN test avant cette story.** La Story 1.4 avait livré le
  contrôle de majorité côté serveur (NFR-023, FR-070/FR-071) sans jamais l'exercer : la barrière de
  minorité était garantie par relecture seule. `tests/naissance-actions.test.ts` la couvre désormais, mais
  le constat vaut d'être retenu — **d'autres actions du seuil sont peut-être dans le même cas**, et
  personne n'a fait l'inventaire. [app/(auth)/]

## Story 5.3 — dégradation gracieuse sans heure & complétion du tronc

- **L'échantillonnage horaire laisse un angle mort étroit.** `signeAmbigu` teste le signe d'un corps
  toutes les heures sur la fenêtre d'incertitude. Un corps qui franchirait une cuspide **et
  reviendrait en moins d'une heure** y échapperait — cela suppose une station (fin de
  rétrogradation) à moins de ~0,05° d'une cuspide. La correction exacte est un solveur de changement
  de signe (recherche de racine) sur chaque corps ; elle coûte plus cher que ce qu'elle rattrape
  aujourd'hui, et le résidu est écrit plutôt que tu. [lib/astro/theme-natal.ts]

- **Le référentiel de lieux couvre la FRANCE, et rien d'autre.** 34 969 communes (métropole +
  outre-mer), source officielle Etalab/INSEE. Une naissance à l'étranger ne trouve pas sa commune :
  l'ascendant reste absent, **déclaré**, avec sa raison — jamais un point placé au hasard. C'est la
  discipline Chiron appliquée à la géographie. L'extension mondiale est un **remplacement
  d'adaptateur** (`LieuxPort`), pas une réécriture : le domaine ne bouge pas. Décision prise avec
  Julian le 2026-08-11. [lib/astro/adapters/lieux-france.ts]

- **Le référentiel est DATÉ et doit être rejoué.** Le Code officiel géographique bouge (fusions de
  communes). `scripts/construire-lieux-france.mjs` le refabrique depuis la source ; rien ne signale
  aujourd'hui qu'il a vieilli. Une commune fusionnée reste trouvable sous son ancien nom, ce qui est
  le bon comportement pour une naissance ancienne — mais une commune NOUVELLE serait introuvable.
  [scripts/construire-lieux-france.mjs]

- **Le DEGRÉ d'un corps est incertain dès que `precision = "midi_par_defaut"`, et rien ne l'empêche
  encore de s'afficher.** La 5.3 traite le SIGNE (absent s'il est indéterminable) ; le degré, lui,
  reste stocké — c'est la position à midi, un fait sur un instant défini. Mais l'afficher comme
  « Lune à 12°34' du Cancer » quand la vérité est 12° ± 7° serait fabriquer de la précision. **La
  Story 5.6 doit brancher sur `precision`** ; aucune garde ne l'y oblige aujourd'hui. Un champ
  `degreIncertain` sur chaque position aurait été un MIROIR de `precision` (faute R1-bis) — c'est
  pourquoi il n'existe pas. [lib/astro/theme-natal.ts, → 5.6]
  **SOLDÉ le 2026-08-14 (5.6/T6)** : `carteTheme` branche sur `precision` et n'affiche aucun degré
  sous `midi_par_defaut`. Deux mutants symétriques (degré toujours / degré jamais) meurent.

- **L'heure de naissance reste WRITE-ONCE : une faute de frappe est définitive.** Décision confirmée
  par Julian le 2026-08-11 : on n'affaiblit pas une garde déployée (0039) comme effet de bord d'une
  autre story. Le formulaire prévient AVANT l'écriture et exige une confirmation explicite (AC8). **Si
  des demandes de correction apparaissent**, la réponse est une décision produit avec sa propre
  migration — jamais un contournement applicatif. [supabase/migrations/0039_theme_natal.sql]

- **L'état VIDE de l'arbre ne dessine pas le tronc.** Quand aucune branche n'existe, la région arbre
  remplace le canevas par un écran de texte : le tronc n'y est pas *dessiné*, alors que FR-088 dit
  « elle voit son tronc, y compris incomplet ». La 5.3 rend la fiche atteignable dans les trois états
  (un bouton nommé), donc rien n'est inaccessible — mais le DESSIN manque. Antérieur à cette story
  (Story 3.3) ; à traiter avec l'accueil en cartes. [render/arbre/EtatVideArbre.tsx, → 5.6]
  **SOLDÉ le 2026-08-14 (5.6/T9)** : le chemin du tronc vit désormais dans `render/arbre/Tronc.tsx`,
  source unique consommée par le canevas ET l'état vide. Le mutant qui le retire de l'état vide
  rougit trois tests — ce qui prouve au passage que le canevas n'est PAS rendu en parallèle.

- **Le thème natal va être calculé pour de vrai pour la première fois, en production.**
  `lireThemeNatal` n'avait AUCUN appelant applicatif avant cette story. Au premier chargement après
  déploiement, chaque compte déclenche un calcul + une écriture, et ce calcul emprunte le **cas
  dégradé** (aucun lieu n'est capturé aujourd'hui) : fenêtre de 50 h, échantillonnage horaire,
  ~663 lectures d'éphéméride. C'est une fois par compte, jamais deux — mais c'est aussi la première
  mise à l'épreuve réelle du write-gate art. 9 de 0039. [lib/data/depot-theme-natal.ts]
  **AGGRAVÉ PUIS FERMÉ le 2026-08-14 (5.6/T8)** : l'accueil a ajouté un SECOND lecteur du thème dans
  le même `Promise.all` que `chargerProjectionArbre` — donc deux premiers calculs CONCURRENTS et deux
  écritures en course, dont aucune ne voyait l'autre. `app/page.tsx` lit désormais le thème une fois
  et le passe aux deux (`themeDejaLu`). Reste entier : la première mise à l'épreuve réelle du
  write-gate art. 9 de 0039, qui arrivera au premier chargement après déploiement.

## Story 5.4 — l'horoscope et le mantra du jour

- **87 créneaux de corpus de plus, tous vides — le total passe à 156.** Décision Julian du
  2026-08-11 (option complète). C'est une **porte pré-lancement**, pas de la dette technique : seule
  Anima peut les écrire (FR-054, FR-086). Fiche d'écriture : `corpus-quotidien-a-ecrire.md`. Les 27
  textes d'horoscope suffisent à rendre la carte du jour vivante ; les 60 mantras peuvent suivre.
  [lib/corpus/mantra.ts, lib/corpus/horoscope.ts]

- **Le jour bascule à minuit À PARIS, pour tout le monde.** Il n'existe aucune colonne de fuseau de
  RÉSIDENCE — le seul fuseau stocké est celui du lieu de NAISSANCE (5.3), qui n'a rien à voir. Une
  utilisatrice en Guadeloupe voit donc le jour changer à 20 h locales, et une expatriée à Tokyo à
  7 h du matin. La correction est une colonne de préférence, pas une réécriture. [lib/data/lire-quotidien.ts]

- **`lune_relative` ne change que tous les ~2,5 jours** — le même texte sort donc deux à trois jours
  de suite. C'est le ciel qui est comme ça, pas le code : la Lune met 2,5 jours à traverser un signe.
  La configuration dominante par-dessus (~un jour sur deux) est ce qui distingue les jours. **La 5.6
  doit le savoir avant de dessiner la carte** — afficher deux jours de suite un texte identique sans
  rien d'autre autour se lirait comme une panne. [→ 5.6]
  **PRIS EN COMPTE le 2026-08-14 (5.6/D4)** : la bibliothèque porte le JOUR CIVIL jusqu'à l'écran.
  Deux jours identiques se lisent « le ciel n'a pas bougé » et non « l'application est bloquée ».

- **Environ un jour sur deux n'a AUCUNE configuration dominante.** Estimé, pas mesuré finement : la
  mesure sur août 2026 avec un thème d'exemple donne ≥10 changements de dominante sur 31 jours, mais
  la fréquence des jours « vides » dépend du thème. Si la carte paraît creuse à l'usage, le levier est
  `ORBE_DEGRES` (3° aujourd'hui) — un paramètre, à trancher avec une astrologue, jamais au feeling.
  [lib/astro/quotidien.ts]

- **Les aspects MINEURS et les transits LENTS sont absents, et c'est un choix.** Pas de semi-carré,
  pas de quinconce ; pas de Jupiter→Pluton. Les transits lents sont réels et importants en astrologie
  — ils ne sont simplement pas l'unité du JOUR (un aspect de Pluton dure deux ans). Le jour où le
  produit voudra une lecture « de cycle », ce sera une story distincte, pas un ajout à
  `CORPS_TRANSITANTS`. [lib/astro/quotidien.ts]

- **L'échantillonnage horaire du ciel du jour a le même angle mort qu'en 5.3.** Un corps qui
  sortirait d'un signe et y reviendrait en moins d'une heure échapperait à `changementsDe`. Suppose
  une station à moins de ~0,05° d'une cuspide. Résidu écrit plutôt que tu. [lib/astro/quotidien.ts]

- **La mémoïsation du ciel est PAR PROCESSUS.** En serverless, chaque instance froide recalcule
  (~138 lectures d'éphéméride, quelques millisecondes). Ce n'est pas un problème aujourd'hui, mais
  « servi depuis le cache » ne veut pas dire « calculé une fois par jour dans le monde » — ça veut
  dire « une fois par instance et par jour ». [lib/data/lire-quotidien.ts]

- **Un corpus vide rend toute assertion sur son CONTENU vacue — et deux mutants l'ont prouvé.**
  `mantraDuJour` figé sur le premier créneau, et le mantra indexé sur l'utilisatrice, ont tous deux
  SURVÉCU à la première campagne : les 60 créneaux étant `non_ecrit`, deux mantras sont égaux. La
  parade adoptée (exporter la CLÉ, espionner l'ARGUMENT) vaut pour **tous les corpus à venir** —
  5.5 (ennéagramme) et 5.7 (sens des cartes) hériteront du même angle mort s'ils l'oublient.
  [lib/corpus/mantra.ts, → 5.5, → 5.7]

## Story 5.6 — l'accueil, la bibliothèque en cartes

- **DEUX CARTES SUR CINQ N'ONT RIEN À MONTRER, ET C'EST DÉSORMAIS SUR LE PREMIER ÉCRAN.** Le mantra
  du jour EST son texte (60 créneaux, 0 écrit) ; l'horoscope ne produit que des clés de corpus
  (27 créneaux, 0 écrit). Les trois autres cartes montrent des faits calculés sans interprétation.
  La 5.6 n'a pas créé cette dette — elle la rend **visible**, ce qui était l'objet même de la story.
  **Ce n'est pas de la dette technique : c'est la porte pré-lancement d'écriture, et l'accueil n'est
  pas publiable tant qu'au moins les 87 créneaux du quotidien ne sont pas écrits**
  (`corpus-quotidien-a-ecrire.md`). Seule Anima peut les écrire (FR-054 + FR-086). Trois issues, à
  trancher par Julian : écrire d'abord ; publier avec l'absence dite honnêtement (ce que le code
  fait) ; ou réduire la bibliothèque à trois cartes — mais UX-DR-30 pose un plancher de quatre.
  [lib/corpus/mantra.ts, lib/corpus/horoscope.ts]

- **Il n'existe AUCUN corpus de thème natal, et ce n'est pas un oubli de cette story.** Les 5.1 à 5.5
  ont déclaré des créneaux pour la numérologie (69), l'horoscope (27), le mantra (60) et
  l'ennéagramme (9) — jamais pour le thème. Son interprétation n'a été cadrée par aucune story, donc
  la carte du thème montre ses faits et rien d'autre. C'est cohérent et honnête aujourd'hui ; c'est
  une **décision produit non prise**, pas un trou technique. [lib/domain/cartes-socle.ts]

- **La carte mise en avant CHANGERA quand Anima écrira.** La rotation ne tourne que sur les cartes
  présentables (AC5 — sinon l'accueil s'ouvrirait deux jours sur cinq sur une carte vide). Cet
  ensemble grandit à mesure que le corpus se remplit, donc la carte d'un jour donné ne sera pas la
  même avant et après. Il n'y a pas d'archive en v1 (`EXPERIENCE.md` §607) : personne ne peut
  constater l'écart. C'est un fait connu, pas un défaut. [lib/domain/bibliotheque.ts]

- **`aPremium` est câblé et sans effet réel.** Aucune carte de la bibliothèque n'est premium avant la
  5.8 (la lecture) et la 5.9 (l'ancrage). Le filtre est donc exercé par une **fixture explicite** dans
  `tests/bibliotheque.test.ts`, jamais par une vraie carte. C'est assumé — câbler la mécanique
  maintenant évite qu'elle se câble dans l'urgence, avec la carte cadenassée qui revient par la porte
  de derrière (`EXPERIENCE.md` §511). À re-vérifier sur données réelles en 5.8. [lib/data/lire-bibliotheque.ts]

- **Le degré s'affiche en degrés ENTIERS, sans minutes d'arc.** Choix de lisibilité de carte, pas de
  précision : « Balance, 6° » plutôt que « Balance, 6°31' ». La fiche du socle pourra être plus
  précise si le besoin apparaît. [lib/domain/cartes-socle.ts]

- **La carte du thème ne montre que CINQ corps** (Soleil, Lune, Mercure, Vénus, Mars) plus
  l'ascendant. Une carte est un objet qu'on saisit d'un regard, pas un tableau d'éphémérides — mais
  cela veut dire que Jupiter, Saturne et les transsaturniennes ne sont visibles NULLE PART dans le
  produit aujourd'hui. La fiche complète du thème n'existe pas encore. [lib/domain/cartes-socle.ts]

- **`lib/data/lire-bibliotheque.ts` n'est PAS dans le balayage lexical « zéro premium ».** Il ne peut
  pas y être : il porte `aPremium` légitimement. La garde équivalente est comportementale
  (`socle-jamais-coupe.test.ts` : les cinq cartes du socle survivent à `aPremium = false`), et elle
  est plus forte — elle interdit le résultat, pas le vocabulaire. Ce qu'aucune garde ne voit : un
  `if (aPremium)` qui déciderait du CONTENU d'une carte du socle plutôt que de sa présence.
  [lib/data/lire-bibliotheque.ts]

- **Le substantif « soin » était libre dans tout le produit, et FR-023 le nomme explicitement.**
  Le lexique bannissait les DÉRIVÉS (formes verbales) et épargnait LE MOT — l'inverse de l'exigence,
  assumé en toutes lettres par la revue 2.8 et verrouillé par deux assertions de test, dont
  « des soins de support » (du vocabulaire d'oncologie). Réparé en 5.6/T1, zéro faux positif sur le
  dépôt entier. **Ce qui reste à en tirer : une garde peut être verrouillée À L'ENVERS par son
  propre test négatif, et rien ne le signale.** [lib/domain/lexique-interdit.ts]

## Story 5.7 — le tirage isolé & le jeu propriétaire

- **RIEN N'EMPÊCHE ENCORE DE TIRER DIX FOIS DE SUITE, ET C'EST UNE TÂCHE OBLIGATOIRE DE LA 5.8.**
  L'UX interdit de *proposer* un re-tirage, mais tant que le tirage n'est rattaché à aucune LECTURE —
  entité qui naît en 5.8 —, il n'existe aucune clé sur laquelle poser l'unicité. Une utilisatrice
  déterminée peut rappeler le point d'entrée jusqu'à obtenir la carte qui lui plaît. Ce n'est pas le
  défaut FR-016 (le SYSTÈME ne choisit pas), mais c'en est le voisin immédiat. La 5.8 doit poser la
  contrainte au moment où `lecture` existe : un tirage par lecture, unicité structurelle.
  [supabase/migrations/0050_tirage.sql, → 5.8]

- **Le journal prouve la REJOUABILITÉ, pas que le mot accepté fut le premier tiré.** Un code qui
  rejetterait sélectivement les mots menant à une carte indésirable produirait un journal
  parfaitement cohérent. Le résidu est réel et borné : un tel rejet sélectif DÉFORME la distribution
  et tombe sous le χ² sur grand N. Les deux gardes se complètent, aucune ne suffit seule.
  [lib/tirage/alea.ts]

- **La garde principale de l'uniformité est DÉTERMINISTE, et il faut savoir pourquoi avant d'y
  toucher.** Le biais de modulo vaut ~1,4·10⁻⁸ sur 24 cartes : il faudrait ~10¹⁶ tirages pour le voir
  au χ². Le mutant `mot % borne` sans rejet SURVIT au test sur grand N — il n'est tué que par les
  trois mots scriptés qui interrogent la frontière du rejet. **Corollaire piégeux : si le jeu passait
  un jour à 32 cartes (puissance de deux), la zone de rejet deviendrait VIDE et cette garde cesserait
  de prouver quoi que ce soit.** Les tests fixent donc leurs bornes en dur (3, 24, 40) et ne les
  empruntent jamais à `TAILLE_JEU` ; une assertion dédiée surveille que la taille n'est pas une
  puissance de deux. [lib/tirage/alea.ts, tests/tirage-alea.test.ts]

- **Le seuil du χ² est très lâche (60 pour 23 ddl, quantile ~0,99997), et c'est assumé.** À 5 % la
  suite rougirait un jour sur vingt sans qu'aucune ligne de code n'ait bougé, et un test qui crie au
  loup finit désactivé. Ce que le seuil laisse passer : tout ce qui est plus fin qu'une faute
  grossière — mais la finesse est couverte par la garde déterministe. [tests/tirage-alea.test.ts]

- **L'INDÉPENDANCE AU PROFIL NE SE TESTE PAS STATISTIQUEMENT, et le test le dit au lieu de simuler.**
  On ne mesure pas la corrélation à une entrée qui n'existe pas : `tirerUneCarte()` a une arité nulle.
  La garde est structurelle (arité + verrou d'imports), et écrire un faux test de corrélation aurait
  produit exactement le genre de rassurance vide que ce dépôt combat. [tests/tirage-architecture.test.ts]

- **UN HARNAIS DE MUTATION PEUT PRODUIRE DE FAUX KILLS, ET LE MIEN L'A FAIT.** Le harnais SQL comptait
  pour « tué » tout mutant dont le `db reset` échouait. Or `supabase db reset` rend parfois un `502`
  sur le redémarrage des conteneurs — un hoquet d'infra, la migration s'appliquant très bien. Quatre
  mutants ont été déclarés morts sans qu'aucun test ne les ait vus, puis repris avec un harnais qui
  distingue « migration invalide » de « reset qui hoquette ». **La doctrine du dépôt vaut aussi pour
  les outils qui la vérifient : un contrôle aveugle est vert.** [→ toute campagne SQL future]

- **`tirage` porte la garde de détresse alors que `theme_natal` ne la porte pas — arbitrage explicite
  à ne pas défaire par symétrie.** Un calcul astronomique n'adresse rien à personne ; une carte tirée
  puis présentée comme porteuse de sens est du même ordre qu'une hypothèse d'ennéagramme (0049), en
  plus chargé. Coût assumé : pendant la fenêtre de 72 h, une demande de lecture est REFUSÉE par la
  base avec un `42501` indistinct des trois autres gardes. **La 5.8 doit le dire avec des mots, pas
  avec une erreur** — et doit donc distinguer les quatre causes. [supabase/migrations/0050_tirage.sql, → 5.8]

- **Les 24 clés de carte sont internes et renommables — mais le coût monte avec le temps.** Elles ne
  s'affichent jamais (l'UX interdit de nommer la carte), donc les renommer coûte un `UPDATE` sur
  `tirage.carte` plus le renommage des fichiers de visuels. Réversible aujourd'hui ; à trancher avec
  Anima AVANT la commande d'art, parce qu'un visuel dessiné fige son nom de fait.
  [lib/tirage/jeu.ts, → Anima]


## Story 5.8 — le rituel de lecture & la restitution écrite

**Deux résidus de la 5.7 sont FERMÉS ici**, et par des lignes nommables :
- « rien n'empêche de tirer dix fois de suite » → `create unique index lecture_une_seule_en_attente
  on public.lecture (utilisatrice_id) where reponse is null` (0051) + la relecture sur `23505`
  (`lib/data/depot-lecture.ts`). Doublé par l'unicité de `lecture.tirage_id`, qui ferme la porte de
  derrière (tirer dix fois, regarder, puis n'ouvrir la lecture que sur celle qui plaît).
- « le `42501` indistinct » → `causes_refus_lecture()` (0051) + `lib/domain/acces-lecture.ts`.

- **LA GARDE PREMIUM MANQUAIT DANS LA POLICY, ET C'EST LE DÉFAUT LE PLUS SÉRIEUX DE CETTE STORY.**
  `lecture_depot` a été écrite avec les quatre gardes de 0050 (propriété, art. 9, minorité, détresse)
  **sans** `est_premium_courante()` — alors que 0037 dit en toutes lettres qu'« une garde premium
  posée uniquement dans la RPC serait décorative ». La route arbitrait correctement, mais
  `authenticated` détient le grant INSERT table-level : un `.insert()` direct ouvrait une lecture
  premium sans jamais croiser la route. Trouvé en relisant la doctrine des migrations voisines, pas
  par un test — **aucun test ne cherchait ce qui n'avait pas été écrit**. Réparé, et le mutant qui
  retire la ligne est tué par trois tests. [supabase/migrations/0051_lecture.sql]

- **MON PROPRE HARNAIS DE MUTATION A RENDU CINQ NON-VERDICTS, ET C'EST LA LEÇON DE LA 5.7 RÉPÉTÉE.**
  Il décidait « la migration est-elle valide ? » en cherchant l'absence du mot « error » après le nom
  du fichier dans la sortie texte de `supabase db reset` — une heuristique sur de la prose de CLI.
  Cinq mutants sur dix sont revenus « indécidable ». Repris avec un harnais qui interroge **Postgres**
  (`select to_regclass('public.lecture') is not null`) : les cinq sont tués. Et le 502 sur
  « Restarting containers » s'est reproduit, à l'identique de la 5.7. **Un contrôle qui lit du texte
  libre n'est pas un contrôle.** [→ toute campagne SQL future]

- **UN TEST DE FRONTIÈRE PEUT ÊTRE VERT EN NE GARDANT RIEN, ET LE MIEN L'ÉTAIT.** La garde « le
  « Réessayer » ne purge jamais la carte » cherchait la chaîne `t.role === "carte"` dans le filtre. Le
  mutant naturel — celui qu'on écrit spontanément pour exclure la carte d'un filtre de conservation —
  s'écrit `t.role !== "carte"`, et passait sous le nez de l'assertion. Corrigé en cherchant le MOT,
  commentaires retirés. **Une assertion `not.toContain` sur une forme syntaxique précise ne garde que
  cette forme-là.** [tests/lecture-frontiere.test.ts]

- **Le survivant assumé de la 5.5 est fermé.** Retirer `if (capacite === "lecture") return "fort"` ne
  change rien au comportement (le repli rend « fort »), donc aucun test comportemental ne peut le
  voir. La garde ne pouvait vivre que dans la source : un test vérifie désormais que
  `hypothese_enneagramme` **et** `lecture` sont tranchées explicitement. [tests/politique-tier.test.ts]

- **LA DEMANDE DE LECTURE N'EST PAS VUE QUAND LA TRACE DE SÉANCE EST ILLISIBLE.** Le signal voyage
  dans la passe d'extraction d'arc, qui ne tourne que `if (etatArcCharge)`. Repli assumé : elle
  redemandera. Ce qui a été explicitement REFUSÉ, c'est de dégrader vers un `includes("lecture")`
  serveur — un tel filtre ouvrirait le rituel sur « j'ai fini ma lecture du soir », et une carte tirée
  ne se retire jamais. [lib/domain/signaux-arc.ts]

- **LE TIRAGE PERDANT D'UNE COURSE RESTE ORPHELIN DANS LE JOURNAL, ET ON NE L'EFFACE PAS.** Deux
  onglets, deux tirages, un seul rattaché. Le perdant n'est rattachable à aucune lecture
  (`tirage_id` unique) donc il ne peut pas resservir. L'effacer donnerait un journal d'audit plus
  propre que la réalité. [lib/data/depot-lecture.ts]

- **« MES LECTURES » N'EST ATTEIGNABLE QUE PAR SON URL.** Le menu de compte (la feuille qui liste
  *Aide et ressources, Ce qu'Anam retient, La synthèse, Mes lectures, L'abonnement, Mes données, Ce
  que j'ai accepté, Réglages*) **n'existe pas encore** comme composant — `/synthese` et `/enneagramme`
  sont dans le même cas. La place de la halte dans l'ordre invariable est documentée dans son en-tête ;
  le menu reste à construire. [app/lectures/page.tsx, → refonte de l'entrée / Epic 6]

- **Le `delete` sur `lecture` existe (FR-067) mais n'est rattaché à AUCUN inventaire d'effacement.**
  Même statut que `tirage` en 5.7 : la policy est là, le moteur unique d'effacement (AD-14) est
  l'Epic 6, et c'est lui qui devra énumérer `lecture` — sans quoi une lecture survivrait à une
  demande de suppression. [supabase/migrations/0051_lecture.sql, → 6-7]

- **La conformité du TEXTE GÉNÉRÉ n'est pas prouvable par un test statique**, et la frontière est la
  même que pour le bilan (2.9) et la synthèse (4.9) : la consigne porte les interdits AU RUNTIME
  (aucune prédiction FR-020, ne jamais nommer la carte, aucun lexique clinique), le contrôle bloquant
  ne scanne que les libellés STATIQUES. Une lecture qui prédit passerait. [lib/domain/consigne-lecture.ts]

- **LES 23 VISUELS MANQUANTS SONT DÉSORMAIS VISIBLES À L'ÉCRAN.** Jusqu'ici `CarteTiree` était livré
  isolé, monté nulle part : l'absence honnête n'était vue par personne. Le rituel la montre. Sur 24
  tirages, 23 rendent « Le visuel de cette carte n'est pas encore dessiné. » — c'est honnête, et ce
  n'est pas publiable. La commande d'art est bloquée par la Q1 (les noms) chez Anima.
  [render/lecture/visuels.ts, → porte avant publication]

- **Le catalogue de sens reste DÉBRANCHÉ**, derrière une couture unique (`consigneLecture()`), en
  attente de la Q2 d'Anima. Les trois issues sont sans dette : « note privée » et « garde-fou »
  ajoutent un paramètre à cette seule signature ; « suppression » retire `lib/lecture/sens-cartes.ts`
  sans toucher au reste. [lib/domain/consigne-lecture.ts, → Anima]


## Story 5.9 — l'ancrage, l'exercice guidé premium (2026-08-14)

- **La variante AUDIO est déférée en v1.1**, et rien ne l'amorce : aucun `<audio>`, aucun bouton
  inerte, aucune mention d'une version à venir dans la copie. Le report est une décision de périmètre
  (AC7), pas une dette technique — le texte se suffit. Ce qu'il faudra alors trancher : où vivent les
  fichiers (Supabase Storage sous RLS ? le corpus ne sait porter que du texte), et si c'est la voix
  d'Anima qui enregistre — auquel cas FR-086 s'applique au son comme il s'applique au texte.
  [→ v1.1]

- **Aucune trace n'est écrite, et c'est un choix reconductible mais pas gratuit.** L'ancrage ne
  persiste ni ouverture, ni progression, ni achèvement : rien à retenir (AD-14), rien à effacer
  (FR-067), rien à métrer (3.4). Le jour où quelqu'un demandera « reprendre où j'en étais » ou
  « combien de fois je l'ai traversé », ce sera une table art. 9 de plus **et** une entrée dans
  l'inventaire d'effacement de l'Epic 6. À décider les yeux ouverts, pas par glissement.
  [lib/data/lire-ancrage.ts]

- **`/ancrages` n'est atteignable que par URL** — comme `/lectures`, `/synthese` et `/enneagramme`.
  Le menu de compte reste à construire. ⚠️ **Et il ne faut PAS y ajouter les ancrages avant qu'un
  ancrage soit complet** : une entrée de menu qui mène systématiquement à « Anima n'a pas encore
  écrit d'ancrage » se lit comme une panne, alors que la même phrase atteinte par URL se lit comme un
  état. [→ menu de compte]

- **L'ancrage N'EST PAS une carte de la bibliothèque, et c'est un refus de conception** (D1). La
  mécanique existait pourtant gratuitement (`cartesDisponibles` + le terme premium du glossaire) — on
  ne l'a pas prise, parce qu'une `CarteVue` est une vignette de texte statique et qu'un ancrage rendu
  ainsi serait, à l'écran, exactement le format court dont FR-080 exige qu'il reste distinct. Si
  quelqu'un rouvre ce choix, c'est ce raisonnement qu'il faut réfuter, pas le plafond de six cartes.
  [lib/domain/bibliotheque.ts — le catalogue reste à 5]

- **Écart assumé au document d'epic** : les epics listent AD-3 (« via `AiPort` ») sur cette story. Le
  critère d'acceptation dit l'inverse — « déroulé pas à pas **depuis le corpus d'Anima** ». Aucun
  appel modèle n'a donc été câblé. Si l'ancrage devait un jour se générer, ce serait une story à part
  entière, et elle se heurterait d'abord à FR-054 + FR-086.

- **24 créneaux de plus chez Anima** (4 ancrages × 1 titre + 5 temps), fiche
  `corpus-ancrages-a-ecrire.md`, et **une question qui précède l'écriture** (Q6 : combien d'ancrages,
  et sous quels noms). Total du corpus déclaré : **213 créneaux, 0 écrit**. [→ Anima]

- **Le mutant M18 était ÉQUIVALENT, et il est documenté plutôt que masqué** : boucler la progression
  sur `% (total + 1)` produit exactement la même suite d'indices, puisqu'on ne peut pas cliquer
  au-delà du dernier temps (il n'y a plus de bouton). Remplacé par M18b (`% total`), qui fait
  réellement recommencer l'exercice et meurt. La distinction compte : un survivant équivalent n'est
  pas un trou de test.

---

**Fragilité de suite observée, non corrigée** : les fichiers de tests SQL frappent le même Postgres local
en parallèle. Sous forte contention (typiquement pendant une campagne de mutation, qui remplace des
fonctions sur cette même base), un fichier peut échouer de façon transitoire. Quatre passes complètes
consécutives sont propres hors campagne. Si ça devient gênant, la réponse est un schéma par worker, pas
un `retry`.

**Observation renforcée en 5.7** : après une campagne de mutation SQL, la passe complète a rendu CINQ
fichiers rouges d'un coup (`branche-cycle-sql`, `episode-detresse`, `tirage-sql`, `theme-natal-sql`,
`webhook-robustesse-sql`), avec des durées de 27 à 76 secondes. Les cinq passent seuls, et la passe
complète est verte après un `supabase db reset`. La cause n'est donc pas la contention seule : une
campagne laisse derrière elle des dizaines de comptes de fixtures, et c'est leur accumulation qui fait
basculer la contention en échec. **Conséquence pratique : `db reset` AVANT la passe de clôture, pas
après.** Et ne jamais lire un rouge de fin de campagne comme un verdict sur le code sans avoir refait
la passe sur une base propre.

---

## Ordonnanceur — ce que l'analyse du 14/08/2026 a trouvé et que la Story 6.1 NE traite PAS

Vingt-trois pièges ont été relevés en préparant la 6.1 (analyse adversariale, six sondes + trois angles
de piégeage). Douze sont devenus les tâches T1→T12 de la story. Les suivants sont réels, vérifiés, et
**délibérément hors périmètre** — ils ne mordent que sous des conditions que la 6.1 ne crée pas.

⚠️ **Tous deviennent actifs le jour où un job forge une clé de fenêtre plus fine que la journée** (ce
que la 6.2 devra faire pour servir « 8 h locales »). À relire **avant** d'écrire la 6.2, pas après.

- **Le seuil du disjoncteur est écrit DEUX FOIS et compte des LIGNES, pas des JOURS.**
  `personnes_en_echec_repete` (`0031:108-131`) compte `count(*) >= p_seuil` sur sept jours **sans
  dédoublonnage par jour**, et `utilisatrices_a_synthetiser` (`0033:69-73`) **recopie** la règle avec
  un `3` en dur au lieu d'appeler la fonction. Sous plusieurs exécutions par jour, « trois échecs en
  sept jours » devient « trois échecs en vingt minutes » : une panne fournisseur d'un quart d'heure
  écarte une personne pour une semaine — et l'incident levé est `job_echoue`, qui **ne dégrade pas** la
  sonde publique. Le produit cesserait de produire des synthèses pendant sept jours avec un signal
  vert. ⚠️ Muter l'une des deux expressions laisse l'autre rattraper le résultat : c'est exactement le
  défaut que l'en-tête de 0033 dit avoir corrigé pour le TRI, et qui subsiste sur le SEUIL.
  [supabase/migrations/0031, 0033]

- **Le rappel d'échéance ne rattrape rien avec des ticks supplémentaires.** `rappels_echeance_dus`
  (`0036:625-641`) n'a aucune clause excluant les personnes déjà notifiées aujourd'hui, et sa rotation
  d'équité (`order by md5(… || la date du jour)`) est **invariante sur la journée**. Avec 25 échéances
  dues et `LOT_PAR_TICK = 10`, le tick 2 resélectionne exactement les mêmes dix, `reserverNotification`
  les refuse une à une, et les quinze autres ne sont **jamais** lues. Aggravant : `rappel_lot_sature`
  serait journalisé à chaque tick, transformant le seul signal d'alerte en bruit permanent.
  [supabase/migrations/0036, lib/ordonnanceur/jobs/rappel-echeance.ts:51]

- **`environnementDeclare` a un repli sur l'ERREUR, aucun sur le SILENCE.** `depot:37-41` rend `null`
  sur `error` — d'où `base_muette` et un 409 propre. Mais si l'appel **pend**, la lambda meurt avant le
  premier job : aucune ligne écrite, aucun incident, et l'homme mort ne parlera qu'au bout de 48 h.
  **La T10 de la 6.1 borne cet appel**, ce qui referme le cas ; ce paragraphe reste pour mémoire du
  raisonnement. [lib/data/depot-ordonnanceur.ts:37-41]

- **L'ordre du registre n'est garanti qu'à l'intérieur d'une invocation.** `executer.ts` est une boucle
  séquentielle **sans aucun verrou au niveau du registre** — la seule protection est par job. Deux
  invocations qui se chevauchent peuvent donc exécuter le job N+1 de l'une pendant le job N de l'autre,
  et l'arbitrage du plafond par famille (« la synthèse passe avant le rappel, **toujours**, pas
  parfois ») devient une course. La T7 de la 6.1 rend le chevauchement **impossible par construction**
  (`intervalle >= BUDGET_TICK_MS + marge`) ; si cette assertion venait à être relâchée, le défaut
  redevient actif et il faudrait une réclamation de niveau registre. [lib/ordonnanceur/executer.ts:59-125]

### Une observation de méthode, qui vaut au-delà de l'ordonnanceur

Le défaut le plus coûteux du lot n'était pas un bug mais une **garde ancrée sur une migration morte** :
`tests/ordonnanceur-architecture.test.ts:210-213` vérifie la couture registre ↔ SQL en lisant
`0028_sante_homme_mort.sql`, alors que **trois** migrations définissent `sante_ordonnanceur_publique`
et que c'est `0031` qui gagne. Les migrations étant immuables et forward-only, 0028 contiendra la
chaîne attendue **pour toujours** : la garde ne peut plus rougir, quoi qu'on fasse à la fonction
vivante.

**La leçon est générale et n'est pas encore appliquée partout : toute garde qui lit une migration par
son NUMÉRO est périssable.** Elle doit viser la définition courante — parcourir les migrations, retenir
celles qui définissent l'objet, prendre la plus haute. La T6 de la 6.1 le fait pour la sonde de santé.

**Le dépôt compte 16 endroits qui lisent une migration par son numéro** (relevé le 14/08/2026,
`tests/*.test.ts`) :

```
arc-architecture:79 (0012) · annonce-socle-sql:279,284 (0040, 0045) · branche-cycle-sql:113,247 (0025, 0026)
branche-correctifs:372 (0023) · enneagramme-sql:389 (0049) · gardes-dans-la-policy:441 (0041)
ordonnanceur-architecture:210 (0028) ⚠️ · pipeline-securite-architecture:84,85 (0010, 0011)
ordonnanceur-sql:400 (0027) · resiliation-remboursement-sql:205 (0038) · synthese-domaine:249 (0029)
theme-natal-sql:629 (0039) · tirage-sql:149 (0050)
```

⚠️ **Tous ne sont pas des défauts, et il ne faut pas les « corriger » en masse.** Lire une migration
par son numéro est légitime quand la garde atteste d'un **fait historique** (« la 0041 a bien posé la
clause dans la policy »). Le défaut naît quand la garde prétend vérifier une **propriété vivante** et
lit une définition depuis remplacée — le cas de `ordonnanceur-architecture:210`. Chaque site demande
donc le même examen : *l'objet lu a-t-il été redéfini par une migration ultérieure ?* Non audité.

---

## Le jeu est passé de 24 à 21 cartes — LIVRÉ (Story 5.10, 15/08/2026)

*Consigné le 14/08 après le brief `ANIMA-A57H`, arbitré à 23 le 15/08 au matin, **rectifié à 21 et
livré le 15/08 au soir**. Cette section garde les trois états parce que la rectification est la
partie utile.*

**Ce qui est en place.** Six cartes retirées sur sa demande explicite (`puits`, `corde`, `fontaine`,
`nid`, `metier-a-tisser`, `orage`) ; trois ajoutées : `fleur` (son emblème), `oiseau` (sa coche
« un oiseau, un vol » — rien ne volait dans le jeu), `seuil` (**de notre main**, à lui faire
arbitrer). Aucune migration SQL : vérifié deux fois, aucune migration ne nomme une clé de carte.

**LA FAUTE, ET POURQUOI ELLE VAUT D'ÊTRE GARDÉE ÉCRITE.** L'arbitrage du matin ajoutait quatre
cartes — `une porte`, `un seuil`, `un chemin`, `un oiseau` — décrites comme « les images qu'elle a
elle-même nommées dans le brief ». Le JSON brut du brief dit autre chose :

```
question  visuel-symboles-oui   type: "multi"     (dix options)
options[3]  value "seuil"   label "Une porte, un seuil, un chemin"
options[5]  value "oiseau"  label "Un oiseau, un vol"
réponse : { "value": ["seuil", "oiseau"], "by": "sanela" }
```

Deux coches. « Une porte, un seuil, un chemin » est **le libellé d'une case, écrit par le
questionnaire** — trois quasi-synonymes offerts ensemble pour qu'une seule coche désigne la famille.
Le lire comme trois propositions, c'est faire dire à une réponse le contenu de la question.

Et le jeu contenait déjà `porte-entrouverte` et `sentier`. On allait livrer **deux portes et deux
chemins**, 8 cartes sur 23 sur le seul thème du passage, et deux visuels quasi identiques dans une
commande d'art de 69 objets. **Aucun test du dépôt ne l'aurait vu.**

**Règle à en tirer, plus large que le jeu :** quand une décision produit cite « ses mots », aller
lire la forme BRUTE de la réponse. Un rendu markdown aplatit un QCM en une phrase, et une phrase
aplatie se relit comme une liste.

**Ce que la story a construit en réponse** (`tests/jeu-proprietaire.test.ts`) :

- **détecteur mécanique** — les mots d'une clé ne peuvent pas être tous contenus dans une autre
  (`porte` ⊆ `porte entrouverte`). Comparaison par MOTS, jamais par sous-chaîne brute : `or` est une
  sous-chaîne de `horizon`, et un détecteur qui mordrait là finirait désactivé ;
- **détecteur déclaré** — 13 familles de synonymes qu'aucune paire de cartes ne peut toucher
  ensemble. `chemin`/`sentier` n'est pas mécaniquement détectable. La table est **incomplète par
  construction** : elle enregistre les rapprochements réellement rencontrés, et grandit à chaque
  quasi-collision ;
- **garde d'orphelin** — la garde INVERSE du manifeste : chaque fichier de `public/jeu/` doit être
  une carte du jeu. Sans elle, `puits.webp` serait resté servi publiquement pour une carte retirée.
  Il vit désormais dans `images/reference-jeu/`, hors de `public/`, comme unique référence de style.

**Ce qui N'A PAS bougé, et ne doit pas être « réparé » :**

- les bornes **3, 24 et 40** de `tests/tirage-alea.test.ts` — ce sont des bornes d'essai CHOISIES, et
  le fichier documente qu'emprunter la borne à `TAILLE_JEU` rendrait la garde otage du jeu ;
- `TAILLE_JEU`, dérivé de `JEU.length` : la story a changé la taille du jeu **sans toucher une seule
  ligne de production hors de `jeu.ts`** ;
- les lignes de `tirage` déjà en base portant une carte retirée. Elles restent valides et rejouables
  — `taille_jeu` est journalisée par ligne (0050), et la 5.10 est **la première story à exercer pour
  de vrai** la raison d'être de cette colonne. `tests/depot-lecture.test.ts` et
  `tests/lecture-frontiere.test.ts` gardent délibérément `puits` / `tailleJeu: 24` pour ça.

**Résidu assumé.** Un doublon de tirage passe d'une fois sur 24 à une fois sur 21. C'est le seul
argument de la 5.7 qui s'affaiblit. L'unicité de `lecture.tirage_id` et l'index partiel de 0051
continuent d'empêcher de tirer dix fois pour choisir la carte qui plaît.

**Arbitrage restant pour Anima :** garde-t-on `seuil` ? Si non, 20 cartes et rien d'autre ne bouge.

## Deux commentaires portaient une arithmétique FAUSSE dans le fichier dont c'est le seul sujet

*Trouvé pendant la Story 5.10.*

`lib/tirage/alea.ts` affirmait `2**32 = 178 956 970 × 24 + 8`, « donc les 8 premiers indices ont une
chance de plus que les 16 autres ». Les deux chiffres étaient faux et le sens inversé : le reste vaut
**16**, et ce sont 16 indices qui sont favorisés. L'écart relatif annoncé (`1,4 · 10⁻⁸`) était faux
dans les deux fichiers : il vaut `1 / 178 956 970 ≈ 5,6 · 10⁻⁹`.

C'était le commentaire qui porte **toute la justification de l'échantillonnage par rejet**, et
personne ne l'a vu pendant un mois **parce que les commentaires ne s'exécutent pas**.

Correctif : un §0 dans `tests/tirage-alea.test.ts` qui **exécute les nombres cités**
(`2**32 % 21 === 4`, `2**32 % 24 === 16`, `2**32 % 32 === 0`, et les trois limites de rejet). Un
commentaire asservi à un test ne dérive plus en silence. **Patron réutilisable** partout où un
commentaire porte un calcul load-bearing.

## LE HARNAIS DE MUTATION MENT DANS LES DEUX SENS — deuxième leçon, symétrique de la 6.1a

*Trouvé pendant la Story 5.10.*

En 6.1a, le harnais SQL comptait **tout rouge pour un mort** : sept mutants avaient été déclarés tués
par des `502` de redémarrage de conteneurs. La 5.10 a trouvé l'erreur miroir, plus perfide.

Un mutant qui **ne compile pas** fait imprimer à vitest :

```
Error: Transform failed with 1 error
 Test Files  5 failed | 1 passed (6)
      Tests  38 passed (38)
```

Il n'y a **aucune** ligne `Tests N failed` — il n'y a pas de test en échec, il y a des fichiers qui
n'ont pas pu être chargés. Un harnais qui lit la ligne `Tests` seule conclut **SURVIT**, c'est-à-dire
**accuse la garde alors que le mutant n'a jamais tourné**. C'est pire qu'un faux mort : un faux mort
rassure à tort, un faux survivant envoie réécrire une garde qui allait bien.

Le mutant en question (`M13`, une 22ᵉ carte) était en fait **tué par quatre fichiers nommés** — la
vérification isolée l'a montré.

**Deux règles pour tout harnais de mutation de ce dépôt :**

1. **Trois issues, jamais deux.** `TUÉ` exige une ligne `Tests N failed`. `SURVIT` exige une ligne
   `Test Files` SANS `failed`. Tout le reste est un **NON-VERDICT** et doit se dire comme tel.
2. **Le heredoc ajoute un saut de ligne final** au texte de remplacement. Quand le motif n'est pas en
   fin de ligne, ce saut atterrit au milieu d'une expression et rend le mutant incompilable — c'est
   exactement ce qui a produit le faux survivant. `apres = a[1].rstrip("\n")`.

Un troisième mutant (`M12`) était **mal posé** et a été gardé comme tel dans le décompte : retirer
une assertion d'un test ne peut être attrapé par aucune autre — les assertions ne se contrôlent pas
entre elles. Le mutant bien posé pour une assertion porte sur son SUJET, pas sur elle.

## L'outil d'écriture du corpus existe déjà — ne pas en construire un second

Anima a répondu, sur la forme de livraison des 189 textes : *« Une seule à la fois, comme ce
questionnaire. »* Le questionnaire en question est celui qui a produit `anima-brief-ANIMA-A57H` —
elle y a répondu 42 fois, sans accompagnement. **C'est la spécification, et l'implémentation est
déjà debout.** Toute fiche `corpus-*-a-ecrire.md` en tableau ou en document long va contre sa
réponse explicite.

Deux propriétés du questionnaire à reprendre, parce qu'elles ont visiblement marché : chaque question
porte un `help` (comment répondre) **et** un `why` (à quoi la réponse sert dans le produit), et rien
n'est obligatoire — elle a laissé 32 questions sans réponse sans que ça bloque quoi que ce soit.

## Mutant équivalent documenté — la borne du jour-de-semaine du parseur cron (Story 6.1)

*Relevé le 15/08/2026, campagne de mutation de la 6.1.*

Dans `tests/ordonnanceur-architecture.test.ts`, `champsCron` borne le champ jour-de-semaine à
`[0, 7]` — sémantique Vixie, où dimanche s'écrit `0` **ou** `7`. **Ramener cette borne à 6 ne fait
rougir aucun test.**

Ce n'est pas une garde manquante, c'est une **équivalence** : `max` ne sert qu'à l'expansion de `*` et
de `*/n`. Un littéral explicite (`* * * * 7`) fixe `debut = fin = Number("7")` et ne consulte jamais la
borne ; et pour `*`, la normalisation `7 → 0` replie la valeur, donc les deux bornes rendent le même
ensemble. Il n'existe donc aucune expression cron que les deux versions traitent différemment.

**Ce qui porte réellement la propriété, et qui est bien gardé :** la normalisation `i === 4 && v === 7
? 0 : v`. La retirer tue le test `intervalleMinimalDuCron("30 3 * * 7") === 604_800`, vérifié.

Conservé à 7 pour dire honnêtement ce que le champ accepte — pas parce qu'une garde en dépend. À ne
pas « corriger » : il n'y a rien à corriger, et écrire un test qui distinguerait les deux versions
exigerait d'inventer une expression que le parseur ne rencontrera jamais.

## Mutant équivalent documenté — `=` vs `is not distinct from` sur le jeton (Story 6.1a)

*Relevé le 15/08/2026, campagne de mutation de la 6.1a.*

Dans `supabase/migrations/0052`, `clore_execution` compare le jeton avec `and jeton = p_jeton`.
**Remplacer `=` par `is not distinct from` ne fait rougir aucun test.**

C'est une **équivalence**, et elle a une cause précise : la colonne `jeton` est `not null`. Les deux
opérateurs ne divergent que si les deux côtés sont `null` — or le côté ligne ne peut pas l'être, et le
côté appelant (`p_jeton is null`) donne `false` dans les deux écritures. Il n'existe donc aucun appel
que les deux versions traitent différemment.

**Ce qui porte réellement la propriété, et qui est bien gardé :** le `not null` de la colonne. Le
retirer tue le test `[ÉCHOUER FERMÉ]` (l'insertion directe d'un jeton vide doit être refusée),
vérifié — parce qu'à partir de là, une ligne à jeton vide s'accorderait avec un appelant sans jeton.

⚠️ **À ne pas confondre avec le vrai danger**, qui n'est ni l'un ni l'autre : c'est le raccourci de
compatibilité `and (p_jeton is null or jeton = p_jeton)` qu'on écrit sans y penser le jour où un
appelant n'a pas de jeton. Celui-là ouvre une porte exactement de la taille de la garde, et il est
**muté et tué** (mutant S2). L'écriture `=` est conservée parce qu'elle échoue fermé par construction
— la règle du dépôt — et non parce qu'un test la distingue de sa jumelle.

## Le socle quotidien sert au plus vingt personnes par heure (Story 6.2)

*Relevé le 15/08/2026, en livrant la 6.2. Assumé, mesuré, journalisé — pas une lacune cachée.*

`LOT_PAR_TICK = 20` dans `lib/ordonnanceur/jobs/socle-quotidien.ts`, et le socle n'a qu'un tick par
heure une fois le palier passé à `pro`. **Le produit peut donc servir au plus vingt personnes à huit
heures du matin** — et huit heures est l'heure par défaut, donc celle que la plupart garderont.

Ce n'est pas un problème aujourd'hui (zéro utilisatrice) et c'en sera un tôt. Deux choses évitent que
ça se dégrade en silence :

- le lot saturé est journalisé (`socle_lot_sature`) — c'est le seul signal disponible AVANT que ça
  fasse mal ;
- la sélection **tourne** : `socle_quotidien_du` ordonne par `md5(uuid ‖ jour)`, donc l'ordre change
  chaque jour. Au-delà du lot, ce ne sont pas toujours les mêmes qui sont laissées de côté —
  contrairement à l'`order by utilisatrice_id` que la revue 4.10 avait qualifié d'*injustice stable*.

⚠️ **Le remède n'est PAS de monter ce nombre.** Le budget du tick ne suit pas : à quatre jobs, la chaîne
`Σ + margeHorsDelais(4) ≤ BUDGET_TICK_MS` ne laisse que 1 600 ms de mou. Le vrai remède est de pousser
par **lots** (une requête HTTP par service de poussée plutôt que par appareil), et c'est une story.

## La poussée sans charge utile a une date de péremption, et elle est gardée (Story 6.2)

*Relevé le 15/08/2026. Ce n'est pas une dette au sens ordinaire : c'est une décision qui expire, et la
CI le dira.*

Décision D1 de la 6.2 : le POST vers le service de poussée fait **zéro octet**. Tant que
`MOTIFS_POUSSEE` n'a qu'un membre, le service worker sait quoi afficher sans qu'on le lui dise.

Au **deuxième** motif — Story 6.3, « Anam rare et spécifique » — il ne le saura plus, et la notification
d'Anam afficherait silencieusement le texte du socle. Personne ne s'en apercevrait : les deux sont
plausibles sur un écran verrouillé.

`tests/poussee-architecture.test.ts` rougit à l'instant où un second motif apparaît. **Le remède n'est
pas de supprimer ce test**, c'est l'un des deux :

1. chiffrer une charge utile minimale (RFC 8291 : ECDH P-256, HKDF, AES-128-GCM) portant le **motif** et
   rien d'autre — `p256dh` et `auth` sont déjà stockés pour ça, et c'est la seule raison de les stocker ;
2. ou faire lire au service worker, à la réception, un motif servi par une route de session.

Dans les deux cas la propriété structurelle tient : aucun paramètre de texte libre nulle part.

## Trois vérifications de la 6.2 qu'aucun test ne peut faire

*Relevé le 15/08/2026. À faire sur un vrai appareil, avant publication.*

1. **Le privacy-cover arrive-t-il avant la photo ?** jsdom ne peint pas. Le test prouve que l'attribut
   est posé de façon **synchrone** — la seule chose qui rende la course gagnable — mais la course
   elle-même se constate sur un iPhone, en passant l'app en arrière-plan.
2. **Une vraie poussée arrive-t-elle ?** Aucune clé VAPID n'existe encore, et la fabrique refuse de
   construire l'adaptateur réel sous Vitest. Le JWT est vérifié cryptographiquement contre sa propre clé
   publique ; le reste demande un appareil et trois variables d'environnement
   (`VAPID_CLE_PUBLIQUE`, `VAPID_CLE_PRIVEE`, `VAPID_SUJET`).
3. **Le manifeste s'installe-t-il sur iOS ?** Les icônes existent et sont référencées (192, 512,
   apple-touch 180). L'installation elle-même se constate — et sans elle, iOS ne pousse rien du tout.

## Mutant survivant documenté — le `WITH CHECK` de l'UPDATE sur `preference_socle` (Story 6.2)

*Relevé le 15/08/2026, campagne de mutation de la 6.2 (mutant S7). **Survivant**, pas équivalent — et la
distinction est le sujet.*

Dans `supabase/migrations/0053`, la policy `preference_socle_proprietaire_maj` porte
`with check (auth.uid() = utilisatrice_id)`. **La remplacer par `with check (true)` ne fait rougir aucun
test**, et la propriété visée — « elle ne peut pas réattribuer sa préférence à quelqu'un d'autre » — reste
pourtant vraie.

**Ce qui porte réellement le refus aujourd'hui**, établi par trois sondes successives :

| Policy de SELECT | `WITH CHECK` de l'UPDATE | La ligne change-t-elle de propriétaire ? |
|---|---|---|
| `auth.uid() = utilisatrice_id` | `auth.uid() = utilisatrice_id` | non — `42501` |
| `auth.uid() = utilisatrice_id` | `true` | **non — `42501`** |
| `auth.uid() = utilisatrice_id` | `true`, + INSERT à `true` | non — `42501` |
| `true` | `true` | **OUI, la ligne passe à l'autre** |

C'est donc la **policy de SELECT, appliquée à la NOUVELLE ligne**, qui refuse : la ligne relue après
écriture appartiendrait à quelqu'un d'autre, donc l'appelante ne la voit pas, donc Postgres annule.

C'est **le piège des défenses redondantes** du dépôt, à l'état pur : deux gardes couvrent le même
scénario, donc muter l'une laisse l'autre tenir, donc le mutant survit. La règle du dépôt dit de muter
chacune séparément — et la mutation de la policy de SELECT, elle, est bien tuée (par les tests de lecture
cloisonnée).

⚠️ **Le `with check` est CONSERVÉ malgré sa redondance apparente**, et ce n'est pas de la
ceinture-bretelles décorative. Sans lui, la propriété reposerait sur le fait que **le client relit la
ligne après écriture** — un comportement de bibliothèque, pas une garantie de la base. Un appelant qui
écrirait sans relire (`Prefer: return=minimal`, un `UPDATE` en SQL direct, un futur adaptateur) ferait
disparaître la seule garde restante sans qu'un seul test bouge.

⚠️ **Et un second enseignement, sur l'outillage :** ce mutant a d'abord été compté TUÉ par mon script de
rejeu, parce que ce script acceptait *n'importe quel* rouge comme un verdict de test. C'est exactement la
faute des sept faux morts de la 6.1a, retournée : là-bas un vrai mutant passait pour mort à cause d'un
502 ; ici un survivant passait pour mort à cause d'un rouge transitoire. **Un mutant n'est tué que par un
test NOMMÉ** — le rejeu isolé, qui affiche quel test échoue, a rendu le bon verdict.

---

## Story 6.3 — ce qu'elle laisse derrière elle

### 1. ⚠️ L'accueil est AU PLAFOND d'UX-DR-30 : six objets rendus sur six

La borne « 4 à 6 objets » était mesurée sur `CATALOGUE_CARTES.length` (cinq) pendant que l'écran en
rendait déjà six. Une sixième carte de catalogue serait donc passée avec un build vert et **sept**
objets à l'écran. `tests/rendu/carte-anam.test.tsx` compte désormais les `<article>` rendus.

**Conséquence à connaître avant d'ouvrir une story de carte** : la prochaine carte de catalogue fera
rougir cette garde. Il faudra alors **retirer quelque chose**, pas relever la borne — UX-DR-30 dit
« 4 à 6 maximum », et la carte d'Anam est celle qui a le moins de raisons de partir (elle est la
seule à ne rien exiger d'Anima).

### 2. L'AC6 promettait « la branche concernée » — c'était impossible (D10)

`signal_reconceptualisation` (0020) ne référence qu'une `entree_journal_id` : **il n'y a pas de
branche à nommer** au moment de la proposition, puisqu'elle consiste précisément à en ouvrir une. La
seule chose nommable de ce côté serait son verbatim de journal, que la 4.5 refuse de faire traverser.
L'AC est amendée dans la story, et chaque motif est spécifique de la façon dont il PEUT l'être.

**Le jour où une branche existera au moment du signal** (si un futur modèle de données l'attache), la
ligne pourra la nommer et il faudra revenir ici.

### 3. `synthese_prete` peut se répéter jusqu'à trois jours sur la carte

Il n'existe **aucune notion de « lue »** en base : la table `synthese` (0029) n'a pas de colonne
`lu_le`. La carte reprend donc la fenêtre du canal sortant (`syntheses_non_annoncees(_, 3)`) et
réaffiche la même ligne tant que la synthèse a moins de trois jours. Le correctif est une colonne,
donc une migration — **décision suivante, pas celle-ci**, et surtout pas un compteur côté client.

### 4. `service_role` peut appeler `motifs_anam_du()` — et c'est sans effet

J'avais d'abord mesuré `permission denied` et conclu que le grant fermait la porte. **C'est faux** :
`charger_proposition_branche`, le modèle de cette fonction, répond exactement pareil — pas d'erreur,
zéro ligne. La mesure d'origine portait sur un état antérieur au `db reset`.

Ce qui ferme la porte est `security invoker` + `auth.uid()` : **sans session, la clause de propriété
ne peut matcher personne**. La propriété est plus forte que celle annoncée, et elle est écrite en
test — aucun job d'ordonnanceur ne pourra se servir de cette fonction pour décider d'un envoi, quel
que soit le grant qu'on lui donnera un jour.

### 5. Le créneau du soir ne mord pas encore, et c'est normal

Le cron est quotidien (`0 6 * * *`, soit 07 h/08 h Paris) : aucune émission ne peut tomber le soir
aujourd'hui. La garde ne mordra pour de bon que **sous le cron horaire du palier `pro`** (porte de
publication §2). Elle est posée maintenant parce qu'elle est bon marché maintenant et qu'elle sera
oubliée le jour où le palier changera.

### 6. Un mutant survivant, assumé et documenté

`ligneAnam` porte `if (!p) return null;` après un `find`. Ce n'est **pas une garde** : `gagnant` sort
de `motifPrioritaire(presents.map(…))`, donc il vient forcément de `presents`, donc `find` ne peut pas
échouer. Aucun mutant ne peut le tuer — il est là parce que TypeScript exige qu'on traite le
`undefined` de `find`, et le supprimer demanderait un `!`, qui mentirait davantage. Écrit dans le
fichier pour que personne ne lui cherche un test.

### 7. Deux tests nés de mutants survivants

- **Le fil entre le dépôt et la carte n'était prouvé nulle part.** Remplacer `carteAnam(await
  motifsEnVol)` par `carteAnam([])` — donc rendre la carte définitivement muette — laissait TOUTE la
  suite verte. Le domaine était prouvé, le rendu était prouvé, la couture ne l'était pas.
- **`depot-motifs-anam.ts` n'avait aucun test.** Aplatir `null` en chaîne vide faisait sauter le
  fail-closed d'`ligneAnam` sans qu'aucune de ses gardes ne rougisse — elles reçoivent ce que le
  dépôt leur donne.

Les deux ont maintenant leur fichier. C'est la même leçon que la 4.10 : **les gardes de chaque couche
peuvent toutes être vertes pendant que le passage de l'une à l'autre est cassé.**
