import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * REVUE DE CODE du 2026-08-12, Lot 3 — LES HORODATAGES AUTORITAIRES (0046), LA PROVENANCE D'UN FAIT
 * (0047) ET LA MAJORITÉ (0048), CONTRE LA VRAIE BASE.
 *
 * ══ POURQUOI CES TROIS-LÀ SONT DANS LE MÊME FICHIER ═════════════════════════════════════════════
 *
 * Parce que c'est le MÊME défaut, pour la quatrième, cinquième et sixième fois :
 *
 *     Supabase accorde les sept privilèges DML à `authenticated` sur chaque table de `public`. Une
 *     garde qui vit dans une Server Action, dans une RPC seule ou dans du TypeScript n'existe pas :
 *     un PATCH ou un POST direct sur `/rest/v1/<table>`, sous le propre jeton de la personne, passe
 *     à côté d'elle — la RLS est satisfaite, c'est sa ligne.
 *
 * Ce qui suit rejoue chaque contournement dans le sens où il faisait mal, puis dans l'autre sens
 * pour prouver que le correctif n'a rien fermé de légitime.
 *
 * ══ LA MAJORITÉ (0048) MÉRITE D'ÊTRE LUE EN PREMIER ═════════════════════════════════════════════
 *
 * C'est la barrière légale la plus importante du produit (FR-073, 18 ans minimum), et c'était la
 * seule qui n'existait qu'en TypeScript. Exploité contre la base réelle avant correctif :
 *
 *     PATCH /rest/v1/utilisatrice  { "date_naissance": "2013-06-15" }  → 200 ACCEPTÉ
 *     en base : date_naissance = 2013-06-15, mineur_detecte = false
 *     `etapeOnboardingPour` → « adulte », le parcours continue.
 *
 * Treize ans, dans un produit qui traite de l'art. 9 et fait parler un modèle sur la vie intérieure
 * de quelqu'un.
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();
const comptes: string[] = [];

interface Compte {
  readonly id: string;
  readonly client: SupabaseClient;
}

