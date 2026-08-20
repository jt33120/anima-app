import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  consigneContexte,
  CONTEXTE_BRANCHES_MAX,
  CONTEXTE_RETENU_MAX,
  type MatiereContexte,
} from "@/lib/domain/contexte-anam";

/**
 * contexte-anam.test.ts — ANAM SAIT À QUI ELLE PARLE (QA manuelle du 2026-08-20).
 *
 * ══ LE CONSTAT QUE CE FICHIER GARDE ══════════════════════════════════════════════════════════════
 *
 * « Anam est juste un wrapper de LLM. » C'était vrai au sens strict : la route envoyait au modèle
 * une consigne de VOIX, une consigne de PHASE, une consigne de DÉTRESSE, et les messages du client.
 * Ni prénom, ni socle, ni branches, ni faits retenus. Le produit avait un écran « ce qu'Anam
 * retient » et une mémoire à trois couches dont AUCUNE ligne n'atteignait la conversation.
 *
 * Trois propriétés se gardent ici, et elles ne se remplacent pas :
 *   1. la matière ARRIVE (le contexte n'est pas vide quand il y a de quoi le remplir) ;
 *   2. elle arrive SANS CHIFFRE (FR-031/AC5 [DUR]) ;
 *   3. l'IGNORANCE est dite plutôt que laissée à combler — c'est la moitié qu'on oublie, et c'est
 *      celle qui fait qu'un assistant sonne faux quand elle manque.
 */

const VIDE: MatiereContexte = {
  prenom: null,
  socle: [],
  branches: [],
  retenu: [],
  typePressenti: null,
  premiereFois: true,
};

const texte = (m: Partial<MatiereContexte>) => consigneContexte({ ...VIDE, ...m }).content;

describe("[FR-031, DUR] le contexte ne compte JAMAIS", () => {
  it("aucun chiffre isolé, quelle que soit la matière", () => {
    // ⚠️ LA GARDE EST STRUCTURELLE, PAS LEXICALE, et c'est délibéré : une liste de mots interdits
    // (« trois », « plusieurs ») rougirait sur un nom de branche légitime et laisserait passer
    // « 3 ». Un compte se reconnaît à ce qu'il est : un nombre, dans un texte qui décrit un avoir.
    const dense = texte({
      prenom: "Louise",
      socle: ["Soleil en Balance", "Lune en Poissons", "Ascendant Vierge"],
      branches: Array.from({ length: 20 }, (_, i) => ({ nom: `branche ${String.fromCharCode(97 + i)}`, enPleineLumiere: i % 3 === 0 })),
      retenu: Array.from({ length: 40 }, (_, i) => `un fait ${String.fromCharCode(97 + (i % 26))}`),
      typePressenti: null,
      premiereFois: false,
    });
    const chiffres = dense.match(/\d+/g) ?? [];
    expect(chiffres, `le contexte porte des chiffres : ${chiffres.join(", ")}`).toEqual([]);
  });

  it("borné SANS dire qu'il l'est — « et N autres » serait un compte", () => {
    const beaucoup = texte({
      branches: Array.from({ length: 30 }, (_, i) => ({ nom: `b${String.fromCharCode(97 + i)}`, enPleineLumiere: false })),
      retenu: Array.from({ length: 60 }, (_, i) => `f${String.fromCharCode(97 + (i % 26))}${i}`),
      premiereFois: false,
    });
    expect(beaucoup).not.toMatch(/autres|reste|parmi|au total|environ/i);
    // Et la borne MORD réellement — sans quoi la garde ci-dessus ne prouverait rien.
    const nommees = (beaucoup.match(/^— /gm) ?? []).length;
    expect(nommees, "aucune borne appliquée").toBeLessThanOrEqual(
      CONTEXTE_BRANCHES_MAX + CONTEXTE_RETENU_MAX + 4,
    );
  });
});

describe("[LA MATIÈRE ARRIVE] ce que la base sait atteint le modèle", () => {
  it("le prénom, le socle, les branches et le retenu sont tous portés", () => {
    const t = texte({
      prenom: "Louise",
      socle: ["Soleil en Balance"],
      branches: [
        { nom: "le déménagement", enPleineLumiere: false },
        { nom: "ma sœur", enPleineLumiere: true },
      ],
      retenu: ["elle dort mal depuis mars"],
      typePressenti: "type 4 (hypothèse d’Anam, non confirmée par le test)",
      premiereFois: false,
    });
    for (const attendu of [
      "Louise",
      "Soleil en Balance",
      "le déménagement",
      "ma sœur",
      "elle dort mal depuis mars",
      "type 4",
    ]) {
      expect(t, `« ${attendu} » n’atteint pas le modèle`).toContain(attendu);
    }
  });

  it("la pleine lumière est DITE, parce qu'une branche close ne se relance pas comme une vivante", () => {
    const t = texte({ branches: [{ nom: "ma sœur", enPleineLumiere: true }], premiereFois: false });
    expect(t).toMatch(/pleine lumière/);
  });

  it("une hypothèse de type est présentée comme réfutable, jamais comme un fait", () => {
    const t = texte({ typePressenti: "type 4 (hypothèse d’Anam, non confirmée par le test)", premiereFois: false });
    expect(t).toMatch(/hypothèse/i);
    expect(t, "Anam ne repose pas une hypothèse déjà énoncée").toMatch(/tu ne la reposes pas/i);
  });
});

