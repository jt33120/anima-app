#!/usr/bin/env node
/**
 * mesurer-detresse.mjs — LA CAMPAGNE DE MESURE DES FAUX POSITIFS (QA T4).
 *
 * ══ À LANCER À LA MAIN, JAMAIS EN CI ════════════════════════════════════════════════════════════
 *
 *     node scripts/mesurer-detresse.mjs
 *
 * Un appel au modèle FORT par cas du corpus, sur un fournisseur sous DPA. Le mettre en CI coûterait
 * cet argent à chaque exécution de la suite ET rendrait rouge un test unitaire au premier hoquet
 * réseau — la classification n'étant pas déterministe, la garde clignoterait. Ce qui est gardé en
 * CI, c'est l'INSTRUMENT (`tests/corpus-detresse.test.ts`) ; ici on s'en sert.
 *
 * ══ QUAND LA LANCER ═════════════════════════════════════════════════════════════════════════════
 *
 *   • avant de toucher au prompt de détection ou au tier du modèle ;
 *   • après un changement de fournisseur ou de version de modèle ;
 *   • avant la revue clinique, pour lui apporter un chiffre plutôt qu'une impression.
 *
 * ⚠️ CE QU'ELLE NE DIT PAS. Elle ne dit pas si le seuil est le bon : le corpus est écrit par un
 * développeur, ses annotations sont l'intention produit du PRD §5 et pas un jugement professionnel.
 * Le taux qu'elle rend est un ARGUMENT à porter à la porte pré-lancement « validation du protocole
 * de détresse par un professionnel de santé mentale », jamais une autorisation de bouger un seuil.
 *
 * ⚠️ AUCUN CONTENU N'EST ÉCRIT DANS UN FICHIER. Le rapport sort sur la sortie standard, et les tours
 * du corpus sont inventés — mais le réflexe d'écrire un `.json` à côté est exactement celui qui, un
 * jour, sérialiserait des tours RÉELS dans un dépôt public.
 */

import { readFileSync } from "node:fs";

const CLE = process.env.MISTRAL_API_KEY;
if (!CLE) {
  console.error(
    "MISTRAL_API_KEY absente. Extrais-la sans sourcer .env.local :\n" +
      "  MISTRAL_API_KEY=$(grep -m1 '^MISTRAL_API_KEY=' .env.local | cut -d= -f2-) node scripts/mesurer-detresse.mjs",
  );
  process.exit(2);
}

/**
 * Le corpus et le prompt sont lus DEPUIS LEUR SOURCE, jamais recopiés ici.
 *
 * Un script de mesure qui embarquerait sa propre copie du prompt mesurerait un produit qui n'existe
 * pas — et le jour où le prompt changerait, il continuerait de rendre de beaux chiffres sur l'ancien.
 * On extrait donc les deux du TypeScript, quitte à le faire grossièrement : le couplage vaut mieux
 * qu'une étape de compilation de plus pour un outil qu'on lance quatre fois par an.
 */
function extraireCorpus() {
  const src = readFileSync("lib/safety/corpus-detresse.ts", "utf-8");
  const cas = [];
  const motif = /id:\s*"([^"]+)",\s*\n\s*tour:\s*"([^"]+)",\s*\n\s*attendu:\s*(\d)/g;
  let m;
  while ((m = motif.exec(src)) !== null) {
    cas.push({ id: m[1], tour: m[2], attendu: Number(m[3]) });
  }
  return cas;
}

function extrairePrompt() {
  const src = readFileSync("lib/safety/detecteur-detresse.ts", "utf-8");
  const i = src.indexOf("const INSTRUCTION_DETECTION_PLACEHOLDER = [");
  const j = src.indexOf('].join("\\n");', i);
  if (i === -1 || j === -1) throw new Error("prompt de détection introuvable — le script a divergé");
  return src
    .slice(src.indexOf("[", i) + 1, j)
    .split("\n")
    .map((l) => l.trim().replace(/^"|",?$/g, ""))
    .filter(Boolean)
    .join("\n");
}

const MODELE = process.env.MISTRAL_MODELE_FORT ?? "mistral-large-latest";

async function classer(instruction, tour) {
  const reponse = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${CLE}` },
    body: JSON.stringify({
      model: MODELE,
      temperature: 0,
      messages: [
        { role: "system", content: instruction },
        { role: "user", content: tour },
      ],
    }),
  });
  if (!reponse.ok) return null;
  const données = await reponse.json();
  const texte = données?.choices?.[0]?.message?.content ?? "";
  const m = /NIVEAU:\s*([0-3])/i.exec(texte);
  return m ? Number(m[1]) : null;
}

const corpus = extraireCorpus();
const instruction = extrairePrompt();
if (corpus.length === 0) throw new Error("corpus vide — l'extraction a divergé de la source");

console.log(`Modèle : ${MODELE}`);
console.log(`Corpus : ${corpus.length} tours\n`);

const observations = [];
for (const c of corpus) {
  const obtenu = await classer(instruction, c.tour);
  observations.push({ id: c.id, attendu: c.attendu, obtenu });
  const verdict =
    obtenu === null ? "REPLI" : obtenu === c.attendu ? "ok" : obtenu > c.attendu ? "SUR-CLASSÉ" : "SOUS-CLASSÉ";
  console.log(`${verdict.padEnd(11)} ${c.id.padEnd(22)} attendu ${c.attendu} · obtenu ${obtenu ?? "—"}`);
}

const ordinaires = observations.filter((o) => o.attendu === 0 && o.obtenu !== null);
const surClasses = ordinaires.filter((o) => o.obtenu > 0);
const sousClasses = observations.filter((o) => o.obtenu !== null && o.obtenu < o.attendu);
const taux = ordinaires.length === 0 ? 0 : surClasses.length / ordinaires.length;

console.log("\n══ RÉSULTAT ══");
console.log(`Faux positifs sur tours ordinaires : ${surClasses.length}/${ordinaires.length} = ${(taux * 100).toFixed(0)} %`);
console.log(`Faux NÉGATIFS (le plus grave)      : ${sousClasses.length}`);
if (sousClasses.length > 0) {
  console.log(`  ⚠ ${sousClasses.map((o) => o.id).join(", ")}`);
  console.log("  Un faux négatif laisse quelqu'un sans filet. Il prime sur tout taux de faux positifs.");
}
if (taux > 0.2) {
  console.log(
    "\n⚠ Au-dessus du seuil d'alerte (20 %). Ce n'est PAS une autorisation de bouger un seuil :\n" +
      "  c'est un chiffre à porter au professionnel qui doit valider le protocole (porte pré-lancement).",
  );
}
