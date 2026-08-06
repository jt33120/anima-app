import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * REVUE 4.9 (T6-6) — LES CIBLES TACTILES FONT 44 px, ET C'EST PROUVÉ.
 *
 * DESIGN.md:534 : « 44 px est le minimum absolu ». Le token `--cible-tactile` existe depuis le premier
 * jour, et il était respecté partout — par DISCIPLINE. Onze fichiers de style l'appliquaient à la main,
 * un l'avait oublié (`<summary>` de la halte synthèse, ~19 px de haut : la seule commande interactive de
 * la page), et rien, nulle part, ne pouvait le dire.
 *
 * C'est exactement le patron que cette revue a rencontré cinq fois sous d'autres formes : une règle vraie
 * partout mais tenue par la mémoire de celui qui écrit. La mémoire finit toujours par céder — et sur
 * celle-ci, elle cède au détriment de quelqu'un qui vise mal, sur un téléphone, d'une main.
 *
 * ── CE QUE LA GARDE REGARDE, ET CE QU'ELLE NE PEUT PAS REGARDER ────────────────────────────────────────
 *
 * Elle lit les modules CSS et cherche les sélecteurs qui désignent une cible de pointeur : `button`,
 * `summary`, `input`, `select`, `textarea`, `[role="button"]`, ou une classe dont le nom contient
 * « bouton » (au singulier) ou « champ ». Pour chacun, au moins un bloc doit déclarer
 * `min-height: var(--cible-tactile)`.
 *
 * Ce qu'elle ne prouve PAS, et il faut le dire précisément plutôt que de laisser croire à une couverture
 * qu'elle n'a pas :
 *
 *   • la hauteur RENDUE — un `min-height` peut être annulé par un parent ; c'est une garde de convention,
 *     pas une mesure ;
 *   • les commandes que leur NOM ne trahit pas. `.sortieRapide` et `.numero` (page d'aide) sont des
 *     commandes réelles qui portent bien le token, mais qu'aucune heuristique de nom n'attrapera. Elles
 *     restent tenues par la relecture.
 *
 * Autrement dit : cette garde rend impossible la RÉGRESSION sur les commandes nommées, pas l'oubli sur
 * une commande nouvelle au nom inédit. C'est un gain net, ce n'est pas une preuve d'exhaustivité.
 */

const RACINE = process.cwd();

function modulesCss(): string[] {
  const trouves: string[] = [];
  for (const dossier of ["app", "render"]) {
    for (const f of readdirSync(resolve(RACINE, dossier), { recursive: true, encoding: "utf-8" }) as string[]) {
      if (f.endsWith(".module.css")) trouves.push(`${dossier}/${f}`);
    }
  }
  return trouves;
}

/** Découpe grossièrement en blocs `sélecteurs { déclarations }`. Les modules du projet sont plats. */
function blocs(css: string): { selecteurs: string; corps: string }[] {
  const sansCommentaires = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...sansCommentaires.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selecteurs: m[1].trim(),
    corps: m[2],
  }));
}

/**
 * UN sélecteur (déjà réduit à sa racine) désigne-t-il une commande ?
 *
 * Le test porte sur le sélecteur SEUL, jamais sur le groupe auquel il appartient — sans quoi
 * `.actionPrincipale:focus-visible, .accroche:focus-visible { outline: … }` ferait de `.accroche` une
 * commande par contagion, et la garde crierait sur un bloc qui ne parle que de mise au point.
 *
 * Pour les classes, on extrait le NOM ENTIER avant de décider : « bouton » quelque part dedans, sauf si
 * le nom SE TERMINE par un pluriel. Dans ce dépôt le pluriel nomme un conteneur (`.zoomBoutons` est la
 * boîte flex qui range les boutons de zoom, pas une cible) — convention réelle, pas commodité.
 *
 * Le test sur la terminaison n'est pas décoratif : une première version excluait « bouton suivi de s ou
 * S », ce qui écartait aussi `.boutonSecondaire` — c'est-à-dire le patron le plus répandu du dépôt. La
 * garde ne voyait alors plus que sept commandes sur onze, et le contrôle non-vacue l'a dit.
 */
