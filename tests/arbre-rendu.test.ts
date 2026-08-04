import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { LIBELLE_ETAT } from "@/render/arbre/copie-arbre";
import { nomDonne } from "@/render/arbre/ChampRenommage";
import { nomValide } from "@/lib/domain/branche";

/**
 * Story 4.6 (T5) — gardes du RENDU de l'arbre par LECTURE de source (convention du projet : environnement node,
 * pas de RTL). On verrouille : l'état écrit en toutes lettres (« rayonnement », plus jamais « fruit ») ; FR-031
 * (aucun compteur/pourcentage/jauge/badge/score dans la copie d'UI) ; l'accroche ≥44px ; role="img"+aria-label ;
 * la fiche NON-MODALE ; le nom en voix utilisatrice ; le surlignage neutralisé en reduced-motion ; charte (aucun
 * brun/or, rayonnement = lueur nacre).
 */

const racine = process.cwd();
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const lire = (p: string) => sansCommentaires(readFileSync(resolve(racine, p), "utf-8"));

describe("libellé d'état — en toutes lettres, « rayonnement » (plus jamais « fruit »)", () => {
  it("naissance / feuillaison / rayonnement", () => {
    expect(LIBELLE_ETAT.naissance).toBe("naissance");
    expect(LIBELLE_ETAT.feuillaison).toBe("feuillaison");
    expect(LIBELLE_ETAT.fruit).toBe("rayonnement"); // l'enum SQL reste 'fruit', l'AFFICHAGE dit rayonnement
  });
});

