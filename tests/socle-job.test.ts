import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ContexteJob } from "@/lib/ordonnanceur/registre";
import type { AbonnementPoussee, VerdictPoussee } from "@/lib/poussee/port";
import type { DepotPoussee } from "@/lib/data/depot-poussee";

/**
 * Story 6.2 (T5) — LE JOB DU SOCLE, avec toutes ses dépendances doublées.
 *
 * Ce que ce fichier éprouve et qu'aucun test SQL ne peut : l'ORDRE des gestes et ce qui se passe
 * quand l'un rate. Le fan-out du socle a exactement les mêmes pièges que celui du rappel (4.10), plus
 * un qui lui est propre : plusieurs appareils par personne, dont certains morts.
 */

// Le palier entre par la porte du test — c'est la seule façon d'éprouver les DEUX branches d'AC8 sans
// changer `PALIER` dans le code de production.
let palierCapable = true;
vi.mock("@/lib/domain/socle-quotidien", async (original) => ({
  ...(await original<typeof import("@/lib/domain/socle-quotidien")>()),
  palierHonoreLHeure: () => palierCapable,
}));

const {
  executerSocleQuotidienAvec,
  PLAFOND_SOCLE_HEURES,
  LOT_PAR_TICK,
  DELAI_JOB_SOCLE_MS,
  RESERVE_PERSONNE_POUSSEE_MS,
} = await import("@/lib/ordonnanceur/jobs/socle-quotidien");

interface Trace {
  endpointsLus: string[];
  reserves: { id: string; motif: string; cle: string; plafond: number }[];
  liberees: { id: string; cle: string }[];
  pousses: string[];
  oublies: string[];
  ordre: string[];
}

interface Options {
  dues?: { utilisatriceId: string; jour: string }[];
  appareils?: Record<string, AbonnementPoussee[]>;
  reserveRend?: boolean;
  verdicts?: Record<string, VerdictPoussee>;
  configure?: boolean;
  echeanceDans?: number;
  endpointsLeve?: string;
}

const appareil = (endpoint: string): AbonnementPoussee => ({
  endpoint,
  p256dh: "B".repeat(87),
  auth: "A".repeat(22),
});

function monter(o: Options = {}) {
  const trace: Trace = { endpointsLus: [], reserves: [], liberees: [], pousses: [], oublies: [], ordre: [] };
  const depot: DepotPoussee = {
    async endpoints(id) {
      trace.endpointsLus.push(id);
      trace.ordre.push(`endpoints:${id}`);
      if (o.endpointsLeve === id) throw new Error("base_muette");
      return o.appareils?.[id] ?? [appareil(`https://web.push.apple.com/${id}`)];
    },
    async reserverPoussee(id, motif, cle, plafond) {
      trace.reserves.push({ id, motif, cle, plafond });
      trace.ordre.push(`reserve:${id}`);
      return o.reserveRend ?? true;
    },
    async libererPoussee(id, _motif, cle) {
      trace.liberees.push({ id, cle });
      trace.ordre.push(`libere:${id}`);
    },
    async oublierEndpoint(endpoint) {
      trace.oublies.push(endpoint);
      trace.ordre.push(`oubli:${endpoint}`);
    },
  };
  const ctx: ContexteJob = {
    depot: {} as ContexteJob["depot"],
    instant: new Date(),
    echeance: new Date(Date.now() + (o.echeanceDans ?? DELAI_JOB_SOCLE_MS)),
    registre: [],
  };
  const deps = {
    depot,
    poussee: {
      estConfigure: () => o.configure ?? true,
      async reveiller(a: AbonnementPoussee): Promise<VerdictPoussee> {
        trace.pousses.push(a.endpoint);
        trace.ordre.push(`pousse:${a.endpoint}`);
        return o.verdicts?.[a.endpoint] ?? "poussee";
      },
    },
    dues: async () => o.dues ?? [{ utilisatriceId: "u1", jour: "2026-08-15" }],
  };
  return { ctx, deps, trace };
}

