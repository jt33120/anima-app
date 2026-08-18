import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { declarerMajorite } from "./_semis";

/**
 * Story 4.1 — la table `entree_journal` (journal brut, AD-8 couche 1). Preuves BLOQUANTES contre un
 * vrai Supabase local — miroir art. 9 « possédé sous JWT » de `write-gate-art9.test.ts` :
 *  - schéma : verbatim exact (`contenu`), `id uuid` STABLE (extrait_source AC5), `cree_le timestamptz`, colonnes exactes ;
 *  - art. 9 sous JWT (AD-12) : deny-by-default — une AUTRE utilisatrice ne lit rien, une session anonyme non plus ;
 *  - write-gate (AD-13) : insertion refusée sans consentement, refusée après révocation, LECTURE (export) encore permise ;
 *  - append-only immuable (AD-8/AC2) : `update` refusé (trigger — même `service_role`), `delete` courant sous JWT sans effet ;
 *    seul `service_role` (moteur d'effacement FR-067, Epic 6) supprime des lignes ;
 *  - idempotence par tour LOGIQUE (AC4/AC1) : même `(cle_tour, role)` réémis = UNE entrée, verbatim d'ORIGINE préservé.
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientScope = () => createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const t = Date.now();

/** Consentement art. 9 valide sous la session RLS (même chemin que « Je commence »). */
async function donnerConsentement(c: SupabaseClient, id: string) {
  const { error } = await c.from("consentement").upsert(
    { utilisatrice_id: id, art9_accorde: true, ia_reconnue: true, cgu_acceptees: true, revoked_at: null },
    { onConflict: "utilisatrice_id" },
  );
  if (error) throw new Error(`consentement: ${error.message}`);
}

async function creerUtilisatrice(email: string) {
  const { data, error } = await admin.auth.admin.createUser({ email, password: "test-journal-123!", email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  await declarerMajorite(admin, data.user!.id);
  return data.user!.id;
}

describe("entree_journal — schéma, verbatim & id stable (AC1/AC5)", () => {
  const u = { email: `ej-schema-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    if (!url || !publishable || !secret) throw new Error("Supabase local requis (URL / PUBLISHABLE / SECRET).");
    u.id = await creerUtilisatrice(u.email);
  });
  afterAll(async () => {
    await admin.from("entree_journal").delete().eq("utilisatrice_id", u.id);
    if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("insertion sous JWT : verbatim EXACT, id uuid, cree_le, colonnes exactes, role par défaut", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: "test-journal-123!" });
    await donnerConsentement(c, u.id);

    // Verbatim volontairement « piégé » (apostrophes courbes, guillemets, saut de ligne) : rien ne doit bouger.
    const verbatim = "j'ai dit : « ça » — et rien\nn'a changé.";
    const { data, error } = await c
      .from("entree_journal")
      .insert({ utilisatrice_id: u.id, cle_tour: `tour-${t}`, contenu: verbatim })
      .select()
      .single();
    expect(error).toBeNull();
    expect(data!.contenu).toBe(verbatim); // mot pour mot, aucune transformation (AC1)
    expect(String(data!.id)).toMatch(UUID); // extrait_source stable (AC5)
    expect(Number.isNaN(new Date(data!.cree_le as string).getTime())).toBe(false); // timestamptz UTC
    expect(data!.role).toBe("utilisatrice"); // défaut

    const colonnes = Object.keys(data!).sort();
    expect(colonnes).toEqual(["cle_tour", "contenu", "cree_le", "id", "role", "utilisatrice_id"].sort());
    await c.auth.signOut();
  });
});

describe("entree_journal — art. 9 sous JWT, deny-by-default (AC3)", () => {
  const u1 = { email: `ej-owner-${t}@exemple.fr`, id: "" };
  const u2 = { email: `ej-autre-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    u1.id = await creerUtilisatrice(u1.email);
    u2.id = await creerUtilisatrice(u2.email);
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u1.email, password: "test-journal-123!" });
    await donnerConsentement(c, u1.id);
    await c.from("entree_journal").insert({ utilisatrice_id: u1.id, cle_tour: `tour-iso-${t}`, contenu: "une confidence" });
    await c.auth.signOut();
  });
  afterAll(async () => {
    await admin.from("entree_journal").delete().eq("utilisatrice_id", u1.id);
    if (u1.id) await admin.auth.admin.deleteUser(u1.id);
    if (u2.id) await admin.auth.admin.deleteUser(u2.id);
  });

  it("une AUTRE utilisatrice ne lit RIEN de mon journal (RLS)", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u2.email, password: "test-journal-123!" });
    const { data, error } = await c.from("entree_journal").select("*").eq("utilisatrice_id", u1.id);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0); // masqué : la ligne existe pourtant (deny-by-default)
    await c.auth.signOut();
  });

  it("une session NON authentifiée ne lit rien", async () => {
    const anon = clientScope();
    const { data } = await anon.from("entree_journal").select("*").eq("utilisatrice_id", u1.id);
    expect(data ?? []).toHaveLength(0);
  });
});

