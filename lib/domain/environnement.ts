/**
 * environnement.ts — « SOMMES-NOUS EN PRODUCTION ? », en UN seul endroit.
 *
 * ── POURQUOI CE MODULE EXISTE ──────────────────────────────────────────────────────────────────
 *
 * La question était écrite deux fois, à deux endroits, dans deux formes différentes :
 *
 *   • `lib/ai/fabrique.ts`   — `VERCEL_ENV === "production" || (VERCEL_ENV undefined && NODE_ENV …)`
 *   • `lib/data/supabase/cookies-session.ts` — `NODE_ENV !== "development"` (et son en-tête EXPLIQUE
 *     pourquoi il prend la forme inverse : un `NODE_ENV` absent doit échouer FERMÉ, pas ouvert).
 *
 * Les deux ont raison, et pour des raisons différentes. Ce module ne les fusionne donc pas : il donne
 * un nom à la seule des deux qui décide d'un REFUS DE SERVICE — « suis-je le déploiement que voient
 * de vraies personnes ? » — pour qu'une troisième garde n'en réinvente pas une troisième version.
 *
 * C'est la leçon de R1 (revue Epic 6), transposée : deux lectures d'une même question, écrites à
 * deux endroits, finissent par ne plus dire la même chose. Ici, l'écart serait un refus de vente qui
 * ne se déclenche pas là où il compte.
 *
 * ⚠️ FONCTION PURE, LES VALEURS SONT PASSÉES. Elle ne lit pas `process.env` : sinon elle ne serait
 * testable qu'en muant l'environnement du processus, et une garde qu'on ne peut pas éprouver
 * proprement finit par n'être éprouvée sur aucun de ses cas.
 */

/**
 * Est-on sur le déploiement que voient de vraies personnes ?
 *
 * `VERCEL_ENV` fait autorité quand il existe : il distingue `production` de `preview`, ce que
 * `NODE_ENV` ne sait pas faire (une préproduction Vercel est bâtie en `NODE_ENV=production`).
 * Sans lui — exécution locale, conteneur, CI — on retombe sur `NODE_ENV`.
 */
export function estProduction(env: {
  VERCEL_ENV?: string;
  NODE_ENV?: string;
}): boolean {
  if (env.VERCEL_ENV !== undefined) return env.VERCEL_ENV === "production";
  return env.NODE_ENV === "production";
}

/**
 * ── LA FORME D'UNE CLÉ STRIPE DE TEST ──────────────────────────────────────────────────────────
 *
 * Stripe préfixe ses clés par leur mode : `sk_test_` / `sk_live_`, `pk_test_` / `pk_live_`. Le
 * préfixe est la SEULE information disponible sans appeler l'API — et elle suffit, parce que Stripe
 * n'accepte jamais une clé de test sur un compte réel ni l'inverse.
 *
 * ⚠️ ON RECONNAÎT LE TEST, PAS LE LIVE, et c'est délibéré. Écrire `!cle.startsWith("sk_live_")`
 * ferait refuser toute clé d'un format que Stripe inventerait demain (les clés restreintes commencent
 * déjà par `rk_`). La garde doit refuser ce qu'elle SAIT être faux, pas tout ce qu'elle ne
 * reconnaît pas — sinon elle ferme le produit à la première évolution de l'API.
 */
export function estCleStripeDeTest(cle: string): boolean {
  return /^[a-z]{2}_test_/.test(cle);
}

/**
 * ── LE SITE EST-IL OUVERT AUX MOTEURS DE RECHERCHE ? (porte pré-lancement §7) ──────────────────
 *
 * ⚠️ FERMÉ PAR DÉFAUT, ET C'EST TOUTE LA DÉCISION. Les deux oublis possibles ne coûtent pas la même
 * chose : oublier de fermer, c'est se faire indexer — et un index se propage, se met en cache, se
 * cite, et ne se retire pas d'un `git revert`. Oublier d'ouvrir, c'est rester invisible un jour de
 * plus, ce qui se répare en posant une variable. On penche donc du côté qui se répare.
 *
 * C'est la doctrine d'AD-15 (le repli penche vers le moins d'effet) appliquée à la visibilité, et
 * celle d'`origineDuSite()` — « un lien mort vaut mieux qu'un lien vers un domaine qu'on ne possède
 * pas ».
 *
 * CE QUE ÇA GARDE, CONCRÈTEMENT. Le produit n'est pas publiable : 0 créneau de corpus sur 210, 0
 * visuel de carte sur 21, et un protocole de détresse qu'aucun professionnel n'a relu. Être trouvé
 * par quelqu'un en détresse qui cherche de l'aide, aujourd'hui, serait le pire moment possible pour
 * ce produit — et c'est exactement ce qu'un moteur de recherche organise.
 *
 * ⚠️ LA VALEUR EST UN MOT, PAS UN BOOLÉEN. `true` / `1` / `yes` sont ce que posent les outils, les
 * gabarits et les copier-coller ; `oui` est ce que pose quelqu'un qui a lu ce commentaire et décidé.
 */
export function siteIndexable(env: {
  ANIMA_INDEXABLE?: string;
  // La signature d'index existe pour que `process.env` soit acceptable tel quel : sans elle,
  // TypeScript refuse (TS2559) un environnement qui ne déclare pas la clé nommée ci-dessus.
  [autreVariable: string]: string | undefined;
}): boolean {
  return env.ANIMA_INDEXABLE === "oui";
}
