import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Story 2.3 — la garde d'architecture du pipeline sécurité-d'abord (AD-16), prouvée par lecture de
 * fichiers (patron `frontiere-serveur`). On grep le NOM BRUT des modules (import, `await import`,
 * require, chaîne) après retrait des commentaires. Elle vérifie les invariants STRUCTURELS que les
 * tests unitaires ne peuvent pas voir :
 *   - le DÉTECTEUR n'est appelé QUE par le pipeline (aucun détecteur hors du pipeline) ;
 *   - la route exécute la SÉCURITÉ AVANT la génération, et n'a plus de niveau codé en dur ;
 *   - le classifieur reste PUR (aucun import infra) ;
 *   - la capacité `detection` force le FORT dans la politique (pas incident).
 */

const racine = process.cwd();

function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
function lire(f: string): string {
  return sansCommentaires(readFileSync(f, "utf-8"));
}
function fichiersTs(dir: string): string[] {
  return (readdirSync(resolve(racine, dir), { recursive: true, encoding: "utf-8" }) as string[])
    .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
    .map((f) => resolve(racine, dir, f));
}

const DETECTEUR = resolve(racine, "lib/safety/detecteur-detresse.ts");
const PIPELINE = resolve(racine, "lib/safety/pipeline.ts");
const ROUTE = resolve(racine, "app/api/anam/message/route.ts");
const CLASSIFIEUR = resolve(racine, "lib/safety/classer-detresse.ts");
const POLITIQUE = resolve(racine, "lib/ai/politique-tier.ts");

const tousSource = [...fichiersTs("app"), ...fichiersTs("lib"), ...fichiersTs("render")];

describe("Pipeline sécurité-d'abord — invariants d'architecture (AD-16)", () => {
  it("a bien scanné du code applicatif", () => {
    expect(tousSource.length).toBeGreaterThan(10);
  });

  it("le DÉTECTEUR n'est référencé QUE par le pipeline (aucun détecteur hors du pipeline)", () => {
    const autres = tousSource.filter((f) => f !== DETECTEUR && f !== PIPELINE);
    for (const f of autres) {
      expect(lire(f), `réf détecteur hors pipeline : ${f}`).not.toMatch(/detecteur-detresse/);
    }
    // Contrôle positif : le pipeline, lui, l'importe bien → la garde n'est pas vide.
    expect(lire(PIPELINE)).toMatch(/detecteur-detresse/);
  });

  it("la route exécute la SÉCURITÉ AVANT la génération (pipeline appelé avant le flux)", () => {
    const src = lire(ROUTE);
    // On cible les APPELS (`nom(`), pas les symboles nus (sinon l'`import` en tête fausse l'ordre).
    const iSecurite = src.indexOf("evaluerSecuriteDuTour(");
    const iFlux = src.indexOf("diffuserSousEgressArt9(");
    expect(iSecurite, "la route doit APPELER evaluerSecuriteDuTour").toBeGreaterThanOrEqual(0);
    expect(iFlux, "la route doit ouvrir le flux de réponse").toBeGreaterThanOrEqual(0);
    expect(iSecurite, "sécurité d'abord : la détection AVANT la génération (AD-16)").toBeLessThan(iFlux);
  });

  it("la route ne code plus le niveau de sécurité en dur (plus de `niveauSecurite = 0`)", () => {
    const src = lire(ROUTE);
    expect(src, "le niveau doit venir du verdict, jamais d'un littéral").not.toMatch(
      /niveauSecurite\s*(:\s*NiveauSecurite\s*)?=\s*[0-3]\b/,
    );
    expect(src).toMatch(/securite\.verdict\.niveau/); // il DÉRIVE du verdict
  });

  it("le classifieur (`classer-detresse`) reste PUR : aucun import infra, pas de server-only", () => {
    const src = lire(CLASSIFIEUR);
    expect(src, "aucun runtime import (seul `import type` est permis)").not.toMatch(/^\s*import\s+(?!type\b)/m);
    expect(src).not.toMatch(/server-only/);
    expect(src).not.toMatch(/@supabase|next\/|@\/lib\/data/);
  });

  it("la politique force le FORT pour la capacité `detection` (explicite, pas incident)", () => {
    expect(lire(POLITIQUE)).toMatch(/capacite\s*===\s*"detection"/);
  });
});

