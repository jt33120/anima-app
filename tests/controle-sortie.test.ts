import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  absorberSousControle,
  terminerControle,
  etatControleInitial,
  codeManquement,
  type EtatControle,
  type ModeControle,
} from "@/lib/domain/controle-sortie";
import { absorberDelta, etatTroncatureInitial } from "@/lib/domain/voix-anam";
import { chercherInterdits } from "@/lib/domain/lexique-interdit";
import { sansCommentaires } from "./_absence";

/**
 * controle-sortie.test.ts — LE LEXIQUE APPLIQUÉ À LA VOIX VIVANTE (QA tour 1, T29 / T5).
 *
 * Les deux phrases de référence viennent d'une vraie session, pas d'un cas inventé :
 *   « Je suis là si tu veux écrire encore. Prends soin de toi. »
 *   « Je suis contente de l'entendre. Tu veux en parler un peu plus, ou on laisse filer ? »
 */

/** Fait passer un texte par le contrôle, découpé en fragments — comme le fait un vrai flux. */
function diffuser(texte: string, mode: ModeControle, taille = 7) {
  let etat: EtatControle = etatControleInitial();
  let sortie = "";
  const manquements: string[] = [];
  for (let i = 0; i < texte.length; i += taille) {
    const r = absorberSousControle(etat, texte.slice(i, i + taille), mode);
    etat = r.etat;
    sortie += r.aEmettre;
    manquements.push(...r.manquements);
  }
  const f = terminerControle(etat, mode);
  sortie += f.aEmettre;
  manquements.push(...f.manquements);
  return { sortie, manquements, coupePar: f.etat.coupePar };
}

describe("[T29 / T5] les deux phrases que la QA a vraiment reçues", () => {
  it("[LE CŒUR] « Prends soin de toi. » est retenue — et la phrase d'avant passe", () => {
    // Mutation-cible : ne pas appeler le contrôle du tout. C'est l'état d'AVANT ce module, et il
    // laissait `chercherInterdits` sans aucun appelant en production pendant que la fonction, elle,
    // attrapait parfaitement cette phrase — elle est dans son propre contrôle positif.
    const r = diffuser("Je suis là si tu veux écrire encore. Prends soin de toi.", "coupe");
    expect(r.sortie).toBe("Je suis là si tu veux écrire encore.");
    expect(r.manquements).toEqual(["soigner"]);
  });

  it("« Je suis contente de l'entendre. » coupe TOUT — et c'est le bon comportement", () => {
    // Elle est la PREMIÈRE phrase : il ne reste rien. La route doit alors emprunter son chemin
    // d'échec plutôt que d'afficher une bulle vide — c'est ce que prouve `flux-anam.test.ts`.
    //
    // Cette revendication d'état intérieur arrive deux écrans après avoir fait cocher « elle n'a ni
    // conscience ni intuition ». Sur un produit qui en fait une case à cocher séparée, c'est la
    // contradiction qui coûte le plus cher.
    const r = diffuser("Je suis contente de l'entendre. Tu veux en parler un peu plus ?", "coupe");
    expect(r.sortie).toBe("");
    expect(r.coupePar).toBe("affect");
  });

  it("[CONTRÔLE POSITIF] une réponse propre traverse INTACTE", () => {
    // ⚠️ Sans lui, un contrôle qui couperait TOUJOURS passerait la moitié de ce fichier. Un Anam muet
    // est aussi cassé qu'un Anam qui dit « prends soin de toi », et beaucoup plus discret.
    const propre =
      "J'ai lu jusqu'au bout. Tu décris une lassitude qui n'a pas besoin d'urgence pour être réelle. " +
      "Est-ce qu'il y a une personne à qui tu pourrais montrer ce texte tel quel ?";
    const r = diffuser(propre, "coupe");
    expect(r.sortie).toBe(propre);
    expect(r.manquements).toEqual([]);
    expect(chercherInterdits(propre), "le témoin du témoin").toEqual([]);
  });
});

