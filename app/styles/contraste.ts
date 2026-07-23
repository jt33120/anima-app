/**
 * contraste.ts — Calcul WCAG 2.x du ratio de contraste. Pur, zéro dépendance,
 * entièrement auditable. Sert au gate qui casse le build (tests/contraste.test.ts).
 *
 * Formule : luminance relative sRGB linéarisée, puis (Lclair+0.05)/(Lsombre+0.05).
 */

/** Un canal sRGB 8 bits → composante linéaire. */
export function canalLineaire(canal8bits: number): number {
  const c = canal8bits / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** #RRGGBB → luminance relative (0 = noir, 1 = blanc). */
export function luminanceRelative(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Couleur hex invalide : « ${hex} » (attendu #RRGGBB)`);
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return (
    0.2126 * canalLineaire(r) +
    0.7152 * canalLineaire(g) +
    0.0722 * canalLineaire(b)
  );
}

/** Ratio de contraste WCAG entre deux couleurs #RRGGBB. Va de 1:1 à 21:1. */
export function ratioContraste(hex1: string, hex2: string): number {
  const l1 = luminanceRelative(hex1);
  const l2 = luminanceRelative(hex2);
  const clair = Math.max(l1, l2);
  const sombre = Math.min(l1, l2);
  return (clair + 0.05) / (sombre + 0.05);
}
