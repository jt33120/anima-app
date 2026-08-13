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

    // ── Story 5.5 — L'ADJECTIF CLINIQUE ATTRIBUT ───────────────────────────────────────────────
    //
    // Le lexique bannissait le SUBSTANTIF (« l'anxiété », `\banxiete(s)?\b`) et la locution
    // (« trouble anxieux »), jamais l'adjectif nu. Mesuré le 2026-08-13 : « Le 6 vit dans
    // l'anxiété. » → rouge, mais « Le 6 est anxieux. » → VERT. Or l'adjectif attribut est la
    // formulation canonique de toute la littérature ennéagramme, et NFR-008 dit « lexique zéro
    // médical » — pas « zéro substantif médical ».
    ["Le 6 est anxieux.", "medical"],
    ["Le 6 est anxieuse.", "medical"],
    ["Un fonctionnement obsessionnel.", "medical"],
    ["C'est un mécanisme phobique.", "medical"],
    ["Le 4 peut sembler narcissique.", "medical"],
    ["Une répétition compulsive.", "medical"],
    ["C'est une défense névrotique.", "medical"],
    ["Un fonctionnement bipolaire.", "medical"],
    ["Un profil borderline.", "medical"],
    ["Une tendance hypocondriaque.", "medical"],
    ["Un mouvement dissociatif.", "medical"],
    ["Un fond paranoïaque.", "medical"],
    // « évitant » est GATÉ (voir le contrôle négatif) : c'est l'attribut qui bascule, pas le
    // participe présent.
    ["Le 9 est évitant.", "medical"],
    ["Le 9 devient évitante avec le temps.", "medical"],
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
    // ── Story 5.5 — ce que l'extension aux adjectifs cliniques ne doit PAS avaler ──────────────
    "Le 9 tient la paix en évitant le conflit.", // participe présent courant ≠ attribut clinique
    "Elle avance en évitant les détours.", // idem
    "Un travail d'évitement, dirait un manuel.", // le nom n'est pas visé : c'est l'attribut qui l'est
    "Ce nombre décrit une vigilance, pas un défaut.", // le registre de remplacement doit rester libre
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

// ══════════════════════════════════════════════════════════════════════════════════════════════
// REVUE DU 2026-08-12 — QUATRE FAÇONS D'ÉCRIRE L'INTERDIT SANS ÊTRE VU
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[revue 2.8] les ENTITÉS HTML ne neutralisent plus le contrôle", () => {
  /**
   * ══ LE DÉFAUT ═══════════════════════════════════════════════════════════════════════════════
   *
   * La garde lit le SOURCE, l'utilisatrice lit le RENDU. Entre les deux, `&apos;` et `&nbsp;`.
   * Mesuré : neuf phrases interdites sur douze passaient sous cette forme.
   *
   * Ce n'était pas une hypothèse d'école. DIX fichiers du produit écrivent déjà ainsi, et ce sont
   * exactement les pages où vit la prose sensible : les CGU, le consentement, la page d'aide,
   * l'écran de barrière. Une réécriture éditoriale qui y glisse « n'oublie pas que tu es forte »
   * n'aurait jamais rougi.
   *
   * Un balayage complet du dépôt entités décodées n'a révélé AUCUNE violation masquée : le trou
   * était ouvert, personne n'était encore tombé dedans.
   */
  const PAIRES: Array<[string, string]> = [
    ["N&apos;oublie pas que tu es forte.", "N'oublie pas que tu es forte."],
    ["C&apos;est normal de ressentir ça.", "C'est normal de ressentir ça."],
    ["Je m&apos;inquiète pour toi.", "Je m'inquiète pour toi."],
    ["Je&nbsp;ressens ta peine.", "Je ressens ta peine."],
    ["Anam peut te prendre&nbsp;en&nbsp;charge.", "Anam peut te prendre en charge."],
    ["Tu&nbsp;iras&nbsp;mieux.", "Tu iras mieux."],
    ["Bonjour &#128522;", "Bonjour 😊"],
  ];

  it("[CONTRÔLE POSITIF] la forme NUE est bien attrapée — sinon la paire ne prouve rien", () => {
    for (const [, nue] of PAIRES) {
      expect(chercherInterdits(nue).length, `la forme nue passe : « ${nue} »`).toBeGreaterThan(0);
    }
  });

  it("[LE TEST QUI COMPTE] la forme ÉCHAPPÉE est attrapée exactement pareil", () => {
    for (const [echappee, nue] of PAIRES) {
      expect(chercherInterdits(echappee).length, `« ${echappee} » passe encore`).toBeGreaterThan(0);
      expect(
        chercherInterdits(echappee).length,
        `« ${echappee} » et « ${nue} » ne donnent pas le même verdict`,
      ).toBe(chercherInterdits(nue).length);
    }
  });

  it("une entité qui n'est PAS un interdit reste inoffensive", () => {
    // Le décodage ne doit pas fabriquer des interdits : « article&nbsp;9 » est du texte légitime,
    // écrit ainsi dans le formulaire de consentement pour ne pas couper la référence légale.
    expect(chercherInterdits("l&apos;article&nbsp;9 du RGPD")).toEqual([]);
    expect(chercherInterdits("18&nbsp;ans minimum")).toEqual([]);
  });
});

