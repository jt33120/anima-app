import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { creerDepotEnneagramme, reponsesEnJson } from "@/lib/data/depot-enneagramme";
import {
  lireEnneagramme,
  chargerHypotheseADire,
  lireHypotheseEnneagramme,
  lireTentativeEnneagramme,
  reponsesDepuisJson,
} from "@/lib/data/lire-enneagramme";
import { ITEMS } from "@/lib/domain/enneagramme-items";
import type { ReponseItem } from "@/lib/domain/enneagramme";

/**
 * enneagramme-depot-sql.test.ts — LE DÉPÔT ET LES LECTURES, CONTRE LA VRAIE BASE (Story 5.5, T6).
 *
 * `tests/enneagramme-sql.test.ts` éprouve les POLICIES par l'API REST nue. Ce fichier-ci éprouve la
 * COUCHE `lib/data` qui les traverse — et il vise ce qu'aucun test de policy ne peut atteindre :
 *
 *   • l'ATOMICITÉ des deux RPC. « Le type entre, la tentative sort » est une promesse écrite en
 *     tête de 0049 ; ici on coupe le consentement au milieu et on vérifie que la tentative SURVIT.
 *     En deux appels séparés, elle serait perdue et le test passerait quand même.
 *   • la STABILITÉ de `tentative_id` d'un enregistrement à l'autre — le mutant « mettre
 *     `tentative_id` dans la charge utile de l'upsert » remonterait le composant à chaque clic.
 *   • la distinction « à DIRE » / « à RÉPONDRE » (leçon 0045), invisible depuis SQL seul.
 *   • que 42501 et 23505 sont AVALÉS pour le germe, et LEVÉS partout ailleurs.
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientScope = () =>
  createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();

interface Utilisatrice {
  id: string;
  client: SupabaseClient;
}

async function creerUtilisatrice(suffixe: string): Promise<Utilisatrice> {
  const email = `enndep-${suffixe}-${t}@exemple.fr`;
  const motDePasse = "test-enndep-123!";
  const { data, error } = await admin.auth.admin.createUser({ email, password: motDePasse, email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  const id = data.user!.id;
  const { error: e2 } = await admin.from("utilisatrice").update({ date_naissance: "1990-06-15" }).eq("id", id);
  if (e2) throw new Error(`date_naissance: ${e2.message}`);
  const { error: e3 } = await admin.from("consentement").upsert(
    { utilisatrice_id: id, art9_accorde: true, ia_reconnue: true, cgu_acceptees: true },
    { onConflict: "utilisatrice_id" },
  );
  if (e3) throw new Error(`consentement: ${e3.message}`);
  const client = clientScope();
  const { error: e4 } = await client.auth.signInWithPassword({ email, password: motDePasse });
  if (e4) throw new Error(`signIn: ${e4.message}`);
  return { id, client };
}

async function revoquer(id: string): Promise<void> {
  const { error } = await admin
    .from("consentement")
    .update({ revoked_at: new Date().toISOString() })
    .eq("utilisatrice_id", id)
    .is("revoked_at", null);
  if (error) throw new Error(`revocation: ${error.message}`);
}

async function ouvrirEpisode(id: string): Promise<void> {
  const { error } = await admin.from("episode_detresse").insert({ utilisatrice_id: id, niveau_max: 2 });
  if (error) throw new Error(`ouvrirEpisode: ${error.message}`);
}

/** Éteint l'épisode et pose la fenêtre de 72 h — le geste réel de l'extinction (0010). */
async function eteindreEpisode(id: string, fenetreDansMs: number): Promise<void> {
  const maintenant = new Date();
  const { error } = await admin
    .from("episode_detresse")
    .update({
      fin: maintenant.toISOString(),
      fenetre_expire_at: new Date(maintenant.getTime() + fenetreDansMs).toISOString(),
    })
    .eq("utilisatrice_id", id)
    .is("fin", null);
  if (error) throw new Error(`eteindreEpisode: ${error.message}`);
}

async function nettoyer(id: string): Promise<void> {
  await admin.from("episode_detresse").delete().eq("utilisatrice_id", id);
  await admin.auth.admin.deleteUser(id);
}

