import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { declarerMajorite } from "./_semis";

/**
 * Story 4.5 — la table `branche` (couche 3, AD-8) : validée ET nommée par l'utilisatrice, datée, liée à
 * l'extrait exact. Preuves BLOQUANTES contre un vrai Supabase local — miroir art. 9 « possédé sous JWT »
 * de `signal_reconceptualisation` (0020) :
 *  - schéma : nom non vide (AC2), etat naissance par défaut, unique (utilisatrice, extrait_source) ;
 *  - art. 9 sous JWT (AD-12) : deny-by-default — une AUTRE utilisatrice ne lit rien, anon non plus ;
 *  - write-gate (AD-13) : refusé sans consentement / sous barrière minorité / après révocation ; lecture survit ;
 *  - AC2 [DUR] : un nom vide/espaces n'est JAMAIS persisté (CHECK + policy + RPC) — la branche n'existe pas ;
 *  - isolation : une branche ne peut pointer le journal d'autrui (exists dans le WITH CHECK), direct ET via RPC ;
 *  - [DUR / AD-17] garde AU POINT D'ÉCRITURE : insert DIRECT (bypass RPC) pendant épisode / 72 h → REFUSÉ par la
 *    policy (mutation-cible : retirer `not branche_bloquee_par_detresse()` du WITH CHECK) ; hors fenêtre → réussit ;
 *  - AC6 : l'extrait source ne peut être supprimé isolément (FK restrict) — le lien branche→extrait est incassable ;
 *  - idempotence / anti-double-naissance : une branche par moment source (retry → une seule).
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientScope = () => createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const t = Date.now();
const MDP = "test-branche-123!";
const FENETRE_POST_EPISODE_MS = 72 * 3600 * 1000;

async function donnerConsentement(c: SupabaseClient, id: string) {
  const { error } = await c.from("consentement").upsert(
    { utilisatrice_id: id, art9_accorde: true, ia_reconnue: true, cgu_acceptees: true, revoked_at: null },
    { onConflict: "utilisatrice_id" },
  );
  if (error) throw new Error(`consentement: ${error.message}`);
}

/**
 * Story 3.3 — TOUTE UTILISATRICE DE CE FICHIER EST ABONNÉE, et ce n'est pas une commodité.
 *
 * Depuis la migration 0037, `branche_insertion` porte `est_premium_courante()` : sans abonnement
 * actif, AUCUNE branche ne naît. Ce fichier n'éprouve pas le paywall (c'est
 * `tests/tronc-branche-sql.test.ts` qui s'en charge) — il éprouve le consentement art. 9, la barrière
 * minorité, la fenêtre de détresse (AD-17) et l'isolation.
 *
 * ⚠️ ET SURTOUT : sans cet abonnement, ses REFUS deviendraient ambigus. Un insert refusé pourrait
 * l'être à cause de la clause premium au lieu de la clause sous test, et chaque garde passerait pour
 * une raison qui n'est pas la sienne — le piège des défenses redondantes qui se couvrent l'une
 * l'autre. L'abonnement rétablit la précondition pour que chaque garde continue d'isoler CE qu'elle
 * prétend isoler.
 */
async function abonnerActive(id: string) {
  const { error } = await admin
    .from("abonnement")
    .upsert({ utilisatrice_id: id, etat: "actif", source_maj_le: new Date().toISOString() }, { onConflict: "utilisatrice_id" });
  if (error) throw new Error(`abonner: ${error.message}`);
}

