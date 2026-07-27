import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Story 2.2 (B6) — accessibilité de la VUE conversation (AC2/AC3/AC5/AC6), gardée par lecture du
 * source et du CSS (Vitest est en env node, sans DOM). Les gardes testent le CODE, pas la prose :
 * on retire les commentaires avant de chercher un motif.
 */

const racine = process.cwd();
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
function lire(p: string): string {
  return sansCommentaires(readFileSync(resolve(racine, p), "utf-8"));
}
/** Corps d'une règle CSS `sélecteur { … }` (première occurrence). */
function bloc(css: string, selecteur: string): string {
  const m = new RegExp(`${selecteur.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`).exec(css);
  return m ? m[1] : "";
}

const fil = lire("render/conversation/Fil.tsx");
const conversation = lire("render/conversation/Conversation.tsx");
const tourAnam = lire("render/conversation/TourAnam.tsx");
const css = lire("render/conversation/conversation.module.css");
const globals = lire("app/styles/globals.css");

describe("Annonce lecteur d'écran UNIQUE et à la fin (AC3)", () => {
  it("le fil expose une région aria-live=polite + aria-atomic (message complet en une fois)", () => {
    expect(fil).toMatch(/aria-live=["']polite["']/);
    expect(fil).toMatch(/aria-atomic=["']true["']/);
  });

  it("il n'y a QU'UNE région live (le texte qui « tape » n'est pas annoncé mot à mot)", () => {
    const occurrences = [...fil.matchAll(/aria-live/g)].length;
    expect(occurrences).toBe(1);
  });

  it("ne se repose PAS sur aria-busy (cassé sur NVDA, bug #1682063) comme déclencheur d'annonce", () => {
    expect(fil).not.toMatch(/aria-busy/);
  });

  it("l'annonce n'est écrite QU'aux terminaux (onFin/onEchec), JAMAIS pendant le flux (onMotsReveles)", () => {
    // Sinon la région aria-atomic ré-annoncerait à chaque groupe de mots (débit mot-à-mot, AC3 violé).
    const blocMots = conversation.slice(
      conversation.indexOf("onMotsReveles"),
      conversation.indexOf("onFin"),
    );
    expect(blocMots, "setAnnonce dans le flux (mot-à-mot)").not.toMatch(/setAnnonce/);
    expect(conversation, "succès non annoncé").toMatch(/onFin[\s\S]*?setAnnonce/);
    expect(conversation, "échec non annoncé (revue 2.2)").toMatch(/onEchec[\s\S]*?setAnnonce/);
  });

  it("la région d'annonce est masquée visuellement mais PAS retirée du DOM (pas display:none)", () => {
    const annonce = bloc(css, ".annonce");
    expect(annonce).toMatch(/clip-path|clip:/);
    expect(annonce).not.toMatch(/display:\s*none/);
  });
});

describe("Ordre de lecture linéaire + composeur jamais masqué (AC3/AC5)", () => {
  it("ordre DOM : apparition → fil → composeur (lecture linéaire, non spatiale)", () => {
    const a = conversation.indexOf("<ApparitionAnam");
    const f = conversation.indexOf("<Fil");
    const c = conversation.indexOf("<Composeur");
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(f);
    expect(f).toBeLessThan(c);
  });

  it("le composeur est rendu inconditionnellement (ne disparaît jamais)", () => {
    // aucun rendu conditionnel juste avant <Composeur (pas de `&&`/ternaire qui le démonterait)
    expect(conversation).toMatch(/\n\s*<Composeur /);
    expect(conversation).not.toMatch(/\?\s*<Composeur/);
    expect(conversation).not.toMatch(/&&\s*<Composeur/);
  });
});

describe("Anneau de focus, cibles, voile (AC5)", () => {
  it("l'anneau de focus est présent sur CHAQUE cible focusable et jamais neutralisé", () => {
    for (const sel of [".champ:focus-visible", ".envoi:focus-visible", ".reessayer:focus-visible"]) {
      expect(bloc(css, sel), `${sel} sans anneau`).toMatch(/outline:\s*2px/);
    }
    // ni `none`, ni `0`, ni `outline-width:0` — aucune neutralisation déguisée.
    expect(css, "outline neutralisé").not.toMatch(/outline:\s*(none|0)\b/);
    expect(css, "outline-width neutralisé").not.toMatch(/outline-width:\s*0/);
  });

  it("aucune ombre portée de texte en substitut de voile (AC5)", () => {
    expect(css).not.toMatch(/text-shadow\s*:/);
  });

  it("champ, bouton d'envoi et « Réessayer » ont une cible ≥ 44px (--cible-tactile)", () => {
    for (const sel of [".champ", ".envoi", ".reessayer"]) {
      expect(bloc(css, sel), `${sel} sans cible tactile`).toMatch(/min-(height|width):\s*var\(--cible-tactile\)/);
    }
  });
});

describe("Mots de l'utilisatrice à PLEINE VALEUR (AC1, FR-021)", () => {
  it("le tour utilisatrice utilise --texte, JAMAIS --texte-doux (pas d'extinction)", () => {
    const t = bloc(css, ".tourUtilisatrice p");
    expect(t).toMatch(/color:\s*var\(--texte\)/);
    expect(t).not.toMatch(/--texte-doux/);
  });

  it("le tour utilisatrice se distingue par un filet gauche + retrait, pas par une bulle", () => {
    const t = bloc(css, ".tourUtilisatrice");
    expect(t).toMatch(/border-left:\s*1px/);
    expect(t).toMatch(/padding-left:\s*var\(--esp-4\)/);
  });
});

describe("Apparition d'Anam : instantanée sous reduced-motion, jamais supprimée (AC6)", () => {
  it("l'apparition passe par .fondu-personnage (utilitaire global), pas une anim locale à part", () => {
    const app = lire("render/conversation/ApparitionAnam.tsx");
    expect(app).toMatch(/fondu-personnage/);
  });

  it("sous reduced-motion, .fondu-personnage devient opacité-seule (anam-fondu), jamais display:none", () => {
    const rm = /@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*\{([\s\S]*)$/.exec(globals)?.[1] ?? "";
    expect(rm).toMatch(/fondu-personnage/);
    expect(rm).toMatch(/animation-name:\s*anam-fondu/);
    // le conteneur .apparition n'est JAMAIS masqué (seul le peint cède aux aplats en -clair) :
    expect(bloc(css, ".apparition"), "conteneur apparition masqué").not.toMatch(/display:\s*none/);
  });
});

describe("Échec : registre SYSTÈME, jamais signé Anam (AC3, B4)", () => {
  it("le message d'échec est neutre (« Je n'ai pas pu répondre. Ton message est gardé. »)", () => {
    expect(tourAnam).toMatch(/Je n['’]ai pas pu répondre\. Ton message est gardé\./);
  });

  it("l'échec propose « Réessayer » et ne signe rien du nom d'Anam", () => {
    expect(tourAnam).toMatch(/Réessayer/);
    // le bloc d'échec ne doit pas prêter une phrase à « Anam » (registre système)
    const echec = tourAnam.slice(tourAnam.indexOf("echec"));
    expect(echec).not.toMatch(/Anam[  ]/);
  });
});
