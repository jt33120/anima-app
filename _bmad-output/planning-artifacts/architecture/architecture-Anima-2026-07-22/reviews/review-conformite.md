---
title: "Revue conformité & sécurité (adversariale) — ARCHITECTURE-SPINE Anam"
cible: _bmad-output/planning-artifacts/architecture/architecture-Anima-2026-07-22/ARCHITECTURE-SPINE.md
contexte: _bmad-output/planning-artifacts/prds/prd-Anima-2026-07-21/prd.md (NFR-001..023, §5)
posture: adversaire — distingue ce qui est ÉNONCÉ de ce qui est GARANTI par un invariant applicable
date: 2026-07-22
---

# Revue conformité & sécurité — Anam (spine v1)

## Verdict

La spine **nomme** les bonnes frontières (art.9 AD-4, ZDR, RLS, immuabilité avec exception d'effacement, pas de paywall sur la sécurité, détresse au modèle le plus capable), mais **plusieurs garanties critiques restent déclaratives** (murs de prose non adossés à un invariant vérifiable ou à un mécanisme propriétaire) et **la spine se contredit sur la frontière US** — donc **non expédiable en l'état sur données art.9 sans durcissement**.

Grille : **CRITIQUE** (garantie absente ET exposition légale/sécurité directe) · **ÉLEVÉ** · **MOYEN** · **FAIBLE**.

Méthode : pour chaque manque — ce qui est *énoncé*, pourquoi ce n'est pas *garanti*, l'AD/convention manquante proposée.

---

## CRITIQUE

### C1 — L'isolation RLS est défaite par le chemin serveur lui-même (service_role)
- **Énoncé :** « isolation = RLS par utilisatrice (NFR-001) » ; « Mutations uniquement via route handlers serveur » ; AD-4 « Isolation RLS Postgres par utilisatrice ».
- **Pas garanti :** aucun invariant ne dit **sous quelle identité** la base est interrogée. Le motif « toutes les mutations passent par le serveur » est précisément celui qui, en Next.js + Supabase, pousse à utiliser la **clé `service_role`** — laquelle **contourne intégralement la RLS**. L'isolation retombe alors sur la correction manuelle de chaque `WHERE user_id = …` ; un filtre oublié = fuite art.9 inter-locataires. NFR-001 n'est donc **pas** garanti par un invariant, seulement affirmé.
- **Manquant → AD proposée :** « **Chemin base lié à l'utilisatrice.** Sur le chemin art.9, tout accès base s'exécute sous l'identité de l'utilisatrice (JWT → `auth.uid()`, RLS active). `service_role` / tout contournement RLS **interdit** hors opérations d'admin étroites, auditées, ne touchant jamais du contenu art.9. **Toute table art.9 ship avec RLS `deny-by-default` ; une table sans politique est un défaut de build (test CI).** »

### C2 — Contradiction interne : la « bascule Opus » (US) sur le chemin art.9, précisément pour la détresse
- **Énoncé :** AD-4 « **OpenRouter et tout intermédiaire US sont interdits sur le chemin art.9** ». Mais AD-3 « bascule **Opus** possible sans toucher l'applicatif » et AD-5 « la détection de détresse utilise TOUJOURS **le modèle le plus capable disponible** » (= le tier fort).
- **Pas garanti :** Opus = Anthropic = fournisseur **US**. Le tier fort (reconceptualisation, synthèse) **et surtout la détresse** — le moment art.9 le plus aggravé — seraient routés vers le modèle le plus capable, potentiellement **hors UE**, en **violation directe d'AD-4**. La spine se contredit elle-même et est muette sur le mécanisme de transfert (NFR-019). L'échappatoire « plus capable » n'est **gardée par aucun invariant de juridiction**.
- **Manquant → AD proposée :** « **La frontière art.9 prime sur le tiering.** Chaque adaptateur `AiPort` porte une capacité *juridiction + DPA art.28 + ZDR*. Sur le chemin art.9, le port **ne lie que des adaptateurs UE éligibles** ; la résolution de tier (AD-5) choisit **uniquement parmi les adaptateurs art.9-éligibles**. Un fournisseur US n'est admissible que derrière un mécanisme de transfert valide explicitement acté — jamais par simple "bascule sans toucher l'applicatif". »

### C3 — Aucune porte de consentement : rien n'empêche un écrit art.9 avant le consentement (FR-072)
- **Énoncé :** FR-072 « Aucune donnée sensible n'est collectée avant le consentement » ; AD-9 rend le consentement *accessible* ; l'entité `consentement` existe.
- **Pas garanti :** AD-9 garantit l'*accessibilité* et la *non-dépendance à la détection*, pas l'**ordre**. Aucun invariant ne **refuse l'écriture** art.9 tant qu'il n'existe pas de consentement valide pour l'utilisatrice. FR-072 n'est bindé à **aucun** AD (ni frontmatter, ni règle). Or c'est le cœur de l'art.9 : le consentement **précède** le traitement.
- **Manquant → AD/convention proposée :** « **Write-gate consentement.** Tout dépôt sur une table art.9 vérifie l'existence d'un `consentement` art.9 valide et non révoqué pour l'utilisatrice ; sinon l'écriture est **rejetée** (garde technique, pas seulement UI). La **révocation** (FR-012) fait basculer l'utilisatrice en état "traitement art.9 suspendu". »

### C4 — Rétention et effacement temporisé : « appliqués automatiquement » sans moteur ni invariant propriétaire (NFR-021, FR-071)
- **Énoncé :** AD-4 « Conservation NFR-021 appliquée automatiquement » ; PRD : inactivité 24 mois → +3 mois → suppression ; fermeture → 30 jours ; **mineure détectée → suppression sous 30 jours** (FR-071).
- **Pas garanti :** **aucune AD ne possède** un moteur de rétention/expiration. « Automatiquement » est une propriété affirmée sans mécanisme, sans planificateur, sans propriétaire (la ligne « Notifications … à définir » est le seul planificateur évoqué, et il ne couvre pas la rétention). Pour des données art.9 et **des données de mineure**, l'absence d'effacement temporisé garanti est une non-conformité directe (art. 5-1-e, art. 17).
- **Manquant → AD proposée :** « **Moteur de rétention déterministe** (jobs planifiés idempotents) propriétaire dans `lib/…`, échéances 24m/3m/30j **paramétrées** (FR-079-style, jamais codées en dur), **journalisé** (sans contenu art.9). La suppression mineure/fermeture est une commande d'effacement (C-effacement, cf. E1), pas un flag. »

---

## ÉLEVÉ

### E1 — Périmètre d'effacement sous-spécifié ; caches et sauvegardes non purgés (FR-067)
- **Énoncé :** FR-067/AD-8 : la suppression « efface **branches, faits extraits et journal** » et se propage aux sous-traitants.
- **Pas garanti :** l'énumération **omet** des tables art.9 du modèle : `lecture` (verbatim — FR-021 « reprend les mots de l'utilisatrice »), `theme_natal`, `usage_ia`, `consentement`, résumé glissant (NFR-013). Aucun invariant « **toute ligne art.9 rattachée à l'utilisatrice est effacée** ». La propagation « aux sous-traitants » suppose ZDR (rien à effacer chez Mistral) mais **ne couvre ni les caches (NFR-020) ni les sauvegardes/PITR Supabase** (rétention de backup = donnée effacée qui survit). Droit à l'effacement vs sauvegardes immuables : non traité.
- **Manquant → convention :** « L'effacement est **exhaustif par utilisatrice** (registre des tables art.9 tenu à jour, test de couverture), **purge tous les caches** dérivés, et **documente/borne la fenêtre de sauvegarde** (crypto-shredding ou expiration PITR intégrée à la timeline d'effacement). »

