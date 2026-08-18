import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  DELAI_SUPPRESSION_MINORITE_JOURS,
  echeanceSuppression,
} from "@/lib/safety/barriere-minorite";
import { appliquerBarriereMinorite } from "@/lib/safety/appliquer-barriere";
import { etapeOnboarding } from "@/app/(auth)/onboarding";
import { etapeOnboardingPour } from "@/app/(auth)/etat-onboarding";
import { declarerMajorite } from "./_semis";

/**
 * Story 1.9 — appliquer la barrière de minorité détectée (FR-071, AD-14, AD-9, AD-13).
 * Preuves : le domaine pur (durée/échéance), la barrière AU NIVEAU BASE (write-gate qui se
 * referme même avec consentement valide, lecture encore ouverte pour l'export, idempotence,
 * audit sans art. 9), l'anti-divergence (la barrière est routée dans les 7 sites de garde) et
 * l'écran halte (sans traceur, sans rouge/alerte, 3018 en tête, jamais signé d'Anam).
 */

const racine = process.cwd();

// ── Bloc DOMAINE PUR (aucune I/O) ──────────────────────────────────────────────────────────
describe("Barrière de minorité — domaine pur (délai + échéance, AC3)", () => {
  it("la durée de suppression est le paramètre unique (30 jours, FR-071)", () => {
    expect(DELAI_SUPPRESSION_MINORITE_JOURS).toBe(30);
  });

  it("l'échéance = maintenant + 30 jours, en date UTC YYYY-MM-DD", () => {
    expect(echeanceSuppression(new Date("2026-07-27T12:00:00Z"))).toBe("2026-08-26");
  });

  it("elle traverse correctement une frontière de mois/année", () => {
    expect(echeanceSuppression(new Date("2026-12-20T00:00:00Z"))).toBe("2027-01-19");
  });

  it("elle ne dépend pas de l'heure de la journée (borne stable)", () => {
    expect(echeanceSuppression(new Date("2026-07-27T23:59:59Z"))).toBe("2026-08-26");
  });
});

// ── Bloc DÉCISION PURE (machine à états) ─────────────────────────────────────────────────────
describe("Barrière de minorité — la suspension prime sur tout (machine à états, AC1)", () => {
  it("'barre' gagne même si mineur_detecte est aussi vrai", () => {
    expect(
      etapeOnboarding(
        { date_naissance: null, mineur_detecte: true, barriere_minorite_le: "2026-07-27T00:00:00Z" },
        "aucun",
      ),
    ).toBe("barre");
  });

  it("'barre' gagne sur une utilisatrice par ailleurs en règle (consentement valide)", () => {
    expect(
      etapeOnboarding(
        { date_naissance: "1990-01-01", mineur_detecte: false, barriere_minorite_le: "2026-07-27T00:00:00Z" },
        "valide",
      ),
    ).toBe("barre");
  });

  it("sans barrière, l'état reste inchangé (non-régression : 'suite')", () => {
    expect(
      etapeOnboarding(
        { date_naissance: "1990-01-01", mineur_detecte: false, barriere_minorite_le: null },
        "valide",
      ),
    ).toBe("suite");
  });
});

// ── Bloc BASE (SQL réel contre Supabase local) ───────────────────────────────────────────────
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

