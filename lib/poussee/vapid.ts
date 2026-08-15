import "server-only";

/**
 * vapid.ts — L'IDENTIFICATION DU SERVEUR AUPRÈS D'UN SERVICE DE POUSSÉE (RFC 8292, Story 6.2).
 *
 * ── POURQUOI À LA MAIN, ET PAS `web-push` ────────────────────────────────────────────────────────────
 *
 * L'essentiel de ce qu'apporte la bibliothèque usuelle est le CHIFFREMENT DE CHARGE UTILE (aes128gcm,
 * RFC 8291), dont la décision D1 nous dispense entièrement : on ne pousse aucun octet.
 *
 * Ce qui reste est un JWT ES256 sur P-256. `crypto.subtle` le signe nativement, et sa sortie brute
 * `r‖s` de 64 octets est déjà exactement le format que JWS attend — la conversion DER que la plupart
 * des implémentations doivent faire n'a pas lieu d'être ici.
 *
 * Le point qui décide n'est pas la taille : c'est que ce code est **vérifiable**. Un test reprend le
 * JWT produit et le vérifie avec la clé publique via `crypto.subtle.verify`, ce qu'on ne peut pas faire
 * d'une bibliothèque tierce sans la réimplémenter. Une signature fausse serait sinon un 401 silencieux
 * en production, tous les jours, sans qu'aucun test ne l'ait vu.
 *
 * ── LA CLÉ PRIVÉE ────────────────────────────────────────────────────────────────────────────────────
 *
 * Une seule clé serveur (AD-2/AD-3), en variable d'environnement, jamais dans l'arbre du dépôt — qui
 * est public. `VAPID_CLE_PUBLIQUE` est publiée à l'abonnée (elle en a besoin pour souscrire) ;
 * `VAPID_CLE_PRIVEE` ne quitte jamais le serveur.
 */

// L'encodage vit dans un module SANS `server-only` : l'îlot de `/reglages` doit décoder la clé
// PUBLIQUE pour `pushManager.subscribe`, qui exige un `Uint8Array`. Une seule définition, deux
// lecteurs — recopier huit lignes dans le composant client les ferait diverger (leçon R1-bis).
export { base64url, debase64url } from "@/lib/poussee/base64url";
import { base64url, debase64url } from "@/lib/poussee/base64url";

/**
 * L'ORIGINE d'un endpoint — `aud` du JWT, et rien de plus que le schéma et l'hôte.
 *
 * ⚠️ RFC 8292 §2 : l'audience est l'origine, PAS l'URL complète. Y laisser le chemin ferait rejeter le
 * jeton par certains services et l'accepter par d'autres — donc une panne qui ne toucherait qu'une
 * partie des abonnées, ce qui est la forme la plus difficile à diagnostiquer.
 *
 * Et le chemin d'un endpoint est un SECRET (quiconque le connaît peut pousser) : il n'a rien à faire
 * dans un jeton, fût-il de courte durée.
 */
export function origineDe(endpoint: string): string {
  const u = new URL(endpoint);
  if (u.protocol !== "https:") throw new Error("endpoint_non_tls");
  return `${u.protocol}//${u.host}`;
}

export interface ClesVapid {
  /** Clé publique brute non compressée : 65 octets, `0x04 ‖ X ‖ Y`, en base64url. */
  readonly publique: string;
  /** Scalaire privé : 32 octets, en base64url. */
  readonly privee: string;
  /** `sub` du JWT — un `mailto:` ou un `https:` par lequel un service de poussée peut nous joindre. */
  readonly sujet: string;
}

/**
 * Les clés sont-elles présentes ET bien formées ?
 *
 * ⚠️ La forme est vérifiée ici, pas au premier POST. Une clé publique de 64 octets au lieu de 65 (le
 * préfixe `0x04` oublié en la copiant) produit un abonnement que le navigateur accepte et des poussées
 * que le service refuse — c'est-à-dire une panne qui ne se voit qu'en production, chez l'utilisatrice.
 */
