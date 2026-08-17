import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { definitionCourante } from "./_sql-courant";
import {
  COLONNES_RETIREES,
  INVENTAIRE_EXPORT,
  TABLES_EXPORTEES,
} from "@/lib/domain/inventaire-export";

/**
 * export-inventaire.test.ts — LA GARDE QUI FAIT QUE « COMPLET » RESTE VRAI (Story 6.6, AC1).
 *
 * ══ LE DÉFAUT QU'ON REFUSE D'ÉCRIRE ═════════════════════════════════════════════════════════════
 *
 * Un export exhaustif écrit à la main est exhaustif le jour où on l'écrit. La 6.7 ajoutera une
 * table, la 6.8 une autre, et l'export continuera de répondre « voici tout » en ayant cessé d'être
 * vrai. Rien ne cassera : le fichier sera juste plus court. Personne ne compte les sections d'un
 * export — surtout pas la personne à qui il est destiné, qui ne sait pas ce qui devrait s'y trouver.
 *
 * Alors la charge est inversée. Le corpus de migrations est la source de vérité du schéma ; toute
 * table qu'il crée doit porter un verdict dans `INVENTAIRE_EXPORT`. On ne peut plus OUBLIER une
 * table : on peut seulement décider de ne pas l'exporter, et écrire pourquoi.
 *
 * ══ ET LA MÊME GARDE SUR LA GARDE QU'EN 1.1 ═════════════════════════════════════════════════════
 *
 * `rls-catalogue.test.ts` a payé une leçon qu'on ne repaiera pas : un extracteur aveugle est VERT.
 * L'assertion 0 éprouve donc l'extracteur lui-même, et l'assertion 1 lui impose un plancher et des
 * ancres nommées.
 */

const RACINE = resolve(process.cwd(), "supabase/migrations");

/** Ligne d'abord, bloc ensuite — l'ordre inverse fait qu'un `/*` égaré dans un `--` avale la suite. */
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

const TABLES_DU_SCHEMA = [
  ...new Set(
    [...TOUT.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_0-9]+)"?/gi)].map((m) =>
      m[1].toLowerCase(),
    ),
  ),
].sort();

/**
 * La DÉFINITION COURANTE de la fonction d'export — jamais un fichier épinglé (revue Epic 6, R5).
 *
 * ⚠️ CE FICHIER LISAIT `0057_export_donnees.sql`, ET C'ÉTAIT LE MÊME PIÈGE QUE CELUI QUI VENAIT DE
 * SE REFERMER SUR L'EFFACEMENT — simplement encore endormi.
 *
 * `create or replace function` est la convention de ce dépôt : `utilisatrices_a_synthetiser`,
 * `traiter_evenement_abonnement`, `eligible_au_periodique` en portent chacune plusieurs, et
 * `effacer_toutes_mes_donnees` a été redéfinie par la 6.8 — ce qui a rendu muettes, sans que personne
 * le voie, TOUTES les gardes `[LE CŒUR]` de l'effacement.
 *
 * La story qui ajoutera une couche à l'export suivra cette convention. Le jour où elle le fera, les
 * gardes ci-dessous cesseraient de voir la vraie fonction. On demande donc au corpus sa dernière
 * définition, comme Postgres le fait en rejouant les migrations.
 */
const SQL_EXPORT = definitionCourante("exporter_mes_donnees");
/** Ce que le corpus déclare APRÈS elle — donc l'état final de ses droits. */
const APRES_EXPORT = TOUT.slice(TOUT.lastIndexOf(SQL_EXPORT) + SQL_EXPORT.length);

