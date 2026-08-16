import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { TABLES_EXPORTEES, COLONNES_RETIREES } from "@/lib/domain/inventaire-export";

/**
 * export-sql.test.ts — CONTRE LE VRAI POSTGRES (Story 6.6, AC1/AC3).
 *
 * ══ CE FICHIER EST LE PRIX DU `security definer` ════════════════════════════════════════════════
 *
 * `exporter_mes_donnees()` contourne la RLS — c'est le seul moyen de servir les onze tables
 * deny-by-default sans ouvrir onze policies de lecture (voir l'encadré de 0057). En échange, la
 * seule serrure de chaque sous-requête est son `where utilisatrice_id = v_uid`, et une seule oubliée
 * livrerait la table entière de TOUT LE MONDE dans un fichier téléchargeable.
 *
 * Alors on sème DEUX utilisatrices dans les vingt-neuf tables, et on exige que l'export de l'une ne
 * contienne aucune ligne de l'autre. L'assertion ne cherche pas un marqueur de texte — elle vérifie
 * l'identité PORTÉE PAR CHAQUE LIGNE. Un `where` retiré de n'importe laquelle des vingt-neuf
 * sous-requêtes fait rougir ce test immédiatement.
 *
 * ⚠️ ET L'ANTI-VACUITÉ EST LA MOITIÉ DU TRAVAIL. « Aucune ligne d'autrui » est aussi le résultat
 * d'un export VIDE, ou d'un semis qui a silencieusement échoué. Le premier test exige donc que les
 * vingt-neuf sections soient NON VIDES avant que l'isolation ne veuille dire quoi que ce soit.
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientNu = () => createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();
const MDP = "test-export-123!";

interface Compte {
  readonly id: string;
  readonly marqueur: string;
  readonly client: SupabaseClient;
}

async function poser(table: string, ligne: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await admin.from(table).insert(ligne).select().single();
  // Un semis raté rendrait l'isolation vraie POUR RIEN : on refuse d'avancer.
  if (error) throw new Error(`semis ${table}: ${error.message}`);
  return data as Record<string, unknown>;
}

/** Sème une ligne dans CHACUNE des 29 tables exportées. L'ordre suit les clés étrangères. */
async function semerTout(id: string, marqueur: string): Promise<void> {
  const { error: eNom } = await admin.from("utilisatrice").update({ prenom: marqueur }).eq("id", id);
  if (eNom) throw new Error(`semis utilisatrice: ${eNom.message}`);

  // Le consentement d'abord : le write-gate art. 9 borne tout ce qui suit.
  await poser("consentement", {
    utilisatrice_id: id,
    art9_accorde: true,
    ia_reconnue: true,
    cgu_acceptees: true,
  });

  const journal = await poser("entree_journal", {
    utilisatrice_id: id,
    role: "utilisatrice",
    contenu: `${marqueur} — ce que j'ai déposé`,
    cle_tour: `${marqueur}-tour`,
  });
  const branche = await poser("branche", {
    utilisatrice_id: id,
    extrait_source_id: journal.id,
    nom: `le déménagement ${marqueur}`,
  });
  const tirage = await poser("tirage", {
    utilisatrice_id: id,
    carte: "la-porte",
    graine: "0f1e2d3c",
    taille_jeu: 64,
  });

  await poser("branche_retour", {
    branche_id: branche.id,
    utilisatrice_id: id,
    entree_journal_id: journal.id,
    jour_paris: "2026-08-16",
  });
  await poser("fait_extrait", {
    utilisatrice_id: id,
    origine: "extrait",
    statut: "actif",
    cle_dedoublonnage: `${marqueur}-fait`,
    contenu: `${marqueur} aime la mer`,
    extrait_source_id: journal.id,
  });
  await poser("resume_glissant", { utilisatrice_id: id, contenu: `${marqueur} — le résumé` });
  await poser("synthese", {
    utilisatrice_id: id,
    periode_debut: "2026-08-01T00:00:00Z",
    periode_fin: "2026-08-08T00:00:00Z",
    contenu: `${marqueur} — la synthèse`,
  });
  await poser("intention", {
    utilisatrice_id: id,
    branche_id: branche.id,
    declencheur: `quand ${marqueur} rentre le soir`,
    action: `écrire une ligne ${marqueur}`,
  });
  await poser("signal_reconceptualisation", { utilisatrice_id: id, entree_journal_id: journal.id });
  await poser("theme_natal", {
    utilisatrice_id: id,
    empreinte_entrees: `${marqueur}-empreinte`,
    contenu: { marqueur },
  });
  await poser("enneagramme", { utilisatrice_id: id, type: 5, origine: "test" });
  await poser("enneagramme_hypothese", { utilisatrice_id: id, type: 4 });
  await poser("enneagramme_tentative", { utilisatrice_id: id, reponses: { e1a: 2, e1b: 1 } });
  await poser("lecture", {
    utilisatrice_id: id,
    tirage_id: tirage.id,
    reponse: `${marqueur} — ma réponse`,
    restitution: `${marqueur} — la restitution`,
    close_a: "2026-08-16T10:00:00Z",
  });
  await poser("seance", { utilisatrice_id: id, phase: "construire" });
  await poser("usage_ia", {
    utilisatrice_id: id,
    cle_idempotence: `${marqueur}-usage`,
    tier: "leger",
    modele: "test",
    tokens_entree: 10,
    tokens_sortie: 20,
  });
  await poser("episode_detresse", { utilisatrice_id: id, niveau_max: 2 });
  await poser("audit_securite", { utilisatrice_id: id, type: "semence", decision: "posee" });
  await poser("pause_rythme", { utilisatrice_id: id, seances: 6, minutes: 70 });
  await poser("invitation_integration", { utilisatrice_id: id });
  await poser("notification_envoyee", {
    utilisatrice_id: id,
    motif: "synthese_prete",
    cle: `${marqueur}`.slice(0, 40),
  });
  await poser("abonnement", { utilisatrice_id: id, etat: "actif", source_maj_le: new Date().toISOString() });
  await poser("remboursement", { utilisatrice_id: id, motif: "garantie" });
  await poser("information_reconduction", { utilisatrice_id: id, echeance: "2026-12-01T00:00:00Z" });
  await poser("preference_socle", { utilisatrice_id: id, heure: 8 });
  await poser("preference_courriel", { utilisatrice_id: id });
  await poser("abonnement_poussee", {
    utilisatrice_id: id,
    endpoint: `https://fcm.googleapis.com/${marqueur}`,
    // Formes imposées par les CHECK de 0053 — ce sont exactement les deux colonnes retirées.
    cle_p256dh: "P".repeat(88),
    cle_auth: "A".repeat(24),
  });
}

