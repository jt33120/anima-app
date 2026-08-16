import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Story 4.5 (T4), arbitrée par la 4.10 — LE POINT D'ARTICULATION UNIQUE de l'ouverture d'une branche.
 * Les dépôts sont MOCKÉS : on prouve la COMPOSITION (lecture → seuil → réservation → union discriminée),
 * les deux pièges silencieux, et le REPLI SÛR. Le comportement base réel vit dans `intention-sql.test.ts`.
 */

const chargerProposition = vi.fn();
const ecarter = vi.fn();
vi.mock("@/lib/data/depot-reconceptualisation", () => ({
  creerDepotSignalReconcept: vi.fn(() => ({ chargerProposition, ecarter })),
}));

const faits = vi.fn();
const reserverParole = vi.fn();
const annonceSocleDue = vi.fn();
vi.mock("@/lib/data/depot-arbitrage", () => ({
  creerDepotArbitrage: vi.fn(() => ({ faits, reserverParole, annonceSocleDue })),
}));

/** Story 6.4 — la mesure de rythme, mockée comme les dépôts ci-dessus. Par défaut : rythme CALME. */
const mesurerRythmeDepot = vi.fn();
const reserverPause = vi.fn();
vi.mock("@/lib/data/depot-rythme", () => ({
  creerDepotRythme: vi.fn(() => ({ mesurer: mesurerRythmeDepot, reserver: reserverPause })),
}));

/** Story 5.5 — la lecture du germe d'hypothèse, mockée comme les deux dépôts ci-dessus. */
const lireHypothese = vi.fn();
vi.mock("@/lib/data/lire-enneagramme", () => ({
  lireHypotheseEnneagramme: (...a: unknown[]) => lireHypothese(...a),
}));

import { chargerOuverture } from "@/lib/safety/ouverture-branche";
import { SEUIL_BRANCHES_OUVERTES, PHRASE_INVITATION } from "@/lib/domain/arbitrage-ouverture";
import { PHRASE_OUVERTURE_HYPOTHESE } from "@/lib/domain/enneagramme-hypothese";
import { PHRASE_PAUSE } from "@/lib/domain/rythme-pause";

/**
 * Story 3.3 — le client factice répond désormais à `est_premium_courante` : depuis D2-A, l'ouverture
 * commence par le gate premium. Par défaut PREMIUM, pour que tout ce fichier continue d'éprouver
 * l'arbitrage de la 4.10 et rien d'autre ; le comportement du compte GRATUIT a son propre bloc en bas.
 */
const client = (premium: boolean) =>
  ({ rpc: async () => ({ data: premium, error: null }) }) as unknown as SupabaseClient;
const supa = client(true);
const MAINTENANT = new Date("2026-03-15T10:00:00+01:00");
const UID = "11111111-1111-1111-1111-111111111111";
const SIGNAL_HIER = { signalId: "sig-7", signalCreeLe: new Date("2026-03-14T22:00:00+01:00") };

/** En dessous du seuil : Anam propose comme en 4.5. */
const PEU_DE_BRANCHES = { branchesEnNaissance: SEUIL_BRANCHES_OUVERTES - 1, brancheCibleId: "b-1" };
/** Au-dessus : l'arbitrage se déclenche. */
const TROP_DE_BRANCHES = { branchesEnNaissance: SEUIL_BRANCHES_OUVERTES, brancheCibleId: "b-vieille" };

