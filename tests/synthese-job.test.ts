import { describe, it, expect, vi } from "vitest";
import { executerSyntheseAvec, NOM_JOB } from "@/lib/ordonnanceur/jobs/synthese";
import { creerPortCourrielFactice } from "@/lib/courriel/adaptateurs/factice";
import { LOT_PAR_TICK, PLAFOND_NOTIFICATION_HEURES, type MateriauSynthese } from "@/lib/domain/synthese";
import type { DepotSynthese } from "@/lib/data/depot-synthese";
import type { DepotOrdonnanceur, EtatOrdonnanceur, TypeIncident } from "@/lib/data/depot-ordonnanceur";
import type { AiPort, ReponseIa, RequeteIa } from "@/lib/ai/port";
import type { ContexteJob } from "@/lib/ordonnanceur/registre";

/**
 * Story 4.9 (T7) — LE JOB, sur doublures. La base prouve les clauses (`synthese-sql`) ; ici on prouve
 * l'ORDRE DES EFFETS, c'est-à-dire tout ce qui distingue « une synthèse » de « deux synthèses ».
 *
 * C'est le premier job du produit à produire un effet qu'une personne VOIT. Une erreur d'ordre ne se
 * traduit pas par une exception : elle se traduit par un second courriel dans une vraie boîte.
 */

const INSTANT = new Date("2026-08-05T04:00:00Z"); // mercredi 06:00 à Paris — semaine ISO 2026-W32
const SEMAINE = "2026-W32";

interface TraceOrdo {
  reclames: { job: string; fenetre: string; cible: string | null; bail: number }[];
  clos: { fenetre: string; cible: string | null; reussi: boolean; motif: string | null }[];
  incidents: { type: TypeIncident; job: string; detail: string | null }[];
}

function depotOrdoFactice(options: { reclamer?: (cible: string | null) => boolean } = {}) {
  const trace: TraceOrdo = { reclames: [], clos: [], incidents: [] };
  const depot: DepotOrdonnanceur = {
    async environnementDeclare() {
      return "local";
    },
    async reclamer(job, fenetre, cible, bail) {
      trace.reclames.push({ job, fenetre, cible, bail });
      return options.reclamer ? options.reclamer(cible) : true;
    },
    async clore(_j, fenetre, cible, reussi, motif) {
      trace.clos.push({ fenetre, cible, reussi, motif });
    },
    async etat(): Promise<EtatOrdonnanceur> {
      return { naissance: null, reussites: new Map() };
    },
    async leverIncident(type, job, detail) {
      trace.incidents.push({ type, job, detail });
    },
  };
  return { depot, trace };
}

const MATERIAU_PLEIN: MateriauSynthese = {
  depuis: null,
  jusqu_a: "2026-08-05T04:00:00.000Z",
  total: 2,
  tronquee: false,
  entrees: [
    { role: "utilisatrice", contenu: "j'ai repris le dessin", cree_le: "2026-08-01T10:00:00.000Z" },
    { role: "anam", contenu: "depuis quand ?", cree_le: "2026-08-01T10:01:00.000Z" },
  ],
  faits: ["elle dessine"],
};

const MATERIAU_VIDE: MateriauSynthese = {
  depuis: "2026-08-01T00:00:00.000Z",
  jusqu_a: "2026-08-05T04:00:00.000Z",
  total: 0,
  tronquee: false,
  entrees: [],
  faits: ["elle dessine"], // des faits anciens : ils ne suffisent PAS (D3)
};

interface TraceSynthese {
  materiaux: string[];
  enregistrements: { id: string; semaine: string; debut: string; fin: string; contenu: string }[];
  reservations: { id: string; motif: string; cle: string; plafond: number }[];
  ordre: string[];
}

