import { describe, it, expect, vi } from "vitest";
import { COUT_ETAT_MS, executerSante, RESERVE_INCIDENT_MS } from "@/lib/ordonnanceur/jobs/sante";
import { REGISTRE } from "@/lib/ordonnanceur/registre";
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
      return "jeton-essai";
    },
    async clore() {
      return true;
    },
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
  // Story 6.1 — requis sur `JobEnregistre`. Sans plancher déclaré, un job passerait au travers de la
  // garde d'anti-vacuité qui compte les jobs COUVERTS et non les jobs déclarés.
  reserveMs: 500,
  enServiceDepuis: new Date("2026-01-01T00:00:00Z"),
  executer: async () => {},
}));

/**
 * Un instant où TOUS les jobs du registre réel sont en retard.
 *
 * Il est dérivé, jamais écrit en dur : une date figée deviendrait fausse le jour où un job entre au
 * registre avec un `enServiceDepuis` plus récent, et le test tomberait à zéro incident — c'est-à-dire
 * vert pour la mauvaise raison, puisque l'assertion porterait alors sur `0 === 0`.
 */
const INSTANT_TOUT_EN_RETARD = new Date(
  Math.max(...REGISTRE.map((j) => j.enServiceDepuis.getTime() + j.toleranceHeures * 3_600_000)) + 3_600_000,
);

/**
 * Un dépôt qui CONSOMME DU TEMPS — le seul avec lequel une garde de budget veut dire quelque chose.
 *
 * ⚠️ Le `depotFactice` ordinaire répond en ~0 ms : `Date.now()` ne bouge pas, et toute assertion sur
 * le budget se réduit alors à « `delaiMs` dépasse-t-il une seule réserve ? ». C'est ce qui rendait la
 * garde du plancher décorative (trouvé en revue de la 6.1).
 *
 * Les coûts simulés sont EXACTEMENT ceux dont le plancher est dérivé — `COUT_ETAT_MS` pour la lecture
 * d'état, `RESERVE_INCIDENT_MS` par incident. À employer sous `vi.useFakeTimers()`.
 */
function depotQuiConsommeDuTemps() {
  const incidents: { type: TypeIncident; job: string; detail: string | null }[] = [];
  const depot: DepotOrdonnanceur = {
    async environnementDeclare() {
      return "local";
    },
    async reclamer() {
      return "jeton-essai";
    },
    async clore() {
      return true;
    },
    async etat(): Promise<EtatOrdonnanceur> {
      vi.advanceTimersByTime(COUT_ETAT_MS);
      return { naissance: new Date("2026-01-01T00:00:00Z"), reussites: new Map() };
    },
    async leverIncident(type, job, detail) {
      vi.advanceTimersByTime(RESERVE_INCIDENT_MS);
      incidents.push({ type, job, detail });
    },
  };
  return { depot, incidents };
}

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

  it("[6.1] et il le DIT — le rendu de main ne se fait plus en silence", async () => {
    // ⚠️ Ce chemin était le seul des trois à se taire. `synthese.ts:170` et `rappel-echeance.ts:102`
    // journalisent tous deux quand ils rendent la main ; la seule ALARME du produit ne journalisait
    // rien. Un rendu de main clôt le job en `reussi` — il n'a pas échoué, il a rendu la main —, donc
    // l'homme mort voit une réussite et la sonde publique répond `ok` alors qu'aucun `job_en_retard`
    // n'a été levé pour personne.
    //
    // Mutation-cible : retirer le `journaliserExploitation` de `sante.ts`. Ce test doit rougir.
    const { depot } = depotFactice({ naissance: new Date("2026-01-01T00:00:00Z") });
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await executerSante(contexte(depot, 0));
    expect(spy, "le silence était le défaut ; parler est la correction").toHaveBeenCalled();
    const motifs = spy.mock.calls.map((appel) => (appel[1] as { motif?: string })?.motif);
    expect(motifs, "sous un motif reconnaissable dans les journaux d'exploitation").toContain(
      "sante_lot_incomplet",
    );
    // Le rang part sous `code`, et il n'identifie personne : c'est une position dans le registre.
    const codes = spy.mock.calls.map((appel) => (appel[1] as { code?: string })?.code);
    expect(codes, "combien de jobs n'ont pas été regardés — jamais QUI").toContain(
      `restants_${REGISTRE_FACTICE.length}`,
    );
    spy.mockRestore();
  });
});

