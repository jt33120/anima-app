import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { executerOrdonnanceur } from "@/lib/ordonnanceur/executer";
import { creerDepotOrdonnanceur, type DepotOrdonnanceur } from "@/lib/data/depot-ordonnanceur";
import { fenetreDe } from "@/lib/domain/ordonnanceur";
import type { JobEnregistre } from "@/lib/ordonnanceur/registre";

/**
 * Story 6.1a (AC2) — L'IDEMPOTENCE PROUVÉE SUR UN EFFET COMPTÉ.
 *
 * ══ CE QUE LES TROIS PREUVES EXISTANTES NE PROUVENT PAS ═════════════════════════════════════════
 *
 * Le dépôt affirme l'idempotence de l'ordonnanceur depuis la 4.8, et trois fichiers la « prouvent » :
 *
 *   • `ordonnanceur-endpoint.test.ts` MOCKE le registre (`executer: async () => {}`) — des jobs SANS
 *     EFFET. On y prouve que la porte appelle le répartiteur, rien de plus.
 *   • `ordonnanceur-sql.test.ts` prouve la RÉCLAMATION contre le vrai Postgres — des booléens, puis
 *     des jetons. Aucun effet n'est jamais produit.
 *   • `ordonnanceur-executeur.test.ts` tourne sur DÉPÔT FACTICE — l'idempotence y est simulée par le
 *     factice lui-même, qui rend `null` quand on le lui demande.
 *
 * Les trois prouvent la politesse du code appelant. **Aucune ne prouve qu'un effet n'a lieu qu'une
 * fois.** Or c'est la seule phrase qui compte à partir de l'Epic 6 : ce qui sera branché sur cet
 * ordonnanceur EFFACE, et une purge rejouée ne se rattrape par aucun index.
 *
 * ══ POURQUOI IL N'Y A PAS DE TABLE `preuve_idempotence` (décision D3, CONTESTÉE ET RETIRÉE) ══════
 *
 * La story proposait de déclarer une table de production, inerte, dont l'unique raison d'être aurait
 * été de compter un effet dans ce test — au motif qu'aucune table existante ne convenait
 * (`execution_job.tentatives` compte des RÉCLAMATIONS, pas des effets ; `incident_systeme` est
 * dédoublonné par jour, ce qui MASQUERAIT le défaut cherché). Les deux constats sont exacts. La
 * conclusion ne l'était pas.
 *
 * Ce qui manquait aux trois preuves existantes, c'est le DÉPÔT FACTICE, pas le compteur. Ici le dépôt
 * est réel (`creerDepotOrdonnanceur`), la base est le vrai Postgres, la SQL arbitre pour de bon — et
 * l'effet est compté dans le processus de test, par un job d'essai injecté via
 * `DepsOrdonnanceur.registre` (patron déjà appliqué dans `ordonnanceur-executeur.test.ts`). Un
 * compteur en base n'ajouterait rien : le test est de toute façon un seul processus, et c'est la
 * réclamation SQL — pas le compteur — qui décide si le job tourne.
 *
 * Le coût évité est une table vide en production, dont personne ne saurait dans deux ans pourquoi
 * elle existe. La règle qu'on en tire : **une table ne se déclare pas pour servir un test.**
 */

const url = process.env.SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });

const t = Date.now();
const P = `idem-${t}`;
const MDP = "test-idem-123!";

/** Deux jours civils distincts : `fenetreDe("quotidien", …)` en tire deux clés différentes. */
const JOUR_1 = new Date("2026-08-10T06:00:00Z");
const JOUR_2 = new Date("2026-08-11T06:00:00Z");

/**
 * L'EFFET. Un compteur par clé — `global` pour le job lui-même, l'identifiant pour chaque personne
 * servie. C'est ce que la rétention de l'Epic 6 fera : un effet global (la purge des tables
 * partagées) et un effet par personne (l'effacement de ses données).
 */