describe("Barrière de minorité — application EN BASE (AC1/AC3/AC4)", () => {
  const u = { email: `bm-${t}@exemple.fr`, password: "test-bm-123!", id: "" };
  const echeanceAttendue = echeanceSuppression();

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    });
    if (error) throw new Error(`createUser: ${error.message}`);
    u.id = data.user!.id;
    // Adulte CONSENTANTE (le scénario 1.9 : minorité détectée APRÈS coup sur un compte consenti).
    // Setup via admin (bypass RLS) : date posée + consentement valide.
    const { error: eDate } = await admin
      .from("utilisatrice")
      .update({ date_naissance: "1990-01-01" })
      .eq("id", u.id);
    if (eDate) throw new Error(`date_naissance: ${eDate.message}`);
    const { error: eCons } = await admin.from("consentement").upsert(
      { utilisatrice_id: u.id, art9_accorde: true, ia_reconnue: true, cgu_acceptees: true, revoked_at: null },
      { onConflict: "utilisatrice_id" },
    );
    if (eCons) throw new Error(`consentement: ${eCons.message}`);
  });

  afterAll(async () => {
    if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("AVANT la barrière : un compte consentant PEUT écrire (le write-gate n'a pas cassé)", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: u.password });
    const { error } = await c
      .from("art9_temoin")
      .insert({ utilisatrice_id: u.id, note: "avant barrière" });
    expect(error).toBeNull(); // non-régression de la policy re-créée en 0006
    await c.auth.signOut();
  });

  it("l'application est ATOMIQUE + IDEMPOTENTE : échéance stable, un seul audit (AC3)", async () => {
    // 1re application = injection du drapeau (ce que fera le classifieur serveur en Epic 2).
    const { error: e1 } = await admin.rpc("appliquer_barriere_minorite", {
      cible: u.id,
      echeance: echeanceAttendue,
    });
    expect(e1).toBeNull();
    // 2e application : idempotente — ne doit RIEN réécrire ni ré-auditer.
    await admin.rpc("appliquer_barriere_minorite", { cible: u.id, echeance: "2099-01-01" });

    const { data: ligne } = await admin
      .from("utilisatrice")
      .select("barriere_minorite_le, echeance_suppression")
      .eq("id", u.id)
      .single();
    expect(ligne!.barriere_minorite_le).not.toBeNull();
    expect(ligne!.echeance_suppression).toBe(echeanceAttendue); // AC3 : +30 j, PAS écrasée par le 2e appel

    const { data: audits } = await admin
      .from("audit_securite")
      .select("type, decision")
      .eq("utilisatrice_id", u.id);
    expect(audits!.length).toBe(1); // un seul enregistrement (pas de ré-audit)
    expect(audits![0]).toMatchObject({ type: "minorite", decision: "barriere_appliquee" });
  });

  it("APRÈS la barrière : l'écriture est REFUSÉE même avec un consentement valide (AC1)", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: u.password });

    const { data: barree } = await c.rpc("est_barre_minorite");
    expect(barree).toBe(true);
    const { data: consenti } = await c.rpc("a_consenti_art9");
    expect(consenti).toBe(true); // le consentement est TOUJOURS valide…

    const { error } = await c
      .from("art9_temoin")
      .insert({ utilisatrice_id: u.id, note: "après barrière" });
    expect(error).not.toBeNull(); // …mais la barrière referme le write-gate au niveau base

    await c.auth.signOut();
  });

  it("APRÈS la barrière : la LECTURE reste ouverte au propriétaire (export possible, AC3)", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: u.password });
    const { data, error } = await c
      .from("art9_temoin")
      .select("id, note")
      .eq("utilisatrice_id", u.id);
    expect(error).toBeNull();
    expect(data!.length).toBe(1); // la note écrite AVANT la barrière reste exportable
    await c.auth.signOut();
  });

  it("l'utilisatrice suspendue est routée par l'état 'barre' (source unique)", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: u.password });
    expect(await etapeOnboardingPour(c, u.id)).toBe("barre");
    await c.auth.signOut();
  });

  it("l'audit n'est PAS lisible sous RLS par l'utilisatrice (sans art. 9, système-only — AC4)", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u.email, password: u.password });
    const { data } = await c.from("audit_securite").select("*").eq("utilisatrice_id", u.id);
    expect(data ?? []).toHaveLength(0); // RLS sans policy → deny-by-default
    await c.auth.signOut();
  });
});

describe("est_barre_minorite — pas d'oracle inter-utilisatrices (revue 1.6/1.9)", () => {
  const autre = { email: `bm2-${t}@exemple.fr`, password: "test-bm2-123!", id: "" };
  const victime = { email: `bm2v-${t}@exemple.fr`, password: "test-bm2v-123!", id: "" };

  beforeAll(async () => {
    for (const u of [autre, victime]) {
      const { data, error } = await admin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
      });
      if (error) throw new Error(`createUser: ${error.message}`);
      u.id = data.user!.id;
      // ⚠️ LES DEUX SONT DES ADULTES ÉTABLIES (migration 0066), et ça RENFORCE ce test.
      // Sans date, `est_barre_minorite()` rend désormais vrai pour tout le monde — le test aurait
      // été vrai pour la mauvaise raison. En déclarant la majorité des deux, la SEULE différence
      // entre elles devient la barrière elle-même : c'est exactement ce que ce bloc veut isoler.
      await declarerMajorite(admin, u.id);
    }
    // Condition DISCRIMINANTE : une utilisatrice EST suspendue AU MOMENT du test (sinon le test
    // ne prouve que « compte vierge → false », quasi tautologique — revue 1.9).
    const { error } = await admin.rpc("appliquer_barriere_minorite", {
      cible: victime.id,
      echeance: echeanceSuppression(),
    });
    if (error) throw new Error(`appliquer (victime): ${error.message}`);
  });
  afterAll(async () => {
    for (const u of [autre, victime]) if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("une session NON suspendue obtient false ALORS QU'une autre utilisatrice EST suspendue", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: autre.email, password: autre.password });
    const { data: barree } = await c.rpc("est_barre_minorite");
    expect(barree).toBe(false); // 'autre' ne voit PAS l'état de 'victime' → prédicat keyé sur auth.uid()
    await c.auth.signOut();
  });

  it("la suspendue, elle, obtient true (le prédicat lit bien SON propre état)", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: victime.email, password: victime.password });
    const { data: barree } = await c.rpc("est_barre_minorite");
    expect(barree).toBe(true);
    await c.auth.signOut();
  });
});