### E2 — « Accès admin aux contenus interdit par défaut » (NFR-022) est un vœu, pas un invariant
- **Énoncé :** convention « accès admin aux contenus interdit par défaut, exception journalisée + notifiée » ; NFR-001 « chiffré au repos ».
- **Pas garanti :** le chiffrement au repos de Supabase est **au niveau disque** — il satisfait la lettre de NFR-001 mais **n'empêche aucun administrateur** projet (ou détenteur de `service_role`) de **lire le verbatim en clair** via l'éditeur SQL. « Interdit par défaut » n'a **aucun contrôle technique** derrière lui, et « exception journalisée » n'a **aucun propriétaire** (qui journalise un accès dashboard ? pas l'app). C'est un engagement, pas un invariant.
- **Manquant → AD proposée :** soit **aucun accès humain permanent à la prod** (break-glass audité), soit **chiffrement applicatif du contenu art.9 par utilisatrice** avec clés hors de portée de l'admin base — de sorte qu'un accès admin **ne rende jamais** de clair. Sans l'un des deux, NFR-022 reste déclaratif.

### E3 — Aucun verrou d'exfiltration côté client : NFR-002 (« zéro traceur tiers ») repose sur la discipline
- **Énoncé :** AD-4/NFR-002 « aucun traceur tiers sur conversation/lecture/arbre/mémoire/aide ».
- **Pas garanti :** rien n'**empêche** techniquement un script tiers de charger. Une dépendance transitive, un snippet analytics ajouté par mégarde, un pixel — et la garantie tombe. L'invariant d'application manquant est une **CSP** (`script-src`/`connect-src`/`img-src` en liste blanche stricte), jamais mentionnée dans la spine ; elle verrouillerait aussi les exfiltrations client et renforcerait C2.
- **Manquant → convention :** « **CSP restrictive** (self + origines explicitement autorisées) sur toutes les vues art.9 ; `connect-src` interdit toute origine hors backend Anam ; toute origine tierce est un défaut de build. »

### E4 — Chemin de sécurité sans fail-safe si le modèle fort est indisponible (AD-5)
- **Énoncé :** AD-5 « détresse = modèle le plus capable **disponible** … JAMAIS le léger, en aucune circonstance ».
- **Pas garanti :** le mot « disponible » est le point faible. Que se passe-t-il si le modèle fort est en panne/rate-limited ? La spine interdit le léger mais **ne définit aucun comportement de repli sûr**. Risque : dégradation silencieuse, ou échec qui laisse l'utilisatrice en détresse **sans filet** — alors que FR-077 exige un filet indépendant du classifieur.
- **Manquant → invariant :** « À défaut du modèle fort, le système **échoue vers la sécurité** : il n'analyse pas avec un modèle moindre, il **force l'affichage des haltes** (FR-077) et pose `limites_levees`. L'indisponibilité de sécurité est un incident journalisé. »

### E5 — Détection non instrumentée : faux négatifs détresse (FR-078) ET détection de minorité (FR-071)
- **Énoncé :** FR-078 « performance de détection mesurée, faux négatifs inclus » ; FR-071 détection de minorité → suspension.
- **Pas garanti :** **aucun invariant d'observabilité.** Aucun AD n'impose de journaliser chaque classification (niveau, issue) **sans art.9 en clair** pour permettre de mesurer le rappel contre le jeu validé. FR-078 n'est bindé nulle part. FR-071 est bindé à AD-9 dans les métadonnées **mais la règle d'AD-9 ne parle ni de minorité, ni de suspension, ni de suppression 30 j** — binding fantôme. La détection de minorité (classifieur, comme la détresse) n'est ni localisée (`lib/safety` ?) ni mesurée ; un faux négatif ici = donnée de mineure traitée.
- **Manquant → AD :** « Toute classification de sécurité (détresse, minorité) émet un **enregistrement d'audit sans contenu art.9** (niveau, décision, tier, horodatage) permettant le calcul de rappel/faux négatifs. La minorité détectée déclenche la commande *suspension + quarantaine + effacement 30 j* (C3/C4), et est **exclue de toute exploitation** (comme FR-046). »

### E6 — La ZDR/DPA n'est gardée que par un « process », pas par un invariant technique
- **Énoncé :** Deferred « DPA art.28 + ZDR Mistral payant — porte pré-lancement … les clés gratuites actuelles ne le couvrent pas (dev/test uniquement) ».
- **Pas garanti :** c'est une **porte humaine**, pas une garde technique. **Rien dans l'architecture n'empêche** d'appeler Mistral free-tier (sans ZDR, entraînement possible) avec de l'art.9 réel — il suffit d'une variable d'environnement en prod. NFR-019 (« fournisseur qui ne peut s'engager = disqualifié ») n'est pas matérialisé en refus d'exécution.
- **Manquant → invariant :** « L'adaptateur art.9-éligible **refuse de démarrer** si sa configuration ne prouve pas ZDR + DPA actifs (capacité vérifiée au boot). Chemin art.9 + adaptateur non-ZDR = échec dur, jamais dégradation. » (Prolonge C2.)

