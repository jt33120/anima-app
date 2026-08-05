import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
const SEMAINE = "2099-W01"; // hors de toute fenêtre réelle : ces lignes ne croisent aucun autre fichier

async function creerUtilisatrice(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({ email, password: MDP, email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  return data.user!.id;
}

async function consentir(id: string, options: { revoque?: boolean } = {}) {
  const { error } = await admin.from("consentement").insert({
    utilisatrice_id: id,
    art9_accorde: true,
    ia_reconnue: true,
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

async function graver(id: string, cle: string, contenu: string, creeLe?: string): Promise<void> {
  const ligne: Record<string, unknown> = { utilisatrice_id: id, cle_tour: cle, role: "utilisatrice", contenu };
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

async function materiau(id: string, plafond = 200) {
  const { data, error } = await admin.rpc("materiau_synthese", { p_utilisatrice: id, p_plafond_entrees: plafond });
  if (error) throw new Error(`materiau_synthese: ${error.message}`);
  return data as { total: number; tronquee: boolean; entrees: { contenu: string }[]; faits: string[]; depuis: string | null };
}

async function candidates(semaine = SEMAINE, limite = 50): Promise<string[]> {
  const { data, error } = await admin.rpc("utilisatrices_a_synthetiser", { p_semaine: semaine, p_limite: limite });
  if (error) throw new Error(`utilisatrices_a_synthetiser: ${error.message}`);
  return data as string[];
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

  async function enregistrer(contenu: string): Promise<boolean> {
    const { data, error } = await admin.rpc("enregistrer_synthese", {
      p_utilisatrice: u.id,
      p_semaine: SEMAINE,
      p_debut: "2026-03-01T00:00:00Z",
      p_fin: "2026-03-08T00:00:00Z",
      p_contenu: contenu,
      p_tronquee: false,
    });
    if (error) throw new Error(`enregistrer_synthese: ${error.message}`);
    return data === true;
  }

  it("[LE CŒUR] le second enregistrement de la même semaine rend `false` et n'écrit rien", async () => {
    // Mutation-cible : retirer l'index unique, ou remplacer `do nothing` par `do update`. La conséquence
    // n'est pas une ligne en trop : `enregistrer` rendrait `true` une seconde fois, le job enchaînerait
    // sur la notification, et une VRAIE personne recevrait un second courriel pour la même semaine.
    expect(await enregistrer("le premier récit"), "la première écrit").toBe(true);
    expect(await enregistrer("un second récit"), "la seconde ne peut pas").toBe(false);

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

  it("le MÊME motif pour la MÊME période ne se réserve jamais deux fois", async () => {
    // Deuxième garantie, distincte de la première : l'idempotence. Le job repasse chaque jour ; sans
    // elle, le plafond expiré à J+4 laisserait repartir l'annonce d'une synthèse déjà annoncée.
    expect(await reserver("2099-W01", 0), "plafond neutralisé — seule l'idempotence peut refuser").toBe(false);
  });

  it("plafond écoulé + période neuve → l'annonce repart", async () => {
    // Contrôle positif : sans lui, les deux tests précédents seraient satisfaits par une fonction qui
    // refuse TOUJOURS — un canal muet, tout aussi cassé, et invisible.
    expect(await reserver("2099-W03", 0)).toBe(true);
  });

  it("un motif hors de l'ensemble fermé est REFUSÉ par la base", async () => {
    const { error } = await admin.rpc("reserver_notification", {
      p_utilisatrice: u.id,
      p_motif: "promo_black_friday",
      p_cle: "x",
      p_plafond_heures: 0,
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
      await admin.rpc("enregistrer_synthese", {
        p_utilisatrice: id,
        p_semaine: SEMAINE,
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
    const { data: notifs } = await sessionU.from("notification_envoyee").select("id");
    expect(notifs ?? [], "deny-by-default").toEqual([]);

    const appels = [
      sessionU.rpc("materiau_synthese", { p_utilisatrice: autre.id, p_plafond_entrees: 10 }),
      sessionU.rpc("entrees_hors_detresse", { p_utilisatrice: autre.id, p_depuis: null, p_jusqu_a: new Date().toISOString() }),
      sessionU.rpc("utilisatrices_a_synthetiser", { p_semaine: SEMAINE, p_limite: 10 }),
      sessionU.rpc("reserver_notification", { p_utilisatrice: u.id, p_motif: "synthese_prete", p_cle: "x", p_plafond_heures: 0 }),
      sessionU.rpc("enregistrer_synthese", {
        p_utilisatrice: u.id, p_semaine: "2099-W08", p_debut: "2026-03-01T00:00:00Z",
        p_fin: "2026-03-08T00:00:00Z", p_contenu: "forgé", p_tronquee: false,
      }),
    ];
    for (const r of await Promise.all(appels)) expect(r.error, "RPC refusée sous JWT").not.toBeNull();
  });
});

describe("[le plafond de volume] il mord par le PLUS ANCIEN, et il le dit", () => {
  const u = { email: `syn-volume-${t}@exemple.fr`, id: "" };

  beforeAll(async () => {
    u.id = await creerUtilisatrice(u.email);
    for (let i = 0; i < 5; i += 1) {
      await graver(u.id, `${t}-v${i}`, `entrée ${i}`, `2026-04-0${i + 1}T10:00:00Z`);
    }
  });
  afterAll(async () => supprimer(u.id));

  it("garde les plus RÉCENTES, les rend dans l'ordre, et signale la troncature", async () => {
    // Mutation-cible : `order by cree_le asc` dans le sous-select du plafond. On garderait alors le
    // début et on jetterait la fin : la synthèse raconterait un passé lointain en ignorant la semaine
    // qui vient de se passer — l'inverse exact de ce qu'on vient lire.
    const m = await materiau(u.id, 3);
    expect(m.total, "le total compte TOUT, avant plafond").toBe(5);
    expect(m.tronquee).toBe(true);
    expect(m.entrees.map((e) => e.contenu), "les 3 plus récentes, en ordre chronologique").toEqual([
      "entrée 2",
      "entrée 3",
      "entrée 4",
    ]);
  });

  it("sous le plafond, rien n'est tronqué", async () => {
    const m = await materiau(u.id, 50);
    expect(m.tronquee).toBe(false);
    expect(m.entrees).toHaveLength(5);
  });
});
