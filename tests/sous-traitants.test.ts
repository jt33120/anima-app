import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  PORTES_DECLAREES,
  RETENUS_PAR_LA_LOI,
  SOUS_TRAITANTS,
  type VerdictPropagation,
} from "@/lib/domain/sous-traitants";

/**
 * sous-traitants.test.ts — LA PROPAGATION, ÉPROUVÉE AUTREMENT QUE PAR UN COMMENTAIRE (Story 6.7, AC2).
 *
 * L'AC2 est marquée [DUR] : l'effacement « se propage aux sous-traitants ». La réponse facile aurait
 * été une phrase disant que le fournisseur IA est en zéro-rétention. Une phrase ne casse aucun build.
 *
 * Ici, chaque verdict doit DÉSIGNER ce qui le rend vrai — un fichier de garde qui existe, ou une
 * porte pré-lancement inscrite au suivi de sprint. Une affirmation qui ne pointe vers rien fait
 * rougir la CI.
 */

const racine = process.cwd();
const VERDICTS: readonly VerdictPropagation[] = [
  "rien_retenu",
  "fenetre_bornee",
  "retention_legale",
  "aucun_art9",
  "non_lie",
];

describe("[6.7/AC2] Chaque sous-traitant porte un verdict, et le verdict porte sa preuve", () => {
  it("le registre n'est pas vide et ne se répète pas", () => {
    expect(SOUS_TRAITANTS.length).toBeGreaterThanOrEqual(5);
    const cles = SOUS_TRAITANTS.map((s) => s.cle);
    expect(new Set(cles).size).toBe(cles.length);
  });

  it("chaque entrée est complète : rôle, verdict connu, motif, garde", () => {
    for (const s of SOUS_TRAITANTS) {
      expect(VERDICTS, `${s.cle} : verdict hors ensemble`).toContain(s.verdict);
      expect(s.role.length, `${s.cle} : rôle vide`).toBeGreaterThan(5);
      expect(s.motif.length, `${s.cle} : motif vide`).toBeGreaterThan(30);
      expect(s.garde.length, `${s.cle} : verdict sans preuve`).toBeGreaterThan(5);
    }
  });

  it("[LE CŒUR] chaque garde qui désigne un FICHIER désigne un fichier qui existe", () => {
    // C'est ce qui empêche un verdict de vieillir en silence : le jour où `egress-guard.ts`
    // disparaît ou change de nom, la promesse « rien n'est retenu chez lui » cesse d'être adossée à
    // quoi que ce soit — et la CI le dit avant que quelqu'un ne s'en aperçoive en production.
    const fichiers = SOUS_TRAITANTS.filter((s) => !s.garde.startsWith("porte:"));
    expect(fichiers.length, "plus aucun verdict n'est adossé à du code").toBeGreaterThanOrEqual(3);
    for (const s of fichiers) {
      expect(existsSync(resolve(racine, s.garde)), `${s.cle} : garde introuvable — ${s.garde}`).toBe(true);
    }
  });

  it("[ANTI-VACUITÉ] la vérification d'existence MORD sur un chemin inventé", () => {
    expect(existsSync(resolve(racine, "lib/ai/garde-qui-nexiste-pas.ts"))).toBe(false);
  });

  it("[LE CŒUR] chaque garde HUMAINE est inscrite au suivi de sprint", () => {
    // Une porte pré-lancement qui n'est écrite nulle part est une porte qu'on franchira sans la voir.
    const suivi = readFileSync(
      resolve(racine, "_bmad-output/implementation-artifacts/sprint-status.yaml"),
      "utf-8",
    );
    expect(PORTES_DECLAREES.length).toBeGreaterThan(0);
    for (const porte of PORTES_DECLAREES) {
      expect(suivi, `porte non inscrite au suivi de sprint : ${porte}`).toContain(porte);
    }
  });

  it("le fournisseur de modèle est adossé au point d'egress, pas à une déclaration", () => {
    const modele = SOUS_TRAITANTS.find((s) => s.cle === "modele")!;
    expect(modele.verdict).toBe("rien_retenu");
    // Le ZDR n'est pas une promesse écrite ici : l'egress-guard REFUSE l'envoi sans lui.
    expect(readFileSync(resolve(racine, modele.garde), "utf-8")).toMatch(/estZdrProuve/);
  });

  it("la base est adossée à la fenêtre bornée, écrite dans le schéma", () => {
    const base = SOUS_TRAITANTS.find((s) => s.cle === "base")!;
    expect(base.verdict).toBe("fenetre_bornee");
    expect(readFileSync(resolve(racine, base.garde), "utf-8")).toMatch(/survivance_jusqu_au/);
  });
});

describe("[6.7/AC1] Ce que l'effacement NE PEUT PAS retirer est dit, pas tu", () => {
  it("[LE CŒUR] la phrase est FABRIQUÉE depuis le registre, pas recopiée à la main", async () => {
    // Une facture émise relève d'une obligation de conservation, pas d'un consentement retiré. Le
    // taire serait le mensonge le plus facile de la page — et le plus tentant.
    //
    // ⚠️ CE TEST A CHANGÉ DE FORME APRÈS UN MUTANT SURVIVANT. Il lisait `page.tsx` et se contentait
    // d'y trouver le nom du registre. Or la phrase vivait derrière un `RETENUS_PAR_LA_LOI.length > 0
    // &&` : remplacer cette condition par `false` taisait ce qui reste SANS que le nom disparaisse
    // du fichier. La garde était verte sur une page devenue muette. La phrase a donc quitté le JSX
    // pour `lib/domain`, où elle est une valeur — et une valeur, ça s'éprouve.
    const { phraseCeQuiReste } = await import("@/lib/domain/copie-mes-donnees");
    expect(RETENUS_PAR_LA_LOI.length).toBeGreaterThan(0);

    const phrase = phraseCeQuiReste();
    for (const s of RETENUS_PAR_LA_LOI) {
      expect(phrase, `${s.cle} : sa rétention légale n'est pas annoncée`).toContain(s.motif);
      // ⚠️ QA tour 2 — LA PHRASE DOIT NOMMER QUI CONSERVE. Elle disait « les factures déjà émises
      // restent chez lui » : un « lui » sans antécédent sur l'écran de l'effacement art. 17, où le
      // seul référent accrochable était « Anam » — lecture factuellement fausse. Le `role` est
      // décrit dans le registre comme « en français d'utilisatrice » : un champ écrit pour être lu
      // par elle, et qu'aucun consommateur ne lisait.
      expect(phrase, `${s.cle} : la phrase ne dit pas QUI conserve`).toContain(s.role);
    }
    expect(phrase).toMatch(/légale|obligation/i);

    // Et l'écran l'affiche, sans condition qui puisse être neutralisée.
    const page = readFileSync(resolve(racine, "app/mes-donnees/page.tsx"), "utf-8");
    expect(page, "l'écran n'annonce plus ce qui reste").toMatch(/\{copie\.phraseCeQuiReste\(\)\}/);
  });

  it("aucun verdict ne prétend à un appel d'API qui n'existe pas", () => {
    // Il n'y a, à ce jour, aucun sous-traitant chez qui une donnée subsiste ET à qui l'on pourrait
    // envoyer un ordre d'effacement. Le jour où il y en aura un, il lui faudra un verdict de plus —
    // et cette garde forcera à l'écrire plutôt qu'à le supposer.
    for (const s of SOUS_TRAITANTS) {
      expect(VERDICTS).toContain(s.verdict);
      expect(s.verdict, `${s.cle} : verdict inventé`).not.toBe("appel_requis");
    }
  });
});
