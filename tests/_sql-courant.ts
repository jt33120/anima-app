import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * _sql-courant.ts — LA DÉFINITION QUI TOURNE, PAS CELLE QU'UN TEST A ÉPINGLÉE.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * POURQUOI CE FICHIER EXISTE (revue Epic 6, R5)
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * `effacement-schema.test.ts` lisait `0058_effacement_total.sql` et y vérifiait, sous un test nommé
 * `[LE CŒUR]`, que la trace d'effacement est posée AVANT la première suppression — la propriété la
 * plus critique du dépôt en matière de RGPD, celle sans laquelle un effacement interrompu ne laisse
 * aucune preuve.
 *
 * ⚠️ **Or la 6.8 avait remplacé cette fonction.** `create or replace function` dans `0059` a déplacé
 * tout le corps dans `effacer_utilisatrice`, laissant `effacer_toutes_mes_donnees` en enveloppe de
 * trois lignes. Le test validait donc, en toute bonne foi et en restant vert, **un corps que la base
 * n'exécute plus**. Inverser l'ordre dans `0059` n'aurait fait rougir personne.
 *
 * Ce n'est pas un accident isolé : `create or replace function` est la convention de ce dépôt
 * (`utilisatrices_a_synthetiser`, `traiter_evenement_abonnement`, `eligible_au_periodique`… en portent
 * chacune plusieurs). **Épingler un fichier revient à parier qu'aucune story future ne redéfinira la
 * fonction** — pari déjà perdu une fois.
 *
 * La règle qui remplace le pari : on ne nomme jamais un FICHIER, on nomme une FONCTION, et le corpus
 * répond avec sa dernière définition — exactement ce que fait PostgreSQL en rejouant les migrations
 * dans l'ordre.
 */

const RACINE = resolve(process.cwd(), "supabase/migrations");

/**
 * Commentaires SQL retirés — `--` en ligne, `/* *&#47;` en bloc, dans cet ordre.
 *
 * ⚠️ **CE N'EST PAS `sansCommentaires` DE `_absence.ts`, ET LA PREMIÈRE VERSION DE CE FICHIER L'A
 * RÉUTILISÉ À TORT.** Celui-là dépouille du TypeScript : il connaît `//` et `/* *&#47;`, pas `--`. Un
 * commentaire SQL survivait donc au dépouillement, et une garde d'export a immédiatement rougi en
 * comptant `to_jsonb(t) - 'colonne'` écrit dans une phrase d'explication.
 *
 * Le test a mordu, et c'est exactement ce qu'on lui demande : un extracteur qui laisse passer la
 * prose fait des gardes vertes et creuses — le défaut même que ce fichier existe pour réparer.
 *
 * L'ORDRE COMPTE : ligne d'abord, bloc ensuite. L'inverse fait qu'un `/*` égaré dans un `--` avale
 * tout ce qui suit jusqu'au prochain `*&#47;`.
 */
function sansCommentairesSql(sql: string): string {
  return sql
    .split("\n")
    .map((l) => l.replace(/--.*$/, ""))
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Les migrations, dans l'ordre où Postgres les rejoue. */
export function fichiersDeMigration(): readonly string[] {
  return readdirSync(RACINE)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

/** Tout le corpus, commentaires retirés — pour les questions qui portent sur l'ensemble du schéma. */
export function corpusSql(): string {
  return fichiersDeMigration()
    .map((f) => sansCommentairesSql(readFileSync(resolve(RACINE, f), "utf-8")))
    .join("\n");
}

/**
 * Toutes les définitions successives d'une fonction, dans l'ordre du corpus.
 *
 * Le corps est délimité par sa balise de guillemets-dollar (`$fn$`, `$$`, …) : on lit la balise
 * ouvrante réellement utilisée plutôt que d'en supposer une, sans quoi une fonction écrite avec une
 * balise différente serait tronquée en silence — et un test tronqué est un test vert.
 */
export function definitionsDe(nom: string): readonly string[] {
  const sql = corpusSql();
  const debut = new RegExp(
    String.raw`create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?${nom}\s*\(`,
    "gi",
  );
  const trouvees: string[] = [];
  for (const m of sql.matchAll(debut)) {
    const depuis = m.index;
    const baliseOuvrante = /\$([a-z_]*)\$/i.exec(sql.slice(depuis));
    if (!baliseOuvrante) continue;
    const posBalise = depuis + baliseOuvrante.index;
    const balise = baliseOuvrante[0];
    const fin = sql.indexOf(balise, posBalise + balise.length);
    if (fin === -1) continue;
    trouvees.push(sql.slice(depuis, fin + balise.length));
  }
  return trouvees;
}

/**
 * LA définition courante — la dernière écrite dans le corpus, donc celle qui tourne.
 *
 * ⚠️ **Elle LÈVE si la fonction est introuvable.** Rendre une chaîne vide ferait passer au vert
 * toutes les assertions d'absence de l'appelant : un simple renommage suffirait alors à désarmer une
 * garde sans que rien ne le signale. C'est le défaut que ce fichier existe pour empêcher — il serait
 * absurde de le réintroduire ici.
 */
export function definitionCourante(nom: string): string {
  const toutes = definitionsDe(nom);
  if (toutes.length === 0) {
    throw new Error(
      `_sql-courant : aucune définition de « ${nom} » dans les migrations. ` +
        `Fonction renommée ou supprimée ? La garde qui appelle ceci ne mesure plus rien.`,
    );
  }
  return toutes[toutes.length - 1];
}
