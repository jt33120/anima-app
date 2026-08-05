import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/health/route";

// Test de fumée : la route de santé répond.
describe("smoke", () => {
  it("GET /api/health renvoie status ok", async () => {
    const res = await GET();
    const json = await res.json();
    // Story 4.8 : la route porte aussi l'état AGRÉGÉ de l'ordonnanceur — un mot, jamais plus.
    expect(json.status).toBe("ok");
    expect(json.app).toBe("anam");
    expect(["ok", "degrade", "inconnu"]).toContain(json.ordonnanceur);
  });

  it("[NFR-020] la route publique ne divulgue AUCUN détail sur les jobs", async () => {
    // Mutation-cible : remplacer `santePublique()` par le rapport détaillé. La route est ouverte à tous ;
    // y publier les noms de jobs et leurs horodatages dessinerait la carte des rythmes internes du produit.
    const json = await (await GET()).json();
    expect(Object.keys(json).sort()).toEqual(["app", "ordonnanceur", "status"]);
    expect(JSON.stringify(json)).not.toMatch(/sante-ordonnanceur|\d{4}-\d{2}-\d{2}/);
  });
});
