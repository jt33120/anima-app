import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { URL_AIDE } from "@/lib/scene";

/**
 * Story 1.8 — la halte `/aide` : STATIQUE et PUBLIQUE (AD-15, FR-077). Le filet de sécurité
 * ne dépend d'aucun modèle IA, d'aucun compte, d'aucune détection. La garde prouve, par lecture
 * du fichier, que la page ne lit NI session NI auth (sinon « atteignable connectée ou non »
 * serait faux), énonce ses numéros chiffre par chiffre, et porte l'ancre de transparence.
 */

const racine = process.cwd();
const chemin = resolve(racine, "app/aide/page.tsx");

describe("URL_AIDE — source unique, alignée sur la route réelle", () => {
  it("vaut « /aide » et le fichier de route existe", () => {
    expect(URL_AIDE).toBe("/aide");
    expect(existsSync(chemin)).toBe(true);
  });
});

describe("/aide — publique, sans compte, sans traceur (AC3, AD-15)", () => {
  const src = readFileSync(chemin, "utf-8");

  it("ne lit NI session NI auth (aucun client Supabase, aucun getUser/auth)", () => {
    expect(src).not.toMatch(/@\/lib\/data\/supabase/);
    expect(src).not.toMatch(/createSupabaseServerClient|createSupabaseAdminClient/);
    expect(src).not.toMatch(/getUser|auth\.getUser|supabase\.auth/);
  });

  it("n'appelle aucun traceur / analytics", () => {
    expect(src).not.toMatch(/analytics|gtag|mixpanel|posthog|plausible/i);
  });

  it("porte l'identité de route « Anam »", () => {
    expect(src).toMatch(/title:\s*["']Anam["']/);
  });
});

describe("/aide — le filet est réel : numéros joignables + accessibles (FR-077, FR-044)", () => {
  const src = readFileSync(chemin, "utf-8");

  it("les ressources essentielles sont présentes, urgence vitale incluse (15 ET 112)", () => {
    for (const num of ["3114", "3919", "119"]) {
      expect(src, `numéro ${num} absent de /aide`).toContain(num);
    }
    expect(src).toContain("SOS Amitié");
    // 15 et 112 assertés via tel: (évite les faux positifs sur la sous-chaîne « 15 »).
    expect(src, "15 (SAMU) absent").toMatch(/tel:\s*"15"/);
    expect(src, "112 (urgence européenne) absent").toMatch(/tel:\s*"112"/);
  });

  it("les numéros sont composables (liens tel: générés depuis r.tel)", () => {
    expect(src).toMatch(/href=\{`tel:\$\{r\.tel\}`\}/);
  });

  it("CHAQUE ressource est énoncée chiffre par chiffre (aria = chiffres espacés, jamais collés)", () => {
    const arias = [...src.matchAll(/aria:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(arias.length, "moins de 6 ressources aria trouvées").toBeGreaterThanOrEqual(6);
    for (const a of arias) {
      expect(a, `aria non espacé chiffre-par-chiffre : "${a}"`).toMatch(/^\d( \d)+$/);
    }
  });

  it("le nom accessible du lien inclut le SERVICE (navigation « liste des liens »)", () => {
    // aria-label composé « Service, chiffres » → le lecteur d'écran annonce le service en mode rotor.
    expect(src).toMatch(/aria-label=\{`\$\{r\.service\}, \$\{r\.aria\}`\}/);
    expect(src).toMatch(/service:\s*"Prévention du suicide"/);
  });

  it("porte l'ancre de transparence, cible de la mention « Anam est une IA »", () => {
    expect(src).toMatch(/id="transparence"/);
    expect(src).toMatch(/Anam est une IA/);
  });
});