describe("[6.1/AC6] le budget de ce job GRANDIT avec le registre", () => {
  it("[LE CŒUR] son `delaiMs` couvre la lecture d'état PLUS un test de réserve par job", async () => {
    // Son propre en-tête l'annonçait depuis la 4.10 — « un job de plus au registre taxe DEUX fois ce
    // budget » — et RIEN ne le vérifiait. C'est le genre de commentaire qui rassure exactement autant
    // qu'une garde, et qui ne fait rien.
    //
    // Le « + 1 » : la boucle teste la réserve AVANT chaque `leverIncident`, donc un registre de N jobs
    // demande N tests, plus le dernier qui doit encore pouvoir passer.
    //
    // ⚠️ Cette garde DOIT rougir au premier job ajouté à l'Epic 6 (6 000 < 9 600 dès quatre jobs).
    // C'est son travail, pas une régression : la story qui ajoute un job monte `sante.delaiMs`, donc
    // `Σ`, donc `BUDGET_TICK_MS` et le littéral `maxDuration`, dans le même commit.
    const sante = REGISTRE.find((j) => j.nom === "sante-ordonnanceur");
    expect(sante, "le job de santé est au registre").toBeDefined();
    const plancher = COUT_ETAT_MS + RESERVE_INCIDENT_MS * (REGISTRE.length + 1);
    expect(
      sante!.delaiMs,
      `${REGISTRE.length} jobs à surveiller : il lui faut ${plancher} ms, il en a ${sante!.delaiMs}`,
    ).toBeGreaterThanOrEqual(plancher);
  });

  it("[LE CŒUR] avec le VRAI budget du registre, il sert TOUS les jobs — pas « au moins un »", async () => {
    // ⚠️ CE TEST NE MESURAIT AUCUN BUDGET (corrigé en revue de la 6.1). Le dépôt factice répondant en
    // ~0 ms, `Date.now()` ne bougeait pas de tout le job : la condition de rendu de main se réduisait
    // à `delaiMs < RESERVE_INCIDENT_MS`, soit 1 200 ms. Rogner `sante.delaiMs` de 6 000 à 2 000 —
    // la mutation que le commentaire de ce test NOMMAIT — le laissait vert. Les deux gardes
    // annoncées comme indépendantes (« l'une regarde l'arithmétique, l'autre regarde l'effet »)
    // n'en faisaient donc qu'une : c'est exactement le piège des défenses redondantes.
    //
    // Le temps est désormais SIMULÉ et CONSOMMÉ par le dépôt : `etat()` coûte `COUT_ETAT_MS`, chaque
    // `leverIncident` coûte `RESERVE_INCIDENT_MS`. C'est le modèle dont le plancher est dérivé, et
    // c'est ce qui rend les deux gardes réellement indépendantes — l'une lit l'arithmétique du
    // registre, l'autre exerce le code.
    vi.useFakeTimers();
    try {
      await scenarioBudgetReel();
    } finally {
      vi.useRealTimers();
    }
  });

  async function scenarioBudgetReel() {
    // ⚠️ Le trou que cette story ferme. Les deux tests de rendu de main ci-dessus tournent sur un
    // registre FACTICE de trois jobs à `delaiMs: 1_000`, avec une échéance FORGÉE — 3 600 000 ms
    // (600 fois le budget réel) ou 0. Le chemin n'était donc JAMAIS exercé avec le `delaiMs` réel du
    // registre : on prouvait que la garde fonctionne, jamais que le budget suffit.
    //
    // Mutation-cible : rogner `sante.delaiMs` à 2 000 « puisqu'il ne fait que lire un état ». La
    // garde du plancher ci-dessus rougit ; celle-ci aussi, et par un autre chemin — l'une regarde
    // l'arithmétique, l'autre regarde l'effet.
    const sante = REGISTRE.find((j) => j.nom === "sante-ordonnanceur")!;
    const { depot, incidents } = depotQuiConsommeDuTemps();
    const ctx: ContexteJob = {
      depot,
      // ⚠️ Bien APRÈS le `enServiceDepuis` de chacun, plus sa tolérance : avec le registre réel, un
      // instant proche de la mise en service ne produit AUCUN retard, et le test serait vert à zéro
      // incident — exactement l'illusion qu'il existe pour détruire.
      instant: INSTANT_TOUT_EN_RETARD,
      // L'échéance RÉELLE que le répartiteur pose : `Date.now() + job.delaiMs` (`executer.ts:82`).
      echeance: new Date(Date.now() + sante.delaiMs),
      // Et le registre RÉEL, avec sa vraie longueur — c'est elle qui fixe le nombre d'incidents dus.
      registre: REGISTRE,
    };
    await executerSante(ctx);
    expect(
      incidents.length,
      `avec ${sante.delaiMs} ms, les ${REGISTRE.length} jobs du registre doivent TOUS être signalés`,
    ).toBe(REGISTRE.length);
  }

  it("[LE CŒUR] et il ROUGIT si le budget est rogné — la preuve que la garde mesure bien le budget", async () => {
    // Le pendant du test ci-dessus, et la raison pour laquelle il a fallu simuler le temps : sans
    // cette preuve, « il les sert tous » pourrait être vrai d'un job qui ignore complètement son
    // échéance. Ici on rejoue la même scène avec le budget MUTÉ, et on exige l'échec.
    //
    // 2 000 ms est la mutation exacte que la campagne applique : après `etat()` (1 200 ms), il reste
    // 800 ms — moins que la réserve d'un seul incident. Le job rend la main sans en lever aucun.
    vi.useFakeTimers();
    try {
      const { depot, incidents } = depotQuiConsommeDuTemps();
      const espion = vi.spyOn(console, "warn").mockImplementation(() => {});
      await executerSante({
        depot,
        instant: INSTANT_TOUT_EN_RETARD,
        echeance: new Date(Date.now() + 2_000),
        registre: REGISTRE,
      });
      expect(incidents.length, "2 000 ms ne suffisent pas : aucun incident levé").toBe(0);
      expect(espion, "et le rendu de main se dit").toHaveBeenCalled();
      espion.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });

  it("[LE CŒUR] il s'arrête EN COURS DE LOT — la preuve que CHAQUE incident coûte", async () => {
    // ⚠️ LE TROU QUE LA CAMPAGNE DE MUTATION A RÉVÉLÉ, et que ni la revue ni moi n'avions vu : retirer
    // le coût par incident du dépôt de test laissait tous les autres tests VERTS. Ils prouvaient donc
    // que la lecture d'état coûte — le terme `COUT_ETAT_MS` — et RIEN du terme
    // `RESERVE_INCIDENT_MS × (n + 1)`, qui est pourtant celui qui fait grandir le plancher avec le
    // registre, c'est-à-dire toute la raison d'être de cette garde.
    //
    // La scène qui les distingue : un budget suffisant pour DÉMARRER mais pas pour finir le lot.
    //
    //   échéance = COUT_ETAT_MS + RESERVE_INCIDENT_MS × 2 = 3 600 ms
    //   avec le coût par incident : etat (1 200) → 2 400 ; deux incidents → 0 ; le troisième renonce
    //   sans le coût par incident   : etat (1 200) → 2 400 ; les trois passent, car 2 400 ≥ 1 200
    //
    // Mutation-cible : retirer le `vi.advanceTimersByTime(RESERVE_INCIDENT_MS)` de `leverIncident`.
    vi.useFakeTimers();
    try {
      const { depot, incidents } = depotQuiConsommeDuTemps();
      const espion = vi.spyOn(console, "warn").mockImplementation(() => {});
      await executerSante({
        depot,
        instant: INSTANT_TOUT_EN_RETARD,
        echeance: new Date(Date.now() + COUT_ETAT_MS + RESERVE_INCIDENT_MS * 2),
        registre: REGISTRE,
      });
      expect(
        incidents.length,
        "de quoi en lever exactement deux, puis rendre la main — pas les trois",
      ).toBe(2);
      expect(incidents.length, "et strictement moins que le registre").toBeLessThan(REGISTRE.length);
      expect(espion, "le lot incomplet se dit").toHaveBeenCalled();
      espion.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });

  it("[ANTI-VACUITÉ] la même scène avec une échéance trop courte en sert STRICTEMENT MOINS", async () => {
    // Sans ce contre-exemple, le test ci-dessus serait satisfait par un job qui ignore complètement
    // son échéance — il servirait tout le monde quel que soit le budget, et l'assertion « il les sert
    // tous » ne dirait rien du budget. Le couple des deux dit la propriété ; aucun ne la dit seul.
    const { depot, incidents } = depotFactice({ naissance: new Date("2026-01-01T00:00:00Z") });
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await executerSante({
      depot,
      instant: INSTANT_TOUT_EN_RETARD,
      echeance: new Date(Date.now() + RESERVE_INCIDENT_MS - 1),
      registre: REGISTRE,
    });
    expect(incidents.length, "budget insuffisant : il rend la main").toBeLessThan(REGISTRE.length);
    spy.mockRestore();
  });
});
