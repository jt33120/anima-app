import { normaliserTexte, UN_MOT_INTERCALE } from "./normalisation-texte";
/**
 * marqueurs-prediction.ts — LE DÉTECTEUR DE PRÉDICTION (Story 5.2, T6 — FR-053).
 *
 * Source unique PURE (AD-1, zéro I/O), miroir structurel de `lexique-interdit.ts` : mêmes
 * normalisation, mêmes frontières de mots, même sortie `{ famille, terme }` pour des messages
 * d'échec qui citent leur preuve.
 *
 * ── POURQUOI CE FICHIER N'EXISTAIT PAS AVANT ───────────────────────────────────────────────────
 *
 * En 5.1, FR-053 (« le socle ne prédit jamais ») était STRUCTUREL : le thème natal ne porte aucun
 * champ de texte libre, donc il n'existe aucun endroit où une prédiction pourrait s'écrire. La garde
 * surveillait l'APPARITION d'un tel endroit, pas son contenu.
 *
 * La 5.2 introduit du texte (`lib/corpus/`). La garde ne peut plus être « il n'y a pas d'endroit » ;
 * elle devient « ce qui est écrit ne prédit pas ». C'est-à-dire un détecteur — et un détecteur de
 * prédiction est une GARDE D'ABSENCE, le type de garde le plus facile à écrire faux : elle réussit
 * silencieusement dans le bon sens. Elle est donc éprouvée POUR ELLE-MÊME dans
 * `tests/corpus-architecture.test.ts` (connues-mauvaises ET connues-bonnes) avant tout balayage.
 *
 * ── LE PROBLÈME DU FUTUR EN FRANÇAIS ───────────────────────────────────────────────────────────
 *
 * Les terminaisons du futur simple (`-ras`, `-ra`, `-ront`) sont un champ de mines si on les cherche
 * nues : « emba**rras** », « camé**ra** », « af**front** », « **front** ». Un détecteur bâti dessus
 * rougirait sur du texte parfaitement légitime, on l'assouplirait, et il finirait par ne plus rien
 * attraper.
 *
 * La sélectivité vient donc du **destinataire**, pas de la terminaison : ce qui fait la prédiction,
 * c'est le futur ADRESSÉ À ELLE (« **tu** verras », « cela **t'**apportera »). Un futur impersonnel
 * — « le cycle se refermera » — n'annonce rien sur sa vie et n'est pas visé.
 *
 * ── ARBITRAGE ASSUMÉ : PLUTÔT TROP QUE PAS ASSEZ ───────────────────────────────────────────────
 *
 * Sur un corpus d'interprétations, un faux positif coûte une reformulation ; un faux négatif publie
 * une prédiction sous le nom d'une personne réelle. « tu pourras » sera donc signalé alors qu'il est
 * souvent anodin — la réponse est d'écrire « tu peux ».
 *
 * ── CE QUI EST DÉLIBÉRÉMENT ÉPARGNÉ ────────────────────────────────────────────────────────────
 *
 * - le **conditionnel** (« ce serait », « on pourrait y lire ») : hedgé, donc pas une prédiction ;
 * - « **destinée** » : c'est du vocabulaire numérologique de base (« nombre de destinée »). La
 *   bannir rendrait le corpus inécrivable ;
 * - « **prédisposition** » : mot légitime, épargné par les frontières de mots ;
 * - « les mois **à venir** » : un repère temporel n'annonce rien tant qu'aucun verbe ne suit.
 *
 * ── ⚠️ CE DÉTECTEUR N'EST PAS LA GARDE. LA RELECTURE HUMAINE EST LA GARDE. ─────────────────────
 *
 * À écrire tel quel dans la fiche de génération d'Anima, et à relire avant d'écrire une ligne de
 * corpus. Ce fichier attrape des FORMES ; FR-053 interdit un ACTE. Les deux ne coïncident pas :
 *
 *   • « Cette configuration ouvre une période où beaucoup de choses se dénouent » ne contient
 *     aucun futur adressé, aucun mot de la liste — et annonce l'avenir de quelqu'un.
 *   • « Tu ne verras jamais rien venir » aurait été manqué jusqu'à la revue du 2026-08-12, où l'on
 *     a mesuré que le détecteur attrapait DEUX phrases prédictives sur onze.
 *
 * La leçon de cette revue n'est pas « le motif était trop étroit », c'est **un détecteur lexical ne
 * peut pas décider si un texte prédit**. Il rattrape les distractions, il ne relit pas. Quiconque
 * s'appuie sur le vert de `tests/corpus-architecture.test.ts` pour ne pas relire une interprétation
 * a mal compris à quoi sert ce fichier — et publiera une prédiction sous le nom d'Anima.
 */

