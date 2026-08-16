import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { INVENTAIRE_EFFACEMENT, TABLES_EFFACEES } from "@/lib/domain/inventaire-effacement";
import { FENETRE_PITR_JOURS_MAX } from "@/lib/domain/effacement";

/**
 * effacement-schema.test.ts — LE MOTEUR, LU DANS LE SQL (Story 6.7, AC1/AC2/AC5).
 *
 * Le jumeau statique d'`effacement-sql.test.ts`. Celui-là efface pour de vrai et mesure ce qui
 * reste ; celui-ci lit le corpus et refuse ce qui ne pourrait même pas être écrit — dont la seule
 * chose qu'un test comportemental ne verrait jamais : une table AJOUTÉE et jamais semée, donc
 * jamais éprouvée, donc jamais effacée.
 */

const RACINE = resolve(process.cwd(), "supabase/migrations");

function sansCommentaires(sql: string): string {
  const sansLigne = sql
    .split("\n")
    .map((l) => l.replace(/--.*$/, ""))
    .join("\n");
  return sansLigne.replace(/\/\*[\s\S]*?\*\//g, "");
}

const FICHIERS = readdirSync(RACINE)
  .filter((f) => f.endsWith(".sql"))
  .sort();
const TOUT = FICHIERS.map((f) => sansCommentaires(readFileSync(resolve(RACINE, f), "utf-8"))).join("\n");
const SQL_0058 = sansCommentaires(readFileSync(resolve(RACINE, "0058_effacement_total.sql"), "utf-8"));

const TABLES_DU_SCHEMA = [
  ...new Set(
    [...TOUT.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_0-9]+)"?/gi)].map((m) =>
      m[1].toLowerCase(),
    ),
  ),
].sort();

describe("0. L'extracteur voit le corpus — sinon tout ce qui suit est un vert sans valeur", () => {
  it("plancher et ancres", () => {
    expect(FICHIERS.length).toBeGreaterThanOrEqual(58);
    expect(TABLES_DU_SCHEMA.length).toBeGreaterThanOrEqual(36);
    for (const ancre of ["entree_journal", "branche", "execution_job", "effacement"]) {
      expect(TABLES_DU_SCHEMA, `ancre perdue : ${ancre}`).toContain(ancre);
    }
  });
});

describe("[6.7/AC1] L'inventaire d'effacement couvre le schéma — aucune table oubliée", () => {
  it("[LE CŒUR] CHAQUE table créée porte un verdict d'effacement", () => {
    const inventoriees = new Set(INVENTAIRE_EFFACEMENT.map((e) => e.table));
    const orphelines = TABLES_DU_SCHEMA.filter((t) => !inventoriees.has(t));
    expect(
      orphelines,
      `tables sans verdict d'effacement — ajoute-les à INVENTAIRE_EFFACEMENT : ${orphelines.join(", ")}`,
    ).toEqual([]);
  });

  it("l'inventaire ne parle pas de tables qui n'existent pas", () => {
    const fantomes = INVENTAIRE_EFFACEMENT.map((e) => e.table).filter((t) => !TABLES_DU_SCHEMA.includes(t));
    expect(fantomes, `verdicts sur des tables inexistantes : ${fantomes.join(", ")}`).toEqual([]);
  });

  it("[LE CŒUR] C'EST UN INVENTAIRE DISTINCT DE CELUI DE L'EXPORT, et il doit le rester", async () => {
    // La 6.6 avait écrit noir sur blanc pourquoi : exporter et effacer répondent à deux droits
    // différents. `execution_job` est la preuve vivante — hors export (elle ne lui apprend rien),
    // effacée quand même (son `cible_id` la nomme). Le jour où quelqu'un fusionne les deux listes,
    // c'est cette table-là qu'on perdra, et personne ne le verra.
    const { TABLES_EXPORTEES } = await import("@/lib/domain/inventaire-export");
    expect(TABLES_EFFACEES).toContain("execution_job");
    expect(TABLES_EXPORTEES).not.toContain("execution_job");
  });

  it("chaque entrée porte un motif qui dit quelque chose", () => {
    for (const e of INVENTAIRE_EFFACEMENT) {
      expect(e.motif.length, `${e.table} : motif vide`).toBeGreaterThan(10);
    }
    expect(new Set(INVENTAIRE_EFFACEMENT.map((e) => e.table)).size).toBe(INVENTAIRE_EFFACEMENT.length);
  });
});

