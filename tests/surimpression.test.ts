import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { voile, couleursNuit } from "@/app/styles/tokens";
import { ratioContraste } from "@/app/styles/contraste";

/**
 * Story 1.8 — la SURIMPRESSION PERSISTANTE, gardée par lecture du CSS et du composant.
 * On teste ce qui est PEINT/RENDU, pas la prose (commentaires retirés avant de matcher) :
 *  - présence FLOTTANTE, sans bord ni fond barré (lisibilité tenue par le voile, pas une barre) ;
 *  - le voile consomme réellement les tokens ET garantit WCAG AA par compositing (pire cas blanc) ;
 *  - la porte de secours = un mot discret (texte-doux, meta 13px, jamais rouge/alerte/majuscule),
 *    anneau de focus jamais supprimé ;
 *  - la mention IA jamais réduite sous 13px.
 */

const racine = process.cwd();
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const css = sansCommentaires(readFileSync(resolve(racine, "render/monde.module.css"), "utf-8"));
const composant = sansCommentaires(readFileSync(resolve(racine, "render/surimpression.tsx"), "utf-8"));
const scene = sansCommentaires(readFileSync(resolve(racine, "render/scene-dom.tsx"), "utf-8"));

/** Isole le corps d'une règle `.selecteur { … }` (première occurrence, jusqu'au premier `}`). */
function bloc(selecteur: string): string {
  const m = new RegExp(`\\.${selecteur}\\s*\\{([\\s\\S]*?)\\}`).exec(css);
  if (!m) throw new Error(`.${selecteur} introuvable dans monde.module.css`);
  return m[1];
}

/** Concatène le corps de TOUTES les règles `.selecteur { … }` (overrides média inclus). */
function tousBlocs(selecteur: string): string {
  const re = new RegExp(`\\.${selecteur}\\s*\\{([\\s\\S]*?)\\}`, "g");
  let m: RegExpExecArray | null;
  let out = "";
  while ((m = re.exec(css))) out += m[1] + "\n";
  return out;
}