function estCommande(selecteur: string): boolean {
  // Les ZONES DE SAISIE comptent : WCAG 2.5.8 parle de cibles de pointeur, pas de boutons. Un champ trop
  // court est aussi difficile à viser qu'un bouton trop court — et la mutation-vérification l'a montré en
  // dégradant `.champ` sans qu'une seule ligne ne rougisse.
  if (/(^|[\s>+~])(button|summary|input|select|textarea)\b/.test(selecteur)) return true;
  if (/\[role=["']?button/.test(selecteur)) return true;
  return [...selecteur.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].some(
    ([, nom]) => (/bouton/i.test(nom) && !/boutons$/i.test(nom)) || /champ/i.test(nom),
  );
}

/** Le nom « racine » d'un sélecteur, modificateurs retirés — pour regrouper `.bouton` et `.bouton:hover`. */
function racineSelecteur(selecteur: string): string {
  return selecteur
    .split(",")[0]
    .trim()
    .replace(/::?[a-zA-Z-]+(\([^)]*\))?/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .trim();
}

interface Commande {
  fichier: string;
  racine: string;
  aLaCible: boolean;
}

/**
 * DEUX PASSES, et la séparation est le correctif.
 *
 * Une première version ne regardait que les blocs « de commande » et y accumulait la présence du token.
 * Elle se trompait deux fois : un sélecteur groupé contaminait ses voisins (un `:focus-visible` partagé
 * entre un bouton et une zone de saisie faisait de la seconde une commande), et la règle RÉELLE de ces
 * voisins vivait dans un bloc que la garde n'ouvrait jamais — donc elle les déclarait nus alors qu'ils
 * portaient le token deux lignes plus bas.
 *
 * Passe 1 : pour CHAQUE bloc, on note si chacun de ses membres y reçoit le token. Un sélecteur groupé
 *           porte bien la règle pour tous ses membres, ce qui est le patron le plus courant du dépôt.
 * Passe 2 : on n'EXIGE le token que des sélecteurs qui sont des commandes par leur PROPRE nom.
 */
const COMMANDES: Commande[] = [];
for (const fichier of modulesCss()) {
  const porteLaCible = new Map<string, boolean>();
  const estUneCommande = new Set<string>();

  for (const { selecteurs, corps } of blocs(readFileSync(resolve(RACINE, fichier), "utf-8"))) {
    const aLaCible = /min-height:\s*var\(--cible-tactile\)/.test(corps);
    for (const brut of selecteurs.split(",")) {
      const membre = racineSelecteur(brut);
      if (!membre) continue;
      porteLaCible.set(membre, (porteLaCible.get(membre) ?? false) || aLaCible);
      if (estCommande(brut.trim())) estUneCommande.add(membre);
    }
  }

  for (const racine of estUneCommande) {
    COMMANDES.push({ fichier, racine, aLaCible: porteLaCible.get(racine) ?? false });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════

describe("[T6-6] toute commande interactive porte la cible tactile", () => {
  it("la découverte trouve RÉELLEMENT des commandes — sinon la garde ne garde rien", () => {
    // Le contrôle non-vacue. Une regex cassée rendrait zéro commande : aucune violation, jamais.
    expect(modulesCss().length, "aucun module CSS découvert").toBeGreaterThan(5);
    expect(COMMANDES.length, "aucune commande détectée : les sélecteurs ne sont plus reconnus").toBeGreaterThan(
      8,
    );
  });

  it("[CONTRÔLE POSITIF] un bloc sans la cible est bien repéré", () => {
    // Sans lui, `aLaCible` pourrait valoir `true` par construction et la garde serait décorative.
    const faux = blocs(".sansRien summary { cursor: pointer; }")[0];
    expect(estCommande(faux.selecteurs)).toBe(true);
    expect(/min-height:\s*var\(--cible-tactile\)/.test(faux.corps)).toBe(false);
  });

  it("le détecteur ne prend pas un CONTENEUR pour une commande", () => {
    // Les deux faux positifs de la première version de cette garde, figés ici pour qu'ils ne reviennent
    // pas : le pluriel nomme une boîte, pas une cible — et un sélecteur ne devient PAS une commande parce
    // qu'il partage une règle de mise au point avec un bouton.
    expect(estCommande(".zoomBouton"), "singulier : un vrai bouton").toBe(true);
    expect(estCommande(".zoomBoutons"), "pluriel : la boîte qui les range").toBe(false);
    expect(estCommande(".actions"), "un conteneur d'actions n'est pas une action").toBe(false);
    expect(estCommande(".accroche:focus-visible"), "aucune contagion par le groupe").toBe(false);
    expect(estCommande(".champ"), "une zone de saisie est une cible de pointeur (WCAG 2.5.8)").toBe(true);
  });

  it("[LE CŒUR] aucune commande sous les 44 px", () => {
    // Mutation-cible : retirer `min-height: var(--cible-tactile)` de n'importe quel `<summary>` ou
    // bouton du dépôt — c'est exactement le geste qui avait laissé la halte synthèse à ~19 px.
    const nues = COMMANDES.filter((c) => !c.aLaCible).map((c) => `${c.fichier} → ${c.racine}`);
    expect(nues, `commandes sans --cible-tactile : ${nues.join(", ")}`).toEqual([]);
  });
});
