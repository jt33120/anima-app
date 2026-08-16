import type { Corps } from "@/lib/astro/port";
import { NOMBRES, type NomNombre } from "@/lib/astro/numerologie";
import { placer, type Signe, type ThemeNatal } from "@/lib/astro/theme-natal";
import type { HoroscopeDuJour } from "@/lib/astro/quotidien";
import { texteConfiguration, texteLuneRelative } from "@/lib/corpus/horoscope";
import { texteDe } from "@/lib/corpus/numerologie";
import { NON_ECRIT, type TexteCorpus } from "@/lib/corpus/port";
import type { Numerologie } from "@/lib/astro/numerologie";
import type { TypeEnneagramme } from "./enneagramme";
import type { CarteBibliotheque, LigneFait } from "./bibliotheque";

/**
 * cartes-socle.ts — LES CINQ CARTES, CONSTRUITES DEPUIS CE QUE LE SOCLE A CALCULÉ (Story 5.6, T5).
 *
 * Module PUR (AD-1) : il reçoit des résultats DÉJÀ LUS et rend des cartes. Aucune requête, aucune
 * horloge, aucun `server-only` — les `import type` depuis `lib/data` ne portent que des formes.
 * C'est ce qui rend les cinq cartes testables sans base, y compris dans leurs cas dégradés, qui
 * sont aujourd'hui **la majorité des cas**.
 *
 * ── LE VIDE EST LE CAS NORMAL, PAS LE CAS DÉGRADÉ ──────────────────────────────────────────────
 *
 * Le corpus d'Anima compte 165 créneaux déclarés et **0 écrit** (FR-054 + FR-086 : elle seule peut
 * les écrire). Les cinq cartes ne sont donc pas égales devant ce vide :
 *
 *     mantra       →  la carte EST le texte. Sans texte, elle n'a rien. Aucun fait à montrer.
 *     horoscope    →  des énumérations (`lune:…`, `configuration:…`), pas de la prose. Rien non plus.
 *     thème        →  Soleil en Balance… le fait se tient tout seul.
 *     nombres      →  chemin de vie 7… idem.
 *     ennéagramme  →  le type retenu, quand il y en a un.
 *
 * Trois cartes sur cinq peuvent donc montrer quelque chose aujourd'hui ; deux ne peuvent pas. Elles
 * restent AFFICHÉES et le disent (`estPresentable` les exclut seulement de la mise en avant) :
 * les masquer cacherait précisément le fait que le corpus est vide, sur le premier écran du produit.
 *
 * ── AUCUN `?? ""` NULLE PART ───────────────────────────────────────────────────────────────────
 *
 * `TexteCorpus` est une union pour une raison (`lib/corpus/port.ts`) : avec un optionnel, un `?? ""`
 * transformerait « Anima ne l'a pas encore écrit » en « il n'y a rien à dire », et les deux
 * s'afficheraient pareil. On transporte l'union jusqu'au rendu, qui tranche à l'affichage.
 */

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Les libellés — première et seule mise en mots du socle dans tout le produit
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ EXPORTÉ depuis la Story 6.5b, et l'en-tête ci-dessus dit pourquoi il ne doit pas être copié :
 * c'est la SEULE mise en mots des signes du produit. L'aperçu de correction (`/memoire`) en a besoin
 * pour nommer l'ascendant qu'une correction fait gagner ou perdre ; le dupliquer là-bas créerait
 * deux sources pour un même mot, dont l'une dériverait un jour sans que rien ne rougisse.
 */
export const SIGNE_LIBELLE: Readonly<Record<Signe, string>> = Object.freeze({
  belier: "Bélier",
  taureau: "Taureau",
  gemeaux: "Gémeaux",
  cancer: "Cancer",
  lion: "Lion",
  vierge: "Vierge",
  balance: "Balance",
  scorpion: "Scorpion",
  sagittaire: "Sagittaire",
  capricorne: "Capricorne",
  verseau: "Verseau",
  poissons: "Poissons",
});

const CORPS_LIBELLE: Readonly<Partial<Record<Corps, string>>> = Object.freeze({
  soleil: "Soleil",
  lune: "Lune",
  mercure: "Mercure",
  venus: "Vénus",
  mars: "Mars",
});

/**
 * Les corps que la carte du thème montre, dans l'ordre traditionnel. **Cinq, pas dix** : une carte
 * est un objet qu'on saisit d'un regard, pas un tableau d'éphémérides (`EXPERIENCE.md` : « la carte
 * comme objet reçu, pas comme ligne de menu »). Le thème complet vit dans sa fiche, pas ici.
 */