---

## MOYEN

### M1 — Cache Vercel/edge non gardé sur les routes art.9 (NFR-020)
Aucun invariant n'impose `no-store`/`dynamic` sur les route handlers art.9. Vercel peut mettre en cache des réponses (tier CDN **US**) → art.9 dans un cache tiers, violation NFR-020. **Proposé :** convention « toute route art.9 est `dynamic`/`no-store` ; jamais de mise en cache de réponse art.9 ».

### M2 — Logs et traces d'erreur : « jamais d'art.9 en clair » énoncé, non enforced
La convention interdit l'art.9 en clair dans les logs, mais **aucun invariant** n'interdit un **moniteur d'erreurs tiers serveur** (Sentry/APM, souvent US) ni n'impose le **scrubbing** des prompts/réponses avant journalisation. Le streaming (NFR-014) transite par le route handler — capture accidentelle facile. **Proposé :** « Journalisation structurée par liste blanche de champs ; interdit de logger prompt/réponse/verbatim ; tout APM/error-tracker tiers sur le chemin art.9 interdit ou configuré en scrubbing prouvé. »

### M3 — Audio vocal (NFR-003/004) sans mécanisme ni binding
« Seule la transcription conservée, audio supprimé après traitement » et « aucune inférence d'émotion depuis la voix » ne sont **bindés à aucun AD** et n'ont **aucun mécanisme** (stockage temporaire de l'audio non gouverné ; suppression non garantie). **Proposé :** convention d'ingestion vocale — audio en zone éphémère, suppression garantie post-transcription, jamais d'analyse paralinguistique.

### M4 — Révocation de consentement non propagée (FR-012)
Le consentement est « révocable à tout moment » mais **aucun invariant** ne définit l'effet de la révocation (arrêt du traitement, proposition d'effacement). Couvert par la proposition C3 mais à expliciter.

