import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Story 6.3 (T5, AC7 / AC8) — `motifs_anam_du()` CONTRE LE VRAI POSTGRES.
 *
 * ⚠️ POURQUOI CE FICHIER NE PEUT PAS ÊTRE REMPLACÉ PAR DES DOUBLURES. La garde AD-17 de cette story
 * vit ENTIÈREMENT en SQL : la fonction porte `not public.branche_bloquee_par_detresse()` sur ses trois
 * branches. `lire-bibliotheque.ts` ne contient AUCUNE condition de détresse — et c'est délibéré, parce
 * qu'une condition écrite là s'oublierait au premier appelant suivant. Un test sur doublure prouverait
 * donc que le TypeScript fait ce qu'il fait, c'est-à-dire rien.
 *
 * Et la fonction est `security invoker` : elle n'est interrogeable que SOUS SESSION. Sous
 * `service_role` elle rend `permission denied` — le grant ne vise que `authenticated`. C'est le même
 * patron que `charger_proposition_branche`, la seule autre parole in-app d'Anam.
 *
 * CONTRÔLES POSITIFS PARTOUT : sans eux, une fonction qui rendrait TOUJOURS zéro ligne satisferait la
 * moitié de ce fichier. Une carte définitivement muette est aussi cassée qu'une carte bavarde, et
 * beaucoup plus discrète.
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientScope = () => createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();
const MDP = "test-motifs-anam-123!";

interface LigneMotif {
  motif: string;
  jour: string | null;
  titre: string | null;
  detail: string | null;
}

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

async function consentir(id: string) {
  await admin.from("consentement").delete().eq("utilisatrice_id", id);
  const { error } = await admin
    .from("consentement")
    .insert({ utilisatrice_id: id, art9_accorde: true, ia_reconnue: true, cgu_acceptees: true });
  if (error) throw new Error(`consentir: ${error.message}`);
}

async function abonner(id: string) {
  const { error } = await admin
    .from("abonnement")
    .upsert(
      { utilisatrice_id: id, etat: "actif", source_maj_le: new Date().toISOString() },
      { onConflict: "utilisatrice_id" },
    );
  if (error) throw new Error(`abonner: ${error.message}`);
}

async function graverEntree(id: string, marqueur: string): Promise<string> {
  const { data, error } = await admin
    .from("entree_journal")
    .insert({ utilisatrice_id: id, cle_tour: `anam-${marqueur}-${t}`, role: "utilisatrice", contenu: "un tour" })
    .select("id")
    .single();
  if (error) throw new Error(`graverEntree: ${error.message}`);
  return data!.id as string;
}

async function creerBranche(id: string, marqueur: string): Promise<string> {
  const e = await graverEntree(id, `br-${marqueur}-${Math.random()}`);
  const { data, error } = await admin
    .from("branche")
    .insert({ utilisatrice_id: id, extrait_source_id: e, nom: `branche ${marqueur}` })
    .select("id")
    .single();
  if (error) throw new Error(`creerBranche: ${error.message}`);
  return data!.id as string;
}

async function poserIntention(id: string, brancheId: string, echeance: string | null, declencheur: string, action: string) {
  const { error } = await admin
    .from("intention")
    .insert({ utilisatrice_id: id, branche_id: brancheId, declencheur, action, echeance, rang: 1 });
  if (error) throw new Error(`poserIntention: ${error.message}`);
}

async function poserSynthese(id: string, debut: string, fin: string, creeLe?: string) {
  const ligne: Record<string, unknown> = {
    utilisatrice_id: id,
    periode_debut: debut,
    periode_fin: fin,
    contenu: "## Ta semaine\n- tu as repris le dessin",
  };
  if (creeLe) ligne.cree_le = creeLe;
  const { error } = await admin.from("synthese").insert(ligne);
  if (error) throw new Error(`poserSynthese: ${error.message}`);
}

