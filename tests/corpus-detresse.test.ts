import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CORPUS,
  mesurer,
  SEUIL_ALERTE_FAUX_POSITIFS,
  type Observation,
} from "@/lib/safety/corpus-detresse";
import { classerDetresse } from "@/lib/safety/classer-detresse";

/**
 * corpus-detresse.test.ts — LE BANC D'ESSAI DES FAUX POSITIFS (QA T4).
 *
 * ══ CE FICHIER N'APPELLE AUCUN MODÈLE, ET C'EST UNE DÉCISION ════════════════════════════════════
 *
 * Faire tourner le détecteur RÉEL en CI coûterait un appel au modèle fort par cas, à chaque
 * exécution de la suite, sur un fournisseur sous DPA — et rendrait rouge un test unitaire au premier
 * hoquet réseau. Pire : la classification n'est pas déterministe, donc la garde clignoterait.
 *
 * Ce que la CI garde, c'est donc l'INSTRUMENT : que le corpus soit exploitable, qu'il ne contienne
 * aucune donnée réelle, et que la mesure compte juste. La CAMPAGNE elle-même — passer les 21 tours
 * au vrai détecteur et lire le taux — se lance à la main, par `scripts/mesurer-detresse.ts`, quand
 * on change le prompt, le modèle ou le tier.
 *
 * ⚠️ ET LE SEUIL NE BOUGE PAS DANS CETTE STORY. Le seul geste légitime après une campagne est de
 * porter le chiffre à un professionnel. `lib/safety/classer-detresse.ts` n'est pas touché.
 */

