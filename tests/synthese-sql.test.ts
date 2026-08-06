import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Story 4.9 (T7) — LES GARANTIES À L'ÉCRITURE ET À LA LECTURE, contre le vrai Postgres.
 *
 * Trois des cinq critères d'acceptation ne sont vérifiables QU'ICI, et c'est délibéré : ils sont portés
 * par des clauses SQL, pas par du TypeScript. L'AC3 le demande d'ailleurs littéralement (« par une clause
 * sur `episode_detresse` »). Le raisonnement est toujours le même — le job tourne sous `service_role`,
 * qui contourne la RLS : une garde écrite dans l'appelant n'est plus une garde, c'est une politesse, et
 * le premier appelant suivant l'oubliera.
 *
 *   AC3 / AD-17  la détresse est enjambée, jamais exploitée
 *   AD-18        les tombstones ne reviennent pas
 *   AC5          l'entitlement premium, le consentement vivant, la barrière minorité
 *   AC4          le plafond de notification et l'idempotence du canal
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientScope = () => createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();
const MDP = "test-synthese-123!";

async function creerUtilisatrice(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({ email, password: MDP, email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  return data.user!.id;
}

async function consentir(id: string, options: { revoque?: boolean; sansArt9?: boolean; sansIa?: boolean } = {}) {
  const { error } = await admin.from("consentement").insert({
    utilisatrice_id: id,
    art9_accorde: !options.sansArt9,
    ia_reconnue: !options.sansIa,
    cgu_acceptees: true,
    revoked_at: options.revoque ? new Date().toISOString() : null,
  });
  if (error) throw new Error(`consentir: ${error.message}`);
}

async function abonner(id: string, etat = "actif") {
  const { error } = await admin.from("abonnement").insert({
    utilisatrice_id: id,
    etat,
    source_maj_le: new Date().toISOString(),
  });
  if (error) throw new Error(`abonner: ${error.message}`);
}

async function graver(id: string, cle: string, contenu: string, creeLe?: string, role = "utilisatrice"): Promise<void> {
  const ligne: Record<string, unknown> = { utilisatrice_id: id, cle_tour: cle, role, contenu };
  if (creeLe) ligne.cree_le = creeLe;
  const { error } = await admin.from("entree_journal").insert(ligne);
  if (error) throw new Error(`graver: ${error.message}`);
}

async function poserFait(id: string, cle: string, contenu: string, statut = "actif") {
  const { error } = await admin
    .from("fait_extrait")
    .insert({ utilisatrice_id: id, origine: "extrait", statut, cle_dedoublonnage: cle, contenu });
  if (error) throw new Error(`poserFait: ${error.message}`);
}

async function episode(id: string, debut: string, fin: string | null) {
  const { error } = await admin.from("episode_detresse").insert({
    utilisatrice_id: id,
    debut,
    niveau_max: 2,
    fin,
    fenetre_expire_at: fin ? new Date(new Date(fin).getTime() + 72 * 3_600_000).toISOString() : null,
  });
  if (error) throw new Error(`episode: ${error.message}`);
}

async function materiau(id: string, plafond = 200, octets = 200_000) {
  const { data, error } = await admin.rpc("materiau_synthese", {
    p_utilisatrice: id,
    p_plafond_entrees: plafond,
    p_plafond_octets: octets,
  });
  if (error) throw new Error(`materiau_synthese: ${error.message}`);
  return data as {
    total: number;
    tronquee: boolean;
    entrees: { contenu: string }[];
    faits: string[];
    depuis: string | null;
    jusqu_a: string;
  };
}

/**
 * ⚠️ `p_limite` est délibérément ÉNORME, et chaque appelant vérifie que la liste n'est pas saturée avant
 * toute assertion négative. La revue 4.9 a montré pourquoi : la fonction rend une liste TRONQUÉE, donc
 * l'absence d'un identifiant ne distingue pas « exclu par une garde » de « au-delà de la limite ». Les
 * fichiers de test tournent en parallèle contre la MÊME base, et plusieurs y créent des premium
 * consentantes avec du journal : sous charge, les assertions négatives d'AC5 devenaient vides et le
 * mutant qu'elles prétendaient tuer survivait.
 */
const LIMITE_LARGE = 5_000;

const JOB = "synthese-hebdomadaire";

async function candidates(limite = LIMITE_LARGE): Promise<string[]> {
  const { data, error } = await admin.rpc("utilisatrices_a_synthetiser", { p_job: JOB, p_limite: limite });
  if (error) throw new Error(`utilisatrices_a_synthetiser: ${error.message}`);
  const liste = data as string[];
  if (liste.length >= limite) {
    throw new Error(`liste SATURÉE (${liste.length}) : toute conclusion d'absence serait fausse`);
  }
  return liste;
}

async function eligible(id: string): Promise<boolean> {
  const { data, error } = await admin.rpc("eligible_a_synthese", { p_utilisatrice: id });
  if (error) throw new Error(`eligible_a_synthese: ${error.message}`);
  return data as boolean;
}

async function supprimer(id: string) {
  if (id) await admin.auth.admin.deleteUser(id); // la cascade emporte tout le reste (FR-067)
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

describe("[AC3 / AD-17] la détresse est ENJAMBÉE, jamais exploitée", () => {
  const u = { email: `syn-detresse-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    if (!url || !publishable || !secret) throw new Error("Supabase local requis.");
    u.id = await creerUtilisatrice(u.email);
    await consentir(u.id);
    await abonner(u.id);
    // Trois entrées : une avant l'épisode, une PENDANT, une après.
    await graver(u.id, `${t}-avant`, "avant l'orage", "2026-03-01T10:00:00Z");
    await graver(u.id, `${t}-pendant`, "PENDANT L'ORAGE", "2026-03-02T10:00:00Z");
    await graver(u.id, `${t}-apres`, "après l'orage", "2026-03-05T10:00:00Z");
    await episode(u.id, "2026-03-02T00:00:00Z", "2026-03-03T00:00:00Z");
  });
  afterAll(async () => supprimer(u.id));

  it("[LE CŒUR] l'entrée tombée DANS l'épisode n'est pas dans le matériau — les deux autres y sont", async () => {
    // Mutation-cible : retirer la clause `not exists (… episode_detresse …)` de `entrees_hors_detresse`.
    // Ce qu'elle protège n'est pas une préférence de produit : AD-17 dit que rien ne naît pendant la
    // détresse, et une synthèse qui raconte l'épisode le fait entrer dans le récit permanent — puis dans
    // le prompt du modèle, à chaque période suivante, pour toujours.
    const m = await materiau(u.id);
    const textes = m.entrees.map((e) => e.contenu);
    expect(textes).toEqual(["avant l'orage", "après l'orage"]);
    expect(textes.join(" "), "jamais le verbatim de l'épisode").not.toContain("PENDANT");
    expect(m.total, "le compte total exclut lui aussi l'épisode").toBe(2);
  });

  it("[LA BONNE LECTURE] l'utilisatrice, elle, n'est PAS exclue — c'est la parenthèse qu'on enjambe", async () => {
    // L'autre lecture d'« exclure les épisodes » — écarter les PERSONNES qui en ont vécu un — punirait
    // celle qui a le plus traversé en la privant seule de sa relecture. Ce test fige la bonne lecture.
    expect(await candidates()).toContain(u.id);
  });
});

describe("[AC3] un épisode OUVERT exclut jusqu'à maintenant — et alors il n'y a rien à dire", () => {
  const u = { email: `syn-ouvert-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    await consentir(u.id);
    await abonner(u.id);
    await graver(u.id, `${t}-o1`, "tout est dedans", "2026-03-10T10:00:00Z");
    await episode(u.id, "2026-03-09T00:00:00Z", null); // ouvert : `fin is null`
  });
  afterAll(async () => supprimer(u.id));

  it("rien n'est éligible, donc elle n'est pas candidate — aucune synthèse, aucun courriel", async () => {
    // Mutation-cible : `j.cree_le <= e.fin` sans le `coalesce(e.fin, now())`. Avec un épisode ouvert,
    // `fin` est NULL, la comparaison rend NULL, `not exists` devient vrai et TOUT redevient éligible :
    // la synthèse d'une personne en pleine traversée serait produite, et le courriel partirait.
    const m = await materiau(u.id);
    expect(m.entrees, "aucune entrée éligible pendant un épisode ouvert").toEqual([]);
    expect(await candidates(), "et donc aucune candidature").not.toContain(u.id);
  });
});

describe("[AD-18] les tombstones ne reviennent pas dans le matériau", () => {
  const u = { email: `syn-tombstone-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    await consentir(u.id);
    await abonner(u.id);
    await graver(u.id, `${t}-f`, "une phrase quelconque");
    await poserFait(u.id, `cle-actif-${t}`, "elle a repris le dessin", "actif");
    await poserFait(u.id, `cle-corrige-${t}`, "CE QU'ELLE A CORRIGÉ", "corrige");
    await poserFait(u.id, `cle-supprime-${t}`, "CE QU'ELLE A SUPPRIMÉ", "supprime");
  });
  afterAll(async () => supprimer(u.id));

  it("[LE CŒUR] seuls les faits `actif` remontent — jamais un `corrige`, jamais un `supprime`", async () => {
    // Mutation-cible : retirer `and f.statut = 'actif'`. AD-18 est le droit de retirer quelque chose de
    // sa propre mémoire ; le voir revenir dans une synthèse une semaine plus tard n'est pas un bogue
    // d'affichage, c'est le démenti de la promesse.
    const m = await materiau(u.id);
    expect(m.faits).toEqual(["elle a repris le dessin"]);
    expect(JSON.stringify(m.faits)).not.toMatch(/CORRIGÉ|SUPPRIMÉ/);
  });
});

describe("[AC5] le registre premium — et le socle gratuit jamais dégradé", () => {
  const gratuite = { email: `syn-gratuite-${t}@exemple.fr`, id: "" };
  const resiliee = { email: `syn-resiliee-${t}@exemple.fr`, id: "" };
  const sansConsentement = { email: `syn-sans-cons-${t}@exemple.fr`, id: "" };
  const revoquee = { email: `syn-revoquee-${t}@exemple.fr`, id: "" };
  const barree = { email: `syn-barree-${t}@exemple.fr`, id: "" };
  const premium = { email: `syn-premium-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    for (const u of [gratuite, resiliee, sansConsentement, revoquee, barree, premium]) {
      u.id = await creerUtilisatrice(u.email);
      await graver(u.id, `${t}-${u.email}`, "quelque chose s'est dit");
    }
    await consentir(gratuite.id); // consentante, mais AUCUN abonnement
    await consentir(resiliee.id);
    await abonner(resiliee.id, "resilie");
    await abonner(sansConsentement.id); // abonnée, mais aucun consentement
    await consentir(revoquee.id, { revoque: true });
    await abonner(revoquee.id);
    await consentir(barree.id);
    await abonner(barree.id);
    await admin.from("utilisatrice").update({ barriere_minorite_le: new Date().toISOString() }).eq("id", barree.id);
    await consentir(premium.id);
    await abonner(premium.id);
  });
  afterAll(async () => {
    for (const u of [gratuite, resiliee, sansConsentement, revoquee, barree, premium]) await supprimer(u.id);
  });

  it("[LE CŒUR] SEULE la premium consentante et non barrée est candidate", async () => {
    // Cinq mutations-cibles d'un coup, et c'est le but : les quatre conditions sont réunies dans UNE
    // requête, donc un seul test les cloue toutes. Retirer la jointure sur `abonnement` fait entrer la
    // gratuite (AC5 tombe) ; relâcher `etat = 'actif'` fait entrer la résiliée ; retirer le `exists` sur
    // `consentement` fait entrer celle qui n'a jamais consenti à l'art. 9 — c'est-à-dire produire un
    // récit intime pour quelqu'un qui ne l'a pas autorisé ; oublier `revoked_at is null` fait entrer
    // celle qui s'est rétractée ; oublier la barrière fait entrer un compte suspendu pour minorité.
    const liste = await candidates();
    expect(liste).toContain(premium.id);
    for (const u of [gratuite, resiliee, sansConsentement, revoquee, barree]) {
      expect(liste, u.email).not.toContain(u.id);
    }
  });

  it("[D3 / FR-034] une premium qui n'a RIEN dit depuis la dernière synthèse n'est pas candidate", async () => {
    // Mutation-cible : retirer le `exists (… entrees_hors_detresse …)`. Anam produirait alors une
    // synthèse chaque semaine, y compris les vides — exactement le « message générique récurrent » que
    // FR-034 interdit, et un appel au modèle fort pour dire qu'il n'y a rien à dire.
    const muette = { email: `syn-muette-${t}@exemple.fr`, id: "" };
    muette.id = await creerUtilisatrice(muette.email);
    await consentir(muette.id);
    await abonner(muette.id);
    expect(await candidates(), "aucune entrée de journal : rien à raconter").not.toContain(muette.id);
    await supprimer(muette.id);
  });
});

describe("[AC2] une synthèse par semaine, et pas deux", () => {
  const u = { email: `syn-idem-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    await consentir(u.id);
    await abonner(u.id);
    await graver(u.id, `${t}-i`, "un premier mot", "2026-03-02T10:00:00Z"); // AVANT la fin de la synthèse ci-dessous
  });
  afterAll(async () => supprimer(u.id));

  async function enregistrer(contenu: string, debut = "2026-03-01T00:00:00Z"): Promise<string | null> {
    const { data, error } = await admin.rpc("enregistrer_synthese", {
      p_utilisatrice: u.id,
      p_debut: debut,
      p_fin: "2026-03-08T00:00:00Z",
      p_contenu: contenu,
      p_tronquee: false,
    });
    if (error) throw new Error(`enregistrer_synthese: ${error.message}`);
    return (data as string | null) ?? null;
  }

  it("[LE CŒUR] le second enregistrement de la MÊME PÉRIODE rend `null` et n'écrit rien", async () => {
    // La clé est `periode_debut`, plus la semaine ISO (revue 4.9) : les périodes se pavent bout à bout,
    // donc deux synthèses ne peuvent pas partager un début.
    // Mutation-cible : retirer l'index unique, ou remplacer `do nothing` par `do update`. La conséquence
    // n'est pas une ligne en trop : `enregistrer` rendrait un identifiant une seconde fois, le job
    // enchaînerait sur la notification, et une VRAIE personne recevrait un second courriel.
    expect(await enregistrer("le premier récit"), "la première écrit").not.toBeNull();
    expect(await enregistrer("un second récit"), "la seconde ne peut pas").toBeNull();

    const { data } = await admin.from("synthese").select("contenu").eq("utilisatrice_id", u.id);
    expect(data, "une seule ligne").toHaveLength(1);
    expect(data![0].contenu, "et c'est la PREMIÈRE qui reste — pas d'écrasement silencieux").toBe(
      "le premier récit",
    );
  });

  it("[D2] la période suivante repart de la FIN de celle-ci, jamais d'« il y a sept jours »", async () => {
    // Le trou définitif qu'on refuse (décision D2) : après une synthèse au 8 mars, une entrée du 9 mars
    // doit être reprise même si la synthèse suivante n'arrive que trois semaines plus tard.
    await graver(u.id, `${t}-apres-synthese`, "dit juste après", "2026-03-09T10:00:00Z");
    const m = await materiau(u.id);
    expect(m.depuis, "le point de départ est la fin de la dernière synthèse").toBe("2026-03-08T00:00:00+00:00");
    expect(m.entrees.map((e) => e.contenu), "et rien de ce qui suit n'est perdu").toEqual(["dit juste après"]);
  });
});

describe("[AC4] le plafond de notification, et l'idempotence du canal", () => {
  const u = { email: `syn-notif-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
  });
  afterAll(async () => supprimer(u.id));

  async function reserver(cle: string, plafond = 72): Promise<boolean> {
    const { data, error } = await admin.rpc("reserver_notification", {
      p_utilisatrice: u.id,
      p_motif: "synthese_prete",
      p_cle: cle,
      p_plafond_heures: plafond,
    });
    if (error) throw new Error(`reserver_notification: ${error.message}`);
    return data === true;
  }

  it("[LE CŒUR] la première réservation passe ; une SECONDE, autre période, est refusée par le plafond", async () => {
    // Mutation-cible : retirer la clause `where not exists (… envoye_le > now() - plafond)`. Le plafond
    // ne serait alors qu'une intention. FR-035 et le plafond d'une notification / 72 h existent parce
    // qu'un produit qui écrit à quelqu'un plusieurs fois par semaine cesse d'être discret — et celui-ci
    // écrit sur un écran verrouillé, potentiellement devant quelqu'un d'autre.
    expect(await reserver("2099-W01"), "la première").toBe(true);
    expect(await reserver("2099-W02"), "une autre période, mais dans les 72 h").toBe(false);
  });

  /** Recule tout l'historique d'envoi : le plafond ne mord plus, seule l'idempotence peut encore refuser. */
  async function vieillirLesEnvois() {
    const { error } = await admin
      .from("notification_envoyee")
      .update({ envoye_le: "2026-01-01T00:00:00Z" })
      .eq("utilisatrice_id", u.id);
    if (error) throw new Error(`vieillir: ${error.message}`);
  }

  it("le MÊME motif pour la MÊME période ne se réserve jamais deux fois", async () => {
    // Deuxième garantie, distincte de la première : l'idempotence. Le job repasse chaque jour ; sans
    // elle, le plafond expiré à J+4 laisserait repartir l'annonce d'une synthèse déjà annoncée.
    await vieillirLesEnvois();
    expect(await reserver("2099-W01"), "plafond écoulé — seule l'idempotence peut refuser").toBe(false);
  });

  it("plafond écoulé + période neuve → l'annonce repart", async () => {
    // Contrôle positif : sans lui, les deux tests précédents seraient satisfaits par une fonction qui
    // refuse TOUJOURS — un canal muet, tout aussi cassé, et invisible.
    await vieillirLesEnvois();
    expect(await reserver("2099-W03")).toBe(true);
  });

  it("[REVUE 4.9 / T6-4] un plafond absent ou négatif est REFUSÉ, jamais interprété comme « pas de plafond »", async () => {
    // `make_interval(hours => null)` rend NULL, donc `envoye_le > NULL` rend NULL, donc `not exists` rend
    // TRUE : un plafond absent DÉSACTIVAIT silencieusement le plafond. Une valeur négative projetait la
    // borne dans le futur, avec le même effet. Le commentaire promettait une garantie de la base ;
    // c'était une garantie de l'appelant. Mutation-cible : retirer le `raise`.
    for (const plafond of [null, 0, -72]) {
      const { error } = await admin.rpc("reserver_notification", {
        p_utilisatrice: u.id,
        p_motif: "synthese_prete",
        p_cle: `absurde-${plafond}`,
        p_plafond_heures: plafond,
      });
      expect(error, `plafond ${plafond} doit être refusé`).not.toBeNull();
    }
  });

  it("[REVUE 4.9 / T1-2] le plafond regarde le MOTIF — sinon FR-033 mangerait le courriel de synthèse", async () => {
    // Le plafond ne regardait que « une notification, n'importe laquelle, dans les 72 h », alors que
    // l'unicité regardait `(utilisatrice, motif, clé)`. Les deux se contredisaient, et le mécanisme était
    // structurellement incompatible avec l'Epic 6 : un motif QUOTIDIEN (FR-033, le socle) aurait mangé
    // chaque semaine le courriel de synthèse.
    //
    // FRONTIÈRE HONNÊTE : la contrainte CHECK ne connaît encore qu'un seul motif, donc le comportement
    // à deux motifs n'est PAS observable aujourd'hui — aucun test de comportement ne peut le prouver, et
    // prétendre le contraire serait pire que ne rien tester. On assère donc sur le texte de la migration,
    // en le disant. Mutation-cible : retirer `and n.motif = p_motif` de la clause de plafond ; ce test
    // rougit, et il redeviendra un vrai test de comportement le jour où FR-033 ajoutera un motif.
    const migration = readFileSync(
      resolve(process.cwd(), "supabase/migrations/0030_synthese_rattrapage.sql"),
      "utf-8",
    );
    const clausePlafond = migration.slice(migration.indexOf("where not exists"));
    expect(clausePlafond.slice(0, 400), "le plafond filtre sur le motif").toContain("n.motif = p_motif");
  });

  it("un motif hors de l'ensemble fermé est REFUSÉ par la base", async () => {
    const { error } = await admin.rpc("reserver_notification", {
      p_utilisatrice: u.id,
      p_motif: "promo_black_friday",
      p_cle: "x",
      p_plafond_heures: 72,
    });
    expect(error, "la contrainte CHECK ferme l'ensemble des motifs").not.toBeNull();
  });
});