export type FamillePrediction = "futur_adresse" | "avenir" | "vocabulaire";

export interface Prediction {
  famille: FamillePrediction;
  /** Le fragment réellement matché — pour un message d'échec qui cite sa preuve. */
  terme: string;
}

/**
 * ⚠️ LA MÊME NORMALISATION QUE `lexique-interdit.ts`, ET C'EST LITTÉRALEMENT LA MÊME FONCTION.
 *
 * Elle était RECOPIÉE ici. Ce fichier se déclare « miroir structurel » de l'autre — et le miroir a
 * cessé d'en être un le 2026-08-12, quand l'élargissement à UN MOT INTERCALÉ a été fait ici et pas
 * là-bas. Deux implémentations d'un même invariant divergent (leçon R1-bis) : elles ont divergé le
 * jour même de la correction. Une seule, désormais, dans `normalisation-texte.ts`.
 */
const normaliser = normaliserTexte;

/**
 * UN MOT INTERCALÉ, AU PLUS — et c'est ce qui manquait (revue du 2026-08-12, D1).
 *
 * Les motifs exigeaient que le verbe suive IMMÉDIATEMENT le pronom. En français, il ne le suit
 * presque jamais : la négation, les pronoms compléments et les adverbes s'intercalent. Mesuré sur
 * onze phrases prédictives réelles, le détecteur d'origine en attrapait DEUX.
 *
 *     tu ne verras rien      → passait        tu vas y arriver     → passait
 *     tu me diras            → passait        tu vas te sentir     → passait
 *     tu y trouveras         → passait        tu en sortiras       → passait
 *     tu te sentiras mieux   → passait        cela te le dira      → passait
 *
 * « tu ne verras » est la forme la PLUS courante, et c'était la première à échapper. Un détecteur
 * qui ne voit pas la négation ne détecte pas le français.
 *
 * Le fragment vit maintenant dans `normalisation-texte.ts`, partagé avec le lexique de la voix —
 * qui souffrait du même défaut sans que personne ne fasse le lien (« je comprends PARFAITEMENT ce
 * que tu vis » passait).
 */