/** Composite un premier plan (alpha) sur un fond opaque → hex #RRGGBB (repris de voile.test.ts). */
function composer(fgHex: string, alpha: number, bgHex: string): string {
  const canaux = (h: string) => {
    const n = parseInt(h.replace("#", ""), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
  };
  const [fr, fg, fb] = canaux(fgHex);
  const [br, bg, bb] = canaux(bgHex);
  const mix = (f: number, b: number) => Math.round(alpha * f + (1 - alpha) * b);
  const hh = (v: number) => v.toString(16).padStart(2, "0");
  return `#${hh(mix(fr, br))}${hh(mix(fg, bg))}${hh(mix(fb, bb))}`;
}

describe("Surimpression — flottante, SANS BORD ni fond barré (AC1)", () => {
  it("AUCUNE règle .surimpression/.surimpressionVoile (média inclus) ne pose fond --surface, bordure (même -bottom) ni ombre de barre", () => {
    // On concatène TOUS les blocs, override desktop compris, et on attrape border/-top/-bottom
    // (revue 1.8, trouvaille [5] : la garde ne voyait que `border:` sur le 1er bloc).
    const b = tousBlocs("surimpression") + tousBlocs("surimpressionVoile");
    expect(b).not.toMatch(/background:\s*var\(--surface/);
    expect(b).not.toMatch(/border(-[a-z]+)?\s*:/);
    expect(b).not.toMatch(/box-shadow/);
  });

  it("le conteneur ne capte pas le pointeur (la scène reste cliquable dessous)", () => {
    expect(bloc("surimpression")).toMatch(/pointer-events:\s*none/);
  });

  it("aucun des éléments de texte ne pose de bordure (mention IA / porte de secours)", () => {
    expect(bloc("mentionIa")).not.toMatch(/border(-[a-z]+)?\s*:/);
    expect(bloc("porteSecours")).not.toMatch(/border(-[a-z]+)?\s*:/);
  });
});

describe("Surimpression — lisibilité tenue par le VOILE, pas une bande (AC1/AC2)", () => {
  it("le voile consomme réellement les tokens et se DISSOUT (pas un aplat fermé)", () => {
    const v = bloc("surimpressionVoile");
    expect(v).toMatch(/var\(--voile-couleur\)/);
    expect(v).toMatch(/var\(--voile-opacite-texte-courant\)/);
    expect(v).toMatch(/transparent/); // il se fond, ce n'est pas une barre pleine
  });

  it("l'opacité du voile reste la source de vérité (tokens.ts)", () => {
    expect(voile.opaciteTexteCourant).toBe(0.85);
  });

  it("la densité peinte garantit AA (≥ 4,5:1) même sur l'image la plus claire (blanc)", () => {
    const sousVoile = composer(couleursNuit.fond, voile.opaciteTexteCourant, "#FFFFFF");
    // texte-doux (porte de secours + mention IA) ET texte, tous deux au-dessus du voile.
    expect(ratioContraste(sousVoile, couleursNuit["texte-doux"])).toBeGreaterThanOrEqual(4.5);
    expect(ratioContraste(sousVoile, couleursNuit.texte)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("Porte de secours — un mot discret « Aide », jamais alarmant (AC4)", () => {
  const b = bloc("porteSecours");

  it("est en texte-doux, jamais rouge / --alerte", () => {
    expect(b).toMatch(/color:\s*var\(--texte-doux\)/);
    expect(b).not.toMatch(/var\(--alerte\)/);
    expect(b).not.toMatch(/red/);
  });

  it("jamais en majuscule (text-transform interdit)", () => {
    expect(b).toMatch(/text-transform:\s*none/);
    expect(css).not.toMatch(/\.porteSecours[\s\S]*?text-transform:\s*uppercase/);
  });

  it("ne réduit jamais la taille (repose sur t-meta = 13px, aucun font-size local)", () => {
    expect(b).not.toMatch(/font-size/);
    expect(bloc("mentionIa")).not.toMatch(/font-size/);
  });

  it("anneau de focus visible, jamais supprimé", () => {
    expect(css).toMatch(/\.porteSecours:focus-visible[\s\S]*?outline:\s*2px/);
    expect(b).not.toMatch(/outline:\s*none/);
  });
});

describe("Surimpression — cible tactile & survol (AC2/AC4, revue 1.8 [3]/[6])", () => {
  it("la mention IA a la MÊME cible tactile que la porte de secours (44px)", () => {
    // Lien à enjeu légal (art. 50) : ne doit pas être plus dur à toucher que « Aide ».
    expect(bloc("mentionIa")).toMatch(/min-height:\s*var\(--cible-tactile\)/);
    expect(bloc("porteSecours")).toMatch(/min-height:\s*var\(--cible-tactile\)/);
  });

  it("le survol agit réellement sur le texte : le span t-meta hérite la couleur du lien", () => {
    // Sans cela, .t-meta figerait la couleur et le :hover posé sur le <a> serait inerte.
    expect(css).toMatch(/\.mentionIa\s+\.t-meta[\s\S]*?color:\s*inherit/);
  });
});

describe("Surimpression — le RENDU obéit au MODÈLE (art. 50 / AD-7, revue 1.8 [1])", () => {
  it("la mention IA n'est rendue que SOUS condition du modèle (jamais inconditionnelle)", () => {
    // Un rendu inconditionnel de « Anam est une IA » (sur toutes les régions) viole AC2/NFR-007
    // et AD-7 (le rendu doit obéir au modèle). Ce garde attrape la mutation-échappée.
    expect(composant).toMatch(/modele\.mentionIA\s*&&/);
  });

  it("le signe d'Anam n'est rendu que SOUS condition du modèle", () => {
    expect(composant).toMatch(/modele\.signeAnam\s*&&/);
  });

  it("la porte de secours est bien rendue (son inconditionnalité est garantie par le type porteSecours: true + le test modèle)", () => {
    expect(composant).toMatch(/className={s\.porteSecours}/);
    // Garde-fou de proximité : aucune condition de modèle dans les ~80 caractères qui précèdent
    // directement le <Link porteSecours> (le `&&` de la mention est bien plus haut).
    const i = composant.indexOf("s.porteSecours");
    expect(composant.slice(Math.max(0, i - 80), i)).not.toMatch(/&&/);
  });
});

describe("Câblage scène (AC3, revue 1.8 [4]) — surimpression en tête, hors des régions inert", () => {
  it("<Surimpression> est rendue AVANT la première région ET avant tout inert", () => {
    const iSur = scene.indexOf("<Surimpression");
    const iRegions = scene.indexOf("REGIONS.map");
    const iInert = scene.indexOf("inert");
    expect(iSur).toBeGreaterThan(-1);
    expect(iInert).toBeGreaterThan(-1);
    expect(iSur).toBeLessThan(iRegions);
    expect(iSur).toBeLessThan(iInert);
  });

  it("elle est enfant du <main className={s.monde}> (couche constante de la scène)", () => {
    const iMonde = scene.indexOf("s.monde");
    expect(iMonde).toBeGreaterThan(-1);
    expect(scene.indexOf("<Surimpression")).toBeGreaterThan(iMonde);
  });

  it("le modèle de la surimpression est câblé depuis lib/scene (surimpressionPour)", () => {
    // Story 3.5 : la fonction prend un second argument (`abonnementGerable`) — le MODÈLE décide de la
    // présence du chemin « L'abonnement », le rendu ne dérive rien (AD-7). On matche donc l'appel avec
    // sa région en premier argument, sans figer la liste des suivants.
    expect(scene).toMatch(/surimpressionPour\(\s*region\b/);
  });
});

describe("Surimpression — le composant porte les bons éléments dans le bon ordre", () => {
  it("mention IA et porte de secours utilisent t-meta (13px), jamais t-surtitre (12px)", () => {
    expect(composant).toMatch(/t-meta/);
    expect(composant).not.toMatch(/t-surtitre/);
  });

  it("les deux liens visent la page d'aide (source unique URL_AIDE)", () => {
    expect(composant).toMatch(/URL_AIDE/);
    expect(composant).toMatch(/Aide/);
    expect(composant).toMatch(/Anam est une IA/);
  });

  it("le signe d'Anam est décoratif (aria-hidden) — la transparence passe par la mention texte", () => {
    expect(composant).toMatch(/aria-hidden/);
  });
});
