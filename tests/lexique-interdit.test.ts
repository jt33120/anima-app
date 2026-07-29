import { describe, it, expect } from "vitest";
import { chercherInterdits } from "@/lib/domain/lexique-interdit";

/**
 * Story 2.8 (T1) — le LEXIQUE INTERDIT, source unique PURE (AD-1), miroir de `anam-voice.md` §11 +
 * `EXPERIENCE.md` §Lexique. Il alimente le contrôle bloquant transversal (T5). Le test prouve deux
 * choses également vitales :
 *   - CONTRÔLE POSITIF : chaque famille attrape sa chaîne connue-mauvaise (sinon un regex cassé
 *     passe vert et le contrôle ne protège rien) ;
 *   - CONTRÔLE NÉGATIF (le cœur anti-faux-positif) : le contenu LÉGITIME de l'app ne matche JAMAIS —
 *     « be**soin** » ≠ soin, « **traite**ment » ≠ traiter, « **santé** » seul (Fil Santé Jeunes,
 *     professionnelle de santé), « ça me **trouble** » ≠ trouble clinique, « je suis **là** » ≠ affect.
 *
 * Périmètre : familles LEXICALES (médical, soigner, formulation bannie, affect, emoji). Le `!`, les
 * majuscules d'emphase et le tutoiement en SORTIE LIVE relèvent de la consigne (T3), pas d'un scan de
 * source (où `!==`, `!bloque`, sigles pullulent) — voir Dev Notes.
 */

describe("Story 2.8 — lexique interdit : CONTRÔLE POSITIF (attrape le connu-mauvais)", () => {
  const mauvais: Array<[string, string]> = [
    ["Je te conseille une thérapie.", "medical"],
    ["C'est thérapeutique, ça.", "medical"],
    ["Tu fais une dépression.", "medical"],
    ["Ça réduira ton anxiété.", "medical"],
    ["C'est un diagnostic classique.", "medical"],
    ["C'est un symptôme classique.", "medical"],
    ["Prends soin de ta santé mentale.", "medical"],
    ["Tu vas guérir de cette rupture.", "medical"],
    ["Ces blessures guérissent avec le temps.", "medical"], // revue 2.8 : radical -iss-
    ["Va voir un guérisseur.", "medical"],
    ["Travaillons sur ton trouble.", "medical"], // revue 2.8 : « trouble » gaté par déterminant
    ["Tu fais un burn-out.", "medical"],
    ["C'est une pathologie.", "medical"],
    ["Un syndrome bien connu.", "medical"],
    ["Je peux te prendre en charge.", "medical"],
    ["Tu iras mieux, promis.", "medical"],
    ["Ça va passer.", "medical"],
    ["Cette app soigne l'estime de soi.", "soigner"],
    ["Prends soin de toi.", "soigner"],
    ["C'est une excellente prise de conscience.", "formulation"],
    ["C'est normal de ressentir ça.", "formulation"],
    ["N'oublie pas que tu es forte.", "formulation"],
    ["Il semble que tu ressentes de la peur.", "formulation"],
    ["Bravo, quelle avancée.", "formulation"],
    ["Tu as tout à fait raison.", "formulation"],
    ["Je suis fière de toi.", "affect"],
    ["Je ressens ta peine.", "affect"],
    ["Ça me touche vraiment.", "affect"],
    ["Je comprends ce que tu vis.", "affect"],
    ["Courage 😊 tu vas y arriver.", "emoji"],
    ["Bravo ❤️", "emoji"],
    ["Vive la 🇫🇷", "emoji"], // revue 2.8 : drapeau (indicateurs régionaux)
  ];
  for (const [texte, famille] of mauvais) {
    it(`attrape « ${texte} » (famille ${famille})`, () => {
      const trouvailles = chercherInterdits(texte);
      expect(trouvailles.length, `rien attrapé dans « ${texte} »`).toBeGreaterThan(0);
      expect(
        trouvailles.some((t) => t.famille === famille),
        `attendu famille ${famille} ; obtenu ${JSON.stringify(trouvailles)}`,
      ).toBe(true);
    });
  }
});

describe("Story 2.8 — lexique interdit : CONTRÔLE NÉGATIF (épargne le légitime — anti-faux-positif)", () => {
  const bons = [
    "Si tu as besoin de parler, des ressources existent.", // besoin ≠ soin
    "Le traitement de tes données est suspendu.", // traitement (RGPD) ≠ traiter
    "Fil Santé Jeunes", // santé (nom d'organisme) ≠ santé mentale
    "Anam n'est pas une professionnelle de santé.", // santé seul, légitime
    "Ça me trouble un peu, cette histoire.", // trouble (courant, sans déterminant) ≠ clinique
    "Je suis là.", // attention autorisée
    "Je lis ce que tu écris.", // attention autorisée
    "Je note.", // attention autorisée
    "Je me souviens de ce que tu m'as dit en mars.", // attention autorisée
    "Le soin apporté au détail compte.", // substantif « soin » ≠ soigner
    "Lisez soigneusement les conditions.", // revue 2.8 : adverbe ≠ verbe soigner
    "Un travail soigneux et précis.", // revue 2.8 : adjectif ≠ verbe
    "Adresse-toi à un soignant.", // revue 2.8 : orientation vers un pro, légitime
    "Anam traite mes données sensibles.", // revue 2.8 : « traite » RGPD ≠ médical
    "Le traitement de tes données est suspendu.", // « traitement » RGPD ≠ traiter
    "© Anima 2026 — tous droits réservés.", // revue 2.8 : glyphe typographique ≠ emoji
    "Marque déposée ™ et ®.", // revue 2.8 : idem
    "Recevoir mon lien", // libellé UI neutre
    "Ta date de naissance", // libellé UI neutre
    "Prévention du suicide", // libellé d'aide (organisme) — non médical d'Anam
  ];
  for (const texte of bons) {
    it(`épargne « ${texte} »`, () => {
      expect(chercherInterdits(texte), `faux positif sur « ${texte} »`).toEqual([]);
    });
  }
});

describe("Story 2.8 — lexique interdit : robustesse casse + accents", () => {
  it("insensible à la casse et aux accents (« THÉRAPIE », « depression » sans accent)", () => {
    expect(chercherInterdits("THÉRAPIE").length).toBeGreaterThan(0);
    expect(chercherInterdits("depression").length).toBeGreaterThan(0);
    expect(chercherInterdits("Anxiete").length).toBeGreaterThan(0);
  });
});
