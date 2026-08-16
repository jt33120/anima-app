import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { executerRetention, DELAI_JOB_RETENTION_MS, RESERVE_RETENTION_MS } from "@/lib/ordonnanceur/jobs/retention";
import {
  dureeDepuisTexte,
  inactiviteRecevable,
  journalRecevable,
  preavisRecevable,
  issueRecevable,
  INACTIVITE_MOIS_DEFAUT,
  INACTIVITE_MOIS_MIN,
  JOURNAL_JOURS_DEFAUT,
  PREAVIS_MOIS_DEFAUT,
  LOT_MAX,
} from "@/lib/domain/retention";
import { REGISTRE, type ContexteJob } from "@/lib/ordonnanceur/registre";
import type { DepotRetention } from "@/lib/data/depot-retention";

/**
 * retention-job.test.ts — LE MOTEUR VU DEPUIS LE JOB (Story 6.8, AC2/AC5/AC6).
 *
 * La doublure est ici légitime, et c'est même le seul moyen : ce qu'on éprouve est du CONTRÔLE DE
 * FLUX — dans quel ordre les phases passent, ce qui arrive quand l'avis ne part pas, ce qui arrive
 * quand le budget est consommé. Le vrai Postgres ne sait pas manquer de temps sur commande.
 */

const racine = process.cwd();
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function depotFactice(over: Partial<DepotRetention> = {}): DepotRetention {
  return {
    comptesAPrevenir: vi.fn(async () => []),
    poserEcheance: vi.fn(async () => true),
    comptesAEffacer: vi.fn(async () => []),
    trancher: vi.fn(async () => "effacee" as const),
    purgerJournal: vi.fn(async () => 0),
    ...over,
  };
}

function ctx(msRestants = 60_000): ContexteJob {
  return {
    depot: {} as never,
    instant: new Date("2026-08-16T06:00:00Z"),
    echeance: new Date(Date.now() + msRestants),
    registre: REGISTRE,
  };
}

beforeEach(() => vi.restoreAllMocks());

describe("[6.8/AC2] Aucune suppression sans avis — la règle qui tient toute la story", () => {
  it("[LE CŒUR] l'avis part AVANT que l'échéance ne soit posée", async () => {
    const ordre: string[] = [];
    const depot = depotFactice({
      comptesAPrevenir: vi.fn(async () => ["u-1"]),
      poserEcheance: vi.fn(async () => {
        ordre.push("echeance");
        return true;
      }),
    });
    await executerRetention(ctx(), {
      depot,
      annoncer: async () => {
        ordre.push("avis");
        return true;
      },
    });
    // L'ordre inverse serait le vrai danger : une échéance posée sans avis parti, et trois mois plus
    // tard un compte qui disparaît sans que personne n'ait été prévenu.
    expect(ordre).toEqual(["avis", "echeance"]);
  });

  it("[LE CŒUR] l'avis qui NE PART PAS ne pose aucune échéance", async () => {
    const poserEcheance = vi.fn(async () => true);
    const depot = depotFactice({ comptesAPrevenir: vi.fn(async () => ["u-1", "u-2"]), poserEcheance });
    await executerRetention(ctx(), { depot, annoncer: async () => false });
    expect(poserEcheance, "une échéance a été posée sans avis").not.toHaveBeenCalled();
  });

  it("[LE CŒUR] un avis qui LÈVE ne pose rien non plus, et n'arrête pas les suivantes", async () => {
    const poserEcheance = vi.fn(async () => true);
    const annoncer = vi.fn(async (id: string) => {
      if (id === "u-1") throw new Error("resend_indisponible");
      return true;
    });
    const depot = depotFactice({ comptesAPrevenir: vi.fn(async () => ["u-1", "u-2"]), poserEcheance });
    await executerRetention(ctx(), { depot, annoncer });
    expect(annoncer).toHaveBeenCalledTimes(2);
    expect(poserEcheance).toHaveBeenCalledTimes(1);
    expect(poserEcheance).toHaveBeenCalledWith("u-2", PREAVIS_MOIS_DEFAUT);
  });
});

