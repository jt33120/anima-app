import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * _environnement.ts — QUELLE BASE LA SUITE INTERROGE, ET POURQUOI CE N'EST PAS CELLE DE L'APP.
 *
 * ══ LA MESURE QUI TRANCHE (2026-08-12) ══════════════════════════════════════════════════════════
 *
 * L'application vit désormais entièrement sur le projet de LANCEMENT : `.env.local` y pointe, les
 * migrations y partent, c'est la seule base du produit. La suite de tests, elle, ne peut pas y
 * tourner — et ce n'est pas une préférence d'outillage, c'est un plafond mesuré :
 *
 *   • la suite ouvre **95 sessions par passe** (`signInWithPassword` : c'est ainsi qu'on éprouve
 *     une policy RLS — il faut un vrai JWT d'utilisatrice, pas une clé de service) ;
 *   • Supabase hébergé coupe à **32 connexions en cinq minutes** (429 `over_request_rate_limit`).
 *     Mesuré : la 33ᵉ échoue, cinq secondes après la première ;
 *   • ce plafond ne figure PAS dans les réglages modifiables (`/config/auth` n'expose que
 *     `rate_limit_email_sent`, `_otp`, `_verify`, `_token_refresh`…) ;
 *   • un second projet cloud aurait le même ;
 *   • et on ne peut pas fabriquer les jetons soi-même pour éviter la connexion : les clés de
 *     signature du projet sont **asymétriques**, la privée n'est pas récupérable.
 *
 * Le `createUser` admin, lui, n'est pas limité (60 d'affilée passent) : c'est bien la CONNEXION qui
 * bute, donc rien qu'on puisse contourner en créant moins de comptes.
 *
 * ══ CE QUE CE FICHIER FAIT ══════════════════════════════════════════════════════════════════════
 *
 * Il charge `.env.test.local` s'il existe, AVANT que le moindre fichier de test ne construise son
 * client. C'est tout. Sans lui, il faudrait se souvenir de sourcer le bon fichier à chaque
 * commande — et le jour où quelqu'un oublie, la suite ne tombe pas : elle crée quatre-vingts
 * comptes dans la base de lancement avant de mourir sur un 429. Un piège qui punit l'oubli par des
 * données dans la vraie base n'a pas sa place ici.
 *
 * Rien n'est écrasé de ce qui vient déjà de l'environnement : un `SUPABASE_URL=… npx vitest`
 * explicite reste maître, ce qui permet d'éprouver la suite contre le cloud le jour où on veut
 * VÉRIFIER un déploiement (en la lançant fichier par fichier, sous le plafond).
 *
 * ══ LE PIÈGE S'EST REFERMÉ SUR NOUS (2026-08-13, Story 5.5) ══════════════════════════════════════
 *
 * L'en-tête ci-dessus décrivait le danger — « le jour où quelqu'un oublie, la suite ne tombe pas :
 * elle crée quatre-vingts comptes dans la base de lancement avant de mourir sur un 429 » — et le
 * jour est arrivé, deux fois, sans que personne ne le voie. La raison est que la COMMANDE écrite
 * dans les dossiers de story depuis des semaines est exactement le geste interdit :
 *
 *     set -a && . ./.env.local && set +a && npx vitest run
 *
 * Elle date de l'époque où `.env.local` pointait sur la pile locale. Depuis le 2026-08-12, ce
 * fichier pointe sur le projet de LANCEMENT — et comme les valeurs sourcées viennent « déjà de
 * l'environnement », le `??=` de ce fichier-ci les respecte scrupuleusement. La suite entière est
 * donc partie sur la vraie base.
 *
 * Constaté le 2026-08-13 : **93 comptes de fixtures** dans la base de lancement
 * (`cyc-eff-autre-…@exemple.fr`, `ann-b3-…@exemple.fr`), 43 le 12/08 et 50 le 13/08.
 *
 * Et le symptôme ne dit RIEN de la cause : 31 fichiers échouent sur un `42501 permission denied for
 * table …`, c'est-à-dire un message qui parle de privilèges de table. Il faut sonder
 * l'authentification à la main pour découvrir le `429 over_request_rate_limit` derrière, puis
 * comparer deux fichiers d'environnement pour comprendre qu'on interrogeait la production.
 *
 * ══ POURQUOI UNE GARDE, ET PAS UNE LIGNE DE PLUS DANS LA DOCUMENTATION ═══════════════════════════
 *
 * Parce que c'est la doctrine de ce dépôt, et qu'elle vient d'être vérifiée une fois de plus : une
 * garde qui vit dans un commentaire n'existe pas. L'avertissement était écrit, en toutes lettres,
 * dans ce fichier même — il n'a arrêté personne. Le refus, lui, arrête.
 *
 * L'échappatoire reste ouverte et explicite, pour l'usage légitime que l'en-tête décrit.
 */

