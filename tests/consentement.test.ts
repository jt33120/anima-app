import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { accordsComplets } from "@/app/(auth)/consentement/accords";
import { etapeOnboardingPour } from "@/app/(auth)/etat-onboarding";
import { declarerMajorite } from "./_semis";

/**
 * Story 1.5 — halte de consentement art. 9. Preuves BLOQUANTES en CI :
 *  - AC5 : la preuve de consentement s'écrit sous l'identité (RLS), horodatée, non révoquée ;
 *          impossible d'écrire pour une autre (with check) ni de lire celui d'une autre.
 *  - AC6 : la suppression du compte retire l'utilisatrice ET son consentement (cascade).
 *  - AC7 : aucune table de contenu art. 9 n'existe encore (le write-gate est la Story 1.6).
 *
 * On crée les comptes avec un mot de passe UNIQUEMENT dans ce test, pour minter des
 * sessions scopées. L'application, elle, reste sans mot de passe (FR-073).
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const clientScope = () =>
  createClient(url, publishable, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

const t = Date.now();
const users = [
  { email: `cons-a-${t}@exemple.fr`, password: "test-cons-A-123!", id: "" },
  { email: `cons-b-${t}@exemple.fr`, password: "test-cons-B-123!", id: "" },
];

describe("Consentement — preuve écrite sous RLS (AC5)", () => {
  beforeAll(async () => {
    for (const u of users) {
      const { data, error } = await admin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
      });
      if (error) throw new Error(`createUser: ${error.message}`);
      // 0066 : la majorité doit être POSITIVEMENT établie pour consentir à l'art. 9. Ce banc teste la
      // PREUVE de consentement, pas le seuil d'âge ; il pose l'adulte que `/naissance` aurait posée.
      await declarerMajorite(admin, data.user!.id);
      u.id = data.user!.id;
    }
  });

  afterAll(async () => {
    for (const u of users) if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("écrit une ligne de consentement horodatée, sous SON identité, non révoquée (upsert idempotent)", async () => {
    const [a] = users;
    const c = clientScope();
    const { error: sign } = await c.auth.signInWithPassword({
      email: a.email,
      password: a.password,
    });
    expect(sign).toBeNull();

    // Même chemin que la Server Action « Je commence » : upsert sous la session RLS.
    const ligne = {
      utilisatrice_id: a.id,
      art9_accorde: true,
      ia_reconnue: true,
      cgu_acceptees: true,
    };
    const { error } = await c
      .from("consentement")
      .upsert(ligne, { onConflict: "utilisatrice_id" });
    expect(error).toBeNull();

    const { data } = await c
      .from("consentement")
      .select("art9_accorde, ia_reconnue, cgu_acceptees, cree_le, revoked_at")
      .eq("utilisatrice_id", a.id)
      .single();
    expect(data?.art9_accorde).toBe(true);
    expect(data?.ia_reconnue).toBe(true);
    expect(data?.cgu_acceptees).toBe(true);
    expect(data?.cree_le).toBeTruthy(); // horodaté
    expect(data?.revoked_at).toBeNull(); // révocation = Story 1.6

    // Idempotence : un second « Je commence » ne casse pas et ne duplique pas.
    const { error: err2 } = await c
      .from("consentement")
      .upsert(ligne, { onConflict: "utilisatrice_id" });
    expect(err2).toBeNull();
    const { data: apres } = await c.from("consentement").select("utilisatrice_id").eq("utilisatrice_id", a.id);
    expect(apres?.length).toBe(1);
    await c.auth.signOut();
  });

  it("ne peut PAS écrire un consentement au nom d'une autre (with check RLS)", async () => {
    const [a, b] = users;
    const c = clientScope();
    await c.auth.signInWithPassword({ email: a.email, password: a.password });
    const { error } = await c.from("consentement").insert({
      utilisatrice_id: b.id, // usurpation
      art9_accorde: true,
      ia_reconnue: true,
      cgu_acceptees: true,
    });
    expect(error).not.toBeNull(); // la RLS with check refuse
    await c.auth.signOut();
  });

  it("ne peut PAS lire le consentement d'une autre (RLS masque)", async () => {
    const [a, b] = users;
    // b consent — préparé via admin (contourne la RLS pour poser la donnée).
    await admin.from("consentement").upsert(
      { utilisatrice_id: b.id, art9_accorde: true, ia_reconnue: true, cgu_acceptees: true },
      { onConflict: "utilisatrice_id" },
    );
    const c = clientScope();
    await c.auth.signInWithPassword({ email: a.email, password: a.password });
    const { data } = await c
      .from("consentement")
      .select("utilisatrice_id")
      .eq("utilisatrice_id", b.id);
    expect(data?.length).toBe(0); // invisible
    await c.auth.signOut();
  });
});

describe("Refus → suppression immédiate du compte (AC6)", () => {
  it("supprimer le compte retire l'utilisatrice ET son consentement (cascade)", async () => {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: `cons-del-${t}@exemple.fr`,
      password: "test-del-123!",
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    const id = created.user!.id;

    await admin.from("consentement").upsert(
      { utilisatrice_id: id, art9_accorde: true, ia_reconnue: true, cgu_acceptees: true },
      { onConflict: "utilisatrice_id" },
    );
    const avant = await admin.from("utilisatrice").select("id").eq("id", id);
    expect(avant.data?.length).toBe(1);

    const { error: del } = await admin.auth.admin.deleteUser(id);
    expect(del).toBeNull();

    const u = await admin.from("utilisatrice").select("id").eq("id", id);
    expect(u.data?.length).toBe(0); // cascade auth.users → utilisatrice
    const cons = await admin.from("consentement").select("utilisatrice_id").eq("utilisatrice_id", id);
    expect(cons.data?.length).toBe(0); // cascade utilisatrice → consentement
  });
});

describe("Frontière art. 9 : le gabarit du write-gate + la première table de contenu (AC7 / AD-4 / FR-072)", () => {
  // Le write-gate art. 9 est posé (Story 1.6) : le gabarit `art9_temoin` existe et est gardé (prouvé
  // dans write-gate-art9.test.ts). La PREMIÈRE table de contenu VERBATIM — `entree_journal` (Story 4.1) —
  // existe désormais et copie le gabarit COURANT (append-only, RLS propriétaire sous JWT + write-gate
  // a_consenti_art9 + not est_barre_minorite + role épinglé ; comportement prouvé dans entree-journal.test.ts).
  // NB : `seance` (2.7) existe mais ne porte AUCUN verbatim (signaux structurés, server-authoritative) → hors liste.
  // La couche 2 — `fait_extrait` (Story 4.2) — existe désormais (profil vivant, corrigeable/supprimable, RLS
  // sous JWT + write-gate durci ; anti-résurrection AD-18 ; comportement prouvé dans fait-extrait.test.ts).
  // Le RÉSUMÉ GLISSANT — `resume_glissant` (Story 4.3) — existe désormais (état condensé de la conversation,
  // art. 9 possédé sous JWT + write-gate durci ; AD-14 ; comportement prouvé dans resume-glissant.test.ts).
  // Le SIGNAL DE RECONCEPTUALISATION — `signal_reconceptualisation` (Story 4.4) — existe désormais (art. 9
  // possédé sous JWT, POINTEUR-SEUL vers l'entrée exacte, aucun verbatim ; write-gate durci + garde AD-17 au
  // point d'écriture ; comportement prouvé dans signal-reconceptualisation.test.ts).
  // Le JOURNAL DE TIRAGE — `tirage` (Story 5.7) — existe désormais. Il ne porte AUCUN verbatim (une clé
  // de carte, un mot de 32 bits, une taille de jeu), mais il porte le write-gate art. 9 quand même : le
  // tirage OUVRE un rituel dont la suite immédiate — « qu'est-ce que tu vois ? » — recueille de l'art. 9.
  // On garde la porte, pas la pièce. Il porte EN PLUS la garde de détresse (AD-17), que ni `entree_journal`
  // ni `theme_natal` ne portent — justifié dans l'en-tête de 0050 ; comportement prouvé dans
  // tirage-sql.test.ts.
  const tablesContenuAVenir = ["socle"]; // couches de contenu restantes, pas encore livrées
  it("le gabarit `art9_temoin` existe (sonde vivante du write-gate)", async () => {
    const { error } = await admin.from("art9_temoin").select("*").limit(1);
    expect(error).toBeNull();
  });
  it("la première table de contenu art. 9 `entree_journal` existe désormais (Story 4.1)", async () => {
    const { error } = await admin.from("entree_journal").select("*").limit(1);
    expect(error).toBeNull();
  });
  it("la couche 2 de contenu art. 9 `fait_extrait` existe désormais (Story 4.2)", async () => {
    const { error } = await admin.from("fait_extrait").select("*").limit(1);
    expect(error).toBeNull();
  });
  it("le résumé glissant art. 9 `resume_glissant` existe désormais (Story 4.3)", async () => {
    const { error } = await admin.from("resume_glissant").select("*").limit(1);
    expect(error).toBeNull();
  });
  it("le signal de reconceptualisation art. 9 `signal_reconceptualisation` existe désormais (Story 4.4)", async () => {
    const { error } = await admin.from("signal_reconceptualisation").select("*").limit(1);
    expect(error).toBeNull();
  });
  it("la troisième couche de contenu art. 9 `branche` existe désormais (Story 4.5)", async () => {
    const { error } = await admin.from("branche").select("*").limit(1);
    expect(error).toBeNull();
  });
  it("`branche` est write-gatée art. 9 sur les DEUX chemins d'écriture : INSERT et UPDATE (Story 4.6)", async () => {
    // Sonde COMPORTEMENTALE de la frontière art. 9 (tâche T6, jamais réalisée avant la revue) : le renommage
    // est un dépôt de contenu art. 9 NEUF (le nom) — il doit tomber avec le consentement, comme la naissance.
    const email = `sonde-branche-${t}@exemple.fr`;
    const mdp = "test-sonde-123!";
    const { data: cree } = await admin.auth.admin.createUser({ email, password: mdp, email_confirm: true });
    const id = cree!.user!.id;
    try {
      const c = clientScope();
      await c.auth.signInWithPassword({ email, password: mdp });
      await c.from("consentement").upsert(
        { utilisatrice_id: id, art9_accorde: true, ia_reconnue: true, cgu_acceptees: true, revoked_at: null },
        { onConflict: "utilisatrice_id" },
      );
      const { data: e } = await admin
        .from("entree_journal")
        .insert({ utilisatrice_id: id, cle_tour: `sonde-${t}`, role: "utilisatrice", contenu: "un tour" })
        .select("id")
        .single();
      const { data: b } = await admin
        .from("branche")
        .insert({ utilisatrice_id: id, extrait_source_id: e!.id, nom: "avant révocation" })
        .select("id")
        .single();

      // Consentement RÉVOQUÉ → plus aucune écriture de contenu art. 9 sur `branche`, dans les deux sens.
      await c.from("consentement").update({ revoked_at: new Date().toISOString() }).eq("utilisatrice_id", id);
      const renommage = await c.from("branche").update({ nom: "après révocation" }).eq("id", b!.id);
      expect(renommage.error, "UPDATE (renommage) : dépôt de contenu art. 9 → refusé sans consentement").not.toBeNull();
      const { data: e2 } = await admin
        .from("entree_journal")
        .insert({ utilisatrice_id: id, cle_tour: `sonde2-${t}`, role: "utilisatrice", contenu: "un autre tour" })
        .select("id")
        .single();
      const naissance = await c.from("branche").insert({ utilisatrice_id: id, extrait_source_id: e2!.id, nom: "née après" });
      expect(naissance.error, "INSERT (naissance) : refusé sans consentement").not.toBeNull();

      // La LECTURE, elle, survit à la révocation (export FR-067) — contrôle négatif du gate.
      const lecture = await c.from("branche").select("id").eq("utilisatrice_id", id);
      expect(lecture.error, "lire ses propres branches reste possible après révocation").toBeNull();
      await c.auth.signOut();
    } finally {
      await admin.from("branche").delete().eq("utilisatrice_id", id);
      await admin.from("entree_journal").delete().eq("utilisatrice_id", id);
      await admin.auth.admin.deleteUser(id);
    }
  });
  it("les couches de contenu art. 9 restantes n'existent pas encore", async () => {
    for (const table of tablesContenuAVenir) {
      const { error } = await admin.from(table).select("*").limit(1);
      expect(error, `la table de contenu art. 9 « ${table} » ne devrait pas exister avant son epic`).not.toBeNull();
    }
  });
});

describe("Re-validation serveur des accords (AC5) — logique pure, couverte en CI", () => {
  const fd = (o: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(o)) f.set(k, v);
    return f;
  };
  it("les deux accords cochés → valide", () => {
    expect(accordsComplets(fd({ art9: "on", cgu: "on" }))).toBe(true);
  });
  it("un seul accord → refusé", () => {
    expect(accordsComplets(fd({ art9: "on" }))).toBe(false);
    expect(accordsComplets(fd({ cgu: "on" }))).toBe(false);
  });
  it("valeur autre que 'on' ou champ absent → refusé (pas de faux positif)", () => {
    expect(accordsComplets(fd({ art9: "true", cgu: "true" }))).toBe(false);
    expect(accordsComplets(fd({}))).toBe(false);
  });
});

describe("La garde exige art9_accorde=true, pas la simple existence d'une ligne (revue 1.5)", () => {
  const u = { email: `cons-art9-${t}@exemple.fr`, password: "test-art9-123!", id: "" };

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    });
    if (error) throw new Error(`createUser: ${error.message}`);
    u.id = data.user!.id;
    // Majeure, date posée : sinon la garde s'arrête AVANT l'étape consentement.
    const { error: e2 } = await admin
      .from("utilisatrice")
      .update({ date_naissance: "1990-01-01" })
      .eq("id", u.id);
    if (e2) throw new Error(`date_naissance: ${e2.message}`);
  });

  afterAll(async () => {
    if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("une ligne art9_accorde=false NE débloque PAS la scène → étape 'consentement'", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: u.password });
    const { error } = await c.from("consentement").upsert(
      { utilisatrice_id: u.id, art9_accorde: false, ia_reconnue: false, cgu_acceptees: false },
      { onConflict: "utilisatrice_id" },
    );
    expect(error).toBeNull();
    expect(await etapeOnboardingPour(c, u.id)).toBe("consentement");
    await c.auth.signOut();
  });

  it("art9_accorde=true + ia_reconnue=true → étape 'suite' (scène débloquée)", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: u.password });
    const { error } = await c.from("consentement").upsert(
      { utilisatrice_id: u.id, art9_accorde: true, ia_reconnue: true, cgu_acceptees: true },
      { onConflict: "utilisatrice_id" },
    );
    expect(error).toBeNull();
    expect(await etapeOnboardingPour(c, u.id)).toBe("suite");
    await c.auth.signOut();
  });
});

/**
 * Story 5.5 (décision D12) — LE LIBELLÉ DOIT NOMMER CE QU'ANAM DÉDUIT.
 *
 * ⚠️ POURQUOI CETTE GARDE EXISTE ALORS QUE LA GARDE TECHNIQUE EST DÉJÀ VERTE. `a_consenti_art9()`
 * ne vérifie qu'un booléen : elle rendra `true` et laissera écrire un type d'ennéagramme même si le
 * libellé ne mentionne que ce qu'elle PARTAGE. La conformité aurait alors l'air acquise — et c'est
 * exactement le mode d'échec que FR-072 vise, une case cochée sur une phrase qui ne couvre pas.
 *
 * Un type d'ennéagramme n'est pas partagé : il est PRODUIT par un score ou INFÉRÉ par un modèle.
 * L'amont l'a qualifié (« profil psychologique … catégories de données sensibles »,
 * `addendum.md:133`). Seul le LIBELLÉ peut rattraper ce que la 5.5 ajoute.
 *
 * Garde de SOURCE, assumée comme telle : elle prouve que la phrase est là, jamais qu'elle est
 * comprise. Ce qu'elle empêche, c'est la régression silencieuse — quelqu'un qui « resserre » la
 * copie et retire l'ajout sans savoir ce qu'il portait.
 */
