import { describe, it, expect } from "vitest";
import { consigneReponse } from "@/lib/safety/consigne-detresse";
import { classerDetresse, repliSur, type DecisionSecurite } from "@/lib/safety/classer-detresse";

/**
 * Story 2.6 (T1) — la CONSIGNE de réponse par niveau, PURE. La forme de la réponse d'Anam dérive de
 * `verdict.decision` (déjà produit par 2.3) — jamais une seconde classification. On teste la MACHINE
 * (quelle consigne pour quelle décision, quels interdits durs) ; le CONTENU clinique est PROVISOIRE.
 *
 * Interdits durs présents dans TOUTE consigne ≥ 1 : ne quitte jamais (FR-039), jamais soignante
 * (FR-041), jamais le plan ni les moyens (FR-075), cherche un humain proche (FR-076).
 */

const v = (decision: DecisionSecurite) => {
  if (decision === "repli_sur") return repliSur();
  const niveau = { poursuivre: 0, adoucir: 1, intervenir: 2, urgence: 3 }[decision] as 0 | 1 | 2 | 3;
  return classerDetresse(niveau);
};

describe("consigneReponse — decision → consigne système (pur)", () => {
  it("niveau 0 (poursuivre) → AUCUNE consigne (Anam reste elle-même, rien ajouté)", () => {
    expect(consigneReponse(v("poursuivre"))).toBeNull();
  });

  it("décisions ≥ 1 → une consigne de rôle `system` (injectée serveur)", () => {
    for (const d of ["adoucir", "intervenir", "urgence", "repli_sur"] as const) {
      const c = consigneReponse(v(d));
      expect(c, d).not.toBeNull();
      expect(c!.role, d).toBe("system");
      expect(c!.content.length, d).toBeGreaterThan(0);
    }
  });

  it("INTERDITS DURS présents dans toute consigne ≥ 1 (FR-039/041/075/076)", () => {
    for (const d of ["adoucir", "intervenir", "urgence", "repli_sur"] as const) {
      const t = consigneReponse(v(d))!.content;
      expect(t, `${d} · FR-039 ne quitte jamais`).toMatch(/ne quitte jamais|tu restes|reste avec elle|tu ne t['’]en vas pas/i);
      expect(t, `${d} · FR-041 jamais soignante`).toMatch(/pas une professionnelle de santé|tu n['’]es (pas|ni) (un|une)\s+(professionnel|soignant)/i);
      expect(t, `${d} · FR-075 jamais les moyens`).toMatch(/ni comment,? ni avec quoi,? ni quand|n['’]explore jamais.*(plan|moyens)/i);
      expect(t, `${d} · FR-076 humain proche`).toMatch(/appeler ou (la )?rejoindre|quelqu['’]un.*(appeler|rejoindre)/i);
      expect(t, `${d} · aucune promesse creuse`).not.toMatch(/ça va aller/i);
      expect(t, `${d} · aucun lexique médical`).not.toMatch(/diagnostic|thérap|médical|patient|soigner/i);
    }
  });

  it("adoucir (niveau 1) : bascule NON annoncée, ne pousse plus (FR-038)", () => {
    const t = consigneReponse(v("adoucir"))!.content;
    expect(t).toMatch(/n['’]annonce|non annoncé|ne pousse plus|plus douce/i);
    expect(t, "niveau 1 ne cite AUCUN numéro (aucun dispositif visible)").not.toMatch(/3114|15\/112/);
  });

  it("intervenir (niveau 2) : nomme, demande directement, donne le 3114 (FR-040)", () => {
    const t = consigneReponse(v("intervenir"))!.content;
    expect(t).toMatch(/nomme/i);
    expect(t).toMatch(/demande directement|demande-lui directement|sans détour/i);
    expect(t).toContain("3114");
  });

  it("nomme le MÊME numéro que la carte mène (voix ↔ carte, famille-aware — R1)", () => {
    // Sans famille → défaut suicide → 3114. Famille violences → 3919, JAMAIS 3114 : on ne recommande
    // pas verbalement la ligne de prévention du suicide à une victime de violences.
    expect(consigneReponse(classerDetresse(2))!.content).toContain("3114");
    const violences = consigneReponse(classerDetresse(2, "violences_femmes"))!.content;
    expect(violences).toContain("3919");
    expect(violences).not.toContain("3114");
    // Niveau 3 vital (violences) : la voix mène par 15 (comme la carte), et mentionne 15/112.
    expect(consigneReponse(classerDetresse(3, "violences_femmes"))!.content).toMatch(/\ble 15\b|15\/112/);
  });

  it("urgence (niveau 3) : parle ouvertement, oriente vers les secours", () => {
    const t = consigneReponse(v("urgence"))!.content;
    expect(t).toMatch(/ouvertement|sans attendre|secours|15\/112/i);
  });

  it("repli_sur : au moins aussi protecteur qu'`adoucir` (le doute protège — AD-15)", () => {
    // Le repli ne dramatise pas (pas d'idéation fabriquée) mais engage la douceur + les interdits durs.
    const t = consigneReponse(v("repli_sur"))!.content;
    expect(t).toMatch(/ne pousse plus|plus douce|reste/i);
  });
});