describe("[6.7/AC5] La trace ne peut pas être emportée par ce qu'elle trace", () => {
  it("[LE CŒUR] `effacement` n'a AUCUNE clé étrangère", () => {
    // C'est toute la raison d'être de la table. Une clé vers `utilisatrice` — même sans cascade —
    // rendrait la trace supprimable avec la personne, et on garderait la preuve de tout sauf du
    // seul geste qu'un responsable de traitement doit pouvoir prouver.
    const creation = /create\s+table\s+public\.effacement\s*\(([\s\S]*?)\n\);/i.exec(SQL_0058)?.[1] ?? "";
    expect(creation.length, "la table `effacement` n'a pas été trouvée dans le corpus").toBeGreaterThan(100);
    expect(creation, "`effacement` a gagné une clé étrangère").not.toMatch(/references/i);
    // Et personne n'en ajoute une plus tard, par `alter table`.
    expect(TOUT).not.toMatch(/alter\s+table\s+(?:public\.)?effacement[\s\S]{0,120}foreign\s+key/i);
  });

  it("elle est deny-by-default : aucune policy, RLS activée ET forcée", () => {
    expect(SQL_0058).toMatch(/alter\s+table\s+public\.effacement\s+enable\s+row\s+level\s+security/i);
    expect(SQL_0058).toMatch(/alter\s+table\s+public\.effacement\s+force\s+row\s+level\s+security/i);
    expect(TOUT, "une policy a été posée sur `effacement`").not.toMatch(
      /create\s+policy[\s\S]{0,80}\son\s+(?:public\.)?effacement\b/i,
    );
  });

  it("[LE CŒUR] la trace est posée AVANT la première suppression", () => {
    // L'ordre inverse perd la preuve, jamais la donnée : après la suppression de `auth.users`,
    // `auth.uid()` désigne quelqu'un qui n'existe plus, et une insertion qui échouerait là
    // laisserait un effacement accompli que rien n'atteste.
    const posee = SQL_0058.indexOf("insert into public.effacement");
    const premiereSuppression = SQL_0058.indexOf("delete from public.branche");
    expect(posee).toBeGreaterThan(-1);
    expect(premiereSuppression).toBeGreaterThan(-1);
    expect(posee, "la trace est posée après avoir commencé à effacer").toBeLessThan(premiereSuppression);
  });

  it("elle porte une EMPREINTE, et la forme en est contrainte", () => {
    expect(SQL_0058).toMatch(/encode\(sha256\(v_uid::text::bytea\),\s*'hex'\)/);
    expect(SQL_0058).toMatch(/effacement_empreinte_forme\s+check\s*\(empreinte\s*~\s*'\^\[0-9a-f\]\{64\}\$'\)/i);
  });
});