beforeEach(() => {
  chargerProposition.mockReset();
  ecarter.mockReset();
  faits.mockReset();
  reserverParole.mockReset();
  annonceSocleDue.mockReset();
  annonceSocleDue.mockResolvedValue(false);
  lireHypothese.mockReset();
  // Par défaut : aucune hypothèse — tout ce fichier continue d'éprouver l'arbitrage 4.10 et rien
  // d'autre. Le comportement de l'hypothèse a son propre bloc en bas.
  lireHypothese.mockResolvedValue({ statut: "indisponible", raison: "aucune" });
  mesurerRythmeDepot.mockReset();
  reserverPause.mockReset();
  // Par défaut : rythme CALME. Tout ce fichier continue donc d'éprouver l'arbitrage 4.10 sans que la
  // pause n'entre jamais en scène — elle a son propre bloc en bas.
  mesurerRythmeDepot.mockResolvedValue({ seances: 1, minutes: 3 });
  reserverPause.mockResolvedValue(false);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
// Story 6.4 (D4) — LE GESTE DE PAUSE PASSE AVANT TOUT LE RESTE
// ═══════════════════════════════════════════════════════════════════════════════════════════════════

describe("[6.4/D4] la pause préempte, et elle préempte SANS RIEN DÉPENSER", () => {
  const RYTHME_INTENSE = { seances: 9, minutes: 140 };

  it("[LE CŒUR] seuil franchi + parole réservée ⇒ `pause`, et RIEN D'AUTRE N'A ÉTÉ LU", async () => {
    // ⚠️ C'EST LE TEST QUI JUSTIFIE LA POSITION DU BLOC, et il ne suffit pas de vérifier le type
    // rendu. La mention de complétion du socle et l'hypothèse d'ennéagramme se CONSOMMENT : placée
    // en dernier, la pause les préempterait APRÈS coup, et l'une des deux serait perdue pour
    // toujours. C'est le défaut trouvé en revue 4.10 — une écriture irréversible déclenchée par un
    // rendu — et la seule protection est que rien d'autre ne soit même interrogé.
    mesurerRythmeDepot.mockResolvedValue(RYTHME_INTENSE);
    reserverPause.mockResolvedValue(true);
    annonceSocleDue.mockResolvedValue(true);
    lireHypothese.mockResolvedValue({ statut: "a_annoncer", hypotheseId: "h-1" });
    chargerProposition.mockResolvedValue(SIGNAL_HIER);

    expect(await chargerOuverture(supa, UID, MAINTENANT)).toEqual({
      type: "pause",
      phrase: PHRASE_PAUSE,
    });

    expect(annonceSocleDue, "la mention du socle a été interrogée, donc risquée").not.toHaveBeenCalled();
    expect(lireHypothese, "le germe d'hypothèse a été lu").not.toHaveBeenCalled();
    expect(chargerProposition, "le signal a été lu").not.toHaveBeenCalled();
  });

  it("[LE CŒUR] rythme calme ⇒ la parole n'est même pas DEMANDÉE", async () => {
    // ⚠️ Mutation-cible : réserver d'abord et n'éprouver le seuil qu'ensuite. La réservation ÉCRIT :
    // le produit inscrirait une ligne de revue produit — donc un « franchissement » — pour quelqu'un
    // qui vient trois fois par semaine, et se tairait ensuite pendant un mois. La contre-métrique
    // mesurerait alors exactement le contraire de ce qu'elle prétend mesurer.
    chargerProposition.mockResolvedValue(null);
    await chargerOuverture(supa, UID, MAINTENANT);
    expect(reserverPause, "on a réservé sur un rythme calme").not.toHaveBeenCalled();
  });

  it("parole REFUSÉE (fenêtre d'apaisement, ou détresse) ⇒ le reste se déroule normalement", async () => {
    // La pause qui se tait ne doit rien empêcher : elle s'efface, elle ne bloque pas.
    mesurerRythmeDepot.mockResolvedValue(RYTHME_INTENSE);
    reserverPause.mockResolvedValue(false);
    annonceSocleDue.mockResolvedValue(true);

    expect(await chargerOuverture(supa, UID, MAINTENANT)).toMatchObject({ type: "socle-complete" });
  });

  it("[REPLI SÛR] une panne de la mesure ne fait taire AUCUNE autre ouverture", async () => {
    // ⚠️ Sans son propre `try`, une lecture cassée d'`entree_journal` ferait tomber tout
    // `chargerOuverture` dans le `catch` global — et une contre-métrique en panne rendrait alors
    // muettes la proposition de branche, la mention du socle et l'hypothèse. Le bonus le moins
    // important du produit ne doit pas pouvoir éteindre les autres.
    mesurerRythmeDepot.mockRejectedValue(new Error("entree_journal indisponible"));
    annonceSocleDue.mockResolvedValue(true);

    expect(await chargerOuverture(supa, UID, MAINTENANT)).toMatchObject({ type: "socle-complete" });
  });
});

describe("aucun moment mûr → rien du tout", () => {
  it("null, et l'arbitrage n'est même pas interrogé", async () => {
    chargerProposition.mockResolvedValue(null);
    expect(await chargerOuverture(supa, UID, MAINTENANT)).toBeNull();
    expect(faits, "pas de moment, pas d'arbitrage : rien à arbitrer").not.toHaveBeenCalled();
  });
});

describe("peu de branches ouvertes → Anam PROPOSE (comportement 4.5 inchangé)", () => {
  it("rend une `proposition` avec la voix déterministe (« hier »)", async () => {
    chargerProposition.mockResolvedValue(SIGNAL_HIER);
    faits.mockResolvedValue(PEU_DE_BRANCHES);
    const r = await chargerOuverture(supa, UID, MAINTENANT);
    expect(r).toEqual({
      type: "proposition",
      signalId: "sig-7",
      phrase: expect.stringContaining("hier"),
    });
    expect(r!.phrase).toContain("Tu veux en faire une branche ?");
    expect(r!.phrase).not.toContain("hier soir");
  });

  it("aucune parole n'est réservée quand Anam propose (la fenêtre de silence reste intacte)", async () => {
    // Mutation-cible : appeler `reserverParole` avant le `if`. La fenêtre d'invitation serait alors
    // consommée par des tours où Anam n'a rien invité — et le jour où le seuil serait franchi, elle se
    // tairait pour une raison invisible.
    chargerProposition.mockResolvedValue(SIGNAL_HIER);
    faits.mockResolvedValue(PEU_DE_BRANCHES);
    await chargerOuverture(supa, UID, MAINTENANT);
    expect(reserverParole).not.toHaveBeenCalled();
  });
});

describe("[AC4/AC5 DUR] trop de branches ouvertes → Anam INVITE", () => {
  it("[LE CŒUR] rend une `invitation`, pas une proposition", async () => {
    // Mutation-cible : passer `tropDeBranchesOuvertes(...)` en `false`. FR-030 disparaîtrait entièrement
    // sans qu'aucun autre test ne rougisse — la proposition marcherait toujours.
    chargerProposition.mockResolvedValue(SIGNAL_HIER);
    faits.mockResolvedValue(TROP_DE_BRANCHES);
    reserverParole.mockResolvedValue(true);
    expect(await chargerOuverture(supa, UID, MAINTENANT)).toEqual({
      type: "invitation",
      phrase: PHRASE_INVITATION,
      brancheCibleId: "b-vieille",
    });
  });

  it("[LE CŒUR / AC5] AUCUN nombre ne traverse la frontière", async () => {
    // C'est ce qui rend FR-031 vrai par CONSTRUCTION : le rendu ne peut pas afficher « 3 branches en
    // cours » parce qu'il n'a jamais reçu de 3. Mutation-cible : ajouter `branchesEnNaissance` à l'objet
    // rendu — ce test rougit, et il est le seul.
    chargerProposition.mockResolvedValue(SIGNAL_HIER);
    faits.mockResolvedValue({ branchesEnNaissance: 7, brancheCibleId: "b-vieille" });
    reserverParole.mockResolvedValue(true);
    const r = await chargerOuverture(supa, UID, MAINTENANT);
    for (const v of Object.values(r as Record<string, unknown>)) {
      expect(typeof v, `un champ numérique a fui : ${JSON.stringify(r)}`).not.toBe("number");
    }
    expect(JSON.stringify(r), "et le compte n'apparaît nulle part, pas même dans la phrase").not.toContain("7");
  });

  it("[PIÈGE 1] le signal n'est PAS consommé — ce moment-là ne disparaît pas", async () => {
    // Écarter le germe parce qu'Anam a préféré inviter, ce serait perdre DÉFINITIVEMENT une prise de
    // conscience réelle, sans trace et sans recours. Il reste en attente et reviendra quand une branche
    // aura bougé. Mutation-cible : appeler `ecarter` sur le chemin de l'invitation.
    chargerProposition.mockResolvedValue(SIGNAL_HIER);
    faits.mockResolvedValue(TROP_DE_BRANCHES);
    reserverParole.mockResolvedValue(true);
    await chargerOuverture(supa, UID, MAINTENANT);
    expect(ecarter).not.toHaveBeenCalled();
  });

  it("[PIÈGE 2] parole refusée → SILENCE : ni invitation, ni proposition de repli", async () => {
    // ⚠️ Le repli tentant est « si Anam ne peut pas inviter, qu'elle propose donc ». Il est FAUX : le
    // seuil est franchi, c'est justement la situation où elle ne doit pas proposer. Et l'autre repli —
    // redire l'invitation — est la violation de FR-034 que la réservation existe pour empêcher.
    // Mutation-cible : renvoyer la proposition quand `reserverParole` rend false.
    chargerProposition.mockResolvedValue(SIGNAL_HIER);
    faits.mockResolvedValue(TROP_DE_BRANCHES);
    reserverParole.mockResolvedValue(false);
    expect(await chargerOuverture(supa, UID, MAINTENANT)).toBeNull();
  });

  it("seuil franchi mais AUCUNE branche cible → Anam propose (on n'invite pas vers le vide)", async () => {
    // Cas impossible en pratique (un compte ≥ seuil a forcément une branche en naissance), mais une
    // lecture partielle peut le produire. Une invitation sans cible serait un bouton qui ne mène nulle
    // part. Mutation-cible : retirer `&& faits.brancheCibleId`.
    chargerProposition.mockResolvedValue(SIGNAL_HIER);
    faits.mockResolvedValue({ branchesEnNaissance: 9, brancheCibleId: null });
    const r = await chargerOuverture(supa, UID, MAINTENANT);
    expect(r?.type).toBe("proposition");
    expect(reserverParole).not.toHaveBeenCalled();
  });
});

describe("repli sûr (AD-15) : l'ouverture ne bloque JAMAIS l'entrée dans la scène", () => {
  it("une donnée corrompue → null + incident journalisé, jamais un 500", async () => {
    chargerProposition.mockResolvedValue({ signalId: "x", signalCreeLe: new Date("invalide") });
    faits.mockResolvedValue(PEU_DE_BRANCHES);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await chargerOuverture(supa, UID, MAINTENANT)).toBeNull();
    expect(spy, "l'incident est journalisé (repli AD-15)").toHaveBeenCalled();
    spy.mockRestore();
  });

  it("[LE CŒUR] une panne de l'ARBITRAGE fait RETOMBER sur la proposition 4.5, elle ne fait pas taire", async () => {
    // ⚠️ RÉGRESSION TROUVÉE PAR LA REVUE. La 4.10 ajoute deux allers-retours sur un chemin qui n'en avait
    // aucun ; sous le `catch` global, une panne de l'un ou l'autre rendait `null` — donc Anam se taisait
    // AUSSI pour la proposition ordinaire, qui n'avait besoin de rien de tout ça. Une fonctionnalité qui
    // marchait depuis trois stories tombait à cause d'une lecture ajoutée pour une AUTRE.
    // La version précédente de ce test assérait `null` et se déclarait satisfaite.
    // Mutation-cible : remettre l'arbitrage sous le `catch` global.
    chargerProposition.mockResolvedValue(SIGNAL_HIER);
    faits.mockRejectedValue(new Error("42501"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await chargerOuverture(supa, UID, MAINTENANT);
    expect(r?.type, "la 4.5 survit à une panne de la 4.10").toBe("proposition");
    expect(spy, "et l'incident est quand même journalisé").toHaveBeenCalled();
    spy.mockRestore();
  });

  it("une panne de la RÉSERVATION retombe aussi sur la proposition", async () => {
    chargerProposition.mockResolvedValue(SIGNAL_HIER);
    faits.mockResolvedValue(TROP_DE_BRANCHES);
    reserverParole.mockRejectedValue(new Error("40001"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await chargerOuverture(supa, UID, MAINTENANT))?.type).toBe("proposition");
    spy.mockRestore();
  });

  it("[3.3] une panne du GATE PREMIUM fait TAIRE — l'autre sens du doute, et il est voulu", async () => {
    // Deux doutes opposés cohabitent dans ce fichier : une panne de l'ARBITRAGE fait PROPOSER (test
    // ci-dessus), une panne du GATE PREMIUM fait SE TAIRE. Se taire à tort coûte une question différée
    // (le germe reste en attente) ; parler à tort ferait écrire à quelqu'un le nom d'une prise de
    // conscience que la policy 0037 refuserait ensuite. Les deux coûts diffèrent, les deux replis aussi.
    // Mutation-cible : passer le repli de `premiumSousJwt` à `true`.
    chargerProposition.mockResolvedValue(SIGNAL_HIER);
    faits.mockResolvedValue(PEU_DE_BRANCHES);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const enPanne = { rpc: async () => ({ data: null, error: { code: "42501" } }) } as unknown as SupabaseClient;
    expect(await chargerOuverture(enPanne, UID, MAINTENANT)).toBeNull();
    expect(spy, "et l'incident est journalisé (AD-15)").toHaveBeenCalled();
    spy.mockRestore();
  });

  it("mais une parole REFUSÉE (pas en panne) reste un SILENCE", async () => {
    // La distinction est tout le sujet : un refus est une décision (« Anam a déjà dit ça »), une panne
    // est une ignorance. On ne retombe sur la proposition que dans le second cas — retomber sur le
    // premier redirait exactement ce que la fenêtre de silence existe pour empêcher.
    chargerProposition.mockResolvedValue(SIGNAL_HIER);
    faits.mockResolvedValue(TROP_DE_BRANCHES);
    reserverParole.mockResolvedValue(false);
    expect(await chargerOuverture(supa, UID, MAINTENANT)).toBeNull();
  });
});

/**
 * Story 3.3 (T3, décision D2-A) — SUR UN COMPTE GRATUIT, ANAM NE PROPOSE PAS.
 *
 * Depuis 0037, la naissance d'une branche est gardée dans le `WITH CHECK`. Proposer quand même
 * ferait écrire le nom d'une prise de conscience — un contenu art. 9 composé à l'instant — pour
 * un refus. C'est la faute « mentir par omission » des revues 4.7 et 4.10, à l'endroit où elle
 * coûte le plus cher.
 */
describe("[3.3 / D2-A] le gate premium de l'ouverture", () => {
  it("[LE CŒUR] compte GRATUIT → silence, et le germe n'est même pas lu", async () => {
    // Mutation-cible : retirer le `if (!(await premiumSousJwt(...))) return null`. Tout redeviendrait
    // vert ailleurs — c'est le seul test qui tombe.
    // La seconde assertion n'est pas décorative : elle prouve que le gate passe AVANT la lecture du
    // signal. Un compte gratuit ne déclenche donc AUCUNE lecture d'un pointeur vers de l'art. 9.
    chargerProposition.mockResolvedValue(SIGNAL_HIER);
    faits.mockResolvedValue(PEU_DE_BRANCHES);
    expect(await chargerOuverture(client(false), UID, MAINTENANT)).toBeNull();
    expect(chargerProposition, "gratuit : on ne lit même pas le germe (minimisation)").not.toHaveBeenCalled();
    expect(faits, "…ni les faits d'arbitrage").not.toHaveBeenCalled();
  });

  it("[CONTRÔLE POSITIF] compte PREMIUM → la proposition 4.5 est intacte", async () => {
    // Sans ce contrôle, un gate qui refuserait TOUT LE MONDE satisferait le test ci-dessus.
    chargerProposition.mockResolvedValue(SIGNAL_HIER);
    faits.mockResolvedValue(PEU_DE_BRANCHES);
    expect((await chargerOuverture(client(true), UID, MAINTENANT))?.type).toBe("proposition");
  });
});

describe("[3.3 / FR-059] on ferme la PROPOSITION, jamais le SIGNAL", () => {
  const pipeline = resolve(process.cwd(), "lib/safety/reconceptualisation-pipeline.ts");
  const src = readFileSync(pipeline, "utf-8");

  it("[NON-VACUITÉ] le fichier examiné est bien le pipeline de détection", () => {
    // ⚠️ LA CONDITION DE VALIDITÉ de l'assertion d'absence qui suit : chercher un mot absent dans un
    // fichier vide (ou dans le mauvais fichier) réussit TOUJOURS. On prouve d'abord qu'on regarde au
    // bon endroit, par deux symboles qu'on sait y être.
    expect(src).toMatch(/export async function evaluerReconceptualisationDuTour/);
    expect(src, "c'est ICI que le germe est persisté").toMatch(/depotSignal\.enregistrer/);
  });

  it("[LE CŒUR] la détection et la persistance du germe IGNORENT totalement l'entitlement", () => {
    // C'est la garantie réelle de FR-059, et elle vaut bien au-delà de la première séance : un compte
    // gratuit continue d'accumuler ses moments mûrs. Le jour où elle s'abonne, ils sont là — intacts,
    // datés, aucun perdu. Un gate posé ICI les aurait effacés en silence, un par un, sans qu'elle sache
    // qu'ils ont existé. C'est le seul endroit de cette story où l'on pouvait détruire quelque chose.
    // Mutation-cible : ajouter un `if (!premium) return` dans `evaluerReconceptualisationDuTour`.
    for (const interdit of [/est_premium_courante/, /premiumSousJwt/, /\babonnement\b/, /\bpremium\b/i]) {
      expect(src, `l'entitlement s'est invité dans le pipeline de détection : ${interdit}`).not.toMatch(interdit);
    }
  });
});

/**
 * Story 5.5 (AC2) — L'HYPOTHÈSE D'ENNÉAGRAMME DANS L'OUVERTURE.
 *
 * Trois propriétés de POSITION, et elles ne se déduisent d'aucune autre : sous le gate premium elle
 * couperait un item du socle gratuit à vie (FR-055) ; devant la mention de complétion elle
 * empêcherait une phrase qui n'a qu'une seule chance d'être dite ; sans son propre `try` elle
 * ferait taire la proposition de la 4.5 — la faute exacte trouvée en revue 4.10.
 */
describe("[5.5/AC2] l'hypothèse d'Anam dans l'ouverture", () => {
  const GERME = { statut: "calcule", hypothese: { id: "h-42", type: 4, aDire: true } };

  it("un germe À DIRE rend la 4ᵉ variante — une phrase constante et un identifiant", async () => {
    lireHypothese.mockResolvedValue(GERME);
    const o = await chargerOuverture(supa, UID, MAINTENANT);
    expect(o).toEqual({
      type: "hypothese-enneagramme",
      phrase: PHRASE_OUVERTURE_HYPOTHESE,
      hypotheseId: "h-42",
    });
    // ⚠️ Le NUMÉRO ne franchit pas la frontière : la phrase du fil ne le nomme pas, et la halte le
    // lit en base. Le poser ici ferait une seconde source du même fait (R1-bis).
    expect(JSON.stringify(o)).not.toContain('"type":4');
  });

  it("[LE CŒUR] un compte GRATUIT l'entend — l'ennéagramme est du socle libre (FR-055)", async () => {
    // Mutation-cible : déplacer le bloc sous `premiumSousJwt`. Rien d'autre ne rougirait.
    lireHypothese.mockResolvedValue(GERME);
    expect((await chargerOuverture(client(false), UID, MAINTENANT))?.type).toBe("hypothese-enneagramme");
  });

  it("elle est demandée en « seulement à dire » — une hypothèse dite ne se redit pas", async () => {
    lireHypothese.mockResolvedValue(GERME);
    await chargerOuverture(supa, UID, MAINTENANT);
    expect(lireHypothese).toHaveBeenCalledWith(supa, UID, { seulementADire: true });
  });

  it("[ORDRE] la mention de complétion passe DEVANT — elle n'a qu'une seule chance", async () => {
    // Les deux sont dues en même temps. Si l'hypothèse passait devant, la mention serait perdue :
    // elle s'auto-éteint, alors que le germe reste `en_attente` et repart au chargement suivant.
    annonceSocleDue.mockResolvedValue(true);
    lireHypothese.mockResolvedValue(GERME);
    expect((await chargerOuverture(supa, UID, MAINTENANT))?.type).toBe("socle-complete");
  });

  it("[REPLI 4.10] une panne de CETTE lecture ne fait pas taire la proposition de la 4.5", async () => {
    // Mutation-cible : retirer le `try` local. Sous le `catch` global, une panne ajoutée par la 5.5
    // ferait rendre `null` — et une fonctionnalité qui marchait depuis cinq stories tomberait à
    // cause d'une lecture ajoutée pour une autre.
    lireHypothese.mockRejectedValue(new Error("panne"));
    chargerProposition.mockResolvedValue(SIGNAL_HIER);
    faits.mockResolvedValue(PEU_DE_BRANCHES);
    expect((await chargerOuverture(supa, UID, MAINTENANT))?.type).toBe("proposition");
  });

  it("aucune hypothèse → l'ouverture continue son chemin normal", async () => {
    lireHypothese.mockResolvedValue({ statut: "indisponible", raison: "aucune" });
    chargerProposition.mockResolvedValue(SIGNAL_HIER);
    faits.mockResolvedValue(PEU_DE_BRANCHES);
    expect((await chargerOuverture(supa, UID, MAINTENANT))?.type).toBe("proposition");
  });
});
