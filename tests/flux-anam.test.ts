import { describe, it, expect } from "vitest";
import { AdaptateurFactice } from "@/lib/ai/adapters/factice";
import type { EvenementIa, RequeteIa } from "@/lib/ai/port";

/**
 * Story 2.2 — le streaming du port (`diffuser()`, AC3) au niveau adaptateur factice (le chemin CI).
 * La garde d'egress art. 9 sur le flux (`diffuserSousEgressArt9`) est prouvée en SQL réel dans
 * `tests/flux-anam-egress.test.ts` (positif + négatif). Ici : le contrat de flux lui-même.
 */

async function collecter(flux: AsyncIterable<EvenementIa>): Promise<EvenementIa[]> {
  const evts: EvenementIa[] = [];
  for await (const e of flux) evts.push(e);
  return evts;
}

const requete: RequeteIa = {
  capacite: "echange",
  messages: [{ role: "user", content: "bonjour" }],
  contientArt9: true,
};

describe("diffuser() — contrat de flux (AC3, AD-3)", () => {
  it("émet des `delta` PUIS exactement UN `fin`", async () => {
    const evts = await collecter(new AdaptateurFactice().diffuser(requete));
    const deltas = evts.filter((e) => e.type === "delta");
    const fins = evts.filter((e) => e.type === "fin");
    expect(deltas.length).toBeGreaterThan(0);
    expect(fins).toHaveLength(1);
    expect(evts.at(-1)?.type).toBe("fin"); // le `fin` clôt le flux
  });

  it("les `delta` sont des GROUPES DE MOTS, jamais caractère par caractère (NFR-014)", async () => {
    const evts = await collecter(new AdaptateurFactice().diffuser(requete));
    const deltas = evts.filter((e): e is Extract<EvenementIa, { type: "delta" }> => e.type === "delta");
    // aucun delta ne se réduit à un seul caractère non-espace (preuve du regroupement).
    for (const d of deltas) {
      expect(d.texte.trim().length, `delta trop court: "${d.texte}"`).toBeGreaterThan(1);
    }
    // le texte recomposé est cohérent et non vide.
    const recompose = deltas.map((d) => d.texte).join("");
    expect(recompose.length).toBeGreaterThan(3);
  });

  it("le `fin` porte tier + modele HONNÊTE (factice) + usage", async () => {
    const evts = await collecter(new AdaptateurFactice().diffuser(requete));
    const fin = evts.find((e): e is Extract<EvenementIa, { type: "fin" }> => e.type === "fin")!;
    expect(fin.tier).toBe("leger"); // echange, niveau 0
    expect(fin.modele).toBe("factice"); // JAMAIS un id Mistral sans appel Mistral (revue 2.1)
    expect(fin.usage.tokensSortie).toBeGreaterThan(0);
  });

  it("DÉTRESSE (niveauSecurite ≥ 1) → le flux passe au tier FORT (AD-5)", async () => {
    const flux = new AdaptateurFactice().diffuser({ ...requete, niveauSecurite: 2 });
    const evts = await collecter(flux);
    const fin = evts.find((e): e is Extract<EvenementIa, { type: "fin" }> => e.type === "fin")!;
    expect(fin.tier).toBe("fort");
  });
});
