import type { MessageIa } from "@/lib/ai/port";

/**
 * contexte-anam.ts — CE QU'ANAM SAIT DE LA PERSONNE À QUI ELLE PARLE (QA manuelle du 2026-08-20).
 *
 * ══ LE CONSTAT ═══════════════════════════════════════════════════════════════════════════════════
 *
 * « Anam est juste un wrapper de LLM là, elle doit guider. » En ouvrant la route, c'est exactement
 * ce qu'elle était : le modèle recevait `[voix, phase, détresse, …messages du client]` — une
 * consigne de STYLE, une consigne de PHASE, et rien d'autre. Ni le prénom, ni le socle calculé, ni
 * les branches déjà nommées, ni les faits retenus. Le produit a un écran « ce qu'Anam retient »
 * (6.5) et une mémoire à trois couches (AD-8/AD-18) — dont AUCUNE ligne n'atteignait la
 * conversation. Anam avait une mémoire et n'y avait pas accès.
 *
 * Ce module est la moitié PURE de la correction : il compose, à partir d'une matière déjà lue, le
 * message système qui porte ce savoir. `lib/data/lire-contexte-anam.ts` est l'autre moitié.
 *
 * ══ CE QUE CE BLOC N'A PAS LE DROIT DE FAIRE ═════════════════════════════════════════════════════
 *
 * ⚠️ AUCUN COMPTE (FR-031/AC5 [DUR]). Ni « 3 branches », ni « 12 faits », ni « et 5 autres ». Un
 * chiffre dans le contexte ressort dans la bouche d'Anam, et le produit tient à ne jamais compter
 * ce qu'une personne a ou n'a pas. Les listes sont donc bornées SANS dire qu'elles le sont.
 *
 * ⚠️ IL NE COMMANDE RIEN À LA SÉCURITÉ. Il est injecté LOIN des messages, avant la consigne de
 * phase et avant l'overlay de détresse : l'ordre `[voix, contexte, phase, détresse, …messages]`
 * garantit que ce qu'on lui apprend ne peut pas primer sur ce qu'on lui interdit.
 *
 * ⚠️ ET IL DIT « JE NE SAIS PAS » PLUTÔT QUE DE LAISSER DEVINER. Une première séance sans matière
 * produit une consigne EXPLICITE d'ignorance. Sans elle, un modèle à qui l'on ne dit rien comble :
 * il invente un passé commun, salue comme s'il vous connaissait, et c'est précisément ce qui fait
 * qu'un assistant sonne faux.
 */

/** Une branche déjà nommée, telle qu'Anam a besoin de la connaître — jamais son identifiant. */
export interface BrancheConnue {
  readonly nom: string;
  /** Le troisième état d'une branche : la pleine lumière, déclarée par elle (jamais déduite). */
  readonly enPleineLumiere: boolean;
}

export interface MatiereContexte {
  readonly prenom: string | null;
  /** « Soleil en Balance », « Lune en Poissons »… Déjà mis en mots par la couche de lecture. */
  readonly socle: readonly string[];
  readonly branches: readonly BrancheConnue[];
  /** Ce qu'Anam a retenu des échanges passés (art. 9), le plus récent d'abord. */
  readonly retenu: readonly string[];
  /** L'hypothèse de type, si elle a été posée ET dite. Jamais un verdict. */
  readonly typePressenti: string | null;
  /** Aucune séance antérieure : le fil est vierge. */
  readonly premiereFois: boolean;
}

/**
 * Les bornes. Elles existent pour deux raisons distinctes, et la seconde n'est pas une question de
 * coût : au-delà d'une poignée d'éléments, un modèle se met à RÉCITER le contexte au lieu de s'en
 * servir — il dit « je vois que tu as parlé de X, Y et Z » et la conversation devient un inventaire.
 */
export const CONTEXTE_BRANCHES_MAX = 8;
export const CONTEXTE_RETENU_MAX = 16;
export const CONTEXTE_SOCLE_MAX = 4;

const listeSobre = (items: readonly string[]) => items.map((x) => `— ${x}`).join("\n");

/**
 * Le message système qui porte le contexte. `null` n'est jamais rendu : même sans aucune matière,
 * l'ignorance est une information, et c'est celle qui évite le plus de dégâts.
 */