async function creerUtilisatrice(email: string) {
  const { data, error } = await admin.auth.admin.createUser({ email, password: MDP, email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  // 0066 : la majorité doit être POSITIVEMENT établie pour écrire de l'art. 9. Un compte créé par
  // `createUser` n'a pas de `date_naissance` — c'est exactement le trou que 0066 referme. Ce banc-là
  // teste autre chose ; il pose donc l'adulte que le parcours nominal aurait posée en `/naissance`.
  await declarerMajorite(admin, data.user!.id);
  await abonnerActive(data.user!.id);
  return data.user!.id;
}

/** Grave une entrée de journal (côté utilisatrice) — l'ancre exacte d'un signal / d'une branche. Renvoie son id. */
async function graverEntree(id: string, cleTour: string, contenu = "un tour d'utilisatrice"): Promise<string> {
  const { data, error } = await admin
    .from("entree_journal")
    .insert({ utilisatrice_id: id, cle_tour: cleTour, role: "utilisatrice", contenu })
    .select("id")
    .single();
  if (error) throw new Error(`graverEntree: ${error.message}`);
  return data!.id as string;
}

/** Pose un signal EN ATTENTE (germe de branche) directement (service_role). Renvoie {signalId, entreeId}. */
async function poserSignal(id: string, cleTour: string): Promise<{ signalId: string; entreeId: string }> {
  const entreeId = await graverEntree(id, cleTour);
  const { data, error } = await admin
    .from("signal_reconceptualisation")
    .insert({ utilisatrice_id: id, entree_journal_id: entreeId })
    .select("id")
    .single();
  if (error) throw new Error(`poserSignal: ${error.message}`);
  return { signalId: data!.id as string, entreeId };
}

async function ouvrirEpisode(id: string, niveau = 2) {
  const { error } = await admin.from("episode_detresse").insert({ utilisatrice_id: id, niveau_max: niveau });
  if (error) throw new Error(`ouvrirEpisode: ${error.message}`);
}

async function fermerEpisode(id: string, heures: number) {
  const fin = new Date(Date.now() - heures * 3600 * 1000);
  const { error } = await admin.from("episode_detresse").insert({
    utilisatrice_id: id,
    niveau_max: 2,
    debut: new Date(fin.getTime() - 3600 * 1000).toISOString(),
    fin: fin.toISOString(),
    fenetre_expire_at: new Date(fin.getTime() + FENETRE_POST_EPISODE_MS).toISOString(),
  });
  if (error) throw new Error(`fermerEpisode: ${error.message}`);
}

async function session(email: string): Promise<SupabaseClient> {
  const c = clientScope();
  const { error } = await c.auth.signInWithPassword({ email, password: MDP });
  if (error) throw new Error(`signIn: ${error.message}`);
  return c;
}

/** Purge ordonnée (AC6 : `branche` a un FK RESTRICT vers `entree_journal` → supprimer branche AVANT). */
async function purger(id: string) {
  await admin.from("branche").delete().eq("utilisatrice_id", id);
  await admin.from("signal_reconceptualisation").delete().eq("utilisatrice_id", id);
  await admin.from("episode_detresse").delete().eq("utilisatrice_id", id);
  await admin.from("entree_journal").delete().eq("utilisatrice_id", id);
  if (id) await admin.auth.admin.deleteUser(id);
}

describe("branche — schéma & contraintes (AC2, AC3)", () => {
  const u = { email: `br-schema-${t}@exemple.fr`, id: "", entree: "" };

  beforeAll(async () => {
    if (!url || !publishable || !secret) throw new Error("Supabase local requis (URL / PUBLISHABLE / SECRET).");
    u.id = await creerUtilisatrice(u.email);
    u.entree = await graverEntree(u.id, `br-sch-${t}`);
  });
  afterAll(async () => purger(u.id));

  it("colonnes exactes, etat 'naissance' par défaut, intensite 0, id uuid, date_naissance datée (AC3)", async () => {
    const { data, error } = await admin
      .from("branche")
      .insert({ utilisatrice_id: u.id, extrait_source_id: u.entree, nom: "arrêter de payer la mauvaise facture" })
      .select()
      .single();
    expect(error).toBeNull();
    expect(String(data!.id)).toMatch(UUID);
    expect(data!.etat).toBe("naissance");
    expect(Number(data!.intensite)).toBe(0);
    expect(data!.nom).toBe("arrêter de payer la mauvaise facture");
    expect(Number.isNaN(new Date(data!.date_naissance as string).getTime())).toBe(false);
    const colonnes = Object.keys(data!).sort();
    // 4.7 ajoute les deux dates de transition — sans elles, la fiche ne pourrait pas dire ce qui a changé
    // ET QUAND (AC5). Elles naissent NULL : une branche neuve n'a rien traversé.
    expect(colonnes).toEqual(
      ["cree_le", "date_feuillaison", "date_naissance", "date_rayonnement", "etat", "extrait_source_id", "id", "intensite", "maj_le", "nom", "utilisatrice_id"].sort(),
    );
    expect(data!.date_feuillaison).toBeNull();
    expect(data!.date_rayonnement).toBeNull();
  });

  it("[AC2 / revue #1] un nom vide, d'espaces, de TAB/NL, ou d'ESPACE INSÉCABLE est refusé par le CHECK (même service_role)", async () => {
    const autre = await graverEntree(u.id, `br-sch-vide-${t}`);
    // Le CHECK doit mordre TOUTE la classe de « blancs » que JS .trim() retire — pas seulement l'espace ASCII
    // (le piège R1 : btrim() par défaut ne strippait que U+0020). Cible de mutation : la fonction branche_nom_significatif.
    const blancs: [string, string][] = [
      ["", "vide"],
      ["   ", "espaces ASCII"],
      ["\t", "tabulation"],
      ["\n", "saut de ligne"],
      ["\u00a0", "espace insecable (U+00A0)"],
      ["\u2003\u2009", "espaces Unicode (cadratin, fin)"],
      ["\ufeff", "BOM (U+FEFF)"],
    ];
    for (const [nom, quoi] of blancs) {
      const r = await admin.from("branche").insert({ utilisatrice_id: u.id, extrait_source_id: autre, nom });
      expect(r.error, `nom invisible (${quoi}) doit etre refuse — une branche sans nom n'existe pas`).not.toBeNull();
    }
    // Controle positif : un vrai caractere, meme precede d'un insecable, passe (le doute ne bloque pas tout).
    const ok = await admin.from("branche").insert({ utilisatrice_id: u.id, extrait_source_id: autre, nom: "\u00a0mot" });
    expect(ok.error, "un nom avec un caractere significatif est accepte").toBeNull();
  });

  it("etat hors énumération refusé (check naissance|feuillaison|rayonnement)", async () => {
    const autre = await graverEntree(u.id, `br-sch-etat-${t}`);
    const bad = await admin
      .from("branche")
      .insert({ utilisatrice_id: u.id, extrait_source_id: autre, nom: "x", etat: "morte" });
    expect(bad.error).not.toBeNull();
  });

  it("unicité (utilisatrice_id, extrait_source_id) : deux branches du MÊME moment source → refusé (anti-double-naissance)", async () => {
    const src = await graverEntree(u.id, `br-sch-uniq-${t}`);
    const a = await admin.from("branche").insert({ utilisatrice_id: u.id, extrait_source_id: src, nom: "un" });
    expect(a.error).toBeNull();
    const b = await admin.from("branche").insert({ utilisatrice_id: u.id, extrait_source_id: src, nom: "deux" });
    expect(b.error, "une seule branche par moment source").not.toBeNull();
  });
});

describe("branche — art. 9 sous JWT, deny-by-default (AD-12)", () => {
  const u1 = { email: `br-owner-${t}@exemple.fr`, id: "", entree: "" };
  const u2 = { email: `br-autre-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    u1.id = await creerUtilisatrice(u1.email);
    u2.id = await creerUtilisatrice(u2.email);
    u1.entree = await graverEntree(u1.id, `br-deny-${t}`);
    await admin.from("branche").insert({ utilisatrice_id: u1.id, extrait_source_id: u1.entree, nom: "ma branche" });
  });
  afterAll(async () => {
    await purger(u1.id);
    await purger(u2.id);
  });

  it("une AUTRE utilisatrice ne lit RIEN de ma branche (RLS)", async () => {
    const c = await session(u2.email);
    const { data, error } = await c.from("branche").select("*").eq("utilisatrice_id", u1.id);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
    await c.auth.signOut();
  });

  it("une session NON authentifiée ne lit rien (mais la table répond — pas un faux-vert « table absente »)", async () => {
    const anon = clientScope();
    const { data, error } = await anon.from("branche").select("*").eq("utilisatrice_id", u1.id);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("le propriétaire LIT sa branche (export FR-067, projection arbre 4.6)", async () => {
    const c = await session(u1.email);
    const { data, error } = await c.from("branche").select("nom, etat").eq("utilisatrice_id", u1.id);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThanOrEqual(1);
    await c.auth.signOut();
  });
});

describe("creer_branche_depuis_signal — write-gate art. 9 & création nominale (AC2, AC3)", () => {
  const u = { email: `br-creer-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
  });
  afterAll(async () => purger(u.id));

  it("sans consentement : la création est REFUSÉE (write-gate durci, AD-13) — le signal existe pourtant", async () => {
    const c = await session(u.email);
    const { signalId } = await poserSignal(u.id, `creer-sans-consent-${t}`);
    const { error } = await c.rpc("creer_branche_depuis_signal", { p_signal_id: signalId, p_nom: "essai" });
    expect(error, "sans consentement art. 9, aucune branche ne naît").not.toBeNull();
    await c.auth.signOut();
  });

  it("sous barrière minorité : refusé MÊME avec consentement (gabarit 0006/F1)", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    const { signalId } = await poserSignal(u.id, `creer-barre-${t}`);
    await admin.from("utilisatrice").update({ barriere_minorite_le: new Date().toISOString(), echeance_suppression: "2099-01-01" }).eq("id", u.id);
    const { error } = await c.rpc("creer_branche_depuis_signal", { p_signal_id: signalId, p_nom: "essai" });
    expect(error).not.toBeNull();
    await admin.from("utilisatrice").update({ barriere_minorite_le: null }).eq("id", u.id);
    await c.auth.signOut();
  });

  it("avec consentement : la branche naît (etat naissance, extrait_source = le message exact, nom donné), et le signal passe à consomme", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    const { signalId, entreeId } = await poserSignal(u.id, `creer-ok-${t}`);
    const creer = await c.rpc("creer_branche_depuis_signal", { p_signal_id: signalId, p_nom: "  mes propres mots  " });
    expect(creer.error).toBeNull();
    const { data: br } = await c.from("branche").select("nom, etat, extrait_source_id").eq("extrait_source_id", entreeId).single();
    expect(br!.etat).toBe("naissance");
    expect(br!.extrait_source_id).toBe(entreeId); // AC3 : pointe le message exact
    expect(br!.nom).toBe("mes propres mots"); // trimé (AC2)
    const { data: sig } = await c.from("signal_reconceptualisation").select("statut").eq("id", signalId).single();
    expect(sig!.statut).toBe("consomme"); // le germe est consommé
    await c.auth.signOut();
  });

  it("[AC2] nom vide/espaces via la RPC → refusé (défense en profondeur au-delà du CHECK)", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    const { signalId } = await poserSignal(u.id, `creer-vide-${t}`);
    const vide = await c.rpc("creer_branche_depuis_signal", { p_signal_id: signalId, p_nom: "   " });
    expect(vide.error).not.toBeNull();
    // le signal reste en_attente (aucune consommation sur un échec)
    const { data: sig } = await c.from("signal_reconceptualisation").select("statut").eq("id", signalId).single();
    expect(sig!.statut).toBe("en_attente");
    await c.auth.signOut();
  });

  it("anti-rejeu : un signal déjà consommé ne peut plus créer de branche (AC1/AC4)", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    const { signalId } = await poserSignal(u.id, `creer-rejeu-${t}`);
    const a = await c.rpc("creer_branche_depuis_signal", { p_signal_id: signalId, p_nom: "première" });
    expect(a.error).toBeNull();
    const b = await c.rpc("creer_branche_depuis_signal", { p_signal_id: signalId, p_nom: "seconde" });
    expect(b.error, "un signal consommé ne renaît pas").not.toBeNull();
    await c.auth.signOut();
  });
});

