import { describe, it, expect, vi } from "vitest";
import {
  executerRappelEcheanceAvec,
  LOT_PAR_TICK,
  RESERVE_PERSONNE_MS,
  DELAI_ENVOI_MS,
  NOM_JOB,
} from "@/lib/ordonnanceur/jobs/rappel-echeance";
import { REGISTRE } from "@/lib/ordonnanceur/registre";
import { gabaritPour } from "@/lib/courriel/gabarits";
import { validerOrigine } from "@/lib/courriel/origine";
import { jetonValide } from "@/lib/domain/jeton-desabonnement";
import type { ContexteJob } from "@/lib/ordonnanceur/registre";
import type { DepotCanalCourriel } from "@/lib/data/depot-canal-courriel";
import type { PortCourriel } from "@/lib/courriel/port";

/**
 * Story 4.10 (T5, AC3) — LE JOB DE RAPPEL D'ÉCHÉANCE, et ce qu'il ne fait pas.
 *
 * Les gardes de SÉLECTION (AD-17, premium, consentement, « aujourd'hui seulement ») vivent en SQL et
 * sont prouvées dans `intention-sql.test.ts` — les prouver ici serait les prouver à l'endroit où elles
 * ne sont pas. Ici on prouve l'ORDRE des effets, le repli, et la discrétion du courriel.
 */

const JETON_FACTICE = "11111111-1111-4111-8111-111111111111";
const JOUR = "2026-08-06";

function canalFactice(options: {
  adresse?: (id: string) => string | null;
  jeton?: (id: string) => string | null;
  reserver?: (id: string) => boolean;
} = {}) {
  const ordre: string[] = [];
  const reservations: { id: string; motif: string; cle: string; plafond: number }[] = [];
  const liberations: { id: string; motif: string; cle: string }[] = [];
  const canal: DepotCanalCourriel = {
    async adresse(id) {
      ordre.push("adresse");
      return options.adresse ? options.adresse(id) : `${id}@exemple.fr`;
    },
    async jetonDesabonnement(id) {
      ordre.push("jeton");
      const j = options.jeton ? options.jeton(id) : JETON_FACTICE;
      return jetonValide(j);
    },
    async reserverNotification(id, motif, cle, plafond) {
      ordre.push("reserver");
      reservations.push({ id, motif, cle, plafond });
      return options.reserver ? options.reserver(id) : true;
    },
    async libererNotification(id, motif, cle) {
      ordre.push("liberer");
      liberations.push({ id, motif, cle });
    },
  };
  return { canal, ordre, reservations, liberations };
}

function courrielFactice(options: { configure?: boolean; echoue?: (destinataire: string) => boolean } = {}) {
  const envois: { destinataire: string; motif: string }[] = [];
  const port: PortCourriel = {
    estConfigure: () => options.configure !== false,
    async envoyer(destinataire, motif) {
      // ⚠️ ÉCHEC PAR DESTINATAIRE, et pas un drapeau global (revue 4.10). Avec un drapeau global, le test
      // « l'échec d'UNE personne n'arrête pas les autres » ne prouvait RIEN : tout le monde échouait, donc
      // `envois` valait 0 que le `try` soit dans la boucle ou autour. Vérifié par mutation : sortir le
      // `try/catch` de la boucle laissait les seize tests verts.
      if (options.echoue?.(destinataire)) throw new Error("resend_500");
      envois.push({ destinataire, motif });
    },
  };
  return { port, envois };
}

/** Un contexte avec de la marge : `echeance` très loin → aucune coupure de lot. */
function ctxLarge(): ContexteJob {
  return {
    depot: {} as never,
    instant: new Date("2026-08-06T06:00:00Z"),
    echeance: new Date(Date.now() + 60_000),
    registre: [],
  };
}