function depotSyntheseFactice(options: {
  candidates?: string[];
  materiau?: (id: string) => MateriauSynthese;
  enregistrer?: (id: string) => boolean;
  reserver?: (id: string) => boolean;
  adresse?: (id: string) => string | null;
} = {}) {
  const trace: TraceSynthese = { materiaux: [], enregistrements: [], reservations: [], ordre: [] };
  const depot: DepotSynthese = {
    async candidates() {
      return options.candidates ?? ["u1"];
    },
    async materiau(id) {
      trace.materiaux.push(id);
      return options.materiau ? options.materiau(id) : MATERIAU_PLEIN;
    },
    async enregistrer(id, semaine, debut, fin, contenu) {
      trace.ordre.push("enregistrer");
      trace.enregistrements.push({ id, semaine, debut, fin, contenu });
      return options.enregistrer ? options.enregistrer(id) : true;
    },
    async reserverNotification(id, motif, cle, plafond) {
      trace.ordre.push("reserver");
      trace.reservations.push({ id, motif, cle, plafond });
      return options.reserver ? options.reserver(id) : true;
    },
    async adresse(id) {
      return options.adresse ? options.adresse(id) : `${id}@exemple.fr`;
    },
  };
  return { depot, trace };
}

function iaFactice(options: { texte?: string; echoue?: boolean } = {}) {
  const requetes: RequeteIa[] = [];
  const ia: AiPort = {
    async completer(req): Promise<ReponseIa> {
      requetes.push(req);
      if (options.echoue) throw new Error("ia_indisponible");
      return {
        texte: options.texte ?? "## Ta semaine\n- tu as repris le dessin",
        tier: "fort",
        modele: "factice",
        usage: { tokensEntree: 1, tokensSortie: 1 },
      };
    },
    async *diffuser() {
      throw new Error("jamais");
    },
    estZdrProuve: () => true,
  };
  return { ia, requetes };
}

