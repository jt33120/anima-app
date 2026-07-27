import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { envoyerSousEgressArt9 } from "@/lib/ai/egress-guard";
import type { AiPort, RequeteIa } from "@/lib/ai/port";

/**
 * Story 2.1 — l'egress-guard art. 9 (AD-13, AC4). Preuves BLOQUANTES contre un vrai Supabase local :
 *  - consentement valide + ZDR prouvé → l'envoi PROCÈDE (positif, non tautologique) ;
 *  - ZDR non prouvé → BLOQUÉ, adaptateur JAMAIS appelé ;
 *  - révocation en vol → BLOQUÉ raison consentement, rien posté ;
 *  - contenu non-art. 9 → court-circuite (pas de contrôle consentement).
 *
 * L'adaptateur-espion compte ses appels : on prouve qu'un blocage ne poste réellement rien.
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientScope = () =>
  createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();
const requete: RequeteIa = {
  capacite: "echange",
  messages: [{ role: "user", content: "bonjour" }],
  contientArt9: true,
};

function espion(zdr: boolean) {
  const etat = { appels: 0 };
  const port: AiPort = {
    estZdrProuve: () => zdr,
    completer: async () => {
      etat.appels++;
      return { texte: "ok", tier: "leger", modele: "m", usage: { tokensEntree: 0, tokensSortie: 0 } };
    },
  };
  return { port, etat };
}

describe("Egress-guard art. 9 (AD-13, AC4)", () => {
  const u = { email: `eg-${t}@exemple.fr`, password: "test-eg-123!", id: "" };

  beforeAll(async () => {
    if (!url || !publishable || !secret) {
      throw new Error("Supabase local requis (SUPABASE_URL / PUBLISHABLE_KEY / SECRET_KEY).");
    }
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    });
    if (error) throw new Error(`createUser: ${error.message}`);
    u.id = data.user!.id;
  });

  afterAll(async () => {
    if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("consentement valide + ZDR prouvé → l'envoi PROCÈDE (positif)", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: u.password });
    await c.from("consentement").upsert(
      { utilisatrice_id: u.id, art9_accorde: true, ia_reconnue: true, cgu_acceptees: true, revoked_at: null },
      { onConflict: "utilisatrice_id" },
    );

    const { port, etat } = espion(true);
    const r = await envoyerSousEgressArt9({ supabase: c, adaptateur: port, requete });
    expect(r.bloque).toBe(false);
    expect(etat.appels).toBe(1);
    await c.auth.signOut();
  });

  it("ZDR NON prouvé → BLOQUÉ (raison zdr), adaptateur jamais appelé (négatif)", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: u.password });
    const { port, etat } = espion(false);
    const r = await envoyerSousEgressArt9({ supabase: c, adaptateur: port, requete });
    expect(r).toEqual({ bloque: true, raison: "zdr" });
    expect(etat.appels).toBe(0);
    await c.auth.signOut();
  });

  it("révocation en vol → BLOQUÉ (raison consentement), rien posté (négatif)", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: u.password });
    await c
      .from("consentement")
      .update({ revoked_at: new Date().toISOString() })
      .eq("utilisatrice_id", u.id)
      .is("revoked_at", null);

    const { port, etat } = espion(true);
    const r = await envoyerSousEgressArt9({ supabase: c, adaptateur: port, requete });
    expect(r).toEqual({ bloque: true, raison: "consentement" });
    expect(etat.appels).toBe(0);
    await c.auth.signOut();
  });

  it("contenu NON-art. 9 → passe sans contrôle consentement", async () => {
    const c = clientScope(); // pas besoin d'auth : contientArt9 false court-circuite
    const { port, etat } = espion(true);
    const r = await envoyerSousEgressArt9({
      supabase: c,
      adaptateur: port,
      requete: { ...requete, contientArt9: false },
    });
    expect(r.bloque).toBe(false);
    expect(etat.appels).toBe(1);
  });
});