describe("[FR-031 DUR] aucune mesure NULLE PART dans le rendu de l'arbre", () => {
  /*
   * RE-REVUE (HAUTE) — la garde précédente ne prouvait PAS ce qu'elle annonçait. Elle interdisait sept MOTS
   * français et un token littéral `X.length`. Conséquences mesurées par la revue : un vrai compteur
   * (`{nbBranches} branches nommées`) et un vrai pourcentage (`Progression : {…} %`) affichés depuis un
   * composant passaient VERTS — pendant qu'un identifiant interne parfaitement légitime (`niveauDuRang`)
   * la faisait rougir. Blacklister du vocabulaire ne dit rien de ce qui est AFFICHÉ.
   *
   * La garde est désormais STRUCTURELLE, et surtout : elle SE TESTE ELLE-MÊME (dernier `it`). Les mêmes
   * prédicats sont rejoués sur des sources-mutantes synthétiques ; s'ils ne les attrapent pas, la garde
   * est déclarée fausse. C'est la seule façon de ne pas re-livrer une garde décorative.
   */
  const fichiers = [
    ...readdirSync(resolve(racine, "render/arbre")).map((f) => `render/arbre/${f}`),
    "render/conversation/EchangeSource.tsx",
  ];
  const composants = fichiers.filter((f) => f.endsWith(".tsx"));

  /** Neutralise chaînes et gabarits : ce qui RESTE dans un `.tsx` est du texte JSX, donc de l'AFFICHÉ.
   *  La géométrie CSS légitime (`left: ${x}%`, `"100%"`) vit forcément dans une chaîne ou un gabarit. */
  const horsChaines = (src: string) =>
    src
      .replace(/`(?:[^`\\]|\\.)*`/g, "``")
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''");

  /** Les prédicats de la garde. Ils rendent le motif fautif, ou `null` si le texte est propre.
   *  Le COMPTAGE, lui, n'est pas détectable de façon fiable en lisant la source (un compteur peut
   *  s'appeler `nbBranches` comme n'importe quoi) : il est gardé sur le DOM RENDU, dans
   *  `tests/rendu/arbre-sans-mesure.test.tsx`, qui monte le composant et lit le texte réellement affiché. */
  const pourcentageAffiche = (src: string) => (horsChaines(src).includes("%") ? "%" : null);
  const MOTS_MESURE = ["compteur", "pourcentage", "jauge", "score", "badge", "progression", "%"];
  const motDeMesureDansLaCopie = (src: string) =>
    MOTS_MESURE.find((m) => src.toLowerCase().includes(m)) ?? null;

  it("a bien scanné tous les fichiers de l'arbre (garde non vide)", () => {
    expect(fichiers.length).toBeGreaterThanOrEqual(6);
    expect(composants.length, "aucun composant scanné = garde creuse").toBeGreaterThanOrEqual(4);
  });

  it("la COPIE D'UI ne contient aucun mot de mesure ni pourcentage", () => {
    // Tous les textes affichés vivent dans copie-arbre.ts : ici on lit les chaînes TELLES QUELLES.
    const copie = lire("render/arbre/copie-arbre.ts");
    expect(motDeMesureDansLaCopie(copie), "mesure dans un libellé affiché").toBeNull();
  });

  it("aucun POURCENTAGE affiché dans AUCUN composant de l'arbre", () => {
    for (const f of composants) {
      expect(pourcentageAffiche(lire(f)), `pourcentage affiché (hors chaîne/gabarit) dans ${f}`).toBeNull();
    }
  });

  it("[MÉTA] la garde MORD : elle attrape les mutants exacts qui lui avaient échappé", () => {
    // Les échappements RÉELS relevés par la re-revue, rejoués tels quels.
    expect(pourcentageAffiche("<p>Progression : {Math.round(x)} %</p>"), "pourcentage en texte JSX").not.toBeNull();
    expect(motDeMesureDansLaCopie('export const T = "Progression : 45 %";'), "mesure dans la copie").not.toBeNull();
    expect(motDeMesureDansLaCopie('export const T = "Ton score du jour";'), "mot de mesure dans la copie").not.toBeNull();
    // …et elle ne se déclenche PAS sur la géométrie CSS légitime, sinon elle serait désarmée par lassitude.
    expect(pourcentageAffiche("style={{ left: `${x}%`, width: \"100%\" }}"), "faux positif sur du CSS").toBeNull();
    expect(motDeMesureDansLaCopie('export const T = "Rien n\'a encore été nommé.";'), "faux positif copie").toBeNull();
  });
});

describe("accessibilité du canevas & de l'accroche", () => {
  const arbre = lire("render/arbre/ArbreInteractif.tsx");
  const css = lire("render/arbre/arbre.module.css");

  it("le canevas porte role=\"img\" et un aria-label (UX-DR-37)", () => {
    expect(arbre).toMatch(/role="img"/);
    expect(arbre).toMatch(/aria-label=\{ARIA_CANEVAS\}|aria-label="/);
  });

  it("le point d'accroche a une zone tactile ≥ 44px (var --cible-tactile)", () => {
    // La classe .accroche dimensionne le hit-target avec la cible tactile (44px), indépendant du dessin.
    expect(css).toMatch(/\.accroche\s*\{[^}]*--cible-tactile/);
  });

  it("des boutons de zoom +/− existent (clavier), doublés du pincement/molette", () => {
    expect(arbre).toMatch(/ZOOM_PLUS/);
    expect(arbre).toMatch(/ZOOM_MOINS/);
    expect(arbre).toMatch(/onWheel/);
  });
});

describe("la fiche est une ÉTIQUETTE, jamais une modale ; nom en voix utilisatrice", () => {
  const fiche = lire("render/arbre/FicheBranche.tsx");
  const css = lire("render/arbre/arbre.module.css");

  it("aucun role=\"dialog\" (pas de modale, pas de piège au focus)", () => {
    expect(fiche).not.toMatch(/role="dialog"/);
  });

  it("le nom se rend en voix UTILISATRICE (--pile-ui), jamais en police d'Anam (--pile-anam)", () => {
    // .ficheNom (le nom donné par elle) et .tourUtilisatrice (l'extrait) sont en pile-ui.
    expect(css).toMatch(/\.ficheNom\s*\{[^}]*--pile-ui/);
    expect(css).toMatch(/\.tourUtilisatrice\s*\{[^}]*--pile-ui/);
  });

  it("l'estompe de sélection est SANS FLOU (opacity, jamais blur)", () => {
    expect(css).toMatch(/\.mondeEstompe\s*\{[^}]*opacity:\s*0\.55/);
    expect(css).not.toMatch(/blur\(/);
  });
});

describe("[AC2 DUR] la défense anti-régression est RÉELLEMENT câblée dans le rendu", () => {
  // Revue 4.6 : « toute la défense anti-régression peut être supprimée sans qu'un seul test vire au rouge ».
  // Ces gardes échouent si le câblage disparaît (le COMPORTEMENT de la fonction pure est testé à part,
  // dans tests/projection-arbre.test.ts).
  const arbre = lire("render/arbre/ArbreInteractif.tsx");

  it("le composant APPELLE le réconciliateur du modèle (il ne réimplémente aucune monotonie)", () => {
    expect(arbre).toMatch(/reconcilierProjection\s*\(/);
  });

  it("les incidents détectés sont SIGNALÉS au serveur (le rendu ne peut pas journaliser lui-même, AD-7)", () => {
    expect(arbre).toMatch(/fetch\(\s*["'`]\/api\/incident/);
    // GROUPÉS en un seul envoi (re-revue) : une requête par incident faisait qu'une régression touchant
    // plusieurs branches franchissait à elle seule le plafond de la route et s'y faisait avaler.
    expect(arbre).toMatch(/JSON\.stringify\(\{\s*champs\s*\}\)/);
    expect(arbre, "les envois ne doivent plus être dans une boucle par incident").not.toMatch(
      /for\s*\(const inc of incidents\)\s*\{\s*fetch/,
    );
  });

  it("le repère du max ne vit PLUS en localStorage (ni rémanence art. 9, ni contamination entre comptes)", () => {
    expect(arbre, "le repère anti-régression est en mémoire de session").not.toMatch(/anima:arbre:max/);
    // seule la préférence d'AFFICHAGE (vue liste) reste persistée
    expect(arbre).toMatch(/anima:arbre:vueListe/);
  });

  it("une lecture INDISPONIBLE n'affiche jamais « rien n'a encore été nommé »", () => {
    expect(arbre).toMatch(/INDISPONIBLE_TITRE/);
    expect(arbre, "l'écran vide est réservé au cas non-indisponible").toMatch(/!indisponible\s*&&/);
  });
});