// ⚠️ `console.warn` et pas `console.info` : `journaliserExploitation` écrit en `warn`
// (`lib/safety/rpc-repli.ts:77`). Espionner la mauvaise voie rendrait CHAQUE assertion de
// journalisation de ce fichier vide — elles chercheraient une chaîne dans un tableau toujours vide,
// et `not.toContain` serait vrai pour toujours.
let espion: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  palierCapable = true;
  espion = vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("[6.2/AC8] le palier décide AVANT tout le reste", () => {
  it("[LE CŒUR] un palier incapable ne lit RIEN et ne pousse RIEN", async () => {
    // ⚠️ Mutation-cible : déplacer ce refus après `deps.dues(...)`, ou le supprimer. Le second cas
    // pousse à l'heure du hasard (±59 min de dérive), c'est-à-dire un effet DE PLUS dans le repli —
    // l'inverse exact d'AD-15. Le premier ne pousse pas non plus, mais consulte la base tous les
    // jours pour rien, et surtout il déplace la garde là où le prochain refactor la perdra.
    palierCapable = false;
    const { ctx, deps, trace } = monter();
    const lues = vi.spyOn(deps, "dues");
    await executerSocleQuotidienAvec(ctx, deps);
    expect(lues, "la base a été consultée pour une heure qu'on sait ne pas pouvoir honorer").not.toHaveBeenCalled();
    expect(trace.reserves).toEqual([]);
    expect(trace.pousses).toEqual([]);
  });

  it("le refus de palier SE DIT — sinon le mécanisme est inerte en silence", async () => {
    palierCapable = false;
    const { ctx, deps } = monter();
    await executerSocleQuotidienAvec(ctx, deps);
    expect(JSON.stringify(espion.mock.calls)).toContain("socle_palier_incapable");
  });

  it("[CONTRÔLE POSITIF] un palier capable, lui, pousse", async () => {
    const { ctx, deps, trace } = monter();
    await executerSocleQuotidienAvec(ctx, deps);
    expect(trace.pousses).toHaveLength(1);
  });
});

describe("[6.2/AC2] l'ordre des gestes, et le plafond", () => {
  it("[LE CŒUR] on lit les appareils AVANT de réserver", async () => {
    // Patron 4.9/4.10 : tout ce qui peut EMPÊCHER l'envoi est connu avant de consommer le droit
    // d'envoyer. Réserver puis découvrir qu'elle s'est désabonnée lui coûterait sa journée — la clé
    // du jour serait prise, et rien ne serait parti.
    const { ctx, deps, trace } = monter();
    await executerSocleQuotidienAvec(ctx, deps);
    expect(trace.ordre.indexOf("endpoints:u1")).toBeLessThan(trace.ordre.indexOf("reserve:u1"));
    expect(trace.ordre.indexOf("reserve:u1")).toBeLessThan(
      trace.ordre.findIndex((e) => e.startsWith("pousse:")),
    );
  });

  it("sans aucun appareil, aucune réservation n'est consommée", async () => {
    const { ctx, deps, trace } = monter({ appareils: { u1: [] } });
    await executerSocleQuotidienAvec(ctx, deps);
    expect(trace.reserves).toEqual([]);
    expect(trace.pousses).toEqual([]);
  });

  it("une réservation refusée n'entraîne aucune poussée", async () => {
    const { ctx, deps, trace } = monter({ reserveRend: false });
    await executerSocleQuotidienAvec(ctx, deps);
    expect(trace.pousses).toEqual([]);
    expect(trace.liberees, "on ne libère pas ce qu'on n'a pas réservé").toEqual([]);
  });

  it("[LE CŒUR] le plafond de famille est de 20 h — jamais 24", async () => {
    // ⚠️ Mutation-cible : `PLAFOND_SOCLE_HEURES = 24`. Deux manifestations à la même heure deux jours
    // de suite sont alors séparées d'EXACTEMENT la borne, et la moindre dérive du côté court fait
    // refuser la seconde : la notification disparaît un jour sur deux, selon l'horaire. C'est la
    // faute de l'homme mort à 48 h (revue 4.8, défaut n°9), transposée.
    expect(PLAFOND_SOCLE_HEURES).toBe(20);
    expect(PLAFOND_SOCLE_HEURES).toBeLessThan(24);
    const { ctx, deps, trace } = monter();
    await executerSocleQuotidienAvec(ctx, deps);
    expect(trace.reserves[0]).toEqual({
      id: "u1",
      motif: "socle_quotidien",
      cle: "2026-08-15",
      plafond: PLAFOND_SOCLE_HEURES,
    });
  });

  it("la clé d'idempotence est le JOUR rendu par la base, jamais une date recalculée ici", async () => {
    // La base calcule le jour civil Paris (0053, leçon de 0046). Le job le transporte tel quel : le
    // recalculer côté applicatif rouvrirait la question du fuseau à chaque appelant.
    const { ctx, deps, trace } = monter({ dues: [{ utilisatriceId: "u9", jour: "1999-01-02" }] });
    await executerSocleQuotidienAvec(ctx, deps);
    expect(trace.reserves[0].cle).toBe("1999-01-02");
  });

  it("un port non configuré ne réserve rien", async () => {
    const { ctx, deps, trace } = monter({ configure: false });
    await executerSocleQuotidienAvec(ctx, deps);
    expect(trace.reserves).toEqual([]);
    expect(trace.endpointsLus).toEqual([]);
  });
});

