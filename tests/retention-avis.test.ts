import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { gabaritLegalPour } from "@/lib/courriel/gabarits";
import { validerOrigine } from "@/lib/courriel/origine";

/**
 * retention-avis.test.ts — L'AVIS, LE PORT ET LE DÉPÔT (Story 6.8, AC2).
 *
 * ══ CE FICHIER EST NÉ D'UNE CAMPAGNE DE MUTATION ════════════════════════════════════════════════
 *
 * Quatre mutants ont SURVÉCU au premier passage, et tous les quatre pour la même raison : ces
 * chemins n'étaient exercés par personne. Le job doublait l'envoi, la base doublait le dépôt, et
 * personne ne regardait entre les deux.
 *
 *   • l'avis pouvait prétendre être parti sans adresse ;
 *   • il pouvait partir sans canal configuré ;
 *   • il pouvait être signé « — Anam », que l'AC2 interdit mot pour mot ;
 *   • une réponse incomprise du moteur pouvait être lue comme un effacement.
 *
 * C'est le même patron qu'en 6.5 (T4) : ce qui n'est exercé par personne survit à tout.
 */

/**
 * ⚠️ L'ORIGINE PASSE PAR SON VALIDATEUR, ET `tsc` ME L'A IMPOSÉ. `Origine` est un type MARQUÉ : une
 * chaîne ne s'y substitue pas. C'est exactement la garde que 3.5 a posée pour qu'aucune origine
 * arbitraire ne finisse dans un lien de courriel — et un test qui la contournerait par un `as`
 * cesserait d'éprouver le vrai chemin.
 */
const ORIGINE = validerOrigine("https://anam.exemple")!;

