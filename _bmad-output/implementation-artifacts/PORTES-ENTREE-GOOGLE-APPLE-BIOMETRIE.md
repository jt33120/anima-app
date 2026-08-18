# Les portes d'entrée — Google, Apple, et le visage

**Écrit le 2026-08-18**, à la demande de Julian, pendant la refonte de l'entrée.
Compagnon de `PORTES-AVANT-PUBLICATION.md` : ce document-ci ne parle que de **comment on entre**.

---

## Ce qui existe aujourd'hui, mesuré

| | État |
|---|---|
| Lien magique (PKCE) | ✅ en production, gabarit français, `{{ .ConfirmationURL }}` |
| Code à six chiffres | ✅ en production depuis le 2026-08-18, vérifié par deux envois réels |
| Google | ❌ `external_google_enabled = false` |
| Apple | ❌ `external_apple_enabled = false` |
| Biométrie (Face ID / Touch ID) | ❌ rien, et ce n'est pas un oubli — voir §3 |
| MFA disponible côté Supabase | TOTP et téléphone. **Aucun facteur WebAuthn.** |

Le code à six chiffres a réglé le cas qui bloquait : demander sur un appareil, ouvrir le
courriel sur un autre. Ce qui reste ci-dessous est du **confort d'entrée**, pas une panne.

---

## 1. Google — le plus court chemin, et ce qu'il me faut

C'est le seul des trois que je peux livrer entièrement dès que j'ai deux chaînes de caractères.

**Ce que Julian fait (une fois, ~10 minutes) :**

