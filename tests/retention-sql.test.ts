import { describe, it, expect, beforeAll } from "vitest";
import { definitionCourante } from "./_sql-courant";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * retention-sql.test.ts — LE MOTEUR DE RÉTENTION, CONTRE LE VRAI POSTGRES (Story 6.8).
 *
 * ══ CE QU'ON ÉPROUVE ICI, ET QU'AUCUNE DOUBLURE NE POURRAIT ÉPROUVER ════════════════════════════
 *
 * Toutes les décisions de cette story vivent en base, et pour une raison : entre lire l'activité et
 * décider d'effacer, il y a un intervalle — et cet intervalle-là, c'est exactement le moment où elle
 * revient. `trancher_echeance_suppression` remesure et tranche dans la même transaction ; un test qui
 * doublerait la base ne prouverait rien de cette propriété.
 *
 * ⚠️ LES QUATRE REFUS SONT PLUS IMPORTANTS QUE LES DEUX EFFACEMENTS. Un moteur de rétention qui
 * n'efface pas assez est un défaut de conformité ; un moteur qui efface une personne de trop est
 * irréversible. On éprouve donc d'abord tout ce qu'il ne doit JAMAIS toucher.
 */

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const clientNu = () => createClient(url, publishable, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();
const MDP = "test-retention-123!";
const INACTIVITE = 24;
const PREAVIS = 3;
const FENETRE = 7;

function ilYAMois(mois: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - mois);
  return d.toISOString();
}

async function creerCompte(suffixe: string, creeIlYAMois: number): Promise<string> {
  const email = `retention-${suffixe}-${t}@exemple.fr`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: MDP, email_confirm: true });
  if (error) throw new Error(`createUser: ${error.message}`);
  const id = data.user!.id;
  // On recule la naissance du compte : c'est le PLANCHER d'activité de `derniere_activite`.
  const { error: eRecul } = await admin
    .from("utilisatrice")
    .update({ cree_le: ilYAMois(creeIlYAMois) })
    .eq("id", id);
  if (eRecul) throw new Error(`recul: ${eRecul.message}`);
  return id;
}

const rpc = async (nom: string, args: Record<string, unknown>) => {
  const { data, error } = await admin.rpc(nom, args);
  if (error) throw new Error(`${nom}: ${error.message}`);
  return data;
};

const idsDe = (data: unknown): string[] =>
  Array.isArray(data) ? data.map((l) => (l as { utilisatrice_id: string }).utilisatrice_id) : [];

/** Tous les comptes à prévenir, sans plafond de lot — la sélection est ce qu'on éprouve. */
const aPrevenir = async () => idsDe(await rpc("comptes_a_prevenir", { p_inactivite_mois: INACTIVITE, p_max: 5_000 }));
const aEffacer = async () => idsDe(await rpc("comptes_a_effacer", { p_max: 5_000 }));

const trancher = (id: string) =>
  rpc("trancher_echeance_suppression", {
    p_utilisatrice_id: id,
    p_inactivite_mois: INACTIVITE,
    p_preavis_mois: PREAVIS,
    p_fenetre_pitr_jours: FENETRE,
  });

const existe = async (id: string) =>
  (await admin.from("utilisatrice").select("id").eq("id", id).maybeSingle()).data !== null;

const echeanceDe = async (id: string) =>
  ((await admin.from("utilisatrice").select("echeance_suppression").eq("id", id).maybeSingle()).data as
    | { echeance_suppression: string | null }
    | null)?.echeance_suppression ?? null;

let dormeuse = "";
let abonnee = "";
let recente = "";
let revenue = "";
let mineure = "";
let mineureSansEcheance = "";

