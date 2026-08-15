import { describe, it, expect, vi } from "vitest";
import { executerSyntheseAvec, NOM_JOB, BAIL_PERSONNE_S } from "@/lib/ordonnanceur/jobs/synthese";
import { creerPortCourrielFactice } from "@/lib/courriel/adaptateurs/factice";
import {
  LOT_PAR_TICK,
  PLAFOND_ENTREES,
  PLAFOND_NOTIFICATION_HEURES,
  PLAFOND_OCTETS,
  DELAI_MODELE_MS,
  RESERVE_PERSONNE_MS,
  RESERVE_RATTRAPAGE_MS,
  RETENTION_NOTIFICATION_JOURS,
  type MateriauSynthese,
} from "@/lib/domain/synthese";
import { jetonValide } from "@/lib/domain/jeton-desabonnement";
import type { DepotSynthese } from "@/lib/data/depot-synthese";
import type { DepotOrdonnanceur, EtatOrdonnanceur, TypeIncident } from "@/lib/data/depot-ordonnanceur";
import type { AiPort, ReponseIa, RequeteIa } from "@/lib/ai/port";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContexteJob } from "@/lib/ordonnanceur/registre";

/**
 * Story 4.9 (T7) — LE JOB, sur doublures. La base prouve les clauses (`synthese-sql`) ; ici on prouve
 * l'ORDRE DES EFFETS, c'est-à-dire tout ce qui distingue « une synthèse » de « deux synthèses ».
 *
 * C'est le premier job du produit à produire un effet qu'une personne VOIT. Une erreur d'ordre ne se
 * traduit pas par une exception : elle se traduit par un second courriel dans une vraie boîte.
 */

const INSTANT = new Date("2026-08-05T04:00:00Z"); // mercredi 06:00 à Paris — semaine ISO 2026-W32
const JOUR = "2026-08-05"; // la fenêtre de réclamation par personne est le JOUR (revue 4.9)

interface TraceOrdo {
  reclames: { job: string; fenetre: string; cible: string | null; bail: number }[];
  /** `jeton` depuis la 6.1a : le fan-out doit rendre à `clore` celui que `reclamer` lui a donné, PAR PERSONNE. */
  clos: { fenetre: string; cible: string | null; reussi: boolean; motif: string | null; jeton: string }[];
  incidents: { type: TypeIncident; job: string; detail: string | null }[];
}

/** Les clôtures sans leur jeton — voir la garde dédiée plus bas pour ce qui porte SUR le jeton. */
function closSansJeton(trace: TraceOrdo) {
  return trace.clos.map(({ fenetre, cible, reussi, motif }) => ({ fenetre, cible, reussi, motif }));
}

