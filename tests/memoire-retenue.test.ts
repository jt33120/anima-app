import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CORRECTION_LONGUEUR_MAX,
  FENETRE_ANNULATION_MS,
  estAffichable,
  validerCorrection,
} from "@/lib/domain/memoire-retenue";
import * as COPIE from "@/lib/domain/copie-memoire";
import { chercherInterdits } from "@/lib/domain/lexique-interdit";
import { chercherPredictions } from "@/lib/domain/marqueurs-prediction";

/**
 * Story 6.5 (T2) — LE DOMAINE DE « CE QU'ANAM RETIENT ».
 *
 * La base était déjà là (4.2) ; ce qui manquait tient en trois règles : ce qui s'affiche, ce qu'une
 * correction a le droit d'être, et combien de temps dure une annulation.
 */

describe("[6.5/AC1] un tombstone ne s'affiche pas, et rien de vivant n'est vide", () => {
  it("les deux statuts vivants s'affichent", () => {
    expect(estAffichable("actif", "elle aime la mer")).toBe(true);
    expect(estAffichable("corrige", "elle aime la montagne")).toBe(true);
  });

  it("[LE CŒUR] un tombstone ne s'affiche JAMAIS, quoi qu'il porte", () => {
    // ⚠️ Mutation-cible : accepter `supprime`. La ligne reviendrait à l'écran avec un contenu vide —
    // et une ligne vide dans cette liste-ci se lit comme un fait effacé qui serait revenu, soit
    // exactement l'inverse de ce qu'on montre.
    expect(estAffichable("supprime", "")).toBe(false);
    expect(estAffichable("supprime", "un reste")).toBe(false);
  });

  it("un contenu qui n'est QUE des espaces ne s'affiche pas non plus", () => {
    // La contrainte de 0056 raisonne sur `= ''` ; le domaine est plus strict, et il faut qu'il le
    // soit — une ligne de trois espaces passe la base et n'affiche rien.
    expect(estAffichable("actif", "   ")).toBe(false);
    expect(estAffichable("actif", "\n\t")).toBe(false);
  });
});

describe("[6.5/AC2] ce qu'une correction a le droit d'être", () => {
  it("une phrase ordinaire passe, et elle est NETTOYÉE", () => {
    expect(validerCorrection("  elle a changé de métier  ", "ancien")).toEqual({
      ok: true,
      contenu: "elle a changé de métier",
    });
  });

  it("[LE CŒUR] une correction VIDE est refusée — ce serait une suppression déguisée", () => {
    // ⚠️ C'est le trou mesuré dans 4.2 avant d'écrire cette story : la base acceptait
    // `('utilisatrice','corrige','')` et fabriquait une ligne ni affichable ni tombstone. 0056 le
    // refuse désormais ; ce refus-ci est là pour le DIRE plutôt que de laisser remonter une erreur
    // Postgres. Les deux gardes ne se couvrent pas : celle-ci explique, celle de la base empêche.
    expect(validerCorrection("", "ancien")).toEqual({ ok: false, refus: "vide" });
    expect(validerCorrection("   \n ", "ancien")).toEqual({ ok: false, refus: "vide" });
  });

  it("[BORNE] la longueur maximale est atteignable, et un caractère de plus est refusé", () => {
    const pile = "a".repeat(CORRECTION_LONGUEUR_MAX);
    expect(validerCorrection(pile, "ancien").ok).toBe(true);
    expect(validerCorrection(pile + "a", "ancien")).toEqual({ ok: false, refus: "trop_longue" });
  });

  it("[LE CŒUR] réécrire à l'identique n'est PAS une correction", () => {
    // ⚠️ Ce n'est pas de la coquetterie : enregistrer changerait l'`origine` du fait, donc le
    // soustrairait à toute ré-extraction future — sans que rien n'ait changé de son sens. Un geste
    // sans effet visible qui a un effet permanent invisible est exactement ce qu'il ne faut pas.
    expect(validerCorrection("elle aime la mer", "elle aime la mer")).toEqual({
      ok: false,
      refus: "inchangee",
    });
    // …et les espaces de bord ne suffisent pas à en faire une correction.
    expect(validerCorrection("  elle aime la mer ", "elle aime la mer").ok).toBe(false);
  });
});

