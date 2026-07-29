import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  extraireLignes,
  analyserTrame,
  detacherMotsComplets,
  type TrameRecue,
} from "@/render/conversation/flux-ndjson-client";
import { insererTour } from "@/render/conversation/fil-ops";
import type { Tour } from "@/render/conversation/types";
import { ligneNdjson } from "@/lib/ai/flux-ndjson";

/**
 * Story 2.2 (B4) — le CŒUR PUR du client de streaming, testé sans DOM ni réseau (env node).
 * Trois responsabilités séparées et pures : découper le flux NDJSON en lignes (en gardant la
 * ligne partielle à cheval sur deux chunks), analyser une ligne en trame typée, révéler le
 * texte d'Anam PAR GROUPES DE MOTS (jamais caractère par caractère — NFR-014, AC3).
 */

describe("extraireLignes — découpe NDJSON tolérante aux chunks partiels (AC3)", () => {
  it("sépare des lignes complètes et rend le reste vide quand tout finit par \\n", () => {
    const { lignes, reste } = extraireLignes('{"t":"delta","c":"a"}\n{"t":"fin"}\n');
    expect(lignes).toEqual(['{"t":"delta","c":"a"}', '{"t":"fin"}']);
    expect(reste).toBe("");
  });

  it("garde la dernière ligne PARTIELLE (chunk coupé au milieu d'un objet JSON)", () => {
    const { lignes, reste } = extraireLignes('{"t":"delta","c":"bonjour"}\n{"t":"del');
    expect(lignes).toEqual(['{"t":"delta","c":"bonjour"}']);
    expect(reste).toBe('{"t":"del'); // à recoller au chunk suivant
  });

  it("ignore les lignes vides (double \\n) sans les émettre comme trames", () => {
    const { lignes } = extraireLignes('{"t":"fin"}\n\n');
    expect(lignes).toEqual(['{"t":"fin"}']);
  });
});

