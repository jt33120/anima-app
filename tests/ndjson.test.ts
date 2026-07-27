import { describe, it, expect } from "vitest";
import { ligneNdjson } from "@/lib/ai/flux-ndjson";

/**
 * Story 2.2 (revue) — le cadrage NDJSON. Verrou de non-régression du cas CRITIQUE : un delta
 * contenant un `\n` (liste, paragraphe — fréquent chez un LLM) NE doit PAS casser la frontière de
 * ligne. Le code est correct via l'échappement de JSON.stringify ; ce test empêche qu'un refactor
 * vers une concaténation brute passe inaperçu.
 */
describe("ligneNdjson — cadrage une-ligne-par-événement (revue 2.2)", () => {
  it("termine chaque trame par exactement un `\\n`", () => {
    const l = ligneNdjson({ t: "fin" });
    expect(l.endsWith("\n")).toBe(true);
    expect(l.slice(0, -1)).not.toContain("\n");
  });

  it("un delta multi-lignes reste UNE seule ligne (le `\\n` du contenu est échappé)", () => {
    const l = ligneNdjson({ t: "delta", c: "ligne 1\nligne 2\nligne 3" });
    // un seul saut de ligne : le terminateur final, aucun `\n` littéral à l'intérieur.
    expect(l.split("\n").filter((x) => x.length > 0)).toHaveLength(1);
    expect(l.endsWith("\n")).toBe(true);
    // et l'aller-retour préserve le contenu exact.
    const parse = JSON.parse(l.trimEnd()) as { t: string; c: string };
    expect(parse).toEqual({ t: "delta", c: "ligne 1\nligne 2\nligne 3" });
  });

  it("échappe aussi guillemets et backslash sans casser la ligne", () => {
    const c = 'elle a dit "\\o/" \n et \t voilà';
    const l = ligneNdjson({ t: "delta", c });
    expect(l.split("\n").filter((x) => x.length > 0)).toHaveLength(1);
    expect((JSON.parse(l.trimEnd()) as { c: string }).c).toBe(c);
  });
});
