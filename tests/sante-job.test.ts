import { describe, it, expect } from "vitest";
import { executerSante } from "@/lib/ordonnanceur/jobs/sante";
import type { ContexteJob, JobEnregistre } from "@/lib/ordonnanceur/registre";
import type { DepotOrdonnanceur, EtatOrdonnanceur, TypeIncident } from "@/lib/data/depot-ordonnanceur";

/**
 * Story 4.8, éprouvé par la REVUE 4.10 — LE JOB DE SANTÉ ET SON BUDGET.
 *
 * ⚠️ CE FICHIER N'EXISTAIT PAS, et c'est ce qui a permis à la 4.10 de dégrader ce job sans que rien ne
 * le dise : son budget est passé de 12 s à 6 s pendant que le nombre de jobs à surveiller passait de
 * deux à trois — donc son pire cas de 3 à 4 allers-retours. Et il était le SEUL des trois jobs sans
 * garde de rendu de main, alors que ce patron est documenté dans l'en-tête du registre comme LA leçon
 * de la revue 4.9 (« Rendre la main proprement, c'est réussir »).
 *
 * Ce que ça coûtait : sous charge, `avecDelai` le coupait → `job_echoue` levé sur le job de SANTÉ,
 * c'est-à-dire sur la seule sonde du produit. Une alarme qui accuse l'alarme est la façon la plus sûre
 * de rendre une alarme inutile.
 */

function depotFactice(etat: Partial<EtatOrdonnanceur> = {}) {
  const incidents: { type: TypeIncident; job: string; detail: string | null }[] = [];
  const depot: DepotOrdonnanceur = {
    async environnementDeclare() {
      return "local";
    },
    async reclamer() {
      return true;
    },
    async clore() {},
    async etat(): Promise<EtatOrdonnanceur> {
      return { naissance: etat.naissance ?? null, reussites: etat.reussites ?? new Map() };
    },
    async leverIncident(type, job, detail) {
      incidents.push({ type, job, detail });
    },
  };
  return { depot, incidents };
}

/** Trois jobs, tous en retard : le pire cas que le registre puisse produire aujourd'hui. */
const REGISTRE_FACTICE: JobEnregistre[] = ["a", "b", "c"].map((nom) => ({
  nom,
  cadence: "quotidien" as const,
  toleranceHeures: 60,
  delaiMs: 1_000,
  enServiceDepuis: new Date("2026-01-01T00:00:00Z"),
  executer: async () => {},
}));

function contexte(depot: DepotOrdonnanceur, echeanceDansMs: number): ContexteJob {
  return {
    depot,
    instant: new Date("2026-08-06T06:00:00Z"),
    echeance: new Date(Date.now() + echeanceDansMs),
    registre: REGISTRE_FACTICE,
  };
}

describe("le job de santé lève un incident par job en retard", () => {
  it("[CONTRÔLE POSITIF] avec du budget, tous les retards sont signalés", async () => {
    // Sans ce contrôle, le test de rendu de main ci-dessous serait satisfait par un job qui ne lève
    // JAMAIS rien — un silence tout aussi cassé, et bien plus discret.
    const { depot, incidents } = depotFactice({ naissance: new Date("2026-01-01T00:00:00Z") });
    await executerSante(contexte(depot, 3_600_000));
    expect(incidents.map((i) => i.job)).toEqual(["a", "b", "c"]);
    expect(incidents.every((i) => i.type === "job_en_retard")).toBe(true);
    expect(incidents[0].detail).toBe("aucune_reussite_connue");
  });

  it("un job qui a réussi récemment n'est pas signalé", async () => {
    const { depot, incidents } = depotFactice({
      naissance: new Date("2026-01-01T00:00:00Z"),
      reussites: new Map([["b", new Date("2026-08-06T05:00:00Z")]]),
    });
    await executerSante(contexte(depot, 3_600_000));
    expect(incidents.map((i) => i.job)).toEqual(["a", "c"]);
  });
});

describe("[REVUE 4.10] il REND LA MAIN plutôt que de se faire couper", () => {
  it("[LE CŒUR] sans budget, il s'arrête proprement au lieu de continuer jusqu'à la coupure", async () => {
    // ⚠️ Se faire couper par `avecDelai` le clôt en `echoue` et lève un `job_echoue` — sur le job de
    // SANTÉ, c'est-à-dire une alarme qui dit que l'alarme est en panne, alors que le travail s'est
    // peut-être fait. C'est le « mensonge quotidien » que la revue 4.9 a corrigé pour la synthèse et
    // laissé intact ici, jusqu'à ce que la 4.10 réduise le budget de moitié.
    // Mutation-cible : retirer la garde `ctx.echeance.getTime() - Date.now() < RESERVE_INCIDENT_MS`.
    const { depot, incidents } = depotFactice({ naissance: new Date("2026-01-01T00:00:00Z") });
    await executerSante(contexte(depot, 0));
    expect(incidents, "aucun incident tenté quand il ne reste plus de budget").toHaveLength(0);
  });

  it("il s'arrête EN COURS de route, pas seulement au début", async () => {
    // La garde est dans la boucle : les incidents déjà levés le sont, les suivants reviendront au tick
    // suivant (ils sont dédoublonnés par jour). Mutation-cible : sortir la garde de la boucle.
    const { depot, incidents } = depotFactice({ naissance: new Date("2026-01-01T00:00:00Z") });
    let restant = 5_000;
    const depotLent: DepotOrdonnanceur = {
      ...depot,
      async leverIncident(type, job, detail) {
        restant -= 2_500; // chaque incident coûte cher : au deuxième, il ne reste plus de réserve
        await depot.leverIncident(type, job, detail);
      },
    };
    const ctx: ContexteJob = {
      ...contexte(depotLent, 0),
      get echeance() {
        return new Date(Date.now() + restant);
      },
    };
    await executerSante(ctx);
    expect(incidents.length, "il en lève quelques-uns, puis rend la main").toBeGreaterThan(0);
    expect(incidents.length, "sans aller jusqu'au bout du registre").toBeLessThan(REGISTRE_FACTICE.length);
  });
});
