import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  INSTRUCTION_HYPOTHESE_ENNEAGRAMME,
  PHRASE_OUVERTURE_HYPOTHESE,
  lireTypeHypothese,
  momentDeProposer,
  phraseHypothese,
  requeteHypotheseEnneagramme,
} from "@/lib/domain/enneagramme-hypothese";
import { TYPES } from "@/lib/domain/enneagramme";
import { chercherPredictions } from "@/lib/domain/marqueurs-prediction";
import { chercherInterdits } from "@/lib/domain/lexique-interdit";
import { tierPour } from "@/lib/ai/politique-tier";

/**
 * enneagramme-hypothese.test.ts — « JAMAIS ASSÉNÉE », RENDU TESTABLE (Story 5.5, AC2).
 *
 * ⚠️ LE PIÈGE CENTRAL DE CETTE STORY, MESURÉ AVANT D'ÉCRIRE UNE LIGNE : `"Tu es un 4."` passe
 * `chercherPredictions` ET `chercherInterdits` au VERT. Les deux détecteurs du produit sont aveugles
 * à l'affirmation péremptoire au présent sur la personne. Une garde qui se contenterait de les
 * appeler sur les constantes ne prouverait donc RIEN — elle serait vraie du verdict aussi.
 *
 * D'où la forme de ce fichier : un jeu de contraintes qui, appliqué aux verdicts connus-mauvais,
 * ROUGIT. C'est ce contrôle négatif qui rend le contrôle positif crédible.
 */

