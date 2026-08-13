import { describe, it, expect, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * REVUE DE CODE du 2026-08-11, lot 2 (M7, M8, M11) — migration 0044, contre le vrai SQL.
 *
 * Trois défauts sans rapport entre eux, sauf qu'ils vivent tous dans des RPC et qu'aucun ne se voit
 * avant la production. Chacun est rejoué ici dans le sens où il faisait mal, puis dans l'autre sens
 * pour prouver que le correctif n'a rien fermé de légitime.
 */

const url = process.env.SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();
const comptes: string[] = [];

async function creerCompte(suffixe: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email: `wr-${suffixe}-${t}@exemple.fr`,
    password: "test-wr-123!",
    email_confirm: true,
  });
  if (error) throw new Error(`createUser: ${error.message}`);
  comptes.push(data.user!.id);
  return data.user!.id;
}

/** Un événement de projection, avec les dix paramètres de la RPC. */
function evenement(
  cible: string,
  opts: { id: string; type: string; etat: string; source: string; sub?: string },
) {
  return {
    cible,
    p_provider_event_id: opts.id,
    p_type: opts.type,
    p_stripe_customer_id: "cus_test",
    p_stripe_subscription_id: opts.sub ?? "sub_test",
    p_etat: opts.etat,
    p_periode_fin: "2027-01-01T00:00:00Z",
    p_source_maj_le: opts.source,
    p_debut_le: "2026-01-01T00:00:00Z",
    p_resiliation_demandee_le: null,
  };
}

const etatDe = async (id: string) => {
  const { data } = await admin.from("abonnement").select("etat").eq("utilisatrice_id", id).maybeSingle();
  return data?.etat ?? null;
};

