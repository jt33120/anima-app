import "server-only";

/**
 * allocation-config.ts — Le VOLUME de l'allocation résiduelle (Story 3.4, AC3). Paramètre PRODUIT lu
 * de l'ENV à l'EXÉCUTION (SPINE L.151, FR-079 « ajustable, jamais codé en dur »), patron
 * `libelleReleveBancaire()` de `lib/stripe/config.ts`. Confiné serveur (`server-only`) : une limite de
 * quota n'a rien à faire dans un bundle client (AD-2).
 *
 * `null` = NON CONFIGURÉ → aucune coupure (le mécanisme reste inerte tant qu'ops ne pose pas la valeur ;
 * jamais de nombre-limite codé en dur, jamais coupé à zéro par défaut — FR-058). `0` = choix produit
 * VALIDE (coupe juste après le bilan), DISTINCT de non-configuré. Toute valeur non entière positive →
 * `null` (repli sûr : jamais une coupure sur une config douteuse). Lu à CHAQUE appel → ops ajuste sans
 * redéploiement de code.
 *
 * Unité : TOURS post-séance dans le mois courant (décision produit 3.4, cf. `lib/domain/allocation-residuelle`).
 */
export function limiteAllocationResiduelle(): number | null {
  const brut = process.env.ALLOCATION_RESIDUELLE_TOURS?.trim();
  if (!brut || !/^\d+$/.test(brut)) return null; // absent / non entier positif → aucune coupure
  return Number(brut);
}