describe("[AC3 DUR] les accroches et le dessin partagent le MÊME repère (fin du décalage de ~100 px)", () => {
  const arbre = lire("render/arbre/ArbreInteractif.tsx");
  const css = lire("render/arbre/arbre.module.css");

  it("le carré effectif est MESURÉ (ResizeObserver) — sans quoi le viewBox letterboxé décale les boutons", () => {
    expect(arbre).toMatch(/ResizeObserver/);
    expect(arbre, "le côté du carré pilote la boîte du monde").toMatch(/cote/);
  });

  it("le SVG et les accroches vivent dans le MÊME conteneur `.monde` dimensionné en pixels", () => {
    expect(arbre).toMatch(/width:\s*boite\.cote/);
    expect(arbre).toMatch(/height:\s*boite\.cote/);
  });

  it("le zoom part du CENTRE (au coin, l'arbre fuyait hors cadre en quelques clics)", () => {
    expect(css).toMatch(/\.monde\s*\{[^}]*transform-origin:\s*50%\s*50%/);
  });
});

describe("[AC9 / plancher] clavier & gestes", () => {
  const arbre = lire("render/arbre/ArbreInteractif.tsx");

  it("le canevas est déplaçable AU CLAVIER (flèches) — le pan doigt/molette n'y suffisait pas", () => {
    expect(arbre).toMatch(/ArrowLeft/);
    expect(arbre).toMatch(/ArrowUp/);
  });

  it("`wheel` est attaché en écouteur NON PASSIF (sinon preventDefault est un no-op et la page défile)", () => {
    expect(arbre).toMatch(/addEventListener\(\s*["'`]wheel["'`][\s\S]{0,80}passive:\s*false/);
  });

  it("un GLISSER n'ouvre pas la fiche (seuil de déplacement)", () => {
    expect(arbre).toMatch(/GLISSER_MIN_PX/);
    expect(arbre).toMatch(/if\s*\(\s*aGlisse\.current\s*\)\s*return/);
  });
});

describe("[AC6/AC8] la fiche et la vue liste au clavier", () => {
  const fiche = lire("render/arbre/FicheBranche.tsx");
  const liste = lire("render/arbre/VueListe.tsx");
  const arbre = lire("render/arbre/ArbreInteractif.tsx");
  const css = lire("render/arbre/arbre.module.css");

  it("la fiche est montée avec une `key` par branche (le texte saisi ne fuit plus d'une branche à l'autre)", () => {
    expect(arbre).toMatch(/<FicheBranche[\s\S]{0,120}key=\{selectionnee\.id\}/);
  });

  it("Échap ferme la fiche et le focus revient à l'accroche", () => {
    expect(arbre).toMatch(/["'`]Escape["'`]/);
    expect(arbre).toMatch(/accroches\.current\.get\([\s\S]{0,20}\)\?\.focus\(\)/);
  });

  it("« un tap à côté ferme » est RÉELLEMENT implémenté (la couche capte les clics)", () => {
    expect(arbre).toMatch(/e\.target === e\.currentTarget/);
    expect(css, "la couche ne doit plus être transparente aux clics").not.toMatch(
      /\.ficheCouche\s*\{[^}]*pointer-events:\s*none/,
    );
  });

  it("la VUE LISTE permet réellement de renommer (le « rang égal » était faux au clavier)", () => {
    expect(liste).toMatch(/ChampRenommage/);
    expect(fiche).toMatch(/ChampRenommage/);
  });
});

describe("[R1-bis] la garde de nom du RENDU est équivalente à celle du domaine (et donc à celle de la base)", () => {
  // `render/` ne peut pas importer `lib/` (AD-7) → la classe est dupliquée. Cette garde interdit qu'elles
  // divergent : une divergence rendrait le bouton actif là où la base refuse (ou l'inverse).
  const cas = [
    "",
    "   ",
    "\t",
    "\u00a0",
    "\u200b",
    "\u2800",
    "\u3164",
    "\u00ad",
    "\u200b\u2800",
    "mes propres mots",
    "\u00a0mot",
    "日本",
    "❤",
  ];
  it("mêmes verdicts sur toute la table des cas limites", () => {
    for (const c of cas) {
      expect(nomDonne(c), `divergence render/domaine sur ${JSON.stringify(c)}`).toBe(nomValide(c));
    }
  });
  it("les caractères SANS GLYPHE ne sont un nom NI côté rendu NI côté domaine", () => {
    for (const c of ["\u200b", "\u2800", "\u3164", "\u00ad"]) {
      expect(nomDonne(c)).toBe(false);
      expect(nomValide(c)).toBe(false);
    }
    expect(nomDonne("mes propres mots")).toBe(true);
  });
});

describe("[AC4] le message source est repérable AUTREMENT que par la teinte", () => {
  const echange = lire("render/conversation/EchangeSource.tsx");
  const css = lire("render/arbre/arbre.module.css");

  it("un repère TEXTUEL accompagne le surlignage (invisible aux lecteurs d'écran sinon)", () => {
    expect(echange).toMatch(/MENTION_MOMENT/);
    expect(echange).toMatch(/estCible\s*&&/);
  });

  it("le filet accent est PERMANENT (il survit à l'estompe du fond)", () => {
    expect(css).toMatch(/\.surligne\s*\{[^}]*border-left:\s*3px solid var\(--accent\)/);
    expect(css).toMatch(/@keyframes estompeSurligne[\s\S]{0,120}background:\s*transparent/);
  });

  it("changer d'extrait RÉINITIALISE l'affichage (le verbatim de la branche précédente ne persiste pas)", () => {
    expect(echange).toMatch(/setMessages\(null\)/);
  });
});

describe("[AC10] aucune animation de croissance, aucune célébration", () => {
  const css = lire("render/arbre/arbre.module.css");
  const arbre = lire("render/arbre/ArbreInteractif.tsx");

  it("le rayonnement est STATIQUE (aucune animation/transition sur sa classe)", () => {
    const bloc = css.match(/\.rayonnement\s*\{[^}]*\}/)?.[0] ?? "";
    expect(bloc).not.toMatch(/animation|transition/);
  });

  it("aucune particule / confetti / étincelle / son dans le rendu de l'arbre", () => {
    for (const mot of ["confetti", "particule", "etincelle", "sparkle", "new Audio", "playSound"]) {
      expect(arbre.toLowerCase()).not.toContain(mot.toLowerCase());
    }
  });
});

describe("charte de l'arbre & reduced-motion", () => {
  const css = lire("render/arbre/arbre.module.css");

  it("le rayonnement est la LUEUR nacre (pas un objet-fruit), aucun brun ni or", () => {
    expect(css).toMatch(/\.rayonnement\s*\{[^}]*--lueur/);
    // aucun brun/or codé en dur (charte : arbre de nuit argenté)
    expect(css).not.toMatch(/#5c4526|#2b1f12|#0c0906|#ffb14d|gold|goldenrod/i);
  });

  it("le surlignage de l'extrait est neutralisé sous prefers-reduced-motion (fade immédiat)", () => {
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(css).toMatch(/@keyframes estompeSurligne/);
  });
});
