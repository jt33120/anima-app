import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { situationAbonnement, estPremium } from "@/lib/domain/abonnement";

/**
 * acces-offert.test.ts — LE PREMIUM SANS STRIPE (migration 0077)
 *
 * Anima écrit le corpus et doit VOIR ce qu'elle écrit. Les branches — donc l'arbre habité — vivent
 * derrière l'abonnement : sans accès offert, la co-autrice du produit ne peut pas relire son propre
 * travail. Un paiement de test n'est pas une réponse : il fabrique de faux contrats chez Stripe.
 *
 * ── CE QUE CE FICHIER GARDE, ET DANS QUEL ORDRE D'IMPORTANCE ───────────────────────────────────
 *
 * 1. **Personne ne peut s'offrir un accès.** `authenticated` détient les sept privilèges DML sur
 *    toutes les tables : une garde qui vivrait dans une route ne garderait rien. Ici l'exécution
 *    des deux fonctions est RETIRÉE à `authenticated` et `anon`, et `abonnement` n'a aucune policy
 *    d'écriture. C'est ça qu'on éprouve, sous un vrai JWT.
 * 2. **Un contrat payant n'est jamais recouvert ni coupé** — ni en offrant, ni en reprenant.
 * 3. **Un contrat réel efface l'accès offert**, sinon la contrainte ferait échouer le webhook d'une
 *    personne qui vient de payer.
 */

const URL_SB = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const PUB =
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const admin = () => createClient(URL_SB, SERVICE, { auth: { persistSession: false } });

let email: string;
let uid: string;
let motDePasse: string;

beforeAll(async () => {
  email = `offert-${Date.now()}@exemple.test`;
  motDePasse = `mdp-${Date.now()}-anam`;
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password: motDePasse,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`création du compte : ${error?.message}`);
  uid = data.user.id;
});

const lireLigne = async () =>
  (await admin().from("abonnement").select("*").eq("utilisatrice_id", uid).maybeSingle()).data as
    | { etat: string; offert_le: string | null; stripe_subscription_id: string | null }
    | null;

/** Une vraie session utilisatrice — le seul rôle qui compte pour éprouver une garde. */
async function sousSonJwt(): Promise<SupabaseClient> {
  const c = createClient(URL_SB, PUB, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: motDePasse });
  if (error) throw new Error(`connexion : ${error.message}`);
  return c;
}

describe("[0077] offrir un accès", () => {
  it("[LE CŒUR] l'accès offert rend le compte premium, sans aucun identifiant Stripe", async () => {
    const { data } = await admin().rpc("offrir_acces", { p_email: email, p_motif: "test" });
    expect(data).toBe("offert");

    const ligne = await lireLigne();
    expect(ligne?.etat, "le premium dérive de `etat = actif` dans huit lectures").toBe("actif");
    expect(ligne?.offert_le).not.toBeNull();
    expect(ligne?.stripe_subscription_id, "un accès offert ne porte aucun contrat").toBeNull();

    // Les deux dérivations du domaine, sur la même ligne.
    expect(estPremium({ etat: "actif" })).toBe(true);
    expect(
      situationAbonnement({
        etat: "actif",
        resiliationDemandeeLe: null,
        subscriptionId: null,
        offertLe: ligne!.offert_le,
      }),
      "confondu avec `actif`, l'écran proposerait de résilier un contrat inexistant",
    ).toBe("offert");
  });

  it("une adresse inconnue est REFUSÉE, sans rien créer", async () => {
    const { data } = await admin().rpc("offrir_acces", {
      p_email: `personne-${Date.now()}@exemple.test`,
      p_motif: null,
    });
    expect(data).toBe("compte_inconnu");
  });
});

describe("[0077] la contrainte tient les deux mondes séparés", () => {
  it("[LE CŒUR] une ligne OFFERTE portant un identifiant Stripe est REFUSÉE par la base", async () => {
    // ⚠️ CE TEST EST NÉ D'UN MUTANT SURVIVANT. La contrainte existait, les cinq autres tests
    // passaient, et remplacer son corps par `check (true)` ne faisait rougir personne : elle ne
    // gardait donc rien de prouvé. Un accès offert portant un identifiant Stripe ferait proposer
    // « Résilier » sur un contrat inexistant, et l'appel partirait chez Stripe avec un identifiant
    // qui n'est pas le nôtre.
    const a = admin();
    const qui = `melange-${Date.now()}@exemple.test`;
    const { data: cree } = await a.auth.admin.createUser({ email: qui, email_confirm: true });

    const { error } = await a.from("abonnement").insert({
      utilisatrice_id: cree!.user!.id,
      etat: "actif",
      offert_le: new Date().toISOString(),
      stripe_subscription_id: "sub_interdit",
      source_maj_le: new Date().toISOString(),
    });

    expect(error, "les deux mondes se sont mélangés").not.toBeNull();
    expect(error?.message ?? "").toContain("abonnement_offert_sans_stripe");
  });
});

