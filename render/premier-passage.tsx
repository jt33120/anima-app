/**
 * premier-passage.tsx — CE QUE LE SEUIL DIT LA PREMIÈRE FOIS (QA visuelle du 2026-08-19, H4)
 *
 * Le constat : « Pas de passage "je viens de m'inscrire" → "je sais quoi faire". » On sortait de
 * trois formulaires — un code, une date de naissance, deux cases d'article 9 — pour arriver devant
 * une phrase, une porte, et derrière : une pile de cartes et trois noms dans une barre. Personne
 * n'avait jamais dit ce qu'était Anam, ce qu'était l'arbre, ni par quoi commencer.
 *
 * ── CE QUE CE COMPOSANT N'EST PAS ─────────────────────────────────────────────────────────────
 *
 * Ce n'est pas une visite guidée. Pas de modale, pas de pastilles « 1/4 », pas de flèche qui
 * désigne un bouton, pas de calque qui assombrit la page. Rien de tout ça n'existe dans ce
 * produit, et l'ajouter pour l'expliquer serait contradictoire : on ne présente pas un lieu calme
 * en l'interrompant.
 *
 * C'est le SEUIL qui parle un peu plus longtemps, une fois. Il est déjà là, il est déjà la porte,
 * et il est déjà le seul écran que tout le monde traverse. Le texte s'ajoute entre la phrase
 * d'accueil et le bouton ; le bouton, lui, ne change pas.
 *
 * ── LA FRONTIÈRE (AD-7/AD-10) ─────────────────────────────────────────────────────────────────
 *
 * `render/` ne connaît pas `lib/domain/`. La forme est donc redéclarée ici, et
 * `tests/premier-passage-frontiere.test.ts` vérifie que les deux déclarations coïncident — et
 * surtout qu'AUCUNE des deux ne gagne un champ capable de porter un compte (« 4 cartes vides sur
 * 6 »). Même patron que `render/accueil/types.ts`, pour la même raison : le compte fuit par le
 * type (leçon de la 4.10).
 */

/** Le modèle de vue du premier passage. Miroir de `lib/domain/premier-passage.ts`. */
export interface PremierPassageVue {
  readonly du: boolean;
  readonly desCartesAttendent: boolean;
}

export interface ProprietesPremierPassage {
  readonly modele: PremierPassageVue;
  /** La classe du bloc, injectée par la scène — le composant ne connaît pas la feuille du monde. */
  readonly classe: string;
  readonly classeListe: string;
  readonly classeNote: string;
}

export default function PremierPassage({
  modele,
  classe,
  classeListe,
  classeNote,
}: ProprietesPremierPassage) {
  if (!modele.du) return null;

  return (
    <section className={classe} aria-labelledby="premier-passage-titre">
      {/* Un <h2> sous le <h1> « Anam » du seuil : la hiérarchie reste lisible au lecteur d'écran,
          et la voix de titre reste UNE (Fraunces) — voir la garde d'échelle typographique. */}
      <h2 id="premier-passage-titre" className="t-titre-sm">
        Trois places
      </h2>

      {/* Une liste de définitions, parce que c'est exactement ce que c'est : un nom, ce qu'il
          désigne. Trois paragraphes rendraient la même chose à l'œil et rien du tout à l'oreille. */}
      {/*
        ⚠️ UNE LIGNE PAR PLACE, ET C'EST UNE CONTRAINTE MESURÉE — PAS UN GOÛT.

        La première version donnait deux phrases à chaque place. Mesuré sur iPhone 14 (390 × 664) :
        le bloc faisait 621 px, le contenu du seuil 1 132 px pour 664 de haut, et « entrer dans le
        monde » sortait ENTIÈREMENT du viewport — ratio 0. Quelqu'un qui arrive voyait une
        présentation et aucune porte. `e2e/premier-passage.spec.ts` l'a dit avant moi.

        Ce qu'on présente en franchissant une porte tient en trois lignes. Ce qui ne tient pas ici
        se découvre en le vivant — c'est le propos du lieu.
      */}
      <dl className={classeListe}>
        <div>
          <dt className="t-corps">Anam</dt>
          <dd className="t-corps">on parle. C&rsquo;est une IA, et elle le dit elle-même.</dd>
        </div>
        <div>
          <dt className="t-corps">L&rsquo;arbre</dt>
          <dd className="t-corps">ce qui compte pour toi y prend une branche.</dd>
        </div>
        <div>
          <dt className="t-corps">L&rsquo;accueil</dt>
          <dd className="t-corps">le ciel et les nombres de ta journée.</dd>
        </div>
      </dl>

      {/* « Je sais quoi faire » — une seule phrase, et pas un ordre. Le produit ne pousse pas :
          il dit ce qui est le plus simple, et laisse le choix entier. */}
      <p className="t-corps">
        Commence par où tu veux. Le plus simple, c&rsquo;est de parler à Anam.
      </p>

      {/*
        ⚠️ LA PHRASE QUI SE RETIRE TOUTE SEULE.

        Quatre cartes sur six disent « Anima n'a pas encore écrit cette carte » — c'est l'état réel
        du produit, et sans un mot pour l'expliquer, ça se lit comme une panne le jour de
        l'inscription. On le dit donc ici, une fois, à l'endroit où l'on présente le lieu.

        Elle ne paraît que TANT QUE C'EST VRAI (`desCartesAttendent`, dérivé de la bibliothèque du
        jour). Le jour où le corpus sera écrit, elle disparaîtra sans que personne ait à se
        souvenir de l'effacer : une phrase de bienvenue périmée est pire que pas de phrase.

        « écrits à la main, jamais par Anam » n'est pas une formule : c'est FR-054/FR-086. Ces
        textes-là ne sont PAS produits par le modèle, et c'est probablement la chose la plus
        importante à savoir sur ce lieu.
      */}
      {modele.desCartesAttendent && (
        <p className={`t-meta ${classeNote}`}>
          Les textes d&rsquo;ici sont écrits à la main, jamais par Anam. Certaines cartes
          attendent encore les leurs.
        </p>
      )}
    </section>
  );
}
