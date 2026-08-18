import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * reserve-barre-basse.test.ts — LA BARRE BASSE N'AVALE PLUS LE COMPOSEUR (QA tour 2, BLOQUANT).
 *
 * ══ CE QUI ÉTAIT EN JEU ═════════════════════════════════════════════════════════════════════════
 *
 * La hauteur de la barre était lue à DEUX endroits, dans deux formes différentes : `.nav` la
 * produisait par son rembourrage (44 + 2 × 12 = 68 px), et `.regionConversation` en réservait
 * `--cible-tactile` (44 px). Les 24 px d'écart mettaient le bas du champ de saisie ET du bouton
 * « Envoyer » SOUS la barre — qui, posée au-dessus, avalait le tap.
 *
 * Mesuré à 390 × 844 : champ 12 px sous la barre (25 % de sa hauteur), bouton 12 px dessous (27 %),
 * et `document.elementFromPoint` au bas du bouton rendait `NAV`. **Le message n'était pas envoyé, et
 * rien ne le disait.** Après correctif : chevauchement 0, `elementFromPoint` rend `BUTTON`, et le
 * fil passe de 387 à 465 px — le bloc de ressources de détresse y tient désormais.
 *
 * C'est la leçon R1 de la revue Epic 6, transposée : deux lectures d'une même question finissent par
 * ne plus dire la même chose. Ici l'écart valait un message perdu en silence.
 *
 * ══ CE QUE CE TEST GARDE ════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ AUCUN TEST DE CE DÉPÔT NE COMPOSE UN PIXEL — la mesure ci-dessus vient d'un navigateur réel.
 * Ce fichier garde la CAUSE : que la hauteur soit déclarée UNE fois et citée par ses deux lecteurs.
 * Il ne peut pas voir un chevauchement ; il peut empêcher qu'on en réintroduise un.
 */

const racine = process.cwd();
const globals = readFileSync(resolve(racine, "app/styles/globals.css"), "utf-8");
const monde = readFileSync(resolve(racine, "render/monde.module.css"), "utf-8");

function bloc(css: string, selecteur: string): string {
  const i = css.indexOf(selecteur + " {");
  expect(i, `${selecteur} a disparu`).toBeGreaterThan(-1);
  return css.slice(i, css.indexOf("}", i));
}

describe("[QA tour 2] la hauteur de la barre est déclarée UNE fois", () => {
  it("`--hauteur-nav` existe, et il est bâti sur les mêmes valeurs que le rembourrage de la barre", () => {
    const racineCss = bloc(globals, ":root");
    expect(racineCss, "`--hauteur-nav` doit être déclaré").toMatch(/--hauteur-nav:/);
    // Les trois termes du rembourrage réel de `.nav` : la cible tactile, l'espace du haut, et
    // l'espace du bas qui cède à l'encoche.
    expect(racineCss).toMatch(/--hauteur-nav:[\s\S]*var\(--cible-tactile\)/);
    expect(racineCss).toMatch(/--hauteur-nav:[\s\S]*var\(--esp-3\)/);
    expect(
      racineCss,
      "l'encoche agrandit la barre : sans elle, la réserve serait fausse sur iPhone",
    ).toMatch(/--hauteur-nav:[\s\S]*env\(safe-area-inset-bottom\)/);
  });

  it("⚠️ la région de conversation réserve LA BARRE, pas une cible tactile", () => {
    // LE MUTANT QUI COMPTE : revenir à `var(--cible-tactile)`. Mesuré : le chevauchement de 12 px
    // revient immédiatement.
    const conv = bloc(monde, ".regionConversation");
    expect(conv, "la réserve du bas doit citer la hauteur de la barre").toMatch(
      /padding-bottom:\s*var\(--hauteur-nav\)/,
    );
    expect(conv, "44 px ne suffisent pas pour une barre de 68").not.toMatch(
      /padding-bottom:\s*var\(--cible-tactile\)/,
    );
  });

  it("la barre elle-même est COMMANDÉE par le jeton, pas seulement décrite par lui", () => {
    // Sans ça, changer le rembourrage de `.nav` la ferait grandir sans que la réserve bouge — et le
    // chevauchement reviendrait par une porte que personne ne surveille.
    expect(bloc(monde, ".nav")).toMatch(/min-height:\s*var\(--hauteur-nav\)/);
  });

  it("une zone transparente ne capte pas le pointeur, et les liens le reprennent", () => {
    // Le dégradé est transparent sur ses deux tiers hauts, délibérément — la scène n'a pas de bord
    // franc. Même motif que `.grain`, qui décore et laisse passer. Une surface décorative qui capte
    // avale des gestes destinés à ce qu'on voit derrière.
    expect(bloc(monde, ".nav")).toMatch(/pointer-events:\s*none/);
    expect(bloc(monde, ".navLien"), "sinon la barre elle-même devient inerte").toMatch(
      /pointer-events:\s*auto/,
    );
  });
});