beforeAll(async () => {
  if (!url || !publishable || !secret) throw new Error("Supabase local requis.");

  dormeuse = await creerCompte("dormeuse", 30);
  abonnee = await creerCompte("abonnee", 30);
  recente = await creerCompte("recente", 1);
  revenue = await creerCompte("revenue", 30);
  mineure = await creerCompte("mineure", 30);
  mineureSansEcheance = await creerCompte("mineure-nue", 30);

  // L'abonnée paie sans jamais ouvrir l'application : ses traces d'activité ne bougent pas.
  await admin.from("abonnement").insert({
    utilisatrice_id: abonnee,
    etat: "actif",
    source_maj_le: new Date().toISOString(),
  });

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // LA MINEURE EST BARRÉE PAR LA VRAIE RPC — ET C'EST TOUT LE CORRECTIF (revue Epic 6, R2)
  // ══════════════════════════════════════════════════════════════════════════════════════════
  //
  // ⚠️ CETTE FIXTURE ÉCRIVAIT `mineur_detecte: true` À LA MAIN, SOUS LE COMMENTAIRE « comme le pose
  // `appliquer_barriere_minorite` ». **Ce n'est pas ce que cette fonction fait.** Elle écrit
  // `barriere_minorite_le` et l'échéance, et ne touche JAMAIS `mineur_detecte` — les deux drapeaux
  // disent deux faits différents (déclaration au seuil d'âge, FR-070, contre détection après coup,
  // FR-071), et 0042 a délibérément refusé de les confondre.
  //
  // La fixture fabriquait donc un état que la production ne produit jamais, et **masquait le défaut
  // au lieu de le révéler** : `trancher_echeance_suppression` ne lisait que `mineur_detecte`, donc la
  // branche FR-071 était inatteignable pour les seules personnes qu'elle protège. Elles repartaient
  // GRACIÉES, échéance effacée et non reposable — suspendues à vie, jamais effacées.
  //
  // La règle qu'on en tire : une fixture passe par le CHEMIN D'ÉCRITURE RÉEL, sinon elle teste un
  // monde qui n'existe pas.
  {
    const hier = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const { error } = await admin.rpc("appliquer_barriere_minorite", { cible: mineure, echeance: hier });
    expect(error, "la barrière de minorité n'a pas pu être posée").toBeNull();
  }

  // ⚠️ ET UNE MINEURE SANS ÉCHÉANCE — c'est un mutant survivant qui l'a imposée. Avec la seule
  // `mineure` ci-dessus, l'assertion « une mineure n'entre pas par le chemin de l'inactivité »
  // était vraie POUR UNE AUTRE RAISON : son échéance déjà posée l'excluait de toute façon. Deux
  // défenses qui se couvrent l'une l'autre, et un test incapable de dire laquelle a mordu.
  // Celle-ci porte l'AUTRE barrière — la minorité DÉCLARÉE au seuil d'âge (FR-070), qui ne pose
  // jamais d'échéance. Les deux chemins sont donc représentés, et `trancher` doit reconnaître les deux.
  await admin.from("utilisatrice").update({ mineur_detecte: true }).eq("id", mineureSansEcheance);
}, 60_000);

describe("[6.8/AC1] Ce que le moteur ne touche JAMAIS — et c'est la moitié qui compte", () => {
  it("[LE CŒUR] une ABONNÉE ACTIVE n'est jamais prévenue, même sans un geste depuis trente mois", async () => {
    // Le raisonnement est désagréable et il faut l'écrire : payer sans ouvrir l'application est un
    // usage. Sans cette garde, le moteur effacerait les données de quelqu'un qui paie, et le premier
    // signe en serait sa carte débitée pour un compte vide.
    expect(await aPrevenir()).not.toContain(abonnee);
  });

  it("un compte RÉCENT n'est pas prévenu", async () => {
    expect(await aPrevenir()).not.toContain(recente);
  });

  it("[LE CŒUR] une MINEURE n'entre pas par le chemin de l'inactivité — MÊME sans échéance posée", async () => {
    const prevenables = await aPrevenir();
    expect(prevenables).not.toContain(mineure);
    // Celle-ci n'a AUCUNE échéance : seule la garde `mineur_detecte = false` peut l'exclure.
    expect(prevenables, "une mineure est prévenue comme une dormeuse ordinaire").not.toContain(
      mineureSansEcheance,
    );
  });

  it("[ANTI-VACUITÉ] la DORMEUSE, elle, est bien prévenue — sinon les trois refus ne prouvent rien", async () => {
    expect(await aPrevenir()).toContain(dormeuse);
  });
});

describe("[6.8/AC2] Le préavis : posé une fois, jamais écrasé", () => {
  it("[LE CŒUR] la pose donne une échéance à trois mois", async () => {
    expect(await rpc("poser_echeance_suppression", { p_utilisatrice_id: dormeuse, p_preavis_mois: PREAVIS })).toBe(true);
    const echeance = await echeanceDe(dormeuse);
    expect(echeance).toBeTruthy();
    const jours = (Date.parse(echeance!) - Date.now()) / 86_400_000;
    expect(jours).toBeGreaterThan(80);
    expect(jours).toBeLessThan(95);
  });

  it("[LE CŒUR] une seconde pose est REFUSÉE — l'échéance courte de la minorité ne se repousse pas", async () => {
    expect(await rpc("poser_echeance_suppression", { p_utilisatrice_id: dormeuse, p_preavis_mois: PREAVIS })).toBe(false);
    expect(await rpc("poser_echeance_suppression", { p_utilisatrice_id: mineure, p_preavis_mois: PREAVIS })).toBe(false);
  });

  it("une fois prévenue, elle ne ressort plus de la sélection — l'avis est idempotent", async () => {
    expect(await aPrevenir()).not.toContain(dormeuse);
  });

  it("un préavis absurde est refusé", async () => {
    await expect(rpc("poser_echeance_suppression", { p_utilisatrice_id: dormeuse, p_preavis_mois: 0 })).rejects.toThrow(
      /preavis_invalide/,
    );
  });
});

