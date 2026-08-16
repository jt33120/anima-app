import { decoderEntites, normaliserTexte, UN_MOT_INTERCALE } from "./normalisation-texte";

/**
 * Le LEXIQUE INTERDIT (Story 2.8, T1) — source unique PURE (AD-1, zéro I/O). Miroir de la charte
 * `anam-voice.md` §11 + `EXPERIENCE.md` §Lexique. C'est la matière première du contrôle bloquant
 * transversal (T5, `tests/lexique-voix.test.ts`).
 *
 * ⚠️ IL BORNE MAINTENANT CE QU'ANAM DIT EN DIRECT — ET CE N'ÉTAIT PAS LE CAS (QA tour 1, T29/T5).
 *
 * Cet en-tête a porté successivement deux affirmations, et la seconde était la bonne :
 *
 *   • jusqu'au 2026-08-12, il se disait « la référence de la consigne de voix (T3) » — faux ;
 *   • depuis, il disait « `chercherInterdits` n'a AUCUN appelant en production — cinq consommateurs,
 *     tous des tests », et « à savoir avant d'ajouter un terme ici : cela ne changera RIEN à ce que
 *     le modèle produit ». C'était exact, et c'était un trou grand ouvert.
 *
 * Le tour de QA du 2026-08-15 en a rapporté la preuve : « **Prends soin de toi.** » — une phrase qui
 * figure MOT POUR MOT dans le contrôle positif de `lexique-interdit.test.ts`. La fonction l'attrapait
 * parfaitement. Personne ne l'appelait.
 *
 * `lib/domain/controle-sortie.ts` la branche désormais sur le flux, phrase par phrase, avant que quoi
 * que ce soit n'atteigne l'écran. Ajouter un terme ici CHANGE donc ce qui sort — avec les deux
 * conséquences : un mot en trop coupe une vraie réponse, un mot en moins la laisse passer.
 *
 * Ce module garde toujours le contenu STATIQUE (libellés, corpus d'Anima) par le même
 * `chercherInterdits` ; ce sont les deux usages d'une seule liste.
 *
 * ⚠️ PROVISOIRE — porte pré-lancement produit/clinique. On code la MÉCANIQUE de détection ; la liste
 * éditoriale exacte reste à valider (produit ; juriste/pro pour ce qui borde la détresse).
 *
 * Conception ANTI-FAUX-POSITIF (le cœur — sinon on casse du contenu légitime) :
 *   - normalisation casse + accents (« THÉRAPIE » = « therapie ») ;
 *   - FRONTIÈRES DE MOTS + formes bornées : « soin » et « soigner » sont bannis — le substantif ET
 *     les formes verbales (FR-023 : « le mot soin **et ses dérivés** ») —, jamais « be**soin** »
 *     (aucune frontière de mot), ni « soigneusement », « soigneux », « soignant » ; « santé » reste permis
 *     (« Fil Santé Jeunes ») — seule « santé mentale » est bannie ; « trouble » n'est banni que gaté
 *     par un déterminant (« **ton** trouble »), jamais « ça me trouble » ; « traiter » est omis
 *     (surchargé RGPD dans cette app) ; l'emoji exige une présentation emoji (jamais © ® ™ ♥) ;
 *   - l'attention est AUTORISÉE (« je suis là », « je lis », « je note ») — jamais confondue avec
 *     l'affect interdit (« je ressens », « ça me touche »).
 *
 * Périmètre : familles LEXICALES (mots/phrases) + emoji. Le `!`, les majuscules d'emphase et le
 * tutoiement en SORTIE LIVE relèvent de la consigne (T3), PAS d'un scan de source (où `!==`,
 * `!bloque`, sigles pullulent) — les mettre ici serait une catastrophe de faux positifs.
 */

/** Famille d'un interdit — sert aux messages d'échec parlants et au filtrage par contrôle. */
export type FamilleInterdit = "medical" | "soigner" | "formulation" | "affect" | "emoji";

export interface Interdit {
  famille: FamilleInterdit;
  /** Le fragment réellement matché (pour un message d'échec citant la preuve). */
  terme: string;
}

/**
 * ⚠️ LA NORMALISATION EST PARTAGÉE AVEC `marqueurs-prediction.ts` (revue du 2026-08-12).
 *
 * Les deux modules en portaient une copie identique, et le second se déclare « miroir structurel »
 * du premier. Le miroir a cessé d'en être un le jour où l'un des deux a été élargi sans l'autre —
 * voir l'en-tête de `normalisation-texte.ts`. Une seule implémentation, désormais.
 *
 * Elle décode aussi les ENTITÉS HTML : la garde lit le source, l'utilisatrice lit le rendu, et
 * `N&apos;oublie pas que tu es forte` passait entre les deux.
 */
