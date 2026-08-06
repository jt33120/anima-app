import { describe, it, expect, vi } from "vitest";
import { executerOrdonnanceur } from "@/lib/ordonnanceur/executer";
import { codeDErreur } from "@/lib/domain/code-erreur";
import { executerSante } from "@/lib/ordonnanceur/jobs/sante";
import type { JobEnregistre } from "@/lib/ordonnanceur/registre";
import type { DepotOrdonnanceur, EtatOrdonnanceur, TypeIncident } from "@/lib/data/depot-ordonnanceur";

/**
 * Story 4.8 (T5/T7) — LE RÉPARTITEUR, sur dépôt factice. La base réelle prouve la réclamation
 * (`ordonnanceur-sql`) ; ici on prouve les DÉCISIONS du répartiteur, y compris celles qu'on ne peut pas
 * provoquer à volonté contre un vrai Postgres : un job qui pend, un dépôt qui tombe au mauvais moment.
 */

interface Trace {
  reclames: string[];
  /**
   * La CLÉ DE FENÊTRE telle qu'elle part vers la base, réclamation par réclamation. Le dépôt factice la
   * jetait (revue 4.8, défaut n°7) : rien dans toute la suite ne reliait la clé écrite en base à
   * `fenetreDe(cadence, instant)`. Le répartiteur aurait pu passer une constante, ou la cadence du mauvais
   * job, et les 1555 tests seraient restés verts pendant que l'idempotence — la seule chose que cette
   * story promet — cessait d'exister.
   */
  fenetres: { job: string; fenetre: string; bail: number }[];
  clos: { job: string; reussi: boolean; motif: string | null }[];
  fenetresCloses: { job: string; fenetre: string }[];
  incidents: { type: TypeIncident; job: string; detail: string | null }[];
}

function depotFactice(
  options: {
    reclamer?: (job: string) => boolean | Promise<boolean>;
    clore?: (reussi: boolean) => void;
    etat?: EtatOrdonnanceur;
    environnement?: string | null;
  } = {},
): { depot: DepotOrdonnanceur; trace: Trace } {
  const trace: Trace = { reclames: [], fenetres: [], clos: [], fenetresCloses: [], incidents: [] };
  const depot: DepotOrdonnanceur = {
    async environnementDeclare() {
      return options.environnement === undefined ? "local" : options.environnement;
    },
    async reclamer(job, fenetre, _c, bail) {
      trace.reclames.push(job);
      trace.fenetres.push({ job, fenetre, bail });
      return options.reclamer ? await options.reclamer(job) : true;
    },
    async clore(job, fenetre, _c, reussi, motif) {
      options.clore?.(reussi);
      trace.clos.push({ job, reussi, motif });
      trace.fenetresCloses.push({ job, fenetre });
    },
    async etat() {
      return options.etat ?? { naissance: null, reussites: new Map() };
    },
    async leverIncident(type, job, detail) {
      trace.incidents.push({ type, job, detail });
    },
  };
  return { depot, trace };
}

function job(
  nom: string,
  executer: JobEnregistre["executer"],
  delaiMs = 50,
  cadence: JobEnregistre["cadence"] = "quotidien",
): JobEnregistre {
  return {
    nom,
    cadence,
    toleranceHeures: 48,
    delaiMs,
    enServiceDepuis: new Date("2026-01-01T00:00:00Z"),
    executer,
  };
}

describe("[NFR-020/NFR-022] `codeDErreur` — on ne peut pas assainir un message, seulement reconnaître les siens", () => {
  it("garde les codes de nos RPC et nos codes internes", () => {
    expect(codeDErreur(new Error("reclamer_execution: 42501"))).toBe("reclamer_execution: 42501");
    expect(codeDErreur(new Error("sante_ordonnanceur_timeout"))).toBe("sante_ordonnanceur_timeout");
    expect(codeDErreur(new Error("etat_ordonnanceur: PGRST202"))).toBe("etat_ordonnanceur: PGRST202");
  });

  it("[LE CŒUR] jette tout ce qu'il ne reconnaît pas", () => {
    // Mutation-cible : écrire le message tel quel « pour faciliter le débogage ». Un message d'erreur est un
    // ramasse-miettes : il a pu traverser un adaptateur qui recopie l'entrée, une bibliothèque qui cite la
    // valeur fautive, un pilote qui rend la ligne. La table `execution_job` n'a aucune colonne de contenu —
    // ce filtre est ce qui empêche d'en fabriquer une par la bande.
    for (const message of [
      "Une erreur est survenue en traitant « ma mère me juge »",
      "connect ECONNREFUSED 127.0.0.1:54321",
      'duplicate key value violates unique constraint "x"',
      "",
      "Timeout",
    ]) {
      expect(codeDErreur(new Error(message)), message).toBe("erreur_non_identifiee");
    }
    expect(codeDErreur("pas une Error")).toBe("erreur_non_identifiee");
    expect(codeDErreur(null)).toBe("erreur_non_identifiee");
  });

  it("[LE PIÈGE SUBTIL] un mot unique en minuscules — donc un mot pris à un verbatim — est jeté", () => {
    // Mutation-cible : relâcher `CODE_INTERNE` en `/^[a-z0-9_]+$/`. Un message réduit à un seul mot passerait
    // alors le filtre. C'est l'exigence de DEUX segments qui distingue « nos codes » de « un mot français ».
    for (const mot of ["maman", "divorce", "therapie", "x"]) {
      expect(codeDErreur(new Error(mot)), mot).toBe("erreur_non_identifiee");
    }
    expect(codeDErreur(new Error("appel_echoue")), "deux segments : c'est un des nôtres").toBe("appel_echoue");
  });

  it("tronque à 120 caractères — la borne de la colonne", () => {
    const long = `a_${"b".repeat(300)}`;
    expect(codeDErreur(new Error(long))).toHaveLength(120);
  });
});