### M5 — `usage_ia` : métrage vs minimisation
Le métrage par utilisatrice (AD-2) est légitime, mais `usage_ia` ne doit contenir **aucun** contenu art.9 (compteurs/coûts uniquement) et entre dans le périmètre d'effacement (E1). À poser comme invariant de schéma.

---

## FAIBLE

### F1 — Traçabilité `binds` incomplète
Absents de la liste `binds` du frontmatter alors que compliance-critiques : **FR-072** (ordre consentement), **FR-069/070/071** (âge/mineurs), **FR-042/046** (détresse/branche), **FR-078** (mesure), **NFR-003/004** (voix), **NFR-023** (18+). Certains sont couverts par des AD, d'autres (FR-072, FR-078) par aucun. Corriger la traçabilité de tête.

### F2 — « secrets serveur uniquement, jamais client » imprécis
La clé **publishable** Supabase est côté client **par conception** ; la formulation devrait viser **`service_role` / secrets sensibles** (cf. C1), sinon l'invariant est trivialement « violé » et perd sa force.

---

## Synthèse des invariants à ajouter (prioritaire)

1. **AD — Chemin base lié à l'utilisatrice** (C1) : RLS active, `service_role` interdit sur art.9, deny-by-default testé en CI.
2. **AD — Frontière art.9 prime sur le tiering** (C2, E6) : `AiPort` porte une capacité juridiction/DPA/ZDR ; seul un adaptateur éligible démarre et est sélectionnable ; échec dur sinon.
3. **Convention/AD — Write-gate consentement** (C3) : refus d'écriture art.9 sans consentement valide ; état "traitement suspendu" à la révocation.
4. **AD — Moteur de rétention/effacement déterministe** (C4, E1) : échéances paramétrées 24m/3m/30j, effacement exhaustif par utilisatrice, purge caches, borne sauvegardes, journalisé.
5. **AD — Fail-safe sécurité** (E4) : à défaut du modèle fort, forcer les haltes ; jamais de dégradation vers le léger.
6. **AD — Observabilité de sécurité** (E5) : audit sans art.9 de chaque classification (détresse + minorité) pour mesurer le rappel ; commande de suspension/quarantaine/effacement mineure réellement gouvernée.
7. **Convention — CSP + no-store art.9 + interdiction APM tiers** (E3, M1, M2) : verrous d'exfiltration et de cache.
8. **AD — Chiffrement/accès admin** (E2) : rendre NFR-022 techniquement vrai (break-glass audité ou chiffrement applicatif par utilisatrice).