describe("[6.8/AC2] Trancher — effacer, gracier, ignorer", () => {
  it("une échéance NON ÉCHUE est ignorée", async () => {
    expect(await trancher(dormeuse)).toBe("ignoree");
    expect(await existe(dormeuse)).toBe(true);
  });

  it("[LE CŒUR] REVENIR SUFFIT : l'échéance est retirée, et rien n'est supprimé", async () => {
    // « Trois mois plus tard SANS REPRISE » ne s'appuie sur aucun drapeau qu'il faudrait penser à
    // nettoyer : au moment de trancher, on REMESURE. Un tirage d'hier suffit à la gracier.
    await admin.from("utilisatrice").update({ echeance_suppression: "2020-01-01" }).eq("id", revenue);
    await admin.from("tirage").insert({
      utilisatrice_id: revenue,
      carte: "la-porte",
      graine: "0a1b2c3d",
      taille_jeu: 64,
    });

    expect(await trancher(revenue)).toBe("graciee");
    expect(await existe(revenue)).toBe(true);
    expect(await echeanceDe(revenue), "l'échéance n'a pas été retirée").toBeNull();
  });

  it("[LE CŒUR] une DORMEUSE dont l'échéance est échue est effacée, motif « inactivite »", async () => {
    await admin.from("utilisatrice").update({ echeance_suppression: "2020-01-01" }).eq("id", dormeuse);
    expect(await aEffacer()).toContain(dormeuse);

    expect(await trancher(dormeuse)).toBe("effacee");
    expect(await existe(dormeuse), "le compte survit à son effacement").toBe(false);

    const { data } = await admin.from("effacement").select("motif").eq("motif", "inactivite").limit(1);
    expect((data ?? []).length, "aucune trace d'effacement pour inactivité").toBeGreaterThan(0);
  });

  it("[LE CŒUR · R2] une MINEURE DÉTECTÉE est effacée MÊME abonnée — le compte n'aurait jamais dû exister", async () => {
    // ⚠️ CE TEST NE PROUVAIT RIEN AVANT LA REVUE DE L'EPIC 6, ET IL EN AVAIT L'AIR.
    //
    // Sa fixture écrivait `mineur_detecte: true` à la main. `appliquer_barriere_minorite` n'écrit
    // JAMAIS cette colonne — elle pose `barriere_minorite_le`. Le test fabriquait donc un état que la
    // production ne produit jamais, et validait une branche que personne ne pouvait atteindre.
    //
    // Dans le monde réel, `trancher` ne lisait que `mineur_detecte` : une mineure DÉTECTÉE tombait
    // dans la grâce ordinaire, son échéance était effacée — et ne pouvait plus être reposée, puisque
    // `appliquer_barriere_minorite` exige `barriere_minorite_le is null`. Suspendue à vie, jamais
    // effacée : l'exact inverse de FR-071.
    //
    // La fixture passe désormais par la VRAIE RPC. Le mutant est donc mort d'une seule façon :
    // retirer `or u.barriere_minorite_le is not null` de 0061 rend « graciee » ici.
    await admin.from("abonnement").insert({
      utilisatrice_id: mineure,
      etat: "actif",
      source_maj_le: new Date().toISOString(),
    });
    expect(await trancher(mineure)).toBe("effacee");
    expect(await existe(mineure)).toBe(false);
    // Et sous le bon motif : « inactivite » ici voudrait dire que la branche FR-071 a été manquée et
    // que c'est la voie ordinaire qui a fini par l'effacer, pour une autre raison.
    const { data } = await admin.from("effacement").select("motif").eq("motif", "minorite").limit(1);
    expect((data ?? []).length, "effacée, mais pas AU TITRE de la minorité").toBeGreaterThan(0);
  });

  it("[R2] une MINEURE DÉCLARÉE au seuil d'âge est effacée elle aussi — les deux barrières comptent", async () => {
    // L'autre drapeau (FR-070, story 1.4). Il ne pose aucune échéance de lui-même : on la pose donc
    // ici, et ce qu'on éprouve est que `trancher` reconnaît AUSSI ce chemin-là.
    //
    // ANTI-VACUITÉ DE LA GARDE VOISINE : sans ce test, lire `barriere_minorite_le` SEUL passerait —
    // et on aurait remplacé un oubli par l'oubli symétrique.
    await admin
      .from("utilisatrice")
      .update({ echeance_suppression: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10) })
      .eq("id", mineureSansEcheance);
    expect(await trancher(mineureSansEcheance)).toBe("effacee");
    expect(await existe(mineureSansEcheance)).toBe(false);
  });

  it("[LE CŒUR] une abonnée dont l'échéance serait échue est GRACIÉE, pas effacée", async () => {
    // Le filet de dernier recours : même si une échéance lui était posée par erreur, l'abonnement
    // actif la rattrape au moment de trancher.
    await admin.from("utilisatrice").update({ echeance_suppression: "2020-01-01" }).eq("id", abonnee);
    expect(await trancher(abonnee)).toBe("graciee");
    expect(await existe(abonnee)).toBe(true);
    expect(await echeanceDe(abonnee)).toBeNull();
  });

  it("des échéances absurdes sont refusées avant tout effacement", async () => {
    await expect(
      rpc("trancher_echeance_suppression", {
        p_utilisatrice_id: recente,
        p_inactivite_mois: 0,
        p_preavis_mois: PREAVIS,
        p_fenetre_pitr_jours: FENETRE,
      }),
    ).rejects.toThrow(/echeances_invalides/);
    expect(await existe(recente)).toBe(true);
  });
});

