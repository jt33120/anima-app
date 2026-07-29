import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { creerDepotAbonnement } from "@/lib/data/depot-abonnement";

/**
 * Story 3.1 (T1) — les tables `abonnement` + `evenements_traites` (migration 0013) contre un vrai
 * Supabase local. Preuves des invariants « Événements externes » + AD-12 :
 *  - `abonnement` : lecture PROPRIÉTAIRE (l'utilisatrice lit SA ligne, jamais celle d'une autre),
 *    écriture INTERDITE au client (server-authoritative — l'utilisatrice ne forge jamais son droit) ;
 *  - `evenements_traites` : deny-by-default intégral (registre système de dédup) ;
 *  - la RPC `traiter_evenement_abonnement` est l'ÉCRIVAIN UNIQUE, réservée à service_role ;
 *  - IDEMPOTENCE par `provider_event_id` : un event rejoué ne produit AUCUN second effet ;
 *  - ANTI-RÉGRESSION d'ordre : un event plus ANCIEN ne régresse jamais l'état (Stripe n'ordonne pas) ;
 *  - PROJECTION : le cycle actif → resilie s'applique par la RPC.
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientScope = () =>
  createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();

// Un appel de la RPC écrivain-unique (paramètres nommés, patron `ecrire_seance`).
type Args = {
  cible: string;
  p_provider_event_id: string;
  p_type: string;
  p_stripe_customer_id: string | null;
  p_stripe_subscription_id: string | null;
  p_etat: "actif" | "resilie" | "expire";
  p_periode_fin: string | null;
  p_source_maj_le: string;
};
const projeter = (a: Partial<Args> & Pick<Args, "cible" | "p_provider_event_id" | "p_etat" | "p_source_maj_le">) =>
  admin.rpc("traiter_evenement_abonnement", {
    p_type: "customer.subscription.updated",
    p_stripe_customer_id: `cus_${t}`,
    p_stripe_subscription_id: `sub_${t}`,
    p_periode_fin: null,
    ...a,
  });

describe("abonnement — projection écrivain-unique, lecture propriétaire, idempotente (3.1, AD-12)", () => {
  const u1 = { email: `ab1-${t}@exemple.fr`, password: "test-ab1-123!", id: "" };
  const u2 = { email: `ab2-${t}@exemple.fr`, password: "test-ab2-123!", id: "" };

  beforeAll(async () => {
    if (!url || !publishable || !secret) {
      throw new Error("Supabase local requis (SUPABASE_URL / PUBLISHABLE_KEY / SECRET_KEY).");
    }
    for (const u of [u1, u2]) {
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
    await admin.from("abonnement").delete().in("utilisatrice_id", [u1.id, u2.id].filter(Boolean));
    await admin.from("evenements_traites").delete().like("provider_event_id", `evt-${t}-%`);
    for (const u of [u1, u2]) if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  beforeEach(async () => {
    await admin.from("abonnement").delete().in("utilisatrice_id", [u1.id, u2.id].filter(Boolean));
    await admin.from("evenements_traites").delete().like("provider_event_id", `evt-${t}-%`);
  });

  // ── écrivain unique : la RPC est réservée à service_role ──────────────────────────────────────
  it("traiter_evenement_abonnement est réservée à service_role (client authentifié refusé)", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u1.email, password: u1.password });
    const forge = await c.rpc("traiter_evenement_abonnement", {
      cible: u1.id,
      p_provider_event_id: `evt-${t}-forge`,
      p_type: "customer.subscription.updated",
      p_stripe_customer_id: `cus_${t}`,
      p_stripe_subscription_id: `sub_${t}`,
      p_etat: "actif",
      p_periode_fin: null,
      p_source_maj_le: new Date().toISOString(),
    });
    expect(forge.error, "l'utilisatrice ne doit JAMAIS pouvoir forger son abonnement").not.toBeNull();
    await c.auth.signOut();
  });

  // ── lecture propriétaire : l'utilisatrice lit SA ligne, jamais celle d'une autre ───────────────
  it("lecture PROPRIÉTAIRE : l'utilisatrice lit SA ligne d'abonnement (policy SELECT)", async () => {
    await projeter({ cible: u1.id, p_provider_event_id: `evt-${t}-lecture`, p_etat: "actif", p_source_maj_le: new Date().toISOString() });
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u1.email, password: u1.password });
    const { data, error } = await c.from("abonnement").select("etat");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].etat).toBe("actif");
    await c.auth.signOut();
  });

  it("lecture CROISÉE interdite : u2 ne lit JAMAIS l'abonnement de u1", async () => {
    await projeter({ cible: u1.id, p_provider_event_id: `evt-${t}-croise`, p_etat: "actif", p_source_maj_le: new Date().toISOString() });
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u2.email, password: u2.password });
    const { data, error } = await c.from("abonnement").select("*");
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0); // la ligne de u1 existe mais reste masquée
    await c.auth.signOut();
  });

  it("écriture client interdite : une session utilisatrice ne peut pas écrire son abonnement", async () => {
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u1.email, password: u1.password });
    const { error } = await c.from("abonnement").insert({
      utilisatrice_id: u1.id,
      etat: "actif",
      source_maj_le: new Date().toISOString(),
    });
    expect(error, "aucune policy d'écriture → deny").not.toBeNull();
    await c.auth.signOut();
  });

  // ── evenements_traites : deny-by-default intégral ─────────────────────────────────────────────
  it("evenements_traites : deny-by-default (une session utilisatrice ne lit rien)", async () => {
    await projeter({ cible: u1.id, p_provider_event_id: `evt-${t}-deny`, p_etat: "actif", p_source_maj_le: new Date().toISOString() });
    const c = clientScope();
    await c.auth.signInWithPassword({ email: u1.email, password: u1.password });
    const { data, error } = await c.from("evenements_traites").select("*");
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0); // registre système, invisible au client
    await c.auth.signOut();
  });

  // ── idempotence par provider_event_id ─────────────────────────────────────────────────────────
  it("idempotence : le même event.id rejoué ne produit AUCUN second effet", async () => {
    const evt = `evt-${t}-idem`;
    const r1 = await projeter({ cible: u1.id, p_provider_event_id: evt, p_etat: "actif", p_source_maj_le: "2026-07-01T00:00:00Z" });
    expect(r1.data).toBe("traite");
    // Rejeu du MÊME event, avec un état différent : doit être ignoré (déjà traité).
    const r2 = await projeter({ cible: u1.id, p_provider_event_id: evt, p_etat: "resilie", p_source_maj_le: "2026-07-02T00:00:00Z" });
    expect(r2.data).toBe("deja_traite");

    const { data: ab } = await admin.from("abonnement").select("etat").eq("utilisatrice_id", u1.id).single();
    expect(ab!.etat, "l'état n'a pas bougé au rejeu").toBe("actif");
    const { data: evts } = await admin.from("evenements_traites").select("id").eq("provider_event_id", evt);
    expect(evts, "un seul enregistrement de dédup").toHaveLength(1);
  });

  // ── anti-régression d'ordre (Stripe ne garantit pas l'ordre de livraison) ──────────────────────
  it("anti-régression : un event PLUS ANCIEN ne régresse jamais l'état", async () => {
    await projeter({ cible: u1.id, p_provider_event_id: `evt-${t}-recent`, p_etat: "resilie", p_source_maj_le: "2026-07-10T00:00:00Z" });
    const vieux = await projeter({ cible: u1.id, p_provider_event_id: `evt-${t}-vieux`, p_etat: "actif", p_source_maj_le: "2026-07-05T00:00:00Z" });
    expect(vieux.data).toBe("ignore_obsolete");
    const { data: ab } = await admin.from("abonnement").select("etat").eq("utilisatrice_id", u1.id).single();
    expect(ab!.etat, "l'état récent (resilie) n'est pas régressé par un vieil event actif").toBe("resilie");
  });

  // ── projection : cycle actif → resilie ────────────────────────────────────────────────────────
  it("projection : actif puis resilie s'applique dans l'ordre chronologique", async () => {
    await projeter({ cible: u1.id, p_provider_event_id: `evt-${t}-p1`, p_etat: "actif", p_source_maj_le: "2026-07-01T00:00:00Z" });
    const r = await projeter({ cible: u1.id, p_provider_event_id: `evt-${t}-p2`, p_etat: "resilie", p_source_maj_le: "2026-08-01T00:00:00Z" });
    expect(r.data).toBe("traite");
    const { data: ab } = await admin.from("abonnement").select("etat").eq("utilisatrice_id", u1.id).single();
    expect(ab!.etat).toBe("resilie");
  });

  // ── le DÉPÔT réel (couche infra) projette via la RPC écrivain-unique ──────────────────────────
  it("creerDepotAbonnement projette un événement normalisé via la RPC (round-trip typé)", async () => {
    const depot = creerDepotAbonnement();
    const r = await depot.traiterEvenement({
      providerEventId: `evt-${t}-depot`,
      type: "customer.subscription.created",
      utilisatriceId: u1.id,
      etat: "actif",
      customerId: `cus_${t}`,
      subscriptionId: `sub_${t}`,
      periodeFin: "2027-07-01T00:00:00Z",
      sourceMajLe: "2026-07-01T00:00:00Z",
    });
    expect(r).toBe("traite");
    const { data: ab } = await admin
      .from("abonnement")
      .select("etat, stripe_subscription_id, periode_fin")
      .eq("utilisatrice_id", u1.id)
      .single();
    expect(ab!.etat).toBe("actif");
    expect(ab!.stripe_subscription_id).toBe(`sub_${t}`);
  });

  it("état hors énumération refusé (CHECK) + ATOMICITÉ : la dédup est annulée par le rollback", async () => {
    const r = await projeter({
      cible: u1.id,
      p_provider_event_id: `evt-${t}-check`,
      // @ts-expect-error — on force volontairement un état invalide pour prouver le CHECK
      p_etat: "zombie",
      p_source_maj_le: new Date().toISOString(),
    });
    expect(r.error, "le CHECK (etat in ...) rejette tout état hors énumération").not.toBeNull();
    // La RPC est UNE transaction : l'échec du CHECK annule AUSSI l'insert dans evenements_traites.
    // Sans cette atomicité, l'event serait marqué traité alors que la projection a échoué → au rejeu
    // (deja_traite) la projection serait perdue à jamais.
    const { data: evts } = await admin
      .from("evenements_traites")
      .select("id")
      .eq("provider_event_id", `evt-${t}-check`);
    expect(evts, "atomicité : aucune trace de dédup après un échec de projection").toHaveLength(0);
  });

  it("le dépôt PROPAGE l'erreur RPC (throw) — la route webhook répondra 500 et Stripe rejouera", async () => {
    const depot = creerDepotAbonnement();
    await expect(
      depot.traiterEvenement({
        providerEventId: `evt-${t}-err`,
        type: "customer.subscription.updated",
        utilisatriceId: u1.id,
        etat: "zombie" as unknown as "actif", // force le CHECK → error RPC → throw du dépôt
        customerId: null,
        subscriptionId: null,
        periodeFin: null,
        sourceMajLe: new Date().toISOString(),
      }),
    ).rejects.toThrow();
  });

  it("CONCURRENCE : deux events racés sur une abonnée NEUVE → l'état final reste le PLUS RÉCENT", async () => {
    // Sans le verrou consultatif (0014), le FOR UPDATE ne verrouille rien sur une ligne absente et
    // l'event ancien peut écraser le récent. On boucle pour ne pas dépendre d'un ordonnancement chanceux.
    for (let i = 0; i < 12; i++) {
      await admin.from("abonnement").delete().eq("utilisatrice_id", u1.id);
      await admin.from("evenements_traites").delete().like("provider_event_id", `evt-${t}-race${i}-%`);
      const vieux = projeter({ cible: u1.id, p_provider_event_id: `evt-${t}-race${i}-a`, p_etat: "actif", p_source_maj_le: "2026-07-05T00:00:00Z" });
      const recent = projeter({ cible: u1.id, p_provider_event_id: `evt-${t}-race${i}-b`, p_etat: "resilie", p_source_maj_le: "2026-07-10T00:00:00Z" });
      await Promise.all([vieux, recent]);
      const { data: ab } = await admin.from("abonnement").select("etat").eq("utilisatrice_id", u1.id).single();
      expect(ab!.etat, `itération ${i} : régression d'état sous concurrence`).toBe("resilie");
    }
  });
});