describe("[AD-12] ce qu'une SESSION peut et ne peut pas", () => {
  const u = { email: `syn-rls-${t}@exemple.fr`, id: "" };
  const autre = { email: `syn-rls-autre-${t}@exemple.fr`, id: "" };
  let sessionU: SupabaseClient;

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    autre.id = await creerUtilisatrice(autre.email);
    for (const id of [u.id, autre.id]) {
      // `enregistrer_synthese` porte désormais la garde d'éligibilité (T2-2) : sans abonnement ni
      // consentement, elle refuse d'écrire — ce qui est précisément le point, et ce qui est prouvé
      // séparément plus bas.
      await consentir(id);
      await abonner(id);
      await admin.rpc("enregistrer_synthese", {
        p_utilisatrice: id,
        p_debut: "2026-03-01T00:00:00Z",
        p_fin: "2026-03-08T00:00:00Z",
        p_contenu: `le récit de ${id}`,
        p_tronquee: false,
      });
    }
    sessionU = clientScope();
    const { error } = await sessionU.auth.signInWithPassword({ email: u.email, password: MDP });
    if (error) throw new Error(`signIn: ${error.message}`);
  });
  afterAll(async () => {
    await supprimer(u.id);
    await supprimer(autre.id);
  });

  it("elle lit LA SIENNE, et seulement la sienne", async () => {
    const { data } = await sessionU.from("synthese").select("utilisatrice_id, contenu");
    expect(data).toHaveLength(1);
    expect(data![0].utilisatrice_id).toBe(u.id);
  });

  it("elle ne peut ni forger, ni corriger, ni effacer sa synthèse", async () => {
    // L'insertion se prouve par son REFUS ; la mise à jour et la suppression par leur ABSENCE D'EFFET —
    // une écriture refusée par la RLS ne lève PAS, elle touche zéro ligne (leçon de la 4.8). Écrire ce
    // test à l'envers (« pas d'erreur = pas d'écriture ») le rendrait vert même si l'écriture passait.
    const { error } = await sessionU.from("synthese").insert({
      utilisatrice_id: u.id,
      semaine: "2099-W09",
      periode_debut: "2026-03-01T00:00:00Z",
      periode_fin: "2026-03-08T00:00:00Z",
      contenu: "un récit forgé",
    });
    expect(error, "insertion refusée").not.toBeNull();

    await sessionU.from("synthese").update({ contenu: "réécrit" }).eq("utilisatrice_id", u.id);
    await sessionU.from("synthese").delete().eq("utilisatrice_id", u.id);
    const { data } = await admin.from("synthese").select("contenu").eq("utilisatrice_id", u.id);
    expect(data, "toujours là").toHaveLength(1);
    expect(data![0].contenu, "et inchangée").toBe(`le récit de ${u.id}`);
  });

  it("elle ne voit RIEN de la table des notifications, et n'appelle AUCUNE des RPC", async () => {
    // Mutation-cible : oublier un `revoke execute`. Supabase accorde AUTOMATIQUEMENT `execute` à
    // `authenticated` sur toute nouvelle fonction du schéma `public` (leçon de la migration 0007) — et
    // ces fonctions sont en `security definer` : un grant oublié donnerait à n'importe quelle session le
    // droit de LIRE LE JOURNAL D'UNE AUTRE (`materiau_synthese` prend l'identifiant en paramètre).
    // `expect(notifs ?? []).toEqual([])` ne distinguait pas « la RLS ferme » de « la requête a échoué »
    // (revue 4.9, T4-4) : une erreur PostgREST rendait `data === null`, et le `?? []` peignait ça en
    // succès. On assère donc les DEUX : pas d'erreur, ET aucune ligne.
    const { data: notifs, error: erreurNotifs } = await sessionU.from("notification_envoyee").select("id");
    expect(erreurNotifs, "la requête aboutit — c'est la RLS qui filtre, pas une panne").toBeNull();
    expect(notifs, "deny-by-default").toEqual([]);

    const appels = [
      sessionU.rpc("materiau_synthese", { p_utilisatrice: autre.id, p_plafond_entrees: 10, p_plafond_octets: 1000 }),
      sessionU.rpc("entrees_hors_detresse", { p_utilisatrice: autre.id, p_depuis: null, p_jusqu_a: new Date().toISOString() }),
      sessionU.rpc("utilisatrices_a_synthetiser", { p_job: JOB, p_limite: 10 }),
      sessionU.rpc("personnes_en_echec_repete", { p_job: JOB }),
      sessionU.rpc("reserver_notification", { p_utilisatrice: u.id, p_motif: "synthese_prete", p_cle: "x", p_plafond_heures: 1 }),
      sessionU.rpc("enregistrer_synthese", {
        p_utilisatrice: u.id, p_debut: "2099-03-01T00:00:00Z",
        p_fin: "2099-03-08T00:00:00Z", p_contenu: "forgé", p_tronquee: false,
      }),
      // La garde d'autorisation elle-même : si une session pouvait l'appeler, elle apprendrait de
      // n'importe qui s'il ou elle est premium, barrée, ou en épisode de détresse.
      sessionU.rpc("eligible_a_synthese", { p_utilisatrice: autre.id }),
    ];
    for (const r of await Promise.all(appels)) expect(r.error, "RPC refusée sous JWT").not.toBeNull();
  });
});