describe("[AC3] l'ordre des effets : tout ce qui peut EMPÊCHER l'envoi est connu avant de réserver", () => {
  it("[LE CŒUR] adresse → jeton → réservation → envoi, dans cet ordre", async () => {
    // Mutation-cible : déplacer `reserverNotification` avant la lecture du jeton. Réserver puis découvrir
    // qu'on ne peut pas envoyer CONSOMME le droit d'envoyer sans avoir envoyé — et le plafond de 72 h
    // bloque alors une notification qui n'est jamais partie.
    const { canal, ordre } = canalFactice();
    const { port, envois } = courrielFactice();
    await executerRappelEcheanceAvec(ctxLarge(), {
      canal,
      courriel: port,
      dus: async () => [{ utilisatriceId: "u1", jour: JOUR }],
    });
    expect(ordre).toEqual(["adresse", "jeton", "reserver"]);
    expect(envois).toEqual([{ destinataire: "u1@exemple.fr", motif: "echeance_intention" }]);
  });

  it("canal NON CONFIGURÉ → aucune lecture, aucune réservation, aucun envoi", async () => {
    // Mutation-cible : retirer le `estConfigure()` d'entrée. Sans clé, on brûlerait des réservations
    // pour des courriels qui ne partent pas — et le plafond bloquerait les vrais le jour où la clé arrive.
    const { canal, ordre } = canalFactice();
    const { port } = courrielFactice({ configure: false });
    const dus = vi.fn(async () => []);
    await executerRappelEcheanceAvec(ctxLarge(), { canal, courriel: port, dus });
    expect(dus, "on ne lit même pas les échéances dues").not.toHaveBeenCalled();
    expect(ordre).toEqual([]);
  });

  it("sans adresse ou sans JETON, rien ne part et rien n'est réservé", async () => {
    // Un courriel sans lien de désabonnement ne part pas : l'absence de porte de sortie est ce qui a
    // rendu la première version du canal indéfendable (revue T5-2).
    for (const manquant of ["adresse", "jeton"] as const) {
      const { canal, ordre } = canalFactice(
        manquant === "adresse" ? { adresse: () => null } : { jeton: () => null },
      );
      const { port, envois } = courrielFactice();
      await executerRappelEcheanceAvec(ctxLarge(), {
        canal,
        courriel: port,
        dus: async () => [{ utilisatriceId: "u1", jour: JOUR }],
      });
      expect(ordre, `sans ${manquant}`).not.toContain("reserver");
      expect(envois).toHaveLength(0);
    }
  });

  it("réservation REFUSÉE (plafond de famille, désabonnement) → aucun envoi, en silence", async () => {
    const { canal } = canalFactice({ reserver: () => false });
    const { port, envois } = courrielFactice();
    await executerRappelEcheanceAvec(ctxLarge(), {
      canal,
      courriel: port,
      dus: async () => [{ utilisatriceId: "u1", jour: JOUR }],
    });
    expect(envois).toHaveLength(0);
  });

  it("la clé de réservation est le JOUR, pas l'intention — un seul rappel par personne et par jour", async () => {
    // Mutation-cible : passer un identifiant d'intention. Deux échéances le même jour feraient alors
    // deux courriels — dont le second serait de toute façon refusé par le plafond de famille, donc
    // PERDU. Le texte ne dit rien du contenu : un seul rappel suffit et dit tout.
    const { canal, reservations } = canalFactice();
    const { port } = courrielFactice();
    await executerRappelEcheanceAvec(ctxLarge(), {
      canal,
      courriel: port,
      dus: async () => [{ utilisatriceId: "u1", jour: JOUR }],
    });
    expect(reservations).toEqual([{ id: "u1", motif: "echeance_intention", cle: JOUR, plafond: 72 }]);
  });
});

