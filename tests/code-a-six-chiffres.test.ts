import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { sansCommentaires } from "./_absence";

/**
 * code-a-six-chiffres.test.ts — LA SECONDE PORTE, MESURÉE DE BOUT EN BOUT
 *
 * ══ CE QUI NE MARCHAIT PAS, ET POURQUOI CE N'ÉTAIT PAS UN BOGUE ═══════════════════════════════
 *
 * `/auth/confirm` est PKCE seul, et c'est une décision : `exchangeCodeForSession` exige le cookie
 * `code-verifier` posé sur LE navigateur qui a demandé le lien. La revue du 2026-08-13 avait
 * retiré l'autre flux après avoir MESURÉ qu'il permettait d'installer la session d'un attaquant
 * dans le navigateur de la victime.
 *
 * Le prix de cette sûreté est réel : demander depuis l'ordinateur et ouvrir le courriel sur le
 * téléphone — ou dans le navigateur intégré d'une application de messagerie — échoue. Le
 * 2026-08-15, sur trois liens demandés et livrés, un seul a ouvert une session.
 *
 * ══ CE QUE CE FICHIER PROUVE ══════════════════════════════════════════════════════════════════
 *
 * Frappe un Supabase LOCAL réel et lit le courriel dans le collecteur du stack, parce que le code
 * n'existe nulle part ailleurs : GoTrue n'en stocke qu'un condensat.
 *
 *   • le courriel porte bien un code à six chiffres ;
 *   • `verifyOtp({ type: "email" })` ouvre une session sur un client NEUF — c'est LA propriété
 *     inter-appareils, et elle n'est pas supposée : elle est mesurée ;
 *   • un code faux ne rend rien, et un code déjà consommé non plus.
 */

const URL_SB = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const PUB = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
/**
 * ⚠️ CE N'EST PLUS INBUCKET, MALGRÉ LA SECTION `[inbucket]` DE `config.toml`. Le CLI a changé de
 * collecteur pour Mailpit sans changer le nom de la clé : l'ancienne route `/api/v1/mailbox/<nom>`
 * rend « File not found ». Une heure perdue là-dessus, notée ici pour la prochaine.
 */
const COURRIELS = process.env.ANIMA_MAILPIT ?? "http://127.0.0.1:54324";

const client = () =>
  createClient(URL_SB, PUB, { auth: { autoRefreshToken: false, persistSession: false } });

type Message = { ID: string; Subject: string; To: { Address: string }[] };

