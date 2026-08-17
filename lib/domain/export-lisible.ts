import { FUSEAU } from "./ordonnanceur";
import { INVENTAIRE_EXPORT, titreDeSection } from "./inventaire-export";
import * as copie from "./copie-mes-donnees";

/**
 * export-lisible.ts — LE DOCUMENT QU'ELLE OUVRE (Story 6.6, AC1 « dans un format lisible »).
 *
 * ══ POURQUOI UN SEUL FICHIER, ET POURQUOI HTML ══════════════════════════════════════════════════
 *
 * Deux droits différents tirent dans deux directions. L'article 15 veut qu'elle COMPRENNE ce qu'on
 * a d'elle ; l'article 20 veut qu'une machine puisse le REPRENDRE. Un JSON brut honore le second et
 * se moque du premier : trois mille lignes de `{"cle_tour":"…"}` ne disent rien à personne. Un beau
 * PDF honore le premier et ferme le second.
 *
 * Et proposer les deux, c'est poser une question — « quel format veux-tu ? » — à quelqu'un qui n'a
 * pas à savoir ce qu'est un format. L'AC1 interdit le questionnaire ; un choix technique posé sur
 * le chemin en est un.
 *
 * Alors un seul fichier porte les deux : un HTML qui s'ouvre dans n'importe quel navigateur, hors
 * ligne, pour toujours — et qui porte le document COMPLET en JSON dans un `<script type=
 * "application/json">` que n'importe quel programme extrait. Un clic, un fichier, les deux droits.
 *
 * ══ LA RÈGLE QUI GOUVERNE TOUT LE FICHIER ═══════════════════════════════════════════════════════
 *
 * ⚠️ ON ITÈRE SUR LES CLÉS DU DOCUMENT, JAMAIS SUR L'INVENTAIRE. L'inventaire ne sert qu'à ORDONNER
 * et à TITRER. Une section que la base rendrait sans que ce fichier la connaisse est rendue quand
 * même, en générique, à la fin. C'est ce qui empêche qu'une table ajoutée demain à la RPC disparaisse
 * en silence du document lisible — le seul endroit où personne n'irait vérifier.
 *
 * ══ ET CE QUI SORT D'ICI EST DU HTML CONSTRUIT AVEC SON TEXTE À ELLE ════════════════════════════
 *
 * Tout ce que le document contient a été écrit par elle. Si elle a tapé `<script>` dans une entrée
 * de journal — et quelqu'un finira par le faire —, ce fichier doit le rendre VISIBLE, pas
 * l'EXÉCUTER. Chaque valeur passe par `echapper()`, et le JSON de l'annexe voit ses `<` neutralisés :
 * sans ça, un `</script>` écrit dans une conversation refermerait la balise et le reste du document
 * deviendrait du markup vivant. `tests/export-lisible.test.ts` éprouve les deux.
 */

export interface RetraitDeclare {
  readonly table: string;
  readonly colonnes: readonly string[];
  readonly motif: string;
}

export interface DocumentExport {
  readonly version: number;
  readonly genere_le: string;
  readonly retraits: readonly RetraitDeclare[];
  readonly [section: string]: unknown;
}

/** Les clés d'en-tête du document : elles décrivent l'export, elles ne sont pas une couche d'elle. */
const CLES_META = new Set(["version", "genere_le", "retraits"]);

export function echapper(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/**
 * Une date CIVILE (`YYYY-MM-DD`) — découpée, jamais convertie. Passer par `new Date()` puis
 * reformater est le geste exact qui fait basculer un jour d'un fuseau à l'autre ; le dépôt l'a déjà
 * payé deux fois.
 */
function jourCivil(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const nom = MOIS[Number(m[2]) - 1];
  const j = Number(m[3]);
  if (!nom || j < 1 || j > 31) return null;
  return `${j} ${nom} ${m[1]}`;
}

/**
 * Un INSTANT (`timestamptz`), rendu dans le fuseau du produit.
 *
 * ⚠️ `Europe/Paris` EXPLICITEMENT, jamais le fuseau de la machine. Ce fichier est fabriqué par un
 * serveur qui vit en UTC : sans le fuseau, une conversation de 23 h 30 lui reviendrait datée de
 * 21 h 30, et elle n'aurait aucun moyen de savoir que c'est le serveur qui parle et pas elle qui
 * se souvient mal.
 */
function instantLisible(iso: string): string | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: FUSEAU,
  }).format(new Date(t));
}

/** Le jour (Paris) d'un instant, pour grouper les conversations. `null` si la date est illisible. */
function jourDe(iso: unknown): string | null {
  if (typeof iso !== "string") return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: FUSEAU }).format(new Date(t));
}

const FORME_INSTANT = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

/** Une valeur de colonne, rendue lisible. Le HTML est déjà échappé en sortie. */
function valeurLisible(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "oui" : "non";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") {
    if (FORME_INSTANT.test(v)) return instantLisible(v) ?? v;
    const civil = jourCivil(v);
    return civil ?? v;
  }
  return JSON.stringify(v, null, 2);
}

