import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Story 3.5 (T1/T7) — LA PORTE DE SORTIE, éprouvée contre un vrai Supabase local.
 *
 * Trois choses se prouvent ici, et la troisième est celle qui compte le plus :
 *
 *  (1) L'ÉLIGIBILITÉ À LA GARANTIE dit non pour de BONNES raisons — quatre cas croisés, plus le cas
 *      `debut_le is null` qui doit être un refus MOTIVÉ et pas un accident de comparaison à NULL.
 *
 *  (2) LES DEUX CHEMINS DE REMBOURSEMENT convergent sur une seule clé d'idempotence. Deux tables ou
 *      deux clés, et une mineure ayant déjà obtenu la garantie serait remboursée deux fois.
 *
 *  (3) L'INFORMATION AVANT RECONDUCTION PART MALGRÉ UN REFUS DE CANAL. C'est le test central de cette
 *      story. Le réflexe — réutiliser `reserver_notification`, qui est là, qui marche, qui gère déjà
 *      l'idempotence — produirait un code vert et une infraction : quelqu'un ayant cliqué « ne plus
 *      recevoir » au bas d'une synthèse serait reconduit pour 69 € sans avoir été prévenu. Le test
 *      ci-dessous pose explicitement `refuse_le` PUIS exige l'envoi.
 *
 * CONTRÔLES POSITIFS PARTOUT. Une fonction qui refuserait TOUT satisferait la moitié de ce fichier —
 * et un refus muet est aussi cassé qu'une porte ouverte, simplement plus discret.
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientScope = () => createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();
const MDP = "test-resil-123!";

const ILY_A = (mois: number) => new Date(Date.now() - mois * 30 * 24 * 3600 * 1000).toISOString();

