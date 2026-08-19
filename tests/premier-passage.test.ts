import { describe, it, expect } from "vitest";
import { premierPassage } from "@/lib/domain/premier-passage";

/**
 * premier-passage.test.ts — LA DÉCISION DU PREMIER PASSAGE (H4, QA visuelle du 2026-08-19).
 *
 * Le module est minuscule et c'est voulu : il décide DEUX booléens. Ce qui mérite d'être gardé
 * n'est pas sa complexité, c'est la DIRECTION de ses deux replis — qui ne penchent pas du même
 * côté, et dont l'inversion ne se verrait dans aucun écran de développement.
 */

const carte = (statut: "ecrit" | "non_ecrit") => ({ texte: { statut } }) as const;

describe("[H4] le texte d'orientation est-il dû ?", () => {
  it("[LE CŒUR] jamais franchi ⇒ dû", () => {
    expect(premierPassage(null, []).du).toBe(true);
  });

  it("[LE CŒUR] déjà franchi ⇒ plus jamais", () => {
    // Une date, quelle qu'elle soit, ferme la porte définitivement. Il n'y a pas de « depuis
    // moins de N jours » : une présentation qui revient est une présentation qu'on n'a pas lue.
    expect(premierPassage("2026-08-19T10:00:00Z", []).du).toBe(false);
  });

  it("[LE REPLI] une date illisible se lit comme « jamais franchi » — on se répète plutôt que de se taire", () => {
    // Le dépôt replie sur `null` quand la lecture échoue. Le coût du repli est d'entendre deux
    // fois une présentation ; le coût inverse serait de faire entrer quelqu'un dans un lieu qu'on
    // ne lui a pas présenté, juste après lui avoir fait accepter d'y déposer des données de
    // l'article 9. C'est le constat H4 lui-même.
    expect(premierPassage(null, [carte("ecrit")]).du).toBe(true);
  });
});

describe("[H4] la note sur les cartes encore vides", () => {
  it("[LE CŒUR] une seule carte non écrite suffit à la dire", () => {
    expect(premierPassage(null, [carte("ecrit"), carte("non_ecrit")]).desCartesAttendent).toBe(true);
  });

  it("[LE CŒUR] toutes écrites ⇒ la phrase disparaît D'ELLE-MÊME", () => {
    // ⚠️ C'EST LA RAISON D'ÊTRE DE CE CHAMP. Écrite en dur, cette phrase resterait vraie jusqu'au
    // jour où le corpus serait fini, puis fausse pour toujours — et personne n'aurait de raison de
    // rouvrir ce fichier ce jour-là. Une phrase de bienvenue périmée est pire que pas de phrase.
    expect(premierPassage(null, [carte("ecrit"), carte("ecrit")]).desCartesAttendent).toBe(false);
  });

  it("[LE REPLI] bibliothèque illisible ⇒ on se TAIT, on ne promet pas", () => {
    // L'autre repli, et il penche dans l'autre sens : on ne dit pas « certaines cartes sont encore
    // vides » à quelqu'un dont on ne sait pas ce que ses cartes contiennent.
    expect(premierPassage(null, null).desCartesAttendent).toBe(false);
    expect(premierPassage(null, []).desCartesAttendent).toBe(false);
  });

  it("le passage n'est plus dû : la note ne peut plus paraître, quoi qu'en dise la bibliothèque", () => {
    // Elle vit DANS le bloc : `du: false` la rend inatteignable. La garde tient à ce que le rendu
    // ne l'affiche pas ailleurs — c'est `tests/rendu/premier-passage.test.tsx` qui l'éprouve.
    const p = premierPassage("2026-08-19T10:00:00Z", [carte("non_ecrit")]);
    expect(p.du).toBe(false);
    expect(p.desCartesAttendent).toBe(true);
  });
});
