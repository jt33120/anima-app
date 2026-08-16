import { placer, type Signe, type ThemeNatal } from "@/lib/astro/theme-natal";

/**
 * correction-naissance.ts — CORRIGER SES ENTRÉES DE NAISSANCE, EN DOMAINE PUR (Story 6.5b, art. 16).
 *
 * Zéro I/O, zéro `process.env` (AD-1). Ce fichier porte deux choses, et rien d'autre :
 *   • ce qui fait qu'une heure saisie est RECEVABLE ;
 *   • ce qu'une correction CHANGE, formulé comme une comparaison entre deux thèmes.
 *
 * ══ POURQUOI LA COMPARAISON EST UN OBJET DU DOMAINE, ET PAS UNE PHRASE ═══════════════════════════
 *
 * Le réflexe serait de rendre directement le texte à afficher (« ton ascendant passe de Verseau à
 * Balance »). Ce serait une faute de couche à un endroit où elle coûte : la phrase, elle, se
 * relit — Anima relit la copie du produit dans des fichiers `copie-*.ts`, pas dans des retours de
 * fonctions. La comparaison rend des SIGNES et des NOMBRES ; `copie-naissance.ts` les met en mots.
 *
 * ══ RIEN ICI NE DÉCIDE SI LA CORRECTION EST PERMISE ══════════════════════════════════════════════
 *
 * Ce module valide une SAISIE, il ne garde rien. Ce qui autorise ou refuse une correction vit dans
 * le trigger `naissance_corrigible` (migration 0060) : `authenticated` détient les privilèges DML
 * sur `utilisatrice`, et une garde qui ne vivrait qu'ici ne garderait rien.
 */

/** Pourquoi une saisie d'heure est refusée. Ensemble FERMÉ — l'écran en dérive ses messages. */
export type RefusHeure = "format" | "inexistante" | "inchangee";

export type SaisieHeure =
  | { readonly ok: true; readonly heure: string }
  | { readonly ok: false; readonly refus: RefusHeure };

/**
 * Une heure saisie, normalisée en `HH:MM:SS`, ou son refus.
 *
 * ⚠️ ON NE « RÉPARE » PAS UNE SAISIE. `7h15`, `7:5`, `19h` sont refusés plutôt que devinés : une
 * heure mal lue ne produit pas une erreur visible, elle produit un ascendant faux qui a l'air juste.
 * C'est la règle que la 5.3 avait déjà posée pour la première écriture, et elle vaut d'autant plus
 * ici que la correction est justement le recours de quelqu'un qui s'est déjà trompé une fois.
 *
 * `actuelle` est l'heure déjà gravée (`HH:MM:SS`) ou `null`. Une correction qui ne change rien est
 * refusée AVANT la base : le trigger la laisserait passer sans la compter (elle n'est pas une
 * correction), et l'écran annoncerait un succès qui n'a rien fait.
 */
export function normaliserHeure(brut: string, actuelle: string | null): SaisieHeure {
  const nettoye = brut.trim();
  if (!/^\d{2}:\d{2}(?::\d{2})?$/.test(nettoye)) return { ok: false, refus: "format" };

  const [hh, mm, ss = 0] = nettoye.split(":").map(Number);
  if (hh > 23 || mm > 59 || ss > 59) return { ok: false, refus: "inexistante" };

  const heure = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  // Un `actuelle !== null &&` figurait ici. La campagne de mutation l'a montré MORT : `heure` est
  // une chaîne, `heure === null` est toujours faux, donc la garde ne changeait rien. Le retirer
  // n'est pas un raccourci — c'est enlever une condition qui donnait l'illusion d'un cas traité.
  if (heure === actuelle) return { ok: false, refus: "inchangee" };
  return { ok: true, heure };
}

// ══════════════════════════════════════════════════════════════════════════════════════════════

/** Le signe de l'ascendant d'un thème, ou `null` s'il n'a pas pu être calculé. */
export function ascendantDe(theme: ThemeNatal): Signe | null {
  return theme.angles.statut === "calcule" ? placer(theme.angles.ascendant).signe : null;
}

/**
 * Ce qu'une correction change, mesuré sur les deux thèmes plutôt que raconté.
 *
 * `corpsRegagnes` peut être NÉGATIF, et il fallait que ce soit possible : une correction peut très
 * bien appauvrir le thème (un fuseau corrigé qui rend un signe ambigu). Rendre `Math.max(0, …)`
 * aurait caché exactement le cas où elle a le plus besoin de voir avant de valider.
 */
export interface ApercuCorrection {
  readonly ascendantAvant: Signe | null;
  readonly ascendantApres: Signe | null;
  readonly precisionAvant: ThemeNatal["precision"];
  readonly precisionApres: ThemeNatal["precision"];
  /** Corps devenus calculables (positif) ou perdus (négatif). */
  readonly corpsRegagnes: number;
  /**
   * Rien de ce que cet aperçu MONTRE ne change — ce qui n'est pas « rien ne change » : les
   * longitudes, elles, ont bougé de quelques minutes d'arc.
   *
   * ⚠️ Et c'est le bon grain POUR CE PRODUIT, pas un raccourci : on ne livre que les maisons en
   * SIGNES ENTIERS, où la maison I est le signe de l'ascendant. Tant que le signe ne change pas,
   * aucune maison ne change, donc rien de ce qu'elle lit ne change. Le jour où Placidus arrive, ce
   * champ devient faux et devra descendre au degré — c'est écrit ici pour qu'on le sache alors.
   */
  readonly sansChangementVisible: boolean;
}

export function comparerThemes(avant: ThemeNatal, apres: ThemeNatal): ApercuCorrection {
  const ascendantAvant = ascendantDe(avant);
  const ascendantApres = ascendantDe(apres);
  const corpsRegagnes = avant.absents.length - apres.absents.length;
  return {
    ascendantAvant,
    ascendantApres,
    precisionAvant: avant.precision,
    precisionApres: apres.precision,
    corpsRegagnes,
    sansChangementVisible:
      ascendantAvant === ascendantApres &&
      avant.precision === apres.precision &&
      corpsRegagnes === 0,
  };
}
