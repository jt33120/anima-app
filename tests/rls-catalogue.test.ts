import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

/**
 * rls-catalogue.test.ts — LA GARDE STRUCTURELLE QUE L'AC4 DE LA STORY 1.1 PROMETTAIT.
 *
 * ══ CE QUI MANQUAIT (revue du 2026-08-13) ═══════════════════════════════════════════════════════
 *
 * La story 1.1 promet, mot pour mot : « retirer la politique de cette table fait échouer la CI et
 * bloque le déploiement (AD-12) », et sa Tâche 5 décrit un garde structurel interrogeant le
 * catalogue Postgres « pour TOUTE table marquée art. 9 ».
 *
 * Ce garde n'a jamais été écrit. Ce qui existe — et qui est bon — c'est `tests/rls.test.ts` : DEUX
 * tables (`probe`, `art9_temoin`) éprouvées à la main. Vingt-cinq autres tables sont nées depuis,
 * dont `entree_journal`, `fait_extrait`, `theme_natal` : tout le contenu art. 9 du produit. Aucune
 * n'était couverte par un garde GÉNÉRIQUE. L'invariant tenait par la discipline de celui qui
 * écrivait la migration — et la discipline ne casse pas le build.
 *
 * Mesuré sur la base de LANCEMENT le 2026-08-13 : 27/27 tables en RLS activée ET forcée, zéro
 * fonction `security definer` sans `search_path` figé, zéro policy d'écriture sans `with check`.
 * L'invariant est donc VRAI aujourd'hui. Ce fichier existe pour qu'il le reste demain.
 *
 * ══ POURQUOI DEUX MOITIÉS, ET CE QUE CHACUNE PROUVE ═════════════════════════════════════════════
 *
 * A. LE CORPUS DE MIGRATIONS (sans base) — la source de vérité que la CI applique par `db reset`.
 *    Tourne partout, toujours, même sans Docker. Il attrape la régression à la SECONDE où elle est
 *    écrite, avant même qu'elle n'atteigne une base.
 *
 * B. LA BASE VIVANTE — parce qu'un corpus juste peut être appliqué sur une base qui a dérivé.
 *    Une session authentifiée ÉTRANGÈRE balaie les 27 tables : elle ne doit voir aucune ligne.
 *
 * ══ LE PIÈGE OÙ JE SUIS TOMBÉ EN ÉCRIVANT CE FICHIER, ET QUI EST DEVENU L'ASSERTION 1 ═══════════
 *
 * Mon premier extracteur retirait les commentaires `/* … *\/` AVANT les commentaires `-- …`. Or
 * `0039_theme_natal.sql` contient, DANS un commentaire de ligne, la séquence `@/lib/ai/*`. Le `/*`
 * ainsi ouvert s'est refermé sur le `*\/` de `0044`, ligne 220 : cinq migrations avalées d'un coup,
 * dont la création de `theme_natal`. Le garde ne voyait plus que 26 tables sur 27 — et il était
 * VERT, puisqu'il ne restait aucune table fautive dans ce qu'il voyait encore.
 *
 * Un garde aveugle est vert. C'est le pire état possible : il rassure exactement autant qu'un garde
 * qui mord. D'où l'assertion 1, qui est une garde SUR LE GARDE : l'extracteur doit retrouver un
 * plancher de tables et des ancres nommées. Si demain quelqu'un « améliore » l'extraction et casse
 * sa vue du corpus, c'est CETTE assertion qui rougit — pas le silence.
 */

const RACINE = resolve(process.cwd(), "supabase/migrations");

/**
 * Retire les commentaires SQL. L'ORDRE EST L'INVARIANT : ligne d'abord, bloc ensuite — sinon un
 * `/*` écrit à l'intérieur d'un commentaire de ligne ouvre un bloc fantôme (voir l'en-tête).
 */
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

const CORPUS = FICHIERS.map((f) => ({
  fichier: f,
  sql: sansCommentaires(readFileSync(resolve(RACINE, f), "utf-8")),
}));

const TOUT = CORPUS.map((c) => c.sql).join("\n");

/** Les tables `public` créées par une migration, dans l'ordre d'apparition. */
function tablesCreees(): string[] {
  const vues = new Set<string>();
  for (const m of TOUT.matchAll(
    /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_0-9]+)"?/gi,
  )) {
    vues.add(m[1].toLowerCase());
  }
  return [...vues].sort();
}

const TABLES = tablesCreees();

/**
 * Le plancher et les ancres. Le plancher n'est PAS le compte exact : une table de plus ne doit pas
 * faire rougir un garde de RLS (elle doit rougir sur la RLS, assertion 2). Ce qu'on interdit, c'est
 * que l'extracteur en voie MOINS qu'aujourd'hui — c'est-à-dire qu'il devienne aveugle.
 */
const PLANCHER_TABLES = 27;
const ANCRES = ["utilisatrice", "consentement", "entree_journal", "theme_natal", "intention", "probe"];