// ── Bloc ANTI-DIVERGENCE (lecture de fichiers — le risque n°1 : un site de garde oublié) ─────
describe("Anti-divergence — la barrière est routée dans TOUS les sites de garde (leçon 1.4)", () => {
  // Commentaires RETIRÉS avant de matcher (le mot « /barriere » y apparaît → matcher le fichier
  // brut rendait la garde tautologique, revue 1.9) ET on LIE condition→destination sur UNE regex :
  // muter la destination du redirect (ex. /entrer?refus=age) fait alors ÉCHOUER le test.
  const sansCommentaires = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const ROUTE_BARRE = /etape === "barre"\)\s*(?:redirect\("\/barriere"\)|return "\/barriere")/;

  const SITES = [
    "app/page.tsx",
    "app/auth/confirm/route.ts",
    "app/(auth)/consentement/actions.ts",
    "app/(auth)/consentement/page.tsx",
    "app/(auth)/consentement/revoque/page.tsx",
    "app/(auth)/consentement/revoquer/page.tsx",
    "app/(auth)/naissance/page.tsx",
  ];

  for (const f of SITES) {
    it(`${f} route 'barre' vers /barriere (condition ET destination LIÉES)`, () => {
      const src = sansCommentaires(readFileSync(resolve(racine, f), "utf-8"));
      expect(src, `${f} : la garde 'barre'→/barriere manque ou pointe ailleurs`).toMatch(ROUTE_BARRE);
    });
  }

  it("consentement/actions.ts lie 'barre'→/barriere dans SES DEUX actions (donner + revoquer)", () => {
    const src = sansCommentaires(
      readFileSync(resolve(racine, "app/(auth)/consentement/actions.ts"), "utf-8"),
    );
    const n = (src.match(new RegExp(ROUTE_BARRE.source, "g")) ?? []).length;
    expect(n).toBeGreaterThanOrEqual(2);
  });
});

// ── Bloc ÉCRAN (lecture de fichiers — halte non alarmante, AC2/AC4) ──────────────────────────
describe("Écran /barriere — halte non alarmante, sans traceur, jamais signée d'Anam (AC2/AC4)", () => {
  // On teste ce qui est PEINT/RENDU, pas les commentaires (retirés avant de matcher, comme en 1.8).
  const sansCommentaires = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const page = readFileSync(resolve(racine, "app/barriere/page.tsx"), "utf-8");
  const pageRendu = sansCommentaires(page);
  const cssRendu = sansCommentaires(readFileSync(resolve(racine, "app/barriere/barriere.module.css"), "utf-8"));

  it("aucun traceur / analytics (NFR-002)", () => {
    expect(pageRendu).not.toMatch(/analytics|gtag|mixpanel|posthog|plausible/i);
  });

  it("aucune sémantique d'alerte : ni --alerte, ni rouge, ni modale, ni role=alert (AD-9)", () => {
    expect(cssRendu).not.toMatch(/--alerte/);
    expect(cssRendu).not.toMatch(/\bred\b|crimson|#[fF]{2}0{4}\b/);
    expect(pageRendu).not.toMatch(/role="alert"|role="dialog"|<dialog/);
  });

  it("oriente vers le 3018 EN TÊTE, en lien tel: et énoncé chiffre par chiffre", () => {
    expect(page).toContain("3018");
    expect(page).toMatch(/tel:\$\{r\.tel\}/);
    expect(page).toMatch(/aria-label=\{`\$\{r\.service\}, \$\{r\.aria\}`\}/);
    // 3018 précède 119 dans la liste (en tête, epics L529).
    expect(page.indexOf('"3018"')).toBeGreaterThan(-1);
    expect(page.indexOf('"3018"')).toBeLessThan(page.indexOf('"119"'));
  });

  it("propose l'export EN UNE ACTION (lien unique vers /api/export)", () => {
    expect(page).toMatch(/href="\/api\/export"/);
  });

  it("registre PRODUIT : jamais signée d'Anam (aucune voix t-anam)", () => {
    expect(page).not.toMatch(/t-anam/);
  });
});

// ── Bloc AD-12 : la fonction d'application est réservée au rôle service (revue 1.9 #2) ────────
describe("appliquer_barriere_minorite — refusée hors service_role (AD-12)", () => {
  const attaquante = { email: `bm3a-${t}@exemple.fr`, password: "test-bm3a-123!", id: "" };
  const cible = { email: `bm3c-${t}@exemple.fr`, password: "test-bm3c-123!", id: "" };

  beforeAll(async () => {
    for (const u of [attaquante, cible]) {
      const { data, error } = await admin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
      });
      if (error) throw new Error(`createUser: ${error.message}`);
      u.id = data.user!.id;
    }
  });
  afterAll(async () => {
    for (const u of [attaquante, cible]) if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  it("une utilisatrice authentifiée NE PEUT PAS l'appeler (revoke ... from authenticated)", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: attaquante.email, password: attaquante.password });
    const { error } = await c.rpc("appliquer_barriere_minorite", {
      cible: cible.id, // uid ARBITRAIRE d'autrui : ce serait un vecteur d'abus si le revoke sautait
      echeance: echeanceSuppression(),
    });
    expect(error).not.toBeNull(); // permission denied
    await c.auth.signOut();

    // Et la cible n'a PAS été suspendue par cet appel refusé.
    const { data } = await admin
      .from("utilisatrice")
      .select("barriere_minorite_le")
      .eq("id", cible.id)
      .single();
    expect(data!.barriere_minorite_le).toBeNull();
  });

  it("un client ANONYME (sans session) ne peut pas l'appeler non plus", async () => {
    const c = clientScope(); // pas de signIn → rôle anon
    const { error } = await c.rpc("appliquer_barriere_minorite", {
      cible: cible.id,
      echeance: echeanceSuppression(),
    });
    expect(error).not.toBeNull();
  });
});

