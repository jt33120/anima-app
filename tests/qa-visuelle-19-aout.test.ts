import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { sansCommentaires } from "./_absence";

/**
 * qa-visuelle-19-aout.test.ts — CE QUE 5 007 TESTS N'ONT PAS VU
 *
 * Le tour de QA visuelle du 2026-08-19 a mesuré, dans un vrai navigateur, une série de défauts sur
 * lesquels TOUTE la suite était verte. Ce fichier ne rejoue pas la QA — il rend impossible le
 * retour de ceux qui sont vérifiables sans navigateur.
 *
 * ⚠️ CE QU'IL NE COUVRE PAS, ET IL FAUT LE DIRE. Une cible tactile RENDUE, une couleur COMPOSITÉE,
 * un chevauchement de barre de navigation : rien de tout ça ne se lit dans une feuille de style.
 * Ces points-là vivent dans `e2e/`, où un navigateur les mesure pour de bon. Une garde de source
 * qui prétendrait les couvrir donnerait le pire des deux mondes : verte, et fausse.
 */

const RACINE = process.cwd();
const lire = (p: string) => readFileSync(resolve(RACINE, p), "utf-8");

function fichiers(extension: string): string[] {
  const trouves: string[] = [];
  for (const dossier of ["app", "render"]) {
    for (const f of readdirSync(resolve(RACINE, dossier), {
      recursive: true,
      encoding: "utf-8",
    }) as string[]) {
      if (f.endsWith(extension)) trouves.push(`${dossier}/${f}`);
    }
  }
  return trouves;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// L'ANNEAU DE FOCUS — un seul, partout
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[QA 19/08] il n'existe qu'un seul anneau de focus", () => {
  it("[LE CŒUR] toute déclaration `outline` passe par `--bordure-forte`", () => {
    // ⚠️ JULIAN AVAIT RAISON, ET LA MESURE EN NAVIGATEUR L'A DÉMENTI À TORT. Le tour de QA a compté
    // « 14 règles, toutes identiques » — mais il ne pouvait voir que les feuilles chargées par les
    // onze écrans visités. La source en portait 41, dont HUIT divergentes : sept en `var(--texte)`
    // et une en `var(--accent)`, c'est-à-dire la couleur de l'action posée sur un anneau de focus.
    //
    // C'est exactement pourquoi cette garde-ci lit la SOURCE : un navigateur ne mesure que ce qu'il
    // a chargé, et l'écran qui porte la divergence est toujours celui qu'on n'a pas ouvert.
    const fautives: string[] = [];
    for (const f of fichiers(".module.css")) {
      for (const m of lire(f).matchAll(/outline:\s*([^;]+);/g)) {
        const valeur = m[1].trim();
        if (valeur !== "2px solid var(--bordure-forte)") fautives.push(`${f} → ${valeur}`);
      }
    }
    expect(fautives, `anneaux de focus divergents :\n${fautives.join("\n")}`).toEqual([]);
  });

  it("et il en reste réellement — la garde ne passe pas en ne mesurant rien", () => {
    const total = fichiers(".module.css").reduce(
      (n, f) => n + [...lire(f).matchAll(/outline:\s*[^;]+;/g)].length,
      0,
    );
    expect(total, "plus aucun anneau de focus dans le produit ?").toBeGreaterThan(20);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LA VOIX — le produit tutoie, sans exception
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[QA 19/08] le produit tutoie, et ne se reprend pas en cours de phrase", () => {
  it("[LE CŒUR] aucun vouvoiement dans une chaîne affichée", () => {
    // Le défaut mesuré tenait dans UNE phrase de `/memoire` : « Voici ce qu'Anam a retenu de VOS
    // échanges, dans ses mots. TU peux corriger… » — les deux registres à six mots d'écart. Ce
    // n'est pas une faute de style : c'est le moment où le produit cesse d'être quelqu'un.
    //
    // On lit les chaînes, jamais les commentaires : treize occurrences légitimes vivent dans des
    // explications et une expression régulière, et une garde qui les compterait serait abandonnée
    // au bout de deux jours.
    const fautives: string[] = [];
    const sources = [
      ...fichiers(".tsx"),
      ...fichiers(".ts"),
      ...(readdirSync(resolve(RACINE, "lib/domain"), { encoding: "utf-8" }) as string[])
        .filter((f) => f.endsWith(".ts"))
        .map((f) => `lib/domain/${f}`),
    ];
    for (const f of sources) {
      if (f.includes(".test.")) continue;
      const src = sansCommentaires(lire(f));
      for (const m of src.matchAll(/["'`]([^"'`\n]{12,})["'`]/g)) {
        const texte = m[1];
        // On ne garde que ce qui ressemble à de la PROSE. Sans ce filtre, la garde relève des
        // expressions régulières (`/\b(ton|ta|votre) (avenir|futur)\b/`) et des fragments de code
        // pris entre deux guillemets sur des lignes différentes — du bruit qui la ferait abandonner.
        if (/[\\/{}<>|]/.test(texte)) continue;
        // ⚠️ « rendez-VOUS » N'EST PAS UN VOUVOIEMENT. Le trait d'union est une frontière de mot :
        // la première version de cette garde a accusé « heure de ton rendez-vous quotidien ».
        if (/(?<!-)\b(vous|vos|votre)\b/i.test(texte)) fautives.push(`${f} → « ${texte.slice(0, 90)} »`);
      }
    }
    expect(fautives, `vouvoiement affiché :\n${fautives.join("\n")}`).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LA PORTE DE SECOURS — une cible, pas une hauteur
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[QA 19/08] la porte de secours est une cible dans les DEUX dimensions", () => {
  it("[LE CŒUR] le lien du pied de halte borne sa largeur autant que sa hauteur", () => {
    // Mesuré à 27,7 px de LARGE — la largeur du mot « Aide ». `min-height` était bien là depuis le
    // début, et il ne suffisait pas : WCAG 2.5.8 mesure une cible, pas une bande.
    const css = lire("render/pied-halte.module.css");
    const bloc = css.match(/\.lien\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(bloc, "`.lien` a perdu sa hauteur minimale").toMatch(
      /min-height:\s*var\(--cible-tactile\)/,
    );
    expect(bloc, "`.lien` ne borne plus sa largeur — le défaut du 19/08").toMatch(
      /min-width:\s*var\(--cible-tactile\)/,
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// L'ACCENT, LA RACINE, ET LA VOIX DES TITRES
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[QA 19/08] trois règles de la charte qui s'étaient perdues", () => {
  it("l'étiquette de mise en avant n'est plus peinte en accent — elle n'est pas cliquable", () => {
    // « L'accent est la couleur de l'action, et seulement de l'action. » Peindre une étiquette
    // inerte en accent promet un lien qui n'existe pas ET affaiblit le seul signal qui désigne ce
    // qu'on peut toucher : deux dégâts pour un seul écart.
    const bloc = lire("render/accueil/accueil.module.css").match(/\.mention\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(bloc, "l'étiquette de mise en avant est redevenue accent").not.toMatch(
      /color:\s*var\(--accent\)/,
    );
  });

  it("la racine du document porte le fond de nuit, jamais le noir pur", () => {
    // `color-scheme: dark` seul peint la racine en noir pur — visible au rebond de défilement.
    // La charte l'interdit nommément : « jamais un noir pur (qui ferait ‹ écran éteint ›) ».
    const bloc = lire("app/styles/globals.css").match(/\bhtml\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(bloc, "`html` ne pose plus de fond : la racine repasse en noir pur").toMatch(
      /background:\s*var\(--fond\)/,
    );
  });

  it("les titres de cartes parlent d'une seule voix", () => {
    // `t-corps-fort` est une classe d'INTERFACE (Inter). Elle mettait deux titres de cartes en
    // grasse sans-serif à trois centimètres d'un titre en Fraunces, sur le même écran. Un titre de
    // carte est du contenu : il prend la voix d'Anam.
    const src = sansCommentaires(lire("render/accueil/Bibliotheque.tsx"));
    expect(src, "un titre de carte est repassé dans la police d'interface").not.toMatch(
      /<h2[^>]*t-corps-fort/,
    );
  });
});
