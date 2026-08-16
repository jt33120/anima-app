import { describe, it, expect, beforeAll } from "vitest";
import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { INVENTAIRE_EFFACEMENT } from "@/lib/domain/inventaire-effacement";
import { TABLES_EXPORTEES } from "@/lib/domain/inventaire-export";
import { FENETRE_PITR_JOURS_MAX } from "@/lib/domain/effacement";
import { semerTout } from "./_semis";

/**
 * effacement-sql.test.ts — L'EFFACEMENT, ÉPROUVÉ EN EFFAÇANT (Story 6.7, AC1/AC2/AC4/AC5).
 *
 * ══ L'ASSERTION QUI PORTE TOUTE LA STORY ════════════════════════════════════════════════════════
 *
 * On sème une utilisatrice dans les TRENTE-ET-UNE tables qui la nomment, on efface, puis on cherche
 * son identifiant **dans les trente-six tables du schéma, colonne par colonne**. Pas « dans les
 * tables qu'on pense avoir effacées » — dans TOUTES. Une table oubliée, une cascade cassée, une
 * colonne qui la référence par un autre nom que `utilisatrice_id` : tout tombe sur cette assertion.
 *
 * C'est plus fort qu'une liste de `select count(*)` par table, parce que ça ne dépend pas de savoir
 * PAR QUELLE COLONNE chaque table la nomme — `execution_job.cible_id` aurait échappé à une liste
 * écrite à la main, et c'est exactement la table qu'un inventaire d'export aurait laissée dehors.
 *
 * ══ ET L'ANTI-VACUITÉ EST LA MOITIÉ DU TRAVAIL ═════════════════════════════════════════════════
 *
 * « Son identifiant n'apparaît nulle part » est aussi vrai d'une base vide, d'un semis raté, ou d'un
 * identifiant qui n'a jamais existé. Deux garde-fous : le semis LÈVE à la première ligne qui ne
 * s'écrit pas (`_semis.ts`), et une deuxième utilisatrice, semée à l'identique, doit ressortir
 * INTACTE de l'effacement de la première.
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientNu = () => createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();
const MDP = "test-effacement-123!";
const TOUTES_LES_TABLES = INVENTAIRE_EFFACEMENT.map((e) => e.table);

interface Compte {
  readonly id: string;
  readonly marqueur: string;
  readonly client: SupabaseClient;
}

async function creerCompte(suffixe: string): Promise<Compte> {
  const email = `effacement-${suffixe}-${t}@exemple.fr`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: MDP, email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  const id = data.user!.id;
  const marqueur = `eff${suffixe}${t}`;

  const client = clientNu();
  const { error: eConnexion } = await client.auth.signInWithPassword({ email, password: MDP });
  if (eConnexion) throw new Error(`signIn: ${eConnexion.message}`);

  await semerTout(admin, id, marqueur);
  return { id, marqueur, client };
}

/** Toutes les lignes d'une table, sous `service_role` (qui contourne la RLS). */
async function toutesLesLignes(table: string): Promise<string> {
  const { data, error } = await admin.from(table).select("*");
  if (error) throw new Error(`lecture ${table}: ${error.message}`);
  return JSON.stringify(data ?? []);
}

let alice: Compte;
let berenice: Compte;
let traceId = "";

beforeAll(async () => {
  if (!url || !publishable || !secret) throw new Error("Supabase local requis (URL / PUBLISHABLE / SECRET).");
  alice = await creerCompte("a");
  berenice = await creerCompte("b");

  // ⚠️ CINQ, PAS SEPT, ET C'EST LA CAMPAGNE DE MUTATION QUI L'IMPOSE. Avec la valeur par DÉFAUT,
  // un moteur qui aurait écrit `make_interval(days => 7)` en dur — au lieu de l'argument reçu —
  // produirait exactement le même résultat, et le mutant survivrait. Une valeur qui n'est celle de
  // personne est la seule qui prouve que l'argument a servi.
  const { data, error } = await alice.client.rpc("effacer_toutes_mes_donnees", {
    p_fenetre_pitr_jours: 5,
  });
  if (error) throw new Error(`effacement: ${error.message}`);
  traceId = data as string;
}, 90_000);

