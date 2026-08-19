import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * premier-passage-frontiere.test.ts — [H4 · FR-031] LE COMPTE NE TRAVERSE PAS ICI NON PLUS.
 *
 * Même garde que `bibliotheque-frontiere.test.ts`, et pour la même leçon payée en 4.10 : **la façon
 * naturelle de faire fuir un compte est de l'ajouter au type qui traverse la frontière**. Le premier
 * passage sait qu'il reste des cartes vides ; la pente évidente serait d'écrire « 4 cartes sur 6 »,
 * et il faudrait alors se souvenir de ne pas l'afficher. S'il n'existe aucun champ où écrire un
 * compte, il n'y a rien à se souvenir.
 *
 * Les deux déclarations existent séparément parce que `render/` n'a pas le droit de connaître
 * `lib/domain/` (AD-7/AD-10). Elles doivent donc coïncider, et ça ne s'auto-vérifie pas.
 */

const RACINE = process.cwd();
const lire = (f: string) => readFileSync(resolve(RACINE, f), "utf-8");

function corpsInterface(source: string, nom: string): string {
  const debut = source.indexOf(`export interface ${nom} {`);
  if (debut < 0) return "";
  const fin = source.indexOf("\n}", debut);
  return fin < 0 ? "" : source.slice(debut, fin);
}

/** Les noms de champ déclarés, commentaires exclus. */
function champs(corps: string): readonly string[] {
  return corps
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^readonly [a-zA-Z]+[?]?:/.test(l))
    .map((l) => l.replace(/^readonly ([a-zA-Z]+)[?]?:.*$/, "$1"))
    .sort();
}

const DOMAINE = corpsInterface(lire("lib/domain/premier-passage.ts"), "PremierPassage");
const RENDU = corpsInterface(lire("render/premier-passage.tsx"), "PremierPassageVue");

describe("[H4] les deux déclarations du premier passage", () => {
  it("[CONTRÔLE DU CONTRÔLE] les deux corps ont bien été extraits", () => {
    // Sans ce témoin, tous les refus ci-dessous seraient vrais sur des chaînes vides — le mode
    // d'échec exact d'une garde dont l'extracteur casse.
    expect(DOMAINE.length, "corps du domaine vide : l'extracteur a cassé").toBeGreaterThan(50);
    expect(RENDU.length, "corps du rendu vide : l'extracteur a cassé").toBeGreaterThan(20);
  });

  it("[LE CŒUR] elles portent EXACTEMENT les mêmes champs", () => {
    expect(champs(RENDU), "les deux formes ont divergé").toEqual(champs(DOMAINE));
  });

  it("[LE CŒUR] aucune des deux ne porte un champ NUMÉRIQUE", () => {
    // `number` est la seule forme sous laquelle un compte peut passer. Le refuser à la déclaration
    // rend « 4 cartes vides sur 6 » inécrivable, plutôt qu'interdit par la discipline.
    for (const [ou, corps] of [["domaine", DOMAINE], ["rendu", RENDU]] as const) {
      expect(/:\s*(number|readonly number\[\])/.test(corps), `${ou} : un champ numérique est apparu`).toBe(false);
    }
  });

  it("aucune des deux ne porte un nom de mesure", () => {
    const MESURES = ["badge", "compte", "compteur", "total", "nombre", "restant", "quantite", "cadenas"];
    for (const [ou, corps] of [["domaine", DOMAINE], ["rendu", RENDU]] as const) {
      for (const m of MESURES) {
        expect(new RegExp(`readonly ${m}`, "i").test(corps), `${ou} : champ « ${m} »`).toBe(false);
      }
    }
  });
});