type Effets = Map<string, number>;
const compter = (effets: Effets, cle: string) => effets.set(cle, (effets.get(cle) ?? 0) + 1);

/** Le bail des réclamations PAR PERSONNE de ce job — assez long pour qu'aucun test ne l'attende. */
const BAIL_CIBLE_S = 300;

function jobDEssai(nom: string, effets: Effets, cibles: readonly string[] = []): JobEnregistre {
  return {
    nom,
    cadence: "quotidien",
    toleranceHeures: 60,
    delaiMs: 5_000,
    reserveMs: 1_000,
    enServiceDepuis: new Date("2026-08-05T00:00:00Z"),
    async executer(ctx) {
      // L'effet GLOBAL. Il n'a lieu que si le répartiteur a obtenu la fenêtre — c'est toute la
      // question, et c'est la SQL qui y répond, pas ce fichier.
      compter(effets, "global");

      // Le FAN-OUT par personne, dans la forme exacte que les jobs de l'Epic 6 utiliseront : une
      // réclamation par cible, sous la même clé de job et la même fenêtre.
      const fenetre = fenetreDe("quotidien", ctx.instant);
      for (const cible of cibles) {
        const jeton = await ctx.depot.reclamer(nom, fenetre, cible, BAIL_CIBLE_S);
        if (jeton === null) continue;
        compter(effets, cible);
        await ctx.depot.clore(nom, fenetre, cible, true, null, jeton);
      }
    },
  };
}

async function lignes(job: string) {
  const { data, error } = await admin
    .from("execution_job")
    .select("fenetre, cible_id, statut, tentatives, motif_echec")
    .eq("job", job)
    .is("cible_id", null);
  if (error) throw new Error(error.message);
  return data as { fenetre: string; statut: string; tentatives: number; motif_echec: string | null }[];
}

