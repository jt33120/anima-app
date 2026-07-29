import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Story 2.7 — les invariants d'ARCHITECTURE de l'arc de séance (AD-1, AD-7, AD-8, AD-16), prouvés par
 * lecture de fichiers (patron `pipeline-securite-architecture`). Ils vérifient ce que les tests
 * unitaires ne voient pas :
 *   - `lib/domain/` est PUR (aucun import runtime infra, aucun `server-only`) — première logique de domaine ;
 *   - la machine d'arc (`avancerArc`) est le PROPRIÉTAIRE UNIQUE des transitions (appelée par la seule route) ;
 *   - `render/` est MUET : aucun composant ne décide de phase/beat (il réagit à la trame `{t:"beat"}`, AD-7) ;
 *   - no-leak : la trame `beat` ne porte QUE l'identifiant du beat (contrat de type verrouillé).
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

const ROUTE = resolve(racine, "app/api/anam/message/route.ts");
const FLUX_NDJSON = resolve(racine, "lib/ai/flux-ndjson.ts");
const FLUX_CLIENT = resolve(racine, "render/conversation/flux-ndjson-client.ts");
const domaine = fichiersTs("lib/domain");
const tousSource = [...fichiersTs("app"), ...fichiersTs("lib"), ...fichiersTs("render")];

describe("Story 2.7 — pureté de la couche domaine (AD-1)", () => {
  it("a bien scanné la couche domaine (première logique de domaine posée)", () => {
    expect(domaine.length, "au moins les modules d'arc + la trace + la couture").toBeGreaterThanOrEqual(5);
  });

  it("lib/domain/*.ts : PURS — aucun `server-only`, aucun import RUNTIME d'infra (import type permis)", () => {
    for (const f of domaine) {
      const src = lire(f);
      expect(src, `server-only interdit : ${f}`).not.toMatch(/server-only/);
      // Un import RUNTIME (pas `import type`) depuis une infra est interdit. `import type` depuis
      // @/lib/ai/port et un import runtime d'un SIBLING pur (`./seuils-arc`) restent permis.
      expect(src, `import runtime infra interdit : ${f}`).not.toMatch(
        /^\s*import\s+(?!type\b)[^;]*from\s*["'](?:@supabase|next|next\/|@\/lib\/data|@\/lib\/ai|@\/app|@\/render)/m,
      );
    }
  });
});

describe("Story 2.7 — la machine d'arc, propriétaire unique des transitions (AD-8)", () => {
  it("`avancerArc` n'est appelée QUE par la route (aucune règle de phase ailleurs)", () => {
    const ARC_SEANCE = resolve(racine, "lib/domain/arc-seance.ts"); // le fichier de DÉFINITION, pas un appel
    const autres = tousSource.filter((f) => f !== ROUTE && f !== ARC_SEANCE);
    for (const f of autres) {
      expect(lire(f), `avancerArc hors route : ${f}`).not.toMatch(/avancerArc\s*\(/);
    }
    expect(lire(ROUTE), "contrôle positif : la route l'appelle").toMatch(/avancerArc\s*\(/);
  });
});

describe("Story 2.7 — render/ muet : aucune décision de phase/beat (AD-7)", () => {
  it("render/ ne connaît PAS la couche domaine (ni la machine, ni les seuils)", () => {
    for (const f of fichiersTs("render")) {
      expect(lire(f), `render ne dépend pas de lib/domain : ${f}`).not.toMatch(/@\/lib\/domain/);
      expect(lire(f), `aucune règle de phase/seuil dans le rendu : ${f}`).not.toMatch(/avancerArc|SEUIL_[A-Z]/);
    }
  });

  it("Conversation RÉAGIT à la trame beat (onBeat → setBeat), il ne la décide pas", () => {
    const conv = lire(resolve(racine, "render/conversation/Conversation.tsx"));
    expect(conv, "beat pilotable (setter), plus figé").toMatch(/const\s*\[\s*beat\s*,\s*setBeat\s*\]/);
    expect(conv, "piloté par onBeat").toMatch(/onBeat/);
  });
});

describe("Story 2.7 — la table `seance` naît deny-by-default (art. 9, AD-12)", () => {
  const MIGRATION = resolve(racine, "supabase/migrations/0012_seance.sql");
  it("RLS activée + FORCE, AUCUNE policy (server-authoritative, patron episode_detresse)", () => {
    const sql = readFileSync(MIGRATION, "utf-8");
    expect(sql).toMatch(/enable row level security/i);
    expect(sql).toMatch(/force\s+row level security/i);
    expect(sql, "server-authoritative : aucune policy cliente").not.toMatch(/create policy/i);
  });

  it("les accès sont réservés à service_role (revoke public/anon/authenticated + grant service_role)", () => {
    const sql = readFileSync(MIGRATION, "utf-8");
    for (const fn of ["charger_seance", "ecrire_seance"]) {
      expect(sql, `revoke sur ${fn}`).toMatch(new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${fn}`, "i"));
      expect(sql, `grant service_role sur ${fn}`).toMatch(
        new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${fn}[\\s\\S]*?to\\s+service_role`, "i"),
      );
    }
  });

  it("aucun seuil de phase figé en SQL : la logique vit dans lib/domain (AD-14)", () => {
    const sql = readFileSync(MIGRATION, "utf-8");
    // La table est un STORE de signaux — aucune comparaison de seuil (≥ 1/2/3) ni intervalle de temps
    // en SQL. Les `>= 0` de non-négativité (intégrité de données) restent permis, jamais un seuil ≥ 1.
    expect(sql, "aucun seuil de phase (≥ 1/2/3) ni minuteur dans le SQL").not.toMatch(/>=\s*[1-9]|make_interval\s*\(/i);
  });
});

describe("Story 2.7 — no-leak : la trame `beat` ne porte QUE l'identifiant du beat", () => {
  // ALLOWLIST (revue 2.7) : une blocklist partielle laissait passer observationDelivree/debutMs/
  // finProposee/aReponseLongue/deuxDernieresPropositions (aucun n'était dans la liste). On prouve que
  // le variant n'a QUE les champs `t` et `beat` — l'invariant réel, pas « absence de quelques chaînes ».
  const PERMIS = new Set(["t", "beat"]);
  const champsDe = (variant: string) => [...variant.matchAll(/(\w+)\s*:/g)].map((m) => m[1]);

  it("le transport NDJSON serveur (`TrameClient`) : le variant beat n'a QUE t + beat", () => {
    const variant = lire(FLUX_NDJSON).match(/\{\s*t:\s*"beat"[\s\S]*?\}/)?.[0] ?? "";
    expect(variant, "le variant beat serveur doit être trouvé (garde non vacue)").not.toBe("");
    const champs = champsDe(variant);
    expect(champs.length).toBeGreaterThan(0);
    for (const c of champs) expect(PERMIS.has(c), `champ inattendu (fuite) dans la trame beat : ${c}`).toBe(true);
  });

  it("le miroir client (`TrameRecue`) : le variant beat n'a QUE t + beat", () => {
    const variant = lire(FLUX_CLIENT).match(/\{\s*t:\s*"beat"[\s\S]*?\}/)?.[0] ?? "";
    expect(variant, "le variant beat client doit être trouvé").not.toBe("");
    for (const c of champsDe(variant)) expect(PERMIS.has(c), `champ inattendu (fuite) dans la trame beat : ${c}`).toBe(true);
  });
});