const RACINE = resolve(__dirname, "..");

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LE CORPUS — exploitable, et sans une seule phrase réelle
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[T4] Le corpus est un instrument, pas une collection", () => {
  it("[LE CŒUR] les tours ORDINAIRES sont MAJORITAIRES — sinon on mesure un produit qui n'existe pas", () => {
    // La T4 porte sur les faux positifs : des journées difficiles classées en détresse. Un corpus
    // équilibré 50/50 donnerait un taux flatteur en noyant les cas ordinaires sous les cas graves.
    const ordinaires = CORPUS.filter((c) => c.attendu === 0).length;
    expect(ordinaires / CORPUS.length).toBeGreaterThan(0.5);
  });

  it("les quatre niveaux sont représentés — sans le 3, la mesure ne verrait pas les faux négatifs", () => {
    for (const n of [0, 1, 2, 3]) {
      expect(
        CORPUS.some((c) => c.attendu === n),
        `aucun cas de niveau ${n} : le banc est borgne`,
      ).toBe(true);
    }
  });

  it("les cinq familles de danger sont couvertes au moins une fois", async () => {
    // FR-074 : la famille pilote les ressources affichées. Une famille absente du corpus est une
    // famille dont personne ne saura si le détecteur la trouve.
    const familles = new Set(CORPUS.map((c) => c.famille).filter(Boolean));
    for (const f of ["suicide", "urgence_vitale", "violences_femmes", "enfance", "ecoute"]) {
      expect(familles.has(f as never), `famille non couverte : ${f}`).toBe(true);
    }
    // ⚠️ ANTI-DÉRIVE : la liste ci-dessus est écrite à la main. Si `FamilleDanger` gagne un membre,
    // cette assertion-ci le signale — sans elle, une nouvelle famille resterait hors du banc.
    const { RESSOURCES_AIDE } = await import("@/lib/safety/ressources-aide");
    const connues = new Set(RESSOURCES_AIDE.map((r) => r.famille));
    for (const f of connues) {
      expect(familles.has(f), `famille du produit absente du corpus : ${f}`).toBe(true);
    }
  });

  it("un niveau ≥ 2 porte TOUJOURS une famille attendue", () => {
    // C'est ce que le bloc de ressources consomme. Un cas grave sans famille attendue mesurerait
    // le niveau et laisserait la moitié utile hors du banc.
    for (const c of CORPUS.filter((c) => c.attendu >= 2)) {
      expect(c.famille, `${c.id} : niveau ${c.attendu} sans famille attendue`).toBeTruthy();
    }
  });

  it("chaque cas dit POURQUOI il est difficile", () => {
    for (const c of CORPUS) {
      expect(c.piege.length, `${c.id} sans piège écrit`).toBeGreaterThan(20);
    }
    expect(new Set(CORPUS.map((c) => c.id)).size, "des identifiants en double").toBe(CORPUS.length);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LA CONTRAINTE ABSOLUE — aucune donnée réelle dans un dépôt PUBLIC
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[T4/NFR-022] Le corpus est INVENTÉ, et rien ne peut l'attester sauf sa forme", () => {
  const source = readFileSync(resolve(RACINE, "lib/safety/corpus-detresse.ts"), "utf-8");

  it("[LE CŒUR] aucun identifiant personnel : ni courriel, ni téléphone, ni date de naissance", () => {
    // Un corpus de détresse fait de phrases réelles serait un fichier art. 9 versionné dans un dépôt
    // public. Ces motifs n'attrapent pas tout — la vraie garde est humaine, et elle est écrite en
    // tête du corpus. Ils attrapent le copier-coller pressé, qui est le mode d'échec réel.
    const tours = CORPUS.map((c) => c.tour).join("\n");
    expect(tours, "une adresse de courriel").not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
    expect(tours, "un numéro de téléphone").not.toMatch(/\b0[1-9](?:[\s.-]?\d{2}){4}\b/);
    expect(tours, "une date complète").not.toMatch(/\b\d{1,2}[/\s.-]\d{1,2}[/\s.-]\d{2,4}\b/);
    expect(tours, "une adresse postale").not.toMatch(/\b\d{1,3}\s+(rue|avenue|boulevard|impasse)\b/i);
  });

  it("aucun prénom : les tours parlent en « je », jamais de quelqu'un de nommé", () => {
    // Les rôles cités sont GÉNÉRIQUES (ma collègue, mon patron, ma voisine, ma grand-mère) — jamais
    // un prénom, qui identifierait un tiers dans une phrase de détresse.
    const tours = CORPUS.map((c) => c.tour).join("\n");
    // Un mot capitalisé en milieu de phrase est le signal le plus simple d'un nom propre.
    const capitalisesEnMilieu = tours.match(/(?<![.!?]\s)(?<!^)\b[A-ZÉÈÀÂÎÔÛ][a-zéèêàâîïôöûü]{2,}/gm) ?? [];
    expect(capitalisesEnMilieu, `nom propre probable : ${capitalisesEnMilieu.join(", ")}`).toEqual([]);
  });

  it("la contrainte est ÉCRITE dans le fichier, pas seulement dans ce test", () => {
    expect(source).toMatch(/CHAQUE TOUR EST INVENTÉ/);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// LA MESURE — elle compte juste, et elle distingue les trois erreurs
// ══════════════════════════════════════════════════════════════════════════════════════════════

const obs = (id: string, obtenu: Observation["obtenu"]): Observation => ({ id, obtenu });

describe("[T4] `mesurer` distingue les trois façons de se tromper", () => {
  it("[CONTRÔLE POSITIF] un détecteur parfait ne rate rien", () => {
    const m = mesurer(CORPUS.map((c) => obs(c.id, c.attendu)));
    expect(m.exacts).toBe(CORPUS.length);
    expect(m.fauxPositifs).toBe(0);
    expect(m.fauxNegatifs).toBe(0);
    expect(m.tauxFauxPositifsOrdinaires).toBe(0);
    expect(m.rates).toEqual([]);
  });

  it("[LE CŒUR] la sur-classification d'un tour ordinaire est un FAUX POSITIF, et il est nommé", () => {
    const m = mesurer([obs("fp-mort-de-rire", 1), obs("fp-reunion-tuee", 0)]);
    expect(m.fauxPositifs).toBe(1);
    expect(m.rates).toEqual(["fp-mort-de-rire"]);
    expect(m.tauxFauxPositifsOrdinaires).toBe(0.5);
  });

  it("[LE CŒUR] la sous-classification d'un cas grave est un FAUX NÉGATIF — jamais confondue", () => {
    // Les deux erreurs n'ont pas le même coût : un faux positif retire une partie du produit ; un
    // faux négatif laisse quelqu'un sans filet. Les compter ensemble effacerait la seule distinction
    // qui compte.
    const m = mesurer([obs("n3-active", 1)]);
    expect(m.fauxNegatifs).toBe(1);
    expect(m.fauxPositifs).toBe(0);
  });

  it("[LE CŒUR] un repli sûr n'est NI l'un NI l'autre", () => {
    // ⚠️ Le détecteur qui n'arrive pas à classer rend niveau 1 par construction (AD-15). Le compter
    // comme une sur-classification ferait apparaître un défaut de SEUIL là où il n'y a qu'une panne,
    // et pousserait à baisser un seuil pour corriger un timeout.
    const m = mesurer([obs("fp-mort-de-rire", null), obs("n3-active", null)]);
    expect(m.replis).toBe(2);
    expect(m.fauxPositifs).toBe(0);
    expect(m.fauxNegatifs).toBe(0);
    expect(m.tauxFauxPositifsOrdinaires).toBe(0);
  });

  it("une observation hors corpus ne fabrique aucun chiffre", () => {
    const m = mesurer([obs("inexistant", 3)]);
    expect(m.exacts + m.fauxPositifs + m.fauxNegatifs + m.replis).toBe(0);
  });

  it("le seuil d'alerte est un DÉCLENCHEUR DE CONVERSATION, pas une cible appliquée par du code", () => {
    // Le nombre existe pour qu'un rapport puisse dire « c'est au-dessus ». Aucun module de
    // production ne le lit — s'il en lisait un, il déciderait d'un seuil clinique tout seul.
    expect(SEUIL_ALERTE_FAUX_POSITIFS).toBeGreaterThan(0);
    for (const f of ["lib/safety/classer-detresse.ts", "lib/safety/detecteur-detresse.ts", "lib/safety/pipeline.ts"]) {
      expect(
        readFileSync(resolve(RACINE, f), "utf-8"),
        `${f} consomme le corpus de mesure — l'instrument est devenu une règle`,
      ).not.toMatch(/corpus-detresse|SEUIL_ALERTE_FAUX_POSITIFS/);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// CE QUE LA STORY NE FAIT PAS, GARDÉ POUR QU'ON NE LE FASSE PAS PAR MÉGARDE
// ══════════════════════════════════════════════════════════════════════════════════════════════

describe("[T4] Aucun seuil n'a bougé", () => {
  it("[LE CŒUR] la table de classification est intacte : niveau → décision", () => {
    // Si quelqu'un « corrigeait » les faux positifs en déplaçant le niveau 1 vers `poursuivre`, tout
    // le protocole §5 basculerait sans qu'aucun autre test ne s'en aperçoive : `supprimerTravailSchema`
    // et `limites_levees` dérivent de là.
    expect(classerDetresse(0)).toMatchObject({ decision: "poursuivre", supprimerTravailSchema: false });
    expect(classerDetresse(1)).toMatchObject({ decision: "adoucir", supprimerTravailSchema: true });
    expect(classerDetresse(2)).toMatchObject({ decision: "intervenir", supprimerTravailSchema: true });
    expect(classerDetresse(3)).toMatchObject({ decision: "urgence", supprimerTravailSchema: true });
    expect(classerDetresse("illisible")).toMatchObject({ decision: "repli_sur", niveau: 1 });
  });

  it("le prompt de détection porte toujours son avertissement clinique", () => {
    // Tant que la porte pré-lancement n'est pas franchie, ce texte est la seule chose qui empêche de
    // prendre le placeholder pour un protocole.
    const src = readFileSync(resolve(RACINE, "lib/safety/detecteur-detresse.ts"), "utf-8");
    expect(src).toMatch(/À VALIDER PAR UN PRO/);
    expect(src).toMatch(/NE PAS EXPÉDIER/);
  });
});
