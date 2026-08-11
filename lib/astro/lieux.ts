/**
 * lieux.ts — `LieuxPort` : la SEULE porte par laquelle un lieu de naissance entre dans le produit
 * (Story 5.3, T2 — miroir exact d'`EphemerisPort`).
 *
 * ── POURQUOI CE PORT EXISTE ────────────────────────────────────────────────────────────────────
 *
 * Sans lieu, l'heure de naissance ne sert À RIEN : `resoudreInstant` exige le FUSEAU pour savoir
 * quel instant désigne « 07:15 », et `calculerAngles` exige les COORDONNÉES pour l'ascendant. Une
 * story qui capturerait l'heure seule tiendrait sa promesse mot à mot — « l'heure est enregistrée,
 * le thème est recalculé » — et produirait exactement le même thème qu'avant.
 *
 * ── LES TROIS FAÇONS D'OBTENIR DES COORDONNÉES, ET LA SEULE TENABLE ────────────────────────────
 *
 * 1. LES ÉCRIRE DE MÉMOIRE (humain ou modèle) — **interdit**. Une longitude fausse de 2° décale
 *    l'ascendant de ~2° : plausible, invérifiable, faux. C'est mot pour mot la règle qui interdit
 *    d'approximer Chiron (`adapters/astronomy-engine.ts`).
 * 2. UN GÉOCODEUR TIERS appelé à l'écriture — un sous-traitant de plus pour de la donnée d'état
 *    civil, et une dépendance réseau à l'instant précis où l'écriture est irréversible (0039).
 * 3. UN RÉFÉRENTIEL PUBLIC EMBARQUÉ — retenu. Voir `scripts/construire-lieux-france.mjs`.
 *
 * ── CE QUE LE PORT NE PROMET PAS ───────────────────────────────────────────────────────────────
 *
 * La couverture. L'adaptateur v1 connaît la France ; une naissance à l'étranger ne trouve pas son
 * lieu, et le produit le DIT plutôt que de placer un point au hasard. Le jour où un référentiel
 * mondial arrive, c'est un remplacement d'adaptateur — le domaine ne bouge pas. C'est précisément
 * ce qu'achète un port.
 *
 * PURETÉ : ce fichier n'importe rien. Ni `@/lib/ai/*` (AD-6), ni infra, ni `server-only`.
 */

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Le port
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Un lieu de naissance RÉSOLU — tout ce dont le thème natal a besoin, et rien de plus.
 *
 * `fuseau` est un identifiant IANA (`Europe/Paris`), JAMAIS un décalage en heures : le décalage
 * d'un lieu dépend de la DATE (heure d'été, et surtout les changements historiques). Stocker
 * « +01:00 » rendrait faux tout thème d'un été, et tout thème français d'avant 1976.
 */
export interface LieuNaissance {
  /** Le nom tel qu'il s'affiche et tel qu'il sera stocké dans `utilisatrice.lieu_naissance`. */
  readonly nom: string;
  /** Identifiant stable de la source (code INSEE pour la France). Jamais montré. */
  readonly code: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly fuseau: string;
}

export interface LieuxPort {
  /** Identifie la SOURCE et sa date, pas la bibliothèque : `"communes-france@2026-08-07"`. */
  readonly identifiant: string;
  /**
   * Les lieux correspondant à une saisie, du plus probable au moins probable, au plus `limite`.
   * Rend un tableau VIDE quand rien ne correspond — jamais un lieu approchant « pour dépanner ».
   */
  chercher(requete: string, limite: number): readonly LieuNaissance[];