function depotOrdoFactice(options: { reclamer?: (cible: string | null) => boolean } = {}) {
  const trace: TraceOrdo = { reclames: [], clos: [], incidents: [] };
  const depot: DepotOrdonnanceur = {
    async environnementDeclare() {
      return "local";
    },
    async reclamer(job, fenetre, cible, bail) {
      trace.reclames.push({ job, fenetre, cible, bail });
      const accorde = options.reclamer ? options.reclamer(cible) : true;
      // Un jeton PAR CIBLE (6.1a) : le fan-out en réclame un par personne, et rendre le même à toutes
      // laisserait passer un job qui clôturerait la personne suivante avec le jeton de la précédente.
      return accorde ? `jeton-${cible}` : null;
    },
    async clore(_j, fenetre, cible, reussi, motif, jeton) {
      trace.clos.push({ fenetre, cible, reussi, motif, jeton });
      return true;
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
    { role: "utilisatrice", contenu: "depuis mars, en fait", cree_le: "2026-08-01T10:01:00.000Z" },
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
  appelsCandidates: { job: string; limite: number }[];
  materiaux: string[];
  plafonds: { entrees: number; octets: number }[];
  enregistrements: { id: string; debut: string; fin: string; contenu: string; tronquee: boolean }[];
  reservations: { id: string; motif: string; cle: string; plafond: number }[];
  purges: number[];
  ordre: string[];
}

/** Un uuid quelconque : ce qui compte est qu'il PASSE `jetonValide`, pas sa valeur. */
const JETON_FACTICE = "11111111-1111-4111-8111-111111111111";

function depotSyntheseFactice(options: {
  candidates?: string[];
  materiau?: (id: string) => MateriauSynthese;
  enregistrer?: (id: string) => string | null;
  reserver?: (id: string) => boolean;
  adresse?: (id: string) => string | null;
  jeton?: (id: string) => string | null;
  purge?: number | null;
  enEchecRepete?: number;
  /** Story 4.10 (D4) — les synthèses écrites mais jamais annoncées, reprises AVANT le fan-out. */
  nonAnnoncees?: { utilisatriceId: string; syntheseId: string }[];
} = {}) {
  const trace: TraceSynthese = { appelsCandidates: [], materiaux: [], plafonds: [], enregistrements: [], reservations: [], purges: [], ordre: [] };
  const depot: DepotSynthese = {
    async candidates(job, limite) {
      trace.appelsCandidates.push({ job, limite });
      return options.candidates ?? ["u1"];
    },
    async personnesEnEchecRepete() {
      return options.enEchecRepete ?? 0;
    },
    async syntheseesNonAnnoncees() {
      return options.nonAnnoncees ?? [];
    },
    async libererNotification() {
      /* la synthèse ne libère pas : sa clé se régénère à la période suivante (cf. depot-canal-courriel) */
    },
    async materiau(id, plafondEntrees, plafondOctets) {
      trace.materiaux.push(id);
      trace.plafonds.push({ entrees: plafondEntrees, octets: plafondOctets });
      return options.materiau ? options.materiau(id) : MATERIAU_PLEIN;
    },
    async enregistrer(id, debut, fin, contenu, tronquee) {
      trace.ordre.push("enregistrer");
      trace.enregistrements.push({ id, debut, fin, contenu, tronquee });
      return options.enregistrer ? options.enregistrer(id) : `syn-${id}`;
    },
    async reserverNotification(id, motif, cle, plafond) {
      trace.ordre.push("reserver");
      trace.reservations.push({ id, motif, cle, plafond });
      return options.reserver ? options.reserver(id) : true;
    },
    async adresse(id) {
      return options.adresse ? options.adresse(id) : `${id}@exemple.fr`;
    },
    async jetonDesabonnement(id) {
      trace.ordre.push("jeton");
      const brut = options.jeton ? options.jeton(id) : JETON_FACTICE;
      return jetonValide(brut);
    },
    async purgerNotifications(jours) {
      trace.purges.push(jours);
      return options.purge === undefined ? 0 : options.purge;
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

/**
 * Le client `service_role` que l'egress-guard interroge juste avant de poster (T2-1). Il ne sert QU'À ça :
 * relire `eligible_a_synthese` au plus près de l'envoi. `eligible: false` simule une révocation, une
 * barrière de minorité ou un épisode de détresse survenu APRÈS la constitution du lot.
 */
function supabaseFactice(options: { eligible?: (id: string) => boolean; echoue?: boolean } = {}) {
  const appels: string[] = [];
  const client = {
    async rpc(nom: string, args: { p_utilisatrice: string }) {
      appels.push(`${nom}:${args.p_utilisatrice}`);
      if (options.echoue) return { data: null, error: { code: "PGRST000" } };
      return { data: options.eligible ? options.eligible(args.p_utilisatrice) : true, error: null };
    },
  } as unknown as SupabaseClient;
  return { client, appels };
}

/**
 * `echeance` par défaut : très loin, pour que les tests qui ne parlent PAS du budget ne le rencontrent
 * jamais. Ceux qui en parlent la passent explicitement — c'est plus lisible qu'une horloge simulée, et
 * ça évite qu'un test échoue le jour où la machine est lente.
 */
function contexte(depot: DepotOrdonnanceur, echeanceDansMs = 3_600_000): ContexteJob {
  return { depot, instant: INSTANT, echeance: new Date(Date.now() + echeanceDansMs), registre: [] };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

describe("[D4 / revue 4.10] LE RATTRAPAGE D'ANNONCE, câblé dans le job", () => {
  /**
   * ⚠️ AUCUN TEST N'EXERÇAIT CETTE BOUCLE. L'option `nonAnnoncees` du dépôt factice existait, servie à
   * `[]`, et jamais renseignée : remplacer la boucle entière par `for (const a of [])` laissait les
   * trente-sept tests de ce fichier verts. La requête SQL était prouvée (`intention-sql.test.ts`), le
   * fait que le job l'APPELLE ne l'était pas — et c'est le mécanisme même que la 4.10 a ajouté pour
   * réparer la perte silencieuse décrite par la migration 0030.
   */
  it("[LE CŒUR] chaque synthèse en attente est annoncée, AVANT le fan-out", async () => {
    // Mutation-cible : supprimer la boucle de rattrapage. Rien d'autre ne rougit.
    const { depot, trace } = depotSyntheseFactice({
      candidates: [],
      nonAnnoncees: [
        { utilisatriceId: "u-attente-1", syntheseId: "syn-a" },
        { utilisatriceId: "u-attente-2", syntheseId: "syn-b" },
      ],
    });
    const { depot: ordo } = depotOrdoFactice();
    const { ia } = iaFactice();
    const { client } = supabaseFactice();
    const courriel = creerPortCourrielFactice();
    await executerSyntheseAvec(contexte(ordo), { depot, ia, supabase: client, courriel });

    expect(trace.reservations.map((r) => r.cle), "la clé de réservation est la SYNTHÈSE elle-même").toEqual([
      "syn-a",
      "syn-b",
    ]);
    expect(courriel.envoyes.map((e) => e.destinataire)).toEqual([
      "u-attente-1@exemple.fr",
      "u-attente-2@exemple.fr",
    ]);
  });

  it("une réservation REFUSÉE au rattrapage n'envoie rien (le plafond garde la main)", async () => {
    const { depot, trace } = depotSyntheseFactice({
      candidates: [],
      reserver: () => false,
      nonAnnoncees: [{ utilisatriceId: "u-attente-1", syntheseId: "syn-a" }],
    });
    const { depot: ordo } = depotOrdoFactice();
    const { ia } = iaFactice();
    const { client } = supabaseFactice();
    const courriel = creerPortCourrielFactice();
    await executerSyntheseAvec(contexte(ordo), { depot, ia, supabase: client, courriel });
    expect(trace.reservations).toHaveLength(1);
    expect(courriel.envoyes).toHaveLength(0);
  });

  it("[LE CŒUR] le rattrapage N'AFFAME PAS la production : il s'arrête AVANT le seuil du fan-out", async () => {
    // ⚠️ IL L'AFFAMAIT. Sa borne était `RESERVE_PERSONNE_MS` — la MÊME que le fan-out — sur un budget de
    // 36 s : il ne s'arrêtait donc qu'au moment précis où la production s'arrêtait aussi. Une itération
    // lente et le fan-out cassait au premier candidat : zéro synthèse ce jour-là, job clos en `reussi`,
    // aucun incident. Sa réserve est désormais STRICTEMENT au-dessus.
    // Mutation-cible : remettre `RESERVE_PERSONNE_MS` comme borne du rattrapage.
    expect(RESERVE_RATTRAPAGE_MS).toBeGreaterThan(RESERVE_PERSONNE_MS);

    // Budget serré : assez pour le rattrapage, pas assez pour qu'il empiète sur la réserve du fan-out.
    const { depot, trace } = depotSyntheseFactice({
      candidates: ["u1"],
      nonAnnoncees: [{ utilisatriceId: "u-attente-1", syntheseId: "syn-a" }],
    });
    const { depot: ordo } = depotOrdoFactice();
    const { ia } = iaFactice();
    const { client } = supabaseFactice();
    const courriel = creerPortCourrielFactice();
    const serre = { ...contexte(ordo), echeance: new Date(Date.now() + RESERVE_RATTRAPAGE_MS - 500) };
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await executerSyntheseAvec(serre, { depot, ia, supabase: client, courriel });
    spy.mockRestore();

    // ⚠️ C'EST TOUT LE POINT DU CORRECTIF : le rattrapage rend la main, ET la production tourne quand
    // même. Avant, les deux partageaient la même borne, donc le rattrapage n'abandonnait qu'au moment où
    // le fan-out abandonnait aussi — et une itération lente les emportait tous les deux.
    expect(trace.reservations.map((r) => r.cle), "aucune annonce de rattrapage (`syn-a` absent)").not.toContain(
      "syn-a",
    );
    expect(trace.materiaux, "mais la synthèse du jour, elle, est produite").toEqual(["u1"]);
  });

  it("sans canal configuré, on ne LIT même pas les synthèses en attente", async () => {
    // Mutation-cible : retirer le `if (deps.courriel.estConfigure())`. Cinq allers-retours de base par
    // tick pour cinq annonces qui sortiront toutes immédiatement de `notifier`.
    const lectures: number[] = [];
    const { depot } = depotSyntheseFactice({ candidates: [] });
    const depotTrace = {
      ...depot,
      async syntheseesNonAnnoncees() {
        lectures.push(1);
        return [];
      },
    };
    const { depot: ordo } = depotOrdoFactice();
    const { ia } = iaFactice();
    const { client } = supabaseFactice();
    const muet = { estConfigure: () => false, async envoyer() {}, async envoyerInformationLegale() {} };
    await executerSyntheseAvec(contexte(ordo), { depot: depotTrace, ia, supabase: client, courriel: muet });
    expect(lectures, "aucune lecture quand rien ne peut partir").toHaveLength(0);
  });
});

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

    await executerSyntheseAvec(contexte(depot), { depot: syn, ia, supabase: supabaseFactice().client, courriel: creerPortCourrielFactice() });

    expect(trace.reclames.map((r) => ({ job: r.job, fenetre: r.fenetre, cible: r.cible }))).toEqual([
      { job: NOM_JOB, fenetre: JOUR, cible: "u1" },
      { job: NOM_JOB, fenetre: JOUR, cible: "u2" },
    ]);
    expect(trace.clos.map((c) => ({ fenetre: c.fenetre, cible: c.cible, reussi: c.reussi }))).toEqual([
      { fenetre: JOUR, cible: "u1", reussi: true },
      { fenetre: JOUR, cible: "u2", reussi: true },
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

    await executerSyntheseAvec(contexte(depot), { depot: syn, ia, supabase: supabaseFactice().client, courriel });

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

    await executerSyntheseAvec(contexte(depot), { depot: syn, ia, supabase: supabaseFactice().client, courriel: creerPortCourrielFactice() });

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

    await executerSyntheseAvec(contexte(depot), { depot: syn, ia, supabase: supabaseFactice().client, courriel });

    expect(requetes, "des faits anciens ne suffisent pas — ils ont déjà été racontés").toEqual([]);
    expect(traceSyn.enregistrements).toEqual([]);
    expect(courriel.envoyes).toEqual([]);
    expect(closSansJeton(trace)).toEqual([{ fenetre: JOUR, cible: "u1", reussi: true, motif: null }]);
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

    await executerSyntheseAvec(contexte(depot), { depot: syn, ia, supabase: supabaseFactice().client, courriel });

    // Le JETON est lu AVANT la réservation (revue T5-2), pour la même raison qu'`estConfigure()` :
    // tout ce qui peut empêcher l'envoi doit être connu avant de consommer le droit d'envoyer.
    expect(trace.ordre).toEqual(["enregistrer", "jeton", "reserver"]);
    expect(trace.reservations).toEqual([
      // La clé d'idempotence est LA SYNTHÈSE écrite, plus la semaine ISO (revue 4.9) : le dépôt factice
      // rend `syn-u1`, et c'est exactement ce que l'annonce doit réserver.
      { id: "u1", motif: "synthese_prete", cle: "syn-u1", plafond: PLAFOND_NOTIFICATION_HEURES },
    ]);
    expect(courriel.envoyes).toEqual([
      { destinataire: "u1@exemple.fr", motif: "synthese_prete", jeton: JETON_FACTICE },
    ]);
  });

  it("[T6-8] un lot SATURÉ se dit — sinon la dégradation est parfaitement silencieuse", async () => {
    // 20 par tick × 7 jours = 140 synthèses par semaine pour tout le produit. Au-delà, le tri par attente
    // fait TOURNER le service : chacune est servie une semaine sur deux. Et comme un lot plein n'a par
    // définition aucun échec, il ne lève aucun incident — personne ne l'apprend.
    // Mutation-cible : retirer le signal, ou le poser sur `> LOT_PAR_TICK` (jamais atteint : la base est
    // déjà bornée par `limit`).
    const journal = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const plein = Array.from({ length: LOT_PAR_TICK }, (_, i) => `u${i}`);
      await executerSyntheseAvec(contexte(depotOrdoFactice().depot), {
        depot: depotSyntheseFactice({ candidates: plein }).depot,
        ia: iaFactice().ia,
        supabase: supabaseFactice().client,
        courriel: creerPortCourrielFactice(),
      });
      expect(JSON.stringify(journal.mock.calls)).toContain("synthese_lot_sature");

      journal.mockClear();
      await executerSyntheseAvec(contexte(depotOrdoFactice().depot), {
        depot: depotSyntheseFactice({ candidates: plein.slice(0, LOT_PAR_TICK - 1) }).depot,
        ia: iaFactice().ia,
        supabase: supabaseFactice().client,
        courriel: creerPortCourrielFactice(),
      });
      expect(
        JSON.stringify(journal.mock.calls),
        "un lot NON plein ne dit rien : une alarme qui hurle tous les jours n'est pas lue",
      ).not.toContain("synthese_lot_sature");
    } finally {
      journal.mockRestore();
    }
  });

  it("[T5-2] sans jeton de désabonnement, RIEN ne part — et la réservation n'est pas consommée", async () => {
    // Un courriel sans porte de sortie est exactement ce que la revue a refusé : la seule issue offerte
    // était de résilier ou de révoquer son consentement art. 9. Une panne de lecture du jeton n'est pas
    // une raison de reproduire ça — on se tait, et la synthèse attend dans l'app.
    // Mutation-cible : retirer `if (!jeton) return;`.
    const { depot } = depotOrdoFactice();
    const { depot: syn, trace } = depotSyntheseFactice({ jeton: () => null });
    const { ia } = iaFactice();
    const courriel = creerPortCourrielFactice();

    await executerSyntheseAvec(contexte(depot), { depot: syn, ia, supabase: supabaseFactice().client, courriel });

    expect(trace.enregistrements, "la synthèse, elle, est écrite").toHaveLength(1);
    expect(courriel.envoyes, "aucun courriel").toEqual([]);
    expect(trace.reservations, "et le droit d'envoyer reste entier").toEqual([]);
  });

  it("[T5-2] le jeton envoyé est celui de CETTE personne", async () => {
    // Un jeton partagé ne désabonnerait personne — ou désabonnerait tout le monde. Mutation-cible : rendre
    // un jeton constant depuis le dépôt.
    const { depot } = depotOrdoFactice();
    const { depot: syn } = depotSyntheseFactice({
      candidates: ["u1", "u2"],
      jeton: (id) => (id === "u1" ? JETON_FACTICE : "22222222-2222-4222-8222-222222222222"),
    });
    const { ia } = iaFactice();
    const courriel = creerPortCourrielFactice();

    await executerSyntheseAvec(contexte(depot), { depot: syn, ia, supabase: supabaseFactice().client, courriel });

    expect(courriel.envoyes.map((e) => e.jeton)).toEqual([
      JETON_FACTICE,
      "22222222-2222-4222-8222-222222222222",
    ]);
  });

  it("[T5-3] la trace des envois est purgée à chaque tick, et son échec se DIT", async () => {
    // `notification_envoyee` ne porte rien ligne à ligne ; empilée, c'est un calendrier d'assiduité, dont
    // l'absence parle autant que la présence. Mutation-cible : ne pas appeler la purge — ou l'appeler et
    // avaler son échec, ce qui rend une rétention en panne indistinguable d'une rétention absente.
    const { depot } = depotOrdoFactice();
    const { depot: syn, trace } = depotSyntheseFactice();
    const { ia } = iaFactice();

    await executerSyntheseAvec(contexte(depot), {
      depot: syn,
      ia,
      supabase: supabaseFactice().client,
      courriel: creerPortCourrielFactice(),
    });
    expect(trace.purges, "une fois par tick, avec la durée du domaine").toEqual([
      RETENTION_NOTIFICATION_JOURS,
    ]);

    const journal = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { depot: syn2 } = depotSyntheseFactice({ purge: null });
      await executerSyntheseAvec(contexte(depotOrdoFactice().depot), {
        depot: syn2,
        ia: iaFactice().ia,
        supabase: supabaseFactice().client,
        courriel: creerPortCourrielFactice(),
      });
      // Le motif vit dans le second argument de `console.warn` (un objet), pas dans la phrase.
      expect(JSON.stringify(journal.mock.calls)).toContain("synthese_purge_notifications");
    } finally {
      journal.mockRestore();
    }
  });

  it("le plafond refuse → aucun courriel, mais la synthèse est bien écrite", async () => {
    // Le plafond borne le CANAL, jamais le CONTENU. Confondre les deux laisserait une règle de politesse
    // effacer un récit — la personne ouvrirait l'app et n'y trouverait rien.
    const { depot } = depotOrdoFactice();
    const { depot: syn, trace } = depotSyntheseFactice({ reserver: () => false });
    const { ia } = iaFactice();
    const courriel = creerPortCourrielFactice();

    await executerSyntheseAvec(contexte(depot), { depot: syn, ia, supabase: supabaseFactice().client, courriel });

    expect(trace.enregistrements, "la synthèse existe").toHaveLength(1);
    expect(courriel.envoyes, "l'annonce, non").toEqual([]);
  });

  it("une synthèse DÉJÀ écrite (rejeu) n'est pas annoncée une seconde fois", async () => {
    // `enregistrer` rend `null` quand l'index unique a refusé, ou quand l'éligibilité a changé pendant la
    // production : rien de neuf n'a été produit, donc rien à annoncer. Mutation-cible : notifier
    // inconditionnellement.
    const { depot } = depotOrdoFactice();
    const { depot: syn, trace } = depotSyntheseFactice({ enregistrer: () => null });
    const { ia } = iaFactice();
    const courriel = creerPortCourrielFactice();

    await executerSyntheseAvec(contexte(depot), { depot: syn, ia, supabase: supabaseFactice().client, courriel });

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
    const muet = { estConfigure: () => false, envoyer: vi.fn(async () => {}), envoyerInformationLegale: vi.fn(async () => {}) };

    await executerSyntheseAvec(contexte(depot), { depot: syn, ia, supabase: supabaseFactice().client, courriel: muet });

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
      supabase: supabaseFactice().client,
      courriel: creerPortCourrielFactice({ echoue: true }),
    });

    try {
      expect(closSansJeton(trace)).toEqual([{ fenetre: JOUR, cible: "u1", reussi: true, motif: null }]);
      expect(trace.incidents, "un courriel perdu n'est pas un incident système").toEqual([]);
    } finally {
      // Hors `finally`, un échec d'assertion laissait `console.error` muet pour TOUT le reste du
      // fichier — les tests suivants perdaient leur capacité à observer les journaux sans le dire.
      espion.mockRestore();
    }
  });

  it("[NFR-020] le job n'a que TROIS arguments à donner au port, et le troisième est un uuid", async () => {
    // ── CE TEST ÉTAIT UNE TAUTOLOGIE (revue 4.9, T4-4) ────────────────────────────────────────────────
    //
    // Il faisait `Object.keys(courriel.envoyes[0])` — c'est-à-dire qu'il interrogeait un objet que la
    // DOUBLURE avait elle-même construit (`envoyes.push({ destinataire, motif })`). Il ne pouvait rien
    // rendre d'autre, quoi que le job ait fait. Le titre annonçait ce que le port REÇOIT ; l'assertion
    // mesurait ce que le test avait fabriqué.
    //
    // On capture donc les arguments BRUTS de l'appel, tels que le job les passe. Mutation-cible : ajouter
    // un argument de plus à `envoyer` (un aperçu, un prénom, une date) — le test rougit, alors que
    // l'ancienne version restait verte.
    //
    // Le troisième argument est arrivé avec le désabonnement (T5-2), et c'est le seul qui varie d'une
    // personne à l'autre. On vérifie donc DEUX choses : qu'il n'y en a pas un quatrième, et que celui-là
    // est un uuid et RIEN d'autre — c'est-à-dire qu'aucun texte ne peut voyager par ce paramètre.
    //
    // Ce que ce fichier ne peut PAS prouver, et qu'il ne prétend plus prouver : ce qui part réellement
    // sur le réseau. Ça, c'est `courriel-resend.test.ts`, qui inspecte la charge utile du `fetch`.
    const { depot } = depotOrdoFactice();
    const { depot: syn } = depotSyntheseFactice();
    const { ia } = iaFactice({ texte: "TEXTE INTIME QUI NE DOIT JAMAIS SORTIR" });
    const arguments_: unknown[][] = [];
    const courriel = {
      estConfigure: () => true,
      envoyer: async (...args: unknown[]) => {
        arguments_.push(args);
      },
    } as unknown as ReturnType<typeof creerPortCourrielFactice>;

    await executerSyntheseAvec(contexte(depot), { depot: syn, ia, supabase: supabaseFactice().client, courriel });

    expect(arguments_, "un seul envoi").toHaveLength(1);
    expect(arguments_[0], "TROIS arguments, pas quatre").toHaveLength(3);
    expect(arguments_[0]).toEqual(["u1@exemple.fr", "synthese_prete", JETON_FACTICE]);
    expect(
      String(arguments_[0][2]),
      "le seul paramètre variable est un uuid, donc incapable de porter du texte",
    ).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(JSON.stringify(arguments_), "et pas un mot de la synthèse").not.toContain("INTIME");
  });

  it("[T4-1] l'adresse INTROUVABLE : aucune réservation consommée, et la synthèse reste écrite", async () => {
    // Mutant survivant de la campagne d'origine : `if (!adresse) return;` supprimé. On appellerait alors
    // `reserverNotification` puis `envoyer(null, …)` — la réservation serait consommée pour un envoi
    // impossible, et le plafond bloquerait ensuite une annonce qui n'est jamais partie.
    const { depot } = depotOrdoFactice();
    const { depot: syn, trace } = depotSyntheseFactice({ adresse: () => null });
    const { ia } = iaFactice();
    const courriel = creerPortCourrielFactice();

    await executerSyntheseAvec(contexte(depot), { depot: syn, ia, supabase: supabaseFactice().client, courriel });

    expect(trace.enregistrements, "la synthèse existe et se lit dans l'app").toHaveLength(1);
    expect(trace.reservations, "aucune réservation brûlée").toEqual([]);
    expect(courriel.envoyes).toEqual([]);
  });

  it("[T4-1] le bail par personne est celui du domaine, pas une valeur au hasard", async () => {
    // Mutant survivant : `BAIL_PERSONNE_S = 180` → `1`. Le bail devient inopérant : deux invocations
    // concurrentes (un rejeu de cron, un tick qui déborde) se marchent dessus sur la même personne.
    // Aucun test ne le voyait — la trace collectait `bail` et ne l'assérait jamais.
    const { depot, trace } = depotOrdoFactice();
    const { depot: syn } = depotSyntheseFactice();
    const { ia } = iaFactice();

    await executerSyntheseAvec(contexte(depot), {
      depot: syn,
      ia,
      supabase: supabaseFactice().client,
      courriel: creerPortCourrielFactice(),
    });

    expect(trace.reclames[0].bail, "assez long pour couvrir un appel au modèle fort").toBe(BAIL_PERSONNE_S);
    expect(BAIL_PERSONNE_S * 1000).toBeGreaterThan(DELAI_MODELE_MS);
  });

  it("[T4-1] la période écrite va du DÉBUT vers la FIN — les arguments ne sont pas inversés", async () => {
    // Mutant survivant : `enregistrer(…, periode.fin, periode.debut, …)`. La contrainte SQL
    // `periode_fin >= periode_debut` rejetterait TOUTES les insertions — donc aucune synthèse ne serait
    // jamais écrite, pour personne — et la suite restait verte, parce que la trace collectait `debut` et
    // `fin` sans jamais les assérer.
    const { depot } = depotOrdoFactice();
    const { depot: syn, trace } = depotSyntheseFactice();
    const { ia } = iaFactice();

    await executerSyntheseAvec(contexte(depot), {
      depot: syn,
      ia,
      supabase: supabaseFactice().client,
      courriel: creerPortCourrielFactice(),
    });

    const ecrit = trace.enregistrements[0];
    expect(ecrit.debut).toBe(MATERIAU_PLEIN.entrees[0].cree_le);
    expect(ecrit.fin).toBe(MATERIAU_PLEIN.jusqu_a);
    expect(new Date(ecrit.debut).getTime()).toBeLessThan(new Date(ecrit.fin).getTime());
    expect(ecrit.tronquee).toBe(MATERIAU_PLEIN.tronquee);
  });

  it("[T4-1] un courriel perdu LAISSE UNE TRACE — sinon il disparaît sans témoin", async () => {
    // Mutant survivant : retirer la journalisation. L'envoi échoue, la synthèse est écrite, la fenêtre
    // est close en réussite — et absolument rien nulle part ne dit qu'une annonce n'est pas partie. Le
    // test d'origine figeait bien « ce n'est pas un incident système », mais n'exigeait aucune trace.
    const espion = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { depot } = depotOrdoFactice();
      const { depot: syn } = depotSyntheseFactice();
      const { ia } = iaFactice();

      await executerSyntheseAvec(contexte(depot), {
        depot: syn,
        ia,
        supabase: supabaseFactice().client,
        courriel: creerPortCourrielFactice({ echoue: true }),
      });

      expect(espion).toHaveBeenCalledWith(
        expect.stringContaining("exploitation"),
        expect.objectContaining({ motif: "synthese_courriel" }),
      );
    } finally {
      espion.mockRestore();
    }
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

    await executerSyntheseAvec(contexte(depot), { depot: syn, ia, supabase: supabaseFactice().client, courriel });

    expect(closSansJeton(trace)).toEqual([
      { fenetre: JOUR, cible: "u1", reussi: false, motif: "materiau_synthese: 08006" },
      { fenetre: JOUR, cible: "u2", reussi: true, motif: null },
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

    await executerSyntheseAvec(contexte(depot), { depot: syn, ia, supabase: supabaseFactice().client, courriel: creerPortCourrielFactice() });

    expect(trace.clos[0].motif).toBe("erreur_non_identifiee");
  });

  it("un lot ENTIÈREMENT en échec lève UN incident — c'est le chemin, plus une personne", async () => {
    // Aucun incident par personne (une panne de modèle en toucherait vingt et noierait la table), mais
    // un lot entier qui tombe est un vrai signal. Mutation-cible : ne jamais lever, ou lever par personne.
    const { depot, trace } = depotOrdoFactice();
    const { depot: syn } = depotSyntheseFactice({ candidates: ["u1", "u2", "u3"] });
    const { ia } = iaFactice({ echoue: true });

    await executerSyntheseAvec(contexte(depot), { depot: syn, ia, supabase: supabaseFactice().client, courriel: creerPortCourrielFactice() });

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

    await executerSyntheseAvec(contexte(depot), { depot: syn, ia, supabase: supabaseFactice().client, courriel: creerPortCourrielFactice() });

    expect(trace.reclames).toEqual([]);
    expect(trace.incidents).toEqual([]);
  });
});

describe("le lot est BORNÉ — la lambda a 60 s, pas l'éternité", () => {
  it("le job demande au plus `LOT_PAR_TICK` candidates — la CADENCE, elle, est décidée en base", async () => {
    // La sélection ne porte plus de fenêtre : `utilisatrices_a_synthetiser` ne prend qu'une limite, et
    // c'est la base qui applique « sept jours depuis la dernière période, sauf rattrapage ». Passer une
    // semaine ici reviendrait à recréer côté TypeScript la clé calendaire qu'on vient de retirer.
    const { depot } = depotOrdoFactice();
    const appel: { limite?: number } = {};
    const syn: DepotSynthese = {
      ...depotSyntheseFactice().depot,
      async candidates(_job, limite) {
        appel.limite = limite;
        return [];
      },
    };
    const { ia } = iaFactice();

    await executerSyntheseAvec(contexte(depot), { depot: syn, ia, supabase: supabaseFactice().client, courriel: creerPortCourrielFactice() });

    expect(appel).toEqual({ limite: LOT_PAR_TICK });
  });

  it("le matériau est demandé BORNÉ en nombre ET en taille", async () => {
    // `PLAFOND_ENTREES` seul ne bornait rien : 200 est un nombre d'entrées, et rien ne borne la longueur
    // d'une entrée. Mutation-cible : retirer `PLAFOND_OCTETS` de l'appel. 200 entrées longues dépassent
    // la fenêtre du modèle → 400 → aucune écriture → le filigrane n'avance pas → les mêmes 200 entrées
    // demain, et tous les jours suivants, en silence.
    const { depot } = depotOrdoFactice();
    const { depot: syn, trace } = depotSyntheseFactice();
    const { ia } = iaFactice();

    await executerSyntheseAvec(contexte(depot), { depot: syn, ia, supabase: supabaseFactice().client, courriel: creerPortCourrielFactice() });

    expect(trace.plafonds).toEqual([{ entrees: PLAFOND_ENTREES, octets: PLAFOND_OCTETS }]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// REVUE 4.9 / T2-1 — l'egress art. 9 est de nouveau un passage OBLIGÉ
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

describe("[T2-1 / AD-13] l'état vivant est relu JUSTE AVANT de poster le journal", () => {
  it("[LE CŒUR] une révocation survenue APRÈS la constitution du lot bloque l'envoi", async () => {
    // LE défaut : le job appelait `completer()` sur l'adaptateur NU. `contientArt9: true` était donc
    // parfaitement inerte — son seul lecteur est l'egress-guard, jamais atteint sur ce chemin. Le lot est
    // constitué en tête de tick puis traité SÉQUENTIELLEMENT, une personne à la fois, chacune coûtant un
    // appel au modèle fort : pour la vingtième, l'écart entre le contrôle et l'envoi se compte en
    // dizaines de secondes. AD-13 dit littéralement « Prevents: envoi au fournisseur après une révocation
    // en vol ».
    //
    // Mutation-cible : remplacer `envoyerSousEgressArt9Ordonnanceur` par `deps.ia.completer`.
    const espion = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { depot, trace } = depotOrdoFactice();
      const { depot: syn, trace: traceSyn } = depotSyntheseFactice({ candidates: ["u1", "u2"] });
      const { ia, requetes } = iaFactice();
      const courriel = creerPortCourrielFactice();
      const { client, appels } = supabaseFactice({ eligible: (id) => id !== "u2" });

      await executerSyntheseAvec(contexte(depot), { depot: syn, ia, supabase: client, courriel });

      expect(appels, "la garde est interrogée pour CHAQUE personne").toEqual([
        "eligible_a_synthese:u1",
        "eligible_a_synthese:u2",
      ]);
      expect(requetes, "u2 n'a JAMAIS été postée au fournisseur").toHaveLength(1);
      expect(traceSyn.enregistrements.map((e) => e.id), "et rien n'a été écrit pour elle").toEqual(["u1"]);
      expect(courriel.envoyes.map((e) => e.destinataire)).toEqual(["u1@exemple.fr"]);
      // Close en RÉUSSITE : le job a fait son travail, qui était de constater qu'il ne devait rien faire.
      // Clore en échec la ferait revenir demain pour reconstater la même chose, tous les jours.
      expect(trace.clos.map((c) => ({ cible: c.cible, reussi: c.reussi }))).toEqual([
        { cible: "u1", reussi: true },
        { cible: "u2", reussi: true },
      ]);

      // ⚠️ Story 6.1a — CHAQUE PERSONNE EST CLOSE AVEC SON PROPRE JETON. Trouvé par la campagne de
      // mutation, pas par la revue : hisser le jeton hors de la boucle (ou le figer) ne faisait
      // rougir AUCUN des 41 tests de ce fichier. Le fan-out réclame par personne, donc il détient
      // autant de jetons que de personnes — et fermer la personne suivante avec le jeton de la
      // précédente serait refusé en base, silencieusement, pour tout le monde sauf la première.
      //
      // Le dépôt factice frappe `jeton-<cible>` : l'assertion dit littéralement « le jeton d'ELLE ».
      // Mutation-cible : figer `jeton` avant la boucle dans `jobs/synthese.ts`.
      expect(trace.clos.map((c) => c.jeton)).toEqual(["jeton-u1", "jeton-u2"]);
    } finally {
      espion.mockRestore();
    }
  });

  it("le ZDR non prouvé bloque AUSSI — la garde est agnostique au fournisseur (AD-3)", async () => {
    const espion = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { depot } = depotOrdoFactice();
      const { depot: syn, trace } = depotSyntheseFactice();
      const { ia, requetes } = iaFactice();
      const iaSansZdr: AiPort = { ...ia, estZdrProuve: () => false };

      await executerSyntheseAvec(contexte(depot), {
        depot: syn,
        ia: iaSansZdr,
        supabase: supabaseFactice().client,
        courriel: creerPortCourrielFactice(),
      });

      expect(requetes, "rien n'est parti").toHaveLength(0);
      expect(trace.enregistrements, "rien n'est écrit").toEqual([]);
    } finally {
      espion.mockRestore();
    }
  });

  it("une erreur de la RPC de garde BLOQUE (fail-safe), elle ne laisse pas passer", async () => {
    // Dernier `await` avant l'envoi : dans le doute, on ne poste pas. Mutation-cible : ignorer `error`.
    const espion = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { depot } = depotOrdoFactice();
      const { depot: syn, trace } = depotSyntheseFactice();
      const { ia, requetes } = iaFactice();

      await executerSyntheseAvec(contexte(depot), {
        depot: syn,
        ia,
        supabase: supabaseFactice({ echoue: true }).client,
        courriel: creerPortCourrielFactice(),
      });

      expect(requetes).toHaveLength(0);
      expect(trace.enregistrements).toEqual([]);
    } finally {
      espion.mockRestore();
    }
  });

  it("[T2-3] une sortie de modèle VIDE n'est jamais écrite, et compte comme un échec", async () => {
    // Le blanc faisait lever `contenu_non_vide`, donc échouer la tranche — et comme le filigrane
    // n'avance pas, la même tranche était rejouée à l'identique le lendemain. Une garde de base de
    // données transformée en panne permanente. Mutation-cible : retirer le `if (contenu === null) throw`.
    const { depot, trace } = depotOrdoFactice();
    const { depot: syn, trace: traceSyn } = depotSyntheseFactice();
    const { ia } = iaFactice({ texte: "   \n  " });

    await executerSyntheseAvec(contexte(depot), {
      depot: syn,
      ia,
      supabase: supabaseFactice().client,
      courriel: creerPortCourrielFactice(),
    });

    expect(traceSyn.enregistrements, "rien n'entre en base").toEqual([]);
    expect(trace.clos[0].reussi, "et c'est bien un échec : on a payé le modèle pour rien").toBe(false);
    expect(trace.clos[0].motif).toBe("synthese_sortie_vide");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// REVUE 4.9 — LOT B : le budget, les compteurs, et la clôture remise à sa place
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

describe("[T3-1] le job rend la main AVANT d'être coupé — se faire couper, c'est mentir", () => {
  it("[LE CŒUR] budget épuisé → la boucle s'arrête, sans réclamer ni produire quoi que ce soit", async () => {
    // Coupé par `avecDelai`, le fan-out est clos en `echoue` et lève un `job_echoue` — alors qu'il a
    // peut-être servi tout le monde. Avec 20 personnes pour 38 s et un appel au modèle fort chacune, la
    // coupure était la RÈGLE, pas le cas limite : le mensonge était quotidien, et il faisait répondre
    // `degrade` à la sonde PUBLIQUE en permanence dès le premier jour de production. Une alarme qui hurle
    // tous les jours est une alarme que personne ne lit — et c'est celle qui doit dire que la synthèse a
    // cessé de fonctionner. Mutation-cible : retirer le `break` sur l'échéance.
    const espion = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { depot, trace } = depotOrdoFactice();
      const { depot: syn, trace: traceSyn } = depotSyntheseFactice({ candidates: ["u1", "u2", "u3"] });
      const { ia, requetes } = iaFactice();

      // Échéance dans 1 s : il en faut `RESERVE_PERSONNE_MS` pour tenter quelqu'un.
      await executerSyntheseAvec(contexte(depot, 1_000), {
        depot: syn,
        ia,
        supabase: supabaseFactice().client,
        courriel: creerPortCourrielFactice(),
      });

      expect(trace.reclames, "personne n'est réclamée : on n'ouvre pas ce qu'on ne peut pas finir").toEqual([]);
      expect(requetes, "aucun appel au modèle").toEqual([]);
      expect(traceSyn.enregistrements).toEqual([]);
      expect(trace.incidents, "et surtout : AUCUN incident — rendre la main n'est pas échouer").toEqual([]);
    } finally {
      espion.mockRestore();
    }
  });

  it("[CONTRÔLE POSITIF] avec du budget, tout le lot est servi", async () => {
    // Sans lui, le test précédent serait satisfait par un job qui ne fait JAMAIS rien.
    const { depot, trace } = depotOrdoFactice();
    const { depot: syn } = depotSyntheseFactice({ candidates: ["u1", "u2", "u3"] });
    const { ia, requetes } = iaFactice();

    await executerSyntheseAvec(contexte(depot), {
      depot: syn,
      ia,
      supabase: supabaseFactice().client,
      courriel: creerPortCourrielFactice(),
    });

    expect(requetes).toHaveLength(3);
    expect(trace.clos.filter((c) => c.reussi)).toHaveLength(3);
  });

  it("le reste du lot est DIT, pas avalé — sinon la dégradation serait invisible", async () => {
    const espion = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { depot } = depotOrdoFactice();
      const { depot: syn } = depotSyntheseFactice({ candidates: ["u1", "u2", "u3", "u4"] });
      const { ia } = iaFactice();

      await executerSyntheseAvec(contexte(depot, 1_000), {
        depot: syn,
        ia,
        supabase: supabaseFactice().client,
        courriel: creerPortCourrielFactice(),
      });

      expect(espion).toHaveBeenCalledWith(
        expect.stringContaining("exploitation"),
        expect.objectContaining({ motif: "synthese_lot_incomplet", code: "restantes_4" }),
      );
    } finally {
      espion.mockRestore();
    }
  });
});

describe("[T3-7] la clôture est HORS du try, et elle est protégée", () => {
  it("[LE CŒUR] une clôture qui LÈVE n'emporte plus les personnes suivantes", async () => {
    // Sans le catch autour de `clore`, une base indisponible au moment de clore la première personne
    // faisait sortir l'exception de la boucle : u2 et u3 n'étaient JAMAIS réclamées, le compteur d'échecs
    // était perdu, et l'unique signal — un `job_echoue` du répartiteur — ne disait rien du fait que deux
    // personnes sur trois n'avaient pas été regardées. Une panne base de trente secondes au mauvais
    // moment coûtait la journée entière. Mutation-cible : retirer le try/catch autour de `clore`.
    const espion = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { depot, trace } = depotOrdoFactice();
      const depotQuiCasse: DepotOrdonnanceur = {
        ...depot,
        async clore(j, fenetre, cible, reussi, motif, jeton) {
          if (cible === "u1") throw new Error("clore_indisponible: 08006");
          return depot.clore(j, fenetre, cible, reussi, motif, jeton);
        },
      };
      const { depot: syn, trace: traceSyn } = depotSyntheseFactice({ candidates: ["u1", "u2", "u3"] });
      const { ia } = iaFactice();

      await executerSyntheseAvec(contexte(depotQuiCasse), {
        depot: syn,
        ia,
        supabase: supabaseFactice().client,
        courriel: creerPortCourrielFactice(),
      });

      expect(traceSyn.materiaux, "les trois ont été traitées").toEqual(["u1", "u2", "u3"]);
      expect(trace.clos.map((c) => c.cible), "u1 n'a pas pu être close, les autres si").toEqual(["u2", "u3"]);
    } finally {
      espion.mockRestore();
    }
  });

  it("[LE CŒUR] une synthèse ÉCRITE et ANNONCÉE n'est jamais tracée comme un échec", async () => {
    // C'est le défaut n°3 de la revue 4.8, que le répartiteur avait corrigé et que ce job avait
    // réintroduit. Un hoquet réseau sur `clore(true)` — après une synthèse écrite et un courriel PARTI —
    // tombait dans le catch du job : on écrivait `echoue`, et la trace disait le contraire de ce qui
    // s'était produit. Mutation-cible : remettre `clore(true)` à l'intérieur du try.
    const espion = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { depot } = depotOrdoFactice();
      const clotures: { reussi: boolean; motif: string | null }[] = [];
      const depotQuiCasse: DepotOrdonnanceur = {
        ...depot,
        async clore(_j, _f, _c, reussi, motif) {
          clotures.push({ reussi, motif });
          throw new Error("hoquet_reseau: 08006");
        },
      };
      const { depot: syn, trace: traceSyn } = depotSyntheseFactice();
      const { ia } = iaFactice();
      const courriel = creerPortCourrielFactice();

      await executerSyntheseAvec(contexte(depotQuiCasse), {
        depot: syn,
        ia,
        supabase: supabaseFactice().client,
        courriel,
      });

      expect(traceSyn.enregistrements, "la synthèse est bien écrite").toHaveLength(1);
      expect(courriel.envoyes, "le courriel est bien parti").toHaveLength(1);
      expect(clotures, "UNE seule tentative de clôture, et elle dit RÉUSSITE").toEqual([
        { reussi: true, motif: null },
      ]);
    } finally {
      espion.mockRestore();
    }
  });
});

describe("[T3-4] le dénominateur de l'alarme est ce qu'on a VRAIMENT tenté", () => {
  it("[LE CŒUR] dix-neuf « rien à dire » ne diluent plus un lot réellement en échec", async () => {
    // Ancien comportement : `echecs === candidates.length`. Dix-neuf personnes qui n'avaient rien à dire
    // et une seule qui échoue → 1 ≠ 20 → aucun incident, alors que 100 % du travail RÉEL avait échoué.
    // Mutation-cible : compter `candidates.length` au lieu de `tentees`.
    const espion = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { depot, trace } = depotOrdoFactice();
      const gens = ["a", "b", "c", "d"];
      const { depot: syn } = depotSyntheseFactice({
        candidates: gens,
        // a et b travaillent (et échouent) ; c et d n'ont rien à dire.
        materiau: (id) => (id === "c" || id === "d" ? MATERIAU_VIDE : MATERIAU_PLEIN),
      });
      const { ia } = iaFactice({ echoue: true });

      await executerSyntheseAvec(contexte(depot), {
        depot: syn,
        ia,
        supabase: supabaseFactice().client,
        courriel: creerPortCourrielFactice(),
      });

      expect(trace.incidents, "2 tentées, 2 échouées : le chemin est cassé, on le dit").toEqual([
        { type: "job_echoue", job: NOM_JOB, detail: "lot_entierement_echoue" },
      ]);
    } finally {
      espion.mockRestore();
    }
  });

  it("[LE PIÈGE INVERSE] une SEULE personne en échec ne déclenche pas d'incident système", async () => {
    // Ce produit a une poignée d'utilisatrices : `candidates.length` vaut 1 ou 2 presque toujours. Avec
    // l'ancienne règle, CHAQUE échec individuel — une réponse de modèle vide, une contrainte violée sur
    // une seule personne — devenait un incident système et faisait passer /api/health en `degrade`. Le
    // commentaire d'origine disait « ce n'est plus une personne, c'est le chemin » : à N=1, c'est
    // précisément une personne. Mutation-cible : retirer `tentees >= 2`.
    const espion = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { depot, trace } = depotOrdoFactice();
      const { depot: syn } = depotSyntheseFactice({ candidates: ["seule"] });
      const { ia } = iaFactice({ echoue: true });

      await executerSyntheseAvec(contexte(depot), {
        depot: syn,
        ia,
        supabase: supabaseFactice().client,
        courriel: creerPortCourrielFactice(),
      });

      expect(trace.clos[0].reussi, "elle est bien close en échec").toBe(false);
      expect(trace.incidents, "mais un hoquet isolé n'est pas un incident système").toEqual([]);
    } finally {
      espion.mockRestore();
    }
  });

  it("[T3-2] en revanche, une personne qui échoue depuis TROIS JOURS, c'est un signal", async () => {
    // Le disjoncteur. Sans lui, une personne dont le matériau fait échouer le modèle de façon
    // déterministe revenait chaque jour, PREMIÈRE dans le tri (elle n'a jamais rien reçu), et brûlait un
    // appel au modèle fort à vie. La base l'écarte après trois échecs en sept jours ; ici on le DIT,
    // sinon l'écartement serait silencieux. Mutation-cible : retirer l'appel à `personnesEnEchecRepete`.
    const { depot, trace } = depotOrdoFactice();
    const { depot: syn } = depotSyntheseFactice({ candidates: [], enEchecRepete: 1 });
    const { ia } = iaFactice();

    await executerSyntheseAvec(contexte(depot), {
      depot: syn,
      ia,
      supabase: supabaseFactice().client,
      courriel: creerPortCourrielFactice(),
    });

    expect(trace.incidents).toEqual([
      { type: "job_echoue", job: NOM_JOB, detail: "echecs_repetes" },
    ]);
  });
});

describe("[T3-2] l'appel au modèle est BORNÉ — sinon une seule personne affame tout le monde", () => {
  it("[LE CŒUR] un appel qui pend est coupé, et les suivantes passent", async () => {
    // Le tri sert d'abord celle qui a attendu le plus longtemps — donc celle qui n'a jamais rien reçu.
    // Si son appel pend, il consommait tout le budget : personne d'autre n'était traité, sa ligne restait
    // en cours, aucune synthèse n'était écrite, son attente restait nulle — et DEMAIN ELLE ÉTAIT DE
    // NOUVEAU PREMIÈRE. Ce n'était pas une dégradation, c'était un arrêt du service pour tout le monde,
    // déclenché par une seule personne. Mutation-cible : retirer `avecDelai` autour de l'egress.
    vi.useFakeTimers();
    try {
      const { depot, trace } = depotOrdoFactice();
      const { depot: syn } = depotSyntheseFactice({ candidates: ["pendante", "suivante"] });
      const requetes: RequeteIa[] = [];
      const ia: AiPort = {
        async completer(req): Promise<ReponseIa> {
          requetes.push(req);
          // La première ne répond JAMAIS.
          if (requetes.length === 1) return new Promise<ReponseIa>(() => {});
          return { texte: "un récit", tier: "fort", modele: "factice", usage: { tokensEntree: 1, tokensSortie: 1 } };
        },
        async *diffuser() {
          throw new Error("jamais");
        },
        estZdrProuve: () => true,
      };

      const promesse = executerSyntheseAvec(contexte(depot), {
        depot: syn,
        ia,
        supabase: supabaseFactice().client,
        courriel: creerPortCourrielFactice(),
      });
      await vi.advanceTimersByTimeAsync(DELAI_MODELE_MS + 1_000);
      await promesse;

      expect(requetes, "la seconde a bien été tentée").toHaveLength(2);
      expect(trace.clos.map((c) => ({ cible: c.cible, reussi: c.reussi }))).toEqual([
        { cible: "pendante", reussi: false },
        { cible: "suivante", reussi: true },
      ]);
      expect(trace.clos[0].motif).toBe("synthese_modele_timeout");
    } finally {
      vi.useRealTimers();
    }
  });
});