const CORPS_DE_CARTE: readonly Corps[] = Object.freeze(["soleil", "lune", "mercure", "venus", "mars"]);

const NOMBRE_LIBELLE: Readonly<Record<NomNombre, string>> = Object.freeze({
  chemin_de_vie: "Chemin de vie",
  expression: "Expression",
  intime: "Intime",
  personnalite: "Personnalité",
  jour_de_naissance: "Jour de naissance",
  annee_personnelle: "Année personnelle",
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Les cinq constructeurs
// ══════════════════════════════════════════════════════════════════════════════════════════════

/** Le mantra du jour — le seul morceau du socle qui ne demande rien à personne (5.4, AC6). */
export function carteMantra(texte: TexteCorpus): CarteBibliotheque {
  return {
    cle: "mantra",
    titre: "Le mantra du jour",
    // Le SEUL terme du glossaire présent dans la bibliothèque de la v1 (FR-080). La 5.9 ajoutera
    // « ancrage » et la 5.8 « lecture » — et chacune héritera de sa nature au lieu de la recopier.
    terme: "mantra",
    // Aucun fait : le mantra n'est pas calculé, il est ÉCRIT. Sans texte d'Anima, cette carte n'a
    // rien — et c'est ce qui l'exclut de la mise en avant du jour (AC5).
    faits: [],
    texte,
  };
}

/**
 * L'horoscope du jour.
 *
 * ⚠️ MÊME QUAND IL EST CALCULÉ, IL N'A PAS DE FAIT À MONTRER. Ce que la 5.4 produit, ce sont des
 * CLÉS de corpus (`lune:3`, `configuration:…`) : des énumérations destinées à choisir un texte, pas
 * à être lues. Les afficher telles quelles donnerait « lune:3 » sur une carte d'accueil.
 *
 * ⚠️ ET LE TEXTE SE RÉPÈTE DEUX À TROIS JOURS DE SUITE. `lune_relative` ne change que tous les
 * ~2,5 jours — la Lune met ce temps à traverser un signe (report explicite de la 5.4 vers cette
 * story). C'est le ciel qui est ainsi, pas un blocage : d'où la DATE portée par la carte, sans
 * laquelle deux jours identiques se liraient comme une panne.
 */
export function carteHoroscope(horoscope: HoroscopeDuJour | null): CarteBibliotheque {
  return {
    cle: "horoscope",
    titre: "Ton ciel du jour",
    terme: null,
    faits: [],
    // Un horoscope indisponible (pas de date de naissance, ou panne) n'a pas de texte non plus : on
    // ne fabrique pas un repli, on transmet l'absence telle quelle.
    texte: horoscope === null ? NON_ECRIT : texteDuCiel(horoscope),
  };
}

/**
 * Quel texte, parmi les deux que la 5.4 rend adressables ?
 *
 * La CONFIGURATION dominante d'abord — c'est elle qui distingue un jour d'un autre. À défaut (≈ un
 * jour sur deux, et « un jour sans configuration est un vrai jour »), la position relative de la
 * Lune, qui existe toujours. C'est le premier endroit du produit où ce choix se fait : la 5.4
 * produisait les deux clés sans trancher.
 */
function texteDuCiel(horoscope: HoroscopeDuJour): TexteCorpus {
  return texteConfiguration(horoscope.dominante) ?? texteLuneRelative(horoscope.luneRelative) ?? NON_ECRIT;
}

/**
 * Le thème natal.
 *
 * ⚠️ AUCUN DEGRÉ QUAND L'HEURE MANQUE (AC6, report de la 5.3). Sous `precision = "midi_par_defaut"`,
 * l'instant retenu est midi : la Lune est connue à ±7,7° près et tout ce qui dépend de l'heure est
 * incertain. Afficher « Lune à 12°34' du Cancer » serait **fabriquer de la précision** — un degré à
 * la minute d'arc sur une vérité qui vaut un quart de signe.
 *
 * Le SIGNE, lui, reste affiché : la 5.3 a déjà retiré du thème ceux qui sont indéterminables sans
 * heure (`signe_ambigu_sans_heure`), donc ce qui reste dans `positions` est sûr.
 *
 * On branche sur `precision` et non sur `manqueLHeure` : les deux questions diffèrent. `manqueLHeure`
 * demande « son heure réparerait-elle quelque chose ? » (faux au pôle, où l'heure est connue et les
 * angles n'existent pas) ; ici on demande « l'instant retenu est-il le vrai ? ».
 */
export function carteTheme(theme: ThemeNatal | null): CarteBibliotheque {
  return {
    cle: "theme",
    titre: "Ton thème",
    terme: null,
    faits: theme === null ? [] : faitsDuTheme(theme),
    // ⚠️ IL N'EXISTE AUCUN CORPUS DE THÈME, et ce n'est pas un oubli : les Stories 5.1 à 5.5 ont
    // déclaré des créneaux pour la numérologie (69), l'horoscope (27), le mantra (60) et
    // l'ennéagramme (9) — jamais pour le thème natal, dont l'interprétation n'a été cadrée par
    // aucune story. La carte montre donc ses faits et rien d'autre, honnêtement.
    texte: NON_ECRIT,
  };
}

function faitsDuTheme(theme: ThemeNatal): readonly LigneFait[] {
  const degreSur = theme.precision === "heure_connue";
  const lignes: LigneFait[] = [];

  for (const corps of CORPS_DE_CARTE) {
    const position = theme.positions.find((p) => p.corps === corps);
    // Absent = la 5.3 l'a retiré parce qu'il n'est pas déterminable. On ne le remplace par rien.
    if (!position) continue;
    const intitule = CORPS_LIBELLE[corps];
    if (!intitule) continue;
    lignes.push({ intitule, valeur: enSigne(position.signe, position.degre, degreSur) });
  }

  // L'ascendant n'est pas un corps : il vit dans les angles, et il n'existe que si l'heure existe.
  if (theme.angles.statut === "calcule") {
    const { signe, degre } = placer(theme.angles.ascendant);
    lignes.push({ intitule: "Ascendant", valeur: enSigne(signe, degre, degreSur) });
  }

  return Object.freeze(lignes);
}

/** « Balance » sans l'heure, « Balance, 12° » avec. Jamais de minutes d'arc : on n'en a pas besoin. */
function enSigne(signe: Signe, degre: number, avecDegre: boolean): string {
  const nom = SIGNE_LIBELLE[signe];
  return avecDegre ? `${nom}, ${Math.floor(degre)}°` : nom;
}

/**
 * Les nombres.
 *
 * Un nombre `non_calcule` (il manque le nom complet de naissance, par exemple) est simplement
 * ABSENT de la carte. Il n'y a pas de « — » ni de « non disponible » : la 5.2 a déjà tranché que
 * l'absence se dit dans la fiche du socle, pas en creux dans une liste.
 */
export function carteNombres(numerologie: Numerologie | null): CarteBibliotheque {
  const faits: LigneFait[] = [];
  let texte: TexteCorpus = NON_ECRIT;
  if (numerologie !== null) {
    for (const nom of NOMBRES) {
      const lecture = numerologie.nombres[nom];
      if (lecture.statut !== "calcule") continue;
      faits.push({ intitule: NOMBRE_LIBELLE[nom], valeur: String(lecture.valeur) });
    }
    // Le CHEMIN DE VIE porte le texte de la carte : c'est le nombre qu'on donne quand on n'en donne
    // qu'un. Les cinq autres ont leur texte dans la fiche du socle (5.2), pas ici — une carte qui
    // empilerait six interprétations ne serait plus un objet qu'on saisit d'un regard.
    texte = texteDe("chemin_de_vie", numerologie.nombres.chemin_de_vie) ?? NON_ECRIT;
  }
  return {
    cle: "nombres",
    titre: "Tes nombres",
    terme: null,
    faits: Object.freeze(faits),
    texte,
  };
}

/**
 * L'ennéagramme.
 *
 * ⚠️ LE FAIT EST UN CHIFFRE, ET CE CHIFFRE N'EST PAS UNE MESURE. C'est la raison pour laquelle la
 * garde FR-031 de cette story est structurelle et non lexicale : un test « aucun chiffre dans le
 * rendu de l'accueil » interdirait cette carte-ci et celle des nombres, c'est-à-dire deux des trois
 * cartes qui ont quelque chose à montrer.
 *
 * `sans_type` n'est PAS un incident : c'est l'état de départ de tout le monde (5.5). La carte
 * paraît sans fait et sans texte — comme le mantra —, et elle ne peut donc pas être mise en avant.
 */
export function carteEnneagramme(type: TypeEnneagramme | null, texte: TexteCorpus): CarteBibliotheque {
  return {
    cle: "enneagramme",
    titre: "Ton ennéagramme",
    terme: null,
    faits: type === null ? [] : Object.freeze([{ intitule: "Type", valeur: String(type) }]),
    // Le texte est attaché au résultat par la 5.5 elle-même — deux écrans le demanderaient sinon,
    // et l'un des deux finirait par écrire son propre repli.
    texte: type === null ? NON_ECRIT : texte,
  };
}