export function clesValides(cles: Partial<ClesVapid>): cles is ClesVapid {
  const { publique, privee, sujet } = cles;
  if (!publique || !privee || !sujet) return false;
  if (!sujet.startsWith("mailto:") && !sujet.startsWith("https://")) return false;
  try {
    const p = debase64url(publique);
    const d = debase64url(privee);
    return p.length === 65 && p[0] === 0x04 && d.length === 32;
  } catch {
    return false;
  }
}

/**
 * La durée de validité du jeton. RFC 8292 §2 impose au plus 24 h ; douze heures laissent de la marge
 * à une horloge serveur qui dérive, sans faire d'un jeton intercepté un droit de pousser d'un jour.
 */
export const VALIDITE_JETON_S = 12 * 3_600;

/**
 * L'en-tête `Authorization` d'une requête de poussée : `vapid t=<JWT>, k=<clé publique>`.
 *
 * `instant` entre par la porte (AD-10) plutôt que d'être lu ici : c'est ce qui rend `exp` testable, et
 * ce qui empêche ce module de porter une horloge.
 */
export async function enteteVapid(cles: ClesVapid, endpoint: string, instant: Date): Promise<string> {
  const jwt = await signerJeton(cles, origineDe(endpoint), instant);
  return `vapid t=${jwt}, k=${cles.publique}`;
}

/** Le JWT ES256, en trois segments base64url. Exporté pour que le test puisse le vérifier. */
export async function signerJeton(cles: ClesVapid, audience: string, instant: Date): Promise<string> {
  const entete = { typ: "JWT", alg: "ES256" };
  const revendications = {
    aud: audience,
    exp: Math.floor(instant.getTime() / 1000) + VALIDITE_JETON_S,
    sub: cles.sujet,
  };
  const enJson = (o: unknown) => base64url(new TextEncoder().encode(JSON.stringify(o)));
  const corps = `${enJson(entete)}.${enJson(revendications)}`;

  const cle = await importerClePrivee(cles);
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cle,
    new TextEncoder().encode(corps),
  );
  // ⚠️ `crypto.subtle.sign` rend déjà `r‖s` brut (P1363), et c'est ce que JWS attend. Les
  // implémentations qui partent d'OpenSSL doivent d'abord dépaqueter du DER ; ici, le faire serait
  // une erreur — et une erreur qui produit un jeton de 70 octets accepté par personne.
  return `${corps}.${base64url(new Uint8Array(signature))}`;
}

/**
 * Importe le couple (privée, publique) en une clé JWK utilisable par `crypto.subtle`.
 *
 * WebCrypto n'accepte pas un scalaire privé nu : il lui faut le point public qui va avec. On le
 * reconstitue depuis la clé publique brute plutôt que de le recalculer.
 *
 * ⚠️ Node VALIDE la cohérence `d` ↔ `(x, y)` à l'import et REFUSE un couple dépareillé (vérifié en
 * test). Deux variables d'environnement mélangées — la publique d'un projet, la privée d'un autre —
 * font donc échouer le boot du port, bruyamment, plutôt que de produire des 401 muets pendant des
 * jours. `clesValides` ne l'attrape pas : elle vérifie des longueurs, pas une courbe elliptique.
 */
async function importerClePrivee(cles: ClesVapid): Promise<CryptoKey> {
  const publique = debase64url(cles.publique);
  return crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      d: cles.privee,
      x: base64url(publique.slice(1, 33)),
      y: base64url(publique.slice(33, 65)),
      ext: false,
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

/** La clé publique seule, pour vérifier une signature (tests) et rien d'autre. */
export async function importerClePublique(publiqueB64: string): Promise<CryptoKey> {
  const publique = debase64url(publiqueB64);
  return crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      x: base64url(publique.slice(1, 33)),
      y: base64url(publique.slice(33, 65)),
      ext: true,
    },
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["verify"],
  );
}