describe("[6.8] L'ordre des trois phases est une décision", () => {
  it("[LE CŒUR] les échéances DUES passent avant les avis, et la purge en dernier", async () => {
    const ordre: string[] = [];
    const depot = depotFactice({
      comptesAEffacer: vi.fn(async () => {
        ordre.push("echues");
        return ["u-due"];
      }),
      trancher: vi.fn(async () => {
        ordre.push("trancher");
        return "effacee" as const;
      }),
      comptesAPrevenir: vi.fn(async () => {
        ordre.push("prevenir");
        return [];
      }),
      purgerJournal: vi.fn(async () => {
        ordre.push("purge");
        return 3;
      }),
    });
    await executerRetention(ctx(), { depot, annoncer: async () => true });
    // Une suppression promise pour le 3 doit avoir lieu le 3 ; un avis qui part demain reste un avis.
    expect(ordre).toEqual(["echues", "trancher", "prevenir", "purge"]);
  });

  it("un compte qui résiste n'empêche pas les échéances suivantes d'être tranchées", async () => {
    const trancher = vi.fn(async (id: string) => {
      if (id === "u-1") throw new Error("trancher_echeance: 42501");
      return "effacee" as const;
    });
    const depot = depotFactice({ comptesAEffacer: vi.fn(async () => ["u-1", "u-2"]), trancher });
    await executerRetention(ctx(), { depot, annoncer: async () => true });
    expect(trancher).toHaveBeenCalledTimes(2);
  });

  it("une purge qui échoue ne fait pas échouer le job — elle n'engage personne", async () => {
    const depot = depotFactice({
      purgerJournal: vi.fn(async () => {
        throw new Error("purger_journal: 42501");
      }),
    });
    await expect(executerRetention(ctx(), { depot, annoncer: async () => true })).resolves.toBeUndefined();
  });
});

describe("[6.8/AC5] Le job rend la main plutôt que de se faire couper", () => {
  it("[LE CŒUR] sous la réserve, il s'arrête AVANT de trancher une échéance de plus", async () => {
    const trancher = vi.fn(async () => "effacee" as const);
    const depot = depotFactice({ comptesAEffacer: vi.fn(async () => ["a", "b", "c"]), trancher });
    // Une échéance déjà dépassée : la boucle sort au premier tour.
    await executerRetention(ctx(RESERVE_RETENTION_MS - 1), { depot, annoncer: async () => true });
    expect(trancher, "il a tranché alors qu'il n'avait plus de quoi finir").not.toHaveBeenCalled();
  });

  it("rendre la main N'EST PAS échouer : le job revient sans lever, et rien ne se périme", async () => {
    const depot = depotFactice({ comptesAEffacer: vi.fn(async () => ["a"]) });
    await expect(
      executerRetention(ctx(RESERVE_RETENTION_MS - 1), { depot, annoncer: async () => true }),
    ).resolves.toBeUndefined();
  });

  it("la purge du journal est sautée quand il ne reste rien — c'est la moins urgente", async () => {
    const purgerJournal = vi.fn(async () => 0);
    const depot = depotFactice({ purgerJournal });
    await executerRetention(ctx(RESERVE_RETENTION_MS - 1), { depot, annoncer: async () => true });
    expect(purgerJournal).not.toHaveBeenCalled();
  });
});

