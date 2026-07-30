import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Story 4.4 (T5) — gardes d'architecture par LECTURE de fichiers (commentaires retirés → la garde ne
 * matche pas sa propre prose) :
 *   (a) AC4 — le récepteur art. 9 n'est atteint QUE par sa fonction possédée : la RPC
 *       `enregistrer_signal_reconceptualisation` n'apparaît QUE dans `lib/data/depot-reconceptualisation.ts`
 *       (la table nue `signal_reconceptualisation` n'est même jamais citée côté applicatif — accès via RPC).
 *   (b) AC1 — « aucun détecteur hors du pipeline » : l'orchestrateur `evaluerReconceptualisationDuTour` n'est
 *       appelé QUE par la route ; le détecteur pur (`requeteReconceptualisation`/`detecterReconceptualisation`)
 *       n'est appelé QUE par l'orchestrateur.
 *   (c) AC5 — reconceptualisation ≠ détresse : le détecteur PUR n'importe AUCUN module de détresse, et les
 *       modules de détresse n'importent PAS le détecteur de reconceptualisation (deux évaluations distinctes).
 *
 * PÉRIMÈTRE : `app`+`lib`+`render`+`scripts` (récursif) + points d'entrée racine. Frontière de MOT `\b…\b`.
 */

const racine = process.cwd();

function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
function lire(f: string): string {
  return sansCommentaires(readFileSync(f, "utf-8"));
}
function fichiersSource(dir: string): string[] {
  const abs = resolve(racine, dir);
  if (!existsSync(abs)) return [];
  return (readdirSync(abs, { recursive: true, encoding: "utf-8" }) as string[])
    .filter((f) => /\.(ts|tsx|mjs|js|jsx)$/.test(f))
    .map((f) => resolve(abs, f));
}
const racineEntrees = ["proxy.ts", "instrumentation.ts"].map((f) => resolve(racine, f)).filter((p) => existsSync(p));
const tousSource = [
  ...fichiersSource("app"),
  ...fichiersSource("lib"),
  ...fichiersSource("render"),
  ...fichiersSource("scripts"),
  ...racineEntrees,
];

const DEPOT = resolve(racine, "lib/data/depot-reconceptualisation.ts");
const DOMAINE = resolve(racine, "lib/domain/reconceptualisation.ts");
const ORCHESTRATEUR = resolve(racine, "lib/safety/reconceptualisation-pipeline.ts");
const ROUTE = resolve(racine, "app/api/anam/message/route.ts");

describe("signal_reconceptualisation — accès confiné à sa fonction possédée (T5a/AC4)", () => {
  it("a bien scanné du code applicatif", () => {
    expect(tousSource.length).toBeGreaterThan(10);
  });

  it("la RPC `enregistrer_signal_reconceptualisation` n'apparaît QUE dans lib/data/depot-reconceptualisation.ts", () => {
    const RPC = /\benregistrer_signal_reconceptualisation\b/;
    for (const f of tousSource) {
      if (f === DEPOT) continue;
      expect(lire(f), `accès à la RPC hors du dépôt possédé : ${f}`).not.toMatch(RPC);
    }
    expect(lire(DEPOT), "le dépôt appelle bien la RPC (garde non vide)").toMatch(RPC);
    // Contrôle positif : la frontière de mot attrape l'appel réel.
    expect('supabase.rpc("enregistrer_signal_reconceptualisation", …)').toMatch(RPC);
  });

  it("aucun ACCÈS TABLE DIRECT `.from(\"signal_reconceptualisation\")` côté applicatif — l'écriture passe par la RPC (revue 4.4, R6)", () => {
    // La sécurité (AD-17 + isolation) vit dans la RLS/policy (R1), mais un accès table DIRECT reste une
    // confusion de couche à interdire : le dépôt écrit via la RPC, jamais `.from(table)`. On vise le VECTEUR
    // réel (`.from(<quote>signal_reconceptualisation`), pas le mot nu — sinon le message d'erreur du dépôt
    // (`signal_reconceptualisation.enregistrer:`) ou un futur log seraient de faux positifs.
    const ACCES_TABLE = /\bfrom\s*\(\s*[`'"]signal_reconceptualisation\b/;
    for (const f of tousSource) {
      expect(lire(f), `accès table DIRECT à signal_reconceptualisation (interdit) : ${f}`).not.toMatch(ACCES_TABLE);
    }
    // Contrôles positifs/négatifs : attrape l'accès table, PAS la RPC ni le namespace d'erreur.
    expect('supabase.from("signal_reconceptualisation")').toMatch(ACCES_TABLE);
    expect("supabase.from(`signal_reconceptualisation`)").toMatch(ACCES_TABLE);
    expect('supabase.rpc("enregistrer_signal_reconceptualisation", …)').not.toMatch(ACCES_TABLE);
    expect("throw new Error(`signal_reconceptualisation.enregistrer: ${code}`)").not.toMatch(ACCES_TABLE);
  });
});

describe("détecteur de reconceptualisation confiné au pipeline (T5b/AC1)", () => {
  it("`evaluerReconceptualisationDuTour` n'est appelé QUE par la route (hors sa propre définition)", () => {
    const NOM = /\bevaluerReconceptualisationDuTour\b/;
    for (const f of tousSource) {
      if (f === ORCHESTRATEUR || f === ROUTE) continue;
      expect(lire(f), `orchestrateur appelé hors du pipeline : ${f}`).not.toMatch(NOM);
    }
    expect(lire(ROUTE), "la route câble bien l'étage (garde non vide)").toMatch(NOM);
  });

  it("`requeteReconceptualisation`/`detecterReconceptualisation` (le détecteur pur) ne sortent QUE du domaine vers l'orchestrateur", () => {
    const PUR = /\b(requeteReconceptualisation|detecterReconceptualisation)\b/;
    for (const f of tousSource) {
      if (f === DOMAINE || f === ORCHESTRATEUR) continue;
      expect(lire(f), `détecteur pur appelé hors de l'orchestrateur : ${f}`).not.toMatch(PUR);
    }
    expect(lire(ORCHESTRATEUR), "l'orchestrateur appelle bien le détecteur pur").toMatch(PUR);
  });
});

describe("AC5 — reconceptualisation ≠ détresse : deux évaluations, aucune ne référence l'autre (T5c)", () => {
  const IMPORT_DETRESSE = /from\s+["']\.\/(detecteur-detresse|classer-detresse|consigne-detresse)["']|from\s+["']@\/lib\/safety\/(detecteur-detresse|classer-detresse|consigne-detresse)["']/;
  const IMPORT_RECONCEPT = /reconceptualisation-pipeline|@\/lib\/domain\/reconceptualisation/;

  it("le détecteur PUR de reconceptualisation n'importe AUCUN module de détresse", () => {
    expect(lire(DOMAINE)).not.toMatch(IMPORT_DETRESSE);
  });

  it("AUCUN module de lib/safety/ (hors l'orchestrateur) n'importe la reconceptualisation — glob, pas liste en dur (revue 4.4, R7)", () => {
    // L'orchestrateur `reconceptualisation-pipeline.ts` importe LÉGITIMEMENT le verdict de détresse (ordering,
    // AC1) → seul exclu. Tout AUTRE fichier de safety qui référencerait la reconceptualisation confondrait les
    // deux évaluations (AC5). Glob → couvre les ~13 fichiers, pas seulement 2 codés en dur.
    const modulesSafety = fichiersSource("lib/safety").filter((f) => !f.endsWith("reconceptualisation-pipeline.ts"));
    expect(modulesSafety.length, "a bien globé lib/safety/").toBeGreaterThan(5);
    for (const f of modulesSafety) {
      expect(lire(f), `un module de safety référence la reconceptualisation (confusion des évaluations, AC5) : ${f}`).not.toMatch(IMPORT_RECONCEPT);
    }
  });
});
