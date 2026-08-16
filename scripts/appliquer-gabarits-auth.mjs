/**
 * appliquer-gabarits-auth.mjs — POUSSE LA COPIE D'AUTHENTIFICATION VERS SUPABASE (QA tour 1, T6).
 *
 * Les deux premiers textes du produit vivent dans `lib/courriel/gabarits-auth.ts`, sous les gardes
 * du dépôt. Ce script les envoie à la configuration du projet, et NE FAIT QUE ÇA — il ne touche ni
 * au `site_url`, ni au SMTP, ni à quoi que ce soit d'autre.
 *
 *   node scripts/appliquer-gabarits-auth.mjs            # montre ce qui changerait
 *   node scripts/appliquer-gabarits-auth.mjs --appliquer
 *
 * Lit `SUPABASE_ACCESS_TOKEN` et `SUPABASE_PROJECT_REF` dans `.env.local`. Rien n'est écrit dans le
 * dépôt : le jeton ne quitte pas ce processus, et il n'est jamais affiché.
 *
 * ⚠️ `User-Agent` NON PAR DÉFAUT : l'API de gestion de Supabase refuse l'agent de `fetch`.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function env(cle) {
  const src = readFileSync(resolve(RACINE, ".env.local"), "utf-8");
  const m = new RegExp(`^${cle}=(.*)$`, "m").exec(src);
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
}

const JETON = env("SUPABASE_ACCESS_TOKEN");
const REF = env("SUPABASE_PROJECT_REF") ?? "zlhlzoalmszohrxrnsmo";
if (!JETON) {
  console.error("SUPABASE_ACCESS_TOKEN absent de .env.local");
  process.exit(1);
}

// Les gabarits sont du TypeScript ; on les lit en extrayant les valeurs plutôt qu'en compilant, pour
// que ce script reste un script — sans dépendance, sans étape de build, exécutable tel quel.
const { GABARITS_AUTH } = await import(`${RACINE}/.gabarits-auth.mjs`).catch(async () => {
  const { execSync } = await import("node:child_process");
  execSync(
    `npx esbuild lib/courriel/gabarits-auth.ts --bundle --format=esm --outfile=.gabarits-auth.mjs --log-level=error`,
    { cwd: RACINE, stdio: "inherit" },
  );
  return import(`${RACINE}/.gabarits-auth.mjs`);
});

const corps = {};
for (const g of GABARITS_AUTH) {
  corps[g.cleObjet] = g.objet;
  corps[g.cleCorps] = g.corps;
}

const entetes = {
  Authorization: `Bearer ${JETON}`,
  "Content-Type": "application/json",
  "User-Agent": "anima-outillage/1.0",
};
const URL_CONFIG = `https://api.supabase.com/v1/projects/${REF}/config/auth`;

const avant = await (await fetch(URL_CONFIG, { headers: entetes })).json();

console.log(`\nProjet ${REF} — ${Object.keys(corps).length} clés\n`);
for (const [cle, valeur] of Object.entries(corps)) {
  const ancien = String(avant[cle] ?? "");
  const etat = ancien === valeur ? "inchangé" : "À POUSSER";
  console.log(`  [${etat}] ${cle}`);
  if (etat === "À POUSSER") {
    console.log(`      avant : ${ancien.slice(0, 70).replace(/\n/g, " ")}${ancien.length > 70 ? "…" : ""}`);
    console.log(`      après : ${valeur.slice(0, 70).replace(/\n/g, " ")}${valeur.length > 70 ? "…" : ""}`);
  }
}

if (!process.argv.includes("--appliquer")) {
  console.log("\nRien n'a été poussé. Relance avec --appliquer.\n");
  process.exit(0);
}

const r = await fetch(URL_CONFIG, { method: "PATCH", headers: entetes, body: JSON.stringify(corps) });
if (!r.ok) {
  console.error(`\nÉCHEC ${r.status} : ${await r.text()}\n`);
  process.exit(1);
}

// ⚠️ ON RELIT. Un 200 dit que la requête a été acceptée, pas que la valeur a pris — la propagation
// de cette API prend une vingtaine de secondes, et une clé mal nommée est acceptée en silence.
await new Promise((ok) => setTimeout(ok, 20_000));
const apres = await (await fetch(URL_CONFIG, { headers: entetes })).json();
let dur = 0;
for (const [cle, valeur] of Object.entries(corps)) {
  if (String(apres[cle] ?? "") !== valeur) {
    console.error(`  ✗ ${cle} n'a PAS pris`);
    dur += 1;
  }
}
console.log(dur === 0 ? "\n✓ Les deux gabarits sont relus conformes.\n" : `\n${dur} clé(s) non prises.\n`);
process.exit(dur === 0 ? 0 : 1);
