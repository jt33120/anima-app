import "server-only";
import { cookies } from "next/headers";

/**
 * ══ L'ATTENTE D'UN CODE — ET POURQUOI ELLE NE PEUT PAS VIVRE DANS REACT ════════════════════════
 *
 * ⚠️ LE DÉFAUT QUE CE FICHIER RÉPARE (mesuré le 2026-08-19, sur le téléphone de Julian).
 *
 * L'écran « tape ton code » n'existait que dans la mémoire de React : `useActionState` bascule
 * dessus quand l'envoi réussit, et rien d'autre ne le retient. Or le geste NORMAL, sur un
 * téléphone, est exactement celui-ci : demander le code, basculer sur l'application de courrier
 * pour le lire, revenir. iOS a alors très souvent rechargé l'onglet — et la page repart au
 * formulaire d'adresse. Le code reçu est valide une heure et n'a plus AUCUN endroit où être tapé.
 *
 * C'est un piège fermé : l'utilisatrice a la clé en main et la serrure a disparu. Redemander un
 * code ne sauve rien, puisque le second courriel ramènera au même écran perdu.
 *
 * Le cookie, lui, survivait déjà à tout ça — il est `httpOnly` et vit une heure. Il n'était juste
 * jamais RELU au chargement de la page. C'est tout le correctif : l'attente est un fait du
 * serveur, pas un état d'écran, et la page la lit comme tel.
 *
 * Ce module est partagé par l'action (qui écrit) et par la page (qui lit). Il ne peut pas vivre
 * dans `actions.ts` : un fichier `"use server"` n'exporte que des fonctions asynchrones, jamais
 * une constante — et le nom du cookie doit être le MÊME des deux côtés, pas recopié.
 */
export const COOKIE_ATTENTE = "anam_entree_attente";

/** Aligné sur `mailer_otp_exp` du projet (3 600 s, mesuré le 2026-08-18) : le cookie ne survit pas au code. */
export const DUREE_ATTENTE_S = 3600;

/** Ce qu'on tolère avant de renvoyer demander un code neuf. Confort, pas garde — voir `actions.ts`. */
export const ESSAIS_MAX = 5;

export type Attente = { readonly adresse: string; readonly essais: number };

export async function lireAttente(): Promise<Attente | null> {
  const brut = (await cookies()).get(COOKIE_ATTENTE)?.value;
  if (!brut) return null;
  try {
    const v = JSON.parse(brut) as Partial<Attente>;
    if (typeof v.adresse !== "string" || !v.adresse.includes("@")) return null;
    return { adresse: v.adresse, essais: typeof v.essais === "number" ? v.essais : 0 };
  } catch {
    return null;
  }
}

export async function poserAttente(attente: Attente | null): Promise<void> {
  const jar = await cookies();
  if (!attente) {
    jar.delete(COOKIE_ATTENTE);
    return;
  }
  jar.set(COOKIE_ATTENTE, JSON.stringify(attente), {
    httpOnly: true,
    // ⚠️ ÉCRIT À L'ENVERS, EXPRÈS — et c'est une garde de ce dépôt qui me l'a fait corriger.
    // La forme naturelle (`=== "production"`) rend `false` quand `NODE_ENV` manque : le cookie
    // partirait alors SANS `Secure` sur un déploiement réel, donc en clair. Écrite ainsi, une
    // variable absente donne `Secure`. Le seul cas qui l'abaisse est nommé : `development`, où le
    // site est en http://localhost et où un cookie `Secure` ne serait jamais posé.
    // Même patron que les portes de démo d'`actions.ts`, et `tests/auth-magic-link.test.ts` le vérifie.
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax",
    path: "/",
    maxAge: DUREE_ATTENTE_S,
  });
}
