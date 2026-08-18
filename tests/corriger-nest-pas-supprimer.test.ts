import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { declarerMajorite } from "./_semis";

/**
 * corriger-nest-pas-supprimer.test.ts — R1 DE LA REVUE EPIC 6, contre le vrai Postgres (0065).
 *
 * ══ LE DÉFAUT ═══════════════════════════════════════════════════════════════════════════════════
 *
 * `fait_extrait.statut` répondait à DEUX questions différentes, et deux lectures écrites à deux
 * epics d'écart n'étaient pas d'accord sur la troisième valeur :
 *
 *   • `charger_faits_actifs()` (0019, le RAPPEL)  →  `statut = 'actif'`
 *   • `charger_faits_retenus()` (0056, l'ÉCRAN)   →  `statut <> 'supprime'`
 *   • `materiau_synthese()`    (0035, la SYNTHÈSE)→  `statut = 'actif'`
 *
 * Sur `corrige`, elles divergent. L'écran affiche donc « Voici ce qu'Anam a retenu » AVEC la phrase
 * qu'elle vient de corriger, pendant qu'Anam a cessé de la connaître : une correction (art. 16) était
 * traitée comme une pierre tombale. Le seul chemin qui VIT aujourd'hui est la synthèse — le rappel
 * n'a aucun appelant de production — et c'est donc par la synthèse que le mensonge se produit.
 *
 * ══ CE QUE CE FICHIER PROUVE ════════════════════════════════════════════════════════════════════
 *
 *  §1  Le GESTE RÉEL de l'écran (`fusionner_fait_extrait('utilisatrice','corrige',…)`) laisse la
 *      phrase dans ce qu'Anam se rappelle ET dans le matériau de synthèse.
 *  §2  Les deux lectures rendent le MÊME ensemble de clés — la propriété, pas le cas. C'est le test
 *      qui aurait attrapé R1 le jour de sa naissance.
 *  §3  Le tombstone, lui, sort toujours. Élargir n'a pas ouvert la porte de l'effacement.
 *  §4  Ce que la machine possède est VIVANT, par contrainte de TABLE — donc opposable au PATCH REST
 *      et à service_role, pas seulement au corps d'une RPC.
 *  §5  ⚠️ UNE RÉSURRECTION PAR RENOMMAGE DE CLÉ, sans rapport avec le filtre, trouvée en écrivant
 *      ce correctif. C'est la CLÉ qui bloque une re-extraction, pas la ligne : la libérer faisait
 *      revenir un fait supprimé, contenu compris.
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const t = Date.now();
const MDP = "test-r1-123!";

interface Utilisatrice {
  id: string;
  client: SupabaseClient;
}

async function creerUtilisatrice(suffixe: string): Promise<Utilisatrice> {
  const email = `r1-${suffixe}-${t}@exemple.fr`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: MDP,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser: ${error.message}`);
  const id = data.user!.id;
  await declarerMajorite(admin, id);
  const client = createClient(url, publishable, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: e1 } = await client.auth.signInWithPassword({ email, password: MDP });
  if (e1) throw new Error(`signIn: ${e1.message}`);
  const { error: e2 } = await client.from("consentement").upsert(
    { utilisatrice_id: id, art9_accorde: true, ia_reconnue: true, cgu_acceptees: true, revoked_at: null },
    { onConflict: "utilisatrice_id" },
  );
  if (e2) throw new Error(`consentement: ${e2.message}`);
  return { id, client };
}

/** Le geste de l'EXTRACTION : Anam pose un fait qu'elle a tiré d'un tour. */
async function semerParExtraction(u: Utilisatrice, cle: string, contenu: string) {
  const { error } = await u.client.rpc("fusionner_fait_extrait", {
    p_origine: "extrait",
    p_statut: "actif",
    p_cle: cle,
    p_contenu: contenu,
    p_extrait_source: null,
  });
  if (error) throw new Error(`semer(${cle}): ${error.message}`);
}