async function poserSignal(id: string, creeLe: string) {
  const e = await graverEntree(id, `sig-${Math.random()}`);
  const { error } = await admin
    .from("signal_reconceptualisation")
    .insert({ utilisatrice_id: id, entree_journal_id: e, statut: "en_attente", cree_le: creeLe });
  if (error) throw new Error(`poserSignal: ${error.message}`);
}

async function ouvrirEpisode(id: string) {
  const { error } = await admin.from("episode_detresse").insert({ utilisatrice_id: id, niveau_max: 2 });
  if (error) throw new Error(`ouvrirEpisode: ${error.message}`);
}

async function fermerEpisodes(id: string) {
  await admin.from("episode_detresse").delete().eq("utilisatrice_id", id);
}

/** Le jour civil Europe/Paris, comme la base le calcule — jamais `toISOString().slice(0, 10)`. */
function jourParis(decalageJours = 0): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(
    new Date(Date.now() + decalageJours * 86_400_000),
  );
}

async function motifs(c: SupabaseClient): Promise<LigneMotif[]> {
  const { data, error } = await c.rpc("motifs_anam_du");
  if (error) throw new Error(`motifs_anam_du: ${error.message}`);
  return (data ?? []) as LigneMotif[];
}

async function purger(id: string) {
  if (!id) return;
  await admin.from("intention").delete().eq("utilisatrice_id", id);
  await admin.from("synthese").delete().eq("utilisatrice_id", id);
  await admin.from("signal_reconceptualisation").delete().eq("utilisatrice_id", id);
  await admin.from("branche").delete().eq("utilisatrice_id", id);
  await admin.from("episode_detresse").delete().eq("utilisatrice_id", id);
  await admin.from("entree_journal").delete().eq("utilisatrice_id", id);
  await admin.from("abonnement").delete().eq("utilisatrice_id", id);
  await admin.from("consentement").delete().eq("utilisatrice_id", id);
  await admin.auth.admin.deleteUser(id);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════

describe("[6.3/AC6] les trois motifs, vus depuis l'application", () => {
  const email = `motifs-anam-${t}@exemple.test`;
  let id = "";
  let c: SupabaseClient;

  beforeAll(async () => {
    id = await creerUtilisatrice(email);
    await consentir(id);
    await abonner(id);
    c = await session(email);
  });
  afterAll(async () => purger(id));

  it("[CONTRÔLE NÉGATIF] un compte sans rien ne rend AUCUN motif", async () => {
    expect(await motifs(c)).toEqual([]);
  });

  it("une échéance D'AUJOURD'HUI rend ses DEUX moitiés, telles qu'elle les a écrites", async () => {
    const b = await creerBranche(id, "ech");
    await poserIntention(id, b, jourParis(0), "je sens que je me ferme", "j'écris une phrase");

    const l = (await motifs(c)).filter((m) => m.motif === "echeance_intention");
    expect(l).toHaveLength(1);
    expect(l[0].jour).toBe(jourParis(0));
    expect(l[0].titre).toBe("je sens que je me ferme");
    expect(l[0].detail).toBe("j'écris une phrase");
  });

  it("[LE CŒUR] une échéance PASSÉE ne rend rien — un rappel en retard est un reproche daté", async () => {
    // Mutation-cible : `<=` au lieu de `=` dans la branche (1). Même sémantique que le canal sortant
    // (`intentions_echues`) : les deux chemins ne peuvent pas diverger, parce qu'ils disent la même
    // chose. Une ligne qui traîne trois jours sur l'accueil est ce que la 4.10 a refusé.
    await admin.from("intention").delete().eq("utilisatrice_id", id);
    const b = await creerBranche(id, "hier");
    await poserIntention(id, b, jourParis(-1), "hier", "hier aussi");
    expect((await motifs(c)).filter((m) => m.motif === "echeance_intention")).toEqual([]);

    // …et une échéance de DEMAIN non plus : elle n'est pas due, elle est prévue.
    await admin.from("intention").delete().eq("utilisatrice_id", id);
    const b2 = await creerBranche(id, "demain");
    await poserIntention(id, b2, jourParis(1), "demain", "demain aussi");
    expect((await motifs(c)).filter((m) => m.motif === "echeance_intention")).toEqual([]);

    await admin.from("intention").delete().eq("utilisatrice_id", id);
  });

  it("une synthèse récente rend la fin de sa période ; une synthèse VIEILLE ne rend rien", async () => {
    // La MÊME fenêtre que `syntheses_non_annoncees(_, 3)` : ce que le canal sortant considère encore
    // annonçable est exactement ce que la carte considère encore frais.
    await poserSynthese(id, "2026-08-01T00:00:00Z", "2026-08-07T00:00:00Z");
    const l = (await motifs(c)).filter((m) => m.motif === "synthese_prete");
    expect(l).toHaveLength(1);
    expect(l[0].jour).toBe("2026-08-07");
    // Aucun extrait du récit ne traverse : la carte annonce, elle ne résume pas.
    expect(l[0].titre).toBeNull();
    expect(l[0].detail).toBeNull();

    await admin.from("synthese").delete().eq("utilisatrice_id", id);
    const vieille = new Date(Date.now() - 5 * 86_400_000).toISOString();
    await poserSynthese(id, "2026-07-01T00:00:00Z", "2026-07-07T00:00:00Z", vieille);
    expect((await motifs(c)).filter((m) => m.motif === "synthese_prete")).toEqual([]);
    await admin.from("synthese").delete().eq("utilisatrice_id", id);
  });

  it("un signal de LA VEILLE rend une proposition, et AUCUN verbatim", async () => {
    await poserSignal(id, new Date(Date.now() - 30 * 3_600_000).toISOString());
    const l = (await motifs(c)).filter((m) => m.motif === "proposition_branche");
    expect(l).toHaveLength(1);
    // Minimisation héritée de la 4.5 : la proposition est générique, rien de sa main ne traverse.
    expect(l[0].titre).toBeNull();
    expect(l[0].detail).toBeNull();
  });

  it("un signal DU JOUR ne rend rien — « le lendemain », comme `charger_proposition_branche`", async () => {
    await admin.from("signal_reconceptualisation").delete().eq("utilisatrice_id", id);
    await poserSignal(id, new Date().toISOString());
    expect((await motifs(c)).filter((m) => m.motif === "proposition_branche")).toEqual([]);
    await admin.from("signal_reconceptualisation").delete().eq("utilisatrice_id", id);
  });
});

describe("[6.3/AC7 · AD-17] la détresse ferme la porte in-app comme elle ferme le canal", () => {
  const email = `motifs-anam-detresse-${t}@exemple.test`;
  let id = "";
  let c: SupabaseClient;

  beforeAll(async () => {
    id = await creerUtilisatrice(email);
    await consentir(id);
    await abonner(id);
    c = await session(email);
    const b = await creerBranche(id, "d");
    await poserIntention(id, b, jourParis(0), "je sens que je me ferme", "j'écris une phrase");
    await poserSynthese(id, "2026-08-01T00:00:00Z", "2026-08-07T00:00:00Z");
    await poserSignal(id, new Date(Date.now() - 30 * 3_600_000).toISOString());
  });
  afterAll(async () => purger(id));

  it("[CONTRÔLE POSITIF] hors épisode, LES TROIS motifs sont là", async () => {
    // ⚠️ SANS CETTE LIGNE, LE TEST SUIVANT NE PROUVE RIEN. Une fonction qui rendrait toujours zéro
    // serait « conforme » à la garde de détresse tout en ayant supprimé la carte pour tout le monde.
    await fermerEpisodes(id);
    expect((await motifs(c)).map((m) => m.motif).sort()).toEqual([
      "echeance_intention",
      "proposition_branche",
      "synthese_prete",
    ]);
  });

  it("[LE CŒUR] en épisode ouvert, les TROIS branches se taisent", async () => {
    // Mutation-cible : retirer `and not public.branche_bloquee_par_detresse()` de l'une des trois.
    // Les trois sont vérifiées ENSEMBLE et le même test les couvre : une seule branche gardée
    // laisserait deux fuites, et un test par motif se serait contenté de la première.
    await ouvrirEpisode(id);
    expect(await motifs(c)).toEqual([]);
  });

  it("la fenêtre de 72 h continue de fermer APRÈS la fin de l'épisode", async () => {
    // Mutation-cible : une garde qui ne regarderait que `fin is null`. AD-17 porte sur l'épisode ET
    // sur les 72 h qui suivent — c'est `branche_bloquee_par_detresse()` qui tient les deux, et c'est
    // pour ça qu'on l'appelle plutôt que d'écrire la condition à la main.
    await fermerEpisodes(id);
    const fin = new Date(Date.now() - 3_600_000).toISOString();
    const { error } = await admin.from("episode_detresse").insert({
      utilisatrice_id: id,
      niveau_max: 2,
      debut: new Date(Date.now() - 7_200_000).toISOString(),
      fin,
      fenetre_expire_at: new Date(Date.now() + 71 * 3_600_000).toISOString(),
    });
    if (error) throw new Error(`episode clos: ${error.message}`);

    expect(await motifs(c)).toEqual([]);
    await fermerEpisodes(id);
  });
});

describe("[6.3] la fonction est POSSÉDÉE, et elle ne franchit pas la frontière de propriété", () => {
  const emailA = `motifs-anam-a-${t}@exemple.test`;
  const emailB = `motifs-anam-b-${t}@exemple.test`;
  let idA = "";
  let idB = "";

  beforeAll(async () => {
    idA = await creerUtilisatrice(emailA);
    idB = await creerUtilisatrice(emailB);
    for (const id of [idA, idB]) {
      await consentir(id);
      await abonner(id);
    }
    const b = await creerBranche(idA, "propriete");
    await poserIntention(idA, b, jourParis(0), "les mots de A", "l'action de A");
  });
  afterAll(async () => {
    await purger(idA);
    await purger(idB);
  });

  it("[LE CŒUR] B ne voit RIEN de ce qui appartient à A", async () => {
    const cB = await session(emailB);
    expect(await motifs(cB)).toEqual([]);
    // …et le contrôle positif : A, lui, le voit.
    const cA = await session(emailA);
    expect((await motifs(cA)).map((m) => m.titre)).toEqual(["les mots de A"]);
  });

  it("[LE CŒUR] sous `service_role`, la fonction est AVEUGLE — aucune session, donc aucune ligne", async () => {
    // ⚠️ CE TEST DIT LE CONTRAIRE DE CE QUE J'AVAIS CRU. J'avais mesuré `permission denied` en cours
    // d'implémentation et conclu que le grant fermait la porte à `service_role`. C'est faux :
    // `charger_proposition_branche`, le modèle de cette fonction, répond exactement pareil — pas
    // d'erreur, zéro ligne. La mesure d'origine portait sur un état antérieur au `db reset`.
    //
    // Ce qui ferme la porte n'est donc pas le grant, c'est `security invoker` + `auth.uid()` : sans
    // session, la clause de propriété ne peut matcher personne. La propriété qui compte est celle-ci,
    // et elle est plus forte que celle que j'avais annoncée — elle garantit qu'aucun job
    // d'ordonnanceur ne pourra se servir de cette fonction pour décider d'un ENVOI, quel que soit le
    // grant qu'on lui donnera un jour. Cette fonction est faite pour un écran.
    //
    // Mutation-cible : lui ajouter un paramètre `p_utilisatrice`. Elle deviendrait alors appelable
    // depuis l'ordonnanceur, et la 6.3 aurait fabriqué le canal qu'elle refuse d'ouvrir.
    const { data, error } = await admin.rpc("motifs_anam_du");
    expect(error, "elle répond, elle ne lève pas").toBeNull();
    expect(data, "…mais elle ne voit RIEN, alors que A a bien une échéance du jour").toEqual([]);
  });
});