describe("[le plafond de volume] il mord par le PLUS RÉCENT, et la tranche suivante reprend là", () => {
  const u = { email: `syn-volume-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    await consentir(u.id);
    await abonner(u.id);
    for (let i = 0; i < 5; i += 1) {
      await graver(u.id, `${t}-v${i}`, `entrée ${i}`, `2026-04-0${i + 1}T10:00:00Z`);
    }
  });
  afterAll(async () => supprimer(u.id));

  it("[LE CŒUR] garde le DÉBUT de la période, et pose le filigrane sur la dernière entrée lue", async () => {
    // LE défaut le plus coûteux de la 4.9. La version d'origine gardait les plus RÉCENTES puis posait
    // `periode_fin = now()` : ce qui avait été écarté passait sous le filigrane et n'entrait PLUS JAMAIS
    // dans aucune synthèse. La première synthèse visant tout le journal depuis l'inscription, une
    // utilisatrice bavarde perdait sa première année dès le jour un — silencieusement, et pour une cause
    // routinière (parler beaucoup, revenir après une absence), pas pour une panne.
    //
    // Mutation-cible : `order by e.cree_le desc` dans la fenêtre de `elig`, ou `'jusqu_a', v_instant`
    // inconditionnel. Les deux rétablissent le trou définitif.
    const m = await materiau(u.id, 3);
    expect(m.total, "le total compte TOUT, avant plafond").toBe(5);
    expect(m.tronquee).toBe(true);
    expect(m.entrees.map((e) => e.contenu), "les 3 PREMIÈRES, en ordre chronologique").toEqual([
      "entrée 0",
      "entrée 1",
      "entrée 2",
    ]);
    expect(
      new Date(m.jusqu_a).toISOString(),
      "le filigrane est la dernière entrée LUE, pas l'instant de lecture",
    ).toBe("2026-04-03T10:00:00.000Z");
  });

  it("[LE CŒUR] la tranche suivante reprend EXACTEMENT au filigrane — rien ne tombe entre les deux", async () => {
    // C'est la moitié qui manquait : garder le début ne sert à rien si la suite n'est jamais racontée.
    const premiere = await materiau(u.id, 3);
    const { error } = await admin.rpc("enregistrer_synthese", {
      p_utilisatrice: u.id,
      p_debut: premiere.entrees[0] ? "2026-04-01T10:00:00Z" : null,
      p_fin: premiere.jusqu_a,
      p_contenu: "la première tranche",
      p_tronquee: true,
    });
    if (error) throw new Error(`enregistrer: ${error.message}`);

    const suivante = await materiau(u.id, 3);
    expect(suivante.entrees.map((e) => e.contenu), "la SUITE, sans doublon ni trou").toEqual([
      "entrée 3",
      "entrée 4",
    ]);
    expect(suivante.tronquee, "et cette fois on va jusqu'au bout").toBe(false);

    await admin.from("synthese").delete().eq("utilisatrice_id", u.id);
  });

  it("sous le plafond, rien n'est tronqué et le filigrane est l'instant de lecture", async () => {
    const m = await materiau(u.id, 50);
    expect(m.tronquee).toBe(false);
    expect(m.entrees).toHaveLength(5);
    expect(new Date(m.jusqu_a).getTime(), "pas de troncature → le filigrane est maintenant").toBeGreaterThan(
      new Date("2026-04-05T10:00:00Z").getTime(),
    );
  });

  it("[REVUE 4.9 / T2-4] le plafond d'OCTETS mord aussi — sinon la fenêtre du modèle explose en silence", async () => {
    // `PLAFOND_ENTREES` seul ne bornait rien : 200 est un nombre d'entrées, et rien ne borne la longueur
    // d'une entrée. Mutation-cible : retirer `and e.octets <= p_plafond_octets`.
    const m = await materiau(u.id, 200, 20); // « entrée 0 » fait 8 caractères → deux tiennent, pas trois
    expect(m.entrees.length, "coupé par la taille, pas par le nombre").toBeLessThan(5);
    expect(m.tronquee).toBe(true);
  });

  it("une entrée SEULE plus grosse que le plafond passe quand même — sinon elle bloque tout, pour toujours", async () => {
    // Contrôle positif indispensable : si la tranche pouvait être vide, le filigrane n'avancerait jamais
    // et cette personne resterait bloquée sur une entrée trop longue jusqu'à la fin des temps.
    const m = await materiau(u.id, 200, 1);
    expect(m.entrees, "au moins une, toujours").toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// REVUE ADVERSARIALE 4.9 — LOT A
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

describe("[REVUE 4.9 / T1-1 / AD-17] rien ne naît pendant la détresse — pour de vrai cette fois", () => {
  const u = { email: `syn-ad17-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    await consentir(u.id);
    await abonner(u.id);
    // Une seule entrée, écrite AVANT tout épisode. C'est elle qui portait le défaut.
    await graver(u.id, `${t}-ad17`, "une journée ordinaire", "2026-05-01T10:00:00Z");
  });
  afterAll(async () => supprimer(u.id));

  it("sans détresse, elle est bien candidate — le contrôle positif d'abord", async () => {
    expect(await eligible(u.id)).toBe(true);
    expect(await candidates()).toContain(u.id);
  });

  it("[LE CŒUR] un épisode OUVERT la retire du lot, même si ses entrées sont ANTÉRIEURES", async () => {
    // LE défaut, et le plus grave de la revue. La migration 0029 affirmait « rien ne naît pendant la
    // détresse (AD-17) », le commit l'affirmait, la story l'affirmait. C'était faux : la clause AC3
    // n'écartait que les ENTRÉES tombées DANS l'épisode. Celles d'AVANT restaient éligibles, la rendaient
    // candidate, et une femme en épisode ouvert recevait sa synthèse ET son courriel — « Ta synthèse est
    // prête » au milieu d'une traversée.
    //
    // Aucun test ne rougissait parce que le seul test de l'époque montait l'épisode AVANT l'unique
    // entrée : il prouvait le cas où l'épisode couvre tout, puis concluait sur le cas général.
    //
    // Mutation-cible : retirer la clause `not exists (episode_detresse …)` d'`eligible_a_synthese`.
    await episode(u.id, "2026-05-10T20:00:00Z", null); // ouvert, et POSTÉRIEUR à l'entrée
    expect(await eligible(u.id), "l'autorisation tombe").toBe(false);
    expect(await candidates(), "et elle sort du lot").not.toContain(u.id);
  });

  it("l'épisode CLOS bloque encore pendant la fenêtre de 72 h — le prédicat de la maison, à la lettre", async () => {
    // `branche_bloquee_par_detresse()` (0010) est `fin is null OR fenetre_expire_at > now()`. La synthèse
    // n'a aucune raison d'être plus laxiste que la naissance d'une branche : le lendemain d'un épisode,
    // un bilan de sa semaine n'est pas ce dont elle a besoin. Mutation-cible : ne garder que `fin is null`.
    await admin.from("episode_detresse").delete().eq("utilisatrice_id", u.id);
    const ilYAUneHeure = new Date(Date.now() - 3_600_000).toISOString();
    await episode(u.id, "2026-05-10T20:00:00Z", ilYAUneHeure); // clos, fenêtre encore chaude
    expect(await eligible(u.id), "72 h après la fin, pas avant").toBe(false);

    await admin.from("episode_detresse").delete().eq("utilisatrice_id", u.id);
    const ilYALongtemps = new Date(Date.now() - 200 * 3_600_000).toISOString();
    await episode(u.id, "2026-05-10T20:00:00Z", ilYALongtemps); // clos, fenêtre froide
    expect(await eligible(u.id), "l'épisode ancien, lui, ne bloque plus rien").toBe(true);
  });
});