const MOTIFS: Array<{ famille: FamillePrediction; motif: RegExp }> = [
  // ── Le futur ADRESSÉ (le cœur du détecteur) ──────────────────────────────────────────────────
  // Futur simple à la 2ᵉ personne : « tu verras », « tu ne seras », « tu te sentiras », « tu y trouveras ».
  // Le préfixe « tu » obligatoire est ce qui épargne « embarras », « fracas », « repas » isolés.
  { famille: "futur_adresse", motif: new RegExp(`\\btu ${UN_MOT_INTERCALE}[a-z']+ras\\b`, "g") },
  // Futur proche : « tu vas rencontrer », « tu vas y arriver », « tu vas te sentir », « tu vas voir ».
  // Les quatre terminaisons d'infinitif sont exigées, et c'est ce qui épargne le présent littéral
  // d'« aller » — « tu vas bien », « tu vas mieux » ne sont pas des annonces.
  { famille: "futur_adresse", motif: new RegExp(`\\btu vas ${UN_MOT_INTERCALE}[a-z']*(?:er|ir|re|oir)\\b`, "g") },
  // Le complément d'objet : « cela t'apportera », « cette année t'ouvrira », « ils te mèneront ».
  { famille: "futur_adresse", motif: /\bt'[a-z]+(?:ra|ront)\b/g },
  { famille: "futur_adresse", motif: new RegExp(`\\bte ${UN_MOT_INTERCALE}[a-z]+(?:ra|ront)\\b`, "g") },
  // « il t'arrivera » / « ce qui t'attend » — la promesse d'événement, sans verbe au futur.
  { famille: "futur_adresse", motif: /\bce qui t'attend\b/g },

  // ── L'avenir comme objet possédé ─────────────────────────────────────────────────────────────
  // « ton avenir », « votre avenir ». « l'avenir » seul est épargné : « personne ne connaît
  // l'avenir » est une phrase ANTI-prédictive, et la bannir serait absurde.
  { famille: "avenir", motif: /\b(ton|ta|votre|son|sa) (avenir|futur|destin)\b/g },

  // ── Le vocabulaire divinatoire ───────────────────────────────────────────────────────────────
  // Formes explicites, jamais un préfixe : `\bpredi\w*` attraperait « prédisposition ».
  { famille: "vocabulaire", motif: /\bpredictions?\b/g },
  { famille: "vocabulaire", motif: /\bpredire\b/g },
  { famille: "vocabulaire", motif: /\bpredit(?:e|s|es)?\b/g },
  { famille: "vocabulaire", motif: /\bpredisent\b/g },
  { famille: "vocabulaire", motif: /\bprophetie?s?\b/g },
  // Le nom ET le verbe : « un présage » comme « les cartes présagent ». N'énumérer que le nom
  // laisserait passer la forme la plus prédictive des deux.
  { famille: "vocabulaire", motif: /\bpresag(?:e|es|ent|er)\b/g },
  { famille: "vocabulaire", motif: /\bvoyances?\b/g },
  // « Ce nombre ANNONCE une période de… » est la formule prédictive type du genre. Elle sera
  // parfois signalée à tort (« l'annonce d'une naissance ») — arbitrage assumé, voir l'en-tête.
  { famille: "vocabulaire", motif: /\bannonc(?:e|es|ent)\b/g },

  // ── LA FAMILLE QUI MANQUAIT (revue du 2026-08-12, D1) ────────────────────────────────────────
  //
  // Le vocabulaire divinatoire recensé s'arrêtait à quatre racines — « prédire », « prophétie »,
  // « présager », « voyance ». Or c'est un champ lexical, pas une liste : le registre ésotérique
  // dispose de dizaines de façons d'annoncer sans employer aucun de ces quatre mots, et ce sont
  // justement les plus élégantes qui sont les plus faciles à écrire sans y penser. « Ce nombre
  // augure une année de passage » n'aurait fait rougir personne.
  { famille: "vocabulaire", motif: /\baugur(?:e|es|ent|er|ait|aient)\b/g },
  { famille: "vocabulaire", motif: /\bauspices?\b/g },
  { famille: "vocabulaire", motif: /\boracles?\b/g },
  { famille: "vocabulaire", motif: /\bdivinatoires?\b/g },
  { famille: "vocabulaire", motif: /\bdivinations?\b/g },
  { famille: "vocabulaire", motif: /\bpremoni(?:tion|tions|toire|toires)\b/g },
  { famille: "vocabulaire", motif: /\bprophetis(?:e|es|er|ent)\b/g },
  // « il est écrit que… » — la prédiction déguisée en constat, la plus difficile à contredire.
  { famille: "vocabulaire", motif: /\bil est ecrit\b/g },
  // ⚠️ « destinée » SEULE reste épargnée (nombre de destinée, cf. en-tête). C'est « destinée À »
  // qui bascule : « tu es destinée à rencontrer » annonce, là où « ton nombre de destinée » nomme.
  { famille: "vocabulaire", motif: /\bdestine(?:e|es|s)? a [a-z']/g },
];

/**
 * Cherche toutes les marques de prédiction d'un texte. Rend la liste des `{ famille, terme }`
 * (vide si le texte est propre). Insensible à la casse et aux accents.
 */
export function chercherPredictions(texte: string): Prediction[] {
  const trouvailles: Prediction[] = [];
  const norm = normaliser(texte);
  for (const { famille, motif } of MOTIFS) {
    for (const m of norm.matchAll(motif)) {
      trouvailles.push({ famille, terme: m[0] });
    }
  }
  return trouvailles;
}