describe("repli et budget", () => {
  it("[LE CŒUR] un envoi qui LÈVE pour u1 n'empêche PAS u2 d'être servie", async () => {
    // ⚠️ CE TEST NE PROUVAIT RIEN AVANT LA REVUE. Sa première version faisait échouer `adresse` (donc un
    // simple `continue`, sans exception) et sa jumelle faisait échouer TOUT LE MONDE — dans les deux cas,
    // sortir le `try/catch` de la boucle laissait les tests verts. Il faut un échec RÉEL, sur UNE seule
    // personne, pendant qu'une autre réussit. En production, sans cette garde, un 5xx de Resend sur la
    // première personne coupait silencieusement tous les rappels du jour.
    // Mutation-cible : entourer la boucle entière du `try/catch` au lieu de chaque itération.
    const { canal } = canalFactice();
    const { port, envois } = courrielFactice({ echoue: (d) => d === "u1@exemple.fr" });
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await executerRappelEcheanceAvec(ctxLarge(), {
      canal,
      courriel: port,
      dus: async () => [
        { utilisatriceId: "u1", jour: JOUR },
        { utilisatriceId: "u2", jour: JOUR },
      ],
    });
    expect(envois.map((e) => e.destinataire), "u2 est servie malgré l'échec de u1").toEqual(["u2@exemple.fr"]);
    spy.mockRestore();
  });

  it("[LE CŒUR] un envoi qui échoue REND la réservation — sinon le rappel est perdu à jamais", async () => {
    // ⚠️ L'ASYMÉTRIE HÉRITÉE SANS ÊTRE VUE (revue 4.10). Pour la synthèse, un envoi raté après réservation
    // perd le courriel de la période — et la clé se régénère à la suivante. Pour le RAPPEL, la clé est le
    // JOUR CIVIL et l'échéance ne repasse jamais (`echeance = aujourd'hui`, jamais `<=`) : un seul 5xx de
    // Resend effaçait DÉFINITIVEMENT un rendez-vous qu'elle s'était fixé, sans trace ni reprise.
    // Mutation-cible : retirer l'appel à `libererNotification`.
    const { canal, liberations } = canalFactice();
    const { port } = courrielFactice({ echoue: () => true });
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await executerRappelEcheanceAvec(ctxLarge(), {
      canal,
      courriel: port,
      dus: async () => [{ utilisatriceId: "u1", jour: JOUR }],
    });
    expect(liberations, "la clé du jour est rendue : demain, ou une relance, retentera").toEqual([
      { id: "u1", motif: "echeance_intention", cle: JOUR },
    ]);
    spy.mockRestore();
  });

  it("un envoi RÉUSSI ne rend rien (le plafond doit rester consommé)", async () => {
    // Le pendant : libérer après un envoi réussi rouvrirait le canal et permettrait un second courriel.
    const { canal, liberations } = canalFactice();
    const { port, envois } = courrielFactice();
    await executerRappelEcheanceAvec(ctxLarge(), {
      canal,
      courriel: port,
      dus: async () => [{ utilisatriceId: "u1", jour: JOUR }],
    });
    expect(envois).toHaveLength(1);
    expect(liberations).toHaveLength(0);
  });

  it("[T3-1] le job REND LA MAIN avant d'être coupé plutôt que de se faire tuer", async () => {
    // Se faire couper par `avecDelai` clôt le job en `echoue` et lève un `job_echoue` — alors que tout
    // le monde a peut-être été servi. Ce mensonge-là faisait répondre `degrade` à la sonde publique en
    // permanence. Mutation-cible : retirer le `break` sur `ctx.echeance`.
    const { canal } = canalFactice();
    const { port, envois } = courrielFactice();
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ctxSerre: ContexteJob = { ...ctxLarge(), echeance: new Date(Date.now() + RESERVE_PERSONNE_MS - 100) };
    await executerRappelEcheanceAvec(ctxSerre, {
      canal,
      courriel: port,
      dus: async () => [{ utilisatriceId: "u1", jour: JOUR }],
    });
    expect(envois, "personne servie, mais la main est rendue proprement").toHaveLength(0);
    spy.mockRestore();
  });
});