describe("analyserTrame — ligne JSON → trame typée (AC3)", () => {
  it("reconnaît un delta et en extrait le contenu", () => {
    expect(analyserTrame('{"t":"delta","c":"salut"}')).toEqual({ t: "delta", c: "salut" });
  });

  it("reconnaît la fin propre et l'erreur terminale (contrat delta* (fin|erreur))", () => {
    expect(analyserTrame('{"t":"fin"}')).toEqual({ t: "fin" });
    expect(analyserTrame('{"t":"erreur"}')).toEqual({ t: "erreur" });
  });

  it("renvoie null sur du JSON invalide (ne jette jamais)", () => {
    expect(analyserTrame("{pas du json")).toBeNull();
    expect(analyserTrame("")).toBeNull();
  });

  it("renvoie null sur une trame inconnue (forward-compat : on ignore, on ne casse pas)", () => {
    expect(analyserTrame('{"t":"autre"}')).toBeNull();
    expect(analyserTrame('{"c":"sans type"}')).toBeNull();
  });

  it("ne laisse JAMAIS un delta sans contenu chaîne devenir un `c` non-chaîne", () => {
    const trame = analyserTrame('{"t":"delta","c":42}') as TrameRecue;
    expect(trame).toEqual({ t: "delta", c: "" }); // dégénère en vide, jamais 42
  });

  it("reconnaît la trame `ressources` (bloc de détresse 2.6) et valide sa forme", () => {
    const brut = {
      t: "ressources",
      position: "avant",
      verifieLe: "28 juillet 2026",
      ressources: [{ numero: "15", tel: "15", aria: "1 5", service: "SAMU", desc: "urgence vitale" }],
    };
    expect(analyserTrame(JSON.stringify(brut))).toEqual(brut);
  });

  it("rejette une trame `ressources` MALFORMÉE → null (forward-compat sûr ; la sécurité ne dépend pas du bloc)", () => {
    expect(analyserTrame('{"t":"ressources","position":"ailleurs","verifieLe":"d","ressources":[]}')).toBeNull();
    expect(analyserTrame('{"t":"ressources","position":"avant","ressources":[]}')).toBeNull(); // verifieLe manquant
    expect(analyserTrame('{"t":"ressources","position":"avant","verifieLe":"d","ressources":"nope"}')).toBeNull();
    expect(
      analyserTrame('{"t":"ressources","position":"avant","verifieLe":"d","ressources":[{"numero":15}]}'),
    ).toBeNull(); // champ non-chaîne
    expect(analyserTrame('{"t":"ressources","position":"avant","verifieLe":"d","ressources":[]}')).toBeNull(); // vide (R9)
  });

  it("reconnaît la trame `beat` (apparition d'Anam 2.7) et valide son identifiant", () => {
    expect(analyserTrame('{"t":"beat","beat":"nommer"}')).toEqual({ t: "beat", beat: "nommer" });
    expect(analyserTrame('{"t":"beat","beat":"ouverture"}')).toEqual({ t: "beat", beat: "ouverture" });
    expect(analyserTrame('{"t":"beat","beat":"cloture"}')).toEqual({ t: "beat", beat: "cloture" });
  });

  it("rejette une trame `beat` d'identifiant inconnu ou malformée → null (forward-compat)", () => {
    expect(analyserTrame('{"t":"beat","beat":"autre"}')).toBeNull();
    expect(analyserTrame('{"t":"beat"}')).toBeNull(); // beat manquant
    expect(analyserTrame('{"t":"beat","beat":42}')).toBeNull(); // non-chaîne
  });

  it("reconnaît la trame `bilan` (bloc document 2.9) et valide sa forme structurée", () => {
    const brut = { t: "bilan", titre: "Ce qu'on a vu ce soir", points: ["tu portes beaucoup", "tu veux souffler"] };
    expect(analyserTrame(JSON.stringify(brut))).toEqual(brut);
  });

  it("rejette une trame `bilan` MALFORMÉE → null (forward-compat ; le rendu reste muet)", () => {
    expect(analyserTrame('{"t":"bilan","titre":"","points":["a"]}')).toBeNull(); // titre vide
    expect(analyserTrame('{"t":"bilan","points":["a"]}')).toBeNull(); // titre manquant
    expect(analyserTrame('{"t":"bilan","titre":"T","points":[]}')).toBeNull(); // aucun point (vide, cf. R9)
    expect(analyserTrame('{"t":"bilan","titre":"T","points":"nope"}')).toBeNull(); // points non-tableau
    expect(analyserTrame('{"t":"bilan","titre":"T","points":[42]}')).toBeNull(); // point non-chaîne
    expect(analyserTrame('{"t":"bilan","titre":"T","points":[""]}')).toBeNull(); // point vide
  });

  it("reconnaît la trame `paywall` (proposition d'abonnement 3.2) : signal PUR sans payload", () => {
    expect(analyserTrame('{"t":"paywall"}')).toEqual({ t: "paywall" });
    // Des champs parasites sont ignorés (signal pur) — jamais une donnée injectée dans le fil.
    expect(analyserTrame('{"t":"paywall","x":42}')).toEqual({ t: "paywall" });
  });
});

describe("insererTour — placement du bloc ressources relativement au tour d'Anam (2.6, AC4)", () => {
  const user: Tour = { id: "u1", role: "utilisatrice", texte: "coucou" };
  const anam: Tour = { id: "a1", role: "anam", texte: "…", etat: "flux" };
  const bloc: Tour = { id: "r1", role: "ressource", ancreId: "a1", ressources: [], verifieLe: "28 juillet 2026" };

  it("« avant » place le bloc juste AVANT le tour ancre (niveau 3 vital)", () => {
    expect(insererTour([user, anam], "a1", "avant", bloc).map((t) => t.id)).toEqual(["u1", "r1", "a1"]);
  });
  it("« apres » place le bloc juste APRÈS le tour ancre (niveau 2)", () => {
    expect(insererTour([user, anam], "a1", "apres", bloc).map((t) => t.id)).toEqual(["u1", "a1", "r1"]);
  });
  it("ancre absente (tour retiré entre-temps) → liste inchangée, jamais un crash", () => {
    expect(insererTour([user, anam], "zzz", "avant", bloc).map((t) => t.id)).toEqual(["u1", "a1"]);
  });
});