const normaliser = normaliserTexte;

/**
 * Les motifs LEXICAUX, appliqués au texte NORMALISÉ (donc écrits sans accent, en minuscules). Chaque
 * entrée est ancrée par des frontières de mots pour ne pas mordre sur du légitime.
 */
const MOTIFS_LEXICAUX: Array<{ famille: FamilleInterdit; motif: RegExp }> = [
  // ── Médical / clinique (NFR-008) ──────────────────────────────────────────────────────────────
  { famille: "medical", motif: /\btherap(ie|ies|eutique|eutiques|eute|eutes)\b/g },
  { famille: "medical", motif: /\bdepress(ion|ions|if|ive|ifs|ives)\b/g },
  { famille: "medical", motif: /\banxiete(s)?\b/g },
  { famille: "medical", motif: /\bdiagnosti(c|cs|que|quer|ques)\b/g },
  { famille: "medical", motif: /\bsymptom(e|es|atique|atiques)\b/g },
  { famille: "medical", motif: /\bpathologi(e|es|que|ques)\b/g },
  { famille: "medical", motif: /\bsyndrome(s)?\b/g },
  { famille: "medical", motif: /\bburn.?out(s)?\b/g },
  { famille: "medical", motif: /\btraumatis(me|mes|ee?s?)\b/g },
  { famille: "medical", motif: /\brechute(s)?\b/g },
  // « guérir » : inclut le radical en -iss- (guérissent/guérissais/guérisseur…) sans mordre « guéridon »
  // (le préfixe imposé est « gueri », jamais « guerid »). Revue 2.8 : le repli d'énumération l'omettait.
  { famille: "medical", motif: /\bgueri(r|s|t|e|es|son|sons|ra|rai|ras|ront|ss\w*)?\b/g },
  { famille: "medical", motif: /\bsoulag(er|e|es|ent|era|erait)\b/g },
  { famille: "medical", motif: /\bprescri(re|s|t|ption|ptions)\b/g },
  { famille: "medical", motif: /\bsante mentale\b/g },
  { famille: "medical", motif: /\btrouble(s)? anxieu(x|se|ses)\b/g },

  // ── L'ADJECTIF CLINIQUE (Story 5.5, revue du 2026-08-13) ──────────────────────────────────────
  //
  // ⚠️ CE QUI MANQUAIT : le SUBSTANTIF était banni, l'ADJECTIF NU ne l'était pas. Mesuré :
  //
  //     « Le 6 vit dans l'anxiété. »   → rouge (`\banxiete(s)?\b`)
  //     « Le 6 est anxieux. »          → VERT
  //     « Le 6 est anxieuse. »         → VERT
  //     « Le 5 est évitant et obsessionnel. » → VERT
  //
  // Ce n'était pas visible tant que le produit parlait de nombres et de planètes. Ça le devient
  // avec l'ennéagramme : l'attribut est la formulation canonique de toute la littérature du
  // domaine (« le 6 est anxieux », « le 4 est mélancolique »), donc la forme qu'on écrit sans y
  // penser. Le corpus des neuf types pouvait être écrit INTÉGRALEMENT au registre clinique sans
  // qu'un seul contrôle bloquant ne morde.
  //
  // Et ce n'est pas une question de goût : « une seule phrase du mauvais côté fait rejeter l'app
  // lors de la revue ET CHANGE LE RÉGIME JURIDIQUE APPLICABLE » (addendum du brief). NFR-008 dit
  // « lexique zéro médical », pas « zéro substantif médical ».
  //
  // Ces adjectifs-ci sont bannis SANS CONDITION : aucun n'a d'usage courant non clinique.
  { famille: "medical", motif: /\banxieu(?:x|se|ses)\b/g },
  { famille: "medical", motif: /\bobsessionnel(?:le|s|les)?\b/g },
  { famille: "medical", motif: /\bphobi(?:e|es|que|ques)\b/g },
  { famille: "medical", motif: /\bnarcissi(?:que|ques|sme)\b/g },
  { famille: "medical", motif: /\bcompulsi(?:f|ve|fs|ves)\b/g },
  { famille: "medical", motif: /\bnevro(?:tique|tiques|se|ses)\b/g },
  { famille: "medical", motif: /\bpsychoti(?:que|ques)\b/g },
  { famille: "medical", motif: /\bparanoia(?:que|ques)?\b/g },
  { famille: "medical", motif: /\bbipolaire(?:s)?\b/g },
  { famille: "medical", motif: /\bschizo\w*\b/g },
  { famille: "medical", motif: /\bborderline(?:s)?\b/g },
  { famille: "medical", motif: /\bhypocondria(?:que|ques)\b/g },
  { famille: "medical", motif: /\bdissociati(?:f|ve|fs|ves)\b/g },
  // ⚠️ « évitant » est GATÉ SUR LA POSITION D'ATTRIBUT, et c'est le seul de la liste qui l'est :
  // « en évitant le conflit » est du français parfaitement ordinaire, et le bannir rendrait
  // inécrivable la reformulation même qu'on demande. C'est « EST évitant » qui bascule — le
  // participe présent décrit un geste, l'attribut range la personne.
  {
    famille: "medical",
    motif: new RegExp(
      `\\b(?:est|sont|es|suis|semble|semblent|parait|paraissent|devient|deviennent|reste|restent|sens|sent|sentent) ` +
        `(?:tres |plutot |assez |un peu |souvent |parfois |plus |moins )?evitante?s?\\b`,
      "g",
    ),
  },
  // « trouble » clinique GATÉ par un déterminant/possessif (« travaillons sur ton trouble », charte
  // §11.4) — n'attrape jamais le verbe courant « ça me trouble » (revue 2.8). « traiter » est
  // volontairement OMIS : trop surchargé RGPD dans cette app (« Anam traite/le traitement de tes
  // données ») → l'ajouter créerait le faux positif même que le design évite (différé, deferred-work).
  { famille: "medical", motif: /\b(?:ton|ta|tes|son|sa|ses|ce|cet|cette|ces|mon|ma|mes|leur|leurs) trouble(s)?\b/g },
  { famille: "medical", motif: /\bprendre en charge\b/g },
  // Promesses d'état (charte §11.3) — phrases, pas un mot.
  { famille: "medical", motif: new RegExp(`\\btu ${UN_MOT_INTERCALE}iras ${UN_MOT_INTERCALE}mieux\\b`, "g") },
  { famille: "medical", motif: new RegExp(`\\b(?:ca|cela|tout ca|tout cela) ${UN_MOT_INTERCALE}va ${UN_MOT_INTERCALE}passer\\b`, "g") },
  { famille: "medical", motif: new RegExp(`\\btu ${UN_MOT_INTERCALE}seras ${UN_MOT_INTERCALE}plus heureuse\\b`, "g") },

  // ── « soin/soigner » (FR-023) — LE MOT LUI-MÊME, ET SES DÉRIVÉS ────────────────────────────────
  // Formes VERBALES bornées (revue 2.8) : jamais l'adverbe « soigneusement », l'adjectif « soigneux »
  // ni le nom « soignant » (orientation vers un pro, légitime).
  //
  // ⚠️ LE PARTICIPE FÉMININ ÉTAIT ABSENT (revue du 2026-08-12). Le commentaire d'origine affirmait
  // que « soigné » se normalise en « soigne » et « coïncide avec le verbe » — vrai au MASCULIN,
  // faux au féminin : « soignée » se normalise en « soignee », qui ne figurait dans aucune
  // alternance. Or cette application tutoie une femme : « Anam t'a soignée » est exactement la
  // forme que le produit écrirait, et c'était la seule qui manquait.
  { famille: "soigner", motif: /\bsoign(er|e|ee|es|ees|ent|ait|aient|ais|era|eras|erai|erons|erez|eront|erais|erait)\b/g },

  // ⚠️ LE SUBSTANTIF ÉTAIT ÉPARGNÉ, ET C'ÉTAIT L'INVERSE DE L'EXIGENCE (Story 5.6, T1).
  //
  // FR-023 se lit : « **Le mot "soin"** et ses dérivés sont proscrits de toute l'interface. » Le
  // module bannissait les DÉRIVÉS (formes verbales) et épargnait LE MOT — la revue 2.8 l'assumait
  // en toutes lettres (« jamais le substantif »), par crainte du faux positif sur « be**soin** ».
  //
  // Cette crainte n'avait pas de fondement : `\bsoins?\b` ne mord pas sur « besoin » (le `s` y est
  // précédé d'un `e`, donc aucune frontière de mot). Mesuré le 2026-08-13, ce que le trou laissait
  // passer, toutes VERTES :
  //
  //     « Prendre soin de toi »      « Un soin pour aujourd'hui »      « soin du jour »
  //     « Des soins quotidiens »     « Ce soin dure trois minutes »
  //
  // La première est le libellé d'accueil canonique d'un produit de bien-être — précisément ce que
  // FR-023 existe pour tenir dehors —, et la 5.6 est la story qui écrit des libellés d'accueil.
  //
  // ⚠️ CE MOTIF SUBSUME `prends soin de`, qui vivait ici et a été RETIRÉ. Deux motifs dont l'un
  // couvre l'autre, c'est une défense redondante : le mutant qui supprime celui-ci resterait
  // invisible sur « Prends soin de toi », la phrase même qu'on testerait spontanément. Un seul
  // motif pour une seule règle — et le test de mutation vise donc « Un soin pour aujourd'hui ».
  { famille: "soigner", motif: /\bsoins?\b/g },

  // ── Formulations bannies (FR-085 — charte §3/§4/§6) — des PHRASES ──────────────────────────────
  { famille: "formulation", motif: /\btu as tout a fait raison\b/g },
  { famille: "formulation", motif: /\b(une )?excellente prise de conscience\b/g },
  { famille: "formulation", motif: /\btu as bien fait\b/g },
  { famille: "formulation", motif: /\bc'est normal de ressentir\b/g },
  { famille: "formulation", motif: /\bbravo\b/g },
  { famille: "formulation", motif: /\bwaouh\b/g },
  { famille: "formulation", motif: /\bne culpabilise pas\b/g },
  { famille: "formulation", motif: /\bn'oublie pas que tu es\b/g },
  { famille: "formulation", motif: /\btu merites d'etre heureuse\b/g },
  { famille: "formulation", motif: /\bil semble que tu ressent(es|s)\b/g },
  { famille: "formulation", motif: /\bsi je comprends bien\b/g },

  // ── Revendications d'affect (FR-087) — l'attention (« je suis là ») reste AUTORISÉE ────────────
  { famille: "affect", motif: /\bje ressens\b/g },
  { famille: "affect", motif: /\bca me touche\b/g },
  { famille: "affect", motif: /\bje m'inquiete\b/g },
  { famille: "affect", motif: /\bj'ai ete triste\b/g },

  // ── L'ÉTAT INTÉRIEUR ATTRIBUÉ, ET PAS SEULEMENT « FIÈRE » (QA tour 1, T5) ─────────────────────
  //
  // La liste ne portait qu'UN adjectif, codé en dur : `je suis fiere`. Le tour de QA a reçu
  // « **Je suis contente de l'entendre.** » — mesuré vert. C'est très exactement le défaut que la
  // 5.5 avait corrigé côté médical : le substantif était banni, l'adjectif attribut ne l'était pas,
  // et l'adjectif attribut est la formulation la plus naturelle.
  //
  // Et c'est le manquement qui coûte le plus cher de tout le rapport : il arrive DEUX ÉCRANS après
  // avoir fait cocher « elle n'a ni conscience ni intuition ». Sur un produit qui en fait une case
  // à cocher séparée, la contradiction annule la promesse.
  //
  // ⚠️ « JE SUIS LÀ » RESTE AUTORISÉ, et c'est la frontière de toute cette famille : l'ATTENTION est
  // permise (« je suis là », « j'ai lu », « je note »), la REVENDICATION D'ÉTAT ne l'est pas. La
  // liste d'adjectifs est donc énumérée, jamais ouverte — `\bje suis \w+\b` bannirait « je suis là »
  // et la moitié de ce qu'Anam a le droit de dire.
  //
  // Les intensifs sont couverts (« je suis vraiment contente ») parce qu'ils sont le premier
  // contournement involontaire du modèle, et le seul qui ne demande aucune imagination.
  {
    famille: "affect",
    motif: new RegExp(
      "\\b(?:je suis|je me sens|ca me rend)(?: (?:tres|vraiment|si|bien|un peu|plutot|tellement|sincerement))? " +
        "(?:fiere?|contente?|heureu(?:x|se)|ravie?|enchantee?|triste|desolee?|peinee?|emue?|touchee?|" +
        "bouleversee?|inquiete?|soulagee?|contrariee?|impressionnee?|admirative?|amusee?|surprise?)\\b",
      "g",
    ),
  },
  // Le pendant impersonnel, qui dit la même chose sans le « je » : « ça me fait plaisir ».
  { famille: "affect", motif: /\bca me fait (?:tres |vraiment |si )?plaisir\b/g },
  { famille: "affect", motif: /\bje me rejouis\b/g },
  // ⚠️ JUSQU'À TROIS MOTS INTERCALÉS ICI, et pas un — délibéré (revue du 2026-08-12).
  //
  // Le fragment partagé `UN_MOT_INTERCALE` en autorise UN, parce qu'il sépare un pronom d'un verbe :
  // au-delà, les faux positifs explosent. Ce motif-ci est ancré des DEUX côtés par des chaînes très
  // spécifiques — « je comprends » … « ce que tu vis/traverses » — donc élargir la fenêtre ne coûte
  // presque rien et couvre les adverbiaux réels : « parfaitement », « bien », « tout à fait »
  // (trois mots), « très bien ». L'énumération d'origine (`totalement |vraiment `) n'en couvrait
  // que deux, choisis à la main.
  { famille: "affect", motif: /\bje comprends (?:[a-z']+ ){0,3}ce que tu (?:vis|traverses)\b/g },
];

// ── L'ÉMOJI : ON DÉCLARE CE QU'ON ACCEPTE, PAS CE QU'ON REFUSE (revue du 2026-08-12) ──────────
//
// La règle exigeait une PRÉSENTATION emoji — `Emoji_Presentation` (😊✅❌⛔) ou pictogramme + VS16
// (❤️⚠️) — pour épargner les glyphes typographiques et juridiques nus © ® ™ ♀ ♥ ▶.
//
// L'intention était juste, la mécanique la dépassait de loin. Mesuré : ☺ ☹ ☠ ✌ ☝ ✍ ❄ ✈ ✂ ✔ ‼ ⁉
// passaient tous — ce sont des pictogrammes à présentation TEXTE par défaut dans Unicode, mais
// iOS et Android les rendent EN COULEUR. Sur une PWA, `☺` dans un libellé est un émoji à l'écran,
// et il franchissait le seul contrôle bloquant du produit sur la voix.
//
// La règle est donc inversée : tout `Extended_Pictographic` est banni, SAUF une liste blanche
// courte et écrite. Une liste blanche se lit et se discute ; une exclusion par propriété Unicode
// se raisonne — et ce raisonnement-là s'était trompé de douze caractères.
const TYPOGRAPHIQUES_PERMIS = new Set([
  "©", "®", "™", // mentions juridiques — un pied de page « © Anima » ne doit pas rougir
  "♀", "♂", // symboles de genre, employés en prose
  "♥", "♦", "♣", "♠", // cartes : le tirage de la 4.x en parle
  "▶", "◀", "▲", "▼", // triangles de direction, purement typographiques
  "✓", "✗", // coches ASCII-adjacentes, sans présentation couleur sur les plateformes visées
  "‹", "›", "«", "»",
]);
// ⚠️ `Regional_Indicator` EN PLUS, et ce n'est pas un détail : un drapeau (🇫🇷) est composé de deux
// indicateurs régionaux, qui ne sont PAS `Extended_Pictographic`. L'ancienne règle les attrapait via
// `Emoji_Presentation` ; inverser la règle sans cette alternance les aurait perdus en silence — une
// régression introduite en corrigeant, ce qui est la façon la plus courante d'en introduire une.
const MOTIF_PICTOGRAMME = /\p{Extended_Pictographic}|\p{Regional_Indicator}/gu;

/**
 * Cherche tous les interdits d'un texte. Retourne la liste des `{ famille, terme }` matchés (vide si
 * propre). Insensible casse/accents pour le lexical ; l'emoji sur le texte d'origine.
 */
export function chercherInterdits(texte: string): Interdit[] {
  const trouvailles: Interdit[] = [];
  const norm = normaliser(texte);
  for (const { famille, motif } of MOTIFS_LEXICAUX) {
    for (const m of norm.matchAll(motif)) {
      trouvailles.push({ famille, terme: m[0] });
    }
  }
  // Sur le texte D'ORIGINE (la casse et les accents n'ont aucun sens pour un pictogramme), mais
  // entités décodées : `&#128522;` est un émoji écrit autrement.
  for (const m of decoderEntites(texte).matchAll(MOTIF_PICTOGRAMME)) {
    if (TYPOGRAPHIQUES_PERMIS.has(m[0])) continue;
    trouvailles.push({ famille: "emoji", terme: m[0] });
  }
  return trouvailles;
}