describe("[REVUE 4.9 / T2-2] la garde vit dans la fonction, pas chez l'appelant — leçon 4.5", () => {
  const revoquee = { email: `syn-revoq-${t}@exemple.fr`, id: "" };
  const gratuite = { email: `syn-gratuite-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    revoquee.id = await creerUtilisatrice(revoquee.email);
    await consentir(revoquee.id);
    await abonner(revoquee.id);
    await graver(revoquee.id, `${t}-r`, "VERBATIM INTIME", "2026-05-02T10:00:00Z");
    await admin.from("consentement").update({ revoked_at: new Date().toISOString() }).eq("utilisatrice_id", revoquee.id);

    gratuite.id = await creerUtilisatrice(gratuite.email);
    await consentir(gratuite.id);
    await graver(gratuite.id, `${t}-g`, "VERBATIM INTIME", "2026-05-02T10:00:00Z");
  });
  afterAll(async () => {
    await supprimer(revoquee.id);
    await supprimer(gratuite.id);
  });

  it("[LE CŒUR] `materiau_synthese` appelée DIRECTEMENT ne rend rien d'une inéligible", async () => {
    // Les conditions d'éligibilité ne vivaient QUE dans la fonction de sélection. Appelée directement —
    // par un futur export, un outil d'administration, un job d'Epic 5 — `materiau_synthese` rendait le
    // verbatim intégral du journal d'une utilisatrice ayant révoqué son consentement art. 9. C'est le
    // défaut R1+R3 de la Story 4.5, dont la leçon était écrite noir sur blanc : « une garde écrite dans
    // l'appelant n'est plus une garde, c'est une politesse ». La migration 0029 le disait elle-même,
    // deux fois — et l'appliquait à la détresse et aux tombstones, jamais à l'éligibilité.
    //
    // Mutation-cible : retirer le `if not public.eligible_a_synthese(...) then return … end if`.
    for (const inelig of [revoquee, gratuite]) {
      const m = await materiau(inelig.id);
      expect(m.entrees, `${inelig.email} : aucun verbatim`).toEqual([]);
      expect(m.total).toBe(0);
    }
  });

  it("[LE CŒUR] `enregistrer_synthese` appelée DIRECTEMENT n'écrit pas d'art. 9 pour une inéligible", async () => {
    // Même racine, effet symétrique : la fonction d'écriture acceptait n'importe quel identifiant. La
    // fenêtre réelle n'est pas théorique — entre la constitution du lot et l'écriture, il s'écoule
    // jusqu'à une minute et vingt appels au modèle fort.
    for (const inelig of [revoquee, gratuite]) {
      const { data, error } = await admin.rpc("enregistrer_synthese", {
        p_utilisatrice: inelig.id,
        p_debut: "2026-05-01T00:00:00Z",
        p_fin: "2026-05-08T00:00:00Z",
        p_contenu: "un récit qui n'aurait jamais dû être écrit",
        p_tronquee: false,
      });
      expect(error).toBeNull();
      expect(data, `${inelig.email} : refus`).toBeNull();
    }
    const { data: lignes } = await admin
      .from("synthese")
      .select("id")
      .in("utilisatrice_id", [revoquee.id, gratuite.id]);
    expect(lignes ?? [], "aucune ligne écrite").toEqual([]);
  });
});

describe("[REVUE 4.9] la CADENCE vit en base — sept jours, sauf rattrapage", () => {
  const u = { email: `syn-cadence-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    await consentir(u.id);
    await abonner(u.id);
    await graver(u.id, `${t}-c1`, "avant", "2026-06-01T10:00:00Z");
    await graver(u.id, `${t}-c2`, "après", new Date(Date.now() - 3_600_000).toISOString());
  });
  afterAll(async () => supprimer(u.id));

  async function poserSynthese(finIlYAHeures: number, tronquee: boolean) {
    await admin.from("synthese").delete().eq("utilisatrice_id", u.id);
    const fin = new Date(Date.now() - finIlYAHeures * 3_600_000).toISOString();
    const { error } = await admin.rpc("enregistrer_synthese", {
      p_utilisatrice: u.id,
      p_debut: "2026-06-01T00:00:00Z",
      p_fin: fin,
      p_contenu: "une tranche",
      p_tronquee: tronquee,
    });
    if (error) throw new Error(`poserSynthese: ${error.message}`);
  }

  it("servie il y a deux jours, entière → elle attend", async () => {
    // Remplace la clé hebdomadaire ISO. Ce que ça corrige au passage : dimanche servie pour W32, une
    // phrase écrite le soir, lundi la semaine ISO bascule et elle recevait une « synthèse hebdomadaire »
    // couvrant 22 heures — le message générique récurrent que FR-034 interdit.
    // Mutation-cible : retirer la clause `d.periode_fin <= now() - interval '7 days'`.
    await poserSynthese(48, false);
    expect(await candidates()).not.toContain(u.id);
  });

  it("servie il y a huit jours → elle revient", async () => {
    await poserSynthese(8 * 24, false);
    expect(await candidates()).toContain(u.id);
  });

  it("[LE CŒUR] servie il y a deux jours mais TRONQUÉE → elle revient dès demain", async () => {
    // C'est le rattrapage chronologique. Sans cette clause, une utilisatrice revenue après trois mois
    // verrait son journal raconté à raison d'une tranche par semaine : sa synthèse d'août parlerait de
    // février. Mutation-cible : retirer `or d.tronquee`.
    await poserSynthese(48, true);
    expect(await candidates()).toContain(u.id);
  });
});

