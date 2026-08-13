/**
 * normalisation-texte.ts — LA NORMALISATION PARTAGÉE DES DÉTECTEURS DE TEXTE.
 *
 * ══ POURQUOI CE MODULE EXISTE (revue du 2026-08-12) ══════════════════════════════════════════════
 *
 * `lexique-interdit.ts` (la voix, 2.8) et `marqueurs-prediction.ts` (FR-053, 5.2) portaient CHACUN
 * leur `normaliser()`, à l'identique. Le second se déclare même en toutes lettres « miroir
 * structurel » du premier.
 *
 * Deux implémentations d'un même invariant divergent — c'est la leçon R1-bis de ce dépôt, et elle
 * s'est vérifiée le jour même : le détecteur de prédiction a été élargi le 2026-08-12 pour accepter
 * UN MOT INTERCALÉ (« tu **ne** verras »), après avoir mesuré qu'il n'attrapait que deux phrases
 * prédictives sur onze. Le correctif n'a jamais traversé le miroir. Mesuré le même jour sur le
 * lexique de la voix :
 *
 *     « Je comprends parfaitement ce que tu vis. »  → passait
 *     « Tu iras beaucoup mieux. »                    → passait
 *
 * Le miroir n'était plus un miroir, et personne ne pouvait le voir : chaque module avait ses tests,
 * chacun était vert.
 *
 * ══ CE QUE LA NORMALISATION AJOUTE ICI, ET QUI MANQUAIT AUX DEUX ═════════════════════════════════
 *
 * LE DÉCODAGE DES ENTITÉS HTML. Les gardes lisent le SOURCE ; l'utilisatrice lit le RENDU. Entre
 * les deux, `&apos;` et `&nbsp;`. Mesuré :
 *
 *     "N&apos;oublie pas que tu es forte."   → aucun interdit trouvé
 *     "Je&nbsp;ressens ta peine."            → aucun interdit trouvé
 *
 * Ce n'est pas une hypothèse d'école : DIX fichiers du produit écrivent déjà ainsi, et ce sont
 * précisément ceux où vit la prose sensible — les CGU, le consentement, la page d'aide, l'écran de
 * barrière. Une réécriture éditoriale qui y glisse « n'oublie pas que tu es forte » ne rougirait
 * jamais. Un balayage complet du dépôt, entités décodées, n'a révélé AUCUNE violation masquée
 * aujourd'hui : le trou est ouvert, personne n'est encore tombé dedans.
 */

/**
 * Les entités HTML qu'un rédacteur écrit réellement dans du JSX. Volontairement COURTE : on couvre
 * ce qui sépare un mot d'un autre ou porte une apostrophe, pas les 2000 entités du standard. Une
 * liste exhaustive donnerait l'illusion d'une couverture que la suite (`&#x27;`, `&#8217;`…) ne
 * tiendrait pas — les formes numériques sont donc traitées séparément, par plage.
 */
const ENTITES: Readonly<Record<string, string>> = {
  apos: "'",
  rsquo: "'",
  lsquo: "'",
  quot: '"',
  nbsp: " ",
  ensp: " ",
  emsp: " ",
  thinsp: " ",
  hellip: "…",
  amp: "&",
};

/** `&apos;`, `&nbsp;`, `&#39;`, `&#x27;` → leur caractère. Appliqué AVANT toute autre normalisation. */
export function decoderEntites(texte: string): string {
  return texte
    .replace(/&([a-zA-Z]+);/g, (entier, nom: string) => ENTITES[nom] ?? entier)
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, n: string) => String.fromCodePoint(parseInt(n, 16)));
}

/**
 * Normalise pour la comparaison LEXICALE : entités décodées, diacritiques retirés, apostrophes
 * unifiées, minuscules, espaces écrasés.
 *
 * ⚠️ Les emoji SURVIVENT : ils sont traités à part, sur le texte d'origine, parce que la casse et
 * les accents n'ont aucun sens pour eux.
 */
export function normaliserTexte(texte: string): string {
  return decoderEntites(texte)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // diacritiques
    .replace(/[‘’ʼ`]/g, "'") // apostrophes typographiques → droite
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * UN MOT INTERCALÉ, AU PLUS — le fragment que les deux détecteurs partagent désormais.
 *
 * Le français intercale presque toujours quelque chose entre le pronom et le verbe : la négation,
 * un pronom complément, un adverbe. Un motif qui exige l'adjacence ne détecte pas le français.
 *
 * ⚠️ CE QUE ÇA COÛTE, ET POURQUOI ON PAIE. Le fragment autorise des faux positifs (« tu vois
 * l'embarras » compte un mot intercalé puis un mot en `-ras`). C'est l'arbitrage assumé des deux
 * modules : un faux positif coûte une reformulation, un faux négatif publie sous le nom d'une
 * personne réelle une phrase qu'elle n'aurait pas dite. On ne va PAS jusqu'à deux mots — le
 * rendement tombe et les faux positifs explosent.
 */
export const UN_MOT_INTERCALE = "(?:[a-z']+ )?";
