import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { creerPortResend } from "@/lib/courriel/adaptateurs/resend";
import { GABARITS, EXPEDITEUR_NOM } from "@/lib/courriel/gabarits";
import { codeDErreur } from "@/lib/domain/code-erreur";

/**
 * REVUE 4.9 (T4-2) — L'ADAPTATEUR RESEND.
 *
 * C'est la PROMESSE-TITRE de la story — « Resend voit une adresse et un motif, rien d'autre » — et elle
 * n'était vérifiée que contre l'adaptateur FACTICE. Autrement dit : on prouvait que la doublure ne
 * fuitait pas. Le seul fichier du dépôt qui parle réellement à un fournisseur d'envoi n'avait aucun test.
 *
 * Ce qui se joue ici et nulle part ailleurs : la charge utile RÉELLE. Entre « la signature du port
 * interdit de passer du contenu » et « rien de plus que l'adresse ne part sur le réseau », il y a un
 * `JSON.stringify` que personne ne regardait.
 */

const fetchOrigine = globalThis.fetch;

interface AppelCapture {
  url: string;
  entetes: Record<string, string>;
  corps: Record<string, unknown>;
}

function stubFetch(reponse: { ok: boolean; status: number } | (() => Promise<Response>)) {
  const appels: AppelCapture[] = [];
  globalThis.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    appels.push({
      url: String(url),
      entetes: (init?.headers ?? {}) as Record<string, string>,
      corps: JSON.parse(String(init?.body ?? "{}")),
    });
    if (typeof reponse === "function") return reponse();
    return { ok: reponse.ok, status: reponse.status } as Response;
  }) as typeof fetch;
  return appels;
}

