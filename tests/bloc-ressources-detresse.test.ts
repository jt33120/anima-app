import { describe, it, expect } from "vitest";
import { blocRessourcesDetresse } from "@/lib/safety/bloc-ressources-detresse";
import { classerDetresse } from "@/lib/safety/classer-detresse";
import { RESSOURCES_AIDE } from "@/lib/safety/ressources-aide";

/**
 * Story 2.6 (T3) — le sélecteur PUR du bloc ressources par niveau (AC4). Consomme la SOURCE UNIQUE
 * `ressources-aide` (jamais de liste inline). Placement : niveau 2 → APRÈS le tour d'Anam ; niveau 3
 * → AVANT, `15/112` en tête si danger vital (FR-074). Défaut protecteur : suicide au niveau ≥ 2 sans
 * famille (l'idéation est le cas majoritaire — jamais un danger fabriqué).
 */

const numeros = (b: ReturnType<typeof blocRessourcesDetresse>) => b!.ressources.map((r) => r.numero);

describe("blocRessourcesDetresse — sélection + placement par niveau (pur)", () => {
  it("niveaux 0 et 1 → AUCUN bloc (rien ajouté au DOM — AC1)", () => {
    expect(blocRessourcesDetresse(classerDetresse(0))).toBeNull();
    expect(blocRessourcesDetresse(classerDetresse(1))).toBeNull();
    // même avec une famille, le niveau 1 ne montre rien
    expect(blocRessourcesDetresse(classerDetresse(1, "suicide"))).toBeNull();
  });

  it("niveau 2 → bloc APRÈS le tour d'Anam", () => {
    const b = blocRessourcesDetresse(classerDetresse(2, "suicide"));
    expect(b?.position).toBe("apres");
  });

  it("niveau 3 → bloc AVANT le tour d'Anam", () => {
    const b = blocRessourcesDetresse(classerDetresse(3, "suicide"));
    expect(b?.position).toBe("avant");
  });

  it("défaut protecteur : niveau ≥ 2 sans famille → suicide, 3114 en tête", () => {
    const b2 = blocRessourcesDetresse(classerDetresse(2));
    expect(b2?.familleAffichee).toBe("suicide");
    expect(numeros(b2)[0]).toBe("3114");
    const b3 = blocRessourcesDetresse(classerDetresse(3));
    expect(numeros(b3)[0]).toBe("3114"); // suicide niveau 3 : « 3114 immédiatement » (PRD)
  });

  it("niveau 3 danger VITAL → 15/112 EN TÊTE (AC4)", () => {
    expect(numeros(blocRessourcesDetresse(classerDetresse(3, "urgence_vitale")))[0]).toBe("15");
    // violences en cours (danger vital) : 15/112 en tête ET la ressource correspondante (3919) présente
    const bv = blocRessourcesDetresse(classerDetresse(3, "violences_femmes"));
    expect(["15", "112"]).toContain(numeros(bv)[0]);
    expect(numeros(bv)).toContain("3919");
  });

  it("ressources CORRESPONDANTES au danger (FR-074) : violences niveau 2 → 3919 en tête", () => {
    const b = blocRessourcesDetresse(classerDetresse(2, "violences_femmes"));
    expect(numeros(b)[0]).toBe("3919");
  });

  it("niveau 3 = danger actif → 15/112 en tête pour TOUTE famille sauf suicide (R6, couvre `ecoute`)", () => {
    // « ecoute » n'est pas dans une liste « vitale » mais au niveau 3 (danger actif) le plancher 15/112
    // s'applique quand même — jamais une ligne d'écoute générale en tête d'une urgence.
    expect(numeros(blocRessourcesDetresse(classerDetresse(3, "ecoute")))[0]).toBe("15");
    expect(numeros(blocRessourcesDetresse(classerDetresse(3, "enfance")))[0]).toBe("15");
    // suicide reste l'exception : 3114 immédiatement (jamais devancé par 15/112).
    expect(numeros(blocRessourcesDetresse(classerDetresse(3, "suicide")))[0]).toBe("3114");
  });

  it("consomme la SOURCE UNIQUE (chaque ressource EST un objet de RESSOURCES_AIDE) et sans doublon", () => {
    const b = blocRessourcesDetresse(classerDetresse(3, "violences_femmes"))!;
    for (const r of b.ressources) expect(RESSOURCES_AIDE).toContain(r); // même référence, jamais inline
    const tels = b.ressources.map((r) => r.tel);
    expect(new Set(tels).size).toBe(tels.length); // aucun doublon
  });
});