/** Une base LOCALE : la pile du CLI, quelle que soit la forme de l'hôte de bouclage. */
export function estBaseLocale(url: string | undefined): boolean {
  if (!url) return true; // aucune base visée : rien à protéger (tests purs)
  try {
    const hote = new URL(url).hostname;
    return hote === "localhost" || hote === "127.0.0.1" || hote === "::1" || hote === "[::1]";
  } catch {
    return false; // inanalysable → on refuse, jamais on suppose
  }
}

export const AUTORISATION_DISTANTE = "oui-je-vise-la-vraie-base";

/**
 * Rend le message de refus, ou `null` si la cible est admissible. PURE, pour être éprouvée
 * elle-même — une garde d'environnement qu'on ne peut pas tester est une garde qu'on croit avoir.
 */
export function refusDeCible(env: Record<string, string | undefined>): string | null {
  const urls = [env.SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_URL].filter(Boolean);
  const distantes = urls.filter((u) => !estBaseLocale(u));
  if (distantes.length === 0) return null;
  if (env.ANIMA_TESTS_BASE_DISTANTE === AUTORISATION_DISTANTE) return null;
  return [
    "",
    "  ⛔ LA SUITE ALLAIT TOURNER CONTRE UNE BASE QUI N'EST PAS LOCALE.",
    "",
    `     Cible détectée : ${distantes.join(", ")}`,
    "",
    "     Les tests SQL créent des dizaines de comptes et écrivent dans les tables art. 9 :",
    "     lancés contre le projet de lancement, ils y laissent des fixtures et meurent sur un",
    "     429 (Supabase hébergé coupe à 32 connexions / 5 min) en se plaignant de PRIVILÈGES.",
    "",
    "     La cause est presque toujours la même : `. ./.env.local` a été sourcé avant vitest.",
    "     `.env.local` pointe sur la base de LANCEMENT depuis le 2026-08-12.",
    "",
    "     ✅  npx vitest run              ← `.env.test.local` est chargé par ce fichier",
    `     ⚠️  ANIMA_TESTS_BASE_DISTANTE=${AUTORISATION_DISTANTE} npx vitest run <fichier>`,
    "         (l'usage légitime : vérifier UN fichier après un déploiement, sous le plafond)",
    "",
  ].join("\n");
}

const FICHIER = resolve(process.cwd(), ".env.test.local");

if (existsSync(FICHIER)) {
  for (const ligne of readFileSync(FICHIER, "utf-8").split("\n")) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(ligne.trim());
    if (!m) continue; // commentaire, ligne vide
    const [, cle, valeur] = m;
    // `??=` : l'environnement explicite gagne toujours sur le fichier.
    process.env[cle] ??= valeur;
  }
}

// ⚠️ APRÈS le chargement, jamais avant : c'est la cible EFFECTIVE qu'on vérifie, pas l'intention.
const refus = refusDeCible(process.env);
if (refus) throw new Error(refus);