describe("[REVUE 4.9] les deux trous que la mutation-vérification a trouvés dans mes propres tests", () => {
  const sansArt9 = { email: `syn-noart9-${t}@exemple.fr`, id: "" };
  const sansIa = { email: `syn-noia-${t}@exemple.fr`, id: "" };
  const bavarde = { email: `syn-anam-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    // Une ligne de consentement EXISTE, mais la case art. 9 n'est pas cochée. Le test d'origine
    // n'éprouvait que « aucune ligne » et « revoked_at posé » : le mutant `and k.art9_accorde = true`
    // → `and true` SURVIVAIT, c'est-à-dire qu'une femme ayant refusé l'art. 9 tout en ayant accepté les
    // CGU aurait reçu sa synthèse. Le défaut était déjà signalé dans la revue (S1/S2) ; je l'avais
    // reproduit.
    sansArt9.id = await creerUtilisatrice(sansArt9.email);
    await consentir(sansArt9.id, { sansArt9: true });
    await abonner(sansArt9.id);
    await graver(sansArt9.id, `${t}-na`, "quelque chose", "2026-07-01T10:00:00Z");

    sansIa.id = await creerUtilisatrice(sansIa.email);
    await consentir(sansIa.id, { sansIa: true });
    await abonner(sansIa.id);
    await graver(sansIa.id, `${t}-ni`, "quelque chose", "2026-07-01T10:00:00Z");

    bavarde.id = await creerUtilisatrice(bavarde.email);
    await consentir(bavarde.id);
    await abonner(bavarde.id);
    await graver(bavarde.id, `${t}-elle`, "CE QU'ELLE A DIT", "2026-07-01T10:00:00Z");
    // Une ligne `role = 'anam'`. Aucun chemin de production n'en écrit (la policy de 0016 épingle
    // `utilisatrice` à l'insertion, précisément « sinon une utilisatrice forgerait de fausses paroles
    // d'Anam »), mais `service_role` contourne la RLS — et l'Epic 6 en écrira.
    await graver(bavarde.id, `${t}-anam`, "CE QU'ANAM AURAIT DIT", "2026-07-01T11:00:00Z", "anam");
  });
  afterAll(async () => {
    await supprimer(sansArt9.id);
    await supprimer(sansIa.id);
    await supprimer(bavarde.id);
  });

  it("cocher les CGU sans cocher l'art. 9 ne suffit pas — chaque case est éprouvée séparément", async () => {
    // Mutation-cible : `and k.art9_accorde = true` → `and true`, puis `and k.ia_reconnue = true` → `and true`.
    expect(await eligible(sansArt9.id), "art. 9 refusé").toBe(false);
    expect(await eligible(sansIa.id), "IA non reconnue").toBe(false);
    const liste = await candidates();
    expect(liste).not.toContain(sansArt9.id);
    expect(liste).not.toContain(sansIa.id);
  });

  it("[LE CŒUR] le matériau ne contient QUE ses mots à elle — jamais une ligne attribuée à Anam", async () => {
    // C'est la moitié BASE de la correction T1-5. L'autre moitié (plus de préfixe de voix dans le
    // prompt) vit dans `consigne-synthese.ts`. Les deux sont nécessaires : sans le filtre, le jour où
    // l'Epic 6 écrira les tours d'Anam, ils entreraient dans un bloc que la consigne présente comme
    // « ce qu'elle a écrit ». Mutation-cible : `where e.role = 'utilisatrice'` → `where true`.
    const m = await materiau(bavarde.id);
    expect(m.entrees.map((e) => e.contenu)).toEqual(["CE QU'ELLE A DIT"]);
    expect(m.total, "le total non plus ne compte pas les tours d'Anam").toBe(1);
  });

  it("une personne dont le journal ne contient QUE des tours d'Anam n'est pas candidate", async () => {
    // Latent aujourd'hui, armé à l'Epic 6 (FR-033, le socle quotidien : Anam parle sans être
    // sollicitée). Sans le filtre dans la condition d'éligibilité, une personne qui n'a RIEN dit de la
    // semaine deviendrait candidate, coûterait un appel au modèle fort et recevrait un courriel pour une
    // synthèse composée des paroles d'Anam — le message générique récurrent que FR-034 interdit.
    const muette = { email: `syn-anam-seule-${t}@exemple.fr`, id: "" };
    muette.id = await creerUtilisatrice(muette.email);
    try {
      await consentir(muette.id);
      await abonner(muette.id);
      await graver(muette.id, `${t}-seul`, "Anam parle toute seule", "2026-07-02T10:00:00Z", "anam");
      expect(await eligible(muette.id), "elle est bien autorisée…").toBe(true);
      expect(await candidates(), "…mais elle n'a rien dit").not.toContain(muette.id);
    } finally {
      await supprimer(muette.id);
    }
  });
});

describe("[REVUE 4.9 / T3-2] le disjoncteur — une personne ne peut plus brûler le modèle fort à vie", () => {
  const u = { email: `syn-disj-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    await consentir(u.id);
    await abonner(u.id);
    await graver(u.id, `${t}-d`, "quelque chose à raconter", "2026-07-10T10:00:00Z");
  });
  afterAll(async () => {
    await admin.from("execution_job").delete().eq("cible_id", u.id);
    await supprimer(u.id);
  });

  async function echouer(jour: string) {
    await admin.rpc("reclamer_execution", { p_job: JOB, p_fenetre: jour, p_cible_id: u.id, p_bail_secondes: 1 });
    await admin.rpc("clore_execution", {
      p_job: JOB, p_fenetre: jour, p_cible_id: u.id, p_reussi: false, p_motif: "synthese_modele_timeout",
    });
  }

  it("[CONTRÔLE POSITIF] deux échecs ne suffisent pas — on ne renonce pas au premier hoquet", async () => {
    await echouer("2026-07-11");
    await echouer("2026-07-12");
    expect(await candidates(), "elle revient, et c'est normal").toContain(u.id);
    expect(await admin.rpc("personnes_en_echec_repete", { p_job: JOB }).then((r) => r.data)).toBe(0);
  });

  it("[LE CŒUR] au TROISIÈME échec en sept jours, elle est mise de côté", async () => {
    // Le scénario n'a rien de tordu : une personne dont le matériau fait échouer le modèle de façon
    // DÉTERMINISTE — un contenu qui déclenche un refus, une taille limite, un caractère qui casse un
    // parseur chez le fournisseur. Rien n'est écrit, donc le filigrane n'avance pas, donc demain elle est
    // candidate avec exactement le même matériau. Et comme le tri sert d'abord celle qui a attendu le
    // plus longtemps, elle est PREMIÈRE. Tous les jours. Pour toujours — en brûlant un appel au modèle
    // fort à chaque fois, et en occupant une place du lot pendant que les autres attendent.
    //
    // Ce n'est pas un abandon : la fenêtre de sept jours GLISSE, donc elle revient d'elle-même.
    // Mutation-cible : retirer la sous-requête `< 3`, ou remonter le seuil.
    await echouer("2026-07-13");
    expect(await candidates(), "trois échecs : on passe son tour").not.toContain(u.id);
  });

  it("… et le job peut le SAVOIR, sinon l'écartement serait silencieux", async () => {
    // « Cette personne n'a plus de synthèse » est précisément ce qu'il faut savoir. C'est aussi le seul
    // signal fiable dans un produit qui compte une poignée d'utilisatrices, où « tout le lot a échoué »
    // se déclenche au premier hoquet et ne veut rien dire.
    // Mutation-cible : `having count(*) >= p_seuil` → un seuil inatteignable.
    const { data } = await admin.rpc("personnes_en_echec_repete", { p_job: JOB });
    expect(data, "une personne écartée, et le job en est informé").toBe(1);
  });

  it("les échecs d'un AUTRE job ne comptent pas", async () => {
    // Sans le filtre sur le job, la rétention d'Epic 6 qui échoue trois fois écarterait la personne de
    // la synthèse — deux mécanismes sans rapport, couplés par un compteur trop large.
    const { data } = await admin.rpc("personnes_en_echec_repete", { p_job: `${JOB}-autre` });
    expect(data).toBe(0);
  });
});