describe("[5.5/D12] la copie de consentement couvre la DÉDUCTION, pas seulement le partage", () => {
  const lireSource = (chemin: string) =>
    readFileSync(resolve(__dirname, "..", chemin), "utf8");
  const CASE_ART9 = "app/(auth)/consentement/formulaire-consentement.tsx";
  const ECRAN = "app/(auth)/consentement/page.tsx";

  it("[LE CŒUR] la case art. 9 nomme ce qu'Anam DÉDUIT", () => {
    // Mutation-cible : revenir à « ce que je partage sur mon intériorité, mes croyances, mon vécu ».
    // Rien d'autre dans la suite ne rougirait, et la 5.5 écrirait une catégorie art. 9 que le
    // consentement ne nomme pas.
    const source = lireSource(CASE_ART9);
    const label = source.match(/Je consens à ce qu[\s\S]*?<\/span>/)?.[0] ?? "";
    expect(label, "extraction TRONQUÉE — la garde ne prouverait rien").toContain("article");
    expect(label).toMatch(/déduit/);
  });

  it("[CONTRÔLE] …sans avoir REMPLACÉ ce qu'elle partage", () => {
    // Sans ce contrôle, une copie qui ne parlerait QUE de déduction satisferait le test ci-dessus —
    // et le consentement ne couvrirait plus le verbatim du journal, qui est le gros du traitement.
    const label = lireSource(CASE_ART9).match(/Je consens à ce qu[\s\S]*?<\/span>/)?.[0] ?? "";
    expect(label).toMatch(/partage/);
    expect(label).toMatch(/intériorité/);
  });

  it("le détail dit que ces déductions se CORRIGENT et s'EFFACENT", () => {
    // Une déduction qu'on ne peut pas défaire n'est plus une hypothèse, c'est un verdict — et le
    // produit entier tient sur l'inverse (FR-006).
    const detail = lireSource(ECRAN);
    expect(detail).toMatch(/déduit/);
    expect(detail).toMatch(/corriger/);
    expect(detail).toMatch(/effacer/);
  });
});