describe("creer_branche_depuis_signal — isolation (AC4)", () => {
  const u = { email: `br-iso-${t}@exemple.fr`, id: "" };
  const victime = { email: `br-victime-${t}@exemple.fr`, id: "", entree: "", signalId: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    victime.id = await creerUtilisatrice(victime.email);
    const s = await poserSignal(victime.id, `br-victime-sig-${t}`);
    victime.entree = s.entreeId;
    victime.signalId = s.signalId;
  });
  afterAll(async () => {
    await purger(u.id);
    await purger(victime.id);
  });

  it("via RPC : le signal d'une AUTRE utilisatrice est introuvable pour l'appelante → LÈVE (jamais de branche volée)", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    const { error } = await c.rpc("creer_branche_depuis_signal", { p_signal_id: victime.signalId, p_nom: "volée" });
    expect(error).not.toBeNull();
    await c.auth.signOut();
  });

  it("[isolation] INSERT DIRECT pointant l'entrée d'autrui est REFUSÉ (mutation-cible : retirer l'`exists` du WITH CHECK)", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    const { error } = await c.from("branche").insert({ utilisatrice_id: u.id, extrait_source_id: victime.entree, nom: "volée" });
    expect(error, "une branche ne peut pas pointer le journal d'autrui").not.toBeNull();
    await c.auth.signOut();
  });
});