1. [console.cloud.google.com](https://console.cloud.google.com) → créer un projet (ou réutiliser).
2. *APIs & Services* → *OAuth consent screen* → type **External**, nom public **Anam**,
   e-mail de contact, domaine autorisé `anima-retourasoi.fr`.
   ⚠️ Les portées demandées restent `email` et `profile`. Rien d'autre — toute portée
   supplémentaire déclenche une revue Google et n'apporte rien à Anam.
3. *Credentials* → *Create credentials* → **OAuth client ID** → *Web application*.
4. **Authorized redirect URI**, exactement :
   `https://zlhlzoalmszohrxrnsmo.supabase.co/auth/v1/callback`
5. Me donner le **Client ID** et le **Client secret**.

**Ce que je fais ensuite :** activer le fournisseur côté Supabase, poser le bouton sur `/entrer`,
et — le point qui compte — vérifier que `etapeOnboardingPour` traite un compte Google **exactement**
comme un compte courriel. Un compte Google arrive avec l'adresse déjà confirmée mais **sans date de
naissance et sans consentement art. 9** : il doit traverser `/naissance` puis `/consentement` comme
tout le monde. C'est `destinationApresAuth` qui s'en charge, et elle est déjà partagée par les deux
portes existantes — donc la troisième en hérite sans qu'on recopie quoi que ce soit.

**Ce qu'il ne faut pas faire :** croire que ça marche parce que le bouton apparaît. Le test qui
compte est un compte Google **neuf**, qui doit atterrir sur `/naissance`, pas dans la scène.

---

## 2. Apple — utile le jour du natif, pas avant

**Ce n'est pas un choix, c'est une règle de l'App Store.** La *Review Guideline 4.8* impose Sign in
with Apple à toute application qui propose une connexion par un tiers (Google en est un). Donc :
tant qu'Anam est une PWA web, Apple est facultatif ; le jour où on publie sur l'App Store **avec**
Google, il devient obligatoire.

**Le coût réel :**

- **99 $/an** de compte Apple Developer. C'est la vraie porte, et elle est payante.
- Un **Services ID**, une **clé privée (.p8)**, un **Team ID**, un **Key ID**.
- Le **domaine et l'URL de retour** doivent être vérifiés chez Apple — ce qui suppose que
  `anima-retourasoi.fr` sert le site, et pas seulement les courriels
  (c'est la porte §3 de `PORTES-AVANT-PUBLICATION.md`, déjà bloquante).

**Recommandation :** ne pas le faire maintenant. Il n'apporte rien à quelqu'un qui teste dans un
navigateur, et il dépend d'une porte encore fermée.

---

## 3. Face ID — ce que c'est vraiment, et pourquoi la réponse change avec le support

C'est le point où il faut être précis, parce que « connexion par Face ID » recouvre **deux choses
très différentes** et qu'on ne veut pas construire la mauvaise.

### 3.a — Ce que Face ID n'est PAS

Face ID n'est jamais un facteur d'authentification qui voyage. Le visage ne quitte pas l'appareil ;
il ne sert qu'à **déverrouiller localement** un secret déjà présent. Il n'existe donc aucune manière
de « se connecter à Anam avec Face ID » depuis un appareil qui ne connaît pas encore le compte : la
première entrée passera toujours par un courriel, un code, ou un fournisseur tiers.

Ça ne diminue pas l'intérêt — c'est même tout l'intérêt : **la deuxième fois et les suivantes**.

### 3.b — Sur le web (aujourd'hui) : deux options, une seule honnête

**Option A — un verrou d'écran.** `navigator.credentials.get()` derrière une clé locale, qui masque
l'application tant que le visage n'a pas répondu. ⚠️ **Ce n'est pas de l'authentification** : la
session existe déjà, le serveur n'en sait rien, et n'importe qui peut contourner le verrou en
ouvrant un onglet. Pour un produit qui porte de l'article 9, promettre un verrou qui n'en est pas
serait pire que de ne rien promettre. **À écarter.**

**Option B — de vraies passkeys (WebAuthn).** C'est la vraie réponse, et elle a un coût précis :
**Supabase Auth n'a pas de facteur WebAuthn** (les facteurs MFA disponibles sur ce projet sont
`totp` et `phone`, vérifié le 2026-08-18). Il faudrait donc l'écrire : une table de justificatifs,
la génération et la vérification des défis côté serveur, la liaison à `auth.users`, la révocation, et
le chemin de secours quand l'appareil est perdu. C'est un Epic, pas une story.

### 3.c — Sur le natif (App Store) : presque gratuit

C'est là que la réponse devient simple, et c'est pour ça que Julian a raison de vouloir l'écrire
maintenant plutôt que de le construire :

1. **Sign in with Apple déclenche Face ID tout seul**, au niveau du système. Aucun code de notre
   côté au-delà du fournisseur Apple de §2.
2. Le **jeton de rafraîchissement** Supabase se range dans le **Trousseau** avec
   `kSecAccessControlBiometryCurrentSet`. La session ne se rouvre alors qu'après le visage — et
   cette fois c'est vrai, parce que le secret est réellement inaccessible sans lui.

**Conclusion : Face ID est une conséquence du passage au natif, pas un projet séparé.** Le faire sur
le web coûterait un Epic pour être refait autrement six mois plus tard.

---

## 4. La contradiction qu'il faut trancher, et qui n'est pas la mienne

`PORTES-AVANT-PUBLICATION.md` §0 pose la question « où Anima vit-elle ? » comme **la décision qui
commande tout le reste**, et la réponse retenue jusqu'ici était **PWA web**. Le passage à une
application sur l'App Store change :

- l'hébergement et le DPA article 9 (porte §2, Vercel) ;
- le paiement — l'App Store prélève **15 à 30 %** sur un abonnement vendu dans l'application,
  là où Stripe prélève ~1,5 % + 0,25 €. Sur 69 €, l'écart est de **~9 à 20 € par abonnement**.
  Contourner par un paiement web est possible mais encadré, et c'est un sujet en soi ;
- le délai — une revue Apple s'ajoute à chaque publication.

**Rien de tout ça n'est bloqué par le code.** Le produit est écrit en couches (AD-7/AD-10 : le
modèle ne connaît pas le rendu), donc un client natif réutiliserait le même socle. Mais c'est une
décision de produit et d'argent, et elle mérite d'être prise explicitement plutôt que d'arriver
par la petite porte d'une envie de Face ID.

---

## En une ligne

**Google maintenant** (il me faut deux chaînes). **Apple et Face ID le jour du natif**, ensemble,
parce que le second vient presque gratuitement avec le premier. **Le web ne devrait pas essayer
d'imiter Face ID** : ce qu'on saurait y construire à coût raisonnable serait un verrou décoratif.