/** `cle_dedoublonnage` → « Cle dedoublonnage ». Le nom exact reste dans l'annexe JSON. */
function libelle(colonne: string): string {
  const mots = colonne.replace(/_/g, " ");
  return mots.charAt(0).toUpperCase() + mots.slice(1);
}

function lignes(section: unknown): readonly Record<string, unknown>[] {
  if (!Array.isArray(section)) return [];
  return section.filter((l): l is Record<string, unknown> => typeof l === "object" && l !== null);
}

/** Le rendu générique : une fiche par ligne, une définition par colonne. Rien n'est jamais omis. */
function rendreGenerique(rows: readonly Record<string, unknown>[]): string {
  return rows
    .map((r) => {
      const defs = Object.entries(r)
        .map(
          ([k, v]) =>
            `<dt>${echapper(libelle(k))}</dt><dd>${echapper(valeurLisible(v))}</dd>`,
        )
        .join("");
      return `<dl class="fiche">${defs}</dl>`;
    })
    .join("\n");
}

/**
 * Le rendu SPÉCIAL des conversations — la seule section qu'on lit vraiment, et la seule où une
 * fiche par ligne serait illisible. Groupée par jour, comme elle l'a vécue.
 */
function rendreJournal(rows: readonly Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const morceaux: string[] = [];
  let jourCourant: string | null = null;

  for (const r of rows) {
    const jour = jourDe(r.cree_le);
    if (jour !== jourCourant) {
      jourCourant = jour;
      morceaux.push(`<h3 class="jour">${echapper(jour ?? "Date inconnue")}</h3>`);
    }
    const qui = r.role === "anam" ? "Anam" : "Toi";
    const contenu = typeof r.contenu === "string" ? r.contenu : "";
    morceaux.push(
      `<article class="tour ${r.role === "anam" ? "anam" : "moi"}">` +
        `<p class="qui">${echapper(qui)}</p>` +
        `<p class="dit">${echapper(contenu)}</p>` +
        `</article>`,
    );
  }
  return morceaux.join("\n");
}

function rendreSection(table: string, section: unknown): string {
  const rows = lignes(section);
  const titre = titreDeSection(table);
  const corps =
    rows.length === 0
      ? `<p class="vide">Rien dans cette partie.</p>`
      : table === "entree_journal"
        ? rendreJournal(rows)
        : rendreGenerique(rows);

  return (
    `<section id="s-${echapper(table)}">` +
    `<h2>${echapper(titre)}</h2>` +
    // ⚠️ IL Y AVAIT UN COMPTE ICI, ET C'ÉTAIT LE SEUL ENDROIT DU PRODUIT QUI LUI EN MONTRAIT UN
    // (revue Epic 6, R4 · FR-031).
    //
    // La ligne disait « 12 éléments · episode_detresse », et le sommaire « Les moments où le produit
    // s'est inquiété (12) ». Le décompte de ses propres effondrements, dans le document censé
    // incarner le soin porté à ses données.
    //
    // Le dépôt a tranché quatre fois dans l'autre sens — `arbitrage-frontiere`,
    // `bibliotheque-frontiere`, `ancrage-frontiere`, `arbre-rendu` portent tous une garde « le compte
    // ne traverse pas la frontière ». L'export y avait échappé parce que le compte n'y est pas un
    // champ typé mais un `rows.length` calculé au rendu : invisible aux détecteurs, qui lisent des
    // chaînes statiques.
    //
    // Le nom TECHNIQUE de la table reste : il sert à quelqu'un qui exerce l'article 20 et veut
    // recouper le document lisible avec l'annexe JSON. Il ne dit rien d'elle.
    `<p class="compte"><code>${echapper(table)}</code></p>` +
    corps +
    `</section>`
  );
}

/**
 * L'ordre des sections : l'inventaire d'abord (il porte la décision éditoriale), puis TOUT le reste
 * du document, dans son ordre à lui. La deuxième moitié est la garde : elle rend impossible qu'une
 * section connue de la base mais inconnue d'ici disparaisse du fichier.
 */
export function ordonnerSections(doc: DocumentExport): readonly string[] {
  const presentes = Object.keys(doc).filter((k) => !CLES_META.has(k));
  const connues = INVENTAIRE_EXPORT.filter((e) => presentes.includes(e.table)).map((e) => e.table);
  const inconnues = presentes.filter((k) => !connues.includes(k));
  return [...connues, ...inconnues];
}