describe("[6.1a/AC2] un EFFET ne se produit qu'une fois par fenêtre — contre le vrai Postgres", () => {
  let depot: DepotOrdonnanceur;

  beforeAll(() => {
    depot = creerDepotOrdonnanceur();
  });
  afterAll(async () => {
    await admin.from("execution_job").delete().like("job", `${P}%`);
  });

  it("[LE CŒUR] deux passages dans la MÊME fenêtre : l'effet a lieu UNE fois", async () => {
    // Le rejeu n'est pas une hypothèse : l'ordonnanceur externe de Vercel peut parfaitement redéclencher
    // un tick, et rien n'empêche un opérateur d'appeler la porte à la main. À l'Epic 6, ce second
    // passage EFFACE une seconde fois.
    //
    // Mutation-cible : dans `reclamer_execution`, ajouter `or statut = 'reussi'` au `where` du DO UPDATE.
    const effets: Effets = new Map();
    const nom = `${P}-coeur`;
    const registre = [jobDEssai(nom, effets)];

    const un = await executerOrdonnanceur({ depot, instant: JOUR_1, registre });
    const deux = await executerOrdonnanceur({ depot, instant: JOUR_1, registre });

    expect(effets.get("global"), "l'effet, une seule fois").toBe(1);
    expect(un.jobs[0].issue, "le premier a exécuté").toBe("execute");
    expect(deux.jobs[0].issue, "le second a constaté que c'était fait").toBe("deja_fait");

    // LA MOITIÉ « TRACE » DE L'AC2. Le compteur dit qu'aucun effet n'a été refait ; la ligne doit dire
    // qu'un rejeu a bien eu lieu et n'a rien changé. Un résultat attendu qu'on ne peut pas montrer ne
    // vaut pas mieux qu'un travail non fait.
    const [ligne] = await lignes(nom);
    expect(ligne.statut).toBe("reussi");
    expect(ligne.motif_echec).toBeNull();
    expect(ligne.tentatives, "le rejeu n'a même pas incrémenté : il n'a pas repris la main").toBe(1);
  });

  it("[ANTI-VACUITÉ] la fenêtre SUIVANTE refait l'effet — le compteur n'est pas mort", async () => {
    // Sans ce test, tout ce fichier serait satisfait par un job qui ne s'exécute JAMAIS : le compteur
    // resterait à 1 (ou à 0) et chaque assertion passerait. C'est la vacuité la plus facile à écrire,
    // et la plus difficile à voir.
    const effets: Effets = new Map();
    const nom = `${P}-deux-fenetres`;
    const registre = [jobDEssai(nom, effets)];

    await executerOrdonnanceur({ depot, instant: JOUR_1, registre });
    await executerOrdonnanceur({ depot, instant: JOUR_2, registre });

    expect(effets.get("global"), "deux jours, deux effets").toBe(2);
    expect((await lignes(nom)).map((l) => l.fenetre).sort(), "et deux clés de fenêtre distinctes").toEqual([
      fenetreDe("quotidien", JOUR_1),
      fenetreDe("quotidien", JOUR_2),
    ]);
  });

  it("[LE PLUS IMPORTANT] un `clore(true)` perdu en réseau ne rouvre PAS la fenêtre", async () => {
    // LE SCÉNARIO. Le job a tout fait — la purge a eu lieu — puis la base tombe au moment d'écrire la
    // réussite. La ligne reste `en_cours` sous son bail, et rien en base ne dit que le travail est fait.
    //
    // C'est le seul endroit où l'idempotence ne tient plus à `statut = 'reussi'` mais au BAIL. Si le
    // bail n'était pas vivant, ou si le répartiteur re-clôturait « pour réparer », un rejeu immédiat
    // refuserait de croire ce qui n'est pas écrit et referait l'effacement.
    //
    // ⚠️ `executer.ts` documente ce résidu en toutes lettres : le bail expirera avant le tick suivant,
    // donc le job SERA ré-exécuté demain. La limite se referme au niveau du JOB — un job qui produit un
    // effet visible doit être idempotent sur sa propre clé, pas seulement sur sa fenêtre.
    //
    // Mutation-cible : dans `reclamer_execution`, retirer la condition `bail_expire_le < now()` de la
    // reprise `en_cours` (la fenêtre redeviendrait réclamable immédiatement).
    const effets: Effets = new Map();
    const nom = `${P}-cloture-perdue`;
    const registre = [jobDEssai(nom, effets)];

    let coupees = 0;
    const depotQuiPerdLaCloture: DepotOrdonnanceur = {
      ...depot,
      async clore(job, fenetre, cible, reussi, motif, jeton) {
        // Seulement la clôture GLOBALE en réussite : celle qui suit le travail accompli.
        if (reussi && cible === null) {
          coupees += 1;
          throw new Error("clore_execution: 08006");
        }
        return depot.clore(job, fenetre, cible, reussi, motif, jeton);
      },
    };

    const un = await executerOrdonnanceur({ depot: depotQuiPerdLaCloture, instant: JOUR_1, registre });
    expect(coupees, "la clôture a bien été coupée").toBe(1);
    expect(un.jobs[0].issue, "l'issue suit le TRAVAIL, pas la comptabilité").toBe("execute");

    const [avant] = await lignes(nom);
    expect(avant.statut, "la ligne reste en cours, sous son bail").toBe("en_cours");

    const deux = await executerOrdonnanceur({ depot, instant: JOUR_1, registre });
    expect(effets.get("global"), "AUCUN second effet : le bail protège ce que la trace ne dit pas").toBe(1);
    expect(deux.jobs[0].issue).toBe("deja_fait");
  });

  it("un ÉCHEC franc laisse la fenêtre réclamable, et le second passage refait l'effet", async () => {
    // Le contrôle inverse du précédent, et il est indispensable : sans lui, le fichier serait satisfait
    // par une réclamation qui refuse TOUT après le premier passage — un ordonnanceur qui ne réessaie
    // jamais rien, ce qui est aussi grave que celui qui rejoue tout.
    //
    // Ici le job lève : la ligne est close en `echoue`, avec un motif du vocabulaire fermé, et
    // redevient réclamable immédiatement (AC5 de la 4.8).
    const effets: Effets = new Map();
    const nom = `${P}-echec`;
    let doitLever = true;
    const registre: JobEnregistre[] = [
      {
        ...jobDEssai(nom, effets),
        async executer(ctx) {
          if (doitLever) throw new Error("essai_indisponible");
          compter(effets, "global");
          void ctx;
        },
      },
    ];

    await executerOrdonnanceur({ depot, instant: JOUR_1, registre });
    const [apresEchec] = await lignes(nom);
    expect(apresEchec.statut).toBe("echoue");
    expect(apresEchec.motif_echec, "un code du vocabulaire fermé, jamais un message").toBe("essai_indisponible");
    expect(effets.get("global"), "rien n'a été fait").toBeUndefined();

    doitLever = false;
    await executerOrdonnanceur({ depot, instant: JOUR_1, registre });
    expect(effets.get("global"), "la reprise a bien eu lieu").toBe(1);
    const [apresReprise] = await lignes(nom);
    expect(apresReprise.statut).toBe("reussi");
    expect(apresReprise.tentatives, "et la reprise se compte").toBe(2);
    expect(apresReprise.motif_echec, "une nouvelle tentative repart propre").toBeNull();
  });

  it("[FAN-OUT] l'effet est compté PAR PERSONNE, et les personnes sont indépendantes", async () => {
    // La forme que les trois jobs de l'Epic 6 utiliseront exclusivement : une clé par personne sous la
    // même fenêtre. Deux propriétés, et elles se cassent séparément —
    //
    //   • le rejeu ne resert personne (l'idempotence par cible) ;
    //   • une cible servie n'empêche pas l'autre de l'être (l'indépendance des clés).
    //
    // Une seule cible dans ce test ne prouverait que la première : c'est exactement l'`nulls not
    // distinct` de 0027 qui porte la seconde, et il est invisible à l'œil nu.
    const { data: a } = await admin.auth.admin.createUser({
      email: `idem-a-${t}@exemple.fr`,
      password: MDP,
      email_confirm: true,
    });
    const { data: b } = await admin.auth.admin.createUser({
      email: `idem-b-${t}@exemple.fr`,
      password: MDP,
      email_confirm: true,
    });
    const cibleA = a!.user!.id;
    const cibleB = b!.user!.id;

    try {
      const effets: Effets = new Map();
      const nom = `${P}-cibles`;
      const registre = [jobDEssai(nom, effets, [cibleA, cibleB])];

      await executerOrdonnanceur({ depot, instant: JOUR_1, registre });
      expect(effets.get(cibleA), "A servie une fois").toBe(1);
      expect(effets.get(cibleB), "B servie une fois — indépendante de A").toBe(1);

      // Le rejeu du JOB est arrêté par la fenêtre globale ; on force donc le fan-out à repasser en
      // appelant le job directement, sans le répartiteur. C'est le cas réel du RATTRAPAGE : un lot
      // interrompu qui reprend le lendemain sous une fenêtre globale neuve.
      await registre[0].executer({
        depot,
        instant: JOUR_1,
        echeance: new Date(Date.now() + 30_000),
        registre,
      });
      expect(effets.get(cibleA), "A n'est pas resservie").toBe(1);
      expect(effets.get(cibleB), "B non plus").toBe(1);
      expect(effets.get("global"), "…alors que le job, lui, a bien retraversé sa boucle").toBe(2);

      const { count } = await admin
        .from("execution_job")
        .select("*", { count: "exact", head: true })
        .eq("job", nom)
        .not("cible_id", "is", null);
      expect(count, "une ligne par personne, pas deux").toBe(2);
    } finally {
      await admin.auth.admin.deleteUser(cibleA);
      await admin.auth.admin.deleteUser(cibleB);
    }
  });
});
