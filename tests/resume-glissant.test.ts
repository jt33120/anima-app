import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assemblerRappel, type FaitDate } from "@/lib/domain/rappel";

/**
 * Story 4.3 — le RÉCEPTACLE `resume_glissant` (résumé glissant, AD-14) + la LECTURE possédée des faits
 * actifs `charger_faits_rappelables()`. Preuves BLOQUANTES contre un vrai Supabase local — miroir art. 9
 * « possédé sous JWT » de `fait-extrait.test.ts` :
 *  - schéma : `contenu` (art. 9), `utilisatrice_id` unique, `id uuid`, `cree_le`/`maj_le timestamptz` ;
 *  - art. 9 sous JWT (AD-12) : deny-by-default — une AUTRE utilisatrice ne lit rien, une session anonyme non plus ;
 *  - write-gate (AD-13) : écriture refusée sans consentement / sous barrière minorité / après révocation ;
 *    la LECTURE (export) survit à la révocation ;
 *  - [DUR] AC3 côté LECTURE : `charger_faits_rappelables()` ne renvoie QUE les faits VIVANTS (revue Epic 6,
 *    R1 : `corrige` en fait partie — c'est une phrase qu'ELLE a affirmée) — un tombstone
 *    (corrige/supprime) n'entre JAMAIS dans un rappel (mutation-cible : retirer `where statut='actif'`) ;
 *  - effacement FR-067 : le `delete` sous JWT est refusé (aucune policy) ; service_role supprime des lignes.
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientScope = () => createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const t = Date.now();
const MDP = "test-rappel-123!";

/** Consentement art. 9 valide sous la session RLS (même chemin que « Je commence »). */
async function donnerConsentement(c: SupabaseClient, id: string) {
  const { error } = await c.from("consentement").upsert(
    { utilisatrice_id: id, art9_accorde: true, ia_reconnue: true, cgu_acceptees: true, revoked_at: null },
    { onConflict: "utilisatrice_id" },
  );
  if (error) throw new Error(`consentement: ${error.message}`);
}