describe("[6.8/AC5] Les échéances sont des paramètres lus à l'exécution, jamais codées en dur", () => {
  it("les bornes refusent la coquille qui SUPPRIME", () => {
    // Une durée mal saisie ne produit pas une erreur, elle produit une suppression : `2` au lieu de
    // `24` efface quiconque n'est pas venu depuis deux mois. Le plancher est donc haut.
    expect(inactiviteRecevable(INACTIVITE_MOIS_DEFAUT)).toBe(true);
    expect(inactiviteRecevable(INACTIVITE_MOIS_MIN - 1)).toBe(false);
    expect(inactiviteRecevable(2)).toBe(false);
    expect(inactiviteRecevable(24.5)).toBe(false);
    expect(preavisRecevable(0)).toBe(false);
    expect(journalRecevable(3)).toBe(false);
  });

  it("[LE CŒUR] une valeur hors bornes retombe sur le DÉFAUT, jamais sur elle-même", () => {
    expect(dureeDepuisTexte("2", INACTIVITE_MOIS_DEFAUT, inactiviteRecevable)).toBe(INACTIVITE_MOIS_DEFAUT);
    expect(dureeDepuisTexte(undefined, PREAVIS_MOIS_DEFAUT, preavisRecevable)).toBe(PREAVIS_MOIS_DEFAUT);
    expect(dureeDepuisTexte("n'importe quoi", JOURNAL_JOURS_DEFAUT, journalRecevable)).toBe(JOURNAL_JOURS_DEFAUT);
    // …et une valeur valide est bien honorée, sinon le repli serait un plafond déguisé.
    expect(dureeDepuisTexte(" 18 ", INACTIVITE_MOIS_DEFAUT, inactiviteRecevable)).toBe(18);
  });

  it("une issue qu'on ne comprend pas n'est jamais « effacee »", () => {
    expect(issueRecevable("effacee")).toBe(true);
    expect(issueRecevable("supprimee")).toBe(false);
    expect(issueRecevable(null)).toBe(false);
  });

  it("[AD-1] le domaine ne lit AUCUN environnement ; le dépôt est le seul à le faire", () => {
    expect(sansCommentaires(readFileSync(resolve(racine, "lib/domain/retention.ts"), "utf-8"))).not.toMatch(
      /process\.env/,
    );
    expect(sansCommentaires(readFileSync(resolve(racine, "lib/data/depot-retention.ts"), "utf-8"))).toMatch(
      /process\.env\.RETENTION_INACTIVITE_MOIS/,
    );
  });

  it("le lot est borné — un tick ne tranche pas la base entière", () => {
    expect(LOT_MAX).toBeGreaterThan(0);
    expect(LOT_MAX).toBeLessThanOrEqual(200);
  });
});