export function consigneContexte(m: MatiereContexte): MessageIa {
  const l: string[] = [];

  l.push("CE QUE TU SAIS D’ELLE. Ce bloc est ta mémoire : il vient de la base, pas d’elle.");
  l.push(
    "Tu ne le récites jamais, tu ne l’annonces jamais (« je vois dans mon contexte que… »), et tu " +
      "n’inventes rien au-delà. Ce qui n’y est pas, tu ne le sais pas.",
  );
  l.push("");

  if (m.prenom) {
    l.push(`Elle s’appelle ${m.prenom}. Tu peux l’appeler par son prénom, sans en abuser.`);
  } else {
    l.push("Tu ne connais pas son prénom. Ne lui en invente pas et ne le lui redemande pas ici.");
  }

  if (m.socle.length > 0) {
    l.push("");
    l.push("Son socle calculé, qui ne change jamais :");
    l.push(listeSobre(m.socle.slice(0, CONTEXTE_SOCLE_MAX)));
    l.push(
      "C’est une matière, pas une explication : tu ne t’en sers jamais pour prédire ni pour " +
        "justifier ce qu’elle est (« tu es comme ça parce que tu es Balance »).",
    );
  }

  if (m.typePressenti) {
    l.push("");
    l.push(
      `Une hypothèse de type a été posée avec elle : ${m.typePressenti}. C’est une hypothèse ` +
        "réfutable, déjà énoncée. Tu ne la reposes pas et tu ne la traites pas comme un fait.",
    );
  }

  if (m.branches.length > 0) {
    const bornees = m.branches.slice(0, CONTEXTE_BRANCHES_MAX);
    const ouvertes = bornees.filter((b) => !b.enPleineLumiere);
    l.push("");
    l.push("Ce qui porte déjà un nom dans son arbre :");
    l.push(listeSobre(bornees.map((b) => (b.enPleineLumiere ? `${b.nom} (en pleine lumière)` : b.nom))));
    if (ouvertes.length > 0) {
      // ⚠️ « QUI VIT ENCORE », JAMAIS « QU'IL RESTE À FAIRE ». La nuance porte tout le produit : ce
      // n'est pas une liste de tâches, et une branche n'a pas à être « terminée ».
      l.push(
        "Ces branches-là vivent encore. Si l’une revient dans ce qu’elle dit, tu la reconnais par " +
          "son nom plutôt que de la redécouvrir.",
      );
    }
  }

  if (m.retenu.length > 0) {
    l.push("");
    l.push("Ce que tu as retenu d’elle jusqu’ici, du plus récent au plus ancien :");
    l.push(listeSobre(m.retenu.slice(0, CONTEXTE_RETENU_MAX)));
    l.push(
      "Tu t’en sers pour ne pas lui faire tout répéter. Tu ne t’en sers pas pour lui prouver que " +
        "tu te souviens.",
    );
  }

  if (m.premiereFois) {
    l.push("");
    l.push(
      // ⚠️ « ELLE », JAMAIS « VOUS » — et c'est une garde qui l'a exigé. `qa-visuelle-19-aout`
      // interdit le vouvoiement dans toute chaîne affichable, et une consigne système EST une
      // chaîne que le modèle recopie : un « vous » ici ressort en « vous » dans sa bouche.
      "C’EST LA PREMIÈRE FOIS. Tu ne la connais pas. Tu ne fais semblant de rien : pas de " +
        "retrouvailles, pas de « comme tu me le disais », pas de familiarité empruntée. Tu " +
        "commences par une question ouverte, une seule, et tu écoutes.",
    );
  } else if (m.branches.length === 0 && m.retenu.length === 0) {
    // Ni première fois, ni matière : elle est déjà venue et rien n'a été retenu. Le dire évite
    // qu'Anam le comble en inventant une continuité qui n'existe pas.
    l.push("");
    l.push(
      "Elle est déjà venue te parler, mais rien n’a été retenu de ces échanges. N’invente pas une " +
        "continuité : reprends comme si le sujet était neuf, sans t’en excuser.",
    );
  }

  return { role: "system", content: l.join("\n") };
}
