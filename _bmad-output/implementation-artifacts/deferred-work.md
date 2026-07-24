# Travail différé

Éléments réels, non actionnables maintenant (pré-existants ou hors périmètre de la story en cours), à reprendre au bon moment.

## Deferred from: code review of 1-5-consentement-art9-declaration-ia (2026-07-23)

- **✅ Garde de route sur la scène `/` — FAIT (Story 1.6).** `/` est désormais gardée par `etapeOnboardingPour` (compte + majorité + consentement, + routage de l'état `revoque`) et rend la scène 2D à la place du prototype WebGL. [app/page.tsx]
- **Mention IA persistante (AD-9 / FR-013)** — la déclaration « Tu vas parler à une intelligence artificielle » n'existe que sur `/consentement`, inatteignable une fois le consentement donné. AD-9 demande une mention IA accessible en continu. **Relève de l'écran de séance / conversation** (epic ultérieur). [app/(auth)/consentement/page.tsx]
- **Open redirect dans `/auth/confirm` (pré-existant, Story 1.3)** — le paramètre `next` est utilisé tel quel dans la redirection : `?next=https://evil.com` renvoie hors domaine après un échange de code valide (exploitabilité limitée : exige un code à usage unique valide). **Correctif simple** : allow-list « chemin interne commençant par `/` ». Non introduit par 1.5 mais le fichier est touché par le diff. [app/auth/confirm/route.ts:39]
- **AC1 « sans défilement obligatoire » — vérification iPhone** (décision de revue 2026-07-23) — l'écran de consentement est dense (déclaration + conservation/effacement + accordéon + 2 cases à texte long + boutons) et `.page` centre le contenu (`justify-content:center`), ce qui rogne le débordement plutôt que de le rendre défilable. **À mesurer sur un vrai iPhone (~375×667) avant tout ajustement** — porte pré-lancement. Fix probable si confirmé : centrage → flux (`flex-start`), rythme vertical resserré, sans retirer de texte légalement requis. [app/(auth)/consentement/page.tsx, consentement.module.css]

## Chantier « Entrée dans l'app » — retour produit Julian (2026-07-24)

Julian a testé le localhost : l'arrivée (magic link → âge → consentement) est trop abrupte, pas assez « app mobile ». **Cible CONFIRMÉE : web mobile-first (PWA), PAS d'app native App Store** (NFR-018). **Décision : finir d'abord les fondations (epic 1), puis reprendre ce chantier.** À traiter en fin de fondations :

- **Auth par fournisseur d'identité (Google, éventuellement Apple)** — déjà prévu par FR-073 (« lien e-mail OU fournisseur d'identité ») ; seul le magic link est posé (Story 1.3). Ajouter Google (OAuth Supabase, simple sur le web) ; « Sign in with Apple » web possible mais exige un compte développeur Apple payant. Magic link = dernier recours. Vérifier la discrétion (NFR-015 : trace d'autorisation dans le compte Google/Apple).
- **Accueil immersif AVANT le compte** — aujourd'hui la 1re chose vue est `/entrer` (formulaire de lien e-mail) ; rien ne présente Anam ni ne donne le ton avant de demander l'inscription. Ajouter un accueil, **sans aucune collecte** (voir garde-fous).
- **La vraie immersion = la première séance** — le « dialogue où on apprend ce que la personne vient chercher » (idée de Julian) est exactement UJ-1 (« elle arrive sur une conversation, pas un formulaire »). C'est le CŒUR, epic ultérieur.

**Garde-fous NON négociables :**
- L'ordre compte → âge → consentement art. 9 → séance est **figé par la loi** (FR-072) ; **aucune donnée sensible collectée/traitée avant le consentement** — c'est ce que verrouille la Story 1.6.
- Donc un « faire parler la personne avant le compte » (proposé par Julian) ne peut PAS recueillir/stocker/envoyer au LLM du sensible. Un accueil peut avoir la *forme* d'un dialogue (Anam donne le ton) mais ne recueille rien avant le consentement ; le vrai dialogue vient juste après (séance). Levier anti-friction principal = **compte 1-tap (Google) + consentement beau et rapide**, pas déplacer la collecte avant le consentement.