describe("[0077] la garde : personne ne peut s'offrir un accès", () => {
  it("[L'EXPLOIT] sous son propre JWT, l'appel à `offrir_acces` est REFUSÉ", async () => {
    // ⚠️ C'EST LA GARDE QUI COMPTE. Un `revoke` oublié rendrait le premium libre-service, et rien
    // dans le produit ne le dirait — la ligne créée serait indiscernable d'un cadeau légitime.
    const sienne = await sousSonJwt();
    const { error } = await sienne.rpc("offrir_acces", { p_email: email, p_motif: "je me sers" });
    expect(error, "n'importe qui peut s'offrir le premium").not.toBeNull();
  });

  it("[L'EXPLOIT] elle ne peut pas non plus écrire la ligne à la main", async () => {
    // Le chemin détourné : puisque la RPC refuse, écrire directement dans la table. `authenticated`
    // en a le GRANT ; c'est l'absence de policy d'écriture qui l'arrête.
    const sienne = await sousSonJwt();
    const { error } = await sienne
      .from("abonnement")
      .upsert({ utilisatrice_id: uid, etat: "actif", source_maj_le: new Date().toISOString() });
    expect(error, "l'écriture directe d'un abonnement est passée").not.toBeNull();
  });
});

describe("[0077] un contrat payant n'est jamais abîmé", () => {
  it("[LE BORD] offrir à quelqu'un qui PAIE est refusé — ses identifiants resteraient orphelins", async () => {
    const a = admin();
    await a.rpc("traiter_evenement_abonnement", {
      cible: uid,
      p_provider_event_id: `evt-payant-${Date.now()}`,
      p_type: "customer.subscription.updated",
      p_stripe_customer_id: "cus_test",
      p_stripe_subscription_id: "sub_test",
      p_etat: "actif",
      p_periode_fin: new Date(Date.now() + 86_400_000).toISOString(),
      p_source_maj_le: new Date().toISOString(),
      p_debut_le: new Date().toISOString(),
      p_resiliation_demandee_le: null,
    });

    const { data } = await a.rpc("offrir_acces", { p_email: email, p_motif: "par erreur" });
    expect(data).toBe("contrat_stripe_existant");
    expect((await lireLigne())?.stripe_subscription_id, "le contrat a été effacé").toBe("sub_test");
  });

  it("[LE BORD] `reprendre_acces_offert` ne coupe JAMAIS un contrat payant", async () => {
    // Une faute de frappe sur l'adresse couperait l'accès de quelqu'un qui paie — et Stripe, lui,
    // continuerait de prélever. Le produit n'aurait aucun moyen de s'en apercevoir.
    const { data } = await admin().rpc("reprendre_acces_offert", { p_email: email });
    expect(data).toBe("contrat_payant_intouche");
    expect((await lireLigne())?.etat).toBe("actif");
  });

  it("[LE CŒUR] un contrat RÉEL efface l'accès offert — sinon le webhook boucle sur la contrainte", async () => {
    // Quelqu'un à qui on a offert l'accès et qui s'abonne pour de bon : sans l'effacement de la
    // marque, l'upsert violerait `abonnement_offert_sans_stripe`, le webhook échouerait en boucle,
    // et elle aurait payé sans rien recevoir.
    const a = admin();
    const autre = `paye-${Date.now()}@exemple.test`;
    const { data: cree } = await a.auth.admin.createUser({ email: autre, email_confirm: true });
    const id = cree!.user!.id;

    expect((await a.rpc("offrir_acces", { p_email: autre, p_motif: null })).data).toBe("offert");

    const { error } = await a.rpc("traiter_evenement_abonnement", {
      cible: id,
      p_provider_event_id: `evt-bascule-${Date.now()}`,
      p_type: "customer.subscription.created",
      p_stripe_customer_id: "cus_bascule",
      p_stripe_subscription_id: "sub_bascule",
      p_etat: "actif",
      p_periode_fin: new Date(Date.now() + 86_400_000).toISOString(),
      p_source_maj_le: new Date().toISOString(),
      p_debut_le: new Date().toISOString(),
      p_resiliation_demandee_le: null,
    });
    expect(error, "le webhook a échoué : elle a payé sans rien recevoir").toBeNull();

    const { data: ligne } = await a
      .from("abonnement")
      .select("offert_le, stripe_subscription_id")
      .eq("utilisatrice_id", id)
      .maybeSingle();
    expect(ligne?.offert_le, "la marque a survécu au contrat").toBeNull();
    expect(ligne?.stripe_subscription_id).toBe("sub_bascule");
  });
});

describe("[0077] reprendre un accès offert", () => {
  it("l'accès offert se referme, et le compte redevient gratuit", async () => {
    const a = admin();
    const qui = `repris-${Date.now()}@exemple.test`;
    const { data: cree } = await a.auth.admin.createUser({ email: qui, email_confirm: true });
    const id = cree!.user!.id;

    await a.rpc("offrir_acces", { p_email: qui, p_motif: null });
    expect((await a.rpc("reprendre_acces_offert", { p_email: qui })).data).toBe("repris");

    const { data: ligne } = await a
      .from("abonnement")
      .select("etat, offert_le")
      .eq("utilisatrice_id", id)
      .maybeSingle();
    expect(ligne?.etat).toBe("expire");
    expect(ligne?.offert_le).toBeNull();
    expect(estPremium({ etat: "expire" }), "le premium survit à la reprise").toBe(false);
  });
});
