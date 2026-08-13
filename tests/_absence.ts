/**
 * L'EXTRACTEUR DES GARDES D'ABSENCE — « ce qui peut atteindre l'écran ».
 *
 * ══ POURQUOI CE FICHIER EXISTE (revue du 2026-08-12) ════════════════════════════════════════════
 *
 * Il vivait dans `tests/tronc-absence.test.ts`, et `tests/sortie-absence.test.ts` l'importait de là.
 * Un fichier de test importé par un autre est RE-EXÉCUTÉ dans le module qui l'importe : les 27 tests
 * du tronc tournaient deux fois, et le total annoncé de la suite était faux de 27. Un décompte faux
 * est une petite chose — mais c'est le décompte qui sert à dire « la suite est verte », et une
 * mesure qu'on ne peut pas croire ne prouve rien.
 *
 * Le module N'EST PAS un fichier de test (`_` en tête, pas de `.test.ts`) : rien ne s'y exécute à
 * l'import. Les tests de l'extracteur POUR LUI-MÊME restent dans `tronc-absence.test.ts` — c'est la
 * discipline (a) des gardes d'absence, et elle ne bouge pas d'un pouce.
 */

/** Commentaires retirés : un avertissement qui NOMME un interdit ne doit pas déclencher la garde. */
export function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * Les chaînes qui peuvent finir sous les yeux de quelqu'un : littéraux de chaîne + textes JSX.
 *
 * Les SPÉCIFICATEURS D'IMPORT sont retirés en premier. Sans ça, `import … from "./copie-arbre"`
 * peuplerait l'extrait de chemins de fichiers : la garde de présence deviendrait satisfaite par des
 * chaînes que personne ne voit jamais — une tautologie déguisée en preuve.
 */
export function texteVisible(src: string): string[] {
  const sans = sansCommentaires(src).replace(/\bfrom\s*(["'])(?:(?!\1).)*\1/g, " ");
  const trouves: string[] = [];
  for (const m of sans.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)) trouves.push(m[2]);
  // Textes JSX : ce qui vit entre `>` et `<` sans accolade ni balise.
  for (const m of sans.matchAll(/>([^<>{}]+)</g)) trouves.push(m[1]);
  return (
    trouves
      // Les INTERPOLATIONS `${…}` d'un gabarit sont des EXPRESSIONS, jamais du texte — exactement
      // comme les accolades JSX, déjà écartées ci-dessus. Sans ça, un nom de variable devenait du
      // « texte visible » : `${troncIncomplet ? … }` faisait rougir la garde du mot « incomplet »
      // pour un identifiant que personne ne lit jamais. La garde aurait fini par être assouplie.
      .map((s) => s.replace(/\$\{[^{}]*\}/g, " "))
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  );
}

/**
 * Une chaîne de STYLE est du placement, pas du texte.
 *
 * ⚠️ Introduit parce que la garde du POURCENTAGE (Story 5.3) rougissait sur
 * `translate(-50%, -50%)` — la contre-échelle qui garde les cibles à 44 px quel que soit le zoom.
 * L'alternative aurait été de retirer le motif : on aurait perdu la garde entière pour un faux
 * positif. L'exception est donc NOMMÉE, ÉTROITE, et éprouvée pour elle-même dans
 * `tronc-absence.test.ts` — jamais un assouplissement discret de l'extracteur, qui affaiblirait
 * TOUS les motifs à la fois.
 */
export function estValeurCss(chaine: string): boolean {
  return (
    /(?:translate|translateX|translateY|scale|rotate|calc|var|rgba?|hsla?)\s*\(/.test(chaine) ||
    /^-?\d+(?:[.,]\d+)?%$/.test(chaine.trim())
  );
}