beforeEach(() => {
  vi.useRealTimers();
});
afterEach(() => {
  globalThis.fetch = fetchOrigine;
  vi.useRealTimers();
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

describe("[NFR-020/022] ce qui part RÉELLEMENT sur le réseau", () => {
  it("[LE CŒUR] la charge utile ne porte QUE l'adresse, l'objet et le corps constants", async () => {
    // La garde d'origine était statique et ne lisait que `gabarits.ts`. Elle prouvait qu'aucun `${}` n'y
    // figurait — pas que l'adaptateur n'ajoutait rien de son côté. Mutation-cible : ajouter un champ à la
    // charge utile (un prénom, un aperçu, une date). Le scénario banal reste « ajoutons le premier
    // paragraphe de la synthèse en aperçu, c'est plus engageant » : ce paragraphe est de l'art. 9, il
    // s'afficherait sur un écran verrouillé et traînerait pour toujours chez un tiers.
    const appels = stubFetch({ ok: true, status: 200 });
    const port = creerPortResend("re_cle", "anam@exemple.fr");

    await port.envoyer("marie@exemple.fr", "synthese_prete");

    expect(appels).toHaveLength(1);
    expect(appels[0].url).toBe("https://api.resend.com/emails");
    // Exactement quatre champs. Un `toEqual` sur les CLÉS : un champ ajouté fait rougir, même vide.
    expect(Object.keys(appels[0].corps).sort()).toEqual(["from", "subject", "text", "to"]);
    expect(appels[0].corps).toEqual({
      from: `${EXPEDITEUR_NOM} <anam@exemple.fr>`,
      to: ["marie@exemple.fr"],
      subject: GABARITS.synthese_prete.objet,
      text: GABARITS.synthese_prete.texte,
    });
  });

  it("le corps envoyé est le gabarit AU CARACTÈRE PRÈS — aucune interpolation en chemin", async () => {
    const appels = stubFetch({ ok: true, status: 200 });
    await creerPortResend("re_cle", "anam@exemple.fr").envoyer("marie@exemple.fr", "synthese_prete");

    const texte = String(appels[0].corps.text);
    expect(texte, "rien qui ressemble à une variable non substituée").not.toMatch(/\$\{|\[object|undefined|NaN/);
    expect(texte).toBe(GABARITS.synthese_prete.texte);
  });

  it("la clé part en en-tête, jamais dans le corps", async () => {
    const appels = stubFetch({ ok: true, status: 200 });
    await creerPortResend("re_secrete", "anam@exemple.fr").envoyer("marie@exemple.fr", "synthese_prete");

    expect(appels[0].entetes.authorization).toBe("Bearer re_secrete");
    expect(JSON.stringify(appels[0].corps), "aucun secret dans la charge utile").not.toContain("re_secrete");
  });
});

describe("les refus, et ce qu'ils laissent derrière eux", () => {
  it("[LE CŒUR] un refus du fournisseur ne journalise QUE le code HTTP", async () => {
    // On ne lit PAS le corps de la réponse d'erreur : il peut contenir l'adresse qu'on vient d'envoyer,
    // et une adresse est une donnée personnelle (NFR-022). Mutation-cible : inclure `await
    // reponse.text()` dans le message d'erreur.
    let corpsLu = false;
    const reponseAvecCorps = {
      ok: false,
      status: 422,
      text: async () => {
        corpsLu = true;
        return "The email address marie@exemple.fr is invalid";
      },
      json: async () => {
        corpsLu = true;
        return {};
      },
    } as unknown as Response;
    stubFetch(async () => reponseAvecCorps);

    const port = creerPortResend("re_cle", "anam@exemple.fr");
    await expect(port.envoyer("marie@exemple.fr", "synthese_prete")).rejects.toThrow("courriel_refuse_422");
    expect(corpsLu, "le corps de la réponse n'est jamais lu").toBe(false);
  });

  it("le code d'erreur produit traverse `codeDErreur` sans rien laisser filtrer", async () => {
    // La chaîne complète : ce que l'adaptateur lève doit être journalisable tel quel. Si `codeDErreur` le
    // rejetait, on perdrait le diagnostic ; s'il laissait passer autre chose, on perdrait la garde.
    stubFetch({ ok: false, status: 500 });
    const port = creerPortResend("re_cle", "anam@exemple.fr");
    const erreur = await port.envoyer("marie@exemple.fr", "synthese_prete").catch((e) => e);

    expect(codeDErreur(erreur)).toBe("courriel_refuse_500");
    expect(codeDErreur(erreur), "et surtout : pas l'adresse").not.toContain("@");
  });

  it("un motif hors de l'ensemble fermé REFUSE d'envoyer plutôt que d'envoyer un corps vide", async () => {
    // Le type l'interdit ; un `as` malheureux ou une désérialisation ne l'interdisent pas. Mutation-cible :
    // retirer `if (!gabarit) throw`. On enverrait alors `subject: undefined, text: undefined` — un
    // courriel vide, signé Anam, à quelqu'un qui n'a rien demandé.
    const appels = stubFetch({ ok: true, status: 200 });
    const port = creerPortResend("re_cle", "anam@exemple.fr");

    await expect(
      port.envoyer("marie@exemple.fr", "promo_black_friday" as "synthese_prete"),
    ).rejects.toThrow("courriel_motif_inconnu");
    expect(appels, "rien n'est parti").toEqual([]);
  });

  it("un fournisseur qui ne répond pas est coupé, et le code ne dit rien de l'adresse", async () => {
    vi.useFakeTimers();
    stubFetch(() => new Promise<Response>(() => {}));
    const port = creerPortResend("re_cle", "anam@exemple.fr");

    const promesse = port.envoyer("marie@exemple.fr", "synthese_prete");
    const attendu = expect(promesse).rejects.toThrow("courriel_timeout");
    await vi.advanceTimersByTimeAsync(11_000);
    await attendu;
  });
});

describe("`estConfigure` dit la vérité", () => {
  it("un adaptateur construit avec une clé se déclare prêt", () => {
    expect(creerPortResend("re_cle", "anam@exemple.fr").estConfigure()).toBe(true);
  });
});