describe("A. Le corpus de migrations — la RLS naît avec la table (AD-12, Story 1.1 AC4)", () => {
  it("0. L'EXTRACTEUR LUI-MÊME — un `/*` égaré dans un commentaire de ligne n'avale rien", () => {
    // CE TEST EST LA VRAIE GARDE SUR LE GARDE, et l'assertion 1 ne suffisait pas à le remplacer.
    //
    // Mesuré : inverser les deux lignes de `sansCommentaires` NE FAIT PAS rougir la suite
    // aujourd'hui. Non parce que l'ordre serait indifférent, mais parce que le corpus actuel n'a
    // pas encore le fichier qui déclenche le défaut : `0039` porte un `/*` égaré (dans
    // `-- … @/lib/ai/*`) sans `*/`, et `0044` porte un vrai bloc `/** … */`. Comme le décommentage
    // se fait FICHIER PAR FICHIER, le `/*` de 0039 ne trouve rien à quoi se refermer.
    //
    // C'est une immunité par ACCIDENT, pas par construction. Le jour où une migration portera les
    // deux — une mention `lib/ai/*` en commentaire de ligne, PUIS un bloc `/* … */` plus bas —
    // l'ordre inversé avalerait tout le SQL situé entre les deux, en silence, et le garde
    // resterait vert. On éprouve donc l'extracteur sur l'entrée qui n'existe pas encore.
    const piege = [
      "-- une note qui mentionne @/lib/ai/* au passage",
      "create table public.piege (id uuid primary key);",
      "/* un vrai bloc de commentaire */",
      "alter table public.piege enable row level security;",
    ].join("\n");

    const propre = sansCommentaires(piege);
    expect(propre).toContain("create table public.piege");
    expect(propre).toContain("alter table public.piege enable row level security");
    expect(propre).not.toContain("un vrai bloc de commentaire");
    expect(propre).not.toContain("une note qui mentionne");
  });

  it("1. LE GARDE VOIT LE CORPUS ENTIER — sinon tout ce qui suit est un vert sans valeur", () => {
    expect(FICHIERS.length).toBeGreaterThanOrEqual(48);
    expect(TABLES.length).toBeGreaterThanOrEqual(PLANCHER_TABLES);
    for (const ancre of ANCRES) expect(TABLES, `ancre perdue : ${ancre}`).toContain(ancre);
  });

  it("2. CHAQUE table créée est mise en RLS activée ET forcée", () => {
    const fautives = TABLES.filter((t) => {
      const activee = new RegExp(
        `alter\\s+table\\s+(?:public\\.)?"?${t}"?\\s+enable\\s+row\\s+level\\s+security`,
        "i",
      ).test(TOUT);
      const forcee = new RegExp(
        `alter\\s+table\\s+(?:public\\.)?"?${t}"?\\s+force\\s+row\\s+level\\s+security`,
        "i",
      ).test(TOUT);
      return !activee || !forcee;
    });
    expect(fautives, `tables sans « enable » + « force » row level security : ${fautives.join(", ")}`)
      .toEqual([]);
  });

  it("3. AUCUNE migration ne désarme la RLS", () => {
    const desarmements = CORPUS.filter((c) =>
      /\b(disable\s+row\s+level\s+security|no\s+force\s+row\s+level\s+security)\b/i.test(c.sql),
    ).map((c) => c.fichier);
    expect(desarmements, `désarmement de la RLS dans : ${desarmements.join(", ")}`).toEqual([]);
  });

  it("4. AUCUN privilège de table PLEIN n'est accordé à anon/authenticated", () => {
    // Supabase donne déjà les sept privilèges DML sur `public` — c'est le fait central de cette
    // revue, et c'est pour ça que la RLS est la SEULE serrure. Deux choses distinctes s'écrivent
    // avec le mot `grant`, et les confondre rendrait ce garde faux :
    //
    //   • `grant execute on function …` — l'INVERSE d'un élargissement : une fonction naît sans
    //     droit d'exécution et on l'ouvre nommément. Permis.
    //   • `grant update (colonne, colonne) on …` — le patron de 0041 : on RÉVOQUE d'abord le
    //     privilège de table, puis on re-grante colonne par colonne. C'est un RÉTRÉCISSEMENT,
    //     et c'est la deuxième serrure derrière la policy. Permis, et souhaitable.
    //
    // Ce qui est interdit, c'est le grant de TABLE ENTIÈRE : `grant all on public.x to authenticated`.
    // Il rendrait muettes toutes les révocations de colonnes écrites ailleurs.
    const pleins: string[] = [];
    for (const { fichier, sql } of CORPUS) {
      for (const m of sql.matchAll(/\bgrant\s+([\s\S]*?)\s+to\s+([a-z_,\s]+);/gi)) {
        const quoi = m[1].trim();
        const aQui = m[2].trim();
        if (/\bexecute\s+on\s+(function|routine)\b/i.test(quoi)) continue;
        if (/\([^)]*\)\s*on\b/i.test(quoi)) continue; // grant <priv> (colonnes) on <table>
        if (/\b(anon|authenticated|public)\b/i.test(aQui)) {
          pleins.push(`${fichier} → grant ${quoi.slice(0, 60)} to ${aQui}`);
        }
      }
    }
    expect(pleins, `grants de table entière : ${pleins.join(" | ")}`).toEqual([]);
  });

  it("5. CHAQUE fonction `security definer` fige son `search_path`", () => {
    // Une fonction `security definer` sans `search_path` figé s'exécute avec les privilèges de son
    // propriétaire ET le chemin de recherche de l'APPELANT : il suffit de créer une fonction
    // homonyme dans un schéma qu'on contrôle pour détourner l'exécution. C'est une élévation de
    // privilège classique, et le produit en compte plusieurs dizaines.
    const nues: string[] = [];
    for (const { fichier, sql } of CORPUS) {
      for (const m of sql.matchAll(
        /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z_0-9]+)\s*\(/gi,
      )) {
        const entete = sql.slice(m.index!).split("$")[0];
        if (/security\s+definer/i.test(entete) && !/set\s+search_path/i.test(entete)) {
          nues.push(`${fichier} → ${m[1]}`);
        }
      }
    }
    expect(nues, `security definer sans search_path : ${nues.join(", ")}`).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// B. LA BASE VIVANTE — un corpus juste peut être appliqué sur une base qui a dérivé.
// ═════════════════════════════════════════════════════════════════════════════════════════════════

const url = process.env.SUPABASE_URL!;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Codes PostgREST/Postgres qui prouvent un REFUS. `42P01` (table inconnue) n'en fait PAS partie. */
const REFUS = new Set(["42501", "PGRST301", "PGRST116"]);

describe("B. La base vivante — une étrangère authentifiée ne voit RIEN, table par table", () => {
  const MDP = "test-catalogue-123!";
  const t = Date.now();
  let etrangere: ReturnType<typeof createClient>;
  let uid = "";

  beforeAll(async () => {
    if (!url || !publishable || !secret) throw new Error("Supabase local requis (URL / PUBLISHABLE / SECRET).");

    // LE TÉMOIN QUI REND LE BALAYAGE NON-VIDE. Sans lui, « zéro ligne partout » serait aussi le
    // résultat d'une base VIDE : on prouverait l'isolation en ne prouvant rien. `probe` est semée
    // ici sous service_role — donc elle EXISTE, et le zéro qu'on lira sur elle est un vrai zéro.
    const seme = await admin.from("probe").insert({ secret: `temoin-catalogue-${t}` });
    expect(seme.error, "le témoin doit pouvoir être semé sous service_role").toBeNull();

    const email = `catalogue-${t}@exemple.fr`;
    const { data: cree, error: eCreation } = await admin.auth.admin.createUser({
      email,
      password: MDP,
      email_confirm: true,
    });
    if (eCreation) throw new Error(`createUser: ${eCreation.message}`);
    uid = cree.user!.id;

    etrangere = createClient(url, publishable, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: eConnexion } = await etrangere.auth.signInWithPassword({ email, password: MDP });
    if (eConnexion) throw new Error(`signIn: ${eConnexion.message}`);
  });

  it("le témoin `probe` existe bel et bien sous service_role — le balayage n'est pas vide", async () => {
    const { count, error } = await admin.from("probe").select("*", { count: "exact", head: true });
    expect(error).toBeNull();
    expect(count ?? 0).toBeGreaterThan(0);
  });

  it.each(TABLES)("`%s` : jamais une ligne d'autrui", async (table) => {
    const { data, error } = await etrangere.from(table).select("*").limit(5);

    if (error) {
      // Un refus est une réponse LÉGITIME (aucun privilège de table). Mais « table inconnue »
      // (42P01) serait une faute de frappe qui ferait passer le test pour rien : on l'exclut.
      expect(REFUS.has(error.code ?? ""), `${table} : erreur inattendue ${error.code} — ${error.message}`)
        .toBe(true);
      return;
    }

    // ⚠️ L'ASSERTION N'EST PAS « ZÉRO LIGNE ». Une session légitime VOIT ses propres lignes : la
    // création du compte pose déjà une ligne dans `utilisatrice`, et une policy propriétaire la lui
    // rend — c'est le fonctionnement voulu, pas une fuite. Exiger le vide ferait rougir le produit
    // sain et pousserait à affaiblir le garde pour le faire taire.
    //
    // Ce qu'on interdit est plus précis et plus juste : qu'une ligne visible appartienne à QUELQU'UN
    // D'AUTRE. Toute ligne rendue doit être rattachée à l'identité de la session.
    const intruses = (data ?? []).filter((ligne) => {
      const r = ligne as Record<string, unknown>;
      return r.utilisatrice_id !== uid && r.id !== uid;
    });
    expect(
      intruses,
      `${table} : une étrangère authentifiée voit ${intruses.length} ligne(s) qui ne sont pas les siennes`,
    ).toEqual([]);
  });
});