async function creerUtilisatrice(email: string) {
  const { data, error } = await admin.auth.admin.createUser({ email, password: MDP, email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  return data.user!.id;
}

/** Grave un fait extrait directement (admin) au statut voulu — pour prouver le filtre de lecture. */
async function graverFait(id: string, cle: string, contenu: string, statut: "actif" | "corrige" | "supprime") {
  const origine = statut === "actif" ? "extrait" : "utilisatrice";
  const { error } = await admin.from("fait_extrait").insert({ utilisatrice_id: id, origine, statut, cle_dedoublonnage: cle, contenu });
  if (error) throw new Error(`graverFait: ${error.message}`);
}

describe("resume_glissant — schéma & réceptacle art. 9 (AC4)", () => {
  const u = { email: `rg-schema-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    if (!url || !publishable || !secret) throw new Error("Supabase local requis (URL / PUBLISHABLE / SECRET).");
    u.id = await creerUtilisatrice(u.email);
  });
  afterAll(async () => {
    await admin.from("resume_glissant").delete().eq("utilisatrice_id", u.id);
    if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("colonnes exactes, id uuid, un seul résumé par utilisatrice, cree_le/maj_le timestamptz", async () => {
    const { data, error } = await admin
      .from("resume_glissant")
      .insert({ utilisatrice_id: u.id, contenu: "elle revient souvent sur sa relation à son père" })
      .select()
      .single();
    expect(error).toBeNull();
    expect(String(data!.id)).toMatch(UUID);
    expect(Number.isNaN(new Date(data!.cree_le as string).getTime())).toBe(false);
    expect(Number.isNaN(new Date(data!.maj_le as string).getTime())).toBe(false);

    const colonnes = Object.keys(data!).sort();
    expect(colonnes).toEqual(["contenu", "cree_le", "id", "maj_le", "utilisatrice_id"].sort());
  });

  it("unicité (utilisatrice_id) : deux résumés pour la même utilisatrice → refusé (upsert, un fil courant)", async () => {
    const a = await admin.from("resume_glissant").insert({ utilisatrice_id: u.id, contenu: "un" });
    // (une ligne existe déjà du test précédent — l'insert d'un second doit violer l'unicité)
    expect(a.error).not.toBeNull();
  });
});

describe("resume_glissant — maj_le tenu par la BASE (revue 4.3, D)", () => {
  const u = { email: `rg-majle-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
  });
  afterAll(async () => {
    await admin.from("resume_glissant").delete().eq("utilisatrice_id", u.id);
    if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("maj_le est fixé par le trigger (>= cree_le à l'insert) et BUMPÉ à chaque upsert (jamais l'horloge cliente)", async () => {
    // Insert : le trigger pose maj_le = now() (base autoritaire) ; maj_le >= cree_le garanti.
    const ins = await admin
      .from("resume_glissant")
      .upsert({ utilisatrice_id: u.id, contenu: "v1", maj_le: "2000-01-01T00:00:00Z" }, { onConflict: "utilisatrice_id" })
      .select("cree_le, maj_le")
      .single();
    expect(ins.error).toBeNull();
    // maj_le imposé côté client (2000) est ÉCRASÉ par le trigger → jamais dans le passé.
    expect(new Date(ins.data!.maj_le as string).getTime()).toBeGreaterThan(new Date("2020-01-01").getTime());
    expect(new Date(ins.data!.maj_le as string).getTime()).toBeGreaterThanOrEqual(new Date(ins.data!.cree_le as string).getTime());

    // Rafraîchissement (upsert conflict → update) : maj_le BUMPÉ (le défaut de colonne ne jouerait pas sur l'update).
    await new Promise((r) => setTimeout(r, 10));
    const maj = await admin
      .from("resume_glissant")
      .upsert({ utilisatrice_id: u.id, contenu: "v2" }, { onConflict: "utilisatrice_id" })
      .select("cree_le, maj_le")
      .single();
    expect(new Date(maj.data!.maj_le as string).getTime()).toBeGreaterThan(new Date(ins.data!.maj_le as string).getTime());
  });
});

describe("resume_glissant — art. 9 sous JWT, deny-by-default (AC4)", () => {
  const u1 = { email: `rg-owner-${t}@exemple.fr`, id: "" };
  const u2 = { email: `rg-autre-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    u1.id = await creerUtilisatrice(u1.email);
    u2.id = await creerUtilisatrice(u2.email);
    await admin.from("resume_glissant").insert({ utilisatrice_id: u1.id, contenu: "un résumé privé" });
  });
  afterAll(async () => {
    await admin.from("resume_glissant").delete().eq("utilisatrice_id", u1.id);
    if (u1.id) await admin.auth.admin.deleteUser(u1.id);
    if (u2.id) await admin.auth.admin.deleteUser(u2.id);
  });

  it("une AUTRE utilisatrice ne lit RIEN de mon résumé (RLS)", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u2.email, password: MDP });
    const { data, error } = await c.from("resume_glissant").select("*").eq("utilisatrice_id", u1.id);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0); // masqué : la ligne existe pourtant (deny-by-default)
    await c.auth.signOut();
  });

  it("une session NON authentifiée ne lit rien", async () => {
    const anon = clientScope();
    const { data, error } = await anon.from("resume_glissant").select("*").eq("utilisatrice_id", u1.id);
    expect(error).toBeNull(); // la table existe et répond — pas un faux-vert « table absente »
    expect(data ?? []).toHaveLength(0);
  });
});

describe("resume_glissant — write-gate art. 9 & lecture survivante (AC4)", () => {
  const u = { email: `rg-wg-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
  });
  afterAll(async () => {
    await admin.from("resume_glissant").delete().eq("utilisatrice_id", u.id);
    if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("sans consentement : l'écriture du résumé est REFUSÉE (write-gate durci, AD-13)", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: MDP });
    expect((await c.rpc("a_consenti_art9")).data).toBe(false);
    const { error } = await c.from("resume_glissant").insert({ utilisatrice_id: u.id, contenu: "avant consentement" });
    expect(error).not.toBeNull();
    await c.auth.signOut();
  });

  it("sous barrière minorité : l'écriture est refusée MÊME avec consentement (gabarit 0006/F1)", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: MDP });
    await donnerConsentement(c, u.id);
    await admin.from("utilisatrice").update({ barriere_minorite_le: new Date().toISOString(), echeance_suppression: "2099-01-01" }).eq("id", u.id);
    const { error } = await c.from("resume_glissant").insert({ utilisatrice_id: u.id, contenu: "sous barrière" });
    expect(error).not.toBeNull();
    await admin.from("utilisatrice").update({ barriere_minorite_le: null }).eq("id", u.id);
    await c.auth.signOut();
  });

  it("avec consentement : l'écriture passe ; après révocation, la LECTURE (export) survit mais l'écriture est refusée", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: MDP });
    await donnerConsentement(c, u.id);
    // Écriture OK sous consentement.
    const ok = await c.from("resume_glissant").upsert({ utilisatrice_id: u.id, contenu: "un résumé consenti" }, { onConflict: "utilisatrice_id" });
    expect(ok.error).toBeNull();
    // Révocation art. 9.
    await c.from("consentement").update({ revoked_at: new Date().toISOString() }).eq("utilisatrice_id", u.id).is("revoked_at", null);
    expect((await c.rpc("a_consenti_art9")).data).toBe(false);
    // La LECTURE (export FR-067) survit à la révocation.
    const { data: lu, error: lec } = await c.from("resume_glissant").select("contenu").eq("utilisatrice_id", u.id).single();
    expect(lec).toBeNull();
    expect(lu!.contenu).toBe("un résumé consenti");
    // Rafraîchir le résumé (déposer du contenu art. 9) est REFUSÉ après révocation.
    const maj = await c.from("resume_glissant").update({ contenu: "après révocation" }).eq("utilisatrice_id", u.id);
    expect(maj.error).not.toBeNull();
    await c.auth.signOut();
  });
});

