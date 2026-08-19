import { defineConfig, devices } from "@playwright/test";

/**
 * Les clés de DÉMONSTRATION du CLI Supabase — les mêmes sur toutes les machines, publiées dans sa
 * documentation. Elles n'ouvrent rien d'autre qu'un stack local. Les écrire ici est délibéré :
 * les lire depuis `.env.local` reproduirait exactement la panne que ce fichier empêche.
 */
const LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const LOCAL_SERVICE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// La garde de cible lit cette variable AVANT le premier test — voir `e2e/_garde-de-cible.ts`.
process.env.NEXT_PUBLIC_SUPABASE_URL = LOCAL_URL;

/**
 * ══ LA SUITE QUI VOIT DES PIXELS ══════════════════════════════════════════════════════════════
 *
 * 5 007 tests Vitest sont verts et AUCUN ne voit un pixel : ils montent des composants en mémoire.
 * Ils savent qu'un bouton existe, jamais qu'il fait 27 px de haut, ni qu'un rechargement d'onglet
 * fait disparaître l'écran où l'on tape son code — le défaut de production du 2026-08-19, qu'aucun
 * des 5 007 n'a pu voir.
 *
 * ⚠️ CETTE SUITE VISE LE STACK LOCAL, JAMAIS LA PRODUCTION. Deux raisons, et ce n'est pas de la
 * prudence de principe :
 *   1. le code à six chiffres n'existe que dans un COURRIEL. En local, Mailpit le rend lisible ;
 *      en production, il faudrait la boîte de quelqu'un.
 *   2. une suite qui écrit dans la base de production y laisse des comptes, des consentements
 *      article 9 et des journaux. On ne fabrique pas de la donnée sensible pour tester.
 *
 * Le serveur est monté par `webServer` ci-dessous, en `next dev`. Le stack Supabase local, lui,
 * doit tourner AVANT (`supabase start`) : Playwright ne le démarre pas, parce qu'un harnais qui
 * démarre une base a le pouvoir de la réinitialiser, et ce dépôt tient à ce que personne ne fasse
 * ça par accident.
 *
 * ⚠️ ET « VISER LE LOCAL » NE SE DÉCRÈTE PAS DANS UN COMMENTAIRE. La première version de ce
 * fichier disait exactement la phrase ci-dessus — et la suite a visé la PRODUCTION, parce que
 * `.env.local` y pointe et que `next dev` le charge tout seul. Six comptes créés là-bas, six
 * courriels partis vers un domaine inexistant. Voir `e2e/_garde-de-cible.ts` : la cible est
 * maintenant IMPOSÉE (`webServer.env`), non réutilisable (`reuseExistingServer: false`), et
 * VÉRIFIÉE avant le premier test.
 */
export default defineConfig({
  testDir: "./e2e",
  // Un seul travailleur : ces parcours écrivent dans une base partagée, et deux inscriptions
  // simultanées se disputeraient le collecteur de courriels.
  workers: 1,
  fullyParallel: false,
  // Aucune reprise. Une reprise transforme un défaut intermittent en test vert, et c'est
  // exactement la classe de défauts qu'on cherche ici.
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  // Refuse de démarrer si la cible n'est pas le stack local. Avant le premier test, avant tout
  // envoi de courriel, avant toute écriture.
  globalSetup: "./e2e/_garde-de-cible.ts",
  use: {
    baseURL: process.env.ANIMA_URL ?? "http://localhost:3000",
    // La preuve, pas le confort : une capture et une trace à chaque échec.
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
  },
  projects: [
    {
      // Le téléphone D'ABORD, parce que c'est là que le défaut du 19/08 vivait : le rechargement
      // d'onglet en revenant de l'application de courrier est un geste de téléphone.
      name: "mobile",
      use: { ...devices["iPhone 14"] },
    },
    {
      name: "bureau",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/entrer",
    // ⚠️ JAMAIS `true`. Un `npm run dev` déjà lancé à la main a été démarré depuis `.env.local`,
    // donc contre la PRODUCTION : s'y raccrocher contournerait toute la garde ci-dessous sans un
    // mot. On paie le démarrage d'un serveur, et on sait ce qu'il vise.
    reuseExistingServer: false,
    timeout: 120_000,
    // La cause racine de l'incident du 2026-08-19 se règle ici. Ces variables sont posées dans le
    // `process.env` du serveur, et la doc de Next (« Environment Variable Load Order ») consulte
    // `process.env` AVANT `.env.local`, en s'arrêtant au premier trouvé. Le fichier ne peut donc
    // plus gagner. Les clés locales sont les clés de démonstration du CLI Supabase, identiques sur
    // toutes les machines : elles n'ouvrent rien d'autre qu'un stack sur cette machine-ci.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: LOCAL_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: LOCAL_ANON,
      SUPABASE_SECRET_KEY: LOCAL_SERVICE,
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    },
  },
});