describe("[6.5/AC3] la fenêtre d'annulation, et sa copie côté rendu", () => {
  it("elle vaut dix secondes, au littéral de l'AC", () => {
    expect(FENETRE_ANNULATION_MS).toBe(10_000);
  });

  it("[LE CŒUR] le littéral RECOPIÉ dans `render/` est le MÊME", () => {
    // ⚠️ `render/` ne peut pas importer `lib/domain` (AD-7) : la valeur y est donc recopiée. Le prix
    // de la frontière est une divergence possible, et le seul moyen de le payer sans divergence est
    // de la MESURER. Sans cette garde, changer la fenêtre ici laisserait l'écran sur l'ancienne.
    const src = readFileSync(resolve(process.cwd(), "render/memoire/Memoire.tsx"), "utf-8");
    const m = /const FENETRE_ANNULATION_MS_CLIENT = ([\d_]+);/.exec(src);
    expect(m, "le littéral recopié a disparu ou changé de nom").not.toBeNull();
    expect(Number(m![1].replace(/_/g, ""))).toBe(FENETRE_ANNULATION_MS);
  });
});

describe("[6.5/D2 DUR] la halte ne redirige PAS une personne qui a révoqué", () => {
  const page = readFileSync(resolve(process.cwd(), "app/memoire/page.tsx"), "utf-8");
  const sansCommentaires = page.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("[LE CŒUR] aucun `redirect` sur `revoque` dans cette page-là", () => {
    // ⚠️ CETTE GARDE EXISTE PARCE QUE LA DÉCISION EST CONTRE-INTUITIVE, et qu'elle sera « corrigée »
    // de bonne foi. Les six autres haltes redirigent une personne qui a révoqué ; celle-ci ne le fait
    // pas, et un balayage d'harmonisation la remettrait dans le rang en trois secondes.
    //
    // Ce qui serait perdu : la Story 4.2 a construit la base pour qu'une SUPPRESSION survive à la
    // révocation (droit à l'effacement, art. 17) et qu'une CORRECTION soit refusée. Rediriger rendrait
    // toute cette construction inatteignable au moment exact où elle sert — ON NE PEUT PAS SUPPRIMER
    // CE QU'ON NE VOIT PAS.
    expect(
      /revoque[\s\S]{0,80}redirect/.test(sansCommentaires),
      "la halte redirige une personne qui a révoqué : elle ne peut plus exercer son droit à l'effacement",
    ).toBe(false);
  });

  it("[ANTI-VACUITÉ] les TROIS autres gardes, elles, sont bien là", () => {
    // Sans ce contrôle, la garde ci-dessus passerait aussi sur une page qui ne garde RIEN — et une
    // mineure barrée verrait ses faits.
    for (const etape of ["barre", "mineur", "naissance", "consentement"]) {
      expect(
        new RegExp(`"${etape}"`).test(sansCommentaires),
        `la garde « ${etape} » a disparu de la halte`,
      ).toBe(true);
    }
  });

  it("[LE CŒUR] « Supprimer » n'est JAMAIS conditionné dans le rendu", () => {
    // Le pendant côté écran : `correctionPossible` ne doit gouverner que la correction. Le rendu
    // monté l'éprouve aussi (`tests/rendu/memoire.test.tsx`) ; ceci attrape la forme source, où le
    // geste serait de mettre les deux boutons derrière le même `&&`.
    const rendu = readFileSync(resolve(process.cwd(), "render/memoire/Memoire.tsx"), "utf-8");
    const apresSupprimer = rendu.slice(rendu.indexOf("p.copie.supprimer}"));
    expect(
      /correctionPossible/.test(rendu.slice(0, rendu.indexOf("p.copie.supprimer}")).split("p.copie.corriger}").pop() ?? ""),
      "le bouton de suppression est passé derrière la garde de correction",
    ).toBe(false);
    expect(apresSupprimer.length, "le bouton de suppression a disparu").toBeGreaterThan(0);
  });
});