describe("[6.8/R1] La rétention du journal de l'ordonnanceur", () => {
  const job = `retention-test-${t}`;

  it("[LE CŒUR] ce qui est TERMINÉ et vieux part ; ce qui est EN COURS reste", async () => {
    // ⚠️ Purger une ligne `en_cours` libérerait sa fenêtre sous le bail de son détenteur, et
    // autoriserait un second passage. Sur la rétention, un second effacement.
    const vieux = new Date(Date.now() - 200 * 86_400_000).toISOString();
    const maintenant = new Date().toISOString();
    // ⚠️ LES TROIS LIGNES PORTENT LES MÊMES CLÉS, et un test rouge me l'a appris : PostgREST refuse
    // un lot dont les objets n'ont pas exactement le même jeu de clés, et l'insertion échouait en
    // silence — la purge rendait 0 et l'assertion accusait la purge au lieu du semis.
    const { error: eSemis } = await admin.from("execution_job").insert([
      { job, fenetre: "vieux-fini", statut: "reussi", bail_expire_le: vieux, commence_le: vieux, termine_le: vieux },
      { job, fenetre: "vieux-en-cours", statut: "en_cours", bail_expire_le: vieux, commence_le: vieux, termine_le: null },
      { job, fenetre: "recent-fini", statut: "reussi", bail_expire_le: maintenant, commence_le: maintenant, termine_le: maintenant },
    ]);
    expect(eSemis, `semis du journal : ${eSemis?.message}`).toBeNull();

    expect(await rpc("purger_journal_ordonnanceur", { p_jours: 90 })).toBeGreaterThan(0);

    const { data } = await admin.from("execution_job").select("fenetre").eq("job", job);
    const restantes = (data ?? []).map((l) => (l as { fenetre: string }).fenetre).sort();
    expect(restantes).toEqual(["recent-fini", "vieux-en-cours"]);
  });

  it("une durée absurde est REFUSÉE — une purge silencieuse serait pire qu'aucune purge", async () => {
    await expect(rpc("purger_journal_ordonnanceur", { p_jours: 0 })).rejects.toThrow(/retention_journal_invalide/);
    await expect(rpc("purger_journal_ordonnanceur", { p_jours: null })).rejects.toThrow(
      /retention_journal_invalide/,
    );
  });
});