const MODELE_EPISODE = resolve(racine, "lib/safety/episode-detresse.ts");
const DEPOT_EPISODE = resolve(racine, "lib/safety/depot-episode.ts");
const MIGRATION_0010 = resolve(racine, "supabase/migrations/0010_episode_detresse.sql");
const MIGRATION_0011 = resolve(racine, "supabase/migrations/0011_episode_detresse_corrections.sql");

describe("Story 2.4 — épisode de détresse : invariants d'architecture (AD-17, AD-12, AD-14)", () => {
  it("le modèle d'épisode (`episode-detresse`) reste PUR : aucun import runtime, pas de server-only, pas d'infra", () => {
    const src = lire(MODELE_EPISODE);
    expect(src, "aucun runtime import (seul `import type` est permis)").not.toMatch(/^\s*import\s+(?!type\b)/m);
    expect(src).not.toMatch(/server-only/);
    expect(src).not.toMatch(/@supabase|next\/|@\/lib\/data/);
  });

  it("la transition `enregistrer_tour_detresse` n'est appelée QUE par le dépôt (jamais ailleurs)", () => {
    const autres = tousSource.filter((f) => f !== DEPOT_EPISODE);
    for (const f of autres) {
      expect(lire(f), `réf transition hors dépôt : ${f}`).not.toMatch(/enregistrer_tour_detresse/);
    }
    expect(lire(DEPOT_EPISODE)).toMatch(/enregistrer_tour_detresse/); // contrôle positif
  });

  it("la table `episode_detresse` naît deny-by-default (RLS + FORCE, AUCUNE policy) — art. 9 (AC3)", () => {
    const sql = readFileSync(MIGRATION_0010, "utf-8");
    expect(sql).toMatch(/enable row level security/i);
    expect(sql).toMatch(/force\s+row level security/i);
    expect(sql, "server-authoritative : aucune policy cliente (comme usage_ia/audit_securite)").not.toMatch(
      /create policy/i,
    );
  });

  it("les SEUILS d'extinction ne sont PAS figés dans le SQL : durées reçues en arguments (AD-14)", () => {
    // La transition autoritaire vit dans 0010 puis 0011 (correctif) : ni l'une ni l'autre ne code de
    // durée en dur ; les deux passent par des paramètres (`episode-detresse` en est la source unique).
    for (const [f, sql] of [
      [MIGRATION_0010, readFileSync(MIGRATION_0010, "utf-8")],
      [MIGRATION_0011, readFileSync(MIGRATION_0011, "utf-8")],
    ] as const) {
      expect(sql, `aucun littéral d'intervalle dans ${f}`).not.toMatch(/interval\s+'/i);
    }
    // La version FAISANT AUTORITÉ est celle de 0011 (CREATE OR REPLACE) : elle reçoit les durées en args.
    const sql11 = readFileSync(MIGRATION_0011, "utf-8");
    expect(sql11).toMatch(/make_interval\(secs => p_duree_min_s\)/);
    expect(sql11).toMatch(/make_interval\(secs => p_fenetre_s\)/);
  });
});

const MODELE_RESSOURCES = resolve(racine, "lib/safety/ressources-aide.ts");
const AIDE_PAGE = resolve(racine, "app/aide/page.tsx");
const GARDE_COMMERCIALE = resolve(racine, "app/_commerce/GardeCommerciale.tsx");
const LIMITES = resolve(racine, "lib/safety/limites-commerciales.ts");
const LECTURE = resolve(racine, "lib/safety/episode-lecture.ts");
const CONSIGNE = resolve(racine, "lib/safety/consigne-detresse.ts");
const BLOC = resolve(racine, "lib/safety/bloc-ressources-detresse.ts");
const FLUX_NDJSON = resolve(racine, "lib/ai/flux-ndjson.ts");
const LENDEMAIN = resolve(racine, "lib/safety/lendemain.ts");

describe("Story 2.5 — filet hors-IA + garde de montage : invariants d'architecture (AD-9, AD-15, AD-7)", () => {
  it("le modèle `ressources-aide` reste PUR : aucun import runtime, pas de server-only, pas d'infra", () => {
    const src = lire(MODELE_RESSOURCES);
    expect(src, "aucun runtime import (seul `import type` est permis)").not.toMatch(/^\s*import\s+(?!type\b)/m);
    expect(src).not.toMatch(/server-only/);
    expect(src).not.toMatch(/@supabase|next\/|@\/lib\/data|@\/lib\/ai/);
  });

  it("le FILET `/aide` ne dépend d'AUCUN fournisseur IA (statique, AD-15)", () => {
    expect(lire(AIDE_PAGE)).not.toMatch(/@\/lib\/ai/);
  });

  it("la DÉCISION `limites_levees` vit dans `lib/safety` ; `render/` la consomme sans la dériver (AD-7)", () => {
    // La dérivation `fin IS NULL` (via episode_detresse_ouvert) est une SOURCE UNIQUE dans lib/safety…
    expect(lire(LECTURE)).toMatch(/episode_detresse_ouvert/);
    // …que la garde de montage consomme sans la réimplémenter (jamais deux horloges, AD-17)…
    expect(lire(LIMITES)).toMatch(/episodeDetresseOuvert/);
    expect(lire(LIMITES)).not.toMatch(/episode_detresse_ouvert/); // délègue, ne recopie pas la RPC
    // …et la garde de rendu NE parle jamais à la base ni ne dérive l'état elle-même (render muet).
    expect(lire(GARDE_COMMERCIALE)).not.toMatch(/episode_detresse_ouvert|@\/lib\/data\/supabase/);
    expect(lire(GARDE_COMMERCIALE)).toMatch(/limitesCommercialesLevees/);
  });
});

describe("Story 2.6 — réponse par niveaux : câblage serveur (AD-16, AD-5, AD-15)", () => {
  it("les modules de décision restent PURS (pas d'infra/IO) ; leurs imports runtime sont des purs siblings de lib/safety", () => {
    const consigne = lire(CONSIGNE);
    const bloc = lire(BLOC);
    const lendemain = lire(LENDEMAIN);
    // lendemain : AUCUN import runtime (type-only) — ne dépend d'aucune donnée.
    expect(lendemain, "lendemain : type-only").not.toMatch(/^\s*import\s+(?!type\b)/m);
    // bloc consomme la SOURCE UNIQUE des ressources ; consigne consomme `numeroEnTete` (voix ↔ carte, R1) —
    // des purs siblings de lib/safety, jamais une liste/un numéro inline.
    expect(bloc).toMatch(/import\s*\{\s*RESSOURCES_AIDE\s*\}\s*from\s*["']\.\/ressources-aide["']/);
    expect(consigne).toMatch(/import\s*\{[^}]*numeroEnTete[^}]*\}\s*from\s*["']\.\/bloc-ressources-detresse["']/);
    // tous : pas de server-only, pas d'infra ; aucun import RUNTIME d'infra ai/next (un `import type` reste permis).
    for (const src of [consigne, bloc, lendemain]) {
      expect(src).not.toMatch(/server-only/);
      expect(src).not.toMatch(/@supabase|@\/lib\/data/);
      expect(src, "aucun import RUNTIME d'infra ai/next").not.toMatch(
        /^\s*import\s+(?!type\b)[^;]*from\s*["'](?:next|@\/lib\/ai)/m,
      );
    }
  });

  it("la route INJECTE la consigne (system) dérivée du verdict, AVANT la génération (jamais reçue du client)", () => {
    const src = lire(ROUTE);
    expect(src).toMatch(/@\/lib\/safety\/consigne-detresse/);
    expect(src).toMatch(/consigneDetresse\s*=\s*consigneReponse\s*\(/); // dérivée du verdict
    expect(src).toMatch(/\[\s*\.\.\.prefixes\s*,\s*\.\.\.messages\s*\]/); // préfixée aux messages (server-authoritative, 2.7)
  });

  it("la route ÉMET le bloc ressources par une trame, placé avant/après selon le niveau (AC4)", () => {
    const src = lire(ROUTE);
    expect(src).toMatch(/@\/lib\/safety\/bloc-ressources-detresse/);
    expect(src).toMatch(/blocRessourcesDetresse\s*\(/);
    expect(src).toMatch(/t:\s*"ressources"/);
    expect(src).toMatch(/"avant"/);
    expect(src).toMatch(/"apres"/);
  });

  it("no-leak : la trame ressources ne sérialise NI niveau NI décision NI tier NI usage (seuls position/verifieLe/présentationnel)", () => {
    const src = lire(ROUTE);
    // Fenêtre couvrant TOUTE la construction de l'objet trame (jusqu'au `: null` du ternaire) — pas une
    // tranche fixe qui s'arrêterait avant un champ fuitant ajouté en fin d'objet (revue 2.6, R8).
    const fenetre = src.match(/t:\s*"ressources"[\s\S]*?:\s*null/)?.[0] ?? "";
    expect(fenetre, "la construction de la trame ressources doit être trouvée (garde non vacue)").not.toBe("");
    expect(fenetre, "aucune fuite niveau/decision/verdict/tier/usage dans la trame").not.toMatch(
      /niveau|decision|verdict|tier|usage/,
    );
  });

  it("le transport NDJSON : la trame `ressources` n'autorise QUE des champs présentationnels (contrat de type verrouillé, R8)", () => {
    const src = lire(FLUX_NDJSON);
    const variant = src.match(/t:\s*"ressources"[\s\S]*?\};/)?.[0] ?? "";
    expect(variant, "le variant `ressources` doit être trouvé").not.toBe("");
    for (const clef of ["position", "verifieLe", "ressources"]) expect(variant).toMatch(new RegExp(clef));
    expect(variant, "aucun champ fuitant niveau/decision/tier/usage dans le type de trame").not.toMatch(
      /niveau|decision|tier|usage/,
    );
  });
});

describe("Story 2.7 — arc de séance : câblage serveur (AD-16, AD-1, AD-5)", () => {
  it("l'arc s'exécute APRÈS la sécurité et AVANT la génération (sécurité → avancerArc → diffuser)", () => {
    const src = lire(ROUTE);
    const iSecurite = src.indexOf("evaluerSecuriteDuTour(");
    const iArc = src.indexOf("avancerArc(");
    const iFlux = src.indexOf("diffuserSousEgressArt9(");
    expect(iSecurite, "la route doit APPELER evaluerSecuriteDuTour").toBeGreaterThanOrEqual(0);
    expect(iArc, "la route doit APPELER avancerArc").toBeGreaterThanOrEqual(0);
    expect(iFlux, "la route doit ouvrir le flux de génération").toBeGreaterThanOrEqual(0);
    expect(iSecurite, "sécurité AVANT l'arc (AD-16)").toBeLessThan(iArc);
    expect(iArc, "arc AVANT la génération").toBeLessThan(iFlux);
  });

  it("l'arc CHARGE puis RÉÉCRIT la trace (dépôt réel service_role)", () => {
    const src = lire(ROUTE);
    expect(src).toMatch(/creerDepotSeance\s*\(/);
    expect(src).toMatch(/\.charger\s*\(/);
    expect(src).toMatch(/\.ecrire\s*\(/);
  });

  it("l'extraction de signaux passe par l'egress art. 9 (jamais l'adaptateur nu), puis le parser pur", () => {
    const src = lire(ROUTE);
    expect(src).toMatch(/requeteExtractionArc\s*\(/);
    expect(src).toMatch(/envoyerSousEgressArt9\s*\(/);
    expect(src).toMatch(/extraireSignauxArc\s*\(/);
  });

  it("l'arc LIT le niveau du verdict (une seule horloge, jamais une 2e détection)", () => {
    const src = lire(ROUTE);
    expect(src, "avancerArc reçoit niveauSecurite, dérivé du verdict").toMatch(/avancerArc\([^;]*niveauSecurite/);
  });

  it("la consigne de PHASE est injectée (system) avant la génération ; la détresse reste au plus près des messages", () => {
    const src = lire(ROUTE);
    expect(src).toMatch(/@\/lib\/domain\/consigne-phase/);
    expect(src).toMatch(/consignePhaseArc\s*\(/);
    // Ordre [consignePhase, consigneDetresse] → la consigne de détresse (2.6) est la DERNIÈRE avant messages.
    expect(src).toMatch(/\[\s*consignePhase\s*,\s*consigneDetresse\s*\]/);
  });

  it("no-leak : la trame `beat` émise n'a QUE t + beat (allowlist — revue 2.7)", () => {
    const src = lire(ROUTE);
    const emission = src.match(/emettre\(\{\s*t:\s*"beat"[\s\S]*?\}\)/)?.[0] ?? "";
    expect(emission, "l'émission de la trame beat doit être trouvée (garde non vacue)").not.toBe("");
    const champs = [...emission.matchAll(/(\w+)\s*:/g)].map((m) => m[1]);
    expect(champs.length).toBeGreaterThan(0);
    for (const c of champs) expect(["t", "beat"].includes(c), `champ inattendu (fuite) : ${c}`).toBe(true);
  });

  it("l'extraction d'arc est MÉTRÉE sous une clé distincte (jamais exemptée comme la détresse)", () => {
    const src = lire(ROUTE);
    expect(src).toMatch(/usageExtractionArc/);
    expect(src).toMatch(/metrerUsageIa/);
  });
});
