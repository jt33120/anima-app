/**
 * ══ LA GARDE QUI REFUSE DE VISER LA PRODUCTION ════════════════════════════════════════════════
 *
 * ⚠️ CE FICHIER EXISTE PARCE QUE C'EST ARRIVÉ, le 2026-08-19, à la première exécution de la suite.
 *
 * `.env.local` pointe vers le projet Supabase de PRODUCTION. `next dev` charge ce fichier tout
 * seul. La suite a donc demandé six codes à la production, qui a tenté six vrais envois vers
 * `@exemple.test` — un domaine qui n'existe pas, donc six rebonds sur la réputation d'envoi du
 * domaine — et a créé six comptes dans la base de production.
 *
 * Rien n'avait menti : la configuration disait « stack local » dans un commentaire, et le
 * commentaire ne configure rien. Le symptôme visible était « aucun courriel n'arrive », ce qui
 * ressemble à une panne du collecteur et fait chercher au mauvais endroit.
 *
 * ── CE QUI PROTÈGE MAINTENANT, DANS L'ORDRE ────────────────────────────────────────────────────
 *
 * 1. `playwright.config.ts` passe les variables LOCALES au serveur qu'il démarre. La doc de Next
 *    (`node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`, « Environment
 *    Variable Load Order ») est formelle : `process.env` est consulté AVANT `.env.local`, et la
 *    recherche s'arrête au premier trouvé. Les variables passées gagnent donc contre le fichier.
 * 2. `reuseExistingServer: false` — sinon la suite se raccrocherait à un `npm run dev` déjà lancé
 *    à la main, celui-là chargé depuis `.env.local`, et toute la garde ci-dessus serait contournée
 *    sans un mot.
 * 3. Ce fichier, qui REFUSE de lancer quoi que ce soit si la cible n'est pas locale.
 *
 * La garde est écrite pour échouer FERMÉ : une variable absente refuse, elle n'autorise pas.
 */

/** Les seuls hôtes qu'on accepte de viser. Tout le reste est traité comme de la production. */
const HOTES_LOCAUX = new Set(["127.0.0.1", "localhost", "[::1]"]);

function estLocal(url: string | undefined): boolean {
  if (!url) return false; // ⚠️ ABSENT = REFUSÉ. Une variable manquante n'est pas une permission.
  try {
    return HOTES_LOCAUX.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

async function joignable(url: string, quoi: string): Promise<void> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!r.ok && r.status !== 401) throw new Error(`HTTP ${r.status}`);
  } catch (e) {
    throw new Error(
      `${quoi} ne répond pas (${url}).\n` +
        "Le stack Supabase local doit tourner AVANT la suite : `supabase start`.\n" +
        `Détail : ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

export default async function garderLaCible(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!estLocal(url)) {
    throw new Error(
      "\n" +
        "═".repeat(92) +
        "\n⛔ REFUS : la suite E2E viserait autre chose que le stack local.\n" +
        "═".repeat(92) +
        `\n\n   NEXT_PUBLIC_SUPABASE_URL = ${url ?? "(absente)"}\n\n` +
        "   Cette suite CRÉE des comptes et DÉCLENCHE de vrais envois de courriel. Contre la\n" +
        "   production, elle fabrique des comptes parasites, brûle le quota d'envoi, et expédie\n" +
        "   des messages vers des adresses inventées — donc des rebonds sur la réputation du\n" +
        "   domaine. C'est arrivé le 2026-08-19 ; cette garde est née ce jour-là.\n\n" +
        "   Rien à corriger dans `.env.local` : `playwright.config.ts` passe déjà les variables\n" +
        "   locales au serveur qu'il démarre. Si ce message paraît, c'est que quelque chose les a\n" +
        "   contournées — un serveur `npm run dev` déjà lancé à la main, le plus souvent.\n",
    );
  }

  await joignable(`${url}/auth/v1/health`, "Supabase local (auth)");
  await joignable(
    `${process.env.ANIMA_MAILPIT ?? "http://127.0.0.1:54324"}/api/v1/messages`,
    "Le collecteur de courriels (Mailpit)",
  );
}
