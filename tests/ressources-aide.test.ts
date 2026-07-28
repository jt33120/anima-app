import { describe, it, expect } from "vitest";
import {
  RESSOURCES_AIDE,
  FAMILLES_ORDRE,
  LIBELLE_FAMILLE,
  VERIFIE_LE,
  PROCHAINE_REVUE,
  RESPONSABLE_REVUE,
  revuePerimee,
  type FamilleDanger,
} from "@/lib/safety/ressources-aide";

/**
 * Story 2.5 (T1) — la SOURCE UNIQUE des ressources d'aide (pur, AD-9/AD-15). On prouve :
 *  - les 6 ressources vérifiées, groupées par FAMILLE de danger (FR-074, présentation statique) ;
 *  - le doublage vocal chiffre-par-chiffre (revue 1.8 [11]) ;
 *  - la gouvernance FR-044 : revue TRIMESTRIELLE, assignée, tracée — avec la garde de cadence
 *    HYBRIDE (structurelle déterministe + péremption réelle, hard-break seulement sous PRELANCEMENT=1).
 */

const JOUR_MS = 24 * 60 * 60 * 1000;

describe("RESSOURCES_AIDE — le filet, adapté au danger (AC3, FR-074)", () => {
  it("porte les numéros vérifiés essentiels (3114 · 15 · 112 · 3919 · 119 · SOS Amitié)", () => {
    const tels = RESSOURCES_AIDE.map((r) => r.tel);
    for (const t of ["3114", "15", "112", "3919", "119", "0972394050"]) {
      expect(tels, `numéro ${t} absent`).toContain(t);
    }
    expect(RESSOURCES_AIDE.some((r) => r.service.includes("SOS Amitié"))).toBe(true);
  });

  it("les 5 familles de danger sont représentées", () => {
    const familles = new Set(RESSOURCES_AIDE.map((r) => r.famille));
    for (const f of ["suicide", "urgence_vitale", "violences_femmes", "enfance", "ecoute"] as FamilleDanger[]) {
      expect(familles.has(f), `famille ${f} absente`).toBe(true);
    }
  });

  it("chaque ressource a les champs requis, et `aria` est énoncé chiffre par chiffre", () => {
    expect(RESSOURCES_AIDE.length).toBeGreaterThanOrEqual(6);
    for (const r of RESSOURCES_AIDE) {
      expect(r.numero, "numero vide").toBeTruthy();
      expect(r.tel, `tel non composable : ${r.tel}`).toMatch(/^\d+$/);
      expect(r.service, "service vide (lu avant les chiffres)").toBeTruthy();
      expect(r.desc, "desc vide").toBeTruthy();
      expect(r.aria, `aria non espacé chiffre-par-chiffre : "${r.aria}"`).toMatch(/^\d( \d)+$/);
    }
  });

  it("l'ordre d'affichage met le danger vital en tête et couvre toutes les familles", () => {
    expect(FAMILLES_ORDRE[0]).toBe("suicide");
    expect(FAMILLES_ORDRE).toContain("urgence_vitale");
    // chaque famille présente dans les ressources a un ordre ET un libellé (pas de groupe orphelin)
    for (const r of RESSOURCES_AIDE) {
      expect(FAMILLES_ORDRE, `famille ${r.famille} hors ordre`).toContain(r.famille);
      expect(LIBELLE_FAMILLE[r.famille], `libellé manquant pour ${r.famille}`).toBeTruthy();
    }
  });
});

describe("Gouvernance FR-044 — revue trimestrielle, assignée, tracée (AC3)", () => {
  it("porte une date de vérification ISO et un responsable nommé", () => {
    expect(VERIFIE_LE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(PROCHAINE_REVUE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(RESPONSABLE_REVUE.trim().length, "responsable de revue non nommé").toBeGreaterThan(0);
  });

  it("(a) CADENCE STRUCTURELLE — l'intervalle est un vrai TRIMESTRE (déterministe, ~90 j)", () => {
    const intervalle = (new Date(PROCHAINE_REVUE).getTime() - new Date(VERIFIE_LE).getTime()) / JOUR_MS;
    // ni un mois (trop court), ni un an (trop long) : un trimestre = 84–93 jours.
    expect(intervalle, "PROCHAINE_REVUE n'est pas un trimestre après VERIFIE_LE").toBeGreaterThanOrEqual(84);
    expect(intervalle).toBeLessThanOrEqual(93);
  });

  it("`revuePerimee` est pur : périmé après l'échéance, valide avant (date injectée)", () => {
    const apres = new Date(new Date(PROCHAINE_REVUE).getTime() + JOUR_MS);
    const avant = new Date(new Date(PROCHAINE_REVUE).getTime() - JOUR_MS);
    expect(revuePerimee(apres)).toBe(true);
    expect(revuePerimee(avant)).toBe(false);
  });

  it("(b) PÉREMPTION RÉELLE — ne casse le build que sous PRELANCEMENT=1 (sinon warn)", () => {
    const perime = revuePerimee(new Date());
    if (process.env.PRELANCEMENT === "1") {
      // Porte pré-lancement : un numéro périmé est un défaut critique (FR-044) → build rouge.
      expect(
        perime,
        `Revue FR-044 PÉRIMÉE (PROCHAINE_REVUE=${PROCHAINE_REVUE}) — revérifier les 6 numéros, bumper VERIFIE_LE/PROCHAINE_REVUE`,
      ).toBe(false);
    } else if (perime) {
      // Pendant le dev : jamais bloquant, mais bruyant.
      console.warn(
        `⚠️ FR-044 : revue des ressources périmée (PROCHAINE_REVUE=${PROCHAINE_REVUE}). ` +
          `Revérifier les 6 numéros. Hard-break sous PRELANCEMENT=1.`,
      );
    }
    // Sans PRELANCEMENT, le test PASSE toujours (pas de time-bomb pendant le dev).
    expect(true).toBe(true);
  });
});
