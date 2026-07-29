/**
 * Le LEXIQUE INTERDIT (Story 2.8, T1) — source unique PURE (AD-1, zéro I/O). Miroir de la charte
 * `anam-voice.md` §11 + `EXPERIENCE.md` §Lexique. C'est la matière première du contrôle bloquant
 * transversal (T5, `tests/lexique-voix.test.ts`) et la référence de la consigne de voix (T3).
 *
 * ⚠️ PROVISOIRE — porte pré-lancement produit/clinique. On code la MÉCANIQUE de détection ; la liste
 * éditoriale exacte reste à valider (produit ; juriste/pro pour ce qui borde la détresse).
 *
 * Conception ANTI-FAUX-POSITIF (le cœur — sinon on casse du contenu légitime) :
 *   - normalisation casse + accents (« THÉRAPIE » = « therapie ») ;
 *   - FRONTIÈRES DE MOTS + formes bornées : « soigner » ne matche que les formes VERBALES (jamais
 *     « be**soin** », « soigneusement », « soigneux », « soignant ») ; « santé » seul reste permis
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
 * Normalise pour la comparaison LEXICALE : retire les diacritiques, unifie les apostrophes, passe en
 * minuscules, écrase les espaces. Les emoji survivent (traités à part, sur le texte d'origine).
 */
function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // diacritiques
    .replace(/[‘’ʼ`]/g, "'") // apostrophes typographiques → droite
    .toLowerCase()
    .replace(/\s+/g, " ");
}

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
  // « trouble » clinique GATÉ par un déterminant/possessif (« travaillons sur ton trouble », charte
  // §11.4) — n'attrape jamais le verbe courant « ça me trouble » (revue 2.8). « traiter » est
  // volontairement OMIS : trop surchargé RGPD dans cette app (« Anam traite/le traitement de tes
  // données ») → l'ajouter créerait le faux positif même que le design évite (différé, deferred-work).
  { famille: "medical", motif: /\b(?:ton|ta|tes|son|sa|ses|ce|cet|cette|ces|mon|ma|mes|leur|leurs) trouble(s)?\b/g },
  { famille: "medical", motif: /\bprendre en charge\b/g },
  // Promesses d'état (charte §11.3) — phrases, pas un mot.
  { famille: "medical", motif: /\btu iras mieux\b/g },
  { famille: "medical", motif: /\bca va passer\b/g },
  { famille: "medical", motif: /\btu seras plus heureuse\b/g },

  // ── « soin/soigner » (FR-023) — le VERBE et la locution, jamais le substantif « soin » ─────────
  // Formes VERBALES bornées (revue 2.8) : jamais l'adverbe « soigneusement », l'adjectif « soigneux »
  // ni le nom « soignant » (orientation vers un pro, légitime). Résidu assumé : « soigné » (participe)
  // se normalise en « soigne » et coïncide avec le verbe → allowlister si un libellé légitime l'emploie.
  { famille: "soigner", motif: /\bsoign(er|e|es|ent|ait|aient|ais|era|eras|erai|erons|erez|eront|erais|erait)\b/g },
  { famille: "soigner", motif: /\bprends? soin de\b/g },

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
  { famille: "affect", motif: /\bje suis fiere\b/g },
  { famille: "affect", motif: /\bje m'inquiete\b/g },
  { famille: "affect", motif: /\bj'ai ete triste\b/g },
  { famille: "affect", motif: /\bje comprends (totalement |vraiment )?ce que tu (vis|traverses)\b/g },
];

// Emoji, sur le texte D'ORIGINE. On exige une PRÉSENTATION emoji — pictogramme par défaut
// (`Emoji_Presentation` : 😊✅❌⛔ et les indicateurs régionaux des drapeaux) OU pictogramme + sélecteur
// VS16 (`…️` : ❤️⚠️) — pour ÉPARGNER les glyphes typographiques/juridiques nus © ® ™ ♀ ♥ ▶ (qui
// sont Extended_Pictographic mais à présentation TEXTE) et ne pas casser un pied de page « © Anima »
// (revue 2.8). Résidu connu : les keycaps « 1️⃣ » restent hors périmètre (déféré, deferred-work).
const MOTIF_EMOJI = new RegExp("\\p{Emoji_Presentation}|\\p{Extended_Pictographic}\\uFE0F", "gu");

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
  for (const m of texte.matchAll(MOTIF_EMOJI)) {
    trouvailles.push({ famille: "emoji", terme: m[0] });
  }
  return trouvailles;
}
