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
    // « inconnu » est le repli d'une base injoignable OU d'un appel qui a dépassé son délai. La base
    // locale est joignable pendant ces tests : le voir ici signifierait que l'appel lui-même est cassé.
    // Le piège concret (revue 4.8, défaut n°8) : `avecDelai` appelle `.finally` sur ce qu'on lui donne, et
    // le constructeur de requête de PostgREST est un THENABLE — il porte `then`, mais ni `catch` ni
    // `finally`. Le lui passer nu lève un TypeError, que le `catch` avale en « inconnu ». Sans cette
    // assertion, la sonde aurait cessé de sonder en restant verte.
    expect(["ok", "degrade"], "la base est joignable : le signal doit être un vrai verdict").toContain(
      json.ordonnanceur,
    );
  });

  it("[NFR-020] la route publique ne divulgue AUCUN détail sur les jobs", async () => {
    // Mutation-cible : remplacer `santePublique()` par le rapport détaillé. La route est ouverte à tous ;
    // y publier les noms de jobs et leurs horodatages dessinerait la carte des rythmes internes du produit.
    const json = await (await GET()).json();
    expect(Object.keys(json).sort()).toEqual(["app", "ordonnanceur", "status"]);
    expect(JSON.stringify(json)).not.toMatch(/sante-ordonnanceur|\d{4}-\d{2}-\d{2}/);
  });
});