async function creerCompte(suffixe: string): Promise<Compte> {
  const email = `export-${suffixe}-${t}@exemple.fr`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: MDP, email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  const id = data.user!.id;
  const marqueur = `marq${suffixe}${t}`;

  const client = clientNu();
  const { error: eConnexion } = await client.auth.signInWithPassword({ email, password: MDP });
  if (eConnexion) throw new Error(`signIn: ${eConnexion.message}`);

  await semerTout(id, marqueur);
  return { id, marqueur, client };
}

let alice: Compte;
let berenice: Compte;
let exportAlice: Record<string, unknown>;

beforeAll(async () => {
  if (!url || !publishable || !secret) throw new Error("Supabase local requis (URL / PUBLISHABLE / SECRET).");
  alice = await creerCompte("a");
  berenice = await creerCompte("b");

  const { data, error } = await alice.client.rpc("exporter_mes_donnees");
  if (error) throw new Error(`export: ${error.message}`);
  exportAlice = data as Record<string, unknown>;
}, 60_000);

/** Les lignes d'une section, quelle que soit la table. */
function lignes(section: unknown): Record<string, unknown>[] {
  return Array.isArray(section) ? (section as Record<string, unknown>[]) : [];
}

describe("[6.6/AC1] L'export est COMPLET — les 29 couches, aucune muette", () => {
  it("[ANTI-VACUITÉ, ET C'EST LE TEST LE PLUS IMPORTANT] chaque section porte au moins une ligne", () => {
    // Sans lui, tout ce fichier prouverait l'isolation d'un document vide. Et c'est exactement le
    // défaut qu'on redoute : onze de ces tables sont deny-by-default, donc une lecture sous le seul
    // JWT les rendrait vides SANS ERREUR — vert, complet en apparence, muet sur onze couches.
    const muettes = TABLES_EXPORTEES.filter((table) => lignes(exportAlice[table]).length === 0);
    expect(muettes, `sections vides alors qu'elles ont été semées : ${muettes.join(", ")}`).toEqual([]);
  });

  it("le document porte sa date et sa version", () => {
    expect(typeof exportAlice.genere_le).toBe("string");
    expect(exportAlice.version).toBe(1);
  });

  it("le verbatim y est mot pour mot — c'est la couche qu'elle vient chercher", () => {
    const journal = lignes(exportAlice.entree_journal);
    expect(journal[0].contenu).toBe(`${alice.marqueur} — ce que j'ai déposé`);
  });
});