describe("[AC5] un job cassé ne met pas l'ordonnanceur à l'arrêt", () => {
  it("un job qui LÈVE est clos en échec, signalé, et le suivant tourne quand même", async () => {
    // Mutation-cible : laisser l'exception remonter hors de la boucle. Un seul job fragile suffirait alors à
    // empêcher tous les autres — dont, à partir de l'Epic 6, la rétention légale (NFR-021).
    const suivantATourne = vi.fn(async () => {});
    const { depot, trace } = depotFactice();
    const rapport = await executerOrdonnanceur({
      depot,
      registre: [
        job("casse", async () => {
          throw new Error("appel_echoue");
        }),
        job("suivant", suivantATourne),
      ],
    });

    expect(rapport.jobs).toEqual([
      { nom: "casse", issue: "echoue" },
      { nom: "suivant", issue: "execute" },
    ]);
    expect(suivantATourne).toHaveBeenCalledOnce();
    expect(trace.clos).toEqual([
      { job: "casse", reussi: false, motif: "appel_echoue" },
      { job: "suivant", reussi: true, motif: null },
    ]);
    expect(trace.incidents).toEqual([{ type: "job_echoue", job: "casse", detail: "appel_echoue" }]);
  });

  it("un job qui PEND est coupé par son délai et clos en échec", async () => {
    // Mutation-cible : retirer `avecDelai`. Un job qui pend consommerait tout le budget d'exécution
    // serverless, l'appel serait tué par la plateforme — et la ligne resterait `en_cours`, immobilisant sa
    // fenêtre jusqu'à l'expiration du bail. Ici, on la clôt proprement : re-réclamable tout de suite.
    const { depot, trace } = depotFactice();
    const rapport = await executerOrdonnanceur({
      depot,
      registre: [job("lent", () => new Promise(() => {}), 20)],
    });
    expect(rapport.jobs).toEqual([{ nom: "lent", issue: "echoue" }]);
    expect(trace.clos[0].motif).toBe("lent_timeout");
  });

  it("une réclamation REFUSÉE ne clôt rien et n'alerte pas — ce n'est pas un incident", async () => {
    const { depot, trace } = depotFactice({ reclamer: () => false });
    const aTourne = vi.fn(async () => {});
    const rapport = await executerOrdonnanceur({ depot, registre: [job("deja", aTourne)] });
    expect(rapport.jobs).toEqual([{ nom: "deja", issue: "deja_fait" }]);
    expect(aTourne).not.toHaveBeenCalled();
    expect(trace.clos).toEqual([]);
    expect(trace.incidents).toEqual([]);
  });

  it("un dépôt qui tombe sur la MÉCANIQUE elle-même n'arrête pas non plus la boucle", async () => {
    const espion = vi.spyOn(console, "error").mockImplementation(() => {});
    const suivantATourne = vi.fn(async () => {});
    const { depot } = depotFactice({
      reclamer: (nom) => {
        if (nom === "base-morte") throw new Error("reclamer_execution: 08006");
        return true;
      },
    });
    const rapport = await executerOrdonnanceur({
      depot,
      registre: [job("base-morte", async () => {}), job("suivant", suivantATourne)],
    });
    expect(rapport.jobs).toEqual([
      { nom: "base-morte", issue: "echoue" },
      { nom: "suivant", issue: "execute" },
    ]);
    expect(suivantATourne).toHaveBeenCalledOnce();
    espion.mockRestore();
  });

  it("[LE CŒUR — défauts n°3 et n°5] une CLÔTURE qui tombe ne transforme pas un succès en échec", async () => {
    // CE TEST DISAIT L'INVERSE. Il attendait `issue: "echoue"` et figeait ainsi le défaut : quand
    // `clore(succès)` échouait — un hoquet réseau après un job parfaitement exécuté — le catch du JOB
    // prenait le relais, écrivait `echoue`, levait un incident `job_echoue` mensonger, et rendait la
    // fenêtre IMMÉDIATEMENT re-réclamable. Le repli produisait donc PLUS d'effet que le chemin nominal,
    // exactement à l'envers d'AD-15. Sur la synthèse (4.9) : une seconde synthèse et une seconde
    // notification ; sur la rétention (Epic 6) : un second effacement.
    //
    // Un test peut donc protéger un bug aussi solidement qu'il protège une garde. Celui-ci était vert.
    const espion = vi.spyOn(console, "error").mockImplementation(() => {});
    const aTourne = vi.fn(async () => {});
    const { depot, trace } = depotFactice({
      clore: (reussi) => {
        if (reussi) throw new Error("clore_execution: 08006");
      },
    });
    const rapport = await executerOrdonnanceur({ depot, registre: [job("vrai-travail", aTourne)] });

    expect(rapport.execute, "le répartiteur rend un rapport, il ne lève pas").toBe(true);
    expect(aTourne, "le travail, lui, a bien eu lieu").toHaveBeenCalledOnce();
    expect(trace.clos.filter((c) => !c.reussi), "AUCUNE clôture en échec").toEqual([]);
    expect(trace.incidents, "AUCUN incident : le job n'a pas échoué, c'est la comptabilité qui a raté").toEqual([]);
    // L'issue rapportée suit le TRAVAIL, jamais la comptabilité.
    expect(rapport.jobs).toEqual([{ nom: "vrai-travail", issue: "execute" }]);
    espion.mockRestore();
  });

  it("[CONTRÔLE POSITIF] … mais un vrai échec du JOB est toujours clos en échec et signalé", async () => {
    // Sans ce contre-test, le précédent serait satisfait par un répartiteur qui n'écrit plus jamais rien.
    const { depot, trace } = depotFactice();
    const rapport = await executerOrdonnanceur({
      depot,
      registre: [
        job("vrai-echec", async () => {
          throw new Error("appel_echoue");
        }),
      ],
    });
    expect(rapport.jobs).toEqual([{ nom: "vrai-echec", issue: "echoue" }]);
    expect(trace.clos).toEqual([{ job: "vrai-echec", reussi: false, motif: "appel_echoue" }]);
    expect(trace.incidents).toEqual([{ type: "job_echoue", job: "vrai-echec", detail: "appel_echoue" }]);
  });
});