describe("[6.2] plusieurs appareils, et ceux qui sont morts", () => {
  const troisAppareils = {
    u1: [appareil("https://a/1"), appareil("https://b/2"), appareil("https://c/3")],
  };

  it("tous les appareils vivants sont réveillés, et la réservation reste prise", async () => {
    const { ctx, deps, trace } = monter({ appareils: troisAppareils });
    await executerSocleQuotidienAvec(ctx, deps);
    expect(trace.pousses).toEqual(["https://a/1", "https://b/2", "https://c/3"]);
    expect(trace.reserves).toHaveLength(1);
    expect(trace.liberees).toEqual([]);
  });

  it("[LE CŒUR] un 410 fait OUBLIER l'endpoint — un 503 n'y touche PAS", async () => {
    // ⚠️ Mutation-cible : traiter tout verdict non « poussée » comme un endpoint mort. Un 503
    // passager désabonnerait alors quelqu'un sans qu'elle l'ait demandé et sans qu'elle le sache :
    // la notification cesserait simplement d'arriver, et le bouton des réglages afficherait toujours
    // « cet appareil reçoit ».
    const { ctx, deps, trace } = monter({
      appareils: troisAppareils,
      verdicts: { "https://a/1": "endpoint_mort", "https://b/2": "refuse", "https://c/3": "poussee" },
    });
    await executerSocleQuotidienAvec(ctx, deps);
    expect(trace.oublies).toEqual(["https://a/1"]);
    // Un appareil a reçu : la réservation est légitime, on ne la rend pas.
    expect(trace.liberees).toEqual([]);
  });

  it("[LE CŒUR] AUCUN appareil atteint ⇒ la réservation est RENDUE", async () => {
    // ⚠️ `notification_envoyee` est une table d'AUDIT. Y laisser une ligne alors que rien n'est parti,
    // c'est y écrire un fait faux — et c'est aussi ce qui empêcherait un rejeu du tick dans la même
    // heure de réparer la journée.
    const { ctx, deps, trace } = monter({
      appareils: troisAppareils,
      verdicts: { "https://a/1": "refuse", "https://b/2": "refuse", "https://c/3": "endpoint_mort" },
    });
    await executerSocleQuotidienAvec(ctx, deps);
    expect(trace.liberees).toEqual([{ id: "u1", cle: "2026-08-15" }]);
    expect(trace.oublies).toEqual(["https://c/3"]);
  });
});

describe("[6.2/AC3] le lot, la réserve de fin, et l'échec d'une seule", () => {
  it("[LE CŒUR] le job REND LA MAIN avant d'être coupé, et dit combien il en reste", async () => {
    // Se faire couper par `avecDelai` clôt le job en `echoue` et lève un `job_echoue` — alors que
    // tout le monde a peut-être été servi. Ce mensonge quotidien ferait répondre `degrade` à la sonde
    // publique en permanence, ce qui est la façon la plus sûre de rendre une alarme inutile.
    const dues = Array.from({ length: 5 }, (_, i) => ({ utilisatriceId: `u${i}`, jour: "2026-08-15" }));
    const { ctx, deps, trace } = monter({ dues, echeanceDans: RESERVE_PERSONNE_POUSSEE_MS - 1 });
    await executerSocleQuotidienAvec(ctx, deps);
    expect(trace.pousses, "le job a travaillé alors qu'il n'avait plus la réserve d'une personne").toEqual([]);
    expect(JSON.stringify(espion.mock.calls)).toContain("socle_lot_incomplet");
  });

  it("un lot PLEIN se dit — au-delà, des journées sont perdues sans rattrapage", async () => {
    const dues = Array.from({ length: LOT_PAR_TICK }, (_, i) => ({
      utilisatriceId: `u${i}`,
      jour: "2026-08-15",
    }));
    const { ctx, deps } = monter({ dues });
    await executerSocleQuotidienAvec(ctx, deps);
    expect(JSON.stringify(espion.mock.calls)).toContain("socle_lot_sature");
  });

  it("[LE CŒUR] l'échec d'UNE personne ne prive pas les suivantes", async () => {
    const { ctx, deps, trace } = monter({
      dues: [
        { utilisatriceId: "u1", jour: "2026-08-15" },
        { utilisatriceId: "u2", jour: "2026-08-15" },
      ],
      endpointsLeve: "u1",
    });
    await executerSocleQuotidienAvec(ctx, deps);
    expect(trace.pousses).toEqual(["https://web.push.apple.com/u2"]);
    expect(JSON.stringify(espion.mock.calls)).toContain("socle_poussee");
  });

  it("[ANTI-VACUITÉ] zéro personne due ne lève ni alarme ni incident", async () => {
    // La plupart des heures, personne n'a choisi celle-là. Une alarme sur « aucune poussée »
    // hurlerait vingt-trois fois par jour, et une alarme qui hurle est une alarme que personne ne lit.
    const { ctx, deps, trace } = monter({ dues: [] });
    await executerSocleQuotidienAvec(ctx, deps);
    expect(trace.reserves).toEqual([]);
    expect(JSON.stringify(espion.mock.calls)).not.toContain("socle_poussees");
    expect(JSON.stringify(espion.mock.calls)).not.toContain("socle_lot_sature");
  });
});