const depot = (u: Utilisatrice) => creerDepotEnneagramme(u.id, u.client);

/** Dix-huit réponses complètes — construites depuis les VRAIS items, jamais recopiées. */
function toutesLesReponses(niveau: 0 | 1 | 2 | 3 = 2): ReponseItem[] {
  return ITEMS.map((i) => ({ itemId: i.id, niveau }));
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// La tentative : elle se persiste, elle se reprend, et son identité NE BOUGE PAS
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.5/T6] la tentative survit à la fermeture de l'onglet (NFR-017)", () => {
  let u: Utilisatrice;
  beforeAll(async () => {
    u = await creerUtilisatrice("tentative");
  });
  afterAll(async () => nettoyer(u.id));

  it("aucune tentative au départ — et ce n'est PAS un incident", async () => {
    const r = await lireTentativeEnneagramme(u.client, u.id);
    expect(r).toEqual({ statut: "indisponible", raison: "aucune" });
  });

  it("[LE TEST QUI COMPTE] `tentative_id` est STABLE d'un enregistrement à l'autre", async () => {
    // Le mutant visé : ajouter `tentative_id` à la charge utile de l'upsert. Il régénérerait
    // l'identifiant à chaque réponse — donc remonterait le composant (`key={tentativeId}`, D8) à
    // chaque clic, donc perdrait le focus à chaque clic. Invisible sur une seule écriture.
    const d = depot(u);
    const premier = await d.enregistrerReponses({ reponses: [{ itemId: ITEMS[0].id, niveau: 3 }] });
    const second = await d.enregistrerReponses({
      reponses: [
        { itemId: ITEMS[0].id, niveau: 3 },
        { itemId: ITEMS[1].id, niveau: 1 },
      ],
    });
    expect(second).toBe(premier);
  });

  it("les réponses se relisent NOMINALEMENT, jamais par position (D7)", async () => {
    const r = await lireTentativeEnneagramme(u.client, u.id);
    expect(r.statut).toBe("calcule");
    if (r.statut !== "calcule") return;
    const parId = new Map(r.tentative.reponses.map((x) => [x.itemId, x.niveau]));
    expect(parId.get(ITEMS[0].id)).toBe(3);
    expect(parId.get(ITEMS[1].id)).toBe(1);
    expect(r.tentative.reponses).toHaveLength(2);
  });

  it("un item répondu deux fois ne garde que la DERNIÈRE — comme `scorer`", async () => {
    // Les deux règles doivent coïncider : si elles divergeaient, ce qui est marqué à l'écran et ce
    // qui est scoré ne seraient pas la même chose, de façon parfaitement déterministe donc invisible.
    const d = depot(u);
    await d.enregistrerReponses({
      reponses: [
        { itemId: ITEMS[0].id, niveau: 3 },
        { itemId: ITEMS[0].id, niveau: 0 },
      ],
    });
    const r = await lireTentativeEnneagramme(u.client, u.id);
    if (r.statut !== "calcule") throw new Error("tentative attendue");
    expect(r.tentative.reponses).toEqual([{ itemId: ITEMS[0].id, niveau: 0 }]);
  });

  it("abandonner rend `true` une fois, `false` ensuite — jamais une erreur", async () => {
    const d = depot(u);
    expect(await d.abandonnerTentative()).toBe(true);
    expect(await d.abandonnerTentative()).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Conclure : le type entre, la tentative sort, DANS LA MÊME TRANSACTION
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.5/AC1] conclure le test court", () => {
  let u: Utilisatrice;
  beforeAll(async () => {
    u = await creerUtilisatrice("conclure");
  });
  afterAll(async () => nettoyer(u.id));

  it("sans tentative, conclure rend `false` et n'écrit AUCUN type", async () => {
    // « Une tentative absente ne se conclut pas ». Sans cette clause, un POST REST direct sur la RPC
    // poserait un type sur un compte qui n'a jamais répondu à un seul énoncé.
    const d = depot(u);
    expect(await d.terminerTentative({ type: 5 })).toBe(false);
    expect(await lireEnneagramme(u.client, u.id)).toEqual({
      statut: "indisponible",
      raison: "sans_type",
    });
  });

  it("le type entre ET la tentative sort", async () => {
    const d = depot(u);
    await d.enregistrerReponses({ reponses: toutesLesReponses() });
    expect(await d.terminerTentative({ type: 4 })).toBe(true);

    const type = await lireEnneagramme(u.client, u.id);
    expect(type.statut).toBe("calcule");
    if (type.statut !== "calcule") return;
    expect(type.type).toBe(4);
    expect(type.origine).toBe("test");
    // v1 : les neuf créneaux sont déclarés et aucun n'est écrit. L'écran le dit honnêtement.
    expect(type.texte).toEqual({ statut: "non_ecrit" });

    // Les dix-huit auto-évaluations ne survivent PAS au type qu'on en tire (décision Julian).
    expect(await lireTentativeEnneagramme(u.client, u.id)).toEqual({
      statut: "indisponible",
      raison: "aucune",
    });
  });

  it("conclure deux fois : la seconde rend `false`, et le type reste celui de la première", async () => {
    // Deux onglets qui concluent en même temps. Le second ne doit ni écrire, ni annoncer un échec —
    // l'appelant RELIT, et trouve un type parfaitement valide.
    const d = depot(u);
    expect(await d.terminerTentative({ type: 9 })).toBe(false);
    const type = await lireEnneagramme(u.client, u.id);
    if (type.statut !== "calcule") throw new Error("type attendu");
    expect(type.type).toBe(4);
  });

  it("refaire le test CORRIGE le type (AC2) — la ligne n'est pas immuable", async () => {
    const d = depot(u);
    await d.enregistrerReponses({ reponses: toutesLesReponses(1) });
    expect(await d.terminerTentative({ type: 7 })).toBe(true);
    const type = await lireEnneagramme(u.client, u.id);
    if (type.statut !== "calcule") throw new Error("type attendu");
    expect(type.type).toBe(7);
  });

  it("un type hors domaine LÈVE (contrainte de table), il n'entre pas", async () => {
    const d = depot(u);
    await d.enregistrerReponses({ reponses: toutesLesReponses() });
    await expect(d.terminerTentative({ type: 12 as never })).rejects.toThrow(/23514/);
    // Et la tentative est toujours là : la transaction entière a été annulée.
    expect((await lireTentativeEnneagramme(u.client, u.id)).statut).toBe("calcule");
  });
});