describe("[AD-15 / AD-17] en détresse, on OBSERVE — on ne coupe jamais", () => {
  const detresse =
    "J'entends que tu traverses un moment où tout te semble vide. " +
    "Prends soin de toi. " +
    "Le 3114 est là pour exactement ce moment.";

  it("[LE CŒUR] la réponse passe ENTIÈRE, orientation comprise", () => {
    // ⚠️ CE TEST EST UNE GARDE DE SÉCURITÉ, PAS UNE GARDE DE VOIX. Couper ici retirerait le 3114 —
    // le numéro arrive APRÈS la phrase fautive. Aucun manquement de vocabulaire ne vaut ça.
    // Mutation-cible : passer `"coupe"` au lieu de `"observe"` dans la route quand `niveauSecurite ≥ 1`.
    const r = diffuser(detresse, "observe");
    expect(r.sortie).toBe(detresse);
    expect(r.sortie, "l'orientation est là").toContain("3114");
    expect(r.coupePar).toBeNull();
  });

  it("…et le manquement est quand même CONSTATÉ", () => {
    // Observer sans rien dire serait ne pas observer. Le manquement remonte pour être journalisé.
    expect(diffuser(detresse, "observe").manquements).toEqual(["soigner"]);
  });

  it("le même texte, hors détresse, EST coupé — les deux modes ne font pas la même chose", () => {
    const r = diffuser(detresse, "coupe");
    expect(r.sortie).toBe("J'entends que tu traverses un moment où tout te semble vide.");
    expect(r.sortie).not.toContain("3114");
  });
});

describe("la mécanique de flux : rien ne part avant d'avoir été relu", () => {
  it("[LE CŒUR] une phrase INCOMPLÈTE n'est jamais émise", () => {
    // Le fondement du module : on ne peut pas retirer ce qui est parti, donc on ne laisse partir que
    // ce qu'on a pu lire en entier. Mutation-cible : émettre la queue non ponctuée au fil de l'eau.
    let etat = etatControleInitial();
    const r = absorberSousControle(etat, "Prends soin", "coupe");
    expect(r.aEmettre, "« Prends soin » n'est pas encore une phrase").toBe("");
    etat = r.etat;
    const r2 = absorberSousControle(etat, " de toi.", "coupe");
    expect(r2.aEmettre, "…et une fois close, elle est refusée").toBe("");
    expect(r2.manquements).toEqual(["soigner"]);
  });

  it("[LE CŒUR] la queue SANS ponctuation finale est rendue par `terminerControle`", () => {
    // ⚠️ Mutation-cible : supprimer `terminerControle`. Toute réponse qui ne finit pas par un point —
    // et un modèle coupé par une limite de jetons finit rarement par un point — perdrait sa dernière
    // phrase, en silence. La suite resterait verte sans ce test.
    const r = diffuser("Une phrase close. Et une queue sans point", "coupe");
    expect(r.sortie).toBe("Une phrase close. Et une queue sans point");
  });

  it("la queue fautive est refusée par `terminerControle` aussi", () => {
    const r = diffuser("Une phrase close. Prends soin de toi", "coupe");
    expect(r.sortie).toBe("Une phrase close.");
    expect(r.coupePar).toBe("soigner");
  });

  it("une fois coupé, plus RIEN ne part — même une phrase propre qui suit", () => {
    const r = diffuser("Prends soin de toi. Une phrase parfaitement anodine.", "coupe");
    expect(r.sortie).toBe("");
  });

  it("le découpage en fragments ne change PAS le résultat", () => {
    // La propriété qui rend le module testable : un motif à cheval sur deux fragments (« Prends so »
    // + « in de toi. ») doit être attrapé comme s'il était arrivé d'un bloc. C'est la raison d'être
    // de l'accumulation.
    const texte = "Je suis là. Prends soin de toi. Encore une.";
    const tailles = [1, 3, 7, 40, 500].map((t) => diffuser(texte, "coupe", t).sortie);
    expect(new Set(tailles).size, `résultats divergents : ${JSON.stringify(tailles)}`).toBe(1);
    expect(tailles[0]).toBe("Je suis là.");
  });

  it("les points DÉCIMAUX ne découpent pas une phrase", () => {
    const r = diffuser("Il en reste 2.5 sur dix. Voilà.", "coupe");
    expect(r.sortie).toBe("Il en reste 2.5 sur dix. Voilà.");
  });

  it("un texte vide ne produit rien et ne lève pas", () => {
    expect(diffuser("", "coupe")).toEqual({ sortie: "", manquements: [], coupePar: null });
    expect(diffuser("   \n  ", "coupe").sortie).toBe("");
  });
});