describe("[6.7/AC1] Le moteur unique — il ne reste rien, et « rien » se mesure", () => {
  it("[LE CŒUR] son identifiant n'apparaît dans AUCUNE des 36 tables", async () => {
    const restes: string[] = [];
    for (const table of TOUTES_LES_TABLES) {
      if ((await toutesLesLignes(table)).includes(alice.id)) restes.push(table);
    }
    expect(restes, `son identifiant survit dans : ${restes.join(", ")}`).toEqual([]);
  });

  it("[LE CŒUR] son texte non plus — ni un verbatim, ni un nom de branche, ni une empreinte", async () => {
    const restes: string[] = [];
    for (const table of TOUTES_LES_TABLES) {
      if ((await toutesLesLignes(table)).includes(alice.marqueur)) restes.push(table);
    }
    expect(restes, `son texte survit dans : ${restes.join(", ")}`).toEqual([]);
  });

  it("l'identité d'auth elle-même a disparu — une ligne ne portant qu'une adresse en est une aussi", async () => {
    const { data, error } = await admin.auth.admin.getUserById(alice.id);
    expect(data?.user ?? null, "l'utilisatrice existe encore côté auth").toBeNull();
    expect(error, "l'identité d'auth a survécu à l'effacement").not.toBeNull();
  });

  it("[ANTI-VACUITÉ] l'autre utilisatrice est INTACTE — sinon on ne prouverait rien", async () => {
    // Sans elle, « plus rien nulle part » serait aussi le verdict d'une base vidée par erreur.
    const { data, error } = await berenice.client.rpc("exporter_mes_donnees");
    expect(error).toBeNull();
    const doc = data as Record<string, unknown>;
    // On interroge l'export de la 6.6 : c'est la vue la plus complète qui existe de ses 29 couches,
    // et elle est déjà gardée par ailleurs. Une seule section vide voudrait dire que l'effacement
    // d'Alice a mordu sur Bérénice.
    const muettes = TABLES_EXPORTEES.filter(
      (table) => !Array.isArray(doc[table]) || (doc[table] as unknown[]).length === 0,
    );
    expect(muettes, `l'effacement d'une autre a emporté : ${muettes.join(", ")}`).toEqual([]);
    expect(JSON.stringify(doc)).toContain(berenice.marqueur);
  });
});

describe("[6.7/AC5] La trace survit à la personne", () => {
  it("[LE CŒUR] la ligne d'effacement existe TOUJOURS — elle n'a aucune clé vers elle", async () => {
    const { data, error } = await admin.from("effacement").select("*").eq("id", traceId).single();
    expect(error, "la trace a été emportée par la cascade").toBeNull();
    expect(data).toBeTruthy();
  });

  it("elle porte l'EMPREINTE, jamais l'identifiant", async () => {
    const { data } = await admin.from("effacement").select("*").eq("id", traceId).single();
    const ligne = data as Record<string, unknown>;
    const attendue = createHash("sha256").update(alice.id).digest("hex");
    expect(ligne.empreinte).toBe(attendue);
    expect(JSON.stringify(ligne), "l'identifiant est resté sur la trace").not.toContain(alice.id);
    expect(JSON.stringify(ligne), "son texte est resté sur la trace").not.toContain(alice.marqueur);
  });

  it("elle dit QUAND la base a été effacée et JUSQU'À QUAND une copie peut subsister (AC2)", async () => {
    const { data } = await admin.from("effacement").select("*").eq("id", traceId).single();
    const ligne = data as Record<string, string>;
    expect(ligne.motif).toBe("utilisatrice");
    expect(ligne.base_effacee_le, "le moteur n'est pas allé au bout").not.toBeNull();
    expect(ligne.fenetre_pitr_jours).toBe(5);

    const jours =
      (Date.parse(ligne.survivance_jusqu_au) - Date.parse(ligne.demande_le)) / 86_400_000;
    expect(jours).toBeGreaterThan(4.9);
    expect(jours).toBeLessThan(5.1);
  });
});