async function creerUtilisatrice(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({ email, password: MDP, email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  return data.user!.id;
}

async function session(email: string): Promise<SupabaseClient> {
  const c = clientScope();
  const { error } = await c.auth.signInWithPassword({ email, password: MDP });
  if (error) throw new Error(`signIn: ${error.message}`);
  return c;
}

/** Pose l'abonnement DIRECTEMENT (service_role) : on éprouve l'éligibilité, pas la projection. */
async function abonner(id: string, etat: string, debutLe: string | null) {
  const { error } = await admin.from("abonnement").upsert(
    {
      utilisatrice_id: id,
      etat,
      debut_le: debutLe,
      stripe_subscription_id: `sub_${t}_${id.slice(0, 8)}`,
      source_maj_le: new Date().toISOString(),
    },
    { onConflict: "utilisatrice_id" },
  );
  if (error) throw new Error(`abonner: ${error.message}`);
}

/** Une branche RÉELLE — donc son entrée de journal, car la FK est composite (0021). */
async function poserBranche(id: string, nom: string) {
  const { data, error } = await admin
    .from("entree_journal")
    .insert({ utilisatrice_id: id, cle_tour: `resil-${t}-${nom}`, role: "utilisatrice", contenu: "un tour" })
    .select("id")
    .single();
  if (error) throw new Error(`entree: ${error.message}`);
  const { error: e2 } = await admin
    .from("branche")
    .insert({ utilisatrice_id: id, extrait_source_id: data!.id, nom });
  if (e2) throw new Error(`branche: ${e2.message}`);
}

async function eligible(id: string): Promise<boolean> {
  const { data, error } = await admin.rpc("eligible_au_remboursement", { p_utilisatrice: id });
  if (error) throw new Error(`eligible: ${error.message}`);
  return data as boolean;
}

async function purger(id: string) {
  if (!id) return;
  await admin.from("remboursement").delete().eq("utilisatrice_id", id);
  await admin.from("information_reconduction").delete().eq("utilisatrice_id", id);
  await admin.from("preference_courriel").delete().eq("utilisatrice_id", id);
  await admin.from("branche").delete().eq("utilisatrice_id", id);
  await admin.from("entree_journal").delete().eq("utilisatrice_id", id);
  await admin.from("abonnement").delete().eq("utilisatrice_id", id);
  await admin.auth.admin.deleteUser(id);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// (1) L'ÉLIGIBILITÉ — quatre cas croisés + le refus motivé
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC5/AC6] eligible_au_remboursement — l'artefact du produit, jamais son état (FR-089)", () => {
  const cas = {
    vieilleSansBranche: { email: `el-a-${t}@exemple.fr`, id: "" },
    vieilleAvecBranche: { email: `el-b-${t}@exemple.fr`, id: "" },
    jeuneSansBranche: { email: `el-c-${t}@exemple.fr`, id: "" },
    jeuneAvecBranche: { email: `el-d-${t}@exemple.fr`, id: "" },
    sansDate: { email: `el-e-${t}@exemple.fr`, id: "" },
    expiree: { email: `el-f-${t}@exemple.fr`, id: "" },
  };

  beforeAll(async () => {
    if (!url || !publishable || !secret) throw new Error("Supabase local requis.");
    for (const c of Object.values(cas)) c.id = await creerUtilisatrice(c.email);

    await abonner(cas.vieilleSansBranche.id, "actif", ILY_A(4));
    await abonner(cas.vieilleAvecBranche.id, "actif", ILY_A(4));
    await poserBranche(cas.vieilleAvecBranche.id, "ce que j'ai compris");
    await abonner(cas.jeuneSansBranche.id, "actif", ILY_A(1));
    await abonner(cas.jeuneAvecBranche.id, "actif", ILY_A(1));
    await poserBranche(cas.jeuneAvecBranche.id, "une autre prise de conscience");
    await abonner(cas.sansDate.id, "actif", null);
    await abonner(cas.expiree.id, "expire", ILY_A(4));
  }, 60_000);

  afterAll(async () => {
    for (const c of Object.values(cas)) await purger(c.id);
  }, 60_000);

  it("LE CAS QUI DIT OUI — quatre mois, aucune branche (contrôle positif)", async () => {
    expect(await eligible(cas.vieilleSansBranche.id)).toBe(true);
  });

  it("une seule branche posée suffit à dire que le produit a produit", async () => {
    expect(await eligible(cas.vieilleAvecBranche.id)).toBe(false);
  });

  it("un mois d'abonnement : les trois mois ne sont pas écoulés", async () => {
    expect(await eligible(cas.jeuneSansBranche.id)).toBe(false);
  });

  it("jeune ET avec branche : les deux conditions manquent", async () => {
    expect(await eligible(cas.jeuneAvecBranche.id)).toBe(false);
  });

  it("`debut_le` NULL rend un `false` STRICT — jamais null, jamais undefined", async () => {
    // ⚠️ CE QUE CE TEST NE PROUVE PAS, et la campagne de mutation l'a établi : il ne prouve PAS que la
    // clause `and a.debut_le is not null` de la 0038 sert à quelque chose. Retirer cette clause laisse
    // les 27 tests verts, parce que `null <= …` rend NULL, que la ligne sort du `exists`, et que le
    // résultat est `false` de toute façon. La clause est REDONDANTE avec la sémantique NULL de `exists`.
    //
    // Elle est conservée quand même, et c'est un choix : elle redevient load-bearing à la première
    // réécriture qui n'utiliserait plus `exists` (un `count(*) > 0`, un `case`, un `coalesce` mal placé).
    // Ce qui la garde, c'est donc l'assertion de TEXTE ci-dessous — pas le comportement.
    const r = await eligible(cas.sansDate.id);
    expect(r).toBe(false);
    expect(typeof r).toBe("boolean");
  });

  it("la clause `debut_le is not null` est TOUJOURS dans le texte de la 0038 (garde de réécriture)", () => {
    const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/0038_resiliation_remboursement.sql"), "utf8");
    const corps = sql.slice(sql.indexOf("create function public.eligible_au_remboursement(p_utilisatrice uuid)"));
    expect(corps.slice(0, corps.indexOf("$$;"))).toMatch(/a\.debut_le is not null/);
  });

  it("un abonnement expiré n'ouvre pas la garantie (il n'y a plus rien à rembourser)", async () => {
    expect(await eligible(cas.expiree.id)).toBe(false);
  });

  it("FR-031 : la fonction rend un BOOLÉEN — il n'existe aucun nombre à faire fuir", async () => {
    const { data } = await admin.rpc("eligible_au_remboursement", { p_utilisatrice: cas.vieilleSansBranche.id });
    expect(typeof data).toBe("boolean");
    expect(JSON.stringify(data)).not.toMatch(/\d/); // ni compte de branches, ni jours restants
  });

  it("[DUR] la forme PARAMÉTRÉE n'est pas appelable sous JWT — sinon c'est un oracle sur autrui", async () => {
    const s = await session(cas.vieilleSansBranche.email);
    const { error } = await s.rpc("eligible_au_remboursement", { p_utilisatrice: cas.vieilleAvecBranche.id });
    expect(error, "un client authentifié peut interroger l'éligibilité d'un AUTRE compte").not.toBeNull();
  });

  it("la forme SANS ARGUMENT est ouverte à `authenticated` et répond sur SON compte", async () => {
    const s = await session(cas.vieilleSansBranche.email);
    const { data, error } = await s.rpc("eligible_au_remboursement");
    expect(error).toBeNull();
    expect(data).toBe(true); // contrôle positif : la porte n'est pas fermée pour tout le monde
  });

  it("la forme SANS ARGUMENT est refusée à `anon` (le revoke explicite de 0007/0036)", async () => {
    const anonyme = clientScope();
    const { error } = await anonyme.rpc("eligible_au_remboursement");
    expect(error, "`anon` exécute eligible_au_remboursement() — revoke `from public` ne suffit pas").not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// (2) LE REMBOURSEMENT — deux chemins, une clé
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC7/AC9] demander_remboursement — deux chemins convergents, une seule idempotence", () => {
  const eligibleU = { email: `rb-a-${t}@exemple.fr`, id: "" };
  const inéligible = { email: `rb-b-${t}@exemple.fr`, id: "" };
  const mineure = { email: `rb-c-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    for (const c of [eligibleU, inéligible, mineure]) c.id = await creerUtilisatrice(c.email);
    await abonner(eligibleU.id, "actif", ILY_A(4));
    await abonner(inéligible.id, "actif", ILY_A(1));
    await abonner(mineure.id, "actif", ILY_A(1));
    await poserBranche(mineure.id, "une branche posée avant la détection");
  }, 60_000);

  afterAll(async () => {
    for (const c of [eligibleU, inéligible, mineure]) await purger(c.id);
  }, 60_000);

  it("une demande éligible réserve et rend une clé d'idempotence (contrôle positif)", async () => {
    const { data, error } = await admin.rpc("demander_remboursement", {
      p_utilisatrice: eligibleU.id,
      p_motif: "garantie",
    });
    expect(error).toBeNull();
    const ligne = (data as Array<{ cle: string; subscription_id: string; deja_demande: boolean }>)[0];
    expect(ligne.deja_demande).toBe(false);
    expect(ligne.cle).toMatch(/^[0-9a-f-]{36}$/);
    expect(ligne.subscription_id).toContain("sub_");
  });

  it("[DUR] la SECONDE demande rend LA MÊME clé — c'est ce qui empêche Stripe de rembourser deux fois", async () => {
    const un = await admin.rpc("demander_remboursement", { p_utilisatrice: eligibleU.id, p_motif: "garantie" });
    const deux = await admin.rpc("demander_remboursement", { p_utilisatrice: eligibleU.id, p_motif: "garantie" });
    const a = (un.data as Array<{ cle: string; deja_demande: boolean }>)[0];
    const b = (deux.data as Array<{ cle: string; deja_demande: boolean }>)[0];
    expect(a.cle).toBe(b.cle);
    expect(b.deja_demande).toBe(true);
    const { count } = await admin
      .from("remboursement")
      .select("*", { count: "exact", head: true })
      .eq("utilisatrice_id", eligibleU.id);
    expect(count, "une seconde ligne de remboursement a été créée").toBe(1);
  });

  it("[DUR] une demande NON éligible est REFUSÉE et ne consomme rien", async () => {
    const { error } = await admin.rpc("demander_remboursement", {
      p_utilisatrice: inéligible.id,
      p_motif: "garantie",
    });
    expect(error?.message ?? "").toContain("remboursement_non_eligible");
    const { count } = await admin
      .from("remboursement")
      .select("*", { count: "exact", head: true })
      .eq("utilisatrice_id", inéligible.id);
    expect(count, "un refus a laissé une ligne derrière lui").toBe(0);
  });

  it("[DUR] un refus n'a pas BRÛLÉ la clé : la même personne, devenue éligible, est remboursée", async () => {
    // La propriété qui compte vraiment, et que le test précédent ne prouve PAS. Une ligne laissée par un
    // refus serait la clé d'idempotence du compte : la demande légitime ultérieure rendrait
    // `deja_demande = true` et ne rembourserait jamais. C'est ça, « ne rien consommer » — pas le compte
    // de lignes à un instant donné.
    //
    // (La campagne de mutation a montré que l'ordre vérifier/réserver dans la RPC n'est PAS ce qui garantit
    // ça : le `raise exception` abandonne la transaction et annule l'insert quel que soit l'ordre. Ce test
    // éprouve donc la propriété, pas l'implémentation qu'on croyait la porter.)
    await abonner(inéligible.id, "actif", ILY_A(5)); // trois mois écoulés, toujours aucune branche
    expect(await eligible(inéligible.id)).toBe(true);
    const { data, error } = await admin.rpc("demander_remboursement", {
      p_utilisatrice: inéligible.id,
      p_motif: "garantie",
    });
    expect(error).toBeNull();
    expect(
      (data as Array<{ deja_demande: boolean }>)[0].deja_demande,
      "le refus antérieur avait consommé la clé d'idempotence",
    ).toBe(false);
  });

  it("[AC9] la MINORITÉ rembourse sans condition d'éligibilité — ce n'est pas une garantie de satisfaction", async () => {
    // `mineure` a une branche ET moins de trois mois : elle échoue à TOUTE l'éligibilité de la garantie.
    expect(await eligible(mineure.id)).toBe(false);
    const { data, error } = await admin.rpc("demander_remboursement", {
      p_utilisatrice: mineure.id,
      p_motif: "minorite",
    });
    expect(error, "FR-071 exige un remboursement intégral quoi qu'elle ait posé").toBeNull();
    expect((data as Array<{ deja_demande: boolean }>)[0].deja_demande).toBe(false);
  });

  it("un motif inconnu lève plutôt que de rembourser au hasard", async () => {
    const { error } = await admin.rpc("demander_remboursement", { p_utilisatrice: eligibleU.id, p_motif: "cadeau" });
    expect(error?.message ?? "").toContain("remboursement_motif_invalide");
  });

  it("[AC7] confirmer_remboursement est idempotent par event.id (rejeu Stripe)", async () => {
    const evt = `evt-${t}-refund`;
    const args = { p_utilisatrice: eligibleU.id, p_provider_event_id: evt, p_type: "refund.created" };
    const un = await admin.rpc("confirmer_remboursement", args);
    const deux = await admin.rpc("confirmer_remboursement", args);
    expect(un.data).toBe(true);
    expect(deux.data, "le rejeu a produit un second effet").toBe(false);
    await admin.from("evenements_traites").delete().eq("provider_event_id", evt);
  });

  it("`remboursement` est en lecture PROPRIÉTAIRE et jamais inscriptible par le client", async () => {
    const s = await session(eligibleU.email);
    const { data } = await s.from("remboursement").select("motif");
    expect(data?.length, "elle doit voir son propre remboursement (export FR-067)").toBe(1);
    const { error } = await s
      .from("remboursement")
      .insert({ utilisatrice_id: eligibleU.id, motif: "garantie" });
    expect(error, "un client a pu forger une ligne de remboursement").not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// (3) L'INFORMATION AVANT RECONDUCTION — le test central de la story
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC4 DUR] l'information de reconduction ignore le refus de canal (art. L215-1 ≠ art. 21)", () => {
  const refusante = { email: `rc-a-${t}@exemple.fr`, id: "" };
  const ordinaire = { email: `rc-b-${t}@exemple.fr`, id: "" };
  const echeance = "2027-08-07T00:00:00Z";

  beforeAll(async () => {
    for (const c of [refusante, ordinaire]) c.id = await creerUtilisatrice(c.email);
    await abonner(refusante.id, "actif", ILY_A(11));
    await abonner(ordinaire.id, "actif", ILY_A(11));
    // Elle a cliqué « ne plus recevoir » au bas d'une synthèse. C'est son droit, et il porte sur les
    // notifications produit — pas sur l'information contractuelle avant reconduction tacite.
    const { error } = await admin
      .from("preference_courriel")
      .upsert({ utilisatrice_id: refusante.id, refuse_le: new Date().toISOString() }, { onConflict: "utilisatrice_id" });
    if (error) throw new Error(`refus: ${error.message}`);
  }, 60_000);

  afterAll(async () => {
    for (const c of [refusante, ordinaire]) await purger(c.id);
    await admin.from("evenements_traites").delete().like("provider_event_id", `evt-${t}-rc%`);
  }, 60_000);

  it("CONTRÔLE : `reserver_notification` REFUSE bien cette personne (le refus existe et mord)", async () => {
    const { data } = await admin.rpc("reserver_notification", {
      p_utilisatrice: refusante.id,
      p_motif: "synthese_prete",
      p_cle: `ctl-${t}`,
      p_plafond_heures: 72,
    });
    expect(data, "sans ça, le test suivant ne prouverait rien").toBe(false);
  });

  it("[LE TEST QUI COMPTE] la reconduction part MALGRÉ le refus de canal", async () => {
    const { data, error } = await admin.rpc("reserver_information_reconduction", {
      p_utilisatrice: refusante.id,
      p_provider_event_id: `evt-${t}-rc1`,
      p_echeance: echeance,
    });
    expect(error).toBeNull();
    expect(
      data,
      "un opt-out marketing a fait disparaître une obligation légale d'information : elle sera reconduite pour 69 € sans avoir été prévenue",
    ).toBe(true);
  });

  it("PREMIÈRE BARRIÈRE — le même event rejoué n'envoie qu'une fois", async () => {
    const { data } = await admin.rpc("reserver_information_reconduction", {
      p_utilisatrice: refusante.id,
      p_provider_event_id: `evt-${t}-rc1`,
      p_echeance: echeance,
    });
    expect(data).toBe(false);
  });

  it("SECONDE BARRIÈRE — un event DIFFÉRENT sur la MÊME échéance n'envoie pas non plus", async () => {
    // Facture re-générée après changement de moyen de paiement : nouvel `event.id`, même reconduction.
    // La première barrière ne le verrait pas passer.
    const { data } = await admin.rpc("reserver_information_reconduction", {
      p_utilisatrice: refusante.id,
      p_provider_event_id: `evt-${t}-rc2`,
      p_echeance: echeance,
    });
    expect(data, "deux courriels pour une seule reconduction").toBe(false);
  });

  it("une échéance DIFFÉRENTE (l'année suivante) passe — la barrière n'est pas un mur définitif", async () => {
    const { data } = await admin.rpc("reserver_information_reconduction", {
      p_utilisatrice: refusante.id,
      p_provider_event_id: `evt-${t}-rc3`,
      p_echeance: "2028-08-07T00:00:00Z",
    });
    expect(data).toBe(true);
  });

  it("une échéance absente LÈVE plutôt que d'envoyer sans clé d'idempotence", async () => {
    const { error } = await admin.rpc("reserver_information_reconduction", {
      p_utilisatrice: ordinaire.id,
      p_provider_event_id: `evt-${t}-rc4`,
      p_echeance: null,
    });
    expect(error?.message ?? "").toContain("reconduction_echeance_absente");
  });

  it("`information_reconduction` est deny-by-default (registre système, aucun calendrier exposé)", async () => {
    const s = await session(refusante.email);
    const { data } = await s.from("information_reconduction").select("echeance");
    expect(data?.length ?? 0).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// (4) LES DEUX DATES — coalesce d'un côté, écrasement franc de l'autre
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC8] la projection des deux dates : ce qui se conserve et ce qui s'efface", () => {
  const u = { email: `dt-${t}@exemple.fr`, id: "" };
  const projeter = (
    evt: string,
    quand: string,
    debut: string | null,
    resiliation: string | null,
    etat = "actif",
  ) =>
    admin.rpc("traiter_evenement_abonnement", {
      cible: u.id,
      p_provider_event_id: evt,
      p_type: "customer.subscription.updated",
      p_stripe_customer_id: `cus_${t}`,
      p_stripe_subscription_id: `sub_${t}`,
      p_etat: etat,
      p_periode_fin: null,
      p_source_maj_le: quand,
      p_debut_le: debut,
      p_resiliation_demandee_le: resiliation,
    });

  const lire = async () => {
    const { data } = await admin
      .from("abonnement")
      .select("debut_le, resiliation_demandee_le")
      .eq("utilisatrice_id", u.id)
      .single();
    return data as { debut_le: string | null; resiliation_demandee_le: string | null };
  };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
  }, 60_000);

  afterAll(async () => {
    await admin.from("evenements_traites").delete().like("provider_event_id", `evt-${t}-dt%`);
    await purger(u.id);
  }, 60_000);

  it("`debut_le` se CONSERVE quand un event ultérieur ne le porte pas (coalesce)", async () => {
    await projeter(`evt-${t}-dt1`, "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z", null);
    expect((await lire()).debut_le).not.toBeNull();
    await projeter(`evt-${t}-dt2`, "2026-02-01T00:00:00Z", null, null);
    expect(
      (await lire()).debut_le,
      "la date de première souscription a été effacée : le compteur de la garantie repart de zéro",
    ).not.toBeNull();
  });

  it("[DUR] `resiliation_demandee_le` s'EFFACE quand la résiliation est annulée (écrasement franc)", async () => {
    await projeter(`evt-${t}-dt3`, "2026-03-01T00:00:00Z", null, "2027-01-01T00:00:00Z");
    expect((await lire()).resiliation_demandee_le, "contrôle positif : la date se pose").not.toBeNull();
    // Elle revient sur sa décision : Stripe rend `cancel_at = null`.
    await projeter(`evt-${t}-dt4`, "2026-04-01T00:00:00Z", null, null);
    expect(
      (await lire()).resiliation_demandee_le,
      "l'écran dira éternellement « résilié » à quelqu'un qui est revenu",
    ).toBeNull();
  });

  it("[AC8 DUR / FR-029] après résiliation, RIEN n'a bougé du côté de son arbre", async () => {
    // La peur qui retient le plus efficacement n'est pas une offre, c'est un doute : « si je résilie,
    // est-ce que je perds tout ? ». La copie répond non (`RIEN_NE_DISPARAIT`) ; ce test rend la réponse
    // vraie. Continuité directe de la décision D1-A de la 3.3 : un compte expiré LIT, renomme et déclare
    // le rayonnement — il ne peut plus faire NAÎTRE.
    await admin
      .from("entree_journal")
      .insert({ utilisatrice_id: u.id, cle_tour: `resil-fr029-${t}`, role: "utilisatrice", contenu: "un tour" });
    const { data: e } = await admin
      .from("entree_journal")
      .select("id")
      .eq("utilisatrice_id", u.id)
      .limit(1)
      .single();
    await admin.from("branche").insert({ utilisatrice_id: u.id, extrait_source_id: e!.id, nom: "ce que j'ai vu" });

    const avant = await admin.from("branche").select("id, nom").eq("utilisatrice_id", u.id);
    expect(avant.data, "contrôle positif : la branche existe avant").toHaveLength(1);

    // La résiliation aboutie : Stripe finit par livrer `customer.subscription.deleted`.
    await projeter(`evt-${t}-dt6`, "2026-06-01T00:00:00Z", null, null, "resilie");
    const { data: ab } = await admin.from("abonnement").select("etat").eq("utilisatrice_id", u.id).single();
    expect(ab!.etat, "témoin : on est bien passé à l'état résilié").toBe("resilie");

    const apres = await admin.from("branche").select("id, nom").eq("utilisatrice_id", u.id);
    expect(apres.data, "l'arbre a régressé à la résiliation — la pire faute au sens de FR-029").toEqual(avant.data);
    const { count } = await admin
      .from("entree_journal")
      .select("*", { count: "exact", head: true })
      .eq("utilisatrice_id", u.id);
    expect(count, "le journal a été touché par une résiliation").toBeGreaterThan(0);
  });

  it("l'ancienne arité à 8 n'existe plus — aucun chemin d'écriture sans `debut_le`", async () => {
    const { error } = await admin.rpc("traiter_evenement_abonnement", {
      cible: u.id,
      p_provider_event_id: `evt-${t}-dt5`,
      p_type: "customer.subscription.updated",
      p_stripe_customer_id: `cus_${t}`,
      p_stripe_subscription_id: `sub_${t}`,
      p_etat: "actif",
      p_periode_fin: null,
      p_source_maj_le: "2026-05-01T00:00:00Z",
    });
    expect(error, "une surcharge à 8 arguments a survécu au `drop function`").not.toBeNull();
  });
});