describe("[REVUE 4.9 / T4-1] les gardes que la campagne d'origine avait laissées sans preuve", () => {
  const jamais = { email: `syn-ordre-a-${t}@exemple.fr`, id: "" };
  const servie = { email: `syn-ordre-b-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    // L'ORDRE DE CRÉATION COMPTE : `jamais` est inscrite en premier. C'est le second critère de tri.
    jamais.id = await creerUtilisatrice(jamais.email);
    await consentir(jamais.id);
    await abonner(jamais.id);
    await graver(jamais.id, `${t}-oa`, "elle écrit", "2026-06-15T10:00:00Z");

    servie.id = await creerUtilisatrice(servie.email);
    await consentir(servie.id);
    await abonner(servie.id);
    await graver(servie.id, `${t}-ob`, "elle écrit aussi", new Date(Date.now() - 3_600_000).toISOString());
    // Servie il y a huit jours : au-delà de la cadence, donc de nouveau candidate — mais APRÈS celle qui
    // n'a jamais rien reçu.
    await admin.rpc("enregistrer_synthese", {
      p_utilisatrice: servie.id,
      p_debut: "2026-06-01T00:00:00Z",
      p_fin: new Date(Date.now() - 8 * 24 * 3_600_000).toISOString(),
      p_contenu: "une synthèse déjà ancienne",
      p_tronquee: false,
    });
  });
  afterAll(async () => {
    await supprimer(jamais.id);
    await supprimer(servie.id);
  });

  it("[LE CŒUR] celle qui n'a JAMAIS rien reçu passe devant celle qui a déjà été servie", async () => {
    // Mutant survivant de la campagne d'origine : `nulls first` → `nulls last`. Le lot est BORNÉ ; servir
    // d'abord celles qui ont déjà été servies affamerait indéfiniment les nouvelles — et ce sont
    // précisément celles pour qui la première synthèse compte le plus.
    const liste = await candidates();
    const miennes = liste.filter((id) => id === jamais.id || id === servie.id);
    expect(miennes, "jamais servie d'abord").toEqual([jamais.id, servie.id]);
  });

  it("les CHECK de `synthese` refusent ce que le code ne devrait jamais produire", async () => {
    // Deux mutants survivants d'origine : les deux contraintes pouvaient être supprimées sans qu'un seul
    // test ne rougisse. Elles sont le dernier filet — celui qui tient encore quand la validation du
    // domaine a été contournée par un futur chemin d'écriture. `service_role` contourne la RLS, pas les
    // contraintes : c'est bien la base qui refuse ici, pas une politesse.
    const vide = await admin.from("synthese").insert({
      utilisatrice_id: jamais.id,
      periode_debut: "2026-05-01T00:00:00Z",
      periode_fin: "2026-05-08T00:00:00Z",
      contenu: "   \n  ",
    });
    expect(vide.error?.message, "un récit vide n'est pas un récit").toMatch(/synthese_contenu_non_vide/);

    const aLEnvers = await admin.from("synthese").insert({
      utilisatrice_id: jamais.id,
      periode_debut: "2026-05-08T00:00:00Z",
      periode_fin: "2026-05-01T00:00:00Z",
      contenu: "une période à l'envers",
    });
    expect(aLEnvers.error?.message, "une période ne remonte pas le temps").toMatch(
      /synthese_periode_coherente/,
    );

    // CONTRÔLE POSITIF : sans lui, les deux gardes ci-dessus seraient satisfaites par une table qui
    // refuse TOUTE écriture — et la story entière serait morte sans qu'un test ne le dise.
    const bonne = await admin.from("synthese").insert({
      utilisatrice_id: jamais.id,
      periode_debut: "2026-05-01T00:00:00Z",
      periode_fin: "2026-05-08T00:00:00Z",
      contenu: "un vrai récit",
    });
    expect(bonne.error, "une écriture bien formée passe").toBeNull();
    await admin.from("synthese").delete().eq("utilisatrice_id", jamais.id);
  });

  it("[LE CŒUR] l'entrée qui porte EXACTEMENT le filigrane n'est jamais racontée deux fois", async () => {
    // Mutant survivant d'origine : `j.cree_le > p_depuis` → `>=`. L'intervalle est semi-ouvert, et il
    // DOIT l'être : quand le plafond mord, le filigrane vaut l'horodatage de la dernière entrée lue.
    // Avec `>=`, cette entrée-là rentrerait dans les deux tranches — la synthèse suivante rouvrirait sur
    // une phrase déjà racontée, et le rattrapage n'avancerait jamais d'un cran franc.
    const instant = "2026-06-20T12:00:00Z";
    await graver(jamais.id, `${t}-pile`, "PILE SUR LA BORNE", instant);
    await admin.rpc("enregistrer_synthese", {
      p_utilisatrice: jamais.id,
      p_debut: "2026-06-15T10:00:00Z",
      p_fin: instant, // le filigrane EST l'horodatage de cette entrée
      p_contenu: "la tranche qui s'arrête pile là",
      p_tronquee: true,
    });

    const suite = await materiau(jamais.id);
    expect(
      suite.entrees.map((e) => e.contenu),
      "elle a déjà été racontée : elle ne revient pas",
    ).not.toContain("PILE SUR LA BORNE");

    await admin.from("synthese").delete().eq("utilisatrice_id", jamais.id);
  });
});
