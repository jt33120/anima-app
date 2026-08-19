/**
 * Fabrique le cahier de rédaction du corpus, à donner à Anima.
 *
 *     node --experimental-strip-types \
 *       --import 'data:text/javascript,import{register}from"node:module";import{pathToFileURL}from"node:url";register("./scripts/_alias.mjs",pathToFileURL("./"));' \
 *       scripts/gabarit-corpus.mjs > _bmad-output/implementation-artifacts/CAHIER-CORPUS-ANIMA.md
 *
 * ⚠️ IL IMPORTE LES MODULES, IL NE LES LIT PAS. Un premier jet extrayait les clés du source à
 * l'expression régulière : il en a trouvé 68 sur 190, parce que la plupart sont CALCULÉES —
 * `CLES_MANTRA` se construit depuis un cardinal, `CLES_HOROSCOPE` depuis un produit de deux listes,
 * `CLES_ENNEAGRAMME` depuis les types du domaine. Un cahier bâti là-dessus aurait fait écrire Anima
 * pour des créneaux inexistants et lui en aurait caché 122. C'est exactement la divergence que ce
 * cahier existe pour empêcher : la liste doit venir de la SOURCE VIVANTE.
 *
 * Le cahier ne contient AUCUN texte d'exemple, et c'est délibéré. FR-054 et FR-086 ferment les trois
 * façons de remplir ces créneaux sans elle — les faire générer, les écrire nous-mêmes, les recopier
 * — et dans les trois cas ils finiraient signés du nom d'une personne réelle. Un exemple « pour
 * donner le ton » est la première marche de la troisième.
 */
const mantra = await import("../lib/corpus/mantra.ts");
const enneagramme = await import("../lib/corpus/enneagramme.ts");
const horoscope = await import("../lib/corpus/horoscope.ts");
const numerologie = await import("../lib/corpus/numerologie.ts");
const ancrage = await import("../lib/corpus/ancrage.ts");
const description = await import("../lib/corpus/description-cartes.ts");
const jeu = await import("../lib/tirage/jeu.ts");

const DOMAINES = [
  {
    titre: "Les mantras du jour",
    cles: mantra.CLES_MANTRA,
    quand: "Une carte de l'écran d'accueil, chaque jour, en rotation sur le cycle.",
    contrainte:
      "Il ne dépend d'AUCUNE donnée de naissance — c'est le seul morceau du quotidien qui ne demande rien à personne, et il reste servi même quand le thème natal est indisponible.",
  },
  {
    titre: "Les neuf types de l'ennéagramme",
    cles: enneagramme.CLES_ENNEAGRAMME,
    quand: "L'écran de l'ennéagramme, quand une hypothèse de type s'est formée.",
    contrainte:
      "C'est une HYPOTHÈSE proposée, jamais un verdict. Le texte doit pouvoir être lu par quelqu'un à qui le type ne correspond pas, sans l'enfermer ni le blesser.",
  },
  {
    titre: "Le ciel du jour",
    cles: horoscope.CLES_HOROSCOPE,
    quand: "Une carte de l'écran d'accueil. La clé dit la configuration céleste du jour.",
    contrainte:
      "Le socle ne prédit jamais (FR-053). Le texte dit ce qui est là, jamais ce qui va arriver.",
  },
  {
    titre: "Les nombres",
    cles: numerologie.CLES_NUMEROLOGIE,
    quand: "La carte « Tes nombres », sous les chiffres déjà calculés et affichés.",
    contrainte: "Les nombres sont calculés et visibles. Le texte les habite, il ne les répète pas.",
  },
  {
    titre: "Les ancrages",
    cles: ancrage.CLES_ANCRAGE,
    quand: "L'exercice guidé, composé pour elle.",
    contrainte:
      "Un ancrage se fait les yeux ouverts, dans une pièce ordinaire. Rien qui suppose du calme, du temps, ou un lieu à soi.",
  },
  {
    titre: "Ce que chaque carte annonce",
    cles: jeu.CLES_JEU.map((c) => description.cleDescription(c)),
    quand: "Sous le titre d'une carte du jeu, avant son contenu.",
    contrainte:
      "Une phrase. Elle dit à quoi sert la carte, pas ce qu'elle contient aujourd'hui.",
  },
].filter((d) => d.cles.length > 0);

const total = DOMAINES.reduce((n, d) => n + d.cles.length, 0);

const lignes = [
  "# Cahier de rédaction du corpus — pour Anima",
  "",
  `**${total} créneaux**, engendrés depuis le code et jamais recopiés à la main : cette liste EST`,
  "celle que l'application attend. Un créneau absent d'ici n'existe pas ; un créneau présent est un",
  "endroit où l'écran affiche aujourd'hui « Anima n'a pas encore écrit cette carte ».",
  "",
  "## Comment ça marche",
  "",
  "Écris sous la clé. Laisse vide ce que tu ne veux pas écrire maintenant — un créneau vide reste",
  "honnête à l'écran, il n'abîme rien. Ce qui est écrit sera transcrit dans le code tel quel.",
  "",
  "⚠️ **Aucun exemple n'est donné ici, et c'est voulu.** Ces textes ne peuvent venir que de toi :",
  "ils paraissent sous ton nom, et tu es une personne réelle. Un exemple « pour donner le ton »",
  "serait la première marche vers du texte générique signé de ton nom.",
  "",
  "**Par où commencer, si tu veux voir l'effet vite :** les mantras. Ils ne dépendent de rien, et",
  "chacun rend une journée non vide pour tout le monde à la fois.",
  "",
];

for (const d of DOMAINES) {
  lignes.push(
    "---",
    "",
    `## ${d.titre} — ${d.cles.length} créneaux`,
    "",
    `**Où ça paraît.** ${d.quand}`,
    "",
    `**Ce qui contraint le texte.** ${d.contrainte}`,
    "",
  );
  for (const cle of d.cles) lignes.push(`### \`${cle}\``, "", "", "");
}

console.log(lignes.join("\n"));