const STYLE = `
:root { color-scheme: light; }
body { max-width: 46rem; margin: 0 auto; padding: 2.5rem 1.25rem 6rem; background: #fbfaf8; color: #23201d;
       font-family: ui-serif, Georgia, "Times New Roman", serif; line-height: 1.65; }
h1 { font-size: 1.9rem; font-weight: 500; margin: 0 0 .35rem; }
h2 { font-size: 1.3rem; font-weight: 500; margin: 3.5rem 0 .2rem; border-top: 1px solid #ddd6cc; padding-top: 1.6rem; }
h3.jour { font-size: .95rem; font-weight: 500; color: #7c7266; margin: 2rem 0 .6rem; }
p { margin: 0 0 .7rem; }
.preambule { color: #5c554d; }
.sommaire { list-style: none; padding: 0; columns: 2; font-size: .95rem; }
.sommaire a { color: #23201d; }
.compte, .vide { font-size: .85rem; color: #7c7266; margin-bottom: 1.1rem; }
.fiche { display: grid; grid-template-columns: minmax(9rem, 14rem) 1fr; gap: .15rem .9rem;
         border-left: 2px solid #e4ded4; padding: .5rem 0 .5rem .9rem; margin: 0 0 1rem; font-size: .93rem; }
dt { color: #7c7266; }
dd { margin: 0; overflow-wrap: anywhere; white-space: pre-wrap; }
.tour { margin: 0 0 1rem; }
.tour .qui { font-size: .8rem; letter-spacing: .06em; text-transform: uppercase; color: #7c7266; margin: 0 0 .15rem; }
.tour .dit { white-space: pre-wrap; margin: 0; }
.tour.anam .dit { color: #3d3a34; font-style: italic; }
code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .85em; color: #7c7266; }
footer { margin-top: 4rem; border-top: 1px solid #ddd6cc; padding-top: 1.4rem; font-size: .85rem; color: #7c7266; }
`.trim();

/**
 * Le nom du fichier téléchargé — `anam-mes-donnees-2026-08-16.html`.
 *
 * Le jour est celui de PARIS, pas celui du serveur : un export lancé à 1 h du matin porterait
 * sinon la date de la veille, et deux exports de la même nuit se recouvriraient dans son dossier.
 * `sv-SE` est ici un simple raccourci vers la forme `AAAA-MM-JJ` — c'est la forme qui trie bien.
 */
export function nomFichierExport(doc: DocumentExport): string {
  const t = Date.parse(doc.genere_le);
  // ⚠️ LE NETTOYAGE PORTE SUR LA DATE SEULE, ET UN TEST A DÛ ME LE FAIRE VOIR. Appliqué aussi au
  // repli, il rabotait « sans-date » en « -- » : un fichier nommé `anam-mes-donnees--.html`, qui ne
  // dit plus rien et se confond avec le suivant dans un dossier de téléchargements.
  const jour = Number.isFinite(t)
    ? new Intl.DateTimeFormat("sv-SE", { timeZone: FUSEAU }).format(new Date(t)).replace(/[^\d-]/g, "")
    : "sans-date";
  return `${copie.NOM_FICHIER_PREFIXE}-${jour}.html`;
}

/** Le document complet, en un seul fichier autonome. */
export function rendreExportLisible(doc: DocumentExport): string {
  const sections = ordonnerSections(doc);
  const genere = instantLisible(doc.genere_le) ?? doc.genere_le;

  // Le sommaire porte les TITRES, jamais les comptes (revue Epic 6, R4 · FR-031).
  const sommaire = sections
    .map((t) => `<li><a href="#s-${echapper(t)}">${echapper(titreDeSection(t))}</a></li>`)
    .join("");

  const retraits = (doc.retraits ?? [])
    .map(
      (r) =>
        `<li><code>${echapper(r.table)}</code> — ${echapper(r.colonnes.join(", "))} : ${echapper(r.motif)}</li>`,
    )
    .join("");

  // ⚠️ LE `<` NEUTRALISÉ, ET C'EST LA LIGNE QUI TIENT L'ANNEXE. Un `</script>` tapé dans une
  // conversation refermerait la balise et livrerait tout le reste du fichier au parseur HTML.
  const brut = JSON.stringify(doc, null, 2).replace(/</g, "\\u003c");

  return [
    "<!doctype html>",
    '<html lang="fr">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    // Le fichier vit hors ligne, pour toujours : aucune requête sortante ne doit pouvoir en partir.
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'">',
    `<title>${echapper(copie.DOCUMENT_TITRE)}</title>`,
    `<style>${STYLE}</style>`,
    "</head>",
    "<body>",
    `<h1>${echapper(copie.DOCUMENT_TITRE)}</h1>`,
    `<p class="preambule">${echapper(copie.DOCUMENT_GENERE_LE)} ${echapper(genere)}.</p>`,
    `<p class="preambule">${echapper(copie.DOCUMENT_PREAMBULE)}</p>`,
    `<ul class="sommaire">${sommaire}</ul>`,
    sections.map((t) => rendreSection(t, doc[t])).join("\n"),
    "<footer>",
    `<p>${echapper(copie.DOCUMENT_TITRE_RETRAITS)}</p>`,
    retraits ? `<ul>${retraits}</ul>` : `<p>—</p>`,
    `<p>${echapper(copie.DOCUMENT_ANNEXE)}</p>`,
    "</footer>",
    `<script type="application/json" id="donnees-brutes">${brut}</script>`,
    "</body>",
    "</html>",
  ].join("\n");
}
