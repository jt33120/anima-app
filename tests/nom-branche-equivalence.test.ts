import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { nomValide, NOM_LONGUEUR_MAX as MAX_DOMAINE } from "@/lib/domain/branche";
import { nomDonne, nomRecevable, rognerNom, NOM_LONGUEUR_MAX as MAX_RENDU } from "@/render/nom-branche";

/**
 * [R1-bis] LES TROIS COPIES DE LA GARDE DE NOM SONT ÉQUIVALENTES — prouvé caractère par caractère.
 *
 * Il en existe trois, et c'est VOULU : la base (`public.branche_nom_significatif`, migration 0024) est
 * l'autorité ; `lib/domain/branche.ts` la reflète côté serveur ; `render/nom-branche.ts` la reflète côté
 * client (le rendu ne peut pas importer `lib/`, frontière AD-7). Trois copies, c'est trois occasions de
 * diverger — et la leçon R1-bis dit qu'une divergence EST un contournement :
 *   • une copie client plus FAIBLE laisse activer un bouton pour un nom que la base refusera toujours
 *     (l'app invite alors à « réessayer » l'impossible, sur un caractère invisible par construction) ;
 *   • une copie client plus STRICTE bloque un nom que la base accepterait — elle décide à sa place.
 *
 * La re-revue a trouvé les deux formes : la classe laissait passer 20 invisibles (dont U+FE0F, présent dans
 * presque tout copier-coller d'emoji), et la borne de longueur n'existait QU'en base.
 */

const url = process.env.SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;
const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });

/** Les invisibles que la base doit refuser — dont ceux qui passaient AVANT la migration 0024. */
const INVISIBLES: [number, string][] = [
  [0x00a0, "espace insécable"],
  [0x00ad, "trait d'union conditionnel"],
  [0x034f, "combining grapheme joiner"],
  [0x061c, "arabic letter mark"],
  [0x115f, "remplisseur jamo initial"],
  [0x1160, "remplisseur jamo médian"],
  [0x17b4, "voyelle inhérente khmère AQ"],
  [0x17b5, "voyelle inhérente khmère AA"],
  [0x180b, "sélecteur de variation mongol 1"],
  [0x180e, "séparateur de voyelle mongol"],
  [0x200b, "espace de largeur nulle"],
  [0x200f, "marque droite-à-gauche"],
  [0x2060, "liant de mots"],
  [0x2065, "invisible non attribué"],
  [0x2800, "braille blanc"],
  [0x3000, "espace idéographique"],
  [0x3164, "remplisseur hangul"],
  [0xfe00, "sélecteur de variation 1"],
  [0xfe0f, "sélecteur de variation 16"],
  [0xfeff, "marque d'ordre des octets"],
  [0xffa0, "remplisseur hangul demi-chasse"],
  [0xfff9, "ancre d'annotation interlinéaire"],
  [0x1d173, "début de ligature musicale"],
  [0xe0001, "balise de langue"],
  [0xe0100, "sélecteur de variation supplémentaire"],
];

/** Des noms RÉELS, qui doivent tous rester acceptés (sinon la garde est un bâillon, pas un filtre). */
const VRAIS_NOMS = [
  "mes propres mots",
  "日本",
  "❤ ça",
  "❤️", // cœur + U+FE0F : le sélecteur est retiré, le cœur reste → c'est un nom
  "🙂",
  "𝄞",
  "é", // e + accent combinant
  "  a  ",
  "l'histoire que je me raconte",
];

describe("[R1-bis] la garde de nom : base ⟺ domaine ⟺ rendu", () => {
  it("les DEUX bornes de longueur applicatives valent la même chose", () => {
    expect(MAX_DOMAINE).toBe(MAX_RENDU);
  });

  // `retry` : ce test fait ~25 allers-retours vers Postgres et a floconné UNE fois sur quatre passes
  // complètes, sous la charge parallèle de la suite. La reprise ne masque PAS un vrai défaut — un verdict
  // faux est déterministe et échouerait les trois tentatives ; seule une panne de transport est absorbée.
  it("un caractère SANS GLYPHE n'est un nom pour AUCUNE des trois copies", { retry: 2 }, async () => {
    for (const [cp, quoi] of INVISIBLES) {
      const nom = String.fromCodePoint(cp);
      const { data, error } = await admin.rpc("branche_nom_significatif", { p_nom: nom });
      expect(error, `appel SQL pour ${quoi} (U+${cp.toString(16)})`).toBeNull();
      expect(data, `BASE : « ${quoi} » (U+${cp.toString(16)}) est accepté comme un nom`).toBe(false);
      expect(nomValide(nom), `DOMAINE : « ${quoi} » (U+${cp.toString(16)})`).toBe(false);
      expect(nomDonne(nom), `RENDU : « ${quoi} » (U+${cp.toString(16)})`).toBe(false);
    }
  });

  it("un VRAI nom est accepté par les trois (la garde ne bâillonne personne)", async () => {
    for (const nom of VRAIS_NOMS) {
      const { data, error } = await admin.rpc("branche_nom_significatif", { p_nom: nom });
      expect(error).toBeNull();
      expect(data, `BASE : « ${nom} » doit être un nom valide`).toBe(true);
      expect(nomValide(nom), `DOMAINE : « ${nom} »`).toBe(true);
      expect(nomDonne(nom), `RENDU : « ${nom} »`).toBe(true);
    }
  });

  it("le ROGNAGE du rendu donne le même résultat que celui de la base", async () => {
    // Construits par CODE POINT : écrire des invisibles littéraux dans un test les rend
    // invérifiables à la relecture (et un éditeur les mange au premier reformatage).
    const i = (cp: number) => String.fromCodePoint(cp);
    const cas = ["  mes mots  ", `${i(0x200b)}mes mots${i(0x200b)}`, `${i(0xfe0f)}mes mots${i(0x00a0)}`,
                 "mes mots", `${i(0x3000)}a${i(0x3000)}`];
    for (const brut of cas) {
      const { data, error } = await admin.rpc("branche_rogner_nom", { p_nom: brut });
      expect(error).toBeNull();
      expect(rognerNom(brut), `rognage divergent pour ${JSON.stringify(brut)}`).toBe(data);
    }
  });

  it("la BORNE de longueur mord des deux côtés, au même caractère près", async () => {
    const pile = "a".repeat(MAX_DOMAINE);
    const trop = "a".repeat(MAX_DOMAINE + 1);
    expect(nomValide(pile)).toBe(true);
    expect(nomRecevable(pile)).toBe(true);
    expect(nomValide(trop), "le domaine accepte un nom hors borne").toBe(false);
    expect(nomRecevable(trop), "le rendu accepte un nom hors borne").toBe(false);
    // Côté base, la borne est un CHECK de colonne : on l'éprouve en insertion dans branche-correctifs.
  });
});