describe("[6.8/AD-12] Les portes du moteur sont fermées à toute session", () => {
  const fonctions: readonly [string, Record<string, unknown>][] = [
    ["comptes_a_prevenir", { p_inactivite_mois: 24, p_max: 10 }],
    ["comptes_a_effacer", { p_max: 10 }],
    ["poser_echeance_suppression", { p_utilisatrice_id: null, p_preavis_mois: 3 }],
    ["trancher_echeance_suppression", {
      p_utilisatrice_id: null, p_inactivite_mois: 24, p_preavis_mois: 3, p_fenetre_pitr_jours: 7,
    }],
    ["purger_journal_ordonnanceur", { p_jours: 90 }],
    ["derniere_activite", { p_utilisatrice_id: null }],
    ["effacer_utilisatrice", { p_utilisatrice_id: null, p_motif: "inactivite", p_fenetre_pitr_jours: 7 }],
  ];

  let session: SupabaseClient;
  beforeAll(async () => {
    const email = `retention-intruse-${t}@exemple.fr`;
    await admin.auth.admin.createUser({ email, password: MDP, email_confirm: true });
    session = clientNu();
    await session.auth.signInWithPassword({ email, password: MDP });
  });

  it.each(fonctions)("`%s` : une session authentifiée ne peut PAS l'appeler", async (nom, args) => {
    const { error } = await session.rpc(nom, args);
    expect(error, `${nom} est appelable par une session`).not.toBeNull();
  });

  it("[LE CŒUR] `effacer_utilisatrice` n'efface PERSONNE, ni pour un anonyme ni pour une session", async () => {
    // C'est la porte qui efface quelqu'un SANS sa session. Si `authenticated` l'obtenait, n'importe
    // qui pourrait effacer n'importe qui — l'exact contraire de ce que la 6.7 a construit.
    //
    // ⚠️ ON PASSE UN IDENTIFIANT RÉEL, et un mutant survivant l'a imposé. Le balayage ci-dessus
    // appelle les RPC avec `p_utilisatrice_id: null` : accorder `execute` à `authenticated` ne
    // faisait donc rien rougir, puisque la fonction levait de toute façon sur l'identité absente.
    // Une erreur remontait — mais pour la mauvaise raison.
    for (const client of [clientNu(), session]) {
      const { error } = await client.rpc("effacer_utilisatrice", {
        p_utilisatrice_id: recente,
        p_motif: "inactivite",
        p_fenetre_pitr_jours: 7,
      });
      expect(error, "la porte système est ouverte").not.toBeNull();
    }
    expect(await existe(recente), "un appelant sans privilège a effacé un compte").toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// [R10] LE JOUR CIVIL EST CELUI DE PARIS — PARTOUT, OU LA COMPARAISON MENT D'UN JOUR
// ══════════════════════════════════════════════════════════════════════════════════════════════════
//
// ⚠️ CETTE GARDE EST NÉE D'UN MUTANT QUI A SURVÉCU, PUIS D'UN FAUX POSITIF QUI ME L'A CACHÉ.
//
// `poser_echeance_suppression` calculait `(now() + interval)::date` — le jour civil UTC — pendant que
// `trancher_echeance_suppression` et `comptes_a_effacer` comparent à `(now() at time zone
// 'Europe/Paris')::date`. Entre 22 h et minuit UTC selon la saison, le jour parisien est déjà le
// lendemain : l'échéance tombait un jour plus tôt que le préavis promis.
//
// Le test de pose existant tolère une bande de 80 à 95 jours — bien trop large pour voir un jour
// d'écart. Le mutant a d'abord été annoncé TUÉ ; en cherchant QUI l'avait tué, la réponse était une
// panne de préparation (`createUser: {}`), pas une assertion. **Un mutant tué pour la mauvaise raison
// est un mutant vivant**, et sans cette vérification-là je l'aurais inscrit comme mort.
//
// Ce qu'on garde n'est donc pas la ligne corrigée, mais la RÈGLE : dans ces fonctions, tout jour civil
// dérivé de `now()` passe par Paris. La prochaine occurrence rougira sans qu'on ait à y penser.
describe("[6.8 · R10] Les dates de rétention se calculent en heure de PARIS", () => {
  const FONCTIONS = [
    "poser_echeance_suppression",
    "trancher_echeance_suppression",
    "comptes_a_effacer",
    "comptes_a_prevenir",
  ] as const;

  it.each(FONCTIONS)("%s ne dérive aucun jour civil de `now()` sans passer par Paris", (nom) => {
    const sql = definitionCourante(nom);
    // Toute occurrence de `now()` suivie, dans la même expression, d'un cast en `date`.
    const casts = [...sql.matchAll(/now\(\)[^;]*?::date/g)].map((m) => m[0]);
    for (const cast of casts) {
      expect(
        cast,
        `${nom} : un jour civil est calculé hors d'Europe/Paris — « ${cast.trim()} »`,
      ).toContain("at time zone 'Europe/Paris'");
    }
  });

  it("[ANTI-VACUITÉ] le motif MORD sur la forme fautive, sinon il ne garde rien", () => {
    const fautif = "set e = (now() + make_interval(months => 3))::date where id = x;";
    const casts = [...fautif.matchAll(/now\(\)[^;]*?::date/g)].map((m) => m[0]);
    expect(casts, "le motif ne voit plus la forme qu'il doit refuser").toHaveLength(1);
    expect(casts[0]).not.toContain("at time zone 'Europe/Paris'");
  });
});