describe("[D5] le budget du registre après rééquilibrage", () => {
  it("le job de rappel est AU REGISTRE, quotidien, et sa tolérance n'est pas un multiple de sa cadence", async () => {
    const rappel = REGISTRE.find((j) => j.nom === NOM_JOB);
    expect(rappel, "le rappel d'échéance est enregistré (AD-14 : un seul ordonnanceur)").toBeDefined();
    expect(rappel!.cadence).toBe("quotidien");
    expect(rappel!.toleranceHeures % 24, "jamais pile sur un multiple : l'alerte se jouerait au hasard").not.toBe(0);
  });

  it("[LE CŒUR] Σ delaiMs n'a pas AUGMENTÉ en accueillant un troisième job", async () => {
    // La garde `[T3-3]` (`ordonnanceur-architecture.test.ts`) vérifie déjà `Σ + marge ≤ maxDuration`.
    // Celle-ci dit autre chose, et c'est le sens de la décision D5 : le troisième job n'a pas été
    // financé par la plateforme, il a été financé par le temps que le job de santé n'utilisait pas.
    // Mutation-cible : remonter la synthèse à 38 s « puisqu'il reste de la place ».
    const somme = REGISTRE.reduce((t, j) => t + j.delaiMs, 0);
    expect(somme, "le registre consomme exactement ce qu'il consommait à deux jobs").toBe(50_000);
  });

  it("le rappel a de quoi servir au moins une personne", async () => {
    const rappel = REGISTRE.find((j) => j.nom === NOM_JOB)!;
    expect(rappel.delaiMs).toBeGreaterThan(RESERVE_PERSONNE_MS);
    expect(LOT_PAR_TICK, "un lot borné : le fan-out est séquentiel dans huit secondes").toBeLessThanOrEqual(10);
  });

  it("[LE CŒUR] le budget du job COUVRE la plus longue opération qu'il contient", async () => {
    // ⚠️ IL NE LA COUVRAIT PAS. L'adaptateur Resend porte son propre `avecDelai` de 10 s, contre 8 s de
    // budget pour le job entier : le job se faisait tuer AVANT que l'envoi n'ait le droit d'expirer →
    // `job_echoue`, sonde publique en `degrade`, alors que le courriel était peut-être parti. Un budget
    // de job plus court que son opération la plus longue est un mensonge programmé.
    // Mutation-cible : remonter `DELAI_ENVOI_MS` au-dessus du `delaiMs` du job.
    const rappel = REGISTRE.find((j) => j.nom === NOM_JOB)!;
    expect(DELAI_ENVOI_MS, "l'envoi est borné SOUS le budget du job").toBeLessThan(rappel.delaiMs);
    expect(RESERVE_PERSONNE_MS, "et la réserve couvre l'envoi").toBeGreaterThan(DELAI_ENVOI_MS);
  });
});

describe("[NFR-015] ce que Resend, et l'écran verrouillé, ne voient PAS", () => {
  const origine = validerOrigine("https://anima.exemple.fr")!;
  const jeton = jetonValide(JETON_FACTICE)!;

  it("[LE CŒUR] le gabarit ne porte NI le « si », NI le « alors », NI le nom de la branche", async () => {
    // Mutation-cible : ajouter « — » puis le texte de l'intention « pour que ce soit plus utile ». C'est
    // exactement la phrase qu'on écrirait sans y penser, et c'est de l'art. 9 sur un écran verrouillé,
    // potentiellement devant quelqu'un d'autre. La SIGNATURE du port l'empêche déjà (il n'y a aucun
    // paramètre où la mettre) ; ce test verrouille le texte lui-même.
    const g = gabaritPour("echeance_intention", { origine, jeton })!;
    expect(g).not.toBeNull();
    const tout = `${g.objet}\n${g.texte}`;
    for (const mot of ["si ", "alors", "branche", "intention"]) {
      expect(tout.toLowerCase(), `« ${mot} » n'a rien à faire dans un courriel`).not.toContain(mot);
    }
  });

  it("il ne porte AUCUN chiffre (ni le nombre d'échéances, ni une date)", async () => {
    const g = gabaritPour("echeance_intention", { origine, jeton })!;
    expect(g.objet, "l'objet paraît sur un écran verrouillé").not.toMatch(/\d/);
  });

  it("il ne DÉCRÈTE pas : pas de « n'oublie pas », pas de point d'exclamation (charte §6)", async () => {
    // Un rappel d'échéance est l'endroit où l'on glisse vers l'injonction sans s'en apercevoir.
    // « que tu as fixée » n'est pas une politesse : c'est la différence entre rendre et exiger.
    const g = gabaritPour("echeance_intention", { origine, jeton })!;
    for (const decret of ["n'oublie pas", "pense à", "il faut", "tu dois", "!"]) {
      expect(g.texte.toLowerCase(), `« ${decret} »`).not.toContain(decret);
    }
    expect(g.texte, "elle l'a fixée elle-même, et le texte le dit").toContain("que tu as fixée");
  });

  it("il porte le désabonnement en UN CLIC, comme l'autre motif (RFC 8058)", async () => {
    const g = gabaritPour("echeance_intention", { origine, jeton })!;
    expect(g.lienUnClic).toBe(`${origine}/api/desabonnement?j=${jeton}`);
    expect(g.texte).toContain(`${origine}/desabonnement?j=${jeton}`);
  });

  it("un motif hors de l'ensemble fermé rend `null` (l'adaptateur refuse alors d'envoyer)", async () => {
    expect(gabaritPour("promo" as never, { origine, jeton })).toBeNull();
  });
});