/** Les clés de section construites par la RPC : `'nom', (select …`. */
const CLES_RPC = [...SQL_EXPORT.matchAll(/'([a-z_0-9]+)'\s*,\s*\(\s*select/gi)].map((m) => m[1]);

describe("0. L'extracteur voit vraiment le corpus — sinon tout ce qui suit est un vert sans valeur", () => {
  it("un `/*` égaré dans un commentaire de ligne n'avale pas la suite", () => {
    const piege = [
      "-- une note qui mentionne @/lib/ai/* au passage",
      "create table public.piege (id uuid primary key);",
      "/* un vrai bloc */",
    ].join("\n");
    expect(sansCommentaires(piege)).toContain("create table public.piege");
    expect(sansCommentaires(piege)).not.toContain("un vrai bloc");
  });

  it("le corpus et la fonction sont bien vus (plancher + ancres)", () => {
    expect(FICHIERS.length).toBeGreaterThanOrEqual(57);
    expect(TABLES_DU_SCHEMA.length).toBeGreaterThanOrEqual(35);
    for (const ancre of ["entree_journal", "branche", "theme_natal", "usage_ia", "probe"]) {
      expect(TABLES_DU_SCHEMA, `ancre perdue : ${ancre}`).toContain(ancre);
    }
    expect(CLES_RPC.length).toBeGreaterThanOrEqual(29);
  });
});

describe("[6.6/AC1] L'inventaire couvre le schéma — aucune table ne peut être oubliée", () => {
  it("[LE CŒUR] CHAQUE table créée par une migration porte un verdict", () => {
    const inventoriees = new Set(INVENTAIRE_EXPORT.map((e) => e.table));
    const orphelines = TABLES_DU_SCHEMA.filter((t) => !inventoriees.has(t));
    expect(
      orphelines,
      `tables sans verdict d'export — ajoute-les à INVENTAIRE_EXPORT (inclus ou exclu, avec un motif) : ${orphelines.join(", ")}`,
    ).toEqual([]);
  });

  it("l'inventaire n'invente pas de tables qui n'existent plus", () => {
    const fantomes = INVENTAIRE_EXPORT.map((e) => e.table).filter((t) => !TABLES_DU_SCHEMA.includes(t));
    expect(fantomes, `verdicts sur des tables inexistantes : ${fantomes.join(", ")}`).toEqual([]);
  });

  it("chaque entrée porte un motif, et chaque « inclus » porte un titre lisible", () => {
    for (const e of INVENTAIRE_EXPORT) {
      expect(e.motif.length, `${e.table} : motif vide`).toBeGreaterThan(10);
      if (e.verdict === "inclus") {
        expect(e.titre, `${e.table} : « inclus » sans titre de section`).toBeTruthy();
      }
    }
  });

  it("aucun doublon — un verdict par table, sinon le dernier gagne en silence", () => {
    const noms = INVENTAIRE_EXPORT.map((e) => e.table);
    expect(noms.length).toBe(new Set(noms).size);
  });
});

describe("[6.6/AC1] L'inventaire et la RPC disent EXACTEMENT la même chose", () => {
  it("[LE CŒUR] les sections servies par la RPC == les tables déclarées « inclus »", () => {
    // Une divergence dans un sens = une section promise mais absente du fichier ; dans l'autre =
    // une donnée servie que personne n'a décidé d'exporter. Les deux sont des défauts.
    expect([...CLES_RPC].sort()).toEqual([...TABLES_EXPORTEES].sort());
  });

  it("[LE CŒUR] CHAQUE sous-requête est bornée à `v_uid` — une seule oubliée fuiterait tout", () => {
    // Garde STATIQUE, doublée par la garde vivante de `export-sql.test.ts` (deux utilisatrices). La
    // fonction est `security definer` : la RLS ne rattrape rien ici, le `where` est la seule serrure.
    const fragments = SQL_EXPORT.split(/from\s+public\./i)
      .slice(1)
      .map((f) => f.slice(0, 200))
      .filter((f) => /^[a-z_0-9]+\s+t\b/i.test(f));

    // ⚠️ ANTI-VACUITÉ. Sans cette ligne, un extracteur qui ne verrait plus AUCUNE sous-requête
    // rendrait une liste vide de fautives — et le test serait vert en n'ayant rien regardé.
    expect(fragments.length, "l'extracteur ne voit plus les sous-requêtes de l'export").toBe(
      TABLES_EXPORTEES.length,
    );

    const nues = fragments.filter((f) => !/(utilisatrice_id|t\.id)\s*=\s*v_uid/i.test(f));
    expect(nues, `sous-requêtes sans borne d'identité : ${nues.map((f) => f.slice(0, 40)).join(" | ")}`).toEqual(
      [],
    );
  });

  it("la fonction REFUSE une identité absente au lieu de rendre un document vide", () => {
    expect(SQL_EXPORT).toMatch(/if\s+v_uid\s+is\s+null\s+then\s+raise\s+exception/i);
  });

  it("[AC3] la trace d'accès est posée DANS la fonction, sans art. 9", () => {
    expect(SQL_EXPORT).toMatch(/insert\s+into\s+public\.audit_securite/i);
    expect(SQL_EXPORT).toMatch(/'export_donnees'/);
    // Aucune colonne de contenu ne part dans la trace : ni un extrait, ni un volume.
    const trace = /insert\s+into\s+public\.audit_securite[\s\S]{0,220}/i.exec(SQL_EXPORT)?.[0] ?? "";
    expect(trace).not.toMatch(/contenu|count\(|jsonb_array_length/i);
  });

  it("la porte est NOMMÉE : révoquée pour tous, accordée à `authenticated` seul", () => {
    // ⚠️ MESURÉ APRÈS la dernière définition (R5) : un `revoke` écrit AVANT elle décrirait les
    // droits d'une version qui n'existe plus.
    expect(APRES_EXPORT).toMatch(/revoke\s+all\s+on\s+function\s+public\.exporter_mes_donnees\(\)\s+from\s+public,\s*anon/i);
    // ⚠️ LE `;` FAIT PARTIE DE L'ASSERTION. Sans lui, `to authenticated, anon;` passerait — et la
    // garde vivante ne le verrait pas non plus, puisqu'`anon` se ferait de toute façon refuser par
    // le `v_uid is null`. Le trou serait invisible des deux côtés à la fois.
    expect(APRES_EXPORT).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.exporter_mes_donnees\(\)\s+to\s+authenticated\s*;/i,
    );
  });
});

describe("[6.6] Les retraits sont déclarés des DEUX côtés, et nulle part ailleurs", () => {
  it("chaque colonne retirée par le SQL est déclarée dans l'inventaire", () => {
    const retirees = [...SQL_EXPORT.matchAll(/to_jsonb\(t\)((?:\s*-\s*'[a-z_0-9]+')+)/gi)]
      .flatMap((m) => [...m[1].matchAll(/'([a-z_0-9]+)'/g)].map((x) => x[1]))
      .sort();
    expect(retirees).toEqual([...COLONNES_RETIREES].sort());
  });

  it("le document DIT ce qu'il retire — un export qui cache ses retraits ment deux fois", () => {
    for (const colonne of COLONNES_RETIREES) {
      expect(SQL_EXPORT, `${colonne} retirée sans être annoncée dans « retraits »`).toContain(
        `'${colonne}'`,
      );
    }
    expect(SQL_EXPORT).toMatch(/'retraits'\s*,\s*jsonb_build_array/i);
  });

  it("[ANTI-VACUITÉ] on ne retire QUE des capacités, jamais un contenu", () => {
    // Une capacité, c'est de quoi agir en son nom. Le jour où quelqu'un ajoute `contenu` ou
    // `restitution` ici, il aura fabriqué un export incomplet en croyant protéger quelque chose.
    for (const c of COLONNES_RETIREES) {
      expect(c, `${c} n'est pas une capacité — un retrait de contenu est un export incomplet`).toMatch(
        /jeton|cle_|_key|secret/,
      );
    }
    expect(COLONNES_RETIREES.length).toBeGreaterThan(0);
  });
});