describe("[5.5/T6 ATOMICITÉ] le consentement coupé au milieu ne lui coûte PAS ses réponses", () => {
  let u: Utilisatrice;
  beforeAll(async () => {
    u = await creerUtilisatrice("atomique");
  });
  afterAll(async () => nettoyer(u.id));

  it("[LE TEST QUI COMPTE] conclure sous consentement révoqué : refus, et la tentative SURVIT", async () => {
    // Le mutant visé : remplacer la RPC par deux appels (delete puis insert). Il passerait tous les
    // autres tests de ce fichier — et perdrait dix-huit réponses art. 9 le jour où l'écriture du
    // type est refusée. C'est la seule preuve de l'atomicité promise en tête de 0049.
    const d = depot(u);
    await d.enregistrerReponses({ reponses: toutesLesReponses() });
    await revoquer(u.id);

    await expect(d.terminerTentative({ type: 3 })).rejects.toThrow(/42501/);

    expect((await lireTentativeEnneagramme(u.client, u.id)).statut).toBe("calcule");
    expect((await lireEnneagramme(u.client, u.id)).statut).toBe("indisponible");
  });

  it("effacer sa tentative reste ouvert après révocation — c'est un retrait", async () => {
    expect(await depot(u).abandonnerTentative()).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// L'hypothèse d'Anam
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.5/AC2] le germe : semé, dit une fois, répondable toujours", () => {
  let u: Utilisatrice;
  let germe: string;
  beforeAll(async () => {
    u = await creerUtilisatrice("germe");
  });
  afterAll(async () => nettoyer(u.id));

  it("aucune hypothèse au départ", async () => {
    expect(await lireHypotheseEnneagramme(u.client, u.id)).toEqual({
      statut: "indisponible",
      raison: "aucune",
    });
  });

  it("le germe se sème et rend son identifiant", async () => {
    const id = await depot(u).deposerHypothese({ type: 6 });
    expect(typeof id).toBe("string");
    germe = id!;
  });

  it("une SECONDE hypothèse en attente est refusée par l'index — `null`, pas une exception", async () => {
    // L'étage `after()` ne consulte jamais `request.signal.aborted` : il peut s'exécuter deux fois.
    // Sans cet index, Anam finirait avec trois hypothèses et en dirait une par chargement.
    expect(await depot(u).deposerHypothese({ type: 2 })).toBeNull();
  });

  it("elle est À DIRE tant qu'elle n'a pas atteint un écran", async () => {
    const r = await lireHypotheseEnneagramme(u.client, u.id, { seulementADire: true });
    expect(r.statut).toBe("calcule");
    if (r.statut !== "calcule") return;
    expect(r.hypothese).toEqual({ id: germe, type: 6, aDire: true });
  });

  it("[LE TEST QUI COMPTE] une fois DITE, elle ne se redit pas — mais reste À RÉPONDRE", async () => {
    // Le mutant visé : une seule lecture pour les deux besoins. Selon le sens choisi, Anam répète sa
    // question à chaque chargement, ou les trois portes (accepter, refuser, corriger) disparaissent
    // de la halte dès la première phrase affichée.
    const d = depot(u);
    expect(await d.marquerHypotheseDite({ hypotheseId: germe, maintenant: new Date() })).toBe(true);
    expect(await d.marquerHypotheseDite({ hypotheseId: germe, maintenant: new Date() })).toBe(false);

    expect(await lireHypotheseEnneagramme(u.client, u.id, { seulementADire: true })).toEqual({
      statut: "indisponible",
      raison: "aucune",
    });
    const encore = await lireHypotheseEnneagramme(u.client, u.id);
    if (encore.statut !== "calcule") throw new Error("hypothèse attendue");
    expect(encore.hypothese).toEqual({ id: germe, type: 6, aDire: false });
  });

  it("accepter écrit LE TYPE DE LA LIGNE, avec origine « hypothese »", async () => {
    expect(await depot(u).accepterHypothese({ hypotheseId: germe })).toBe(true);
    const type = await lireEnneagramme(u.client, u.id);
    if (type.statut !== "calcule") throw new Error("type attendu");
    expect(type.type).toBe(6);
    expect(type.origine).toBe("hypothese");
  });

  it("accepter deux fois : la seconde rend `false` (état terminal)", async () => {
    expect(await depot(u).accepterHypothese({ hypotheseId: germe })).toBe(false);
  });

  it("une hypothèse répondue n'est plus en attente", async () => {
    expect(await lireHypotheseEnneagramme(u.client, u.id)).toEqual({
      statut: "indisponible",
      raison: "aucune",
    });
  });
});

describe("[5.5/AC4] pendant un épisode de détresse, Anam ne propose PAS de typologie", () => {
  let u: Utilisatrice;
  beforeAll(async () => {
    u = await creerUtilisatrice("detresse");
    await ouvrirEpisode(u.id);
  });
  afterAll(async () => nettoyer(u.id));

  it("le germe est refusé — `null`, et l'étage `after()` n'en meurt pas", async () => {
    expect(await depot(u).deposerHypothese({ type: 4 })).toBeNull();
  });

  it("[CONTRÔLE DU CONTRÔLE] le MÊME appel réussit une fois l'épisode clos", async () => {
    // Sans ce témoin, « rend toujours `null` » passerait le test précédent.
    await admin.from("episode_detresse").delete().eq("utilisatrice_id", u.id);
    expect(await depot(u).deposerHypothese({ type: 4 })).not.toBeNull();
  });

  it("[CONTRÔLE] le test court, lui, N'EST PAS suspendu — c'est un geste d'elle", async () => {
    await ouvrirEpisode(u.id);
    const d = depot(u);
    await expect(d.enregistrerReponses({ reponses: toutesLesReponses() })).resolves.toBeTruthy();
    expect(await d.terminerTentative({ type: 8 })).toBe(true);
  });
});

describe("[5.5/AC6] refuser et effacer SURVIVENT à la révocation du consentement", () => {
  let u: Utilisatrice;
  let germe: string;
  beforeAll(async () => {
    u = await creerUtilisatrice("revocation");
    germe = (await depot(u).deposerHypothese({ type: 3 }))!;
    await depot(u).enregistrerReponses({ reponses: toutesLesReponses() });
    await depot(u).terminerTentative({ type: 3 });
    await revoquer(u.id);
  });
  afterAll(async () => nettoyer(u.id));

  it("[LE CŒUR] accepter est refusé ET l'hypothèse RESTE en attente", async () => {
    // Rollback complet : elle n'a pas obtenu son type, donc rien ne doit se lire comme si elle
    // l'avait accepté. Si l'update passait seule, l'hypothèse serait « acceptée » sans type — un
    // état que rien dans le produit ne sait afficher.
    await expect(depot(u).accepterHypothese({ hypotheseId: germe })).rejects.toThrow(/42501/);
    const r = await lireHypotheseEnneagramme(u.client, u.id);
    if (r.statut !== "calcule") throw new Error("hypothèse attendue");
    expect(r.hypothese.id).toBe(germe);
  });

  it("refuser RÉUSSIT — c'est le geste de celle qui vient précisément de révoquer", async () => {
    expect(await depot(u).refuserHypothese({ hypotheseId: germe })).toBe(true);
  });

  it("refuser deux fois rend `false`, jamais une résurrection", async () => {
    expect(await depot(u).refuserHypothese({ hypotheseId: germe })).toBe(false);
  });

  it("effacer son type RÉUSSIT (FR-067)", async () => {
    expect(await depot(u).effacerType()).toBe(true);
    expect(await lireEnneagramme(u.client, u.id)).toEqual({
      statut: "indisponible",
      raison: "sans_type",
    });
  });

  it("effacer un type absent rend `false` — pas une erreur", async () => {
    expect(await depot(u).effacerType()).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Les RPC ne sont pas ouvertes à `anon`
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.5/AC5] `anon` n'exécute aucune des deux RPC", () => {
  it("les deux refusent au PRIVILÈGE, pas seulement à la RLS", async () => {
    const anon = clientScope();
    for (const [nom, args] of [
      ["terminer_tentative_enneagramme", { p_type: 4 }],
      ["accepter_hypothese_enneagramme", { p_hypothese: "00000000-0000-0000-0000-000000000000" }],
    ] as const) {
      const { error } = await anon.rpc(nom, args);
      expect(error?.code, nom).toBe("42501");
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Les deux conversions, sans base
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.5/T6] la relecture ne fait pas confiance à ce qu'elle lit", () => {
  it("un niveau hors 0..3 est ÉCARTÉ, jamais ramené à 0", async () => {
    // Le ramener à 0 répondrait « pas du tout » à sa place, et `conclure` ne pourrait plus dire
    // « incomplet » en nommant l'item.
    expect(reponsesDepuisJson({ e1a: 2, e1b: 9, e2a: -1, e2b: null })).toEqual([
      { itemId: "e1a", niveau: 2 },
    ]);
  });

  it("un JSON qui n'est pas un objet rend une liste vide, sans lever", () => {
    for (const brut of [null, undefined, 3, "e1a", [1, 2, 3]]) {
      expect(reponsesDepuisJson(brut), String(brut)).toEqual([]);
    }
  });

  it("aller-retour : ce qui est écrit est ce qui est relu", () => {
    const reponses = toutesLesReponses(3);
    expect(reponsesDepuisJson(reponsesEnJson(reponses))).toEqual(reponses);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// [R4] LE GERME EST GARDÉ À LA PAROLE, PAS SEULEMENT À LA SEMENCE (revue Epic 5 · migration 0063)
// ══════════════════════════════════════════════════════════════════════════════════════════════
//
// ⚠️ 0049 ne portait `branche_bloquee_par_detresse()` QU'AU `with check` de l'insertion. La base
// interdisait donc de SEMER un germe pendant un épisode, et n'interdisait rien quant au fait de le
// DIRE — alors que son propre en-tête justifie la garde par la parole (« proposer une typologie de
// personnalité à quelqu'un en détresse est la définition du mauvais moment »).
//
// Le germe est PERSISTANT par conception : il attend qu'elle revienne. Un épisode de détresse est
// exactement le moment où l'on revient. Et la parole est DÉPENSÉE au premier affichage — le germe
// prononcé en crise n'est jamais redit à un moment calme.

describe("[R4 · AD-17] Anam ne propose pas de typologie pendant un épisode ni dans les 72 h", () => {
  let u: Utilisatrice;
  beforeAll(async () => {
    u = await creerUtilisatrice("parole");
    // Le germe est semé À FROID — hors de tout épisode, exactement comme dans le parcours réel.
    const { error } = await admin
      .from("enneagramme_hypothese")
      .insert({ utilisatrice_id: u.id, type: 4, statut: "en_attente" });
    if (error) throw new Error(`germe: ${error.message}`);
  });
  afterAll(async () => {
    await admin.from("enneagramme_hypothese").delete().eq("utilisatrice_id", u.id);
    await nettoyer(u.id);
  });

  it("[CONTRÔLE POSITIF] hors détresse, le germe est dû — sinon tout ce qui suit est vide", async () => {
    const r = await chargerHypotheseADire(u.client);
    expect(r.statut).toBe("calcule");
    if (r.statut === "calcule") expect(r.hypothese.aDire).toBe(true);
  });

  it("[LE CŒUR] épisode OUVERT → Anam se tait, et le germe N'EST PAS DÉPENSÉ", async () => {
    await ouvrirEpisode(u.id);
    expect(await chargerHypotheseADire(u.client)).toEqual({
      statut: "indisponible",
      raison: "aucune",
    });
    // ⚠️ La moitié qui compte : se taire ne doit pas consommer. Le germe doit être encore là
    // quand elle ira mieux — c'est la raison d'être du report, pas un effet de bord.
    const { data } = await admin
      .from("enneagramme_hypothese")
      .select("statut, dite_le")
      .eq("utilisatrice_id", u.id)
      .single();
    expect(data).toEqual({ statut: "en_attente", dite_le: null });
  });

  it("[L'HORLOGE LARGE] épisode ÉTEINT mais dans les 72 h → Anam se tait encore (FR-042)", async () => {
    // C'est ici que se joue le choix d'horloge. `limites_levees` (le commerce, FR-043) s'arrête à
    // l'extinction ; la garde de branche (FR-042) court 72 h de plus. Ce germe suit la SECONDE,
    // parce que c'est la règle de ce qui NAÎT, pas de ce qui vend.
    await eteindreEpisode(u.id, 60 * 60 * 1000); // fenêtre encore ouverte pour une heure
    expect(await chargerHypotheseADire(u.client)).toEqual({
      statut: "indisponible",
      raison: "aucune",
    });
  });

  it("la fenêtre passée, le germe REVIENT — le report n'est pas une perte", async () => {
    await admin
      .from("episode_detresse")
      .update({ fenetre_expire_at: new Date(Date.now() - 1000).toISOString() })
      .eq("utilisatrice_id", u.id);
    const r = await chargerHypotheseADire(u.client);
    expect(r.statut).toBe("calcule");
  });

  it("[LA DÉCISION, GARDÉE] /enneagramme continue de LUI montrer son résultat, même en épisode", async () => {
    // ⚠️ NE PAS « HARMONISER » CECI. Ce qui est refusé, c'est qu'Anam lui PARLE d'elle-même au
    // mauvais moment. Une page qu'elle a ouverte délibérément pour y lire son propre résultat n'est
    // pas Anam qui parle : la lui fermer en crise serait un refus d'accès à ses données (art. 15),
    // et c'est le même arbitrage qu'en 3.5 pour la résiliation.
    await admin
      .from("episode_detresse")
      .update({ fin: null, fenetre_expire_at: null })
      .eq("utilisatrice_id", u.id);
    const r = await lireHypotheseEnneagramme(u.client, u.id);
    expect(r.statut, "la halte doit rester lisible en épisode ouvert").toBe("calcule");
  });
});