describe("[6.5] la copie — registre, détecteurs, et ce qu'elle doit dire", () => {
  const textes = Object.entries(COPIE).filter(([, v]) => typeof v === "string") as [string, string][];

  it("[AC5] l'état vide est celui de l'énoncé, au mot près", () => {
    expect(COPIE.ETAT_VIDE).toBe("Anam ne retient encore rien de précis sur toi.");
  });

  it.each(textes)("« %s » passe le lexique interdit et les marqueurs de prédiction", (nom, texte) => {
    expect(chercherInterdits(texte), `${nom} porte un mot interdit`).toEqual([]);
    expect(chercherPredictions(texte), `${nom} porte un marqueur de prédiction`).toEqual([]);
  });

  it.each(textes)("[FR-031] « %s » ne chiffre rien", (nom, texte) => {
    // Un écran qui montre une base de données est l'endroit NATUREL où s'écrit « 12 faits retenus ».
    expect(/\d/.test(texte), `${nom} : « ${texte} » porte un chiffre`).toBe(false);
  });

  it.each(textes)("[registre] « %s » ne reproche rien et ne félicite personne", (nom, texte) => {
    // ⚠️ Le registre de cet écran n'est PAS celui d'Anam : c'est le produit qui parle. Une phrase
    // chaleureuse ferait passer un registre d'intimité sur un écran dont l'objet est l'exercice d'un
    // droit ; une phrase de reproche transformerait une correction en aveu d'erreur.
    for (const interdit of [/\bbravo\b/i, /\btu aurais d[ûu]\b/i, /\berreur de ta part\b/i, /\battention\b/i, /\bd[ée]sol[ée]/i]) {
      expect(interdit.test(texte), `${nom} : « ${texte} » correspond à ${interdit}`).toBe(false);
    }
  });

  it("[LE CŒUR / D2] le refus après révocation PROMET que supprimer restera possible", () => {
    // ⚠️ C'est la seule phrase du produit qui dit à quelqu'un qui a tout retiré qu'il lui reste un
    // droit. Sans elle, le bouton « Corriger » disparaîtrait sans explication et l'écran ressemblerait
    // à une panne — or l'effacement, lui, marche toujours, et c'est ce qu'elle est venue chercher.
    expect(COPIE.CORRECTION_APRES_REVOCATION).toMatch(/supprimer/i);
    expect(COPIE.CORRECTION_APRES_REVOCATION).toMatch(/toujours|restera/i);
  });

  it("[LE CŒUR] l'introduction dit que le JOURNAL n'est pas touché", () => {
    // ⚠️ Sans cette phrase, quelqu'un qui supprime tout croirait avoir effacé ses messages. Les trois
    // couches de mémoire (AD-8) sont invisibles pour elle : seul ce texte lui dit laquelle elle
    // manipule.
    expect(COPIE.INTRODUCTION).toMatch(/messages/i);
    expect(COPIE.INTRODUCTION).toMatch(/ne bougent pas|ailleurs/i);
  });

  it("[ANTI-VACUITÉ] les détecteurs mordent VRAIMENT sur une copie fautive", () => {
    expect(chercherInterdits("Anam prend soin de ta guérison").length).toBeGreaterThan(0);
    expect(/\d/.test("12 faits retenus")).toBe(true);
    expect(textes.length, "la copie est vide, donc tous les balayages ci-dessus le sont").toBeGreaterThan(10);
  });
});