  /**
   * Le lieu portant EXACTEMENT ce code, ou `null`.
   *
   * ⚠️ OPÉRATION DISTINCTE DE `chercher`, et il a fallu un test pour s'en apercevoir : la première
   * version du point d'écriture résolvait le code choisi via `chercher(code)`. Or `chercher`
   * interroge le NOM — aucune commune ne s'appelle « 33063 ». Le formulaire refusait donc toutes
   * les saisies, y compris parfaitement valides, avec un message parlant de commune introuvable.
   *
   * Les deux opérations ont des contrats opposés et ne doivent pas être confondues : `chercher` est
   * FLOU par nature (accents, tirets, casse) et rend un classement ; celle-ci est EXACTE et rend
   * une identité. C'est elle que le serveur emploie pour re-résoudre ce que le client a choisi.
   */
  trouverParCode(code: string): LieuNaissance | null;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Les fuseaux français — dans le CODE, pas dans les données
// ══════════════════════════════════════════════════════════════════════════════════════════════
//
// Une table de fuseaux figée dans un fichier de données ne peut être contrôlée par personne. Ici
// elle est confrontée à la base de fuseaux de la plateforme par `tests/lieux.test.ts` : chaque
// identifiant doit être connu d'`Intl` ET produire le décalage attendu à une date de référence.
// Ce qui serait sinon « de mémoire » devient vérifié.

/**
 * Fuseau d'une commune d'après son code INSEE. `null` ⇒ **on ne sait pas**, et l'adaptateur écarte
 * alors le lieu de ses résultats.
 *
 * ⚠️ JAMAIS `Europe/Paris` PAR DÉFAUT. Un `Europe/Paris` posé sur une naissance à Cayenne décale
 * l'instant de quatre heures, soit ~60° d'ascendant : deux signes d'écart, sans que rien n'échoue.
 * Le défaut métropolitain n'est appliqué qu'aux codes qui ne sont PAS ultramarins.
 */
export function fuseauDeCommune(code: string, latitude: number): string | null {
  const departement = code.slice(0, 3);

  switch (departement) {
    case "971":
      return "America/Guadeloupe";
    case "972":
      return "America/Martinique";
    case "973":
      return "America/Cayenne";
    case "974":
      return "Indian/Reunion";
    case "975":
      return "America/Miquelon";
    case "976":
      return "Indian/Mayotte";
    case "977":
      return "America/St_Barthelemy";
    case "978":
      return "America/Marigot";
    case "986":
      return "Pacific/Wallis";
    case "988":
      return "Pacific/Noumea";
    case "987":
      // La Polynésie française porte TROIS fuseaux, et l'écart n'est pas cosmétique : une demi-heure
      // vaut 7,5° d'ascendant, un quart de signe.
      //   • Gambier (code 98719) est à UTC−9 — identifié par son code, jamais par une frontière ;
      //   • les MARQUISES sont à UTC−9:30 : ce sont les seules communes polynésiennes au nord de
      //     11° S (la suivante vers le sud est Napuka, à 14,2° S — 3° de marge, mesurés dans le
      //     référentiel lui-même, pas devinés) ;
      //   • tout le reste (Société, Tuamotu, Australes) est à UTC−10.
      if (code === "98719") return "Pacific/Gambier";
      return latitude > -11 ? "Pacific/Marquesas" : "Pacific/Tahiti";
    case "984": // Terres australes et antarctiques : quatre archipels, quatre fuseaux, zéro naissance.
    case "989": // Clipperton : inhabitée.
      // On ne DEVINE pas un fuseau pour un lieu où personne ne naît. Ces communes sont écartées des
      // résultats de recherche : proposer un lieu qui ne pourra pas produire d'ascendant serait
      // exactement le mensonge par omission que cette story existe pour supprimer.
      return null;
    default:
      return "Europe/Paris";
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// La normalisation de recherche
// ══════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Réduit un nom de lieu à sa forme comparable : minuscules, sans diacritiques, sans ponctuation
 * de liaison (tirets, apostrophes, articles collés).
 *
 * ⚠️ CE N'EST PAS UNE COPIE des normalisations de `lexique-interdit` / `marqueurs-prediction`, et
 * ce serait une faute de les fusionner : celles-là préservent les FRONTIÈRES DE MOTS pour chercher
 * un terme dans de la prose ; celle-ci les EFFACE au contraire, parce que « Saint-Étienne »,
 * « saint etienne » et « SaintEtienne » désignent la même ville. Les deux besoins sont opposés.
 *
 * Les ligatures sont traitées AVANT `NFD` : `NFD` ne décompose pas `œ` (vérifié en Story 5.2), et
 * « Œutrange » resterait introuvable.
 */
export function normaliserLieu(texte: string): string {
  return texte
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}
