/**
 * base64url.ts — L'ENCODAGE COMMUN AU SERVEUR ET AU NAVIGATEUR (Story 6.2).
 *
 * ⚠️ **CE FICHIER N'A PAS DE `server-only`, ET C'EST SA RAISON D'ÊTRE.** `vapid.ts` en a un — il
 * manipule une clé privée — mais l'îlot de `/reglages` doit décoder la clé PUBLIQUE pour la passer à
 * `pushManager.subscribe`, qui exige un `Uint8Array` et refuse une chaîne.
 *
 * Sans ce module, la seule issue serait de recopier huit lignes de décodage dans le composant client.
 * Elles divergeraient : c'est la leçon R1-bis du dépôt, et elle a déjà été payée sur deux détecteurs
 * de texte. Une seule définition, deux lecteurs — l'un serveur, l'autre navigateur.
 *
 * Rien de secret ne transite ici : ce sont des fonctions de transcodage, sans état et sans clé.
 */

/** Encode en base64url sans remplissage — la seule forme que JWS et VAPID acceptent. */
export function base64url(octets: Uint8Array): string {
  let binaire = "";
  for (const o of octets) binaire += String.fromCharCode(o);
  return btoa(binaire).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Décode du base64url, en tolérant l'absence de remplissage. LÈVE sur un caractère hors alphabet.
 *
 * ⚠️ Le refus plutôt que la tolérance : `atob` accepte silencieusement certaines entrées douteuses et
 * rend des octets faux. Une clé publique subtilement fausse produit un abonnement que le navigateur
 * accepte et des poussées que le service refuse — donc une panne qui ne se voit qu'en production.
 */
export function debase64url(texte: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(texte)) throw new Error("base64url_invalide");
  const b64 = texte.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(texte.length / 4) * 4, "=");
  const binaire = atob(b64);
  return Uint8Array.from(binaire, (c) => c.charCodeAt(0));
}
