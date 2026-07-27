import { describe, it, expect } from "vitest";
import {
  extraireLignes,
  analyserTrame,
  detacherMotsComplets,
  type TrameRecue,
} from "@/render/conversation/flux-ndjson-client";
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
});
