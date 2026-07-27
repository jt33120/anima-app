import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { diffuserSousEgressArt9 } from "@/lib/ai/egress-guard";
import type { AiPort, EvenementIa, RequeteIa } from "@/lib/ai/port";

/**
 * Story 2.2 — l'egress-guard art. 9 sur le FLUX (`diffuserSousEgressArt9`, AC4, AD-13). Preuves
 * BLOQUANTES contre un vrai Supabase local, miroir exact de `egress-guard.test.ts` (completer) :
 *  - consentement valide + ZDR prouvé → le flux PROCÈDE (deltas émis) ;
 *  - ZDR non prouvé → BLOQUÉ, adaptateur JAMAIS diffusé (zéro delta) ;
 *  - révocation en vol → BLOQUÉ (consentement), rien diffusé ;
 *  - barrière de minorité (consentement valide, compte suspendu) → BLOQUÉ (minorite) ;
 *  - contenu non-art. 9 → court-circuite.
 *
 * L'adaptateur-espion compte ses `diffuser` : un blocage doit se produire AVANT tout octet.
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
  const etat = { diffusions: 0 };
  const port: AiPort = {
    estZdrProuve: () => zdr,
    completer: async () => ({ texte: "ok", tier: "leger", modele: "m", usage: { tokensEntree: 0, tokensSortie: 0 } }),
    async *diffuser(): AsyncIterable<EvenementIa> {
      etat.diffusions++;
      yield { type: "delta", texte: "ok " };
      yield { type: "fin", tier: "leger", modele: "m", usage: { tokensEntree: 0, tokensSortie: 0 } };
    },
  };
  return { port, etat };
}

async function consommer(flux: AsyncIterable<EvenementIa>): Promise<number> {
  const evts: EvenementIa[] = [];
  for await (const e of flux) evts.push(e);
  return evts.length;
}

describe("Egress-guard sur le flux art. 9 (diffuserSousEgressArt9, AD-13, AC4)", () => {
  const u = { email: `fe-${t}@exemple.fr`, password: "test-fe-123!", id: "" };

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

  it("consentement valide + ZDR prouvé → le flux PROCÈDE (positif)", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: u.password });
    await c.from("consentement").upsert(
      { utilisatrice_id: u.id, art9_accorde: true, ia_reconnue: true, cgu_acceptees: true, revoked_at: null },
      { onConflict: "utilisatrice_id" },
    );

    const { port, etat } = espion(true);
    const r = await diffuserSousEgressArt9({ supabase: c, adaptateur: port, requete });
    expect(r.bloque).toBe(false);
    if (!r.bloque) {
      const n = await consommer(r.flux);
      expect(n).toBeGreaterThan(0); // deltas + fin
    }
    expect(etat.diffusions).toBe(1);
    await c.auth.signOut();
  });

  it("ZDR NON prouvé → BLOQUÉ (raison zdr), adaptateur jamais diffusé (négatif)", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: u.password });
    const { port, etat } = espion(false);
    const r = await diffuserSousEgressArt9({ supabase: c, adaptateur: port, requete });
    expect(r).toEqual({ bloque: true, raison: "zdr" });
    expect(etat.diffusions).toBe(0);
    await c.auth.signOut();
  });

  it("révocation en vol → BLOQUÉ (consentement), rien diffusé (négatif)", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: u.password });
    await c
      .from("consentement")
      .update({ revoked_at: new Date().toISOString() })
      .eq("utilisatrice_id", u.id)
      .is("revoked_at", null);

    const { port, etat } = espion(true);
    const r = await diffuserSousEgressArt9({ supabase: c, adaptateur: port, requete });
    expect(r).toEqual({ bloque: true, raison: "consentement" });
    expect(etat.diffusions).toBe(0);
    await c.auth.signOut();
  });

  it("barrière de minorité (consentement VALIDE, compte suspendu) → BLOQUÉ (minorite)", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: u.password });
    await c.from("consentement").upsert(
      { utilisatrice_id: u.id, art9_accorde: true, ia_reconnue: true, cgu_acceptees: true, revoked_at: null },
      { onConflict: "utilisatrice_id" },
    );
    await admin
      .from("utilisatrice")
      .update({ barriere_minorite_le: new Date().toISOString(), echeance_suppression: "2099-01-01" })
      .eq("id", u.id);

    const { port, etat } = espion(true);
    const r = await diffuserSousEgressArt9({ supabase: c, adaptateur: port, requete });
    expect(r).toEqual({ bloque: true, raison: "minorite" });
    expect(etat.diffusions).toBe(0);
    await c.auth.signOut();
  });

  it("contenu NON-art. 9 → court-circuite (pas de contrôle consentement/barrière)", async () => {
    const c = clientScope();
    const { port, etat } = espion(true);
    const r = await diffuserSousEgressArt9({
      supabase: c,
      adaptateur: port,
      requete: { ...requete, contientArt9: false },
    });
    expect(r.bloque).toBe(false);
    if (!r.bloque) await consommer(r.flux);
    expect(etat.diffusions).toBe(1);
  });
});