describe("[6.6/NFR-001] L'export d'une seule — la garde que le `security definer` a rendue nécessaire", () => {
  it("[LE CŒUR] AUCUNE ligne, dans AUCUNE section, n'appartient à quelqu'un d'autre", () => {
    const intruses: string[] = [];
    for (const table of TABLES_EXPORTEES) {
      for (const ligne of lignes(exportAlice[table])) {
        const proprietaire = table === "utilisatrice" ? ligne.id : ligne.utilisatrice_id;
        if (proprietaire !== alice.id) intruses.push(`${table}:${String(proprietaire)}`);
      }
    }
    expect(intruses, `lignes d'autrui dans l'export : ${intruses.join(", ")}`).toEqual([]);
  });

  it("[LE CŒUR] pas une trace du marqueur de l'autre dans le document ENTIER", () => {
    // Le filet à mailles serrées : même une colonne sans `utilisatrice_id` trahirait la fuite.
    const brut = JSON.stringify(exportAlice);
    expect(brut).toContain(alice.marqueur);
    expect(brut, "le marqueur de l'autre utilisatrice est dans l'export").not.toContain(berenice.marqueur);
  });

  it("chacune reçoit le SIEN — le contrôle positif qui interdit un export figé", () => {
    // Sans ça, une fonction qui rendrait toujours le même document passerait les deux tests ci-dessus.
    return berenice.client.rpc("exporter_mes_donnees").then(({ data, error }) => {
      expect(error).toBeNull();
      const brut = JSON.stringify(data);
      expect(brut).toContain(berenice.marqueur);
      expect(brut).not.toContain(alice.marqueur);
    });
  });

  it("sans identité, la fonction LÈVE au lieu de rendre un document vide", async () => {
    const { error } = await clientNu().rpc("exporter_mes_donnees");
    expect(error, "un client anonyme obtient un export").not.toBeNull();
  });
});

describe("[6.6] Les deux capacités retirées, et rien d'autre", () => {
  it("[LE CŒUR] ni clé de poussée ni jeton de désabonnement nulle part dans le document", () => {
    // ⚠️ ON CHERCHE LA COLONNE DANS LES LIGNES, PAS DANS LE DOCUMENT ENTIER — la déclaration
    // `retraits` NOMME ces colonnes, et c'est justement ce qu'on lui demande de faire. Une première
    // version cherchait la chaîne partout et rougissait sur l'annonce du retrait : le test aurait
    // été « corrigé » en supprimant l'annonce, c'est-à-dire en cachant le retrait.
    const fuites: string[] = [];
    for (const table of TABLES_EXPORTEES) {
      for (const ligne of lignes(exportAlice[table])) {
        for (const colonne of Object.keys(ligne)) {
          if (COLONNES_RETIREES.includes(colonne)) fuites.push(`${table}.${colonne}`);
        }
      }
    }
    expect(fuites, `capacités sorties dans l'export : ${fuites.join(", ")}`).toEqual([]);

    // Et la MATIÈRE elle-même, sous quelque clé que ce soit.
    const brut = JSON.stringify(exportAlice);
    expect(brut).not.toContain("P".repeat(88));
    expect(brut).not.toContain("A".repeat(24));
  });

  it("la LIGNE, elle, est bien là — on retire une capacité, jamais une information", () => {
    const appareils = lignes(exportAlice.abonnement_poussee);
    expect(appareils).toHaveLength(1);
    expect(appareils[0].endpoint).toContain(alice.marqueur);
    expect(appareils[0].cree_le).toBeTruthy();
  });

  it("le document DÉCLARE ce qu'il retire", () => {
    const retraits = lignes(exportAlice.retraits);
    expect(retraits.length).toBeGreaterThan(0);
    const annoncees = retraits.flatMap((r) => (Array.isArray(r.colonnes) ? (r.colonnes as string[]) : []));
    expect([...annoncees].sort()).toEqual([...COLONNES_RETIREES].sort());
  });
});

describe("[6.6/AC3] L'opération laisse une trace, et la trace ne porte pas d'art. 9", () => {
  it("[LE CŒUR] un export pose exactement une ligne d'audit « export_donnees »", async () => {
    const compter = async () =>
      (
        await admin
          .from("audit_securite")
          .select("id", { count: "exact", head: true })
          .eq("utilisatrice_id", alice.id)
          .eq("type", "export_donnees")
      ).count ?? 0;

    const avant = await compter();
    const { error } = await alice.client.rpc("exporter_mes_donnees");
    expect(error).toBeNull();
    expect(await compter()).toBe(avant + 1);
  });

  it("la trace ne porte que des libellés neutres — jamais un extrait, jamais un volume", async () => {
    const { data } = await admin
      .from("audit_securite")
      .select("*")
      .eq("utilisatrice_id", alice.id)
      .eq("type", "export_donnees")
      .limit(1)
      .single();

    const ligne = data as Record<string, unknown>;
    expect(ligne.decision).toBe("servi");
    expect(ligne.niveau).toBeNull();
    // Rien de ce qu'elle a écrit ne doit se retrouver dans le registre d'audit (NFR-002/NFR-022).
    expect(JSON.stringify(ligne)).not.toContain(alice.marqueur);
  });
});