describe("[revue 2.8] UN MOT INTERCALÉ — le miroir avait cessé d'en être un", () => {
  /**
   * `marqueurs-prediction.ts` se déclare « miroir structurel » de ce lexique. Il a été élargi le
   * 2026-08-12 pour accepter un mot entre le pronom et le verbe (« tu **ne** verras »), après avoir
   * mesuré qu'il n'attrapait que deux phrases prédictives sur onze. Le correctif n'a pas traversé
   * le miroir : le même jour, ici, « je comprends PARFAITEMENT ce que tu vis » passait encore.
   *
   * Le fragment est désormais PARTAGÉ (`normalisation-texte.ts`) — deux implémentations d'un même
   * invariant divergent, et celles-ci avaient divergé le jour même de la correction.
   */
  it("[LE TEST QUI COMPTE] l'adverbe intercalé ne fait plus passer la phrase", () => {
    for (const phrase of [
      "Je comprends parfaitement ce que tu vis.",
      "Je comprends bien ce que tu traverses.",
      "Je comprends tout à fait ce que tu vis.",
      "Tu iras beaucoup mieux.",
      "Tu iras bientôt mieux.",
      "Tout cela va passer.",
      "Cela va passer.",
    ]) {
      expect(chercherInterdits(phrase).length, `« ${phrase} » passe encore`).toBeGreaterThan(0);
    }
  });

  it("[CONTRÔLE] les formes ADJACENTES restent attrapées (on n'a rien cassé)", () => {
    for (const phrase of ["Je comprends ce que tu vis.", "Tu iras mieux.", "Ça va passer."]) {
      expect(chercherInterdits(phrase).length, `« ${phrase} »`).toBeGreaterThan(0);
    }
  });

  it("[CONTRÔLE NÉGATIF] l'élargissement n'avale pas du légitime", () => {
    for (const phrase of [
      "Je comprends que tu veuilles arrêter.",
      "Tu iras voir un professionnel si tu le souhaites.",
      "Le temps va passer, et c'est tout ce qu'on sait.",
    ]) {
      expect(chercherInterdits(phrase), `faux positif : « ${phrase} »`).toEqual([]);
    }
  });
});

describe("[revue 2.8] « soignée » — le participe FÉMININ manquait, dans une app qui tutoie une femme", () => {
  /**
   * Le commentaire du lexique affirmait que « soigné » se normalise en « soigne » et « coïncide
   * avec le verbe ». Vrai au masculin. Faux au féminin : « soignée » → « soignee », absent de
   * l'alternance. La seule forme que ce produit écrirait réellement était la seule qui manquait.
   */
  it("[LE TEST QUI COMPTE] les formes féminines sont attrapées", () => {
    for (const phrase of ["Anam t'a soignée.", "Tu seras soignée.", "des blessures soignées"]) {
      expect(chercherInterdits(phrase).length, `« ${phrase} » passe encore`).toBeGreaterThan(0);
    }
  });

  it("[CONTRÔLE] le masculin l'était déjà, et l'est toujours", () => {
    expect(chercherInterdits("un patient soigné").length).toBeGreaterThan(0);
  });

  it("[CONTRÔLE NÉGATIF] l'adverbe, l'adjectif et le nom restent épargnés", () => {
    for (const phrase of [
      "soigneusement rangé",
      "un soignant t'accompagnera",
      "le soin des choses",
      "des soins de support",
    ]) {
      expect(chercherInterdits(phrase), `faux positif : « ${phrase} »`).toEqual([]);
    }
  });
});

describe("[revue 2.8] l'émoji : on déclare ce qu'on accepte, pas ce qu'on refuse", () => {
  /**
   * La règle exigeait une PRÉSENTATION emoji, pour épargner les glyphes juridiques nus © ® ™. Elle
   * épargnait du même coup ☺ ☹ ☠ ✌ ☝ ✍ ❄ ✈ ✂ ‼ ⁉ — pictogrammes à présentation TEXTE dans Unicode,
   * mais rendus EN COULEUR par iOS et Android. Sur une PWA, `☺` dans un libellé EST un émoji à
   * l'écran, et il franchissait le seul contrôle bloquant du produit sur la voix.
   */
  it("[LE TEST QUI COMPTE] les pictogrammes à présentation TEXTE sont bannis aussi", () => {
    for (const g of ["☺", "☹", "☠", "✌", "☝", "✍", "❄", "✈", "✂", "‼", "⁉"]) {
      expect(chercherInterdits(`Un libellé ${g} ici`).length, `« ${g} » passe`).toBeGreaterThan(0);
    }
  });

  it("[CONTRÔLE] les émoji évidents le restent, drapeaux compris", () => {
    // ⚠️ Le drapeau est composé d'INDICATEURS RÉGIONAUX, qui ne sont pas `Extended_Pictographic` :
    // inverser la règle sans les rajouter explicitement les aurait perdus en silence — une
    // régression introduite EN CORRIGEANT, la façon la plus courante d'en introduire une.
    for (const g of ["😊", "❤️", "☕", "❗", "🇫🇷"]) {
      expect(chercherInterdits(`Un libellé ${g} ici`).length, `« ${g} » passe`).toBeGreaterThan(0);
    }
  });

  it("[CONTRÔLE NÉGATIF] la liste blanche typographique et juridique est épargnée", () => {
    // Un pied de page « © Anima » ne doit pas faire échouer la construction du produit.
    for (const g of ["©", "®", "™", "♀", "♂", "♥", "♦", "♣", "♠", "▶", "◀", "✓", "✗", "«", "»"]) {
      expect(chercherInterdits(`© Anima 2026 ${g}`), `faux positif : « ${g} »`).toEqual([]);
    }
  });
});