describe("[AC3] le refus d'environnement précède TOUT", () => {
  it("aucun job n'est même réclamé quand la base et le déploiement ne s'accordent pas", async () => {
    const espion = vi.spyOn(console, "error").mockImplementation(() => {});
    const aTourne = vi.fn(async () => {});
    const { depot, trace } = depotFactice({ environnement: "production" }); // le déploiement dit `local`
    const rapport = await executerOrdonnanceur({ depot, registre: [job("quelconque", aTourne)] });

    expect(rapport).toEqual({ execute: false, refus: "desaccord", jobs: [] });
    expect(trace.reclames, "pas même une réclamation").toEqual([]);
    expect(trace.incidents, "et pas la moindre écriture dans une base dont on doute").toEqual([]);
    expect(aTourne).not.toHaveBeenCalled();
    espion.mockRestore();
  });

  it("une base MUETTE sur son identité est traitée comme un désaccord", async () => {
    // Mutation-cible : `if (declare === null) return { accorde: true }` — « on ne sait pas, on continue ».
    // C'est la formulation exacte de l'accident qu'on veut empêcher (AD-15 : le repli va vers le MOINS d'effet).
    const espion = vi.spyOn(console, "error").mockImplementation(() => {});
    const { depot, trace } = depotFactice({ environnement: null });
    const rapport = await executerOrdonnanceur({ depot, registre: [job("quelconque", async () => {})] });
    expect(rapport.refus).toBe("base_muette");
    expect(trace.reclames).toEqual([]);

    // Le refus ne s'écrit PAS en base (on doute de la base) : le journal du processus est donc le seul
    // canal qui reste, et il doit porter la raison. Or `journaliserIncidentSecurite` ne recopie pas
    // l'objet qu'on lui passe — il n'en lit que la clé `code` et jette le reste, pour qu'aucun champ
    // libre ne parte en log (NFR-022). Un `{motif, deploiement}` sortait donc en `code: undefined` :
    // l'alerte existait, vide de sens (revue 4.8, défaut n°10).
    expect(espion).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ motif: "ordonnanceur_environnement", code: "base_muette/local" }),
    );
    espion.mockRestore();
  });
});