describe("[L'IGNORANCE EST DITE] la moitié qu'on oublie", () => {
  it("première fois : le contexte INTERDIT la familiarité empruntée", () => {
    const t = texte({ premiereFois: true });
    expect(t).toMatch(/PREMIÈRE FOIS/);
    expect(t).toMatch(/pas de retrouvailles|semblant de rien/i);
  });

  it("déjà venue mais rien de retenu : le vide est NOMMÉ, pas laissé à combler", () => {
    // ⚠️ CE CAS EXISTE VRAIMENT, et il est le plus traître : quelqu'un a parlé, rien n'a été
    // extrait. Un modèle à qui l'on ne dit rien invente une continuité — « comme tu me le disais »
    // — et c'est le mensonge le plus coûteux qu'un compagnon puisse faire.
    const t = texte({ prenom: "Louise", premiereFois: false });
    expect(t).toMatch(/rien n’a été retenu/);
    expect(t).toMatch(/N’invente pas une continuité/);
  });

  it("sans prénom, il l'admet au lieu d'en inventer un", () => {
    expect(texte({})).toMatch(/Tu ne connais pas son prénom/);
  });

  it("le contexte n'est JAMAIS nul — l'ignorance est une information", () => {
    expect(consigneContexte(VIDE).content.length).toBeGreaterThan(100);
    expect(consigneContexte(VIDE).role).toBe("system");
  });
});

describe("[IL NE SE RÉCITE PAS] la consigne d'usage vient avec la matière", () => {
  it("interdit d'annoncer le contexte et d'inventer au-delà", () => {
    const t = texte({ prenom: "Louise", retenu: ["un fait"], premiereFois: false });
    expect(t).toMatch(/tu ne le récites jamais/i);
    expect(t).toMatch(/n’inventes rien au-delà/i);
    expect(t, "se servir de la mémoire ≠ prouver qu'on se souvient").toMatch(/pour lui prouver/i);
  });

  it("le socle est une MATIÈRE, jamais une explication de ce qu'elle est", () => {
    // FR-023 : Anam ne prédit pas et n'explique pas quelqu'un par son ciel.
    const t = texte({ socle: ["Soleil en Balance"], premiereFois: false });
    expect(t).toMatch(/jamais pour prédire/);
    expect(t).toMatch(/parce que tu es Balance/);
  });
});

describe("[CÂBLAGE] la route lit la matière et l'injecte", () => {
  const route = readFileSync(resolve(process.cwd(), "app/api/anam/message/route.ts"), "utf-8");

  it("la lecture est faite SOUS LE JWT et son échec n'est pas bloquant", () => {
    expect(route).toMatch(/lireContexteAnam\s*\(\s*supabase\s*,\s*user\.id\s*\)/);
    expect(route, "une panne de mémoire ne doit pas fermer la conversation").toMatch(
      /lireContexteAnam[\s\S]{0,80}\.catch\(/,
    );
  });

  it("[LE CŒUR] il est réellement INJECTÉ, entre la voix et la détresse", () => {
    // ⚠️ CETTE ASSERTION EST NÉE D'UN MUTANT SURVIVANT, ET C'ÉTAIT LE PIRE DE TOUS : retirer
    // `contexte` du tableau des préfixes ne faisait rougir personne. La lecture avait lieu, son
    // repli était gardé, son contenu était gardé — et le modèle ne le voyait plus. C'est-à-dire
    // exactement l'état d'AVANT la correction, avec des tests verts par-dessus.
    const m = /const\s+prefixes\s*=\s*\[([^\]]*)\]/.exec(route);
    expect(m, "le tableau des préfixes système est introuvable").not.toBeNull();
    const ordre = m![1].split(",").map((x) => x.trim()).filter(Boolean);
    expect(ordre, "le contexte n’est pas injecté : Anam ne sait toujours rien d’elle").toContain(
      "contexte",
    );
    expect(
      ordre.indexOf("contexte"),
      "le contexte doit venir APRÈS la voix — les invariants de voix priment",
    ).toBeGreaterThan(ordre.indexOf("consigneVoix"));
    expect(
      ordre.indexOf("contexte"),
      "le contexte doit venir AVANT la détresse — ce qu’on lui apprend ne prime jamais sur ce " +
        "qu’on lui interdit",
    ).toBeLessThan(ordre.indexOf("consigneDetresse"));
  });

  it("le contexte n'est jamais accepté DEPUIS le client", () => {
    // Le rôle `system` est refusé à l'entrée (`valider-messages`) : sans ça, une cliente
    // fabriquerait sa propre mémoire — et donc sa propre Anam.
    const validation = readFileSync(resolve(process.cwd(), "lib/ai/valider-messages.ts"), "utf-8");
    expect(validation).toMatch(/rolesClient\s*=\s*new Set\(\["user",\s*"assistant"\]\)/);
  });
});
