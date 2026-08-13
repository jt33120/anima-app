/**
 * cookies-session.ts — LES ATTRIBUTS DU COOKIE QUI PORTE LA SESSION.
 *
 * ══ CE QUE `@supabase/ssr` POSE PAR DÉFAUT, ET POURQUOI ÇA NE VA PAS ICI ═════════════════════════
 *
 * Lu dans `node_modules/@supabase/ssr/dist/main/utils/constants.js` (0.12.3) :
 *
 *     { path: "/", sameSite: "lax", httpOnly: false, maxAge: 400 * 24 * 60 * 60 }
 *
 * et `secure` n'est posé NULLE PART dans le paquet. Le cookie `sb-<ref>-auth-token` contient
 * l'`access_token` ET le `refresh_token`. Tel quel, il est donc :
 *   • lisible par `document.cookie`, donc par tout script qui atteindrait l'origine ;
 *   • transmis en clair sur la moindre requête `http://` vers le domaine.
 *
 * ══ CE QUI REND LA CORRECTION GRATUITE (mesuré le 2026-08-13) ═══════════════════════════════════
 *
 * `httpOnly: true` casserait un produit qui lit sa session côté navigateur. Anima ne le fait pas :
 * `lib/data/supabase/client.ts` (le `createBrowserClient`) n'est importé par AUCUN fichier de
 * `app/`, `lib/` ni `render/` — vérifié par balayage. Toute l'autorisation passe par `getUser()`
 * dans un Server Component, une Server Action ou un route handler. Le JavaScript de page n'a
 * jamais eu besoin de voir ce cookie ; il pouvait simplement le lire.
 *
 * ══ POURQUOI CE FICHIER PLUTÔT QUE DEUX LITTÉRAUX ═══════════════════════════════════════════════
 *
 * Deux clients posent des cookies de session — celui des Server Components (`server.ts`) et celui
 * du proxy qui rafraîchit (`middleware.ts`). Écrits deux fois, ils divergeraient : c'est la leçon
 * R1-bis de ce dépôt, vérifiée le 2026-08-12 sur les deux détecteurs de texte. Un seul objet, deux
 * lecteurs. Durcir le cookie à un seul endroit laisserait l'autre chemin poser l'ancien.
 */

/**
 * `secure` échoue FERMÉ. La forme naturelle serait `NODE_ENV === "production"` — elle laisse le
 * cookie en clair partout où la variable manque (un `node server.js` nu, un conteneur minimal).
 * Écrite à l'envers, l'absence de variable donne un cookie `Secure`, et c'est le développement
 * local — le cas où l'on voit tout de suite que quelque chose cloche — qui doit se déclarer.
 * (`Secure` est accepté sur `http://localhost`, traité comme origine sûre par les navigateurs.)
 */
export const OPTIONS_COOKIE_SESSION = {
  httpOnly: true,
  secure: process.env.NODE_ENV !== "development",
  sameSite: "lax",
  path: "/",
} as const;