describe("charger_faits_rappelables() — [DUR] AC3 côté lecture : un tombstone n'entre JAMAIS dans un rappel", () => {
  const u = { email: `rg-actifs-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    await graverFait(u.id, `actif-${t}`, "aime la forêt", "actif");
    await graverFait(u.id, `corrige-${t}`, "corrigé par elle", "corrige");
    await graverFait(u.id, `supprime-${t}`, "", "supprime");
  });
  afterAll(async () => {
    await admin.from("fait_extrait").delete().eq("utilisatrice_id", u.id);
    if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  // ⚠️ CE TEST GRAVAIT R1 EN VERT (revue Epic 6). Il exigeait que le fait CORRIGÉ soit exclu du
  // rappel, sous le commentaire « tombstone jamais rappelé » — en rangeant une rectification (art. 16)
  // dans la même catégorie qu'un effacement. Pendant ce temps `charger_faits_retenus` (0056) le
  // montrait à l'écran sous le titre « Ce qu'Anam retient ». Une seule des deux pouvait avoir raison.
  it("[R1] rend le fait CORRIGÉ — et le tombstone, lui, reste dehors (mutation-cible : `statut = 'actif'`)", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: MDP });
    const { data, error } = await c.rpc("charger_faits_rappelables");
    expect(error).toBeNull();
    const cles = (data ?? []).map((f: { cle_dedoublonnage: string }) => f.cle_dedoublonnage);
    expect(cles).toContain(`actif-${t}`);
    expect(cles, "une correction n'est pas une pierre tombale (art. 16)").toContain(`corrige-${t}`);
    expect(cles).not.toContain(`supprime-${t}`);
    // Porte la matière datée (AC2) : cree_le/maj_le présents.
    const actif = (data ?? []).find((f: { cle_dedoublonnage: string }) => f.cle_dedoublonnage === `actif-${t}`);
    expect(Number.isNaN(new Date(actif.cree_le).getTime())).toBe(false);
    await c.auth.signOut();
  });

  it("isolation : ne renvoie que les faits de l'appelante (une autre utilisatrice ne voit pas les miens)", async () => {
    const autre = { email: `rg-actifs-autre-${t}@exemple.fr`, id: "" };
    autre.id = await creerUtilisatrice(autre.email);
    const c = clientScope();
    await c.auth.signInWithPassword({ email: autre.email, password: MDP });
    const { data, error } = await c.rpc("charger_faits_rappelables");
    expect(error).toBeNull();
    const cles = (data ?? []).map((f: { cle_dedoublonnage: string }) => f.cle_dedoublonnage);
    expect(cles).not.toContain(`actif-${t}`); // les faits de u ne fuient pas
    await c.auth.signOut();
    await admin.auth.admin.deleteUser(autre.id);
  });
});

describe("rappel bout-en-bout — le chemin réel (JWT) nourrit assemblerRappel (AC1/AC2/AC3/AC5)", () => {
  const u = { email: `rg-e2e-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
  });
  afterAll(async () => {
    await admin.from("fait_extrait").delete().eq("utilisatrice_id", u.id);
    await admin.from("resume_glissant").delete().eq("utilisatrice_id", u.id);
    if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("résumé + faits actifs datés assemblés ; le tombstone est absent ; l'ordre est daté (le récent d'abord)", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: MDP });
    await donnerConsentement(c, u.id);
    // Écrit le résumé (chemin write réel, sous consentement).
    await c.from("resume_glissant").upsert({ utilisatrice_id: u.id, contenu: "elle revient sur son père" }, { onConflict: "utilisatrice_id" });
    // Sème 2 actifs (dates distinctes) + 1 tombstone (admin, dates contrôlées).
    // Clés uniformes obligatoires en insert par lot (PostgREST) → cree_le sur chaque ligne.
    const semis = await admin.from("fait_extrait").insert([
      { utilisatrice_id: u.id, origine: "extrait", statut: "actif", cle_dedoublonnage: `e2e-recent-${t}`, contenu: "aime la forêt", cree_le: "2026-07-20T00:00:00Z" },
      { utilisatrice_id: u.id, origine: "extrait", statut: "actif", cle_dedoublonnage: `e2e-vieux-${t}`, contenu: "aimait la ville", cree_le: "2026-07-01T00:00:00Z" },
      { utilisatrice_id: u.id, origine: "utilisatrice", statut: "supprime", cle_dedoublonnage: `e2e-mort-${t}`, contenu: "", cree_le: "2026-07-05T00:00:00Z" },
    ]);
    expect(semis.error).toBeNull();

    // Chemin réel : lecture du résumé (select) + des faits actifs (rpc possédée), puis assemblage PUR.
    const resume = (await c.from("resume_glissant").select("contenu").maybeSingle()).data?.contenu ?? null;
    const bruts = (await c.rpc("charger_faits_rappelables")).data ?? [];
    const faits: FaitDate[] = bruts.map((f: { cle_dedoublonnage: string; contenu: string; cree_le: string; maj_le: string }) => ({
      cleDedoublonnage: f.cle_dedoublonnage,
      contenu: f.contenu,
      statut: "actif",
      creeLe: f.cree_le,
      majLe: f.maj_le,
    }));
    const rappel = assemblerRappel({ resume, faits });

    expect(rappel.aDeLaMatiere).toBe(true);
    expect(rappel.resume).toBe("elle revient sur son père");
    const cles = rappel.faits.map((f) => f.cleDedoublonnage);
    expect(cles).toEqual([`e2e-recent-${t}`, `e2e-vieux-${t}`]); // daté décroissant, tombstone absent (AC2/AC3)
    expect(cles).not.toContain(`e2e-mort-${t}`);
    await c.auth.signOut();
  });

  it("sans résumé ni fait actif : le rappel est vide et honnête (AC5, jamais inventé)", async () => {
    const vide = { email: `rg-vide-${t}@exemple.fr`, id: "" };
    vide.id = await creerUtilisatrice(vide.email);
    const c = clientScope();
    await c.auth.signInWithPassword({ email: vide.email, password: MDP });
    const resume = (await c.from("resume_glissant").select("contenu").maybeSingle()).data?.contenu ?? null;
    const bruts = (await c.rpc("charger_faits_rappelables")).data ?? [];
    const rappel = assemblerRappel({ resume, faits: [] });
    expect(bruts).toHaveLength(0);
    expect(rappel).toEqual({ resume: null, faits: [], aDeLaMatiere: false });
    await c.auth.signOut();
    await admin.auth.admin.deleteUser(vide.id);
  });
});

