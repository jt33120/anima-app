import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * lecture-sql.test.ts — LES GARDES DE BASE DU RITUEL (Story 5.8, migration 0051).
 *
 * Ce fichier frappe un Supabase LOCAL réel et éprouve ce qu'aucun test de domaine ne peut éprouver :
 * que la BASE refuse ce qu'elle doit refuser quand l'appelante est authentifiée sous sa propre
 * identité et parle directement à l'API REST.
 *
 * C'est le seul angle qui compte. `authenticated` détient les sept privilèges DML sur chaque table de
 * `public` : une garde écrite dans une route, une Server Action ou une RPC ne garde rien. Ce dépôt
 * l'a payé six fois (migrations 0041 à 0048).
 *
 *   AC5 — au plus UNE lecture en attente, et un tirage sert au plus une lecture.
 *   AC6 — la restitution s'écrit UNE fois ; une lecture close ne se réécrit plus.
 *   AC7 — les quatre gardes du dépôt, chacune éprouvée SEULE.
 *   §figées — `with check` ne voit pas OLD : le trigger interdit de repointer la carte.
 */

const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const secret = process.env.SUPABASE_SECRET_KEY ?? "";
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientScope = () =>
  createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();

interface Utilisatrice {
  id: string;
  client: SupabaseClient;
}