describe("le chaînage avec la troncature à trois phrases (2.8) tient", () => {
  /** Le vrai câblage de la route : contrôle d'abord, troncature ensuite. */
  function chainer(texte: string, taille = 9) {
    let ctrl = etatControleInitial();
    let voix = etatTroncatureInitial();
    let sortie = "";
    for (let i = 0; i < texte.length; i += taille) {
      const c = absorberSousControle(ctrl, texte.slice(i, i + taille), "coupe");
      ctrl = c.etat;
      if (c.aEmettre) {
        const v = absorberDelta(voix, c.aEmettre);
        voix = v.etat;
        sortie += v.aEmettre;
      }
    }
    const f = terminerControle(ctrl, "coupe");
    if (f.aEmettre) sortie += absorberDelta(voix, f.aEmettre).aEmettre;
    return sortie;
  }

  it("quatre phrases propres restent tronquées à trois", () => {
    // Le contrôle ne doit RIEN changer à FR-084 : il émet des phrases entières, donc la troncature
    // voit exactement ce qu'elle voyait avant.
    expect(chainer("Un. Deux. Trois. Quatre.")).toBe("Un. Deux. Trois.");
  });

  it("une phrase fautive en DEUXIÈME position coupe avant la troncature", () => {
    expect(chainer("Un. Prends soin de toi. Trois. Quatre.")).toBe("Un.");
  });

  it("une phrase fautive en QUATRIÈME position ne change rien — la troncature a déjà coupé", () => {
    expect(chainer("Un. Deux. Trois. Prends soin de toi.")).toBe("Un. Deux. Trois.");
  });

  it("les deux modules partagent la MÊME définition de fin de phrase", () => {
    // ⚠️ Elle est RECOPIÉE, pas importée — délibérément : les deux ne servent pas la même fin (l'un
    // compte, l'autre délimite) et doivent pouvoir diverger sur décision. Ce test atteste qu'elles
    // coïncident AUJOURD'HUI ; le jour où l'une bouge, il rougira et il faudra le dire.
    const lire = (f: string) => sansCommentaires(readFileSync(resolve(process.cwd(), f), "utf-8"));
    const motif = /\/\(\?<!\\d\)\[\.!\?…\]\+\(\?!\\d\)\/g/;
    expect(lire("lib/domain/voix-anam.ts"), "voix-anam a changé de définition").toMatch(motif);
    expect(lire("lib/domain/controle-sortie.ts"), "controle-sortie a changé de définition").toMatch(motif);
  });
});

describe("[NFR-022] ce qui remonte ne porte JAMAIS de verbatim", () => {
  it("un manquement est une FAMILLE, jamais un terme ni une phrase", () => {
    // Le terme matché serait déjà une citation de ce qu'Anam a dit à quelqu'un ; la phrase serait de
    // l'art. 9 par contamination. Une famille appartient à un ensemble fermé de cinq valeurs.
    const r = absorberSousControle(etatControleInitial(), "Prends soin de toi.", "coupe");
    expect(r.manquements).toEqual(["soigner"]);
    expect(codeManquement("soigner")).toBe("voix_soigner");
    expect(JSON.stringify(r.manquements)).not.toContain("soin");
  });

  it("le texte accumulé reste DANS l'état — il ne ressort par aucun autre champ", () => {
    const r = absorberSousControle(etatControleInitial(), "Prends soin de toi.", "coupe");
    expect(r.aEmettre).toBe("");
    expect(Object.keys(r).sort()).toEqual(["aEmettre", "etat", "manquements"]);
  });
});
