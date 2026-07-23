/**
 * tokens.ts — SOURCE DE VÉRITÉ UNIQUE du design system Anam (Story 1.2).
 *
 * Données pures, aucun import Next/infra → importable par les tests-gardes.
 * Les valeurs sont copiées à l'identique de DESIGN.md (frontmatter + §Colors),
 * où chaque paire de couleur a déjà un ratio WCAG calculé et vérifié.
 *
 * Règle : globals.css NE FAIT QUE refléter ce module. La garde de parité
 * (tests/tokens-parite.test.ts) échoue si le CSS diverge d'une seule valeur.
 * Les clés de couleur sont le NOM EXACT de la variable CSS (`fond` → `--fond`).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Couleurs — mode nuit (mode natif, tokens sans suffixe)
// ─────────────────────────────────────────────────────────────────────────────
export const couleursNuit = {
  fond: "#0C0A1E",
  surface: "#16132F",
  "surface-elevee": "#201C42",
  texte: "#EEECF7",
  "texte-doux": "#ABA6C9",
  bordure: "#2A2648",
  "bordure-forte": "#77719C",
  accent: "#8FC1EF",
  "accent-doux": "#241F47",
  "sur-accent": "#0C0A1E",
  "arbre-tronc": "#6A6690",
  "arbre-branche": "#9A96BE",
  "arbre-feuillage": "#8FB6D8",
  succes: "#86B79E",
  alerte: "#D0A05C",
  lueur: "#CDE4F8",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Couleurs — mode accessibilité « contraste renforcé / imagerie atténuée ».
// PAS un thème jour. Mêmes clés/rôles que la nuit ; réaffectées aux var. CSS
// dans :root[data-a11y="contraste"] et @media (prefers-contrast: more).
// ─────────────────────────────────────────────────────────────────────────────
export const couleursClair: Record<keyof typeof couleursNuit, string> = {
  fond: "#F3F1FB",
  surface: "#FBFAFE",
  "surface-elevee": "#FFFFFF",
  texte: "#1B1836",
  "texte-doux": "#4C476B",
  bordure: "#DCD8EE",
  "bordure-forte": "#565179",
  accent: "#265F91",
  "accent-doux": "#E2ECF8",
  "sur-accent": "#FFFFFF",
  "arbre-tronc": "#5A5680",
  "arbre-branche": "#4A4670",
  "arbre-feuillage": "#3C6C93",
  succes: "#3B7357",
  alerte: "#8A5A16",
  lueur: "#3C6C93",
};

export type CleCouleur = keyof typeof couleursNuit;

// ─────────────────────────────────────────────────────────────────────────────
// Typographie — 8 rôles. Le sérif (Fraunces) = la voix d'Anam ; la grotesque
// (Inter) = l'interface et les mots de l'utilisatrice. Tailles en rem.
// ─────────────────────────────────────────────────────────────────────────────
export type Famille = "anam" | "ui"; // --police-anam (Fraunces) | --police-ui (Inter)

export interface RoleTypo {
  famille: Famille;
  tailleRem: number;
  tailleDesktopRem?: number; // ≥768px, si différent
  interligne: number;
  graisse: number; // jamais > 500 (règle dure DESIGN.md)
  /** Axes Fraunces pilotés en CSS ; absent pour Inter. */
  opsz?: number;
  soft?: number;
  wonk?: number;
  letterSpacingEm?: number;
}

export const echelleTypo = {
  display: { famille: "anam", tailleRem: 2, tailleDesktopRem: 2.5, interligne: 1.15, graisse: 400, opsz: 48, soft: 30, wonk: 0, letterSpacingEm: -0.01 },
  titre: { famille: "anam", tailleRem: 1.5, interligne: 1.25, graisse: 400, opsz: 32, soft: 30, wonk: 0 },
  "titre-sm": { famille: "anam", tailleRem: 1.125, interligne: 1.35, graisse: 500, opsz: 20, soft: 30, wonk: 0 },
  anam: { famille: "anam", tailleRem: 1.1875, interligne: 1.6, graisse: 400, opsz: 14, soft: 20, wonk: 0, letterSpacingEm: 0.005 },
  corps: { famille: "ui", tailleRem: 1, interligne: 1.65, graisse: 400 },
  meta: { famille: "ui", tailleRem: 0.8125, interligne: 1.45, graisse: 400 },
  surtitre: { famille: "ui", tailleRem: 0.75, interligne: 1.4, graisse: 500, letterSpacingEm: 0.06 },
  bouton: { famille: "ui", tailleRem: 0.9375, interligne: 1, graisse: 500, letterSpacingEm: 0.01 },
} as const satisfies Record<string, RoleTypo>;

export type CleRole = keyof typeof echelleTypo;

/** Bornes dures vérifiées par tests/typographie.test.ts (DESIGN.md §Typography). */
export const reglesTypo = {
  graisseMax: 500,
  interligneLectureMin: 1.6, // s'applique à `corps` et `anam`
  tailleMinRem: 0.8125, // 13px — plancher général
  // Exception documentée (DESIGN.md) : `surtitre` est une étiquette à 12px, posée
  // uniquement sur zone protégée/aplat, jamais sur un voile en dégradé.
  tailleMinExceptionRem: 0.75, // 12px
  rolesTailleReduite: ["surtitre"] as CleRole[],
  rolesLecture: ["corps", "anam"] as CleRole[],
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Espacement — base 8px. Exposé en variables --esp-1..9 + nommés.
// ─────────────────────────────────────────────────────────────────────────────
export const espacement = {
  "esp-1": "4px",
  "esp-2": "8px",
  "esp-3": "12px",
  "esp-4": "16px",
  "esp-5": "24px",
  "esp-6": "32px",
  "esp-7": "48px",
  "esp-8": "64px",
  "esp-9": "96px",
  "marge-mobile": "20px",
  "marge-desktop": "48px",
  respiration: "40px",
  mesure: "32rem",
  "contenu-max": "40rem",
  "cible-tactile": "44px",
} as const;

export const rayon = {
  "rayon-sm": "4px",
  rayon: "8px",
  "rayon-md": "12px",
  "rayon-lg": "16px",
  "rayon-full": "9999px",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Mouvement — le fondu lent de la nuit. Une seule courbe, aucun rebond.
// ─────────────────────────────────────────────────────────────────────────────
export const mouvement = {
  dureeCourteMs: 180,
  dureeStandardMs: 320,
  dureeLongueMs: 700,
  dureeRespirationMs: 4200,
  courbe: "cubic-bezier(0.32, 0.08, 0.24, 1)",
  deriveMaxPx: 6, // translateY bas→haut optionnel, JAMAIS latéral
} as const;
