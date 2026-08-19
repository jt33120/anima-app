import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sansCommentaires } from "./_absence";
import { HORS_HALTE } from "@/lib/domain/pied-halte";

/**
 * entrer-information.test.ts — INFORMER AVANT DE COLLECTER (RGPD art. 13 · QA tour 2).
 *
 * ══ CE QUI ÉTAIT EN JEU ═════════════════════════════════════════════════════════════════════════
 *
 * Mesuré dans un navigateur, sur un contexte vierge : `/entrer` ne contenait **aucun `href`**.
 * `document.querySelectorAll("a").length === 0`. Pas un lien, pas une ligne sur ce qui est fait des
 * données — et c'est l'écran qui demande une adresse e-mail.
 *
 * L'article 13 exige d'informer AU MOMENT où la donnée est obtenue. Pas après le consentement, pas
 * sur un écran qu'on atteindra plus tard : à la collecte.
 *
 * ══ CE QUE CE TEST NE REMET PAS EN CAUSE ════════════════════════════════════════════════════════
 *
 * `HORS_HALTE` écarte délibérément `PiedHalte` de cet écran — « avant toute session — il n'y a
 * encore ni contenu ni interlocuteur ». Cette décision tient, pour ses DEUX raisons : la mention IA
 * (art. 50) n'est pas due avant qu'un modèle ait produit quoi que ce soit, et la porte de secours
 * (FR-077) n'a personne à secourir. L'article 13 est une TROISIÈME question, à laquelle rien ne
 * répondait. Ce test garde la réponse à celle-là, et vérifie que l'autre décision reste écrite.
 */

const racine = process.cwd();
const page = sansCommentaires(
  readFileSync(resolve(racine, "app/(auth)/entrer/page.tsx"), "utf-8"),
);

describe("[art. 13] `/entrer` informe avant de demander une adresse", () => {
  it("porte un lien vers les conditions et vers l'aide", () => {
    expect(page, "le document contractuel doit être atteignable AVANT la collecte").toMatch(
      /href="\/cgu"/,
    );
    expect(page).toMatch(/href="\/aide"/);
  });

  it("⚠️ et ces liens sont sur le chemin NOMINAL, pas dans une branche de refus", () => {
    // LA FAMILLE DE DÉFAUTS DU DÉPÔT : un `href` présent dans le source peut ne se rendre que sur
    // un chemin qu'on n'emprunte presque jamais. Cette page a DEUX branches — le refus d'âge, et
    // tout le reste. Le formulaire de collecte ne vit que dans la seconde ; l'information due doit
    // vivre exactement là où la collecte a lieu. On l'ancre donc sur `FormulaireEntree`.
    // ⚠️ ANCRE SUR LA BALISE, PAS SUR SA FORME EXACTE. Écrite `"<FormulaireEntree />"`, elle a
    // rougi le jour où le composant a reçu une propriété — un changement qui ne touche en rien
    // l'information due. Ce qu'on mesure est la POSITION du formulaire, pas sa signature.
    const iFormulaire = page.indexOf("<FormulaireEntree");
    const iCgu = page.indexOf('href="/cgu"');
    expect(iFormulaire, "le formulaire de collecte a disparu").toBeGreaterThan(-1);
    expect(iCgu, "aucun lien vers les conditions").toBeGreaterThan(-1);
    expect(
      iCgu,
      "l'information doit accompagner la collecte, pas la branche où l'on refuse quelqu'un",
    ).toBeGreaterThan(iFormulaire);
  });

  it("la décision d'écarter le PIED de cet écran reste écrite et motivée", () => {
    // On ne remplace pas une décision documentée par un oubli : si quelqu'un retire `/entrer` de
    // `HORS_HALTE`, c'est que l'inventaire des haltes a changé d'avis — et il devra le dire.
    expect(HORS_HALTE["(auth)/entrer"], "`/entrer` doit rester un hors-halte MOTIVÉ").toBeTruthy();
    expect(page, "cet écran ne rend pas `PiedHalte` — c'est délibéré").not.toMatch(/<PiedHalte/);
  });
});