const racine = resolve(__dirname, "..");
const lire = (chemin: string) => readFileSync(resolve(racine, chemin), "utf8");

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Le parser strict
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.5/AC2] `lireTypeHypothese` — le doute n'étiquette personne", () => {
  it("lit une ligne conforme, pour les neuf types", () => {
    for (const t of TYPES) expect(lireTypeHypothese(`TYPE_HYPOTHESE: ${t}`), `type ${t}`).toBe(t);
  });

  it("accepte les variations d'espacement et le `=`", () => {
    expect(lireTypeHypothese("TYPE_HYPOTHESE:4")).toBe(4);
    expect(lireTypeHypothese("type_hypothese =  7  ")).toBe(7);
  });

  it("[LE TEST QUI COMPTE] une ligne BAVARDE est rejetée EN BLOC", () => {
    // La leçon de `lireRetoursTheme`, payée en revue 4.7 : l'instruction dit « en cas de doute,
    // réponds `aucun` », et un modèle fort répond en français naturel. Un parser tolérant tirerait
    // un numéro d'une réponse qui refusait justement d'en donner un — et poserait l'étiquette que la
    // réponse écartait, dans un `after()` que personne ne regarde.
    for (const bavard of [
      "TYPE_HYPOTHESE: aucun, mais si je devais choisir, ce serait plutôt le 4.",
      "TYPE_HYPOTHESE: 4 (avec une aile 5)",
      "TYPE_HYPOTHESE: probablement 4",
      "TYPE_HYPOTHESE: 4 ou 6",
      "TYPE_HYPOTHESE: le 4",
      "TYPE_HYPOTHESE: 4.",
      "TYPE_HYPOTHESE: quatre",
    ]) {
      expect(lireTypeHypothese(bavard), bavard).toBeNull();
    }
  });

  it("`aucun` rend `null`, dans toutes les casses", () => {
    for (const a of ["TYPE_HYPOTHESE: aucun", "TYPE_HYPOTHESE:AUCUN", "TYPE_HYPOTHESE: Aucun "]) {
      expect(lireTypeHypothese(a), a).toBeNull();
    }
  });

  it("hors domaine, absent, vide → `null`", () => {
    for (const mauvais of [
      "TYPE_HYPOTHESE: 0",
      "TYPE_HYPOTHESE: 10",
      "TYPE_HYPOTHESE: -4",
      "TYPE_HYPOTHESE:",
      "Je pense que tu es un 4.",
      "",
    ]) {
      expect(lireTypeHypothese(mauvais), mauvais).toBeNull();
    }
  });

  it("retient la DERNIÈRE occurrence conforme — la conclusion, pas le brouillon", () => {
    expect(lireTypeHypothese("TYPE_HYPOTHESE: 3\nje me reprends\nTYPE_HYPOTHESE: 8")).toBe(8);
    // Et une dernière NON conforme disqualifie tout : on ne remonte pas chercher l'avant-dernière.
    expect(lireTypeHypothese("TYPE_HYPOTHESE: 3\nTYPE_HYPOTHESE: plutôt 8")).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Le moment
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.5/AC2] `momentDeProposer` — une seule fois, jamais deux", () => {
  it("propose quand elle n'a ni type ni hypothèse passée", () => {
    expect(momentDeProposer({ aUnType: false, aDejaEteProposee: false })).toBe(true);
  });

  it("[LE CŒUR] ne repropose JAMAIS après une hypothèse, même refusée", () => {
    // L'index partiel de 0049 n'empêche que deux hypothèses EN ATTENTE. Reproposer un autre numéro
    // le lendemain d'un refus est le message générique récurrent que FR-034 interdit — et le plus
    // agaçant de tous, celui qui se répète parce qu'il n'a pas été accepté.
    expect(momentDeProposer({ aUnType: false, aDejaEteProposee: true })).toBe(false);
  });

  it("ne propose rien à qui a déjà un type", () => {
    expect(momentDeProposer({ aUnType: true, aDejaEteProposee: false })).toBe(false);
    expect(momentDeProposer({ aUnType: true, aDejaEteProposee: true })).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// La requête — AD-3 / AD-4 / AD-5
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.5/AC2] la requête part sous egress art. 9, au tier FORT", () => {
  const r = requeteHypotheseEnneagramme([{ role: "user", content: "je dis toujours oui" }]);

  it("`contientArt9` est vrai — l'egress-guard s'applique (AD-4)", () => {
    expect(r.contientArt9).toBe(true);
  });

  it("la capacité résout le tier FORT par la politique unique (AD-5)", () => {
    expect(tierPour(r.capacite)).toBe("fort");
    expect(r.capacite).toBe("hypothese_enneagramme");
  });

  it("l'instruction est PRÉFIXÉE côté serveur, en `system`", () => {
    expect(r.messages[0]).toEqual({ role: "system", content: INSTRUCTION_HYPOTHESE_ENNEAGRAMME });
  });

  it("[AC8] AUCUNE donnée de socle n'entre dans la charge utile", () => {
    // Le type déjà retenu, le thème natal, la numérologie, le nom d'une branche : rien de tout cela
    // n'a de raison d'aider le modèle, et tout cela grossirait l'art. 9 exposé. La garde est ici
    // parce que l'erreur inverse — « ajouter le contexte pour aider » — est une régression invisible.
    const charge = JSON.stringify(r);
    for (const mot of ["enneagramme:", "ascendant", "chemin_de_vie", "branche"]) {
      expect(charge.toLowerCase(), mot).not.toContain(mot);
    }
  });

  it("l'instruction porte le marqueur de placeholder produit", () => {
    expect(INSTRUCTION_HYPOTHESE_ENNEAGRAMME).toContain("[PLACEHOLDER PRODUIT");
    expect(INSTRUCTION_HYPOTHESE_ENNEAGRAMME).toContain("TYPE_HYPOTHESE:");
    expect(INSTRUCTION_HYPOTHESE_ENNEAGRAMME).toMatch(/aucun/);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// « Jamais assénée » — les contraintes, et le contrôle qui les rend crédibles
// ══════════════════════════════════════════════════════════════════════════════════════════════

/** Combien de phrases ? Découpe grossière volontaire : on borne la longueur, pas la grammaire. */
const nbPhrases = (t: string) => t.split(/[.!?…]+/).filter((p) => p.trim().length > 0).length;

/**
 * Le jeu de contraintes qui définit « jamais assénée ». Rendu en LISTE DE MANQUEMENTS plutôt qu'en
 * booléen : un test qui échoue doit dire LEQUEL, sinon la garde est un mur aveugle.
 */
function manquements(phrase: string): string[] {
  const m: string[] = [];
  if (!phrase.trim().endsWith("?")) m.push("ne se termine pas par une question");
  if (nbPhrases(phrase) > 3) m.push("plus de trois phrases");
  if (chercherPredictions(phrase).length > 0) m.push("prédiction détectée");
  if (chercherInterdits(phrase).length > 0) m.push("lexique interdit détecté");
  // Le verdict d'identité : « tu es un N », « ton type », « ta blessure ». C'est exactement la forme
  // que les deux détecteurs laissent passer, et c'est la seule chose que l'AC2 interdit nommément.
  if (/\b(?:tu es|t'es|vous êtes)\b/i.test(phrase)) m.push("affirme ce qu'elle EST");
  if (/\bton (?:type|profil|enneatype)\b/i.test(phrase)) m.push("s'approprie le type (« ton type »)");
  if (/\bta (?:blessure|peur|passion) (?:fondamentale|de base|profonde)\b/i.test(phrase)) {
    m.push("décrète un trait de fond");
  }
  return m;
}

describe("[5.5/AC2 DUR] les constantes ne peuvent pas asséner", () => {
  it("[CONTRÔLE DU CONTRÔLE] les verdicts connus-mauvais ROUGISSENT", () => {
    // Sans ce test, tout le bloc ci-dessous serait satisfait par n'importe quelle phrase — y compris
    // par celles-ci, qui passent les DEUX détecteurs du produit. C'est mesuré, pas supposé.
    for (const verdict of [
      "Tu es un 4.",
      "Ton type 2 t'empêche de dire non.",
      "Ta blessure fondamentale est l'abandon.",
      "Tu es quelqu'un qui fuit le conflit.",
    ]) {
      expect(manquements(verdict), verdict).not.toEqual([]);
    }
  });

  it("[CONTRÔLE DU CONTRÔLE] et les deux détecteurs, eux, les laissent TOUS passer", () => {
    // La mesure qui justifie l'existence de ce fichier. Le jour où un détecteur apprendra à voir
    // l'assènement, ce test rougira — et ce sera une bonne nouvelle à consigner, pas une régression.
    for (const verdict of ["Tu es un 4.", "Ta blessure fondamentale est l'abandon."]) {
      expect(chercherPredictions(verdict), verdict).toEqual([]);
      expect(chercherInterdits(verdict), verdict).toEqual([]);
    }
  });

  it("la phrase du FIL ne manque à rien — et ne nomme AUCUN numéro", () => {
    expect(manquements(PHRASE_OUVERTURE_HYPOTHESE)).toEqual([]);
    // Elle ouvre une porte ; nommer le type au milieu d'une conversation serait l'asséner sans le
    // contexte ni la place de répondre autrement que par oui.
    expect(PHRASE_OUVERTURE_HYPOTHESE).not.toMatch(/\d/);
  });

  it("la phrase de la HALTE ne manque à rien, pour les neuf types", () => {
    for (const t of TYPES) expect(manquements(phraseHypothese(t)), `type ${t}`).toEqual([]);
  });

  it("la phrase de la halte nomme LE type demandé, et lui seul", () => {
    // Le mutant visé — « rendre toujours le type 1 » — est invisible sur la forme : les neuf phrases
    // se ressemblent. Il ne se voit qu'en comparant le numéro rendu à celui demandé.
    for (const t of TYPES) {
      expect(phraseHypothese(t), `type ${t}`).toContain(String(t));
      for (const autre of TYPES) {
        if (autre !== t) expect(phraseHypothese(t)).not.toContain(String(autre));
      }
    }
  });

  it("le type est présenté comme un NOM EXTÉRIEUR, jamais comme une propriété d'elle", () => {
    for (const t of TYPES) expect(phraseHypothese(t)).toContain("ce qu'on appelle");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Les gardes de SOURCE — aucune sortie de modèle ne parvient à l'écran
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[5.5/AC2 DUR] la sortie brute du modèle ne franchit AUCUNE frontière", () => {
  const PIPELINE = "lib/safety/hypothese-enneagramme-pipeline.ts";

  it("[LE CŒUR] le texte du modèle n'est lu QUE par le parser", () => {
    // Mutation-cible : `germeId: res.reponse.texte`, ou un champ `phrase` alimenté par le modèle. La
    // phrase deviendrait alors celle du modèle — et « jamais assénée » redeviendrait une intention.
    const source = lire(PIPELINE);
    const usages = [...source.matchAll(/res\.reponse\.texte/g)];
    expect(usages.length, "le parser doit bien lire quelque chose").toBeGreaterThan(0);
    expect(source).toContain("lireTypeHypothese(res.reponse.texte)");
    // Un seul usage : s'il y en avait deux, le second n'irait pas au parser.
    expect(usages).toHaveLength(1);
  });

  it("le résultat du pipeline ne porte AUCUN texte libre", () => {
    // `ResultatHypothese` ne déclare que des booléens, un identifiant et un usage chiffré. Il n'y a
    // pas de champ où une phrase du modèle pourrait voyager.
    const corps = lire(PIPELINE).match(/export interface ResultatHypothese \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(corps, "extraction TRONQUÉE — la garde ne prouverait rien").toContain("germeId");
    expect(corps).not.toMatch(/\bphrase\b/);
    expect(corps).not.toMatch(/\btexte\b/);
  });

  it("la phrase de l'ouverture vient de la CONSTANTE, jamais d'ailleurs", () => {
    const source = lire("lib/safety/ouverture-branche.ts");
    expect(source).toContain("phrase: PHRASE_OUVERTURE_HYPOTHESE");
  });

  it("[LE CŒUR] `chargerOuverture` ne MARQUE rien — elle part d'un rendu serveur", () => {
    // Mutation-cible : poser `dite_le` ici. Ce chemin part d'`app/page.tsx`, qui se ré-exécute à
    // chaque rafraîchissement, et la scène monte ses trois régions en permanence (`inert` sauf
    // l'active) : la parole se dépenserait sans avoir jamais atteint un écran. La faute a été payée
    // DEUX FOIS — revue 4.10 (`reserver_invitation_integration` consommée par un `router.refresh()`)
    // puis migration 0045. La dépense vit dans `app/_enneagramme/marquer-hypothese.ts`, déclenchée
    // par le CLIENT quand la région est active.
    // ⚠️ On cherche un APPEL et un IMPORT, pas le MOT : le commentaire de ce fichier explique
    // justement pourquoi la marque ne vit pas ici, et une garde qui rougirait sur sa propre
    // explication pousserait à effacer l'explication.
    const source = lire("lib/safety/ouverture-branche.ts");
    expect(source, "aucun appel de marquage").not.toMatch(/marquerHypotheseDite\s*\(/);
    expect(source, "aucun dépôt d'écriture importé").not.toMatch(/from\s*["']@\/lib\/data\/depot-enneagramme/);
    expect(source, "aucune construction de dépôt").not.toMatch(/creerDepotEnneagramme\s*\(/);
    // Le témoin : elle LIT bien quelque chose (sinon la garde d'absence serait vraie du vide).
    expect(source).toContain("lireHypotheseEnneagramme");
  });

  it("[AC8 DUR] la route de conversation ne lit JAMAIS le type retenu", () => {
    // La route a le droit de connaître l'ennéagramme — elle porte l'étage qui sème le germe. Ce
    // qu'elle n'a pas le droit de faire, c'est LIRE LE TYPE : ce serait le seul chemin par lequel
    // l'étiquette entrerait dans le contexte du modèle, à chaque tour, pour toujours (décision D3,
    // « l'enfermement permanent »). Elle ne lit que deux booléens.
    const source = lire("app/api/anam/message/route.ts");
    for (const lecture of ["lireEnneagramme", "texteDuTypeRetenu", "lireTentativeEnneagramme"]) {
      expect(source, `${lecture} donnerait le type au contexte du modèle`).not.toContain(lecture);
    }
    expect(source, "témoin : elle lit bien les FAITS, qui sont des booléens").toContain(
      "lireFaitsHypothese",
    );
  });

  it("[COÛT] l'étage ne tourne QU'À LA CLÔTURE, et dans `after()`", () => {
    // Deux propriétés dans une seule lecture de source, parce qu'aucun test de comportement ne peut
    // les voir : la route n'est pas montable hors Next.
    //
    //   • `after()` — l'étage est POST-réponse : aucune latence ajoutée, rien à l'écran ce tour.
    //   • `arc?.beat === "cloture"` — la machine n'émet ce beat qu'à la TRANSITION vers clore, donc
    //     AU PLUS UN appel fort par séance. Sans ce gate, une passe FORTE partirait à chaque tour
    //     d'un compte sans type, et `momentDeProposer` ne l'aurait bornée qu'APRÈS le premier germe.
    const source = lire("app/api/anam/message/route.ts");
    const bloc = source.match(/if \(arc\?\.beat === "cloture"\) \{[\s\S]*?evaluerHypotheseEnneagramme/);
    expect(bloc, "l'étage doit être gardé par le beat de clôture").not.toBeNull();
    expect(source, "et tourner dans after(), jamais dans le flux").toMatch(
      /if \(arc\?\.beat === "cloture"\) \{\s*\n\s*after\(async \(\) => \{/,
    );
    // Métré sous une clé DISTINCTE : FR-043 n'exempte QUE la détresse, et deux étages qui
    // partageraient une clé d'idempotence en perdraient un (leçon 2.7).
    expect(source).toContain(":hypothese_enn");
  });

  it("[AC8 DUR] AUCUN autre constructeur de requête ne connaît l'ennéagramme", () => {
    /*
     * ⚠️ LA GARDE LA PLUS IMPORTANTE DE CETTE STORY POUR L'AVENIR, et elle vise une régression qui
     * s'écrit avec les meilleures intentions : « ajoutons son type au contexte, Anam répondra
     * mieux ». Ce serait l'ENFERMEMENT PERMANENT que la décision D3 refuse — Anam lisant la
     * personne à travers son étiquette à chaque tour, pour toujours, sans qu'aucun écran ne le dise.
     *
     * On balaie TOUS les modules qui construisent une `RequeteIa`. Un seul a le droit de connaître
     * l'ennéagramme : celui qui produit l'hypothèse. Les autres n'en ont jamais entendu parler.
     */
    const CONSTRUCTEURS = [
      "lib/domain/reconceptualisation.ts",
      "lib/domain/retour-theme.ts",
      "lib/domain/signaux-arc.ts",
      "lib/safety/detecteur-detresse.ts",
      "lib/ordonnanceur/jobs/synthese.ts",
    ];
    // PRÉSENCE D'ABORD : sans témoin, une liste de chemins fautifs rendrait la garde vide.
    for (const f of CONSTRUCTEURS) {
      expect(lire(f), `${f} ne construit plus de requête — la liste a vieilli`).toContain("capacite:");
      expect(lire(f), `${f} s'est mis à connaître l'ennéagramme`).not.toMatch(/enn[ée]agramme/i);
    }
  });

  it("[AC8 DUR] la route ne lit du type que son EXISTENCE, jamais sa valeur", () => {
    // `lireFaitsHypothese` est la seule lecture d'ennéagramme du chemin de conversation. Elle rend
    // deux booléens : il n'y a pas de champ où un numéro pourrait voyager jusqu'au contexte du
    // modèle. Mutation-cible : y ajouter `type` « pour éviter une requête ».
    const corps = lire("lib/domain/enneagramme-hypothese.ts").match(
      /export interface FaitsHypothese \{[\s\S]*?\n\}/,
    )?.[0];
    expect(corps, "extraction TRONQUÉE — la garde ne prouverait rien").toContain("aUnType");
    expect(corps).not.toMatch(/:\s*number\b/);
    expect(corps).not.toMatch(/TypeEnneagramme/);
    // …et la lecture qui les produit ne demande jamais la colonne `type`.
    const lecture = lire("lib/data/lire-enneagramme.ts").match(
      /export async function lireFaitsHypothese[\s\S]*?\n\}/,
    )?.[0];
    expect(lecture, "extraction TRONQUÉE").toContain("count");
    expect(lecture).not.toMatch(/select\("type/);
  });

  it("le tier FORT est écrit EXPLICITEMENT, pas hérité du repli", () => {
    // Le test de comportement (`tests/politique-tier.test.ts`) reste vert si on retire la ligne
    // dédiée : le repli `=== "echange" ? "leger" : "fort"` donne déjà « fort ». Seule une garde de
    // SOURCE distingue « fort par décision » de « fort par accident ».
    expect(lire("lib/ai/politique-tier.ts")).toContain('capacite === "hypothese_enneagramme"');
  });
});
