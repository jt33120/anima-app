import { describe, it, expect, vi, beforeEach } from "vitest";
import { classerEchec } from "@/lib/ai/adapters/mistral";

/**
 * reprise-flux-modele.test.ts — UNE RÉPONSE SUR TROIS ÉCHOUAIT (QA visuelle du 2026-08-19, H6)
 *
 * Mesuré en production : 1 échec sur 3 envois le 19 août, 2 sur 14 le 15. L'écran disait « Je n'ai
 * pas pu répondre. Ton message est gardé. » — un bon message — et rien, nulle part, ne disait
 * POURQUOI : ni erreur console, ni requête en 4xx/5xx côté client. Le flux mourait côté serveur, et
 * un quota dépassé, une coupure réseau et une panne du fournisseur ressortaient identiques.
 *
 * Deux choses ont été posées : une classification qui fait parler le journal, et une reprise
 * UNIQUE, bornée à l'avant-premier fragment.
 *
 * ⚠️ CE QUE CE FICHIER GARDE VRAIMENT. La borne. Reprendre après qu'un fragment est parti
 * dupliquerait du texte dans le fil — Anam se répéterait au milieu d'une phrase. C'est le genre de
 * correctif qui répare une statistique et abîme l'objet.
 */

describe("[H6] la classification d'un échec du fournisseur", () => {
  it("[LE CŒUR] le quota et les pannes serveur sont passagers", () => {
    expect(classerEchec({ statusCode: 429 })).toBe("passager");
    expect(classerEchec({ statusCode: 500 })).toBe("passager");
    expect(classerEchec({ statusCode: 503 })).toBe("passager");
    expect(classerEchec({ status: 502 })).toBe("passager");
  });

  it("[LA GARDE] un défaut de CONFIGURATION n'est jamais repris", () => {
    // Reprendre un 401 masquerait une clé morte et doublerait la facture, sans jamais réussir.
    for (const statut of [400, 401, 403, 404, 422]) {
      expect(classerEchec({ statusCode: statut }), `${statut} repris à tort`).toBe("configuration");
    }
  });

  it("une coupure sans statut est passagère — rien n'a encore été produit", () => {
    expect(classerEchec(new Error("socket hang up"))).toBe("passager");
    expect(classerEchec(undefined)).toBe("passager");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LA BORNE — ce qui distingue un correctif d'une régression
// ══════════════════════════════════════════════════════════════════════════════════════════════

const stream = vi.fn();

vi.mock("@mistralai/mistralai", () => ({
  Mistral: class {
    chat = { stream, complete: vi.fn() };
  },
}));
vi.mock("server-only", () => ({}));

async function* fragments(...textes: string[]) {
  for (const texte of textes) {
    yield { data: { choices: [{ delta: { content: texte } }] } };
  }
}

beforeEach(() => {
  stream.mockReset();
  vi.stubEnv("MISTRAL_ZDR_CONFIRMED", "true");
  vi.stubEnv("MISTRAL_DPA_SIGNED", "true");
  vi.stubEnv("MISTRAL_PLAN", "scale");
  vi.stubEnv("MISTRAL_API_KEY", "cle-de-test");
});

async function textesDe(flux: AsyncIterable<{ type: string; texte?: string }>): Promise<string[]> {
  const out: string[] = [];
  for await (const ev of flux) if (ev.type === "delta") out.push(ev.texte ?? "");
  return out;
}

describe("[H6] la reprise s'arrête au premier fragment", () => {
  const requete = () => ({
    contientArt9: false as const,
    messages: [{ role: "utilisatrice" as const, texte: "bonjour" }],
  });

  it("[LE CŒUR] un échec AVANT le premier fragment est repris une fois, et la réponse arrive", async () => {
    const { AdaptateurMistral } = await import("@/lib/ai/adapters/mistral");
    stream
      .mockRejectedValueOnce(Object.assign(new Error("rate limited"), { statusCode: 429 }))
      .mockResolvedValueOnce(fragments("Bonjour", ", te voilà."));

    const a = new AdaptateurMistral();
    expect(await textesDe(a.diffuser(requete() as never))).toEqual(["Bonjour", ", te voilà."]);
    expect(stream, "la reprise n'a pas eu lieu").toHaveBeenCalledTimes(2);
  });

  it("[LA BORNE] un échec APRÈS un fragment n'est JAMAIS repris — Anam se répéterait", async () => {
    const { AdaptateurMistral } = await import("@/lib/ai/adapters/mistral");
    async function* meurtEnRoute() {
      yield { data: { choices: [{ delta: { content: "Je commence" } }] } };
      throw Object.assign(new Error("stream died"), { statusCode: 503 });
    }
    stream.mockResolvedValueOnce(meurtEnRoute()).mockResolvedValueOnce(fragments("Je commence"));

    const a = new AdaptateurMistral();
    await expect(textesDe(a.diffuser(requete() as never))).rejects.toThrow(/stream died/);
    expect(
      stream,
      "le flux a été rouvert alors qu'un fragment était déjà parti : le texte se dupliquerait",
    ).toHaveBeenCalledTimes(1);
  });

  it("[LA BORNE] un défaut de configuration n'est pas repris, même avant le premier fragment", async () => {
    const { AdaptateurMistral } = await import("@/lib/ai/adapters/mistral");
    stream.mockRejectedValue(Object.assign(new Error("unauthorized"), { statusCode: 401 }));

    const a = new AdaptateurMistral();
    await expect(textesDe(a.diffuser(requete() as never))).rejects.toThrow(/unauthorized/);
    expect(stream, "une clé morte a été retentée").toHaveBeenCalledTimes(1);
  });

  it("[LA BORNE] la reprise est UNIQUE — deux échecs de suite remontent", async () => {
    const { AdaptateurMistral } = await import("@/lib/ai/adapters/mistral");
    stream.mockRejectedValue(Object.assign(new Error("still down"), { statusCode: 503 }));

    const a = new AdaptateurMistral();
    await expect(textesDe(a.diffuser(requete() as never))).rejects.toThrow(/still down/);
    expect(stream, "la reprise boucle").toHaveBeenCalledTimes(2);
  });
});