/** Le dernier message reçu par cette adresse, ou `null`. Le collecteur est asynchrone : on patiente. */
async function courrielPour(adresse: string): Promise<{ sujet: string; corps: string } | null> {
  for (let essai = 0; essai < 25; essai++) {
    const liste = (await (await fetch(`${COURRIELS}/api/v1/messages`)).json()) as {
      messages?: Message[];
    };
    const entree = (liste.messages ?? []).find((m) =>
      (m.To ?? []).some((t) => t.Address === adresse),
    );
    if (entree) {
      const det = (await (await fetch(`${COURRIELS}/api/v1/message/${entree.ID}`)).json()) as {
        HTML?: string;
        Text?: string;
      };
      return { sujet: entree.Subject, corps: det.HTML ?? det.Text ?? "" };
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return null;
}

const codeDans = (corps: string): string | null =>
  (corps.match(/>\s*(\d{6})\s*</) ?? corps.match(/code[^0-9]{0,20}(\d{6})/i) ?? [])[1] ?? null;

describe("[entrée] le courriel porte un code, et ce code ouvre une porte", () => {
  it("[LE CŒUR] le code ouvre une session sur un client NEUF — sans `code_verifier`", async () => {
    // ⚠️ « CLIENT NEUF » EST TOUT LE TEST. Le client qui vérifie n'est pas celui qui a demandé :
    // il ne porte aucun `code_verifier`. C'est la situation exacte de quelqu'un qui a demandé sur
    // son ordinateur et recopie le code — sauf qu'ici on va plus loin que le produit, puisqu'on
    // vérifie depuis un client qui n'a jamais rien demandé du tout.
    const adresse = `otp-coeur-${Date.now()}@exemple.test`;
    const { error } = await client().auth.signInWithOtp({ email: adresse });
    expect(error, "l'envoi a échoué").toBeNull();

    const courriel = await courrielPour(adresse);
    expect(courriel, "aucun courriel n'est arrivé au collecteur").not.toBeNull();

    const code = codeDans(courriel!.corps);
    expect(code, "le gabarit ne porte aucun code à six chiffres").not.toBeNull();

    const { data, error: e } = await client().auth.verifyOtp({
      email: adresse,
      token: code!,
      type: "email",
    });
    expect(e, "le code n'a pas été accepté").toBeNull();
    expect(data.session, "aucune session rendue — la porte ne s'ouvre pas").toBeTruthy();
    expect(data.user?.email).toBe(adresse);
  }, 20_000);

  it("[LE BORD] un code FAUX ne rend aucune session", async () => {
    const adresse = `otp-faux-${Date.now()}@exemple.test`;
    await client().auth.signInWithOtp({ email: adresse });
    const courriel = await courrielPour(adresse);
    const vrai = codeDans(courriel!.corps)!;
    // Un code voisin, pas un code absurde : on éprouve la comparaison, pas la longueur.
    const faux = String((Number(vrai) + 1) % 1_000_000).padStart(6, "0");
    const { data, error } = await client().auth.verifyOtp({
      email: adresse,
      token: faux,
      type: "email",
    });
    expect(error, "un code faux a été accepté").not.toBeNull();
    expect(data.session).toBeNull();
  }, 20_000);

  it("[LE BORD] un code déjà consommé ne resert pas", async () => {
    const adresse = `otp-usage-${Date.now()}@exemple.test`;
    await client().auth.signInWithOtp({ email: adresse });
    const code = codeDans((await courrielPour(adresse))!.corps)!;
    const premier = await client().auth.verifyOtp({ email: adresse, token: code, type: "email" });
    expect(premier.data.session, "contrôle positif : le premier usage doit marcher").toBeTruthy();
    const second = await client().auth.verifyOtp({ email: adresse, token: code, type: "email" });
    expect(second.error, "le code a resservi").not.toBeNull();
  }, 20_000);

  it("[LE BORD QUI COMPTE] le code d'une adresse n'ouvre pas le compte d'une AUTRE", async () => {
    // C'est la forme que prendrait la fixation de session si l'adresse venait du formulaire.
    const victime = `otp-victime-${Date.now()}@exemple.test`;
    const attaquant = `otp-attaquant-${Date.now()}@exemple.test`;
    await client().auth.signInWithOtp({ email: victime });
    await client().auth.signInWithOtp({ email: attaquant });
    const codeAttaquant = codeDans((await courrielPour(attaquant))!.corps)!;
    const { data, error } = await client().auth.verifyOtp({
      email: victime,
      token: codeAttaquant,
      type: "email",
    });
    expect(error, "le code d'un compte a ouvert un autre compte").not.toBeNull();
    expect(data.session).toBeNull();
  }, 25_000);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LA GARDE DE CÂBLAGE — ce que le comportement ci-dessus ne peut pas voir
// ══════════════════════════════════════════════════════════════════════════════════════════════

const lire = (p: string) => sansCommentaires(readFileSync(p, "utf-8"));

describe("[entrée] l'adresse vérifiée ne vient JAMAIS du formulaire", () => {
  it("[LE CŒUR] `verifyOtp` lit l'adresse du cookie d'attente", () => {
    // Le test de comportement ci-dessus prouve que le mécanisme marche ; il ne peut rien dire de
    // l'endroit d'où l'adresse est tirée. Or c'est ÇA qui distingue cette porte de celle que la
    // revue du 2026-08-13 a condamnée : une adresse fournie par l'appelant ferait vérifier le code
    // de l'attaquant contre la session qu'il désigne.
    const src = lire("app/(auth)/entrer/actions.ts");
    expect(src).toMatch(/verifyOtp\(\{\s*\n?\s*email:\s*attente\.adresse/);
    expect(src, "l'adresse ne doit pas être relue du FormData au moment de vérifier").not.toMatch(
      /verifyOtp\(\{[^}]*formData\.get\(\s*["']email["']/s,
    );
  });

  it("le cookie d'attente est `httpOnly` — sinon un script de page le réécrit", () => {
    const src = lire("app/(auth)/entrer/actions.ts");
    expect(src).toMatch(/httpOnly:\s*true/);
    expect(src).toMatch(/sameSite:\s*"lax"/);
  });

  it("[UNE SEULE MACHINE D'ÉTAT] les deux portes partagent `destinationApresAuth`", () => {
    // Recopier ces sept lignes ferait DEUX machines d'état sur l'onboarding — la barrière de
    // minorité oubliée dans un seul chemin suffit à laisser passer un mineur (leçon 1.4).
    for (const f of ["app/(auth)/entrer/actions.ts", "app/auth/confirm/route.ts"]) {
      expect(lire(f), `${f} n'appelle pas la destination partagée`).toMatch(
        /await destinationApresAuth\(/,
      );
    }
    // Et personne ne réimplémente le routage à côté.
    for (const f of ["app/(auth)/entrer/actions.ts", "app/auth/confirm/route.ts"]) {
      expect(lire(f), `${f} a recopié la machine d'état`).not.toMatch(/etapeOnboardingPour\(/);
    }
  });

  it("le lien magique reste PKCE — la seconde porte n'a rouvert aucun `token_hash`", () => {
    const src = lire("app/auth/confirm/route.ts");
    expect(src).toMatch(/exchangeCodeForSession/);
    expect(src, "le flux retiré en août est revenu").not.toMatch(/token_hash/);
    expect(src, "`verifyOtp` n'a rien à faire dans la route du lien").not.toMatch(/verifyOtp/);
  });

  it("les gabarits portent le code ET le lien — retirer l'un casserait une porte entière", () => {
    for (const g of ["supabase/templates/lien-magique.html", "supabase/templates/confirmation.html"]) {
      const html = readFileSync(g, "utf-8");
      expect(html, `${g} a perdu le code`).toContain("{{ .Token }}");
      expect(html, `${g} a perdu le lien PKCE`).toContain("{{ .ConfirmationURL }}");
      expect(html, `${g} expose un token_hash`).not.toContain("TokenHash");
    }
  });
});
