import { describe, it, expect } from "vitest";
import { etapeRecevable, echeanceRecevable, demainParis, INTENTION_LONGUEUR_MAX } from "@/render/intention";
import { echeanceRecevable as echeanceServeur, INTENTION_LONGUEUR_MAX as MAX_SERVEUR } from "@/lib/domain/intention";

/**
 * Story 4.10 (revue) — LE MIROIR DE RENDU DE LA FORME ET DE L'ÉCHÉANCE, éprouvé pour lui-même.
 *
 * ⚠️ CE FICHIER EXISTE PARCE QUE LA MUTATION-VÉRIFICATION A TROUVÉ LE TROU. `render/intention.ts` n'était
 * exercé qu'INDIRECTEMENT, par le composant : muter `echeanceRecevable` pour qu'il accepte de nouveau
 * « aujourd'hui » ne faisait rougir aucun test, parce que le seul test de rendu qui touchait aux dates
 * regardait l'attribut `min` — qui vient d'une AUTRE fonction.
 *
 * La leçon R1-bis dit qu'un miroir est une divergence en attente. Elle vaut aussi pour les tests : un
 * miroir qui n'est éprouvé qu'à travers son consommateur n'est pas éprouvé.
 */

/** 12 h à Paris le 6 août : le jour civil est sans ambiguïté. */
const MIDI = new Date("2026-08-06T10:00:00Z");

describe("[revue 4.10] l'échéance commence DEMAIN, des deux côtés de la frontière", () => {
  it("[LE CŒUR] aujourd'hui est refusé — le rappel du jour est déjà parti", () => {
    // Mutation-cible : `>= aujourd'hui` au lieu de `>= demain`. Le tick de l'ordonnanceur passe à
    // 06:00 UTC et `rappels_echeance_dus` ne regarde QUE `echeance = aujourd'hui` : une échéance posée
    // dans la journée arrive APRÈS son propre rappel, et rien n'est rattrapé.
    expect(echeanceRecevable("2026-08-06", MIDI), "aujourd'hui").toBe(false);
    expect(echeanceRecevable("2026-08-07", MIDI), "demain").toBe(true);
    expect(echeanceRecevable("2026-08-05", MIDI), "hier").toBe(false);
  });

  it("[R1-bis] le miroir de rendu et le domaine disent EXACTEMENT la même chose", () => {
    // Deux implémentations (le rendu ne peut pas importer `lib/`, frontière AD-7) : elles doivent
    // coïncider. Ni plus faible (l'app laisserait partir une requête que la route refuse), ni plus
    // stricte (elle bloquerait un champ que le serveur accepterait).
    const cas = [
      null,
      "",
      "2026-08-05",
      "2026-08-06",
      "2026-08-07",
      "2027-01-01",
      "2026-02-31",
      "2026-13-01",
      "06/08/2026",
      "2026-8-6",
      "demain",
    ];
    for (const c of cas) {
      expect(echeanceRecevable(c, MIDI), `RENDU : ${JSON.stringify(c)}`).toBe(
        // Le domaine ne connaît pas la chaîne vide (elle vient du champ de saisie) : on la traite comme
        // « pas d'échéance », exactement comme le rendu.
        echeanceServeur(c === "" ? null : c, MIDI),
      );
    }
  });

  it("le jour de bord est celui de PARIS, pas d'UTC", () => {
    // 23 h 30 UTC le 5 = 1 h 30 le 6 à Paris → demain est le 7.
    const tard = new Date("2026-08-05T23:30:00Z");
    expect(demainParis(tard)).toBe("2026-08-07");
    expect(echeanceRecevable("2026-08-07", tard)).toBe(true);
    expect(echeanceRecevable("2026-08-06", tard)).toBe(false);
  });

  it("aucune échéance reste toujours légitime", () => {
    expect(echeanceRecevable(null, MIDI)).toBe(true);
    expect(echeanceRecevable("", MIDI), "le champ vide du formulaire").toBe(true);
  });
});

describe("[AC1] la forme, côté rendu", () => {
  it("les deux moitiés, ou rien", () => {
    expect(etapeRecevable("si", "alors")).toBe(true);
    expect(etapeRecevable("si", "  ")).toBe(false);
    expect(etapeRecevable(" ", "alors")).toBe(false);
  });

  it("la borne est CELLE du domaine, pas une seconde valeur", () => {
    expect(INTENTION_LONGUEUR_MAX).toBe(MAX_SERVEUR);
    expect(etapeRecevable("a".repeat(INTENTION_LONGUEUR_MAX), "alors")).toBe(true);
    expect(etapeRecevable("a".repeat(INTENTION_LONGUEUR_MAX + 1), "alors")).toBe(false);
  });
});
