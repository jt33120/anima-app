import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { doitCouperConversation } from "@/lib/domain/allocation-residuelle";
import { tramesQuandLaReponseManque } from "@/lib/safety/filet-sans-reponse";
import { sansCommentaires } from "./_absence";

/**
 * le-filet-ne-tombe-jamais.test.ts — R8 et R12 (revue adversariale du 2026-08-18)
 *
 * ══ DEUX TROUVAILLES, UN SEUL TORT ════════════════════════════════════════════════════════════
 *
 * Le bloc de ressources — le 3114 et les numéros — est DÉCIDÉ tôt dans le tour, à partir d'une
 * classification qui a bien eu lieu. Deux chemins de sortie le jetaient ensuite à la poubelle :
 *
 *   R8 — le gate d'allocation ne lit que `limitesLevees`, jamais le niveau EFFECTIF. Au tour qui
 *        ÉTEINT l'épisode, `limites_levees` est déjà retombé à faux tandis que le verdict vaut
 *        encore 3 (le plancher de la 0067, lu avant l'enregistrement). Le gate entre, la
 *        conversation est coupée, le composeur se ferme — et le flux ne porte QUE `{t:"quota"}` :
 *        sur le tour même que le serveur classe « urgence », Anam disparaît et le 3114 quitte
 *        l'écran.
 *
 *   R12 — sur `egress.bloque`, la route rendait un JSON 403 nu. Le client fait
 *         `if (!reponse.ok) throw` : la réponse devient « une erreur est survenue », et les
 *         ressources n'atteignent jamais l'écran. Le `catch` JUMEAU, six lignes plus haut, fait
 *         exactement l'inverse — avec un commentaire qui décrit ce tort mot pour mot.
 *
 * ══ CE QUI EST RÉPARÉ, ET À QUELLE PROFONDEUR ═════════════════════════════════════════════════
 *
 * R8 dans le DOMAINE : `doitCouperConversation` reçoit le niveau effectif et court-circuite dessus.
 * Une garde posée dans la route se serait oubliée au prochain appelant — c'est la leçon R1.
 *
 * R12 par une FONCTION NOMMÉE que les deux branches appellent. Le défaut n'était pas qu'on ait
 * oublié une ligne : c'est qu'il existait deux endroits où écrire « ce qu'on rend quand la réponse
 * ne vient pas ». Il n'y en a plus qu'un.
 */

describe("[R8] la détresse lève la limite — le NIVEAU compte, pas seulement l'épisode", () => {
  const base = {
    premium: false,
    limitesLevees: false,
    seanceClose: true,
    toursConsommes: 999,
    limite: 10,
    niveauSecurite: 0,
  };

  it("[CONTRÔLE POSITIF] hors détresse, allocation dépassée : on coupe bien", () => {
    // Sans ce contrôle, une fonction qui ne couperait JAMAIS passerait tout le reste du bloc.
    expect(doitCouperConversation(base)).toBe(true);
  });

  it("[LE CŒUR] au tour qui ÉTEINT l'épisode : `limitesLevees` est faux, le niveau vaut 3", () => {
    // ⚠️ C'EST L'ÉTAT EXACT DÉCRIT PAR R8, et il n'a rien d'exotique : c'est le tour NORMAL de
    // sortie d'épisode. La RPC éteint l'épisode et rend `false`, tandis que le verdict du tour a
    // été calculé AVANT, avec le plancher. Couper ici ferait disparaître le 3114 de l'écran au
    // moment précis où le serveur classe encore le tour « urgence ».
    expect(doitCouperConversation({ ...base, niveauSecurite: 3 })).toBe(false);
  });

  it("le niveau 1 suffit — on ne coupe pas quelqu'un que le tour vient de signaler", () => {
    expect(doitCouperConversation({ ...base, niveauSecurite: 1 })).toBe(false);
  });

  it("l'épisode ouvert lève toujours la limite, même à niveau 0 (l'autre moitié, inchangée)", () => {
    expect(doitCouperConversation({ ...base, limitesLevees: true })).toBe(false);
  });

  it("premium et 1ʳᵉ séance passent avant tout, comme avant", () => {
    expect(doitCouperConversation({ ...base, premium: true })).toBe(false);
    expect(doitCouperConversation({ ...base, seanceClose: false })).toBe(false);
    expect(doitCouperConversation({ ...base, limite: null })).toBe(false);
  });
});

describe("[R12] quand la réponse ne vient pas, le filet part quand même", () => {
  const filet = {
    t: "ressources" as const,
    position: "avant" as const,
    verifieLe: "2026-08-01",
    ressources: [{ numero: "3114", tel: "tel:3114", aria: "3114", service: "3114", desc: "24 h/24" }],
  };

  it("[LE CŒUR] le bloc décidé est ÉMIS, et il précède l'erreur", () => {
    const trames = tramesQuandLaReponseManque(filet);
    expect(trames[0], "le filet doit partir en premier — l'écran le rend dans l'ordre").toBe(filet);
    expect(trames[trames.length - 1]).toEqual({ t: "erreur" });
  });

  it("la trame `erreur` reste — c'est elle qui allume « Réessayer »", () => {
    // Sans elle, l'écran resterait suspendu : le client ne considère le tour fini que sur `fin`
    // ou `erreur`. Un filet sans issue serait un second mur.
    expect(tramesQuandLaReponseManque(null)).toEqual([{ t: "erreur" }]);
  });

  it("aucun filet décidé (tour ordinaire) : on ne fabrique pas de ressources", () => {
    // Afficher le 3114 à quelqu'un qui parle de son déménagement serait l'inverse du soin.
    expect(tramesQuandLaReponseManque(null)).toHaveLength(1);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LE CÂBLAGE — ce que les deux blocs ci-dessus ne peuvent pas voir
// ══════════════════════════════════════════════════════════════════════════════════════════════

const route = sansCommentaires(readFileSync("app/api/anam/message/route.ts", "utf-8"));

describe("[R8/R12] la route branche bien les deux dérivations", () => {
  it("[R8] le gate passe le niveau effectif à la dérivation, jamais seulement `limitesLevees`", () => {
    const appel = route.slice(route.indexOf("doitCouperConversation({"), route.indexOf("doitCouperConversation({") + 300);
    expect(appel, "`doitCouperConversation` doit recevoir le niveau effectif").toMatch(/niveauSecurite,/);
  });

  it("[R8] et le gate lui-même n'est plus entré en détresse", () => {
    // La double garde est volontaire : le domaine décide, et la route ne dépense même pas la
    // lecture premium ni le comptage sur un tour de détresse.
    expect(route).toMatch(/if \(horsDetresse && seanceClose\)/);
  });

  it("[R12] AUCUN corps JSON ne survit après la décision du filet", () => {
    // ⚠️ GÉNÉRAL, PAS PAR BRANCHE. Énumérer les deux sorties connues laisserait passer la
    // troisième écrite demain — c'est exactement ce qui s'est produit ici : le `catch` avait été
    // corrigé, sa branche jumelle six lignes plus bas ne l'avait pas été.
    const decision = route.indexOf("const trameRessources");
    expect(decision, "la décision du filet doit exister").toBeGreaterThan(-1);
    const apres = route.slice(decision);
    expect(apres, "un corps JSON après la décision jette le filet").not.toMatch(/NextResponse\.json/);
  });

  it("[R12] les deux branches passent par LA MÊME fonction", () => {
    // Le défaut n'était pas une ligne oubliée : c'était deux endroits où écrire la même règle.
    expect((route.match(/tramesQuandLaReponseManque\(/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