// ── Bloc WRAPPER de prod : la soudure AD-14 (échéance paramétrée injectée) — revue 1.9 #4 ────
describe("appliquerBarriereMinorite (wrapper de prod) — soudure AD-14", () => {
  const cible = { email: `bm4-${t}@exemple.fr`, password: "test-bm4-123!", id: "" };

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: cible.email,
      password: cible.password,
      email_confirm: true,
    });
    if (error) throw new Error(`createUser: ${error.message}`);
    cible.id = data.user!.id;
  });
  afterAll(async () => {
    if (cible.id) await admin.auth.admin.deleteUser(cible.id);
  });

  it("le wrapper réel suspend et injecte l'échéance J+30 paramétrée (pas seulement la RPC nue)", async () => {
    await appliquerBarriereMinorite(cible.id);
    const { data } = await admin
      .from("utilisatrice")
      .select("barriere_minorite_le, echeance_suppression")
      .eq("id", cible.id)
      .single();
    expect(data!.barriere_minorite_le).not.toBeNull();
    // echeanceSuppression() (lib/safety) a bien traversé le wrapper → la RPC : la durée est paramétrée.
    expect(data!.echeance_suppression).toBe(echeanceSuppression());
  });

  it("il REJETTE (throw) si la RPC échoue (cible invalide)", async () => {
    await expect(appliquerBarriereMinorite("pas-un-uuid")).rejects.toThrow();
  });
});

// ── Bloc CONCURRENCE : idempotence sous appels racés (revue 1.9 #3) ──────────────────────────
describe("appliquer_barriere_minorite — idempotence sous CONCURRENCE", () => {
  const cible = { email: `bm5-${t}@exemple.fr`, password: "test-bm5-123!", id: "" };
  const echeanceA = echeanceSuppression();

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: cible.email,
      password: cible.password,
      email_confirm: true,
    });
    if (error) throw new Error(`createUser: ${error.message}`);
    cible.id = data.user!.id;
  });
  afterAll(async () => {
    if (cible.id) await admin.auth.admin.deleteUser(cible.id);
  });

  it("deux applications RACÉES ne posent qu'UN audit et une échéance stable (pas d'écrasement)", async () => {
    // Ce que feront le classifieur + un retry d'Epic 2 : deux RPC concurrentes sur le même cible.
    await Promise.all([
      admin.rpc("appliquer_barriere_minorite", { cible: cible.id, echeance: echeanceA }),
      admin.rpc("appliquer_barriere_minorite", { cible: cible.id, echeance: "2099-01-01" }),
    ]);

    const { data: audits } = await admin
      .from("audit_securite")
      .select("id")
      .eq("utilisatrice_id", cible.id);
    expect(audits!.length).toBe(1); // un SEUL audit malgré la course (UPDATE conditionnel + index unique)

    const { data: ligne } = await admin
      .from("utilisatrice")
      .select("barriere_minorite_le, echeance_suppression")
      .eq("id", cible.id)
      .single();
    expect(ligne!.barriere_minorite_le).not.toBeNull();
    // Seul le gagnant a fixé l'échéance ; le perdant ne l'a PAS écrasée (l'un des deux candidats).
    expect([echeanceA, "2099-01-01"]).toContain(ligne!.echeance_suppression);
  });
});