/** Le geste de L'ÉCRAN : elle réécrit la phrase, ou elle l'efface. */
async function gesteUtilisatrice(u: Utilisatrice, statut: string, cle: string, contenu: string) {
  const { error } = await u.client.rpc("fusionner_fait_extrait", {
    p_origine: "utilisatrice",
    p_statut: statut,
    p_cle: cle,
    p_contenu: contenu,
    p_extrait_source: null,
  });
  if (error) throw new Error(`geste(${statut},${cle}): ${error.message}`);
}

const clesDe = (lignes: unknown): string[] =>
  ((lignes ?? []) as { cle_dedoublonnage?: string; cle?: string }[])
    .map((l) => l.cle_dedoublonnage ?? l.cle!)
    .sort();

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §1 — LE CŒUR : le geste réel de l'écran laisse la phrase dans la mémoire d'Anam
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[R1] corriger un fait ne le retire pas de ce qu'Anam se rappelle (art. 16)", () => {
  let u: Utilisatrice;
  beforeAll(async () => {
    u = await creerUtilisatrice("coeur");
    await semerParExtraction(u, `k-montagne-${t}`, "elle aime la montagne");
  });
  afterAll(async () => admin.auth.admin.deleteUser(u.id));

  it("[CONTRÔLE POSITIF] le fait extrait est rappelable avant toute correction", async () => {
    const { data, error } = await u.client.rpc("charger_faits_rappelables");
    expect(error).toBeNull();
    expect(clesDe(data)).toContain(`k-montagne-${t}`);
  });

  it("[LE CŒUR] après SA correction, le rappel rend la phrase CORRIGÉE — pas le silence", async () => {
    // ⚠️ LE GESTE RÉEL, PAS UN SEMIS `service_role`. C'est la distinction qui a laissé R1 vivre :
    // un test qui écrit la ligne à la main prouve que le filtre marche sur la ligne qu'il a écrite,
    // jamais que le geste de l'écran produit une ligne que le filtre laisse passer.
    await gesteUtilisatrice(u, "corrige", `k-montagne-${t}`, "elle déteste la montagne");
    const { data } = await u.client.rpc("charger_faits_rappelables");
    const ligne = ((data ?? []) as { cle_dedoublonnage: string; contenu: string; statut: string }[]).find(
      (l) => l.cle_dedoublonnage === `k-montagne-${t}`,
    );
    expect(ligne, "la clé corrigée a disparu du rappel — c'est R1").toBeDefined();
    expect(ligne!.contenu).toBe("elle déteste la montagne");
    expect(ligne!.statut).toBe("corrige");
  });

  it("[LE CHEMIN QUI VIT] le MATÉRIAU DE SYNTHÈSE la porte aussi — c'est par là que R1 se vivait", async () => {
    // ⚠️ `charger_faits_actifs` n'avait AUCUN appelant de production : le rappel n'est pas branché,
    // la 4.4 le branchera. Le job de SYNTHÈSE, lui, tourne depuis le 2026-08-05 — c'est donc par lui,
    // et par lui seul, que R1 se VIVAIT. Corriger un fait le retirait réellement des synthèses.
    //
    // Et ce chemin est PREMIUM (`eligible_a_synthese` → `eligible_au_periodique` → abonnement actif) :
    // sans cette ligne, la fonction rend `faits: []` par le gate, et le test serait vert sans rien
    // prouver. Le défaut ne mordait donc que sur les abonnées — celles qui ont le plus de faits.
    const { error: eAbo } = await admin.from("abonnement").insert({
      utilisatrice_id: u.id,
      etat: "actif",
      source_maj_le: new Date().toISOString(),
    });
    expect(eAbo, "fixture d'abonnement").toBeNull();

    const { data, error } = await admin.rpc("materiau_synthese", {
      p_utilisatrice: u.id,
      p_plafond_entrees: 200,
      p_plafond_octets: 100000,
    });
    expect(error).toBeNull();
    expect(JSON.stringify((data as { faits: unknown }).faits)).toContain("elle déteste la montagne");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §2 — LA PROPRIÉTÉ, PAS LE CAS : les deux lectures ne peuvent plus diverger
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[R1] l'écran et le rappel voient le MÊME ensemble de faits", () => {
  let u: Utilisatrice;
  beforeAll(async () => {
    u = await creerUtilisatrice("ensembles");
    await semerParExtraction(u, `a-${t}`, "un fait actif");
    await semerParExtraction(u, `b-${t}`, "un fait à corriger");
    await gesteUtilisatrice(u, "corrige", `b-${t}`, "la phrase réécrite");
    await semerParExtraction(u, `c-${t}`, "un fait à supprimer");
    await gesteUtilisatrice(u, "supprime", `c-${t}`, "");
  });
  afterAll(async () => admin.auth.admin.deleteUser(u.id));

  it("[LE TEST QUI AURAIT ATTRAPÉ R1] égalité EXACTE des clés rendues par les deux lectures", async () => {
    // ⚠️ CE TEST EST LA VRAIE RÉPARATION. Le prédicat partagé (`fait_est_vivant`) empêche la
    // divergence dans le code ; celui-ci l'empêche dans le temps. Une quatrième lecture écrite dans
    // deux epics recopiera peut-être son `where` — et rougira ici.
    const rappel = await u.client.rpc("charger_faits_rappelables");
    const ecran = await u.client.rpc("charger_faits_retenus", { p_max: 200 });
    expect(rappel.error).toBeNull();
    expect(ecran.error).toBeNull();
    expect(clesDe(rappel.data)).toEqual(clesDe(ecran.data));
    // Non-vacuité : deux ensembles VIDES seraient égaux, et ne prouveraient rien.
    expect(clesDe(rappel.data).length).toBeGreaterThanOrEqual(2);
  });

  it("[§3] le tombstone sort des DEUX — élargir n'a pas ouvert la porte de l'effacement", async () => {
    const rappel = await u.client.rpc("charger_faits_rappelables");
    const ecran = await u.client.rpc("charger_faits_retenus", { p_max: 200 });
    expect(clesDe(rappel.data)).not.toContain(`c-${t}`);
    expect(clesDe(ecran.data)).not.toContain(`c-${t}`);
    // Et il ne revient pas non plus par la synthèse — le chemin qui vit.
    const { data } = await admin.rpc("materiau_synthese", {
      p_utilisatrice: u.id,
      p_plafond_entrees: 200,
      p_plafond_octets: 100000,
    });
    expect(JSON.stringify((data as { faits: unknown }).faits)).not.toContain("un fait à supprimer");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §4 — CE QUE LA MACHINE POSSÈDE EST VIVANT, PAR CONTRAINTE DE TABLE
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[R1] `origine='extrait'` implique `statut='actif'` — opposable au PATCH, pas au corps d'une RPC", () => {
  let u: Utilisatrice;
  beforeAll(async () => {
    u = await creerUtilisatrice("contrainte");
    await semerParExtraction(u, `m-${t}`, "une phrase de machine");
  });
  afterAll(async () => admin.auth.admin.deleteUser(u.id));

  it("un PATCH direct sous JWT ne peut plus fabriquer une ligne (extrait, corrige)", async () => {
    // ⚠️ CE N'EST PAS UNE PRÉCAUTION THÉORIQUE. Sans cette contrainte, une telle ligne entrerait dans
    // un prompt SOUS L'ÉTIQUETTE « Tu as réécrit cette phrase. » — une phrase de machine présentée à
    // quelqu'un comme étant de sa main. Et la règle 4.2 « le chemin utilisatrice ne pose que
    // corrige/supprime » ne vivait QUE dans le corps de `fusionner_fait_extrait`, alors
    // qu'`authenticated` détient l'UPDATE de table (leçon 0041/0042/0047, payée six fois).
    const { error } = await u.client
      .from("fait_extrait")
      .update({ statut: "corrige" })
      .eq("utilisatrice_id", u.id)
      .eq("cle_dedoublonnage", `m-${t}`);
    expect(error, "une ligne (extrait, corrige) reste fabricable par PATCH").not.toBeNull();
  });

  it("et service_role ne le peut pas non plus — une contrainte de TABLE ne connaît pas les rôles", async () => {
    // ⚠️ SA PROPRE LIGNE, ET C'EST UN CORRECTIF. Écrit sur la ligne du test précédent, il passait
    // même CONTRAINTE RETIRÉE (mesuré) : le PATCH d'avant l'avait déjà laissée en `(extrait,
    // corrige)`, si bien que c'était le TRIGGER anti-résurrection qui levait, pas la contrainte. Un
    // test qui passe pour la mauvaise raison est un test qui ne garde rien.
    const cle = `srv-${t}`;
    const { error: eSemis } = await admin.from("fait_extrait").insert({
      utilisatrice_id: u.id,
      origine: "extrait",
      statut: "actif",
      cle_dedoublonnage: cle,
      contenu: "une autre phrase de machine",
    });
    expect(eSemis, "semis service_role").toBeNull();
    const { error } = await admin
      .from("fait_extrait")
      .update({ statut: "corrige" })
      .eq("utilisatrice_id", u.id)
      .eq("cle_dedoublonnage", cle);
    expect(error?.code, "la contrainte de table doit lever un 23514, pas le trigger").toBe("23514");
  });

  it("[ANTI-VACUITÉ] le geste LÉGITIME passe toujours — la contrainte ne ferme pas la correction", async () => {
    await gesteUtilisatrice(u, "corrige", `m-${t}`, "la phrase qu'elle a réécrite");
    const { data } = await u.client
      .from("fait_extrait")
      .select("origine, statut")
      .eq("cle_dedoublonnage", `m-${t}`)
      .single();
    expect(data).toEqual({ origine: "utilisatrice", statut: "corrige" });
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §5 — LA RÉSURRECTION PAR RENOMMAGE DE CLÉ (AD-18) — trouvée en écrivant ce correctif
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[AD-18] un fait supprimé ne revient pas quand on libère sa clé", () => {
  let u: Utilisatrice;
  beforeAll(async () => {
    u = await creerUtilisatrice("resurrection");
    await semerParExtraction(u, `z-${t}`, "elle aime la montagne");
    await gesteUtilisatrice(u, "supprime", `z-${t}`, "");
  });
  afterAll(async () => admin.auth.admin.deleteUser(u.id));

  it("[LE CŒUR] renommer la clé du tombstone est REFUSÉ — c'est la clé qui bloque, pas la ligne", async () => {
    // ⚠️ LE TROU, MESURÉ. Le tombstone n'est jamais touché : on lui retire sa CLÉ. Or c'est l'index
    // unique (utilisatrice_id, cle_dedoublonnage) qui force la ré-extraction à tomber en
    // `on conflict`. Libérée, elle insère du NEUF — et `fait_extrait_naissance` laisse passer, c'est
    // une naissance parfaitement régulière. Le trigger anti-résurrection est BEFORE UPDATE : il ne
    // voit rien. Le fait supprimé revenait, contenu compris.
    //
    // Ce trou est antérieur à R1 et lui aurait survécu. Il se ferme du seul endroit qui ferme quoi
    // que ce soit — le GRANT : `cle_dedoublonnage` sort du `grant update` d'`authenticated`.
    const { error } = await u.client
      .from("fait_extrait")
      .update({ cle_dedoublonnage: `z-libere-${t}` })
      .eq("utilisatrice_id", u.id)
      .eq("cle_dedoublonnage", `z-${t}`);
    expect(error, "la clé du tombstone est encore renommable — AD-18 est ouvert").not.toBeNull();
  });

  it("donc la ré-extraction retombe sur le tombstone et ne ressuscite rien", async () => {
    await semerParExtraction(u, `z-${t}`, "elle aime la montagne");
    const { data } = await u.client
      .from("fait_extrait")
      .select("cle_dedoublonnage, statut, contenu")
      .eq("utilisatrice_id", u.id);
    const lignes = (data ?? []) as { cle_dedoublonnage: string; statut: string; contenu: string }[];
    expect(lignes.length, "une seconde ligne est née : le fait supprimé est revenu").toBe(1);
    expect(lignes[0].statut).toBe("supprime");
    expect(lignes[0].contenu).toBe("");
  });

  it("un DELETE sous JWT se REFUSE au lieu de mentir — un refus qui se dit vaut mieux", async () => {
    // Aucune policy `delete` n'existe (0018, délibéré : le soft-delete garde la clé occupée). Le
    // PRIVILÈGE, lui, était là : le DELETE ne supprimait rien et répondait 200.
    const { error } = await u.client.from("fait_extrait").delete().eq("utilisatrice_id", u.id);
    expect(error).not.toBeNull();
  });
});