describe("[AC5] le job de santé", () => {
  const maintenant = new Date("2026-08-05T12:00:00Z");
  const registre = [job("frais", async () => {}), job("mort", async () => {})];

  it("alerte sur le job hors tolérance, et se tait sur celui qui va bien", async () => {
    const { depot, trace } = depotFactice({
      etat: {
        naissance: new Date("2026-07-01T00:00:00Z"),
        reussites: new Map([
          ["frais", new Date("2026-08-05T06:00:00Z")], // 6 h
          ["mort", new Date("2026-08-01T06:00:00Z")], // 102 h, tolérance 48 h
        ]),
      },
    });
    await executerSante({ depot, instant: maintenant, echeance: new Date(Date.now() + 60_000), registre });
    expect(trace.incidents).toEqual([
      { type: "job_en_retard", job: "mort", detail: "reussite_hors_tolerance" },
    ]);
  });

  it("[LE PIÈGE 1] au premier tick, il ne s'alerte sur RIEN", async () => {
    // Naissance = maintenant (aucune exécution en base) : tous les jobs sont sans réussite, et pourtant
    // aucun n'est en retard. Mutation-cible : `estEnRetard` traitant `null` comme « en retard » — le jour du
    // déploiement, le tableau de santé serait rouge partout, donc inutile pour toujours.
    const { depot, trace } = depotFactice({ etat: { naissance: null, reussites: new Map() } });
    await executerSante({ depot, instant: maintenant, echeance: new Date(Date.now() + 60_000), registre });
    expect(trace.incidents).toEqual([]);
  });

  it("[LE PIÈGE 2] un job JAMAIS exécuté depuis longtemps est bien signalé", async () => {
    const { depot, trace } = depotFactice({
      etat: { naissance: new Date("2026-07-01T00:00:00Z"), reussites: new Map() },
    });
    await executerSante({ depot, instant: maintenant, echeance: new Date(Date.now() + 60_000), registre });
    expect(trace.incidents).toEqual([
      { type: "job_en_retard", job: "frais", detail: "aucune_reussite_connue" },
      { type: "job_en_retard", job: "mort", detail: "aucune_reussite_connue" },
    ]);
  });

  it("[NFR-022] il ne signale QUE des identifiants techniques et des motifs fermés", async () => {
    const { depot, trace } = depotFactice({
      etat: { naissance: new Date("2026-07-01T00:00:00Z"), reussites: new Map() },
    });
    await executerSante({ depot, instant: maintenant, echeance: new Date(Date.now() + 60_000), registre });
    for (const i of trace.incidents) {
      expect(["aucune_reussite_connue", "reussite_hors_tolerance"]).toContain(i.detail);
    }
  });
});

describe("[AC2] la clé de fenêtre qui part vers la base est bien celle du domaine", () => {
  it("chaque job est réclamé ET clos sur la fenêtre de SA cadence, pour l'instant donné", async () => {
    // Le trou de la revue (défaut n°7) : le dépôt factice jetait l'argument `fenetre`, et les tests
    // d'endpoint ne lisaient jamais la colonne. Toute la suite pouvait donc rester verte avec un
    // répartiteur qui passe une constante — auquel cas l'idempotence, la seule chose que cette story
    // promet, disparaît sans qu'aucune exception ne soit levée : le job tourne une fois pour toutes,
    // ou bien deux fois par jour.
    //
    // L'instant est choisi méchamment : 23h30 UTC un 5 août, c'est DÉJÀ le 6 à Paris. Un répartiteur qui
    // daterait la fenêtre en UTC écrirait « 2026-08-05 » et ce test rougirait.
    const { depot, trace } = depotFactice();
    await executerOrdonnanceur({
      depot,
      instant: new Date("2026-08-05T23:30:00Z"),
      registre: [job("q", async () => {}), job("h", async () => {}, 50, "hebdomadaire")],
    });

    // Le bail vaut ceil(delaiMs / 1000) + 60 s de marge — la fenêtre se libère peu après un plantage franc.
    expect(trace.fenetres).toEqual([
      { job: "q", fenetre: "2026-08-06", bail: 61 },
      { job: "h", fenetre: "2026-W32", bail: 61 },
    ]);
    // Et la clôture porte la MÊME clé que la réclamation : clore une autre fenêtre laisserait la première
    // `en_cours` pour toujours et clôturerait une occurrence qui n'a pas tourné.
    expect(trace.fenetresCloses).toEqual([
      { job: "q", fenetre: "2026-08-06" },
      { job: "h", fenetre: "2026-W32" },
    ]);
  });
});
