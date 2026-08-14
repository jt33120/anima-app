import "server-only";
import { estPremiumCourante } from "./lire-abonnement";
import { CLES_ANCRAGE } from "@/lib/corpus/ancrage";
import { assemblerAncrage, type AncrageAssemble } from "@/lib/domain/ancrage";

/**
 * lire-ancrage.ts — LA GARDE D'ACCÈS AUX ANCRAGES (Story 5.9, T4 · FR-056).
 *
 * ── POURQUOI CE FICHIER EXISTE, ALORS QU'IL N'Y A NI TABLE NI REQUÊTE ─────────────────────────
 *
 * Il porte le `server-only`. C'est tout son rôle, et ce rôle est le cœur de la story.
 *
 * La doctrine de ce dépôt, payée sept fois (migrations 0041→0048, puis 0051), dit qu'une garde qui
 * ne vit que dans une route ou une RPC ne garde rien : `authenticated` détient les sept privilèges
 * DML sur chaque table `public`, donc un `.insert()` ou un `.select()` direct contourne le code.
 *
 * ⚠️ CE RAISONNEMENT NE S'APPLIQUE PAS ICI, ET IL FAUT SAVOIR POURQUOI — sinon on conclurait par
 * habitude qu'il manque une policy, et on chercherait une table à protéger qui n'existe pas.
 *
 * La ressource n'est pas une ligne de base : c'est une CONSTANTE de module. Il n'y a donc aucune
 * porte de derrière côté base — il n'y a pas de base. La seule façon de fuiter les vingt-quatre
 * textes est de les faire ENTRER DANS LE BUNDLE CLIENT, et c'est exactement ce que `server-only`
 * empêche : un composant `"use client"` qui remonterait jusqu'ici casse la compilation.
 *
 * La garde n'est donc pas une policy, c'est une FRONTIÈRE DE DÉPENDANCE — doublée par
 * `tests/ancrage-frontiere.test.ts`, qui refuse tout import de `@/lib/corpus/ancrage` depuis un
 * fichier client, depuis `render/` ou depuis une route d'API.
 *
 * ── L'UNION, PLUTÔT QU'UN TABLEAU VIDE ────────────────────────────────────────────────────────
 *
 * Même raison qu'ailleurs dans ce dépôt : « tu n'as pas l'offre » et « il n'y a rien d'écrit » sont
 * deux états différents, et un tableau vide les afficherait pareil. La halte doit dire lequel des
 * deux est vrai (AC3 vs AC6).
 */

export type AccesAncrages =
  | { readonly statut: "refuse" }
  | { readonly statut: "ouvert"; readonly ancrages: readonly AncrageAssemble[] };

/**
 * L'accès de l'utilisatrice courante.
 *
 * ⚠️ L'ASSEMBLAGE SE FAIT **APRÈS** LA DÉCISION, jamais avant. Assembler puis filtrer marcherait
 * aussi bien aujourd'hui — et laisserait, le jour où quelqu'un déplace un `return`, les textes
 * construits dans la portée d'un chemin de refus. On ne construit pas ce qu'on n'a pas le droit de
 * servir : c'est le même refus de conception que `cartesDisponibles` en 5.6, qui RETIRE une carte
 * indisponible au lieu de la construire puis de la verrouiller.
 *
 * `estPremiumCourante` RELANCE sur une vraie panne de lecture (3.1) : « le doute suspend le
 * commerce ». On ne rattrape donc pas ici — l'appelant distingue la panne du refus, et une panne
 * d'abonnement ne doit surtout pas se lire comme « tu n'as pas l'offre ».
 */
export async function lireAncrages(): Promise<AccesAncrages> {
  const premium = await estPremiumCourante();
  if (!premium) return { statut: "refuse" };
  return { statut: "ouvert", ancrages: CLES_ANCRAGE.map(assemblerAncrage) };
}
