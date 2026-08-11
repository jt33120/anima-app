import type { Corps } from "@/lib/astro/port";
import type {
  RaisonAbsenceCorps,
  RaisonSansAngles,
  ThemeNatal,
} from "@/lib/astro/theme-natal";

/**
 * socle-incomplet.ts — L'INVENTAIRE DE CE QUI MANQUE AU SOCLE (Story 5.3, T3 — FR-049/FR-050).
 *
 * Module PUR (AD-1) : zéro I/O, zéro base, zéro horloge. Il ne fait que LIRE un thème natal déjà
 * calculé et répondre à deux questions que personne d'autre n'a le droit de trancher :
 *
 *   • qu'est-ce qui manque, et pour quelle raison ?
 *   • est-ce que SON HEURE le réparerait ?
 *
 * ── POURQUOI CES DEUX QUESTIONS SONT DIFFÉRENTES ───────────────────────────────────────────────
 *
 * Le thème natal sait déjà déclarer ses absences (`angles.raison`, `absents[]`) — c'est l'acquis de
 * la 5.1 et de la 5.2. Ce qu'il ne sait pas, c'est lesquelles de ces absences ELLE peut combler.
 * Trois cas se ressemblent à la lecture du thème et n'ont rien à voir pour elle :
 *
 *   • CHIRON manque parce qu'aucune source ne le calcule. Lui proposer d'ajouter son heure serait
 *     lui faire faire une démarche à la mairie pour rien ;
 *   • l'ASCENDANT manque parce que l'heure manque. Là, sa démarche répare vraiment quelque chose ;
 *   • une naissance au PÔLE GÉOGRAPHIQUE EXACT n'a pas d'ascendant — ce n'est pas une donnée
 *     manquante, c'est une limite de la notion. Aucune heure au monde ne la lèvera.
 *
 * Confondre les trois donnerait une invitation qui ne mène nulle part, c'est-à-dire un reproche
 * déguisé — la faute exacte que la 4.10 a corrigée sur l'invitation d'intégration.
 *
 * ── LE PRÉDICAT DU TRONC EST `manqueLHeure`, PAS « LES ANGLES SONT ABSENTS » ───────────────────
 *
 * Le contexte de story écrivait `socleComplet ≡ angles.statut === "calcule"`. C'est vrai dans
 * 99,99 % des cas et faux au pôle : le tronc s'afficherait incomplet, la fiche dirait « il me
 * manque ton heure », et cette heure-là est déjà connue. On dérive donc le drapeau de l'INVENTAIRE
 * plutôt que d'un statut — une seule source, et elle dit la vérité partout.
 */

// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Une absence, avec sa raison. Union fermée : une raison en texte libre finirait en phrase
 * d'excuse, donc en prose dans le socle — ce que FR-053 rend structurellement impossible depuis la
 * 5.1 (`theme_natal.contenu` ne porte que des nombres et des énumérations).
 */
export type Manquant =
  | { readonly quoi: "angles"; readonly raison: RaisonSansAngles }
  | { readonly quoi: "corps"; readonly corps: Corps; readonly raison: RaisonAbsenceCorps };

/** Tout ce que le thème déclare absent, angles compris. Vide ⇒ rien ne manque. */
export function manquantsDuSocle(theme: ThemeNatal): readonly Manquant[] {
  const manquants: Manquant[] = [];
  if (theme.angles.statut === "non_calcule") {
    manquants.push({ quoi: "angles", raison: theme.angles.raison });
  }
  for (const a of theme.absents) {
    manquants.push({ quoi: "corps", corps: a.corps, raison: a.raison });
  }
  return Object.freeze(manquants);
}

/**
 * Son heure de naissance (et le lieu qui va avec) comblerait-elle CETTE absence-là ?
 *
 * ⚠️ `fuseau_invalide` est délibérément traité comme NON réparable. C'est un identifiant IANA
 * erroné en base — un défaut de donnée, pas une information qu'elle n'a jamais donnée. Elle a déjà
 * fourni son heure ; l'inviter à recommencer lui ferait porter un bogue qui n'est pas le sien, et
 * la migration 0039 refuserait de toute façon la réécriture (write-once).
 */
export function reparableParLHeure(m: Manquant): boolean {
  if (m.quoi === "angles") {
    return (
      m.raison === "heure_absente" ||
      m.raison === "fuseau_absent" ||
      m.raison === "coordonnees_absentes"
    );
  }
  return m.raison === "signe_ambigu_sans_heure";
}

/**
 * Le tronc est-il incomplet ? Vrai si — et seulement si — au moins une absence serait comblée par
 * son heure de naissance.
 */
export function manqueLHeure(theme: ThemeNatal): boolean {
  return manquantsDuSocle(theme).some(reparableParLHeure);
}