describe("[6.7/AC2] La fenêtre est bornée par le SCHÉMA, pas par l'appelant", () => {
  it("[LE CŒUR] une fenêtre au-delà du maximum est refusée par la base", async () => {
    // ⚠️ LA BORNE EST UNE CONTRAINTE DE TABLE, ET C'EST TOUT L'INTÉRÊT : elle lie aussi
    // `service_role`, que la RLS ne borne pas. Une vérification écrite dans la fonction seule serait
    // contournée par la première tâche système qui appellerait autrement.
    const compte = await creerCompte("c");
    const { error } = await compte.client.rpc("effacer_toutes_mes_donnees", {
      p_fenetre_pitr_jours: FENETRE_PITR_JOURS_MAX + 1,
    });
    expect(error, "une fenêtre hors borne a été acceptée").not.toBeNull();

    // Et rien n'a été effacé : le refus est ANTÉRIEUR à la première suppression.
    const { data } = await admin.from("utilisatrice").select("id").eq("id", compte.id).maybeSingle();
    expect(data, "la fenêtre a été refusée APRÈS avoir commencé à effacer").toBeTruthy();
  }, 30_000);

  it("une fenêtre négative est refusée PAR LE MOTEUR, avec un motif diagnosticable", async () => {
    // ⚠️ ON EXIGE LE MOTIF, ET UN MUTANT SURVIVANT L'A IMPOSÉ. « Une erreur remonte » était vrai même
    // sans la garde de la fonction : la contrainte `survivance_jusqu_au >= demande_le` refusait
    // l'insertion de toute façon. Deux défenses qui se couvrent l'une l'autre, et un test qui ne
    // sait pas laquelle a mordu — le piège classique. En exigeant `fenetre_invalide`, on distingue
    // le refus PARAMÉTRÉ du refus par ricochet, et on obtient au passage ce qui compte vraiment :
    // qu'un opérateur lise « ton paramètre est faux » plutôt qu'une violation de contrainte sur une
    // colonne qu'il n'a pas écrite.
    const compte = await creerCompte("d");
    const { error } = await compte.client.rpc("effacer_toutes_mes_donnees", {
      p_fenetre_pitr_jours: -1,
    });
    expect(error).not.toBeNull();
    expect(
      `${error?.message ?? ""}`,
      `refus par ricochet plutôt que par la garde : ${error?.message}`,
    ).toContain("fenetre_invalide");
    const { data } = await admin.from("utilisatrice").select("id").eq("id", compte.id).maybeSingle();
    expect(data).toBeTruthy();
  }, 30_000);

  it("sans identité, le moteur LÈVE — il n'efface jamais « personne »", async () => {
    const { error } = await clientNu().rpc("effacer_toutes_mes_donnees", { p_fenetre_pitr_jours: 7 });
    expect(error).not.toBeNull();
  });
});

describe("[6.7/AC4] L'extrait source d'une branche ne part que par l'effacement total", () => {
  it("[LE CŒUR] le supprimer ISOLÉMENT est refusé par la base", async () => {
    // La clé `branche_extrait_meme_proprietaire` est en `on delete restrict`, et c'est la SEULE du
    // schéma qui ne soit pas en cascade. Elle tient le lien branche → extrait, que rien ne doit casser.
    const { data: journal } = await admin
      .from("entree_journal")
      .select("id")
      .eq("utilisatrice_id", berenice.id)
      .limit(1)
      .single();

    const { error } = await admin.from("entree_journal").delete().eq("id", (journal as { id: string }).id);
    expect(error, "un extrait source a pu être supprimé isolément").not.toBeNull();
    expect(error?.code, `code inattendu : ${error?.code}`).toBe("23503");
  });

  it("[CONTRÔLE POSITIF] il part pourtant, quand c'est l'effacement total qui le retire", async () => {
    // Sans ce contrôle, le test ci-dessus serait satisfait par une base qui refuserait TOUT.
    // Alice avait une branche pointant vers son journal ; les deux ont disparu ensemble.
    const journal = await toutesLesLignes("entree_journal");
    const branches = await toutesLesLignes("branche");
    expect(journal).not.toContain(alice.id);
    expect(branches).not.toContain(alice.id);
  });
});