describe("resume_glissant — effacement FR-067 (AC4)", () => {
  const u = { email: `rg-eff-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    await admin.from("resume_glissant").insert({ utilisatrice_id: u.id, contenu: "à effacer" });
  });
  afterAll(async () => {
    await admin.from("resume_glissant").delete().eq("utilisatrice_id", u.id);
    if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("un DELETE sous JWT est refusé (aucune policy delete) ; service_role supprime (siège de l'effacement)", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: MDP });
    await donnerConsentement(c, u.id);
    // Aucune policy delete sous JWT → le delete ne touche AUCUNE ligne (0 supprimée), la ligne demeure.
    await c.from("resume_glissant").delete().eq("utilisatrice_id", u.id);
    const { data: apres } = await admin.from("resume_glissant").select("id").eq("utilisatrice_id", u.id);
    expect((apres ?? []).length).toBe(1); // toujours là (le JWT n'a pas pu supprimer)
    await c.auth.signOut();
    // service_role supprime bien (effacement FR-067, Epic 6).
    const del = await admin.from("resume_glissant").delete().eq("utilisatrice_id", u.id);
    expect(del.error).toBeNull();
    const { data: vide } = await admin.from("resume_glissant").select("id").eq("utilisatrice_id", u.id);
    expect((vide ?? []).length).toBe(0);
  });
});
