import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { reposerConsentement } from "./_rig-consentement";
import { envoyerSousEgressArt9 } from "@/lib/ai/egress-guard";
import type { AiPort, EvenementIa, RequeteIa } from "@/lib/ai/port";

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
    // Requis par le contrat AiPort depuis la 2.2 ; non exercé par ces tests (chemin completer).
    async *diffuser(): AsyncIterable<EvenementIa> {
      throw new Error("non utilisé dans egress-guard.test.ts (voir flux-anam-egress.test.ts)");
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

  it("barrière de minorité (consentement VALIDE mais compte suspendu) → BLOQUÉ raison minorite (négatif)", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: u.password });
    // Consentement de nouveau valide (le test précédent l'avait révoqué) → on prouve que c'est
    // bien la BARRIÈRE, pas le consentement, qui bloque (non tautologique).
    // ⚠️ Par le RIG, pas par la session : depuis 0041 une révocation ne se défait pas (S2). Ce
    // `upsert` sous JWT réussissait avant, en silence — et s'il avait échoué, le test serait resté
    // vert POUR LA MAUVAISE RAISON (bloqué par le consentement, pas par la barrière).
    await reposerConsentement(admin, u.id);
    // Suspension minorité posée côté système (comme appliquer_barriere_minorite).
    await admin
      .from("utilisatrice")
      .update({ barriere_minorite_le: new Date().toISOString(), echeance_suppression: "2099-01-01" })
      .eq("id", u.id);

    const { port, etat } = espion(true);
    const r = await envoyerSousEgressArt9({ supabase: c, adaptateur: port, requete });
    expect(r).toEqual({ bloque: true, raison: "minorite" });
    expect(etat.appels).toBe(0); // rien posté
    await c.auth.signOut();
  });

  it("contenu NON-art. 9 → passe sans contrôle consentement/barrière", async () => {
    // Compte non authentifié + barré au test précédent : contientArt9 false doit tout court-circuiter.
    const c = clientScope();
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