async function creerUtilisatrice(suffixe: string): Promise<Utilisatrice> {
  const email = `lec-${suffixe}-${t}@exemple.fr`;
  const motDePasse = "test-lec-123!";
  const { data, error } = await admin.auth.admin.createUser({ email, password: motDePasse, email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  const id = data.user!.id;
  const { error: e2 } = await admin.from("utilisatrice").update({ date_naissance: "1990-06-15" }).eq("id", id);
  if (e2) throw new Error(`date_naissance: ${e2.message}`);
  const client = clientScope();
  const { error: e3 } = await client.auth.signInWithPassword({ email, password: motDePasse });
  if (e3) throw new Error(`signIn: ${e3.message}`);
  return { id, client };
}

async function consentir(id: string): Promise<void> {
  const { error } = await admin
    .from("consentement")
    .upsert(
      { utilisatrice_id: id, art9_accorde: true, ia_reconnue: true, cgu_acceptees: true },
      { onConflict: "utilisatrice_id" },
    );
  if (error) throw new Error(`consentement: ${error.message}`);
}

async function revoquer(id: string): Promise<void> {
  const { error } = await admin
    .from("consentement")
    .update({ revoked_at: new Date().toISOString() })
    .eq("utilisatrice_id", id)
    .is("revoked_at", null);
  if (error) throw new Error(`revocation: ${error.message}`);
}

/** La lecture est PREMIUM (FR-088) : sans abonnement actif, `lecture_depot` refuse. */
async function abonner(id: string): Promise<void> {
  const { error } = await admin
    .from("abonnement")
    .insert({ utilisatrice_id: id, etat: "actif", source_maj_le: new Date().toISOString() });
  if (error) throw new Error(`abonner: ${error.message}`);
}

async function desabonner(id: string): Promise<void> {
  const { error } = await admin.from("abonnement").update({ etat: "resilie" }).eq("utilisatrice_id", id);
  if (error) throw new Error(`desabonner: ${error.message}`);
}

async function ouvrirEpisode(id: string): Promise<void> {
  const { error } = await admin.from("episode_detresse").insert({ utilisatrice_id: id, niveau_max: 2 });
  if (error) throw new Error(`ouvrirEpisode: ${error.message}`);
}

async function nettoyer(id: string): Promise<void> {
  await admin.from("episode_detresse").delete().eq("utilisatrice_id", id);
  await admin.from("abonnement").delete().eq("utilisatrice_id", id);
  await admin.auth.admin.deleteUser(id);
}

/** Dépose un tirage sous l'identité d'`u` et rend son identifiant. */
async function tirer(u: Utilisatrice, carte = "barque"): Promise<string> {
  const { data, error } = await u.client
    .from("tirage")
    .insert({ utilisatrice_id: u.id, carte, graine: "0000002a", taille_jeu: 24 })
    .select("id")
    .single();
  if (error) throw new Error(`tirer: ${error.message}`);
  return data.id as string;
}

/** Ouvre une lecture sur un tirage frais. Rend `{ lectureId, tirageId }`. */
async function ouvrir(u: Utilisatrice, carte = "barque") {
  const tirageId = await tirer(u, carte);
  const { data, error } = await u.client
    .from("lecture")
    .insert({ utilisatrice_id: u.id, tirage_id: tirageId })
    .select("id")
    .single();
  return { lectureId: (data?.id as string) ?? null, tirageId, error };
}

let alice: Utilisatrice;
let bob: Utilisatrice;

beforeAll(async () => {
  alice = await creerUtilisatrice("alice");
  bob = await creerUtilisatrice("bob");
  await consentir(alice.id);
  await consentir(bob.id);
  await abonner(alice.id);
  await abonner(bob.id);
}, 60_000);

afterAll(async () => {
  await nettoyer(alice.id);
  await nettoyer(bob.id);
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 1. AU PLUS UNE LECTURE EN ATTENTE — la garde centrale de la story
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC5] l'index partiel ferme le re-tirage laissé ouvert par 0050", () => {
  it("la première lecture s'ouvre", async () => {
    const { lectureId, error } = await ouvrir(alice);
    expect(error).toBeNull();
    expect(lectureId).toBeTruthy();
  });

  it("⚠️ UNE SECONDE lecture en attente est REFUSÉE — c'est la garde de la story", async () => {
    // Sans elle, une utilisatrice déterminée rappelle le point d'entrée jusqu'à obtenir la carte qui
    // lui plaît. Ce n'est pas le défaut FR-016 (le SYSTÈME ne choisit pas), mais c'en est le voisin
    // immédiat — et il s'ouvrait par un simple `fetch` répété.
    const { error } = await ouvrir(alice, "pont");
    expect(error?.code).toBe("23505");
  });

  it("une fois la première CLOSE, une nouvelle peut s'ouvrir", async () => {
    const { data } = await alice.client.from("lecture").select("id").is("reponse", null).single();
    const { error: eClot } = await alice.client
      .from("lecture")
      .update({ reponse: "je vois une ouverture", restitution: "Tu as parlé d'ouverture." })
      .eq("id", data!.id);
    expect(eClot).toBeNull();
    const { error } = await ouvrir(alice, "pont");
    expect(error).toBeNull();
  });

  it("l'index est PARTIEL : plusieurs lectures CLOSES coexistent", async () => {
    const { data } = await alice.client.from("lecture").select("id").not("reponse", "is", null);
    expect(data!.length).toBeGreaterThanOrEqual(1);
  });

  it("l'index est par UTILISATRICE : Bob peut ouvrir la sienne pendant qu'Alice attend", async () => {
    const { error } = await ouvrir(bob);
    expect(error).toBeNull();
  });
});

describe("[AC5] un tirage sert au plus UNE lecture — la garde par l'autre bout", () => {
  it("rattacher DEUX lectures au même tirage est refusé", async () => {
    // Sans cette contrainte, on pourrait tirer dix fois, regarder les dix cartes, et n'ouvrir la
    // lecture que sur celle qui plaît : le re-tirage reviendrait par la porte de derrière.
    await bob.client.from("lecture").update({ reponse: "x", restitution: "y" }).is("reponse", null);
    const tirageId = await tirer(bob);
    const { error: e1 } = await bob.client.from("lecture").insert({ utilisatrice_id: bob.id, tirage_id: tirageId });
    expect(e1).toBeNull();
    await bob.client.from("lecture").update({ reponse: "x", restitution: "y" }).is("reponse", null);
    const { error: e2 } = await bob.client.from("lecture").insert({ utilisatrice_id: bob.id, tirage_id: tirageId });
    expect(e2?.code).toBe("23505");
  });

  it("rattacher le tirage DE QUELQU'UN D'AUTRE est refusé", async () => {
    // La cinquième garde, propre à cette table. La ligne serait bien à elle, mais la carte viendrait
    // de quelqu'un d'autre.
    const tirageAlice = await tirer(alice);
    await bob.client.from("lecture").update({ reponse: "x", restitution: "y" }).is("reponse", null);
    const { error } = await bob.client.from("lecture").insert({ utilisatrice_id: bob.id, tirage_id: tirageAlice });
    expect(error?.code).toBe("42501");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 2. LA RESTITUTION S'ÉCRIT UNE FOIS
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC6] une lecture close est close pour toujours", () => {
  let close: string;

  beforeAll(async () => {
    await alice.client.from("lecture").update({ reponse: "a", restitution: "b" }).is("reponse", null);
    const { data } = await alice.client
      .from("lecture")
      .select("id")
      .not("reponse", "is", null)
      .limit(1)
      .single();
    close = data!.id as string;
  });

  it("réécrire SES MOTS est refusé", async () => {
    // Des mots qu'on peut corriger après coup ne sont plus les siens (FR-021).
    const { data } = await alice.client
      .from("lecture")
      .update({ reponse: "autre chose", restitution: "b" })
      .eq("id", close)
      .select("id");
    expect(data ?? []).toEqual([]);
  });

  it("réécrire la RESTITUTION est refusé", async () => {
    const { data } = await alice.client
      .from("lecture")
      .update({ restitution: "une autre lecture" })
      .eq("id", close)
      .select("id");
    expect(data ?? []).toEqual([]);
  });

  it("clore SANS restitution est refusé — jamais l'un sans l'autre", async () => {
    const { lectureId } = await ouvrir(alice, "corde");
    const { error } = await alice.client.from("lecture").update({ reponse: "je vois" }).eq("id", lectureId!);
    expect(error).not.toBeNull();
  });

  it("clore avec des MOTS VIDES est refusé — sinon la chaîne vide libère l'index et rouvre le tirage", async () => {
    const { data } = await alice.client.from("lecture").select("id").is("reponse", null).single();
    const { error } = await alice.client
      .from("lecture")
      .update({ reponse: "   ", restitution: "quelque chose" })
      .eq("id", data!.id);
    expect(error).not.toBeNull();
  });
});

describe("[§figées] `with check` ne voit pas OLD — le trigger tient ce qu'elle ne peut pas tenir", () => {
  it("repointer `tirage_id` en clôturant est REFUSÉ", async () => {
    // Le geste exact que ça empêche : tirer deux fois, regarder les deux cartes, puis clore la
    // lecture sur celle qui plaît. Sans le trigger, la policy l'autoriserait — elle ne compare rien
    // à l'ancienne ligne.
    const { data } = await alice.client.from("lecture").select("id").is("reponse", null).single();
    const autreTirage = await tirer(alice, "ruche");
    const { error } = await alice.client
      .from("lecture")
      .update({ tirage_id: autreTirage, reponse: "je vois", restitution: "une lecture" })
      .eq("id", data!.id);
    expect(error?.code).toBe("42501");
  });

  it("après le refus, la lecture est TOUJOURS ouverte sur sa carte d'origine", async () => {
    const { data } = await alice.client.from("lecture").select("id, tirage(carte)").is("reponse", null).single();
    expect(data).toBeTruthy();
    expect((data as unknown as { tirage: { carte: string } }).tirage.carte).toBe("corde");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 3. LES GARDES DU DÉPÔT, CHACUNE SEULE
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AD-12] la lecture appartient à celle qui l'a vécue", () => {
  it("ouvrir POUR QUELQU'UN D'AUTRE est refusé", async () => {
    const tirageId = await tirer(alice, "nid");
    const { error } = await alice.client.from("lecture").insert({ utilisatrice_id: bob.id, tirage_id: tirageId });
    expect(error?.code).toBe("42501");
  });

  it("les lectures d'autrui sont invisibles", async () => {
    const { data } = await bob.client.from("lecture").select("id").eq("utilisatrice_id", alice.id);
    expect(data).toEqual([]);
  });
});

describe("[AC7] les gardes art. 9, minorité et détresse", () => {
  let carole: Utilisatrice;

  beforeAll(async () => {
    carole = await creerUtilisatrice("carole");
    await consentir(carole.id);
    await abonner(carole.id);
  }, 60_000);

  afterAll(async () => {
    await nettoyer(carole.id);
  });

  it("une fenêtre de détresse OUVERTE refuse l'ouverture d'une lecture", async () => {
    // ⚠️ La garde vit ICI, en SQL, et pas seulement dans la route : une carte tirée pendant un épisode
    // ouvert, puis présentée comme porteuse de sens, c'est le registre que §5 suspend au moment
    // précis où le produit doit cesser d'être un oracle pour devenir un filet (AD-17).
    const tirageId = await tirer(carole, "braise");
    await ouvrirEpisode(carole.id);
    const { error } = await carole.client
      .from("lecture")
      .insert({ utilisatrice_id: carole.id, tirage_id: tirageId });
    expect(error?.code).toBe("42501");
  });

  it("mais une lecture DÉJÀ OUVERTE peut se clore pendant l'épisode — la sortie ne se garde pas", async () => {
    // Décision explicite de 0051 : bloquer la clôture laisserait une carte déposée, une question
    // posée, et aucune façon d'y répondre — l'index partiel resterait occupé 72 h.
    await admin.from("episode_detresse").delete().eq("utilisatrice_id", carole.id);
    const { lectureId, error: eOuv } = await ouvrir(carole, "tamis");
    expect(eOuv).toBeNull();
    await ouvrirEpisode(carole.id);
    const { error } = await carole.client
      .from("lecture")
      .update({ reponse: "je vois", restitution: "une lecture" })
      .eq("id", lectureId!);
    expect(error).toBeNull();
    await admin.from("episode_detresse").delete().eq("utilisatrice_id", carole.id);
  });

  it("un consentement RÉVOQUÉ refuse l'ouverture", async () => {
    const tirageId = await tirer(carole, "orage");
    await revoquer(carole.id);
    const { error } = await carole.client
      .from("lecture")
      .insert({ utilisatrice_id: carole.id, tirage_id: tirageId });
    expect(error?.code).toBe("42501");
  });

  it("mais elle LIT toujours les siennes — l'export FR-067 en dépend", async () => {
    // Un socle qui séquestre ce qu'il a déjà écrit n'est pas un socle (doctrine 0049/0050).
    const { data, error } = await carole.client.from("lecture").select("id");
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
  });
});

describe("[FR-088] la lecture est PREMIUM, et la garde vit dans la POLICY", () => {
  let daphne: Utilisatrice;

  beforeAll(async () => {
    daphne = await creerUtilisatrice("daphne");
    await consentir(daphne.id);
  }, 60_000);

  afterAll(async () => {
    await nettoyer(daphne.id);
  });

  it("⚠️ SANS abonnement actif, ouvrir une lecture est REFUSÉ par la base", async () => {
    // La route arbitre déjà et propose l'offre avec des mots — mais `authenticated` détient le grant
    // INSERT table-level : un `.insert()` direct depuis le client n'a jamais croisé la route. Une
    // garde premium qui ne vivrait que dans l'applicatif serait décorative (doctrine 0037).
    const tirageId = await tirer(daphne, "lanterne");
    const { error } = await daphne.client
      .from("lecture")
      .insert({ utilisatrice_id: daphne.id, tirage_id: tirageId });
    expect(error?.code).toBe("42501");
  });

  it("avec un abonnement actif, elle passe — contrôle non tautologique", async () => {
    // Sans ce contrôle, une policy qui refuserait TOUT LE MONDE passerait le test précédent.
    await abonner(daphne.id);
    const tirageId = await tirer(daphne, "ruche");
    const { error } = await daphne.client
      .from("lecture")
      .insert({ utilisatrice_id: daphne.id, tirage_id: tirageId });
    expect(error).toBeNull();
  });

  it("une lecture OUVERTE se clôt même après résiliation — on ne séquestre pas un rituel en cours", async () => {
    // Même raisonnement que pour la détresse : le dépôt est gardé, la SORTIE ne se garde pas. Une
    // carte déposée, une question posée, et plus aucune façon d'y répondre serait un rituel gelé.
    await desabonner(daphne.id);
    const { error } = await daphne.client
      .from("lecture")
      .update({ reponse: "je vois une lueur", restitution: "Tu as parlé d'une lueur." })
      .is("reponse", null);
    expect(error).toBeNull();
  });

  it("mais elle ne peut plus en OUVRIR une nouvelle", async () => {
    const tirageId = await tirer(daphne, "corde");
    const { error } = await daphne.client
      .from("lecture")
      .insert({ utilisatrice_id: daphne.id, tirage_id: tirageId });
    expect(error?.code).toBe("42501");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 4. LES CAUSES DU REFUS, RAPPORTÉES ET NON GARDÉES
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC7] `causes_refus_lecture()` dit la cause avec des mots", () => {
  it("les trois prédicats reviennent en une passe", async () => {
    const { data, error } = await alice.client.rpc("causes_refus_lecture");
    expect(error).toBeNull();
    const l = (Array.isArray(data) ? data[0] : data) as Record<string, boolean>;
    expect(Object.keys(l).sort()).toEqual(["barre_minorite", "consentement_donne", "detresse_active"]);
    expect(l.consentement_donne).toBe(true);
    expect(l.detresse_active).toBe(false);
  });

  it("elle SUIT l'état réel : un épisode ouvert bascule `detresse_active`", async () => {
    // Contrôle non tautologique : sans lui, une RPC qui rendrait toujours `false` passerait le test
    // précédent, et la route ne distinguerait plus jamais rien.
    await ouvrirEpisode(bob.id);
    const { data } = await bob.client.rpc("causes_refus_lecture");
    const l = (Array.isArray(data) ? data[0] : data) as Record<string, boolean>;
    expect(l.detresse_active).toBe(true);
    await admin.from("episode_detresse").delete().eq("utilisatrice_id", bob.id);
  });

  it("⚠️ elle NE GARDE RIEN — mentir dessus n'ouvre rien", async () => {
    // La RPC rapporte ; les policies refusent. Si la garde vivait dans la RPC, un `.insert()` direct
    // depuis le client la contournerait — c'est la leçon payée six fois (0041→0048).
    // ⚠️ TIRER D'ABORD, OUVRIR L'ÉPISODE ENSUITE. `tirage` porte la MÊME garde de détresse (0050) :
    // l'ordre inverse ferait échouer le tirage et le test ne prouverait plus rien de `lecture`.
    const tirageId = await tirer(bob, "serrure");
    await bob.client.from("lecture").update({ reponse: "x", restitution: "y" }).is("reponse", null);
    await ouvrirEpisode(bob.id);
    const { error } = await bob.client.from("lecture").insert({ utilisatrice_id: bob.id, tirage_id: tirageId });
    expect(error?.code).toBe("42501");
    await admin.from("episode_detresse").delete().eq("utilisatrice_id", bob.id);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 5. LES HORODATAGES ET L'EFFACEMENT
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[0046] les horodatages sont posés par la BASE", () => {
  it("`ouverte_a` envoyé par l'écrivain est ÉCRASÉ", async () => {
    const tirageId = await tirer(bob, "escalier");
    await bob.client.from("lecture").update({ reponse: "x", restitution: "y" }).is("reponse", null);
    const { data } = await bob.client
      .from("lecture")
      .insert({ utilisatrice_id: bob.id, tirage_id: tirageId, ouverte_a: "2000-01-01T00:00:00Z" })
      .select("ouverte_a")
      .single();
    expect(new Date(data!.ouverte_a as string).getFullYear()).toBeGreaterThan(2020);
  });

  it("`close_a` se pose à la clôture, et pas avant", async () => {
    const { data: avant } = await bob.client.from("lecture").select("close_a").is("reponse", null).single();
    expect(avant!.close_a).toBeNull();
    const { data: apres } = await bob.client
      .from("lecture")
      .update({ reponse: "je vois", restitution: "une lecture" })
      .is("reponse", null)
      .select("close_a")
      .single();
    expect(apres!.close_a).not.toBeNull();
  });
});

describe("[FR-067] la lecture part avec le compte", () => {
  it("elle peut effacer les siennes, sans condition", async () => {
    // C'est précisément le geste de celle qui vient de révoquer son consentement.
    const { error } = await bob.client.from("lecture").delete().eq("utilisatrice_id", bob.id);
    expect(error).toBeNull();
    const { data } = await bob.client.from("lecture").select("id");
    expect(data).toEqual([]);
  });

  it("effacer le TIRAGE emporte la lecture (cascade) — jamais une lecture sans sa carte", async () => {
    const { lectureId, tirageId } = await ouvrir(bob, "fenetre");
    await bob.client.from("tirage").delete().eq("id", tirageId);
    const { data } = await bob.client.from("lecture").select("id").eq("id", lectureId!);
    expect(data).toEqual([]);
  });
});