describe("branche — [DUR / AD-17] garde de détresse au VRAI point d'écriture (RLS), insert DIRECT (leçon R1)", () => {
  const u = { email: `br-ad17-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
  });
  afterAll(async () => purger(u.id));

  it("[DUR/AD-17] INSERT DIRECT (bypass RPC) pendant un épisode OUVERT est REFUSÉ par la policy (mutation-cible : retirer `not branche_bloquee`)", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    const entree = await graverEntree(u.id, `br-ad17-ouvert-${t}`);
    await ouvrirEpisode(u.id, 2);
    const { error } = await c.from("branche").insert({ utilisatrice_id: u.id, extrait_source_id: entree, nom: "née en détresse" });
    expect(error, "aucune branche ne naît d'un moment de détresse (AD-17 au point d'écriture)").not.toBeNull();
    await admin.from("episode_detresse").delete().eq("utilisatrice_id", u.id);
    await c.auth.signOut();
  });

  it("[DUR/AD-17] DANS les 72 h après extinction → REFUSÉ ; HORS des 72 h → réussit (contrôle positif)", async () => {
    const c = await session(u.email);
    await donnerConsentement(c, u.id);
    const entree = await graverEntree(u.id, `br-ad17-fenetre-${t}`);

    await fermerEpisode(u.id, 24); // dans la fenêtre 72 h
    const dans = await c.from("branche").insert({ utilisatrice_id: u.id, extrait_source_id: entree, nom: "24h" });
    expect(dans.error, "24 h après extinction : encore bloqué (AD-17)").not.toBeNull();

    await admin.from("episode_detresse").delete().eq("utilisatrice_id", u.id);
    await fermerEpisode(u.id, 100); // hors de la fenêtre
    const hors = await c.from("branche").insert({ utilisatrice_id: u.id, extrait_source_id: entree, nom: "100h" });
    expect(hors.error, "100 h après extinction : la branche peut naître").toBeNull();
    await c.auth.signOut();
  });
});

describe("branche — AC6 : le lien branche→extrait est incassable (FK restrict) & effacement FR-067", () => {
  const u = { email: `br-lien-${t}@exemple.fr`, id: "", entree: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    u.entree = await graverEntree(u.id, `br-lien-${t}`);
    await admin.from("branche").insert({ utilisatrice_id: u.id, extrait_source_id: u.entree, nom: "un chemin" });
  });
  afterAll(async () => purger(u.id));

  it("[AC6] supprimer l'extrait source ISOLÉMENT est REFUSÉ (FK restrict) — même service_role", async () => {
    const del = await admin.from("entree_journal").delete().eq("id", u.entree);
    expect(del.error, "on ne peut pas casser le lien branche→extrait en supprimant l'extrait seul").not.toBeNull();
  });

  it("un DELETE de branche sous JWT est REFUSÉ (aucune policy delete) — la branche survit (FR-029/FR-067 service_role)", async () => {
    const c = await session(u.email);
    await c.from("branche").delete().eq("utilisatrice_id", u.id);
    await c.auth.signOut();
    const { data } = await admin.from("branche").select("id").eq("utilisatrice_id", u.id);
    expect((data ?? []).length).toBe(1);
  });

  it("effacement ordonné (Epic 6) : supprimer la branche PUIS l'extrait fonctionne (service_role)", async () => {
    const delBr = await admin.from("branche").delete().eq("utilisatrice_id", u.id);
    expect(delBr.error).toBeNull();
    const delEntree = await admin.from("entree_journal").delete().eq("id", u.entree);
    expect(delEntree.error, "une fois la branche retirée, l'extrait peut l'être").toBeNull();
  });
});
