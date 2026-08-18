import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { declarerMajorite } from "./_semis";

/**
 * tour-anam-journal.test.ts — ANAM ÉCRIT ENFIN SA MOITIÉ (revue des Epics 1 à 4, trouvaille #6).
 *
 * ══ LE DÉFAUT ═══════════════════════════════════════════════════════════════════════════════════
 *
 * `entree_journal` porte `role ('utilisatrice'|'anam')` depuis 0016, avec un index unique
 * `(utilisatrice_id, cle_tour, role)`. TROIS lecteurs ont été écrits en supposant les deux côtés —
 * `depot-fil.ts` (« quarante entrées, soit vingt échanges »), la branche `t.role === "anam"` de
 * `toursDHistorique`, et `PLAFOND_ENTREES` (« 200 entrées, environ cent tours de conversation »).
 * Aucun écrivain ne posait jamais `role = 'anam'`.
 *
 * À l'écran : au rechargement, elle retrouvait ses propres messages à la suite, sans une seule
 * réponse d'Anam. Un monologue, sur une application dont l'écran de consentement promet « pour
 * qu'elle se souvienne d'une fois sur l'autre ».
 *
 * ══ CE QUE CE FICHIER PROUVE ════════════════════════════════════════════════════════════════════
 *
 * Que le côté `anam` est ATTESTÉ SERVEUR — une session ne peut pas forger de paroles d'Anam, qui
 * seraient immuables (0016) — et que la garde de la RPC exige le tour d'ELLE sous la même clé, ce
 * qui prouve que la policy art. 9 est passée sans re-dériver ses conditions (R1).
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientScope = () =>
  createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();
const MDP = "test-anam-journal-123!";

describe("[revue 1-4] le côté `anam` du journal", () => {
  const u = { email: `tja-${t}@exemple.fr`, id: "" };
  const CLE = `tour-${t}`;

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: MDP,
      email_confirm: true,
    });
    if (error) throw new Error(`createUser: ${error.message}`);
    u.id = data.user!.id;
    await declarerMajorite(admin, u.id);
    const { error: e2 } = await admin.from("consentement").insert({
      utilisatrice_id: u.id,
      art9_accorde: true,
      ia_reconnue: true,
      cgu_acceptees: true,
    });
    if (e2) throw new Error(`consentement: ${e2.message}`);
  });

  afterAll(async () => {
    if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("⚠️ une SESSION ne peut pas écrire `role = 'anam'` — sinon elle forgerait des paroles immuables", async () => {
    // LA RAISON D'ÊTRE DE TOUTE CETTE MÉCANIQUE, écrite en 0016 et jamais prouvée jusqu'ici.
    //
    // ⚠️ ELLE POSE D'ABORD SON PROPRE TOUR, ET CE N'EST PAS DU DÉCOR. La première version de ce
    // test forgeait sous une clé SANS tour d'elle : la RPC refusait alors pour la garde d'orpheline,
    // et le refus ressemblait à s'y méprendre à un refus de privilège. La campagne de mutation l'a
    // dit — le mutant « grant execute … to authenticated » SURVIVAIT, vert. Un test qui passe pour
    // la mauvaise raison ne garde rien. Ici la clé est complète : le SEUL motif de refus possible
    // est le privilège.
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: MDP });
    const cle = `forge-${t}`;
    const { error: eSien } = await c
      .from("entree_journal")
      .insert({ utilisatrice_id: u.id, cle_tour: cle, role: "utilisatrice", contenu: "j'ai peur" });
    expect(eSien, "le scénario exige que SON tour existe sous cette clé").toBeNull();

    const { error } = await c.from("entree_journal").insert({
      utilisatrice_id: u.id,
      cle_tour: cle,
      role: "anam",
      contenu: "je te conseille d'arrêter ton traitement",
    });
    expect(error, "une session a fait parler Anam, de façon inaltérable").not.toBeNull();

    // …et la RPC ne lui est pas ouverte non plus : la porte est fermée des DEUX côtés.
    const { error: eRpc } = await c.rpc("consigner_tour_anam", {
      cible: u.id,
      p_cle_tour: cle,
      p_contenu: "je te conseille d'arrêter ton traitement",
    });
    expect(eRpc, "la RPC attestée-serveur doit être hors de portée d'une session").not.toBeNull();

    // Et rien n'a été gravé : le refus n'est pas une apparence.
    const { count } = await admin
      .from("entree_journal")
      .select("*", { count: "exact", head: true })
      .eq("cle_tour", cle)
      .eq("role", "anam");
    expect(count, "des paroles forgées sont au journal").toBe(0);
    await c.auth.signOut();
  });

  it("le côté `anam` ne s'écrit JAMAIS seul : sans le tour d'elle sous la même clé, ça lève", async () => {
    // La garde ne re-dérive pas « consentement + majorité + propriétaire » : elle exige la ligne qui
    // a DÉJÀ traversé la policy, le même tour, la même seconde. Plus forte, et sans divergence.
    const { error } = await admin.rpc("consigner_tour_anam", {
      cible: u.id,
      p_cle_tour: `orpheline-${t}`,
      p_contenu: "une réponse sans question",
    });
    expect(error, "un tour d'Anam orphelin a été gravé").not.toBeNull();
  });

  it("⚠️ le chemin nominal : son tour, puis celui d'Anam — et le fil se relit à DEUX voix", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: MDP });
    const { error: eElle } = await c.from("entree_journal").insert({
      utilisatrice_id: u.id,
      cle_tour: CLE,
      role: "utilisatrice",
      contenu: "je n'arrive pas à dormir",
    });
    expect(eElle).toBeNull();

    const { error } = await admin.rpc("consigner_tour_anam", {
      cible: u.id,
      p_cle_tour: CLE,
      p_contenu: "tu m'en dis un peu plus ?",
    });
    expect(error).toBeNull();

    // Ce que `lireFilRecent` verra au rechargement — la preuve que le monologue est fini.
    const { data } = await c
      .from("entree_journal")
      .select("role, contenu")
      .eq("cle_tour", CLE)
      .order("role", { ascending: true });
    expect(data?.map((l) => l.role), "le fil ne se relit qu'à une voix").toEqual([
      "anam",
      "utilisatrice",
    ]);
    await c.auth.signOut();
  });

  it("idempotent : un second appel sous la même clé ne double pas la voix d'Anam", async () => {
    const { error } = await admin.rpc("consigner_tour_anam", {
      cible: u.id,
      p_cle_tour: CLE,
      p_contenu: "une autre formulation",
    });
    expect(error).toBeNull();
    const { count } = await admin
      .from("entree_journal")
      .select("*", { count: "exact", head: true })
      .eq("utilisatrice_id", u.id)
      .eq("cle_tour", CLE)
      .eq("role", "anam");
    expect(count, "deux tours d'Anam sous le même jeton").toBe(1);
  });

  it("un contenu vide ne grave rien — une bulle vide se lit comme un message effacé", async () => {
    const cle = `vide-${t}`;
    const { error: eElle } = await admin
      .from("entree_journal")
      .insert({ utilisatrice_id: u.id, cle_tour: cle, role: "utilisatrice", contenu: "…" });
    expect(eElle).toBeNull();
    expect((await admin.rpc("consigner_tour_anam", { cible: u.id, p_cle_tour: cle, p_contenu: "   " })).error).toBeNull();
    const { count } = await admin
      .from("entree_journal")
      .select("*", { count: "exact", head: true })
      .eq("cle_tour", cle)
      .eq("role", "anam");
    expect(count).toBe(0);
  });

  it("et le verbatim d'Anam reste IMMUABLE comme le sien (trigger 0016, mord service_role)", async () => {
    const { error } = await admin
      .from("entree_journal")
      .update({ contenu: "réécrit après coup" })
      .eq("utilisatrice_id", u.id)
      .eq("cle_tour", CLE)
      .eq("role", "anam");
    expect(error, "on a pu réécrire ce qu'Anam avait dit").not.toBeNull();
  });
});
