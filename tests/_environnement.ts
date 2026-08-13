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
 */

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