function contexte(depot: DepotOrdonnanceur): ContexteJob {
  return { depot, instant: INSTANT, registre: [] };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

describe("[LE CŒUR] la fenêtre RÉCLAMÉE par personne est HEBDOMADAIRE, sous un job QUOTIDIEN", () => {
  it("chaque personne est réclamée et close sur la semaine ISO, avec son identifiant en cible", async () => {
    // LE défaut que ce test empêche, et il ne se verrait qu'en production : avec une fenêtre quotidienne
    // par personne, une synthèse partirait CHAQUE JOUR — sept par semaine, sept courriels. Avec une
    // cadence hebdomadaire au REGISTRE (l'autre erreur symétrique), un fan-out partiellement réussi le
    // lundi clôrait sa semaine et les personnes en échec ne seraient jamais reprises.
    //
    // Les deux se voient ici : la fenêtre réclamée doit être `2026-W32` — la SEMAINE — et la cible doit
    // être l'identifiant de la personne, pas `null`.
    const { depot, trace } = depotOrdoFactice();
    const { depot: syn } = depotSyntheseFactice({ candidates: ["u1", "u2"] });
    const { ia } = iaFactice();

    await executerSyntheseAvec(contexte(depot), { depot: syn, ia, courriel: creerPortCourrielFactice() });

    expect(trace.reclames.map((r) => ({ job: r.job, fenetre: r.fenetre, cible: r.cible }))).toEqual([
      { job: NOM_JOB, fenetre: SEMAINE, cible: "u1" },
      { job: NOM_JOB, fenetre: SEMAINE, cible: "u2" },
    ]);
    expect(trace.clos.map((c) => ({ fenetre: c.fenetre, cible: c.cible, reussi: c.reussi }))).toEqual([
      { fenetre: SEMAINE, cible: "u1", reussi: true },
      { fenetre: SEMAINE, cible: "u2", reussi: true },
    ]);
  });

  it("une personne dont la fenêtre est DÉJÀ prise est sautée — pas de matériau, pas de modèle, pas de courriel", async () => {
    // C'est la reprise quotidienne à l'œuvre : jeudi, la personne servie mercredi ne doit rien coûter.
    // Mutation-cible : ignorer le retour de `reclamer`. Le job appellerait le modèle fort pour chaque
    // personne, chaque jour — sept fois le coût, et sept synthèses candidates à l'écriture.
    const { depot, trace } = depotOrdoFactice({ reclamer: (cible) => cible === "u2" });
    const { depot: syn, trace: traceSyn } = depotSyntheseFactice({ candidates: ["u1", "u2"] });
    const { ia, requetes } = iaFactice();
    const courriel = creerPortCourrielFactice();

    await executerSyntheseAvec(contexte(depot), { depot: syn, ia, courriel });

    expect(traceSyn.materiaux, "seule u2 a été lue").toEqual(["u2"]);
    expect(requetes, "un seul appel au modèle").toHaveLength(1);
    expect(courriel.envoyes.map((e) => e.destinataire)).toEqual(["u2@exemple.fr"]);
    expect(trace.clos, "on ne clôt QUE ce qu'on a réclamé").toHaveLength(1);
  });
});

describe("[AC1] le modèle FORT, et la consigne côté serveur", () => {
  it("la capacité déclarée est `synthese` et le contenu est annoncé art. 9", async () => {
    // Le tier n'est pas choisi ici : la politique unique (AD-5) résout `synthese` → FORT. Ce que le job
    // doit faire, c'est déclarer honnêtement sa capacité et le fait qu'il envoie de l'art. 9 — mentir
    // sur `contientArt9` contournerait l'egress-guard (AD-13).
    const { depot } = depotOrdoFactice();
    const { depot: syn } = depotSyntheseFactice();
    const { ia, requetes } = iaFactice();

    await executerSyntheseAvec(contexte(depot), { depot: syn, ia, courriel: creerPortCourrielFactice() });

    expect(requetes[0].capacite).toBe("synthese");
    expect(requetes[0].contientArt9).toBe(true);
    expect(requetes[0].messages[0].role, "la consigne est injectée SERVEUR, en tête").toBe("system");
    expect(requetes[0].messages.map((m) => m.content).join("\n")).toContain("j'ai repris le dessin");
  });
});

describe("[D3 / FR-034] rien à dire → rien du tout", () => {
  it("aucun appel au modèle, aucune écriture, aucun courriel — et la fenêtre est close en RÉUSSITE", async () => {
    // La clôture en réussite n'est pas un détail : clore en échec ferait revenir cette personne demain,
    // et tous les jours, pour reconstater qu'il n'y a rien à dire.
    const { depot, trace } = depotOrdoFactice();
    const { depot: syn, trace: traceSyn } = depotSyntheseFactice({ materiau: () => MATERIAU_VIDE });
    const { ia, requetes } = iaFactice();
    const courriel = creerPortCourrielFactice();

    await executerSyntheseAvec(contexte(depot), { depot: syn, ia, courriel });

    expect(requetes, "des faits anciens ne suffisent pas — ils ont déjà été racontés").toEqual([]);
    expect(traceSyn.enregistrements).toEqual([]);
    expect(courriel.envoyes).toEqual([]);
    expect(trace.clos).toEqual([{ fenetre: SEMAINE, cible: "u1", reussi: true, motif: null }]);
  });
});

describe("[AC4] l'annonce : réserver AVANT d'envoyer, et jamais l'inverse", () => {
  it("[LE CŒUR] l'ordre est enregistrer → réserver → envoyer", async () => {
    // Mutation-cible : envoyer d'abord, noter ensuite. Entre les deux il y a une fenêtre, et cette
    // fenêtre-là s'appelle « un deuxième courriel » : un plantage après l'envoi laisserait la
    // réservation libre, et le tick du lendemain renverrait la même annonce.
    const { depot } = depotOrdoFactice();
    const { depot: syn, trace } = depotSyntheseFactice();
    const { ia } = iaFactice();
    const courriel = creerPortCourrielFactice();

    await executerSyntheseAvec(contexte(depot), { depot: syn, ia, courriel });

    expect(trace.ordre).toEqual(["enregistrer", "reserver"]);
    expect(trace.reservations).toEqual([
      { id: "u1", motif: "synthese_prete", cle: SEMAINE, plafond: PLAFOND_NOTIFICATION_HEURES },
    ]);
    expect(courriel.envoyes).toEqual([{ destinataire: "u1@exemple.fr", motif: "synthese_prete" }]);
  });

  it("le plafond refuse → aucun courriel, mais la synthèse est bien écrite", async () => {
    // Le plafond borne le CANAL, jamais le CONTENU. Confondre les deux laisserait une règle de politesse
    // effacer un récit — la personne ouvrirait l'app et n'y trouverait rien.
    const { depot } = depotOrdoFactice();
    const { depot: syn, trace } = depotSyntheseFactice({ reserver: () => false });
    const { ia } = iaFactice();
    const courriel = creerPortCourrielFactice();

    await executerSyntheseAvec(contexte(depot), { depot: syn, ia, courriel });

    expect(trace.enregistrements, "la synthèse existe").toHaveLength(1);
    expect(courriel.envoyes, "l'annonce, non").toEqual([]);
  });

  it("une synthèse DÉJÀ écrite (rejeu) n'est pas annoncée une seconde fois", async () => {
    // `enregistrer` rend `false` quand l'index unique a refusé : rien de neuf n'a été produit, donc rien
    // à annoncer. Mutation-cible : notifier inconditionnellement.
    const { depot } = depotOrdoFactice();
    const { depot: syn, trace } = depotSyntheseFactice({ enregistrer: () => false });
    const { ia } = iaFactice();
    const courriel = creerPortCourrielFactice();

    await executerSyntheseAvec(contexte(depot), { depot: syn, ia, courriel });

    expect(trace.reservations, "aucune réservation consommée").toEqual([]);
    expect(courriel.envoyes).toEqual([]);
  });

  it("le canal NON CONFIGURÉ ne consomme aucune réservation", async () => {
    // Le piège : réserver puis découvrir qu'on ne peut pas envoyer consommerait le droit d'envoyer sans
    // avoir envoyé — et le plafond de 72 h bloquerait ensuite une annonce jamais partie. D'où
    // `estConfigure()` AVANT la réservation. C'est l'état réel tant que la clé Resend n'est pas posée.
    const { depot } = depotOrdoFactice();
    const { depot: syn, trace } = depotSyntheseFactice();
    const { ia } = iaFactice();
    const muet = { estConfigure: () => false, envoyer: vi.fn(async () => {}) };

    await executerSyntheseAvec(contexte(depot), { depot: syn, ia, courriel: muet });

    expect(trace.enregistrements, "la synthèse est produite quand même").toHaveLength(1);
    expect(trace.reservations).toEqual([]);
    expect(muet.envoyer).not.toHaveBeenCalled();
  });

  it("un envoi qui ÉCHOUE ne fait pas échouer la synthèse", async () => {
    // Mutation-cible : laisser l'exception de l'envoi remonter dans le catch du job. La personne serait
    // close en échec, reviendrait demain, `enregistrer` rendrait `false`… et surtout sa synthèse — qui
    // existe et qu'elle peut lire — serait comptée comme un échec dans la trace d'exécution.
    const espion = vi.spyOn(console, "error").mockImplementation(() => {});
    const { depot, trace } = depotOrdoFactice();
    const { depot: syn } = depotSyntheseFactice();
    const { ia } = iaFactice();

    await executerSyntheseAvec(contexte(depot), {
      depot: syn,
      ia,
      courriel: creerPortCourrielFactice({ echoue: true }),
    });

    expect(trace.clos).toEqual([{ fenetre: SEMAINE, cible: "u1", reussi: true, motif: null }]);
    expect(trace.incidents, "un courriel perdu n'est pas un incident système").toEqual([]);
    espion.mockRestore();
  });

  it("[NFR-020] le port courriel ne reçoit qu'une adresse et un motif — jamais un mot de la synthèse", async () => {
    // La signature du port rend la fuite impossible à écrire ; ce test fige ce qui SORT réellement.
    const { depot } = depotOrdoFactice();
    const { depot: syn } = depotSyntheseFactice();
    const { ia } = iaFactice({ texte: "TEXTE INTIME QUI NE DOIT JAMAIS SORTIR" });
    const courriel = creerPortCourrielFactice();

    await executerSyntheseAvec(contexte(depot), { depot: syn, ia, courriel });

    expect(JSON.stringify(courriel.envoyes)).not.toContain("INTIME");
    expect(Object.keys(courriel.envoyes[0]).sort()).toEqual(["destinataire", "motif"]);
  });
});

describe("[AC1] une personne cassée n'emporte pas les autres", () => {
  it("l'échec est clos sur SA fenêtre à elle, avec un CODE, et les suivantes tournent", async () => {
    const { depot, trace } = depotOrdoFactice();
    const { depot: syn } = depotSyntheseFactice({
      candidates: ["u1", "u2"],
      materiau: (id) => {
        if (id === "u1") throw new Error("materiau_synthese: 08006");
        return MATERIAU_PLEIN;
      },
    });
    const { ia } = iaFactice();
    const courriel = creerPortCourrielFactice();

    await executerSyntheseAvec(contexte(depot), { depot: syn, ia, courriel });

    expect(trace.clos).toEqual([
      { fenetre: SEMAINE, cible: "u1", reussi: false, motif: "materiau_synthese: 08006" },
      { fenetre: SEMAINE, cible: "u2", reussi: true, motif: null },
    ]);
    expect(courriel.envoyes.map((e) => e.destinataire)).toEqual(["u2@exemple.fr"]);
    expect(trace.incidents, "un échec partiel n'est pas un incident").toEqual([]);
  });

  it("[NFR-022] le motif écrit en base est un CODE, jamais un message qui aurait ramassé un verbatim", async () => {
    const { depot, trace } = depotOrdoFactice();
    const { depot: syn } = depotSyntheseFactice({
      materiau: () => {
        throw new Error("Erreur en traitant « ma mère me juge »");
      },
    });
    const { ia } = iaFactice();

    await executerSyntheseAvec(contexte(depot), { depot: syn, ia, courriel: creerPortCourrielFactice() });

    expect(trace.clos[0].motif).toBe("erreur_non_identifiee");
  });

  it("un lot ENTIÈREMENT en échec lève UN incident — c'est le chemin, plus une personne", async () => {
    // Aucun incident par personne (une panne de modèle en toucherait vingt et noierait la table), mais
    // un lot entier qui tombe est un vrai signal. Mutation-cible : ne jamais lever, ou lever par personne.
    const { depot, trace } = depotOrdoFactice();
    const { depot: syn } = depotSyntheseFactice({ candidates: ["u1", "u2", "u3"] });
    const { ia } = iaFactice({ echoue: true });

    await executerSyntheseAvec(contexte(depot), { depot: syn, ia, courriel: creerPortCourrielFactice() });

    expect(trace.incidents).toEqual([
      { type: "job_echoue", job: NOM_JOB, detail: "lot_entierement_echoue" },
    ]);
  });

  it("… mais un lot VIDE ne lève rien (aucun échec, donc aucun signal)", async () => {
    // Sans ce contrôle, la garde ci-dessus serait satisfaite par `echecs === candidates.length` vrai
    // sur `0 === 0` : le job lèverait un incident chaque jour où personne n'a rien à raconter.
    const { depot, trace } = depotOrdoFactice();
    const { depot: syn } = depotSyntheseFactice({ candidates: [] });
    const { ia } = iaFactice();

    await executerSyntheseAvec(contexte(depot), { depot: syn, ia, courriel: creerPortCourrielFactice() });

    expect(trace.reclames).toEqual([]);
    expect(trace.incidents).toEqual([]);
  });
});

describe("le lot est BORNÉ — la lambda a 60 s, pas l'éternité", () => {
  it("le job demande au plus `LOT_PAR_TICK` candidates, pour la semaine courante", async () => {
    const { depot } = depotOrdoFactice();
    const appel: { semaine?: string; limite?: number } = {};
    const syn: DepotSynthese = {
      ...depotSyntheseFactice().depot,
      async candidates(semaine, limite) {
        appel.semaine = semaine;
        appel.limite = limite;
        return [];
      },
    };
    const { ia } = iaFactice();

    await executerSyntheseAvec(contexte(depot), { depot: syn, ia, courriel: creerPortCourrielFactice() });

    expect(appel).toEqual({ semaine: SEMAINE, limite: LOT_PAR_TICK });
  });
});
