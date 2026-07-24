import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

// Preuve de l'invariant AD-12 : RLS deny-by-default.
// Requiert un Supabase LOCAL (`supabase start`) et les clés en env.
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable =
  process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;

describe("RLS deny-by-default (AD-12)", () => {
  beforeAll(() => {
    if (!url || !publishable || !secret) {
      throw new Error(
        "Supabase local requis. Lance `supabase start`, puis exporte " +
          "SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY (voir `supabase status`).",
      );
    }
  });

  it("une clé publishable ne voit AUCUNE ligne d'une table RLS sans policy, alors que la ligne existe", async () => {
    // La clé secret contourne la RLS : on insère une ligne réelle.
    const admin = createClient(url!, secret!, { auth: { persistSession: false } });
    const inserted = await admin.from("probe").insert({ secret: "top-secret" }).select();
    expect(inserted.error).toBeNull();
    expect(inserted.data?.length).toBe(1);

    // La clé publishable est soumise à la RLS : deny-by-default => 0 ligne visible (masqué, pas d'erreur).
    const anonClient = createClient(url!, publishable!, { auth: { persistSession: false } });
    const seen = await anonClient.from("probe").select("*");
    expect(seen.error).toBeNull();
    expect(seen.data).toEqual([]);

    // et la clé publishable ne peut pas écrire non plus.
    const write = await anonClient.from("probe").insert({ secret: "intrus" });
    expect(write.error).not.toBeNull();
  });

  it("art9_temoin (table art. 9 gardée) : une clé publishable non authentifiée ne lit ni n'écrit — fermée par défaut", async () => {
    const anonClient = createClient(url!, publishable!, { auth: { persistSession: false } });
    // Lecture : le USING (auth.uid() = utilisatrice_id) masque tout pour un non-authentifié.
    const seen = await anonClient.from("art9_temoin").select("*");
    expect(seen.error).toBeNull();
    expect(seen.data).toEqual([]);
    // Écriture : refusée — ni identité, ni consentement (write-gate AD-13).
    const write = await anonClient
      .from("art9_temoin")
      .insert({ utilisatrice_id: "00000000-0000-0000-0000-000000000000", note: "intrus" });
    expect(write.error).not.toBeNull();
  });
});