describe("[6.7/AC1] L'ordre du moteur, et pourquoi il n'est pas laissé au hasard", () => {
  it("[LE CŒUR] les branches partent AVANT le reste — seule clé `restrict` du schéma", () => {
    const branches = SQL_0058.indexOf("delete from public.branche");
    const utilisatrice = SQL_0058.indexOf("delete from public.utilisatrice");
    const auth = SQL_0058.indexOf("delete from auth.users");
    expect(branches).toBeGreaterThan(-1);
    expect(branches, "les branches ne partent plus en premier").toBeLessThan(utilisatrice);
    expect(utilisatrice).toBeLessThan(auth);
  });

  it("[LE CŒUR] IL N'EXISTE QU'UNE SEULE CLÉ `restrict` — sinon le moteur en oublie une", () => {
    // Si une deuxième apparaissait demain, l'effacement échouerait selon l'ordre de cascade, donc
    // selon le hasard des migrations. Cette garde force à revenir écrire le `delete` correspondant.
    //
    // ⚠️ ON ANCRE SUR `references`, ET UN TEST ROUGE A DÛ ME L'APPRENDRE. Chercher « on delete
    // restrict » nu en trouvait DEUX : la vraie clé, et la même phrase écrite dans le corps d'un
    // `comment on table` de 0021. Le décommentage retire les `--`, pas les chaînes SQL. Une garde
    // qu'on aurait « corrigée » en passant le compte à 2 aurait cessé de voir la clé suivante.
    const CLE_RESTRICT = /references[^;]{0,160}?on\s+delete\s+restrict/gi;
    const restrictions = [...TOUT.matchAll(CLE_RESTRICT)];
    expect(
      restrictions.length,
      "une clé `on delete restrict` a été ajoutée : le moteur doit retirer sa table explicitement",
    ).toBe(1);
    expect(TOUT).toMatch(/branche_extrait_meme_proprietaire[\s\S]{0,300}on\s+delete\s+restrict/i);

    // ANTI-VACUITÉ : le motif doit MORDRE sur une deuxième clé, sinon il ne garde rien.
    const seconde = "constraint x foreign key (a) references public.y (a) on delete restrict";
    expect([...seconde.matchAll(CLE_RESTRICT)]).toHaveLength(1);
    // …et NE PAS mordre sur la phrase en prose qui l'avait fait rougir.
    expect([...`comment on table t is 'extrait_source_id on delete RESTRICT = lien incassable';`.matchAll(
      CLE_RESTRICT,
    )]).toHaveLength(0);
  });

  it("l'identité d'auth part aussi — une ligne ne portant qu'une adresse en est une donnée", () => {
    expect(SQL_0058).toMatch(/delete\s+from\s+auth\.users\s+where\s+id\s*=\s*v_uid/i);
  });

  it("le moteur refuse une identité absente", () => {
    expect(SQL_0058).toMatch(/if\s+v_uid\s+is\s+null\s+then\s+raise\s+exception/i);
  });

  it("la porte est nommée : révoquée pour tous, accordée à `authenticated` seul", () => {
    expect(SQL_0058).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.effacer_toutes_mes_donnees\(integer\)\s+from\s+public,\s*anon/i,
    );
    expect(SQL_0058).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.effacer_toutes_mes_donnees\(integer\)\s+to\s+authenticated\s*;/i,
    );
  });
});

describe("[6.7/AC2 · AD-14] La fenêtre est un ARGUMENT, et sa borne est dans le schéma", () => {
  it("[LE CŒUR] aucune échéance n'est écrite en dur dans le SQL", () => {
    // AD-14 : « échéances paramétrées, jamais codées en dur ». La fonction reçoit le nombre de jours ;
    // un `make_interval(days => 7)` littéral ferait mentir la trace le jour où le réglage change.
    expect(SQL_0058).toMatch(/effacer_toutes_mes_donnees\(p_fenetre_pitr_jours\s+integer\)/i);
    expect(SQL_0058).toMatch(/make_interval\(days\s*=>\s*p_fenetre_pitr_jours\)/i);
    expect(SQL_0058, "une durée littérale s'est glissée dans le moteur").not.toMatch(
      /make_interval\(days\s*=>\s*\d+\)/i,
    );
  });

  it("[LE CŒUR] la borne est une CONTRAINTE DE TABLE — elle lie aussi `service_role`", () => {
    // Une vérification écrite seulement dans la fonction serait contournée par la première tâche
    // système qui insérerait autrement. Un `check` ne se contourne pas : la RLS, si.
    expect(SQL_0058).toMatch(
      new RegExp(`effacement_fenetre_bornee\\s+check\\s*\\(fenetre_pitr_jours\\s+between\\s+0\\s+and\\s+${FENETRE_PITR_JOURS_MAX}\\)`, "i"),
    );
  });

  it("la trace ne peut pas promettre une survivance antérieure à la demande", () => {
    expect(SQL_0058).toMatch(/effacement_survivance_coherente\s+check\s*\(survivance_jusqu_au\s*>=\s*demande_le\)/i);
  });

  it("les quatre motifs d'AD-14 sont ouverts — la 6.8 passera par le même moteur", () => {
    expect(SQL_0058).toMatch(/motif\s+in\s*\('utilisatrice',\s*'minorite',\s*'inactivite',\s*'fermeture'\)/i);
  });
});
