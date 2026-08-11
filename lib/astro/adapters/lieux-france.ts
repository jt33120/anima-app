import donnees from "./communes-france.json";
import {
  fuseauDeCommune,
  normaliserLieu,
  type LieuNaissance,
  type LieuxPort,
} from "../lieux";

/**
 * lieux-france.ts — L'ADAPTATEUR DE LIEUX DE NAISSANCE (Story 5.3, T2).
 *
 * ⚠️ **SEUL FICHIER DU DÉPÔT AUTORISÉ À IMPORTER `communes-france.json`.** La garde est dans
 * `tests/astro-architecture.test.ts`. Tout le reste du produit ne connaît que `LieuxPort` — c'est
 * ce qui rendra le référentiel mondial substituable sans toucher au domaine.
 *
 * ── LE FICHIER DE DONNÉES PÈSE 1,4 Mo : NE L'IMPORTER QUE D'ICI ────────────────────────────────
 *
 * L'index normalisé est construit à la PREMIÈRE recherche, pas au chargement du module. Sans cette
 * paresse, tout point de code qui importerait ce fichier — même sans jamais chercher un lieu —
 * paierait 35 000 normalisations au démarrage à froid, sur un chemin (l'ouverture de la scène) où
 * personne ne cherche de lieu.
 *
 * ── CE QUE L'ADAPTATEUR ÉCARTE, ET POURQUOI IL LE FAIT ICI ─────────────────────────────────────
 *
 * Les communes dont le fuseau est inconnu (Terres australes, Clipperton) sont retirées des
 * résultats. Le tri se fait à la SOURCE des résultats, pas plus haut : une commune proposée puis
 * inexploitable ferait vivre le refus après le choix, sur un geste irréversible (0039).
 */

interface Brut {
  readonly source: string;
  readonly communes: readonly [string, string, number, number][];
}

const CATALOGUE = donnees as unknown as Brut;

/** Identifie la SOURCE et sa date de fabrication — pas la bibliothèque, il n'y en a pas. */
export const IDENTIFIANT_LIEUX_FRANCE = "communes-france@geo.api.gouv.fr";

interface Entree {
  readonly lieu: LieuNaissance;
  readonly cle: string;
}

let index: Entree[] | null = null;
let parCode: Map<string, LieuNaissance> | null = null;

function construireIndex(): Entree[] {
  const entrees: Entree[] = [];
  for (const [nom, code, latitude, longitude] of CATALOGUE.communes) {
    const fuseau = fuseauDeCommune(code, latitude);
    if (fuseau === null) continue; // fuseau inconnu ⇒ le lieu n'est pas proposable (voir l'en-tête)
    entrees.push({
      lieu: { nom, code, latitude, longitude, fuseau },
      cle: normaliserLieu(nom),
    });
  }
  return entrees;
}

/**
 * L'adaptateur. Sans état observable : deux recherches identiques rendent la même chose, dans le
 * même ordre (l'index est un cache, pas une source de variation).
 */
export function lieuxFrance(): LieuxPort {
  return {
    identifiant: IDENTIFIANT_LIEUX_FRANCE,

    chercher(requete: string, limite: number): readonly LieuNaissance[] {
      const cle = normaliserLieu(requete);
      // Une saisie d'un seul caractère rendrait des milliers de résultats sans rien apprendre à
      // personne. Deux, c'est le minimum où le classement commence à vouloir dire quelque chose.
      if (cle.length < 2 || limite <= 0) return [];

      index ??= construireIndex();

      const debuts: Entree[] = [];
      const dedans: Entree[] = [];
      for (const e of index) {
        if (e.cle.startsWith(cle)) debuts.push(e);
        else if (e.cle.includes(cle)) dedans.push(e);
      }

      // Classement : ce qui COMMENCE par la saisie d'abord (« bordeaux » avant « Barbey-Bordeaux »),
      // puis le nom le plus court (la ville elle-même avant ses composés), puis le code INSEE — un
      // départage TOTAL, sans quoi deux exécutions pourraient ne pas rendre le même ordre.
      const parPertinence = (a: Entree, b: Entree) =>
        a.cle.length - b.cle.length || a.lieu.code.localeCompare(b.lieu.code);

      return [...debuts.sort(parPertinence), ...dedans.sort(parPertinence)]
        .slice(0, limite)
        .map((e) => e.lieu);
    },

    trouverParCode(code: string): LieuNaissance | null {
      index ??= construireIndex();
      // La table de codes est bâtie depuis le MÊME index que la recherche : une commune écartée
      // faute de fuseau (Terres australes, Clipperton) est donc introuvable des DEUX côtés. Deux
      // sources auraient fini par diverger, et la divergence aurait laissé graver un lieu que
      // l'interface ne propose pas.
      parCode ??= new Map(index.map((e) => [e.lieu.code, e.lieu]));
      return parCode.get(code) ?? null;
    },
  };
}
