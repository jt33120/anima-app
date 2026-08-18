import { describe, it, expect, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { declarerMajorite } from "./_semis";
import { etapeOnboardingPour } from "@/app/(auth)/etat-onboarding";

/**
 * cgu-comptent.test.ts — LE PRODUIT NE S'UTILISE PLUS SANS CONTRAT (revue des Epics 1 à 4).
 *
 * ══ LE DÉFAUT ═══════════════════════════════════════════════════════════════════════════════════
 *
 * L'écran de consentement présente DEUX cases distinctes, et 0004 dit pourquoi : « cgu_acceptees :
 * CGU acceptées + 18 ans confirmé (case DISTINCTE de l'art. 9 — FR-012/NFR-006) ».
 *
 * Or `a_consenti_art9()` exigeait `art9_accorde` et `ia_reconnue`, jamais `cgu_acceptees`. Et
 * `etatConsentement` ne lisait même pas la colonne — elle ne figurait pas dans son `select`.
 *
 * La seule chose qui exigeait les CGU était le `if (!art9 || !cgu)` de la Server Action, c'est-à-dire
 * RIEN pour qui écrit en direct : `authenticated` détient l'INSERT sur `consentement`. Un POST avec
 * `cgu_acceptees: false` passait la policy, ouvrait les quatorze policies art. 9, et l'onboarding
 * laissait entrer dans la scène.
 *
 * **Le produit s'utilisait entièrement sans contrat.** Sixième fois pour cette famille : une garde
 * qui vit dans une Server Action ne garde rien.
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientScope = () =>
  createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();
const MDP = "test-cgu-123!";

async function compte(suffixe: string) {
  const email = `cgu-${suffixe}-${t}@exemple.fr`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: MDP, email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  await declarerMajorite(admin, data.user!.id);
  return { id: data.user!.id, email };
}

const jetables: string[] = [];
afterAll(async () => {
  for (const id of jetables) await admin.auth.admin.deleteUser(id);
});

describe("[revue 1-4] sans les CGU, aucune écriture art. 9", () => {
  it("⚠️ art. 9 accordé + IA reconnue, mais CGU REFUSÉES → le write-gate refuse", async () => {
    const u = await compte("sans");
    jetables.push(u.id);
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: MDP });

    const { error: eCons } = await c.from("consentement").insert({
      utilisatrice_id: u.id,
      art9_accorde: true,
      ia_reconnue: true,
      cgu_acceptees: false,
    });
    expect(eCons, "poser un consentement partiel reste permis — il doit pouvoir se compléter").toBeNull();

    expect((await c.rpc("a_consenti_art9")).data, "consentie art. 9 sans avoir accepté de contrat").toBe(
      false,
    );
    const { error } = await c
      .from("art9_temoin")
      .insert({ utilisatrice_id: u.id, note: "sans contrat" });
    expect(error, "de l'art. 9 écrit par quelqu'un qui n'a accepté aucun contrat").not.toBeNull();
    await c.auth.signOut();
  });

  it("⚠️ et l'ONBOARDING la renvoie sur l'écran de consentement, au lieu de la scène", async () => {
    // Les deux moitiés du correctif, et il en faut deux : la base seule laisserait `etapeOnboarding`
    // rendre « suite » à quelqu'un dont toutes les écritures échouent ensuite en silence.
    const u = await compte("onboarding");
    jetables.push(u.id);
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: MDP });
    await c.from("consentement").insert({
      utilisatrice_id: u.id,
      art9_accorde: true,
      ia_reconnue: true,
      cgu_acceptees: false,
    });
    expect(await etapeOnboardingPour(c, u.id), "entrée dans une pièce où plus rien ne fonctionne").toBe(
      "consentement",
    );
    await c.auth.signOut();
  });

  it("[CONTRÔLE POSITIF] les TROIS cases → la scène s'ouvre et l'art. 9 s'écrit", async () => {
    // Une garde qui barre tout le monde est une panne. Le chemin nominal doit rester intact.
    const u = await compte("complet");
    jetables.push(u.id);
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: MDP });
    await c.from("consentement").insert({
      utilisatrice_id: u.id,
      art9_accorde: true,
      ia_reconnue: true,
      cgu_acceptees: true,
    });
    expect((await c.rpc("a_consenti_art9")).data).toBe(true);
    expect(await etapeOnboardingPour(c, u.id)).toBe("suite");
    const { error } = await c.from("art9_temoin").insert({ utilisatrice_id: u.id, note: "consentie" });
    expect(error).toBeNull();
    await c.auth.signOut();
  });

  it("compléter les CGU après coup débloque — un consentement partiel doit pouvoir se finir", async () => {
    const u = await compte("complete");
    jetables.push(u.id);
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: MDP });
    await c.from("consentement").insert({
      utilisatrice_id: u.id,
      art9_accorde: true,
      ia_reconnue: true,
      cgu_acceptees: false,
    });
    const { error } = await c
      .from("consentement")
      .update({ cgu_acceptees: true })
      .eq("utilisatrice_id", u.id);
    expect(error).toBeNull();
    expect((await c.rpc("a_consenti_art9")).data).toBe(true);
    await c.auth.signOut();
  });
});

describe("[revue 1-4] les DEUX dérivations du consentement disent la même chose", () => {
  /**
   * `eligible_au_periodique` réécrit les conditions de `a_consenti_art9` pour l'ordonnanceur, qui n'a
   * pas d'`auth.uid()`. 0029 le signalait déjà : « leurs prédicats sont donc réécrits ici ; un test
   * compare les deux chemins pour qu'ils ne divergent pas ». Sur les CGU, ils divergeaient — les deux,
   * dans le même sens, mais c'est un hasard : rien ne les tenait ensemble.
   */
  it("⚠️ sans les CGU, l'ordonnanceur ne travaille pas non plus pour elle", async () => {
    const u = await compte("periodique");
    jetables.push(u.id);
    await admin.from("consentement").insert({
      utilisatrice_id: u.id,
      art9_accorde: true,
      ia_reconnue: true,
      cgu_acceptees: false,
    });
    await admin
      .from("abonnement")
      .insert({ utilisatrice_id: u.id, etat: "actif", source_maj_le: new Date().toISOString() });
    const { data } = await admin.rpc("eligible_au_periodique", { p_utilisatrice: u.id });
    expect(data, "une synthèse hebdomadaire produite pour quelqu'un sans contrat").toBe(false);
  });

  it("[CONTRÔLE POSITIF] avec les trois cases, elle redevient éligible au périodique", async () => {
    const u = await compte("periodique-ok");
    jetables.push(u.id);
    await admin.from("consentement").insert({
      utilisatrice_id: u.id,
      art9_accorde: true,
      ia_reconnue: true,
      cgu_acceptees: true,
    });
    await admin
      .from("abonnement")
      .insert({ utilisatrice_id: u.id, etat: "actif", source_maj_le: new Date().toISOString() });
    expect((await admin.rpc("eligible_au_periodique", { p_utilisatrice: u.id })).data).toBe(true);
  });

  it("les deux fonctions citent LES MÊMES quatre drapeaux — la divergence se voit dans la migration", () => {
    // ⚠️ CE QUI RESTE QUAND UNE RÈGLE DOIT VIVRE À DEUX ENDROITS. `eligible_au_periodique` ne peut
    // pas appeler `a_consenti_art9` : celle-ci lit `auth.uid()`, et l'ordonnanceur n'a pas de
    // session. La duplication est donc STRUCTURELLE, pas paresseuse — et c'est exactement le genre
    // de duplication qui finit par diverger sans que rien ne le dise (leçon R1).
    //
    // Les deux corps vivent dans la MÊME migration, côte à côte, précisément pour qu'on les lise
    // ensemble. Ce test relit ce texte. Il ne remplace pas les deux scénarios ci-dessus — il
    // attrape le cas qu'aucun d'eux ne verrait : un cinquième drapeau ajouté d'un seul côté.
    const migration = readFileSync(
      resolve(process.cwd(), "supabase/migrations/0072_les_cgu_comptent_aussi.sql"),
      "utf-8",
    );
    const corps = (nom: string) => {
      const i = migration.indexOf(`create or replace function public.${nom}`);
      expect(i, `${nom} a disparu de 0072`).toBeGreaterThan(-1);
      return migration.slice(i, migration.indexOf("$$;", i));
    };
    const a = corps("a_consenti_art9");
    const b = corps("eligible_au_periodique");
    for (const drapeau of ["art9_accorde", "ia_reconnue", "cgu_acceptees", "revoked_at"]) {
      expect(a, `a_consenti_art9 ne cite pas ${drapeau}`).toContain(drapeau);
      expect(b, `eligible_au_periodique ne cite pas ${drapeau}`).toContain(drapeau);
    }
  });
});