describe("detacherMotsComplets — révélation PAR GROUPES DE MOTS, jamais lettre par lettre (AC3, NFR-014)", () => {
  it("ne révèle que jusqu'au dernier espace, garde le mot en cours dans le reste", () => {
    const { pret, reste } = detacherMotsComplets("Je suis là avec t");
    expect(pret).toBe("Je suis là avec ");
    expect(reste).toBe("t"); // « t » (mot en cours) attend le prochain delta
  });

  it("ne révèle RIEN tant qu'aucun espace n'est arrivé (pas de char-par-char)", () => {
    const { pret, reste } = detacherMotsComplets("Bonjou");
    expect(pret).toBe("");
    expect(reste).toBe("Bonjou");
  });

  it("préserve les sauts de ligne (message multi-paragraphes)", () => {
    const { pret, reste } = detacherMotsComplets("Première ligne.\nSeconde li");
    expect(pret).toBe("Première ligne.\nSeconde ");
    expect(reste).toBe("li");
  });
});

describe("Contrat NDJSON serveur ↔ client ALIGNÉ (revue 2.2)", () => {
  // Le client ne peut PAS importer le type serveur (frontière AD-7) → seul un test de contrat
  // croisé empêche une dérive silencieuse (ex. serveur renomme la clé `c` → client lit "").
  const relire = (trame: Parameters<typeof ligneNdjson>[0]) => {
    const { lignes } = extraireLignes(ligneNdjson(trame)); // exactement le chemin du client
    return analyserTrame(lignes[0]);
  };

  it("ce que le serveur SÉRIALISE (ligneNdjson) est relu à l'identique par le client (analyserTrame)", () => {
    expect(relire({ t: "delta", c: "coucou" })).toEqual({ t: "delta", c: "coucou" });
    expect(relire({ t: "fin" })).toEqual({ t: "fin" });
    expect(relire({ t: "erreur" })).toEqual({ t: "erreur" });
  });

  it("un delta multi-lignes reste UNE seule ligne NDJSON parsable (frontière `\\n` non cassée)", () => {
    const ligne = ligneNdjson({ t: "delta", c: "para 1\npara 2" });
    expect(ligne.endsWith("\n")).toBe(true);
    const { lignes } = extraireLignes(ligne);
    expect(lignes).toHaveLength(1);
    expect(analyserTrame(lignes[0])).toEqual({ t: "delta", c: "para 1\npara 2" });
  });

  it("la trame `ressources` sérialisée serveur est relue à l'identique par le client (contrat 2.6)", () => {
    const trame = {
      t: "ressources" as const,
      position: "apres" as const,
      verifieLe: "28 juillet 2026",
      ressources: [
        { numero: "3114", tel: "3114", aria: "3 1 1 4", service: "Prévention du suicide", desc: "24 h/24" },
      ],
    };
    expect(relire(trame)).toEqual(trame);
  });

  it("la trame `beat` sérialisée serveur est relue à l'identique par le client (contrat 2.7)", () => {
    expect(relire({ t: "beat", beat: "nommer" })).toEqual({ t: "beat", beat: "nommer" });
  });

  it("la trame `bilan` sérialisée serveur est relue à l'identique par le client (contrat 2.9)", () => {
    const trame = { t: "bilan" as const, titre: "Ce qu'on a vu", points: ["ligne un", "ligne\ndeux"] };
    expect(relire(trame)).toEqual(trame);
  });

  it("la trame `paywall` sérialisée serveur est relue à l'identique par le client (contrat 3.2)", () => {
    expect(relire({ t: "paywall" })).toEqual({ t: "paywall" });
  });
});

describe("Story 3.2 — la trame `paywall` est NON TERMINALE (le fil continue jusqu'à `fin`)", () => {
  // Le hook `useFluxAnam` n'est pas invocable en env node (fetch/reader). Garde de lecture de source :
  // `paywall` est traité AVANT la branche terminale `fin|erreur` → jamais une coupure prématurée.
  const racine = process.cwd();
  const hook = readFileSync(resolve(racine, "render/conversation/useFluxAnam.ts"), "utf-8");
  it("`onPaywall` est dispatché AVANT le test terminal `fin|erreur`", () => {
    const iPaywall = hook.indexOf('trame.t === "paywall"');
    const iTerminal = hook.indexOf('trame.t === "fin"');
    expect(iPaywall, "branche paywall présente").toBeGreaterThan(-1);
    expect(iTerminal, "branche terminale présente").toBeGreaterThan(-1);
    expect(iPaywall, "paywall traité AVANT le terminal (non terminale)").toBeLessThan(iTerminal);
  });
});