/** Un compte majeur, consentant, prêt à écrire — le point de départ de tous les cas. */
async function creerCompte(suffixe: string): Promise<Compte> {
  const email = `hm-${suffixe}-${t}@exemple.fr`;
  const motDePasse = "test-hm-123!";
  const { data, error } = await admin.auth.admin.createUser({ email, password: motDePasse, email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  const id = data.user!.id;
  comptes.push(id);

  await admin.from("utilisatrice").update({ date_naissance: "1990-01-01" }).eq("id", id);
  // Delete + insert, jamais un upsert : 0041 a rendu la révocation TERMINALE, même pour service_role.
  await admin.from("consentement").delete().eq("utilisatrice_id", id);
  const { error: e2 } = await admin
    .from("consentement")
    .insert({ utilisatrice_id: id, art9_accorde: true, ia_reconnue: true, cgu_acceptees: true });
  if (e2) throw new Error(`consentement: ${e2.message}`);

  const client = createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: e3 } = await client.auth.signInWithPassword({ email, password: motDePasse });
  if (e3) throw new Error(`signIn: ${e3.message}`);
  return { id, client };
}

/** Une entrée de journal appartenant à ce compte — l'ancre de tout ce qui en dérive. */
async function poserEntree(c: Compte, cle: string): Promise<string> {
  const { data, error } = await c.client
    .from("entree_journal")
    .insert({ utilisatrice_id: c.id, cle_tour: cle, role: "utilisatrice", contenu: "un tour" })
    .select("id")
    .single();
  if (error) throw new Error(`entree_journal: ${error.message}`);
  return data.id as string;
}

const ANTIDATE = "2020-01-01T00:00:00Z";
const estAntidate = (iso: string | null | undefined) => (iso ?? "").startsWith("2020");

afterAll(async () => {
  for (const id of comptes) await admin.auth.admin.deleteUser(id);
}, 120_000);

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 0046 — ON NE CHOISIT PAS SA PROPRE DATE DE CRÉATION
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[0046] les horodatages de création sont posés par la BASE, jamais par le client", () => {
  let u: Compte;

  beforeAll(async () => {
    u = await creerCompte("horodatage");
  }, 60_000);

  it("[LE TEST QUI COMPTE] `entree_journal.cree_le` antidatée est RÉÉCRITE", async () => {
    // Une entrée de journal antidatée décale tout ce qui se calcule sur le temps : la cadence de
    // feuillaison d'une branche, la fenêtre de 72 h après un épisode de détresse, l'ouverture d'un
    // moment « le lendemain » (0021). Se donner une date de création, c'est se donner des droits.
    const { data, error } = await u.client
      .from("entree_journal")
      .insert({ utilisatrice_id: u.id, cle_tour: `anti-${t}`, role: "utilisatrice", contenu: "un tour", cree_le: ANTIDATE })
      .select("cree_le")
      .single();
    expect(error).toBeNull();
    expect(estAntidate(data?.cree_le), "l'antidatage a été conservé").toBe(false);
  });

  it("[CONTRÔLE POSITIF] une insertion SANS `cree_le` fonctionne toujours, et porte une date", async () => {
    // Sans ce contrôle, un trigger qui lèverait sur toute insertion passerait le test précédent en
    // rendant le journal inutilisable.
    const { data, error } = await u.client
      .from("entree_journal")
      .insert({ utilisatrice_id: u.id, cle_tour: `ok-${t}`, role: "utilisatrice", contenu: "un tour" })
      .select("cree_le")
      .single();
    expect(error).toBeNull();
    expect(new Date(data!.cree_le as string).getTime()).toBeGreaterThan(Date.now() - 120_000);
  });

  it("`fait_extrait` ne naît pas dans un état choisi", async () => {
    // Naître « supprimé » ou « corrigé » ferait passer un fait pour le résultat d'un geste qui n'a
    // jamais eu lieu — et l'inventaire d'effacement (FR-067) compterait une suppression fantôme.
    const source = await poserEntree(u, `fe-${t}`);
    const { error } = await u.client
      .from("fait_extrait")
      .insert({ utilisatrice_id: u.id, extrait_source_id: source, contenu: "un fait", origine: "extrait", cle_dedoublonnage: `d1-${t}`, statut: "supprime" });
    expect(error?.code, "un état forgé doit lever, pas être silencieusement corrigé").toBe("P0001");
  });

  it("[CONTRÔLE POSITIF] un fait qui naît dans son état LÉGITIME passe", async () => {
    const source = await poserEntree(u, `fe-ok-${t}`);
    const { data, error } = await u.client
      .from("fait_extrait")
      .insert({ utilisatrice_id: u.id, extrait_source_id: source, contenu: "un fait", origine: "extrait", cle_dedoublonnage: `d2-${t}` })
      .select("statut, cree_le")
      .single();
    expect(error).toBeNull();
    expect(data?.statut).toBe("actif");
    expect(estAntidate(data?.cree_le as string)).toBe(false);
  });

  it("`signal_reconceptualisation` ne naît pas déjà consommé", async () => {
    // Un signal qui naîtrait `consomme` serait une prise de conscience effacée avant d'avoir été
    // proposée — perdue sans trace, ce que la doctrine de `ouverture-branche.ts` refuse.
    const source = await poserEntree(u, `sig-${t}`);
    const { error } = await u.client
      .from("signal_reconceptualisation")
      .insert({ utilisatrice_id: u.id, entree_journal_id: source, statut: "consomme" });
    expect(error?.code).toBe("P0001");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 0047 — UN FAIT NE S'ANCRE QUE SUR SON PROPRE JOURNAL
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[0047] la provenance d'un fait est COMPOSITE — le journal d'autrui est hors d'atteinte", () => {
  let a: Compte;
  let b: Compte;

  beforeAll(async () => {
    a = await creerCompte("prov-a");
    b = await creerCompte("prov-b");
  }, 60_000);

  it("[LE TEST QUI COMPTE] A ne peut pas ancrer un fait sur une entrée de B", async () => {
    // La clé étrangère ne portait que sur `extrait_source_id`. Elle disait « cette entrée existe »,
    // jamais « elle est à toi ». Le fait devenait alors une fenêtre de lecture sur le journal d'une
    // autre personne — de l'art. 9, chez quelqu'un d'autre.
    const chezB = await poserEntree(b, `pb-${t}`);
    const { error } = await a.client
      .from("fait_extrait")
      .insert({ utilisatrice_id: a.id, extrait_source_id: chezB, contenu: "vol", origine: "extrait", cle_dedoublonnage: `d3-${t}` });
    expect(error, "A a pu s'ancrer sur le journal de B").not.toBeNull();
  });

  it("[LA CLÉ COMPOSITE, ISOLÉE] même `service_role` ne peut pas ancrer en croisé", async () => {
    /*
     * ⚠️ CE TEST EXISTE PARCE QUE LE PRÉCÉDENT NE SUFFISAIT PAS, ET C'EST INSTRUCTIF.
     *
     * 0047 pose DEUX défenses : une policy d'insertion et une clé étrangère COMPOSITE
     * `(utilisatrice_id, extrait_source_id)`. La campagne de mutation a retiré la clé composite —
     * et la suite est restée VERTE, parce que la policy bloquait déjà le cas sous JWT. Deux gardes
     * qui se couvrent l'une l'autre : on croit en avoir deux, on n'en éprouve qu'une, et le jour où
     * quelqu'un « simplifie » la policy la seconde a disparu depuis longtemps sans un seul rouge.
     *
     * `service_role` CONTOURNE la RLS — c'est le seul angle depuis lequel la clé étrangère est
     * observable seule. C'est aussi ce que le commentaire de 0047 promet en toutes lettres : « une
     * policy s'oublie, une clé étrangère rend l'ancrage croisé structurellement impossible. »
     */
    const chezB = await poserEntree(b, `pb2-${t}`);
    const { error } = await admin
      .from("fait_extrait")
      .insert({ utilisatrice_id: a.id, extrait_source_id: chezB, contenu: "vol", origine: "extrait", cle_dedoublonnage: `d5-${t}` });
    expect(error?.code, "la clé composite ne mord pas — seule la policy tenait").toBe("23503");
  });

  it("[CONTRÔLE POSITIF] A s'ancre bien sur SA propre entrée", async () => {
    const chezA = await poserEntree(a, `pa-${t}`);
    const { error } = await a.client
      .from("fait_extrait")
      .insert({ utilisatrice_id: a.id, extrait_source_id: chezA, contenu: "un fait", origine: "extrait", cle_dedoublonnage: `d4-${t}` });
    expect(error, "la garde a fermé le cas légitime en même temps").toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 0048 — LA MAJORITÉ (FR-073)
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[0048/DUR] les 18 ans ne se contournent pas par un PATCH direct", () => {
  let u: Compte;
  /** Un compte SANS date de naissance : c'est l'état d'où part le contournement. */
  let vierge: { id: string; client: SupabaseClient };

  beforeAll(async () => {
    u = await creerCompte("majorite");
    const email = `hm-vierge-${t}@exemple.fr`;
    const mdp = "test-hm-123!";
    const { data } = await admin.auth.admin.createUser({ email, password: mdp, email_confirm: true });
    comptes.push(data!.user!.id);
    const client = createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });
    await client.auth.signInWithPassword({ email, password: mdp });
    vierge = { id: data!.user!.id, client };
  }, 60_000);

  /** `n` années en arrière, plus `decalageJours` — arithmétique de calendrier, comme Postgres. */
  const ilYA = (annees: number, decalageJours = 0): string => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - annees);
    return new Date(d.getTime() + decalageJours * 86_400_000).toISOString().slice(0, 10);
  };

  it("[L'EXPLOIT] une date de naissance de MINEURE est refusée par la base", async () => {
    const { error } = await vierge.client
      .from("utilisatrice")
      .update({ date_naissance: "2013-06-15" })
      .eq("id", vierge.id);
    expect(error, "treize ans, acceptée").not.toBeNull();

    const { data } = await admin
      .from("utilisatrice")
      .select("date_naissance")
      .eq("id", vierge.id)
      .maybeSingle<{ date_naissance: string | null }>();
    expect(data?.date_naissance, "la date a été écrite malgré le refus").toBeNull();
  });

  it("[LA BORNE] dix-huit ans MOINS un jour est refusée", async () => {
    const { error } = await vierge.client
      .from("utilisatrice")
      .update({ date_naissance: ilYA(18, 1) })
      .eq("id", vierge.id);
    expect(error).not.toBeNull();
  });

  it("[LA BORNE] dix-huit ans ET un jour passe — la garde ne ferme pas la porte aux majeures", async () => {
    // Sans ce contrôle, un `raise` inconditionnel passerait les deux tests précédents et empêcherait
    // toute inscription. Le refus doit être une DÉCISION, pas un mur.
    const { error } = await vierge.client
      .from("utilisatrice")
      .update({ date_naissance: ilYA(18, -1) })
      .eq("id", vierge.id);
    expect(error, "une majeure a été refusée").toBeNull();
  });

  it("une date FUTURE est refusée — ce n'est pas une naissance", async () => {
    const { error } = await u.client
      .from("utilisatrice")
      .update({ date_naissance: "2030-01-01" })
      .eq("id", u.id);
    expect(error).not.toBeNull();
  });

  it("[DUR] `service_role` est soumis au MÊME trigger — la garde ne connaît pas de privilège", async () => {
    // C'est ce qui la distingue d'une garde applicative : elle ne s'oublie pas parce qu'un chemin
    // serveur a été ajouté plus tard. Les fixtures de test elles-mêmes y sont soumises.
    const { error } = await admin
      .from("utilisatrice")
      .update({ date_naissance: "2015-01-01" })
      .eq("id", u.id);
    expect(error).not.toBeNull();
  });

  it("[NON-RÉGRESSION] une MINEURE détectée n'a toujours aucune date stockée, et c'est permis", async () => {
    // Le chemin légitime (AD-14) : pour une mineure, la Server Action n'écrit QUE le drapeau, jamais
    // de date. Le trigger ne doit pas gêner ce chemin-là, sinon la barrière elle-même casse.
    //
    // ⚠️ UN COMPTE NEUF, et c'est nécessaire : la première version de ce test réutilisait `vierge`,
    // dont la date venait d'être gravée par le cas précédent. C'est alors le trigger d'IMMUTABILITÉ
    // (0003) qui levait — un rouge qui n'avait rien à voir avec la majorité. Un test qui échoue
    // pour la mauvaise raison est aussi trompeur qu'un test qui passe pour la mauvaise raison.
    const email = `hm-mineure-${t}@exemple.fr`;
    const { data } = await admin.auth.admin.createUser({
      email,
      password: "test-hm-123!",
      email_confirm: true,
    });
    comptes.push(data!.user!.id);
    const { error } = await admin
      .from("utilisatrice")
      .update({ mineur_detecte: true })
      .eq("id", data!.user!.id);
    expect(error).toBeNull();
  });
});