afterAll(async () => {
  for (const id of comptes) await admin.auth.admin.deleteUser(id);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// M7 — le compte supprimé
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[M7] un événement visant un compte EFFACÉ ne fait plus boucler le webhook", () => {
  it("[CONTRÔLE POSITIF] sur un compte vivant, la projection fonctionne", async () => {
    const id = await creerCompte("m7-vivant");
    const { data, error } = await admin.rpc(
      "traiter_evenement_abonnement",
      evenement(id, { id: `m7-ok-${t}`, type: "customer.subscription.created", etat: "actif", source: "2026-08-01T10:00:00Z" }),
    );
    expect(error).toBeNull();
    expect(data).toBe("traite");
  });

  it("compte effacé → `compte_absent`, SANS lever sur la clé étrangère", async () => {
    // Avant 0044 : violation de FK → la RPC lève → la transaction est annulée (donc
    // `evenements_traites` aussi) → la route rend 500 → Stripe rejoue à l'identique pendant TROIS
    // JOURS, puis alerte et peut DÉSACTIVER l'endpoint. Ce ne sont plus les abonnements d'une seule
    // personne qui cessent d'être projetés, ce sont ceux de tout le monde.
    const { data: cree } = await admin.auth.admin.createUser({
      email: `wr-m7-mort-${t}@exemple.fr`,
      password: "test-wr-123!",
      email_confirm: true,
    });
    const mort = cree!.user!.id;
    await admin.auth.admin.deleteUser(mort);

    const { data, error } = await admin.rpc(
      "traiter_evenement_abonnement",
      evenement(mort, { id: `m7-mort-${t}`, type: "customer.subscription.deleted", etat: "resilie", source: "2026-08-01T10:00:00Z" }),
    );
    expect(error, "une violation de clé étrangère n'est JAMAIS transitoire — inutile de rejouer").toBeNull();
    expect(data).toBe("compte_absent");
  });

  it("l'événement est tout de même CONSOMMÉ — c'est ce qui fait cesser le rejeu", async () => {
    const { data: cree } = await admin.auth.admin.createUser({
      email: `wr-m7-conso-${t}@exemple.fr`,
      password: "test-wr-123!",
      email_confirm: true,
    });
    const mort = cree!.user!.id;
    await admin.auth.admin.deleteUser(mort);
    const ev = { id: `m7-conso-${t}`, type: "customer.subscription.deleted", etat: "resilie", source: "2026-08-01T10:00:00Z" };

    expect((await admin.rpc("traiter_evenement_abonnement", evenement(mort, ev))).data).toBe("compte_absent");
    const rejeu = await admin.rpc("traiter_evenement_abonnement", evenement(mort, ev));
    expect(rejeu.data, "au rejeu, la dédup répond avant tout le reste").toBe("deja_traite");
  });

  it("l'information de reconduction fait de même (même clé étrangère, même piège)", async () => {
    const { data: cree } = await admin.auth.admin.createUser({
      email: `wr-m7-rec-${t}@exemple.fr`,
      password: "test-wr-123!",
      email_confirm: true,
    });
    const mort = cree!.user!.id;
    await admin.auth.admin.deleteUser(mort);
    const { data, error } = await admin.rpc("reserver_information_reconduction", {
      p_utilisatrice: mort,
      p_provider_event_id: `m7-rec-${t}`,
      p_echeance: "2027-01-01T00:00:00Z",
    });
    expect(error).toBeNull();
    expect(data, "rien à annoncer à un compte qui n'existe plus").toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// M8 — deux événements de la même seconde
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[M8] deux événements Stripe de la MÊME seconde, livrés dans le désordre", () => {
  const MEME = "2026-08-01T12:00:00Z";

  it("`incomplete` livré APRÈS `active` n'écrase plus l'abonnement payé", async () => {
    // Le cas réel : un Checkout carte sans 3DS émet `created` (incomplete) et `updated` (active)
    // dans la même seconde, et Stripe ne garantit aucun ordre de livraison. Avec l'ancienne garde
    // (`>` strict sur un horodatage à la seconde), le dernier livré gagnait : elle payait 69 € et
    // se retrouvait `expire`. Rien ne réparait — sur un abonnement ANNUEL, le prochain événement
    // d'état est dans un an.
    const id = await creerCompte("m8-desordre");
    await admin.rpc("traiter_evenement_abonnement", evenement(id, { id: `m8-a-${t}`, type: "customer.subscription.updated", etat: "actif", source: MEME }));
    expect(await etatDe(id)).toBe("actif");

    const retard = await admin.rpc("traiter_evenement_abonnement", evenement(id, { id: `m8-b-${t}`, type: "customer.subscription.created", etat: "expire", source: MEME }));
    expect(retard.data).toBe("ignore_obsolete");
    expect(await etatDe(id), "elle a payé — elle reste premium").toBe("actif");
  });

  it("[CONTRÔLE] dans le bon ordre, `active` écrase bien `incomplete`", async () => {
    // Sans ce contrôle, un `return 'ignore_obsolete'` en dur passerait le test précédent : le
    // départage doit laisser MONTER l'état, pas tout figer.
    const id = await creerCompte("m8-ordre");
    await admin.rpc("traiter_evenement_abonnement", evenement(id, { id: `m8-c-${t}`, type: "customer.subscription.created", etat: "expire", source: MEME }));
    expect(await etatDe(id)).toBe("expire");

    const suite = await admin.rpc("traiter_evenement_abonnement", evenement(id, { id: `m8-d-${t}`, type: "customer.subscription.updated", etat: "actif", source: MEME }));
    expect(suite.data).toBe("traite");
    expect(await etatDe(id)).toBe("actif");
  });

  it("une résiliation de la même seconde l'emporte sur `actif` (rang le plus avancé)", async () => {
    const id = await creerCompte("m8-resilie");
    await admin.rpc("traiter_evenement_abonnement", evenement(id, { id: `m8-e-${t}`, type: "customer.subscription.updated", etat: "actif", source: MEME }));
    await admin.rpc("traiter_evenement_abonnement", evenement(id, { id: `m8-f-${t}`, type: "customer.subscription.deleted", etat: "resilie", source: MEME }));
    expect(await etatDe(id)).toBe("resilie");
  });

  it("[NON-RÉGRESSION] un événement réellement PLUS ANCIEN reste ignoré", async () => {
    const id = await creerCompte("m8-vieux");
    await admin.rpc("traiter_evenement_abonnement", evenement(id, { id: `m8-g-${t}`, type: "customer.subscription.deleted", etat: "resilie", source: "2026-08-10T00:00:00Z" }));
    const vieux = await admin.rpc("traiter_evenement_abonnement", evenement(id, { id: `m8-h-${t}`, type: "customer.subscription.updated", etat: "actif", source: "2026-08-01T00:00:00Z" }));
    expect(vieux.data).toBe("ignore_obsolete");
    expect(await etatDe(id)).toBe("resilie");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// M11 — la preuve d'envoi
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[M11] un courriel légal en échec redevient rattrapable", () => {
  it("réserver deux fois refuse la seconde — les deux barrières font leur travail", async () => {
    const id = await creerCompte("m11-double");
    const ech = "2027-03-01T00:00:00Z";
    const p = (n: string) => ({ p_utilisatrice: id, p_provider_event_id: n, p_echeance: ech });

    expect((await admin.rpc("reserver_information_reconduction", p(`m11-a-${t}`))).data).toBe(true);
    expect(
      (await admin.rpc("reserver_information_reconduction", p(`m11-a-${t}`))).data,
      "1re barrière : même event.id",
    ).toBe(false);
    expect(
      (await admin.rpc("reserver_information_reconduction", p(`m11-b-${t}`))).data,
      "2de barrière : autre event, même échéance",
    ).toBe(false);
  });

  it("après LIBÉRATION, le rejeu Stripe peut enfin envoyer", async () => {
    // Avant 0044 : les deux barrières restaient posées, `envoye_le` attestait d'un envoi qui n'avait
    // pas eu lieu, et l'information de l'art. L215-1 n'était jamais envoyée. En contentieux, une
    // preuve qui contredit les journaux du prestataire est la pire position possible.
    const id = await creerCompte("m11-liberation");
    const ech = "2027-04-01T00:00:00Z";
    const ev = `m11-c-${t}`;
    const p = { p_utilisatrice: id, p_provider_event_id: ev, p_echeance: ech };

    expect((await admin.rpc("reserver_information_reconduction", p)).data).toBe(true);
    expect((await admin.rpc("reserver_information_reconduction", p)).data).toBe(false);

    const { error } = await admin.rpc("liberer_information_reconduction", p);
    expect(error).toBeNull();

    expect(
      (await admin.rpc("reserver_information_reconduction", p)).data,
      "le rejeu doit repasser, sinon l'obligation légale est perdue",
    ).toBe(true);
  });

  it("la libération efface bien les DEUX barrières, pas seulement l'une", async () => {
    // Si seul `information_reconduction` était effacé, un rejeu du même `event.id` resterait bloqué
    // par `evenements_traites` — et c'est précisément le rejeu que Stripe fait.
    const id = await creerCompte("m11-deux-barrieres");
    const ech = "2027-05-01T00:00:00Z";
    const ev = `m11-d-${t}`;
    await admin.rpc("reserver_information_reconduction", { p_utilisatrice: id, p_provider_event_id: ev, p_echeance: ech });
    await admin.rpc("liberer_information_reconduction", { p_utilisatrice: id, p_provider_event_id: ev, p_echeance: ech });

    const { data: reste } = await admin.from("evenements_traites").select("provider_event_id").eq("provider_event_id", ev).maybeSingle();
    expect(reste, "la barrière par event.id doit être levée aussi").toBeNull();
  });
});
