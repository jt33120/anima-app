import "server-only"; // un tirage exécuté chez le client serait re-jouable à volonté (AD-11).
import { JEU, TAILLE_JEU, type CleCarteJeu } from "./jeu";
import { csprngSysteme, indiceUniforme } from "./alea";

/**
 * tirer.ts — LE POINT D'ENTRÉE DU TIRAGE (Story 5.7, FR-015 / FR-016 · AD-11).
 *
 * ── LA SIGNATURE EST LA GARDE ──────────────────────────────────────────────────────────────────
 *
 * `tirerUneCarte()` NE PREND AUCUN ARGUMENT. C'est la traduction en code de l'exigence AD-11 : « le
 * point d'entrée n'a aucun accès au profil, à l'historique ni à l'état émotionnel — contrainte
 * d'architecture, PAS règle de code ».
 *
 * Une fonction `tirerUneCarte(utilisatriceId)` qui PROMETTRAIT de ne pas se servir de son argument
 * serait vraie aujourd'hui et fausse le jour où quelqu'un voudra « éviter de retomber deux fois de
 * suite sur la même carte ». Cette intention est bienveillante, et elle produit exactement le défaut
 * critique FR-016 : une carte choisie en fonction de la personne, présentée comme aléatoire. Sans
 * paramètre, cette pensée ne peut pas s'écrire ici — il faudrait d'abord changer la signature, ce
 * qui rougit `tests/tirage-architecture.test.ts` (l'arité y est une assertion).
 *
 * ── ET LE VERROU D'IMPORTS FERME L'AUTRE PORTE ─────────────────────────────────────────────────
 *
 * Une fonction sans argument peut quand même ALLER CHERCHER un profil. Elle ne le peut plus si elle
 * ne peut rien importer qui en contienne : `eslint.config.mjs` interdit à `lib/tirage/**` d'importer
 * `@/lib/data`, `@/lib/domain`, `@/lib/safety`, `@/lib/ai`, `@/lib/lecture` (le catalogue de sens),
 * `@/app`, `@/render`, `@supabase/*` et `next` — ainsi que tout chemin relatif remontant, et tout
 * import dynamique (qui échappe à `no-restricted-imports`, leçon déjà payée sur `lib/domain/`).
 *
 * Les deux gardes sont redondantes, et c'est voulu. ⚠️ Piège connu du dépôt : deux défenses qui se
 * couvrent l'une l'autre laissent SURVIVRE le mutant. La campagne en exécute donc deux distincts —
 * ajouter un paramètre, et ajouter un import interdit — chacun devant tuer sa propre garde.
 *
 * ── AUCUN HORODATAGE ICI ───────────────────────────────────────────────────────────────────────
 *
 * L'AC3 demande « graine + horodatage ». L'heure ne vient PAS d'ici : elle est autoritaire côté base
 * (doctrine posée en 0046). Un `new Date()` rendu par cette fonction serait l'heure du processus,
 * donc falsifiable et sujette à la dérive d'horloge — une mauvaise pièce dans un journal d'audit.
 * Le tirage rend ce qu'il sait ; la base date ce qu'elle reçoit.
 */

/**
 * Le résultat d'un tirage : la carte, la graine qui l'a produite, et la taille du jeu au moment du
 * tirage.
 *
 * `tailleJeu` n'est PAS décoratif — c'est la pièce sans laquelle l'audit casse en silence. Le jour
 * où le jeu passe de 21 à 26 cartes, rejouer une ligne ancienne avec la taille COURANTE donne
 * `graine % 26` au lieu de `graine % 21` : une carte fausse, rendue avec assurance, sur toutes les
 * lignes antérieures. Quatre octets journalisés rendent l'audit définitif.
 */
export interface Tirage {
  readonly cle: CleCarteJeu;
  readonly graine: string;
  readonly tailleJeu: number;
}

/**
 * Tire une carte. Uniformément. Sans rien savoir de personne.
 *
 * L'identité n'entre pas ici : elle n'intervient qu'à l'ÉCRITURE de la ligne, sous RLS
 * (`lib/data/depot-tirage.ts`). L'ordre — tirer, PUIS écrire — est ce qui rend AC2 vérifiable :
 * la fonction qui tire ne connaît pas l'utilisatrice, la fonction qui écrit ne tire pas.
 */
export function tirerUneCarte(): Tirage {
  const { indice, graine } = indiceUniforme(csprngSysteme, TAILLE_JEU);
  return { cle: JEU[indice].cle, graine, tailleJeu: TAILLE_JEU };
}
