import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chercherPredictions } from "@/lib/domain/marqueurs-prediction";
import { chercherInterdits } from "@/lib/domain/lexique-interdit";
import { CLES_ENNEAGRAMME } from "@/lib/corpus/enneagramme";

/**
 * corpus-enneagramme-fiche.test.ts — LA FICHE D'ÉCRITURE DIT-ELLE LA VÉRITÉ ? (Story 5.5, T11)
 *
 * ⚠️ POURQUOI UNE FICHE POUR ANIMA A BESOIN D'UN TEST. Elle promet : « un contrôle refuse le texte
 * AVANT sa mise en ligne », et elle donne des exemples de ce qui passe et de ce qui ne passe pas.
 * Si un seul de ces exemples est faux, Anima écrit neuf textes dans une forme qu'on lui a dite
 * autorisée et qui fait rougir la CI — ou pire, elle s'interdit une forme parfaitement écrivable.
 *
 * Ce fichier exécute donc les VRAIS détecteurs sur les exemples de la fiche, extraits du markdown.
 * La fiche devient un jeu de tests connus-mauvais / connus-bons, maintenu par sa propre lecture :
 * le jour où quelqu'un y ajoute une ligne fausse, la CI le dit.
 */

const FICHE = "_bmad-output/implementation-artifacts/corpus-enneagramme-a-ecrire.md";
const source = readFileSync(resolve(__dirname, "..", FICHE), "utf8");

/** Les lignes de tableau « | « refusé » | « accepté » | ». */
const PAIRES = [...source.matchAll(/^\|\s*«\s*(.+?)\s*»\s*\|\s*«\s*(.+?)\s*»\s*\|\s*$/gm)].map(
  (m) => ({ refuse: m[1], accepte: m[2] }),
);

describe("[5.5/T11] la fiche d'écriture d'Anima ne lui ment pas", () => {
  it("[CONTRÔLE DU CONTRÔLE] les exemples ont bien été extraits", () => {
    // Sans ce témoin, tous les tests ci-dessous seraient vrais sur une liste vide — le mode d'échec
    // exact d'une garde dont l'extracteur casse (leçon `arbitrage-frontiere`).
    expect(PAIRES.length, "aucune paire extraite du markdown").toBeGreaterThanOrEqual(8);
  });

  it("[LE CŒUR] chaque exemple ❌ est RÉELLEMENT refusé par un détecteur", () => {
    for (const { refuse } of PAIRES) {
      const detecte =
        chercherPredictions(refuse).length > 0 || chercherInterdits(refuse).length > 0;
      expect(detecte, `« ${refuse} » est donné comme refusé, mais AUCUN détecteur ne le voit`).toBe(
        true,
      );
    }
  });

  it("[LE CŒUR] chaque exemple ✅ est RÉELLEMENT écrivable", () => {
    // L'erreur symétrique, et elle coûte autant : interdire à Anima une forme qui passe la CI la
    // ferait tourner autour de ce qu'elle veut dire pour rien.
    for (const { accepte } of PAIRES) {
      expect(chercherPredictions(accepte), `prédiction dans « ${accepte} »`).toEqual([]);
      expect(chercherInterdits(accepte), `lexique interdit dans « ${accepte} »`).toEqual([]);
    }
  });

  it("les neuf créneaux annoncés sont ceux du code", () => {
    // Une fiche qui nomme des créneaux inexistants ferait écrire dans le vide.
    for (const cle of CLES_ENNEAGRAMME) {
      expect(source, `le créneau ${cle} manque à la fiche`).toContain(`\`${cle}\``);
    }
    expect(CLES_ENNEAGRAMME).toHaveLength(9);
  });

  it("la fiche redit les trois interdits que la 5.5 a ajoutés", () => {
    // Elle est la seule trace que verra Anima : si un interdit n'y figure pas, il n'existe pas
    // pour elle. C'est la doctrine de ce dépôt appliquée à un document — une garde qui ne vit que
    // dans le code ne prévient personne.
    for (const attendu of ["troisième personne", "adjectifs", "diagnostic", "Aucun chiffre"]) {
      expect(source, `la fiche ne mentionne pas « ${attendu} »`).toContain(attendu);
    }
  });
});
