import type { StatutFait } from "@/lib/domain/fusion-fait";

/**
 * Port du RAPPEL OPPORTUN (AD-8, le côté LECTURE de la mémoire — miroir de `fusion-fait`/écriture).
 * Domaine PUR : aucune dépendance infra (Next/Supabase/SDK). `rappel` → `fusion-fait` est un import
 * domaine → domaine (pur), autorisé (AD-1). L'assembleur SÉLECTIONNE et MET EN FORME — il ne GÉNÈRE
 * jamais de contenu (la non-invention AC5 est structurelle, pas une décision LLM).
 */

/** Un fait candidat au rappel, DATÉ, portant son `statut` (pour le filtre défensif tombstone, AC3). */
export interface FaitDate {
  cleDedoublonnage: string;
  contenu: string;
  statut: StatutFait;
  /** ISO 8601 UTC — la matière datée qui permet à Anam de citer un point de comparaison réel (AC2). */
  creeLe: string;
  majLe: string;
}

/** Un fait retenu dans le rappel (sans `statut` : par construction, il est `actif`). */
export interface FaitRappel {
  cleDedoublonnage: string;
  contenu: string;
  creeLe: string;
  majLe: string;
}

/**
 * Le contexte de rappel assemblé. `aDeLaMatiere = false` est un signal EXPLICITE (AC5) : Anam ne doit
 * rien rappeler — l'absence de matière n'est jamais comblée par une généralité inventée.
 */
export interface Rappel {
  resume: string | null;
  faits: FaitRappel[];
  aDeLaMatiere: boolean;
}

export interface DepotRappel {
  /**
   * Assemble le rappel opportun sous JWT : résumé glissant + faits actifs datés (jamais un tombstone, AC3).
   * `limite` plafonne le nombre de faits (base déterministe de « pertinence » — classement fin différé).
   */
  assembler(limite?: number): Promise<Rappel>;
  /** Persiste le résumé glissant. Le CONTENU vient du futur rédacteur LLM (Story 4.4/4.9) ; ici, mécanique. */
  enregistrerResume(contenu: string): Promise<void>;
}

/**
 * Une chaîne est « blanche » si elle ne contient que de l'espace ECMA (`\p{White_Space}`) OU des caractères
 * de FORMAT invisibles (`\p{Cf}` : zéro-largeur U+200B/200C/200D/2060…). `String.trim()` seul raterait U+200B
 * (catégorie Cf, non retirée par trim) → faux positif de matière (revue 4.3, E). Verrou de la non-invention (AC5).
 */
function estBlanc(s: string): boolean {
  return s.replace(/[\p{White_Space}\p{Cf}]/gu, "") === "";
}

/**
 * Assemble le contexte de rappel — fonction PURE, propriétaire de la forme du rappel.
 *  (1) filtre défensif `statut='actif'` (AC3, niveau DOMAINE) : jamais un tombstone dans un rappel, même si
 *      un futur appelant (export Epic 6, synthèse 4.9) passe un ensemble plus large — non redondant avec le
 *      `where statut='actif'` de `charger_faits_actifs()` (qui garde le chemin live en base) ;
 *  (2) tri daté décroissant, ordre TOTAL (départage par `cleDedoublonnage`) ;
 *  (3) sélection déterministe plafonnée à `limite` ;
 *  (4) résumé normalisé (`null` si vide/blanc, invisibles Unicode compris) ;
 *  (5) non-invention (AC5) : de la matière = un résumé OU au moins un fait actif.
 */
export function assemblerRappel(entree: { resume: string | null; faits: FaitDate[]; limite?: number }): Rappel {
  const actifs = entree.faits.filter((f) => f.statut === "actif"); // (1) AC3 — garde tombstone domaine
  // (2) daté décroissant, ordre TOTAL : `cleDedoublonnage` départage les `creeLe` égaux (revue 4.3, B) → sélection
  // sous `limite` déterministe même si un futur appelant (export/synthèse) passe des faits à même date.
  const ordonnes = [...actifs].sort(
    (a, b) => b.creeLe.localeCompare(a.creeLe) || a.cleDedoublonnage.localeCompare(b.cleDedoublonnage),
  );
  const selection = typeof entree.limite === "number" ? ordonnes.slice(0, Math.max(0, entree.limite)) : ordonnes; // (3)
  const faits: FaitRappel[] = selection.map(({ cleDedoublonnage, contenu, creeLe, majLe }) => ({
    cleDedoublonnage,
    contenu,
    creeLe,
    majLe,
  }));
  const resume = entree.resume !== null && !estBlanc(entree.resume) ? entree.resume : null; // (4) null si vide/blanc
  const aDeLaMatiere = resume !== null || faits.length > 0; // (5) AC5 — vide et honnête, jamais inventé
  return { resume, faits, aDeLaMatiere };
}
