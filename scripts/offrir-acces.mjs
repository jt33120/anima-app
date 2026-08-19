/**
 * Ouvrir (ou refermer) un accès premium SANS Stripe — pour Anima et les comptes de test.
 *
 *     npm run acces -- offrir anima@exemple.fr "écriture du corpus"
 *     npm run acces -- reprendre anima@exemple.fr
 *     npm run acces -- offrir anima@exemple.fr "corpus" --prod
 *
 * ⚠️ LE SCRIPT N'EST PAS LA GARDE, ET IL NE FAUT PAS LE CROIRE. Ce qui empêche quelqu'un de s'offrir
 * le premium vit dans la BASE : l'exécution de `offrir_acces` est retirée à `authenticated` et
 * `anon`, et `abonnement` n'a aucune policy d'écriture. Ce fichier n'est qu'un appelant commode ;
 * le supprimer ne retirerait aucune protection, et le recopier n'en contournerait aucune.
 *
 * ⚠️ EN PRODUCTION, IL PASSE PAR L'API DE GESTION, PAS PAR LA CLÉ DE SERVICE. La clé `service_role`
 * de production n'a rien à faire dans un terminal : elle ouvre TOUT, sans RLS, sans trace. L'API de
 * gestion, elle, est authentifiée par un jeton personnel révocable.
 */
import { execFileSync } from "node:child_process";

const [action, email, motif] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const prod = process.argv.includes("--prod");

if (!["offrir", "reprendre"].includes(action) || !email) {
  console.error(
    "Usage : npm run acces -- <offrir|reprendre> <email> [motif] [--prod]\n" +
      "  offrir     ouvre un accès premium sans paiement\n" +
      "  reprendre  le referme (ne touche JAMAIS un contrat payant)",
  );
  process.exit(2);
}

/** Une variable de `.env.local`. Le fichier n'est pas `source`-able (une ligne le casse). */
function env(nom) {
  return execFileSync("grep", ["-m1", `^${nom}=`, ".env.local"], { encoding: "utf-8" })
    .trim()
    .split("=")
    .slice(1)
    .join("=")
    .replace(/^"|"$/g, "");
}

const sql =
  action === "offrir"
    ? `select public.offrir_acces('${email.replace(/'/g, "''")}', ${motif ? `'${motif.replace(/'/g, "''")}'` : "null"}) as resultat`
    : `select public.reprendre_acces_offert('${email.replace(/'/g, "''")}') as resultat`;

let resultat;

if (prod) {
  const REF = "zlhlzoalmszohrxrnsmo";
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env("SUPABASE_ACCESS_TOKEN")}`,
      "Content-Type": "application/json",
      // L'API de gestion refuse l'agent par défaut de `fetch`.
      "User-Agent": "anam-acces/1.0",
    },
    body: JSON.stringify({ query: sql }),
  });
  // ⚠️ ELLE REND 201, PAS 200 — mesuré. Un contrôle `=== 200` ferait échouer un appel réussi.
  if (!r.ok) {
    console.error(`API de gestion : HTTP ${r.status}\n${await r.text()}`);
    process.exit(1);
  }
  resultat = (await r.json())[0]?.resultat;
} else {
  const sortie = execFileSync(
    "docker",
    ["exec", "-i", "supabase_db_anima-app", "psql", "-U", "postgres", "-d", "postgres", "-tAc", sql],
    { encoding: "utf-8" },
  );
  resultat = sortie.trim();
}

const PHRASES = {
  offert: `✅ Accès premium ouvert pour ${email}${motif ? ` (${motif})` : ""}. Rien n'est prélevé.`,
  repris: `✅ Accès repris pour ${email}. Le compte redevient gratuit.`,
  compte_inconnu: `⛔ Aucun compte pour ${email}. Il faut d'abord qu'elle soit entrée une fois.`,
  contrat_stripe_existant: `⛔ ${email} a un contrat Stripe en cours — on ne le recouvre pas. Résilie-le d'abord, ou laisse-le vivre.`,
  contrat_payant_intouche: `⛔ ${email} paie vraiment : rien n'a été touché. Une résiliation passe par l'écran d'abonnement.`,
  aucun_abonnement: `⛔ ${email} n'a aucun abonnement — il n'y a rien à reprendre.`,
};

console.log(PHRASES[resultat] ?? `Réponse inattendue : ${resultat}`);
process.exit(resultat === "offert" || resultat === "repris" ? 0 : 1);
