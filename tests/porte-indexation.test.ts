import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { siteIndexable } from "@/lib/domain/environnement";

/**
 * porte-indexation.test.ts — LE SITE RESTE HORS DES MOTEURS TANT QU'ON NE L'OUVRE PAS (porte §7).
 *
 * ══ CE QUI EST EN JEU ═══════════════════════════════════════════════════════════════════════════
 *
 * L'URL de production est publique. Le produit, lui, n'est pas publiable : 0 créneau de corpus sur
 * 210, 0 visuel de carte sur 21, et un protocole de détresse qu'aucun professionnel n'a relu. Être
 * TROUVÉ, aujourd'hui, ce serait être trouvé par quelqu'un qui cherche de l'aide — le pire moment
 * possible pour ce produit, et exactement ce qu'un moteur de recherche organise.
 *
 * L'asymétrie qui commande la forme de la garde : un index se propage, se met en cache et se cite —
 * il ne se retire pas d'un `git revert`. Rester invisible un jour de trop, si.
 */

// `updateSession` parle à Supabase ; ici on n'éprouve que ce que le proxy AJOUTE à sa réponse.
vi.mock("@/lib/data/supabase/middleware", () => ({
  updateSession: vi.fn(async () => NextResponse.next()),
}));

const { proxy } = await import("@/proxy");
const robots = (await import("@/app/robots")).default;

describe("[porte §7] `siteIndexable` — fermé par défaut", () => {
  it("aucune variable ⇒ FERMÉ", () => {
    expect(siteIndexable({})).toBe(false);
  });

  it("seul le mot `oui` ouvre — pas ce que posent les outils", () => {
    // ⚠️ MUTATION-CIBLE : accepter `true`/`1`/`yes`. Ce sont les valeurs qu'un gabarit, un script de
    // déploiement ou un copier-coller pose sans intention. `oui` est ce que pose quelqu'un qui a
    // décidé. Un site ne doit pas s'ouvrir aux moteurs par accident de configuration.
    expect(siteIndexable({ ANIMA_INDEXABLE: "oui" })).toBe(true);
    for (const valeur of ["true", "1", "yes", "OUI", "oui ", "", "non", "false"]) {
      expect(siteIndexable({ ANIMA_INDEXABLE: valeur }), `« ${valeur} » ne doit pas ouvrir`).toBe(
        false,
      );
    }
  });
});

describe("[porte §7] `robots.txt` — la couche qui interdit d'EXPLORER", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("fermé : `Disallow: /` sur tout le monde", () => {
    vi.stubEnv("ANIMA_INDEXABLE", "");
    expect(robots()).toEqual({ rules: [{ userAgent: "*", disallow: "/" }] });
  });

  it("ouvert : les surfaces authentifiées et l'API restent hors exploration", () => {
    vi.stubEnv("ANIMA_INDEXABLE", "oui");
    const regles = robots().rules;
    const r = Array.isArray(regles) ? regles[0] : regles;
    expect(r.allow).toBe("/");
    expect(r.disallow).toContain("/api/");
  });

  it("la route est DYNAMIQUE — sinon la garde ne se referme pas sans redéploiement", () => {
    // ⚠️ Le point n'est pas d'ouvrir sans rebuild, c'est de pouvoir REFERMER. Figée au build, la
    // valeur du jour du déploiement resterait vraie quoi qu'on pose ensuite sur l'hébergeur.
    const src = readFileSync(resolve(process.cwd(), "app/robots.ts"), "utf-8");
    expect(src).toMatch(/export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/);
  });
});

describe("[porte §7] `X-Robots-Tag` — la couche qui interdit d'INDEXER", () => {
  beforeEach(() => vi.stubEnv("ANIMA_INDEXABLE", ""));
  afterEach(() => vi.unstubAllEnvs());

  const requete = (url: string) => new NextRequest(url, { method: "GET" });

  it("posé sur un DOCUMENT", async () => {
    const r = await proxy(requete("https://anima.test/abonnement"));
    expect(r.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });

  it("posé AUSSI sur `/api` — la garde vit au-dessus du routage, pas dans une branche", async () => {
    // ⚠️ LA FAMILLE DE DÉFAUTS DU DÉPÔT : la garde posée sur un chemin sur trois (`PiedHalte` absent
    // de deux sorties d'`/ancrages`, le contrôle de lexique absent de deux sorties de modèle).
    // `proxy` a deux `return` et en aura d'autres ; l'en-tête est posé par-dessus, à l'unique
    // endroit où toutes les réponses se rejoignent.
    const r = await proxy(requete("https://anima.test/api/anam/message"));
    expect(r.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });

  it("`robots.txt` seul NE SUFFIRAIT PAS — les deux couches lisent le même prédicat", () => {
    // Un `Disallow` demande de ne pas EXPLORER ; il n'interdit pas d'INDEXER. Une URL découverte
    // ailleurs peut paraître dans les résultats avec son seul titre — précisément parce que le
    // moteur s'est interdit d'aller lire la page qui aurait dit « n'indexe pas ».
    for (const f of ["app/robots.ts", "proxy.ts"]) {
      expect(readFileSync(resolve(process.cwd(), f), "utf-8"), `${f} doit lire le prédicat`).toMatch(
        /siteIndexable\s*\(\s*process\.env\s*\)/,
      );
    }
  });

  it("ouvert : plus aucun en-tête — la garde se retire vraiment", async () => {
    vi.stubEnv("ANIMA_INDEXABLE", "oui");
    const r = await proxy(requete("https://anima.test/"));
    expect(r.headers.get("X-Robots-Tag")).toBeNull();
  });
});