describe("[6.8/AC6] Le moteur est le SEUL propriétaire des durées et de la suppression", () => {
  const SOURCES = ["app", "lib", "render", "scripts"]
    .flatMap((dir) =>
      (readdirSync(resolve(racine, dir), { recursive: true, encoding: "utf-8" }) as string[])
        .filter((f) => /\.(ts|tsx|mjs|js)$/.test(f))
        .map((f) => resolve(racine, dir, f)),
    )
    .concat(["proxy.ts", "instrumentation.ts"].map((f) => resolve(racine, f)).filter((p) => existsSync(p)));

  it("[LE CŒUR] UN SEUL `delete from public.utilisatrice` DANS LES DÉFINITIONS COURANTES", () => {
    // AC6 mot pour mot : « ce moteur est le seul propriétaire […] jamais par un script manuel ni une
    // tâche dispersée ». Un second `delete` quelque part, et il n'y aurait plus de moteur unique —
    // il y aurait deux façons d'effacer quelqu'un, dont une qui ne pose aucune trace.
    //
    // ⚠️ ON LIT LA DÉFINITION COURANTE, PAS LE CORPUS, ET UN TEST ROUGE ME L'A APPRIS. Les migrations
    // sont forward-only : le corps que la 6.7 avait mis dans `effacer_toutes_mes_donnees` reste
    // TEXTUELLEMENT dans 0058, même si 0059 l'a remplacé par une enveloppe de trois lignes. Compter
    // les occurrences du corpus, c'est compter l'HISTOIRE ; ce qu'on veut garder, c'est le PRÉSENT.
    const migrations = resolve(racine, "supabase/migrations");
    const fichiers = readdirSync(migrations).filter((f) => f.endsWith(".sql")).sort();

    /** La DERNIÈRE définition d'une fonction dans le corpus — le tri des noms EST le tri numérique. */
    const definitionCourante = (nom: string): string => {
      const motif = new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${nom}\\b`, "i");
      const portants = fichiers.filter((f) => motif.test(readFileSync(resolve(migrations, f), "utf-8")));
      expect(portants.length, `aucune migration ne définit public.${nom} — la garde ne lit plus rien`)
        .toBeGreaterThanOrEqual(1);
      const src = readFileSync(resolve(migrations, portants[portants.length - 1]), "utf-8");
      const debut = src.search(motif);
      return src.slice(debut);
    };

    // Le moteur efface ; l'enveloppe de l'utilisatrice, elle, ne doit plus rien effacer elle-même.
    expect(definitionCourante("effacer_utilisatrice")).toMatch(/delete\s+from\s+public\.utilisatrice/i);
    expect(definitionCourante("effacer_utilisatrice")).toMatch(/delete\s+from\s+auth\.users/i);

    const enveloppe = definitionCourante("effacer_toutes_mes_donnees");
    expect(enveloppe, "la porte de l'utilisatrice efface encore elle-même — il y a deux moteurs")
      .not.toMatch(/delete\s+from\s+public\.utilisatrice/i);
    expect(enveloppe).toMatch(/public\.effacer_utilisatrice\(/);
  });

  it("[LE CŒUR] AUCUN code applicatif n'appelle le moteur hors du dépôt de rétention", () => {
    // `effacer_utilisatrice` efface quelqu'un SANS sa session. Elle n'a qu'un appelant légitime.
    const appelants = SOURCES.filter((f) => /effacer_utilisatrice/.test(sansCommentaires(readFileSync(f, "utf-8"))))
      .map((f) => f.slice(racine.length + 1))
      .sort();
    expect(appelants).toEqual([]);
    // …et la porte de l'utilisatrice, elle, n'a qu'un appelant.
    const parLaSession = SOURCES.filter((f) =>
      /effacer_toutes_mes_donnees/.test(sansCommentaires(readFileSync(f, "utf-8"))),
    )
      .map((f) => f.slice(racine.length + 1))
      .sort();
    expect(parLaSession).toEqual(["lib/data/effacer-donnees.ts"]);
  });

  it("[LE CŒUR] la suppression périodique passe par L'ORDONNANCEUR, jamais par un script", () => {
    const job = REGISTRE.find((j) => j.nom === "retention");
    expect(job, "le moteur de rétention n'est pas au registre").toBeDefined();
    expect(job!.cadence).toBe("quotidien");
    expect(job!.delaiMs).toBe(DELAI_JOB_RETENTION_MS);
    expect(job!.reserveMs).toBe(RESERVE_RETENTION_MS);
    // Aucun script du dépôt ne tranche une échéance de son côté.
    const scripts = SOURCES.filter((f) => f.includes(`${resolve(racine, "scripts")}`));
    for (const f of scripts) {
      expect(sansCommentaires(readFileSync(f, "utf-8")), `${f} tranche des échéances`).not.toMatch(
        /trancher_echeance_suppression|comptes_a_effacer/,
      );
    }
  });

  it("le job ne touche AUCUN contenu — il ne lit que des identifiants et des horodatages", () => {
    const src = sansCommentaires(readFileSync(resolve(racine, "lib/ordonnanceur/jobs/retention.ts"), "utf-8"));
    for (const table of ["entree_journal", "fait_extrait", "synthese", "lecture"]) {
      expect(src, `le job lit ${table}`).not.toMatch(new RegExp(`\\b${table}\\b`));
    }
    expect(src, "le job appelle un modèle").not.toMatch(/AiPort|@\/lib\/ai/);
  });
});