describe("entree_journal — write-gate art. 9 : cycle de vie du consentement (AC3)", () => {
  const u = { email: `ej-wg-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
  });
  afterAll(async () => {
    await admin.from("entree_journal").delete().eq("utilisatrice_id", u.id);
    if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("AC1 — sans consentement : l'insertion journal est REFUSÉE par la base", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: "test-journal-123!" });
    const { data: consenti } = await c.rpc("a_consenti_art9");
    expect(consenti).toBe(false);
    const { error } = await c.from("entree_journal").insert({ utilisatrice_id: u.id, cle_tour: `t1-${t}`, contenu: "avant consentement" });
    expect(error).not.toBeNull();
    await c.auth.signOut();
  });

  it("AC2 — avec consentement valide : l'insertion est AUTORISÉE", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: "test-journal-123!" });
    await donnerConsentement(c, u.id);
    const { error } = await c.from("entree_journal").insert({ utilisatrice_id: u.id, cle_tour: `t2-${t}`, contenu: "une pensée" });
    expect(error).toBeNull();
    await c.auth.signOut();
  });

  it("AC3 — après révocation : insertion REFUSÉE, mais LECTURE (export) encore permise", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: "test-journal-123!" });
    await c.from("consentement").update({ revoked_at: new Date().toISOString() }).eq("utilisatrice_id", u.id).is("revoked_at", null);
    expect((await c.rpc("a_consenti_art9")).data).toBe(false);

    const { error: ins } = await c.from("entree_journal").insert({ utilisatrice_id: u.id, cle_tour: `t3-${t}`, contenu: "après révocation" });
    expect(ins).not.toBeNull(); // écriture refusée

    const { data: lignes, error: lec } = await c.from("entree_journal").select("id, contenu").eq("utilisatrice_id", u.id);
    expect(lec).toBeNull();
    expect(lignes?.length).toBe(1); // la pensée écrite en AC2 reste exportable (droit d'accès)
    await c.auth.signOut();
  });
});

describe("entree_journal — append-only immuable (AC2)", () => {
  const u = { email: `ej-append-${t}@exemple.fr`, id: "" };
  const cle = `tour-append-${t}`;

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: "test-journal-123!" });
    await donnerConsentement(c, u.id);
    await c.from("entree_journal").insert({ utilisatrice_id: u.id, cle_tour: cle, contenu: "verbatim d'origine" });
    await c.auth.signOut();
  });
  afterAll(async () => {
    await admin.from("entree_journal").delete().eq("utilisatrice_id", u.id);
    if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("update sous JWT ne modifie rien (append-only ; aucune policy update)", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: "test-journal-123!" });
    await c.from("entree_journal").update({ contenu: "réécrit par l'utilisatrice" }).eq("cle_tour", cle);
    await c.auth.signOut();
    const { data } = await admin.from("entree_journal").select("contenu").eq("cle_tour", cle).single();
    expect(data!.contenu).toBe("verbatim d'origine"); // inchangé
  });

  it("update service_role est REFUSÉ (immuabilité dure — trigger, AD-8)", async () => {
    const { error } = await admin.from("entree_journal").update({ contenu: "réécrit par le système" }).eq("cle_tour", cle);
    expect(error).not.toBeNull(); // le trigger lève, même pour service_role (que la RLS ne borne pas)
    const { data } = await admin.from("entree_journal").select("contenu").eq("cle_tour", cle).single();
    expect(data!.contenu).toBe("verbatim d'origine");
  });

  it("delete sous JWT ne supprime rien (append-only courant ; aucune policy delete)", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: "test-journal-123!" });
    await c.from("entree_journal").delete().eq("cle_tour", cle);
    await c.auth.signOut();
    const { data } = await admin.from("entree_journal").select("id").eq("cle_tour", cle);
    expect(data?.length).toBe(1); // toujours là
  });

  it("delete service_role RÉUSSIT (siège de l'effacement FR-067, Epic 6)", async () => {
    const { error } = await admin.from("entree_journal").delete().eq("cle_tour", cle);
    expect(error).toBeNull();
    const { data } = await admin.from("entree_journal").select("id").eq("cle_tour", cle);
    expect(data?.length).toBe(0); // supprimée
  });
});

describe("entree_journal — idempotence & inaltérabilité du verbatim (AC4/AC1/AC5)", () => {
  const u = { email: `ej-idem-${t}@exemple.fr`, id: "" };
  const kA = `idem-A-${t}`;
  const kB = `idem-B-${t}`;

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
  });
  afterAll(async () => {
    await admin.from("entree_journal").delete().eq("utilisatrice_id", u.id);
    if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("même (cle_tour, role) réémis avec un contenu DIFFÉRENT → UNE entrée, verbatim d'ORIGINE préservé", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: "test-journal-123!" });
    await donnerConsentement(c, u.id);

    const opts = { onConflict: "utilisatrice_id,cle_tour,role", ignoreDuplicates: true } as const;
    await c.from("entree_journal").upsert({ utilisatrice_id: u.id, cle_tour: kA, role: "utilisatrice", contenu: "original" }, opts);
    // Réémission (retry / retour réseau) : même jeton, contenu ré-tapé différent → doit être IGNORÉE.
    await c.from("entree_journal").upsert({ utilisatrice_id: u.id, cle_tour: kA, role: "utilisatrice", contenu: "modifié" }, opts);

    const { data } = await c.from("entree_journal").select("id, contenu").eq("cle_tour", kA);
    expect(data?.length).toBe(1); // exactement une entrée
    expect(data![0].contenu).toBe("original"); // le premier verbatim tient (inaltérable)
    await c.auth.signOut();
  });

  it("cle_tour différent → deux entrées ; le côté 'anam' (écrit SERVEUR) partage le jeton sans conflit", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: "test-journal-123!" });
    const opts = { onConflict: "utilisatrice_id,cle_tour,role", ignoreDuplicates: true } as const;
    await c.from("entree_journal").upsert({ utilisatrice_id: u.id, cle_tour: kB, role: "utilisatrice", contenu: "un autre tour" }, opts);
    await c.auth.signOut();
    // Le côté « anam » est server-authoritative (revue 4.1, F2) → écrit via service_role, JAMAIS sous JWT.
    // La colonne `role` posée dès 4.1 permet aux deux côtés de partager le jeton (2ᵉ ligne, pas un conflit).
    await admin.from("entree_journal").insert({ utilisatrice_id: u.id, cle_tour: kA, role: "anam", contenu: "réponse d'Anam" });

    const { data: tous } = await admin.from("entree_journal").select("id").eq("utilisatrice_id", u.id);
    expect(tous?.length).toBe(3); // kA/utilisatrice + kB/utilisatrice + kA/anam
    const { data: paireKA } = await admin.from("entree_journal").select("role").eq("cle_tour", kA);
    expect(paireKA?.length).toBe(2); // utilisatrice + anam partagent le jeton
  });
});

describe("entree_journal — write-gate durci : rôle épinglé + barrière minorité (revue 4.1, F1/F2)", () => {
  const u = { email: `ej-durci-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
  });
  afterAll(async () => {
    await admin.from("entree_journal").delete().eq("utilisatrice_id", u.id);
    if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("F2 — une utilisatrice ne peut PAS forger un tour 'anam' sous son JWT (moindre privilège)", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: "test-journal-123!" });
    await donnerConsentement(c, u.id); // consentement VALIDE → seule la contrainte de rôle doit bloquer
    const { error } = await c
      .from("entree_journal")
      .insert({ utilisatrice_id: u.id, cle_tour: `forge-${t}`, role: "anam", contenu: "fausse parole d'Anam" });
    expect(error).not.toBeNull(); // la policy épingle role='utilisatrice' — le côté 'anam' est server-authoritative
    // …tandis que SON propre côté 'utilisatrice' reste autorisé (le consentement est là).
    const { error: okUser } = await c
      .from("entree_journal")
      .insert({ utilisatrice_id: u.id, cle_tour: `ok-${t}`, role: "utilisatrice", contenu: "mes mots à moi" });
    expect(okUser).toBeNull();
    await c.auth.signOut();
  });

  it("F1 — sous barrière de minorité, l'écriture est refusée MÊME avec consentement (gabarit 0006)", async () => {
    // Poser la barrière côté système (comme appliquer_barriere_minorite) → est_barre_minorite() = true.
    await admin
      .from("utilisatrice")
      .update({ barriere_minorite_le: new Date().toISOString(), echeance_suppression: "2099-01-01" })
      .eq("id", u.id);
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: "test-journal-123!" });
    const { error } = await c
      .from("entree_journal")
      .insert({ utilisatrice_id: u.id, cle_tour: `mineur-${t}`, role: "utilisatrice", contenu: "un tour sous barrière" });
    expect(error).not.toBeNull(); // `and not est_barre_minorite()` — plus aucune écriture sous barrière (0006)
    await c.auth.signOut();
    await admin.from("utilisatrice").update({ barriere_minorite_le: null }).eq("id", u.id); // nettoyage
  });
});