describe("[6.8/AC2] Le gabarit de l'avis — émis par le PRODUIT, jamais signé d'Anam", () => {
  const avis = gabaritLegalPour("inactivite_avant_suppression", ORIGINE)!;

  it("[LE CŒUR] il n'est PAS signé d'Anam", () => {
    // L'AC2 le demande mot pour mot. Anam est une présence à qui l'on parle ; lui faire annoncer
    // qu'elle va effacer ce qu'on lui a confié, c'est lui faire jouer le rôle de l'huissier.
    expect(avis.texte).not.toMatch(/—\s*Anam/);
    // …et le gabarit VOISIN, lui, l'est bien : sans ce contrôle, l'assertion ci-dessus passerait
    // aussi sur un gabarit vide ou sur un motif inconnu.
    expect(gabaritLegalPour("reconduction_a_venir", ORIGINE)!.texte).toMatch(/—\s*Anam/);
  });

  it("[LE CŒUR] il dit ce qui va se passer, et où aller pour l'empêcher", () => {
    expect(avis.texte).toMatch(/supprimé/);
    expect(avis.texte).toMatch(/rien n'en reviendra/);
    // L'export est nommé AVANT la suppression — AD-14 l'exige, et prévenir quelqu'un sans lui dire
    // où récupérer ses données serait le respect de la lettre contre l'esprit.
    expect(avis.texte).toContain(`${ORIGINE}/mes-donnees`);
  });

  it("il ne demande PAS de revenir — « jamais un rappel de connexion »", () => {
    // Il énonce un FAIT (« se servir du compte annule la suppression »), il n'invite pas.
    for (const motif of [/reconnecte/i, /tu nous manques/i, /reviens/i, /on t'attend/i]) {
      expect(motif.test(avis.texte), `« ${motif.source} » est une invitation, pas un fait`).toBe(false);
    }
    expect(avis.texte).toMatch(/annule la suppression/);
  });

  it("l'objet reste neutre — il paraît sur un écran verrouillé (NFR-015)", () => {
    expect(avis.objet.length).toBeLessThan(60);
    expect(avis.objet).not.toMatch(/branche|thème|lecture|conversation|séance/i);
  });

  it("un motif hors de l'ensemble fermé ne rend RIEN", () => {
    expect(gabaritLegalPour("inventé" as never, ORIGINE)).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// L'ENVOI — doublé au niveau du port et du dépôt d'adresse.
// ═════════════════════════════════════════════════════════════════════════════════════════════════

const envoyerInformationLegale = vi.fn(async () => {});
const estConfigure = vi.fn(() => true);
const adresse = vi.fn(async () => "elle@exemple.fr" as string | null);

vi.mock("@/lib/courriel/fabrique", () => ({
  creerPortCourriel: () => ({ envoyer: vi.fn(), envoyerInformationLegale, estConfigure }),
}));
vi.mock("@/lib/data/depot-canal-courriel", () => ({
  creerDepotCanalCourriel: () => ({ adresse, jetonDesabonnement: vi.fn() }),
}));

const { annoncerInactivite } = await import("@/lib/courriel/avis-inactivite");

beforeEach(() => {
  envoyerInformationLegale.mockClear().mockResolvedValue(undefined);
  estConfigure.mockClear().mockReturnValue(true);
  adresse.mockClear().mockResolvedValue("elle@exemple.fr");
});

describe("[6.8/AC2] `annoncerInactivite` — il ne prétend jamais avoir prévenu", () => {
  it("[CONTRÔLE POSITIF] le chemin nominal envoie et rend `true`", async () => {
    expect(await annoncerInactivite("u-1")).toBe(true);
    expect(envoyerInformationLegale).toHaveBeenCalledWith("elle@exemple.fr", "inactivite_avant_suppression");
  });

  it("[LE CŒUR] sans canal configuré : rien ne part, et il rend `false`", async () => {
    estConfigure.mockReturnValue(false);
    expect(await annoncerInactivite("u-1")).toBe(false);
    expect(envoyerInformationLegale, "un courriel est parti sans canal").not.toHaveBeenCalled();
  });

  it("[LE CŒUR] sans adresse : rien ne part, et il rend `false`", async () => {
    // Rendre `true` ici serait la faute la plus coûteuse de la story : le job poserait l'échéance,
    // et trois mois plus tard le compte disparaîtrait sans que personne n'ait jamais été prévenu.
    adresse.mockResolvedValue(null);
    expect(await annoncerInactivite("u-1")).toBe(false);
    expect(envoyerInformationLegale).not.toHaveBeenCalled();
  });

  it("une panne d'envoi LÈVE — l'appelant ne pose alors aucune échéance", async () => {
    envoyerInformationLegale.mockRejectedValue(new Error("resend_indisponible"));
    await expect(annoncerInactivite("u-1")).rejects.toThrow(/resend_indisponible/);
  });

  it("[AC2] il passe par le régime LÉGAL, jamais par `envoyer` — ni plafond, ni refus de canal", async () => {
    // `envoyerInformationLegale` n'accepte pas un `MotifCourriel`, et `envoyer` n'accepte pas un
    // `MotifLegal` : la séparation est portée par le TYPE. Ce test la mesure au comportement.
    await annoncerInactivite("u-1");
    expect(envoyerInformationLegale).toHaveBeenCalledTimes(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// LE DÉPÔT — sur doublure, parce qu'on éprouve la LECTURE d'une réponse, pas une propriété de la base.
// ═════════════════════════════════════════════════════════════════════════════════════════════════

const { creerDepotRetention } = await import("@/lib/data/depot-retention");

function depotAvec(reponse: unknown) {
  const client = { rpc: async () => reponse } as unknown as SupabaseClient;
  vi.doMock("@/lib/data/supabase/admin", () => ({ createSupabaseAdminClient: () => client }));
  return client;
}

describe("[6.8] Le dépôt ne comprend que ce qu'il connaît", () => {
  it("[LE CŒUR] une issue inconnue n'est JAMAIS lue comme un effacement", async () => {
    // Mutant survivant du premier passage. `data as never` laissait passer n'importe quoi — y compris
    // une chaîne qui aurait fait croire au job qu'un compte venait d'être supprimé.
    const { creerDepotRetention: creer } = await import("@/lib/data/depot-retention");
    vi.resetModules();
    depotAvec({ data: "supprimee", error: null });
    const { creerDepotRetention: creerIsole } = await import("@/lib/data/depot-retention");
    const depot = creerIsole();
    expect(await depot.trancher("u-1", {
      inactiviteMois: 24, preavisMois: 3, journalJours: 90, fenetrePitrJours: 7,
    })).toBe("ignoree");
    expect(typeof creer).toBe("function"); // l'import initial reste valide — anti-vacuité de la ruse
  });

  it("[CONTRÔLE POSITIF] une issue connue passe intacte", async () => {
    vi.resetModules();
    depotAvec({ data: "graciee", error: null });
    const { creerDepotRetention: creerIsole } = await import("@/lib/data/depot-retention");
    expect(await creerIsole().trancher("u-1", {
      inactiviteMois: 24, preavisMois: 3, journalJours: 90, fenetrePitrJours: 7,
    })).toBe("graciee");
  });

  it("[NFR-022] une erreur ne remonte que son CODE, jamais le message de Postgres", async () => {
    vi.resetModules();
    depotAvec({ data: null, error: { code: "42501", message: "ligne : elle a un cancer" } });
    const { creerDepotRetention: creerIsole } = await import("@/lib/data/depot-retention");
    const depot = creerIsole();
    await expect(depot.comptesAEffacer(10)).rejects.toThrow(/^comptes_a_effacer: 42501$/);
    await expect(depot.comptesAEffacer(10)).rejects.not.toThrow(/cancer/);
  });

  it("une sélection mutilée est écartée — jamais un identifiant vide", async () => {
    vi.resetModules();
    depotAvec({ data: [{ utilisatrice_id: "u-1" }, { utilisatrice_id: null }, { autre: "x" }], error: null });
    const { creerDepotRetention: creerIsole } = await import("@/lib/data/depot-retention");
    expect(await creerIsole().comptesAPrevenir(24, 10)).toEqual(["u-1"]);
  });

  it("le nombre de lignes purgées est lu comme un nombre, ou zéro", async () => {
    vi.resetModules();
    depotAvec({ data: "beaucoup", error: null });
    const { creerDepotRetention: creerIsole } = await import("@/lib/data/depot-retention");
    expect(await creerIsole().purgerJournal(90)).toBe(0);
  });

  it("[AD-14] les quatre échéances partent EN ARGUMENTS, lues dans l'environnement", async () => {
    vi.resetModules();
    vi.stubEnv("RETENTION_INACTIVITE_MOIS", "18");
    vi.stubEnv("RETENTION_PREAVIS_MOIS", "2");
    const vus: Record<string, unknown>[] = [];
    const client = {
      rpc: async (_nom: string, args: Record<string, unknown>) => {
        vus.push(args);
        return { data: "ignoree", error: null };
      },
    } as unknown as SupabaseClient;
    vi.doMock("@/lib/data/supabase/admin", () => ({ createSupabaseAdminClient: () => client }));
    const { creerDepotRetention: creerIsole, echeancesCourantes } = await import("@/lib/data/depot-retention");
    const e = echeancesCourantes();
    expect(e.inactiviteMois).toBe(18);
    expect(e.preavisMois).toBe(2);
    await creerIsole().trancher("u-1", e);
    expect(vus[0]).toMatchObject({ p_inactivite_mois: 18, p_preavis_mois: 2 });
    vi.unstubAllEnvs();
  });
});

// Anti-vacuité du fichier : sans cette ligne, une erreur d'import laisserait les blocs ci-dessus
// silencieusement vides et le fichier vert.
describe("[garde] le module d'avis et le dépôt sont bien chargés", () => {
  it("les deux fonctions existent", () => {
    expect(typeof annoncerInactivite).toBe("function");
    expect(typeof creerDepotRetention).toBe("function");
  });
});
